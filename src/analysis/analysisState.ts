import { getAppliedAxisScaleForDraft, type AxisScaleState, type ChartScaleState } from "../chart/chartScale";
import type {
  Curve,
  CurveSource,
  CurveStats,
  CurveStyleOverride,
  DatasetSourceKind,
  ExportSettings,
  LegendSettings,
  LineType,
  MarkerType,
  PcrDataset,
  PcrEntity,
  PcrWarning,
  SelectionFilter,
  SelectionSet,
  SelectionState,
  StyleRules
} from "../data/types";
import { inferWarningHandling } from "../data/warningProvenance";

export const ANALYSIS_STATE_SCHEMA_VERSION = 4;
const LEGACY_ANALYSIS_STATE_SCHEMA_VERSION = 1;
const PREVIOUS_ANALYSIS_STATE_SCHEMA_VERSION = 2;
const PREVIOUS_ANALYSIS_STATE_SCHEMA_VERSION_3 = 3;

export type SourceFileSummary = {
  sourceKind?: DatasetSourceKind;
  sourceInstanceId?: string;
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
  selectionSets: SelectionSet[];
  activeSelectionSetId: string | null;
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

export type CreateAnalysisStateInput = Omit<
  AnalysisState,
  "sourceFiles" | "dirty" | "legendSettings" | "exportSettings" | "selectionSets" | "activeSelectionSetId"
> & {
  legendSettings?: LegendSettings;
  exportSettings?: ExportSettings;
  selectionSets?: SelectionSet[];
  activeSelectionSetId?: string | null;
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
const reportLegendLabelModes = ["autoCompact", "full"] as const;
const overrideSources = ["custom", "preset"] as const;
const curveStyleFields = ["displayName", "color", "lineType", "markerType", "lineWidth", "visible"] as const;
const warningSeverities = ["info", "warning", "error"] as const;
const warningScopes = ["import", "dataset", "header", "curve", "cell", "export"] as const;
const warningHandlings = ["kept", "null-gap", "ignored", "blocked"] as const;
const formulaCacheStatuses = ["not-formula", "used", "missing"] as const;
const importedSourceKinds = ["excel", "paste"] as const;
const datasetSourceKinds = ["excel", "paste", "mixed"] as const;
const pasteInputModes = ["fullTable", "singleSpecimen"] as const;

export function createAnalysisState(input: CreateAnalysisStateInput): AnalysisState {
  const legendSettings = input.legendSettings ?? createDefaultLegendSettings();
  const curveOverrides = promoteReportNamesToAnalysisLabels(input.curveOverrides, legendSettings);
  return {
    ...input,
    selectionSets: input.selectionSets ?? [],
    activeSelectionSetId: input.activeSelectionSetId ?? null,
    curveOverrides,
    legendSettings: {
      ...legendSettings,
      reportNameOverrides: {}
    },
    exportSettings: input.exportSettings ?? createDefaultExportSettings(),
    sourceFiles: input.sourceFiles ?? [createSourceFileSummary(input.dataset)],
    dirty: input.dirty ?? false
  };
}

export function createDefaultLegendSettings(): LegendSettings {
  return {
    previewVisible: true,
    reportLabelMode: "autoCompact",
    reportNameOverrides: {}
  };
}

export function createDefaultExportSettings(): ExportSettings {
  return {
    imageLayout: "plotOnly"
  };
}

export function createSourceFileSummary(dataset: PcrDataset): SourceFileSummary {
  const sourceInstanceIds = new Set(dataset.curves.map((curve) => curve.source.sourceInstanceId).filter(Boolean));
  return {
    sourceKind: dataset.sourceKind ?? "excel",
    sourceInstanceId: sourceInstanceIds.size === 1 ? [...sourceInstanceIds][0] : `dataset:${dataset.datasetId}`,
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
    selectionSets: state.selectionSets.map((selectionSet) => ({ ...selectionSet, curveIds: [...selectionSet.curveIds] })),
    activeSelectionSetId: state.activeSelectionSetId,
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
  const curveOverrides = promoteReportNamesToAnalysisLabels(serialized.curveOverrides, serialized.legendSettings ?? createDefaultLegendSettings());
  return {
    analysisId: options.analysisId ?? createAnalysisId(),
    analysisName: serialized.analysisName,
    dataset: serialized.dataset,
    selection: deserializeSelectionState(serialized.selection),
    selectionSets: serialized.selectionSets.map((selectionSet) => ({ ...selectionSet, curveIds: [...selectionSet.curveIds] })),
    activeSelectionSetId: serialized.activeSelectionSetId,
    searchQuery: serialized.searchQuery,
    selectionFilter: serialized.selectionFilter,
    chartScale: serialized.chartScale,
    styleRules: serialized.styleRules,
    curveOverrides,
    legendSettings: {
      ...(serialized.legendSettings ?? createDefaultLegendSettings()),
      reportNameOverrides: {}
    },
    exportSettings: serialized.exportSettings ?? createDefaultExportSettings(),
    exportCounter: serialized.exportCounter,
    importFileName: serialized.importFileName,
    sourceFiles: serialized.sourceFiles,
    dirty: false
  };
}

function promoteReportNamesToAnalysisLabels(
  curveOverrides: Record<string, CurveStyleOverride>,
  legendSettings: LegendSettings
) {
  const reportNameEntries = Object.entries(legendSettings.reportNameOverrides ?? {});
  if (reportNameEntries.length === 0) return curveOverrides;

  const nextOverrides: Record<string, CurveStyleOverride> = { ...curveOverrides };
  reportNameEntries.forEach(([curveId, label]) => {
    const trimmedLabel = label.trim();
    if (!trimmedLabel) return;
    const previousOverride = nextOverrides[curveId];
    if (previousOverride?.displayName) return;
    nextOverrides[curveId] = {
      ...previousOverride,
      displayName: label,
      source: previousOverride?.source ?? "custom",
      fieldSources: {
        ...previousOverride?.fieldSources,
        displayName: "custom"
      }
    };
  });

  return nextOverrides;
}

export function validateSerializedAnalysisState(payload: unknown): SerializedAnalysisState {
  if (!isRecord(payload)) {
    throw new Error("Analysis state restore data must be an object.");
  }

  if (
    payload.schemaVersion !== LEGACY_ANALYSIS_STATE_SCHEMA_VERSION &&
    payload.schemaVersion !== PREVIOUS_ANALYSIS_STATE_SCHEMA_VERSION &&
    payload.schemaVersion !== PREVIOUS_ANALYSIS_STATE_SCHEMA_VERSION_3 &&
    payload.schemaVersion !== ANALYSIS_STATE_SCHEMA_VERSION
  ) {
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

  if (payload.schemaVersion === ANALYSIS_STATE_SCHEMA_VERSION) {
    ["selectionSets", "activeSelectionSetId"].forEach((key) => {
      if (!(key in payload)) {
        throw new Error(`Analysis state restore data is missing ${key}.`);
      }
    });
  }

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
  validateSelectionSets(
    migratedPayload.selectionSets,
    migratedPayload.activeSelectionSetId,
    datasetCurveIds
  );
  validateChartScale(migratedPayload.chartScale);
  validateStyleRules(migratedPayload.styleRules);
  validateCurveOverrides(migratedPayload.curveOverrides, datasetCurveIds);
  validateLegendSettings(migratedPayload.legendSettings, datasetCurveIds);
  validateExportSettings(migratedPayload.exportSettings);
  validateSourceFiles(migratedPayload.sourceFiles);
  validateDatasetRelationships(dataset);
  validateSourceFileRelationships(
    dataset,
    migratedPayload.sourceFiles as SourceFileSummary[],
    payload.schemaVersion === PREVIOUS_ANALYSIS_STATE_SCHEMA_VERSION_3 || payload.schemaVersion === ANALYSIS_STATE_SCHEMA_VERSION
  );
  validatePersistedReferences(
    dataset,
    migratedPayload.selection as SerializedSelectionState,
    migratedPayload.styleRules as StyleRules
  );

  return migratedPayload as SerializedAnalysisState;
}

function migrateSerializedAnalysisPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const isLegacySchema = payload.schemaVersion === LEGACY_ANALYSIS_STATE_SCHEMA_VERSION;
  const hasSelectionSetSchema = payload.schemaVersion === ANALYSIS_STATE_SCHEMA_VERSION;
  const needsProvenanceMigration =
    payload.schemaVersion === LEGACY_ANALYSIS_STATE_SCHEMA_VERSION ||
    payload.schemaVersion === PREVIOUS_ANALYSIS_STATE_SCHEMA_VERSION;
  const styleRules = isRecord(payload.styleRules)
    ? {
        ...payload.styleRules,
        markerBy: payload.styleRules.markerBy ?? "reagent",
        specimenMarkerTypes: payload.styleRules.specimenMarkerTypes ?? {},
        reagentMarkerTypes: payload.styleRules.reagentMarkerTypes ?? {}
      }
    : payload.styleRules;
  const sourceFiles = needsProvenanceMigration ? migrateSourceFileProvenance(payload.sourceFiles) : payload.sourceFiles;
  const dataset = needsProvenanceMigration
    ? migrateDatasetProvenance(payload.dataset, sourceFiles)
    : payload.dataset;

  return {
    ...payload,
    schemaVersion: ANALYSIS_STATE_SCHEMA_VERSION,
    chartScale: isLegacySchema ? migrateChartScale(payload.chartScale) : payload.chartScale,
    dataset,
    sourceFiles,
    styleRules,
    selectionSets: hasSelectionSetSchema ? payload.selectionSets : [],
    activeSelectionSetId: hasSelectionSetSchema ? payload.activeSelectionSetId : null,
    legendSettings:
      "legendSettings" in payload && isRecord(payload.legendSettings)
        ? {
            ...createDefaultLegendSettings(),
            ...payload.legendSettings,
            reportNameOverrides: isRecord(payload.legendSettings.reportNameOverrides)
              ? payload.legendSettings.reportNameOverrides
              : {}
          }
        : createDefaultLegendSettings(),
    exportSettings: "exportSettings" in payload ? payload.exportSettings : createDefaultExportSettings()
  };
}

function migrateChartScale(value: unknown): unknown {
  if (!isRecord(value)) return value;
  return {
    ...value,
    x: migrateAxisScale(value.x),
    y: migrateAxisScale(value.y)
  };
}

function migrateAxisScale(value: unknown): unknown {
  if (!isRecord(value) || isRecord(value.applied)) return value;
  const mode = value.mode;
  let applied: Record<string, unknown> = { mode: "auto", min: null, max: null };
  if (mode === "fixed" || mode === "preset1" || mode === "preset2") {
    const source =
      mode === "fixed"
        ? { min: value.fixedMin, max: value.fixedMax }
        : isRecord(value[mode])
          ? value[mode]
          : null;
    const min = source && typeof source.min === "string" && source.min.trim() !== "" ? Number(source.min) : NaN;
    const max = source && typeof source.max === "string" && source.max.trim() !== "" ? Number(source.max) : NaN;
    if (Number.isFinite(min) && Number.isFinite(max) && min < max) applied = { mode, min, max };
  }
  return { ...value, applied };
}

function migrateDatasetProvenance(value: unknown, sourceFiles: unknown): unknown {
  if (!isRecord(value)) return value;
  const sourcedCurves = Array.isArray(value.curves)
    ? value.curves.map((curve) => migrateCurveProvenance(curve, sourceFiles))
    : value.curves;
  const curves = Array.isArray(sourcedCurves)
    ? sourcedCurves.map((curve) =>
        isRecord(curve) ? { ...curve, warnings: migrateWarnings(curve.warnings, sourcedCurves) } : curve
      )
    : sourcedCurves;
  const curveSourceKinds = Array.isArray(curves)
    ? curves
        .map((curve) =>
          isRecord(curve) && isRecord(curve.source) && typeof curve.source.sourceKind === "string"
            ? curve.source.sourceKind
            : null
        )
        .filter((sourceKind): sourceKind is string => Boolean(sourceKind))
    : [];
  const inferredSourceKind = new Set(curveSourceKinds).size > 1 ? "mixed" : curveSourceKinds[0] ?? "excel";

  return {
    ...value,
    schemaVersion: 2,
    sourceKind: "sourceKind" in value ? value.sourceKind : inferredSourceKind,
    curves,
    warnings: migrateWarnings(value.warnings, Array.isArray(curves) ? curves : []),
    specimens: migrateEntityWarnings(value.specimens, Array.isArray(curves) ? curves : []),
    reagents: migrateEntityWarnings(value.reagents, Array.isArray(curves) ? curves : [])
  };
}

function migrateCurveProvenance(value: unknown, sourceFiles: unknown): unknown {
  if (!isRecord(value) || !isRecord(value.source)) return value;
  const source = value.source;
  const sourceKind = "sourceKind" in source ? source.sourceKind : "excel";
  const fileName = typeof source.fileName === "string" ? source.fileName : "unknown";
  const sheetName = typeof source.sheetName === "string" ? source.sheetName : "unknown";
  const sheetIndex = typeof source.sheetIndex === "number" ? source.sheetIndex : 0;
  const importIndex = getLegacyCurveImportIndex(value.curveId);
  const sourceFile = Array.isArray(sourceFiles) && isRecord(sourceFiles[importIndex]) ? sourceFiles[importIndex] : undefined;
  const migratedSourceInstanceId =
    sourceFile && typeof sourceFile.sourceInstanceId === "string"
      ? sourceFile.sourceInstanceId
      : `legacy:${sourceKind}:${importIndex + 1}:${fileName}#${sheetIndex}:${sheetName}`;

  return {
    ...value,
    source: {
      ...source,
      sourceKind,
      sourceInstanceId:
        typeof source.sourceInstanceId === "string" && source.sourceInstanceId
          ? source.sourceInstanceId
          : migratedSourceInstanceId,
      specimenHeader:
        sourceKind === "excel"
          ? migrateHeaderProvenance(source.specimenHeader, value.specimenLabel)
          : source.specimenHeader,
      reagentHeader:
        sourceKind === "excel"
          ? migrateHeaderProvenance(source.reagentHeader, value.reagentLabel)
          : source.reagentHeader
    }
  };
}

function getLegacyCurveImportIndex(curveId: unknown) {
  if (typeof curveId !== "string") return 0;
  const fileNumber = Number(curveId.match(/^file(\d+)_/u)?.[1]);
  return Number.isInteger(fileNumber) && fileNumber >= 2 ? fileNumber - 1 : 0;
}

function migrateHeaderProvenance(value: unknown, fallbackLabel: unknown) {
  if (isRecord(value)) return value;
  const displayValue = typeof fallbackLabel === "string" ? fallbackLabel : "";
  return {
    rawValue: displayValue,
    displayValue,
    cellType: "legacy",
    formulaCacheStatus: "not-formula"
  };
}

function migrateEntityWarnings(value: unknown, curves: unknown[]) {
  if (!Array.isArray(value)) return value;
  return value.map((entity) =>
    isRecord(entity) ? { ...entity, warnings: migrateWarnings(entity.warnings, curves) } : entity
  );
}

function migrateWarnings(value: unknown, curves: unknown[]) {
  if (!Array.isArray(value)) return value;
  const migratedSourceIds = new Set(
    curves
      .map((curve) =>
        isRecord(curve) && isRecord(curve.source) && typeof curve.source.sourceInstanceId === "string"
          ? curve.source.sourceInstanceId
          : null
      )
      .filter((sourceId): sourceId is string => sourceId !== null)
  );
  return value.map((warning) => {
    if (!isRecord(warning)) return warning;
    const persistedSourceRefsRemainValid =
      Array.isArray(warning.sourceRefs) &&
      warning.sourceRefs.length > 0 &&
      warning.sourceRefs.every(
        (sourceRef) =>
          isRecord(sourceRef) &&
          typeof sourceRef.sourceInstanceId === "string" &&
          migratedSourceIds.has(sourceRef.sourceInstanceId)
      );
    const sourceRefs = persistedSourceRefsRemainValid
      ? warning.sourceRefs
      : createLegacyWarningSourceRefs(warning, curves);
    return {
      ...warning,
      handling:
        typeof warning.handling === "string"
          ? warning.handling
          : inferWarningHandling(String(warning.code) as PcrWarning["code"]),
      sourceRefs
    };
  });
}

function createLegacyWarningSourceRefs(warning: Record<string, unknown>, curves: unknown[]) {
  const curveIds = Array.isArray(warning.curveIds)
    ? new Set(warning.curveIds.filter((curveId): curveId is string => typeof curveId === "string"))
    : new Set<string>();
  const matchingCurves = curves.filter(
    (curve) =>
      isRecord(curve) &&
      isRecord(curve.source) &&
      (curveIds.size === 0 || (typeof curve.curveId === "string" && curveIds.has(curve.curveId)))
  );
  const locatedCurves = matchingCurves.length > 0 ? matchingCurves : curves.filter((curve) => isRecord(curve) && isRecord(curve.source)).slice(0, 1);
  return locatedCurves.map((curve) => {
    const source = (curve as Record<string, unknown>).source as Record<string, unknown>;
    const sourceCell = typeof warning.sourceCell === "string" ? warning.sourceCell : undefined;
    const header =
      sourceCell === source.specimenCell && isRecord(source.specimenHeader)
        ? source.specimenHeader
        : sourceCell === source.reagentCell && isRecord(source.reagentHeader)
          ? source.reagentHeader
          : undefined;
    return {
      sourceInstanceId: typeof source.sourceInstanceId === "string" ? source.sourceInstanceId : undefined,
      sourceName: typeof source.fileName === "string" ? source.fileName : "unknown",
      sourceKind: source.sourceKind,
      worksheet: typeof warning.sheetName === "string" ? warning.sheetName : source.sheetName,
      cell: sourceCell,
      range: typeof warning.sourceRange === "string" ? warning.sourceRange : undefined,
      columnLetter: typeof warning.columnLetter === "string" ? warning.columnLetter : source.columnLetter,
      rawValue: header?.rawValue ?? toPortableProvenanceValue(warning.rawValue),
      displayValue: header?.displayValue,
      cellType: header?.cellType,
      numberFormat: header?.numberFormat,
      formulaText: header?.formulaText,
      formulaCacheStatus: header?.formulaCacheStatus
    };
  });
}

function toPortableProvenanceValue(value: unknown) {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return value === undefined ? undefined : String(value);
}

function migrateSourceFileProvenance(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((sourceFile, index) => {
    if (!isRecord(sourceFile)) return sourceFile;
    const sourceKind = "sourceKind" in sourceFile ? sourceFile.sourceKind : "excel";
    const fileName = typeof sourceFile.fileName === "string" ? sourceFile.fileName : "unknown";
    const sheetName = typeof sourceFile.sheetName === "string" ? sourceFile.sheetName : "unknown";
    const sheetIndex = typeof sourceFile.sheetIndex === "number" ? sourceFile.sheetIndex : 0;
    return {
      ...sourceFile,
      sourceKind,
      sourceInstanceId:
        typeof sourceFile.sourceInstanceId === "string" && sourceFile.sourceInstanceId
          ? sourceFile.sourceInstanceId
          : `legacy:${sourceKind}:${index + 1}:${fileName}#${sheetIndex}:${sheetName}`
    };
  });
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

  if (value.schemaVersion !== 2) {
    throw new Error("Analysis state dataset schema version is invalid.");
  }

  assertString(value.datasetId, "dataset.datasetId");
  assertOneOf(value.sourceKind, datasetSourceKinds, "dataset.sourceKind");
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
  assertOneOf(value.sourceKind, importedSourceKinds, `${path}.sourceKind`);
  assertNonBlankString(value.sourceInstanceId, `${path}.sourceInstanceId`);
  assertOptionalOneOf(value.inputMode, pasteInputModes, `${path}.inputMode`);
  assertString(value.sheetName, `${path}.sheetName`);
  assertNonNegativeInteger(value.sheetIndex, `${path}.sheetIndex`);
  assertNonNegativeInteger(value.columnIndex, `${path}.columnIndex`);
  assertString(value.columnLetter, `${path}.columnLetter`);
  assertString(value.specimenCell, `${path}.specimenCell`);
  assertString(value.reagentCell, `${path}.reagentCell`);
  assertString(value.dataStartCell, `${path}.dataStartCell`);
  assertString(value.dataEndCell, `${path}.dataEndCell`);
  if (value.sourceKind === "excel") {
    validateCellProvenance(value.specimenHeader, `${path}.specimenHeader`);
    validateCellProvenance(value.reagentHeader, `${path}.reagentHeader`);
  }
}

function validateCellProvenance(value: unknown, path: string) {
  if (!isRecord(value)) throw new Error(`${path} is invalid.`);
  assertOptionalPortableValue(value.rawValue, `${path}.rawValue`);
  assertString(value.displayValue, `${path}.displayValue`);
  assertOptionalString(value.cellType, `${path}.cellType`);
  assertOptionalString(value.numberFormat, `${path}.numberFormat`);
  assertOptionalString(value.formulaText, `${path}.formulaText`);
  assertOptionalOneOf(value.formulaCacheStatus, formulaCacheStatuses, `${path}.formulaCacheStatus`);
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
    assertOneOf(warning.handling, warningHandlings, `${warningPath}.handling`);
    validateWarningSourceRefs(warning.sourceRefs, `${warningPath}.sourceRefs`);
  });
}

function validateWarningSourceRefs(value: unknown, path: string) {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${path} is invalid.`);
  value.forEach((sourceRef, index) => {
    const sourcePath = `${path}[${index}]`;
    if (!isRecord(sourceRef)) throw new Error(`${sourcePath} is invalid.`);
    assertNonBlankString(sourceRef.sourceInstanceId, `${sourcePath}.sourceInstanceId`);
    assertString(sourceRef.sourceName, `${sourcePath}.sourceName`);
    assertOneOf(sourceRef.sourceKind, importedSourceKinds, `${sourcePath}.sourceKind`);
    assertOptionalString(sourceRef.worksheet, `${sourcePath}.worksheet`);
    assertOptionalString(sourceRef.cell, `${sourcePath}.cell`);
    assertOptionalString(sourceRef.range, `${sourcePath}.range`);
    assertOptionalString(sourceRef.columnLetter, `${sourcePath}.columnLetter`);
    assertOptionalPortableValue(sourceRef.rawValue, `${sourcePath}.rawValue`);
    assertOptionalString(sourceRef.displayValue, `${sourcePath}.displayValue`);
    assertOptionalString(sourceRef.cellType, `${sourcePath}.cellType`);
    assertOptionalString(sourceRef.numberFormat, `${sourcePath}.numberFormat`);
    assertOptionalString(sourceRef.formulaText, `${sourcePath}.formulaText`);
    assertOptionalOneOf(sourceRef.formulaCacheStatus, formulaCacheStatuses, `${sourcePath}.formulaCacheStatus`);
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

function validateSelectionSets(
  value: unknown,
  activeSelectionSetId: unknown,
  datasetCurveIds: Set<string>
): asserts value is SelectionSet[] {
  if (!Array.isArray(value)) throw new Error("selectionSets must be an array.");

  const selectionSetIds = new Set<string>();
  const normalizedNames = new Set<string>();
  value.forEach((selectionSet, index) => {
    const path = `selectionSets[${index}]`;
    if (!isRecord(selectionSet)) throw new Error(`${path} is invalid.`);
    assertNonBlankString(selectionSet.selectionSetId, `${path}.selectionSetId`);
    assertNonBlankString(selectionSet.name, `${path}.name`);
    assertUniqueStringArray(selectionSet.curveIds, `${path}.curveIds`);
    if (selectionSet.curveIds.length === 0) throw new Error(`${path}.curveIds must not be empty.`);
    if (selectionSetIds.has(selectionSet.selectionSetId)) throw new Error("selectionSets contains duplicate IDs.");
    selectionSetIds.add(selectionSet.selectionSetId);

    const normalizedName = selectionSet.name.trim().toLocaleLowerCase();
    if (normalizedNames.has(normalizedName)) throw new Error("selectionSets contains duplicate names.");
    normalizedNames.add(normalizedName);

    selectionSet.curveIds.forEach((curveId) => {
      if (!datasetCurveIds.has(curveId)) throw new Error(`${path}.curveIds contains an unknown curveId.`);
    });
  });

  if (activeSelectionSetId !== null && typeof activeSelectionSetId !== "string") {
    throw new Error("activeSelectionSetId must be a string or null.");
  }
  if (typeof activeSelectionSetId === "string" && !selectionSetIds.has(activeSelectionSetId)) {
    throw new Error("activeSelectionSetId references an unknown selection set.");
  }
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
  validateAppliedAxisScale(value.applied, `${path}.applied`);

  const expectedApplied = getAppliedAxisScaleForDraft(value as AxisScaleState);
  if (expectedApplied && !sameAppliedAxisScale(expectedApplied, value.applied)) {
    throw new Error(`${path}.applied does not match the valid active scale draft.`);
  }
}

function validateAppliedAxisScale(value: unknown, path: string) {
  if (!isRecord(value)) throw new Error(`${path} is invalid.`);
  assertOneOf(value.mode, scaleModes, `${path}.mode`);
  assertFiniteNumberOrNull(value.min, `${path}.min`);
  assertFiniteNumberOrNull(value.max, `${path}.max`);
  if (value.mode === "auto") {
    if (value.min !== null || value.max !== null) throw new Error(`${path} Auto bounds must be null.`);
    return;
  }
  if (typeof value.min !== "number" || typeof value.max !== "number" || value.min >= value.max) {
    throw new Error(`${path} requires finite min < max.`);
  }
}

function sameAppliedAxisScale(expected: AxisScaleState["applied"], actual: unknown) {
  return (
    isRecord(actual) &&
    actual.mode === expected.mode &&
    actual.min === expected.min &&
    actual.max === expected.max
  );
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

function validateLegendSettings(value: unknown, datasetCurveIds?: Set<string>): asserts value is LegendSettings {
  if (!isRecord(value)) {
    throw new Error("Analysis state legendSettings restore data is invalid.");
  }
  assertBoolean(value.previewVisible, "legendSettings.previewVisible");
  assertOneOf(value.reportLabelMode, reportLegendLabelModes, "legendSettings.reportLabelMode");
  validateStringRecord(value.reportNameOverrides, "legendSettings.reportNameOverrides");
  if (datasetCurveIds) {
    Object.keys(value.reportNameOverrides).forEach((curveId) => {
      if (!datasetCurveIds.has(curveId)) {
        throw new Error("legendSettings.reportNameOverrides contains an unknown curveId.");
      }
    });
  }
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
    assertOneOf(sourceFile.sourceKind, datasetSourceKinds, `${path}.sourceKind`);
    assertNonBlankString(sourceFile.sourceInstanceId, `${path}.sourceInstanceId`);
    assertString(sourceFile.sheetName, `${path}.sheetName`);
    assertNonNegativeInteger(sourceFile.sheetIndex, `${path}.sheetIndex`);
    assertString(sourceFile.importedAtIso, `${path}.importedAtIso`);
    assertNonNegativeInteger(sourceFile.curveCount, `${path}.curveCount`);
  });
}

function validateDatasetRelationships(dataset: PcrDataset) {
  const expectedCycleCount = dataset.curves.reduce((max, curve) => Math.max(max, curve.x.length), 0);
  if (dataset.cycleCount !== expectedCycleCount) {
    throw new Error("dataset.cycleCount does not match the longest curve.");
  }

  for (const [index, curve] of dataset.curves.entries()) {
    for (let pointIndex = 0; pointIndex < curve.x.length; pointIndex += 1) {
      if (curve.x[pointIndex] !== pointIndex + 1) {
        throw new Error(`dataset.curves[${index}].x must follow Cycle 1..N.`);
      }
    }
    validateCurveStatsRelationship(curve, `dataset.curves[${index}]`);
    if (curve.source.sourceKind === "excel") {
      if (
        curve.source.specimenHeader?.displayValue !== curve.specimenLabel ||
        curve.source.reagentHeader?.displayValue !== curve.reagentLabel
      ) {
        throw new Error(`dataset.curves[${index}] header provenance does not match its labels.`);
      }
    }
  }

  validateEntityRelationships(dataset.curves, dataset.specimens, "specimen");
  validateEntityRelationships(dataset.curves, dataset.reagents, "reagent");

  const sourceKinds = new Set(dataset.curves.map((curve) => curve.source.sourceKind ?? "excel"));
  const expectedSourceKind = sourceKinds.size > 1 ? "mixed" : (sourceKinds.values().next().value ?? "excel");
  if (dataset.sourceKind !== expectedSourceKind) {
    throw new Error("dataset.sourceKind does not match curve provenance.");
  }
}

function validateCurveStatsRelationship(curve: Curve, path: string) {
  let missingCount = 0;
  let minY: number | null = null;
  let maxY: number | null = null;
  for (const value of curve.y) {
    if (value === null) {
      missingCount += 1;
      continue;
    }
    minY = minY === null ? value : Math.min(minY, value);
    maxY = maxY === null ? value : Math.max(maxY, value);
  }

  if (
    curve.stats.pointCount !== curve.y.length ||
    curve.stats.missingCount !== missingCount ||
    curve.stats.minY !== minY ||
    curve.stats.maxY !== maxY
  ) {
    throw new Error(`${path}.stats does not match its fluorescence points.`);
  }
}

function validateEntityRelationships(curves: Curve[], entities: PcrEntity[], kind: "specimen" | "reagent") {
  const expected = new Map<string, { label: string; curveIds: string[] }>();
  for (const curve of curves) {
    const id = kind === "specimen" ? curve.specimenId : curve.reagentId;
    const label = kind === "specimen" ? curve.specimenLabel : curve.reagentLabel;
    const entry = expected.get(id);
    if (entry) {
      if (entry.label !== label) throw new Error(`dataset.${kind}s contains one ID with conflicting labels.`);
      entry.curveIds.push(curve.curveId);
    } else {
      expected.set(id, { label, curveIds: [curve.curveId] });
    }
  }

  const seenIds = new Set<string>();
  for (const entity of entities) {
    if (seenIds.has(entity.id)) throw new Error(`dataset.${kind}s IDs must be unique.`);
    seenIds.add(entity.id);
    const expectedEntity = expected.get(entity.id);
    if (!expectedEntity || expectedEntity.label !== entity.label) {
      throw new Error(`dataset.${kind}s does not match curve membership.`);
    }
    assertSameStringSet(entity.curveIds, new Set(expectedEntity.curveIds), `dataset.${kind}s.${entity.id}.curveIds`);
  }

  if (seenIds.size !== expected.size) {
    throw new Error(`dataset.${kind}s does not include every curve group.`);
  }
}

function validateSourceFileRelationships(
  dataset: PcrDataset,
  sourceFiles: SourceFileSummary[],
  requireCurrentPasteInputMode: boolean
) {
  const sourceIds = new Set<string>();
  for (const sourceFile of sourceFiles) {
    const sourceId = sourceFile.sourceInstanceId!;
    if (sourceIds.has(sourceId)) throw new Error("sourceFiles source IDs must be unique.");
    sourceIds.add(sourceId);
  }

  const curvesBySource = new Map<string, Curve[]>();
  const provenanceLocations = new Set<string>();
  for (const curve of dataset.curves) {
    const sourceId = curve.source.sourceInstanceId!;
    const location = `${sourceId}\u0000${curve.source.columnLetter}`;
    if (provenanceLocations.has(location)) {
      throw new Error("Curve provenance source and column pairs must be unique.");
    }
    provenanceLocations.add(location);
    const sourceCurves = curvesBySource.get(sourceId) ?? [];
    sourceCurves.push(curve);
    curvesBySource.set(sourceId, sourceCurves);
  }

  for (const sourceCurves of curvesBySource.values()) {
    const reference = sourceCurves[0].source;
    if (
      sourceCurves.some(
        (curve) =>
          curve.source.sourceKind !== reference.sourceKind ||
          curve.source.fileName !== reference.fileName ||
          curve.source.sheetName !== reference.sheetName ||
          curve.source.sheetIndex !== reference.sheetIndex
      )
    ) {
      throw new Error("Curves sharing one source ID contain conflicting provenance metadata.");
    }
    if (reference.sourceKind === "paste") {
      if (requireCurrentPasteInputMode && reference.inputMode === undefined) {
        throw new Error("Current paste curve provenance requires inputMode.");
      }
      if (sourceCurves.some((curve) => curve.source.inputMode !== reference.inputMode)) {
        throw new Error("Curves sharing one paste source ID contain conflicting input modes.");
      }
    }
  }

  const isAggregateMixedSummary =
    sourceFiles.length === 1 &&
    sourceFiles[0].sourceKind === "mixed" &&
    sourceFiles[0].sourceInstanceId === `dataset:${dataset.datasetId}`;
  if (isAggregateMixedSummary) {
    const summary = sourceFiles[0];
    if (
      summary.curveCount !== dataset.curves.length ||
      summary.fileName !== dataset.sourceFileName ||
      summary.sheetName !== dataset.sheetName ||
      summary.sheetIndex !== dataset.sheetIndex
    ) {
      throw new Error("sourceFiles aggregate summary does not match the dataset.");
    }
    validateWarningRelationships(dataset, curvesBySource);
    return;
  }

  for (const sourceFile of sourceFiles) {
    const sourceCurves = curvesBySource.get(sourceFile.sourceInstanceId!);
    if (!sourceCurves || sourceCurves.length !== sourceFile.curveCount) {
      throw new Error("sourceFiles curve count does not match curve provenance.");
    }
    if (
      sourceCurves.some(
        (curve) =>
          curve.source.sourceKind !== sourceFile.sourceKind ||
          curve.source.fileName !== sourceFile.fileName ||
          curve.source.sheetName !== sourceFile.sheetName ||
          curve.source.sheetIndex !== sourceFile.sheetIndex
      )
    ) {
      throw new Error("sourceFiles metadata does not match curve provenance.");
    }
  }

  if (sourceIds.size !== curvesBySource.size || [...curvesBySource.keys()].some((sourceId) => !sourceIds.has(sourceId))) {
    throw new Error("sourceFiles does not cover every curve provenance source.");
  }

  validateWarningRelationships(dataset, curvesBySource);
}

function validatePersistedReferences(
  dataset: PcrDataset,
  selection: SerializedSelectionState,
  styleRules: StyleRules
) {
  const validGroupIds = new Set([
    ...dataset.specimens.map((entity) => `group:specimen:${entity.id}`),
    ...dataset.reagents.map((entity) => `group:reagent:${entity.id}`)
  ]);
  for (const groupId of selection.collapsedGroupIds) {
    if (!validGroupIds.has(groupId)) throw new Error("selection.collapsedGroupIds contains an unknown groupId.");
  }

  const specimenIds = new Set(dataset.specimens.map((entity) => entity.id));
  const reagentIds = new Set(dataset.reagents.map((entity) => entity.id));
  validateStyleRecordKeys(styleRules.specimenColors, specimenIds, "styleRules.specimenColors");
  validateStyleRecordKeys(styleRules.specimenLineTypes, specimenIds, "styleRules.specimenLineTypes");
  validateStyleRecordKeys(styleRules.specimenMarkerTypes, specimenIds, "styleRules.specimenMarkerTypes");
  validateStyleRecordKeys(styleRules.reagentColors, reagentIds, "styleRules.reagentColors");
  validateStyleRecordKeys(styleRules.reagentLineTypes, reagentIds, "styleRules.reagentLineTypes");
  validateStyleRecordKeys(styleRules.reagentMarkerTypes, reagentIds, "styleRules.reagentMarkerTypes");
}

function validateStyleRecordKeys(value: Record<string, unknown>, entityIds: Set<string>, path: string) {
  for (const entityId of Object.keys(value)) {
    if (!entityIds.has(entityId)) throw new Error(`${path} contains an unknown entity ID.`);
  }
}

function validateWarningRelationships(dataset: PcrDataset, curvesBySource: Map<string, Curve[]>) {
  const curveIds = new Set(dataset.curves.map((curve) => curve.curveId));
  const curvesById = new Map(dataset.curves.map((curve) => [curve.curveId, curve]));
  const warnings: Array<{ warning: PcrWarning; ownerCurveId?: string }> = [
    ...dataset.warnings.map((warning) => ({ warning })),
    ...dataset.curves.flatMap((curve) =>
      curve.warnings.map((warning) => ({ warning, ownerCurveId: curve.curveId }))
    ),
    ...dataset.specimens.flatMap((entity) => entity.warnings.map((warning) => ({ warning }))),
    ...dataset.reagents.flatMap((entity) => entity.warnings.map((warning) => ({ warning })))
  ];

  for (const { warning, ownerCurveId } of warnings) {
    if (ownerCurveId && !warning.curveIds?.includes(ownerCurveId)) {
      throw new Error("Curve warning metadata does not reference its owning curve.");
    }
    for (const curveId of warning.curveIds ?? []) {
      if (!curveIds.has(curveId)) throw new Error("Warning metadata contains an unknown curveId.");
    }
    for (const sourceRef of warning.sourceRefs ?? []) {
      const sourceCurves = sourceRef.sourceInstanceId ? curvesBySource.get(sourceRef.sourceInstanceId) : undefined;
      if (!sourceCurves) throw new Error("Warning metadata contains an unknown source ID.");
      if (
        sourceCurves.some(
          (curve) =>
            curve.source.fileName !== sourceRef.sourceName ||
            curve.source.sourceKind !== sourceRef.sourceKind
        )
      ) {
        throw new Error("Warning source metadata does not match curve provenance.");
      }
    }
    for (const curveId of warning.curveIds ?? []) {
      const curve = curvesById.get(curveId)!;
      const relatedSourceRef = warning.sourceRefs?.some(
        (sourceRef) =>
          sourceRef.sourceInstanceId === curve.source.sourceInstanceId &&
          (sourceRef.columnLetter === undefined || sourceRef.columnLetter === curve.source.columnLetter)
      );
      if (!relatedSourceRef) {
        throw new Error("Warning affected curves and source references are inconsistent.");
      }
    }
  }
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

function assertNonBlankString(value: unknown, path: string): asserts value is string {
  assertString(value, path);
  if (value.trim() === "") {
    throw new Error(`${path} must be a non-empty string.`);
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

function assertOptionalPortableValue(value: unknown, path: string) {
  if (
    value !== undefined &&
    value !== null &&
    typeof value !== "string" &&
    typeof value !== "number" &&
    typeof value !== "boolean"
  ) {
    throw new Error(`${path} must be a portable scalar value.`);
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new Error(`${path} must be finite.`);
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
