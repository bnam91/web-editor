/* mesh-default-neutral-t404.dom.spec.js — t4-04 (현빈 0.9.11_t4 「메시 그라데이션 기본 컬러 프리셋 톤다운 · 무채색 또는 저채도」 · 지디 ㉠ 무채색)
 *   D1 섹션 패널 「메시 그라데이션」 진짜 클릭 → 네 모서리 = 새 기본값(#f5f5f5|#d9d9d9|#a8a8a8|#e6e6e6) · 네 색 모두 HSL 채도 ≤ 15% · 4겹 · ⌘Z 한 번 = 메시 없음
 *   D2 이미 저장된 메시(옛 기본 네 색)는 패널을 열고 닫아도 · 직렬화 왕복해도 그 네 색 그대로
 *   D3 사용자 색 지정은 그대로 — 켠 뒤 왼위 색 칸에 FF0080 → 왼위만 그 색 · 나머지 셋은 새 기본값
 *   D4 새 기본값으로 켠 섹션 저장 → 다시 열기 = 같은 네 색 · 4겹
 * ★양성대조: prop-section.js 를 기준판(e7d97f1ec · MESH_DEFAULT 형형색색)으로 되돌리면 D1·D3·D4 빨강(채도·값). */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const raf2 = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const NEW = '#f5f5f5|#d9d9d9|#a8a8a8|#e6e6e6';
const OLD = '#ff6ec7|#7b5cff|#4ad7d1|#ffd166';
const sat = (h) => { const c = [1, 3, 5].map(o => parseInt(h.slice(o, o + 2), 16) / 255), mx = Math.max(...c), mn = Math.min(...c), l = (mx + mn) / 2;
  return mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1)) * 100; };

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = await bootApp(page);
  const A = await page.evaluate(async () => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    await window.addSection();
    window.clearHistory?.();
    return c.querySelector('.section-block').id;
  });
  await raf2(page);
  return { errs, A };
}
async function pickSection(page, id) {
  await page.evaluate((i) => document.getElementById(i).scrollIntoView({ block: 'center' }), id);
  const b = await waitStableRect(page, '#' + id);
  await page.mouse.click(b.left + 8, b.cy);
  await page.waitForFunction((i) => document.getElementById(i)?.classList.contains('selected') && document.getElementById('sec-height-value')?.dataset.secId === i, id, { timeout: 8000 });
  await raf2(page);
}
const meshOf = (page, id) => page.evaluate((i) => document.getElementById(i).dataset.bgMesh ?? null, id);
const layers = (page, id) => page.evaluate((i) => (getComputedStyle(document.getElementById(i)).backgroundImage.match(/radial-gradient\(/g) || []).length, id);
const roundTrip = (page, id) => page.evaluate(async (i) => {
  const html = window.getSerializedCanvas();
  const c = document.getElementById('canvas'); c.innerHTML = html; await window.rebindAll?.();
  const s = document.getElementById(i);
  return { mesh: s?.dataset.bgMesh ?? null, layers: s ? (getComputedStyle(s).backgroundImage.match(/radial-gradient\(/g) || []).length : -1 };
}, id);

test('D1 새로 켠 메시 = 무채색 기본값 · 네 색 채도 ≤ 15% · 4겹 · ⌘Z 한 번 = 꺼짐', async ({ page }) => {
  const { errs, A } = await setup(page);
  await pickSection(page, A);
  await page.locator('#sec-bg-mesh').click();
  await expect.poll(() => meshOf(page, A)).toBe(NEW);
  const cols = (await meshOf(page, A)).split('|');
  expect(cols.map(sat).every((s) => s <= 15), `채도 = ${cols.map((c) => c + ' ' + sat(c).toFixed(0) + '%').join(' · ')}`).toBe(true);
  expect(await layers(page, A)).toBe(4);
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Meta+z');
  await expect.poll(() => meshOf(page, A), '⌘Z 한 번 = 메시 없음').toBe(null);
  expect(errs).toEqual([]);
});

test('D2 이미 저장된 메시(옛 네 색)는 패널 열고 닫기 · 직렬화 왕복에도 그대로', async ({ page }) => {
  const { errs, A } = await setup(page);
  await page.evaluate(([i, s]) => { const e = document.getElementById(i); e.dataset.bgMesh = s; window.applySectionBg(e); }, [A, OLD]);
  await pickSection(page, A);
  await page.evaluate(() => window.deselectAll());
  expect(await meshOf(page, A)).toBe(OLD);
  expect(await roundTrip(page, A)).toEqual({ mesh: OLD, layers: 4 });
  expect(errs).toEqual([]);
});

test('D3 사용자 색 지정 유지 — 켠 뒤 왼위 색 칸 FF0080 → 왼위만 바뀜', async ({ page }) => {
  const { errs, A } = await setup(page);
  await pickSection(page, A);
  await page.locator('#sec-bg-mesh').click();
  await expect.poll(() => meshOf(page, A)).toBe(NEW);
  await page.fill('#sec-mesh-tl-hex', 'FF0080');
  await page.press('#sec-mesh-tl-hex', 'Enter');
  await expect.poll(async () => ((await meshOf(page, A)) || '').split('|')[0].toLowerCase()).toContain('#ff0080');
  expect((await meshOf(page, A)).split('|').slice(1), '나머지 셋 = 새 기본값').toEqual(NEW.split('|').slice(1));
  expect(errs).toEqual([]);
});

test('D4 새 기본값 메시 저장 → 다시 열기 = 같은 네 색 · 4겹', async ({ page }) => {
  const { errs, A } = await setup(page);
  await pickSection(page, A);
  await page.locator('#sec-bg-mesh').click();
  await expect.poll(() => meshOf(page, A)).toBe(NEW);
  expect(await roundTrip(page, A)).toEqual({ mesh: NEW, layers: 4 });
  expect(errs).toEqual([]);
});
