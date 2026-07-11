import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../app/App";
import { useAppStore } from "../app/appStore";

const inspectorFailure = vi.hoisted(() => ({ remaining: 2 }));

vi.mock("./WarningInspector", () => ({
  WarningInspector: ({ warnings }: { warnings: unknown[] }) => {
    if (warnings.length > 0 && inspectorFailure.remaining > 0) {
      inspectorFailure.remaining -= 1;
      throw new Error("synthetic paste preview render failure");
    }
    return <div>Recovered warning inspector</div>;
  }
}));

describe("Quick Paste dialog error containment", () => {
  beforeEach(() => {
    useAppStore.getState().reset();
    inspectorFailure.remaining = 2;
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("contains preview rendering, keeps the app shell, and retries without analysis mutation", async () => {
    const user = userEvent.setup();
    render(<App />);
    const beforeRevision = useAppStore.getState().revision;
    await user.click(screen.getByRole("button", { name: "빠른 붙여넣기" }));
    const dialog = screen.getByRole("dialog", { name: "소량 표 붙여넣기" });
    await user.click(within(dialog).getByRole("radio", { name: "한 검체의 시약별 값" }));
    fireEvent.change(within(dialog).getByRole("textbox", { name: "검체명" }), { target: { value: "Recovery specimen" } });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "표 데이터" }), { target: { value: "A1\nbad" } });
    await user.click(within(dialog).getByRole("button", { name: "미리보기 생성" }));

    expect(screen.getByRole("alert")).toHaveTextContent("현재 분석과 입력 원문은 유지되었습니다");
    expect(screen.getByRole("tab", { name: "Analysis 1" })).toBeInTheDocument();
    expect(screen.getByText("데이터 가져오기")).toBeInTheDocument();
    expect(useAppStore.getState().revision).toBe(beforeRevision);

    inspectorFailure.remaining = 0;
    await user.click(screen.getByRole("button", { name: "다시 시도" }));
    const recoveredDialog = screen.getByRole("dialog", { name: "소량 표 붙여넣기" });
    expect(recoveredDialog).toHaveAttribute("open");
    expect(within(recoveredDialog).getByRole("radio", { name: "한 검체의 시약별 값" })).toBeChecked();
    expect(within(recoveredDialog).getByRole("textbox", { name: "검체명" })).toHaveValue("Recovery specimen");
    expect(within(recoveredDialog).getByRole("textbox", { name: "표 데이터" })).toHaveValue("A1\nbad");
    expect(screen.getByText("Recovered warning inspector")).toBeInTheDocument();
    expect(useAppStore.getState().revision).toBe(beforeRevision);
  });
});
