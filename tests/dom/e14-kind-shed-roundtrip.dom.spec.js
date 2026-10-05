/* e14-kind-shed-roundtrip.dom.spec.js — E14: 줄 종류를 바꾼 뒤 «저장 → 새로 띄운 앱 → 다시 열기»에도 앞 종류의 짐이 안 살아난다
 *
 * 병(10-06 실측 · a8f60da1): MCP 모양 patchCell{lineIndex, type} 로 image(height 160 · 크롭 없음) → body 로 바꾸면 height:160 이
 *   dataset 에 남고, 이어 → gap 이면 여백이 16 이 아니라 160px 로 그려졌다. 단위(tests/unit/grid-kind-shed.test.js)는 «모델»까지 잰다 —
 *   이 파일은 «저장본을 거쳐 다시 연 앱»에서 화면 높이로 잰다(손실 판정의 마지막 칸).
 * 고침 = fix25 2ddf61e6 (APPROVED_BY: 지디 E14-E157). 대조 = a8f60da1 에서 R0·R1 빨강(predict-E14-dom.md).
 * 길: bootApp(앱 통째) → updateGridBlock(MCP 와 같은 문) → serializeProject → bootApp(새 앱) → applyProjectData. 머리표 [전제] = 재기 위한 조건. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4AWL6z8DwHwAAAP//A3ONEwAAAAZJREFUAwAFCgIByRpMngAAAABJRU5ErkJggg==';

async function setup(page) {
  await page.setViewportSize({ width: 1400, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate((png) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="sK" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="sK-in"></div></div>');
    const { row, block } = window.makeGridBlock({ cols: [{ width: 1, lines: [{ type: 'image', imgSrc: png, height: 160 }] }] });
    block.id = 'gK'; document.getElementById('sK-in').appendChild(row);
    window.rebindAll?.(); window.applyZoom?.(100);
  }, PNG);
  return errs;
}
const line = (page) => page.evaluate(() => window.getGridModel(document.getElementById('gK')).cells[0][0].lines[0]);
const lineH = (page) => page.evaluate(() => { const e = document.querySelector('#gK .grd-cell [data-line="0"]'); return e ? e.offsetHeight : null; });   // 레이아웃 px(전환 중 rect 안 씀)

test('R0 [전제·새 것] image(h160) → body → gap 을 MCP 문으로 — 모델에 height 없음 · gap 줄 16px', async ({ page }) => {
  const errs = await setup(page);
  const r1 = await page.evaluate(() => window.updateGridBlock('gK', { patchCell: { r: 0, c: 0, lineIndex: 0, type: 'body', text: '바뀐 줄' } }));
  expect(r1 && r1.ok, `[전제] body 로 바꾸기 ${JSON.stringify(r1)}`).toBe(true);
  expect((await line(page)).height, '★body 로 바꿨는데 height 가 남았다').toBeUndefined();
  const r2 = await page.evaluate(() => window.updateGridBlock('gK', { patchCell: { r: 0, c: 0, lineIndex: 0, type: 'gap' } }));
  expect(r2 && r2.ok).toBe(true);
  expect(await lineH(page), '★gap 줄이 16px 이 아니다').toBe(16);
  expect(errs).toEqual([]);
});

test('R1 ★저장 → 새로 띄운 앱 → 다시 열기 — 다시 연 뒤에도 height 없음 · gap 줄 16px', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => window.updateGridBlock('gK', { patchCell: { r: 0, c: 0, lineIndex: 0, type: 'body', text: '바뀐 줄' } }));
  const snap = await page.evaluate(() => window.serializeProject());
  expect(snap, '[전제] 저장본').toContain('gK');
  const errs = await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(d), JSON.parse(snap));
  await page.evaluate(() => window.applyZoom?.(100));
  await expect.poll(() => page.evaluate(() => !!document.getElementById('gK')), { message: '[전제] 다시 연 앱에 그리드' }).toBe(true);
  const back = await line(page);
  expect(back.type, '[전제] 다시 연 줄 = body').toBe('body');
  expect(back.height, `★다시 연 저장본에 height 가 살아 있다 ${JSON.stringify(back)}`).toBeUndefined();
  const r = await page.evaluate(() => window.updateGridBlock('gK', { patchCell: { r: 0, c: 0, lineIndex: 0, type: 'gap' } }));
  expect(r && r.ok).toBe(true);
  expect(await lineH(page), '★다시 연 뒤 gap 으로 바꾸니 16px 이 아니다(지운 줄 알았던 그림 높이)').toBe(16);
  expect(errs).toEqual([]);
});
