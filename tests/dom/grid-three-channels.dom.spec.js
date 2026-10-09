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

    /* ★★2026-10-10 (1009t3 A4) — `MARKER_TOKENS` 가 ★2종 늘었다(grd-cell-selected · item-selected).
       ★★이 검사의 ★분모는 ★그 명부에서 ★파생되므로(위 require), ★★장면도 ★같이 늘려야 한다 —
       ★안 늘리면 ★D4 의 ★전제 단언이 ★「라이브 0건」으로 ★빨개진다. ★실제로 ★그렇게 났다.
       ★★⇒ ★교훈: ★★«분모를 늘렸으면 ★장면도 늘려라». ★그 자는 ★제 일을 했다.

       ★★⛔`grd-cell-selected` 는 ★앱의 길(`__open(block,{…li:null})`)로 ★★심을 수 ★없다 —
         `js/props/prop-grid.js` `_grdSyncLineMark` 가 ★머리에서 ★★`document` ★전역으로
         `.grd-line-selected` 와 `.grd-cell-selected` 를 ★★둘 다 지운다(:176·:177).
         ⇒ ★★두 그리드 마커는 ★★«상호배제»다. ★한 장면에 ★둘을 ★같이 세울 ★방법이 ★없다.
       ★★⇒ ★그래서 ★`bn2-line-selected` 와 ★같은 꼴로 ★★손으로 심는다. ★이 검사가 ★재는 것은
         ★★«채널이 ★그 토큰을 ★벗기나»이고, ★«앱이 ★그 토큰을 ★붙이나»는 ★아니다.
       ★★⇒ ★★«앱의 길»로 재는 자리는 ★따로 있다 — `tests/dom/grid-cell-selected-leak.dom.spec.js`
         (★진짜 마우스로 ★빈 칸을 ★두 번 눌러 심고, ★배송본을 ★★렌더해 ★computed 까지 잰다).
         ⛔이 손 심기를 ★「앱 경로도 쟀다」로 ★읽지 마라. ★두 자리가 ★다른 것을 ★잠근다. */
    const cell = block.querySelector('.grd-cell');
    if (cell) cell.classList.add('grd-cell-selected');
    const lg = document.createElement('div');
    lg.className = 'label-group-block';
    lg.innerHTML = '<div class="label-item item-selected">lb</div>';
    document.getElementById('host').appendChild(lg);
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

test('D4-b ★artifact 명부가 이 검사가 «돌린» 갈래와 맞는다 (다음 문이 생기면 여기서 걸린다)', () => {
  /* ★«마커 축»으로 재는 artifact 만 — 위 D4 가 돌리는 것이 마커 세 채널이기 때문이다.
     (2026-09-09) 명부에 «빠짐 축»(drop) 채널이 생겼다: Figma 업로드는 클래스가 아니라
     JSON 모델을 내므로 이 검사가 돌릴 갈래가 아니다. 그쪽은 자기 축의 검사가 따로 잰다
     — tests/dom/figma-export-coverage.dom.spec.js, 그리고 U6-g 가 그 «연결»을 지킨다.
     ⛔축으로 거르지 않으면 축이 늘 때마다 여기가 «거짓 빨강»이 되고, 사람은 기대값에
       이름만 더해 끄게 된다 — 그러면 이 단언이 아무것도 안 지킨다. */
  /* ★★2026-10-10 — ★손으로 박은 ★평평한 배열을 ★★«뜻으로 갈라» 둘로 나눴다.
     ⛔예전 꼴(이름 넷을 ★한 배열에)은 ★명부가 늘 때 ★사람이 ★★«이름만 더해 끄게» 한다.
     ★★이 검사의 머리말이 요구하는 것은 ★★«늘린 갈래를 ★이 검사가 ★정말 돌리나»다.
     ⇒ ★그래서 ★★두 칸으로 가른다. ★새 채널이 생기면 ★★둘 중 ★어디인지 ★사람이 ★골라야 하고,
       ★그 고름이 ★곧 ★«돌리나 / 위임인가»의 ★판정이다.
     ★★⛔기대값을 ★`CHANNELS` 에서 ★그대로 파생시키면 ★★항등식이 되어 ★아무것도 ★안 잠근다.
       ⇒ ★그래서 ★★두 명부는 ★★손으로 든다 — ★★단 ★★«뜻»이 붙어 있다.
       ★★한 쌍: ★명부에 ★가짜 채널을 더하면 ★★이 검사가 ★빨강이다(둘 중 어디에도 없으므로). */
  const RUN_HERE = [
    'js/io/section-serialize.js',   // ★채널 ① — serializeCleanRoot 를 ★이 검사가 직접 부른다
    'js/io/export-html.js',         // ★채널 ② — exportHTMLFile 을 ★실제로 부르고 Blob 을 가로챈다
    'js/io/export-image.js',        // ★채널 ③ — prepareCloneForCapture 를 ★실제로 부른다
    'js/io/capture-safety.js',      // ★채널 ③ ★안에서 ★같이 돈다(export-image.js:256 이 stripEditorOnlyForCapture)
  ];
  const TWO_LAYER = [
    /* ★여기서 ★직접 안 돌린다 — ★에디터 전역이 통째로 필요하다. ★대신 ★두 겹으로 덮는다:
       ⑴ U6-c 가 ★「그 파일이 공용 겹/세척을 ★실제로 부른다」를 단언
       ⑵ 위 D4 의 ★채널 ①·③ 이 ★「그 겹이 마커를 0건으로 만든다」를 ★실제로 돌려 증명 */
    'js/panels/template-system.js', // serializeCleanRoot/Self 위임
    'js/io/save-load.js',           // stripEditorOnlyForCapture 위임(썸네일 → _meta.json → 목록 카드)
                                    // ⛔그 산출물을 ★«픽셀로» 잰 자는 ★없다 — ★열린 칸
  ];
  const arts = CHANNELS.filter(c => c.kind === 'artifact' && c.axes.includes('marker'))
    .map(c => c.file).sort();
  expect(arts, '★artifact 채널 명부가 바뀌었다 — 위 D4 가 «안 돌리는» 갈래가 생겼을 수 있다. ' +
    '새 채널을 여기서 실제로 돌리거나, serializeCleanRoot 위임임을 확인해라 ' +
    '(tests/unit/export-channel-roster.test.mjs U6 가 명부 자체를 지킨다).')
    .toEqual([...RUN_HERE, ...TWO_LAYER].sort());

  /* ★★2026-10-10 (1009t3 A4) — ★기대 배열이 ★4 → ★6 이 됐다. ⛔«이름만 더해 끈» 것이 ★아니다 —
     ★이 머리말이 요구하는 ★★«그 갈래를 ★이 검사가 ★정말 돌리나»를 ★각각 적는다.
     ⒜ ★`js/io/capture-safety.js` — ★★돌린다. ★위 D4 의 ★채널 ③(PNG 클론)이 ★`__prep` =
        `prepareCloneForCapture` 를 부르고, ★그 함수가 ★`stripEditorOnlyForCapture(clone)` 를
        부른다(`js/io/export-image.js:256`). ⇒ ★★«실제로 도는» 갈래다.
        ★왜 명부에 늦게 올랐나 — ★그 파일이 ★★`transient` 로 적혀 있었다. ★그런데 ★그것이
        ★PNG·썸네일·단독 HTML ★★세 산출물의 ★마커를 걷는 ★★«공용 겹»이다(2026-10-10 advqa).
     ⒝ ★`js/io/save-load.js` — ★★여기서 ★직접 ★안 돌린다. ★`js/panels/template-system.js` 와
        ★★같은 꼴로 ★두 겹으로 덮는다:
          ⑴ ★`U6-c` 가 ★「그 파일이 ★`stripEditorOnlyForCapture` 를 ★실제로 부른다」를 단언
             (★`delegates` 선언 ＋ ★호출 수 ★>0)
          ⑵ ★위 D4 의 ★채널 ③ 이 ★「그 겹이 ★마커를 ★0건으로 만든다」를 ★★실제로 돌려 증명
        ⇒ ★「안 쟀다」가 ★아니라 ★«위임 ＋ 위임받는 쪽»을 ★각각 쟀다.
        ★★⛔그러나 ★그 파일의 ★진짜 산출물(썸네일 → `_meta.json` → 프로젝트 목록 카드)을
          ★★«픽셀로» 잰 자는 ★★없다. ★그 칸은 ★열려 있다(html2canvas 를 이 하네스에서 안 돌린다).
     ★★⇒ ★다음에 ★이 배열이 ★또 늘면 ★★같은 꼴로 ★★«돌리나/위임인가»를 ★적어라. ⛔수만 고치지 마라. */

  /* ★template-system.js 는 여기서 «직접 안 돌린다» — 그 파일을 이 하네스에 띄우려면
     에디터 전역(electronAPI·패널·캔버스 상태)이 통째로 필요하다. 대신 두 겹으로 덮는다:
       ⑴ U6-c 가 「그 파일이 serializeCleanRoot 를 실제로 «부른다»」를 단언하고,
       ⑵ 위 D4 의 채널 ① 이 「serializeCleanRoot 가 마커를 0건으로 만든다」를 «실제로» 돌려 증명한다.
     ⇒ 「안 쟀다」가 아니라 「위임 + 위임받는 쪽」을 각각 쟀다. 실기 확인은 지디 몫이다. */
  const tpl = CHANNELS.find(c => c.file === 'js/panels/template-system.js');
  expect(tpl.strips, 'template-system 이 위임을 그만뒀다 — 그러면 여기서 직접 돌려야 한다').toBe('serializeCleanRoot');
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
