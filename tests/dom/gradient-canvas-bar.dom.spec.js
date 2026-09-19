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

async function boot(page, { shapeRot = 0, zoom = 100, sibling = false } = {}) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html><head><meta charset="utf-8">
          <style>${BLOCKS_CSS}</style>
          <style>body{margin:0}.section-block{position:relative;}
            #canvas-scaler{position:relative;transform-origin:0 0;transform:scale(${zoom / 100});}</style>
          <script>
            window.currentZoom = ${zoom};
            document.documentElement.style.setProperty('--inv-zoom', String(100 / ${zoom}));
            window.__hist = 0; window.pushHistory = () => { window.__hist++; };
            window.scheduleAutoSave = () => {};
            window.renderBanner02 = (b) => { b.style.background = b.dataset.bg; };
          </script>
          <script type="module" src="/js/gradient-line-overlay.js"></script>
          </head><body><div id="canvas-scaler">
          <div class="section-block" style="width:1100px;height:900px;">
            <div class="frame-block" style="position:absolute;left:200px;top:120px;width:200px;height:200px;">
              <div class="shape-block selected" id="shp" data-shape-type="rectangle"
                   ${shapeRot ? `data-shape-rotation="${shapeRot}" style="transform:rotate(${shapeRot}deg)"` : ''}
                   data-shape-color="${SHAPE_CSS}">
                <svg class="shape-svg" viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:100%;display:block"><rect width="100" height="100"/></svg>
              </div>
            </div>
            ${sibling ? `<div class="frame-block" id="sibfr" data-text-frame="true" style="position:absolute;left:420px;top:100px;width:400px;height:300px;overflow:visible;">
              <div class="text-block" id="sibtb" style="position:relative;z-index:2;width:100%;height:100%;background:#fff;"><div class="tb-body" style="width:100%;height:100%">형제 텍스트</div></div>
            </div>` : ''}
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
      const o = document.getElementById(id)._gradLine.overlay;
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

test('B2 ★banner02 45° — 끝 원은 CSS 실제 선 끝(박스 밖)이고 포털 층이라 잘리지 않아 elementFromPoint 로 잡힌다', async ({ page }) => {
  const errs = await boot(page);
  const out = await page.evaluate(() => {
    const b = document.getElementById('bn2');
    window.showGradientLine(b);
    const end = b._gradLine.overlay.querySelector('[data-grad-handle="end"]');
    const r = end.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    return { outside: cy < br.top || cy > br.bottom, hit: hit === end };
  });
  expect(out.outside, '800×200 45° CSS 선 끝은 박스 위로 나가야 한다(L=|w sin|+|h cos|)').toBe(true);
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
      const p = document.getElementById(id)._gradLine.overlay.querySelector('.grad-line-pct');
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
    pctVis: getComputedStyle(document.getElementById('shp')._gradLine.overlay.querySelector('.grad-line-pct')).display,
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
      sel: [...b._gradLine.overlay.querySelectorAll('.grad-stop-chip')].map(c => c.classList.contains('is-selected')),
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

// 끝 원 드래그 공용: 핸들 중심 → (dx,dy) 만큼. 결과 끝 원·시작 원 중심(클라이언트) 반환.
async function dragEnd(page, id, which, dx, dy) {
  const r = await page.evaluate(({ id, which }) => {
    const b = document.getElementById(id);
    const q = (w) => { const e = b._gradLine.overlay.querySelector(`[data-grad-handle="${w}"]`).getBoundingClientRect(); return { x: e.left + e.width / 2, y: e.top + e.height / 2 }; };
    return { h: q(which), start: q('start'), end: q('end') };
  }, { id, which });
  await page.mouse.move(r.h.x, r.h.y);
  await page.mouse.down();
  await page.mouse.move(r.h.x + dx, r.h.y + dy, { steps: 8 });
  await page.mouse.up();
  const after = await page.evaluate((id) => {
    const b = document.getElementById(id);
    const q = (w) => { const e = b._gradLine.overlay.querySelector(`[data-grad-handle="${w}"]`).getBoundingClientRect(); return { x: e.left + e.width / 2, y: e.top + e.height / 2 }; };
    const br = b.getBoundingClientRect();
    return { start: q('start'), end: q('end'), box: { l: br.left, t: br.top, w: br.width, h: br.height }, hist: window.__hist,
      css: b.dataset.shapeColor || b.dataset.bg };
  }, id);
  return { before: r, after, cursor: { x: r.h.x + dx, y: r.h.y + dy } };
}
// 독립 기준(해석해): 끝점 두 개(px, 박스 기준) + 스탑의 끈 선 위 상대 위치 → 저장 각도·스탑 %.
//   css : 각도 = px 방향, 색 선 = 중심 ± u·L/2, L=|w sin|+|h cos| (px 투영)
//   bbox: 각도 = 정규화 방향, 선 = 0.5 ∓ 0.5u (정규화 투영)
function refFromEndpoints(space, w, h, P0, P1, rel) {
  const sx = space === 'css' ? 1 : 1 / w, sy = space === 'css' ? 1 : 1 / h;
  const q0 = { x: P0.x * sx, y: P0.y * sy }, q1 = { x: P1.x * sx, y: P1.y * sy };
  const ang = Math.round(((Math.atan2(q1.x - q0.x, -(q1.y - q0.y)) * 180 / Math.PI) + 360) % 360) % 360;
  const r = ang * Math.PI / 180, ux = Math.sin(r), uy = -Math.cos(r);
  const W = space === 'css' ? w : 1, H = space === 'css' ? h : 1;
  const L = space === 'css' ? Math.abs(W * ux) + Math.abs(H * uy) : 1;
  const c = { x: W / 2, y: H / 2 };
  const t = (q) => 0.5 + ((q.x - c.x) * ux + (q.y - c.y) * uy) / L;
  const t0 = t(q0), t1 = t(q1);
  return { angle: ang, offsets: rel.map(v => Math.round((t0 + (t1 - t0) * v) * 100)) };
}

test('B5 ★끝 원 드래그 — 원은 커서 자리에 머물고(스냅·클램프 없음), 각도·스탑 %를 그 선 기준으로 다시 계산(banner02 800×200 px 공간), history 1회', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => window.showGradientLine(document.getElementById('bn2')));
  const d = await dragEnd(page, 'bn2', 'end', -260, 140);
  const { after, before, cursor } = d;
  expect(Math.hypot(after.end.x - cursor.x, after.end.y - cursor.y), '끝 원 = 커서 자리').toBeLessThan(1.5);
  expect(Math.hypot(after.start.x - before.start.x, after.start.y - before.start.y), '시작 원 불변').toBeLessThan(1);
  const P0 = { x: after.start.x - after.box.l, y: after.start.y - after.box.t };
  const P1 = { x: after.end.x - after.box.l, y: after.end.y - after.box.t };
  const ref = refFromEndpoints('css', 800, 200, P0, P1, [0, 1]);
  expect(after.css).toBe(`linear-gradient(${ref.angle}deg, #ff5e3a ${ref.offsets[0]}%, #1aa6ff ${ref.offsets[1]}%)`);
  expect(after.hist).toBe(1);
  expect(errs).toEqual([]);
});

test('B10 ★도형 끝 원을 경계 밖으로 — 원이 밖에 머물고, 94% 스탑이 100% 초과로 재계산된다(이벨류에이터 재현: 전엔 원이 안으로 스냅·스탑 불변)', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => {
    const b = document.getElementById('shp');
    b.dataset.shapeColor = 'linear-gradient(90deg, #ff5e3a 0%, #1aa6ff 94%)';
    window.showGradientLine(b);
  });
  const d = await dragEnd(page, 'shp', 'end', 133, 133);
  const { after, cursor } = d;
  const bx = after.box;
  expect(after.end.x > bx.l + bx.w || after.end.y > bx.t + bx.h, '끝 원이 도형 밖').toBe(true);
  expect(Math.hypot(after.end.x - cursor.x, after.end.y - cursor.y), '끝 원 = 커서 자리(클램프 금지)').toBeLessThan(1.5);
  const P0 = { x: after.start.x - bx.l, y: after.start.y - bx.t };
  const P1 = { x: after.end.x - bx.l, y: after.end.y - bx.t };
  // 끌기 전 view = canon(0~100%) → 스탑 rel = [0, 0.94]
  const ref = refFromEndpoints('bbox', bx.w, bx.h, P0, P1, [0, 0.94]);
  expect(after.css).toBe(`linear-gradient(${ref.angle}deg, #ff5e3a ${ref.offsets[0]}%, #1aa6ff ${ref.offsets[1]}%)`);
  expect(ref.offsets[1], '끝 스탑이 100% 를 넘는다(도형 안엔 그 구간만)').toBeGreaterThan(100);
  expect(after.hist).toBe(1);

  // 재선택(hide→show): 우리가 쓴 값 그대로면 끈 끝점 유지
  const re = await page.evaluate(() => {
    const b = document.getElementById('shp');
    window.hideGradientLine(b); window.showGradientLine(b);
    const e = b._gradLine.overlay.querySelector('[data-grad-handle="end"]').getBoundingClientRect();
    return { x: e.left + e.width / 2, y: e.top + e.height / 2 };
  });
  expect(Math.hypot(re.x - after.end.x, re.y - after.end.y), '재선택 후 끝 원 유지').toBeLessThan(1);
  // 외부에서 값이 바뀌면(패널 편집·undo) 기억을 버리고 저장값에서 유도 → 원이 canon 끝(박스 오른쪽 가운데)
  const ext = await page.evaluate(() => {
    const b = document.getElementById('shp');
    b.dataset.shapeColor = 'linear-gradient(90deg, #ff5e3a 0%, #1aa6ff 100%)';
    window.showGradientLine(b);
    const e = b._gradLine.overlay.querySelector('[data-grad-handle="end"]').getBoundingClientRect();
    const br = b.getBoundingClientRect();
    return { dx: e.left + e.width / 2 - br.right, dy: e.top + e.height / 2 - (br.top + br.height / 2) };
  });
  expect(Math.abs(ext.dx)).toBeLessThan(1);
  expect(Math.abs(ext.dy)).toBeLessThan(1);
  expect(errs).toEqual([]);
});

test('B11 시작 원도 자유 — 밖으로 끌면 0% 스탑이 음수 %로, 끝 원 불변', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => window.showGradientLine(document.getElementById('shp')));
  const { after, before, cursor } = await dragEnd(page, 'shp', 'start', -80, 0);
  expect(Math.hypot(after.start.x - cursor.x, after.start.y - cursor.y)).toBeLessThan(1.5);
  expect(Math.hypot(after.end.x - before.end.x, after.end.y - before.end.y)).toBeLessThan(1);
  expect(after.css).toBe('linear-gradient(90deg, #ff0000 -40%, #00ff00 30%, #0000ff 100%)');
  expect(errs).toEqual([]);
});

test('B12 ★칩 선택 중 Backspace/Delete — 블록 삭제로 새지 않고 선택 스탑 삭제(3개↑), 2개면 무시, 칩 밖을 누르면 원래대로', async ({ page }) => {
  const errs = await boot(page);
  const c = await page.evaluate(() => {
    window.__editorDel = 0;
    document.addEventListener('keydown', (e) => { if (e.key === 'Backspace' || e.key === 'Delete') window.__editorDel++; }, true); // 에디터 블록 삭제 자리
    const b = document.getElementById('shp');
    window.showGradientLine(b);
    const r = b._gradLine.chips[1].getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.mouse.click(c.x, c.y);
  await page.keyboard.press('Backspace');
  let out = await page.evaluate(() => ({ css: document.getElementById('shp').dataset.shapeColor, del: window.__editorDel, hist: window.__hist,
    chips: (document.getElementById('shp')?._gradLine?.overlay.querySelectorAll('.grad-stop-chip').length ?? 0), alive: !!document.getElementById('shp') }));
  expect(out).toEqual({ css: 'linear-gradient(90deg, #ff0000 0%, #0000ff 100%)', del: 0, hist: 1, chips: 2, alive: true });
  await page.keyboard.press('Delete');                 // 2개 — 삭제 안 함, 블록 삭제로도 안 샘
  out = await page.evaluate(() => ({ css: document.getElementById('shp').dataset.shapeColor, del: window.__editorDel, hist: window.__hist }));
  expect(out).toEqual({ css: 'linear-gradient(90deg, #ff0000 0%, #0000ff 100%)', del: 0, hist: 1 });
  await page.mouse.click(5, 5);                        // 칩 밖 → 칩 포커스 해제
  await page.keyboard.press('Backspace');
  expect(await page.evaluate(() => window.__editorDel), '칩 포커스 해제 뒤엔 에디터 삭제 경로로 간다').toBe(1);
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
    const before = [...b._gradLine.overlay.querySelectorAll('.grad-stop-chip')];
    window.setGradientLineSelected(b, 2);
    const sel = before.map(c => c.classList.contains('is-selected'));
    window.showGradientLine(b);
    const after = [...b._gradLine.overlay.querySelectorAll('.grad-stop-chip')];
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


test('B9 ★칩 드래그·클릭 뒤 click 이 블록 선택 핸들러로 새지 않는다(9504 실앱: 새면 패널 재렌더 → 피커 동기 끊김)', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => {
    window.__clicks = 0;
    document.addEventListener('click', () => { window.__clicks++; });   // 에디터 선택 핸들러 자리(버블)
    window.showGradientLine(document.getElementById('shp'));
  });
  await dragChip(page, 'shp', 1, 0.8);            // mouseup 은 칩 밖(선 위) → click 대상 = 공통 조상
  const c = await page.evaluate(() => { const r = document.getElementById('shp')._gradLine.chips[0].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.click(c.x, c.y);               // 클릭만
  const out = await page.evaluate(() => ({ clicks: window.__clicks, css: document.getElementById('shp').dataset.shapeColor }));
  expect(out.css).toBe('linear-gradient(90deg, #ff0000 0%, #00ff00 80%, #0000ff 100%)');
  expect(out.clicks).toBe(0);
  // 음성대조 성격: 오버레이 밖 클릭은 그대로 전달된다(삼킴이 과하지 않다)
  await page.mouse.click(5, 5);
  expect(await page.evaluate(() => window.__clicks)).toBe(1);
  expect(errs).toEqual([]);
});

test('B13 ★줌 40%(기본값) — 도형 오버레이 박스 = 도형 화면 크기(전엔 2.5배), 90° 끝 원 = 도형 좌·우 가운데', async ({ page }) => {
  const errs = await boot(page, { zoom: 40 });
  const out = await page.evaluate(() => {
    const b = document.getElementById('shp');
    window.showGradientLine(b);
    const or = b._gradLine.overlay.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    const c = (w) => { const e = b._gradLine.overlay.querySelector(`[data-grad-handle="${w}"]`).getBoundingClientRect(); return { x: e.left + e.width / 2, y: e.top + e.height / 2 }; };
    return { or: { l: or.left, t: or.top, w: or.width, h: or.height }, br: { l: br.left, t: br.top, w: br.width, h: br.height, r: br.right, cy: br.top + br.height / 2 }, s: c('start'), e: c('end') };
  });
  expect(Math.abs(out.or.w - out.br.w), `오버레이 폭 ${out.or.w} vs 도형 ${out.br.w}`).toBeLessThan(1);
  expect(Math.abs(out.or.h - out.br.h)).toBeLessThan(1);
  expect(Math.abs(out.or.l - out.br.l)).toBeLessThan(1);
  expect(Math.abs(out.or.t - out.br.t)).toBeLessThan(1);
  expect(Math.abs(out.s.x - out.br.l)).toBeLessThan(1);
  expect(Math.abs(out.e.x - out.br.r)).toBeLessThan(1);
  expect(Math.abs(out.e.y - out.br.cy)).toBeLessThan(1);
  expect(errs).toEqual([]);
});

test('B14 ★뒤에 오는 형제(텍스트 z-index:2) 위로 끈 끝 원을 «다시» 잡을 수 있다 — 형제 밑에 깔리지 않음(줌 40·100)', async ({ page }) => {
  for (const zoom of [100, 40]) {
    const errs = await boot(page, { zoom, sibling: true });
    await page.evaluate(() => window.showGradientLine(document.getElementById('shp')));
    // 1차: 끝 원(도형 오른쪽 가운데)을 형제 텍스트 위로
    const d1 = await dragEnd(page, 'shp', 'end', 120 * zoom / 100, 40 * zoom / 100);
    const probe = await page.evaluate(({ x, y }) => {
      const hit = document.elementFromPoint(x, y);
      const sib = document.getElementById('sibtb').getBoundingClientRect();
      return { onHandle: !!hit?.closest?.('[data-grad-handle="end"]'), hitCls: hit?.className || hit?.tagName,
        overSibling: x > sib.left && x < sib.right && y > sib.top && y < sib.bottom };
    }, d1.after.end);
    expect(probe.overSibling, `zoom ${zoom}: 끝 원이 형제 텍스트 위에 있어야 재현이 된다`).toBe(true);
    expect(probe.onHandle, `zoom ${zoom}: 형제 위 끝 원을 elementFromPoint 로 못 잡음(hit=${probe.hitCls})`).toBe(true);
    // 2차: 그 자리에서 다시 끌기 — 값이 또 바뀐다
    const d2 = await dragEnd(page, 'shp', 'end', 0, 60 * zoom / 100);
    expect(d2.after.css, `zoom ${zoom}: 두 번째 드래그가 먹지 않았다`).not.toBe(d1.after.css);
    expect(Math.hypot(d2.after.end.x - d2.cursor.x, d2.after.end.y - d2.cursor.y)).toBeLessThan(1.5);
    // 블록 자체의 겹침 순서는 건드리지 않는다(편집 중 페인트 순서 거짓말 금지)
    const z = await page.evaluate(() => getComputedStyle(document.getElementById('shp').parentElement).zIndex);
    expect(z).toBe('auto');
    expect(errs).toEqual([]);
  }
});

test('B15 포털 — 블록이 움직이면 바가 따라가고, 블록이 DOM 에서 빠지면 바도 사라진다', async ({ page }) => {
  const errs = await boot(page);
  const before = await page.evaluate(() => {
    const b = document.getElementById('shp');
    window.showGradientLine(b);
    return b._gradLine.overlay.getBoundingClientRect().left;
  });
  await page.evaluate(() => { document.getElementById('shp').parentElement.style.left = '260px'; });
  await page.waitForTimeout(80);
  const moved = await page.evaluate(() => {
    const b = document.getElementById('shp');
    return { ov: b._gradLine.overlay.getBoundingClientRect().left, bl: b.getBoundingClientRect().left };
  });
  expect(Math.abs(moved.ov - moved.bl)).toBeLessThan(1);
  expect(moved.ov - before).toBeGreaterThan(50);
  await page.evaluate(() => document.getElementById('shp').parentElement.remove());
  await page.waitForTimeout(80);
  expect(await page.evaluate(() => document.querySelectorAll('.grad-line-portal, .grad-line-overlay').length)).toBe(0);
  expect(errs).toEqual([]);
});
