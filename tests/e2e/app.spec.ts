import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { inspectRasterDataUrl } from "./helpers/rasterEvidence";

test("renders the upload-first PCR workspace", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "IsoAmplar Plot Analysis" })).toBeVisible();
  await expect(page.getByText("Developer Jang Si Un")).toBeVisible();
  await expect(page.getByRole("heading", { name: "데이터 가져오기" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "데이터 선택" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "그래프 미리보기" })).toBeVisible();
  await expect(page.getByText("Excel 파일 또는 소량 표 붙여넣기를 사용합니다. Excel은 첫 번째 worksheet만 사용합니다.")).toBeVisible();
});

test("previews and imports full-table and single-specimen pasted data", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "붙여넣기 입력" }).click();
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
  await expect(page.getByText(/Paste import 1 · 2 curves/)).toBeVisible();
  await page.getByRole("searchbox", { name: "검색" }).fill("Assay 1");
  await page.getByRole("button", { name: "표시 선택" }).click();
  await expect(page.getByText("1개 curve 선택됨")).toBeVisible();
  await expect(page.locator(".echarts-surface canvas")).toBeVisible();

  await page.getByRole("button", { name: "붙여넣기 입력" }).click();
  dialog = page.getByRole("dialog", { name: "소량 표 붙여넣기" });
  await dialog.getByRole("radio", { name: "한 검체의 시약별 값" }).click();
  await dialog.getByRole("textbox", { name: "검체명" }).fill("Comparison Sample");
  await dialog.getByRole("textbox", { name: "표 데이터" }).fill("Assay 3\n0.3\n1.3");
  await dialog.getByRole("button", { name: "미리보기 생성" }).click();
  await expect(dialog.getByText("측정 곡선 1개")).toBeVisible();
  await dialog.getByRole("button", { name: "새 분석으로 열기" }).click();

  await expect(page.getByRole("tab", { name: "Paste import 2" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText(/Paste import 2 · 1 curves/)).toBeVisible();
  await expect(page.getByText("선택 0")).toBeVisible();
});

test("uploads an xlsx workbook and keeps reagent-first collapsed selection", async ({ page }, testInfo) => {
  const workbookPath = testInfo.outputPath("phase3-upload.xlsx");
  const appendWorkbookPath = testInfo.outputPath("phase3-append.xlsx");
  writeWorkbookFixture(workbookPath, "검체 1");
  writeWorkbookFixture(appendWorkbookPath, "검체 2");

  await page.goto("/");
  await page.locator("input[type='file']").first().setInputFiles(workbookPath);

  await expect(page.getByText(/phase3-upload.xlsx · 2 curves/)).toBeVisible();
  const primaryFileInput = page.locator("input[type='file']").first();
  await primaryFileInput.setInputFiles(appendWorkbookPath);
  const replaceDialog = page.getByRole("alertdialog", { name: "Unsaved analysis" });
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
  await expect(page.getByRole("button", { name: "Analysis XLSX" })).toBeEnabled();

  const chartWrap = page.locator(".chart-canvas-wrap");
  const before = await chartWrap.boundingBox();
  await expect(page.getByRole("region", { name: "Custom legend" })).toBeVisible();
  await expect(page.locator('.custom-legend [data-marker-type="none"]')).toHaveCount(1);
  await page.locator(".settings-accordion summary", { hasText: "Style" }).click();
  await expect(page.getByLabel("현재 스타일 기준")).toContainText("마커 시약별");
  await expect(page.getByLabel("마커 기준")).toBeVisible();
  await page.getByLabel("A2 line and marker editor").click();
  await page.getByRole("button", { name: "A2 marker circle" }).click();
  await expect(page.getByLabel("A2 │ 검체 1 marker type", { exact: true })).toHaveValue("circle");
  await expect(page.locator('.custom-legend [data-marker-type="circle"]')).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath("phase-r8-style-legend-panel.png"), fullPage: false });
  await page.getByLabel("Image export layout").selectOption("legendOnly");
  await expect(page.getByRole("button", { name: "Save PNG" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Copy selected layout PNG to clipboard" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy report legend Excel cells" })).toBeVisible();
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

test("preserves long legend identity and distinguishable line-marker raster samples", async ({ page }, testInfo) => {
  const workbookPath = testInfo.outputPath("s3-legend-identity.xlsx");
  writeLegendIdentityWorkbook(workbookPath);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");
  await page.locator("input[type='file']").first().setInputFiles(workbookPath);
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

  expect(raster.width).toBe(2400);
  expect(raster.whiteCornerPixels).toBe(4);
  expect(raster.nonWhitePixels).toBeGreaterThan(300);
  expect(samples.dashedRuns).toBeGreaterThanOrEqual(4);
  expect(samples.dottedRuns).toBeGreaterThan(samples.dashedRuns);
  expect(samples.rectPixels).toBeGreaterThan(samples.circlePixels);
});

test("preserves formatted Excel identity and exposes actionable warning provenance", async ({ page }, testInfo) => {
  const workbookPath = testInfo.outputPath("s4-warning-provenance.xlsx");
  writeWarningProvenanceWorkbook(workbookPath);
  await page.goto("/");
  await page.locator("input[type='file']").first().setInputFiles(workbookPath);

  await expect(page.getByText(/s4-warning-provenance\.xlsx · 2 curves/u)).toBeVisible();
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
  await page.getByRole("button", { name: "Analysis XLSX" }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const exportedWorkbook = XLSX.read(readFileSync(downloadPath as string), { type: "buffer", raw: true });
  expect(exportedWorkbook.SheetNames).toContain("HeaderProvenance");
  expect(exportedWorkbook.SheetNames).toContain("Warnings");
  expect(exportedWorkbook.Sheets._IsoAmplarAnalysis.B2?.v).toBe(3);
  const warningRows = XLSX.utils.sheet_to_json<unknown[]>(exportedWorkbook.Sheets.Warnings, { header: 1, blankrows: false });
  expect(warningRows[0]).toEqual(expect.arrayContaining(["Handling", "Source ID", "Display value", "Formula cache"]));
});

test("creates and switches internal analysis tabs", async ({ page }, testInfo) => {
  const workbookPath = testInfo.outputPath("phase-r3-tabs.xlsx");
  writeWorkbookFixture(workbookPath, "Tab sample");

  await page.goto("/");
  await expect(page.getByRole("tab", { name: "Analysis 1" })).toHaveAttribute("aria-selected", "true");

  await page.locator("input[type='file']").first().setInputFiles(workbookPath);
  await expect(page.getByRole("tab", { name: /phase-r3-tabs.xlsx/ })).toHaveAttribute("aria-selected", "true");

  await page.getByRole("button", { name: /Close phase-r3-tabs.xlsx/ }).click();
  await expect(page.getByRole("alertdialog", { name: "Unsaved analysis" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save Analysis XLSX then close" })).toBeEnabled();
  await page.getByRole("button", { name: "Cancel close" }).click();

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
    rows.push([createAmplificationValue(cycle, 20, 820_000), createAmplificationValue(cycle, 24, 1_050_000)]);
  }

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  writeFileSync(filePath, buffer);
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
  const plotArea = page.locator(".box-zoom-plot-area");
  await expect(plotArea).toBeVisible();
  const plotAreaBox = await plotArea.boundingBox();
  expect(plotAreaBox).not.toBeNull();
  expect(plotAreaBox?.x ?? 0).toBeGreaterThan((box?.x ?? 0) + 40);
  expect(plotAreaBox?.y ?? 0).toBeGreaterThan((box?.y ?? 0) + 10);
  expect((plotAreaBox?.x ?? 0) + (plotAreaBox?.width ?? 0)).toBeLessThanOrEqual((box?.x ?? 0) + (box?.width ?? 0) + 1);
  expect((plotAreaBox?.y ?? 0) + (plotAreaBox?.height ?? 0)).toBeLessThanOrEqual((box?.y ?? 0) + (box?.height ?? 0) + 1);
  await page.mouse.move((box?.x ?? 0) + (box?.width ?? 0) * 0.34, (box?.y ?? 0) + (box?.height ?? 0) * 0.22);
  await page.mouse.down();
  await page.mouse.move((box?.x ?? 0) + (box?.width ?? 0) * 0.72, (box?.y ?? 0) + (box?.height ?? 0) * 0.62, { steps: 8 });
  await page.mouse.up();
}
