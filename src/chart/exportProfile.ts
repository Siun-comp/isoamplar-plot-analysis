import type { EChartsCoreOption } from "echarts/core";

export const REPORT_EXPORT_WIDTH = 1200;
export const REPORT_EXPORT_HEIGHT = 760;
export const REPORT_LINE_WIDTH_SCALE = 2.4;

type UnknownRecord = Record<string, unknown>;

export function createReportExportChartOption(option: EChartsCoreOption): EChartsCoreOption {
  return {
    ...option,
    grid: mapOptionValue(option.grid, (grid) => ({
      ...grid,
      left: 200,
      right: 44,
      top: 40,
      bottom: 110
    })),
    xAxis: mapOptionValue(option.xAxis, (axis) => createReportAxis(axis, "x")),
    yAxis: mapOptionValue(option.yAxis, (axis) => createReportAxis(axis, "y")),
    series: mapOptionValue(option.series, createReportSeries)
  };
}

function createReportAxis(axis: UnknownRecord, axisId: "x" | "y"): UnknownRecord {
  const axisLine = asRecord(axis.axisLine);
  const axisTick = asRecord(axis.axisTick);
  const splitLine = asRecord(axis.splitLine);
  return {
    ...axis,
    nameGap: axisId === "x" ? 68 : 165,
    nameTextStyle: {
      ...asRecord(axis.nameTextStyle),
      color: "#1f2937",
      fontSize: 40,
      fontWeight: 500
    },
    axisLabel: {
      ...asRecord(axis.axisLabel),
      color: "#263448",
      fontSize: 36,
      fontWeight: 500,
      margin: axisId === "x" ? 14 : 16,
      hideOverlap: true
    },
    axisLine: {
      ...axisLine,
      lineStyle: {
        ...asRecord(axisLine.lineStyle),
        color: "#1f2937",
        width: 2.4
      }
    },
    axisTick: {
      ...axisTick,
      show: true,
      length: 8,
      lineStyle: {
        ...asRecord(axisTick.lineStyle),
        color: "#1f2937",
        width: 2.4
      }
    },
    splitNumber: axisId === "x" ? 6 : 5,
    splitLine: {
      ...splitLine,
      lineStyle: {
        ...asRecord(splitLine.lineStyle),
        color: "#d7dee8",
        width: 1.5
      }
    }
  };
}

function createReportSeries(series: UnknownRecord): UnknownRecord {
  const lineStyle = asRecord(series.lineStyle);
  const width = typeof lineStyle.width === "number" && Number.isFinite(lineStyle.width) ? lineStyle.width : 2.25;
  const symbolSize = typeof series.symbolSize === "number" && Number.isFinite(series.symbolSize) ? series.symbolSize : 0;
  const markLine = asRecord(series.markLine);
  const markLineStyle = asRecord(markLine.lineStyle);
  const markLineLabel = asRecord(markLine.label);

  return {
    ...series,
    lineStyle: {
      ...lineStyle,
      width: scaleReportLineWidth(width)
    },
    ...(symbolSize > 0 ? { symbolSize: Math.max(10, symbolSize * 1.5) } : {}),
    ...(series.markLine
      ? {
          markLine: {
            ...markLine,
            lineStyle: {
              ...markLineStyle,
              width: scaleReportLineWidth(numericOr(markLineStyle.width, 1.5))
            },
            label: {
              ...markLineLabel,
              fontSize: 36,
              padding: [4, 7]
            }
          }
        }
      : {})
  };
}

export function scaleReportLineWidth(width: number) {
  return Math.round(width * REPORT_LINE_WIDTH_SCALE * 100) / 100;
}

function mapOptionValue(value: unknown, transform: (entry: UnknownRecord) => UnknownRecord): unknown {
  if (Array.isArray(value)) return value.map((entry) => transform(asRecord(entry)));
  if (value && typeof value === "object") return transform(asRecord(value));
  return value;
}

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : {};
}

function numericOr(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
