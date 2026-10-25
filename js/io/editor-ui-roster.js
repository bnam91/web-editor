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
  '.img-corner-handle, .img-edge-handle, .img-edit-hint, .img-boundary, .img-rotate-zone, .ab-rotate-zone, .shape-rotate-zone, .sticker-rotate-zone, .tb-rotate-zone, .icn-rotate-zone, .mkp-rotate-zone, .cvb-rotate-zone, .icb-rotate-zone, .vb-rotate-zone, .mdl-rotate-zone, .mdl-profile-x, .sec-bg-proxy, .grd-add-btn, .section-height-badge, .annot-handle, .annot-selbox, .tfh-handle, .tfh-grid, .tfh-fx, .tfh-edge, .tfh-layer, .sticker-corner-handle, .hlb-handle, .annot-point-angle, .shape-handle, .gradient-corner-handle';
/* ★★★`.shape-handle` · `.gradient-corner-handle` (2026-10-25 · 지디 · ★`CAPTURE-ROSTER-NOT-DERIVED-FROM-SAVE-01` 의 ★남은 몫)
     ★도형 ★4모서리 손잡이(block-drag.js:1137)와 ★그라데 ★4모서리 손잡이(gradient-select.js:35)다.
     ★둘 다 ★블럭의 ★«자식»으로 붙는다.
   ★★★계약을 ★먼저 쟀다(★머리말의 ⛔「serializeProject 가 ★실제로 지우는지 ★먼저 확인」) —
     ★`tests/dom/save-strip-plus7-window.dom.spec.js` ★`W1`·`W2`(261025 · ★한 동기 블록에서) :
       `.shape-handle`           라이브 4 · ★섹션 저장본 ★0 · ★프로젝트 저장본 ★0 · ★★캡처 클론 ★★4
       `.gradient-corner-handle` 라이브 4 · ★섹션 저장본 ★0 · ★프로젝트 저장본 ★0 · ★★캡처 클론 ★★4
     ⇒ ★저장은 ★이미 지운다 ⇒ ★★데이터 손실 위험 ★없다. ★★그런데 ★캡처는 ★안 지웠다.
   ★★⛔같이 쟀으나 ★★넣지 ★않은 것 ★다섯 (★그 까닭이 ★여기 있다) :
     `.grad-line-overlay`  — ★`portal` → `host`(`#canvas-scaler`)에 붙는다 ⇒ ★★저장 창(`#canvas`) ★밖
     `.vpen-edit-overlay`  — ★`#ss-handles-overlay` ⇒ ★★같은 이유로 ★창 밖
       ⇒ ★★창 밖인 것은 ★★「저장이 지운다」를 ★★증명할 길이 ★없다 ⇒ ★★이 계약을 ★충족할 수 ★없다
     `.block-resize-handle` · `.ci-handle` — ★★만드는 자가 ★0(★죽은 이름 · `W5` 실측) ⇒ ★★못 잰다
     `.vpen-preview`       — ★`sec` 자식(창 ★안)이지만 ★★행위로 ★안 쟀다
       = `PLUS7-OVERLAYS-NOT-MADE-BY-BEHAVIOR-01`
   ⇒ ★★그래서 ★파생이 ★「저장 줄 ★그대로」가 ★아니라 ★★「★저장 창 ★안의 것만」이다. */
/* ★★★.tfh-handle · .tfh-grid (2026-10-24 · U3 자유변형 손잡이 · 지디 · 현빈 GO) — ★글상자 ★자유변형의
     ★모서리·변 ★손잡이 ★12 와 ★격자다. ★`.text-block` 의 ★«자식»으로 붙으므로 ★★여기 올리지 않으면
     ★저장본·PNG·썸네일·단독 HTML 로 ★★샌다(★고른 채 내보내면 ★박힌다 = `EXPORT-SELECTED-HANDLE-BAKED-IN-01`).
   ★이름을 ★`tfh-` 로 ★고른 까닭(★실측 261024): ★`ft-` 는 ★★임자가 있다 — `projects-onescreen` 의
     ★폴더 타일(`.ft-tile`·`.ft-add`·`.ft-sub` · ★레포 ★48건). ★`tfh-`·`tfc-`·`tform-` 는 ★0건이었다.
   ★계약 짝 : `js/io/section-serialize.js` `serializeCleanRoot` 의 remove 줄에도 ★같이 올렸다(★한 커밋).
   ★판정 : `tests/_export-channels.js` ★`CAPTURE_VERDICT` 에 ★`_Y` 로 적었다(★R0b 가 빈 칸을 잡는다). */
/* ★★★.sticker-corner-handle · .hlb-handle (2026-10-24 · ★적대적 ⒠ C5 · 지디)
     ★스티커 ★모서리 손잡이 ★4 와 ★선 스티커 ★끝점·두께 손잡이 ★2~3 이다. ★블럭의 ★«자식»으로 붙는다
     (`js/sticker-select.js:329` · `:204`).
   ★★★계약을 ★먼저 쟀다(★머리말의 ⛔「serializeProject 가 실제로 지우는지 먼저 확인」) :
     ★저장은 ★★이미 지운다 — `js/io/section-serialize.js` 에 ★두 이름이 ★있고,
     ★행위 측정(261024)에서 ★`serializeSectionClone` 산출에 ★★0 건이었다. ⇒ ★데이터 손실 위험 없다.
   ★★★그런데 ★캡처는 ★안 지웠다 — ★행위로 ★쟀다(⛔소스 독해가 아니다) :
       스티커(rect)   라이브 ★4 · 저장 ★0 · ★★캡처 클론 ★★4
       선 스티커(hlb) 라이브 ★3 · 저장 ★0 · ★★캡처 클론 ★★3
     ⇒ ★고른 채 ★PNG·썸네일·단독 HTML 로 내보내면 ★★보라 손잡이가 ★박힌다.
   ★★`.shape-handle` 은 ★왜 ★안 새나(★대조) : CSS 가 ★`display:none` 기본이고
     `.shape-block.selected .shape-handle` 로만 켜는데(editor-blocks.css:2543·:2551),
     ★★캡처 클론에는 ★`.selected` 가 ★★0 이다(★261024 실측 `capSel: 0`) ⇒ ★꺼진다.
     ⛔★이 둘(`:4466`·`:4490`)에는 ★그 조건이 ★★없다 ⇒ ★CSS 는 ★늘 그린다.
   ★★⛔그래서 ★CSS 에 ★조건을 ★붙이는 길을 ★★고르지 ★않았다 :
     ★`export-css-collect.js` 가 ★에디터 전용 CSS 를 ★거르므로 ★단독 HTML 에는 ★그 규칙이 ★안 실릴 수 있다
     ⇒ ★★«요소 명부»와 ★«CSS 거름»은 ★따로다. ★요소를 ★지우는 쪽이 ★세 출구를 ★한 번에 닫는다.
   ★판정은 ★★이미 나 있었다 — `tests/_export-channels.js:410`·`:412` 가 ★`_Y`(「캡처도 지워야 함」).
     ⇒ ★★판정만 있고 ★제품이 ★안 따라온 칸이었다(★`S3-GAPS` 의 「안 막히는 칸」 그 내용).
   ★재는 자 : `tests/dom/sticker-handle-capture-leak.dom.spec.js` (★행위 · 양성·음성대조 포함) */
/* ★★★.annot-point-angle (2026-10-24 · ★적대적 ⒠ ★⒟5 · 지디)
   ★무엇 : ★어노테이션 ★점 손잡이를 ★끌는 ★동안만 뜨는 ★★각도 글자(`37.5°`).
     ★만드는 곳 = `js/annotation-select.js:264` (`.annot-svg` ★안의 SVG `<text>`)
     ★지우는 곳 = `:286` `_hidePointAngleLabel` — ★끌기가 ★끝나면 ★없앤다.
   ★★★그런데 ★«끌기 ★중»에 ★자동저장이 ★끼면 ★★그대로 ★실린다 — ★행위로 ★쟀다(261024) :
     라이브 ★1 · ★저장(serializeSectionClone) ★★1 · ★캡처 클론 ★★1 · ★프로젝트 저장 ★★1
     ★그리고 ★글자(`37.5°`)까지 ★저장본에 ★들어간다.
   ★★왜 ★이제 ★문제인가 : ★261022 결정으로 ★어노테이션이 ★★«저장되는 것»이 됐다
     ⇒ ★그 안(`.annot-svg`)의 ★이 글자도 ★★같이 ★저장된다. ★전엔 ★어노가 통째로 걷혀 ★안 보였다.
     ★★「★막아둔 ★까닭이 ★먼저 죽고 ★문만 남는다」의 ★거울상 — ★★덮어 주던 것이 ★사라졌다.
   ★★⛔계약 순서를 ★지켰다 : ★먼저 ★`js/io/section-serialize.js` 의 ★제거 줄에 넣고,
     ★그 다음 ★이 명부에 올렸다. ⇒ ★머리말의 ⛔「serializeProject 가 ★실제로 지우는지 먼저 확인」이
     ★★섰다(★안 지키면 ★진짜 편집이 ★저장되지 않는다 = ★데이터 손실).
   ★판정 : `tests/_export-channels.js` ★`CAPTURE_VERDICT` 에 ★`_Y`
   ★재는 자 : `tests/dom/annot-point-angle-leak.dom.spec.js` */
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

