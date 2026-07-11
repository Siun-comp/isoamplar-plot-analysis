import { describe, expect, it } from "vitest";
import { appendPcrDataset } from "./mergeDatasets";
import { createPcrDatasetFromCurves } from "./normalizePcrData";
import { createSyntheticPcrDataset } from "./sampleData";

describe("PCR dataset append merge", () => {
  it("rekeys appended curves and keeps original curve ids stable", () => {
    const base = createSyntheticPcrDataset({
      fileName: "first.xlsx",
      specimenLabels: ["검체 1"],
      reagentLabels: ["A1", "A2"]
    });
    const incoming = createSyntheticPcrDataset({
      fileName: "second.xlsx",
      specimenLabels: ["검체 2"],
      reagentLabels: ["A1", "A2"]
    });

    const result = appendPcrDataset(base, incoming);

    expect(result.dataset.curves).toHaveLength(4);
    expect(result.dataset.orderedCurveIds.slice(0, 2)).toEqual(base.orderedCurveIds);
    expect(result.appendedCurveIds).toEqual(["file2_sheet0_col_A", "file2_sheet0_col_B"]);
    expect(new Set(result.dataset.orderedCurveIds).size).toBe(result.dataset.orderedCurveIds.length);
    expect(result.dataset.reagents).toHaveLength(2);
    expect(result.dataset.specimens).toHaveLength(2);
  });

  it("keeps repeated imports with identical file metadata traceable as separate source instances", () => {
    const base = createSyntheticPcrDataset({
      fileName: "repeated.xlsx",
      specimenLabels: ["Specimen 1"],
      reagentLabels: ["A1"]
    });
    const incoming = createSyntheticPcrDataset({
      fileName: "repeated.xlsx",
      specimenLabels: ["Specimen 1"],
      reagentLabels: ["A1"]
    });

    const result = appendPcrDataset(base, incoming);
    const [firstCurve, secondCurve] = result.dataset.curves;

    expect(firstCurve.source.sourceInstanceId).not.toBe(secondCurve.source.sourceInstanceId);
    expect(firstCurve.sourceId).not.toBe(secondCurve.sourceId);
  });

  it("does not deduplicate same-location warnings from repeated imports with the same file name", () => {
    const base = createSyntheticPcrDataset({ fileName: "repeated.xlsx", specimenLabels: ["S1"], reagentLabels: ["R1"] });
    const incoming = createSyntheticPcrDataset({ fileName: "repeated.xlsx", specimenLabels: ["S1"], reagentLabels: ["R1"] });
    for (const dataset of [base, incoming]) {
      const curve = dataset.curves[0];
      dataset.warnings.push({
        code: "MERGED_HEADER_CELL",
        severity: "warning",
        scope: "header",
        message: "Merged header cells are not expanded or auto-filled.",
        curveIds: [curve.curveId],
        sourceRange: "A1:A2",
        handling: "kept",
        sourceRefs: [
          {
            sourceInstanceId: curve.source.sourceInstanceId,
            sourceName: curve.source.fileName,
            sourceKind: "excel",
            worksheet: curve.source.sheetName,
            range: "A1:A2",
            columnLetter: "A"
          }
        ]
      });
    }

    const result = appendPcrDataset(base, incoming);
    const warnings = result.dataset.warnings.filter((warning) => warning.code === "MERGED_HEADER_CELL");

    expect(warnings).toHaveLength(2);
    expect(new Set(warnings.map((warning) => warning.sourceRefs?.[0]?.sourceInstanceId)).size).toBe(2);
  });

  it("regenerates formatted-header collision warnings once after append", () => {
    const baseSource = createSyntheticPcrDataset({
      fileName: "collision.xlsx",
      specimenLabels: ["001"],
      reagentLabels: ["R1", "R1"]
    });
    baseSource.curves[0].source.specimenHeader = {
      rawValue: 1,
      displayValue: "001",
      cellType: "n",
      numberFormat: "000",
      formulaCacheStatus: "not-formula"
    };
    baseSource.curves[1].source.specimenHeader = {
      rawValue: "001",
      displayValue: "001",
      cellType: "s",
      formulaCacheStatus: "not-formula"
    };
    const base = createPcrDatasetFromCurves({
      curves: baseSource.curves,
      fileName: baseSource.sourceFileName,
      sheetName: baseSource.sheetName,
      cycleCount: baseSource.cycleCount,
      importedAtIso: baseSource.importedAtIso
    });
    expect(base.warnings.filter((warning) => warning.code === "FORMATTED_HEADER_IDENTITY_COLLISION")).toHaveLength(1);
    const incoming = createSyntheticPcrDataset({ fileName: "next.xlsx", specimenLabels: ["S2"], reagentLabels: ["R3"] });

    const result = appendPcrDataset(base, incoming);

    expect(result.dataset.warnings.filter((warning) => warning.code === "FORMATTED_HEADER_IDENTITY_COLLISION")).toHaveLength(1);
  });
});
