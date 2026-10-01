/* asset-preview.dom.spec.js — C3 (현빈 2026-10-01) 노트패널(에셋 패널) 이미지 더블클릭 = «크게 보기»(바로 넣지 않는다).
 * 앱 통째로 헤드리스(bootApp). 노트패널 이미지는 인라인 그림(data URI)으로 시드돼 파일 IPC 없이 읽힌다 — 같은 꼴로 시드.
 * ★양성대조 판 = 7699ea33 → 실측 빨강: N1 N2 N3 (N2 는 «창이 열렸다» 전제를 넣은 뒤부터 — 넣기 전엔 옛 판에서 빈 통과였다).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await bootApp(page);
  await page.evaluate((px) => {
    /* 노트패널은 «바둑판 보기» 폴더다 — 현빈이 겪은 더블클릭은 그 «카드»의 것(목록 보기는 줄 더블클릭 = 이름 바꾸기). */
    window.state.assetsTree = [{ id: 'f_note', type: 'folder', name: '노트패널', viewMode: 'grid', collapsed: false, locked: true,
      children: [{ id: 'img_n1', type: 'image', name: '메모배경', src: px }] }];
    window.__t = []; const o = window.showToast; window.showToast = (m, ...a) => { window.__t.push(String(m)); return o?.(m, ...a); };
    window.switchToTab?.('assets'); window.buildAssetsPanel?.();
  }, PX);
  await page.waitForTimeout(300);
}
const card = (page) => page.evaluate(() => { const c = document.querySelector('.assets-grid-card--image'); if (!c) return null; const r = c.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
const assets = (page) => page.evaluate(() => document.querySelectorAll('#canvas .asset-block').length);

test('N1 ★더블클릭 = 크게 보기 — 창이 뜨고 그림이 들어 있다 · 넣지 않는다 · 「섹션을 선택」 토스트 없음', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => window.deselectAll?.());
  const before = await assets(page);
  const c = await card(page);
  expect(c, '전제 — 이미지 카드가 그려졌다').not.toBeNull();
  await page.mouse.dblclick(c[0], c[1]);
  await page.waitForTimeout(200);
  const r = await page.evaluate(() => ({ open: !!document.querySelector('.tpl-preview-backdrop.asset-preview'), src: document.querySelector('.asset-preview-img')?.src?.slice(0, 22) || null, t: window.__t.join('|') }));
  expect(r.open).toBe(true);
  expect(r.src).toBe('data:image/png;base64,');
  expect(await assets(page), '바로 넣지 않는다').toBe(before);
  expect(r.t).not.toContain('섹션을 먼저');
});

test('N2 Esc 로 닫힌다(편집기 단축키로 새지 않는다)', async ({ page }) => {
  await setup(page);
  const c = await card(page);
  await page.mouse.dblclick(c[0], c[1]);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => !!document.querySelector('.tpl-preview-backdrop.asset-preview')), '전제 — 창이 열렸다(안 열렸으면 아래는 빈 통과)').toBe(true);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => !!document.querySelector('.tpl-preview-backdrop.asset-preview'))).toBe(false);
});

test('N3 ★「섹션에 넣기」 = 옛 더블클릭이 하던 일(고른 섹션에 에셋으로)', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => { const s = document.querySelector('#canvas .section-block'); if (s) window.selectSection?.(s); else window.addSection?.(); });
  const before = await assets(page);
  const c = await card(page);
  await page.mouse.dblclick(c[0], c[1]);
  await page.waitForTimeout(150);
  const b = await page.evaluate(() => { const r = document.querySelector('[data-asset-insert]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.click(b[0], b[1]);
  await page.waitForTimeout(300);
  expect(await assets(page)).toBe(before + 1);
  expect(await page.evaluate(() => !!document.querySelector('.tpl-preview-backdrop.asset-preview')), '넣으면 창은 닫힌다').toBe(false);
});
