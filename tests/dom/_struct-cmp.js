/* _struct-cmp.js — 두 직렬화 바이트를 «내용»으로 비교(E80 덤에서 만든 비교기 · 2026-10-04).
 *   까닭: 렌더가 style 을 rgb·띄어쓰기로 다시 써서 «같은 내용인데 날 바이트가 다름»이 난다(현빈 사본 챗 말풍선 18 속성 실측).
 *   두 바이트를 DOM 으로 풀어 나란히 걷는다 — style 은 cssText 로 정규화 · 공백만인 글자 노드는 뺀다.
 *   양성대조(e80-secdel-bytes): 글자 하나 바꾸면 차이 1 이 잡힌다.
 * structCmp(page, a, b) → { styleOnly, diffs: [{ path, kind, a, b }] } (diffs 최대 12) */
async function structCmp(page, a0, b0) {
  return page.evaluate(([a, b]) => {
    const A = document.createElement('div'); A.innerHTML = a; const B = document.createElement('div'); B.innerHTML = b;
    const norm = (name, v) => { if (name !== 'style') return v; const d = document.createElement('div'); d.setAttribute('style', v); return d.style.cssText; };
    const out = { styleOnly: 0, diffs: [] };
    const nm = (x) => (x.id || x.className || x.tagName).toString().slice(0, 40);
    const walk = (x, y, path) => {
      if (out.diffs.length >= 12) return;
      if (!x || !y) { out.diffs.push({ path, kind: 'node-missing', a: x && (x.outerHTML || x.textContent || '').slice(0, 160), b: y && (y.outerHTML || y.textContent || '').slice(0, 160) }); return; }
      if (x.nodeType !== y.nodeType) { out.diffs.push({ path, kind: 'nodeType' }); return; }
      if (x.nodeType === 3) { if (x.textContent !== y.textContent) out.diffs.push({ path, kind: 'text', a: x.textContent.slice(0, 160), b: y.textContent.slice(0, 160) }); return; }
      if (x.nodeType !== 1) return;
      if (x.tagName !== y.tagName) { out.diffs.push({ path, kind: 'tag', a: x.tagName, b: y.tagName }); return; }
      for (const n of new Set([...x.getAttributeNames(), ...y.getAttributeNames()])) {
        const va = x.getAttribute(n), vb = y.getAttribute(n); if (va === vb) continue;
        if (va !== null && vb !== null && norm(n, va) === norm(n, vb)) { out.styleOnly++; continue; }
        out.diffs.push({ path: path + '>' + nm(x), kind: 'attr:' + n, a: (va || '∅').slice(0, 200), b: (vb || '∅').slice(0, 200) });
      }
      const ch = (e) => [...e.childNodes].filter(n => !(n.nodeType === 3 && !n.textContent.trim()));
      const cx = ch(x), cy = ch(y);
      if (cx.length !== cy.length) out.diffs.push({ path: path + '>' + nm(x), kind: 'childCount', a: cx.length, b: cy.length });
      for (let i = 0; i < Math.min(cx.length, cy.length); i++) walk(cx[i], cy[i], path + '>' + (x.id || x.tagName));
    };
    walk(A, B, '');
    return out;
  }, [a0, b0]);
}
module.exports = { structCmp };
