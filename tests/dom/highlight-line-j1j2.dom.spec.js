/* highlight-line-j1j2 — 형광펜(선 형광펜 B, shape:'highlightB') 1012t1J1 · J2.
 *
 * 현빈(1012t1 J1): 「b만 남겨줘 · 찍으면 선이 되는데 그냥 누르면 만들어지게 하고 그다음 조정」
 *
 * ★무엇을 잠그나 (J1)
 *   J1-a 섹션을 고른 뒤 «실제 UI 클릭»(스티커 버튼 → 메뉴 «Highlight»)이면 B 가 바로 하나 생긴다:
 *        길이 160 수평선 · 두 끝점 섹션 안 · 선택됨 · 끝점 핸들 2 · 우측 Highlight Line 절이 보인다 · 두 클릭 모드는 꺼져 있다.
 *        (고치기 전: 메뉴가 두 클릭 모드로 들어가 블럭 0개 · 그리고 좌표 없는 addStickerBlock({shape:'highlightB'})는 (0,0)→(100,0))
 *   J1-b 만든 직후 끝 핸들을 실제 마우스로 끌면 x2 가 는다(«그다음 조정»).
 *   J1-c 만든 직후 ⌘Z 한 번이면 블럭이 0개(삽입 이음매).
 *   J1-d 옛 프로젝트의 면 형광펜 A(data-shape="highlight")는 계속 그려지고 패널이 열린다 · Shape 토글의 A 단추는 «A 블럭에서만».
 * 음성대조(보고에 수): sticker-block.js 의 끝점 주입 갈래를 지우면 J1-a 빨강 · prop-sticker.js 의 isHl 조건을 true 로 깨면 J1-d 빨강.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/* 섹션 하나를 깔고 «고른» 상태로 둔다. 돌려주는 값 = 섹션 id. */
async function setupSection(page) {
  return page.evaluate(() => {
    const canvas = document.getElementById('canvas');
    canvas.innerHTML = '<div class="section-block" id="secH" style="position:relative;height:480px;background:#ffffff"><div class="section-inner"></div></div>';
    window.rebindAll?.();
    const sec = document.getElementById('secH');
    window.selectSection?.(sec);
    return { id: sec.id, selected: window.getSelectedSection?.() === sec };
  });
}

/* 스티커 버튼 → 메뉴 항목(텍스트로 찾음) 을 «실제 마우스»로 누른다. */
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

const hlbState = (page) => page.evaluate(() => {
  const all = [...document.querySelectorAll('.sticker-block[data-shape="highlightB"]')];
  const b = all[all.length - 1];
  const sec = document.getElementById('secH');
  if (!b) return { n: 0 };
  const d = b.dataset;
  const sec2 = document.getElementById('stk-hlb-section');
  return {
    n: all.length, id: b.id,
    x1: +d.x1, y1: +d.y1, x2: +d.x2, y2: +d.y2,
    secW: sec.offsetWidth, secH: sec.offsetHeight,
    selected: b.classList.contains('selected'),
    handles: b.querySelectorAll('.hlb-handle').length,
    panel: !!sec2 && getComputedStyle(sec2).display !== 'none',
    mode: document.body.classList.contains('hlb-mode'),
  };
});

test('J1-a 메뉴 «Highlight» 한 번 누르면 선 형광펜이 «바로» 생기고 고른 상태(끝점 핸들 2·패널)다', async ({ page }) => {
  const errs = await bootApp(page);
  const s = await setupSection(page);
  expect(s.selected, '★전제: 섹션이 골라져 있다').toBe(true);
  const before = await page.evaluate(() => document.querySelectorAll('.sticker-block').length);
  expect(before).toBe(0);

  await clickPenMenu(page, 'Highlight');
  await page.waitForFunction(() => document.querySelectorAll('.sticker-block[data-shape="highlightB"]').length === 1, null, { timeout: 3000 });
  const r = await hlbState(page);
  expect(r.n, '선 형광펜이 정확히 하나').toBe(1);
  expect(await page.evaluate(() => document.querySelectorAll('.sticker-block').length), '스티커가 +1 (A 는 안 생긴다)').toBe(1);
  expect(Math.hypot(r.x2 - r.x1, r.y2 - r.y1), '기본 길이 160').toBe(160);
  expect(r.y1, '수평선').toBe(r.y2);
  for (const [k, v, max] of [['x1', r.x1, r.secW], ['x2', r.x2, r.secW], ['y1', r.y1, r.secH], ['y2', r.y2, r.secH]]) {
    expect(v, `${k} 가 섹션 안(>0)`).toBeGreaterThan(0);
    expect(v, `${k} 가 섹션 안(<끝)`).toBeLessThan(max);
  }
  expect(r.selected, '만든 직후 골라져 있다').toBe(true);
  expect(r.handles, '끝점 핸들 2').toBe(2);
  expect(r.panel, '우측 Highlight Line 절이 보인다').toBe(true);
  expect(r.mode, '두 클릭 모드로 들어가지 않았다').toBe(false);
  expect(errs).toEqual([]);
});

test('J1-b 만든 직후 끝 핸들을 끌면 x2 가 는다(그다음 조정)', async ({ page }) => {
  await bootApp(page);
  await setupSection(page);
  await clickPenMenu(page, 'Highlight');
  await page.waitForFunction(() => document.querySelectorAll('.sticker-block[data-shape="highlightB"] .hlb-handle').length === 2, null, { timeout: 3000 });
  const h = await page.evaluate(() => {
    const e = document.querySelector('.sticker-block[data-shape="highlightB"] .hlb-handle[data-endpoint="end"]');
    const r = e.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    return { x, y, hit: document.elementFromPoint(x, y) === e, x2: +e.closest('.sticker-block').dataset.x2 };
  });
  expect(h.hit, '★전제: 누르는 점이 끝 핸들 위다').toBe(true);
  await page.mouse.move(h.x, h.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(h.x + i * 10, h.y);
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => +document.querySelector('.sticker-block[data-shape="highlightB"]').dataset.x2)).toBeGreaterThan(h.x2 + 20);
});

test('J1-c 만든 직후 ⌘Z 한 번이면 블럭이 0개', async ({ page }) => {
  await bootApp(page);
  await setupSection(page);
  await clickPenMenu(page, 'Highlight');
  await page.waitForFunction(() => document.querySelectorAll('.sticker-block[data-shape="highlightB"]').length === 1, null, { timeout: 3000 });
  await page.evaluate(() => { document.activeElement?.blur?.(); });
  await page.keyboard.press('Meta+z');
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('.sticker-block').length)).toBe(0);
});

test('J1-d 옛 면 형광펜 A 는 계속 그려지고 패널이 열린다 · Shape 의 A 단추는 A 블럭에서만', async ({ page }) => {
  await bootApp(page);
  await setupSection(page);
  const r = await page.evaluate(() => {
    const sec = document.getElementById('secH');
    sec.insertAdjacentHTML('beforeend', '<div class="sticker-block" id="stk_oldA" data-type="sticker" data-shape="highlight" data-x="40" data-y="40" data-hl-w="200" data-hl-h="30" data-hl-color="rgba(0, 200, 255, 0.5)"></div>');
    const a = document.getElementById('stk_oldA');
    window.renderStickerBlock?.(a);
    window.bindStickerSelect?.(a);
    window._selectSticker?.(a);
    const cs = getComputedStyle(a);
    const hlSec = document.getElementById('stk-hl-section');
    const out = { w: cs.width, bg: cs.backgroundColor, hlPanel: !!hlSec && getComputedStyle(hlSec).display !== 'none',
      aBtnOnA: document.querySelectorAll('#stk-shape-group [data-shape="highlight"]').length };
    const b = window.makeStickerBlock({ shape: 'highlightB', x1: 60, y1: 200, x2: 220, y2: 200 });
    sec.appendChild(b); window.bindStickerSelect?.(b); window._selectSticker?.(b);
    out.aBtnOnB = document.querySelectorAll('#stk-shape-group [data-shape="highlight"]').length;
    out.bBtnOnB = document.querySelectorAll('#stk-shape-group [data-shape="highlightB"]').length;
    return out;
  });
  expect(r.w, 'A 너비 = 저장된 200').toBe('200px');
  expect(r.bg, 'A 색 = 저장된 색').toBe('rgba(0, 200, 255, 0.5)');
  expect(r.hlPanel, 'A 패널(Highlight Size) 열림').toBe(true);
  expect(r.aBtnOnA, 'A 블럭에선 Shape 의 A 단추가 있다(B 로 넘어갈 수 있게)').toBe(1);
  expect(r.bBtnOnB, '★전제: B 블럭 패널이 그려졌다').toBe(1);
  expect(r.aBtnOnB, 'B 블럭에선 A 로 바꾸는 단추가 없다').toBe(0);
});
