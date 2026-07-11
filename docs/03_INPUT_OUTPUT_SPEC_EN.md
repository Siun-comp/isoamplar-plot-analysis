# 03 Input and Output Specification

## Purpose
Define how data enters the application, how it is normalized internally, and what outputs the application produces.

## Status
Active draft

## Last Updated
2026-07-11

## Owner
Engineering / Agent

## Compression-Safe Summary
- MVP input is Excel upload only: `.xls` and `.xlsx`, first worksheet only. Additional Excel files may be appended to the current in-browser analysis.
- CSV file import, manual entry, and in-app data editing are deferred beyond MVP.
- Quick Paste Import is implemented as a post-MVP paste/import path for small pasted tables using either the same two-header Excel structure or a single-specimen mode with one supplied specimen name.
- Imported PCR data should normalize into stable specimen/reagent/curve records keyed by `curveId`; appended files must rekey curves to avoid ID collisions.
- Parsing should preserve original values and surface warnings.
- Output image and clipboard content should match the current rendered chart or the explicitly selected report-legend output.
- PNG and JPEG export use white background and analysis-name-based filenames such as `YYMMDD_<sanitizedAnalysisName>_plotN.ext`.
- Plotted-data CSV, when enabled, uses the matching analysis-name-based filename stem such as `YYMMDD_<sanitizedAnalysisName>_plotN_data.csv`, includes only the current plotted chart projection, and uses current Analysis labels for curve headers with duplicate disambiguation when needed.
- Chart styling uses stable default colors by original data/group order, solid no-marker lines by default, and optional individual marker overrides.
- Analysis XLSX is a web-app restore file containing the full imported dataset and settings, including Analysis labels and legend/export settings; it is separate from plotted-data CSV and report-style chart workbooks.
- Internal analysis tabs keep separate in-browser analysis states; user data remains browser-local unless explicitly exported.

## Update Rule
Update this file when parsing rules, data types, invalid data handling, internal data shape, output formats, or error messages change.

## Supported Inputs

| ID | Input | Initial Rule | Related Requirements | Acceptance Criteria |
| --- | --- | --- | --- | --- |
| IO-001 | Excel workbook | Support `.xls` and `.xlsx` upload through browser file APIs; parse only the first worksheet. The user can replace the current dataset or append another file to the current analysis. If the active analysis is dirty, replace upload requires explicit replace or new-analysis confirmation. | FR-001 | AC-001, AC-002, AC-PCR-001, AC-PCR-015, AC-PCR-016, AC-PCR-025 |
| IO-002 | CSV file | Deferred beyond MVP. | FR-002 | TBD |
| IO-003 | Pasted table | Implemented post-MVP Quick Paste Import. The user pastes a small table into a textarea using either full-table mode, row 1 specimen labels / row 2 reagent labels / row 3+ fluorescence values, or single-specimen mode, one supplied specimen name / pasted row 1 reagent labels / pasted row 2+ fluorescence values. The app generates a read-only preview, source-position warnings, row/column/cell/character/curve/cycle counts, and an approximate minimum working-memory estimate before append/new-analysis import. No in-app cell editing or source-data correction is allowed. | FR-003 | AC-QP-001 through AC-QP-021 |
| IO-004 | Manual entry / editing | Deferred beyond MVP. Imported data is not editable in MVP. | FR-003 | AC-PCR-017 |
| IO-005 | Analysis XLSX restore file | Support `.xlsx` files containing the hidden IsoAmplar restore sheet. `파일 선택` restores/replaces the active analysis when safe or after explicit dirty replace confirmation; `추가 선택` opens the saved analysis as a new internal tab. | FR-017, FR-018 | AC-PCR-033, AC-PCR-034, AC-PCR-036, AC-PCR-037 |

## Excel Rules
MVP target:

- File extension: `.xls`, `.xlsx`
- Source: browser file picker or drag and drop
- Processing location: browser
- Worksheet behavior: parse worksheet index 0 only.
- If worksheet index 0 is invalid, import fails even if later worksheets are valid.
- Later worksheets are ignored. The UI may show a notice that only the first worksheet was used.
- Row 1: specimen labels
- Row 2: reagent labels
- Row 3 onward: fluorescence values
- X axis: generated `Cycle 1~N` unless a later requirement explicitly adds source X values.

Parser policy:

- Empty trailing rows after the final row containing any fluorescence value are ignored.
- Internal empty fluorescence cells normalize to `null` and produce warnings.
- Empty data columns are ignored only when specimen header, reagent header, and all data cells are empty.
- Date, boolean, and error cells in fluorescence rows are treated as nonnumeric fluorescence unless later explicitly supported.
- Specimen/reagent identity uses SheetJS-formatted display text recomputed from raw value/type/number format rather than unconditionally trusting cached `cell.w`; raw value, display text, type, format, formula, and cache state remain provenance.
- Formula cells are never recalculated in the browser. Use cached finite numeric fluorescence values unchanged and warn that cache was used; otherwise normalize to `null` and warn that no cache was available.
- Each source import receives an immutable source-instance ID. Every normalized/persisted warning carries one-to-many source references, handling outcome, and affected curve IDs where applicable; same-name repeated imports remain distinct.
- Extension/content signature mismatch is diagnostic only and does not change the current allow/block policy.
- Merged headers warn; do not silently infer repeated labels unless implementation later adds tested behavior.
- Negative numeric fluorescence values are valid raw values and should not warn by default.
- Maximum file size, maximum row count, and maximum column count remain performance-budget decisions.

## CSV Rules
CSV import is not part of the MVP. If added later, it must map into the same PCR curve model or require explicit specimen/reagent row confirmation.

## Analysis XLSX Rules
Analysis XLSX is a project/session restore file for IsoAmplar Plot Analysis. It is not a report workbook and does not contain a native editable Excel chart.

- Filename convention is `YYMMDD_<sanitizedAnalysisName>_analysisN.xlsx`, using browser-local date, the current analysis name, and the per-analysis export counter.
- If no usable analysis name is available, the safe name segment falls back to `analysis`.
- The analysis name segment must be sanitized so characters invalid on Windows/macOS/Linux filesystems are removed or replaced.
- Failed Analysis XLSX exports do not consume the analysis export counter.

Workbook shape:

- `README`: human-readable explanation that this file is for restoring an IsoAmplar analysis in the web app.
- `Settings`: human-readable analysis name, export date, app version, selected count, scale/style/legend summary including X/Y draft mode/bounds and last valid applied mode/bounds, and source summary.
- `HeaderProvenance`: one visible review row per specimen/reagent header with source, cell, display/raw value, type, number format, formula, and cache state.
- `ImportedData`: full normalized imported dataset for review, including curves that are not currently selected or plotted.
- The visible `ImportedData` sheet shows original specimen/reagent labels, an Analysis label row, curve IDs, and raw fluorescence values so review remains traceable without mutating source labels.
- `Warnings`: one visible row per warning/source reference with severity, handling, affected curves, source identity, location, raw/display value, format, formula, and cache state.
- `_IsoAmplarAnalysis`: hidden worksheet containing `schemaVersion` and chunked JSON restore data. This hidden JSON is the authoritative restore source.
- `_IsoAmplarChecksum`: optional hidden worksheet for checksum or sanity markers; not emitted by the current implementation.

Restore payload must include:

- Full imported dataset with all curves, including unselected curves.
- Source metadata and source file summaries.
- Import warnings.
- Selected curve IDs, grouping mode, collapsed group IDs, search/filter state where applicable, and ordered curve IDs.
- Chart scale state, including editable Fixed/P1/P2 drafts and the separate last valid applied mode/bounds used by preview and plot image export.
- Style rules, including color/line/marker grouping rules, individual curve overrides with field-level custom/preset source metadata and Analysis labels, legend/export settings, legend label mode, export layout, and export counter.
- Analysis name.

Restore payload must exclude transient UI state:

- Runtime internal-tab identity (`analysisId`) and dirty state; restore assigns a tab-local analysis ID and starts clean.
- Import/export progress state.
- Temporary export or clipboard messages.
- Hover/readout focus and tooltip state.
- One-step preset undo stack.

Routing policy:

- `파일 선택` + original Excel: replace active analysis when clean, or show dirty confirmation with Cancel / Replace current analysis / Open as new analysis.
- `추가 선택` + original Excel: append to active analysis.
- `파일 선택` + Analysis XLSX: restore into active analysis when clean, or show dirty confirmation with Cancel / Replace current analysis / Open as new analysis.
- `추가 선택` + Analysis XLSX: open as a new internal analysis tab.
- Dirty tab close shows explicit options: Cancel, save Analysis XLSX then close, or close without saving. Dirty replacement never proceeds silently.

If the hidden restore worksheet is missing, corrupt, chunk-damaged, or has an unsupported schema version, the app must show an actionable error and must not misinterpret the file as a normal PCR source workbook. Ordinary `.xlsx` source workbooks are treated as Analysis XLSX only when they contain the explicit IsoAmplar restore marker, so review-like sheet names such as `Settings` or `ImportedData` alone do not change routing. Current Analysis XLSX uses schema 3 and normalized dataset schema 2. Schema 1 is migrated by deriving explicit applied scale state and legacy source/header/warning provenance. Schema 2 keeps its explicit applied scale and migrates legacy header/warning provenance. Schema 3 requires explicit applied scale, Excel header provenance, warning handling, and source-reference arrays; missing required state is rejected as corrupt. Restore may fill only documented non-destructive legacy defaults.

## Report / Plotted XLSX Rules
Report/Plotted XLSX remains deferred and is separate from Analysis XLSX.

- Analysis XLSX is the only implemented workbook export for analysis continuation. It stores the full imported dataset and web-app settings so the user can reopen the file in IsoAmplar Plot Analysis and continue analysis.
- Report/Plotted XLSX would be a future reporting output for the current plotted subset, potentially with a static chart image and plotted data sheets.
- Report/Plotted XLSX must not be treated as a restore source unless it also contains the explicit hidden IsoAmplar restore payload.
- Native editable Excel chart generation is excluded from the current implementation and no chart-image workbook dependency is required.

## Pasted Table Rules
Quick Paste Import is an implemented post-MVP input path, not an in-app spreadsheet editor.

Implemented rules:
- Input is textarea text copied from a small table.
- Full-table mode uses the same structure as Excel import: row 1 specimen labels, row 2 reagent labels, row 3+ fluorescence values.
- Single-specimen mode requires a separate specimen-name field and uses pasted row 1 as reagent labels and pasted row 2+ as fluorescence values.
- In single-specimen mode, the supplied specimen name is applied only while constructing the new paste import source before preview confirmation. It is not a correction or edit of previously imported data.
- Blank single-specimen names block preview/import with an actionable message.
- X values are generated as `Cycle 1..N`, matching Excel import behavior.
- Tab-separated text is the primary supported delimiter.
- Delimiter-free single-column input is supported for one copied curve.
- Comma-separated/CSV tables are rejected before import. Quoted CSV, escaped comma, multiline cells, thousands-separator interpretation, decimal-comma interpretation, and custom CSV dialects are not supported.
- Repeated whitespace is not a supported delimiter because specimen/reagent labels can contain spaces.
- The preview parser must not mutate the active analysis until the user confirms append or new-analysis import.
- Preview output is read-only. Users correct errors by editing the textarea source, or the specimen-name field in single-specimen mode, and regenerating preview.
- Changing the input mode, specimen-name field, or textarea after preview invalidates or blocks stale preview confirmation.
- Source-name-only changes do not reparse fluorescence data; source metadata is updated atomically while `curveId` and the immutable source-instance ID remain unchanged.
- Empty or nonnumeric fluorescence values become `null` only after the preview identifies the source location and the user acknowledges the resulting chart gap.
- Source metadata should identify paste sources, preferably through `sourceKind: "paste"` or an equivalent explicit marker in restore metadata and visible review sheets.
- `curveId` remains source-position based and is not derived from editable source names. Source name changes must not change selection, style overrides, legend order, or export order identities.
- Current-analysis append preserves existing selected curves, scale, style rules, individual overrides, Analysis labels, legend/export order, and export counter policy. Newly appended paste curves start unselected.
- New-analysis import creates an independent analysis tab using the same default selection policy as Excel import: no selected curves and all major groups collapsed.
- Analysis XLSX must preserve paste sources as part of the full dataset, including unselected paste curves and their source metadata.
- Analysis XLSX visible review sheets identify source type, source name, immutable source ID, source column, and paste input mode; hidden restore JSON is authoritative.
- Every import instance receives an immutable source-instance ID even when the same filename and worksheet metadata are imported repeatedly.
- Warning details use bounded pagination so every warning source location remains inspectable; the acknowledgement still applies only after the user explicitly accepts the displayed `null`/chart-gap outcome.
- The existing browser safety envelope remains at most 2,000,000 source characters and 250,000 rectangular cells. Accepted tall, wide, and empty-heavy shapes inside that envelope must complete preview rather than being rejected solely for shape.
- Preview shows row, column, cell, source-character, curve, cycle, warning, and approximate minimum working-memory counts. This estimate is advisory and does not guarantee capacity for every browser/device.
- Parser and append/new-analysis exceptions that JavaScript can catch return controlled errors and preserve current analysis state. Quick Paste render failures remain inside the dialog boundary; active-workspace failures leave analysis tabs/import and Analysis XLSX recovery available. A browser process terminated by OOM cannot be handled by the page.

## Manual Entry Rules
Manual table entry and in-app data editing are not part of the MVP or the Quick Paste Import plan. Source data corrections should be made in the source Excel file, or in the paste textarea before preview confirmation. The single-specimen Quick Paste field supplies a missing specimen header before import; it does not edit an imported dataset. Once imported, source specimen, reagent, and fluorescence values are not edited inside the app.

## PCR Header Interpretation
MVP rules:

- Row 1 is always specimen labels.
- Row 2 is always reagent labels.
- Row 3 onward is fluorescence data.
- Similar specimen or reagent names warn only; the app does not merge, rename, or correct labels. MVP similar-key rule trims labels, lowercases Latin text, removes whitespace/hyphen/underscore characters, and compares non-empty keys.
- Missing specimen or reagent labels produce warnings, preserve the empty raw label, and use source-position fallback display/identity. They do not by themselves invalidate the whole worksheet.

## Internal PCR Dataset Model
The normalized PCR dataset should be representable as:

```json
{
  "curves": [
    {
      "curveId": "sheet0_col_A",
      "specimenId": "specimen_1",
      "reagentId": "reagent_a1",
      "sourceId": "workbook:sheet0:colA",
      "specimenLabel": "Specimen 1",
      "reagentLabel": "A1",
      "x": [1, 2, 3],
      "y": [120, 130, 160],
      "warnings": []
    }
  ],
  "warnings": []
}
```

Curve IDs should be stable for a given workbook/sheet/column parse and should not depend on the current tree grouping. In a single parsed workbook, IDs use source position such as `sheet0_col_A`. When another workbook is appended into the current analysis, appended IDs are rekeyed with an import prefix such as `file2_sheet0_col_A` so selections, overrides, chart series, and export order do not collide with the existing dataset.

## Type Inference
Candidate data types:

- `text`
- `number`
- `date`
- `boolean`
- `empty`
- `mixed`

Type inference should not destroy original values. If parsing is ambiguous, the UI should show a warning. MVP does not provide manual correction; users correct the source workbook and reupload.

## Missing Value Handling
Candidate rule:

- Empty cells normalize to `null`.
- Empty fluorescence cells normalize to `null`.
- X values are generated cycle numbers in MVP and should not be missing.
- Chart-specific behavior for `null` fluorescence values must be implemented and tested.

Open questions:

- Missing Y values should create chart gaps and export as blank cells in plotted-data CSV.
- Should advanced filters treat empty strings and nulls as the same in a future version?

## Selection and Search Model
MVP selection is curve-based:

- `selectedCurveIds`: selected curves.
- `groupingMode`: `reagent` by default, `specimen` optional.
- `matchedCurveIds`: all curves matching current search across the full dataset.
- Search bulk actions apply to `matchedCurveIds`, including collapsed or nonvisible rows.
- Major groups start collapsed after import.
- No curves are selected by default after import.

## Chart Configuration Model
MVP chart configuration:

```json
{
  "chartType": "pcr-amplification-line",
  "x": {
    "source": "generated-cycle",
    "scale": {
      "mode": "fixed",
      "min": 1,
      "max": 45,
      "preset1": { "label": "P1", "min": "", "max": "" },
      "preset2": { "label": "P2", "min": "", "max": "" }
    }
  },
  "visibleCurveIds": ["sheet0_col_A"],
  "legend": {
    "visible": true,
    "mode": "grouped",
    "order": ["sheet0_col_A"],
    "exportLayout": "plot-plus-legend"
  },
  "legendSettings": {
    "previewVisible": true,
    "reportLabelMode": "autoCompact",
    "reportNameOverrides": {}
  },
  "exportSettings": {
    "imageLayout": "plotWithLegend"
  },
  "styleRules": {
    "colorBy": "reagent",
    "lineTypeBy": "specimen",
    "markerBy": "reagent",
    "specimenColors": {},
    "reagentColors": {},
    "specimenLineTypes": {},
    "reagentLineTypes": {},
    "specimenMarkerTypes": {},
    "reagentMarkerTypes": {}
  },
  "curveOverrides": {
    "sheet0_col_A": {
      "lineType": "solid",
      "markerType": "none",
      "fieldSources": {
        "lineType": "preset",
        "markerType": "preset"
      }
    }
  }
}
```

`legendSettings.reportNameOverrides` is retained only for same-schema legacy restore compatibility. New per-curve label edits are stored as `curveOverrides[curveId].displayName` and are treated as Analysis labels.

This structure may be refined during implementation but must preserve curveId-based identity.

## Outputs

| ID | Output | Initial Rule | Related Requirements | Acceptance Criteria |
| --- | --- | --- | --- | --- |
| IO-101 | Chart preview | Reflect current dataset, filters, mappings, layout, legend, fixed scales, and Box zoom-applied Fixed X/Y bounds. | FR-006 to FR-010 | AC-004 to AC-008, AC-PCR-044 |
| IO-102 | Image download | Export the current chart preview as PNG or JPEG with white background. | FR-011 | AC-009, AC-PCR-010 |
| IO-103 | Clipboard output | Copy the selected chart image layout where supported, provide report legend-only PNG clipboard copy, provide rich Excel-cell report legend clipboard copy where supported, and show fallback on failure. | FR-012, FR-019 | AC-010, AC-PCR-031, AC-PCR-041 |
| IO-104 | Static build | Produce static assets that work on GitHub Pages. | FR-013 | AC-011 |
| IO-105 | Plotted data export | Export only currently plotted data when the current chart projection is simple and rectangular; otherwise disable with a clear reason. | FR-016 | AC-PCR-021, AC-PCR-022 |
| IO-106 | Analysis XLSX export | Export a full analysis restore workbook containing the complete imported dataset and settings. | FR-017 | AC-PCR-033, AC-PCR-034, AC-PCR-037 |

## Image Download Rules
- Formats: PNG, JPEG.
- Background: white only.
- Filename convention: `YYMMDD_<sanitizedAnalysisName>_plotN.ext`, using browser-local date and the current analysis name. Example: `260709_Run_A_plot1.png`.
- The analysis name segment is sanitized by trimming whitespace, replacing invalid filename characters and whitespace with `_`, collapsing repeated `_`, trimming surrounding `_`, and limiting the segment length. Blank or fully invalid names fall back to `analysis`.
- Export excludes UI controls and includes only the chart output.
- Export reflects current selected curves, scale, Box zoom-applied Fixed bounds, style, legend/order state, and selected export layout.
- Image export layouts:
  - `plotOnly`: exports only the chart canvas with the built-in ECharts legend hidden.
  - `plotWithLegend`: exports the chart plus a custom legend area below the plot so the legend does not obscure plotted data.
  - `legendOnly`: exports only the custom legend image for the current selected/order/style projection.
- PNG/JPEG download and the standard clipboard PNG action use the selected image export layout. Report legend PNG/JPEG, report legend PNG clipboard copy, and report legend rich Excel clipboard copy use the report legend projection for document assembly and do not change the selected image export layout. Plotted CSV and Analysis XLSX are unaffected by image layout selection.
- Export uses the same chart option projection as preview. Preview layout height is fixed in the UI, while image export keeps its chart-only export dimensions.
- More than 20 visible curves warns but does not block export by default.
- Supported image export layouts:
  - `Plot only`: chart image only.
  - `Plot + Legend`: chart image plus custom legend outside the plot area.
  - `Legend only`: custom legend image only.
- The default image export layout includes the legend outside the plot area. The preview custom legend should not obscure plotted curves.

## Plotted Data Export Rules
- Format: CSV.
- Filename convention: `YYMMDD_<sanitizedAnalysisName>_plotN_data.csv`, using the same sanitized analysis name and `plotN` counter as image export.
- Counter rule: if data CSV is exported together with an image, both artifacts share the same `plotN`; if data CSV is exported alone, it receives the next browser-local `plotN`.
- Failed export attempts do not consume `plotN`.
- Data scope: current plotted curves only, in current legend/export order.
- Exclude hidden curves, unselected curves, and raw workbook data that is not part of the current chart projection.
- Enable only when the current chart state is simple: one chart, shared X values across visible curves, and rectangular CSV output possible.
- If not enabled, show a concise reason instead of exporting partial or misleading data.
- Header row starts with `Cycle`.
- Duplicate display labels are disambiguated by source file and column, for example `A1 │ 검체 1 [sample.xlsx:A]`.
- `null` Y values export as blank CSV cells.
- CSV values are quoted when required by commas, quotes, or line breaks.

## Clipboard Rules
- Supported chart/legend image clipboard MIME type: `image/png`.
- Supported report legend Excel clipboard MIME types: `text/html` plus `text/plain` in the same `ClipboardItem`; the plain text exists only as a compatibility flavor, not as a user-facing TSV export.
- Clipboard copy must be triggered by an explicit user action.
- Standard clipboard copy uses the selected image export layout, the same chart option projection as PNG export, and a white background.
- Report legend PNG clipboard copy exports a larger, report-readable legend-only PNG for the current selected/order/style/Analysis-label projection, with white background, and does not mutate the selected image export layout.
- Report legend Excel clipboard copy writes a rich HTML table so Excel can paste the style sample and legend name into separate cells where browser/Excel support it. The style sample is an Excel-friendly colored text glyph representation, not a native vector line object, because Excel may strip SVG or complex inline drawing markup from clipboard HTML. It uses Analysis labels, auto-compact/full label mode, Malgun Gothic 9 pt table text, and a plain-text compatibility flavor. It is not a native editable Excel chart.
- If `navigator.clipboard.write` or `ClipboardItem` is unavailable, or if permission is denied, show a fallback message telling the user to download PNG instead.
- Clipboard copy does not consume the `plotN` filename counter unless a fallback download is explicitly performed.

## Implemented Export Counter Rules
- Browser session starts at `plot1` after a dataset import.
- Successful PNG/JPEG download increments `plotN`.
- Successful plotted-data CSV download increments `plotN`.
- Failed image, clipboard, or CSV attempts do not increment `plotN`.
- Changing the analysis name changes future filenames only; it does not reset the `plotN` or `analysisN` counter.
- Current MVP implements image and data CSV as separate actions; combined image+CSV export remains a future candidate.

## Future Output Candidates
These are not confirmed:

- Download chart configuration JSON.
- Export PDF.
- Export SVG.
- Save chart presets in localStorage.
- Report/Plotted XLSX containing current plotted data plus a static chart image.
- Native editable Excel chart generation is excluded unless a future decision explicitly reopens it.

## Error Messages
The application should provide clear messages for:

- Unsupported file type
- File too large
- Empty dataset
- Missing headers
- Duplicate headers
- Invalid chart mapping
- Fixed axis min greater than max
- Clipboard permission failure
- Export generation failure
- Missing or unsupported Analysis XLSX restore sheet
- Dirty active analysis replacement requires explicit replace/new-analysis confirmation
- Dirty analysis tab close requires explicit cancel/save-and-close/discard confirmation
