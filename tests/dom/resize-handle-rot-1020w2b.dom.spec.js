/* resize-handle-rot-1020w2b.dom.spec.js — 1020t1d W2B ⒝ 리사이즈 핸들 · ★양성대조(자기 회전 뒤 리사이즈가 맞다)
 *
 * ★왜 이 칸이 먼저인가 — js/overlay-handles.js `_unrotateDelta`(자기 회전만 본다)를 손대기 전에
 *   «바꾸기 전 판에서 회전 뒤 리사이즈가 맞다»가 ×3 으로 서야 한다(ORDER-W2B ⒝). 앞 레인은
 *   ⑴ 「변환없음」 칸이 3회에 갈렸고 ⑵ 잡힌 손잡이가 ne 인데 se 기준으로 쟀다 ⇒ 기준이 틀렸다.
 *   ⇒ 이 칸은 ★손잡이 정체(data-dir · 화면 사분면)를 먼저 찍고, ★방향표(아래 EXPECT)와 맞춘다.
 *
 * 장면 = 앱의 제 문만: 플로팅 패널 addSection() 버튼 → addFrameBlock() 버튼 → 패널 #ss-width-num/#ss-height-num
 *   → 회전 30° = #ss-rotate-deg 입력 · 90° = #ss-rotate-90 버튼. 줌 = #zoom-ctrl 버튼(40% 단언).
 * 끌기 = 화면 (+40,+20) · 줌 0.4 ⇒ 캔버스 Δ (100,50). 로컬 Δ = 역회전(−θ).
 *   θ=0 (100,50) · θ=30 (111.603,−6.699) · θ=90 (50,−100)
 *   e: W+=ldx · w: W−=ldx · s: H+=ldy · n: H−=ldy   (이 갈래는 left/top 을 안 쓴다)
 * rect 읽기 = waitStableRect(가라앉기) ＋ 두 번 읽어 같은가. ⛔새 waitForTimeout 0.
 * 갈래 마커: document 캡처 mousedown 이 잡은 target(data-dir) ＋ 버블 mousedown 이 «안 닿았다»
 *   = 그 손잡이의 `_onHandleMouseDown` 이 stopPropagation 했다(그 갈래가 돌았다). */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const DRAG = { x: 40, y: 20 };
const START = { w: 400, h: 300 };
/* ★방향표 — 첫 런 전에 적었다(reports/S6-1020-W2B/gen-handles.md 1절과 같은 수) */
const EXPECT = {
  0:  { se: [500, 350], ne: [500, 250], sw: [300, 350], nw: [300, 250] },
  30: { se: [512, 293], ne: [512, 307], sw: [288, 293], nw: [288, 307] },
  90: { se: [450, 200], ne: [450, 400], sw: [350, 200], nw: [350, 400] },
};
/* 손잡이가 화면에서 놓일 사분면 기대(프레임 AABB 중심 기준) — θ=30 은 꼭지점이 사분면 경계 근처라 안 단언 */
const QUAD = {
  0:  { se: 'se', ne: 'ne', sw: 'sw', nw: 'nw' },
  90: { se: 'sw', ne: 'se', sw: 'nw', nw: 'ne' },
};

async function zoomTo40(page) {
  for (let i = 0; i < 60; i++) {
    const z = await page.evaluate(() => {
      const t = document.getElementById('zoom-display')?.textContent || '';
      return parseInt(t, 10);
    });
    if (z === 40) break;
    await page.locator(`#zoom-ctrl .zoom-btn >> nth=${z > 40 ? 0 : 1}`).click();
  }
  await page.waitForFunction(() => {
    const s = document.getElementById('canvas-scaler');
    const m = s && s.style.transform && s.style.transform.match(/scale\(([^)]+)\)/);
    return m && Math.abs(parseFloat(m[1]) - 0.4) < 1e-9;
  }, null, { timeout: 5000 });
}

async function readZoom(page) {
  return page.evaluate(() => {
    const s = document.getElementById('canvas-scaler');
    const m = s && s.style.transform && s.style.transform.match(/scale\(([^)]+)\)/);
    return { display: document.getElementById('zoom-display')?.textContent || '', scale: m ? parseFloat(m[1]) : null };
  });
}

/** 새 섹션 ＋ 새 프레임(앱 버튼) → 400×300 → 회전. 그 프레임에 data-qa-fr="cur" 를 단다(재는 표식만). */
async function sceneFrame(page, rot) {
  /* 새 섹션의 기본 블록에 글 래퍼 프레임(data-text-frame)이 섞일 수 있어 ★섹션 버튼 «뒤»·프레임 버튼 «앞»에 센다 */
  const nSec = await page.evaluate(() => document.querySelectorAll('.section-block').length);
  await page.locator('#floating-panel button.fp-btn[onclick="addSection()"]').click();
  await page.waitForFunction((n) => document.querySelectorAll('.section-block').length === n + 1
    && !!document.querySelector('.section-block.selected'), nSec, { timeout: 5000 });
  const nBefore = await page.evaluate(() => [...document.querySelectorAll('.frame-block')].filter((x) => x.dataset.textFrame !== 'true').length);
  await page.locator('#floating-panel button.fp-btn[onclick="addFrameBlock()"]').click();
  await page.waitForFunction((n) => [...document.querySelectorAll('.frame-block')].filter((x) => x.dataset.textFrame !== 'true').length === n + 1,
    nBefore, { timeout: 5000 });
  await page.evaluate(() => {
    document.querySelectorAll('[data-qa-fr]').forEach((x) => x.removeAttribute('data-qa-fr'));
    const f = [...document.querySelectorAll('.frame-block.selected')].filter((x) => x.dataset.textFrame !== 'true').pop();
    if (f) f.setAttribute('data-qa-fr', 'cur');
  });
  await page.waitForFunction(() => !!document.querySelector('[data-qa-fr="cur"]') && !!document.getElementById('ss-width-num'), null, { timeout: 5000 });
  await page.fill('#ss-width-num', String(START.w));
  await page.fill('#ss-height-num', String(START.h));
  await page.waitForFunction(([w, h]) => {
    const f = document.querySelector('[data-qa-fr="cur"]');
    return f.dataset.width === String(w) && f.dataset.height === String(h);
  }, [START.w, START.h], { timeout: 5000 });
  if (rot === 30) {
    await page.fill('#ss-rotate-deg', '30');
  } else if (rot === 90) {
    await page.locator('#ss-rotate-90').click();
  }
  await page.waitForFunction((r) => (parseFloat(document.querySelector('[data-qa-fr="cur"]').dataset.rotateDeg) || 0) === r, rot, { timeout: 5000 });
  await page.locator('[data-qa-fr="cur"]').scrollIntoViewIfNeeded();
}

async function stable2(page, sel) {
  const a = await waitStableRect(page, sel);
  const b = await waitStableRect(page, sel);
  expect(b, `★두 번 읽어 같은가 — ${sel}`).toEqual(a);
  return a;
}

const MODEL = () => {
  const f = document.querySelector('[data-qa-fr="cur"]');
  return { dw: f.dataset.width, dh: f.dataset.height, sw: f.style.width, sh: f.style.height,
    left: f.style.left || '', top: f.style.top || '', rot: f.dataset.rotateDeg || '0',
    flipH: f.dataset.flipH || '', flipV: f.dataset.flipV || '' };
};

/** 손잡이 하나를 잡고 (+40,+20) 끈다 — 정체·갈래 마커·결과를 돌려준다. */
async function dragHandle(page, dir) {
  const hSel = `#ss-handles-overlay .ss-resize-handle.${dir}`;
  const h = await stable2(page, hSel);
  const fr = await stable2(page, '[data-qa-fr="cur"]');
  const px = h.left + h.width / 2, py = h.top + h.height / 2;
  const ident = await page.evaluate(([x, y]) => {
    const e = document.elementFromPoint(x, y);
    return e ? { cls: String(e.className), dir: e.dataset ? (e.dataset.dir || null) : null } : null;
  }, [px, py]);
  const quad = (py >= fr.cy ? 's' : 'n') + (px >= fr.cx ? 'e' : 'w');
  await page.evaluate(() => {
    window.__qaMd = { cap: null, bub: false };
    const cap = (e) => { window.__qaMd.cap = { cls: String(e.target.className), dir: e.target.dataset ? (e.target.dataset.dir || null) : null }; };
    const bub = () => { window.__qaMd.bub = true; };
    document.addEventListener('mousedown', cap, true);
    document.addEventListener('mousedown', bub, false);
    window.__qaMdOff = () => { document.removeEventListener('mousedown', cap, true); document.removeEventListener('mousedown', bub, false); };
  });
  const before = await page.evaluate(MODEL);
  const zoom = await readZoom(page);
  await page.mouse.move(px, py);
  await page.mouse.down();
  await page.mouse.move(px + DRAG.x, py + DRAG.y, { steps: 5 });
  await page.mouse.up();
  const md = await page.evaluate(() => { window.__qaMdOff(); return window.__qaMd; });
  await stable2(page, '[data-qa-fr="cur"]');
  const a1 = await page.evaluate(MODEL);
  const a2 = await page.evaluate(MODEL);
  expect(a2, '★모델 두 번 읽어 같은가').toEqual(a1);
  return { dir, ident, md, quad, handle: { x: px, y: py }, frameAABB: { cx: fr.cx, cy: fr.cy, w: fr.width, h: fr.height }, zoom, before, after: a1 };
}

for (const rot of [0, 30, 90]) {
  test(`HR-PC rot${rot} — 핀에서 자기 회전 ${rot}° 뒤 4손잡이 리사이즈가 방향표와 맞다 (줌 40%)`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 1700, height: 1200 });
    const errs = await bootApp(page);
    await zoomTo40(page);
    const rows = [];
    for (const dir of ['se', 'ne', 'sw', 'nw']) {
      await sceneFrame(page, rot);
      const r = await dragHandle(page, dir);
      rows.push(r);
      console.log(`ROW rot${rot} ${JSON.stringify(r)}`);
    }
    for (const r of rows) {
      const tag = `rot${rot} ${r.dir}`;
      /* 전제 — 줌 40 · 시작 400×300 · 회전값 */
      expect.soft(r.zoom, `${tag} 전제: 줌 40%`).toEqual({ display: '40%', scale: 0.4 });
      expect.soft([r.before.dw, r.before.dh, r.before.rot], `${tag} 전제: 시작 400×300 · rot`).toEqual(['400', '300', String(rot)]);
      /* 손잡이 정체 — 누른 점의 요소 · 캡처 target 둘 다 그 dir */
      expect.soft(r.ident && r.ident.dir, `${tag} 정체: elementFromPoint 의 data-dir`).toBe(r.dir);
      expect.soft(r.md.cap && r.md.cap.dir, `${tag} 정체: mousedown target 의 data-dir`).toBe(r.dir);
      /* 갈래 마커 — 버블 리스너에 안 닿았다 = 손잡이 핸들러가 stopPropagation 했다 */
      expect.soft(r.md.bub, `${tag} 갈래: _onHandleMouseDown 이 돌았다(버블 차단)`).toBe(false);
      if (QUAD[rot]) expect.soft(r.quad, `${tag} 화면 사분면`).toBe(QUAD[rot][r.dir]);
      /* 주 단언 — 방향표 */
      expect.soft([+r.after.dw, +r.after.dh], `${tag} 결과 W×H (방향표)`).toEqual(EXPECT[rot][r.dir]);
      expect.soft([r.after.left, r.after.top], `${tag} left/top 불변`).toEqual([r.before.left, r.before.top]);
    }
    expect(errs, '★오류 0').toEqual([]);
  });
}
