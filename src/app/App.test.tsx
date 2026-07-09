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
import { formatCurveLabel } from "../data/curveLabels";
import { appendPcrDataset } from "../data/mergeDatasets";
import { createOneSpecimenEightReagentDataset, createSyntheticPcrDataset, createTwentyOnePlusCurveDataset } from "../data/sampleData";
import { App } from "./App";
import { useAppStore } from "./appStore";

vi.mock("../chart/exportChart", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../chart/exportChart")>();
  return {
    ...actual,
    exportChartLayoutImageBlob: vi.fn(async () => new Blob(["png"], { type: "image/png" })),
    exportReportLegendImageBlob: vi.fn(async () => new Blob(["legend"], { type: "image/png" })),
    copyReportLegendExcelTableToClipboard: vi.fn(async () => undefined),
    copyPngBlobToClipboard: vi.fn(async () => undefined)
  };
});

function getSettingsSummary(name: string) {
  const summary = screen.getAllByText(name).find((element) => element.tagName.toLowerCase() === "summary");
  if (!summary) {
    throw new Error(`Could not find ${name} settings summary.`);
  }
  return summary as HTMLElement;
}

describe("App PCR workspace", () => {
  beforeEach(() => {
    useAppStore.getState().reset();
    vi.mocked(exportChartLayoutImageBlob).mockClear();
    vi.mocked(exportReportLegendImageBlob).mockClear();
    vi.mocked(copyReportLegendExcelTableToClipboard).mockClear();
    vi.mocked(copyPngBlobToClipboard).mockClear();
  });

  it("renders the upload-first PCR workspace shell", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "IsoAmplar Plot Analysis" })).toBeInTheDocument();
    expect(screen.getByText("Developer Jang Si Un")).toBeInTheDocument();
    expect(screen.getByText("Browser-local analysis")).toBeInTheDocument();
    expect(screen.queryByText("MVP implementation")).not.toBeInTheDocument();
    expect(screen.queryByText("Release validation")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Analysis 1" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("textbox", { name: "Analysis name" })).toHaveValue("Analysis 1");
    expect(screen.getByRole("heading", { name: "Excel 데이터" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "데이터 선택" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "그래프 미리보기" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "설정" })).toBeInTheDocument();
    expect(screen.getAllByText("선택된 curve가 없습니다.").length).toBeGreaterThan(0);
    expect(screen.getByText(".xls 또는 .xlsx 첫 번째 worksheet만 사용합니다.")).toBeInTheDocument();
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

    await user.click(within(a1Group).getByRole("checkbox", { name: "A1 │ 검체 1" }));
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

    await user.click(within(a1Group).getAllByRole("checkbox", { name: "A1 │ 검체 1" })[0]);
    expect(useAppStore.getState().selection?.selectedCurveIds.has(firstCurveId)).toBe(false);
    expect(useAppStore.getState().selection?.selectedCurveIds.has(secondCurveId)).toBe(true);
    expect(subgroupCheckbox).toHaveAttribute("aria-checked", "mixed");
  });

  it("creates, renames, switches, and confirms dirty close for analysis tabs", async () => {
    const user = userEvent.setup();
    act(() => {
      useAppStore.getState().loadDataset(createOneSpecimenEightReagentDataset());
    });

    render(<App />);

    const initialName = useAppStore.getState().analysisName;
    expect(screen.getByRole("tab", { name: new RegExp(initialName) })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("button", { name: `Close ${initialName}` }));
    expect(screen.getByRole("alertdialog", { name: "Unsaved analysis" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Analysis XLSX then close" })).toBeEnabled();
    expect(useAppStore.getState().analysisOrder).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Cancel close" }));
    expect(screen.queryByRole("alertdialog", { name: "Unsaved analysis" })).not.toBeInTheDocument();

    const fileInput = document.querySelector("input[type='file']") as HTMLInputElement;
    await user.upload(fileInput, new File(["placeholder"], "replacement.xlsx"));
    expect(screen.getByRole("alertdialog", { name: "Unsaved analysis" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "New analysis" }));
    expect(screen.queryByRole("alertdialog", { name: "Unsaved analysis" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Analysis 2" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Clean")).toBeInTheDocument();

    const nameInput = screen.getByRole("textbox", { name: "Analysis name" });
    await user.clear(nameInput);
    await user.type(nameInput, "Run B");
    expect(screen.getByRole("tab", { name: /Run B/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Unsaved")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: new RegExp(initialName) }));
    expect(screen.getByRole("tab", { name: new RegExp(initialName) })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("textbox", { name: "Analysis name" })).toHaveValue(initialName);

    await user.click(screen.getByRole("tab", { name: /Run B/ }));
    expect(screen.getByRole("textbox", { name: "Analysis name" })).toHaveValue("Run B");
  });

  it("supports keyboard tab switching and clean tab close", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "New analysis" }));
    expect(screen.getByRole("tab", { name: "Analysis 2" })).toHaveAttribute("aria-selected", "true");

    screen.getByRole("tab", { name: "Analysis 1" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Analysis 2" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Analysis 2");

    await user.click(screen.getByRole("button", { name: "Close Analysis 2" }));
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
    expect(within(xAxis).getByText("Auto range: 1 - 45")).toBeInTheDocument();

    await user.click(within(xAxis).getByRole("button", { name: "Fixed" }));
    await user.click(within(xAxis).getByRole("button", { name: "현재 Auto값 적용" }));
    const fixedInputs = within(xAxis).getAllByRole("spinbutton").slice(0, 2);

    expect(fixedInputs[0]).toHaveValue(1);
    expect(fixedInputs[1]).toHaveValue(45);
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

  it("allows Analysis XLSX export from the full imported dataset even when no curve is selected", () => {
    act(() => {
      useAppStore.getState().loadDataset(createOneSpecimenEightReagentDataset());
    });

    render(<App />);

    expect(screen.getAllByRole("button", { name: /PNG/ })[0]).toBeDisabled();
    expect(screen.getByRole("button", { name: "Plotted CSV" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Analysis XLSX" })).toBeEnabled();
  });
});
