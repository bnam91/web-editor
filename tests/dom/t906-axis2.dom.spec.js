/* t906-axis2 — t9-06 축 2 칸 런. 칸 표의 t9-06 도는 칸. 값: T906_OUT/<조작>-<종>.json. 고른다: T906_OP · T906_KIND. 찾은 것은 단언하지 않는다. */
const { test, expect } = require('@playwright/test');
const fs = require('fs'); const path = require('path');
const { bootApp } = require('./_root-harness.js');
const { OPS, frameEffects } = require('./_t906-ops.js');
const FILE = JSON.parse(fs.readFileSync(path.join(__dirname, 't904-cells.json'), 'utf8'));
const OUT = process.env.T906_OUT || path.join(__dirname, '..', '..', 'test-results', 't906');
const want = (v) => (v ? v.split(',') : null); const wantOp = want(process.env.T906_OP); const wantKind = want(process.env.T906_KIND);
const run = FILE.cells.filter((c) => c.run && c.ticket === 't9-06' && (!wantOp || wantOp.includes(c.op)) && (!wantKind || wantKind.includes(c.kind)));
const groups = new Map(); for (const c of run) { const k = `${c.op}|${c.kind}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(c); }
for (const [k, cells] of groups) test(`t906 ${k}`, async ({ page }) => {
  test.setTimeout(180000); await page.setViewportSize({ width: 1500, height: 1400 }); const errs = await bootApp(page); const silent = (d) => d.dismiss().catch(() => {}); page.on('dialog', silent);
  const kind = FILE.kinds.find((x) => x.cls === cells[0].kind); const rows = [];
  for (const c of cells) { errs.length = 0; let r; try { r = await OPS[c.op](page, kind, c.place, c.route); } catch (e) { r = { measured: false, why: '하네스: ' + String(e.message).slice(0, 200) }; } const real = errs.filter((x) => !/electronAPI/.test(String(x))); if (real.length) { r.red = r.red || []; r.red.push({ check: '콘솔 오류', detail: real.slice(0, 2).map((x) => String(x).slice(0, 200)) }); } rows.push({ kind: c.kind, place: c.place, op: c.op, route: c.route, ...r }); }
  fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, `${cells[0].op}-${cells[0].kind}.json`), JSON.stringify(rows, null, 1));
  expect(rows.length).toBe(cells.length);
});
if (!wantKind && (!wantOp || wantOp.includes('effects'))) test('t906 효과 — 프레임 자신', async ({ page }) => { await page.setViewportSize({ width: 1500, height: 1400 }); await bootApp(page); const v = await frameEffects(page); fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, 'frame-effects.json'), JSON.stringify(v)); expect(v.reg.length).toBeGreaterThan(0); });
