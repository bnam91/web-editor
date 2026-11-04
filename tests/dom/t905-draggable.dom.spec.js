/* t905-draggable — 칸 표 findings draggable-after-roundtrip. 자유 프레임 안 18종: 왕복 전후 같은 끌기가 같은가. 값: T905_OUT/draggable.json. 찾은 것은 단언하지 않는다. */
const { test, expect } = require('@playwright/test');
const fs = require('fs'); const path = require('path');
const { bootApp } = require('./_root-harness.js');
const { dragBothWays } = require('./_t905-ops.js');
const FILE = JSON.parse(fs.readFileSync(path.join(__dirname, 't904-cells.json'), 'utf8'));
const OUT = process.env.T905_OUT || path.join(__dirname, '..', '..', 'test-results', 't905');
const f = FILE.findings.find((x) => x.id === 'draggable-after-roundtrip');
test('왕복 전후 끌기', async ({ page }) => {
  test.setTimeout(420000); await page.setViewportSize({ width: 1500, height: 1400 }); await bootApp(page); page.on('dialog', (d) => d.dismiss().catch(() => {})); const rows = [];
  for (const cls of f.kinds) { const kind = FILE.kinds.find((k) => k.cls === cls); let r; try { r = await dragBothWays(page, kind); } catch (e) { r = { measured: false, kind: cls, why: String(e.message).slice(0, 160) }; } rows.push(r); }
  fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, 'draggable.json'), JSON.stringify(rows, null, 1)); expect(rows.length).toBe(f.kinds.length);
});
