# 백로그 — 「가려진 창에서 안 도는 것」으로 억제를 푸는 다섯 자리

- 낸 사람: 툴매니저 세션 (2026-09-09) · 지디 검수 조건 ④ 로 «이 브랜치에 넣지 말 것»으로 분리됨
- 뿌리 커밋: `76a3ce4`(안전망) · `8865a83`(겹친 로드 + 검사)
- ★2026-09-09 «검사 기준을 넓혀» 둘이 더 나왔다(지디 정정 + 그 정정의 정정). 아래 «갈라 적음» 참조.
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

## 판정 기준 — 「rAF 짝이 있나」가 아니다

지디의 초판 기준은 「rAF 를 푸는데 `setTimeout` 짝이 없는 것」이었다. 그가 스스로 정정했고
(「갈래가 넷인데 하나만 세라고 했다」), 재보니 **축이 셋**이었다.

| 축 | 좁은 기준이 놓치는 것 |
|---|---|
| ① 스케줄러 | `ResizeObserver` · `IntersectionObserver` · `requestIdleCallback` 도 **렌더링 갱신 단계**에 얹혀 있어 가려진 창에서 안 돈다(실측: RO 는 «초기 관측조차» 0건). rAF 만 세면 셋이 새어 나간다 |
| ② ★플래그 | 억제류 플래그가 `_suppressAutoSave` **하나가 아니다** — `_lazyRenderPass` 도 자동저장을 거른다. 이름을 손으로 박은 술어는 그 자리를 영영 못 본다 |
| ③ ★「안전망」의 뜻 | `else setTimeout(...)` 은 «폴백»이지 «안전망»이 아니다. rAF 가 **없을 때**만 타므로, rAF 가 **있는데 안 도는** 가려진 창에선 영영 안 탄다 — **이게 이 사고의 정체 그 자체다** |

⇒ 셋 다 «성질»로 적었다. 스케줄러 명부는 그 성질의 «오늘 목록»이고, 플래그는 **도출**한다
(`save-load.js` 에서 그 플래그를 보고 자동저장을 «거르는» 가드에서 뽑는다).

## 남은 자리

### ⓐ 처음부터 알고 미룬 셋 (지디 조건 ④)

| 파일:줄 | 무엇을 하는 자리 | 왜 미뤘나 |
|---|---|---|
| `js/history.js:105` | `restoreSnapshot` — 되돌리기 | 되돌리기는 «사람이 보고 있는 창»에서만 난다. 가려진 창에서 ⌘Z 가 오는 경로가 없다 ⇒ 급하지 않다 |
| `js/history.js:230` | `restoreSnapshotScoped` — 범위 되돌리기 | 위와 같다. 게다가 `window.scheduleAutoSave?.()` 를 같이 불러 재무장까지 한다 |
| `js/collab/sync.js:418` | 원격 패치 적용 | ★여기가 진짜 위험하다 — 원격 패치는 **가려진 창에도 온다**. 다만 collab 은 배포 경로에서 꺼져 있어 이번 판의 사고 원인이 아니었다 |

### ⓑ ★검사를 넓히다 «새로» 찾은 둘 — 이번에 고친 것과 갈라 적는다

| 파일:줄 | 어느 축이 보여 줬나 | 무엇이 위험한가 |
|---|---|---|
| `js/io/lazy-sections.js:59` | ②(플래그) | `_lazyRenderPass` 를 rAF 단독으로 되돌린다. IO 가 «보이는» 동안 패스를 시작하고 사용자가 탭을 옮기면 rAF 가 멈춰 플래그가 고착 → `autoSaveObserver` 가 style·`data-lazy-bg`·class 변경을 **영영** 거른다. ⚠️`_suppressAutoSave` 만큼 넓진 않다(속성 변경만 삼킨다) |
| `js/version-history-ui.js:407` | ③(else 폴백) | `if (rAF) rAF(restore); else setTimeout(restore, 0);` — 이 파일이 이 패턴의 «정본»으로 불리는데, 정작 **폴백과 안전망을 헷갈린 그 모양**이다. 가려진 창에서 버전 되돌리기를 하면 억제가 `prevSuppress` 로 안 돌아온다 |

⛔둘 다 **이 브랜치에서 고치지 않는다**(지디 지시 — 범위를 넓히지 않는다).
⚠️`version-history-ui.js` 는 전용 검사(`vhist-ui-restore.test.js`)가 지키는 파일이라,
고칠 땐 그 검사부터 읽어라 — 「정본이 병들었다」를 그 검사가 못 봤다는 뜻이기도 하다.

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
2. `tests/unit/autosave-overlap.test.js` 의 `UNNETTED_BACKLOG` 항목 (N7 이 집행)
3. `js/autosave-suppress.js` `endNextFrame` 위 주석의 「백로그」 문단
4. `tests/unit/autosave-suppress.test.js` 의 `RAW_ALLOWED` 건수

★이 넷이 «따로» 낡는 것이 이 계열의 다음 사고 자리다. N6 이 그걸 붙잡아 둔다.
