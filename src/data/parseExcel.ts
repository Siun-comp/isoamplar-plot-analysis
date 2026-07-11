import type * as XLSX from "xlsx";
import { formatCurveEntityPair } from "./curveLabels";
import { createEntityId, createPcrDatasetFromCurves, createStats } from "./normalizePcrData";
import type { Curve, PcrDataset, PcrWarning } from "./types";

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

  try {
    const xlsx = await loadXlsx();
    const workbook = xlsx.read(buffer, {
      type: "array",
      cellDates: true,
      cellFormula: true,
      raw: true
    });
    return parseWorkbook(workbook, fileName, xlsx);
  } catch (cause) {
    const error = createWarning({
      code: "PROTECTED_OR_UNREADABLE_WORKBOOK",
      severity: "error",
      scope: "import",
      message: "Workbook could not be read by the browser parser.",
      rawValue: cause instanceof Error ? cause.message : String(cause)
    });
    return { ok: false, error, warnings: [error] };
  }
}

export function parseWorkbook(workbook: XLSX.WorkBook, fileName: string, xlsx: XlsxModule): ParseExcelResult {
  const ignoredSheetWarnings = createIgnoredSheetsWarnings(workbook);
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

  const importWarnings = [
    ...ignoredSheetWarnings,
    ...createMergedHeaderWarnings(worksheet, firstSheetName, xlsx)
  ];
  const curves: Curve[] = candidateColumns.map((columnIndex) =>
    createCurveFromColumn({
      worksheet,
      fileName,
      sheetName: firstSheetName,
      columnIndex,
      lastDataRow,
      xlsx
    })
  );
  const curveWarnings = curves.flatMap((curve) => curve.warnings);

  return {
    ok: true,
    dataset: createPcrDatasetFromCurves({
      curves,
      fileName,
      sheetName: firstSheetName,
      cycleCount: lastDataRow - 1,
      sourceKind: "excel",
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
  xlsx: XlsxModule;
}): Curve {
  const { worksheet, fileName, sheetName, columnIndex, lastDataRow, xlsx } = args;
  const columnLetter = xlsx.utils.encode_col(columnIndex);
  const curveId = `sheet0_col_${columnLetter}`;
  const specimenCell = `${columnLetter}1`;
  const reagentCell = `${columnLetter}2`;
  const specimenLabel = getHeaderLabel(worksheet, 0, columnIndex, xlsx);
  const reagentLabel = getHeaderLabel(worksheet, 1, columnIndex, xlsx);
  const warnings: PcrWarning[] = [];

  if (!specimenLabel.trim()) {
    warnings.push(
      createWarning({
        code: "MISSING_SPECIMEN_LABEL",
        severity: "warning",
        scope: "header",
        message: "Specimen header is empty.",
        curveIds: [curveId],
        sourceCell: specimenCell,
        columnLetter
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
        columnLetter
      })
    );
  }

  const y: Array<number | null> = [];
  const x: number[] = [];

  for (let rowIndex = 2; rowIndex <= lastDataRow; rowIndex += 1) {
    const cycle = rowIndex - 1;
    const cellAddress = xlsx.utils.encode_cell({ r: rowIndex, c: columnIndex });
    const cell = worksheet[cellAddress];
    const result = parseFluorescenceCell(cell, cellAddress, curveId, columnLetter);

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
      fileName,
      sheetName,
      sheetIndex: 0,
      columnIndex,
      columnLetter,
      specimenCell,
      reagentCell,
      dataStartCell: `${columnLetter}3`,
      dataEndCell: `${columnLetter}${lastDataRow + 1}`
    },
    stats: createStats(y),
    warnings
  };
}

function parseFluorescenceCell(
  cell: XLSX.CellObject | undefined,
  sourceCell: string,
  curveId: string,
  columnLetter: string
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
        columnLetter,
        rawValue: cell.f
      })
    };
  }

  if (isFiniteNumber(cell.v)) {
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
      columnLetter,
      rawValue: cell.v
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

function getHeaderLabel(worksheet: XLSX.WorkSheet, rowIndex: number, columnIndex: number, xlsx: XlsxModule) {
  const cell = worksheet[xlsx.utils.encode_cell({ r: rowIndex, c: columnIndex })];
  if (!cell || isBlankCell(cell)) return "";
  return String(cell.v ?? "");
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

function createIgnoredSheetsWarnings(workbook: XLSX.WorkBook): PcrWarning[] {
  if (workbook.SheetNames.length <= 1) return [];

  return [
    createWarning({
      code: "IGNORED_WORKSHEETS",
      severity: "info",
      scope: "import",
      message: "Only the first worksheet was imported; later worksheets were ignored.",
      labels: workbook.SheetNames.slice(1)
    })
  ];
}

function createMergedHeaderWarnings(worksheet: XLSX.WorkSheet, sheetName: string, xlsx: XlsxModule): PcrWarning[] {
  return (worksheet["!merges"] ?? [])
    .filter((merge) => merge.s.r <= 1 && merge.e.r >= 0)
    .map((merge) =>
      createWarning({
        code: "MERGED_HEADER_CELL",
        severity: "warning",
        scope: "header",
        message: "Merged header cells are not expanded or auto-filled.",
        sheetName,
        sourceRange: xlsx.utils.encode_range(merge)
      })
    );
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
