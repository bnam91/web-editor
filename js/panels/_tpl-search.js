/* _tpl-search.js — ★템플릿 브라우저 ★검색의 ★«한 자리».
 *
 * ★★찾은 자 = t4quote(★설계 b3 ＋ ★`tpl-browser-search-mode` 가 ★죽어 있음을 ★여섯 자로 쟀다)
 * ★★고친 자 = t1bstar.
 *
 * ★★★이 자가 ★가르는 ★두 축 — ★★직교다(★섞이지 ★않는다):
 *   ⒜ ★★모드 = ★«낱말 ★하나를 ★★어느 ★칸에 ★대보나»   (★전체⇒넷 · ★파일명⇒name · ★태그⇒tags)
 *   ⒝ ★★AND  = ★«낱말이 ★여럿이면 ★★전부 ★만족»        (★칸과 ★무관)
 *
 * ★★정본(지디 · 2026-10-11):
 *   «검색어를 ★구분자(`&`·`,`·공백)로 ★쪼개 ★낱말을 ★얻는다. ★낱말이 ★전부 ★만족해야 ★맞은 것이다(AND).
 *    ★각 낱말은 ★«모드가 ★고른 ★칸들» 중 ★어디든 ★걸리면 ★맞은 것이다.
 *    ★낱말이 ★0개(★빈 검색어·구분자만)면 ★★전체가 ★보인다.»
 *
 * ★★★⛔⛔`export`·`import` 를 ★★여기에 ★넣지 ★마라 — ★★이 자는 ★★`<script src>` 로도 ★실린다
 *   (★`pages/template-browser.html:202` 가 ★`template-browser.js` 를 ★★고전 스크립트로 ★싣고,
 *    ★그 자가 ★이 자를 ★부른다). ★★모듈 꼴로 ★쓰면 ★별창이 ★★통째로 ★죽는다.
 *   ★★그리고 ★★`.mjs` 사본에 ★`node --check` 를 ★걸어도 ★★이 흠은 ★★안 잡힌다 —
 *   ★★그 자는 ★★«어떻게 ★실리나»를 ★★못 본다(★261011 ★C11 에서 ★실제로 ★밟았다).
 *   ⇒ ★★그래서 ★★이 금지를 ★★검사가 ★잠근다(`tpl-search-terms.test.mjs` ★T1).
 */

/* ★★모드가 ★고르는 ★칸 — ★★«명부가 ★하나»다. ⛔소비자 쪽에서 ★다시 적지 ★마라.
   ★★`(x || '')` 는 ★★네 칸 ★★전부에 ★건다 — ★★★`name` 도 ★마찬가지다.
     ⚠️★`name` 에 ★가드를 ★더한 ★까닭 = ★★«다른 셋과 ★꼴을 ★맞추려»다.
     ⛔「★없을 ★수 ★있으니」가 ★★아니다 — ★★그건 ★★내가 ★안 쟀다. ★실측은 ★★0건이고
        ★★그 0 이 ★유지되는 ★까닭도 ★모른다(★저장 경로를 ★전수하지 ★않았다) ⇒ ★★꼴로만 ★적는다. */
function tplSearchFields(t, mode) {
  const o = t || {};
  const name = String(o.name || '').toLowerCase();
  const tags = (o.tags || []).map(g => String(g).toLowerCase());
  if (mode === 'name') return [name];
  if (mode === 'tag')  return tags;
  /* ★'all' ＋ ★★못 아는 값 = ★넷 — ★★옛 동작이 ★이것이다(`:377~384`) ⇒ ★★기본을 ★안 바꾼다 */
  return [name, String(o.folder || '').toLowerCase(), String(o.category || '').toLowerCase(), ...tags];
}

/* ★★낱말 쪼개기 — ★구분자 ★셋이 ★★같은 결과를 ★내야 한다(★정본 ⒟).
   ★★`filter(Boolean)` 이 ★★«구분자만»을 ★★`[]` 로 ★만든다 ⇒ ★★그 ∅ 가 ★★⒡ 의 ★자리다. */
function tplSearchTerms(s) {
  return String(s == null ? '' : s).split(/[&,\s]+/).map(x => x.trim().toLowerCase()).filter(Boolean);
}

/* ★★한 벌이 ★맞나 — ★★`every`(AND) × ★`some`(모드가 고른 칸 중 어디든).
   ★★★`terms` 가 ★★`[]` 면 ★★`every` 가 ★★true ⇒ ★★전체가 ★보인다(★정본의 ★마지막 절). */
function tplSearchMatch(t, terms, mode) {
  const fields = tplSearchFields(t, mode);
  return (terms || []).every(w => fields.some(f => f.includes(w)));
}

/* ★★소비자가 ★부르는 ★단 하나의 문 — ★★검색어·모드를 ★그대로 ★넘긴다. */
function tplSearchFilter(list, q, mode) {
  const terms = tplSearchTerms(q);
  if (terms.length === 0) return (list || []).slice();   // ★★∅ ⇒ ★전체(★`every` 와 ★같은 답 · ★빠른 길)
  return (list || []).filter(t => tplSearchMatch(t, terms, mode));
}

window.tplSearchFields = tplSearchFields;
window.tplSearchTerms  = tplSearchTerms;
window.tplSearchMatch  = tplSearchMatch;
window.tplSearchFilter = tplSearchFilter;
