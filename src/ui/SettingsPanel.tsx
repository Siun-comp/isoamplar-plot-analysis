import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, SyntheticEvent } from "react";
import type { AxisId, AxisScaleState, ScaleMode, ScalePresetId } from "../chart/chartScale";
import { getAxisAutoDomain, isScalePresetConfigured } from "../chart/chartScale";
import { defaultChartColors } from "../chart/chartStyle";
import { buildPcrChartOption } from "../chart/chartConfig";
import { buildChartProjection, type LegendItem } from "../chart/chartProjection";
import {
  copyPngBlobToClipboard,
  copyReportLegendExcelTableToClipboard,
  downloadBlob,
  exportChartLayoutImageBlob,
  exportReportLegendImageBlob
} from "../chart/exportChart";
import type { ImageExportType } from "../chart/exportFilenames";
import { createImageExportFileName, createPlottedDataFileName } from "../chart/exportFilenames";
import { createPlottedDataCsv } from "../chart/plottedDataExport";
import { buildReportLegendProjection } from "../chart/reportLegend";
import { useAppStore } from "../app/appStore";
import { createAnalysisState } from "../analysis/analysisState";
import { createAnalysisWorkbookFileName, exportAnalysisWorkbookBlob } from "../analysis/analysisWorkbook";
import { formatCurveLabel, formatCurveSourceSuffix } from "../data/curveLabels";
import type {
  Curve,
  CurveStyleField,
  CurveStyleOverride,
  GroupingMode,
  ImageExportLayout,
  LineType,
  MarkerType,
  ReportLegendLabelMode,
  ResolvedCurveStyle,
  StyleGroupingTarget
} from "../data/types";

export function SettingsPanel() {
  const chartScale = useAppStore((state) => state.chartScale);
  const activeAnalysisId = useAppStore((state) => state.activeAnalysisId);
  const analysisName = useAppStore((state) => state.analysisName);
  const dataset = useAppStore((state) => state.dataset);
  const selection = useAppStore((state) => state.selection);
  const searchQuery = useAppStore((state) => state.searchQuery);
  const selectionFilter = useAppStore((state) => state.selectionFilter);
  const styleRules = useAppStore((state) => state.styleRules);
  const curveOverrides = useAppStore((state) => state.curveOverrides);
  const legendSettings = useAppStore((state) => state.legendSettings);
  const exportSettings = useAppStore((state) => state.exportSettings);
  const exportCounter = useAppStore((state) => state.exportCounter);
  const importFileName = useAppStore((state) => state.importFileName);
  const sourceFiles = useAppStore((state) => state.sourceFiles);
  const dirty = useAppStore((state) => state.dirty);
  const exportMessage = useAppStore((state) => state.exportMessage);
  const setAxisScaleMode = useAppStore((state) => state.setAxisScaleMode);
  const setAxisFixedValue = useAppStore((state) => state.setAxisFixedValue);
  const setAxisPresetValue = useAppStore((state) => state.setAxisPresetValue);
  const setStyleGroupingTarget = useAppStore((state) => state.setStyleGroupingTarget);
  const setGroupColor = useAppStore((state) => state.setGroupColor);
  const setGroupLineType = useAppStore((state) => state.setGroupLineType);
  const setGroupMarkerType = useAppStore((state) => state.setGroupMarkerType);
  const resetGroupStyle = useAppStore((state) => state.resetGroupStyle);
  const setCurveOverride = useAppStore((state) => state.setCurveOverride);
  const resetCurveOverrideField = useAppStore((state) => state.resetCurveOverrideField);
  const resetCurveOverride = useAppStore((state) => state.resetCurveOverride);
  const resetSelectedCurveOverrides = useAppStore((state) => state.resetSelectedCurveOverrides);
  const resetAllCurveOverrides = useAppStore((state) => state.resetAllCurveOverrides);
  const setLegendPreviewVisible = useAppStore((state) => state.setLegendPreviewVisible);
  const setReportLegendLabelMode = useAppStore((state) => state.setReportLegendLabelMode);
  const setExportImageLayout = useAppStore((state) => state.setExportImageLayout);
  const moveCurveOrder = useAppStore((state) => state.moveCurveOrder);
  const markExportSuccess = useAppStore((state) => state.markExportSuccess);
  const markAnalysisSaveSuccess = useAppStore((state) => state.markAnalysisSaveSuccess);
  const setExportMessage = useAppStore((state) => state.setExportMessage);
  const labelMode = selection?.groupingMode ?? "reagent";
  const selectedCurveIds = selection?.selectedCurveIds ?? new Set<string>();
  const orderedCurveIds = selection?.orderedCurveIds;
  const chartProjection = buildChartProjection({
    dataset,
    selectedCurveIds,
    orderedCurveIds,
    scale: chartScale,
    labelMode,
    styleRules,
    curveOverrides
  });
  const selectedCurves = chartProjection.visibleCurves;
  const xAutoDomain = getAxisAutoDomain("x", selectedCurves);
  const yAutoDomain = getAxisAutoDomain("y", selectedCurves);
  const specimenDefaultColors = createDefaultEntityColorMap(dataset?.specimens ?? []);
  const reagentDefaultColors = createDefaultEntityColorMap(dataset?.reagents ?? []);
  const setAnalysisLabel = (curveId: string, label: string) => {
    if (label.trim() === "") {
      resetCurveOverrideField(curveId, "displayName");
      return;
    }
    setCurveOverride(curveId, { displayName: label });
  };
  const resetAnalysisLabel = (curveId: string) => {
    resetCurveOverrideField(curveId, "displayName");
  };
  const resetSelectedAnalysisLabels = () => {
    selectedCurves.forEach((curve) => resetCurveOverrideField(curve.curveId, "displayName"));
  };

  return (
    <div className="settings-accordion">
      <details open>
        <summary>Scale</summary>
        <ScaleAxisControl
          axis="x"
          label="X axis"
          state={chartScale.x}
          autoDomain={xAutoDomain}
          onModeChange={setAxisScaleMode}
          onFixedValueChange={setAxisFixedValue}
          onPresetValueChange={setAxisPresetValue}
        />
        <ScaleAxisControl
          axis="y"
          label="Y axis"
          state={chartScale.y}
          autoDomain={yAutoDomain}
          onModeChange={setAxisScaleMode}
          onFixedValueChange={setAxisFixedValue}
          onPresetValueChange={setAxisPresetValue}
        />
      </details>
      <details>
        <summary>Style</summary>
        <section className="style-settings">
          <div className="style-summary" aria-label="현재 스타일 기준">
            <strong>현재 기준</strong>
            <span>색상 {formatGroupingTarget(styleRules.colorBy)}</span>
            <span>선 {formatGroupingTarget(styleRules.lineTypeBy)}</span>
            <span>마커 {formatGroupingTarget(styleRules.markerBy)}</span>
          </div>
          <div className="style-target-grid">
            <label>
              색상 기준
              <select
                value={styleRules.colorBy}
                onChange={(event) => setStyleGroupingTarget("colorBy", event.currentTarget.value as StyleGroupingTarget)}
              >
                <option value="reagent">시약별</option>
                <option value="specimen">검체별</option>
              </select>
            </label>
            <label>
              선 기준
              <select
                value={styleRules.lineTypeBy}
                onChange={(event) => setStyleGroupingTarget("lineTypeBy", event.currentTarget.value as StyleGroupingTarget)}
              >
                <option value="reagent">시약별</option>
                <option value="specimen">검체별</option>
              </select>
            </label>
            <label>
              마커 기준
              <select
                value={styleRules.markerBy}
                onChange={(event) => setStyleGroupingTarget("markerBy", event.currentTarget.value as StyleGroupingTarget)}
              >
                <option value="reagent">시약별</option>
                <option value="specimen">검체별</option>
              </select>
            </label>
          </div>

          <GroupStyleEditor
            title="검체 스타일"
            target="specimen"
            entities={dataset?.specimens ?? []}
            colorRules={styleRules.specimenColors}
            defaultColors={specimenDefaultColors}
            lineRules={styleRules.specimenLineTypes}
            markerRules={styleRules.specimenMarkerTypes}
            onColorChange={setGroupColor}
            onLineTypeChange={setGroupLineType}
            onMarkerTypeChange={setGroupMarkerType}
            onResetGroup={resetGroupStyle}
          />
          <GroupStyleEditor
            title="시약 스타일"
            target="reagent"
            entities={dataset?.reagents ?? []}
            colorRules={styleRules.reagentColors}
            defaultColors={reagentDefaultColors}
            lineRules={styleRules.reagentLineTypes}
            markerRules={styleRules.reagentMarkerTypes}
            onColorChange={setGroupColor}
            onLineTypeChange={setGroupLineType}
            onMarkerTypeChange={setGroupMarkerType}
            onResetGroup={resetGroupStyle}
          />

          <IndividualCurveEditor
            curves={selectedCurves}
            labelMode={labelMode}
            styleRules={styleRules}
            specimenDefaultColors={specimenDefaultColors}
            reagentDefaultColors={reagentDefaultColors}
            overrides={curveOverrides}
            resolvedStyles={chartProjection.resolvedStyles}
            onOverride={setCurveOverride}
            onResetField={resetCurveOverrideField}
            onResetCurve={resetCurveOverride}
            onResetSelected={resetSelectedCurveOverrides}
            onResetAll={resetAllCurveOverrides}
          />
        </section>
      </details>
      <details>
        <summary>Legend</summary>
        <LegendEditor
          curves={selectedCurves}
          labelMode={labelMode}
          legendSettings={legendSettings}
          legendItems={chartProjection.legendItems}
          curveOverrides={curveOverrides}
          onPreviewLegendChange={setLegendPreviewVisible}
          onReportLabelModeChange={setReportLegendLabelMode}
          onAnalysisLabelChange={setAnalysisLabel}
          onAnalysisLabelReset={resetAnalysisLabel}
          onSelectedAnalysisLabelsReset={resetSelectedAnalysisLabels}
          onMove={moveCurveOrder}
        />
      </details>
      <details>
        <summary>Export</summary>
        <ExportControls
          dataset={dataset}
          activeAnalysisId={activeAnalysisId}
          analysisName={analysisName}
          selection={selection}
          selectedCurves={selectedCurves}
          selectedCurveIds={selectedCurveIds}
          orderedCurveIds={orderedCurveIds}
          searchQuery={searchQuery}
          selectionFilter={selectionFilter}
          chartScale={chartScale}
          labelMode={labelMode}
          styleRules={styleRules}
          curveOverrides={curveOverrides}
          legendSettings={legendSettings}
          exportSettings={exportSettings}
          onExportLayoutChange={setExportImageLayout}
          exportCounter={exportCounter}
          exportMessage={exportMessage}
          importFileName={importFileName}
          sourceFiles={sourceFiles}
          dirty={dirty}
          markExportSuccess={markExportSuccess}
          markAnalysisSaveSuccess={markAnalysisSaveSuccess}
          setExportMessage={setExportMessage}
        />
      </details>
    </div>
  );
}

function ExportControls({
  dataset,
  activeAnalysisId,
  analysisName,
  selection,
  selectedCurves,
  selectedCurveIds,
  orderedCurveIds,
  searchQuery,
  selectionFilter,
  chartScale,
  labelMode,
  styleRules,
  curveOverrides,
  legendSettings,
  exportSettings,
  onExportLayoutChange,
  exportCounter,
  exportMessage,
  importFileName,
  sourceFiles,
  dirty,
  markExportSuccess,
  markAnalysisSaveSuccess,
  setExportMessage
}: {
  dataset: ReturnType<typeof useAppStore.getState>["dataset"];
  activeAnalysisId: string;
  analysisName: string;
  selection: ReturnType<typeof useAppStore.getState>["selection"];
  selectedCurves: Curve[];
  selectedCurveIds: Set<string>;
  orderedCurveIds?: string[];
  searchQuery: string;
  selectionFilter: ReturnType<typeof useAppStore.getState>["selectionFilter"];
  chartScale: ReturnType<typeof useAppStore.getState>["chartScale"];
  labelMode: GroupingMode;
  styleRules: ReturnType<typeof useAppStore.getState>["styleRules"];
  curveOverrides: ReturnType<typeof useAppStore.getState>["curveOverrides"];
  legendSettings: ReturnType<typeof useAppStore.getState>["legendSettings"];
  exportSettings: ReturnType<typeof useAppStore.getState>["exportSettings"];
  onExportLayoutChange: ReturnType<typeof useAppStore.getState>["setExportImageLayout"];
  exportCounter: number;
  exportMessage: string | null;
  importFileName: string | null;
  sourceFiles: ReturnType<typeof useAppStore.getState>["sourceFiles"];
  dirty: boolean;
  markExportSuccess: (message: string) => void;
  markAnalysisSaveSuccess: (message: string) => void;
  setExportMessage: (message: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const csvResult = createPlottedDataCsv({ curves: selectedCurves, labelMode, styleRules, curveOverrides });
  const disabled = selectedCurves.length === 0 || busy;
  const analysisExportDisabled = !dataset || !selection || busy;

  async function exportImage(type: ImageExportType) {
    if (!dataset) return;
    setBusy(true);
    setExportMessage(null);
    try {
      const chart = buildPcrChartOption({
        dataset,
        selectedCurveIds,
        orderedCurveIds,
        scale: chartScale,
        labelMode,
        styleRules,
        curveOverrides,
        legendSettings
      });
      const blob = await exportChartLayoutImageBlob({
        option: chart.option,
        type,
        layout: exportSettings.imageLayout,
        legendItems: chart.legendItems
      });
      const fileName = createImageExportFileName(exportCounter, type, new Date(), analysisName);
      downloadBlob(blob, fileName);
      markExportSuccess(`Saved ${fileName}.`);
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : "Image export failed.");
    } finally {
      setBusy(false);
    }
  }

  async function copyPng(layout: ImageExportLayout = exportSettings.imageLayout, successMessage = "Copied PNG image to clipboard.") {
    if (!dataset) return;
    setBusy(true);
    setExportMessage(null);
    try {
      const chart = buildPcrChartOption({
        dataset,
        selectedCurveIds,
        orderedCurveIds,
        scale: chartScale,
        labelMode,
        styleRules,
        curveOverrides,
        legendSettings
      });
      const blob = await exportChartLayoutImageBlob({
        option: chart.option,
        type: "png",
        layout,
        legendItems: chart.legendItems
      });
      await copyPngBlobToClipboard(blob);
      setExportMessage(successMessage);
    } catch (error) {
      setExportMessage(`${error instanceof Error ? error.message : "Clipboard copy failed."} Download PNG instead.`);
    } finally {
      setBusy(false);
    }
  }

  async function exportReportLegend(type: ImageExportType) {
    if (!dataset) return;
    setBusy(true);
    setExportMessage(null);
    try {
      const chart = buildPcrChartOption({
        dataset,
        selectedCurveIds,
        orderedCurveIds,
        scale: chartScale,
        labelMode,
        styleRules,
        curveOverrides,
        legendSettings
      });
      const reportLegend = buildReportLegendProjection({
        curves: chart.visibleCurves,
        legendItems: chart.legendItems,
        labelMode,
        legendSettings,
        curveOverrides
      });
      const blob = await exportReportLegendImageBlob({
        items: reportLegend.items,
        type,
        title: reportLegend.title
      });
      const fileName = createImageExportFileName(exportCounter, type, new Date(), `${analysisName}_legend`);
      downloadBlob(blob, fileName);
      markExportSuccess(`Saved ${fileName}.`);
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : "Report legend export failed.");
    } finally {
      setBusy(false);
    }
  }

  async function copyReportLegendPng() {
    if (!dataset) return;
    setBusy(true);
    setExportMessage(null);
    try {
      const chart = buildPcrChartOption({
        dataset,
        selectedCurveIds,
        orderedCurveIds,
        scale: chartScale,
        labelMode,
        styleRules,
        curveOverrides,
        legendSettings
      });
      const reportLegend = buildReportLegendProjection({
        curves: chart.visibleCurves,
        legendItems: chart.legendItems,
        labelMode,
        legendSettings,
        curveOverrides
      });
      const blob = await exportReportLegendImageBlob({
        items: reportLegend.items,
        type: "png",
        title: reportLegend.title
      });
      await copyPngBlobToClipboard(blob);
      setExportMessage("Copied report legend PNG to clipboard.");
    } catch (error) {
      setExportMessage(`${error instanceof Error ? error.message : "Clipboard copy failed."} Download PNG instead.`);
    } finally {
      setBusy(false);
    }
  }

  async function copyReportLegendExcel() {
    if (!dataset) return;
    setBusy(true);
    setExportMessage(null);
    try {
      const chart = buildPcrChartOption({
        dataset,
        selectedCurveIds,
        orderedCurveIds,
        scale: chartScale,
        labelMode,
        styleRules,
        curveOverrides,
        legendSettings
      });
      const reportLegend = buildReportLegendProjection({
        curves: chart.visibleCurves,
        legendItems: chart.legendItems,
        labelMode,
        legendSettings,
        curveOverrides
      });
      await copyReportLegendExcelTableToClipboard({
        title: reportLegend.title,
        items: reportLegend.items
      });
      setExportMessage("Copied report legend as Excel cells.");
    } catch (error) {
      setExportMessage(`${error instanceof Error ? error.message : "Rich Excel clipboard copy failed."} Use report legend PNG instead.`);
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    if (!csvResult.ok) {
      setExportMessage(csvResult.reason);
      return;
    }

    const fileName = createPlottedDataFileName(exportCounter, new Date(), analysisName);
    const blob = new Blob(["\ufeff", csvResult.csv], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, fileName);
    markExportSuccess(`Saved ${fileName}.`);
  }

  async function exportAnalysisXlsx() {
    if (!dataset || !selection) return;
    setBusy(true);
    setExportMessage(null);
    try {
      const nextExportCounter = exportCounter + 1;
      const analysisState = createAnalysisState({
        analysisId: activeAnalysisId,
        analysisName,
        dataset,
        selection,
        searchQuery,
        selectionFilter,
        chartScale,
        styleRules,
        curveOverrides,
        legendSettings,
        exportSettings,
        exportCounter: nextExportCounter,
        importFileName,
        sourceFiles,
        dirty
      });
      const blob = await exportAnalysisWorkbookBlob(analysisState);
      const fileName = createAnalysisWorkbookFileName(exportCounter, new Date(), analysisName);
      downloadBlob(blob, fileName);
      markAnalysisSaveSuccess(`Saved ${fileName}.`);
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : "Analysis XLSX export failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="export-controls">
      <p>다음 파일 번호: plot{exportCounter}</p>
      <section className="export-group" aria-label="Chart image export">
        <div className="export-group-header">
          <strong>Chart image</strong>
          <label className="export-layout-control">
            <span>Layout</span>
            <select
              aria-label="Image export layout"
              value={exportSettings.imageLayout}
              onChange={(event) => onExportLayoutChange(event.currentTarget.value as ImageExportLayout)}
            >
              <option value="plotOnly">Plot only</option>
              <option value="plotWithLegend">Plot + Legend</option>
              <option value="legendOnly">Legend only</option>
            </select>
          </label>
        </div>
        <div className="export-button-grid">
      <button type="button" aria-label="Save PNG" disabled={disabled} onClick={() => void exportImage("png")}>
        PNG 저장
      </button>
      <button type="button" aria-label="Save JPEG" disabled={disabled} onClick={() => void exportImage("jpeg")}>
        JPEG 저장
      </button>
      <button type="button" aria-label="Copy selected layout PNG to clipboard" disabled={disabled} onClick={() => void copyPng()}>
        클립보드 PNG
      </button>
        </div>
      </section>
      <section className="export-group" aria-label="Legend export">
        <div className="export-group-header export-group-header-stacked">
          <strong>Legend outputs</strong>
          <span>Current legend order and analysis labels are used.</span>
        </div>
        <div className="export-button-grid">
      <button
        hidden
        type="button"
        aria-label="Copy standard legend PNG to clipboard"
        disabled={disabled}
        onClick={() => void copyPng("legendOnly", "Copied legend PNG to clipboard.")}
      >
        범례 클립보드 PNG
      </button>
        </div>
        <details className="export-more">
          <summary>Legend file save</summary>
          <div className="export-button-grid">
      <button type="button" aria-label="Save report legend PNG" disabled={disabled} onClick={() => void exportReportLegend("png")}>
        Legend PNG
      </button>
      <button
        type="button"
        aria-label="Save report legend JPEG"
        disabled={disabled}
        onClick={() => void exportReportLegend("jpeg")}
      >
        Legend JPEG
      </button>
          </div>
        </details>
        <div className="export-button-grid">
      <button
        type="button"
        aria-label="Copy report legend PNG to clipboard"
        disabled={disabled}
        onClick={() => void copyReportLegendPng()}
      >
        Legend Clipboard PNG
      </button>
      <button
        type="button"
        aria-label="Copy report legend Excel cells"
        disabled={disabled}
        onClick={() => void copyReportLegendExcel()}
      >
        Copy for Excel
      </button>
        </div>
      </section>
      <section className="export-group" aria-label="Data and analysis export">
        <div className="export-group-header">
          <strong>Data / session</strong>
        </div>
        <div className="export-button-grid">
      <button type="button" disabled={busy || !csvResult.ok} onClick={exportCsv}>
        Plotted CSV
      </button>
      <button type="button" disabled={analysisExportDisabled} onClick={() => void exportAnalysisXlsx()}>
        Analysis XLSX
      </button>
        </div>
      </section>
      {!csvResult.ok && <p>{csvResult.reason}</p>}
      {exportMessage && <p className="export-message">{exportMessage}</p>}
    </section>
  );
}

const lineTypeOptions: Array<{ value: LineType; label: string }> = [
  { value: "solid", label: "실선" },
  { value: "dashed", label: "점선" },
  { value: "dotted", label: "도트" }
];

const markerTypeOptions: Array<{ value: MarkerType; label: string }> = [
  { value: "none", label: "없음" },
  { value: "circle", label: "원형" },
  { value: "triangle", label: "세모" },
  { value: "rect", label: "네모" }
];

function GroupStyleEditor({
  title,
  target,
  entities,
  colorRules,
  defaultColors,
  lineRules,
  markerRules,
  onColorChange,
  onLineTypeChange,
  onMarkerTypeChange,
  onResetGroup
}: {
  title: string;
  target: StyleGroupingTarget;
  entities: Array<{ id: string; label: string }>;
  colorRules: Record<string, string>;
  defaultColors: Record<string, string>;
  lineRules: Record<string, LineType>;
  markerRules: Record<string, MarkerType>;
  onColorChange: (target: StyleGroupingTarget, entityId: string, color: string) => void;
  onLineTypeChange: (target: StyleGroupingTarget, entityId: string, lineType: LineType) => void;
  onMarkerTypeChange: (target: StyleGroupingTarget, entityId: string, markerType: MarkerType) => void;
  onResetGroup: (target: StyleGroupingTarget, entityId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const visibleEntities = normalizedQuery
    ? entities.filter((entity) => entity.label.toLowerCase().includes(normalizedQuery))
    : entities;

  return (
    <section className="group-style-editor" aria-label={title}>
      <div className="style-section-heading">
        <strong>{title}</strong>
        <span>{entities.length}개</span>
      </div>
      {entities.length > 12 && (
        <input
          className="style-search"
          type="search"
          aria-label={`${title} 검색`}
          placeholder="검색"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
      )}
      <div className="style-table-scroll group-style-scroll">
        <div className="style-row style-row-header" aria-hidden="true">
          <span>그룹</span>
          <span>색상</span>
          <span>HEX</span>
          <span>선</span>
          <span>마커</span>
          <span>초기화</span>
        </div>
        <div className="style-row-list">
          {visibleEntities.length === 0 && <p>표시할 그룹이 없습니다.</p>}
          {visibleEntities.map((entity) => {
            const color = colorRules[entity.id] ?? defaultColors[entity.id] ?? defaultChartColors[0];
            const lineType = lineRules[entity.id] ?? "solid";
            const markerType = markerRules[entity.id] ?? "none";
            const entityLabel = entity.label || "Empty label";

            return (
              <div className="style-row" key={entity.id}>
                <span className="style-group-label" title={entity.label}>{entityLabel}</span>
                <ColorPopoverButton label={entityLabel} value={color} onCommit={(nextColor) => onColorChange(target, entity.id, nextColor)} />
                <LineMarkerPopoverButton
                  label={entityLabel}
                  color={color}
                  lineType={lineType}
                  markerType={markerType}
                  onLineTypeChange={(nextLineType) => onLineTypeChange(target, entity.id, nextLineType)}
                  onMarkerTypeChange={(nextMarkerType) => onMarkerTypeChange(target, entity.id, nextMarkerType)}
                />
                <button
                  type="button"
                  className="compact-button style-reset-icon"
                  aria-label={`${entityLabel} reset group style`}
                  title="Reset"
                  onClick={() => onResetGroup(target, entity.id)}
                >
                  ↺
                </button>
              </div>
            );
          })}
        </div>
      </div>
      {entities.length > 0 && visibleEntities.length !== entities.length && <p>{visibleEntities.length} / {entities.length}개 그룹 표시</p>}
    </section>
  );
}

const stylePopoverOpenEvent = "isoamplar-style-popover-open";

function useStylePopoverState() {
  const id = useId();
  const ref = useRef<HTMLDetailsElement | null>(null);

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      if (ref.current?.open && !ref.current.contains(event.target as Node)) {
        closePopover();
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closePopover();
      }
    }

    function closeWhenAnotherPopoverOpens(event: Event) {
      const nextId = (event as CustomEvent<string>).detail;
      if (nextId !== id) {
        closePopover();
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener(stylePopoverOpenEvent, closeWhenAnotherPopoverOpens);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener(stylePopoverOpenEvent, closeWhenAnotherPopoverOpens);
    };
  }, [id]);

  function onToggle(event: SyntheticEvent<HTMLDetailsElement>) {
    if (event.currentTarget.open) {
      window.dispatchEvent(new CustomEvent(stylePopoverOpenEvent, { detail: id }));
    }
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLDetailsElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (ref.current?.open) {
        ref.current.open = false;
      }
    }
  }

  function closePopover() {
    if (ref.current?.open) {
      ref.current.open = false;
    }
  }

  return { ref, onToggle, onKeyDown, closePopover };
}

function ColorPopoverButton({
  label,
  value,
  onCommit
}: {
  label: string;
  value: string;
  onCommit: (color: string) => void;
}) {
  const color = normalizeHexColor(value) ?? defaultChartColors[0];
  const popover = useStylePopoverState();

  return (
    <details
      className="style-popover color-popover"
      ref={popover.ref}
      onToggle={popover.onToggle}
      onKeyDown={popover.onKeyDown}
    >
      <summary className="style-popover-trigger color-trigger" aria-label={`${label} color editor`}>
        <span className="color-swatch" style={{ backgroundColor: color }} />
      </summary>
      <div className="style-popover-panel color-popover-panel">
        <label>
          HEX
          <HexColorInput label={`${label} hex color`} value={color} onCommit={onCommit} />
        </label>
        <label>
          Picker
          <input type="color" aria-label={`${label} color`} value={color} onChange={(event) => onCommit(event.currentTarget.value)} />
        </label>
      </div>
    </details>
  );
}

function LineMarkerPopoverButton({
  label,
  color,
  lineType,
  markerType,
  onLineTypeChange,
  onMarkerTypeChange
}: {
  label: string;
  color: string;
  lineType: LineType;
  markerType: MarkerType;
  onLineTypeChange: (lineType: LineType) => void;
  onMarkerTypeChange: (markerType: MarkerType) => void;
}) {
  const safeColor = normalizeHexColor(color) ?? defaultChartColors[0];
  const popover = useStylePopoverState();

  return (
    <details
      className="style-popover line-marker-popover"
      ref={popover.ref}
      onToggle={popover.onToggle}
      onKeyDown={popover.onKeyDown}
    >
      <summary className="style-popover-trigger line-marker-trigger" aria-label={`${label} line and marker editor`}>
        <LineMarkerPreview color={safeColor} lineType={lineType} markerType={markerType} />
      </summary>
      <div className="style-popover-panel line-marker-panel">
        <fieldset>
          <legend>Line</legend>
          <div className="line-marker-options">
            {lineTypeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={lineType === option.value ? "is-active" : ""}
                aria-label={`${label} line ${option.value}`}
                aria-pressed={lineType === option.value}
                onClick={() => {
                  onLineTypeChange(option.value);
                  popover.closePopover();
                }}
              >
                <LineMarkerPreview color={safeColor} lineType={option.value} markerType="none" />
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Marker</legend>
          <div className="line-marker-options">
            {markerTypeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={markerType === option.value ? "is-active" : ""}
                aria-label={`${label} marker ${option.value}`}
                aria-pressed={markerType === option.value}
                onClick={() => {
                  onMarkerTypeChange(option.value);
                  popover.closePopover();
                }}
              >
                <LineMarkerPreview color={safeColor} lineType="solid" markerType={option.value} />
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </fieldset>
      </div>
    </details>
  );
}

function LineMarkerPreview({ color, lineType, markerType }: { color: string; lineType: LineType; markerType: MarkerType }) {
  return (
    <svg className="line-marker-preview" viewBox="0 0 76 22" aria-hidden="true" focusable="false">
      <line
        x1="8"
        y1="11"
        x2="68"
        y2="11"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap={lineType === "dotted" ? "round" : "butt"}
        strokeDasharray={getLineStrokeDashArray(lineType)}
      />
      {renderMarkerPreview(markerType, color)}
    </svg>
  );
}

function renderMarkerPreview(markerType: MarkerType, color: string) {
  if (markerType === "none") return null;
  if (markerType === "circle") return <circle cx="38" cy="11" r="4.5" fill={color} />;
  if (markerType === "triangle") return <polygon points="38,5.5 44,16 32,16" fill={color} />;
  return <rect x="33.5" y="6.5" width="9" height="9" fill={color} />;
}

function getLineStrokeDashArray(lineType: LineType) {
  if (lineType === "dashed") return "8 5";
  if (lineType === "dotted") return "1 5";
  return "";
}

function IndividualCurveEditor({
  curves,
  labelMode,
  styleRules,
  specimenDefaultColors,
  reagentDefaultColors,
  overrides,
  resolvedStyles,
  onOverride,
  onResetField,
  onResetCurve,
  onResetSelected,
  onResetAll
}: {
  curves: Curve[];
  labelMode: GroupingMode;
  styleRules: ReturnType<typeof useAppStore.getState>["styleRules"];
  specimenDefaultColors: Record<string, string>;
  reagentDefaultColors: Record<string, string>;
  overrides: Record<string, CurveStyleOverride>;
  resolvedStyles: Map<string, ResolvedCurveStyle>;
  onOverride: (curveId: string, override: CurveStyleOverride) => void;
  onResetField: (curveId: string, field: CurveStyleField) => void;
  onResetCurve: (curveId: string) => void;
  onResetSelected: () => void;
  onResetAll: () => void;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const labelCounts = createCurveLabelCounts(curves, labelMode);
  const visibleCurves = normalizedQuery
    ? curves.filter((curve) => {
        const label = formatCurveLabel(curve, labelMode);
        const resolvedStyle = resolvedStyles.get(curve.curveId);
        return [label, formatCurveSourceSuffix(curve), resolvedStyle?.displayName ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      })
    : curves;

  return (
    <section className="individual-editor" aria-label="개별 curve 스타일">
      <div className="style-section-heading">
        <strong>개별 스타일</strong>
        <span>{curves.length}개 선택</span>
      </div>
      <div className="individual-actions">
        <input
          className="style-search"
          type="search"
          aria-label="개별 스타일 검색"
          placeholder="선택 curve 검색"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
        <button type="button" className="compact-button" disabled={curves.length === 0} onClick={onResetSelected}>
          선택 초기화
        </button>
        <button type="button" className="compact-button" disabled={Object.keys(overrides).length === 0} onClick={onResetAll}>
          전체 초기화
        </button>
      </div>
      <div className="style-table-scroll individual-style-scroll">
        <div className="individual-row individual-row-header" aria-hidden="true">
          <span>Curve</span>
          <span>범례명</span>
          <span>색상</span>
          <span>HEX</span>
          <span>선</span>
          <span>마커</span>
          <span>상태</span>
          <span>초기화</span>
        </div>
        <div className="individual-row-list">
          {visibleCurves.length === 0 && <p>선택된 curve가 없습니다.</p>}
          {visibleCurves.map((curve) => {
            const label = formatCurveLabel(curve, labelMode);
            const sourceSuffix = formatCurveSourceSuffix(curve);
            const controlLabel = createCurveControlLabel(label, sourceSuffix, labelCounts);
            const override = overrides[curve.curveId];
            const resolvedStyle = resolvedStyles.get(curve.curveId);
            const status = getCurveOverrideStatus(override);
            const colorValue =
              resolvedStyle?.color ?? getCurveDefaultColor(curve, styleRules, specimenDefaultColors, reagentDefaultColors);
            const lineValue = resolvedStyle?.lineType ?? getCurveDefaultLineType(curve, styleRules);
            const markerValue = resolvedStyle?.markerType ?? getCurveDefaultMarkerType(curve, styleRules);
            const displayPlaceholder = resolvedStyle?.displayName ?? label;

            return (
              <div className="individual-row" key={curve.curveId}>
              <span className="curve-label" title={label}>
                {label}
                <small>{sourceSuffix}</small>
              </span>
                <StyleFieldCell>
                  <input
                    type="text"
                    aria-label={`${controlLabel} analysis label`}
                    value={override?.displayName ?? ""}
                    placeholder={displayPlaceholder}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      if (value.trim() === "") {
                        onResetField(curve.curveId, "displayName");
                      } else {
                        onOverride(curve.curveId, { displayName: value });
                      }
                    }}
                  />
                  <FieldOriginBadge style={resolvedStyle} field="displayName" />
                  <FieldResetButton
                    label={`${controlLabel} analysis label reset`}
                    disabled={override?.displayName === undefined}
                    onClick={() => onResetField(curve.curveId, "displayName")}
                  />
                </StyleFieldCell>
                <input
                  type="color"
                  aria-label={`${controlLabel} color`}
                  value={colorValue}
                  onChange={(event) => onOverride(curve.curveId, { color: event.currentTarget.value })}
                />
                <StyleFieldCell>
                  <HexColorInput
                    label={`${controlLabel} hex color`}
                    value={colorValue}
                    onCommit={(color) => onOverride(curve.curveId, { color })}
                  />
                  <FieldOriginBadge style={resolvedStyle} field="color" />
                  <FieldResetButton
                    label={`${controlLabel} color reset`}
                    disabled={override?.color === undefined}
                    onClick={() => onResetField(curve.curveId, "color")}
                  />
                </StyleFieldCell>
                <StyleFieldCell>
                  <select
                    aria-label={`${controlLabel} line type`}
                    value={lineValue}
                    onChange={(event) => onOverride(curve.curveId, { lineType: event.currentTarget.value as LineType })}
                  >
                    {lineTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <FieldOriginBadge style={resolvedStyle} field="lineType" />
                  <FieldResetButton
                    label={`${controlLabel} line type reset`}
                    disabled={override?.lineType === undefined}
                    onClick={() => onResetField(curve.curveId, "lineType")}
                  />
                </StyleFieldCell>
                <StyleFieldCell>
                  <select
                    aria-label={`${controlLabel} marker type`}
                    value={markerValue}
                    onChange={(event) => onOverride(curve.curveId, { markerType: event.currentTarget.value as MarkerType })}
                  >
                    {markerTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <FieldOriginBadge style={resolvedStyle} field="markerType" />
                  <FieldResetButton
                    label={`${controlLabel} marker type reset`}
                    disabled={override?.markerType === undefined}
                    onClick={() => onResetField(curve.curveId, "markerType")}
                  />
                </StyleFieldCell>
                <span className={`style-status style-status-${status.kind}`}>{status.label}</span>
                <button
                  type="button"
                  className="compact-button"
                  aria-label={`${controlLabel} style reset`}
                  disabled={!override}
                  onClick={() => onResetCurve(curve.curveId)}
                >
                  Reset
                </button>
              </div>
            );
          })}
        </div>
      </div>
      {curves.length > 0 && visibleCurves.length !== curves.length && <p>{visibleCurves.length} / {curves.length}개 curve 표시</p>}
    </section>
  );
}

function StyleFieldCell({ children }: { children: ReactNode }) {
  return <span className="style-field-cell">{children}</span>;
}

function FieldOriginBadge({ style, field }: { style: ResolvedCurveStyle | undefined; field: CurveStyleField }) {
  const source = style?.sources[field];
  if (source === "custom") {
    return <span className="field-origin field-origin-custom">Custom</span>;
  }
  if (source === "preset") {
    return <span className="field-origin field-origin-preset">Preset</span>;
  }
  return <span className="field-origin field-origin-base">기준</span>;
}

function FieldResetButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" className="field-reset-button" aria-label={label} title="기준값으로 복귀" disabled={disabled} onClick={onClick}>
      ↺
    </button>
  );
}

function HexColorInput({
  label,
  value,
  onCommit
}: {
  label: string;
  value: string;
  onCommit: (color: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const normalizedValue = normalizeHexColor(value) ?? defaultChartColors[0];

  useEffect(() => {
    setDraft(normalizedValue);
  }, [normalizedValue]);

  function updateDraft(nextValue: string) {
    setDraft(nextValue);
    const normalized = isSixDigitHexColor(nextValue) ? normalizeHexColor(nextValue) : null;
    if (normalized) {
      onCommit(normalized);
    }
  }

  function commitDraft() {
    const normalized = normalizeHexColor(draft);
    if (normalized) {
      onCommit(normalized);
    }
    setDraft(normalized ?? normalizedValue);
  }

  return (
    <input
      className="hex-input"
      type="text"
      inputMode="text"
      spellCheck={false}
      aria-label={label}
      value={draft}
      onChange={(event) => updateDraft(event.currentTarget.value)}
      onBlur={commitDraft}
    />
  );
}

function LegendEditor({
  curves,
  labelMode,
  legendSettings,
  legendItems,
  curveOverrides,
  onPreviewLegendChange,
  onReportLabelModeChange,
  onAnalysisLabelChange,
  onAnalysisLabelReset,
  onSelectedAnalysisLabelsReset,
  onMove
}: {
  curves: Curve[];
  labelMode: GroupingMode;
  legendSettings: ReturnType<typeof useAppStore.getState>["legendSettings"];
  legendItems: LegendItem[];
  curveOverrides: Record<string, CurveStyleOverride>;
  onPreviewLegendChange: (visible: boolean) => void;
  onReportLabelModeChange: (mode: ReportLegendLabelMode) => void;
  onAnalysisLabelChange: (curveId: string, name: string) => void;
  onAnalysisLabelReset: (curveId: string) => void;
  onSelectedAnalysisLabelsReset: () => void;
  onMove: (curveId: string, direction: "up" | "down") => void;
}) {
  const [activeTab, setActiveTab] = useState<"order" | "labels">("order");
  const labelCounts = createCurveLabelCounts(curves, labelMode);

  return (
    <div className="legend-editor">
      <div className="legend-tabs" role="tablist" aria-label="Legend settings">
        <button type="button" role="tab" aria-selected={activeTab === "order"} className={activeTab === "order" ? "active" : ""} onClick={() => setActiveTab("order")}>
          Order
        </button>
        <button type="button" role="tab" aria-selected={activeTab === "labels"} className={activeTab === "labels" ? "active" : ""} onClick={() => setActiveTab("labels")}>
          Labels
        </button>
      </div>

      <section className="legend-order-list" hidden={activeTab !== "order"} aria-label="Legend order">
        <div className="legend-controls">
          <label className="checkbox-row">
            <input
              type="checkbox"
              aria-label="미리보기 범례 표시"
              checked={legendSettings.previewVisible}
              onChange={(event) => onPreviewLegendChange(event.currentTarget.checked)}
            />
            미리보기 범례 표시
          </label>
        </div>
        {curves.length === 0 && <p>선택된 curve가 없습니다.</p>}
        {curves.map((curve, index) => {
          const label = formatCurveLabel(curve, labelMode);
          const sourceSuffix = formatCurveSourceSuffix(curve);
          const controlLabel = createCurveControlLabel(label, sourceSuffix, labelCounts);
          const displayLabel = curveOverrides[curve.curveId]?.displayName || label;

          return (
            <div className="legend-order-row" key={curve.curveId}>
              <span title={`${label} ${sourceSuffix}`}>
                {displayLabel}
                <small>{displayLabel === label ? sourceSuffix : `${label} - ${sourceSuffix}`}</small>
              </span>
              <button type="button" aria-label={`${controlLabel} move up`} disabled={index === 0} onClick={() => onMove(curve.curveId, "up")}>
                ↑
              </button>
              <button type="button" aria-label={`${controlLabel} move down`} disabled={index === curves.length - 1} onClick={() => onMove(curve.curveId, "down")}>
                ↓
              </button>
            </div>
          );
        })}
      </section>

      <section hidden={activeTab !== "labels"} aria-label="Analysis labels">
        <AnalysisLabelEditor
          curves={curves}
          labelMode={labelMode}
          legendItems={legendItems}
          curveOverrides={curveOverrides}
          legendSettings={legendSettings}
          onLabelModeChange={onReportLabelModeChange}
          onAnalysisLabelChange={onAnalysisLabelChange}
          onAnalysisLabelReset={onAnalysisLabelReset}
          onSelectedAnalysisLabelsReset={onSelectedAnalysisLabelsReset}
        />
      </section>
    </div>
  );
}

function AnalysisLabelEditor({
  curves,
  labelMode,
  legendItems,
  curveOverrides,
  legendSettings,
  onLabelModeChange,
  onAnalysisLabelChange,
  onAnalysisLabelReset,
  onSelectedAnalysisLabelsReset
}: {
  curves: Curve[];
  labelMode: GroupingMode;
  legendItems: LegendItem[];
  curveOverrides: Record<string, CurveStyleOverride>;
  legendSettings: ReturnType<typeof useAppStore.getState>["legendSettings"];
  onLabelModeChange: (mode: ReportLegendLabelMode) => void;
  onAnalysisLabelChange: (curveId: string, name: string) => void;
  onAnalysisLabelReset: (curveId: string) => void;
  onSelectedAnalysisLabelsReset: () => void;
}) {
  const projection = buildReportLegendProjection({
    curves,
    legendItems,
    labelMode,
    legendSettings,
    curveOverrides
  });
  const projectedLabels = new Map(projection.items.map((item) => [item.curveId, item.label]));
  const labelCounts = createCurveLabelCounts(curves, labelMode);
  const hasAnalysisLabels = curves.some((curve) => curveOverrides[curve.curveId]?.displayName !== undefined);

  return (
    <section className="report-legend-editor" aria-label="Analysis label editor">
      <div className="report-legend-heading">
        <strong>Analysis Labels</strong>
        <span>{projection.title}</span>
      </div>
      <label className="report-mode-control">
        Default legend mode
        <select
          aria-label="Legend label mode"
          value={legendSettings.reportLabelMode}
          onChange={(event) => onLabelModeChange(event.currentTarget.value as ReportLegendLabelMode)}
        >
          <option value="autoCompact">Auto compact</option>
          <option value="full">Full labels</option>
        </select>
      </label>
      <button type="button" className="compact-button" disabled={!hasAnalysisLabels} onClick={onSelectedAnalysisLabelsReset}>
        Reset selected labels
      </button>
      <div className="report-legend-rows">
        {curves.map((curve) => {
          const label = formatCurveLabel(curve, labelMode);
          const sourceSuffix = formatCurveSourceSuffix(curve);
          const controlLabel = createCurveControlLabel(label, sourceSuffix, labelCounts);
          const customName = curveOverrides[curve.curveId]?.displayName ?? legendSettings.reportNameOverrides[curve.curveId] ?? "";
          const defaultName = projectedLabels.get(curve.curveId) ?? label;

          return (
            <div className="report-legend-row" key={curve.curveId}>
              <span className="curve-label" title={sourceSuffix}>
                {label}
                <small>{sourceSuffix}</small>
              </span>
              <input
                type="text"
                aria-label={`${controlLabel} analysis label`}
                value={customName}
                placeholder={defaultName}
                onChange={(event) => onAnalysisLabelChange(curve.curveId, event.currentTarget.value)}
              />
              <button
                type="button"
                className="field-reset-button"
                aria-label={`${controlLabel} analysis label reset`}
                title="Reset analysis label"
                disabled={!customName}
                onClick={() => onAnalysisLabelReset(curve.curveId)}
              >
                ↺
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function createCurveLabelCounts(curves: Curve[], labelMode: GroupingMode) {
  const counts = new Map<string, number>();
  curves.forEach((curve) => {
    const label = formatCurveLabel(curve, labelMode);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });
  return counts;
}

function createCurveControlLabel(label: string, sourceSuffix: string, labelCounts: Map<string, number>) {
  return (labelCounts.get(label) ?? 0) > 1 ? `${label} ${sourceSuffix}` : label;
}

function createDefaultEntityColorMap(entities: Array<{ id: string }>) {
  return Object.fromEntries(entities.map((entity, index) => [entity.id, defaultChartColors[index % defaultChartColors.length]]));
}

function getCurveDefaultColor(
  curve: Curve,
  styleRules: ReturnType<typeof useAppStore.getState>["styleRules"],
  specimenDefaultColors: Record<string, string>,
  reagentDefaultColors: Record<string, string>
) {
  if (styleRules.colorBy === "specimen") {
    return styleRules.specimenColors[curve.specimenId] ?? specimenDefaultColors[curve.specimenId] ?? defaultChartColors[0];
  }

  return styleRules.reagentColors[curve.reagentId] ?? reagentDefaultColors[curve.reagentId] ?? defaultChartColors[0];
}

function getCurveDefaultLineType(curve: Curve, styleRules: ReturnType<typeof useAppStore.getState>["styleRules"]): LineType {
  if (styleRules.lineTypeBy === "specimen") {
    return styleRules.specimenLineTypes[curve.specimenId] ?? "solid";
  }

  return styleRules.reagentLineTypes[curve.reagentId] ?? "solid";
}

function getCurveDefaultMarkerType(curve: Curve, styleRules: ReturnType<typeof useAppStore.getState>["styleRules"]): MarkerType {
  if (styleRules.markerBy === "specimen") {
    return styleRules.specimenMarkerTypes[curve.specimenId] ?? "none";
  }

  return styleRules.reagentMarkerTypes[curve.reagentId] ?? "none";
}

function getCurveOverrideStatus(override: CurveStyleOverride | undefined) {
  const sources = Object.values(override?.fieldSources ?? {});
  if (sources.length === 0) {
    return { kind: "base", label: "기준값" };
  }

  const hasCustom = sources.includes("custom");
  const hasPreset = sources.includes("preset");
  if (hasCustom && hasPreset) {
    return { kind: "mixed", label: "Custom/Preset" };
  }
  if (hasCustom) {
    return { kind: "custom", label: "Custom" };
  }
  return { kind: "preset", label: "Preset" };
}

function formatGroupingTarget(target: StyleGroupingTarget) {
  return target === "reagent" ? "시약별" : "검체별";
}

function normalizeHexColor(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/iu);
  if (!match) return null;

  const hex = match[1].toLowerCase();
  if (hex.length === 3) {
    return `#${hex.split("").map((character) => `${character}${character}`).join("")}`;
  }

  return `#${hex}`;
}

function isSixDigitHexColor(value: string) {
  return /^#?[0-9a-f]{6}$/iu.test(value.trim());
}

function ScaleAxisControl({
  axis,
  label,
  state,
  autoDomain,
  onModeChange,
  onFixedValueChange,
  onPresetValueChange
}: {
  axis: AxisId;
  label: string;
  state: AxisScaleState;
  autoDomain: { min: number; max: number } | null;
  onModeChange: (axis: AxisId, mode: ScaleMode) => void;
  onFixedValueChange: (axis: AxisId, bound: "min" | "max", value: string) => void;
  onPresetValueChange: (axis: AxisId, preset: ScalePresetId, field: "label" | "min" | "max", value: string) => void;
}) {
  const fixedInvalid = state.mode === "fixed" && !isValidFixedScale(state);
  const autoMin = autoDomain ? formatDomainValue(autoDomain.min) : "";
  const autoMax = autoDomain ? formatDomainValue(autoDomain.max) : "";
  const preset1Ready = isScalePresetConfigured(state.preset1);
  const preset2Ready = isScalePresetConfigured(state.preset2);

  return (
    <section className="scale-axis" aria-label={label}>
      <div className="scale-axis-header">
        <strong>{label}</strong>
      </div>
      <p className="scale-auto-domain">
        Auto range: {autoDomain ? `${autoMin} - ${autoMax}` : "선택된 데이터 없음"}
      </p>
      <div className="scale-mode-grid" role="radiogroup" aria-label={`${label} scale mode`}>
        <ScaleModeButton label="Auto" active={state.mode === "auto"} onClick={() => onModeChange(axis, "auto")} />
        <ScaleModeButton label="Fixed" active={state.mode === "fixed"} onClick={() => onModeChange(axis, "fixed")} />
        <ScaleModeButton
          label={state.preset1?.label?.trim() || "P1"}
          active={state.mode === "preset1"}
          disabled={!preset1Ready}
          onClick={() => onModeChange(axis, "preset1")}
        />
        <ScaleModeButton
          label={state.preset2?.label?.trim() || "P2"}
          active={state.mode === "preset2"}
          disabled={!preset2Ready}
          onClick={() => onModeChange(axis, "preset2")}
        />
      </div>
      {state.mode === "fixed" && (
        <>
          <div className="fixed-scale-grid">
            <label>
              Min
              <input
                type="number"
                value={state.fixedMin}
                placeholder={autoMin}
                onChange={(event) => onFixedValueChange(axis, "min", event.currentTarget.value)}
              />
            </label>
            <label>
              Max
              <input
                type="number"
                value={state.fixedMax}
                placeholder={autoMax}
                onChange={(event) => onFixedValueChange(axis, "max", event.currentTarget.value)}
              />
            </label>
          </div>
          <button
            type="button"
            className="scale-fill-button"
            disabled={!autoDomain}
            onClick={() => {
              onFixedValueChange(axis, "min", autoMin);
              onFixedValueChange(axis, "max", autoMax);
            }}
          >
            현재 Auto값 적용
          </button>
        </>
      )}
      <div className="scale-preset-editor" aria-label={`${label} preset editor`}>
        <ScalePresetEditor
          axis={axis}
          presetId="preset1"
          fallbackLabel="P1"
          state={state}
          onPresetValueChange={onPresetValueChange}
        />
        <ScalePresetEditor
          axis={axis}
          presetId="preset2"
          fallbackLabel="P2"
          state={state}
          onPresetValueChange={onPresetValueChange}
        />
      </div>
      {state.mode === "preset1" && !preset1Ready && <p>Preset P1에는 숫자 min &lt; max가 필요합니다.</p>}
      {state.mode === "preset2" && !preset2Ready && <p>Preset P2에는 숫자 min &lt; max가 필요합니다.</p>}
      {fixedInvalid && <p className="error-text">숫자 min &lt; max가 필요합니다.</p>}
    </section>
  );
}

function ScalePresetEditor({
  axis,
  presetId,
  fallbackLabel,
  state,
  onPresetValueChange
}: {
  axis: AxisId;
  presetId: ScalePresetId;
  fallbackLabel: string;
  state: AxisScaleState;
  onPresetValueChange: (axis: AxisId, preset: ScalePresetId, field: "label" | "min" | "max", value: string) => void;
}) {
  const preset = state[presetId] ?? { label: fallbackLabel, min: "", max: "" };

  return (
    <div className="scale-preset-row">
      <input
        type="text"
        aria-label={`${axis} ${fallbackLabel} label`}
        value={preset.label}
        onChange={(event) => onPresetValueChange(axis, presetId, "label", event.currentTarget.value)}
      />
      <input
        type="number"
        aria-label={`${axis} ${fallbackLabel} min`}
        placeholder="min"
        value={preset.min}
        onChange={(event) => onPresetValueChange(axis, presetId, "min", event.currentTarget.value)}
      />
      <input
        type="number"
        aria-label={`${axis} ${fallbackLabel} max`}
        placeholder="max"
        value={preset.max}
        onChange={(event) => onPresetValueChange(axis, presetId, "max", event.currentTarget.value)}
      />
    </div>
  );
}

function ScaleModeButton({
  label,
  active,
  disabled,
  onClick
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" aria-pressed={active} className={active ? "is-active" : ""} disabled={disabled} onClick={onClick}>
      {label}
    </button>
  );
}

function isValidFixedScale(state: AxisScaleState) {
  const min = Number(state.fixedMin);
  const max = Number(state.fixedMax);
  return state.fixedMin.trim() !== "" && state.fixedMax.trim() !== "" && Number.isFinite(min) && Number.isFinite(max) && min < max;
}

function formatDomainValue(value: number) {
  if (value === 0) return "0";
  const absValue = Math.abs(value);
  if (absValue >= 0.001 && absValue < 100000) {
    return Number(value.toPrecision(6)).toString();
  }
  return value.toExponential(3);
}
