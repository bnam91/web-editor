/* asset-imgedit-copy-scratch-1116 — 현빈 261116 NEW-현빈QA-ASSET-CONTENT-COPY-PASTE-TO-SCRATCH-01
 *   에셋 그림 편집 모드(더블클릭) 안에서 ⌘C → 편집 모드 나와서 ⌘V = 새 에셋 블럭이 생겼다 → «스크래치 패드에 그 그림»으로.
 * 고침(js/editor.js): ⌘C 갈래가 copySelected 뒤 _markImgEditCopy — 편집 중 에셋이면 clipboard 를 {type:'img-edit', src, w} 로 표시.
 *   pasteClipboard 첫머리가 그 표시를 보고 _pasteImgEditToScratch(window._scratchAddAndSave)로 간다. src = dataset 주소 그대로.
 * 칸
 *   S1 편집 중 ⌘C → Esc → ⌘V = 에셋 블럭 수 그대로 · 스크래치 항목 +1 · 그 항목 src = 에셋의 goya-asset 주소 «그대로»(data URL 아님)
 *   S2 [지킴] 평소(편집 아님) ⌘C → ⌘V = 옛 그대로 캔버스에 에셋 사본 · 스크래치 +0
 *   S3 (현빈 261117 139행 ◑) S1 «직후» 같은 블럭 클릭 → ⌘C → ⌘V = 캔버스 사본(에셋 1→2) · 스크래치 +0.
 *      블럭을 화면(wrap) 가운데에 둔 장면(실앱 그대로 · wrap 을 직접 밀고 [전제]로 잰다). 클릭 자리 맨 위 = 블럭 을 «먼저» 단언. 옛 판은 스크래치 항목이 화면 가운데에 떨어져 그 블럭을 덮었다 →
 *      클릭이 항목을 골라 캔버스 .selected 0 → ⌘C 가 아무것도 안 담아 편집 복사 표가 남음 → 또 스크래치.
 * 양성대조: CTL — ⌘C 갈래의 `_markImgEditCopy();` 줄 삭제 → S1 빨강(에셋 1→2 · 스크래치 +0). S2 는 초록(지킴).
 *   CTL-S3 — _pasteImgEditToScratch 의 x 를 옛 «화면 가운데» 식으로 되돌림 → S3 빨강(클릭 자리 맨 위 = scratch-item). S1·S2 초록.
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

test('S3 편집 복사 → 스크래치 «직후» 같은 블럭 클릭 → ⌘C → ⌘V = 캔버스 사본 · 스크래치 +0', async ({ page }) => {
  const { errs, a1 } = await scene(page);
  // 블럭을 화면 가운데에 둘 수 있게 위아래로 긴 틈(실앱 = 긴 페이지 가운데 블럭)
  await page.evaluate((id) => { const ab = document.getElementById(id); const g = '<div class="gap-block" data-type="gap" style="height:1500px"></div>';
    const unit = ab.closest('.row') || ab; unit.insertAdjacentHTML('beforebegin', g); unit.insertAdjacentHTML('afterend', g); }, a1);
  await f2(page);
  /* 블럭 가운데 = #canvas-wrap 가운데(옛 판 놓는 식과 «같은 기준»)로 wrap 을 직접 민다.
     scrollIntoView 는 가로를 'nearest'(=안 움직임)로 둬서 블럭이 wrap 가운데에 안 왔다 — 첫 S3 가 옛 판에서도 초록이던 까닭(지디 261117 아이맥). */
  const centerInWrap = (id) => page.evaluate((id) => {
    const wrap = document.getElementById('canvas-wrap'), el = document.getElementById(id);
    let w = wrap.getBoundingClientRect(), r = el.getBoundingClientRect();
    wrap.scrollLeft += (r.left + r.width / 2) - (w.left + w.width / 2);
    wrap.scrollTop  += (r.top + r.height / 2) - (w.top + w.height / 2);
    w = wrap.getBoundingClientRect(); r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, dx: (r.left + r.width / 2) - (w.left + w.width / 2), dy: (r.top + r.height / 2) - (w.top + w.height / 2) };
  }, id);
  let c = await centerInWrap(a1);
  await f2(page);
  expect(Math.abs(c.dx) <= 4 && Math.abs(c.dy) <= 4, `[전제] 블럭 가운데가 화면(wrap) 가운데(dx ${c.dx} · dy ${c.dy})`).toBe(true);
  await page.mouse.click(c.x, c.y); await until(page, (id) => document.getElementById(id).classList.contains('selected'), a1);
  await page.mouse.dblclick(c.x, c.y); await until(page, (id) => document.getElementById(id).classList.contains('img-editing'), a1);
  expect(await page.evaluate((id) => document.getElementById(id).classList.contains('img-editing'), a1), '[전제] 더블클릭으로 편집 모드').toBe(true);
  const s0 = await st(page);
  await page.keyboard.press('Meta+c');
  await page.keyboard.press('Escape');
  await until(page, (id) => !document.getElementById(id).classList.contains('img-editing'), a1);
  await page.keyboard.press('Meta+v');
  await until(page, (n) => document.querySelectorAll('.scratch-item').length > n, s0.scratch.length);
  expect((await st(page)).scratch.length, '[전제] 편집 복사 ⌘V = 스크래치 +1(S1 과 같다)').toBe(s0.scratch.length + 1);
  // 항목 높이가 서기를 기다린다 — 그림이 뜨거나(실앱) 못 읽어 scratch-missing(하네스 · 최소 높이 80) 이 될 때까지. 그 전엔 img 최소 높이 20 뿐이라 덮는 꼴이 안 선다.
  await until(page, () => { const it = [...document.querySelectorAll('.scratch-item')].pop(); const im = it?.querySelector('img');
    return !!it && (it.classList.contains('scratch-missing') || (im?.complete && im.naturalWidth > 0)); });
  expect(await page.evaluate(() => { const it = [...document.querySelectorAll('.scratch-item')].pop(); const im = it?.querySelector('img');
    return it.classList.contains('scratch-missing') || (im.complete && im.naturalWidth > 0); }), '[전제] 스크래치 항목 높이가 섰다(그림 뜸 또는 scratch-missing)').toBe(true);
  // 같은 블럭 다시 — 스크롤은 안 건드리고 자리만 다시 잰다 · 클릭 자리의 맨 위 요소를 «먼저» 단언한다(옛 판 = scratch-item)
  c = await page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, a1);
  const top = await page.evaluate(({ x, y }) => { const el = document.elementFromPoint(x, y); return el?.closest('.scratch-item') ? 'scratch-item' : (el?.closest('.asset-block')?.id || el?.id || el?.className || ''); }, c);
  // [S3-DIAG] 통과해도 «늘» 찍는다(지디 261117 — 옛 판이 왜 안 덮나 숫자로). 단언 아님.
  const diag = await page.evaluate(({ id, c }) => {
    const R = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; };
    const tag = (el) => el ? `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : ''}` : null;
    const scaler = document.getElementById('canvas-scaler'), wrap = document.getElementById('canvas-wrap'), it = [...document.querySelectorAll('.scratch-item')].pop();
    const hit = document.elementFromPoint(c.x, c.y), cs = it && getComputedStyle(it);
    return { block: R(document.getElementById(id)), item: R(it), itemStyle: it?.style.cssText, itemZ: cs?.zIndex, itemPos: cs?.position, itemDisplay: cs?.display, itemPE: cs?.pointerEvents,
      itemParent: tag(it?.parentElement), itemCls: it?.className, click: { x: Math.round(c.x), y: Math.round(c.y) }, hit: tag(hit), hitChain: [hit, hit?.parentElement, hit?.parentElement?.parentElement].map(tag),
      k: scaler ? scaler.getBoundingClientRect().width / (scaler.offsetWidth || 1) : null, scaler: R(scaler), scalerTf: scaler && getComputedStyle(scaler).transform,
      wrap: R(wrap), scroll: wrap && { l: wrap.scrollLeft, t: wrap.scrollTop }, bodyCls: document.body.className, vp: { w: innerWidth, h: innerHeight } };
  }, { id: a1, c });
  console.log('[S3-DIAG] ' + JSON.stringify(diag));
  expect(top, 'S3 — 붙인 스크래치 항목이 방금 복사한 블럭(화면 가운데)을 덮었다 — 클릭 자리 맨 위가 블럭이 아니다').toBe(a1);
  await page.mouse.click(c.x, c.y); await until(page, (id) => document.getElementById(id).classList.contains('selected'), a1);
  expect(await page.evaluate((id) => document.getElementById(id).classList.contains('selected'), a1), `S3 — 붙인 뒤 같은 블럭 클릭이 블럭을 못 골랐다(클릭 자리 맨 위 = ${top})`).toBe(true);
  const s1 = await st(page);
  await page.keyboard.press('Meta+c');
  await page.keyboard.press('Meta+v');
  await until(page, () => document.querySelectorAll('#canvas .asset-block').length === 2);
  const s2 = await st(page);
  expect(s2.assets, 'S3 — 평소 ⌘C → ⌘V 가 캔버스 사본을 안 만들었다').toBe(2);
  expect(s2.scratch.length, 'S3 — 평소 붙여넣기가 또 스크래치로 갔다(편집 복사 표가 남았다)').toBe(s1.scratch.length);
  expect(errs, errs.join('\n')).toEqual([]);
});
