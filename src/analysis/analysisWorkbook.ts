import type * as XLSX from "xlsx";
import {
  ANALYSIS_STATE_SCHEMA_VERSION,
  deserializeAnalysisState,
  serializeAnalysisState,
  type AnalysisState,
  type SerializedAnalysisState
} from "./analysisState";
import type { Curve, PcrWarning } from "../data/types";
import { createDateStamp } from "../chart/exportFilenames";

type XlsxModule = typeof import("xlsx");

export const ANALYSIS_RESTORE_SHEET_NAME = "_IsoAmplarAnalysis";
export const ANALYSIS_RESTORE_MARKER = "IsoAmplarAnalysis";
const READ_ME_SHEET_NAME = "README";
const SETTINGS_SHEET_NAME = "Settings";
const IMPORTED_DATA_SHEET_NAME = "ImportedData";
const WARNINGS_SHEET_NAME = "Warnings";
const CHUNK_SIZE = 30000;

export type AnalysisWorkbookReadResult =
  | { kind: "analysis"; analysis: AnalysisState }
  | { kind: "not-analysis" }
  | { kind: "invalid-analysis"; message: string };

let xlsxModulePromise: Promise<XlsxModule> | null = null;

export async function exportAnalysisWorkbookBuffer(state: AnalysisState) {
  const xlsx = await loadXlsx();
  const workbook = xlsx.utils.book_new();

  appendSheet(xlsx, workbook, READ_ME_SHEET_NAME, createReadmeRows());
  appendSheet(xlsx, workbook, SETTINGS_SHEET_NAME, createSettingsRows(state));
  appendSheet(xlsx, workbook, IMPORTED_DATA_SHEET_NAME, createImportedDataRows(state.dataset.curves));
  appendSheet(xlsx, workbook, WARNINGS_SHEET_NAME, createWarningsRows(state.dataset.warnings));
  appendSheet(xlsx, workbook, ANALYSIS_RESTORE_SHEET_NAME, createRestoreRows(serializeAnalysisState(state)));
  hideSheet(workbook, ANALYSIS_RESTORE_SHEET_NAME);

  const output = xlsx.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer | Uint8Array | number[];
  return toArrayBuffer(output);
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
  return readAnalysisWorkbook(workbook, xlsx);
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
    const serialized = readSerializedAnalysisState(restoreSheet, xlsx);
    return {
      kind: "analysis",
      analysis: deserializeAnalysisState(serialized)
    };
  } catch (error) {
    return {
      kind: "invalid-analysis",
      message: error instanceof Error ? error.message : "Analysis XLSX restore data is invalid."
    };
  }
}

export function createAnalysisWorkbookFileName(analysisNumber: number, date = new Date()) {
  return `${createDateStamp(date)}_analysis${analysisNumber}.xlsx`;
}

export function sanitizeAnalysisFileNamePart(value: string) {
  return value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/gu, "_")
    .replace(/\s+/gu, "_")
    .replace(/_+/gu, "_")
    .replace(/^_+|_+$/gu, "")
    .slice(0, 80);
}

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

function createSettingsRows(state: AnalysisState) {
  const selectedCount = state.selection.selectedCurveIds.size;
  return [
    ["Setting", "Value"],
    ["Analysis name", state.analysisName],
    ["Exported at", new Date().toISOString()],
    ["Schema version", ANALYSIS_STATE_SCHEMA_VERSION],
    ["Imported curve count", state.dataset.curves.length],
    ["Selected curve count", selectedCount],
    ["Dataset source file", state.dataset.sourceFileName],
    ["Worksheet", state.dataset.sheetName],
    ["Export counter", state.exportCounter],
    ["Grouping mode", state.selection.groupingMode],
    [],
    ["Source file", "Sheet", "Sheet index", "Imported at", "Curve count"],
    ...state.sourceFiles.map((sourceFile) => [
      sourceFile.fileName,
      sourceFile.sheetName,
      sourceFile.sheetIndex,
      sourceFile.importedAtIso,
      sourceFile.curveCount
    ])
  ];
}

function createImportedDataRows(curves: Curve[]) {
  const maxPoints = Math.max(0, ...curves.map((curve) => curve.x.length));
  return [
    ["Cycle", ...curves.map((curve) => curve.specimenLabel)],
    ["", ...curves.map((curve) => curve.reagentLabel)],
    ["", ...curves.map((curve) => curve.curveId)],
    ...Array.from({ length: maxPoints }, (_, index) => [
      curves[0]?.x[index] ?? index + 1,
      ...curves.map((curve) => curve.y[index] ?? "")
    ])
  ];
}

function createWarningsRows(warnings: PcrWarning[]) {
  return [
    ["Code", "Severity", "Scope", "Message", "Curve IDs", "Labels", "Source cell", "Source range", "Sheet", "Column", "Raw value"],
    ...warnings.map((warning) => [
      warning.code,
      warning.severity,
      warning.scope,
      warning.message,
      warning.curveIds?.join(", ") ?? "",
      warning.labels?.join(", ") ?? "",
      warning.sourceCell ?? "",
      warning.sourceRange ?? "",
      warning.sheetName ?? "",
      warning.columnLetter ?? "",
      warning.rawValue === undefined ? "" : JSON.stringify(warning.rawValue)
    ])
  ];
}

function createRestoreRows(serialized: SerializedAnalysisState) {
  const json = JSON.stringify(serialized);
  const chunks = chunkString(json, CHUNK_SIZE);
  return [
    [ANALYSIS_RESTORE_MARKER],
    ["schemaVersion", ANALYSIS_STATE_SCHEMA_VERSION],
    ["chunkCount", chunks.length],
    ["chunkIndex", "jsonChunk"],
    ...chunks.map((chunk, index) => [index, chunk])
  ];
}

function readSerializedAnalysisState(worksheet: XLSX.WorkSheet, xlsx: XlsxModule) {
  const rows = xlsx.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, blankrows: false });
  if (rows[0]?.[0] !== ANALYSIS_RESTORE_MARKER) {
    throw new Error("Analysis XLSX restore marker is invalid.");
  }

  const schemaVersion = rows.find((row) => row[0] === "schemaVersion")?.[1];
  if (schemaVersion !== ANALYSIS_STATE_SCHEMA_VERSION) {
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

  return JSON.parse(chunks.join("")) as SerializedAnalysisState;
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
  for (let index = 0; index < value.length; index += size) {
    chunks.push(value.slice(index, index + size));
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
