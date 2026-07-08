# 08 릴리스 체크리스트

## 목적
IsoAmplar Plot Analysis MVP를 GitHub Pages 또는 동등한 정적 호스팅에 올리기 전 확인해야 할 항목을 정리한다.

## 현재 구현 범위
- `.xls` / `.xlsx` Excel 업로드, 첫 번째 worksheet만 사용.
- 현재 분석 데이터에 `.xls` / `.xlsx` 추가 선택으로 append.
- Row 1 검체, Row 2 시약, Row 3 이후 fluorescence 데이터 파싱.
- 원본 fluorescence 값 자동 보정/변환 없음.
- 시약별 기본 선택 보기, 검체별 보기 전환.
- 선택 보기 기준에 따른 라벨 순서 전환: 시약별은 `시약 / 검체`, 검체별은 `검체 / 시약`.
- import 직후 모든 대분류 그룹 접힘.
- 좌측 1차/2차 분류 행 배경색으로 구분.
- 검색/표시필터 기반 일괄 선택/해제.
- ECharts 기반 amplification line chart preview.
- Side panel 확장과 무관하게 고정 높이를 유지하는 plot preview.
- Desktop scroll에서 sticky로 따라오는 plot preview.
- Plot을 가리지 않는 고정 hover readout.
- 20개 초과 표시 curve 경고와 검색 결과만 유지/전체 선택 해제/구분 프리셋 보조 액션.
- Custom preview legend 표시/숨김과 plot-only, plot+legend, legend-only image export layout.
- X/Y auto/fixed scale, 사용자 입력형 P1/P2 scale preset.
- Fixed scale 편집 보조용 현재 Auto range 표시와 Auto값 적용 버튼.
- 검체/시약 그룹 스타일, 개별 curve 스타일 override.
- 그룹/개별 색상은 color picker와 HEX 코드 입력 모두 지원.
- 기본 실선/no marker, 개별 marker 없음/원형/세모/네모 옵션.
- 원본 데이터/그룹 순서 기반 안정적 기본 색상.
- 내장 style preset, 적용된 개별 override 덮어쓰기, 직전 적용 1회 undo.
- 사용자 순서 기반 legend/export order.
- PNG/JPEG download, PNG clipboard copy, plotted-data CSV 조건부 export.
- GitHub Pages용 상대 asset path 기본값.

## 자동 검증
- `npm run test`
- `npm run build`
- `npm run test:e2e`
- `npm audit --omit=dev`

## 현재 검증 결과
- Vitest: 97 tests passed.
- Playwright Chromium: 3 tests passed.
- Production build: passed.
- Production build emits lazy chunks for SheetJS and ECharts/export code.
- Production dependency audit: 0 vulnerabilities.
- `git diff --check`: passed, with CRLF replacement warnings only.
- Desktop screenshot: `docs/gui_mockups/screenshots/phase8_mvp_desktop.png`
- Mobile screenshot: `docs/gui_mockups/screenshots/phase8_mvp_mobile.png`
- Refinement screenshot: `docs/gui_mockups/screenshots/isoamplar_refinement_desktop.png`
- Append/sticky refinement screenshot: `docs/gui_mockups/screenshots/isoamplar_append_sticky_refinement.png`
- R12 hover/warning desktop screenshot: `docs/gui_mockups/screenshots/phase-r12_hover_warning_desktop.png`
- R12 hover/warning mobile screenshot: `docs/gui_mockups/screenshots/phase-r12_hover_warning_mobile.png`

## 수동 확인 필요
- 실제 `graph_TEST.xlsx` 업로드 후 검체/시약 라벨과 curve 수가 예상과 맞는지 확인.
- 추가 파일 append 후 기존 선택/scale/style/order가 유지되는지 확인.
- Chrome 또는 Edge에서 PNG clipboard copy가 동작하는지 확인.
- PNG/JPEG 다운로드 이미지가 preview와 같은 scale/style/order를 반영하는지 확인.
- P1/P2 scale preset을 실제 분석 범위로 입력했을 때 원하는 비교 흐름에 맞는지 확인.
- Marker 옵션이 필요한 실제 curve만 표시하도록 분석 관점에서 확인.
- GitHub Pages 실제 URL에서 asset 경로가 정상인지 확인.
- 큰 파일의 체감 성능 확인.

## 사용자 결정 대기
- 최대 파일 크기, 최대 row 수, 최대 검체/curve 수의 목표 기준.
- 저장형 custom preset 또는 chart configuration JSON 필요 여부.
- P1/P2 scale preset과 style 설정을 앱 reload 이후에도 저장할 필요가 있는지 여부.
- batch/multi-chart layout의 다음 버전 포함 여부.
