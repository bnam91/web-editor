/* export-html-redact.dom.spec.js — 단독 HTML 내보내기에서 가림막이 «설계로» 불투명하다
 *
 * ★최종통합 QA(2026-09-21, medium): js/io/export-html.js 는 앱 CSS 를 «안» 싣고 자기가 쓴
 *   <style> 만 붙인다(의도된 부분집합). 그 CSS 에 .shape-block/.shape-redact/.shape-svg 규칙이
 *   한 줄도 없어서
 *     ⑴ backdrop-filter 가 사라져 흐림이 없고
 *     ⑵ 그런데 `.shape-redact .shape-svg{fill:none!important}` 도 같이 빠져 SVG 가 원래 색
 *        (#cccccc)으로 칠해져 «우연히» 원문을 가린다.
 *   ⇒ 프라이버시가 «설계»가 아니라 «두 누락의 상쇄»로 지켜지고 있었다 —
 *     도형 색을 흰색/투명으로 쓰는 순간 깨진다. 그게 이 스펙의 H2 다.
 *
 * 고침 = html2canvas 경로와 «같은 안전실패»를 건다(js/io/capture-safety.js neutralizeRedactForH2C).
 *
 * 여기서 재는 것 — ★진짜 export-html.js 소스에서 css 템플릿을 «그대로 뽑아» 그것만으로 렌더한다:
 *   H1 기본색(#cccccc) 가림막: 중화 뒤 불투명 — 밑에 깔린 원문 글자가 픽셀로 안 보인다.
 *   H2 ★흰색 도형 가림막: 중화 «전»엔 원문이 그대로 보이고(=상쇄가 깨진다), 중화 뒤엔 가려진다.
 *   H3 ★가림막이 «아닌» 도형은 안 건드린다(과잉 적용 금지).
 *   H4 소스 대조 — export-html.js 가 실제로 그 안전장치를 부른다(SSOT).
 *
 * ⛔앱을 «안» 띄운다.
 * 실행: npm run test:dom -- export-html-redact
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

/* ★진짜 소스에서 css 템플릿 문자열을 뽑는다 — 손으로 베끼면 본문이 바뀔 때 같이 안 늙는다. */
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

/* 섹션 한 벌 — 민감한 원문(빨강 글자) 위에 가림막 도형을 겹쳐 놓는다. */
const SEC = (shapeColor) => `
<div class="section-block" id="sec1" style="height:200px;">
  <div class="section-inner">
    <div class="row">
      <div class="text-block" id="secret" style="position:absolute;left:40px;top:8px;width:520px;height:70px;background:#ff0000;"></div>
    </div>
    <div class="frame-block" style="position:absolute;left:40px;top:8px;width:520px;height:70px;">
      <div class="shape-block shape-redact" id="shp" data-shape-type="rectangle"
           data-shape-redact="true" data-shape-redact-blur="8"
           style="position:absolute;inset:0;background:rgba(255,255,255,0.001);backdrop-filter:blur(8px);">
        <svg class="shape-svg" width="520" height="70" style="position:absolute;inset:0;">
          <rect width="520" height="70" fill="${shapeColor}"></rect>
        </svg>
      </div>
    </div>
  </div>
</div>`;

const HARNESS = (shapeColor) => `<!doctype html><html><head><meta charset="utf-8">
<style>${EXPORT_CSS}</style></head><body>
<div id="canvas">${SEC(shapeColor)}</div>
<script type="module">
  import { neutralizeRedactForH2C } from '/js/io/capture-safety.js';
  window.__neutralize = neutralizeRedactForH2C;
  window.__ready = true;
</script></body></html>`;

async function boot(page, shapeColor) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS(shapeColor) });
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

/* 가림막 한가운데에서 «무엇이 맨 위인가» — elementFromPoint 로 잰다. 픽셀보다 확실하다. */
const probe = (page, doNeutralize) => page.evaluate((n) => {
  if (n) window.__neutralize(document.getElementById('canvas'));
  const shp = document.getElementById('shp');
  const r = shp.getBoundingClientRect();
  const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
  const top = document.elementFromPoint(cx, cy);
  const cs = getComputedStyle(shp);
  return {
    topId: top ? (top.id || top.className.baseVal || top.className || top.tagName) : null,
    bg: cs.backgroundColor,
    backdrop: cs.backdropFilter,
    svgFill: document.querySelector('#shp .shape-svg rect')?.getAttribute('fill') || null,
  };
}, doNeutralize);

test('H1 ★기본색(#cccccc) 가림막 — 중화 뒤 불투명(원문이 위로 안 올라온다)', async ({ page }) => {
  const errs = await boot(page, '#cccccc');
  const r = await probe(page, true);
  console.log('  H1-head:', r);
  expect(r.bg, '★안전실패 채움(#4a4a4a)이 안 걸렸다').toBe('rgb(74, 74, 74)');
  expect(r.backdrop, '단독 HTML 엔 backdrop-filter 를 남기지 않는다(안 그려지는데 남으면 거짓 안심)').toBe('none');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('H2 ★흰색 도형 가림막 — 중화 «전»엔 상쇄가 깨져 원문이 드러난다 (음성대조)', async ({ page }) => {
  const errs = await boot(page, '#ffffff');
  // ⑴ 중화 전: 배경이 근투명(rgba(255,255,255,0.001))이고 SVG 도 흰색 — «우연한 가림»이 없다.
  const before = await probe(page, false);
  console.log('  H2-before:', before);
  /* ⚠️크로미움은 alpha 0.001 을 «0» 으로 계산해 돌려준다(실측) — 수를 그대로 못 박지 않고
     「사실상 투명인가」로 잰다. 요점은 표기가 아니라 «가려지지 않는다»이다. */
  const alphaOf = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c); const p = m ? m[1].split(',') : []; return p.length > 3 ? parseFloat(p[3]) : 1; };
  expect(alphaOf(before.bg), '★중화 전에도 불투명이면 이 검사는 아무것도 안 보고 있다').toBeLessThan(0.01);
  expect(before.svgFill).toBe('#ffffff');
  // ⑵ 중화 후: 도형 색이 무엇이든 불투명하다.
  const after = await probe(page, true);
  console.log('  H2-after:', after);
  expect(after.bg).toBe('rgb(74, 74, 74)');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('H3 ★가림막이 아닌 도형은 안 건드린다 (과잉 적용 금지)', async ({ page }) => {
  const errs = await boot(page, '#cccccc');
  const r = await page.evaluate(() => {
    const plain = document.createElement('div');
    plain.className = 'shape-block';
    plain.id = 'plain';
    plain.style.background = 'rgb(0, 128, 0)';
    document.getElementById('canvas').appendChild(plain);
    window.__neutralize(document.getElementById('canvas'));
    return { bg: getComputedStyle(plain).backgroundColor, cls: plain.className };
  });
  console.log('  H3-head:', r);
  expect(r.bg, '★가림막이 아닌 도형까지 회색으로 덮으면 디자인이 망가진다').toBe('rgb(0, 128, 0)');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('H4 ★소스 대조 — export-html.js 가 그 안전장치를 실제로 부른다', () => {
  expect(EXPORT_HTML_SRC, 'export-html.js 가 capture-safety 의 가림막 안전실패를 안 부른다')
    .toMatch(/neutralizeRedactForH2C\(clone\)/);
  const imp = /import\s*\{[^}]*neutralizeRedactForH2C[^}]*\}\s*from\s*['"]\.\/capture-safety\.js['"]/;
  expect(EXPORT_HTML_SRC, '가져오기가 없다 — 호출만 있으면 런타임에 터진다').toMatch(imp);
  /* ★호출 «자리»도 못을 박는다: 클론을 만든 뒤·HTML 문자열을 짜기 전이어야 한다.
     (inlineGoyaAssets 뒤로 밀려도 동작은 같지만, 문자열 조립 뒤로 가면 아무 일도 안 한다.) */
  const iCall = EXPORT_HTML_SRC.indexOf('neutralizeRedactForH2C(clone)');
  const iHtml = EXPORT_HTML_SRC.indexOf('const html = `<!DOCTYPE html>');
  expect(iCall).toBeGreaterThan(0);
  expect(iHtml).toBeGreaterThan(0);
  expect(iCall, '★HTML 문자열을 짠 «뒤»에 부르면 아무 일도 안 한다').toBeLessThan(iHtml);
});
