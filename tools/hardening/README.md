# tools/hardening — «망가뜨리기» 하네스 (H7)

고장을 **일부러** 일으키고, 그때 앱이 어떻게 구는지를 **잰다.**
H2(크래시 기록)·H3(복구 다이얼로그)·H4(조용한 종료 금지)·H5(손상 통지)·H6(자동저장 고착)의
「고쳐졌다」를 판정하는 **자**다. 이 자가 부실하면 그 다섯의 초록이 전부 가짜가 된다.

---

## 0. 30초 사용법

```bash
# ⑴ preflight — ⛔«별도 명령»으로. 종료코드를 «변수»에 받아라(파이프 금지: $? 가 깨진다)
bash ~/.claude/skills/goditor-qa/tools/preflight.sh 9391 지디_qa_h7 --standing 2 > /tmp/pf.out 2>&1
EX=$?; echo "PREFLIGHT_EXIT=$EX"
[ "$EX" = "0" ] || { echo "FAIL — 실행 금지"; grep '✗' /tmp/pf.out; exit 1; }

# ⑵ 시나리오 (별도 명령)
node tools/hardening/run.mjs crash-renderer --port 9391 --out /tmp/h7-crash.json

# ⑶ 판정기 자체가 성한지 (Electron 안 띄움 · 5초)
node tools/hardening/selfcheck.mjs
```

**종료코드**  `0` 판정 통과 · `1` 판정 «불통과»(실제 결함) · `3` **HARNESS_ERROR**(판정 자체가 성립 안 함).
⛔`3`을 `1`로 접지 마라. 접는 순간 「도구가 고장난 것」이 「제품이 멀쩡한 것」으로 읽힌다.

---

## 1. 시나리오 (`run.mjs <시나리오>`)

| 시나리오 | 무엇을 부수나 | 무엇을 재나 | 주로 쓰는 단위 |
|---|---|---|---|
| `baseline` | **아무것도 안 부순다** (양성대조) | 정상에서 판정기가 빨개지지 않는지 | 전부 |
| `crash-renderer` | CDP `Page.crash` | 크래시 기록 생성 · 손실 창 · 3채널 판정 | **H2·H3** |
| `crash-gpu` | CDP `Browser.crashGpuProcess` | 앱 생존 여부 · 기록 | **H2** |
| `hang` | 렌더러 busy loop | 무응답 지속 시간 · 회복 시간 | H2(unresponsive) |
| `kill9-midsave` | `proj.json.tmp` **출현 순간** SIGKILL | I7(디스크 JSON 유효) · tmp 잔재 · 손실 창 | **H4** · 롤링백업 변경 |
| `deny-write` | `projects` 폴더 `chmod 000` | 인디케이터·토스트 · 종료가 막히나 | **H4** |
| `corrupt-half` | `proj.json` **만** 반쪽 | 기존 폴백 체인이 사는지(**양성대조**) | **H5** |
| `corrupt-all` | proj·backup·history **전부** 반쪽 | 빈 캔버스로 «조용히» 열리는지 | **H5** |
| `corrupt-sidecar` | history 가 사이드카뿐 | A2 치명(사이드카 채택) 재발 감시 | H5 |

**옵션**
`--port N`(9350~9399) · `--corpus`(39MB 코퍼스 **사본** — C8) · `--pad-kb N`(저장 시간을 늘려 kill9 창을 벌린다) ·
`--edits N`(손실 창 측정용 편집 횟수) · `--deadline-ms N`(전역 상한, 기본 480000) · `--out FILE` · `--keep`

---

## 2. 판정기 (`judge/`)

| 자 | 무엇을 말하나 | NOT_MEASURED 가 되는 때 |
|---|---|---|
| `i7.mjs` | 디스크의 프로젝트 JSON이 **전부 유효**한가 (`isProjectShaped` 는 **제품 모듈에서 require**) | 폴더가 막혔거나(선언된 deny·EACCES) 검사할 JSON 이 0개 |
| `lost-window.mjs` | **몇 초분**의 편집이 사라졌나. `lossWindowMs`(잃은 시간)와 `diskLagMs`(디스크가 뒤처진 폭)를 **가른다** | 편집을 한 번도 안 함 |
| `pii.mjs` | 기록물이 새는가 — 표본 **세 종**(홈 경로 · 코퍼스 본문 3 · goya-asset 파일명) | 어느 축이든 표본 0개 / 검사할 파일 0개 |
| `crashlog.mjs` | H2 의 `logs/crash-*.json` 이 생겼나 · 스키마 · 미러 마커 도착 | `logs` 가 막혀 있음 |
| `ui-state.mjs` | 토스트·저장 인디케이터·링버퍼 — 「사용자가 아는가」 | **수집기 자가증명 실패** |

⛔**「못 쟀다」를 「없다/깨끗하다」로 읽지 마라.** 이 규칙은 장식이 아니다 — 개발 중 이 하네스가
**자기 자신을 세 번** 이 함정에서 잡았다(§5).

---

## 3. H2~H6 담당자용 — 그대로 복붙

### H2 (크래시 기록) — 골 C2
```bash
bash ~/.claude/skills/goditor-qa/tools/preflight.sh 9391 지디_qa_h7 --standing 2 > /tmp/pf.out 2>&1; EX=$?
[ "$EX" = 0 ] && node tools/hardening/run.mjs crash-renderer --port 9391 --corpus --out /tmp/h2-crash.json
# 봐야 할 것
node -e "const r=require('/tmp/h2-crash.json');
  console.log('기록:', r.judges.crashLog.verdict, r.judges.crashLog.summary);
  console.log('PII :', r.judges.pii.verdict, r.judges.pii.summary);
  console.log('판정유효(3채널):', r.breaker.fatalVerdictValid, JSON.stringify(r.breaker.channels));"
```
`crashLog.verdict` 가 **`PRESENT`** 이고 `pii.verdict` 가 **`PASS`** 여야 H2 가 닫힌다.
`ABSENT` = 아직 안 만들어짐. `NOT_MEASURED` = **판정 자체가 성립 안 함**(초록으로 읽지 마라).
미러 마커(C2)는 `judgeMirrorMarker(r.judges.crashLog.records, r.marker)` 로 본다.

**logs 를 막고도 앱이 안 죽는지**(C2 뒷문장)는 `deny-write` 를 `logs` 에 걸어서 —
`denyWrite('<ud>/logs')` 를 쓰고 그 `denied` 를 `judgeCrashLog(..., { denied })` 에 **반드시 넘겨라.**
안 넘기면 「못 쟀다」가 「없다」가 된다.

### H4 (종료 시 저장 실패) — 골 C4
```bash
node tools/hardening/run.mjs deny-write --port 9391 --out /tmp/h4-deny.json
node -e "const r=require('/tmp/h4-deny.json');
  console.log('인디케이터:', JSON.stringify(r.judges.saveIndicator));
  console.log('토스트    :', r.judges.toasts.summary);
  console.log('손실 창   :', r.judges.lostWindow.summary);
  console.log('I7        :', r.judges.i7.verdict, '(막힌 폴더는 NOT_MEASURED 가 정상)');"
```
**양성대조**(「빈 캔버스 skip 은 다이얼로그가 안 뜬다」)는 판정기로 직접:
```js
import { judgeEmptyCanvasSkip } from './tools/hardening/judge/lost-window.mjs';
judgeEmptyCanvasSkip(CHECKOUT, snapshot).empty   // 제품의 _isAllCanvasEmpty 를 «원문 그대로» 돌린다
```

### H5 (전부 손상 통지) — 골 C5
```bash
node tools/hardening/run.mjs corrupt-all  --port 9391 --edits 0 --out /tmp/h5-all.json   # 표적
node tools/hardening/run.mjs corrupt-half --port 9391 --edits 0 --out /tmp/h5-half.json  # 양성대조
node -e "for (const f of ['/tmp/h5-all.json','/tmp/h5-half.json']) { const r=require(f);
  console.log(f, r.judges.toasts.summary);
  console.log('  파일 무변경:', r.judges.fileUnchangedAfterOpen.identical);
  console.log('  메인로그   :', (r.mainLog||[]).slice(-3)); }"
```
⛔`toasts.verdict` 가 `NOT_MEASURED` 면 **「토스트 0건」을 결론으로 쓰지 마라** — 수집기가 못 잡은 것이다.
`r.mainLog` 는 메인 프로세스가 «스스로 말한 것»이다. **화면에 안 뜬 것**과 **아예 안 일어난 것**을 여기서 가른다.

### H6 (자동저장 고착) — 골 C6, ⛔재현 게이트
변이(`rebindAll` 1회 throw)는 **`git archive <SHA>` 사본**에서만 만들어라(공용 트리 금지).
그 사본 경로로 `run.mjs baseline --port …` 를 돌리면 세 관측값이 그대로 나온다:
`judges.lostWindow.editsLanded`(디스크에 편집 없음) · `judges.saveIndicator`(「저장 중」 미표시) ·
`judges.toasts`. ⌘R 뒤 소실은 `openProject()` 재호출 후 `diskMaxMarker()` 로.

### H3 (복구 다이얼로그)
네이티브 다이얼로그는 CDP로 안 보인다 — `r.mainLog` 의 「dialog shown」 한 줄로 판정하라(골 C3).
그 줄이 없으면 `crash-renderer` 결과의 `breaker.channels` 로 «크래시는 났는데 다이얼로그가 없다»를 말할 수 있다.

---

## 4. 규약 — 어기면 그 사이클은 «미실시»

* **preflight 통과 «로그»가 없으면 run.mjs 가 거부한다.** `lib/preflight-gate.mjs` 가 ★PASS 줄·포트·나이(30분)를 읽는다.
  이 하네스는 preflight 를 **부르지 않는다** — 체인으로 묶어 FAIL 위에서 기동한 실사고 때문이다.
* **창은 화면 밖 −2400.** `--window-position` 은 **무시된다** → AppleScript 로 옮기고 **`window.screenX` 를 읽어 확인**한다.
  확인이 안 되면 `launch()` 가 던진다(현빈 실사용 PC).
* **pid 는 «이름으로 돌며 대조»한다.** `first process whose unix id is N` 은 **남의 창**을 잡는다(실사고 3회).
* **정리는 내가 spawn 한 pid 만.** 남의 인스턴스는 보고만.
* **DPR 을 가정하지 않는다** — `inst.dpr` 은 `window.devicePixelRatio` 실측이다.
* **부수는 대상은 내가 만든 픽스처뿐.** `lib/fixture.mjs:assertWritableTarget` 이 원본 ud·코퍼스 원본·
  현빈 작업본을 **던져서** 막는다(U-H7-8 이 고정).
* **되돌리기 없음.** 원본을 망가뜨렸다 되돌리는 방식은 중간에 죽으면 망가진 채로 남는다 —
  리셋은 «사본을 새로 뜨는 것»뿐이다.

---

## 5. 이 하네스가 «자기 자신»을 잡은 자리 (지우지 마라)

개발 중 자체검사·자체 실기가 **내 도구의 결함 세 개**를 잡았다. 전부 「못 쟀다 → 없다」 계열이다.

1. **PII 판정기** — 표본이 0개인데 `pass:true` 를 냈다. 아무것도 «안 찾아본» 실행이 초록이었다.
2. **I7 판정기** — `projects` 를 `chmod 000` 한 상태에서 «스캔 0 · 깨짐 0 → PASS» 를 냈다.
3. **토스트 수집기** — `showToast` 는 `#editor-toast` **한 개**를 재사용하며 `textContent` 만 간다.
   초판은 `addedNodes` 의 **요소**만 봐서 두 번째 토스트부터 못 봤고, corrupt 두 판이 «0건»을 냈다.
   그건 「토스트가 없다」가 아니라 「내 자가 못 봤다」였다.
   ⇒ 지금은 **매 실행마다 알려진 토스트를 쏴서 잡는지 «증명»**한다. 증명 실패 시 「0건」은 `NOT_MEASURED`.
4. **kill9 sanity** — `fs.watch` 는 tmp «생성»에도 «rename(삭제)»에도 운다. 울었다는 이유로 `midsave:true`
   를 찍으면 rename **뒤**에 때린 실행이 「원자쓰기가 이겼다」로 읽힌다. 지금은 «kill 직전 stat 성공»
   또는 «kill 뒤 잔재» 가 있어야 `HIT`, 아니면 `UNCERTAIN`(자명 통과 경고).

넷 다 `tests/unit/hardening-harness.test.mjs` 의 **실패하는 검사**로 닫혀 있다.

---

## 6. Windows 에서

**돈다** — `run.mjs`·`selfcheck.mjs`·판정기·`corrupt`·`kill9-midsave`(SIGKILL → `TerminateProcess`)·
`crash-renderer`·`crash-gpu`·`hang`. Node 만 있으면 된다(외부 의존은 `ws` 하나, 레포에 이미 있다).

**안 되는 것 / 바꿔야 할 것**
| 항목 | 맥 | 윈도우 대안 |
|---|---|---|
| 창 화면 밖 이동 | AppleScript `set position` | **없음** → `launch({ requireOffscreen:false })`. 창이 앞에 뜬다 — 원격 세션(세션0)에선 GUI 자체가 안 뜬다 |
| `deny-write` | `chmod 000` | `icacls <dir> /deny "%USERNAME%":(W)` — `denyWrite()` 를 **분기해야 한다**(현재 `perm` 모드는 POSIX 전용, 윈도우에선 `HARNESS_ERROR`) |
| preflight | `preflight.sh` (bash) | 미이식. 윈도우는 포트 점유를 `netstat -ano` 로 직접 확인하고 `--port` 를 골라라 |
| Electron 경로 | `Electron.app/Contents/MacOS/Electron` | `node_modules/electron/dist/electron.exe` — `electronBinary()` 에 후보 추가 필요 |
| `arch -arm64` | 필수 | 불필요 — spawn 을 `electron.exe` 직접으로 |

⇒ 2차 QA §4 의 **W-1(NTFS rename 원자성)** 과 **W-3(90MB 종료 저장 시간)** 은 위 4줄을 손보면 그대로 돌아간다.
아직 **한 번도 윈도우에서 안 돌렸다** — 「돈다」는 **추정**이다(코드 경로 기준). 실측은 미니4호기 몫.

---

## 7. 파일

```
tools/hardening/
  run.mjs                 시나리오 실행기(실기)
  selfcheck.mjs           ★판정기 자체의 양성대조(오탐/미탐) — Electron 불필요
  lib/deadline.mjs        ⛔모든 대기의 상한 · HarnessError · 종료코드
  lib/cdp.mjs             최소 CDP 클라이언트 · 크래시 3채널 · 페이지 소유권 검사
  lib/instance.mjs        격리 기동 · 화면밖 이동+«읽어서» 확인 · 내 pid 만 정리 · 메인로그
  lib/fixture.mjs         내가 만든 픽스처 · 코퍼스 «사본» · PII 표본 3종 · 금지경로 게이트
  lib/loadcheck.mjs       잘라 쓴 소스의 «의존 선언»을 기계로 센다(U-GLOGIN-0 본보기)
  lib/preflight-gate.mjs  preflight ★PASS «로그» 없이는 실행 거부
  break/{corrupt,deny-write,kill9-midsave,crash}.mjs
  judge/{i7,pii,crashlog,lost-window,ui-state}.mjs
tests/unit/hardening-harness.test.mjs   회귀 스위트에 붙는 U-H7-0~9
```
