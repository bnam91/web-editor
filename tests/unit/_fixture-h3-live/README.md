# _fixture-h3-live — 「진짜 실기」가 만든 흔적 (H3, 2026-09-06)

⛔손으로 지어낸 합성 기록이 «아니다». 아래 두 하네스가 «실제로» 만든 파일 그대로다.
합성 기록만으로 판정하면 스키마를 내 머릿속 모양에 맞춰 놓고 통과시키게 된다
(이 프로젝트에서 오늘만 여러 번 난 실패 형태).

| 파일 | 만든 것 | 사건 |
|---|---|---|
| `logs/crash-1788699591677.json` | H2 하네스 `main-e2e.js` MODE=crash | ★`webContents.forcefullyCrashRenderer()` — 진짜 렌더러 사망(exitCode 2) |
| `logs/crash-1788699602356.json` | H2 하네스 `main-e2e.js` MODE=uncaught | ★메인에서 «실제로» 던진 예외 |
| `quit-save-failure.json` · `emergency-saves/*.json` | H4 러너 `h4-live.mjs` MODE=deny | ★`chmod` 로 projects/ 쓰기를 «진짜로» 막고 app.quit() — EACCES 로 저장 실패 |

경로·홈 디렉터리는 H2 의 scrub 이 이미 씻은 상태다(`~/…/x.json` 참조).
`emergency-saves/*.json` 은 H7 픽스처가 만든 «가짜 프로젝트» 내용이다 — 실사용자 문서가 아니다.

## ⛔`quit-save-failure.json` 안의 «홈 경로»를 지우지 마라 — 그게 양성대조다

이 마커의 `error` 는 Node 가 낸 EACCES 원문이라 `/Users/<실명>/…` 이 통째로 들어 있다.
「지저분해 보인다」고 씻어서 커밋하면 ★`U-H3-L5`(홈 경로가 나가지 않는다)가 «씻는 코드를 지워도
초록»이 된다 — 검사처럼 «생긴» 문장만 남는다. 변이 `M2-scrub` 이 그 자리를 지키는 짝이다.

이 경로가 «리포지터리에» 남는 것 자체는 새로운 노출이 아니다(기준 SHA `1e338b6` 시점에
`/Users/a1/` 을 담은 파일이 이미 100개다 — `.design/`·스킬 문서 등). 그래도 이 파일은
«검사 입력»이지 산출물이 아니고, H3 의 전송 경로는 이 문자열을 `main/crash/scrub.js` 로
씻어서 내보낸다(실기 스크린샷에서 목록엔 원문, 나갈 줄엔 `~/…/` 로 갈리는 것이 보인다).
