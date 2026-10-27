/* ft3-left-drag-and-pullin.dom.spec.js — FT-3b 왼쪽 끌기 · FT-3a 섹션 밖 손잡이 되찾기
 *
 * 현빈 원문(자유변형 셋 ③ · from-gd-51): 「보라 아웃라인을 섹션 밖으로 끌면 안 보여서 나간 핸들을 못 찾는다」
 * 미카사 앱 실측(261025 · ca702d40 · 흐름 글상자 · 배율 40):
 *   3b `FT-LEFT-DRAG-ANCHORS-AT-TB-LEFT-01` — nw 를 누른 채 왼쪽 800px: 손잡이 cx 573.8 고정 · 데이터 x −1998.67
 *   3a — ne 를 섹션 오른 경계 밖 60px: 마지막 손잡이 맞음 cx 889(섹션 경계) · 그 너머 임자 `canvas-wrap` · 다시 잡기 0
 *
 * 칸
 *   P0  전제 — 흐름 글상자 · 자유변형 켜짐 · 손잡이 12 · nw/ne 중심의 임자가 그 손잡이
 *   L   nw 를 왼쪽으로 20 화면 px(섹션 안) → nw 손잡이가 따라 왼쪽으로 ≈20 · ne 손잡이는 제자리(±1)
 *   O   ne 를 섹션 오른 경계 밖으로 → ★좌표로 찍는다: 손잡이 중심 x > .section-inner 오른쪽 · 그 점의 임자가 손잡이 아님
 *   R   그 상태에서 카드 「밖 모서리 데려오기」 → ne 중심이 섹션 안 · 그 점의 임자가 ne 손잡이 · nw 는 제자리(±1)
 *   U   R 뒤 ⌘Z 한 번 → ne 가 다시 밖(한 걸음)
 * 양성대조: GD1001_ROOT=<핀 ca702d40 사본> 이면 L·R·U 빨강(P0·O 는 초록 = 장면은 선다).
 * ⛔고정 대기 없음 — waitForFunction / expect.poll 만. ⛔앱 무접촉(_root-harness.bootApp).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js ft3-left-drag-and-pullin
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function setup(page) {
  await page.setViewportSize({ width: 1700, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    window.addSection();
    const sec = c.querySelector('.section-block');
    sec.querySelectorAll('.text-block').forEach((t) => (t.closest('.frame-block[data-text-frame]') || t).remove());
    window.selectSection(sec);
    window.addTextBlock('h1', { content: '온풍기 맥스' });
    window.applyZoom?.(40);
    window.__tb = sec.querySelector('.text-block');
    window.__sec = sec;
    /* ★179 ㉠ — 끌기 끝(mouseup) 시각을 페이지가 적는다. clickPullIn 이 이 시각으로 기다린다(아래 FT_CLICK_SWALLOW_CLEAR_MS). */
    document.addEventListener('mouseup', () => { window.__ftUpT = performance.now(); }, true);
    window.__tb.scrollIntoView({ block: 'center' });
    window.selectBlock(window.__tb.id);
  });
  await page.waitForFunction(() => !!document.getElementById('txt-fx-add'));
  await page.selectOption('#txt-fx-add', 'freetransform');
  await page.waitForFunction(() => window.__tb.querySelectorAll('.tfh-handle').length === 12);
  /* ★141 ㉮(지디 07:1x) — setup 끝에서 손잡이 자리가 «연속 두 rAF 같음»으로 멈출 때까지 기다린다(Hs 재사용 · H() 무접촉).
     까닭: applyZoom(40) 이 #canvas-scaler transition 0.15s 로 보간되는 동안 시험 첫 H()(예: R 의 nw0)가 낡은 기준을 잡았다
     (7e98dd1e 240칸 실측 R «nw 제자리» ✘ 4 · nw 움직임 7.3·238.8·61.8·17.9px). nw → ne → nw 다시(첫 nw 와 같은 자리)까지 · 상한 넘으면 FAIL. */
  for (let k = 0; ; k++) {
    const t0 = Date.now();
    const a = await Hs(page, 'nw'), b = await Hs(page, 'ne'), a2 = await Hs(page, 'nw');
    const ok = a?.stable && b?.stable && a2?.stable && Math.abs(a2.x - a.x) < 0.01 && Math.abs(a2.y - a.y) < 0.01;
    if (ok) { if (k || a.frames > 2 || b.frames > 2) console.log(`SETUP-SETTLE rounds=${k + 1} nwFrames=${a.frames} neFrames=${b.frames} ms=${Date.now() - t0}`); break; }
    if (k >= SETTLE_ROUNDS_MAX) throw new Error(`SETUP-NOT-SETTLED — ${SETTLE_ROUNDS_MAX + 1}번 재도 손잡이 자리가 안 멈춤 · nw ${a ? `(${a.x.toFixed(1)},${a.y.toFixed(1)}) stable=${a.stable}` : 'null'} · ne ${b ? `(${b.x.toFixed(1)},${b.y.toFixed(1)}) stable=${b.stable}` : 'null'} · nw 다시 ${a2 ? `(${a2.x.toFixed(1)},${a2.y.toFixed(1)})` : 'null'}`);
  }
  return errs;
}
const SETTLE_ROUNDS_MAX = 4;
const H = (page, name) => page.evaluate((n) => {
  const h = window.__tb.querySelector(`.tfh-handle[data-tfh="${n}"]`);
  if (!h) return null;
  const r = h.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const at = document.elementFromPoint(x, y);
  const inner = (window.__sec.querySelector(':scope > .section-inner') || window.__sec).getBoundingClientRect();
  return { x, y, mine: !!(at && at.dataset && at.dataset.tfh === n), innerL: inner.left, innerR: inner.right };
}, name);
/* ★141(지디 04:50 · 06:0x 확정 · 검사 쪽 · 제품 0) — 누르기 «직전»에 손잡이 자리가 «멈췄고» 그 점의 임자가 그 손잡이인지 보고 누른다.
   까닭(미카사 찾음 · 지디 확정): css/editor-canvas.css #canvas-scaler { transition: transform 0.15s } — setup 의 applyZoom(40) 이 0.15s 보간되는 동안
   H() 가 잰 자리가 낡는다(probe141z · eac99ecd 사본 · 240 누름 중 빗맞힘 15 = 전부 «ⓐ 하네스 조준» · 덮임 0). 옛 drag() 는 H() 의 mine 을 읽고 무시했다.
   ★주 조건 = «rect 두 번 같음»(연속 두 rAF 읽기가 같은 값) — transitionend 는 안 쓴다(안 올 수 있음 · 이미 끝남 · 가려진 창).
   ⛔조용히 통과시키지 않는다 — 상한(PRESS_RETRY_MAX)을 넘으면 HANDLE-MOVED-BEFORE-PRESS 로 이름을 남기고 FAIL.
   ⚠️안 닫힌 칸: 빗맞힘이 ne 에만(15/0) 난 비대칭은 transition(nw·ne 같이 움직임)으로 설명 안 된다 — 재시도를 런마다 PRESS-RETRY 줄로 남긴다. */
const PRESS_RETRY_MAX = 5;
/* 손잡이 rect 가 연속 두 rAF 에서 같을 때까지(최대 60 프레임) 기다렸다가 H() 와 같은 꼴을 돌려준다 · 못 멈추면 stable:false */
const Hs = (page, name) => page.evaluate((n) => new Promise((res) => {
  let last = null, k = 0;
  const tick = () => {
    const h = window.__tb.querySelector(`.tfh-handle[data-tfh="${n}"]`);
    if (!h) { res(null); return; }
    const r = h.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const same = last && Math.abs(last.x - x) < 0.01 && Math.abs(last.y - y) < 0.01;
    last = { x, y }; k++;
    if (same || k > 60) {
      const at = document.elementFromPoint(x, y);
      const inner = (window.__sec.querySelector(':scope > .section-inner') || window.__sec).getBoundingClientRect();
      res({ x, y, mine: !!(at && at.dataset && at.dataset.tfh === n), innerL: inner.left, innerR: inner.right, stable: !!same, frames: k });
    } else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}), name);
async function drag(page, name, dx, dy) {
  const t0 = Date.now();
  let h = await Hs(page, name), tries = 0; const first = h;
  for (;;) {
    if (h && h.stable && h.mine) {
      await page.mouse.move(h.x, h.y);
      const now = await Hs(page, name);   /* 누르기 직전 — 다시 멈춤 + 임자 + 같은 자리 */
      if (now && now.stable && now.mine && Math.abs(now.x - h.x) < 0.5 && Math.abs(now.y - h.y) < 0.5) break;
      h = now || h;
    } else {
      h = (await Hs(page, name)) || h;
    }
    tries++;
    if (tries > PRESS_RETRY_MAX) {
      throw new Error(`HANDLE-MOVED-BEFORE-PRESS ${name} — ${PRESS_RETRY_MAX}번 다시 재도 누르기 직전 «멈춤·임자·같은 자리»가 안 맞음 · 처음 ${first ? `(${first.x.toFixed(1)},${first.y.toFixed(1)}) stable=${first.stable} mine=${first.mine}` : 'null'} · 마지막 ${h ? `(${h.x.toFixed(1)},${h.y.toFixed(1)}) stable=${h.stable} mine=${h.mine}` : 'null'}`);
    }
  }
  if (tries || first.frames > 2) console.log(`PRESS-RETRY ${name} tries=${tries} firstFrames=${first.frames} ms=${Date.now() - t0} first=(${first.x.toFixed(1)},${first.y.toFixed(1)}) pressed=(${h.x.toFixed(1)},${h.y.toFixed(1)})`);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(h.x + dx * i / 10, h.y + dy * i / 10);
  await page.mouse.up();
  await page.waitForFunction(() => window.__tb.querySelectorAll('.tfh-handle').length === 12);
}

test('P0 전제 — 흐름 글상자 · 손잡이 12 · nw/ne 중심의 임자가 그 손잡이', async ({ page }) => {
  const errs = await setup(page);
  const flow = await page.evaluate(() => getComputedStyle(window.__tb.closest('.frame-block[data-text-frame]')).position);
  expect(flow).toBe('relative');
  expect((await H(page, 'nw')).mine).toBe(true);
  expect((await H(page, 'ne')).mine).toBe(true);
  expect(errs).toEqual([]);
});

test('L nw 를 왼쪽으로(섹션 안 여유의 절반) → nw 가 따라가고 ne 는 제자리', async ({ page }) => {
  const errs = await setup(page);
  const nw0 = await H(page, 'nw'), ne0 = await H(page, 'ne');
  const dx = -Math.floor((nw0.x - nw0.innerL) / 2);   /* 섹션 안 여유의 절반 — 밖으로 안 나가게 */
  expect(dx, '전제: 왼쪽에 끌 여유가 있다').toBeLessThanOrEqual(-5);
  await drag(page, 'nw', dx, 0);
  await expect.poll(async () => Math.round((await H(page, 'nw')).x - nw0.x)).toBeLessThanOrEqual(dx + 2);
  const nw1 = await H(page, 'nw'), ne1 = await H(page, 'ne');
  expect(nw1.x - nw0.x).toBeGreaterThanOrEqual(dx - 2);
  expect(Math.abs(ne1.x - ne0.x)).toBeLessThanOrEqual(1);
  expect(errs).toEqual([]);
});

/* 끌기를 놓은 뒤 패널이 한 번 다시 그려진다 — 그 전에 누르면 곧 바뀔 단추를 누른다(실측: 3번 중 1~2번 핸들러 0회).
   ⇒ «같은 단추 요소가 두 프레임 넘게 산다»를 조건으로 기다린다(⛔고정 대기 아님). */
/* ★179 ㉠(FT3-PULLIN-NE-NOT-BACK-01 · 지디 확정) — 손잡이 끌기 onUp 이 문서 capture 에 killClick 을 120ms 건다
   (js/effects-ft-handles.js · FT-DRAG-RELEASE-DESELECTS-01). 그 창 안의 click 은 «대상이 무엇이든» 삼켜진다 —
   실측(S5 probe179f/g/h): 데려오기가 안 먹은 8/8 이 mouseup→click 89~122ms · 먹은 104/104 는 ≥124.8ms.
   제품이 그 창 상태를 안 드러내 «mouseup 뒤 150ms»(120 + setTimeout 늦음 여유 30)를 조건으로 기다린다 — ⛔고정 대기 아님(이미 지났으면 바로 간다). */
const FT_CLICK_SWALLOW_CLEAR_MS = 150;
async function clickPullIn(page) {
  await page.waitForFunction((ms) => window.__ftUpT == null || performance.now() - window.__ftUpT >= ms, FT_CLICK_SWALLOW_CLEAR_MS);
  await page.evaluate(() => document.getElementById('txt-fxft-body')?.removeAttribute('hidden'));
  await page.waitForFunction(() => new Promise((res) => {
    const b = document.getElementById('txt-fxft-pullin');
    if (!b) return res(false);
    b.__s5mk = (b.__s5mk || 0) + 1;
    requestAnimationFrame(() => requestAnimationFrame(() => res(document.getElementById('txt-fxft-pullin') === b && b.__s5mk >= 2)));
  }));
  await page.click('#txt-fxft-pullin');
}

async function pushNeOut(page) {
  const ne0 = await H(page, 'ne');
  await drag(page, 'ne', ne0.innerR - ne0.x + 60, 0);
  return H(page, 'ne');
}

test('O ne 를 섹션 밖으로 — 좌표로: 중심 x > 섹션 오른쪽 · 그 점의 임자가 손잡이 아님', async ({ page }) => {
  const errs = await setup(page);
  const ne = await pushNeOut(page);
  expect(ne.x).toBeGreaterThan(ne.innerR + 30);
  expect(ne.mine).toBe(false);
  expect(errs).toEqual([]);
});

test('R 「밖 모서리 데려오기」 → ne 가 섹션 안 · 그 점의 임자가 ne · nw 제자리', async ({ page }) => {
  const errs = await setup(page);
  const nw0 = await H(page, 'nw');
  const out = await pushNeOut(page);
  expect(out.x, '전제: 정말 밖이다').toBeGreaterThan(out.innerR + 30);
  await clickPullIn(page);
  await expect.poll(async () => (await H(page, 'ne')).x <= out.innerR).toBe(true);
  const ne1 = await H(page, 'ne'), nw1 = await H(page, 'nw');
  expect(ne1.mine).toBe(true);
  expect(Math.abs(nw1.x - nw0.x)).toBeLessThanOrEqual(1);
  expect(errs).toEqual([]);
});

test('U 데려온 뒤 ⌘Z 한 번 → ne 가 다시 밖', async ({ page }) => {
  const errs = await setup(page);
  const out = await pushNeOut(page);
  await clickPullIn(page);
  await expect.poll(async () => (await H(page, 'ne')).x <= out.innerR).toBe(true);
  await page.evaluate(() => { document.activeElement?.blur?.(); window.undo(); });
  await page.waitForFunction(() => (window.__tb.dataset.tfCorners || '').split(',').length === 8);
  await expect.poll(async () => {
    const c = await page.evaluate(() => window.__tb.dataset.tfCorners.split(',').map(Number));
    return c[2] > 800;
  }).toBe(true);
  expect(errs).toEqual([]);
});
