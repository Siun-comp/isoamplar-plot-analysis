# 08 릴리스 체크리스트

## 상태
Active release gate

## 최종 갱신
2026-07-11

## 자동 게이트
- [x] `git diff --check`
- [x] `npm run test`: 32 files / 265 tests
- [x] `npm run test:audit`: 1 audit probe
- [x] `npm audit --omit=dev --audit-level=high`: 0 vulnerabilities
- [x] GitHub Pages base-path production build
- [x] fresh Chromium `11/11` with `--fail-on-flaky-tests`
- [x] exact `dist` pre/post Playwright equality
- [x] local dist tree SHA-256: `1012572727dd66d74763775f828fef165baa24012c61c770db6617e90d6cce46`
- [x] 1366x768 in-app Pages-path preview: no horizontal overflow, no console warning/error
- [x] independent release/security and browser/data-integrity GO
- [x] final product/domain, data/privacy, desktop UX/accessibility, QA/release four-role GO
- [x] repository 밖 representative workbook의 local-only import, 전체 선택, nonblank canvas, P1/P2 적용, browser error 0

## 자동 브라우저 범위
- Excel `.xlsx`, append, Quick Paste 경계 입력
- reagent-first collapsed selection, search bulk selection
- Auto/Fixed/P1/P2/Box zoom/Previous scale
- dense Style/Legend, hover/readout, custom legend
- clipboard image failure와 download fallback 안내
- legend PNG의 exact size, 불투명 흰 배경/외곽선, text/style pixel slot
- 알려진 정적 app `GET/HEAD`와 blob/data 이외의 request/WebSocket 차단
- Analysis XLSX save/restore/resave 및 curve/source/X/Y/stats exact equality
- null, 음수, 지수값, 큰 fluorescence 값 보존

## GitHub Pages workflow
- [x] `main` push와 `workflow_dispatch` trigger 유지
- [x] build job은 `contents: read`만 사용
- [x] deploy job만 `pages: write`, `id-token: write` 사용
- [x] Pages artifact upload 전 unit/audit/dependency/Chromium/dist equality 통과
- [x] screenshot, trace, browser console, network evidence failure artifact 보존
- [x] release candidate push workflow run 성공: `29156244025`
- [x] 공개 Pages URL에서 post-deploy smoke 성공: `29156323546`, product artifact source SHA `eae3281fb8f9bbbd900fab528be3e094b93b555a`

## 사용자 수동 확인
- [ ] 실제 업무 Excel에서 검체/시약 label, curve 수, warning이 의도와 일치하는지 확인
- [ ] 실제 분석 범위의 P1/P2와 style이 비교 목적에 맞는지 확인
- [ ] Windows Chrome/Edge에서 PNG clipboard와 rich Excel legend paste 확인
- [ ] 보고서/문서에 붙인 PNG/JPEG/legend의 가독성 확인
- [ ] 큰 실제 파일에서 체감 성능과 브라우저 메모리 확인

## 미결정 항목
- 공식 최대 file/curve/cycle 수치
- internal analysis tab warning/hard cap
- public Pages 또는 조직 접근제어 hosting
- Named View, optional Export Preflight, multi-step settings undo

## 롤백 trigger
- 지원 Excel/Quick Paste import 실패
- 선택 후 canvas가 비어 있음
- Fixed/P1/P2/Box zoom 또는 preview/export scale 불일치
- legend identity/style가 preview와 export에서 다름
- Analysis XLSX restore가 dataset/settings를 정확히 복원하지 못함
- 예상하지 않은 runtime network request 또는 심각한 browser error

## 롤백 절차
1. 마지막 정상 SHA와 실패 candidate SHA를 기록한다.
2. `main`을 강제 재작성하지 않는다.
3. 실패 commit을 `git revert`하는 새 commit을 만들거나 마지막 정상 SHA의 tree를 복구 commit으로 만든다.
4. 같은 Pages workflow로 재배포한다.
5. 공개 URL에서 import, nonblank chart, scale/export, Analysis XLSX smoke를 다시 수행한다.
6. rollback SHA, workflow run, 공개 smoke 결과를 `DEVELOPMENT_STATE.md`에 기록한다.
