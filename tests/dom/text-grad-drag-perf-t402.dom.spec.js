/* text-grad-drag-perf-t402.dom.spec.js — t4-02 측정용(★기본 건너뜀 · T402_PERF=1 일 때만 돈다 · 단언 없음, 수만 찍는다).
 *   지디 «좁히고 재라»: 79d9c80b1 감시자는 프레임을 끄는 틱마다 하위 그라데이션 글자 전부를 다시 쟀다.
 *   장면(합성): 섹션 150 · 글 블록 600 · 그중 그라데이션 100(흩어진 60 + 큰 프레임 안 40). 큰 프레임을 진짜 마우스로 60 걸음 끈다.
 *   잰 것: 칠 구간 잼 횟수(Range.getClientRects · 끄는 동안/전체) · longtask(PerformanceObserver · ≥50 / ≥100 개수) · CDP Performance ScriptDuration 증분(끄는 동안 · ms).
 *   전/후 비교는 js/props/text-block-color.js 를 130a18491 판으로 바꿔 같은 스펙을 한 번 더 돌린다(--workers=1). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

test('PERF t4-02 큰 프레임 끌기 60 걸음 — longtask · 스크립트 ms', async ({ page }) => {
  test.skip(!process.env.T402_PERF, '측정 전용 — T402_PERF=1 로 돌린다');
  test.setTimeout(180000);
  await page.setViewportSize({ width: 1600, height: 1400 });
  const errs = await bootApp(page);
  const info = await page.evaluate(() => {
    const G = { css: 'linear-gradient(90deg, #cc2244 0%, #1144aa 100%)' };
    const TX = (s, grad) => {
      const { block: tb } = window.makeTextBlock('body'); const tf = window._makeTextFrame(); window.applyTextOpts(tb, tf, {}, 'body'); tf.appendChild(tb);
      tb.querySelector('[class^="tb-"]').textContent = s;
      return { tf, tb, grad };
    };
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    const grads = [];
    const mkSec = () => { const s = document.createElement('div'); s.className = 'section-block'; s.dataset.section = '1'; s.innerHTML = '<div class="section-hitzone"></div><div class="section-inner"></div>'; c.appendChild(s); return s.querySelector('.section-inner'); };
    // 섹션 0: 바깥 자유 프레임 안에 큰 프레임(자유 · absolute) · 글 40 개 전부 그라데이션
    const in0 = mkSec();
    const outer = window.makeFrameBlock({}); outer.id = 'pOuter'; outer.style.height = '1300px'; in0.appendChild(outer);
    const big = window.makeFrameBlock({}); big.id = 'pBig';
    Object.assign(big.style, { position: 'absolute', left: '20px', top: '20px', width: '700px', height: '1200px' });
    outer.appendChild(big);
    for (let k = 0; k < 40; k++) {
      const t = TX('큰 프레임 그라데이션 글 ' + k, true);
      Object.assign(t.tf.style, { position: 'absolute', left: (k % 2) * 340 + 10 + 'px', top: Math.floor(k / 2) * 55 + 10 + 'px' });
      big.appendChild(t.tf); grads.push(t.tb);
    }
    // 나머지 섹션 149 개 × 글 4 개(= 596) — 앞 60 개 섹션의 첫 글이 그라데이션
    let n = 40;
    for (let s = 1; s < 150; s++) {
      const inner = mkSec();
      for (let k = 0; k < 4 && n < 600; k++, n++) {
        const row = document.createElement('div'); row.className = 'row'; row.dataset.layout = 'stack';
        const t = TX('채움 글 ' + s + '-' + k + ' '.repeat(1) + '내용 '.repeat(8), s <= 60 && k === 0);
        row.appendChild(t.tf); inner.appendChild(row); if (t.grad) grads.push(t.tb);
      }
    }
    grads.forEach(tb => window.applyTextGradient(tb, G));
    window.rebindAll?.(); window.deselectAll?.(); window.applyZoom?.(100);
    big.scrollIntoView({ block: 'start' });
    return { secs: c.querySelectorAll('.section-block').length, texts: c.querySelectorAll('.text-block').length, grads: c.querySelectorAll('[style*="background-clip"]').length };
  });
  console.log('[scene] ' + JSON.stringify(info));
  const settle = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  for (let i = 0; i < 5; i++) await settle();
  // 자식 프레임은 부모에 «진입»하기 전엔 덮개 아래라 안 맞는다(css .frame-entered) — 바깥 프레임 빈 자리를 진짜로 더블클릭
  const po = await page.evaluate(() => { const r = document.getElementById('pOuter').getBoundingClientRect(); return [r.right - 30, r.bottom - 30]; });
  await page.mouse.dblclick(po[0], po[1]);
  await expect.poll(() => page.evaluate(() => document.getElementById('pOuter').classList.contains('frame-entered')), { message: '[전제] 바깥 프레임에 진입했다' }).toBe(true);
  for (let i = 0; i < 3; i++) await settle();
  const p = await page.evaluate(() => {   // 큰 프레임 «자신»이 맞는 빈 자리(글 사이)를 찾는다
    const b = document.getElementById('pBig'), r = b.getBoundingClientRect();
    for (let y = r.top + 5; y < Math.min(r.bottom, innerHeight) - 5; y += 7) for (let x = r.left + 5; x < r.right - 5; x += 13) if (document.elementFromPoint(x, y) === b) return [x, y];
    return null;
  });
  expect(p, '[전제] 큰 프레임 빈 자리').not.toBe(null);
  const left0 = await page.evaluate(() => document.getElementById('pBig').style.left);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const metric = async () => { const { metrics } = await cdp.send('Performance.getMetrics'); const o = {}; for (const m of metrics) o[m.name] = m.value; return o; };
  await page.mouse.move(p[0], p[1]);
  await page.evaluate(() => { window.__lt = []; window.__lo = new PerformanceObserver(l => window.__lt.push(...l.getEntries().map(e => Math.round(e.duration)))); window.__lo.observe({ type: 'longtask' });
    window.__rc = 0; const o = Range.prototype.getClientRects; Range.prototype.getClientRects = function () { window.__rc++; return o.call(this); }; });   // 칠 구간 잼 횟수(_textSpanX)
  const m0 = await metric();
  await page.mouse.down();
  for (let k = 1; k <= 60; k++) await page.mouse.move(p[0] + k, p[1] + k);
  const m1 = await metric();
  const mid = await page.evaluate(() => [document.getElementById('pBig').style.left, window.__rc]);
  await page.mouse.up();
  for (let i = 0; i < 3; i++) await settle();
  const m2 = await metric();
  const lt = await page.evaluate(() => [...window.__lt, ...window.__lo.takeRecords().map(e => Math.round(e.duration))]);
  const left1 = await page.evaluate(() => document.getElementById('pBig').style.left);
  const r = {
    moved: [left0, mid[0], left1], rangeMeasuresDrag: mid[1], rangeMeasuresTotal: await page.evaluate(() => window.__rc),
    longtask50: lt.filter(d => d >= 50).length, longtask100: lt.filter(d => d >= 100).length, lt,
    scriptMsDrag: Math.round((m1.ScriptDuration - m0.ScriptDuration) * 1000), taskMsDrag: Math.round((m1.TaskDuration - m0.TaskDuration) * 1000),
    scriptMsDrop: Math.round((m2.ScriptDuration - m1.ScriptDuration) * 1000), layoutMsDrag: Math.round((m1.LayoutDuration - m0.LayoutDuration) * 1000),
  };
  console.log('[perf] ' + JSON.stringify(r));
  expect(mid[0], '[전제] 끄는 동안 큰 프레임이 실제로 움직였다').not.toBe(left0);
  expect(errs, errs.join(' | ')).toEqual([]);
});
