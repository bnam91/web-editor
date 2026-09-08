/* grid-three-channels.dom.spec.js — «세 갈래»를 각각 재는 자리. (2026-09-08)
 *
 * ★왜 «각각» 재나 (§0-⑶ 실측)
 *   같은 데이터가 갈래마다 다른 색으로 나왔다:
 *     캔버스 #e0e0e0(1.32:1) · PNG #e0e0e0 · HTML «검정»(export-html 의 body{} 가 color 를 안 준다).
 *   ⇒ 사용자가 화면에서 안 보여서 포기한 글자가 내보낸 HTML 에선 «멀쩡히» 보인다.
 *   「연하다」보다 나쁜 종류다 — 화면과 결과물이 다르면 사람이 자기 눈을 못 믿는다.
 *   한 갈래만 재면 이 병이 «안 보인다».
 *
 * ⛔D4 의 「0건」에 양성대조가 없으면 아무것도 안 지킨다 — 채널을 돌리기 «직전» 라이브 DOM 에서
 *   «같은 계수기»로 1건을 확인하고, 「입력 1 → 출력 0」이 이미 등재된 «이웃 토큰»
 *   (bn2-line-selected)에서도 성립하는지를 둘째 잣대로 본다. 안 그러면 「하네스가 채널을
 *   아예 안 돌린 것」과 「잘 벗겨진 것」이 화면에서 똑같이 생겼다.
 *
 * ⛔앱을 «안» 띄운다. 실행: npx playwright test --config=tests/dom/playwright.dom.config.js grid-three
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };
const { CHANNELS, MARKER_TOKENS } = require('../_export-channels.js');

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-layout.css">
<link rel="stylesheet" href="/css/editor-canvas.css">
<link rel="stylesheet" href="/css/editor-panels.css">
<link rel="stylesheet" href="/css/editor-props.css">
<link rel="stylesheet" href="/css/color-picker.css">
<link rel="stylesheet" href="/css/editor-blocks.css"></head><body>
<div id="canvas"><div class="section-block"><div class="section-inner" id="host"></div></div></div>
<div id="panel-right"><div class="panel-body"></div></div>
<script src="/js/design-system.js"></script>
<script src="/js/io/section-serialize.js"></script>
<script type="module">
  import { makeGridBlock, renderGridBlock } from '/js/blocks/grid-block.js';
  import { showGridProperties } from '/js/props/prop-grid.js';
  import { prepareCloneForCapture } from '/js/io/export-image.js';
  import '/js/io/export-html.js';
  window.__mk = makeGridBlock;
  window.__render = renderGridBlock;
  window.__open = showGridProperties;
  window.__prep = prepareCloneForCapture;
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
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

const FIXTURE = {
  cols: [{ width: 1, lines: [] }, { width: 1, lines: [] }],
  rows: [{ height: 'auto' }, { height: 'auto' }],
  cells: [
    [ { lines: [ { type: 'h1', text: 'A0' }, { type: 'h2', text: 'A1' }, { type: 'caption', text: '' } ] },
      { lines: [ { type: 'body', text: 'B0' },
                 { type: 'body', text: 'B1', color: '#ff0000' },
                 { type: 'label', text: 'B2', bg: '#111111' } ] } ],
    [ { lines: [ { type: 'body', text: 'C0' }, { type: 'gap', height: 20 }, { type: 'h3', text: 'C2' } ] },
      { lines: [ { type: 'label', text: 'D0' }, { type: 'body', text: 'D1' }, { type: 'caption', text: 'D2' } ] } ],
  ],
};

async function mount(page) {
  await page.evaluate((fx) => {
    const { row, block } = window.__mk(fx);
    document.getElementById('host').appendChild(row);
    block.classList.add('selected');
    window.__block = block;
    /* ★둘째 잣대 — 이미 6자리에 등재된 «이웃 토큰». 「입력 1 → 출력 0」이 여기서도 성립해야
       하네스가 채널을 «진짜로» 돌리고 있다는 뜻이다. */
    const bn = document.createElement('div');
    bn.className = 'banner02-block';
    bn.innerHTML = '<div data-line-idx="0" class="bn2-line-selected">bn</div>';
    document.getElementById('host').appendChild(bn);
  }, FIXTURE);
}

/** 같은 계수기 — 어떤 «문자열»에서든 토큰을 센다. 라이브 DOM 도 같은 함수로 잰다. */
const countIn = (text, tok) => (String(text).match(new RegExp(tok, 'g')) || []).length;

/* ══ D4 — 마커가 «결과물»에 0건 ═════════════════════════════════════════
 * 되돌리면 빨강: js/io/export-image.js 의 classList.remove(…) 인자에서 'grd-line-selected'
 *   하나를 지우면 → ③ 빨강. (자리를 «안 세고도» 잡힌다) */

test('D4 ★편집용 마커가 저장본·HTML·PNG «어디에도» 안 샌다 (양성대조 둘)', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  await page.evaluate(() => window.__open(window.__block, { r: 0, c: 1, li: 2 }));

  const out = await page.evaluate(async () => {
    const live = document.getElementById('canvas').innerHTML;

    // ① 저장본
    const c1 = document.getElementById('canvas').cloneNode(true);
    window.serializeCleanRoot(c1);
    const save = c1.innerHTML;

    // ② HTML 내보내기 — «실제» exportHTMLFile 을 부르되 Blob 을 가로챈다
    let htmlOut = null;
    const realCOU = URL.createObjectURL;
    const blobs = [];
    URL.createObjectURL = (b) => { blobs.push(b); return 'blob:intercepted'; };
    const realClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {};      // 다운로드 막기
    try { await window.exportHTMLFile(); } finally {
      URL.createObjectURL = realCOU;
      HTMLAnchorElement.prototype.click = realClick;
    }
    if (blobs.length) htmlOut = await blobs[blobs.length - 1].text();

    // ③ PNG 클론 — «실제» export 함수
    const sec = document.querySelector('.section-block');
    const c3 = await window.__prep(sec, 860, false);
    const png = c3.outerHTML;
    c3.remove();

    return { live, save, htmlOut, png };
  });

  expect(errs, `pageerror 가 났다 — 채널이 «안 돌았을» 수 있다:\n${errs.join('\n')}`).toEqual([]);
  expect(out.htmlOut, '★HTML Blob 을 못 잡았다 — ② 는 「빈 문서」를 재고 있었다').not.toBeNull();

  for (const tok of MARKER_TOKENS) {
    // 전제(양성대조) — 채널을 돌리기 «직전» 라이브 DOM 에 «1건» 있었다.
    expect(countIn(out.live, tok),
      `★라이브 DOM 에 «${tok}» 이 0건이다 — 입력이 없으면 아래 「출력 0」은 아무 뜻이 없다`).toBe(1);
    // 본 단언 — 세 결과물 전부 0건.
    for (const [name, text] of [['저장본', out.save], ['HTML', out.htmlOut], ['PNG 클론', out.png]]) {
      expect(countIn(text, tok),
        `★«${tok}» 이 ${name}에 샜다 — 그 경로의 스트립 목록에서 빠졌다`).toBe(0);
    }
  }
  // 결과물이 «비어 있지 않다» — 0건이 「아무것도 안 담겨서」 난 0 이 아니다.
  for (const [name, text] of [['저장본', out.save], ['HTML', out.htmlOut], ['PNG 클론', out.png]]) {
    expect(countIn(text, 'grd-line'),
      `★${name}에 그리드 줄 자체가 0건이다 — 이 채널은 «빈 문서»를 재고 있다`).toBeGreaterThan(0);
  }
});

test('D4-b ★명부의 «DOM 채널» 이 이 검사가 돌린 갈래와 같다 (7번째 문이 생기면 여기서 걸린다)', () => {
  const carriers = CHANNELS.filter(c => c.carriesDomClasses).map(c => c.file).sort();
  expect(carriers, '★DOM 을 나르는 채널 명부가 바뀌었다 — 위 D4 가 «안 돌리는» 갈래가 생겼다. ' +
    '이 검사에 그 채널을 추가해라 (tests/unit/export-channel-roster.test.mjs U6 가 명부 자체를 지킨다).')
    .toEqual(['js/io/export-html.js', 'js/io/export-image.js', 'js/io/section-serialize.js']);
});

/* ══ D3 — 세 갈래의 «색»이 서로 같다 (§7-ⓐ 가 3분열을 닫았다) ═══════════
 * 도입 «전»의 실측: 캔버스 #e0e0e0 · PNG #e0e0e0 · HTML «검정». 셋이 갈려 있었다.
 * 되돌리면 빨강: _GRID_ROLES 에서 body.color «한 항목만» 지우면
 *   → 캔버스/PNG 는 #e0e0e0(상속), HTML 은 UA 기본 검정 ⇒ 「셋이 같다」가 깨진다. */

/** WCAG 2.x 상대휘도 → 대비. rgb(r, g, b) 문자열을 받는다. */
function contrastVsWhite(rgb) {
  const m = String(rgb).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return null;
  const lin = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const L = 0.2126 * lin(+m[1]) + 0.7152 * lin(+m[2]) + 0.0722 * lin(+m[3]);
  return +((1.0 + 0.05) / (L + 0.05)).toFixed(2);
}

test('D3 ★캔버스 · PNG · HTML 의 줄 색이 «서로 같다» + 흰 배경 대비가 살아 있다', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);

  const got = await page.evaluate(async () => {
    const read = (root) => {
      const out = {};
      for (const el of root.querySelectorAll('.grd-line')) {
        const k = `(${el.dataset.r},${el.dataset.c},${el.dataset.line})`;
        if (!el.dataset.line) continue;
        out[k] = getComputedStyle(el).color;
      }
      return out;
    };

    // ⓐ 캔버스 — 라이브
    const canvas = read(window.__block);
    const secBg = getComputedStyle(document.querySelector('.section-block')).backgroundColor;

    // ⓑ PNG — «실제» export 함수의 클론(라이브 문서 안에 붙는다 ⇒ computed 를 잴 수 있다)
    const sec = document.querySelector('.section-block');
    const c3 = await window.__prep(sec, 860, false);
    const png = read(c3);
    c3.remove();

    // ⓒ HTML — «실제» exportHTMLFile 의 Blob 을 iframe srcdoc 에 넣어 그 안에서 잰다
    const realCOU = URL.createObjectURL; const blobs = [];
    URL.createObjectURL = (b) => { blobs.push(b); return 'blob:x'; };
    const realClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {};
    try { await window.exportHTMLFile(); } finally {
      URL.createObjectURL = realCOU; HTMLAnchorElement.prototype.click = realClick;
    }
    const text = blobs.length ? await blobs[blobs.length - 1].text() : null;
    let html = null;
    if (text) {
      const ifr = document.createElement('iframe');
      ifr.style.cssText = 'position:fixed;left:-99999px;width:900px;height:900px;';
      document.body.appendChild(ifr);
      await new Promise((res) => { ifr.onload = res; ifr.srcdoc = text; });
      html = read(ifr.contentDocument);
      ifr.remove();
    }
    return { canvas, png, html, secBg };
  });

  expect(errs).toEqual([]);
  expect(got.html, '★HTML 채널을 못 읽었다 — 셋 중 하나가 «빈 문서»다').not.toBeNull();
  expect(got.secBg, '섹션 배경이 흰색이 아니다 — editor-canvas.css 를 안 얹었나').toBe('rgb(255, 255, 255)');

  const keys = Object.keys(got.canvas);
  expect(keys.length, '캔버스에서 줄을 0건 읽었다 — 계수기가 죽었다').toBeGreaterThanOrEqual(8);
  for (const k of ['png', 'html']) {
    expect(Object.keys(got[k]).length, `★${k} 채널이 줄을 0건 읽었다 — 「셋이 같다」가 «빈 것끼리» 비교된다`)
      .toBe(keys.length);
  }

  // 본 단언 — 갈래 셋이 «같은 색»을 낸다.
  for (const k of keys) {
    expect(got.png[k], `★PNG 갈래의 ${k} 색이 캔버스와 다르다`).toBe(got.canvas[k]);
    expect(got.html[k], `★HTML 갈래의 ${k} 색이 캔버스와 다르다 — ` +
      `사용자가 화면에서 안 보여 포기한 글자가 내보낸 HTML 에선 «멀쩡히» 보인다`).toBe(got.canvas[k]);
  }

  // 전제(양성대조) — 명시색 줄이 «세 채널 모두» 빨강. 셋 중 하나가 빈 문서면 여기서 걸린다.
  expect(got.canvas['(0,1,1)'], '명시색 줄을 캔버스에서 못 읽었다').toBe('rgb(255, 0, 0)');
  expect(got.png['(0,1,1)'], '명시색이 PNG 갈래에서 사라졌다').toBe('rgb(255, 0, 0)');
  expect(got.html['(0,1,1)'], '명시색이 HTML 갈래에서 사라졌다').toBe('rgb(255, 0, 0)');

  /* 대비 — 흰 섹션 배경 기준. caption 은 §7-ⓐ 표의 2.85 를 «현재값»으로 못박는다
     (텍스트블록과 «같은 관례». 올리려면 전 블록 동시 = 별건 발주). */
  const c = (k) => contrastVsWhite(got.canvas[k]);
  expect(c('(0,0,0)'), 'h1 대비').toBeGreaterThanOrEqual(4.5);
  expect(c('(0,0,1)'), 'h2 대비').toBeGreaterThanOrEqual(4.5);
  expect(c('(1,0,2)'), 'h3 대비').toBeGreaterThanOrEqual(4.5);
  expect(c('(1,1,1)'), 'body 대비 — AA 본문 4.5:1').toBeGreaterThanOrEqual(4.5);
  expect(c('(1,1,0)'), 'label 대비 (흰 종이 위 흰 글자가 아니다)').toBeGreaterThanOrEqual(4.5);
  expect(c('(1,1,2)'), '★caption 은 2.85 로 «못박는다» — 텍스트블록과 같은 관례라 여기만 올리면 갈린다')
    .toBeCloseTo(2.85, 2);
  // 도입 전의 값이 «아니다»
  expect(c('(1,1,1)'), '★body 가 아직 1.32:1(#e0e0e0 상속)이다 — §7-ⓐ 가 안 걸렸다').not.toBeCloseTo(1.32, 2);
});
