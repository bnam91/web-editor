/* anim-gif-v3-options — GIF V3(0.9.13 19~23행 · 현빈 261116) 옵션 «칸»이 실제 모달에서 서고 저장되는가. 그리기 셈은 단위 T21~T26(anim-gif-tracks)이 잰다.
 *   실제 텍스트 블럭 · 실제 모달 · 진짜 클릭(효과 고르기 · 체크 · 고르기 · 줄마다 따로).
 * V1 블럭 전체: 도장 → «옅은 가이드» 칸 하나 → 켬 = data-anim-opt {"guide":true} · 모달 다시 열면 켜진 채 · 타이핑으로 바꾸면 가이드+커서 칸 · 커서 끔 = {"guide":true,"cursor":false} ·
 *    글로우 펄스 = 가이드·글로우·깜빡임 셋 · 슬라이드업 = 칸 0(옵션 없는 효과 · 저장 키 지움) · 형광펜 없는 글엔 형광펜 고르기 0
 * V2 줄마다 따로: 첫 줄 효과를 타이핑으로 → 그 줄 칸에 커서 칸 → 끔 = data-anim-gif 첫 트랙 o {"cursor":false}
 * V3 형광펜 칠한 글(span.tb-hl): 형광펜 고르기 = 네 갈래(기본·고정·긋기·글 고정+띠만 긋기) · «형광펜 긋기» = data-anim-opt {"hl":"draw"} · 「한 글자씩 부드럽게」 효과가 목록에 있고 고르면 미리보기가 그려진다(빈 캔버스 아님)
 * 양성대조(예측 · CTL): animation-engine.js _selectAnim 의 `_renderBlockOpts();` 줄 삭제 → V1·V3 빨강(칸이 안 선다) · V2 초록(줄 칸은 _renderTrackRows)
 * 셀렉터·전역 대조(제품 소스 grep): #anim-gif-modal · #anim-list .anim-item[data-id] · #anim-fx-opts(index.html) · [data-opt](animation-engine.js _optControls) ·
 *   #anim-per-line · #anim-tracks .anim-track-row .anim-track-fx(_renderTrackRows) · #anim-preview-canvas · .tb-hl(prop-text-wireup-text-edit.js) · window.openAnimModal/closeAnimModal
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page, html) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async (html) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    window.selectSection(c.querySelector('.section-block'));
    window.addTextBlock('body');
    const tb = [...c.querySelectorAll('.text-block')].pop();
    (tb.querySelector('[contenteditable]') || tb.querySelector('.tb-body')).innerHTML = html;
    window.__tb = tb;
    window.deselectAll?.();
    window.openAnimModal(tb);
  }, html);
  return errs;
}
const opts = (page) => page.evaluate(() => [...document.querySelectorAll('#anim-fx-opts [data-opt]')].map((e) => e.dataset.opt));
const saved = (page) => page.evaluate(() => window.__tb.dataset.animOpt ?? null);
const pick = (page, id) => page.click(`#anim-list .anim-item[data-id="${id}"]`);

test('V1 블럭 전체 옵션 — 효과마다 칸 · 켬/끔 저장 · 다시 열면 그대로', async ({ page }) => {
  const errs = await scene(page, '네!');
  await pick(page, 'stamp');
  expect(await opts(page), '★도장 = 옅은 가이드 칸').toEqual(['guide']);
  await page.check('#anim-fx-opts [data-opt="guide"]');
  expect(await saved(page)).toBe('{"guide":true}');
  await page.evaluate(() => { window.closeAnimModal(); window.openAnimModal(window.__tb); });
  await expect(page.locator('#anim-fx-opts [data-opt="guide"]'), '다시 열면 켜진 채').toBeChecked();
  await pick(page, 'typewriter');
  expect(await opts(page), '타이핑 = 가이드 + 커서').toEqual(['guide', 'cursor']);
  await page.uncheck('#anim-fx-opts [data-opt="cursor"]');
  expect(await saved(page)).toBe('{"guide":true,"cursor":false}');
  await pick(page, 'glow-pulse');
  expect(await opts(page), '펄스 = 가이드 · 글로우 · 깜빡임').toEqual(['guide', 'glow', 'pulse']);
  await pick(page, 'slide-up');
  expect([await opts(page), await saved(page)], '옵션 없는 효과 = 칸 0 · 저장 키 지움').toEqual([[], null]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('V2 줄마다 따로 — 줄 칸에 같은 옵션 · 트랙 o 로 저장', async ({ page }) => {
  const errs = await scene(page, '오늘 주문하면?<br>네!');
  await page.check('#anim-per-line');
  const row0 = page.locator('#anim-tracks .anim-track-row[data-line="0"]');
  await row0.locator('.anim-track-fx').selectOption('typewriter');
  await expect(row0.locator('[data-opt="cursor"]'), '★타이핑 줄에 커서 칸').toHaveCount(1);
  await row0.locator('[data-opt="cursor"]').uncheck();
  const t0 = await page.evaluate(() => JSON.parse(window.__tb.dataset.animGif).tracks[0]);
  expect([t0.fx, t0.o], '첫 트랙 저장').toEqual(['typewriter', { cursor: false }]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('V3 형광펜 칠한 글 — 형광펜 고르기 세 갈래 · 긋기 저장 / 한 글자씩 부드럽게 효과', async ({ page }) => {
  const errs = await scene(page, '누적 <span class="tb-hl" style="--tb-hl-color: rgb(255, 0, 255); --tb-hl-h: 40%; --tb-hl-y: 0px">20,000</span>장');
  await pick(page, 'fade-in');
  const sel = page.locator('#anim-fx-opts select[data-opt="hl"]');
  await expect(sel, '★형광펜 글인데 형광펜 고르기가 없다').toHaveCount(1);
  expect(await sel.locator('option').evaluateAll((os) => os.map((o) => o.value))).toEqual(['', 'fixed', 'draw', 'sweep']);   // 0.9.13 24행 «글 고정 + 띠만 긋기» 더함
  await sel.selectOption('draw');
  expect(await saved(page)).toBe('{"hl":"draw"}');
  await expect(page.locator('#anim-list .anim-item[data-id="fade-char"]'), '[전제] 새 효과가 목록에').toHaveCount(1);
  await pick(page, 'fade-char');
  await expect.poll(() => page.evaluate(() => { const cv = document.getElementById('anim-preview-canvas'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] && (d[i - 3] < 200 || d[i - 2] < 200)) n++; return n; }), { timeout: 10000, message: '★한 글자씩 부드럽게 미리보기가 비었다' }).toBeGreaterThan(50);
  expect(errs, errs.join(' | ')).toEqual([]);
});

