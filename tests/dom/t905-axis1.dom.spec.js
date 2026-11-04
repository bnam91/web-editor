/* t905-axis1 — t9-05 축 1 칸 런. 칸 표 t904-cells.json 의 t9-05 도는 칸을 조작·종 묶음으로 돈다. 값: T905_OUT/<조작>-<종>.json
 * 고른다: T905_OP=dup,pick T905_KIND=joker-block. 찾은 것은 단언하지 않는다, 칸이 끝까지 돌았는지(measured 또는 까닭)만 본다. */
const { test, expect } = require('@playwright/test');
const fs = require('fs'); const path = require('path');
const { bootApp } = require('./_root-harness.js');
const { OPS } = require('./_t905-ops.js');
const FILE = JSON.parse(fs.readFileSync(path.join(__dirname, 't904-cells.json'), 'utf8'));
const OUT = process.env.T905_OUT || path.join(__dirname, '..', '..', 'test-results', 't905');
const want = (v) => (v ? v.split(',') : null); const wantOp = want(process.env.T905_OP); const wantKind = want(process.env.T905_KIND);
const run = FILE.cells.filter((c) => c.run && c.ticket === 't9-05' && (!wantOp || wantOp.includes(c.op)) && (!wantKind || wantKind.includes(c.kind)));
const groups = new Map(); for (const c of run) { const k = `${c.op}|${c.kind}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(c); }
for (const [k, cells] of groups) test(`t905 ${k}`, async ({ page }) => {
  test.setTimeout(180000); await page.setViewportSize({ width: 1500, height: 1400 }); const errs = await bootApp(page); page.on('dialog', (d) => d.dismiss().catch(() => {}));
  const kind = FILE.kinds.find((x) => x.cls === cells[0].kind); const rows = [];
  for (const c of cells) { errs.length = 0; let r; try { r = await OPS[c.op](page, kind, c.place, c.route); } catch (e) { r = { measured: false, why: '하네스: ' + String(e.message).slice(0, 200) }; } /* electronAPI 대역이 만든 오류는 앱 결함이 아니다 */ const real = errs.filter((x) => !/electronAPI/.test(String(x))); if (real.length) { r.red = r.red || []; r.red.push({ check: '콘솔 오류', detail: real.slice(0, 2).map((x) => String(x).slice(0, 200)) }); }
    rows.push({ kind: c.kind, place: c.place, op: c.op, route: c.route, ...r }); }
  fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, `${cells[0].op}-${cells[0].kind}.json`), JSON.stringify(rows, null, 1));
  expect(rows.length).toBe(cells.length);
});
