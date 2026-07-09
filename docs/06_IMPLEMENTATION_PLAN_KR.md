# 06 단계별 구현 계획 및 구현 프롬프트

## Purpose
PCR 증폭형광 그래프 작성 웹툴을 구현하기 위한 단계별 실행 계획과, 각 단계에서 사용할 구현 프롬프트를 정리한다.

## Status
Initial implementation completed through Phase 8; current app is in release validation and real-data hardening

## Last Updated
2026-07-10

## Owner
Engineering / Product / Agent

## Compression-Safe Summary
- 이 문서는 실제 구현을 시작하기 위한 실행 기준이다.
- GUI 기준은 `docs/05_GUI_OPTIONS_KR.md`와 `docs/gui_mockups/pcr_gui_options_mockup.html`이다.
- 기술스택은 확정한다: React + Vite + TypeScript, SheetJS/xlsx, Apache ECharts, Zustand + Immer, `@tanstack/react-virtual`, Vitest + Testing Library, Playwright.
- MVP 입력은 Excel 업로드만 허용한다: `.xls`, `.xlsx`, 첫 번째 worksheet만 사용한다.
- CSV, 붙여넣기, 수동 입력, 앱 내 데이터 편집, sheet 선택 UI는 MVP 밖이다.
- 기본 데이터 선택 보기는 `시약별`이며, `검체별` 보기는 같은 `curveId` 집합의 다른 투영이다.
- import 직후 모든 대분류 그룹은 접힌 상태로 시작한다.
- 검색 일괄 동작은 접힌 항목과 가상 목록 밖 항목을 포함한 전체 검색 결과에 적용한다.
- 유사한 검체명/시약명은 경고만 표시하고 자동 병합, 이름 변경, 보정 UI를 제공하지 않는다.
- 프리셋은 MVP에서 내장 프리셋만 제공하며, 적용 범위의 기존 개별 스타일 필드를 덮어쓰고 직전 적용 1회 되돌리기를 제공한다.
- 범례와 export 순서는 현재 사용자 지정 순서를 따른다.
- 표시 곡선이 20개를 초과하면 경고와 보조 액션을 제공하지만 preview/export를 차단하지 않는다.
- PNG/JPEG export는 흰색 배경, `YYMMDD_<sanitizedAnalysisName>_plotN.ext` 파일명을 사용한다.
- plotted-data CSV는 현재 그래프가 단일 차트, 공통 X축, 직사각형 CSV로 안전하게 표현될 때만 제공한다.
- 기본 차트 스타일은 깔끔한 임상/리포트형 PCR plot 느낌으로 잡되, 촘촘한 배경 보조선과 장식적 배경은 사용하지 않는다.
- 사용자 결정이 필요한 항목은 이 문서 하단의 `결정 대기 항목`에 분리한다.

## Implementation Rule
- 각 단계가 끝날 때마다 `DEVELOPMENT_STATE.md`, `CHANGELOG.md`, 관련 요구사항/테스트 문서를 갱신한다.
- 각 단계는 구현, 테스트, Playwright 또는 브라우저 검증, 문서 갱신까지 완료해야 다음 단계로 넘어간다.
- 각 단계 프롬프트는 관련 `FR-*`, `IO-*`, `AC-*`, `AC-PCR-*`를 확인하거나 갱신해야 한다.
- 가능한 단계에서는 실패하는 테스트 또는 fixture 기대값을 먼저 추가한 뒤 구현한다.
- 사용자가 아직 결정하지 않은 항목은 임의로 확정하지 않는다.
- 원본 증폭형광 데이터에는 smoothing, baseline correction, normalization, 평균화, log transform, Ct/Cq 계산을 자동 적용하지 않는다.
- 데이터는 브라우저 내부에서 처리하고 서버 전송을 요구하지 않는다.

---

# 1. 확정된 구현 기준

## 데이터 입력
- Excel 업로드만 MVP에 포함한다.
- 지원 확장자는 `.xlsx`, `.xls`다.
- 첫 번째 worksheet만 사용한다. 이후 worksheet는 무시하고 안내 문구를 표시할 수 있다.
- 첫 번째 worksheet가 유효하지 않으면 이후 worksheet가 유효해도 import는 실패한다.
- Row 1은 검체, Row 2는 시약, Row 3 이후는 fluorescence 값이다.
- 별도 X축 정보가 없으므로 `Cycle 1~N`을 자동 생성한다.
- 동일 파일 안의 각 데이터 열은 하나의 `개별 곡선`이 된다.
- 각 곡선은 최소한 `curveId`, `specimenId`, `reagentId`, `sourceId`, `specimenLabel`, `reagentLabel`, `x[]`, `y[]`, `warnings[]`를 가진다.
- 앱 안에서 검체명, 시약명, fluorescence 값은 편집하지 않는다. 수정은 Excel 원본에서 수행하고 다시 업로드한다.

## 선택/탐색
- 기본 grouping mode는 `시약별`이다.
- 보조 grouping mode는 `검체별`이다.
- 두 보기는 같은 `curveId` 집합을 다른 트리로 보여준다.
- 선택 상태는 `selectedCurveIds`로 관리한다.
- 접힘 상태, 검색 상태, 보기 모드는 선택 상태와 분리한다.
- import 직후 모든 대분류 그룹은 접힌 상태로 시작한다.
- 검색은 전체 dataset을 대상으로 수행한다.
- 검색 일괄 선택/해제는 `matchedCurveIds` 전체에 적용한다.
- 유사한 검체명/시약명은 경고만 표시하고 자동 병합하지 않는다.

## 그래프
- 기본 그래프는 PCR amplification line chart다.
- 사용자가 선택한 곡선만 표시한다.
- 기본 시각 스타일은 흰 배경, 정돈된 제목/축/범례, 절제된 색상, 균형 있는 선 굵기, sparse major grid 중심이다.
- 배경 minor grid처럼 촘촘한 보조선은 기본값에서 제외한다.
- 논문용 figure처럼 명확해야 하지만, 지나치게 투박하거나 오래된 통계 그래프 느낌이 나지 않도록 현대적인 여백과 타이포그래피를 사용한다.
- 참고 이미지는 스타일 방향만 의미한다. 참고 이미지의 제목, 축 라벨, 축 범위, threshold/reference line, marker 모양, 색상, 범례명, 곡선 수, 데이터 값은 하드코딩하지 않는다.
- 표시 곡선이 20개를 초과하면 경고와 `표시 줄이기` 같은 보조 액션을 제공한다.
- 20개 초과를 자동으로 숨기거나 export를 막지 않는다.
- X/Y scale은 자동, 고정, P1, P2 상태를 지원한다.
- 고정/Preset scale은 선택, 필터, grouping 전환, 스타일 변경, redraw 이후에도 유지한다.

## 스타일/범례
- 기본 그룹 규칙은 검체별 색상, 시약별 선 종류다.
- 사용자는 검체별 색상, 시약별 색상, 검체별 선 종류, 시약별 선 종류를 선택할 수 있어야 한다.
- 개별 곡선 설정은 일반 편집에서 최우선이다.
- 내장 프리셋 적용은 적용 범위의 기존 개별 스타일 필드를 덮어쓴다.
- 내장 프리셋 적용 후 영향받은 곡선 수를 표시하고, 직전 프리셋 적용 1회 되돌리기를 제공한다.
- MVP에서는 저장형 사용자 프리셋을 구현하지 않는다.
- 범례 순서와 export 순서는 현재 사용자 순서를 따른다.

## Export
- PNG와 JPEG 저장을 지원한다.
- export 배경은 흰색만 사용한다.
- 파일명은 브라우저 로컬 날짜와 analysisName 기준 `YYMMDD_<sanitizedAnalysisName>_plotN.ext`다. 예: `260709_Run_A_plot1.png`.
- 한 세션에서 export action마다 `plotN`을 증가시킨다.
- 클립보드 복사는 지원 환경에서 제공하고, 실패 시 이미지 저장 fallback을 안내한다.
- export 결과는 현재 preview의 선택, scale, 스타일, 범례 순서를 반영해야 한다.
- plotted-data CSV는 현재 표시 중인 곡선만 현재 범례/export 순서로 내보낸다.
- plotted-data CSV 파일명은 `YYMMDD_<sanitizedAnalysisName>_plotN_data.csv`다.
- 이미지와 data CSV를 함께 export하면 같은 `plotN`을 사용하고, data CSV만 단독 export하면 다음 `plotN`을 사용한다.
- 실패한 export 시도는 `plotN`을 소비하지 않는다.
- plotted-data CSV는 단일 차트, 공통 X축, 직사각형 CSV가 가능한 경우에만 활성화하고, 불가능하면 이유를 표시한다.

---

# 2. 확정 구현 아키텍처

## 기술 조합
- Frontend: React + Vite + TypeScript
- Excel parser: SheetJS/xlsx
- Chart: Apache ECharts, canvas renderer
- App state: Zustand + Immer
- Large tree rendering: `@tanstack/react-virtual`
- Unit/component test: Vitest + Testing Library
- Browser/E2E/export smoke: Playwright

선택 이유:
- GitHub Pages 배포가 쉬운 정적 SPA 구조다.
- SheetJS는 `.xlsx`와 구형 `.xls`를 브라우저에서 처리할 수 있다.
- ECharts는 다중 line chart, axis control, legend, image export API에 적합하다.
- Zustand + Immer는 선택, 접힘, scale, style override, legend order, one-step preset undo 상태를 단순하게 관리하기 좋다.
- `@tanstack/react-virtual`은 수십~수백 검체와 수천 곡선 선택 트리의 DOM 부담을 줄인다.
- Vitest/Testing Library/Playwright 조합은 parser, state, UI, export smoke를 나누어 검증하기 좋다.

## 모듈 구조
```text
src/
  app/
    App.tsx
    appStore.ts
    routes.ts
  data/
    parseExcel.ts
    normalizePcrData.ts
    similarNameWarnings.ts
    plottedDataExport.ts
    sampleData.ts
    types.ts
  selection/
    buildTrees.ts
    searchCurves.ts
    selectionState.ts
  chart/
    ChartView.tsx
    chartConfig.ts
    exportChart.ts
    exportFilenames.ts
  ui/
    DataImportPanel.tsx
    DataSelectionPanel.tsx
    ChartPanel.tsx
    SettingsPanel.tsx
    Accordion.tsx
    SegmentedControl.tsx
  tests/
    fixtures/
```

## 핵심 상태 모델
```ts
type GroupingMode = "reagent" | "specimen";

type Curve = {
  curveId: string;
  specimenId: string;
  reagentId: string;
  sourceId: string;
  specimenLabel: string;
  reagentLabel: string;
  displayLabel: string;
  x: number[];
  y: Array<number | null>;
  warnings: string[];
};

type AppState = {
  groupingMode: GroupingMode;
  selectedCurveIds: Set<string>;
  searchQuery: string;
  matchedCurveIds: Set<string>;
  collapsedGroupIds: Set<string>;
  orderedCurveIds: string[];
  axisScale: {
    x: ScaleConfig;
    y: ScaleConfig;
  };
  styleRules: StyleRules;
  curveOverrides: Record<string, CurveStyleOverride>;
  lastPresetUndo?: PresetUndoSnapshot;
  visibleCurveWarning: boolean;
  exportCounter: number;
};
```

## 성능 기준
- 수백 검체와 수천 곡선까지 선택 트리를 견딜 수 있게 설계한다.
- 실제 DOM에는 펼쳐진 visible tree만 렌더링하고, 규모가 커지면 가상 목록을 적용한다.
- 검색은 150~250ms debounce를 둔다.
- 차트에 표시되는 곡선은 사용자가 분석 가능한 수로 좁히도록 안내한다.
- 최종 성능 예산은 사용자가 별도 확정하기 전까지 Known Gaps에 유지한다.

---

# 3. 단계별 구현 계획

## Pre-Phase. 문서, 범위, Fixture 기준 동결

목표:
- 코드 작성 전에 PCR 전용 요구사항, I/O 규칙, 수용기준, fixture 목록을 확정 또는 결정 대기로 분리한다.
- `graph_TEST.xlsx`를 포함한 fixture 전략과 expected normalized JSON snapshot 형식을 만든다.

산출물:
- PCR 전용 fixture 목록
- expected normalized JSON snapshot 설계
- `docs/07_FIXTURE_SNAPSHOT_PLAN_KR.md`
- `docs/02`, `docs/03`, `docs/04`, `DECISIONS.md`, `DEVELOPMENT_STATE.md`, `CHANGELOG.md` 갱신
- 아직 확정되지 않은 결정 목록

검증:
- D010~D016이 요구사항과 수용기준에 반영되어 있다.
- CSV, 붙여넣기, 수동 입력, 앱 내 편집, sheet picker가 MVP 범위에서 제거되어 있다.
- 코딩 전 결정 대기 항목이 숨겨져 있지 않다.

구현 프롬프트:
```text
Pre-Phase를 수행하라. 아직 앱 코드는 구현하지 마라.

작업 범위:
- docs/02, docs/03, docs/04, DECISIONS.md, DEVELOPMENT_STATE.md, CHANGELOG.md, docs/06을 읽고 D010~D016이 반영되어 있는지 점검한다.
- fixture 목록을 정의한다:
  .xlsx 정상 파일, real BIFF .xls 등가 파일, old .xls Korean label 파일, graph_TEST.xlsx 기반 fixture, 1검체 x 8시약, 여러 검체 x 공통 시약, 유사 검체명/시약명, 숫자가 아닌 fluorescence 값, 빈 행/열, 첫 sheet만 사용하는 multi-sheet, 첫 sheet invalid/later sheet valid, active tab not first, 21개 이상 곡선, 큰 데이터, simple plotted-data export, non-simple plotted-data export, chart visual theme fixture.
- 각 fixture의 expected normalized output snapshot 구조를 문서화한다.
- fixture ID, planned filename, linked AC, expected warning/error code, snapshot path를 manifest로 정리한다.
- 미확정 항목은 임의로 정하지 말고 결정 대기 목록에 남긴다.

검증:
- docs/04에 AC-PCR-001부터 AC-PCR-023까지 있는지 확인한다.
- docs/07_FIXTURE_SNAPSHOT_PLAN_KR.md가 fixture manifest와 snapshot schema를 포함하는지 확인한다.
- DEVELOPMENT_STATE.md와 CHANGELOG.md를 갱신한다.
```

## Phase 0. 프로젝트 스캐폴드

목표:
- 확정 기술스택으로 GitHub Pages 배포 가능한 정적 SPA 골격을 만든다.

산출물:
- `package.json`
- React + Vite + TypeScript 앱 스캐폴드
- SheetJS, ECharts, Zustand, Immer, `@tanstack/react-virtual`, Vitest, Testing Library, Playwright 의존성
- 기본 라우트 없는 단일 화면
- 기본 테스트/빌드 명령

검증:
- `npm install`
- `npm run build`
- `npm run test`
- 로컬 dev server에서 빈 앱 실행

구현 프롬프트:
```text
현재 저장소의 문서 기준을 읽고 Phase 0을 구현하라.

작업 범위:
- 관련 FR/IO/AC/AC-PCR ID를 확인하고 구현 범위를 명시한다.
- D013의 확정 기술스택을 사용한다: React + Vite + TypeScript, SheetJS/xlsx, Apache ECharts, Zustand + Immer, @tanstack/react-virtual, Vitest + Testing Library, Playwright.
- 정적 GitHub Pages 배포가 가능한 단일 페이지 프론트엔드 스캐폴드를 만든다.
- 기본 앱 화면은 현재 목업의 3분할 구조를 반영할 수 있는 최소 레이아웃만 만든다.
- 테스트/빌드 스크립트를 추가한다.

주의:
- 백엔드, 서버 저장소, 원격 데이터 전송은 만들지 않는다.
- 목업 HTML은 참고용으로 보존하고, 앱 소스와 분리한다.
- 완료 후 DEVELOPMENT_STATE.md와 CHANGELOG.md를 갱신한다.

검증:
- 설치, 테스트, 빌드, 로컬 실행 결과를 보고하라.
```

## Phase 1. PCR 데이터 모델 및 샘플 데이터

목표:
- Excel 파싱 전에도 개발 가능한 normalized PCR data model을 만든다.
- 샘플 데이터로 `1검체 x 8시약`, 여러 검체, 유사 검체명, 20개 초과 표시 상황을 재현한다.

산출물:
- `Curve`, `Specimen`, `Reagent`, `PcrDataset` 타입
- 샘플 데이터 생성기
- `reagent -> specimen -> curve`, `specimen -> reagent -> curve` 파생 인덱스
- `curveId` 기반 선택 상태 유틸리티

검증:
- 같은 dataset에서 두 트리를 만들어도 `curveId`가 동일하게 유지된다.
- `groupingMode` 전환 시 `selectedCurveIds`가 유지된다.
- all-collapsed 초기 상태를 만들 수 있다.

구현 프롬프트:
```text
Phase 1을 구현하라.

작업 범위:
- 관련 FR/IO/AC/AC-PCR ID를 확인하고 구현 범위를 명시한다.
- PCR 전용 normalized data model을 만든다.
- curveId를 canonical identity로 사용한다.
- default tree는 reagent -> specimen -> curve, optional tree는 specimen -> reagent -> curve로 파생한다.
- 샘플 데이터는 최소 1검체 x 8시약, 여러 검체 x 공통 시약, 유사 검체명/시약명, 21개 이상 선택 가능 상황을 포함한다.
- 선택 상태는 selectedCurveIds로만 관리한다.
- import 직후 모든 대분류 그룹을 접힌 상태로 만들 수 있는 상태 유틸리티를 둔다.

테스트:
- reagent-first tree가 기본으로 만들어지는지 테스트한다.
- specimen-first tree 전환 후에도 선택 curveId가 유지되는지 테스트한다.
- all-collapsed 초기 상태와 group count가 맞는지 테스트한다.
- duplicate 또는 유사 이름 warning이 보존되는지 테스트한다.

완료 후:
- DEVELOPMENT_STATE.md, CHANGELOG.md를 갱신한다.
```

## Phase 2. Excel 업로드 및 PCR 구조 파싱

목표:
- `.xls`와 `.xlsx` 업로드를 받아 첫 번째 worksheet만 row 1 specimen, row 2 reagent, row 3+ fluorescence로 파싱한다.
- 숫자가 아닌 값, 빈 행/열, 길이 불일치, 유사 검체명/시약명을 warning으로 표시한다.

산출물:
- Excel parser
- first-sheet-only import flow
- import warning model
- ignored extra sheets notice
- `Cycle 1~N` 자동 생성

검증:
- 제공된 `graph_TEST.xlsx` 구조를 읽어 normalized dataset을 만든다.
- `.xls`와 `.xlsx` 등가 fixture가 동일한 normalized PCR curve data를 만든다.
- multi-sheet 파일은 worksheet index 0만 사용한다.
- worksheet index 0이 invalid면 이후 worksheet와 무관하게 import가 실패한다.
- 숫자가 아닌 fluorescence는 원본을 보존하고 chart y 값은 `null` 또는 warning 처리한다.
- 유사 이름은 자동 병합하지 않고 warning만 낸다.

구현 프롬프트:
```text
Phase 2를 구현하라.

작업 범위:
- 관련 FR/IO/AC/AC-PCR ID를 확인하고 구현 범위를 명시한다.
- .xls와 .xlsx 업로드를 구현한다.
- workbook.SheetNames[0]만 파싱하고 sheet selector는 구현하지 않는다.
- 여러 sheet가 있으면 첫 번째 sheet만 사용했다는 안내를 제공한다.
- 1행은 검체, 2행은 시약, 3행 이후는 fluorescence 값으로 해석한다.
- X축이 없으면 Cycle 1~N을 생성한다.
- 각 데이터 열을 하나의 개별 곡선으로 normalize한다.
- 원본 검체명/시약명과 표시명을 보존한다.
- 유사 검체명/시약명, 빈 행/열, 숫자가 아닌 값, 길이 불일치 warning을 만든다.
- formula cell은 브라우저에서 재계산하지 않는다. cached numeric value만 사용하고, 없으면 `null`과 warning으로 처리한다.
- missing Y는 chart gap으로 표시하고 plotted-data CSV에서는 blank cell로 내보낸다.
- 앱 안에서 import된 값을 편집하는 UI는 만들지 않는다.

금지:
- sheet picker를 만들지 마라.
- 유사 이름을 자동 병합하지 마라.
- smoothing, normalization, baseline correction, Ct/Cq 계산을 자동 적용하지 마라.

테스트:
- fixture와 expected normalized JSON snapshot을 먼저 추가한다.
- .xlsx 정상 fixture, .xls 등가 fixture, first-sheet-only fixture, first-sheet-invalid fixture, 숫자가 아닌 값 fixture를 테스트한다.

완료 후:
- docs/03_INPUT_OUTPUT_SPEC_EN.md와 docs/04_TEST_PLAN_ACCEPTANCE_EN.md를 필요한 만큼 갱신한다.
```

## Phase 3. 데이터 선택 패널

목표:
- 목업의 좌측 패널을 기능화한다.
- 기본은 `시약별`, 보조는 `검체별`이다.
- 모든 대분류 그룹은 import 직후 접힌 상태다.
- 검색 일괄 동작은 전체 검색 조건 대상이다.

산출물:
- grouping segmented control
- reagent-first/specimen-first tree
- all-collapsed default
- group collapse/expand
- tri-state checkbox
- search
- selected/unselected/warning filter
- large-tree virtualization 준비

검증:
- 기본 active mode가 `시약별`이다.
- import 직후 모든 major group이 접혀 있다.
- `검체별` 전환 후 선택 상태가 유지된다.
- 검색 후 전체 선택/해제가 접힌 항목과 가상 목록 밖 항목까지 포함한 `matchedCurveIds`에 적용된다.

구현 프롬프트:
```text
Phase 3을 구현하라.

작업 범위:
- 관련 FR/IO/AC/AC-PCR ID를 확인하고 구현 범위를 명시한다.
- 데이터 선택 패널을 구현한다.
- 기본 groupingMode는 reagent다.
- 사용자가 specimen 모드로 전환해도 selectedCurveIds는 유지한다.
- import 직후 모든 대분류 그룹을 접힌 상태로 표시한다.
- 대분류 접기/펼치기와 전체 대분류 접기/펼치기를 구현한다.
- 검색은 전체 dataset을 대상으로 matchedCurveIds를 계산한다.
- 검색결과 전체 선택/해제는 matchedCurveIds 전체에 적용한다.
- group checkbox는 checked, unchecked, mixed 상태를 지원한다.

접근성:
- grouping toggle은 radio group 또는 동등한 semantic control로 만든다.
- accordion/tree control은 aria-expanded를 제공한다.
- checkbox mixed 상태를 표현한다.

테스트:
- 기본 시약별 보기 테스트.
- all-collapsed import 상태 테스트.
- 보기 전환 선택 유지 테스트.
- 검색 조건 전체 일괄 선택/해제 테스트.
- 접힌 그룹 안의 항목도 검색 일괄 동작에 포함되는지 테스트.
```

## Phase 4. 차트 렌더링 및 Scale

목표:
- 선택된 곡선을 PCR amplification line chart로 렌더링한다.
- X/Y 자동, 고정, P1, P2 scale을 지원한다.
- 표시 곡선 20개 초과 시 경고를 표시하되 차트와 export는 유지한다.

산출물:
- ECharts chart preview
- reusable chart theme/config baseline
- fixed/preset scale state
- scale validation
- visible curve warning

검증:
- 필터/선택/grouping/style 변경 후에도 고정 scale이 유지된다.
- 기본 chart theme가 흰 배경, sparse major grid, 과하지 않은 색상, 읽기 쉬운 제목/축/범례를 사용한다.
- 20개 표시까지는 경고 없음, 21개부터 경고 표시.
- 21개 이상이어도 preview는 자동으로 숨겨지지 않는다.
- chart는 원본 y 값을 왜곡하지 않는다.

구현 프롬프트:
```text
Phase 4를 구현하라.

작업 범위:
- 관련 FR/IO/AC/AC-PCR ID를 확인하고 구현 범위를 명시한다.
- 선택된 curveIds를 ECharts line series로 렌더링한다.
- 기본 chart theme/config를 만든다: 흰 배경, sparse major grid, minor grid off, 읽기 쉬운 제목/축/범례, 균형 있는 line width, 구분 가능한 절제된 색상.
- 참고 이미지의 구체 요소를 고정값으로 넣지 않는다: 제목, 축 라벨, 축 범위, threshold/reference line, marker 모양, 색상, 범례명, 곡선 수, 데이터 값.
- X/Y scale mode: auto, fixed, P1, P2를 구현한다.
- fixed/preset scale은 redraw, grouping mode 변경, selection 변경, style 변경 이후에도 유지한다.
- min/max validation을 구현한다.
- 표시 곡선 수가 20개를 초과하면 경고와 필터/표시 줄이기 액션을 보여준다.
- 20개 초과를 이유로 preview나 export 가능 상태를 자동 차단하지 않는다.

금지:
- 데이터를 자동 smoothing, normalization, log scale 변환하지 마라.

테스트:
- scale validation unit test.
- selection 변경 후 fixed scale 유지 테스트.
- 20/21 visible curve warning 테스트.
- chart가 빈 데이터 또는 null y 값을 안정적으로 처리하는지 테스트.
- Playwright screenshot으로 기본 chart visual theme를 확인한다.
- export smoke에서 preview와 PNG/JPEG의 visual style이 일치하는지 확인한다.
- 코드와 screenshot을 확인해 참고 이미지의 구체 요소가 하드코딩되지 않았는지 점검한다.
```

## Phase 5. 스타일, 프리셋, 범례 순서

목표:
- 검체별 색상, 시약별 색상, 검체별 선 종류, 시약별 선 종류, 개별 곡선 override를 구현한다.
- 내장 프리셋 적용은 기존 개별 style override 필드를 덮어쓴다.
- 직전 프리셋 적용 1회 되돌리기를 제공한다.
- 범례 순서와 export 순서는 현재 사용자 순서를 따른다.

산출물:
- style rules
- curve overrides
- built-in preset apply
- affected-count feedback
- one-step preset undo
- legend ordering controls

검증:
- 프리셋 적용 후 기존 개별 override가 남아 다시 나타나지 않는다.
- affected-count feedback이 표시된다.
- undo가 직전 프리셋 적용 1회를 되돌린다.
- 사용자 범례 순서 변경이 preview에 반영된다.
- grouping mode 전환 후에도 사용자 order가 보존된다.

구현 프롬프트:
```text
Phase 5를 구현하라.

작업 범위:
- 관련 FR/IO/AC/AC-PCR ID를 확인하고 구현 범위를 명시한다.
- group style rules를 구현한다: 검체별 색상, 시약별 색상, 검체별 선 종류, 시약별 선 종류.
- 개별 곡선 override를 구현한다: 표시명, 색, 선 종류, 굵기, 표시 여부.
- MVP에서는 내장 프리셋만 구현하고 저장형 사용자 프리셋은 만들지 않는다.
- 프리셋 적용은 적용 범위의 기존 개별 style override 필드를 덮어쓴다.
- 프리셋 적용은 transaction으로 처리하고 직전 적용 1회 undo 상태를 남긴다.
- 프리셋 적용 후 영향받은 곡선 수를 표시한다.
- 범례 순서 설정을 구현한다: 시약순, 검체순, 선택순, 수동.
- preview와 export가 같은 legend/order state를 사용하도록 한다.

테스트:
- 프리셋이 override를 덮어쓰는지 테스트한다.
- affected-count feedback을 테스트한다.
- undo가 직전 프리셋 적용을 되돌리는지 테스트한다.
- 수동 범례 순서가 preview에 반영되는지 테스트한다.
- grouping mode 전환 후 order가 깨지지 않는지 테스트한다.
```

## Phase 6. PNG/JPEG 저장, 클립보드 복사, plotted-data CSV

목표:
- 현재 preview와 동일한 chart image를 PNG/JPEG로 저장한다.
- 지원 환경에서 clipboard image copy를 제공하고 실패 시 이미지 저장 fallback을 안내한다.
- 단순한 현재 chart projection에 한해 plotted-data CSV를 제공한다.

산출물:
- PNG export
- JPEG export
- white background export
- filename generator
- clipboard copy
- export error/fallback UI
- simple plotted-data CSV export

검증:
- 저장 이미지는 주변 UI 없이 chart만 포함한다.
- export 배경은 흰색이다.
- `YYMMDD_<sanitizedAnalysisName>_plotN.ext` 파일명이 생성된다.
- exported chart order가 preview legend/order와 일치한다.
- 20개 초과 warning 상태에서도 export는 가능하다.
- clipboard 실패 시 명확한 안내가 표시된다.
- simple plotted-data CSV에는 현재 표시 곡선만 현재 순서로 포함된다.
- non-simple plotted-data CSV는 비활성화되고 이유가 표시된다.

구현 프롬프트:
```text
Phase 6을 구현하라.

작업 범위:
- 관련 FR/IO/AC/AC-PCR ID를 확인하고 구현 범위를 명시한다.
- 현재 chart preview를 PNG와 JPEG로 저장한다.
- export 배경은 흰색으로 고정한다.
- filename generator를 중앙화한다: YYMMDD_<sanitizedAnalysisName>_plotN.ext, plotted-data는 YYMMDD_<sanitizedAnalysisName>_plotN_data.csv.
- 클립보드 이미지 복사를 구현한다.
- clipboard unsupported 또는 permission failure 시 이미지 저장 fallback 안내를 표시한다.
- export는 현재 selection, scale, style, legend order를 그대로 반영한다.
- 20개 초과 visible curve warning이 있는 상태에서도 export 버튼은 활성화한다.
- plotted-data CSV는 단일 차트, 공통 X축, 직사각형 CSV가 가능한 경우에만 활성화한다.
- plotted-data CSV에는 hidden/unselected/raw workbook-only data를 포함하지 않는다.

테스트:
- export button flow 테스트.
- fake date와 analysisName 기반 filename 테스트: 예, 260709_Run_A_plot1.png, 260709_Run_A_plot2.jpg, 260709_Run_A_plot3_data.csv.
- 이미지와 data CSV 동시 export 시 같은 plot 번호를 공유하는지 테스트한다.
- exported image 생성 smoke test.
- white background pixel smoke test.
- preview legend order와 export order 일치 테스트.
- >20 warning 상태에서도 export enabled 테스트.
- clipboard fallback UI 테스트.
- simple plotted-data CSV 포함 테스트.
- non-simple plotted-data CSV disabled reason 테스트.

수동 검증:
- Chrome/Edge에서 clipboard copy를 확인한다.
```

## Phase 7. 성능, 접근성, 반응형 다듬기

목표:
- 수백 검체/수천 곡선 선택 UI가 견딜 수 있도록 최적화한다.
- 키보드/스크린리더 기본 접근성을 확보한다.
- 데스크톱 중심이지만 작은 화면에서 패널 전환이 깨지지 않게 한다.

산출물:
- virtualized visible tree 또는 동등한 최적화
- keyboard interaction
- accessibility labels
- responsive panel behavior
- performance smoke fixture

검증:
- 큰 fixture에서 선택 패널 조작이 지연 없이 가능하다.
- 키보드로 주요 조작이 가능하다.
- 텍스트가 버튼/패널을 넘치지 않는다.
- desktop/mobile screenshot에서 주요 UI가 겹치지 않는다.

구현 프롬프트:
```text
Phase 7을 구현하라.

작업 범위:
- 관련 FR/IO/AC/AC-PCR ID를 확인하고 구현 범위를 명시한다.
- 대량 dataset fixture를 추가한다.
- 선택 트리에 visible flattened tree와 virtualization 또는 동등한 성능 최적화를 적용한다.
- 검색 debounce를 구현한다.
- keyboard interaction을 보강한다: 방향키 이동, 펼치기/접기, Space 선택.
- aria-expanded, aria-controls, mixed checkbox semantics를 점검한다.
- 작은 화면에서는 패널이 겹치지 않도록 tabs/drawer 또는 stacked layout을 적용한다.

테스트:
- 대량 fixture 렌더링 성능 smoke test.
- 접근성 속성 component test.
- Playwright screenshot으로 desktop/mobile 레이아웃 확인.
```

## Phase 8. 요구사항/수용기준 갱신 및 릴리스 준비

목표:
- 실제 구현된 기능을 문서와 수용 기준에 맞춘다.
- GitHub Pages 배포 가능 상태를 검증한다.

산출물:
- requirements 업데이트
- input/output spec 업데이트
- test plan 업데이트
- production build
- GitHub Pages deployment guide
- release checklist

검증:
- 전체 test suite 통과.
- production build 통과.
- 로컬 preview 또는 Pages 유사 경로에서 asset path 정상.
- 최종 Playwright screenshot 확인.

구현 프롬프트:
```text
Phase 8을 구현하라.

작업 범위:
- 관련 FR/IO/AC/AC-PCR ID를 확인하고 구현 범위를 명시한다.
- 구현된 기능과 문서의 불일치를 정리한다.
- docs/02, docs/03, docs/04, DEVELOPMENT_STATE.md, DECISIONS.md, CHANGELOG.md를 최신화한다.
- production build를 검증한다.
- GitHub Pages 배포 경로에서 asset base path가 깨지지 않게 설정한다.
- 릴리스 전 수동 테스트 체크리스트를 작성한다.
- CSV, 붙여넣기, 수동 입력, sheet picker, 앱 내 편집이 MVP 릴리스 체크리스트에 섞여 있지 않은지 확인한다.

검증:
- npm test, npm run build, 로컬 preview, Playwright smoke를 실행한다.
- 실패한 항목은 Known Gaps에 남긴다.
```

---

# 4. 사용자 결정 대기 항목

아래 항목은 아직 확정하지 않는다.

## 성능/용량
- 최대 파일 크기
- 최대 row count
- 최대 검체 수
- 최대 imported curve 수
- 한 그래프에서 권장 또는 목표로 삼을 rendered curve 수

## Scale 기본값
- P1/P2 preset은 2026-07-08 기준 앱에서 사용자가 직접 입력한다. 기본 min/max 값은 여전히 임의 지정하지 않는다.
- P1/P2 preset과 chart/style 설정을 reload 이후에도 저장할지
- X축 기본 cycle 범위가 항상 1~45인지, 파일 길이에 따라 자동인지

## 배포/저장
- GitHub Pages 형태: project page, user page, custom domain
- chart configuration JSON export/import를 구현할지
- 상태 저장 없음, session only, localStorage, downloadable project file 중 어떤 방식을 쓸지

## 향후 확장
- layout/batch arrangement가 multi-chart dashboard, batch image export, repeated chart template 중 무엇을 의미하는지
- CSV, 붙여넣기, 수동 입력을 후속 버전에 포함할지
- 저장형 사용자 프리셋을 후속 버전에 포함할지

---

# 5. 단계별 품질 게이트

각 단계 완료 조건:

1. 구현 범위가 문서 기준과 일치한다.
2. 새 동작에 대한 automated test가 있다.
3. 주요 화면은 Playwright 또는 브라우저로 확인했다.
4. 사용자 결정 대기 항목을 임의 확정하지 않았다.
5. `DEVELOPMENT_STATE.md`가 다음 작업자를 위해 충분히 최신이다.
6. `CHANGELOG.md`에 사용자 가시 변화가 기록됐다.
7. 실패한 테스트 또는 미검증 항목은 숨기지 않고 Known Gaps에 남겼다.
8. context compression 이후에도 D010~D016과 `AC-PCR-*` 기준만으로 다음 작업자가 이어갈 수 있다.

---

# 6. 전체 구현 시작 프롬프트

아래 프롬프트는 한 번의 큰 구현 요청을 시작할 때 사용한다.

```text
docs/06_IMPLEMENTATION_PLAN_KR.md를 기준으로 PCR graph web app 구현을 시작하라.

규칙:
- Phase 순서를 지켜라.
- 사용자가 아직 결정하지 않은 항목은 임의 확정하지 말고 먼저 질문하거나, 해당 단계 범위에서 안전하게 제외하라.
- 각 Phase가 끝날 때 테스트, 빌드, 브라우저/Playwright 검증, 문서 갱신을 수행하라.
- 확정 기술스택은 React + Vite + TypeScript, SheetJS/xlsx, Apache ECharts, Zustand + Immer, @tanstack/react-virtual, Vitest + Testing Library, Playwright다.
- MVP 입력은 .xls/.xlsx Excel upload only이며 첫 번째 worksheet만 사용한다.
- CSV, 붙여넣기, 수동 입력, 앱 내 데이터 편집, sheet picker는 MVP에서 제외한다.
- 기본 데이터 선택 보기는 시약별이다.
- import 직후 모든 대분류 그룹은 접힌 상태다.
- 선택은 curveId 기준이다.
- 검색 일괄 동작은 검색 조건 전체에 적용한다.
- 유사한 검체명/시약명은 경고만 표시하고 자동 병합/수정하지 않는다.
- 프리셋은 기존 개별 곡선 style override를 덮어쓰고 직전 적용 1회 undo를 제공한다.
- 범례/export 순서는 현재 사용자 순서를 따른다.
- 20개 초과 표시 곡선은 경고와 필터 보조 액션을 제공하되 preview/export를 차단하지 않는다.
- PNG/JPEG export는 흰색 배경과 YYMMDD_<sanitizedAnalysisName>_plotN.ext 파일명을 사용한다.
- plotted-data CSV는 현재 단일 차트가 공통 X축과 직사각형 CSV로 안전하게 표현될 때만 제공한다.
- 원본 fluorescence 데이터는 자동 보정/변환하지 않는다.

우선 Pre-Phase부터 진행하라.
```
