/* fx-particles-coin-recipe — 섹션 파티클의 «코인 레시피» 단추 (1012t1 I1-B · 프로토 3c3a25bb 를 정식으로).
 *
 * ★무엇을 잠그나
 *   Q1 단추 — 파티클을 켠 섹션 패널에 「코인 레시피」(id·data·title) · 프리셋 칩과 같은 꼴(class·높이·글자·테두리) · 프리셋 칩 명부는 그대로 넷
 *   Q2 누르면 — 코인 «그림»이 갯수만큼 · 금 하나 · 모양 칩에 「코인」 · ★⒟ 무늬번호는 그대로(누르기 전 번호를 먼저 찍는다)
 *   Q3 ⌘Z 한 걸음 — 레시피 한 번 = 히스토리 한 칸 · 되돌리면 그 전 설정
 *   Q4 저장 → 다시 열기 — 같은 그림이 다시 난다
 *   Q5 ★⒠ 알려진 미비 ac725710 「저장본을 열면 루프가 안 선다」 — 레시피가 악화시키나: 레시피(+속도) 저장본과 별 반짝이(+속도) 저장본을
 *      다시 연 뒤 «루프가 서 있나»(ParticlesAnim.start() 가 false = 이미 돌고 있었다)와 2초 창의 rAF 호출 수를 «나란히» 적는다. ⛔고치지 않는다 · 수만.
 * ⛔고정 대기 없음 — 2초 창은 「requestAnimationFrame 을 센다」는 측정 자체다(page.waitForFunction 안의 시계).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { expectOneUndoStep } = require('./_history-step.js');

const SEC_HTML = (id) => `<div class="section-block" id="${id}" data-section="1" style="background:#0A0A0C">`
  + '<div class="section-hitzone"></div><div class="section-inner" style="padding-left:40px;padding-right:40px">'
  + '<div class="gap-block" data-type="gap" style="height:300px"></div></div></div>';

async function openPanel(page, id = 'pS') {
  await page.evaluate((id) => {
    window.deselectAll?.();
    const s = document.getElementById(id); s.classList.add('selected');
    return window.showSectionProperties(s);
  }, id);
  await page.waitForSelector('#sec-fxpart-toggle');
}
async function setup(page) {
  const errs = await bootApp(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate((html) => { document.getElementById('canvas').innerHTML = html; window.rebindAll?.(); window.deselectAll?.(); }, SEC_HTML('pS'));
  await openPanel(page);
  await page.click('#sec-fxpart-toggle');
  await page.waitForSelector('#sec-fxpart-recipe');
  return errs;
}
const state = (page, id = 'pS') => page.evaluate((id) => {
  const sec = document.getElementById(id);
  const svg = sec.querySelector(':scope > .' + window.FX_PARTICLES_WRAP + ' svg');
  return { cfg: window.readParticles(sec.dataset),
    coins: svg ? svg.querySelectorAll('ellipse[fill$="f)"]').length : 0,
    circles: svg ? svg.querySelectorAll('circle').length : -1,
    layer: svg ? svg.outerHTML : '' };
}, id);

test('Q1 단추 — 자리·속성·꼴이 프리셋 칩과 같고, 프리셋 명부는 그대로 넷이다', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(() => {
    const b = document.getElementById('sec-fxpart-recipe'), chip = document.querySelector('#sec-fxpart-presets [data-fxpart-preset="gold"]');
    const sig = (e) => { const s = getComputedStyle(e); return [e.className.replace(/\s*\bactive\b/, ''), Math.round(e.getBoundingClientRect().height), s.fontSize, s.fontWeight, s.borderTopWidth, s.borderTopStyle, s.borderRadius, s.backgroundColor, s.color, s.borderTopColor].join(' | '); };
    return { attrs: [b.dataset.fxpartRecipe, b.title, b.textContent.trim(), b.hasAttribute('data-fxpart-preset')],
      sig: sig(b), chipSig: sig(chip), presets: [...document.querySelectorAll('#sec-fxpart-presets [data-fxpart-preset]')].map((e) => e.dataset.fxpartPreset),
      afterPresets: !!(document.getElementById('sec-fxpart-presets').compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING),
      beforeReroll: !!(b.compareDocumentPosition(document.getElementById('sec-fxpart-reroll')) & Node.DOCUMENT_POSITION_FOLLOWING),
      fit: b.scrollWidth <= b.clientWidth + 1 };
  });
  expect(r.attrs).toEqual(['coin', '코인 레시피 — 모양·갯수·크기·색을 3D 코인 묶음으로 바꿉니다(무늬번호는 그대로)', '코인 레시피', false]);
  expect([r.afterPresets, r.beforeReroll, r.fit], '프리셋 칩 아래 · 다시 뿌리기 위 · 글자가 단추 안').toEqual([true, true, true]);
  await page.hover('#sec-fxpart-seed');
  const again = await page.evaluate(() => { const g = (e) => { const s = getComputedStyle(e); return [e.className.replace(/\s*\bactive\b/, ''), Math.round(e.getBoundingClientRect().height), s.fontSize, s.fontWeight, s.borderTopWidth, s.borderTopStyle, s.borderRadius, s.backgroundColor, s.color, s.borderTopColor].join(' | '); };
    return [g(document.getElementById('sec-fxpart-recipe')), g(document.querySelector('#sec-fxpart-presets [data-fxpart-preset="gold"]'))]; });
  expect(again[0], '레시피 단추의 꼴이 (안 고른) 프리셋 칩과 다르다').toBe(again[1]);
  expect(r.presets, '프리셋 명부는 그대로 넷 — 코인은 프리셋이 아니다').toEqual(['star', 'gold', 'party', 'dust']);
  expect(errs).toEqual([]);
});

test('Q2 누르면 코인 그림 · 금 하나 · ★무늬번호는 그대로', async ({ page }) => {
  const errs = await setup(page);
  const before = await state(page);
  const seedField = await page.inputValue('#sec-fxpart-seed');
  expect([before.cfg.preset, before.coins, String(before.cfg.seed)], '★전제: 누르기 전 — 별 반짝이 · 코인 0 · 칸의 무늬번호 = 저장값').toEqual(['star', 0, seedField]);
  await page.click('#sec-fxpart-recipe');
  await expect.poll(async () => (await state(page)).coins, '코인이 안 그려졌다').toBe(14);
  const s = await state(page);
  expect([s.cfg.shapes, s.cfg.count, s.cfg.colors, s.circles], '모양 coin · 14 닢 · 금 하나 · 원 없음').toEqual([['coin'], 14, ['#f5c542'], 0]);
  expect(s.cfg.seed, '레시피를 눌렀더니 무늬번호가 바뀌었다').toBe(before.cfg.seed);
  await page.waitForSelector('#sec-fxpart-seed');
  expect(await page.inputValue('#sec-fxpart-seed'), '패널의 무늬번호 칸도 그대로').toBe(seedField);
  expect(await page.evaluate(() => [...document.querySelectorAll('#sec-fxpart-shapes .active')].map((b) => b.dataset.fxpartShape))).toEqual(['coin']);
  /* 두 번 눌러도 번호 그대로 · 그림도 같다(같은 시드 = 같은 그림) */
  await page.click('#sec-fxpart-recipe');
  await expect.poll(async () => (await state(page)).cfg.seed).toBe(before.cfg.seed);
  expect((await state(page)).layer).toBe(s.layer);
  expect(errs).toEqual([]);
});

test('Q3 ⌘Z 한 걸음 — 레시피 한 번 = 한 칸 · 되돌리면 그 전 설정', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => window.pushHistory?.('준비'));
  const before = await state(page);
  const h = await expectOneUndoStep(page, async () => {
    await page.click('#sec-fxpart-recipe');
    await expect.poll(async () => (await state(page)).coins).toBe(14);
  }, '코인 레시피', { soft: true });
  expect([h.changed, h.dPos >= 1 && h.seqNew, h.undoDLen, h.undoDPos], 'A0 바뀜 · A1 끝 표본 · A2 구제 없이 한 칸').toEqual([true, true, 0, -1]);
  const undone = await state(page);
  expect([undone.cfg, undone.coins], '⌘Z 한 번에 그 전 설정·그림으로').toEqual([before.cfg, 0]);
});

test('Q4 저장 → 다시 열기 — 같은 그림이 다시 난다', async ({ page }) => {
  const errs = await setup(page);
  await page.click('#sec-fxpart-recipe');
  await expect.poll(async () => (await state(page)).coins).toBe(14);
  const a = await state(page);
  const snap = await page.evaluate(() => window.serializeProject());
  await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(JSON.parse(d)), snap);
  await expect.poll(async () => (await state(page)).coins, '다시 열었는데 코인이 안 그려졌다').toBe(14);
  const b = await state(page);
  expect([b.cfg, b.layer === a.layer], '저장값 · 층 글자가 같다').toEqual([a.cfg, true]);
  expect(errs).toEqual([]);
});

/* ⒠ — 다시 연 뒤 루프가 서 있나 · 2초 창의 rAF 호출 수. 레시피 판과 별 반짝이 판을 같은 길로 잰다(⛔고치지 않는다). */
async function loopAfterReopen(page, useRecipe) {
  await setup(page);
  if (useRecipe) { await page.click('#sec-fxpart-recipe'); await expect.poll(async () => (await state(page)).coins).toBe(14); }
  await page.fill('[data-fxpart-axis="speed"]', '60');
  await page.dispatchEvent('[data-fxpart-axis="speed"]', 'input');
  await page.dispatchEvent('[data-fxpart-axis="speed"]', 'change');
  await expect.poll(async () => (await state(page)).cfg.speed).toBe(60);
  const snap = await page.evaluate(() => window.serializeProject());
  await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(JSON.parse(d)), snap);
  await expect.poll(async () => (await state(page)).cfg?.speed, '★전제: 다시 열었고 속도 60 이 실렸다').toBe(60);
  const n = await page.evaluate(() => new Promise((res) => {
    let calls = 0; const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => { calls++; return raf(cb); };
    const t0 = performance.now();
    const tick = () => { if (performance.now() - t0 >= 2000) { window.requestAnimationFrame = raf; res(calls); } else setTimeout(tick, 100); };
    tick();
  }));
  const startedNow = await page.evaluate(() => window.ParticlesAnim.start());   // true = 그때까지 안 돌고 있었다
  const layers = await page.evaluate(() => window.ParticlesAnim.scan(document).length);
  return { rafIn2s: n, wasStopped: startedNow, layers };
}
test('Q5 ★⒠ 알려진 미비(ac725710) — 레시피가 «다시 연 뒤 루프가 안 선다»를 악화시키나 (수만)', async ({ page }) => {
  test.setTimeout(120000);
  const star = await loopAfterReopen(page, false);
  const coin = await loopAfterReopen(page, true);
  test.info().annotations.push({ type: 'measured', description: `별 반짝이: ${JSON.stringify(star)} · 코인 레시피: ${JSON.stringify(coin)}` });
  console.log(`[Q5] 별 반짝이 ${JSON.stringify(star)} · 코인 레시피 ${JSON.stringify(coin)}`);
  expect([star.layers, coin.layers], '★전제: 두 판 다 돌릴 층이 하나 있다').toEqual([1, 1]);
  /* 악화 판정 — 레시피 판이 별 반짝이 판보다 «더 안 도는» 쪽이면 빨강(같으면 그 미비는 레시피와 무관하다) */
  expect(coin.wasStopped && !star.wasStopped, `레시피 판만 루프가 안 섰다 — 악화다`).toBe(false);
});
