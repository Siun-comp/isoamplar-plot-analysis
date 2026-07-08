import { formatCurveLabel } from "../data/curveLabels";
import type {
  Curve,
  CurveStyleOverride,
  GroupingMode,
  LineType,
  MarkerType,
  ResolvedCurveStyle,
  StyleFieldOrigin,
  StyleRules
} from "../data/types";

export const defaultChartColors = [
  "#0b6fa4",
  "#d97706",
  "#5b8c5a",
  "#b23a48",
  "#6f5fa8",
  "#1d7a7a",
  "#a15c38",
  "#455a64",
  "#2f80ed",
  "#f2b705"
];

const lineTypeCycle: LineType[] = ["solid", "dashed", "dotted"];

export function createDefaultStyleRules(): StyleRules {
  return {
    colorBy: "reagent",
    lineTypeBy: "specimen",
    markerBy: "reagent",
    specimenColors: {},
    reagentColors: {},
    specimenLineTypes: {},
    reagentLineTypes: {},
    specimenMarkerTypes: {},
    reagentMarkerTypes: {}
  };
}

export function resolveCurveStyle(args: {
  curve: Curve;
  index: number;
  fallbackColorIndex?: number;
  labelMode?: GroupingMode;
  styleRules: StyleRules;
  override?: CurveStyleOverride;
}): ResolvedCurveStyle {
  const { curve, index, fallbackColorIndex, labelMode, styleRules, override } = args;
  const colorGroupId = styleRules.colorBy === "specimen" ? curve.specimenId : curve.reagentId;
  const colorRules = styleRules.colorBy === "specimen" ? styleRules.specimenColors : styleRules.reagentColors;
  const lineTypeGroupId = styleRules.lineTypeBy === "specimen" ? curve.specimenId : curve.reagentId;
  const lineTypeRules =
    styleRules.lineTypeBy === "specimen" ? styleRules.specimenLineTypes : styleRules.reagentLineTypes;
  const markerTypeGroupId = styleRules.markerBy === "specimen" ? curve.specimenId : curve.reagentId;
  const markerTypeRules =
    styleRules.markerBy === "specimen" ? styleRules.specimenMarkerTypes : styleRules.reagentMarkerTypes;
  const defaultColorIndex = fallbackColorIndex ?? index;
  const groupColor = colorRules[colorGroupId];
  const groupLineType = lineTypeRules[lineTypeGroupId];
  const groupMarkerType = markerTypeRules[markerTypeGroupId];

  return {
    displayName: override?.displayName || formatCurveLabel(curve, labelMode),
    color: override?.color || groupColor || defaultChartColors[defaultColorIndex % defaultChartColors.length],
    lineType: override?.lineType || groupLineType || "solid",
    markerType: override?.markerType ?? groupMarkerType ?? "none",
    lineWidth: override?.lineWidth ?? 2.25,
    visible: override?.visible ?? true,
    source: override?.source,
    sources: override?.fieldSources ?? {},
    origins: {
      displayName: getOverrideOrigin(override?.displayName),
      color: getRuleOrigin(override?.color, groupColor),
      lineType: getRuleOrigin(override?.lineType, groupLineType),
      markerType: getRuleOrigin(override?.markerType, groupMarkerType),
      lineWidth: getOverrideOrigin(override?.lineWidth),
      visible: getOverrideOrigin(override?.visible)
    }
  };
}

export function createPresetOverrides(args: {
  curves: Curve[];
  referenceCurves?: Curve[];
  preset: BuiltInStylePresetId;
}): Record<string, CurveStyleOverride> {
  const { curves, preset } = args;
  const referenceCurves = args.referenceCurves ?? curves;
  const specimenColorMap = createEntityStyleMap(referenceCurves, "specimen", defaultChartColors);
  const reagentColorMap = createEntityStyleMap(referenceCurves, "reagent", defaultChartColors);
  const specimenLineMap = createEntityStyleMap(referenceCurves, "specimen", lineTypeCycle);
  const reagentLineMap = createEntityStyleMap(referenceCurves, "reagent", lineTypeCycle);

  return Object.fromEntries(
    curves.map((curve) => {
      if (preset === "specimenColorReagentLine") {
        return [
          curve.curveId,
          {
            color: specimenColorMap[curve.specimenId],
            lineType: reagentLineMap[curve.reagentId],
            markerType: "none",
            source: "preset",
            fieldSources: createPresetFieldSources()
          }
        ];
      }

      if (preset === "reagentColorSpecimenLine") {
        return [
          curve.curveId,
          {
            color: reagentColorMap[curve.reagentId],
            lineType: specimenLineMap[curve.specimenId],
            markerType: "none",
            source: "preset",
            fieldSources: createPresetFieldSources()
          }
        ];
      }

      return [
        curve.curveId,
        {
          color: reagentColorMap[curve.reagentId],
          lineType: "solid",
          markerType: "none",
          source: "preset",
          fieldSources: createPresetFieldSources()
        }
      ];
    })
  );
}

function createPresetFieldSources() {
  return {
    color: "preset",
    lineType: "preset",
    markerType: "preset"
  } as const;
}

export type BuiltInStylePresetId = "reagentColorSolid" | "specimenColorReagentLine" | "reagentColorSpecimenLine";

export const builtInStylePresets: Array<{ id: BuiltInStylePresetId; label: string }> = [
  { id: "reagentColorSolid", label: "시약 색상 / 실선" },
  { id: "specimenColorReagentLine", label: "검체 색상 / 시약 선" },
  { id: "reagentColorSpecimenLine", label: "시약 색상 / 검체 선" }
];

function createEntityStyleMap<T extends string>(
  curves: Curve[],
  target: "specimen" | "reagent",
  cycle: T[]
): Record<string, T> {
  const map: Record<string, T> = {};
  let index = 0;

  curves.forEach((curve) => {
    const id = target === "specimen" ? curve.specimenId : curve.reagentId;
    if (!map[id]) {
      map[id] = cycle[index % cycle.length];
      index += 1;
    }
  });

  return map;
}

function getRuleOrigin<T extends string | number | boolean | undefined>(
  overrideValue: T | undefined,
  groupValue: T | undefined
): StyleFieldOrigin {
  if (overrideValue !== undefined) return "override";
  if (groupValue !== undefined) return "group";
  return "default";
}

function getOverrideOrigin(value: string | number | boolean | MarkerType | undefined): StyleFieldOrigin {
  return value !== undefined ? "override" : "default";
}
