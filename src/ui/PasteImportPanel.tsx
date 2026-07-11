import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useAppStore } from "../app/appStore";
import {
  isLargePastedDataset,
  parsePastedTable,
  renamePastedDatasetSource,
  type ParsePastedTableSuccess
} from "../data/parsePastedTable";
import type { PasteInputMode } from "../data/types";
import { WarningInspector } from "./WarningInspector";
import { LocalizedErrorBoundary } from "./LocalizedErrorBoundary";

type PasteImportPanelProps = {
  disabled?: boolean;
};

type PastePreview = ParsePastedTableSuccess & {
  sourceText: string;
  inputMode: PasteInputMode;
  specimenLabel: string;
  targetAnalysisId: string;
  targetAnalysisName: string;
  targetRuntimeInstanceId: string;
  targetRevision: number;
  formRevision: number;
};

const previewCurveLimit = 12;
const previewCycleLimit = 10;

export function PasteImportPanel({ disabled = false }: PasteImportPanelProps) {
  const dialogTitleId = useId();
  const dialogDescriptionId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeAnalysisId = useAppStore((state) => state.activeAnalysisId);
  const activeAnalysisName = useAppStore((state) => state.analysisName);
  const activeRuntimeInstanceId = useAppStore((state) => state.runtimeInstanceId);
  const activeRevision = useAppStore((state) => state.revision);
  const sourceFiles = useAppStore((state) => state.sourceFiles);
  const appendPastedDataset = useAppStore((state) => state.appendPastedDataset);
  const openPastedDatasetInNewAnalysis = useAppStore((state) => state.openPastedDatasetInNewAnalysis);
  const [isOpen, setIsOpen] = useState(false);
  const [inputMode, setInputMode] = useState<PasteInputMode>("fullTable");
  const [sourceName, setSourceName] = useState("");
  const [specimenLabel, setSpecimenLabel] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [preview, setPreview] = useState<PastePreview | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [acknowledgedNullWarnings, setAcknowledgedNullWarnings] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [formRevision, setFormRevision] = useState(0);
  const [dialogRecoveryRevision, setDialogRecoveryRevision] = useState(0);

  const stalePreview = Boolean(preview && preview.formRevision !== formRevision);
  const nullWarningCount = useMemo(() => {
    let count = 0;
    for (const warning of preview?.dataset.warnings ?? []) {
      if (warning.code === "EMPTY_FLUORESCENCE_CELL" || warning.code === "NON_NUMERIC_FLUORESCENCE") count += 1;
    }
    return count;
  }, [preview]);
  const canImport = Boolean(
    preview && !stalePreview && sourceName.trim() && (nullWarningCount === 0 || acknowledgedNullWarnings)
  );

  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (!dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    }
    textareaRef.current?.focus();
  }, [dialogRecoveryRevision, isOpen]);

  function openDialog() {
    const pasteCount = sourceFiles.filter((source) => source.sheetName === "Paste").length;
    if (!sourceName.trim()) setSourceName(`Paste import ${pasteCount + 1}`);
    setParseError(null);
    setActionError(null);
    setIsOpen(true);
  }

  function closeDialog() {
    const dialog = dialogRef.current;
    if (dialog?.open && typeof dialog.close === "function") dialog.close();
    else dialog?.removeAttribute("open");
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  function clearDraft() {
    setSourceText("");
    setSpecimenLabel("");
    setPreview(null);
    setParseError(null);
    setActionError(null);
    setAcknowledgedNullWarnings(false);
    setFormRevision((revision) => revision + 1);
    textareaRef.current?.focus();
  }

  function createPreview() {
    const result = parsePastedTable(sourceText, {
      mode: inputMode,
      sourceName,
      specimenLabel
    });
    setActionError(null);
    setAcknowledgedNullWarnings(false);

    if (!result.ok) {
      setPreview(null);
      setParseError(result.error.message);
      return;
    }

    setParseError(null);
    setPreview({
      ...result,
      sourceText,
      inputMode,
      specimenLabel,
      targetAnalysisId: activeAnalysisId,
      targetAnalysisName: activeAnalysisName,
      targetRuntimeInstanceId: activeRuntimeInstanceId,
      targetRevision: activeRevision,
      formRevision
    });
  }

  function importPreview(destination: "append" | "newAnalysis") {
    if (!preview || !canImport) return;
    try {
      const dataset = renamePastedDatasetSource(preview.dataset, sourceName);
      const result =
        destination === "append"
          ? appendPastedDataset(
              dataset,
              preview.targetAnalysisId,
              preview.targetRuntimeInstanceId,
              preview.targetRevision
            )
          : openPastedDatasetInNewAnalysis(
              dataset,
              preview.targetAnalysisId,
              preview.targetRuntimeInstanceId,
              preview.targetRevision
            );

      if (!result.ok) {
        setActionError(result.message);
        return;
      }

      const destinationLabel =
        destination === "append" ? `${preview.targetAnalysisName} 분석` : `${sourceName.trim()} 새 분석`;
      setAnnouncement(
        `${destinationLabel}에 측정 곡선 ${dataset.curves.length}개를 가져왔습니다. 새 곡선은 선택되지 않은 상태입니다.`
      );
      setSourceText("");
      setSpecimenLabel("");
      setSourceName("");
      setPreview(null);
      setAcknowledgedNullWarnings(false);
      setFormRevision(0);
      closeDialog();
    } catch {
      setActionError("붙여넣기 데이터를 가져오는 중 예기치 않은 오류가 발생했습니다. 현재 분석은 변경되지 않았습니다.");
    }
  }

  return (
    <>
      <button ref={triggerRef} type="button" className="paste-import-trigger" disabled={disabled} onClick={openDialog}>
        빠른 붙여넣기
      </button>
      <span className="visually-hidden" aria-live="polite">
        {announcement}
      </span>
      {isOpen && (
        <LocalizedErrorBoundary
          resetKey={`${inputMode}:${formRevision}`}
          fallback={(reset) => (
            <section className="paste-error-panel" role="alert">
              <strong>붙여넣기 입력 화면을 표시하지 못했습니다</strong>
              <p>현재 분석과 입력 원문은 유지되었습니다.</p>
              <button type="button" onClick={() => { setDialogRecoveryRevision((revision) => revision + 1); reset(); }}>다시 시도</button>
              <button type="button" onClick={closeDialog}>붙여넣기 입력 닫기</button>
            </section>
          )}
        >
        <dialog
          ref={dialogRef}
          className="paste-import-dialog"
          aria-labelledby={dialogTitleId}
          aria-describedby={dialogDescriptionId}
          onCancel={(event) => {
            event.preventDefault();
            closeDialog();
          }}
          onClose={() => {
            setIsOpen(false);
            triggerRef.current?.focus();
          }}
        >
          <div className="paste-dialog-header">
            <div>
              <h2 id={dialogTitleId}>소량 표 붙여넣기</h2>
              <p id={dialogDescriptionId}>Excel 범위를 복사해 붙여넣고, 읽기 전용 미리보기를 확인한 뒤 가져옵니다.</p>
            </div>
            <button type="button" className="icon-button" aria-label="붙여넣기 입력 닫기" onClick={closeDialog}>
              ×
            </button>
          </div>

          <div className="paste-dialog-body">
            <fieldset className="paste-mode-fieldset">
              <legend>입력 표 구성</legend>
              <label>
                <input
                  type="radio"
                  name="paste-input-mode"
                  value="fullTable"
                  checked={inputMode === "fullTable"}
                  onChange={() => {
                    setInputMode("fullTable");
                    setFormRevision((revision) => revision + 1);
                  }}
                />
                검체명·시약명 포함
              </label>
              <label>
                <input
                  type="radio"
                  name="paste-input-mode"
                  value="singleSpecimen"
                  checked={inputMode === "singleSpecimen"}
                  onChange={() => {
                    setInputMode("singleSpecimen");
                    setFormRevision((revision) => revision + 1);
                  }}
                />
                한 검체의 시약별 값
              </label>
            </fieldset>

            <div className="paste-input-grid">
              <label>
                가져오기 이름
                <input
                  type="text"
                  value={sourceName}
                  maxLength={120}
                  onChange={(event) => setSourceName(event.currentTarget.value)}
                />
              </label>
              {inputMode === "singleSpecimen" && (
                <label>
                  검체명
                  <input
                    type="text"
                    value={specimenLabel}
                    maxLength={200}
                    onChange={(event) => {
                      setSpecimenLabel(event.currentTarget.value);
                      setFormRevision((revision) => revision + 1);
                    }}
                  />
                </label>
              )}
            </div>

            <label className="paste-source-field">
              표 데이터
              <textarea
                ref={textareaRef}
                value={sourceText}
                rows={8}
                spellCheck={false}
                placeholder={
                  inputMode === "fullTable"
                    ? "1행 검체명 / 2행 시약명 / 3행 이후 fluorescence"
                    : "1행 시약명 / 2행 이후 fluorescence"
                }
                onChange={(event) => {
                  setSourceText(event.currentTarget.value);
                  setFormRevision((revision) => revision + 1);
                }}
              />
            </label>
            <p className="paste-format-note">Tab 구분 표와 단일 열을 지원합니다. Comma/CSV 표는 자동 해석하지 않습니다.</p>

            <div className="paste-primary-actions">
              <button type="button" onClick={createPreview} disabled={!sourceText.trim() || !sourceName.trim()}>
                미리보기 생성
              </button>
              <button type="button" onClick={clearDraft} disabled={!sourceText && !preview}>
                입력 지우기
              </button>
            </div>

            {parseError && (
              <p className="paste-error" role="alert">
                {parseError}
              </p>
            )}
            {preview && (
              <PastePreviewSection
                preview={preview}
                stale={stalePreview}
                nullWarningCount={nullWarningCount}
                acknowledged={acknowledgedNullWarnings}
                onAcknowledgedChange={setAcknowledgedNullWarnings}
              />
            )}
            <div className="paste-status" aria-live="polite">
              {stalePreview && "입력 내용이 변경되었습니다. 미리보기를 다시 생성해야 가져올 수 있습니다."}
              {actionError && <span className="error-text">{actionError}</span>}
            </div>
          </div>

          <div className="paste-dialog-footer">
            <button type="button" onClick={closeDialog}>
              취소
            </button>
            <button type="button" disabled={!canImport} onClick={() => importPreview("append")}>
              현재 분석에 추가
            </button>
            <button type="button" disabled={!canImport} onClick={() => importPreview("newAnalysis")}>
              새 분석으로 열기
            </button>
          </div>
        </dialog>
        </LocalizedErrorBoundary>
      )}
    </>
  );
}

function PastePreviewSection(props: {
  preview: PastePreview;
  stale: boolean;
  nullWarningCount: number;
  acknowledged: boolean;
  onAcknowledgedChange: (acknowledged: boolean) => void;
}) {
  const { preview, stale, nullWarningCount, acknowledged, onAcknowledgedChange } = props;
  const curves = preview.dataset.curves.slice(0, previewCurveLimit);
  const cycles = Array.from({ length: Math.min(preview.dataset.cycleCount, previewCycleLimit) }, (_, index) => index);
  const delimiterLabel = preview.delimiter === "tab" ? "Tab" : "단일 열";

  return (
    <section className={`paste-preview ${stale ? "is-stale" : ""}`} aria-label="붙여넣기 미리보기">
      <div className="paste-preview-summary">
        <strong>미리보기</strong>
        <span>구분 방식 {delimiterLabel}</span>
        <span>행 {preview.summary.rowCount.toLocaleString()}개</span>
        <span>열 {preview.summary.columnCount.toLocaleString()}개</span>
        <span>Cell {preview.summary.cellCount.toLocaleString()}개</span>
        <span>문자 {preview.summary.sourceCharacterCount.toLocaleString()}개</span>
        <span>측정 곡선 {preview.summary.curveCount.toLocaleString()}개</span>
        <span>Cycle {preview.summary.cycleCount.toLocaleString()}개</span>
        <span>예상 최소 작업 메모리 약 {formatMemoryEstimate(preview.summary.estimatedWorkingMemoryBytes)}</span>
        <span>경고 {preview.dataset.warnings.length.toLocaleString()}개</span>
      </div>
      <p className="paste-target">추가 대상: {preview.targetAnalysisName}</p>
      {isLargePastedDataset(preview.dataset) && (
        <p className="paste-large-warning">소량 입력 권장 범위를 넘었습니다. 대량 데이터는 Excel 파일 가져오기가 더 적합합니다.</p>
      )}

      <div className="paste-preview-table-wrap" tabIndex={0} aria-label="읽기 전용 데이터 미리보기 표">
        <table className="paste-preview-table">
          <caption>
            전체 {preview.dataset.curves.length.toLocaleString()}개 곡선 중 {curves.length.toLocaleString()}개, {preview.dataset.cycleCount.toLocaleString()}개 Cycle 중 {cycles.length.toLocaleString()}개 표시
          </caption>
          <thead>
            <tr>
              <th scope="row">검체명</th>
              {curves.map((curve) => (
                <th key={`${curve.curveId}-specimen`} scope="col">
                  {formatPreviewLabel(curve.specimenLabel || "(비어 있음)")}
                </th>
              ))}
            </tr>
            <tr>
              <th scope="row">시약명</th>
              {curves.map((curve) => (
                <th key={`${curve.curveId}-reagent`} scope="col">
                  {formatPreviewLabel(curve.reagentLabel || "(비어 있음)")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cycles.map((cycleIndex) => (
              <tr key={cycleIndex}>
                <th scope="row">{cycleIndex + 1}</th>
                {curves.map((curve) => (
                  <td key={`${curve.curveId}-${cycleIndex}`}>{curve.y[cycleIndex] ?? "빈 값"}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <WarningInspector warnings={preview.dataset.warnings} defaultOpen enableNavigation={false} />
      {nullWarningCount > 0 && (
        <label className="paste-warning-acknowledgement">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => onAcknowledgedChange(event.currentTarget.checked)}
          />
          숫자가 아니거나 비어 있는 값 {nullWarningCount}개를 빈 값으로 가져오며 그래프에는 간격이 생기는 것을 확인했습니다.
        </label>
      )}
    </section>
  );
}

function formatMemoryEstimate(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.ceil(bytes / 1024)).toLocaleString()} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatPreviewLabel(label: string) {
  const limit = 120;
  return label.length <= limit ? label : `${label.slice(0, limit)}…`;
}
