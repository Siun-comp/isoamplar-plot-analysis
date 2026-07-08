import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import packageJson from "../../package.json";
import { createDefaultChartScale } from "../chart/chartScale";
import { createDefaultStyleRules } from "../chart/chartStyle";
import { createOneSpecimenEightReagentDataset } from "../data/sampleData";
import { createInitialSelectionState } from "../selection/selectionState";
import { createAnalysisState, serializeAnalysisState } from "./analysisState";
import {
  ANALYSIS_RESTORE_SHEET_NAME,
  createAnalysisWorkbookFileName,
  exportAnalysisWorkbookBuffer,
  readAnalysisWorkbook,
  readAnalysisWorkbookBuffer,
  sanitizeAnalysisFileNamePart
} from "./analysisWorkbook";

describe("Analysis XLSX workbook", () => {
  it("exports visible review sheets, hidden restore JSON, and roundtrips full unselected dataset", async () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const selection = createInitialSelectionState(dataset);
    selection.selectedCurveIds.add(dataset.curves[0].curveId);
    selection.collapsedGroupIds.add(dataset.reagents[0].id);
    selection.orderedCurveIds = [
      dataset.curves[1].curveId,
      dataset.curves[0].curveId,
      ...selection.orderedCurveIds.slice(2)
    ];
    const chartScale = createDefaultChartScale();
    chartScale.y.preset1 = { label: "P1 low", min: "0", max: "100" };
    const styleRules = createDefaultStyleRules();
    styleRules.colorBy = "specimen";
    styleRules.lineTypeBy = "reagent";
    styleRules.markerBy = "reagent";
    styleRules.specimenColors[dataset.curves[0].specimenId] = "#334455";
    styleRules.reagentLineTypes[dataset.curves[0].reagentId] = "dashed";
    styleRules.reagentMarkerTypes[dataset.curves[0].reagentId] = "triangle";
    const state = createAnalysisState({
      analysisId: "analysis-test",
      analysisName: "Run A",
      dataset,
      selection,
      searchQuery: "A1",
      selectionFilter: "selected",
      chartScale,
      styleRules,
      curveOverrides: {
        [dataset.curves[0].curveId]: {
          color: "#123456",
          lineType: "dotted",
          markerType: "none",
          source: "custom",
          fieldSources: { color: "custom", lineType: "custom", markerType: "custom" }
        }
      },
      legendSettings: { previewVisible: false },
      exportSettings: { imageLayout: "legendOnly" },
      exportCounter: 3,
      importFileName: dataset.sourceFileName,
      sourceFiles: [
        {
          fileName: dataset.sourceFileName,
          sheetName: dataset.sheetName,
          sheetIndex: dataset.sheetIndex,
          importedAtIso: dataset.importedAtIso,
          curveCount: dataset.curves.length
        }
      ],
      dirty: true
    });

    const buffer = await exportAnalysisWorkbookBuffer(state);
    const workbook = XLSX.read(buffer, { type: "array", raw: true });

    expect(workbook.SheetNames).toEqual([
      "README",
      "Settings",
      "ImportedData",
      "Warnings",
      ANALYSIS_RESTORE_SHEET_NAME
    ]);
    const hiddenSheetMeta = workbook.Workbook?.Sheets?.find((sheet) => sheet.name === ANALYSIS_RESTORE_SHEET_NAME);
    expect(hiddenSheetMeta?.Hidden).toBe(1);
    expect(workbook.Sheets.ImportedData.A1?.v).toBe("Cycle");
    expect(workbook.Sheets.ImportedData.B1?.v).toBe(dataset.curves[0].specimenLabel);
    expect(workbook.Sheets.ImportedData.B3?.v).toBe(dataset.curves[0].curveId);

    const restored = await readAnalysisWorkbookBuffer(buffer);
    expect(restored.kind).toBe("analysis");
    if (restored.kind !== "analysis") return;
    expect(restored.analysis.analysisName).toBe("Run A");
    expect(restored.analysis.dataset.curves).toHaveLength(dataset.curves.length);
    expect(restored.analysis.selection.selectedCurveIds.has(dataset.curves[0].curveId)).toBe(true);
    expect(restored.analysis.selection.selectedCurveIds.has(dataset.curves[1].curveId)).toBe(false);
    expect(restored.analysis.selection.collapsedGroupIds.has(dataset.reagents[0].id)).toBe(true);
    expect(restored.analysis.selection.orderedCurveIds.slice(0, 2)).toEqual([
      dataset.curves[1].curveId,
      dataset.curves[0].curveId
    ]);
    expect(restored.analysis.selectionFilter).toBe("selected");
    expect(restored.analysis.chartScale.y.preset1?.label).toBe("P1 low");
    expect(restored.analysis.styleRules).toMatchObject({
      colorBy: "specimen",
      lineTypeBy: "reagent",
      markerBy: "reagent",
      specimenColors: { [dataset.curves[0].specimenId]: "#334455" },
      reagentLineTypes: { [dataset.curves[0].reagentId]: "dashed" },
      reagentMarkerTypes: { [dataset.curves[0].reagentId]: "triangle" }
    });
    expect(restored.analysis.curveOverrides[dataset.curves[0].curveId]).toMatchObject({
      color: "#123456",
      lineType: "dotted",
      markerType: "none",
      source: "custom",
      fieldSources: { color: "custom", lineType: "custom", markerType: "custom" }
    });
    expect(restored.analysis.legendSettings.previewVisible).toBe(false);
    expect(restored.analysis.exportSettings.imageLayout).toBe("legendOnly");
    expect(restored.analysis.exportCounter).toBe(3);
    expect(restored.analysis.dirty).toBe(false);
    expect(restored.analysis.analysisId).not.toBe("analysis-test");
  });

  it("detects missing restore sheets and corrupt restore chunks", () => {
    const markerWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      markerWorkbook,
      XLSX.utils.aoa_to_sheet([["IsoAmplar Plot Analysis restore file"]]),
      "README"
    );

    const missing = readAnalysisWorkbook(markerWorkbook, XLSX);
    expect(missing.kind).toBe("invalid-analysis");
    if (missing.kind === "invalid-analysis") {
      expect(missing.message).toContain("restore sheet is missing");
    }

    const corruptWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      corruptWorkbook,
      XLSX.utils.aoa_to_sheet([
        ["IsoAmplarAnalysis"],
        ["schemaVersion", 1],
        ["chunkCount", 2],
        ["chunkIndex", "jsonChunk"],
        [0, "{\"schemaVersion\":1"]
      ]),
      ANALYSIS_RESTORE_SHEET_NAME
    );

    const corrupt = readAnalysisWorkbook(corruptWorkbook, XLSX);
    expect(corrupt.kind).toBe("invalid-analysis");
    if (corrupt.kind === "invalid-analysis") {
      expect(corrupt.message).toContain("chunks are incomplete");
    }

    const duplicateChunkWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      duplicateChunkWorkbook,
      XLSX.utils.aoa_to_sheet([
        ["IsoAmplarAnalysis"],
        ["schemaVersion", 1],
        ["chunkCount", 2],
        ["chunkIndex", "jsonChunk"],
        [0, "{}"],
        [0, "{}"]
      ]),
      ANALYSIS_RESTORE_SHEET_NAME
    );

    const duplicate = readAnalysisWorkbook(duplicateChunkWorkbook, XLSX);
    expect(duplicate.kind).toBe("invalid-analysis");
    if (duplicate.kind === "invalid-analysis") {
      expect(duplicate.message).toContain("duplicate");
    }
  });

  it("does not treat ordinary review-like sheet names as Analysis XLSX without the README marker", () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Specimen 1"], ["A1"], [0.1]]), "Settings");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Other"]]), "ImportedData");

    expect(readAnalysisWorkbook(workbook, XLSX)).toEqual({ kind: "not-analysis" });

    const restoreNameWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      restoreNameWorkbook,
      XLSX.utils.aoa_to_sheet([["Specimen 1"], ["A1"], [0.1]]),
      ANALYSIS_RESTORE_SHEET_NAME
    );
    expect(readAnalysisWorkbook(restoreNameWorkbook, XLSX)).toEqual({ kind: "not-analysis" });
  });

  it("detects unsupported restore schema versions and sanitizes names", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const state = createAnalysisState({
      analysisId: "analysis-test",
      analysisName: "Run A",
      dataset,
      selection: createInitialSelectionState(dataset),
      searchQuery: "",
      selectionFilter: "all",
      chartScale: createDefaultChartScale(),
      styleRules: createDefaultStyleRules(),
      curveOverrides: {},
      exportCounter: 1,
      importFileName: dataset.sourceFileName
    });
    const serialized = { ...serializeAnalysisState(state), schemaVersion: 999 };
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["IsoAmplarAnalysis"],
        ["schemaVersion", 999],
        ["chunkCount", 1],
        ["chunkIndex", "jsonChunk"],
        [0, JSON.stringify(serialized)]
      ]),
      ANALYSIS_RESTORE_SHEET_NAME
    );

    const result = readAnalysisWorkbook(workbook, XLSX);
    expect(result.kind).toBe("invalid-analysis");
    if (result.kind === "invalid-analysis") {
      expect(result.message).toBe("Unsupported Analysis XLSX schema version.");
    }
    expect(createAnalysisWorkbookFileName(2, new Date("2026-07-08T00:00:00"))).toBe("260708_analysis2.xlsx");
    expect(sanitizeAnalysisFileNamePart(" a/b:c* run ")).toBe("a_b_c_run");
  });

  it("keeps native editable Excel chart and report image workbook dependencies out of the app", () => {
    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };

    expect(dependencies).not.toHaveProperty("exceljs");
    expect(dependencies).not.toHaveProperty("xlsx-populate");
    expect(dependencies).not.toHaveProperty("xlsx-js-style");
    expect(dependencies).not.toHaveProperty("office-chart");
  });
});
