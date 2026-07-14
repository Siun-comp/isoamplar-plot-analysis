import { expect, test as base, type Locator, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import * as XLSX from "xlsx";
import { readAnalysisWorkbookBuffer } from "../../src/analysis/analysisWorkbook";
import { calculateLegendEvidenceRegions, exportPixelRatio } from "../../src/chart/exportChart";
import { findOverlappingBounds, inspectRasterDataUrl, inspectRasterRegions } from "./helpers/rasterEvidence";

type NetworkGuardControl = {
  violations: string[];
  browserErrors: string[];
  acknowledgeExpectedViolations: () => void;
  acknowledgeExpectedBrowserErrors: () => void;
};

const test = base.extend<{ browserLocalNetworkGuard: NetworkGuardControl }>({
  browserLocalNetworkGuard: [
    async ({ context }, use, testInfo) => {
      const configuredBaseUrl = testInfo.project.use.baseURL;
      if (typeof configuredBaseUrl !== "string") throw new Error("Playwright baseURL must be configured.");
      const appUrl = new URL(configuredBaseUrl);
      const appOrigin = appUrl.origin;
      const appBasePath = appUrl.pathname.endsWith("/") ? appUrl.pathname : `${appUrl.pathname}/`;
      const evidence = {
        allowed: [] as string[],
        expectedBlockedProbes: [] as string[],
        expectedBrowserErrors: [] as string[],
        violations: [] as string[]
      };
      const browserDiagnostics: string[] = [];
      const browserErrors: string[] = [];
      const attachDiagnostics = (targetPage: Page) => {
        targetPage.on("console", (message) => {
          const entry = `CONSOLE ${message.type()} ${message.text()}`;
          browserDiagnostics.push(entry);
          if (message.type() === "error") browserErrors.push(entry);
        });
        targetPage.on("pageerror", (error) => {
          const entry = `PAGEERROR ${error.message}`;
          browserDiagnostics.push(entry);
          browserErrors.push(entry);
        });
        targetPage.on("requestfailed", (request) => {
          browserDiagnostics.push(
            `REQUESTFAILED ${request.method()} ${request.resourceType()} ${request.url()} ${request.failure()?.errorText ?? "unknown"}`
          );
        });
      };
      context.pages().forEach(attachDiagnostics);
      context.on("page", attachDiagnostics);

      await context.route("**/*", async (route) => {
        const url = route.request().url();
        const requestEvidence = `${route.request().method()} ${route.request().resourceType()} ${url}`;
        if (isAllowedBrowserLocalUrl(url, route.request().method(), appOrigin, appBasePath)) {
          evidence.allowed.push(requestEvidence);
          await route.continue();
          return;
        }
        evidence.violations.push(requestEvidence);
        await route.abort("blockedbyclient");
      });

      await context.routeWebSocket(
        (url) => {
          evidence.violations.push(`WEBSOCKET websocket ${url.href}`);
          return true;
        },
        async (socket) => socket.close({ code: 1008, reason: "Browser-local analysis blocks WebSocket connections." })
      );

      await use({
        violations: evidence.violations,
        browserErrors,
        acknowledgeExpectedViolations: () => {
          evidence.expectedBlockedProbes.push(...evidence.violations.splice(0));
        },
        acknowledgeExpectedBrowserErrors: () => {
          evidence.expectedBrowserErrors.push(...browserErrors.splice(0));
        }
      });

      await testInfo.attach("browser-local-network-evidence", {
        body: JSON.stringify(
          {
            appOrigin,
            allowedRequestCount: evidence.allowed.length,
            expectedBlockedProbes: evidence.expectedBlockedProbes,
            expectedBrowserErrors: evidence.expectedBrowserErrors,
            violations: evidence.violations
          },
          null,
          2
        ),
        contentType: "application/json"
      });
      await testInfo.attach("browser-console.txt", {
        body: browserDiagnostics.length > 0 ? `${browserDiagnostics.join("\n")}\n` : "No browser console, page, or request errors.\n",
        contentType: "text/plain"
      });
      expect(evidence.violations, "Unexpected cross-origin browser request").toEqual([]);
      expect(browserErrors, "Unexpected browser console or page error").toEqual([]);
    },
    { auto: true }
  ]
});

function isAllowedBrowserLocalUrl(value: string, method: string, appOrigin: string, appBasePath: string) {
  const url = new URL(value);
  if (url.protocol === "blob:" || url.protocol === "data:") return true;
  if (url.origin !== appOrigin || !["GET", "HEAD"].includes(method)) return false;
  if (url.pathname === appBasePath || url.pathname.startsWith(`${appBasePath}assets/`)) return true;
  return ["favicon.svg", "favicon-32.png", "favicon-16.png", "apple-touch-icon.png", "manifest.webmanifest"].some(
    (fileName) => url.pathname === `${appBasePath}${fileName}`
  );
}

test("renders the upload-first PCR workspace", async ({ page }) => {
  await page.goto("./");

  const configuredPath = new URL(process.env.E2E_BASE_URL ?? "http://127.0.0.1:4174").pathname;
  if (configuredPath !== "/") expect(new URL(page.url()).pathname).toBe(configuredPath);

  await expect(page.getByRole("heading", { name: "IsoAmplar Plot Analysis" })).toBeVisible();
  await expect(page.getByText("Developer Jang Si Un")).toBeVisible();
  await expect(page.getByRole("heading", { name: "데이터 가져오기" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "데이터 선택" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "그래프 미리보기" })).toBeVisible();
  await expect(page.getByText("원본 Excel은 첫 번째 시트만 읽고, 모든 데이터는 브라우저 안에서 처리합니다.")).toBeVisible();
});

test("blocks synthetic cross-origin browser transports", async ({ page, browserLocalNetworkGuard }) => {
  await page.goto("./");
  await page.evaluate(async () => {
    const settleImage = new Promise<void>((resolve) => {
      const image = new Image();
      image.onload = () => resolve();
      image.onerror = () => resolve();
      image.src = "https://blocked.invalid/image";
    });
    const settleXhr = new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.onloadend = () => resolve();
      xhr.onerror = () => resolve();
      xhr.open("GET", "https://blocked.invalid/xhr");
      xhr.send();
    });
    const settleWebSocket = new Promise<void>((resolve) => {
      const socket = new WebSocket("wss://blocked.invalid/ws");
      socket.onerror = () => resolve();
      socket.onclose = () => resolve();
      window.setTimeout(resolve, 1_000);
    });
    const fetchGet = fetch("https://blocked.invalid/fetch").catch(() => undefined);
    const fetchPost = fetch("https://blocked.invalid/post", { method: "POST", body: "synthetic" }).catch(() => undefined);
    const sameOriginPost = fetch(new URL("synthetic-upload", window.location.href), {
      method: "POST",
      body: "synthetic"
    }).catch(() => undefined);
    navigator.sendBeacon("https://blocked.invalid/beacon", "synthetic");
    await Promise.all([settleImage, settleXhr, settleWebSocket, fetchGet, fetchPost, sameOriginPost]);
  });

  await expect.poll(() => browserLocalNetworkGuard.violations.length).toBe(7);
  const evidence = browserLocalNetworkGuard.violations.join("\n");
  for (const transport of ["/image", "/xhr", "/fetch", "/post", "/beacon", "/ws", "/synthetic-upload"]) {
    expect(browserLocalNetworkGuard.violations.filter((entry) => entry.includes(transport))).toHaveLength(1);
  }
  expect(evidence).toContain("POST");
  expect(evidence).toContain("WEBSOCKET");
  browserLocalNetworkGuard.acknowledgeExpectedViolations();
  await expect.poll(() => browserLocalNetworkGuard.browserErrors.length).toBe(6);
  browserLocalNetworkGuard.browserErrors.forEach((entry) => expect(entry).toContain("ERR_BLOCKED_BY_CLIENT"));
  browserLocalNetworkGuard.acknowledgeExpectedBrowserErrors();
});

test("previews and imports full-table and single-specimen pasted data", async ({ page }, testInfo) => {
  await page.goto("./");
  await page.getByRole("button", { name: "빠른 붙여넣기" }).click();
  let dialog = page.getByRole("dialog", { name: "소량 표 붙여넣기" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "표 데이터" })).toBeFocused();
  await dialog
    .getByRole("textbox", { name: "표 데이터" })
    .fill("Synthetic Sample\tSynthetic Sample\nAssay 1\tAssay 2\n0.1\t0.2\n1.1\t1.2\n4.1\t4.2");
  await dialog.getByRole("button", { name: "미리보기 생성" }).click();
  await expect(dialog.getByText("측정 곡선 2개")).toBeVisible();
  await expect(dialog.getByText("Cycle 3개")).toBeVisible();
  await expect(dialog.getByRole("table")).toBeVisible();
  await expect(page.getByText("가져오기 전")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("quick-paste-preview.png"), fullPage: false });
  await dialog.getByRole("button", { name: "현재 분석에 추가" }).click();

  await expect(dialog).toHaveCount(0);
  await expect(page.getByText(/Paste import 1 · 곡선 2개/)).toBeVisible();
  await page.getByRole("searchbox", { name: "검색" }).fill("Assay 1");
  await page.getByRole("button", { name: "표시 선택" }).click();
  await expect(page.getByText("1개 curve 선택됨")).toBeVisible();
  await expect(page.locator(".echarts-surface canvas")).toBeVisible();

  await page.getByRole("button", { name: "빠른 붙여넣기" }).click();
  dialog = page.getByRole("dialog", { name: "소량 표 붙여넣기" });
  await dialog.getByRole("radio", { name: "한 검체의 시약별 값" }).click();
  await dialog.getByRole("textbox", { name: "검체명" }).fill("Comparison Sample");
  await dialog.getByRole("textbox", { name: "표 데이터" }).fill("Assay 3\n0.3\n1.3");
  await dialog.getByRole("button", { name: "미리보기 생성" }).click();
  await expect(dialog.getByText("측정 곡선 1개")).toBeVisible();
  await dialog.getByRole("button", { name: "새 분석으로 열기" }).click();

  await expect(page.getByRole("tab", { name: "Paste import 2" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText(/Paste import 2 · 곡선 1개/)).toBeVisible();
  await expect(page.getByText("선택 0")).toBeVisible();
});

test("previews every documented Quick Paste boundary shape in Chromium", async ({ page }) => {
  test.setTimeout(120_000);

  const tall = ["S", "A", ...Array.from({ length: 249_998 }, () => "0")].join("\n");
  await previewBoundaryPaste(page, tall, "행 250,000개", "Cycle 249,998개");

  const wideHeader = Array.from({ length: 83_333 }, () => "S").join("\t");
  const wideReagent = Array.from({ length: 83_333 }, () => "A").join("\t");
  const wideValues = Array.from({ length: 83_333 }, () => "0").join("\t");
  await previewBoundaryPaste(page, `${wideHeader}\n${wideReagent}\n${wideValues}`, "열 83,333개", "측정 곡선 83,333개");

  const balancedHeader = Array.from({ length: 500 }, () => "S").join("\t");
  const balancedReagent = Array.from({ length: 500 }, () => "A").join("\t");
  const blankRow = Array.from({ length: 500 }, () => "").join("\t");
  const finalRow = Array.from({ length: 500 }, () => "0").join("\t");
  const emptyHeavy = [balancedHeader, balancedReagent, ...Array.from({ length: 497 }, () => blankRow), finalRow].join("\n");
  await previewBoundaryPaste(page, emptyHeavy, "Cell 250,000개", "경고 248,501개");
});

test("uploads an xlsx workbook and keeps reagent-first collapsed selection", async ({ page }, testInfo) => {
  const workbookPath = testInfo.outputPath("phase3-upload.xlsx");
  const appendWorkbookPath = testInfo.outputPath("phase3-append.xlsx");
  writeWorkbookFixture(workbookPath, "검체 1");
  writeWorkbookFixture(appendWorkbookPath, "검체 2");

  await page.goto("./");
  await page.getByTestId("original-data-input").setInputFiles(workbookPath);

  await expect(page.getByText(/phase3-upload.xlsx · 곡선 2개/)).toBeVisible();
  const primaryFileInput = page.getByTestId("original-data-input");
  await primaryFileInput.setInputFiles(appendWorkbookPath);
  const replaceDialog = page.getByRole("alertdialog", { name: "저장 안 된 분석" });
  await expect(replaceDialog).toBeVisible();
  await expect(replaceDialog.getByRole("button", { name: "Cancel file replace" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(replaceDialog).toBeHidden();
  await expect(primaryFileInput).toBeFocused();

  await expect(page.getByRole("radio", { name: "시약별" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("button", { name: /▸ A1/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /▸ A2/ })).toBeVisible();
  await expect(page.getByText("검체 1 │ A1")).toHaveCount(0);

  await page.getByRole("button", { name: /▸ A1/ }).click();
  const expandedA1Group = page.getByRole("button", { name: /▾ A1/ }).locator("xpath=ancestor::section[1]");
  await expect(expandedA1Group.getByRole("checkbox", { name: /^A1 │ 검체 1 선택/u })).toBeVisible();

  await page.getByRole("searchbox", { name: "검색" }).fill("A2");
  await expect(page.getByText("표시 1")).toBeVisible();
  await page.getByRole("button", { name: "표시 선택" }).click();
  await expect(page.getByText("선택 1")).toBeVisible();
  await expect(page.getByText("1개 curve 선택됨")).toBeVisible();

  await page.getByTestId("append-excel-input").setInputFiles(appendWorkbookPath);
  await expect(page.getByText(/combined_2_files · 곡선 4개/)).toBeVisible();
  await expect(page.getByText("선택 1")).toBeVisible();
  await expect(page.getByText("1개 curve 선택됨")).toBeVisible();

  const canvas = page.locator(".echarts-surface canvas");
  await expect(canvas).toBeVisible();
  await expect
    .poll(async () => await countNonWhiteCanvasPixels(canvas))
    .toBeGreaterThan(100);
  await expect(page.getByLabel("Chart point readout")).toContainText("Cycle -");
  await hoverUntilChartReadoutUpdates(page, canvas);
  await applyBoxZoom(page, canvas);
  await expect(page.getByRole("button", { name: "Box zoom" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText("Fixed X/Y scale applied. Previous scale is available.")).toBeVisible();
  const xAxis = page.getByRole("region", { name: "X axis" });
  const yAxis = page.getByRole("region", { name: "Y axis" });
  await expect(xAxis.getByRole("button", { name: "Fixed" })).toHaveClass(/is-active/);
  await expect(yAxis.getByRole("button", { name: "Fixed" })).toHaveClass(/is-active/);
  await expect(xAxis.getByRole("spinbutton").first()).not.toHaveValue("");
  await expect(yAxis.getByRole("spinbutton").first()).not.toHaveValue("");
  await expect(page.getByRole("button", { name: "Previous scale" })).toBeEnabled();
  await page.getByRole("button", { name: "Previous scale" }).click();
  await expect(page.getByText("Previous scale restored.")).toBeVisible();
  await expect(xAxis.getByRole("button", { name: "Auto" })).toHaveClass(/is-active/);
  await expect(yAxis.getByRole("button", { name: "Auto" })).toHaveClass(/is-active/);
  await expect(page.getByRole("button", { name: "Previous scale" })).toBeDisabled();

  await yAxis.getByRole("button", { name: "Fixed" }).click();
  const yFixedInputs = yAxis.getByRole("spinbutton");
  await yFixedInputs.nth(0).fill("-1");
  await yFixedInputs.nth(1).fill("100");
  await expect(yAxis.getByText("Applied: Fixed -1 - 100")).toBeVisible();
  await yFixedInputs.nth(1).fill("-2");
  await expect(yAxis.getByText(/last valid scale remains applied/i)).toBeVisible();
  const exportSummary = page.locator(".settings-accordion > details > summary", {
    hasText: "Export",
  });
  const exportDetails = exportSummary.locator("..");
  if ((await exportDetails.getAttribute("open")) === null) {
    await exportSummary.click();
  }
  await expect(exportDetails).toHaveAttribute("open", "");
  await expect(page.getByRole("button", { name: "Save PNG" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "분석 저장" })).toBeEnabled();

  const chartWrap = page.locator(".chart-canvas-wrap");
  const before = await chartWrap.boundingBox();
  await expect(page.getByRole("region", { name: "Custom legend" })).toBeVisible();
  await expect(page.locator('.custom-legend [data-marker-type="none"]')).toHaveCount(1);
  await page.locator(".settings-accordion summary", { hasText: "Style" }).click();
  await expect(page.getByLabel("현재 스타일 기준")).toContainText("마커 시약별");
  await expect(page.getByLabel("마커 기준")).toBeVisible();
  await page.getByLabel("선 기준").selectOption("reagent");
  await page.getByLabel("A2 line and marker editor").click();
  await page.getByRole("button", { name: "A2 line dashed" }).click();
  await page.getByLabel("A2 line and marker editor").click();
  await page.getByRole("button", { name: "A2 marker circle" }).click();
  await page.getByLabel("A2 │ 검체 1 line and marker editor", { exact: true }).click();
  await expect(page.getByRole("button", { name: "A2 │ 검체 1 marker circle" })).toHaveAttribute("aria-pressed", "true");
  const a2LegendItem = page.getByRole("region", { name: "Custom legend" }).getByTitle("A2 │ 검체 1").locator("..");
  await expect(a2LegendItem.locator('[data-line-type="dashed"][data-marker-type="circle"]')).toHaveCount(1);
  await a2LegendItem.hover();
  await expect(a2LegendItem).toHaveClass(/custom-legend-item-active/u);
  await expect(a2LegendItem.locator('[data-line-type="dashed"][data-marker-type="circle"]')).toHaveCount(1);
  await page.mouse.move(0, 0);
  await expect(a2LegendItem).not.toHaveClass(/custom-legend-item-active/u);
  await page.screenshot({ path: testInfo.outputPath("phase-r8-style-legend-panel.png"), fullPage: false });
  await page.locator(".settings-accordion > details > summary", { hasText: "Legend" }).click();
  const orderTab = page.getByRole("tab", { name: "Order" });
  const labelsTab = page.getByRole("tab", { name: "Labels" });
  const orderPanelId = await orderTab.getAttribute("aria-controls");
  const labelsPanelId = await labelsTab.getAttribute("aria-controls");
  const orderPanel = page.locator(`[id="${orderPanelId}"]`);
  const labelsPanel = page.locator(`[id="${labelsPanelId}"]`);
  await expect(page.getByRole("tabpanel", { name: "Order" })).toBeVisible();
  await expect(page.getByRole("tabpanel", { name: "Labels" })).toHaveCount(0);
  await expect(labelsPanel).toHaveCSS("display", "none");
  await labelsTab.click();
  await expect(page.getByRole("tabpanel", { name: "Order" })).toHaveCount(0);
  await expect(page.getByRole("tabpanel", { name: "Labels" })).toBeVisible();
  await expect(orderPanel).toHaveCSS("display", "none");
  await page.getByLabel("Image export layout").selectOption("legendOnly");
  await expect(page.getByRole("button", { name: "Save PNG" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Copy selected layout PNG to clipboard" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy report legend Excel cells" })).toBeVisible();
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined }));
  await page.getByRole("button", { name: "Copy selected layout PNG to clipboard" }).click();
  await expect(page.locator(".export-message")).toContainText("Download PNG instead.");
  await page.getByText("Legend file save").click();
  await expect(page.getByRole("button", { name: "Save report legend PNG" })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save PNG" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^\d{6}_.+_plot1\.png$/u);
  const after = await chartWrap.boundingBox();

  expect(before).not.toBeNull();
  expect(after).not.toBeNull();
  expect(Math.abs((after?.height ?? 0) - (before?.height ?? 0))).toBeLessThan(2);

  await page.evaluate(() => window.scrollTo(0, 300));
  await expect
    .poll(async () => {
      const box = await page.locator(".chart-panel").boundingBox();
      return box?.y ?? 999;
    })
    .toBeLessThan(36);
});

test("keeps dense Style and sticky plot inspectable at desktop viewports", async ({ page }, testInfo) => {
  const workbookPath = testInfo.outputPath("s8-dense-desktop.xlsx");
  writeDenseWorkbookFixture(workbookPath, 100);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("./");
  await page.getByTestId("original-data-input").setInputFiles(workbookPath);
  await page.getByRole("button", { name: "표시 선택" }).click();
  await page.locator(".settings-accordion > details > summary", { hasText: "Style" }).click();

  const individualStyleScroll = page.locator(".individual-style-scroll");
  for (const index of [1, 50, 100]) {
    const reagentNumber = String(((index - 1) % 8) + 1).padStart(2, "0");
    const specimenNumber = String(Math.floor((index - 1) / 8) + 1).padStart(2, "0");
    const editor = page.getByLabel(
      `Assay ${reagentNumber} │ Synthetic specimen ${specimenNumber} with long label line and marker editor`,
      { exact: true }
    );
    await editor.scrollIntoViewIfNeeded();
    await editor.click();
    const panel = page.getByRole("dialog", { name: `${await editor.getAttribute("aria-label")} options` });
    const panelBox = await panel.boundingBox();
    expect(panelBox).not.toBeNull();
    expect(panelBox!.x).toBeGreaterThanOrEqual(7);
    expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(1273);
    expect(panelBox!.y).toBeGreaterThanOrEqual(7);
    expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual(713);
    await expect(panel.locator(":focus")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(editor).toBeFocused();
  }

  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 }
  ]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const measurement = await page.evaluate(() => {
      const chart = document.querySelector(".chart-panel")?.getBoundingClientRect();
      const canvas = document.querySelector(".chart-canvas-wrap")?.getBoundingClientRect();
      const styleScroll = document.querySelector(".individual-style-scroll");
      return {
        innerWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        chartTop: chart?.top ?? -1,
        chartHeight: chart?.height ?? -1,
        canvasHeight: canvas?.height ?? -1,
        styleClientWidth: styleScroll?.clientWidth ?? -1,
        styleScrollWidth: styleScroll?.scrollWidth ?? -1
      };
    });

    expect(measurement.documentWidth).toBeLessThanOrEqual(measurement.innerWidth);
    expect(measurement.chartTop).toBeGreaterThanOrEqual(0);
    expect(measurement.chartTop).toBeLessThan(40);
    expect(measurement.chartHeight).toBeLessThanOrEqual(viewport.height - 30);
    expect(measurement.canvasHeight).toBeGreaterThanOrEqual(559);
    expect(measurement.canvasHeight).toBeLessThanOrEqual(562);
    expect(measurement.styleScrollWidth).toBeLessThanOrEqual(measurement.styleClientWidth);

    if (viewport.width === 1366) {
      await page.screenshot({ path: testInfo.outputPath("s8-dense-1366x768.png"), fullPage: false });
    }
  }
});

test.describe("S9 performance evidence", () => {
test.describe.configure({ retries: 0 });

test("records reusable S9 reference and stress workload measurements", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  expect(testInfo.retry).toBe(0);
  const measurements: Array<Record<string, number | string>> = [];

  for (const workload of [
    { name: "reference-20x100", curveCount: 20 },
    { name: "stress-100x100", curveCount: 100 }
  ]) {
    const workbookPath = testInfo.outputPath(`s9-${workload.name}.xlsx`);
    writeDenseWorkbookFixture(workbookPath, workload.curveCount, 100);
    await page.goto("./");

    const importStarted = performance.now();
    await page.getByTestId("original-data-input").setInputFiles(workbookPath);
    await expect(page.getByText(`곡선 ${workload.curveCount}개`, { exact: false })).toBeVisible({ timeout: 15_000 });
    const importMs = performance.now() - importStarted;

    const selectionStarted = performance.now();
    await page.getByRole("button", { name: "표시 선택" }).click();
    await expect(page.getByText(`${workload.curveCount}개 curve 선택됨`)).toBeVisible();
    const canvas = page.locator(".echarts-surface canvas");
    await expect(canvas).toBeVisible();
    await expect.poll(async () => await countNonWhiteCanvasPixels(canvas), { timeout: 15_000 }).toBeGreaterThan(100);
    const selectionAndChartMs = performance.now() - selectionStarted;

    const chartBox = await page.locator(".echarts-surface").boundingBox();
    expect(chartBox).not.toBeNull();
    const hoverStarted = performance.now();
    for (let index = 0; index < 20; index += 1) {
      await page.mouse.move(
        chartBox!.x + chartBox!.width * (0.25 + index * 0.025),
        chartBox!.y + chartBox!.height * (0.35 + (index % 5) * 0.1)
      );
    }
    await hoverUntilChartReadoutUpdates(page, page.locator(".echarts-surface"));
    const hoverReadoutSettledMs = performance.now() - hoverStarted;

    const styleStarted = performance.now();
    await page.locator(".settings-accordion > details > summary", { hasText: "Style" }).click();
    await expect(page.getByRole("region", { name: "개별 curve 스타일" })).toBeVisible();
    const styleOpenMs = performance.now() - styleStarted;
    const domElementCount = await page.evaluate(() => document.getElementsByTagName("*").length);

    await page.locator(".settings-accordion > details > summary", { hasText: "Style" }).click();
    const legendStarted = performance.now();
    await page.locator(".settings-accordion > details > summary", { hasText: "Legend" }).click();
    await page.getByRole("tab", { name: "Labels" }).click();
    const labelEditor = page.getByRole("region", { name: "Analysis label editor" });
    await expect(labelEditor).toBeVisible();
    const legendLabelsOpenMs = performance.now() - legendStarted;
    const legendDomElementCount = await page.evaluate(() => document.getElementsByTagName("*").length);

    if (workload.curveCount === 100) {
      const labelRows = labelEditor.locator(".report-legend-row");
      await expect(labelRows).toHaveCount(100);
      const lastLabelRow = labelRows.nth(99);
      const lastLabelInput = lastLabelRow.locator("input");
      await lastLabelInput.scrollIntoViewIfNeeded();
      await lastLabelInput.fill("Synthetic review label 100");
      await expect(lastLabelInput).toHaveValue("Synthetic review label 100");
      await lastLabelRow.getByRole("button").click();
      await expect(lastLabelInput).toHaveValue("");
    }

    const tabStarted = performance.now();
    await page.getByRole("button", { name: "새 분석" }).click();
    await expect(page.getByRole("tab", { name: "Analysis 2" })).toBeVisible();
    const oldAnalysisTab = page.getByRole("tab", { name: `s9-${workload.name}.xlsx` });
    await oldAnalysisTab.click();
    await expect(oldAnalysisTab).toHaveAttribute("aria-selected", "true");
    const tabRoundTripMs = performance.now() - tabStarted;

    const exportStarted = performance.now();
    await page.locator(".settings-accordion > details > summary", { hasText: "Export" }).click();
    await expect(page.getByRole("button", { name: "Save PNG" })).toBeVisible();
    await expect(page.getByLabel("Image export layout")).toHaveValue("plotOnly");
    await page.getByLabel("Image export layout").selectOption("plotOnly");
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Save PNG" }).click();
    const plotDownload = await downloadPromise;
    if (workload.curveCount === 20) {
      const plotPath = testInfo.outputPath("report-profile-plot-only.png");
      await plotDownload.saveAs(plotPath);
      const raster = await inspectRasterDataUrl(
        page,
        `data:image/png;base64,${readFileSync(plotPath).toString("base64")}`
      );
      expect(raster.width).toBe(2400);
      expect(raster.height).toBe(1520);
      expect(raster.whiteCornerPixels).toBe(4);
      expect(raster.transparentPixels).toBe(0);
      expect(raster.nonWhitePixels).toBeGreaterThan(1_000);
      expect(raster.nonWhiteBounds).not.toBeNull();
      expect(raster.nonWhiteBounds!.left).toBeGreaterThan(0);
      expect(raster.nonWhiteBounds!.right).toBeLessThan(raster.width);
      expect(raster.nonWhiteBounds!.top).toBeGreaterThan(0);
      expect(raster.nonWhiteBounds!.bottom).toBeLessThan(raster.height);
    }
    const plotOnlyPngExportMs = performance.now() - exportStarted;

    measurements.push({
      workload: workload.name,
      cacheState: workload.curveCount === 20 ? "cold-first-import" : "warm-module-cache",
      attempt: 1,
      curves: workload.curveCount,
      cycles: 100,
      importMs: roundMeasurement(importMs),
      selectionAndChartMs: roundMeasurement(selectionAndChartMs),
      hoverReadoutSettledMs: roundMeasurement(hoverReadoutSettledMs),
      styleOpenMs: roundMeasurement(styleOpenMs),
      legendLabelsOpenMs: roundMeasurement(legendLabelsOpenMs),
      tabRoundTripMs: roundMeasurement(tabRoundTripMs),
      plotOnlyPngExportMs: roundMeasurement(plotOnlyPngExportMs),
      styleDomElementCount: domElementCount,
      legendDomElementCount
    });
  }

  const evidence = JSON.stringify({ measuredAt: new Date().toISOString(), measurements }, null, 2);
  await testInfo.attach("s9-performance-measurements", { body: evidence, contentType: "application/json" });
  console.log(`S9_PERFORMANCE ${JSON.stringify(measurements)}`);
});
});

test("preserves long legend identity and distinguishable line-marker raster samples", async ({ page }, testInfo) => {
  const workbookPath = testInfo.outputPath("s3-legend-identity.xlsx");
  writeLegendIdentityWorkbook(workbookPath);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("./");
  await page.getByTestId("original-data-input").setInputFiles(workbookPath);
  await page.getByRole("button", { name: "표시 선택" }).click();

  const lotALabel = "Assay concentration profile with distinguishing Lot A";
  const lotBLabel = "Assay concentration profile with distinguishing Lot B";
  const legend = page.getByRole("region", { name: "Custom legend" });
  await expect(legend.getByText(/Lot A/u)).toBeVisible();
  await expect(legend.getByText(/Lot B/u)).toBeVisible();
  await expect(legend.getByRole("alert")).toHaveCount(0);

  await page.locator(".settings-accordion > details > summary", { hasText: "Style" }).click();
  await page.getByLabel("선 기준").selectOption("reagent");
  await setGroupLineMarker(page, lotALabel, "dashed", "circle");
  await setGroupLineMarker(page, lotBLabel, "dotted", "rect");
  await expect(legend.locator('[data-line-type="dashed"][data-marker-type="circle"]')).toHaveCount(1);
  await expect(legend.locator('[data-line-type="dotted"][data-marker-type="rect"]')).toHaveCount(1);
  const legendBounds = await legend.evaluate((root) => {
    const bounds = (element: Element, id: string) => {
      const box = element.getBoundingClientRect();
      return { id, left: box.left, top: box.top, right: box.right, bottom: box.bottom };
    };
    return Array.from(root.querySelectorAll(".custom-legend-item")).map((item, index) => ({
      item: bounds(item, `item-${index}`),
      sample: bounds(item.querySelector(".legend-sample")!, `sample-${index}`),
      label: bounds(item.querySelector(".custom-legend-label")!, `label-${index}`)
    }));
  });
  expect(findOverlappingBounds(legendBounds.map((entry) => entry.item))).toEqual([]);
  legendBounds.forEach(({ item, sample, label }) => {
    expect(sample.right).toBeLessThanOrEqual(label.left);
    expect(sample.left).toBeGreaterThanOrEqual(item.left);
    expect(label.right).toBeLessThanOrEqual(item.right + 1);
    expect(label.top).toBeGreaterThanOrEqual(item.top - 1);
    expect(label.bottom).toBeLessThanOrEqual(item.bottom + 1);
  });
  await page.screenshot({ path: testInfo.outputPath("s3-legend-preview.png"), fullPage: false });

  const exportSummary = page.locator(".settings-accordion > details > summary", { hasText: "Export" });
  const exportDetails = exportSummary.locator("..");
  if ((await exportDetails.getAttribute("open")) === null) await exportSummary.click();
  await page.getByLabel("Image export layout").selectOption("legendOnly");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save PNG" }).click();
  const download = await downloadPromise;
  const downloadedPath = testInfo.outputPath("s3-legend-only.png");
  await download.saveAs(downloadedPath);
  const dataUrl = `data:image/png;base64,${readFileSync(downloadedPath).toString("base64")}`;
  const raster = await inspectRasterDataUrl(page, dataUrl);
  const samples = await inspectLegendStyleSamples(page, dataUrl);
  const exportedColors = await legend.locator(".legend-sample line").evaluateAll((lines) =>
    lines.map((line) => line.getAttribute("stroke") ?? "#000000")
  );
  const evidenceRegions = calculateLegendEvidenceRegions(2).flatMap((region, index) => [
    {
      id: `sample-${index}`,
      left: region.sample.left * exportPixelRatio,
      top: region.sample.top * exportPixelRatio,
      right: region.sample.right * exportPixelRatio,
      bottom: region.sample.bottom * exportPixelRatio,
      expectedColor: exportedColors[index]
    },
    {
      id: `text-${index}`,
      left: region.text.left * exportPixelRatio,
      top: region.text.top * exportPixelRatio,
      right: region.text.right * exportPixelRatio,
      bottom: region.text.bottom * exportPixelRatio
    }
  ]);
  const regionEvidence = await inspectRasterRegions(page, dataUrl, evidenceRegions);

  expect(raster.width).toBe(2400);
  expect(raster.height).toBe(252);
  expect(raster.whiteCornerPixels).toBe(4);
  expect(raster.transparentPixels).toBe(0);
  expect(raster.whitePerimeterPixels).toBe(raster.perimeterPixels);
  expect(raster.nonWhitePixels).toBeGreaterThan(300);
  expect(raster.nonWhiteBounds).not.toBeNull();
  expect(raster.nonWhiteBounds!.left).toBeGreaterThan(0);
  expect(raster.nonWhiteBounds!.top).toBeGreaterThan(0);
  expect(raster.nonWhiteBounds!.right).toBeLessThan(raster.width);
  expect(raster.nonWhiteBounds!.bottom).toBeLessThan(raster.height);
  expect(findOverlappingBounds(evidenceRegions)).toEqual([]);
  regionEvidence.filter((region) => region.id.startsWith("sample-")).forEach((region) => {
    expect(region.expectedColorPixels).toBeGreaterThan(20);
  });
  regionEvidence.filter((region) => region.id.startsWith("text-")).forEach((region) => {
    expect(region.nonWhitePixels).toBeGreaterThan(20);
  });
  expect(samples.dashedRuns).toBeGreaterThanOrEqual(4);
  expect(samples.dottedRuns).toBeGreaterThan(samples.dashedRuns);
  expect(samples.rectPixels).toBeGreaterThan(samples.circlePixels);
});

test("preserves formatted Excel identity and exposes actionable warning provenance", async ({ page }, testInfo) => {
  const workbookPath = testInfo.outputPath("s4-warning-provenance.xlsx");
  writeWarningProvenanceWorkbook(workbookPath);
  await page.goto("./");
  await page.getByTestId("original-data-input").setInputFiles(workbookPath);

  await expect(page.getByText(/s4-warning-provenance\.xlsx · 곡선 2개/u)).toBeVisible();
  await expect(page.getByRole("button", { name: /▸ R1/u })).toBeVisible();
  const inspector = page.locator(".import-panel .warning-inspector");
  await inspector.locator("summary").click();
  await expect(inspector).toHaveAttribute("open", "");
  await inspector.getByRole("combobox", { name: "코드" }).selectOption("FORMULA_CACHED_VALUE_USED");
  const formulaWarning = inspector.locator(".warning-master-list > button");
  await expect(formulaWarning).toHaveCount(1);
  await expect(formulaWarning).toContainText("B3");
  await formulaWarning.click();
  const detail = inspector.getByRole("region", { name: "선택한 경고 상세" });
  await expect(detail).toContainText("s4-warning-provenance.xlsx");
  await expect(detail).toContainText("Data · B3 · B");
  await expect(detail).toContainText("40+2");
  await expect(detail).toContainText("used");
  await inspector.screenshot({ path: testInfo.outputPath("s4-warning-inspector.png") });
  await detail.getByRole("button", { name: "데이터 선택에서 위치 보기" }).click();
  await expect(page.getByText(/수식 캐시값 사용 관련 데이터 1개를 임시 표시 중/u)).toBeVisible();
  await expect(page.locator("[data-warning-focus='true']")).toHaveCount(1);
  await page.waitForTimeout(200);
  await page.locator(".selection-panel").screenshot({
    path: testInfo.outputPath("s4-warning-navigation.png"),
    animations: "disabled"
  });
  await page.screenshot({
    path: testInfo.outputPath("s4-warning-desktop.png"),
    fullPage: true,
    animations: "disabled"
  });

  const exportSummary = page.locator(".settings-accordion > details > summary", { hasText: "Export" });
  const exportDetails = exportSummary.locator("..");
  if ((await exportDetails.getAttribute("open")) === null) await exportSummary.click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "분석 저장" }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const exportedWorkbook = XLSX.read(readFileSync(downloadPath as string), { type: "buffer", raw: true });
  expect(exportedWorkbook.SheetNames).toContain("HeaderProvenance");
  expect(exportedWorkbook.SheetNames).toContain("Warnings");
  expect(exportedWorkbook.Sheets._IsoAmplarAnalysis.B2?.v).toBe(4);
  const warningRows = XLSX.utils.sheet_to_json<unknown[]>(exportedWorkbook.Sheets.Warnings, { header: 1, blankrows: false });
  expect(warningRows[0]).toEqual(expect.arrayContaining(["Handling", "Source ID", "Display value", "Formula cache"]));
});

test("roundtrips dataset selection scale style and labels through Analysis XLSX", async ({ page }, testInfo) => {
  const workbookPath = testInfo.outputPath("s10-analysis-roundtrip.xlsx");
  const restorePath = testInfo.outputPath("s10-restored-analysis.xlsx");
  const resavedPath = testInfo.outputPath("s10-resaved-analysis.xlsx");
  const specimenLabel = "Synthetic continuity specimen";
  const curveLabel = `A2 \u2502 ${specimenLabel}`;
  writeAnalysisRoundtripWorkbookFixture(workbookPath, specimenLabel);

  await page.goto("./");
  await page.getByTestId("original-data-input").setInputFiles(workbookPath);
  await page.getByRole("searchbox").fill("A2");
  const selectionActions = page.locator(".selection-actions button");
  await expect(selectionActions).toHaveCount(4);
  await selectionActions.nth(0).click();
  await expect(page.locator(".selection-meta span").nth(1)).toHaveText(/1$/u);

  const yAxis = page.getByRole("region", { name: "Y axis" });
  await yAxis.getByRole("button", { name: "Fixed" }).click();
  const yInputs = yAxis.getByRole("spinbutton");
  await yInputs.nth(0).fill("-1000");
  await yInputs.nth(1).fill("900000");
  await expect(yAxis).toContainText("Applied: Fixed -1000");

  const styleSummary = page.locator(".settings-accordion > details > summary", { hasText: "Style" });
  await styleSummary.click();
  await page.getByLabel(`${curveLabel} line and marker editor`, { exact: true }).click();
  await page.getByRole("button", { name: `${curveLabel} line dashed` }).click();

  const legendSummary = page.locator(".settings-accordion > details > summary", { hasText: "Legend" });
  await legendSummary.click();
  await page.getByRole("tab", { name: "Labels" }).click();
  const analysisLabel = page.getByLabel(`${curveLabel} analysis label`, { exact: true });
  await analysisLabel.fill("Synthetic review condition");

  const savePromise = page.waitForEvent("download");
  await page.locator(".analysis-save-button").click();
  const savedAnalysis = await savePromise;
  await savedAnalysis.saveAs(restorePath);

  await page.getByTestId("analysis-restore-input").setInputFiles(restorePath);
  await expect(page.locator(".analysis-tab-button")).toHaveCount(2);
  await expect(page.locator('.analysis-tab-button[aria-selected="true"]')).toHaveCount(1);
  await expect(page.locator(".import-summary")).toContainText("s10-analysis-roundtrip.xlsx");
  await expect(page.locator(".import-summary")).toContainText("2");
  await expect(page.locator(".selection-meta span").nth(1)).toHaveText(/1$/u);
  await expect(yAxis.getByRole("button", { name: "Fixed" })).toHaveClass(/is-active/u);
  await expect(yInputs.nth(0)).toHaveValue("-1000");
  await expect(yInputs.nth(1)).toHaveValue("900000");

  const styleDetails = styleSummary.locator("..");
  if ((await styleDetails.getAttribute("open")) === null) await styleSummary.click();
  await page.getByLabel(`${curveLabel} line and marker editor`, { exact: true }).click();
  await expect(page.getByRole("button", { name: `${curveLabel} line dashed` })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");

  const legendDetails = legendSummary.locator("..");
  if ((await legendDetails.getAttribute("open")) === null) await legendSummary.click();
  const labelsTab = page.getByRole("tab", { name: "Labels" });
  if ((await labelsTab.getAttribute("aria-selected")) !== "true") await labelsTab.click();
  await expect(page.getByLabel(`${curveLabel} analysis label`, { exact: true })).toHaveValue("Synthetic review condition");

  const resavePromise = page.waitForEvent("download");
  await page.locator(".analysis-save-button").click();
  const resavedAnalysis = await resavePromise;
  await resavedAnalysis.saveAs(resavedPath);

  const firstRead = await readAnalysisWorkbookBuffer(readFileSync(restorePath));
  const secondRead = await readAnalysisWorkbookBuffer(readFileSync(resavedPath));
  expect(firstRead.kind).toBe("analysis");
  expect(secondRead.kind).toBe("analysis");
  if (firstRead.kind !== "analysis" || secondRead.kind !== "analysis") return;
  const projectCurveIntegrity = (curve: (typeof firstRead.analysis.dataset.curves)[number]) => ({
    curveId: curve.curveId,
    specimenId: curve.specimenId,
    reagentId: curve.reagentId,
    specimenLabel: curve.specimenLabel,
    reagentLabel: curve.reagentLabel,
    x: curve.x,
    y: curve.y,
    stats: curve.stats,
    source: curve.source
  });
  expect(secondRead.analysis.dataset.curves.map(projectCurveIntegrity)).toEqual(
    firstRead.analysis.dataset.curves.map(projectCurveIntegrity)
  );
  const restoredValues = secondRead.analysis.dataset.curves.flatMap((curve) => curve.y);
  expect(restoredValues).toContain(null);
  expect(restoredValues.some((value) => typeof value === "number" && value < 0)).toBe(true);
  expect(restoredValues.some((value) => typeof value === "number" && value > 0 && value < 1e-6)).toBe(true);
  expect(restoredValues.some((value) => typeof value === "number" && value > 1e8)).toBe(true);
});

test("switches named Selection Sets and exports role-safe Selected Data XLSX", async ({ page }, testInfo) => {
  const sourcePath = testInfo.outputPath("synthetic_public_smoke_comparison_source.xlsx");
  const analysisPath = testInfo.outputPath("selection-sets-analysis.xlsx");
  const selectedDataPath = testInfo.outputPath("selection-sets-selected-data.xlsx");
  writeDenseWorkbookFixture(sourcePath, 5, 12);

  await page.goto("./");
  await page.getByTestId("original-data-input").setInputFiles(sourcePath);
  const search = page.getByRole("searchbox", { name: "검색" });

  await search.fill("Assay 01");
  await page.getByRole("button", { name: "표시 선택" }).click();
  await page.getByRole("button", { name: "현재 선택을 새 세트로 저장" }).click();
  await page.getByLabel("새 세트 이름").fill("조건 비교 1");
  await page.getByRole("button", { name: "확인" }).click();

  await page.getByRole("button", { name: "표시 해제" }).click();
  await search.fill("Assay 02");
  await page.getByRole("button", { name: "표시 선택" }).click();
  await page.getByRole("button", { name: "새 세트" }).click();
  await page.getByLabel("새 세트 이름").fill("조건 비교 2");
  await page.getByRole("button", { name: "확인" }).click();

  const setSelect = page.getByRole("combobox", { name: "적용할 선택 세트" });
  await page.getByRole("button", { name: "새 세트" }).click();
  await page.getByLabel("새 세트 이름").fill("L".repeat(120));
  await page.getByRole("button", { name: "확인" }).click();
  await page.getByText("관리", { exact: true }).click();
  await page.getByRole("button", { name: "삭제" }).click();
  const longNameConfirmation = page.getByRole("group", { name: "선택 세트 삭제 확인" });
  expect(await longNameConfirmation.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await longNameConfirmation.getByRole("button", { name: "취소" }).click();
  await page.getByText("관리", { exact: true }).click();

  await setSelect.selectOption({ label: "조건 비교 1 (1)" });
  await page.getByRole("button", { name: "적용", exact: true }).click();
  await expect(page.locator(".selection-meta span").nth(1)).toHaveText(/1$/u);
  const selectionSetPanel = page.locator(".selection-set-panel");
  expect(await selectionSetPanel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await selectionSetPanel.screenshot({ path: testInfo.outputPath("selection-set-panel.png"), animations: "disabled" });

  const savePromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "분석 저장" }).click();
  const analysisDownload = await savePromise;
  await analysisDownload.saveAs(analysisPath);
  const analysisWorkbook = XLSX.read(readFileSync(analysisPath), { type: "buffer", raw: true });
  expect(analysisWorkbook.Sheets._IsoAmplarAnalysis.B2?.v).toBe(4);
  expect(analysisWorkbook.SheetNames).toContain("SelectionSets");

  await page.getByTestId("analysis-restore-input").setInputFiles(analysisPath);
  await expect(page.locator(".analysis-tab-button")).toHaveCount(2);
  await expect(page.getByRole("option", { name: "조건 비교 1 (1)" })).toBeAttached();
  await expect(page.locator(".selection-set-heading span")).toContainText("조건 비교 1");

  const exportSummary = page.locator(".settings-accordion > details > summary", { hasText: "Export" });
  if ((await exportSummary.locator("..").getAttribute("open")) === null) await exportSummary.click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.locator(".settings-panel").screenshot({
    path: testInfo.outputPath("selected-data-export-panel.png"),
    animations: "disabled"
  });
  const selectedDataPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "선택 데이터 XLSX 저장" }).click();
  const selectedDataDownload = await selectedDataPromise;
  await selectedDataDownload.saveAs(selectedDataPath);
  expect(selectedDataDownload.suggestedFilename()).toMatch(/_plot\d+_data\.xlsx$/u);

  const selectedWorkbook = XLSX.read(readFileSync(selectedDataPath), { type: "buffer", raw: true });
  expect(selectedWorkbook.SheetNames).toEqual([
    "PlottedData",
    "CurveInfo",
    "Warnings",
    "ExportInfo",
    "_IsoAmplarSelectedData"
  ]);
  expect(selectedWorkbook.Sheets._IsoAmplarSelectedData.A1?.v).toBe("IsoAmplarSelectedData");
  expect(selectedWorkbook.Sheets.PlottedData["!ref"]).toBe("A1:B13");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  await page.getByTestId("append-excel-input").setInputFiles(selectedDataPath);
  await expect(page.getByText("선택 데이터 XLSX는 Excel 후속 분석용이며 원본 입력 또는 분석 복원 파일이 아닙니다.")).toBeVisible();
});

test("creates and switches internal analysis tabs", async ({ page }, testInfo) => {
  const workbookPath = testInfo.outputPath("phase-r3-tabs.xlsx");
  writeWorkbookFixture(workbookPath, "Tab sample");

  await page.goto("./");
  await expect(page.getByRole("tab", { name: "Analysis 1" })).toHaveAttribute("aria-selected", "true");

  await page.getByTestId("original-data-input").setInputFiles(workbookPath);
  await expect(page.getByRole("tab", { name: /phase-r3-tabs.xlsx/ })).toHaveAttribute("aria-selected", "true");

  await page.getByRole("button", { name: "phase-r3-tabs.xlsx 닫기" }).click();
  await expect(page.getByRole("alertdialog", { name: "저장하지 않은 분석" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Analysis XLSX 저장 후 닫기" })).toBeEnabled();
  await page.getByRole("button", { name: "취소" }).click();

  await page.getByRole("button", { name: "새 분석" }).click();
  await expect(page.getByRole("tab", { name: "Analysis 2" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".dirty-status", { hasText: "데이터 없음" })).toBeVisible();

  await page.getByRole("textbox", { name: "분석 이름" }).fill("Run B");
  await expect(page.getByRole("tab", { name: /Run B/ })).toHaveAttribute("aria-selected", "true");

  await page.getByRole("tab", { name: /phase-r3-tabs.xlsx/ }).click();
  await expect(page.getByRole("textbox", { name: "분석 이름" })).toHaveValue("phase-r3-tabs.xlsx");
  await page.getByRole("tab", { name: /Run B/ }).click();
  await expect(page.getByRole("textbox", { name: "분석 이름" })).toHaveValue("Run B");
});

function writeWorkbookFixture(filePath: string, specimenLabel: string) {
  const workbook = XLSX.utils.book_new();
  const rows: Array<Array<string | number>> = [
    [specimenLabel, specimenLabel],
    ["A1", "A2"]
  ];

  for (let cycle = 1; cycle <= 45; cycle += 1) {
    rows.push([createAmplificationValue(cycle, 20, 820_000), createAmplificationValue(cycle, 24, 1_050_000)]);
  }

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  writeFileSync(filePath, buffer);
}

function writeAnalysisRoundtripWorkbookFixture(filePath: string, specimenLabel: string) {
  const workbook = XLSX.utils.book_new();
  const rows: Array<Array<string | number | null>> = [
    [specimenLabel, specimenLabel],
    ["A1", "A2"],
    [-1.25, 0.1],
    [null, 2.5e-7],
    [1.2e-9, -2],
    [950_000_000, 300],
    [42, 4_500_000]
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "SyntheticRoundtrip");
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer);
}

function writeLegendIdentityWorkbook(filePath: string) {
  const workbook = XLSX.utils.book_new();
  const rows: Array<Array<string | number>> = [
    ["Synthetic Condition / Temperature 55C", "Synthetic Condition / Temperature 60C"],
    [
      "Assay concentration profile with distinguishing Lot A",
      "Assay concentration profile with distinguishing Lot B"
    ]
  ];
  for (let cycle = 1; cycle <= 45; cycle += 1) {
    rows.push([createAmplificationValue(cycle, 20, 700_000), createAmplificationValue(cycle, 25, 900_000)]);
  }
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "SyntheticData");
  writeFileSync(filePath, XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer);
}

function writeDenseWorkbookFixture(filePath: string, curveCount: number, cycleCount = 60) {
  const workbook = XLSX.utils.book_new();
  const reagentCount = Math.min(curveCount, 8);
  const rows: Array<Array<string | number>> = [
    Array.from(
      { length: curveCount },
      (_, index) => `Synthetic specimen ${String(Math.floor(index / reagentCount) + 1).padStart(2, "0")} with long label`
    ),
    Array.from({ length: curveCount }, (_, index) => `Assay ${String((index % reagentCount) + 1).padStart(2, "0")}`)
  ];
  for (let cycle = 1; cycle <= cycleCount; cycle += 1) {
    rows.push(
      Array.from({ length: curveCount }, (_, index) =>
        createAmplificationValue(cycle, 18 + (index % 12), 400_000 + index * 20_000)
      )
    );
  }
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "DenseSyntheticData");
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer);
}

function roundMeasurement(value: number) {
  return Math.round(value * 100) / 100;
}

function writeWarningProvenanceWorkbook(filePath: string) {
  const workbook = XLSX.utils.book_new();
  const worksheet: XLSX.WorkSheet = {
    A1: { t: "n", v: 1, z: "000" },
    B1: { t: "s", v: "001" },
    A2: { t: "s", v: "R1" },
    B2: { t: "s", v: "R1" },
    A3: { t: "s", v: "not-a-number" },
    B3: { t: "n", v: 42, f: "40+2", z: "0.0" },
    A4: { t: "n", v: 1 },
    B4: { t: "n", v: 43 },
    "!ref": "A1:B4"
  };
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
  writeFileSync(filePath, XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer);
}

async function setGroupLineMarker(page: Page, label: string, lineType: "solid" | "dashed" | "dotted", markerType: "none" | "circle" | "triangle" | "rect") {
  const editor = page.getByLabel(`${label} line and marker editor`);
  await editor.click();
  await page.getByRole("button", { name: `${label} line ${lineType}` }).click();
  await editor.click();
  await page.getByRole("button", { name: `${label} marker ${markerType}` }).click();
}

async function inspectLegendStyleSamples(page: Page, dataUrl: string) {
  return page.evaluate(async (source) => {
    const image = new Image();
    image.src = source;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas 2D context is unavailable.");
    context.drawImage(image, 0, 0);
    const isColored = (x: number, y: number) => {
      const pixel = context.getImageData(x, y, 1, 1).data;
      return pixel[0] < 245 || pixel[1] < 245 || pixel[2] < 245;
    };
    const countRuns = (startX: number, endX: number, y: number) => {
      let runs = 0;
      let previous = false;
      for (let x = startX; x <= endX; x += 1) {
        const current = isColored(x, y);
        if (current && !previous) runs += 1;
        previous = current;
      }
      return runs;
    };
    const countBox = (centerX: number, centerY: number) => {
      let count = 0;
      for (let y = centerY - 11; y <= centerY + 11; y += 1) {
        for (let x = centerX - 11; x <= centerX + 11; x += 1) {
          if (isColored(x, y)) count += 1;
        }
      }
      return count;
    };
    return {
      dashedRuns: countRuns(48, 176, 140),
      dottedRuns: countRuns(624, 752, 140),
      circlePixels: countBox(112, 140),
      rectPixels: countBox(688, 140)
    };
  }, dataUrl);
}

function createAmplificationValue(cycle: number, midpoint: number, max: number) {
  return Number((0.2 + max / (1 + Math.exp(-0.38 * (cycle - midpoint)))).toFixed(4));
}

async function countNonWhiteCanvasPixels(canvasLocator: Locator) {
  return canvasLocator.evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext("2d");
    if (!context) return 0;
    const { width, height } = canvas;
    const image = context.getImageData(0, 0, width, height);
    let count = 0;

    for (let index = 0; index < image.data.length; index += 16) {
      const red = image.data[index];
      const green = image.data[index + 1];
      const blue = image.data[index + 2];
      const alpha = image.data[index + 3];
      if (alpha > 0 && (red < 245 || green < 245 || blue < 245)) {
        count += 1;
      }
    }

    return count;
  });
}

async function hoverUntilChartReadoutUpdates(page: Page, canvasLocator: Locator) {
  const box = await canvasLocator.boundingBox();
  expect(box).not.toBeNull();
  const readout = page.getByLabel("Chart point readout");
  const xFractions = [0.16, 0.22, 0.28, 0.34, 0.4, 0.46, 0.52, 0.58, 0.64, 0.7, 0.76, 0.82];
  const yFractions = [0.16, 0.24, 0.32, 0.4, 0.48, 0.56, 0.64, 0.72, 0.8, 0.88];

  for (const xFraction of xFractions) {
    for (const yFraction of yFractions) {
      await page.mouse.move((box?.x ?? 0) + (box?.width ?? 0) * xFraction, (box?.y ?? 0) + (box?.height ?? 0) * yFraction);
      await page.waitForTimeout(20);
      const text = (await readout.textContent()) ?? "";
      if (/Cycle\s+(?!-)/u.test(text) && /Fluorescence\s+(?!-)/u.test(text)) {
        return;
      }
    }
  }

  throw new Error(`Chart hover readout did not update. Last readout: ${(await readout.textContent()) ?? ""}`);
}

async function applyBoxZoom(page: Page, canvasLocator: Locator) {
  await canvasLocator.scrollIntoViewIfNeeded();
  const box = await canvasLocator.boundingBox();
  expect(box).not.toBeNull();

  await page.getByRole("button", { name: "Box zoom" }).click();
  await expect(page.getByRole("button", { name: "Box zoom" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Chart point readout")).toContainText("Cycle -");
  const plotArea = page.locator(".box-zoom-plot-area");
  await expect(plotArea).toBeVisible();
  const plotAreaBox = await plotArea.boundingBox();
  expect(plotAreaBox).not.toBeNull();
  expect(plotAreaBox?.x ?? 0).toBeGreaterThan((box?.x ?? 0) + 40);
  expect(plotAreaBox?.y ?? 0).toBeGreaterThan((box?.y ?? 0) + 10);
  expect((plotAreaBox?.x ?? 0) + (plotAreaBox?.width ?? 0)).toBeLessThanOrEqual((box?.x ?? 0) + (box?.width ?? 0) + 1);
  expect((plotAreaBox?.y ?? 0) + (plotAreaBox?.height ?? 0)).toBeLessThanOrEqual((box?.y ?? 0) + (box?.height ?? 0) + 1);
  await page.mouse.move((box?.x ?? 0) + (box?.width ?? 0) * 0.5, (box?.y ?? 0) + (box?.height ?? 0) * 0.5);
  await page.waitForTimeout(50);
  await expect(page.getByLabel("Chart point readout")).toContainText("Cycle -");
  await page.mouse.move((box?.x ?? 0) + (box?.width ?? 0) * 0.34, (box?.y ?? 0) + (box?.height ?? 0) * 0.22);
  await page.mouse.down();
  await page.mouse.move((box?.x ?? 0) + (box?.width ?? 0) * 0.72, (box?.y ?? 0) + (box?.height ?? 0) * 0.62, { steps: 8 });
  await page.mouse.up();
}

async function previewBoundaryPaste(page: Page, sourceText: string, firstExpected: string, secondExpected: string) {
  await page.goto("./");
  await page.getByRole("button", { name: "빠른 붙여넣기" }).click();
  const dialog = page.getByRole("dialog", { name: "소량 표 붙여넣기" });
  await dialog.getByRole("textbox", { name: "표 데이터" }).evaluate((element, value) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    setter?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  }, sourceText);
  await dialog.getByRole("button", { name: "미리보기 생성" }).click();
  await expect(dialog.getByText(firstExpected, { exact: true })).toBeVisible();
  await expect(dialog.getByText(secondExpected, { exact: true })).toBeVisible();
  await expect(dialog.getByRole("table")).toBeVisible();
}
