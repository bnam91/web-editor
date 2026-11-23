/* vector-dup-id — VECTOR-DUP-ID-AFTER-OVERLAY-UNDO-01(지디 261119 실앱 · 0.9.13 125행): 떠 있는 벡터가 같은 id 로 같은 섹션에 2개(위치 다름 · 저장본에도 2개).
 * 뿌리(실측으로 확인할 가설): 떠 있는 것을 끄는 «도중» 캔버스가 통째로 갈리면(⌘Z · 다시 그리기) 끌기 손잡이(overlay-float.js bindFloatMoveDrag)는
 *   옛(떨어져 나간) posEl·옛 섹션을 쥔 채 남는다 → 다음 움직임에서 «지금 커서 아래 섹션 ≠ 옛 섹션»이라 hover.appendChild(옛 posEl) = 되살아난 사본이 라이브 섹션에 붙는다.
 * D1 떠 있는 벡터를 끄는 도중 ⌘Z → 계속 끌고 놓기 → 같은 id 하나 · 저장본(getSerializedCanvas)에도 하나
 * 양성대조: _patches/vecdup-CTL.patch ⇒ D1 빨강.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/* 고정 대기 0(dom-fixed-wait-census · cand7 t11) — 요소 상자가 두 rAF 동안 같을 때까지 */
const stable = (page, sel) => expect.poll(() => page.evaluate(async (sel) => {
  const m = () => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map((v) => v.toFixed(1)).join(','); };
  const a = m(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); const b = m();
  return !!a && a === b;
}, sel), { message: `[전제] ${sel} 멎음` }).toBe(true);
const SVG = '<svg viewBox="0 0 24 24"><rect x="0" y="0" width="24" height="24" fill="currentColor"/></svg>';

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate((svg) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="vS" data-section="1"><div class="section-hitzone"></div><div class="section-inner" data-padding-x="40" style="padding-left:40px;padding-right:40px">
      <div class="gap-block" data-type="gap" style="height:80px"></div><div id="vHost"></div><div class="gap-block" data-type="gap" style="height:500px"></div></div></div>`);
    const { row, block } = window.makeVectorBlock({ svg, color: '#ff0000', w: 80, h: 80 });
    block.id = 'vV'; row.id = 'vR';
    document.getElementById('vHost').replaceWith(row); window.rebindAll?.();
    window.deselectAll?.(); document.getElementById('vS').scrollIntoView({ block: 'start' });
  }, SVG);
  await page.waitForFunction(() => (document.querySelector('#vV svg')?.clientWidth || 0) > 0);   // 그림이 그려졌다
  await stable(page, '#vV');
  return errs;
}
const count = (page) => page.evaluate(() => ({ dom: document.querySelectorAll('#canvas [id="vV"]').length, saved: (window.getSerializedCanvas?.() || '').split('id="vV"').length - 1 }));

test('D1 떠 있는 벡터 끄는 도중 ⌘Z → 계속 끌고 놓아도 같은 id 하나(DOM · 저장본)', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => { const OF = window.OverlayFloat; window.clearHistory?.(); OF.enterFloat(OF.posElOf(document.getElementById('vV'))); window.deselectAll?.(); window.pushHistory?.('떠 있음'); });   // ★전제 바뀜(아이맥 3f63b1b58 — 옛 판은 clear «뒤» push 가 무변화로 버려져 이력 0 = ⌘Z 무동작 = 무효 음성) ⇒ clear(흐름) → 띄움 → push = 되돌릴 일 1칸
  await stable(page, '#vV');
  const c0 = await count(page);
  expect(await page.evaluate(() => window.getHistoryTip?.()?.canUndo), '[전제] 되돌릴 일이 있다(canUndo) — 없으면 ⌘Z 가 무동작이라 이 칸은 아무것도 못 잰다').toBe(true);
  const [x, y] = await page.evaluate(() => { const r = document.getElementById('vV').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 40, y + 30, { steps: 5 });
  const mid = await count(page);
  await page.evaluate(() => { window.__old = { sec: document.getElementById('vS'), v: document.getElementById('vV'), tip: JSON.stringify(window.getHistoryTip?.() ?? null) }; });   // «⌘Z 가 먹었나» 표식(지디 261123 — 아이맥 1차 c1=1 · afterUndo=mid 라 못 가름)
  await page.keyboard.press('Meta+z');
  const afterUndo = await count(page);
  const ate = await page.evaluate(() => ({ secReplaced: document.getElementById('vS') !== window.__old.sec, vReplaced: document.getElementById('vV') !== window.__old.v, oldVConnected: window.__old.v.isConnected, tipBefore: window.__old.tip, tipAfter: JSON.stringify(window.getHistoryTip?.() ?? null) }));
  await page.mouse.move(x + 120, y + 90, { steps: 8 }); await page.mouse.up();
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const c1 = await count(page);
  const end = await page.evaluate(() => ({ oldVConnected: window.__old.v.isConnected, oldSecConnected: window.__old.sec.isConnected }));
  console.log('[D1 실측]', JSON.stringify({ c0, mid, afterUndo, ate, c1, end }));
  expect([c0.dom, c0.saved], '[전제] 처음 하나').toEqual([1, 1]);
  expect([c1.dom, c1.saved], '★끄는 도중 ⌘Z 뒤 계속 끌어도 같은 id 하나(DOM · 저장본)').toEqual([1, 1]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* D2 (1회차 원문 손짓 그대로 · 지디 261119 «오버레이 켬 → 끌기 → 끔 → ⌘Z → ⌘⇧Z → ⌘Z → 다시 열기») — 단계마다 같은 id 수(DOM · 저장본)를 잰다. 패널 단추·진짜 마우스·키.
 * D3 (곁 가설) — ⌘Z 뒤에도 패널이 «옛 블럭»을 쥔 채 열려 있으면 그 단추를 다시 누름 → 옛 블럭을 exitFloat/enterFloat → 사본이 붙나 */
async function openPanel(page) {
  const [x, y] = await page.evaluate(() => { const r = document.getElementById('vV').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.click(x, y);
  await expect(page.locator('#vb-w')).toBeVisible();   // 전제 — 벡터 패널이 열렸다
}
/* 누르기 전 떠 있음 상태를 재 두고 «바뀔 때까지» → 상자 멎음(고정 대기 0) */
const toggle = async (page) => {
  const was = await page.evaluate(() => window.OverlayFloat.posElOf(document.getElementById('vV')).dataset.overlayBlock === 'true');
  await page.click('#vb-float-toggle');
  await expect.poll(() => page.evaluate(() => window.OverlayFloat.posElOf(document.getElementById('vV')).dataset.overlayBlock === 'true'), '[전제] 오버레이 토글이 상태를 바꿨다').toBe(!was);
  await stable(page, '#vV');
};

const seq = async (page, label, log) => { log.push([label, await count(page)]); };
test('D2 (1회차 손짓) 켬 → 끌기 → 끔 → ⌘Z → ⌘⇧Z → ⌘Z → 다시 열기 — 단계마다 같은 id 하나', async ({ page }) => {
  const errs = await setup(page); const log = [];
  /* 표식 ③(지디 261123 — 171ms 에도 killClick(overlay-float.js:773)이 삼킴 · 해제는 코드상 setTimeout 120 = 시간 기준) — capture click 리스너 붙임/뗌을 시각·호출 경로째 적는다(«뒤에 또 붙나» vs «안 떼지나») */
  await page.evaluate(() => { window.__cap = []; const A = EventTarget.prototype.addEventListener, R = EventTarget.prototype.removeEventListener; const cap = (o) => o === true || (o && o.capture);
    const where = () => (new Error().stack || '').split('\n').slice(3, 5).map((l) => l.trim().replace(/^at /, '').replace(/https?:\/\/[^/]+\//, '')).join(' < ');
    EventTarget.prototype.addEventListener = function (t, f, o) { if (t === 'click' && this === document && cap(o)) window.__cap.push(['add', Math.round(performance.now()), where()]); return A.call(this, t, f, o); };
    EventTarget.prototype.removeEventListener = function (t, f, o) { if (t === 'click' && this === document && cap(o)) window.__cap.push(['rm', Math.round(performance.now()), where()]); return R.call(this, t, f, o); }; });
  await page.evaluate(() => window.clearHistory?.());
  await openPanel(page); await seq(page, 'open', log);
  await toggle(page); await seq(page, '켬', log);
  await page.evaluate(() => document.getElementById('vV').scrollIntoView({ block: 'center', inline: 'center' })); await stable(page, '#vV'); const [x, y, startHit] = await page.evaluate(() => { const v = document.getElementById('vV'), r = v.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, h = document.elementFromPoint(cx, cy); return [cx, cy, { hit: h && ((h.id || '') + '.' + String(h.className?.baseVal ?? h.className).split(' ')[0]), inV: !!h && (h === v || v.contains(h) || h.contains(v)), appRegion: h ? getComputedStyle(h).getPropertyValue('-webkit-app-region') || getComputedStyle(h).webkitAppRegion || '' : null, vRect: [r.left, r.top, r.width, r.height].map(Math.round) }]; });   // ★전제(아이맥 ed978fdcf — 옛 판은 스크롤 없이 rect 가운데를 잡아 start [750,92] = 위 막대 자리 → 벡터를 안 끔) ⇒ 가운데로 스크롤 뒤 잡고 그 점이 벡터에 맞는지 잰다
  expect(startHit.inV, `[전제] 끌기 시작점이 벡터에 맞는다 ${JSON.stringify(startHit)}`).toBe(true);
  /* 표식 ④(지디 261123 — 끌기 놓은 mouseup 에 onUp 이 안 돌고 다음 클릭의 mouseup 에서 돔 = 놓은 mouseup 이 문서 bubble 까지 못 감) — 놓기 mouseup/pointerup 을 멈추는 자 + 놓은 직후/소진 직전 벡터 자리(세션이 살아 있으면 커서를 따라감) */
  await page.evaluate(() => { window.__upStops = []; window.__oSP = Event.prototype.stopPropagation; window.__oSIP = Event.prototype.stopImmediatePropagation; const w = (k, o) => function () { if (/^(mouse|pointer)up$/.test(this.type)) window.__upStops.push([k, this.type, this.eventPhase, (this.currentTarget && (this.currentTarget.id || this.currentTarget.nodeName)) || String(this.currentTarget), (new Error().stack || '').split('\n').slice(2, 6).map((l) => l.trim().replace(/^at /, '').replace(/https?:\/\/[^/]+\//, '')).join(' < ')]); return o.call(this); }; Event.prototype.stopPropagation = w('SP', window.__oSP); Event.prototype.stopImmediatePropagation = w('SIP', window.__oSIP);
    window.__upSeen = []; document.addEventListener('mouseup', (e) => window.__upSeen.push(['doc-bub', e.target.id || String(e.target.className).split(' ')[0]]), { once: true }); window.addEventListener('mouseup', (e) => window.__upSeen.push(['win-cap', e.target.id || String(e.target.className).split(' ')[0]]), { capture: true, once: true }); });
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 150, y + 60, { steps: 10 }); await page.mouse.up(); await page.evaluate(() => { window.__upAt = performance.now(); });
  const upProbe = await page.evaluate(() => { Event.prototype.stopPropagation = window.__oSP; Event.prototype.stopImmediatePropagation = window.__oSIP; const w = window.OverlayFloat.posElOf(document.getElementById('vV')); return { stops: window.__upStops, seen: window.__upSeen, capAtUp: window.__cap.map(([op, t, w2]) => [op, t - Math.round(window.__upAt), w2]), vAtUp: [w.dataset.offsetX, w.dataset.offsetY] }; });   // 자리 = 정본 offsetX/Y(onMove 가 쓰는 값 — 세션이 살아 커서를 따라가면 바뀐다 · 화면 rect 아님 = dom-screen-px census 밖) await stable(page, '#vV'); await seq(page, '끌기', log);
  if (!(await page.locator('#vb-float-toggle').isVisible())) await openPanel(page);
  await page.waitForFunction(() => performance.now() - window.__upAt > 150);   // ★전제(아이맥 3eb53c9b5 D2 «토글이 상태를 바꿨다» 빨강) — 끌고 놓은 뒤 120ms 는 합성 click 을 삼킨다(overlay-float.js onUp killClick · 놓는 자리 선택 풀림 막기) ⇒ 그 창이 닫힌 뒤 누른다(사람 손 속도 · 고정 대기 아님 = 조건 대기)
  const vBeforeEat = await page.evaluate(() => { const w = window.OverlayFloat.posElOf(document.getElementById('vV')); return [w.dataset.offsetX, w.dataset.offsetY]; });
  const vp = await page.evaluate(() => [window.innerWidth, window.innerHeight]);   // 표식 ⑤(지디 261123 ⑴ — seen [] 이 무효 음성인가) — 끌기 시작점·놓는 점이 창(뷰포트) 안인가: 창 밖에서 놓으면 mouseup 이 문서에 안 온다
  console.log('[D2 놓기 표식]', JSON.stringify({ upProbe, vBeforeEat, vp, start: [Math.round(x), Math.round(y)], release: [Math.round(x + 150), Math.round(y + 60)], releaseInside: x + 150 < vp[0] && y + 60 < vp[1], startHit }));
  const capLog1 = await page.evaluate(() => window.__cap.map(([op, t, w]) => [op, t - Math.round(window.__upAt), w]));
  /* ★전제(지디 261123 ⑶) — 끌고 놓은 뒤 남은 삼킴을 «빈 곳 클릭 하나»로 소진하고 1회차 손짓 id 셈까지 간다(삼킴 결함은 별건 카드 · 제품 무접촉). 소진 클릭이 삼켜졌는지도 적는다 */
  const eat = await page.evaluate(() => { window.__eat = { win: 0, bub: 0 }; window.addEventListener('click', () => window.__eat.win++, { capture: true, once: true }); document.addEventListener('click', () => window.__eat.bub++, { once: true }); return true; });
  { const r = await page.evaluate(() => { const p = document.getElementById('panel-right').getBoundingClientRect(); return [p.left + p.width / 2, p.bottom - 6]; }); await page.mouse.click(r[0], r[1]); }
  const eaten = await page.evaluate(() => ({ ...window.__eat, sinceUp: Math.round(performance.now() - window.__upAt), cap: window.__cap.map(([op, t, w]) => [op, t - Math.round(window.__upAt), w]) }));
  const vRect0 = await page.evaluate(() => { const r = document.getElementById('vV').getBoundingClientRect(); return [r.left, r.top].map(Math.round); });
  /* 표식(지디 261123 — 150ms 대기로도 «끔»이 안 눌림 · 추측 고침 말고 잰다): 누르기 직전 단추 hit-test · 상태 · 패널이 쥔 블럭 · 누른 뒤 click 도달(창 capture = killClick 앞 · 문서 bubble = killClick 뒤) */
  const probe = await page.evaluate(() => { const b = document.getElementById('vb-float-toggle'), r = b?.getBoundingClientRect(), hit = r && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    window.__stops = []; window.__origSP = Event.prototype.stopPropagation; window.__origSIP = Event.prototype.stopImmediatePropagation;   // 표식 ②(지디 261123 — click 이 창 capture 엔 오고 문서 bubble 엔 못 감) — 누가 멈추나: 호출 경로
    Event.prototype.stopPropagation = function () { if (this.type === 'click') window.__stops.push(['SP', this.eventPhase, (this.currentTarget && (this.currentTarget.id || this.currentTarget.nodeName)) || String(this.currentTarget), (new Error().stack || '').split('\n').slice(2, 6).map((l) => l.trim().replace(/^at /, '').replace(/https?:\/\/[^/]+\//, '')).join(' < ')]); return window.__origSP.call(this); };
    Event.prototype.stopImmediatePropagation = function () { if (this.type === 'click') window.__stops.push(['SIP', this.eventPhase, (this.currentTarget && (this.currentTarget.id || this.currentTarget.nodeName)) || String(this.currentTarget), (new Error().stack || '').split('\n').slice(2, 6).map((l) => l.trim().replace(/^at /, '').replace(/https?:\/\/[^/]+\//, '')).join(' < ')]); return window.__origSIP.call(this); };
    window.__clk = []; window.addEventListener('click', (e) => window.__clk.push(['win-cap', e.target.id || e.target.className]), { capture: true, once: true }); document.addEventListener('click', (e) => window.__clk.push(['doc-bub', e.target.id || e.target.className, e.defaultPrevented]), { once: true });
    return { sinceUp: Math.round(performance.now() - window.__upAt), exists: !!b, connected: !!b?.isConnected, disabled: !!b?.disabled, aria: b?.getAttribute('aria-pressed') ?? b?.getAttribute('aria-disabled') ?? null, cls: b?.className, rect: r && [r.left, r.top, r.width, r.height].map(Math.round), hit: hit && ((hit.id || '') + '.' + String(hit.className).split(' ')[0]), hitIsBtn: !!hit && (hit === b || b.contains(hit)), panelBlock: document.querySelector('#panel-right [data-block-id]')?.dataset.blockId ?? null, selected: [...document.querySelectorAll('#canvas .selected')].map((e) => [e.id, String(e.className).split(' ')[0], e.parentElement?.id || String(e.parentElement?.className).split(' ')[0]]), vVcount: document.querySelectorAll('[id="vV"]').length }; });
  const wasF = await page.evaluate(() => window.OverlayFloat.posElOf(document.getElementById('vV')).dataset.overlayBlock === 'true');
  await page.click('#vb-float-toggle'); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const after = await page.evaluate(() => { Event.prototype.stopPropagation = window.__origSP; Event.prototype.stopImmediatePropagation = window.__origSIP; return { stops: window.__stops, clk: window.__clk, nowF: window.OverlayFloat.posElOf(document.getElementById('vV')).dataset.overlayBlock === 'true' }; });
  const vRect1 = await page.evaluate(() => { const r = document.getElementById('vV').getBoundingClientRect(); return [r.left, r.top].map(Math.round); });
  const capEnd = await page.evaluate(() => window.__cap.map(([op, t, w]) => [op, t - Math.round(window.__upAt), w]));
  console.log('[D2 끔 표식]', JSON.stringify({ probe, capLog1, eat, eaten, vRect0, vRect1, wasF, after, capEnd }));
  expect(after.nowF, '[전제] 오버레이 토글이 상태를 바꿨다(«끔»)').toBe(!wasF);
  await stable(page, '#vV'); await seq(page, '끔', log);
  for (const [k, l] of [['Meta+z', '⌘Z'], ['Meta+Shift+z', '⌘⇧Z'], ['Meta+z', '⌘Z 2']]) { await page.keyboard.press(k); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); await seq(page, l, log); }
  await page.evaluate(async () => { window.deselectAll(); const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; await window.applyProjectData(d); });
  await page.waitForFunction(() => !!document.querySelector('#canvas .section-block'));
  await seq(page, '다시 열기', log);
  console.log('[D2 실측]', JSON.stringify(log));
  expect(log.filter(([, c]) => c.dom !== 1 || c.saved !== 1).map(([l]) => l), '★어느 단계에서도 같은 id 는 하나(DOM · 저장본)').toEqual([]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('D3 (곁 가설) 켬 → ⌘Z → 패널이 열려 있으면 단추 다시 누름 → 같은 id 하나', async ({ page }) => {
  const errs = await setup(page); const log = [];
  await page.evaluate(() => window.clearHistory?.());
  await openPanel(page); await toggle(page); await seq(page, '켬', log);
  await page.keyboard.press('Meta+z'); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); await seq(page, '⌘Z', log);
  const btn = await page.locator('#vb-float-toggle').isVisible();
  if (btn) { await page.click('#vb-float-toggle'); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); }
  await seq(page, '단추 다시', log);
  console.log('[D3 실측]', JSON.stringify({ btn, log }));
  expect(log.filter(([, c]) => c.dom !== 1 || c.saved !== 1).map(([l]) => l), '★같은 id 하나').toEqual([]);
  expect(errs, errs.join(' | ')).toEqual([]);
});
