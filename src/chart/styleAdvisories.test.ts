import { describe, expect, it } from "vitest";
import type { LegendItem } from "./chartProjection";
import {
  MIN_WHITE_BACKGROUND_STYLE_CONTRAST,
  createStyleAdvisories,
  getContrastAgainstWhite,
  normalizeHexColor
} from "./styleAdvisories";

function item(curveId: string, color: string, lineType: LegendItem["lineType"] = "solid", markerType: LegendItem["markerType"] = "none"): LegendItem {
  return { curveId, label: curveId, color, lineType, markerType, lineWidth: 2 };
}

describe("style advisories", () => {
  it("normalizes short and long HEX colors before collision detection", () => {
    const result = createStyleAdvisories([item("curve-a", "#fff"), item("curve-b", "#FFFFFF")]);
    expect(result.collisions).toHaveLength(1);
    expect(result.collisions[0].map((entry) => entry.curveId)).toEqual(["curve-a", "curve-b"]);
  });

  it("does not report a collision when color, line, or marker distinguishes each curve", () => {
    const result = createStyleAdvisories([
      item("color", "#000000"),
      item("line", "#111111", "dashed"),
      item("marker", "#111111", "solid", "circle")
    ]);
    expect(result.collisions).toHaveLength(0);
  });

  it("treats line width as part of a curve's visible style signature", () => {
    const thin = item("thin", "#111111");
    const thick = { ...item("thick", "#111111"), lineWidth: 4 };
    const result = createStyleAdvisories([thin, thick]);
    expect(result.collisions).toHaveLength(0);
    expect(result.uniqueSignatureCount).toBe(2);
    expect(result.totalCount).toBe(2);
  });

  it("uses the documented 3:1 white-background advisory threshold", () => {
    expect(MIN_WHITE_BACKGROUND_STYLE_CONTRAST).toBe(3);
    expect(getContrastAgainstWhite(normalizeHexColor("#767171")!)).toBeGreaterThanOrEqual(3);
    expect(getContrastAgainstWhite(normalizeHexColor("#ffc000")!)).toBeLessThan(3);
    expect(createStyleAdvisories([item("low", "#ffc000")]).lowContrast).toHaveLength(1);
  });

  it("reports colors that cannot be assessed instead of treating them as high contrast", () => {
    const result = createStyleAdvisories([item("invalid", "not-a-color")]);
    expect(result.invalidColors.map((entry) => entry.curveId)).toEqual(["invalid"]);
    expect(result.lowContrast).toHaveLength(0);
  });
});
