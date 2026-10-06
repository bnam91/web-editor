/* grid-children.dom.spec.js — G19 「그리드 밑에 형제 블럭을 쌓는다 → 그리드가 스택 프레임 꼴로 늘어난다」 (지디 2026-10-03 설계 확정)
 *   grid-block = [격자 .grd-inner] + [자식 그릇 .grd-children] · 그릇은 자식이 ≥1 일 때만 · 간격 data-child-gap(기본 24·0~80 step 2)
 *   넣는 길 둘: 우측 패널 「＋ 블럭 넣기 ▾」(_insertToFlowFrame 에 그릇만 넘김) · 끌어 놓기(사각형 판정 — js/grid-children.js)
 * ★전제 단언을 «먼저» 둔다(그리드가 실제로 그 자리에 있고 자식 0개에서 시작하는가 — 0건 초록 금지).
 * ★진짜 입력: 끌기는 page.mouse(HTML5 드래그 — 크로미움이 dragstart/dragover/drop 을 낸다), 패널은 select 고르기, ⌘Z 는 키보드.
 *   ⚠️dragover 는 rAF 로 «솎는다»(섹션·프레임 처리기) — 빠르게 지나가면 마지막 자리가 안 잡힌다. 그래서 목표에서 1px «흔들고» 기다린다(_hover).
 * ★양성대조: GD1001_ROOT=<37ab1c65 체크아웃> 으로 같은 파일을 돌려 «새 동작» 시험이 빨강인지 명부로 남긴다(지키는 시험은 초록).
 * 하네스 = _root-harness bootApp(앱 통째 헤드리스, ⛔Electron 아님 — 파일 저장·불러오기 자체는 못 잰다: 직렬화 왕복으로 갈음).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const COLS = '[{&quot;width&quot;:1,&quot;lines&quot;:[{&quot;type&quot;:&quot;body&quot;,&quot;text&quot;:&quot;가&quot;},{&quot;type&quot;:&quot;body&quot;,&quot;text&quot;:&quot;나&quot;}]},{&quot;width&quot;:1,&quot;lines&quot;:[{&quot;type&quot;:&quot;body&quot;,&quot;text&quot;:&quot;다&quot;}]}]';
const GRID = (id) => `<div class="grid-block" id="${id}" data-type="grid" data-gap="24" data-valign="top" data-cols="${COLS}"></div>`;
const SEC = `<div class="section-block" id="sG" data-section="1" data-name="G"><div class="section-hitzone"></div><div class="section-inner" id="innerG">
<div class="gap-block" data-type="gap" id="g0" style="height:40px"></div>
<div class="row" id="rT"><div class="text-block" data-type="heading" id="tT"><div class="tb-h2">끌 글</div></div></div>
<div class="row" id="rA"><div class="asset-block" id="aA" data-align="center" style="min-height:40px"><div class="asset-overlay"></div></div></div>
<div class="row" id="rG">${GRID('gG')}</div>
<div class="row" id="rB"><div class="asset-block" id="aB" data-align="center" style="min-height:40px"><div class="asset-overlay"></div></div></div>
<div class="frame-block" id="fF" data-full-width="true" style="background:#fff;width:100%;box-sizing:border-box;"><div class="row" id="rG2">${GRID('gF')}</div></div>
<div class="gap-block" data-type="gap" id="gEnd" style="height:300px"></div></div></div>`;

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1400 });
  const errs = await bootApp(page);
  await page.evaluate((h) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', h); window.rebindAll?.(); window.deselectAll?.();
    window.renderGridBlock?.(document.getElementById('gG')); window.renderGridBlock?.(document.getElementById('gF'));
    window.clearHistory?.();
  }, SEC);
  await page.waitForTimeout(400);
  /* 전제: 두 그리드가 자식 0개 · 그릇 없음 · G19 입구가 실제로 있다. */
  const pre = await page.evaluate(() => ({
    boxes: document.querySelectorAll('#canvas .grd-children').length,
    gG: !!document.querySelector('#gG > .grd-inner'), gF: !!document.querySelector('#gF > .grd-inner'),
  }));
  expect(pre).toEqual({ boxes: 0, gG: true, gF: true });
  return errs;
}
const rect = (page, q) => page.evaluate((q) => { const e = document.querySelector(q); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, top: r.top, bottom: r.bottom, left: r.left, right: r.right, h: r.height }; }, q);
const kids = (page, g = 'gG') => page.evaluate((g) => [...(document.querySelector(`#${g} > .grd-children`)?.children || [])].filter(k => !k.classList.contains('drop-indicator')).map(k => k.id), g);
const order = (page) => page.evaluate(() => [...document.getElementById('innerG').children].map(e => e.id || e.className.split(' ')[0]));
const strip = (page) => page.evaluate(() => document.querySelectorAll('.grd-child-strip').length);
async function grab(page, srcSel) {
  const s = await rect(page, srcSel);
  await page.mouse.move(s.x, s.y); await page.mouse.down();
  await page.mouse.move(s.x + 10, s.y + 10, { steps: 3 });
}
/* 목표에 닿은 뒤 1px 씩 두 번 흔든다 — 표시선이 끼면 레이아웃이 밀려 포인터 밑 요소가 바뀌는데, 진짜 끌기는 브라우저가
   dragover 를 주기적으로 다시 내 주지만 Playwright 의 끌기는 «움직일 때만» 낸다(실측: 흔들기 없이 놓으면 dragenter 만 받고
   drop 없이 dragend·dropEffect none). 두 번째 흔들기가 «밀린 뒤의» 요소에 dragover 를 준다. */
async function hover(page, x, y) {
  await page.mouse.move(x, y, { steps: 10 }); await page.waitForTimeout(80);
  await page.mouse.move(x + 1, y, { steps: 1 }); await page.waitForTimeout(150);
  await page.mouse.move(x, y, { steps: 1 }); await page.waitForTimeout(150);
}
/** 빈 그리드 «밑»에 놓기 — 그리드 위에서 띠를 세운 뒤 띠 한가운데로. */
async function dropUnderEmptyGrid(page, srcSel, g = 'gG') {
  await grab(page, srcSel);
  const gr = await rect(page, `#${g}`);
  await hover(page, gr.x, gr.y);
  const sr = await rect(page, `#${g} > .grd-child-strip`);
  expect(sr, '전제 — 빈 그리드 위에서 끄는 동안 임시 띠가 섰다').not.toBeNull();
  await hover(page, sr.x, sr.y);
  await page.mouse.up(); await page.waitForTimeout(400);
}
const undo = async (page) => { await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z'); await page.waitForTimeout(400); };

test('K1 ★패널 「＋ 블럭 넣기 ▾」 — 그리드 밑에 글자 블럭이 들어가고 그리드가 그만큼 자란다 · 새 블럭이 골라진다 · ⌘Z 한 번이면 그릇째 사라진다', async ({ page }) => {
  const errs = await setup(page);
  const g = await rect(page, '#gG');
  const h0 = g.h;
  await page.mouse.click(g.x, g.top + 2); await page.waitForTimeout(300);
  expect(await page.evaluate(() => document.getElementById('gG').classList.contains('selected')), '전제 — 첫 클릭이 그리드를 골랐다').toBe(true);
  expect(await page.locator('#grd-kid-add-kind').count(), '전제 — 패널에 「＋ 블럭 넣기 ▾」가 있다').toBe(1);
  const before = await page.evaluate(() => document.getElementById('gG').outerHTML);
  await page.selectOption('#grd-kid-add-kind', 'body'); await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const g = document.getElementById('gG'), box = g.querySelector(':scope > .grd-children');
    const k = box ? [...box.children] : [];
    const last = k[k.length - 1];
    return { n: k.length, tf: last?.dataset.textFrame === 'true', h: g.getBoundingClientRect().height,
      bottomGap: last ? Math.round(g.getBoundingClientRect().bottom - last.getBoundingClientRect().bottom) : null,
      sel: document.querySelector('.text-block.selected')?.closest('.grd-children') === box,
      sel2: document.getElementById('gG').classList.contains('selected') };
  });
  expect(r.n).toBe(1);
  expect(r.tf, '글자 블럭은 글자 래퍼(text-frame)째 들어간다').toBe(true);
  expect(r.h).toBeGreaterThan(h0 + 20);
  expect(r.bottomGap, '자식이 그리드 상자 밖으로 삐져나가지 않는다').toBe(0);
  expect(r.sel, '새 블럭이 골라졌다(insert-select 래퍼)').toBe(true);
  await undo(page);
  const after = await page.evaluate(() => document.getElementById('gG').outerHTML);
  expect(after.replace(/ class="grid-block[^"]*"/, ''), '⌘Z 한 번 = 그릇째 사라지고 그리드가 넣기 전과 같다').toBe(before.replace(/ class="grid-block[^"]*"/, ''));
  expect(errs).toEqual([]);
});

test('K2 ★재렌더·저장 왕복에도 자식이 산다 — updateGridBlock · rebindAll · 직렬화→도로 심기(로드 길)', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => { window.addGridChild('gG', 'image'); window.addGridChild('gG', 'gap'); });
  const k0 = await kids(page);
  expect(k0.length, '전제 — 자식 둘').toBe(2);
  await page.evaluate(() => { window.updateGridBlock('gG', { gap: 40 }); window.rebindAll(); });
  expect(await kids(page)).toEqual(k0);
  const r = await page.evaluate(() => {
    const html = window.getSerializedCanvas();
    const c = document.getElementById('canvas'); c.innerHTML = html; window.rebindAll();
    const g = document.getElementById('gG');
    return { order: [...g.children].map(x => x.className), n: g.querySelectorAll(':scope > .grd-children > *').length };
  });
  expect(r.order).toEqual(['grd-inner', 'grd-children']);
  expect(await kids(page)).toEqual(k0);
  expect(errs).toEqual([]);
});

test('K3 ★빈 그리드 위로 끌면 «끄는 동안만» 임시 띠 → 띠에 놓으면 첫 자식 · ⌘Z 한 번이면 제자리(그릇 없음)', async ({ page }) => {
  const errs = await setup(page);
  expect(await strip(page), '전제 — 끌기 전엔 띠가 없다').toBe(0);
  await dropUnderEmptyGrid(page, '#aA');
  expect(await kids(page)).toEqual(['rA']);
  expect(await strip(page), '놓은 뒤엔 띠가 «진짜 그릇»이 됐다(임시 표시 없음)').toBe(0);
  expect(await page.evaluate(() => document.querySelector('#gG > .grd-children').style.marginTop)).toBe('24px');
  await undo(page);
  expect(await order(page)).toEqual(['g0', 'rT', 'rA', 'rG', 'rB', 'fF', 'gEnd']);
  expect(await page.evaluate(() => document.querySelectorAll('#gG > .grd-children').length)).toBe(0);
  expect(errs).toEqual([]);
});

test('K4 ★자식이 있으면 그릇 안 «자리»에 넣는다 — 표시선은 프레임과 같은 .drop-indicator · 첫 자식 앞/뒤', async ({ page }) => {
  const errs = await setup(page);
  await dropUnderEmptyGrid(page, '#aA');
  await grab(page, '#aB');
  const k = await rect(page, '#rA');
  await hover(page, k.x, k.top + 3);
  const ind = await page.evaluate(() => { const i = document.querySelector('.drop-indicator'); return i ? { box: i.parentElement.classList.contains('grd-children'), next: i.nextElementSibling?.id || null } : null; });
  expect(ind).toEqual({ box: true, next: 'rA' });
  await page.mouse.up(); await page.waitForTimeout(400);
  expect(await kids(page)).toEqual(['rB', 'rA']);
  expect(errs).toEqual([]);
});

test('K5 지키는 시험 — 격자(.grd-inner) 위: 글자는 G9 칸 줄 · 에셋은 종전 앞/뒤 형제(그릇 안 생김)', async ({ page }) => {
  const errs = await setup(page);
  await grab(page, '#aA');
  const g = await rect(page, '#gG > .grd-inner');
  await hover(page, g.x, g.top + g.h * 0.85);
  await page.mouse.up(); await page.waitForTimeout(400);
  expect(await order(page)).toEqual(['g0', 'rT', 'rG', 'rA', 'rB', 'fF', 'gEnd']);
  expect(await kids(page)).toEqual([]);
  const c = await rect(page, '#gG [data-r="0"][data-c="1"][data-line="0"]');
  await grab(page, '#tT');
  await hover(page, c.x, c.bottom - 2);
  await page.mouse.up(); await page.waitForTimeout(400);
  expect(await page.evaluate(() => [...document.querySelectorAll('#gG [data-r="0"][data-c="1"][data-line]')].map(e => e.textContent.trim()))).toEqual(['다', '끌 글']);
  expect(await page.evaluate(() => document.querySelectorAll('#canvas .grd-children').length)).toBe(0);
  expect(errs).toEqual([]);
});

test('K6 ★띠는 «끄는 동안만» — 그리드를 벗어나면 · 다른 데 놓으면 사라진다(dragend 길)', async ({ page }) => {
  const errs = await setup(page);
  await grab(page, '#aA');
  const g = await rect(page, '#gG');
  await hover(page, g.x, g.y);
  expect(await strip(page), '전제 — 그리드 위에서 띠가 섰다').toBe(1);
  const e = await rect(page, '#gEnd');
  await hover(page, e.x, e.y);
  expect(await strip(page), '그리드를 벗어나면 걷힌다').toBe(0);
  await hover(page, g.x, g.y);
  expect(await strip(page)).toBe(1);
  const b = await rect(page, '#g0');
  await page.mouse.move(b.x, b.y, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(400);
  expect(await strip(page), '다른 자리에 놓으면 걷힌다').toBe(0);
  expect(await page.evaluate(() => document.querySelectorAll('#canvas .grd-children').length)).toBe(0);
  expect(errs).toEqual([]);
});

test('K7 ★그리드를 품은 것은 그 그리드에 못 넣는다 — 그리드 자기 행을 자기 밑으로 끌어도 그대로', async ({ page }) => {
  const errs = await setup(page);
  const g = await rect(page, '#gG');
  await page.mouse.click(g.x, g.top + 2); await page.waitForTimeout(200);
  await grab(page, '#gG');
  await hover(page, g.x, g.bottom - 2);
  expect(await strip(page), '자기 자신 위에선 띠가 안 선다').toBe(0);
  await page.mouse.up(); await page.waitForTimeout(400);
  expect(await page.evaluate(() => !!document.querySelector('#gG #gG, #gG > .grd-children'))).toBe(false);
  expect(errs).toEqual([]);
});

test('K8 지키는 시험(G3) — 그리드를 블럭 선택하고 T = 그리드 «뒤 형제» · 자식을 고르고 T = 그 자식 뒤(그릇 안)', async ({ page }) => {
  const errs = await setup(page);
  const g = await rect(page, '#gG');
  await page.mouse.click(g.x, g.top + 2); await page.waitForTimeout(300);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('t'); await page.waitForTimeout(400);
  const o = await order(page);
  expect(o.indexOf('rG') + 1, '새 글자는 그리드 행 바로 뒤').toBe(o.findIndex(x => x !== 'rG' && !['g0', 'rT', 'rA'].includes(x)));
  expect(await kids(page)).toEqual([]);
  await page.evaluate(() => window.addGridChild('gG', 'image'));
  const kid = (await kids(page))[0];
  await page.evaluate(() => window.deselectAll());
  const kr = await rect(page, `#${kid} .asset-block`);
  await page.mouse.click(kr.x, kr.y); await page.waitForTimeout(300);
  expect(await page.evaluate((k) => document.querySelector(`#${k} .asset-block`).classList.contains('selected'), kid), '전제 — 자식 클릭이 자식을 골랐다(그리드가 가로채지 않는다)').toBe(true);
  expect(await page.evaluate(() => document.getElementById('gG').classList.contains('selected'))).toBe(false);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('t'); await page.waitForTimeout(400);
  const k2 = await kids(page);
  expect(k2.length).toBe(2);
  expect(k2[0]).toBe(kid);
  expect(errs).toEqual([]);
});

test('K9 ★레이어 패널 — 자식 0개면 그리드는 지금과 같은 말단 줄 · ≥1 이면 펼친다(글자 래퍼 투명: Frame 줄 없이 Body)', async ({ page }) => {
  const errs = await setup(page);
  const leaf = await page.evaluate(() => { window.buildLayerPanel(); const it = document.getElementById('gG')._layerItem; return { leaf: !!it && !it.closest('.layer-row-group[data-type="grid"]'), groups: document.querySelectorAll('#layer-panel-body .layer-row-group[data-type="grid"]').length }; });
  expect(leaf).toEqual({ leaf: true, groups: 0 });
  await page.evaluate(() => { window.addGridChild('gG', 'body'); window.addGridChild('gG', 'image'); window.buildLayerPanel(); });
  const r = await page.evaluate(() => {
    const grp = document.getElementById('gG')._layerItem.closest('.layer-row-group[data-type="grid"]');
    return grp ? { types: [...grp.querySelectorAll(':scope > .layer-row-children .layer-item-type')].map(e => e.textContent), head: grp.querySelector(':scope > .layer-row-header .layer-item-type')?.textContent } : null;
  });
  expect(r).toEqual({ types: ['Text', 'Image'], head: 'Grid' });
  expect(errs).toEqual([]);
});

test('K10 ★「블럭 간격」 — 자식 0개면 안 보이고 ≥1 이면 Layout 에 뜬다 · 40 으로 바꾸면 그릇 gap·margin-top 40 · 저장 왕복에도 산다', async ({ page }) => {
  const errs = await setup(page);
  const g = await rect(page, '#gG');
  await page.mouse.click(g.x, g.top + 2); await page.waitForTimeout(300);
  expect(await page.locator('#grd-child-gap-number').count(), '자식 0개 — 죽은 조절칸은 숨긴다').toBe(0);
  await page.selectOption('#grd-kid-add-kind', 'image'); await page.waitForTimeout(300);
  await page.evaluate(() => window.selectBlock?.('gG'));
  await page.waitForTimeout(200);
  const num = page.locator('#grd-child-gap-number');
  expect(await num.count()).toBe(1);
  expect(await num.inputValue()).toBe('24');
  expect(await page.locator('#grd-child-gap-slider').getAttribute('max')).toBe('80');
  await num.fill('40'); await num.press('Enter'); await page.waitForTimeout(200);
  const st = await page.evaluate(() => { const b = document.querySelector('#gG > .grd-children'); return { gap: b.style.gap, mt: b.style.marginTop, ds: document.getElementById('gG').dataset.childGap, blockStyleHasGap: /gap/.test(document.getElementById('gG').getAttribute('style') || '') }; });
  expect(st).toEqual({ gap: '40px', mt: '40px', ds: '40', blockStyleHasGap: false });
  const rt = await page.evaluate(() => { const c = document.getElementById('canvas'); c.innerHTML = window.getSerializedCanvas(); window.rebindAll(); const b = document.querySelector('#gG > .grd-children'); return { gap: b?.style.gap, ds: document.getElementById('gG').dataset.childGap }; });
  expect(rt).toEqual({ gap: '40px', ds: '40' });
  expect(errs).toEqual([]);
});

test('K11 ★선택 안 된 «흐름 프레임» 안 그리드에도 밑으로 넣는다(사각형 판정 — elementFromPoint 는 프레임을 준다)', async ({ page }) => {
  const errs = await setup(page);
  expect(await page.evaluate(() => document.getElementById('fF').classList.contains('selected')), '전제 — 프레임은 선택 안 됨').toBe(false);
  await dropUnderEmptyGrid(page, '#aA', 'gF');
  expect(await kids(page, 'gF')).toEqual(['rA']);
  expect(errs).toEqual([]);
});

test('K12 ★마지막 자식을 끌어내면 그릇이 걷히고 다음 렌더는 «자식 없던 그리드»와 바이트 같다', async ({ page }) => {
  const errs = await setup(page);
  const before = await page.evaluate(() => document.getElementById('gG').outerHTML);
  await dropUnderEmptyGrid(page, '#aA');
  expect(await kids(page), '전제 — 자식 하나').toEqual(['rA']);
  await grab(page, '#aA');
  const e = await rect(page, '#gEnd');
  await hover(page, e.x, e.y);
  await page.mouse.up(); await page.waitForTimeout(400);
  expect(await page.evaluate(() => document.getElementById('rA').closest('.grid-block')), '전제 — 자식이 그리드 밖으로 나갔다').toBeNull();
  expect(await page.evaluate(() => document.querySelectorAll('#gG > .grd-children').length)).toBe(0);
  const after = await page.evaluate(() => { const g = document.getElementById('gG'); window.renderGridBlock(g); return g.outerHTML; });
  const strip = (h) => h.replace(/ class="grid-block[^"]*"/, '');
  expect(strip(after)).toBe(strip(before));
  expect(errs).toEqual([]);
});

/* K13 ★「＋ 블럭 넣기 ▾」가 «뜨는» 상태(블럭 단위 선택)의 패널을 잰다 — G2(grid-cell-panel-handles)는 «줄 선택» 상태만 재므로
 *   이 손잡이를 못 본다(그 상태에선 일부러 안 띄운다 — prop-grid.js _grdKidsAddSectionHtml 머리말). 짝 검사:
 *   ⑴ 블럭 선택이면 뜬다 · 줄 선택이면 안 뜬다 ⑵ 패널 가로 넘침 0 · select 가 한 줄 안(높이 ≤ 32px) ⑶ 「블럭 간격」 도 넘침 0. */
test('K13 ★「＋ 블럭 넣기 ▾」 — 블럭 선택이면 뜨고 줄 선택이면 안 뜬다 · 뜬 상태의 패널 가로 넘침 0', async ({ page }) => {
  const errs = await setup(page);
  const g = await rect(page, '#gG');
  await page.mouse.click(g.x, g.top + 2); await page.waitForTimeout(300);
  const m = () => page.evaluate(() => {
    const body = document.querySelector('#panel-right .panel-body'); const rb = body.getBoundingClientRect();
    const sel = document.getElementById('grd-kid-add-kind');
    return { has: !!sel, h: sel ? Math.round(sel.getBoundingClientRect().height) : null,
      over: [...body.querySelectorAll('*')].filter(el => { const r = el.getBoundingClientRect(); return (r.width || r.height) && r.right > rb.right + 0.5; }).length,
      scrollW: body.scrollWidth - body.clientWidth };
  });
  const a = await m();
  expect(a.has, '블럭 단위 선택 — 뜬다').toBe(true);
  expect(a.h).toBeLessThanOrEqual(32);
  expect(a.over).toBe(0); expect(a.scrollW).toBeLessThanOrEqual(0);
  await page.selectOption('#grd-kid-add-kind', 'gap'); await page.waitForTimeout(300);
  await page.evaluate(() => window.selectBlock?.('gG')); await page.waitForTimeout(200);
  const b = await m();
  expect(await page.locator('#grd-child-gap-number').count(), '전제 — 「블럭 간격」 이 떴다').toBe(1);
  expect(b.over).toBe(0); expect(b.scrollW).toBeLessThanOrEqual(0);
  const c = await rect(page, '#gG [data-r="0"][data-c="0"][data-line="0"]');
  await page.mouse.click(c.x, c.y); await page.waitForTimeout(300);   // 첫 클릭 = 블럭(T-058 드릴 걸쇠)
  await page.mouse.click(c.x, c.y); await page.waitForTimeout(300);   // 둘째 클릭 = 줄
  expect(await page.evaluate(() => !!window.grdGetActiveLine?.(document.getElementById('gG'))), '전제 — 둘째 클릭이 줄을 골랐다').toBe(true);
  expect((await m()).has, '줄 선택 — «그 칸» 손잡이 자리라 안 뜬다').toBe(false);
  expect(errs).toEqual([]);
});

/* K14·K15 — 띠가 «dragend 를 놓치는 길»에서도 사라지나(설계 확정 ㉮ 「Esc·창 밖에서도 사라지는지 잰다」).
 *   ⚠️재는 것은 «이 하네스(Playwright 의 크로미움 끌기 흉내)»에서의 길이다 — 진짜 OS 끌기 루프(사람 손 Esc)는 아니다.
 *   그래서 단언은 «마지막 상태»(놓은 뒤 띠 0 · 그릇 0 · 블럭 제자리)에 둔다. 중간 상태(Esc 직후·창 밖 직후)는 수로 «찍어만» 둔다. */
test('K14 띠 — 끄는 중 Esc 를 눌러도 놓은 뒤엔 띠·그릇이 없고 블럭은 제자리', async ({ page }) => {
  const errs = await setup(page);
  await grab(page, '#aA');
  const g = await rect(page, '#gG');
  await hover(page, g.x, g.y);
  expect(await strip(page), '전제 — 띠가 섰다').toBe(1);
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  const afterEsc = await strip(page);
  await page.mouse.up(); await page.waitForTimeout(300);
  console.log(`K14 Esc 직후 띠=${afterEsc}`);
  expect(await strip(page)).toBe(0);
  expect(await page.evaluate(() => document.querySelectorAll('#canvas .grd-children').length)).toBe(0);
  expect(errs).toEqual([]);
});

test('K15 띠 — 끄는 채로 창 밖(왼쪽 가장자리 밖)으로 나가면 걷힌다 · 거기서 놓아도 블럭은 그리드에 안 들어간다', async ({ page }) => {
  const errs = await setup(page);
  await grab(page, '#aA');
  const g = await rect(page, '#gG');
  await hover(page, g.x, g.y);
  expect(await strip(page), '전제 — 띠가 섰다').toBe(1);
  await page.mouse.move(2, g.y, { steps: 8 }); await page.waitForTimeout(120);
  await page.mouse.move(-20, g.y, { steps: 2 }); await page.waitForTimeout(200);
  const outside = await strip(page);
  await page.mouse.up(); await page.waitForTimeout(300);
  console.log(`K15 창 밖 직후 띠=${outside}`);
  expect(await strip(page)).toBe(0);
  expect(await kids(page)).toEqual([]);
  expect(errs).toEqual([]);
});
