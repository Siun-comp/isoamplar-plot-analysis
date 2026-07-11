# Audit Remediation Traceability and Evidence

## Status

- Phase: S2 scale and numeric safety complete on active remediation branch
- Updated: 2026-07-11
- Product acceptance state: Target / Known red unless explicitly marked passing baseline
- Data policy: synthetic-only fixtures and generated values

## Status Vocabulary

- `Baseline passing`: existing behavior is protected by an active test.
- `Partial known red`: isolated defect-signature probe reproduces a specified subset of the audit defect; this is not acceptance.
- `Target TODO`: acceptance wording is frozen but no executable probe is safe or complete yet.
- `Partial foundation`: S1 infrastructure exists but later release gates remain open.
- `Decision pending`: implementation depends on a listed UD item.

## Evidence Matrix

| Audit finding | FR / IO / Decision | Target | Fixture / evidence input | Automated owner and path | Manual owner / evidence | Current status | Remediation Phase |
|---|---|---|---|---|---|---|---|
| C-P1-01 invalid active scale and tiny Box zoom precision | FR-006, FR-009, FR-010, D036, D041 | AC-PCR-045 | FX-007; generated invalid Fixed/P1/P2/exponent cases | Chart QA: `src/chart/chartScale.test.ts`, `src/chart/chartConfig.test.ts`, `src/app/App.test.tsx`, `src/analysis/analysisState.test.ts`, `src/analysis/analysisWorkbook.test.ts` | Desktop QA: `docs/gui_mockups/screenshots/s2_scale_draft_applied.png`; fresh Chromium invalid-draft/export flow | Passing S2; valid non-overlap remains warning-only pending UD-15 | S2 |
| C-P1-02 and U-P2-06 shared-prefix legend identity loss | FR-008, FR-011, FR-012, FR-019, D028, D035 | AC-PCR-046 | FX-006; generated unique suffix and final-string collision | Export QA: `tests/audit/knownRed.audit.ts`; raster helper `tests/e2e/helpers/rasterEvidence.ts` | Desktop QA: all raster variants, not required for S1 exit | Partial known red: standard SVG suffix loss executed; full raster/collision outcomes open | S3 |
| C-P1-03 Excel formatted header identity | FR-001, IO-001, D014 | AC-PCR-047 | FX-001 full header target; FX-002/003 container parity | Parser QA: `tests/data/parseExcel.fixture.test.ts`, `tests/audit/knownRed.audit.ts` | Data QA: Excel/app provenance comparison, not required for S1 exit | Manifest/parity passing; partial known red for `.xlsx` display labels; provenance/BIFF target open | S4 |
| C-P1-04 warning source and handling traceability | FR-001, FR-020, IO-001, D014, D039 | AC-PCR-048 | FX-004 warning corpus; future same-name multi-source append | Data QA: fixed code/location/Y-gap test; `tests/audit/auditEvidence.todo.test.ts` | Desktop QA: navigate source/group without selection/order/style/dirty mutation | Partial baseline passing; target TODO | S4 |
| C-P1-05 browser refresh/close loss | FR-017, FR-018, D026, D027 | AC-PCR-049A | Generated all-clean/dirty multi-tab workspace | Store/UI QA: `tests/audit/auditEvidence.todo.test.ts` | Desktop QA: F5, browser tab close, window close | Target TODO | S6 |
| C-P2-06 async result written to wrong tab | FR-011, FR-012, FR-017, FR-018, D040 | AC-PCR-049B | Deferred save/export/clipboard promises and replaced runtime | Store QA: `tests/audit/auditEvidence.todo.test.ts` | Desktop QA: start in A, switch/close/replace, verify message/counter/dirty | Target TODO | S6 |
| C-P2-01 Analysis XLSX semantic inconsistency | FR-017, IO-005, D026, D039 | AC-PCR-050 | Generated length/stats/entity/source/order contradictions | Analysis QA: `tests/audit/auditEvidence.todo.test.ts` | Desktop QA: actionable rejection with current state unchanged | Target TODO | S7 |
| C-P2-03 spreadsheet formula interpretation in CSV | FR-016, D035 | AC-PCR-051 | Labels beginning `=`, `+`, `-`, `@` | Export QA: `tests/audit/knownRed.audit.ts` | Windows Excel QA: open/paste and verify identity-equivalent text, not required for S1 exit | Partial known red: one `=` Analysis label executed; remaining prefixes/origins open | S7 |
| U-P2-01 inactive Legend panel visible | FR-008, D035 | AC-PCR-052A | Synthetic selected curves with Legend Order/Labels tabs | Frontend QA: `tests/audit/auditEvidence.todo.test.ts` | Accessibility QA: display and accessibility tree | Target TODO | S8 |
| U-P2-03 sticky plot unavailable at desktop height | FR-020, D032 | AC-PCR-052B | Generated 24-curve long-label workspace | Frontend QA: viewport measurement TODO | Desktop QA: plot bounding box and horizontal overflow | Target TODO; UD-08 decision pending | S8 |
| CI/release drift | FR-013, D002, D003 | RQ-CI-001 | Fixed fixture manifest and exact built `dist` | Release QA: `.github/workflows/s1-ci.yml` | Release owner: artifact hash, workflow evidence, later Pages smoke | Partial foundation; raster/network/Pages remain open | S10 |
| C-P1-06 accepted Quick Paste stack overflow | FR-003, D037, D041 | AC-QP-021 | Exact 250,000 x 1 and 500 x 500 generated inputs; over-limit 501 x 500; remaining wide descriptor | Parser QA: `tests/fixtures/generatedCases.test.ts`, `src/data/parsePastedTable.test.ts`; iterative stats/domain coverage | Desktop QA: full wide/character/UI responsiveness matrix remains S5 | Partial passing S2: prior RangeError removed; exact tall/balanced/cell-over-limit execute | S2/S5 |

## Fixed Evidence Files

- Manifest: `tests/fixtures/manifest.json`
- Generator: `tests/fixtures/generateFixtures.mjs`
- Expected projections: `tests/fixtures/expected/`
- Binary sources: `tests/fixtures/source/`
- Passing fixture tests: `tests/data/parseExcel.fixture.test.ts`
- Isolated known-red probes: `tests/audit/knownRed.audit.ts`
- Remaining target TODO inventory: `tests/audit/auditEvidence.todo.test.ts`
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
- Boundary evidence: exact 250,000 x 1 and 500 x 500 Quick Paste cases parse; 501 x 500 rejects before import. Full 3 x 83,333 and character/UI responsiveness evidence remains S5.
- Box zoom: round-trip numeric formatting preserves small, negative, exponential, large, and adjacent distinct bounds with `min < max`; Previous scale snapshots retain draft and applied state.
- Automated regression: `npm run test` passed 24 files / 190 tests with 7 Target TODOs; `npm run test:audit:red` now contains 3 remaining exact defect signatures.
- Production/browser: `npm run build` passed; fresh CI-mode Chromium passed 15/15 tests across three repetitions, including invalid draft, applied-range retention, plot-image blocking, Analysis XLSX availability, Legend-only image allowance, and deterministic Export disclosure handling.
- Desktop visual: `docs/gui_mockups/screenshots/s2_scale_draft_applied.png` uses FX-002 synthetic data at 1920x1080 with no console/page errors or horizontal overflow.
