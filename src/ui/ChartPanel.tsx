import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useAppStore } from "../app/appStore";
import { buildPcrChartOption } from "../chart/chartConfig";
import { hasVisibleCurveWarning } from "../chart/chartScale";
import type { ChartBoxZoomRejectReason, ChartHoverReadout, ChartZoomBounds } from "../chart/ChartView";
import { getMatchedCurveIds } from "../selection/searchCurves";
import { CustomLegend } from "./CustomLegend";

const LazyChartView = lazy(() => import("../chart/ChartView").then((module) => ({ default: module.ChartView })));

export function ChartPanel() {
  const dataset = useAppStore((state) => state.dataset);
  const selection = useAppStore((state) => state.selection);
  const chartScale = useAppStore((state) => state.chartScale);
  const chartScaleReturnStack = useAppStore((state) => state.chartScaleReturnStack);
  const styleRules = useAppStore((state) => state.styleRules);
  const curveOverrides = useAppStore((state) => state.curveOverrides);
  const legendSettings = useAppStore((state) => state.legendSettings);
  const searchQuery = useAppStore((state) => state.searchQuery);
  const setSelectionFilter = useAppStore((state) => state.setSelectionFilter);
  const setCurvesSelected = useAppStore((state) => state.setCurvesSelected);
  const applyBoxZoomScale = useAppStore((state) => state.applyBoxZoomScale);
  const returnFromBoxZoom = useAppStore((state) => state.returnFromBoxZoom);
  const resetScaleToAuto = useAppStore((state) => state.resetScaleToAuto);
  const applyStylePreset = useAppStore((state) => state.applyStylePreset);
  const undoLastPreset = useAppStore((state) => state.undoLastPreset);
  const canUndoPreset = useAppStore((state) => Boolean(state.lastPresetUndo));
  const [hoverReadout, setHoverReadout] = useState<ChartHoverReadout | null>(null);
  const [hoveredCurveId, setHoveredCurveId] = useState<string | null>(null);
  const [boxZoomEnabled, setBoxZoomEnabled] = useState(false);
  const [boxZoomMessage, setBoxZoomMessage] = useState("Box zoom off.");
  const buildResult = buildPcrChartOption({
    dataset,
    selectedCurveIds: selection?.selectedCurveIds ?? new Set<string>(),
    orderedCurveIds: selection?.orderedCurveIds,
    scale: chartScale,
    labelMode: selection?.groupingMode,
    styleRules,
    curveOverrides,
    legendSettings,
    highlightedCurveId: hoveredCurveId
  });
  const selectedCount = buildResult.visibleCurves.length;
  const selectedCurveIds = buildResult.visibleCurves.map((curve) => curve.curveId);
  const matchedSearchCurveIds = useMemo(
    () => (dataset ? getMatchedCurveIds(dataset, searchQuery) : new Set<string>()),
    [dataset, searchQuery]
  );
  const searchRetainedCurveIds = selectedCurveIds.filter((curveId) => matchedSearchCurveIds.has(curveId));
  const canKeepSearchResults =
    searchQuery.trim().length > 0 && searchRetainedCurveIds.length > 0 && searchRetainedCurveIds.length < selectedCount;
  const readoutFingerprint = buildResult.legendItems
    .map((item) => `${item.curveId}:${item.label}:${item.color}:${item.lineType}:${item.markerType}:${item.lineWidth}`)
    .join("|");
  const handleHoverReadout = useCallback((readout: ChartHoverReadout | null) => {
    if (boxZoomEnabled) return;
    setHoverReadout(readout);
    setHoveredCurveId(readout?.curveId ?? null);
  }, [boxZoomEnabled]);
  const handleLegendHover = useCallback((curveId: string | null) => {
    if (boxZoomEnabled) return;
    setHoveredCurveId(curveId);
  }, [boxZoomEnabled]);
  const handleToggleBoxZoom = useCallback(() => {
    setBoxZoomEnabled((enabled) => {
      const nextEnabled = !enabled;
      setHoverReadout(null);
      setHoveredCurveId(null);
      setBoxZoomMessage(nextEnabled ? "Drag inside the highlighted plot area to apply Fixed X/Y scale." : "Box zoom off.");
      return nextEnabled;
    });
  }, []);
  const handleResetAutoScale = useCallback(() => {
    resetScaleToAuto();
    setBoxZoomEnabled(false);
    setBoxZoomMessage("Auto scale restored.");
  }, [resetScaleToAuto]);
  const handleRestorePreviousScale = useCallback(() => {
    returnFromBoxZoom();
    setBoxZoomEnabled(false);
    setHoverReadout(null);
    setHoveredCurveId(null);
    setBoxZoomMessage("Previous scale restored.");
  }, [returnFromBoxZoom]);
  const handleBoxZoom = useCallback((bounds: ChartZoomBounds) => {
    applyBoxZoomScale({
      xMin: formatZoomScaleValue("x", bounds.xMin),
      xMax: formatZoomScaleValue("x", bounds.xMax),
      yMin: formatZoomScaleValue("y", bounds.yMin),
      yMax: formatZoomScaleValue("y", bounds.yMax)
    });
    setBoxZoomEnabled(false);
    setHoverReadout(null);
    setHoveredCurveId(null);
    setBoxZoomMessage("Fixed X/Y scale applied. Previous scale is available.");
  }, [applyBoxZoomScale]);
  const handleBoxZoomRejected = useCallback((reason: ChartBoxZoomRejectReason) => {
    if (reason === "too-small") {
      setBoxZoomMessage("Select a larger plot area to zoom.");
    } else if (reason === "outside") {
      setBoxZoomMessage("Drag must start and finish inside the highlighted plot area.");
    } else {
      setBoxZoomMessage("The selected plot area could not be converted to scale bounds.");
    }
  }, []);
  const handleKeepSearchResults = useCallback(() => {
    if (!selection) return;
    const curveIdsToClear = [...selection.selectedCurveIds].filter((curveId) => !matchedSearchCurveIds.has(curveId));
    setCurvesSelected(curveIdsToClear, false);
    setSelectionFilter("selected");
  }, [matchedSearchCurveIds, selection, setCurvesSelected, setSelectionFilter]);

  useEffect(() => {
    setHoverReadout(null);
    setHoveredCurveId(null);
    setBoxZoomEnabled(false);
    setBoxZoomMessage("Box zoom off.");
  }, [dataset?.datasetId, readoutFingerprint]);

  useEffect(() => {
    if (selectedCount === 0 && boxZoomEnabled) {
      setBoxZoomEnabled(false);
      setBoxZoomMessage("Box zoom off.");
    }
  }, [boxZoomEnabled, selectedCount]);

  useEffect(() => {
    if (!boxZoomEnabled) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setBoxZoomEnabled(false);
      setBoxZoomMessage("Box zoom cancelled.");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [boxZoomEnabled]);

  return (
    <section className="chart-stage" aria-label="그래프 미리보기">
      <div className="chart-toolstrip" aria-label="Chart navigation tools">
        <button
          type="button"
          className={boxZoomEnabled ? "is-active" : ""}
          aria-pressed={boxZoomEnabled}
          disabled={selectedCount === 0}
          onClick={handleToggleBoxZoom}
          title="Drag inside the highlighted plot area to apply Fixed X/Y scale."
        >
          Box zoom
        </button>
        <button type="button" disabled={chartScaleReturnStack.length === 0} onClick={handleRestorePreviousScale}>
          Previous scale
        </button>
        <button type="button" disabled={!dataset} onClick={handleResetAutoScale}>
          Auto scale
        </button>
        <span className="chart-tool-message" role="status">
          {boxZoomMessage}
        </span>
      </div>
      <div className="chart-canvas-wrap">
        {selectedCount > 0 ? (
          <Suspense fallback={<div className="chart-empty">차트를 준비하는 중입니다.</div>}>
            <LazyChartView
              option={buildResult.option}
              onHoverReadout={handleHoverReadout}
              boxZoomEnabled={boxZoomEnabled}
              onBoxZoom={handleBoxZoom}
              onBoxZoomRejected={handleBoxZoomRejected}
            />
          </Suspense>
        ) : (
          <div className="chart-empty" role="img" aria-label="empty chart">
            <strong>선택된 curve 없음</strong>
            <p>좌측 목록에서 분석할 데이터를 선택하세요.</p>
          </div>
        )}
      </div>
      <ChartReadout readout={hoverReadout} />
      {hasVisibleCurveWarning(selectedCount) && (
        <div className="chart-warning" role="status">
          <span>20개를 초과해 표시 중입니다. 구분이 어려울 수 있습니다.</span>
          <button
            type="button"
            onClick={handleKeepSearchResults}
            disabled={!canKeepSearchResults}
            title="검색 조건과 일치하지 않는 선택 curve를 해제합니다."
          >
            검색 결과만 유지
          </button>
          <button type="button" onClick={() => setCurvesSelected(selectedCurveIds, false)}>
            전체 선택 해제
          </button>
          <button
            type="button"
            onClick={() => applyStylePreset("reagentColorSpecimenLine", selectedCurveIds)}
            title="현재 표시 curve의 개별 스타일을 프리셋으로 덮어씁니다."
          >
            구분 프리셋 적용
          </button>
          {canUndoPreset && (
            <button type="button" onClick={undoLastPreset}>
              프리셋 Undo
            </button>
          )}
        </div>
      )}
      {legendSettings.previewVisible && selectedCount > 0 && (
        <CustomLegend items={buildResult.legendItems} highlightedCurveId={hoveredCurveId} onHoverCurve={handleLegendHover} />
      )}
      {buildResult.scaleIssues.length > 0 && (
        <div className="chart-warning" role="status">
          {buildResult.scaleIssues.map((issue) => issue.message).join(" ")}
        </div>
      )}
      <div className="chart-status">
        {dataset ? `${selectedCount}개 curve 선택됨` : "데이터를 가져온 후 선택한 curve가 여기에 표시됩니다."}
      </div>
    </section>
  );
}

function ChartReadout({ readout }: { readout: ChartHoverReadout | null }) {
  return (
    <div className="chart-readout" aria-live="polite" aria-label="Chart point readout">
      <span className="chart-readout-label">Point</span>
      <span className="chart-readout-series">
        {readout?.color && <span className="chart-readout-swatch" style={{ backgroundColor: readout.color }} aria-hidden="true" />}
        {readout?.seriesName || "-"}
      </span>
      <span>Cycle {readout ? formatReadoutValue(readout.x) : "-"}</span>
      <span>Fluorescence {readout?.y === null || !readout ? "-" : formatReadoutValue(readout.y)}</span>
    </div>
  );
}

function formatReadoutValue(value: number | string) {
  return typeof value === "number" ? Number(value.toPrecision(5)).toString() : value;
}

export function formatZoomScaleValue(_axis: "x" | "y", value: number) {
  if (!Number.isFinite(value)) return "";
  if (Object.is(value, -0) || value === 0) return "0";
  return value.toString();
}
