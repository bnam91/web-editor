/* t3-03b-sticker-layer-order.dom.spec.js — t3-03ⓑ 스티커 ⌘[ / ⌘] 레이어 순서
 *
 * S3 실측(68ba1f1b ↔ ca702d40 ×3 · ~/taeyang-098/reports/S3-129-T303.md): 오버레이 글 = 된다(형제 3→4) · ★스티커 = 안 된다(순서·z 55 변화 0).
 * 까닭(독해): editor.js moveSelectedBlocks 의 섹션 직속 갈래는 data-overlay-block="true" 만 받는다 — 스티커(섹션 직속 · 인라인 z 55)는 «해당 없음».
 * 층: 스티커끼리는 인라인 z 가 같다(보통 55 · 형광펜 1) ⇒ DOM 뒤가 위. 같은 z 의 섹션 직속 스티커들 사이에서만 앞뒤를 바꾼다.
 * 칸
 *   P0  전제 — 두 스티커 A·B 가 겹치고 겹친 점의 임자 = B(DOM 뒤) · 진짜 클릭으로 A 가 골라진다
 *   F   ⌘] → A 가 B 뒤로(형제 순서) · 겹친 점의 임자 = A · z 그대로 55 · 이력 「앞으로 가져오기」
 *   B   이어 ⌘[ → 다시 B 아래로 · 임자 = B · 이력 「뒤로 보내기」
 *   Z   ⌘] 뒤 ⌘Z → 처음(한 걸음)
 *   H   형광펜(z 1)은 같은 층이 아니다 — 보통 스티커 ⌘] 가 형광펜을 넘어 세지 않는다(형광펜 자리 그대로)
 * 양성대조: GD1001_ROOT=<핀 d021e42e 사본> ⇒ F·B·Z·H 빨강(순서·임자 그대로 — H 도 아무것도 안 움직여 빨강) · P0 초록.
 * ⛔고정 대기 없음 — waitForFunction 만. 하네스 = _root-harness.bootApp.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function setup(page, { withHighlight = false } = {}) {
  await page.setViewportSize({ width: 1700, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate((withHighlight) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    window.addSection();
    const sec = c.querySelector('.section-block');
    const put = (opts, left, top) => {
      window.deselectAll?.(); window.selectSection(sec);
      const before = new Set([...sec.querySelectorAll(':scope > .sticker-block')]);
      window.addStickerBlock({ size: 200, ...opts, x: left, y: top });   /* 기본 60 은 배율에서 너무 작다 — 겹치게 키운다 */
      return [...sec.querySelectorAll(':scope > .sticker-block')].find((x) => !before.has(x));
    };
    window.__sec = sec;
    window.__A = put({}, 120, 120);
    window.__B = put({}, 260, 200);
    /* 형광펜은 «나중에» 만들어 A·B 사이로 옮긴다 — 먼저 만들면 다음 스티커가 그 꼴을 물려받는다(rememberStickerStyle) */
    if (withHighlight) { window.__H = put({ shape: 'highlight' }, 600, 400); sec.insertBefore(window.__H, window.__B); }
    window.deselectAll?.();
    window.__A.scrollIntoView({ block: 'center' });
  }, withHighlight);
  await page.waitForFunction(() => window.__A && window.__B && window.__A.getBoundingClientRect().width > 0 && window.__B.getBoundingClientRect().width > 0);
  return errs;
}
const st = (page) => page.evaluate(() => {
  const a = window.__A.getBoundingClientRect(), b = window.__B.getBoundingClientRect();
  const ox = (Math.max(a.left, b.left) + Math.min(a.right, b.right)) / 2, oy = (Math.max(a.top, b.top) + Math.min(a.bottom, b.bottom)) / 2;
  const h = document.elementFromPoint(ox, oy)?.closest('.sticker-block');
  const kids = [...window.__sec.children].filter((c) => c.classList.contains('sticker-block'));
  return { owner: h === window.__A ? 'A' : h === window.__B ? 'B' : (h ? 'other' : null),
    order: kids.map((k) => k === window.__A ? 'A' : k === window.__B ? 'B' : k === window.__H ? 'H' : '?').join(''),
    zA: getComputedStyle(window.__A).zIndex, zB: getComputedStyle(window.__B).zIndex,
    overlap: a.right > b.left && b.right > a.left && a.bottom > b.top && b.bottom > a.top, sel: window.__A.classList.contains('selected') };
});
async function pickA(page) {
  /* A 의 «안 덮인» 왼쪽 위 1/5 점 — B 는 오른쪽 아래로 비켜 있다 */
  /* 자리가 두 프레임 내리 같을 때 잰다(scrollIntoView 뒤 흔들림) */
  const p = await page.evaluate(() => new Promise((done) => { let prev = null, n = 0; const t = () => { const r = window.__A.getBoundingClientRect(); const k = [r.left, r.top, r.width].join(); if (k === prev) { if (++n >= 2) return done([r.left + r.width * 0.15, r.top + r.height * 0.2]); } else n = 0; prev = k; requestAnimationFrame(t); }; requestAnimationFrame(t); }));
  const who = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('.sticker-block') === window.__A, p);
  expect(who, '전제: 누를 점의 임자 = A').toBe(true);
  await page.mouse.click(p[0], p[1]);
  await page.waitForFunction(() => window.__A.classList.contains('selected'));
}
const key = async (page, k) => { await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press(k); };
const histLabel = (page) => page.evaluate(() => window.getHistoryLabels?.()?.slice(-1)?.[0] ?? window.__lastHistoryLabel ?? null);

test('P0 전제 — A·B 가 겹치고 임자 = B · 둘 다 z 55 · 진짜 클릭으로 A 가 골라진다', async ({ page }) => {
  const errs = await setup(page);
  const s0 = await st(page);
  expect(s0).toMatchObject({ overlap: true, owner: 'B', order: 'AB', zA: '55', zB: '55' });
  await pickA(page);
  expect((await st(page)).sel).toBe(true);
  expect(errs).toEqual([]);
});

test('F ⌘] → A 가 B 위로 · 임자 = A · z 그대로', async ({ page }) => {
  const errs = await setup(page);
  await pickA(page);
  await key(page, 'Meta+BracketRight');
  await page.waitForFunction(() => { const k = [...window.__sec.children].filter((c) => c.classList.contains('sticker-block')); return k.indexOf(window.__A) > k.indexOf(window.__B); }, null, { timeout: 3000 }).catch(() => {});
  expect(await st(page)).toMatchObject({ owner: 'A', order: 'BA', zA: '55', zB: '55', sel: true });
  expect(errs).toEqual([]);
});

test('B 이어 ⌘[ → 다시 B 위 · 임자 = B', async ({ page }) => {
  const errs = await setup(page);
  await pickA(page);
  await key(page, 'Meta+BracketRight');
  await page.waitForFunction(() => { const k = [...window.__sec.children].filter((c) => c.classList.contains('sticker-block')); return k.indexOf(window.__A) > k.indexOf(window.__B); }, null, { timeout: 3000 }).catch(() => {});
  expect((await st(page)).order, '전제: ⌘] 먹음').toBe('BA');
  await key(page, 'Meta+BracketLeft');
  await page.waitForFunction(() => { const k = [...window.__sec.children].filter((c) => c.classList.contains('sticker-block')); return k.indexOf(window.__A) < k.indexOf(window.__B); }, null, { timeout: 3000 }).catch(() => {});
  expect(await st(page)).toMatchObject({ owner: 'B', order: 'AB' });
  expect(errs).toEqual([]);
});

test('Z ⌘] 뒤 ⌘Z 한 번 → 처음(AB · 임자 B)', async ({ page }) => {
  const errs = await setup(page);
  await pickA(page);
  await key(page, 'Meta+BracketRight');
  await page.waitForFunction(() => { const k = [...window.__sec.children].filter((c) => c.classList.contains('sticker-block')); return k.indexOf(window.__A) > k.indexOf(window.__B); }, null, { timeout: 3000 }).catch(() => {});
  expect((await st(page)).order, '전제: ⌘] 먹음').toBe('BA');
  await key(page, 'Meta+z');
  await page.waitForFunction(() => { const s = window.__sec?.isConnected ? window.__sec : document.querySelector('#canvas .section-block'); const k = [...s.children].filter((c) => c.classList.contains('sticker-block')); return k.length === 2 && k[0].id === window.__A.id; }, null, { timeout: 3000 });
  const ids = await page.evaluate(() => [...document.querySelector('#canvas .section-block').children].filter((c) => c.classList.contains('sticker-block')).map((c) => c.id === window.__A.id ? 'A' : c.id === window.__B.id ? 'B' : '?').join(''));
  expect(ids).toBe('AB');
  expect(errs).toEqual([]);
});

test('H 형광펜(z 1)은 같은 층이 아니다 — A ⌘] 는 B 만 넘는다 · 형광펜 자리 그대로', async ({ page }) => {
  const errs = await setup(page, { withHighlight: true });
  const s0 = await st(page);
  expect(s0.order, '전제: A H B').toBe('AHB');
  expect(await page.evaluate(() => [window.__A, window.__B].map((x) => getComputedStyle(x).zIndex)), '전제: A·B 는 보통(55)').toEqual(['55', '55']);
  expect(await page.evaluate(() => getComputedStyle(window.__H).zIndex), '전제: 형광펜 z 1').toBe('1');
  await pickA(page);
  await key(page, 'Meta+BracketRight');
  await page.waitForFunction(() => { const k = [...window.__sec.children].filter((c) => c.classList.contains('sticker-block')); return k.indexOf(window.__A) > k.indexOf(window.__B); }, null, { timeout: 3000 }).catch(() => {});
  /* 같은 층(z 55)의 다음 형제 B 바로 뒤로 — 형광펜은 세지도 않고 옮기지도 않는다 */
  expect((await st(page)).order).toBe('HBA');
  expect(errs).toEqual([]);
});
