import { describe, expect, it } from "vitest";
import { createPlottedDataCsv } from "../../src/chart/plottedDataExport";
import { createOneSpecimenEightReagentDataset } from "../../src/data/sampleData";

describe("isolated known-red audit probes", () => {
  it("records the AC-PCR-051 formula-like CSV header signature", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const curve = dataset.curves[0];
    const result = createPlottedDataCsv({
      curves: [curve],
      curveOverrides: { [curve.curveId]: { displayName: "=FORMULA-LIKE-LABEL" } }
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.csv.split("\r\n")[0]).toContain(",=");
  });
});
