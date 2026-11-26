/* t13d-03 — 0.9.13 t13D-03 ⌥(Option) + 끌기 = 복제 · 원본은 제자리 · 사본을 끌어 놓는다
 * 고침: alt-click-layer-select.js — «고른» 블럭 위 ⌥누름 → 3px 넘게 움직이면 editor.js duplicateInPlace(클립보드 0 · 제자리 · 새 id) → 사본에 mousedown 을 넘겨 사본을 끈다.
 *        안 움직이고 놓으면 종전 ⌥클릭 드릴.
 * D1 자유배치 프레임 안 글자: ⌥끌기 → 글자 +1 · 원본 id·자리 그대로 · 사본 = 새 id · 원본 자리 + 끈 만큼 · 글자 크기 같음 · 사본만 고름
 * D2 섹션 오버레이 글자: 같은 것(사본도 오버레이)
 * D3 흐름 글자 2개 중 첫째: ⌥끌어 둘째 아래로 → 글 순서 하나·둘·하나 · 새 id 하나(흐름은 네이티브 끌기라 «끌려간 쪽 = 원래 id · 제자리 = 새 id» — 화면 결과는 같다)
 * D4 ⌥ 누르고 안 움직이고 놓기 → 복제 없음(종전 드릴)
 * 양성대조: _patches/t13d-03-CTL.patch(alt-click-layer-select.js 의 복제 갈래 걷음 · 종전 = 바로 드릴) → D1·D2·D3 빨강 · D4 초록.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');

const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function scene(page) {
  await page.setViewportSize({ width: 1600, height: 1300 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection();
    c.querySelector('.section-block').id = 'sD'; window.applyZoom?.(100);
  });
  await waitZoomSettled(page, 100);
  await page.evaluate(() => {
    const sec = document.getElementById('sD'); document.getElementById('canvas-wrap').scrollTop = 0; sec.scrollIntoView({ block: 'start' });
    const name = (tf, id, txt, fs) => { tf.id = id; const tb = tf.querySelector('[class^="tb-"]'); tb.textContent = txt; tb.style.fontSize = fs + 'px'; delete tb.dataset.isPlaceholder; return tb; };
    // 오버레이 글자(섹션 첫 글자를 띄움)
    const tfO = name(sec.querySelector('.frame-block[data-text-frame]'), 'tfO', '오버', 22).closest('.frame-block');
    tfO.style.width = '120px'; tfO.dataset.width = '120';
    const p = window.OverlayFloat.posElOf(tfO); window.OverlayFloat.enterFloat(p); p.style.left = '600px'; p.style.top = '20px'; p.dataset.offsetX = '600'; p.dataset.offsetY = '20';
    // 흐름 글자 둘
    const fresh = (fn) => { const before = new Set(sec.querySelectorAll('.frame-block[data-text-frame]')); fn(); return [...sec.querySelectorAll('.frame-block[data-text-frame]')].find((x) => !before.has(x)); };
    name(fresh(() => { window.deselectAll(); window.selectSection(sec); window.addTextBlock('body'); }), 'tf1', '하나', 18);
    name(fresh(() => { window.deselectAll(); window.selectSection(sec); window.addTextBlock('body'); }), 'tf2', '둘', 18);
    // 자유배치 프레임 + 그 안 글자(절대 자리)
    window.deselectAll(); window.selectSection(sec); window.addFrameBlock();
    const fr = [...sec.querySelectorAll('.frame-block:not([data-text-frame])')].pop(); fr.id = 'frD';
    window.updateFrameBlock?.('frD', { width: 420, height: 200 });
    const src = document.getElementById('tf2').cloneNode(true); src.removeAttribute('id');
    src.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
    src.style.position = 'absolute'; src.style.left = '30px'; src.style.top = '30px'; src.style.width = '140px'; src.dataset.offsetX = '30'; src.dataset.offsetY = '30';
    fr.appendChild(src); name(src, 'tfF', '프레임안', 20);
    window.rebindAll?.(); window.deselectAll(); document.activeElement?.blur?.(); window.clearHistory?.();
  });
  await raf(page);
  const pre = await page.evaluate(() => ({ o: window.OverlayFloat.posElOf(document.getElementById('tfO')).dataset.overlayBlock, f: getComputedStyle(document.getElementById('tfF')).position, fIn: document.getElementById('tfF').parentElement.id }));
  expect(pre, '[전제] 오버레이 · 프레임 안 절대 자리').toEqual({ o: 'true', f: 'absolute', fIn: 'frD' });
  return errs;
}
const mid = (page, sel) => page.evaluate((s) => { const q = document.querySelector(s).getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; }, sel);
/* 고르고(⌥ 없이 · 프레임 안 글자는 두 번 눌러 들어가 고름 = 사람 길) → ⌥ 누른 채 진짜 마우스로 (dx, dy) */
async function altDrag(page, sel, dx, dy, { dbl = false } = {}) {
  const [x, y] = await mid(page, sel);
  if (dbl) await page.mouse.dblclick(x, y); else await page.mouse.click(x, y); await raf(page);
  expect(await page.evaluate((s) => !!document.querySelector(s.replace(/ \.text-block$/, '') + ' .text-block.selected'), sel), `[전제] ${sel} 를 골랐다`).toBe(true);
  await page.keyboard.down('Alt');
  await page.mouse.move(x, y); await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(x + dx * i / 12, y + dy * i / 12);
  await page.mouse.up(); await page.keyboard.up('Alt'); await raf(page);
}
const snap = (page, scope) => page.evaluate((scope) => [...document.querySelectorAll(scope)].map((e) => { const r = e.getBoundingClientRect(), tb = e.querySelector('[class^="tb-"]');
  return { id: e.id, x: Math.round(r.left), y: Math.round(r.top), txt: tb?.textContent, fs: tb ? getComputedStyle(tb).fontSize : null, sel: !!e.querySelector('.text-block.selected'), ov: e.dataset.overlayBlock || null }; }), scope);

async function absCase(page, id, scope, opt) {
  const a = await snap(page, scope), o = a.find((x) => x.id === id);
  expect(o, `[전제] ${id}`).toBeTruthy();
  await altDrag(page, '#' + id + ' .text-block', 120, 60, opt);
  const b = await snap(page, scope), o2 = b.find((x) => x.id === id), cp = b.filter((x) => !a.some((y) => y.id === x.id));
  expect(b.length, `★글자 +1 (${a.length}→${b.length})`).toBe(a.length + 1);
  expect([o2.x, o2.y], '★원본 제자리').toEqual([o.x, o.y]);
  expect(cp.length && cp[0].id && cp[0].id !== id, '★사본 = 새 id').toBe(true);
  /* 허용 10 = 스마트 가이드 자석 임계(smart-guides.js SNAP_THRESHOLD) — 프레임 안·오버레이 끌기는 근처 기준선에 붙는다(제품 동작) */
  expect([Math.abs(cp[0].x - (o.x + 120)) <= 10, Math.abs(cp[0].y - (o.y + 60)) <= 10], `★사본 = 원본 자리 + 끈 만큼(자석 ±10) ${JSON.stringify([o, cp[0]])}`).toEqual([true, true]);
  expect([cp[0].txt, cp[0].fs, cp[0].ov], '★글·크기·오버레이 그대로').toEqual([o.txt, o.fs, o.ov]);
  expect([cp[0].sel, o2.sel], '★사본만 고름').toEqual([true, false]);
}

test('D1 자유배치 프레임 안 글자 ⌥끌기 → 사본 · 원본 제자리', async ({ page }) => {
  const errs = await scene(page);
  await absCase(page, 'tfF', '#frD > .frame-block[data-text-frame]', { dbl: true });
  expect(errs).toEqual([]);
});

test('D2 섹션 오버레이 글자 ⌥끌기 → 사본(오버레이) · 원본 제자리', async ({ page }) => {
  const errs = await scene(page);
  await absCase(page, 'tfO', '#sD > .frame-block[data-text-frame]');
  expect(errs).toEqual([]);
});

test('D3 흐름 글자 ⌥끌어 둘째 아래로 → 제자리에 하나 남고 둘째 뒤에 하나 더(하나·둘·하나)', async ({ page }) => {
  const errs = await scene(page);
  const order = () => page.evaluate(() => [...document.querySelectorAll('#sD .section-inner .frame-block[data-text-frame]')].filter((e) => !e.closest('#frD')).map((e) => e.id || '?'));
  const texts = () => page.evaluate(() => [...document.querySelectorAll('#sD .section-inner .frame-block[data-text-frame]')].filter((e) => !e.closest('#frD')).map((e) => e.querySelector('[class^="tb-"]').textContent));
  const a = await order();
  expect(a.indexOf('tf1') < a.indexOf('tf2'), `[전제] 하나 → 둘 ${JSON.stringify(a)}`).toBe(true);
  const [, y2] = await mid(page, '#tf2'); const [, y1] = await mid(page, '#tf1');
  await altDrag(page, '#tf1 .text-block', 0, (y2 - y1) + 30);
  const b = await order();
  expect(b.length, `★흐름 글자 +1 ${JSON.stringify([a, b])}`).toBe(a.length + 1);
  const cpId = b.find((i) => !a.includes(i));
  expect(cpId, '★사본 = 새 id').toBeTruthy();
  expect(await texts(), `★제자리에 «하나» 남고 «둘» 뒤에 «하나» 하나 더 ${JSON.stringify(b)}`).toEqual(['하나', '둘', '하나']);
  expect(new Set(b).size, '★id 겹침 없음').toBe(b.length);
  const sel = await page.evaluate(() => [...document.querySelectorAll('#sD .section-inner .frame-block[data-text-frame]')].filter((e) => !e.closest('#frD')).map((e) => !!e.querySelector('.text-block.selected')));
  expect(sel, '★고름은 끌어 놓은 쪽(셋째)에만').toEqual([false, false, true]);
  expect(errs).toEqual([]);
});

test('D4 ⌥ 누르고 안 움직이고 놓으면 복제 없음(종전 드릴)', async ({ page }) => {
  const errs = await scene(page);
  const n0 = await page.evaluate(() => document.querySelectorAll('#canvas .frame-block[data-text-frame]').length);
  const [x, y] = await mid(page, '#tfF .text-block');
  await page.mouse.dblclick(x, y); await raf(page);
  expect(await page.evaluate(() => !!document.querySelector('#tfF .text-block.selected')), '[전제] 프레임 안 글자를 골랐다').toBe(true);
  await page.keyboard.down('Alt'); await page.mouse.click(x, y); await page.keyboard.up('Alt'); await raf(page);
  const r = await page.evaluate(() => ({ n: document.querySelectorAll('#canvas .frame-block[data-text-frame]').length, stillSel: !!document.querySelector('#tfF .text-block.selected') }));
  expect(r.n, '★복제 없음').toBe(n0);
  expect(r.stillSel, '★드릴 — 고름이 아래 레이어로 옮김').toBe(false);
  expect(errs).toEqual([]);
});

/* ★154 t13D-03 마감 ◑(지디 261122 재채점 · 미카사 grade-261122c 09-altdup) — «⌘Z 한 번에 사본 안 빠짐»(흐름·오버레이·프레임 안 = 2번째에 · 둘 고름 = 7번에도 남음)
 *   원인: 한 손짓이 이력 둘 — duplicateInPlace «복제 완료»(사본이 원본 위에 겹친 상태) + 끌기 끝 표본 ⇒ 첫 ⌘Z = 사본이 원본 위로 돌아와 «안 빠진» 꼴
 *   D5 세 경우(자유배치 프레임 안 · 섹션 오버레이 · 흐름) — ⌥끌기 한 번 → ⌘Z 한 번 = 사본 0 · 원본 제자리 · ⌘⇧Z 한 번 = 사본 끈 자리로 */
for (const [name, id, scope, dx, dy, opt] of [['프레임안', 'tfF', '#frD > .frame-block[data-text-frame]', 120, 60, { dbl: true }], ['오버레이', 'tfO', '#sD > .frame-block[data-text-frame]', 120, 60, {}], ['흐름', 'tf1', '#sD .section-inner .frame-block[data-text-frame]', 0, null, {}]]) {
  test(`D5 (154) ${name} ⌥끌기 → ⌘Z 한 번 = 사본 빠짐 · ⌘⇧Z 한 번 = 다시`, async ({ page }) => {
    const errs = await scene(page);
    const ids = () => page.evaluate((scope) => [...document.querySelectorAll(scope)].filter((e) => !e.closest('#frD') || scope.startsWith('#frD')).map((e) => e.id), scope);
    const a = await ids();
    let ddy = dy; if (ddy == null) { const [, y2] = await mid(page, '#tf2'); const [, y1] = await mid(page, '#tf1'); ddy = (y2 - y1) + 30; }
    await altDrag(page, '#' + id + ' .text-block', dx, ddy, opt);
    const b = await ids();
    expect(b.length, `[전제] 사본 생김 ${JSON.stringify([a, b])}`).toBe(a.length + 1);
    await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z'); await raf(page);
    const c = await ids();
    await page.keyboard.press('Meta+Shift+z'); await raf(page);
    const d = await ids();
    console.log(`[154 ${name} 실측]`, JSON.stringify({ a, b, c, d }));
    expect(c, '★⌘Z 한 번 = 사본 빠짐(끌기 전 그대로)').toEqual(a);
    expect(d.length, '★⌘⇧Z 한 번 = 사본 다시').toBe(b.length);
    expect(errs).toEqual([]);
  });
}
