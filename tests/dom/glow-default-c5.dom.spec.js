/* glow-default-c5 — 글로우 스티커 «별 반짝이» 기본 후광이 무채색 #e0e0e0 (1013t2C5).
 *   G1 새로 만든 별 반짝이 — 메뉴 「Glow」 실클릭 → data-glow-color · feFlood · 패널 표시가 E0E0E0, 무채색(r=g=b)
 *   G2 ★옛 보라 저장본(data-glow-color="#b06cff")을 다시 그리면(=로드 경로 renderStickerBlock) 보라 그대로 — 기본값에 기대지 않는다
 *   G3 글로우를 낳는 길(makeStickerBlock 색 없이 · 종류 star→flare→star · ⌘D)에서 data-glow-color 가 «비지 않는다»
 *   G4 다른 종류 무접촉 — flare #ff9a3c · dot #ffffff
 * 음성대조(GO 뒤): PRESETS.star 를 #b06cff 로 되돌리면 G1·G3 빨강 · glow-render 의 glowColor 를 undefined 로 넘기면 G2 빨강 · sticker-block.js:511 줄을 지우면 G3 빨강.
 * ★상태: 써만 두었다 — 안 돌림(GO 대기). 유닛 칸 tests/unit/glow-render-default.test.mjs 가 정본 값을 따로 잰다. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const NEW = '#e0e0e0';
async function section(page) {
  await page.evaluate(() => {
    document.getElementById('canvas').innerHTML = '<div class="section-block" id="secG" style="position:relative;height:320px;background:#101018"><div class="section-inner"></div></div>';
    window.rebindAll?.();
  });
}
/* 스티커 버튼 → 메뉴 항목(글자로 찾음)을 «실제 마우스»로 누른다(sticker-arrow-c4 clickPenMenu 와 같은 꼴). */
async function clickPenMenu(page, label) {
  const btn = await page.evaluate(() => { const r = document.getElementById('fp-pen-btn').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.click(btn.x, btn.y);
  await page.waitForFunction((label) => [...document.querySelectorAll('#fp-pen-menu .fp-menu-item')].some(e => e.textContent.trim() === label && e.getBoundingClientRect().width > 0), label, { timeout: 3000 });
  const it = await page.evaluate((label) => {
    const items = [...document.querySelectorAll('#fp-pen-menu .fp-menu-item')].filter(e => e.textContent.trim() === label && e.getBoundingClientRect().width > 0);
    const r = items[0].getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    return { n: items.length, x, y, hit: document.elementFromPoint(x, y) === items[0] };
  }, label);
  expect(it.n, `★전제: 보이는 «${label}» 메뉴 항목이 하나다`).toBe(1);
  expect(it.hit, '★전제: 누르는 점이 그 메뉴 항목 위다').toBe(true);
  await page.mouse.click(it.x, it.y);
}
const gray = (hex) => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); return r === g && g === b; };

test('G1 새 별 반짝이 — 메뉴 Glow 클릭 → 후광 #e0e0e0 (무채색) · feFlood · 패널', async ({ page }) => {
  await bootApp(page);
  await section(page);
  /* ★실클릭 길(제목과 같게) — 섹션을 고른 뒤 #fp-pen-btn → 메뉴 「Glow」를 진짜 마우스로 누른다(⛔addStickerBlock 직접 호출) */
  expect(await page.evaluate(() => { window.deselectAll?.(); window.selectSection?.(document.getElementById('secG')); return window.getSelectedSection?.()?.id; }), '★전제: 섹션을 골랐다').toBe('secG');
  await clickPenMenu(page, 'Glow');
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('#secG .sticker-block[data-fx-kind="star"]').length)).toBe(1);
  const r = await page.evaluate(() => {
    const b = document.querySelector('#secG .sticker-block[data-fx-kind="star"]');
    window.showStickerProperties?.(b);
    return { color: b.dataset.glowColor, flood: [...b.querySelectorAll('feFlood')].map(f => f.getAttribute('flood-color')),
      hex: document.getElementById('stk-glow-color-hex')?.value };
  });
  expect(r.color).toBe(NEW);
  expect(gray(r.color), '무채색').toBe(true);
  expect(r.flood.length, 'feFlood 가 있다(재는 값이 실제로 있다)').toBeGreaterThan(0);
  expect(r.flood.some(c => c.toLowerCase() === NEW)).toBe(true);
  expect(r.hex.toLowerCase().replace('#', '')).toBe('e0e0e0');
});

test('G2 ★옛 보라 저장본 — 다시 그려도(로드 경로) 보라 그대로', async ({ page }) => {
  await bootApp(page);
  await section(page);
  const r = await page.evaluate(() => {
    const b = window.makeStickerBlock({ shape: 'glow', fxKind: 'star', glowColor: '#b06cff', seed: 7 });
    document.getElementById('secG').appendChild(b);
    // 저장본 흉내 — 직렬화된 HTML 로 되살린 블럭을 다시 그린다(save-load.js 복원 = renderStickerBlock 만 호출)
    const html = b.outerHTML;
    document.getElementById('secG').innerHTML = '<div class="section-inner"></div>' + html;
    const c = document.querySelector('#secG .sticker-block');
    c.querySelectorAll('svg').forEach(s => s.remove());
    window.renderStickerBlock(c);
    window.showStickerProperties?.(c);
    return { color: c.dataset.glowColor, flood: [...c.querySelectorAll('feFlood')].map(f => f.getAttribute('flood-color').toLowerCase()),
      hex: (document.getElementById('stk-glow-color-hex')?.value || '').toLowerCase().replace('#', '') };
  });
  expect(r.color).toBe('#b06cff');
  expect(r.flood.length).toBeGreaterThan(0);
  expect(r.flood).toContain('#b06cff');
  expect(r.hex).toBe('b06cff');
});

test('G3 입구 전수 — 색 없이 만들기 · 종류 바꾸기 · ⌘D 모두 data-glow-color 를 명시한다', async ({ page }) => {
  await bootApp(page);
  await section(page);
  const r = await page.evaluate(() => {
    const sec = document.getElementById('secG');
    const out = {};
    const b = window.makeStickerBlock({ shape: 'glow' });            // 색 없이
    sec.appendChild(b);
    out.made = b.dataset.glowColor;
    const btn = (k) => document.querySelector(`#stk-glow-kind [data-fx-kind="${k}"]`);
    window.bindStickerSelect?.(b);
    window.showStickerProperties?.(b);
    btn('flare').click(); out.flare = b.dataset.glowColor;
    btn('star').click();  out.back = b.dataset.glowColor;
    return out;
  });
  expect(r.made).toBe(NEW);
  expect(r.flare).toBe('#ff9a3c');
  expect(r.back).toBe(NEW);
  // ⌘D — 복제본도 색을 가진다
  const id = await page.evaluate(() => document.querySelector('#secG .sticker-block').id);
  await page.evaluate((id) => document.getElementById(id).click(), id);
  await page.keyboard.press('Meta+d');
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('#secG .sticker-block').length)).toBe(2);
  const colors = await page.evaluate(() => [...document.querySelectorAll('#secG .sticker-block')].map(b => b.dataset.glowColor));
  for (const c of colors) expect(c, '복제본도 색이 비지 않는다').toMatch(/^#[0-9a-f]{3,8}$/i);
});

test('G4 다른 종류 무접촉 — flare #ff9a3c · dot #ffffff', async ({ page }) => {
  await bootApp(page);
  const r = await page.evaluate(() => ({ flare: window.GlowFx.PRESETS.flare.glowColor, dot: window.GlowFx.PRESETS.dot.glowColor }));
  expect(r).toEqual({ flare: '#ff9a3c', dot: '#ffffff' });
});
