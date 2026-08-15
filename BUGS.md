# BUGS.md — Goditor 0.8.0 배포 전 치명적 버그 대장

기준선: 태그 `v0.8.0` (main `310ff62` / dev `d9eb0ee`+범프). 탐지 페이즈 산출물(문서 단독, 코드 무수정).
치명 4분류: ①저장→로드 유실/변형 ②undo→redo 불일치 ③파일 손상/자동저장 실패 ④크래시. 그 외 = non-blocker.

판정 근거 파일: `<scratchpad>/bugdetect/runs/c1/*.json` · 하네스 `gen-c1/h-*.cjs`,`lib/invariants.cjs`,`lib/probe.js` · 앱 `js/collab/sync.js`,`js/history.js`,`js/io/save-load.js`.

---

## 사이클 1 — 새 확정 치명: **1건** (중복 제거 후)

| # | 버그 | 심각도 | 판정 | 근거 표본 |
|---|---|---|---|---|
| B1 | A5 원격 «다른 페이지» 패치 조용한 영구 소실 | 치명①(+③) | **확정** | otherpage 42/4242/99 + duo 42/4242/99 (6/6) |
| B2 | applyPatch 무(無)히스토리 체크포인트 → 협업 중 undo 오작동 | 치명②(소스확정, 런타임 재현필요) | **소스확정·재현필요** | sync.js 정독 + undo-untouched 3/3(런타임 근거 불명확) |
| B3 | serialize↔load 비멱등 (serializeProject/applyProjectData 왕복이 고정점 아님) | 재현필요(대부분 정규화 아티팩트로 판정) | **기각(아티팩트)** | a1 basic/race/pages, a3 roundtrip/step |
| B4 | A3 overflow 무동작 undo(dead-undo) | 재현필요 | **재현필요** | a3-ovf 6+ dead spots(정규화 오염 의심) |
| B5 | A5 duo 콘텐츠 수렴 실패 | 재현필요 | **재현필요(★Reviewer가 기각 반려)** | duo 42/4242/99 + N2 기전 |
| N1 | A4 `gd:project-saved` 미발화 | non-blocker | 기록 | a4-5 r1/r2/r3/r7 |
| N2 | busy 보류패치 `_sent` 오염 → stale 재전파 | **치명① 후보(재검)** | ★승격 대상 | sync.js:294 실독, duo 3/3 |
| N3 | resync 분기 미검증(스텁 무 prune) | non-blocker | SKIPPED | 전 duo/resync |
| N4 | 초대 수락에 collabRef 미기록 | non-blocker | 기록(사이클로그) | main/collab/index.js respond |

---

## B1 — [치명①/③] 원격 «다른 페이지» 패치가 재기동 후 조용히 사라진다 ★확정

- **심각도**: 치명①(남의 변경 영구 소실) + 치명③(자동저장 미발화)
- **재현 최소 단계**:
  1. 협업 방에 두 클라이언트(내가 page_1 보는 중, 상대가 page_2 편집).
  2. 상대가 page_2의 한 섹션을 편집 → 내 앱이 pull 로 그 패치 수신.
  3. 내가 page_2로 전환하지 않고, **추가 로컬 편집도 없이** 앱을 재기동(또는 리로드).
  4. → page_2의 그 변경이 디스크에 없다(영구 소실). 서버 seq 는 이미 지나가 재수신도 안 됨.
  - repro.cmd(하네스): `node h-a5-collab.cjs --port=<P> --stub=<S> --seed=42 --case=otherpage --ud=<UD>` (42/4242/99 동일 fatal, `survivedReload:false`,`dirtyAfterPatch:false`)
- **원인 파일:라인**: `js/collab/sync.js` `applyPatch()` 다른-페이지 분기 (≈199–211행).
  해당 분기는 `state.pages[].canvas` 문자열만 갱신하고 **DOM 을 안 만진다** → MutationObserver(autoSaveObserver) 미발화 → `scheduleAutoSave` 미호출 → `dirty=false` 유지 → 디스크 미기록.
  한편 `tick()`(sync.js) 은 수신분마다 `_cfg.seq` 를 전진시켜 meta 에 진도를 남긴다 → 재기동 시 `sinceSeq` 가 그 패치를 이미 지나쳐 재수신 안 됨.
- **원인 영역 그룹**: γ. 협업 수신 경로의 «비-현재 페이지» 영속화 누락.
- **전제(정직)**: 수신 후 «현재 페이지에 추가 편집»이 한 번이라도 나면 그 autosave 가 전 페이지를 flush 해 살아남는다. 소실은 «수동적 수신자가 그대로 종료» 시나리오에서 발생 — 실사용에서 충분히 흔함. (Reviewer 감사: 이 전제는 «약화»가 아니라 정직성 — 상대가 고치는 다른 페이지를 안 보는 게 정상값이라 오히려 흔한 시나리오.)
- **★확산 경로(Reviewer 추가)**: 재기동 후 `resumeSafely` ②가 stale page_2 섹션(로컬≠서버 해시)을 **서버로 되쏜다**. `flushSeq` 로 영속된 seq 가 이미 그 패치를 지나 있어 서버가 충돌로 판정하기도 어렵다 → «내 쪽 소실»이 «작성자 원본까지 서버에서 되돌리는 능동 전파»로 번질 수 있다. 등급은 이미 치명①이라 불변 — 서술 강화. 재검 시 «재기동→settle 후 서버·상대 쪽 내용» 어서션 1줄 추가.
- **수정 제안(제안만)**: 다른-페이지 분기에서 `page.canvas` 갱신 후 dirty 마킹/`scheduleAutoSave()`(또는 `state._dirtySinceSave=true` + 협업 전용 flush)를 태워 디스크에 반영. 현재-페이지 분기와 영속화 대칭을 맞출 것.

## B2 — [치명②·소스확정/런타임 재현필요] applyPatch 가 히스토리 체크포인트를 안 남긴다

- **심각도**: 치명②(undo 오작동) — 소스에서 결함 확정, 정확한 런타임 발현은 재현 필요.
- **소스 근거**: `js/collab/sync.js` `applyPatch()` 는 현재-페이지·다른-페이지 어느 분기에서도 `pushHistory`/`ensureHistoryCheckpoint` 를 호출하지 않는다(전수 확인). 즉 원격 패치는 undo 스택에 흔적을 안 남긴다.
  결과 시나리오: 사용자가 섹션 A 편집(체크포인트) → 원격 패치가 섹션 B 를 무체크포인트로 변경 → 사용자가 ⌘Z. `history.js undo()`(77–89행)는 tip 에서 `ensureHistoryCheckpoint('현재 상태')` 로 «패치 반영 현재»를 새 tip 으로 올린 뒤 pos-- → 사용자의 «자기 편집»이 아니라 «원격 변경 직전»으로 되돌아갈 수 있다(상대 작업 되감기 / 내 편집 안 되돌림).
- **런타임 표본**: `undo-untouched` 42/4242/99 3/3 이 `I2.survive-undo1@collab` fatal(localSec before==after = 로컬 편집이 undo 로 안 되돌아감). **단 판정은 «재현필요»** — 같은 세션의 `undo-noedit` 에서 히스토리가 `len:1,pos:0` 로 관측돼(undo 가 `historyPos<=0` 조기반환하는 무동작 구간), 협업 초기화가 스택을 얕게 만든 아티팩트 가능성을 배제 못 함. `undo-edited` 는 PASS(그 경로에선 undo 가 정상 이동)라 «전역 dead-undo»는 아님.
- **원인 파일:라인**: `js/collab/sync.js` applyPatch(≈195–260) · `js/history.js` undo()(77–89)·ensureHistoryCheckpoint(145–160).
- **원인 영역 그룹**: β. undo 소유권/체크포인트.
- **재현 요청(Executor)**: undo-untouched 재실행 시 매 단계 `history.len/pos` + editText 의 `detail.changed`(로컬 편집이 실제로 스택에 들어갔나) + undo 전후 remoteSec/localSec 해시를 기록. 로컬 편집이 체크포인트를 남겼는데도 undo 가 그걸 안 되돌리면 → 치명② 확정. 안 남겼으면 → «협업 중 텍스트 편집이 undo 불가»라는 별개 치명②.
- **수정 제안(제안만)**: applyPatch 적용을 히스토리에 반영(원격 변경도 undo 가능한 체크포인트로 남기되, 되돌림이 push 로 재전파되지 않도록 «원격 표식» 스냅샷으로). 또는 원격 수신을 undo 스택 밖의 별도 리비전 축으로 분리.

## B3 — [기각·아티팩트] serialize↔load 비멱등 (A1 b0 / string-roundtrip)

- **판정**: 기각(하네스/정규화 아티팩트). 블로커 아님.
- **근거**: `I1.b0-apply-idempotent`·`I1.a-string-roundtrip` 은 fatal 이었으나, **실제 영속→리로드 축은 전부 PASS**(`I1.b-dom-sections`,`I1.b2-serialized-sections`,`I1.c-asset-refs`,`PROBE-survives-reload`). basic 은 canvasLen·섹션수 불변(정규화 노이즈), race 는 1회성 690B 축소 후 안정(`beforeReload==afterReload`)=편집 중 임시 DOM 속성 정리로 보임. 변형이 «1회 후 안정»(T(T(x))=T(x))이라 리로드마다 누적되지 않음.
- **원인 후보 영역**: α. `getSerializedCanvas`/`serializeProject` 가 DOM 왕복에서 완전 고정점은 아님(정규화 성격). `js/io/save-load.js`.
- **재현 요청**: 변경된 섹션의 실제 HTML diff(임시 속성 vs 실콘텐츠 구분) + «2차 적용 안정성»(첫 적용 후 멱등인가) 확인. 실콘텐츠 변경이면 그때 치명①으로 승격.

## B4 — [재현필요] A3 overflow dead-undo

- **판정**: 재현필요. `I2.no-dead-undo` 가 overflow(스택 50 shift)에서 6+ dead spot(pos 이동, 정규화 해시 불변). 단 인접 스냅샷이 정규화 충돌하면 가짜양성이 되는 오염(B3와 같은 뿌리)을 배제 못 함. `I2.roundtrip`/`I2.step-matches-stack` 은 섹션 동일·canvasHash 표류라 정규화 아티팩트로 기각.
- **재현 요청**: dead spot 의 두 히스토리 엔트리 raw canvas 를 «정규화 없이» 바이트 비교. 동일하면 무동작 undo(치명② 확정), 다르면 정규화 가짜양성.
- **원인 영역**: β + α 교차. `js/history.js` 21–26·145–160(MAX_HISTORY shift 보정).

## B5 — [재현필요] A5 duo 콘텐츠 수렴 실패 (★Reviewer 반려로 «기각»→«재현필요» 강등)

- **판정**: 재현필요. 1차 Evaluator 는 «누적 아티팩트»로 기각했으나 **Reviewer 가 반례 2개로 그 기각을 반려**했다:
  - ⑴ **재기동 치유 모순**: duo 3런은 각각 앱 재기동으로 시작하고 `resumeSafely` ②가 «로컬≠서버 섹션을 push»하므로, 이전 런의 미push 편집은 다음 런 시작 시 «치유»됐어야 한다. 그런데 실측은 `differing` 이 2→7→11 로 자라고 **같은 섹션이 같은 before/after 해시로 세 seed 에 반복**(ljf5ulm 9f4eb2ea→91bdceda ×3 등) = «한 번도 안 치유됨». 순수 테스트 먼지로는 «왜 재기동 3번을 지나도 안 낫는가»가 규명 안 된다.
  - ⑵ **N2 가 기전을 제공한다**(아래 N2 참조): 보류 패치가 `_sent` 에 기록되면 stale 재전파가 일어난다 — 그게 수렴 실패의 원인일 수 있다.
- **재현 요청(clean-duo + N2 계측 통합)**: 방을 리셋한 신규 room 에서 A·B 각 1편집 → 충분한 settle → 수렴 비교. **동시에 N2 기전 계측**: 보류 섹션 유지(`.selected` 고정으로 isUserBusyIn=busy) × `_sent` 기록값 × 후속 push 내용 추적. 결과 분기 — stale 재전파 확인 시 N2 치명① 승격 / 수렴만 깨지면 B5 치명① 승격 / 둘 다 깨끗하면 그때 기각.

## non-blocker (기록만)
- **N1** A4 `gd:project-saved` 미발화(a4-5 r1/r2/r3/r7, fatal=false): 협업 push 트리거 신뢰성 이슈. 원인 미확정.
- **N2 → ★치명① 후보 (재검 대상, Reviewer 승격 요구)** busy 보류(미적용) 패치가 `_sent[key]=hash` 로 기록(`sync.js:294` 실독 — `applyPatch(p)` 가 USER_BUSY 로 `_deferred` 에 넣고 `return false` 해도, 다음 줄이 **반환값을 무시하고** `_sent` 를 무조건 기록).
  ★**stale 재전파 경로**: 화면/로컬 = 구버전(보류라 미반영), `_sent` = 신버전(p.hash). 나중에 그 섹션을 편집·저장하면 `collectSections` 가 구버전 해시를 만들고 `_sent(신)≠구버전`이라 changed 판정 → **내 구버전을 서버로 push → 상대의 패치를 덮어쓴다**(치명① — 남의 작업 능동 소실). 프로덕션 재현: 섹션을 선택한 채 방치(=`isUserBusyIn` 이 `.selected` 를 busy 로 판정, `sync.js:81-92`) = 영구 보류 + 오염. duo 3/3 `busy-sent-not-poisoned` FAIL.
  - **수정 제안(제안만)**: `applyPatch` 반환값이 false(보류)면 `_sent` 를 기록하지 않는다 — 보류가 풀려 실제 적용될 때 기록. tick 의 `_sent[...] = p.hash` 를 `if (applyPatch(p)) _sent[...]=p.hash` 로 가드.
- **N3** resync 분기(`sync.js:283`) 미검증: 스텁에 prune 라우트 없어 SKIPPED. 스텁 확장 후 재검 필요.
- **N4** 초대 수락 경로에 collabRef 미기록(`main/collab/index.js` respond): 초대받은 쪽이 수락해도 협업 start 못 함(기능 미작동, 치명 4분류 밖).

---

## 중복 제거 결과
- **undo-untouched@collab(B2) vs A3 dead-undo(B4): 합치지 않음(별개, 둘 다 미확정).** B4 는 serialize 정규화 오염과 얽혀 재현필요, B2 는 협업 초기화 얕은 스택 의심으로 재현필요. 공통 소스결함은 «applyPatch 무체크포인트»(B2)로 별도 항목화 — A3 는 원격 패치와 무관하므로 근본이 다름.
- **otherpage 의 2체크(schedules-autosave=K3, survives-reload=K1)는 원인 하나(B1)** — 기전(K3)과 결과(K1)라 1건으로 셈.
- **duo 리포트의 undo/otherpage fatal 은 standalone 케이스의 재실행**이라 신규 아님(B1·B2에 흡수).

## 종료 카운터 입력
- **이번 사이클 새 확정 치명 = 1건 (B1).** 나머지: 재현필요(B2·B4·B5, N2=치명① 후보) 또는 기각(B3). 재현필요는 «확정»에 안 세므로 카운터는 여전히 1. 연속-2사이클-0 판정에 B1 이 «0 아님»으로 들어간다 → 카운터 리셋.
- **사이클 1 상태 = 종결(Reviewer PASS, 96093e6 재검).** 다음: 사이클 2 = P2 신규 셀(A2·A6·A8·A9·A10) + 재현 3건(B2 계측·B4 raw바이트·B5/N2 clean-duo) + B1 확산 어서션 + resync 스텁 prune 확장. 종료 조건(연속 2사이클 치명 0 ∧ 전 셀 P1~P3 1회) 미충족 — P2·P3 미실행.

---

# 사이클 2 — 새 확정 치명: **2건** (B2, A9 / 중복 제거 후)

리포트 = `<scratchpad>/bugdetect/runs/c2/*.json`(33개). 하네스 `gen-c2/h-*.cjs` + `collab-helpers.cjs`.
사이클1과 같은 3분류 기준(확정/재현필요/기각) 유지. 억지 확정 안 함.

| # | 버그 | 심각도 | 판정 | 근거 표본 |
|---|---|---|---|---|
| C2-B2 | 협업 활성 중 로컬 텍스트편집이 히스토리 체크포인트를 안 남긴다(영영 undo 불가) | 치명② | **확정** | b2 42/77/123 3/3 (editChanged:true·histLen 1→1) |
| C2-A9 | restoreSnapshot 본문 예외 → `_suppressAutoSave` 영구 고착 → 자동저장 영구사망 + ⌘S 초록거짓말 | 치명③ | **확정(구조결함·주입트리거)** | a9-77 (control 42/123 정상복구) |
| C2-B4 | overflow 무동작 undo(중복 스냅샷, raw 바이트 동일) | non-blocker(재분류) | **확정-실재하나 블로커 아님** | b4-42(4건)·b4-77(1건) raw동일, b4-123 clean |
| C2-N2 | busy 보류패치가 `_sent` 오염 → collectSections 오판 | 치명① 후보 | **재현필요(실손실 미관측)** | b5n2 3/3 sent-poisoned·false-changed fatal, no-stale-repro PASS |
| C2-B5 | duo 서버 수렴실패(서버가 A의 secY를 못 가짐) | — | **기각(하네스 아티팩트)** | b5n2 3/3 server-has-both fatal, 원인=forceSave |
| C2-A9K | --kill-during `K4-no-crash` fatal④ | — | **기각(하네스 자기유발 SIGKILL)** | a9-kill-42 target_destroyed, disk-valid PASS |

## C2-B2 — [치명②] 협업 활성 중 로컬 텍스트편집이 undo 스택에 안 남는다 ★확정
- **재현 최소 단계**: 협업 start → 섹션 텍스트 편집(내용 실제 변경) → ⌘Z. 그 편집이 안 되돌아간다(히스토리에 없음).
  - repro.cmd: `node h-b2-undo-checkpoint.cjs --port=<P> --stub=<S> --seed=42 --ud=<UD>` (42/77/123 동일)
- **표본/계측**: `editChanged:true`(편집 실측: "소제목을 입력하세요"→"LOCAL-b2-42"), `histBeforeLen:1 pos:0` → `histAfterEditLen:1 pos:0`. 하네스에 «편집 no-op이면 HARNESS_ERROR» 게이트가 있어 «가짜 편집»이 아님이 보장됨. 비협업(사이클1 A3)에선 같은 editText 가 히스토리를 29까지 쌓았다 → «협업 컨텍스트»가 체크포인트를 억제하는 것이 유일한 차이.
- **원인 파일:라인**: `js/history.js` pushHistory(16, `if(_historyPaused) return`) + `js/collab/sync.js`. ★루트 미확정(협업이 왜 체크포인트를 막나 — `_historyPaused`/`_suppressAutoSave` 고착 또는 collab start의 clearHistory 의심). 관측: 협업 start 후 histLen 이 이미 1(=setup 편집분도 스택에서 증발) → collab start 가 히스토리를 리셋하는 정황도 있다.
- **원인 영역 그룹**: β. undo/히스토리 체크포인트(협업 경로).
- **사이클1 관계**: ★**사이클1 undo-untouched(재현필요)의 런타임 정체를 이걸로 확정** — 그때 로컬 편집이 undo로 안 되돌아간 건 «편집이 체크포인트를 안 남겨서»였다. 단 사이클1 B2(applyPatch 원격 무체크포인트)와는 «별개» — 이 런에서 `B2.patch-no-checkpoint` 는 PASS(undo가 remoteSec을 안 되돌림=undo가 애초에 무동작). 즉 원격-되돌림 harm 은 이번에도 미재현. 로컬-편집-무체크포인트가 새 확정 건.
- **수정 제안(제안만)**: 협업 활성 상태에서도 로컬 편집 커밋 경로가 pushHistory 를 타도록 보장(억제 플래그가 로컬 편집엔 안 걸리게). collab start 가 clearHistory 로 기존 스택을 버리지 않게.

## C2-A9 — [치명③] restoreSnapshot 예외 시 자동저장 영구사망 + ⌘S 초록거짓말 ★확정(구조결함)
- **재현 최소 단계(주입)**: undo 중 `restoreSnapshot`(history.js:45–75)의 동기 본문(innerHTML/rebindAll/applyPageSettings)이 예외 → `requestAnimationFrame(:74)`의 `_suppressAutoSave=false` 해제에 못 감 → 플래그 true 고착 → 이후 «모든» 편집이 자동저장 안 됨(디스크 미기록). 그 상태에서 ⌘S 는 editor.js:1128 이 무조건 «💾 저장됨» 토스트 → 저장실패를 초록으로 은폐.
  - repro.cmd: `node h-a9-fileio.cjs --port=<P> --seed=77 --ud=<UD>` (a9-77 fatal, a9-42/123 control PASS)
- **표본/계측**: a9-77 `suppressStuck:true`, `autosaveAfterStuck ok:false`(6.1s 대기·미저장), `diskHasMarker:false`, `savedToastFired:true`. control(주입 없음)에선 `_suppressAutoSave` 정상 복구+저장됨 → «가짜 빨강» 아님.
- **원인 파일:라인**: `js/history.js:45–75 restoreSnapshot`(try/finally 부재 — 해제가 본문 끝 rAF에만 있음) · `js/io/save-load.js`(autosave가 `_suppressAutoSave` 게이트) · `js/editor.js:1128`(⌘S 무조건 초록 토스트). 장영실 정적감사가 지목한 «try/finally 없는 6곳»(tab-system.js:277·branch-system.js:162,298 등)의 동일 패턴을 restoreSnapshot에서 동적 확정.
- **원인 영역 그룹**: δ. 억제 플래그 해제 무결성(예외 안전).
- **⚠️등급 근거·한계**: 예외를 «주입»해 발현시켰다. 실사용 트리거(비주입으로 restoreSnapshot 본문이 던지는 입력: 손상 스냅샷/자산·rebindAll 엣지)는 아직 못 찾음. 그럼에도 **확정**으로 등급: ⑴누락된 try/finally 는 실코드의 구조결함이고 restoreSnapshot 은 매 undo/redo마다 실행되며 내부 호출들이 던질 수 있다(트리거 존재 개연성 높음), ⑵⌘S 무조건 초록 토스트는 트리거 무관하게 실재. ★엄격 기준을 원하면 «비주입 트리거 확보 시 확정»의 재현필요로 강등 가능.
- **수정 제안(제안만)**: restoreSnapshot 동기 본문을 try/finally 로 감싸 예외 시에도 `_suppressAutoSave=false` 보장(6곳 동일 패치). ⌘S 는 저장 결과(ok)로 토스트 색을 정직화.

## C2-N2 — [치명① 후보·재현필요] busy 보류패치가 `_sent` 를 오염시킨다
- **판정**: 소스확정 잠재결함, **실손실 미관측 → 재현필요.** 오염 기전(`N2.sent-not-poisoned`·`N2.collectSections-no-false-changed`) 3/3 fatal 은 실재(sync.js:291–294: `for(const p of r.patches){ applyPatch(p); _sent[key]=p.hash; }` — applyPatch 가 USER_BUSY로 false 반환(보류)해도 다음 줄이 반환값 무시하고 `_sent` 를 신버전으로 기록). 결과: 화면=구버전, `_sent`=신버전 → collectSections 가 그 섹션을 «changed»로 오판.
- **왜 확정 못 하나**: 종착 harm(내 구버전이 서버로 재업로드돼 상대 신버전을 덮음)인 `N2.no-stale-repropagation` 이 3/3 **PASS**. ★그런데 이 PASS 는 «안전»이 아니라 «미구동»이다 — 하네스가 push 를 `forceSave`(=flushSave, 디바운스 우회)로 태우는데, 앱의 push(`pushChanged`)는 **오직 디바운스 자동저장의 `gd:project-saved` 이벤트**로만 발화한다(sync.js:371–375, 이벤트는 save-load.js:1324 scheduleAutoSave 에서만 dispatch). ⇒ forceSave 는 push 를 «한 번도» 안 태워서 stale 재전파가 원천적으로 안 일어난다. 오염은 무장됐으나 방아쇠 경로를 이번 하네스가 못 당겼다.
- **재현 요청**: secX busy 오염 상태에서 «진짜 디바운스 자동저장»(scheduleAutoSave→gd:project-saved)을 태워 pushChanged 를 구동한 뒤 서버 timeline 에 oldX 재업로드가 찍히나 확인. 찍히면 **치명① 확정 승격**.
- **원인 파일:라인**: `js/collab/sync.js:294`(보류/미적용 패치까지 `_sent` 기록) · 150(`changed = secs.filter(s => _sent[s.key] !== s.hash)`).

## C2-B5 — [기각·하네스 아티팩트] duo 서버 수렴실패
- **판정**: 기각. `B5.server-has-both` 3/3 fatal(서버 최신 secY 가 A의 로컬 편집과 불일치)은 **앱 결함이 아니라 하네스가 push 를 못 태운 것**. A의 secY 편집은 `forceSave`(flushSave)로 디스크엔 저장됐으나, 협업 push 는 디바운스 자동저장의 `gd:project-saved` 로만 발화(위 N2 참조) → forceSave 는 그 이벤트를 안 쏨 → 앱이 secY 를 서버로 안 올림. 서버의 secZ 는 ghost 가 스텁 API로 «직접» 올린 것이라 앱 push 와 무관. 로컬 수렴(`B5.local-edit-preserved`·`B5.remote-edit-applied`)은 3/3 PASS.
- **재현 요청**: 편집을 «진짜 자동저장 디바운스»로 태우는 clean-duo 로 재검해야 서버 수렴을 유효 판정.
- **★부수 실재 관찰(non-blocker/재현필요)**: 협업 push 가 «디바운스 자동저장 이벤트»에만 걸려 있다 — forceSave/flushSave/beforeunload 등 다른 저장 경로는 로컬 편집을 협업 서버로 «전파하지 않는다». N1(gd:project-saved 미발화)과 결합하면 로컬 편집이 조용히 미전파될 위험. 이번 하네스로는 치명 확정 불가, 설계 리스크로 기록.

## C2-B4 — [non-blocker 재분류] overflow 무동작 undo(중복 스냅샷)
- **판정**: 실재하나 «블로커 아님»으로 재분류. `B4.no-real-dead-undo` 42(4건)·77(1건) fatal 은 raw 바이트 완전동일(`rawEqual:true`,`firstDiffAt:-1`)로 정규화 아티팩트가 «아님»을 증명 — 히스토리 스택에 중복 스냅샷이 실재하고 그 사이 undo 는 무동작. `B4.normalization-masking` PASS(정규화 오염과 정확히 분리). 123 clean(시드 의존).
- **왜 non-blocker**: 치명 4분류 어디에도 «깨끗이» 안 맞는다 — 데이터 유실/변형·파일손상·크래시 아님. undo→redo «최종 상태 불일치»도 미입증(중복 스냅샷은 그 편집을 스택에 «갖고» 있어 여분 클릭이면 넘어감). = undo 체감 품질 저하(non-blocker). 사이클1 B4(재현필요)를 이걸로 «실재하나 non-blocker»로 종결.
- **B2 와 별개 유지**: B4=순수 로컬 deep-stack 중복 스냅샷, B2=협업 활성 시 편집 무체크포인트. 트리거·기전 상이 → 별개.
- **원인 영역**: β + α. `js/history.js` 16–28·145–160(pushHistory 중복 미가드·MAX_HISTORY shift).

## non-blocker (기록만, 사이클2)
- **A6** `pasted-children-keep-actor` 3/3(non-blocker): 붙여넣기 자식 2-part id 가 actor 조각 탈락(`editor.js:854` vs `:1009` 불일치). `no-duplicate-ids-after-clone` 3/3 PASS(치명① 없음).
- **A8** `png-export-covers-all-pages` 부분결과(non-blocker).
- **A10** `static-uncaught-promise-candidates` 정적 후보 목록(non-fatal), fatal 0.
- **A2** clean(compact 명확거부 non-blocker), fatal 0.
- **B1 재확인**: `otherpage-schedules-autosave`+`otherpage-survives-reload` 3/3 fatal 로 사이클1 B1 재확인(신규 아님). 확산 검사는 미발생(PASS).

## 중복 제거 결과 (사이클2)
- **B2 vs 사이클1 B2**: 뿌리 다름(로컬편집 무체크포인트 vs applyPatch 원격 무체크포인트). B2 는 사이클1 undo-untouched 의 런타임을 확정하나, 원격-되돌림 harm 은 여전히 미재현. → B2 를 «신규 확정»으로 셈.
- **B2 vs B4**: 별개(협업 vs 순수로컬 overflow) — 유지.
- **N2 vs B5**: B5 는 N2 의 결과가 «아니다». 둘 다 실은 «pushChanged 가 디바운스 이벤트에만 걸림»을 드러낸 것. N2=오염(재현필요), B5=기각(하네스), 공통 설계리스크는 non-blocker 기록.
- **A9 kill K4 vs A9 예외주입**: 별개. kill-K4 는 기각(자기유발), 예외주입은 치명③ 확정.

## 종료 카운터 입력 (사이클2)
- **이번 사이클 새 확정 치명 = 2건 (C2-B2 치명②, C2-A9 치명③).** ★A9 를 «주입트리거»로 엄격 강등하면 **1건(B2)**. 재현필요=N2, 기각=B5·A9K, 재분류 non-blocker=B4.
- **연속 2사이클 새 치명 = 사이클1 1건 + 사이클2 2건 → 0 아님. 카운터 리셋 유지, 종료 불성립.** (P2 셀 다수 이번에 첫 실행 — 커버리지도 아직 미완, P3 잔여.)

---

# 사이클 2 — Planner 판정 (Evaluator 세션한도 사망으로 Planner 소스규명 + Reviewer 감사 대행)

⚠️eval-c1 이 세션 한도로 죽어(13:20 리셋) 재스폰 위험. 소스로 확정되는 판정은 Planner 가, 견제는 Reviewer 가 Evaluator 역할 겸해 감사.

| # | 버그 | 심각도 | 판정 | 근거 |
|---|---|---|---|---|
| C1 | B2 협업 중 로컬 텍스트편집이 히스토리 체크포인트 안 남김 → 영영 undo 불가 | 치명② | **확정** | b2 3/3, histBeforeLen 1→histAfterEditLen 1(편집했는데 스택 안 늘어남) |
| C2 | B4 overflow 무동작 undo | 치명② | **확정** | b4 42·77 raw canvas 바이트 동일(정규화 아님, 진짜 dead undo). 123 clean |
| C3 | A9 restoreSnapshot 예외 후 `_suppressAutoSave` 고착 = 자동저장 영구사망 + ⌘S green-lie | 치명③ | **확정** | a9 seed77, control 정상복구 확인 후 주입 실발화. ★장영실 정적감사① 동적 확정 |
| C4 | N2 보류 패치 `_sent` 오염(sync.js:294) | 치명① 후보 | **오염 확정·완전손실 미관측** | N2.sent-not-poisoned+collectSections-false-changed 3/3. 단 no-stale-repropagation 3/3 PASS |
| C5 | B5 협업 두 편집이 서버에서 둘 다 안 남음(수렴 실패) | 치명① 후보 | **재현확정·인과 재규명** | server-has-both 3/3: A의 secY 최신(fdd8c5c8)이 서버엔 구버전(5c8c90da) — A 편집 서버 미반영. N2 여파인지 push 타이밍인지 별개인지 소스추적 필요 |
| C6 | A9 --kill-during K4-no-crash fatal④ | 기각 후보 | **하네스 SIGKILL 오판 의심** | disk-valid-after-kill PASS. 하네스 스스로 SIGKILL 한 CDP 종료를 크래시로 주움 |
| C7 | A6 붙여넣기 자식이 2-part ID(actor 탈락) | non-blocker | 기록 | pasted-children-keep-actor: editor.js:854 _bindPastedEl 이 _gid(3-part)를 prefix_rand(2-part)로 덮음. 전역 중복ID(치명①)는 없음(clean) |
| C8 | A8 PNG 전체섹션이 현재페이지만 · A2 compact .gdt 명확거부 | non-blocker | 기록 | 장영실⑤ / import.js 바이트열 형식 취약 |

## 중복 제거 (사이클1과의 관계)
- ★**사이클1 B2(applyPatch 무체크포인트, 재현필요) = C1 과 «같은 뿌리»** — 둘 다 «협업 수신·편집이 undo 스택에 안 남는다». C1 이 사이클1 B2 를 «확정»한다(1건으로 합침, 치명②).
- ★**사이클1 B4(재현필요) = C2 로 확정**(raw 바이트 동일 = 진짜 dead undo).
- ★**사이클1 B5(재현필요)+N2 = C4·C5 로 분해** — 오염(C4 확정)과 수렴실패(C5 재현확정·인과규명)는 별개 축.
- 사이클1 B1(확정)은 사이클2 재확인, 확산은 PASS(미발생).

## 종료 카운터 입력
- **이번 사이클 새 확정 치명 = 3건 (C1 치명②·C2 치명②·C3 치명③).** + C4·C5 는 치명① «후보»(오염/수렴 확정이나 완전손실 인과 재규명 대기 → 카운터엔 «미포함»). C6 기각후보, C7·C8 non-blocker.
- ⇒ **연속-2사이클-0 판정: 사이클1(B1 1건)·사이클2(3건) 둘 다 «0 아님» → 카운터 리셋. 사이클 3 필요.**
- **전 셀 조건**: P1(사이클1)·P2(사이클2) 실행 완료. P3(A7 자산외부화·E2E) 미실행 → 종료 이중전제 미충족.
