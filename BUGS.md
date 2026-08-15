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
