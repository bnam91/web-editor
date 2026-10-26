/* non-edit-roster — ★「편집이 아닌 차이」 이름 명부 ★한 집 (2026-10-26 · 지디 167 처방 · F4-GATE-NEVER-FIRES-IN-APP-01)
 *
 * ★왜 생겼나 (실측 · fa57bed6 · 수지 저장본 ×4 — reports S7-FIX-T0 「167 변이 명부」)
 *   130 싼 게이트(js/history.js pushHistory 머리)가 앱에서 0 회 걸렸다. 막는 것은 ㉠ 캔버스 세대 하나 —
 *   오버레이 켜기 push 가 꼭대기를 찍은 «뒤» 같은 손의 뒤늦은 style 한 묶음(`--sec-clip` 값 45px→111px)이
 *   세대를 +1 → 끌기 시작 표본이 늘 비싼 길. 그런데 그 차이는 «비교»(history.js _NON_EDIT_ATTR_RE)가 ★이미
 *   「편집 아님」으로 벗기고 있었다 ⇒ «새 중립 목록»이 아니라 «있는 정의를 둘이 같이 본다».
 *
 * ★읽는 자 전수 — 늘면 여기도 한 줄:
 *     js/io/save-load.js  _isGenNeutral — 감시자가 MutationRecord 로 본다(★문자열 작업 0 · ⛔_stripNonEdit 을 감시자에서 부르지 마라:
 *                         37MB 정규식 313~578ms 를 변이마다 치르게 된다)
 *     js/history.js       _NON_EDIT_ATTR_RE · _CHROME_RE — ★글자 그대로 둔다(⛔무접촉 · 게이트 history-chrome-noise 등 셋이 그 선언을 글로 읽는다).
 *                         대신 tests/unit/non-edit-roster-167.test.mjs 가 «이 이름으로 조립한 정규식의 .source === 그 글자»를
 *                         바이트째 잠근다 ⇒ 두 벌이 아니라 «한 이름 · 한 단언»이다(한쪽만 바꾸면 빨강).
 *
 * ⛔undo 쪽에는 안 쓴다(159 ㉮ 거절 — undo 쪽 중립 오판 = ⌘Z 가 캔버스를 안 되돌림 = 데이터 사고).
 * ⛔lazy 셋(data-lazy-bg · lazy 배경 style · ±lazy-unloaded)은 ★안 넣는다 — 안 잰 것을 중립에 넣으면 그게 중립 오판.
 * ⛔늘릴 때: 넣는 만큼 「그 부분만 다른 편집」의 이력 칸이 사라진다(history.js :63 위 ⚠️ 그대로) — 먼저 «실제 스냅샷 diff»로 재라.
 * ★이 파일은 «명부»다 — ⛔로직을 넣지 마라(editor-ui-roster.js 와 같은 꼴 · 아무도 안 부르는 잎 모듈). */

/** 값이 바뀌어도 편집이 아닌 «속성 이름» — history.js `draggable="(?:true|false)"` */
export const NON_EDIT_ATTRS = Object.freeze(['draggable']);
/** style 안에서 값이 바뀌어도 편집이 아닌 «CSS 변수» — history.js `\s*--sec-clip:\s*[^;"]*;?` */
export const NON_EDIT_CSSVARS = Object.freeze(['--sec-clip']);
/** 통째로 «UI 크롬»인 자리 — history.js _CHROME_RE(`<div class="section-toolbar">…`) */
export const CHROME_SEL = '.section-toolbar';
