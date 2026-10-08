/* thumb-canvas-parity — ★썸네일 픽셀 ↔ ★캔버스 픽셀을 ★같은 자로 견준다 (C 버그 ② · 2026-10-08 지디 레인 gd/thumb)
 * ──────────────────────────────────────────────────────────────────────────────
 * ★자 = 같은 섹션을 두 번 찍어 ★같은 좌표계(폭 860 · scale 1)로 겹친다:
 *     A = ★캔버스 픽셀  — 라이브 섹션을 크로미움 합성기로 찍는다(page.screenshot)
 *     B = ★썸네일 픽셀  — ★진짜 captureThumbnail(=saveProjectToFile 이 부른다)이 html2canvas 에
 *                        넘겨 받은 ★그 캔버스. window.html2canvas 를 ★원본을 부르는 껍데기로 갈아 끼워 가로챈다
 *                        (선례: tests/dom/e157-grid-ratio.dom.spec.js W2).
 *   ⇒ 「다르다」로 끝내지 않는다 — ★꾸밈마다 ★제 띠(band)를 두고 ★그 띠에서만 센다.
 *
 * ★양성대조(⛔HEAD 금지): GD1001_ROOT=<기준판 체크아웃> npx playwright test ... thumb-canvas-parity
 *   기준판 = 이 레인의 분기점. ★_root-harness 가 그 ROOT 의 파일을 싣는다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/thumb-canvas-parity.dom.spec.js
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ⚠️★★이 자의 ★한계 — ★«24 안에 든다»를 잠그지 ★«같다»를 ★안 잠근다 (2026-10-09 지디 판정)
 * ──────────────────────────────────────────────────────────────────────────────
 * ★C2-a 의 bandStats 는 `|Δ| > tol(24)` 인 픽셀을 ★센다. ⇒ 「다른 점 0」은 ★★«전부 24 안»이라는 뜻이고
 *   ★★«같다»가 ★아니다. ⛔그 0 을 ★「항등」으로 ★읽지 마라 — ★내가 ★한 번 그렇게 적었고 ★틀렸다.
 *
 * ★★명부 ⒜ 이름 — ★★`REFLECT-MIRROR-ALPHA`  (★남은 차이 · ⛔결함 아님 · ★원인 ★미규명)
 *   ⒝ ★★수 ★둘 — ★★«장면에 따라 ★10배 다르다». ⛔한 수로 적지 마라:
 *        ★이 하네스(에셋 780 · ★visH 429 · dpr 1 · 368,080px):  ★최대 ★2  · 평균 ★0.38 · >8 ★0건
 *        ★실앱 9415(에셋 200 · ★visH 110 · dpr 2 ·  43,600px):  ★최대 ★20 · 평균 ★10.1 · >24 0 · >16 15.6% · >8 60.1%
 *        ★둘 다 판 2b34abcc · ★둘 다 >24 ★0건(그래서 C2-a 는 ★양쪽에서 초록이다)
 *   ⒞ ★꼴 — ★실앱 줄별 y0 19.0 → y20 16 → y40 12 → y60 8 → y80 5 → y100 1.0
 *        ⇒ ★★델타가 ★α 에 ★비례 = ★★«체계적» 차이다. ⛔잡음이 ★아니다
 *        ★하네스 줄별은 ★0.0~1.0 로 ★평평하다 ⇒ ★★그 체계적 꼴이 ★거기선 ★안 보인다
 *   ⒟ ★★기각한 가설 ★둘:
 *        ⑴ 「dpr2 축소가 ramp 를 치우친다」 — `screenshot({scale:'css'})`(★축소 없음) vs device 가
 *           ★최대 20 · 평균 10.11 · ★줄별 ★동일 ⇒ ★★내 자가 아니라 ★제품 쪽이다
 *           (★비교 대상 B 는 ★한 번만 떠서 둘이 ★같은 것을 봤다)
 *        ⑵ 「dpr 이 갈랐다」 — ⛔아니다. ★하네스(dpr 1)와 실앱(dpr 2)이 ★다른 것은 ★맞지만
 *           ⑴ 이 ★dpr 을 ★이미 기각했다 ⇒ ★★남은 후보는 ★«visH(페이드 길이)»다
 *   ⒠ ★뜻 — ★거울이 ★살짝 ★더 진하다(실앱 B 환산 α 차 ≈ ★0.07 · 비 ≈ ★1.12).
 *        ★★그리고 ★페이드가 ★짧을수록 ★커진다(429→2 · 110→20)
 *   ⒡ ⛔★안 쟀다 — ★★«visH 가 정말 ★원인인가»를 ★한 환경에서 ★visH 만 바꿔 ★가르지 ★않았다.
 *        ★지금 수 둘은 ★장면·환경이 ★같이 달라져 ★★교란돼 있다. ⇒ ★★원인은 ★미확정이다
 *
 * ★★«전»은 ★100%(순백)였다 ⇒ ★이득 대비 ★비용이 안 맞아 ★더 파지 ★않는다(지디 판정 2026-10-09).
 * ★그 대신 ★★«수»를 ★C2-c 가 ★잠근다 — ★나빠지면 ★빨개진다. ★0 으로 고쳐지면 ★그 줄을 ★조여라.
 * ══════════════════════════════════════════════════════════════════════════════
 */
const { test, expect } = require('@playwright/test');
const { bootApp, ROOT, waitStableRect } = require('./_root-harness.js');

/* ★★이 파일의 검사는 ★무겁다 — bootApp(앱 통째) ＋ 패널 ★진짜 클릭 2회 ＋ screenshot ＋ ★진짜 html2canvas 2회.
   ★실측(2026-10-09): 워커 1에서 ★12~24s · 워커 3 ＋ load 에서 ★33s ⇒ 설정 기본 30000ms 를 ★넘었다.
   ★★그 빨강은 ★단언이 아니라 ★`Test timeout of 30000ms exceeded` 였다 — 무력화 실험에서 ★«내 고침이 잡은 것»과
     ★«부하가 잡은 것»이 ★섞였다(2 빨강 중 1이 이것이었다).
   ⇒ ★부하가 ★값을 잃게 하지 않도록 ★이 파일만 ★상한을 올린다. ⛔다른 파일의 30s 를 건드리지 않는다.
   ⚠️이것은 ★느린 것을 ★덮는 게 아니다 — ★이 검사는 ★원래 이만큼 걸린다(h2c 가 비용이다). */
test.describe.configure({ timeout: 120000 });

const SEC_W = 860;

/* 장면 — 섹션 하나에 ⑴반사 켠 에셋(주황) ⑵형광펜 켠 텍스트 ⑶아래 표식 텍스트.
   ★자리를 «고정 id»로 잡는다 — 띠 좌표를 그 요소에서 «읽어서» 쓴다(⛔손으로 박지 않는다). */
async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1600 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="pS" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="pI">
      <div class="gap-block" data-type="gap" style="height:30px"></div><div class="row" id="pR1" data-layout="stack"></div>
      <div class="gap-block" data-type="gap" style="height:30px"></div><div class="row" id="pR2" data-layout="stack"></div>
      <div class="gap-block" data-type="gap" style="height:30px"></div><div class="row" id="pR3" data-layout="stack"></div>
      <div class="gap-block" data-type="gap" style="height:30px"></div><div class="row" id="pR4" data-layout="stack"></div>
      <div class="gap-block" data-type="gap" style="height:60px"></div></div></div>`);
    const text = (id, row, s, color, size) => {
      const { block: tb } = window.makeTextBlock('h1'); const tf = window._makeTextFrame();
      window.applyTextOpts(tb, tf, {}, 'h1'); tf.appendChild(tb); tb.id = id; tf.id = id + 'F';
      const h = tb.querySelector('[class^="tb-"]');
      h.textContent = s; h.style.color = color; h.style.fontSize = size + 'px'; h.style.lineHeight = '1';
      document.getElementById(row).appendChild(tf); return tb;
    };
    /* ⑴ 반사용 에셋 — 주황 단색 그림(반사가 생기면 섹션 흰 바닥에 ★주황 틴트가 깔린다) */
    const cv = document.createElement('canvas'); cv.width = 300; cv.height = 120;
    const x = cv.getContext('2d'); x.fillStyle = '#ff6600'; x.fillRect(0, 0, 300, 120);
    const r = window.makeAssetBlock(); const ab = r.block || r; ab.id = 'pA';
    document.getElementById('pR1').appendChild(ab);
    window.rebindAll?.(); window.updateAssetBlock('pA', { imgSrc: cv.toDataURL('image/png') });
    /* ⑵ 형광펜 텍스트 — 획(노랑)이 ★글자 길이만큼. 글자는 검정 */
    text('pT', 'pR2', 'HILITE', '#111111', 72);
    /* ⑶ ★줄바꿈되는 형광펜 텍스트 — box-decoration-break:clone 이 ★필요한 자리.
          html2canvas 는 그 속성을 ★모른다(vendor 전수 0건) ⇒ 여러 줄을 ★한 상자로 칠할 수 있다. */
    text('pW', 'pR3', 'WRAP WRAP WRAP WRAP WRAP WRAP WRAP WRAP WRAP WRAP WRAP WRAP', '#111111', 64);
    /* ⑷ 형광펜 «아래»에 두는 표식 텍스트 — 획이 «밑을 덮나»를 재는 자리 */
    text('pB', 'pR4', 'UNDER', '#0b7d3b', 48);
    window.rebindAll?.(); window.deselectAll?.(); window.applyZoom?.(100);
  });
  /* ⛔고정 대기를 ★쓰지 않는다 — ★부하에서 「느리게」가 아니라 ★「틀리게」 된다(값을 잃는다).
     ⇒ ⑴에셋 그림이 ★실제로 로드됐나 ⑵섹션 사각형이 ★멈췄나 둘을 ★조건으로 기다린다. */
  await page.waitForFunction(() => {
    const i = document.querySelector('#pA img');
    return !!i && i.complete && i.naturalHeight > 0;
  }, null, { timeout: 20000 });
  await waitStableRect(page, '#pS');
  return errs;
}

/* ★형광펜을 ★사람이 하는 순서로 켠다 — 블럭을 고르고 패널 H 단추를 ★진짜 마우스로 누른다. */
async function turnOnHighlight(page, id) {
  await page.evaluate(() => window.deselectAll?.());
  await page.evaluate((i) => document.getElementById(i).scrollIntoView({ block: 'center' }), id);
  const r = await waitStableRect(page, '#' + id);              // ★멈춘 뒤의 좌표로 누른다(빗나감 방지)
  await page.mouse.click(r.left + 8, r.cy);
  /* ★패널 H 단추가 ★뜰 때까지 — ⛔고정 대기 금지 */
  await page.waitForFunction(() => !!document.getElementById('txt-highlight-btn'), null, { timeout: 15000 }).catch(() => {});
  const hb = await page.$('#txt-highlight-btn');
  if (!hb) return false;
  await page.evaluate(() => document.getElementById('txt-highlight-btn').scrollIntoView({ block: 'center' }));
  const br = await waitStableRect(page, '#txt-highlight-btn');
  await page.mouse.click(br.cx, br.cy);
  /* ★획이 ★생겼나를 ★조건으로 기다린다 */
  const got = await page.waitForFunction((i) => !!document.getElementById(i)?.querySelector('span.tb-hl'), id, { timeout: 15000 })
    .then(() => true).catch(() => false);
  await page.evaluate(() => window.deselectAll?.());
  await waitStableRect(page, '#pS');
  return got;
}

/** A = 캔버스 픽셀. 라이브 섹션을 찍어 ★폭 860 으로 맞춘 RGBA 를 돌려준다. */
async function canvasPixels(page) {
  const box = await page.evaluate(() => { const e = document.getElementById('pS'); e.scrollIntoView({ block: 'start' });
    const q = e.getBoundingClientRect(); return { x: q.left, y: q.top, width: q.width, height: q.height }; });
  const shot = await page.screenshot({ clip: { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) } });
  return page.evaluate(async ({ b64, w }) => {
    const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
    const c = document.createElement('canvas'); c.width = w; c.height = Math.round(im.height * w / im.width);
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(im, 0, 0, c.width, c.height);
    const d = g.getImageData(0, 0, c.width, c.height);
    return { w: c.width, h: c.height, data: Array.from(d.data) };
  }, { b64: shot.toString('base64'), w: SEC_W });
}

/** B = 썸네일 픽셀. ★진짜 captureThumbnail 이 html2canvas 에 넘긴 클론의 그림. */
async function thumbPixels(page) {
  return page.evaluate(async () => {
    const orig = window.html2canvas;
    let got = null;
    window.html2canvas = async (el, opt) => { const cv = await orig(el, opt); got = cv; return cv; };
    /* ★projectId 를 ★반드시 준다 — 없으면 _doSaveProjectToFile 이 `if (!targetId) return;` 로
       ★captureThumbnail «전»에 돌아간다(bootApp 은 ?project= 없이 index.html 을 연다).
       ⇒ 안 주면 C* 가 전부 ★SKIP 이 되고 그 침묵이 ★「결함 없다」로 읽힌다(실측: 저장 3회 → h2c 0회). */
    try { await window.saveProjectToFile?.(window.serializeProject(), { projectId: 'p_parity' }); } finally { window.html2canvas = orig; }
    if (!got) return null;
    const g = got.getContext('2d', { willReadFrequently: true });
    const d = g.getImageData(0, 0, got.width, got.height);
    return { w: got.width, h: got.height, data: Array.from(d.data) };
  });
}

/** 띠(y0~y1, x0~x1) 안에서 ⑴다른 점의 수 ⑵평균색 둘을 센다. 좌표계는 ★폭 860 기준. */
function bandStats(A, B, band, tol = 24) {
  const y0 = Math.max(0, Math.round(band.y0)), y1 = Math.min(Math.min(A.h, B.h), Math.round(band.y1));
  const x0 = Math.max(0, Math.round(band.x0)), x1 = Math.min(Math.min(A.w, B.w), Math.round(band.x1));
  let diff = 0, n = 0; const sa = [0, 0, 0], sb = [0, 0, 0];
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * A.w + x) * 4, j = (y * B.w + x) * 4;
    for (let k = 0; k < 3; k++) { sa[k] += A.data[i + k]; sb[k] += B.data[j + k]; }
    if (Math.abs(A.data[i] - B.data[j]) > tol || Math.abs(A.data[i + 1] - B.data[j + 1]) > tol || Math.abs(A.data[i + 2] - B.data[j + 2]) > tol) diff++;
    n++;
  }
  return { diff, n, ratio: n ? diff / n : 0, box: [x0, y0, x1, y1],
           a: sa.map(v => Math.round(v / Math.max(1, n))), b: sb.map(v => Math.round(v / Math.max(1, n))) };
}

/** 요소 ★자체의 띠를 ★섹션 좌표(폭 860)로. */
const bandOf = (page, id) => page.evaluate(([i, W]) => {
  const s = document.getElementById('pS').getBoundingClientRect();
  const e = document.getElementById(i).getBoundingClientRect();
  const k = W / s.width;
  return { x0: (e.left - s.left) * k, x1: (e.right - s.left) * k, y0: (e.top - s.top) * k, y1: (e.bottom - s.top) * k };
}, [id, SEC_W]);

/** 요소 ★바로 아래의 띠 — 요소 바닥 + from … + to (px, 요소 좌표). ★반사가 깔리는 자리다.
 *  ⛔bandOf(…, dy, dh) 로 하면 요소 ★자신까지 들어간다(첫 실측에서 그렇게 됐다: 반사띠 평균이 순주황 255,106,7). */
const belowBand = (page, id, from, to) => page.evaluate(([i, f, t, W]) => {
  const s = document.getElementById('pS').getBoundingClientRect();
  const e = document.getElementById(i).getBoundingClientRect();
  const k = W / s.width;
  return { x0: (e.left - s.left) * k, x1: (e.right - s.left) * k, y0: (e.bottom - s.top + f) * k, y1: (e.bottom - s.top + t) * k };
}, [id, from, to, SEC_W]);

/** ★반사가 «보이는» 구간을 ★정본 값에서 계산한다 — gap … gap + h·len/100. ⛔수를 손으로 박지 않는다. */
const reflectSpan = (page, id) => page.evaluate((i) => {
  const el = document.getElementById(i);
  const fx = window.fxReflectOf(el);
  return { gap: fx.gap, visH: el.offsetHeight * fx.len / 100, state: fx.state, op: fx.op };
}, id);

/** 띠 안에서 ★«그 색» 픽셀을 ★센다 — 평균은 ★흰 여백에 묻힌다(첫 실측: 형광펜 평균 234,231,204 로 문턱 미달).
 *  돌려주는 것 = { a, b } = 캔버스·썸네일 각각의 ★해당 색 픽셀 수. */
function colorCount(A, B, band, rgb, tol) {
  const y0 = Math.max(0, Math.round(band.y0)), y1 = Math.min(Math.min(A.h, B.h), Math.round(band.y1));
  const x0 = Math.max(0, Math.round(band.x0)), x1 = Math.min(Math.min(A.w, B.w), Math.round(band.x1));
  let a = 0, b = 0, n = 0;
  const hit = (d, i) => Math.abs(d[i] - rgb[0]) <= tol && Math.abs(d[i + 1] - rgb[1]) <= tol && Math.abs(d[i + 2] - rgb[2]) <= tol;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    if (hit(A.data, (y * A.w + x) * 4)) a++;
    if (hit(B.data, (y * B.w + x) * 4)) b++;
    n++;
  }
  return { a, b, n, box: [x0, y0, x1, y1] };
}
const HL_RGB = [255, 235, 59];     /* ★--ui-highlight 정본 = css/editor-base.css:96 `#ffeb3b` */

/** ★최대 채널 델타 ＋ 평균 ＋ 초과 분포. ⛔bandStats 의 「다른 점 0」이 못 보는 것을 ★이것이 본다.
 *  돌려주는 것 = { max, mean, over8, over16, over24, n, rows } (rows = 줄별 평균, 페이드 프로파일) */
/** ★흰 바닥 위 ★주황 틴트 픽셀 수 — R−B > 20. ⛔순색 `#ff6600` 과의 ★색거리로 재지 마라:
 *  반사는 ★배경과 ★섞여 (255,186,141) 꼴이 되고 ★순색에서 ★멀다(실측 2026-10-09 — 내 전제가 그래서 0 이 나왔다). */
function tintCount(P, band) {
  const y0 = Math.max(0, Math.round(band.y0)), y1 = Math.min(P.h, Math.round(band.y1));
  const x0 = Math.max(0, Math.round(band.x0)), x1 = Math.min(P.w, Math.round(band.x1));
  let n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * P.w + x) * 4; if (P.data[i] - P.data[i + 2] > 20) n++; }
  return n;
}

function deltaProfile(A, B, band) {
  const y0 = Math.max(0, Math.round(band.y0)), y1 = Math.min(Math.min(A.h, B.h), Math.round(band.y1));
  const x0 = Math.max(0, Math.round(band.x0)), x1 = Math.min(Math.min(A.w, B.w), Math.round(band.x1));
  let max = 0, sum = 0, n = 0, o8 = 0, o16 = 0, o24 = 0; const rows = [];
  for (let y = y0; y < y1; y++) {
    let rs = 0, rn = 0;
    for (let x = x0; x < x1; x++) {
      const i = (y * A.w + x) * 4, j = (y * B.w + x) * 4;
      const d = Math.max(Math.abs(A.data[i] - B.data[j]), Math.abs(A.data[i + 1] - B.data[j + 1]), Math.abs(A.data[i + 2] - B.data[j + 2]));
      if (d > max) max = d;
      sum += d; rs += d; n++; rn++;
      if (d > 8) o8++; if (d > 16) o16++; if (d > 24) o24++;
    }
    if ((y - y0) % 20 === 0) rows.push(`y${y - y0}:${(rs / Math.max(1, rn)).toFixed(1)}`);
  }
  return { max, mean: n ? +(sum / n).toFixed(2) : 0, over8: o8, over16: o16, over24: o24, n, rows, box: [x0, y0, x1, y1] };
}

/* ══════════ 전제 (⑴) — 꾸밈이 ★캔버스에 ★정말 있나 ══════════ */
test('P1 전제 — 반사·형광펜이 ★라이브 DOM 에 실재한다(없는 것을 「썸네일에도 없다」로 재면 항등식)', async ({ page }) => {
  const errs = await setup(page);
  const hlOn = await turnOnHighlight(page, 'pT');
  expect(hlOn, '★형광펜 span.tb-hl 이 생겼다(사람 순서: 블럭 고르기 → H 단추)').toBe(true);
  const wOn = await turnOnHighlight(page, 'pW');
  expect(wOn, '★줄바꿈 블럭에도 획이 생겼다').toBe(true);
  const lines = await page.evaluate(() => document.getElementById('pW').querySelector('span.tb-hl').getClientRects().length);
  expect(lines, `★줄바꿈 블럭의 획이 ★여러 줄이다(getClientRects=${lines}) — 1 이면 box-decoration-break 축을 ★안 재고 있다`).toBeGreaterThan(1);
  const refl = await page.evaluate(() => { window.setFxReflect(document.getElementById('pA'), { state: 'on', gap: 4, len: 55, op: 60 });
    return document.getElementById('pA').style.webkitBoxReflect || ''; });
  expect(refl, '★반사 인라인 -webkit-box-reflect').toContain('below');
  /* 그리고 ★그 꾸밈이 ★픽셀로 보인다 — 계산 스타일만 보면 안 그려져도 초록이다 */
  const A = await canvasPixels(page);
  const sp = await reflectSpan(page, 'pA');
  const rb = await belowBand(page, 'pA', sp.gap + 2, sp.gap + sp.visH * 0.5);   // 에셋 ★바로 아래(요소 자신은 ★뺀다)
  const hb = await bandOf(page, 'pT');
  const rs = bandStats(A, A, rb), hs = colorCount(A, A, hb, HL_RGB, 26);
  console.log(`[P1] 캔버스 — 반사띠 ${JSON.stringify(rs.box)} 평균 rgb=${rs.a} · 형광펜 노랑 픽셀 ${hs.a}/${hs.n}`);
  /* ★반사는 흰 바닥 위 주황 틴트다 — R−B 로 센다(흰색이면 0) */
  expect(rs.a[0] - rs.a[2], `★캔버스에 반사가 ★안 보인다(흰색이면 R−B=0) rgb=${rs.a} · 띠=${JSON.stringify(rs.box)}`).toBeGreaterThan(20);
  /* ★형광펜은 ★평균으로 재면 ★흰 여백에 묻힌다 — 실측: 평균 234,231,204 로 문턱 미달(2026-10-09 1차) ⇒ ★색 픽셀 수로 */
  expect(hs.a, `★캔버스에 형광펜 노랑(#ffeb3b)이 ★0 픽셀이다 — 띠=${JSON.stringify(hs.box)}`).toBeGreaterThan(500);
  expect(errs).toEqual([]);
});

/* ══════════ 본 단언 (⑶ 음성대조 포함) ══════════ */
test('C2-a ★반사 — 썸네일이 캔버스와 ★같다(반사 띠)', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => window.setFxReflect(document.getElementById('pA'), { state: 'on', gap: 4, len: 55, op: 60 }));
  await waitStableRect(page, '#pS');            /* 반사 여백이 섹션 높이를 민다 — ★멈춘 뒤에 찍는다 */
  const A = await canvasPixels(page);
  const B = await thumbPixels(page);
  test.skip(B === null, '[전제] 하네스에서 저장이 썸네일을 안 찍었다 — 장면이 안 섬 = SKIP');
  const sp = await reflectSpan(page, 'pA');
  const band = await belowBand(page, 'pA', sp.gap + 2, sp.gap + sp.visH * 0.5);
  const s = bandStats(A, B, band);
  console.log(`[C2-a] 반사띠(정본 gap=${sp.gap} visH=${sp.visH.toFixed(1)} op=${sp.op}) ${JSON.stringify(s.box)} — 다른 점 ${s.diff}/${s.n}(${(s.ratio * 100).toFixed(1)}%) · 캔버스 rgb=${s.a} · 썸네일 rgb=${s.b}`);
  expect(s.ratio, `★반사가 썸네일에서 빠졌다 — 캔버스 rgb=${s.a} / 썸네일 rgb=${s.b} (다른 점 ${s.diff}/${s.n})`).toBeLessThan(0.1);
  expect(errs).toEqual([]);
});

/* ══ C2-c ★남은 차이에 ★«수»를 붙인다 — 명부 REFLECT-MIRROR-ALPHA (머리말 ⒜~⒡) ══
   ★까닭 — C2-a 의 「다른 점 0」은 ★«24 안»이라는 뜻이라 ★«더 진해지는 것»을 ★못 본다.
     ⇒ ★★최대 델타를 ★따로 잠근다. ★나빠지면 ★여기가 ★빨개진다.
   ⛔상한을 ★「넉넉히」 두지 마라 — ★그러면 ★아무것도 안 잠근다.
     ★★상한 = ★«지금 판에서 ★잰 값» ＋ ★작은 여유. ★실측값은 ★단언 메시지에 ★찍는다. */
test('C2-c ★남은 차이의 ★수 — 최대 채널 델타(명부 REFLECT-MIRROR-ALPHA)', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => window.setFxReflect(document.getElementById('pA'), { state: 'on', gap: 4, len: 55, op: 60 }));
  await waitStableRect(page, '#pS');
  const A = await canvasPixels(page);
  const B = await thumbPixels(page);
  test.skip(B === null, '[전제] 썸네일 미캡처 = SKIP');
  const sp = await reflectSpan(page, 'pA');
  /* ★보이는 반사 ★전 구간 — ⛔C2-a 처럼 ★진한 절반만 보지 않는다(★옅은 쪽이 프로파일을 말해 준다) */
  const band = await belowBand(page, 'pA', sp.gap + 1, sp.gap + sp.visH);
  /* ★전제 — 그 띠에 ★반사가 ★있나(없으면 델타 0 이 ★항등식이 된다) */
  const tA = tintCount(A, band), tB = tintCount(B, band);
  console.log(`[C2-c] ★전제 — 캔버스 띠 주황 ${tA} · 썸네일 띠 주황 ${tB}`);
  expect(tA, `★전제 — 캔버스 띠에 반사 틴트가 없다(${JSON.stringify(band)}) ⇒ 델타 0 이 항등식이 된다`).toBeGreaterThan(1000);
  const d = deltaProfile(A, B, band);
  console.log(`[C2-c] 띠 ${JSON.stringify(d.box)} ${d.n}px — ★최대 ${d.max} · 평균 ${d.mean} · >24 ${d.over24} · >16 ${d.over16} · >8 ${d.over8}`);
  console.log(`[C2-c] 줄별(페이드): ${d.rows.join(' | ')}`);
  /* ★★상한 = ★«이 하네스에서 ★잰 값»(최대 ★2) ＋ 여유 4 = ★6.
     ⛔★실앱 수 20 을 ★상한으로 쓰지 마라 — ★이 장면에서 ★20 이면 ★10배 나빠진 것인데 ★통과한다
       (★한 번 그렇게 적었다: 26 ⇒ ★여기선 ★아무것도 ★안 잠갔다).
     ★올리는 것은 ⛔기준선을 ★조용히 낮추는 것이다. ★내리는 것은 ★좋다 — 그때 머리말 ⒝ 도 같이 고쳐라. */
  expect(d.max, `★최대 델타 ${d.max} (평균 ${d.mean} · >24 ${d.over24}) — 이 하네스 명부값 ★2 보다 나빠졌다`).toBeLessThanOrEqual(6);
  expect(d.over24, `★tol 24 를 넘는 픽셀 ${d.over24}건 — C2-a 가 빨개질 자리다`).toBe(0);
  expect(errs).toEqual([]);
});

test('C2-b ★음성대조 — 반사를 ★끄면 같은 띠에서 썸네일 == 캔버스', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => window.setFxReflect(document.getElementById('pA'), { state: 'off' }));
  await waitStableRect(page, '#pS');
  const A = await canvasPixels(page);
  const B = await thumbPixels(page);
  test.skip(B === null, '[전제] 썸네일 미캡처 = SKIP');
  const band = await belowBand(page, 'pA', 6, 40);
  const s = bandStats(A, B, band);
  console.log(`[C2-b] 끈 판 반사띠 — 다른 점 ${s.diff}/${s.n}(${(s.ratio * 100).toFixed(1)}%) · 캔버스 rgb=${s.a} · 썸네일 rgb=${s.b}`);
  expect(s.ratio, `★끈 판에서도 다르다 — 그러면 이 자는 반사를 재는 자가 아니다 (캔버스 ${s.a} / 썸네일 ${s.b})`).toBeLessThan(0.1);
  expect(errs).toEqual([]);
});

test('C3-a ★형광펜 — 썸네일이 캔버스와 ★같다(획 띠 ＋ ★그 아래 블럭)', async ({ page }) => {
  const errs = await setup(page);
  const hlOn = await turnOnHighlight(page, 'pT');
  test.skip(!hlOn, '[전제] 형광펜이 안 켜졌다 = SKIP');
  const wOn = await turnOnHighlight(page, 'pW');
  test.skip(!wOn, '[전제] 줄바꿈 블럭 형광펜이 안 켜졌다 = SKIP');
  const A = await canvasPixels(page);
  const B = await thumbPixels(page);
  test.skip(B === null, '[전제] 썸네일 미캡처 = SKIP');
  const hb = await bandOf(page, 'pT');
  const wb = await bandOf(page, 'pW');
  const ub = await bandOf(page, 'pB');
  const hc = colorCount(A, B, hb, HL_RGB, 26), wc = colorCount(A, B, wb, HL_RGB, 26), uc = colorCount(A, B, ub, HL_RGB, 26);
  const hs = bandStats(A, B, hb), ws = bandStats(A, B, wb), us = bandStats(A, B, ub);
  console.log(`[C3-a] 한줄   — 노랑 캔버스 ${hc.a} / 썸네일 ${hc.b} · 다른 점 ${(hs.ratio * 100).toFixed(1)}% · 띠 ${JSON.stringify(hc.box)}`);
  console.log(`[C3-a] 줄바꿈 — 노랑 캔버스 ${wc.a} / 썸네일 ${wc.b} · 다른 점 ${(ws.ratio * 100).toFixed(1)}% · 띠 ${JSON.stringify(wc.box)}`);
  console.log(`[C3-a] 아래   — 노랑 캔버스 ${uc.a} / 썸네일 ${uc.b} · 다른 점 ${(us.ratio * 100).toFixed(1)}% · 띠 ${JSON.stringify(uc.box)}`);
  /* ⑴ ★획이 ★있나 — 썸네일 노랑 수가 캔버스의 ±25% 안 (⛔「0 이 아니다」로 닫지 마라: ★넘쳐도 다른 그림이다) */
  const near = (a, b) => a > 0 && b >= a * 0.75 && b <= a * 1.25;
  expect(near(hc.a, hc.b), `★한 줄 획 노랑 수가 다르다 — 캔버스 ${hc.a} / 썸네일 ${hc.b}`).toBe(true);
  expect(near(wc.a, wc.b), `★줄바꿈 획 노랑 수가 다르다(box-decoration-break 를 h2c 가 모른다) — 캔버스 ${wc.a} / 썸네일 ${wc.b}`).toBe(true);
  /* ⑵ ★아래를 ★덮나 — 아래 블럭 띠에 노랑이 ★캔버스엔 없고 ★썸네일엔 있으면 그게 ★「밑을 덮는다」다 */
  expect(uc.b, `★획이 ★아래 블럭을 덮는다 — 아래 띠 노랑: 캔버스 ${uc.a} / 썸네일 ${uc.b}`).toBeLessThanOrEqual(uc.a + Math.max(50, uc.n * 0.01));
  expect(errs).toEqual([]);
});

test('C3-b ★음성대조 — 형광펜을 ★안 켠 판에서 같은 두 띠가 썸네일 == 캔버스', async ({ page }) => {
  const errs = await setup(page);
  const A = await canvasPixels(page);
  const B = await thumbPixels(page);
  test.skip(B === null, '[전제] 썸네일 미캡처 = SKIP');
  const hb = await bandOf(page, 'pT');
  const wb = await bandOf(page, 'pW');
  const ub = await bandOf(page, 'pB');
  const hc = colorCount(A, B, hb, HL_RGB, 26), wc = colorCount(A, B, wb, HL_RGB, 26), uc = colorCount(A, B, ub, HL_RGB, 26);
  const hs = bandStats(A, B, hb), ws = bandStats(A, B, wb), us = bandStats(A, B, ub);
  console.log(`[C3-b] 안 켠 판 — 노랑 한줄 ${hc.a}/${hc.b} · 줄바꿈 ${wc.a}/${wc.b} · 아래 ${uc.a}/${uc.b} (캔버스/썸네일)`);
  console.log(`[C3-b] 안 켠 판 — 다른 점 한줄 ${(hs.ratio * 100).toFixed(1)}% · 줄바꿈 ${(ws.ratio * 100).toFixed(1)}% · 아래 ${(us.ratio * 100).toFixed(1)}%`);
  /* ★안 켠 판엔 노랑이 ★양쪽 다 ★없어야 한다 — 있으면 내 색 자가 ★딴것을 세고 있다 */
  expect(hc.a + hc.b + wc.a + wc.b, `★안 켠 판에 노랑이 보인다 — 색 자가 딴것을 센다(한줄 ${hc.a}/${hc.b} 줄바꿈 ${wc.a}/${wc.b})`).toBeLessThan(200);
  expect(hs.ratio, `★안 켠 판에서도 획띠가 다르다 — 이 자는 형광펜을 재는 자가 아니다`).toBeLessThan(0.1);
  expect(ws.ratio, `★안 켠 판에서도 줄바꿈띠가 다르다`).toBeLessThan(0.1);
  expect(us.ratio, `★안 켠 판에서도 아래띠가 다르다`).toBeLessThan(0.1);
  expect(errs).toEqual([]);
});

/* ══════════ ① 「매 저장마다 돈다」 — ★수로 재는 자 ══════════ */
test('C1 ★썸네일을 ★몇 번 찍나 — 저장 N 번에 html2canvas 호출 수', async ({ page }) => {
  const errs = await setup(page);
  const n = await page.evaluate(async () => {
    const orig = window.html2canvas; let hits = 0;
    window.html2canvas = async (el, opt) => { hits++; return await orig(el, opt); };
    const snap = window.serializeProject();
    /* ⑴ ★projectId 를 주고(=썸네일 길이 열린 저장) 3회 ⑵ ★skipThumbnail 로 3회 — ★둘을 갈라 센다 */
    try { for (let i = 0; i < 3; i++) await window.saveProjectToFile?.(snap, { projectId: 'p_parity' }); } finally { window.html2canvas = orig; }
    let skipHits = 0;
    window.html2canvas = async (el, opt) => { skipHits++; return await orig(el, opt); };
    try { for (let i = 0; i < 3; i++) await window.saveProjectToFile?.(snap, { projectId: 'p_parity', skipThumbnail: true }); } finally { window.html2canvas = orig; }
    return { hits, skipHits };
  });
  console.log(`[C1] 저장 3회(썸네일 길 열림) → html2canvas ★${n.hits}회 · 저장 3회(skipThumbnail:true) → ★${n.skipHits}회 (자: window.html2canvas 호출 수)`);
  expect(n.hits, '★썸네일 길이 열린 저장은 ★매번 찍는다(=①이 말한 그 동작) — 0 이면 이 자가 아무것도 안 재고 있다').toBe(3);
  expect(n.skipHits, '★skipThumbnail:true 면 ★한 번도 안 찍는다 — ★앱의 7 호출자 중 6 이 이 길이다').toBe(0);
  expect(errs).toEqual([]);
});
