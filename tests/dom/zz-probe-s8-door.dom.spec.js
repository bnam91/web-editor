/* zz-probe-s8-door — 측정 전용(단언 0 · 머지 전 지운다). panel-frame-states S8 양성대조가 «문(expandPanelSection)을 껐는데도 Effects 가 열린» 둘째 문을 찾는다.
 * S8 과 같은 손: 에셋 Effects 절을 틀로 그리고 wireFxSection(다시 그리기 = 같은 그리기) → 접기 → 문 끄기 → 효과 하나 고름.
 * 찍는 것: ⑴ 패널 본문 innerHTML 쓰기마다 스택 앞 6줄 + 그 순간 Effects 몸이 hidden 으로 나오는가 ⑵ localStorage gd-panel-collapsed 쓰기마다 값·스택 ⑶ 끈 문이 불렸나.
 * 출력 = [S8-DOOR] 한 줄(JSON). */
const { test } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { addKind } = require('./_block-roster-294.js');

test('S8-DOOR 측정', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  await bootApp(page);
  await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block'); window.__secEl = () => sec; });
  const r = await addKind(page, { cls: 'asset-block', entry: 'addAssetBlock' });
  await page.evaluate(async (id) => {
    const { renderPanel, sec } = await import('/js/props/_panel-frame.js');
    const ab = document.getElementById(id);
    const draw = () => { const p = window.fxSectionParts(ab, 'asset');
      renderPanel(ab, { sections: [sec('size', '<div class="prop-row"><input type="number" id="__sz"></div>'), sec('effects', p.body, { headTools: p.headTools, id: p.id })] });
      window.wireFxSection(ab, 'asset', draw); };
    draw();
  }, r.id);
  const body = page.locator('#asset-fx-section-body');
  if (await body.isVisible()) await page.locator('#asset-fx-section-head').click();
  await page.evaluate(() => {
    const st = (n) => (new Error().stack || '').split('\n').slice(2, 2 + n).map((s) => s.trim());
    window.__door = { renders: [], store: [], stubCalls: 0 };
    window.expandPanelSection = () => { window.__door.stubCalls++; };
    const P = document.querySelector('#panel-right .panel-body');
    const d = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    for (const host of new Set([P, document.getElementById('panel-right')].filter(Boolean))) {
      Object.defineProperty(host, 'innerHTML', { configurable: true, get() { return d.get.call(this); },
        set(v) { window.__door.renders.push({ host: this.id || this.className, fxHidden: /id="asset-fx-section-body"[^>]*hidden/.test(String(v)), stack: st(6) }); d.set.call(this, v); } });
    }
    const si = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { if (k === 'gd-panel-collapsed') window.__door.store.push({ v, stack: st(6) }); return si.call(this, k, v); };
  });
  const opt = await page.evaluate(() => [...document.querySelectorAll('#asset-fx-add option')].map((o) => o.value).find(Boolean));
  await page.selectOption('#asset-fx-add', opt);
  await page.waitForFunction(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => res(true)))));
  const out = await page.evaluate(() => ({ ...window.__door, nowHidden: document.getElementById('asset-fx-section-body')?.hidden ?? null,
    ls: localStorage.getItem('gd-panel-collapsed') }));
  console.log('[S8-DOOR] ' + JSON.stringify(out));
});
