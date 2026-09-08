# 백로그 — rAF 단독 해제가 남은 세 자리 (자동저장 억제)

- 낸 사람: 툴매니저 세션 (2026-09-09) · 지디 검수 조건 ④ 로 «이 브랜치에 넣지 말 것»으로 분리됨
- 뿌리 커밋: `76a3ce4`(안전망) · `8865a83`(겹친 로드 + 검사)
- ⛔이 문서는 «설명»이다. «집행»은 `tests/unit/autosave-overlap.test.js` 의 N6 이 한다.
  아래 목록과 그 검사의 `RAF_ONLY_BACKLOG` 가 어긋나면 회귀가 빨개진다.

## 무슨 병인가

`state._suppressAutoSave` 를 «푸는» 일을 `requestAnimationFrame` «하나»에만 맡긴 자리들.
브라우저는 창이 가려지면(`visibilityState:'hidden'`) rAF 를 **갖고 있지만 안 돌린다**.
실측: hidden 창에서 3초를 기다려도 rAF 0회 → 억제가 `true` 로 고착 →
그 창의 편집이 **디스크에 안 남는다**(고착이 곧 데이터 손실). `open_project` 는
`autosaveArmed` 를 기다리므로 상한 120초를 꽉 채운다 — 이게 「프로젝트 여는 데 2분」의 정체였다.

`js/io/save-load.js`(applyProjectData)는 `8865a83` 에서 정본(`AutoSaveSuppress.endNextFrame`)
사용으로 바꿔 닫았다. 아래 셋은 **같은 모양이 그대로 남아 있다.**

## 남은 자리

| 파일:줄 | 무엇을 하는 자리 | 왜 미뤘나 |
|---|---|---|
| `js/history.js:105` | `restoreSnapshot` — 되돌리기 | 되돌리기는 «사람이 보고 있는 창»에서만 난다. 가려진 창에서 ⌘Z 가 오는 경로가 없다 ⇒ 급하지 않다 |
| `js/history.js:230` | `restoreSnapshotScoped` — 범위 되돌리기 | 위와 같다. 게다가 `window.scheduleAutoSave?.()` 를 같이 불러 재무장까지 한다 |
| `js/collab/sync.js:418` | 원격 패치 적용 | ★여기가 진짜 위험하다 — 원격 패치는 **가려진 창에도 온다**. 다만 collab 은 배포 경로에서 꺼져 있어 이번 판의 사고 원인이 아니었다 |

## 고치는 법 (셋 다 같다)

`requestAnimationFrame(() => { …_suppressAutoSave = false; })` 를
`window.AutoSaveSuppress` 의 `begin` / `endNextFrame` 왕복으로 바꾼다.
그러면 rAF·타이머가 «둘 다» 걸리고, 깊이 세기가 겹친 창을 지켜 준다.

⚠️`js/collab/sync.js` 는 **고전 스크립트라 `import` 가 안 된다** — `window.AutoSaveSuppress`
경유로 부르고, 없을 때 폴백을 남겨라(`js/io/save-load.js` 의 finally 가 본보기).

⚠️`js/history.js` 는 `js/autosave-suppress.js` 의 허용목록(`autosave-suppress.test.js` 의
`RAW_ALLOWED`)에 `count: 4` 로 잡혀 있다. 고치면 그 수도 같이 줄여야 한다.

## 다 고쳤을 때 무엇을 지워야 하나

1. 이 문서
2. `tests/unit/autosave-overlap.test.js` 의 `RAF_ONLY_BACKLOG` 항목과 N6 의 기대 건수(3)
3. `js/autosave-suppress.js` `endNextFrame` 위 주석의 「백로그」 문단
4. `tests/unit/autosave-suppress.test.js` 의 `RAW_ALLOWED` 건수

★이 넷이 «따로» 낡는 것이 이 계열의 다음 사고 자리다. N6 이 그걸 붙잡아 둔다.
