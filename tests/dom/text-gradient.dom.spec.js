/* text-gradient.dom.spec.js — 0918r2 textgrad (T-059 확장): 글자 그라데이션 (현빈 결정 = 피그마 기준)
 *
 * ★«패널 경로»로 잰다 — 진짜 스와치를 진짜 마우스로 눌러 피커를 열고, 진짜 탭을 누른다.
 * ★되돌리기는 «HTML 스냅샷» 미니 히스토리로 잰다 — 앱 history.js 와 같은 성질(스냅샷 = 바뀐 뒤 상태, undo = 직전 스냅샷 복원).
 * ★보이는 것은 dataset 이 아니라 getComputedStyle 로 잰다(background-clip·text-fill·color).
 *
 * ⛔앱을 «안» 띄운다 — 레포 파일만 크로미움에 얹는다.
 * 실행: npm run test:dom -- text-gradient
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-panels.css">
<link rel="stylesheet" href="/css/editor-props.css">
<link rel="stylesheet" href="/css/color-picker.css">
<link rel="stylesheet" href="/css/editor-blocks.css">
<style>#panel-right{position:fixed;left:0;top:0;width:240px;} #canvas{position:absolute;left:600px;top:0;width:600px;}</style>
</head><body>
<div id="canvas"><div class="section-block"><div class="section-inner" id="host">
  <div class="text-block" id="tb1" data-type="body"><div class="tb-body" contenteditable="false" style="font-size:40px;color:#cc2244">그라데이션 글자</div></div>
  <div class="text-block" id="tb2" data-type="heading"><div class="tb-h1" contenteditable="false" style="color:#1144aa">둘째 글자 블럭</div></div>
  <div class="text-block" id="tb3" data-type="label"><div class="tb-label" contenteditable="false">라벨</div></div>
</div></div></div>
<div id="panel-right"><div class="panel-body"></div></div>
<script src="/js/block-edit.js"></script>
<script type="module">
  import '/js/props/color-picker.js';
  import { showTextProperties } from '/js/props/prop-text.js';
  import { neutralizeTextGradForH2C } from '/js/io/capture-safety.js';
  const host = document.getElementById('host');
  window.__snaps = [host.innerHTML];
  window.pushHistory = () => { window.__snaps.push(host.innerHTML); };
  window.__undo = () => {
    if (window.__snaps.length < 2) return false;
    window.__snaps.pop();
    host.innerHTML = window.__snaps[window.__snaps.length - 1];
    return true;
  };
  window.scheduleAutoSave = () => {};
  window.getBlockBreadcrumb = () => '';
  window.__text = showTextProperties;
  window.__h2c = neutralizeTextGradForH2C;
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

const snaps = (page) => page.evaluate(() => window.__snaps.length);
const tab = (page, name) => page.locator(`.goya-cp-tab[data-tab="${name}"]`);
const activeTab = (page) => page.evaluate(() => document.querySelector('.goya-cp-tab.active')?.dataset.tab);
const select = (page, id) => page.evaluate((i) => window.__text(document.getElementById(i)), id);
async function openTxtPicker(page) {
  await page.locator('#txt-color').locator('xpath=..').click();
  await expect(page.locator('.goya-cp-popover')).toBeVisible();
}
async function closePicker(page) {
  await page.evaluate(() => window.closeGoyaColorPicker());
  await expect(page.locator('.goya-cp-popover')).toBeHidden();
}
const look = (page, id) => page.evaluate((i) => {
  const el = document.querySelector(`#${i} [class^="tb-"]`);
  const c = getComputedStyle(el);
  return {
    clip: c.backgroundClip, fill: c.webkitTextFillColor, img: c.backgroundImage, color: c.color, caret: c.caretColor,
    tg: window.getTextGradient(el),
  };
}, id);

test('G1 탭 한 번 = 즉시 «지금 색 100%→0%» + 기록 1회 → 되돌리기 1회 = 원래 단색(글자색·배경 둘 다)', async ({ page }) => {
  const errs = await boot(page);
  await select(page, 'tb1');
  const before = await look(page, 'tb1');
  expect(before.clip).not.toBe('text');
  const s0 = await snaps(page);
  await openTxtPicker(page);
  await tab(page, 'gradient').click();
  const g = await look(page, 'tb1');
  expect(g.clip).toBe('text');
  expect(g.fill).toBe('rgba(0, 0, 0, 0)');
  expect(g.tg.type).toBe('linear');
  expect(g.tg.angle).toBe(90);
  expect(g.tg.stops).toEqual([{ color: '#cc2244', offset: 0, opacity: 1 }, { color: '#cc2244', offset: 1, opacity: 0 }]);
  expect(g.color, '대체색(캐럿·H2C) = 첫 스탑').toBe('rgb(204, 34, 68)');
  expect(await snaps(page) - s0, '탭 한 번 = 기록 한 번').toBe(1);
  await closePicker(page);
  await page.evaluate(() => window.__undo());
  const u = await look(page, 'tb1');
  expect(u.clip).not.toBe('text');
  expect(u.img).toBe('none');
  expect(u.fill).toBe('rgb(204, 34, 68)');
  expect(u.color).toBe('rgb(204, 34, 68)');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('G2 스탑 드래그: 움직이는 동안 기록 0, 마우스업에 1회 — 값은 드래그 중에도 캔버스에 실시간', async ({ page }) => {
  const errs = await boot(page);
  await select(page, 'tb1');
  await openTxtPicker(page);
  await tab(page, 'gradient').click();
  const s0 = await snaps(page);
  const thumb = page.locator('.goya-cp-grad-thumb').nth(1);
  const bb = await thumb.boundingBox();
  const bar = await page.locator('.goya-cp-grad-thumb').first().evaluate(t => t.parentElement.getBoundingClientRect().toJSON());
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.mouse.down();
  await page.mouse.move(bar.x + bar.width * 0.7, bb.y + bb.height / 2, { steps: 6 });
  await page.waitForTimeout(80);
  expect(await snaps(page) - s0, '드래그 중 기록이 쌓인다(되돌리기가 프레임 단위로 쪼개짐)').toBe(0);
  const mid = await look(page, 'tb1');
  expect(Math.round(mid.tg.stops[1].offset * 100)).toBeLessThan(90);
  await page.mouse.up();
  await page.waitForTimeout(80);
  expect(await snaps(page) - s0).toBe(1);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('G3 솔리드 탭 복귀 = 직전 단색, 그라데이션·재오픈 시드 없음, 기록 1회', async ({ page }) => {
  const errs = await boot(page);
  await select(page, 'tb1');
  await openTxtPicker(page);
  await tab(page, 'gradient').click();
  const s0 = await snaps(page);
  await tab(page, 'solid').click();
  const s = await look(page, 'tb1');
  expect(s.clip).not.toBe('text');
  expect(s.img).toBe('none');
  expect(s.fill).toBe('rgb(204, 34, 68)');
  expect(await page.evaluate(() => document.getElementById('txt-color').dataset.cpGradient || null)).toBeNull();
  expect(await page.evaluate(() => document.querySelector('#tb1 .tb-body').getAttribute('style'))).not.toMatch(/caret-color|background-clip|text-fill/);
  expect(await snaps(page) - s0).toBe(1);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('G4 다시 선택 → 피커가 그라데이션 탭으로, 스탑이 «실제 값»으로 열린다(기본값으로 덮지 않음) · 여는 것만으론 기록 0', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => window.applyTextGradient(document.getElementById('tb1'),
    { css: 'linear-gradient(45deg, #00aa55 0%, #3300ff 60%, rgba(255,136,0,0.500) 100%)' }, { commit: true }));
  await select(page, 'tb2');
  await select(page, 'tb1');
  const sw = await page.evaluate(() => document.getElementById('txt-color').closest('.prop-color-swatch').style.background);
  expect(sw, '스와치가 그라데이션을 안 보여준다').toContain('linear-gradient');
  const s0 = await snaps(page);
  await openTxtPicker(page);
  expect(await activeTab(page)).toBe('gradient');
  const ui = await page.evaluate(() => ({
    n: document.querySelectorAll('.goya-cp-grad-thumb').length,
    angle: document.querySelector('.goya-cp-popover [data-el="gradAngleNum"], .goya-cp-popover .goya-cp-grad-angle-num')?.value || null,
  }));
  expect(ui.n).toBe(3);
  const g = await look(page, 'tb1');
  expect(g.tg.angle).toBe(45);
  expect(g.tg.stops.map(s => [s.color, Math.round(s.offset * 100), s.opacity])).toEqual([['#00aa55', 0, 1], ['#3300ff', 60, 1], ['#ff8800', 100, 0.5]]);
  expect(await snaps(page) - s0, '열기만 했는데 기록이 쌓였다').toBe(0);
  // 그라데이션 탭을 다시 눌러도 사용자 값 유지(기본값 덮어쓰기 금지)
  await tab(page, 'gradient').click();
  const g2 = await look(page, 'tb1');
  expect(g2.tg.stops.length).toBe(3);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('G5 저장→재로드(innerHTML → sanitizeCanvasHtml → 다시 넣기) 뒤에도 computed 가 같다', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => window.applyTextGradient(document.getElementById('tb1'),
    { css: 'linear-gradient(90deg, #cc2244 0%, rgba(204,34,68,0.000) 100%)' }, { commit: true }));
  const a = await look(page, 'tb1');
  const ok = await page.evaluate(async () => {
    await import('/js/io/save-load.js').catch(() => {});
    if (typeof window.sanitizeCanvasHtml !== 'function') return false;
    const host = document.getElementById('host');
    const html = host.innerHTML;
    host.innerHTML = '';
    host.innerHTML = window.sanitizeCanvasHtml(html);
    return true;
  });
  expect(ok, 'sanitizeCanvasHtml 을 못 불렀다(측정 불가)').toBe(true);
  const b = await look(page, 'tb1');
  expect(b.clip).toBe('text');
  expect(b).toEqual(a);
  expect(errs.filter(e => !/save-load/.test(e)), errs.join(' | ')).toEqual([]);
});

test('G6 단색 경로가 그라데이션을 푼다: 스포이드(applyTextBlockColor) · MCP 편집(editTextBlock) · hex 입력 · 라벨로 타입 전환', async ({ page }) => {
  const errs = await boot(page);
  const put = () => page.evaluate(() => window.applyTextGradient(document.getElementById('tb1'),
    { css: 'linear-gradient(90deg, #cc2244 0%, rgba(204,34,68,0.000) 100%)' }, { commit: true }));
  await put();
  await page.evaluate(() => window.applyTextBlockColor(document.getElementById('tb1'), '#00ff00'));
  let s = await look(page, 'tb1');
  expect(s.clip, '스포이드 단색이 그라데이션에 가려진다').not.toBe('text');
  expect(s.fill).toBe('rgb(0, 255, 0)');

  await put();
  const r = await page.evaluate(() => window.editTextBlock('tb1', { color: '#0000ff' }));
  expect(r.ok).not.toBe(false);
  s = await look(page, 'tb1');
  expect(s.clip, 'MCP 단색이 그라데이션에 가려진다').not.toBe('text');
  expect(s.fill).toBe('rgb(0, 0, 255)');

  await put();
  await select(page, 'tb1');
  await page.fill('#txt-color-hex', '112233');
  s = await look(page, 'tb1');
  expect(s.clip, 'hex 입력 단색이 그라데이션에 가려진다').not.toBe('text');
  expect(s.fill).toBe('rgb(17, 34, 51)');

  await put();
  await select(page, 'tb1');
  await page.click('.prop-type-btn[data-cls="tb-label"]');
  s = await look(page, 'tb1');
  expect(s.clip, '라벨로 바꿨는데 그라데이션이 남아 박스 배경까지 잘린다').not.toBe('text');
  expect(await page.evaluate(() => document.getElementById('txt-color').dataset.cpModes)).toBe('solid');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('G7 그라데이션 글자 안의 부분 단색 span 은 보인다(채움색 ≠ transparent) — 전체 단색으로 바꾸면 잔재 없음', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => window.applyTextGradient(document.getElementById('tb1'),
    { css: 'linear-gradient(90deg, #cc2244 0%, #2244cc 100%)' }, { commit: true }));
  await page.evaluate(() => {
    const el = document.querySelector('#tb1 .tb-body');
    const t = el.firstChild;
    const r = document.createRange(); r.setStart(t, 0); r.setEnd(t, 3);
    window.applyColorToSelection('#00ff00', el, r, null);
  });
  const span = await page.evaluate(() => {
    const sp = document.querySelector('#tb1 .tb-body span');
    return sp ? getComputedStyle(sp).webkitTextFillColor : null;
  });
  expect(span, '부분 단색 span 이 투명(상속)이라 글자가 사라진다').toBe('rgb(0, 255, 0)');
  await page.evaluate(() => window.applyTextBlockColor(document.getElementById('tb1'), '#000000'));
  expect(await page.evaluate(() => document.querySelector('#tb1 .tb-body').innerHTML)).not.toMatch(/text-fill/);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('G8 편집 모드 가시성: 캐럿 색 = 첫 스탑, 선택 영역(::selection)의 채움색이 transparent 가 아니다 · 형광펜 버튼 막힘', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => window.applyTextGradient(document.getElementById('tb1'),
    { css: 'linear-gradient(90deg, #cc2244 0%, rgba(204,34,68,0.000) 100%)' }, { commit: true }));
  const v = await page.evaluate(() => {
    const el = document.querySelector('#tb1 .tb-body');
    el.contentEditable = 'true';
    return {
      caret: getComputedStyle(el).caretColor,
      selFill: getComputedStyle(el, '::selection').webkitTextFillColor,
    };
  });
  expect(v.caret).toBe('rgb(204, 34, 68)');
  expect(v.selFill, '선택하면 글자가 투명해 안 보인다').not.toBe('rgba(0, 0, 0, 0)');
  await select(page, 'tb1');
  const hl = await page.evaluate(() => { const b = document.getElementById('txt-highlight-btn'); return b ? { d: b.disabled, t: b.title } : null; });
  if (hl) { expect(hl.d).toBe(true); expect(hl.t).toContain('그라데이션'); }
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('G9 html2canvas 대체: neutralizeTextGradForH2C 뒤 clip 없음 · 글자색 = 첫 스탑 · 다른 요소 불변', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => window.applyTextGradient(document.getElementById('tb1'),
    { css: 'linear-gradient(90deg, #cc2244 0%, #2244cc 100%)' }, { commit: true }));
  const r = await page.evaluate(() => {
    const clone = document.getElementById('host').cloneNode(true);
    document.body.appendChild(clone);
    window.__styleAttr = clone.querySelector('#tb1 .tb-body').getAttribute('style');
    const n = window.__h2c(clone);
    const el = clone.querySelector('#tb1 .tb-body');
    const c = getComputedStyle(el);
    const out = { n, clip: c.backgroundClip, img: c.backgroundImage, fill: c.webkitTextFillColor,
      live: getComputedStyle(document.querySelector('#host #tb1 .tb-body')).backgroundClip };
    clone.remove();
    return out;
  });
  expect(r.n, await page.evaluate(() => window.__styleAttr)).toBe(1);
  expect(r.clip).not.toBe('text');
  expect(r.img).toBe('none');
  expect(r.fill).toBe('rgb(204, 34, 68)');
  expect(r.live, '클론만 바뀌어야 하는데 라이브 캔버스가 바뀌었다').toBe('text');
  expect(errs, errs.join(' | ')).toEqual([]);
});
