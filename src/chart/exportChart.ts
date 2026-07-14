import type { EChartsCoreOption } from "echarts/core";
import type { ImageExportType } from "./exportFilenames";
import type { LegendItem } from "./chartProjection";
import type { ImageExportLayout } from "../data/types";
import {
  createReportExportChartOption,
  REPORT_EXPORT_HEIGHT,
  REPORT_EXPORT_WIDTH,
  scaleReportLineWidth
} from "./exportProfile";
import {
  assertLegendIdentity,
  assertLegendLabelsUnique,
  createLegendTextMeasurer,
  layoutLegendLabel,
  layoutLegendItems,
  type LaidOutLegendItem
} from "./legendLayout";

type EchartsCoreModule = typeof import("echarts/core");

export const exportPixelRatio = 2;
const EXPORT_PIXEL_RATIO = exportPixelRatio;
let echartsPromise: Promise<EchartsCoreModule> | null = null;
type LegendImageVariant = "standard" | "report" | "plot";
type LegendGeometry = {
  columns: number;
  columnWidth: number;
  startX: number;
  firstRowY: number;
  rowHeight: number;
  headerHeight: number;
  sampleLength: number;
  textOffset: number;
  maxTextWidth: number;
};

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
  const width = args.width ?? REPORT_EXPORT_WIDTH;
  const chartHeight = args.height ?? REPORT_EXPORT_HEIGHT;

  if (args.layout === "plotOnly") {
    return exportChartImageBlob({ option: args.option, type: args.type, width, height: chartHeight });
  }

  validateLegendLayoutForImageExport({ layout: args.layout, items: args.legendItems, width });
  const legendSize = calculateLegendImageSize(args.legendItems, width);
  if (args.layout === "legendOnly") {
    return exportLegendImageBlob({ items: args.legendItems, type: args.type, width });
  }

  const chartDataUrl = await exportChartImageDataUrl({ option: args.option, type: "png", width, height: chartHeight });
  const legendDataUrl = await exportLegendImageDataUrl({ items: args.legendItems, type: "png", width, variant: "plot" });
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

export function validateLegendLayoutForImageExport(args: {
  layout: ImageExportLayout;
  items: LegendItem[];
  width?: number;
}) {
  if (args.layout === "plotOnly") return;
  const width = args.width ?? 1200;
  const size = calculateLegendImageSize(args.items, width);
  createLegendSvg(args.items, size.width, size.height);
}

export async function exportLegendImageBlob(args: {
  items: LegendItem[];
  type: ImageExportType;
  width?: number;
  variant?: LegendImageVariant;
  title?: string;
}) {
  const dataUrl = await exportLegendImageDataUrl(args);
  return dataUrlToBlob(dataUrl);
}

export async function exportReportLegendImageBlob(args: {
  items: LegendItem[];
  type: ImageExportType;
  width?: number;
  title?: string;
}) {
  return exportLegendImageBlob({
    items: args.items,
    type: args.type,
    width: args.width ?? 900,
    variant: "report",
    title: args.title
  });
}

export async function exportLegendImageDataUrl(args: {
  items: LegendItem[];
  type: ImageExportType;
  width?: number;
  variant?: LegendImageVariant;
  title?: string;
}) {
  const variant = args.variant ?? "standard";
  const size = calculateLegendImageSize(args.items, args.width ?? (variant === "report" ? 900 : 1200), variant);
  const svg = createLegendSvg(args.items, size.width, size.height, variant, args.title);
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

export function calculateLegendImageSize(items: LegendItem[], width = 1200, variant: LegendImageVariant = "standard") {
  const geometry = getLegendGeometry(width, variant);
  const columns = geometry.columns;
  const rows = Math.max(1, Math.ceil(Math.max(items.length, 1) / columns));
  return {
    width,
    height: geometry.headerHeight + rows * geometry.rowHeight
  };
}

export function calculateLegendEvidenceRegions(itemCount: number, width = 1200, variant: LegendImageVariant = "standard") {
  const geometry = getLegendGeometry(width, variant);
  return Array.from({ length: itemCount }, (_, index) => {
    const column = index % geometry.columns;
    const row = Math.floor(index / geometry.columns);
    const x = geometry.startX + column * geometry.columnWidth;
    const y = geometry.firstRowY + row * geometry.rowHeight;
    return {
      itemIndex: index,
      sample: { left: x, top: y - geometry.rowHeight / 2, right: x + geometry.sampleLength, bottom: y + geometry.rowHeight / 2 },
      text: {
        left: x + geometry.textOffset,
        top: y - geometry.rowHeight / 2,
        right: x + geometry.textOffset + geometry.maxTextWidth,
        bottom: y + geometry.rowHeight / 2
      }
    };
  });
}

export function createLegendSvg(
  items: LegendItem[],
  width: number,
  height: number,
  variant: LegendImageVariant = "standard",
  title = "Legend"
) {
  const geometry = getLegendGeometry(width, variant);
  const requiredHeight = calculateLegendImageSize(items, width, variant).height;
  if (height < requiredHeight) {
    throw new Error("Legend rows cannot fit inside the requested output height. Use Plot only or a taller legend output.");
  }
  if (geometry.maxTextWidth < 24) {
    throw new Error("Legend labels cannot fit inside the requested output width. Use Plot only or a wider legend output.");
  }
  const font = variant === "report" ? "700 22px Arial, sans-serif" : "13px Arial, sans-serif";
  const layout = layoutLegendItems({ items, maxTextWidth: geometry.maxTextWidth, font });
  assertLegendIdentity(layout);
  const rows = layout.items
    .map((entry, index) => {
      const column = index % geometry.columns;
      const row = Math.floor(index / geometry.columns);
      const x = geometry.startX + column * geometry.columnWidth;
      const y = geometry.firstRowY + row * geometry.rowHeight;
      return createLegendSvgItem(entry, x, y, geometry, variant);
    })
    .join("");
  const titleX = variant === "report" ? 28 : 24;
  const titleSize = variant === "report" ? 22 : 15;
  const titleWeight = variant === "report" ? 700 : 700;
  const titleFont = `${titleWeight} ${titleSize}px Arial, sans-serif`;
  const titleLayout = layoutLegendLabel(
    title,
    Math.max(24, width - titleX * 2),
    createLegendTextMeasurer(titleFont)
  );
  const titleLineHeight = variant === "report" ? 26 : 18;
  const titleFirstBaseline = variant === "report" ? 32 : 24;
  const titleText = titleLayout.lines
    .map((line, index) => `<tspan x="${titleX}" y="${titleFirstBaseline + index * titleLineHeight}">${escapeHtml(line)}</tspan>`)
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <text fill="#263448" font-family="Arial, sans-serif" font-size="${titleSize}" font-weight="${titleWeight}" data-title-truncated="${titleLayout.truncated}" data-title-left="${titleX}" data-title-right="${width - titleX}" data-title-top="${titleFirstBaseline - titleSize}" data-title-bottom="${titleFirstBaseline + (titleLayout.lines.length - 1) * titleLineHeight + 4}">${titleText}</text>
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
  const width = args.width ?? REPORT_EXPORT_WIDTH;
  const height = args.height ?? REPORT_EXPORT_HEIGHT;
  const exportOption = createReportExportChartOption(args.option);
  container.style.width = `${width}px`;
  container.style.height = `${height}px`;
  container.style.background = "#ffffff";
  document.body.appendChild(container);

  const chart = echarts.init(container, undefined, {
    renderer: "canvas",
    width,
    height
  });

  try {
    chart.setOption(exportOption, true);
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

export async function copyReportLegendExcelTableToClipboard(args: { title: string; items: LegendItem[] }) {
  const payload = createReportLegendExcelClipboardPayload(args);
  await copyHtmlTableToClipboard(payload.html, payload.text);
}

export function createReportLegendExcelClipboardPayload(args: { title: string; items: LegendItem[] }) {
  assertLegendLabelsUnique(args.items);
  const rows = args.items
    .map(
      (item) => `<tr>
    <td style="width:116pt;padding:5px 8px;border:1px solid #d8dee8;vertical-align:middle;text-align:center;white-space:nowrap;mso-number-format:'\\@';font-family:'Malgun Gothic','Segoe UI Symbol',Arial,sans-serif;font-size:9pt;">
      ${createExcelLegendSampleHtml(item)}
    </td>
    <td style="width:220pt;padding:5px 8px;border:1px solid #d8dee8;mso-number-format:'\\@';font-family:'Malgun Gothic',Arial,sans-serif;font-size:9pt;color:#263448;white-space:nowrap;">
      ${escapeExcelHtmlText(item.label)}
    </td>
  </tr>`
    )
    .join("");
  const html = `<!doctype html>
<html>
<head><meta charset="utf-8"></head>
<body>
<table style="border-collapse:collapse;background:#ffffff;">
  <colgroup>
    <col style="width:116pt;mso-width-source:userset;">
    <col style="width:220pt;mso-width-source:userset;">
  </colgroup>
  <tr>
    <th colspan="2" style="padding:6px 8px;border:1px solid #d8dee8;background:#f8fafc;text-align:left;font-family:'Malgun Gothic',Arial,sans-serif;font-size:10pt;font-weight:700;color:#263448;">${escapeExcelHtmlText(args.title)}</th>
  </tr>
  <tr>
    <th style="padding:5px 8px;border:1px solid #d8dee8;background:#f8fafc;text-align:center;font-family:'Malgun Gothic',Arial,sans-serif;font-size:9pt;font-weight:700;color:#526174;">Style</th>
    <th style="padding:5px 8px;border:1px solid #d8dee8;background:#f8fafc;text-align:left;font-family:'Malgun Gothic',Arial,sans-serif;font-size:9pt;font-weight:700;color:#526174;">Name</th>
  </tr>
  ${rows}
</table>
</body>
</html>`;
  const text = [
    sanitizeExcelPlainText(args.title),
    ["Style", "Name"].join("\t"),
    ...args.items.map((item) => [createPlainStyleLabel(item), sanitizeExcelPlainText(item.label)].join("\t"))
  ].join("\r\n");

  return { html, text };
}

export async function copyHtmlTableToClipboard(html: string, plainText: string) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("Rich Excel clipboard copy is not supported in this browser.");
  }

  await navigator.clipboard.write([
    new ClipboardItem({
      "text/html": new Blob([html], { type: "text/html" }),
      "text/plain": new Blob([plainText], { type: "text/plain" })
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

function createLegendSvgItem(
  entry: LaidOutLegendItem,
  x: number,
  y: number,
  geometry: LegendGeometry,
  variant: LegendImageVariant = "standard"
) {
  const item = entry.item;
  const safeColor = escapeHtml(item.color);
  const sampleLength = geometry.sampleLength;
  const markerX = x + sampleLength / 2;
  const textX = x + geometry.textOffset;
  const marker = createLegendSvgMarker(item, markerX, y, variant === "report" ? 7 : variant === "plot" ? 6 : 4.5);
  const strokeWidth =
    variant === "report"
      ? Math.max(3.5, item.lineWidth * 1.35)
      : variant === "plot"
        ? scaleReportLineWidth(item.lineWidth)
        : Math.max(2, item.lineWidth);
  const text = createMeasuredLegendText(entry, textX, y, variant);

  return `<g data-curve-id="${escapeHtml(item.curveId)}" data-rendered-label="${escapeHtml(entry.renderedLabel)}" data-truncated="${entry.truncated}" data-sample-left="${x}" data-sample-right="${x + sampleLength}" data-text-left="${textX}" data-text-right="${textX + geometry.maxTextWidth}" data-row-top="${y - geometry.rowHeight / 2}" data-row-bottom="${y + geometry.rowHeight / 2}">
    <line x1="${x}" y1="${y}" x2="${x + sampleLength}" y2="${y}" stroke="${safeColor}" stroke-width="${strokeWidth}" stroke-linecap="${item.lineType === "dotted" ? "round" : "butt"}" stroke-dasharray="${getStrokeDashArray(item.lineType)}"/>
    ${marker}
    ${text}
  </g>`;
}

function getLegendGeometry(width: number, variant: LegendImageVariant): LegendGeometry {
  const horizontalPadding = variant === "report" ? 56 : 48;
  const minColumnWidth = variant === "report" ? 360 : 260;
  const maxColumns = variant === "report" ? 2 : 4;
  const contentWidth = Math.max(1, width - horizontalPadding);
  const columns = Math.max(1, Math.min(maxColumns, Math.floor(contentWidth / minColumnWidth)));
  const columnWidth = contentWidth / columns;
  const startX = variant === "report" ? 28 : 24;
  const sampleLength = Math.min(variant === "report" ? 98 : 64, Math.max(variant === "report" ? 36 : 24, columnWidth * 0.3));
  const textOffset = sampleLength + (variant === "report" ? 22 : 10);
  return {
    columns,
    columnWidth,
    startX,
    firstRowY: variant === "report" ? 100 : 70,
    rowHeight: variant === "report" ? 62 : 42,
    headerHeight: variant === "report" ? 116 : 84,
    sampleLength,
    textOffset,
    maxTextWidth: columnWidth - textOffset - (variant === "report" ? 16 : 12)
  };
}

function createLegendSvgMarker(item: LegendItem, x: number, y: number, size: number) {
  const color = escapeHtml(item.color);
  if (item.markerType === "none") return "";
  if (item.markerType === "circle") return `<circle cx="${x}" cy="${y}" r="${size}" fill="${color}"/>`;
  if (item.markerType === "triangle") {
    return `<polygon points="${x},${y - size * 1.1} ${x + size * 1.2},${y + size * 1.1} ${x - size * 1.2},${y + size * 1.1}" fill="${color}"/>`;
  }
  return `<rect x="${x - size}" y="${y - size}" width="${size * 2}" height="${size * 2}" fill="${color}"/>`;
}

function createMeasuredLegendText(entry: LaidOutLegendItem, x: number, centerY: number, variant: LegendImageVariant) {
  const fontSize = variant === "report" ? 22 : 13;
  const lineHeight = variant === "report" ? 24 : 16;
  const firstBaselineY = centerY + fontSize * 0.34 - ((entry.lines.length - 1) * lineHeight) / 2;
  const tspans = entry.lines
    .map((line, index) => `<tspan x="${x}" y="${firstBaselineY + index * lineHeight}">${escapeHtml(line)}</tspan>`)
    .join("");
  return `<text fill="#263448" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="${variant === "report" ? 700 : 400}">${tspans}</text>`;
}

function createExcelLegendSampleHtml(item: LegendItem) {
  const color = escapeHtml(item.color);
  return `<span style="font-family:'Malgun Gothic','Segoe UI Symbol',Consolas,monospace;font-size:9pt;font-weight:700;color:${color};white-space:nowrap;">${createExcelLegendGlyphHtml(item)}</span>`;
}

function createExcelLegendGlyphHtml(item: LegendItem) {
  const marker = getExcelMarkerEntity(item.markerType);
  if (item.lineType === "dashed") {
    return marker ? `&#9472;&#9472;&nbsp;&nbsp;${marker}&nbsp;&nbsp;&#9472;&#9472;` : "&#9472;&#9472;&nbsp;&nbsp;&#9472;&#9472;&nbsp;&nbsp;&#9472;&#9472;";
  }
  if (item.lineType === "dotted") {
    return marker ? `&#8226;&nbsp;&#8226;&nbsp;${marker}&nbsp;&#8226;&nbsp;&#8226;` : "&#8226;&nbsp;&#8226;&nbsp;&#8226;&nbsp;&#8226;&nbsp;&#8226;";
  }
  return marker ? `&#9473;&#9473;&#9473;${marker}&#9473;&#9473;&#9473;` : "&#9473;&#9473;&#9473;&#9473;&#9473;&#9473;&#9473;&#9473;";
}

function getExcelMarkerEntity(markerType: LegendItem["markerType"]) {
  if (markerType === "circle") return "&#9679;";
  if (markerType === "triangle") return "&#9650;";
  if (markerType === "rect") return "&#9632;";
  return "";
}

function createPlainStyleLabel(item: LegendItem) {
  return `${item.lineType}, ${item.markerType}, ${item.color}`;
}

function escapeExcelHtmlText(value: string) {
  return escapeHtml(sanitizeExcelText(value)).replaceAll("\u200B", "&#8203;");
}

function sanitizeExcelPlainText(value: string) {
  return sanitizeExcelText(value).replaceAll("\t", " ").replaceAll(/\r?\n/gu, " ");
}

function sanitizeExcelText(value: string) {
  const trimmed = value.trimStart();
  if (/^[=+\-@]/u.test(trimmed)) {
    return `\u200B${value}`;
  }
  return value;
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
