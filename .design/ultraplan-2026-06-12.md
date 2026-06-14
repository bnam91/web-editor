# GODITOR Design Squad — ULTRA-PLAN (무결손 커버리지 맵)

> 기준선=HEAD `eb8c390` (슬라이더행 표준화 + 무결성/focus 보강 직후). 본 문서는 **감사 실행이 아니라 설계** — 지난 RUN(report-postfix)·MATRIX(report-matrix)의 사각을 메우는 영역×차원 커버리지 맵 + escape 역분류 + CALIBRATE/redteam 슬롯 + 스폰 분해.
> **목표 바: Photoshop/Figma급.** 헷갈리면 "Figma라면 이걸 raw로 뒀을까?" 기준으로 판정.
> 핵심 교훈: 지난 RUN은 **"class가 있으면 채택"으로 통과**시켰는데, escape들은 전부 **class는 있고 inline style/raw hex로 토큰을 우회**한 케이스였다. → adoption의 정의를 "class 보유"에서 **"표준 토큰/규칙까지 따랐는가"**로 좁혀야 한다.

---

## 0. 지난 2 RUN의 구조적 사각 (왜 escape가 샜나 — 1줄 요약)

| 사각 | 정체 |
|---|---|
| **adoption이 class만 봤다** | `.prop-btn-danger`/`.st-btn` 클래스가 붙어 있으면 adopted로 카운트 → 그 안의 `style="padding:3px 6px"` raw hex `#5a8ab8`는 안 봄. **"class 보유 ≠ 표준 준수"** 미분리. |
| **inline style 축이 차원에 없다** | D-css-health는 `style="` grep 시그니처를 갖고 있으나 지난 RUN은 *CSS 파일*만 스윕 → JS 템플릿리터럴의 inline style이 통째로 사각. |
| **행(row) 단위 시그니처가 없다** | MATRIX 시그니처는 button/input *개별*만. "슬라이더 한 줄"이 span/슬라이더/숫자입력/색hex를 **나란히 정렬**했을 때의 일관성(높이·baseline·gap)은 어느 셀에도 없음. |
| **MATRIX 13영역이 "정적 위젯"만** | 컨텍스트메뉴·툴팁·드롭인디케이터·스크롤바·룰러·로딩·빈상태 등 **동적/임시 표면**은 영역 행 자체가 없었다(렌더 트리거가 필요해 정적 grep에 안 뜸). |

---

## 1. 영역 재분해 — 기존 13 + 누락 발굴 N개

### 1-A. 기존 13영역 (유지, selectors prefix)
graph `.gr-*` / pickers `.goya-cp-*`,`.font-item*` / prop-panel `.prop-*` / canvas-block `.cvb-*`,`.section-*` / design-system `:root`,`.ui-*` / toast `.toast*`,`.gy-toast*` / template-browser `.tpl-*`,`.comp-shelf-*` / modals `.modal*`,`.settings-*`,`.figma-*`,`.bcm-*` / left-panel `.layer-*`,`.file-page-*`,`.proj-tab-*`,`.side-*`,`.st-*` / pm-panel `.cpm-*` / assets-ai `.assets-*`,`.aig-*`,`.ai-*` / toolbar `.tb-*`,`.zoom-*`,`.topbar` / home-pages `.home-*`,`.license-*`,`.start-*`

### 1-B. 누락 영역 발굴 — **신규 8영역** (이번 ULTRA의 핵심 추가)

| # | 신규 영역 | selectors / 트리거 | 왜 빠졌나 | Figma 기준 |
|---|---|---|---|---|
| **N1** | **context-menu (우클릭/⋯메뉴)** | `.ctx-menu`,`.section-branch-menu`,`.*-menu`,`openSectionBranchMenu` | 우클릭/호출 시에만 DOM 생성 → 정적 grep 누락 | 메뉴 항목 height/hover/구분선/단축키정렬 = 프로 척도 |
| **N2** | **tooltip (title/커스텀툴팁)** | `[title]` 전수 + `.tooltip*`,`.tip-*` | native `title`은 CSS 없음 → 차원에 안 뜸. 커스텀 툴팁 유무·일관성 미검사 | native title 남발 = "안 만든 티". Figma는 커스텀 툴팁 |
| **N3** | **scrollbar (커스텀 스크롤바)** | `::-webkit-scrollbar*` | pseudo-element, MATRIX 위젯셋에 없음. comp-shelf만 정의(중복3) | 패널마다 스크롤바 다른 폭/색 = 촌스러움 1순위 |
| **N4** | **drag-ghost / drop-indicator** | `.*-drag-ghost`,`.*--dragging`,`.todo-pin--dragging`,`.tab-drop`,`.ck-add-pin*`,`.drop-line` | 드래그 중에만 렌더. `--color-tab-drop` dead인데 드롭표시 없는지 미검증 | 드롭 인디케이터 일관성 = "만든 사람 실력" 직격 |
| **N5** | **ruler / guide / canvas-overlay** | `.ruler-*`,`.guide-*`,`.asset-overlay`,`.*-hitzone`,`--canvas-overlay` | 캔버스 크롬(콘텐츠 아님)인데 영역 정의가 콘텐츠로 오인 제외 | 룰러 눈금/가이드선 색·굵기 = Figma 정체성 |
| **N6** | **loading / skeleton / progress** | `.loading`,`.skeleton`,`.spinner`,`.progress*`,`@keyframes spin` | postfix가 "loading/skeleton 축 전무"라고 *기록만*. 영역 행 부재 | 빈 로딩 = 멈춘 듯한 인상. Figma는 스켈레톤 |
| **N7** | **empty-state (빈상태)** | `.*-empty`,`.comp-shelf-empty`,`.placeholder*`,체크보드 | 빈 패널 안내문구/아이콘 일관성 미검사 | 빈상태 디자인 = 프로/아마추어 가르는 선 |
| **N8** | **focus-order / kbd-affordance** | `tabindex`,`accesskey`,`[role]`,`outline:none` 잔존 | states가 focus-*visible* 유무만 봄. 포커스 *순서*·키보드 진입점은 미검사 | 키보드 only 조작 가능성 = 프로 툴 필수 |

→ **신규 8 + 기존 13 = 21영역.** N1–N5는 **CDP 렌더 트리거 필수**(정적 grep로 selector 존재는 확인하되 "실제로 표시되나/일관적이나"는 ux 직렬). N6–N8은 정적 우선 가능.

---

## 2. 영역 × 차원 커버리지 맵 (10차원 전부 활성)

범례: ◎=이번 신규/강화 진입 · ●=지난 RUN 정상검사 · ▲=**지난번 얇게 검사(보강 필요)** · ✕=해당없음 · ⬚=신규영역(첫검사)

| 영역 \ 차원 | color | typo | comp | spacing | states | icon | motion | a11y | css-health | **adoption** |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| graph | ● | ▲ | ● | ● | ▲ | ● | ▲ | ● | ● | ● |
| pickers | ● | ▲ | ● | ● | ● | ● | ▲ | ▲ | ● | ▲ |
| prop-panel | ● | ▲ | ● | ● | ● | ● | ▲ | ● | ● | **◎**(inline-style 보강) |
| canvas-block(크롬) | ● | ✕ | ● | ▲ | ● | ▲ | ▲ | ● | ● | ● |
| design-system | ● | ● | ● | ● | ● | ● | ▲ | ● | ● | ● |
| toast | ▲ | ▲ | ● | ● | ▲ | ▲ | ▲ | ▲ | ● | ▲ |
| template-browser | ● | ▲ | ● | ● | ● | ▲ | ▲ | ▲ | ● | ▲ |
| modals | ● | ▲ | ● | ● | ● | ▲ | ▲ | ▲ | ● | **◎**(inline-style) |
| left-panel | ● | ▲ | ● | ● | ● | ▲ | ▲ | ▲ | ● | **◎**(st-btn raw) |
| pm-panel | ● | ▲ | ● | ● | ● | ▲ | ▲ | ▲ | ● | ▲ |
| assets-ai | ● | ▲ | ● | ● | ▲ | ▲ | ▲ | ▲ | ● | ▲ |
| toolbar | ● | ▲ | ● | ● | ● | ▲ | ▲ | ▲ | ● | ▲ |
| home-pages | ● | ▲ | ● | ● | ▲ | ▲ | ▲ | ▲ | ● | ▲ |
| **N1 context-menu** | ⬚ | ⬚ | ⬚ | ⬚ | ⬚ | ⬚ | ⬚ | ⬚ | ⬚ | ⬚ |
| **N2 tooltip** | ⬚ | ⬚ | ⬚ | ⬚ | ⬚ | ✕ | ⬚ | ⬚ | ⬚ | ⬚ |
| **N3 scrollbar** | ⬚ | ✕ | ⬚ | ⬚ | ⬚(hover) | ✕ | ✕ | ⬚ | ⬚ | ✕ |
| **N4 drag/drop** | ⬚ | ✕ | ⬚ | ⬚ | ⬚ | ✕ | ⬚ | ✕ | ⬚ | ✕ |
| **N5 ruler/guide** | ⬚ | ⬚ | ⬚ | ⬚ | ✕ | ✕ | ✕ | ⬚ | ⬚ | ✕ |
| **N6 loading/skeleton** | ⬚ | ✕ | ⬚ | ⬚ | ⬚ | ✕ | ⬚ | ⬚ | ⬚ | ✕ |
| **N7 empty-state** | ⬚ | ⬚ | ⬚ | ⬚ | ✕ | ⬚ | ✕ | ⬚ | ⬚ | ✕ |
| **N8 focus-order** | ✕ | ✕ | ✕ | ✕ | ◎ | ✕ | ✕ | ◎ | ⬚ | ◎ |

### 2-A. ▲ "얇게 검사된 셀" 일괄 보강 지시 (지난 RUN 누락축)
- **typo 전 영역 ▲**: 지난 2 RUN 모두 typo 차원을 **돌리지 않음**(MATRIX 4정류장=comp/color/spacing/states, postfix=adoption/css-health/states/color+comp). → **typo는 21영역 전부 첫 풀스윕**. font-size px 직접·line-height·weight 산재·Pretendard 외 폰트 혼입.
- **motion 전 영역 ▲**: 마찬가지로 미실행. `transition:all` 과다·raw ms·`prefers-reduced-motion` 부재 전수.
- **icon ▲(8영역)**: `--icon-*` 토큰 dead 확인됨(scan-D). 실제 SVG width/height 직접지정·혼합셋·stroke-width 비일관 — graph/design-system 외 미검사.
- **a11y ▲(8영역)**: CDP 점유로 계속 보류. 이번엔 ux 직렬 후순위로라도 modals/toast/pm/assets/toolbar/home의 대비 **실측** 1회.

---

## 3. ESCAPE 역분류표 (필수 — 현빈이 눈으로 잡은 것)

> 각 escape: **어느 차원이 잡았어야 했나 / 왜 놓쳤나 / 이번 플랜 보장책.**

| # | escape (현빈 육안) | 잡았어야 할 차원 | 왜 놓쳤나 (근거) | 이번 보장책 |
|---|---|---|---|---|
| **E1** | **cv-chips `aria-pressed` 훅 부재** | **D-states (완전성)** | 잡긴 했으나 **major→minor 하향**(report-postfix §2: "class=active로 평행 시각표시되니 완전 무표시 아님"). 시각은 되는데 ARIA 훅이 없어 *스크린리더엔 안 보임* = a11y 결함인데 states가 시각 기준으로 봐서 강등. | states→**a11y로 cross-flag**. "마크업 O ↔ CSS O ↔ **AT 노출 X**"는 3축 매트릭스로. CDP에서 `getComputedStyle([aria-pressed])` + accessibility tree 동시 확인. |
| **E2** | **bare 슬라이더(`<input type=range style="flex:1">`)** | **D-adoption (적응)** | bare 8개로 **카운트는 됐다**(design-adoption: prop-chat.js:104/135/140/145). 그러나 **bare 93 묶음에 섞여 "이관부채"로 일반화** → Top 수정에서 우선순위 밀림. inline `style="flex:1"`이 표준 폭규칙 우회한 별개 결함인데 미분리. | adoption finding을 **영역별로 쪼개** prop-panel 형제 비일관(같은 파일 .prop-slider 옆 bare)은 **major 유지**, 흩어진 모달 입력은 minor. inline-style 우회를 별도 sub-finding. |
| **E3** | **'촌스러운' stb-del / st-branch(chain) 버튼** | **D-adoption + D-color + D-css-health** | **3중 사각.** ⓐ adoption: `class="prop-btn prop-btn-danger stb-del-btn"` 클래스 *있어서* adopted 통과. ⓑ 하지만 `style="padding:3px 6px;line-height:0"` inline + `st-branch-btn{color:#5a8ab8!important; background:#1a2840!important}`(panels.css:963) raw hex+!important. ⓒ JS 템플릿 inline style이라 CSS 파일 grep에 안 뜸. | **adoption 정의 강화**: "class 보유"에서 **"class + inline style 없음 + raw hex 없음"** 3조건 동시. JS 템플릿리터럴 `style="..."`도 D-css-health inline 스캔 대상에 **명시 포함**(js/**/*.js). `#5a8ab8`/`#1a2840`는 D-color 파랑난립에 추가(31→+2). |
| **E4** | **슬라이더행 비일관(span/color-hex/prop-number 혼재)** | **D-component (행 시그니처) + D-spacing (정렬)** | **차원에 "행(row) 단위 시그니처"가 아예 없었다.** MATRIX 시그니처는 button/input *개별 위젯*만(component.button.height 등). 한 줄에 라벨span·`.prop-slider`·`.prop-number`·`.prop-color-hex`가 **baseline/height/gap 안 맞게** 늘어선 건 셀이 없어 구조적 미검출. eb8c390이 "슬라이더행 표준화" 커밋이나 **검증 렌즈 없이 수동 정비** → 회귀 감지 불가. | **신규 sub-method "row-coherence"**(D-component): `.prop-row` 내부 자식들의 computed height·vertical-align·gap을 CDP로 실측해 **한 행 내 정렬 불일치** 적발. 표준=`.prop-slider`(h)·`.prop-number`(h)·`.prop-color-hex`(h) 3자 height 일치 + baseline 정렬. |

### 3-A. 역분류가 드러낸 격자 결함 (PROFILE 갱신 제안)
1. **adoption의 "adopted" 정의 결함** → 명세에 `adopted = class보유 ∧ inline-style없음 ∧ raw값없음`로 재정의(E2/E3 근원).
2. **inline-style 스캔이 CSS 파일에 갇힘** → D-css-health scope에 `js/**/*.js`의 템플릿리터럴 `style="` 명시 추가(E3 근원).
3. **행/그룹 단위 시그니처 부재** → MATRIX 시그니처 스키마에 `rowCoherence` 필드 신설(E4 근원).
4. **states가 시각만 보고 AT 노출 미확인** → states×a11y 교차 셀 상시화(E1 근원, Phase 2.5 교차패스로 흡수).

---

## 4. CALIBRATE 시드 계획 (신규 렌즈 미검증 → 시드 검출 확인)

> SKILL.md §CALIBRATE "신규 렌즈 검증 의무": adoption·css-health 그래프·states 커버리지는 **미검증 상태**. 이번 ULTRA에서 신설하는 row-coherence·inline-style·신규8영역도 미검증. 별도 워크트리에 시드 주입 → 답안지는 오케스트레이터만 보유.

| 시드 ID | 렌즈/축 | 주입 이탈 (워크트리 전용) | 검출 기대 차원 | 이게 0이면 |
|---|---|---|---|---|
| S1 | adoption 강화 | `.prop-number` 있는 input에 `style="padding:9px"` 추가 | D-adoption(inline 우회) | E3 재발 — 정의 강화 실패 |
| S2 | css-health inline | JS 템플릿에 `style="color:#abc"` 1줄 | D-css-health(js inline) | js 스캔 누락 |
| S3 | row-coherence | `.prop-row` 자식 하나 height 18px(표준 24) | D-component(행) | E4 재발 — 행 렌즈 고장 |
| S4 | states/AT | 버튼에 `aria-pressed` 추가하고 CSS·active 둘 다 제거 | D-states→a11y | E1 강등 재발 |
| S5 | scrollbar | 한 패널 `::-webkit-scrollbar` 폭 14px(타 8px) | N3 영역 | 신규영역 검출망 미작동 |
| S6 | context-menu | 메뉴 항목 hover 색 raw hex | N1 영역 | 동적표면 트리거 실패 |
| S7 | empty-state | 빈상태 안내문구 폰트 raw px | N7×typo | typo 첫스윕 검증 |
| S8 | tooltip | 커스텀툴팁 자리에 native `title`만 | N2 영역 | native-title 사각 |

답안지 사전검증(제3 에이전트): S1–S8이 profile.md "의도된 예외"(tfx %슬라이더·preset hex·pending토큰·pm Claude-blue 등)에 **안 걸리는** 진짜 이탈인지 확인 후 투입. **시드 워크트리는 종료 즉시 폐기, main 머지 금지.**

---

## 5. REDTEAM 슬롯 (현 격자가 구조적으로 못 보는 이탈 5유형 — 발굴 지시)

> 10th Man 규칙: 전 영역 clean이면 자동 발동. 발굴 슬롯(에이전트가 채움 — 본 문서는 빈 슬롯 + 시드 가설만):

1. **셀-사이 결함(STPA)**: 색OK·상태OK인데 **"hover 상태의 텍스트 대비"**가 미달(예: `.st-branch-btn:hover` background `#1a2840` 위 `--ui-accent` 텍스트 대비 — 어느 셀도 hover×a11y를 안 봄). → 교차패스 전담.
2. **줌/스케일 의존 이탈**: `--inv-zoom`/`--ui-scale`로 캔버스가 스케일될 때 크롬 요소가 **어긋나는** 비주얼(줌 50%/200%에서만 보임) — 정적 grep 불가, CDP 줌 트리거만.
3. **상태 조합 폭발**: disabled+hover, selected+focus, active+pressed **동시** 상태의 시각(개별 상태만 검사, 곱은 미검사).
4. **테마/프리셋 전환 잔상**: default→dark→brand 프리셋 전환 시 크롬 토큰이 **안 따라가는** 영역(프리셋은 캔버스용이나 일부 크롬이 `--preset-*` 잘못 참조하는지).
5. **밀도/긴텍스트 회복력**: 긴 한글 라벨·많은 항목 시 버튼/행이 **깨지거나 클리핑**(회복력은 qa트랙이나 *비주얼 깨짐*은 design — 경계 케이스).

산출물 = finding 아님, **격자 보강 제안 + 재검사 지시**(basis 의무 면제, 명세 편입은 승인 게이트).

---

## 6. 하네스 분해 (스폰 계획)

> 원칙: **정적 우선**(CDP는 ux와 직렬 — 9334 점유 가능성). 정적으로 최대치 뽑고 CDP 필요축은 `verify-candidate`로 남겨 ux 트랙 풀리면 1회 실측.

### Phase 0 — 셋업 (중앙, 얇게)
scope.mjs(diff HEAD 불필요 — 전수) + severity/등급/기준값/의도된예외 주입. 신규 8영역 selectors·트리거를 modules/*.md에 선기록.

### Phase 1 — 정적 차원 스윕 (병렬 N, run_in_background)
**배치 A (지난 RUN 미실행 축 — 최우선):**
- `D-typo` (21영역 전수, **첫 스윕**)
- `D-motion` (21영역 전수, **첫 스윕**)
- `D-icon` (▲8영역 보강 + --icon-* dead 확인)

**배치 B (escape 직격 — 강화 method):**
- `D-adoption+` (정의 강화: class∧no-inline∧no-raw, **JS 템플릿 inline 포함**) — E2/E3
- `D-css-health+` (scope에 `js/**/*.js` inline style 추가) — E3
- `D-component-row` (row-coherence sub-method, CDP 필요축은 verify-candidate) — E4

**배치 C (신규 영역 — 정적 가능분):**
- `D-newarea-static` (N6 loading / N7 empty / N8 focus-order — selector 존재·정적 일관성)

각 P-G-E = [Scan(grep+예외제외) → Grade(정적이므로 deterministic/pattern만, blocker·major는 verify-candidate)] — Measure(CDP)는 보류 표기.

### Phase 1.5 — MATRIX 행 재실행 (신규영역 시그니처)
신규 8영역은 **시그니처가 없으므로** 영역 에이전트 8 추가 스폰 → matrix-{N1..N8}.json. 기존 13은 재사용(eb8c390 반영 delta만).

### Phase 2 — 정류장 결산 + 교차패스
- 정류장 M: component/color/spacing/states + **신규 typo/motion/icon 결산** (영역 간 비교).
- **Phase 2.5 교차패스 에이전트 1**: redteam 슬롯 #1·#3(hover×a11y, 상태조합) — STPA 셀사이.
- **roof 점검**: row-coherence 표준(높이 24)이 input-height 표준과 충돌 없는지.

### Phase 3 — CDP 실측 (ux 트랙 풀린 후, 직렬 1회)
verify-candidate 일괄: N1–N5 동적표면 트리거(우클릭/드래그/스크롤/줌) + a11y 대비 실측 + row-coherence computed height + E1 accessibility tree. **9334 점유 확인 후 진입**, 점유 중이면 정적 결과만으로 report(method:static 명시).

### Phase 4 — redteam(10th man) + 취합 + HTML
redteam 5유형 발굴 → 취합(root-cause 머지: token-dualization/inline-style-bypass/row-incoherence) → report-2026-06-12.md + report-html.mjs.

### 스폰 수 요약
Phase1: **7 에이전트**(배치 A 3 + B 3 + C 1, 전부 정적·병렬) · Phase1.5: **8**(신규영역 시그니처) · Phase2: **7 정류장 + 1 교차** · Phase3: **CDP 직렬 1**(ux 후) · Phase4: **redteam 1 + 중앙**. → 정적 최대 24, CDP는 단일 직렬로 격리.

---

## 7. 산출물 / 게이트
- 본 설계: 이 파일. **실행 RUN 산출**(다음 단계): `.design/results/design-{typo,motion,icon,adoption,css-health,component-row,newarea}.json` + `matrix-{N1..N8}.json` + `calibration-2026-06-12.json` + `report-2026-06-12.md`.
- PROFILE 갱신 제안 4건(§3-A)·신규 8영역 modules·adoption 정의 강화는 **사용자 승인 게이트**.
