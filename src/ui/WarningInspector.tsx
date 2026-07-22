import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "../app/appStore";
import type { PcrWarning, WarningHandling } from "../data/types";
import { useWarningNavigation } from "./WarningNavigationContext";

const pageSize = 25;
const sourcePageSize = 25;

export function WarningInspector({
  warnings,
  defaultOpen = false,
  enableNavigation = true
}: {
  warnings: PcrWarning[];
  defaultOpen?: boolean;
  enableNavigation?: boolean;
}) {
  const activeAnalysisId = useAppStore((state) => state.activeAnalysisId);
  const { revealWarning } = useWarningNavigation();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [severity, setSeverity] = useState<"all" | "error" | "warning" | "info">("all");
  const [sourceId, setSourceId] = useState("all");
  const [code, setCode] = useState("all");
  const [page, setPage] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const sources = useMemo(() => {
    const uniqueSources = new Map<string, NonNullable<PcrWarning["sourceRefs"]>[number]>();
    for (const warning of warnings) {
      for (const source of warning.sourceRefs ?? []) {
        uniqueSources.set(source.sourceInstanceId ?? source.sourceName, source);
      }
    }
    return [...uniqueSources.values()];
  }, [warnings]);
  const sourceOptions = useMemo(() => {
    const totals = new Map<string, number>();
    const occurrences = new Map<string, number>();
    for (const source of sources) totals.set(source.sourceName, (totals.get(source.sourceName) ?? 0) + 1);

    return sources.map((source) => {
      const occurrence = (occurrences.get(source.sourceName) ?? 0) + 1;
      occurrences.set(source.sourceName, occurrence);
      const total = totals.get(source.sourceName) ?? 1;
      return {
        key: source.sourceInstanceId ?? source.sourceName,
        label: total > 1 ? `${source.sourceName} (${occurrence}/${total})` : source.sourceName
      };
    });
  }, [sources]);
  const sourceLabels = useMemo(() => new Map(sourceOptions.map((source) => [source.key, source.label])), [sourceOptions]);
  const codes = useMemo(() => {
    const uniqueCodes = new Set<PcrWarning["code"]>();
    for (const warning of warnings) uniqueCodes.add(warning.code);
    return [...uniqueCodes].sort();
  }, [warnings]);
  const filtered = useMemo(
    () =>
      warnings.filter((warning) => {
        if (severity !== "all" && warning.severity !== severity) return false;
        if (code !== "all" && warning.code !== code) return false;
        if (
          sourceId !== "all" &&
          !(warning.sourceRefs ?? []).some((source) => (source.sourceInstanceId ?? source.sourceName) === sourceId)
        )
          return false;
        return true;
      }),
    [code, severity, sourceId, warnings]
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const pageWarnings = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const selected =
    pageWarnings.find(
      (warning, index) => createWarningKey(warning, currentPage * pageSize + index) === selectedKey
    ) ?? pageWarnings[0] ?? null;

  useEffect(() => {
    setPage(0);
    setSelectedKey(null);
  }, [code, severity, sourceId, warnings]);

  if (warnings.length === 0) return null;

  return (
    <details className="warning-inspector" open={isOpen} onToggle={(event) => setIsOpen(event.currentTarget.open)}>
      <summary>
        <span>경고 상세</span>
        <span className="count-badge">{warnings.length}</span>
      </summary>
      <div className="warning-inspector-filters" aria-label="경고 필터">
        <label>
          수준
          <select value={severity} onChange={(event) => setSeverity(event.currentTarget.value as typeof severity)}>
            <option value="all">전체</option>
            <option value="error">Error</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
        </label>
        <label>
          원본
          <select value={sourceId} onChange={(event) => setSourceId(event.currentTarget.value)}>
            <option value="all">전체 원본</option>
            {sourceOptions.map((source) => (
              <option key={source.key} value={source.key}>
                {source.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          코드
          <select value={code} onChange={(event) => setCode(event.currentTarget.value)}>
            <option value="all">전체 코드</option>
            {codes.map((warningCode) => (
              <option key={warningCode} value={warningCode}>
                {warningCode}
              </option>
            ))}
          </select>
        </label>
      </div>
      {filtered.length === 0 ? (
        <p className="muted">현재 필터에 맞는 경고가 없습니다.</p>
      ) : (
        <div className="warning-inspector-body">
          <section className="warning-master-list" aria-label="경고 목록">
            {pageWarnings.map((warning, index) => {
              const key = createWarningKey(warning, currentPage * pageSize + index);
              return (
                <button
                  type="button"
                  aria-pressed={selected === warning}
                  className={selected === warning ? "is-selected" : ""}
                  key={key}
                  onClick={() => setSelectedKey(key)}
                >
                  <strong>{getWarningTitle(warning)}</strong>
                  <span>{getPrimaryLocation(warning, sourceLabels)}</span>
                </button>
              );
            })}
            {pageCount > 1 && (
              <div className="warning-pagination">
                <button type="button" disabled={currentPage === 0} onClick={() => { setSelectedKey(null); setPage((value) => Math.max(0, value - 1)); }}>
                  이전
                </button>
                <span>{currentPage + 1} / {pageCount}</span>
                <button
                  type="button"
                  disabled={currentPage >= pageCount - 1}
                  onClick={() => { setSelectedKey(null); setPage((value) => Math.min(pageCount - 1, value + 1)); }}
                >
                  다음
                </button>
              </div>
            )}
          </section>
          {selected && (
            <WarningDetail
              warning={selected}
              sourceLabels={sourceLabels}
              enableNavigation={enableNavigation}
              onReveal={() =>
                revealWarning({
                  analysisId: activeAnalysisId,
                  warningCode: selected.code,
                  warningLabel: getWarningTitle(selected),
                  curveIds: selected.curveIds ?? []
                })
              }
            />
          )}
        </div>
      )}
    </details>
  );
}

function WarningDetail({
  warning,
  sourceLabels,
  enableNavigation,
  onReveal
}: {
  warning: PcrWarning;
  sourceLabels: Map<string, string>;
  enableNavigation: boolean;
  onReveal: () => void;
}) {
  const [sourcePage, setSourcePage] = useState(0);
  const sourceRefs = warning.sourceRefs ?? [];
  const sourcePageCount = Math.max(1, Math.ceil(sourceRefs.length / sourcePageSize));
  const currentSourcePage = Math.min(sourcePage, sourcePageCount - 1);
  const visibleSourceRefs = sourceRefs.slice(
    currentSourcePage * sourcePageSize,
    (currentSourcePage + 1) * sourcePageSize
  );

  useEffect(() => setSourcePage(0), [warning]);

  return (
    <section className="warning-detail" aria-label="선택한 경고 상세">
      <div className="warning-detail-heading">
        <div>
          <strong>{warning.code}</strong>
          <span className={`warning-severity is-${warning.severity}`}>{warning.severity}</span>
        </div>
        <span>{formatHandling(warning.handling)}</span>
      </div>
      <p>{warning.message}</p>
      {visibleSourceRefs.map((source, index) => (
        <dl className="warning-source-detail" key={`${source.sourceInstanceId ?? source.sourceName}-${source.cell ?? source.range ?? index}`}>
          <div><dt>원본</dt><dd>{getSourceLabel(source, sourceLabels)}</dd></div>
          <div><dt>위치</dt><dd>{[source.worksheet, source.cell ?? source.range, source.columnLetter].filter(Boolean).join(" · ") || "원본 전체"}</dd></div>
          {source.rawValue !== undefined && <div><dt>Raw</dt><dd>{formatValue(source.rawValue)}</dd></div>}
          {source.displayValue !== undefined && <div><dt>Display</dt><dd>{formatValue(source.displayValue)}</dd></div>}
          {source.numberFormat && <div><dt>Format</dt><dd>{source.numberFormat}</dd></div>}
          {source.formulaText && <div><dt>Formula</dt><dd>{source.formulaText}</dd></div>}
          {source.formulaCacheStatus && <div><dt>Cache</dt><dd>{source.formulaCacheStatus}</dd></div>}
        </dl>
      ))}
      {sourcePageCount > 1 && (
        <div className="warning-pagination" aria-label="경고 원본 위치 페이지">
          <button type="button" disabled={currentSourcePage === 0} onClick={() => setSourcePage((value) => Math.max(0, value - 1))}>
            이전 위치
          </button>
          <span>{currentSourcePage + 1} / {sourcePageCount} · 전체 {sourceRefs.length.toLocaleString()}개</span>
          <button
            type="button"
            disabled={currentSourcePage >= sourcePageCount - 1}
            onClick={() => setSourcePage((value) => Math.min(sourcePageCount - 1, value + 1))}
          >
            다음 위치
          </button>
        </div>
      )}
      {warning.labels?.length ? <p className="warning-related">관련 라벨: {warning.labels.join(", ")}</p> : null}
      <button type="button" disabled={!enableNavigation || !warning.curveIds?.length} onClick={onReveal}>
        데이터 선택에서 위치 보기
      </button>
    </section>
  );
}

function getWarningTitle(warning: PcrWarning) {
  const titles: Partial<Record<PcrWarning["code"], string>> = {
    EMPTY_FLUORESCENCE_CELL: "빈 형광값",
    NON_NUMERIC_FLUORESCENCE: "숫자가 아닌 형광값",
    FORMULA_CACHED_VALUE_USED: "수식 캐시값 사용",
    FORMULA_WITHOUT_CACHED_VALUE: "수식 캐시값 없음",
    MISSING_SPECIMEN_LABEL: "검체명 없음",
    INHERITED_SPECIMEN_LABEL: "검체명 계승",
    MISSING_REAGENT_LABEL: "시약명 없음",
    DUPLICATE_CURVE_LABEL: "동일 곡선 라벨",
    SIMILAR_SPECIMEN_LABEL: "유사 검체명",
    SIMILAR_REAGENT_LABEL: "유사 시약명",
    FORMATTED_HEADER_IDENTITY_COLLISION: "표시 헤더 충돌",
    MERGED_HEADER_CELL: "병합된 헤더 셀",
    FILE_SIGNATURE_MISMATCH: "파일 형식 진단"
  };
  return titles[warning.code] ?? warning.code;
}

function getPrimaryLocation(warning: PcrWarning, sourceLabels: Map<string, string>) {
  const source = warning.sourceRefs?.[0];
  return [source ? getSourceLabel(source, sourceLabels) : undefined, source?.worksheet, source?.cell ?? source?.range ?? warning.sourceCell ?? warning.sourceRange]
    .filter(Boolean)
    .join(" · ") || "데이터셋 전체";
}

function getSourceLabel(source: NonNullable<PcrWarning["sourceRefs"]>[number], sourceLabels: Map<string, string>) {
  return sourceLabels.get(source.sourceInstanceId ?? source.sourceName) ?? source.sourceName;
}

function formatHandling(handling?: WarningHandling) {
  if (handling === "null-gap") return "빈 값(null)으로 유지";
  if (handling === "ignored") return "분석에서 제외";
  if (handling === "blocked") return "가져오기 차단";
  return "원본 값 유지";
}

function formatValue(value: unknown) {
  return typeof value === "string" ? value || "(빈 문자열)" : JSON.stringify(value);
}

function createWarningKey(warning: PcrWarning, index: number) {
  return `${warning.code}:${warning.sourceRefs?.[0]?.sourceInstanceId ?? "source"}:${warning.sourceCell ?? warning.sourceRange ?? index}`;
}
