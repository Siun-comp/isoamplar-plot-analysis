import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "../app/appStore";
import { createOneSpecimenEightReagentDataset } from "../data/sampleData";
import { AnalysisWorkspaceRecovery } from "./AnalysisWorkspaceRecovery";
import { LocalizedErrorBoundary } from "./LocalizedErrorBoundary";

function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("synthetic localized render failure");
  return <div>Recovered content</div>;
}

describe("localized error containment", () => {
  beforeEach(() => {
    useAppStore.getState().reset();
    vi.restoreAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("contains a render failure and retries without changing application state", async () => {
    const user = userEvent.setup();
    const before = useAppStore.getState().revision;
    let shouldThrow = true;
    const { rerender } = render(
      <LocalizedErrorBoundary
        resetKey="analysis-1:runtime-1"
        fallback={(reset) => <button onClick={reset}>Retry localized view</button>}
      >
        <ThrowingChild shouldThrow={shouldThrow} />
      </LocalizedErrorBoundary>
    );

    expect(screen.getByRole("button", { name: "Retry localized view" })).toBeInTheDocument();
    shouldThrow = false;
    rerender(
      <LocalizedErrorBoundary
        resetKey="analysis-1:runtime-1"
        fallback={(reset) => <button onClick={reset}>Retry localized view</button>}
      >
        <ThrowingChild shouldThrow={shouldThrow} />
      </LocalizedErrorBoundary>
    );
    await user.click(screen.getByRole("button", { name: "Retry localized view" }));
    expect(screen.getByText("Recovered content")).toBeInTheDocument();
    expect(useAppStore.getState().revision).toBe(before);

    shouldThrow = true;
    rerender(
      <LocalizedErrorBoundary
        resetKey="analysis-1:runtime-1"
        fallback={(reset) => <button onClick={reset}>Retry localized view</button>}
      >
        <ThrowingChild shouldThrow={shouldThrow} />
      </LocalizedErrorBoundary>
    );
    expect(screen.getByRole("button", { name: "Retry localized view" })).toBeInTheDocument();
    shouldThrow = false;
    rerender(
      <LocalizedErrorBoundary
        resetKey="analysis-1:runtime-2"
        fallback={(reset) => <button onClick={reset}>Retry localized view</button>}
      >
        <ThrowingChild shouldThrow={shouldThrow} />
      </LocalizedErrorBoundary>
    );
    expect(await screen.findByText("Recovered content")).toBeInTheDocument();
  });

  it("keeps Analysis XLSX saving available from the workspace fallback", async () => {
    const user = userEvent.setup();
    act(() => useAppStore.getState().loadDataset(createOneSpecimenEightReagentDataset()));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:synthetic-analysis") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn(() => undefined) });
    render(<AnalysisWorkspaceRecovery onRetry={() => undefined} />);

    await user.click(screen.getByRole("button", { name: "Analysis XLSX 저장" }));

    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/Saved .*\.xlsx/u)).toBeInTheDocument();
  });
});
