import type { EChartsCoreOption } from "echarts/core";
import type { ChartScaleState, AxisScaleIssue } from "./chartScale";
import { buildChartProjection, defaultChartColors } from "./chartProjection";
import type { Curve, CurveStyleOverride, GroupingMode, PcrDataset, StyleRules } from "../data/types";
import type { LegendItem } from "./chartProjection";

export type ChartBuildResult = {
  option: EChartsCoreOption;
  visibleCurves: Curve[];
  legendItems: LegendItem[];
  scaleIssues: AxisScaleIssue[];
};

export function buildPcrChartOption(args: {
  dataset: PcrDataset | null;
  selectedCurveIds: Set<string>;
  orderedCurveIds?: string[];
  scale: ChartScaleState;
  labelMode?: GroupingMode;
  styleRules?: StyleRules;
  curveOverrides?: Record<string, CurveStyleOverride>;
}): ChartBuildResult {
  const projection = buildChartProjection(args);

  return {
    visibleCurves: projection.visibleCurves,
    legendItems: projection.legendItems,
    scaleIssues: projection.scaleIssues,
    option: {
      backgroundColor: "#ffffff",
      animation: false,
      color: defaultChartColors,
      grid: {
        left: 58,
        right: 24,
        top: 30,
        bottom: 54,
        containLabel: true
      },
      tooltip: {
        show: false,
        trigger: "axis",
        axisPointer: {
          type: "line"
        },
        valueFormatter: (value: unknown) => (typeof value === "number" ? value.toPrecision(5) : "")
      },
      legend: {
        show: false,
        type: "scroll",
        orient: "vertical",
        right: 6,
        top: 24,
        bottom: 30,
        itemWidth: 20,
        itemHeight: 10,
        textStyle: {
          color: "#263448",
          fontSize: 12
        },
        data: projection.visibleCurves.map((curve) => projection.chartNames.get(curve.curveId) ?? curve.displayLabel)
      },
      xAxis: {
        type: "value",
        name: "Cycle",
        nameLocation: "middle",
        nameGap: 32,
        min: projection.xScale.min,
        max: projection.xScale.max,
        axisLine: {
          lineStyle: { color: "#1f2937" }
        },
        axisLabel: {
          color: "#263448"
        },
        splitLine: {
          show: true,
          lineStyle: { color: "#dfe5ed", width: 1 }
        },
        minorSplitLine: {
          show: false
        }
      },
      yAxis: {
        type: "value",
        name: "Fluorescence",
        nameLocation: "middle",
        nameGap: 46,
        min: projection.yScale.min,
        max: projection.yScale.max,
        axisLine: {
          lineStyle: { color: "#1f2937" }
        },
        axisLabel: {
          color: "#263448"
        },
        splitLine: {
          show: true,
          lineStyle: { color: "#dfe5ed", width: 1 }
        },
        minorSplitLine: {
          show: false
        }
      },
      series: projection.visibleCurves.map((curve, index) => {
        const resolvedStyle = projection.resolvedStyles.get(curve.curveId);
        const markerType = resolvedStyle?.markerType ?? "none";

        return {
          id: curve.curveId,
          name: projection.chartNames.get(curve.curveId) ?? curve.displayLabel,
          type: "line",
          data: curve.x.map((x, pointIndex) => [x, curve.y[pointIndex]]),
          showSymbol: markerType !== "none",
          symbol: markerType,
          symbolSize: markerType === "none" ? 0 : 6,
          connectNulls: false,
          lineStyle: {
            width: resolvedStyle?.lineWidth ?? 2.25,
            type: resolvedStyle?.lineType ?? "solid",
            color: resolvedStyle?.color
          },
          itemStyle: {
            color: resolvedStyle?.color ?? defaultChartColors[index % defaultChartColors.length]
          },
          emphasis: {
            focus: "series"
          }
        };
      })
    }
  };
}
