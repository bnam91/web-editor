/* free-frame-grid-width-roundtrip.dom.spec.js — F3 후속 (적대QA 2026-10-03: c2d57466 이 깨졌다)
 * 증상: 입구가 «자동으로» 넣은 폭이 data-grid-width 에 남아, 프레임을 떠나도 좁고, 더 작은 프레임을 거치면 더 줄고 다시 안 커졌다.
 *   진짜 마우스 섹션→764→섹션→400→섹션→764→섹션 = 611·611·320·320·320·320 (bf9161d0 은 섹션에서 매번 100%).
 * 처방: 자동 출처 표시(data-grid-width-auto, 값 없음 — 폭은 키 하나) + 옮긴 뒤 syncAutoGridWidth(떠나면 100%, 들어가면 그 프레임 × 0.8).
 * R1 왕복 수열 · R2 사용자 폭은 왕복해도 그대로 · R3 편집 10번 → ⌘Z 10번이 한 걸음씩.
 * 양성대조 핀 c2d57466: R1 빨강(섹션 복귀 때 611 이 남는다) · R2·R3 는 기록만(커밋 메시지).
 * 하네스 = bootApp. 배율 100% 를 첫 전제로 단언한다.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SEC = `<div class="section-block" id="sR" data-section="1" data-name="sR"><div class="section-hitzone"></div><div class="section-inner" id="innerR">
  <div class="gap-block" data-type="gap" style="height:20px"></div>
  <div class="frame-block" id="frA" data-free-layout="true" style="position:relative;width:764px;height:240px;margin:0 auto;background:#eef"></div>
  <div class="gap-block" data-type="gap" style="height:20px"></div>
  <div class="frame-block" id="frB" data-free-layout="true" style="position:relative;width:400px;height:240px;margin:0 auto;background:#efe"></div>
  <div class="gap-block" data-type="gap" style="height:20px"></div>
  <div id="flowSlot"></div>
  <div class="gap-block" data-type="gap" id="tailGap" style="height:260px"></div></div></div>`;

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1400 });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await bootApp(page);
  await page.evaluate((html) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', html); window.rebindAll?.(); window.deselectAll?.();
    window.applyZoom?.(100);
  }, SEC);
  await page.waitForTimeout(400);
  await page.evaluate(() => document.getElementById('sR').scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.currentZoom), '전제 — 배율 100%').toBe(100);
  const id = await page.evaluate(() => {
    const { row, block } = window.makeGridBlock({});
    document.getElementById('flowSlot').replaceWith(row); window.bindBlock(block); window.rebindAll?.();
    return block.id;
  });
  await page.waitForTimeout(150);
  return { errs, id };
}

const st = (page, id) => page.evaluate((id) => {
  const g = document.getElementById(id);
  const fr = g.closest('.frame-block[data-free-layout="true"]');
  return { where: fr ? fr.id : 'sec', w: g.offsetWidth, key: g.dataset.gridWidth ?? null, auto: g.dataset.gridWidthAuto ?? null,
           /* 섹션 «내용 폭» — 패딩을 뺀다(⌘Z 복원판엔 앱이 section-inner 에 padding 32 를 인라인으로 싣는다 · 실측) */
           secW: (() => { const i = document.getElementById('innerR'), cs = getComputedStyle(i); return i.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight); })(),
           css: g.style.width, gap: g.dataset.gap };
}, id);
const center = (page, sel) => page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r]; }, sel);

/* 섹션 흐름 → 프레임: HTML5 끌어넣기(진짜 마우스) */
async function dropInto(page, id, frId) {
  await page.evaluate((id) => { window.deselectAll?.(); window.selectBlock?.(id); }, id);
  const s = await page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + 40, r.top + r.height / 2]; }, id);
  const d = await page.evaluate((f) => { const r = document.getElementById(f).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height - 30]; }, frId);
  await page.mouse.move(s[0], s[1]); await page.mouse.down();
  for (let i = 1; i <= 16; i++) await page.mouse.move(s[0] + (d[0] - s[0]) * i / 16, s[1] + (d[1] - s[1]) * i / 16);
  await page.waitForTimeout(100); await page.mouse.up(); await page.waitForTimeout(350);
}
/* 프레임 → 섹션: 자유 드래그 끌어내기(진짜 마우스, 섹션 꼬리 여백으로) */
async function dragOut(page, id) {
  await page.evaluate((id) => { window.deselectAll?.(); window.selectBlock?.(id); }, id);
  await page.waitForTimeout(80);
  const s = await page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + 40, r.top + r.height / 2]; }, id);
  const [tx, ty] = await center(page, '#tailGap');
  await page.mouse.move(s[0], s[1]); await page.mouse.down();
  for (let i = 1; i <= 20; i++) await page.mouse.move(s[0] + (tx - s[0]) * i / 20, s[1] + (ty - s[1]) * i / 20);
  await page.waitForTimeout(100); await page.mouse.up(); await page.waitForTimeout(350);
}

const STEPS = [['in', 'frA'], ['out'], ['in', 'frB'], ['out'], ['in', 'frA'], ['out']];
async function step(page, id, s) { if (s[0] === 'in') await dropInto(page, id, s[1]); else await dragOut(page, id); }

test('R1 ★왕복 수열 — 섹션에선 매번 100%(키 없음), 프레임에선 그 프레임 × 0.8', async ({ page }) => {
  const { errs, id } = await setup(page);
  const s0 = await st(page, id);
  expect(s0, '전제 — 섹션 흐름 100%').toMatchObject({ where: 'sec', key: null, w: s0.secW });
  const seq = [];
  for (const s of STEPS) {
    await step(page, id, s);
    const x = await st(page, id);
    seq.push(`${x.where}:${x.w}`);
    if (s[0] === 'in') {
      expect(x.where, `전제 — ${s[1]} 에 들어갔다 · 수열 ${seq.join(' ')}`).toBe(s[1]);
      const fcw = await page.evaluate((f) => document.getElementById(f).clientWidth, s[1]);
      expect(x.w, `★${s[1]} 안 폭 · 수열 ${seq.join(' ')}`).toBe(Math.round(fcw * 0.8));
    } else {
      expect(x.where, `전제 — 섹션으로 나왔다 · 수열 ${seq.join(' ')}`).toBe('sec');
      expect({ w: x.w, key: x.key, auto: x.auto }, `★섹션인데 좁다 · 수열 ${seq.join(' ')}`).toEqual({ w: x.secW, key: null, auto: null });
    }
  }
  expect(errs).toEqual([]);
});

test('R2 사용자 지정 폭(updateGridBlock width 300)은 왕복해도 그대로 · 자동 표시가 안 붙는다', async ({ page }) => {
  const { errs, id } = await setup(page);
  const r = await page.evaluate((id) => window.updateGridBlock(id, { width: 300 }), id);
  expect(r.ok).toBe(true);
  const seq = [];
  for (const s of STEPS) {
    await step(page, id, s);
    const x = await st(page, id);
    seq.push(`${x.where}:${x.w}`);
    expect(x.where, `전제 — 옮겨졌다 · ${seq.join(' ')}`).toBe(s[0] === 'in' ? s[1] : 'sec');
    expect({ w: x.w, key: x.key, auto: x.auto }, `★사용자 폭이 바뀌었다 · ${seq.join(' ')}`).toEqual({ w: 300, key: '300', auto: null });
  }
  expect(errs).toEqual([]);
});

test('R3 편집 10번(옮기기 6 · 간격 4) → ⌘Z 10번이 한 걸음씩 정확히 돌아간다', async ({ page }) => {
  test.setTimeout(90000);
  const { errs, id } = await setup(page);
  await page.evaluate(() => window.pushHistory?.('판'));
  const snaps = [await st(page, id)];
  const edits = [STEPS[0], ['gap', 10], STEPS[1], ['gap', 12], STEPS[2], ['gap', 14], STEPS[3], STEPS[4], ['gap', 16], STEPS[5]];
  for (const e of edits) {
    if (e[0] === 'gap') await page.evaluate(([id, v]) => window.updateGridBlock(id, { gap: v }), [id, e[1]]);
    else await step(page, id, e);
    snaps.push(await st(page, id));
  }
  expect(new Set(snaps.map(s => JSON.stringify([s.where, s.key, s.gap]))).size, '전제 — 열 걸음이 서로 다른 상태다(되돌림을 가를 수 있다)').toBe(11);
  await page.evaluate(() => document.activeElement?.blur?.());
  for (let i = 10; i >= 1; i--) {
    await page.keyboard.press('Meta+z'); await page.waitForTimeout(250);
    /* ★모델로 견준다(어디·키·표시·간격·style 폭) + 섹션이면 «내용 폭을 다 쓰나». 픽셀 w 는 섹션 패딩(앱 몫)에 따라 달라 직접 안 견준다. */
    const now = await st(page, id), pick = (x) => ({ where: x.where, key: x.key, auto: x.auto, gap: x.gap, css: x.css });
    expect(pick(now), `⌘Z ${11 - i}번째 — 걸음 ${i - 1} 상태로`).toEqual(pick(snaps[i - 1]));
    if (now.where === 'sec') expect(now.w, `⌘Z ${11 - i}번째 — 섹션 내용 폭을 다 쓴다`).toBe(now.secW);
  }
  expect(errs).toEqual([]);
});
