/* t13d-09 — 0.9.13 t13D-09 섹션 좌우 패딩 0 인데 그리드 양옆에 여백(현빈 proj_1795145417046 grd_ofjwh_po3sn2v)
 * 실측(저장본): 그 그리드 data-grid-width="815" · style width:815px; max-width:100%; align-self:center — 섹션 860.
 * 원인: 흐름 그리드 폭 쓰기(applyGridOwnWidth — 손잡이·패널 슬라이더)가 그릇 폭 이상 값도 키로 박았다. K1 이 그릴 때 min(키, 그릇)으로 죄어
 *   패딩 72(그릇 716)에선 «꽉 찬 것처럼» 보이다가, 패딩을 0 으로 하면 그 px 로 드러나 가운데 정렬 + 양옆 여백.
 *   모서리 손잡이는 폭+높이라 «높이만» 끌어도 폭 716 키가 박힌다(D4).
 * 고침: 흐름 그리드에 그릇 폭 이상을 쓰면 = 다 쓴다(키 없음 → 100%). 그릇보다 좁은 값은 사람 폭 그대로(D3).
 * D1 그릇 폭 그대로 쓰기 → 키 없음 → 패딩 0 = 섹션 전폭
 * D2 그릇보다 넓게(815 > 716) → 키 없음 → 패딩 0 = 섹션 전폭
 * D3 [회귀 지킴] 500 → 키 500 · 패딩 0 뒤에도 500
 * D4 진짜 마우스 sw 손잡이(아래로 = 높이 +)를 «세로로만» 끌기(높이) → 폭 키 안 생김 · 패딩 0 = 섹션 전폭
 * 양성대조: _patches/t13d-09-CTL.patch → D1·D2·D4 빨강 · D3 초록.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1300 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="pS" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="pI" data-padding-x="72" style="padding-left:72px;padding-right:72px">'
      + '<div class="gap-block" data-type="gap" style="height:60px"></div><div class="row" id="pR" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:300px"></div></div></div>');
    const L4 = (t) => [1, 2, 3, 4].map((i) => ({ type: 'body', text: t + ' ' + i }));
    const { block: g } = window.makeGridBlock({ cols: [{ width: 1, lines: L4('A') }, { width: 1, lines: L4('B') }] });
    g.id = 'pG'; document.getElementById('pR').appendChild(g);
    window.rebindAll?.(); window.renderGridBlock(g); window.deselectAll?.(); window.applyZoom?.(100); g.scrollIntoView({ block: 'center' });
  });
  await expect.poll(() => page.evaluate(() => document.getElementById('pG').offsetWidth), '[전제] 그리드가 섰다').toBeGreaterThan(0);
  /* ★D4 원인(tpf7b · 수지 5차 DIAG 261123): applyZoom(100) 은 #canvas-scaler 의 «transition: transform .15s»(editor-canvas.css:322 · 제품 의도)로 Fit 배율에서 1 로 «자라는 중» —
     그사이 잰 손잡이 점이 올린 뒤 (−10.5, +5.9) 밀렸다(그리드 상자 ×0.929 → 0.946 → 0.960 · 가운데 고정 · 위 60 = 갭 블럭만큼 아래로). 배율이 1 로 멎은 뒤(그린 폭 = 레이아웃 폭) 시작한다. */
  await expect.poll(() => page.evaluate(() => { const g = document.getElementById('pG'); return Math.abs(g.getBoundingClientRect().width - g.offsetWidth) < 0.5; }), '[전제] 캔버스 배율 전이(.15s)가 멎었다').toBe(true);
  return errs;
}
const st = (page) => page.evaluate(() => { const g = document.getElementById('pG'), s = document.getElementById('pS');
  return { key: g.dataset.gridWidth ?? null, w: g.offsetWidth, inner: document.getElementById('pI').clientWidth - parseFloat(getComputedStyle(document.getElementById('pI')).paddingLeft) * 2, sec: s.offsetWidth }; });
const pad0 = (page) => page.evaluate(() => { const i = document.getElementById('pI'); i.style.paddingLeft = '0px'; i.style.paddingRight = '0px'; i.dataset.paddingX = '0'; });

test('D1 그릇 폭 그대로 쓰기 → 키 없음 → 패딩 0 = 섹션 전폭', async ({ page }) => {
  const errs = await setup(page);
  const a = await st(page);
  expect(a.w, '[전제] 패딩 72 = 그릇 716 꽉').toBe(a.inner);
  await page.evaluate(() => { const g = document.getElementById('pG'); window.applyGridOwnWidth(g, g.offsetWidth); });
  expect((await st(page)).key, '★그릇 폭 = 다 쓴다(키 없음)').toBe(null);
  await pad0(page);
  const b = await st(page);
  expect(b.w, `★패딩 0 → 섹션 전폭 ${JSON.stringify(b)}`).toBe(b.sec);
  expect(errs).toEqual([]);
});

test('D2 그릇보다 넓게(815) → 키 없음 → 패딩 0 = 섹션 전폭', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => window.applyGridOwnWidth(document.getElementById('pG'), 815));
  expect((await st(page)).key, '★키 815 가 안 남는다').toBe(null);
  await pad0(page);
  const b = await st(page);
  expect(b.w, `★패딩 0 → 섹션 전폭 ${JSON.stringify(b)}`).toBe(b.sec);
  expect(errs).toEqual([]);
});

test('D3 [회귀 지킴] 그릇보다 좁은 500 → 키 500 · 패딩 0 뒤에도 500', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => window.applyGridOwnWidth(document.getElementById('pG'), 500));
  expect(await st(page)).toMatchObject({ key: '500', w: 500 });
  await pad0(page);
  expect(await st(page)).toMatchObject({ key: '500', w: 500 });
  expect(errs).toEqual([]);
});

/* 장면 바꿈(지디 261121 · 인텔 DIAG3 ×3): nw 자리는 마우스 올리면 그 점 임자가 .grd-headband(그리드 머리띠 · 띠 탭 우선 = 현빈 7112) — 사람도 못 잡는 자리.
   목적(«높이만 끌기 → 폭 키 안 생김»)은 그대로 · 띠에 안 덮이는 sw 를 세로로만(아래 +30 = dp +30 · w 라 sx≠0 이어도 dx 0 = 폭 무변) · 단언 무변.
   덤(별건 후보): nw 손잡이가 머리띠에 덮여 안 잡힘 — 근거 = 이 칸 DIAG3 «올린 뒤 임자 .grd-headband · nw 1개 display block». */
test('D4 sw 손잡이를 세로로만 끌기(높이) → 폭 키 안 생김 · 패딩 0 = 섹션 전폭', async ({ page }) => {
  const errs = await setup(page);
  /* 4차(지디 261121 · 인텔 ×3: 올린 뒤 sw 자리 임자 = .grd-line) — 지혜맥 격리 실앱(dea52882f)에서는 «사람 클릭으로 고름» 뒤 nw·sw·se·n 손잡이가 올리기 앞뒤 모두 임자 ·
     실제 끌기 sw +30 → cellPadY 30 · nw −30 → 60 · 폭 키 없음(_patches/t13d-09-grd-png/) ⇒ 제품은 잡힌다(ⓑ 아님) · 이 칸은 사람 길(그리드 몸 클릭)로 고르고, 누를 점은 올린 «뒤» 다시 잰다. */
  const gb = await page.evaluate(() => { const q = document.getElementById('pG').getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; });
  await page.mouse.click(gb[0], gb[1]);
  await expect.poll(() => page.evaluate(() => document.getElementById('pG').classList.contains('selected')), '[전제] 그리드 몸 클릭 = 그리드 고름').toBe(true);
  const sw = await page.evaluate(async () => { await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const h = document.querySelector('#ss-handles-overlay [data-grd-resize-dir="sw"]'); if (!h || getComputedStyle(h).display === 'none') return null; const q = h.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; });
  expect(sw, '[전제] sw 손잡이').toBeTruthy();
  /* [시험만 · 인텔 261120 D4 3/3 ✘ a.pad=null] 코드 길(overlay-handles.js _onGridOverlayResizeMouseDown: (옛 장면) nw 위로 = dp + → applyGridCellPadY)은 맞다 ⇒ «누른 점이 그 손잡이가 아니었다»가 남은 가설.
     전제 = 누를 점의 임자가 sw 손잡이(두 번 같은 자리) · 아니면 그 임자를 찍고 전제에서 진다(엉뚱한 «높이 안 바뀜» 대신). */
  const who = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? (e.dataset?.grdResizeDir ? 'sw-handle' : (e.id || '') + '.' + String(e.className).slice(0, 50)) : null; }, sw);
  expect(who, `[전제] 누를 점 임자 = sw 손잡이 (본 것: ${who})`).toBe('sw-handle');
  /* DIAG(인텔 261120 D4 3/3 — 전제 «누른 점 = sw 손잡이» 통과 · 그다음 a.pad=null): 끌기 앞뒤 dataset 전부 · 높이 · 손잡이 imp(끌기 중 누구 mousedown 이 받았나) 를 실패 메시지에 */
  const ds = () => page.evaluate(() => { const g = document.getElementById('pG'); return { ds: { ...g.dataset }, h: g.offsetHeight, padRead: window.getGridCellPadY?.(g) }; });
  const d0 = await ds();
  await page.evaluate(() => { window.__d4 = []; const wrap = (name) => { const f = window[name]; if (f && !f.__d4) { window[name] = function () { let r, err; try { r = f.apply(this, arguments); } catch (x) { err = String(x && x.message || x); window.__d4.push([name, 'THROW', err]); throw x; } window.__d4.push([name, [...arguments].slice(1).map(String).join(','), r === undefined ? 'u' : String(r)]); return r; }; window[name].__d4 = 1; } };
    wrap('applyGridCellPadY'); wrap('applyGridOwnWidth'); wrap('renderGridBlock');
    /* 2차 DIAG(인텔 261120: applyGridCellPadY 부름 [] · dataset 앞뒤 같음) — 손잡이 mousedown 이 왔나 · 끄는 동안 document mousemove 수 · 쓰기 문 반환값·던짐 */
    const h = document.querySelector('#ss-handles-overlay [data-grd-resize-dir="sw"]'); if (h) h.addEventListener('mousedown', () => window.__d4.push(['handle-down']), true);
    window.__d4mm = 0; document.addEventListener('mousemove', () => { window.__d4mm++; }, true); });
  /* 3차 DIAG(인텔 261121: 부름 [mousemove 7] 뿐 · handle-down 0 · applyGridOwnWidth 0) — 손잡이 리스너가 mousedown 을 못 받았다.
     가를 것: ① 마우스를 «올린 뒤»(hover) 그 점 임자가 바뀌나(＋ 버튼이 떠서 P4 규칙으로 손잡이가 display:none 등) ② mousedown 이 어디로 갔나(window capture 첫 자리 target) */
  await page.evaluate(() => { window.__d4dn = []; window.addEventListener('mousedown', (e) => { const t = e.target; window.__d4dn.push((t.dataset?.grdResizeDir ? 'grd:' + t.dataset.grdResizeDir : (t.id || '') + '.' + String(t.className).slice(0, 40)) + (t.isConnected ? '' : ':detached')); }, true); });
  /* 5차 DIAG(tpf7b 3맥 전수 261123 · 수지 단독 재실행도 빨강: 올린 뒤 손잡이 중심 (−10.5, +5.9) 움직이고 그 점 임자 = .grd-line grd-body) —
     무엇이 움직였나를 세 때(올리기 앞 · 올린 뒤 · 다시 올린 뒤) 한 줄로: 손잡이 · pG · 보이는 상자(gridVisualBox) · 오버레이 · 캔버스 스크롤 · 줌 · 그 점 위 4겹 */
  const snap = (pt) => page.evaluate(([x, y]) => { const r = (e) => { if (!e) return null; const q = e.getBoundingClientRect(); return [q.left, q.top, q.width, q.height].map((v) => Math.round(v * 10) / 10); };
    const g = document.getElementById('pG'), cv = document.getElementById('canvas'), sc = cv && cv.closest('[style*="overflow"], .canvas-wrap, #canvas-container') || cv?.parentElement;
    return { h: r(document.querySelector('#ss-handles-overlay [data-grd-resize-dir="sw"]')), g: r(g), vb: r(window.gridVisualBox?.(g)), ov: r(document.getElementById('ss-handles-overlay')),
      scroll: sc ? [sc.scrollLeft, sc.scrollTop] : null, win: [scrollX, scrollY], zoom: window.currentZoom ?? window.getZoom?.() ?? null, sel: document.querySelector('.selected')?.id || null,
      stack: document.elementsFromPoint(x, y).slice(0, 4).map((e) => (e.id || '') + '.' + String(e.className).slice(0, 24)) }; }, pt);
  const snaps = { before: await snap(sw) };
  await page.mouse.move(sw[0], sw[1]);
  snaps.hover1 = await snap(sw);
  const sw2 = await page.evaluate(() => { const h = document.querySelector('#ss-handles-overlay [data-grd-resize-dir="sw"]'); const q = h.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; });
  const mv = JSON.stringify({ before: [...sw], after: sw2 });
  if (sw2[0] !== sw[0] || sw2[1] !== sw[1]) { await page.mouse.move(sw2[0], sw2[1]); sw[0] = sw2[0]; sw[1] = sw2[1]; }
  snaps.hover2 = await snap(sw);
  const who2 = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); const hs = [...document.querySelectorAll('#ss-handles-overlay [data-grd-resize-dir="sw"]')]; return { at: e ? (e.dataset?.grdResizeDir ? 'sw-handle' : (e.id || '') + '.' + String(e.className).slice(0, 50)) : null, swCount: hs.length, swDisplay: hs.map((h) => getComputedStyle(h).display) }; }, sw);
  expect(who2.at, `[전제] 마우스 올린 뒤에도 그 점 임자 = sw 손잡이 (본 것: ${JSON.stringify(who2)} · 손잡이 중심 올리기 앞/뒤 ${mv} · DIAG ${JSON.stringify(snaps)})`).toBe('sw-handle');
  await page.mouse.down();
  await page.mouse.move(sw[0], sw[1] + 30, { steps: 6 }); await page.mouse.up();
  const d1 = await ds(); const calls = await page.evaluate(() => [...window.__d4, ['mousemove', window.__d4mm], ['down-target', ...window.__d4dn]]);
  const a = await page.evaluate(() => ({ pad: document.getElementById('pG').dataset.cellPadY ?? null, key: document.getElementById('pG').dataset.gridWidth ?? null }));
  expect(a.pad, `[전제] 높이(칸 위아래 여백)는 바뀌었다 · DIAG 앞 ${JSON.stringify(d0)} 뒤 ${JSON.stringify(d1)} 부름 ${JSON.stringify(calls).slice(0, 400)} · pageerror ${errs.join(' | ').slice(0, 200)}`).not.toBe(null);
  expect(a.key, '★높이만 끌었는데 폭 키가 박혔다').toBe(null);
  await pad0(page);
  const b = await st(page);
  expect(b.w, `★패딩 0 → 섹션 전폭 ${JSON.stringify(b)}`).toBe(b.sec);
  expect(errs).toEqual([]);
});
