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
- **★사이클3 계측 요청(Reviewer)**: undo()가 tip 에서 «항상» ensureHistoryCheckpoint 를 시도하므로(history.js:80–82) 편집 체크포인트가 0이어도 ⌘Z 한 번이면 정상 복귀해야 한다. histLen 1·pos 0 고정 + undo 완전 무동작 = ensureHistoryCheckpoint «까지» 죽음 → 유력 용의자 **`_historyPaused` 고착**(window getter 노출 history.js:184). ⇒ b2 하네스 재현에 `_historyPaused`·`_suppressAutoSave` 기록 한 줄 추가하면 루트가 한 방에 갈린다(C2-A9 동반결함과 같은 뿌리 가능성).

## C2-A9 — [치명③] restoreSnapshot 예외 시 자동저장 영구사망 + ⌘S 초록거짓말 ★확정(구조결함)
- **재현 최소 단계(주입)**: undo 중 `restoreSnapshot`(history.js:45–75)의 동기 본문(innerHTML/rebindAll/applyPageSettings)이 예외 → `requestAnimationFrame(:74)`의 `_suppressAutoSave=false` 해제에 못 감 → 플래그 true 고착 → 이후 «모든» 편집이 자동저장 안 됨(디스크 미기록). 그 상태에서 ⌘S 는 editor.js:1131-1135 이 무조건 «💾 저장됨» 토스트 → 저장실패를 초록으로 은폐.
  - repro.cmd: `node h-a9-fileio.cjs --port=<P> --seed=77 --ud=<UD>` (a9-77 fatal, a9-42/123 control PASS)
- **표본/계측**: a9-77 `suppressStuck:true`, `autosaveAfterStuck ok:false`(6.1s 대기·미저장), `diskHasMarker:false`, `savedToastFired:true`. control(주입 없음)에선 `_suppressAutoSave` 정상 복구+저장됨 → «가짜 빨강» 아님.
- **원인 파일:라인**: `js/history.js:45–75 restoreSnapshot`(try/finally 부재 — 해제가 본문 끝 rAF에만 있음) · `js/io/save-load.js`(autosave가 `_suppressAutoSave` 게이트) · `js/editor.js:1131-1135`(⌘S 무조건 초록 토스트). 장영실 정적감사가 지목한 «try/finally 없는 6곳»(tab-system.js:277·branch-system.js:162,298 등)의 동일 패턴을 restoreSnapshot에서 동적 확정. ★**「같은 절반」 교훈(Reviewer)**: 장영실 정적감사와 내 동적탐지가 «같은 결함»에 도달했지만 실은 «같은 절반»(_suppressAutoSave 사망)만 봤고 _historyPaused 동반사망은 «둘 다» 놓쳤다 — 서로 다른 방법이 같은 결함에 수렴해도 «같은 사각»을 공유할 수 있다. 수렴이 완전성을 뜻하지 않는다.
- **원인 영역 그룹**: δ. 억제 플래그 해제 무결성(예외 안전).
- **★동반 결함(Reviewer 감사 추가) — `_historyPaused` 도 같이 고착된다(치명② 동반)**: `restoreSnapshot`(history.js:46 `_historyPaused=true` → 해제 :67)의 해제도 «예외 지점 뒤»라, 본문 예외 시 `_suppressAutoSave` 와 «함께» 고착된다. 그러면 `pushHistory`(:16 `if(_historyPaused)return`)·`ensureHistoryCheckpoint`(:146) 가 전면 차단 = **자동저장 사망 + 히스토리 사망 동반**. ★이 용의선은 C2-B2 의 「협업 중 체크포인트 안 남김」루트(_historyPaused 고착 가설)와 만난다 — 사이클3 계측에서 함께 확인.
- **★「영구」 서술 정정(Reviewer)**: `_suppressAutoSave` 고착은 «영구»가 아니라 **«다음 복구 이벤트까지의 창»**이다 — 복구 경로가 소스에 여럿(탭전환 tab-system:295·324, 프로젝트 로드 save-load:309·523, 원격 패치 sync:250, 드래그 ESC). 정확히는 «그 창 안의 편집분이 ⌘S 초록거짓말 뒤에서 조용히 유실, 그 창에서 종료하면 확정 유실». 단 `_historyPaused` 쪽은 후속 undo/redo 성공 시에만 복구되고 손상 스냅샷이 원인이면 같은 throw 반복 = 그쪽은 진짜 영구. 치명③ 등급엔 지장 없음 — 서술만 정직화.
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

## 사이클 3 계획 (Reviewer 감사 반영)
- **P3 미실행 셀**: A7(자산 외부화·goya-asset 참조 유실 → 로드후 유실 치명①) · E2E(Playwright, 단 CDP 의존 하네스라 재설계 필요).
- **재현 3건 계측**: ⑴C2-B2 — b2 하네스에 `_historyPaused`/`_suppressAutoSave` 기록 추가(루트 한 방에 갈림) ⑵C2-N2/B5 — clean-duo 를 «진짜 디바운스 자동저장»(scheduleAutoSave→gd:project-saved) 경로로 태워 push 실구동(forceSave 우회 아님) → secX 재전파·secY 서버수렴 유효판정 ⑶C6 — 하네스에 «expected-kill 창» 플래그로 그 창의 target_destroyed 는 K4 자동제외.
- **종료 조건**: 사이클3 치명 0이면 «연속 1회». 사이클4도 0이어야 «연속 2회» 성립(+P3 실행 완료). 지금 카운터 = 리셋 상태.

## 종료 카운터 (정정 — Planner 대행판정 철회, eval-c1 정본 채택)
⚠️Planner(지디)가 eval-c1 세션한도 사망을 «판정 못 하고 죽음»으로 오판해 대행 판정(3건)을 덧붙였으나, eval-c1 은 죽기 전 판정을 완성해 위 «사이클2» 섹션에 남겼다. Reviewer 감사로 그 정본을 채택하고 대행분(45dba25 하단)은 철회했다. **정본 = 새 확정 치명 2건(C2-B2 치명②·C2-A9 치명③).** 사이클1(1)+사이클2(2)=0 아님 → 카운터 리셋, 사이클3 필요.
★교훈: 서브에이전트가 «세션한도로 죽었다»고 그 «산출물이 없다»고 가정하지 마라 — 파일부터 확인. (오늘 「상태를 읽고 행동」 규율의 Planner 판.)

---

## 사이클 3 — 수정 페이즈 전환(현빈 ⑵) + 재판정 무장

**결정**: 현빈 ⑵ — 「지금 고치기 + 안 본 영역(A7·E2E) 마저」. **사이클 4·5 취소.** 탐지→수정 전환. 종료조건은 §11(수정 페이즈: 확정 3건 빨강→초록을 «실데이터»로 + 양성대조 + 전체사이클 1회 회귀0).

**수정 진행(dev, 단계별 커밋·한버그마다 회귀·새결함은 BUGS만)**:
- ✅ **C2-A9 치명③** = `44c91ed`. restoreSnapshot try/finally — 봉쇄구간 예외 시 _historyPaused·_suppressAutoSave 영구고착 방지, 예외는 그대로 전파, 가드해제를 UI갱신보다 앞당김. **검증 초록(실데이터)**: baseline seed=77에서 undo가 실제 예외를 탔는데도(undoThrew:true) suppressStuck=false + 원시 proj.json에 편집 마커 실재. 양성대조 회귀0.
- ✅ **B1 치명①** = `b1bc7e3`. applyPatch other-page 경로에 `scheduleAutoSave()` — DOM 미경유(→MutationObserver 미발화)로 자동저장 미트리거되던 수신 변경을 디스크에 남긴다. **검증 초록(실데이터)**: baseline 3시드(otherpage-survives-reload:false) → 수정 후 전부 반전, 원시 proj.json에 다른-페이지 마커(REMOTE-B1-*) 실재. ★**echo 없음(실측)**: 서버 타임라인에서 ghost push 이후 앱 재-push 기록 3시드 전부 0건(디바운스라 _sent 선기록 뒤 저장→pushChanged, _sent[key]===hash로 재전파 없음 — 독해가 실측으로 확증). 양성대조 회귀0.

**gen-c3 하네스 5개 완료(코드작성만·미기동·node --check 통과)**:
- `h-b2-c1-root`(C2-B2 판정) — 매 경계 _historyPaused(getter :184)·_suppressAutoSave·len/pos 동기 실독. `extra.C2B2_verdict` 한 줄 산출: RESOLVED / ROOT_IS_HISTORYPAUSED_STICK / SEPARATE_CAUSE / CHECKPOINT_LEFT_BUT_UNDO_STILL_WRONG.
- `h-b5n2-realdebounce`(N2 재판정) — ★사이클2 N2 `no-stale-repropagation` PASS가 «안전»이 아니라 «미구동»(forceSave=flushSave가 gd:project-saved 미발화 → pushChanged 원천 미구동)이었음을 코드로 재확정. triggerAutoSave→gd:project-saved→pushChanged 진짜 경로로 정정 → N2 치명① 유효판정 가능. Executor 재실행 필수.
- `h-a7-assets`(A7 ①③), `h-e2e`(E2E ④+회귀·정적감사+격리런타임), `h-a9-c6`(C6 SIGKILL 중 proj.json 유효성 ③④, expected-kill 창 K4 자동제외).

**대기 순서**: exec가 B1 검증 후 → `h-b2-c1-root`(C2-B2 판정) + `h-b5n2-realdebounce`(N2 재판정) → A7 탐지(별도 마음가짐) → 전체 회귀.

**forceSave 범위 조사(server-manager 요청 — N2 미구동이 다른 하네스에도 있나)**: forceSave/flushSave로 «로컬→원격 push/수렴»을 판정한 하네스 = **h-b5n2-cleanduo(N2/B5)뿐**. h-a5-collab은 방향이 원격→로컬(ghostPush로 서버 채움 · serverHasGhost/I8.1-converge = 원격→로컬 반영 확인)이라 미구동과 무관. h-a1/a4/a8은 server-has류 단언 0건(로컬 저장-로드·계측). ⇒ ★미구동 초록 범위 = N2/B5 하나, 이미 h-b5n2-realdebounce로 정정됨. 새로 무효화될 «확정 치명» 없음.

### N2 검증 — 초록(실데이터) ✅ 수정 `d8d7169`
h-b5n2-realdebounce 재실행(runs/fix4): 서버 raw 타임라인에서 **seq6(앱 stale 재-push) «완전 소멸»**(seq1→seq5로 끝), sentPoisoned:false 3시드. 양성대조: B5 수렴·정상 push 유지(applied 가드가 정상 적용경로 안 막음). sanity(gd:project-saved 실발화 savedReceipts ok) 통과. ⇒ N2 = 치명① 확정→수정→검증초록.

### C2-B2 — 원인 재조사 (SEPARATE_CAUSE, 진위 «측정 필요»)
verdict=SEPARATE_CAUSE(_historyPaused·_suppressAutoSave 정상인데 checkpointLeft:false, editChanged:true). ★독해 발견: **editor.js·block-factory.js 어디에도 «텍스트 타이핑(contenteditable input)→pushHistory» 리스너가 없다** — pushHistory는 전부 명령형 동작(타입변경 editor.js:1504·블록추가·삭제)에만. editor.js에 collab 인식 0건(협업이 pushHistory를 명시 억제하는 코드 없음). 하네스 editText(lib/ops.js:63)는 편집진입 없이 textContent 직접설정+합성 InputEvent.
⇒ ★3갈래 미확정: ⑴진짜 협업 버그 ⑵하네스 합성이벤트 아티팩트(실제 네이티브 편집 아님) ⑶설계(텍스트=브라우저 네이티브 undo, 협업 outerHTML 교체가 그 스택을 날림). **정밀 측정(비협업 대조 + 실제 키 편집 undo가 화면텍스트를 되돌리나) 후 수정 여부 결정.** ⛔원인 확정 전 수정 금지.

## C2-B2 정밀측정 — 판정 «닫음»: 스코프 오류(협업무관 설계갭) + C7 신규 치명② 발견
**측정(runs/fix5 · CDP 네이티브 Input.insertText + 진짜 Meta+Z)**:
- A 협업/비협업 대조: 둘 다 checkpointLeft:false 동일 → 협업 무관(둘 다 처음부터 깨짐).
- B 합성vs실제: 실제 네이티브 삽입+네이티브 ⌘Z도 실패(nativeUndoReverted:false, blur 유무 무관). ★타이핑이 window.state.pages[].canvas에 반영 안 됨(stateBeforeBlur/After:false).
- ⇒ ⑴기각(협업무관) ⑵기각(실제도 실패, 하네스 탓 아님) ⑶전제틀림(네이티브undo가 협업무관하게 애초에 작동한 적 없음).

**판정**: C2-B2(협업 중 텍스트 undo)는 «협업 특정 버그 아님». 실제 = 타이핑이 앱 undo 시스템 어디에도 안 걸리는 **전사적 설계 갭**(협업 무관·항상). ⇒ 「협업 중 텍스트 undo」로 좁힌 별도 수정 = 과녁 오류 → **기각/재정의**.
⚠️미확인: 「타이핑 저장 유실」 여부. 저장은 getSerializedCanvas가 DOM을 읽으므로 유실 아닐 것(독해)이나 실측 예정 — 유실이면 치명①.

## C7 — [치명②] 원격패치 수신이 historyStack을 통째 리셋 ★신규 확정
- **측정(runs/fix5)**: 원격패치(다른 섹션 outerHTML 교체) 수신 직후 historyStack len 12→1, pos 10→0. seed 42/77 2회 정확히 동일 재현.
- **원인 확정(독해)**: applyPatch(`sync.js:245` rebindAll 호출) → rebindAll(`save-load.js:702`) `if(!window._historyPaused) window.clearHistory?.()`. 원격 수신 시 _historyPaused=false라 clearHistory 실행 → 스택 리셋. 가드는 «undo/redo 복원(_historyPaused)»만 예외로 하고 «협업 수신」은 예외 없음(주석 L701이 정확히 이 위험을 알지만 협업 경로 미포함).
- **harm**: 협업 중 커맨드 기반 편집(섹션 추가/삭제 등)의 undo 이력이 원격 패치 하나에 통째로 사라진다 = 협업 중 undo 오작동(치명②).
- **수정 제안(제안만·정식 단계에서)**: applyPatch의 rebindAll 구간을 restoreSnapshot과 대칭으로 «히스토리 보존」 처리 — rebindAll clearHistory 가드를 «_historyPaused || 협업적용중»으로 확장하거나 applyPatch가 rebindAll 전 보존 플래그 세움. ⛔C2-B2 측정 중 발견이므로 그 자리서 안 고침(범위 추적).

### ⚠️ C2-B2 판정 정정 — 「스코프오류/설계갭」 보류, 재측정 (deselectAll 경로 발견)
_historyPaused 전수 훑기(C7 수정 준비) 중 **editor.js:1959-1961** 발견: 텍스트 편집 체크포인트는 «blur»가 아니라 **deselectAll 시 .editing 블록 pushHistory('텍스트 편집')**로 남는다(주석: "입력한 텍스트가 undo 복원 대상이 되도록"). ★이전 measure(runs/fix5)는 blur만 쐈지 «.editing 편집모드 진입 + deselectAll»을 안 태웠을 수 있다 → editingBlock=null이면 pushHistory 안 됨 = checkpointLeft:false가 «측정이 실제 편집흐름을 안 태운 아티팩트」일 가능성.
⇒ C2-B2 «전사적 설계갭/과녁오류」 판정 **보류**. 진짜 사용자 흐름(.editing 진입→네이티브 타이핑→deselectAll→⌘Z)으로 재측정(runs/fix7). ★교훈: 「내가 만든 틀은 내가 못 본다」 — 이번엔 measure 설계가 틀이었고 «독해(전수 훑기)»가 그 틀을 깼다(측정만 틀을 깨는 게 아니다). ⛔치명① 배제(타이핑 저장 보존)는 유효 — 저장은 DOM 직렬화라 undo 여부와 무관.

### C2-B2 재측정 — 최종: 측정 아티팩트(실 undo 정상) ✅ runs/fix7
진짜 흐름(CDP 더블클릭→.editing 진입→네이티브 타이핑→deselectAll→⌘Z): .editing 진입성공·deselectAll 후 len 증가(dblclick 1회 block-drag.js:606 + deselect 1회 editor.js:1959 = 2체크포인트)·⌘Z 텍스트 실복원·window.undo() 동일·협업무관. 3런 일관. **이전 measure 실패원인**: contenteditable 직접세팅+포커스만(실제 편집진입 미태움) + blur 후 contenteditable=true라 Cmd+Z가 editor.js:1116 isContentEditable 가드에 걸려 undo() 미호출·네이티브 양보. ⇒ ★C2-B2 = 제품결함 아님, 이전 계측 결함. **별도수정 불필요.** 사이클2 「치명② 확정」도 같은 편집방식 아티팩트였음이 소급 확인.
- non-blocker: secE(편집 중 포커스 유지한 채 즉시 ⌘Z) = isContentEditable=true 동안 앱이 네이티브 undo에 의도적 양보(editor.js:1116). 좁은 서브케이스, 표준 흐름 무관.

### C7 수정 — rebindAll preserveHistory 가드 (치명②)
save-load.js rebindAll(opts) + L702 `!opts.preserveHistory` 가드 + sync.js applyPatch가 rebindAll({preserveHistory:true}). 협업 수신 시 clearHistory 스킵→historyStack 보존. 로드/전환/restoreSnapshot(_historyPaused=true) 등 다른 경로는 인자 없어 기존대로 clearHistory. _historyPaused 오버로드 회피(별도 플래그). 검증 대기.

### _historyPaused 전수 결론 (server-manager 지적 — 공통축 세번째 확인)
사용처 3: ①history.js(정의·pushHistory/ensureHistoryCheckpoint 가드·restoreSnapshot try/finally=C2-A9) ②editor.js:1959(deselectAll 텍스트 체크포인트 — _historyPaused 가드 «정상», undo복원 중 편집체크포인트 안 남기려는 의도) ③save-load.js:702(rebindAll clearHistory=C7). ⇒ 세 번째 결함 «없음», C7만 협업 미가드. C2-A9(해제보장)·C7(협업 미가드)이 같은 변수의 다른 실패면.

### 수정 페이즈 확정 치명 총괄
✅ C2-A9(치명③) · ✅ B1(치명①) · ✅ N2(치명①) · 🔄 C7(치명②·검증중). C2-B2 = 아티팩트(제외). 타이핑 저장유실(치명①) 배제됨.

### C7 검증 — 초록(실데이터) ✅ 수정 d6c9b31
runs/fix8: 원격패치 수신 시 lenPreserved:true·lenResetToOne:false(baseline 12→1과 반전, 4시도). undo 실동작: 원격패치 후 undoRemovedNewSection:true(추가 섹션 화면서 실제 사라짐, 실 DOM). 양성대조: 새 페이지전환·재로드 시 clearHistory 정상 발화(resetHappened:true, preserveHistory가 협업만 스킵)+재기동 후 addSection으로 스택 살아있음 → 회귀0. sanity(patchApplied) 통과.
⇒ ★확정 치명 4건 전부 실데이터 초록: **C2-A9·B1·N2·C7.**

### C8 후보 — [B2 계열·측정필요] undo가 원격패치를 함께 되돌린다
C7 검증 부수관찰: 원격패치 수신 후 내 커맨드 편집을 undo하면 remoteMarkerSurvivesUndo:false — 원격패치 내용도 함께 사라진다. 스냅샷 기반 undo(그 시점 캔버스 전체 복원) 설계의 부수효과. ★C7이 만든 게 아님(C7 전엔 len 리셋으로 undo 무의미해 관측조건 자체가 없었음). 원래 B2(사이클1: applyPatch가 pushHistory 미호출 → undo가 손 안 댄 remoteSec을 패치 이전으로 되돌림)와 같은 자리. harm 가설: 협업 중 ⌘Z가 상대 변경 되돌리고 재전파되면 상대 작업 소실(치명① 가능). ⛔수정 중 발견이라 그 자리서 안 고침 — 측정 필요로 등록.

### A7 자산외부화 탐지 — 새 치명 없음, ⑶⑤ non-blocker ✅ runs/a7
★패키지 하네스 h-a7-assets.cjs 자체 버그로 판정불가(addAssetBlock('standard',{src})인데 앱은 opts.imgSrc만 소비→빈 asset-block; inlineCount sanity도 imageGallery 프리셋 svg에 오탐→EXTERNALIZE_DID_NOT_HAPPEN 종료4). ⇒ 하네스 결함·앱 정상. **올바른 API(setAssetImageFromSrc) CDP 수동재현으로 4시나리오 완주(코드수정0)**:
- ①② 외부화·참조축: 무해. base64 8→0, goya-asset 참조 재기동 후 실재·정상렌더·dedup 정상. **치명① 아님.**
- ⑵ 자산삭제가 섹션 삼키나: 무해(섹션 보존).
- ⑶ 깨진이미지 = ★침묵 확정(non-blocker). onerror 폴백을 sanitizeCanvasHtml(GAP-006 RCE방지 line36 on* 제거)이 매 저장→재로드마다 무력화 — 앱 보안소독기가 앱 폴백을 지운다. 데이터유실 아님(섹션·proj.json 유효).
- ⑤ export 재인라인: 없는 자산이 goya-asset:// URL로 export HTML에 잔존(경고없음). non-blocker.
- 부수: location.reload는 Chromium 캐시가 삭제파일 서빙 → Electron 완전 재기동해야 콜드리드(재현 유의점).
⇒ ★치명①②③④ 문턱 안 넘음. 새 치명 아님. ⑶⑤ = 검증된 UX-신뢰성 non-blocker(수정제안: onerror 인라인 대신 로드후 addEventListener 프로그래매틱 재부착).
