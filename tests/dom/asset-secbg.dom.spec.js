/* asset-secbg.dom.spec.js — C2 (현빈 2026-10-01) 에셋 우클릭 「이 섹션 배경으로」(복사) + 섹션 배경 → 스크래치.
 * 앱 통째로 헤드리스(bootApp). ★양성대조 판 = 7699ea33 → 실측 명부는 커밋 메시지(빨강이어야 할 것: C2-1 C2-2 C2-3 C2-4).
 * ⚠️못 재는 것: 스크래치패드 IndexedDB 의 «재기동 뒤» 영속(이 하네스는 한 세션) — _scratchAddAndSave 에 «무엇을 넘기나»까지 잰다.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const SEC = `
<div class="section-block" id="sG" data-section="1" data-name="G" data-bg="rgba(255,255,255,0)" style="background-color:rgba(255,255,255,0);">
  <div class="section-hitzone"><span class="section-label">G</span></div>
  <div class="section-inner"><div class="gap-block" data-type="gap" id="gG" style="height:40px;"></div>
    <div class="row" id="rowA"><div class="asset-block has-image" id="abG" data-img-src="${PX}" style="height:200px;">
      <div class="asset-img-clip"><img class="asset-img" src="${PX}" style="width:100%;height:100%;object-fit:cover"></div></div></div>
  </div></div>`;

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await bootApp(page);
  await page.evaluate((html) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove()); c.insertAdjacentHTML('beforeend', html); window.rebindAll?.(); window.deselectAll?.(); }, SEC);
  await page.waitForTimeout(200);
}
async function rclickMenu(page, blockId, itemId) {
  const [x, y] = await page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, blockId);
  await page.mouse.click(x, y, { button: 'right' });
  const it = await page.evaluate((id) => { const el = document.getElementById(id); const r = el.getBoundingClientRect(); return { vis: getComputedStyle(el).display, xy: [r.left + 20, r.top + r.height / 2] }; }, itemId);
  return it;
}

test('C2-1 ★에셋 우클릭 「이 섹션 배경으로」 → 섹션 배경 정본(dataset.bgImg)과 화면이 그 그림 · 블럭은 남는다', async ({ page }) => {
  await setup(page);
  const it = await rclickMenu(page, 'abG', 'bcm-asset-to-secbg');
  expect(it.vis).toBe('flex');
  await page.mouse.click(it.xy[0], it.xy[1]);
  await page.waitForTimeout(100);
  const r = await page.evaluate(() => { const s = document.getElementById('sG'); return { ds: s.dataset.bgImg, css: getComputedStyle(s).backgroundImage, block: !!document.getElementById('abG') }; });
  expect(r.ds).toContain('data:image/png');
  expect(r.css).toContain('url(');
  expect(r.block, '복사 — 블럭은 남는다').toBe(true);
});

test('C2-2 ★토스트가 «블럭은 남는다»와 «배경은 크기·위치만 가진다»를 말한다', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => { window.__t = []; const o = window.showToast; window.showToast = (m, ...a) => { window.__t.push(String(m)); return o?.(m, ...a); }; });
  const it = await rclickMenu(page, 'abG', 'bcm-asset-to-secbg');
  await page.mouse.click(it.xy[0], it.xy[1]);
  const t = (await page.evaluate(() => window.__t)).join('|');
  expect(t).toContain('블럭은 그대로 남습니다');
  expect(t).toContain('크기·위치만');
});

test('C2-3 ⌘Z 한 번 = 배경 넣기 한 번', async ({ page }) => {
  await setup(page);
  const it = await rclickMenu(page, 'abG', 'bcm-asset-to-secbg');
  await page.mouse.click(it.xy[0], it.xy[1]);
  expect(await page.evaluate(() => !!document.getElementById('sG').dataset.bgImg), '전제 — 넣기가 됐다(안 됐으면 아래 null 은 빈 통과)').toBe(true);
  await page.evaluate(() => { window.deselectAll?.(); document.activeElement?.blur?.(); });
  await page.keyboard.press('Meta+z');
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => document.getElementById('sG').dataset.bgImg ?? null)).toBeNull();
});

test('C2-4 ★섹션 배경 → 「스크래치로 보내기」 — lazy 로 style 이 none 이어도 정본(dataset.bgImg)을 보낸다', async ({ page }) => {
  await setup(page);
  await page.evaluate((px) => { const s = document.getElementById('sG'); s.dataset.bgImg = px; window.applySectionBg?.(s);
    s.style.backgroundImage = 'none';   // lazy 꼴(io/lazy-sections.js 가 style 만 none 으로 내린다)
    window.__sent = []; const o = window._scratchAddAndSave; window._scratchAddAndSave = async (...a) => { window.__sent.push(a[0]); try { return await o?.(...a); } catch (_) {} };
    window.selectSection?.(s); }, PX);
  await page.waitForTimeout(400);
  const b = await page.evaluate(() => { const el = document.getElementById('sec-bg-to-scratch'); if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  expect(b, '섹션 패널에 「스크래치로 보내기」').not.toBeNull();
  await page.mouse.click(b[0], b[1]);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__sent)).toEqual([expect.stringContaining('data:image/png')]);
});

test('C2-5 ★섹션 색이 불투명이면 색은 안 건드리고(업로드 길과 같은 규약) «덮고 있다·푸는 법»을 알린다', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => { const s = document.getElementById('sG'); s.dataset.bg = '#ffffff'; window.applySectionBg?.(s);
    window.__t = []; const o = window.showToast; window.showToast = (m, ...a) => { window.__t.push(String(m)); return o?.(m, ...a); }; });
  const it = await rclickMenu(page, 'abG', 'bcm-asset-to-secbg');
  await page.mouse.click(it.xy[0], it.xy[1]);
  const r = await page.evaluate(() => ({ bg: document.getElementById('sG').dataset.bg, img: !!document.getElementById('sG').dataset.bgImg, t: window.__t.join('|') }));
  expect(r.bg, '색은 그대로').toBe('#ffffff');
  expect(r.img).toBe(true);
  expect(r.t).toContain('덮고 있어요');
});
