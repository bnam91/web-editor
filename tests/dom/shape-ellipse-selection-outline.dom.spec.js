/* shape-ellipse-selection-outline.dom.spec.js — 0920b circle-clip (T-072)
 *
 * 현빈 원문: 「원모양 쉐이프 블럭 추가했는데, 파란색 아웃라인에 원이 잘려보이는 문제가 있다.」
 * 현빈 결정(2026-09-20) ㉮: 선택선은 «모든 블럭 네모» 유지. 고칠 것은 «선이 원을 물지 않게» 하는 것뿐.
 *
 * 여기서 재는 것 = «진짜 브라우저에서 실제로 그려진 path 의 d». 단위검사(U-CIRCLE-*)는 산술만 보고,
 * 그 산술이 «실제 DOM 에서 그 경로로 불리는가»(옵트인 판정이 라이브 DOM 에서 참인가)는 못 본다.
 *   C1 원 + 그 래퍼 = 네모 두 벌(L 4 · A 0)인데 네 띠가 «전부 상자 밖»이다 → 원을 한 점도 안 덮는다.
 *   C2 [음성대조] 같은 자리의 «사각» 도형은 종전 그대로 띠가 상자 «안»이다(사정거리 밖).
 *   C3 네 귀가 맞물린다 — 가로 구간이 바깥 꼭지까지 이어져 모서리에 구멍이 없다.
 *   C4 CSS 폴백(오버레이가 죽었을 때의 화가)도 같은 자리 — 원만 outline-offset 0.
 *
 * ⛔앱을 «안» 띄운다 — modal-resize.dom.spec.js 의 route-fulfill 부트를 그대로 쓴다.
 * ⛔모달 상태를 안 만든다 — 같은 층(#ss-handles-overlay)을 손대는 유닛 zorder 와 충돌하지 않게.
 * 실행: npm run test:dom -- shape-ellipse-selection-outline
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

/* 현빈 실사용 줌 40% — 낮은 줌에서 먼저 재라(traps.md).
   오버레이는 #canvas-scaler «밖»이라 이 scale 이 선에 안 곱해진다(그게 이 증상의 무대다). */
const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-blocks.css"></head><body style="margin:0">
<div id="canvas-scaler" style="transform: scale(0.4); transform-origin: 0 0;">
  <div id="canvas" style="width:860px">
    <div class="section-block"><div class="section-inner" id="host" style="width:860px;position:relative"></div></div>
  </div>
</div>
<div id="ss-handles-overlay"></div>
<script src="/js/feature-flags.js"></script>
<script type="module">
  import '/js/selection-overlay.js';
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
  // 오버레이 초기화가 «성공»했는지부터 — 실패하면 body.sel-ov 가 안 붙고 화가가 CSS outline 이다.
  await page.waitForFunction(() => document.body.classList.contains('sel-ov'));
  return errs;
}

/** 실제 addShapeBlock 과 같은 모양: 자유배치 래퍼 프레임 + 그 안의 shape-block.
 *  선택도 실제 selectShapeBlock 과 같게 «둘 다»에 .selected 를 준다(js/block-drag.js:2506). */
async function mountAndSelect(page, shapeType) {
  await page.evaluate((shapeType) => {
    const host = document.getElementById('host');
    host.innerHTML = '';
    const ss = document.createElement('div');
    ss.className = 'frame-block';
    ss.dataset.freeLayout = 'true';
    ss.setAttribute('style', 'width:100px;height:100px;min-height:100px;margin:0 auto;position:relative;');
    const sb = document.createElement('div');
    sb.className = 'shape-block';
    sb.dataset.type = 'shape';
    sb.dataset.shapeType = shapeType;
    sb.innerHTML = shapeType === 'ellipse'
      ? '<svg class="shape-svg" viewBox="0 0 100 100" preserveAspectRatio="none"><ellipse cx="50" cy="50" rx="50" ry="50"></ellipse></svg>'
      : '<svg class="shape-svg" viewBox="0 0 100 100" preserveAspectRatio="none"><rect x="0" y="0" width="100" height="100"></rect></svg>';
    ss.appendChild(sb);
    host.appendChild(ss);
    ss.classList.add('selected');
    sb.classList.add('selected');
    window.__ss = ss; window.__sb = sb;
  }, shapeType);
  // rAF 두 번 — MutationObserver 가 _dirty 를 세우고 다음 프레임이 그린다.
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}

/** 그려진 path 하나를 «네 변 + 상자»로 환산한다(축정렬 전제 — 회전은 이 스펙 밖). */
const measure = (page) => page.evaluate(() => {
  const out = [];
  for (const p of document.querySelectorAll('#ss-handles-overlay .ss-sel-layer path')) {
    const d = p.getAttribute('d');
    const segs = [...d.matchAll(/M([-\d.]+) ([-\d.]+)L([-\d.]+) ([-\d.]+)/g)].map(m => m.slice(1).map(Number));
    const ys = segs.filter(s => Math.abs(s[1] - s[3]) < 0.01).map(s => s[1]).sort((a, b) => a - b);
    const xs = segs.filter(s => Math.abs(s[0] - s[2]) < 0.01).map(s => s[0]).sort((a, b) => a - b);
    const hseg = segs.filter(s => Math.abs(s[1] - s[3]) < 0.01);
    out.push({ cls: p.getAttribute('class'), d, T: ys[0], B: ys[ys.length - 1], L: xs[0], R: xs[xs.length - 1],
               hspan: hseg.length ? [Math.min(...hseg.map(s => s[0])), Math.max(...hseg.map(s => s[2]))] : null,
               arcs: (d.match(/A/g) || []).length, lines: (d.match(/L/g) || []).length });
  }
  const r = window.__sb.getBoundingClientRect();
  const rf = window.__ss.getBoundingClientRect();
  return { paths: out, box: { l: r.left, t: r.top, r: r.right, b: r.bottom },
           frameBox: { l: rf.left, t: rf.top, r: rf.right, b: rf.bottom },
           sw: parseFloat(getComputedStyle(document.querySelector('.ss-sel-path')).strokeWidth) || 1,
           dpr: window.devicePixelRatio };
});

test('C1 ★원은 «네모» 그대로인데 띠가 전부 상자 밖 — 원을 한 점도 안 덮는다', async ({ page }) => {
  const errs = await boot(page);
  await mountAndSelect(page, 'ellipse');
  const m = await measure(page);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
  /* 둘이다 — 래퍼 .frame-block 과 .shape-block 이 «같은 상자»로 각각 그린다(라이브 실측과 같은 모양). */
  expect(m.paths.length, `선택 경로가 2개가 아니다: ${JSON.stringify(m.paths)}`).toBe(2);
  const h = m.sw / 2, lim = m.sw + 1 / m.dpr + 1e-6;
  for (const p of m.paths) {
    // ★㉮ — 모양은 «네모»다
    expect(p.arcs, `호가 생겼다 — 「모든 블럭 네모」 결정 위반: ${p.d}`).toBe(0);
    expect(p.lines, `네모는 변 4줄이어야 한다: ${p.d}`).toBe(4);
    // ★증상 — 띠의 «안쪽 끝»이 상자 변을 넘지 않는다(넘으면 그만큼 원이 잘려 보인다)
    expect(p.T + h, `윗선이 상자 안으로 ${(p.T + h) - m.box.t}px 파고들었다`).toBeLessThanOrEqual(m.box.t + 1e-6);
    expect(p.B - h, `아랫선이 상자 안으로 파고들었다`).toBeGreaterThanOrEqual(m.box.b - 1e-6);
    expect(p.L + h, `왼선이 상자 안으로 파고들었다`).toBeLessThanOrEqual(m.box.l + 1e-6);
    expect(p.R - h, `오른선이 상자 안으로 파고들었다`).toBeGreaterThanOrEqual(m.box.r - 1e-6);
    // ★대가의 상한 — 밖으로 나간 몫은 굵기+1/dpr 을 안 넘는다(줌에 비례해 번지는 M63 과 다른 성질)
    expect(m.box.t - (p.T - h), '윗선이 상한보다 멀리 나갔다').toBeLessThanOrEqual(lim);
    expect((p.B + h) - m.box.b, '아랫선이 상한보다 멀리 나갔다').toBeLessThanOrEqual(lim);
  }
  expect(m.paths[0].d, '래퍼와 도형의 경로가 어긋났다 — 두 네모가 겹쳐 보인다').toBe(m.paths[1].d);
  expect(Math.abs(m.box.l - m.frameBox.l) < 0.01 && Math.abs(m.box.t - m.frameBox.t) < 0.01,
    '래퍼와 도형의 상자가 달라졌다 — 이 유닛의 전제(같은 네모 두 벌)가 바뀌었다').toBe(true);
});

test('C2 ★[음성대조] 사각 도형은 종전 그대로 — 띠가 상자 «안»이다(사정거리 밖)', async ({ page }) => {
  const errs = await boot(page);
  await mountAndSelect(page, 'rectangle');
  const m = await measure(page);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
  expect(m.paths.length).toBe(2);
  const h = m.sw / 2;
  for (const p of m.paths) {
    expect(p.arcs, `사각 도형에 호가 생겼다: ${p.d}`).toBe(0);
    expect(p.lines).toBe(4);
    expect(p.T - h, `사각 도형의 윗선까지 상자 밖으로 나갔다 — 원만 고치기로 한 범위를 넘었다`)
      .toBeGreaterThanOrEqual(m.box.t - 1e-6);
    expect(p.B + h, '사각 도형의 아랫선이 상자 밖').toBeLessThanOrEqual(m.box.b + 1e-6);
    expect(p.L - h, '사각 도형의 왼선이 상자 밖').toBeGreaterThanOrEqual(m.box.l - 1e-6);
    expect(p.R + h, '사각 도형의 오른선이 상자 밖').toBeLessThanOrEqual(m.box.r + 1e-6);
  }
});

test('C3 ★네 귀가 맞물린다 — 가로 구간이 바깥 꼭지까지 이어져 모서리에 구멍이 없다', async ({ page }) => {
  await boot(page);
  await mountAndSelect(page, 'ellipse');
  const m = await measure(page);
  const h = m.sw / 2, p = m.paths[0];
  expect(p.hspan[0]).toBeCloseTo(p.L - h, 6);
  expect(p.hspan[1]).toBeCloseTo(p.R + h, 6);
});

test('C4 ★CSS 폴백도 같은 자리 — 원만 outline-offset 0, 사각은 종전(−굵기)', async ({ page }) => {
  await boot(page);
  await mountAndSelect(page, 'ellipse');
  const ell = await page.evaluate(() => getComputedStyle(window.__sb).outlineOffset);
  await mountAndSelect(page, 'rectangle');
  const rect = await page.evaluate(() => getComputedStyle(window.__sb).outlineOffset);
  expect(parseFloat(ell), `원의 폴백 오프셋이 0 이 아니다(${ell}) — 오버레이가 죽은 판에서 원이 다시 잘린다`).toBe(0);
  expect(parseFloat(rect), `사각의 폴백까지 바뀌었다(${rect}) — 사정거리 밖`).toBeLessThan(0);
});

/* ★C5 — 이벨류에이터가 「못 봤다」고 남긴 자리(원 + 맞닿은 이웃 동시선택).
 *   바깥 선은 이웃의 «상자 안» 선과 1~2px 떨어져 있는데, dedupe 는 «상자 변»이 맞닿았다고 보고
 *   이웃 변을 통째로 지울 수 있다 → 이웃 선이 사라지고 그 자리가 비어 보인다.
 *   ⇒ 옵트인 상자는 dedupe 에 참여시키지 않는다(_build 의 dedupable). 이 검사가 그걸 잠근다. */
async function mountPair(page) {
  await page.evaluate(() => {
    const host = document.getElementById('host');
    host.innerHTML = '';
    const mk = (type) => {
      const ss = document.createElement('div');
      ss.className = 'frame-block';
      ss.setAttribute('style', 'width:100px;height:100px;min-height:100px;margin:0 auto;position:relative;');
      const sb = document.createElement('div');
      sb.className = 'shape-block';
      sb.dataset.type = 'shape'; sb.dataset.shapeType = type;
      sb.innerHTML = '<svg class="shape-svg" viewBox="0 0 100 100" preserveAspectRatio="none"></svg>';
      ss.appendChild(sb); host.appendChild(ss);
      ss.classList.add('selected'); sb.classList.add('selected');
      return { ss, sb };
    };
    window.__a = mk('ellipse');     // 위
    window.__b = mk('rectangle');   // 아래 — 맞닿는다(margin 0)
  });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}

test('C5 ★원 + 맞닿은 이웃 동시선택 — 이웃의 윗변이 «지워지지» 않는다', async ({ page }) => {
  const errs = await boot(page);
  await mountPair(page);
  const got = await page.evaluate(() => {
    const ra = window.__a.sb.getBoundingClientRect(), rb = window.__b.sb.getBoundingClientRect();
    const ds = [...document.querySelectorAll('#ss-handles-overlay .ss-sel-layer path')].map(p => p.getAttribute('d'));
    const segs = d => [...d.matchAll(/M([-\d.]+) ([-\d.]+)L([-\d.]+) ([-\d.]+)/g)].map(m => m.slice(1).map(Number));
    return { gap: rb.top - ra.bottom, aBox: [ra.top, ra.bottom], bBox: [rb.top, rb.bottom], ds, segs: ds.map(segs) };
  });
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
  expect(Math.abs(got.gap), `두 블럭이 안 맞닿았다(gap ${got.gap}) — 이 검사의 전제가 깨졌다`).toBeLessThan(0.01);
  expect(got.ds.length, `경로가 4개(각 블럭 × 래퍼+도형)가 아니다: ${got.ds.length}`).toBe(4);
  // 네 경로 모두 «변 4줄»을 온전히 갖는다 — 하나라도 3줄이면 dedupe 가 변을 지운 것이다
  for (const s of got.segs) {
    const horiz = s.filter(x => Math.abs(x[1] - x[3]) < 0.01).length;
    const vert  = s.filter(x => Math.abs(x[0] - x[2]) < 0.01).length;
    expect(horiz, `가로변이 2줄이 아니다 — 맞닿은 변이 지워졌다: ${JSON.stringify(s)}`).toBe(2);
    expect(vert, `세로변이 2줄이 아니다: ${JSON.stringify(s)}`).toBe(2);
  }
});
