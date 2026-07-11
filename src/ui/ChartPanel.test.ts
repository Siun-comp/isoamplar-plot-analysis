import { describe, expect, it } from "vitest";
import { formatZoomScaleValue } from "./ChartPanel";

describe("Box zoom scale formatting", () => {
  it("preserves significant digits for small and large bounds", () => {
    expect(formatZoomScaleValue("y", 0.0000123456789)).toBe("0.0000123456789");
    expect(formatZoomScaleValue("y", -0.000000987654321)).toBe("-9.87654321e-7");
    expect(formatZoomScaleValue("x", 123456.789123)).toBe("123456.789123");
    expect(formatZoomScaleValue("y", -0)).toBe("0");
  });

  it("keeps distinct finite Box zoom bounds ordered after formatting", () => {
    const lower = 1;
    const upper = 1 + Number.EPSILON;
    const formattedLower = Number(formatZoomScaleValue("x", lower));
    const formattedUpper = Number(formatZoomScaleValue("x", upper));

    expect(formattedLower).toBe(lower);
    expect(formattedUpper).toBe(upper);
    expect(formattedLower).toBeLessThan(formattedUpper);
  });
});
