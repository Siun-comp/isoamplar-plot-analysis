import type { EChartsCoreOption } from "echarts/core";
import type { ImageExportType } from "./exportFilenames";
import type { LegendItem } from "./chartProjection";
import type { ImageExportLayout } from "../data/types";

type EchartsCoreModule = typeof import("echarts/core");

const EXPORT_PIXEL_RATIO = 2;
let echartsPromise: Promise<EchartsCoreModule> | null = null;

export async function exportChartImageBlob(args: {
  option: EChartsCoreOption;
  type: ImageExportType;
  width?: number;
  height?: number;
}) {
  const dataUrl = await exportChartImageDataUrl(args);
  return dataUrlToBlob(dataUrl);
}

export async function exportChartLayoutImageBlob(args: {
  option: EChartsCoreOption;
  type: ImageExportType;
  layout: ImageExportLayout;
  legendItems: LegendItem[];
  width?: number;
  height?: number;
}) {
  const width = args.width ?? 1200;
  const chartHeight = args.height ?? 760;

  if (args.layout === "plotOnly") {
    return exportChartImageBlob({ option: args.option, type: args.type, width, height: chartHeight });
  }

  const legendSize = calculateLegendImageSize(args.legendItems, width);
  if (args.layout === "legendOnly") {
    return exportLegendImageBlob({ items: args.legendItems, type: args.type, width });
  }

  const chartDataUrl = await exportChartImageDataUrl({ option: args.option, type: "png", width, height: chartHeight });
  const legendDataUrl = await exportLegendImageDataUrl({ items: args.legendItems, type: "png", width });
  const [chartImage, legendImage] = await Promise.all([loadImage(chartDataUrl), loadImage(legendDataUrl)]);
  const canvas = document.createElement("canvas");
  const outputWidth = width * EXPORT_PIXEL_RATIO;
  const outputChartHeight = chartHeight * EXPORT_PIXEL_RATIO;
  const outputLegendHeight = legendSize.height * EXPORT_PIXEL_RATIO;
  canvas.width = outputWidth;
  canvas.height = outputChartHeight + outputLegendHeight;
  const context = getCanvasContext(canvas);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(chartImage, 0, 0, outputWidth, outputChartHeight);
  context.drawImage(legendImage, 0, outputChartHeight, outputWidth, outputLegendHeight);
  return canvasToBlob(canvas, args.type);
}

export async function exportLegendImageBlob(args: {
  items: LegendItem[];
  type: ImageExportType;
  width?: number;
}) {
  const dataUrl = await exportLegendImageDataUrl(args);
  return dataUrlToBlob(dataUrl);
}

export async function exportLegendImageDataUrl(args: {
  items: LegendItem[];
  type: ImageExportType;
  width?: number;
}) {
  const size = calculateLegendImageSize(args.items, args.width ?? 1200);
  const svg = createLegendSvg(args.items, size.width, size.height);
  const image = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  const canvas = document.createElement("canvas");
  canvas.width = size.width * EXPORT_PIXEL_RATIO;
  canvas.height = size.height * EXPORT_PIXEL_RATIO;
  const context = getCanvasContext(canvas);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvasToDataUrl(canvas, args.type);
}

export function calculateLegendImageSize(items: LegendItem[], width = 1200) {
  const columns = Math.max(1, Math.min(4, Math.floor((width - 48) / 260)));
  const rows = Math.max(1, Math.ceil(Math.max(items.length, 1) / columns));
  return {
    width,
    height: 58 + rows * 30
  };
}

export function createLegendSvg(items: LegendItem[], width: number, height: number) {
  const columns = Math.max(1, Math.min(4, Math.floor((width - 48) / 260)));
  const columnWidth = (width - 48) / columns;
  const escapedItems = items.length > 0 ? items : [];
  const rows = escapedItems
    .map((item, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = 24 + column * columnWidth;
      const y = 44 + row * 30;
      return createLegendSvgItem(item, x, y, columnWidth);
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <text x="24" y="24" fill="#263448" font-family="Arial, sans-serif" font-size="15" font-weight="700">Legend</text>
  ${rows}
</svg>`;
}

export async function exportChartImageDataUrl(args: {
  option: EChartsCoreOption;
  type: ImageExportType;
  width?: number;
  height?: number;
}) {
  const echarts = await loadEchartsForExport();
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-10000px";
  container.style.top = "0";
  container.style.width = `${args.width ?? 1200}px`;
  container.style.height = `${args.height ?? 760}px`;
  container.style.background = "#ffffff";
  document.body.appendChild(container);

  const chart = echarts.init(container, undefined, {
    renderer: "canvas",
    width: args.width ?? 1200,
    height: args.height ?? 760
  });

  try {
    chart.setOption(args.option, true);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const dataUrl = chart.getDataURL({
      type: args.type,
      pixelRatio: EXPORT_PIXEL_RATIO,
      backgroundColor: "#ffffff"
    });
    assertValidDataUrl(dataUrl);
    return dataUrl;
  } finally {
    chart.dispose();
    container.remove();
  }
}

export async function copyPngBlobToClipboard(blob: Blob) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("Clipboard image copy is not supported in this browser.");
  }

  await navigator.clipboard.write([
    new ClipboardItem({
      "image/png": blob
    })
  ]);
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function dataUrlToBlob(dataUrl: string) {
  assertValidDataUrl(dataUrl);
  const [metadata, base64] = dataUrl.split(",");
  const mimeMatch = metadata.match(/^data:(.*?);base64$/u);
  const mime = mimeMatch?.[1] ?? "application/octet-stream";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const blob = new Blob([bytes], { type: mime });
  assertValidBlob(blob);
  return blob;
}

function createLegendSvgItem(item: LegendItem, x: number, y: number, columnWidth: number) {
  const safeColor = escapeHtml(item.color);
  const textX = x + 72;
  const maxTextWidth = Math.max(120, columnWidth - 84);
  const marker = createLegendSvgMarker(item, x + 32, y);

  return `<g data-curve-id="${escapeHtml(item.curveId)}">
    <line x1="${x}" y1="${y}" x2="${x + 64}" y2="${y}" stroke="${safeColor}" stroke-width="${Math.max(2, item.lineWidth)}" stroke-linecap="${item.lineType === "dotted" ? "round" : "butt"}" stroke-dasharray="${getStrokeDashArray(item.lineType)}"/>
    ${marker}
    <text x="${textX}" y="${y + 4}" fill="#263448" font-family="Arial, sans-serif" font-size="13">${escapeHtml(truncateLabel(item.label, Math.floor(maxTextWidth / 7.2)))}</text>
  </g>`;
}

function createLegendSvgMarker(item: LegendItem, x: number, y: number) {
  const color = escapeHtml(item.color);
  if (item.markerType === "none") return "";
  if (item.markerType === "circle") return `<circle cx="${x}" cy="${y}" r="4.5" fill="${color}"/>`;
  if (item.markerType === "triangle") return `<polygon points="${x},${y - 5} ${x + 5.5},${y + 5} ${x - 5.5},${y + 5}" fill="${color}"/>`;
  return `<rect x="${x - 4.5}" y="${y - 4.5}" width="9" height="9" fill="${color}"/>`;
}

function truncateLabel(label: string, maxLength: number) {
  if (label.length <= maxLength) return label;
  return `${label.slice(0, Math.max(1, maxLength - 1))}…`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function getStrokeDashArray(lineType: LegendItem["lineType"]) {
  if (lineType === "dashed") return "8 5";
  if (lineType === "dotted") return "1 5";
  return "";
}

function getMimeType(type: ImageExportType) {
  return type === "jpeg" ? "image/jpeg" : "image/png";
}

function getCanvasContext(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas rendering is not supported in this browser.");
  return context;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: ImageExportType) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          try {
            assertValidBlob(blob);
            resolve(blob);
          } catch (error) {
            reject(error);
          }
        } else {
          reject(new Error("Image export failed."));
        }
      },
      getMimeType(type),
      type === "jpeg" ? 0.92 : undefined
    );
  });
}

function canvasToDataUrl(canvas: HTMLCanvasElement, type: ImageExportType) {
  const dataUrl = canvas.toDataURL(getMimeType(type), type === "jpeg" ? 0.92 : undefined);
  assertValidDataUrl(dataUrl);
  return dataUrl;
}

function assertValidDataUrl(dataUrl: string) {
  const parts = dataUrl.split(",");
  if (parts.length !== 2 || !parts[0].startsWith("data:image/") || parts[1].length === 0) {
    throw new Error("Image export failed.");
  }
}

function assertValidBlob(blob: Blob) {
  if (blob.size === 0 || !blob.type.startsWith("image/")) {
    throw new Error("Image export failed.");
  }
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image export failed."));
    image.src = src;
  });
}

async function loadEchartsForExport() {
  echartsPromise ??= Promise.all([
    import("echarts/core"),
    import("echarts/charts"),
    import("echarts/components"),
    import("echarts/renderers")
  ]).then(([echarts, charts, components, renderers]) => {
    echarts.use([
      charts.LineChart,
      components.GridComponent,
      components.LegendComponent,
      components.TooltipComponent,
      renderers.CanvasRenderer
    ]);
    return echarts;
  });

  return echartsPromise;
}
