/* layer-section-shift-toggle.dom.spec.js — MARK-MULTISELECT-PICKS-UNSELECTED-MIDDLE-01 (레이어 쪽 · 현빈 0.9.10 QA)
 *   왼쪽 레이어 목록 섹션 줄 ⇧클릭 = 피그마식 토글(하나씩 더하기·빼기). 옛 «범위 선택»(사이 섹션까지)은 없앴다. 블럭 쪽은 shift-click-toggle-7042.
 *   L1 s1 클릭 → s3 ⇧클릭 ⇒ s1·s3 만(사이 s2 안 골라짐)
 *   L2 다시 s3 ⇧클릭 ⇒ s3 빠짐(s1 만) · s2 ⇧클릭 ⇒ s1·s2
 *   L3 음성대조 — 같은 순서를 ⌘ 로 하면 결과가 같다(⌘ 는 옛날엔 머리에서 그냥 고르기였다 — 문서 표대로 토글로 맞춤)
 *   L4 이름이 아닌 머리 빈 자리 ⇧클릭도 같다
 * ★양성대조: layer-panel.js 섹션 머리 click 의 ⇧ 갈래를 옛 범위 코드로 되돌리면 L1·L2 빨강. 진짜 마우스(레이어 줄 실클릭). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SEC = (id) => `<div class="section-block" id="${id}" data-section="1" data-name="${id}" style="background:#fff;"><div class="section-hitzone"></div>
  <div class="section-inner"><div class="gap-block" data-type="gap" style="height:120px"></div></div></div>`;
async function boot(page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await bootApp(page);
  await page.evaluate((h) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', h); window.rebindAll?.(); window.deselectAll?.(); window.buildLayerPanel?.(); }, ['s1', 's2', 's3', 's4'].map(SEC).join(''));
  await page.waitForFunction(() => document.querySelectorAll('#layer-panel-body .layer-section-header').length === 4);
}
const head = (page, i) => page.locator('#layer-panel-body .layer-section-header').nth(i);
const picked = (page) => page.evaluate(() => [...document.querySelectorAll('#canvas .section-block.selected')].map((s) => s.id).sort());
async function clickHead(page, i, mod) {
  // 사람처럼 «이름 글자»를 누른다(이름 click 은 머리와 별 갈래 — 둘 다 같은 토글이어야 한다)
  const box = await head(page, i).locator('.layer-section-name').boundingBox();
  const x = box.x + Math.min(10, box.width / 2), y = box.y + box.height / 2;
  if (mod) await page.keyboard.down(mod);
  await page.mouse.click(x, y);
  if (mod) await page.keyboard.up(mod);
}

for (const mod of ['Shift', 'Meta']) {
  test(`L1·L2 섹션 줄 ${mod}클릭 = 토글(사이 섹션 안 골라짐 · 다시 누르면 빠짐)`, async ({ page }) => {
    await boot(page);
    await clickHead(page, 0);
    await expect.poll(() => picked(page)).toEqual(['s1']);
    await clickHead(page, 2, mod);
    await expect.poll(() => picked(page), 's1·s3 만 — 사이 s2 는 안 골라진다').toEqual(['s1', 's3']);
    await clickHead(page, 2, mod);
    await expect.poll(() => picked(page), '고른 s3 를 다시 누르면 빠진다').toEqual(['s1']);
    await clickHead(page, 1, mod);
    await expect.poll(() => picked(page)).toEqual(['s1', 's2']);
  });
}

test('L4 머리 빈 자리(이름 밖) ⇧클릭도 토글', async ({ page }) => {
  await boot(page);
  await clickHead(page, 0);
  const box = await head(page, 2).boundingBox();
  const nm = await head(page, 2).locator('.layer-section-name').boundingBox();
  const x = Math.max(box.x + 2, nm.x - 4), y = box.y + box.height / 2;   // 이름 «앞»(chevron 과 이름 사이 또는 들여쓰기)
  await page.keyboard.down('Shift'); await page.mouse.click(x, y); await page.keyboard.up('Shift');
  await expect.poll(() => picked(page)).toEqual(['s1', 's3']);
});
