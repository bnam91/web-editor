/* _t904-judge — t9-04 판정기. 종별 명부 없이 직렬화 바이트를 structCmp 로 견준다.
 * 세 길: undo(조작 전 ↔ ⌘Z 뒤) · saved(프로젝트 파일 canvas → DOMParser ↔ 지금) · rebind(innerHTML + rebindAll ↔ 다시 쓰기 전).
 * 양성: 같은 세 길에 종 요소의 dataset · 자식 노드를 망가뜨려 그 요소를 짚은 빨강이 나는지 잰다. 짚지 못한 빨강은 inject:red 가 아니다(공짜 빨강).
 * 조작 결과 가르기: 안전 거절 = DOM 변화 0 ∧ (선택 유지 또는 토스트) · 손실 = 변화 있고 블럭·자식 수 줄어듦. */
const { structCmp } = require('./_struct-cmp.js');
const FR = '.frame-block:not([data-text-frame])';
const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const serial = (page) => page.evaluate(() => window.getSerializedCanvas());
/* 프로젝트 파일에 실리는 현재 페이지 canvas */
const fileCanvas = (page) => page.evaluate(() => { const d = JSON.parse(window.serializeProject()); const p = d.pages.find((x) => x.id === d.currentPageId) || d.pages[0]; return p.canvas; });
/* 바이트 안에서 그 요소를 찾아 망가뜨린다. 닿았는지 돌려준다(안 닿으면 안 잰 것) */
const mangleBytes = (page, bytes, id, mode) => page.evaluate(([bytes, id, mode]) => {
  const doc = new DOMParser().parseFromString('<div id="__r">' + bytes + '</div>', 'text/html'); const e = doc.getElementById(id); if (!e) return { touched: false, bytes };
  if (mode === 'dataset') { const k = Object.keys(e.dataset)[0]; if (k) e.dataset[k] = 'T904INJECT'; else e.dataset.t904 = 'T904INJECT'; }
  else { const c = [...e.childNodes].filter((n) => n.nodeType !== 3 || n.textContent.trim()); if (c.length) c[c.length - 1].remove(); else e.appendChild(doc.createElement('i')); }
  return { touched: true, bytes: doc.getElementById('__r').innerHTML }; }, [bytes, id, mode]);
/* 살아 있는 나무에서 망가뜨린다(⌘Z 길) */
const mangleLive = (page, id, mode) => page.evaluate(([id, mode]) => { const e = document.getElementById(id); if (!e) return false;
  if (mode === 'dataset') { const k = Object.keys(e.dataset)[0]; if (k) e.dataset[k] = 'T904INJECT'; else e.dataset.t904 = 'T904INJECT'; }
  else { /* 그리기 도구 손잡이처럼 직렬화에 안 실리는 자식이 있어 끝 하나로는 안 닿는다(도형 값) ⇒ 전부 걷는다 */ if (e.childNodes.length) e.replaceChildren(); else e.appendChild(document.createElement('i')); }
  return true; }, [id, mode]);
/* draggable 은 내용이 아니라 묶을 때 세우는 칸이다(자유 프레임 자식 넣은 직후 false · 다시 묶은 뒤 없음, 18종 값) ⇒ soft 로 따로 세고 빨강에서 뺀다 */
const SOFT = new Set(['attr:draggable']);
const cmp = async (page, a, b) => { const r = await structCmp(page, a, b); const hard = r.diffs.filter((d) => !SOFT.has(d.kind)); return { red: hard.length > 0, diffs: hard, soft: r.diffs.length - hard.length, styleOnly: r.styleOnly }; };
const parsedBack = (page, bytes) => page.evaluate((b) => new DOMParser().parseFromString('<div id="__r">' + b + '</div>', 'text/html').getElementById('__r').innerHTML, bytes);
/* 길 셋. base 는 조작 전 바이트 */
const judgeUndo = async (page, base) => cmp(page, base, await serial(page));
const judgeSaved = async (page, now, file) => cmp(page, now, await parsedBack(page, file ?? await fileCanvas(page)));
/* 그 바이트를 다시 쓰고 rebindAll — 나무를 바꾼다, 칸 끝에 둔다 */
const judgeRebind = async (page, bytes, want) => { await page.evaluate((b) => { const c = document.getElementById('canvas'); c.innerHTML = b; window.rebindAll({ preserveHistory: true }); }, bytes); await settle(page); return cmp(page, want, await serial(page)); };
/* 그 요소를 짚었나 — diff 경로·값에 id 나 주입 표시가 있어야 한다 */
const pointsAt = (v, id) => v.red && v.diffs.some((d) => (d.path || '').includes(id) || JSON.stringify([d.a, d.b]).includes('T904INJECT'));
/* 조작 앞뒤 가르기 — 블럭 수는 정본 명부 + 프레임으로 센다 */
const classify = async (page, { before, after, selBefore, selAfter, toast }) => {
  const count = (h) => page.evaluate((h) => { const d = new DOMParser().parseFromString('<div>' + h + '</div>', 'text/html'); return d.querySelectorAll(window.SECTION_BLOCK_TYPE_SEL + ', .frame-block').length; }, h);
  const r = await cmp(page, before, after);
  if (!r.red) return (selAfter.length && selAfter.join() === selBefore.join()) || toast ? 'safe-reject' : 'silent-noop';
  return (await count(after)) < (await count(before)) ? 'loss' : 'changed'; };
/* 레이어 줄을 진짜로 눌러 고른다 */
const pickRow = async (page, id) => { const L = await page.evaluate((id) => { const e = document.getElementById(id); if (!e?._layerItem) window.buildLayerPanel?.(); const it = e?._layerItem; if (!it) return null; it.scrollIntoView({ block: 'center' }); const q = it.getBoundingClientRect(); return q.width ? [q.left + q.width / 2, q.top + q.height / 2] : null; }, id); if (!L) return false; await page.mouse.click(L[0], L[1]); await settle(page); return page.evaluate((id) => { document.activeElement?.blur?.(); const e = document.getElementById(id); return !!(e && (e.classList.contains('selected') || e.closest('.selected') || e.querySelector('.selected'))); }, id); };
const selected = (page) => page.evaluate(() => [...document.querySelectorAll('#canvas .selected')].map((e) => e.id).sort());
const undoUntil = async (page, base) => { let v; for (let i = 0; i < 3; i++) { await page.keyboard.press('Meta+z'); await settle(page); v = await judgeUndo(page, base); if (!v.red) break; } return v; };
/* 칸 하나: ⌘D → 가르기 → ⌘Z → 기준과 비교 → ⌫ → 가르기 → ⌘Z → 기준과 비교 → 저장 길 */
async function smallRound(page, id, base) {
  const step = async (key) => { if (!(await pickRow(page, id))) return null; const selBefore = await selected(page); await page.keyboard.press(key); await settle(page); const after = await serial(page); const outcome = await classify(page, { before: base, after, selBefore, selAfter: await selected(page), toast: false }); await page.evaluate(() => window.deselectAll?.()); const undo = await undoUntil(page, base); return { outcome, undo: { red: undo.red, diffs: undo.diffs.slice(0, 3), soft: undo.soft } }; };
  const dup = await step('Meta+d'); if (!dup) return { measured: false, why: '못 고름(⌘D 앞)' };
  const del = await step('Backspace'); if (!del) return { measured: false, why: '못 고름(⌫ 앞)' };
  const now = await serial(page); const saved = await judgeSaved(page, now);
  return { measured: true, dup, del, saved: { red: saved.red, diffs: saved.diffs.slice(0, 3) } };
}
/* 자리를 짓고 그 안에 종을 입구로 넣는다 */
async function build(page, kind, place) {
  return page.evaluate(async ({ kind, place, FR }) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = [...c.querySelectorAll('.section-block')].pop();
    const add = (par, w, h) => { window.deselectAll(); window.selectSection(sec); window._activeFrame = par; const b = new Set(sec.querySelectorAll(FR)); window.addFrameBlock(); const f = [...sec.querySelectorAll(FR)].find((x) => !b.has(x)); window.updateFrameBlock(f.id, { width: w, height: h }); window._activeFrame = null; return f; };
    let host = null; if (place !== 'section') { host = add(null, 780, 900); if (place === 'deep2') host = add(host, 640, 600); if (place === 'stack') { /* 빈 프레임은 stack 으로 안 바뀐다(거절 경고) — 글자를 먼저 넣는다 */ window.deselectAll(); window.selectSection(sec); window._activeFrame = host; window.addTextBlock('body'); window._activeFrame = null; window.__convertFreeLayoutToStack(host); } }
    window.deselectAll(); window.selectSection(sec); window._activeFrame = host; const before = new Set(sec.querySelectorAll('.' + kind.cls)); let err = null;
    try { await window[kind.entry](); } catch (e) { err = String(e.message).slice(0, 120); }
    const el = [...sec.querySelectorAll('.' + kind.cls)].find((x) => !before.has(x)); window._activeFrame = null; window.deselectAll(); window.clearHistory?.(); if (!el) return { err: err || '넣어도 새 요소 없음' };
    if (!el.id) el.id = 'blk_' + Math.random().toString(36).slice(2, 9);
    return { id: el.id, inHost: host ? host.contains(el) : true, hostMode: host ? (host.dataset.freeLayout ? 'free' : 'stack') : null, hostDepth: (() => { let n = 0; for (let p = host; p; p = p.parentElement.closest(FR)) n++; return n; })() }; }, { kind, place, FR });
}
module.exports = { build, pickRow, selected, smallRound, FR, settle, serial, fileCanvas, mangleBytes, mangleLive, cmp, parsedBack, judgeUndo, judgeSaved, judgeRebind, pointsAt, classify };
