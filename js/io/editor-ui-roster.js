/* editor-ui-roster — ★★「편집 전용 UI」 ★한 집 (2026-10-23 · 지디 · R1 `CAPTURE-ROSTER-NOT-DERIVED-FROM-SAVE-01`)
 *
 * ★★왜 ★여기로 ★옮겼나
 *   ★이 명부는 ★`js/io/save-load.js` 에 있었고, ★그 머리말이 ★이미 이렇게 적고 있었다:
 *     「★두 곳이 ★«같은 상수»를 봐야 한다. ★목록을 ★두 벌로 만들면 ★한쪽이 ★반드시 ★뒤처진다.」
 *   ★★★그런데 ★«세 번째 곳»이 ★자랐다 — ★캡처 공용 겹(`js/io/capture-safety.js`
 *     `stripEditorOnlyForCapture`)이 ★제 손 명부를 ★따로 들고 ★이 상수를 ★★안 봤다.
 *   ⇒ ★실측(261023): ★저장 정본 ★32종 중 ★「캡처에서도 지워야 함(yes)」인데 ★캡처가 ★안 지우는
 *     선택자가 ★★18종 · ★칸으로 ★★31 이었다. ★그 중 ★★★이 상수에 ★이미 있던 것이 ★★14종이다.
 *   ⇒ ★★★그러니 처방은 ★「캡처 명부에 ★14줄 더하기」가 ★아니라 ★★★「캡처가 ★이 상수를 ★읽게 하기」다.
 *     ⛔줄을 더하면 ★다음 줄이 ★또 온다 — ★이 파일이 ★그 «다음 줄»을 ★없앤다.
 *
 * ★★⛔그런데 ★save-load.js 에 ★그대로 두고 캡처가 ★import 하면 ★★순환이다
 *   `js/io/save-load.js:14` 가 ★이미 `./capture-safety.js` 를 ★부른다.
 *   ⇒ ★거꾸로 걸면 ★export-html·export-image 가 ★save-load 전체를 ★조용히 끌어온다.
 *   ⇒ ★그래서 ★«아무도 안 부르는 잎 모듈»로 ★뺐다. ★양쪽이 ★여기를 ★본다.
 *
 * ★★★이 파일은 ★★«명부»다 — ★코드가 ★아니다. ⛔여기에 ★로직을 ★넣지 마라.
 * ⛔늘릴 때 : ★아래 ⛔계약(「serializeProject 가 ★실제로 지우는지 ★먼저 확인」)을 ★그대로 지켜라.
 *   ★그 계약을 ★S3 가 잠근다(「NON_CONTENT_UI_SELECTOR 의 모든 항목이 저장에서 0건」).
 * ★★이 상수를 ★읽는 자 ★전수(261023) — ★늘면 ★여기도 ★한 줄:
 *     js/io/save-load.js       재-export ＋ 로드 후 걷기(:545) ＋ dirty 필터(:679·:683) ＋ window 에 올리기
 *     js/io/capture-safety.js  stripEditorOnlyForCapture — ★★261023 신설(이 파일이 생긴 까닭)
 *     js/editor.js:1580        ⌘C 글자 뽑기 — `window.NON_CONTENT_UI_SELECTOR` 경유
 *   ★검사 쪽 정본 자리 = `tests/_export-channels.js` EDITOR_NODE_CANON_SRC(★이 파일을 가리킨다)
 */

/* ═══════════════════════════════════════════════════════════════════
   [P-A1″] «편집이 아닌 것»의 단일 목록

   계약: **이 목록은 「저장에서 지워지는 것」 = 「편집이 아닌 것」이다.**
     ⇒ `serializeProject()` 가 저장 «전»에 지우므로, 이것들의 생성·제거는 정의상 «콘텐츠 변화»가 아니다.
     ⇒ 그러므로 `autoSaveObserver` 도 이것들 때문에 저장을 예약해선 안 된다.
   ⛔여기에 무언가 추가할 때는 **`serializeProject` 가 실제로 그걸 지우는지 먼저 확인**하라.
     지우지 않는 것을 넣으면 «진짜 편집»이 저장되지 않는다 — 데이터 손실이다.
   ★두 곳이 «같은 상수»를 봐야 한다. 목록을 두 벌로 만들면 한쪽이 반드시 뒤처진다.

   왜 생겼나(실측 2026-09-05, 진짜 입력): 에셋 블록을 클릭하면 `.ab-rotate-zone` 4개가
   캔버스 «안»에 붙었다 떨어지고(childList ×12), 그게 `autoSaveObserver` 를 «편집»으로 깨웠다.
   ⇒ 1500ms 뒤 `serializeProject()`(90MB) 가 메인스레드를 811ms 멈춘다 = 팬 도중의 「탁」.
   ⇒ 그런데 그 회전존은 «저장 직전에 지워지는» 것이었다. 편집일 수가 없다. */
export const NON_CONTENT_UI_SELECTOR =
  '.img-corner-handle, .img-edge-handle, .img-edit-hint, .img-boundary, .img-rotate-zone, .ab-rotate-zone, .shape-rotate-zone, .sticker-rotate-zone, .tb-rotate-zone, .icn-rotate-zone, .mkp-rotate-zone, .cvb-rotate-zone, .icb-rotate-zone, .vb-rotate-zone, .mdl-rotate-zone, .mdl-profile-x, .sec-bg-proxy, .grd-add-btn, .section-height-badge, .annot-handle, .annot-selbox, .tfh-handle, .tfh-grid, .tfh-fx, .tfh-edge, .tfh-layer';
/* ★★★.tfh-handle · .tfh-grid (2026-10-24 · U3 자유변형 손잡이 · 지디 · 현빈 GO) — ★글상자 ★자유변형의
     ★모서리·변 ★손잡이 ★12 와 ★격자다. ★`.text-block` 의 ★«자식»으로 붙으므로 ★★여기 올리지 않으면
     ★저장본·PNG·썸네일·단독 HTML 로 ★★샌다(★고른 채 내보내면 ★박힌다 = `EXPORT-SELECTED-HANDLE-BAKED-IN-01`).
   ★이름을 ★`tfh-` 로 ★고른 까닭(★실측 261024): ★`ft-` 는 ★★임자가 있다 — `projects-onescreen` 의
     ★폴더 타일(`.ft-tile`·`.ft-add`·`.ft-sub` · ★레포 ★48건). ★`tfh-`·`tfc-`·`tform-` 는 ★0건이었다.
   ★계약 짝 : `js/io/section-serialize.js` `serializeCleanRoot` 의 remove 줄에도 ★같이 올렸다(★한 커밋).
   ★판정 : `tests/_export-channels.js` ★`CAPTURE_VERDICT` 에 ★`_Y` 로 적었다(★R0b 가 빈 칸을 잡는다). */
/* ★.annot-handle · .annot-selbox (1013t1A3) — 어노테이션 선택 중에만 사는 손잡이. serializeCleanRoot 의 remove 줄에 같이 올렸다(계약 짝). */
/* ★.mdl-rotate-zone (2026-10-08 지디) — ★모달 블럭의 회전 손잡이. ⛔빠져 있었다.
   ★증상: modal-frameify U1·U3 가 ★origin/dev 에서 빨강이었다 — 「프레임화 → ⌘Z 한 번 = 앞 직렬화와
     글자 단위로 같다」가 ★앞 1,245자 vs ★뒤 4,373자로 갈렸고, 갈린 자리가 바로
     `<div class="mdl-rotate-zone tl" data-corner="tl" style="position: absolute; …`였다.
   ★전수로 확인했다 — `zoneClass:` ★정의 자리 7개(cvb·icb·icn·★mdl·mkp·tb·vb) 중 ★이 명부에 없는 것이
     ★★mdl 하나뿐이었다(⛔사용 자리 grep 이 아니라 정의 자리에서 셌다).
   ★위 ⛔계약대로 section-serialize.js serializeCleanRoot 의 remove 줄에도 ★같이 올렸다 —
     그쪽에도 0건이었다. ⇒ 두 자리를 한 커밋에.
   ★그 쌍은 S3(「NON_CONTENT_UI_SELECTOR 의 모든 항목이 저장에서 0건」)가 ★자동으로 잠근다. */
/* ★.mdl-profile-x (1017t1l2 · 2026-10-19) — 버즈 카드 프로필의 × 단추. ★에디터 크롬이다
   (호버할 때만 보이고, 그리는 자는 renderModalBlock 이다 — 로드가 모달을 다시 그리므로 저장본에 남길 까닭이 없다).
   ★위 ⛔계약대로 «serializeProject 가 실제로 지우는지»를 먼저 확인하고 넣었다 —
     js/io/section-serialize.js serializeCleanRoot 의 remove 줄에 같이 올렸다(mdl-rotate-zone 과 같은 쌍).
   ★내보내기는 또 다른 자리다 — js/io/export-html.js 에도 같이 올렸다(그쪽은 이 상수를 안 읽는다). */
/* ★.section-height-badge (2026-10-07 (다)) — 위 ⛔계약대로 «serializeProject 가 실제로 지우는지»를
   먼저 확인하고 넣었다: js/io/section-serialize.js serializeCleanRoot 의 remove 줄에 같이 올렸다.
   (그 쌍을 tests/dom/section-height-display.dom.spec.js S1 이 잠근다 — 저장본·히스토리에 배지 0건.) */

