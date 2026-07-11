import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createLegendSvg } from "../../src/chart/exportChart";
import { createPlottedDataCsv } from "../../src/chart/plottedDataExport";
import { createOneSpecimenEightReagentDataset } from "../../src/data/sampleData";
import { parseExcelWorkbook } from "../../src/data/parseExcel";
import { legendIdentityCases } from "../fixtures/generatedCases";

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
