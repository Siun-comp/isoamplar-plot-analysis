import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import packageJson from "../../package.json";
import { createDefaultChartScale, getAppliedAxisScaleForDraft } from "../chart/chartScale";
import { createDefaultStyleRules } from "../chart/chartStyle";
import { createOneSpecimenEightReagentDataset } from "../data/sampleData";
import { appendPcrDataset } from "../data/mergeDatasets";
import { parsePastedTable } from "../data/parsePastedTable";
import { createInitialSelectionState } from "../selection/selectionState";
import { createAnalysisState, createSourceFileSummary, serializeAnalysisState } from "./analysisState";
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
    chartScale.x.mode = "fixed";
    chartScale.x.fixedMin = "18.5";
    chartScale.x.fixedMax = "42";
    chartScale.y.mode = "fixed";
    chartScale.y.fixedMin = "120000";
    chartScale.y.fixedMax = "900000";
    chartScale.y.preset1 = { label: "P1 low", min: "0", max: "100" };
    chartScale.x.applied = getAppliedAxisScaleForDraft(chartScale.x)!;
    chartScale.y.applied = getAppliedAxisScaleForDraft(chartScale.y)!;
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
      legendSettings: {
        previewVisible: false,
        reportLabelMode: "full",
        reportNameOverrides: { [dataset.curves[0].curveId]: "Report A1" }
      },
      exportSettings: { imageLayout: "legendOnly" },
      exportCounter: 3,
      importFileName: dataset.sourceFileName,
      sourceFiles: [createSourceFileSummary(dataset)],
      dirty: true
    });

    const buffer = await exportAnalysisWorkbookBuffer(state);
    const workbook = XLSX.read(buffer, { type: "array", raw: true });

    expect(workbook.SheetNames).toEqual([
      "README",
      "Settings",
      "HeaderProvenance",
      "ImportedData",
      "Warnings",
      ANALYSIS_RESTORE_SHEET_NAME
    ]);
    const hiddenSheetMeta = workbook.Workbook?.Sheets?.find((sheet) => sheet.name === ANALYSIS_RESTORE_SHEET_NAME);
    expect(hiddenSheetMeta?.Hidden).toBe(1);
    expect(workbook.Sheets.ImportedData.A1?.v).toBe("Cycle");
    expect(workbook.Sheets.ImportedData.B1?.v).toBe(dataset.curves[0].specimenLabel);
    expect(workbook.Sheets.ImportedData.A3?.v).toBe("Analysis label");
    expect(workbook.Sheets.ImportedData.B3?.v).toBe("Report A1");
    expect(workbook.Sheets.ImportedData.B4?.v).toBe(dataset.curves[0].curveId);
    const headerRows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets.HeaderProvenance, { header: 1, blankrows: false });
    expect(headerRows[0]).toContain("Display value");
    expect(headerRows[0]).toContain("Raw value");
    expect(headerRows[0]).toContain("Formula cache");
    expect(headerRows.some((row) => row[0] === dataset.curves[0].curveId && row[5] === "Specimen")).toBe(true);
    const warningRows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets.Warnings, { header: 1, blankrows: false });
    expect(warningRows[0]).toContain("Handling");
    expect(warningRows[0]).toContain("Source ID");
    expect(warningRows[0]).toContain("Display value");
    const settingsRows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets.Settings, { header: 1, blankrows: false });
    expect(settingsRows).toContainEqual(["X scale draft mode", "fixed"]);
    expect(settingsRows).toContainEqual(["X fixed min", "18.5"]);
    expect(settingsRows).toContainEqual(["Y fixed max", "900000"]);
    expect(settingsRows).toContainEqual(["X applied mode", "fixed"]);
    expect(settingsRows).toContainEqual(["X applied min", 18.5]);
    expect(settingsRows).toContainEqual([
      "Source type",
      "Source ID",
      "Source name",
      "Sheet",
      "Sheet index",
      "Imported at",
      "Curve count"
    ]);

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
    expect(restored.analysis.chartScale.x).toMatchObject({ mode: "fixed", fixedMin: "18.5", fixedMax: "42" });
    expect(restored.analysis.chartScale.y).toMatchObject({ mode: "fixed", fixedMin: "120000", fixedMax: "900000" });
    expect(restored.analysis.chartScale.x.applied).toEqual({ mode: "fixed", min: 18.5, max: 42 });
    expect(restored.analysis.chartScale.y.applied).toEqual({ mode: "fixed", min: 120000, max: 900000 });
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
      displayName: "Report A1",
      lineType: "dotted",
      markerType: "none",
      source: "custom",
      fieldSources: { color: "custom", displayName: "custom", lineType: "custom", markerType: "custom" }
    });
    expect(restored.analysis.legendSettings.previewVisible).toBe(false);
    expect(restored.analysis.legendSettings.reportLabelMode).toBe("full");
    expect(restored.analysis.legendSettings.reportNameOverrides).toEqual({});
    expect(restored.analysis.exportSettings.imageLayout).toBe("legendOnly");
    expect(restored.analysis.exportCounter).toBe(3);
    expect(restored.analysis.dirty).toBe(false);
    expect(restored.analysis.analysisId).not.toBe("analysis-test");
  });

  it("roundtrips a mixed Excel and paste dataset with visible source traceability", async () => {
    const excelDataset = createOneSpecimenEightReagentDataset();
    const pasteResult = parsePastedTable("Comparison sample\nA9\n0.1\nbad\n1.1", {
      mode: "fullTable",
      sourceName: "Paste comparison",
      sourceInstanceId: "paste-analysis-roundtrip",
      importedAtIso: "2026-07-11T01:00:00.000Z"
    });
    expect(pasteResult.ok).toBe(true);
    if (!pasteResult.ok) return;
    const merged = appendPcrDataset(excelDataset, pasteResult.dataset);
    const pasteCurveId = merged.appendedCurveIds[0];
    const selection = createInitialSelectionState(merged.dataset);
    selection.selectedCurveIds.add(excelDataset.curves[0].curveId);
    selection.orderedCurveIds = [pasteCurveId, ...selection.orderedCurveIds.filter((curveId) => curveId !== pasteCurveId)];
    const state = createAnalysisState({
      analysisId: "analysis-mixed-source",
      analysisName: "Mixed source review",
      dataset: merged.dataset,
      selection,
      searchQuery: "",
      selectionFilter: "all",
      chartScale: createDefaultChartScale(),
      styleRules: createDefaultStyleRules(),
      curveOverrides: {
        [pasteCurveId]: {
          displayName: "Comparison A9",
          color: "#123456",
          source: "custom",
          fieldSources: { displayName: "custom", color: "custom" }
        }
      },
      exportCounter: 4,
      importFileName: "Paste comparison appended",
      sourceFiles: [createSourceFileSummary(excelDataset), createSourceFileSummary(pasteResult.dataset)]
    });

    const buffer = await exportAnalysisWorkbookBuffer(state);
    const workbook = XLSX.read(buffer, { type: "array", raw: true });
    const importedRows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets.ImportedData, {
      header: 1,
      blankrows: false
    });
    expect(importedRows[4]?.[0]).toBe("Source type");
    expect(importedRows[4]?.at(-1)).toBe("paste");
    expect(importedRows[5]?.at(-1)).toBe("Paste comparison");
    expect(importedRows[6]?.at(-1)).toBe("paste-analysis-roundtrip");
    expect(importedRows[7]?.at(-1)).toBe("A");
    expect(importedRows[8]?.at(-1)).toBe("fullTable");

    const settingsRows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets.Settings, { header: 1, blankrows: false });
    expect(settingsRows).toContainEqual([
      "paste",
      "paste-analysis-roundtrip",
      "Paste comparison",
      "Paste",
      0,
      "2026-07-11T01:00:00.000Z",
      1
    ]);

    const restored = await readAnalysisWorkbookBuffer(buffer);
    expect(restored.kind).toBe("analysis");
    if (restored.kind !== "analysis") return;
    const restoredPasteCurve = restored.analysis.dataset.curves.find((curve) => curve.curveId === pasteCurveId);
    expect(restored.analysis.dataset.sourceKind).toBe("mixed");
    expect(restoredPasteCurve?.source).toMatchObject({
      sourceKind: "paste",
      sourceInstanceId: "paste-analysis-roundtrip",
      inputMode: "fullTable",
      fileName: "Paste comparison"
    });
    expect(restoredPasteCurve?.y).toEqual([0.1, null, 1.1]);
    expect(restored.analysis.selection.selectedCurveIds.has(pasteCurveId)).toBe(false);
    expect(restored.analysis.selection.orderedCurveIds[0]).toBe(pasteCurveId);
    expect(restored.analysis.curveOverrides[pasteCurveId]).toMatchObject({
      displayName: "Comparison A9",
      color: "#123456"
    });
    expect(restored.analysis.sourceFiles.map((source) => source.sourceKind)).toEqual(["excel", "paste"]);
  });

  it("roundtrips current analysis labels and legend/export settings without relying on legacy report names", async () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const selection = createInitialSelectionState(dataset);
    const firstCurve = dataset.curves[0];
    const secondCurve = dataset.curves[1];
    selection.selectedCurveIds.add(firstCurve.curveId);
    selection.orderedCurveIds = [secondCurve.curveId, firstCurve.curveId, ...selection.orderedCurveIds.slice(2)];

    const state = createAnalysisState({
      analysisId: "analysis-current-label",
      analysisName: "Condition Review",
      dataset,
      selection,
      searchQuery: "RSV",
      selectionFilter: "selected",
      chartScale: createDefaultChartScale(),
      styleRules: createDefaultStyleRules(),
      curveOverrides: {
        [firstCurve.curveId]: {
          displayName: "Condition A",
          markerType: "circle",
          source: "custom",
          fieldSources: { displayName: "custom", markerType: "custom" }
        }
      },
      legendSettings: {
        previewVisible: true,
        reportLabelMode: "autoCompact",
        reportNameOverrides: {}
      },
      exportSettings: { imageLayout: "plotWithLegend" },
      exportCounter: 11,
      importFileName: dataset.sourceFileName
    });

    const buffer = await exportAnalysisWorkbookBuffer(state);
    const workbook = XLSX.read(buffer, { type: "array", raw: true });
    expect(workbook.Sheets.ImportedData.A3?.v).toBe("Analysis label");
    expect(workbook.Sheets.ImportedData.B3?.v).toBe("Condition A");
    expect(workbook.Sheets.ImportedData.C3?.v).toBe("");

    const restored = await readAnalysisWorkbookBuffer(buffer);
    expect(restored.kind).toBe("analysis");
    if (restored.kind !== "analysis") return;
    expect(restored.analysis.dataset.curves).toHaveLength(dataset.curves.length);
    expect(restored.analysis.selection.selectedCurveIds.has(firstCurve.curveId)).toBe(true);
    expect(restored.analysis.selection.selectedCurveIds.has(secondCurve.curveId)).toBe(false);
    expect(restored.analysis.selection.orderedCurveIds.slice(0, 2)).toEqual([secondCurve.curveId, firstCurve.curveId]);
    expect(restored.analysis.curveOverrides[firstCurve.curveId]).toMatchObject({
      displayName: "Condition A",
      markerType: "circle",
      fieldSources: { displayName: "custom", markerType: "custom" }
    });
    expect(restored.analysis.legendSettings).toEqual({
      previewVisible: true,
      reportLabelMode: "autoCompact",
      reportNameOverrides: {}
    });
    expect(restored.analysis.exportSettings.imageLayout).toBe("plotWithLegend");
    expect(restored.analysis.exportCounter).toBe(11);
    expect(restored.analysis.dirty).toBe(false);
  });

  it("roundtrips an invalid scale draft separately from the last valid applied bounds", async () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const chartScale = createDefaultChartScale();
    chartScale.y.mode = "fixed";
    chartScale.y.fixedMin = "20";
    chartScale.y.fixedMax = "10";
    chartScale.y.applied = { mode: "fixed", min: -1, max: 100 };
    const state = createAnalysisState({
      analysisId: "analysis-scale-draft",
      analysisName: "Scale draft",
      dataset,
      selection: createInitialSelectionState(dataset),
      searchQuery: "",
      selectionFilter: "all",
      chartScale,
      styleRules: createDefaultStyleRules(),
      curveOverrides: {},
      exportCounter: 1,
      importFileName: dataset.sourceFileName
    });

    const restored = await readAnalysisWorkbookBuffer(await exportAnalysisWorkbookBuffer(state));

    expect(restored.kind).toBe("analysis");
    if (restored.kind !== "analysis") return;
    expect(restored.analysis.chartScale.y).toMatchObject({
      mode: "fixed",
      fixedMin: "20",
      fixedMax: "10",
      applied: { mode: "fixed", min: -1, max: 100 }
    });
  });

  it("migrates schema 1 scale state through the full Analysis XLSX workbook reader", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const state = createAnalysisState({
      analysisId: "analysis-schema-1",
      analysisName: "Legacy scale",
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
    const serialized = JSON.parse(JSON.stringify(serializeAnalysisState(state)));
    serialized.schemaVersion = 1;
    serialized.chartScale.x.mode = "preset1";
    serialized.chartScale.x.preset1 = { label: "Legacy P1", min: "1e-6", max: "2e-6" };
    delete serialized.chartScale.x.applied;
    delete serialized.chartScale.y.applied;
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["IsoAmplarAnalysis"],
        ["schemaVersion", 1],
        ["chunkCount", 1],
        ["chunkIndex", "jsonChunk"],
        [0, JSON.stringify(serialized)]
      ]),
      ANALYSIS_RESTORE_SHEET_NAME
    );

    const restored = readAnalysisWorkbook(workbook, XLSX);

    expect(restored.kind).toBe("analysis");
    if (restored.kind !== "analysis") return;
    expect(restored.analysis.chartScale.x.applied).toEqual({ mode: "preset1", min: 1e-6, max: 2e-6 });
    expect(restored.analysis.chartScale.y.applied).toEqual({ mode: "auto", min: null, max: null });
  });

  it("migrates schema 2 header and warning provenance through the full Analysis XLSX reader", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const state = createAnalysisState({
      analysisId: "analysis-schema-2",
      analysisName: "Legacy provenance",
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
    const serialized = JSON.parse(JSON.stringify(serializeAnalysisState(state)));
    serialized.schemaVersion = 2;
    serialized.dataset.schemaVersion = 1;
    delete serialized.dataset.curves[0].source.specimenHeader;
    delete serialized.dataset.curves[0].source.reagentHeader;
    const legacyWarning = {
      code: "MISSING_SPECIMEN_LABEL",
      severity: "warning",
      scope: "header",
      message: "Specimen header is empty.",
      curveIds: [serialized.dataset.curves[0].curveId],
      sourceCell: "A1",
      columnLetter: "A"
    };
    serialized.dataset.curves[0].warnings = [legacyWarning];
    serialized.dataset.warnings = [legacyWarning];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["IsoAmplarAnalysis"],
        ["schemaVersion", 2],
        ["chunkCount", 1],
        ["chunkIndex", "jsonChunk"],
        [0, JSON.stringify(serialized)]
      ]),
      ANALYSIS_RESTORE_SHEET_NAME
    );

    const restored = readAnalysisWorkbook(workbook, XLSX);

    expect(restored.kind).toBe("analysis");
    if (restored.kind !== "analysis") return;
    expect(restored.analysis.dataset.schemaVersion).toBe(2);
    expect(restored.analysis.dataset.curves[0].source.specimenHeader).toMatchObject({ cellType: "legacy" });
    expect(restored.analysis.dataset.warnings[0]).toMatchObject({ handling: "kept" });
    expect(restored.analysis.dataset.warnings[0].sourceRefs?.[0]).toMatchObject({ cell: "A1", columnLetter: "A" });
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

    const schemaMismatchWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      schemaMismatchWorkbook,
      XLSX.utils.aoa_to_sheet([
        ["IsoAmplarAnalysis"],
        ["schemaVersion", 3],
        ["chunkCount", 1],
        ["chunkIndex", "jsonChunk"],
        [0, JSON.stringify({ schemaVersion: 2 })]
      ]),
      ANALYSIS_RESTORE_SHEET_NAME
    );
    const schemaMismatch = readAnalysisWorkbook(schemaMismatchWorkbook, XLSX);
    expect(schemaMismatch.kind).toBe("invalid-analysis");
    if (schemaMismatch.kind === "invalid-analysis") {
      expect(schemaMismatch.message).toContain("schema metadata does not match");
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
    expect(createAnalysisWorkbookFileName(1, new Date("2026-07-09T00:00:00"), "Run A")).toBe("260709_Run_A_analysis1.xlsx");
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
