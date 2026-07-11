import { describe, expect, it } from "vitest";
import { parsePastedTable } from "../../src/data/parsePastedTable";
import {
  createQuickPasteText,
  labelWarningCases,
  legendIdentityCases,
  malformedAnalysisCases,
  quickPasteBoundaryCases,
  scaleEvidenceCases,
  sourceCompatibilityCases
} from "./generatedCases";

describe("generated audit fixture descriptors", () => {
  it("defines exact Quick Paste supported and over-limit shapes", () => {
    expect(quickPasteBoundaryCases.map((entry) => entry.rows * entry.columns)).toEqual([
      250_000,
      249_999,
      250_000,
      250_500
    ]);
  });

  it("generates a tabular synthetic Quick Paste fixture with the requested shape", () => {
    const text = createQuickPasteText(5, 3);
    const rows = text.split("\n").map((row) => row.split("\t"));
    expect(rows).toHaveLength(5);
    expect(rows.every((row) => row.length === 3)).toBe(true);
    expect(rows[0]).toEqual(["S", "S", "S"]);
    expect(rows[1]).toEqual(["A", "A", "A"]);
  });

  it("parses the exact 250,000-row supported tall boundary without a RangeError", () => {
    const result = parsePastedTable(createQuickPasteText(250_000, 1), {
      mode: "fullTable",
      sourceName: "Generated tall acceptance fixture",
      importedAtIso: "2026-07-11T00:00:00.000Z"
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dataset.curves).toHaveLength(1);
    expect(result.dataset.curves[0].stats).toEqual({
      pointCount: 249_998,
      missingCount: 0,
      minY: 0,
      maxY: 0
    });
  });

  it("parses the 500 by 500 supported boundary and rejects the next over-limit shape", () => {
    const balanced = parsePastedTable(createQuickPasteText(500, 500), {
      mode: "fullTable",
      sourceName: "Generated balanced acceptance fixture"
    });
    expect(balanced.ok).toBe(true);
    if (balanced.ok) {
      expect(balanced.dataset.curves).toHaveLength(500);
      expect(balanced.dataset.curves[0].stats.pointCount).toBe(498);
    }

    const overLimit = parsePastedTable(createQuickPasteText(501, 500), {
      mode: "fullTable",
      sourceName: "Generated over-limit fixture"
    });
    expect(overLimit.ok).toBe(false);
    if (!overLimit.ok) expect(overLimit.error.message).toContain("cell 수");
  });

  it("covers invalid/valid scale, identity collision, multi-source cycles, and malformed restore cases", () => {
    expect(scaleEvidenceCases.map((entry) => entry.id)).toEqual([
      "fixed-reversed",
      "preset1-empty",
      "preset2-exponent",
      "box-zoom-tiny"
    ]);
    expect(new Set(legendIdentityCases.finalStringCollision.map((entry) => entry.label)).size).toBe(1);
    expect(sourceCompatibilityCases.map((entry) => entry.cycleCount)).toEqual([40, 60]);
    expect(malformedAnalysisCases).toHaveLength(6);
    expect(labelWarningCases.duplicatePairs[0]).toEqual(labelWarningCases.duplicatePairs[1]);
  });
});
