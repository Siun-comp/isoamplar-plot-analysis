import type { Curve } from "../data/types";
import { getFiniteRange } from "../data/numericRange";

export type AxisId = "x" | "y";
export type ScaleMode = "auto" | "fixed" | "preset1" | "preset2";
export type ScalePresetId = "preset1" | "preset2";

export type ScalePreset = {
  label: string;
  min: string;
  max: string;
};

export type AppliedAxisScale = {
  mode: ScaleMode;
  min: number | null;
  max: number | null;
};

export type AxisScaleState = {
  mode: ScaleMode;
  fixedMin: string;
  fixedMax: string;
  preset1: ScalePreset | null;
  preset2: ScalePreset | null;
  applied: AppliedAxisScale;
};

export type ChartScaleState = {
  x: AxisScaleState;
  y: AxisScaleState;
};

export type AxisScaleIssue = {
  axis: AxisId;
  status: Exclude<AxisScaleDraftStatus, "valid">;
  blocksPlotExport: boolean;
  message: string;
};

export type AxisScaleDraftStatus = "valid" | "incomplete" | "invalid-order" | "valid-no-data-overlap";

export type AxisScaleResolution = {
  min?: number;
  max?: number;
  dataDomain: { min: number; max: number } | null;
  status: AxisScaleDraftStatus;
  applied: AppliedAxisScale;
  issue?: AxisScaleIssue;
};

export function createDefaultChartScale(): ChartScaleState {
  return {
    x: createDefaultAxisScale(),
    y: createDefaultAxisScale()
  };
}

export function createDefaultAxisScale(): AxisScaleState {
  return {
    mode: "auto",
    fixedMin: "",
    fixedMax: "",
    preset1: { label: "P1", min: "", max: "" },
    preset2: { label: "P2", min: "", max: "" },
    applied: createAutoAppliedScale()
  };
}

export function resolveAxisScale(
  axis: AxisId,
  state: AxisScaleState,
  curves: Curve[]
): AxisScaleResolution {
  const domain = getAxisDataDomain(axis, curves);
  const draft = parseActiveScaleDraft(state);
  const applied = normalizeAppliedScale(state.applied);
  const appliedBounds = applied.mode === "auto" ? {} : { min: applied.min ?? undefined, max: applied.max ?? undefined };

  if (draft.status === "incomplete" || draft.status === "invalid-order") {
    const label = state.mode === "fixed" ? "fixed" : state.mode.toUpperCase();
    return {
      ...appliedBounds,
      dataDomain: domain,
      applied,
      status: draft.status,
      issue: {
        axis,
        status: draft.status,
        blocksPlotExport: true,
        message:
          draft.status === "incomplete"
            ? `${axis.toUpperCase()} ${label} scale draft needs numeric min and max. The last valid scale remains applied.`
            : `${axis.toUpperCase()} ${label} scale draft requires min < max. The last valid scale remains applied.`
      }
    };
  }

  if (
    draft.bounds &&
    domain &&
    (draft.bounds.max < domain.min || draft.bounds.min > domain.max)
  ) {
    return {
      ...appliedBounds,
      dataDomain: domain,
      applied,
      status: "valid-no-data-overlap",
      issue: {
        axis,
        status: "valid-no-data-overlap",
        blocksPlotExport: false,
        message: `${axis.toUpperCase()} scale is valid but does not overlap the selected raw data range.`
      }
    };
  }

  return { ...appliedBounds, dataDomain: domain, applied, status: "valid" };
}

export function getAppliedAxisScaleForDraft(state: AxisScaleState): AppliedAxisScale | null {
  const draft = parseActiveScaleDraft(state);
  if (draft.status !== "valid" || !draft.applied) return null;
  return draft.applied;
}

export function createAutoAppliedScale(): AppliedAxisScale {
  return { mode: "auto", min: null, max: null };
}

export function hasVisibleCurveWarning(visibleCurveCount: number) {
  return visibleCurveCount > 20;
}

export function getAxisAutoDomain(axis: AxisId, curves: Curve[]) {
  return getAxisDataDomain(axis, curves);
}

export function isScalePresetConfigured(preset: ScalePreset | null) {
  return parseScalePreset(preset) !== null;
}

function parseNumberInput(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseScalePreset(preset: ScalePreset | null) {
  if (!preset) return null;
  const min = parseNumberInput(preset.min);
  const max = parseNumberInput(preset.max);
  if (min === null || max === null || min >= max) return null;
  return { min, max };
}

function parseActiveScaleDraft(state: AxisScaleState): {
  status: "valid" | "incomplete" | "invalid-order";
  bounds?: { min: number; max: number };
  applied?: AppliedAxisScale;
} {
  if (state.mode === "auto") {
    return { status: "valid", applied: createAutoAppliedScale() };
  }

  const source =
    state.mode === "fixed"
      ? { min: state.fixedMin, max: state.fixedMax }
      : state.mode === "preset1"
        ? state.preset1
        : state.preset2;
  if (!source) return { status: "incomplete" };
  const min = parseNumberInput(source.min);
  const max = parseNumberInput(source.max);
  if (min === null || max === null) return { status: "incomplete" };
  if (min >= max) return { status: "invalid-order" };
  return {
    status: "valid",
    bounds: { min, max },
    applied: { mode: state.mode, min, max }
  };
}

function normalizeAppliedScale(applied: AppliedAxisScale | undefined): AppliedAxisScale {
  if (!applied || applied.mode === "auto") return createAutoAppliedScale();
  if (
    typeof applied.min !== "number" ||
    typeof applied.max !== "number" ||
    !Number.isFinite(applied.min) ||
    !Number.isFinite(applied.max) ||
    applied.min >= applied.max
  ) {
    return createAutoAppliedScale();
  }
  return applied;
}

function getAxisDataDomain(axis: AxisId, curves: Curve[]) {
  let domain: { min: number; max: number } | null = null;
  for (const curve of curves) {
    const range = getFiniteRange(axis === "x" ? curve.x : curve.y);
    if (!range) continue;
    if (!domain) {
      domain = { min: range.min, max: range.max };
      continue;
    }
    if (range.min < domain.min) domain.min = range.min;
    if (range.max > domain.max) domain.max = range.max;
  }
  return domain;
}
