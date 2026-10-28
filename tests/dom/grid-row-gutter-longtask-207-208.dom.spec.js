/* grid-row-gutter-longtask-207-208.dom.spec.js — 시트 207 ROW-GUTTER-PRESS-RELEASE-STILL-LONGTASK-01 · 208 GRID-DRAG-MOVE-STILL-TEN-LONGTASKS-01
 *   지디 실측(261028 · 앱 · 수지 저장본 · 판 5 벌 번갈아 ×3): 누름 1.24s · 놓음 1.09s · 끄는 5 걸음에 longtask 10. 130·132·165 를 다 넣고도 남는다.
 * ★이 spec 은 «고침» 이 아니라 «자 + 래칫» 이다(지디 처방 ⑴⑵): 지금 개수를 명부(LT_BASE)에 박고 · 오르면 빨강 · 내려가면 명부를 내리라고 찍는다.
 * ★장면 — ⛔수지 저장본은 못 싣는다(남의 데이터 · 커밋 불가) ⇒ 합성: 섹션 SEC_N 개 × 글 블록 SEC_K 개(채움) + 2×2 그리드 하나.
 *   SEC_N = 300 — 하네스에서 잰 값(261028 · 809d7cf5): 80 이면 놓음이 0(50ms 밑) · 300 이면 누름·놓음·끄는 걸음 셋 다 선다.
 *   ⚠️그리드는 작다(앱 장면도 2행 4칸 13 노드) — 무게는 «문서 전체» 다. 명부 수는 이 합성 장면의 수다(앱의 10 과 같은 수가 아니다).
 * 칸
 *   L0 [전제] 자가 본다 — 일부러 120ms 막기 한 번 = 1 · 그 앞 쉬는 동안 0
 *   L1 ★누름(207) · L2 ★끄는 5 걸음(208) · L3 ★놓음(207) — 단계별 개수 ≤ LT_BASE
 *   N1 [음성대조] 누르고 안 끌고 놓음 — 끄는 단계 0 · 놓음 0(안 움직이면 정본 렌더·끝 표본 둘 다 없다 · overlay-handles.js onUp)
 * 양성대조(보고서): 사본에서 onMove 에 pushHistory 한 줄(걸음마다 직렬화 = 무겁게) ⇒ L2 빨강.
 * ⛔고정 대기 0 — 단계는 rAF 두 번으로 닫는다. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const LT = require('./_longtask.js');

const SEC_N = 300, SEC_K = 20;
/* ★명부 — 두 수를 나란히(지디 261028) · ⛔둘을 섞어 견주지 마라
 *   ← 래칫(이 spec 이 단언): 합성 장면 섹션 300 × 글 블록 20 · 3.9MB · 노드 24,916 · 809d7cf5 하네스 ×3(LT_FLOOR_MS 100) = 누름 1 · 끄는 5 걸음 5 · 놓음 1
 *   ← 사용자 수(단언 안 함): 앱 · 수지 저장본 · 지디 261028 = 끄는 5 걸음 longtask 10 (누름 1.24s · 놓음 1.09s) */
const LT_BASE = { down: 1, move: 5, up: 1 };

async function setup(page) {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1600, height: 1400 });
  const errs = await bootApp(page);
  const info = await page.evaluate(([N, K]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="dS" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:60px"></div><div class="row" id="dR" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:400px"></div></div></div>');
    const L = (t) => [{ type: 'body', text: t + ' 첫줄' }, { type: 'body', text: t + ' 둘째' }];
    const { block: g } = window.makeGridBlock({ cols: [{ width: 1, lines: L('A') }, { width: 1, lines: L('B') }], rows: [{ height: 120 }, { height: 'auto' }] });
    g.id = 'dG'; document.getElementById('dR').appendChild(g);
    const sec = document.createElement('div'); sec.className = 'section-block'; sec.dataset.section = '1';
    sec.innerHTML = '<div class="section-hitzone"></div><div class="section-inner"></div>';
    for (let k = 0; k < K; k++) {
      const row = document.createElement('div'); row.className = 'row'; row.dataset.layout = 'stack';
      const { block: tb } = window.makeTextBlock('body'); const tf = window._makeTextFrame(); window.applyTextOpts(tb, tf, {}, 'body'); tf.appendChild(tb);
      tb.querySelector('[class^="tb-"]').textContent = '채움 글 '.repeat(40);
      row.appendChild(tf); sec.querySelector('.section-inner').appendChild(row);
    }
    for (let n = 0; n < N; n++) { const s = sec.cloneNode(true); s.id = 'fS' + n; s.querySelectorAll('[id]').forEach((e, i) => { e.id = `f${n}_${i}`; }); c.appendChild(s); }
    window.rebindAll?.(); window.renderGridBlock(g); window.deselectAll?.(); window.applyZoom?.(100); g.scrollIntoView({ block: 'center' });
    return { secs: c.querySelectorAll('.section-block').length, html: c.innerHTML.length };
  }, [SEC_N, SEC_K]);
  expect(info.secs, '[전제] 무거운 장면이 섰다').toBe(SEC_N + 1);
  await page.waitForFunction(() => !!document.querySelector('#dG .grd-cell'));
  /* ★클릭 자리는 칸 자리가 선 «뒤»에 잰다 · 거터 기다림은 한도 있는 이름 붙은 기다림이다.
     실측 261028: 자리 안 기다리고 찍던 판은 18 번 중 3 번 클릭 뒤 거터가 안 서서 waitForFunction 이 시험 한도(120s)까지 멈췄다.
     왜 안 섰는지(빗나간 클릭인지)는 재지 않았다 — 이 두 줄은 그 뒤 ×N 으로 «다시 안 나는가» 만 잰다(보고서). */
  await waitStableRect(page, '#dG .grd-cell [data-line]');
  const p = await page.evaluate(() => { const r = document.querySelector('#dG .grd-cell [data-line]').getBoundingClientRect(); return [r.left + 10, r.top + r.height / 2]; });
  await page.mouse.click(p[0], p[1]);
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('#ss-handles-overlay .grd-gutter').length), { message: '[전제] 그리드를 골라 거터가 섰다', timeout: 15000 }).toBeGreaterThan(0);
  await waitStableRect(page, '#dG');
  const g = await page.evaluate(() => { const e = [...document.querySelectorAll('#ss-handles-overlay .grd-gutter')].find(x => getComputedStyle(x).cursor === 'row-resize' && x.offsetParent); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  expect(g, '[전제] 행 거터가 섰다').not.toBe(null);
  await LT.start(page);
  return { errs, g, info };
}

/* 누름 → (끄는 5 걸음 | 그대로) → 놓음. 단계마다 rAF 두 번으로 닫는다. */
async function gesture(page, g, { drag = true } = {}) {
  await LT.settle(page); await LT.mark(page, 'idle'); await LT.settle(page);
  await LT.mark(page, 'down'); await page.mouse.move(g.x, g.y); await page.mouse.down(); await LT.settle(page);
  const h0 = await page.evaluate(() => document.getElementById('dG').dataset.rows);
  await LT.mark(page, 'move');
  for (let k = 1; k <= 5; k++) { if (drag) await page.mouse.move(g.x, g.y + 3 * k); await LT.settle(page); }
  const h1 = await page.evaluate(() => document.getElementById('dG').dataset.rows);
  await LT.mark(page, 'up'); await page.mouse.up(); await LT.settle(page);
  await LT.mark(page, 'end');
  return { lt: await LT.count(page), rowsChanged: h0 !== h1 };
}

test('L0 [전제] 자가 본다 — 120ms 막기 한 번 = 1 · 쉬는 동안 0', async ({ page }) => {
  const { errs } = await setup(page);
  await LT.settle(page); await LT.mark(page, 'idle'); await LT.settle(page);
  await LT.mark(page, 'ctl');
  await page.evaluate(() => new Promise(r => setTimeout(() => { const t = performance.now(); while (performance.now() - t < 120); r(true); }, 0)));
  await LT.settle(page); await LT.mark(page, 'end');
  const lt = await LT.count(page);
  console.log('[L0] ' + JSON.stringify(lt));
  expect(lt.idle.n, '쉬는 동안 0').toBe(0);
  expect(lt.ctl.n, `★120ms 막기 = 1 (${lt.ctl.ms})`).toBe(1);
  expect(errs).toEqual([]);
});

test('L1·L2·L3 ★행 거터 누름·끄는 5 걸음·놓음 — 단계별 longtask 개수가 명부를 넘지 않는다(207·208 래칫)', async ({ page }) => {
  const { errs, g, info } = await setup(page);
  const { lt, rowsChanged } = await gesture(page, g);
  console.log('[L] ' + JSON.stringify({ info, floor: LT.LT_FLOOR_MS, base: LT_BASE, lt }));
  expect(rowsChanged, '[전제] 끄는 동안 행 높이(dataset.rows)가 바뀌었다').toBe(true);
  for (const k of ['down', 'move', 'up']) {
    expect(lt[k].n, `★${k} longtask(≥${LT.LT_FLOOR_MS}ms) ${lt[k].n} 개 — 명부 ${LT_BASE[k]} 를 넘었다 (${lt[k].ms})`).toBeLessThanOrEqual(LT_BASE[k]);
    if (lt[k].n < LT_BASE[k]) console.log(`[래칫] ⚠️${k} ${lt[k].n} 로 줄었다(명부 ${LT_BASE[k]}) ⇒ LT_BASE.${k} 를 ${lt[k].n} 로 내려라`);
  }
  expect(errs).toEqual([]);
});

test('N1 [음성대조] 누르고 안 끌고 놓음 — 끄는 단계 0 · 놓음 0', async ({ page }) => {
  const { errs, g } = await setup(page);
  const { lt, rowsChanged } = await gesture(page, g, { drag: false });
  console.log('[N1] ' + JSON.stringify(lt));
  expect(rowsChanged, '[전제] 안 끌었다 = 행 높이 그대로').toBe(false);
  expect(lt.move.n, `끄는 단계 (${lt.move.ms})`).toBe(0);
  expect(lt.up.n, `놓음 (${lt.up.ms})`).toBe(0);
  expect(errs).toEqual([]);
});
