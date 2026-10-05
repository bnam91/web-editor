/* e128-copy-text-frame.dom.spec.js — E128: 흐름 글자 블럭을 ⌘C⌘V·⌘D 하면 사본이 «글자 프레임»을 잃던 것(폭·회전·바깥 패딩 소실)
 *
 * 머리표(지디 규율): [새 것] d1f642ff 에서 빨강 · [회귀 지킴] d1f642ff 에서도 초록 · [전제] 재기 위한 조건.
 * 실측(BUNDLE-C/e128.json, 9ef09f76 실앱): 원본 글자 프레임 폭 400 · 회전 15° · 바깥 패딩 24 → 사본 둘 다 맨 text-block · 716 · 없음 · 없음.
 * 고침 = editor.js copySelected 단일 갈래가 흐름 글자 프레임 «직속» 글자 블럭이면 프레임째 담는다.
 * 장면: T▾ Heading 과 같은 함수(addTextBlock)로 만든 글자 프레임에 세 값을 «프레임이 쥐는 키»로 심는다
 *   (폭 = prop-text-wireup-position · 회전 = asset-rotate host · 바깥 패딩 = block-factory opts — 정의 자리 그대로의 키·스타일).
 * 고르기 = clickAt(맞힌 요소 단언) · ⌘C/⌘V/⌘D = 진짜 키. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

async function scene(page, { bare = false } = {}) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  const id = await page.evaluate((bare) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="sC" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div><div class="row" id="rG" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:300px"></div></div></div>');
    const { block: g } = window.makeGridBlock({ cols: [{ width: 1, lines: [{ type: 'body', text: '칸 A' }] }, { width: 1, lines: [{ type: 'body', text: '칸 B' }] }] });
    g.id = 'gC'; document.getElementById('rG').appendChild(g); window.rebindAll?.(); window.renderGridBlock(g);
    const sec = document.getElementById('sC'); window.deselectAll?.(); window.selectSection?.(sec);
    if (bare) {   // 옛 사본 꼴 — 섹션 직속 맨 text-block
      const { block } = window.makeTextBlock('h2'); block.id = 'tbBare'; sec.querySelector('.section-inner').appendChild(block); window.bindBlock?.(block);
      window.deselectAll?.(); window.applyZoom?.(100); return block.id;
    }
    const before = new Set([...document.querySelectorAll('.text-block')].map(t => t.id));
    window.addTextBlock('h2');
    const tb = [...document.querySelectorAll('.text-block')].find(t => !before.has(t.id));
    const tf = tb.parentElement;
    tf.style.width = '400px'; tf.style.maxWidth = '100%'; tf.dataset.width = '400';
    tf.dataset.rotation = '15'; tf.style.transform = 'rotate(15deg)'; tf.style.transformOrigin = 'center center';
    tf.dataset.paddingX = '24'; tf.style.paddingLeft = '24px'; tf.style.paddingRight = '24px';
    window.deselectAll?.(); window.applyZoom?.(100); window.clearHistory?.();
    return tb.id;
  }, bare);
  await page.waitForTimeout(300);
  return { errs, id };
}
const shape = (page, id) => page.evaluate((id) => {
  const t = document.getElementById(id); if (!t) return null; const tf = t.parentElement.matches('.frame-block[data-text-frame="true"]') ? t.parentElement : null;
  return { inFrame: !!tf, width: tf ? tf.dataset.width ?? null : null, rot: tf ? tf.dataset.rotation ?? null : null, padX: tf ? tf.dataset.paddingX ?? null : null };
}, id);
const textIds = (page) => page.evaluate(() => [...document.querySelectorAll('#canvas .text-block')].map(t => t.id));
async function pick(page, id) {
  const p = await page.evaluate((id) => { const i = document.getElementById(id).querySelector('[class^="tb-"]'); i.scrollIntoView({ block: 'center' }); const r = i.getBoundingClientRect(); return [r.left + Math.min(30, r.width / 3), r.top + r.height / 2]; }, id);
  await clickAt(page, p[0], p[1], { sel: '.text-block' }, { label: '글자 고르기' });
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).classList.contains('selected'), id), { message: '[전제] 골라졌다' }).toBe(true);
}
async function newCopy(page, before) { await page.waitForTimeout(400); const now = await textIds(page); return now.filter(i => !before.includes(i)); }

for (const how of ['⌘C⌘V', '⌘D']) {
  test(`T1 [새 것] ${how} — 사본이 글자 프레임째(폭 400 · 회전 15 · 바깥 패딩 24 유지)`, async ({ page }) => {
    const { errs, id } = await scene(page);
    expect(await shape(page, id), '[전제] 원본 = 글자 프레임 + 세 값').toEqual({ inFrame: true, width: '400', rot: '15', padX: '24' });
    await pick(page, id);
    const before = await textIds(page);
    if (how === '⌘C⌘V') { await page.keyboard.press('Meta+c'); await page.keyboard.press('Meta+v'); } else await page.keyboard.press('Meta+d');
    const n = await newCopy(page, before);
    expect(n.length, `[전제] 사본 하나 ${JSON.stringify(n)}`).toBe(1);
    expect(await shape(page, n[0]), `★${how} 사본`).toEqual({ inFrame: true, width: '400', rot: '15', padX: '24' });
    expect(errs).toEqual([]);
  });
}

test('G1 [회귀 지킴] 사본(⌘D)을 그리드 칸에 끌면 칸의 한 줄이 된다(G9 그대로)', async ({ page }) => {
  const { errs, id } = await scene(page);
  await pick(page, id);
  const before = await textIds(page);
  await page.keyboard.press('Meta+d');
  const [cp] = await newCopy(page, before);
  expect(cp, '[전제] 사본').toBeTruthy();
  await page.evaluate(() => window.deselectAll?.());
  const n0 = await page.evaluate(() => document.querySelectorAll('#gC .grd-cell[data-r="0"][data-c="0"] [data-line]').length);
  const s = await page.evaluate((cp) => { const i = document.getElementById(cp).querySelector('[class^="tb-"]'); i.scrollIntoView({ block: 'center' }); const r = i.getBoundingClientRect(); return [r.left + 20, r.top + r.height / 2]; }, cp);
  await clickAt(page, s[0], s[1], { sel: '.text-block' }, { label: '사본 고르기' }); await page.waitForTimeout(200);
  const t = await page.evaluate(() => { const c = document.querySelector('#gC .grd-cell[data-r="0"][data-c="0"]'); const r = c.getBoundingClientRect(); return [r.left + r.width / 2, r.bottom - 4]; });
  await page.mouse.move(s[0], s[1]); await page.mouse.down(); await page.mouse.move(s[0] + 10, s[1] + 10, { steps: 3 }); await page.mouse.move(t[0], t[1], { steps: 12 }); await page.mouse.up(); await page.waitForTimeout(500);
  expect(await page.evaluate(() => document.querySelectorAll('#gC .grd-cell[data-r="0"][data-c="0"] [data-line]').length), '사본이 칸에 들어갔다').toBe(n0 + 1);
  expect(errs).toEqual([]);
});

test('G2 [회귀 지킴] 맨 text-block(옛 사본 꼴)을 ⌘C⌘V 하면 사본도 맨 그대로', async ({ page }) => {
  const { errs, id } = await scene(page, { bare: true });
  expect(await shape(page, id), '[전제] 원본 = 맨 블럭').toEqual({ inFrame: false, width: null, rot: null, padX: null });
  await pick(page, id);
  const before = await textIds(page);
  await page.keyboard.press('Meta+c'); await page.keyboard.press('Meta+v');
  const n = await newCopy(page, before);
  expect(n.length).toBe(1);
  expect((await shape(page, n[0])).inFrame, '맨 블럭 복사 = 맨 그대로').toBe(false);
  expect(errs).toEqual([]);
});
