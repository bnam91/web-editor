/* asset-del-edit-clone-1116 — 현빈 261116 NEW-현빈QA-ASSET-BLOCK-CANNOT-DELETE-01 «ab_6jh6q_afh0r8q 삭제가 안 된다»
 * 원인(시험 프로젝트 사본 proj_1794752916029 로 좁힘): 그 블럭은 바로 앞 에셋의 ⌘D 사본이고, 속이 clearAssetImage 가 쓰는 꼴
 *   (`\n    <div class="asset-overlay" …>`)이었다 — ⌫ 가 블럭을 지우지 않고 «그림을 비웠다». 같은 그림을 쓰는 형제 셋 중 혼자 img 0.
 *   그림 편집 중 ⌘D 는 outerHTML 째 담아 사본이 `img-editing` 표만 품고 온다(짝 플래그 _imgEditing 은 JS 속성이라 안 온다).
 *   표만 있는 사본은 exitImageEditMode 가 못 푼다(플래그부터 본다) → deleteSelectedFromCanvas 의 `.asset-block.img-editing` 갈래가
 *   ⌫ 마다 그 사본을 잡는다: 첫 ⌫ = 그림 비우기 · 다음부터 = 삼킴. 그 세션 동안 «어느 블럭을 골라도» ⌫ 가 안 지운다.
 * 고침(js/editor.js _bindPastedEl — ⌘V 전 갈래·⌘D 가 지나는 한 문): 붙는 트리에서 img-editing 표를 뗀다.
 * 칸
 *   D1 편집 중 ⌘D → Esc → 캔버스에 img-editing 0(사본이 표를 안 품는다)
 *   D2 이어서 사본 클릭 → ⌫ → 사본이 지워진다(에셋 2→1) · 원본 그림 그대로
 *   D3 [지킴] 진짜 편집 모드의 ⌫ 는 그대로 «그 칸 그림 비우기»(블럭은 남는다)
 * 양성대조: CTL — _bindPastedEl 의 img-editing 떼기 줄 삭제 → D1 빨강(1) · D2 빨강(에셋 2 그대로 · 사본 그림만 사라짐). D3 는 초록(지킴).
 * 안 잰 것: ⌘C(편집 중)→⌘V — 같은 문(_bindPastedEl)을 지나지만 하네스 OS 클립보드 다리 때문에 안 밟았다 · 실앱(일렉트론) · 아이콘원형 편집(icb) 사본.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/* 대기는 «조건»으로만(dom-fixed-wait-census) — f2 = 두 프레임 · until = 기대 상태를 최대 2초 기다린 뒤 «그래도» 단언한다. */
const f2 = (p) => p.waitForFunction(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const until = async (page, fn, arg) => { await page.waitForFunction(fn, arg, { timeout: 2000 }).catch(() => {}); await f2(page); };

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  const a1 = await page.evaluate(() => {
    const cv = document.createElement('canvas'); cv.width = 400; cv.height = 200; const g = cv.getContext('2d'); g.fillStyle = '#3366cc'; g.fillRect(0, 0, 400, 200);
    const SRC = cv.toDataURL('image/png');
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="sD" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="sD-in"><div class="gap-block" data-type="gap" style="height:30px"></div></div></div>`);
    window.rebindAll?.(); window.applyZoom?.(60);
    const sec = document.getElementById('sD');
    window.deselectAll?.(); window.selectSection?.(sec);
    const before = new Set([...document.querySelectorAll('#canvas .asset-block')].map(e => e.id));
    window.addAssetBlock();
    const ab = [...document.querySelectorAll('#canvas .asset-block')].find(e => !before.has(e.id));
    window.setAssetImageFromSrc(ab, SRC);
    window.deselectAll?.();
    return ab.id;
  });
  await page.waitForFunction(() => [...document.querySelectorAll('#sD img')].every(i => i.complete && i.naturalWidth > 0));
  await f2(page);
  return { errs, a1 };
}
const center = (page, id) => page.evaluate((id) => { const el = document.getElementById(id); el.scrollIntoView({ block: 'center' });
  const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, id);
const st = (page) => page.evaluate(() => ({
  assets: [...document.querySelectorAll('#canvas .asset-block')].map(a => ({ id: a.id, img: a.classList.contains('has-image'), editing: a.classList.contains('img-editing') })),
  editing: document.querySelectorAll('#canvas .img-editing').length,
}));

/* 원본 고름 → 더블클릭(편집 모드) → ⌘D → Esc. 사본 id 를 돌려준다. */
async function dupInEdit(page, a1) {
  const c = await center(page, a1);
  await page.mouse.click(c.x, c.y); await until(page, (id) => document.getElementById(id).classList.contains('selected'), a1);
  await page.mouse.dblclick(c.x, c.y); await until(page, (id) => document.getElementById(id).classList.contains('img-editing'), a1);
  expect(await page.evaluate((id) => document.getElementById(id).classList.contains('img-editing'), a1), '[전제] 더블클릭으로 편집 모드').toBe(true);
  await page.keyboard.press('Meta+d');
  await until(page, () => document.querySelectorAll('#canvas .asset-block').length === 2);
  const s = await st(page);
  expect(s.assets.length, '[전제] 편집 중 ⌘D 가 사본을 만든다').toBe(2);
  await page.keyboard.press('Escape');
  await until(page, (id) => !document.getElementById(id).classList.contains('img-editing'), a1);
  expect(await page.evaluate((id) => document.getElementById(id).classList.contains('img-editing'), a1), '[전제] Esc 로 원본 편집 끝').toBe(false);
  return s.assets.find(a => a.id !== a1).id;
}

test('D1·D2 편집 중 ⌘D 사본 — img-editing 표 0 · 사본 ⌫ = 지워진다(그림만 비우고 남지 않는다)', async ({ page }) => {
  const { errs, a1 } = await scene(page);
  const dup = await dupInEdit(page, a1);
  expect((await st(page)).editing, 'D1 — Esc 뒤에도 캔버스에 img-editing 이 남았다(사본이 표를 품고 왔다)').toBe(0);
  const c = await center(page, dup);
  await page.mouse.click(c.x, c.y); await until(page, (id) => document.getElementById(id)?.classList.contains('selected'), dup);
  expect(await page.evaluate((id) => document.getElementById(id).classList.contains('selected'), dup), '[전제] 사본 고름').toBe(true);
  await page.keyboard.press('Backspace');
  await until(page, (id) => !document.getElementById(id), dup);
  const s = await st(page);
  expect(s.assets.map(a => a.id), 'D2 — ⌫ 뒤 사본이 남았다(그림만 비웠다)').toEqual([a1]);
  expect(s.assets[0].img, 'D2 — 원본 그림은 그대로').toBe(true);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('D3 [지킴] 진짜 편집 모드의 ⌫ = 그 칸 그림 비우기 · 블럭은 남는다', async ({ page }) => {
  const { errs, a1 } = await scene(page);
  const c = await center(page, a1);
  await page.mouse.click(c.x, c.y); await until(page, (id) => document.getElementById(id).classList.contains('selected'), a1);
  await page.mouse.dblclick(c.x, c.y); await until(page, (id) => document.getElementById(id).classList.contains('img-editing'), a1);
  expect((await st(page)).editing, '[전제] 편집 모드').toBe(1);
  await page.keyboard.press('Backspace');
  await until(page, (id) => !document.getElementById(id).classList.contains('has-image'), a1);
  const s = await st(page);
  expect(s.assets, '편집 모드 ⌫ — 블럭은 남고 그림만 빈다').toEqual([{ id: a1, img: false, editing: false }]);
  expect(errs, errs.join('\n')).toEqual([]);
});
