/* fix5-grad-paste.dom.spec.js — 1020t1b 그라데이션 ⌘C⌘V(·⌘D) 사본이 흐름(.section-inner)에 떨어진다
 *
 * 현빈 👉 「그라데이션 블럭 하나 추가한 뒤에 복사해서 붙여넣기하면 붙여넣기한 그라데이션 블럭이 제대로 붙여넣기가 안되는 이슈」
 * 실앱 실측(ca702d40): 사본 = .section-inner 안 · position static · left/top 빈 값 · 섹션 283→583 · 레이어 「Gradient」 줄 1 그대로 · 끌어도 안 움직임.
 * 뿌리: js/editor.js pasteClipboard 단건 갈래가 그라데이션을 «흐름 블럭»으로 다뤘다(insertAfterSelectedAsSibling → _normalizePastedAbsolute)
 *   + _bindPastedEl 이 그라데이션 제 바인더(bindGradientSelect)를 안 불렀다.
 *
 * 장면은 앱 제 문(새 섹션 버튼 · 스티커 패널 메뉴 Gradient · 마우스 클릭 · ⌘C/⌘V/⌘D · 마우스 끌기)으로 짓는다.
 *   예외 하나: P3 끌기 칸은 그라데이션을 섹션보다 작게 만들어야 끌기가 «움직일 자리»가 생긴다(기본 860×300 은 섹션 폭·높이를 덮어
 *   끌기 클램프가 0 으로 누른다 — 원본도 같다). 그 크기 바꾸기는 MCP 가 부르는 앱 창구 window.updateGradientBlock 로 한다.
 * 판정은 모델 px(dataset.x/y · offsetHeight)와 DOM 구조로만 한다.
 *
 *   P1 ⌘C⌘V — 사본: 섹션 직속 · computed position absolute · 원본과 다른 자리 · 섹션 높이 그대로 · 레이어 gradient 줄 +1 · 사본만 선택
 *   P2 ⌘D   — 같은 다섯 칸(⌘D 는 copySelected+pasteClipboard 로 같은 길)
 *   P3 끌기  — 작은 그라데이션 ⌘C⌘V 사본을 마우스로 끌면 dataset.x/y 가 끈 만큼 바뀌고 원본은 그대로
 *   R1 회귀  — 흐름 글자 블럭 ⌘C⌘V 는 여전히 .section-inner 안(다른 종류 붙여넣기 무변)
 *   P4 여러 블럭 — 글자(레이어 줄 클릭) + 그라데이션(⌘클릭)을 같이 골라 ⌘C⌘V(multi-block 갈래 · editor.js 의 그라데이션 줄):
 *        그라데이션 사본 = 섹션 직속 · absolute · 원본과 다른 자리 · 섹션 높이는 «글자 사본 몫» 이하로만 늘고 그라데이션 300 은 안 더해진다.
 *        ⚠️글자 사본의 «자리»는 단언하지 않는다 — 마지막 고른 것이 섹션 직속 블럭이면 글자 사본이 흐름 밖으로 새는
 *          고치기 전부터의 결함(F3 · pasteClipboard multi-block 의 anchor)이 있고 이번 단위 범위 밖이다. 글자 사본은 «생겼다»만 전제로 본다.
 *        글자는 캔버스에서 그라데이션(860×300 · 텍스트 위 쌓임)에 덮여 있어 «레이어 패널 줄»로 고른다(앱 제 문).
 *
 * 양성대조(고치기 전 바이트): GD1001_ROOT=<ca702d40 를 git archive 로 뜬 스크래치 경로> 로 같은 칸을 돌린다(_root-harness.js).
 * ⛔앱(electron)·포트 무접촉 — bootApp 은 page.route 로 파일만 서빙한다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/fix5-grad-paste.dom.spec.js --workers=1
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const VIEW = { width: 1440, height: 900 };
const log = (tag, o) => console.log(`FIX5GP ${tag} ${JSON.stringify(o)}`);

async function pollTrue(page, fn, arg, timeout = 6000) {
  try { await page.waitForFunction(fn, arg, { timeout, polling: 100 }); return true; } catch { return false; }
}
const secIds = (page) => page.evaluate(() => [...document.querySelectorAll('#canvas .section-block:not([data-ghost])')].map(s => s.id));
const gradIds = (page) => page.evaluate(() => [...document.querySelectorAll('#canvas .gradient-block')].map(g => g.id));
const scrollTo = (page, sel) => page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center', behavior: 'instant' }), sel);

async function softClick(page, x, y, sel) {
  const hit = await page.evaluate(([x, y, sel]) => { const e = document.elementFromPoint(x, y); if (!e) return { ok: false, hit: null };
    return { ok: !!(e.matches(sel) || e.closest(sel)), hit: (e.id ? '#' + e.id : '') + '.' + String(e.className?.baseVal ?? e.className ?? e.tagName).split(' ')[0] }; }, [x, y, sel]);
  if (hit.ok) await page.mouse.click(x, y);
  return hit;
}
/* ★F2(검수 1020t1b) — 부하에서 흔들렸다. 고정 대기 없이 «조건»으로만 기다린다:
 *   앱 준비(새 섹션 버튼이 보이고 #canvas 가 있다) → 누르기 → 새 섹션이 생길 때까지(15s) →
 *   히트존이 «멈추고» 그 자리를 실제로 맞힐 때까지 기다렸다 누르기 → 골라질 때까지. 못 골랐으면 같은 길을 최대 5회 다시. */
async function newSection(page) {
  const BTN = '.fp-btn.primary[title="새 섹션 추가"]';
  await page.locator(BTN).waitFor({ state: 'visible', timeout: 15000 });
  expect(await pollTrue(page, () => !!document.getElementById('canvas'), null, 15000), '전제: #canvas 가 있다').toBe(true);
  const before = await secIds(page);
  await page.click(BTN);
  expect(await pollTrue(page, (n) => document.querySelectorAll('#canvas .section-block:not([data-ghost])').length > n, before.length, 15000),
    '전제: 새 섹션이 생겼다').toBe(true);
  const id = (await secIds(page)).find(x => !before.includes(x)) || null;
  expect(id, '전제: 새 섹션 id').toBeTruthy();
  const SEC = `[id="${id}"]`, HZ = SEC + ' .section-hitzone';
  let picked = false, lastHit = null;
  for (let i = 0; i < 5 && !picked; i++) {
    await scrollTo(page, SEC);
    const hz = await waitStableRect(page, HZ);
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    const x = hz.left + 10, y = hz.cy;
    // 그 점이 정말 히트존을 맞힐 때까지(덮개·애니메이션이 걷힐 때까지) 기다린다
    await pollTrue(page, ([x, y, sel]) => { const e = document.elementFromPoint(x, y); return !!(e && (e.matches(sel) || e.closest(sel))); }, [x, y, HZ], 5000);
    lastHit = await softClick(page, x, y, HZ);
    picked = await pollTrue(page, (id) => window.getSelectedSection?.()?.id === id, id, 3000);
  }
  expect(picked, `전제: 새 섹션을 골랐다(마지막으로 맞힌 것 ${lastHit?.hit})`).toBe(true);
  return id;
}
async function addGradientByMenu(page) {
  const before = await gradIds(page);
  await page.click('#fp-pen-btn');
  await page.locator('#fp-pen-menu .fp-menu-item').filter({ hasText: /^\s*Gradient\s*$/ }).first().click();
  await pollTrue(page, (n) => document.querySelectorAll('#canvas .gradient-block').length > n, before.length);
  const ids = (await gradIds(page)).filter(x => !before.includes(x));
  expect(ids.length, '전제: 메뉴 Gradient 로 그라데이션 1개가 생겼다').toBe(1);
  return ids[0];
}
async function clickBlock(page, id) {
  const S = `[id="${id}"]`;
  await scrollTo(page, S);
  const r = await waitStableRect(page, S);
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  const hit = await softClick(page, r.cx, r.cy, S);
  expect(hit.ok, `전제: ${id} 를 맞혔다(맞힌 것 ${hit.hit})`).toBe(true);
  expect(await pollTrue(page, (id) => document.getElementById(id)?.classList.contains('selected'), id, 3000), `전제: ${id} 가 골라졌다`).toBe(true);
}
async function pressAndWaitNewGrad(page, key) {
  const before = await gradIds(page);
  await page.keyboard.press(key);
  await pollTrue(page, (n) => document.querySelectorAll('#canvas .gradient-block').length > n, before.length);
  const ids = (await gradIds(page)).filter(x => !before.includes(x));
  expect(ids.length, `전제: ${key} 로 그라데이션 사본 1개가 생겼다`).toBe(1);
  return ids[0];
}
// 판정 자 — DOM 구조 · 모델 px
const facts = (page, src, cp, secId) => page.evaluate(([src, cp, secId]) => {
  const s = document.getElementById(src), c = document.getElementById(cp), sec = document.getElementById(secId);
  const one = (e) => ({ id: e.id, parent: e.parentElement?.className?.split(' ')[0] || null, parentIsSec: e.parentElement === sec,
    inInner: !!e.closest('.section-inner'), pos: getComputedStyle(e).position, x: e.dataset.x, y: e.dataset.y,
    left: e.style.left, top: e.style.top, selected: e.classList.contains('selected') });
  return { src: one(s), cp: one(c), secH: sec.offsetHeight,
    layerGrad: document.querySelectorAll('[data-layer-type="gradient"]').length };
}, [src, cp, secId]);

async function scene(page) {
  await page.setViewportSize(VIEW);
  const errs = await bootApp(page);
  const secId = await newSection(page);
  const src = await addGradientByMenu(page);
  await clickBlock(page, src);
  const secH0 = await page.evaluate((s) => document.getElementById(s).offsetHeight, secId);
  const layer0 = await page.evaluate(() => document.querySelectorAll('[data-layer-type="gradient"]').length);
  return { errs, secId, src, secH0, layer0 };
}
function judge(tag, f, secH0, layer0) {
  log(tag, { ...f, secH0, layer0 });
  expect.soft(f.cp.parentIsSec, `${tag}: 사본 부모 = 섹션 직속(실제 ${f.cp.parent})`).toBe(true);
  expect.soft(f.cp.inInner, `${tag}: 사본이 .section-inner(흐름) 밖`).toBe(false);
  expect.soft(f.cp.pos, `${tag}: 사본 computed position`).toBe('absolute');
  expect.soft(f.cp.x === f.src.x && f.cp.y === f.src.y, `${tag}: 사본이 원본과 다른 자리(원본 ${f.src.x},${f.src.y} · 사본 ${f.cp.x},${f.cp.y})`).toBe(false);
  expect.soft(f.cp.left, `${tag}: 사본 style.left = dataset.x`).toBe(`${f.cp.x}px`);
  expect.soft(f.cp.top, `${tag}: 사본 style.top = dataset.y`).toBe(`${f.cp.y}px`);
  expect.soft(f.secH, `${tag}: 섹션 높이 그대로(${secH0})`).toBe(secH0);
  expect.soft(f.layerGrad, `${tag}: 레이어 gradient 줄 +1`).toBe(layer0 + 1);
  expect.soft(f.cp.selected && !f.src.selected, `${tag}: 사본만 골라졌다(사본 ${f.cp.selected} · 원본 ${f.src.selected})`).toBe(true);
}

test('P1 ⌘C⌘V — 그라데이션 사본이 섹션 직속 absolute 오버레이로 선다', async ({ page }) => {
  test.setTimeout(120000);
  const { errs, secId, src, secH0, layer0 } = await scene(page);
  await page.keyboard.press('Meta+c');
  const cp = await pressAndWaitNewGrad(page, 'Meta+v');
  judge('P1', await facts(page, src, cp, secId), secH0, layer0);
  expect(errs, '페이지 에러 0').toEqual([]);
});

test('P2 ⌘D — 그라데이션 복제도 같은 꼴', async ({ page }) => {
  test.setTimeout(120000);
  const { errs, secId, src, secH0, layer0 } = await scene(page);
  const cp = await pressAndWaitNewGrad(page, 'Meta+d');
  judge('P2', await facts(page, src, cp, secId), secH0, layer0);
  expect(errs, '페이지 에러 0').toEqual([]);
});

test('P3 끌기 — 붙여넣은 사본을 마우스로 끌면 움직이고 원본은 그대로', async ({ page }) => {
  test.setTimeout(120000);
  const { errs, secId, src } = await scene(page);
  // USER_BUSY 가드(최근 키 1.5s)는 «사람이 타이핑 중» 판정이다 — 장면 짓기 키(Escape)를 지난 일로 돌린다(그 가드 자체는 이 시험 대상 밖).
  const up = await page.evaluate((id) => { window._lastUserKeydown = 0; return window.updateGradientBlock(id, { width: 300, height: 100 }); }, src);
  expect(up?.ok, '전제: 원본을 300×100 으로 줄였다(MCP 창구)').toBe(true);
  await clickBlock(page, src);
  await page.keyboard.press('Meta+c');
  const cp = await pressAndWaitNewGrad(page, 'Meta+v');
  const before = await facts(page, src, cp, secId);
  const r = await waitStableRect(page, `[id="${cp}"]`);
  const zoom = await page.evaluate(() => (window.currentZoom || 100) / 100);
  /* 모델 px. 끌기엔 «변 맞닿기 스냅»(js/gradient-select.js _gradEdgeSnap · 화면 px 임계 ÷ 줌)이 있어 끝자리가 임계만큼 빨려 갈 수 있다 —
     그래서 «끈 만큼 ± SNAP_TOL» 로 잰다(고치기 전 판은 Δ 0,0 이라 이 너그러움과 무관하게 빨강). */
  const DX = 150, DY = 100, SNAP_TOL = 30;
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  const hit = await page.evaluate(([x, y, id]) => { const e = document.elementFromPoint(x, y); return !!(e && (e.id === id || e.closest(`[id="${id}"]`))); }, [r.cx, r.cy, cp]);
  expect(hit, '전제: 사본 가운데를 맞힌다').toBe(true);
  await page.mouse.move(r.cx, r.cy);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(r.cx + DX * zoom * i / 6, r.cy + DY * zoom * i / 6);
  await page.mouse.up();
  const after = await facts(page, src, cp, secId);
  log('P3', { before, after, zoom });
  const dx = Number(after.cp.x) - Number(before.cp.x), dy = Number(after.cp.y) - Number(before.cp.y);
  expect.soft(Math.abs(dx - DX) <= SNAP_TOL && Math.abs(dy - DY) <= SNAP_TOL, `P3: 사본이 끈 만큼 움직였다(Δ ${dx},${dy} · 기대 ${DX},${DY} ±${SNAP_TOL})`).toBe(true);
  expect.soft(after.cp.parentIsSec, 'P3: 끈 뒤에도 섹션 직속').toBe(true);
  expect.soft([after.src.x, after.src.y], 'P3: 원본 자리 그대로').toEqual([before.src.x, before.src.y]);
  expect(errs, '페이지 에러 0').toEqual([]);
});

test('R1 회귀 — 흐름 글자 블럭 ⌘C⌘V 는 그대로 .section-inner 안', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize(VIEW);
  const errs = await bootApp(page);
  const secId = await newSection(page);
  const n0 = await page.evaluate((s) => document.getElementById(s).querySelectorAll('.text-block').length, secId);
  await page.evaluate(() => window.addTextBlock('body', { content: '회귀 글자' }));
  expect(await pollTrue(page, ([s, n]) => document.getElementById(s).querySelectorAll('.text-block').length > n, [secId, n0]), '전제: 글자 블럭이 생겼다').toBe(true);
  const tb = await page.evaluate(([s, n]) => [...document.getElementById(s).querySelectorAll('.text-block')][n].id, [secId, n0]);
  await clickBlock(page, tb);
  await page.keyboard.press('Meta+c');
  await page.keyboard.press('Meta+v');
  expect(await pollTrue(page, ([s, n]) => document.getElementById(s).querySelectorAll('.text-block').length > n + 1, [secId, n0]), 'R1: 사본 글자 블럭이 생겼다').toBe(true);
  const f = await page.evaluate(([s, tb]) => [...document.getElementById(s).querySelectorAll('.text-block')].filter(e => e.id !== tb)
    .map(e => ({ id: e.id, inInner: !!e.closest('.section-inner'), pos: getComputedStyle(e).position })), [secId, tb]);
  log('R1', f);
  expect(f.every(e => e.inInner), 'R1: 글자 사본은 흐름(.section-inner) 안').toBe(true);
  expect(errs, '페이지 에러 0').toEqual([]);
});

test('P4 여러 블럭 — 글자 + 그라데이션 ⌘C⌘V 에서 그라데이션 사본도 섹션 직속 오버레이', async ({ page }) => {
  test.setTimeout(150000);
  await page.setViewportSize(VIEW);
  const errs = await bootApp(page);
  const secId = await newSection(page);
  const n0 = await page.evaluate((s) => document.getElementById(s).querySelectorAll('.text-block').length, secId);
  await page.evaluate(() => window.addTextBlock('body', { content: '여러 블럭 글자' }));
  expect(await pollTrue(page, ([s, n]) => document.getElementById(s).querySelectorAll('.text-block').length > n, [secId, n0]), '전제: 글자 블럭이 생겼다').toBe(true);
  const tb = await page.evaluate(([s, n]) => [...document.getElementById(s).querySelectorAll('.text-block')][n].id, [secId, n0]);
  expect(await pollTrue(page, (s) => window.getSelectedSection?.()?.id === s, secId, 3000), '전제: 붙일 섹션이 골라져 있다').toBe(true);
  const src = await addGradientByMenu(page);

  // ① 글자 = 레이어 패널 줄 클릭(진짜 마우스). 줄은 그 블럭을 쥔 줄(_dragTarget)로 찾는다.
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await page.evaluate(() => window.buildLayerPanel?.());
  expect(await pollTrue(page, (tb) => [...document.querySelectorAll('[data-layer-type]')].some(it => it._dragTarget?.id === tb || it._dragTarget?.contains?.(document.getElementById(tb))), tb, 6000),
    '전제: 글자의 레이어 줄이 있다').toBe(true);
  await page.evaluate((tb) => { const it = [...document.querySelectorAll('[data-layer-type]')].find(it => it._dragTarget?.id === tb || it._dragTarget?.contains?.(document.getElementById(tb))); it.scrollIntoView({ block: 'center', behavior: 'instant' }); }, tb);
  let row = null;
  for (let i = 0; i < 40; i++) {   // 줄의 화면 자리가 두 번 같을 때까지(조건 대기 — 정지 확인은 evaluate 왕복으로)
    const r = await page.evaluate((tb) => { const it = [...document.querySelectorAll('[data-layer-type]')].find(it => it._dragTarget?.id === tb || it._dragTarget?.contains?.(document.getElementById(tb)));
      const b = it.getBoundingClientRect(); return { x: Math.round(b.left + Math.min(40, b.width / 2)), y: Math.round(b.top + b.height / 2), w: b.width, h: b.height }; }, tb);
    if (row && r.x === row.x && r.y === row.y && r.w > 0 && r.h > 0) break;
    row = r;
    await pollTrue(page, () => new Promise(res => requestAnimationFrame(() => res(true))), null, 1000);
  }
  await page.mouse.click(row.x, row.y);
  expect(await pollTrue(page, (tb) => document.getElementById(tb)?.classList.contains('selected'), tb, 3000), '전제: 글자가 골라졌다(레이어 줄)').toBe(true);

  // ② 그라데이션 = 캔버스에서 ⌘클릭(더해 고르기)
  await scrollTo(page, `[id="${src}"]`);
  const gr = await waitStableRect(page, `[id="${src}"]`);
  await pollTrue(page, ([x, y, id]) => { const e = document.elementFromPoint(x, y); return !!(e && (e.id === id || e.closest(`[id="${id}"]`))); }, [gr.cx, gr.cy, src], 5000);
  await page.keyboard.down('Meta');
  await page.mouse.click(gr.cx, gr.cy);
  await page.keyboard.up('Meta');
  expect(await pollTrue(page, ([tb, g]) => document.getElementById(tb)?.classList.contains('selected') && document.getElementById(g)?.classList.contains('selected'), [tb, src], 3000),
    '전제: 글자 + 그라데이션 둘 다 골라졌다').toBe(true);

  const secH0 = await page.evaluate((s) => document.getElementById(s).offsetHeight, secId);
  const textH = await page.evaluate((tb) => document.getElementById(tb).offsetHeight, tb);
  const gBefore = await gradIds(page);
  await page.keyboard.press('Meta+c');
  await page.keyboard.press('Meta+v');
  expect(await pollTrue(page, (n) => document.querySelectorAll('#canvas .gradient-block').length > n, gBefore.length), '전제: 그라데이션 사본이 생겼다').toBe(true);
  expect(await pollTrue(page, ([s, n]) => document.getElementById(s).querySelectorAll('.text-block').length > n + 1, [secId, n0]), '전제: 글자 사본도 생겼다(자리는 안 본다 — F3)').toBe(true);
  const cp = (await gradIds(page)).filter(x => !gBefore.includes(x))[0];
  const f = await facts(page, src, cp, secId);
  log('P4', { ...f, secH0, textH });
  const grew = f.secH - secH0;
  expect.soft(f.cp.parentIsSec, `P4: 그라데이션 사본 부모 = 섹션 직속(실제 ${f.cp.parent})`).toBe(true);
  expect.soft(f.cp.inInner, 'P4: 그라데이션 사본이 .section-inner(흐름) 밖').toBe(false);
  expect.soft(f.cp.pos, 'P4: 그라데이션 사본 computed position').toBe('absolute');
  expect.soft(f.cp.x === f.src.x && f.cp.y === f.src.y, `P4: 그라데이션 사본이 원본과 다른 자리(원본 ${f.src.x},${f.src.y} · 사본 ${f.cp.x},${f.cp.y})`).toBe(false);
  expect.soft(grew >= 0 && grew <= textH + 2, `P4: 섹션은 글자 사본 몫(${textH}) 이하로만 자란다 — 그라데이션 300 이 안 더해진다(${secH0}→${f.secH} · +${grew})`).toBe(true);
  expect(errs, '페이지 에러 0').toEqual([]);
});
