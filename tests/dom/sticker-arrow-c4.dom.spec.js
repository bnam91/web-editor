/* sticker-arrow-c4.dom.spec.js — 1013t2C4 화살표 스티커(shape:'arrow' · 메뉴 「Arrow Line」).
 * 앱 통째로 헤드리스(bootApp) · 진짜 마우스(clickAt — 누르기 직전 맞힌 요소를 단언) · ⛔waitForTimeout 0.
 *
 * ★무엇을 잠그나 (계획 plan-1013t2-C4C5 C4-7 A1~A10)
 *   A1 메뉴 「Arrow Line」 실클릭 → 화살표 1 · 골라짐 · 끝점 손잡이 2(모서리 손잡이 0) · 섹션 안 골랐으면 0
 *      · 메뉴 자리 = Highlight 다음 · Glow 앞 · ★이웃 잠금 생존: Coin 은 마킹(onclick toggleCountStickerMode) 바로 다음(coin K1 · 이름 아닌 정의로) · 살아 있는 /highlight/i 단추 1(HJ1)
 *   A2 패널 — Arrow Line 절만 · Shape·Size·Colors·Rotation 절 숨김 · 칩·칸이 dataset 과 그림(path d·머리 수·dasharray·stroke)에 닿는다 · 휨 행은 곡선만 · 다시 섞기는 손그림만
 *   A3 끝 손잡이 실마우스 끌기 → x2,y2 바뀜 · 머리 꼭짓점 = 새 끝점
 *   A4 몸통 끌기 → 네 끝점이 같은 Δ · 끈 뒤에도 손잡이 2
 *   A5 ★맞힘 — 대각선 화살표 상자의 «빈 귀퉁이»는 화살표가 아니다(아래로 통과) · 선 위는 화살표다 · 빈 귀퉁이 실클릭은 화살표를 안 고른다
 *   A6 저장 → 새 페이지에서 다시 열기 = 같은 값·같은 그림 · 칩 한 번 = ⌘Z 한 칸(값·그림 복귀)
 *   A7 ⌘C⌘V · ⌘D — 새 id · 그림 있음 · 눌러서 골라진다 · (M4-1) 사본 끝점이 원본과 같은지 «재서 적기만»(단언 없음 — GO 뒤 판정)
 *   A8 ★PNG(CDP 오프스크린) · 썸네일(html2canvas) 두 길에 머리 픽셀이 산다(대조 = 머리 없음) · 파선의 틈도 산다(대조 = 실선)
 *   A9 기억 — 화살표 스타일 바꾼 뒤 다음 「Arrow Line」이 물려받고 · 일반 「Sticker」는 화살표를 안 낳는다(__last 무접촉) · 즐겨찾기 ★추가는 «말하고» 거절
 *   A10 Esc · deselectAll 뒤 .selected 0 · .hlb-handle 0 · 콘솔 오류 0
 * ★상태: 이 파일은 «써만» 두었다 — 1013t2 규칙(이 맥 부하)으로 ⛔DOM 실행 0 · GO 뒤 첫 런.
 * 음성대조 지점(GO 뒤 칸마다 한 번 · 수로 보고):
 *   N1 sticker-block.js _renderStickerBlockInner 의 arrow 갈래 지우기 → A1·A2·A6 빨강
 *   N2 sticker-block.js LINE_STICKER_SHAPES 에서 'arrow' 빼기 → A1(손잡이 2)·A3·A4 빨강
 *   N3 arrow-render.js 맞힘 path 를 지우고 블럭 상자 pointer-events:auto → A5 빨강
 *   N4 arrow-render.js headPath 의 B 를 T + u·L 로(부호 뒤집기) → A3 빨강(+ 유닛 AR3)
 *   N5 sticker-block.js rememberStickerStyle arrow 갈래의 return 앞에 __last = slot → A9 빨강
 *   N6 sticker-select.js onMoveB 의 손잡이 다시 달기 줄 지우기 → A4(끈 뒤 손잡이 2) 빨강
 *   N7 prop-sticker.js hideBasic 에서 isArrow 빼기 → A2 빨강
 *   N8 arrow-render.js 머리를 <marker> 로 바꾸기(모의) → A8 썸네일 머리 픽셀 빨강 — 비용 커서 독해 대조로 갈음 가능
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');
const { expectOneUndoStep } = require('./_history-step.js');

const SEC_HTML = (id = 'secA', bg = '#ffffff', h = 480) =>
  `<div class="section-block" id="${id}" style="position:relative;height:${h}px;background:${bg}"><div class="section-inner"></div></div>`;

/* ★1013t2 r2 — 배율 전환이 «끝난 뒤»에 잰다(LNPLUS 718dc05a 와 같은 꼴 · tests/dom/FLAKY.md LP2 절).
   #canvas-scaler 는 `transition: transform .15s`(css/editor-canvas.css)라 applyZoom(부팅·applyProjectData 가 부른다) 직후
   한동안 «보간 중»이다 — 그 사이 잰 클릭 좌표는 누르는 순간 이미 옮겨 가 있다. ⇒ «재는 그 값»(스케일러 계산 배율
   = window.currentZoom/100 · 도는 전환 0)을 기다린다. ⛔고정 대기 없음. */
async function waitZoomSettled(page) {
  try {
    await page.waitForFunction(() => {
      const S = document.getElementById('canvas-scaler');
      const z = Number(window.currentZoom);
      if (!S || !Number.isFinite(z) || S.getAnimations().length) return false;
      const tf = getComputedStyle(S).transform, m = /^matrix\(([^,]+),/.exec(tf);
      const k = tf === 'none' ? 1 : m ? Number(m[1]) : NaN;
      return Math.abs(k - z / 100) < 1e-3;
    }, null, { timeout: 5000 });
  } catch (e) {
    throw new Error(`배율 전환이 안 끝났다(#canvas-scaler 보간 중 · currentZoom 과 계산 배율 불일치) — ${e.message}`);
  }
}
async function setup(page, html = SEC_HTML()) {
  await page.evaluate((html) => {
    document.getElementById('canvas').innerHTML = html;
    window.rebindAll?.();
  }, html);
  await waitZoomSettled(page);
  await waitStableRect(page, '.section-block');
}
const selectSection = (page, id = 'secA') => page.evaluate((id) => { window.deselectAll?.(); window.selectSection?.(document.getElementById(id)); return window.getSelectedSection?.()?.id; }, id);

/* 스티커 버튼 → 메뉴 항목(글자로 찾음)을 «실제 마우스»로 누른다(highlight-line-j1j2 와 같은 꼴). */
async function clickPenMenu(page, label) {
  const btn = await page.evaluate(() => { const r = document.getElementById('fp-pen-btn').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.click(btn.x, btn.y);
  await page.waitForFunction((label) => [...document.querySelectorAll('#fp-pen-menu .fp-menu-item')].some(e => e.textContent.trim() === label && e.getBoundingClientRect().width > 0), label, { timeout: 3000 });
  const it = await page.evaluate((label) => {
    const items = [...document.querySelectorAll('#fp-pen-menu .fp-menu-item')].filter(e => e.textContent.trim() === label && e.getBoundingClientRect().width > 0);
    const r = items[0].getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    return { n: items.length, x, y, hit: document.elementFromPoint(x, y) === items[0] };
  }, label);
  expect(it.n, `★전제: 보이는 «${label}» 메뉴 항목이 하나다`).toBe(1);
  expect(it.hit, '★전제: 누르는 점이 그 메뉴 항목 위다').toBe(true);
  await page.mouse.click(it.x, it.y);
}

const arrowIds = (page) => page.evaluate(() => [...document.querySelectorAll('.sticker-block[data-shape="arrow"]')].map(b => b.id));

/* 화살표 하나의 상태 — dataset · 그림(몸통 d · 머리 d·수 · dasharray · stroke) · 손잡이 · 선택 */
const read = (page, id) => page.evaluate((id) => {
  const b = document.getElementById(id);
  if (!b) return null;
  const body = b.querySelector('path.arrow-body'), heads = [...b.querySelectorAll('path.arrow-head')];
  return {
    d: { ...b.dataset }, html: b.querySelector('svg')?.outerHTML || '',
    body: body?.getAttribute('d') || null, dash: body?.getAttribute('stroke-dasharray') || null,
    stroke: body?.getAttribute('stroke') || null, sw: body?.getAttribute('stroke-width') || null,
    heads: heads.map(h => ({ end: h.dataset.end, d: h.getAttribute('d'), fill: h.getAttribute('fill'), dash: h.getAttribute('stroke-dasharray') })),
    selected: b.classList.contains('selected'),
    hlb: b.querySelectorAll(':scope > .hlb-handle').length,
    corner: b.querySelectorAll(':scope > .sticker-corner-handle, :scope > .sticker-rotate-zone').length,
    pe: b.style.pointerEvents, parent: b.parentElement?.id || null,
  };
}, id);

/* 섹션 좌표 → 화면 좌표 */
const toClient = (page, x, y, sec = 'secA') => page.evaluate(([x, y, sec]) => {
  const s = document.getElementById(sec); const r = s.getBoundingClientRect(); const k = r.width / s.offsetWidth;
  return [r.left + x * k, r.top + y * k, k];
}, [x, y, sec]);

/* 코드로 하나 깐다(값을 정확히 주려고) — 섹션 직속 · 묶기 · 고르기는 하지 않는다 */
const make = (page, opts, sec = 'secA') => page.evaluate(([opts, sec]) => {
  const b = window.makeStickerBlock({ shape: 'arrow', ...opts });
  document.getElementById(sec).appendChild(b);
  window.bindStickerSelect?.(b);
  window.renderStickerBlock?.(b);
  return b.id;
}, [opts, sec]);

/* 화살표 «선 위» 한 점을 진짜 마우스로 누른다(맞힘 path) */
async function pick(page, id) {
  const [x, y] = await page.evaluate((id) => {
    const b = document.getElementById(id); b.scrollIntoView({ block: 'center' });
    const p = b.querySelector('path.arrow-hit'); const L = p.getTotalLength(); const pt = p.getPointAtLength(L * 0.3);
    const m = p.getScreenCTM(); return [m.a * pt.x + m.c * pt.y + m.e, m.b * pt.x + m.d * pt.y + m.f];
  }, id);
  await clickAt(page, x, y, { sel: `[id="${id}"]` }, { label: `pick ${id}` });
  await expect.poll(async () => (await read(page, id)).selected, `★전제: ${id} 가 골라졌다`).toBe(true);
}

async function typeInto(page, sel, value) {
  await page.click(sel);
  await page.keyboard.press('Meta+a');
  await page.keyboard.type(String(value));
  await page.keyboard.press('Enter');
}
const shown = (page, sel) => page.evaluate((sel) => { const e = document.querySelector(sel); return !!e && getComputedStyle(e).display !== 'none'; }, sel);

/* ═══ A1 ═══ */
test('A1 메뉴 「Arrow Line」 — 한 번 누르면 화살표 1 · 골라짐 · 끝점 손잡이 2 · 섹션 안 골랐으면 0 · 메뉴 자리와 이웃 잠금', async ({ page }) => {
  const errs = await bootApp(page);
  await setup(page);
  const menu = await page.evaluate(() => [...document.querySelectorAll('#fp-pen-menu > .fp-menu-item')].map(b => ({ t: b.textContent.trim(), html: b.outerHTML, on: b.getAttribute('onclick') || '' })));
  const at = menu.findIndex(m => m.t === 'Arrow Line');
  expect(at, '★전제: 메뉴에 「Arrow Line」이 있다').toBeGreaterThan(0);
  expect([menu[at - 1].t, menu[at + 1]?.t], '「Arrow Line」 = Highlight 다음 · Glow 앞').toEqual(['Highlight', 'Glow']);
  /* ★이웃 잠금(coin K1)의 «뜻» = 「Coin 은 마킹 바로 다음」. 메뉴 «글자»는 바뀐다(dev 0.9.8: Count Sticker → Marking)
     — 그래서 이름 대신 «정의»(단추의 onclick 갈래)로 찾는다: 코인 = addStickerBlock({shape:'coin'}) · 마킹 = toggleCountStickerMode(. */
  const byDef = (re) => menu.map((m, i) => re.test(m.on) ? i : -1).filter(i => i >= 0);
  const coinAt = byDef(/addStickerBlock\(\{\s*shape\s*:\s*'coin'/), markAt = byDef(/toggleCountStickerMode\(/);
  expect([coinAt.length, markAt.length], '★전제: 코인 입구 1 · 마킹 입구 1 (onclick 정의로 셈)').toEqual([1, 1]);
  expect(coinAt[0] - markAt[0], '★이웃 잠금(coin K1): Coin 은 마킹(toggleCountStickerMode) 바로 다음').toBe(1);
  expect(menu.filter(m => /highlight/i.test(m.html)).length, '★이웃 잠금(HJ1): 살아 있는 형광펜 입구는 하나').toBe(1);

  expect(await page.evaluate(() => document.querySelectorAll('.selected').length), '★전제: 아무것도 안 골랐다').toBe(0);
  await clickPenMenu(page, 'Arrow Line');
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.getElementById('fp-pen-menu')).display === 'none' || !document.querySelector('#fp-pen-dropdown.open')), '메뉴가 닫혔다').toBe(true);
  expect(await arrowIds(page), '섹션을 안 골랐는데 화살표가 생겼다').toEqual([]);

  expect(await selectSection(page), '★전제: 섹션을 골랐다').toBe('secA');
  await clickPenMenu(page, 'Arrow Line');
  await expect.poll(async () => (await arrowIds(page)).length).toBe(1);
  const [id] = await arrowIds(page);
  const a = await read(page, id);
  expect(a.parent, '섹션 직속').toBe('secA');
  expect([a.d.type, a.d.shape, a.d.arrowKind, a.d.arrowHead, a.d.arrowTip, a.d.arrowDash, a.d.thickness, a.d.arrowColor])
    .toEqual(['sticker', 'arrow', 'straight', 'end', 'fill', 'solid', '4', '#1a1a1a']);
  expect(Math.hypot(+a.d.x2 - +a.d.x1, +a.d.y2 - +a.d.y1), '기본 길이 160 가로').toBe(160);
  expect(a.d.y1).toBe(a.d.y2);
  const box = await page.evaluate((id) => { const b = document.getElementById(id), s = b.parentElement; return [b.offsetLeft >= 0, b.offsetTop >= 0, b.offsetLeft + b.offsetWidth <= s.clientWidth, b.offsetTop + b.offsetHeight <= s.clientHeight]; }, id);
  expect(box, '상자가 섹션 안').toEqual([true, true, true, true]);
  expect([a.selected, a.hlb, a.corner], '골라짐 · 끝점 손잡이 2 · 모서리/회전 손잡이 0').toEqual([true, 2, 0]);
  expect(a.heads.length, '머리 1').toBe(1);
  expect(a.pe, '상자는 pointer-events:none(맞힘은 그림 안 path)').toBe('none');
  expect(await shown(page, '#stk-arrow-section'), '우측 Arrow Line 절').toBe(true);
  expect(errs).toEqual([]);
});

/* ═══ A2 ═══ */
test('A2 패널 — Arrow Line 절만 · 칩/칸이 dataset 과 그림에 닿는다 · 휨은 곡선만 · 다시 섞기는 손그림만', async ({ page }) => {
  const errs = await bootApp(page);
  await setup(page);
  const id = await make(page, { x1: 100, y1: 200, x2: 400, y2: 260, seed: 7 });
  await pick(page, id);
  for (const s of ['#stk-shape-section', '#stk-size-section', '#stk-colors-section', '#stk-text-rot-section', '#stk-hlb-section', '#stk-mode-section', '#stk-text-section'])
    expect(await shown(page, s), `${s} 는 숨는다`).toBe(false);
  expect(await shown(page, '#stk-arrow-section')).toBe(true);
  expect(await shown(page, '#stk-arrow-bend-row'), '직선에선 휨 행이 없다').toBe(false);
  expect(await shown(page, '#stk-arrow-reroll-row'), '직선에선 다시 섞기가 없다').toBe(false);

  await page.click('#stk-arrow-kind [data-arrow-kind="curve"]');
  let r = await read(page, id);
  expect([r.d.arrowKind, /Q/.test(r.body), await shown(page, '#stk-arrow-bend-row')], '곡선: dataset · 몸통 Q · 휨 행').toEqual(['curve', true, true]);
  const bodyBend40 = r.body;
  await typeInto(page, '#stk-arrow-bend-num', -60);
  r = await read(page, id);
  expect([r.d.arrowBend, r.body !== bodyBend40], '휨 칸이 그림에 닿는다').toEqual(['-60', true]);

  await page.click('#stk-arrow-kind [data-arrow-kind="elbow"]');
  r = await read(page, id);
  expect([r.d.arrowKind, /H/.test(r.body) && /V/.test(r.body), await shown(page, '#stk-arrow-bend-row')], '꺾은: H·V · 휨 행 숨음').toEqual(['elbow', true, false]);

  await page.click('#stk-arrow-head [data-arrow-head="both"]');
  expect((await read(page, id)).heads.map(h => h.end), '양쪽 머리').toEqual(['start', 'end']);
  await page.click('#stk-arrow-head [data-arrow-head="none"]');
  expect((await read(page, id)).heads.length, '머리 없음').toBe(0);
  await page.click('#stk-arrow-head [data-arrow-head="end"]');
  await page.click('#stk-arrow-tip [data-arrow-tip="open"]');
  r = await read(page, id);
  expect([r.d.arrowTip, r.heads[0].fill], '열린 V = 채움 없음').toEqual(['open', 'none']);

  await page.click('#stk-arrow-dash [data-arrow-dash="dashed"]');
  r = await read(page, id);
  expect([r.d.arrowDash, !!r.dash, r.heads.every(h => h.dash === null)], '파선은 몸통에만').toEqual(['dashed', true, true]);

  await typeInto(page, '#stk-arrow-thick-num', 10);
  r = await read(page, id);
  expect([r.d.thickness, r.sw], '두께 칸 → dataset · stroke-width').toEqual(['10', '10']);

  await typeInto(page, '#stk-arrow-color-hex', '3366FF');
  await expect.poll(async () => (await read(page, id)).d.arrowColor?.toLowerCase(), '색 칸 → dataset').toBe('#3366ff');
  expect((await read(page, id)).stroke?.toLowerCase(), '색 칸 → 그림 stroke').toBe('#3366ff');

  await page.click('#stk-arrow-kind [data-arrow-kind="hand"]');
  expect(await shown(page, '#stk-arrow-reroll-row'), '손그림에서만 다시 섞기').toBe(true);
  const before = await read(page, id);
  await page.click('#stk-arrow-reroll');
  const after = await read(page, id);
  expect([after.d.seed !== before.d.seed, after.body !== before.body, after.d.x1 === before.d.x1 && after.d.x2 === before.d.x2], '다시 섞기 = seed·흔들림만').toEqual([true, true, true]);
  expect((await read(page, id)).hlb, '패널 조작 뒤에도 끝점 손잡이 2').toBe(2);
  expect(errs).toEqual([]);
});

/* ═══ A3 ═══ */
test('A3 끝 손잡이 실마우스 끌기 — x2,y2 가 바뀌고 머리 꼭짓점이 새 끝점이다', async ({ page }) => {
  const errs = await bootApp(page);
  await setup(page);
  const id = await make(page, { x1: 100, y1: 200, x2: 300, y2: 200 });
  await pick(page, id);
  await waitStableRect(page, `[id="${id}"] .hlb-handle[data-endpoint="end"]`);
  const h = await page.evaluate((id) => {
    const e = document.querySelector(`[id="${id}"] .hlb-handle[data-endpoint="end"]`); const r = e.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2; return { x, y, hit: document.elementFromPoint(x, y) === e };
  }, id);
  expect(h.hit, '★전제: 누르는 점이 끝 손잡이 위다').toBe(true);
  const b0 = await read(page, id);
  await page.mouse.move(h.x, h.y); await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(h.x + i * 8, h.y + i * 6);
  await page.mouse.up();
  await expect.poll(async () => +(await read(page, id)).d.x2).toBeGreaterThan(+b0.d.x2 + 20);
  const a = await read(page, id);
  expect(+a.d.y2, 'y2 도 움직였다').toBeGreaterThan(+b0.d.y2 + 10);
  expect([a.d.x1, a.d.y1], '다른 끝은 그대로').toEqual([b0.d.x1, b0.d.y1]);
  const tip = a.heads[0].d.match(/-?\d+(?:\.\d+)?/g).slice(0, 2).map(Number);
  expect(tip, '채운 머리 꼭짓점 = 새 끝점').toEqual([+a.d.x2, +a.d.y2]);
  expect(a.hlb, '끈 뒤에도 손잡이 2').toBe(2);
  expect(errs).toEqual([]);
});

/* ═══ A4 ═══ */
test('A4 몸통 끌기 — 네 끝점이 같은 Δ · 끈 뒤에도 손잡이 2', async ({ page }) => {
  const errs = await bootApp(page);
  await setup(page);
  const id = await make(page, { x1: 100, y1: 120, x2: 300, y2: 220 });
  await pick(page, id);
  const b0 = await read(page, id);
  const [x, y, k] = await toClient(page, 200, 170);   // 선의 가운데
  const hit = await page.evaluate(([x, y, id]) => document.elementFromPoint(x, y)?.closest('.sticker-block')?.id === id, [x, y, id]);
  expect(hit, '★전제: 누르는 점이 화살표 몸통 위다').toBe(true);
  await page.mouse.move(x, y); await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(x + i * 8, y + i * 5);
  await page.mouse.up();
  await expect.poll(async () => +(await read(page, id)).d.x1).toBeGreaterThan(+b0.d.x1 + 10);
  const a = await read(page, id);
  const dx1 = +a.d.x1 - +b0.d.x1, dx2 = +a.d.x2 - +b0.d.x2, dy1 = +a.d.y1 - +b0.d.y1, dy2 = +a.d.y2 - +b0.d.y2;
  expect([dx1, dy1], '두 끝이 같은 양').toEqual([dx2, dy2]);
  expect(Math.abs(dx1 - 64 / k), `Δx ≈ 끈 양(${(64 / k).toFixed(1)})`).toBeLessThanOrEqual(2);
  expect(a.hlb, '끈 뒤에도 끝점 손잡이 2(그리기가 innerHTML 을 갈아도)').toBe(2);
  expect(errs).toEqual([]);
});

/* ═══ A5 ═══ */
test('A5 ★맞힘 — 대각선 상자의 빈 귀퉁이는 화살표가 아니다 · 선 위는 화살표다 · 빈 귀퉁이 클릭은 화살표를 안 고른다', async ({ page }) => {
  const errs = await bootApp(page);
  await setup(page);
  const id = await make(page, { x1: 100, y1: 60, x2: 400, y2: 360 });
  await page.evaluate(() => window.deselectAll?.());
  const box = await page.evaluate((id) => { const b = document.getElementById(id); return { l: b.offsetLeft, t: b.offsetTop, w: b.offsetWidth, h: b.offsetHeight }; }, id);
  // 오른쪽 위 귀퉁이(섹션 좌표) — 상자 안이지만 선에서 멀다
  const cx = box.l + box.w - 20, cy = box.t + 20;
  expect(cx > 300 && cy < 120, `★전제: 귀퉁이 점이 상자 안·선에서 멀다 (${cx},${cy})`).toBe(true);
  const [ex, ey] = await toClient(page, cx, cy);
  const [lx, ly] = await toClient(page, 250, 210);
  const r = await page.evaluate(([ex, ey, lx, ly, id]) => ({
    corner: document.elementFromPoint(ex, ey)?.closest('.sticker-block')?.id || null,
    cornerSec: !!document.elementFromPoint(ex, ey)?.closest('#secA'),
    line: document.elementFromPoint(lx, ly)?.closest('.sticker-block')?.id || null,
  }), [ex, ey, lx, ly, id]);
  expect(r.cornerSec, '★전제: 귀퉁이 점은 섹션 위').toBe(true);
  expect(r.corner, '빈 귀퉁이가 화살표를 맞힌다 — 아래 블럭 클릭을 먹는다').toBeNull();
  expect(r.line, '선 위는 화살표').toBe(id);
  await clickAt(page, ex, ey, { sel: '#secA, #secA *', not: '.sticker-block' }, { label: '빈 귀퉁이' });
  expect((await read(page, id)).selected, '빈 귀퉁이 클릭이 화살표를 골랐다').toBe(false);
  expect(errs).toEqual([]);
});

/* ═══ A6 ═══ */
test('A6 저장 → 새 페이지에서 다시 열기 = 같은 값·같은 그림 · 칩 한 번 = ⌘Z 한 칸', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await make(page, { x1: 80, y1: 100, x2: 360, y2: 300, arrowKind: 'curve', arrowHead: 'both', arrowTip: 'open', arrowDash: 'dotted', thickness: 6, arrowBend: -30, arrowColor: '#3366ff', seed: 42 });
  const before = await read(page, id);
  const snap = await page.evaluate(() => window.serializeProject());
  for (const attr of ['data-shape="arrow"', 'data-arrow-kind="curve"', 'data-arrow-head="both"', 'data-arrow-tip="open"', 'data-arrow-dash="dotted"', 'data-arrow-bend="-30"', 'data-arrow-color="#3366ff"', 'data-x1="80"', 'data-y2="300"'])
    expect(snap.includes(attr.replace(/"/g, '\\"')), `저장본에 ${attr} 가 없다`).toBe(true);
  expect(/hlb-handle/.test(snap), '저장본에 손잡이가 샜다').toBe(false);

  const errs = await bootApp(page);
  expect(await arrowIds(page), '★전제: 새 페이지엔 화살표가 없다').toEqual([]);
  await page.evaluate((d) => window.applyProjectData(JSON.parse(d)), snap);
  await expect.poll(async () => (await arrowIds(page)).length, '다시 열었는데 화살표가 없다').toBe(1);
  await waitZoomSettled(page);   // ★두 번째 bootApp + applyProjectData 는 setup 을 안 지난다 — 여기서 따로 기다린다
  const after = await read(page, id);
  expect(after, '★같은 id 로 돌아왔다').not.toBeNull();
  expect(after.d, '값이 전부 같다').toEqual(before.d);
  expect(after.html, '★다시 연 그림이 저장 전과 다르다').toBe(before.html);

  await pick(page, id);
  const b1 = await read(page, id);
  await expectOneUndoStep(page, async () => {
    await page.click('#stk-arrow-head [data-arrow-head="none"]');
    await expect.poll(async () => (await read(page, id)).heads.length).toBe(0);
  }, '화살표 머리');
  const un = await read(page, id);
  expect([un.d.arrowHead, un.heads.length, un.html === b1.html], '⌘Z 한 번에 값·그림이 조작 전으로').toEqual(['both', 2, true]);
  expect(errs).toEqual([]);
});

/* ═══ A7 ═══ */
test('A7 ⌘C⌘V · ⌘D — 새 id · 그림 있음 · 눌러서 골라진다 · (M4-1) 사본 끝점은 재서 적기만', async ({ page }) => {
  const errs = await bootApp(page);
  await setup(page);
  const id = await make(page, { x1: 100, y1: 100, x2: 300, y2: 160, arrowHead: 'both' });
  await pick(page, id);
  await page.keyboard.press('Meta+c');
  await page.keyboard.press('Meta+v');
  await expect.poll(async () => (await arrowIds(page)).length, '★전제: ⌘C⌘V 로 둘').toBe(2);
  const ids2 = await arrowIds(page);
  const copy = ids2.find(x => x !== id);
  expect(new Set(ids2).size, '새 id').toBe(2);
  const c = await read(page, copy), o = await read(page, id);
  expect([c.heads.length, /arrow-body/.test(c.html)], '사본에 그림이 있다').toEqual([2, true]);
  test.info().annotations.push({ type: 'M4-1 ⌘C⌘V 끝점', description: `원본 ${o.d.x1},${o.d.y1}→${o.d.x2},${o.d.y2} · 사본 ${c.d.x1},${c.d.y1}→${c.d.x2},${c.d.y2} · 사본 data-x/y ${c.d.x},${c.d.y}` });
  console.log(`[A7 M4-1] ⌘C⌘V 원본 ${o.d.x1},${o.d.y1}→${o.d.x2},${o.d.y2} · 사본 ${c.d.x1},${c.d.y1}→${c.d.x2},${c.d.y2}`);
  /* 사본을 «코드로» 비켜 놓고 누르면 골라진다(묶였다) — 겹친 채 누르면 어느 것이 맞을지 모른다 */
  await page.evaluate((cid) => window._translateSticker(document.getElementById(cid), 0, 200), copy);
  await pick(page, copy);

  await page.evaluate(() => window.deselectAll?.());
  await pick(page, id);
  await page.keyboard.press('Meta+d');
  await expect.poll(async () => (await arrowIds(page)).length, '★전제: ⌘D 로 셋').toBe(3);
  const ids3 = await arrowIds(page);
  const dup = ids3.find(x => !ids2.includes(x));
  const d = await read(page, dup);
  expect([new Set(ids3).size, d.heads.length], '⌘D 사본: 새 id · 그림').toEqual([3, 2]);
  console.log(`[A7 M4-1] ⌘D 사본 ${d.d.x1},${d.d.y1}→${d.d.x2},${d.d.y2}`);
  expect(errs).toEqual([]);
});

/* ═══ A8 ═══ */
test('A8 ★PNG(CDP 오프스크린) · 썸네일(html2canvas) — 머리 픽셀이 산다(대조 = 머리 없음) · 파선 틈이 산다(대조 = 실선)', async ({ page }) => {
  await bootApp(page);
  await setup(page, SEC_HTML('secA', '#ffffff', 400));
  // 위 줄: 머리 있음(실선) · 둘째 줄: 머리 없음(대조) · 셋째 줄: 파선 · 넷째 줄: 실선(대조)
  await make(page, { x1: 100, y1: 60,  x2: 400, y2: 60,  thickness: 8, arrowHead: 'end',  arrowColor: '#000000' });
  await make(page, { x1: 100, y1: 140, x2: 400, y2: 140, thickness: 8, arrowHead: 'none', arrowColor: '#000000' });
  await make(page, { x1: 100, y1: 220, x2: 400, y2: 220, thickness: 8, arrowHead: 'none', arrowDash: 'dashed', arrowColor: '#000000' });
  await make(page, { x1: 100, y1: 300, x2: 400, y2: 300, thickness: 8, arrowHead: 'none', arrowColor: '#000000' });
  await page.evaluate(() => window.deselectAll?.());
  const rect = await page.evaluate(() => {
    const clone = document.getElementById('secA').cloneNode(true);
    clone.id = 'secA-clone';
    clone.style.cssText += ';position:fixed;top:-99999px;left:0;width:860px;margin:0;outline:none;';
    document.body.appendChild(clone);
    const r = clone.getBoundingClientRect();
    return { x: r.left, y: r.top, w: Math.round(r.width), h: Math.round(r.height) };
  });
  const cdp = await page.context().newCDPSession(page);
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: rect.x, y: rect.y, width: rect.w, height: rect.h, scale: 1 } });
  const h2c = await page.evaluate(async () => {
    const cv = await html2canvas(document.getElementById('secA-clone'), { scale: 1, useCORS: true, backgroundColor: '#ffffff', logging: false });
    return cv.toDataURL('image/png').split(',')[1];
  });
  const measure = (b64) => page.evaluate(async ({ b64, w }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const k = img.width / w;
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const x = cv.getContext('2d'); x.drawImage(img, 0, 0);
    const dark = (X, Y) => { const p = x.getImageData(Math.round(X * k), Math.round(Y * k), 1, 1).data; return (p[0] + p[1] + p[2]) / 3 < 100; };
    /* 머리 안·몸통 밖 띠(꼭짓점 400 · 길이 24 · 반폭 12 · 몸통 반두께 4): x 378~384 · y 중심 +5~+7 */
    const headZone = (cy) => { let n = 0, all = 0; for (let X = 378; X <= 384; X++) for (let Y = cy + 5; Y <= cy + 7; Y++) { all++; if (dark(X, Y)) n++; } return n / all; };
    /* 몸통 가운데 줄의 «밝은 점» 수(x 110~370) — 파선은 틈이 있고 실선은 0 */
    const gaps = (cy) => { let n = 0; for (let X = 110; X <= 370; X++) if (!dark(X, cy)) n++; return n; };
    return { head: headZone(60), headCtl: headZone(140), gapDash: gaps(220), gapSolid: gaps(300) };
  }, { b64, w: rect.w });
  for (const [name, m] of [['PNG(CDP)', await measure(shot.data)], ['썸네일(html2canvas)', await measure(h2c)]]) {
    expect(m.headCtl, `${name}: ★전제(대조) 머리 없는 줄의 같은 자리는 바탕`).toBeLessThan(0.1);
    expect(m.head, `${name}: 머리 픽셀이 죽었다`).toBeGreaterThan(0.8);
    expect(m.gapSolid, `${name}: ★전제(대조) 실선엔 틈이 없다`).toBe(0);
    expect(m.gapDash, `${name}: 파선의 틈이 죽었다(stroke-dasharray)`).toBeGreaterThan(15);
  }
});

/* ═══ A9 ═══ */
test('A9 기억 — 다음 「Arrow Line」이 스타일을 잇고 · 일반 「Sticker」는 화살표를 안 낳는다 · 즐겨찾기는 말하고 거절', async ({ page }) => {
  const errs = await bootApp(page);
  await setup(page);
  await selectSection(page);
  await clickPenMenu(page, 'Arrow Line');
  await expect.poll(async () => (await arrowIds(page)).length).toBe(1);
  const [first] = await arrowIds(page);
  await page.click('#stk-arrow-head [data-arrow-head="both"]');
  await page.click('#stk-arrow-kind [data-arrow-kind="elbow"]');
  await typeInto(page, '#stk-arrow-thick-num', 9);
  const fav = await page.evaluate((id) => { const ok = window.addStickerFavorite(document.getElementById(id)); return { ok, toast: document.getElementById('editor-toast')?.textContent || null }; }, first);
  expect(fav, '즐겨찾기는 «말하고» 거절').toEqual({ ok: false, toast: '⚠️ 이 모양은 즐겨찾기에 추가할 수 없습니다' });

  await selectSection(page);
  await clickPenMenu(page, 'Arrow Line');
  await expect.poll(async () => (await arrowIds(page)).length).toBe(2);
  const second = (await arrowIds(page)).find(x => x !== first);
  const s = await read(page, second);
  expect([s.d.arrowHead, s.d.arrowKind, s.d.thickness], '다음 화살표가 스타일을 잇는다').toEqual(['both', 'elbow', '9']);
  expect(s.d.x1 !== (await read(page, first)).d.x1 || s.d.y1 !== (await read(page, first)).d.y1, '자리는 계단식(겹치지 않음)').toBe(true);

  await selectSection(page);
  const n0 = await page.evaluate(() => document.querySelectorAll('.sticker-block').length);
  await clickPenMenu(page, 'Sticker');
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('.sticker-block').length)).toBe(n0 + 1);
  const last = await page.evaluate(() => { const all = [...document.querySelectorAll('.sticker-block')]; return all[all.length - 1].dataset.shape; });
  expect(last, '일반 「Sticker」가 화살표를 낳았다(__last 에 올라갔다)').not.toBe('arrow');
  expect(errs).toEqual([]);
});

/* ═══ A10 ═══ */
test('A10 Esc · deselectAll 뒤 .selected 0 · .hlb-handle 0 · 콘솔 오류 0', async ({ page }) => {
  const errs = await bootApp(page);
  const cerr = [];
  page.on('console', (m) => { if (m.type() === 'error') cerr.push(m.text()); });
  await setup(page);
  const id = await make(page, { x1: 100, y1: 100, x2: 300, y2: 100 });
  await pick(page, id);
  expect((await read(page, id)).hlb, '★전제: 손잡이 2').toBe(2);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => [document.querySelectorAll('.sticker-block.selected').length, document.querySelectorAll('.hlb-handle').length])).toEqual([0, 0]);
  await pick(page, id);
  await page.evaluate(() => window.deselectAll());
  expect(await page.evaluate(() => [document.querySelectorAll('.sticker-block.selected').length, document.querySelectorAll('.hlb-handle').length])).toEqual([0, 0]);
  expect(errs).toEqual([]);
  expect(cerr.filter(t => /arrow|ArrowFx|sticker/i.test(t)), '화살표·스티커 콘솔 오류').toEqual([]);
});
