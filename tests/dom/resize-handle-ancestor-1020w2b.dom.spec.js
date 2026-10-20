/* resize-handle-ancestor-1020w2b.dom.spec.js — 1020t1d W2B ⒝ · 플립/회전된 «조상» 프레임 안에서 프레임 리사이즈 핸들
 *
 * ★무엇을 재나 — 사용자가 보는 것: 잡은 «화면» 꼭지점을 화면 (+40,+20) 끌면, 그 블록의 화면 상자가
 *   그 꼭지점의 바깥 방향으로 자란다(Δw = qx·40 · Δh = qy·20, qx/qy = 잡은 손잡이의 화면 사분면 부호).
 *   변환 없음(대조군)과 «같은 꼴»이어야 한다. 핸들은 자기 회전 0 인 블록에선 `_cornerScreen` 이 화면 AABB 꼭지점에 둔다.
 * ★핀(a42d76d5)에서의 예측(손으로 푼 것 · gen-handles.md 3절): flip 3꼴은 이름(AABB)과 Δ 부호가 상쇄돼 맞고,
 *   rot90 은 축이 뒤바뀌어 틀린다(Δw_screen=±20 · Δh_screen=±40).
 * 장면 = 앱의 제 문만: addSection() 버튼 → addFrameBlock() 버튼(A) → 패널 #ss-flip-h/#ss-flip-v/#ss-rotate-90
 *   → addFrameBlock() 버튼 한 번 더(B, _activeFrame=A 라 A 안 · absolute) → B 패널 300×200.
 * rect 읽기 = waitStableRect ＋ 두 번 읽어 같은가. ⛔새 waitForTimeout 0. 줌 40% 단언. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const DRAG = { x: 40, y: 20 };
const START = { w: 300, h: 200 };
const MODES = ['none', 'flipH', 'flipV', 'flipHV', 'rot90'];

async function zoomTo40(page) {
  for (let i = 0; i < 60; i++) {
    const z = await page.evaluate(() => parseInt(document.getElementById('zoom-display')?.textContent || '', 10));
    if (z === 40) break;
    await page.locator(`#zoom-ctrl .zoom-btn >> nth=${z > 40 ? 0 : 1}`).click();
  }
  await page.waitForFunction(() => {
    const s = document.getElementById('canvas-scaler');
    const m = s && s.style.transform && s.style.transform.match(/scale\(([^)]+)\)/);
    return m && Math.abs(parseFloat(m[1]) - 0.4) < 1e-9;
  }, null, { timeout: 5000 });
}

async function stable2(page, sel) {
  const a = await waitStableRect(page, sel);
  const b = await waitStableRect(page, sel);
  expect(b, `★두 번 읽어 같은가 — ${sel}`).toEqual(a);
  return a;
}

const nonTextFrames = () => [...document.querySelectorAll('.frame-block')].filter((x) => x.dataset.textFrame !== 'true').length;

async function clickFrameBtn(page) {
  const n = await page.evaluate(nonTextFrames);
  await page.locator('#floating-panel button.fp-btn[onclick="addFrameBlock()"]').click();
  await page.waitForFunction((k) => [...document.querySelectorAll('.frame-block')].filter((x) => x.dataset.textFrame !== 'true').length === k + 1, n, { timeout: 5000 });
}

/** A(조상, mode 변환) 안에 B(재는 블록) — 전부 앱 버튼·패널로. */
async function scene(page, mode) {
  const nSec = await page.evaluate(() => document.querySelectorAll('.section-block').length);
  await page.locator('#floating-panel button.fp-btn[onclick="addSection()"]').click();
  await page.waitForFunction((n) => document.querySelectorAll('.section-block').length === n + 1 && !!document.querySelector('.section-block.selected'), nSec, { timeout: 5000 });
  await clickFrameBtn(page);
  await page.evaluate(() => {
    document.querySelectorAll('[data-qa-anc],[data-qa-fr]').forEach((x) => { x.removeAttribute('data-qa-anc'); x.removeAttribute('data-qa-fr'); });
    [...document.querySelectorAll('.frame-block.selected')].filter((x) => x.dataset.textFrame !== 'true').pop().setAttribute('data-qa-anc', '1');
  });
  if (mode === 'flipH' || mode === 'flipHV') await page.locator('#ss-flip-h').click();
  if (mode === 'flipV' || mode === 'flipHV') await page.locator('#ss-flip-v').click();
  if (mode === 'rot90') await page.locator('#ss-rotate-90').click();
  await clickFrameBtn(page);
  await page.evaluate(() => {
    [...document.querySelectorAll('.frame-block.selected')].filter((x) => x.dataset.textFrame !== 'true' && !x.hasAttribute('data-qa-anc')).pop().setAttribute('data-qa-fr', 'cur');
  });
  await page.waitForFunction(() => !!document.querySelector('[data-qa-fr="cur"]') && !!document.getElementById('ss-width-num'), null, { timeout: 5000 });
  await page.fill('#ss-width-num', String(START.w));
  await page.fill('#ss-height-num', String(START.h));
  await page.waitForFunction(([w, h]) => {
    const f = document.querySelector('[data-qa-fr="cur"]');
    return f.dataset.width === String(w) && f.dataset.height === String(h);
  }, [START.w, START.h], { timeout: 5000 });
  await page.locator('[data-qa-anc="1"]').scrollIntoViewIfNeeded();
  return page.evaluate(() => {
    const a = document.querySelector('[data-qa-anc="1"]'), b = document.querySelector('[data-qa-fr="cur"]');
    return { parentIsA: b.parentElement === a, bPos: b.style.position, bRot: b.dataset.rotateDeg || '0',
      aFlipH: a.dataset.flipH || '', aFlipV: a.dataset.flipV || '', aRot: a.dataset.rotateDeg || '0', aTransform: a.style.transform || '' };
  });
}

const MODEL = () => {
  const f = document.querySelector('[data-qa-fr="cur"]');
  return { dw: f.dataset.width, dh: f.dataset.height, left: f.style.left || '', top: f.style.top || '' };
};

async function dragHandle(page, dir) {
  const hSel = `#ss-handles-overlay .ss-resize-handle.${dir}`;
  const h = await stable2(page, hSel);
  const fr0 = await stable2(page, '[data-qa-fr="cur"]');
  const px = h.left + h.width / 2, py = h.top + h.height / 2;
  const ident = await page.evaluate(([x, y]) => {
    const e = document.elementFromPoint(x, y);
    return e ? { cls: String(e.className), dir: e.dataset ? (e.dataset.dir || null) : null } : null;
  }, [px, py]);
  const qx = px >= fr0.cx ? 1 : -1, qy = py >= fr0.cy ? 1 : -1;
  await page.evaluate(() => {
    window.__qaMd = { cap: null, bub: false };
    const cap = (e) => { window.__qaMd.cap = { dir: e.target.dataset ? (e.target.dataset.dir || null) : null }; };
    const bub = () => { window.__qaMd.bub = true; };
    document.addEventListener('mousedown', cap, true);
    document.addEventListener('mousedown', bub, false);
    window.__qaMdOff = () => { document.removeEventListener('mousedown', cap, true); document.removeEventListener('mousedown', bub, false); };
  });
  const before = await page.evaluate(MODEL);
  const zoom = await page.evaluate(() => document.getElementById('zoom-display')?.textContent || '');
  await page.mouse.move(px, py);
  await page.mouse.down();
  await page.mouse.move(px + DRAG.x, py + DRAG.y, { steps: 5 });
  await page.mouse.up();
  const md = await page.evaluate(() => { window.__qaMdOff(); return window.__qaMd; });
  const fr1 = await stable2(page, '[data-qa-fr="cur"]');
  const a1 = await page.evaluate(MODEL);
  const a2 = await page.evaluate(MODEL);
  expect(a2, '★모델 두 번 읽어 같은가').toEqual(a1);
  return { dir, ident, capDir: md.cap && md.cap.dir, bub: md.bub, q: [qx, qy], zoom,
    dScreen: [fr1.width - fr0.width, fr1.height - fr0.height], before, after: a1 };
}

for (const mode of MODES) {
  test(`HR-ANC ${mode} — 조상 ${mode} 안 프레임의 4손잡이: 화면 상자가 잡은 꼭지점 바깥으로 (+40,+20) 만큼 (줌 40%)`, async ({ page }) => {
    test.setTimeout(150000);
    await page.setViewportSize({ width: 1700, height: 1200 });
    const errs = await bootApp(page);
    await zoomTo40(page);
    const rows = [];
    for (const dir of ['se', 'ne', 'sw', 'nw']) {
      const pre = await scene(page, mode);
      const r = await dragHandle(page, dir);
      r.pre = pre;
      rows.push(r);
      console.log(`ROW ${mode} ${JSON.stringify(r)}`);
    }
    for (const r of rows) {
      const tag = `${mode} ${r.dir}`;
      expect.soft(r.zoom, `${tag} 전제: 줌 40%`).toBe('40%');
      expect.soft([r.pre.parentIsA, r.pre.bPos, r.pre.bRot], `${tag} 전제: B 는 A 의 absolute 자식 · 자기 회전 0`).toEqual([true, 'absolute', '0']);
      const wantAnc = { none: ['', '', '0'], flipH: ['1', '', '0'], flipV: ['', '1', '0'], flipHV: ['1', '1', '0'], rot90: ['', '', '90'] }[mode];
      expect.soft([r.pre.aFlipH, r.pre.aFlipV, r.pre.aRot], `${tag} 전제: A 의 변환`).toEqual(wantAnc);
      expect.soft([r.before.dw, r.before.dh], `${tag} 전제: 시작 300×200`).toEqual(['300', '200']);
      expect.soft([r.ident && r.ident.dir, r.capDir, r.bub], `${tag} 정체·갈래`).toEqual([r.dir, r.dir, false]);
      /* 주 단언 — 화면 상자 변화 = 잡은 화면 꼭지점 바깥 방향 (±1px: AABB 반올림) */
      const want = [r.q[0] * DRAG.x, r.q[1] * DRAG.y];
      const ok = Math.abs(r.dScreen[0] - want[0]) <= 1 && Math.abs(r.dScreen[1] - want[1]) <= 1;
      expect.soft(ok, `${tag} 화면 상자 Δ ${JSON.stringify(r.dScreen)} · 기대 ${JSON.stringify(want)} · 모델 ${r.after.dw}×${r.after.dh}`).toBe(true);
    }
    expect(errs, '★오류 0').toEqual([]);
  });
}
