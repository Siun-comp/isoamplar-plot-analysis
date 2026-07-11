import { createAnalysisState } from "./analysisState";
import { createAnalysisWorkbookFileName, exportAnalysisWorkbookBlob } from "./analysisWorkbook";
import { useAppStore, type ExportJobCompletionResult } from "../app/appStore";
import { downloadBlob } from "../chart/exportChart";

export type SaveActiveAnalysisResult =
  | { status: "saved"; fileName: string }
  | { status: "changed"; fileName: string }
  | { status: "busy" | "missing" | "failed"; message: string };

export async function saveActiveAnalysis(): Promise<SaveActiveAnalysisResult> {
  const snapshot = useAppStore.getState();
  if (!snapshot.dataset || !snapshot.selection) {
    return { status: "missing", message: "저장할 분석 데이터가 없습니다." };
  }

  const job = snapshot.beginExportJob("analysisSave", true);
  if (!job) {
    return { status: "busy", message: "이 분석에서 다른 저장 또는 내보내기 작업이 진행 중입니다." };
  }

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
    exportCounter: job.reservedCounter + 1,
    importFileName: snapshot.importFileName,
    sourceFiles: snapshot.sourceFiles,
    dirty: snapshot.dirty
  });
  const fileName = createAnalysisWorkbookFileName(job.reservedCounter, new Date(), snapshot.analysisName);

  try {
    const blob = await exportAnalysisWorkbookBlob(analysisState);
    downloadBlob(blob, fileName);
    const completion = useAppStore.getState().completeExportJob(job, `Saved ${fileName}.`);
    return mapCompletion(completion, fileName);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analysis XLSX export failed.";
    useAppStore.getState().failExportJob(job, message);
    return { status: "failed", message };
  }
}

function mapCompletion(completion: ExportJobCompletionResult, fileName: string): SaveActiveAnalysisResult {
  if (completion === "completed") return { status: "saved", fileName };
  if (completion === "changed") return { status: "changed", fileName };
  return { status: "missing", message: "저장을 시작한 분석 탭이 닫혔거나 교체되었습니다." };
}
