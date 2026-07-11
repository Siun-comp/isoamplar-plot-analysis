import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { PcrWarning } from "../data/types";
import { WarningInspector } from "./WarningInspector";
import { WarningNavigationProvider } from "./WarningNavigationContext";

const warnings: PcrWarning[] = [
  {
    code: "FORMULA_CACHED_VALUE_USED",
    severity: "info",
    scope: "cell",
    message: "Formula cell used its cached numeric value without recalculation.",
    curveIds: ["curve-a"],
    handling: "kept",
    sourceRefs: [
      {
        sourceInstanceId: "source-a",
        sourceName: "synthetic.xlsx",
        sourceKind: "excel",
        worksheet: "Data",
        cell: "A3",
        columnLetter: "A",
        rawValue: 42,
        displayValue: "42.0",
        cellType: "n",
        numberFormat: "0.0",
        formulaText: "40+2",
        formulaCacheStatus: "used"
      }
    ]
  },
  {
    code: "IGNORED_WORKSHEETS",
    severity: "info",
    scope: "import",
    message: "Only the first worksheet was imported; later worksheets were ignored.",
    handling: "ignored",
    sourceRefs: [{ sourceInstanceId: "source-b", sourceName: "other.xls", sourceKind: "excel" }]
  }
];

describe("WarningInspector", () => {
  it("shows source, raw/display, formula cache, and handling evidence", () => {
    render(
      <WarningNavigationProvider>
        <WarningInspector warnings={warnings} defaultOpen />
      </WarningNavigationProvider>
    );

    const detail = screen.getByRole("region", { name: "선택한 경고 상세" });
    expect(within(detail).getByText("synthetic.xlsx")).toBeInTheDocument();
    expect(within(detail).getByText("Data · A3 · A")).toBeInTheDocument();
    expect(within(detail).getByText("42")).toBeInTheDocument();
    expect(within(detail).getByText("42.0")).toBeInTheDocument();
    expect(within(detail).getByText("40+2")).toBeInTheDocument();
    expect(within(detail).getByText("used")).toBeInTheDocument();
    expect(within(detail).getByText("원본 값 유지")).toBeInTheDocument();
  });

  it("filters by source without changing warning contents", async () => {
    const user = userEvent.setup();
    render(
      <WarningNavigationProvider>
        <WarningInspector warnings={warnings} defaultOpen />
      </WarningNavigationProvider>
    );

    await user.selectOptions(screen.getByRole("combobox", { name: "원본" }), "source-b");
    expect(screen.getByRole("button", { name: /IGNORED_WORKSHEETS.*other\.xls/u })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /수식 캐시값 사용/u })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "데이터 선택에서 위치 보기" })).toBeDisabled();
  });

  it("keeps a user-collapsed inspector closed and disambiguates repeated source names", async () => {
    const user = userEvent.setup();
    const repeatedSourceWarning: PcrWarning = {
      ...warnings[0],
      sourceRefs: [{ ...warnings[0].sourceRefs![0], sourceInstanceId: "source-c" }]
    };
    const { container } = render(
      <WarningNavigationProvider>
        <WarningInspector warnings={[warnings[0], repeatedSourceWarning]} defaultOpen />
      </WarningNavigationProvider>
    );

    const sourceFilter = screen.getByRole("combobox", { name: "원본" });
    expect(within(sourceFilter).getByRole("option", { name: "synthetic.xlsx (1/2)" })).toBeInTheDocument();
    expect(within(sourceFilter).getByRole("option", { name: "synthetic.xlsx (2/2)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /synthetic\.xlsx \(1\/2\).*A3/u })).toHaveAttribute("aria-pressed", "true");
    expect(within(screen.getByRole("region", { name: "선택한 경고 상세" })).getByText("synthetic.xlsx (1/2)")).toBeInTheDocument();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    const details = container.querySelector("details");
    expect(details).toHaveAttribute("open");
    await user.click(screen.getByText("경고 상세"));
    expect(details).not.toHaveAttribute("open");
    await user.selectOptions(sourceFilter, "source-c");
    expect(details).not.toHaveAttribute("open");
  });

  it("moves detail selection with pagination instead of retaining an off-page warning", async () => {
    const user = userEvent.setup();
    const pagedWarnings = Array.from({ length: 26 }, (_, index): PcrWarning => ({
      ...warnings[0],
      sourceCell: `A${index + 1}`,
      sourceRefs: [{ ...warnings[0].sourceRefs![0], cell: `A${index + 1}` }]
    }));
    render(
      <WarningNavigationProvider>
        <WarningInspector warnings={pagedWarnings} defaultOpen />
      </WarningNavigationProvider>
    );

    await user.click(screen.getByRole("button", { name: /수식 캐시값 사용.*A2$/u }));
    expect(within(screen.getByRole("region", { name: "선택한 경고 상세" })).getByText("Data · A2 · A")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "다음" }));
    expect(within(screen.getByRole("region", { name: "선택한 경고 상세" })).getByText("Data · A26 · A")).toBeInTheDocument();
    expect(screen.queryByText("Data · A2 · A")).not.toBeInTheDocument();
  });

  it("disables dataset navigation for preview-only warnings", () => {
    render(
      <WarningNavigationProvider>
        <WarningInspector warnings={[warnings[0]]} defaultOpen enableNavigation={false} />
      </WarningNavigationProvider>
    );

    expect(screen.getByRole("button", { name: "데이터 선택에서 위치 보기" })).toBeDisabled();
  });
});
