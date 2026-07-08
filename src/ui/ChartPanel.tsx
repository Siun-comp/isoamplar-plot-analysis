import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useAppStore } from "../app/appStore";
import { buildPcrChartOption } from "../chart/chartConfig";
import { hasVisibleCurveWarning } from "../chart/chartScale";
import type { ChartHoverReadout } from "../chart/ChartView";
import { getMatchedCurveIds } from "../selection/searchCurves";
import { CustomLegend } from "./CustomLegend";

const LazyChartView = lazy(() => import("../chart/ChartView").then((module) => ({ default: module.ChartView })));

export function ChartPanel() {
  const dataset = useAppStore((state) => state.dataset);
  const selection = useAppStore((state) => state.selection);
  const chartScale = useAppStore((state) => state.chartScale);
  const styleRules = useAppStore((state) => state.styleRules);
  const curveOverrides = useAppStore((state) => state.curveOverrides);
  const legendSettings = useAppStore((state) => state.legendSettings);
  const searchQuery = useAppStore((state) => state.searchQuery);
  const setSelectionFilter = useAppStore((state) => state.setSelectionFilter);
  const setCurvesSelected = useAppStore((state) => state.setCurvesSelected);
  const applyStylePreset = useAppStore((state) => state.applyStylePreset);
  const undoLastPreset = useAppStore((state) => state.undoLastPreset);
  const canUndoPreset = useAppStore((state) => Boolean(state.lastPresetUndo));
  const [hoverReadout, setHoverReadout] = useState<ChartHoverReadout | null>(null);
  const buildResult = buildPcrChartOption({
    dataset,
    selectedCurveIds: selection?.selectedCurveIds ?? new Set<string>(),
    orderedCurveIds: selection?.orderedCurveIds,
    scale: chartScale,
    labelMode: selection?.groupingMode,
    styleRules,
    curveOverrides
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
    setHoverReadout(readout);
  }, []);
  const handleKeepSearchResults = useCallback(() => {
    if (!selection) return;
    const curveIdsToClear = [...selection.selectedCurveIds].filter((curveId) => !matchedSearchCurveIds.has(curveId));
    setCurvesSelected(curveIdsToClear, false);
    setSelectionFilter("selected");
  }, [matchedSearchCurveIds, selection, setCurvesSelected, setSelectionFilter]);

  useEffect(() => {
    setHoverReadout(null);
  }, [dataset?.datasetId, readoutFingerprint]);

  return (
    <section className="chart-stage" aria-label="그래프 미리보기">
      <div className="chart-canvas-wrap">
        {selectedCount > 0 ? (
          <Suspense fallback={<div className="chart-empty">차트를 준비하는 중입니다.</div>}>
            <LazyChartView option={buildResult.option} onHoverReadout={handleHoverReadout} />
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
      {legendSettings.previewVisible && selectedCount > 0 && <CustomLegend items={buildResult.legendItems} />}
      {buildResult.scaleIssues.length > 0 && (
        <div className="chart-warning" role="status">
          {buildResult.scaleIssues.map((issue) => issue.message).join(" ")}
        </div>
      )}
      <div className="chart-status">
        {dataset ? `${selectedCount}개 curve 선택됨` : "데이터 업로드 후 선택한 curve가 여기에 표시됩니다."}
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
