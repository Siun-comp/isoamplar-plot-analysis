import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseExcelWorkbook } from "../../src/data/parseExcel";

type FixtureManifest = {
  fixtures: Array<{
    fixtureId: string;
    file: string;
    sha256: string;
    expected: string | null;
    status: string;
    sheetNames: string[];
  }>;
};

const fixtureRoot = join(process.cwd(), "tests", "fixtures");
const manifest = readJson<FixtureManifest>(join(fixtureRoot, "manifest.json"));

describe("fixed synthetic Excel fixtures", () => {
  it("matches every format-sensitive fixture SHA-256", () => {
    for (const fixture of manifest.fixtures) {
      const bytes = readFileSync(join(fixtureRoot, fixture.file));
      expect(sha256(bytes), fixture.fixtureId).toBe(fixture.sha256);
    }
  });

  it("keeps the checked-in .xls fixture as a BIFF compound workbook", () => {
    const bytes = fixtureBytes("FX-003");
    expect([...bytes.subarray(0, 8)]).toEqual([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  });

  it("normalizes equivalent .xlsx and BIFF8 .xls fixtures to their expected projections", async () => {
    const xlsxProjection = await parseProjection("FX-002");
    const xlsProjection = await parseProjection("FX-003");

    expect(xlsxProjection).toEqual(expectedProjection("FX-002"));
    expect(xlsProjection).toEqual(expectedProjection("FX-003"));
    expect(equivalentCurveContent(xlsProjection)).toEqual(equivalentCurveContent(xlsxProjection));
  });

  it("uses only the first worksheet from the fixed multi-sheet fixture", async () => {
    const fixture = findFixture("FX-005");
    const result = await parseExcelWorkbook(fixtureBytes(fixture.fixtureId), fileName(fixture.file));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const expected = readJson<{
      sheetName: string;
      curveIds: string[];
      reagentLabels: string[];
      datasetWarningCodes: string[];
    }>(join(fixtureRoot, fixture.expected!));

    expect(result.dataset.sheetName).toBe(expected.sheetName);
    expect(result.dataset.curves.map((curve) => curve.curveId)).toEqual(expected.curveIds);
    expect(result.dataset.curves.map((curve) => curve.reagentLabel)).toEqual(expected.reagentLabels);
    expect(result.dataset.warnings.map((warning) => warning.code)).toEqual(expected.datasetWarningCodes);
  });

  it("keeps warning codes and source locations stable for the warning fixture", async () => {
    const fixture = findFixture("FX-004");
    const result = await parseExcelWorkbook(fixtureBytes(fixture.fixtureId), fileName(fixture.file));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const expected = readJson<{
      cycleCount: number;
      curves: Array<{ curveId: string; y: Array<number | null>; warningCodes: string[] }>;
      requiredWarningEvidence: Array<{
        code: string;
        sourceCell?: string;
        sourceRange?: string;
        curveId?: string;
      }>;
    }>(join(fixtureRoot, fixture.expected!));

    expect(result.dataset.cycleCount).toBe(expected.cycleCount);
    expect(
      result.dataset.curves.map((curve) => ({
        curveId: curve.curveId,
        y: curve.y,
        warningCodes: curve.warnings.map((warning) => warning.code)
      }))
    ).toEqual(expected.curves);

    for (const evidence of expected.requiredWarningEvidence) {
      expect(
        result.dataset.warnings.some(
          (warning) =>
            warning.code === evidence.code &&
            (evidence.sourceCell === undefined || warning.sourceCell === evidence.sourceCell) &&
            (evidence.sourceRange === undefined || warning.sourceRange === evidence.sourceRange) &&
            (evidence.curveId === undefined || warning.curveIds?.includes(evidence.curveId))
        ),
        JSON.stringify(evidence)
      ).toBe(true);
    }
  });

});

function findFixture(fixtureId: string) {
  const fixture = manifest.fixtures.find((entry) => entry.fixtureId === fixtureId);
  if (!fixture) throw new Error(`Missing fixture ${fixtureId}`);
  return fixture;
}

function fixtureBytes(fixtureId: string) {
  return readFileSync(join(fixtureRoot, findFixture(fixtureId).file));
}

async function parseProjection(fixtureId: string) {
  const fixture = findFixture(fixtureId);
  const result = await parseExcelWorkbook(fixtureBytes(fixtureId), fileName(fixture.file));
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return {
    schemaVersion: 1,
    fixtureId,
    result: "ok",
    source: {
      fileName: fileName(fixture.file),
      sheetNames: fixture.sheetNames,
      usedSheetIndex: result.dataset.sheetIndex,
      usedSheetName: result.dataset.sheetName,
      ignoredSheetNames: fixture.sheetNames.slice(1)
    },
    dataset: {
      schemaVersion: result.dataset.schemaVersion,
      sourceKind: result.dataset.sourceKind,
      sheetIndex: result.dataset.sheetIndex,
      cycleCount: result.dataset.cycleCount,
      orderedCurveIds: result.dataset.orderedCurveIds,
      curves: result.dataset.curves.map((curve) => ({
        curveId: curve.curveId,
        sourceId: curve.sourceId,
        specimenId: curve.specimenId,
        reagentId: curve.reagentId,
        specimenLabel: curve.specimenLabel,
        reagentLabel: curve.reagentLabel,
        displayLabel: curve.displayLabel,
        x: curve.x,
        y: curve.y,
        stats: curve.stats,
        source: {
          sourceKind: curve.source.sourceKind,
          fileName: curve.source.fileName,
          sheetName: curve.source.sheetName,
          sheetIndex: curve.source.sheetIndex,
          columnIndex: curve.source.columnIndex,
          columnLetter: curve.source.columnLetter,
          specimenCell: curve.source.specimenCell,
          reagentCell: curve.source.reagentCell,
          dataStartCell: curve.source.dataStartCell,
          dataEndCell: curve.source.dataEndCell
        },
        warnings: curve.warnings.map(projectWarning)
      })),
      specimens: result.dataset.specimens.map((entity) => ({
        id: entity.id,
        label: entity.label,
        curveIds: entity.curveIds,
        warningCodes: entity.warnings.map((warning) => warning.code)
      })),
      reagents: result.dataset.reagents.map((entity) => ({
        id: entity.id,
        label: entity.label,
        curveIds: entity.curveIds,
        warningCodes: entity.warnings.map((warning) => warning.code)
      })),
      warnings: result.dataset.warnings.map(projectWarning)
    }
  };
}

function expectedProjection(fixtureId: string) {
  const fixture = findFixture(fixtureId);
  if (!fixture.expected) throw new Error(`Missing expected projection for ${fixtureId}`);
  return readJson<Awaited<ReturnType<typeof parseProjection>>>(join(fixtureRoot, fixture.expected));
}

function fileName(path: string) {
  return path.split("/").at(-1) ?? path;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

function projectWarning(warning: {
  code: string;
  severity: string;
  scope: string;
  curveIds?: string[];
  labels?: string[];
  sourceCell?: string;
  sourceRange?: string;
  sheetName?: string;
  columnLetter?: string;
  rawValue?: unknown;
}) {
  return {
    code: warning.code,
    severity: warning.severity,
    scope: warning.scope,
    curveIds: warning.curveIds ?? [],
    labels: warning.labels ?? [],
    sourceCell: warning.sourceCell ?? null,
    sourceRange: warning.sourceRange ?? null,
    sheetName: warning.sheetName ?? null,
    columnLetter: warning.columnLetter ?? null,
    rawValue: warning.rawValue ?? null
  };
}

function equivalentCurveContent(projection: Awaited<ReturnType<typeof parseProjection>>) {
  return projection.dataset.curves.map((curve) => ({
    specimenLabel: curve.specimenLabel,
    reagentLabel: curve.reagentLabel,
    displayLabel: curve.displayLabel,
    x: curve.x,
    y: curve.y,
    stats: curve.stats,
    warnings: curve.warnings
  }));
}
