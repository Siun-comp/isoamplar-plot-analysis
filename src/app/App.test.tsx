import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  copyPngBlobToClipboard,
  copyReportLegendExcelTableToClipboard,
  exportChartLayoutImageBlob,
  exportReportLegendImageBlob
} from "../chart/exportChart";
import { exportAnalysisWorkbookBlob } from "../analysis/analysisWorkbook";
import { formatCurveLabel } from "../data/curveLabels";
import { appendPcrDataset } from "../data/mergeDatasets";
import {
  createOneSpecimenEightReagentDataset,
  createSimilarNameDataset,
  createSyntheticPcrDataset,
  createTwentyOnePlusCurveDataset
} from "../data/sampleData";
import { App } from "./App";
import { useAppStore } from "./appStore";

vi.mock("../chart/exportChart", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../chart/exportChart")>();
  return {
    ...actual,
    downloadBlob: vi.fn(),
    exportChartLayoutImageBlob: vi.fn(async () => new Blob(["png"], { type: "image/png" })),
    exportReportLegendImageBlob: vi.fn(async () => new Blob(["legend"], { type: "image/png" })),
    copyReportLegendExcelTableToClipboard: vi.fn(async () => undefined),
    copyPngBlobToClipboard: vi.fn(async () => undefined)
  };
});

vi.mock("../analysis/analysisWorkbook", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../analysis/analysisWorkbook")>();
  return {
    ...actual,
    exportAnalysisWorkbookBlob: vi.fn(actual.exportAnalysisWorkbookBlob)
  };
});

function getSettingsSummary(name: string) {
  const summary = screen.getAllByText(name).find((element) => element.tagName.toLowerCase() === "summary");
  if (!summary) {
    throw new Error(`Could not find ${name} settings summary.`);
  }
  return summary as HTMLElement;
}

function snapshotWarningNavigationState() {
  const state = useAppStore.getState();
  return {
    selectedCurveIds: [...(state.selection?.selectedCurveIds ?? [])],
    orderedCurveIds: [...(state.selection?.orderedCurveIds ?? [])],
    collapsedGroupIds: [...(state.selection?.collapsedGroupIds ?? [])],
    curveOverrides: JSON.parse(JSON.stringify(state.curveOverrides)),
    searchQuery: state.searchQuery,
    selectionFilter: state.selectionFilter,
    dirty: state.dirty,
    revision: state.revision
  };
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("App PCR workspace", () => {
  beforeEach(() => {
    useAppStore.getState().reset();
    vi.mocked(exportChartLayoutImageBlob).mockClear();
    vi.mocked(exportReportLegendImageBlob).mockClear();
    vi.mocked(copyReportLegendExcelTableToClipboard).mockClear();
    vi.mocked(copyPngBlobToClipboard).mockClear();
    vi.mocked(exportAnalysisWorkbookBlob).mockClear();
  });

  it("renders the upload-first PCR workspace shell", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "IsoAmplar Plot Analysis" })).toBeInTheDocument();
    expect(screen.getByText("Developer Jang Si Un")).toBeInTheDocument();
    expect(screen.getByText("Browser-local analysis")).toBeInTheDocument();
    expect(screen.queryByText("MVP implementation")).not.toBeInTheDocument();
    expect(screen.queryByText("Release validation")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Analysis 1" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("textbox", { name: "분석 이름" })).toHaveValue("Analysis 1");
    expect(screen.getByRole("heading", { name: "데이터 가져오기" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "데이터 선택" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "그래프 미리보기" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "설정" })).toBeInTheDocument();
    expect(screen.getAllByText("선택된 curve가 없습니다.").length).toBeGreaterThan(0);
    expect(screen.getByText("원본 Excel은 첫 번째 시트만 읽고, 모든 데이터는 브라우저 안에서 처리합니다.")).toBeInTheDocument();
    expect(screen.getByText("원본 데이터 열기")).toBeInTheDocument();
    expect(screen.getByText("저장한 분석 열기")).toBeInTheDocument();
  });

  it("protects browser unload while any analysis is dirty and removes protection when all are saved", async () => {
    render(<App />);
    let dirtyAnalysisId = "";
    act(() => {
      useAppStore.getState().loadDataset(createOneSpecimenEightReagentDataset());
      dirtyAnalysisId = useAppStore.getState().activeAnalysisId;
      useAppStore.getState().createAnalysis("Clean inactive test");
    });

    await waitFor(() => {
      const dirtyEvent = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(dirtyEvent);
      expect(dirtyEvent.defaultPrevented).toBe(true);
    });

    let job: ReturnType<typeof useAppStore.getState>["activeExportJob"] = null;
    act(() => {
      useAppStore.getState().switchAnalysis(dirtyAnalysisId);
      job = useAppStore.getState().beginExportJob("analysisSave", true);
    });
    expect(job).not.toBeNull();
    act(() => {
      useAppStore.getState().completeExportJob(job!, "saved");
    });

    await waitFor(() => {
      const cleanEvent = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(cleanEvent);
      expect(cleanEvent.defaultPrevented).toBe(false);
    });
  });

  it("starts imported datasets in reagent-first view with all major groups collapsed", () => {
    act(() => {
      useAppStore.getState().loadDataset(createOneSpecimenEightReagentDataset());
    });

    render(<App />);

    expect(screen.getByRole("radio", { name: "시약별" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("표시 8")).toBeInTheDocument();
    expect(screen.getByText("선택 0")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /▸ A/ })).toHaveLength(8);
    expect(screen.queryByText("검체 1 │ A1")).not.toBeInTheDocument();
  });

  it("renders a single-curve subgroup as one selectable row without a duplicate subgroup checkbox", async () => {
    const user = userEvent.setup();
    const dataset = createOneSpecimenEightReagentDataset();
    act(() => {
      useAppStore.getState().loadDataset(dataset);
    });

    render(<App />);

    const selectionPanel = screen.getByRole("complementary", { name: "데이터 선택" });
    const a1Toggle = within(selectionPanel).getByRole("button", { name: /A1/ });
    await user.click(a1Toggle);
    const a1Group = a1Toggle.closest(".tree-group") as HTMLElement;

    expect(within(a1Group).queryByLabelText("검체 1 선택")).not.toBeInTheDocument();
    expect(within(a1Group).getAllByRole("checkbox")).toHaveLength(2);

    await user.click(within(a1Group).getByRole("checkbox", { name: /^A1 │ 검체 1 선택/u }));
    expect(useAppStore.getState().selection?.selectedCurveIds.has(dataset.curves[0].curveId)).toBe(true);
  });

  it("keeps the subgroup checkbox for multi-curve subgroups", async () => {
    const user = userEvent.setup();
    const dataset = createSyntheticPcrDataset({
      specimenLabels: ["검체 1"],
      reagentLabels: ["A1", "A1"],
      fileName: "duplicate_reagent.xlsx"
    });
    act(() => {
      useAppStore.getState().loadDataset(dataset);
    });

    render(<App />);

    const selectionPanel = screen.getByRole("complementary", { name: "데이터 선택" });
    const a1Toggle = within(selectionPanel).getByRole("button", { name: /A1/ });
    await user.click(a1Toggle);
    const a1Group = a1Toggle.closest(".tree-group") as HTMLElement;
    const firstCurveId = dataset.curves[0].curveId;
    const secondCurveId = dataset.curves[1].curveId;

    const subgroupCheckbox = within(a1Group).getByLabelText("검체 1 선택");
    expect(subgroupCheckbox).toBeInTheDocument();
    expect(within(a1Group).getAllByRole("checkbox")).toHaveLength(4);

    await user.click(subgroupCheckbox);
    expect(useAppStore.getState().selection?.selectedCurveIds.has(firstCurveId)).toBe(true);
    expect(useAppStore.getState().selection?.selectedCurveIds.has(secondCurveId)).toBe(true);

    await user.click(within(a1Group).getAllByRole("checkbox", { name: /^A1 │ 검체 1 선택/u })[0]);
    expect(useAppStore.getState().selection?.selectedCurveIds.has(firstCurveId)).toBe(false);
    expect(useAppStore.getState().selection?.selectedCurveIds.has(secondCurveId)).toBe(true);
    expect(subgroupCheckbox).toHaveAttribute("aria-checked", "mixed");
  }, 10000);

  it("creates, renames, switches, and confirms dirty close for analysis tabs", async () => {
    const user = userEvent.setup();
    act(() => {
      useAppStore.getState().loadDataset(createOneSpecimenEightReagentDataset());
    });

    render(<App />);

    const initialName = useAppStore.getState().analysisName;
    expect(screen.getByRole("tab", { name: new RegExp(initialName) })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("button", { name: `${initialName} 닫기` }));
    expect(screen.getByRole("alertdialog", { name: "저장하지 않은 분석" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analysis XLSX 저장 후 닫기" })).toBeEnabled();
    expect(useAppStore.getState().analysisOrder).toHaveLength(1);
    await waitFor(() => expect(screen.getByRole("button", { name: "취소" })).toHaveFocus());
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("alertdialog", { name: "저장하지 않은 분석" })).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("button", { name: `${initialName} 닫기` })).toHaveFocus());

    const fileInput = document.querySelector("input[type='file']") as HTMLInputElement;
    await user.upload(fileInput, new File(["placeholder"], "replacement.xlsx"));
    const replaceDialog = screen.getByRole("alertdialog", { name: "Unsaved analysis" });
    expect(replaceDialog).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel file replace" })).toHaveFocus());
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog", { name: "Unsaved analysis" })).not.toBeInTheDocument();
    expect(fileInput).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "새 분석" }));
    expect(screen.queryByRole("alertdialog", { name: "Unsaved analysis" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Analysis 2" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("데이터 없음")).toBeInTheDocument();

    const nameInput = screen.getByRole("textbox", { name: "분석 이름" });
    await user.clear(nameInput);
    await user.type(nameInput, "Run B");
    expect(screen.getByRole("tab", { name: /Run B/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("데이터 없음")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: new RegExp(initialName) }));
    expect(screen.getByRole("tab", { name: new RegExp(initialName) })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("textbox", { name: "분석 이름" })).toHaveValue(initialName);

    await user.click(screen.getByRole("tab", { name: /Run B/ }));
    expect(screen.getByRole("textbox", { name: "분석 이름" })).toHaveValue("Run B");
  });

  it("keeps the dirty-close dialog locked against Escape while save-and-close is running", async () => {
    const user = userEvent.setup();
    act(() => useAppStore.getState().loadDataset(createOneSpecimenEightReagentDataset()));
    const activeName = useAppStore.getState().analysisName;
    const deferred = createDeferred<Blob>();
    vi.mocked(exportAnalysisWorkbookBlob).mockImplementationOnce(() => deferred.promise);
    render(<App />);

    await user.click(screen.getByRole("button", { name: `${activeName} 닫기` }));
    await waitFor(() => expect(screen.getByRole("button", { name: "취소" })).toHaveFocus());
    await user.click(screen.getByRole("button", { name: "Analysis XLSX 저장 후 닫기" }));
    await user.keyboard("{Escape}");
    expect(screen.getByRole("alertdialog", { name: "저장하지 않은 분석" })).toBeInTheDocument();

    deferred.resolve(new Blob(["analysis"], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog", { name: "저장하지 않은 분석" })).not.toBeInTheDocument());
    expect(useAppStore.getState().dataset).toBeNull();
  });

  it("reveals warning-related curves without mutating analysis selection, order, style, filters, or dirty state", async () => {
    const user = userEvent.setup();
    act(() => {
      useAppStore.getState().loadDataset(createSimilarNameDataset());
      useAppStore.getState().setSearchQuery("not currently visible");
      useAppStore.getState().setSelectionFilter("selected");
    });
    const before = snapshotWarningNavigationState();
    render(<App />);

    const revealButton = screen
      .getAllByRole("button", { name: "데이터 선택에서 위치 보기" })
      .find((button) => !button.hasAttribute("disabled"));
    expect(revealButton).toBeDefined();
    await user.click(revealButton as HTMLButtonElement);

    expect(screen.getByText(/관련 데이터 .*개를 임시 표시 중/u)).toBeInTheDocument();
    expect(snapshotWarningNavigationState()).toEqual(before);
    await user.click(screen.getByRole("button", { name: "원래 보기" }));
    expect(screen.queryByText(/임시 표시 중/u)).not.toBeInTheDocument();
    expect(snapshotWarningNavigationState()).toEqual(before);
  });

  it("supports keyboard tab switching and clean tab close", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "새 분석" }));
    expect(screen.getByRole("tab", { name: "Analysis 2" })).toHaveAttribute("aria-selected", "true");

    screen.getByRole("tab", { name: "Analysis 1" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Analysis 2" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Analysis 2");

    await user.click(screen.getByRole("button", { name: "Analysis 2 닫기" }));
    expect(useAppStore.getState().analysisOrder).toEqual(["analysis-1"]);
    expect(screen.getByRole("tab", { name: "Analysis 1" })).toHaveAttribute("aria-selected", "true");
  });

  it("applies search bulk selection to all matching collapsed curves by curveId", async () => {
    const user = userEvent.setup();
    act(() => {
      useAppStore.getState().loadDataset(createOneSpecimenEightReagentDataset());
    });

    render(<App />);

    await user.type(screen.getByRole("searchbox", { name: "검색" }), "A8");
    expect(screen.getByText("표시 1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "표시 선택" }));

    expect(screen.getByText("선택 1")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "검체별" }));
    expect(screen.getByRole("radio", { name: "검체별" })).toHaveAttribute("aria-checked", "true");
    expect(within(screen.getByRole("complementary", { name: "데이터 선택" })).getAllByText("검체별").length).toBeGreaterThan(1);
    expect(screen.getByText("선택 1")).toBeInTheDocument();
  });

  it("shows selected auto scale bounds and can copy them into fixed scale inputs", async () => {
    const user = userEvent.setup();
    const dataset = createOneSpecimenEightReagentDataset();
    act(() => {
      useAppStore.getState().loadDataset(dataset);
      useAppStore.getState().setCurvesSelected([dataset.curves[0].curveId], true);
    });

    render(<App />);

    const xAxis = screen.getByRole("region", { name: "X axis" });
    expect(within(xAxis).getByText("Selected raw data range: 1 - 45")).toBeInTheDocument();

    await user.click(within(xAxis).getByRole("button", { name: "Fixed" }));
    await user.click(within(xAxis).getByRole("button", { name: "현재 Auto값 적용" }));
    const fixedInputs = within(xAxis).getAllByRole("spinbutton").slice(0, 2);

    expect(fixedInputs[0]).toHaveValue(1);
    expect(fixedInputs[1]).toHaveValue(45);

    const boxZoomButton = screen.getByRole("button", { name: "Box zoom" });
    const previousScaleButton = screen.getByRole("button", { name: "Previous scale" });
    expect(boxZoomButton).toHaveAttribute("aria-pressed", "false");
    expect(previousScaleButton).toBeDisabled();
    await user.click(boxZoomButton);
    expect(boxZoomButton).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Drag inside the highlighted plot area to apply Fixed X/Y scale.")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(boxZoomButton).toHaveAttribute("aria-pressed", "false");

    act(() => {
      useAppStore.getState().setChartFixedScaleBounds({ xMin: "10", xMax: "20", yMin: "100", yMax: "200" });
    });
    expect(useAppStore.getState().chartScale.x.mode).toBe("fixed");
    await user.click(screen.getByRole("button", { name: "Auto scale" }));
    expect(useAppStore.getState().chartScale.x.mode).toBe("auto");
    expect(useAppStore.getState().chartScale.y.mode).toBe("auto");
  });

  it("keeps the last valid scale and blocks only plot-bearing image exports for an invalid active draft", async () => {
    const user = userEvent.setup();
    const dataset = createOneSpecimenEightReagentDataset();
    act(() => {
      useAppStore.getState().loadDataset(dataset);
      useAppStore.getState().setCurvesSelected([dataset.curves[0].curveId], true);
      useAppStore.getState().setAxisScaleMode("y", "fixed");
      useAppStore.getState().setAxisFixedValue("y", "min", "-1");
      useAppStore.getState().setAxisFixedValue("y", "max", "100");
      useAppStore.getState().setAxisFixedValue("y", "max", "-2");
    });

    render(<App />);

    const yAxis = screen.getByRole("region", { name: "Y axis" });
    expect(within(yAxis).getByText("Applied: Fixed -1 - 100")).toBeInTheDocument();
    expect(within(yAxis).getByText(/last valid scale remains applied/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save PNG" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save JPEG" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Copy selected layout PNG to clipboard" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save report legend PNG" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "분석 저장" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Plotted CSV" })).toBeEnabled();

    await user.selectOptions(screen.getByRole("combobox", { name: "Image export layout" }), "legendOnly");
    expect(screen.getByRole("button", { name: "Save PNG" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Copy selected layout PNG to clipboard" })).toBeEnabled();
  });

  it("uses the applied fixed bounds for PNG, JPEG, and chart clipboard exports", async () => {
    const user = userEvent.setup();
    const dataset = createOneSpecimenEightReagentDataset();
    act(() => {
      useAppStore.getState().loadDataset(dataset);
      useAppStore.getState().setCurvesSelected([dataset.curves[0].curveId], true);
      useAppStore.getState().setChartFixedScaleBounds({ xMin: "10", xMax: "20", yMin: "100", yMax: "200" });
    });

    render(<App />);
    await user.click(getSettingsSummary("Export"));
    await user.click(screen.getByRole("button", { name: "Save PNG" }));
    await user.click(screen.getByRole("button", { name: "Save JPEG" }));
    await user.click(screen.getByRole("button", { name: "Copy selected layout PNG to clipboard" }));

    await waitFor(() => expect(exportChartLayoutImageBlob).toHaveBeenCalledTimes(3));
    for (const [args] of vi.mocked(exportChartLayoutImageBlob).mock.calls) {
      expect(args.option).toMatchObject({
        xAxis: { min: 10, max: 20 },
        yAxis: { min: 100, max: 200 }
      });
    }
    expect(vi.mocked(exportChartLayoutImageBlob).mock.calls.map(([args]) => args.type)).toEqual(["png", "jpeg", "png"]);
    expect(copyPngBlobToClipboard).toHaveBeenCalledTimes(1);
  });

  it("keeps a deferred clipboard failure on the analysis where it started after switching tabs", async () => {
    const user = userEvent.setup();
    const dataset = createOneSpecimenEightReagentDataset();
    act(() => {
      useAppStore.getState().loadDataset(dataset);
      useAppStore.getState().setCurvesSelected([dataset.curves[0].curveId], true);
    });
    const firstId = useAppStore.getState().activeAnalysisId;
    const deferred = createDeferred<void>();
    vi.mocked(copyPngBlobToClipboard).mockImplementationOnce(() => deferred.promise);
    render(<App />);

    await user.click(getSettingsSummary("Export"));
    await user.click(screen.getByRole("button", { name: "Copy selected layout PNG to clipboard" }));
    let secondId = "";
    act(() => {
      secondId = useAppStore.getState().createAnalysis("Second");
      useAppStore.getState().loadDataset(dataset);
    });
    deferred.reject(new Error("clipboard denied"));

    await waitFor(() => expect(useAppStore.getState().analyses[firstId].activeExportJob).toBeNull());
    expect(useAppStore.getState().activeAnalysisId).toBe(secondId);
    expect(useAppStore.getState().exportMessage).toBeNull();
    expect(useAppStore.getState().analyses[firstId].exportMessage).toContain("clipboard denied");
    expect(useAppStore.getState().analyses[firstId].exportCounter).toBe(1);
  });

  it("accepts HEX color input for group and individual curve styles", async () => {
    const user = userEvent.setup();
    const dataset = createOneSpecimenEightReagentDataset();
    act(() => {
      useAppStore.getState().loadDataset(dataset);
      useAppStore.getState().setCurvesSelected([dataset.curves[0].curveId], true);
    });

    render(<App />);
    await user.click(screen.getByText("Style"));

    const reagentHex = screen.getByRole("textbox", { name: "A1 hex color" });
    await user.clear(reagentHex);
    await user.type(reagentHex, "#123abc");
    expect(useAppStore.getState().styleRules.reagentColors[dataset.reagents[0].id]).toBe("#123abc");

    const curveHex = screen.getByRole("textbox", { name: "A1 │ 검체 1 hex color" });
    await user.clear(curveHex);
    await user.type(curveHex, "f80");
    await user.tab();
    expect(useAppStore.getState().curveOverrides[dataset.curves[0].curveId].color).toBe("#ff8800");
  });

  it("exposes marker basis controls and group marker styles", async () => {
    const user = userEvent.setup();
    const dataset = createOneSpecimenEightReagentDataset();
    act(() => {
      useAppStore.getState().loadDataset(dataset);
      useAppStore.getState().setCurvesSelected([dataset.curves[0].curveId], true);
    });

    render(<App />);
    await user.click(screen.getByText("Style"));

    expect(screen.getByLabelText("현재 스타일 기준")).toHaveTextContent("마커 시약별");
    await user.selectOptions(screen.getByLabelText("마커 기준"), "specimen");
    expect(useAppStore.getState().styleRules.markerBy).toBe("specimen");

    await user.selectOptions(screen.getByLabelText("마커 기준"), "reagent");
    await user.click(screen.getByLabelText("A1 line and marker editor"));
    expect(document.querySelectorAll("details.style-popover[open]")).toHaveLength(1);
    await user.click(screen.getByLabelText("A2 line and marker editor"));
    expect(document.querySelectorAll("details.style-popover[open]")).toHaveLength(1);
    await user.keyboard("{Escape}");
    expect(document.querySelectorAll("details.style-popover[open]")).toHaveLength(0);
    await user.click(screen.getByLabelText("A1 line and marker editor"));
    await user.click(screen.getByRole("button", { name: "A1 marker circle" }));
    expect(useAppStore.getState().styleRules.reagentMarkerTypes[dataset.curves[0].reagentId]).toBe("circle");
    expect(document.querySelectorAll("details.style-popover[open]")).toHaveLength(0);
    await user.click(screen.getByLabelText("A1 line and marker editor"));
    await user.click(screen.getByRole("button", { name: "A1 line dashed" }));
    expect(useAppStore.getState().styleRules.reagentLineTypes[dataset.curves[0].reagentId]).toBe("dashed");
    expect(screen.getByLabelText("A1 │ 검체 1 marker type")).toHaveValue("circle");
  });

  it("shows individual style status and resets curve overrides", async () => {
    const user = userEvent.setup();
    const dataset = createOneSpecimenEightReagentDataset();
    const curve = dataset.curves[0];
    act(() => {
      useAppStore.getState().loadDataset(dataset);
      useAppStore.getState().setCurvesSelected([curve.curveId], true);
    });

    render(<App />);
    await user.click(screen.getByText("Style"));

    expect(screen.getByText("기준값")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("A1 │ 검체 1 marker type"), "rect");
    expect(screen.getAllByText("Custom").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "A1 │ 검체 1 marker type reset" }));
    expect(useAppStore.getState().curveOverrides[curve.curveId]).toBeUndefined();
    expect(screen.getByText("기준값")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("A1 │ 검체 1 marker type"), "rect");
    await user.click(screen.getByRole("button", { name: "A1 │ 검체 1 style reset" }));
    expect(useAppStore.getState().curveOverrides[curve.curveId]).toBeUndefined();
    expect(screen.getByText("기준값")).toBeInTheDocument();

    act(() => {
      useAppStore.getState().applyStylePreset("reagentColorSolid", [curve.curveId]);
    });
    expect(screen.getAllByText("Preset").length).toBeGreaterThan(0);
    act(() => {
      useAppStore.getState().undoLastPreset();
    });
    expect(screen.getByText("기준값")).toBeInTheDocument();

    act(() => {
      useAppStore.getState().applyStylePreset("reagentColorSolid", [curve.curveId]);
    });
    await user.selectOptions(screen.getByLabelText("A1 │ 검체 1 marker type"), "rect");
    expect(screen.getByText("Custom/Preset")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "A1 │ 검체 1 marker type reset" }));
    expect(screen.getAllByText("Preset").length).toBeGreaterThan(0);
  });

  it("lets users search selected individual styles beyond thirty curves", async () => {
    const user = userEvent.setup();
    const dataset = createSyntheticPcrDataset({
      specimenLabels: ["S1", "S2", "S3", "S4", "S5"],
      reagentLabels: ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8"]
    });
    act(() => {
      useAppStore.getState().loadDataset(dataset);
      useAppStore.getState().setCurvesSelected(dataset.curves.map((curve) => curve.curveId), true);
    });

    render(<App />);
    await user.click(screen.getByText("Style"));
    await user.type(screen.getByRole("searchbox", { name: "개별 스타일 검색" }), "S5");

    const individualEditor = screen.getByRole("region", { name: "개별 curve 스타일" });
    expect(within(individualEditor).getByText("A8 │ S5")).toBeInTheDocument();
    await user.selectOptions(within(individualEditor).getByLabelText("A8 │ S5 marker type"), "triangle");
    const targetCurve = dataset.curves.find((curve) => curve.specimenLabel === "S5" && curve.reagentLabel === "A8");
    expect(useAppStore.getState().curveOverrides[targetCurve?.curveId ?? ""]?.markerType).toBe("triangle");
  });

  it("disambiguates duplicate style labels by source and keeps edits curveId-safe", async () => {
    const user = userEvent.setup();
    const dataset = createSyntheticPcrDataset({
      specimenLabels: ["Same", "Same"],
      reagentLabels: ["A1"],
      fileName: "duplicates.xlsx"
    });
    act(() => {
      useAppStore.getState().loadDataset(dataset);
      useAppStore.getState().setCurvesSelected(dataset.curves.map((curve) => curve.curveId), true);
    });

    render(<App />);
    await user.click(screen.getByText("Style"));

    const individualEditor = screen.getByRole("region", { name: "개별 curve 스타일" });
    expect(within(individualEditor).getByText("duplicates.xlsx:A")).toBeInTheDocument();
    expect(within(individualEditor).getByText("duplicates.xlsx:B")).toBeInTheDocument();

    await user.type(within(individualEditor).getByRole("searchbox"), "duplicates.xlsx:B");
    expect(within(individualEditor).queryByText("duplicates.xlsx:A")).not.toBeInTheDocument();
    expect(within(individualEditor).getByText("duplicates.xlsx:B")).toBeInTheDocument();

    const secondCurve = dataset.curves[1];
    const secondMarkerSelect = within(individualEditor).getByLabelText("A1 │ Same duplicates.xlsx:B marker type");
    await user.selectOptions(secondMarkerSelect, "circle");

    expect(useAppStore.getState().curveOverrides[secondCurve.curveId]?.markerType).toBe("circle");
    expect(useAppStore.getState().curveOverrides[dataset.curves[0].curveId]).toBeUndefined();
  });

  it("keeps duplicate source suffixes unique when the same file and column are appended again", async () => {
    const user = userEvent.setup();
    const baseDataset = createSyntheticPcrDataset({
      specimenLabels: ["Same"],
      reagentLabels: ["A1"],
      fileName: "repeat.xlsx"
    });
    const { dataset } = appendPcrDataset(baseDataset, baseDataset);
    act(() => {
      useAppStore.getState().loadDataset(dataset);
      useAppStore.getState().setCurvesSelected(dataset.curves.map((curve) => curve.curveId), true);
    });

    render(<App />);
    await user.click(screen.getByText("Style"));

    const individualEditor = screen.getByRole("region", { name: "개별 curve 스타일" });
    expect(within(individualEditor).getByText("repeat.xlsx:A")).toBeInTheDocument();
    expect(within(individualEditor).getByText("repeat.xlsx:A [file2]")).toBeInTheDocument();
    await user.selectOptions(within(individualEditor).getByLabelText("A1 │ Same repeat.xlsx:A [file2] marker type"), "rect");

    expect(useAppStore.getState().curveOverrides[dataset.curves[1].curveId]?.markerType).toBe("rect");
    expect(useAppStore.getState().curveOverrides[dataset.curves[0].curveId]).toBeUndefined();
  });

  it("renders a custom legend and keeps preview/export legend controls independent", async () => {
    const user = userEvent.setup();
    const dataset = createOneSpecimenEightReagentDataset();
    act(() => {
      useAppStore.getState().loadDataset(dataset);
      useAppStore.getState().setCurvesSelected([dataset.curves[0].curveId, dataset.curves[1].curveId], true);
      useAppStore.getState().setCurveOverride(dataset.curves[1].curveId, { lineType: "dashed", markerType: "circle" });
    });

    render(<App />);

    let customLegend = screen.getByRole("region", { name: "Custom legend" });
    expect(customLegend).toBeInTheDocument();
    expect(within(customLegend).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["A1", "A2"]);
    const firstLegendItem = within(customLegend).getAllByRole("listitem")[0];
    await user.hover(firstLegendItem);
    expect(firstLegendItem).toHaveClass("custom-legend-item-active");
    await user.unhover(firstLegendItem);
    expect(firstLegendItem).not.toHaveClass("custom-legend-item-active");

    await user.click(getSettingsSummary("Legend"));
    await user.click(screen.getByRole("button", { name: "A2 │ 검체 1 move up" }));
    customLegend = screen.getByRole("region", { name: "Custom legend" });
    expect(within(customLegend).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["A2", "A1"]);

    const previewToggle = within(screen.getByRole("region", { name: "Legend order" })).getByRole("checkbox");
    expect(previewToggle).toBeChecked();
    await user.click(previewToggle);
    expect(screen.queryByRole("region", { name: "Custom legend" })).not.toBeInTheDocument();
    expect(useAppStore.getState().legendSettings.previewVisible).toBe(false);
    expect(useAppStore.getState().exportSettings.imageLayout).toBe("plotWithLegend");

    await user.click(screen.getByRole("tab", { name: "Labels" }));
    await user.selectOptions(screen.getByLabelText("Legend label mode"), "full");
    const labelEditor = screen.getByRole("region", { name: "Analysis label editor" });
    const analysisLabelInput = within(labelEditor).getAllByRole("textbox")[0];
    await user.type(analysisLabelInput, "Report A2");
    expect(useAppStore.getState().legendSettings.reportLabelMode).toBe("full");
    expect(useAppStore.getState().legendSettings.reportNameOverrides).toEqual({});
    expect(useAppStore.getState().curveOverrides[dataset.curves[1].curveId].displayName).toBe("Report A2");

    await user.click(screen.getByText("Export"));
    const imageLayoutSelect = screen.getByLabelText("Image export layout");
    await user.selectOptions(imageLayoutSelect, "legendOnly");
    const legendClipboardButton = screen.getByRole("button", { name: "Copy selected layout PNG to clipboard" });
    expect(legendClipboardButton).toHaveTextContent("클립보드 PNG");
    await user.click(legendClipboardButton);
    await waitFor(() =>
      expect(exportChartLayoutImageBlob).toHaveBeenCalledWith(expect.objectContaining({ layout: "legendOnly", type: "png" }))
    );
    expect(copyPngBlobToClipboard).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().exportSettings.imageLayout).toBe("legendOnly");

    await user.click(screen.getByRole("button", { name: "Save report legend PNG" }));
    await waitFor(() => expect(exportReportLegendImageBlob).toHaveBeenCalledWith(expect.objectContaining({ type: "png" })));

    await user.click(screen.getByRole("button", { name: "Copy report legend PNG to clipboard" }));
    await waitFor(() => expect(copyPngBlobToClipboard).toHaveBeenCalledTimes(2));
    expect(exportReportLegendImageBlob).toHaveBeenCalledWith(
      expect.objectContaining({ type: "png", items: expect.arrayContaining([expect.objectContaining({ label: "Report A2" })]) })
    );

    await user.click(screen.getByRole("button", { name: "Copy report legend Excel cells" }));
    await waitFor(() =>
      expect(copyReportLegendExcelTableToClipboard).toHaveBeenCalledWith(
        expect.objectContaining({ items: expect.arrayContaining([expect.objectContaining({ label: "Report A2" })]) })
      )
    );

    await user.selectOptions(imageLayoutSelect, "legendOnly");
    expect(useAppStore.getState().exportSettings.imageLayout).toBe("legendOnly");
    expect(useAppStore.getState().legendSettings.previewVisible).toBe(false);
  });

  it("moves legend and individual style order by selected curve order when unselected curves are between them", async () => {
    const user = userEvent.setup();
    const dataset = createOneSpecimenEightReagentDataset();
    const firstLabel = formatCurveLabel(dataset.curves[0], "reagent");
    const thirdLabel = formatCurveLabel(dataset.curves[2], "reagent");
    act(() => {
      useAppStore.getState().loadDataset(dataset);
      useAppStore.getState().setCurvesSelected([dataset.curves[0].curveId, dataset.curves[2].curveId], true);
    });

    render(<App />);

    await user.click(getSettingsSummary("Legend"));
    await user.click(screen.getByRole("button", { name: `${thirdLabel} move up` }));

    const customLegend = screen.getByRole("region", { name: "Custom legend" });
    expect(within(customLegend).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      dataset.curves[2].reagentLabel,
      dataset.curves[0].reagentLabel
    ]);

    await user.click(screen.getByText("Style"));
    const individualEditor = screen.getByRole("region", { name: /curve/ });
    const individualText = individualEditor.textContent ?? "";
    expect(individualText.indexOf(thirdLabel)).toBeLessThan(individualText.indexOf(firstLabel));
  });

  it("shows a fixed chart readout and helper actions for more than twenty visible curves", async () => {
    const user = userEvent.setup();
    const dataset = createTwentyOnePlusCurveDataset();
    act(() => {
      useAppStore.getState().loadDataset(dataset);
      useAppStore.getState().setCurvesSelected(dataset.curves.map((curve) => curve.curveId), true);
    });

    render(<App />);

    const readout = screen.getByLabelText("Chart point readout");
    expect(readout).toHaveTextContent("Point");
    expect(readout).toHaveTextContent("Cycle -");
    expect(readout).toHaveTextContent("Fluorescence -");
    expect(screen.getByText(/20개를 초과/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /PNG/ })[0]).toBeEnabled();

    await user.type(screen.getByRole("searchbox", { name: "검색" }), "A1");
    await user.click(screen.getByRole("button", { name: "검색 결과만 유지" }));
    expect(useAppStore.getState().selectionFilter).toBe("selected");
    const remainingSelectedCurveIds = useAppStore.getState().selection?.selectedCurveIds ?? new Set<string>();
    expect(remainingSelectedCurveIds.size).toBe(3);
    expect(
      [...remainingSelectedCurveIds].every(
        (curveId) => dataset.curves.find((curve) => curve.curveId === curveId)?.reagentLabel === "A1"
      )
    ).toBe(true);

    act(() => {
      useAppStore.getState().setSearchQuery("");
      useAppStore.getState().setSelectionFilter("all");
      useAppStore.getState().setCurvesSelected(dataset.curves.map((curve) => curve.curveId), true);
    });

    await user.click(screen.getByRole("button", { name: "구분 프리셋 적용" }));
    expect(Object.values(useAppStore.getState().curveOverrides).filter((override) => override.source === "preset")).toHaveLength(
      dataset.curves.length
    );
    await user.click(screen.getByRole("button", { name: "프리셋 Undo" }));
    expect(Object.values(useAppStore.getState().curveOverrides)).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "전체 선택 해제" }));
    expect(useAppStore.getState().selection?.selectedCurveIds.size).toBe(0);
  });

  it("saves Analysis XLSX from the full imported dataset even when no curve is selected", async () => {
    const user = userEvent.setup();
    act(() => {
      useAppStore.getState().loadDataset(createOneSpecimenEightReagentDataset());
    });

    render(<App />);

    expect(screen.getAllByRole("button", { name: /PNG/ })[0]).toBeDisabled();
    expect(screen.getByRole("button", { name: "Plotted CSV" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "분석 저장" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "분석 저장" }));
    await waitFor(() => expect(useAppStore.getState().dirty).toBe(false));
    expect(useAppStore.getState().saveStatus).toBe("saved");
    expect(useAppStore.getState().lastSavedAtIso).not.toBeNull();
  });
});
