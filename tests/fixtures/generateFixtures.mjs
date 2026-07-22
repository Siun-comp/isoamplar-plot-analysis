import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";

const fixtureRoot = dirname(fileURLToPath(import.meta.url));
const sourceRoot = join(fixtureRoot, "source");
const expectedRoot = join(fixtureRoot, "expected");

mkdirSync(sourceRoot, { recursive: true });
mkdirSync(expectedRoot, { recursive: true });

const fixtures = [
  writeFormattedHeadersFixture(),
  writeEquivalentFixture("FX-002", "equivalent.xlsx", "xlsx"),
  writeEquivalentFixture("FX-003", "equivalent.xls", "biff8"),
  writeWarningFixture(),
  writeMultiSheetFixture(),
  writeSharedPrefixFixture(),
  writeSmallYFixture()
];

for (const fixture of fixtures) {
  const bytes = readFileSync(join(fixtureRoot, fixture.file));
  fixture.byteLength = bytes.length;
  fixture.magicHex = bytes.subarray(0, 8).toString("hex");
  fixture.sha256 = sha256(bytes);
}

writeJson(join(fixtureRoot, "manifest.json"), {
  schemaVersion: 1,
  generator: {
    path: "tests/fixtures/generateFixtures.mjs",
    producer: "SheetJS CE",
    producerVersion: XLSX.version
  },
  dataPolicy: { syntheticOnly: true },
  fixtures
});

function writeFormattedHeadersFixture() {
  const worksheet = XLSX.utils.aoa_to_sheet([
    [1, 46037, "  Synthetic Sample  ", "한글 검체 / 특수｜기호"],
    ["Assay Code", 1250, "Assay / Alpha", "시약 β"],
    [0.01, 0.02, 0.03, 0.04],
    [0.2, 0.3, 0.4, 0.5]
  ]);
  worksheet.A1.z = "000";
  worksheet.B1.z = "yyyy-mm-dd";
  worksheet.B2.z = "0.00E+00";
  const workbook = workbookWithSheet(worksheet);
  const file = "source/FX-001-formatted-headers.xlsx";
  writeWorkbook(workbook, file, "xlsx");
  writeJson(join(expectedRoot, "FX-001-formatted-headers.target.json"), {
    schemaVersion: 1,
    fixtureId: "FX-001",
    result: "ok",
    headers: [
      headerTarget("A1", "001", "n", 1, "000"),
      headerTarget("A2", "Assay Code", "s", "Assay Code", null),
      headerTarget("B1", "2026-01-15", "n", 46037, "yyyy-mm-dd"),
      headerTarget("B2", "1.25E+03", "n", 1250, "0.00E+00"),
      headerTarget("C1", "  Synthetic Sample  ", "s", "  Synthetic Sample  ", null),
      headerTarget("C2", "Assay / Alpha", "s", "Assay / Alpha", null),
      headerTarget("D1", "한글 검체 / 특수｜기호", "s", "한글 검체 / 특수｜기호", null),
      headerTarget("D2", "시약 β", "s", "시약 β", null)
    ],
    note: "Passing S4 target for Excel display-text identity and raw header provenance."
  });
  return {
    fixtureId: "FX-001",
    logicalCaseId: "formatted-header-identity",
    file,
    format: "OOXML .xlsx",
    extension: ".xlsx",
    sheetNames: ["Data"],
    expected: "expected/FX-001-formatted-headers.target.json",
    status: "active",
    covers: ["AC-PCR-047", "C-P1-03"],
    purpose: "Excel display text versus raw header identity."
  };
}

function writeEquivalentFixture(fixtureId, fileName, bookType) {
  const rows = [
    ["Synthetic 검체 A / α", "Synthetic Sample B ｜ β"],
    ["Assay 1", "시약 2"],
    [0.1, -0.1],
    [1.2, 1.4],
    [2.4, 3.5]
  ];
  const file = `source/${fixtureId}-${fileName}`;
  writeWorkbook(workbookWithSheet(XLSX.utils.aoa_to_sheet(rows)), file, bookType);
  const expected = `expected/${fixtureId}-equivalent.json`;
  writeJson(join(fixtureRoot, expected), equivalentExpected(fixtureId, `${fixtureId}-${fileName}`));
  return {
    fixtureId,
    logicalCaseId: "excel-container-parity",
    file,
    format: bookType === "biff8" ? "BIFF8 .xls" : "OOXML .xlsx",
    extension: bookType === "biff8" ? ".xls" : ".xlsx",
    sheetNames: ["Data"],
    expected,
    status: "active",
    covers: ["AC-PCR-001", "AC-PCR-006", "AC-PCR-016"],
    purpose: "Equivalent normalized raw fluorescence across supported Excel containers."
  };
}

function writeWarningFixture() {
  const worksheet = XLSX.utils.aoa_to_sheet([
    ["Synthetic Sample A", "Merged Synthetic Sample", ""],
    ["Assay Missing Sample", "", "Assay C"],
    [0.1, 0.2, 0.3],
    ["not-a-number", 0.4, 0.5],
    [0.6, 0.7, 0.8]
  ]);
  worksheet.C4 = { t: "n", v: 0.5, f: "0.2+0.3" };
  worksheet.C5 = { t: "n", f: "SUM(C3:C4)" };
  worksheet["!merges"] = [XLSX.utils.decode_range("B1:C1")];
  const file = "source/FX-004-warning-cells.xlsx";
  writeWorkbook(workbookWithSheet(worksheet), file, "xlsx");
  writeJson(join(expectedRoot, "FX-004-warning-cells.json"), {
    schemaVersion: 1,
    fixtureId: "FX-004",
    result: "ok",
    cycleCount: 3,
    curves: [
      { curveId: "sheet0_col_A", y: [0.1, null, 0.6], warningCodes: ["NON_NUMERIC_FLUORESCENCE"] },
      { curveId: "sheet0_col_B", y: [0.2, 0.4, 0.7], warningCodes: ["MISSING_REAGENT_LABEL"] },
      {
        curveId: "sheet0_col_C",
        y: [0.3, 0.5, null],
        warningCodes: ["FORMULA_CACHED_VALUE_USED", "FORMULA_WITHOUT_CACHED_VALUE"]
      }
    ],
    requiredWarningEvidence: [
      { code: "INHERITED_SPECIMEN_LABEL", curveId: "sheet0_col_C", handling: "kept" },
      { code: "MISSING_REAGENT_LABEL", sourceCell: "B2", curveId: "sheet0_col_B", handling: "kept" },
      {
        code: "NON_NUMERIC_FLUORESCENCE",
        sourceCell: "A4",
        curveId: "sheet0_col_A",
        handling: "null-gap",
        rawValue: "not-a-number"
      },
      {
        code: "FORMULA_CACHED_VALUE_USED",
        sourceCell: "C4",
        curveId: "sheet0_col_C",
        handling: "kept",
        formulaCacheStatus: "used"
      },
      {
        code: "FORMULA_WITHOUT_CACHED_VALUE",
        sourceCell: "C5",
        curveId: "sheet0_col_C",
        handling: "null-gap",
        formulaCacheStatus: "missing"
      },
      { code: "MERGED_HEADER_CELL", sourceRange: "B1:C1", handling: "kept" }
    ],
    note: "Passing S4 warning provenance contract with handling, source identity, formula cache, and location evidence."
  });
  return {
    fixtureId: "FX-004",
    logicalCaseId: "warning-evidence",
    file,
    format: "OOXML .xlsx",
    extension: ".xlsx",
    sheetNames: ["Data"],
    expected: "expected/FX-004-warning-cells.json",
    status: "active",
    covers: ["AC-PCR-002", "AC-PCR-048"],
    purpose: "Stable warning codes and source locations without user data."
  };
}

function writeMultiSheetFixture() {
  const workbook = workbookWithSheet(
    XLSX.utils.aoa_to_sheet([["Synthetic Sample First"], ["Assay First"], [0.1], [1.1]]),
    "First"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([["Synthetic Sample Ignored"], ["Assay Ignored"], [99]]),
    "Ignored"
  );
  const file = "source/FX-005-multi-sheet.xlsx";
  writeWorkbook(workbook, file, "xlsx");
  writeJson(join(expectedRoot, "FX-005-multi-sheet.json"), {
    fixtureId: "FX-005",
    sheetName: "First",
    curveIds: ["sheet0_col_A"],
    reagentLabels: ["Assay First"],
    datasetWarningCodes: ["IGNORED_WORKSHEETS"]
  });
  return {
    fixtureId: "FX-005",
    logicalCaseId: "first-sheet-only",
    file,
    format: "OOXML .xlsx",
    extension: ".xlsx",
    sheetNames: ["First", "Ignored"],
    expected: "expected/FX-005-multi-sheet.json",
    status: "active",
    covers: ["AC-PCR-015"],
    purpose: "First worksheet only with an explicit ignored-sheet warning."
  };
}

function writeSharedPrefixFixture() {
  const file = "source/FX-006-shared-prefix-labels.xlsx";
  writeWorkbook(
    workbookWithSheet(
      XLSX.utils.aoa_to_sheet([
        ["Condition Alpha concentration 01", "Condition Alpha concentration 02"],
        ["Assay Shared Prefix Lot A", "Assay Shared Prefix Lot B"],
        [0.1, 0.1],
        [1.0, 1.2]
      ])
    ),
    file,
    "xlsx"
  );
  const expected = "expected/FX-006-shared-prefix-labels.target.json";
  writeJson(join(fixtureRoot, expected), {
    schemaVersion: 1,
    fixtureId: "FX-006",
    result: "ok",
    uniqueLabels: [
      "Assay Shared Prefix Lot A │ Condition Alpha concentration 01",
      "Assay Shared Prefix Lot B │ Condition Alpha concentration 02"
    ],
    deliberateFinalStringCollision: [
      { curveId: "curve-a", label: "Condition Shared Final Label", sourceAlias: "source-1" },
      { curveId: "curve-b", label: "Condition Shared Final Label", sourceAlias: "source-2" }
    ]
  });
  return {
    fixtureId: "FX-006",
    logicalCaseId: "legend-shared-prefix",
    file,
    format: "OOXML .xlsx",
    extension: ".xlsx",
    sheetNames: ["Data"],
    expected,
    status: "active",
    covers: ["AC-PCR-046", "C-P1-02"],
    purpose: "Legend identity where distinguishing information is in the suffix."
  };
}

function writeSmallYFixture() {
  const file = "source/FX-007-small-y.xlsx";
  writeWorkbook(
    workbookWithSheet(
      XLSX.utils.aoa_to_sheet([
        ["Synthetic Small Signal"],
        ["Assay Micro"],
        [0.00001],
        [0.00002],
        [-0.00001]
      ])
    ),
    file,
    "xlsx"
  );
  const expected = "expected/FX-007-small-y.target.json";
  writeJson(join(fixtureRoot, expected), {
    schemaVersion: 1,
    fixtureId: "FX-007",
    result: "ok",
    x: [1, 2, 3],
    y: [0.00001, 0.00002, -0.00001],
    activeScaleCases: [
      { mode: "fixed", min: "0.00001", max: "0.00001", expected: "invalid-block-plot-export" },
      { mode: "preset1", min: "", max: "", expected: "invalid-inactive-does-not-block" },
      { mode: "preset2", min: "-1e-5", max: "2e-5", expected: "valid" }
    ]
  });
  return {
    fixtureId: "FX-007",
    logicalCaseId: "small-y-scale",
    file,
    format: "OOXML .xlsx",
    extension: ".xlsx",
    sheetNames: ["Data"],
    expected,
    status: "active",
    covers: ["AC-PCR-045", "C-P1-01"],
    purpose: "Scale and Box zoom precision near zero."
  };
}

function workbookWithSheet(worksheet, sheetName = "Data") {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  return workbook;
}

function writeWorkbook(workbook, relativePath, bookType) {
  const outputPath = join(fixtureRoot, relativePath);
  mkdirSync(dirname(outputPath), { recursive: true });
  const bytes = XLSX.write(workbook, { type: "buffer", bookType, compression: true });
  writeFileSync(outputPath, bytes);
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function headerTarget(sourceCell, displayText, rawType, rawValue, numberFormat, formula = null) {
  return { sourceCell, displayText, rawType, rawValue, numberFormat, formula };
}

function equivalentExpected(fixtureId, fileName) {
  const curves = [
    expectedCurve({
      fileName,
      columnIndex: 0,
      specimenLabel: "Synthetic 검체 A / α",
      reagentLabel: "Assay 1",
      y: [0.1, 1.2, 2.4]
    }),
    expectedCurve({
      fileName,
      columnIndex: 1,
      specimenLabel: "Synthetic Sample B ｜ β",
      reagentLabel: "시약 2",
      y: [-0.1, 1.4, 3.5]
    })
  ];
  return {
    schemaVersion: 1,
    fixtureId,
    result: "ok",
    source: {
      fileName,
      sheetNames: ["Data"],
      usedSheetIndex: 0,
      usedSheetName: "Data",
      ignoredSheetNames: []
    },
    dataset: {
      schemaVersion: 2,
      sourceKind: "excel",
      sheetIndex: 0,
      cycleCount: 3,
      orderedCurveIds: curves.map((curve) => curve.curveId),
      curves,
      specimens: curves.map((curve) => ({
        id: curve.specimenId,
        label: curve.specimenLabel,
        curveIds: [curve.curveId],
        warningCodes: []
      })),
      reagents: curves.map((curve) => ({
        id: curve.reagentId,
        label: curve.reagentLabel,
        curveIds: [curve.curveId],
        warningCodes: []
      })),
      warnings: []
    }
  };
}

function expectedCurve({ fileName, columnIndex, specimenLabel, reagentLabel, y }) {
  const columnLetter = String.fromCharCode(65 + columnIndex);
  const curveId = `sheet0_col_${columnLetter}`;
  return {
    curveId,
    sourceId: `${fileName}#Data!${columnLetter}`,
    specimenId: entityId("specimen", specimenLabel),
    reagentId: entityId("reagent", reagentLabel),
    specimenLabel,
    reagentLabel,
    displayLabel: `${specimenLabel} │ ${reagentLabel}`,
    x: [1, 2, 3],
    y,
    stats: {
      pointCount: 3,
      missingCount: 0,
      minY: Math.min(...y),
      maxY: Math.max(...y)
    },
    source: {
      sourceKind: "excel",
      fileName,
      sheetName: "Data",
      sheetIndex: 0,
      columnIndex,
      columnLetter,
      specimenCell: `${columnLetter}1`,
      reagentCell: `${columnLetter}2`,
      dataStartCell: `${columnLetter}3`,
      dataEndCell: `${columnLetter}5`
    },
    warnings: []
  };
}

function entityId(kind, label) {
  return `${kind}:${Array.from(label).map((character) => character.codePointAt(0).toString(16)).join("_")}`;
}
