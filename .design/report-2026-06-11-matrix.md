# GODITOR Design Matrix — 영역 × 차원 (2026-06-11, 13영역 확장판)

현빈 구상 검증: 차원=정류장, 영역 담당자가 자기 영역을 들고 전 정류장 통과 → **영역 간(가로)·차원 간(세로) 크로스체크.**
구조: 행=영역 **13** × 정류장 4(component·color·spacing·states) + 정류장 결산 4 = 17에이전트(2배치). report-only, 정적(현재 코드=FIX 반영).

---

## 0. 결론 — 단일 근본원인 CONFIRMED (13/13)

13영역이 **각자 손으로 UI를 그린다** — 이유는 `:root`에 **토큰 패밀리가 없어서.** component 결산이 13/13으로 확정:
> `--ui-btn-h` · `--ui-radius-*` · `--ui-input-h` · `--ui-danger`(+ -bg/-border/-hover) **4개 패밀리 부재가 단일 근본원인.** prop-panel·design-system은 *한 패널 안에서도* height·radius가 갈림 = 토큰 강제력 부재의 직접 증거. **토큰 신설 시 다수 finding 일괄 수렴.**

매트릭스가 단독 RUN 대비 더한 것: ① 영역 간 비교(가로) ② 그 분열들이 **하나의 상류 원인**으로 수렴함을 입증.

---

## 1. 영역 × 차원 히트맵 (●●=분열주범 / ●=경미 / ✓=모범)

| 영역 \ 정류장 | comp | color | spacing | states | 성격 |
|---|:-:|:-:|:-:|:-:|---|
| **graph** | ✓ | ✓ | ✓ | ● | **최우수** — 공용베이스 무override 상속 |
| **pickers** | ● | ● | ● | ✓ | states 모범(focus-visible 유일 보유), stale fallback |
| **prop-panel** | ● | ✓ | ✓ | ● | FIX 모범(gap4·label56·btn24) |
| **canvas-block** | ✓ | ● | ●● | ● | danger·selection 토큰 모범 |
| **design-system** | ●● | ✓ | ●● | ● | color 최위생(raw0), 폼치수 3단 난립 |
| **toast** | ● | ● | ● | ● | 2토스트 시스템·상태색 없음 |
| **template-browser** | ●● | ●● | ● | ● | comp-shelf 215줄 2중복정의 |
| **modals** | ●● | ●● | ●● | ●● | settings 독립 raw 팔레트 |
| **left-panel** | ●● | ●● | ●● | ●● | 토큰 우회 다발 |
| **pm-panel** | ●● | ●● | ●● | ●● | 독자 Claude-blue #6b9eff |
| **assets-ai** | ●● | ●● | ● | ● | 두 방언(.assets vs .aig)+보라 |
| **toolbar** | ●● | ● | ● | ●● | 별도 .tb-btn 시스템 |
| **home-pages** | ● | ●● | ● | ● | 3페이지 3토큰전략(license만 정석) |

→ **모범 = graph/pickers/prop-panel/canvas-block/license**(토큰 준수). **분열 = modals/left/pm/assets/toolbar**(독자 언어).

---

## 2. 정류장 결산 — 영역 간 불일치 spread (단독 RUN이 못 본 것)

| 정류장 | spread | 핵심 |
|---|---|---|
| **D-component** | 버튼 height **10단**(15~32) · radius **9단**(0~10) · danger **4방식** · input height 4단 · 모달 radius 3단/shadow 3종 | 근본=토큰 패밀리 부재(13/13 확정) |
| **D-color** | 파랑 **9종** · danger 빨강 **6종**(시각 4분기) · 독립 raw 팔레트 **4영역** · stale fallback 3영역 · `--ui-*`↔`--color-*` 이중토큰 | `--ui-danger` 신설=5영역 동시해결 최대 레버리지 |
| **D-spacing** | 라벨폭 **4종**(56/62/40/32) · 행 gap **10종**(2~14, 4 vs 6 충돌) · 패널패딩 12단 · 모달 레일 140/200 | off-grid 전영역 산발(--space-* 미이관) |
| **D-states** | focus-visible **1/13**(pickers만) · disabled opacity **8값** + 메커니즘 2종 · hover **5종** · 활성색 6+종 raw | focus-visible 전역 a11y 갭(승격) |

### danger 4방식 (대표 분열)
toned(색만, pm #ff8a8a) / token fill-alpha(정석, comp-shelf·canvas) / raw outline(prop #6b2e2e·left) / raw solid fill(prop #c0392b·settings). **prop-panel은 한 영역서 fill·outline 정반대 공존.**

---

## 3. 처방 = `:root` 토큰 패밀리 신설 (상류 1곳)

| 신설 토큰 | 닫히는 불일치 |
|---|---|
| `--ui-danger` (+ -bg/-border/-hover) | danger 4방식·빨강 6종 → 1 (5영역) |
| `--ui-btn-h`(24) · `--ui-radius-sm/md`(4/6) · `--ui-input-h` | 버튼 height 10단·radius 9단·input 4단 |
| 파랑 정본화(--ui-accent-primary 통일, #6b9eff/#6fa3f7/#6cf/#1592fe 폐기·alias) | 파랑 9종 → 2 |
| `--ui-form-label-w`(56) · `--ui-row-gap`(4) · `--ui-pad-panel`(8) · `--ui-modal-header-pad`(14 18) · `--ui-rail-w` | 라벨폭 4종·gap 10종·패딩 12단 |
| `--ui-disabled-opacity` (1값) | disabled 8값 |
| `:focus-visible` 공용 규칙 | 전역 키보드 a11y 갭(12/13) |

**모범 베이스**: prop-panel(FIX됨) + canvas-block `var(--ui-*, fallback)` + license.html(design-tokens alias) → 이걸 표준으로 승격, 나머지 영역 편입.

---

## 4. 메타 / 다음
- **13영역 매트릭스 = 앱 디자인 시스템 전수**. 단독 RUN이 못 본 영역 간 분열 + 단일 근본원인 입증.
- 정류장 결산(matrix-station-*.json) = **신규 UI 사전평가 게이트 기준**(현빈 룰).
- 다음 갈래: (A) 토큰 패밀리 신설 FIX(Before/After 승인) (B) GATE 모드 정식화.
- 산출: `.design/results/matrix-{13영역}.json` + `matrix-station-{4차원}.json` + 이 리포트 + HTML 뷰. report-only, 코드 미수정.
