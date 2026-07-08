import { beforeEach, describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { createOneSpecimenEightReagentDataset } from "../data/sampleData";
import type { PcrDataset } from "../data/types";
import { buildPcrChartOption } from "../chart/chartConfig";
import { createAnalysisState } from "../analysis/analysisState";
import { exportAnalysisWorkbookBuffer } from "../analysis/analysisWorkbook";
import { useAppStore } from "./appStore";

describe("app store style preset and legend order", () => {
  beforeEach(() => {
    useAppStore.getState().reset();
  });

  it("applies a preset by overwriting selected curve overrides and supports one-step undo", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const firstCurveId = dataset.curves[0].curveId;

    useAppStore.getState().loadDataset(dataset);
    useAppStore.getState().setCurveOverride(firstCurveId, { color: "#111111", lineType: "dotted" });
    useAppStore.getState().applyStylePreset("reagentColorSolid", [firstCurveId]);

    expect(useAppStore.getState().curveOverrides[firstCurveId]).toMatchObject({
      color: "#0b6fa4",
      lineType: "solid",
      markerType: "none"
    });
    expect(useAppStore.getState().lastPresetMessage).toBe("1 curves updated by preset.");

    useAppStore.getState().undoLastPreset();
    expect(useAppStore.getState().curveOverrides[firstCurveId]).toMatchObject({
      color: "#111111",
      lineType: "dotted"
    });
    expect(useAppStore.getState().lastPresetUndo).toBeNull();
  });

  it("uses full dataset order when presetting a later reagent curve", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const secondCurveId = dataset.curves[1].curveId;

    useAppStore.getState().loadDataset(dataset);
    useAppStore.getState().applyStylePreset("reagentColorSolid", [secondCurveId]);

    expect(useAppStore.getState().curveOverrides[secondCurveId]).toMatchObject({
      color: "#d97706",
      lineType: "solid",
      markerType: "none"
    });
  });

  it("lets group marker rules drive charts until curve overrides are reset", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const curve = dataset.curves[0];

    useAppStore.getState().loadDataset(dataset);
    useAppStore.getState().setCurvesSelected([curve.curveId], true);
    useAppStore.getState().setGroupMarkerType("reagent", curve.reagentId, "circle");

    expect(getFirstSeriesSymbol(dataset)).toBe("circle");

    useAppStore.getState().setCurveOverride(curve.curveId, { markerType: "rect" });
    expect(useAppStore.getState().curveOverrides[curve.curveId].source).toBe("custom");
    expect(useAppStore.getState().curveOverrides[curve.curveId].fieldSources?.markerType).toBe("custom");
    expect(getFirstSeriesSymbol(dataset)).toBe("rect");

    useAppStore.getState().resetCurveOverride(curve.curveId);
    expect(useAppStore.getState().curveOverrides[curve.curveId]).toBeUndefined();
    expect(getFirstSeriesSymbol(dataset)).toBe("circle");
  });

  it("resets selected and all curve overrides independently", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const firstCurveId = dataset.curves[0].curveId;
    const secondCurveId = dataset.curves[1].curveId;

    useAppStore.getState().loadDataset(dataset);
    useAppStore.getState().setCurvesSelected([firstCurveId], true);
    useAppStore.getState().setCurveOverride(firstCurveId, { color: "#111111" });
    useAppStore.getState().setCurveOverride(secondCurveId, { color: "#222222" });

    useAppStore.getState().resetSelectedCurveOverrides();
    expect(useAppStore.getState().curveOverrides[firstCurveId]).toBeUndefined();
    expect(useAppStore.getState().curveOverrides[secondCurveId]?.color).toBe("#222222");

    useAppStore.getState().resetAllCurveOverrides();
    expect(useAppStore.getState().curveOverrides).toEqual({});
  });

  it("resets individual override fields and group style rows without touching other fields", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const curve = dataset.curves[0];

    useAppStore.getState().loadDataset(dataset);
    useAppStore.getState().applyStylePreset("reagentColorSolid", [curve.curveId]);
    useAppStore.getState().setCurveOverride(curve.curveId, { markerType: "rect" });
    useAppStore.getState().resetCurveOverrideField(curve.curveId, "markerType");

    expect(useAppStore.getState().curveOverrides[curve.curveId]).toMatchObject({
      color: "#0b6fa4",
      lineType: "solid",
      source: "preset",
      fieldSources: { color: "preset", lineType: "preset" }
    });

    useAppStore.getState().resetCurveOverrideField(curve.curveId, "color");
    useAppStore.getState().resetCurveOverrideField(curve.curveId, "lineType");
    expect(useAppStore.getState().curveOverrides[curve.curveId]).toBeUndefined();

    useAppStore.getState().setGroupColor("reagent", curve.reagentId, "#222222");
    useAppStore.getState().setGroupLineType("reagent", curve.reagentId, "dashed");
    useAppStore.getState().setGroupMarkerType("reagent", curve.reagentId, "triangle");
    useAppStore.getState().resetGroupStyle("reagent", curve.reagentId);

    expect(useAppStore.getState().styleRules.reagentColors[curve.reagentId]).toBeUndefined();
    expect(useAppStore.getState().styleRules.reagentLineTypes[curve.reagentId]).toBeUndefined();
    expect(useAppStore.getState().styleRules.reagentMarkerTypes[curve.reagentId]).toBeUndefined();
  });

  it("keeps preset apply and undo independent from group marker rules", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const curve = dataset.curves[0];

    useAppStore.getState().loadDataset(dataset);
    useAppStore.getState().setCurvesSelected([curve.curveId], true);
    useAppStore.getState().setGroupMarkerType("reagent", curve.reagentId, "circle");

    useAppStore.getState().applyStylePreset("reagentColorSolid", [curve.curveId]);
    expect(useAppStore.getState().curveOverrides[curve.curveId]).toMatchObject({
      markerType: "none",
      source: "preset",
      fieldSources: {
        color: "preset",
        lineType: "preset",
        markerType: "preset"
      }
    });
    expect(getFirstSeriesSymbol(dataset)).toBe("none");

    useAppStore.getState().undoLastPreset();
    expect(useAppStore.getState().curveOverrides[curve.curveId]).toBeUndefined();
    expect(getFirstSeriesSymbol(dataset)).toBe("circle");
  });

  it("stores editable P1 scale presets for the current analysis session", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const firstCurveId = dataset.curves[0].curveId;

    useAppStore.getState().loadDataset(dataset);
    useAppStore.getState().setAxisPresetValue("y", "preset1", "label", "P1 narrow");
    useAppStore.getState().setAxisPresetValue("y", "preset1", "min", "0");
    useAppStore.getState().setAxisPresetValue("y", "preset1", "max", "100");
    useAppStore.getState().setAxisScaleMode("y", "preset1");
    useAppStore.getState().setCurvesSelected([firstCurveId], true);

    const state = useAppStore.getState();
    const result = buildPcrChartOption({
      dataset,
      selectedCurveIds: state.selection?.selectedCurveIds ?? new Set<string>(),
      orderedCurveIds: state.selection?.orderedCurveIds,
      scale: state.chartScale,
      styleRules: state.styleRules,
      curveOverrides: state.curveOverrides
    });
    const option = result.option as Record<string, any>;

    expect(option.yAxis.min).toBe(0);
    expect(option.yAxis.max).toBe(100);

    useAppStore.getState().setCurvesSelected([firstCurveId], false);
    expect(useAppStore.getState().chartScale.y.mode).toBe("preset1");

    useAppStore.getState().loadDataset(dataset);
    expect(useAppStore.getState().chartScale.y.preset1?.min).toBe("");
  });

  it("resets legend/export settings when loading a new dataset and keeps explicit actions per tab", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const firstTabId = useAppStore.getState().activeAnalysisId;

    useAppStore.getState().loadDataset(dataset);
    useAppStore.getState().setLegendPreviewVisible(false);
    useAppStore.getState().setExportImageLayout("legendOnly");

    expect(useAppStore.getState().legendSettings.previewVisible).toBe(false);
    expect(useAppStore.getState().exportSettings.imageLayout).toBe("legendOnly");

    const secondTabId = useAppStore.getState().createAnalysis("Second analysis");
    expect(useAppStore.getState().legendSettings.previewVisible).toBe(true);
    expect(useAppStore.getState().exportSettings.imageLayout).toBe("plotWithLegend");

    useAppStore.getState().switchAnalysis(firstTabId);
    expect(useAppStore.getState().legendSettings.previewVisible).toBe(false);
    expect(useAppStore.getState().exportSettings.imageLayout).toBe("legendOnly");

    useAppStore.getState().switchAnalysis(secondTabId);
    useAppStore.getState().loadDataset(dataset);
    expect(useAppStore.getState().legendSettings.previewVisible).toBe(true);
    expect(useAppStore.getState().exportSettings.imageLayout).toBe("plotWithLegend");
  });

  it("uses current user order as chart series order", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const firstCurveId = dataset.curves[0].curveId;
    const secondCurveId = dataset.curves[1].curveId;

    useAppStore.getState().loadDataset(dataset);
    useAppStore.getState().setCurvesSelected([firstCurveId, secondCurveId], true);
    useAppStore.getState().moveCurveOrder(secondCurveId, "up");

    const state = useAppStore.getState();
    const result = buildPcrChartOption({
      dataset,
      selectedCurveIds: state.selection?.selectedCurveIds ?? new Set<string>(),
      orderedCurveIds: state.selection?.orderedCurveIds,
      scale: state.chartScale,
      styleRules: state.styleRules,
      curveOverrides: state.curveOverrides
    });
    const option = result.option as Record<string, any>;

    expect(result.visibleCurves.map((curve) => curve.curveId)).toEqual([secondCurveId, firstCurveId]);
    expect(option.series.map((series: any) => series.id)).toEqual([secondCurveId, firstCurveId]);
  });

  it("keeps style overrides attached to curve IDs after legend order moves", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const firstCurveId = dataset.curves[0].curveId;
    const secondCurveId = dataset.curves[1].curveId;

    useAppStore.getState().loadDataset(dataset);
    useAppStore.getState().setCurvesSelected([firstCurveId, secondCurveId], true);
    useAppStore.getState().setCurveOverride(firstCurveId, { color: "#111111", markerType: "rect" });
    useAppStore.getState().setCurveOverride(secondCurveId, { color: "#222222", markerType: "circle" });
    useAppStore.getState().moveCurveOrder(secondCurveId, "up");

    expect(useAppStore.getState().curveOverrides[firstCurveId]).toMatchObject({
      color: "#111111",
      markerType: "rect"
    });
    expect(useAppStore.getState().curveOverrides[secondCurveId]).toMatchObject({
      color: "#222222",
      markerType: "circle"
    });

    const state = useAppStore.getState();
    const result = buildPcrChartOption({
      dataset,
      selectedCurveIds: state.selection?.selectedCurveIds ?? new Set<string>(),
      orderedCurveIds: state.selection?.orderedCurveIds,
      scale: state.chartScale,
      styleRules: state.styleRules,
      curveOverrides: state.curveOverrides
    });

    expect(result.legendItems.map((item) => item.curveId)).toEqual([secondCurveId, firstCurveId]);
    expect(result.legendItems.map((item) => item.color)).toEqual(["#222222", "#111111"]);
  });

  it("moves legend order against the previous selected curve even when unselected curves are between them", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const firstCurveId = dataset.curves[0].curveId;
    const hiddenMiddleCurveId = dataset.curves[1].curveId;
    const thirdCurveId = dataset.curves[2].curveId;

    useAppStore.getState().loadDataset(dataset);
    useAppStore.getState().setCurvesSelected([firstCurveId, thirdCurveId], true);
    useAppStore.getState().moveCurveOrder(thirdCurveId, "up");

    const state = useAppStore.getState();
    const result = buildPcrChartOption({
      dataset,
      selectedCurveIds: state.selection?.selectedCurveIds ?? new Set<string>(),
      orderedCurveIds: state.selection?.orderedCurveIds,
      scale: state.chartScale,
      styleRules: state.styleRules,
      curveOverrides: state.curveOverrides
    });

    expect(state.selection?.orderedCurveIds.slice(0, 3)).toEqual([thirdCurveId, hiddenMiddleCurveId, firstCurveId]);
    expect(result.visibleCurves.map((curve) => curve.curveId)).toEqual([thirdCurveId, firstCurveId]);
    expect(result.legendItems.map((item) => item.curveId)).toEqual([thirdCurveId, firstCurveId]);
  });

  it("keeps per-tab analysis state isolated behind the active-analysis facade", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const firstTabId = useAppStore.getState().activeAnalysisId;
    const firstCurveId = dataset.curves[0].curveId;
    const secondCurveId = dataset.curves[1].curveId;
    const firstGroupId = `group:reagent:${dataset.reagents[0].id}`;

    useAppStore.getState().loadDataset(dataset);
    useAppStore.getState().setCurvesSelected([firstCurveId, secondCurveId], true);
    useAppStore.getState().moveCurveOrder(secondCurveId, "up");
    useAppStore.getState().setSearchQuery("A1");
    useAppStore.getState().setSelectionFilter("selected");
    useAppStore.getState().setAllGroupsCollapsed(false);
    useAppStore.getState().setAxisPresetValue("y", "preset1", "min", "0");
    useAppStore.getState().setCurveOverride(firstCurveId, { color: "#111111" });
    useAppStore.getState().markExportSuccess("Saved plot1.png.");

    const secondTabId = useAppStore.getState().createAnalysis("Second analysis");
    expect(useAppStore.getState().activeAnalysisId).toBe(secondTabId);
    expect(useAppStore.getState().dataset).toBeNull();
    expect(useAppStore.getState().exportCounter).toBe(1);
    expect(useAppStore.getState().dirty).toBe(false);

    useAppStore.getState().loadDataset(dataset);
    useAppStore.getState().setCurvesSelected([secondCurveId], true);
    useAppStore.getState().setSearchQuery("A2");
    useAppStore.getState().setCurveOverride(secondCurveId, { color: "#222222" });

    useAppStore.getState().switchAnalysis(firstTabId);

    expect(useAppStore.getState().activeAnalysisId).toBe(firstTabId);
    expect(useAppStore.getState().searchQuery).toBe("A1");
    expect(useAppStore.getState().selectionFilter).toBe("selected");
    expect(useAppStore.getState().selection?.selectedCurveIds.has(firstCurveId)).toBe(true);
    expect(useAppStore.getState().selection?.selectedCurveIds.has(secondCurveId)).toBe(true);
    expect(useAppStore.getState().selection?.orderedCurveIds.slice(0, 2)).toEqual([secondCurveId, firstCurveId]);
    expect(useAppStore.getState().selection?.collapsedGroupIds.has(firstGroupId)).toBe(false);
    expect(useAppStore.getState().chartScale.y.preset1?.min).toBe("0");
    expect(useAppStore.getState().curveOverrides[firstCurveId]?.color).toBe("#111111");
    expect(useAppStore.getState().curveOverrides[secondCurveId]).toBeUndefined();
    expect(useAppStore.getState().exportCounter).toBe(2);

    useAppStore.getState().switchAnalysis(secondTabId);

    expect(useAppStore.getState().searchQuery).toBe("A2");
    expect(useAppStore.getState().selectionFilter).toBe("all");
    expect(useAppStore.getState().selection?.selectedCurveIds.has(firstCurveId)).toBe(false);
    expect(useAppStore.getState().selection?.selectedCurveIds.has(secondCurveId)).toBe(true);
    expect(useAppStore.getState().selection?.orderedCurveIds.slice(0, 2)).toEqual([firstCurveId, secondCurveId]);
    expect(useAppStore.getState().selection?.collapsedGroupIds.has(firstGroupId)).toBe(true);
    expect(useAppStore.getState().chartScale.y.preset1?.min).toBe("");
    expect(useAppStore.getState().curveOverrides[firstCurveId]).toBeUndefined();
    expect(useAppStore.getState().curveOverrides[secondCurveId]?.color).toBe("#222222");
    expect(useAppStore.getState().exportCounter).toBe(1);
  });

  it("marks a successful Analysis XLSX save as clean while advancing the saved counter", () => {
    useAppStore.getState().loadDataset(createOneSpecimenEightReagentDataset());

    expect(useAppStore.getState().dirty).toBe(true);

    useAppStore.getState().markAnalysisSaveSuccess("Saved 260708_analysis1.xlsx.");

    expect(useAppStore.getState().dirty).toBe(false);
    expect(useAppStore.getState().exportCounter).toBe(2);
    expect(useAppStore.getState().exportMessage).toBe("Saved 260708_analysis1.xlsx.");
    expect(useAppStore.getState().closeAnalysis(useAppStore.getState().activeAnalysisId)).toBe(true);
  });

  it("tracks analysis names, source summaries, and dirty close blocking per tab", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const firstTabId = useAppStore.getState().activeAnalysisId;

    expect(useAppStore.getState().closeAnalysis(firstTabId)).toBe(true);
    expect(useAppStore.getState().activeAnalysisId).toBe("analysis-1");
    expect(useAppStore.getState().dirty).toBe(false);

    useAppStore.getState().loadDataset(dataset);
    expect(useAppStore.getState().analysisName).toBe(dataset.sourceFileName);
    expect(useAppStore.getState().sourceFiles).toEqual([
      expect.objectContaining({
        fileName: dataset.sourceFileName,
        sheetName: dataset.sheetName,
        curveCount: dataset.curves.length
      })
    ]);
    expect(useAppStore.getState().dirty).toBe(true);
    expect(useAppStore.getState().closeAnalysis("analysis-1")).toBe(false);

    useAppStore.getState().renameAnalysis("analysis-1", "Respiratory run");

    expect(useAppStore.getState().analysisName).toBe("Respiratory run");
    expect(useAppStore.getState().analyses["analysis-1"].analysisName).toBe("Respiratory run");
    expect(useAppStore.getState().analyses["analysis-1"].dirty).toBe(true);
  });

  it("keeps source file summaries when appending Excel files to the active tab", async () => {
    await useAppStore.getState().importFile(createWorkbookFile("first.xlsx", "Specimen 1", "A1", 0.1));
    await useAppStore.getState().appendFile(createWorkbookFile("second.xlsx", "Specimen 2", "A2", 0.2));

    const state = useAppStore.getState();
    expect(state.dataset?.curves).toHaveLength(2);
    expect(state.sourceFiles.map((sourceFile) => sourceFile.fileName)).toEqual(["first.xlsx", "second.xlsx"]);
    expect(state.sourceFiles.map((sourceFile) => sourceFile.curveCount)).toEqual([1, 1]);
    expect(state.analyses[state.activeAnalysisId].sourceFiles.map((sourceFile) => sourceFile.fileName)).toEqual([
      "first.xlsx",
      "second.xlsx"
    ]);
  });

  it("clears pending preset undo after appending data to avoid stale override restoration", async () => {
    await useAppStore.getState().importFile(createWorkbookFile("first.xlsx", "Specimen 1", "A1", 0.1));
    const firstCurveId = useAppStore.getState().dataset?.curves[0].curveId ?? "";
    useAppStore.getState().applyStylePreset("reagentColorSolid", [firstCurveId]);

    expect(useAppStore.getState().lastPresetUndo).not.toBeNull();

    await useAppStore.getState().appendFile(createWorkbookFile("second.xlsx", "Specimen 2", "A2", 0.2));

    expect(useAppStore.getState().lastPresetUndo).toBeNull();
    expect(useAppStore.getState().lastPresetMessage).toBe("Preset undo was cleared after appended data.");
  });

  it("applies async import results only to the tab where import started", async () => {
    const firstTabId = useAppStore.getState().activeAnalysisId;
    const importPromise = useAppStore.getState().importFile(createWorkbookFile("first.xlsx", "Specimen 1", "A1", 0.1));
    const secondTabId = useAppStore.getState().createAnalysis("Second analysis");

    await importPromise;

    expect(useAppStore.getState().activeAnalysisId).toBe(secondTabId);
    expect(useAppStore.getState().dataset).toBeNull();
    expect(useAppStore.getState().analyses[firstTabId].dataset?.sourceFileName).toBe("first.xlsx");
    expect(useAppStore.getState().analyses[firstTabId].importStatus).toBe("ready");
    expect(useAppStore.getState().analyses[secondTabId].dataset).toBeNull();
  });

  it("applies async append results only to the tab where append started", async () => {
    await useAppStore.getState().importFile(createWorkbookFile("first.xlsx", "Specimen 1", "A1", 0.1));
    const firstTabId = useAppStore.getState().activeAnalysisId;
    const appendPromise = useAppStore.getState().appendFile(createWorkbookFile("second.xlsx", "Specimen 2", "A2", 0.2));
    const secondTabId = useAppStore.getState().createAnalysis("Second analysis");

    await appendPromise;

    expect(useAppStore.getState().activeAnalysisId).toBe(secondTabId);
    expect(useAppStore.getState().dataset).toBeNull();
    expect(useAppStore.getState().analyses[firstTabId].dataset?.curves).toHaveLength(2);
    expect(useAppStore.getState().analyses[firstTabId].sourceFiles.map((sourceFile) => sourceFile.fileName)).toEqual([
      "first.xlsx",
      "second.xlsx"
    ]);
    expect(useAppStore.getState().analyses[secondTabId].dataset).toBeNull();
  });

  it("applies async append-as-first-import to the empty tab where append started", async () => {
    const firstTabId = useAppStore.getState().activeAnalysisId;
    const appendPromise = useAppStore.getState().appendFile(createWorkbookFile("first.xlsx", "Specimen 1", "A1", 0.1));
    const secondTabId = useAppStore.getState().createAnalysis("Second analysis");

    await appendPromise;

    expect(useAppStore.getState().activeAnalysisId).toBe(secondTabId);
    expect(useAppStore.getState().dataset).toBeNull();
    expect(useAppStore.getState().analyses[firstTabId].dataset?.sourceFileName).toBe("first.xlsx");
    expect(useAppStore.getState().analyses[firstTabId].importStatus).toBe("ready");
    expect(useAppStore.getState().analyses[secondTabId].dataset).toBeNull();
  });

  it("blocks a pending replace result if the target tab becomes dirty before parsing finishes", async () => {
    const activeTabId = useAppStore.getState().activeAnalysisId;
    const delayedFile = createDelayedArrayBufferFile(createWorkbookFile("late.xlsx", "Specimen 1", "A1", 0.1));
    const importPromise = useAppStore.getState().importFile(delayedFile.file);

    useAppStore.getState().renameAnalysis(activeTabId, "Dirty while importing");
    delayedFile.release();
    await importPromise;

    expect(useAppStore.getState().activeAnalysisId).toBe(activeTabId);
    expect(useAppStore.getState().analysisName).toBe("Dirty while importing");
    expect(useAppStore.getState().dataset).toBeNull();
    expect(useAppStore.getState().importStatus).toBe("error");
    expect(useAppStore.getState().importError).toContain("Replace is blocked");
    expect(useAppStore.getState().dirty).toBe(true);
  });

  it("blocks a pending Analysis XLSX restore if the target tab becomes dirty before restore finishes", async () => {
    await useAppStore.getState().importFile(createWorkbookFile("source.xlsx", "Specimen 1", "A1", 0.1));
    const analysisFile = await createCurrentAnalysisXlsxFile("saved-analysis.xlsx");
    useAppStore.getState().reset();
    const targetTabId = useAppStore.getState().activeAnalysisId;
    const delayedFile = createDelayedArrayBufferFile(analysisFile);
    const importPromise = useAppStore.getState().importFile(delayedFile.file);

    useAppStore.getState().renameAnalysis(targetTabId, "Dirty restore target");
    delayedFile.release();
    await importPromise;

    expect(useAppStore.getState().activeAnalysisId).toBe(targetTabId);
    expect(useAppStore.getState().analysisName).toBe("Dirty restore target");
    expect(useAppStore.getState().dataset).toBeNull();
    expect(useAppStore.getState().importStatus).toBe("error");
    expect(useAppStore.getState().importError).toContain("Replace is blocked");
    expect(useAppStore.getState().dirty).toBe(true);
  });

  it("blocks dirty replace import and preserves the existing analysis", async () => {
    await useAppStore.getState().importFile(createWorkbookFile("first.xlsx", "Specimen 1", "A1", 0.1));
    const beforeDatasetId = useAppStore.getState().dataset?.datasetId;

    await useAppStore.getState().importFile(createWorkbookFile("replacement.xlsx", "Specimen 9", "A9", 9));

    expect(useAppStore.getState().dataset?.datasetId).toBe(beforeDatasetId);
    expect(useAppStore.getState().dataset?.sourceFileName).toBe("first.xlsx");
    expect(useAppStore.getState().importError).toContain("Replace is blocked");
    expect(useAppStore.getState().importStatus).toBe("ready");
  });

  it("preserves the existing analysis after failed append import", async () => {
    await useAppStore.getState().importFile(createWorkbookFile("first.xlsx", "Specimen 1", "A1", 0.1));
    const beforeCurveIds = useAppStore.getState().dataset?.orderedCurveIds;

    await useAppStore.getState().appendFile(
      {
        name: "bad.csv",
        arrayBuffer: async () => new ArrayBuffer(0)
      } as File
    );

    expect(useAppStore.getState().dataset?.orderedCurveIds).toEqual(beforeCurveIds);
    expect(useAppStore.getState().sourceFiles.map((sourceFile) => sourceFile.fileName)).toEqual(["first.xlsx"]);
    expect(useAppStore.getState().importError).toContain("Only .xls and .xlsx files are supported");
    expect(useAppStore.getState().importStatus).toBe("ready");
  });

  it("restores Analysis XLSX into the active clean tab without carrying runtime dirty state", async () => {
    await useAppStore.getState().importFile(createWorkbookFile("source.xlsx", "Specimen 1", "A1", 0.1));
    const firstCurveId = useAppStore.getState().dataset?.curves[0].curveId ?? "";
    useAppStore.getState().renameAnalysis(useAppStore.getState().activeAnalysisId, "Saved run");
    useAppStore.getState().setCurvesSelected([firstCurveId], true);
    useAppStore.getState().setSearchQuery("Specimen");
    useAppStore.getState().setAxisPresetValue("y", "preset1", "label", "Wide");
    useAppStore.getState().setAxisPresetValue("y", "preset1", "min", "0");
    useAppStore.getState().setCurveOverride(firstCurveId, { color: "#123456", lineType: "dotted" });
    useAppStore.getState().setLegendPreviewVisible(false);
    useAppStore.getState().setExportImageLayout("legendOnly");
    useAppStore.getState().markExportSuccess("Saved plot1.png.");
    const analysisFile = await createCurrentAnalysisXlsxFile("saved-analysis.xlsx");

    const targetTabId = useAppStore.getState().createAnalysis("Restore target");
    await useAppStore.getState().importFile(analysisFile);

    const state = useAppStore.getState();
    expect(state.activeAnalysisId).toBe(targetTabId);
    expect(state.analysisName).toBe("Saved run");
    expect(state.dataset?.sourceFileName).toBe("source.xlsx");
    expect(state.selection?.selectedCurveIds.has(firstCurveId)).toBe(true);
    expect(state.searchQuery).toBe("Specimen");
    expect(state.chartScale.y.preset1?.label).toBe("Wide");
    expect(state.curveOverrides[firstCurveId]).toMatchObject({ color: "#123456", lineType: "dotted" });
    expect(state.legendSettings.previewVisible).toBe(false);
    expect(state.exportSettings.imageLayout).toBe("legendOnly");
    expect(state.exportCounter).toBe(2);
    expect(state.dirty).toBe(false);
    expect(state.analyses[targetTabId].dirty).toBe(false);
  });

  it("opens appended Analysis XLSX as a new independent tab instead of merging into the active dataset", async () => {
    await useAppStore.getState().importFile(createWorkbookFile("source.xlsx", "Specimen 1", "A1", 0.1));
    const sourceTabId = useAppStore.getState().activeAnalysisId;
    const sourceCurveCount = useAppStore.getState().dataset?.curves.length;
    const firstCurveId = useAppStore.getState().dataset?.curves[0].curveId ?? "";
    useAppStore.getState().renameAnalysis(sourceTabId, "Saved run");
    useAppStore.getState().setCurvesSelected([firstCurveId], true);
    useAppStore.getState().setCurveOverride(firstCurveId, { markerType: "triangle" });
    useAppStore.getState().setLegendPreviewVisible(false);
    useAppStore.getState().setExportImageLayout("legendOnly");
    useAppStore.getState().markExportSuccess("Saved plot1.png.");
    const analysisFile = await createCurrentAnalysisXlsxFile("saved-analysis.xlsx");

    await useAppStore.getState().appendFile(analysisFile);

    const state = useAppStore.getState();
    expect(state.activeAnalysisId).not.toBe(sourceTabId);
    expect(state.analysisOrder).toHaveLength(2);
    expect(state.analysisName).toBe("Saved run");
    expect(state.dataset?.curves).toHaveLength(sourceCurveCount ?? 0);
    expect(state.selection?.selectedCurveIds.has(firstCurveId)).toBe(true);
    expect(state.curveOverrides[firstCurveId]?.markerType).toBe("triangle");
    expect(state.legendSettings.previewVisible).toBe(false);
    expect(state.exportSettings.imageLayout).toBe("legendOnly");
    expect(state.exportCounter).toBe(2);
    expect(state.dirty).toBe(false);
    expect(state.analyses[sourceTabId].dataset?.curves).toHaveLength(sourceCurveCount ?? 0);
    expect(state.analyses[sourceTabId].exportCounter).toBe(2);
    expect(state.analyses[sourceTabId].importStatus).toBe("ready");
  });

  it("treats corrupted Analysis XLSX markers as restore errors instead of generic Excel data", async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([["IsoAmplar Plot Analysis restore file"]]),
      "README"
    );
    const file = createFileFromWorkbook(workbook, "broken-analysis.xlsx");

    await useAppStore.getState().importFile(file);

    expect(useAppStore.getState().dataset).toBeNull();
    expect(useAppStore.getState().importStatus).toBe("error");
    expect(useAppStore.getState().importError).toContain("restore sheet is missing");
  });

  it("imports ordinary Excel files with review-like sheet names as source data", async () => {
    await useAppStore.getState().importFile(createWorkbookFile("ordinary-settings.xlsx", "Specimen 1", "A1", 0.1, "Settings"));

    expect(useAppStore.getState().dataset?.sourceFileName).toBe("ordinary-settings.xlsx");
    expect(useAppStore.getState().dataset?.sheetName).toBe("Settings");
    expect(useAppStore.getState().importStatus).toBe("ready");
    expect(useAppStore.getState().importError).toBeNull();
  });

  it("blocks dirty replace when the incoming file is an Analysis XLSX restore file", async () => {
    await useAppStore.getState().importFile(createWorkbookFile("source.xlsx", "Specimen 1", "A1", 0.1));
    const beforeDatasetId = useAppStore.getState().dataset?.datasetId;
    const analysisFile = await createCurrentAnalysisXlsxFile("saved-analysis.xlsx");

    await useAppStore.getState().importFile(analysisFile);

    expect(useAppStore.getState().dataset?.datasetId).toBe(beforeDatasetId);
    expect(useAppStore.getState().dataset?.sourceFileName).toBe("source.xlsx");
    expect(useAppStore.getState().importError).toContain("Replace is blocked");
    expect(useAppStore.getState().importStatus).toBe("ready");
  });
});

function getFirstSeriesSymbol(dataset: PcrDataset) {
  const state = useAppStore.getState();
  const option = buildPcrChartOption({
    dataset,
    selectedCurveIds: state.selection?.selectedCurveIds ?? new Set<string>(),
    orderedCurveIds: state.selection?.orderedCurveIds,
    scale: state.chartScale,
    styleRules: state.styleRules,
    curveOverrides: state.curveOverrides
  }).option as Record<string, any>;

  return option.series[0]?.symbol;
}

function createWorkbookFile(fileName: string, specimen: string, reagent: string, yValue: number, sheetName = "Sheet1") {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([[specimen], [reagent], [yValue]]), sheetName);
  return createFileFromWorkbook(workbook, fileName);
}

function createFileFromWorkbook(workbook: XLSX.WorkBook, fileName: string) {
  const output = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer | Uint8Array | number[];
  const arrayBuffer = toArrayBuffer(output);
  return {
    name: fileName,
    arrayBuffer: async () => arrayBuffer
  } as File;
}

function createDelayedArrayBufferFile(sourceFile: File) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let shouldDelay = true;

  return {
    file: {
      name: sourceFile.name,
      arrayBuffer: async () => {
        if (shouldDelay) {
          shouldDelay = false;
          await gate;
        }
        return sourceFile.arrayBuffer();
      }
    } as File,
    release
  };
}

async function createCurrentAnalysisXlsxFile(fileName: string) {
  const state = useAppStore.getState();
  if (!state.dataset || !state.selection) {
    throw new Error("A dataset must be loaded before creating an Analysis XLSX test file.");
  }

  const arrayBuffer = await exportAnalysisWorkbookBuffer(
    createAnalysisState({
      analysisId: state.activeAnalysisId,
      analysisName: state.analysisName,
      dataset: state.dataset,
      selection: state.selection,
      searchQuery: state.searchQuery,
      selectionFilter: state.selectionFilter,
      chartScale: state.chartScale,
      styleRules: state.styleRules,
      curveOverrides: state.curveOverrides,
      legendSettings: state.legendSettings,
      exportSettings: state.exportSettings,
      exportCounter: state.exportCounter,
      importFileName: state.importFileName,
      sourceFiles: state.sourceFiles,
      dirty: state.dirty
    })
  );
  return {
    name: fileName,
    arrayBuffer: async () => arrayBuffer
  } as File;
}

function toArrayBuffer(output: ArrayBuffer | Uint8Array | number[]) {
  if (output instanceof ArrayBuffer) return output;
  if (Array.isArray(output)) return new Uint8Array(output).buffer;
  return output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer;
}
