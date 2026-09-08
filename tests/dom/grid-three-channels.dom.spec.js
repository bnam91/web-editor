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
