/* color-picker-tab-apply.dom.spec.js — 0918 picker: 색상 피커 «탭 = 즉시 적용» (피그마식)
 *
 * 현빈 요청(2026-09-18): 「쉐이프·텍스트 색상 피커에서 그라데이션 탭 선택하면 바로 그라데이션 적용.
 *   솔리드 탭 → 솔리드 적용. 에셋 탭 → 캔버스에 에셋 체커박스. 각 탭 호버 시 작은 설명.」
 * 확정(2026-09-19): 그라데이션 첫 진입 기본값 = «지금 색 100% → 같은 색 0%». 에셋 탭 = 넣기 전 바둑판.
 *
 * ★«패널 경로»로 잰다 — 진짜 스와치를 진짜 마우스로 눌러 팝오버를 열고, 진짜 탭을 클릭한다.
 *   pushHistory 는 호출 횟수 카운터로 바꿔 «탭 1번 = 기록 1번(되돌리기 1번)»을 숫자로 잰다.
 * ★바둑판은 dataset 이 아니라 getComputedStyle(rect).fill 로 잰다(사람이 보는 것).
 *
 * ⛔앱을 «안» 띄운다 — 레포 파일만 크로미움에 얹는다(고디터 인스턴스·MCP 대역 무접촉).
 * 실행: npm run test:dom -- color-picker-tab-apply
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

const SHAPE = (id, type, color) => `
  <div class="frame-block" style="position:relative;width:120px;height:120px;">
    <div class="shape-block" id="${id}" data-type="shape" data-shape-type="${type}" data-shape-color="${color}" data-shape-stroke-width="0">
      <svg class="shape-svg" viewBox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"
        style="color:${color};stroke-width:0;fill:currentColor;stroke:currentColor;">
        <rect x="0" y="0" width="100" height="100" rx="0"/>
      </svg>
    </div>
  </div>`;

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-panels.css">
<link rel="stylesheet" href="/css/editor-props.css">
<link rel="stylesheet" href="/css/color-picker.css">
<link rel="stylesheet" href="/css/editor-blocks.css">
<style>#panel-right{position:fixed;left:0;top:0;width:240px;} #canvas{position:absolute;left:600px;top:0;}</style>
</head><body>
<div id="canvas"><div class="section-block"><div class="section-inner" id="host">
  ${SHAPE('shpA', 'rectangle', '#3366ff')}
  ${SHAPE('shpB', 'rectangle', '#22aa44')}
  <div class="text-block" id="tb1"><div class="tb-body" contenteditable="false" style="font-size:40px;">그라데이션 글자</div></div>
  <div class="text-block" id="tb2"><div class="tb-body text-effect tfx-neon" contenteditable="false">효과 글자</div></div>
</div></div></div>
<div id="panel-right"><div class="panel-body"></div></div>
<div id="ds-page-bg" style="position:fixed;left:300px;top:0;">
  <div class="prop-color-swatch" style="width:24px;height:24px;"><input type="color" id="page-bg-color" value="#828282"></div>
  <input id="page-bg-hex" value="828282"><input id="page-bg-alpha-input" value="100">
</div>
<div id="plain-field" style="position:fixed;left:300px;top:60px;"></div>
<script type="module">
  import { wireColorField, colorFieldHTML } from '/js/props/color-picker.js';
  import { showShapeProperties } from '/js/props/prop-shape.js';
  import { wireCanvasBgControl } from '/js/props/prop-page.js';
  import { showTextProperties } from '/js/props/prop-text.js';
  window.__hist = 0;
  window.pushHistory = () => { window.__hist++; };
  window.scheduleAutoSave = () => {};
  window.getBlockBreadcrumb = () => '';
  window.__shape = showShapeProperties;
  window.__text = showTextProperties;
  window.__wireCF = wireColorField;
  window.__cfHTML = colorFieldHTML;
  window.__wirePage = wireCanvasBgControl;
  window.__ready = true;
</script></body></html>`;

async function boot(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, decodeURIComponent(url.pathname));
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

const hist = (page) => page.evaluate(() => window.__hist);
const openShape = (page, id) => page.evaluate((i) => window.__shape(document.getElementById(i)), id);
/** 진짜 스와치를 진짜 마우스로 누른다 — color-picker.js 의 mousedown(capture) 델리게이션 경로 */
async function openSwatchOf(page, inputId) {
  await page.locator(`#${inputId}`).locator('xpath=..').click();
  await expect(page.locator('.goya-cp-popover')).toBeVisible();
}
const tab = (page, name) => page.locator(`.goya-cp-tab[data-tab="${name}"]`);
const activeTab = (page) => page.evaluate(() => document.querySelector('.goya-cp-tab.active')?.dataset.tab);
const shapeState = (page, id) => page.evaluate((i) => {
  const b = document.getElementById(i);
  const rect = b.querySelector('svg rect');
  return {
    grad: b.dataset.shapeGradient ? JSON.parse(b.dataset.shapeGradient) : null,
    fillAttr: rect.getAttribute('fill'),
    computedFill: getComputedStyle(rect).fill,
    svgColor: b.querySelector('svg').style.color,
    shapeFill: b.dataset.shapeFill || null,
    cpFill: document.getElementById('shape-color-color')?.dataset.cpFill || null,
  };
}, id);

test('T1~T3 ★도형: 그라데이션 탭 = 즉시 «지금 색 100%→0%», 솔리드 탭 = 마지막 단색, 같은 탭 재클릭 = 기록 0', async ({ page }) => {
  const errs = await boot(page);
  await openShape(page, 'shpA');
  await openSwatchOf(page, 'shape-color-color');
  const h0 = await hist(page);
  expect(await activeTab(page)).toBe('solid');

  await tab(page, 'gradient').click();
  let s = await shapeState(page, 'shpA');
  expect(s.grad, '그라데이션 탭을 눌렀는데 도형에 그라데이션이 안 들어갔다(탭이 화면만 바꿈 — 원래 버그)').not.toBeNull();
  expect(s.grad.type).toBe('linear');
  expect(s.grad.angle).toBe(90);
  expect(s.grad.stops).toEqual([
    { color: '#3366ff', offset: 0, opacity: 1 },
    { color: '#3366ff', offset: 1, opacity: 0 },
  ]);
  expect(s.fillAttr).toBe('url(#grad-shpA)');
  expect(await hist(page) - h0, '탭 1번 = 기록 1번(이중 쌓임이면 2)').toBe(1);

  await tab(page, 'gradient').click();          // 같은 탭 다시
  expect(await hist(page) - h0, '같은 그라데이션 탭 재클릭이 기록을 쌓았다').toBe(1);

  await tab(page, 'solid').click();
  s = await shapeState(page, 'shpA');
  expect(s.grad).toBeNull();
  expect(s.fillAttr).toBe('currentColor');
  expect(s.svgColor).toBe('rgb(51, 102, 255)');
  expect(await hist(page) - h0).toBe(2);

  await tab(page, 'solid').click();             // 같은 탭 다시
  expect(await hist(page) - h0, '같은 솔리드 탭 재클릭이 기록을 쌓았다').toBe(2);

  // 같은 세션에서 다시 그라데이션 → 직전 스톱이 복원된다(피그마와 같은 동작)
  await tab(page, 'gradient').click();
  s = await shapeState(page, 'shpA');
  expect(s.grad.stops[1].opacity).toBe(0);
  expect(await hist(page) - h0).toBe(3);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('T4 ★도형: 이미지 탭 = 바둑판(계산된 fill 이 체커 패턴), 솔리드 복귀 = 단색, 각 1회 기록', async ({ page }) => {
  const errs = await boot(page);
  await openShape(page, 'shpA');
  await openSwatchOf(page, 'shape-color-color');
  const h0 = await hist(page);
  await tab(page, 'gradient').click();
  await tab(page, 'image').click();
  let s = await shapeState(page, 'shpA');
  expect(s.shapeFill).toBe('image');
  expect(s.grad, '이미지 모드로 갔는데 그라데이션이 남았다').toBeNull();
  expect(s.computedFill, '바둑판이 «보이지» 않는다 — 계산된 fill 이 체커 패턴이 아니다').toContain('goya-shape-checker');
  expect(await page.evaluate(() => !!document.getElementById('goya-shape-checker')), '체커 패턴 정의가 문서에 없다').toBe(true);
  expect(await hist(page) - h0).toBe(2);

  await tab(page, 'solid').click();
  s = await shapeState(page, 'shpA');
  expect(s.shapeFill).toBeNull();
  expect(s.computedFill).toBe('rgb(51, 102, 255)');
  expect(await hist(page) - h0).toBe(3);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('T4c ★도형: 그라데이션→이미지 뒤 패널을 다시 그려도 솔리드 복귀 = 마지막 단색(회색 #cccccc 아님), shapeColor 에 그라데이션 CSS 안 남음', async ({ page }) => {
  const errs = await boot(page);
  await openShape(page, 'shpA');
  await openSwatchOf(page, 'shape-color-color');
  await tab(page, 'gradient').click();
  await tab(page, 'image').click();
  let sc = await page.evaluate(() => document.getElementById('shpA').dataset.shapeColor);
  expect(sc, '이미지 모드인데 shapeColor 에 그라데이션 CSS 가 남았다(피그마 내보내기 오염)').toBe('#3366ff');
  await page.evaluate(() => window.closeGoyaColorPicker());
  // 선택 해제 → 재선택 = 패널 재그리기(native input 새로 생성)
  await openShape(page, 'shpA');
  expect(await page.evaluate(() => document.getElementById('shape-color-color').value)).toBe('#3366ff');
  await openSwatchOf(page, 'shape-color-color');
  expect(await page.evaluate(() => document.querySelector('.goya-cp-tab.active')?.dataset.tab)).toBe('image');
  const h0 = await hist(page);
  await tab(page, 'solid').click();
  const s = await shapeState(page, 'shpA');
  expect(s.shapeFill).toBeNull();
  expect(s.computedFill, '솔리드 복귀가 마지막 단색이 아니다').toBe('rgb(51, 102, 255)');
  expect(await page.evaluate(() => document.getElementById('shpA').dataset.shapeColor)).toBe('#3366ff');
  expect(await hist(page) - h0).toBe(1);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('T4d 바둑판은 편집 캔버스 전용 — 미리보기(#preview-overlay 로 복사된 같은 도형)엔 마지막 단색', async ({ page }) => {
  const errs = await boot(page);
  await openShape(page, 'shpA');
  await openSwatchOf(page, 'shape-color-color');
  await tab(page, 'image').click();
  const r = await page.evaluate(() => {
    const ov = document.createElement('div');
    ov.id = 'preview-overlay';
    ov.innerHTML = '<div class="preview-page-inner">' + document.getElementById('shpA').outerHTML.replace('id="shpA"', 'id="shpA-prev"') + '</div>';
    document.body.appendChild(ov);
    const fillOf = (sel) => getComputedStyle(document.querySelector(sel + ' svg.shape-svg rect')).fill;
    return { canvas: fillOf('#shpA'), preview: fillOf('#shpA-prev') };
  });
  expect(r.canvas).toContain('goya-shape-checker');
  expect(r.preview, '미리보기에 바둑판이 보인다').toBe('rgb(51, 102, 255)');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('T4b 도형: 이미지 모드에서 가림막이 켜지면 바둑판이 아니라 가림막(fill:none)이 이긴다', async ({ page }) => {
  await boot(page);
  await openShape(page, 'shpA');
  await openSwatchOf(page, 'shape-color-color');
  await tab(page, 'image').click();
  const fill = await page.evaluate(() => {
    const b = document.getElementById('shpA');
    b.classList.add('shape-redact');
    return getComputedStyle(b.querySelector('svg rect')).fill;
  });
  expect(fill).toBe('none');
});

test('T5 다시 열기: 그라데이션/이미지 도형은 그 탭으로 «보여주기만» — 여는 것만으로 기록 0', async ({ page }) => {
  const errs = await boot(page);
  await openShape(page, 'shpA');
  await openSwatchOf(page, 'shape-color-color');
  await tab(page, 'gradient').click();
  await page.evaluate(() => window.closeGoyaColorPicker());
  // 패널을 다시 그린다(선택을 다시 한 것과 같음) → native input 이 새로 생긴다
  await openShape(page, 'shpA');
  const h0 = await hist(page);
  await openSwatchOf(page, 'shape-color-color');
  expect(await activeTab(page)).toBe('gradient');
  expect(await hist(page) - h0, '열기만 했는데 기록이 쌓였다(seed 가 커밋함)').toBe(0);

  await tab(page, 'image').click();
  await page.evaluate(() => window.closeGoyaColorPicker());
  await openShape(page, 'shpA');
  const h1 = await hist(page);
  await openSwatchOf(page, 'shape-color-color');
  expect(await activeTab(page)).toBe('image');
  expect(await hist(page) - h1).toBe(0);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('T6 싱글턴 누수: A 에서 radial·30° 를 만든 뒤 B 의 그라데이션 탭은 linear·90°·B 의 색에서 시작', async ({ page }) => {
  const errs = await boot(page);
  await openShape(page, 'shpA');
  await openSwatchOf(page, 'shape-color-color');
  await tab(page, 'gradient').click();
  await page.selectOption('.goya-cp-grad-type-select', 'radial');
  await page.evaluate(() => {
    const n = document.querySelector('[data-el="gradAngleNum"]');
    n.value = '30'; n.dispatchEvent(new Event('change'));
  });
  await page.evaluate(() => window.closeGoyaColorPicker());

  await openShape(page, 'shpB');
  await openSwatchOf(page, 'shape-color-color');
  expect(await activeTab(page)).toBe('solid');
  await tab(page, 'gradient').click();
  const s = await shapeState(page, 'shpB');
  expect(s.grad.type).toBe('linear');
  expect(s.grad.angle).toBe(90);
  expect(s.grad.stops[0].color).toBe('#22aa44');
  expect(s.grad.stops[1]).toEqual({ color: '#22aa44', offset: 1, opacity: 0 });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('T7 ★능력 게이트: 그라데이션을 못 받는 필드는 탭이 막히고 눌러도 이벤트 0 — 양성대조: onGradient 필드는 열림', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => {
    const host = document.getElementById('plain-field');
    host.innerHTML = window.__cfHTML({ idPrefix: 'plain', hex: '#aa0000' }) + window.__cfHTML({ idPrefix: 'grad', hex: '#00aa00' });
    window.__evts = 0;
    window.__wireCF('plain', { onApply: () => {} });
    window.__wireCF('grad', { onApply: () => {}, onGradient: () => { window.__evts++; } });
    for (const id of ['plain-color', 'grad-color']) {
      const el = document.getElementById(id);
      ['goya-cp:gradient', 'goya-cp:image'].forEach(t => el.addEventListener(t, () => { window['__e_' + id] = (window['__e_' + id] || 0) + 1; }));
    }
  });
  await openSwatchOf(page, 'plain-color');
  expect(await tab(page, 'gradient').isDisabled()).toBe(true);
  expect(await tab(page, 'image').isDisabled()).toBe(true);
  expect(await tab(page, 'gradient').getAttribute('data-tip')).toContain('지원하지 않아요');
  await tab(page, 'gradient').click({ force: true });
  await tab(page, 'image').click({ force: true });
  expect(await page.evaluate(() => window['__e_plain-color'] || 0)).toBe(0);
  await page.evaluate(() => window.closeGoyaColorPicker());

  await openSwatchOf(page, 'grad-color');
  expect(await tab(page, 'gradient').isDisabled()).toBe(false);
  expect(await tab(page, 'image').isDisabled()).toBe(true);
  await tab(page, 'gradient').click();
  expect(await page.evaluate(() => window['__e_grad-color'] || 0)).toBeGreaterThan(0);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('T8 툴팁: 탭에 native title 이 없고, 호버하면 즉시 한글 설명이 뜨며 팝오버 안에 들어간다', async ({ page }) => {
  await boot(page);
  await openShape(page, 'shpA');
  await openSwatchOf(page, 'shape-color-color');
  for (const name of ['solid', 'gradient', 'image']) {
    expect(await tab(page, name).getAttribute('title')).toBeNull();
    await tab(page, name).hover();
    const tip = await page.evaluate((n) => {
      const t = document.querySelector(`.goya-cp-tab[data-tab="${n}"]`);
      const cs = getComputedStyle(t, '::after');
      return { content: cs.content, left: cs.left, maxW: cs.maxWidth, pos: cs.position };
    }, name);
    expect(tip.content, `${name} 탭 호버 설명이 없다`).toMatch(/채우기/);
    expect(tip.pos).toBe('absolute');
    expect(tip.left).toBe('0px');
  }
  // 기준(containing block) = 탭 줄 — 탭 줄 왼쪽 + 최대폭 이 팝오버 안에 들어가야 잘리지 않는다
  const fit = await page.evaluate(() => {
    const pop = document.querySelector('.goya-cp-popover').getBoundingClientRect();
    const tabs = document.querySelector('.goya-cp-tabs').getBoundingClientRect();
    const tabPos = getComputedStyle(document.querySelector('.goya-cp-tab')).position;
    return { right: tabs.left + 200 + 16, popRight: pop.right, tabPos };
  });
  expect(fit.tabPos, '탭에 position 이 생기면 툴팁 기준이 탭으로 바뀌어 가장자리가 잘린다').toBe('static');
  expect(fit.right).toBeLessThanOrEqual(fit.popRight);
});

test('T9 페이지 바탕: 그라데이션 탭 = 기록 정확히 1회(이중 쌓임 회귀), 솔리드 복귀 = bgGradient·시드 둘 다 지움', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => window.__wirePage());
  const h0 = await hist(page);
  await openSwatchOf(page, 'page-bg-color');
  expect(await tab(page, 'image').isDisabled()).toBe(true);
  await tab(page, 'gradient').click();
  let st = await page.evaluate(() => ({ g: window.state.pageSettings.bgGradient || null, seed: document.getElementById('page-bg-color').dataset.cpGradient || null }));
  expect(st.g).not.toBeNull();
  expect(JSON.parse(st.g).stops[0].color).toBe('#828282');
  expect(await hist(page) - h0).toBe(1);
  await tab(page, 'solid').click();
  st = await page.evaluate(() => ({ g: window.state.pageSettings.bgGradient || null, seed: document.getElementById('page-bg-color').dataset.cpGradient || null }));
  expect(st.g).toBeNull();
  expect(st.seed, '솔리드로 갔는데 재오픈 시드가 남아 다음에 열면 그라데이션 탭이 뜬다').toBeNull();
  expect(await hist(page) - h0).toBe(2);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('T10 ★텍스트(②안): 글자색 피커는 그라데이션·이미지 탭 비활성 + 이유 툴팁, 눌러도 글자·기록 불변', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => window.__text(document.getElementById('tb1')));
  const h0 = await hist(page);
  await openSwatchOf(page, 'txt-color');
  expect(await tab(page, 'solid').isDisabled()).toBe(false);
  expect(await tab(page, 'gradient').isDisabled(), '글자색에서 그라데이션 탭이 열려 있다(②안 위반)').toBe(true);
  expect(await tab(page, 'image').isDisabled()).toBe(true);
  expect(await tab(page, 'gradient').getAttribute('data-tip')).toContain('단색만');
  // ★막힌 탭 자신에 opacity 를 주면 쌓임 맥락이 생겨 호버 설명(::after)이 흐려지고 SV 박스 밑에 깔린다(실앱 9503 실측)
  const op = await page.evaluate(() => {
    const t = document.querySelector('.goya-cp-tab[data-tab="gradient"]');
    return { tab: getComputedStyle(t).opacity, child: getComputedStyle(t.firstElementChild).opacity };
  });
  expect(op.tab, '막힌 탭 자신이 흐려져 툴팁까지 흐려지고 밑에 깔린다').toBe('1');
  expect(Number(op.child)).toBeLessThan(1);
  await tab(page, 'gradient').click({ force: true });
  const cs = await page.evaluate(() => {
    const el = document.querySelector('#tb1 .tb-body');
    const c = getComputedStyle(el);
    return { clip: c.webkitBackgroundClip || c.backgroundClip, fillc: c.webkitTextFillColor, img: c.backgroundImage, tg: el.dataset.textGradient || null,
             active: document.querySelector('.goya-cp-tab.active')?.dataset.tab };
  });
  expect(cs.clip).not.toBe('text');
  expect(cs.img).toBe('none');
  expect(cs.tg).toBeNull();
  expect(cs.active).toBe('solid');
  expect(await hist(page) - h0).toBe(0);
  // 글자 그라데이션 신규 기능 코드가 로드돼 있지 않다
  expect(await page.evaluate(() => typeof window.applyTextGradient)).toBe('undefined');
  expect(errs, errs.join(' | ')).toEqual([]);
});

// 1×1 빨간 PNG
const RED_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64');

test('T11 도형: 이미지 탭에서 사진을 올리면 = 도형 면이 그 사진(인라인), 바둑판은 꺼지고 기록 1회 — 솔리드 복귀 = 사진 제거', async ({ page }) => {
  const errs = await boot(page);
  await openShape(page, 'shpA');
  await openSwatchOf(page, 'shape-color-color');
  await tab(page, 'image').click();
  const h0 = await hist(page);
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('[data-el="imgZone"]'),
  ]);
  await chooser.setFiles({ name: 'red.png', mimeType: 'image/png', buffer: RED_PNG });
  await page.waitForFunction(() => !!document.querySelector('#shpA > .shape-img-fill'));
  const s = await page.evaluate(() => {
    const b = document.getElementById('shpA');
    const img = b.querySelector(':scope > .shape-img-fill');
    return {
      hasImg: b.dataset.shapeImage, fill: b.dataset.shapeFill,
      bg: img.style.backgroundImage.slice(0, 30),
      rectFill: getComputedStyle(b.querySelector('svg rect')).fill,
    };
  });
  expect(s.fill).toBe('image');
  expect(s.hasImg).toBe('1');
  expect(s.bg).toContain('data:image/png');
  expect(s.rectFill, '사진이 들어갔는데 SVG 면이 여전히 칠해져 사진을 가린다(또는 바둑판)').toBe('rgba(0, 0, 0, 0)');
  expect(await hist(page) - h0).toBe(1);

  await tab(page, 'solid').click();
  const after = await page.evaluate(() => {
    const b = document.getElementById('shpA');
    return { img: !!b.querySelector(':scope > .shape-img-fill'), fill: b.dataset.shapeFill || null, rectFill: getComputedStyle(b.querySelector('svg rect')).fill };
  });
  expect(after).toEqual({ img: false, fill: null, rectFill: 'rgb(51, 102, 255)' });
  expect(errs, errs.join(' | ')).toEqual([]);
});
