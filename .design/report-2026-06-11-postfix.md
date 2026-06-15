# GODITOR Design Audit — 사후검증 RUN (2026-06-11, post-FIX)

design-squad v3.3.1 정식 RUN. 대상 = HEAD `a7ad40b`(전 FIX 커밋된 상태). **method=static**(CDP는 ux-squad RUN 점유 → 렌더확정 보류, a11y-contrast는 별도). report-only. 차원 4개(adoption/css-health/states/color+component) 정적 에이전트 + 중앙 2층 검증.

---

## 0. 헤드라인 — FIX 안착 확인 + 시스템 건강 지표

| 지표 | 값 | 판정 |
|---|---|---|
| **danger 토큰화** | 4방식 → `--ui-danger-bg` fill-alpha 1정석 | ✅ **안착 confirmed** |
| **malformed(깨진 선언)** | `var(--ui-border)322` → **0** | ✅ FIX 확인 |
| **broken 참조** | **0** (오탐가드 후) | ✅ clean |
| **focus-visible 보강** | cv-chip·prop-align-btn·prop-slider 추가 → 12/14 보유 | ✅ 안착 |
| **표준 채택률(D-adoption)** | **80.3%** (759/945) | 🟢 업계 첫해 60~70% 상회 |
| **토큰 coverage(D-css-health)** | **14.8%** (1343/9087) | 🔴 낮음 — 이관 부채 |

→ **직전 FIX는 전부 안착했고 회귀 0.** 남은 건 대부분 **알려진 이관 부채 + 신규 발견(adoption/states)**.

---

## 1. 사후검증 — 직전 FIX 결과 (전부 confirmed)
- **danger**: prop-action-btn.danger / layer-variation·variant-del / tpl-delete·preview-close / file-page-del / tb-card-del / cpmt-close 전부 `var(--ui-danger*)` 토큰화. fill-alpha 단일 정석 수렴(매트릭스 4방식→1).
- **무결성**: `var(--ui-border)322` 깨진 선언 수정 확인(malformed 0, 회귀 0). focus-visible 셀렉터 3개 추가 안착.
- **간격/상태**: "전체 적용"→primary, export radius 5→4, disabled `--ui-disabled-opacity` 7곳 적용 확인.

## 2. 신규/잔존 발견 (severity·adjudication)

### 🔴 major (verify-candidate / central 판정)
- **bare 컨트롤 93** (D-adoption, deterministic, **central-confirmed**) — class 속성 자체 없는 컨트롤: button 38·text 20·select 10·range 8·number 8·textarea 9. prop 패널 내부에서 형제는 `.prop-number`/`.prop-slider` 쓰는데 일부만 클래스 누락 = 동일 컴포넌트 비일관 채택. ※전용클래스 61은 별개(suspected, case-by-case).
- **파랑 난립 31회** (D-color, deterministic, **central-confirmed**, FIX 범위 밖) — 정본 `--ui-accent-primary` 두고 #6b9eff×11·#6fa3f7×4·#6a9fd8·#3d7ff8×3 등 우회. **root_cause: token-dualization**.
- **comp-shelf 패널 ~215줄 2중정의** (D-css-health, deterministic) — editor-extra.css 975·1369, 31셀렉터 중복.

### 🟡 major→minor (central-refuted 하향)
- **aria-pressed 불일치** (D-states) — cv-chip 마크업 O ↔ `[aria-pressed]` CSS 0. **단 pressed는 평행 `class=active`로 시각표시됨** → "완전 무표시" 아님 → **major→minor 하향**(ARIA 자체 훅 없는 완전성 nuance). CDP 실측 시 동시전환 확인 권장.
- **slider thumb 포커스 모호** (D-states) — `.prop-slider:focus-visible`가 박스 outline만, ::thumb glow 부재 → static으론 미확정, **verify-candidate 유지**(CDP 보류).

### minor·nit (cleanup)
- dead 토큰 68 (design-tokens.css 의미·팔레트층 — root_cause: token-dualization) + pending 6(신설 마이그레이션 대기, dead 아님) + set-only 14(--preset-* JS write).
- disabled 미완(7/14, tb-btn/zoom-btn 등 :disabled 부재), loading/skeleton 축 전무.
- 남은 raw danger 5곳(토큰값 동일, 무손실 치환 가능), radius raw 372회·19종 + shadow 74 (이관부채, pending 토큰 소비처).
- !important 114(editor-blocks 55 집중), 거대파일 3개(editor-blocks 77KB 등).

## 3. root-cause 머지 (교차 차원)
| root_cause | 묶인 차원 | 수정 1건으로 해소 |
|---|---|---|
| **token-dualization** | css-health(dead 68) + color(파랑 31) | design-tokens 의미층 → `--ui-*` 정본화/alias + 파랑 통일 |
| **dimension-token-pending** (진행중) | component(radius 372·shadow 74) | 신설 `--ui-btn-h/radius` 이관 진행(FIX PR-4 대기 = 정상) |

## 4. 영역 결산 (침묵 금지) / 오탐가드 작동 기록
- **오탐가드 실증**: ① scan-D가 신설 `--ui-btn-h` 등을 dead로 오분류 → color+component 에이전트가 "pending, 무시" 정정. ② broken 20건(--tbl-*/--inv-zoom 등)은 JS setProperty 동적주입 → 가드#2로 전량 오탐 제외(broken 0). ③ bare 84 vs 전용클래스 61 분리(합산 금지) → 신뢰 유지. ④ keyframe/@media 중복 제외.
- **a11y-contrast**: CDP 점유로 미실행(이번 세션 초반 수동 render-confirm 有 — text-dim/muted AA 통과 기확인). CDP 풀리면 보강.

## 5. 우선 수정 Top (이번 RUN)
1. **token-dualization 정본화** (dead 68 + 파랑 31 동시해소) — major
2. **bare 93 → 표준 클래스 흡수** (D-adoption, prop패널 형제 비일관 우선) — major
3. **comp-shelf 215줄 2중정의 제거** — major
4. 남은 raw danger 5 → 토큰(무손실), aria-pressed CSS 훅, slider thumb 포커스
5. radius/shadow 이관(진행중 PR-4)

> 결과 JSON: `.design/results/design-{adoption,css-health,states,color-component}.json`. report-only, 코드 미수정.
