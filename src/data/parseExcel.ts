import type * as XLSX from "xlsx";
import { formatCurveEntityPair } from "./curveLabels";
import {
  createEntityId,
  createImportedSourceInstanceId,
  createPcrDatasetFromCurves,
  createStats
} from "./normalizePcrData";
import type { CellValueProvenance, Curve, FormulaCacheStatus, PcrDataset, PcrWarning, WarningSourceRef } from "./types";

type XlsxModule = typeof import("xlsx");

type ParseSuccess = {
  ok: true;
  dataset: PcrDataset;
};

type ParseFailure = {
  ok: false;
  error: PcrWarning;
  warnings: PcrWarning[];
};

export type ParseExcelResult = ParseSuccess | ParseFailure;

let xlsxModulePromise: Promise<XlsxModule> | null = null;

export async function parseExcelFile(file: File): Promise<ParseExcelResult> {
  const buffer = await file.arrayBuffer();
  return parseExcelWorkbook(buffer, file.name);
}

export async function parseExcelWorkbook(buffer: ArrayBuffer | Uint8Array, fileName: string): Promise<ParseExcelResult> {
  if (!isSupportedExcelFileName(fileName)) {
    const error = createWarning({
      code: "UNSUPPORTED_FILE_TYPE",
      severity: "error",
      scope: "import",
      message: "Only .xls and .xlsx files are supported."
    });
    return { ok: false, error, warnings: [error] };
  }

  const signatureWarnings = createFileSignatureWarnings(buffer, fileName);
  try {
    const xlsx = await loadXlsx();
    const workbook = xlsx.read(buffer, {
      type: "array",
      cellDates: false,
      cellFormula: true,
      cellNF: true,
      cellText: true,
      raw: true
    });
    return parseWorkbook(workbook, fileName, xlsx, signatureWarnings);
  } catch (cause) {
    const error = createWarning({
      code: "PROTECTED_OR_UNREADABLE_WORKBOOK",
      severity: "error",
      scope: "import",
      message: "Workbook could not be read by the browser parser.",
      rawValue: cause instanceof Error ? cause.message : String(cause)
    });
    return { ok: false, error, warnings: [...signatureWarnings, error] };
  }
}

export function parseWorkbook(
  workbook: XLSX.WorkBook,
  fileName: string,
  xlsx: XlsxModule,
  diagnosticWarnings: PcrWarning[] = []
): ParseExcelResult {
  const sourceInstanceId = createImportedSourceInstanceId("excel");
  const boundDiagnostics = diagnosticWarnings.map((warning) => bindWarningToSource(warning, fileName, sourceInstanceId));
  const ignoredSheetWarnings = [
    ...boundDiagnostics,
    ...createIgnoredSheetsWarnings(workbook, fileName, sourceInstanceId)
  ];
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    return invalidFirstSheet(fileName, "", ignoredSheetWarnings, "Workbook has no worksheets.");
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const ref = worksheet?.["!ref"];

  if (!worksheet || !ref) {
    return invalidFirstSheet(fileName, firstSheetName, ignoredSheetWarnings, "First worksheet is empty.");
  }

  let range: XLSX.Range;
  try {
    range = xlsx.utils.decode_range(ref);
  } catch {
    return invalidFirstSheet(fileName, firstSheetName, ignoredSheetWarnings, "First worksheet has an invalid range.");
  }

  if (range.e.r < 2) {
    return invalidFirstSheet(fileName, firstSheetName, ignoredSheetWarnings, "First worksheet must contain two header rows and fluorescence data.");
  }

  const candidateColumns = findCandidateColumns(worksheet, range, xlsx);
  if (candidateColumns.length === 0) {
    return invalidFirstSheet(fileName, firstSheetName, ignoredSheetWarnings, "First worksheet has no usable PCR data columns.");
  }

  const lastDataRow = findLastDataRow(worksheet, range, candidateColumns, xlsx);
  if (lastDataRow < 2) {
    return invalidFirstSheet(fileName, firstSheetName, ignoredSheetWarnings, "First worksheet has no fluorescence rows.");
  }

  const curves: Curve[] = candidateColumns.map((columnIndex) =>
    createCurveFromColumn({
      worksheet,
      fileName,
      sheetName: firstSheetName,
      columnIndex,
      lastDataRow,
      sourceInstanceId,
      xlsx
    })
  );
  const importWarnings = [
    ...ignoredSheetWarnings,
    ...createMergedHeaderWarnings(worksheet, firstSheetName, candidateColumns, curves, xlsx)
  ];
  const curveWarnings = curves.flatMap((curve) => curve.warnings);

  return {
    ok: true,
    dataset: createPcrDatasetFromCurves({
      curves,
      fileName,
      sheetName: firstSheetName,
      cycleCount: lastDataRow - 1,
      sourceKind: "excel",
      sourceInstanceId,
      warnings: [...importWarnings, ...curveWarnings]
    })
  };
}

export function isSupportedExcelFileName(fileName: string) {
  return /\.(xlsx|xls)$/iu.test(fileName);
}

function loadXlsx() {
  xlsxModulePromise ??= import("xlsx");
  return xlsxModulePromise;
}

function createCurveFromColumn(args: {
  worksheet: XLSX.WorkSheet;
  fileName: string;
  sheetName: string;
  columnIndex: number;
  lastDataRow: number;
  sourceInstanceId: string;
  xlsx: XlsxModule;
}): Curve {
  const { worksheet, fileName, sheetName, columnIndex, lastDataRow, sourceInstanceId, xlsx } = args;
  const columnLetter = xlsx.utils.encode_col(columnIndex);
  const curveId = `sheet0_col_${columnLetter}`;
  const specimenCell = `${columnLetter}1`;
  const reagentCell = `${columnLetter}2`;
  const specimenHeader = getHeaderIdentity(worksheet, 0, columnIndex, fileName, sheetName, xlsx);
  const reagentHeader = getHeaderIdentity(worksheet, 1, columnIndex, fileName, sheetName, xlsx);
  const specimenLabel = specimenHeader.label;
  const reagentLabel = reagentHeader.label;
  const warnings: PcrWarning[] = [...specimenHeader.warnings, ...reagentHeader.warnings].map((warning) => ({
    ...warning,
    curveIds: [curveId]
  }));

  if (!specimenLabel.trim()) {
    warnings.push(
      createWarning({
        code: "MISSING_SPECIMEN_LABEL",
        severity: "warning",
        scope: "header",
        message: "Specimen header is empty.",
        curveIds: [curveId],
        sourceCell: specimenCell,
        sheetName,
        columnLetter,
        rawValue: specimenHeader.provenance.rawValue
      })
    );
  }

  if (!reagentLabel.trim()) {
    warnings.push(
      createWarning({
        code: "MISSING_REAGENT_LABEL",
        severity: "warning",
        scope: "header",
        message: "Reagent header is empty.",
        curveIds: [curveId],
        sourceCell: reagentCell,
        sheetName,
        columnLetter,
        rawValue: reagentHeader.provenance.rawValue
      })
    );
  }

  const y: Array<number | null> = [];
  const x: number[] = [];

  for (let rowIndex = 2; rowIndex <= lastDataRow; rowIndex += 1) {
    const cycle = rowIndex - 1;
    const cellAddress = xlsx.utils.encode_cell({ r: rowIndex, c: columnIndex });
    const cell = worksheet[cellAddress];
    const result = parseFluorescenceCell(cell, cellAddress, curveId, columnLetter, fileName, sheetName, xlsx);

    x.push(cycle);
    y.push(result.value);
    if (result.warning) warnings.push(result.warning);
  }

  return {
    curveId,
    sourceId: `${fileName}#${sheetName}!${columnLetter}`,
    specimenId: createEntityId("specimen", specimenLabel, `missing_${curveId}`),
    reagentId: createEntityId("reagent", reagentLabel, `missing_${curveId}`),
    specimenLabel,
    reagentLabel,
    displayLabel: formatCurveEntityPair(
      specimenLabel.trim() ? specimenLabel : `Empty specimen ${specimenCell}`,
      reagentLabel.trim() ? reagentLabel : `Empty reagent ${reagentCell}`
    ),
    x,
    y,
    source: {
      sourceKind: "excel",
      sourceInstanceId,
      fileName,
      sheetName,
      sheetIndex: 0,
      columnIndex,
      columnLetter,
      specimenCell,
      reagentCell,
      dataStartCell: `${columnLetter}3`,
      dataEndCell: `${columnLetter}${lastDataRow + 1}`,
      specimenHeader: specimenHeader.provenance,
      reagentHeader: reagentHeader.provenance
    },
    stats: createStats(y),
    warnings
  };
}

function parseFluorescenceCell(
  cell: XLSX.CellObject | undefined,
  sourceCell: string,
  curveId: string,
  columnLetter: string,
  fileName: string,
  sheetName: string,
  xlsx: XlsxModule
): { value: number | null; warning?: PcrWarning } {
  if (!cell || isBlankCell(cell)) {
    return {
      value: null,
      warning: createWarning({
        code: "EMPTY_FLUORESCENCE_CELL",
        severity: "warning",
        scope: "cell",
        message: "Fluorescence cell is empty.",
        curveIds: [curveId],
        sourceCell,
        sheetName,
        columnLetter
      })
    };
  }

  if (cell.f && !isFiniteNumber(cell.v)) {
    return {
      value: null,
      warning: createWarning({
        code: "FORMULA_WITHOUT_CACHED_VALUE",
        severity: "warning",
        scope: "cell",
        message: "Formula cell has no finite cached numeric value and was not recalculated.",
        curveIds: [curveId],
        sourceCell,
        sheetName,
        columnLetter,
        rawValue: cell.f,
        sourceRefs: [createCellSourceRef(cell, sourceCell, fileName, sheetName, columnLetter, xlsx, "missing")]
      })
    };
  }

  if (isFiniteNumber(cell.v)) {
    if (cell.f) {
      return {
        value: cell.v,
        warning: createWarning({
          code: "FORMULA_CACHED_VALUE_USED",
          severity: "info",
          scope: "cell",
          message: "Formula cell used its cached numeric value without recalculation.",
          curveIds: [curveId],
          sourceCell,
          sheetName,
          columnLetter,
          rawValue: cell.v,
          sourceRefs: [createCellSourceRef(cell, sourceCell, fileName, sheetName, columnLetter, xlsx, "used")]
        })
      };
    }
    return { value: cell.v };
  }

  return {
    value: null,
    warning: createWarning({
      code: "NON_NUMERIC_FLUORESCENCE",
      severity: "warning",
      scope: "cell",
      message: "Fluorescence cell is not numeric.",
      curveIds: [curveId],
      sourceCell,
      sheetName,
      columnLetter,
      rawValue: cell.v,
      sourceRefs: [createCellSourceRef(cell, sourceCell, fileName, sheetName, columnLetter, xlsx, "not-formula")]
    })
  };
}

function findCandidateColumns(worksheet: XLSX.WorkSheet, range: XLSX.Range, xlsx: XlsxModule) {
  const columns: number[] = [];

  for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
    const hasHeader = !isBlankCell(worksheet[xlsx.utils.encode_cell({ r: 0, c: columnIndex })])
      || !isBlankCell(worksheet[xlsx.utils.encode_cell({ r: 1, c: columnIndex })]);
    let hasData = false;
    for (let rowIndex = 2; rowIndex <= range.e.r; rowIndex += 1) {
      const cell = worksheet[xlsx.utils.encode_cell({ r: rowIndex, c: columnIndex })];
      if (cell && !isBlankCell(cell)) {
        hasData = true;
        break;
      }
    }

    if (hasHeader || hasData) {
      columns.push(columnIndex);
    }
  }

  return columns;
}

function findLastDataRow(
  worksheet: XLSX.WorkSheet,
  range: XLSX.Range,
  candidateColumns: number[],
  xlsx: XlsxModule
) {
  for (let rowIndex = range.e.r; rowIndex >= 2; rowIndex -= 1) {
    const hasAnyData = candidateColumns.some((columnIndex) => {
      const cell = worksheet[xlsx.utils.encode_cell({ r: rowIndex, c: columnIndex })];
      return Boolean(cell && !isBlankCell(cell));
    });

    if (hasAnyData) {
      return rowIndex;
    }
  }

  return -1;
}

function getHeaderIdentity(
  worksheet: XLSX.WorkSheet,
  rowIndex: number,
  columnIndex: number,
  fileName: string,
  sheetName: string,
  xlsx: XlsxModule
) {
  const cellAddress = xlsx.utils.encode_cell({ r: rowIndex, c: columnIndex });
  const columnLetter = xlsx.utils.encode_col(columnIndex);
  const cell = worksheet[cellAddress];
  const displayValue = cell && !isBlankCell(cell) ? formatCellDisplayValue(cell, xlsx) : "";
  const formulaCacheStatus: FormulaCacheStatus = !cell?.f ? "not-formula" : isBlankCellValue(cell.v) ? "missing" : "used";
  const provenance: CellValueProvenance = {
    rawValue: toPortableCellValue(cell?.v),
    displayValue,
    cellType: cell?.t,
    numberFormat: typeof cell?.z === "string" ? cell.z : undefined,
    formulaText: cell?.f,
    formulaCacheStatus
  };
  const warnings: PcrWarning[] = [];

  if (cell?.f) {
    warnings.push(
      createWarning({
        code: formulaCacheStatus === "used" ? "FORMULA_CACHED_VALUE_USED" : "FORMULA_WITHOUT_CACHED_VALUE",
        severity: "warning",
        scope: "header",
        message:
          formulaCacheStatus === "used"
            ? "Header formula used its cached display value without recalculation."
            : "Header formula has no cached value and produced an empty display label.",
        sourceCell: cellAddress,
        sheetName,
        columnLetter,
        rawValue: cell.v,
        sourceRefs: [createCellSourceRef(cell, cellAddress, fileName, sheetName, columnLetter, xlsx, formulaCacheStatus)]
      })
    );
  }
  if (cell && !isBlankCell(cell) && displayValue === "") {
    warnings.push(
      createWarning({
        code: "FORMATTED_HEADER_EMPTY",
        severity: "warning",
        scope: "header",
        message: "Header has a raw value but its Excel display text is empty.",
        sourceCell: cellAddress,
        sheetName,
        columnLetter,
        rawValue: cell.v,
        sourceRefs: [createCellSourceRef(cell, cellAddress, fileName, sheetName, columnLetter, xlsx, formulaCacheStatus)]
      })
    );
  }

  return { label: displayValue, provenance, warnings };
}

function isBlankCell(cell: XLSX.CellObject | undefined) {
  if (!cell) return true;
  if (cell.f) return false;
  if (cell.t === "z") return true;
  return cell.v === undefined || cell.v === null || cell.v === "";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function createIgnoredSheetsWarnings(workbook: XLSX.WorkBook, fileName: string, sourceInstanceId: string): PcrWarning[] {
  if (workbook.SheetNames.length <= 1) return [];

  return [
    createWarning({
      code: "IGNORED_WORKSHEETS",
      severity: "info",
      scope: "import",
      message: "Only the first worksheet was imported; later worksheets were ignored.",
      labels: workbook.SheetNames.slice(1),
      sourceRefs: [
        {
          sourceInstanceId,
          sourceName: fileName,
          sourceKind: "excel"
        }
      ]
    })
  ];
}

function createMergedHeaderWarnings(
  worksheet: XLSX.WorkSheet,
  sheetName: string,
  candidateColumns: number[],
  curves: Curve[],
  xlsx: XlsxModule
): PcrWarning[] {
  return (worksheet["!merges"] ?? [])
    .filter((merge) => merge.s.r <= 1 && merge.e.r >= 0)
    .map((merge) => {
      const curveIds = candidateColumns
        .map((columnIndex, index) => ({ columnIndex, curveId: curves[index]?.curveId }))
        .filter(({ columnIndex, curveId }) => Boolean(curveId) && columnIndex >= merge.s.c && columnIndex <= merge.e.c)
        .map(({ curveId }) => curveId as string);
      return (
      createWarning({
        code: "MERGED_HEADER_CELL",
        severity: "warning",
        scope: "header",
        message: "Merged header cells are not expanded or auto-filled.",
        curveIds,
        sheetName,
        sourceRange: xlsx.utils.encode_range(merge)
      })
      );
    });
}

function formatCellDisplayValue(cell: XLSX.CellObject, xlsx: XlsxModule) {
  try {
    const cellWithoutCachedText = { ...cell };
    delete cellWithoutCachedText.w;
    return xlsx.utils.format_cell(cellWithoutCachedText);
  } catch {
    return String(cell.v ?? "");
  }
}

function createCellSourceRef(
  cell: XLSX.CellObject,
  cellAddress: string,
  fileName: string,
  sheetName: string,
  columnLetter: string,
  xlsx: XlsxModule,
  formulaCacheStatus: FormulaCacheStatus
): WarningSourceRef {
  return {
    sourceName: fileName,
    sourceKind: "excel",
    worksheet: sheetName,
    cell: cellAddress,
    columnLetter,
    rawValue: toPortableCellValue(cell.v),
    displayValue: formatCellDisplayValue(cell, xlsx),
    cellType: cell.t,
    numberFormat: typeof cell.z === "string" ? cell.z : undefined,
    formulaText: cell.f,
    formulaCacheStatus
  };
}

function toPortableCellValue(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return value === undefined ? undefined : String(value);
}

function isBlankCellValue(value: unknown) {
  return value === undefined || value === null || value === "";
}

function createFileSignatureWarnings(buffer: ArrayBuffer | Uint8Array, fileName: string): PcrWarning[] {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const detected = detectWorkbookSignature(bytes);
  const expected = /\.xlsx$/iu.test(fileName) ? "ooxml" : "biff";
  if (detected === expected || detected === "unknown") return [];
  return [
    createWarning({
      code: "FILE_SIGNATURE_MISMATCH",
      severity: "warning",
      scope: "import",
      message: `File extension suggests ${expected.toUpperCase()}, but the content signature appears to be ${detected.toUpperCase()}. Import policy was not changed.`,
      rawValue: detected,
      handling: "kept",
      sourceRefs: [{ sourceName: fileName, sourceKind: "excel", rawValue: detected }]
    })
  ];
}

function bindWarningToSource(warning: PcrWarning, fileName: string, sourceInstanceId: string): PcrWarning {
  const sourceRefs = warning.sourceRefs?.length
    ? warning.sourceRefs.map((sourceRef) => ({ ...sourceRef, sourceInstanceId, sourceName: fileName, sourceKind: "excel" as const }))
    : [{ sourceInstanceId, sourceName: fileName, sourceKind: "excel" as const }];
  return { ...warning, sourceRefs };
}

function detectWorkbookSignature(bytes: Uint8Array) {
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) return "ooxml";
  const cfb = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  if (bytes.length >= cfb.length && cfb.every((value, index) => bytes[index] === value)) return "biff";
  const prefix = new TextDecoder().decode(bytes.slice(0, 256)).trimStart().toLocaleLowerCase();
  if (prefix.startsWith("<html") || prefix.startsWith("<!doctype html") || prefix.startsWith("<table")) return "html";
  return "unknown";
}

function invalidFirstSheet(
  fileName: string,
  sheetName: string,
  priorWarnings: PcrWarning[],
  message: string
): ParseFailure {
  const error = createWarning({
    code: "FIRST_SHEET_INVALID",
    severity: "error",
    scope: "import",
    message,
    sheetName,
    rawValue: fileName
  });

  return {
    ok: false,
    error,
    warnings: [...priorWarnings, error]
  };
}

function createWarning(warning: PcrWarning): PcrWarning {
  return warning;
}
