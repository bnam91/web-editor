---
project: /Users/a1/web-editor
app_name: GODITOR (상페마법사 웹에디터)
type: css-vars            # CSS 커스텀 프로퍼티 토큰 시스템
playbook: playbooks/css-vars.md
entry: index.html (Electron, main.js / name=sangpe-editor)
cdp_port: 9334            # GoyaDesignEditor 0.5.0 — 9335는 죽어있음
notion_db: 329111a5-7788-8021-9027-deea1f33dd18   # Design Squad 투두 DB
results_dir: .design/results
git_head: 1afbe91

# ── HTML 리포트가 <link>할 앱 CSS (경로는 .design/html/ 기준 상대 — report-html.mjs용) ──
# 이걸 선언하면 HTML 뷰에서 컴포넌트가 앱과 동일하게 실물 렌더됨(이 앱 리포트 최대 강점).
app_css:
  - ../../css/design-tokens.css
  - ../../css/editor-base.css
  - ../../css/editor-props.css
  - ../../css/editor-blocks.css

# ── 기준값 (숫자로 박음 — 기준 없는 감사는 취향 감사) ──
grid_unit: 4              # --space-0..6 = 2/4/8/12/16/24/32
radius_scale: [4, 6, 10]  # --radius-sm/md/lg
contrast_standard: AA     # WCAG 4.5:1 텍스트 / 3:1 UI·대형텍스트
ui_font: Pretendard       # assets/fonts/pretendard.css (UI 크롬)
content_font: 'Noto Sans KR'  # --preset-*-family (캔버스 결과물)

# ── 활성 차원 (v3.3.1 — adoption 신설, css-health/states 강화 method) ──
active_dimensions: [color, typo, component, spacing, states, icon, motion, a11y-contrast, css-health, adoption]
# D-responsive 비활성: 데스크톱 전용 Electron, 의미있는 @media 브레이크포인트 0개.
# css-health=def↔use 그래프(dead/broken/malformed/중복), states=요소×상태 커버리지+aria대조, adoption=타입열거→비채택(bare 2분류).
---

# GODITOR Design Audit 명세 (design-squad v3.3.1)

## ⭐ 정본 토큰 (GATE 기준 — 신규 UI는 반드시 이걸 사용. 2026-06-11/12 FIX 반영)
editor-base.css :root에 신설·확정된 표준. 새 컴포넌트는 raw px/hex 금지, 아래 토큰 사용:
- **색**: `--ui-accent-primary` #2d6fe8(파랑 정본 — #6fa3f7/#6cf/#6a9fd8 등 우회 폐기), `--ui-danger{,-bg,-border,-hover}`(삭제 = fill-alpha 정석), `--ui-text-dim/muted` #969696/#9e9e9e(AA 통과값), `--ui-divider` #555(비텍스트 보더/장식점)
- **치수**: `--ui-btn-h`24 · `--ui-input-h`24 · `--ui-radius-sm/md/lg`4/6/10 · `--ui-form-label-w`56 · `--ui-row-gap`4 · `--ui-pad-panel`8 · `--ui-disabled-opacity`0.5
- **컴포넌트 표준**: 슬라이더행 = `.prop-slider` + `.prop-number`(편집가능). 위험버튼 = `.prop-action-btn.danger`(블록) / `.prop-btn.prop-btn-danger`(항목✕). focus = 공용 `:focus-visible` 규칙.

## FIX 반영 현황 (커밋 a7ad40b + 미커밋)
✅ 저대비 AA / danger 토큰화(4방식→1) / 헤더아이콘 16px / 슬라이더행 표준화 / focus-visible 공용규칙 / malformed(var(--ui-border)322) 수정 / disabled opacity 통일
🔵 진행대기(report-only): token-dualization 정본화(dead 68 + 파랑 31), comp-shelf 215줄 2중정의 제거, radius/shadow 이관(372 raw — pending 토큰 소비), bare 컨트롤 84 표준클래스 흡수


## 앱 개요
바닐라 JS ES모듈 + Electron 상세페이지 에디터. **다크 UI 크롬**(에디터 셸)이 **라이트 캔버스 콘텐츠**(사용자가 만드는 상세페이지)를 편집한다. 이 둘의 디자인 기준이 다르다 — UI 크롬은 토큰 강제, 캔버스 콘텐츠는 사용자 편집값이라 **불가침**.

## 스타일 표면 (16개 CSS, 10,944줄)
| 파일 | 줄 | 역할 | 위험 |
|------|----|------|------|
| design-tokens.css | 195 | 토큰 정의 (primitive→semantic 2단) | ⚠️ 의미토큰 미사용 (아래) |
| editor-base.css | 757 | `--ui-*`/`--preset-*` 토큰 + 셸 베이스 | **실사용 토큰 소스** |
| **editor-blocks.css** | **2219** | 캔버스 블록 스타일 | 거대파일 + !important 55개 |
| editor-panels.css | 1756 | 사이드/레이어 패널 | !important 13 |
| editor-extra.css | 1688 | 모달·드롭다운·기타 | 352 raw hex 후보(props+panels+extra) |
| editor-props.css | 822 | prop 패널 (47개 prop-*.js 대응) | prop-align-group 핫스팟 |
| editor-layout.css | 558 | 레이아웃 그리드 | |
| claude-pm.css | 625 | PM 패널 | !important 9 |
| color-picker / assets-panel / ai-image / editor-canvas / editor-graph / editor-toast / settings-modal / editor.css | — | 보조 표면 | |
| presets/ | — | default/dark/brand/minimal.json 프리셋 | 캔버스 콘텐츠 (불가침) |

## 🔴 핵심 구조 사실 (RUN 시 차원 에이전트에 주입)
1. **두 개의 병렬 토큰 체계가 공존한다.**
   - `design-tokens.css`: `--p-*`(primitive) → `--color-/--bg-/--text-/--space-/--radius-`(semantic). **2단 계층, 잘 설계됨. 그러나 실사용 9회.**
   - `editor-base.css`: `--ui-*`(877회 실사용) + `--preset-*`(캔버스 프리셋). **이게 실제로 도는 시스템.**
   - 같은 값이 두 이름으로 존재: `--bg-app`=`--ui-bg-app`=#1a1a1a, `--color-danger`=`--ui-danger`=#e06c6c …
   - → **D-color/D-css-health 1순위**: 의미 토큰 체계가 aspirational(미이관). "하드코딩 hex"보다 "토큰 체계 이원화"가 더 큰 이탈. 단 *per-line* 폭주 금지 — 구조 발견 1건으로 묶을 것.
2. **px 리터럴 3078개** (design-tokens.css:182 주석 명시) — 4/8/6/10/12 군집 + 5·11·3 난립. **알려진 점진 이관 부채**. D-spacing은 per-instance 버그로 올리지 말고 "그리드 비배수 군집 K건"으로 그룹핑 + 캡(차원당 15).
3. **!important 109개** (editor-blocks 55 집중). D-css-health 대상이나 캔버스 블록은 zoom/inline-style 오버라이드 경합이라 일부는 의도.

## ⚠️ 알려진 의도된 디자인 예외 (Scan 단계 즉시 제외)
- **캔버스 콘텐츠(블록 내부 디자인)** = 사용자 편집값. `--preset-*` hex, 블록 내부 px, 캔버스 텍스트 색은 **이탈로 올리지 마라.** UI 크롬만 감사 대상. (design-tokens.css:182 명시)
- **`--preset-*`/`--p-*` 토큰 *정의부*의 raw hex** = 토큰 소스. 정의부는 제외, *정의부 밖* 사용만 후보.
- **px 리터럴 3078개 점진 이관** = 부채로 인지됨. 개별 라인 버그 금지, 군집 그룹핑만.
- **xterm.css / pretendard.css / vendor/** = 서드파티. 불가침.
- **editor-blocks.css의 zoom 관련 !important** (`--inv-zoom`, `--sel-outline-w` 경합) = 줌 스케일 오버라이드 의도.
- **DEF-01~03 금일 수정분** (history/block-drag/editor/layer-panel/save-load 등) = 코드 수정이지 디자인 표면 아님. CSS 변경분만 디자인 대상.
- **pm Claude-blue `#6b9eff`(11회)** = AI/PM 영역 의도적 식별색(claude-pm.css 주석 "AI 보라와 의도 구분"). 파랑 정본화 시 폐기 X → `--ui-pm-accent`로 토큰화 예정. 이탈로 올리지 마라.
- **pending 토큰 ≠ dead** (`--ui-btn-h`/`--ui-input-h`/`--ui-radius-*` 등 신설·소비처 0) = 마이그레이션 대기. dead로 올리지 마라(오탐가드#3).
- **tfx-intensity/grain %슬라이더** = 표준 prop-row 아닌 별개 "%효과 슬라이더" 컴포넌트(커스텀 레이아웃+% 접미사). 표준 슬라이더행(.prop-slider+.prop-number) 미준수가 정상.
- **JS 런타임 set 토큰**(`--tbl-*`=block-factory.js, `--inv-zoom`/`--ui-scale`=zoom, `--color-${name}` 동적) = CSS 정의 없어도 broken 아님(오탐가드#2).

## 🔴 필수 준수 규칙 (위반 = major, v2 아카이브에서 이관)
prop 패널 작성 규칙 — D-component/D-css-health가 체크:
- `prop-align-group`이 **정렬만** 담당 → `prop-section` 직속 (full-width 균등분할). `prop-row`로 감싸면 shrink-fit 좁아짐 = **금지**.
- 위험 버튼(제거/삭제/초기화) → 반드시 `danger` class (`secondary` 금지). `--ui-danger`/`--color-danger` 사용.
- prop 파일은 `propPanel.querySelectorAll` (document 전역 금지) — 이건 코드 규칙이라 debug-squad 영역, 디자인은 시각 결과만.
- 동일 기능 UI(정렬버튼 등)는 Section 패널과 너비·높이 일치.

## 활성 차원 메모
- **D-color**: --ui-* vs --color-* 이원화가 1순위. 정의부 밖 raw hex(352 후보). 프리셋 4종(default/dark/brand/minimal) 토큰 키 누락 대조.
- **D-typo**: UI=Pretendard, 캔버스=Noto Sans KR. font-size px 직접 vs 스케일. 텍스트 블록 6종.
- **D-component**: radius 4/6/10 이탈, box-shadow 분산, border. prop 버튼 통일성.
- **D-spacing**: 4px 그리드. 부채 인지 → 그룹핑+캡 필수.
- **D-states**: hover/focus-visible/disabled. `outline:none` 후 대체 focus 없으면 → a11y로 승격.
- **D-icon**: --icon-layer-size 14px / --icon-prop-size 16px 토큰 있음. 혼합 아이콘셋/크기 이탈.
- **D-motion**: transition raw ms, `transition:all` 과다, prefers-reduced-motion 부재.
- **D-a11y-contrast**: 다크 UI. CDP 실측으로 confirmed 승격 가능. --text-dim(#555)/--ui-text-dim 대비 주의.
- **D-css-health**: editor-blocks 2219줄, 토큰 이원화, !important 109, dead 셀렉터, 중복 정의.
