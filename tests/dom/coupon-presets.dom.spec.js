/* coupon-presets.dom.spec.js — 쿠폰 프리셋 칩의 «진짜 끝» (현빈 발주 2026-10-08 · 지디 GO)
 *
 * ★무엇을 재나 — 「dataset 이 바뀌었나」가 아니라 ★「사람이 ★누르면 ★보이는 것이 바뀌나」다.
 *   ⇒ ★진짜 마우스로 누르고, ★getComputedStyle·★SVG 로 재고, ★저장본은 ★HTML 왕복으로 잰다.
 *   ⛔「명부가 하나인가」·「칩이 명부를 읽나」는 ★unit 몫이다(tests/unit/coupon-presets.test.mjs).
 *
 * ★★「칸이 ★뜬다」와 「기능이 ★돈다」를 ★따로 빨개지게 갈랐다 — 한 칸에 섞으면
 *   ★「깨졌다」로 읽히고 ★처방까지 틀린다(지디 2026-10-08 ⑵).
 *     C-P4a = ★뜬다(칩 다섯 · active 0)        ← 안 뜨면 ★여기만 빨강
 *     C-P4b = ★돈다(누르면 ★그림이 바뀐다)      ← 안 돌면 ★여기만 빨강
 *
 * ★★변이 명부 — ★★«실측»이다(2026-10-08 · 넷을 ★실제로 돌려 ★빨간 이름을 적었다).
 *   ⛔내가 ★예상해 적은 것이 ★아니다 — ★초판은 ★각 변이에 ★한 칸씩 적었는데 ★실측은 ★달랐다.
 *     W1 prop-coupon.js 의 `${couponPresetChipsHTML(block)}` 줄 제거 → ★C-P4a · C-P4b · C-P5
 *     W2 prop-coupon.js 의 `[data-cpn-preset]` 배선 제거            → ★C-P4b · C-P5
 *     W3 applyCouponPreset 의 `ds.preset = key` 제거                → ★C-P4b · C-P4b2 · C-P5
 *     W4 applyCouponPreset 의 `if (k === 'width') continue;` 제거   → ★C-P4c
 *   ★★W2 와 W3 는 ★처음엔 ★«같은 두 칸»을 빨갛게 했다 — ★수트가 ★그 둘을 ★못 갈랐다.
 *     ⇒ ★C-P4b2 에 ★`ds.preset` 단언을 ★하나 더해 ★갈랐다(배선을 ★안 타는 경로라 ★W3 만 문다).
 *   (명부·label·허용값 변이는 unit 이 진다 — 여기선 ★안 겹친다.)
 *
 * ⛔앱을 «안» 띄운다 — 고디터 인스턴스·MCP 9345 대역 무접촉(실앱 9371 은 현빈이 보고 있다).
 *   하네스는 tests/dom/coupon-block.dom.spec.js 의 것을 ★그대로 쓴다(★이름을 ★실물에서 뽑았다).
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js coupon-presets
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-blocks.css">
<!-- ★우측 패널 CSS 넷을 ★같이 얹는다 — ⛔안 얹으면 #panel-right 에 ★폭이 없어 패널이 본문 폭으로
     펴지고 ★아무것도 안 눌린다(C-PANEL5 가 고장난 판에서도 초록이던 ★그 사고 · 2026-10-07). -->
<link rel="stylesheet" href="/css/editor-panels.css">
<link rel="stylesheet" href="/css/editor-props.css"></head><body style="margin:0">
<div id="canvas-scaler" style="transform: scale(1); transform-origin: 0 0;">
  <div id="canvas" style="width:860px">
    <div class="section-block"><div class="section-inner" id="host" style="width:860px"></div></div>
  </div>
</div>
<div id="ss-handles-overlay"></div>
<div class="panel" id="panel-right"><div class="panel-body"></div></div>
<script src="/js/feature-flags.js"></script>
<script src="/js/panel-dispatch.js"></script>
<script src="/js/block-edit.js"></script>
<script>
  /* 공용 클릭 루프(js/block-drag.js)가 쓰는 «앱 수준» 함수 — 하네스엔 없다(선례의 그 다섯). */
  window.deselectAll = () => { document.querySelectorAll('.selected').forEach(e => e.classList.remove('selected')); };
  window.syncSection = () => {};
  window.highlightBlock = () => {};
  window.setBlockAnchor = () => {};
  window.toggleBlockSelect = () => {};
  /* ★히스토리·자동저장 대역 — ★부른 수를 센다(⛔「쌓였다」를 눈으로 안 본다). */
  window.__hist = 0; window.__save = 0;
  window.pushHistory = () => { window.__hist++; };
  window.scheduleAutoSave = () => { window.__save++; };
</script>
<script type="module">
  import { makeCouponBlock, renderCouponBlock, applyCouponPreset, _cpnState,
           COUPON_SLOTS, COUPON_DEFAULTS } from '/js/blocks/coupon-block.js';
  import { CPN_PRESETS, CPN_PRESET_KEYS } from '/js/blocks/coupon-presets.js';
  import { showCouponProperties } from '/js/props/prop-coupon.js';
  window.__mk = makeCouponBlock;
  window.__render = renderCouponBlock;
  window.__apply = applyCouponPreset;
  window.__state = _cpnState;
  window.__open = showCouponProperties;
  window.__SLOTS = COUPON_SLOTS;
  window.__DEF = COUPON_DEFAULTS;
  window.__PRESETS = CPN_PRESETS;
  window.__KEYS = CPN_PRESET_KEYS;
  window.__ready = true;
</script></body></html>`;

async function boot(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

const raf = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

async function mount(page, ds = {}) {
  await page.evaluate((ds) => {
    const { row, block } = window.__mk({});
    Object.assign(block.dataset, ds);
    document.getElementById('host').appendChild(row);
    window.__render(block);
    window.__block = block;
  }, ds);
}

/** ★사람이 하는 순서 — ★고르면 ★정본 표(panel-dispatch)가 ★패널을 연다. ⛔window.* 직접 호출로 열지 않는다. */
async function openPanel(page) {
  await page.evaluate(() => {
    document.querySelector('#panel-right .panel-body').innerHTML = '';
    window.selectBlock?.(window.__block.id);
  });
  await raf(page);
}

/** ★좌표는 ★매번 다시 잰다 — ⑴0×0 아님 ⑵elementFromPoint 가 그 요소 ⑶창 안, ★셋을 ★같이. */
async function clickChip(page, key) {
  const pre = await page.evaluate((k) => {
    const btn = document.querySelector(`[data-cpn-preset="${k}"]`);
    if (!btn) return { ok: false, why: 'no-chip' };
    const r = btn.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return { ok: false, why: `zero-size ${r.width}x${r.height}` };
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) return { ok: false, why: `offscreen ${cx},${cy}` };
    const hit = document.elementFromPoint(cx, cy);
    if (!hit || !(hit === btn || btn.contains(hit))) {
      return { ok: false, why: `covered by ${hit && hit.className}` };
    }
    return { ok: true, x: cx, y: cy, w: r.width, h: r.height };
  }, key);
  expect(pre.ok, `★칩(${key})을 ★누를 수 없다 — ${pre.why}`).toBe(true);
  await page.mouse.click(pre.x, pre.y);
  await raf(page);
  return pre;
}

/* ═══════════════════════════════════════════════════════════════════════════
   C-P4a — ★칩이 ★«뜬다» (⛔누름·그림은 ★여기서 안 잰다)
═══════════════════════════════════════════════════════════════════════════ */

test('C-P4a ★칩이 ★뜬다 — 패널에 ★명부 수만큼 ＋ ★새 쿠폰은 ★아무 칩도 안 켜졌다', async ({ page }) => {
  // ⇐ 되돌리기(W1): prop-coupon.js 의 couponPresetChipsHTML(block) 호출 제거 → 빨강
  const errs = await boot(page);
  await mount(page);
  await openPanel(page);
  const r = await page.evaluate(() => {
    const chips = [...document.querySelectorAll('[data-cpn-preset]')];
    return {
      /* ★전제 — 패널이 ★정말 열렸나(안 열렸으면 「칩 0개」는 ★다른 까닭이다) */
      panelOpen: /글자 칸/.test(document.getElementById('panel-right').innerHTML),
      n: chips.length,
      rosterN: window.__KEYS.length,
      keys: chips.map(c => c.getAttribute('data-cpn-preset')),
      active: chips.filter(c => c.classList.contains('active')).map(c => c.getAttribute('data-cpn-preset')),
      /* ★글자가 ★쪼개지지 않나 — C-PANEL5 의 그 자(한 줄 높이로 잰다) */
      tall: chips.filter(c => c.getBoundingClientRect().height > 40).map(c => c.textContent.trim()),
      labels: chips.map(c => c.textContent.trim()),
      presetAttr: window.__block.dataset.preset,
    };
  });
  expect(r.panelOpen, '★전제: 쿠폰 패널이 안 열렸다 — 이 칸은 칩을 재고 있지 않다').toBe(true);
  expect(r.n).toBe(r.rosterN);                      // ★명부 수와 같다(수는 ★명부에서 읽는다)
  expect(r.n).toBeGreaterThanOrEqual(5);            // ★전제: 명부가 비지 않았다
  expect(r.active).toEqual([]);                     // ★새 쿠폰 = ★프리셋 없음(⛔거짓말을 안 한다)
  expect(r.presetAttr).toBeUndefined();
  /* ★칩 글자가 ★한 줄에 읽힌다 — ⛔줄임표로 가리지 않았다 */
  expect(r.tall, `★칩 글자가 두 줄로 쪼개졌다 — ${r.tall.join(' / ')}`).toEqual([]);
  expect(r.labels.every(s => s.length > 0), '★글자 없는 칩이 있다').toBe(true);
  expect(errs).toEqual([]);
});

/* ═══════════════════════════════════════════════════════════════════════════
   C-P4b — ★기능이 ★«돈다» (★진짜 클릭 → ★그림이 바뀐다)
═══════════════════════════════════════════════════════════════════════════ */

test('C-P4b ★칩을 ★진짜로 누르면 ★그림·높이·색이 바뀌고 ★그 칩이 켜진다', async ({ page }) => {
  // ⇐ 되돌리기(W2): prop-coupon.js 의 [data-cpn-preset] 배선 제거 → 빨강
  const errs = await boot(page);
  await mount(page);
  await openPanel(page);

  const before = await page.evaluate(() => {
    const b = window.__block, s = getComputedStyle(b);
    return {
      h: Math.round(parseFloat(s.height)), w: Math.round(parseFloat(s.width)),
      nPath: b.querySelectorAll('.cpn-bg path').length,
      fills: [...b.querySelectorAll('.cpn-bg path')].map(p => p.getAttribute('fill')),
      numFs: Math.round(parseFloat(getComputedStyle(b.querySelector('[data-cpn-slot="num"]')).fontSize)),
      split: b.dataset.split, cw: b.dataset.cw, preset: b.dataset.preset,
      hist: window.__hist,
      /* ★기대값은 ★명부에서 끌어온다 — ⛔수를 ★여기 적지 않는다 */
      want: window.__PRESETS.jetix.v,
      wantNumSize: window.__PRESETS.jetix.slots.num.size,
    };
  });
  /* ★전제 — ★바뀔 수 있는 판인가(이미 그 값이면 ★이 칸은 아무것도 안 가른다) */
  expect(before.preset, '★전제: 이미 프리셋이 걸려 있다').toBeUndefined();
  expect(String(before.cw), '★전제: cw 가 이미 프리셋 값이다 — 이 대조가 값을 못 잠근다')
    .not.toBe(String(before.want.cw));

  await clickChip(page, 'jetix');

  const after = await page.evaluate(() => {
    const b = window.__block, s = getComputedStyle(b);
    const chip = document.querySelector('[data-cpn-preset="jetix"]');
    const want = window.__PRESETS.jetix;
    const boxW = Math.round(parseFloat(s.width));
    return {
      h: Math.round(parseFloat(s.height)), w: boxW,
      nPath: b.querySelectorAll('.cpn-bg path').length,
      fills: [...b.querySelectorAll('.cpn-bg path')].map(p => p.getAttribute('fill')),
      numFs: Math.round(parseFloat(getComputedStyle(b.querySelector('[data-cpn-slot="num"]')).fontSize)),
      /* ★기대 글자 크기 — ★명부 × ★폭 비율. ⛔수를 ★검사에 적지 않는다(식은 _cpnEffFontSize 의 것) */
      wantNumFs: Math.round(want.slots.num.size * (boxW / want.v.cw)),
      split: b.dataset.split, cw: b.dataset.cw, preset: b.dataset.preset,
      state: window.__state(b),
      hist: window.__hist, save: window.__save,
      chipActive: !!(chip && chip.classList.contains('active')),
      activeN: document.querySelectorAll('[data-cpn-preset].active').length,
    };
  });

  /* ⑴ ★모델이 바뀌었다 — ★값은 ★명부에서 끌어와 견준다 */
  expect(after.preset).toBe('jetix');
  expect(after.cw).toBe(String(before.want.cw));
  expect(after.split).toBe(before.want.split);
  /* ⑵ ★★`_cpnState` 가 ★그 값을 ★받았다 — ⛔「dataset 에 썼다」로 끝내지 않는다
        (허용 목록을 벗어났으면 ★여기서 ★기본값으로 ★떨어진다) */
  expect(after.state.split).toBe(before.want.split);
  expect(after.state.cw).toBe(before.want.cw);
  expect(after.state.bodyCol).toBe(before.want.bodyCol);
  /* ⑶ ★★사람이 ★보는 것이 바뀌었다 — ★색 · ★조각 수 · ★글자 크기
     ⚠️⛔«높이»로 재지 ★마라 — ★다섯 프리셋이 ★전부 ★16:9 라 ★폭이 같으면 ★높이도 ★같다
       (실측 2026-10-08: 460px 에서 leisure 258 · 나머지 ★259 = ★바꾸기 전과 같다).
       ★초판이 ★`not.toBe(before.h)` 로 재서 ★빨갰는데, ★그건 ★제품이 아니라 ★★이 시험의 흠이었다. */
  expect(before.fills.includes(before.want.bodyCol),
    '★전제: 바꾸기 ★전에 이미 그 색이다 — 이 대조가 값을 못 잠근다').toBe(false);
  expect(after.fills, `★배경 색이 안 바뀌었다 — 그림이 다시 안 그려졌다 [${after.fills.join(',')}]`)
    .toContain(before.want.bodyCol);
  /* ★`split:'two'` 는 ★조각을 ★둘로 가른다 ⇒ ★path 가 ★는다(⛔수를 적지 않고 ★늘었나로 잰다) */
  expect(before.nPath, '★전제: 바꾸기 전 조각이 하나여야 한다').toBe(1);
  expect(after.nPath, '★조각이 안 늘었다 — split 이 그림에 안 닿았다').toBeGreaterThan(before.nPath);
  /* ★글자도 ★화면에서 바뀐다 — ★기대값은 ★명부 × 폭비율(식은 `_cpnEffFontSize` 의 것) */
  expect(after.numFs, '★큰 숫자의 화면 크기가 프리셋을 안 따랐다').toBe(after.wantNumFs);
  expect(after.numFs, '★글자 크기가 안 바뀌었다').not.toBe(before.numFs);
  /* ⛔윗줄 «글자»는 ★여기서 안 잰다 — ★C-P4b2 가 쥔다(한 칸에 섞지 않는다). */
  /* ⑷ ★칩 하나만 켜진다 */
  expect(after.chipActive).toBe(true);
  expect(after.activeN).toBe(1);
  /* ⑸ ★한 번 누름 = ★히스토리 ★한 칸(⛔두 칸이면 ⌘Z 가 두 번이 된다) */
  expect(after.hist - before.hist, '★칩 한 번에 히스토리가 한 칸이 아니다').toBe(1);
  expect(after.save).toBeGreaterThanOrEqual(1);
  expect(errs).toEqual([]);
});

test('C-P4b2 ★프리셋 글자가 ★캔버스에 들어간다 ＋ ★음성대조: 명부 밖 키는 ★아무것도 안 바꾼다', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  await openPanel(page);
  const r = await page.evaluate(() => {
    const b = window.__block;
    const want = window.__PRESETS.sake;
    const res = window.__apply(b, 'sake');
    window.__render(b);
    const got = b.querySelector('[data-cpn-slot="top"]')?.textContent;
    /* ★음성대조 — ★명부 밖 키는 ★거절되고 ★dataset 이 ★안 움직인다 */
    const snap = JSON.stringify({ ...b.dataset });
    const bad = window.__apply(b, '__nosuchpreset');
    const same = JSON.stringify({ ...b.dataset }) === snap;
    return { ok: res.ok, skipped: res.skipped, wantTop: want.slots.top.text, got, badOk: bad.ok, badWhy: bad.reason, same,
      dsPreset: b.dataset.preset };
  });
  expect(r.ok).toBe(true);
  /* ★★걸러진 값이 ★0 이어야 한다 — 하나라도 있으면 ★그 축이 ★조용히 빠진 것이다 */
  expect(r.skipped, `★제품 축이 못 받은 값이 있다 — ${r.skipped.join(' · ')}`).toEqual([]);
  expect(r.got, '★프리셋의 윗줄 글자가 캔버스에 안 들어갔다').toBe(r.wantTop);
  /* ★★`ds.preset` 은 ★여기서도 잰다 — ★배선을 ★안 타는 경로라 ★★W2(배선 제거)와 ★W3(preset 제거)를
     ★가른다(★그 둘이 ★C-P4b·C-P5 만 빨갛게 할 때는 ★구분이 안 됐다 — 실측 2026-10-08). */
  expect(r.dsPreset, '★applyCouponPreset 이 ★어느 칩인지를 ★안 남긴다').toBe('sake');
  expect(r.badOk).toBe(false);
  expect(r.badWhy).toBe('unknown-preset');
  expect(r.same, '★명부 밖 키인데 ★dataset 이 움직였다').toBe(true);
  expect(errs).toEqual([]);
});

test('C-P4c ★사용자가 끈 ★폭은 ★프리셋이 ★안 건드린다 (비율만 따라온다)', async ({ page }) => {
  // ⇐ 되돌리기(W4): applyCouponPreset 의 `if (k === 'width') continue;` 제거 → 빨강
  const errs = await boot(page);
  await mount(page, { width: '300' });          // ★사람이 손잡이로 300 으로 끌어 둔 판
  await openPanel(page);
  const r = await page.evaluate(() => {
    const b = window.__block;
    const w0 = Math.round(parseFloat(getComputedStyle(b).width));
    window.__apply(b, 'leisure');
    window.__render(b);
    return {
      w0, w1: Math.round(parseFloat(getComputedStyle(b).width)),
      dsW: b.dataset.width,
      defW: String(window.__DEF.width),
      cw: b.dataset.cw, wantCw: String(window.__PRESETS.leisure.v.cw),
    };
  });
  /* ★전제 — ★사용자 폭이 ★기본값과 ★다르다(같으면 이 대조가 아무것도 안 가른다) */
  expect(r.dsW, '★전제: 사용자 폭이 기본값과 같다 — 다른 수로 끌어 둬라').not.toBe(r.defW);
  expect(r.w0).toBe(300);
  expect(r.w1, '★프리셋이 ★사용자 폭을 덮었다').toBe(300);
  expect(r.dsW).toBe('300');
  expect(r.cw, '★비율(cw)은 ★따라와야 한다 — 안 따라오면 프리셋이 안 먹은 것이다').toBe(r.wantCw);
  expect(errs).toEqual([]);
});

/* ═══════════════════════════════════════════════════════════════════════════
   C-P5 — ★저장 ★왕복: ★다시 열어도 ★그 칩이 켜져 있다
═══════════════════════════════════════════════════════════════════════════ */

test('C-P5 ★저장 → 다시 열기 왕복에서 ★그 칩이 ★여전히 켜져 있다', async ({ page }) => {
  // ⇐ 되돌리기(W3): applyCouponPreset 의 `ds.preset = key` 제거 → 빨강
  const errs = await boot(page);
  await mount(page);
  await openPanel(page);
  await clickChip(page, 'coupon32');

  const saved = await page.evaluate(() => {
    const html = document.getElementById('host').innerHTML;
    /* ★그림을 통째로 지운다 — 로드가 «스냅샷에 기대고 있나»를 가린다(C-LOAD 선례의 그 수법) */
    return { html: html.replace(/<div class="cpn-bg"[\s\S]*?<\/div>/, '<div class="cpn-bg"></div>'), raw: html };
  });
  /* ★전제 — ★저장본 HTML 에 ★그 칸이 ★실제로 들었나(안 들었으면 왕복이 뜻이 없다) */
  expect(saved.raw).toContain('data-preset="coupon32"');

  const r = await page.evaluate((html) => {
    const host = document.getElementById('host');
    host.innerHTML = html;
    const b = host.querySelector('.coupon-block');
    const before = { paths: b.querySelectorAll('.cpn-bg path').length };
    window.__render(b);                       // ★로드 경로가 하는 그 한 줄(save-load.js:1439)
    window.__block = b;
    document.querySelector('#panel-right .panel-body').innerHTML = '';
    window.__open(b);                         // ★다시 열기
    const chips = [...document.querySelectorAll('[data-cpn-preset]')];
    return {
      before,
      paths: b.querySelectorAll('.cpn-bg path').length,
      preset: b.dataset.preset,
      active: chips.filter(c => c.classList.contains('active')).map(c => c.getAttribute('data-cpn-preset')),
      /* ⚠️⛔`querySelector('path')` ★하나로 ★본체색을 집지 ★마라 — ★`shadow:'layer'` 면
         ★★그림자 path 가 ★첫째다(실측 2026-10-08: coupon32 의 fills = [shCol, bodyCol]).
         ★초판이 그래서 빨갰다 — ★제품이 아니라 ★★이 자의 흠이었다. ⇒ ★전수로 모아 ★포함으로 잰다. */
      fills: [...b.querySelectorAll('.cpn-bg path')].map(p => p.getAttribute('fill')),
      wantFill: window.__PRESETS.coupon32.v.bodyCol,
      wantShadow: window.__PRESETS.coupon32.v.shCol,
    };
  }, saved.html);

  expect(r.before.paths, '★전제: 지운 그림이 실제로 0 에서 출발해야 한다').toBe(0);
  expect(r.paths, '★그림이 dataset 에서 안 되살아났다').toBeGreaterThanOrEqual(1);
  expect(r.preset).toBe('coupon32');
  expect(r.active, '★다시 열었더니 ★칩이 꺼져 있다 — dataset.preset 이 안 남았다').toEqual(['coupon32']);
  expect(r.fills, `★본체색이 왕복에서 안 살았다 [${r.fills.join(',')}]`).toContain(r.wantFill);
  /* ★`shadow:'layer'` 도 ★같이 살았나 — ★그림자 색이 ★따로 그려진다(그 한 축이 안 살면 여기만 빨강) */
  expect(r.fills, `★겹친 그림자가 왕복에서 안 살았다 [${r.fills.join(',')}]`).toContain(r.wantShadow);
  expect(errs).toEqual([]);
});

/* ═══════════════════════════════════════════════════════════════════════════
   C-P7 — ★알려진 ★미비(지디 2026-10-08 판정). ⛔1차에서 «고치지 않는다»
   ───────────────────────────────────────────────────────────────────────────
   ★`_cpnState` 는 `badgeOn`·`decoOn` 을 ★dataset 에서 ★«아예 안 읽고» ★false 리터럴로 덮는다
     (js/blocks/coupon-block.js — 그 두 줄). ⇒ ★`dataset.badgeOn='1'` 을 써도 ★영영 무시된다.
   ★그래서 ★시안 ⑥ naverpay(배지 프리셋)는 ★2차다 — ★명부에 ★올리지 않았다.
   ★test.fail(true, …) 로 둔다 — ★「지금은 빨갛다」를 그냥 빨간 검사로 두면 ★다음 빨강을 가린다.
     ⇒ ★2단계에서 ★고치는 순간 「Expected to fail, but passed」로 ★빨개져 알려 준다.
       ★그때 ★이 test.fail 줄을 떼고, ★unit C-P1 의 「다섯」 래칫도 ★같이 올려라.
   ★선례 = 같은 폴더 coupon-block.dom.spec.js `C-EXPORT`(그 파일 :628).
═══════════════════════════════════════════════════════════════════════════ */

test('C-P7 ★알려진 미비 — `badgeOn` 은 dataset 을 안 읽는다(배지 프리셋 ⑥ 은 2단계)', async ({ page }) => {
  test.fail(true, '★아직 안 고쳤다(1차 범위 밖). 고치면 이 표시가 빨개진다 — 그때 test.fail 을 떼라.');
  const errs = await boot(page);
  await mount(page, { badgeOn: '1', decoOn: '1' });
  const r = await page.evaluate(() => {
    const b = window.__block;
    const st = window.__state(b);
    return { dsBadge: b.dataset.badgeOn, dsDeco: b.dataset.decoOn, badgeOn: st.badgeOn, decoOn: st.decoOn };
  });
  /* ★전제 — ★dataset 에 ★실제로 썼다(안 썼으면 이 칸은 미비를 재고 있지 않다) */
  expect(r.dsBadge, '★전제: dataset.badgeOn 을 못 썼다').toBe('1');
  expect(r.dsDeco, '★전제: dataset.decoOn 을 못 썼다').toBe('1');
  /* ★★원하는 것 — ★dataset 을 ★읽어야 한다. ★지금은 ★안 읽어서 ★빨강이다 */
  expect(r.badgeOn, '★_cpnState 가 dataset.badgeOn 을 안 읽는다').toBe(true);
  expect(r.decoOn, '★_cpnState 가 dataset.decoOn 을 안 읽는다').toBe(true);
  expect(errs).toEqual([]);
});

