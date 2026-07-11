import type * as XLSX from "xlsx";
import {
  ANALYSIS_STATE_SCHEMA_VERSION,
  deserializeAnalysisState,
  serializeAnalysisState,
  type AnalysisState,
  type SerializedAnalysisState
} from "./analysisState";
import type { Curve, PcrWarning } from "../data/types";
import { createFileNameStem, sanitizeFileNamePart } from "../chart/exportFilenames";

type XlsxModule = typeof import("xlsx");

export const ANALYSIS_RESTORE_SHEET_NAME = "_IsoAmplarAnalysis";
export const ANALYSIS_RESTORE_MARKER = "IsoAmplarAnalysis";
const READ_ME_SHEET_NAME = "README";
const SETTINGS_SHEET_NAME = "Settings";
const HEADER_PROVENANCE_SHEET_NAME = "HeaderProvenance";
const IMPORTED_DATA_SHEET_NAME = "ImportedData";
const WARNINGS_SHEET_NAME = "Warnings";
const CHUNK_SIZE = 30000;

export type AnalysisWorkbookMetrics = {
  fileBytes: number | null;
  curveCount: number;
  pointCount: number;
  sourceCount: number;
  restoreChunkCount: number;
  joinedJsonCodeUnits: number;
  joinedJsonBytes: number;
  advisoryEstimatedWorkbookBytes: number;
};

export type AnalysisWorkbookReadResult =
  | { kind: "analysis"; analysis: AnalysisState; metrics: AnalysisWorkbookMetrics }
  | { kind: "not-analysis" }
  | { kind: "invalid-analysis"; message: string };

let xlsxModulePromise: Promise<XlsxModule> | null = null;

export async function exportAnalysisWorkbookBuffer(state: AnalysisState) {
  const result = await exportAnalysisWorkbookBufferWithMetrics(state);
  return result.buffer;
}

export async function exportAnalysisWorkbookBufferWithMetrics(state: AnalysisState) {
  const prepared = prepareAnalysisRestore(state);
  const xlsx = await loadXlsx();
  const workbook = xlsx.utils.book_new();

  appendSheet(xlsx, workbook, READ_ME_SHEET_NAME, createReadmeRows());
  appendSheet(xlsx, workbook, SETTINGS_SHEET_NAME, createSettingsRows(state, prepared.metrics));
  appendSheet(xlsx, workbook, HEADER_PROVENANCE_SHEET_NAME, createHeaderProvenanceRows(state.dataset.curves));
  appendSheet(xlsx, workbook, IMPORTED_DATA_SHEET_NAME, createImportedDataRows(state.dataset.curves, state.curveOverrides));
  appendSheet(xlsx, workbook, WARNINGS_SHEET_NAME, createWarningsRows(state.dataset.warnings));
  appendSheet(xlsx, workbook, ANALYSIS_RESTORE_SHEET_NAME, createRestoreRows(prepared));
  hideSheet(workbook, ANALYSIS_RESTORE_SHEET_NAME);

  const output = xlsx.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer | Uint8Array | number[];
  const buffer = toArrayBuffer(output);
  return {
    buffer,
    metrics: { ...prepared.metrics, fileBytes: buffer.byteLength }
  };
}

export async function exportAnalysisWorkbookBlob(state: AnalysisState) {
  const output = await exportAnalysisWorkbookBuffer(state);
  return new Blob([toArrayBuffer(output)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
}

export async function readAnalysisWorkbookFile(file: File): Promise<AnalysisWorkbookReadResult> {
  if (!/\.xlsx$/iu.test(file.name)) {
    return { kind: "not-analysis" };
  }

  try {
    const buffer = await file.arrayBuffer();
    return readAnalysisWorkbookBuffer(buffer);
  } catch (error) {
    return {
      kind: "invalid-analysis",
      message: error instanceof Error ? error.message : "Analysis XLSX could not be read."
    };
  }
}

export async function readAnalysisWorkbookBuffer(buffer: ArrayBuffer | Uint8Array): Promise<AnalysisWorkbookReadResult> {
  const xlsx = await loadXlsx();
  const workbook = xlsx.read(buffer, { type: "array", raw: true });
  const result = readAnalysisWorkbook(workbook, xlsx);
  return result.kind === "analysis"
    ? { ...result, metrics: { ...result.metrics, fileBytes: buffer.byteLength } }
    : result;
}

export function readAnalysisWorkbook(workbook: XLSX.WorkBook, xlsx: XlsxModule): AnalysisWorkbookReadResult {
  const restoreSheet = workbook.Sheets[ANALYSIS_RESTORE_SHEET_NAME];
  if (!restoreSheet) {
    return hasIsoAmplarAnalysisMarker(workbook)
      ? { kind: "invalid-analysis", message: "Analysis XLSX restore sheet is missing." }
      : { kind: "not-analysis" };
  }

  if (!hasRestoreSheetMarker(restoreSheet)) {
    return hasIsoAmplarAnalysisMarker(workbook)
      ? { kind: "invalid-analysis", message: "Analysis XLSX restore marker is invalid." }
      : { kind: "not-analysis" };
  }

  try {
    const { serialized, restoreMetrics } = readSerializedAnalysisState(restoreSheet, xlsx);
    const analysis = deserializeAnalysisState(serialized);
    return {
      kind: "analysis",
      analysis,
      metrics: createAnalysisWorkbookMetrics(analysis, restoreMetrics)
    };
  } catch (error) {
    return {
      kind: "invalid-analysis",
      message: error instanceof Error ? error.message : "Analysis XLSX restore data is invalid."
    };
  }
}

export function createAnalysisWorkbookFileName(analysisNumber: number, date = new Date(), analysisName?: string) {
  return `${createFileNameStem("analysis", analysisNumber, date, analysisName)}.xlsx`;
}

export const sanitizeAnalysisFileNamePart = sanitizeFileNamePart;

function appendSheet(xlsx: XlsxModule, workbook: XLSX.WorkBook, sheetName: string, rows: unknown[][]) {
  xlsx.utils.book_append_sheet(workbook, xlsx.utils.aoa_to_sheet(rows), sheetName);
}

function createReadmeRows() {
  return [
    ["IsoAmplar Plot Analysis restore file"],
    ["Purpose", "Open this file in IsoAmplar Plot Analysis to restore the full imported dataset and analysis settings."],
    ["Native editable Excel chart", "Not included"],
    ["Restore source", ANALYSIS_RESTORE_SHEET_NAME]
  ];
}

function createSettingsRows(state: AnalysisState, metrics: AnalysisWorkbookMetrics) {
  const selectedCount = state.selection.selectedCurveIds.size;
  const rows: unknown[][] = [
    ["Setting", "Value"],
    ["Analysis name", state.analysisName],
    ["Exported at", new Date().toISOString()],
    ["Schema version", ANALYSIS_STATE_SCHEMA_VERSION],
    ["Imported curve count", state.dataset.curves.length],
    ["Selected curve count", selectedCount],
    ["Fluorescence point count", metrics.pointCount],
    ["Source count", metrics.sourceCount],
    ["Restore JSON UTF-16 code units", metrics.joinedJsonCodeUnits],
    ["Restore JSON bytes", metrics.joinedJsonBytes],
    ["Restore chunk count", metrics.restoreChunkCount],
    ["Advisory estimated workbook bytes", metrics.advisoryEstimatedWorkbookBytes],
    ["Cycle generation rule", "Cycle 1..N"],
    ["Dataset source file", state.dataset.sourceFileName],
    ["Worksheet", state.dataset.sheetName],
    ["Export counter", state.exportCounter],
    ["Grouping mode", state.selection.groupingMode],
    ["X scale draft mode", state.chartScale.x.mode],
    ["X fixed min", state.chartScale.x.fixedMin],
    ["X fixed max", state.chartScale.x.fixedMax],
    ["X applied mode", state.chartScale.x.applied.mode],
    ["X applied min", state.chartScale.x.applied.min ?? ""],
    ["X applied max", state.chartScale.x.applied.max ?? ""],
    ["Y scale draft mode", state.chartScale.y.mode],
    ["Y fixed min", state.chartScale.y.fixedMin],
    ["Y fixed max", state.chartScale.y.fixedMax],
    ["Y applied mode", state.chartScale.y.applied.mode],
    ["Y applied min", state.chartScale.y.applied.min ?? ""],
    ["Y applied max", state.chartScale.y.applied.max ?? ""],
    [],
    [
      "Source type",
      "Source ID",
      "Source name",
      "Sheet",
      "Sheet index",
      "Imported at",
      "Curve count",
      "Cycle counts",
      "X-axis rule"
    ]
  ];
  for (const sourceFile of state.sourceFiles) {
    const cycleCounts = getSourceCycleCounts(state, sourceFile);
    rows.push([
      sourceFile.sourceKind ?? "excel",
      sourceFile.sourceInstanceId ?? "",
      sourceFile.fileName,
      sourceFile.sheetName,
      sourceFile.sheetIndex,
      sourceFile.importedAtIso,
      sourceFile.curveCount,
      cycleCounts.join(", "),
      "Cycle 1..N"
    ]);
  }
  return rows;
}

function createImportedDataRows(curves: Curve[], curveOverrides: AnalysisState["curveOverrides"]) {
  const maxPoints = curves.reduce((max, curve) => (curve.x.length > max ? curve.x.length : max), 0);
  const rows: unknown[][] = [
    ["Cycle"].concat(curves.map((curve) => curve.specimenLabel)),
    ["Reagent"].concat(curves.map((curve) => curve.reagentLabel)),
    ["Analysis label"].concat(curves.map((curve) => curveOverrides[curve.curveId]?.displayName ?? "")),
    ["Curve ID"].concat(curves.map((curve) => curve.curveId)),
    ["Source type"].concat(curves.map((curve) => curve.source.sourceKind ?? "excel")),
    ["Source name"].concat(curves.map((curve) => curve.source.fileName)),
    ["Source ID"].concat(curves.map((curve) => curve.source.sourceInstanceId ?? "")),
    ["Source column"].concat(curves.map((curve) => curve.source.columnLetter)),
    ["Paste input mode"].concat(curves.map((curve) => curve.source.inputMode ?? ""))
  ];
  for (let index = 0; index < maxPoints; index += 1) {
    const row: unknown[] = [curves[0]?.x[index] ?? index + 1];
    for (const curve of curves) row.push(curve.y[index] ?? "");
    rows.push(row);
  }
  return rows;
}

function createHeaderProvenanceRows(curves: Curve[]) {
  const rows: unknown[][] = [
    [
      "Curve ID",
      "Source ID",
      "Source name",
      "Worksheet",
      "Column",
      "Header role",
      "Cell",
      "Display value",
      "Raw value",
      "Cell type",
      "Number format",
      "Formula",
      "Formula cache"
    ]
  ];
  for (const curve of curves) {
    for (const [role, cell, provenance] of [
      ["Specimen", curve.source.specimenCell, curve.source.specimenHeader],
      ["Reagent", curve.source.reagentCell, curve.source.reagentHeader]
    ] as const) {
      rows.push([
        curve.curveId,
        curve.source.sourceInstanceId ?? "",
        curve.source.fileName,
        curve.source.sheetName,
        curve.source.columnLetter,
        role,
        cell,
        provenance?.displayValue ?? (role === "Specimen" ? curve.specimenLabel : curve.reagentLabel),
        provenance?.rawValue === undefined ? "" : JSON.stringify(provenance.rawValue),
        provenance?.cellType ?? "",
        provenance?.numberFormat ?? "",
        provenance?.formulaText ?? "",
        provenance?.formulaCacheStatus ?? ""
      ]);
    }
  }
  return rows;
}

function createWarningsRows(warnings: PcrWarning[]) {
  const rows: unknown[][] = [
    [
      "Code",
      "Severity",
      "Scope",
      "Handling",
      "Message",
      "Curve IDs",
      "Labels",
      "Source ID",
      "Source type",
      "Source name",
      "Worksheet",
      "Cell",
      "Range",
      "Column",
      "Raw value",
      "Display value",
      "Cell type",
      "Number format",
      "Formula",
      "Formula cache"
    ]
  ];
  for (const warning of warnings) {
    const sourceRefs = warning.sourceRefs?.length ? warning.sourceRefs : [undefined];
    for (const sourceRef of sourceRefs) {
      rows.push([
        warning.code,
        warning.severity,
        warning.scope,
        warning.handling ?? "",
        warning.message,
        warning.curveIds?.join(", ") ?? "",
        warning.labels?.join(", ") ?? "",
        sourceRef?.sourceInstanceId ?? "",
        sourceRef?.sourceKind ?? "",
        sourceRef?.sourceName ?? "",
        sourceRef?.worksheet ?? warning.sheetName ?? "",
        sourceRef?.cell ?? warning.sourceCell ?? "",
        sourceRef?.range ?? warning.sourceRange ?? "",
        sourceRef?.columnLetter ?? warning.columnLetter ?? "",
        sourceRef?.rawValue === undefined
          ? warning.rawValue === undefined
            ? ""
            : JSON.stringify(warning.rawValue)
          : JSON.stringify(sourceRef.rawValue),
        sourceRef?.displayValue ?? "",
        sourceRef?.cellType ?? "",
        sourceRef?.numberFormat ?? "",
        sourceRef?.formulaText ?? "",
        sourceRef?.formulaCacheStatus ?? ""
      ]);
    }
  }
  return rows;
}

type PreparedAnalysisRestore = {
  chunks: string[];
  metrics: AnalysisWorkbookMetrics;
};

function prepareAnalysisRestore(state: AnalysisState): PreparedAnalysisRestore {
  const serialized = serializeAnalysisState(state);
  const curveCount = state.dataset.curves.length;
  const pointCount = state.dataset.curves.reduce((count, curve) => count + curve.y.length, 0);
  const sourceCount = new Set(state.dataset.curves.map((curve) => curve.source.sourceInstanceId)).size;
  const json = JSON.stringify(serialized);
  const chunks = chunkString(json, CHUNK_SIZE);
  const joinedJsonBytes = utf8ByteLength(json);
  return {
    chunks,
    metrics: {
      fileBytes: null,
      curveCount,
      pointCount,
      sourceCount,
      restoreChunkCount: chunks.length,
      joinedJsonCodeUnits: json.length,
      joinedJsonBytes,
      advisoryEstimatedWorkbookBytes: estimateWorkbookBytes(state, joinedJsonBytes)
    }
  };
}

function createRestoreRows(prepared: PreparedAnalysisRestore) {
  const { chunks } = prepared;
  const rows: unknown[][] = [
    [ANALYSIS_RESTORE_MARKER],
    ["schemaVersion", ANALYSIS_STATE_SCHEMA_VERSION],
    ["chunkCount", chunks.length],
    ["chunkIndex", "jsonChunk"]
  ];
  for (let index = 0; index < chunks.length; index += 1) rows.push([index, chunks[index]]);
  return rows;
}

function readSerializedAnalysisState(worksheet: XLSX.WorkSheet, xlsx: XlsxModule) {
  const rows = xlsx.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, blankrows: false });
  if (rows[0]?.[0] !== ANALYSIS_RESTORE_MARKER) {
    throw new Error("Analysis XLSX restore marker is invalid.");
  }

  const schemaVersion = rows.find((row) => row[0] === "schemaVersion")?.[1];
  if (schemaVersion !== 1 && schemaVersion !== 2 && schemaVersion !== ANALYSIS_STATE_SCHEMA_VERSION) {
    throw new Error("Unsupported Analysis XLSX schema version.");
  }

  const chunkCount = rows.find((row) => row[0] === "chunkCount")?.[1];
  if (!Number.isInteger(chunkCount) || Number(chunkCount) <= 0) {
    throw new Error("Analysis XLSX restore chunk count is invalid.");
  }

  const chunks: string[] = [];
  const seenChunkIndexes = new Set<number>();
  for (const row of rows) {
    if (typeof row[0] !== "number" || typeof row[1] !== "string") continue;
    const chunkIndex = row[0];
    if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= Number(chunkCount)) {
      throw new Error("Analysis XLSX restore chunk index is invalid.");
    }
    if (seenChunkIndexes.has(chunkIndex)) {
      throw new Error("Analysis XLSX restore chunks contain duplicate indexes.");
    }
    seenChunkIndexes.add(chunkIndex);
    chunks[chunkIndex] = row[1];
  }

  if (chunks.length !== Number(chunkCount) || chunks.some((chunk) => typeof chunk !== "string")) {
    throw new Error("Analysis XLSX restore chunks are incomplete.");
  }

  const joinedJsonCodeUnits = chunks.reduce((count, chunk) => count + chunk.length, 0);
  const joinedJson = chunks.join("");
  const joinedJsonBytes = utf8ByteLength(joinedJson);
  const payload = JSON.parse(joinedJson) as { schemaVersion?: unknown };
  if (!payload || typeof payload !== "object" || payload.schemaVersion !== schemaVersion) {
    throw new Error("Analysis XLSX restore schema metadata does not match its payload.");
  }
  return {
    serialized: payload as SerializedAnalysisState,
    restoreMetrics: {
      restoreChunkCount: chunks.length,
      joinedJsonCodeUnits,
      joinedJsonBytes
    }
  };
}

function createAnalysisWorkbookMetrics(
  analysis: AnalysisState,
  restoreMetrics: Pick<AnalysisWorkbookMetrics, "restoreChunkCount" | "joinedJsonCodeUnits" | "joinedJsonBytes">
): AnalysisWorkbookMetrics {
  const curveCount = analysis.dataset.curves.length;
  return {
    fileBytes: null,
    curveCount,
    pointCount: analysis.dataset.curves.reduce((count, curve) => count + curve.y.length, 0),
    sourceCount: new Set(analysis.dataset.curves.map((curve) => curve.source.sourceInstanceId)).size,
    ...restoreMetrics,
    advisoryEstimatedWorkbookBytes: estimateWorkbookBytesFromShape(
      analysis.dataset.cycleCount,
      curveCount,
      restoreMetrics.joinedJsonBytes
    )
  };
}

function getSourceCycleCounts(state: AnalysisState, sourceFile: AnalysisState["sourceFiles"][number]) {
  const aggregateSource =
    sourceFile.sourceKind === "mixed" && sourceFile.sourceInstanceId === `dataset:${state.dataset.datasetId}`;
  return [
    ...new Set(
      state.dataset.curves
        .filter((curve) => aggregateSource || curve.source.sourceInstanceId === sourceFile.sourceInstanceId)
        .map((curve) => curve.x.length)
    )
  ].sort((left, right) => left - right);
}

function estimateWorkbookBytes(state: AnalysisState, joinedJsonBytes: number) {
  return estimateWorkbookBytesFromShape(state.dataset.cycleCount, state.dataset.curves.length, joinedJsonBytes);
}

function estimateWorkbookBytesFromShape(cycleCount: number, curveCount: number, joinedJsonBytes: number) {
  const importedDataCells = (cycleCount + 9) * (curveCount + 1);
  const provenanceCells = curveCount * 2 * 13;
  return Math.ceil(joinedJsonBytes + (importedDataCells + provenanceCells) * 24 + 65536);
}

function utf8ByteLength(value: string) {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else bytes += 3;
    } else bytes += 3;
  }
  return bytes;
}

function hasIsoAmplarAnalysisMarker(workbook: XLSX.WorkBook) {
  const readme = workbook.Sheets[READ_ME_SHEET_NAME];
  if (!readme) return false;
  const cell = readme["A1"];
  return String(cell?.v ?? "").includes("IsoAmplar Plot Analysis restore file");
}

function hasRestoreSheetMarker(worksheet: XLSX.WorkSheet) {
  return worksheet.A1?.v === ANALYSIS_RESTORE_MARKER;
}

function hideSheet(workbook: XLSX.WorkBook, sheetName: string) {
  workbook.Workbook ??= {};
  workbook.Workbook.Sheets = workbook.SheetNames.map((name) => ({
    name,
    Hidden: name === sheetName ? 1 : 0
  }));
}

function chunkString(value: string, size: number) {
  const chunks: string[] = [];
  for (let index = 0; index < value.length; ) {
    let end = Math.min(index + size, value.length);
    const lastCodeUnit = value.charCodeAt(end - 1);
    if (end < value.length && lastCodeUnit >= 0xd800 && lastCodeUnit <= 0xdbff) end -= 1;
    chunks.push(value.slice(index, end));
    index = end;
  }
  return chunks;
}

function toArrayBuffer(output: ArrayBuffer | Uint8Array | number[]) {
  if (output instanceof ArrayBuffer) return output;
  if (Array.isArray(output)) return new Uint8Array(output).buffer;
  return output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer;
}

function loadXlsx() {
  xlsxModulePromise ??= import("xlsx");
  return xlsxModulePromise;
}
