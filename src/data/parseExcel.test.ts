import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseExcelWorkbook, parseWorkbook } from "./parseExcel";

describe("parseExcelWorkbook", () => {
  it("parses the first worksheet PCR structure into normalized curves", async () => {
    const buffer = createWorkbookBuffer(
      [
        ["검체 1", "검체 1", "검체2", "검체 2"],
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
    expect(result.dataset.warnings.some((warning) => warning.code === "SIMILAR_SPECIMEN_LABEL")).toBe(true);
    expect(result.dataset.warnings.some((warning) => warning.code === "NON_NUMERIC_FLUORESCENCE")).toBe(false);
  });

  it("parses a BIFF .xls workbook with the same normalized shape", async () => {
    const buffer = createWorkbookBuffer(
      [
        ["검체 1", "검체 1"],
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
    expect(result.dataset.curves[0].warnings.map((warning) => warning.code)).toEqual([
      "NON_NUMERIC_FLUORESCENCE",
      "FORMULA_WITHOUT_CACHED_VALUE"
    ]);
  });

  it("imports columns with missing specimen or reagent headers and reports header warnings", () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["", "Specimen 2", "", "Specimen 4"],
      ["R1", "", "", "R4"],
      [0.2, 0.25, 0.3, ""],
      [1.2, 1.4, 1.6, ""]
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

    const result = parseWorkbook(workbook, "missing-headers.xlsx", XLSX);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dataset.curves).toHaveLength(4);
    expect(result.dataset.curves[0]).toMatchObject({
      specimenLabel: "",
      reagentLabel: "R1",
      displayLabel: "Empty specimen A1 │ R1"
    });
    expect(result.dataset.curves[1]).toMatchObject({
      specimenLabel: "Specimen 2",
      reagentLabel: "",
      displayLabel: "Specimen 2 │ Empty reagent B2"
    });
    expect(result.dataset.curves[2]).toMatchObject({
      specimenLabel: "",
      reagentLabel: "",
      displayLabel: "Empty specimen C1 │ Empty reagent C2"
    });
    expect(result.dataset.curves[3].warnings.map((warning) => warning.code)).not.toContain("MISSING_SPECIMEN_LABEL");
    expect(result.dataset.curves[3].warnings.map((warning) => warning.code)).not.toContain("MISSING_REAGENT_LABEL");
    expect(result.dataset.curves[0].warnings.map((warning) => warning.code)).toContain("MISSING_SPECIMEN_LABEL");
    expect(result.dataset.curves[1].warnings.map((warning) => warning.code)).toContain("MISSING_REAGENT_LABEL");
    expect(result.dataset.curves[2].warnings.map((warning) => warning.code)).toEqual([
      "MISSING_SPECIMEN_LABEL",
      "MISSING_REAGENT_LABEL"
    ]);
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
