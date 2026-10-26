/* thumb-gutter-defer-165.dom.spec.js — 별건 165 ㉮(지디 22:43) · 그리드 거터 끌기가 자동저장·유휴 썸네일을 «미룬다»
 *
 * ★잰 값(S3 실앱 fa57bed6 · ae821046 · 수지 사본 · 행 거터 30s 끌기 ×6): 썸네일 html2canvas 가 마우스 눌린 채 시작 ·
 *   그 순간 _autoSaveDeferred·_suppressAutoSave 둘 다 false ⇒ ㉠(scheduleIdleThumbnail 의 바쁨 칸)이 이 제스처를 몰랐다.
 * ★처방 — js/overlay-handles.js _onGridColMouseDown · _onGridRowMouseDown(drag-history 허용③ «거터 둘»): mousedown 에 deferAutoSave ·
 *   onUp 끝에 resumeAutoSave (156 꼴 · overlay-float.js).
 *
 * ★칸
 *   P  전제(②) — 끄는 중 «재기 전» __autoSaveDeferState().deferred === true. 안 하면 «㉮ 안 먹음»과 «장면 안 섬»을 못 가른다.
 *      거터를 쥐었다는 장면은 따로 — 칸 높이/폭이 첫 이동에 따라온다.
 *   D1-row · D1-col  20초꼴 끌기(fire 가 두 번 미뤄질 때까지 쥠) — 끄는 중 캡처 0 · 놓은 뒤 찍힘
 *   D2  ★설계다 — 30초 안전망(save-load.js _AUTOSAVE_DEFER_MAX_MS)이 «끄는 중에» 미룸을 푼다(고착 = 데이터 손실). 그 뒤엔 찍힐 수 있다.
 *       ⛔_AUTOSAVE_DEFER_MAX_MS 를 올려 이 칸을 초록으로 만들지 마라 — 이 칸은 «풀린다»를 잠근다.
 * ⛔창 포커스를 잃게 하지 않는다 — blur 도 미룸을 푼다(save-load.js) = 거짓 빨강. D2 는 풀린 시각이 30s 쪽인지로 blur 와 가른다.
 * ⛔고정 대기 0 — 조건 대기만(fire 가 «미뤘다»는 사건 = fire·go 스택의 8000ms 타이머를 센다 · 165 첫 자 결함 교훈: 8000ms 전부 세면 거짓 초록).
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { INSTALL_FAKE_META_SRC } = require('./_fake-meta.js');

const SCENE = '<div class="section-block" id="dS" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:60px"></div><div class="row" id="dR" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:400px"></div></div></div>';
async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1400 });
  const errs = await bootApp(page);
  await page.evaluate(([SCENE, src]) => {
    (new Function(src))();
    window.activeProjectId = 'pA'; window.__meta.pA = {};
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', SCENE);
    const L = (t) => [{ type: 'body', text: t + ' 첫줄' }, { type: 'body', text: t + ' 둘째' }];
    const { block: g } = window.makeGridBlock({ cols: [{ width: 1, lines: L('A') }, { width: 1, lines: L('B') }], rows: [{ height: 120 }, { height: 'auto' }] });
    g.id = 'dG'; document.getElementById('dR').appendChild(g); window.rebindAll?.();
    window.renderGridBlock(g); window.deselectAll?.(); window.applyZoom?.(100); g.scrollIntoView({ block: 'center' });
    const T = window.__t165 = { caps: [], postpones: 0, ptr: 0 };
    document.addEventListener('mousedown', () => { T.ptr = 1; }, true); document.addEventListener('mouseup', () => { T.ptr = 0; }, true);
    const h2 = window.html2canvas;
    window.html2canvas = function (...a) {
      if (!String(new Error().stack).includes('captureThumbnail')) return h2.apply(this, a);
      T.caps.push({ start: performance.now(), mouseDown: T.ptr, deferred: window.__autoSaveDeferState().deferred });
      return h2.apply(this, a);
    };
    const st = window.setTimeout;
    window.setTimeout = function (fn, ms, ...rest) { if (ms === 8000 && /at (fire|go) \([^)]*save-load\.js/.test(String(new Error().stack))) T.postpones++; return st.call(this, fn, ms, ...rest); };
  }, [SCENE, INSTALL_FAKE_META_SRC]);
  await page.waitForFunction(() => !!document.querySelector('#dG .grd-cell'));
  /* ★고르기는 정본 입구 window.selectBlock(js/block-edit.js) 으로 — 캔버스 클릭으로 고르면 하네스에서 main 잠금(branch-system.js applyMainLock:
     #canvas pointer-events none)이 «가끔» 걸려(탐침: 6 중 1~5 · 그때 meta load 0 · initBranchStore 창 부름 0 — 까닭 미확정) 클릭이 #canvas-scaler 로 갔다.
     잴 축은 «거터 끌기»(오버레이 · 잠금 밖)라 그 끌기는 실마우스 그대로다. */
  const locked = await page.evaluate(() => { window.selectBlock('dG'); return document.getElementById('canvas-wrap').classList.contains('main-locked'); });
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('#ss-handles-overlay .grd-gutter').length), { message: `[전제] 고르기 → 거터가 섰다(main 잠금 ${locked})`, timeout: 5000 }).toBeGreaterThan(0);
  await waitStableRect(page, '#dG');
  return errs;
}
const gutter = (page, cur) => page.evaluate((cur) => { const g = [...document.querySelectorAll('#ss-handles-overlay .grd-gutter')].find(e => getComputedStyle(e).cursor === cur && e.offsetParent); if (!g) return null; const r = g.getBoundingClientRect(); return { x: r.left + r.width / 2, y: cur === 'row-resize' ? r.top + r.height / 2 : r.top + r.height * 0.2 }; }, cur);
const cellKey = (page, key) => page.evaluate((key) => { const r = document.querySelector('#dG .grd-cell[data-r="0"][data-c="0"]').getBoundingClientRect(); return +r[key].toFixed(1); }, key);
const S = (page) => page.evaluate(() => { const T = window.__t165; return { caps: T.caps.length, first: T.caps[0] || null, postpones: T.postpones, deferred: window.__autoSaveDeferState().deferred, focus: document.hasFocus() }; });

/* 거터를 쥐고 한 번 움직여 «장면이 섰다»를 확인한 뒤, 썸네일 타이머를 건다(끌기 «전»에 걸린 타이머가 끌기 «안»에서 터지던 꼴과 같은 순서는
   못 만든다 — 끄는 중 scheduleAutoSave 는 미룸이라 타이머를 안 건다. 그래서 «쥔 직후» 거는 것으로 같은 상황(끄는 중 fire)을 만든다). */
async function grab(page, axis) {
  const g = await gutter(page, axis === 'row' ? 'row-resize' : 'col-resize');
  expect(g, `[전제] ${axis} 거터가 섰다`).not.toBe(null);
  const key = axis === 'row' ? 'height' : 'width';
  const v0 = await cellKey(page, key);
  await page.mouse.move(g.x, g.y); await page.mouse.down();
  if (axis === 'row') await page.mouse.move(g.x, g.y + 12); else await page.mouse.move(g.x + 16, g.y);
  await expect.poll(() => cellKey(page, key), { message: '[전제] 장면이 섰다 — 쥔 거터를 따라 칸이 바뀐다' }).not.toBe(v0);
  const tDown = await page.evaluate(() => { window.scheduleIdleThumbnail(); return performance.now(); });
  return { g, tDown };
}

for (const axis of ['row', 'col']) {
  test(`D1-${axis} 20초꼴 끌기 — 끄는 중 썸네일 캡처 0 · 놓은 뒤 찍힌다`, async ({ page }) => {
    test.setTimeout(90000);
    const errs = await setup(page);
    await grab(page, axis);
    const s0 = await S(page);
    expect({ deferred: s0.deferred, focus: s0.focus }, 'P ②전제 — 재기 전 미룸이 걸렸다(창 포커스 그대로)').toEqual({ deferred: true, focus: true });
    /* fire 가 «두 번» 미뤄질 때까지 쥔다(8s·16s) — 그 사이 캡처가 시작되면 바로 끝난다 */
    await page.waitForFunction(() => window.__t165.postpones >= 2 || window.__t165.caps.length > 0, null, { timeout: 40000, polling: 200 });
    const s1 = await S(page);
    expect({ caps: s1.caps, deferred: s1.deferred }, `D1-${axis} 끄는 중 캡처 0 · 미룸 유지`).toEqual({ caps: 0, deferred: true });
    const tUp = await page.evaluate(() => performance.now());
    await page.mouse.up();
    await expect.poll(() => page.evaluate(() => window.__autoSaveDeferState().deferred), { message: '놓으면 미룸이 풀린다(onUp resumeAutoSave)' }).toBe(false);
    await page.waitForFunction(() => window.__t165.caps.length > 0, null, { timeout: 30000, polling: 200 });
    const s2 = await S(page);
    expect({ afterUp: s2.first.start > tUp, mouseDown: s2.first.mouseDown, deferred: s2.first.deferred }, `D1-${axis} 놓은 뒤 찍힘`).toEqual({ afterUp: true, mouseDown: 0, deferred: false });
    expect(errs).toEqual([]);
  });
}

test('D2 ★설계다 — 30초 안전망이 «끄는 중에» 미룸을 푼다(고착 = 데이터 손실) · 그 뒤엔 찍힐 수 있다', async ({ page }) => {
  test.setTimeout(120000);
  const errs = await setup(page);
  const { tDown } = await grab(page, 'row');
  const s0 = await S(page);
  expect({ deferred: s0.deferred, focus: s0.focus }, 'P ②전제 — 재기 전 미룸이 걸렸다').toEqual({ deferred: true, focus: true });
  /* 미룸이 풀릴 때까지 쥔다(놓지 않는다) */
  await page.waitForFunction(() => window.__autoSaveDeferState().deferred === false, null, { timeout: 45000, polling: 200 });
  const r = await page.evaluate((t) => ({ held: window.__t165.ptr, sinceDown: Math.round(performance.now() - t), focus: document.hasFocus() }), tDown);
  /* sinceDown 은 «타이머를 건 때» 기준이라 30000 보다 조금 작다(쥔 뒤 첫 이동 확인까지의 몫) — blur(즉시)·놓음(0)과 가르는 하한 25000 */
  expect({ held: r.held, focus: r.focus, guard: r.sinceDown >= 25000 && r.sinceDown <= 40000 }, `D2 설계 — 쥔 채 · 포커스 그대로 · 30s 안전망으로 풀림(${r.sinceDown}ms)`).toEqual({ held: 1, focus: true, guard: true });
  /* «찍힐 수 있다» — 풀린 뒤 resumeAutoSave 가 미룬 예약을 다시 걸고(scheduleAutoSave → scheduleIdleThumbnail · 8s) 쥔 채 가만히 두면 그 fire 가 찍는다 */
  await page.waitForFunction(() => window.__t165.caps.length > 0, null, { timeout: 20000, polling: 200 });
  const s2 = await S(page);
  expect({ mouseDown: s2.first.mouseDown, deferred: s2.first.deferred }, 'D2 설계 — 풀린 뒤엔 쥔 채로도 찍힌다(안전망이 우선)').toEqual({ mouseDown: 1, deferred: false });
  await page.mouse.up();
  expect(errs).toEqual([]);
});
