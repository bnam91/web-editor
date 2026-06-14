# GODITOR (web-editor) — qa-squad ULTRA-PLAN

> 설계 전용 문서 (감사 실행 X). 무결손 커버리지 맵 + 누락 시나리오 + 통합 escape 역분류표 + Boundary/Regression + 스폰분해.
> **바: Adobe/Figma급 — 유저가 어떤 시나리오를 밟아도 안 깨짐.**
> 기준선: HEAD `eb8c390` ("슬라이더행 표준화 + 무결성/포커스 보강 — design-squad 후속")
> 입력: `.qa/profile.md`, `.qa/results/qa-*-20260611.json`(직전 RUN), qa-squad 엔진 v4.1.1, `webeditor-regression-guard`
> CDP: 포트 **9334** (직전 RUN 실측 포트. profile은 9335 기본/9334 구버전 표기 — **실행 전 port-status로 확정**)
> 테스트 프로젝트: `proj_1775644888754`

---

## 0. 직전 RUN(2026-06-11)이 본 것 — 커버리지 기준선

| 영역 | 에이전트 | 시나리오 | 결과 |
|------|---------|---------|------|
| 텍스트/갭/구분선 | QA-01 | 랜딩작성·스타일순환(7종×3정렬)·편집중 단축키충돌 | 3 PASS |
| 에셋/이미지/서클 | QA-02 | 빈 체크보드·서클 overflow·이미지삭제 dataset정리 | 3 PASS |
| 카드/테이블/그래프 | QA-03 | 테이블셀+undo·**카드클릭 패널(FAIL major)**·그래프 데이터UI | 2 PASS / 1 FAIL |
| 저장/로드/브랜치/히스토리 | QA-04 | **탭전환 무편집 재기록(FAIL major)**·**Undo/Redo tip유실(FAIL blocker)**·브랜치·race×2 | 3 PASS / 2 FAIL |
| 내보내기/템플릿/레이어 | QA-05 | 템플릿ID·레이어동기화·내보내기피드백(진행표시 리셋 ux) | 3 PASS |
| 드래그/그룹/멀티선택 | QA-06 | 블록드래그·섹션간이동·그룹/해제·Shift멀티선택 | 4 PASS (heading type silent minor) |
| 자유탐색 | QA-Explorer | (직전 RUN 결과 파일 부재 — Explorer 미실행 또는 미기록) | — |
| 회귀 | QA-Regression | S-01~06 + R-01~08 | 13 PASS / 1 SKIP |
| 엣지 | QA-Boundary | B-01~B-10 | 10 PASS (B-02·B-07 ux) |
| UX | QA-UX | U-01~04 (단축키 8종·드래그rAF·선택피드백·에러피드백) | 4 PASS |

**확정 결함 3건**: DEF-01(undo tip 유실 blocker), DEF-02(카드클릭 와이어링 끊김 major), DEF-03(무편집 방문 재기록 major).
**합계 49 시나리오 / 45 PASS / 3 FAIL / 1 SKIP / 6 ux.**

직전 RUN의 구조적 사실: **모든 시나리오가 "섹션·블록" 레벨**에 집중. **페이지(파일 탭) 레벨의 파괴적 조작·전역 상태 동시 오염은 happy-path만**. 5-agent 동시작업 환경이 전역 히스토리/선택을 흔든 노이즈가 반복 기록됨(= 단일사용자 가정의 전역 단일 undo가 멀티컨텍스트에 취약하다는 *제품 신호*인데 매번 "환경 한계, 앱 버그 아님"으로 처리됨 → §3 회귀/§2 누락에서 재조명).

---

## 1. 시나리오/플로우 재분해 — 핵심 유저 작업 전수 커버리지 맵

핵심 유저 동사: **생성·편집·저장·복귀·내보내기·재배치·다중선택·드래그·undo/redo** + (재분해로 추가) **페이지 관리·삭제 취소·세션 복구·블록 타입 전환·붙여넣기**.

| # | 유저 작업(동사) | 세부 플로우 | 직전 RUN 커버 | 갭(이번 설계 추가) |
|---|---------------|-----------|:---:|------|
| F1 | 생성 | 섹션·9종 블록 추가 | ✅ QA-01/02/03, S-03 | — |
| F2 | 편집(텍스트) | 진입·입력·볼드/이탤릭·정렬·스타일순환 | ✅ QA-01 | IME 조합 중 blur·편집 중 페이지 전환 (F11과 교차) |
| F3 | 편집(데이터) | 테이블셀·그래프데이터·카드속성 | ⚠️ 카드 FAIL | 카드 **재현 회귀 확인**(DEF-02 fix 후) |
| F4 | 저장 | autosave 디바운스·flush·race | ✅ QA-04 S4/S5 | 저장 **실패 시** 피드백(디스크full/quota) — 정류장 교차 |
| F5 | 복귀 | 탭전환→복귀·새로고침 복원 | ⚠️ 무편집 재기록 FAIL | DEF-03 fix 후 재현 + **세션 크래시 후 복구**(autosave LS↔파일 충돌) |
| F6 | 내보내기 | 전체섹션 export·진행표시·토스트 | ✅ QA-05 (진행표시 리셋 ux) | 내보내기 중 **편집/페이지전환** 시 정합성 |
| F7 | 재배치 | 블록 순서·섹션간 이동 | ✅ QA-06 | **섹션 자체 순서 변경**(섹션 드래그)·페이지 순서 |
| F8 | 다중선택 | Shift+Click·Cmd+A(섹션스코프) | ✅ QA-06/UX | 멀티선택 후 **드래그/그룹/삭제 복합** 1플로우 |
| F9 | 드래그 | 블록·섹션간·rAF·layerPanel 비호출 | ✅ QA-06/UX | 드래그 **중 새로고침/Esc 취소**·자기 자신 위 드롭 |
| F10 | undo/redo | 5체인·50연속·셀편집 native | ⚠️ tip유실 blocker | DEF-01 fix 후 **대칭성 재검증**(add/undo/redo 카운트 일치) |
| **F11** | **페이지 관리** | **페이지 추가·전환·삭제·이름변경** | **❌ 전무** | **§누락 핵심 — 페이지 삭제 무보호** |
| **F12** | **삭제 취소** | 블록/섹션/페이지 삭제 후 복구 경로 | **❌ 부분** | **페이지/섹션 삭제가 undo로 복구되나? 토스트 Undo 액션?** |
| F13 | 블록 타입 전환 | 잘못된 type·type 변경 | ⚠️ heading silent minor | 유효 type 검증 가드 회귀 |
| F14 | 붙여넣기/복제 | Cmd+D 복제·(클립보드 붙여넣기 있으면) | ⚠️ Cmd+D 원본+클론 동시selected ux | 복제 ID 유일성·외부 붙여넣기 |

---

## 2. 누락 시나리오 (직전 격자가 구조적으로 못 본 것)

### ⛔ N-01 (최우선) — 페이지 삭제 무보호 [현빈 육안 escape]
- **사실**: `deletePage()` (`js/io/save-load.js:268`)는 `state.pages.length<=1`만 토스트로 가드. 그 외엔 **confirm 다이얼로그 없이 즉시** `splice` → 페이지(전 섹션·블록) 소멸. 삭제 X 버튼은 `file-page-section.js:98`에서 바로 `deletePage` 호출.
- **왜 안 잡혔나**: Boundary B-02는 *마지막 **섹션*** 삭제 가드만 테스트(섹션 레벨). **페이지 레벨 파괴 조작은 어느 역할 owns에도 없음.** QA-04(save/load)가 페이지를 owns하지만 시나리오는 탭전환/브랜치/race뿐 — *삭제*가 빠짐.
- **추가 시나리오**:
  - N-01a: 섹션 다수 보유 페이지 X 클릭 → **confirm 없이 소멸하는가** (Adobe/Figma는 파괴조작 확인 필수)
  - N-01b: 페이지 삭제 후 **undo(Cmd+Z)로 페이지 복구되는가** (전역 history가 페이지 splice를 커버하나? — F12)
  - N-01c: 활성 페이지 삭제 시 인접 페이지로 전환되며 캔버스 정합 유지되나(`deletePage:274-285` 경로)

### N-02 — 페이지 추가/전환/이름변경 풀사이클 (F11)
페이지 2개+ 생성 → 각 페이지에 다른 콘텐츠 → 전환 왕복 → 콘텐츠 격리 보존 → 저장/리로드 후 페이지 구조 유지. **직전 RUN은 단일 페이지만 다룸.**

### N-03 — 삭제 취소(Undo) 가능성 일관성 (F12)
블록 삭제·섹션 삭제·그룹 해제·페이지 삭제 각각 **Cmd+Z로 복구되는가**를 한 표로. (블록은 history 스냅샷이라 복구 추정, 페이지는 splice라 미복구 의심 — *대칭 깨짐이면 UX blocker*).

### N-04 — 세션 크래시 복구 / autosave 출처 충돌 (F5 확장)
LS(`web-editor-autosave__*`)와 디스크 파일이 불일치할 때(크래시·다중탭) 어느 쪽이 이기나. DEF-03(무편집 재기록)·P-03(lsTs 비교 역전)과 같은 상류. **새로고침 직전 미저장**은 봤지만 **출처 충돌 해소**는 미검증.

### N-05 — 전역 단일 undo의 다중 컨텍스트 취약성 (제품 신호 승격)
직전 RUN 전 에이전트가 "전역 history가 내 작업을 소멸시킴 → 환경 한계"로 처리. 단일 사용자라도 **다중 탭/창**으로 같은 프로젝트 열면 동일 증상. `restoreSnapshot`이 `canvas.innerHTML` 통째 교체(history.js)라 다른 탭 편집을 덮을 수 있음 → **명세 갱신 채널로 승격**(격자 정의 결함).

### N-06 — 내보내기 중 상태 변이 (F6, DEF/ux 승격)
QA-05 ux 관찰("내보내기 중 props 재렌더 시 진행표시 리셋, detached 버튼 클로저")을 **단독 재현 시나리오**로: 내보내기 시작 → 다른 블록 선택/페이지 전환 → 진행표시·완료토스트·실제 파일 생성 정합.

### N-07 — 복합 조작 1플로우 (F8+F9+F10)
멀티선택 → 드래그 이동 → 그룹 → undo → redo. 단일 액션 단위가 아닌 **연속 시퀀스**에서 selection/history 정합(엔진 핵심 원칙 "유저 시나리오"). 직전엔 액션별 분리 검증뿐.

---

## 3. 통합 escape 역분류표 — "어느 스쿼드/렌즈가 잡았어야 했나" (qa가 오너)

이번 세션 현빈 육안 escape 5건 + 직전 RUN 미승격 신호를 **격자(스쿼드 × 렌즈)에 역분류**. 어느 셀에도 안 들어가면 **행/열 누락 증거**.

| escape | 성격 | 잡았어야 할 스쿼드 | 잡았어야 할 렌즈/역할 | 격자 진단 |
|--------|------|------------------|---------------------|----------|
| **cv-chips 스타일 비일관** | 시각(컬러칩 토큰 이탈) | **design-squad** | MATRIX station-component / station-color | ✅ 셀 존재 → design이 fix함(`color-var-chips.js`, eb8c390 focus-visible 편입). qa 소관 아님 |
| **bare 슬라이더(raw range 7개)** | 시각+컴포넌트 표준 | **design-squad** | station-component(컴포넌트 표준) | ✅ 셀 존재 → eb8c390 `.prop-slider` 표준화. qa 소관 아님 |
| **촌스러운 버튼** | 시각(스타일 품질) | **design-squad** | station-component / typo | ✅ 셀 존재(design GATE 정본토큰) → 단, "품질/촌스러움"은 정량 토큰 이탈로 환원돼야 잡힘(주관 배제) |
| **슬라이더행 비일관**(profile color-hex·padding span 제각각) | 시각+**거동**(편집가능 여부 행마다 다름) | **design-squad**(시각) + **qa-squad**(거동) | design: station-component / **qa: MATRIX interaction 정류장(편집필드 일관성)** | ⚠️ **부분 누락** — 시각은 design이 잡음. 그러나 "어떤 슬라이더행은 hex 편집가능, 어떤 행은 readonly span"이라는 **거동 분열**은 qa MATRIX interaction이 잡았어야 함. 직전 RUN에 MATRIX 미실행 → **열(정류장) 누락** |
| **페이지삭제 무보호** | **거동(파괴조작 안전)** | **qa-squad** | **❌ 어느 역할 owns/렌즈에도 없음** | 🔴 **결정적 행 누락** — Boundary는 *섹션* 가드만, save/load는 페이지를 owns하나 *삭제* 시나리오 없음. **"파괴적 조작 확인" 렌즈 자체가 부재** |
| (직전) 전역 undo 다중컨텍스트 소멸 | 거동(상태 격리) | **qa-squad** | state 정류장(영속·격리) | 🟡 매번 "환경 한계"로 닫혀 셀에 안 적립됨 → **역분류로 승격(N-05)** |
| (직전) addTextBlock 잘못된 type silent | 거동(API 견고성) | qa-squad | Boundary(입력 검증) | ⚠️ minor로 기록됨. Boundary에 "잘못된 인자" 항목 없어 우연 발견 → B-list에 편입 제안 |

### 역분류 결론 (격자 정의 결함 2건)
1. **행 누락 — "파괴적 조작 확인(Destructive-Action Confirmation)" 렌즈 부재.** 페이지/섹션/프로젝트 삭제·덮어쓰기·되돌릴 수 없는 조작에 confirm/undo가 있는가를 보는 역할이 격자에 없음. → **QA-Boundary에 "파괴조작" 항목군 신설** 또는 **QA-Safety 신규 역할** 제안(사용자 승인 게이트).
2. **열 누락 — MATRIX interaction 정류장 미가동.** 컴포넌트 거동(슬라이더행 편집가능성·esc/enter 의미·연속조작 가드)이 모듈마다 분열했는지 비교하는 정류장이 한 번도 안 돌았음. design-squad는 MATRIX를 돌렸지만 그건 *시각* 도메인. **qa MATRIX interaction은 거동 분열 전담** → 이번에 첫 가동 제안.

> design 도메인 escape 3건(cv-chips·bare slider·버튼)은 **셀이 존재**했고 design-squad가 정상적으로 잡아 fix함 — qa 격자 결함 아님(경계 준수). qa 격자가 실제로 샌 건 **거동 2축**(파괴조작 행 + interaction 정류장 열).

---

## 4. Boundary / Regression 시나리오

### Boundary (극단입력·빈상태·다수블록·빠른연속) — 기존 B-01~B-10 + 신규
| ID | 시나리오 | 신규 사유 |
|----|---------|----------|
| B-01~B-10 | 기존(섹션0개 단축키·마지막섹션삭제·1000자·빈에셋·5연속클릭·Cmd+Z50·중첩그룹·IME·이모지·템플릿ID) | 회귀 스윕 유지 |
| **B-11** | **페이지 삭제 — confirm 부재 확인**(N-01a) | 파괴조작 행 신설 |
| **B-12** | 페이지 다수(5+) 생성 후 빠른 연속 X 클릭 → 마지막 페이지 가드 도달 + 중간 소멸 정합 | 빠른연속×파괴 |
| **B-13** | 섹션 50개+ 다수 블록 페이지에서 저장/리로드/내보내기 성능·정합(빈상태 반대극) | 다수블록 극단 |
| **B-14** | 빈 페이지(섹션0) 저장 → S-06 가드(빈 캔버스 덮어쓰기 방지)와 페이지 레벨 교차 | 빈상태×페이지 |
| **B-15** | addTextBlock/add* 에 **잘못된 인자**(undefined·숫자·빈문자) → silent 'undefined' 블록 방지 가드 | escape 역분류 편입 |
| **B-16** | undo/redo 카운트 대칭 boundary(add N → undo N → redo N → 정확히 N복원) | DEF-01 fix 검증 |

### Regression (이번 FIX가 기존 기능 깼나) — guard S-01~06 + R-01~08 + 신규 R
HEAD `eb8c390` 변경 파일: `prop-chat.js`, `text-effect-transform.js`, `badge-transform.js`, `editor-panels.css`, `editor-canvas.css`, `editor-graph.css`. **직전 미수정 DEF 3건의 fix 여부도 회귀로 추적.**

| ID | 회귀 확인 | 근거 |
|----|----------|------|
| S-01~06 | guard 스모크 전량 | 필수 선행 |
| R-01~08 | 기존 R목록 | guard 대장 |
| **R-09** | **undo tip 유실(DEF-01)** 재발/수정 확인 — add5→undo5→redo5 후 블록수 동일 | summary가 R-09 적립 제안(승인대기) |
| **R-10** | **카드클릭 패널 와이어링(DEF-02)** — bindBlock isCard 분기·layer-panel .col순회 fix 시 캔버스 클릭으로 Card 패널 도달 | DEF-02 |
| **R-11** | **무편집 방문 재기록(DEF-03)** — 로드만 하고 떠날 때 디스크 미기록(dirty 플래그) | DEF-03 |
| **R-12** | eb8c390 슬라이더 표준화 회귀 — chat/badge/tfx `.prop-slider`가 값 양방향 동기화 정상(profile color-hex→`.prop-number` 편집가능, padding 양방향) | HEAD diff |
| **R-13** | `var(--ui-border)322 깨진 선언 수정` 후 패널 보더 렌더 정상(무결성 보강이 레이아웃 안 깸) | HEAD diff |
| **R-14** | focus-visible 공용규칙 cv-chip/prop-align-btn/prop-slider 추가 후 키보드 포커스 링 정상·마우스 클릭 시 미표출 | HEAD diff |

> guard_doc S-06 스니펫 LS prefix `wb_save_` → 실제 `web-editor-autosave__` 불일치(직전 RUN 보고) — **guard 문서 갱신을 R 적립과 함께 제안**(사용자 승인 게이트).

---

## 5. 하네스 분해 — 역할별 에이전트 + 시나리오 실주행 (CDP 직렬)

### 동시성 규율 (직전 RUN 최대 교훈 — 반드시 반영)
직전 RUN은 6에이전트 병렬이 **전역 단일 history/selection을 상호 오염**시켜 매 에이전트가 재시도·"환경 한계" 노트를 양산. CDP 페이지는 1개 공유. **이번엔 멀티스텝/단축키/history 시나리오는 단일 `evaluate_script` 원자 실행을 강제하고, history를 건드리는 에이전트는 직렬화.**

```
오케스트레이션 단 (얇게: severity/acceptance 규칙만 주입, 전 명세 안 읽음)
│
├─ Wave 1 (병렬 — history/page 비파괴 + 자기 섹션 격리, run_in_background)
│   ├ QA-01 텍스트/갭/구분선      (자기 섹션, 원자 실행)
│   ├ QA-02 에셋/이미지/서클       (자기 섹션)
│   ├ QA-03 카드/테이블/그래프 + R-10(DEF-02 카드 와이어링 재현)
│   ├ QA-05 내보내기/템플릿/레이어 + N-06(내보내기 중 변이 단독재현)
│   └ QA-UX  U-01~04 + R-12/R-14(슬라이더·focus-visible 회귀)
│
├─ Wave 2 (직렬 — 전역 history/page/저장 단독 점유, 한 번에 1에이전트)
│   ├ QA-04 저장/로드/브랜치/히스토리 + N-02(페이지 풀사이클)·N-04(출처충돌)·N-03(삭제취소)
│   ├ QA-Regression S-01~06 + R-01~14 (guard 선행)
│   ├ QA-Boundary B-01~B-16 (B-11~16 신규 파괴/극단)
│   └ QA-10(신규) "파괴조작 확인" 전담 — N-01(페이지삭제 무보호)·F12 삭제취소 대칭
│
├─ QA-Explorer (직렬, Wave 2 후 단독) — 빈 프로젝트→완성까지 5분 + 페이지 추가/삭제 자유조작
│
├─ MATRIX interaction 정류장 (옵션, 열 누락 메움)
│   슬라이더행/패널 컴포넌트의 편집가능성·esc/enter·연속조작가드 거동 분열 비교 (N-05 상류 추적)
│
└─ 취합 + 2층 평가
    ├ blocker-candidate(DEF-01 재발·N-01 무보호 등) → 중앙/독립검증자 반증 재확인
    │   · deterministic(DOM confirm 부재·블록수 카운트) → 독립 재실행 1회로 종결
    ├ 교차 root-cause 머지: 전역 history 관련 증상(N-05·DEF-01·undo취소불가) → 상류 1곳(history.js restoreSnapshot) 수렴 헤드라인
    ├ 10th Man 레드팀: 전 PASS 시 "현 격자가 구조적으로 못 보는 깨짐 5개" 설계 (파괴조작·다중탭 우선)
    └ 역분류 적립: N-01 → guard R-15 제안 / 파괴조작 렌즈·MATRIX interaction → 명세 보강(승인 게이트)
```

### 에이전트별 결과 파일
`.qa/results/qa-<역할>-20260612.json` (스키마: profile/엔진 RESULT JSON — severity·evidence·evidence_grade·adjudication·`should_have_been_caught_by`·`out_of_scope_flags`).
취합: `.qa/results/qa-summary-20260612.json`. blocker 1↑ 또는 FAIL 3↑ → debug-squad 연동 권장.

### 사전 게이트
1. port-status로 9334/9335 확정 (없으면 "앱 실행 후 재의뢰" 중단)
2. `webeditor-regression-guard` 절대금지(addStripBannerBlock 등) 숙지
3. 테스트 프로젝트 격리 + 종료 시 생성물 deleteSection/deletePage + flushSave 복구

---

## 요약 (설계 결론)

1. **누락 시나리오 핵심**: 직전 RUN은 전부 *섹션·블록* 레벨 — **페이지(파일 탭) 레벨이 통째로 빔**. 특히 **N-01 페이지 삭제 무보호**(`deletePage` confirm 없이 즉시 splice, 마지막 페이지만 토스트 가드), N-02 페이지 풀사이클, N-03 삭제 취소(Undo) 대칭, N-04 세션 복구/autosave 출처 충돌, N-05 전역 단일 undo의 다중컨텍스트 소멸(매번 "환경 한계"로 닫힌 제품 신호를 승격).
2. **역분류 핵심 — 어느 렌즈가 뭘 놓쳤나**: 현빈 육안 escape 5건 중 **시각 3건(cv-chips·bare slider·촌스러운 버튼)은 design-squad 격자에 셀이 있었고 정상 fix됨**(qa 소관 아님, 경계 준수). qa 격자가 실제로 샌 건 **거동 2축** — ⓐ **행 누락**: "파괴적 조작 확인" 렌즈 자체가 없어 페이지삭제 무보호를 어떤 역할도 안 봄(Boundary는 섹션 가드만, save/load는 삭제 시나리오 없음). ⓑ **열 누락**: MATRIX **interaction 정류장 미가동**으로 슬라이더행 편집가능성 *거동* 분열을 못 비교함(시각만 design이 잡음).
3. **스폰계획**: Wave1 병렬 5(비파괴·자기섹션 원자실행) → Wave2 직렬 4(전역 history/page/저장 단독점유: QA-04+N-02/03/04, Regression, Boundary B-01~16, **신규 QA-10 파괴조작 전담**) → Explorer 단독 → (옵션)MATRIX interaction 정류장. 취합서 blocker 2층 반증 + 전역history 증상 root-cause 1곳(restoreSnapshot) 수렴 + 10th Man 레드팀 + N-01→guard R-15·파괴조작 렌즈 명세 편입(승인 게이트).
4. **격자 갱신 제안**: ① QA-Boundary에 "파괴조작" 항목군(B-11~16) 또는 신규 **QA-Safety** 역할, ② **MATRIX interaction 정류장** 정례화, ③ B-list에 "잘못된 인자(silent undefined 블록)" 편입, ④ guard_doc R-09(undo tip)·R-15(페이지삭제)·S-06 prefix 갱신 — 전부 사용자 승인 게이트("기획자 아님" 원칙 유지).
