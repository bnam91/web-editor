/* qa0920b-paste-overlay.dom.spec.js — 0920b 통합 QA 반영(medium) + export-design-json 오버레이 드롭.
 *
 * ★P — 오버레이(플로팅) 블록을 복사해 붙여넣으면 사본이 «섹션 밖 빈 공간»에 떨어졌다.
 *   좌표를 _viewportCenterInContainerLocal(sec)(뷰포트 중앙의 섹션-로컬 좌표)로 잡아서,
 *   섹션이 짧고 화면 위쪽에 있으면 섹션 높이를 한참 넘는 y 가 나온다(실측: 섹션 383 / y 1140).
 *   두 번 연속 ⌘V 도 «같은 좌표»라 사본 둘이 픽셀 단위로 겹쳤다.
 *
 * ★J — js/io/export-design-json.js serializeSection 은 `[...inner.children]` 만 돌아서
 *   «섹션 직속»인 오버레이 블록을 통째로 드롭했다(export-figma-json.js 가 먼저 앓고 고친 병).
 *
 * ⛔앱을 «안» 띄운다. 실행: npm run test:dom -- qa0920b-paste-overlay
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };
const EDITOR_SRC = fs.readFileSync(path.join(REPO, 'js/editor.js'), 'utf8');

function extractFn(src, name) {
  const m = new RegExp('function\\s+' + name + '\\s*\\(').exec(src);
  if (!m) throw new Error('함수를 못 찾았다: ' + name);
  let i = m.index + m[0].length - 1, d = 0;
  for (; i < src.length; i++) {
    if (src[i] === '(') d++;
    else if (src[i] === ')') { d--; if (d === 0) { i++; break; } }
  }
  while (i < src.length && src[i] !== '{') i++;
  let b = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') b++;
    else if (src[i] === '}') { b--; if (b === 0) { i++; break; } }
  }
  return src.slice(m.index, i);
}
const PLACE_SRC = extractFn(EDITOR_SRC, '_placePastedOverlay');

/* 현빈 재현 조건 — «짧은 섹션»(높이 200) 하나에 오버레이 텍스트가 떠 있다.
   뷰포트(#canvas-wrap)는 그보다 훨씬 크다 ⇒ 뷰포트 중앙의 섹션-로컬 y 가 섹션을 한참 넘는다. */
const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
  <style>
    * { box-sizing: border-box; } body { margin: 0; }
    #canvas-wrap { height: 800px; overflow: auto; }
    .section-block { position: relative; width: 860px; height: 200px; background: #fff; }
    .section-inner { position: relative; }
  </style></head><body>
  <div id="canvas-wrap"><div id="canvas">
    <div class="section-block" id="sec1">
      <div class="section-inner" id="inner1"><div class="text-block" id="flow1">흐름</div></div>
      <div class="frame-block" data-text-frame="true" data-overlay-block="true" id="tf1"
           data-offset-x="68" data-offset-y="120" style="position:absolute;left:68px;top:120px;width:200px;height:40px;">
        <div class="text-block" id="tb1">떠 있는 글자</div>
      </div>
    </div>
  </div></div>
  <div id="panel-right"><div class="panel-body"></div></div>
  <script>
    window.currentZoom = 100;
    window.getTextWithLineBreaks = (el) => el.textContent;
  </script>
  <script type="module">
    import '/js/io/export-design-json.js';
    window.__ready = true;
  </script></body></html>`;

async function boot(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html; charset=utf-8', body: HARNESS });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

/** 붙여넣기의 «자리 계산»만 실제 소스로 돌린다(사본을 만들지 않는다). */
async function place(page, rawX, rawY, id) {
  return page.evaluate(({ src, rawX, rawY, id }) => {
    const fn = new Function(`${src}; return _placePastedOverlay;`)();
    const sec = document.getElementById('sec1');
    const src0 = document.getElementById('tf1');
    const el = src0.cloneNode(true);
    el.id = id;
    sec.appendChild(el);
    const p = fn(sec, el, rawX, rawY);
    el.dataset.offsetX = String(p.x); el.dataset.offsetY = String(p.y);
    el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
    return { ...p, secH: sec.clientHeight, secW: sec.clientWidth, elH: el.offsetHeight, elW: el.offsetWidth };
  }, { src: PLACE_SRC, rawX, rawY, id });
}

test('P1 ★뷰포트 중앙값이 섹션을 넘어도 사본은 «섹션 안»에 떨어진다', async ({ page }) => {
  const errs = await boot(page);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
  const r = await place(page, 438, 1140, 'copy1');   // 현빈 실측값 그대로
  expect(r.secH, '전제: 섹션이 그 좌표보다 훨씬 짧다').toBeLessThan(1140);
  expect(r.y).toBeLessThanOrEqual(r.secH - r.elH);
  expect(r.y).toBeGreaterThanOrEqual(0);
  expect(r.x).toBeLessThanOrEqual(r.secW - r.elW);
});

test('P2 ★두 번 붙여넣으면 사본이 «겹치지 않는다»(계단식)', async ({ page }) => {
  await boot(page);
  const a = await place(page, 100, 40, 'copy1');
  const b = await place(page, 100, 40, 'copy2');
  expect({ x: b.x, y: b.y }, '두 사본이 픽셀 단위로 겹쳤다 — 「한 장만 붙은 줄」 안다').not.toEqual({ x: a.x, y: a.y });
});

test('P3 회귀 — 섹션 «안» 좌표는 그대로 쓴다(멀쩡한 자리를 건드리지 않는다)', async ({ page }) => {
  await boot(page);
  const r = await place(page, 100, 40, 'copy1');
  expect({ x: r.x, y: r.y }).toEqual({ x: 100, y: 40 });
});

test('J1 ★design-json 이 오버레이 블록을 싣는다 (통째로 드롭되지 않는다)', async ({ page }) => {
  await boot(page);
  const out = await page.evaluate(() => {
    let captured = null;
    const origCreate = URL.createObjectURL;
    URL.createObjectURL = () => 'blob:stub';
    const origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {};
    const origBlob = window.Blob;
    window.Blob = function (parts) { captured = parts[0]; return new origBlob(parts, { type: 'application/json' }); };
    try { window.exportDesignJSON(); } finally {
      window.Blob = origBlob; URL.createObjectURL = origCreate; HTMLAnchorElement.prototype.click = origClick;
    }
    return JSON.parse(captured);
  });
  const blocks = out.sections[0].blocks;
  const floating = blocks.filter(b => b.floating);
  expect(floating.length, `오버레이가 드롭됐다: ${JSON.stringify(blocks.map(b => b.type))}`).toBe(1);
  expect(floating[0].type).toBe('text');
  expect(floating[0].x).toBe(68);
  expect(floating[0].y).toBe(120);
});
