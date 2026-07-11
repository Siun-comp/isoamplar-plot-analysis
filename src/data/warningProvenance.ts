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
  const curvesById = new Map(curves.map((curve) => [curve.curveId, curve]));
  return warnings.map((warning) => {
    const sourceRefs = [...(warning.sourceRefs ?? [])];
    for (const curveId of warning.curveIds ?? []) {
      const curve = curvesById.get(curveId);
      if (!curve) continue;
      const sourceRef = createCurveSourceRef(curve, warning);
      const existingIndex = sourceRefs.findIndex(
        (candidate) =>
          isSameSourceLocation(candidate, sourceRef) ||
          (candidate.sourceInstanceId === sourceRef.sourceInstanceId && candidate.columnLetter === sourceRef.columnLetter)
      );
      if (existingIndex >= 0) {
        sourceRefs[existingIndex] = { ...sourceRef, ...sourceRefs[existingIndex], sourceInstanceId: sourceRef.sourceInstanceId };
      } else {
        sourceRefs.push(sourceRef);
      }
    }

    if (sourceRefs.length === 0 && hasLegacyLocation(warning)) {
      const curve = curves.find(
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

function isSameSourceLocation(left: WarningSourceRef, right: WarningSourceRef) {
  return (
    (!left.sourceInstanceId || !right.sourceInstanceId || left.sourceInstanceId === right.sourceInstanceId) &&
    left.sourceName === right.sourceName &&
    left.worksheet === right.worksheet &&
    left.cell === right.cell &&
    left.range === right.range &&
    left.columnLetter === right.columnLetter
  );
}
