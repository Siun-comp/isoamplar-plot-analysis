import { beforeEach, describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { createOneSpecimenEightReagentDataset } from "../data/sampleData";
import { parsePastedTable } from "../data/parsePastedTable";
import type { PcrDataset } from "../data/types";
import { buildPcrChartOption } from "../chart/chartConfig";
import { createAnalysisState } from "../analysis/analysisState";
import { ANALYSIS_RESTORE_SHEET_NAME, exportAnalysisWorkbookBuffer } from "../analysis/analysisWorkbook";
import { useAppStore } from "./appStore";

describe("app store style preset and legend order", () => {
  beforeEach(() => {
    useAppStore.getState().reset();
  });

  it("appends a previewed paste dataset without changing existing selection or overrides", () => {
    const base = createOneSpecimenEightReagentDataset();
    useAppStore.getState().loadDataset(base);
    const firstCurveId = base.curves[0].curveId;
    useAppStore.getState().setCurvesSelected([firstCurveId], true);
    useAppStore.getState().setCurveOverride(firstCurveId, { color: "#123456" });
    const target = useAppStore.getState();
    const pasted = parsePastedTable("Specimen 2\nA9\n0.2\n1.2", {
      mode: "fullTable",
      sourceName: "Paste comparison",
      sourceInstanceId: "paste-store-test"
    });
    expect(pasted.ok).toBe(true);
    if (!pasted.ok) return;

    const result = useAppStore
      .getState()
      .appendPastedDataset(pasted.dataset, target.activeAnalysisId, target.runtimeInstanceId, target.revision);

    expect(result.ok).toBe(true);
    const state = useAppStore.getState();
    expect(state.dataset?.curves).toHaveLength(9);
    expect(state.selection?.selectedCurveIds).toEqual(new Set([firstCurveId]));
    expect(state.curveOverrides[firstCurveId]?.color).toBe("#123456");
    expect(state.selection?.orderedCurveIds.at(-1)).toBe("file2_paste0_col_A");
    expect(state.sourceFiles).toHaveLength(2);
    expect(state.dirty).toBe(true);
  });

  it("rejects a paste preview when its target analysis changed or was recreated", () => {
    const pasted = parsePastedTable("S1\nA1\n0.1", { mode: "fullTable", sourceName: "Paste" });
    expect(pasted.ok).toBe(true);
    if (!pasted.ok) return;
    const target = useAppStore.getState();

    useAppStore.getState().setSearchQuery("changed");
    const changedResult = useAppStore
      .getState()
      .appendPastedDataset(pasted.dataset, target.activeAnalysisId, target.runtimeInstanceId, target.revision);
    expect(changedResult.ok).toBe(false);

    const current = useAppStore.getState();
    useAppStore.getState().closeAnalysis(current.activeAnalysisId, { force: true });
    const recreatedResult = useAppStore
      .getState()
      .appendPastedDataset(pasted.dataset, current.activeAnalysisId, current.runtimeInstanceId, current.revision);
    expect(recreatedResult.ok).toBe(false);
    expect(useAppStore.getState().dataset).toBeNull();
  });

  it("opens a paste dataset in a new dirty and unselected analysis", () => {
    const pasted = parsePastedTable("S1\nA1\n0.1", { mode: "fullTable", sourceName: "New comparison" });
    expect(pasted.ok).toBe(true);
    if (!pasted.ok) return;

    const target = useAppStore.getState();
    const result = useAppStore
      .getState()
      .openPastedDatasetInNewAnalysis(
        pasted.dataset,
        target.activeAnalysisId,
        target.runtimeInstanceId,
        target.revision
      );
    expect(result).toEqual({ ok: true, analysisId: "analysis-2" });
    const state = useAppStore.getState();
    expect(state.activeAnalysisId).toBe("analysis-2");
    expect(state.analysisName).toBe("New comparison");
    expect(state.selection?.selectedCurveIds.size).toBe(0);
    expect(state.dirty).toBe(true);
  });

  it("rejects opening a stale paste preview in a new analysis", () => {
    const pasted = parsePastedTable("S1\nA1\n0.1", { mode: "fullTable", sourceName: "Paste" });
    expect(pasted.ok).toBe(true);
    if (!pasted.ok) return;
    const target = useAppStore.getState();

    useAppStore.getState().setSearchQuery("changed after preview");
    const changedResult = useAppStore
      .getState()
      .openPastedDatasetInNewAnalysis(
        pasted.dataset,
        target.activeAnalysisId,
        target.runtimeInstanceId,
        target.revision
      );

    expect(changedResult.ok).toBe(false);
    expect(useAppStore.getState().analysisOrder).toEqual([target.activeAnalysisId]);

    useAppStore.getState().closeAnalysis(target.activeAnalysisId, { force: true });
    const closedResult = useAppStore
      .getState()
      .openPastedDatasetInNewAnalysis(
        pasted.dataset,
        target.activeAnalysisId,
        target.runtimeInstanceId,
        target.revision
      );
    expect(closedResult.ok).toBe(false);
    expect(useAppStore.getState().analysisOrder).toHaveLength(1);
  });

  it("applies a preset by overwriting selected curve overrides and supports one-step undo", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const firstCurveId = dataset.curves[0].curveId;

    useAppStore.getState().loadDataset(dataset);
    useAppStore.getState().setCurveOverride(firstCurveId, { color: "#111111", lineType: "dotted" });
    useAppStore.getState().applyStylePreset("reagentColorSolid", [firstCurveId]);

    expect(useAppStore.getState().curveOverrides[firstCurveId]).toMatchObject({
      color: "#7030A0",
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
      color: "#0926FB",
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
      color: "#7030A0",
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
    expect(state.chartScale.y.applied).toEqual({ mode: "preset1", min: 0, max: 100 });

    useAppStore.getState().setCurvesSelected([firstCurveId], false);
    expect(useAppStore.getState().chartScale.y.mode).toBe("preset1");

    useAppStore.getState().loadDataset(dataset);
    expect(useAppStore.getState().chartScale.y.preset1?.min).toBe("");
  });

  it("applies box zoom bounds as fixed X/Y scale without changing presets", () => {
    const dataset = createOneSpecimenEightReagentDataset();

    useAppStore.getState().loadDataset(dataset);
    useAppStore.getState().setAxisPresetValue("x", "preset1", "label", "P1 overview");
    useAppStore.getState().setAxisPresetValue("x", "preset1", "min", "1");
    useAppStore.getState().setAxisPresetValue("x", "preset1", "max", "60");
    useAppStore.getState().setChartFixedScaleBounds({
      xMin: "18.5",
      xMax: "42",
      yMin: "120000",
      yMax: "900000"
    });

    const state = useAppStore.getState();
    expect(state.chartScale.x).toMatchObject({
      mode: "fixed",
      fixedMin: "18.5",
      fixedMax: "42",
      preset1: { label: "P1 overview", min: "1", max: "60" },
      applied: { mode: "fixed", min: 18.5, max: 42 }
    });
    expect(state.chartScale.y).toMatchObject({
      mode: "fixed",
      fixedMin: "120000",
      fixedMax: "900000",
      applied: { mode: "fixed", min: 120000, max: 900000 }
    });
  });

  it("preserves applied bounds while an active draft becomes invalid", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    useAppStore.getState().loadDataset(dataset);
    useAppStore.getState().setAxisScaleMode("y", "fixed");
    useAppStore.getState().setAxisFixedValue("y", "min", "-1");
    useAppStore.getState().setAxisFixedValue("y", "max", "100");
    expect(useAppStore.getState().chartScale.y.applied).toEqual({ mode: "fixed", min: -1, max: 100 });

    useAppStore.getState().setAxisFixedValue("y", "max", "-2");

    expect(useAppStore.getState().chartScale.y).toMatchObject({
      mode: "fixed",
      fixedMin: "-1",
      fixedMax: "-2",
      applied: { mode: "fixed", min: -1, max: 100 }
    });
  });

  it("returns from box zoom to previous scale snapshots without losing preset definitions", () => {
    const dataset = createOneSpecimenEightReagentDataset();

    useAppStore.getState().loadDataset(dataset);
    useAppStore.getState().setAxisPresetValue("x", "preset1", "label", "Overview");
    useAppStore.getState().setAxisPresetValue("x", "preset1", "min", "1");
    useAppStore.getState().setAxisPresetValue("x", "preset1", "max", "60");
    useAppStore.getState().setAxisScaleMode("x", "preset1");
    useAppStore.getState().setAxisFixedValue("y", "min", "-100000");
    useAppStore.getState().setAxisFixedValue("y", "max", "1200000");
    useAppStore.getState().setAxisScaleMode("y", "fixed");

    useAppStore.getState().applyBoxZoomScale({
      xMin: "18",
      xMax: "42",
      yMin: "100000",
      yMax: "900000"
    });
    expect(useAppStore.getState().chartScaleReturnStack).toHaveLength(1);
    useAppStore.getState().applyBoxZoomScale({
      xMin: "24",
      xMax: "36",
      yMin: "200000",
      yMax: "800000"
    });
    expect(useAppStore.getState().chartScaleReturnStack).toHaveLength(2);

    useAppStore.getState().returnFromBoxZoom();
    expect(useAppStore.getState().chartScale.x).toMatchObject({
      mode: "fixed",
      fixedMin: "18",
      fixedMax: "42"
    });

    useAppStore.getState().returnFromBoxZoom();

    expect(useAppStore.getState().chartScale.x).toMatchObject({
      mode: "preset1",
      preset1: { label: "Overview", min: "1", max: "60" }
    });
    expect(useAppStore.getState().chartScale.y).toMatchObject({
      mode: "fixed",
      fixedMin: "-100000",
      fixedMax: "1200000"
    });
    expect(useAppStore.getState().chartScaleReturnStack).toHaveLength(0);
  });

  it("clears box zoom return history when scale is changed explicitly", () => {
    const dataset = createOneSpecimenEightReagentDataset();

    useAppStore.getState().loadDataset(dataset);
    useAppStore.getState().applyBoxZoomScale({
      xMin: "18",
      xMax: "42",
      yMin: "100000",
      yMax: "900000"
    });
    expect(useAppStore.getState().chartScaleReturnStack).toHaveLength(1);

    useAppStore.getState().resetScaleToAuto();
    expect(useAppStore.getState().chartScale.x.mode).toBe("auto");
    expect(useAppStore.getState().chartScale.y.mode).toBe("auto");
    expect(useAppStore.getState().chartScaleReturnStack).toHaveLength(0);

    useAppStore.getState().applyBoxZoomScale({
      xMin: "20",
      xMax: "30",
      yMin: "200000",
      yMax: "600000"
    });
    useAppStore.getState().setAxisScaleMode("x", "auto");
    expect(useAppStore.getState().chartScaleReturnStack).toHaveLength(0);
  });

  it("keeps box zoom return history independent per analysis tab", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const firstTabId = useAppStore.getState().activeAnalysisId;

    useAppStore.getState().loadDataset(dataset);
    useAppStore.getState().applyBoxZoomScale({
      xMin: "18",
      xMax: "42",
      yMin: "100000",
      yMax: "900000"
    });

    const secondTabId = useAppStore.getState().createAnalysis("Second");
    expect(useAppStore.getState().activeAnalysisId).toBe(secondTabId);
    expect(useAppStore.getState().chartScaleReturnStack).toHaveLength(0);

    useAppStore.getState().switchAnalysis(firstTabId);
    expect(useAppStore.getState().chartScaleReturnStack).toHaveLength(1);
    useAppStore.getState().returnFromBoxZoom();
    expect(useAppStore.getState().chartScale.x.mode).toBe("auto");
    expect(useAppStore.getState().chartScale.y.mode).toBe("auto");
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
    expect(useAppStore.getState().legendSettings).toEqual({
      previewVisible: true,
      reportLabelMode: "autoCompact",
      reportNameOverrides: {}
    });
    expect(useAppStore.getState().exportSettings.imageLayout).toBe("plotWithLegend");

    useAppStore.getState().switchAnalysis(firstTabId);
    expect(useAppStore.getState().legendSettings.previewVisible).toBe(false);
    expect(useAppStore.getState().exportSettings.imageLayout).toBe("legendOnly");

    useAppStore.getState().switchAnalysis(secondTabId);
    useAppStore.getState().loadDataset(dataset);
    expect(useAppStore.getState().legendSettings).toEqual({
      previewVisible: true,
      reportLabelMode: "autoCompact",
      reportNameOverrides: {}
    });
    expect(useAppStore.getState().exportSettings.imageLayout).toBe("plotWithLegend");
  });

  it("promotes legacy report legend name actions to analysis labels", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const curve = dataset.curves[0];

    useAppStore.getState().loadDataset(dataset);
    useAppStore.getState().setReportLegendLabelMode("full");
    useAppStore.getState().setReportLegendName(curve.curveId, "Report only A1");

    expect(useAppStore.getState().legendSettings).toMatchObject({
      reportLabelMode: "full",
      reportNameOverrides: {}
    });
    expect(useAppStore.getState().curveOverrides[curve.curveId].displayName).toBe("Report only A1");
    expect(useAppStore.getState().curveOverrides[curve.curveId].fieldSources?.displayName).toBe("custom");

    useAppStore.getState().resetReportLegendName(curve.curveId);
    expect(useAppStore.getState().legendSettings.reportNameOverrides[curve.curveId]).toBeUndefined();
    expect(useAppStore.getState().curveOverrides[curve.curveId]).toBeUndefined();
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
    const target = useAppStore.getState();
    const result = useAppStore.getState().markAnalysisSaveSuccess({
      analysisId: target.activeAnalysisId,
      runtimeInstanceId: target.runtimeInstanceId,
      expectedRevision: target.revision,
      savedExportCounter: target.exportCounter + 1,
      message: "Saved 260708_analysis1.xlsx."
    });

    expect(result).toBe("saved");
    expect(useAppStore.getState().dirty).toBe(false);
    expect(useAppStore.getState().exportCounter).toBe(2);
    expect(useAppStore.getState().exportMessage).toBe("Saved 260708_analysis1.xlsx.");
    expect(useAppStore.getState().closeAnalysis(useAppStore.getState().activeAnalysisId)).toBe(true);
  });

  it("keeps an analysis dirty when it changes while an Analysis XLSX snapshot is being saved", () => {
    useAppStore.getState().loadDataset(createOneSpecimenEightReagentDataset());
    const target = useAppStore.getState();
    useAppStore.getState().setSearchQuery("changed during save");

    const result = useAppStore.getState().markAnalysisSaveSuccess({
      analysisId: target.activeAnalysisId,
      runtimeInstanceId: target.runtimeInstanceId,
      expectedRevision: target.revision,
      savedExportCounter: target.exportCounter + 1,
      message: "Saved snapshot.xlsx."
    });

    expect(result).toBe("changed");
    expect(useAppStore.getState().dirty).toBe(true);
    expect(useAppStore.getState().exportCounter).toBe(target.exportCounter + 1);
    expect(useAppStore.getState().exportMessage).toContain("저장 안 됨 상태를 유지");
  });

  it("routes a completed export to its starting analysis after switching tabs", () => {
    useAppStore.getState().loadDataset(createOneSpecimenEightReagentDataset());
    const firstId = useAppStore.getState().activeAnalysisId;
    const firstDirty = useAppStore.getState().dirty;
    const job = useAppStore.getState().beginExportJob("file", true);
    expect(job).not.toBeNull();

    const secondId = useAppStore.getState().createAnalysis("Second");
    expect(useAppStore.getState().completeExportJob(job!, "Saved A.png.")).toBe("completed");

    expect(useAppStore.getState().activeAnalysisId).toBe(secondId);
    expect(useAppStore.getState().exportMessage).toBeNull();
    expect(useAppStore.getState().analyses[firstId].exportMessage).toBe("Saved A.png.");
    expect(useAppStore.getState().analyses[firstId].exportCounter).toBe(2);
    expect(useAppStore.getState().analyses[firstId].dirty).toBe(firstDirty);
  });

  it("does not mutate a closed or replaced runtime when an old output job completes", () => {
    useAppStore.getState().loadDataset(createOneSpecimenEightReagentDataset());
    const closedJob = useAppStore.getState().beginExportJob("file", true)!;
    useAppStore.getState().closeAnalysis(closedJob.analysisId, { force: true });
    expect(useAppStore.getState().completeExportJob(closedJob, "stale")).toBe("missing");
    expect(useAppStore.getState().exportCounter).toBe(1);
    expect(useAppStore.getState().exportMessage).toBeNull();

    useAppStore.getState().loadDataset(createOneSpecimenEightReagentDataset());
    const replacedJob = useAppStore.getState().beginExportJob("file", true)!;
    useAppStore.getState().loadDataset(createOneSpecimenEightReagentDataset());
    expect(useAppStore.getState().completeExportJob(replacedJob, "stale")).toBe("missing");
    expect(useAppStore.getState().exportCounter).toBe(1);
  });

  it("keeps later changes dirty when an Analysis XLSX snapshot completes", () => {
    useAppStore.getState().loadDataset(createOneSpecimenEightReagentDataset());
    const job = useAppStore.getState().beginExportJob("analysisSave", true)!;
    useAppStore.getState().setSearchQuery("changed during save");

    expect(useAppStore.getState().completeExportJob(job, "Saved snapshot.xlsx.", "2026-07-11T03:00:00.000Z")).toBe(
      "changed"
    );
    const state = useAppStore.getState();
    expect(state.dirty).toBe(true);
    expect(state.saveStatus).toBe("changed");
    expect(state.lastSavedAtIso).toBe("2026-07-11T03:00:00.000Z");
    expect(state.exportCounter).toBe(2);
    expect(state.exportMessage).toContain("이후 변경 있음");
  });

  it("reuses a failed output counter and does not consume counters for clipboard jobs", () => {
    useAppStore.getState().loadDataset(createOneSpecimenEightReagentDataset());
    const failed = useAppStore.getState().beginExportJob("file", true)!;
    expect(useAppStore.getState().beginExportJob("file", true)).toBeNull();
    expect(useAppStore.getState().failExportJob(failed, "failed")).toBe("failed");
    expect(useAppStore.getState().exportCounter).toBe(1);

    const retry = useAppStore.getState().beginExportJob("file", true)!;
    expect(retry.reservedCounter).toBe(1);
    useAppStore.getState().completeExportJob(retry, "saved");
    expect(useAppStore.getState().exportCounter).toBe(2);

    const clipboard = useAppStore.getState().beginExportJob("clipboard", false)!;
    useAppStore.getState().completeExportJob(clipboard, "copied");
    expect(useAppStore.getState().exportCounter).toBe(2);
  });

  it("allows independent output jobs in different analyses", () => {
    useAppStore.getState().loadDataset(createOneSpecimenEightReagentDataset());
    const firstJob = useAppStore.getState().beginExportJob("file", true)!;
    useAppStore.getState().createAnalysis("Second");
    useAppStore.getState().loadDataset(createOneSpecimenEightReagentDataset());
    const secondJob = useAppStore.getState().beginExportJob("file", true)!;

    expect(firstJob.analysisId).not.toBe(secondJob.analysisId);
    expect(useAppStore.getState().completeExportJob(firstJob, "first")).toBe("completed");
    expect(useAppStore.getState().completeExportJob(secondJob, "second")).toBe("completed");
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

  it("allows dirty close only when force close is explicitly requested", () => {
    useAppStore.getState().loadDataset(createOneSpecimenEightReagentDataset());
    const activeTabId = useAppStore.getState().activeAnalysisId;

    expect(useAppStore.getState().closeAnalysis(activeTabId)).toBe(false);
    expect(useAppStore.getState().closeAnalysis(activeTabId, { force: true })).toBe(true);
    expect(useAppStore.getState().analysisOrder).toEqual(["analysis-1"]);
    expect(useAppStore.getState().dirty).toBe(false);
    expect(useAppStore.getState().dataset).toBeNull();
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
    expect(useAppStore.getState().importError).toContain("저장 안 된 분석 변경사항");
    expect(useAppStore.getState().dirty).toBe(true);
  });

  it("rejects Analysis XLSX from the original-data command without changing its dirty target", async () => {
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
    expect(useAppStore.getState().importError).toContain("저장한 분석 열기");
    expect(useAppStore.getState().dirty).toBe(true);
  });

  it("blocks dirty replace import and preserves the existing analysis", async () => {
    await useAppStore.getState().importFile(createWorkbookFile("first.xlsx", "Specimen 1", "A1", 0.1));
    const beforeDatasetId = useAppStore.getState().dataset?.datasetId;

    await useAppStore.getState().importFile(createWorkbookFile("replacement.xlsx", "Specimen 9", "A9", 9));

    expect(useAppStore.getState().dataset?.datasetId).toBe(beforeDatasetId);
    expect(useAppStore.getState().dataset?.sourceFileName).toBe("first.xlsx");
    expect(useAppStore.getState().importError).toContain("저장 안 된 분석 변경사항");
    expect(useAppStore.getState().importStatus).toBe("ready");
  });

  it("replaces a dirty analysis only through explicit replace confirmation mode", async () => {
    await useAppStore.getState().importFile(createWorkbookFile("first.xlsx", "Specimen 1", "A1", 0.1));

    await useAppStore.getState().importFileWithMode(createWorkbookFile("replacement.xlsx", "Specimen 9", "A9", 9), "replace");

    const state = useAppStore.getState();
    expect(state.analysisOrder).toHaveLength(1);
    expect(state.dataset?.sourceFileName).toBe("replacement.xlsx");
    expect(state.dataset?.curves[0].specimenLabel).toBe("Specimen 9");
    expect(state.dirty).toBe(true);
    expect(state.importError).toBeNull();
  });

  it("uses the confirmation-time target tab for explicit replace even if the active tab changes", async () => {
    await useAppStore.getState().importFile(createWorkbookFile("first.xlsx", "Specimen 1", "A1", 0.1));
    const firstTabId = useAppStore.getState().activeAnalysisId;
    const secondTabId = useAppStore.getState().createAnalysis("Second analysis");

    await useAppStore
      .getState()
      .importFileWithMode(createWorkbookFile("replacement.xlsx", "Specimen 9", "A9", 9), "replace", firstTabId);

    const state = useAppStore.getState();
    expect(state.activeAnalysisId).toBe(secondTabId);
    expect(state.dataset).toBeNull();
    expect(state.analyses[firstTabId].dataset?.sourceFileName).toBe("replacement.xlsx");
    expect(state.analyses[firstTabId].dataset?.curves[0].specimenLabel).toBe("Specimen 9");
    expect(state.analyses[secondTabId].dataset).toBeNull();
  });

  it("opens source Excel as a new analysis through explicit new-tab confirmation mode", async () => {
    await useAppStore.getState().importFile(createWorkbookFile("first.xlsx", "Specimen 1", "A1", 0.1));
    const firstTabId = useAppStore.getState().activeAnalysisId;

    await useAppStore.getState().importFileWithMode(createWorkbookFile("second.xlsx", "Specimen 2", "A2", 0.2), "newTab");

    const state = useAppStore.getState();
    expect(state.activeAnalysisId).not.toBe(firstTabId);
    expect(state.analysisOrder).toHaveLength(2);
    expect(state.analyses[firstTabId].dataset?.sourceFileName).toBe("first.xlsx");
    expect(state.analyses[firstTabId].importStatus).toBe("ready");
    expect(state.dataset?.sourceFileName).toBe("second.xlsx");
    expect(state.dataset?.curves[0].specimenLabel).toBe("Specimen 2");
    expect(state.dirty).toBe(true);
  });

  it("drops a stale new-tab parse failure after its starting runtime is closed and recreated", async () => {
    const target = useAppStore.getState();
    const delayedFile = createDelayedArrayBufferFile(new File([new Uint8Array([1, 2, 3])], "broken.xlsx"));
    const importPromise = useAppStore
      .getState()
      .importFileWithMode(delayedFile.file, "newTab", target.activeAnalysisId);

    useAppStore.getState().closeAnalysis(target.activeAnalysisId, { force: true });
    expect(useAppStore.getState().activeAnalysisId).toBe(target.activeAnalysisId);
    expect(useAppStore.getState().runtimeInstanceId).not.toBe(target.runtimeInstanceId);
    delayedFile.release();
    await importPromise;

    expect(useAppStore.getState().importError).toBeNull();
    expect(useAppStore.getState().analysisOrder).toHaveLength(1);
    expect(useAppStore.getState().dataset).toBeNull();
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

  it("opens Analysis XLSX in a new clean tab without carrying runtime dirty state", async () => {
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
    await useAppStore.getState().openAnalysisFile(analysisFile);

    const state = useAppStore.getState();
    expect(state.activeAnalysisId).not.toBe(targetTabId);
    expect(state.analysisOrder).toHaveLength(3);
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
    expect(state.analyses[targetTabId].dataset).toBeNull();
  });

  it("opens Analysis XLSX through its dedicated command as a new independent tab", async () => {
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

    await useAppStore.getState().openAnalysisFile(analysisFile);

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

  it("rejects semantically corrupted Analysis XLSX without changing the current analysis", async () => {
    await useAppStore.getState().importFile(createWorkbookFile("current.xlsx", "Current specimen", "A1", 0.1));
    const curveId = useAppStore.getState().dataset!.curves[0].curveId;
    useAppStore.getState().setCurveOverride(curveId, { color: "#123456" });
    const before = useAppStore.getState();
    const corruptedFile = await createSemanticallyCorruptedAnalysisXlsxFile("corrupted-analysis.xlsx");

    await useAppStore.getState().openAnalysisFile(corruptedFile);

    const after = useAppStore.getState();
    expect(after.activeAnalysisId).toBe(before.activeAnalysisId);
    expect(after.dataset?.datasetId).toBe(before.dataset?.datasetId);
    expect(after.curveOverrides[curveId]?.color).toBe("#123456");
    expect(after.revision).toBe(before.revision);
    expect(after.dirty).toBe(true);
    expect(after.importStatus).toBe("ready");
    expect(after.importError).toContain("stats does not match");
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
    expect(useAppStore.getState().importError).toContain("저장 안 된 분석 변경사항");
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

async function createSemanticallyCorruptedAnalysisXlsxFile(fileName: string) {
  const validFile = await createCurrentAnalysisXlsxFile(fileName);
  const workbook = XLSX.read(await validFile.arrayBuffer(), { type: "array", raw: true });
  const restoreRows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[ANALYSIS_RESTORE_SHEET_NAME], {
    header: 1,
    blankrows: false
  });
  const chunkCount = Number(restoreRows.find((row) => row[0] === "chunkCount")?.[1]);
  const chunks = restoreRows
    .filter((row) => typeof row[0] === "number" && typeof row[1] === "string")
    .sort((left, right) => Number(left[0]) - Number(right[0]))
    .map((row) => String(row[1]));
  expect(chunks).toHaveLength(chunkCount);
  const payload = JSON.parse(chunks.join(""));
  payload.dataset.curves[0].stats.pointCount += 1;
  const corruptedJson = JSON.stringify(payload);
  const corruptedChunks = Array.from(
    { length: Math.ceil(corruptedJson.length / 30000) },
    (_, index) => corruptedJson.slice(index * 30000, (index + 1) * 30000)
  );
  workbook.Sheets[ANALYSIS_RESTORE_SHEET_NAME] = XLSX.utils.aoa_to_sheet([
    ["IsoAmplarAnalysis"],
    ["schemaVersion", payload.schemaVersion],
    ["chunkCount", corruptedChunks.length],
    ["chunkIndex", "jsonChunk"],
    ...corruptedChunks.map((chunk, index) => [index, chunk])
  ]);
  const output = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer | Uint8Array | number[];
  const arrayBuffer = toArrayBuffer(output);
  return { name: fileName, arrayBuffer: async () => arrayBuffer } as File;
}

function toArrayBuffer(output: ArrayBuffer | Uint8Array | number[]) {
  if (output instanceof ArrayBuffer) return output;
  if (Array.isArray(output)) return new Uint8Array(output).buffer;
  return output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer;
}
