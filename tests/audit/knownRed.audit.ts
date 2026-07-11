import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createLegendSvg } from "../../src/chart/exportChart";
import { buildPcrChartOption } from "../../src/chart/chartConfig";
import { createDefaultChartScale } from "../../src/chart/chartScale";
import { createPlottedDataCsv } from "../../src/chart/plottedDataExport";
import { createOneSpecimenEightReagentDataset } from "../../src/data/sampleData";
import { parseExcelWorkbook } from "../../src/data/parseExcel";
import { parsePastedTable } from "../../src/data/parsePastedTable";
import { createQuickPasteText, legendIdentityCases } from "../fixtures/generatedCases";

const fixtureRoot = join(process.cwd(), "tests", "fixtures");

describe("isolated known-red audit probes", () => {
  it("records the AC-PCR-047 formatted-header mismatch signature", async () => {
    const bytes = readFileSync(join(fixtureRoot, "source", "FX-001-formatted-headers.xlsx"));
    const result = await parseExcelWorkbook(bytes, "FX-001-formatted-headers.xlsx");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    const target = JSON.parse(
      readFileSync(join(fixtureRoot, "expected", "FX-001-formatted-headers.target.json"), "utf8")
    ) as { headers: Array<{ sourceCell: string; displayText: string }> };
    const displayByCell = new Map(target.headers.map((header) => [header.sourceCell, header.displayText]));
    const actualByCell = result.dataset.curves.flatMap((curve) => [
      { sourceCell: curve.source.specimenCell, actual: curve.specimenLabel },
      { sourceCell: curve.source.reagentCell, actual: curve.reagentLabel }
    ]);
    const currentSignature = actualByCell.map((entry) =>
      entry.sourceCell === "B1"
        ? { ...entry, actual: `Date:${new Date(entry.actual).toISOString()}` }
        : entry
    );
    expect(currentSignature).toEqual([
      { sourceCell: "A1", actual: "1" },
      { sourceCell: "A2", actual: "Assay Code" },
      { sourceCell: "B1", actual: "Date:2026-01-15T00:00:00.000Z" },
      { sourceCell: "B2", actual: "1250" },
      { sourceCell: "C1", actual: "  Synthetic Sample  " },
      { sourceCell: "C2", actual: "Assay / Alpha" },
      { sourceCell: "D1", actual: "한글 검체 / 특수｜기호" },
      { sourceCell: "D2", actual: "시약 β" }
    ]);
    expect(
      currentSignature
        .map((entry) => ({ ...entry, target: displayByCell.get(entry.sourceCell) }))
        .filter((entry) => entry.actual !== entry.target)
    ).toEqual([
      { sourceCell: "A1", actual: "1", target: "001" },
      { sourceCell: "B1", actual: "Date:2026-01-15T00:00:00.000Z", target: "2026-01-15" },
      { sourceCell: "B2", actual: "1250", target: "1.25E+03" }
    ]);
  });

  it("records the AC-QP-021 reproduced RangeError signature for a 150,000-cell tall table", () => {
    const text = createQuickPasteText(150_000, 1);
    expect(text.length).toBeLessThan(2_000_000);
    expect(text.split("\n")).toHaveLength(150_000);
    expect(() =>
      parsePastedTable(text, {
        mode: "fullTable",
        sourceName: "Generated tall audit fixture",
        importedAtIso: "2026-07-11T00:00:00.000Z"
      })
    ).toThrow(/Maximum call stack size exceeded/iu);
  });

  it("records the AC-PCR-045 Auto-like axis signature for invalid active Fixed scale", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const scale = createDefaultChartScale();
    scale.y = { ...scale.y, mode: "fixed", fixedMin: "20", fixedMax: "10" };
    const result = buildPcrChartOption({
      dataset,
      selectedCurveIds: new Set([dataset.curves[0].curveId]),
      scale
    });
    const yAxis = result.option.yAxis as { min?: number; max?: number };
    expect(result.scaleIssues).toHaveLength(1);
    expect([yAxis.min, yAxis.max]).toEqual([undefined, undefined]);
  });

  it("records the AC-PCR-046 missing-suffix signature in legend SVG", () => {
    const svg = createLegendSvg(
      legendIdentityCases.uniqueSuffixes.map((item) => legendItem(item.curveId, item.label)),
      520,
      120
    );
    expect(svg).not.toContain("Lot A");
    expect(svg).not.toContain("Lot B");
    expect(svg).toContain("...");
  });

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

function legendItem(curveId: string, label: string) {
  return {
    curveId,
    label,
    color: "#0926fb",
    lineType: "solid" as const,
    markerType: "none" as const,
    lineWidth: 2
  };
}
