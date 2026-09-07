# tools/perf — 쾌적성 계측 하네스 (팬 / 세로스크롤 / 줌)

「팬 이동 시 레이턴시나 버벅임 — 기본적으로 쾌적해졌나」를 **숫자**로 답하기 위한 자.
기능 정확성 QA 와는 축이 다르다(그쪽은 「되나 안 되나」, 이쪽은 「몇 ms 인가」).

★**같은 자를 맥과 윈도우에 대야** 「우리 코드가 느린 것」과 「그 기계가 느린 것」이 갈린다.
한쪽 숫자만으로는 못 가른다 — 그래서 이 하네스는 경로 하드코딩·플랫폼 분기 없이 짜여 있다.

## 파일
| 파일 | 하는 일 |
|---|---|
| `cdp-lite.mjs` | 의존성 0 CDP 클라이언트 (Node 21+ 전역 WebSocket → 없으면 `ws`) |
| `probe.js` | 페이지 «안»에 심는 프로브. rAF 프레임시간 + 좌표변화 + 휠 이벤트 timeStamp |
| `comfort-bench.mjs` | 본체. 조건 조합마다 지표 5종을 뽑아 표 + JSON |
| `launch-goditor.mjs` | 계측용 인스턴스 기동기 (anti-throttle 플래그 on/off 대조용) |
| `move-window.mjs` | 창을 화면 밖(-2400)으로 밀고 `screenX` 로 확인 |
| `open-editor.mjs` | 갓 띄운 인스턴스를 에디터 화면까지 데려감(빈 프로젝트 생성) |
| `baseline-mac-*.txt` | 맥 기준선 실측값. 윈도우 결과를 여기에 대고 읽는다 |

## 한 줄 사용법 (맥·윈도우 동일)
```
node tools/perf/launch-goditor.mjs --port=9390 --ud=<격리경로> --flags=on \
  && node tools/perf/move-window.mjs --port=9390 \
  && node tools/perf/open-editor.mjs  --port=9390 \
  && node tools/perf/comfort-bench.mjs --port=9390 --label="win flags-ON" --out=<결과>.json
```
`--flags=off` 로 한 번 더 돌려 대조한다(포트·격리경로도 바꿀 것).
윈도우는 경로만 `C:\Temp\goditor-perf-on` 식으로 바꾸면 그대로 돈다.

## 재는 것
1. **팬 프레임시간 분포** — 가로 휠(deltaX) 연속 주입 중 rAF 타임스탬프 차분의 p50 / p95 / 최대
2. **드랍 프레임 비율** — 프레임시간이 임계를 넘은 비율. **임계를 둘 낸다**:
   `>16.7ms`(고정) 와 `>실측 프레임주기×1.5`. ★60Hz 화면에서 p50 은 «정확히» 16.7 이라
   고정 임계는 지터만으로 절반이 넘어간다 — 그 숫자로 「절반이 드랍」이라고 읽으면 오독이다.
3. **입력→반영 지연** — 휠 이벤트 `timeStamp` → `scrollLeft`/`transform` 이 실제로 바뀐 첫 rAF 프레임까지 ms.
   ★정의상 «화면에 픽셀이 뜬 시각»이 아니라 «프레임 콜백 시각»이다 — 합성·표시 지연은 안 들어간 **하한값**.
4. **줌 계단** — `Ctrl+휠` 한 노치당 배율 증분(%p). deltaY −100 / −120 / −10 / −3 과 줌아웃까지.
5. **세로 스크롤** — ①~③ 을 세로 축으로. 팬=가로·스크롤=세로는 **코드 경로가 다르다**(실측에서 실제로 갈렸다).

조건: 문서무게 2단 × 배율 3단(40 / 100 / 200%).
★문서무게는 «섹션 수»만으로 만들지 않는다 — 빈 섹션 14개는 DOM 266노드뿐이라 가벼움과 사실상 같다.
무거움은 섹션마다 블록 묶음(텍스트2·표·구분선·아이콘텍스트·인포카드·그래프·스텝·라벨그룹)을 심어
**1,904노드 / 캔버스 27,111px** 를 만든다. 표에 `(섹션수/DOM노드수)` 로 같이 찍힌다.

## ⛔측정 규약 (안 지키면 숫자가 거짓말한다)
- **첫 회차는 버린다** — JIT·레이아웃 캐시. 기본 `--warmup=1 --repeats=3`, 회차 수는 JSON 에 남는다.
- **주사율도 첫 회차를 버린다** — 기동 직후 유휴는 49Hz 처럼 보인다(실측: 20.3ms → 버린 뒤 16.7ms).
  이 값이 드랍 임계를 정하므로 오염되면 **표 전체가 흔들리고 두 실행이 비교 불가능해진다**.
- **hidden 이면 rAF 는 0Hz** — 시작 전 `visibilityState` 를 확인하고 아니면 즉시 중단(exit 4).
  실측(맥, 2026-09-06): 화면 밖(-2400)·비포커스 = `visible`·60Hz 로 «정상», 최소화 = `hidden`·**0프레임**.
  즉 비포커스만으로는 안 멈추고, 최소화하면 완전히 멈춘다.
- **DPR 을 가정하지 않는다** — 스크린샷 PNG 헤더의 높이 / `innerHeight` 로 실측해 JSON 에 적는다.
- **합성 이벤트 금지** — 입력은 CDP `Input.dispatchMouseEvent {type:'mouseWheel'}` 로 진짜 주입.
  (문서무게를 «만드는» setup 단계에서만 `sec.click()` 을 쓴다 — 그건 준비지 측정이 아니다.)
- **좌표가 안 바뀐 회차는 무효** — 「입력은 갔는데 화면이 안 움직였다」를 통과시키지 않는다(`invalid` 배열).
  팬은 도중에 방향을 뒤집어(40이벤트마다) 스크롤 끝에 박혀 «안 움직이는» 회차를 피한다.

## 알려진 함정
- **라이선스 게이트** — 격리 `user-data-dir` 에는 `auth.json` 이 없어 `pages/license.html` 이 뜬다.
  `launch-goditor.mjs` 는 package.json 의 dev 스크립트와 «같은» `admin` 인자를 붙여 통과한다
  (개발 체크아웃 한정. 패키지 빌드는 `admin.allow` + 토큰이 필요하다).
- **창 이동** — 이 앱의 CDP 에는 **Browser 도메인이 없다**(`Browser.getWindowForTarget` → -32601).
  `move-window.mjs` 는 CDP 를 먼저 시도하고 실패하면 OS 창 관리자로 내려간다
  (맥 = `osascript`/System Events, 윈도우 = `user32.MoveWindow`). 반환값의 `offscreen` 을 **반드시** 확인할 것.
- **내장 MCP 포트** — 인스턴스마다 claude-pm MCP 가 9345 부터 «비어 있는 첫 포트»를 문다.
  디버그 포트를 9390 대역으로 격리해도 MCP 는 대역 밖(9348 등)을 물 수 있다.

## 옵션
`--repeats` `--warmup` `--zooms=40,100,200` `--docs=light,heavy` `--light=3` `--heavy=14`
`--pan-events=120` `--pan-interval=8` `--pan-mag=50` `--latency-notches=8` `--no-move` `--match=`
