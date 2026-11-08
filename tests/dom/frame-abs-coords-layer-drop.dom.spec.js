/* frame-abs-coords-layer-drop.dom.spec.js — FRAME-ABSOLUTE-COORDS-IN-STACK-SECTION-01 (현빈 0.9.10 QA)
 *   결함: 섹션 흐름 자식인 프레임이 position:absolute·left·top 을 들고 섹션 밖으로 삐져나감(현빈 실측 860×520 · top:704px).
 *   재현된 길: 자유 프레임 안 자식 프레임을 «레이어 패널»에서 섹션 흐름 자리로 끌어 놓기 — 좌표를 안 걷었다
 *     (캔버스 끌어내기·붙여넣기·그룹 풀기는 이미 걷는다).
 *   A1 레이어 끌기(진짜 HTML5 끌기) 뒤: 부모 = section-inner · position·left·top 없음 · offsetX/Y 없음 · 섹션이 그 프레임을 담는다(밖으로 안 나감)
 *   A2 ⌘Z 한 번 = 자유 프레임 안 원래 자리(좌표 그대로)
 *   A3 음성대조: 자유 프레임 «안»에서 순서만 바꾸는 경우는 없음(이 길은 섹션 흐름 전용) · 섹션 직속 스티커(dataset.x/y)는 레이어로 옮겨도 absolute 유지
 *   ⛔이미 저장된 문서 자동 바로잡기는 안 한다(현빈 결정) — 검사도 안 잰다.
 * ★양성대조: layer-panel.js insertIntoSec 의 _dropFreeCoords 를 빼면 A1 빨강(재현 그대로 · top:704px). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="sA" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="inA">
      <div class="gap-block" id="g0" data-type="gap" style="height:40px"></div>
      <div class="row" id="rF" data-layout="stack"><div class="frame-block" id="F" data-free-layout="true" style="width:860px;height:900px;position:relative;">
        <div class="frame-block" id="C" data-offset-x="0" data-offset-y="704" style="position:absolute;left:0px;top:704px;width:860px;height:520px;background:#abc"><div class="gap-block" data-type="gap" style="height:40px"></div></div>
      </div></div>
      <div class="gap-block" id="gEnd" data-type="gap" style="height:40px"></div></div></div>`);
    window.rebindAll(); window.deselectAll(); window.buildLayerPanel(); window.clearHistory?.();
  });
}
const state = (page) => page.evaluate(() => {
  const C = document.getElementById('C'), S = document.getElementById('sA');
  const c = C.getBoundingClientRect(), s = S.getBoundingClientRect();
  return { parent: C.parentElement.id, pos: C.style.position, left: C.style.left, top: C.style.top, ox: C.dataset.offsetX ?? null, oy: C.dataset.offsetY ?? null, inside: c.bottom <= s.bottom + 0.5 && c.top >= s.top - 0.5 };
});
/** 레이어 패널에서 C 줄을 섹션 끝(gEnd 줄 위)으로 진짜 HTML5 끌기 */
async function dragCToFlow(page) {
  // C 줄 = _dragTarget 이 C 인 그룹 — 표식을 달아 찾는다
  await page.evaluate(() => document.querySelectorAll('#layer-panel-body .collapsed').forEach(el => el.classList.remove('collapsed')));   // 사람이 펼친 것과 같다
  await page.evaluate(() => { const g = [...document.querySelectorAll('#layer-panel-body .layer-row-group')].find(el => el._dragTarget?.id === 'C'); g.querySelector(':scope > .layer-row-header').id = 'lpC';
    const e = [...document.querySelectorAll('#layer-panel-body .layer-item')].find(el => el._dragTarget?.id === 'gEnd'); e.id = 'lpEnd'; });
  await page.locator('#lpC').dragTo(page.locator('#lpEnd'), { targetPosition: { x: 20, y: 2 } });
}

test('A1·A2 레이어로 자유 프레임 자식 프레임을 섹션 흐름에 놓으면 좌표를 걷는다 · ⌘Z 한 번 = 원래 자리', async ({ page }) => {
  await setup(page);
  expect(await state(page), '[전제] 자유 프레임 안 · absolute · 섹션 밖으로 삐져나감(현빈 실측 꼴)').toEqual({ parent: 'F', pos: 'absolute', left: '0px', top: '704px', ox: '0', oy: '704', inside: false });
  await dragCToFlow(page);
  await expect.poll(async () => (await state(page)).parent, '섹션 흐름으로 나왔다').toBe('inA');
  expect(await state(page)).toEqual({ parent: 'inA', pos: '', left: '', top: '', ox: null, oy: null, inside: true });
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Meta+z');
  await expect.poll(() => state(page)).toEqual({ parent: 'F', pos: 'absolute', left: '0px', top: '704px', ox: '0', oy: '704', inside: false });
});

test('A3 음성대조 — 섹션 직속 스티커(dataset.x/y)는 레이어로 옮겨도 absolute 그대로', async ({ page }) => {
  await setup(page);
  const sid = await page.evaluate(() => { window.selectSection(document.getElementById('sA')); window.addStickerBlock({ count: '1', x: 100, y: 100 });
    const s = document.querySelector('#sA .sticker-block'); window.deselectAll(); window.buildLayerPanel(); return s.id; });
  const before = await page.evaluate((id) => { const s = document.getElementById(id); return { pos: s.style.position || getComputedStyle(s).position, x: s.dataset.x }; }, sid);
  await page.evaluate(() => document.querySelectorAll('#layer-panel-body .collapsed').forEach(el => el.classList.remove('collapsed')));
  await page.evaluate((id) => { const it = [...document.querySelectorAll('#layer-panel-body *')].find(el => el._dragTarget?.id === id); if (it) it.id = 'lpS';
    const e = [...document.querySelectorAll('#layer-panel-body .layer-item')].find(el => el._dragTarget?.id === 'g0'); e.id = 'lpG0'; }, sid);
  await expect(page.locator('#lpS'), '[전제] 스티커 레이어 줄이 있다').toHaveCount(1);
  await page.locator('#lpS').dragTo(page.locator('#lpG0'), { targetPosition: { x: 20, y: 2 } });
  const after = await page.evaluate((id) => { const s = document.getElementById(id); return { pos: s.style.position || getComputedStyle(s).position, x: s.dataset.x }; }, sid);
  expect(after).toEqual(before);
});
