/* image-edit-ghost-q12 — 현빈 261112 Q12 = E1 (IMAGE-EDIT-MODE-RESIZE-CLIPPED-AGAIN-01):
 *   에셋·그리드 크롭 «이미지 편집 모드»에서 크기를 키우면 틀 밖이 흐린 고스트로 보인다(Figma 크롭식) — 배경 편집 고스트(.sec-bg-ghost-wrap) 재사용.
 *   G1 섹션 직속 에셋 — 실더블클릭 진입 · 폭 ×2 → 틀 밖 점이 그림 색으로 물든다 · 고스트 1 · 나가면 고스트 0 · 점이 바탕으로 돌아온다
 *   G2 프레임 안 에셋(조상 프레임이 자른다) — 고스트가 오버레이라 프레임 밖에서도 보인다
 *   G3 그리드 크롭 줄 — 편집 중 고스트 1 · Esc 뒤 0
 *   G4 [지킴] 섹션 배경 편집 — 고스트는 배경 것 하나뿐(편집기 고스트가 겹으로 안 선다)
 *   G5 편집 «중» 저장·내보내기에 고스트 0 — 페이지 저장 꼴(flushCurrentPage) · 단독 HTML 본문
 * 자 = 픽셀(1×1 스크린샷을 페이지 캔버스로 풀어 RGB) — 바탕 = 회색 · 그림 = #3366cc · 고스트(0.42) = 둘의 섞임(파랑 쪽).
 * 양성대조: ㉮ image-handling.js enterImageEditMode 의 `_ghostSrc` 를 '' 로 → G1·G2·G3 빨강 · ㉯ `_imgEditCleanup` 의 `ghostWrap?.remove()` 와 exit 의 `.img-edit-ghost` 쓸기 둘 다 삭제 → G1(나간 뒤)·G3(Esc 뒤) 빨강
 *   · ㉰ 배경 편집 호출의 `noGhost: true` 삭제 → G4 빨강. G5 는 늘 초록(오버레이는 #canvas 밖 — 회귀 지킴).
 * 안 잰 것: 회전한 그림의 고스트 각 · 영상 에셋(고스트 안 만듦) · 실앱(일렉트론).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1300 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(async () => {
    const cv = document.createElement('canvas'); cv.width = 400; cv.height = 200; const g = cv.getContext('2d'); g.fillStyle = '#3366cc'; g.fillRect(0, 0, 400, 200);
    const SRC = cv.toDataURL('image/png');
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="sG" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="sG-in"><div class="gap-block" data-type="gap" style="height:30px"></div></div></div>`);
    window.rebindAll?.(); window.applyZoom?.(60);
    const sec = document.getElementById('sG');
    const made = (sel, fn) => { const b = new Set([...document.querySelectorAll('#canvas ' + sel)].map(e => e.id)); fn(); return [...document.querySelectorAll('#canvas ' + sel)].find(e => !b.has(e.id)); };
    window.deselectAll?.(); window.selectSection?.(sec);
    const a1 = made('.asset-block', () => window.addAssetBlock()); window.setAssetImageFromSrc(a1, SRC);
    window.deselectAll?.(); window.selectSection?.(sec);
    const fr = made('.frame-block:not([data-text-frame])', () => window.addFrameBlock({ bg: '#FFFFFF' }));
    window.deselectAll?.(); window._activeFrame = fr;
    const a2 = made('.asset-block', () => window.addAssetBlock()); window.setAssetImageFromSrc(a2, SRC);
    const gr = window.makeGridBlock({ cols: [{ width: 1, lines: [{ type: 'image', height: 160, imgSizePct: 150, imgPosX: -10, imgPosY: -10, imgSrc: SRC }] }, { width: 1, lines: [{ type: 'body', text: '옆 칸' }] }] });
    gr.block.id = 'gG'; document.getElementById('sG-in').appendChild(gr.row);
    sec.dataset.bgImg = SRC;
    window.rebindAll?.(); window.deselectAll?.(); window._activeFrame = null;
    return { a1: a1.id, a2: a2.id, fr: fr.id };
  });
  await page.waitForFunction(() => [...document.querySelectorAll('#sG img')].every(i => i.complete && i.naturalWidth > 0));
  await page.waitForTimeout(400);
  return { errs, ids };
}
async function pix(page, x, y) {
  const b = await page.screenshot({ clip: { x: Math.round(x), y: Math.round(y), width: 1, height: 1 } });
  return page.evaluate(async (b64) => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
    const c = document.createElement('canvas'); c.width = c.height = 1; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return [...g.getImageData(0, 0, 1, 1).data].slice(0, 3); }, b.toString('base64'));
}
const outside = (page, id) => page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.right + 12, r.top + r.height / 2]; }, id);
const blueish = (p) => p[2] - p[0] >= 40;   // 그림(#3366cc)이 섞였다 — 바탕 회색은 b−r ≈ 0
const ghosts = (page) => page.evaluate(() => ({ edit: document.querySelectorAll('.img-edit-ghost').length,
  bg: document.querySelectorAll('.sec-bg-ghost-wrap:not(.img-edit-ghost)').length, inCanvas: document.querySelectorAll('#canvas .sec-bg-ghost, #canvas .img-edit-ghost').length }));
const growX2 = (page) => page.evaluate(() => { const w = document.getElementById('img-w'); if (!w) return false;
  w.value = String(Math.round(+w.value * 2)); w.dispatchEvent(new Event('input', { bubbles: true })); w.dispatchEvent(new Event('change', { bubbles: true })); return true; });

test('G1 섹션 에셋 — 실더블클릭 · 폭 ×2 → 틀 밖에 흐린 고스트 · 나가면 0', async ({ page }) => {
  const { errs, ids } = await scene(page);
  await page.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'center' }), ids.a1); await page.mouse.move(2, 2); await page.waitForTimeout(200);
  const p0 = await pix(page, ...await outside(page, ids.a1));
  expect(blueish(p0), `[전제] 편집 전 틀 밖은 바탕 ${p0}`).toBe(false);
  const c = await page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, ids.a1);
  await page.mouse.click(c.x, c.y); await page.waitForTimeout(300); await page.mouse.dblclick(c.x, c.y); await page.waitForTimeout(500);
  expect(await page.evaluate((id) => document.getElementById(id).classList.contains('img-editing'), ids.a1), '[전제] 더블클릭으로 편집 모드').toBe(true);
  expect(await growX2(page), '[전제] 너비 칸').toBe(true); await page.mouse.move(2, 2); await page.waitForTimeout(300);
  expect((await ghosts(page)).edit, '편집 중 고스트가 없다').toBe(1);
  const p1 = await pix(page, ...await outside(page, ids.a1));
  expect(blueish(p1), `편집 중 틀 밖이 그림으로 안 물들었다 ${p1}`).toBe(true);
  await page.evaluate((id) => window.exitImageEditMode(document.getElementById(id)), ids.a1); await page.waitForTimeout(250);
  expect(await ghosts(page), '나간 뒤 고스트가 남았다').toEqual({ edit: 0, bg: 0, inCanvas: 0 });
  const p2 = await pix(page, ...await outside(page, ids.a1));
  expect(blueish(p2), `나간 뒤에도 틀 밖이 물들어 있다 ${p2}`).toBe(false);
  expect(errs).toEqual([]);
});

test('G2 프레임 안 에셋 — 조상 프레임이 잘라도 고스트는 프레임 밖에 보인다', async ({ page }) => {
  const { ids } = await scene(page);
  await page.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'center' }), ids.a2); await page.mouse.move(2, 2); await page.waitForTimeout(200);
  const [x, y] = await outside(page, ids.a2);
  expect(await page.evaluate(({ x, fr }) => x > document.getElementById(fr).getBoundingClientRect().right, { x, fr: ids.fr }), '[전제] 잴 점이 프레임 밖').toBe(true);
  await page.evaluate((id) => window.enterImageEditMode(document.getElementById(id)), ids.a2);   // 프레임 안 진입 제스처(B안)는 frame-dblclick-overlay 몫 — 여기선 편집기만
  await growX2(page); await page.mouse.move(2, 2); await page.waitForTimeout(300);
  const p = await pix(page, x, y);
  expect(blueish(p), `프레임 밖 점이 안 물들었다 ${p}`).toBe(true);
  await page.evaluate((id) => window.exitImageEditMode(document.getElementById(id)), ids.a2);
});

test('G3 그리드 크롭 줄 — 편집 중 고스트 1 · Esc 뒤 0', async ({ page }) => {
  await scene(page);
  await page.evaluate(() => { const b = document.getElementById('gG'); b.scrollIntoView({ block: 'center' }); window.enterGridImageEditMode(b, { r: 0, c: 0, li: 0 }); });
  await page.waitForTimeout(400);
  expect((await ghosts(page)).edit).toBe(1);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  expect(await ghosts(page)).toEqual({ edit: 0, bg: 0, inCanvas: 0 });
});

test('G4 [지킴] 섹션 배경 편집 — 고스트는 배경 것 하나뿐', async ({ page }) => {
  await scene(page);
  await page.evaluate(() => window.enterSectionBgEditMode(document.getElementById('sG'))); await page.waitForTimeout(400);
  expect(await ghosts(page), '배경 편집에 편집기 고스트가 겹으로 섰다').toEqual({ edit: 0, bg: 1, inCanvas: 0 });
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  expect(await ghosts(page)).toEqual({ edit: 0, bg: 0, inCanvas: 0 });
});

test('G5 편집 중 저장·내보내기에 고스트 0', async ({ page }) => {
  const { ids } = await scene(page);
  await page.evaluate((id) => window.enterImageEditMode(document.getElementById(id)), ids.a1);
  await growX2(page); await page.waitForTimeout(200);
  expect((await ghosts(page)).edit, '[전제] 고스트가 서 있다').toBe(1);
  const saved = await page.evaluate(() => { window.flushCurrentPage?.(); return /sec-bg-ghost|img-edit-ghost/.test(JSON.stringify(window.getCurrentPage?.() || {})); });
  expect(saved, '페이지 저장 꼴에 고스트가 실렸다').toBe(false);
  const body = await page.evaluate(async () => { const OB = window.Blob, oc = HTMLAnchorElement.prototype.click; let b = null; HTMLAnchorElement.prototype.click = function () {};
    window.Blob = function (p, o) { b = (p || []).join(''); return new OB(p, o); }; try { await window.exportHTMLFile(); } catch (e) { b = 'THREW:' + (e && e.message); } window.Blob = OB; HTMLAnchorElement.prototype.click = oc; return b; });
  expect(String(body).startsWith('THREW'), '내보내기가 던졌다').toBe(false);
  expect(/sec-bg-ghost|img-edit-ghost/.test(String(body)), '단독 HTML 에 고스트가 실렸다').toBe(false);
  await page.evaluate((id) => window.exitImageEditMode(document.getElementById(id)), ids.a1);
});
