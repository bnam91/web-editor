/* scratch-link-edges.dom — 「점선 체인이 «좌측»에서는 안 보인다」의 진짜 끝(런타임). 2026-09-09 신설
 *
 * ★현빈 보고: 섹션↔스크래치패드를 연결하면 점선이 생기는데, 스크래치패드를 섹션 «왼쪽»으로
 *   옮기면 점선이 사라진다. 오른쪽일 때만 보인다.
 *
 * ★원인(코드로 확인) — SVG 뷰포트 클립이다. 좌우만의 문제가 아니라 «위쪽»도 같은 비트로 잘린다.
 *   · #link-edges 에 viewBox 가 없다 ⇒ 사용자좌표 원점 = SVG 좌상단 = scaler-local (0,0).
 *   · .spl-edges 에 overflow 지정이 없다 ⇒ outer <svg> 의 UA 기본값 hidden 이 [0,W]×[0,H] 밖을 자른다.
 *   · js/scratchpad-link.js 의 W = max(scaler.scrollWidth, …) 인데 scrollWidth 는 «왼쪽으로는» 안 자란다.
 *     (#canvas-scaler 는 flex item + width auto = fit-content = #canvas 폭 860 그대로. 폭을 주는 코드 0건.)
 *   ⇒ 오른쪽 아이템은 scrollWidth 가 같이 커져 덮이고, 왼쪽/위쪽 아이템은 좌표가 음수라 통째로 잘린다.
 *
 * ★여기서 잴 것 — 소스 문자열로는 못 재는 것들:
 *   T0  입력이 살아 있다 (링크 1개 + <line> 1개 + 파란픽셀 세는 자가 실제로 «잰다»)
 *   T-L 좌측 배치에서 선이 «칠해진다» + 칠 bbox 가 섹션 왼쪽 경계보다 왼쪽 + 붙는 점이 «왼쪽 변»
 *   T-R 우측 배치도 «칠해진다» + bbox 가 섹션 오른쪽 경계보다 오른쪽 + 붙는 점이 «오른쪽 변»
 *   T-U 위쪽 배치에서 선이 섹션 위쪽 경계보다 위에서도 «칠해진다»
 *   판정은 눈이 아니라 «칠해진 픽셀 수 + 그 bbox 좌표»다. 배율 100 과 70 두 곳에서 잰다.
 *
 * ⛔앱을 «안» 띄운다 — 고디터 인스턴스·MCP 대역 무접촉. 레포 파일만 크로미움에 얹는다.
 *   (zoom-spread.dom.spec.js 의 page.route 하네스를 그대로 쓴다 — 새 관용구를 만들지 않는다.)
 *
 * 실행: npm run test:dom
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

/* ⚠️editor-base.css 를 «같이» 얹는다 — 안 얹으면 --ui-accent 가 안 살아 stroke 가 검정으로 읽히고
     「파란 픽셀 0」이 «조용히» 통과한다(이 레포가 이미 두 번 물린 함정).
   ⚠️editor-canvas.css 도 얹는다 — #canvas-wrap(overflow:auto)·#canvas-scaler(fit-content 폭)·
     .scratch-item(position:absolute) 이 전부 거기 있다. 이 셋이 버그의 «무대»다.
   ★scaler 의 margin 은 editor.js:397 의 _panRoomX/_panRoomY 를 흉내낸 것(팬 여지). padding-top 은
     섹션 «위»에 좌표 여유를 만들어 T-U 를 잴 수 있게 한다(절대배치 기준은 padding box = border box). */
const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-canvas.css">
<link rel="stylesheet" href="/css/editor-extra.css"></head><body style="margin:0">
<div id="canvas-wrap" style="width:1700px;height:1000px">
  <div id="canvas-scaler" style="margin:260px 360px; padding-top:260px; transition:none; transform:scale(1)">
    <div id="canvas">
      <div class="section-block" id="sec_1" style="height:360px">
        <div class="section-inner" style="height:360px"></div>
      </div>
    </div>
    <div class="scratch-item" data-scratch-id="s_1"
         style="left:-300px; top:380px; width:180px; height:110px; background:#3a3f4b"></div>
  </div>
</div>
<script src="/js/scratchpad-link.js"></script>
<script>window.currentZoom = 100; window.__ready = true;</script>
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
  await page.setViewportSize({ width: 1720, height: 1020 });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true && !!window.SPLink);
  return errs;
}

/* 배치 3종 — 값은 «scaler-local»(줌 전) 좌표다. 섹션은 local x 0..860 / y 260..620 에 있다
   (#canvas 는 scaler 와 같은 폭 860 이라 margin-inline:auto 여백이 0). */
const PLACE = {
  L: { left: -300, top: 380 },   // 중심 local (-210, 435) — 섹션 왼쪽. x<0 ⇒ 옛 코드에선 통째 클립
  R: { left: 980, top: 380 },   // 중심 local (1070, 435) — 섹션 오른쪽. scrollWidth 가 같이 커져 «안» 잘렸다
  U: { left: 340, top: -190 },   // 중심 local (430, -135) — 섹션 위. y<0 ⇒ 위쪽 토막이 클립
  /* ★2026-09-09 추가 — 「좌·우·상 셋만 재고 있었다」를 닫는다.
     D  아래쪽: scrollHeight 는 «아래로는» 자라므로 우측과 같은 이유로 안 잘릴 «것 같다» — 재 본다.
        ★안 깨져 있어도 검사로 못박는 값이 있다: 다음 사람이 「아래는 봤나」를 다시 안 물어도 된다.
     LU 좌+상 «동시»: 한 축씩만 재면 두 클립이 «같은 프레임에» 걸리는 경우를 못 본다.
        (overflow 를 축별로 나눠 쓰는 실수 — overflow-x 만 visible — 은 여기서만 잡힌다) */
  D:  { left: 340, top: 700 },    // 중심 local (430, 755) — 섹션 아래
  LU: { left: -300, top: -190 },  // 중심 local (-210, -135) — 섹션 왼쪽 «그리고» 위. x<0 && y<0
};

/** 스크래치 아이템을 배치하고 줌을 걸고, 선이 다시 그려질 때까지 기다린다. */
async function scene(page, key, zoom) {
  const p = PLACE[key];
  await page.evaluate(({ p, zoom }) => {
    const it = document.querySelector('.scratch-item');
    it.style.left = p.left + 'px';
    it.style.top = p.top + 'px';
    window.currentZoom = zoom;
    document.getElementById('canvas-scaler').style.transform = 'scale(' + (zoom / 100) + ')';
    window.SPLink.rerender();
  }, { p, zoom });
  // rAF 루프가 한 바퀴 더 돌게 둔다(diff-skip 캐시가 좌표 불변 프레임을 건너뛰므로 값 자체로 확인한다)
  await expect.poll(async () => page.evaluate(() => {
    const l = document.querySelector('#link-edges line');
    return l ? Math.round(Number(l.getAttribute('x1'))) : null;
  }), { timeout: 3000 }).toBe(Math.round(p.left + 90));
}

/** 선의 «기하» — scaler-local 좌표(줌 전). 붙는 점 x2/y2 가 섹션의 어느 변인지 여기서 갈린다. */
const geom = (page) => page.evaluate(() => {
  const l = document.querySelector('#link-edges line');
  const svg = document.getElementById('link-edges');
  const sec = document.getElementById('sec_1');
  const scaler = document.getElementById('canvas-scaler');
  const scale = (window.currentZoom || 100) / 100;
  const sr = sec.getBoundingClientRect(), cr = scaler.getBoundingClientRect();
  return {
    line: l ? { x1: +l.getAttribute('x1'), y1: +l.getAttribute('y1'), x2: +l.getAttribute('x2'), y2: +l.getAttribute('y2') } : null,
    svgW: svg ? +svg.getAttribute('width') : null,
    svgH: svg ? +svg.getAttribute('height') : null,
    svgOverflow: svg ? getComputedStyle(svg).overflow : null,
    stroke: l ? getComputedStyle(l).stroke : null,
    // 화면(뷰포트) 좌표 = 스크린샷 좌표. body 는 스크롤하지 않는다(#canvas-wrap 이 스크롤한다).
    secVp: { left: sr.left, right: sr.right, top: sr.top, bottom: sr.bottom },
    // ★SVG 뷰포트(= scaler 의 좌상단, local (0,0))의 화면 자리. 클립선은 «여기»에 그어진다.
    svgVp: { left: cr.left, top: cr.top },
    /* ★overflow:visible 의 «부작용» 감시 — 삐져나온 칠이 새 스크롤 범위를 만들면 안 된다.
       (#canvas-wrap 의 overflow:auto 가 막아 준다는 것이 이 수로 확인된다.) */
    wrapScroll: (() => { const w = document.getElementById('canvas-wrap'); return { sw: w.scrollWidth, sh: w.scrollHeight }; })(),
    secLocal: { left: (sr.left - cr.left) / scale, right: (sr.right - cr.left) / scale,
                top: (sr.top - cr.top) / scale, bottom: (sr.bottom - cr.top) / scale },
  };
});

/* ★칠을 «잰다» — 스크린샷을 페이지 안 캔버스로 되읽어 파란 픽셀 수와 bbox 를 센다.
   선 색은 --ui-accent(#7cb8ff) × opacity .55. 배경(#969696 회색)·섹션(#fff)·아이템(#3a3f4b)
   어느 쪽에 겹쳐도 b−r 이 +70 언저리로 뜬다. 문턱 30 은 안티에일리어싱 여유. */
async function paint(page) {
  const b64 = (await page.screenshot({ type: 'png' })).toString('base64');
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');           // ⛔DOM 에 안 붙인다(다음 스크린샷 오염 금지)
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let n = 0, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4;
        const r = d[i], gg = d[i + 1], bb = d[i + 2];
        if (bb - r > 30 && bb > 170 && gg > r) {
          n++;
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
    }
    return n ? { n, minX, maxX, minY, maxY } : { n: 0, minX: null, maxX: null, minY: null, maxY: null };
  }, b64);
}

const ZOOMS = [100, 70];

/* ── T0 ★입력이 살아 있다 ─────────────────────────────────────────────────────
 * 아래 T-L/T-R/T-U 는 전부 「파란 픽셀」로 판정한다. 링크가 안 만들어져 있으면 픽셀은 그냥 0 이고
 * 「0 은 0 이다」로 조용히 통과하는 길이 열린다. 그 길을 «먼저» 막는다. */
test('T0 ★입력이 살아 있다 — 링크 1개 + <line> 1개 + 파란픽셀 세는 자가 실제로 «잰다»(양성/음성 대조)', async ({ page }) => {
  const errs = await boot(page);

  // 링크 «전» — 잴 것이 없다(음성 대조: 세는 자가 남의 파랑을 세고 있지 않다는 증거)
  await page.evaluate(() => window.SPLink.rerender());
  const before = await paint(page);
  expect(before.n, `링크가 0인데 파란 픽셀이 ${before.n}개 있다 — 세는 자가 «선이 아닌 것»을 세고 있다`).toBeLessThan(20);

  await page.evaluate(() => window.SPLink.addLink('sec_1', 's_1'));

  // ★순서가 중요하다 — 「링크가 있나」를 «먼저» 묻는다. 링크를 만드는 줄이 죽으면 여기서 먼저 빨개진다.
  const links = await page.evaluate(() => window.SPLink.allLinks().length);
  expect(links, 'SPLink.allLinks() 가 1이 아니다 — 링크를 만드는 줄이 죽었다').toBe(1);
  const lines = await page.evaluate(() => document.querySelectorAll('#link-edges line').length);
  expect(lines, '#link-edges 안에 <line> 이 1개가 아니다 — 그릴 대상이 없다').toBe(1);

  await scene(page, 'R', 100);

  const g = await geom(page);
  expect(g.stroke, `stroke 가 안 풀렸다(${g.stroke}) — editor-base.css 를 안 얹었다`).toMatch(/^rgb/);
  expect(g.stroke, 'stroke 가 검정이다 — --ui-accent 토큰이 죽었다').not.toBe('rgb(0, 0, 0)');

  /* ★ⓒ overflow 를 «로그로만» 찍고 있었다 — 찍기만 하면 그 값이 hidden 으로 돌아가도
     아무도 안 본다. 이게 좌·상 잘림의 «직접 원인»이므로 여기서 못박는다.
     ⛔축별로 나누지 마라(overflow-x 만 visible) — 그러면 아래 T-LU 가 빨개진다. */
  expect(g.svgOverflow, '★.spl-edges 의 overflow 가 visible 이 아니다 — SVG 뷰포트가 다시 자른다').toBe('visible');

  // 양성 대조 — 링크가 «생기면» 파란 픽셀이 실제로 늘어난다
  const after = await paint(page);
  console.log(`[T0] 링크전 파란픽셀=${before.n} · 링크후(우측/zoom100)=${after.n} · stroke=${g.stroke}`);
  expect(after.n, '링크를 만들었는데 파란 픽셀이 안 늘었다 — 이 검사 전체가 눈먼 상태다').toBeGreaterThan(before.n + 50);

  expect(errs, `콘솔 오류: ${errs.join(' | ')}`).toEqual([]);
});

/* ── T-L ★좌측 — 이게 현빈이 본 버그다 ──────────────────────────────────────── */
test('T-L ★섹션 «왼쪽»에 둔 스크래치패드로 가는 선이 칠해진다 — 칠 bbox 가 섹션 왼쪽 경계보다 왼쪽', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => window.SPLink.addLink('sec_1', 's_1'));

  for (const zoom of ZOOMS) {
    await scene(page, 'L', zoom);
    const g = await geom(page);
    const p = await paint(page);
    // ★이 무대에선 섹션 왼쪽 경계 = SVG 뷰포트 왼쪽 경계다(scaler 폭 = #canvas 폭 860, 여백 0) —
    //   즉 「섹션보다 왼쪽」이 곧 「뷰포트 밖」이라 클립을 정면으로 잰다.
    expect(Math.abs(g.secVp.left - g.svgVp.left), '무대 전제가 깨졌다: 섹션 왼쪽 ≠ SVG 뷰포트 왼쪽').toBeLessThan(1.5);
    console.log(`[T-L zoom${zoom}] 파란픽셀=${p.n} · bbox.minX=${p.minX} · 섹션.left(vp)=${g.secVp.left.toFixed(1)}`
      + ` · line.x2(local)=${g.line.x2} · 섹션.left(local)=${g.secLocal.left.toFixed(1)}`
      + ` · svg=${g.svgW}x${g.svgH} overflow=${g.svgOverflow} · wrap.scroll=${g.wrapScroll.sw}x${g.wrapScroll.sh}`);

    // ★붙는 점이 «왼쪽 변»이다 — 이게 틀리면 아래 픽셀 단언은 엉뚱한 선을 보고 초록이 된다
    expect(Math.abs(g.line.x2 - g.secLocal.left), `zoom${zoom} 좌측인데 선이 섹션 «왼쪽 변»에 안 붙었다: x2=${g.line.x2}`).toBeLessThan(1.5);

    expect(p.n, `zoom${zoom} 좌측 배치에서 선이 «한 점도» 안 칠해졌다 (SVG 뷰포트 클립)`).toBeGreaterThan(40);
    expect(p.minX, `zoom${zoom} 좌측: 칠이 섹션 왼쪽 경계(${g.secVp.left.toFixed(1)}) 밖으로 안 나갔다 = 잘렸다`)
      .toBeLessThan(g.secVp.left - 5);
  }
  expect(errs, `콘솔 오류: ${errs.join(' | ')}`).toEqual([]);
});

/* ── T-R ★우측 — 한쪽만 보면 «반대로 깨져도» 초록이다 ───────────────────────── */
test('T-R ★섹션 «오른쪽» 배치도 그대로다 — 칠이 섹션 오른쪽 경계 밖까지 가고 선은 «오른쪽 변»에 붙는다', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => window.SPLink.addLink('sec_1', 's_1'));

  for (const zoom of ZOOMS) {
    await scene(page, 'R', zoom);
    const g = await geom(page);
    const p = await paint(page);
    console.log(`[T-R zoom${zoom}] 파란픽셀=${p.n} · bbox.maxX=${p.maxX} · 섹션.right(vp)=${g.secVp.right.toFixed(1)}`
      + ` · line.x2(local)=${g.line.x2} · 섹션.right(local)=${g.secLocal.right.toFixed(1)}`
      + ` · svg=${g.svgW}x${g.svgH} overflow=${g.svgOverflow} · wrap.scroll=${g.wrapScroll.sw}x${g.wrapScroll.sh}`);

    expect(Math.abs(g.line.x2 - g.secLocal.right), `zoom${zoom} 우측인데 선이 섹션 «오른쪽 변»에 안 붙었다: x2=${g.line.x2}`).toBeLessThan(1.5);

    expect(p.n, `zoom${zoom} 우측 배치에서 선이 «한 점도» 안 칠해졌다`).toBeGreaterThan(40);
    expect(p.maxX, `zoom${zoom} 우측: 칠이 섹션 오른쪽 경계(${g.secVp.right.toFixed(1)}) 밖까지 안 갔다`)
      .toBeGreaterThan(g.secVp.right + 5);
  }
  expect(errs, `콘솔 오류: ${errs.join(' | ')}`).toEqual([]);
});

/* ── T-U ★위쪽 — 좌우만의 문제가 아니다. 같은 비트로 잘린다 ─────────────────── */
test('T-U ★섹션 «위쪽» 배치에서도 안 잘린다 — 칠이 섹션 위쪽 경계보다 위까지 간다', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => window.SPLink.addLink('sec_1', 's_1'));

  for (const zoom of ZOOMS) {
    await scene(page, 'U', zoom);
    const g = await geom(page);
    const p = await paint(page);
    console.log(`[T-U zoom${zoom}] 파란픽셀=${p.n} · bbox.minY=${p.minY} · SVG뷰포트.top(vp)=${g.svgVp.top.toFixed(1)}`
      + ` · 섹션.top(vp)=${g.secVp.top.toFixed(1)} · line.y1(local)=${g.line.y1}`
      + ` · svg=${g.svgW}x${g.svgH} overflow=${g.svgOverflow} · wrap.scroll=${g.wrapScroll.sw}x${g.wrapScroll.sh}`);

    // 출발점이 «SVG 뷰포트 위»(local y<0)여야 이 검사가 클립을 재는 검사가 된다
    expect(g.line.y1, `zoom${zoom} 위쪽 배치인데 출발점이 음수가 아니다 — 클립을 잴 자리가 아니다: y1=${g.line.y1}`).toBeLessThan(0);

    expect(p.n, `zoom${zoom} 위쪽 배치에서 선이 «한 점도» 안 칠해졌다`).toBeGreaterThan(40);
    /* ★클립선은 «섹션 위»가 아니라 «SVG 뷰포트 위»(= scaler 좌상단)에 그어진다.
       섹션 위쪽 여백(local y 0..260)은 잘려도 칠해지므로 섹션 기준으론 잘림을 못 잡는다 — 실측:
       고치기 전에도 minY 가 섹션.top 보다 위였다(301 < 560). 뷰포트 경계로 재야 빨개진다. */
    expect(p.minY, `zoom${zoom} 위쪽: 칠이 SVG 뷰포트 위쪽 경계(${g.svgVp.top.toFixed(1)}) 위로 안 올라갔다 = 잘렸다`)
      .toBeLessThan(g.svgVp.top - 5);
    expect(p.minY, `zoom${zoom} 위쪽: 칠이 섹션 위쪽 경계(${g.secVp.top.toFixed(1)}) 위로 안 올라갔다`)
      .toBeLessThan(g.secVp.top - 5);
  }
  expect(errs, `콘솔 오류: ${errs.join(' | ')}`).toEqual([]);
});

/* ── T-D ★아래쪽 — 「셋만 재고 있었다」의 나머지 ①. 안 깨져 있어도 «검사로» 못박는다 ───── */
test('T-D ★섹션 «아래쪽» 배치에서도 안 잘린다 — 칠이 섹션 아래 경계보다 아래까지 간다', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => window.SPLink.addLink('sec_1', 's_1'));

  for (const zoom of ZOOMS) {
    await scene(page, 'D', zoom);
    const g = await geom(page);
    const p = await paint(page);
    console.log(`[T-D zoom${zoom}] 파란픽셀=${p.n} · bbox.maxY=${p.maxY} · 섹션.bottom(vp)=${g.secVp.bottom.toFixed(1)}`
      + ` · line.y1(local)=${g.line.y1} · 섹션.bottom(local)=${g.secLocal.bottom.toFixed(1)}`
      + ` · svg=${g.svgW}x${g.svgH} overflow=${g.svgOverflow} · wrap.scroll=${g.wrapScroll.sw}x${g.wrapScroll.sh}`);

    // ★입력이 살아 있다 — 출발점이 «섹션 아래»여야 이 검사가 잴 것이 있다.
    expect(g.line.y1, `zoom${zoom} 아래 배치인데 출발점이 섹션 아래가 아니다: y1=${g.line.y1}`)
      .toBeGreaterThan(g.secLocal.bottom);
    /* ★붙는 점은 «아래 변»이 아니다 — 실측으로 갈렸다(첫 판에서 내가 틀렸다).
       js/scratchpad-link.js:478 은 붙는 점을 «좌·우 변의 중간 높이»로만 고른다
       (attachRight 하나뿐 · sy = 섹션 중앙 y). 위·아래 변에 붙는 길이 «없다».
       ⇒ 아래 배치에서도 선은 섹션 왼쪽/오른쪽 변 중앙으로 간다. 그게 «설계»이므로
         여기서 그렇게 못박는다 — 나중에 위·아래 앵커가 생기면 이 줄이 먼저 빨개진다. */
    expect(Math.abs(g.line.y2 - (g.secLocal.top + g.secLocal.bottom) / 2),
      `zoom${zoom} 붙는 점이 섹션 «중간 높이»가 아니다: y2=${g.line.y2}`).toBeLessThan(1.5);
    expect(Math.min(Math.abs(g.line.x2 - g.secLocal.left), Math.abs(g.line.x2 - g.secLocal.right)),
      `zoom${zoom} 붙는 점이 섹션 좌·우 변 어느 쪽도 아니다: x2=${g.line.x2}`).toBeLessThan(1.5);

    expect(p.n, `zoom${zoom} 아래 배치에서 선이 «한 점도» 안 칠해졌다`).toBeGreaterThan(40);
    expect(p.maxY, `zoom${zoom} 아래: 칠이 섹션 아래 경계(${g.secVp.bottom.toFixed(1)}) 밖까지 안 갔다`)
      .toBeGreaterThan(g.secVp.bottom + 5);
  }
  expect(errs, `콘솔 오류: ${errs.join(' | ')}`).toEqual([]);
});

/* ── T-LU ★좌+상 «동시» — 한 축씩 재면 못 보는 자리 ────────────────────────────
 * ⛔축을 나눠 고치는 실수(overflow-x: visible 만)는 T-L 도 T-U 도 통과시킨다.
 *   «두 클립이 같은 프레임에» 걸려야 잡힌다. */
test('T-LU ★«왼쪽 그리고 위» 동시 배치에서도 안 잘린다 — 칠이 SVG 뷰포트의 좌·상 밖으로 «둘 다» 나간다', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => window.SPLink.addLink('sec_1', 's_1'));

  for (const zoom of ZOOMS) {
    await scene(page, 'LU', zoom);
    const g = await geom(page);
    const p = await paint(page);
    console.log(`[T-LU zoom${zoom}] 파란픽셀=${p.n} · bbox=(${p.minX},${p.minY}) · SVG뷰포트=(${g.svgVp.left.toFixed(1)},${g.svgVp.top.toFixed(1)})`
      + ` · line=(${g.line.x1},${g.line.y1})→(${g.line.x2},${g.line.y2})`
      + ` · svg=${g.svgW}x${g.svgH} overflow=${g.svgOverflow} · wrap.scroll=${g.wrapScroll.sw}x${g.wrapScroll.sh}`);

    // ★입력이 살아 있다 — 출발점이 «두 축 다» 음수여야 이 검사가 두 클립을 동시에 잰다.
    expect(g.line.x1, `zoom${zoom} x1 이 음수가 아니다 — 좌측 클립을 잴 자리가 아니다: x1=${g.line.x1}`).toBeLessThan(0);
    expect(g.line.y1, `zoom${zoom} y1 이 음수가 아니다 — 상단 클립을 잴 자리가 아니다: y1=${g.line.y1}`).toBeLessThan(0);

    expect(p.n, `zoom${zoom} 좌+상 동시 배치에서 선이 «한 점도» 안 칠해졌다`).toBeGreaterThan(40);
    expect(p.minX, `zoom${zoom} 좌+상: 칠이 SVG 뷰포트 «왼쪽»(${g.svgVp.left.toFixed(1)}) 밖으로 안 나갔다 = x축이 잘렸다`)
      .toBeLessThan(g.svgVp.left - 5);
    expect(p.minY, `zoom${zoom} 좌+상: 칠이 SVG 뷰포트 «위»(${g.svgVp.top.toFixed(1)}) 밖으로 안 나갔다 = y축이 잘렸다`)
      .toBeLessThan(g.svgVp.top - 5);
  }
  expect(errs, `콘솔 오류: ${errs.join(' | ')}`).toEqual([]);
});

/* ── T-SC ★사이드카(노트 카드 층) — 「안 봤다」를 닫는다 ──────────────────────────
 * ★결론부터: .spl-sidecar 는 «잘리지 않는다. 만들어지지 않기 때문»이다.
 *   현빈 재설계로 #link-sidecar 는 폐기됐고(js/scratchpad-link.js:203), _ensureEdges 가
 *   부를 때마다 «구 잔재»를 지운다(:210). css/editor-extra.css:1830 의 규칙만 남아 있어
 *   소스를 읽는 사람에게 「살아 있는 층」으로 보인다 — 그게 이 질문이 나온 이유다.
 * ⇒ 「div 라 안 잘릴 «것 같다»」로 두지 않고, «없다»는 사실 자체를 검사로 박는다.
 *   되살아나면(누가 사이드카를 다시 만들면) 여기가 빨개지고, 그때 클립도 같이 재야 한다. */
test('T-SC ★사이드카 층은 «만들어지지 않는다» — 잘릴 층 자체가 없다(잔재가 있어도 걷힌다)', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => window.SPLink.addLink('sec_1', 's_1'));
  await scene(page, 'L', 100);

  const got = await page.evaluate(() => {
    const q = () => ({
      byId: !!document.getElementById('link-sidecar'),
      byCls: document.querySelectorAll('.spl-sidecar').length,
    });
    const 평소 = q();
    // ★양성대조 — «잔재»를 손으로 심어 본다. 안 심으면 「0」이 「걷혀서 0」인지 «원래 0»인지 모른다.
    const stale = document.createElement('div');
    stale.id = 'link-sidecar'; stale.className = 'spl-sidecar';
    document.getElementById('canvas-scaler').appendChild(stale);
    const 심은직후 = q();
    window.SPLink.rerender();
    return { 평소, 심은직후, 렌더후: q() };
  });

  expect(got.평소.byId, '★사이드카가 «평소에» 만들어진다 — 폐기됐다는 전제가 깨졌다. 클립도 다시 재라').toBe(false);
  expect(got.평소.byCls, '★.spl-sidecar 층이 살아 있다 — 폐기 전제가 깨졌다').toBe(0);
  expect(got.심은직후.byId, '★잔재를 못 심었다 — 아래 「걷혔다」는 공짜 초록이다').toBe(true);
  expect(got.렌더후.byId, '★구 사이드카 잔재가 안 걷힌다(scratchpad-link.js:210)').toBe(false);
  expect(got.렌더후.byCls, '★.spl-sidecar 가 렌더 뒤에도 남는다').toBe(0);

  expect(errs, `콘솔 오류: ${errs.join(' | ')}`).toEqual([]);
});
