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

  it("parses the 3 by 83,333 supported wide boundary without quadratic warning normalization", () => {
    const result = parsePastedTable(createQuickPasteText(3, 83_333), {
      mode: "fullTable",
      sourceName: "Generated wide acceptance fixture",
      importedAtIso: "2026-07-11T00:00:00.000Z"
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary).toMatchObject({ rowCount: 3, columnCount: 83_333, cellCount: 249_999, curveCount: 83_333, cycleCount: 1 });
    expect(result.dataset.curves).toHaveLength(83_333);
    expect(result.dataset.curves[0].y).toEqual([0]);
    expect(result.dataset.curves[83_332].y).toEqual([0]);
  }, 60_000);

  it("keeps a valid exact-character-boundary header while bounding its internal entity ID", () => {
    const suffix = "\nA\n0";
    const text = `${"H".repeat(2_000_000 - suffix.length)}${suffix}`;
    const result = parsePastedTable(text, {
      mode: "fullTable",
      sourceName: "Generated character boundary fixture"
    });

    expect(text).toHaveLength(2_000_000);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dataset.curves[0].specimenLabel).toHaveLength(2_000_000 - suffix.length);
    expect(result.dataset.curves[0].specimenId.length).toBeLessThan(80);
    expect(result.summary.sourceCharacterCount).toBe(2_000_000);
  }, 60_000);

  it("parses an accepted 500 by 500 empty-heavy table with source-addressable null gaps", () => {
    const header = Array.from({ length: 500 }, () => "S").join("\t");
    const reagent = Array.from({ length: 500 }, () => "A").join("\t");
    const blankRow = Array.from({ length: 500 }, () => "").join("\t");
    const finalRow = Array.from({ length: 500 }, () => "0").join("\t");
    const text = [header, reagent, ...Array.from({ length: 497 }, () => blankRow), finalRow].join("\n");
    const result = parsePastedTable(text, { mode: "fullTable", sourceName: "Generated empty-heavy fixture" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary).toMatchObject({ rowCount: 500, columnCount: 500, cellCount: 250_000, curveCount: 500, cycleCount: 498 });
    expect(result.dataset.warnings.filter((warning) => warning.code === "EMPTY_FLUORESCENCE_CELL")).toHaveLength(248_500);
    expect(result.dataset.curves[0].y[0]).toBeNull();
    expect(result.dataset.curves[499].y[497]).toBe(0);
  }, 60_000);

  it("rejects exact character and cell overflow as typed validation failures", () => {
    const tooManyCharacters = parsePastedTable(`${"H".repeat(1_999_997)}\nA\n0`, {
      mode: "fullTable",
      sourceName: "Character overflow"
    });
    const tooManyCells = parsePastedTable(createQuickPasteText(250_001, 1), {
      mode: "fullTable",
      sourceName: "Cell overflow"
    });

    expect(tooManyCharacters.ok).toBe(false);
    if (!tooManyCharacters.ok) expect(tooManyCharacters.errorKind).toBe("validation");
    expect(tooManyCells.ok).toBe(false);
    if (!tooManyCells.ok) expect(tooManyCells.errorKind).toBe("validation");
  }, 60_000);

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
