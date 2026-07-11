import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useAppStore } from "../app/appStore";
import { saveActiveAnalysis } from "../analysis/saveAnalysisWorkflow";

export function AnalysisTabs() {
  const confirmationTitleId = "analysis-close-confirmation-title";
  const confirmationDialogRef = useRef<HTMLDialogElement>(null);
  const confirmationCancelRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const restoreCloseFocusRef = useRef(false);
  const activeAnalysisId = useAppStore((state) => state.activeAnalysisId);
  const analysisOrder = useAppStore((state) => state.analysisOrder);
  const analyses = useAppStore((state) => state.analyses);
  const analysisName = useAppStore((state) => state.analysisName);
  const dirty = useAppStore((state) => state.dirty);
  const dataset = useAppStore((state) => state.dataset);
  const selection = useAppStore((state) => state.selection);
  const lastSavedAtIso = useAppStore((state) => state.lastSavedAtIso);
  const saveStatus = useAppStore((state) => state.saveStatus);
  const activeExportJob = useAppStore((state) => state.activeExportJob);
  const createAnalysis = useAppStore((state) => state.createAnalysis);
  const switchAnalysis = useAppStore((state) => state.switchAnalysis);
  const renameAnalysis = useAppStore((state) => state.renameAnalysis);
  const closeAnalysis = useAppStore((state) => state.closeAnalysis);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingCloseId, setPendingCloseId] = useState<string | null>(null);
  const [savingClose, setSavingClose] = useState(false);

  useEffect(() => {
    const dialog = confirmationDialogRef.current;
    if (!dialog) return;
    let focusTimer: number | undefined;
    if (pendingCloseId && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
      focusTimer = window.setTimeout(() => confirmationCancelRef.current?.focus(), 0);
    } else if (!pendingCloseId && dialog.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
      if (restoreCloseFocusRef.current) {
        restoreCloseFocusRef.current = false;
        focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
      }
    }
    return () => {
      if (focusTimer !== undefined) window.clearTimeout(focusTimer);
    };
  }, [pendingCloseId]);

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
    setMessage(null);
    setPendingCloseId(didClose ? null : analysisId);
  }

  function cancelPendingClose() {
    restoreCloseFocusRef.current = true;
    setPendingCloseId(null);
    setMessage(null);
  }

  function discardAndClosePendingAnalysis() {
    if (!pendingCloseId) return;
    const didClose = closeAnalysis(pendingCloseId, { force: true });
    setPendingCloseId(didClose ? null : pendingCloseId);
    setMessage(didClose ? null : "Analysis could not be closed.");
  }

  async function saveCurrentAnalysis() {
    setMessage(null);
    await saveActiveAnalysis();
  }

  async function saveAndClosePendingAnalysis() {
    if (!pendingCloseId) return;
    const state = useAppStore.getState();
    if (state.activeAnalysisId !== pendingCloseId || !state.dataset || !state.selection) {
      setMessage("Only the active analysis with imported data can be saved before closing.");
      return;
    }

    setSavingClose(true);
    setMessage(null);
    try {
      const saveResult = await saveActiveAnalysis();
      if (saveResult.status !== "saved") {
        setMessage(
          saveResult.status === "changed"
            ? "파일 snapshot은 저장했지만 저장 중 변경된 내용이 있어 현재 분석을 닫지 않았습니다."
            : saveResult.message
        );
        return;
      }
      const didClose = useAppStore.getState().closeAnalysis(pendingCloseId, { force: true });
      setPendingCloseId(didClose ? null : pendingCloseId);
      setMessage(didClose ? null : "Analysis could not be closed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Analysis XLSX export failed.");
    } finally {
      setSavingClose(false);
    }
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
          새 분석
        </button>
      </div>

      <div className="analysis-name-row">
        <label htmlFor="analysis-name">분석 이름</label>
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
        <div className="analysis-save-summary" aria-live="polite">
          <span className={dirty ? "dirty-status is-dirty" : "dirty-status"}>
            {!dataset ? "데이터 없음" : dirty ? "저장 이후 변경 있음" : "저장됨"}
          </span>
          <small>{formatSaveStatus(dataset !== null, dirty, saveStatus, lastSavedAtIso)}</small>
          <small title="가져온 전체 데이터(미선택·숨김 포함)와 분석 설정을 저장하는 복원용 Analysis XLSX 파일">
            Analysis XLSX 복원 파일: 가져온 전체 데이터(미선택·숨김 포함)와 분석 설정 저장
          </small>
        </div>
        <button
          type="button"
          className="analysis-save-button"
          disabled={!dataset || !selection || activeExportJob !== null}
          onClick={() => void saveCurrentAnalysis()}
        >
          분석 저장
        </button>
        <button
          ref={closeButtonRef}
          type="button"
          className="analysis-active-close"
          aria-label={`${analysisName.trim() || "이름 없는 분석"} 닫기`}
          onClick={() => handleCloseAnalysis(activeAnalysisId)}
        >
          닫기
        </button>
      </div>
      {message && (
        <p className="analysis-tab-message" role="status">
          {message}
        </p>
      )}
      <dialog
        ref={confirmationDialogRef}
        className="confirmation-panel"
        role="alertdialog"
        aria-labelledby={confirmationTitleId}
        onCancel={(event) => {
          event.preventDefault();
          if (savingClose) return;
          cancelPendingClose();
        }}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          if (savingClose) return;
          cancelPendingClose();
        }}
      >
        {pendingCloseId && (
          <>
          <h3 id={confirmationTitleId}>저장하지 않은 분석</h3>
          <p>현재 분석에 저장되지 않은 변경사항이 있습니다. 닫기 전에 Analysis XLSX로 저장하거나 저장하지 않고 닫을 수 있습니다.</p>
          <div className="confirmation-actions">
            <button ref={confirmationCancelRef} type="button" disabled={savingClose} onClick={cancelPendingClose}>
              취소
            </button>
            <button
              type="button"
              aria-label="Analysis XLSX 저장 후 닫기"
              disabled={savingClose || !dataset || !selection}
              onClick={() => void saveAndClosePendingAnalysis()}
            >
              Analysis XLSX 저장 후 닫기
            </button>
            <button type="button" disabled={savingClose} onClick={discardAndClosePendingAnalysis}>
              저장하지 않고 닫기
            </button>
          </div>
          </>
        )}
      </dialog>
    </section>
  );
}

function createTabId(analysisId: string) {
  return `analysis-tab-${analysisId}`;
}

function formatSaveStatus(
  hasDataset: boolean,
  dirty: boolean,
  saveStatus: ReturnType<typeof useAppStore.getState>["saveStatus"],
  lastSavedAtIso: string | null
) {
  if (!hasDataset) return "저장할 분석 데이터 없음";
  if (saveStatus === "saving") return "저장 중...";
  if (saveStatus === "error") return "저장 실패 · 현재 분석은 유지됨";
  if (!lastSavedAtIso && saveStatus === "saved") return "저장한 분석에서 열림 · 이후 변경 없음";
  if (!lastSavedAtIso) return "마지막 저장 없음 · 이후 변경 있음";
  const time = new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(
    new Date(lastSavedAtIso)
  );
  return dirty ? `마지막 저장 ${time} · 이후 변경 있음` : `마지막 저장 ${time} · 저장됨`;
}
