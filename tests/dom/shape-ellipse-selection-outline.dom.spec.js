/* shape-ellipse-selection-outline.dom.spec.js — 원 도형의 선택 표시 (T-072 → 2026-09-21 현빈 지시 8)
 *
 * 현빈 원문(2026-09-20): 「원모양 쉐이프 블럭 추가했는데, 파란색 아웃라인에 원이 잘려보이는 문제가 있다.」
 * 현빈 지시(2026-09-21): 「icb_k7kbb_msmevtj(아이콘 서클)는 문제없지 않니? 같은 원모양인데
 *                         아웃라인 이것처럼 하면 될 것 같은데」
 *
 * ★답이 바뀌었다 — 「선을 상자 밖으로」(옛) → 「선은 그대로 안에 두고 «원 둘레를 링으로 두른다»」(새).
 *   아이콘 서클이 몇 달째 쓰는 길이고, 현빈이 «문제없다»고 한 그 모양이다.
 *   그래서 이 스펙의 판정 기준도 바뀌었다:
 *     옛 기준 「띠가 전부 상자 밖」  →  새 기준 「띠는 상자 안(다른 블럭과 같다) + 둘레가 링으로 둘린다」
 *   ★새 기준이 더 세다 — 옛 기준은 «네 접점을 안 덮는가»만 봤고, 원의 나머지 둘레에는 선이 «아예 없었다».
 *     새 기준은 둘레 360° 를 표본해 «전 둘레가 둘렸는가»를 픽셀로 세고, 그 수치를 «같은 줌의»
 *     아이콘 서클과 나란히 놓는다(C6 — 양성대조 내장. 「아이콘 서클처럼」이 지시의 문언이다).
 *     C7 은 그 반대편 — 링을 끄면 수치가 무너지는지(이 검사가 정말 링을 재고 있는지)를 본다.
 *
 * ⛔앱을 «안» 띄운다 — modal-resize.dom.spec.js 의 route-fulfill 부트를 그대로 쓴다.
 * 실행: npm run test:dom -- shape-ellipse-selection-outline
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

/* 현빈 실사용 줌 40% 가 기본 — 낮은 줌에서 먼저 재라(traps.md).
   오버레이(SVG 선)는 #canvas-scaler «밖»이라 이 scale 이 선 굵기에 안 곱해지고,
   CSS 링은 «안»이라 곱해진다 — 그래서 --sel-outline-w 가 calc(1px * var(--inv-zoom)) 이다.
   두 선이 같은 굵기로 만나는지는 줌을 바꿔 가며 봐야 한다(C6 이 세 줌에서 잰다). */
const HARNESS = (scale = 0.4) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-blocks.css"></head><body style="margin:0;background:#fff">
<div id="canvas-scaler" style="transform: scale(${scale}); transform-origin: 0 0; --inv-zoom: ${1 / scale};">
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

async function boot(page, scale = 0.4) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS(scale) });
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
 *  선택도 실제 selectShapeBlock 과 같게 «둘 다»에 .selected 를 준다(js/block-drag.js). */
async function mountAndSelect(page, shapeType, size = 100) {
  await page.evaluate(({ shapeType, size }) => {
    const host = document.getElementById('host');
    host.innerHTML = '';
    const ss = document.createElement('div');
    ss.className = 'frame-block';
    ss.dataset.freeLayout = 'true';
    ss.setAttribute('style', `width:${size}px;height:${size}px;min-height:${size}px;margin:0 auto;position:relative;`);
    const sb = document.createElement('div');
    sb.className = 'shape-block';
    sb.dataset.type = 'shape';
    sb.dataset.shapeType = shapeType;
    sb.innerHTML = shapeType === 'ellipse'
      ? '<svg class="shape-svg" viewBox="0 0 100 100" preserveAspectRatio="none"><ellipse cx="50" cy="50" rx="50" ry="50" fill="#cccccc"></ellipse></svg>'
      : '<svg class="shape-svg" viewBox="0 0 100 100" preserveAspectRatio="none"><rect x="0" y="0" width="100" height="100" fill="#cccccc"></rect></svg>';
    ss.appendChild(sb);
    host.appendChild(ss);
    ss.classList.add('selected');
    sb.classList.add('selected');
    window.__ss = ss; window.__sb = sb;
  }, { shapeType, size });
  // rAF 두 번 — MutationObserver 가 _dirty 를 세우고 다음 프레임이 그린다.
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}

/** 아이콘 서클 — «양성대조»다. 현빈이 문제없다고 한 바로 그 블럭을 같은 잣대로 잰다. */
async function mountIconCircle(page, size = 100) {
  await page.evaluate((size) => {
    const host = document.getElementById('host');
    host.innerHTML = '';
    const b = document.createElement('div');
    b.className = 'icon-circle-block selected';
    b.setAttribute('style', 'margin:0 auto;');
    const c = document.createElement('div');
    c.className = 'icb-circle';
    c.setAttribute('style', `width:${size}px;height:${size}px;background:#cccccc;background-image:none;`);
    b.appendChild(c);
    host.appendChild(b);
    window.__sb = b; window.__ss = b;
  }, size);
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
  const cs = getComputedStyle(window.__sb, '::before');
  return { paths: out, box: { l: r.left, t: r.top, r: r.right, b: r.bottom },
           frameBox: { l: rf.left, t: rf.top, r: rf.right, b: rf.bottom },
           ring: { content: cs.content, radius: cs.borderTopLeftRadius, color: cs.borderTopColor, w: cs.borderTopWidth },
           sw: parseFloat(getComputedStyle(document.querySelector('.ss-sel-path')).strokeWidth) || 1,
           dpr: window.devicePixelRatio };
});

test('C1 ★원의 선은 다른 블럭과 «같은 자리»(상자 안)로 돌아왔고, 둘레는 링이 두른다', async ({ page }) => {
  const errs = await boot(page);
  await mountAndSelect(page, 'ellipse');
  const m = await measure(page);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
  /* 둘이다 — 래퍼 .frame-block 과 .shape-block 이 «같은 상자»로 각각 그린다(라이브 실측과 같은 모양). */
  expect(m.paths.length, `선택 경로가 2개가 아니다: ${JSON.stringify(m.paths)}`).toBe(2);
  const h = m.sw / 2;
  for (const p of m.paths) {
    // ★㉮·T-028 — 모양은 «네모»다
    expect(p.arcs, `호가 생겼다 — 「모든 블럭 네모」 결정 위반: ${p.d}`).toBe(0);
    expect(p.lines, `네모는 변 4줄이어야 한다: ${p.d}`).toBe(4);
    // ★새 규약 — 네 띠가 «상자 안». 밖으로 나가면 맞닿은 이웃 상자를 칠한다(§4-3)
    expect(p.T - h, `윗선이 상자 밖으로 나갔다`).toBeGreaterThanOrEqual(m.box.t - 1e-6);
    expect(p.B + h, `아랫선이 상자 밖으로 나갔다`).toBeLessThanOrEqual(m.box.b + 1e-6);
    expect(p.L - h, `왼선이 상자 밖으로 나갔다`).toBeGreaterThanOrEqual(m.box.l - 1e-6);
    expect(p.R + h, `오른선이 상자 밖으로 나갔다`).toBeLessThanOrEqual(m.box.r + 1e-6);
  }
  expect(m.paths[0].d, '래퍼와 도형의 경로가 어긋났다 — 두 네모가 겹쳐 보인다').toBe(m.paths[1].d);
  // ★링 — 이게 «잘려 보임»을 푸는 자리다
  expect(m.ring.content, '원 도형에 ::before 링이 없다 — 아이콘 서클과 같은 길로 안 갔다').not.toBe('none');
  expect(m.ring.radius, `링이 원이 아니다(${m.ring.radius})`).toMatch(/50%|\d/);
  expect(m.ring.color, `링 색이 선택색이 아니다: ${m.ring.color}`).toBe('rgb(45, 111, 232)');
});

test('C2 ★[음성대조] 사각 도형은 링이 «없고» 띠도 종전 그대로 상자 안이다(사정거리 밖)', async ({ page }) => {
  const errs = await boot(page);
  await mountAndSelect(page, 'rectangle');
  const m = await measure(page);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
  expect(m.paths.length).toBe(2);
  expect(m.ring.content, '사각 도형에도 원 링이 생겼다 — T-028 「선택선 네모 통일」 위반').toBe('none');
  const h = m.sw / 2;
  for (const p of m.paths) {
    expect(p.arcs, `사각 도형에 호가 생겼다: ${p.d}`).toBe(0);
    expect(p.lines).toBe(4);
    expect(p.T - h).toBeGreaterThanOrEqual(m.box.t - 1e-6);
    expect(p.B + h).toBeLessThanOrEqual(m.box.b + 1e-6);
    expect(p.L - h).toBeGreaterThanOrEqual(m.box.l - 1e-6);
    expect(p.R + h).toBeLessThanOrEqual(m.box.r + 1e-6);
  }
});

test('C3 ★네 귀가 맞물린다 — 가로 구간이 «중심이 상자 안인 마지막 행»까지 이어져 구멍이 없다', async ({ page }) => {
  await boot(page);
  await mountAndSelect(page, 'ellipse');
  const m = await measure(page);
  const p = m.paths[0];
  // 안쪽 스냅 판의 연장 규칙 = _rowEdge(생 변) — 상자 변을 «넘지 않는다»
  expect(p.hspan[0]).toBeGreaterThanOrEqual(m.box.l - 1e-6);
  expect(p.hspan[1]).toBeLessThanOrEqual(m.box.r + 1e-6);
  // 그리고 세로변 중심(L,R)보다는 바깥쪽이라 네 귀가 붙는다
  expect(p.hspan[0]).toBeLessThanOrEqual(p.L + 1e-6);
  expect(p.hspan[1]).toBeGreaterThanOrEqual(p.R - 1e-6);
});

test('C4 ★CSS 폴백도 원·사각이 «같은 자리» — 원 전용 예외가 없어졌다', async ({ page }) => {
  await boot(page);
  await mountAndSelect(page, 'ellipse');
  const ell = await page.evaluate(() => getComputedStyle(window.__sb).outlineOffset);
  await mountAndSelect(page, 'rectangle');
  const rect = await page.evaluate(() => getComputedStyle(window.__sb).outlineOffset);
  expect(parseFloat(ell), `원의 폴백 오프셋이 사각과 다르다(${ell} vs ${rect})`).toBeCloseTo(parseFloat(rect), 6);
  expect(parseFloat(rect), `도형 일반의 폴백이 «안쪽»이 아니다(${rect})`).toBeLessThan(0);
});

/* ★C5 — 원 + 맞닿은 이웃 «동시선택».
 *   옛 판(바깥 선)에서는 원을 dedupe 에서 빼야 했다(틀린 맞닿음 판정으로 남의 변을 지우니까).
 *   지금은 원도 «상자 안» 선이라 dedupe 에 정상 참여한다 ⇒ 맞닿은 경계는 «한 줄»이 된다
 *   (그게 selection-overlay 의 설계 §4-2 이고, 모든 블럭이 그렇게 만난다). */
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

test('C5 ★원 + 맞닿은 이웃 동시선택 — 경계가 «한 줄»이다(원도 dedupe 에 정상 참여한다)', async ({ page }) => {
  const errs = await boot(page);
  await mountPair(page);
  const got = await page.evaluate(() => {
    const ra = window.__a.sb.getBoundingClientRect(), rb = window.__b.sb.getBoundingClientRect();
    const ds = [...document.querySelectorAll('#ss-handles-overlay .ss-sel-layer path')].map(p => p.getAttribute('d'));
    const segs = d => [...d.matchAll(/M([-\d.]+) ([-\d.]+)L([-\d.]+) ([-\d.]+)/g)].map(m => m.slice(1).map(Number));
    return { gap: rb.top - ra.bottom, ds, segs: ds.map(segs) };
  });
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
  expect(Math.abs(got.gap), `두 블럭이 안 맞닿았다(gap ${got.gap}) — 이 검사의 전제가 깨졌다`).toBeLessThan(0.01);
  expect(got.ds.length, `경로가 4개(각 블럭 × 래퍼+도형)가 아니다: ${got.ds.length}`).toBe(4);
  /* 맞닿은 경계에서 «중복 한 줄»이 지워졌는지 — 네 경로의 가로변 수 합이 8(=4×2)보다 «적어야» 한다.
     ⛔몇 줄이 지워지는지는 dedupe 의 몫이라 여기서 못박지 않는다(같은 상자 두 벌이 겹쳐 있으니
       구현이 어느 쪽을 지우는지는 DOM 순서에 달렸다). 「지워지긴 한다」만 못박는다. */
  const horiz = got.segs.reduce((n, s) => n + s.filter(x => Math.abs(x[1] - x[3]) < 0.01).length, 0);
  expect(horiz, '가로변이 하나도 안 지워졌다 — 원이 아직 dedupe 에서 빠져 있다(옛 판)').toBeLessThan(8);
});

/* ═══ 픽셀 — 「원 둘레가 «전부» 둘렸는가」 + 아이콘 서클과의 대조 ══════════════════
   ★여기가 이 라운드의 핵심 지표다. 옛 판은 «네 접점을 안 덮는가»만 봤는데, 그 판에서도
     원의 나머지 둘레에는 선이 «아예 없었다» — 즉 원은 언제나 «네모에 갇힌 채» 였다.
     새 판은 둘레를 360° 표본해서 「어느 각도에서든 그 반경에 선이 있는가」를 센다. */
const ZOOMS = [{ label: '40%', scale: 0.4 }, { label: '100%', scale: 1.0 }, { label: '150%', scale: 1.5 }];

test.describe('둘레 표본 (dpr 2)', () => {
  test.use({ deviceScaleFactor: 2 });

  /** 블럭 상자만 잘라 찍고, 반지름 R 근처(안쪽 3 device px)에 선택색 픽셀이 있는 각도 비율을 센다. */
  async function ringCoverage(page) {
    const box = await page.evaluate(() => {
      const q = window.__sb.getBoundingClientRect();
      return { x: q.left, y: q.top, width: q.width, height: q.height };
    });
    const shot = await page.screenshot({ clip: box });
    return page.evaluate(async (b64) => {
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + b64; });
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      const isSel = (x, y) => {
        if (x < 0 || y < 0 || x >= c.width || y >= c.height) return false;
        const i = ((y | 0) * c.width + (x | 0)) * 4, R = d[i], G = d[i + 1], B = d[i + 2];
        return B > R + 30 && B > G + 30 && B > 120 && R < 150;   // 선택 파랑(안티앨리어싱 포함)
      };
      const cx = c.width / 2, cy = c.height / 2, Rr = Math.min(cx, cy);
      let hit = 0, n = 0;
      for (let deg = 0; deg < 360; deg++) {
        const a = deg * Math.PI / 180;
        let ok = false;
        for (let t = 0.5; t <= 3.5; t += 0.5) {
          const x = cx + Math.cos(a) * (Rr - t), y = cy + Math.sin(a) * (Rr - t);
          if (isSel(x, y)) { ok = true; break; }
        }
        if (ok) hit++;
        n++;
      }
      return { pct: Math.round(hit / n * 1000) / 10, w: c.width, h: c.height };
    }, shot.toString('base64'));
  }

  /* ★잣대를 «절대값 하나»로 두지 않는다 — 둘레 표본은 작은 반지름에서 래스터화 때문에 천장이
     100 이 아니다(실측: 200px 원 · 줌 40% ⇒ 160 device px 지름에서 «아이콘 서클도» 91.4%).
     그래서 ⑴하한 90% 와 ⑵«아이콘 서클과 같은 수치»를 «같은 줌에서» 함께 본다.
     지시의 문언이 「아웃라인 이것처럼」이므로 대조군이 곧 정답이다. */
  for (const z of ZOOMS) {
    test(`C6-${z.label} ★원 둘레가 «아이콘 서클과 같은 정도»로 둘린다 (네 접점만 닿던 옛 판과 갈린다)`, async ({ page }) => {
      const errs = await boot(page, z.scale);
      await mountIconCircle(page, 200);
      const icb = await ringCoverage(page);            // 양성대조 — 현빈이 «문제없다»고 한 블럭
      await mountAndSelect(page, 'ellipse', 200);
      const ell = await ringCoverage(page);
      expect(ell.w, '잘라 찍은 폭이 device px 여야 한다(dpr 2)').toBeGreaterThan(200 * z.scale * 1.5);
      expect(icb.pct, `줌 ${z.label}: 아이콘 서클 자체가 ${icb.pct}% 다 — 대조군이 무너지면 이 검사는 아무것도 증명 못 한다`)
        .toBeGreaterThanOrEqual(90);
      expect(ell.pct, `줌 ${z.label}: 원 도형 둘레의 ${ell.pct}% 만 둘렸다 (${ell.w}x${ell.h}) — 링이 안 보이거나 SVG 가 덮었다`)
        .toBeGreaterThanOrEqual(90);
      expect(Math.abs(ell.pct - icb.pct), `줌 ${z.label}: 원 도형 ${ell.pct}% vs 아이콘 서클 ${icb.pct}% — 같은 길로 안 갔다`)
        .toBeLessThanOrEqual(3);
      expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
    });
  }

  test('C7 ★[음성대조] 링을 끄면 둘레가 «네 접점 부근»으로 떨어진다 (이 검사가 실제로 링을 재고 있다)', async ({ page }) => {
    await boot(page, 0.4);
    await mountAndSelect(page, 'ellipse', 200);
    const on = await ringCoverage(page);
    await page.addStyleTag({ content: '.shape-block.selected[data-shape-type="ellipse"]::before { display: none !important; }' });
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const off = await ringCoverage(page);
    expect(on.pct, `링을 켠 상태가 ${on.pct}% 다 — 대조의 출발점이 무너졌다`).toBeGreaterThanOrEqual(90);
    expect(off.pct, `링을 껐는데도 ${off.pct}% 가 둘려 있다 — 이 검사가 링이 아닌 다른 것을 재고 있다`)
      .toBeLessThan(30);
  });
});
