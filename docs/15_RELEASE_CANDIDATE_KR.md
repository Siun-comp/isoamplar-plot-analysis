# 15 릴리스 후보 및 배포 증거

## 상태
Released - post-deploy smoke passed

## 기준일
2026-07-11

## 릴리스 목적
2026-07-11 GPT-5.6 정밀감사 보완 S0-S11의 입력 추적성, scale/legend/export 정확성, 분석 저장 연속성, 데스크톱 사용성, CI/Pages 안전 게이트를 공개 GitHub Pages 기준으로 확정한다.

## Candidate 식별자
- Candidate branch: `codex/audit-remediation`
- Initial candidate commit/tag: `dcdbc21c01adafd355fa60d9d0cda0e54c853444` / `release-20260711-audit-remediation`
- Final promoted commit/tag: `eae3281fb8f9bbbd900fab528be3e094b93b555a` / `release-20260711-audit-remediation-r1`
- Pre-release rollback SHA: `9e77ad23ec8e863d3d05e7c8508ceb4729372155`
- Current released product artifact source SHA: `eae3281fb8f9bbbd900fab528be3e094b93b555a`; evidence-only documentation commits may follow without changing the verified dist hash
- Local Pages-base dist tree SHA-256: `1012572727dd66d74763775f828fef165baa24012c61c770db6617e90d6cce46`
- Public URL: https://siun-comp.github.io/isoamplar-plot-analysis/

## Local release evidence
- `git diff --check`: pass
- Vitest: 32 files / 265 tests pass
- Audit probe: 1 pass
- Production dependency audit high/critical: 0 vulnerabilities
- Pages-base production build: pass
- Fresh Chromium: 11/11 pass with fail-on-flaky
- Dist pre/post Playwright SHA-256: byte-identical at `1012572727dd66d74763775f828fef165baa24012c61c770db6617e90d6cce46`
- In-app 1366x768 Pages path: no horizontal overflow, no console warning/error
- Final S10 release/security review: GO
- Final S10 browser/data-integrity review: GO
- User guide: 16 pages, synthetic-only, Poppler render QA pass, sensitive-term/path scan clear
- Representative workbook local-only smoke: import, all-curve selection, nonblank canvas, user-labelled P1/P2 apply, browser error 0; no label/value/path was copied into repository evidence

## 배포 전 최종 자동 확인
- [x] 최종 working tree와 문서 link 검사
- [x] 전체 test/audit/build/fresh Chromium
- [x] exact dist hash 재기록
- [x] 4역할 최종 감사 GO - product/domain, data/privacy, desktop UX/accessibility, QA/release
- [x] candidate commit/tag 생성
- [x] branch CI 성공

## 공개 Pages smoke
- [x] HTTP 200, title/icon/static asset base path
- [x] synthetic `.xlsx` import와 reagent-first collapsed state
- [x] curve 선택 후 nonblank canvas
- [x] P2/Box zoom/Previous scale
- [x] custom legend와 dashed-line/circle-marker identity
- [x] PNG download와 white opaque background
- [x] Analysis XLSX save/restore
- [x] 예상하지 않은 console/page error 없음
- [x] 예상하지 않은 runtime cross-origin request 없음

공개 smoke는 합성 fixture만 사용했다. 공개 URL의 25개 known `dist` file을 로컬 검증 artifact와 byte 비교해 mismatch 0을 확인했다. 내보낸 PNG는 2400 x 1772, 네 모서리 흰색, alpha 255였고, Analysis XLSX는 공개 앱에서 새 분석 탭으로 복원됐다.

## 사용자 수동 검수
- [ ] 실제 업무 workbook의 label/curve/warning 확인
- [ ] 실제 비교 범위 P1/P2와 style 확인
- [ ] Windows Chrome/Edge clipboard PNG 확인
- [ ] Excel rich legend paste의 cell/font/style 확인
- [ ] 큰 실제 workbook의 체감 성능 확인

## 미결정 사항
- 공식 최대 file/curve/cycle/browser-memory 지원 한계
- internal analysis tab warning 또는 hard cap
- public Pages 유지 또는 조직 접근제어 hosting
- Named View, Export Preflight, multi-step settings undo

이 항목은 현재 릴리스의 데이터 무결성 또는 핵심 분석 흐름을 차단하지 않는다. 새 범위 도입 시 별도 요구사항과 schema/roundtrip 테스트가 필요하다.

## Rollback trigger
- 지원 입력이 import되지 않거나 원본 수치가 달라짐
- 선택 후 chart canvas가 비어 있음
- scale 또는 preview/export parity 실패
- legend identity/style 불일치
- Analysis XLSX exact restore 실패
- 예상하지 않은 runtime request 또는 심각한 browser error

## Rollback 절차
1. 실패 candidate를 직접 force-push로 지우지 않는다.
2. 실패 commit을 revert하는 새 commit 또는 last-known-good tree 복구 commit을 만든다.
3. 같은 Pages workflow로 배포한다.
4. import, nonblank chart, scale/export, Analysis XLSX, network smoke를 다시 수행한다.
5. rollback SHA, workflow run, 공개 URL 결과를 `DEVELOPMENT_STATE.md`에 기록한다.

## 배포 후 기록
- Final branch CI run: https://github.com/Siun-comp/isoamplar-plot-analysis/actions/runs/29156244025 - success, 11 Chromium tests
- Initial Pages run: https://github.com/Siun-comp/isoamplar-plot-analysis/actions/runs/29156159533 - failed before build on historical Markdown trailing whitespace; no deployment occurred and the prior public version remained active
- Final Pages workflow run: https://github.com/Siun-comp/isoamplar-plot-analysis/actions/runs/29156323546 - success
- Deployed product artifact source SHA: `eae3281fb8f9bbbd900fab528be3e094b93b555a`
- Post-deploy smoke: pass at 2026-07-11 23:39 KST
- Rollback required: no
- Nonblocking workflow annotation: GitHub reports Node 20 deprecation for current action majors while forcing them to Node 24; both branch and Pages workflows completed successfully

## Post-S11 Selection Workflow 배포 기록

- 기능 범위: Selection Sets, Analysis XLSX schema 4, Selected Data XLSX, output-role rejection, updated synthetic user guide
- Final product source SHA: `6c57afbf09a55fbb99d9e7474fb645a21a24ec95`
- Final branch CI run: https://github.com/Siun-comp/isoamplar-plot-analysis/actions/runs/29161091055 - success, 293 Vitest tests and 12 Chromium tests
- Final Pages workflow run: https://github.com/Siun-comp/isoamplar-plot-analysis/actions/runs/29161173159 - success
- Public smoke: 1280x720 synthetic original-data import, one-curve selection, Selection Set creation, Selected Data XLSX download/readback, five-sheet and hidden-role-marker verification, no document horizontal overflow, zero browser errors, zero unexpected external origins
- Public URL: https://siun-comp.github.io/isoamplar-plot-analysis/
- Rollback required: no

## M13 원본판 보고서 출력 가독성 패치 - 로컬 후보

- 신규 분석의 Chart image layout 기본값: `Plot only`
- 기존 Analysis XLSX에 명시된 `plotOnly`, `plotWithLegend`, `legendOnly`: 값 그대로 복원
- Plot 포함 PNG/JPEG/clipboard: 1200 x 760 논리 캔버스와 2x 래스터(2400px 너비), 9.5 cm 축소 배치를 고려한 축·선·마커·여백 출력 전용 프로필
- Preview, raw fluorescence, 선택 curve, X/Y bounds, 순서와 스타일: 변경 없음
- Threshold 기능과 annotation: 원본판에 추가하지 않음
- `npm run test`: 38 files / 294 tests
- `npm run test:audit`: 1/1
- `npm audit --omit=dev --audit-level=high`: 0 vulnerabilities
- Original Pages base-path build: pass
- Fresh Chromium: 12/12, including downloaded 2400 x 1520 Plot PNG white/opaque/nonblank bounds
- Exact `dist` pre/post Playwright SHA-256: `c9bc77c0be7fa90372c872e949352ac283c74dfbe7232d9aa7896616f3ca9e8f`, byte-identical
- Proportional line-width distinctions and matching Plot + Legend sample geometry: pass
- Final independent re-audit: all prior P2/P3 findings resolved; no release blocker, GO; original runtime remains Threshold-free
- 17-page original user guide Export page: Poppler render QA pass
- Product commit: `95c297705632d1bffb4f5b01eae6329872a20538`
- Pages workflow: `29317061923` - success
- Public smoke: HTTP 200, correct original title, subpath assets loaded, zero console/page errors
- T counterpart: `274260b394d6b9af395a60f5d38e759d926a4ffb`, Pages run `29317052614` - success
- Status: deployed; rollback not required
