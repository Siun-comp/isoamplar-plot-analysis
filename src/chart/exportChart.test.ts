import { describe, expect, it } from "vitest";
import type { LegendItem } from "./chartProjection";
import { calculateLegendImageSize, createLegendSvg, dataUrlToBlob } from "./exportChart";

describe("chart export helpers", () => {
  it("creates a legend SVG with line and marker samples", () => {
    const items: LegendItem[] = [
      {
        curveId: "curve-a",
        label: "A & B",
        color: "#0b6fa4",
        lineType: "solid",
        markerType: "none",
        lineWidth: 2.25
      },
      {
        curveId: "curve-b",
        label: "Dashed circle",
        color: "#d97706",
        lineType: "dashed",
        markerType: "circle",
        lineWidth: 3
      },
      {
        curveId: "curve-c",
        label: "Dotted triangle",
        color: "#5b8c5a",
        lineType: "dotted",
        markerType: "triangle",
        lineWidth: 2.25
      }
    ];
    const size = calculateLegendImageSize(items, 800);
    const svg = createLegendSvg(items, size.width, size.height);

    expect(size.height).toBeGreaterThan(58);
    expect(svg).toContain("A &amp; B");
    expect(svg).toContain('stroke-dasharray="8 5"');
    expect(svg).toContain('stroke-dasharray="1 5"');
    expect(svg).toContain("<circle");
    expect(svg).toContain("<polygon");
    expect(svg.match(/<(circle|polygon) /gu)).toHaveLength(2);
  });

  it("converts base64 image data URLs to typed blobs", async () => {
    const blob = dataUrlToBlob("data:image/png;base64,AAAA");
    expect(blob.type).toBe("image/png");
    expect(blob.size).toBe(3);
  });

  it("rejects empty or non-image export data URLs", () => {
    expect(() => dataUrlToBlob("data:,")).toThrow("Image export failed.");
    expect(() => dataUrlToBlob("data:text/plain;base64,AAAA")).toThrow("Image export failed.");
  });
});
