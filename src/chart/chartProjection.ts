import type { AxisScaleIssue, ChartScaleState } from "./chartScale";
import { resolveAxisScale } from "./chartScale";
import { createDefaultStyleRules, defaultChartColors, resolveCurveStyle } from "./chartStyle";
import { formatCurveSourceSuffix } from "../data/curveLabels";
import type { Curve, CurveStyleOverride, GroupingMode, PcrDataset, ResolvedCurveStyle, StyleRules } from "../data/types";

type ResolvedAxisScale = ReturnType<typeof resolveAxisScale>;

export type ChartProjection = {
  visibleCurves: Curve[];
  resolvedStyles: Map<string, ResolvedCurveStyle>;
  chartNames: Map<string, string>;
  legendItems: LegendItem[];
  scaleIssues: AxisScaleIssue[];
  xScale: ResolvedAxisScale;
  yScale: ResolvedAxisScale;
};

export type LegendItem = {
  curveId: string;
  label: string;
  color: string;
  lineType: ResolvedCurveStyle["lineType"];
  markerType: ResolvedCurveStyle["markerType"];
  lineWidth: number;
};

export function buildChartProjection(args: {
  dataset: PcrDataset | null;
  selectedCurveIds: Set<string>;
  orderedCurveIds?: string[];
  scale: ChartScaleState;
  labelMode?: GroupingMode;
  styleRules?: StyleRules;
  curveOverrides?: Record<string, CurveStyleOverride>;
}): ChartProjection {
  const visibleCurves = getVisibleCurves(args.dataset, args.selectedCurveIds, args.orderedCurveIds);
  const styleRules = args.styleRules ?? createDefaultStyleRules();
  const fallbackColorIndices = createStableColorIndexMap(args.dataset, styleRules);
  const resolvedStyles = new Map(
    visibleCurves.map((curve, index) => [
      curve.curveId,
      resolveCurveStyle({
        curve,
        index,
        fallbackColorIndex: fallbackColorIndices.get(curve.curveId),
        labelMode: args.labelMode,
        styleRules,
        override: args.curveOverrides?.[curve.curveId]
      })
    ])
  );
  const chartNames = createUniqueChartNames(visibleCurves, resolvedStyles);
  const legendItems = createLegendItems(visibleCurves, resolvedStyles, chartNames);
  const xScale = resolveAxisScale("x", args.scale.x, visibleCurves);
  const yScale = resolveAxisScale("y", args.scale.y, visibleCurves);
  const scaleIssues = [xScale.issue, yScale.issue].filter((issue): issue is AxisScaleIssue => Boolean(issue));

  return {
    visibleCurves,
    resolvedStyles,
    chartNames,
    legendItems,
    scaleIssues,
    xScale,
    yScale
  };
}

export function getVisibleCurves(dataset: PcrDataset | null, selectedCurveIds: Set<string>, orderedCurveIds?: string[]) {
  if (!dataset) return [];

  const curvesById = new Map(dataset.curves.map((curve) => [curve.curveId, curve]));
  const order = orderedCurveIds ?? dataset.orderedCurveIds;

  return order
    .filter((curveId) => selectedCurveIds.has(curveId))
    .map((curveId) => curvesById.get(curveId))
    .filter((curve): curve is Curve => Boolean(curve));
}

function createUniqueChartNames(curves: Curve[], resolvedStyles: Map<string, ResolvedCurveStyle>) {
  const countByLabel = new Map<string, number>();
  curves.forEach((curve) => {
    const displayName = resolvedStyles.get(curve.curveId)?.displayName ?? curve.displayLabel;
    countByLabel.set(displayName, (countByLabel.get(displayName) ?? 0) + 1);
  });

  return new Map(
    curves.map((curve) => {
      const displayName = resolvedStyles.get(curve.curveId)?.displayName ?? curve.displayLabel;
      return [
        curve.curveId,
        (countByLabel.get(displayName) ?? 0) > 1
          ? `${displayName} [${formatCurveSourceSuffix(curve)}]`
          : displayName
      ];
    })
  );
}

function createLegendItems(curves: Curve[], resolvedStyles: Map<string, ResolvedCurveStyle>, chartNames: Map<string, string>): LegendItem[] {
  return curves.map((curve, index) => {
    const resolvedStyle = resolvedStyles.get(curve.curveId);
    return {
      curveId: curve.curveId,
      label: chartNames.get(curve.curveId) ?? curve.displayLabel,
      color: resolvedStyle?.color ?? defaultChartColors[index % defaultChartColors.length],
      lineType: resolvedStyle?.lineType ?? "solid",
      markerType: resolvedStyle?.markerType ?? "none",
      lineWidth: resolvedStyle?.lineWidth ?? 2.25
    };
  });
}

function createStableColorIndexMap(dataset: PcrDataset | null, styleRules: StyleRules) {
  const indexByCurveId = new Map<string, number>();
  if (!dataset) return indexByCurveId;

  const entityIds =
    styleRules.colorBy === "specimen"
      ? dataset.specimens.map((specimen) => specimen.id)
      : dataset.reagents.map((reagent) => reagent.id);
  const entityIndexById = new Map(entityIds.map((id, index) => [id, index]));

  dataset.curves.forEach((curve, index) => {
    const entityId = styleRules.colorBy === "specimen" ? curve.specimenId : curve.reagentId;
    indexByCurveId.set(curve.curveId, entityIndexById.get(entityId) ?? index);
  });

  return indexByCurveId;
}

export { defaultChartColors };
