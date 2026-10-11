/* _tpl-sort.js — ★설계 F(b4): ★템플릿 브라우저 ★정렬 ★★«명부 한 자리»
 *
 * ★★찾은 자 = t4quote · ★★고친 자 = t1bstar.
 *
 * ★★★이 설계의 ★안전판 — ★★기본값이 ★★«지금과 ★같다»
 *   ★지금 차례 = ★`loadTemplates()` 의 ★배열 순서이고, ★`saveAsTemplate` 가 ★★`unshift` 한다
 *   ⇒ ★★사실상 ★★«최근 추가 ★내림차순»이 ★★이미 ★기본값이다
 *   ⇒ ★★그래서 ★★이걸 ★넣어도 ★★«보이는 차례»가 ★안 바뀐다. ⛔기본값을 ★바꾸면 ★★사람 화면이
 *     ★★말없이 ★달라진다 ⇒ ★★검사 ★F1 이 ★그 ★«안 바꿨다»를 ★잠근다.
 *
 * ★★★명부는 ★★여기 ★하나다 — ⛔UI 의 ★`<option>` 을 ★★손으로 ★★또 ★적지 ★마라.
 *   ★★`tplSortOptionsHtml()` 이 ★★이 명부에서 ★그린다 ⇒ ★★갈라질 ★수가 ★없다.
 *   (★내 명부: ★「★명부가 ★둘이면 ★경고 주석으로 ★못 막는다 — ★★파생시켜 ★하나로」)
 *
 * ★★★`recent` 의 ★비교자는 ★★새로 ★짜지 ★않았다 — ★★`_gallery-sort.js` 의 것을 ★쓴다.
 *   ★그 자가 ★이미: ★마이크로초까지 ★가르고(★`.85Z` vs `.850066Z` 역전을 ★고친다) ·
 *   ★★못 읽는 값은 ★★맨 뒤(=★F6) · ★동점은 ★안정 축으로 ★깬다.
 *   ⇒ ★★여기서 ★★다시 적으면 ★★그 셋이 ★★두 벌이 된다.
 *
 * ★★★⛔`export`·`import` 금지 — ★★`pages/template-browser.html` 이 ★소비자를 ★고전 스크립트로 싣는다.
 */

/* ★★비교자를 ★★«부를 때» ★찾는다 — ⛔모듈 ★평가 ★시점에 ★박지 ★마라.
   ★★까닭: ★싣는 ★차례가 ★어떻든 ★★부르는 ★시점엔 ★`_gallery-sort.js` 가 ★이미 ★섰다.
   ★★그리고 ★★없으면 ★★조용히 ★«안 정렬»로 ★떨어지지 ★않게 — ★★그 자리에서 ★던진다. */
function _recentCmp(a, b) {
  const f = window.byCreatedAtDesc || window.galleryByCreatedAtDesc;
  if (typeof f !== 'function') {
    throw new Error('★`byCreatedAtDesc` 가 ★없다 — ★`_gallery-sort.js` 가 ★안 실렸나?');
  }
  return f(a, b);
}

/* ★★★명부 — ★★차례가 ★뜻을 ★가른다: ★★첫 칸이 ★★기본값이다(★`tplSortDefault`). */
const TPL_SORTS = Object.freeze({
  recent: Object.freeze({ label: '최근 추가순', cmp: _recentCmp }),
  name:   Object.freeze({
    label: '이름순',
    /* ★`'ko'` — ★한글 ★차례를 ★★글자코드가 ★아니라 ★★사전으로 ★센다 */
    cmp: (a, b) => String((a && a.name) || '').localeCompare(String((b && b.name) || ''), 'ko'),
  }),
});

const TPL_SORT_DEFAULT = 'recent';

/** ★★`<option>` 들을 ★★명부에서 ★그린다 — ★★두 HTML 이 ★★같은 자를 ★부른다. */
function tplSortOptionsHtml(selected) {
  const sel = TPL_SORTS[selected] ? selected : TPL_SORT_DEFAULT;
  return Object.keys(TPL_SORTS).map(k =>
    `<option value="${k}"${k === sel ? ' selected' : ''}>${TPL_SORTS[k].label}</option>`
  ).join('');
}

/** ★★목록을 ★정렬해 ★★«새 배열»로 ★돌려준다.
 *  ⛔제자리 정렬(`list.sort`)을 ★하지 ★않는다 — ★★부르는 쪽의 ★배열을 ★★안 흔든다.
 *  ★★못 아는 열쇠는 ★★기본값으로 ★떨어진다(⛔`sort(undefined)` 로 ★가면 ★★기본 ★문자열 비교가 되어
 *    ★★조용히 ★★틀린 차례가 ★된다 — ★C11 에서 ★쟀다). */
function tplSortApply(list, key) {
  const k = TPL_SORTS[key] ? key : TPL_SORT_DEFAULT;
  return (list || []).slice().sort(TPL_SORTS[k].cmp);
}

window.TPL_SORTS = TPL_SORTS;
window.tplSortDefault = TPL_SORT_DEFAULT;
window.tplSortOptionsHtml = tplSortOptionsHtml;
window.tplSortApply = tplSortApply;
