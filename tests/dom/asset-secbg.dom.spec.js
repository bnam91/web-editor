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

/* ★★2026-10-10 — ★★방향을 ★뒤집었다(⛔지우지 않았다 · 선례 = 같은 레포 pad-hint T5/T6).
   ★옛 C2-5 는 ★「불투명 색이면 ★그림이 ★가려지니 ★«덮고 있다»를 ★알린다」를 ★잠그고 있었다.
   ★★현빈 2026-10-10 「솔리드배경에서 ★즉각 바껴야지」로 ★그 규약이 ★바뀌었다 —
     ★불투명 색은 ★이제 ★그림 «아래»로 간다(prop-section.js `_applySectionBg`).
   ⇒ ★★잠글 것이 ★«반대»가 됐다: ★색은 ★여전히 ★남고(안 잃는다), ★★그림이 ★보이고, ★안내는 ★없다. */
test('C2-5 ★섹션 색이 불투명이어도 ★색은 그대로 남고 ★그림이 ★이긴다 — ★«덮고 있다» 안내는 ★없다', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => { const s = document.getElementById('sG'); s.dataset.bg = '#ffffff'; window.applySectionBg?.(s);
    window.__t = []; const o = window.showToast; window.showToast = (m, ...a) => { window.__t.push(String(m)); return o?.(m, ...a); }; });
  const it = await rclickMenu(page, 'abG', 'bcm-asset-to-secbg');
  await page.mouse.click(it.xy[0], it.xy[1]);
  const r = await page.evaluate(() => {
    const s = document.getElementById('sG');
    const cs = getComputedStyle(s);
    return { bg: s.dataset.bg, img: !!s.dataset.bgImg, t: window.__t.join('|'),
             bgImg: cs.backgroundImage, bgColor: cs.backgroundColor };
  });
  expect(r.bg, '★색은 그대로 — ★치우지 않는다(지우면 그림을 지웠을 때 색을 잃는다)').toBe('#ffffff');
  expect(r.img).toBe(true);
  expect(r.bgImg, `★그림이 ★그려진다(합성 아님) — 잰값 ${r.bgImg}`).toMatch(/url\(/);
  expect(r.bgImg, '★★불투명 색 층이 ★그림 «위»에 ★안 깔린다').not.toMatch(/gradient/);
  expect(r.t, '★덮는 일이 없으니 ★그 안내도 없다').not.toContain('덮고 있어요');
});

/* ★★2026-10-10 — ★여기도 ★방향을 ★뒤집었다. ★옛 C2-6 은 ★패널 ★«상시 한 줄»이 ★뜨는 것을 잠갔다.
   ⚠️★그 줄은 ★정말 ★뜨고 ★보였다(t3frame 측정: 211×51 · 11px · #888) — ★«안 뜨는 버그»가 ★아니었다.
     ★그래도 ★현빈이 ★바꾸라 하셨다 ⇒ ★규약을 바꿨고 ⇒ ★안내할 것이 ★없어 ★줄도 걷었다.
   ★★이제 잠그는 것 = ★★«그 줄이 ★없다» ＋ ★★«그림이 ★실제로 보인다»(불투명이든 반투명이든).
   ★반투명은 ★여전히 ★물들임 합성이다 — ★★그 기능을 ★같이 잠근다(⛔없애면 빨개진다). */
test('C2-6 ★섹션 패널 — ★«덮고 있다» 한 줄은 ★더 없다 ＋ ★불투명은 그림만·★반투명은 ★물들임 합성', async ({ page }) => {
  await setup(page);
  const probe = (bg) => page.evaluate(async ([bg, px]) => {
    const s = document.getElementById('sG'); s.dataset.bg = bg; s.dataset.bgImg = px; window.applySectionBg?.(s);
    window.deselectAll?.(); window.selectSection?.(s); await new Promise(r => setTimeout(r, 400));
    const cs = getComputedStyle(s);
    return {
      hint: [...document.querySelectorAll('#panel-right .prop-hint')].map(e => e.textContent).find(t => t.includes('덮고')) || null,
      panel: !!document.getElementById('sec-bg-size'),          /* ★전제 — 섹션 배경 칸이 그려졌다 */
      bgImg: cs.backgroundImage,
    };
  }, [bg, PX]);
  const op = await probe('#ffffff');
  const tr = await probe('rgba(255,255,255,0.5)');
  expect(op.panel, '★전제 — 패널 배경 칸이 그려졌다(안 그려지면 아래 단언이 공회전한다)').toBe(true);
  expect(op.hint, '★불투명 — 「덮고 있다」 줄이 ★없다').toBeNull();
  expect(tr.hint, '★반투명 — 원래도 없었다').toBeNull();
  expect(op.bgImg, `★불투명 — ★그림만 그린다(잰값 ${op.bgImg})`).not.toMatch(/gradient/);
  expect(op.bgImg, '★불투명 — 그림은 ★있다').toMatch(/url\(/);
  expect(tr.bgImg, `★★반투명 — ★물들임 합성은 ★그대로다(잰값 ${tr.bgImg})`).toMatch(/gradient.*url\(/);
});
