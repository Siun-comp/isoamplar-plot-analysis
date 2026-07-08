import type { PcrDataset, SelectionFilter } from "../data/types";
import { formatCurveLabel } from "../data/curveLabels";

export function getMatchedCurveIds(dataset: PcrDataset, query: string) {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return new Set(dataset.orderedCurveIds);
  }

  return new Set(
    dataset.curves
      .filter((curve) =>
        [
          curve.specimenLabel,
          curve.reagentLabel,
          curve.displayLabel,
          formatCurveLabel(curve, "reagent"),
          formatCurveLabel(curve, "specimen"),
          curve.source.columnLetter,
          curve.source.fileName,
          curve.source.sheetName
        ].some((value) => normalizeSearchText(value).includes(normalizedQuery))
      )
      .map((curve) => curve.curveId)
  );
}

export function getFilteredCurveIds(
  dataset: PcrDataset,
  matchedCurveIds: Set<string>,
  selectedCurveIds: Set<string>,
  filter: SelectionFilter
) {
  return new Set(
    dataset.curves
      .filter((curve) => matchedCurveIds.has(curve.curveId))
      .filter((curve) => {
        if (filter === "selected") return selectedCurveIds.has(curve.curveId);
        if (filter === "unselected") return !selectedCurveIds.has(curve.curveId);
        if (filter === "warning") return curve.warnings.length > 0;
        return true;
      })
      .map((curve) => curve.curveId)
  );
}

function normalizeSearchText(value: string) {
  return value.trim().toLocaleLowerCase();
}
