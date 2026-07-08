# 09 UX 보완 상세 구현 계획 및 단계별 프롬프트

## 목적
IsoAmplar Plot Analysis의 MVP 이후 보완 요청을 단계적으로 구현하기 위한 실행 계획이다. 이번 범위는 데이터 선택 가독성, 범례 제어, 스타일 기준/개별 override 명확화, 마커 그룹 스타일, export 확장, 성능/접근성 보강을 포함한다.

## 상태
Draft for implementation

## Last Updated
2026-07-08

## Owner
Product / Engineering / Agent

## 압축 안전 요약
- 이번 계획은 구현이 아니라 후속 구현을 위한 상세 계획과 단계별 구현 프롬프트다.
- 현재 MVP는 GitHub Pages에 배포되어 있으며, 다음 작업은 사용성 보완 중심이다.
- 핵심 위험은 `기준 스타일`과 `개별 override`의 우선순위 혼선, 범례가 plot을 가리는 문제, ECharts 기본 범례 아이콘이 실제 marker 상태와 다르게 보이는 문제다.
- 새 구현은 먼저 상태 모델과 테스트를 정리한 뒤 UI를 바꾼다.
- 최신 결정에 따라 Excel native editable chart는 제외한다. 분석 재개 목적은 `Analysis XLSX`가 담당하며, 전체 imported dataset과 설정을 저장/복원한다.
- CSV는 시트와 이미지를 담을 수 없으므로, 그래프 포함 보고용 export는 `Analysis XLSX`와 별개인 후순위 `Report/Plotted XLSX` 후보로만 다룬다.
- 여러 데이터를 동시에 비교 분석하기 위한 내부 분석 탭은 이번 R0~R13 구현 지시로 도입 확정된 범위다. 각 탭은 dataset, selection, scale, style, legend/export order를 독립적으로 가진다.
- reload 후 자동 영구 저장은 기본 제공하지 않는다. 저장/복원은 사용자가 명시적으로 export/import하는 `Analysis XLSX`로 처리한다.
- 사용자가 별도 결정해야 하는 항목은 문서 하단에 분리한다. 다만 난이도와 품질 저하가 없고 현재 목적에 명확히 적합한 항목은 구현 대상으로 둔다.

## 적용 원칙
- 구현은 Phase 순서를 지킨다.
- 각 Phase 종료 시 `npm run test`, `npm run build`, 필요한 경우 `npm run test:e2e`, Playwright 또는 브라우저 시각 검증, 문서 갱신을 수행한다.
- 기존 fluorescence 원본 데이터는 자동 보정, smoothing, normalization, baseline correction, log transform, Ct/Cq 계산을 적용하지 않는다.
- 선택, 스타일, 범례, export는 모두 `curveId`를 기준으로 동작해야 한다.
- 사용자가 보는 preview와 export 결과의 선택, 순서, scale, style은 서로 일치해야 한다.
- 범례와 스타일 UI는 다수 curve에서 분석을 돕는 방향이어야 하며, 단순히 모든 것을 노출해 복잡도를 높이면 안 된다.
- `선택됨`, `차트에 표시됨`, `범례가 표시됨`, `export에 포함됨`은 서로 다른 의미다. 구현 중 이 상태를 하나의 boolean으로 섞지 않는다.
- ECharts 내부 legend toggle에 의존해 series 표시 상태를 암묵적으로 바꾸지 않는다. preview, legend, export, data export는 앱의 controlled projection을 기준으로 한다.

---

## 사용자 흐름 요약
- 분석 재개 흐름: 원본 Excel 열기 -> 검체/시약 선택과 스타일/scale/범례 설정 -> Analysis XLSX 저장 -> 나중에 Analysis XLSX를 다시 열어 전체 dataset과 설정을 복원하고 이어서 분석한다.
- 다중 분석 흐름: 새 분석 탭 열기 -> 다른 원본 Excel 또는 Analysis XLSX를 열기 -> 탭 제목과 분석 이름으로 구분 -> 탭 전환으로 서로 다른 분석 상태를 비교한다.
- 보고 파일 흐름: 현재 plot image와 현재 plotted data를 Excel 보고서처럼 묶는 기능은 Analysis XLSX와 목적이 다르며, 이번 계획에서는 후순위로 둔다.

---

# 1. 우선순위별 구현 범위

## P0: 즉시 보완 대상
- 단일 curve만 가진 선택 트리에서 의미 없는 중복 체크박스 제거.
- 범례 표시 ON/OFF.
- preview 범례를 plot 내부가 아니라 plot 밖 또는 별도 영역으로 배치.
- export 시 범례 포함 여부 제어.
- 선택 상태와 차트 표시 상태, 범례 표시 상태, export layout 상태를 분리.
- 스타일 기준 표시: 색상 기준, 선 기준, 마커 기준.
- 개별 curve style row에 curve label 고정 표시.
- 개별 override 상태 표시: `기준값`, `Custom`, `Preset`.
- 개별 override 초기화: row별, 선택 curve 전체, 전체 override.
- 검체/시약 그룹 스타일에 marker 옵션 추가.
- 개별 스타일의 컬럼 라벨 명확화: 범례명, 색상, 선, 마커, 상태, 초기화.
- 범례 order 변경 시 style override가 `curveId` 기준으로 유지되는지 테스트로 보장.

## P1: 권장 보완 대상
- ECharts 기본 범례 대신 앱 전용 custom legend 도입.
- custom legend에서 실선/점선/도트와 marker 없음/원형/세모/네모를 실제 스타일과 일치하게 표시.
- `Plot only`, `Plot + Legend`, `Legend only` export 모드.
- 많은 curve의 style 목록과 legend 목록에 검색/가상 스크롤 적용.
- tooltip 대신 또는 병행하여 우측 고정 hover readout 제공.
- 20개 초과 curve에서 `선택 줄이기`, `현재 검색만 보기`, `선택 해제`, `스타일 구분 보강` 같은 보조 액션 제공.

## P2: 분석 재개/다중 분석 대상
- 내부 분석 탭: 새 분석, 탭 전환, 탭 제목/분석 이름 수정, 탭별 독립 상태.
- `Analysis XLSX` export/import: 전체 imported dataset, 선택하지 않은 curve를 포함한 모든 normalized data, 분석 설정, style/scale/legend/export order, source metadata, warnings를 저장한다.
- `Analysis XLSX`는 Excel에서 편집 가능한 chart 파일이 아니라 웹앱 분석 재개용 project/session file이다.
- 저장된 설정은 hidden restore JSON을 authoritative source로 삼고, visible worksheet는 사용자 검토용으로 제공한다.
- `파일 선택`과 `추가 선택`은 원본 Excel과 Analysis XLSX를 구분해 동작한다. 세부 routing은 아래 Phase R4와 사용자 결정 대기 항목을 따른다.

## P3: 후순위/조건부 도입 대상
- `Report/Plotted XLSX` export: 현재 plotted rectangular data와 현재 plot static PNG 이미지를 하나의 보고용 `.xlsx`에 담는 후보 기능.
- 이 기능은 분석 재개용 `Analysis XLSX`와 목적이 다르며, 이번 개선 배치의 핵심 목표가 아니다.
- Excel에서 편집 가능한 native chart는 제외한다. 안정화 후 별도 요구가 생기면 새 기술 검토 대상으로만 다룬다.
- 구현 중 라이브러리 라이선스, 번들 크기, 브라우저 메모리, Excel/LibreOffice 호환성, 이미지 삽입 품질이 문제가 되면 제외하고 문서화한다.

---

# 2. 설계 방향

## 선택 트리
현재 1차 그룹, 2차 그룹, curve row가 모두 체크박스를 가질 수 있어 단일 curve 그룹에서 중복 선택처럼 보인다. 개선 방향은 다음과 같다.

- 2차 그룹에 curve가 1개뿐이면 `2차 그룹 row`와 `curve row`를 합친다.
- 합쳐진 row는 하나의 checkbox만 가진다.
- 2차 그룹에 curve가 2개 이상이면 기존처럼 subgroup row와 하위 curve row를 표시한다.
- group checkbox는 선택 편의 기능이고, 실제 선택 identity는 계속 `curveId`다.
- count badge는 `0/1`, `1/1`보다 `선택 0/1`처럼 의미가 명확한 표현을 우선한다.
- 렌더링 모델은 가능하면 flat row projection으로 만든다. major group 단위 virtualization만 유지하면 한 major group 내부가 매우 커졌을 때 렌더링 부담이 남는다.
- 펼침 버튼과 선택 checkbox의 hit area를 분리해 "펼침"과 "선택" 의미가 섞이지 않게 한다.

## 스타일 계층
현재 구조는 개별 override가 그룹 기준보다 우선한다. 이 자체는 맞지만 UI가 이를 설명하지 못해 혼선이 발생한다.

개선 후 구조:

```text
Style Rule
  colorBy: reagent | specimen
  lineTypeBy: reagent | specimen
  markerBy: reagent | specimen

Group Style
  specimenStyles: color, lineType, markerType
  reagentStyles: color, lineType, markerType

Individual Overrides
  displayName?
  color?
  lineType?
  markerType?
  lineWidth?
```

해석 규칙:

```text
resolved field = individual override field
              -> active group style field
              -> stable default
```

UI 규칙:
- 기준에서 온 값은 `기준값`으로 표시한다.
- 사용자가 직접 개별 수정한 값은 `Custom`으로 표시한다.
- 프리셋으로 생성된 개별 override는 `Preset`으로 표시한다.
- 사용자가 기준을 변경했는데 특정 curve가 따라오지 않는 경우, 해당 curve가 override 상태임을 명확히 보여준다.
- 프리셋은 기존 정책대로 affected curve의 개별 style field를 덮어쓰되, 적용 후 상태가 `Preset`으로 보이게 한다.
- reset 범위는 최소 `field reset`, `curve reset`, `selected curves reset`, `all overrides reset`을 구분한다. 그룹 스타일 초기화는 별도 버튼으로 분리한다.
- hover 강조나 임시 focus는 export 상태나 saved override를 오염시키지 않는 transient UI state로 처리한다.

## 중앙 Projection
선택, style, legend, export, data export가 서로 다른 계산을 하면 순서와 표시명이 쉽게 어긋난다. 후속 구현은 중앙 projection builder를 둔다.

```text
ChartProjection
  visibleCurves
  orderedCurveIds
  resolvedCurveStyles
  legendItems
  dataHeaders
  scaleIssues
```

요구사항:
- preview chart, custom legend, PNG/JPEG export, plotted CSV, Analysis XLSX의 chart-facing settings, 후순위 Report/Plotted XLSX가 같은 projection 계약을 사용한다.
- label, order, color, line type, marker type은 projection 한 곳에서 확정한다.
- chart hover/readout은 projection을 읽기만 하며 export state를 바꾸지 않는다.

## 범례
ECharts 기본 legend는 실제 curve marker가 `none`이어도 원형 심볼을 보일 수 있고, item 크기가 작아 실선/점선/도트 구분이 약하다. 따라서 앱 전용 custom legend를 도입한다.

권장 구조:
- ECharts 내장 legend는 기본적으로 끈다.
- chart option에는 plot만 렌더링한다.
- 앱이 `LegendItem[]` projection을 만들고 preview에서 custom legend를 렌더링한다.
- legend item은 `curveId`, display name, color, line type, marker type, order를 가진다.
- custom legend 샘플은 충분히 긴 선으로 그려 실선/점선/도트 구분이 가능해야 한다.
- marker가 `none`이면 legend 샘플에도 marker를 그리지 않는다.

Export 구조:
- `Plot only`: chart image만 export.
- `Plot + Legend`: chart image와 custom legend canvas를 합성하여 export.
- `Legend only`: custom legend canvas만 export.
- plotted CSV와 후순위 Report XLSX data export는 현재 legend/export order를 따른다.
- Analysis XLSX는 전체 imported dataset을 저장하되, 현재 legend/export order도 설정으로 함께 저장한다.
- `CurveStyleOverride.visible` 같은 기존 필드를 범례 표시 상태로 재사용하지 않는다. 필요하면 `hiddenCurveIds` 또는 `chartVisibleCurveIds`처럼 의미가 분명한 상태를 별도로 둔다.

## 내부 분석 탭
여러 파일 또는 여러 분석 방향을 동시에 비교할 때 브라우저 창을 여러 개 여는 대신 앱 내부 탭을 사용한다. 각 탭은 하나의 독립된 분석 단위다.

상태 구조 초안:

```ts
type WorkspaceState = {
  activeAnalysisId: string | null;
  analysisOrder: string[];
  analyses: Record<string, AnalysisState>;
};

type AnalysisState = {
  analysisId: string;
  analysisName: string;
  dataset: PcrDataset;
  selection: SelectionState;
  searchQuery: string;
  selectionFilter: SelectionFilter;
  chartScale: ChartScaleState;
  styleRules: StyleRules;
  curveOverrides: Record<string, CurveStyleOverride>;
  exportCounter: number;
  importFileName: string | null;
  sourceFiles: SourceFileSummary[];
  dirty: boolean;
};
```

Analysis XLSX serialized payload:
- omits runtime tab identity (`analysisId`) and dirty state.
- restore assigns a tab-local analysis ID and starts with `dirty = false`.
- transient progress, tooltip, clipboard, hover, and one-step preset undo state are excluded.

탭 규칙:
- 탭 제목은 `analysisName`을 사용한다.
- 기본 analysisName은 첫 source file 이름 또는 Analysis XLSX에 저장된 이름을 사용한다.
- analysisName, chartTitle, sourceFileName은 서로 다른 개념으로 분리한다.
- selection, collapsed groups, scale, P1/P2, style, legend/export order, exportCounter는 탭별로 독립적이다.
- 앱 reload 후 자동 복구를 위한 localStorage 저장은 기본 제공하지 않는다.
- 저장되지 않은 변경 여부는 `dirty`로 추적하되, 닫기/교체 확인 UI의 정확한 방식은 사용자 결정 대기 항목으로 둔다.

## Analysis XLSX
Analysis XLSX는 Excel 보고서가 아니라 웹앱 분석 재개용 project/session file이다. 목적은 방대한 데이터를 나중에 다시 열어 같은 상태에서 분석을 이어가는 것이다.

권장 worksheet 구조:

```text
README
  - IsoAmplar analysis restore file 설명
Settings
  - analysisName, export date, app version, selected count, scale/style/legend summary
ImportedData
  - 선택 여부와 무관한 전체 normalized imported dataset
Warnings
  - import warnings
_IsoAmplarAnalysis
  - hidden worksheet, schemaVersion과 full restore JSON chunks
_IsoAmplarChecksum
  - optional hidden checksum/sanity marker
```

저장 대상:
- 전체 imported dataset. 선택하지 않아 chart에 표시하지 않은 curve도 반드시 포함한다.
- selectedCurveIds, groupingMode, collapsedGroupIds, orderedCurveIds.
- chartScale, P1/P2 values, styleRules, curveOverrides.
- legend/export settings, export layout, show/hide legend preference.
- analysisName, source metadata, sourceFiles, warnings, exportCounter.

저장하지 않는 transient 대상:
- importStatus, importError, exportMessage.
- hover/readout focus, clipboard result, tooltip state.
- lastPresetUndo. Analysis XLSX 재개 후 undo stack은 복원하지 않는다.

직렬화 규칙:
- `Set`은 array로 저장하고 restore 시 다시 Set으로 복원한다.
- hidden JSON sheet를 authoritative restore source로 사용한다.
- visible ImportedData sheet는 검토용이다. Excel에서 사용자가 visible sheet를 수정한 내용을 앱이 자동 해석한다고 약속하지 않는다.
- schemaVersion이 맞지 않거나 필수 restore block이 없으면 명확한 오류를 표시하고 일반 Excel import로 오해하지 않게 한다.

파일 선택 routing 초안:
- `파일 선택` + 원본 Excel: 현재 active analysis를 교체한다.
- `추가 선택` + 원본 Excel: 현재 active analysis에 append한다.
- `파일 선택` + Analysis XLSX: 저장된 analysis를 active tab에 restore한다. active tab이 dirty이고 dirty 정책이 미확정이면 restore를 진행하지 않고 사용자 결정 필요 안내를 표시한다.
- `추가 선택` + Analysis XLSX: 현재 analysis에 병합하지 않고 새 내부 tab으로 연다.

## Report/Plotted XLSX
CSV는 단일 텍스트 표이므로 그래프를 다른 시트에 넣을 수 없다. 다만 사용자가 “현재 그림과 현재 plotted data를 한 파일에 담는 보고서”를 다시 요청하면 다음 후순위 기능으로 해석한다.

```text
YYMMDD_plotN.xlsx
  Data worksheet: currently plotted rectangular data
  Chart worksheet: static PNG image of current plot
```

제외/보류 조건:
- Excel에서 편집 가능한 native chart는 제외한다.
- Analysis XLSX가 분석 재개 요구를 충족하므로 Report/Plotted XLSX는 이번 핵심 개선 배치에서 구현하지 않는다.
- 나중에 구현한다면 현재 `createPlottedDataCsv`를 공통 projection builder로 분리하고, Data sheet와 static PNG image sheet를 같은 projection에서 생성한다.
- XLSX 이미지 삽입은 SheetJS CE만으로는 적합하지 않으므로 별도 라이브러리 검토가 필요하다.

---

# 3. 단계별 구현 계획

## Phase R0. 문서/테스트 기준 갱신

목표:
- 이번 보완 범위를 요구사항, 수용기준, 상태 문서에 반영한다.
- 구현 전에 실패해야 할 테스트 목록을 먼저 정의한다.

주요 작업:
- `docs/02_FUNCTIONAL_REQUIREMENTS_EN.md`에 internal analysis tabs, Analysis XLSX export/import, legend visibility/export, custom legend, style hierarchy, marker group rule, Report/Plotted XLSX 보류 정책을 추가한다.
- `docs/03_INPUT_OUTPUT_SPEC_EN.md`에 Analysis XLSX restore file 형식, custom legend export, Report/Plotted XLSX 후순위 산출물 형식을 추가한다.
- `docs/04_TEST_PLAN_ACCEPTANCE_EN.md`에 `AC-PCR-026` 이후 신규 수용기준을 추가한다.
- `DECISIONS.md`에 다음 결정을 분리해 기록 또는 확인한다.
  - custom legend는 ECharts legend 대신 앱 projection 기반으로 관리한다.
  - style override는 `curveId` 단위 field override이며, UI에서 origin을 표시한다.
  - D026은 확정 결정으로 유지한다: Analysis XLSX는 전체 imported dataset과 설정을 저장/복원하는 project/session file, native editable Excel chart 제외, reload 후 자동 localStorage 저장 없음.
  - D027은 이번 R0~R13 구현 지시를 근거로 `Accepted`로 승격한다.
- selection, chart visibility, legend visibility, export inclusion/export layout의 상태 의미를 분리해 기록한다.
- 범례 기본값은 implementation default로 기록한다. 권장값은 `preview legend on, outside plot`, `image export include legend on`, `plot only/legend only 선택 가능`이다.
- 성능 기준은 확정 수치가 아니며, smoke target으로 `100 visible curves x 100 points`와 `hundreds~1000 imported curves x 100 points with virtualized selection`을 기록한다.
- `DEVELOPMENT_STATE.md`, `CHANGELOG.md`를 갱신한다.

검증:
- 문서 간 요구사항/수용기준 ID가 서로 연결된다.
- 사용자 결정 대기 항목이 하단에 분리된다.
- 아직 구현하지 않은 기능은 구현 완료처럼 쓰지 않는다.

구현 프롬프트:
```text
docs/09_UX_REFINEMENT_IMPLEMENTATION_PLAN_KR.md의 Phase R0을 수행하라.

규칙:
- 기능 구현은 하지 말고 문서와 테스트 계획만 갱신하라.
- internal analysis tabs, Analysis XLSX export/import, legend visibility/export, custom legend, style hierarchy, marker group rule, Report/Plotted XLSX 보류 정책을 요구사항과 수용기준에 추가하라.
- AC-PCR-026 이후 번호로 신규 acceptance criteria를 작성하라.
- DECISIONS.md에는 확정/조건부/사용자 결정 대기 항목을 분리하라.
- native editable Excel chart 제외, 전체 imported dataset + 설정 포함 Analysis XLSX, no localStorage persistence 기본값, clinical interpretation 제외를 최신 결정으로 기록하라.
- 내부 분석 탭은 D027 `Accepted`로 기록하되, dirty close/replace UX와 tab hard cap은 사용자 결정 대기 항목으로 남겨라.
- DEVELOPMENT_STATE.md와 CHANGELOG.md를 갱신하라.
- 아직 구현되지 않은 기능을 완료된 것처럼 쓰지 말라.

검증:
- 문서 내 신규 requirement와 acceptance criteria가 상호 참조되는지 확인하라.
- git diff를 검토해 문서 변경만 포함되는지 확인하라.
```

## Phase R1. AnalysisState 직렬화/복원 기반

목표:
- 현재 단일 분석 상태를 직렬화 가능한 `AnalysisState`로 정리하고, Analysis XLSX와 내부 탭이 같은 상태 계약을 쓰게 한다.

주요 작업:
- 현재 store의 dataset, selection, searchQuery, selectionFilter, chartScale, styleRules, curveOverrides, exportCounter, source metadata를 하나의 `AnalysisState` 타입으로 분리한다.
- `Set`, `Map` 또는 class instance처럼 JSON 직렬화가 불안정한 값은 명시적 serialize/deserialize helper를 둔다.
- `schemaVersion`을 정의한다.
- 저장 대상과 transient 제외 대상을 코드 주석이 아니라 타입/함수 경계에서 분리한다.
- restore 후 chart projection, selection tree, style resolution, export filename counter가 기존 상태와 일치해야 한다.
- `lastPresetUndo`, hover, clipboard result, import/export status는 복원 대상에서 제외한다.

검증:
- AnalysisState roundtrip 후 selected curve, group collapse, scale, style, legend order, exportCounter가 유지된다.
- transient state는 roundtrip에 포함되지 않는다.
- 오래되었거나 누락된 schemaVersion은 명확한 오류로 처리된다.

구현 프롬프트:
```text
Phase R1을 구현하라.

작업 범위:
- src/data/types.ts 또는 새 src/analysis/analysisState.ts에 AnalysisState와 직렬화 타입을 정의하라.
- 현재 appStore에서 탭별로 보존해야 할 상태를 AnalysisState로 추출할 수 있는 helper를 작성하라.
- serializeAnalysisState, deserializeAnalysisState, validateAnalysisState를 추가하라.
- Set 계열 상태는 array로 저장하고 restore 시 Set으로 복원하라.
- hidden Analysis XLSX JSON에 들어갈 schemaVersion을 정의하라.
- importStatus, importError, exportMessage, hover/readout, clipboard result, lastPresetUndo는 저장하지 말라.

테스트:
- AnalysisState JSON roundtrip unit test를 추가하라.
- selectedCurveIds, collapsedGroupIds, orderedCurveIds, chartScale, styleRules, curveOverrides, exportCounter가 보존되는지 테스트하라.
- transient fields가 저장 payload에 없는지 테스트하라.
- invalid schemaVersion과 필수 필드 누락 오류 테스트를 추가하라.
- npm run test와 npm run build를 실행하라.

문서:
- DECISIONS.md, CHANGELOG.md, DEVELOPMENT_STATE.md를 갱신하라.
```

## Phase R2. 내부 분석 탭 상태 모델

목표:
- 단일 분석 store를 `WorkspaceState` + `AnalysisState` 구조로 확장하고, 탭별 상태가 서로 오염되지 않게 한다.
- D027은 이번 구현 지시로 확정되었으므로 이 Phase를 순서대로 실행한다.

주요 작업:
- `activeAnalysisId`, `analysisOrder`, `analyses`를 store에 추가한다.
- 기존 selectors/actions는 active analysis를 대상으로 동작하도록 adapter를 둔다.
- 새 분석 생성, active tab 전환, analysisName 변경, dirty flag 갱신, tab close의 상태 동작을 추가한다.
- 기존 import/append/chart/style/export 동작은 active analysis에만 적용되어야 한다.
- 탭 상태 refactor 중 기능 UI를 크게 바꾸지 않는다.

검증:
- 두 탭의 selection, scale, style, legend/export order, exportCounter가 독립적으로 유지된다.
- 탭 전환 후 chart와 settings가 active analysis만 반영한다.
- 기존 단일 분석 E2E가 깨지지 않는다.

구현 프롬프트:
```text
Phase R2를 구현하라.

작업 범위:
- src/app/appStore.ts를 WorkspaceState 구조로 확장하라.
- 기존 UI 컴포넌트가 active analysis를 읽도록 selectors 또는 adapter를 제공하라.
- createAnalysis, switchAnalysis, renameAnalysis, closeAnalysis, markAnalysisDirty를 추가하라.
- import, append, selection, scale, style, legend order, export actions가 active analysis에만 작동하게 하라.
- 처음 앱을 열었을 때 빈 active analysis 또는 upload-first 상태가 기존과 동일하게 보이도록 하라.
- localStorage 자동 저장은 구현하지 말라.

테스트:
- 두 analysis를 만들고 서로 다른 dataset, searchQuery, selectionFilter, collapsedGroupIds, selection, fixed/P1/P2 scale, style, legend/export order, exportCounter를 설정한 뒤 전환해도 상태가 독립적인지 테스트하라.
- 탭 A에 append import를 수행해도 탭 B의 dataset과 sourceFiles가 변하지 않는지 테스트하라.
- Analysis XLSX import/new-tab routing이 다른 탭 상태를 오염시키지 않는지 테스트하라.
- 기존 upload/select/chart/export unit/component 테스트가 active analysis 구조에서도 통과하는지 확인하라.
- npm run test, npm run build, npm run test:e2e를 실행하라.

문서:
- CHANGELOG.md와 DEVELOPMENT_STATE.md를 갱신하라.
```

## Phase R3. 분석 탭 UI와 분석 이름

목표:
- 여러 분석을 앱 안에서 탭으로 열고, 사용자가 분석 이름을 구분할 수 있게 한다.
- D027은 이번 구현 지시로 확정되었으므로 이 Phase를 순서대로 실행한다.

주요 작업:
- 상단에 analysis tab bar를 추가한다.
- 탭 제목은 `analysisName`을 사용한다.
- analysisName 편집 UI를 제공한다.
- 기본 analysisName은 첫 source file name 또는 Analysis XLSX의 saved analysisName을 사용한다.
- dirty 상태 표시를 추가하되, 닫기/교체 확인의 exact UX는 사용자 결정 대기 항목을 따른다.
- 탭 수가 많아질 경우 가로 스크롤 또는 메뉴형 overflow를 제공한다.

검증:
- 새 탭 생성, 이름 변경, 탭 전환, 닫기가 동작한다.
- 이름 변경이 chart title/source file name을 암묵적으로 바꾸지 않는다.
- 탭이 많아도 주요 import/selection/chart controls가 밀려 깨지지 않는다.

구현 프롬프트:
```text
Phase R3을 구현하라.

작업 범위:
- src/app/App.tsx 또는 새 AnalysisTabs 컴포넌트에 tab bar를 추가하라.
- 탭 제목은 analysisName을 사용하고 inline rename 또는 명확한 edit action을 제공하라.
- 새 분석 탭 생성 버튼을 추가하라.
- dirty indicator를 표시하라. dirty close/replace 정책은 구현 전 사용자 확인이 필요하다. 확인 전에는 데이터 손실 가능성이 있는 닫기/교체 동작을 차단하고 안내만 제공하라.
- mobile/좁은 화면에서는 탭이 레이아웃을 깨지 않도록 horizontal scroll 또는 overflow menu를 적용하라.

테스트:
- tab 생성/전환/rename component test를 추가하라.
- analysisName과 source file name/chart label이 분리되는지 테스트하라.
- Playwright screenshot으로 desktop/mobile 탭 레이아웃을 확인하라.
- npm run test, npm run build, 필요 시 npm run test:e2e를 실행하라.

문서:
- CHANGELOG.md와 DEVELOPMENT_STATE.md를 갱신하라.
```

## Phase R4. Analysis XLSX Export/Import

목표:
- 전체 imported dataset과 설정을 포함한 Analysis XLSX를 저장하고, 다시 import해 분석을 이어갈 수 있게 한다.

주요 작업:
- `README`, `Settings`, `ImportedData`, `Warnings`, hidden `_IsoAmplarAnalysis`, optional `_IsoAmplarChecksum` worksheet를 생성한다.
- hidden JSON은 chunking을 지원해 큰 분석 상태도 안전하게 저장한다.
- Analysis XLSX import 시 hidden restore sheet를 우선 탐지한다.
- 일반 원본 Excel과 Analysis XLSX를 구분해 file action routing을 적용한다.
- Analysis XLSX export filename은 analysisName 기반 또는 `YYMMDD_analysisN.xlsx` 같은 안전한 규칙을 쓰되, 충돌/불법문자는 sanitize한다.
- visible `ImportedData` sheet는 검토용이며, Excel에서 수정한 visible sheet를 자동 복원 근거로 삼지 않는다.

검증:
- Analysis XLSX export 후 재import하면 전체 dataset, selected state, order, scale, style, legend/export settings가 복원된다.
- 선택하지 않은 curve도 복원된다.
- 원본 Excel append와 Analysis XLSX open/new-tab 동작이 섞이지 않는다.
- corrupted/unsupported Analysis XLSX는 명확한 오류를 표시한다.

구현 프롬프트:
```text
Phase R4를 구현하라.

작업 범위:
- SheetJS/xlsx를 사용해 Analysis XLSX workbook을 생성하라. 이미지 삽입이나 native chart는 구현하지 말라.
- README, Settings, ImportedData, Warnings, hidden _IsoAmplarAnalysis, optional _IsoAmplarChecksum sheets를 생성하라.
- _IsoAmplarAnalysis에는 schemaVersion과 serialized AnalysisState를 JSON chunk로 저장하라.
- ImportedData에는 선택 여부와 무관한 전체 normalized imported dataset을 포함하라.
- Analysis XLSX import는 hidden restore sheet를 authoritative source로 사용하라.
- `파일 선택` + 원본 Excel은 active analysis replace, `추가 선택` + 원본 Excel은 append, `파일 선택` + Analysis XLSX는 active tab restore, `추가 선택` + Analysis XLSX는 new tab open으로 동작하게 하라. 단 dirty active tab의 replace/restore 정책이 확정되지 않았으면 데이터 손실 가능성이 있는 동작은 차단하고 사용자 확인 필요 메시지를 표시하라.
- native editable Excel chart와 chart image insertion은 구현하지 말라.

테스트:
- exported Analysis XLSX를 다시 읽어 hidden restore sheet와 visible sheets 존재를 검증하라.
- export -> import roundtrip으로 전체 dataset, analysisName, source metadata/sourceFiles, warnings, selectedCurveIds, groupingMode, collapsedGroupIds, orderedCurveIds, chartScale, P1/P2, styleRules, curveOverrides, exportCounter, legend/export layout이 복원되는지 테스트하라.
- unselected curves가 restore 후 dataset에 남아 있는지 테스트하라.
- 원본 Excel과 Analysis XLSX detection/routing 테스트를 추가하라.
- invalid hidden restore sheet, chunk 누락/손상, schemaVersion mismatch 오류 테스트를 추가하라.
- npm run test, npm run build, npm run test:e2e를 실행하라.

문서:
- docs/03_INPUT_OUTPUT_SPEC_EN.md, docs/04_TEST_PLAN_ACCEPTANCE_EN.md, DECISIONS.md, CHANGELOG.md, DEVELOPMENT_STATE.md를 갱신하라.
```

## Phase R5. 선택 트리 중복 체크박스 제거

목표:
- 단일 curve subgroup에서 중복 체크박스를 제거해 선택 UI의 복잡도를 낮춘다.

주요 작업:
- selection tree view model에 `singleCurveSubgroup` 또는 equivalent row type을 추가한다.
- 가능하면 tree를 화면 row 단위 flat projection으로 만들고, virtualization을 row projection 기준으로 적용한다.
- 2차 그룹에 curve가 1개이면 subgroup row와 curve row를 합쳐 한 줄로 표시한다.
- curve가 2개 이상이면 기존 subgroup + curve rows를 유지한다.
- virtualized tree 높이 계산을 새 row 구조에 맞춘다.
- checkbox 동작은 계속 `curveId` 선택으로 연결한다.

검증:
- 단일 curve subgroup은 checkbox가 하나만 표시된다.
- multi-curve subgroup은 group checkbox와 child checkbox가 의도대로 표시된다.
- reagent/specimen view 전환 후 selection이 보존된다.
- 검색 bulk action이 합쳐진 row와 접힌 row 모두에 적용된다.

구현 프롬프트:
```text
Phase R5를 구현하라.

작업 범위:
- src/selection/buildTrees.ts와 src/ui/DataSelectionPanel.tsx의 tree row 구조를 검토하라.
- major group 중심 구조가 내부 대량 row에서 성능 한계를 만들지 않도록 flat row projection을 우선 검토하라.
- 2차 subgroup에 curve가 1개뿐이면 subgroup label과 curve label을 한 row에 표시하고 checkbox는 하나만 둬라.
- 다중 curve subgroup은 기존 계층을 유지하라.
- virtualized height estimation과 non-test plain rendering 모두 동일하게 수정하라.
- 선택 identity는 반드시 curveId 기준을 유지하라.
- 펼침 toggle과 선택 checkbox의 클릭 영역을 분리하라.

테스트:
- 단일 subgroup checkbox가 중복 표시되지 않는 component test를 추가하라.
- 다중 subgroup은 기존 tri-state behavior가 유지되는지 테스트하라.
- search bulk select/unselect가 single-row subgroup에도 적용되는지 테스트하라.
- npm run test, npm run build, npm run test:e2e를 실행하라.

문서:
- CHANGELOG.md와 DEVELOPMENT_STATE.md를 갱신하라.
```

## Phase R6. 스타일 상태 모델 정리 및 마커 그룹 스타일 추가

목표:
- 색상/선/마커 기준을 일관되게 관리하고, 개별 override와 기준값의 관계를 명확히 한다.

주요 작업:
- `StyleRules`에 `markerBy`, `specimenMarkerTypes`, `reagentMarkerTypes`를 추가한다.
- `resolveCurveStyle`이 color, lineType, markerType origin을 함께 반환하도록 확장한다.
- override metadata를 추가한다.
  - 최소안: override field 존재 여부로 `Custom` 판단.
  - 권장안: preset 적용 필드에는 `source: "preset"` metadata를 기록.
- 프리셋 적용/undo가 새 marker group rule과 충돌하지 않게 정리한다.
- append import 후 preset undo 상태가 혼선을 만들지 않도록 정책을 정한다.
  - 권장: append 성공 시 `lastPresetUndo`는 clear하고 안내 message를 남긴다.
- chart projection builder를 도입하거나 기존 `buildPcrChartOption` 주변에 공통 projection 계층을 만든다.
- selection, chart visibility, legend visibility, export layout state를 분리한다. 단, "곡선 표시/숨김" 기능은 이번 Phase에서 UI로 노출하지 않아도 된다.

검증:
- 기준 스타일 변경 시 override가 없는 curve는 즉시 따라온다.
- override가 있는 curve는 따라오지 않고 `Custom` 또는 `Preset` 상태로 표시된다.
- row별 reset 후 다시 기준 스타일을 따른다.
- 프리셋 undo는 직전 preset 적용만 되돌린다.

구현 프롬프트:
```text
Phase R6을 구현하라.

작업 범위:
- src/data/types.ts의 StyleRules를 확장해 markerBy와 specimen/reagent marker rules를 추가하라.
- src/chart/chartStyle.ts의 createDefaultStyleRules, resolveCurveStyle, createPresetOverrides를 새 모델에 맞춰 수정하라.
- style resolution 결과가 각 field의 origin을 알 수 있게 하라.
- preview/export/data export가 공유할 central projection builder를 추가하라.
- src/app/appStore.ts에 setGroupMarkerType, resetCurveOverride, resetSelectedCurveOverrides, resetAllCurveOverrides를 추가하라.
- appendFile 성공 시 lastPresetUndo 처리 정책을 명확히 하라. 권장: undo snapshot을 clear하고 메시지로 안내.
- 기존 preset overwrite/one-step undo 정책은 유지하라.
- CurveStyleOverride.visible을 범례 표시 또는 export 포함 의미로 재사용하지 말라.

테스트:
- group marker rule이 chart series marker로 반영되는 unit test를 추가하라.
- override 없는 curve는 기준 변경을 따라가고, override 있는 curve는 유지되는 테스트를 추가하라.
- reset override 후 기준값으로 돌아오는 테스트를 추가하라.
- preset apply/undo와 markerBy가 충돌하지 않는 테스트를 추가하라.
- npm run test와 npm run build를 실행하라.

문서:
- DECISIONS.md, CHANGELOG.md, DEVELOPMENT_STATE.md를 갱신하라.
```

## Phase R7. 스타일 UI 재구성

목표:
- 사용자가 현재 기준과 개별 수정 상태를 한눈에 이해하도록 Style 패널을 재구성한다.

주요 작업:
- Style accordion 상단에 `현재 기준` 요약을 표시한다.
- 기준 선택을 `색상 기준`, `선 기준`, `마커 기준` 3개로 확장한다.
- 검체/시약 group style table에 컬럼 라벨을 명확히 표시한다.
- group style row에 color picker, HEX input, line type, marker type을 제공한다.
- individual style row에 curve label, legend name, color, HEX, line, marker, status, reset을 제공한다.
- individual list는 선택 curve가 많을 때 검색/가상 스크롤을 적용한다.
- 상태 배지를 제공한다: `기준값`, `Custom`, `Preset`.

검증:
- 사용자는 개별 row가 어떤 curve인지 즉시 알 수 있다.
- `없음`이 marker 없음을 의미한다는 점이 컬럼 라벨로 명확하다.
- 선택 curve가 30개 이상이어도 UI가 깨지지 않는다.
- 기준 변경과 개별 reset 동작이 화면 상태와 일치한다.

구현 프롬프트:
```text
Phase R7을 구현하라.

작업 범위:
- src/ui/SettingsPanel.tsx의 Style accordion을 재구성하라.
- Style 상단에 현재 기준 요약을 표시하라: 색상 기준, 선 기준, 마커 기준.
- 기준 선택 UI를 colorBy, lineTypeBy, markerBy로 확장하라.
- GroupStyleEditor에 명확한 컬럼 라벨을 추가하고 marker type select를 추가하라.
- IndividualCurveEditor는 curve label을 항상 표시하고, 컬럼 라벨/상태 배지/row reset을 제공하라.
- 선택 curve가 많을 때 individual style list가 과도하게 길어지지 않도록 검색 또는 virtualization을 적용하라.
- 깨진 문자열이나 모호한 용어가 없는지 사용자 표시 텍스트를 점검하라.

테스트:
- marker 기준 UI와 group marker select component test를 추가하라.
- 개별 row label, status badge, reset button 테스트를 추가하라.
- 기준 변경 후 Custom/Preset row 상태가 정확히 표시되는지 테스트하라.
- Playwright screenshot으로 Style 패널 가독성을 확인하라.
- npm run test, npm run build, 필요 시 npm run test:e2e를 실행하라.

문서:
- CHANGELOG.md와 DEVELOPMENT_STATE.md를 갱신하라.
```

## Phase R8. Custom legend 및 범례 제어

목표:
- 범례가 plot을 가리지 않게 하고, 실제 style과 일치하는 범례를 제공한다.

주요 작업:
- chart option의 ECharts built-in legend를 기본적으로 숨긴다.
- chart/style projection에서 `LegendItem[]`을 생성한다.
- `showLegendOnPreview`, `includeLegendInExport`, `exportLayout` 상태를 추가한다.
- 필요하면 `hiddenCurveIds` 또는 `chartVisibleCurveIds`를 별도 상태로 두되 selection과 혼동되지 않게 한다.
- custom legend component를 만든다.
- line sample은 실선/점선/도트를 명확히 보이게 충분한 길이로 그린다.
- marker가 `none`이면 legend marker를 그리지 않는다.
- 많은 legend item은 검색/스크롤/접힘을 제공한다.

검증:
- default no-marker curve는 범례에도 marker가 보이지 않는다.
- 실선/점선/도트가 범례에서 구분된다.
- 범례를 꺼도 plot은 정상 렌더링된다.
- 범례 표시 상태와 export 포함 상태가 독립적으로 동작한다.
- legend order 변경은 custom legend와 export order 모두에 반영된다.

구현 프롬프트:
```text
Phase R8을 구현하라.

작업 범위:
- src/chart/chartConfig.ts에서 ECharts built-in legend 의존을 줄이고 plot area가 legend와 겹치지 않게 하라.
- chart/style projection에서 LegendItem[]을 생성하는 순수 함수를 추가하라.
- 선택됨, 차트 표시됨, preview 범례 표시, export 범례 포함, export layout 상태를 분리하라.
- src/ui에 CustomLegend 컴포넌트를 추가하라.
- CustomLegend는 lineType과 markerType을 실제 resolved style과 일치하게 그려라.
- SettingsPanel Export 또는 Legend settings에 다음 옵션을 추가하라:
  - preview 범례 표시
  - export에 범례 포함
  - export layout: Plot only / Plot + Legend / Legend only
- 많은 legend item에 대해 스크롤 또는 검색을 제공하라.

테스트:
- no-marker curve가 legend에서도 marker 없이 표시되는 테스트를 추가하라.
- dashed/dotted legend sample이 class 또는 렌더링 속성으로 구분되는지 테스트하라.
- legend visibility toggle 테스트를 추가하라.
- legend order가 CustomLegend와 chart/export projection에 반영되는지 테스트하라.
- Playwright screenshot으로 범례가 plot을 가리지 않는지 확인하라.
- npm run test, npm run build, npm run test:e2e를 실행하라.

문서:
- CHANGELOG.md와 DEVELOPMENT_STATE.md를 갱신하라.
```

## Phase R9. Export 레이아웃 확장: Plot only / Plot + Legend / Legend only

목표:
- preview와 동일한 style projection을 사용하여 plot과 legend를 각각 또는 함께 export할 수 있게 한다.

주요 작업:
- export용 chart image는 legend 없는 plot image로 생성한다.
- custom legend를 canvas 또는 SVG로 렌더링해 이미지 export에 사용한다.
- `Plot + Legend`는 plot image와 legend image를 흰색 배경 canvas에 합성한다.
- `Legend only`는 legend image만 export한다.
- PNG/JPEG export 모두 동일한 layout 옵션을 따른다.
- clipboard PNG도 선택된 export layout을 따른다.

검증:
- Plot only는 chart만 포함한다.
- Plot + Legend는 plot을 가리지 않는 범례를 포함한다.
- Legend only는 legend만 포함한다.
- export filename은 기존 `YYMMDD_plotN.ext` 정책을 유지한다.
- 실패한 export는 `plotN`을 소비하지 않는다.

구현 프롬프트:
```text
Phase R9를 구현하라.

작업 범위:
- src/chart/exportChart.ts를 확장해 chart image, legend image, composite image 생성을 분리하라.
- custom legend export renderer를 추가하라. 가능하면 외부 dependency 없이 canvas/SVG 기반으로 구현하라.
- ExportControls에 export layout 옵션을 연결하라.
- PNG/JPEG download와 clipboard PNG가 같은 export layout을 쓰게 하라.
- 흰색 배경과 기존 filename 규칙을 유지하라.
- export layout은 data inclusion을 바꾸지 않는다. plotted CSV는 현재 plotted curve projection을 따르고, Analysis XLSX는 별도 기능으로 전체 imported dataset과 설정을 저장한다.

테스트:
- export layout별 blob 생성 smoke test를 추가하라.
- Plot + Legend export가 chart와 legend 영역을 모두 포함하는지 canvas size 또는 pixel smoke로 검증하라.
- Legend only export가 선택 legend item을 포함하는지 테스트하라.
- filename counter 성공/실패 동작을 유지하는지 테스트하라.
- Playwright download 또는 screenshot smoke를 실행하라.
- npm run test, npm run build, npm run test:e2e를 실행하라.

문서:
- docs/03_INPUT_OUTPUT_SPEC_EN.md, docs/04_TEST_PLAN_ACCEPTANCE_EN.md, CHANGELOG.md, DEVELOPMENT_STATE.md를 갱신하라.
```

## Phase R10. Legend order와 style editor 일관성

목표:
- 범례 순서 변경이 style override를 잃거나 다른 curve에 적용되는 것처럼 보이지 않게 한다.

주요 작업:
- Legend Order 목록과 Individual Style 목록이 같은 order projection을 공유하도록 정리한다.
- 이동은 `orderedCurveIds`만 변경하고 style override는 `curveId`에 남긴다.
- style editor에서 현재 legend order 기준 정렬과 검색 기준 정렬을 명확히 제공한다.
- row에 source file/sheet/column tooltip을 제공해 동일 라벨 혼선을 줄인다.

검증:
- legend order 변경 후 curve별 style이 유지된다.
- 동일 label curve도 source suffix 또는 tooltip으로 구분된다.
- style editor에서 검색/정렬 후 수정해도 올바른 curveId에 적용된다.

구현 프롬프트:
```text
Phase R10을 구현하라.

작업 범위:
- LegendOrderEditor와 IndividualCurveEditor가 같은 selectedCurves/order projection을 쓰는지 정리하라.
- style override 저장/수정이 curveId 기준임을 테스트로 보장하라.
- 동일 label curve 구분을 위해 source suffix 또는 tooltip을 추가하라.
- style editor 검색/정렬이 있더라도 override target이 흔들리지 않게 하라.

테스트:
- legend order 이동 후 개별 style이 같은 curveId에 유지되는 테스트를 추가하라.
- 동일 display label curve의 override가 서로 섞이지 않는 테스트를 추가하라.
- Playwright로 order 이동 후 chart/legend/style row 일관성을 확인하라.
- npm run test, npm run build, npm run test:e2e를 실행하라.

문서:
- CHANGELOG.md와 DEVELOPMENT_STATE.md를 갱신하라.
```

## Phase R11. Analysis XLSX/탭 회귀 및 Report XLSX 보류 판단

목표:
- 선택/스타일/범례/export 개선 후에도 Analysis XLSX restore와 내부 탭 독립성이 깨지지 않는지 검증한다.
- Report/Plotted XLSX는 이번 배치에서 구현하지 않고, 필요성과 리스크를 문서화한다.

주요 작업:
- R1~R4에서 만든 AnalysisState serializer와 Analysis XLSX roundtrip 테스트를 최신 style/legend/export state까지 확장한다.
- custom legend, export layout, marker group rule, hover/readout 추가 후에도 저장/복원이 일관적인지 확인한다.
- 여러 탭에서 각각 exportCounter와 Analysis XLSX export/import가 독립적으로 동작하는지 확인한다.
- Report/Plotted XLSX는 `Deferred`로 문서화한다.
- native editable Excel chart는 구현하지 않는다.
- 정적 PNG chart가 들어간 보고용 XLSX가 여전히 필요하다고 판단될 경우, 별도 Phase 후보와 라이브러리 검토 항목만 남긴다.

검증:
- Analysis XLSX roundtrip은 전체 imported dataset과 최신 설정을 복원한다.
- 탭 A의 style/legend/export 변경이 탭 B에 영향을 주지 않는다.
- custom legend/export layout state가 저장/복원된다.
- native editable chart 관련 코드나 dependency가 추가되지 않는다.

구현 프롬프트:
```text
Phase R11을 수행하라.

작업 범위:
- AnalysisState serialization 대상에 R2~R6에서 추가된 style/legend/export layout state가 빠지지 않았는지 점검하라.
- Analysis XLSX export/import roundtrip 테스트를 최신 상태 모델에 맞게 보강하라.
- 두 개 이상의 내부 탭에서 Analysis XLSX export/import, image export counter, selection/style/legend order가 독립적인지 검증하라.
- Report/Plotted XLSX는 이번 배치에서 구현하지 말고 Deferred로 문서화하라.
- native editable Excel chart, chart image insertion dependency, exceljs 등은 추가하지 말라.
- 사용자가 보고용 XLSX를 다시 요구할 경우를 대비해 별도 후보 범위만 Known Gaps 또는 Planned 항목에 정리하라.

테스트:
- Analysis XLSX roundtrip regression test를 추가하거나 갱신하라.
- multi-tab 독립성 테스트를 추가하라.
- `native chart` 또는 report-image XLSX 구현 dependency가 추가되지 않았는지 package diff를 확인하라.
- npm run test, npm run build, npm run test:e2e를 실행하라.

문서:
- docs/03_INPUT_OUTPUT_SPEC_EN.md에는 Analysis XLSX와 Report/Plotted XLSX의 목적 차이를 기록하라.
- docs/04_TEST_PLAN_ACCEPTANCE_EN.md, CHANGELOG.md, DEVELOPMENT_STATE.md를 갱신하라.
```

## Phase R12. Hover readout, 과다 curve 보조 액션, 접근성/성능 보강

목표:
- 많은 curve를 분석할 때 화면 가림과 스크롤 부담을 줄인다.

주요 작업:
- tooltip이 plot을 가리는 문제를 줄이기 위해 hover 정보를 chart panel의 고정 readout에 표시한다.
- 20개 초과 warning에 보조 액션을 추가한다.
  - 현재 검색 결과만 선택 유지.
  - 선택 해제.
  - style 구분 보강 프리셋 적용.
- style list와 legend list 가상 스크롤을 정리한다.
- keyboard 접근성과 aria label을 보강한다.

검증:
- hover readout은 plot을 가리지 않는다.
- 20개 초과 상태에서도 export는 차단되지 않는다.
- style/legend list가 많아도 조작 가능하다.
- 주요 control은 keyboard로 접근 가능하다.

구현 프롬프트:
```text
Phase R12를 구현하라.

작업 범위:
- ECharts hover event를 사용해 chart panel에 고정 readout을 표시하라.
- 기존 tooltip이 plot을 과도하게 가리면 축소하거나 readout 중심으로 조정하라.
- >20 visible curve warning에 분석 보조 액션을 추가하라. 단 preview/export는 차단하지 말라.
- legend/style list의 virtualization 또는 검색을 정리하라.
- 주요 버튼, select, accordion, tree row의 accessible name과 keyboard focus를 점검하라.

테스트:
- hover readout component test 또는 Playwright smoke를 추가하라.
- >20 warning 보조 액션 테스트를 추가하라.
- keyboard navigation sanity test를 가능한 범위에서 추가하라.
- desktop/mobile screenshot을 갱신하라.
- npm run test, npm run build, npm run test:e2e를 실행하라.

문서:
- CHANGELOG.md, DEVELOPMENT_STATE.md, docs/08_RELEASE_CHECKLIST_KR.md를 갱신하라.
```

## Phase R13. 최종 회귀, 배포, 릴리스 문서 갱신

목표:
- 보완 기능 전체를 GitHub Pages에 안전하게 반영한다.

주요 작업:
- 전체 테스트 실행.
- 빌드 및 preview 검증.
- Playwright screenshot 갱신.
- GitHub Pages 배포.
- 공개 URL에서 app, favicon, asset, export 기본 동작 확인.
- `DEVELOPMENT_STATE.md`, `CHANGELOG.md`, `docs/08_RELEASE_CHECKLIST_KR.md` 최종 갱신.

검증:
- `npm run test`
- `npm run build`
- `npm run test:e2e`
- `npm audit --omit=dev`
- GitHub Actions Pages deploy success
- 공개 URL smoke

구현 프롬프트:
```text
Phase R13을 수행하라.

작업 범위:
- Phase R1~R12 변경사항 전체를 기준으로 회귀 테스트를 수행하라.
- docs/02, docs/03, docs/04, docs/08, DECISIONS.md, CHANGELOG.md, DEVELOPMENT_STATE.md를 최종 갱신하라.
- GitHub Pages 배포까지 진행하라.
- 공개 URL에서 기본 화면, app icon, Excel upload smoke, chart render smoke, legend/export control 존재를 확인하라.

검증:
- npm run test
- npm run build
- npm run test:e2e
- npm audit --omit=dev
- GitHub Actions Pages deploy success
- 공개 URL HTTP 200 및 기본 asset 확인

보고:
- 커밋 해시, 배포 URL, 테스트 결과, 남은 Known Gaps를 보고하라.
```

---

# 4. 신규 수용기준 초안

구현 전 Phase R0에서 `docs/04_TEST_PLAN_ACCEPTANCE_EN.md`에 정식 반영한다.

| ID | 범위 | 수용기준 |
| --- | --- | --- |
| AC-PCR-026 | Selection tree | 단일 curve subgroup은 중복 checkbox 없이 하나의 selectable row로 표시된다. |
| AC-PCR-027 | Style hierarchy | 색상/선/마커 기준과 개별 override origin이 UI에 명확히 표시된다. |
| AC-PCR-028 | Group marker | 검체/시약 group style에서 marker none/circle/triangle/rect를 설정할 수 있고 chart와 legend에 반영된다. |
| AC-PCR-029 | Override reset | row별, 선택 curve 전체, 전체 override reset이 기준 스타일 복귀를 보장한다. |
| AC-PCR-030 | Custom legend | 범례는 plot을 가리지 않고, line type과 marker type을 실제 resolved style과 일치하게 표시한다. |
| AC-PCR-031 | Legend visibility/export | preview 범례 표시, export 범례 포함, Plot only / Plot + Legend / Legend only export가 동작한다. |
| AC-PCR-032 | Legend order/style parity | legend order 변경 후 style override는 같은 curveId에 유지되고 preview/export/data order가 일치한다. |
| AC-PCR-033 | Analysis XLSX export | Analysis XLSX는 선택 여부와 무관하게 전체 imported dataset, source metadata, warnings, selection, order, scale, style, legend/export settings를 저장한다. 파일명은 안전하게 sanitize되고 transient UI state는 제외된다. |
| AC-PCR-034 | Analysis XLSX import | Analysis XLSX를 다시 열면 hidden restore JSON 기준으로 분석 상태가 복원되고, 선택하지 않은 curve도 dataset에 남아 있다. |
| AC-PCR-035 | Internal tabs | 여러 analysis tab은 dataset, selection, search, collapse, scale, style, legend/export order, exportCounter를 독립적으로 유지한다. |
| AC-PCR-036 | File action routing | dirty가 아닌 상태 또는 dirty 정책 확정 후, `파일 선택`/`추가 선택`은 원본 Excel과 Analysis XLSX를 구분해 replace, append, restore, new-tab open 동작을 혼동 없이 수행한다. dirty 정책이 미확정이면 데이터 손실 가능성이 있는 close/replace/restore는 차단된다. |
| AC-PCR-037 | No native chart / no clinical transform | Analysis XLSX는 native editable Excel chart를 포함하지 않으며, 저장/복원 과정에서도 fluorescence 원본값을 보정/변환/판독하지 않는다. |
| AC-PCR-038 | Performance smoke | X scale 1-100 수준의 데이터에서 100 visible curves x 100 points는 브라우저 smoke 기준을 통과하고, 수백~1000 imported curves는 selection virtualization으로 조작 가능해야 한다. |
| AC-PCR-039 | Hover/readout | hover 정보는 plot 분석을 방해하지 않는 고정 readout 또는 동등한 방식으로 제공된다. |
| AC-PCR-040 | Large style/legend lists | 다수 curve에서도 style과 legend 목록이 검색/스크롤/가상화로 조작 가능하다. |
| AC-PCR-041 | State separation | selected, chart-visible, legend-visible, export layout 상태가 분리되어 한 상태 변경이 다른 의미의 상태를 암묵적으로 바꾸지 않는다. |
| AC-PCR-042 | Style row identity | 개별 style row는 curve identity, 명확한 컬럼 라벨, duplicate label source disambiguation, reset/status control을 제공한다. |
| AC-PCR-043 | Accessibility | 주요 tab, tree, accordion, style, legend, export control은 keyboard 접근과 accessible name/state를 제공한다. |

---

# 5. 확정된 제외/기본값

아래 항목은 최신 사용자 판단과 전문가 검토를 반영해 이번 계획의 기본값으로 둔다.

- Excel에서 편집 가능한 native chart는 제외한다. 안정화 후 별도 요청이 있을 때만 새 기술 검토 대상으로 둔다.
- reload 후 자동 localStorage/sessionStorage 영구 저장은 기본 제공하지 않는다. 분석 재개는 사용자가 명시적으로 export/import하는 Analysis XLSX로 처리한다.
- 임상 판독 보조 계산은 제외한다. threshold, Tt/Ct/Cq, baseline correction, positive/negative 판정은 이번 범위가 아니다.
- 범례 기본값은 보이는 방향이 맞다. preview에서는 plot 밖 custom legend를 기본 표시하고, image export는 legend 포함을 기본값으로 둔다.

# 6. 사용자 결정 대기 항목

아래 항목은 아직 제품 판단이 필요한 부분이다. 구현 중 안전한 기본값을 둘 수는 있으나, 품질 저하나 사용자 데이터 손실 위험이 있으면 임의 확정하지 않고 질문하거나 해당 범위를 제외한다.

1. dirty tab 닫기/교체 UX  
   - 저장하지 않은 analysis tab을 닫거나 `파일 선택`으로 교체할 때 확인 modal을 띄울지, 단순 warning + 취소/진행 버튼으로 처리할지 결정이 필요하다.

2. `파일 선택` + Analysis XLSX가 dirty active tab에서 동작하는 방식  
   - dirty가 아니면 active tab restore가 기본 동작이다.  
   - dirty 상태에서 확인 후 교체할지, 자동으로 새 tab으로 열지, 항상 차단할지는 향후 사용자 결정 항목이다.
   - 결정 전에는 데이터 손실 가능성이 있는 restore/replace/close를 차단한다.

3. 내부 tab 수 제한  
   - 탭을 많이 열면 메모리 사용량이 커질 수 있다.  
   - 권장 기본값은 hard cap 없이 warning/탭 정리 안내를 제공하는 방식이다. hard cap이 필요한지는 사용 경험 후 결정한다.

4. Analysis XLSX visible `ImportedData` sheet의 대용량 표시 방식  
   - hidden JSON은 authoritative restore source로 고정한다.  
   - visible sheet는 wide table 하나로 둘지, source file별 sheet/section으로 나눌지는 파일 크기와 Excel 가독성을 보고 구현 중 결정할 수 있다.

5. Report/Plotted XLSX 필요성  
   - 현재는 Analysis XLSX로 분석 재개 요구를 충족하므로 후순위로 둔다.  
   - “현재 plot image + 현재 plotted data를 보고서 파일로 저장” 요구가 다시 우선순위가 되면 별도 Phase로 산정한다.

---

# 7. 권장 구현 순서 요약

1. R0 문서/테스트 기준 갱신
2. R1 AnalysisState 직렬화/복원 기반
3. R2 내부 분석 탭 상태 모델
4. R3 분석 탭 UI와 분석 이름
5. R4 Analysis XLSX Export/Import
6. R5 선택 트리 중복 체크박스 제거
7. R6 스타일/legend/export 상태 모델 정리 및 마커 그룹 스타일 추가
8. R7 스타일 UI 재구성
9. R8 custom legend 및 범례 제어
10. R9 export 레이아웃 확장
11. R10 legend order/style editor 일관성
12. R11 Analysis XLSX/탭 회귀 및 Report XLSX 보류 판단
13. R12 hover readout, 과다 curve 보조 액션, 접근성/성능
14. R13 회귀/배포/릴리스 문서 갱신

이 순서의 이유는 Analysis XLSX와 내부 탭이 상태 모델의 뼈대를 바꾸는 작업이기 때문이다. 선택 트리, 스타일, 범례, export UI를 먼저 고치면 이후 탭별 AnalysisState로 다시 옮기는 과정에서 회귀 위험이 커진다. 따라서 R1로 저장/복원 가능한 AnalysisState 경계를 먼저 만들고, R2~R3으로 내부 탭 경계를 확정한 뒤 R4 Analysis XLSX를 구현한다.

## 전문가 검토 반영 사항
- 선택됨/차트 표시/범례 표시/export 포함 상태를 분리하도록 원칙과 수용기준을 추가했다.
- ECharts 기본 legend toggle에 의존하지 않고 앱 controlled projection을 쓰도록 명시했다.
- selection tree를 major group 중심이 아니라 flat row projection으로 확장 검토하도록 보강했다.
- Analysis XLSX는 전체 imported dataset과 설정을 포함하는 분석 재개 파일로 정의했고, hidden restore JSON을 authoritative source로 삼도록 보강했다.
- native editable Excel chart와 report-image XLSX 구현은 제외/후순위로 분리했다.
- 내부 분석 탭은 탭별 AnalysisState, dirty flag, analysisName/sourceFileName/chartTitle 분리를 요구하도록 추가했다.
- 내부 분석 탭은 이번 R0~R13 구현 지시로 D027 `Accepted` 범위가 되었으며, R2/R3 구현 대상으로 정리했다.
- dirty tab close/replace 정책은 미확정 상태에서 임의 확인 UX를 구현하지 않고, 데이터 손실 가능성이 있는 동작을 차단하도록 보강했다.
- Analysis XLSX roundtrip 테스트 범위를 analysisName, sourceFiles, warnings, grouping/collapse, P1/P2, exportCounter, legend/export layout, hidden JSON chunk 오류까지 넓혔다.
- Phase 번호를 R0~R13으로 일렬화해 R1A/R1B 이후 다시 R1이 나오는 혼선을 제거했다.
- reset 범위를 field, curve, selected curves, all overrides, group reset으로 구분했다.
- hover 강조가 export 또는 style override state를 오염시키지 않는 transient state여야 함을 추가했다.
