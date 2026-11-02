/* frame-matrix-294 — 깊이 × 관계 × 조작 표(t9-03 J294J · 현빈 「증손자, 증증손자, 증손자 형제 등등으로」「사용자가 이상하거나 예상과 다르게 움직이는 건 없겠지」).
 * 무작위가 아니라 칸을 빠짐없이 돈다. 판정 ⑴ 구조(_frame-judge-294 판정 재사용) ⑵ 사용자 눈(자리·겹침·선택·손 비율 — 애매하면 «이상함 후보»).
 * 찾은 것은 표에 적고 고치지 않는다 ⇒ 구조 빨강만 단언, 눈은 값으로 남긴다. 값: FUZZ_OUT/matrix.json · matrix.md */
const { test, expect } = require('@playwright/test');
const fs = require('fs'); const path = require('path');
const { bootApp } = require('./_root-harness.js');
const { PAGE_LIB, EYE_LIB, canon, live, settle, select, judge, eyeDiff, ownPoint, dragRatio, reopen } = require('./_frame-judge-294.js');

const OUT = process.env.FUZZ_OUT || path.join(__dirname, '..', '..', 'test-results', 'frame-matrix-294');
const SHOTS = process.env.SHOTS || '';
const DEPTHS = [3, 4, 6, 8, 12];
const TARGETS = ['self', 'sibling', 'uncle', 'cousin', 'pair'];
const OPS = ['dup', 'cv', 'xv', 'move', 'del', 'zz', 'reopen'];
const NAME = { self: '그 자리', sibling: '그 형제', uncle: '부모의 형제', cousin: '사촌', pair: '다른 계층 둘', dup: '⌘D', cv: '⌘C⌘V', xv: '⌘X⌘V', move: '이동', del: '삭제', zz: '⌘Z·⌘⇧Z', reopen: '저장 후 다시 열기' };
const SHOT_CELLS = new Set(['3|self|dup', '6|sibling|cv', '6|pair|xv', '8|uncle|move', '12|self|dup']);
const STEP = 520;   // 곁가지 프레임 높이(앱이 정한 값) — 겹마다 이만큼 자리를 둔다

/* 곁가지 있는 나무: L0 > L1 > … · 겹마다 형제 S · S 안에 사촌 C · 맨 아래에 글자 하나 */
async function build(page, D) {
  await page.evaluate(() => window.deselectAll?.());
  const ids = await page.evaluate(async ([D, STEP]) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = [...c.querySelectorAll('.section-block')].pop(); window.__sec = sec.id; window.__secEl = () => document.getElementById(window.__sec);
    const FR = '.frame-block:not([data-text-frame])';
    const add = (par, w, h, l, t) => { window.deselectAll(); window.selectSection(sec); window._activeFrame = par ? document.getElementById(par) : null; const b = new Set(sec.querySelectorAll(FR)); window.addFrameBlock(); const f = [...sec.querySelectorAll(FR)].find((x) => !b.has(x)); window.updateFrameBlock(f.id, { width: w, height: h }); f.style.height = h + 'px'; f.dataset.height = h; if (par) { f.style.left = l + 'px'; f.style.top = t + 'px'; f.dataset.offsetX = l; f.dataset.offsetY = t; } return f.id; };
    const L = [], S = [], C = []; const W = 760;
    for (let i = 0; i < D; i++) { const par = i ? L[i - 1] : null; L.push(add(par, W - 40 * i, 220, 20, 20)); const sid = add(par, 160, 70, 20, 300); S.push(sid); C.push(add(sid, 60, 40, 10, 10)); }
    /* 곁가지는 앱이 520 높이로 둔다(값으로 확인, 낮춰도 안 낮아진다) ⇒ 아래에서 위로 쌓아 서로 안 덮게: 다음 겹 + 그 아래 곁가지 */
    const put = (id, top, h) => { const e = document.getElementById(id); if (top !== null) { e.style.top = top + 'px'; e.dataset.offsetY = top; } if (h) { e.style.height = h + 'px'; e.dataset.height = h; } };
    let h = 220; for (let i = D - 1; i >= 0; i--) { put(L[i], i ? 20 : null, h); if (i) { put(S[i], 20 + h + 10, null); } h = 20 + h + 10 + STEP + 20; }
    window.deselectAll(); window.selectSection(sec); window._activeFrame = document.getElementById(L[D - 1]); window.addTextBlock('body'); const t = sec.querySelector('#' + CSS.escape(L[D - 1]) + ' .text-block'); if (t) (t.querySelector('.tb-body') || t).textContent = 'T';
    window.deselectAll(); window._activeFrame = null; window.clearHistory?.(); return { L, S, C }; }, [D, STEP]);
  await reopen(page); await page.evaluate(() => { window.__secEl = () => document.getElementById(window.__sec); }); await settle(page);
  return ids;
}
const chainOf = (st, k) => { const c = []; for (let p = st.frames[k]?.parent; p; p = st.frames[p]?.parent) c.unshift(p); return c; };
const under = (st, root) => Object.keys(st.frames).filter((k) => { for (let p = k; p; p = st.frames[p]?.parent) if (p === root) return true; return false; });
async function pick(page, st, ids) {
  const first = await select(page, ids[0], chainOf(st, ids[0]).length, { chain: chainOf(st, ids[0]) });
  if (!first.sel) return { ok: false, why: `고르기 안 섬(${first.why || '?'})` };
  if (ids.length > 1) { await page.evaluate((id) => document.getElementById(id)?.scrollIntoView({ block: 'center' }), ids[1]); await settle(page); const q = await ownPoint(page, ids[1]); if (!q) return { ok: false, why: '둘째 집을 점 없음' }; await page.keyboard.down('Meta'); await page.mouse.click(q[0], q[1]); await page.keyboard.up('Meta'); await settle(page);
    const both = await page.evaluate((ids) => ids.map((i) => !!document.getElementById(i)?.classList.contains('selected')), ids); if (!both.every(Boolean)) return { ok: false, why: `둘째 ⌘클릭이 안 섬(${both})` }; }
  return { ok: true, via: first.via || null };
}
const pasteWait = async (page, n0) => { await page.keyboard.press('Meta+v'); await page.waitForFunction(([n0]) => document.querySelectorAll('#' + CSS.escape(window.__sec) + ' .frame-block:not([data-text-frame])').length > n0, [n0], { timeout: 3000 }).catch(() => {}); await settle(page); };
const expectedNew = (st, ids) => ids.reduce((a, i) => a + under(st, i).length, 0);
async function shot(page, cell, tag) { if (!SHOTS || !SHOT_CELLS.has(cell)) return; fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, `${cell.replace(/\|/g, '-')}-${tag}.png`) }); }

async function runCell(page, D, tgt, op) {
  const key = `${D}|${tgt}|${op}`; const rec = { D, tgt, op, measured: false, why: null, struct: [], odd: [], via: null, ratio: null };
  const { L, S, C } = await build(page, D); const st0 = await live(page);
  const last = D - 1; const ids = { self: [L[last]], sibling: [S[last]], uncle: [S[last - 1]], cousin: [C[last - 1]], pair: [L[last], S[Math.max(0, D - 3)]] }[tgt];
  const fail = (w) => { rec.why = w; return rec; };
  const p = await pick(page, st0, ids); if (!p.ok) return fail(p.why); rec.via = p.via;
  await page.evaluate(() => document.activeElement?.blur?.());
  const eye0 = await page.evaluate(() => window.__eyeSnap()); const nExpect = expectedNew(st0, ids); const n0 = Object.keys(st0.frames).length;
  await shot(page, key, 'before');
  const freshOf = (st, base) => Object.keys(st.frames).filter((k) => !base.frames[k]); const rootsOf = (st, base) => { const f = freshOf(st, base); return f.filter((k) => !f.includes(st.frames[k].parent)); };
  const checkKept = (st, base, skip = []) => { const out = []; for (const k of Object.keys(base.frames)) { if (skip.includes(k)) continue; if (!st.frames[k]) out.push(['c', `원본 ${k} 사라짐`]); else if (st.frames[k].parent !== base.frames[k].parent) out.push(['a', `원본 ${k} 부모 변함`]); } return out; };
  if (op === 'dup' || op === 'cv') {
    if (op === 'dup') await page.keyboard.press('Meta+d'); else { await page.keyboard.press('Meta+c'); await pasteWait(page, n0); } await settle(page);
    const st = await live(page); const roots = rootsOf(st, st0); rec.struct.push(...await judge(page, st, null, checkKept(st, st0))); if (freshOf(st, st0).length !== nExpect) rec.struct.push(['c', `새 ${freshOf(st, st0).length}/기대 ${nExpect}`]);
    rec.odd = eyeDiff(eye0, await page.evaluate(() => window.__eyeSnap()), ids, { copies: roots, expectSelected: roots });
  } else if (op === 'xv') {
    await page.keyboard.press('Meta+x'); await settle(page); const mid = await live(page); const goneOk = ids.every((i) => !mid.frames[i]); if (!goneOk) rec.struct.push(['c', '잘라도 남음']); const eyeMid = await page.evaluate(() => window.__eyeSnap()); const nm = Object.keys(mid.frames).length; await pasteWait(page, nm);
    const st = await live(page); const roots = rootsOf(st, mid); const skip = ids.flatMap((i) => under(st0, i)); rec.struct.push(...await judge(page, st, null, checkKept(st, st0, skip))); if (freshOf(st, mid).length !== nExpect) rec.struct.push(['c', `새 ${freshOf(st, mid).length}/기대 ${nExpect}`]);
    rec.odd = eyeDiff({ ...eye0, boxes: Object.fromEntries(Object.entries(eye0.boxes).filter(([k]) => !skip.includes(k))) }, await page.evaluate(() => window.__eyeSnap()), [], { copies: roots, expectSelected: roots }); void eyeMid;
  } else if (op === 'move') {
    const q = await ownPoint(page, ids[0]); if (!q) return fail('끌 점 없음(자식·형제가 다 덮음)');
    rec.ratio = await dragRatio(page, ids[0], q, 30, 20);
    const st = await live(page); rec.struct.push(...await judge(page, st, st0));
    rec.odd = eyeDiff(eye0, await page.evaluate(() => window.__eyeSnap()), ids, { moved: ids, expectSelected: ids });
    if (rec.ratio && (rec.ratio.x !== 1 || rec.ratio.y !== 1)) rec.odd.push(['손 비율', rec.ratio]);
  } else if (op === 'del') {
    await page.keyboard.press('Delete'); await settle(page); const st = await live(page); const skip = ids.flatMap((i) => under(st0, i)); rec.struct.push(...await judge(page, st, null, checkKept(st, st0, skip))); for (const k of skip) if (st.frames[k]) rec.struct.push(['c', `지운 ${k} 남음`]);
    rec.odd = eyeDiff({ ...eye0, boxes: Object.fromEntries(Object.entries(eye0.boxes).filter(([k]) => !skip.includes(k))) }, await page.evaluate(() => window.__eyeSnap()), [], { expectSelected: [] });
  } else if (op === 'zz') {
    await page.keyboard.press('Meta+d'); await settle(page); const after = await live(page); await page.evaluate(() => { window.deselectAll?.(); document.activeElement?.blur?.(); });
    await page.keyboard.press('Meta+z'); await settle(page); const z = await live(page); if (canon(z) !== canon(st0)) rec.struct.push(['e', '⌘Z ≠ 처음']);
    await page.keyboard.press('Meta+Shift+z'); await settle(page); const y = await live(page); if (canon(y) !== canon(after)) rec.struct.push(['e', '⌘⇧Z ≠ 복제 뒤']); rec.struct.push(...await judge(page, y, after));
    rec.odd = eyeDiff(eye0, await page.evaluate(() => window.__eyeSnap()), ids, {});
  } else if (op === 'reopen') {
    await page.keyboard.press('Meta+d'); await settle(page); const after = await live(page); const eye1 = await page.evaluate(() => window.__eyeSnap()); await reopen(page); await page.evaluate(() => { window.__secEl = () => document.getElementById(window.__sec); }); await settle(page);
    const st = await live(page); if (canon(st) !== canon(after)) rec.struct.push(['f', '다시 연 나무 ≠ 앞']); rec.struct.push(...await judge(page, st, after));
    rec.odd = eyeDiff({ ...eye1, selected: [] }, await page.evaluate(() => window.__eyeSnap()), [], {});
    rec.odd = rec.odd.filter((x) => x[0] !== '선택 어긋남');
  }
  await shot(page, key, 'after');
  rec.measured = true; return rec;
}

const results = [];
test.describe.configure({ mode: 'serial' });
test.skip(!process.env.MATRIX294, '시간이 오래 걸리는 표다(프레임 18분·컴포넌트 50분) — MATRIX294=1 일 때만 돈다');
for (const D of DEPTHS) {
  test(`깊이 ${D}: 대상 ${TARGETS.length} × 조작 ${OPS.length} 칸을 빠짐없이`, async ({ page }) => {
    test.setTimeout(600000);
    await page.setViewportSize({ width: 1500, height: 1100 }); const errs = await bootApp(page); await page.evaluate(PAGE_LIB); await page.evaluate(EYE_LIB);
    for (const tgt of TARGETS) for (const op of OPS) {
      let rec; try { rec = await runCell(page, D, tgt, op); } catch (e) { rec = { D, tgt, op, measured: false, why: '예외: ' + String(e.message).split('\n')[0].slice(0, 120), struct: [], odd: [] }; }
      results.push(rec);
      await page.keyboard.press('Escape'); await page.mouse.move(2, 2);
    }
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}
test('표를 코드로 세어 남긴다', async () => {
  expect(results.length, '칸 수 = 깊이 × 대상 × 조작').toBe(DEPTHS.length * TARGETS.length * OPS.length);
  fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, 'matrix.json'), JSON.stringify(results, null, 1));
  const measured = results.filter((r) => r.measured); const lines = [`칸 ${results.length} · 잰 ${measured.length} · 못 잰 ${results.length - measured.length} · 구조 빨강 칸 ${results.filter((r) => r.struct.length).length} · 이상함 후보 칸 ${results.filter((r) => r.odd.length).length}`, '', '| 깊이 | 대상 | 조작 | 잼 | 못 잰 까닭 | 구조 | 이상함 후보 |', '|---|---|---|---|---|---|---|'];
  for (const r of results) lines.push(`| ${r.D} | ${NAME[r.tgt]} | ${NAME[r.op]} | ${r.measured ? '○' : '×'} | ${r.why || ''} | ${r.struct.map((x) => x.join(':')).join(' / ')} | ${[...new Set(r.odd.map((x) => x[0] + (x[0] === '손 비율' ? ` ${JSON.stringify(x[1])}` : '')))].join(' / ')} |`);
  fs.writeFileSync(path.join(OUT, 'matrix.md'), lines.join('\n') + '\n'); console.log('MATRIX ' + lines[0]);
});
