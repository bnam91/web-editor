/* _block-roster-294 — 컴포넌트 종류의 분모와 넣는 입구(t9-03 J294K · 뒤의 t9-04 재사용).
 * 분모 = js/editor.js SECTION_BLOCK_TYPE_SEL 파생(손으로 안 적는다) · 입구 = window.add*Block 이름을 런타임에 찾는다(없으면 «입구 없음»). */
const rosterOf = (page) => page.evaluate(() => {
  const classes = window.SECTION_BLOCK_TYPE_SEL.split(', ').map((s) => s.trim().replace(/^\./, ''));
  const adds = Object.keys(window).filter((k) => /^add.*Block$/.test(k) && typeof window[k] === 'function');
  const flat = (s) => s.replace(/-/g, '').toLowerCase();
  return classes.map((cls) => { const want = 'add' + flat(cls).replace(/block$/, '') + 'block'; return { cls, entry: adds.find((a) => a.toLowerCase() === want) || null }; });
});
/* 그 자리에 앱 입구로 넣고 새 요소 id 를 돌려준다. parent 없으면 섹션 직속 */
const addKind = (page, { cls, entry }, parent) => page.evaluate(async ({ cls, entry, parent }) => { const sec = window.__secEl(); window.deselectAll?.(); window.selectSection(sec); window._activeFrame = parent ? document.getElementById(parent) : null; const b = new Set(sec.querySelectorAll('.' + cls));
  try { await window[entry](); } catch (e) { return { err: String(e.message).slice(0, 100) }; }
  const f = [...sec.querySelectorAll('.' + cls)].find((x) => !b.has(x)); window.deselectAll?.(); window._activeFrame = null; if (!f) return { err: '넣어도 새 요소 없음' }; if (!f.id) f.id = 'blk_' + Math.random().toString(36).slice(2, 9);
  return { id: f.id, inParent: parent ? !!document.getElementById(parent).contains(f) : true, abs: getComputedStyle(f).position === 'absolute' }; }, { cls, entry, parent });
module.exports = { rosterOf, addKind };
