# GODITOR Design Audit — prop-panels 영역 집중 RUN (2026-06-11)

design-squad v3.0 **모듈 집중 RUN**. 모듈: `prop-panels` (`.design/modules/prop-panels.md`).
핵심 질문: **"블록별 prop 패널들이 서로 일관적인가"** — 동일 기능 UI(삭제·저장·정렬·행·간격)의 크기·계층·스타일 정합.
전체 차원 스윕(report-2026-06-11.md)이 못 본 **영역 내부 깊이 비교**. report-only — **수정 없음**(FIX 승인범위는 기존 저대비 2건뿐).
CDP 9334 렌더 실측(computed style)으로 2층 검증. 스폰 단위 = 공용 위젯 횡단(위젯정합/구조·규칙/간격) 3에이전트.

---

## A. 총평

**결론: 패널의 "뼈대"는 일관, "액션 버튼"이 갈린다.**

- ✅ **기본 위젯은 통일됨**(렌더 확정): 정렬/타입/스타일 버튼·select·number 입력이 전 패널 **24px 높이·#2a2a2a 배경·#969696 텍스트**로 일치. 토글(32×18)·헤더 구조(name+id)·섹션 패딩도 일관.
- ✅ **v2 회귀 치유 확인**(구조 규칙1 PASS): 과거 Banner/Card가 정렬그룹을 `.prop-row`로 감싸 너비 어긋났던 문제 → **현재 위반 0**. 정렬전용 그룹은 전부 `.prop-section` 직속.
- 🔴 **액션 버튼이 패널마다 정반대**(렌더 확정): 같은 "삭제"가 **솔리드 빨강 채움 vs 네이티브 폴백**, 같은 "저장/실행"이 **회색 vs 파랑**. 사용자가 패널을 바꿀 때마다 같은 동작 버튼이 다른 모양.
- 🟡 **행 간격 리듬 분산**(정적): row gap 4 vs 6px, 이중 마진 6/12px 혼재.

**위험도: 중(MEDIUM).** 기능은 동작하나, 같은 기능 버튼의 시각 분기는 사용자 신뢰·학습성을 깎는다.

| 차원/에이전트 | 확정 | 의심 | major | minor | nit |
|---|---|---|---|---|---|
| 위젯정합 (component) | 2 | 5 | 3 | 3 | 1 |
| 구조·규칙 (css-health) | 0 | 4 | 1 | 1 | 1 |
| 간격·레이아웃 (spacing) | 0 | 4 | 3 | 1 | 0 |
| **합계** | **2** | 13 | 7 | 5 | 2 |

`by_adjudication`: central-confirmed 2(렌더), self 다수. **규칙1(정렬계층)은 PASS로 명시 — 발견 아님.**

---

## B. 확정 문제 (렌더 실측 — computed style)

### 🔴 B1. "삭제" 위험 버튼 — 두 정반대 스타일 공존 [major, confirmed]
| 클래스 | 렌더(computed) | 쓰는 패널 |
|--------|---------------|----------|
| `.prop-action-btn.danger` | **솔리드 빨강 채움** bg #c0392b · 흰글씨 · radius 4px · 24px · 11px | section/asset/sticker/frame/icon-circle/laurel |
| `.prop-btn-danger` | **배경 미정의→네이티브 폴백** bg #efefef · outset border #6b2e2e · radius **0px** · 13.3px | chat/step/comparison/banner02 |

→ `.prop-btn-danger`는 border-color·color만 지정하고 **배경/radius/폰트 리셋이 없어** 브라우저 기본 버튼처럼 렌더(밝은 회색·각진 모서리). 같은 "삭제"가 패널 따라 빨강 채움 또는 회색 네이티브. **fix 방향: 위험버튼 단일 표준(`.prop-action-btn.danger`)으로 통일.**
추가(구조 PPS-01): `prop-frame.js`는 "이미지 제거"를 danger 토큰도 아닌 **raw hex**(#3a2a2a/#e06c6c)로, prop-canvas/prop-simple-card는 `color:#e55` raw로 또 다르게 그림.

### 🔴 B2. 풀폭 액션 버튼 — 3계열·2색 난립 [major, confirmed]
| 클래스 | 렌더 | 쓰는 패널 |
|--------|------|----------|
| `.prop-btn-full` | 다크그레이 bg #1a1a1a · #ccc · radius 4px | chat/iconify/text/mockup/label-group/graph |
| `.prop-action-btn.primary` | **파랑 채움** #2d6fe8 · 흰 · radius 4px | asset/section/sticker/frame/icon-circle/laurel |
| `.prop-export-btn` | 파랑 #2d6fe8 · 흰 · radius **5px** · padding 5px | page/section |

→ "저장/적용/내보내기"류 주요 액션이 패널마다 회색·파랑으로 갈리고, 파랑 둘도 radius 4 vs 5로 미세 분기. **fix: primary 액션 1표준.**

---

## C. 의심 문제 (정적 — trace)

### C1. blockHeader 공용 빌더 부재 [widget / major]
`_helpers.js`엔 `bindSlider`뿐. **26개 패널이 `.prop-block-label`+`-icon` 헤더를 각자 재구현** → 헤더 아이콘 SVG가 다수 12px인데 표준 참조인 prop-section/prop-page는 16px, gradient 14px로 갈림. 공용 `buildBlockHeader()` 부재가 근본.

### C2. 행 간격 리듬 분산 [spacing / major]
- `.prop-row` gap: 표준 4px인데 **인라인 6px가 14건**(iconify/frame/mockup/table=6px, comparison/banner02=4px).
- 수직 리듬을 표준 `margin-bottom:6px` 대신 **인라인 `margin-top:6px`(13건)** 로 구현 → 합산되어 **12px 이중 마진** 발생, 패널별 6 vs 12 분산.

### C3. 반복-아이템 카드 갈림 [spacing / major]
표준 `.prop-line-card`/`.prop-cell-card`를 laurel만 사용 · chat은 인라인 8px · step `.stb-prop-item`은 **CSS 미정의(간격 0)** · table/comparison/label-group 무패딩 → 같은 "리스트 아이템" 역할이 8/0/무패딩으로 갈림.

### C4. bindSlider 표준 미채택 [structure / minor]
표준 슬라이더 헬퍼를 4파일만 채택, **22파일이 손수 와이어업**(표준 참조 prop-section.js조차 손수). 시각보다 코드 일관성 — debug-squad 영역과 겹침.

### C5. prop-align-btn 오버로드 [widget / minor]
정렬 전용이어야 할 위젯을 comparison(칼럼선택 flex:1)·simple-card(fit토글)·annotation(border-style)·asset(초기화 10px)이 범용 세그먼트 토글로 인라인 크기 손봐 재사용.

### C6~ (minor·nit)
prop-frame `.prop-select`만 인라인 height 28px+하드코딩색(#1a1a1a/#e5e5e5/#333) · prop-label 폭 56/60/48 혼용 · `.prop-style-btn`(Bold/Italic) CSS 풀정의나 **사용 0건**(weight는 select 처리) · `.prop-full-btn` deprecated dead(JS 0참조).

---

## D. 잘 된 점 (명시)
- 기본 인터랙티브 위젯(버튼/입력/셀렉트) 크기·색 토큰 일관 (렌더 확정).
- 정렬그룹 계층 규칙 위반 0 — v2 회귀 치유.
- 토글·카운트버튼·섹션 패딩·헤더 구조(name+id) 일관.
- 저대비 FIX(dim→#969696) 패널 위젯에 정상 반영 확인.

---

## 우선 수정 Top 5 (이 영역)
| # | 항목 | severity | 근거 |
|---|------|----------|------|
| 1 | 위험버튼 단일표준화(.prop-action-btn.danger) + frame/canvas/simple-card raw hex 제거 | major(확정) | 채움 vs 네이티브 폴백 |
| 2 | primary 풀폭 액션 1표준(색·radius 통일) | major(확정) | 회색 vs 파랑 3계열 |
| 3 | `buildBlockHeader()` 공용 빌더 신설 → 헤더 아이콘 16px 통일 | major | 26패널 재구현 |
| 4 | 행 간격 표준화(gap 4 · margin-bottom 6 단일) + 이중마진 제거 | major | 6/12 분산 |
| 5 | 반복-아이템 카드 표준 클래스 통일(.prop-line-card) | major | 8/0/none |

> 공통: **패널마다 손수 만든 액션버튼·헤더·간격을 공용 클래스/빌더로 흡수.** 새 스타일 추가가 아니라 표준 1개로 수렴.

---

## 커버리지 / 한계
- 이번 모듈 = **prop-panels만**(현빈 지시). canvas-blocks(editor-blocks 2219줄)·layer-panel·pm-panel 등은 미분할 — prop-panels 결과 보고 확장 판단 예정.
- danger/full-width는 **클래스 단위 렌더 확정**. "각 패널 실제 화면에서 그 버튼이 보이는 위치"까지의 패널별 스크린샷 대조는 미실시(블록 종류별 선택 시나리오 필요) → 다음 단계 가능.
- spacing 3건은 정적(trace) — CDP 행높이 실측은 미실시.
- report-only. 발견 수정은 별도 FIX 승인 후(현재 승인=저대비 2건만, 그건 완료).
