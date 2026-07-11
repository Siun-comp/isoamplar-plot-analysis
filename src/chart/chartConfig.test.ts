import { describe, expect, it } from "vitest";
import { createDefaultChartScale, getAppliedAxisScaleForDraft, hasVisibleCurveWarning } from "./chartScale";
import { buildPcrChartOption } from "./chartConfig";
import { createDefaultStyleRules } from "./chartStyle";
import { createOneSpecimenEightReagentDataset, createTwentyOnePlusCurveDataset } from "../data/sampleData";

describe("PCR chart configuration", () => {
  it("builds a clean ECharts line option without dense minor grid lines", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const selectedCurveIds = new Set(dataset.curves.slice(0, 2).map((curve) => curve.curveId));
    const result = buildPcrChartOption({
      dataset,
      selectedCurveIds,
      scale: createDefaultChartScale()
    });
    const option = result.option as Record<string, any>;

    expect(option.backgroundColor).toBe("#ffffff");
    expect(option.animation).toBe(false);
    expect(option.xAxis.minorSplitLine.show).toBe(false);
    expect(option.yAxis.minorSplitLine.show).toBe(false);
    expect(option.grid.left).toBe(88);
    expect(option.grid.containLabel).toBe(false);
    expect(option.yAxis.nameGap).toBeGreaterThanOrEqual(72);
    expect(option.yAxis.axisLabel.margin).toBeLessThanOrEqual(8);
    expect(option.tooltip.show).toBe(false);
    expect(option.legend.show).toBe(false);
    expect(option.series).toHaveLength(2);
    expect(result.legendItems).toHaveLength(2);
    expect(option.series.every((series: any) => series.connectNulls === false)).toBe(true);
    expect(option.series.every((series: any) => series.showSymbol === false)).toBe(true);
    expect(option.series.every((series: any) => series.symbol === "none")).toBe(true);
    expect(option.series.every((series: any) => series.emphasis.disabled === true)).toBe(true);
  });

  it("passes raw fluorescence points to ECharts without smoothing or resampling", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const curve = dataset.curves[0];
    const result = buildPcrChartOption({
      dataset,
      selectedCurveIds: new Set([curve.curveId]),
      scale: createDefaultChartScale()
    });
    const option = result.option as Record<string, any>;

    expect(option.series[0].data).toEqual(curve.x.map((x, index) => [x, curve.y[index]]));
    expect(option.series[0].smooth).toBeUndefined();
    expect(option.series[0].sampling).toBeUndefined();
  });

  it("uses app-controlled curve highlight without changing marker settings", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const [firstCurve, secondCurve] = dataset.curves;
    const result = buildPcrChartOption({
      dataset,
      selectedCurveIds: new Set([firstCurve.curveId, secondCurve.curveId]),
      scale: createDefaultChartScale(),
      highlightedCurveId: secondCurve.curveId,
      curveOverrides: {
        [firstCurve.curveId]: { markerType: "circle" },
        [secondCurve.curveId]: { markerType: "triangle" }
      }
    });
    const option = result.option as Record<string, any>;

    expect(option.series[0]).toMatchObject({
      id: firstCurve.curveId,
      showSymbol: true,
      symbol: "circle",
      symbolSize: 6
    });
    expect(option.series[1]).toMatchObject({
      id: secondCurve.curveId,
      showSymbol: true,
      symbol: "triangle",
      symbolSize: 6
    });
    expect(option.series[0].lineStyle.opacity).toBeLessThan(1);
    expect(option.series[0].itemStyle.opacity).toBeLessThan(1);
    expect(option.series[1].lineStyle.opacity).toBe(1);
    expect(option.series[1].itemStyle.opacity).toBe(1);
    expect(option.series[1].lineStyle.width).toBeGreaterThan(option.series[0].lineStyle.width);
  });

  it("keeps default colors stable when earlier curves are added later", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const firstCurve = dataset.curves[0];
    const secondCurve = dataset.curves[1];

    const secondOnly = buildPcrChartOption({
      dataset,
      selectedCurveIds: new Set([secondCurve.curveId]),
      scale: createDefaultChartScale()
    }).option as Record<string, any>;
    const firstAndSecond = buildPcrChartOption({
      dataset,
      selectedCurveIds: new Set([firstCurve.curveId, secondCurve.curveId]),
      scale: createDefaultChartScale()
    }).option as Record<string, any>;

    expect(secondOnly.series[0].itemStyle.color).toBe(firstAndSecond.series[1].itemStyle.color);
  });

  it("keeps fixed scale values independent from selected data changes", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const scale = createDefaultChartScale();
    scale.x = { ...scale.x, mode: "fixed", fixedMin: "1", fixedMax: "45" };
    scale.y = { ...scale.y, mode: "fixed", fixedMin: "-1", fixedMax: "100" };
    scale.x.applied = getAppliedAxisScaleForDraft(scale.x)!;
    scale.y.applied = getAppliedAxisScaleForDraft(scale.y)!;

    const result = buildPcrChartOption({
      dataset,
      selectedCurveIds: new Set([dataset.curves[7].curveId]),
      scale
    });
    const option = result.option as Record<string, any>;

    expect(result.scaleIssues).toHaveLength(0);
    expect(option.xAxis.min).toBe(1);
    expect(option.xAxis.max).toBe(45);
    expect(option.yAxis.min).toBe(-1);
    expect(option.yAxis.max).toBe(100);
  });

  it("applies individual style overrides to chart series", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const curve = dataset.curves[0];
    const result = buildPcrChartOption({
      dataset,
      selectedCurveIds: new Set([curve.curveId]),
      scale: createDefaultChartScale(),
      curveOverrides: {
        [curve.curveId]: {
          color: "#ff0000",
          lineType: "dashed",
          markerType: "circle",
          lineWidth: 3,
          displayName: "Custom legend"
        }
      }
    });
    const option = result.option as Record<string, any>;

    expect(option.legend.data).toEqual(["Custom legend"]);
    expect(option.series[0].lineStyle).toMatchObject({
      color: "#ff0000",
      type: "dashed",
      width: 3
    });
    expect(option.series[0]).toMatchObject({
      showSymbol: true,
      symbol: "circle",
      symbolSize: 6
    });
  });

  it("uses reagent-first legend labels when label mode is reagent", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const curve = dataset.curves[0];
    const result = buildPcrChartOption({
      dataset,
      selectedCurveIds: new Set([curve.curveId]),
      scale: createDefaultChartScale(),
      labelMode: "reagent"
    });
    const option = result.option as Record<string, any>;

    expect(option.legend.data).toEqual(["A1 │ 검체 1"]);
    expect(option.series[0].name).toBe("A1 │ 검체 1");
  });

  it("keeps the built-in ECharts legend hidden while exposing custom legend items", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const result = buildPcrChartOption({
      dataset,
      selectedCurveIds: new Set([dataset.curves[0].curveId]),
      scale: createDefaultChartScale()
    });
    const option = result.option as Record<string, any>;

    expect(option.legend.show).toBe(false);
    expect(option.series).toHaveLength(1);
    expect(result.legendItems).toEqual([
      expect.objectContaining({
        curveId: dataset.curves[0].curveId,
        label: "검체 1 │ A1",
        lineType: "solid",
        markerType: "none"
      })
    ]);
  });

  it("applies auto compact legend labels to custom legend items and series names", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const curves = dataset.curves.slice(0, 2);
    const result = buildPcrChartOption({
      dataset,
      selectedCurveIds: new Set(curves.map((curve) => curve.curveId)),
      scale: createDefaultChartScale(),
      labelMode: "reagent",
      legendSettings: {
        previewVisible: true,
        reportLabelMode: "autoCompact",
        reportNameOverrides: {}
      }
    });
    const option = result.option as Record<string, any>;

    expect(result.legendItems.map((item) => item.label)).toEqual(curves.map((curve) => curve.reagentLabel));
    expect(option.series.map((series: any) => series.name)).toEqual(curves.map((curve) => curve.reagentLabel));
  });

  it.each(["circle", "triangle", "rect"] as const)("maps %s marker overrides to ECharts symbols", (markerType) => {
    const dataset = createOneSpecimenEightReagentDataset();
    const curve = dataset.curves[0];
    const result = buildPcrChartOption({
      dataset,
      selectedCurveIds: new Set([curve.curveId]),
      scale: createDefaultChartScale(),
      curveOverrides: {
        [curve.curveId]: { markerType }
      }
    });
    const option = result.option as Record<string, any>;

    expect(option.series[0].showSymbol).toBe(true);
    expect(option.series[0].symbol).toBe(markerType);
  });

  it("applies group marker rules to chart series when no curve override exists", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const curve = dataset.curves[0];
    const styleRules = createDefaultStyleRules();
    styleRules.markerBy = "reagent";
    styleRules.reagentMarkerTypes[curve.reagentId] = "triangle";

    const result = buildPcrChartOption({
      dataset,
      selectedCurveIds: new Set([curve.curveId]),
      scale: createDefaultChartScale(),
      styleRules
    });
    const option = result.option as Record<string, any>;

    expect(option.series[0]).toMatchObject({
      showSymbol: true,
      symbol: "triangle",
      symbolSize: 6
    });
  });

  it("reports invalid fixed drafts while keeping the last valid applied axis", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const scale = createDefaultChartScale();
    scale.y = { ...scale.y, mode: "fixed", fixedMin: "-1", fixedMax: "100" };
    scale.y.applied = getAppliedAxisScaleForDraft(scale.y)!;
    scale.y = { ...scale.y, mode: "fixed", fixedMin: "20", fixedMax: "10" };

    const result = buildPcrChartOption({
      dataset,
      selectedCurveIds: new Set([dataset.curves[0].curveId]),
      scale
    });
    const option = result.option as Record<string, any>;

    expect(result.scaleIssues).toHaveLength(1);
    expect(result.scaleIssues[0]).toMatchObject({ status: "invalid-order", blocksPlotExport: true });
    expect(option.yAxis.min).toBe(-1);
    expect(option.yAxis.max).toBe(100);
  });

  it("warns only when more than twenty curves are visible", () => {
    const dataset = createTwentyOnePlusCurveDataset();

    expect(hasVisibleCurveWarning(20)).toBe(false);
    expect(hasVisibleCurveWarning(dataset.curves.length)).toBe(true);
  });
});
