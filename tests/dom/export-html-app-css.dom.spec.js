/* export-html-app-css.dom.spec.js — 단독 HTML 내보내기가 «화면과 같은 그림»인가
 *
 * ★왜 (2026-09-21 최종통합 QA medium): js/io/export-html.js 는 앱 CSS 를 한 줄도 안 싣고
 *   손으로 쓴 <style> 만 붙였다. 그 손글씨는 «두 번째 CSS»라 블록이 늘 때마다 같이 안 늙는다.
 *   실앱 실측(9505·줌40%·실제 exportHTMLFile 산출물을 크로미움에 렌더해 34노드 대조):
 *     섹션 배경 rgb(255,255,255)→rgba(0,0,0,0) · 도형 100×100@380,240→0×24@0,0 ·
 *     프레임 flex/relative/hidden→block/static/visible · 아이콘+텍스트 75.2→48 ·
 *     에셋 y 1560.8→5 · 캔버스 높이 2695.8→1888.6(−807.2px) — 차이 난 노드 29/34.
 *     근거파일: h0920b/cap-live.json · h0920b/cap-export-before.measured.json
 *   고친 뒤 같은 방법으로 다시 재면 차이 난 노드 1/34(그 하나는 «의도된» 가림막 불투명 채움).
 *
 * 여기서 재는 것 — 앱을 «안» 띄우고 같은 대조를 재현한다:
 *   A1 ★핵심: 수확한 앱 CSS 를 실으면 내보낸 문서의 기하·배경이 화면과 같다.
 *   A1-pre ★음성대조: 앱 CSS 를 빼면 도형이 붕괴하고 섹션 배경이 사라진다(고치기 전 상태).
 *   A2 편집 전용 선택자는 «담지 않는다»(.selected/:hover/핸들/라벨).
 *   A3 :root 는 커스텀 속성만 — color-scheme 같은 선언이 실려 배송본이 어두워지면 안 된다.
 *   A4 SSOT 소스 대조 — export-html.js 가 실제로 수확기와 공용 걷기 명부를 부른다.
 *
 * ⛔앱을 «안» 띄운다.
 * 실행: npm run test:dom -- export-html-app-css
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

/* ★진짜 소스에서 손글씨 css 템플릿을 뽑는다 — 베끼면 본문이 바뀔 때 같이 안 늙는다. */
const EXPORT_HTML_SRC = fs.readFileSync(path.join(REPO, 'js/io/export-html.js'), 'utf8');
function exportCss() {
  const i = EXPORT_HTML_SRC.indexOf('const css = `');
  if (i < 0) throw new Error('⛔export-html.js 의 css 템플릿을 못 찾았다 — 이 스펙이 늙었다');
  const s = i + 'const css = `'.length;
  const e = EXPORT_HTML_SRC.indexOf('`;', s);
  if (e < 0) throw new Error('⛔css 템플릿의 끝을 못 찾았다');
  return EXPORT_HTML_SRC.slice(s, e).replace(/\$\{bg\}/g, '#ffffff').replace(/\$\{CANVAS_W\}/g, '860');
}
const EXPORT_CSS = exportCss();

/* 자연 크기 860×540 그림(위/아래 20px 마커 띠) — «상자 비율 ≠ 그림 비율» 을 만들려면
   자연 크기가 «있어야» 한다. 1×1 투명 GIF 로는 height:auto 가 0 이 돼 아무것도 안 갈린다. */
const IMG_860x540 = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSc4NjAnIGhlaWdodD0nNTQwJz48cmVjdCB3aWR0aD0nODYwJyBoZWlnaHQ9JzU0MCcgZmlsbD0nIzhhOGE4YScvPjxyZWN0IHg9JzAnIHk9JzAnIHdpZHRoPSc4NjAnIGhlaWdodD0nMjAnIGZpbGw9JyMwMGZmMDAnLz48cmVjdCB4PScwJyB5PSc1MjAnIHdpZHRoPSc4NjAnIGhlaWdodD0nMjAnIGZpbGw9JyNmZjg4MDAnLz48L3N2Zz4=';

/* 픽스처 = 라이브 캔버스에서 그대로 뜬 마크업(9505 실측). 손으로 지어내지 않는다. */
const FIXTURE = `
<div class="section-block" data-section="1" id="sec1" data-name="Section 01"><div class="section-inner">
  <div class="section-hitzone"><div class="section-label">Section 01</div></div>
  <div class="section-toolbar"><button class="st-btn">메모</button></div>
  <div class="frame-block" id="fr1" data-free-layout="true" data-width="100" data-height="100"
       style="padding:0px;width:100px;max-width:none;margin-top:0px;margin-bottom:0px;min-height:100px;height:100px;align-self:center;flex-shrink:0;">
    <div class="shape-block" data-type="shape" data-shape-type="ellipse" data-shape-color="#cccccc"
         data-shape-stroke-width="0" id="shp1" style="position:absolute;left:0px;top:0px;">
      <svg class="shape-svg" viewBox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"
           style="color:#cccccc;stroke-width:0;fill:currentColor;stroke:currentColor;"><ellipse cx="50" cy="50" rx="50" ry="50"></ellipse></svg>
      <div class="shape-handle nw" data-dir="nw"></div><div class="shape-handle se" data-dir="se"></div>
    </div>
  </div>
  <!-- ★상자 비율(400×150 = 2.667) ≠ 그림 비율(860×540 = 1.593) 인 에셋.
       우측패널 H 칸이 하는 것과 같은 줄(js/props/prop-asset.js — ab.style.height = v+'px')의 결과다.
       2026-09-21 최종통합 QA medium: 손글씨 .asset-block.has-image img{height:auto} (특이도 0,2,1)가
       수확한 앱 CSS .asset-img{height:100%} (0,1,0)을 이겨 배송본에서만 img 가 251.2px 로 늘어났다
       (= 가운데 cover 크롭이 아니라 «위쪽만» 보이고 .asset-img-clip 의 overflow 가 아래를 자른다). -->
  <div class="row"><div class="asset-block has-image" id="ab1" data-align="center"
       style="width:400px;height:150px;align-self:center;position:relative;">
    <div class="asset-img-clip"><img class="asset-img" id="aim1" src="${IMG_860x540}" draggable="false" style="object-fit:cover"></div>
  </div></div>
  <div class="row"><div class="icon-text-block selected" id="itb1">
    <div class="itb-icon" draggable="false"><svg viewBox="0 0 24 24" width="18" height="18"><rect x="3" y="3" width="18" height="18"></rect></svg></div>
    <div class="itb-text" draggable="false">본문 내용을 입력하세요.</div>
  </div></div>
</div></div>`;

/* 앱 CSS — index.html 이 캔버스 그림에 실제로 쓰는 것들만(패널·모달류는 수확기가 어차피 건너뛴다). */
const APP_CSS_LINKS = ['editor-base', 'editor-canvas', 'editor-layout', 'editor-blocks', 'editor-extra']
  .map(n => `<link rel="stylesheet" href="/css/${n}.css">`).join('\n');

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
${APP_CSS_LINKS}
</head><body>
<div id="canvas-wrap"><div id="canvas-scaler"><div id="canvas">${FIXTURE}</div></div></div>
<script type="module">
  import { collectCanvasCss } from '/js/io/export-css-collect.js';
  import { stripEditorOnlyForCapture } from '/js/io/capture-safety.js';
  window.__collect = collectCanvasCss;
  window.__strip = stripEditorOnlyForCapture;
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
  // 그림이 «로드된 뒤»에 재야 한다 — 안 그러면 height:auto 가 0 이라 차이가 안 보인다.
  await page.evaluate(() => Promise.all([...document.images].map(i => i.complete ? null : i.decode().catch(() => {}))));
  return errs;
}

/* 화면 ↔ 내보낸 문서를 «같은 자»로 잰다: #canvas 기준 상대좌표 + 계산값. */
const MEASURE = `(root) => {
  const c = root.getElementById('canvas');
  const cr = c.getBoundingClientRect();
  const out = {};
  for (const id of ['sec1','fr1','shp1','itb1','ab1','aim1']) {
    const e = root.getElementById(id); if (!e) { out[id] = null; continue; }
    const r = e.getBoundingClientRect(); const cs = root.defaultView.getComputedStyle(e);
    out[id] = { x: Math.round((r.left-cr.left)*10)/10, y: Math.round((r.top-cr.top)*10)/10,
                w: Math.round(r.width*10)/10, h: Math.round(r.height*10)/10,
                bg: cs.backgroundColor, pos: cs.position, disp: cs.display, ov: cs.overflow };
  }
  out.__canvas = { h: Math.round(cr.height*10)/10 };
  return out;
}`;

/* 내보내기와 «같은 순서»로 문서를 짓는다: 손글씨 css → 수확한 앱 css → 배송본 전용.
   withApp=false 가 «고치기 전»(앱 CSS 를 안 싣던 상태) 이다. */
async function renderExport(page, withApp) {
  return page.evaluate(async ({ exportCss, withApp, measureSrc }) => {
    const canvas = document.getElementById('canvas');
    const appCss = withApp ? window.__collect(canvas) : '';
    const clone = canvas.cloneNode(true);
    window.__strip(clone);
    clone.querySelectorAll('.section-hitzone, .shape-handle').forEach(el => el.remove());
    const html = `<!doctype html><html><head><meta charset="utf-8">`
      + `<style>${exportCss}</style><style>${appCss}</style>`
      + `<style>.asset-block .asset-icon,.asset-block .asset-label{display:none!important;}</style>`
      + `</head><body><div id="canvas">${clone.innerHTML}</div></body></html>`;
    const ifr = document.createElement('iframe');
    ifr.style.cssText = 'position:fixed;left:0;top:0;width:1000px;height:900px;border:0;visibility:hidden;';
    document.body.appendChild(ifr);
    await new Promise((res) => { ifr.onload = res; ifr.srcdoc = html; });
    await Promise.all([...ifr.contentDocument.images].map(i => i.complete ? null : i.decode().catch(() => {})));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const measure = eval('(' + measureSrc + ')');
    const got = measure(ifr.contentDocument);
    const appCssLen = appCss.length;
    ifr.remove();
    return { got, appCssLen, appCss };
  }, { exportCss: EXPORT_CSS, withApp, measureSrc: MEASURE });
}

const live = (page) => page.evaluate((src) => eval('(' + src + ')')(document), MEASURE);

/* 화면은 40% 로 축소돼 있으므로(#canvas-scaler) 기하는 «배율을 푼 뒤» 본다.
   여기 하네스는 scaler 에 transform 을 안 걸었으니 배율 1 — 라이브 실측과 같은 자다. */
function diffKeys(a, b, keys) {
  const d = [];
  for (const id of keys) {
    if (!a[id] || !b[id]) { d.push(`${id}: 한쪽이 없다`); continue; }
    for (const f of ['x', 'y', 'w', 'h']) if (Math.abs(a[id][f] - b[id][f]) > 1) d.push(`${id}.${f} ${a[id][f]}→${b[id][f]}`);
    for (const f of ['bg', 'pos', 'disp', 'ov']) if (a[id][f] !== b[id][f]) d.push(`${id}.${f} ${a[id][f]}→${b[id][f]}`);
  }
  return d;
}

test('A1-pre ★음성대조 — 앱 CSS 를 안 실으면 도형이 붕괴하고 섹션 배경이 사라진다', async ({ page }) => {
  const errs = await boot(page);
  const screen = await live(page);
  const { got } = await renderExport(page, false);
  console.log('  A1-pre screen:', JSON.stringify(screen));
  console.log('  A1-pre export:', JSON.stringify(got));
  // 도형 상자가 통째로 무너진다(폭 100 → 0).
  expect(screen.shp1.w).toBeGreaterThan(90);
  expect(got.shp1.w, '★고치기 전인데 도형 폭이 살아 있다 — 이 음성대조가 아무것도 안 보고 있다').toBeLessThan(10);
  // 섹션 배경이 없어진다.
  expect(screen.sec1.bg).toBe('rgb(255, 255, 255)');
  expect(got.sec1.bg, '★고치기 전인데 섹션 배경이 남아 있다').not.toBe('rgb(255, 255, 255)');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('A1 ★고침 — 수확한 앱 CSS 를 실으면 내보낸 문서가 화면과 같다', async ({ page }) => {
  const errs = await boot(page);
  const screen = await live(page);
  const { got, appCssLen } = await renderExport(page, true);
  console.log('  A1 appCss bytes:', appCssLen);
  const d = diffKeys(screen, got, ['sec1', 'fr1', 'shp1', 'itb1', 'ab1', 'aim1']);
  console.log('  A1 diff:', d.length ? d.join(' | ') : '(없음)');
  expect(appCssLen, '★앱 CSS 를 하나도 못 수확했다 — CSSOM 접근이 막혔거나 수확기가 죽었다').toBeGreaterThan(500);
  expect(d, '내보낸 문서가 화면과 다르다: ' + d.join(' | ')).toEqual([]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('A2 ★편집 전용 선택자는 안 담는다 (배송본이 편집 화면을 흉내 내면 안 된다)', async ({ page }) => {
  const errs = await boot(page);
  const css = await page.evaluate(() => window.__collect(document.getElementById('canvas')));
  const bad = [];
  for (const needle of ['.selected', ':hover', '.shape-handle', '.section-label', '.section-toolbar', '.section-hitzone', '.st-btn']) {
    if (css.includes(needle)) bad.push(needle);
  }
  console.log('  A2 bytes:', css.length, 'leaked:', bad.join(',') || '(없음)');
  expect(bad, '편집 전용 선택자가 배송본 CSS 에 실렸다: ' + bad.join(', ')).toEqual([]);
  // 반대로 «있어야 할» 규칙은 있어야 한다 — 없다고 통과하면 A2 는 빈 문자열에도 초록이다.
  expect(css, '.shape-block 규칙이 안 담겼다').toContain('.shape-block');
  expect(css, '.frame-block 규칙이 안 담겼다').toContain('.frame-block');
  expect(css, '.icon-text-block 규칙이 안 담겼다').toContain('.icon-text-block');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('A3 ★:root 는 커스텀 속성만 — color-scheme 이 실려 배송본이 어두워지면 안 된다', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(() => {
    const css = window.__collect(document.getElementById('canvas'));
    const m = /:root\{([^}]*)\}/.exec(css);
    return { hasRoot: !!m, decls: m ? m[1].split(';').filter(Boolean) : [], hasScheme: /color-scheme/.test(css) };
  });
  console.log('  A3 vars:', r.decls.length, 'color-scheme:', r.hasScheme);
  expect(r.hasRoot, ':root 커스텀 속성이 하나도 안 담겼다 — var() 가 전부 기본값으로 떨어진다').toBe(true);
  for (const d of r.decls) expect(d.trim().startsWith('--'), '★:root 에 커스텀 속성이 아닌 선언이 실렸다: ' + d).toBe(true);
  expect(r.hasScheme, '★color-scheme 이 배송본에 실렸다 — 받는 사람 화면이 어두워진다').toBe(false);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('A4 ★SSOT 소스 대조 — export-html 이 수확기와 공용 걷기 명부를 부른다', () => {
  expect(EXPORT_HTML_SRC).toMatch(/import \{ collectCanvasCss \} from '\.\/export-css-collect\.js'/);
  expect(EXPORT_HTML_SRC, '내보내기가 앱 CSS 를 안 수확한다').toMatch(/collectCanvasCss\(canvasEl\)/);
  expect(EXPORT_HTML_SRC, '수확한 CSS 를 문서에 안 싣는다').toMatch(/<style>\$\{appCss\}<\/style>/);
  expect(EXPORT_HTML_SRC, '공용 걷기 명부를 안 부른다').toMatch(/stripEditorOnlyForCapture\(clone\)/);
  // 순서가 뜻이다 — 손글씨 css 가 먼저, 수확한 앱 css 가 뒤(같은 특이도면 뒤가 이긴다).
  const iBase = EXPORT_HTML_SRC.indexOf('<style>${css}</style>');
  const iApp  = EXPORT_HTML_SRC.indexOf('<style>${appCss}</style>');
  expect(iBase).toBeGreaterThan(0);
  expect(iApp, '★수확한 앱 CSS 가 손글씨 CSS 보다 «앞»에 있다 — 그러면 손글씨 추정값이 화면을 이긴다').toBeGreaterThan(iBase);
});

/* ══════════════════════════════════════════════════════════════════════════════
   A5 — 손글씨 CSS 가 앱 CSS 를 «이기는» 짝  [2026-09-21 최종통합 QA medium]

   A4 가 못박은 「손글씨 먼저, 앱 CSS 뒤 ⇒ 같은 특이도면 뒤가 이긴다」는 «같은 특이도일 때»의
   이야기다. 실제로는 한 짝이 특이도부터 어긋나 있었다:
     손글씨 `.asset-block.has-image img { height:auto }`  = (0,2,1)
     앱 CSS `.asset-img          { height:100% }`         = (0,1,0)
   ⇒ 뒤에 실어도 «손글씨가 이긴다». 결과: 상자 비율 ≠ 그림 비율인 에셋이 배송본에서만
     «가운데 cover 크롭»이 아니라 «위쪽만» 보인다(.asset-img-clip 의 overflow 가 아래를 자른다).
   실앱 실측(진짜 exportHTMLFile 산출물 ↔ 라이브 11노드 기하 대조):
     400×150 에셋 → 배송본 img 높이 251.2px(Δ +101.2) · 600×376.7 세로그림 → 955.5px(Δ +578.8).
   ★A1 이 초록이었던 이유 = 그 픽스처의 «상자 비율 = 그림 비율» 이라 height:auto 가 우연히 같은
     값을 냈기 때문이다. 그래서 여기 «비율이 어긋나는» 픽스처(ab1/aim1)를 세웠다.
   ══════════════════════════════════════════════════════════════════════════ */
test('A5 ★특이도 — 손글씨 height:auto 가 앱 CSS 의 .asset-img{height:100%} 를 이기면 안 된다', async ({ page }) => {
  const errs = await boot(page);
  const screen = await live(page);
  const { got } = await renderExport(page, true);
  console.log('  A5 screen aim1:', JSON.stringify(screen.aim1), ' export aim1:', JSON.stringify(got.aim1));
  // 전제 — 픽스처가 실제로 «비율이 어긋난» 상자여야 이 검사가 무언가를 본다(양성대조).
  expect(screen.ab1.w, '전제: 상자 폭').toBeCloseTo(400, 0);
  expect(screen.ab1.h, '전제: 상자 높이').toBeCloseTo(150, 0);
  expect(Math.abs(400 / 150 - 860 / 540), '전제: 상자 비율이 그림 비율과 같으면 이 검사는 빈 검사다')
    .toBeGreaterThan(0.5);
  // 화면에서는 cover 가 상자를 꽉 채운다
  expect(screen.aim1.h, '화면에서 이미 상자 높이와 다르다 — 하네스가 앱 CSS 를 못 읽었다').toBeCloseTo(150, 0);
  // ★배송본도 같아야 한다 (고치기 전: 251.2px)
  expect(got.aim1.h, `배송본 img 높이 ${got.aim1.h} ≠ 화면 ${screen.aim1.h} — 손글씨 height:auto 가 이겼다`)
    .toBeCloseTo(screen.aim1.h, 0);
  expect(got.aim1.w, '배송본 img 폭이 화면과 다르다').toBeCloseTo(screen.aim1.w, 0);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('A5-src ★소스 — 손글씨 규칙이 .asset-img 를 덮지 않는다(특이도 역전 차단)', () => {
  const m = /\.asset-block\.has-image img[^{]*\{[^}]*\}/.exec(EXPORT_CSS);
  expect(m, '★`.asset-block.has-image img` 규칙 자체가 사라졌다 — 앱 CSS 수확이 막혔을 때의 폴백이 없어진다').not.toBeNull();
  expect(m[0], '★`.asset-img` 를 제외하지 않는다 — 특이도 0,2,1 이 앱 CSS 0,1,0 을 이겨 배송본만 다른 그림이 된다')
    .toContain(':not(.asset-img)');
  // 폴백은 남아 있어야 한다 — CSSOM 이 막혀 appCss 가 비어도 .asset-img 는 스스로 cover 여야 한다.
  expect(EXPORT_CSS, '★손글씨 .asset-img 폴백이 사라졌다').toMatch(/\.asset-img\{[^}]*object-fit:cover/);
});
