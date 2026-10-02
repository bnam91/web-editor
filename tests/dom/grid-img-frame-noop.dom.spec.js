/* grid-img-frame-noop.dom.spec.js — 「프레임 구조로 갈아탔는데 화면은 그대로인가」를 «픽셀»로 잰다.
 *
 * ★왜 이 파일이 있나 (2026-09-25, 커밋 ① 전용)
 *   그리드 이미지 줄이 «img 자신이 상자»에서 «프레임(div) + 콘텐츠(img)»로 바뀌었다
 *   (현빈 2026-09-25: 「에셋블럭과 구조가 같아야 된다」). 그 커밋은 «구조만» 바꾼다 —
 *   화면은 한 톨도 안 바뀌어야 한다.
 *   그런데 그 「안 바뀌었다」를 지키던 자(tests/unit/grid-render-gaps.test.js 의 D_GOLDEN 12칸)는
 *   ★바이트 골든이라 구조가 바뀌면 «재촬영»할 수밖에 없다. 재촬영하는 순간 그 자는
 *   「옛 산출과 같은가」가 아니라 「내가 방금 뜬 것과 같은가」만 재게 된다 — 증명이 사라진다.
 *   ⇒ 이 파일이 그 빈자리다. «옛 마크업»을 얼려 두고, «새 렌더러가 실제로 내는 것»과
 *     나란히 세워 브라우저가 계산한 사각형과 «찍은 픽셀»로 견준다.
 *
 * ★재는 «양» — 「같은 문자열인가」가 아니다(그건 애초에 다르다). 「같은 그림인가」다.
 *   ⑴ 사각형   — 줄 상자의 getBoundingClientRect (x/y/w/h)
 *   ⑵ ★픽셀    — 같은 크기 무대 둘을 따로 찍어 PNG 바이트를 견준다
 *   ⇒ ⑵가 본 단언이다. ⑴은 ⑵가 빨개졌을 때 «어디가» 틀어졌는지 말해 주는 안내다.
 *
 * ★«옛 것»의 출처 — OLD_IMAGE_LINE 은 ed74f65 의 js/blocks/grid-block.js `_gridLineHtml`
 *   이미지 가지를 «그대로 얼린 것»이다. 이 레포에서 옛 화면을 아는 유일한 자리다.
 *   ⛔여기를 새 구조에 맞춰 «고치지» 마라 — 고치는 순간 이 파일은 자기 자신과 견주게 된다.
 *
 * ★«새 것»의 출처 — 진짜 js/blocks/grid-block.js 를 Node 에서 얹어 renderGridBlock 을 돌린다
 *   (tests/unit/grid-p1.test.js 와 같은 수법: 브라우저 전용 import 둘만 스텁).
 *   ⇒ 렌더러가 내일 또 바뀌면 이 자가 «바로» 운다.
 *
 * ★자가점검이 본 측정 «앞»에 선다
 *   N0-a  옛/새가 «실제로 다른 마크업»인가 (같으면 이 파일 전체가 헛돈다)
 *   N0-b  ★양성대조 — 내 비교기가 «차이를 잡기는» 하는가. 일부러 flex-shrink 를 뺀 사본을
 *         짧은 행에 세워 빨개지는지 본다(그 한 줄이 바로 min-height:auto 보정이다).
 *
 * ★★한 갈래가 «갈라졌다» — 빈 슬롯의 칠 (2026-09-25, 같은 날 뒤 커밋)
 *   현빈 「빈 슬롯이 들어갈 수 있어야지 … 처음에 체크패턴으로 둘 수 있을 것 같은데」로
 *   빈 이미지 슬롯의 칠이 회색 단색 → 체크패턴이 됐다. ⇒ N2 에서 「그림도 같다」는 «거짓»이 됐다.
 *   ⛔그렇다고 이 파일을 버리지 않는다 — N1(그림이 «든» 줄)의 no-op 증명은 그대로 살아 있고,
 *     N2 도 «상자»는 여전히 재야 한다(빈 셀은 자리를 차지하는 게 존재 이유다).
 *   ⇒ N2 만 「상자 동일 ＋ 칠은 일부러 다름」으로 갈랐다. 까닭은 N2 머리말에 적어 뒀다.
 *
 * ⛔앱을 «안» 띄운다. 제품 변경 0.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js grid-img-frame-noop
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

/* ★그림 — 네 귀퉁이가 «서로 다른 색»이어야 한 톨의 어긋남도 픽셀로 드러난다.
   SVG 는 width/height 가 있으면 고유 크기를 가지므로 object-fit 이 그대로 먹는다. */
const NAT_W = 400, NAT_H = 250;
const IMG = 'data:image/svg+xml;base64,' + Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${NAT_W}" height="${NAT_H}">` +
  `<rect width="400" height="250" fill="#204080"/>` +
  `<rect x="0" y="0" width="200" height="125" fill="#e03030"/>` +
  `<rect x="200" y="125" width="200" height="125" fill="#30c060"/>` +
  `<circle cx="200" cy="125" r="60" fill="#f0d000"/>` +
  `<rect x="0" y="120" width="400" height="10" fill="#ffffff"/>` +
  `<rect x="195" y="0" width="10" height="250" fill="#000000"/></svg>`
).toString('base64');

/* ══ 옛 것 — ★ed74f65 의 `_gridLineHtml` 이미지 가지를 «그대로» 얼린다 ═══════════
   ⛔한 글자도 새 구조 쪽으로 옮기지 마라. 이 함수가 곧 «2026-09-25 이전의 화면»이다. */
function OLD_IMAGE_LINE({ imgSrc, height = 0, radius = 0, widthPct = 100, align = 'left' }) {
  const h = Number(height) || 0;
  const r = Number(radius) || 0;
  const wp = Number.isFinite(Number(widthPct)) ? Math.max(5, Math.min(100, Number(widthPct))) : 100;
  const widthCss = `width:${wp}%;`;
  const alignCss = wp < 100
    ? (align === 'center' ? 'margin-left:auto;margin-right:auto;' : align === 'right' ? 'margin-left:auto;' : '')
    : '';
  const addrAttr = ' data-r="0" data-c="0" data-line="0"';
  if (!imgSrc) {
    const ph = h > 0 ? h : 180;
    return `<div${addrAttr} class="grd-img grd-img-empty" style="${widthCss}height:${ph}px;background:#e8e8e8;`
      + `border-radius:${r > 0 ? r : 8}px;${alignCss}"></div>`;
  }
  const sizeCss = h > 0 ? `height:${h}px;object-fit:cover;` : 'height:auto;';
  return `<img${addrAttr} class="grd-img" src="${imgSrc}" draggable="false" style="display:block;${widthCss}${sizeCss}`
    + `${r > 0 ? `border-radius:${r}px;` : ''}${alignCss}">`;
}

/* ══ 새 것 — ★진짜 렌더러를 Node 에 얹는다 (grid-p1.test.js 와 같은 수법) ════════ */
function makeFakeDom() {
  const registry = new Map();
  function createElement(tag) {
    let _id = '', _classes = new Set();
    const el = {
      tagName: tag, dataset: {}, style: {}, innerHTML: '',
      get id() { return _id; },
      set id(v) { if (_id) registry.delete(_id); _id = v; if (v) registry.set(v, el); },
      get className() { return [..._classes].join(' '); },
      set className(v) { _classes = new Set(String(v).split(/\s+/).filter(Boolean)); },
      classList: {
        contains: (c) => _classes.has(c), add: (...cs) => cs.forEach(c => _classes.add(c)),
        remove: (...cs) => cs.forEach(c => _classes.delete(c)),
        replace: (a, b) => { if (!_classes.has(a)) return false; _classes.delete(a); _classes.add(b); return true; },
      },
      appendChild(c) { return c; }, scrollIntoView() {},
    };
    return el;
  }
  return { createElement, getElementById: (id) => registry.get(id) || null };
}

let _seq = 0;
async function loadGrid() {
  const src0 = fs.readFileSync(path.join(REPO, 'js', 'blocks', 'grid-block.js'), 'utf8');
  const STUB = 'const insertAfterSelected = () => {};\n'
    + 'const genId = (p) => `${p}_` + Math.random().toString(36).slice(2, 9);\n'
    + 'const bindBlock = () => {};\n';
  let src = src0.replace(
    "import { insertAfterSelected, genId } from '../drag-utils.js';\nimport { bindBlock } from '../drag-drop.js';\n",
    STUB);
  expect(src, '★소스에서 drag-utils/drag-drop import 2줄을 못 찾았다 — 리팩터링됐나?').not.toBe(src0);
  const tag = `${process.pid}-${++_seq}`;
  const gcr = path.join(os.tmpdir(), `gcr-noop-${tag}.mjs`);
  const before = src;
  src = src.replace("from '../grid-cell-resize.js'", 'from ' + JSON.stringify(pathToFileURL(gcr).href));
  expect(src, '★grid-cell-resize.js import 를 못 찾았다').not.toBe(before);
  fs.copyFileSync(path.join(REPO, 'js', 'grid-cell-resize.js'), gcr);
  const alias = path.join(os.tmpdir(), `grid-noop-${tag}.mjs`);
  fs.writeFileSync(alias, src);
  globalThis.document = makeFakeDom();
  globalThis.window = {};
  const mod = await import(pathToFileURL(alias).href);
  fs.unlinkSync(alias); fs.unlinkSync(gcr);
  return mod;
}

/** 줄 하나를 렌더해서 «그 줄 요소의 outerHTML»을 돌려준다(여는 태그가 아니라 통째로). */
function NEW_IMAGE_LINE(mod, line) {
  const { block: b } = mod.makeGridBlock({ cols: [{ width: 1, lines: [] }] });
  const r = mod.updateGridBlock(b.id, { patchCell: { r: 0, c: 0, lines: [line] } });
  expect(r.ok, `★판을 못 깔았다: ${r.message}`).toBe(true);
  const html = b.innerHTML;
  const needle = ' data-r="0" data-c="0" data-line="0"';
  const at = html.indexOf(needle);
  expect(at, '★줄이 안 그려졌다').toBeGreaterThan(-1);
  const open = html.lastIndexOf('<', at);
  const close = html.indexOf('</div>', at);
  expect(close, '★줄 요소의 끝을 못 찾았다').toBeGreaterThan(open);
  return html.slice(open, close + '</div>'.length);
}

/* ══ 판 — 옛/새를 «같은 칸»에 따로 세운다 ═════════════════════════════════════
   칸은 제품과 같은 꼴이다: .grd-cell { display:flex; flex-direction:column; min-height:0 }.
   ★행 높이가 «짧은» 판을 따로 둔다 — overflow:hidden 이 flex 항목의 min-height:auto 를
     0 으로 떨어뜨리는 자리라, 거기서만 드러나는 차이가 있다(flex-shrink:0 보정의 과녁). */
const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-blocks.css">
<style>
  body{margin:0;background:#fff;}
  .stage{width:360px;background:#fff;}
  .grd-cell{min-width:0;min-height:0;display:flex;flex-direction:column;justify-content:flex-start;width:360px;}
  .grd-cell.short{height:120px;}
</style></head><body>
<div id="stage" class="stage"><div class="grd-cell" id="cell"></div></div>
<script>window.__ready = true;</script>
</body></html>`;

async function boot(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

/** ★«한 무대»에 옛 것을 걸어 찍고, 같은 자리에 새 것을 걸어 찍는다.
 *  ⛔무대를 둘로 두면 안 된다 — 아래 무대가 위 무대의 «분수 높이»(112.5px)만큼 밀려
 *    서브픽셀 위치가 달라지고, 그러면 같은 그림도 전면에 걸쳐 재표본화 차이가 난다
 *    (실측: 921/40680 점 · 최대 세기 192. 「구조가 바꾼 것」이 아니라 «내 판이 만든 것»이었다).
 *    한 자리에서 갈아 끼우면 그 축이 통째로 사라진다. */
async function shot(page, html, short) {
  await page.evaluate(([h, sh]) => {
    const cell = document.getElementById('cell');
    cell.classList.toggle('short', !!sh);
    cell.innerHTML = h;
  }, [html, short]);
  // 그림이 다 떠야 크기가 정해진다 — 안 기다리면 «둘 다 0» 이라 공짜 초록이 난다.
  await page.waitForFunction(() => {
    const imgs = [...document.querySelectorAll('#stage img')];
    return imgs.every(i => i.complete && i.naturalWidth > 0);
  });
  const rect = await page.evaluate(() => {
    const el = document.querySelector('#stage [data-line="0"]');
    if (!el) return null;
    const s = el.getBoundingClientRect();
    const host = document.getElementById('stage').getBoundingClientRect();
    return { x: +(s.left - host.left).toFixed(2), y: +(s.top - host.top).toFixed(2),
             w: +s.width.toFixed(2), h: +s.height.toFixed(2) };
  });
  return { rect, png: await page.locator('#stage').screenshot() };
}

async function stand(page, oldHtml, newHtml, short) {
  const o = await shot(page, oldHtml, short);
  const n = await shot(page, newHtml, short);
  const rects = { old: o.rect, neu: n.rect };
  /* ★픽셀은 «바이트»로 안 센다 — PNG 바이트 동일은 지나치게 센 자라 «눈에 안 보이는»
     한 점의 안티에일리어싱 차이로도 빨개진다(그러면 이 파일은 「화면이 같은가」가 아니라
     「인코더가 같은 바이트를 냈나」를 재게 된다). 브라우저에 도로 넣어 «점마다» 견준다.
     ⛔의존성을 새로 들이지 않는다 — 디코더는 브라우저가 이미 갖고 있다. */
  const diff = await page.evaluate(async ([a, b]) => {
    const load = (b64) => new Promise((res, rej) => {
      const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = 'data:image/png;base64,' + b64;
    });
    const [ia, ib] = [await load(a), await load(b)];
    if (ia.width !== ib.width || ia.height !== ib.height) {
      return { sizeMismatch: [ia.width, ia.height, ib.width, ib.height], n: -1, max: -1, total: -1 };
    }
    const px = (im) => {
      const c = document.createElement('canvas');
      c.width = im.width; c.height = im.height;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(im, 0, 0);
      return g.getImageData(0, 0, im.width, im.height).data;
    };
    const [pa, pb] = [px(ia), px(ib)];
    let n = 0, max = 0;
    /* ★«어디가» 다른지까지 돌려준다 — 수만 주면 다음 사람이 그 수를 보고도 뭘 할지 모른다. */
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let i = 0; i < pa.length; i += 4) {
      let d = 0;
      for (let k = 0; k < 4; k++) d = Math.max(d, Math.abs(pa[i + k] - pb[i + k]));
      if (d > 0) {
        n++; if (d > max) max = d;
        const p = i / 4, x = p % ia.width, y = (p - x) / ia.width;
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    const bbox = n ? { x0, y0, x1, y1 } : null;
    return { n, max, bbox, total: pa.length / 4, w: ia.width, h: ia.height };
  }, [o.png.toString('base64'), n.png.toString('base64')]);
  return { rects, diff, bytes: [o.png.length, n.png.length] };
}

/* ══ 판 전수 — 정렬 3 × 폭 2 × 높이 {auto,200} × 모서리 {0,16} × 행 {보통,짧음} ══ */
const CASES = [];
for (const align of ['left', 'center', 'right'])
  for (const widthPct of [50, 100])
    for (const height of [0, 200])
      for (const radius of [0, 16])
        for (const short of [false, true])
          CASES.push({ align, widthPct, height, radius, short });
const key = (c) => `${c.align}|wp${c.widthPct}|h${c.height || 'auto'}|r${c.radius}|${c.short ? '짧은행' : '보통행'}`;

let MOD;
test.beforeAll(async () => { MOD = await loadGrid(); });

/* ══════════════════════════════════════════════════════════════════════
 * N0 — 계측기. ⛔이게 빨갛다면 아래 초록은 전부 헛것이다.
 * ════════════════════════════════════════════════════════════════════ */

test('N0-a ★자가점검 — 옛 마크업과 새 마크업이 «실제로 다르다»(같으면 이 파일은 아무것도 안 잰다)', () => {
  let differed = 0;
  for (const c of CASES) {
    const line = { type: 'image', imgSrc: IMG, widthPct: c.widthPct, align: c.align };
    if (c.height) line.height = c.height;
    if (c.radius) line.radius = c.radius;
    const o = OLD_IMAGE_LINE({ imgSrc: IMG, height: c.height, radius: c.radius, widthPct: c.widthPct, align: c.align });
    const n = NEW_IMAGE_LINE(MOD, line);
    if (o !== n) differed++;
    expect(n, `★${key(c)} — 새 산출에 프레임이 없다. 구조가 안 바뀌었다면 이 파일은 «없는 변화»를 지키는 셈이다`)
      .toContain('grd-img-frame');
  }
  expect(differed, '★옛/새 마크업이 한 칸도 안 다르다 — 견줄 것이 없다').toBe(CASES.length);
});

test('N0-b ★★양성대조 — 내 비교기가 «차이를 잡기는» 하는가 (안쪽 그림이 프레임을 안 채우는 사본)', async ({ page }) => {
  const errs = await boot(page);
  const c = { align: 'left', widthPct: 50, height: 200, radius: 0, short: false };
  const o = OLD_IMAGE_LINE({ imgSrc: IMG, height: c.height, radius: c.radius, widthPct: c.widthPct, align: c.align });
  const n = NEW_IMAGE_LINE(MOD, { type: 'image', imgSrc: IMG, widthPct: c.widthPct, align: c.align, height: c.height });
  /* ★일부러 깨뜨린다 — 안쪽 그림이 프레임을 «100%×100% 로 채우는 것»이 이 구조의 심장이다
     (그래야 height:200px + cover 가 옛 <img> 와 같은 그림을 낸다). height 를 auto 로 돌리면
     상자는 200 인데 그림은 제 비율(112.5)만 차지해 «다른 그림»이 되어야 한다.
     ⛔이 자가 안 울면 아래 N1 의 초록은 전부 「안 봤다」다. */
  const broken = n.replace('height:100%;object-fit:cover;', 'height:auto;');
  expect(broken, '★변이가 «주입되지 않았다» — 이 양성대조는 아무것도 안 쟀다').not.toBe(n);
  const bad = await stand(page, o, broken, c.short);
  expect(errs).toEqual([]);
  expect(bad.diff.n,
    `★깨뜨린 사본이 «같다»고 나온다 — 이 비교기는 차이를 못 잡는다(아래 N1 은 언제나 초록).\n`
    + `   옛 ${JSON.stringify(bad.rects.old)} · 깬 것 ${JSON.stringify(bad.rects.neu)} · 차이 ${JSON.stringify(bad.diff)}`)
    .toBeGreaterThan(0);
  expect(bad.diff.max, '★차이가 «눈에 안 보일 만큼»이다 — 그런 변이로는 N1 의 문턱을 증명 못 한다')
    .toBeGreaterThan(64);
});

/* ══════════════════════════════════════════════════════════════════════
 * N1 — 본 단언. 「구조는 바뀌었고 화면은 그대로다」
 * ════════════════════════════════════════════════════════════════════ */

for (const c of CASES) {
  test(`N1[${key(c)}] ★구조만 바뀌었다 — 사각형도 픽셀도 옛 화면과 같다`, async ({ page }) => {
    const errs = await boot(page);
    const line = { type: 'image', imgSrc: IMG, widthPct: c.widthPct, align: c.align };
    if (c.height) line.height = c.height;
    if (c.radius) line.radius = c.radius;
    const o = OLD_IMAGE_LINE({ imgSrc: IMG, height: c.height, radius: c.radius, widthPct: c.widthPct, align: c.align });
    const n = NEW_IMAGE_LINE(MOD, line);
    const r = await stand(page, o, n, c.short);
    expect(errs).toEqual([]);
    expect(r.rects.neu, `★${key(c)} — 줄 상자가 옛 화면과 다르다`).toEqual(r.rects.old);
    expect(r.diff.sizeMismatch, `★${key(c)} — 무대 크기 자체가 다르다`).toBeUndefined();
    /* ★문턱 — «점의 수»가 아니라 «점의 세기»로 자른다. 같은 그림을 두 번 그려도 가장자리
       한 줄은 서브픽셀 위치 탓에 1~2 만큼 달라질 수 있다(반올림 되는 자리). 눈에 보이는
       어긋남(잘린 자리가 밀림 · 모서리 클리핑 빠짐)은 이 문턱을 수십 배로 넘는다.
       ⛔이 수를 «빨간 걸 지우려고» 올리지 마라 — 올리는 순간 이 자는 아무것도 안 잰다. */
    const MAX_AA = 4;
    expect(r.diff.max,
      `★${key(c)} — ★«픽셀»이 다르다. 구조만 바꾼다던 커밋이 화면을 바꿨다.\n`
      + `   사각형은 ${JSON.stringify(r.rects.old)} 로 같다 — 그렇다면 잘리는 «자리»가 달라진 것이다\n`
      + `   (object-fit / object-position / border-radius 클리핑을 먼저 봐라).\n`
      + `   다른 점 ${r.diff.n}/${r.diff.total} · 최대 세기 ${r.diff.max} (문턱 ${MAX_AA})\n`
      + `   다른 자리(무대 ${r.diff.w}×${r.diff.h}): ${JSON.stringify(r.diff.bbox)}`)
      .toBeLessThanOrEqual(MAX_AA);
  });
}

/* ══ N2 — 빈 슬롯. ★«상자»는 같고, «칠»은 일부러 다르다 ═══════════════════════════
 *
 * ★★제목이 바뀐 까닭 (2026-09-25, 현빈 「빈 셀 … 체크패턴으로」)
 *   여기 있던 제목은 「클래스 이름만 바뀌었다(그림도 같다)」였고 `diff.max === 0` 을 요구했다.
 *   그 말은 «프레임 리팩터 커밋»에선 참이었다. 지금은 «거짓»이다 — 빈 슬롯의 칠을
 *   회색 단색(#e8e8e8) → 체크패턴으로 «일부러» 바꿨기 때문이다.
 *   ⛔제목이 조건을 말하는데 그 조건이 깨졌으면, 문턱을 올려 빨강을 지우는 게 아니라
 *     «제목부터» 고쳐야 한다. (이 파일 N1 의 「⛔이 수를 빨간 걸 지우려고 올리지 마라」와 같은 결.
 *      문턱을 올리면 이 자는 그때부터 아무것도 안 잰다.)
 *
 * ★그래서 무엇을 «여전히» 재나 — 이 파일의 본래 몫인 «상자»다.
 *   빈 셀은 «자리를 차지하는 것»이 존재 이유라, 칠이 바뀌어도 사각형이 움직이면 그건 결함이다.
 *   ⇒ rects 동일은 «그대로 센 채로» 남긴다. 실측으로도 그 단언은 계속 초록이었다
 *     (깨진 것은 픽셀 하나뿐이고, 상자는 한 톨도 안 움직였다).
 * ★그리고 «칠이 정말 바뀌었나»를 역방향으로 못박는다 — 누가 체커를 조용히 회색으로
 *   되돌리면 여기가 빨개진다. «무엇으로» 칠하는지(값·자리·배송본 유출)는 이 파일의 몫이 아니라
 *   tests/dom/grid-cell-empty-slot.dom.spec.js ④·⑧ 과 tests/unit/card-empty-export.test.mjs 가 잰다. */
for (const align of ['left', 'center', 'right']) {
  test(`N2[${align}] ★빈 이미지 슬롯 — «상자»는 옛 화면과 같고, «칠»은 일부러 다르다`, async ({ page }) => {
    const errs = await boot(page);
    const o = OLD_IMAGE_LINE({ imgSrc: '', height: 120, widthPct: 50, align });
    const n = NEW_IMAGE_LINE(MOD, { type: 'image', widthPct: 50, align, height: 120 });
    expect(n, '★빈 슬롯이 프레임 클래스를 안 달았다').toContain('grd-img-frame grd-img-empty');
    const r = await stand(page, o, n, false);
    expect(errs).toEqual([]);
    // ★이 줄이 이 파일의 본래 몫 — 칠이 바뀌어도 «자리»는 한 톨도 안 움직여야 한다.
    expect(r.rects.neu, `★빈 슬롯(${align}) 상자가 옛 화면과 다르다 — 칠만 바꾼 커밋이 자리를 움직였다`)
      .toEqual(r.rects.old);
    expect(r.diff.sizeMismatch, `★빈 슬롯(${align}) 무대 크기 자체가 다르다`).toBeUndefined();
    /* ★역방향 — 체커를 회색 단색으로 되돌리면 여기가 빨개진다(현빈 주문이 조용히 사라지는 문). */
    expect(r.diff.n,
      `★빈 슬롯(${align})의 칠이 옛 회색과 «같다» — 체크패턴이 사라졌다(현빈 2026-09-25 주문)`)
      .toBeGreaterThan(0);
  });
}
