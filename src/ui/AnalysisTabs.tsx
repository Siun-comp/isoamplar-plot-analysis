import { useState, type KeyboardEvent } from "react";
import { useAppStore } from "../app/appStore";

const dirtyCloseMessage = "Save this analysis before closing it, or wait for the close confirmation flow.";

export function AnalysisTabs() {
  const activeAnalysisId = useAppStore((state) => state.activeAnalysisId);
  const analysisOrder = useAppStore((state) => state.analysisOrder);
  const analyses = useAppStore((state) => state.analyses);
  const analysisName = useAppStore((state) => state.analysisName);
  const dirty = useAppStore((state) => state.dirty);
  const createAnalysis = useAppStore((state) => state.createAnalysis);
  const switchAnalysis = useAppStore((state) => state.switchAnalysis);
  const renameAnalysis = useAppStore((state) => state.renameAnalysis);
  const closeAnalysis = useAppStore((state) => state.closeAnalysis);
  const [message, setMessage] = useState<string | null>(null);

  function handleCreateAnalysis() {
    const nextId = createAnalysis();
    switchAnalysis(nextId);
    setMessage(null);
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (currentIndex + direction + analysisOrder.length) % analysisOrder.length;
    const nextId = analysisOrder[nextIndex];
    switchAnalysis(nextId);
    document.getElementById(createTabId(nextId))?.focus();
  }

  function handleCloseAnalysis(analysisId: string) {
    const didClose = closeAnalysis(analysisId);
    setMessage(didClose ? null : dirtyCloseMessage);
  }

  return (
    <section className="analysis-tabs" aria-label="Analysis tabs">
      <div className="analysis-tab-toolbar">
        <div className="analysis-tab-strip" role="tablist" aria-label="Open analyses">
          {analysisOrder.map((analysisId, index) => {
            const analysis = analyses[analysisId];
            const isActive = analysisId === activeAnalysisId;
            const title = analysis?.analysisName?.trim() || "Untitled analysis";
            return (
              <button
                key={analysisId}
                id={createTabId(analysisId)}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls="analysis-workspace"
                tabIndex={isActive ? 0 : -1}
                className={`analysis-tab-button ${isActive ? "is-active" : ""}`}
                title={analysis?.dirty ? `${title} - unsaved changes` : title}
                onClick={() => {
                  switchAnalysis(analysisId);
                  setMessage(null);
                }}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
              >
                <span>{title}</span>
                {analysis?.dirty && <span className="dirty-dot" aria-label="unsaved changes" title="Unsaved changes" />}
              </button>
            );
          })}
        </div>
        <button type="button" className="analysis-new-button" onClick={handleCreateAnalysis}>
          New analysis
        </button>
      </div>

      <div className="analysis-name-row">
        <label htmlFor="analysis-name">Analysis name</label>
        <input
          id="analysis-name"
          type="text"
          value={analysisName}
          onChange={(event) => {
            renameAnalysis(activeAnalysisId, event.currentTarget.value);
            setMessage(null);
          }}
          onBlur={(event) => {
            if (event.currentTarget.value.trim() === "") {
              renameAnalysis(activeAnalysisId, "Untitled analysis");
            }
          }}
        />
        <span className={dirty ? "dirty-status is-dirty" : "dirty-status"}>{dirty ? "Unsaved" : "Clean"}</span>
        <button
          type="button"
          className="analysis-active-close"
          aria-label={`Close ${analysisName.trim() || "Untitled analysis"}`}
          onClick={() => handleCloseAnalysis(activeAnalysisId)}
        >
          Close
        </button>
      </div>
      {message && (
        <p className="analysis-tab-message" role="status">
          {message}
        </p>
      )}
    </section>
  );
}

function createTabId(analysisId: string) {
  return `analysis-tab-${analysisId}`;
}
