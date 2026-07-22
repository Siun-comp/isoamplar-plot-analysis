import { describe, expect, it } from "vitest";
import { isLargePastedDataset, parsePastedTable, renamePastedDatasetSource } from "./parsePastedTable";

describe("parsePastedTable", () => {
  it("parses a full tab-separated table without transforming fluorescence values", () => {
    const result = parsePastedTable(
      ["Specimen 1\tSpecimen 1\tSpecimen 2", "A1\tA2\tA1", "-0.2\t1.5\t2e2", "1.25\t2.5\t300"].join("\n"),
      { mode: "fullTable", sourceName: "Paste import 1", importedAtIso: "2026-07-11T00:00:00.000Z" }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.delimiter).toBe("tab");
    expect(result.dataset.sourceKind).toBe("paste");
    expect(result.dataset.curves.map((curve) => curve.curveId)).toEqual([
      "paste0_col_A",
      "paste0_col_B",
      "paste0_col_C"
    ]);
    expect(result.dataset.curves[0].y).toEqual([-0.2, 1.25]);
    expect(result.dataset.curves[2].y).toEqual([200, 300]);
    expect(result.summary).toMatchObject({
      rowCount: 4,
      columnCount: 3,
      cellCount: 12,
      curveCount: 3,
      cycleCount: 2,
      sourceCharacterCount: expect.any(Number),
      estimatedWorkingMemoryBytes: expect.any(Number)
    });
    expect(result.dataset.curves[0].source).toMatchObject({
      sourceKind: "paste",
      fileName: "Paste import 1",
      sheetName: "Paste",
      specimenCell: "A1",
      reagentCell: "A2",
      dataStartCell: "A3"
    });
  });

  it("constructs a single-specimen source before import", () => {
    const result = parsePastedTable(["A1\tA2", "0.1\t0.2", "1.1\t1.2"].join("\n"), {
      mode: "singleSpecimen",
      sourceName: "Comparison",
      specimenLabel: "Specimen X"
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dataset.curves.map((curve) => curve.specimenLabel)).toEqual(["Specimen X", "Specimen X"]);
    expect(result.dataset.curves.map((curve) => curve.reagentLabel)).toEqual(["A1", "A2"]);
    expect(result.dataset.curves[0].x).toEqual([1, 2]);
    expect(result.dataset.curves[0].source).toMatchObject({
      inputMode: "singleSpecimen",
      specimenCell: "Specimen name field",
      reagentCell: "A1",
      dataStartCell: "A2",
      dataEndCell: "A3"
    });
  });

  it("supports an unambiguous single copied column without splitting spaces", () => {
    const result = parsePastedTable("Specimen with spaces\nAssay A\n0.1\n0.2", {
      mode: "fullTable",
      sourceName: "One curve"
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.delimiter).toBe("singleColumn");
    expect(result.dataset.curves).toHaveLength(1);
    expect(result.dataset.curves[0]).toMatchObject({ specimenLabel: "Specimen with spaces", reagentLabel: "Assay A" });
  });

  it("rejects comma-separated tables before they can be misinterpreted", () => {
    const result = parsePastedTable("S1,S2\nA1,A2\n0.1,0.2", {
      mode: "fullTable",
      sourceName: "Simple comma"
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_PASTED_TABLE");
    expect(result.error.message).toContain("Comma 구분 표");
  });

  it.each([
    "S1,S2\nA1\n0.1,0.2",
    "Sample, condition\nA1\n0.1",
    "Sample\nA1\n1,234"
  ])("rejects any comma-bearing paste instead of guessing a single-column layout", (text) => {
    const result = parsePastedTable(text, { mode: "fullTable", sourceName: "Comma safety" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("Comma 구분 표");
  });

  it("rejects a blank single-specimen label", () => {
    const result = parsePastedTable("A1\n0.1", {
      mode: "singleSpecimen",
      sourceName: "Comparison",
      specimenLabel: "   "
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("검체명");
  });

  it("represents uneven tab rows as null warnings and ignores trailing blank rows", () => {
    const result = parsePastedTable("Specimen 1\t\nA1\t\n0.1\ttext\n\t0.3\n1.1\n\n", {
      mode: "fullTable",
      sourceName: "Warnings"
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dataset.cycleCount).toBe(3);
    expect(result.dataset.curves[0].y).toEqual([0.1, null, 1.1]);
    expect(result.dataset.curves[1].y).toEqual([null, 0.3, null]);
    expect(result.dataset.curves[1].specimenLabel).toBe("Specimen 1");
    expect(result.dataset.warnings.map((warning) => warning.code)).toContain("INHERITED_SPECIMEN_LABEL");
    expect(result.dataset.curves[1].warnings.map((warning) => warning.code)).toContain("MISSING_REAGENT_LABEL");
    expect(result.dataset.curves[1].warnings.map((warning) => warning.code)).toContain("NON_NUMERIC_FLUORESCENCE");
    expect(result.dataset.curves[0].warnings.map((warning) => warning.code)).toContain("EMPTY_FLUORESCENCE_CELL");
  });

  it("rejects a whitespace-only specimen in the first usable curve column", () => {
    const result = parsePastedTable("   \t   \nA1\tA2\n0.1\t0.2", {
      mode: "fullTable",
      sourceName: "Whitespace headers"
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_PASTED_TABLE");
    expect(result.error.message).toContain("A1");
  });

  it("inherits blank full-table specimen headers and retains their source cells", () => {
    const result = parsePastedTable("S1\t\tS2\t\nA1\tA2\tA1\tA2\n0.1\t0.2\t0.3\t0.4", {
      mode: "fullTable",
      sourceName: "Inherited specimens",
      sourceInstanceId: "paste-inherited"
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dataset.curves.map((curve) => curve.specimenLabel)).toEqual(["S1", "S1", "S2", "S2"]);
    expect(result.dataset.curves.map((curve) => curve.y)).toEqual([[0.1], [0.2], [0.3], [0.4]]);
    expect(result.dataset.warnings.some((warning) => warning.code === "MISSING_SPECIMEN_LABEL")).toBe(false);
    const inherited = result.dataset.warnings.filter((warning) => warning.code === "INHERITED_SPECIMEN_LABEL");
    expect(inherited).toHaveLength(2);
    expect(inherited.map((warning) => warning.curveIds)).toEqual([["paste0_col_B"], ["paste0_col_D"]]);
    expect(inherited.flatMap((warning) => warning.sourceRefs?.map((source) => source.cell) ?? [])).toEqual([
      "A1",
      "B1",
      "C1",
      "D1"
    ]);
  });

  it("requires a specimen in the first usable curve column after empty spacer columns", () => {
    const result = parsePastedTable("\t\n\tR2\n\t0.1", {
      mode: "fullTable",
      sourceName: "Missing first active specimen"
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("B1");
  });

  it("creates duplicate and similar-label warnings through the normalized dataset pipeline", () => {
    const result = parsePastedTable("Sample1\tSample 1\tSample1\nA1\tA1\tA1\n0.1\t0.2\t0.3", {
      mode: "fullTable",
      sourceName: "Warnings"
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dataset.warnings.map((warning) => warning.code)).toContain("DUPLICATE_CURVE_LABEL");
    expect(result.dataset.warnings.map((warning) => warning.code)).toContain("SIMILAR_SPECIMEN_LABEL");
  });

  it.each(["", "Specimen\nA1", "\n\n\n"])("rejects input with no usable fluorescence data", (text) => {
    const result = parsePastedTable(text, { mode: "fullTable", sourceName: "Invalid" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_PASTED_TABLE");
    expect(result.errorKind).toBe("validation");
  });

  it("converts unexpected parser exceptions into a typed failure", () => {
    const options = {
      mode: "fullTable" as const,
      get sourceName(): string {
        throw new Error("synthetic parser failure");
      }
    };

    const result = parsePastedTable("S1\nA1\n0.1", options);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errorKind).toBe("unexpected");
    expect(result.error.message).toContain("현재 분석은 변경되지 않았습니다");
  });

  it("keeps source names and specimen labels out of curve identity", () => {
    const first = parsePastedTable("A1\n0.1", {
      mode: "singleSpecimen",
      sourceName: "First source",
      specimenLabel: "Specimen 1"
    });
    const second = parsePastedTable("A1\n0.1", {
      mode: "singleSpecimen",
      sourceName: "Renamed source",
      specimenLabel: "Specimen 2"
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.dataset.curves[0].curveId).toBe(second.dataset.curves[0].curveId);
    expect(first.dataset.curves[0].source.fileName).not.toBe(second.dataset.curves[0].source.fileName);
  });

  it("renames paste trace metadata without changing curve identity or values", () => {
    const parsed = parsePastedTable("S1\nA1\nbad", { mode: "fullTable", sourceName: "Before" });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const renamed = renamePastedDatasetSource(parsed.dataset, "After");
    expect(renamed.sourceFileName).toBe("After");
    expect(renamed.curves[0].curveId).toBe(parsed.dataset.curves[0].curveId);
    expect(renamed.curves[0].y).toEqual(parsed.dataset.curves[0].y);
    expect(renamed.curves[0].source.fileName).toBe("After");
    expect(parsed.dataset.sourceFileName).toBe("Before");
    expect(renamed.curves[0].sourceId).toBe(parsed.dataset.curves[0].sourceId);
    expect(renamed.warnings[0].sourceRefs?.[0]?.sourceName).toBe("After");
    expect(renamed.curves[0].warnings[0].sourceRefs?.[0]?.sourceName).toBe("After");
  });

  it("keeps physical column positions when an internal column is empty", () => {
    const parsed = parsePastedTable("S1\t\t\nA1\t\tA3\n0.1\t\t0.3", {
      mode: "fullTable",
      sourceName: "Geometry",
      sourceInstanceId: "paste-fixed"
    });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.dataset.curves.map((curve) => curve.curveId)).toEqual(["paste0_col_A", "paste0_col_C"]);
    expect(parsed.dataset.curves.map((curve) => curve.sourceId)).toEqual(["paste-fixed!A", "paste-fixed!C"]);
    expect(parsed.dataset.curves.map((curve) => curve.specimenLabel)).toEqual(["S1", "S1"]);
    expect(parsed.dataset.warnings.find((warning) => warning.code === "INHERITED_SPECIMEN_LABEL")?.sourceRefs?.map((source) => source.cell)).toEqual([
      "A1",
      "C1"
    ]);
  });

  it("classifies large paste previews without blocking their dataset", () => {
    const columns = Array.from({ length: 101 }, (_, index) => `S${index + 1}`);
    const reagents = columns.map((_, index) => `A${index + 1}`);
    const dataRows = Array.from({ length: 100 }, () => columns.map(() => "1").join("\t"));
    const parsed = parsePastedTable([columns.join("\t"), reagents.join("\t"), ...dataRows].join("\n"), {
      mode: "fullTable",
      sourceName: "Large comparison"
    });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(isLargePastedDataset(parsed.dataset)).toBe(true);
  });
});
