/* t5-12-circle-text-multiline.dom.spec.js — t5-12 원형 이미지 «안 글자» 여러 줄 (ⓐ · ⓑ 블럭 추가는 판정 청함)
 * 원문: 「t5-12 - 원형이미지에 글자는 어떻게 추가 삽입하는지? 현재는 우측패널에서만 한줄만 가능한데 블럭추가가 필요함」
 * 아이맥(ca702d40 ×3): 패널 「글자」 한 줄 칸(grd-img-ctext) · 캔버스 더블클릭 편집은 되나 Enter·⇧Enter = 편집 끝(줄 안 늘어남).
 * 칸
 *   P0  전제 — 원 안 글자가 그려지고 더블클릭으로 글자 편집에 들어간다
 *   E   캔버스: 끝에서 Enter → 「둘째」 → ⌘Enter ⇒ 모델 text = 「원글자\n둘째」 · 화면 두 줄(글자 top 둘)
 *   P   패널 「글자」 칸이 여러 줄(textarea) · 두 줄 값을 보이고 · 패널에서 친 줄바꿈도 모델에 산다
 * 양성대조: GD1001_ROOT=<핀 e8e5bad7 사본> ⇒ E·P 빨강 · P0 초록.
 * ⛔고정 대기 없음 — waitForFunction 만. ⛔앱 무접촉(_root-harness.bootApp). */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const log = (tag, o) => console.log(`T514 ${tag} ${JSON.stringify(o)}`);
const poll = async (page, fn, arg, timeout = 4000) => { try { await page.waitForFunction(fn, arg, { timeout, polling: 100 }); return true; } catch { return false; } };

async function setup(page, line) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate((line) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="gS" data-section="1"><div class="section-hitzone"></div><div class="section-inner">
      <div class="gap-block" data-type="gap" style="height:60px"></div><div class="row" id="gR" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:400px"></div></div></div>`);
    const { block: g } = window.makeGridBlock({
      cols: [{ width: 1, lines: [line] }, { width: 1, lines: [{ type: 'body', text: 'B' }] }],
      rows: [{ height: 'auto' }],
    });
    g.id = 'gG'; document.getElementById('gR').appendChild(g); window.rebindAll?.(); window.renderGridBlock(g); window.deselectAll?.();
  }, line);
  expect(await poll(page, () => !!document.querySelector('#gG .grd-img-frame .grd-img-circle-text')), '[전제] 원 안 글자가 그려졌다').toBe(true);
  await waitStableRect(page, '#gG .grd-img-frame');
  return errs;
}
const CIRC = (extra = {}) => Object.assign({ type: 'image', imgSrc: '', imgShape: 'circle', height: 160, text: '원글자' }, extra);

const lineText = (page) => page.evaluate(() => {
  const g = document.getElementById('gG');
  const m = window.getGridModel ? window.getGridModel(g) : null;
  const ln = m ? m.cols[0].lines[0] : null;
  return { model: ln ? (ln.text === undefined ? null : ln.text) : '∅', shown: document.querySelector('#gG .grd-img-circle-text')?.textContent ?? null };
});
async function textPoint(page) {
  const p = await page.evaluate(() => {
    const t = document.querySelector('#gG .grd-img-circle-text'); const r = t.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const e = document.elementFromPoint(x, y);
    return { x, y, onText: !!(e && e.closest('.grd-img-circle-text')), hit: e ? e.className : null };
  });
  expect(p.onText, `[전제] 누른 점 = 원 안 글자 (${p.hit})`).toBe(true);
  return p;
}
async function enterTextEdit(page) {
  const p = await textPoint(page);
  let chooser = false; const onCh = () => { chooser = true; };
  page.on('filechooser', onCh);
  await page.mouse.dblclick(p.x, p.y);
  const ok = await poll(page, () => { const t = document.querySelector('#gG .grd-img-circle-text'); return !!t && t.getAttribute('contenteditable') === 'true' && document.activeElement === t; }, null, 3000);
  page.off('filechooser', onCh);
  const proxy = await page.evaluate(() => !!document.querySelector('.grd-img-edit-proxy'));
  return { ok, chooser, proxy };
}

const shownLines = (page) => page.evaluate(() => { const t = document.querySelector('#gG .grd-img-circle-text'); if (!t) return 0; const rg = document.createRange(); rg.selectNodeContents(t); return new Set([...rg.getClientRects()].map(r => Math.round(r.top))).size; });

test('P0 전제 — 원 안 글자 · 더블클릭 편집 진입', async ({ page }) => {
  const errs = await setup(page, CIRC());
  const r = await enterTextEdit(page);
  expect(r.ok).toBe(true);
  expect(errs).toEqual([]);
});

test('E 캔버스 Enter = 줄바꿈 · ⌘Enter 확정 ⇒ 모델·화면 두 줄', async ({ page }) => {
  const errs = await setup(page, CIRC());
  const r = await enterTextEdit(page);
  expect(r.ok).toBe(true);
  await page.keyboard.press('Meta+ArrowRight');
  await page.keyboard.press('Enter');
  await page.keyboard.type('둘째');
  await page.keyboard.press('Meta+Enter');
  await page.waitForFunction(() => document.querySelector('#gG .grd-img-circle-text')?.getAttribute('contenteditable') !== 'true');
  const t = await lineText(page);
  expect(t.model).toBe('원글자\n둘째');
  expect(await shownLines(page)).toBe(2);
  expect(errs).toEqual([]);
});

test('P 패널 「글자」 칸 = 여러 줄 · 두 줄 값 · 패널 줄바꿈도 산다', async ({ page }) => {
  const errs = await setup(page, CIRC({ text: '하나\n둘' }));
  const r = await enterTextEdit(page);
  expect(r.ok).toBe(true);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !!document.getElementById('grd-img-ctext'));
  const f = await page.evaluate(() => { const e = document.getElementById('grd-img-ctext'); return { tag: e.tagName, value: e.value }; });
  expect(f).toEqual({ tag: 'TEXTAREA', value: '하나\n둘' });
  await page.locator('#grd-img-ctext').fill('가\n나\n다');
  await page.evaluate(() => document.getElementById('grd-img-ctext').dispatchEvent(new Event('change', { bubbles: true })));
  await page.waitForFunction(() => (document.querySelector('#gG .grd-img-circle-text')?.textContent || '') === '가\n나\n다');
  expect((await lineText(page)).model).toBe('가\n나\n다');
  expect(errs).toEqual([]);
});
