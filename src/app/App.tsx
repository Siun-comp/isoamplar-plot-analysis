import { ChartPanel } from "../ui/ChartPanel";
import { AnalysisTabs } from "../ui/AnalysisTabs";
import { DataImportPanel } from "../ui/DataImportPanel";
import { DataSelectionPanel } from "../ui/DataSelectionPanel";
import { SettingsPanel } from "../ui/SettingsPanel";
import { useAppStore } from "./appStore";
import { WarningNavigationProvider } from "../ui/WarningNavigationContext";
import { LocalizedErrorBoundary } from "../ui/LocalizedErrorBoundary";
import { AnalysisWorkspaceRecovery } from "../ui/AnalysisWorkspaceRecovery";

export function App() {
  const groupingMode = useAppStore((state) => state.selection?.groupingMode ?? "reagent");
  const activeAnalysisId = useAppStore((state) => state.activeAnalysisId);
  const runtimeInstanceId = useAppStore((state) => state.runtimeInstanceId);
  const groupingLabel = groupingMode === "reagent" ? "시약별" : "검체별";

  return (
    <WarningNavigationProvider>
    <main className="app-shell" aria-labelledby="app-title">
      <header className="top-bar">
        <div>
          <p className="eyebrow">LAMP plot analysis web app</p>
          <h1 id="app-title">IsoAmplar Plot Analysis</h1>
          <p className="developer-credit">Developer Jang Si Un</p>
        </div>
        <span className="phase-badge">Browser-local analysis</span>
      </header>

      <AnalysisTabs />

      <DataImportPanel />

      <LocalizedErrorBoundary
        resetKey={`${activeAnalysisId}:${runtimeInstanceId}`}
        fallback={(reset) => <AnalysisWorkspaceRecovery onRetry={reset} />}
      >
      <section
        id="analysis-workspace"
        className="workspace"
        role="tabpanel"
        aria-labelledby={`analysis-tab-${activeAnalysisId}`}
      >
        <aside className="panel selection-panel" aria-labelledby="selection-title">
          <div className="panel-header">
            <h2 id="selection-title">데이터 선택</h2>
            <span>{groupingLabel}</span>
          </div>
          <DataSelectionPanel />
        </aside>

        <section className="panel chart-panel" aria-labelledby="chart-title">
          <div className="panel-header">
            <h2 id="chart-title">그래프 미리보기</h2>
            <span>Clean LAMP plot theme</span>
          </div>
          <ChartPanel />
        </section>

        <aside className="panel settings-panel" aria-labelledby="settings-title">
          <div className="panel-header">
            <h2 id="settings-title">설정</h2>
            <span>Scale / Style / Export</span>
          </div>
          <SettingsPanel />
        </aside>
      </section>
      </LocalizedErrorBoundary>
    </main>
    </WarningNavigationProvider>
  );
}
