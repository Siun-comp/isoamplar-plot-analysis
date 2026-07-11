import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode, SyntheticEvent } from "react";
import type {
  AxisId,
  AxisScaleIssue,
  AxisScaleResolution,
  AxisScaleState,
  ScaleMode,
  ScalePresetId
} from "../chart/chartScale";
import { isScalePresetConfigured } from "../chart/chartScale";
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
import { createStyleAdvisories, normalizeHexColor, type StyleAdvisories } from "../chart/styleAdvisories";
import { useAppStore } from "../app/appStore";
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
  const analysisName = useAppStore((state) => state.analysisName);
  const dataset = useAppStore((state) => state.dataset);
  const selection = useAppStore((state) => state.selection);
  const styleRules = useAppStore((state) => state.styleRules);
  const curveOverrides = useAppStore((state) => state.curveOverrides);
  const legendSettings = useAppStore((state) => state.legendSettings);
  const exportSettings = useAppStore((state) => state.exportSettings);
  const exportCounter = useAppStore((state) => state.exportCounter);
  const activeExportJob = useAppStore((state) => state.activeExportJob);
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
  const setLegendPreviewVisible = useAppStore((state) => state.setLegendPreviewVisible);
  const setReportLegendLabelMode = useAppStore((state) => state.setReportLegendLabelMode);
  const setExportImageLayout = useAppStore((state) => state.setExportImageLayout);
  const moveCurveOrder = useAppStore((state) => state.moveCurveOrder);
  const beginExportJob = useAppStore((state) => state.beginExportJob);
  const completeExportJob = useAppStore((state) => state.completeExportJob);
  const failExportJob = useAppStore((state) => state.failExportJob);
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
  const styleAdvisories = createStyleAdvisories(chartProjection.legendItems);
  const xAutoDomain = chartProjection.xScale.dataDomain;
  const yAutoDomain = chartProjection.yScale.dataDomain;
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
  const resetCurveStyle = (curveId: string) => {
    resetStyleFields(curveId, curveOverrides[curveId], resetCurveOverrideField);
  };
  const resetSelectedCurveStyles = () => {
    selectedCurves.forEach((curve) => resetStyleFields(curve.curveId, curveOverrides[curve.curveId], resetCurveOverrideField));
  };
  const resetAllCurveStyles = () => {
    Object.entries(curveOverrides).forEach(([curveId, override]) =>
      resetStyleFields(curveId, override, resetCurveOverrideField)
    );
  };

  return (
    <div className="settings-accordion">
      <details open>
        <summary>Scale</summary>
        <ScaleAxisControl
          axis="x"
          label="X axis"
          state={chartScale.x}
          resolution={chartProjection.xScale}
          autoDomain={xAutoDomain}
          onModeChange={setAxisScaleMode}
          onFixedValueChange={setAxisFixedValue}
          onPresetValueChange={setAxisPresetValue}
        />
        <ScaleAxisControl
          axis="y"
          label="Y axis"
          state={chartScale.y}
          resolution={chartProjection.yScale}
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

          <StyleAdvisory advisories={styleAdvisories} />

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
            onResetCurve={resetCurveStyle}
            onResetSelected={resetSelectedCurveStyles}
            onResetAll={resetAllCurveStyles}
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
          analysisName={analysisName}
          selectedCurves={selectedCurves}
          selectedCurveIds={selectedCurveIds}
          orderedCurveIds={orderedCurveIds}
          chartScale={chartScale}
          scaleIssues={chartProjection.scaleIssues}
          labelMode={labelMode}
          styleRules={styleRules}
          curveOverrides={curveOverrides}
          legendSettings={legendSettings}
          exportSettings={exportSettings}
          onExportLayoutChange={setExportImageLayout}
          exportCounter={exportCounter}
          exportMessage={exportMessage}
          activeExportJob={activeExportJob}
          beginExportJob={beginExportJob}
          completeExportJob={completeExportJob}
          failExportJob={failExportJob}
          setExportMessage={setExportMessage}
        />
      </details>
    </div>
  );
}

function ExportControls({
  dataset,
  analysisName,
  selectedCurves,
  selectedCurveIds,
  orderedCurveIds,
  chartScale,
  scaleIssues,
  labelMode,
  styleRules,
  curveOverrides,
  legendSettings,
  exportSettings,
  onExportLayoutChange,
  exportCounter,
  exportMessage,
  activeExportJob,
  beginExportJob,
  completeExportJob,
  failExportJob,
  setExportMessage
}: {
  dataset: ReturnType<typeof useAppStore.getState>["dataset"];
  analysisName: string;
  selectedCurves: Curve[];
  selectedCurveIds: Set<string>;
  orderedCurveIds?: string[];
  chartScale: ReturnType<typeof useAppStore.getState>["chartScale"];
  scaleIssues: AxisScaleIssue[];
  labelMode: GroupingMode;
  styleRules: ReturnType<typeof useAppStore.getState>["styleRules"];
  curveOverrides: ReturnType<typeof useAppStore.getState>["curveOverrides"];
  legendSettings: ReturnType<typeof useAppStore.getState>["legendSettings"];
  exportSettings: ReturnType<typeof useAppStore.getState>["exportSettings"];
  onExportLayoutChange: ReturnType<typeof useAppStore.getState>["setExportImageLayout"];
  exportCounter: number;
  exportMessage: string | null;
  activeExportJob: ReturnType<typeof useAppStore.getState>["activeExportJob"];
  beginExportJob: ReturnType<typeof useAppStore.getState>["beginExportJob"];
  completeExportJob: ReturnType<typeof useAppStore.getState>["completeExportJob"];
  failExportJob: ReturnType<typeof useAppStore.getState>["failExportJob"];
  setExportMessage: (message: string | null) => void;
}) {
  const busy = activeExportJob !== null;
  const csvResult = createPlottedDataCsv({ curves: selectedCurves, labelMode, styleRules, curveOverrides });
  const disabled = selectedCurves.length === 0 || busy;
  const blockingScaleIssues = scaleIssues.filter((issue) => issue.blocksPlotExport);
  const plotImageScaleBlocked = exportSettings.imageLayout !== "legendOnly" && blockingScaleIssues.length > 0;
  const plotScaleMessage = blockingScaleIssues.map((issue) => issue.message).join(" ");

  async function exportImage(type: ImageExportType) {
    if (!dataset) return;
    if (exportSettings.imageLayout !== "legendOnly" && blockingScaleIssues.length > 0) {
      setExportMessage(`Plot image export is blocked. ${plotScaleMessage} Edit Scale settings.`);
      return;
    }
    const job = beginExportJob("file", true);
    if (!job) return;
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
      const fileName = createImageExportFileName(job.reservedCounter, type, new Date(), analysisName);
      downloadBlob(blob, fileName);
      completeExportJob(job, `Saved ${fileName}.`);
    } catch (error) {
      failExportJob(job, error instanceof Error ? error.message : "Image export failed.");
    }
  }

  async function copyPng(layout: ImageExportLayout = exportSettings.imageLayout, successMessage = "Copied PNG image to clipboard.") {
    if (!dataset) return;
    if (layout !== "legendOnly" && blockingScaleIssues.length > 0) {
      setExportMessage(`Plot clipboard export is blocked. ${plotScaleMessage} Edit Scale settings.`);
      return;
    }
    const job = beginExportJob("clipboard", false);
    if (!job) return;
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
      completeExportJob(job, successMessage);
    } catch (error) {
      failExportJob(job, `${error instanceof Error ? error.message : "Clipboard copy failed."} Download PNG instead.`);
    }
  }

  async function exportReportLegend(type: ImageExportType) {
    if (!dataset) return;
    const job = beginExportJob("file", true);
    if (!job) return;
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
      const reportLegend = chart.legendProjection;
      const blob = await exportReportLegendImageBlob({
        items: reportLegend.items,
        type,
        title: reportLegend.title
      });
      const fileName = createImageExportFileName(job.reservedCounter, type, new Date(), `${analysisName}_legend`);
      downloadBlob(blob, fileName);
      completeExportJob(job, `Saved ${fileName}.`);
    } catch (error) {
      failExportJob(job, error instanceof Error ? error.message : "Report legend export failed.");
    }
  }

  async function copyReportLegendPng() {
    if (!dataset) return;
    const job = beginExportJob("clipboard", false);
    if (!job) return;
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
      const reportLegend = chart.legendProjection;
      const blob = await exportReportLegendImageBlob({
        items: reportLegend.items,
        type: "png",
        title: reportLegend.title
      });
      await copyPngBlobToClipboard(blob);
      completeExportJob(job, "Copied report legend PNG to clipboard.");
    } catch (error) {
      failExportJob(job, `${error instanceof Error ? error.message : "Clipboard copy failed."} Download PNG instead.`);
    }
  }

  async function copyReportLegendExcel() {
    if (!dataset) return;
    const job = beginExportJob("clipboard", false);
    if (!job) return;
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
      const reportLegend = chart.legendProjection;
      await copyReportLegendExcelTableToClipboard({
        title: reportLegend.title,
        items: reportLegend.items
      });
      completeExportJob(job, "Copied report legend as Excel cells.");
    } catch (error) {
      failExportJob(
        job,
        `${error instanceof Error ? error.message : "Rich Excel clipboard copy failed."} Use report legend PNG instead.`
      );
    }
  }

  function exportCsv() {
    if (!csvResult.ok) {
      setExportMessage(csvResult.reason);
      return;
    }

    const job = beginExportJob("file", true);
    if (!job) return;
    const fileName = createPlottedDataFileName(job.reservedCounter, new Date(), analysisName);
    const blob = new Blob(["\ufeff", csvResult.csv], { type: "text/csv;charset=utf-8" });
    try {
      downloadBlob(blob, fileName);
      completeExportJob(job, `Saved ${fileName}.`);
    } catch (error) {
      failExportJob(job, error instanceof Error ? error.message : "CSV export failed.");
    }
  }

  return (
    <section className="export-controls" aria-busy={busy}>
      <span className="visually-hidden" aria-live="polite">{busy ? "내보내기 작업 중" : ""}</span>
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
      <button type="button" aria-label="Save PNG" disabled={disabled || plotImageScaleBlocked} onClick={() => void exportImage("png")}>
        PNG 저장
      </button>
      <button type="button" aria-label="Save JPEG" disabled={disabled || plotImageScaleBlocked} onClick={() => void exportImage("jpeg")}>
        JPEG 저장
      </button>
      <button type="button" aria-label="Copy selected layout PNG to clipboard" disabled={disabled || plotImageScaleBlocked} onClick={() => void copyPng()}>
        클립보드 PNG
      </button>
        </div>
        {plotImageScaleBlocked && (
          <p className="error-text" role="status">
            Plot image exports are blocked until the active Scale draft is valid. {plotScaleMessage}
          </p>
        )}
      </section>
      <section className="export-group" aria-label="Legend export">
        <div className="export-group-header export-group-header-stacked">
          <strong>Legend outputs</strong>
          <span>Current legend order and analysis labels are used.</span>
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
      <section className="export-group" aria-label="Data export">
        <div className="export-group-header">
          <strong>Data</strong>
        </div>
        <div className="export-button-grid">
      <button type="button" disabled={busy || !csvResult.ok} onClick={exportCsv}>
        Plotted CSV
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
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyOpenRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({ visibility: "hidden" });

  function positionPanel() {
    const trigger = ref.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;

    const triggerRect = trigger.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const edge = 8;
    const gap = 6;
    const left = Math.min(
      Math.max(edge, triggerRect.right - panelRect.width),
      Math.max(edge, window.innerWidth - panelRect.width - edge)
    );
    const spaceBelow = window.innerHeight - triggerRect.bottom - edge;
    const top = spaceBelow >= panelRect.height + gap
      ? triggerRect.bottom + gap
      : Math.max(edge, triggerRect.top - panelRect.height - gap);
    setPanelStyle({ left, top, visibility: "visible" });
  }

  useLayoutEffect(() => {
    if (open) {
      previouslyOpenRef.current = true;
      positionPanel();
      const frame = requestAnimationFrame(() => {
        panelRef.current
          ?.querySelector<HTMLElement>('input:not([disabled]), button:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')
          ?.focus();
      });
      return () => cancelAnimationFrame(frame);
    } else if (previouslyOpenRef.current) {
      previouslyOpenRef.current = false;
      ref.current?.querySelector<HTMLElement>("summary")?.focus();
    }
  }, [open]);

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      if (
        ref.current?.open &&
        !ref.current.contains(event.target as Node) &&
        !panelRef.current?.contains(event.target as Node)
      ) {
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
    window.addEventListener("resize", positionPanel);
    document.addEventListener("scroll", positionPanel, true);
    window.addEventListener(stylePopoverOpenEvent, closeWhenAnotherPopoverOpens);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", positionPanel);
      document.removeEventListener("scroll", positionPanel, true);
      window.removeEventListener(stylePopoverOpenEvent, closeWhenAnotherPopoverOpens);
    };
  }, [id]);

  function onToggle(event: SyntheticEvent<HTMLDetailsElement>) {
    const nextOpen = event.currentTarget.open;
    setOpen(nextOpen);
    if (nextOpen) {
      window.dispatchEvent(new CustomEvent(stylePopoverOpenEvent, { detail: id }));
    }
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLDetailsElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (ref.current?.open) {
        ref.current.open = false;
        setOpen(false);
      }
    }
  }

  function closePopover() {
    if (ref.current?.open) {
      ref.current.open = false;
      setOpen(false);
    }
  }

  return { id, ref, panelRef, panelStyle, open, onToggle, onKeyDown, closePopover };
}

function ColorPopoverButton({
  label,
  value,
  onCommit,
  onReset,
  resetDisabled = false
}: {
  label: string;
  value: string;
  onCommit: (color: string) => void;
  onReset?: () => void;
  resetDisabled?: boolean;
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
      <summary
        className="style-popover-trigger color-trigger"
        aria-label={`${label} color editor`}
        aria-expanded={popover.open}
        aria-controls={`${popover.id}-panel`}
        tabIndex={0}
      >
        <span className="color-swatch" style={{ backgroundColor: color }} />
      </summary>
      {popover.open && createPortal(<div
        id={`${popover.id}-panel`}
        ref={popover.panelRef}
        className="style-popover-panel color-popover-panel"
        role="dialog"
        aria-label={`${label} color editor options`}
        style={popover.panelStyle}
      >
        <label>
          HEX
          <HexColorInput label={`${label} hex color`} value={color} onCommit={onCommit} />
        </label>
        <label>
          Picker
          <input type="color" aria-label={`${label} color`} value={color} onChange={(event) => onCommit(event.currentTarget.value)} />
        </label>
        {onReset && (
          <button
            type="button"
            className="compact-button"
            disabled={resetDisabled}
            onClick={() => {
              onReset();
              popover.closePopover();
            }}
          >
            기준 색상으로 초기화
          </button>
        )}
      </div>, document.body)}
    </details>
  );
}

function LineMarkerPopoverButton({
  label,
  color,
  lineType,
  markerType,
  onLineTypeChange,
  onMarkerTypeChange,
  onLineTypeReset,
  onMarkerTypeReset,
  lineTypeResetDisabled = false,
  markerTypeResetDisabled = false
}: {
  label: string;
  color: string;
  lineType: LineType;
  markerType: MarkerType;
  onLineTypeChange: (lineType: LineType) => void;
  onMarkerTypeChange: (markerType: MarkerType) => void;
  onLineTypeReset?: () => void;
  onMarkerTypeReset?: () => void;
  lineTypeResetDisabled?: boolean;
  markerTypeResetDisabled?: boolean;
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
      <summary
        className="style-popover-trigger line-marker-trigger"
        aria-label={`${label} line and marker editor`}
        aria-expanded={popover.open}
        aria-controls={`${popover.id}-panel`}
        tabIndex={0}
      >
        <LineMarkerPreview color={safeColor} lineType={lineType} markerType={markerType} />
      </summary>
      {popover.open && createPortal(<div
        id={`${popover.id}-panel`}
        ref={popover.panelRef}
        className="style-popover-panel line-marker-panel"
        role="dialog"
        aria-label={`${label} line and marker editor options`}
        style={popover.panelStyle}
      >
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
          {onLineTypeReset && (
            <button
              type="button"
              className="compact-button line-marker-reset"
              disabled={lineTypeResetDisabled}
              onClick={() => {
                onLineTypeReset();
                popover.closePopover();
              }}
            >
              기준 선으로 초기화
            </button>
          )}
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
          {onMarkerTypeReset && (
            <button
              type="button"
              className="compact-button line-marker-reset"
              disabled={markerTypeResetDisabled}
              onClick={() => {
                onMarkerTypeReset();
                popover.closePopover();
              }}
            >
              기준 마커로 초기화
            </button>
          )}
        </fieldset>
      </div>, document.body)}
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

function StyleAdvisory({ advisories }: { advisories: StyleAdvisories }) {
  const collisionCurveCount = advisories.collisions.reduce((count, items) => count + items.length, 0);
  const largestCollision = advisories.collisions.reduce((largest, items) => Math.max(largest, items.length), 0);
  if (collisionCurveCount === 0 && advisories.lowContrast.length === 0 && advisories.invalidColors.length === 0) return null;

  return (
    <section className="style-advisory" role="status" aria-live="polite" aria-label="스타일 구분 경고">
      <strong>스타일 확인</strong>
      {collisionCurveCount > 0 && (
        <span>
          구분되는 스타일 {advisories.uniqueSignatureCount}/{advisories.totalCount} · 겹치는 곡선 {collisionCurveCount}개 · 최대 동일 그룹 {largestCollision}개: {formatAdvisoryLabels(advisories.collisions.flat())}
        </span>
      )}
      {advisories.lowContrast.length > 0 && (
        <span>
          흰 배경 대비가 3:1 미만인 곡선 {advisories.lowContrast.length}개: {formatAdvisoryLabels(advisories.lowContrast)}
        </span>
      )}
      {advisories.invalidColors.length > 0 && (
        <span>
          대비를 판정할 수 없는 색상 {advisories.invalidColors.length}개: {formatAdvisoryLabels(advisories.invalidColors)}
        </span>
      )}
    </section>
  );
}

function formatAdvisoryLabels(items: LegendItem[]) {
  const labels = items.slice(0, 3).map((item) => item.label);
  return items.length > labels.length ? `${labels.join(", ")} 외 ${items.length - labels.length}개` : labels.join(", ");
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
  const hasSelectedStyleOverrides = curves.some((curve) => hasStyleOverride(overrides[curve.curveId]));

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
        <button type="button" className="compact-button" disabled={!hasSelectedStyleOverrides} onClick={onResetSelected}>
          선택 초기화
        </button>
        <button
          type="button"
          className="compact-button"
          disabled={!Object.values(overrides).some(hasStyleOverride)}
          onClick={onResetAll}
        >
          전체 초기화
        </button>
      </div>
      <div className="style-table-scroll individual-style-scroll">
        <div className="individual-row individual-row-header" aria-hidden="true">
          <span>Curve</span>
          <span>색상</span>
          <span>선 / 마커</span>
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

            return (
              <div className="individual-row" key={curve.curveId}>
                <span className="curve-label" title={`${label} · ${sourceSuffix}`}>
                  {label}
                  <small>{sourceSuffix}</small>
                </span>
                <ColorPopoverButton
                  label={controlLabel}
                  value={colorValue}
                  onCommit={(color) => onOverride(curve.curveId, { color })}
                  onReset={() => onResetField(curve.curveId, "color")}
                  resetDisabled={override?.color === undefined}
                />
                <LineMarkerPopoverButton
                  label={controlLabel}
                  color={colorValue}
                  lineType={lineValue}
                  markerType={markerValue}
                  onLineTypeChange={(lineType) => onOverride(curve.curveId, { lineType })}
                  onMarkerTypeChange={(markerType) => onOverride(curve.curveId, { markerType })}
                  onLineTypeReset={() => onResetField(curve.curveId, "lineType")}
                  onMarkerTypeReset={() => onResetField(curve.curveId, "markerType")}
                  lineTypeResetDisabled={override?.lineType === undefined}
                  markerTypeResetDisabled={override?.markerType === undefined}
                />
                <span className={`style-status style-status-${status.kind}`}>{status.label}</span>
                <button
                  type="button"
                  className="compact-button style-reset-icon"
                  aria-label={`${controlLabel} style reset`}
                  title="Reset style"
                  disabled={!hasStyleOverride(override)}
                  onClick={() => onResetCurve(curve.curveId)}
                >
                  ↺
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
  const legendEditorId = useId();
  const orderTabId = `${legendEditorId}-order-tab`;
  const labelsTabId = `${legendEditorId}-labels-tab`;
  const orderPanelId = `${legendEditorId}-order-panel`;
  const labelsPanelId = `${legendEditorId}-labels-panel`;

  function activateLegendTab(tab: "order" | "labels") {
    setActiveTab(tab);
    document.getElementById(tab === "order" ? orderTabId : labelsTabId)?.focus();
  }

  function onLegendTabKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      activateLegendTab(activeTab === "order" ? "labels" : "order");
    } else if (event.key === "Home") {
      event.preventDefault();
      activateLegendTab("order");
    } else if (event.key === "End") {
      event.preventDefault();
      activateLegendTab("labels");
    }
  }

  return (
    <div className="legend-editor">
      <div className="legend-tabs" role="tablist" aria-label="Legend settings">
        <button
          id={orderTabId}
          type="button"
          role="tab"
          aria-controls={orderPanelId}
          aria-selected={activeTab === "order"}
          tabIndex={activeTab === "order" ? 0 : -1}
          className={activeTab === "order" ? "active" : ""}
          onClick={() => setActiveTab("order")}
          onKeyDown={onLegendTabKeyDown}
        >
          Order
        </button>
        <button
          id={labelsTabId}
          type="button"
          role="tab"
          aria-controls={labelsPanelId}
          aria-selected={activeTab === "labels"}
          tabIndex={activeTab === "labels" ? 0 : -1}
          className={activeTab === "labels" ? "active" : ""}
          onClick={() => setActiveTab("labels")}
          onKeyDown={onLegendTabKeyDown}
        >
          Labels
        </button>
      </div>

      <section
        id={orderPanelId}
        className="legend-order-list"
        role="tabpanel"
        aria-labelledby={orderTabId}
        hidden={activeTab !== "order"}
      >
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

      <section
        id={labelsPanelId}
        role="tabpanel"
        aria-labelledby={labelsTabId}
        hidden={activeTab !== "labels"}
      >
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
  const sources = curveStyleOverrideFields
    .map((field) => override?.fieldSources?.[field])
    .filter((source): source is "custom" | "preset" => source !== undefined);
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

const curveStyleOverrideFields: CurveStyleField[] = ["color", "lineType", "markerType"];

function hasStyleOverride(override: CurveStyleOverride | undefined) {
  return curveStyleOverrideFields.some((field) => override?.[field] !== undefined);
}

function resetStyleFields(
  curveId: string,
  override: CurveStyleOverride | undefined,
  resetField: (curveId: string, field: CurveStyleField) => void
) {
  curveStyleOverrideFields.forEach((field) => {
    if (override?.[field] !== undefined) resetField(curveId, field);
  });
}

function formatGroupingTarget(target: StyleGroupingTarget) {
  return target === "reagent" ? "시약별" : "검체별";
}

function isSixDigitHexColor(value: string) {
  return /^#?[0-9a-f]{6}$/iu.test(value.trim());
}

function ScaleAxisControl({
  axis,
  label,
  state,
  resolution,
  autoDomain,
  onModeChange,
  onFixedValueChange,
  onPresetValueChange
}: {
  axis: AxisId;
  label: string;
  state: AxisScaleState;
  resolution: AxisScaleResolution;
  autoDomain: { min: number; max: number } | null;
  onModeChange: (axis: AxisId, mode: ScaleMode) => void;
  onFixedValueChange: (axis: AxisId, bound: "min" | "max", value: string) => void;
  onPresetValueChange: (axis: AxisId, preset: ScalePresetId, field: "label" | "min" | "max", value: string) => void;
}) {
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
        Selected raw data range: {autoDomain ? `${autoMin} - ${autoMax}` : "선택된 데이터 없음"}
      </p>
      <p className="scale-applied-status">Applied: {formatAppliedScale(resolution)}</p>
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
      {resolution.issue && (
        <p className={resolution.issue.blocksPlotExport ? "error-text" : "warning-text"} role="status">
          {resolution.issue.message}
        </p>
      )}
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

function formatDomainValue(value: number) {
  if (value === 0) return "0";
  const absValue = Math.abs(value);
  if (absValue >= 0.001 && absValue < 100000) {
    return Number(value.toPrecision(6)).toString();
  }
  return value.toExponential(3);
}

function formatAppliedScale(resolution: AxisScaleResolution) {
  if (resolution.applied.mode === "auto") return "Auto";
  const mode = resolution.applied.mode === "fixed" ? "Fixed" : resolution.applied.mode.toUpperCase();
  return `${mode} ${formatDomainValue(resolution.applied.min!)} - ${formatDomainValue(resolution.applied.max!)}`;
}
