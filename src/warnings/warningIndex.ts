import type { PcrDataset, PcrWarning } from "../data/types";

export function getWarningsByCurveId(dataset: PcrDataset) {
  const warningsByCurveId = new Map<string, PcrWarning[]>();
  for (const curve of dataset.curves) {
    for (const warning of curve.warnings) addWarning(warningsByCurveId, curve.curveId, warning);
  }
  for (const warning of dataset.warnings) {
    for (const curveId of warning.curveIds ?? []) addWarning(warningsByCurveId, curveId, warning);
  }
  return warningsByCurveId;
}

export function getWarningCurveIds(dataset: PcrDataset) {
  return new Set(getWarningsByCurveId(dataset).keys());
}

function addWarning(warningsByCurveId: Map<string, PcrWarning[]>, curveId: string, warning: PcrWarning) {
  const warnings = warningsByCurveId.get(curveId) ?? [];
  const warningKey = createWarningKey(warning);
  if (!warnings.some((candidate) => createWarningKey(candidate) === warningKey)) warnings.push(warning);
  warningsByCurveId.set(curveId, warnings);
}

function createWarningKey(warning: PcrWarning) {
  return JSON.stringify([
    warning.code,
    warning.message,
    warning.sourceCell,
    warning.sourceRange,
    warning.sourceRefs?.map((sourceRef) => [
      sourceRef.sourceInstanceId,
      sourceRef.worksheet,
      sourceRef.cell,
      sourceRef.range,
      sourceRef.columnLetter
    ])
  ]);
}
