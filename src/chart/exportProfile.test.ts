import { describe, expect, it } from "vitest";
import type { EChartsCoreOption } from "echarts/core";
import {
  createReportExportChartOption,
  REPORT_EXPORT_HEIGHT,
  REPORT_EXPORT_WIDTH,
  scaleReportLineWidth
} from "./exportProfile";

describe("report chart export profile", () => {
  it("keeps a high-resolution canvas while enlarging plot geometry for a 9.5 cm report placement", () => {
    const option: EChartsCoreOption = {
      grid: { left: 88, right: 24, top: 30, bottom: 54 },
      xAxis: { type: "value", name: "Cycle", axisLabel: { color: "#263448" } },
      yAxis: { type: "value", name: "Fluorescence", axisLabel: { color: "#263448", margin: 8 } },
      series: [
        {
          type: "line",
          showSymbol: true,
          symbolSize: 6,
          lineStyle: { width: 2.25 },
          markLine: { lineStyle: { width: 1.5 }, label: { show: true, fontSize: 11 } }
        }
      ]
    };

    const result = createReportExportChartOption(option) as Record<string, unknown>;
    const xAxis = result.xAxis as Record<string, unknown>;
    const yAxis = result.yAxis as Record<string, unknown>;
    const series = (result.series as Array<Record<string, unknown>>)[0];

    expect({ width: REPORT_EXPORT_WIDTH, height: REPORT_EXPORT_HEIGHT }).toEqual({ width: 1200, height: 760 });
    expect(result.grid).toMatchObject({ left: 200, right: 44, top: 40, bottom: 110 });
    expect(xAxis.axisLabel).toMatchObject({ fontSize: 36, hideOverlap: true });
    expect(yAxis.axisLabel).toMatchObject({ fontSize: 36, margin: 16, hideOverlap: true });
    expect(xAxis.nameTextStyle).toMatchObject({ fontSize: 40 });
    expect(yAxis.nameTextStyle).toMatchObject({ fontSize: 40 });
    expect(xAxis.splitNumber).toBe(6);
    expect(yAxis.splitNumber).toBe(5);
    expect(series.lineStyle).toMatchObject({ width: 5.4 });
    expect(series.symbolSize).toBe(10);
    expect(series.markLine).toMatchObject({ lineStyle: { width: 3.6 }, label: { fontSize: 36 } });
    expect(scaleReportLineWidth(3)).toBe(7.2);
    expect(scaleReportLineWidth(3)).toBeGreaterThan(scaleReportLineWidth(2.25));

    expect(option.grid).toEqual({ left: 88, right: 24, top: 30, bottom: 54 });
    expect((option.series as Array<Record<string, unknown>>)[0].lineStyle).toEqual({ width: 2.25 });
  });
});
