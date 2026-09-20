/* asset-panel-min-scale.dom.spec.js — 「우측 에셋 패널이 화면과 «같은 말»을 하는가」.
 *
 * ★왜 생겼나 (2026-09-20 픽스라운드, 이벨류에이터 지적 ③)
 *   스크래치 표시폭 그대로 넣기(T-075)가 들어가면서 4:3 그림은 표시폭 267px 미만이면
 *   높이가 200 미만이 된다. 신고 원문의 «그 220px 아이템»이 바로 220×165 다.
 *   그런데 높이 슬라이더는 min=200 이라, 슬라이더는 200 을 숫자칸은 165 를 띄운다 —
 *   «같은 줄에서 서로 다른 말». 그 상태에서 슬라이더를 건드리면 200 으로 튀어 비율이 깨진다.
 *   ⚠️이건 새로 생긴 병이 아니다 — Logo 프리셋(200×64)이 이미 같은 길이었다(P3 이 그걸 잰다).
 *
 * ★고친 모양 = «하한을 낮추지 않고, 이미 더 작은 블록에서만 눈금을 넓힌다»
 *   보통 블록(≥100 / ≥200)의 편집 감각은 한 픽셀도 안 바뀐다(P4 가 그 음성대조).
 *
 * ⛔앱을 «안» 띄운다 — 레포 파일만 크로미움에 얹는다(modal-variant.dom.spec.js 와 같은 부팅).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js asset-panel-min-scale
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-blocks.css"></head><body>
<div id="canvas-wrap"><div id="canvas"><div class="section-block"><div class="section-inner" id="host" style="width:860px;"></div></div></div></div>
<div id="panel-right"><div class="panel-body"></div></div>
<script type="module">
  import { showAssetProperties } from '/js/props/prop-asset.js';
  window.getBlockBreadcrumb = () => 'Section > Row';
  window.getEffectiveUsePadx = (ab) => ab.dataset.usePadx === 'true';
  window.pushHistory = () => {};
  window.__open = showAssetProperties;
  window.__mk = (w, h) => {
    const host = document.getElementById('host');
    host.innerHTML = '';
    const row = document.createElement('div'); row.className = 'row'; row.dataset.layout = 'stack';
    const ab = document.createElement('div'); ab.className = 'asset-block'; ab.id = 'ab_x';
    ab.dataset.align = 'center'; ab.style.alignSelf = 'center';
    if (w) ab.style.width = w + 'px';
    if (h) ab.style.height = h + 'px';
    row.appendChild(ab); host.appendChild(row);
    return ab;
  };
  window.__ready = true;
</script></body></html>`;

async function boot(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
}

/** 블록 하나를 만들고 패널을 연 뒤, 눈금 네 칸이 뭐라고 하는지 읽는다. */
const openWith = (page, w, h) => page.evaluate(({ w, h }) => {
  const ab = window.__mk(w, h);
  window.__open(ab);
  const g = id => { const el = document.getElementById(id); return el ? { v: el.value, min: el.min } : null; };
  return { ws: g('asset-w-slider'), wn: g('asset-w-number'), hs: g('asset-h-slider'), hn: g('asset-h-number'),
           realH: Math.round(ab.getBoundingClientRect().height), realW: Math.round(ab.getBoundingClientRect().width) };
}, { w, h });

test.describe('에셋 패널 눈금이 실제 크기와 같은 말을 하는가', () => {
  test.beforeEach(async ({ page }) => { await boot(page); });

  test('P1 ★220×165 (신고 원문의 그 크기) — 슬라이더와 숫자칸이 같은 값을 띄운다', async ({ page }) => {
    // 음성대조(이 라운드 전): hs.v = '200' / hn.v = '165' — 실제는 165
    const m = await openWith(page, 220, 165);
    expect(m.realH, '하네스 전제').toBe(165);
    expect(m.hn.v, '숫자칸').toBe('165');
    expect(m.hs.v, `높이 슬라이더가 ${m.hs.v} 를 띄운다 — 실제는 ${m.realH}`).toBe('165');
    expect(Number(m.hs.min), '눈금 하한이 실제 값보다 크다').toBeLessThanOrEqual(165);
  });

  test('P2 ★폭도 같다 — 스크래치 하한 60px 까지 내려가도 패널이 안 거짓말한다', async ({ page }) => {
    const m = await openWith(page, 60, 45);
    expect(m.ws.v, `폭 슬라이더 ${m.ws.v} vs 실제 ${m.realW}`).toBe('60');
    expect(m.wn.v).toBe('60');
  });

  test('P3 Logo 프리셋 규격(200×64)도 마찬가지 — 이 병은 원래 있던 자리다', async ({ page }) => {
    const m = await openWith(page, 200, 64);
    expect(m.hs.v, `높이 슬라이더 ${m.hs.v} vs 실제 ${m.realH}`).toBe('64');
  });

  test('P4 ★음성대조 — 보통 블록의 눈금은 한 픽셀도 «안» 바뀐다', async ({ page }) => {
    const m = await openWith(page, 860, 780);
    expect(m.ws.min, '폭 하한을 낮췄다 — 보통 블록의 편집 감각이 달라진다').toBe('100');
    expect(m.hs.min, '높이 하한을 낮췄다 — 보통 블록의 편집 감각이 달라진다').toBe('200');
    expect(m.hs.v).toBe('780');
  });
});
