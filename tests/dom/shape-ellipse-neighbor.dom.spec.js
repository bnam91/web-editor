/* shape-ellipse-neighbor.dom.spec.js — 「원 선택선이 «선택 안 된» 이웃 블럭 상자를 침범하는가」.
 *
 * ★어디서 왔나
 *   T-072(circle-clip)는 현빈 결정 ㉮를 이행하려고 원(과 그 래퍼)의 선택 띠를 상자 «바로 밖»으로
 *   옮겼다. 그 커밋은 대가를 «미리 적어 두었다» — 「맞닿은 이웃이 있으면 그 1px 을 덮는다」.
 *   최종 통합 라운드 QA(medium)가 그걸 실제로 잡았다: 「원 선택 시 선이 선택 안 된 이웃 블럭
 *   상자 «안»을 칠한다(§4-3 이웃 불가침)」.
 *
 * ★왜 둘 다 못 가지나 (이 파일이 기록하는 사실)
 *   원은 제 상자 네 변에 «접»한다 ⇒ 선이 상자 «안»에 있으면 반드시 원을 문다.
 *   그 상자 변이 이웃 상자 변과 «같은 자리»면, 선이 상자 «밖»에 있으면 반드시 이웃을 문다.
 *   ⇒ 맞닿은 변에서는 셋(선 굵기 · 원 불가침 · 이웃 불가침) 중 하나를 포기해야 한다.
 *
 * ★고른 답 (2026-09-20 통합 라운드) = «변마다 따로» — 이웃이 없는 변만 밖으로 민다
 *   · 이웃이 «없는» 변 → 종전대로 상자 밖 (㉮ 유지: 원을 안 문다)
 *   · 이웃과 «맞닿은» 변 → 상자 안으로 되돌린다 (§4-3 유지: 남의 상자를 안 칠한다)
 *   근거 = 이 라운드의 지시문 「현빈 결정 ㉮ 범위 «안»에서 이웃 불가침을 지킬 것」.
 *   ⚠️대가는 N4 가 «기록»한다 — 맞닿은 변에서는 원이 다시 물린다. 뒤집으려면 N4 부터 뒤집어라.
 *
 * ⛔앱을 «안» 띄운다 — shape-ellipse-selection-outline.dom.spec.js 의 부트를 그대로 쓴다.
 * ⚠️변이 책임은 tests/unit/selection-overlay-ellipse.test.mjs(U-CIRCLE-11~) 가 진다.
 *
 * 실행: npm run test:dom -- shape-ellipse-neighbor
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

/* 기본은 현빈 실사용 줌 40% (traps.md — 낮은 줌에서 먼저 재라).
 * ★줌을 인자로 뺀 이유 (2026-09-20 통합 라운드 후속) — 이 카드의 지시가 «40/100/150 에서 0» 이었다.
 *   _blockedEdges 의 도달거리는 `반굵기 + 1/dpr` 이고 좌표는 _cornerScreen(줌이 곱해진 화면값)이라
 *   줌마다 «상자 크기 대비 띠 두께»가 달라진다 ⇒ 한 줌에서 0 인 것이 다른 줌의 증거가 못 된다. */
const HARNESS = (scale = 0.4) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-blocks.css"></head><body style="margin:0;background:#fff">
<div id="canvas-scaler" style="transform: scale(${scale}); transform-origin: 0 0;">
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
  await page.waitForFunction(() => document.body.classList.contains('sel-ov'));
  return errs;
}

/** 원(래퍼 프레임 + shape-block) 하나 + 그 «아래» 이웃 블럭 하나. gap=0 이면 두 상자가 맞닿는다.
 *  선택은 «원만» — 이웃은 선택하지 않는다(그게 §4-3 이 지키는 상황이다). */
async function mount(page, { gap }) {
  await page.evaluate((gap) => {
    const host = document.getElementById('host');
    host.innerHTML = '';
    const ss = document.createElement('div');
    ss.className = 'frame-block';
    ss.dataset.freeLayout = 'true';
    ss.setAttribute('style', 'width:100px;height:100px;min-height:100px;margin:0 auto;position:relative;');
    const sb = document.createElement('div');
    sb.className = 'shape-block';
    sb.dataset.type = 'shape';
    sb.dataset.shapeType = 'ellipse';
    sb.innerHTML = '<svg class="shape-svg" viewBox="0 0 100 100" preserveAspectRatio="none"><ellipse cx="50" cy="50" rx="50" ry="50"></ellipse></svg>';
    ss.appendChild(sb);
    host.appendChild(ss);

    const nb = document.createElement('div');
    nb.className = 'text-block';
    nb.id = 'nb';
    nb.setAttribute('style', `width:100px;height:80px;margin:${gap}px auto 0;background:#eee;`);
    nb.textContent = '이웃';
    host.appendChild(nb);

    ss.classList.add('selected');
    sb.classList.add('selected');   // selectShapeBlock 과 같은 모양(래퍼·도형 둘 다)
    window.__ss = ss; window.__sb = sb; window.__nb = nb;
  }, gap);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}

/** 같은 «줄»(.row)에서 원 오른쪽에 맞닿은 이웃 — 아래 이웃(mount)과 «다른 변»을 시험한다.
 *  ★왜 따로 재나: _blockedEdges 가 막는 변을 네 방향 모두 찾는다고 적어 두었지만, 위의 N1~N6 은
 *  «아래 변» 하나만 증명한다. 옆 블럭은 현빈 화면에서 더 흔한 배치다(한 줄에 둘). */
async function mountSide(page, { gap }) {
  await page.evaluate((gap) => {
    const host = document.getElementById('host');
    host.innerHTML = '';
    const row = document.createElement('div');
    row.className = 'row';
    row.setAttribute('style', `display:flex;align-items:flex-start;gap:${gap}px;position:relative;`);
    const ss = document.createElement('div');
    ss.className = 'frame-block';
    ss.dataset.freeLayout = 'true';
    ss.setAttribute('style', 'width:100px;height:100px;min-height:100px;position:relative;flex:0 0 auto;');
    const sb = document.createElement('div');
    sb.className = 'shape-block';
    sb.dataset.type = 'shape';
    sb.dataset.shapeType = 'ellipse';
    sb.innerHTML = '<svg class="shape-svg" viewBox="0 0 100 100" preserveAspectRatio="none"><ellipse cx="50" cy="50" rx="50" ry="50"></ellipse></svg>';
    ss.appendChild(sb);
    row.appendChild(ss);
    const nb = document.createElement('div');
    nb.className = 'text-block';
    nb.id = 'nb';
    nb.setAttribute('style', 'width:120px;height:100px;background:#eee;flex:0 0 auto;');
    row.appendChild(nb);
    host.appendChild(row);
    ss.classList.add('selected'); sb.classList.add('selected');
    window.__ss = ss; window.__sb = sb; window.__nb = nb;
  }, gap);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}

/** 그려진 모든 path 의 «칠해지는 띠»를 네 변으로 환산하고, 상자들과 같이 돌려준다. */
const measure = (page) => page.evaluate(() => {
  const sw = parseFloat(getComputedStyle(document.querySelector('.ss-sel-path')).strokeWidth) || 1;
  const h = sw / 2;
  const bands = [];
  for (const p of document.querySelectorAll('#ss-handles-overlay .ss-sel-layer path')) {
    const d = p.getAttribute('d');
    const segs = [...d.matchAll(/M([-\d.]+) ([-\d.]+)L([-\d.]+) ([-\d.]+)/g)].map(m => m.slice(1).map(Number));
    for (const [x1, y1, x2, y2] of segs) {
      if (Math.abs(y1 - y2) < 0.01) bands.push({ kind: 'h', c: y1, lo: y1 - h, hi: y1 + h, a: Math.min(x1, x2), b: Math.max(x1, x2) });
      else if (Math.abs(x1 - x2) < 0.01) bands.push({ kind: 'v', c: x1, lo: x1 - h, hi: x1 + h, a: Math.min(y1, y2), b: Math.max(y1, y2) });
    }
  }
  const r = (el) => { const q = el.getBoundingClientRect(); return { l: q.left, t: q.top, r: q.right, b: q.bottom }; };
  return { sw, h, bands, shape: r(window.__sb), frame: r(window.__ss), nb: r(window.__nb), dpr: window.devicePixelRatio };
});

/** 이웃 상자 «안»으로 들어간 띠의 최대 깊이(CSS px). 0 이면 한 점도 안 칠한 것. */
function intoNeighbor(m) {
  let worst = 0;
  for (const s of m.bands) {
    if (s.kind === 'h') {
      // 가로 띠: 세로로 이웃 상자 안에 들어갔고, 가로 구간이 이웃과 겹치면 침범
      const overlapX = Math.min(s.b, m.nb.r) - Math.max(s.a, m.nb.l);
      if (overlapX <= 0) continue;
      worst = Math.max(worst, Math.min(s.hi, m.nb.b) - Math.max(s.lo, m.nb.t));
    } else {
      const overlapY = Math.min(s.b, m.nb.b) - Math.max(s.a, m.nb.t);
      if (overlapY <= 0) continue;
      worst = Math.max(worst, Math.min(s.hi, m.nb.r) - Math.max(s.lo, m.nb.l));
    }
  }
  return Math.max(0, +worst.toFixed(3));
}

/** 원(도형 상자) «안»으로 들어간 띠의 최대 깊이(CSS px). 0 이면 원을 한 점도 안 문 것. */
function intoShape(m, side) {
  const box = m.shape;
  let worst = 0;
  for (const s of m.bands) {
    if (s.kind === 'h') {
      if (side === 'top'    && Math.abs(s.c - box.t) > 3) continue;
      if (side === 'bottom' && Math.abs(s.c - box.b) > 3) continue;
      if (side !== 'top' && side !== 'bottom') continue;
      worst = Math.max(worst, Math.min(s.hi, box.b) - Math.max(s.lo, box.t));
    } else {
      if (side !== 'left' && side !== 'right') continue;
      if (side === 'left'  && Math.abs(s.c - box.l) > 3) continue;
      if (side === 'right' && Math.abs(s.c - box.r) > 3) continue;
      worst = Math.max(worst, Math.min(s.hi, box.r) - Math.max(s.lo, box.l));
    }
  }
  return Math.max(0, +worst.toFixed(3));
}

test.describe('원 선택선과 이웃 블럭', () => {
  test('N1 ★맞닿은 이웃(gap 0)의 상자를 «한 점도» 안 칠한다 (§4-3 이웃 불가침)', async ({ page }) => {
    const errs = await boot(page);
    await mount(page, { gap: 0 });
    const m = await measure(page);
    expect(+(m.nb.t - m.frame.b).toFixed(3), '하네스 전제 — 두 상자가 맞닿아야 한다').toBe(0);
    expect(intoNeighbor(m), `이웃 상자 안을 ${intoNeighbor(m)}px 칠했다 (굵기 ${m.sw})`).toBe(0);
    expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
  });

  test('N2 ★이웃이 «없는» 변에서는 여전히 원을 안 문다 (㉮ 유지)', async ({ page }) => {
    await boot(page);
    await mount(page, { gap: 0 });
    const m = await measure(page);
    // 위·좌·우에는 맞닿은 이웃이 없다 → 종전대로 상자 밖
    for (const side of ['top', 'left', 'right']) {
      expect(intoShape(m, side), `${side} 변이 원을 ${intoShape(m, side)}px 물었다`).toBe(0);
    }
  });

  test('N3 ★음성대조 — 이웃이 «떨어져» 있으면(gap 8) 네 변 모두 원을 안 문다', async ({ page }) => {
    await boot(page);
    await mount(page, { gap: 8 });
    const m = await measure(page);
    expect(+(m.nb.t - m.frame.b).toFixed(1), '하네스 전제 — 떨어져 있어야 한다').toBeGreaterThan(0);
    for (const side of ['top', 'bottom', 'left', 'right']) {
      expect(intoShape(m, side), `${side} 변이 원을 물었다 — 이웃이 없는데도 안쪽으로 돌아갔다`).toBe(0);
    }
    expect(intoNeighbor(m), '떨어진 이웃을 칠했다').toBe(0);
  });

  test('N4 ⚠️대가 기록 — «맞닿은» 변에서는 원이 다시 물린다 (셋 중 하나는 포기해야 한다)', async ({ page }) => {
    await boot(page);
    await mount(page, { gap: 0 });
    const m = await measure(page);
    /* ⚠️이건 «바람직하다»가 아니라 «지금 이렇다»는 기록이다. 맞닿은 변에서는
       선 굵기 · 원 불가침 · 이웃 불가침 셋이 동시에 설 수 없고, 이 라운드의 지시는
       「㉮ 범위 안에서 «이웃 불가침»을 지킬 것」이었다.
       ★결정이 뒤집히면(「이웃을 좀 칠해도 원이 우선」) 이 검사부터 뒤집어라. */
    expect(intoShape(m, 'bottom'), '맞닿은 변인데 원을 한 점도 안 물었다 — 규약이 바뀌었으면 이 검사부터 고쳐라')
      .toBeGreaterThan(0);
    expect(intoShape(m, 'bottom'), '무는 깊이가 굵기(반굵기+격자)를 넘었다').toBeLessThanOrEqual(m.h + 1 / m.dpr + 0.001);
  });
});

/* ═══ 줌 전수 — 「40/100/150 에서 이웃 위 순파랑 0」 (2026-09-20 통합 라운드 지시) ════════
   ★왜 한 줌으로 안 되나
     _blockedEdges 가 겹침을 보는 «도달거리»는 반굵기 + 1/dpr 로 «화면 px» 단위인데,
     상자 좌표는 줌이 곱해진 화면값(_cornerScreen)이다 ⇒ 줌이 커질수록 상자는 커지고 띠는
     그대로다. 한 줌에서 0 인 것이 다른 줌의 증거가 못 된다 — 그래서 셋을 따로 잰다.
   ★N6 은 «기하»가 아니라 «픽셀»로 잰다 — N1 이 재는 것은 우리가 계산한 띠 사각형이고,
     N6 이 재는 것은 크로미움이 실제로 칠한 색이다. 계산이 맞아도 렌더가 새면 N6 이 잡는다. */
const ZOOMS = [
  { label: '40%',  scale: 0.4 },
  { label: '100%', scale: 1.0 },
  { label: '150%', scale: 1.5 },
];

test.describe('줌 전수 — 이웃 불가침', () => {
  for (const z of ZOOMS) {
    test(`N5-${z.label} ★맞닿은 이웃 상자를 한 점도 안 칠한다 + 이웃 없는 세 변은 원을 안 문다`, async ({ page }) => {
      const errs = await boot(page, z.scale);
      await mount(page, { gap: 0 });
      const m = await measure(page);
      expect(+(m.nb.t - m.frame.b).toFixed(3), '하네스 전제 — 두 상자가 맞닿아야 한다').toBe(0);
      expect(intoNeighbor(m), `줌 ${z.label}: 이웃 상자 안을 ${intoNeighbor(m)}px 칠했다`).toBe(0);
      for (const side of ['top', 'left', 'right']) {
        expect(intoShape(m, side), `줌 ${z.label}: ${side} 변이 원을 물었다 (㉮ 가 이 줌에서 깨졌다)`).toBe(0);
      }
      expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
    });
  }
});

/* dpr 2 = 현빈 맥(레티나). 「device px 0」을 말하려면 device 격자에서 재야 한다. */
test.describe('줌 전수 — 픽셀로 센 순파랑 (dpr 2)', () => {
  test.use({ deviceScaleFactor: 2 });

  /** 이웃 상자 만큼 잘라 찍고, 그 안의 «선택 파랑» 픽셀 수를 센다.
   *  순파랑 = #2d6fe8(--p-blue-600 = --sel-color) 정확 일치.
   *  파랑계 = 안티앨리어싱으로 흐려진 파랑까지(파랑이 뚜렷이 우세) — 「살짝 걸친 것」도 놓치지 않으려고. */
  async function blueOverNeighbor(page) {
    const box = await page.evaluate(() => {
      const q = window.__nb.getBoundingClientRect();
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
      let pure = 0, bluish = 0;
      for (let i = 0; i < d.length; i += 4) {
        const R = d[i], G = d[i + 1], B = d[i + 2];
        if (R === 45 && G === 111 && B === 232) pure++;
        else if (B > R + 30 && B > G + 30 && B > 120) bluish++;
      }
      return { pure, bluish, w: c.width, h: c.height };
    }, shot.toString('base64'));
  }

  for (const z of ZOOMS) {
    test(`N6-${z.label} ★이웃 상자 위 순파랑 device px = 0`, async ({ page }) => {
      await boot(page, z.scale);
      await mount(page, { gap: 0 });
      const got = await blueOverNeighbor(page);
      expect(got.w, '잘라 찍은 폭이 device px 여야 한다(dpr 2)').toBeGreaterThan(100 * z.scale * 1.5);
      expect(got.pure, `줌 ${z.label}: 이웃 상자 위에 순파랑 ${got.pure} device px (${got.w}x${got.h})`).toBe(0);
      expect(got.bluish, `줌 ${z.label}: 이웃 상자 위에 파랑계 ${got.bluish} device px`).toBe(0);
    });
  }

  test('N7 ★음성대조 — 떨어진 이웃(gap 8)은 고치기 «전에도» 0 이었다 (줌 40%)', async ({ page }) => {
    await boot(page, 0.4);
    await mount(page, { gap: 8 });
    const got = await blueOverNeighbor(page);
    expect(got.pure + got.bluish, '떨어진 이웃 위에 파랑이 있다').toBe(0);
  });
});

/* ═══ 옆(같은 줄) 이웃 — «아래 변»이 아닌 변도 같은가 ═══════════════════════════════
   위의 N1~N7 은 전부 «아래 이웃» 한 배치다. _blockedEdges 는 네 변을 다 본다고 적혀 있지만
   검사가 한 변만 증명하면, 옆 변 판정이 사라져도 아무도 안 잡는다. 실제 화면에서 더 흔한
   배치(한 줄에 블럭 둘)를 같은 «픽셀» 잣대로 잰다. */
test.describe('옆 이웃 (같은 줄) — 픽셀 (dpr 2)', () => {
  test.use({ deviceScaleFactor: 2 });

  async function blueOverNeighborSide(page) {
    const box = await page.evaluate(() => {
      const q = window.__nb.getBoundingClientRect();
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
      let pure = 0, bluish = 0;
      for (let i = 0; i < d.length; i += 4) {
        const R = d[i], G = d[i + 1], B = d[i + 2];
        if (R === 45 && G === 111 && B === 232) pure++;
        else if (B > R + 30 && B > G + 30 && B > 120) bluish++;
      }
      return { pure, bluish, w: c.width, h: c.height };
    }, shot.toString('base64'));
  }

  for (const z of ZOOMS) {
    test(`N8-${z.label} ★오른쪽에 맞닿은 이웃 상자 위 순파랑 device px = 0`, async ({ page }) => {
      const errs = await boot(page, z.scale);
      await mountSide(page, { gap: 0 });
      const m = await measure(page);
      expect(+(m.nb.l - m.frame.r).toFixed(3), '하네스 전제 — 옆으로 맞닿아야 한다').toBe(0);
      const got = await blueOverNeighborSide(page);
      expect(got.pure, `줌 ${z.label}: 옆 이웃 상자 위에 순파랑 ${got.pure} device px (${got.w}x${got.h})`).toBe(0);
      expect(got.bluish, `줌 ${z.label}: 옆 이웃 상자 위에 파랑계 ${got.bluish} device px`).toBe(0);
      // ㉮ — 이웃이 없는 «위·아래·왼쪽»에서는 여전히 원을 안 문다
      for (const side of ['top', 'bottom', 'left']) {
        expect(intoShape(m, side), `줌 ${z.label}: ${side} 변이 원을 물었다 (옆 이웃 때문에 네 변을 다 포기했다)`).toBe(0);
      }
      expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
    });
  }

  test('N9 ★음성대조 — 옆 이웃이 떨어져 있으면(gap 8) 고치기 전에도 0 (줌 100%)', async ({ page }) => {
    await boot(page, 1.0);
    await mountSide(page, { gap: 8 });
    const m = await measure(page);
    expect(+(m.nb.l - m.frame.r).toFixed(1), '하네스 전제 — 떨어져 있어야 한다').toBeGreaterThan(0);
    const got = await blueOverNeighborSide(page);
    expect(got.pure + got.bluish, '떨어진 옆 이웃 위에 파랑이 있다').toBe(0);
    expect(intoShape(m, 'right'), '이웃이 떨어져 있는데 오른쪽 변이 원을 물었다').toBe(0);
  });
});
