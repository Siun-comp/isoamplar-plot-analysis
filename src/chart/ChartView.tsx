import { useEffect, useRef } from "react";
import { LineChart } from "echarts/charts";
import { GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsCoreOption } from "echarts/core";

echarts.use([LineChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer]);

export type ChartHoverReadout = {
  seriesName: string;
  x: number | string;
  y: number | string | null;
  color?: string;
};

type ChartViewProps = {
  option: EChartsCoreOption;
  onHoverReadout?: (readout: ChartHoverReadout | null) => void;
};

export function ChartView({ option, onHoverReadout }: ChartViewProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const optionRef = useRef(option);

  optionRef.current = option;

  useEffect(() => {
    if (import.meta.env.MODE === "test") return;
    if (!elementRef.current) return;

    const chart = echarts.init(elementRef.current, undefined, { renderer: "canvas" });
    chartRef.current = chart;
    chart.setOption(option, true);
    const handleMouseOver = (params: unknown) => {
      onHoverReadout?.(createHoverReadout(params));
    };
    const handleGlobalOut = () => {
      onHoverReadout?.(null);
    };
    const handleCanvasMouseMove = (event: unknown) => {
      const point = extractCanvasPoint(event);
      if (!point) return;
      onHoverReadout?.(createNearestReadout(chart, optionRef.current, point[0], point[1]));
    };
    chart.on("mouseover", handleMouseOver);
    chart.on("globalout", handleGlobalOut);
    chart.getZr().on("mousemove", handleCanvasMouseMove);
    chart.getZr().on("globalout", handleGlobalOut);

    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(elementRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.off("mouseover", handleMouseOver);
      chart.off("globalout", handleGlobalOut);
      chart.getZr().off("mousemove", handleCanvasMouseMove);
      chart.getZr().off("globalout", handleGlobalOut);
      chart.dispose();
      chartRef.current = null;
    };
  }, [onHoverReadout]);

  useEffect(() => {
    chartRef.current?.setOption(option, true);
  }, [option]);

  return <div className="echarts-surface" ref={elementRef} role="img" aria-label="IsoAmplar amplification curve chart" />;
}

export function createHoverReadout(params: unknown): ChartHoverReadout | null {
  if (!isObject(params)) return null;
  if (params.componentType !== "series") return null;
  const data = Array.isArray(params.data) ? params.data : [];
  const x = normalizeReadoutValue(data[0]);
  const y = normalizeReadoutValue(data[1]);
  if (x === null) return null;

  return {
    seriesName: String(params.seriesName ?? ""),
    x,
    y,
    color: typeof params.color === "string" ? params.color : undefined
  };
}

function createNearestReadout(
  chart: echarts.ECharts,
  option: EChartsCoreOption,
  offsetX: number,
  offsetY: number
): ChartHoverReadout | null {
  const pixel = [offsetX, offsetY] as [number, number];
  if (!chart.containPixel({ gridIndex: 0 }, pixel)) return null;

  let nearest:
    | {
        series: ReturnType<typeof getReadoutSeries>[number];
        point: ReturnType<typeof getReadoutSeries>[number]["data"][number];
        distance: number;
      }
    | null = null;

  for (const series of getReadoutSeries(option)) {
    for (const point of series.data) {
      const pointPixel = chart.convertToPixel({ gridIndex: 0 }, [point.x, point.y]);
      if (!isNumberPair(pointPixel)) continue;
      const distance = Math.hypot(pointPixel[0] - offsetX, pointPixel[1] - offsetY);
      if (!nearest || distance < nearest.distance) {
        nearest = { series, point, distance };
      }
    }
  }

  if (!nearest || nearest.distance > 32) return null;

  return {
    seriesName: nearest.series.name,
    x: nearest.point.x,
    y: nearest.point.y,
    color: nearest.series.color
  };
}

function getReadoutSeries(option: EChartsCoreOption) {
  return normalizeSeriesOption((option as { series?: unknown }).series)
    .map((series) => ({
      name: typeof series.name === "string" ? series.name : "",
      color: getSeriesColor(series),
      data: normalizeSeriesData(series.data)
    }))
    .filter((series) => series.data.length > 0);
}

function normalizeSeriesOption(series: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(series)) return series.filter(isObject);
  return isObject(series) ? [series] : [];
}

function normalizeSeriesData(data: unknown) {
  if (!Array.isArray(data)) return [];

  return data.flatMap((point) => {
    if (!Array.isArray(point)) return [];
    const x = normalizeReadoutValue(point[0]);
    const y = normalizeReadoutValue(point[1]);
    if (x === null || typeof y !== "number") return [];
    return [{ x, y }];
  });
}

function getSeriesColor(series: Record<string, unknown>) {
  const itemStyle = isObject(series.itemStyle) ? series.itemStyle : {};
  const lineStyle = isObject(series.lineStyle) ? series.lineStyle : {};
  if (typeof itemStyle.color === "string") return itemStyle.color;
  if (typeof lineStyle.color === "string") return lineStyle.color;
  if (typeof series.color === "string") return series.color;
  return undefined;
}

function extractCanvasPoint(event: unknown): [number, number] | null {
  if (!isObject(event)) return null;
  const nativeEvent = isObject(event.event) ? event.event : {};
  const x = getFirstNumber(event.offsetX, event.zrX, nativeEvent.offsetX);
  const y = getFirstNumber(event.offsetY, event.zrY, nativeEvent.offsetY);
  return x === null || y === null ? null : [x, y];
}

function normalizeReadoutValue(value: unknown) {
  if (typeof value === "number" || typeof value === "string") return value;
  if (value === null) return null;
  return null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNumberPair(value: unknown): value is [number, number] {
  return Array.isArray(value) && typeof value[0] === "number" && typeof value[1] === "number";
}

function getFirstNumber(...values: unknown[]) {
  const numberValue = values.find((value): value is number => typeof value === "number");
  return numberValue ?? null;
}
