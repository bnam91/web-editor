/* legacy-tpl-frame-panel-height.dom.spec.js — LEGACY-TPL-FRAME-PANEL-HEIGHT-SHOWS-FLOOR-01 (0.9.12 별건 · 미카사 261112 실앱 · 지디 261116)
 * 옛 공용 템플릿 「급하게 제품이 필요하신가요?」(templates/canvas/tpl_1775031581782.html · data-height=100 = «바닥» · style.height 없음)
 *   프레임을 고르면 우측 패널 높이 칸·슬라이더 = 100 · 화면 실제 = 글 따라 345. 그 칸을 건드리면 100 근처로 고정돼 다시 쪼그라들 수 있었다.
 * 같은 꼴: FRAME-HEIGHT-FIELD-SHOWS-UNCLAMPED-01(0.9.11) · FRAME-WIDTH-FIELD-SHOWS-UNCLAMPED-01(8792347e3) — 칸 = 그려진 값.
 * ★고친 자리 = js/props/prop-frame.js _renderAutoPanel 높이 칸·슬라이더 value = 그려진 높이(panelRenderedPx 'height').
 *   P1 ★칸 = 그려진 높이 · 슬라이더 = 그 높이를 슬라이더 min·step 에 맞춘 값(범위 슬라이더는 step 에 맞춘다 — 8a7a6854d 와 같은 자)
 *   P2 ★슬라이더를 한 칸(→) 건드려도 프레임이 안 쪼그라든다(높이 ≥ 건드리기 전)
 *   N1 [지킴] 높이를 고정한 프레임(300) — 칸 300 그대로
 * 장면은 legacy-tpl-frame-height-0912.dom.spec.js 의 넣기(insertTemplate · loadTemplateCanvas 대역)를 그대로 옮겼다.
 * 양성대조(srv 미실행): prop-frame.js 두 value="${shownH}" 를 value="${height}" 로 되돌리면 P1 빨강(칸 100) · P2 빨강(→ 한 번에 110 으로 쪼그라듦) · N1 초록.
 * ⛔고정 대기 0 · 앱 = bootApp.
 */
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const TPL_ID = 'tpl_1775031581782';
const TPL_HTML = fs.readFileSync(path.join(__dirname, '../../templates/canvas', TPL_ID + '.html'), 'utf8');
const SEC = '<div class="section-block" id="sP" data-section="1" data-name="옛템플릿"><div class="section-hitzone"></div><div class="section-inner">'
  + '<div class="gap-block" data-type="gap" style="height:40px"></div>'
  + '<div class="row" id="rN1" data-layout="stack"><div class="frame-block" id="fN1" data-bg="#eeeeee" data-height="300" style="background:#eee;width:780px;margin:0 auto;min-height:300px;height:300px;">'
  + '<div class="frame-block" data-text-frame="true" id="tfN1" style="background:transparent;width:100%;"><div class="text-block" data-type="body" id="tbN1"><div class="tb-body">고정 높이 프레임 글</div></div></div></div></div>'
  + '</div></div>';

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  const r = await page.evaluate(async ([html, sec, id]) => {
    const base = window.electronAPI;
    window.electronAPI = new Proxy({}, { get: (t, k) => (k === 'loadTemplateCanvas' ? async (x) => (x === id ? html : null) : base[k]) });
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', sec);
    window.rebindAll?.(); window.applyZoom?.(100);
    const S = document.getElementById('sP'); window.deselectAll?.(); window.selectSection?.(S);
    const before = new Set([...document.querySelectorAll('.frame-block')].map(f => f.id));
    await window.insertTemplate({ id, name: '급하게 제품이 필요하신가요?', type: 'subsection' });
    const F = [...document.querySelectorAll('#sP .frame-block:not([data-text-frame])')].find(f => !before.has(f.id));
    window.deselectAll?.();
    return F ? { F: F.id, dh: parseInt(F.dataset.height), styleH: F.style.height, drawn: Math.round(parseFloat(getComputedStyle(F).height)) } : null;
  }, [TPL_HTML, SEC, TPL_ID]);
  expect(r, '[전제] 템플릿 프레임이 들어갔다').toBeTruthy();
  console.log('  LTP setup:', JSON.stringify(r));
  expect({ dh: r.dh, styleH: r.styleH }, '[전제] 옛 바닥 꼴(data-height 100 · style.height 없음)').toEqual({ dh: 100, styleH: '' });
  expect(r.drawn, '[전제] 그려진 높이는 글 따라 바닥보다 크다').toBeGreaterThan(130);
  return { errs, ...r };
}
const openPanel = (page, id) => page.evaluate(async (id) => { (await import('/js/props/prop-frame.js')).showFrameProperties(document.getElementById(id)); }, id);
const field = (page) => page.evaluate(() => {
  const n = document.getElementById('ss-height-num'), r = document.getElementById('ss-height-slider');
  return { num: n.value, slider: r.value, min: +r.min, step: +r.step || 1 };
});
const snap = (v, f) => String(f.min + Math.round((v - f.min) / f.step) * f.step);

test('P1 ★옛 템플릿 프레임 — 높이 칸 = 그려진 높이(바닥 100 아님) · 슬라이더 = step 에 맞춘 값', async ({ page }) => {
  const { errs, F, drawn } = await setup(page);
  await openPanel(page, F);
  await expect(page.locator('#ss-height-num'), '[전제] 프레임 패널').toHaveCount(1);
  const f = await field(page);
  console.log('  P1 field:', JSON.stringify(f), 'drawn', drawn);
  expect(f.num, '★높이 칸 = 실제 높이').toBe(String(drawn));
  expect(f.slider, '슬라이더 = 실제 높이를 step 에 맞춘 값').toBe(snap(drawn, f));
  expect(errs, errs.join('\n')).toEqual([]);
});

test('P2 ★슬라이더를 한 칸 건드려도 안 쪼그라든다', async ({ page }) => {
  const { errs, F, drawn } = await setup(page);
  await openPanel(page, F);
  await page.focus('#ss-height-slider');
  await page.keyboard.press('ArrowRight');
  const after = await page.evaluate((id) => { const e = document.getElementById(id); return { h: e.offsetHeight, styleH: e.style.height, slider: document.getElementById('ss-height-slider').value }; }, F);
  console.log('  P2:', JSON.stringify(after), 'drawn', drawn);
  expect(after.styleH, '[전제] 건드린 값이 먹었다(고정 높이가 박힘)').not.toBe('');
  expect(after.h, `★건드린 뒤 높이 ${after.h} ≥ 건드리기 전 ${drawn}`).toBeGreaterThanOrEqual(drawn);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('N1 [지킴] 높이를 고정한 프레임(300) — 칸 300 그대로', async ({ page }) => {
  const { errs } = await setup(page);
  await openPanel(page, 'fN1');
  const f = await field(page);
  expect({ num: f.num, slider: f.slider }).toEqual({ num: '300', slider: '300' });
  expect(errs, errs.join('\n')).toEqual([]);
});
