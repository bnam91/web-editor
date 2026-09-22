/* notice.mjs — 「사용자에게 «알려 줬나»」를 재는 자.
 *
 * ⛔「요소가 있다」로 세지 마라. 이 앱의 토스트는 «재사용 노드»다 —
 *    js/drag-utils.js:309 showToast 가 #editor-toast 를 한 번 만들면 DOM 에 영원히 남고
 *    .show 클래스만 토글된다(css/editor-toast.css:10 `opacity:0` · :22 `.show{opacity:1}`).
 *    ⇒ 존재로 세면 «한 번 뜬 뒤로는 언제나 통과»한다. rect·opacity·innerText 로 «보이는지»를 잰다.
 *
 * 세는 것 = «떠 있는 안내»: 캔버스 밖에 있고, 글자가 있고, 눈에 보이며,
 *   position fixed/absolute 이거나 role=alert|status 이거나 aria-live 를 단 것.
 *   (토스트·스낵바·경고띠가 전부 이 꼴이다. 레이어 목록의 「Group 1」 같은 «구조 UI»는
 *    static 흐름이라 안 걸린다 — 구조가 바뀐 것을 «알림»으로 세면 거짓 통과가 난다.)
 * ★그래도 «캔버스 밖의 모든 새 글자»를 같이 돌려준다(fullDiff) — 사람이 직접 읽어 판단하게.
 */
export const NOTICE_FN = `
function __notices() {
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('#canvas-area')) continue;
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (parseFloat(cs.opacity) < 0.05) continue;
    const txt = (el.innerText || '').trim();
    if (!txt) continue;
    if ([...el.children].some(c => (c.innerText || '').trim() === txt)) continue;  // 같은 글자를 감싼 부모는 뺀다
    const role = el.getAttribute('role') || '';
    const live = el.getAttribute('aria-live') || '';
    const floating = cs.position === 'fixed' || cs.position === 'absolute' || role === 'alert' || role === 'status' || !!live;
    out.push({ sel: el.id ? '#' + el.id : (el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).slice(0,2).join('.') : '')),
               text: txt.slice(0, 140), rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
               opacity: cs.opacity, position: cs.position, role, live, floating });
  }
  return out;
}`;

const key = (n) => n.sel + '␟' + n.text;

/** ⌘G·Enter 같은 «한 동작» 앞뒤로 재고, «새로 뜬 안내»만 돌려준다. */
export async function watchNotices(s, action, { samples = [150, 300, 500, 900, 1000] } = {}) {
  const before = await s.eval(`${NOTICE_FN} return __notices();`);
  const beforeKeys = new Set(before.map(key));
  const toastBefore = await s.eval(`
    const t = document.getElementById('editor-toast'); if (!t) return null;
    const r = t.getBoundingClientRect(); const cs = getComputedStyle(t);
    return { text: t.textContent, cls: t.className, rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], opacity: cs.opacity };`);

  await action();

  const seen = new Map();
  const toastSeen = [];
  for (const ms of samples) {
    await s.sleep(ms);
    const now = await s.eval(`${NOTICE_FN} return __notices();`);
    for (const n of now) if (!beforeKeys.has(key(n))) seen.set(key(n), n);
    toastSeen.push(await s.eval(`
      const t = document.getElementById('editor-toast'); if (!t) return null;
      const r = t.getBoundingClientRect(); const cs = getComputedStyle(t);
      return { text: t.textContent, shown: t.classList.contains('show'), opacity: cs.opacity, h: Math.round(r.height) };`));
  }
  const fresh = [...seen.values()];
  return {
    floatingNotices: fresh.filter(n => n.floating),
    fullDiff: fresh,
    editorToast: { before: toastBefore, samples: toastSeen },
  };
}
