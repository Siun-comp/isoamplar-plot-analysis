# Audit Remediation Traceability and Evidence

## Status

- Phase: S11 released on GitHub Pages
- Updated: 2026-07-11
- Product acceptance state: Passing S11 release; unresolved user-decision items remain outside accepted scope
- Data policy: synthetic-only fixtures and generated values

## Status Vocabulary

- `Release passing`: implemented acceptance, CI, deployment, and public smoke evidence are recorded.
- `Baseline passing`: existing behavior is protected by an active test.
- `Partial known red`: isolated defect-signature probe reproduces a specified subset of the audit defect; this is not acceptance.
- `Target TODO`: acceptance wording is frozen but no executable probe is safe or complete yet.
- `Partial foundation`: S1 infrastructure exists but later release gates remain open.
- `Decision pending`: implementation depends on a listed UD item.

## Evidence Matrix

| Audit finding | FR / IO / Decision | Target | Fixture / evidence input | Automated owner and path | Manual owner / evidence | Current status | Remediation Phase |
|---|---|---|---|---|---|---|---|
| C-P1-01 invalid active scale and tiny Box zoom precision | FR-006, FR-009, FR-010, D036, D041 | AC-PCR-045 | FX-007; generated invalid Fixed/P1/P2/exponent cases | Chart QA: `src/chart/chartScale.test.ts`, `src/chart/chartConfig.test.ts`, `src/app/App.test.tsx`, `src/analysis/analysisState.test.ts`, `src/analysis/analysisWorkbook.test.ts` | Desktop QA: `docs/gui_mockups/screenshots/s2_scale_draft_applied.png`; fresh Chromium invalid-draft/export flow | Passing S2; valid non-overlap remains warning-only pending UD-15 | S2 |
| C-P1-02 and U-P2-06 shared-prefix legend identity loss | FR-008, FR-011, FR-012, FR-019, D028, D035, D042 | AC-PCR-046 | FX-006; generated unique suffix and final-string collision | Export QA: `src/chart/legendLayout.test.ts`, `src/chart/chartProjection.test.ts`, `src/chart/exportChart.test.ts`, `src/ui/CustomLegend.test.tsx`, `tests/e2e/app.spec.ts`; raster helper `tests/e2e/helpers/rasterEvidence.ts` | Desktop QA: `docs/gui_mockups/screenshots/s3_legend_identity_desktop.png`, `docs/gui_mockups/screenshots/s3_legend_export.png`; Windows Excel appearance remains manual | Passing S3: measured suffix-preserving layout, collision/source evidence, style/bounds matrix, and downloaded PNG pixel checks | S3 |
| C-P1-03 Excel formatted header identity | FR-001, IO-001, D014, D043 | AC-PCR-047 | FX-001 full header target; FX-002/003 container parity | Parser QA: `src/data/parseExcel.test.ts`, `tests/data/parseExcel.fixture.test.ts` | Data QA: visible `HeaderProvenance` review sheet plus parser provenance assertions | Passing S4: formatted identity, stale-`cell.w` defense, raw/type/format/formula/cache evidence, XLS/XLSX parity | S4 |
| C-P1-04 warning source and handling traceability | FR-001, FR-004, FR-017, FR-020, IO-001, D014, D039, D043 | AC-PCR-048 | FX-004 warning corpus; generated same-name multi-source append | Data QA: code/location/handling/Y-gap/source separation and schema migration tests | Desktop QA: shared inspector, source filter, transient navigation, visible workbook sheets | Passing S4: warning evidence remains source-distinct and navigation preserves analysis state | S4 |
| C-P1-05 browser refresh/close loss | FR-017, FR-018, D026, D027, D045 | AC-PCR-049A | Generated all-clean/dirty multi-tab workspace | Store/UI QA: `src/app/App.test.tsx` inactive-dirty and all-clean beforeunload transition | Desktop QA: production preview plus native beforeunload contract | Passing S6 | S6 |
| C-P2-06 async result written to wrong tab | FR-011, FR-012, FR-017, FR-018, D040, D045 | AC-PCR-049B | Deferred save/export/clipboard promises and replaced runtime | Store/UI QA: `src/app/appStore.test.ts`, `src/app/App.test.tsx` deferred clipboard and stale runtime cases | Desktop QA: fresh Chromium output/save/tab flow | Passing S6 | S6 |
| C-P2-01 Analysis XLSX semantic inconsistency | FR-017, IO-005, D026, D039, D046 | AC-PCR-050 | Generated length/stats/entity/source/order contradictions plus non-BMP chunk boundary and 96-curve/100-cycle measured payload | Analysis QA: `src/analysis/analysisState.test.ts`, `src/analysis/analysisWorkbook.test.ts`, `src/app/appStore.test.ts` | Desktop QA: actionable rejection with current state unchanged; visible source cycle/size review metadata | Passing S7A; hard payload guard remains UD-02 | S7 |
| C-P2-03 spreadsheet formula interpretation in CSV | FR-016, D035, D046 | AC-PCR-051 | Labels beginning `=`, `+`, `-`, `@`, quoting, and post-neutralization collision | Export QA: `src/chart/plottedDataExport.test.ts`, `tests/audit/knownRed.audit.ts` | Windows Excel QA remains a release manual check | Passing S7A: output-only neutralization; source/Analysis XLSX values unchanged | S7 |
| U-P2-01 inactive Legend panel visible | FR-008, D035, D047 | AC-PCR-052A | Synthetic selected curves with Legend Order/Labels tabs | Frontend QA: `src/app/App.test.tsx`, `tests/e2e/app.spec.ts` | Accessibility QA: computed display, accessibility tree, roving focus, Arrow/Home keys | Passing S8 | S8 |
| U-P2-03 sticky plot unavailable at desktop height | FR-020, D032, D047 | AC-PCR-052B | Generated 100-curve long-label workspace | Frontend QA: `tests/e2e/app.spec.ts` at 1280x720, 1366x768, 1920x1080 | Desktop QA: plot bounding box, fixed canvas height, horizontal overflow, compact rows and portalled popovers | Passing S8; official minimum resolution remains UD-08 | S8 |
| C-P2-04 dense hover/editor work | FR-020, D030, D031, D048 | AC-PCR-038, AC-PCR-039, AC-PCR-040 | Generated 20x100 reference and 100x100 stress workbooks | Chart QA: `src/chart/ChartView.test.ts`, `src/app/App.test.tsx`; browser QA and reusable JSON output: `tests/e2e/app.spec.ts` | Evidence: `docs/14_S9_PERFORMANCE_EVIDENCE.md`; representative user-file budget remains undecided | Passing S9 implementation: RAF coalescing, 32 px X-window candidates with deterministic >=5x work reduction, real ECharts patch fidelity, stale-work invalidation, measured Style and Legend retained without new virtualization | S9 |
| CI/release drift | FR-013, D002, D003, D049 | RQ-CI-001 | Fixed fixture manifest, exact built `dist`, generated browser workbooks, PNG evidence | Release QA: `.github/workflows/s1-ci.yml`, `.github/workflows/pages.yml`, `scripts/dist-integrity.mjs`, `tests/audit/releaseEvidence.test.ts`, `tests/e2e/app.spec.ts` | Release owner: actual workflow run, candidate hash, post-deploy Pages smoke in S11 | Passing S10 implementation: fresh dedicated preview, real repository base path, committed-diff/audit gates, exact-dist before/after equality, exact expected network/WebSocket probe evidence, opaque raster/text/style bounds, clipboard fallback, Analysis XLSX save/restore/resave with exact curve/source/X/Y/stats equality, least deploy permissions | S10 |
| C-P1-06 accepted Quick Paste stack overflow | FR-003, D037, D041, D044 | AC-QP-021 | Exact 250,000 x 1, 3 x 83,333, 500 x 500 empty-heavy, 2,000,000-character inputs; exact over-limit rejection | Parser/UI QA: `tests/fixtures/generatedCases.test.ts`, `src/data/parsePastedTable.test.ts`, `src/ui/PasteImportPanel.test.tsx`, localized boundary tests | Desktop QA: fresh Chromium and in-app production preview summary/overflow/log inspection | Passing S5: accepted envelope previews, out-of-envelope/parser/import/render failures remain controlled, current analysis and app shell are preserved | S2/S5 |

## Fixed Evidence Files

- Manifest: `tests/fixtures/manifest.json`
- Generator: `tests/fixtures/generateFixtures.mjs`
- Expected projections: `tests/fixtures/expected/`
- Binary sources: `tests/fixtures/source/`
- Passing fixture tests: `tests/data/parseExcel.fixture.test.ts`
- Isolated known-red probes: `tests/audit/knownRed.audit.ts`
- S10 release contract tests: `tests/audit/releaseEvidence.test.ts`
- Raster evidence helper: `tests/e2e/helpers/rasterEvidence.ts`

## S1 Exit Rule

S1 completes when fixed hashes, passing baseline tests, isolated known-red probes, Target/TODO inventory, early CI artifact plumbing, and this matrix agree. No row becomes product-accepted solely because S1 evidence exists.

## S1 Local Verification Evidence

- Fixture regeneration: 14 generated source/snapshot files checked; 0 changed; `manifest.json` remained byte-identical.
- Regular regression: `npm run test` passed 22 files / 172 tests with 7 explicit Target TODOs.
- Known-red evidence: `npm run test:audit:red` passed 5 exact defect-signature probes. A passing probe means the documented defect was reproduced, not remediated.
- Production build: `npm run build` passed. One preceding Node 24.14.1 Windows run generated all assets and then hit a non-reproducing `libuv` shutdown assertion; the immediate rerun exited 0.
- Fresh browser: CI-mode Chromium ran 5 Playwright tests from a newly started port 4173 preview server.
- Same artifact: all 25 files in the browser-tested `dist` matched `evidence/dist-files.sha256`; the CI gate regenerates the complete sorted manifest after Playwright and compares it byte-for-byte, so added, deleted, or changed files fail the job. A local negative-control check added a temporary 26th file, confirmed the comparison failed, removed it, and reconfirmed the final 25-file equality. Local tree digest: `2b32208e7d09730fcd7a09fc9c05b80e8c10d12577c52abb673f47599f9dfdb5`.
- Dependency audit: `npm audit --omit=dev` reported 0 vulnerabilities.
- Desktop visual evidence: `docs/gui_mockups/screenshots/s1_fixture_import.png` uses only generated FX-002 synthetic labels and values; 1920x1080 render had no console/page errors or horizontal overflow.
- CI scope: `.github/workflows/s1-ci.yml` is read-only and non-deploying. An actual GitHub Actions run is intentionally pending user approval to commit/push the branch.
- Product behavior: no `src/` file changed in S1. The known-red product defects remain scheduled for later phases.

## S2 Local Verification Evidence

- Scale invariant: Fixed/P1/P2 draft state is separate from last valid applied mode/bounds; invalid active drafts keep preview bounds and block only plot-bearing image output.
- Export parity: component tests verify PNG, JPEG, and chart clipboard receive identical applied X/Y bounds; Legend-only, report legends, plotted CSV, and Analysis XLSX remain available.
- Persistence: Analysis XLSX schema 2 stores and requires draft/applied scales; schema 2 missing-applied corruption rejection, full schema 1 workbook migration, and invalid-draft roundtrip are covered.
- Numeric safety: iterative finite reductions replace unbounded min/max and row-width spreads in accepted parser, stats, chart domain, merge, plotted CSV, and workbook paths.
- Boundary evidence: exact 250,000 x 1 and 500 x 500 Quick Paste cases parse; 501 x 500 rejects before import. Phase S5 completes the 3 x 83,333 and exact-character/UI responsiveness matrix.
- Box zoom: round-trip numeric formatting preserves small, negative, exponential, large, and adjacent distinct bounds with `min < max`; Previous scale snapshots retain draft and applied state.
- Automated regression: `npm run test` passed 24 files / 190 tests with 7 Target TODOs; `npm run test:audit:red` now contains 3 remaining exact defect signatures.
- Production/browser: `npm run build` passed; fresh CI-mode Chromium passed 15/15 tests across three repetitions, including invalid draft, applied-range retention, plot-image blocking, Analysis XLSX availability, Legend-only image allowance, and deterministic Export disclosure handling.
- Desktop visual: `docs/gui_mockups/screenshots/s2_scale_draft_applied.png` uses FX-002 synthetic data at 1920x1080 with no console/page errors or horizontal overflow.

## S3 Local Verification Evidence

- Projection: preview, standard/report raster, and rich Excel clipboard retain the same user order and resolved line/marker style by `curveId`; report projection is produced once per chart build.
- Identity layout: browser `measureText` drives bounded maximum-two-line rendering. Semantic label segments use explicit middle ellipsis that keeps the leading context plus lot/concentration/temperature-style endings.
- Auto-compact title: long shared specimen/reagent identity in a report legend title uses the same measured, bounded, end-preserving two-line rule and exposes title bounds for regression checks.
- Collision handling: unresolved full or rendered-label collisions include curveId and immutable source evidence. Legend-bearing SVG/PNG/JPEG/Excel output rejects the collision; Plot-only bypass remains unchanged.
- Bounds and style automation: SVG evidence covers no out-of-canvas text/sample bounds and all 12 solid/dashed/dotted x none/circle/triangle/rect combinations without changing requested dimensions.
- Browser raster: the generated synthetic `s3-legend-identity.xlsx` flow verifies visible Lot A/B endings, dashed/dotted run-count separation, circle/rect pixel-area separation, a 2400-pixel PNG width at 2x export ratio, white corners, and nonblank content.
- Automated regression: `npm run test` passed 26 files / 199 tests with 7 Target TODOs; `npm run test:audit:red` now contains 2 remaining non-S3 defect signatures; `npm run build` passed; fresh CI-mode Chromium passed 6/6.
- Desktop browser: the local production preview returned HTTP 200 and showed no horizontal overflow, replacement characters, console warnings, or page errors.
- Desktop visuals: `docs/gui_mockups/screenshots/s3_legend_identity_desktop.png` and `docs/gui_mockups/screenshots/s3_legend_export.png` contain only synthetic condition/assay labels.
- Manual boundary: rich Excel clipboard cell values/order/font/style payload are automated; final Chrome/Edge to Windows Excel visual fidelity remains a documented manual check.
- Fixture status: FX-006 is active/passing for S3 and FX-007 is active/passing for S2 across the generator, expected targets, manifest, and fixture plan.

## S4 Local Verification Evidence

- Excel identity: specimen/reagent display labels are recomputed from raw value, type, and number format with SheetJS formatting; stale cached `cell.w` is not authoritative. FX-001 covers `001`, date, scientific notation, spacing, and special-character identities.
- Provenance: Excel header and warning evidence retains source instance/name/kind, worksheet, cell/range/column, raw/display value, cell type, number format, formula text, and cache status where available.
- Formula policy: formulas are never recalculated. Finite cached fluorescence is retained unchanged with a warning; missing cache becomes the existing `null` chart gap. Signature mismatch is diagnostic only.
- Warning traceability: Excel and Quick Paste share one filterable, paginated Warning Inspector. Same-name repeated imports receive distinct source options and warning evidence; dataset-level warning curve IDs participate in warning filtering and tree badges.
- Navigation invariant: warning location reveal is transient UI state. Component snapshots verify selection, order, style, search/filter, collapse, runtime revision, and dirty state remain unchanged and the prior view returns exactly.
- Persistence: Analysis XLSX schema 3 and normalized dataset schema 2 add visible `HeaderProvenance` and expanded `Warnings` sheets. Schema 1 and 2 migrate explicit legacy provenance; malformed current-schema provenance is rejected.
- Automated regression: `npm run test` passed 27 files / 217 tests with 6 Target TODOs; `npm run test:audit:red` contains one remaining non-S4 CSV defect signature; `npm audit --omit=dev` found 0 vulnerabilities.
- Production/browser: `npm run build` passed; fresh CI-mode Chromium passed 6/6, including formatted identity, actionable warning detail/navigation, and Analysis XLSX sheet/schema readback. In-app production preview had zero replacement characters, no horizontal overflow, and zero console warnings/errors.
- Desktop visuals: `docs/gui_mockups/screenshots/s4_warning_desktop.png`, `s4_warning_inspector.png`, and `s4_warning_navigation.png` use generated synthetic workbook values only. The full-page evidence shows the inspector and three-column analysis workspace together without horizontal overflow.
- Independent re-audit: initial NO-GO findings for nonnumeric provenance, blank source IDs, append warning duplication, pagination/detail drift, preview-only Quick Paste navigation, same-name source display, and listbox semantics were fixed and regression-tested. Final data-integrity and desktop-UX verdicts are GO; only documented coverage-depth residuals remain.

## S5 Local Verification Evidence

- Accepted-envelope execution: generated exact tall `250,000 x 1`, wide `3 x 83,333`, empty-heavy `500 x 500`, and exact 2,000,000-character inputs complete parsing; 250,001-cell and 2,000,001-character inputs reject before state mutation.
- Shape safety: warning provenance uses one reusable curve/location index, long entity labels use bounded deterministic IDs, preview headers are shortened only at render time, and warning source evidence renders 25 locations per page.
- State containment: parser and append exceptions return controlled Korean messages; localized Quick Paste and active-workspace boundaries preserve analysis revision/dirty/order, expose retry, leave tabs/import available, and keep Analysis XLSX recovery enabled when data exists.
- Preview diagnostics: row, column, cell, source-character, curve, cycle, warning, and approximate minimum working-memory values are shown before import. The estimate is advisory and no lower hard cap was introduced.
- Automated regression: deterministic file-serial execution made the standard `npm run test` gate pass twice consecutively at 30 files / 231 tests with 6 later-phase TODOs; `npm run test:audit:red` contains the one scheduled S7 CSV-safety signature; `npm run build` passed.
- Browser verification: a fresh CI-mode Chromium production preview passed 7/7, including tall `250,000 x 1`, wide `3 x 83,333`, and empty-heavy `500 x 500` previews using one paste-equivalent input event. In-app production preview showed the synthetic two-curve summary with no horizontal overflow and zero console warnings/errors.
- Independent re-audit: initial NO-GO findings for parallel-suite resource contention, missing maximum-envelope Chromium evidence, and shallow recovery assertions were fixed. Integration tests now execute Analysis XLSX recovery save and tab switching, and retain non-default single-specimen mode, specimen name, source text, and revision after dialog retry. Final data/performance and desktop-UX verdicts are GO with no remaining S5 blocker.

## S6 Local Verification Evidence

- Continuity: any dirty tab, including an inactive tab, activates `beforeunload`; an all-clean workspace removes the handler. No automatic browser storage was introduced.
- Save workflow: one top-level command is shared by ordinary save, save-and-close, and workspace recovery. The header shows snapshot status and explains full imported/unselected/hidden-data continuity.
- Isolation: output jobs capture analysis ID, runtime instance, revision, and a reserved counter. Same-analysis jobs serialize, different analyses remain independent, failed jobs reuse the number, and clipboard never consumes it.
- Race evidence: tests cover A-to-B completion, closed/replaced runtimes, save while modified, failed/retried output, deferred clipboard rejection after tab switching, and stale new-tab parse failure after runtime recreation.
- Import intent: original Excel open, Excel append, saved Analysis XLSX restore, and Quick Paste are separate commands with store-level role validation.
- Desktop UX: dirty close uses a native modal dialog with initial focus, Escape cancel, and focus restoration. Existing top bands were compacted without changing the fixed chart canvas height.
- Final gates: standard Vitest passed 30 files / 240 tests with 4 later-phase TODOs; the isolated S7 known-red probe remained; production build passed; fresh CI-mode Chromium passed 7/7 with fail-on-flaky enabled; dependency audit reported 0 vulnerabilities. Independent code and desktop-UX re-audits returned GO.

## S7A Local Verification Evidence

- Restore semantics: migrated Analysis XLSX state is rejected before tab creation when cycle numbering, X/Y length, longest-cycle count, statistics, specimen/reagent membership, source summary/provenance, warnings, collapsed groups, style keys, or curve references contradict one another.
- Continuity: generated 96-curve by 100-cycle workbooks round-trip the complete imported dataset and settings; visible Settings review data records source-specific cycle counts and payload measurements. No hard browser-memory limit is claimed while UD-02 remains open.
- Text safety: restore JSON chunks preserve non-BMP characters across chunk boundaries. Plotted CSV headers beginning with `=`, `+`, `-`, or `@` are neutralized only in the CSV output; source labels, Analysis labels, fluorescence values, and Analysis XLSX content remain unchanged.
- Automated evidence: focused state/workbook/store/CSV tests and the full suite passed before commit `0d35ccf`; the final known-red CSV signature was removed after its accepted regression passed. Independent semantic and performance/security reviews returned GO.

## S8 Local Verification Evidence

- Desktop workflow: the inactive Legend panel was removed, top/import bands were compacted, and Style/Legend controls expose full group identity with compact color and combined line/marker editors without changing the fixed chart viewport.
- Dense editing: selected/all/group reset scope, field origin, style collision advisories, and the >20-curve helper are explicit. Automatic palette reassignment and a new bulk editor were not introduced.
- Browser evidence: 1280/1366/1920 desktop layouts, keyboard legend order, style popover bounds, and dense selected-curve rows were covered by component and Chromium checks. Commit `37c4d96` passed full automated, build, browser, and independent code/UX GO gates.

## S9 Local Verification Evidence

- Interaction model: pointer sampling and visual emphasis are separated from persistent curve style. Hover work is requestAnimationFrame-coalesced, nearest-point lookup is bounded, and marker/line settings are not mutated by emphasis.
- Accessibility and cleanup: chart and custom-legend pointer/focus exit clear transient emphasis and readout; Box zoom suppresses hover state while active. Component regressions cover stale highlight, marker preservation, tooltip/readout, and cleanup.
- Performance evidence: deterministic work-unit measurements, a reusable no-retry browser measurement, and fresh Chromium checks are recorded in `docs/14_S9_PERFORMANCE_EVIDENCE.md`. Full unit/build/browser/dependency gates and independent code/UX reviews passed before commit `5ef12ec`.

## S10 Local Verification Evidence

- Fresh artifact: Playwright uses a dedicated non-reused port 4174 production preview and the real `/isoamplar-plot-analysis/` base path. CI records the complete `dist` tree before Chromium and rejects any added, removed, or changed file afterward.
- Runtime boundary: browser tests allow only known static app `GET/HEAD` requests and local `blob:`/`data:` output; same-origin writes, unexpected cross-origin transport, and WebSockets fail with exact negative probes.
- Export/restore evidence: raster checks cover nonblank output, opaque white perimeter, legend text/style slots, and clipboard fallback. Analysis XLSX browser save/restore/resave compares curve identity, source, X/Y, statistics, null, negative, exponential, and large values exactly.
- Release gate: the final S10 run passed 32 files / 265 Vitest tests, one isolated audit probe, zero high/critical production dependency vulnerabilities, Pages-base build, and fresh Chromium 11/11 with fail-on-flaky. The complete dist tree SHA-256 `d4818b8cdfe826c374dd9ca4f5145f2119f2418b7a5859eb8849813161f85706` was unchanged before/after browser tests. Release/security and browser/data-integrity reviews returned GO before commit `f505ab6`.

## S11 Release Evidence

- Current release evidence, candidate identity, public-origin smoke, rollback decision, and remaining manual checks are maintained in `docs/15_RELEASE_CANDIDATE_KR.md` and `docs/08_RELEASE_CHECKLIST_KR.md`.
- The 16-page Korean first-user guide uses synthetic-only examples and screenshots and has passed PDF text extraction, sensitive-term/path scanning, Poppler rendering, and page-level visual review.
- Final pre-commit gates passed 32 files / 265 Vitest tests, one audit probe, zero high/critical production dependency vulnerabilities, Pages-base build, and fresh Chromium 11/11. The complete candidate dist tree SHA-256 `1012572727dd66d74763775f828fef165baa24012c61c770db6617e90d6cce46` was byte-identical before/after Playwright.
- A representative workbook stored outside the repository passed local-only import, all-curve selection, nonblank canvas, P1/P2 applied-state labels, and browser-error checks; no real label, value, workbook path, screenshot, or exported artifact entered repository evidence.
- Final branch CI run `29156244025` and Pages run `29156323546` passed for promoted SHA `eae3281fb8f9bbbd900fab528be3e094b93b555a`, tagged `release-20260711-audit-remediation-r1`. The initial candidate Pages run `29156159533` failed before build on historical Markdown whitespace and did not deploy; the corrected workflow passed the same full-range formatting gate.
- Public smoke compared all 25 known `dist` files byte-for-byte, imported a synthetic XLSX, rendered a nonblank chart, applied/restored P2/Box zoom, preserved dashed-line/circle-marker legend identity, downloaded an opaque white PNG, restored Analysis XLSX, and observed zero unexpected external requests or browser errors.
- Remaining actual-workbook label judgement, business P1/P2 range/style choice, Windows clipboard/Excel fidelity, report readability, and large-workbook comfort are explicit user acceptance checks rather than automated release claims.
