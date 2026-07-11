import { useState } from "react";
import { createAnalysisState } from "../analysis/analysisState";
import { createAnalysisWorkbookFileName, exportAnalysisWorkbookBlob } from "../analysis/analysisWorkbook";
import { useAppStore } from "../app/appStore";
import { downloadBlob } from "../chart/exportChart";

export function AnalysisWorkspaceRecovery({ onRetry }: { onRetry: () => void }) {
  const dataset = useAppStore((state) => state.dataset);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function saveAnalysis() {
    const snapshot = useAppStore.getState();
    if (!snapshot.dataset || !snapshot.selection) return;
    setBusy(true);
    setMessage(null);
    try {
      const nextExportCounter = snapshot.exportCounter + 1;
      const analysisState = createAnalysisState({
        analysisId: snapshot.activeAnalysisId,
        analysisName: snapshot.analysisName,
        dataset: snapshot.dataset,
        selection: snapshot.selection,
        searchQuery: snapshot.searchQuery,
        selectionFilter: snapshot.selectionFilter,
        chartScale: snapshot.chartScale,
        styleRules: snapshot.styleRules,
        curveOverrides: snapshot.curveOverrides,
        legendSettings: snapshot.legendSettings,
        exportSettings: snapshot.exportSettings,
        exportCounter: nextExportCounter,
        importFileName: snapshot.importFileName,
        sourceFiles: snapshot.sourceFiles,
        dirty: snapshot.dirty
      });
      const blob = await exportAnalysisWorkbookBlob(analysisState);
      const fileName = createAnalysisWorkbookFileName(snapshot.exportCounter, new Date(), snapshot.analysisName);
      downloadBlob(blob, fileName);
      const completion = useAppStore.getState().markAnalysisSaveSuccess({
        analysisId: snapshot.activeAnalysisId,
        runtimeInstanceId: snapshot.runtimeInstanceId,
        expectedRevision: snapshot.revision,
        savedExportCounter: nextExportCounter,
        message: `Saved ${fileName}.`
      });
      setMessage(completion === "saved" ? `Saved ${fileName}.` : "파일은 저장했지만 분석이 변경되어 Unsaved 상태를 유지합니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Analysis XLSX export failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="workspace-error-panel" role="alert">
      <h2>분석 작업공간을 표시하지 못했습니다</h2>
      <p>현재 분석 데이터는 유지되었습니다. 작업공간을 다시 시도하거나 Analysis XLSX로 저장한 뒤 다른 탭을 사용할 수 있습니다.</p>
      <div className="workspace-error-actions">
        <button type="button" onClick={onRetry}>작업공간 다시 시도</button>
        <button type="button" disabled={!dataset || busy} onClick={() => void saveAnalysis()}>Analysis XLSX 저장</button>
      </div>
      {message && <p className="error-text" aria-live="polite">{message}</p>}
    </section>
  );
}
