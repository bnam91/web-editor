/* asset-noise-fx — 0.9.13 그레인 → Effects «Noise»(현빈 261123 · 시안 v11.7 시안A 1e0c5c2 · 미카사 Figma 실측) · 태양
 *   자리만 옮김: 옛 에셋 Appearance «그레인» 줄 → Effects ＋ 메뉴 «Noise»(그림자 다음 · 그림 든 에셋만) · 카드 = 눈 · ✕ · 세기 막대+숫자 · 저장 .asset-grain 그대로
 * N1 그림 든 에셋 — ＋ 목록에 noise 가 shadow 바로 다음 · 옛 «그레인» 줄 없음 · Noise 고르면 카드 «Noise» 세기 30 · 덧층 세기 30 · opacity 0.3
 * N2 눈 끔 = 덧층 세기 0 · data-grain-off 30 · opacity 0(값 보존) → 켬 = 30 · ✕ = 덧층 걷음
 * N3 옛 저장본(덧층 세기 35) — 패널을 열면 Noise 카드가 세기 35 로 보임
 * N4 [지킴] 빈 에셋(그림 없음) — ＋ 목록에 noise 없음
 * 양성대조: _patches/noise-CTL.patch(index.html 의 effects-noise.js 적재 한 줄 걷음) ⇒ N1·N3 빨강.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFWEXHbQSACj/P8Fu7N9hAAAAAElFTkSuQmCC';

async function scene(page, { image = true, grain = null } = {}) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate(async ({ image, grain, PNG }) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); window.deselectAll(); window.selectSection(sec);
    const before = new Set(sec.querySelectorAll('.asset-block')); window.addAssetBlock('standard');
    const ab = [...sec.querySelectorAll('.asset-block')].find((x) => !before.has(x)); ab.id = 'abN';
    if (image) window.setAssetImageFromSrc(ab, PNG);
    if (grain != null) { const g = document.createElement('div'); g.className = 'asset-grain'; g.dataset.grainIntensity = String(grain); g.style.opacity = String(grain / 100); ab.appendChild(g); }   // 옛 패널이 만들던 꼴 그대로
  }, { image, grain, PNG });
  if (image) await page.waitForFunction(() => document.getElementById('abN').classList.contains('has-image'), null, { polling: 100, timeout: 5000 });
  await page.evaluate(() => { window.selectBlock?.('abN'); window.showAssetProperties(document.getElementById('abN')); });
  return errs;
}
const opts = (page) => page.evaluate(() => [...(document.getElementById('asset-fx-add')?.options || [])].map((o) => o.value).filter(Boolean));
const layer = (page) => page.evaluate(() => { const g = document.querySelector('#abN > .asset-grain'); return g ? { v: g.dataset.grainIntensity ?? null, off: g.dataset.grainOff ?? null, op: g.style.opacity } : null; });

test('N1 그림 든 에셋 — 그림자 다음 Noise · 옛 줄 없음 · 카드 세기 30', async ({ page }) => {
  const errs = await scene(page);
  const o = await opts(page);
  const oldRow = await page.evaluate(() => !!document.getElementById('asset-grain-slider'));
  await page.selectOption('#asset-fx-add', 'noise');
  await page.waitForFunction(() => !!document.getElementById('asset-fxns-card'), null, { polling: 100, timeout: 5000 });
  const card = await page.evaluate(() => ({ title: document.querySelector('#asset-fxns-card .prop-cell-card-title')?.textContent.trim(), n: document.getElementById('asset-fxns-num')?.value, label: document.querySelector('#asset-fxns-body .prop-label')?.textContent }));
  const l = await layer(page);
  console.log('[N1 실측]', JSON.stringify({ o, oldRow, card, l }));
  if (process.env.SHOT_NOISE) await page.locator('#asset-fx-section').screenshot({ path: `${process.env.SHOT_NOISE}/noise-card.png` });
  expect(o.indexOf('noise'), '★Noise = 그림자 바로 다음').toBe(o.indexOf('shadow') + 1);
  expect(oldRow, '★옛 Appearance «그레인» 줄 없음').toBe(false);
  expect(card, '★카드 Noise · 세기 30').toEqual({ title: 'Noise', n: '30', label: '세기' });
  expect(l, '★저장 덧층 그대로(.asset-grain · 세기 · opacity)').toEqual({ v: '30', off: null, op: '0.3' });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('N2 눈 끔 = 값 보존 · 켬 = 되돌림 · ✕ = 걷음', async ({ page }) => {
  const errs = await scene(page);
  await page.selectOption('#asset-fx-add', 'noise');
  await page.waitForFunction(() => !!document.getElementById('asset-fxns-eye'), null, { polling: 100, timeout: 5000 });
  await page.click('#asset-fxns-eye'); const off = await layer(page);
  await page.click('#asset-fxns-eye'); const on = await layer(page);
  await page.click('#asset-fxns-del'); const gone = await layer(page);
  console.log('[N2 실측]', JSON.stringify({ off, on, gone }));
  expect([off, on, gone], '★끔 = 0·off 30·투명 · 켬 = 30 · ✕ = 덧층 없음').toEqual([{ v: '0', off: '30', op: '0' }, { v: '30', off: null, op: '0.3' }, null]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('N3 옛 저장본(덧층 세기 35) → Noise 카드 35', async ({ page }) => {
  const errs = await scene(page, { grain: 35 });
  const r = await page.evaluate(() => ({ card: !!document.getElementById('asset-fxns-card'), n: document.getElementById('asset-fxns-num')?.value ?? null }));
  expect(r, '★옛 그레인 = Noise 카드로 보임').toEqual({ card: true, n: '35' });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('N4 [지킴] 빈 에셋 — Noise 없음', async ({ page }) => {
  const errs = await scene(page, { image: false });
  expect((await opts(page)).includes('noise'), '★그림 없는 에셋엔 Noise 안 뜸').toBe(false);
  expect(errs, errs.join(' | ')).toEqual([]);
});
