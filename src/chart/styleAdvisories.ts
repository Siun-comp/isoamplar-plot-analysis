import type { LegendItem } from "./chartProjection";

export const MIN_WHITE_BACKGROUND_STYLE_CONTRAST = 3;

export type StyleAdvisories = {
  totalCount: number;
  uniqueSignatureCount: number;
  collisions: LegendItem[][];
  lowContrast: LegendItem[];
  invalidColors: LegendItem[];
};

export function createStyleAdvisories(items: LegendItem[]): StyleAdvisories {
  const signatures = new Map<string, LegendItem[]>();
  const lowContrast: LegendItem[] = [];
  const invalidColors: LegendItem[] = [];

  for (const item of items) {
    const normalizedColor = normalizeHexColor(item.color);
    const signatureColor = normalizedColor ?? `invalid:${item.color.trim().toLowerCase()}`;
    const lineWidth = Number.isFinite(item.lineWidth) ? item.lineWidth.toFixed(3) : String(item.lineWidth);
    const signature = `${signatureColor}|${item.lineType}|${item.markerType}|${lineWidth}`;
    const matchingItems = signatures.get(signature) ?? [];
    matchingItems.push(item);
    signatures.set(signature, matchingItems);

    if (!normalizedColor) invalidColors.push(item);
    else if (getContrastAgainstWhite(normalizedColor) < MIN_WHITE_BACKGROUND_STYLE_CONTRAST) lowContrast.push(item);
  }

  return {
    totalCount: items.length,
    uniqueSignatureCount: signatures.size,
    collisions: [...signatures.values()].filter((matchingItems) => matchingItems.length > 1),
    lowContrast,
    invalidColors
  };
}

export function normalizeHexColor(value: string) {
  const match = value.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/iu);
  if (!match) return null;
  const hex = match[1].toLowerCase();
  return hex.length === 3
    ? `#${hex.split("").map((character) => `${character}${character}`).join("")}`
    : `#${hex}`;
}

export function getContrastAgainstWhite(normalizedSixDigitHex: string) {
  const components = [1, 3, 5].map(
    (offset) => Number.parseInt(normalizedSixDigitHex.slice(offset, offset + 2), 16) / 255
  );
  const linear = components.map((component) =>
    component <= 0.04045 ? component / 12.92 : ((component + 0.055) / 1.055) ** 2.4
  );
  const luminance = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  return 1.05 / (luminance + 0.05);
}
