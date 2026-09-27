/* redact-toggle-label-clip.dom.spec.js — 「가림막 토글 라벨 «블러로 가리기» 가 잘린다」(0920 polish4 / T-061) 회귀.
 *
 * ★증상: 도형(rect/ellipse) 속성의 「가림막 (Redact)」 절 첫 줄 라벨이 말줄임(…)으로 잘려
 *   토글이 무슨 토글인지 읽을 수 없다.
 * ★원인: 전역 `.prop-label` 은 width:56px 고정 + ellipsis (css/editor-props.css:24).
 *   11px 한글 7자는 56px 에 안 들어간다. 이 줄은 «라벨 하나 + 남는 폭을 쓰는 컨트롤(토글)» 이라
 *   앱 관례인 `.prop-label--auto`(내용폭 라벨, editor-props.css:32)를 쓰는 자리였다.
 *   ⛔전역 56px 은 건드리지 않는다 — 패널 세로 정렬의 출처다.
 *
 * ★BASE 와 HEAD 를 «같은 잣대로 둘 다» 잰다(음성대조) — 선례: modal-typo.dom.spec.js.
 *   base(int/0919-release @0fb9f5f)의 prop-shape.js 를 같은 하네스에 얹어 «잘림 1건» 을 실측하고,
 *   HEAD 에서 «0건» 을 실측해 1 → 0 을 증명한다. base 가 0 이면 이 검사는 아무것도 안 보고 있다.
 *
 * ⛔앱을 «안» 띄운다 — 레포 파일만 크로미움에 얹는다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js redact-toggle-label-clip
 */
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const BASE_REF = '0fb9f5f';                 // 5라운드 기준 = 고치기 «전»
const PANEL_REL = 'js/props/prop-shape.js';

const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

/* ★패널 폭을 «실물과 같은 240px» 로 만든다 — editor-panels.css 의 --panel-right-w.
   잘림은 폭에 달린 측정이라, 폭을 안 맞추면 이 검사는 아무 뜻이 없다. */
const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-panels.css">
<link rel="stylesheet" href="/css/editor-props.css">
<link rel="stylesheet" href="/css/color-picker.css">
<link rel="stylesheet" href="/css/editor-blocks.css"></head><body>
<div id="canvas-wrap"><div id="canvas"><div class="section-block"><div class="section-inner" id="host"></div></div></div></div>
<div id="panel-right" class="panel"><div class="panel-body"></div></div>
<script type="module">
  import { showShapeProperties } from '/js/props/prop-shape.js';
  window.__open = showShapeProperties;
  window.__ready = true;
</script></body></html>`;

function basePanelSrc() {
  return execFileSync('git', ['show', `${BASE_REF}:${PANEL_REL}`], { cwd: REPO, encoding: 'utf8' });
}

async function boot(page, which = 'head') {
  const baseSrc = which === 'base' ? basePanelSrc() : null;
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') {
      return route.fulfill({ contentType: 'text/html', body: HARNESS });
    }
    // ★base 측정일 때만 패널 «한 파일» 을 갈아끼운다. 나머지는 전부 레포의 진짜 파일이다.
    if (baseSrc && url.pathname === '/' + PANEL_REL) {
      return route.fulfill({ contentType: 'text/javascript', body: baseSrc });
    }
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

/** 사각형 도형 블럭 하나를 캔버스에 올리고 속성 패널을 «연다». */
async function mountAndOpen(page, shapeType = 'rectangle') {
  await page.evaluate((t) => {
    const b = document.createElement('div');
    b.className = 'shape-block';
    b.id = 'shp_test1';
    b.dataset.shapeType = t;
    b.dataset.shapeColor = '#cccccc';
    b.style.width = '200px';
    b.style.height = '120px';
    b.innerHTML = '<svg width="200" height="120"><rect width="200" height="120" fill="#ccc"/></svg>';
    document.getElementById('host').appendChild(b);
    window.__block = b;
    window.__open(b);
  }, shapeType);
}

/** 패널 안에서 «가로로 잘리는» 요소들. 폭 0 은 숨은 요소라 안 센다. */
const clipped = (page) => page.evaluate(() => {
  const body = document.querySelector('#panel-right .panel-body');
  const all = [...body.querySelectorAll('*')];
  return {
    panelW: body.clientWidth,
    scanned: all.length,
    list: all.filter((e) => e.scrollWidth > e.clientWidth && e.clientWidth > 0)
             .map((e) => ({ cls: String(e.className).slice(0, 40), sw: e.scrollWidth, cw: e.clientWidth,
                            txt: (e.textContent || '').trim().slice(0, 34) })),
  };
});

/* ══ ⓪ 입력이 살아 있다 — ⛔없으면 아래가 자가통과한다 ══════════════════ */
test('⓪ ★가림막 절과 토글이 «실재»한다 (패널 폭 = 실물 240px)', async ({ page }) => {
  const errs = await boot(page);
  await mountAndOpen(page);
  const seen = await page.evaluate(() => {
    const body = document.querySelector('#panel-right .panel-body');
    const lab = [...body.querySelectorAll('.prop-label')].find((e) => e.textContent.trim() === '블러로 가리기');
    return {
      panelW: body.clientWidth,
      hasToggle: !!document.getElementById('shape-redact-toggle'),
      hasLabel: !!lab,
      labelText: lab?.textContent.trim() || null,
    };
  });
  console.log('  입력:', seen);
  expect(seen.hasToggle).toBe(true);
  expect(seen.hasLabel).toBe(true);
  // .panel 240px − border-left 1px (clientWidth 는 padding 포함) = 239. 여기서 prop-section
  // 좌우 8px 와 .panel-body 6px 를 빼면 실측 가용폭 211px — prop-page.js 주석의 그 숫자다.
  expect(seen.panelW).toBe(239);
  expect(errs).toEqual([]);
});

/* ══ ① 음성대조 — base 에선 «잘린다» ════════════════════════════════════ */
test('① ★base(0fb9f5f)에선 「블러로 가리기」가 실제로 잘린다', async ({ page }) => {
  const errs = await boot(page, 'base');
  await mountAndOpen(page);
  const m = await page.evaluate(() => {
    const body = document.querySelector('#panel-right .panel-body');
    const lab = [...body.querySelectorAll('.prop-label')].find((e) => e.textContent.trim() === '블러로 가리기');
    return { sw: lab.scrollWidth, cw: lab.clientWidth, cls: lab.className };
  });
  console.log('  base 라벨:', m);
  expect(m.sw).toBeGreaterThan(m.cw);     // ← 이게 증상이다
  expect(errs).toEqual([]);
});

/* ══ ② HEAD — 안 잘린다 ═══════════════════════════════════════════════ */
test('② ★HEAD 에선 「블러로 가리기」가 온전히 보인다', async ({ page }) => {
  const errs = await boot(page);
  await mountAndOpen(page);
  const m = await page.evaluate(() => {
    const body = document.querySelector('#panel-right .panel-body');
    const lab = [...body.querySelectorAll('.prop-label')].find((e) => e.textContent.trim() === '블러로 가리기');
    return { sw: lab.scrollWidth, cw: lab.clientWidth, cls: lab.className };
  });
  console.log('  HEAD 라벨:', m);
  expect(m.sw).toBeLessThanOrEqual(m.cw);
  expect(errs).toEqual([]);
});

/* ══ ③ 라벨만 고치고 «절 전체» 가 안 넘친다 — 토글이 밀려나면 안 된다 ══ */
test('③ ★가림막 절 전체에 잘린 요소 0건 (토글 on = 방식/강도 줄까지)', async ({ page }) => {
  const errs = await boot(page);
  await mountAndOpen(page);
  // 토글을 켜서 방식·강도 줄까지 펼친다(접힌 채로는 아무것도 안 잰다).
  await page.evaluate(() => {
    const t = document.getElementById('shape-redact-toggle');
    t.checked = true;
    t.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const after = await clipped(page);
  console.log('  펼친 뒤 잘림:', JSON.stringify(after.list));
  expect(after.list).toEqual([]);
  // 토글이 패널 안에 온전히 들어 있다(오른쪽으로 밀려 잘리지 않았다).
  const fits = await page.evaluate(() => {
    const body = document.querySelector('#panel-right .panel-body');
    const tg = document.getElementById('shape-redact-toggle').closest('.prop-toggle');
    const br = body.getBoundingClientRect(), tr = tg.getBoundingClientRect();
    return { right: Math.round(tr.right), bodyRight: Math.round(br.right), w: Math.round(tr.width) };
  });
  console.log('  토글:', fits);
  expect(fits.w).toBe(32);
  expect(fits.right).toBeLessThanOrEqual(fits.bodyRight);
  expect(errs).toEqual([]);
});

/* ══ ④ 전역 .prop-label 은 그대로 56px — 다른 패널 세로 정렬 보호 ═════ */
test('④ ★전역 .prop-label 폭 56px 불변 (전 패널 정렬의 출처)', async ({ page }) => {
  const css = fs.readFileSync(path.join(REPO, 'css/editor-props.css'), 'utf8');
  expect(/\.prop-label \{[^}]*width:\s*56px/.test(css)).toBe(true);
  expect(/\.prop-label--auto \{[^}]*width:\s*auto/.test(css)).toBe(true);
});
