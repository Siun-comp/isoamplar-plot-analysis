import type { Curve, PcrWarning, WarningHandling, WarningSourceRef } from "./types";

const nullGapCodes = new Set(["EMPTY_FLUORESCENCE_CELL", "NON_NUMERIC_FLUORESCENCE", "FORMULA_WITHOUT_CACHED_VALUE"]);
const ignoredCodes = new Set(["IGNORED_WORKSHEETS"]);
const blockedCodes = new Set([
  "FIRST_SHEET_INVALID",
  "INVALID_PASTED_TABLE",
  "UNSUPPORTED_FILE_TYPE",
  "PROTECTED_OR_UNREADABLE_WORKBOOK"
]);

export function inferWarningHandling(code: PcrWarning["code"]): WarningHandling {
  if (nullGapCodes.has(code)) return "null-gap";
  if (ignoredCodes.has(code)) return "ignored";
  if (blockedCodes.has(code)) return "blocked";
  return "kept";
}

export function normalizeWarningProvenance(warnings: PcrWarning[], curves: Curve[]): PcrWarning[] {
  return normalizeWarningProvenanceWithIndex(warnings, curves, createWarningProvenanceIndex(curves));
}

export type WarningProvenanceIndex = ReturnType<typeof createWarningProvenanceIndex>;

export function createWarningProvenanceIndex(curves: Curve[]) {
  const curvesById = new Map<string, Curve>();
  const curvesByLocation = new Map<string, Curve>();
  for (const curve of curves) {
    curvesById.set(curve.curveId, curve);
    curvesByLocation.set(`${curve.source.sheetName}\u0000${curve.source.columnLetter}`, curve);
  }
  return { curvesById, curvesByLocation };
}

export function normalizeWarningProvenanceWithIndex(
  warnings: PcrWarning[],
  curves: Curve[],
  index: WarningProvenanceIndex
): PcrWarning[] {
  const { curvesById, curvesByLocation } = index;
  return warnings.map((warning) => {
    const sourceRefs = [...(warning.sourceRefs ?? [])];
    const sourceRefIndexes = new Map<string, number>();
    const sourceColumnIndexes = new Map<string, number>();
    const legacySourceRefIndexes = new Map<string, number>();
    sourceRefs.forEach((sourceRef, sourceIndex) => {
      sourceRefIndexes.set(createSourceLocationKey(sourceRef), sourceIndex);
      if (sourceRef.sourceInstanceId && sourceRef.columnLetter) {
        sourceColumnIndexes.set(`${sourceRef.sourceInstanceId}\u0000${sourceRef.columnLetter}`, sourceIndex);
      } else if (!sourceRef.sourceInstanceId) {
        legacySourceRefIndexes.set(createLegacySourceLocationKey(sourceRef), sourceIndex);
      }
    });
    for (const curveId of warning.curveIds ?? []) {
      const curve = curvesById.get(curveId);
      if (!curve) continue;
      const sourceRef = createCurveSourceRef(curve, warning);
      const existingIndex =
        sourceRefIndexes.get(createSourceLocationKey(sourceRef)) ??
        (sourceRef.sourceInstanceId && sourceRef.columnLetter
          ? sourceColumnIndexes.get(`${sourceRef.sourceInstanceId}\u0000${sourceRef.columnLetter}`)
          : undefined) ??
        legacySourceRefIndexes.get(createLegacySourceLocationKey(sourceRef));
      if (existingIndex !== undefined) {
        sourceRefs[existingIndex] = { ...sourceRef, ...sourceRefs[existingIndex], sourceInstanceId: sourceRef.sourceInstanceId };
      } else {
        const nextIndex = sourceRefs.push(sourceRef) - 1;
        sourceRefIndexes.set(createSourceLocationKey(sourceRef), nextIndex);
        if (sourceRef.sourceInstanceId && sourceRef.columnLetter) {
          sourceColumnIndexes.set(`${sourceRef.sourceInstanceId}\u0000${sourceRef.columnLetter}`, nextIndex);
        }
      }
    }

    if (sourceRefs.length === 0 && hasLegacyLocation(warning)) {
      const curve =
        warning.sheetName && warning.columnLetter
          ? curvesByLocation.get(`${warning.sheetName}\u0000${warning.columnLetter}`)
          : curves.find(
              (candidate) =>
                (!warning.sheetName || candidate.source.sheetName === warning.sheetName) &&
                (!warning.columnLetter || candidate.source.columnLetter === warning.columnLetter)
            );
      if (curve) sourceRefs.push(createCurveSourceRef(curve, warning));
    }

    return {
      ...warning,
      handling: warning.handling ?? inferWarningHandling(warning.code),
      sourceRefs
    };
  });
}

function createCurveSourceRef(curve: Curve, warning: PcrWarning): WarningSourceRef {
  const header =
    warning.sourceCell === curve.source.specimenCell
      ? curve.source.specimenHeader
      : warning.sourceCell === curve.source.reagentCell
        ? curve.source.reagentHeader
        : undefined;
  return {
    sourceInstanceId: curve.source.sourceInstanceId,
    sourceName: curve.source.fileName,
    sourceKind: curve.source.sourceKind,
    worksheet: warning.sheetName ?? curve.source.sheetName,
    cell: warning.sourceCell,
    range: warning.sourceRange,
    columnLetter: warning.columnLetter ?? curve.source.columnLetter,
    rawValue: header?.rawValue ?? toPortableRawValue(warning.rawValue),
    displayValue: header?.displayValue,
    cellType: header?.cellType,
    numberFormat: header?.numberFormat,
    formulaText: header?.formulaText,
    formulaCacheStatus: header?.formulaCacheStatus
  };
}

function toPortableRawValue(value: unknown) {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  return value === undefined ? undefined : String(value);
}

function hasLegacyLocation(warning: PcrWarning) {
  return Boolean(warning.sourceCell || warning.sourceRange || warning.sheetName || warning.columnLetter);
}

function createSourceLocationKey(source: WarningSourceRef) {
  return [
    source.sourceInstanceId ?? "",
    source.sourceName,
    source.worksheet ?? "",
    source.cell ?? "",
    source.range ?? "",
    source.columnLetter ?? ""
  ].join("\u0000");
}

function createLegacySourceLocationKey(source: WarningSourceRef) {
  return [
    source.sourceName,
    source.worksheet ?? "",
    source.cell ?? "",
    source.range ?? "",
    source.columnLetter ?? ""
  ].join("\u0000");
}
