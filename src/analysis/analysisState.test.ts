import { describe, expect, it } from "vitest";
import { createDefaultChartScale } from "../chart/chartScale";
import { createDefaultStyleRules } from "../chart/chartStyle";
import { appendPcrDataset } from "../data/mergeDatasets";
import { parsePastedTable } from "../data/parsePastedTable";
import { createOneSpecimenEightReagentDataset } from "../data/sampleData";
import { createGroupId } from "../selection/buildTrees";
import { createInitialSelectionState } from "../selection/selectionState";
import {
  ANALYSIS_STATE_SCHEMA_VERSION,
  createAnalysisState,
  createSourceFileSummary,
  deserializeAnalysisState,
  serializeAnalysisState,
  type AnalysisState
} from "./analysisState";

function createTestAnalysisState(): AnalysisState {
  const dataset = createOneSpecimenEightReagentDataset();
  const firstCurveId = dataset.curves[0].curveId;
  const secondCurveId = dataset.curves[1].curveId;
  const selection = createInitialSelectionState(dataset);
  selection.selectedCurveIds.add(firstCurveId);
  selection.collapsedGroupIds.add(createGroupId("reagent", dataset.reagents[0].id));
  selection.orderedCurveIds = [secondCurveId, firstCurveId, ...selection.orderedCurveIds.slice(2)];

  const chartScale = createDefaultChartScale();
  chartScale.x.fixedMin = "1";
  chartScale.x.fixedMax = "60";
  chartScale.y.preset1 = { label: "P1 narrow", min: "0", max: "100" };
  const styleRules = createDefaultStyleRules();
  styleRules.markerBy = "reagent";
  styleRules.reagentMarkerTypes[dataset.curves[0].reagentId] = "circle";

  return createAnalysisState({
    analysisId: "analysis-1",
    analysisName: "Respiratory panel",
    dataset,
    selection,
    searchQuery: "A1",
    selectionFilter: "selected",
    chartScale,
    styleRules,
    curveOverrides: {
      [firstCurveId]: { color: "#123456", lineType: "dotted", markerType: "circle", source: "custom" }
    },
    legendSettings: {
      previewVisible: false,
      reportLabelMode: "full",
      reportNameOverrides: { [firstCurveId]: "Report A1" }
    },
    exportSettings: { imageLayout: "legendOnly" },
    exportCounter: 7,
    importFileName: dataset.sourceFileName,
    sourceFiles: [createSourceFileSummary(dataset)],
    selectionSets: [
      { selectionSetId: "selection-set-1", name: "Condition A", curveIds: [firstCurveId, secondCurveId] }
    ],
    activeSelectionSetId: "selection-set-1",
    dirty: true
  });
}

describe("analysis state serialization", () => {
  it("roundtrips persisted analysis state and restores Set fields", () => {
    const state = createTestAnalysisState();
    const firstCurveId = state.dataset.curves[0].curveId;
    const serialized = serializeAnalysisState(state);
    const restored = deserializeAnalysisState(JSON.parse(JSON.stringify(serialized)));

    expect(serialized.schemaVersion).toBe(ANALYSIS_STATE_SCHEMA_VERSION);
    expect(serialized.selection.selectedCurveIds).toEqual([...state.selection.selectedCurveIds]);
    expect(restored.analysisName).toBe(state.analysisName);
    expect(restored.dataset.curves).toHaveLength(state.dataset.curves.length);
    expect(restored.dataset.schemaVersion).toBe(2);
    expect(restored.dataset.curves[0].source.specimenHeader).toEqual(state.dataset.curves[0].source.specimenHeader);
    expect(restored.selection.selectedCurveIds).toBeInstanceOf(Set);
    expect([...restored.selection.selectedCurveIds]).toEqual([...state.selection.selectedCurveIds]);
    expect([...restored.selection.collapsedGroupIds]).toEqual([...state.selection.collapsedGroupIds]);
    expect(restored.selection.orderedCurveIds).toEqual(state.selection.orderedCurveIds);
    expect(restored.selectionSets).toEqual(state.selectionSets);
    expect(restored.activeSelectionSetId).toBe("selection-set-1");
    expect(restored.chartScale.y.preset1?.label).toBe("P1 narrow");
    expect(restored.styleRules.markerBy).toBe("reagent");
    expect(restored.styleRules.reagentMarkerTypes[state.dataset.curves[0].reagentId]).toBe("circle");
    expect(restored.curveOverrides[firstCurveId]).toMatchObject({
      ...state.curveOverrides[firstCurveId],
      displayName: "Report A1",
      fieldSources: { displayName: "custom" }
    });
    expect(restored.legendSettings.previewVisible).toBe(false);
    expect(restored.legendSettings.reportLabelMode).toBe("full");
    expect(restored.legendSettings.reportNameOverrides).toEqual({});
    expect(restored.exportSettings.imageLayout).toBe("legendOnly");
    expect(restored.exportCounter).toBe(7);
    expect(restored.dirty).toBe(false);
    expect(restored.sourceFiles[0]).toMatchObject({
      fileName: state.dataset.sourceFileName,
      sheetName: state.dataset.sheetName,
      curveCount: state.dataset.curves.length
    });
  });

  it("migrates schema 3 restore data to empty selection sets", () => {
    const serialized = serializeAnalysisState(createTestAnalysisState()) as unknown as Record<string, unknown>;
    serialized.schemaVersion = 3;
    serialized.selectionSets = [{ selectionSetId: "legacy-injected", name: "Ignore", curveIds: ["unknown"] }];
    serialized.activeSelectionSetId = "legacy-injected";

    const restored = deserializeAnalysisState(serialized);

    expect(restored.selectionSets).toEqual([]);
    expect(restored.activeSelectionSetId).toBeNull();
  });

  it("rejects schema 4 restore data with missing selection set fields", () => {
    const missingSets = serializeAnalysisState(createTestAnalysisState()) as unknown as Record<string, unknown>;
    delete missingSets.selectionSets;
    expect(() => deserializeAnalysisState(missingSets)).toThrow("missing selectionSets");

    const missingActiveId = serializeAnalysisState(createTestAnalysisState()) as unknown as Record<string, unknown>;
    delete missingActiveId.activeSelectionSetId;
    expect(() => deserializeAnalysisState(missingActiveId)).toThrow("missing activeSelectionSetId");
  });

  it("rejects schema 4 restore data with invalid selection set field types", () => {
    const serialized = serializeAnalysisState(createTestAnalysisState());
    expect(() => deserializeAnalysisState({ ...serialized, selectionSets: null })).toThrow(
      "selectionSets must be an array"
    );
    expect(() => deserializeAnalysisState({ ...serialized, activeSelectionSetId: 123 })).toThrow(
      "activeSelectionSetId must be a string or null"
    );
  });

  it("rejects selection sets with unknown curve references or active IDs", () => {
    const serialized = serializeAnalysisState(createTestAnalysisState());
    expect(() =>
      deserializeAnalysisState({
        ...serialized,
        selectionSets: [{ selectionSetId: "bad", name: "Bad", curveIds: ["unknown"] }],
        activeSelectionSetId: "bad"
      })
    ).toThrow("unknown curveId");
    expect(() => deserializeAnalysisState({ ...serialized, activeSelectionSetId: "missing" })).toThrow(
      "unknown selection set"
    );
  });

  it("does not serialize transient UI fields even if present on the input object", () => {
    const state = {
      ...createTestAnalysisState(),
      importStatus: "importing",
      importError: "bad file",
      exportMessage: "copied",
      lastPresetUndo: { affectedCurveIds: [] },
      clipboardResult: "failed"
    } as AnalysisState & Record<string, unknown>;

    const serialized = serializeAnalysisState(state);

    expect(serialized).not.toHaveProperty("importStatus");
    expect(serialized).not.toHaveProperty("importError");
    expect(serialized).not.toHaveProperty("exportMessage");
    expect(serialized).not.toHaveProperty("lastPresetUndo");
    expect(serialized).not.toHaveProperty("clipboardResult");
    expect(serialized).not.toHaveProperty("analysisId");
    expect(serialized).not.toHaveProperty("dirty");
  });

  it("creates default source file summary and clean dirty state", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const state = createAnalysisState({
      analysisId: "analysis-clean",
      analysisName: "Clean analysis",
      dataset,
      selection: createInitialSelectionState(dataset),
      searchQuery: "",
      selectionFilter: "all",
      chartScale: createDefaultChartScale(),
      styleRules: createDefaultStyleRules(),
      curveOverrides: {},
      exportCounter: 1,
      importFileName: dataset.sourceFileName
    });

    expect(state.dirty).toBe(false);
    expect(state.sourceFiles).toEqual([createSourceFileSummary(dataset)]);
    expect(state.legendSettings).toEqual({ previewVisible: true, reportLabelMode: "autoCompact", reportNameOverrides: {} });
    expect(state.exportSettings).toEqual({ imageLayout: "plotOnly" });
  });

  it("restores default legend/export settings from older serialized payloads", () => {
    const serialized = serializeAnalysisState(createTestAnalysisState());
    const { legendSettings: _legendSettings, exportSettings: _exportSettings, ...legacyPayload } = serialized;
    legacyPayload.schemaVersion = 2 as typeof legacyPayload.schemaVersion;
    legacyPayload.dataset.schemaVersion = 1 as typeof legacyPayload.dataset.schemaVersion;
    const {
      markerBy: _markerBy,
      specimenMarkerTypes: _specimenMarkerTypes,
      reagentMarkerTypes: _reagentMarkerTypes,
      ...legacyStyleRules
    } = legacyPayload.styleRules;
    const restored = deserializeAnalysisState(legacyPayload);
    const restoredLegacyStyleRules = deserializeAnalysisState({
      ...legacyPayload,
      styleRules: legacyStyleRules
    }).styleRules;

    expect(restored.legendSettings).toEqual({ previewVisible: true, reportLabelMode: "autoCompact", reportNameOverrides: {} });
    expect(restored.exportSettings).toEqual({ imageLayout: "plotOnly" });
    expect(restoredLegacyStyleRules.markerBy).toBe("reagent");
    expect(restoredLegacyStyleRules.specimenMarkerTypes).toEqual({});
    expect(restoredLegacyStyleRules.reagentMarkerTypes).toEqual({});
  });

  it("migrates legacy Analysis XLSX provenance fields to Excel source metadata", () => {
    const legacyPayload = JSON.parse(JSON.stringify(serializeAnalysisState(createTestAnalysisState())));
    legacyPayload.schemaVersion = 2;
    legacyPayload.dataset.schemaVersion = 1;
    delete legacyPayload.dataset.sourceKind;
    legacyPayload.dataset.curves.forEach((curve: { source: Record<string, unknown> }) => {
      delete curve.source.sourceKind;
      delete curve.source.sourceInstanceId;
      delete curve.source.specimenHeader;
      delete curve.source.reagentHeader;
    });
    legacyPayload.sourceFiles.forEach((source: Record<string, unknown>) => {
      delete source.sourceKind;
      delete source.sourceInstanceId;
    });
    const legacyWarning = {
      code: "MISSING_SPECIMEN_LABEL",
      severity: "warning",
      scope: "header",
      message: "Specimen header is empty.",
      curveIds: [legacyPayload.dataset.curves[0].curveId],
      sourceCell: "A1",
      columnLetter: "A"
    };
    legacyPayload.dataset.warnings = [legacyWarning];
    legacyPayload.dataset.curves[0].warnings = [legacyWarning];

    const restored = deserializeAnalysisState(legacyPayload);
    expect(restored.dataset.sourceKind).toBe("excel");
    expect(restored.dataset.curves.every((curve) => curve.source.sourceKind === "excel")).toBe(true);
    expect(restored.dataset.curves.every((curve) => curve.source.sourceInstanceId?.startsWith("legacy:excel:"))).toBe(true);
    expect(restored.dataset.schemaVersion).toBe(2);
    expect(restored.dataset.curves[0].source.specimenHeader).toMatchObject({
      rawValue: restored.dataset.curves[0].specimenLabel,
      displayValue: restored.dataset.curves[0].specimenLabel,
      cellType: "legacy"
    });
    expect(restored.sourceFiles[0].sourceKind).toBe("excel");
    expect(restored.sourceFiles[0].sourceInstanceId).toMatch(/^legacy:excel:/u);
    expect(restored.dataset.warnings[0]).toMatchObject({ handling: "kept" });
    expect(restored.dataset.warnings[0].sourceRefs?.[0]).toMatchObject({ cell: "A1", columnLetter: "A" });
  });

  it("migrates repeated same-name legacy sources by import occurrence instead of merging them", () => {
    const first = createOneSpecimenEightReagentDataset();
    const second = createOneSpecimenEightReagentDataset();
    const merged = appendPcrDataset(first, second).dataset;
    merged.warnings = [];
    merged.curves.forEach((curve) => {
      curve.warnings = [];
    });
    const state = createAnalysisState({
      analysisId: "legacy-repeated-source",
      analysisName: "Legacy repeated source",
      dataset: merged,
      selection: createInitialSelectionState(merged),
      searchQuery: "",
      selectionFilter: "all",
      chartScale: createDefaultChartScale(),
      styleRules: createDefaultStyleRules(),
      curveOverrides: {},
      exportCounter: 1,
      importFileName: merged.sourceFileName,
      sourceFiles: [createSourceFileSummary(first), createSourceFileSummary(second)]
    });
    const legacyPayload = JSON.parse(JSON.stringify(serializeAnalysisState(state)));
    legacyPayload.schemaVersion = 2;
    legacyPayload.dataset.curves.forEach((curve: { source: Record<string, unknown> }) => {
      delete curve.source.sourceKind;
      delete curve.source.sourceInstanceId;
    });
    legacyPayload.sourceFiles.forEach((source: Record<string, unknown>) => {
      delete source.sourceKind;
      delete source.sourceInstanceId;
    });

    const restored = deserializeAnalysisState(legacyPayload);
    expect(new Set(restored.sourceFiles.map((source) => source.sourceInstanceId)).size).toBe(2);
    expect(new Set(restored.dataset.curves.map((curve) => curve.source.sourceInstanceId)).size).toBe(2);
    expect(restored.sourceFiles.map((source) => source.curveCount)).toEqual([8, 8]);
  });

  it("migrates schema 1 scale drafts to explicit applied scale state", () => {
    const legacyPayload = JSON.parse(JSON.stringify(serializeAnalysisState(createTestAnalysisState())));
    legacyPayload.schemaVersion = 1;
    legacyPayload.chartScale.x.mode = "fixed";
    legacyPayload.chartScale.x.fixedMin = "1";
    legacyPayload.chartScale.x.fixedMax = "60";
    delete legacyPayload.chartScale.x.applied;
    legacyPayload.chartScale.y.mode = "fixed";
    legacyPayload.chartScale.y.fixedMin = "20";
    legacyPayload.chartScale.y.fixedMax = "10";
    delete legacyPayload.chartScale.y.applied;

    const restored = deserializeAnalysisState(legacyPayload);

    expect(restored.chartScale.x.applied).toEqual({ mode: "fixed", min: 1, max: 60 });
    expect(restored.chartScale.y.applied).toEqual({ mode: "auto", min: null, max: null });
    expect(serializeAnalysisState(restored).schemaVersion).toBe(ANALYSIS_STATE_SCHEMA_VERSION);
  });

  it("roundtrips an invalid active draft with its separate last valid applied bounds", () => {
    const state = createTestAnalysisState();
    state.chartScale.y.mode = "fixed";
    state.chartScale.y.fixedMin = "20";
    state.chartScale.y.fixedMax = "10";
    state.chartScale.y.applied = { mode: "fixed", min: -1, max: 100 };

    const restored = deserializeAnalysisState(serializeAnalysisState(state));

    expect(restored.chartScale.y).toMatchObject({
      mode: "fixed",
      fixedMin: "20",
      fixedMax: "10",
      applied: { mode: "fixed", min: -1, max: 100 }
    });
  });

  it("rejects schema 2 scale state when the required applied bounds are missing", () => {
    const serialized = JSON.parse(JSON.stringify(serializeAnalysisState(createTestAnalysisState())));
    delete serialized.chartScale.y.applied;

    expect(() => deserializeAnalysisState(serialized)).toThrow("chartScale.y.applied is invalid");
  });

  it("rejects unsupported schema versions and missing required fields", () => {
    const serialized = serializeAnalysisState(createTestAnalysisState());

    expect(() => deserializeAnalysisState({ ...serialized, schemaVersion: 999 })).toThrow(
      "Unsupported Analysis XLSX schema version."
    );

    const { dataset: _dataset, ...missingDataset } = serialized;
    expect(() => deserializeAnalysisState(missingDataset)).toThrow("missing dataset");

    const { importFileName: _importFileName, ...missingImportFileName } = serialized;
    expect(() => deserializeAnalysisState(missingImportFileName)).toThrow("missing importFileName");
  });

  it("rejects invalid scalar and settings fields", () => {
    const serialized = serializeAnalysisState(createTestAnalysisState());

    expect(() => deserializeAnalysisState({ ...serialized, selectionFilter: "visible" })).toThrow("selectionFilter");
    expect(() => deserializeAnalysisState({ ...serialized, exportCounter: 0 })).toThrow("exportCounter");
    expect(() =>
      deserializeAnalysisState({
        ...serialized,
        chartScale: { ...serialized.chartScale, y: { ...serialized.chartScale.y, preset1: { label: "P1", min: 0, max: "1" } } }
      })
    ).toThrow("chartScale.y.preset1.min");
    expect(() =>
      deserializeAnalysisState({
        ...serialized,
        styleRules: { ...serialized.styleRules, reagentLineTypes: { bad: "dashdot" } }
      })
    ).toThrow("styleRules.reagentLineTypes.bad");
    expect(() =>
      deserializeAnalysisState({
        ...serialized,
        styleRules: { ...serialized.styleRules, markerBy: "curve" }
      })
    ).toThrow("styleRules.markerBy");
    expect(() =>
      deserializeAnalysisState({
        ...serialized,
        styleRules: { ...serialized.styleRules, reagentMarkerTypes: { bad: "diamond" } }
      })
    ).toThrow("styleRules.reagentMarkerTypes.bad");
    expect(() =>
      deserializeAnalysisState({
        ...serialized,
        legendSettings: { previewVisible: "yes" }
      })
    ).toThrow("legendSettings.previewVisible");
    expect(() =>
      deserializeAnalysisState({
        ...serialized,
        legendSettings: { ...serialized.legendSettings, reportLabelMode: "compact" }
      })
    ).toThrow("legendSettings.reportLabelMode");
    expect(() =>
      deserializeAnalysisState({
        ...serialized,
        legendSettings: { ...serialized.legendSettings, reportNameOverrides: { "unknown-curve": "Name" } }
      })
    ).toThrow("legendSettings.reportNameOverrides contains an unknown curveId");
    expect(() =>
      deserializeAnalysisState({
        ...serialized,
        exportSettings: { imageLayout: "imageOnly" }
      })
    ).toThrow("exportSettings.imageLayout");
  });

  it("rejects dataset and selection integrity problems", () => {
    const serialized = serializeAnalysisState(createTestAnalysisState());

    expect(() =>
      deserializeAnalysisState({
        ...serialized,
        dataset: { ...serialized.dataset, schemaVersion: 1 }
      })
    ).toThrow("dataset schema version");

    expect(() =>
      deserializeAnalysisState({
        ...serialized,
        dataset: {
          ...serialized.dataset,
          curves: [
            {
              ...serialized.dataset.curves[0],
              y: serialized.dataset.curves[0].y.slice(1)
            },
            ...serialized.dataset.curves.slice(1)
          ]
        }
      })
    ).toThrow("must have the same length");

    expect(() =>
      deserializeAnalysisState({
        ...serialized,
        selection: { ...serialized.selection, selectedCurveIds: ["unknown-curve"] }
      })
    ).toThrow("unknown curveId");

    expect(() =>
      deserializeAnalysisState({
        ...serialized,
        selection: { ...serialized.selection, orderedCurveIds: serialized.selection.orderedCurveIds.slice(1) }
      })
    ).toThrow("must match dataset curve IDs");
  });

  it("rejects semantically inconsistent curve, entity, source, warning, and style relationships", () => {
    const createPayload = () => JSON.parse(JSON.stringify(serializeAnalysisState(createTestAnalysisState())));

    const wrongCycleCount = createPayload();
    wrongCycleCount.dataset.cycleCount += 1;
    expect(() => deserializeAnalysisState(wrongCycleCount)).toThrow("cycleCount");

    const wrongCycleAxis = createPayload();
    wrongCycleAxis.dataset.curves[0].x[1] = 3;
    expect(() => deserializeAnalysisState(wrongCycleAxis)).toThrow("Cycle 1..N");

    const wrongStats = createPayload();
    wrongStats.dataset.curves[0].stats.maxY += 1;
    expect(() => deserializeAnalysisState(wrongStats)).toThrow("stats does not match");

    const wrongEntity = createPayload();
    wrongEntity.dataset.specimens[0].curveIds = wrongEntity.dataset.specimens[0].curveIds.slice(1);
    expect(() => deserializeAnalysisState(wrongEntity)).toThrow("dataset.specimens");

    const wrongSource = createPayload();
    wrongSource.sourceFiles[0].curveCount -= 1;
    expect(() => deserializeAnalysisState(wrongSource)).toThrow("curve count");

    const wrongWarning = createPayload();
    wrongWarning.dataset.warnings = [
      {
        code: "EMPTY_FLUORESCENCE_CELL",
        severity: "warning",
        scope: "cell",
        handling: "null-gap",
        message: "Missing value",
        curveIds: ["unknown-curve"],
        sourceRefs: [
          {
            sourceInstanceId: wrongWarning.sourceFiles[0].sourceInstanceId,
            sourceName: wrongWarning.sourceFiles[0].fileName,
            sourceKind: "excel"
          }
        ]
      }
    ];
    expect(() => deserializeAnalysisState(wrongWarning)).toThrow("unknown curveId");

    const wrongStyle = createPayload();
    wrongStyle.styleRules.specimenColors["unknown-specimen"] = "#000000";
    expect(() => deserializeAnalysisState(wrongStyle)).toThrow("unknown entity ID");

    const wrongCollapsedGroup = createPayload();
    wrongCollapsedGroup.selection.collapsedGroupIds.push("group:reagent:unknown");
    expect(() => deserializeAnalysisState(wrongCollapsedGroup)).toThrow("unknown groupId");
  });

  it("validates aggregate mixed-source provenance, paste mode, and warning-to-curve source links", () => {
    const excelDataset = createOneSpecimenEightReagentDataset();
    const pasted = parsePastedTable("Comparison\nA9\n0.1\n1.1", {
      mode: "fullTable",
      sourceName: "Paste comparison",
      sourceInstanceId: "paste-semantic-review"
    });
    expect(pasted.ok).toBe(true);
    if (!pasted.ok) return;
    const merged = appendPcrDataset(excelDataset, pasted.dataset).dataset;
    const aggregateState = createAnalysisState({
      analysisId: "aggregate-mixed",
      analysisName: "Aggregate mixed",
      dataset: merged,
      selection: createInitialSelectionState(merged),
      searchQuery: "",
      selectionFilter: "all",
      chartScale: createDefaultChartScale(),
      styleRules: createDefaultStyleRules(),
      curveOverrides: {},
      exportCounter: 1,
      importFileName: merged.sourceFileName
    });
    const validPayload = JSON.parse(JSON.stringify(serializeAnalysisState(aggregateState)));
    expect(deserializeAnalysisState(validPayload).dataset.curves).toHaveLength(9);

    const conflictingSource = JSON.parse(JSON.stringify(validPayload));
    const excelCurve = conflictingSource.dataset.curves[0];
    const pasteCurve = conflictingSource.dataset.curves.at(-1);
    pasteCurve.source.sourceInstanceId = excelCurve.source.sourceInstanceId;
    pasteCurve.source.columnLetter = "Z";
    expect(() => deserializeAnalysisState(conflictingSource)).toThrow("conflicting provenance metadata");

    const missingPasteMode = JSON.parse(JSON.stringify(validPayload));
    delete missingPasteMode.dataset.curves.at(-1).source.inputMode;
    expect(() => deserializeAnalysisState(missingPasteMode)).toThrow("requires inputMode");

    const crossedWarning = JSON.parse(JSON.stringify(validPayload));
    const crossedExcelCurve = crossedWarning.dataset.curves[0];
    const crossedPasteCurve = crossedWarning.dataset.curves.at(-1);
    crossedWarning.dataset.warnings = [
      {
        code: "EMPTY_FLUORESCENCE_CELL",
        severity: "warning",
        scope: "cell",
        handling: "null-gap",
        message: "Crossed source reference",
        curveIds: [crossedExcelCurve.curveId],
        sourceRefs: [
          {
            sourceInstanceId: crossedPasteCurve.source.sourceInstanceId,
            sourceName: crossedPasteCurve.source.fileName,
            sourceKind: crossedPasteCurve.source.sourceKind,
            columnLetter: crossedPasteCurve.source.columnLetter
          }
        ]
      }
    ];
    expect(() => deserializeAnalysisState(crossedWarning)).toThrow("affected curves and source references");
  });

  it("rejects schema 3 payloads that omit required Excel header or warning provenance", () => {
    const serialized = JSON.parse(JSON.stringify(serializeAnalysisState(createTestAnalysisState())));
    delete serialized.dataset.curves[0].source.specimenHeader;
    expect(() => deserializeAnalysisState(serialized)).toThrow("specimenHeader");

    const withWarning = JSON.parse(JSON.stringify(serializeAnalysisState(createTestAnalysisState())));
    withWarning.dataset.warnings = [
      {
        code: "MISSING_SPECIMEN_LABEL",
        severity: "warning",
        scope: "header",
        message: "Specimen header is empty.",
        curveIds: [withWarning.dataset.curves[0].curveId]
      }
    ];
    expect(() => deserializeAnalysisState(withWarning)).toThrow("handling");

    const withEmptySourceRefs = JSON.parse(JSON.stringify(serializeAnalysisState(createTestAnalysisState())));
    withEmptySourceRefs.dataset.warnings = [
      {
        code: "MISSING_SPECIMEN_LABEL",
        severity: "warning",
        scope: "header",
        message: "Specimen header is empty.",
        curveIds: [withEmptySourceRefs.dataset.curves[0].curveId],
        handling: "kept",
        sourceRefs: []
      }
    ];
    expect(() => deserializeAnalysisState(withEmptySourceRefs)).toThrow("sourceRefs");

    withEmptySourceRefs.dataset.warnings[0].sourceRefs = [{ sourceName: "source.xlsx" }];
    expect(() => deserializeAnalysisState(withEmptySourceRefs)).toThrow("sourceInstanceId");

    withEmptySourceRefs.dataset.warnings[0].sourceRefs = [
      { sourceInstanceId: "   ", sourceName: "source.xlsx", sourceKind: "excel" }
    ];
    expect(() => deserializeAnalysisState(withEmptySourceRefs)).toThrow("non-empty string");
  });

  it("rejects invalid overrides and source file summaries", () => {
    const serialized = serializeAnalysisState(createTestAnalysisState());
    const curveId = serialized.dataset.curves[0].curveId;

    expect(() =>
      deserializeAnalysisState({
        ...serialized,
        curveOverrides: { [curveId]: { markerType: "diamond" } }
      })
    ).toThrow("markerType");
    expect(() =>
      deserializeAnalysisState({
        ...serialized,
        curveOverrides: { [curveId]: { source: "automatic" } }
      })
    ).toThrow("source");
    expect(() =>
      deserializeAnalysisState({
        ...serialized,
        curveOverrides: { [curveId]: { fieldSources: { color: "automatic" } } }
      })
    ).toThrow("fieldSources.color");

    expect(() =>
      deserializeAnalysisState({
        ...serialized,
        curveOverrides: { "unknown-curve": { color: "#000000" } }
      })
    ).toThrow("unknown curveId");

    expect(() =>
      deserializeAnalysisState({
        ...serialized,
        sourceFiles: [{ ...serialized.sourceFiles[0], curveCount: -1 }]
      })
    ).toThrow("sourceFiles[0].curveCount");
  });

  it("allows a restored file to receive a new tab-local analysis id", () => {
    const serialized = serializeAnalysisState(createTestAnalysisState());
    const restored = deserializeAnalysisState(serialized, { analysisId: "analysis-restored-tab" });

    expect(restored.analysisId).toBe("analysis-restored-tab");
    expect(restored.dirty).toBe(false);
  });
});
