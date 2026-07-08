import { expect, test, type Locator, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import * as XLSX from "xlsx";

test("renders the upload-first PCR workspace", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "IsoAmplar Plot Analysis" })).toBeVisible();
  await expect(page.getByText("Developer Jang Si Un")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Excel 데이터" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "데이터 선택" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "그래프 미리보기" })).toBeVisible();
  await expect(page.getByText(".xls 또는 .xlsx 첫 번째 worksheet만 사용합니다.")).toBeVisible();
});

test("uploads an xlsx workbook and keeps reagent-first collapsed selection", async ({ page }, testInfo) => {
  const workbookPath = testInfo.outputPath("phase3-upload.xlsx");
  const appendWorkbookPath = testInfo.outputPath("phase3-append.xlsx");
  writeWorkbookFixture(workbookPath, "검체 1");
  writeWorkbookFixture(appendWorkbookPath, "검체 2");

  await page.goto("/");
  await page.locator("input[type='file']").first().setInputFiles(workbookPath);

  await expect(page.getByText(/phase3-upload.xlsx · 2 curves/)).toBeVisible();
  await expect(page.getByRole("radio", { name: "시약별" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("button", { name: /▸ A1/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /▸ A2/ })).toBeVisible();
  await expect(page.getByText("검체 1 / A1")).toHaveCount(0);

  await page.getByRole("button", { name: /▸ A1/ }).click();
  await expect(page.getByRole("checkbox", { name: "검체 1 선택" })).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: "A1 / 검체 1" })).toBeVisible();

  await page.getByRole("searchbox", { name: "검색" }).fill("A2");
  await expect(page.getByText("표시 1")).toBeVisible();
  await page.getByRole("button", { name: "표시 선택" }).click();
  await expect(page.getByText("선택 1")).toBeVisible();
  await expect(page.getByText("1개 curve 선택됨")).toBeVisible();

  await page.locator("input[type='file']").nth(1).setInputFiles(appendWorkbookPath);
  await expect(page.getByText(/combined_2_files · 4 curves/)).toBeVisible();
  await expect(page.getByText("선택 1")).toBeVisible();
  await expect(page.getByText("1개 curve 선택됨")).toBeVisible();

  const canvas = page.locator(".echarts-surface canvas");
  await expect(canvas).toBeVisible();
  await expect
    .poll(async () => await countNonWhiteCanvasPixels(canvas))
    .toBeGreaterThan(100);
  await expect(page.getByLabel("Chart point readout")).toContainText("Cycle -");
  await hoverUntilChartReadoutUpdates(page, canvas);

  const chartWrap = page.locator(".chart-canvas-wrap");
  const before = await chartWrap.boundingBox();
  await expect(page.getByRole("region", { name: "Custom legend" })).toBeVisible();
  await expect(page.locator('.custom-legend [data-marker-type="none"]')).toHaveCount(1);
  await page.locator(".settings-accordion summary", { hasText: "Style" }).click();
  await expect(page.getByLabel("현재 스타일 기준")).toContainText("마커 시약별");
  await expect(page.getByLabel("마커 기준")).toBeVisible();
  await page.getByLabel("A2 marker type").selectOption("circle");
  await expect(page.getByLabel("A2 / 검체 1 marker type", { exact: true })).toHaveValue("circle");
  await expect(page.locator('.custom-legend [data-marker-type="circle"]')).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath("phase-r8-style-legend-panel.png"), fullPage: false });
  await page.locator(".settings-accordion summary", { hasText: "Legend Order" }).click();
  await page.getByLabel("Image export layout").selectOption("legendOnly");
  await page.locator(".settings-accordion summary", { hasText: "Export" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "PNG 저장" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^\d{6}_plot1\.png$/u);
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

test("creates and switches internal analysis tabs", async ({ page }, testInfo) => {
  const workbookPath = testInfo.outputPath("phase-r3-tabs.xlsx");
  writeWorkbookFixture(workbookPath, "Tab sample");

  await page.goto("/");
  await expect(page.getByRole("tab", { name: "Analysis 1" })).toHaveAttribute("aria-selected", "true");

  await page.locator("input[type='file']").first().setInputFiles(workbookPath);
  await expect(page.getByRole("tab", { name: /phase-r3-tabs.xlsx/ })).toHaveAttribute("aria-selected", "true");

  await page.getByRole("button", { name: /Close phase-r3-tabs.xlsx/ }).click();
  await expect(page.getByText("Save this analysis before closing it, or wait for the close confirmation flow.")).toBeVisible();

  await page.getByRole("button", { name: "New analysis" }).click();
  await expect(page.getByRole("tab", { name: "Analysis 2" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".dirty-status", { hasText: "Clean" })).toBeVisible();

  await page.getByRole("textbox", { name: "Analysis name" }).fill("Run B");
  await expect(page.getByRole("tab", { name: /Run B/ })).toHaveAttribute("aria-selected", "true");

  await page.getByRole("tab", { name: /phase-r3-tabs.xlsx/ }).click();
  await expect(page.getByRole("textbox", { name: "Analysis name" })).toHaveValue("phase-r3-tabs.xlsx");
  await page.getByRole("tab", { name: /Run B/ }).click();
  await expect(page.getByRole("textbox", { name: "Analysis name" })).toHaveValue("Run B");
});

function writeWorkbookFixture(filePath: string, specimenLabel: string) {
  const workbook = XLSX.utils.book_new();
  const rows: Array<Array<string | number>> = [
    [specimenLabel, specimenLabel],
    ["A1", "A2"]
  ];

  for (let cycle = 1; cycle <= 45; cycle += 1) {
    rows.push([createAmplificationValue(cycle, 20, 34), createAmplificationValue(cycle, 24, 38)]);
  }

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  writeFileSync(filePath, buffer);
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
