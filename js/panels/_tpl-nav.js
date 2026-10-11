/* _tpl-nav.js — ★설계 D(b1): ★파인더 꼴 ★방향키의 ★★«순수 핵»
 *
 * ★★찾은 자 = t4quote · ★M1·M2·M3 ★판정 = 지디 · ★고친 자 = t1bstar.
 *
 * ★★★왜 ★여기 ★있나 — ★★DOM 없이 ★재려고.
 *   ★D 의 단언 중 ★★«커서가 ★양 끝에서 ★멈추나»(D2)와 ★★«검색어를 ★해제하나»(D6·D8·D9)는
 *   ★★★«결정»이고 ★★«그리기»가 ★아니다. ⇒ ★★그 둘을 ★★DOM 밖으로 ★꺼내면 ★★unit 으로 ★잠근다.
 *   ⇒ ★★DOM 이 ★꼭 ★필요한 칸만 ★DOM 에 ★남는다(★캐럿 ★D4 · ★차례 ★D7 · ★진입 ★D1·D3).
 *
 * ★★★M1 ★최종 판정(지디) — ★★«해제는 ★«거르는 항목을 ★바꾸는 ★진입»에서만»
 *   ★커서 이동(`←`·`↑`·`↓`)            ⇒ ★★해제 ★안 한다 (★«고르는» 것이 ★아니다)
 *   ★진입(`→`·`Enter`·`⌘↓`)이 ★거름을 ★바꾸면 ⇒ ★★해제한다
 *   ★진입했는데 ★«지금 거르는 ★그 항목»이면 ⇒ ★★해제 ★안 한다
 *   ⇒ ★★규약 ⑵ 의 ★목적(«0건이 되는 것을 ★막는다»)이 ★그대로 ★지켜진다 —
 *     ★★같은 항목으로 ★재진입하면 ★★새로 ★0 이 ★될 ★수가 ★없다(★거름이 ★안 바뀌었으니).
 *
 * ★★★⛔`export`·`import` 금지 — ★★`pages/template-browser.html` 이 ★소비자를 ★고전 스크립트로 싣는다.
 */

/** ★커서를 ★한 칸 ★옮긴다. ★★양 끝에서 ★★멈춘다 — ⛔wrap ★안 한다(★뎁스2 의 ↑↓ 거동과 ★맞춘다).
 *  ★`cursor` 가 ★범위 밖(★-1 등)이면 ★★첫/끝 칸으로 ★들어선다. */
function tplNavMove(cursor, count, dir) {
  const n = Number(count) || 0;
  if (n <= 0) return -1;
  const d = dir < 0 ? -1 : 1;
  const c = Number(cursor);
  if (!Number.isInteger(c) || c < 0 || c >= n) return d > 0 ? 0 : n - 1;
  const next = c + d;
  if (next < 0 || next >= n) return c;        // ★★양 끝 — ★★제자리
  return next;
}

/** ★두 «거름»이 ★같은가. ★★`tag` 까지 ★본다 — ★태그 칩이 ★거름의 ★한 축이다. */
function tplNavSameFilter(a, b) {
  const x = a || {}, y = b || {};
  return String(x.folder) === String(y.folder)
      && String(x.category) === String(y.category)
      && (x.tag == null ? null : String(x.tag)) === (y.tag == null ? null : String(y.tag))
      && Boolean(x.starred) === Boolean(y.starred);
}

/** ★★★해제하나 — ★M1 최종 판정을 ★★여기 ★한 자리에 ★둔다.
 *  ★`kind`: ★`'move'`(커서 이동) | ★`'enter'`(진입)
 *  ⇒ ★★`'move'` 는 ★★언제나 ★false. ★`'enter'` 는 ★★거름이 ★바뀔 때만 ★true. */
function tplNavShouldClearSearch(kind, curFilter, nextFilter) {
  if (kind !== 'enter') return false;              // ★커서 이동은 ★«고르는» 것이 ★아니다
  return !tplNavSameFilter(curFilter, nextFilter);  // ★거름이 ★바뀌는 ★진입만
}

/** ★★`_browserSelected` 를 ★버리나 — ★M2 판정(★기억한다)의 ★자리.
 *  ★★거름이 ★바뀌면 ★★카드 명부가 ★달라지니 ★기억은 ★뜻이 ★없다 ⇒ ★버린다(⇒ ★첫 카드 자동선택).
 *  ★★거름이 ★그대로면 ★★기억한다 — ★★현빈 「파인더의 개념과 똑같이」가 ★그 근거다. */
function tplNavShouldDropSelection(kind, curFilter, nextFilter) {
  if (kind !== 'enter') return false;
  return !tplNavSameFilter(curFilter, nextFilter);
}

window.tplNavMove = tplNavMove;
window.tplNavSameFilter = tplNavSameFilter;
window.tplNavShouldClearSearch = tplNavShouldClearSearch;
window.tplNavShouldDropSelection = tplNavShouldDropSelection;
