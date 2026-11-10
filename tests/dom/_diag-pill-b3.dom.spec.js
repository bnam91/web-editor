/* _diag-pill-b3 — ⚠️진단용(임시 · 지디 인텔 1회 · 끝나면 지운다): PILL-RADIUS 가지에서만 grid-badge-radius B3 이 «모델에 안 들어갔다(null)».
 * B3 순서를 그대로 밟으며 찍는다: showGridProperties 호출 수·스택 · 둥글기 칸 노드가 갈렸나 · change 직후/150ms 뒤 모델 radius.
 * 판정은 하지 않는다(expect 없음) — console 의 DIAG 줄을 돌려 달라. */
const { test } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

test('DIAG B3 순서 그대로 찍기', async ({ page }) => {
  await bootApp(page);
  await page.evaluate(() => {
    window.__diag = []; const orig = window.showGridProperties;
    window.showGridProperties = function (...a) { window.__diag.push('SHOW ' + JSON.stringify(a[1] || null) + ' ' + (new Error().stack || '').split('\n').slice(2, 6).map(s => s.trim()).join(' | ')); return orig.apply(this, a); };
    document.getElementById('canvas').innerHTML =
      `<div class="section-block" id="s" data-section="1"><div class="section-hitzone"><span class="section-label">S</span></div><div class="section-inner" id="in" style="padding-left:60px;padding-right:60px"></div></div>`;
    const { row, block } = window.makeGridBlock({});
    document.getElementById('in').appendChild(row); block.id = 'G';
    const m = window.getGridModel(block); m.cols[0].lines = [{ type: 'body', text: '알약', bg: '#2d6fe8' }];
    block.dataset.cols = JSON.stringify(m.cols); window.renderGridBlock(block);
    window.showGridProperties(block, { r: 0, c: 0, li: 0 });
  });
  await page.waitForTimeout(120);
  const out = await page.evaluate(async () => {
    const D = window.__diag; const b = document.getElementById('G');
    const rad = () => (window.getGridModel(b).cols[0].lines[0] || {}).radius ?? null;
    const el = document.getElementById('grd-badge-radius'); el.__diagTag = 1;
    el.addEventListener('input', (e) => D.push('INPUT on radius trusted=' + e.isTrusted + ' val=' + el.value), true);
    document.addEventListener('change', (e) => D.push('CHANGE seen target=' + (e.target.id || e.target.tagName)), true);
    D.push('before radius=' + rad() + ' showCount=' + D.filter(x => x.startsWith('SHOW')).length);
    el.value = '20'; el.dispatchEvent(new Event('change', { bubbles: true }));
    D.push('afterChange sync radius=' + rad() + ' sameNode=' + (document.getElementById('grd-badge-radius') === el));
    await new Promise(r => setTimeout(r, 150));
    const el2 = document.getElementById('grd-badge-radius');
    D.push('after150 radius=' + rad() + ' nodeTagged=' + !!(el2 && el2.__diagTag) + ' val=' + (el2 && el2.value) + ' showCount=' + D.filter(x => x.startsWith('SHOW')).length);
    return D;
  });
  for (const l of out) console.log('DIAG', l);
});
