# EXPECT_N — DOM 전수에서 «돌아야 하는» 시험 수 (머지 게이트 ⑵)

전수(`npx playwright test --config=tests/dom/playwright.dom.config.js`)가 돈 시험 수가 이 값과 다르면 그 판은 무효다
(0건이 초록 · 파일이 통째로 안 돎 · spec 이 조용히 빠짐을 막는다).

## 현재값

| 값 | 어느 커밋에서 셌나 | 어떻게 셌나 | 기록 |
|---|---|---|---|
| 2543 | `0f572e2a` (dev · integ24) | `--list` 의 `Total:` 줄 | 2026-10-05 태양 |
| 2725 | `f4987e7a` (dev 로 갈 판 · 2026-10-06 08:5x 다시 셈 = `Total: 2725 tests in 312 files`) — `aa9af9f6`(integ25 머지) 에서도 2725 = 그 판 전수 `Running 2725` | `--list` 의 `Total:` 줄 | 2026-10-06 태양 · 지디 승인(루프 증분 34 닫힘 조건) |
| 2727 | ci-fix 묶음(아래 S1 쪼개기 +2 · 판 sha = 이 묶음이 들어간 main 머지 — 커밋 뒤 확정) | `--list` 의 `Total:` 줄 = `Total: 2727 tests in 312 files`(2026-10-06 11:4x · rel-096 작업트리) | 2026-10-06 태양 · 지디 release-096-ci-fix |
| 2736 | 레인 `taeyang/collab-unmute-c8`(047becd7 · dev 로 갈 판) | `--list` 의 `Total:` 줄 = `Total: 2736 tests in 314 files` · 그 판 전수 `Running 2736 tests using 4 workers` → 2733 passed · 3 skipped(기존 · 협업 무관) · 0 failed | 2026-10-06 태양 · 지디 발주 TWO — 식 2727 + 9 − 0 = 2736 (collab-notify 0→6 · collab-undo-scope 0→3, 선언 수 = 실행 단위 수) |
| 2738 | 레인 `taeyang/collab-unmute-c8`(b0211621 · 협업 켠 판) | `--list` Total 2738 in 314 files · 그 판 전수 `Running 2738 tests using 3 workers` → 2713 passed · 3 skipped · 22 failed — ★부하 구간(사유 줄 40 = 타임아웃 · 소요 8~15분 · 15분 load ≈19) · 같은 판 실패 13 파일을 workers 1 로 다시: 130/130 passed(협업 코드 부르는 파일 0) | 2026-10-06 태양 · 식 2736 + 2 − 0 = 2738 (collab-notify 6→8 · W7·W8) |
| **2744** | 레인 `taeyang/collab-unmute-c8`(eb91832d · SIX ⒜①②·해산·문장 12) | `--list` Total 2744 in 316 files · 그 판 전수 `Running 2744 tests using 3 workers` → 2740 passed · 3 skipped(기존 수) · 1 failed — ★부하 구간(시작 load 21~32 · 도중 최대 49.9 · 다른 레인 전수 동시) · 실패 = s3v-icon-text ⒤⒦ 좌표 단언 1 · 같은 판 단독(workers 1) ×3 = 15/15 ×3(협업 참조 0) | 2026-10-06 태양 · 식 2738 + 5(collab-conflict) + 1(collab-leave-ui) − 0 = 2744 · ⚠️다음 묶음부터는 증분만(지디: 다른 레인 셋과 머지 때 최종) |

⚠️절대값은 한 출처(`--list`)다 — 「언제부터 셌나」이지 「언제부터 맞나」가 아니다. 게이트가 지키는 것은 **델타**다.

## 갱신 식

```
새 N = 옛 N + 들인 수 − 뺀 수
```

두 항은 **바뀐 spec 마다** 두 출처가 따로 낸다. 어긋나면 그 spec 을 이름으로 설명한다.

- 출처 ㉠ git — `test(` 선언 수(playwright 를 안 쓴다):

  ```sh
  for f in $(git diff --name-only <base>..<head> -- 'tests/dom/*.spec.js'); do echo "$f $(git show <base>:$f 2>/dev/null | grep -cE '^[[:space:]]*test\(') $(git show <head>:$f 2>/dev/null | grep -cE '^[[:space:]]*test\(')"; done
  ```
  (줄마다 `파일 옛수 새수` — 늘어난 합 = 들인 수, 줄어든 합 = 뺀 수. ⚠️macOS grep 은 `\s` 를 모른다 → `[[:space:]]`.)
- 출처 ㉡ `--list` — 두 판에서 spec 별 실행 단위 수.

어긋남이 정당한 꼴: 반복문 안 `test(` · `test.each` · describe 반복 · `test.skip` (선언 수 ≠ 실행 단위 수).
예) integ24: 식 2536 ≠ 2543 — graph-panel-defaults · k2 · k3 · k5 의 반복 생성 +7 을 이름으로 설명했다.
예) integ25(`0f572e2a`→`aa9af9f6`): 식 2543 + 148 − 0 = 2691 ≠ 2725 — 차 34 = 아래 11 spec 의 «루프 길이 × 감싼 test 수 − 선언 수» 합(정의 자리에서 셈 · `--list` 를 안 씀):

| spec | 루프(정의 자리) | 감싼 test | 증분 |
|---|---|---|---|
| drag-fullwidth-text-horizontal | :95 `['center','right']` = 2 | 1 | +1 |
| esweep-fixes | :138 `[['M1 …'],['M2 …']]` = 2 | 1 | +1 |
| graph-e152-escape | :69 4 타입 × `EVIL`(:14) 2 = 8 | 1 | +7 |
| grid-cellpady | :60 `[2, 3]` = 2 | 1 | +1 |
| grid-img-crop-commit-h | :75 2 줄 꼴 = 2 | 1 | +1 |
| grid-plus-g15 | 이번 판에 든 루프 :731 `[40,100]` × :732 `['col','row']` = 4 (옛 루프들은 base·head 같음) | 1 | +3 |
| page-name-edit-exit | :62 `['Enter','Escape','click-away']` = 3 | 1 | +2 |
| panel-shows-rendered | :42 `ROWS`(`_panel-rows.js` · node 로 잼 = 13) | 1 | +12 |
| scratch-drop-insert-order | :85 4 겨냥 = 4 | 1 | +3 |
| section-variation-bind | :108 `['create','add']` = 2 | 1 | +1 |
| tab-name-edit-exit | :55 `['Enter','Escape','click-away']` = 3 | 1 | +2 |
| frame-stack-align (12 번째 · 10-06 ci-fix) | :76 S1 을 종류마다 — `['K1 …','K2 …','K4 …']` = 3 | 1 | +2 |
| **합** | | | **+36** = 2727 − 2691 ✔ (11 spec +34 → integ25 · 12번째 +2 → ci-fix) |

⇒ 12 번째 루프 spec 이 생기면 이 식이 깨진다 — 그때 이 표에 이름으로 더하라. ⛔「`--list` 만 쓰자」 금지 — 두 출처 대조가 ⑵ 의 설계다(한 출처는 자기를 못 잰다).

## 자

`~/.claude/skills/지디/tools/expect-n.sh <base> <head>` (PIN · REPO · OUT 환경변수) — 아직 레포 밖이다(☐ 다음 판 첫 묶음에서 레포 안으로 · 임자 태양).
자가 밖에 있어도 **값과 식은 여기**가 정본이다. 머지할 때마다 위 «현재값» 줄을 고친다.

## 레인별 «증분» — ⛔최종값을 박지 않는다(지디 규약 2026-10-06)

레인이 넷이 동시에 같은 베이스(2738)에서 올라오므로, 각 레인은 ★자기 증분만 적는다.
★최종 수는 ★머지하는 쪽(지디)이 한 번에 맞춘다.

| 레인 | 증분 | 내역(출처 ㉠ git `test(` 선언 수 · base `e7444dd3`) | 비고 |
|---|---|---|---|
| `gd/small3` (fx-small3 · 작은 고침) | **＋26** | `scratch-folder-columns` +4 · `bubble-shortcut-not-in-text` +7 · `marquee-edge-autoscroll` +6 · `shape-star-count` +9 | 새 spec 4개 ⇒ 파일 수 **＋4** |

★네 spec 모두 «루프로 test 를 감싸지 않았다» ⇒ 선언 수 = 실행 단위 수 ⇒ 위 「루프 spec」 표에 더할 것이 ★없다.
(루프는 ★test 안에만 있다 — bubble B6 의 7종 전수 · star S2~S4b 의 좌표 순회. 그건 실행 단위 1개다.)
★이 레인 단독 `--list` 는 `Total: 2764 tests in 318 files` 였다(= 2738＋26 · 314＋4) — ⚠️그 **2764 는
머지 전 한 레인 기준이라 다른 레인이 들어오면 틀린다**. 그래서 여기엔 ★증분만 남긴다.

⚠️⑷(말풍선 g) 검사 `bubble-shortcut-not-in-text` 의 **B1·B2·B6 은 이 레인에서 ★일부러 빨강**이다 —
제품 고침(`_mountLineUi` 의 `synthetic`)은 ★fx-parity 레인이 든다(지디 분담). ★그 레인이 들어온
뒤에야 초록이 된다 ⇒ ★머지 순서: fx-parity 가 `gd/small3` «보다 먼저 또는 같이». 그 파일 머리말에
빨강 셋의 잰 값이 적혀 있다.
