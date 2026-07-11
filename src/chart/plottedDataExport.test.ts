import { describe, expect, it } from "vitest";
import { createOneSpecimenEightReagentDataset } from "../data/sampleData";
import { createPlottedDataCsv } from "./plottedDataExport";

describe("plotted data CSV export", () => {
  it("exports currently visible curves as a rectangular CSV with blanks for missing y", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const curves = dataset.curves.slice(0, 2).map((curve) => ({ ...curve, y: [...curve.y] }));
    curves[1].y[1] = null;

    const result = createPlottedDataCsv({ curves });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const lines = result.csv.split("\r\n");
    expect(lines[0]).toBe("Cycle,검체 1 │ A1,검체 1 │ A2");
    expect(lines[2].endsWith(",")).toBe(true);
  });

  it("rejects non-rectangular selected curves", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const curves = [dataset.curves[0], { ...dataset.curves[1], x: dataset.curves[1].x.slice(0, -1) }];

    const result = createPlottedDataCsv({ curves });

    expect(result.ok).toBe(false);
  });

  it("uses reagent-first headers when label mode is reagent", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const result = createPlottedDataCsv({
      curves: dataset.curves.slice(0, 1),
      labelMode: "reagent"
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.csv.split("\r\n")[0]).toBe("Cycle,A1 │ 검체 1");
  });

  it("uses analysis labels as exported headers", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const curve = dataset.curves[0];
    const result = createPlottedDataCsv({
      curves: [curve],
      curveOverrides: {
        [curve.curveId]: { displayName: "Condition A" }
      }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.csv.split("\r\n")[0]).toBe("Cycle,Condition A");
  });

  it("neutralizes spreadsheet formulas only in final CSV headers", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const curve = dataset.curves[0];
    const labels = ["=1+1", "+1+1", "-1+1", "@SUM(1,1)", '=SUM("A",1)'];

    for (const label of labels) {
      const curveOverrides = { [curve.curveId]: { displayName: label } };
      const result = createPlottedDataCsv({ curves: [curve], curveOverrides });
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.csv.split("\r\n")[0]).toContain(label.includes(",") ? `"'${label.replace(/"/gu, '""')}"` : `'${label}`);
      expect(curveOverrides[curve.curveId].displayName).toBe(label);
    }

    const negativeCurve = { ...curve, y: [-0.1, ...curve.y.slice(1)] };
    const negativeResult = createPlottedDataCsv({ curves: [negativeCurve] });
    expect(negativeResult.ok && negativeResult.csv.split("\r\n")[1]).toContain("-0.1");
  });

  it("keeps every header unique after multi-way formula neutralization", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const curves = dataset.curves.slice(0, 3);
    const result = createPlottedDataCsv({
      curves,
      curveOverrides: {
        [curves[0].curveId]: { displayName: "=X" },
        [curves[1].curveId]: { displayName: "'=X" },
        [curves[2].curveId]: { displayName: "'=X [2]" }
      }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.csv.split("\r\n")[0]).toBe("Cycle,'=X,'=X [2],'=X [2] [2]");
  });
});
