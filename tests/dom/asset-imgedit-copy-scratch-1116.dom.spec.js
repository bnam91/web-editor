/* asset-imgedit-copy-scratch-1116 — 현빈 261116 NEW-현빈QA-ASSET-CONTENT-COPY-PASTE-TO-SCRATCH-01
 *   에셋 그림 편집 모드(더블클릭) 안에서 ⌘C → 편집 모드 나와서 ⌘V = 새 에셋 블럭이 생겼다 → «스크래치 패드에 그 그림»으로.
 * 고침(js/editor.js): ⌘C 갈래가 copySelected 뒤 _markImgEditCopy — 편집 중 에셋이면 clipboard 를 {type:'img-edit', src, w} 로 표시.
 *   pasteClipboard 첫머리가 그 표시를 보고 _pasteImgEditToScratch(window._scratchAddAndSave)로 간다. src = dataset 주소 그대로.
 * 칸
 *   S1 편집 중 ⌘C → Esc → ⌘V = 에셋 블럭 수 그대로 · 스크래치 항목 +1 · 그 항목 src = 에셋의 goya-asset 주소 «그대로»(data URL 아님)
 *   S2 [지킴] 평소(편집 아님) ⌘C → ⌘V = 옛 그대로 캔버스에 에셋 사본 · 스크래치 +0
 * 양성대조: CTL — ⌘C 갈래의 `_markImgEditCopy();` 줄 삭제 → S1 빨강(에셋 1→2 · 스크래치 +0). S2 는 초록(지킴).
 * 안 잰 것: 실앱(일렉트론)·실 goya-asset 그림 표시(하네스는 그 주소를 못 읽어 항목이 scratch-missing 으로 뜬다 — 주소 문자열만 잰다) ·
 *   바깥 앱 이미지가 OS 클립보드에서 더 최신인 경우(옛 규칙 clipboardPrefersInternal 그대로) · ⌘Z(스크래치 붙여넣기는 원래 이력을 안 쌓는다).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/* 대기는 «조건»으로만(dom-fixed-wait-census) — until = 기대 상태를 최대 2초 기다린 뒤 «그래도» 단언한다. */
const f2 = (p) => p.waitForFunction(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const until = async (page, fn, arg) => { await page.waitForFunction(fn, arg, { timeout: 2000 }).catch(() => {}); await f2(page); };
const GOYA = 'goya-asset://proj_test1116/abc123def4567890.png';

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  const a1 = await page.evaluate((goya) => {
    const cv = document.createElement('canvas'); cv.width = 400; cv.height = 200; const g = cv.getContext('2d'); g.fillStyle = '#3366cc'; g.fillRect(0, 0, 400, 200);
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="sS" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="sS-in"><div class="gap-block" data-type="gap" style="height:30px"></div></div></div>`);
    window.rebindAll?.(); window.applyZoom?.(60);
    window.deselectAll?.(); window.selectSection?.(document.getElementById('sS'));
    const before = new Set([...document.querySelectorAll('#canvas .asset-block')].map(e => e.id));
    window.addAssetBlock();
    const ab = [...document.querySelectorAll('#canvas .asset-block')].find(e => !before.has(e.id));
    window.setAssetImageFromSrc(ab, cv.toDataURL('image/png'));
    ab.dataset.imgSrc = goya;   // 저장된 프로젝트 꼴 — 정본 주소는 dataset(그림은 하네스가 읽을 수 있는 data URL 로 보인다)
    window.deselectAll?.();
    return ab.id;
  }, GOYA);
  await page.waitForFunction(() => [...document.querySelectorAll('#sS img')].every(i => i.complete && i.naturalWidth > 0));
  await f2(page);
  return { errs, a1 };
}
const center = (page, id) => page.evaluate((id) => { const el = document.getElementById(id); el.scrollIntoView({ block: 'center' });
  const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, id);
const st = (page) => page.evaluate(() => ({
  assets: document.querySelectorAll('#canvas .asset-block').length,
  scratch: [...document.querySelectorAll('.scratch-item img')].map(i => i.getAttribute('src')),
}));

test('S1 편집 중 ⌘C → Esc → ⌘V = 스크래치에 그 그림(goya 주소 그대로) · 에셋 블럭은 안 는다', async ({ page }) => {
  const { errs, a1 } = await scene(page);
  const c = await center(page, a1);
  await page.mouse.click(c.x, c.y); await until(page, (id) => document.getElementById(id).classList.contains('selected'), a1);
  await page.mouse.dblclick(c.x, c.y); await until(page, (id) => document.getElementById(id).classList.contains('img-editing'), a1);
  expect(await page.evaluate((id) => document.getElementById(id).classList.contains('img-editing'), a1), '[전제] 더블클릭으로 편집 모드').toBe(true);
  const s0 = await st(page);
  await page.keyboard.press('Meta+c');
  await page.keyboard.press('Escape');
  await until(page, (id) => !document.getElementById(id).classList.contains('img-editing'), a1);
  expect(await page.evaluate((id) => document.getElementById(id).classList.contains('img-editing'), a1), '[전제] Esc 로 편집 끝').toBe(false);
  await page.keyboard.press('Meta+v');
  await until(page, (n) => document.querySelectorAll('.scratch-item').length > n || document.querySelectorAll('#canvas .asset-block').length > 1, s0.scratch.length);
  const s1 = await st(page);
  expect(s1.assets, '편집 중 복사를 붙였더니 캔버스에 에셋 블럭이 생겼다').toBe(s0.assets);
  expect(s1.scratch.length, '스크래치 항목이 안 늘었다').toBe(s0.scratch.length + 1);
  expect(s1.scratch[s1.scratch.length - 1], '스크래치 항목 src = 에셋 정본 주소 그대로(data URL 로 바꾸지 않는다)').toBe(GOYA);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('S2 [지킴] 평소 ⌘C → ⌘V = 캔버스에 에셋 사본 · 스크래치 +0', async ({ page }) => {
  const { errs, a1 } = await scene(page);
  const c = await center(page, a1);
  await page.mouse.click(c.x, c.y); await until(page, (id) => document.getElementById(id).classList.contains('selected'), a1);
  const s0 = await st(page);
  expect(s0.assets, '[전제] 에셋 1').toBe(1);
  await page.keyboard.press('Meta+c');
  await page.keyboard.press('Meta+v');
  await until(page, () => document.querySelectorAll('#canvas .asset-block').length === 2);
  const s1 = await st(page);
  expect(s1.assets, '평소 붙여넣기가 캔버스 사본을 안 만들었다').toBe(2);
  expect(s1.scratch.length, '평소 붙여넣기가 스크래치로 샜다').toBe(s0.scratch.length);
  expect(errs, errs.join('\n')).toEqual([]);
});
