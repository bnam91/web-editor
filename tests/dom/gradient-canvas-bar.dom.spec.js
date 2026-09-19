/* gradient-canvas-bar.dom.spec.js — 0918 canvasgrad: 캔버스 그라데이션 바 피그마식 재구성.
 * (현빈 그림 note0918_img0: 선 + 양끝 흰 원 + 선 옆 «회전한 네모 색칩», 선택=파랑, 드래그 중 % 라벨)
 *
 * ⛔앱을 «안» 띄운다(9500/9334/MCP 대역 무접촉). gradient-model.js + gradient-line-overlay.js +
 *   editor-blocks.css 원문만 로드해서 진짜 레이아웃·진짜 마우스(page.mouse)로 잰다.
 *   (선례: gradient-shape-rotation-box.dom.spec.js)
 * 실행: npm run test:dom -- gradient-canvas-bar
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const BLOCKS_CSS = fs.readFileSync(path.join(REPO, 'css/editor-blocks.css'), 'utf8');
const MODEL_JS = fs.readFileSync(path.join(REPO, 'js/props/gradient-model.js'), 'utf8');
const OVERLAY_JS = fs.readFileSync(path.join(REPO, 'js/gradient-line-overlay.js'), 'utf8');

const SHAPE_CSS = 'linear-gradient(90deg, #ff0000 0%, #00ff00 50%, #0000ff 100%)';
const BN2_CSS = 'linear-gradient(45deg, #ff5e3a 0%, #1aa6ff 100%)';

async function boot(page, { shapeRot = 0, zoom = 100 } = {}) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html><head><meta charset="utf-8">
          <style>${BLOCKS_CSS}</style>
          <style>body{margin:0}.section-block{position:relative;}
            #scaler{transform-origin:0 0;transform:scale(${zoom / 100});}</style>
          <script>
            window.currentZoom = ${zoom};
            document.documentElement.style.setProperty('--inv-zoom', String(100 / ${zoom}));
            window.__hist = 0; window.pushHistory = () => { window.__hist++; };
            window.scheduleAutoSave = () => {};
            window.renderBanner02 = (b) => { b.style.background = b.dataset.bg; };
          </script>
          <script type="module" src="/js/gradient-line-overlay.js"></script>
          </head><body><div id="scaler">
          <div class="section-block" style="width:1100px;height:900px;">
            <div class="frame-block" style="position:absolute;left:200px;top:120px;width:200px;height:200px;">
              <div class="shape-block selected" id="shp" data-shape-type="rectangle"
                   ${shapeRot ? `data-shape-rotation="${shapeRot}" style="transform:rotate(${shapeRot}deg)"` : ''}
                   data-shape-color="${SHAPE_CSS}">
                <svg class="shape-svg" viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:100%;display:block"><rect width="100" height="100"/></svg>
              </div>
            </div>
            <div class="frame-block" style="position:absolute;left:150px;top:500px;width:800px;height:200px;">
              <div class="banner02-block selected" id="bn2" style="position:relative;overflow:hidden;width:800px;height:200px;background:${BN2_CSS}"
                   data-bg="${BN2_CSS}"></div>
            </div>
          </div></div>
          </body></html>`,
      });
    }
    if (url.pathname === '/js/gradient-line-overlay.js') return route.fulfill({ contentType: 'application/javascript', body: OVERLAY_JS });
    if (url.pathname === '/js/props/gradient-model.js') return route.fulfill({ contentType: 'application/javascript', body: MODEL_JS });
    return route.fulfill({ status: 404, body: '' });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => !!window.showGradientLine && !!window.GradientModel?.gradientLine);
  return errs;
}

// 기대 칩 중심(클라이언트 px) — 비회전·줌 반영: overlay rect 기준 gradientLine + chipPlacement
async function expectedChips(page, id) {
  return page.evaluate((id) => {
    const b = document.getElementById(id);
    const refs = b._gradLine;
    const GM = window.GradientModel;
    const or = refs.overlay.getBoundingClientRect();
    const z = (window.currentZoom || 100) / 100;
    const W = refs.box.w, H = refs.box.h;
    const ln = GM.gradientLine(refs.model, { space: refs.target.space, w: W, h: H });
    const p0 = { x: ln.p0.x * W, y: ln.p0.y * H }, p1 = { x: ln.p1.x * W, y: ln.p1.y * H };
    const d = 16 * (100 / (window.currentZoom || 100));
    return refs.model.stops.map((s, i) => {
      const pl = GM.chipPlacement(p0, p1, s.offset, d);
      const r = refs.chips[i].getBoundingClientRect();
      const m = new DOMMatrix(getComputedStyle(refs.chips[i]).transform);
      return {
        want: { x: or.left + pl.x * z, y: or.top + pl.y * z, rot: pl.rotDeg },
        got: { x: r.left + r.width / 2, y: r.top + r.height / 2, rot: Math.atan2(m.b, m.a) * 180 / Math.PI },
        onLine: { x: or.left + pl.onLine.x * z, y: or.top + pl.onLine.y * z },
        size: r.width,
      };
    });
  }, id);
}

test('B1 구조 — shape(3스탑)/banner02: 선 1, 끝 원 2, 칩 = 스탑 수, 칩 중심 = 선 위 offset 점 + 법선 d(±1px), 회전 = 선 각도', async ({ page }) => {
  const errs = await boot(page);
  for (const [id, n] of [['shp', 3], ['bn2', 2]]) {
    await page.evaluate((id) => window.showGradientLine(document.getElementById(id)), id);
    const cnt = await page.evaluate((id) => {
      const o = document.getElementById(id).querySelector(':scope > .grad-line-overlay');
      return { line: o.querySelectorAll('.grad-line').length, end: o.querySelectorAll('.grad-line-end').length, chip: o.querySelectorAll('.grad-stop-chip').length };
    }, id);
    expect(cnt, id).toEqual({ line: 1, end: 2, chip: n });
    const chips = await expectedChips(page, id);
    for (const c of chips) {
      expect(Math.abs(c.got.x - c.want.x), `${id} chip x`).toBeLessThanOrEqual(1);
      expect(Math.abs(c.got.y - c.want.y), `${id} chip y`).toBeLessThanOrEqual(1);
      expect(Math.abs(c.got.rot - c.want.rot) % 360, `${id} chip rot`).toBeLessThan(0.5);
    }
  }
  expect(errs).toEqual([]);
});

test('B2 ★banner02 45° — 끝 원은 CSS 실제 선 끝(박스 밖)이고 frame overflow 해제로 elementFromPoint 로 잡힌다', async ({ page }) => {
  const errs = await boot(page);
  const out = await page.evaluate(() => {
    const b = document.getElementById('bn2');
    window.showGradientLine(b);
    const end = b.querySelector('[data-grad-handle="end"]');
    const r = end.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    return { outside: cy < br.top || cy > br.bottom, hit: hit === end, frameOv: getComputedStyle(b.parentElement).overflow, bnOv: getComputedStyle(b).overflow };
  });
  expect(out.outside, '800×200 45° CSS 선 끝은 박스 위로 나가야 한다(L=|w sin|+|h cos|)').toBe(true);
  expect(out.frameOv).toBe('visible');
  expect(out.bnOv).toBe('visible');
  expect(out.hit, '박스 밖 끝 원이 잘려서 안 잡힌다').toBe(true);
  expect(errs).toEqual([]);
});

async function dragChip(page, id, idx, toFrac, { probeMid = false } = {}) {
  const pos = await page.evaluate(({ id, idx, toFrac }) => {
    const b = document.getElementById(id);
    const refs = b._gradLine;
    const r = refs.chips[idx].getBoundingClientRect();
    const or = refs.overlay.getBoundingClientRect();
    const z = (window.currentZoom || 100) / 100;
    const W = refs.box.w, H = refs.box.h;
    const ln = window.GradientModel.gradientLine(refs.model, { space: refs.target.space, w: W, h: H });
    return {
      from: { x: r.left + r.width / 2, y: r.top + r.height / 2 },
      to: { x: or.left + (ln.p0.x + (ln.p1.x - ln.p0.x) * toFrac) * W * z, y: or.top + (ln.p0.y + (ln.p1.y - ln.p0.y) * toFrac) * H * z },
    };
  }, { id, idx, toFrac });
  await page.mouse.move(pos.from.x, pos.from.y);
  await page.mouse.down();
  await page.mouse.move((pos.from.x + pos.to.x) / 2, (pos.from.y + pos.to.y) / 2, { steps: 4 });
  await page.mouse.move(pos.to.x, pos.to.y, { steps: 4 });
  let mid = null;
  if (probeMid) {
    mid = await page.evaluate((id) => {
      const p = document.getElementById(id).querySelector('.grad-line-pct');
      return { vis: getComputedStyle(p).display !== 'none', text: p.textContent };
    }, id);
  }
  await page.mouse.up();
  return mid;
}

test('B3 칩 드래그 — 그 스탑 %만 바뀌고, 드래그 중 % 라벨 표시·값 일치, mouseup 후 숨김, history 1회', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => window.showGradientLine(document.getElementById('shp')));
  const mid = await dragChip(page, 'shp', 1, 0.7, { probeMid: true });
  expect(mid.vis).toBe(true);
  expect(mid.text).toBe('70%');
  const out = await page.evaluate(() => ({
    css: document.getElementById('shp').dataset.shapeColor,
    pctVis: getComputedStyle(document.querySelector('#shp .grad-line-pct')).display,
    hist: window.__hist,
  }));
  expect(out.css).toBe('linear-gradient(90deg, #ff0000 0%, #00ff00 70%, #0000ff 100%)');
  expect(out.pctVis).toBe('none');
  expect(out.hist).toBe(1);

  // banner02(비정사각형 CSS 공간)도 같은 규칙
  await page.evaluate(() => window.showGradientLine(document.getElementById('bn2')));
  await dragChip(page, 'bn2', 0, 0.3);
  const bg = await page.evaluate(() => document.getElementById('bn2').dataset.bg);
  expect(bg).toBe('linear-gradient(45deg, #ff5e3a 30%, #1aa6ff 100%)');
  expect(errs).toEqual([]);
});

test('B4 칩 «클릭만» — pushHistory 0회, 값 불변, 선택만 이동(is-selected 는 한 칩에만)', async ({ page }) => {
  const errs = await boot(page);
  const out = await page.evaluate(() => {
    const b = document.getElementById('shp');
    window.showGradientLine(b);
    const before = b.dataset.shapeColor;
    const chip = b._gradLine.chips[2];
    const r = chip.getBoundingClientRect();
    return { before, x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.mouse.click(out.x, out.y);
  const after = await page.evaluate(() => {
    const b = document.getElementById('shp');
    return {
      css: b.dataset.shapeColor, hist: window.__hist,
      sel: [...b.querySelectorAll('.grad-stop-chip')].map(c => c.classList.contains('is-selected')),
      tail: getComputedStyle(b._gradLine.chips[2], '::after').borderTopColor,
      tailOther: getComputedStyle(b._gradLine.chips[0], '::after').borderTopColor,
    };
  });
  expect(after.css).toBe(out.before);
  expect(after.hist).toBe(0);
  expect(after.sel).toEqual([false, false, true]);
  expect(after.tail).not.toBe(after.tailOther);
  expect(errs).toEqual([]);
});

test('B5 끝 원 드래그 — 적용 각도 = 커서 방향(banner02 800×200 는 px 공간), history 1회', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(() => {
    const b = document.getElementById('bn2');
    window.showGradientLine(b);
    const e = b.querySelector('[data-grad-handle="end"]').getBoundingClientRect();
    const br = b.getBoundingClientRect();
    return { ex: e.left + e.width / 2, ey: e.top + e.height / 2, cx: br.left + br.width / 2, cy: br.top + br.height / 2 };
  });
  // 커서를 중심에서 오른쪽 300, 아래 50 으로 → px 각도 = atan2(300, -50)
  const tx = r.cx + 300, ty = r.cy + 50;
  await page.mouse.move(r.ex, r.ey);
  await page.mouse.down();
  await page.mouse.move(tx, ty, { steps: 6 });
  await page.mouse.up();
  const want = Math.round((Math.atan2(300, -50) * 180 / Math.PI + 360) % 360);
  const out = await page.evaluate(() => {
    const b = document.getElementById('bn2');
    const e = b.querySelector('[data-grad-handle="end"]').getBoundingClientRect();
    const br = b.getBoundingClientRect();
    return { bg: b.dataset.bg, hist: window.__hist, ex: e.left + e.width / 2 - (br.left + br.width / 2), ey: e.top + e.height / 2 - (br.top + br.height / 2) };
  });
  expect(out.bg).toBe(`linear-gradient(${want}deg, #ff5e3a 0%, #1aa6ff 100%)`);
  expect(out.hist).toBe(1);
  // 원은 실제 렌더 끝점으로 스냅 — 커서 방향과 같은 방향
  const dirGot = Math.atan2(out.ex, -out.ey) * 180 / Math.PI;
  expect(Math.abs(((dirGot + 360) % 360) - want)).toBeLessThan(1);
  expect(errs).toEqual([]);
});

test('B6 회전 shape(45°) — 칩 드래그 offset = 커서의 선 투영(AABB 좌표 결함 회귀)', async ({ page }) => {
  const errs = await boot(page, { shapeRot: 45 });
  // 도형 로컬 선 위 80% 지점을 «화면 좌표로» 회전 변환해 커서를 보낸다
  const pos = await page.evaluate(() => {
    const b = document.getElementById('shp');
    window.showGradientLine(b);
    const refs = b._gradLine;
    const r = refs.chips[1].getBoundingClientRect();
    const br = b.getBoundingClientRect();
    const W = b.offsetWidth, H = b.offsetHeight;
    const ln = window.GradientModel.gradientLine(refs.model, { space: 'bbox', w: W, h: H });
    const lx = (ln.p0.x + (ln.p1.x - ln.p0.x) * 0.8) * W - W / 2;
    const ly = (ln.p0.y + (ln.p1.y - ln.p0.y) * 0.8) * H - H / 2;
    const a = Math.PI / 4;
    return {
      from: { x: r.left + r.width / 2, y: r.top + r.height / 2 },
      to: { x: br.left + br.width / 2 + lx * Math.cos(a) - ly * Math.sin(a), y: br.top + br.height / 2 + lx * Math.sin(a) + ly * Math.cos(a) },
    };
  });
  await page.mouse.move(pos.from.x, pos.from.y);
  await page.mouse.down();
  await page.mouse.move(pos.to.x, pos.to.y, { steps: 6 });
  await page.mouse.up();
  const css = await page.evaluate(() => document.getElementById('shp').dataset.shapeColor);
  expect(css).toBe('linear-gradient(90deg, #ff0000 0%, #00ff00 80%, #0000ff 100%)');
  expect(errs).toEqual([]);
});

test('B7 setGradientLineSelected / 재호출 시 칩 노드 identity 유지', async ({ page }) => {
  const errs = await boot(page);
  const out = await page.evaluate(() => {
    const b = document.getElementById('shp');
    window.showGradientLine(b);
    const before = [...b.querySelectorAll('.grad-stop-chip')];
    window.setGradientLineSelected(b, 2);
    const sel = before.map(c => c.classList.contains('is-selected'));
    window.showGradientLine(b);
    const after = [...b.querySelectorAll('.grad-stop-chip')];
    return { sel, same: before.length === after.length && before.every((c, i) => c === after[i]), selAfter: after.map(c => c.classList.contains('is-selected')) };
  });
  expect(out.sel).toEqual([false, false, true]);
  expect(out.same).toBe(true);
  expect(out.selAfter).toEqual([false, false, true]);
  expect(errs).toEqual([]);
});

test('B8 줌 200%(--inv-zoom 0.5) — 화면상 칩 크기 18px 일정, 칩 중심 계산도 유지', async ({ page }) => {
  const errs = await boot(page, { zoom: 200 });
  await page.evaluate(() => window.showGradientLine(document.getElementById('shp')));
  const chips = await expectedChips(page, 'shp');
  for (const c of chips) {
    expect(Math.abs(c.size - 18)).toBeLessThan(0.6);
    expect(Math.abs(c.got.x - c.want.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(c.got.y - c.want.y)).toBeLessThanOrEqual(1);
  }
  // 화면상 선→칩 거리 = 16px
  const c0 = chips[1];
  expect(Math.abs(Math.hypot(c0.got.x - c0.onLine.x, c0.got.y - c0.onLine.y) - 16)).toBeLessThan(1);
  expect(errs).toEqual([]);
});

