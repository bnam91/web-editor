# GODITOR(web-editor) debug-squad ULTRA-PLAN — 2026-06-12

> 설계 전용(감사 실행 X). 기준선 HEAD **eb8c390**. 바: Adobe/Figma급 — 데이터 유실·잠복버그 0.
> 엔진: debug-squad v4.1.1 (16차원) · 명세: `.review/profile.md` · 직전 RUN: `report-2026-06-11.md` + `results/review-*.json`(12파일)
> 목적: 직전 RUN이 **본 것 + 누락**을 격자로 재분해 → 무결손 커버리지 맵 + 데이터유실 핫스팟 + ux-blocker 역분류 + eb8c390 회귀점검 + 스폰분해.

---

## 0. 직전 RUN(06-11)이 확보한 것 — 재실행 불요(중복 방지)

확정 blocker 4(B1 탭전환 타이머 교차오염 / B2 card deselect 누락 / B3 card Delete 폴스루 / B4 Cmd+Q in-flight 유실) · 확정 major ~30(클러스터 A~H) · refuted 1 · downgraded 2.
**지배 균열 2개**: ① 저장 진실소스 분산(클러스터 A, 12건) ② BLOCK_TYPES 레지스트리 부재(클러스터 B, card 9곳 누락). 두 균열은 *소수 수정으로 다수 해소* — 이미 진단 완료. **재RUN은 진단 반복이 아니라 "06-11 이후 코드 변화(a7ad40b card 제거 + eb8c390 슬라이더) + 06-11이 구조적으로 못 본 차원"에 집중**한다.

---

## 1. 차원 × 모듈 무결손 격자 (●=06-11 커버, ◐=부분/표본만, ○=미커버=이번 타겟, —=N/A)

행=모듈(profile owns), 열=16차원. ○/◐ 가 이번 RUN 스폰 대상.

| 모듈 \ 차원 | async | race | mem | state | apierr | null | integ | branch | type | rerender | doc | struct | **test** | **deps** | **a11y** | **effect** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| io-save (save-load/tab/branch/commit) | ● | ● | ◐ | ● | ● | ◐ | ● | ● | ● | ● | ● | ● | ○ | — | — | — |
| history-core (history/editor) | ◐ | ● | ● | ● | ◐ | ◐ | ● | ● | ◐ | ● | ◐ | ● | ○ | — | — | — |
| blocks (block-factory 4.6k/blocks**) | ◐ | ○ | ◐ | ◐ | ◐ | ● | ◐ | ● | ● | ◐ | — | ● | ○ | — | — | — |
| drag (block-drag/section-drag/utils) | ○ | ◐ | ● | ● | — | ◐ | ◐ | ◐ | ◐ | — | — | ◐ | ○ | — | — | — |
| props (47파일) | — | — | ◐ | ◐ | ◐ | ● | ◐ | ◐ | ◐ | ◐ | — | ● | ○ | — | ◐ | ◐ |
| panels (layer-panel 등) | — | ◐ | ◐ | ◐ | — | ◐ | ◐ | ● | — | ● | — | ◐ | ○ | — | — | ◐ |
| export-io (export-*/figma-publish) | ● | — | — | — | ● | ◐ | ◐ | — | ◐ | — | — | ◐ | ○ | ◐ | — | — |
| ai (ai-*/ai-ext) | ● | ◐ | ● | ● | ● | ◐ | ◐ | — | — | ● | — | ◐ | ○ | — | — | — |
| claude-pm (터미널 스폰) | ◐ | ○ | ○ | ○ | ◐ | ○ | — | — | — | — | — | ◐ | ○ | — | — | — |
| scratch (scratch-pad/image-handling) | ◐ | — | ◐ | ◐ | — | ◐ | — | — | — | — | — | ◐ | ○ | — | — | — |
| main-process (main.js 4.1k/preload/services) | ● | ◐ | ◐ | — | ● | ◐ | ● | ◐ | ◐ | — | ◐ | ◐ | ○ | — | — | — |
| **file-page-section (deletePage UI)** | ○ | ○ | ○ | ○ | — | ○ | **○** | **○** | — | ○ | — | ○ | ○ | — | ◐ | ◐ |
| **goditor-api/layout (Spec 유입로)** | ◐ | — | — | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | ○ | — | — | — |

### 격자가 드러낸 **미커버(○) 핫셀 — 이번 RUN 1차 타겟**
- **claude-pm × {race, mem, null, state}** — 06-11이 가장 얕게 본 모듈(프로세스 라이프사이클·터미널 스폰·bypass 권한). 프로세스 kill 누락/리스너 누수/스폰 경합 미검증. **신규 스폰 의무.**
- **blocks × race** + **drag × async** — block-factory 4.6k줄·drag 2k줄에서 비동기/경합이 ◐(표본)에 그침. card 제거(a7ad40b)로 14곳 타입목록이 *방금 바뀜* → BLOCK_TYPES 잔재/누락 재발 가능.
- **file-page-section × {integrity, branch}** — ux-blocker 본진(아래 §3). 06-11 격자에 행 자체가 없었음 = **명세 누락**.
- **D-test (전 모듈 ○)** — 테스트 인프라 0. 06-11은 "중앙 처리"로 한 줄 처리. blocker(저장 race)가 회귀 취약인데 그물 0 → 이번엔 *모듈별 무테스트 핫스팟 맵*으로 승격.
- **a11y / effect** — profile에서 a11y 비활성(qa-squad 위임). 유지. effect는 vanilla라 "lifecycle cleanup"으로 mem에 흡수 — 별도 스폰 불요.

---

## 2. 데이터 유실 핫스팟 — 재점검 타겟 (Adobe/Figma 바: 유실 0)

| # | 핫스팟 | 06-11 상태 | 06-12 재점검 이유 |
|---|---|---|---|
| **H1** | **save-load 3경로(debounce/flushSave/beforeunload) × 탭전환** | B1·클러스터A 진단 | DEF-03 dirty 게이트가 **탭전환 경로 미커버** 판명(race-003/004). 보정 안 됐으면 **여전히 라이브 손상**. 재현 1순위 |
| **H2** | **`_meta.json` 6-writer lost update** | async-002 등 진단 | a7ad40b가 card 제거하며 layer-panel/block-drag/타입목록 14곳 수정 → meta writer 경로 *변동* 가능. 락 여전히 0이면 회귀 |
| **H3** | **beforeunload createdAt/type 머지없이 덮어쓰기** | INT-03 — **실파일 14중 10 createdAt 이미 소실** | 진행 중 손상. `buildProjForSave({existing})` 단일조립 추출 전이면 계속 유실. **최우선 데이터유실** |
| **H4** | **deletePage 무보호 삭제** (file-page-section.js:98 → save-load.js:268) | **미커버(격자 신규 행)** | `length<=1`만 가드 — 페이지 내용 유무·undo 가능성 무관 즉시 splice. 클릭 1회로 페이지 영구소실. ux-blocker 본진(§3) |
| **H5** | **`_pendingSaveData` 단일슬롯 projectId 무차별** | race-006 진단 | 3연속 탭전환 시 중간 프로젝트 영구드롭. RAM `_cache`만 잔존 → 재시작 시 소실. 재검증 |
| **H6** | **history innerHTML 스냅샷 → JS 프로퍼티(`_name`/`_cmCommits`) 유실** | profile 핫스팟, 06-11 ◐ | undo/redo가 `_name` 등 비직렬 프로퍼티 날림 가능. block-factory 변경 후 복원 불변식 재확인 |
| **H7** | **STATE-02 이미지생성 await 후 B 프로젝트 갤러리 오염 + A blob 손실** | 진단됨 | 영속 오염 경로 — FIX 전이면 유지. ai 모듈 재점검 |

> H1·H2·H5는 **race/state 차원 → CDP 9334 재현 필요 → ux-squad와 직렬**(§5). H3·H4는 정적 trace + 실파일 grep(deterministic)으로 확정 가능 → 정적 우선.

---

## 3. ux-blocker 역분류 → debug 영역 명시 타겟

ux-squad가 잡은 **"페이지 삭제 무보호 + 가드가 죽은 코드(BUG-44 잔재)"** 는 UX 증상이지만 **근본은 debug 영역**이다. 두 갈래로 명시 타겟화:

- **(a) 데드코드 / 상태정합 — D-structure + D-branch [정적, deterministic 확정]**
  `page_count_reduced` 가드: **main.js에 0회**(grep 확정), 그러나 renderer `save-load.js:130-134`에 검사 분기 + `'⚠️ 저장 거부: 페이지 수 감소 감지 — 데이터 보호됨'` 토스트 **잔존**. → 영원히 안 타는 죽은 분기 + **거짓 안전신호**(사용자에게 보호된다고 거짓말). 06-11 ST-03와 동일 — 이번엔 **deletePage 보호 부재와 한 쌍**으로 묶어 root_cause 태깅: "삭제측 가드는 죽고, 저장측 보호는 main에서 제거됨 → 페이지 데이터에 안전망 0."

- **(b) deletePage 무보호 — D-integrity [H4]**
  `deletePage(save-load.js:268)`: `state.pages.length<=1`만 막음. 내용 채워진 페이지도 confirm/undo 안전망 없이 `splice` 즉시 영구삭제. `scheduleAutoSave()`가 뒤따라 파일에 커밋 → 디스크까지 소실. **Figma 바 기준 명백 blocker급**. debug 플랜은 이를 integrity 확정 후보로 올리고, "S11 빈캔버스 거부 가드는 있는데 페이지 단위 삭제 보호는 없다"는 **불변식 비대칭**을 root_cause로 기록.

→ profile.md에 **`file-page-section` 모듈 행 신설**(owns: js/file-page-section.js + save-load.js:deletePage/page-count 분기). 이게 06-11 격자 결손의 결정적 증거.

---

## 4. eb8c390 FIX 회귀 점검 슬롯 (이번 세션 FIX = 슬라이더·danger·토큰)

eb8c390 변경면: `prop-chat.js`(29) · `badge-transform.js`(2) · `text-effect-transform.js`(4) · CSS 4파일 · `.design/profile.md`.

| 슬롯 | 대상 | 회귀 가설 | 등급 | 방법 |
|---|---|---|---|---|
| **F1** | prop-chat 패딩행 `<span>chb-padding-val` → `<input>` 전환 | 기존 `.textContent` 리더가 남아있으면 깨짐. **grep 결과 외부 리더 0건 확인(safe)** — but 신규 양방향 `applyPadding` clamp/sync 로직은 **행위 변경**(min/max 클램프 + range↔number 양방향). 잘못된 초기값/NaN 진입 시 0 강제 가능 | minor→verify | CDP: 패딩 슬라이더+숫자 입력 왕복, NaN/경계값 |
| **F2** | prop-chat profile size/y/gap `.prop-color-hex`→`.prop-number` 클래스 교체 | 클래스 기반 CSS 셀렉터/JS 핸들러가 `.prop-color-hex` 의존했으면 스타일·이벤트 유실 | minor | grep `.prop-color-hex` 잔여 의존 + 렌더 실측 |
| **F3** | badge/tfx range에 `.prop-slider` 클래스 추가(로직 무변) | 순수 클래스 추가 — 회귀 위험 낮음. `.prop-slider` 공용 CSS가 width/thumb 덮어써 레이아웃 변형 가능 | minor | 렌더 실측만 |
| **F4** | `var(--ui-border)322` 깨진 선언 수정 + raw danger 4곳→토큰 | 토큰 미정의/오타면 색 사라짐(투명). focus-visible 공용규칙 신규 셀렉터 부수효과 | minor | CSS 정적 + 06-11 무결성 차원 재확인 |

> FIX는 **design-squad 후속**(시각 표준화)이라 데이터유실 위험 없음. 회귀 점검은 **prop-chat 양방향 로직(F1)만 verify-candidate**, 나머지는 정적/렌더 실측 self-close. eb8c390 diff 범위 밖 파급 없음(타입목록·저장경로 미접촉).

---

## 5. 하네스 분해 — 차원별 스폰 계획 (정적 + 타겟재현)

중앙 얇게(severity·등급·스키마만). 스폰 단위=차원. **단일 메시지 동시 fanout, run_in_background.** scope=06-12 변화면(a7ad40b+eb8c390 diff) + §1 미커버 핫셀.

**A군 — 정적 전수(trace/deterministic), CDP 불요 — 병렬 7:**
1. `D-structure+D-branch` → ux-blocker (a) 데드가드 + page_count 분기 [§3a, deterministic 확정]
2. `D-integrity` → H3(beforeunload 머지)·H4(deletePage 무보호)·H2(meta writer) 정적 + 실파일 grep
3. `D-doc` → a7ad40b card 제거 후 SKILL/CLAUDE/AGENTS 문서 stale(card 경로 잔존?) + DOC-01/02 재확인
4. `D-deps` → npm audit 재실행(06-11 high3/mod4 → audit fix 됐나)
5. `D-test` → 모듈별 무테스트 핫스팟 맵(중앙 처리 승격)
6. `D-type` → goditor-api Spec 유입 타입 + F1/F2 클래스 교체 정적
7. `D-structure(claude-pm)` → 프로세스 라이프사이클·dead ref

**B군 — CDP 9334 재현 필요(race/state/rerender/mem) — ux-squad와 직렬, 순차 4:**
8. `D-race+D-state` → H1(탭전환 타이머, DEF-03 보정 검증)·H5(pendingSave 슬롯)·H2(meta 경합) — **ux-squad 앱 기동 후 직렬**
9. `D-memory` → claude-pm 리스너/프로세스 누수 + MEM-01/02 재확인 + ai blob
10. `D-rerender` → buildSection O(N²)·layer-panel 폭주 (a7ad40b layer-panel 변경 후 재측)
11. `D-async` → drag 비동기 + claude-pm 스폰 경합 + ai await 후 컨텍스트

**검증 단(2층):** 모듈 미분할 차원은 독립 검증자 1 스폰, blocker·major 후보(확정·의심 불문) 중앙 적대적 반증. **그리드 레드팀** 취합 직전 1회 — claude-pm/file-page-section 신규 격자가 구조적으로 못 잡는 유형 5개 설계(10th Man).

---

## 6. 최종 요약 (누락 차원/모듈 · 데이터유실 타겟 · 스폰계획)

1. **격자 결손(○) 핵심**: `file-page-section` 모듈 행 자체가 06-11 명세에 부재(deletePage 무보호+death guard) · `claude-pm × {race,mem,null,state}` 최저 커버 · `blocks×race`+`drag×async` 표본만 · `D-test` 전모듈 무그물.
2. **데이터유실 타겟 7(H1~H7)**: 최우선 = **H3 beforeunload createdAt 진행성 손상(실파일 10/14 이미 소실)** + **H4 deletePage 영구삭제 무안전망**. 둘 다 정적 deterministic 확정 가능 → 즉시 blocker.
3. **ux-blocker 역분류**: 페이지삭제 무보호=D-integrity(H4), death guard 잔재=D-structure+D-branch(거짓 안전신호) — 한 root_cause("페이지 데이터 안전망 0")로 묶어 명시 타겟화.
4. **eb8c390 FIX 회귀**: 데이터유실 위험 없음(타입목록·저장경로 미접촉). prop-chat 양방향 padding 로직(F1)만 verify-candidate, 나머지 정적/렌더 self-close.
5. **스폰 11 + 검증/레드팀**: A군 정적 7 병렬(CDP 불요) + B군 재현 4(ux-squad 앱기동 후 직렬). scope=06-12 diff(a7ad40b+eb8c390) ∪ 미커버 핫셀.
6. **선결**: profile.md에 `file-page-section` 모듈 행 추가 + DEF-03 보정 여부(탭전환 경로) 우선 확인 — 미보정이면 H1 라이브 손상 진행 중.

---
*설계: debug-squad v4.1.1 ULTRA-PLAN, 2026-06-12. 감사 실행 X — 커버리지 맵 전용. RUN은 별도 의뢰.*
