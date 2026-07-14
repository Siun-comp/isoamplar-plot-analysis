import { describe, expect, it } from "vitest";
import type { LegendItem } from "./chartProjection";
import {
  calculateLegendEvidenceRegions,
  calculateLegendImageSize,
  createLegendSvg,
  createReportLegendExcelClipboardPayload,
  dataUrlToBlob,
  validateLegendLayoutForImageExport
} from "./exportChart";

describe("chart export helpers", () => {
  it("derives non-overlapping standard legend evidence slots from export geometry", () => {
    const regions = calculateLegendEvidenceRegions(2);
    expect(regions).toHaveLength(2);
    expect(regions[0].sample.right).toBeLessThanOrEqual(regions[0].text.left);
    expect(regions[0].text.right).toBeLessThanOrEqual(regions[1].sample.left);
    expect(calculateLegendImageSize(Array.from({ length: 2 }) as LegendItem[]).height).toBe(126);
  });

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
    const plotSvg = createLegendSvg(items, size.width, size.height, "plot");

    expect(size.height).toBeGreaterThan(58);
    expect(svg).toContain("A &amp; B");
    expect(svg).toContain('stroke-dasharray="8 5"');
    expect(svg).toContain('stroke-dasharray="1 5"');
    expect(svg).toContain("<circle");
    expect(svg).toContain("<polygon");
    expect(svg.match(/<(circle|polygon) /gu)).toHaveLength(2);
    expect(plotSvg).toContain('stroke-width="5.4"');
    expect(plotSvg).toContain('stroke-width="7.2"');
  });

  it("renders every line and marker combination without changing requested width", () => {
    const lineTypes = ["solid", "dashed", "dotted"] as const;
    const markerTypes = ["none", "circle", "triangle", "rect"] as const;
    const items: LegendItem[] = lineTypes.flatMap((lineType) =>
      markerTypes.map((markerType) => ({
        curveId: `${lineType}-${markerType}`,
        label: `${lineType} ${markerType}`,
        color: "#0926fb",
        lineType,
        markerType,
        lineWidth: 2.25
      }))
    );
    const size = calculateLegendImageSize(items, 800);
    const svg = createLegendSvg(items, size.width, size.height);

    expect(size.width).toBe(800);
    expect(svg.match(/data-curve-id=/gu)).toHaveLength(12);
    expect(svg.match(/stroke-dasharray="8 5"/gu)).toHaveLength(4);
    expect(svg.match(/stroke-dasharray="1 5"/gu)).toHaveLength(4);
    expect(svg.match(/<circle /gu)).toHaveLength(3);
    expect(svg.match(/<polygon /gu)).toHaveLength(3);
    expect(svg.match(/<rect x=/gu)).toHaveLength(3);
    const bounds = readLegendBounds(svg);
    expect(bounds).toHaveLength(12);
    expect(bounds.every((bound) => bound.sampleRight < bound.textLeft)).toBe(true);
    expect(bounds.every((bound) => bound.textRight <= size.width && bound.rowTop >= 0 && bound.rowBottom <= size.height)).toBe(true);
    const boundsByRow = new Map<number, typeof bounds>();
    for (const bound of bounds) boundsByRow.set(bound.rowTop, [...(boundsByRow.get(bound.rowTop) ?? []), bound]);
    for (const row of boundsByRow.values()) {
      const ordered = [...row].sort((left, right) => left.sampleLeft - right.sampleLeft);
      for (let index = 1; index < ordered.length; index += 1) {
        expect(ordered[index - 1].textRight).toBeLessThanOrEqual(ordered[index].sampleLeft);
      }
    }

    const tinySize = calculateLegendImageSize(items.slice(0, 1), 100);
    expect(tinySize.width).toBe(100);
    expect(() => createLegendSvg(items.slice(0, 1), tinySize.width, tinySize.height)).toThrow(/requested output width/u);
    expect(() => createLegendSvg(items.slice(0, 1), 800, 20)).toThrow(/requested output height/u);
  });

  it("creates a report legend SVG with larger readable rows", () => {
    const items: LegendItem[] = [
      {
        curveId: "curve-a",
        label: "Condition A_15 │ Lot old",
        color: "#0b6fa4",
        lineType: "solid",
        markerType: "none",
        lineWidth: 2.25
      },
      {
        curveId: "curve-b",
        label: "Condition A_20 │ Lot new very long label segment",
        color: "#d97706",
        lineType: "dashed",
        markerType: "circle",
        lineWidth: 2.25
      },
      {
        curveId: "curve-c",
        label: "Condition B_25 │ Lot old",
        color: "#5b8c5a",
        lineType: "dotted",
        markerType: "triangle",
        lineWidth: 3
      },
      {
        curveId: "curve-d",
        label: "Condition B_31 │ Lot new",
        color: "#b23a48",
        lineType: "solid",
        markerType: "rect",
        lineWidth: 2.25
      },
      {
        curveId: "curve-e",
        label: "Condition B_39 │ Lot old",
        color: "#6f5fa8",
        lineType: "solid",
        markerType: "none",
        lineWidth: 2.25
      }
    ];
    const size = calculateLegendImageSize(items, 900, "report");
    const svg = createLegendSvg(items, size.width, size.height, "report");

    expect(size).toEqual({ width: 900, height: 302 });
    expect(svg).toContain('font-size="22"');
    expect(svg).toContain('stroke-width="3.5"');
    expect(svg).toContain("<tspan");
    expect(svg).toContain("<rect");
  });

  it("measures and bounds a long report title while preserving its distinguishing ending", () => {
    const items: LegendItem[] = [
      {
        curveId: "curve-a",
        label: "Assay A",
        color: "#7030a0",
        lineType: "solid",
        markerType: "none",
        lineWidth: 2.25
      }
    ];
    const title = "Legend - Specimen: Synthetic common condition with a very long preparation description Temperature 60C";
    const size = calculateLegendImageSize(items, 480, "report");
    const svg = createLegendSvg(items, size.width, size.height, "report", title);

    expect(svg).toContain("Temperature 60C");
    expect(svg).toContain('data-title-truncated="true"');
    expect(Number(svg.match(/data-title-right="([^"]+)"/u)?.[1])).toBeLessThanOrEqual(size.width);
    expect(Number(svg.match(/data-title-bottom="([^"]+)"/u)?.[1])).toBeLessThan(100);
  });

  it("preserves distinguishing shared-prefix suffixes and rejects unresolved display collisions", () => {
    const sharedPrefixItems: LegendItem[] = [
      {
        curveId: "curve-lot-a",
        label: "Condition Alpha concentration with distinguishing Lot A",
        sourceIdentity: "source-1 / Sheet1 / A",
        color: "#7030a0",
        lineType: "dashed",
        markerType: "circle",
        lineWidth: 2.25
      },
      {
        curveId: "curve-lot-b",
        label: "Condition Alpha concentration with distinguishing Lot B",
        sourceIdentity: "source-2 / Sheet1 / B",
        color: "#0926fb",
        lineType: "dotted",
        markerType: "rect",
        lineWidth: 2.25
      }
    ];

    const svg = createLegendSvg(sharedPrefixItems, 330, calculateLegendImageSize(sharedPrefixItems, 330).height);
    expect(svg).toContain("Lot A");
    expect(svg).toContain("Lot B");
    expect(svg).toContain('data-truncated="true"');

    const collisionItems = sharedPrefixItems.map((item) => ({ ...item, label: "Condition Shared Final Label" }));
    expect(() => createLegendSvg(collisionItems, 520, calculateLegendImageSize(collisionItems, 520).height)).toThrow(
      /source-1.*source-2/u
    );
    expect(() => createReportLegendExcelClipboardPayload({ title: "Legend", items: collisionItems })).toThrow(
      /not distinguishable/u
    );
    const reportSize = calculateLegendImageSize(sharedPrefixItems, 520, "report");
    const reportSvg = createLegendSvg(sharedPrefixItems, reportSize.width, reportSize.height, "report", "Legend");
    expect(reportSvg).toContain("Lot A");
    expect(reportSvg).toContain("Lot B");
    const reportBounds = readLegendBounds(reportSvg);
    expect(reportBounds).toHaveLength(sharedPrefixItems.length);
    expect(reportBounds.every((bound) => bound.sampleRight < bound.textLeft)).toBe(true);
    expect(
      reportBounds.every(
        (bound) => bound.textRight <= reportSize.width && bound.rowTop >= 0 && bound.rowBottom <= reportSize.height
      )
    ).toBe(true);
    const orderedReportBounds = [...reportBounds].sort((left, right) => left.rowTop - right.rowTop);
    for (let index = 1; index < orderedReportBounds.length; index += 1) {
      expect(orderedReportBounds[index - 1].rowBottom).toBeLessThanOrEqual(orderedReportBounds[index].rowTop);
    }
    expect(() => createLegendSvg(collisionItems, reportSize.width, reportSize.height, "report", "Legend")).toThrow(
      /source-1.*source-2/u
    );

    expect(() => validateLegendLayoutForImageExport({ layout: "plotOnly", items: collisionItems, width: 100 })).not.toThrow();
    expect(() => validateLegendLayoutForImageExport({ layout: "legendOnly", items: collisionItems, width: 520 })).toThrow(
      /not distinguishable/u
    );
  });

  it("creates rich Excel clipboard payload for report legend cells", () => {
    const items: LegendItem[] = [
      {
        curveId: "curve-a",
        label: "=A1 label",
        color: "#0b6fa4",
        lineType: "dashed",
        markerType: "circle",
        lineWidth: 2.25
      }
    ];
    const payload = createReportLegendExcelClipboardPayload({ title: "Legend - Specimen: S1", items });

    expect(payload.html).toContain("<table");
    expect(payload.html).toContain("Style");
    expect(payload.html).toContain("Name");
    expect(payload.html).toContain("Malgun Gothic");
    expect(payload.html).toContain("font-size:9pt");
    expect(payload.html).toContain("color:#0b6fa4");
    expect(payload.html).toContain("&#9679;");
    expect(payload.html).toContain("&#9472;&#9472;&nbsp;&nbsp;&#9679;&nbsp;&nbsp;&#9472;&#9472;");
    expect(payload.html).toContain("&#8203;=A1 label");
    expect(payload.text.split("\r\n")).toEqual(["Legend - Specimen: S1", "Style\tName", "dashed, circle, #0b6fa4\t\u200B=A1 label"]);
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

function readLegendBounds(svg: string) {
  return [...svg.matchAll(/<g ([^>]+)>/gu)].map((match) => {
    const attributes = match[1];
    const number = (name: string) => Number(attributes.match(new RegExp(`${name}="([^"]+)"`, "u"))?.[1]);
    return {
      sampleLeft: number("data-sample-left"),
      sampleRight: number("data-sample-right"),
      textLeft: number("data-text-left"),
      textRight: number("data-text-right"),
      rowTop: number("data-row-top"),
      rowBottom: number("data-row-bottom")
    };
  });
}
