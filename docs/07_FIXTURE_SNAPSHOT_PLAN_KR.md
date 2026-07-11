# 07 Synthetic Fixture 및 Snapshot 기준

## 문서 상태

- 상태: Active - Audit Remediation Phase S1
- 최종 갱신: 2026-07-11
- 기준 manifest: `tests/fixtures/manifest.json`
- 관련 계획: `docs/12_AUDIT_REMEDIATION_IMPLEMENTATION_PLAN_KR.md`

## 압축 안전 요약

- 모든 체크인 fixture는 독립적으로 생성한 synthetic label과 fluorescence 값만 사용한다.
- 실제 사용자 workbook, 실제 실험명·검체명·시약명·질환명·날짜형 식별자 또는 그 값을 변형한 자료를 fixture로 복사하지 않는다.
- 형식에 민감한 `.xlsx`/BIFF8 `.xls`만 binary로 체크인하고 SHA-256으로 고정한다.
- 대형 Quick Paste, 대량 curve, malformed Analysis XLSX 조합은 test에서 생성한다.
- 현재 결함은 정상 동작처럼 snapshot하지 않는다. `Target / Known red` snapshot과 현재 결함의 정확한 signature를 검증하는 격리 audit probe로 기록한다.
- `importedAtIso`, random `sourceInstanceId`, 현지화 message는 normalized snapshot 비교에서 제외한다.

## 1. 고정 Binary Fixture

실제 파일 목록과 hash는 `tests/fixtures/manifest.json`이 권위 원본이다.

| ID | 형식 | 목적 | 상태 |
|---|---|---|---|
| FX-001 | OOXML `.xlsx` | `001`, 날짜, 과학표기, 공백, 한글/특수문자 header 표시 identity와 provenance target | Known red - S4 |
| FX-002 | OOXML `.xlsx` | synthetic 한국어/특수문자 label, 음수 포함 raw fluorescence parity | Passing |
| FX-003 | BIFF8 `.xls` | FX-002와 같은 normalized 결과 및 실제 compound signature | Passing |
| FX-004 | OOXML `.xlsx` | 빈 header, nonnumeric, no-cache formula, merged header의 code/location/null gap | Partial passing; provenance target은 S4 |
| FX-005 | OOXML `.xlsx` | first worksheet only와 ignored worksheet warning | Passing |
| FX-006 | OOXML `.xlsx` | suffix만 다른 shared-prefix legend identity | Known red - S3 |
| FX-007 | OOXML `.xlsx` | 0 근처 tiny/negative fluorescence scale precision | Known red - S2 |

FX-006과 FX-007은 Excel container 자체가 핵심은 아니므로 S3/S2 구현 시 code-generated normalized fixture로 이동할 수 있다. 이동 전 manifest와 traceability link를 함께 갱신한다.

## 2. Manifest 계약

Manifest는 다음 정보를 포함한다.

- `schemaVersion`
- generator path, producer, producer version
- `dataPolicy.syntheticOnly`
- fixture ID와 logical case ID
- source path, expected snapshot path
- 실제 형식과 extension
- byte length, 첫 8바이트 magic, SHA-256
- worksheet 이름
- `active`, `active-partial`, `known-red` 상태
- 연결된 AC/audit finding과 fixture 목적

Magic 기준:

- OOXML `.xlsx`: ZIP signature `504b0304...`
- BIFF8 `.xls`: compound signature `d0cf11e0a1b11ae1`

## 3. Normalized Snapshot 계약

Passing snapshot은 가능한 범위에서 다음을 고정한다.

- fixture ID와 parse result
- source file name, actual format, sheet names, used/ignored sheet
- dataset schema/source kind/sheet index/cycle count/ordered curve IDs
- curve ID, source ID, specimen/reagent entity ID
- 원본 specimen/reagent label과 display label
- 전체 `x[]`, `y[]`, `null` 위치
- point/missing/min/max stats
- source sheet/column/header cell/data range
- curve warnings와 dataset warnings의 code/severity/scope/location/raw evidence
- specimen/reagent entity membership

제외 항목:

- import 시각
- random runtime/source instance token
- 번역 가능한 warning message
- browser tab ID와 dirty/transient UI state

## 4. Header Target Snapshot

FX-001의 target은 각 header에 다음을 요구한다.

- source cell
- Excel display text
- raw type와 raw value
- number format
- formula text 또는 `null`

S1에서는 이 target을 현재 parser output으로 덮어쓰지 않는다. S4가 formatted display label과 raw provenance를 구현한 뒤 target을 passing snapshot으로 승격한다.

## 5. Warning Snapshot

FX-004는 S1에서 다음을 passing evidence로 고정한다.

- stable warning code
- applicable source cell/range
- affected curve ID
- 전체 Y 배열과 `null` 위치

source instance, source name, handling outcome, cross-source dedupe는 AC-PCR-048의 known-red 범위이며 S4 전에는 passing으로 표시하지 않는다.

## 6. Generated Fixture

Binary로 체크인하지 않고 test에서 생성한다.

### Quick Paste

- reproduced known-red: 150,000-cell tall single-column input
- supported boundary tall: 250,000 x 1 cells including headers
- supported boundary wide: 3 x 83,333 cells
- supported boundary balanced: 500 x 500 cells
- character-over-limit
- cell-over-limit
- empty-heavy and nonnumeric warning pagination

실제 browser OOM처럼 process가 복구할 수 없는 실패를 controlled error로 보장하지 않는다. 문서상 제한 밖 입력과 catch 가능한 parser 오류만 mutation 없이 거부해야 한다.

### Chart/Legend/Scale

- shared-prefix와 동일 최종 표시 문자열
- tiny, negative, exponent scale bounds
- 20 x 100 reference와 100 x 100 stress dataset
- line/marker/color signature collision

### Analysis XLSX

- curve X/Y 길이 불일치
- stats 불일치
- orphan selection/order/override ID
- entity/source membership 불일치
- chunk 누락·중복·손상
- payload 계측용 generated full dataset

## 7. Known-red 증거

정규 suite는 항상 green이어야 한다.

```powershell
npm run test
```

현재 재현되는 감사 결함은 별도 명령에서 정확한 defect signature assertion으로 실행한다. parser 성공 같은 전제조건은 먼저 통과해야 하며, 엉뚱한 예외를 known-red 성공으로 인정하지 않는다.

```powershell
npm run test:audit:red
```

이 명령이 green이라는 의미는 결함이 수정됐다는 뜻이 아니라, 명시한 known-red signature가 현재 정확히 재현된다는 뜻이다. 해당 Phase에서 결함을 수정하면 defect-signature assertion을 정상 target acceptance test로 전환하고 traceability 상태를 갱신한다.

## 8. 재생성 및 검토

```powershell
node tests/fixtures/generateFixtures.mjs
npm run test -- --run tests/data/parseExcel.fixture.test.ts
```

재생성 전후 hash가 달라지면 다음을 검토한다.

1. generator code와 SheetJS version 변화
2. workbook magic과 worksheet 구조
3. label/fluorescence가 synthetic-only인지
4. expected projection 변경 이유
5. 연결된 AC와 known-red 상태

검토 없이 manifest hash만 갱신하지 않는다.

## 9. 증거 연결

감사 finding, FR/IO/Decision, AC, fixture, automated/manual owner, evidence 상태는 `docs/13_AUDIT_REMEDIATION_TRACEABILITY.md`에서 관리한다.
