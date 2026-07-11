import { describe, expect, it } from "vitest";
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
