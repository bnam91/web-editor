/* block-matrix-294 — 컴포넌트 × 자리 × 넣는 길 표(t9-03 J294K · 현빈 「스티커 끌기 말고 다른 거 넣어볼 수도 있지 않니, 컴포넌트」).
 * 스티커가 손 30px 에 화면 59px 움직인 것이 스티커만의 일인지 잰다. 조작: 끌기 30·100px(배율 100%·40%) · 클릭 고르기 · ⌘D · ⌘Z · 저장 후 다시 열기 뒤 같은 끌기.
 * 찾은 것은 고치지 않는다 ⇒ 칸 수·구조만 단언. 값: FUZZ_OUT/blocks.json · blocks.md */
const { test, expect } = require('@playwright/test');
const fs = require('fs'); const path = require('path');
const { bootApp } = require('./_root-harness.js');
const { PAGE_LIB, EYE_LIB, live, settle, select, judge, reopen, ownPoint } = require('./_frame-judge-294.js');
const { rosterOf, addKind } = require('./_block-roster-294.js');

const OUT = process.env.FUZZ_OUT || path.join(__dirname, '..', '..', 'test-results', 'block-matrix-294');
const PLACES = ['section', 'free', 'stack', 'deep3'];
const NAME = { section: '섹션 직속', free: '자유 프레임 안', stack: '스택 프레임 안', deep3: '깊이 3 프레임 안', entry: '앱 입구', dragin: '끌어 넣기', ungroup: '그룹 풀린 뒤' };
/* 대표+위험 묶음: 흐름 글자·그림, 제 바인더(스티커·그라데이션), 떠 있는 것, 도형, 표·그리드, 캔버스 */
const RISK = ['text-block', 'asset-block', 'sticker-block', 'gradient-block', 'chat-block', 'laurel-block', 'joker-block', 'shape-block', 'grid-block', 'canvas-block'];
const RISK_ROUTES = [['dragin', 'free'], ['dragin', 'deep3'], ['ungroup', 'free'], ['ungroup', 'deep3']];
const TOL = 0.15;

async function scene(page, place) {
  const ids = await page.evaluate(async (place) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = [...c.querySelectorAll('.section-block')].pop(); window.__sec = sec.id; window.__secEl = () => document.getElementById(window.__sec); const FR = '.frame-block:not([data-text-frame])';
    const add = (par, w, h) => { window.deselectAll(); window.selectSection(sec); window._activeFrame = par ? document.getElementById(par) : null; const b = new Set(sec.querySelectorAll(FR)); window.addFrameBlock(); const f = [...sec.querySelectorAll(FR)].find((x) => !b.has(x)); window.updateFrameBlock(f.id, { width: w, height: h }); if (par) { f.style.left = '20px'; f.style.top = '20px'; f.dataset.offsetX = 20; f.dataset.offsetY = 20; } return f.id; };
    const out = { host: null, chain: [], other: null };
    if (place !== 'section') { const P = add(null, 780, 900); out.host = P; out.chain = [];
      if (place === 'deep3') { const A = add(P, 700, 800); const B = add(A, 640, 700); out.host = B; out.chain = [P, A]; }
      if (place === 'stack') { const e = document.getElementById(P); delete e.dataset.freeLayout; delete e.dataset.height; e.dataset.fullWidth = 'true'; e.style.height = ''; e.style.minHeight = ''; } /* prop-frame.js 스택 전환과 같은 칸 */ }
    out.other = add(null, 780, 300);
    window.deselectAll(); window._activeFrame = null; window.clearHistory?.(); return out; }, place);
  await settle(page); return ids;
}
/* 배율을 바꾼 뒤 행렬이 멎을 때까지(전환·맞춤 흔들림 · 값으로 73↔81 을 봤다). z = 퍼센트 — applyZoom 은 퍼센트를 받는다(1 을 넘기면 10% 로 갇힌다 · 앞 판 값을 버린 까닭) */
const setZoom = async (page, z) => { await page.evaluate((z) => window.applyZoom(z), z); await page.waitForFunction((z) => { const t = document.getElementById('canvas-scaler')?.style.transform || ''; const same = t === window.__zk; window.__zk = t; return same && t.includes('scale(' + z / 100 + ')'); }, z, { polling: 100, timeout: 5000 }).catch(() => {}); await settle(page); };
const STEPS = 12;
const rectOf = (page, id) => page.evaluate((id) => { const r = document.getElementById(id)?.getBoundingClientRect(); return r ? [r.left, r.top] : null; }, id);
const pickHost = async (page, ids) => { if (!ids.host) return { sel: true }; return select(page, ids.host, ids.chain.length, { chain: ids.chain }); };
const blockPoint = (page, id) => page.evaluate((id) => { const o = document.getElementById(id); if (!o) return null; o.scrollIntoView({ block: 'center' }); const r = o.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, id);
const clickPick = async (page, id, ids) => { await page.keyboard.press('Escape'); await page.evaluate(() => { window.deselectAll?.(); window._activeFrame = null; }); const h = await pickHost(page, ids); if (!h.sel) return { ok: false, why: '그릇 프레임 안 골라짐' }; const q = await blockPoint(page, id); if (!q) return { ok: false, why: '요소 없음' }; await settle(page); const q2 = await blockPoint(page, id); await page.mouse.click(q2[0], q2[1]); await settle(page); return { ok: await page.evaluate((id) => { const o = document.getElementById(id); return !!(o?.classList.contains('selected') || o?.querySelector('.selected') || o?.closest('.selected')?.id === id); }, id), self: await page.evaluate((id) => !!document.getElementById(id)?.classList.contains('selected'), id), hit: await page.evaluate(() => [...document.querySelectorAll('#canvas .selected')].map((e) => (e.className || '').split(' ')[0]).join(',')) }; };
async function dragOnce(page, id, ids, hand, zoom) {
  await setZoom(page, zoom);
  const pk = await clickPick(page, id, ids); if (!(await blockPoint(page, id))) return { why: '요소 없음' }; await settle(page); const q2 = await blockPoint(page, id); await settle(page);
  const hostOf = () => (ids.host ? page.evaluate((h) => { const e = document.getElementById(h); return e ? [e.style.left, e.style.top, e.parentElement?.id] : null; }, ids.host) : null);
  const hostBefore = await hostOf(); const a = await rectOf(page, id); await page.evaluate(() => { window.__ds = []; if (!window.__dsOn) { window.__dsOn = true; addEventListener('dragstart', (e) => window.__ds.push(e.target.id || e.target.className), true); } });
  await page.mouse.move(q2[0], q2[1]); await page.mouse.down(); for (let i = 1; i <= STEPS; i++) { await page.mouse.move(q2[0] + hand * i / STEPS, q2[1] + hand * i / STEPS); await settle(page); } const mid = await rectOf(page, id); await page.mouse.up(); await settle(page);
  const b = await rectOf(page, id); const hostAfter = await hostOf(); const ds = await page.evaluate(() => window.__ds);
  return { ratio: a && b ? +((b[0] - a[0]) / hand).toFixed(2) : null, ratioY: a && b ? +((b[1] - a[1]) / hand).toFixed(2) : null, midRatio: a && mid ? +((mid[0] - a[0]) / hand).toFixed(2) : null, hostMoved: JSON.stringify(hostBefore) !== JSON.stringify(hostAfter) || (!!ids.host && ds.includes(ids.host)), ds, picked: pk.ok, self: pk.self, abs: await page.evaluate((id) => { const e = document.getElementById(id); return e ? getComputedStyle(e).position : null; }, id) };
}
async function dragIn(page, id, ids) { /* 섹션 직속으로 넣은 요소를 진짜 마우스로 그릇 위에 끌어 놓는다 */
  const q = await blockPoint(page, id); if (!q) return false; await page.mouse.click(q[0], q[1]); await settle(page); const q1 = await blockPoint(page, id); const t = await page.evaluate((h) => { const r = document.getElementById(h).getBoundingClientRect(); return [r.left + r.width / 2, Math.min(r.top + r.height / 2, innerHeight - 40)]; }, ids.host); await page.mouse.move(q1[0], q1[1]); await page.mouse.down(); await page.mouse.move(t[0], t[1], { steps: 15 }); await settle(page); await page.mouse.up(); await settle(page); return page.evaluate(([h, id]) => !!document.getElementById(h)?.contains(document.getElementById(id)), [ids.host, id]);
}
async function regroup(page, ids) { /* 그릇을 맨 위 다른 프레임과 ⌘G → ⌘⇧G */
  const top = ids.chain[0] || ids.host; const pick = async (id, mod) => { await page.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'center' }), id); await settle(page); const q = await ownPoint(page, id); if (!q) return; if (mod) await page.keyboard.down(mod); await page.mouse.click(q[0], q[1]); if (mod) await page.keyboard.up(mod); await settle(page); };
  await page.keyboard.press('Escape'); await page.evaluate(() => window.deselectAll()); await pick(top); await pick(ids.other, 'Meta'); await page.keyboard.press('Meta+g'); await settle(page); const g = await page.evaluate((t) => document.getElementById(t)?.parentElement?.dataset?.group === 'true', top); if (!g) return false; await page.keyboard.press('Meta+Shift+g'); await settle(page); return true;
}
async function runCell(page, kind, place, route) {
  const rec = { cls: kind.cls, place, route, measured: false, why: null, entry: kind.entry, struct: [], odd: [], drags: {} };
  if (!kind.entry) { rec.why = '입구 없음'; return rec; }
  const ids = await scene(page, place); await setZoom(page, 100);
  const add = await addKind(page, kind, route === 'dragin' ? null : ids.host); if (add.err) { rec.why = '입구 없음: ' + add.err; return rec; } const id = add.id; rec.inHost = add.inParent; rec.abs = add.abs; await page.keyboard.press('Escape');
  if (ids.host && !add.inParent && route === 'entry') rec.odd.push(['그릇 밖으로 들어감']);
  if (route === 'dragin') { const ok = await dragIn(page, id, ids); if (!ok) rec.odd.push(['끌어 넣기 안 들어감']); rec.draggedIn = ok; }
  if (route === 'ungroup' && !await regroup(page, ids)) { rec.why = '그룹 안 됨'; return rec; }
  const st0 = await live(page);
  for (const [z, hand] of [[100, 30], [100, 100], [40, 30], [40, 100]]) rec.drags[`${z}%·${hand}`] = await dragOnce(page, id, ids, hand, z);
  await setZoom(page, 100); const st1 = await live(page); rec.struct.push(...await judge(page, st1, null)); if (Object.keys(st1.frames).sort().join() !== Object.keys(st0.frames).sort().join()) rec.struct.push(['c', '끌기 뒤 프레임 집합 다름']); for (const k of Object.keys(st0.frames)) if (st1.frames[k] && st1.frames[k].parent !== st0.frames[k].parent) rec.odd.push(['끌어 다른 프레임으로 들어감', k]);   /* 끌어서 옮기는 것은 사용자 행동 — 부모가 바뀐 것은 구조 빨강이 아니라 값 */
  /* 고르기·⌘D·⌘Z */
  const pk = await clickPick(page, id, ids); rec.pick = pk; if (!pk.ok) rec.odd.push(['클릭 안 골라짐', pk.hit || '']); else {
    const n0 = await page.evaluate((c) => document.querySelectorAll('#canvas .' + c).length, kind.cls); const box0 = await page.evaluate((id) => { const o = document.getElementById(id); return o ? [o.offsetLeft, o.offsetTop, o.style.left, o.style.top] : null; }, id); const secH0 = await page.evaluate(() => window.__secEl().offsetHeight);
    await page.keyboard.press('Meta+d'); await settle(page); const copy = await page.evaluate(([c, n0]) => { const all = [...document.querySelectorAll('#canvas .' + c)]; return { n: all.length, grew: all.length - n0 }; }, [kind.cls, n0]); rec.dupNew = copy.grew; if (copy.grew !== 1) rec.odd.push(['⌘D 수', copy.grew]);
    const same = await page.evaluate(([c, id]) => { const o = document.getElementById(id); if (!o) return null; const others = [...document.querySelectorAll('#canvas .' + c)].filter((e) => e !== o && !e.contains(o) && !o.contains(e)); const r = o.getBoundingClientRect(); return others.some((e) => { const q = e.getBoundingClientRect(); return q.left === r.left && q.top === r.top && q.width === r.width && q.height === r.height; }); }, [kind.cls, id]); rec.dupOverlap = same; if (same) rec.odd.push(['⌘D 원본과 겹침']); void box0;
    const secH1 = await page.evaluate(() => window.__secEl().offsetHeight); rec.secH = [secH0, secH1];
    await page.evaluate(() => { window.deselectAll?.(); document.activeElement?.blur?.(); }); await page.keyboard.press('Meta+z'); await settle(page); const nz = await page.evaluate((c) => document.querySelectorAll('#canvas .' + c).length, kind.cls); rec.undoOk = nz === n0; if (nz !== n0) rec.odd.push(['⌘Z 수', nz, n0]);
  }
  /* 저장 후 다시 열기 뒤 같은 끌기 */
  await reopen(page); await page.evaluate(() => { window.__secEl = () => document.getElementById(window.__sec); window.__dsOn = false; }); await settle(page);
  if (await page.evaluate((id) => !!document.getElementById(id), id)) rec.drags['열고 100%·100'] = await dragOnce(page, id, ids, 100, 100); else rec.odd.push(['다시 열면 요소 없음']);
  for (const [k, d] of Object.entries(rec.drags)) { if (d.ratio === null || d.ratio === undefined) continue; if (d.hostMoved) rec.odd.push(['프레임을 잡음', k]); if (d.ds?.length) { d.reorder = true; continue; } if (Math.abs(d.ratio) <= TOL && Math.abs(d.ratioY) <= TOL) rec.odd.push(['끌어도 안 움직임', k]); else if (Math.abs(d.ratio - 1) > TOL && Math.abs(d.ratioY - 1) > TOL) rec.odd.push(['손 비율', k, d.ratio, d.ratioY]); else if (Math.abs(d.ratio - 1) > TOL || Math.abs(d.ratioY - 1) > TOL) rec.odd.push(['한 축만 따라옴', k, d.ratio, d.ratioY]); }
  rec.measured = true; return rec;
}
const results = []; let roster = [];
test.describe.configure({ mode: 'serial' });
test.skip(!process.env.MATRIX294, '시간이 오래 걸리는 표다(프레임 18분·컴포넌트 50분) — MATRIX294=1 일 때만 돈다');
test('분모를 세고 칸을 돈다', async ({ page }) => {
  test.setTimeout(3400000);
  await page.setViewportSize({ width: 1500, height: 1100 }); await bootApp(page); await page.evaluate(PAGE_LIB); await page.evaluate(EYE_LIB);
  roster = await rosterOf(page); expect(roster.length, '[전제] 분모').toBeGreaterThan(0);
  const ONLY = process.env.BLOCK_ONLY ? process.env.BLOCK_ONLY.split(',') : null; const kinds = ONLY ? roster.filter((k) => ONLY.includes(k.cls)) : roster;
  for (const kind of kinds) { const cells = PLACES.map((p) => [p, 'entry']); if (RISK.includes(kind.cls)) cells.push(...RISK_ROUTES.map(([r, p]) => [p, r]));
    for (const [place, route] of cells) { let rec; try { rec = await runCell(page, kind, place, route); } catch (e) { rec = { cls: kind.cls, place, route, measured: false, why: '예외: ' + String(e.message).split('\n')[0].slice(0, 100), struct: [], odd: [], drags: {} }; } results.push(rec); await page.mouse.up().catch(() => {}); await page.keyboard.press('Escape'); await page.mouse.move(2, 2); fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, 'blocks.json'), JSON.stringify({ roster, results }, null, 1)); } }
});
test('표를 코드로 세어 남긴다', async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const m = results.filter((r) => r.measured); const dropped = roster.filter((k) => !RISK.includes(k.cls)).length * RISK_ROUTES.length;
  const lines = [`분모 ${roster.length}종 · 입구 없음 종 ${roster.filter((k) => !k.entry).map((k) => k.cls).join(',') || '없음'} · 칸 ${results.length} · 잰 ${m.length} · 못 잰 ${results.length - m.length} · 구조 빨강 칸 ${results.filter((r) => r.struct.length).length} · 이상함 후보 칸 ${results.filter((r) => r.odd.length).length} · 뺀 칸(대표 밖 ×끌어 넣기·그룹) ${dropped}`, `대표+위험 ${RISK.join(' ')}`, '', '| 종 | 자리 | 길 | 잼 | 못 잰 까닭 | 100%·30 | 100%·100 | 40%·30 | 40%·100 | 열고 100 | 고르기 | ⌘D | ⌘Z | 후보 |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const r of results) { const d = (k) => { const x = r.drags?.[k]; return x ? (x.ds?.length ? '순서' : `${x.ratio ?? ''},${x.ratioY ?? ''}`) : ''; }; lines.push(`| ${r.cls} | ${NAME[r.place]} | ${NAME[r.route]} | ${r.measured ? '○' : '×'} | ${r.why || ''} | ${d('100%·30')} | ${d('100%·100')} | ${d('40%·30')} | ${d('40%·100')} | ${d('열고 100%·100')} | ${r.pick ? (r.pick.ok ? '○' : '×') : ''} | ${r.dupNew ?? ''}${r.dupOverlap ? ' 겹침' : ''} | ${r.undoOk === undefined ? '' : (r.undoOk ? '○' : '×')} | ${[...new Set((r.odd || []).map((x) => x[0]))].join(' / ')} |`); }
  fs.writeFileSync(path.join(OUT, 'blocks.md'), lines.join('\n') + '\n'); console.log('BLOCKS ' + lines[0]);
  expect(results.filter((r) => r.struct.length).map((r) => [r.cls, r.place, r.route, r.struct]), '구조 빨강').toEqual([]);
});
