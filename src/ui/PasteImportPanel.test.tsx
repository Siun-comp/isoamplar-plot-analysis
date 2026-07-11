import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../app/App";
import { useAppStore } from "../app/appStore";

describe("Quick Paste Import UI", () => {
  beforeEach(() => {
    useAppStore.getState().reset();
  });

  it("creates a read-only preview without mutating the analysis, then appends unselected curves", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "붙여넣기 입력" }));
    const dialog = screen.getByRole("dialog", { name: "소량 표 붙여넣기" });
    const textarea = within(dialog).getByRole("textbox", { name: "표 데이터" });
    expect(textarea).toHaveFocus();
    expect(within(dialog).getByRole("textbox", { name: "가져오기 이름" })).toHaveValue("Paste import 1");

    await user.click(textarea);
    await user.paste("Specimen 1\tSpecimen 1\nA1\tA2\n0.1\t0.2\n1.1\t1.2");
    await user.click(within(dialog).getByRole("button", { name: "미리보기 생성" }));

    expect(useAppStore.getState().dataset).toBeNull();
    expect(within(dialog).getByText("측정 곡선 2개")).toBeInTheDocument();
    expect(within(dialog).getByText("Cycle 2개")).toBeInTheDocument();
    expect(within(dialog).getByRole("table")).toBeInTheDocument();
    expect(within(dialog).queryByRole("gridcell")).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "현재 분석에 추가" }));

    expect(screen.queryByRole("dialog", { name: "소량 표 붙여넣기" })).not.toBeInTheDocument();
    expect(useAppStore.getState().dataset?.curves).toHaveLength(2);
    expect(useAppStore.getState().selection?.selectedCurveIds.size).toBe(0);
    expect(useAppStore.getState().dataset?.curves[0].source.sourceKind).toBe("paste");
    expect(screen.getByRole("button", { name: "붙여넣기 입력" })).toHaveFocus();
  });

  it("keeps a preview stale after source text changes and is changed back", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "붙여넣기 입력" }));
    const dialog = screen.getByRole("dialog", { name: "소량 표 붙여넣기" });
    const textarea = within(dialog).getByRole("textbox", { name: "표 데이터" });
    await user.type(textarea, "S1{enter}A1{enter}0.1");
    await user.click(within(dialog).getByRole("button", { name: "미리보기 생성" }));
    expect(within(dialog).getByRole("button", { name: "현재 분석에 추가" })).toBeEnabled();

    await user.type(textarea, "x");
    await user.keyboard("{Backspace}");

    expect(within(dialog).getByText(/입력 내용이 변경되었습니다/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "현재 분석에 추가" })).toBeDisabled();
    await user.click(within(dialog).getByRole("button", { name: "미리보기 생성" }));
    expect(within(dialog).getByRole("button", { name: "현재 분석에 추가" })).toBeEnabled();
  });

  it("allows trace-name changes without reparsing or changing curve identity", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "붙여넣기 입력" }));
    const dialog = screen.getByRole("dialog", { name: "소량 표 붙여넣기" });
    await user.type(within(dialog).getByRole("textbox", { name: "표 데이터" }), "S1{enter}A1{enter}0.1");
    await user.click(within(dialog).getByRole("button", { name: "미리보기 생성" }));
    const sourceName = within(dialog).getByRole("textbox", { name: "가져오기 이름" });
    await user.clear(sourceName);
    await user.type(sourceName, "Comparison point");

    expect(within(dialog).queryByText(/입력 내용이 변경되었습니다/)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "현재 분석에 추가" }));
    expect(useAppStore.getState().dataset?.sourceFileName).toBe("Comparison point");
    expect(useAppStore.getState().dataset?.curves[0].curveId).toBe("paste0_col_A");
  });

  it("requires acknowledgement before importing fluorescence values converted to null", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "붙여넣기 입력" }));
    const dialog = screen.getByRole("dialog", { name: "소량 표 붙여넣기" });
    await user.type(within(dialog).getByRole("textbox", { name: "표 데이터" }), "S1{enter}A1{enter}bad");
    await user.click(within(dialog).getByRole("button", { name: "미리보기 생성" }));

    const appendButton = within(dialog).getByRole("button", { name: "현재 분석에 추가" });
    expect(appendButton).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: /숫자가 아닌 형광값.*A3/ })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "데이터 선택에서 위치 보기" })).toBeDisabled();
    await user.click(within(dialog).getByRole("checkbox", { name: /빈 값으로 가져오며 그래프에는 간격/ }));
    expect(appendButton).toBeEnabled();
  });

  it("makes every warning location reachable through bounded pagination", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "붙여넣기 입력" }));
    const dialog = screen.getByRole("dialog", { name: "소량 표 붙여넣기" });
    const textarea = within(dialog).getByRole("textbox", { name: "표 데이터" });
    const sourceText = ["S1", "A1", ...Array.from({ length: 26 }, () => ""), "1"].join("\n");
    await user.click(textarea);
    await user.paste(sourceText);
    await user.click(within(dialog).getByRole("button", { name: "미리보기 생성" }));

    expect(within(dialog).getByText("1 / 2")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /빈 형광값.*A3/ })).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "다음" }));
    expect(within(dialog).getByText("2 / 2")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /빈 형광값.*A28/ })).toBeInTheDocument();
  });

  it("opens single-specimen input as an independent new analysis", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "붙여넣기 입력" }));
    const dialog = screen.getByRole("dialog", { name: "소량 표 붙여넣기" });
    await user.click(within(dialog).getByRole("radio", { name: "한 검체의 시약별 값" }));
    await user.type(within(dialog).getByRole("textbox", { name: "검체명" }), "Specimen X");
    const textarea = within(dialog).getByRole("textbox", { name: "표 데이터" });
    await user.click(textarea);
    await user.paste("A1\tA2\n0.1\t0.2");
    await user.click(within(dialog).getByRole("button", { name: "미리보기 생성" }));
    await user.click(within(dialog).getByRole("button", { name: "새 분석으로 열기" }));

    expect(useAppStore.getState().analysisOrder).toHaveLength(2);
    expect(useAppStore.getState().activeAnalysisId).toBe("analysis-2");
    expect(useAppStore.getState().dataset?.curves.map((curve) => curve.specimenLabel)).toEqual([
      "Specimen X",
      "Specimen X"
    ]);
    expect(useAppStore.getState().selection?.selectedCurveIds.size).toBe(0);
    expect(useAppStore.getState().dirty).toBe(true);
  });

  it("blocks new-analysis confirmation when the preview target changed", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "붙여넣기 입력" }));
    const dialog = screen.getByRole("dialog", { name: "소량 표 붙여넣기" });
    await user.type(within(dialog).getByRole("textbox", { name: "표 데이터" }), "S1{enter}A1{enter}0.1");
    await user.click(within(dialog).getByRole("button", { name: "미리보기 생성" }));

    act(() => useAppStore.getState().setSearchQuery("changed after preview"));
    await user.click(within(dialog).getByRole("button", { name: "새 분석으로 열기" }));

    expect(useAppStore.getState().analysisOrder).toHaveLength(1);
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(/미리보기를 만든 분석이 닫혔거나 변경되었습니다/)).toBeInTheDocument();
  });

  it("does not mutate the analysis when preview parsing fails", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "붙여넣기 입력" }));
    const dialog = screen.getByRole("dialog", { name: "소량 표 붙여넣기" });
    await user.type(within(dialog).getByRole("textbox", { name: "표 데이터" }), "S1,S2{enter}A1,A2{enter}0.1,0.2");
    await user.click(within(dialog).getByRole("button", { name: "미리보기 생성" }));

    expect(within(dialog).getByRole("alert")).toHaveTextContent("Comma 구분 표");
    expect(useAppStore.getState().dataset).toBeNull();
    expect(within(dialog).getByRole("button", { name: "현재 분석에 추가" })).toBeDisabled();
  });
});
