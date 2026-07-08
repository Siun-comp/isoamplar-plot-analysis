import type { ChartScaleState } from "../chart/chartScale";
import type {
  Curve,
  CurveSource,
  CurveStats,
  CurveStyleOverride,
  ExportSettings,
  LegendSettings,
  LineType,
  MarkerType,
  PcrDataset,
  PcrEntity,
  PcrWarning,
  SelectionFilter,
  SelectionState,
  StyleRules
} from "../data/types";

export const ANALYSIS_STATE_SCHEMA_VERSION = 1;

export type SourceFileSummary = {
  fileName: string;
  sheetName: string;
  sheetIndex: number;
  importedAtIso: string;
  curveCount: number;
};

export type AnalysisState = {
  analysisId: string;
  analysisName: string;
  dataset: PcrDataset;
  selection: SelectionState;
  searchQuery: string;
  selectionFilter: SelectionFilter;
  chartScale: ChartScaleState;
  styleRules: StyleRules;
  curveOverrides: Record<string, CurveStyleOverride>;
  legendSettings: LegendSettings;
  exportSettings: ExportSettings;
  exportCounter: number;
  importFileName: string | null;
  sourceFiles: SourceFileSummary[];
  dirty: boolean;
};

export type SerializedSelectionState = {
  groupingMode: SelectionState["groupingMode"];
  selectedCurveIds: string[];
  collapsedGroupIds: string[];
  orderedCurveIds: string[];
};

export type SerializedAnalysisState = Omit<
  AnalysisState,
  "analysisId" | "selection" | "dirty" | "legendSettings" | "exportSettings"
> & {
  schemaVersion: typeof ANALYSIS_STATE_SCHEMA_VERSION;
  selection: SerializedSelectionState;
  legendSettings?: LegendSettings;
  exportSettings?: ExportSettings;
};

export type CreateAnalysisStateInput = Omit<AnalysisState, "sourceFiles" | "dirty" | "legendSettings" | "exportSettings"> & {
  legendSettings?: LegendSettings;
  exportSettings?: ExportSettings;
  sourceFiles?: SourceFileSummary[];
  dirty?: boolean;
};

export type DeserializeAnalysisStateOptions = {
  analysisId?: string;
};

const groupingModes = ["reagent", "specimen"] as const;
const selectionFilters = ["all", "selected", "unselected", "warning"] as const;
const scaleModes = ["auto", "fixed", "preset1", "preset2"] as const;
const styleGroupingTargets = ["specimen", "reagent"] as const;
const lineTypes = ["solid", "dashed", "dotted"] as const;
const markerTypes = ["none", "circle", "triangle", "rect"] as const;
const imageExportLayouts = ["plotOnly", "plotWithLegend", "legendOnly"] as const;
const overrideSources = ["custom", "preset"] as const;
const curveStyleFields = ["displayName", "color", "lineType", "markerType", "lineWidth", "visible"] as const;
const warningSeverities = ["info", "warning", "error"] as const;
const warningScopes = ["import", "dataset", "header", "curve", "cell", "export"] as const;

export function createAnalysisState(input: CreateAnalysisStateInput): AnalysisState {
  return {
    ...input,
    legendSettings: input.legendSettings ?? createDefaultLegendSettings(),
    exportSettings: input.exportSettings ?? createDefaultExportSettings(),
    sourceFiles: input.sourceFiles ?? [createSourceFileSummary(input.dataset)],
    dirty: input.dirty ?? false
  };
}

export function createDefaultLegendSettings(): LegendSettings {
  return {
    previewVisible: true
  };
}

export function createDefaultExportSettings(): ExportSettings {
  return {
    imageLayout: "plotWithLegend"
  };
}

export function createSourceFileSummary(dataset: PcrDataset): SourceFileSummary {
  return {
    fileName: dataset.sourceFileName,
    sheetName: dataset.sheetName,
    sheetIndex: dataset.sheetIndex,
    importedAtIso: dataset.importedAtIso,
    curveCount: dataset.curves.length
  };
}

export function serializeSelectionState(selection: SelectionState): SerializedSelectionState {
  return {
    groupingMode: selection.groupingMode,
    selectedCurveIds: [...selection.selectedCurveIds],
    collapsedGroupIds: [...selection.collapsedGroupIds],
    orderedCurveIds: [...selection.orderedCurveIds]
  };
}

export function deserializeSelectionState(selection: SerializedSelectionState): SelectionState {
  return {
    groupingMode: selection.groupingMode,
    selectedCurveIds: new Set(selection.selectedCurveIds),
    collapsedGroupIds: new Set(selection.collapsedGroupIds),
    orderedCurveIds: [...selection.orderedCurveIds]
  };
}

export function serializeAnalysisState(state: AnalysisState): SerializedAnalysisState {
  return {
    schemaVersion: ANALYSIS_STATE_SCHEMA_VERSION,
    analysisName: state.analysisName,
    dataset: state.dataset,
    selection: serializeSelectionState(state.selection),
    searchQuery: state.searchQuery,
    selectionFilter: state.selectionFilter,
    chartScale: state.chartScale,
    styleRules: state.styleRules,
    curveOverrides: state.curveOverrides,
    legendSettings: state.legendSettings,
    exportSettings: state.exportSettings,
    exportCounter: state.exportCounter,
    importFileName: state.importFileName,
    sourceFiles: state.sourceFiles
  };
}

export function deserializeAnalysisState(
  payload: unknown,
  options: DeserializeAnalysisStateOptions = {}
): AnalysisState {
  const serialized = validateSerializedAnalysisState(payload);
  return {
    analysisId: options.analysisId ?? createAnalysisId(),
    analysisName: serialized.analysisName,
    dataset: serialized.dataset,
    selection: deserializeSelectionState(serialized.selection),
    searchQuery: serialized.searchQuery,
    selectionFilter: serialized.selectionFilter,
    chartScale: serialized.chartScale,
    styleRules: serialized.styleRules,
    curveOverrides: serialized.curveOverrides,
    legendSettings: serialized.legendSettings ?? createDefaultLegendSettings(),
    exportSettings: serialized.exportSettings ?? createDefaultExportSettings(),
    exportCounter: serialized.exportCounter,
    importFileName: serialized.importFileName,
    sourceFiles: serialized.sourceFiles,
    dirty: false
  };
}

export function validateSerializedAnalysisState(payload: unknown): SerializedAnalysisState {
  if (!isRecord(payload)) {
    throw new Error("Analysis state restore data must be an object.");
  }

  if (payload.schemaVersion !== ANALYSIS_STATE_SCHEMA_VERSION) {
    throw new Error("Unsupported Analysis XLSX schema version.");
  }

  const requiredKeys = [
    "analysisName",
    "dataset",
    "selection",
    "searchQuery",
    "selectionFilter",
    "chartScale",
    "styleRules",
    "curveOverrides",
    "exportCounter",
    "importFileName",
    "sourceFiles"
  ];

  requiredKeys.forEach((key) => {
    if (!(key in payload)) {
      throw new Error(`Analysis state restore data is missing ${key}.`);
    }
  });

  const migratedPayload = migrateSerializedAnalysisPayload(payload);

  assertString(migratedPayload.analysisName, "analysisName");
  assertString(migratedPayload.searchQuery, "searchQuery");
  assertStringOrNull(migratedPayload.importFileName, "importFileName");
  assertOneOf(migratedPayload.selectionFilter, selectionFilters, "selectionFilter");
  assertPositiveInteger(migratedPayload.exportCounter, "exportCounter");

  validateDataset(migratedPayload.dataset);
  const dataset = migratedPayload.dataset as PcrDataset;
  const datasetCurveIds = new Set(dataset.curves.map((curve) => curve.curveId));

  validateSelection(migratedPayload.selection, datasetCurveIds);
  validateChartScale(migratedPayload.chartScale);
  validateStyleRules(migratedPayload.styleRules);
  validateCurveOverrides(migratedPayload.curveOverrides, datasetCurveIds);
  validateLegendSettings(migratedPayload.legendSettings);
  validateExportSettings(migratedPayload.exportSettings);
  validateSourceFiles(migratedPayload.sourceFiles);

  return migratedPayload as SerializedAnalysisState;
}

function migrateSerializedAnalysisPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const styleRules = isRecord(payload.styleRules)
    ? {
        ...payload.styleRules,
        markerBy: payload.styleRules.markerBy ?? "reagent",
        specimenMarkerTypes: payload.styleRules.specimenMarkerTypes ?? {},
        reagentMarkerTypes: payload.styleRules.reagentMarkerTypes ?? {}
      }
    : payload.styleRules;

  return {
    ...payload,
    styleRules,
    legendSettings: "legendSettings" in payload ? payload.legendSettings : createDefaultLegendSettings(),
    exportSettings: "exportSettings" in payload ? payload.exportSettings : createDefaultExportSettings()
  };
}

function createAnalysisId() {
  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `analysis-${randomPart}`;
}

function validateDataset(value: unknown): asserts value is PcrDataset {
  if (!isRecord(value)) {
    throw new Error("Analysis state dataset restore data is invalid.");
  }

  if (value.schemaVersion !== 1) {
    throw new Error("Analysis state dataset schema version is invalid.");
  }

  assertString(value.datasetId, "dataset.datasetId");
  assertString(value.sourceFileName, "dataset.sourceFileName");
  assertString(value.sheetName, "dataset.sheetName");
  assertNonNegativeInteger(value.sheetIndex, "dataset.sheetIndex");
  assertString(value.importedAtIso, "dataset.importedAtIso");
  assertNonNegativeInteger(value.cycleCount, "dataset.cycleCount");

  if (!Array.isArray(value.curves)) {
    throw new Error("Analysis state dataset curves are invalid.");
  }

  const curveIds = new Set<string>();
  value.curves.forEach((curve, index) => {
    validateCurve(curve, `dataset.curves[${index}]`);
    if (curveIds.has(curve.curveId)) {
      throw new Error("Analysis state dataset curve IDs must be unique.");
    }
    curveIds.add(curve.curveId);
  });

  assertUniqueStringArray(value.orderedCurveIds, "dataset.orderedCurveIds");
  assertSameStringSet(value.orderedCurveIds, curveIds, "dataset.orderedCurveIds");

  validateEntities(value.specimens, curveIds, "dataset.specimens");
  validateEntities(value.reagents, curveIds, "dataset.reagents");
  validateWarnings(value.warnings, "dataset.warnings");
}

function validateCurve(value: unknown, path: string): asserts value is Curve {
  if (!isRecord(value)) {
    throw new Error(`${path} is invalid.`);
  }

  assertString(value.curveId, `${path}.curveId`);
  assertString(value.sourceId, `${path}.sourceId`);
  assertString(value.specimenId, `${path}.specimenId`);
  assertString(value.reagentId, `${path}.reagentId`);
  assertString(value.specimenLabel, `${path}.specimenLabel`);
  assertString(value.reagentLabel, `${path}.reagentLabel`);
  assertString(value.displayLabel, `${path}.displayLabel`);
  validateNumberArray(value.x, `${path}.x`);
  validateNullableNumberArray(value.y, `${path}.y`);

  if (Array.isArray(value.x) && Array.isArray(value.y) && value.x.length !== value.y.length) {
    throw new Error(`${path}.x and ${path}.y must have the same length.`);
  }

  validateCurveSource(value.source, `${path}.source`);
  validateCurveStats(value.stats, `${path}.stats`);
  validateWarnings(value.warnings, `${path}.warnings`);
}

function validateCurveSource(value: unknown, path: string): asserts value is CurveSource {
  if (!isRecord(value)) {
    throw new Error(`${path} is invalid.`);
  }

  assertString(value.fileName, `${path}.fileName`);
  assertString(value.sheetName, `${path}.sheetName`);
  assertNonNegativeInteger(value.sheetIndex, `${path}.sheetIndex`);
  assertNonNegativeInteger(value.columnIndex, `${path}.columnIndex`);
  assertString(value.columnLetter, `${path}.columnLetter`);
  assertString(value.specimenCell, `${path}.specimenCell`);
  assertString(value.reagentCell, `${path}.reagentCell`);
  assertString(value.dataStartCell, `${path}.dataStartCell`);
  assertString(value.dataEndCell, `${path}.dataEndCell`);
}

function validateCurveStats(value: unknown, path: string): asserts value is CurveStats {
  if (!isRecord(value)) {
    throw new Error(`${path} is invalid.`);
  }

  assertNonNegativeInteger(value.pointCount, `${path}.pointCount`);
  assertNonNegativeInteger(value.missingCount, `${path}.missingCount`);
  assertFiniteNumberOrNull(value.minY, `${path}.minY`);
  assertFiniteNumberOrNull(value.maxY, `${path}.maxY`);
}

function validateEntities(value: unknown, curveIds: Set<string>, path: string): asserts value is PcrEntity[] {
  if (!Array.isArray(value)) {
    throw new Error(`${path} is invalid.`);
  }

  value.forEach((entity, index) => {
    const entityPath = `${path}[${index}]`;
    if (!isRecord(entity)) {
      throw new Error(`${entityPath} is invalid.`);
    }

    assertString(entity.id, `${entityPath}.id`);
    assertString(entity.label, `${entityPath}.label`);
    assertUniqueStringArray(entity.curveIds, `${entityPath}.curveIds`);
    entity.curveIds.forEach((curveId) => {
      if (!curveIds.has(curveId)) {
        throw new Error(`${entityPath}.curveIds contains an unknown curveId.`);
      }
    });
    validateWarnings(entity.warnings, `${entityPath}.warnings`);
  });
}

function validateWarnings(value: unknown, path: string): asserts value is PcrWarning[] {
  if (!Array.isArray(value)) {
    throw new Error(`${path} is invalid.`);
  }

  value.forEach((warning, index) => {
    const warningPath = `${path}[${index}]`;
    if (!isRecord(warning)) {
      throw new Error(`${warningPath} is invalid.`);
    }

    assertString(warning.code, `${warningPath}.code`);
    assertOneOf(warning.severity, warningSeverities, `${warningPath}.severity`);
    assertOneOf(warning.scope, warningScopes, `${warningPath}.scope`);
    assertString(warning.message, `${warningPath}.message`);
    assertOptionalStringArray(warning.curveIds, `${warningPath}.curveIds`);
    assertOptionalStringArray(warning.labels, `${warningPath}.labels`);
    assertOptionalString(warning.sourceCell, `${warningPath}.sourceCell`);
    assertOptionalString(warning.sourceRange, `${warningPath}.sourceRange`);
    assertOptionalString(warning.sheetName, `${warningPath}.sheetName`);
    assertOptionalString(warning.columnLetter, `${warningPath}.columnLetter`);
  });
}

function validateSelection(value: unknown, datasetCurveIds: Set<string>): asserts value is SerializedSelectionState {
  if (!isRecord(value)) {
    throw new Error("Analysis state selection restore data is invalid.");
  }

  assertOneOf(value.groupingMode, groupingModes, "selection.groupingMode");
  assertUniqueStringArray(value.selectedCurveIds, "selection.selectedCurveIds");
  assertUniqueStringArray(value.collapsedGroupIds, "selection.collapsedGroupIds");
  assertUniqueStringArray(value.orderedCurveIds, "selection.orderedCurveIds");
  assertSameStringSet(value.orderedCurveIds, datasetCurveIds, "selection.orderedCurveIds");

  value.selectedCurveIds.forEach((curveId) => {
    if (!datasetCurveIds.has(curveId)) {
      throw new Error("selection.selectedCurveIds contains an unknown curveId.");
    }
  });
}

function validateChartScale(value: unknown): asserts value is ChartScaleState {
  if (!isRecord(value)) {
    throw new Error("Analysis state chartScale restore data is invalid.");
  }

  validateAxisScale(value.x, "chartScale.x");
  validateAxisScale(value.y, "chartScale.y");
}

function validateAxisScale(value: unknown, path: string) {
  if (!isRecord(value)) {
    throw new Error(`${path} is invalid.`);
  }

  assertOneOf(value.mode, scaleModes, `${path}.mode`);
  assertString(value.fixedMin, `${path}.fixedMin`);
  assertString(value.fixedMax, `${path}.fixedMax`);
  validateScalePreset(value.preset1, `${path}.preset1`);
  validateScalePreset(value.preset2, `${path}.preset2`);
}

function validateScalePreset(value: unknown, path: string) {
  if (value === null) return;
  if (!isRecord(value)) {
    throw new Error(`${path} is invalid.`);
  }

  assertString(value.label, `${path}.label`);
  assertString(value.min, `${path}.min`);
  assertString(value.max, `${path}.max`);
}

function validateStyleRules(value: unknown): asserts value is StyleRules {
  if (!isRecord(value)) {
    throw new Error("Analysis state styleRules restore data is invalid.");
  }

  assertOneOf(value.colorBy, styleGroupingTargets, "styleRules.colorBy");
  assertOneOf(value.lineTypeBy, styleGroupingTargets, "styleRules.lineTypeBy");
  assertOneOf(value.markerBy, styleGroupingTargets, "styleRules.markerBy");
  validateStringRecord(value.specimenColors, "styleRules.specimenColors");
  validateStringRecord(value.reagentColors, "styleRules.reagentColors");
  validateLineTypeRecord(value.specimenLineTypes, "styleRules.specimenLineTypes");
  validateLineTypeRecord(value.reagentLineTypes, "styleRules.reagentLineTypes");
  validateMarkerTypeRecord(value.specimenMarkerTypes, "styleRules.specimenMarkerTypes");
  validateMarkerTypeRecord(value.reagentMarkerTypes, "styleRules.reagentMarkerTypes");
}

function validateLegendSettings(value: unknown): asserts value is LegendSettings {
  if (!isRecord(value)) {
    throw new Error("Analysis state legendSettings restore data is invalid.");
  }
  assertBoolean(value.previewVisible, "legendSettings.previewVisible");
}

function validateExportSettings(value: unknown): asserts value is ExportSettings {
  if (!isRecord(value)) {
    throw new Error("Analysis state exportSettings restore data is invalid.");
  }
  assertOneOf(value.imageLayout, imageExportLayouts, "exportSettings.imageLayout");
}

function validateCurveOverrides(value: unknown, datasetCurveIds: Set<string>): asserts value is Record<string, CurveStyleOverride> {
  if (!isRecord(value)) {
    throw new Error("Analysis state curveOverrides restore data is invalid.");
  }

  Object.entries(value).forEach(([curveId, override]) => {
    if (!datasetCurveIds.has(curveId)) {
      throw new Error("Analysis state curveOverrides contains an unknown curveId.");
    }
    if (!isRecord(override)) {
      throw new Error(`curveOverrides.${curveId} is invalid.`);
    }
    assertOptionalString(override.displayName, `curveOverrides.${curveId}.displayName`);
    assertOptionalString(override.color, `curveOverrides.${curveId}.color`);
    assertOptionalOneOf(override.lineType, lineTypes, `curveOverrides.${curveId}.lineType`);
    assertOptionalOneOf(override.markerType, markerTypes, `curveOverrides.${curveId}.markerType`);
    assertOptionalFiniteNumber(override.lineWidth, `curveOverrides.${curveId}.lineWidth`);
    assertOptionalBoolean(override.visible, `curveOverrides.${curveId}.visible`);
    assertOptionalOneOf(override.source, overrideSources, `curveOverrides.${curveId}.source`);
    validateOverrideFieldSources(override.fieldSources, `curveOverrides.${curveId}.fieldSources`);
  });
}

function validateOverrideFieldSources(value: unknown, path: string) {
  if (value === undefined) return;
  if (!isRecord(value)) {
    throw new Error(`${path} is invalid.`);
  }

  Object.entries(value).forEach(([key, entryValue]) => {
    assertOneOf(key, curveStyleFields, `${path}.${key}`);
    assertOneOf(entryValue, overrideSources, `${path}.${key}`);
  });
}

function validateSourceFiles(value: unknown): asserts value is SourceFileSummary[] {
  if (!Array.isArray(value)) {
    throw new Error("Analysis state source file restore data is invalid.");
  }

  value.forEach((sourceFile, index) => {
    const path = `sourceFiles[${index}]`;
    if (!isRecord(sourceFile)) {
      throw new Error(`${path} is invalid.`);
    }
    assertString(sourceFile.fileName, `${path}.fileName`);
    assertString(sourceFile.sheetName, `${path}.sheetName`);
    assertNonNegativeInteger(sourceFile.sheetIndex, `${path}.sheetIndex`);
    assertString(sourceFile.importedAtIso, `${path}.importedAtIso`);
    assertNonNegativeInteger(sourceFile.curveCount, `${path}.curveCount`);
  });
}

function validateNumberArray(value: unknown, path: string): asserts value is number[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "number" && Number.isFinite(item))) {
    throw new Error(`${path} must contain finite numbers.`);
  }
}

function validateNullableNumberArray(value: unknown, path: string): asserts value is Array<number | null> {
  if (
    !Array.isArray(value) ||
    !value.every((item) => item === null || (typeof item === "number" && Number.isFinite(item)))
  ) {
    throw new Error(`${path} must contain finite numbers or null values.`);
  }
}

function validateStringRecord(value: unknown, path: string): asserts value is Record<string, string> {
  if (!isRecord(value)) {
    throw new Error(`${path} is invalid.`);
  }

  Object.entries(value).forEach(([key, entryValue]) => {
    if (typeof entryValue !== "string") {
      throw new Error(`${path}.${key} must be a string.`);
    }
  });
}

function validateLineTypeRecord(value: unknown, path: string): asserts value is Record<string, LineType> {
  if (!isRecord(value)) {
    throw new Error(`${path} is invalid.`);
  }

  Object.entries(value).forEach(([key, entryValue]) => {
    assertOneOf(entryValue, lineTypes, `${path}.${key}`);
  });
}

function validateMarkerTypeRecord(value: unknown, path: string): asserts value is Record<string, MarkerType> {
  if (!isRecord(value)) {
    throw new Error(`${path} is invalid.`);
  }

  Object.entries(value).forEach(([key, entryValue]) => {
    assertOneOf(entryValue, markerTypes, `${path}.${key}`);
  });
}

function assertUniqueStringArray(value: unknown, path: string): asserts value is string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error(`${path} must be a string array.`);
  }

  if (new Set(value).size !== value.length) {
    throw new Error(`${path} must not contain duplicates.`);
  }
}

function assertOptionalStringArray(value: unknown, path: string) {
  if (value === undefined) return;
  assertUniqueStringArray(value, path);
}

function assertSameStringSet(value: string[], expected: Set<string>, path: string) {
  if (value.length !== expected.size || value.some((item) => !expected.has(item))) {
    throw new Error(`${path} must match dataset curve IDs.`);
  }
}

function assertString(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string") {
    throw new Error(`${path} must be a string.`);
  }
}

function assertStringOrNull(value: unknown, path: string): asserts value is string | null {
  if (value !== null && typeof value !== "string") {
    throw new Error(`${path} must be a string or null.`);
  }
}

function assertOptionalString(value: unknown, path: string) {
  if (value !== undefined && typeof value !== "string") {
    throw new Error(`${path} must be a string.`);
  }
}

function assertPositiveInteger(value: unknown, path: string): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error(`${path} must be a positive integer.`);
  }
}

function assertNonNegativeInteger(value: unknown, path: string): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`${path} must be a non-negative integer.`);
  }
}

function assertFiniteNumberOrNull(value: unknown, path: string): asserts value is number | null {
  if (value !== null && (typeof value !== "number" || !Number.isFinite(value))) {
    throw new Error(`${path} must be a finite number or null.`);
  }
}

function assertOptionalFiniteNumber(value: unknown, path: string) {
  if (value !== undefined && (typeof value !== "number" || !Number.isFinite(value))) {
    throw new Error(`${path} must be a finite number.`);
  }
}

function assertOptionalBoolean(value: unknown, path: string) {
  if (value !== undefined && typeof value !== "boolean") {
    throw new Error(`${path} must be a boolean.`);
  }
}

function assertBoolean(value: unknown, path: string): asserts value is boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${path} must be a boolean.`);
  }
}

function assertOneOf<T extends string>(value: unknown, options: readonly T[], path: string): asserts value is T {
  if (typeof value !== "string" || !options.includes(value as T)) {
    throw new Error(`${path} is invalid.`);
  }
}

function assertOptionalOneOf<T extends string>(value: unknown, options: readonly T[], path: string) {
  if (value !== undefined) {
    assertOneOf(value, options, path);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
