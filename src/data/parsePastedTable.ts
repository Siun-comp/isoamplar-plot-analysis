import { formatCurveEntityPair } from "./curveLabels";
import { createEntityId, createPcrDatasetFromCurves, createStats } from "./normalizePcrData";
import { resolveSpecimenHeaders, type ResolvedSpecimenHeader } from "./resolveSpecimenHeaders";
import type { Curve, PasteInputMode, PcrDataset, PcrWarning } from "./types";

export type PasteDelimiter = "tab" | "singleColumn";

export type ParsePastedTableOptions = {
  mode: PasteInputMode;
  sourceName: string;
  specimenLabel?: string;
  sourceInstanceId?: string;
  importedAtIso?: string;
};

export type ParsePastedTableSuccess = {
  ok: true;
  dataset: PcrDataset;
  delimiter: PasteDelimiter;
  summary: PasteTableSummary;
};

export type ParsePastedTableFailure = {
  ok: false;
  errorKind: "validation" | "unexpected";
  error: PcrWarning;
  warnings: PcrWarning[];
};

export type PasteTableSummary = {
  rowCount: number;
  columnCount: number;
  cellCount: number;
  curveCount: number;
  cycleCount: number;
  sourceCharacterCount: number;
  estimatedWorkingMemoryBytes: number;
};

export type ParsePastedTableResult = ParsePastedTableSuccess | ParsePastedTableFailure;

export const QUICK_PASTE_MAX_CHARACTERS = 2_000_000;
export const QUICK_PASTE_MAX_CELLS = 250_000;
export const QUICK_PASTE_LARGE_CELL_WARNING = 10_000;

const decimalNumberPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u;

export function parsePastedTable(text: string, options: ParsePastedTableOptions): ParsePastedTableResult {
  try {
    return parsePastedTableUnsafe(text, options);
  } catch {
    return invalidPaste(
      "붙여넣기 데이터를 처리하는 중 예기치 않은 오류가 발생했습니다. 현재 분석은 변경되지 않았습니다. 입력을 확인한 뒤 다시 시도하십시오.",
      "unexpected"
    );
  }
}

function parsePastedTableUnsafe(text: string, options: ParsePastedTableOptions): ParsePastedTableResult {
  if (text.length > QUICK_PASTE_MAX_CHARACTERS) {
    return invalidPaste("붙여넣은 데이터가 브라우저 안전 한도를 초과했습니다. 대량 데이터는 Excel 파일로 가져오십시오.");
  }

  const sourceName = options.sourceName.trim() || "Paste import";
  const sourceInstanceId = options.sourceInstanceId ?? createPasteSourceInstanceId();
  const normalizedText = text.replace(/\r\n?/gu, "\n");
  const lines = normalizedText.split("\n");

  while (lines.length > 0 && lines.at(-1)?.trim() === "") {
    lines.pop();
  }

  if (lines.length === 0 || lines.every((line) => line.trim() === "")) {
    return invalidPaste("붙여넣은 데이터가 비어 있습니다.");
  }

  const delimiterResult = detectDelimiter(lines, normalizedText);
  if (!delimiterResult.ok) return delimiterResult;

  const rows = splitRows(lines, delimiterResult.delimiter);
  const requiredRowCount = options.mode === "fullTable" ? 3 : 2;
  if (rows.length < requiredRowCount) {
    return invalidPaste(
      options.mode === "fullTable"
        ? "전체 표는 검체, 시약, fluorescence를 포함해 3행 이상이어야 합니다."
        : "단일 검체 표는 시약과 fluorescence를 포함해 2행 이상이어야 합니다."
    );
  }

  const specimenLabel = options.specimenLabel ?? "";
  if (options.mode === "singleSpecimen" && !specimenLabel.trim()) {
    return invalidPaste("단일 검체 모드에서는 검체명을 입력해야 합니다.");
  }

  const columnCount = rows.reduce((max, row) => (row.length > max ? row.length : max), 0);
  if (columnCount === 0) {
    return invalidPaste("붙여넣은 표에서 데이터 열을 찾을 수 없습니다.");
  }

  if (columnCount > Math.floor(QUICK_PASTE_MAX_CELLS / rows.length)) {
    return invalidPaste("붙여넣은 표의 cell 수가 브라우저 안전 한도를 초과했습니다. 대량 데이터는 Excel 파일로 가져오십시오.");
  }

  const normalizedRows = rows.map((row) => normalizeRow(row, columnCount));
  const fullTableRows =
    options.mode === "singleSpecimen"
      ? [Array.from({ length: columnCount }, () => specimenLabel)].concat(normalizedRows)
      : normalizedRows;
  const candidateColumns = findCandidateColumns(fullTableRows, columnCount);

  if (candidateColumns.length === 0) {
    return invalidPaste("붙여넣은 표에 사용할 수 있는 curve 열이 없습니다.");
  }

  const lastDataRow = findLastDataRow(fullTableRows, candidateColumns);
  if (lastDataRow < 2) {
    return invalidPaste("붙여넣은 표에 fluorescence 데이터 행이 없습니다.");
  }

  const resolvedSpecimens = resolveSpecimenHeaders(
    candidateColumns.map((columnIndex) => {
      const label = fullTableRows[0]?.[columnIndex] ?? "";
      return { columnIndex, label, canInherit: !label.trim() };
    })
  );
  if (!resolvedSpecimens.ok) {
    const columnLetter = encodeColumnLetter(resolvedSpecimens.missingColumnIndex);
    return invalidPaste(`첫 번째 유효 곡선 열(${columnLetter}1)에 검체명을 입력해야 합니다.`);
  }
  const resolvedSpecimenByColumn = new Map(resolvedSpecimens.headers.map((header) => [header.columnIndex, header]));

  const curves = candidateColumns.map((columnIndex) =>
    createCurveFromColumn({
      rows: fullTableRows,
      sourceName,
      sourceInstanceId,
      inputMode: options.mode,
      columnIndex,
      specimenLabel: resolvedSpecimenByColumn.get(columnIndex)!.label,
      lastDataRow
    })
  );
  const inheritanceWarnings = createSpecimenInheritanceWarnings(
    resolvedSpecimens.headers,
    curves,
    sourceName,
    sourceInstanceId
  );
  const curveWarnings = curves.flatMap((curve) => curve.warnings);
  const warningCount = curveWarnings.length + inheritanceWarnings.length;

  return {
    ok: true,
    delimiter: delimiterResult.delimiter,
    dataset: createPcrDatasetFromCurves({
      curves,
      fileName: sourceName,
      sheetName: "Paste",
      cycleCount: lastDataRow - 1,
      sourceKind: "paste",
      importedAtIso: options.importedAtIso,
      warnings: [...inheritanceWarnings, ...curveWarnings]
    }),
    summary: createPasteTableSummary({
      text,
      rowCount: rows.length,
      columnCount,
      curveCount: curves.length,
      cycleCount: lastDataRow - 1,
      warningCount
    })
  };
}

function createPasteTableSummary(args: {
  text: string;
  rowCount: number;
  columnCount: number;
  curveCount: number;
  cycleCount: number;
  warningCount: number;
}): PasteTableSummary {
  const cellCount = args.rowCount * args.columnCount;
  const pointCount = args.curveCount * args.cycleCount;
  return {
    rowCount: args.rowCount,
    columnCount: args.columnCount,
    cellCount,
    curveCount: args.curveCount,
    cycleCount: args.cycleCount,
    sourceCharacterCount: args.text.length,
    estimatedWorkingMemoryBytes:
      args.text.length * 6 + cellCount * 48 + pointCount * 24 + args.curveCount * 1024 + args.warningCount * 768
  };
}

export function renamePastedDatasetSource(dataset: PcrDataset, sourceName: string): PcrDataset {
  const nextSourceName = sourceName.trim() || "Paste import";
  if (dataset.sourceFileName === nextSourceName) return dataset;

  const curves = dataset.curves.map((curve) => ({
    ...curve,
    source: {
      ...curve.source,
      fileName: nextSourceName
    }
  }));

  return {
    ...dataset,
    datasetId: `dataset:${nextSourceName}:${dataset.sheetName}:${curves.length}`,
    sourceFileName: nextSourceName,
    curves: curves.map((curve) => ({
      ...curve,
      warnings: renameWarningSources(curve.warnings, nextSourceName)
    })),
    warnings: renameWarningSources(dataset.warnings, nextSourceName)
  };
}

function renameWarningSources(warnings: PcrWarning[], sourceName: string) {
  return warnings.map((warning) => ({
    ...warning,
    sourceRefs: warning.sourceRefs?.map((sourceRef) => ({ ...sourceRef, sourceName }))
  }));
}

export function isLargePastedDataset(dataset: PcrDataset) {
  return dataset.curves.length * dataset.cycleCount > QUICK_PASTE_LARGE_CELL_WARNING;
}

function detectDelimiter(
  lines: string[],
  text: string
): { ok: true; delimiter: PasteDelimiter } | ParsePastedTableFailure {
  if (text.includes("\t")) return { ok: true, delimiter: "tab" };

  if (text.includes(",")) {
    return invalidPaste("Comma 구분 표는 자동 해석하지 않습니다. Excel 범위를 복사해 Tab 구분 형식으로 다시 붙여넣으십시오.");
  }

  return { ok: true, delimiter: "singleColumn" };
}

function splitRows(lines: string[], delimiter: PasteDelimiter) {
  if (delimiter === "tab") return lines.map((line) => line.split("\t"));
  return lines.map((line) => [line]);
}

function normalizeRow(row: string[], columnCount: number) {
  return Array.from({ length: columnCount }, (_, columnIndex) => row[columnIndex] ?? "");
}

function findCandidateColumns(rows: string[][], columnCount: number) {
  return Array.from({ length: columnCount }, (_, columnIndex) => columnIndex).filter((columnIndex) =>
    rows.some((row) => !isBlankText(row[columnIndex]))
  );
}

function findLastDataRow(rows: string[][], candidateColumns: number[]) {
  for (let rowIndex = rows.length - 1; rowIndex >= 2; rowIndex -= 1) {
    if (candidateColumns.some((columnIndex) => !isBlankText(rows[rowIndex]?.[columnIndex]))) {
      return rowIndex;
    }
  }
  return -1;
}

function createCurveFromColumn(args: {
  rows: string[][];
  sourceName: string;
  sourceInstanceId: string;
  inputMode: PasteInputMode;
  columnIndex: number;
  specimenLabel: string;
  lastDataRow: number;
}): Curve {
  const { rows, sourceName, sourceInstanceId, inputMode, columnIndex, specimenLabel, lastDataRow } = args;
  const columnLetter = encodeColumnLetter(columnIndex);
  const curveId = `paste0_col_${columnLetter}`;
  const specimenCell = inputMode === "singleSpecimen" ? "Specimen name field" : `${columnLetter}1`;
  const reagentCell = inputMode === "singleSpecimen" ? `${columnLetter}1` : `${columnLetter}2`;
  const reagentLabel = rows[1]?.[columnIndex] ?? "";
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

  const x: number[] = [];
  const y: Array<number | null> = [];
  for (let rowIndex = 2; rowIndex <= lastDataRow; rowIndex += 1) {
    const physicalRowNumber = inputMode === "singleSpecimen" ? rowIndex : rowIndex + 1;
    const sourceCell = `${columnLetter}${physicalRowNumber}`;
    const parsed = parseFluorescenceText(rows[rowIndex]?.[columnIndex] ?? "", sourceCell, curveId, columnLetter);
    x.push(rowIndex - 1);
    y.push(parsed.value);
    if (parsed.warning) warnings.push(parsed.warning);
  }

  return {
    curveId,
    sourceId: `${sourceInstanceId}!${columnLetter}`,
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
      sourceKind: "paste",
      sourceInstanceId,
      inputMode,
      fileName: sourceName,
      sheetName: "Paste",
      sheetIndex: 0,
      columnIndex,
      columnLetter,
      specimenCell,
      reagentCell,
      dataStartCell: `${columnLetter}${inputMode === "singleSpecimen" ? 2 : 3}`,
      dataEndCell: `${columnLetter}${inputMode === "singleSpecimen" ? lastDataRow : lastDataRow + 1}`
    },
    stats: createStats(y),
    warnings
  };
}

function createSpecimenInheritanceWarnings(
  resolvedHeaders: ResolvedSpecimenHeader[],
  curves: Curve[],
  sourceName: string,
  sourceInstanceId: string
): PcrWarning[] {
  const curveByColumn = new Map(curves.map((curve) => [curve.source.columnIndex, curve]));
  const headerByColumn = new Map(resolvedHeaders.map((header) => [header.columnIndex, header]));
  const groups = new Map<number, ResolvedSpecimenHeader[]>();
  for (const header of resolvedHeaders) {
    if (header.inheritedFromColumnIndex === undefined) continue;
    const group = groups.get(header.inheritedFromColumnIndex) ?? [];
    group.push(header);
    groups.set(header.inheritedFromColumnIndex, group);
  }

  return [...groups.entries()].map(([sourceColumnIndex, headers]) => {
    const sourceHeader = headerByColumn.get(sourceColumnIndex)!;
    const sourceCell = `${encodeColumnLetter(sourceColumnIndex)}1`;
    const sourceCurve = curveByColumn.get(sourceColumnIndex)!;
    const inheritedCurves = headers.map((header) => curveByColumn.get(header.columnIndex)!).filter(Boolean);
    return createWarning({
      code: "INHERITED_SPECIMEN_LABEL",
      severity: "info",
      scope: "header",
      message: `${headers.length} blank specimen header(s) inherited "${sourceHeader.label}" from ${sourceCell}.`,
      curveIds: inheritedCurves.map((curve) => curve.curveId),
      labels: [sourceHeader.label],
      handling: "kept",
      sourceRefs: [sourceCurve, ...inheritedCurves].map((curve) => ({
        sourceInstanceId,
        sourceName,
        sourceKind: "paste",
        worksheet: "Paste",
        cell: curve.source.specimenCell,
        columnLetter: curve.source.columnLetter,
        rawValue: curve === sourceCurve ? sourceHeader.label : "",
        displayValue: curve === sourceCurve ? sourceHeader.label : ""
      }))
    });
  });
}

function parseFluorescenceText(
  rawValue: string,
  sourceCell: string,
  curveId: string,
  columnLetter: string
): { value: number | null; warning?: PcrWarning } {
  const trimmedValue = rawValue.trim();
  if (!trimmedValue) {
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

  if (decimalNumberPattern.test(trimmedValue)) {
    const numericValue = Number(trimmedValue);
    if (Number.isFinite(numericValue)) return { value: numericValue };
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
      rawValue
    })
  };
}

function encodeColumnLetter(columnIndex: number) {
  let value = columnIndex + 1;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function createPasteSourceInstanceId() {
  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `paste-${randomPart}`;
}

function isBlankText(value: string | undefined) {
  return value === undefined || value.trim() === "";
}

function invalidPaste(message: string, errorKind: ParsePastedTableFailure["errorKind"] = "validation"): ParsePastedTableFailure {
  const error = createWarning({
    code: "INVALID_PASTED_TABLE",
    severity: "error",
    scope: "import",
    message
  });
  return { ok: false, errorKind, error, warnings: [error] };
}

function createWarning(warning: PcrWarning): PcrWarning {
  return warning;
}
