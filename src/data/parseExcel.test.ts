import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseExcelWorkbook, parseWorkbook } from "./parseExcel";

describe("parseExcelWorkbook", () => {
  it("parses the first worksheet PCR structure into normalized curves", async () => {
    const buffer = createWorkbookBuffer(
      [
        ["검체 1", "", "검체2", ""],
        ["A1", "A2", "A1", "A2"],
        [0.2, 0.25, -0.1, 0.21],
        [1.2, 1.4, 0.8, 0.9],
        [2.4, 2.6, 1.7, 1.9]
      ],
      "xlsx"
    );

    const result = await parseExcelWorkbook(buffer, "graph_TEST_like.xlsx");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dataset.sheetName).toBe("Sheet1");
    expect(result.dataset.curves).toHaveLength(4);
    expect(result.dataset.curves[0].curveId).toBe("sheet0_col_A");
    expect(result.dataset.curves[0].x).toEqual([1, 2, 3]);
    expect(result.dataset.curves[2].y[0]).toBe(-0.1);
    expect(result.dataset.curves.map((curve) => curve.specimenLabel)).toEqual(["검체 1", "검체 1", "검체2", "검체2"]);
    expect(result.dataset.warnings.filter((warning) => warning.code === "INHERITED_SPECIMEN_LABEL")).toHaveLength(2);
    expect(result.dataset.warnings.some((warning) => warning.code === "SIMILAR_SPECIMEN_LABEL")).toBe(false);
    expect(result.dataset.warnings.some((warning) => warning.code === "NON_NUMERIC_FLUORESCENCE")).toBe(false);
  });

  it("parses a BIFF .xls workbook with the same normalized shape", async () => {
    const buffer = createWorkbookBuffer(
      [
        ["검체 1", ""],
        ["A1", "A2"],
        [0.2, 0.25],
        [1.2, 1.4]
      ],
      "biff8"
    );

    const result = await parseExcelWorkbook(buffer, "old_format.xls");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dataset.curves.map((curve) => curve.curveId)).toEqual(["sheet0_col_A", "sheet0_col_B"]);
    expect(result.dataset.curves[0].specimenLabel).toBe("검체 1");
    expect(result.dataset.curves[1].specimenLabel).toBe("검체 1");
    expect(result.dataset.warnings.map((warning) => warning.code)).toContain("INHERITED_SPECIMEN_LABEL");
  });

  it("interprets a horizontal merged specimen span using the same inheritance rule", () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["Specimen 1", ""],
      ["R1", "R2"],
      [0.1, 0.2]
    ]);
    worksheet["!merges"] = [XLSX.utils.decode_range("A1:B1")];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

    const result = parseWorkbook(workbook, "merged-specimen.xlsx", XLSX);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dataset.curves.map((curve) => curve.specimenLabel)).toEqual(["Specimen 1", "Specimen 1"]);
    expect(result.dataset.warnings.find((warning) => warning.code === "MERGED_HEADER_CELL")).toMatchObject({
      severity: "info",
      sourceRange: "A1:B1"
    });
    expect(result.dataset.warnings.map((warning) => warning.code)).toContain("INHERITED_SPECIMEN_LABEL");
  });

  it("does not inherit a horizontally merged reagent header", () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["Specimen 1", ""],
      ["R1", ""],
      [0.1, 0.2]
    ]);
    worksheet["!merges"] = [XLSX.utils.decode_range("A2:B2")];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

    const result = parseWorkbook(workbook, "merged-reagent.xlsx", XLSX);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dataset.curves[1]).toMatchObject({ specimenLabel: "Specimen 1", reagentLabel: "" });
    expect(result.dataset.curves[1].warnings.map((warning) => warning.code)).toContain("MISSING_REAGENT_LABEL");
    expect(result.dataset.warnings.find((warning) => warning.code === "MERGED_HEADER_CELL")).toMatchObject({
      severity: "warning",
      sourceRange: "A2:B2"
    });
  });

  it("does not report specimen merge inheritance when the merged continuation has no active curve", () => {
    const worksheet = XLSX.utils.aoa_to_sheet([["Specimen 1"], ["R1"], [0.1]]);
    worksheet["!merges"] = [XLSX.utils.decode_range("A1:B1")];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

    const result = parseWorkbook(workbook, "inactive-merged-specimen.xlsx", XLSX);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dataset.curves).toHaveLength(1);
    expect(result.dataset.warnings.find((warning) => warning.code === "MERGED_HEADER_CELL")).toMatchObject({
      severity: "warning",
      message: "Merged header cells were detected; reagent and cross-row headers are not auto-filled."
    });
  });

  it("uses worksheet index 0 only and warns about ignored later worksheets", async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["검체 1"], ["A1"], [0.1]]), "First");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["검체 9"], ["A9"], [9]]), "Later");

    const result = await parseExcelWorkbook(writeWorkbook(workbook, "xlsx"), "multi.xlsx");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dataset.sheetName).toBe("First");
    expect(result.dataset.curves[0].reagentLabel).toBe("A1");
    expect(result.dataset.warnings.some((warning) => warning.code === "IGNORED_WORKSHEETS")).toBe(true);
  });

  it("fails when worksheet index 0 is invalid even if a later sheet is valid", async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["not enough rows"]]), "InvalidFirst");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["검체 1"], ["A1"], [0.1]]), "ValidLater");

    const result = await parseExcelWorkbook(writeWorkbook(workbook, "xlsx"), "poison-first.xlsx");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("FIRST_SHEET_INVALID");
    expect(result.warnings.some((warning) => warning.code === "IGNORED_WORKSHEETS")).toBe(true);
  });

  it("keeps internal blank cells as null warnings but ignores trailing blank rows", () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["검체 1"],
      ["A1"],
      [0.2],
      [""],
      [1.2],
      [""]
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

    const result = parseWorkbook(workbook, "blank-cells.xlsx", XLSX);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dataset.curves[0].x).toEqual([1, 2, 3]);
    expect(result.dataset.curves[0].y).toEqual([0.2, null, 1.2]);
    expect(result.dataset.curves[0].warnings.some((warning) => warning.code === "EMPTY_FLUORESCENCE_CELL")).toBe(true);
  });

  it("warns for nonnumeric values and formulas without cached numeric values", () => {
    const worksheet: XLSX.WorkSheet = {
      A1: { t: "s", v: "검체 1" },
      A2: { t: "s", v: "A1" },
      A3: { t: "n", v: 0.2 },
      A4: { t: "s", v: "text" },
      A5: { t: "n", f: "SUM(A3:A4)" },
      B1: { t: "s", v: "검체 1" },
      B2: { t: "s", v: "A2" },
      B3: { t: "n", f: "1+1", v: 2 },
      B4: { t: "n", v: 3 },
      B5: { t: "n", v: 4 },
      "!ref": "A1:B5"
    };
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

    const result = parseWorkbook(workbook, "cell-warnings.xlsx", XLSX);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dataset.curves[0].y).toEqual([0.2, null, null]);
    expect(result.dataset.curves[1].y).toEqual([2, 3, 4]);
    expect(result.dataset.curves[1].warnings[0]).toMatchObject({
      code: "FORMULA_CACHED_VALUE_USED",
      handling: "kept",
      sourceCell: "B3"
    });
    expect(result.dataset.curves[0].warnings.map((warning) => warning.code)).toEqual([
      "NON_NUMERIC_FLUORESCENCE",
      "FORMULA_WITHOUT_CACHED_VALUE"
    ]);
    expect(result.dataset.curves[0].warnings[0].sourceRefs?.[0]).toMatchObject({
      sourceInstanceId: expect.any(String),
      sourceName: "cell-warnings.xlsx",
      sourceKind: "excel",
      worksheet: "Sheet1",
      cell: "A4",
      rawValue: "text",
      displayValue: "text",
      cellType: "s",
      formulaCacheStatus: "not-formula"
    });
  });

  it("preserves Excel-formatted header identity and raw provenance without trusting stale cell.w", () => {
    const worksheet: XLSX.WorkSheet = {
      A1: { t: "n", v: 1, z: "000", w: "STALE" },
      A2: { t: "n", v: 46037, z: "yyyy-mm-dd" },
      A3: { t: "n", v: 10 },
      B1: { t: "n", v: 123000, z: "0.00E+00" },
      B2: { t: "s", v: "  Assay / α  " },
      B3: { t: "n", v: 20 },
      "!ref": "A1:B3"
    };
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Formatted");

    const result = parseWorkbook(workbook, "formatted.xlsx", XLSX);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dataset.curves.map((curve) => [curve.specimenLabel, curve.reagentLabel])).toEqual([
      ["001", "2026-01-15"],
      ["1.23E+05", "  Assay / α  "]
    ]);
    expect(result.dataset.curves[0].source.specimenHeader).toMatchObject({
      rawValue: 1,
      displayValue: "001",
      cellType: "n",
      numberFormat: "000",
      formulaCacheStatus: "not-formula"
    });
    expect(result.dataset.curves[0].source.reagentHeader?.rawValue).toBe(46037);
    expect(result.dataset.curves[0].y).toEqual([10]);
  });

  it("falls back to raw identity rather than stale cell.w when formatting throws", () => {
    const worksheet: XLSX.WorkSheet = {
      A1: { t: "n", v: 1, z: "000", w: "STALE" },
      A2: { t: "s", v: "R1" },
      A3: { t: "n", v: 10 },
      "!ref": "A1:A3"
    };
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Formatted");
    const throwingXlsx = {
      ...XLSX,
      utils: { ...XLSX.utils, format_cell: () => { throw new Error("format failed"); } }
    } as typeof XLSX;

    const result = parseWorkbook(workbook, "formatted.xlsx", throwingXlsx);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dataset.curves[0].specimenLabel).toBe("1");
    expect(result.dataset.curves[0].source.specimenHeader?.displayValue).toBe("1");
  });

  it("preserves formatted header identity in a BIFF .xls workbook", async () => {
    const worksheet: XLSX.WorkSheet = {
      A1: { t: "n", v: 1, z: "000" },
      A2: { t: "n", v: 123000, z: "0.00E+00" },
      A3: { t: "n", v: 10 },
      "!ref": "A1:A3"
    };
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Formatted");

    const result = await parseExcelWorkbook(writeWorkbook(workbook, "biff8"), "formatted.xls");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dataset.curves[0]).toMatchObject({ specimenLabel: "001", reagentLabel: "1.23E+05" });
    expect(result.dataset.curves[0].source.specimenHeader).toMatchObject({
      rawValue: 1,
      displayValue: "001",
      numberFormat: "000"
    });
  });

  it("warns when different raw headers collapse to the same displayed identity", () => {
    const worksheet: XLSX.WorkSheet = {
      A1: { t: "n", v: 1, z: "000" },
      A2: { t: "s", v: "R1" },
      A3: { t: "n", v: 10 },
      B1: { t: "s", v: "001" },
      B2: { t: "s", v: "R1" },
      B3: { t: "n", v: 20 },
      "!ref": "A1:B3"
    };
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

    const result = parseWorkbook(workbook, "collision.xlsx", XLSX);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const warning = result.dataset.warnings.find((candidate) => candidate.code === "FORMATTED_HEADER_IDENTITY_COLLISION");
    expect(warning?.curveIds).toEqual(["sheet0_col_A", "sheet0_col_B"]);
    expect(warning?.handling).toBe("kept");
    expect(warning?.sourceRefs).toHaveLength(2);
    expect(new Set(warning?.sourceRefs?.map((sourceRef) => sourceRef.sourceInstanceId)).size).toBe(1);
  });

  it("records cached formula provenance without recalculating or changing its numeric value", () => {
    const worksheet: XLSX.WorkSheet = {
      A1: { t: "s", v: "Displayed specimen", f: "\"Displayed specimen\"" },
      A2: { t: "s", v: "R1" },
      A3: { t: "n", v: 42, f: "40+2", z: "0.0" },
      "!ref": "A1:A3"
    };
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Formula");

    const result = parseWorkbook(workbook, "formula.xlsx", XLSX);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dataset.curves[0].specimenLabel).toBe("Displayed specimen");
    expect(result.dataset.curves[0].y).toEqual([42]);
    expect(result.dataset.curves[0].source.specimenHeader).toMatchObject({
      formulaText: "\"Displayed specimen\"",
      formulaCacheStatus: "used"
    });
    const cachedWarnings = result.dataset.warnings.filter((warning) => warning.code === "FORMULA_CACHED_VALUE_USED");
    expect(cachedWarnings.map((warning) => warning.sourceCell)).toEqual(["A1", "A3"]);
    expect(cachedWarnings.every((warning) => warning.sourceRefs?.[0]?.sourceInstanceId)).toBe(true);
  });

  it("diagnoses extension and workbook signature mismatch without blocking import", async () => {
    const buffer = createWorkbookBuffer([["S1"], ["R1"], [1]], "xlsx");

    const result = await parseExcelWorkbook(buffer, "disguised.xls");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dataset.warnings.find((warning) => warning.code === "FILE_SIGNATURE_MISMATCH")).toMatchObject({
      severity: "warning",
      handling: "kept"
    });
  });

  it("blocks import when the first usable curve column has no specimen label", () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["", ""],
      ["", "R2"],
      ["", 0.25],
      ["", 1.4]
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

    const result = parseWorkbook(workbook, "missing-first-specimen.xlsx", XLSX);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatchObject({
      code: "MISSING_SPECIMEN_LABEL",
      severity: "error",
      handling: "blocked",
      sourceCell: "B1"
    });
    expect(result.error.sourceRefs?.[0]).toMatchObject({ sourceName: "missing-first-specimen.xlsx", cell: "B1" });
  });

  it("inherits blank specimen headers from the previous explicit specimen without changing raw values", () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["Specimen 1", "", "Specimen 2", "", ""],
      ["R1", "R2", "", "R4", ""],
      [0.2, 0.25, 0.3, 0.35, ""],
      [1.2, 1.4, 1.6, 1.8, ""]
    ]);
    worksheet["!ref"] = "A1:E4";
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

    const result = parseWorkbook(workbook, "inherited-specimens.xlsx", XLSX);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dataset.curves).toHaveLength(4);
    expect(result.dataset.curves.map((curve) => curve.specimenLabel)).toEqual([
      "Specimen 1",
      "Specimen 1",
      "Specimen 2",
      "Specimen 2"
    ]);
    expect(result.dataset.curves.map((curve) => curve.y)).toEqual([
      [0.2, 1.2],
      [0.25, 1.4],
      [0.3, 1.6],
      [0.35, 1.8]
    ]);
    expect(result.dataset.curves[1].source.specimenHeader).toMatchObject({ rawValue: "", displayValue: "" });
    expect(result.dataset.curves[2].warnings.map((warning) => warning.code)).toContain("MISSING_REAGENT_LABEL");
    expect(result.dataset.warnings.some((warning) => warning.code === "MISSING_SPECIMEN_LABEL")).toBe(false);
    const inherited = result.dataset.warnings.filter((warning) => warning.code === "INHERITED_SPECIMEN_LABEL");
    expect(inherited).toHaveLength(2);
    expect(inherited.map((warning) => warning.curveIds)).toEqual([["sheet0_col_B"], ["sheet0_col_D"]]);
    expect(inherited.flatMap((warning) => warning.sourceRefs?.map((source) => source.cell) ?? [])).toEqual([
      "A1",
      "B1",
      "C1",
      "D1"
    ]);
  });

  it("does not treat an empty-display specimen formula as intentional inheritance", () => {
    const worksheet: XLSX.WorkSheet = {
      A1: { t: "s", v: "Specimen 1" },
      A2: { t: "s", v: "R1" },
      A3: { t: "n", v: 1 },
      B1: { t: "s", f: '"Specimen 2"' },
      B2: { t: "s", v: "R2" },
      B3: { t: "n", v: 2 },
      "!ref": "A1:B3"
    };
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

    const result = parseWorkbook(workbook, "formula-header.xlsx", XLSX);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dataset.curves[1].specimenLabel).toBe("");
    expect(result.dataset.curves[1].warnings.map((warning) => warning.code)).toEqual([
      "FORMULA_WITHOUT_CACHED_VALUE",
      "FORMATTED_HEADER_EMPTY",
      "MISSING_SPECIMEN_LABEL"
    ]);
    expect(result.dataset.warnings.some((warning) => warning.code === "INHERITED_SPECIMEN_LABEL")).toBe(false);
  });

  it("does not inherit a nonblank raw specimen whose number format displays empty", () => {
    const worksheet: XLSX.WorkSheet = {
      A1: { t: "s", v: "Specimen 1" },
      A2: { t: "s", v: "R1" },
      A3: { t: "n", v: 1 },
      B1: { t: "n", v: 123, z: ";;;" },
      B2: { t: "s", v: "R2" },
      B3: { t: "n", v: 2 },
      "!ref": "A1:B3"
    };
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

    const result = parseWorkbook(workbook, "formatted-empty-header.xlsx", XLSX);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dataset.curves[1].specimenLabel).toBe("");
    expect(result.dataset.curves[1].source.specimenHeader).toMatchObject({ rawValue: 123, displayValue: "" });
    expect(result.dataset.curves[1].warnings.map((warning) => warning.code)).toContain("FORMATTED_HEADER_EMPTY");
    expect(result.dataset.warnings.some((warning) => warning.code === "INHERITED_SPECIMEN_LABEL")).toBe(false);
  });

  it("normalizes uneven curve lengths to a shared generated cycle range with null gaps", () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["Specimen 1", "Specimen 2"],
      ["R1", "R2"],
      [0.2, 0.25],
      [1.2, ""],
      [2.4, ""],
      [3.6, 3.8]
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

    const result = parseWorkbook(workbook, "uneven-length.xlsx", XLSX);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dataset.cycleCount).toBe(4);
    expect(result.dataset.curves[0].x).toEqual([1, 2, 3, 4]);
    expect(result.dataset.curves[1].x).toEqual([1, 2, 3, 4]);
    expect(result.dataset.curves[1].y).toEqual([0.25, null, null, 3.8]);
    expect(result.dataset.curves[1].warnings.map((warning) => warning.code)).toEqual([
      "EMPTY_FLUORESCENCE_CELL",
      "EMPTY_FLUORESCENCE_CELL"
    ]);
  });

  it("rejects unsupported file extensions before workbook parsing", async () => {
    const result = await parseExcelWorkbook(new Uint8Array(), "data.csv");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("UNSUPPORTED_FILE_TYPE");
  });
});

function createWorkbookBuffer(rows: unknown[][], bookType: "xlsx" | "biff8") {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Sheet1");
  return writeWorkbook(workbook, bookType);
}

function writeWorkbook(workbook: XLSX.WorkBook, bookType: "xlsx" | "biff8") {
  return XLSX.write(workbook, { type: "array", bookType }) as Uint8Array;
}
