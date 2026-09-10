/* zoom-drop-shadow.dom — 확대블럭 «도형 그림자»의 진짜 끝(런타임). 2026-09-08 신설
 *
 * ★왜 dom 이 따로 필요한가
 *   dataset 이 바뀌었는지는 tests/unit 이 잰다. 여기서 잴 것은 «화면이 실제로 바뀌었나»다 —
 *   getComputedStyle 로 filter 를 읽는다. dataset 만 보면 CSS 규칙을 통째로 지워도 초록이다.
 *
 * ★★거는 자리가 «블록»이 아니라 `.zoom-clip` 이다 — 실측으로 골랐다:
 *   ① 블록에 걸면 필터가 «선택 아웃라인»(3px 보라)까지 먹는다.
 *   ② 렌더 순서가 filter → clip-path 라, .zoom-clip 에 걸어야 «섹션 밖 크롭»이 그림자까지
 *      같이 자른다(도형은 잘렸는데 그림자만 새어 나가는 일이 없다).
 *   ⇒ 그래서 D1 은 block 이 아니라 «칠이 실제로 얹히는 층»에서 잰다. 블록에는 box-shadow 가
 *      «없음»을 같이 못박아, box-shadow 로 되돌리는 변이를 여기서도 잡는다.
 *
 * ⛔앱을 «안» 띄운다 — 고디터 인스턴스·MCP 대역 무접촉. 레포 파일만 크로미움에 얹는다.
 *   (modal-resize.dom.spec.js 의 page.route 하네스를 그대로 쓴다.)
 *
 * 실행: npm run test:dom  (또는 npx playwright test --config=tests/dom/playwright.dom.config.js zoom-drop)
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

/* ⚠️css/editor-base.css 를 «같이» 얹는다 — 안 얹으면 --sel-color 류가 안 살아 오독한다
     (modal-resize.dom.spec.js 가 이미 물렸던 함정). */
const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-blocks.css"></head><body style="margin:0">
<div id="canvas-scaler" style="transform: scale(1); transform-origin: 0 0;">
  <div id="canvas" style="width:860px">
    <div class="section-block"><div class="section-inner" id="host" style="width:860px;height:520px"></div></div>
  </div>
</div>
<div id="ss-handles-overlay"></div>
<div id="panel-right"><div class="panel-body" id="propPanel"></div></div>
<script src="/js/feature-flags.js"></script>
<script type="module">
  import '/js/blocks/zoom-block.js';
  import { showZoomProperties } from '/js/props/prop-zoom.js';
  window.__open = showZoomProperties;
  window.__ready = true;
</script></body></html>`;

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

/** 확대블럭 하나를 캔버스에 올린다. */
async function mount(page, ds = {}) {
  await page.evaluate((ds) => {
    document.getElementById('host').innerHTML = '';
    const z = document.createElement('div');
    z.className = 'zoom-block';
    Object.assign(z.dataset, { shape: 'rect', size: '260', x: '60', y: '60', shadow: 'off', fill: '#4a7cff' }, ds);
    document.getElementById('host').appendChild(z);
    window.renderZoomBlock(z);
    window.__z = z;
  }, ds);
}

const readFilters = (page) => page.evaluate(() => {
  const z = window.__z, c = z.querySelector(':scope > .zoom-clip');
  return {
    있나: { 블록: !!z, 클립: !!c },
    클립filter: c ? getComputedStyle(c).filter : null,
    블록filter: getComputedStyle(z).filter,
    블록boxShadow: getComputedStyle(z).boxShadow,
    dataset: { shadow: z.dataset.shadow, dropShadow: z.dataset.dropShadow ?? null },
  };
});

/* ── D1 ★런타임 — 정말로 none → drop-shadow(...) 로 «바뀐다» ────────────── */
test('D1 ★getComputedStyle 이 실제로 none → drop-shadow(...) 로 바뀐다 (dataset 말고 «칠»을 잰다)', async ({ page }) => {
  const errs = await boot(page);

  await mount(page, {});                       // 아직 도형 그림자 없음
  const off = await readFilters(page);
  // T0 ★입력이 살아 있다 — 잴 대상이 «있다»
  expect(off.있나.블록, '블록이 안 붙었다 — 아래 단언은 잴 것이 없는 채 통과한다').toBe(true);
  expect(off.있나.클립, '.zoom-clip 이 없다 — 칠이 얹힐 층 자체가 없다').toBe(true);
  expect(off.클립filter, '기본이 이미 그림자다 — 있던 블록이 갑자기 그림자를 얻는다').toBe('none');

  await page.evaluate(() => { window.__z.dataset.dropShadow = 'soft'; });
  const soft = await readFilters(page);
  expect(soft.클립filter, '켰는데 «칠»이 안 바뀐다 — CSS 배선이 끊겼다').toContain('drop-shadow');
  expect(soft.클립filter).not.toBe('none');

  await page.evaluate(() => { window.__z.dataset.dropShadow = 'strong'; });
  const strong = await readFilters(page);
  expect(strong.클립filter).toContain('drop-shadow');
  expect(strong.클립filter, 'soft 와 strong 이 «같은 값»이다 — 단계가 구실을 못 한다')
    .not.toBe(soft.클립filter);

  // ⛔box-shadow 로 되돌리는 변이를 여기서도 잡는다 — 블록엔 box-shadow 가 «없어야» 한다.
  expect(strong.블록boxShadow, 'box-shadow 로 칠하고 있다 — 잘린 실루엣을 안 따라간다').toBe('none');

  // 끄면 도로 빈다
  await page.evaluate(() => { window.__z.dataset.dropShadow = 'none'; });
  expect((await readFilters(page)).클립filter, '끔이 안 꺼진다').toBe('none');

  expect(errs, `콘솔 오류: ${errs.join(' | ')}`).toEqual([]);
});

/* ── D2 ★남의 것을 안 죽였다 — 광원 온오프가 «여전히» 산다 ──────────────── */
test('D2 ★광원(돋보기) 온오프가 그대로 산다 — 도형 그림자를 켜도 함께 산다', async ({ page }) => {
  const errs = await boot(page);
  const strips = () => page.evaluate(() => ({
    // 광원 사다리꼴은 <polygon> 이다(<path> 아님 — 실측하고 골랐다).
    조각: window.__z.querySelectorAll('.zoom-shadow > *').length,
    그룹있나: !!window.__z.querySelector('.zoom-shadow'),
  }));

  await mount(page, { shadow: 'off' });
  const off = await strips();
  expect(off.그룹있나, '광원 그룹(.zoom-shadow) 자체가 없다 — 셀 대상이 없으면 0건 통과다').toBe(true);
  expect(off.조각, '끔인데 광원 조각이 있다').toBe(0);

  await mount(page, { shadow: 'on' });
  const on = await strips();
  expect(on.조각, '광원을 켰는데 조각이 «0개»다 — 내가 남의 기능을 죽였다').toBeGreaterThan(0);

  // ★그리고 «둘 다» 켠 상태에서도 서로를 안 지운다 (키가 갈렸다는 런타임 증거)
  await mount(page, { shadow: 'on', dropShadow: 'strong' });
  const both = await page.evaluate(() => {
    const z = window.__z, c = z.querySelector(':scope > .zoom-clip');
    return { 광원조각: z.querySelectorAll('.zoom-shadow > *').length,
             도형그림자: getComputedStyle(c).filter, shadow: z.dataset.shadow };
  });
  expect(both.광원조각, '도형 그림자를 켜니 광원이 죽었다').toBeGreaterThan(0);
  expect(both.도형그림자, '광원이 켜져 있으니 도형 그림자가 안 먹는다').toContain('drop-shadow');
  expect(both.shadow, '도형 그림자가 광원 키를 덮어썼다').toBe('on');

  expect(errs, `콘솔 오류: ${errs.join(' | ')}`).toEqual([]);
});

/* ── D3 ★저장 → 로드 왕복 뒤에도 남는다 ─────────────────────────────────
   ⛔재구현하지 않는다 — 레포의 «진짜» serializeCleanRoot / sanitizeCanvasHtml 본문을
     그대로 떼어 페이지에서 돌린다. (저장 경로가 바뀌면 여기가 빨개져야 한다.) */
function extractFn(src, name) {
  const m = new RegExp('function\\s+' + name + '\\s*\\(').exec(src);
  if (!m) throw new Error('함수를 못 찾았다: ' + name);
  const start = m.index;
  // ⚠️f(opts = {}) 의 «기본값 중괄호»를 몸통으로 오인하지 않도록 매개변수 괄호를 «먼저» 닫는다.
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
  return src.slice(start, i);
}

test('D3 ★저장→로드 왕복 뒤에도 도형 그림자가 «칠까지» 남는다 (진짜 저장 함수로)', async ({ page }) => {
  const errs = await boot(page);
  /* ★serializeCleanRoot 는 «떠내지» 않는다 — 파일 전체(IIFE)를 그대로 싣는다.
     ⛔2026-09-09 실측: 그 함수가 같은 IIFE 안의 형제(stripRuntimeMarkers)를 부르게 되자
       extractFn 으로 떠낸 덩이는 ReferenceError 로 죽었다. 「함수 하나만 떠내면 된다」는
       그 함수가 «닫힌» 동안만 참인 가정이었다. 파일을 싣는 쪽은 그 가정이 아예 없다. */
  const SER = fs.readFileSync(path.join(REPO, 'js/io/section-serialize.js'), 'utf8');
  const SAN = extractFn(fs.readFileSync(path.join(REPO, 'js/io/save-load.js'), 'utf8'), 'sanitizeCanvasHtml');
  // T0 ★실은 덩이가 «비어 있지 않다» — 못 실었으면 아래는 빈 함수를 돌리고 통과한다.
  expect(SER.length, 'section-serialize.js 를 못 읽었다').toBeGreaterThan(500);
  expect(SAN.length, 'sanitizeCanvasHtml 을 못 떼었다').toBeGreaterThan(200);

  await mount(page, { shadow: 'on', dropShadow: 'soft' });
  const out = await page.evaluate(([serSrc, sanSrc]) => {
    (0, eval)(serSrc);                                   // window.serializeCleanRoot 를 심는다
    const serializeCleanRoot = window.serializeCleanRoot;
    if (typeof serializeCleanRoot !== 'function') return { 되살아났나: false, 세척없음: true };
    const sanitizeCanvasHtml = eval('(' + sanSrc + ')');
    const canvas = document.getElementById('canvas');
    const before = getComputedStyle(window.__z.querySelector(':scope > .zoom-clip')).filter;

    // 저장 경로 그대로: 클론 세척 → HTML 문자열 → 로드 세척 → 다시 DOM 으로
    const clean = serializeCleanRoot(canvas.cloneNode(true));
    const html = sanitizeCanvasHtml(clean.innerHTML);
    const host = document.getElementById('host');
    host.parentElement.parentElement.innerHTML = html;   // «로드»

    const re = document.querySelector('.zoom-block');
    if (!re) return { 되살아났나: false };
    const clip = re.querySelector(':scope > .zoom-clip');
    return {
      되살아났나: true,
      dropShadow: re.dataset.dropShadow ?? null,
      shadow: re.dataset.shadow ?? null,
      광원조각: re.querySelectorAll('.zoom-shadow > *').length,
      before, after: clip ? getComputedStyle(clip).filter : null,
    };
  }, [SER, SAN]);

  expect(out.세척없음, '★window.serializeCleanRoot 가 안 심겼다 — 세척을 «안 돌린» 것이다').toBeUndefined();
  expect(out.되살아났나, '왕복 뒤 블록이 사라졌다').toBe(true);
  expect(out.before, '왕복 «전»에 이미 칠이 없다 — 이 검사는 잴 것이 없었다').toContain('drop-shadow');
  expect(out.dropShadow, '저장 왕복에 도형 그림자 키가 안 실렸다').toBe('soft');
  expect(out.after, '키는 남았는데 «칠»이 안 산다').toContain('drop-shadow');
  expect(out.after, '왕복 뒤 그림자가 달라졌다').toBe(out.before);
  // 광원도 «같이» 살아 돌아온다
  expect(out.shadow, '광원 키가 왕복에서 사라졌다').toBe('on');
  expect(out.광원조각, '왕복 뒤 광원이 죽었다').toBeGreaterThan(0);

  expect(errs, `콘솔 오류: ${errs.join(' | ')}`).toEqual([]);
});
