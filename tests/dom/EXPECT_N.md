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
| **2864** | ★머지 완료판 `ceed9697` (dev · 레인 ★넷 전부) | `--list` Total **2864 tests in 334 files** · 그 판 전수 `Running 2864 tests using 4 workers` → **2860 passed · 3 skipped · 1 flaky · 0 failed · RC=0** (18.4m · `--retries=1`) | 2026-10-07 지디 ⑤ · 사슬 2744 →(태양 ＋15) 2759… ★실측 사슬 = 2779 →＋태양15= **2794** →＋fxmenu9= **2803** →＋parity44= **2847** →＋small4 17= **2864** · ★네 레인이 ★각각 ★직접 떠서 잰 값이 ★이어 맞았다(빌린 수 0) |

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

레인이 넷이 동시에 올라오므로, 각 레인은 ★자기 증분만 적는다.
★최종 수는 ★머지하는 쪽(지디)이 한 번에 맞춘다.

| 레인 | 증분 | 내역(출처 ㉠ git `test(` 선언 수 · base = dev `40179846`) | 비고 |
|---|---|---|---|
| `gd/small3` (fx-small3 · 작은 고침) | **＋30** | `scratch-folder-columns` +4 · `bubble-shortcut-not-in-text` +7 · `marquee-edge-autoscroll` +6 · `shape-star-count` +9 · `frame-empty-no-dashed` +4 | 새 spec 5개 ⇒ 파일 수 **＋5** |
| `taeyang/collab-unmute-c8` (SIX ① 초대 종 · 빈 프로젝트 공장) | **＋5** | `collab-inbox` +2(IB1·IB2) · `empty-project-consumers` +3(E1~E3) | 새 spec 2개 ⇒ 파일 수 **＋2** · 루프 감싼 test 0 · 이 레인 판 전수(rebase 전 90b60b29): Running 2749 → 2746 passed · 3 skipped · 0 failed(부하 load 16~26) |
| `taeyang/fx-glow` (THREE/FOUR 글로우 스티커) | **＋15** | `fx-glow-sticker` +15(F0~F15 · F7·F8 은 ★한 `test(` 를 경로 2개 루프로 — git 선언 수 14 · 러너 `--list` 15) | 새 spec 1개 ⇒ 파일 수 **＋1** · ⚠️루프 감싼 test 1(×2) — 선언 수로 세면 1 모자란다 |
| `gd/fxmenu` (fx-effectmenu · 이펙트 ＋ 를 고르는 목록으로) | **＋9** | `effects-registry` +9(A0~A8) · `effects-reflection` 11 → 11(R1·P0 을 고쳤지만 ★쪼개지 않았다) | 새 spec 1개 ⇒ 파일 수 **＋1** · 루프 감싼 test 0 ⇒ 위 「루프 spec」 표에 더할 것 ★없다 · ★출처 ㉡ `--list` 도 같다(바뀐 두 파일 Total 11 → 20 = ＋9 · 기준판 dev `116af0c4`) |
| `gd/dragscroll` (선택상자 자동 스크롤에 ★좌우 · 현빈 2026-10-07) | **＋6** | `marquee-edge-autoscroll` **6 → 12** (M7·M8 ★위아래 무변 증인 · M9 오른쪽 · M10 왼쪽 · M11 모서리 · M12 가로 최대) · ★base = dev **`2866df63`**(다른 줄들과 base 가 ★다르다) | ★새 spec **0개** ⇒ 파일 수 **＋0**(334 → 334) · 루프·`test.each`·describe 반복 **0건** ⇒ 선언 수 = 실행 단위 수 · ★두 출처 일치 — ㉠ git `test(` 6 → 12 / ㉡ `--list` 그 spec Total 6 → 12 · ★기준값을 **직접 떠서** 증분을 다시 쟀다(2026-10-07 10:3x · 같은 작업트리에서 **그 spec 만 base 판으로 갈아끼워** 전체 `--list` 를 두 번: **2864 → 2870** · 복원 sha256 일치 확인) — ⚠️이 두 절대값은 **내 레인 단독 기준**이라 ⛔최종값이 아니다 |
| `gd/cmdlink` (⌘＋🔗 = 연결된 빈 섹션 · 현빈 2026-10-07) | **＋9** | `cmd-link-new-section` **0 → 9**(L0~L8) · ★base = dev **`d80b1775`**(이 레인을 그 위로 rebase — 충돌 1건 = 이 파일, ⛔위 `gd/dragscroll` 줄은 한 글자도 안 건드렸다) | 새 spec **1개** ⇒ 파일 수 **＋1**(334 → 335) · 루프·`test.each`·describe 반복 **0건** ⇒ 선언 수 = 실행 단위 수 · ★두 출처 일치 — ㉠ git `test(` 선언 수 **9**(base 엔 이 파일이 **없다**=0) / ㉡ 러너 `--list` 전체 **2870 → 2879** · ★기준값을 **직접 떠서** 다시 쟀다(2026-10-07 · 같은 작업트리에서 ★내 spec «하나만» 치워 전체 `--list` 를 두 번. 그 치움이 base 의 spec 집합을 되살린다는 근거 = `git diff --name-only d80b1775 HEAD` 의 `.spec.js` **1건** · 복원 sha256 일치) — ⚠️이 두 절대값은 **내 레인 기준**이라 ⛔최종값이 아니다 |
| `taeyang/thumb-waste` (㉠ 썸네일이 라이브 캔버스를 안 베낀다 · 지디 2026-10-07) | **＋3** | `thumb-skip-live-canvas` **0 → 3**(TS1~TS3) · ★base = dev **`fdb0153a`**(rebase 충돌 1건 = 이 파일 · ⛔위 줄들은 한 글자도 안 건드렸다 — dev 판 그대로 받고 이 줄만 더함) | 새 spec **1개** ⇒ 파일 수 **＋1** · 루프·`test.each`·describe 반복 **0건** ⇒ 선언 수 = 실행 단위 수 · ★두 출처 — ㉠ git `test(` 선언 수 **3**(base 엔 이 파일이 없다=0) / ㉡ 러너 `--list` 전체 **2879 → 2882**(파일 335 → 336) · ★기준값을 직접 떠서 쟀다(2026-10-07 · 같은 작업트리에서 ★내 spec «하나만» 치워 `--list` 두 번 · 그 치움이 base spec 집합을 되살린다는 근거 = `git diff --name-only fdb0153a` 의 `.spec.js` **1건** · 복원 sha256 일치 9f51e288…) — ⚠️이 두 절대값은 ★내 레인 기준이라 ⛔최종값이 아니다 |
| `gd/coupon` (쿠폰 블럭 1단계 — 컴포넌트 패널 · 글자 다섯 · 비율 축소 · 현빈 2026-10-07) | **＋15** | `coupon-block` **0 → 15**(C-MAKE1~3 · C-PANEL1~4 · C-SHRINK·C-SHRINK2 · C-HANDLE1·C-HANDLE2 · C-UNDO·C-UNDO2 · C-LOAD · ★C-EXPORT) · ★base = dev **`11aa339f`**(이 레인을 그 위로 rebase — ★충돌 ★0건 · 교집합은 `js/io/save-load.js` ★한 파일인데 ★자리가 안 겹쳤다: dev :134 `captureThumbnail` vs 내 :1372·:1396 `rebindAll`) | 새 spec 1개 ⇒ 파일 수 **＋1** · ★루프 감싼 test **0**(들여쓰기 0 인 `test(` 15 · 들여쓰기 있는 것 0) · ★`C-EXPORT` 는 `test.fail(true)` = ★일부러 빨강(피그마 내보내기 2단계) ⇒ 러너가 **`passed`** 로 센다 — ★`✘` 1 · `failed` **0** 을 나란히 읽어라 · ★두 출처: git Δ선언 **＋15**/Δ파일 **＋1** · `--list` **2882→2897 · 336→337** |
| `gd/modal` ★T3 모달 오버레이(현빈 섹션메모 `sec_3e0suk0` · 지디 발주 2026-10-07) | **＋4** | `modal-overlay-float` **0 → 4**(M-OVL1 단추·면적 · M-OVL2 진짜 클릭으로 뜬다/돌아온다 · M-OVL3 ⌘Z 한 걸음 · ★M-OVL4 흐름 vs 떠 있는 쪽 ★대조) · ★base = dev **`4b36eb56`** | ★제품은 `js/props/prop-modal.js` ★한 파일 — ⛔진입·이탈·드래그를 ★안 짰다(`js/overlay-float.js` 정본 호출) · ★단추 겉모습도 공용(`_helpers.overlayToggleBtnHTML`) · ★루프 감싼 test ★0 · ★두 출처: git `test(` ★0→4 · `--list` **2932→2936 · 340→341** |
| `gd/modal` ★T11 모달 로테이트(현빈 구두 2026-10-07) | **＋4** | `modal-rotate` **0 → 4**(M-ROT1 라우팅·핫존을 ★캔버스와 견줌 · M-ROT2 공유 헬퍼 왕복 · M-ROT3 패널 줄이 읽히고 먹는다 · ★M-ROT4 재렌더 뒤 각도가 산다) · ★base = dev **`ce93dc91`** | ★제품 ★세 파일 — `asset-rotate.js`(★타입＋라우팅 ★두 줄 · ⛔공장은 private 유지) · `prop-modal.js`(회전 줄＋배선) · ★`modal-block.js`(★재렌더가 transform 을 ★다시 얹는다) · ⛔새 드래그 코드 ★0 · ★`zoom-block.test.js` 의 ★회전 레지스트리 단언 ★8→9(＋동기 명부·관용구 전수도 ★이름으로) · ★루프 감싼 test ★0 · ★두 출처: git `test(` ★0→4 · `--list` **2936→2940 · 341→342** |
| `gd/modal` ★T11 뒷고침 — ★transform 이어받기 ★0건을 ★검사로 잠갔다(지디 조건) | **＋1** | `modal-rotate` **4 → 5** (★M-ROT5 「모달 transform 은 rotate 하나뿐」 ＋ ★그 자가 ★항등식이 아님을 ★같이) · ★base = dev **`ce93dc91`** | ★제품 변경 ★0줄 — ★주석만(★0건을 ★어떻게 쟀나 ★다섯 경로 ＋ ⛔`iconRotation` 과 ★다른 칸임) · ★M-ROT2 제목에 ★「(전제)」 박음(어느 변이에도 안 빨개진다 ⇒ 게이트 아니다) · ★★음성대조: 제품에 ★translate 를 ★진짜 얹으면 ★rc 1 「translateX(5px) rotate(30deg)」 · 되돌리면 rc 0 · ★누적 ＋5 · `--list` **2940→2941** |
| `gd/modal` ★T1 ★지키는 검사 먼저 — ★제품 변경 ★0줄(기전은 지디 판정 대기) | **＋4** | `modal-font` **0 → 4** (T1-NEG1 고른 폰트 불변·★지디 「이게 이 건의 진짜 위험이다」 / T1-NEG2 dataset 없는 옛 모달은 선언 안 나감 / T1-GATE 박을 값이 검문 자를 통과 / ★T1-RULER 폰트가 «진짜 먹나»를 ★폭으로) · ★base = dev **`64a06566`** | ★양성대조 ★네 칸 ★전부 ★따로 세웠다(각각 ★자기 문장으로 빨강 · ★재는 축만 빨강): ⑴렌더가 dataset 무시 → NEG1 주단언＋NEG2 빨강 ⑵검문 자가 쉼표 거절 → GATE＋NEG1 빨강 ⑶body 폰트를 없는 이름으로 → RULER 만 빨강 ⑷만들기가 고른 값 덮기 → NEG1 ★전제 빨강 · ★T1-RULER 영점: 가짜 이름 778.91 == sans 778.91 ＜ Pretendard ★828.33 (⛔`'Noto Sans KR'` 도 778.91 — ★이 기계에 없다) · ⛔`'Noto Sans KR'` 는 ★단언 안 함(기계마다 다르다 — 「한 환경에서만 참인 검사」 금지) ⇒ ★매회차 ★로그에 값을 박았다 · ★누적 ＋9 · `--list` **2941→2945** (343 파일) |
| `gd/modal` ★T1 ⒞ — ★새 모달이 ★«텍스트블럭과 같은 글꼴»로 태어난다(현빈 원문 · 지디 ⒞ 승인) | **＋2** | `modal-font` **4 → 6** (★T1-NEW 새 모달 = 텍스트블럭 ★같은 판에서 견줌＋★패널 라벨 / ★T1-OLD ★음성대조·최고위험 — dataset 없이 `renderModalBlock` 으로 되살아난 ★옛 모달은 패널이 그대로 「기본 (시스템)」) · ★base = dev **`64a06566`** (내 HEAD `e8af4fd1`) | ★제품 ★3곳(import 1 · 읽기 자 `modalNewFontFamily` · `makeModalBlock` else 가지) · ⛔`MODAL_DEFAULTS.fontFamily` 는 **`''`** 그대로 · ★양성대조: ★고치기 전 판(HEAD)으로 되돌리면 ★T1-NEW ★혼자 빨강 「새 모달이 텍스트블럭과 다른 글꼴로 태어났다 — 모달 "" / 텍스트 "Pretendard, sans-serif"」 · 나머지 5 초록 · ★행위 확인: 새 모달 패널 `mdl-typo-font-name` = **Pretendard** / 옛 모달 = **기본 (시스템)** / 텍스트블럭 `txt-font-name` = **Pretendard** · ★이웃: 모달 단위 8파일 **88/88** rc 0 · 모달 DOM 15파일 **145 통과 / 2 빨강** — ⛔그 둘(`modal-frameify` U1·U3)은 ★dev 의 빨강이다(아래) · ★누적 ＋11 · `--list` **2945→2947** |
| `gd/modal` ★T1 ㉡ — ★그리드 칸에 ★«새로 추가하는» 글자 줄도 ★텍스트블럭과 같은 글꼴(현빈 원문 「모달이나 ★그리드블럭의 텍스트 줄」) | **＋6** | ★새 spec **1개** `grid-newline-font` **0 → 6**(G-PRE 전제만 모은 칸 / G-NEW T 단축키 새 줄 = 텍스트블럭 ★같은 판·패널 라벨·★계산 스타일 / ★G-KIND ★박히는 종류 집합 ＝ ★렌더러가 fontFamily 를 «읽는» 종류 집합 ＋ ★임자 가름 / ★G-OLD 음성대조 — `dataset.cols`→`renderGridBlock` 으로 되살아난 옛 줄 불변 / G-GATE 박는 값이 `GRID_FONT_RE` 통과 ＋ 그 자가 항등식 아님 / G-RULER 폭) · ★base = 내 HEAD **`db91f1b4`** | ★제품 **1파일** `js/props/prop-grid.js` **＋72 −7**(import 2 · 읽기 자 `grdNewLineFontFamily` · ★spec 빌더 `grdNewLineSpec` ★하나로 합침 — 전엔 T/G 단축키(:926)와 패널 select(:1067) ★두 자리가 같은 표를 따로 들었다 · 호출 2곳 · window 노출 1) · ⛔`GRID_DEFAULTS`·렌더 폴백 ★무접촉 · ★하네스 **1파일** `tests/unit/grid-line-add.test.mjs` **＋7**(prop-text-utils.js 를 ★실물로 복사 — 안 하면 ERR_MODULE_NOT_FOUND 로 그 파일 28건이 통째 빨강) · ★양성대조 ★셋, ★각각 ★다른 단언이 빨강: ⑴MUT-G1 박는 줄 제거 → **G-NEW 주단언⑴·G-KIND·G-GATE 전제** ⑵MUT-G2 역할 가름 제거 → **G-KIND 만**(박힘 8 `…,duo,graph` / 읽음 6) ⑶MUT-G4 ★임자 가름 제거 → **G-KIND(「★버블 줄에도 박혔다」) ＋ ★남의 spec `bt2-lines` T3** · ★원복 sha256 `1ba865d7…` 일치 · ★이웃: `bt2-lines`·`grid-nested-create`·`grid-nested-line-select`·`grid-panel-icon-spec`·`ln-default-addr`·`grid-typo`·`grid-cell-panel-handles`·`grid-cell-empty-slot`·`grid-line-delete`·`grid-plus-e1`·`grid-drop-textblock-cell`·`grid-line-paste-single` ★132건 rc 0 · prop-grid.js 를 파싱/임포트하는 unit **10파일 135/135** rc 0 · ★두 출처 — ㉠ git `test(` 선언 수 **0 → 6**(base 엔 이 파일이 ★없다) · 루프·`test.each`·describe 반복 **0건** ⇒ 선언 수 = 실행 단위 수 / ㉡ 러너 `--list` **2947 → 2953**(343 → 344 파일) — ★기준값을 ★직접 떠서 쟀다(2026-10-07 · 같은 작업트리에서 ★내 spec «하나만» 치워 `--list` 두 번 · 복원 sha256 `1cb43062…` 일치) · ⚠️이 두 절대값은 **내 레인 기준**이라 ⛔최종값이 아니다 · ⚠️★같은 증상인데 ★안 고친 자리 둘(지디 보고에 올렸다): ㉮ ★새 그리드블럭의 ★기본 줄 — 실측 패널 「기본 (시스템)」(발주 문구는 「추가해도」라 범위 밖으로 뒀다) ㉯ ★버블·챗 새 줄 — ★고의로 제외(위 MUT-G4) |
| `gd/modal` ★T1 ⒞ ★뒷고침 — ★한 칸에 묶여 ★침묵하던 주 단언들을 ★제 칸으로 갈랐다(지디 조건⑴) ＋ ★「자/게이트」를 ★이름에 박았다(조건⑵) | **＋5** | `modal-font` **6 → 8**(★T1-NEW 를 ★셋으로 — T1-NEW 인라인 / ★T1-NEW-PANEL 패널 라벨 / ★T1-NEW-SYMPTOM 「기본 (시스템)」 아님) · `grid-newline-font` **6 → 9**(★G-NEW 를 ★넷으로 — G-NEW 인라인 / ★G-NEW-PANEL / ★G-NEW-SYMPTOM / ★G-NEW-COMPUTED 재렌더 뒤 계산값) · ★base = 내 HEAD **`9a3f934d`** | ★제품 변경 **0줄** — 검사·주석만 · ★까닭: ★MUT-A·MUT-B 가 ★둘 다 ★첫 단언에서 터져 ★패널 라벨·증상 글자 단언이 ★한 번도 «제 소리»를 못 냈다(⛔SKIP 만 형제를 먹는 게 아니다 — ★첫 실패도 먹는다) · ★★갈라서 ★다시 쟀다 — ★MUT-A(memo `''`) **T1-NEW ＋ T1-NEW-PANEL ＋ T1-NEW-SYMPTOM ★셋 다 빨강**(나머지 5 초록) · ★MUT-B(else 가지 제거) **같은 셋 빨강** · ★MUT-G1(박는 줄 제거) **G-NEW·G-NEW-PANEL·G-NEW-SYMPTOM·G-NEW-COMPUTED·G-KIND·G-GATE 빨강 / G-PRE·G-OLD·★G-RULER 초록** · ★★`T1-RULER`·`G-RULER` 는 ★«자»다 — ⛔게이트가 ★아니다. ★MUT-A·MUT-B·MUT-G1 ★전부에서 ★초록이었다(캔버스가 Pretendard 를 ★상속해 폭이 안 움직인다) ⇒ ★이름에 「(자 · ⛔게이트 아님)」을 박고 ★머리말에 ★무엇을 잠그나를 적었다(「우리가 쓰는 이름이 ★폴백으로 죽지 않았나」) · ★원복 sha256 둘 다 일치(`df3e181a…` · `1ba865d7…`) · 원복 뒤 재측정 **17 passed rc 0** · ★두 출처 — ㉠ git `test(` modal **6→8**(＋2) · grid **6→9**(＋3) = ★＋5 · 루프·`test.each` **0건** / ㉡ `--list` **2953 → 2958** (344 파일 ★그대로 — 새 파일 0) · ⚠️절대값은 **내 레인 기준** ⛔최종값 아님 |
| `gd/circletext` (G20 그리드 칸 원형 — 채움색 ＋ 원 안 글자 · 현빈 2026-10-07) | **＋10** | `grid-circle-text` **0 → 10**(G20-1 입구 뒤집힘 · G20-2 채움색 ＋ 체커 꺼짐 · G20-3 원 안 글자 · G20-4 패널 ＋ 사각 대조 · G20-5 ⌘Z 걸음 수 · G20-6 저장→다시 열기 · G20-7 원→사각→원 왕복 · ★G20-8·9 지키는 자 · ★G20-10 «연달아» 두 제스처의 칸 수 — ★머지 ⑤ 에서 ★더 세웠다: 소스 게이트 `prop-push-after` ★PA-1 이 내 글자 핸들러의 ★push-before 를 잡았고 ★쟀더니 ★참이었다(히스토리 칸 Δ: ★push-before ＋0 · pushHistory 없음 ＋0 · ★push-after ＋1) ⇒ ★제품 1자리를 고쳤다(적용 먼저 · pushHistory 나중) ＋ ★G20-5·G20-10 에 ★«칸 수» 단언을 박았다 — ⛔옛 둘은 pos/len 을 ★읽어 ★메시지에만 썼어서 ★pushHistory 를 빼도 ★초록이었다 = ★걸음을 안 재고 있었다. ★양성대조 ＋2: ㉧ M-BEFORE(순서 되돌림) → ★G20-10 하나만 빨강 · ㉨ M-NOHIST(pushHistory 제거) → ★G20-5·G20-10) · ★base = dev **`e42a81bc`**(이 레인을 그 위로 rebase — ★충돌 **0건** · ★파일 교집합도 **0**: dev 32파일 중 내 5파일과 겹치는 것이 없다. ⚠️그래도 ★동작 소비자 넷을 따로 봤다 — `css/editor-blocks.css` 의 `.icb-children` 폭이 **70.71% 그대로**(내 unit I2 가 그 수를 파싱한다) · `js/block-factory.js`·`js/block-drag.js`·`js/panels/layer-panel-items.js` 의 dev 변경은 쿠폰 셀렉터 추가뿐) | 새 spec **1개** ⇒ 파일 수 **＋1**(337 → 338) · 루프·`test.each`·describe 반복 **0건** ⇒ 선언 수 = 실행 단위 수 · `test.fail` **0** ⇒ `✘` 0 · ★두 출처 일치 — ㉠ git `test(` 선언 수 **10**(base 엔 이 파일이 **없다**=0) / ㉡ 러너 `--list` 전체 **2897 → 2907**(337 → 338) · ★기준값을 **직접 떠서** 쟀다(2026-10-07 · 같은 작업트리에서 ★내 spec «하나만» 치워 `--list` 를 두 번. 그 치움이 base 의 spec 집합을 되살린다는 근거 = `git diff --name-only e42a81bc HEAD` 의 `.spec.js` **1건** · 복원 sha256 일치 47454680…) — ⚠️이 두 절대값은 **내 레인 기준**이라 ⛔최종값이 아니다 · ＋unit 축 **＋3**(`grid-circle-text-inset` I1~I3 — ⛔DOM EXPECT_N 에는 **안 센다** · grid-* 래칫 402 → 405 로 따로 올렸다) |
| `gd/coupon` ★뒷고침 — 우측 패널 줄이 눌려 글자가 쪼개진 것(지디 ★실앱 QA 2026-10-07) | **＋1** | `coupon-block` **15 → 16** (★C-PANEL5 = 「있나」가 아니라 ★「읽히나」) · ★base = dev **`e42a81bc`**(= 이 레인이 이미 올린 판) | ★제품은 `js/props/prop-coupon.js` ★한 파일(공용 CSS·`_helpers.js` ★무접촉) — 글자 단추 → ★`prop-icon-btn` ＋ 정본 `disclosureChevronHtml` · ⛔지어낸 `.prop-check` → 정본 `.prop-none-check` · ★하네스에 `editor-panels.css`·`editor-props.css` 를 얹어 장면을 앱과 맞췄다(panel **240** · row **211** · 지디 실측과 같다) · ★누적 증분 = **＋16** · `--list` **2897→2898** |
| `gd/sec-height` (섹션 높이 px 표시 (다)·(라) · 현빈 2026-10-07) | **＋15** | `section-height-display` **0 → 15**(H1 자의 선택·H2 내보내기와 같은 자 · D1·D2 캔버스 · D3 패널 · T1 합계 · P1 공용 자 하나 · U1~U4 갱신 · S1~S3 저장 누수 · ★N1 이름 읽는 자리 둘을 실제로 호출 · ★N2 저장→재기동 왕복) · `effects-reflection` **11 → 11**(R2·R9 가 비교 ★전에 `NON_CONTENT_UI_SELECTOR` 로 UI 를 걷게 고쳤지만 ⛔쪼개지 않았다) · ★base = dev **`ee910798`**(이 레인을 그 위로 rebase — ★충돌 **1건** = ★이 파일뿐. ⛔위 레인 줄들은 ★한 글자도 안 건드렸다 — ★행위로 쟀다: dev 판 레인 줄 12 중 ★사라진 줄 **0** · 더해진 줄 **1**(내 것)) | 새 spec **1개** ⇒ 파일 수 **＋1** · 루프·`test.each`·describe 반복 **0건** · `test.fail` **0** ⇒ 선언 수 = 실행 단위 수 ⇒ 위 「루프 spec」 표에 더할 것 ★없다 · ★두 출처 일치 — ㉠ git `test(` Δ **＋15**(section-height-display 0 → 15 · effects-reflection 11 → 11 = 0) / ㉡ 러너 `--list` 전체 **2908 → 2923**(338 → 339) · ★기준값을 ★빌리지 않고 **DEVPIN 을 임시 worktree 로 직접 떠서** 쟀다(2026-10-07 12:0x · 핀 worktree HEAD = `ee910798` 확인) · ⚠️파일 수는 ★자가 둘이다 — `ls-tree` 의 `.spec.js` **339 → 340** vs 러너 `--list` **338 → 339**(상수 차 1 · ★델타는 둘 다 ＋1) · ⚠️`js/io/save-load.js` 가 `gd/coupon`·`taeyang/thumb-waste` 와 ★같은 파일인데 ★자리가 안 겹쳤다(그쪽 = `captureThumbnail` ignoreElements · 블럭 목록에 `.coupon-block` · 쿠폰 재렌더 / 내 쪽 = `NON_CONTENT_UI_SELECTOR` 끝 한 낱말 ＋ `_isNonContentUiMutation` 머리 두 줄) — ⛔눈으로 안 닫고 ★합친 판에서 **S3·S1·N2** 를 다시 돌려 확인했다 | ⚠️이 절대값은 ★내 레인 기준이라 ⛔최종값이 아니다 |
| `gd/padviz` (아래 패딩 띠 ＋ 띠·그리드 ★색 피커 · 현빈 2026-10-07 ①②) | **＋9** | `pad-hint-bottom` **0 → 9**(B1 아래 띠 ★좌우를 양성대조로 · B2 끔 게이트 공유 · B3 거두기 ＋ ★저장본 0건 · B4 패딩 색 → ★좌우·아래 둘 다 ＋ ★그리드 무변 · B5 그리드 색 → ★패딩 띠 무변 · B6 ★자 ★둘 — ㉠눌렸나(그룹 자연폭) ＋ ㉡★쪼개졌나(★구별되는 y · ⛔scrollWidth·getClientRects().length 둘 다 ★오탐한다, 쿠폰 레인 실측) · B7 ★고른 색이 쓸기를 살아남는다 · B8 내보내기 가드가 아래 띠도 끈다 · ★B9 ★현빈 ①의 ★둘째 조건 ㉡「어떻게 줄어드는지」 — 띠·실제패딩·숫자칸 ★세 축 단조성 ＋ 0 자리 실측) · ★base = dev **`11aa339f`**(그 위에서 바로 작업 — rebase·충돌 ★0) | 새 spec **1개** ⇒ 파일 수 **＋1**(336 → 337) · 루프·`test.each`·describe 반복 **0건** ⇒ 선언 수 = 실행 단위 수 · `test.fail` **0** ⇒ `✘` 0 · ★두 출처 일치 — ㉠ git `^test(` 선언 수 **8**(base 엔 이 파일이 **없다**=0) / ㉡ 러너 `--list` 전체 **2923 → 2932**(339 → 340) — ★`f8a5e22d` 위로 ★rebase 를 ★끝낸 판에서 ★직접 떴다(2026-10-07 12:3x · 같은 작업트리에서 ★내 spec «하나만» 치워 `--list` 를 ★두 번. 그 치움이 base 의 spec 집합을 되살린다는 근거 = `git status --porcelain` 이 치운 뒤 되돌리고 ★0건). ★★지디의 사슬 예상(**2923 ＋ 9 = 2932**)과 ★두 출처가 ★맞았다 — ⛔빌린 수가 아니라 ★내가 뜬 수다. ⚠️그래도 이 절대값은 ★`{pin}` 시점의 사실이다 — dev 가 또 서면 ★최종은 조정자가 한 번에 센다 · ★⚠️위 `gd/coupon` 줄도 base 가 **`11aa339f`** 이고 시작 절대값이 **2882** 다 ⇒ ★세 레인이 ★같은 판에서 갈라졌다. 머지 때 ⛔절대값을 이어 읽지 말고 ★각 레인 증분(＋15·＋10·＋8)을 ★따로 더해라 · ★＋unit 축 **＋5**(`tests/unit/pad-hint.test.js` **11 → 16** — T11 아래 띠 CSS · T12 쓸기 접두사 두 소스 일치 ＋ ★색 이름 경계 · T13 색 피커 둘·키 넷 · ★T14 거두기가 «두 층»(라이브 2 ＋ 저장 1벌) — ⛔합칠 수 없다 · ★T15 ★주석은 세어지지 않는다(소스 파싱 게이트의 입력에서 주석이 빠지나 — 2026-10-07 circletext 사고의 자). ★T1·T4·T5 는 ★«제자리에서 뜯어고쳤다»(수 변화 0): T1 색→변수 · T4 거두기 공용 한 벌 ＋ 소비자 둘 · ★★T5 는 ★뒤집었다 — 옛 T5 가 「applyPadB 에 힌트가 붙으면 빨강」이라 ★현빈 ①을 금지하고 있었다(T6 선례대로 지우지 않고 방향만) · ⛔DOM EXPECT_N 에는 **안 센다**) ★이 줄을 얹은 판 = `origin/dev` **f8a5e22d** (2026-10-07 12:3x · ★rebase 완료판 — 지디 「rebase 는 «넘길 때» 한 번」) — ⚠️`origin/dev` 는 ★공유 `.git` 에 살아서 ★다른 레인의 fetch 로 ★내 ref 가 움직인다(실측: 30분에 `11aa339f`→`e42a81bc`→`eda3ef7a`→`b5dd750d`→`35a9536f`→`ee910798` ★다섯 번). ⇒ ⛔머지 전에 ★이 파일을 ★다시 받고 ★이 줄만 옮겨라 — ★내 커밋의 이 파일 diff 에서 `-` 로 보이는 줄은 ★내가 지운 게 아니라 ★그 뒤 dev 가 더한 것이다 (검증: `git show b5dd750d:tests/dom/EXPECT_N.md` 에서 ★쿠폰 «뒷」＋「고침» 줄을 세면 **0**, 같은 자로 `origin/dev` 를 세면 **1** — ⚠️낱말을 ★일부러 쪼개 적었다: ★이 문장이 ★그 낱말을 온전히 품으면 ★다음 사람의 센 수를 ★내가 늘린다). |

★네 spec 모두 «루프로 test 를 감싸지 않았다» ⇒ 선언 수 = 실행 단위 수 ⇒ 위 「루프 spec」 표에 더할 것이 ★없다.

⛔★★`marquee-edge-autoscroll +6` 이 ★두 줄이다 — ★접지 마라. ★같은 이름·같은 수인데 ★다른 증분이다.
| 줄 | 뜻 | 상태 |
|---|---|---|
| `gd/small3` 의 `+6` | 이 spec 의 ★«생성» — **0 → 6** (2026-10-06 `2fe08b09`) | ★이미 dev 에 있다(기준 2864 에 ★포함) |
| `gd/dragscroll` 의 `+6` | ★그 위의 **6 → 12** | ★이번에 올리는 것 |
★가른 자(2026-10-07 실측): 이 spec 을 건드린 브랜치를 ★전부 셌다(로컬·원격 ★18개) — ★모두 «1 커밋»(= `2fe08b09` 상속)이고
★`gd/dragscroll` 만 «2 커밋»이다. ⇒ ⛔두 줄을 하나로 접으면 ★검사 여섯이 조용히 안 세어진다(= 「0건이 초록」).
★교훈: 증분 명부에 ★«같은 이름·같은 수»가 둘 보이면 ⛔접기 전에 ★「어느 판에서 0 이었나(base)」를 물어라 —
`0 → N` 과 `N → 2N` 은 ★같은 수로 적히지만 ★다른 것이다.
(루프는 ★test 안에만 있다 — bubble B6 의 7종 전수 · star S2~S4b 의 좌표 순회. 그건 실행 단위 1개다.)
⚠️⛔이 레인 «단독» 절대값은 ★적지 않는다 — 머지 전 한 레인 기준이라 다른 레인이 들어오면 틀린다.
(참고로 ＋26 시점에 러너 헤더 `Running 2764 tests using 3 workers` 와 `--list` `Total: 2764` 가 ★두 출처로
일치했다는 사실만 남긴다 — 그 수가 아니라 ★두 출처가 맞았다는 것이 기록할 값이다.)

⑷(말풍선 g)의 제품 고침은 ★이 레인이 든다(`js/blocks/line-host.js` `_lnPickedLine` — 지디 2026-10-06
채택, fx-parity 의 `synthetic` 안은 물렸다). `bubble-shortcut-not-in-text` 7칸 전부 ★이 레인에서 초록이다.
머지 순서: ★태양의 협업 묶음(dev `40179846` · 2744)이 먼저 올라갔고, 이 레인을 ★그 위로 rebase 했다
(2026-10-06 · 충돌 0). ⇒ 이 레인의 증분 ＋30 은 ★2744 위에 얹힌다.
