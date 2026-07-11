import { useState } from "react";
import { saveActiveAnalysis } from "../analysis/saveAnalysisWorkflow";
import { useAppStore } from "../app/appStore";

export function AnalysisWorkspaceRecovery({ onRetry }: { onRetry: () => void }) {
  const dataset = useAppStore((state) => state.dataset);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function saveAnalysis() {
    setBusy(true);
    setMessage(null);
    const result = await saveActiveAnalysis();
    setMessage(
      result.status === "saved"
        ? `Saved ${result.fileName}.`
        : result.status === "changed"
          ? "파일 snapshot은 저장했지만 저장 중 변경된 내용이 있어 이후 변경 있음 상태를 유지합니다."
          : result.message
    );
    setBusy(false);
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
