/* text-align-gradient-t402.dom.spec.js — t4-02 (현빈 tb_rwx4l_atr5nd1): 글자 정렬을 바꾸면 그라데이션이 글자를 따라가야 한다.
 *
 * 뿌리: background-clip:text 는 그라데이션을 «상자» 전체(600px)에 깐다 — 정렬로 글자(267px)만 옮기면 글자는
 *   가운데 28~72% · 오른쪽 55~100% 구간만 받았다(기본 «100%→0%»면 오른쪽 정렬 글자는 거의 투명 = 「다시 걸어도 안 먹음」).
 * ★진짜 클릭: .prop-align-group 단추 · 피커 탭. 그라데이션 «시작·끝 x» = computed background-size/position 으로
 *   계산한 칠 구간, 글자 «왼·오른 끝» = 글자 노드 Range 의 줄 사각형 합. ±2px. 픽셀 하나도 직접 잰다(T1).
 * ⛔앱을 «안» 띄운다. 하네스 = text-gradient.dom.spec.js 와 같은 꼴(+editor-layout.css · 넓은 상자).
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
<link rel="stylesheet" href="/css/editor-layout.css">
<style>#panel-right{position:fixed;left:0;top:0;width:240px;} #canvas{position:absolute;left:600px;top:0;width:600px;}</style>
</head><body>
<div id="canvas"><div class="section-block"><div class="section-inner" id="host">
  <div class="text-block" id="tb1" data-type="body"><div class="tb-body" contenteditable="false" style="font-size:40px;color:#cc2244">그라데이션 글자</div></div>
  <div class="text-block" id="tb2" data-type="heading"><div class="tb-h1" contenteditable="false" style="color:#1144aa">둘째 글자 블럭</div></div>
  <div class="text-block" id="tb3" data-type="label"><div class="tb-label" contenteditable="false">라벨</div></div>
</div></div></div>
<div id="panel-right"><div class="panel-body"></div></div>
<!-- ★2026-09-21(T-079): selectBlock 의 패널 디스패치가 js/panel-dispatch.js 로 빠졌다.
     block-edit.js 를 얹는 하네스는 이 줄을 «앞»에 같이 얹어야 한다(실제 index.html 과 같은 순서).
     빼면 openPanelForBlock 이 undefined 인데 호출이 옵셔널 체이닝이라 «예외도 없이» 패널만
     안 열린다 = 「패널을 못 열고도 초록」. 짝을 tests/unit/layer-panel-panel-table U-DISPATCH-6 이 센다. -->
<script src="/js/panel-dispatch.js"></script>
<script src="/js/block-edit.js"></script>
<script src="/js/text-effect-transform.js"></script>
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


const ALIGN = (page, a) => page.click(`.prop-align-group .prop-align-btn[data-align="${a}"]`);
// 칠 구간 [시작, 끝] vs 글자 [왼, 오른] (화면 px — 하네스는 줌 없음)
const span = (page, id) => page.evaluate((i) => {
  const el = document.querySelector(`#${i} [class^="tb-"]`);
  const c = getComputedStyle(el);
  const b = el.getBoundingClientRect();
  const pl = parseFloat(c.paddingLeft), pr = parseFloat(c.paddingRight), bl = parseFloat(c.borderLeftWidth), br = parseFloat(c.borderRightWidth);
  const box = c.backgroundOrigin === 'content-box' ? [b.left + bl + pl, b.right - br - pr] : [b.left + bl, b.right - br];
  const bw = box[1] - box[0];
  const sz = c.backgroundSize.split(' ')[0];
  const gw = sz === 'auto' ? bw : sz.endsWith('%') ? bw * parseFloat(sz) / 100 : parseFloat(sz);
  const px = c.backgroundPosition.split(' ')[0];
  const gx = box[0] + (px.endsWith('%') ? (bw - gw) * parseFloat(px) / 100 : parseFloat(px));
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); const r = document.createRange();
  let L = Infinity, R = -Infinity; const lines = [];
  for (let n = w.nextNode(); n; n = w.nextNode()) { r.selectNodeContents(n); for (const q of r.getClientRects()) if (q.width) { L = Math.min(L, q.left); R = Math.max(R, q.right); lines.push(Math.round(q.width)); } }
  return { g: [gx, gx + gw], t: [L, R], box: [b.left, b.right], lines, clip: c.backgroundClip, img: c.backgroundImage, fill: c.webkitTextFillColor, align: c.textAlign };
}, id);
async function tracks(page, id, why) {
  const s = await span(page, id);
  expect(s.clip, why).toBe('text');
  expect(s.img, why).toContain('gradient');
  expect(Math.abs(s.g[0] - s.t[0]), `${why} 시작 x ${s.g[0]} vs 글자 왼끝 ${s.t[0]} (상자 ${s.box})`).toBeLessThanOrEqual(2);
  expect(Math.abs(s.g[1] - s.t[1]), `${why} 끝 x ${s.g[1]} vs 글자 오른끝 ${s.t[1]}`).toBeLessThanOrEqual(2);
  return s;
}
async function gradByClick(page) {
  await openTxtPicker(page);
  await tab(page, 'gradient').click();
  await closePicker(page);
}

test('T1 왼·가운데·오른쪽 각각 칠 구간 = 글자 양끝(±2) · 오른쪽 정렬 글자 왼끝 픽셀이 «진하다»(옛: 55% 지점이라 반투명)', async ({ page }) => {
  const errs = await boot(page);
  await select(page, 'tb1');
  await gradByClick(page);
  const s0 = await span(page, 'tb1');
  expect(s0.t[1] - s0.t[0], '상자보다 좁은 글자여야 의미가 있다').toBeLessThan((s0.box[1] - s0.box[0]) * 0.6);
  for (const a of ['left', 'center', 'right']) {
    await ALIGN(page, a);
    const s = await tracks(page, 'tb1', a);
    expect(s.align).toBe(a);
  }
  // 픽셀: 오른쪽 정렬 · 첫 글자 왼쪽 1/4 구역의 가장 진한 픽셀 알파(흰 바탕 → 255−min 채널 차)
  const s = await span(page, 'tb1');
  const shot = await page.screenshot({ clip: { x: s.t[0], y: (await page.locator('#tb1 .tb-body').boundingBox()).y, width: 20, height: 60 } });
  const dark = await page.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data; let m = 0;
    for (let i = 0; i < d.length; i += 4) m = Math.max(m, 255 - d[i + 1]);   // 초록 채널 = #cc2244 가 가장 깊다(255→34)
    return m;
  }, shot.toString('base64'));
  expect(dark, '오른쪽 정렬 글자의 왼끝이 그라데이션 «시작색»이 아니다(흐리다)').toBeGreaterThan(180);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('T2 반복 L→C→R→L→C 뒤에도 따라감 → 솔리드 = 그라데이션 없음·단색 → 다시 그라데이션 = 걸리고 따라감 · 각 동작 기록 1칸·⌘Z 1번 = 직전', async ({ page }) => {
  const errs = await boot(page);
  await select(page, 'tb1');
  await gradByClick(page);
  for (const a of ['left', 'center', 'right', 'left', 'center']) {
    const n0 = await snaps(page);
    const prev = await span(page, 'tb1');
    await ALIGN(page, a);
    await tracks(page, 'tb1', `반복 ${a}`);
    expect(await snaps(page) - n0, `${a} 한 번 = 기록 한 칸`).toBe(1);
    // ⌘Z 1번 = 직전 정렬·칠 구간 그대로 → 다시 같은 클릭
    await page.evaluate(() => window.__undo());
    const u = await span(page, 'tb1');
    expect(u.align, `${a} 되돌리기`).toBe(prev.align);
    expect(Math.abs(u.g[0] - prev.g[0]) + Math.abs(u.g[1] - prev.g[1]), `${a} 되돌리기 칠 구간`).toBeLessThanOrEqual(2);
    await select(page, 'tb1');
    await ALIGN(page, a);
    await tracks(page, 'tb1', `반복 ${a} (되돌린 뒤 다시)`);
  }
  // 솔리드
  await openTxtPicker(page);
  let n0 = await snaps(page);
  await tab(page, 'solid').click();
  const s = await span(page, 'tb1');
  expect(s.clip).not.toBe('text');
  expect(s.img).toBe('none');
  expect(s.fill, '솔리드 색').toBe('rgb(204, 34, 68)');
  expect(await page.evaluate(() => document.querySelector('#tb1 .tb-body').getAttribute('style')), '기하 잔재').not.toMatch(/background-(size|position|origin)/);
  expect(await snaps(page) - n0).toBe(1);
  // 다시 그라데이션
  n0 = await snaps(page);
  await tab(page, 'gradient').click();
  await closePicker(page);
  const g = await tracks(page, 'tb1', '솔리드 뒤 다시 그라데이션');
  expect(g.fill).toBe('rgba(0, 0, 0, 0)');
  expect(await snaps(page) - n0).toBe(1);
  await page.evaluate(() => window.__undo());
  expect((await span(page, 'tb1')).img, '⌘Z 1번 = 솔리드로').toBe('none');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('T3 저장→재로드(sanitizeCanvasHtml 왕복) 뒤 그라데이션·정렬·칠 구간 유지', async ({ page }) => {
  const errs = await boot(page);
  await select(page, 'tb1');
  await gradByClick(page);
  await ALIGN(page, 'right');
  const a = await tracks(page, 'tb1', '저장 전');
  const ok = await page.evaluate(async () => {
    await import('/js/io/save-load.js').catch(() => {});
    if (typeof window.sanitizeCanvasHtml !== 'function') return false;
    const host = document.getElementById('host');
    const html = host.innerHTML; host.innerHTML = ''; host.innerHTML = window.sanitizeCanvasHtml(html);
    return true;
  });
  expect(ok, 'sanitizeCanvasHtml 을 못 불렀다(측정 불가)').toBe(true);
  const b = await tracks(page, 'tb1', '재로드 뒤');
  expect(b.align).toBe('right');
  expect(b.img).toBe(a.img);
  expect(errs.filter(e => !/save-load/.test(e)), errs.join(' | ')).toEqual([]);
});

test('T4 여러 줄(길이 다른 두 줄): 왼·가운데·오른쪽 모두 칠 구간 = 가장 긴 줄 기준 글자 덩어리 양끝', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => { document.querySelector('#tb1 .tb-body').innerHTML = '짧은 줄<br>조금 더 긴 둘째 줄'; });
  await select(page, 'tb1');
  await gradByClick(page);
  for (const a of ['left', 'center', 'right', 'center']) {
    await ALIGN(page, a);
    const s = await tracks(page, 'tb1', `여러 줄 ${a}`);
    expect(s.lines.length, '두 줄이어야 한다').toBe(2);
    expect(s.lines[0]).toBeLessThan(s.lines[1]);
  }
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('T5 글자를 고치면(편집) 칠 구간이 다시 맞는다 · 옛 저장본(기하 없음)도 열 때 맞춘다', async ({ page }) => {
  const errs = await boot(page);
  await select(page, 'tb1');
  await gradByClick(page);
  await ALIGN(page, 'center');
  await page.evaluate(() => { document.querySelector('#tb1 .tb-body').firstChild.appendData(' 더 길게'); });
  await expect.poll(async () => { const s = await span(page, 'tb1'); return Math.abs(s.g[1] - s.t[1]) <= 2 && Math.abs(s.g[0] - s.t[0]) <= 2; }).toBe(true);
  // 옛 저장본: 기하 없는 인라인을 통째로 넣는다
  await page.evaluate(() => {
    const host = document.getElementById('host');
    host.innerHTML = '<div class="text-block" id="tb9" data-type="body"><div class="tb-body" contenteditable="false" style="font-size: 40px; color: rgb(204, 34, 68); text-align: right; background-image: linear-gradient(90deg, rgb(204, 34, 68) 0%, rgba(204, 34, 68, 0) 100%); background-clip: text; -webkit-text-fill-color: transparent;">옛 저장본</div></div>';
  });
  await expect.poll(async () => { const s = await span(page, 'tb9'); return Math.abs(s.g[0] - s.t[0]) <= 2; }).toBe(true);
  await tracks(page, 'tb9', '옛 저장본');
  expect(errs, errs.join(' | ')).toEqual([]);
});
