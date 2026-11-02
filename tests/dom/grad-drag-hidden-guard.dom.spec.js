/* grad-drag-hidden-guard.dom.spec.js — 칩·끝 원을 끄는 중 Esc·⌘Z 로 선이 걷힌 뒤 움직임: 값을 안 쓰고 오류도 안 낸다.
 * 까닭: 옛 판은 움직임마다 TypeError(reading 'box')로 멈춰 «우연히» 안 썼다(앱 움직임 2번에 2건 · 칩·끝 원 × Esc·⌘Z 각 3/3).
 *   K 칸 ⇒ 오류 0 · 키 뒤 값이 안 바뀐다(Esc 는 키 전 값 · ⌘Z 는 시작 값).
 *   N [음성] 키 없이 끌면 값이 계속 바뀐다(자가 산다).
 * ⛔안 재는 것: 사람 손 · 실 창 밖 놓기. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const SEL = { chip: '.grad-line-overlay .grad-stop-chip:not(.grad-stop-chip-fill)', end: '.grad-line-overlay .grad-line-end' };
async function drag(page, sel, key) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await bootApp(page);
  await page.evaluate(() => {
    window.addSection();
    const sec = [...document.querySelectorAll('#canvas .section-block')].pop();
    sec.id = 'gS';
    window.selectSection(sec);
    sec.dataset.bg = 'linear-gradient(90deg,#ff0000,#0000ff)';
    window.applySectionBg(sec);
    window.showGradientLine(sec);
    sec.scrollIntoView({ block: 'center' });
    window.pushHistory('장면');
  });
  await page.waitForFunction((s) => document.querySelector(s), sel);
  const q = await waitStableRect(page, sel);   // 스크롤·줌이 멈춘 뒤 — 옛 좌표로 잡으면 끌기가 안 선다
  const p = { x: q.cx, y: q.cy };
  const bg = () => page.evaluate(() => document.getElementById('gS').dataset.bg);
  const v0 = await bg();
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 25, p.y + 5);
  await page.mouse.move(p.x + 45, p.y + 10);
  const v1 = await bg();
  if (key) await page.keyboard.press(key);
  const v2 = await bg();
  await page.mouse.move(p.x + 95, p.y + 30);
  await page.mouse.move(p.x + 140, p.y + 50);
  const v3 = await bg();
  await page.mouse.up();
  return { errs, v0, v1, v2, v3, v4: await bg() };
}
for (const [name, sel] of Object.entries(SEL)) {
  for (const [kn, key] of [['Esc', 'Escape'], ['⌘Z', 'Meta+z']]) {
    test(`K ${name} 끌기 중 ${kn} — 그 뒤 움직임이 오류도 값도 안 낸다`, async ({ page }) => {
      const r = await drag(page, sel, key);
      expect(r.v1, '[전제] 끌기가 값을 썼다').not.toBe(r.v0);
      expect(r.v3, '걷힌 뒤 움직임이 값을 썼다').toBe(r.v2);
      expect(r.v4).toBe(r.v2);
      expect(r.errs).toEqual([]);
    });
  }
  test(`N [음성] ${name} 키 없이 끌기 — 값이 계속 바뀐다`, async ({ page }) => {
    const r = await drag(page, sel, null);
    expect(r.v3).not.toBe(r.v2);
    expect(r.errs).toEqual([]);
  });
}
