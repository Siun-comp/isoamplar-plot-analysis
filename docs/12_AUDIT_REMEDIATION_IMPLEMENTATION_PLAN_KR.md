# 12 정밀감사 보완 상세 구현 계획 및 단계별 프롬프트

## 문서 상태

- 상태: Implemented - Phases S0 through S11 released
- 작성일: 2026-07-11
- 기준 감사: `docs/11_GPT56_PROJECT_AUDIT_KR.md`
- 적용 대상: 현재 로컬 working tree 전체
- 구현 상태: Phases S0-S11 구현·검증·커밋 완료. 최종 SHA `eae3281fb8f9bbbd900fab528be3e094b93b555a`가 GitHub Pages에 배포되어 public smoke를 통과했다.
- Owner: Product / Engineering / QA

## 압축 안전 요약

- 목적은 새 기능을 늘리는 것이 아니라 입력 추적성, 축과 범례의 정확성, 분석 저장 연속성, 데스크톱 사용성을 먼저 안정화하는 것이다.
- Phase S0부터 S11까지 순서대로 진행한다. 앞 단계의 품질 게이트를 통과하지 못하면 다음 단계로 넘어가지 않는다.
- 모바일, 서버, 로그인, 실시간 협업, multi-plot, native editable Excel chart, 원본 fluorescence 편집·보정·임상판독 계산은 범위 밖이다.
- 모든 수치 데이터는 원본 fluorescence를 그대로 유지한다. 빈 값은 gap으로 남기며 smoothing, normalization, baseline correction, log 변환, 평균, threshold, Ct/Cq 계산을 추가하지 않는다.
- S0 baseline과 S11 release tag/rollback SHA가 기록되어 있으며, 이후 변경도 같은 검증·승격 절차를 따른다.
- 입력 상한 수치, 자동 복구 저장, 자동 스타일 변경, 대규모 화면 재배치, 후속 Workflow 기능은 사용자 결정 전 확정하지 않는다.
- 각 Phase는 테스트, build, Playwright/브라우저 확인, 전문가 검토, 관련 문서 갱신, 사용자 검수 후 종료한다. 커밋·push·배포는 별도 승인 후에만 수행한다.

## 1. 목적

정밀감사에서 확인된 위험을 재현 가능한 테스트로 먼저 고정하고, 데이터 해석과 산출물 오인을 일으킬 수 있는 문제부터 순차적으로 제거한다. 최종 목표는 다음 세 가지다.

1. 어떤 source의 어떤 Excel/paste 값이 어떻게 해석되었는지 추적할 수 있다.
2. 화면과 export에서 scale, curve identity, legend style이 조용히 달라지지 않는다.
3. 여러 분석 탭을 장시간 사용해도 저장, 닫기, 새로고침, 비동기 export가 다른 분석에 영향을 주지 않는다.

이 계획은 분자진단 데이터의 통계적·임상적 해석 기능을 추가하는 계획이 아니다. 분석 도구의 입력·표시·저장 신뢰성을 높이는 계획이다.

## 2. 필수 읽기 순서

각 Phase를 시작하는 agent는 다음 순서로 현재 진실을 확인한다.

1. `AGENTS.md`
2. `DEVELOPMENT_STATE.md`
3. `DECISIONS.md`
4. `docs/11_GPT56_PROJECT_AUDIT_KR.md`
5. 이 문서의 해당 Phase
6. `docs/02_FUNCTIONAL_REQUIREMENTS_EN.md`
7. `docs/03_INPUT_OUTPUT_SPEC_EN.md`
8. `docs/04_TEST_PLAN_ACCEPTANCE_EN.md`
9. 해당 기능의 source와 test

문서와 코드가 충돌하면 임의로 한쪽을 선택하지 않는다. 현재 사용자 결정과 실제 동작을 대조하고, 업무 판단이 필요한 충돌이면 구현을 멈추고 질문한다.

## 3. 고정 원칙

### 3.1 과학·데이터 무결성 불변조건

다음 조건은 모든 Phase에서 회귀가 없어야 한다.

1. 입력된 fluorescence 숫자를 자동 보정·변환하지 않는다.
2. 빈 값과 비숫자 값은 정책에 따라 warning과 `null`/gap으로 처리하며 임의 보간하지 않는다.
3. curve 선택, style, Analysis label, legend/export order는 `curveId` 기준으로 연결한다.
4. 원본 specimen/reagent/source label과 Analysis label을 분리하고 원본 추적성을 유지한다.
5. preview와 PNG/JPEG/clipboard는 같은 chart projection과 scale state를 사용한다.
6. Analysis XLSX는 표시하지 않은 곡선을 포함한 전체 imported dataset과 설정을 저장한다.
7. Quick Paste는 import 전 read-only preview를 거치고 앱 안의 원본 데이터 편집기로 확장하지 않는다.
8. Box zoom은 데이터가 아니라 X/Y 표시 범위만 변경한다.

### 3.2 제품·배포 불변조건

- React + Vite + TypeScript, SheetJS/xlsx, Apache ECharts, Zustand + Immer, TanStack Virtual, Vitest/Testing Library, Playwright를 유지한다.
- 정적 GitHub Pages 호환 구조와 browser-local 데이터 처리를 유지한다.
- 데스크톱 Chrome/Edge가 대상이다. 모바일 최적화와 모바일 수용기준은 추가하지 않는다.
- native editable Excel chart는 추가하지 않는다.
- broad refactor는 결함 수정과 테스트가 안정된 뒤에도 필요성이 입증된 경우에만 별도 승인한다.
- 기존 사용자가 만든 변경을 되돌리지 않는다.

### 3.3 변경·검수 원칙

- 각 Phase는 해당 범위만 구현한다.
- 먼저 실패하는 회귀 테스트나 fixture를 만들고, 그다음 최소 범위로 수정한다.
- 자동 테스트 통과만으로 완료하지 않는다. 실제 데스크톱 브라우저의 화면과 산출물을 확인한다.
- 사용자가 브라우저에서 확인할 수 있는 상태를 먼저 제공하고, 사용자 승인 전 commit/push/deploy하지 않는다.
- Phase 도중 새 사용자 결정이 필요하면 안전하게 제외할 수 있는 부분은 제외하고 계속한다. 제외할 수 없으면 즉시 멈추고 질문한다.

## 4. 범위와 우선순위

### 4.1 이번 실행 계획에 포함

- P1: invalid Fixed scale, legend identity truncation, Excel formatted-header identity, actionable warnings, refresh/close protection, Quick Paste accepted-shape crash
- P2 중 직접 연결된 항목: async tab isolation, Analysis XLSX semantic validation과 payload 계측, CSV formula-safe header, formula provenance, controlled error handling
- 명백한 UI 결함: Legend inactive tab 표시, 저장 상태 용어, 긴 legend/style 편집의 기본 가독성
- 검증 기반 성능 보완: hover 계산과 대량 editor rendering
- CI/문서/current truth 정리

### 4.2 승인 전 포함하지 않음

- IndexedDB/localStorage 자동 복구
- Named View
- 설정 Undo/Redo
- figure metadata
- 모든 export에 강제되는 preflight modal
- 자동 색상/선/마커 재배정
- 새로운 Cycle/X 입력 방식
- generic CSV import 또는 CSV dialect 추정
- 공개 GitHub Pages에서 접근제어가 가능한 다른 hosting으로의 이전
- page 전체를 바꾸는 대규모 UI redesign

## 5. 감사 추적 매트릭스

| 감사 항목 | 영향 | 구현 Phase | 핵심 검증 |
|---|---|---|---|
| C-P1-01 invalid Fixed scale | 잘못된 축으로 비교/export | S2 | invalid 상태 유지, plot export 차단, Previous scale 정밀도 |
| C-P1-02 legend identity truncation | 조건 오인 | S3 | shared-prefix 전체 식별, raster collision 검사 |
| C-P1-03 Excel 표시 header 변형 | grouping/legend identity 변형 | S4 | `001`, 날짜, 과학표기, 공백 fixture |
| C-P1-04 경고 위치·처리 불명확 | 입력 오류 추적 어려움 | S4 | source/sheet/cell/raw/handling 표시 |
| C-P1-05 refresh/close 손실 | 분석 연속성 손실 | S6 | `beforeunload`, 명시적 저장/열기 command |
| C-P1-06 Quick Paste spread crash | 허용 입력에서 앱 오류 | S5 | worst-shape parser와 controlled error |
| C-P2-01 Analysis XLSX 의미 검증 | 모순 상태 복원 | S7 | entity/source/stats/길이 관계 검증 |
| C-P2-02 source cycle compatibility | 서로 다른 run 오해 | S7, 사용자 결정 | 현 규칙 요약만, 새 Cycle 규칙은 미확정 |
| C-P2-03 CSV formula 해석 | Excel에서 label 오인 | S7 | `= + - @` header 안전성 |
| C-P2-04 대량 hover/editor | 지연과 작업 방해 | S9 | 20/100곡선 synthetic stress |
| C-P2-05 Analysis XLSX 범위 설명 | 전체 dataset 외부 공유 위험 | S6/S7 | 버튼 주변 상시 설명 |
| C-P2-06 async 완료 탭 혼선 | counter/message/dirty 오염 | S6 | 작업 시작 탭 instance/revision 고정 |
| U-P1-01 Legend tab CSS 결함 | 동시에 두 편집기 노출 | S8 | inactive panel hidden Playwright |
| U-P2-02 Style 폭/밀도 | curve 식별 어려움 | S8 | compact row, curve name 우선 표시 |
| U-P2-03 sticky plot 실패 | 설정 중 plot 상실 | S8 | desktop-height viewport 확인 |
| U-P2-04 style signature 충돌 | 곡선 구분 어려움 | S8, 사용자 결정 | 경고/보조만, 자동 재배정 안 함 |
| U-P2-05/06 긴 legend 편집/ellipsis | 조건 suffix 식별 어려움 | S3/S8 | wrap, 검색, 상·하단 이동 |
| U-P3-01~03 용어/밀도 | 읽기 속도 저하 | S8, 일부 사용자 결정 | 오해 가능한 상태어 우선 수정 |
| 문서·CI drift | 향후 agent 오판 | S1/S10/S11 | current truth, fixed fixture, fresh E2E |

### 5.1 제안 수용기준 ID

아래 ID는 S1에서 `Target / Known red`로 `docs/04_TEST_PLAN_ACCEPTANCE_EN.md`에 먼저 고정한다. 각 구현 Phase가 끝날 때 해당 상태와 evidence를 갱신하며, S1 fixture/CI 기반이 준비됐다는 이유만으로 제품 수용기준을 충족 처리하지 않는다.

| ID | 수용기준 초안 |
|---|---|
| AC-PCR-045 | invalid Fixed/P1/P2는 Fixed로 표시된 채 Auto로 그려지지 않으며 plot 포함 export가 차단된다. Legend-only와 Analysis XLSX는 계속 사용할 수 있다. |
| AC-PCR-046 | 서로 다른 curve ID의 shared-prefix label은 preview와 모든 legend raster에서 식별 가능하며 최종 표시 문자열 충돌이 조용히 허용되지 않는다. |
| AC-PCR-047 | `.xls/.xlsx`의 formatted header display text가 label로 보존되고 raw value/type/format/formula/cell address가 provenance로 남는다. |
| AC-PCR-048 | 모든 import warning은 source identity/handling/affected curves를 표시하고, 해당되는 warning은 location/raw value도 표시하며 append와 Analysis XLSX roundtrip에서 source별로 유지된다. |
| AC-PCR-049A | dirty analysis가 하나라도 있으면 refresh/close가 보호되고 모두 clean이면 보호 handler가 없다. |
| AC-PCR-049B | async save/export/clipboard 결과가 시작 analysis runtime/revision에만 반영된다. |
| AC-PCR-050 | Analysis XLSX는 schema migration 후 entity/source/point/stats/order 관계를 검증하고 모순 payload를 state commit 전에 거부한다. |
| AC-PCR-051 | plotted CSV의 최종 specimen/reagent/generated/Analysis label header가 spreadsheet formula로 실행되지 않으며 output escaping은 source label과 Analysis XLSX 값을 변경하지 않는다. |
| AC-PCR-052A | Legend inactive tab은 화면과 accessibility tree에서 hidden된다. |
| AC-PCR-052B | desktop plot/style/legend가 합의된 주요 viewport에서 겹치거나 작업면을 잃지 않는다. |
| RQ-CI-001 | CI가 한 번 build한 동일 `dist`, fresh Chromium, fixture hash, evidence artifact를 검사하며 raster/network/Pages gate는 S10에서 완성한다. |
| AC-QP-021 | 현재 문서화된 2,000,000-character 및 250,000-cell 제한 안의 유효한 worst-shape paste는 stack overflow 없이 preview를 완료한다. 문자/cell 제한 밖 입력과 catch 가능한 parser 오류만 controlled error로 끝나며 active analysis를 변경하지 않는다. Browser OOM처럼 process가 복구할 수 없는 실패까지 controlled error로 보장하지 않는다. |

## 6. 전체 Phase 구조

| Phase | 목적 | 선행 조건 | 사용자 결정으로 중단될 수 있는 지점 |
|---|---|---|---|
| S0 | 현재 상태 고정과 작업 기준점 | 없음 | baseline commit/tag 승인 |
| S1 | fixture·회귀 증거·current truth | 승인된 S0 checkpoint | 대표 대용량 파일 제공 여부는 선택 |
| S2 | 공통 수치 계산 안전성과 scale 정확성 | S1 | valid non-overlap scale 정책 |
| S3 | legend 식별성과 raster fidelity | S2 | 없음 |
| S4 | Excel identity와 warning provenance | S3 | formula/위장 형식의 차단 정책 |
| S5 | Quick Paste와 오류 격리 | S4 | 신규 hard limit 수치 |
| S6 | 저장 연속성과 tab-safe async | S5 | 자동 복구 저장은 제외 |
| S7 | Analysis XLSX/CSV 의미 안전성과 payload 계측 | S6 | hard payload limit, 신규 Cycle 규칙 |
| S8 | 데스크톱 UI 결함과 밀도 | S7 | 대규모 레이아웃/언어 전면 변경 |
| S9 | 검증 기반 성능 보완 | S8 | 정식 성능 목표 수치 |
| S10 | CI·배포·보안 회귀 게이트 | S9 | hosting 이전/CSP 강화 범위 |
| S11 | 문서 동기화와 release readiness | S10 | 실제 commit/push/deploy 승인 |

기술적 의존관계는 `S0 → S1`, `S1 → S2 → S5`, `S1 → S3`, `S1 → S4 → S7`, `S1 → S6 → S7`, `S3/S4/S6/S7 → S8 → S9 → S10 → S11`이다. S3·S4·S6은 일부 병렬화할 수 있지만, 사용자 검수와 rollback을 단순하게 유지하기 위해 실제 실행은 번호 순서로 진행한다. S0 checkpoint가 없으면 이 순차 실행을 시작하지 않는다.

## 7. 공통 Phase 완료 게이트

각 Phase에서 아래를 실행한다. 기능 특성상 해당하지 않는 항목은 이유를 문서에 남긴다.

1. 관련 unit/component test
2. `npm run test`
3. `npm run build`
4. production preview를 사용하는 fresh Playwright 실행
5. 1280x720, 1366x768, 1920x1080 데스크톱 브라우저 확인
6. chart canvas가 nonblank이며 plot/label/control이 겹치지 않는지 screenshot 확인
7. fluorescence/curveId/source provenance 회귀 확인
8. 해당 요구사항·I/O·수용기준·결정·changelog·state 문서 갱신
9. 최소 2개 관점의 전문가 검토와 lead agent 통합 검토
10. 사용자 검수 URL과 검수 목록 제공

Git commit, tag, push, GitHub Pages 배포는 위 게이트가 아니라 별도 사용자 승인 작업이다.

## 8. 단계별 상세 계획과 실행 프롬프트

### 공통 실행 머리말

아래 문장을 각 Phase 전용 프롬프트 앞에 함께 사용한다.

```text
AGENTS.md와 DEVELOPMENT_STATE.md를 먼저 읽고 현재 dirty working tree의 사용자 변경을 보존하라.
docs/12_AUDIT_REMEDIATION_IMPLEMENTATION_PLAN_KR.md의 Phase 순서를 지키고 이번 요청의 Phase 범위만 수행하라.
원본 fluorescence를 변환·보정·보간하지 말고 curveId/source provenance를 유지하라.
사용자 업무 판단이 필요한 새 항목은 임의 확정하지 마라. 안전하게 제외할 수 없으면 즉시 작업을 멈추고 질문하라.
각 세부 작업 후 관련 test를 실행하고, Phase 종료 시 전체 test/build/fresh Playwright/데스크톱 browser 검증/문서 갱신/전문가 검토를 수행하라.
사용자가 검수할 URL과 확인 순서를 먼저 제공하고 명시적 승인 전 commit/tag/push/deploy하지 마라.
모바일, 서버, native editable Excel chart, 원본 데이터 편집, smoothing/normalization/Ct/Cq를 추가하지 마라.
```

### Phase S0. Baseline 고정과 복구 지점 준비

#### 목표

현재 미커밋 Quick Paste 및 후속 변경을 잃지 않고 감사 보완 전 상태를 언제든 재현할 수 있게 한다.

#### 작업

1. `git status --short`, 현재 branch, HEAD, remote, Pages workflow 상태를 기록한다.
2. 현재 변경 파일을 기능, 문서, 생성 산출물로 분류한다.
3. `npm run test`, `npm run build`, `npm run test:e2e`, `npm audit --omit=dev`를 다시 실행한다.
4. production preview의 데스크톱 기준 screenshot과 console/network 상태를 보관한다.
5. baseline commit/tag 후보와 포함 파일을 사용자에게 보고한다.
6. 현재 공개 기준 `9e77ad2`를 last-published rollback SHA로 기록한다.
7. 사용자 승인 후에만 자동 배포되지 않는 `codex/` remediation branch에서 baseline commit과 annotated tag를 만든다. 추천 이름은 구현 시점 날짜를 반영하되 사용자가 다른 이름을 요청하면 따른다.

#### 금지

- 승인 전 stage/commit/tag/push/deploy
- 미커밋 파일 삭제, reset, checkout, clean
- 감사 보완 코드와 baseline 고정을 한 commit에 혼합

#### 완료 조건

- 현재 상태와 검증 결과가 `DEVELOPMENT_STATE.md`에 기록되어 있다.
- 복구 기준점 생성 여부가 명시되어 있다.
- baseline commit/tag 승인이 거절되거나 기준점 생성이 실패하면 S1 이후 구현을 시작하지 않고 중단한다.

#### 구현 프롬프트

```text
docs/12_AUDIT_REMEDIATION_IMPLEMENTATION_PLAN_KR.md Phase S0만 진행하라.
현재 dirty working tree를 보존하고 status/HEAD/remote/검증 결과를 기록하라.
test, build, fresh Playwright, npm audit, 데스크톱 browser smoke를 수행하라.
baseline commit/tag의 정확한 포함 범위와 자동 배포되지 않는 codex/ remediation branch 이름을 보고하되, 사용자의 명시적 승인 전에는 branch/stage/commit/tag/push/deploy하지 마라.
다른 Phase의 제품 코드는 수정하지 마라.
```

### Phase S1. 고정 fixture, 회귀 증거, CURRENT TRUTH

#### 목표

감사에서 재현된 결함을 synthetic data로 고정하여 수정 전후 결과를 객관적으로 비교한다.

#### 작업

1. 실제 사용자/회사 데이터를 사용하지 않는 synthetic fixture를 만든다.
2. 실제 BIFF `.xls`와 OOXML `.xlsx`를 모두 포함한다.
3. 다음 fixture와 normalized snapshot을 추가한다.
   - `001`/날짜/과학표기/앞뒤 공백/특수문자 header
   - 빈 specimen, 빈 reagent, 둘 다 빈 header
   - 빈/비숫자/formula/cache 없음/병합 header
   - 서로 다른 cycle 수, duplicate/similar label, multi-source append
   - shared-prefix의 긴 Analysis label과 같은 표시 문자열 충돌
   - 매우 작은 Y 범위와 invalid Fixed/P1/P2
   - Quick Paste wide/tall/worst-shape
   - Analysis XLSX schema/relationship/payload 오류
4. format-sensitive binary fixture에는 SHA-256 manifest를 두고, warning localized message가 아니라 warning code/source location을 snapshot 기준으로 사용한다.
5. `Audit finding → FR/IO → Decision → AC → fixture → automated test/manual owner → release evidence` 형식의 추적표를 만든다.
6. raster export의 크기, 흰 배경, nonblank pixel, label collision을 검사할 test helper를 준비한다.
7. 최소 CI gate로 test, build, fresh Chromium Playwright와 실패 screenshot/trace artifact를 연결한다. `dist`는 한 번만 build하고 hash를 기록하며 Playwright와 이후 배포가 같은 artifact를 사용한다. Pages 권한·network guard·release promotion은 S10에서 완료한다.
8. `DEVELOPMENT_STATE.md` 상단에 한 페이지 이내 `CURRENT TRUTH`를 추가하고 오래된 실행 로그와 구분한다.

#### 검증

- fixture에 민감한 실험명, 시약명, 환자/검체 정보가 없다.
- binary fixture가 source control에서 재현 가능하다.
- snapshot은 raw fluorescence 순서와 `null` 위치를 명시한다.
- 현 결함을 보여주는 test는 정규 suite를 깨지 않는 명시적 `todo` 또는 별도 defect-signature audit command로 격리한다. 별도 command는 전제조건과 현재 결함의 정확한 signature가 모두 일치할 때만 green으로 종료하고 known-red 증거를 artifact로 기록한다. 이 green은 결함 수정이나 수용기준 통과를 뜻하지 않는다.

#### 완료 조건

- 이후 S2~S9가 같은 fixture를 재사용한다.
- 감사 finding과 test/fixture의 대응표가 생기고 AC-PCR-045~052B, RQ-CI-001 및 AC-QP-021 문구가 제품 변경 전에 `Target / Known red`로 `docs/04_TEST_PLAN_ACCEPTANCE_EN.md`에 고정된다.
- test count 숫자를 문서에 하드코딩하지 않고 command 결과로 기록한다.

#### 구현 프롬프트

```text
docs/12_AUDIT_REMEDIATION_IMPLEMENTATION_PLAN_KR.md Phase S1만 진행하라.
사용자 데이터를 재사용하지 말고 synthetic .xls/.xlsx/paste/Analysis XLSX fixture와 normalized snapshot을 추가하라.
C-P1-01~06, shared-prefix legend, formula-safe label, async tab, semantic restore를 재현할 수 있는 evidence를 준비하라.
제품 동작은 아직 바꾸지 말고, 수정 전 실패 test는 todo 또는 정확한 current defect signature를 검증하는 별도 audit job으로 격리하여 정규 suite를 green으로 유지하라. audit job의 green은 결함이 재현됐다는 뜻이며 제품 수용으로 기록하지 마라.
제안 수용기준을 Target / Known red로 docs/04에 고정하고 최소 CI에 test/build/fresh Chromium Playwright와 known-red·실패 artifact를 연결하라. dist는 한 번만 build하고 hash를 기록하며 Playwright 이후 전체 파일 manifest를 다시 산출해 추가·삭제·변경까지 비교하되 Pages 배포 정책은 바꾸지 마라.
DEVELOPMENT_STATE.md 상단 CURRENT TRUTH를 한 페이지 이내로 정리하라.
전체 test/build/fresh Playwright와 데스크톱 browser 확인 후 전문가 검토 결과를 기록하라.
현재 dirty tree를 보존하고 unresolved UD를 구현하지 말며 다음 Phase로 넘어가지 마라. stage/commit/tag/push/deploy하지 마라.
```

### Phase S2. 공통 수치 계산 안전성 및 Scale 정확성

#### 목표

대형 배열 계산의 stack overflow 기반을 먼저 제거하고, 화면이 Fixed/P1/P2라고 표시하면서 실제 chart/export가 Auto로 그려지는 상태를 제거한다.

#### 작업

1. parser, normalized stats, chart domain, merge, workbook 생성 경로의 `Math.min/max(...largeArray)`와 같은 unbounded spread를 모두 찾아 iterative finite reduction으로 교체한다.
2. scale 입력 draft와 마지막으로 적용된 valid scale을 분리하거나 동등한 불변조건을 둔다.
3. scale state를 `valid`, `incomplete`, `invalid-order`, `valid-no-data-overlap`으로 구분한다.
4. 입력 중 incomplete/invalid이면 마지막 valid scale을 chart에 유지한다. Plot export 차단은 현재 active mode의 invalid draft에만 적용하며, 사용하지 않는 P1/P2 draft 편집은 현재 chart/export를 막지 않는다.
5. invalid active scale 상태에서는 plot을 포함하는 PNG/JPEG/chart clipboard export만 차단하고 원인과 수정 위치를 표시한다. Legend-only 및 Analysis XLSX는 차단하지 않는다.
6. 데이터와 겹치지 않지만 `min < max`인 scale은 현재 동작을 유지하면서 명확히 경고한다. 허용·확인·차단의 최종 정책은 UD-15 결정 전 바꾸지 않는다.
7. Box zoom bounds에서 고정 3자리 반올림을 제거하고 값 크기에 맞는 유효숫자를 보존한다.
8. Previous scale stack과 Auto scale reset의 기존 규칙을 유지한다.
9. UI의 `Auto range`가 raw data domain인지 실제 axis display bounds인지 정확히 이름 붙인다.
10. Analysis XLSX는 scale preset draft와 마지막 applied mode/bounds를 구분해 저장·복원한다. persisted shape가 바뀌면 S2 안에서 schema version/migration/roundtrip까지 함께 완료한다.

#### 검증

- 작은 Y 범위, 음수, 지수표기, min=max, min>max, 한쪽 공란과 accepted-size 배열 계산을 포함한다.
- preview와 모든 image export의 실제 축 범위가 같다.
- plotted CSV와 Analysis XLSX는 scale 오류 때문에 원본 데이터를 변경하지 않는다.
- Box zoom 반복과 Previous scale 복귀가 정확하다.

#### 완료 조건

- C-P1-01 회귀 test가 통과한다.
- invalid 상태에서 silent Auto fallback이 없다.
- 사용자에게 어떤 export가 왜 차단되었는지 보인다.

#### 구현 프롬프트

```text
docs/12_AUDIT_REMEDIATION_IMPLEMENTATION_PLAN_KR.md Phase S2만 구현하라.
parser/stats/chart domain/workbook 경로의 unbounded large-array spread를 iterative finite reduction으로 먼저 교체하라.
invalid Fixed/P1/P2가 silent Auto로 그려지거나 export되지 않게 하고 마지막 valid scale을 유지하라.
현재 active mode의 invalid draft만 plot 포함 export를 차단하고, inactive P1/P2 draft 편집과 Legend-only/Analysis XLSX는 유지하라.
Analysis XLSX가 scale draft와 applied scale을 구분해 roundtrip하도록 하고 persisted shape가 바뀌면 S2에서 migration까지 완료하라.
valid하지만 data와 겹치지 않는 범위의 최종 정책은 확정하지 말고 현재 동작을 유지하면서 명확히 경고하라.
Box zoom의 작은 값 유효숫자와 Previous scale stack을 보존하라.
preview/PNG/JPEG/clipboard 축 parity와 invalid export 차단 test를 추가하라.
원본 fluorescence와 plotted CSV projection은 변경하지 마라.
테스트, build, fresh Playwright, 데스크톱 browser 검증, 문서 갱신과 전문가 검토를 완료하라.
현재 dirty tree를 보존하고 unresolved UD를 구현하지 말며 다음 Phase로 넘어가지 마라. stage/commit/tag/push/deploy하지 마라.
```

### Phase S3. Legend identity와 raster export fidelity

#### 목표

화면과 export에서 서로 다른 곡선이 같은 이름처럼 보이거나 line/marker style이 잘못 대응되는 문제를 막는다.

#### 작업

1. export legend의 고정 문자 수 자르기를 실제 text measurement 기반 layout으로 교체한다.
2. primary/secondary label 또는 최대 2줄 wrap으로 구분 suffix를 보존한다.
3. 줄임이 불가피하면 `...`를 표시하고 동일 출력 label collision을 export 전에 감지한다.
4. plot legend, legend-only, report legend, Excel rich clipboard가 같은 ordered legend projection을 사용하도록 확인한다.
5. solid/dashed/dotted와 none/circle/triangle/rect marker sample을 raster에서 구분 가능하게 한다.
6. Preview legend의 한 줄 ellipsis로 조건 suffix가 사라지지 않게 한다.
7. 매우 작은 export에서도 canvas 크기를 자동 변경하지 않는다. wrap/layout 후에도 legend identity collision이 남으면 legend를 포함하는 해당 export만 actionable error로 차단하고 Plot-only export는 유지한다. 자동 canvas 확대는 UD-18 전 도입하지 않는다.
8. collision 시 label을 자동 변경하지 않고 preview에서 영향받는 curve/source identity를 경고한다. S3는 pure legend projection/layout/raster validation만 수정하고 async message/counter/dirty bookkeeping은 S6까지 변경하지 않는다.

#### 검증

- 앞부분이 같고 끝의 lot/농도/온도만 다른 label을 사용한다.
- 한글, `/`, `｜`, 긴 영문, 같은 Analysis label, marker+점선을 포함한다.
- pixel/nonblank 검사뿐 아니라 각 legend row의 text/style bounds가 겹치지 않는지 검사한다.
- Windows Excel rich clipboard는 자동화 한계를 문서화하고 Chrome/Edge 수동 검수 항목을 유지한다.

#### 완료 조건

- C-P1-02, U-P2-06과 기존 legend style 회귀가 통과한다.
- legend order 이동 후 style은 같은 `curveId`에 남는다.
- export 결과에서 identity collision이 조용히 발생하지 않는다.

#### 구현 프롬프트

```text
docs/12_AUDIT_REMEDIATION_IMPLEMENTATION_PLAN_KR.md Phase S3만 구현하라.
export/preview legend의 curve identity를 실제 text measurement, bounded wrap, collision detection으로 보존하라.
shared-prefix label과 line/marker 조합 fixture로 plot+legend, legend-only, report legend, Excel rich clipboard projection을 검증하라.
legend order와 style 연결은 curveId 기준을 유지하라.
작은 이미지에서 wrap 후에도 identity collision이 남으면 canvas를 자동 확대하지 말고 legend 포함 export만 actionable error로 차단하라. Plot-only export는 유지하라.
영향 curve/source를 preview에 경고하되 label을 자동 변경하지 말고 async counter/message/dirty 처리는 S6 전 변경하지 마라.
테스트, raster 검증, build, fresh Playwright, 데스크톱 browser 확인, 문서와 전문가 검토를 완료하라.
현재 dirty tree를 보존하고 unresolved UD를 구현하지 말며 다음 Phase로 넘어가지 마라. stage/commit/tag/push/deploy하지 마라.
```

### Phase S4. Excel header identity와 공통 Warning Inspector

#### 목표

Excel에서 보이는 식별자를 보존하고, 어떤 cell이 어떻게 처리되었는지 앱 안에서 확인할 수 있게 한다.

#### 작업

1. SheetJS formatting API를 사용해 표시 label을 만들고 raw value, cell type, number format을 provenance로 보존한다.
2. `cell.w` 하나만 무조건 신뢰하지 않는다. formatted text와 raw value 차이는 기본적으로 provenance 정보로 기록하고, 빈 표시 label·표시 identity 충돌·모호한 변환처럼 식별 위험이 있을 때만 warning으로 승격한다.
3. warning model에 가능한 범위에서 다음을 표준화한다.
   - zero-to-many `sourceRefs`와 각 source의 instance ID/name/kind
   - worksheet, cell/range, source column
   - code/severity
   - raw/display value
   - 앱의 처리 결과: 유지, null/gap, 무시, 차단
   - 관련 `curveIds`
4. Excel import summary에 펼칠 수 있는 공통 Warning Inspector를 추가한다.
5. dataset-level warning의 `curveIds`를 경고 필터와 tree badge에 반영한다.
6. cell/header warning은 source instance + sheet + code + location으로 식별한다. location이 없는 duplicate/similar dataset warning은 merge 후 affected curve IDs/labels 기준으로 다시 계산하며 cross-source payload를 일반 dedupe하지 않는다.
7. cached formula value 사용 여부와 cache 없음 상태를 구분해 알린다.
8. 파일 signature/실제 형식 진단을 추가하되, 위장 `.xls`의 최종 허용/차단 정책은 사용자 결정 전 바꾸지 않는다.
9. warning severity와 import 차단 정책은 현재 동작을 유지한다. merged/non-text/nonnumeric/formula를 새로 차단하려면 UD-14/UD-16 확인 후 진행한다.
10. persisted header/warning provenance가 바뀌면 schema version, legacy migration, visible review sheet, serialization validation, old/new Analysis XLSX roundtrip을 S4 안에서 함께 완료한다.

#### 검증

- `001`, 날짜 형식, 과학표기, 공백, 특수문자, formula cache, 병합 cell fixture를 사용한다.
- append한 이름이 같은 workbook warning이 source별로 사라지지 않는다.
- 경고 이동은 해당 source/group을 펼치고 scroll/highlight하되 curve 선택·순서·style·dirty 상태를 변경하지 않는다.
- 원본 label과 Analysis label이 혼합되지 않는다.
- 이전 schema와 새 schema의 Analysis XLSX가 각각 명시된 migration 규칙대로 복원된다.

#### 완료 조건

- C-P1-03/04가 통과한다.
- warning 수뿐 아니라 위치와 처리 결과를 볼 수 있다.
- parser가 raw fluorescence를 변환하지 않는다.

#### 구현 프롬프트

```text
docs/12_AUDIT_REMEDIATION_IMPLEMENTATION_PLAN_KR.md Phase S4만 구현하라.
Excel 표시 header는 SheetJS formatting API로 보존하고 raw value/type/number format/formula text/cache provenance를 함께 유지하라.
Excel과 Quick Paste가 공유할 수 있는 Warning Inspector 모델을 만들고 source/sheet/cell/raw/handling/curveIds를 표시하라.
dataset-level warning도 경고 필터와 tree badge에서 찾을 수 있게 하라.
formula cached value는 경고와 provenance를 남기되 사용자 결정 없이 일괄 차단하지 마라.
확장자와 실제 signature 불일치는 진단만 추가하고 최종 허용 정책은 바꾸지 마라.
persisted provenance shape가 바뀌면 schema version/legacy migration/visible sheet/serialization/old-new roundtrip을 이 Phase에서 함께 완료하라.
fixture, test, build, fresh Playwright, 데스크톱 browser 검증, 문서와 전문가 검토를 완료하라.
현재 dirty tree를 보존하고 unresolved UD를 구현하지 말며 다음 Phase로 넘어가지 마라. stage/commit/tag/push/deploy하지 마라.
```

### Phase S5. Quick Paste 안전성 및 controlled error boundary

#### 목표

현재 허용되는 paste 크기와 모양에서 stack overflow나 화면 전체 crash가 발생하지 않게 한다.

#### 작업

1. S2에서 제거한 large-array spread가 Quick Paste parser/normalizer/preview 경로 전체에 적용되는지 확인한다.
2. 공통 iterative reducer를 재사용하고 Quick Paste 전용 중복 계산을 만들지 않는다.
3. 현재 문서화된 2,000,000-character 및 250,000-cell envelope 안의 유효한 tall/wide/empty-heavy worst-shape가 모두 preview를 완료하는지 test한다. 이 범위 안의 정상 입력을 controlled error로 거부하는 것은 성공으로 인정하지 않는다.
4. parser entry를 `try/catch`와 typed error result로 보호해 현재 분석 state를 유지한다.
5. Quick Paste dialog와 active-analysis workspace 단위 error boundary를 추가한다. 전역 app shell 전체를 덮지 않으며 오류 후에도 다른 분석 탭 전환·저장과 해당 화면 재시도가 가능해야 한다.
6. row/column/curve/cycle/cell 수와 예상 메모리를 preview summary에 표시한다.
7. 새로운 hard cap 수치는 정하지 않고 측정 결과와 권장 범위를 사용자 결정 항목으로 보고한다.

#### 검증

- accepted-size input이 stack overflow 없이 preview된다.
- 거부된 입력은 active analysis selection/style/scale/order를 변경하지 않는다.
- stale preview, tab close/replace, specimen mode 변경 방어가 유지된다.
- 같은 수치가 Excel import와 paste에서 동일 normalized point가 된다.
- Quick Paste 또는 한 분석 workspace 오류 후에도 다른 탭 전환·Analysis XLSX 저장·재시도가 가능하다.

#### 완료 조건

- C-P1-06 회귀가 통과한다.
- 제한 밖 또는 예기치 않은 parser 오류가 controlled message로 끝나고 분석 state가 보존된다. 현재 지원 범위 안의 유효한 입력은 정상 완료된다.
- hard limit 수치가 근거 없이 추가되지 않는다.

#### 구현 프롬프트

```text
docs/12_AUDIT_REMEDIATION_IMPLEMENTATION_PLAN_KR.md Phase S5만 구현하라.
Quick Paste와 공통 range 계산에서 large array spread를 iterative 계산으로 교체하라.
현재 2,000,000-character 및 250,000-cell 제한 안의 유효한 wide/tall/worst-shape 입력이 모두 preview를 완료하는 회귀 test를 추가하라. 범위 안 정상 입력의 controlled failure를 통과로 인정하지 마라.
parser typed error와 app error boundary로 현재 분석을 보존하라.
row/column/curve/cycle/cell 요약은 표시하되 새로운 hard limit 수치는 사용자 승인 없이 정하지 마라.
원본 데이터 편집, smoothing, 보정, custom cycle 입력을 추가하지 마라.
테스트, build, fresh Playwright, 데스크톱 browser 검증, 문서와 전문가 검토를 완료하라.
현재 dirty tree를 보존하고 unresolved UD를 구현하지 말며 다음 Phase로 넘어가지 마라. stage/commit/tag/push/deploy하지 마라.
```

### Phase S6. 저장 연속성과 비동기 작업의 탭 격리

#### 목표

브라우저 새로고침/닫기와 탭 전환 중 저장·export 완료가 분석 상태를 잃거나 다른 탭을 변경하지 않게 한다.

#### 작업

1. dirty 분석이 하나라도 있으면 `beforeunload` 보호를 건다.
2. 상단에 `분석 저장` command와 마지막 저장 시각/이후 변경 여부를 표시한다.
3. 입력 command를 `원본 데이터 열기`, `Excel 추가`, `저장한 분석 열기`, `빠른 붙여넣기`로 목적별 분리한다.
4. Analysis XLSX가 전체 imported/unselected/hidden data를 포함하는 복원 파일임을 버튼 주변에 상시 표시한다.
5. 위 command와 상태는 새 상단 band를 만들지 않고 기존 분석/가져오기 행 안에서 재배치한다. import 후 설명은 compact 처리해 첫 plot 위치를 더 아래로 밀지 않는다.
6. export/clipboard 시작 시 target analysis instance ID, revision, export counter를 capture한다.
7. 동일 analysis에서 병행 export가 같은 파일 번호를 쓰지 않도록 per-analysis job을 직렬화하거나 충돌 없는 counter reservation을 사용한다.
8. 완료 규칙을 다음과 같이 고정한다.
   - 닫히거나 교체된 runtime instance: 어떤 live state도 변경하지 않는다.
   - 같은 runtime, revision 변경, 일반 image/clipboard export 성공: 시작 탭의 성공 message/counter만 갱신하고 dirty는 그대로 둔다.
   - Analysis XLSX 저장 중 revision 변경: snapshot 다운로드는 유효하지만 clean 전환하지 않고 `마지막 저장 snapshot 시각 / 이후 변경 있음`으로 표시한다.
   - 실패 또는 clipboard 실패: counter를 소비하지 않고 시작 탭에만 오류를 표시한다.
9. 자동 localStorage/IndexedDB 복구는 추가하지 않는다.

#### 검증

- 분석 A에서 export 시작 후 B로 전환/닫기/같은 이름 탭 재생성 시 오염이 없다.
- save 중 A를 수정하면 A가 clean으로 잘못 바뀌지 않는다.
- 여러 dirty tab에서 refresh/close 경고가 작동한다.
- 모든 분석이 clean이면 `beforeunload` handler가 설치되지 않는다.
- `저장 중 → 저장 snapshot 완료 → 이후 변경 있음 → 저장 실패` 상태 전이와 병행 export counter 충돌 방지를 test한다.
- 기존 dirty close/replace modal의 선택은 유지된다.

#### 완료 조건

- C-P1-05, C-P2-06, D040 회귀가 통과한다.
- 저장과 report export가 UI에서 구분된다.
- 자동 영구 저장이 도입되지 않는다.

#### 구현 프롬프트

```text
docs/12_AUDIT_REMEDIATION_IMPLEMENTATION_PLAN_KR.md Phase S6만 구현하라.
dirty analysis의 beforeunload 보호와 상단 분석 저장 command를 추가하라.
원본 데이터 열기, Excel 추가, 저장한 분석 열기, 빠른 붙여넣기를 목적별로 명확히 구분하라.
모든 async export/clipboard/save 완료는 시작 시 capture한 analysis instance/revision에만 반영하라.
일반 export 성공, Analysis XLSX 저장, 실패, 닫힌 runtime, revision 변경, 병행 counter의 상태표를 구현하고 race test를 추가하라.
Analysis XLSX가 전체 imported dataset과 설정을 포함한다는 설명을 상시 표시하라.
자동 localStorage/IndexedDB 복구는 추가하지 마라.
race test, test/build/fresh Playwright, 데스크톱 browser 검증, 문서와 전문가 검토를 완료하라.
현재 dirty tree를 보존하고 unresolved UD를 구현하지 말며 다음 Phase로 넘어가지 마라. stage/commit/tag/push/deploy하지 마라.
```

### Phase S7. Analysis XLSX 의미 검증, payload 계측, CSV 안전성

#### 목표

구조만 맞지만 내부 관계가 모순인 Analysis XLSX를 복원하지 않고, 대형 저장/복원 규모를 사용자 결정에 필요한 수치로 계측한다.

#### 작업

1. restore payload의 다음 관계를 검증한다.
   - curve X/Y 길이와 cycle count
   - finite/null point 정책
   - specimen/reagent membership
   - sourceFiles와 curve provenance
   - selected/order/override ID 참조
   - stats와 실제 point의 재계산 일치
2. S4에서 확정된 schema version과 legacy migration을 그대로 사용해 semantic validation을 적용한다. S7에서 provenance shape를 다시 바꾸지 않는다.
3. 복원 검증은 새 state를 commit하기 전에 끝내며 실패 시 현재 분석을 유지한다.
4. export/import 전에 curve/point/source/file bytes/chunk count/joined JSON size와 예상 workbook 크기를 요약한다.
5. 거대한 JSON/string/allocation 또는 worksheet 생성 전 계측 가능한 구조로 바꾼다.
6. exact hard payload limit와 경고/확인/차단 동작은 UD-02 전 확정하지 않는다. S7A는 계측과 semantic validation까지만 완료하며 대형 allocation 위험이 닫혔다고 보고하지 않는다. UD-02 결정 후 S7B에서 실제 preflight guard를 완료한다.
7. plotted CSV header가 `=`, `+`, `-`, `@`로 시작할 때 spreadsheet formula로 실행되지 않게 한다.
   - 이 escaping은 CSV 출력에만 적용하고 source/Analysis label 및 Analysis XLSX 값은 변경하지 않는다.
8. source별 cycle 수와 생성 규칙 `Cycle 1..N`을 review summary에 기록한다.
9. 새로운 Cycle 0/시간 X축/offset 보정은 추가하지 않는다.

#### 검증

- 손상 chunk, orphan ID, 잘못된 stats, 길이 불일치, source 불일치, huge payload를 포함한다.
- unselected curves와 mixed Excel/paste provenance가 roundtrip된다.
- ordinary workbook과 Analysis XLSX가 혼동되지 않는다.
- CSV를 Excel에서 열어도 조건명이 formula로 실행되지 않는다.

#### 완료 조건

- C-P2-01/03/05가 통과한다.
- 모순 payload가 부분 복원되지 않는다.
- 사용자가 저장 파일의 포함 범위를 이해할 수 있다.
- UD-02가 미결이면 대형 payload hard guard는 잔여 위험으로 명시되고 S7A 완료만 선언한다.

#### 구현 프롬프트

```text
docs/12_AUDIT_REMEDIATION_IMPLEMENTATION_PLAN_KR.md Phase S7만 구현하라.
S4에서 고정한 schema version/legacy migration을 소비하고 provenance shape를 다시 변경하지 마라.
Analysis XLSX restore에 curve/entity/source/order/override/stats 관계 semantic validation을 추가하고 state commit 전에 검증하라.
대형 JSON parse/worksheet 생성 전에 file bytes/chunk/joined JSON/curve/point/source를 계측하라. hard limit과 경고/확인/차단 동작은 사용자 승인 없이 확정하지 말고 S7A 잔여 위험으로 기록하라.
plotted CSV header의 =,+,-,@ formula 해석을 방지하라.
source별 cycle count와 Cycle 1..N 규칙은 기록하되 새로운 X축 규칙은 추가하지 마라.
full-dataset/unselected/mixed-source roundtrip과 malformed payload test를 보강하라.
test/build/fresh Playwright, workbook readback, 데스크톱 browser 검증, 문서와 전문가 검토를 완료하라.
현재 dirty tree를 보존하고 unresolved UD를 구현하지 말며 다음 Phase로 넘어가지 마라. stage/commit/tag/push/deploy하지 마라.
```

### Phase S8. 데스크톱 UI 결함과 분석 작업 밀도 보완

#### 목표

기능을 늘리지 않고 현재 데스크톱 작업면에서 곡선과 설정의 연결을 빠르게 파악할 수 있게 한다.

#### 작업

1. Legend `Order`/`Labels` inactive panel이 실제로 hidden되게 CSS 우선순위를 수정한다.
2. Style 개별 row에서 curve name을 우선 확보하고 color와 line+marker popover를 compact control로 유지한다. Style에서는 색상·선·마커만 편집하고 중복된 범례명/Analysis label 편집은 제거하여 Legend `Labels` 한 곳에서만 소유한다.
3. 현재 compact summary row interaction을 유지하고 S8에서 단일 확장/search-only/dialog 같은 새 편집 방식을 선택하지 않는다. 장기 편집 workflow는 UD-19로 분리한다.
4. Legend의 현재 사용자 순서와 keyboard 이동을 유지한다. 공통 검색, 맨 위/맨 아래, grouping 정렬은 UD-19 승인 전 추가하지 않는다.
5. 현재 3열 구조 안에서 sticky chart shell의 max-height/overflow를 viewport-aware하게 보정한다. plot/legend의 새로운 접기·분리 구조는 UD-19 전 추가하지 않는다.
6. `Clean`, `Unsaved`처럼 오해 가능한 상태어를 `저장됨`, `저장 안 됨`으로 바꾼다.
7. style signature collision과 흰 배경 대비 부족을 경고/보조하되 색상·선·마커를 자동 변경하지 않는다.
8. 상단 band 통합, 전면 한국어화, dialog/drawer 재설계는 별도 사용자 승인 전 제외한다.

#### 검증

- 5, 20, 100 imported curves에서 group/curve identity가 잘리지 않는지 본다.
- Legend tab 전환 시 inactive editor가 접근성 tree와 화면에서 모두 사라진다.
- keyboard focus와 icon tooltip이 유지된다.
- 1280x720, 1366x768, 1920x1080에서 overlap과 불필요한 horizontal scroll을 측정한다. UD-08 전에는 이를 공식 최소 지원 해상도로 선언하지 않는다.
- 각 viewport에서 설정을 끝까지 scroll한 뒤 plot bounding box와 workspace horizontal overflow를 수치로 기록하고 baseline보다 악화시키지 않는다.

#### 완료 조건

- U-P1-01과 직접적인 가독성 결함이 통과한다.
- 자동 style 변경 없이 collision 상태를 알 수 있다.
- 모바일 전용 CSS 작업을 추가하지 않는다.

#### 구현 프롬프트

```text
docs/12_AUDIT_REMEDIATION_IMPLEMENTATION_PLAN_KR.md Phase S8만 구현하라.
Legend inactive tab CSS 결함을 먼저 고치고 Playwright visibility regression을 추가하라.
개별 Style row는 curve name을 충분히 보이게 하면서 compact color/line+marker/reset control을 유지하라.
Style의 중복 Analysis label 편집을 제거하고 Legend Labels를 단일 소유자로 유지하라.
현재 3열/row interaction을 유지하면서 viewport-aware sticky plot 결함만 보정하라. 새 Legend 검색/정렬, row expansion, dialog/drawer는 UD-19 전 추가하지 마라.
저장 상태어는 분자진단 문맥에서 오해 없게 정리하라.
style collision은 경고/보조만 제공하고 사용자 color/line/marker를 자동 변경하지 마라.
대규모 page redesign과 모바일 최적화는 제외하라.
desktop screenshot, test/build/fresh Playwright, 접근성 smoke, 문서와 전문가 검토를 완료하라.
현재 dirty tree를 보존하고 unresolved UD를 구현하지 말며 다음 Phase로 넘어가지 마라. stage/commit/tag/push/deploy하지 마라.
```

### Phase S9. Hover·editor 성능 보완과 측정 기준 수립

#### 목표

실제 분석 곡선 수가 늘어도 hover와 설정 편집이 급격히 느려지지 않게 하되 근거 없는 성능 수치를 제품 제한으로 만들지 않는다.

#### 작업

1. hover pointer 처리에 animation-frame throttle을 적용한다.
2. 모든 point를 매 move마다 pixel 변환하지 않도록 nearest-X/index 계산을 분리한다.
3. readout 변경과 series style option 전체 재생성을 분리한다.
4. S8에서 확정된 interaction을 바꾸지 않고, 측정으로 병목이 확인된 Style/Legend row rendering에만 virtualization/memoization을 적용한다.
5. 20 curves x 100 cycles를 일반 분석 reference workload로, 100 x 100을 stress workload로 측정한다.
6. import, selection, hover, tab switch, export option build의 benchmark를 기록한다.
7. hard pass/fail budget은 사용자와 대표 파일을 확인하기 전 설정하지 않고 이전 baseline 대비 회귀 여부만 gate로 둔다.

#### 검증

- hover highlight와 marker가 변형되지 않는다.
- Box zoom active 중 hover가 억제되는 기존 규칙을 유지한다.
- 100곡선 editor가 browser를 멈추게 하지 않는다.
- 성능 개선 때문에 series order, labels, style resolution이 바뀌지 않는다.

#### 완료 조건

- C-P2-04 회귀가 기능·성능 양쪽에서 개선된다.
- 측정 script와 결과 형식이 재사용 가능하다.
- 정식 지원 한계 수치가 임의로 선언되지 않는다.

#### 구현 프롬프트

```text
docs/12_AUDIT_REMEDIATION_IMPLEMENTATION_PLAN_KR.md Phase S9만 구현하라.
hover를 animation-frame throttle하고 nearest-X/readout/highlight 계산을 분리하라.
S8의 interaction을 바꾸지 말고 측정으로 병목이 확인된 Style/Legend row rendering에만 virtualization/memoization을 적용하라.
20x100 reference와 100x100 stress synthetic workload를 재현 가능하게 측정하라.
hard 성능 목표나 제품 입력 제한은 사용자 승인 없이 만들지 말고 baseline 대비 회귀만 차단하라.
marker/style/order/Box zoom 동작이 변하지 않는 test와 browser profile을 남겨라.
test/build/fresh Playwright, 데스크톱 browser 검증, 문서와 전문가 검토를 완료하라.
현재 dirty tree를 보존하고 unresolved UD를 구현하지 말며 다음 Phase로 넘어가지 마라. stage/commit/tag/push/deploy하지 마라.
```

### Phase S10. CI, release, network, raster 품질 게이트

#### 목표

로컬에서는 통과하지만 Pages 배포나 fresh server에서 실패하는 회귀를 자동으로 막는다.

#### 작업

1. CI에 Chromium Playwright를 추가하고 매번 새 production preview server를 시작한다.
2. 기존 4173 server 재사용으로 stale build가 검증되지 않게 한다.
3. synthetic import부터 chart, scale, legend, Analysis XLSX까지 핵심 E2E를 CI에 포함한다.
4. canvas nonblank, raster white background, label/style bounds를 검사한다.
5. import/render/export/clipboard fallback/Analysis XLSX 중 app origin과 의도된 `blob:`/`data:` 외의 모든 cross-origin GET/POST/image/beacon/WebSocket 요청을 실패시키는 network allowlist guard를 추가한다.
6. GitHub Pages workflow permissions를 필요한 범위로 축소한다.
7. `git diff --check`, TypeScript, test, build, Playwright를 결정적 release gate로 정리한다. `npm audit --omit=dev --audit-level=high`는 high/critical을 차단하고, 외부 DB 변화나 승인된 예외는 근거·영향·만료일을 release evidence에 기록한다.
8. CSP와 SheetJS dependency vendoring은 호환성 영향이 없음을 증명할 수 있을 때만 적용하고, 아니면 후속 후보로 남긴다.
9. 현재 `main` push 자동 배포를 manual promotion/protected environment로 바꾸는 것은 UD-17 승인 전 확정하지 않는다. 어느 방식을 쓰든 동일한 검증 artifact만 배포되게 설계한다.

#### 검증

- GitHub Pages base path에서 asset/import/export가 동작한다.
- CI는 `dist`를 한 번 build하고 SHA-256을 기록하며 Playwright와 deploy가 정확히 같은 artifact를 검사·사용한다.
- clipboard는 권한 차이가 있으므로 자동 fallback과 Windows Chrome/Edge 수동 검수를 구분한다.
- failure artifact로 screenshot, trace, console을 보관한다.

#### 완료 조건

- 주요 browser regression이 Pages 배포 전에 검출된다.
- workflow가 불필요한 repository write 권한을 갖지 않는다.
- 민감 데이터 fixture가 CI artifact에 없다.

#### 구현 프롬프트

```text
docs/12_AUDIT_REMEDIATION_IMPLEMENTATION_PLAN_KR.md Phase S10만 구현하라.
CI에서 fresh production preview를 시작하고 Chromium Playwright 핵심 흐름을 실행하라.
stale 4173 server를 재사용하지 말고 GitHub Pages base path를 검증하라.
raster nonblank/background/legend bounds와 app origin + blob/data만 허용하는 전체 cross-origin network allowlist guard를 추가하라.
Pages workflow permission을 최소화하고 diff/type/test/build/e2e/audit gate를 정리하라.
CSP 또는 dependency vendoring은 호환성 근거가 없으면 적용하지 말고 후속 항목으로 남겨라.
CI artifact에 사용자 또는 민감 데이터가 들어가지 않게 하라.
문서와 전문가 검토를 완료하고 사용자 승인 전 push/deploy하지 마라.
현재 dirty tree를 보존하고 unresolved UD를 구현하지 말며 다음 Phase로 넘어가지 마라. 사용자 승인 전 stage/commit/tag/push/deploy하지 마라.
```

### Phase S11. 문서 동기화, 최종 재감사, release readiness

#### 목표

현재 구현과 문서가 같은 내용을 설명하도록 정리하고, 향후 context compression 후에도 다음 agent가 추측하지 않게 한다.

#### 작업

1. `README.md`를 현재 기능, 실행, 사용자 데이터 처리, 배포 방식 중심으로 갱신한다.
2. charter의 generic CSV/manual input 과거 범위를 현재 Excel+Quick Paste 범위와 구분한다.
3. requirements, I/O, acceptance criteria, decisions, changelog를 실제 구현과 동기화한다.
4. comma paste rejection, drag-and-drop, Quick Paste 상태 등 확인된 문서 drift를 수정한다.
5. 완료된 plan은 상태를 `Implemented`로 바꾸고 과거 상세 로그는 `docs/archive/` 이동 후보로 목록화한다. 실제 이동은 참조 링크 검증 후 수행한다.
6. `DEVELOPMENT_STATE.md`의 CURRENT TRUTH, known gaps, verification, exact next 3 tasks를 갱신한다.
7. 사용자 가이드의 screenshot과 troubleshooting을 synthetic data로 갱신한다.
8. 전체 자동 검증과 최소 4개 관점의 최종 전문가 재감사를 수행한다.
9. 사용자에게 release candidate URL, 검수 checklist, 미해결 사용자 결정 항목을 제공한다.
10. 사용자 승인 후에만 commit/push/GitHub Pages 배포를 수행한다.
11. 승인된 release의 candidate SHA/tag, `dist` SHA-256, workflow run, 배포 URL과 검증 시각을 기록한다.
12. 배포 후 public Pages에서 HTTP/asset base/import/render/export/browser-local network smoke를 수행하고 evidence를 보관한다.
13. rollback trigger를 import 실패, 빈 canvas, scale/export parity 실패, Analysis XLSX restore 실패, 예상하지 않은 외부 request로 명시한다.
14. rollback은 `main`을 강제 재작성하지 않고 last-known-good SHA를 revert/redeploy하는 절차로 문서화한다. 실제 rollback을 수행한 경우 rollback 후 public smoke도 남긴다.

#### 최종 수동 검수

- `.xls`, `.xlsx`, append, Quick Paste, Analysis XLSX restore
- Fixed/P1/P2/Box zoom/Previous/Auto
- long legend, style marker/line, label/order 변경
- PNG/JPEG/chart clipboard/legend clipboard/Excel rich clipboard/CSV
- multi-tab 저장, export 중 탭 전환, refresh/close
- Windows Chrome/Edge와 Microsoft Excel의 rich clipboard 붙여넣기

#### 완료 조건

- P1 finding이 모두 수정 또는 명시적 사용자 결정 대기 상태다.
- 문서에 오래된 기능 상태가 현재 truth처럼 남지 않는다.
- commit/push/deploy 범위와 rollback 방법이 사용자에게 제시된다.
- 실제 배포가 승인된 경우 candidate SHA/artifact hash/post-deploy evidence가 기록된다.

#### 구현 프롬프트

```text
docs/12_AUDIT_REMEDIATION_IMPLEMENTATION_PLAN_KR.md Phase S11만 진행하라.
README, charter, requirements, I/O, acceptance, decisions, changelog, DEVELOPMENT_STATE, 사용자 가이드를 실제 구현과 동기화하라.
과거 plan/archive 이동은 모든 참조 링크를 검증한 경우에만 수행하라.
전체 test/build/fresh Playwright/npm audit, 데스크톱 browser와 export/restore 수동 검수, 4개 관점 전문가 재감사를 수행하라.
release candidate URL과 사용자 검수 checklist, 남은 결정 항목, rollback 범위를 보고하라.
사용자의 명시적 승인 전에는 commit/push/deploy하지 마라. 승인 후에는 candidate SHA/tag, dist hash, workflow run과 post-deploy Pages smoke를 기록하고 last-known-good revert/redeploy 절차를 검증하라.
```

## 9. 사용자 결정 필요 항목

아래 항목은 이 문서에서 확정하지 않는다. 오른쪽의 안전한 임시 범위를 적용하면 P1 안정화는 먼저 진행할 수 있다.

| ID | 결정이 필요한 내용 | 왜 사용자 판단이 필요한가 | 결정 전 안전한 범위 | 필요한 시점 |
|---|---|---|---|---|
| UD-01 | 현재 dirty tree의 baseline commit/tag 생성 승인과 포함 범위 | 기존 구현을 공식 기준점으로 만들기 때문 | 검사·목록화만 하고 git 변경 금지 | S0 종료 전 |
| UD-02 | Excel/Quick Paste/Analysis XLSX의 hard 용량·curve·cycle 한계 | 실제 장비 파일 크기와 업무량을 알아야 함 | crash 제거, 사용량 표시, 측정만 수행 | S5/S7 hard block 도입 전 |
| UD-03 | row 3=Cycle 1 이외 source 지원 여부 | 장비/source의 X축 의미 문제 | 현재 `Cycle 1..N` 유지, source별 수만 표시 | 새 source 지원 전 |
| UD-04 | formula cached value의 허용·차단 정책 | 장비 export가 formula를 사용할 수 있음 | 사용 사실/위치 경고, 원본 provenance 유지 | S4 strict block 전 |
| UD-05 | HTML/CSV를 `.xls`로 저장한 파일의 허용 정책 | 일부 장비가 위장 Excel을 내보낼 수 있음 | signature 진단만 하고 현재 정책 유지 | S4/S7 차단 전 |
| UD-06 | IndexedDB/localStorage 자동 crash recovery | 저장 정책과 민감 데이터 잔존 문제 | `beforeunload` + 명시적 Analysis XLSX 저장만 | 별도 기능 승인 시 |
| UD-07 | style collision을 자동 재배정할지 여부 | 사용자가 정한 기본 색상 순서를 바꿀 수 있음 | 경고와 명시적 보조 action만 | S8 자동화 전 |
| UD-08 | 공식 최소 desktop 해상도와 상단/우측 panel 대규모 재배치 | 작업 습관과 모니터 환경에 영향 | 1280/1366/1920에서 적응형 보완만 | 대규모 redesign 전 |
| UD-09 | UI 전면 한국어화 범위 | Cycle/Fluorescence/Analysis XLSX 등 전문용어 선호 | 오해 가능한 저장 상태어만 우선 수정 | S8 이후 |
| UD-10 | Named View 도입 | 분석 반복 흐름을 바꾸고 restore schema가 늘어남 | 제외 | Stabilization 완료 후 |
| UD-11 | 선택형 Export Preflight와 figure metadata | export 단계와 보고서 형식을 바꿈 | 기존 export 유지, 오류만 차단/경고 | Stabilization 완료 후 |
| UD-12 | 설정 Undo/Redo | session state와 저장 범위가 확대됨 | 기존 1회 preset undo 유지 | Stabilization 완료 후 |
| UD-13 | 공개 GitHub Pages 유지 또는 접근제어 host 이전 | 앱 코드는 공개되고 URL 접근제어가 없음 | 데이터는 browser-local 유지, hosting 변경 안 함 | 조직 공유 정책 결정 시 |
| UD-14 | warning severity와 import 차단 기준 | merged header, nonnumeric, formula가 실제 장비 export에서 정상일 수도 있음 | 현재 warning-only/기존 차단 정책 유지, 위치와 처리만 명확화 | S4 정책 변경 전 |
| UD-15 | valid하지만 data와 겹치지 않는 scale의 export 정책 | 빈 범위가 의도인지 실수인지 업무 맥락이 필요함 | 현재 동작 유지 + 명확한 경고, invalid `min >= max`만 차단 | S2 정책 변경 전 |
| UD-16 | 숫자/날짜 형식 specimen·reagent header 허용 여부 | 장비 코드가 숫자형일 수 있음 | Excel 표시 text 보존 + raw provenance + warning | S4 strict rejection 전 |
| UD-17 | `main` 자동 배포 유지 또는 수동 release promotion | 팀의 배포 속도와 승인 책임이 달라짐 | 동일 artifact 검증과 rollback 준비만, trigger 정책 유지 | S10 workflow trigger 변경 전 |
| UD-18 | legend collision 시 canvas 자동 확대 허용 여부 | 산출물 크기와 보고서 조립 방식이 바뀜 | 자동 확대 금지, legend 포함 export만 actionable error로 차단 | S3 자동 크기 변경 전 |
| UD-19 | Style/Legend 대량 편집 workflow | 단일 확장, 검색, group 정렬, drawer는 작업 습관을 바꿈 | 현재 compact row·keyboard order 유지, 결함/성능만 보완 | S8 기능 확장 전 |

### 현재 바로 질문할 필요가 없는 이유

- S2~S6의 핵심 P1 수정은 기존 결정 안에서 수행할 수 있다.
- UD-02~19는 해당 gate 전 안전하게 제외하거나 warning-only로 구현할 수 있다.
- 다만 실제 구현을 시작할 때 S0의 git baseline을 만들려면 UD-01에 대한 명시적 승인이 필요하다.

## 10. 조건부 후속 Workflow 계획

아래는 Stabilization 완료 후 사용자 승인 시 별도 계획으로 분리한다. 이번 S0~S11 실행 범위에는 포함하지 않는다.

1. Named View: curve IDs, order, scale, style, Analysis labels의 이름 있는 비교 구성을 Analysis XLSX에 저장
2. Optional Export Preflight: 곡선 수, scale, style collision, legend clipping, 산출물 포함 범위를 export 전에 선택적으로 확인
3. Optional Figure Metadata: Analysis name, source ID, scale mode를 export에만 선택 표시
4. Multi-step Setting Undo/Redo: 원본 데이터가 아닌 selection/order/scale/style/label만 session에서 복구

각 기능은 별도 schema migration, 수용기준, UI mockup, roundtrip test가 필요하다. 안정화 Phase와 섞지 않는다.

## 11. 전문가 검토 체크리스트

### 데이터 무결성·분자진단 관점

- Excel 표시 label과 raw value가 모두 추적되는가?
- fluorescence 순서, 값, gap이 import/export/restore에서 동일한가?
- formula, 빈 cell, 병합 header, 유사 label 처리가 명시되는가?
- 서로 다른 cycle 수를 앱이 보정하거나 늘이지 않는가?

### 시각화·산출물 관점

- Fixed/P1/P2/Box zoom 상태와 실제 축이 같은가?
- 긴 legend에서 조건 구분 suffix가 보존되는가?
- line/marker sample이 preview, PNG/JPEG, clipboard에서 일치하는가?
- 잘못된 상태를 export가 조용히 허용하지 않는가?

### Frontend·상태 관점

- async 완료가 시작 탭 instance/revision에만 반영되는가?
- invalid input과 restore가 현재 state를 부분 변경하지 않는가?
- broad store refactor 없이 경계가 명확해졌는가?
- error boundary가 오류를 숨기지 않고 복구 가능한 message를 주는가?

### Desktop UX 관점

- curve name을 보고 바로 style/label/order를 수정할 수 있는가?
- chart가 설정 scroll 중 계속 보이는가?
- Warning Inspector에서 source와 cell까지 찾을 수 있는가?
- 용어가 분석 상태와 오염/판독 의미를 혼동시키지 않는가?

### QA·Release 관점

- synthetic fixture만 사용했는가?
- test가 fresh production build를 검사하는가?
- raster, network, Analysis XLSX roundtrip을 검증하는가?
- user review 전 commit/deploy하지 않았는가?

## 12. 단계별 보고 형식

각 Phase 종료 보고서는 다음 형식을 사용한다.

1. 구현한 항목
2. 수정 파일
3. 데이터 무결성 확인 결과
4. 자동 테스트/build/Playwright 결과
5. 데스크톱 browser와 screenshot 확인 결과
6. 전문가 검토에서 발견·반영한 내용
7. 남은 위험과 사용자 결정 항목
8. 사용자 검수 URL과 확인 순서
9. commit/push/deploy 미실행 여부 또는 승인받아 실행한 정확한 범위

## 13. 완료 정의

이 보완 계획은 다음 조건을 모두 만족할 때 완료된다.

- 감사 보고서의 P1 항목이 모두 수정되고 회귀 test가 있다.
- P2 항목은 수정되었거나 사용자 결정 대기/후속 계획으로 명확히 분류된다.
- raw fluorescence와 source identity가 모든 input/export/restore 경로에서 보존된다.
- 데스크톱 주요 해상도에서 plot, legend, style, warning, export 흐름이 겹치지 않는다.
- CI가 fresh build의 핵심 browser 흐름을 검사한다.
- 현재 문서와 구현의 기능 범위가 일치한다.
- 사용자가 release candidate를 검수하고 commit/push/deploy 범위를 승인한다.

## 14. 작성 후 전문가 재감사 반영

초안 작성 후 데이터 무결성·Excel import, React/state/export, 데스크톱 scientific UX, QA/release/documentation의 네 관점에서 문서 자체를 다시 감사했다. 다음 보강을 최종안에 직접 반영했다.

1. 대형 배열 spread 제거를 Scale보다 먼저 수행하는 공통 기반으로 이동했다.
2. S0 baseline commit/tag가 없으면 구현을 시작하지 않도록 rollback gate를 강화했다.
3. format-sensitive `.xls/.xlsx` fixture, SHA-256 manifest, AC-to-evidence 추적표, early fresh Playwright CI를 S1에 추가했다.
4. scale의 active invalid draft와 inactive P1/P2 편집을 구분하고, draft/applied scale의 Analysis XLSX migration을 S2 안에서 원자적으로 처리하게 했다.
5. legend collision 시 label이나 canvas를 자동 변경하지 않고 legend-bearing output만 결정적으로 차단하게 했다.
6. Excel warning provenance 변경과 schema version/legacy migration/roundtrip을 S4 한 Phase에 묶었다.
7. Warning Inspector 이동이 selection/order/style/dirty를 변경하지 않게 했고 cell warning과 dataset warning의 dedupe 규칙을 분리했다.
8. 현재 2,000,000-character/250,000-cell Quick Paste 계약 안의 유효 입력은 반드시 preview를 완료하도록 수용기준을 강화했다.
9. async export/save의 runtime/revision/counter/dirty 상태표와 병행 counter 충돌 방지를 명시하고 refresh protection과 async attribution을 AC-PCR-049A/B로 분리했다.
10. UD-02 전에는 Analysis XLSX 대형 payload 위험이 해결됐다고 주장하지 않고 semantic validation과 계측만 S7A로 완료하게 했다.
11. Style의 중복 Analysis label 편집을 제거하고 Legend Labels를 단일 소유자로 정리했다.
12. S8의 새 editor workflow 선택을 UD-19로 분리하고 S9는 측정된 병목의 virtualization/memoization만 담당하게 했다.
13. network guard를 모든 비허용 cross-origin 요청으로 넓히고 한 번 build한 동일 `dist`의 hash/test/deploy 연속성을 추가했다.
14. 배포 후 Pages smoke, evidence, rollback trigger와 last-known-good revert/redeploy 절차를 S11에 추가했다.

재감사 후에도 남겨 둔 항목은 오류가 아니라 실제 사용자 결정이 필요한 UD-01~19다. 특히 UD-01은 구현 시작 전 필수이며, UD-02가 정해지지 않으면 대형 Excel/Analysis XLSX의 hard guard는 완료로 선언하지 않는다.
