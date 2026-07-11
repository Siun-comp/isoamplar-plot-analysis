import { useEffect, useId, useRef, useState } from "react";
import { useAppStore } from "../app/appStore";
import { PasteImportPanel } from "./PasteImportPanel";
import { WarningInspector } from "./WarningInspector";

type PendingReplaceFile = {
  file: File;
  analysisId: string;
};

export function DataImportPanel() {
  const confirmationTitleId = useId();
  const primaryInputRef = useRef<HTMLInputElement>(null);
  const analysisInputRef = useRef<HTMLInputElement>(null);
  const confirmationDialogRef = useRef<HTMLDialogElement>(null);
  const confirmationCancelRef = useRef<HTMLButtonElement>(null);
  const restorePrimaryFocusRef = useRef(false);
  const activeAnalysisId = useAppStore((state) => state.activeAnalysisId);
  const dataset = useAppStore((state) => state.dataset);
  const dirty = useAppStore((state) => state.dirty);
  const importStatus = useAppStore((state) => state.importStatus);
  const importError = useAppStore((state) => state.importError);
  const importFile = useAppStore((state) => state.importFile);
  const importFileWithMode = useAppStore((state) => state.importFileWithMode);
  const appendFile = useAppStore((state) => state.appendFile);
  const openAnalysisFile = useAppStore((state) => state.openAnalysisFile);
  const [pendingReplaceFile, setPendingReplaceFile] = useState<PendingReplaceFile | null>(null);
  const busy = importStatus === "importing";

  useEffect(() => {
    setPendingReplaceFile((pending) => (pending && pending.analysisId !== activeAnalysisId ? null : pending));
  }, [activeAnalysisId]);

  useEffect(() => {
    const dialog = confirmationDialogRef.current;
    if (!dialog) return;
    let focusTimer: number | undefined;
    if (pendingReplaceFile && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
      focusTimer = window.setTimeout(() => {
        if (dialog.open) confirmationCancelRef.current?.focus();
      }, 0);
    } else if (!pendingReplaceFile) {
      if (dialog.open) {
        if (typeof dialog.close === "function") dialog.close();
        else dialog.removeAttribute("open");
      }
      if (restorePrimaryFocusRef.current) {
        restorePrimaryFocusRef.current = false;
        focusTimer = window.setTimeout(() => primaryInputRef.current?.focus(), 0);
      }
    }
    return () => {
      if (focusTimer !== undefined) window.clearTimeout(focusTimer);
    };
  }, [pendingReplaceFile]);

  function handlePrimaryFile(file: File) {
    if (dirty) {
      setPendingReplaceFile({ file, analysisId: activeAnalysisId });
      return;
    }
    void importFile(file);
  }

  function clearPendingReplace() {
    restorePrimaryFocusRef.current = true;
    setPendingReplaceFile(null);
  }

  function importPendingReplace(mode: "replace" | "newTab") {
    if (!pendingReplaceFile) return;
    const { file, analysisId } = pendingReplaceFile;
    setPendingReplaceFile(null);
    void importFileWithMode(file, mode, analysisId);
  }

  return (
    <section className="import-panel" aria-labelledby="import-title">
      <div>
        <h2 id="import-title">데이터 가져오기</h2>
        <p>원본 Excel은 첫 번째 시트만 읽고, 모든 데이터는 브라우저 안에서 처리합니다.</p>
      </div>
      <div className="import-actions">
        <label className={`file-button ${busy ? "is-disabled" : ""}`} aria-disabled={busy}>
          원본 데이터 열기
          <input
            ref={primaryInputRef}
            data-testid="original-data-input"
            className="file-input"
            type="file"
            disabled={busy}
            accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) handlePrimaryFile(file);
              event.currentTarget.value = "";
            }}
          />
        </label>
        <label className={`file-button ${!dataset || busy ? "is-disabled" : ""}`} aria-disabled={!dataset || busy}>
          Excel 추가
          <input
            className="file-input"
            data-testid="append-excel-input"
            type="file"
            disabled={!dataset || busy}
            accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) void appendFile(file);
              event.currentTarget.value = "";
            }}
          />
        </label>
        <PasteImportPanel disabled={busy} />
        <span className="import-action-separator" aria-hidden="true" />
        <label className={`file-button ${busy ? "is-disabled" : ""}`} aria-disabled={busy}>
          저장한 분석 열기
          <input
            ref={analysisInputRef}
            data-testid="analysis-restore-input"
            className="file-input"
            type="file"
            disabled={busy}
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) void openAnalysisFile(file);
              event.currentTarget.value = "";
            }}
          />
        </label>
      </div>

      <div className="import-summary" aria-live="polite">
        {importStatus === "idle" && <span>가져오기 전</span>}
        {importStatus === "importing" && <span>읽는 중</span>}
        {importStatus === "error" && <span className="error-text">{importError}</span>}
        {dataset && (
          <span>
            {dataset.sourceFileName} · 곡선 {dataset.curves.length}개 · 경고 {dataset.warnings.length}개
          </span>
        )}
        {dataset && importError && importStatus !== "error" && <span className="error-text">{importError}</span>}
      </div>
      {dataset && <WarningInspector warnings={dataset.warnings} />}
      <dialog
        ref={confirmationDialogRef}
        className="confirmation-panel"
        role="alertdialog"
        aria-labelledby={confirmationTitleId}
        onCancel={(event) => {
          event.preventDefault();
          clearPendingReplace();
        }}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          clearPendingReplace();
        }}
      >
        {pendingReplaceFile && (
          <>
          <h3 id={confirmationTitleId}>Unsaved analysis</h3>
          <p>
            현재 분석에 저장되지 않은 변경사항이 있습니다. {pendingReplaceFile.file.name} 파일을 현재 탭에 대체하거나 새 분석
            탭으로 열 수 있습니다.
          </p>
          <div className="confirmation-actions">
            <button
              ref={confirmationCancelRef}
              type="button"
              aria-label="Cancel file replace"
              autoFocus
              onClick={clearPendingReplace}
            >
              Cancel
            </button>
            <button type="button" aria-label="Replace current analysis" onClick={() => importPendingReplace("replace")}>
              현재 분석 대체
            </button>
            <button type="button" aria-label="Open file as new analysis" onClick={() => importPendingReplace("newTab")}>
              새 분석으로 열기
            </button>
          </div>
          </>
        )}
      </dialog>
    </section>
  );
}
