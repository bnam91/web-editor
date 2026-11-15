/* anim-gif-play-canvas — PLAY-ON-CANVAS-01(현빈: «캔버스에서 그대로 적용되게 만드는 옵션 … gif 효과가 섹션에서 어울리는지 보기 위해서»).
 * ★잰다: 실제 텍스트 블럭 · 실제 모달 · 진짜 «캔버스에서 보기» 단추 클릭 · 진짜 키보드 Esc · 진짜 마우스 클릭 · 실제 배율(applyZoom).
 * P1 단추 → 모달 닫힘 · 덮개 #anim-canvas-play 하나 · #canvas 밖(body) · 블럭 자리에 붙음 · 재생 중 serializeProject·캔버스 HTML·이력 무변 ·
 *    배율 50% 로 바꿔도 블럭 자리를 따라감 · Esc → 덮개 0 · 캔버스 HTML·이력 그대로(Esc 는 멈춤에만 — 아이맥 001ae0374+C9 첫 판은 Esc 가 선택 해제까지 타서 2줄 다름) · pageerror 0
 * P2 재생 중 캔버스 위 마우스 클릭 → 덮개 0 · 캔버스 HTML 그대로(그 클릭은 멈춤에만 쓰인다 — 선택 해제 0)
 * 양성대조(예측): js/animation-engine.js playAnimOnCanvas 의 `document.body.appendChild(cv)` → `tb.appendChild(cv)` → P1 빨강(#canvas 안 · 저장에 섞임 · 캔버스 HTML 바뀜) · 단위 E14 도
 * 셀렉터·전역 대조(제품 소스 grep): .anim-play-canvas-btn(index.html 모달 꼬리) · #anim-canvas-play(animation-engine.js playAnimOnCanvas cv.id) · #anim-gif-modal ·
 *   window.serializeProject(save-load.js:3299) · window.historyStack(history.js 읽기 전용) · window.applyZoom(editor.js:5275 · % 단위 — _t905-ops 의 applyZoom(30)) ·
 *   window.addSection · window.selectSection(editor.js:5271) · window.addTextBlock · window.openAnimModal(엔진 끝)
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    window.selectSection(c.querySelector('.section-block'));
    window.addTextBlock('body');
    const tb = [...c.querySelectorAll('.text-block')].pop();
    const ce = tb.querySelector('[contenteditable]') || tb.querySelector('.tb-body');
    ce.innerHTML = '캔버스에서 보기 <span style="color: rgb(255, 0, 0)">빨강</span>';
    window.__tb = tb;
    window.openAnimModal(tb);
  });
  return errs;
}
const snap = (page) => page.evaluate(() => ({ html: document.getElementById('canvas').innerHTML, hist: window.historyStack.length, ser: window.serializeProject() }));
/** 두 HTML 의 첫 다른 줄(실패 메시지용 — 무엇이 바뀌었는지 바로 보이게). */
const firstDiff = (a, b) => { const x = a.split('\n'), y = b.split('\n'); for (let i = 0; i < Math.max(x.length, y.length); i++) if (x[i] !== y[i]) return `줄 ${i}: «${(x[i] || '').trim().slice(0, 200)}» → «${(y[i] || '').trim().slice(0, 200)}»`; return '같음'; };
const overlayVsBlock = (page) => page.evaluate(() => {
  const cv = document.getElementById('anim-canvas-play'), a = cv && cv.getBoundingClientRect(), b = window.__tb.getBoundingClientRect();
  return cv ? Math.max(Math.abs(a.left - b.left), Math.abs(a.top - b.top), Math.abs(a.width - b.width), Math.abs(a.height - b.height)) : -1;
});

test('P1 캔버스에서 보기 — 덮개는 #canvas 밖 · 블럭 자리 · 저장·캔버스 HTML·이력 무변 · 배율 따라감 · Esc 원상', async ({ page }) => {
  const errs = await scene(page);
  await page.click('#anim-gif-modal .anim-play-canvas-btn');   // 견줌 기준 = 재생 «중» 스냅(모달 닫기 자체의 저장 몫과 섞지 않는다)
  await expect(page.locator('#anim-gif-modal')).toBeHidden();
  await expect(page.locator('#anim-canvas-play')).toHaveCount(1);
  expect(await page.evaluate(() => !document.getElementById('anim-canvas-play').closest('#canvas')), '★덮개가 #canvas 안').toBe(true);
  await expect.poll(() => overlayVsBlock(page), { message: '덮개 = 블럭 자리' }).toBeLessThanOrEqual(1);
  const during = await snap(page);
  expect(during.ser.includes('anim-canvas-play'), '★저장에 덮개가 섞였다').toBe(false);
  await page.evaluate(() => window.applyZoom(50));
  await expect.poll(() => overlayVsBlock(page), { message: '★배율을 바꾸니 덮개가 블럭 자리에서 떨어졌다' }).toBeLessThanOrEqual(1);
  await page.evaluate(() => window.applyZoom(100));
  await expect.poll(() => overlayVsBlock(page)).toBeLessThanOrEqual(1);
  const before = await snap(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('#anim-canvas-play'), '★Esc 로 안 멈춘다').toHaveCount(0);
  const after = await snap(page);
  expect(after.html === before.html, `★Esc 가 멈춤 말고 에디터까지 탔다 — ${firstDiff(before.html, after.html)}`).toBe(true);
  expect(after.hist, '이력 무변(재생 시작 직후와 Esc 뒤)').toBe(during.hist);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('P2 재생 중 마우스 클릭 → 멈춤', async ({ page }) => {
  const errs = await scene(page);
  await page.click('#anim-gif-modal .anim-play-canvas-btn');
  await expect(page.locator('#anim-canvas-play')).toHaveCount(1);
  const before = await snap(page);
  const box = await page.evaluate(() => { const r = document.getElementById('canvas').getBoundingClientRect(); return { x: r.left + 5, y: r.top + 5 }; });
  await page.mouse.click(box.x, box.y);   // 캔버스 위 클릭 — 멈춤만 하고 선택 해제 등은 안 탄다
  await expect(page.locator('#anim-canvas-play'), '★클릭으로 안 멈춘다').toHaveCount(0);
  const after = await snap(page);
  expect(after.html === before.html, `★클릭이 멈춤 말고 에디터까지 탔다 — ${firstDiff(before.html, after.html)}`).toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});
