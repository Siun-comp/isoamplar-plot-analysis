import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createOneSpecimenEightReagentDataset } from "../data/sampleData";
import { App } from "./App";
import { useAppStore } from "./appStore";

const chartFailure = vi.hoisted(() => ({ active: true }));

vi.mock("../ui/ChartPanel", () => ({
  ChartPanel: () => {
    if (chartFailure.active) throw new Error("synthetic workspace render failure");
    return <div>Recovered chart panel</div>;
  }
}));

describe("App workspace error containment", () => {
  beforeEach(() => {
    useAppStore.getState().reset();
    chartFailure.active = true;
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("keeps tabs, import, recovery save, and state available while the workspace is contained", async () => {
    const user = userEvent.setup();
    act(() => useAppStore.getState().loadDataset(createOneSpecimenEightReagentDataset()));
    const primaryAnalysisId = useAppStore.getState().activeAnalysisId;
    act(() => {
      useAppStore.getState().renameAnalysis(primaryAnalysisId, "Primary analysis");
      useAppStore.getState().createAnalysis("Recovery analysis");
      useAppStore.getState().loadDataset(createOneSpecimenEightReagentDataset());
      useAppStore.getState().renameAnalysis(useAppStore.getState().activeAnalysisId, "Recovery analysis");
    });
    const recoveryAnalysisId = useAppStore.getState().activeAnalysisId;
    const before = {
      revision: useAppStore.getState().revision,
      dirty: useAppStore.getState().dirty,
      orderedCurveIds: [...(useAppStore.getState().selection?.orderedCurveIds ?? [])]
    };
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:workspace-recovery") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn(() => undefined) });
    render(<App />);

    expect(screen.getByRole("tab", { name: /Recovery analysis/u })).toBeInTheDocument();
    expect(screen.getByText("데이터 가져오기")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analysis XLSX 저장" })).toBeEnabled();
    expect(useAppStore.getState().revision).toBe(before.revision);
    expect(useAppStore.getState().dirty).toBe(before.dirty);
    expect([...(useAppStore.getState().selection?.orderedCurveIds ?? [])]).toEqual(before.orderedCurveIds);

    await user.click(screen.getByRole("button", { name: "Analysis XLSX 저장" }));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/Saved .*\.xlsx/u)).toBeInTheDocument();
    expect(useAppStore.getState().activeAnalysisId).toBe(recoveryAnalysisId);
    expect(useAppStore.getState().dirty).toBe(false);

    chartFailure.active = false;
    await user.click(screen.getByRole("tab", { name: /Primary analysis/u }));
    expect(useAppStore.getState().activeAnalysisId).toBe(primaryAnalysisId);
    expect(screen.getByText("Recovered chart panel")).toBeInTheDocument();
  });
});
