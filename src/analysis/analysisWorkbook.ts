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
  appendSheet(xlsx, workbook, HEADER_PROVENANCE_SHEET_NAME, createHeaderProvenanceRows(state.dataset.curves));
  appendSheet(xlsx, workbook, IMPORTED_DATA_SHEET_NAME, createImportedDataRows(state.dataset.curves, state.curveOverrides));
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

function createSettingsRows(state: AnalysisState) {
  const selectedCount = state.selection.selectedCurveIds.size;
  const rows: unknown[][] = [
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
    ["Source type", "Source ID", "Source name", "Sheet", "Sheet index", "Imported at", "Curve count"]
  ];
  for (const sourceFile of state.sourceFiles) {
    rows.push([
      sourceFile.sourceKind ?? "excel",
      sourceFile.sourceInstanceId ?? "",
      sourceFile.fileName,
      sourceFile.sheetName,
      sourceFile.sheetIndex,
      sourceFile.importedAtIso,
      sourceFile.curveCount
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

function createRestoreRows(serialized: SerializedAnalysisState) {
  const json = JSON.stringify(serialized);
  const chunks = chunkString(json, CHUNK_SIZE);
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

  const payload = JSON.parse(chunks.join("")) as { schemaVersion?: unknown };
  if (!payload || typeof payload !== "object" || payload.schemaVersion !== schemaVersion) {
    throw new Error("Analysis XLSX restore schema metadata does not match its payload.");
  }
  return payload as SerializedAnalysisState;
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
