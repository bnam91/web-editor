/* coupon-block.dom.spec.js — 쿠폰 블럭의 «진짜 끝» (현빈 발주 2026-10-07 · 1단계)
 *
 * ★무엇을 재나 — 「dataset 이 바뀌었나」가 아니라 ★「사람이 보는 것이 바뀌었나」다.
 *   그래서 ★진짜 마우스로 끌고, getComputedStyle 로 ★재고, ⌘Z 는 ★스택이 몇 칸 늘었나로 센다.
 *
 * ⛔앱을 «안» 띄운다 — 고디터 인스턴스·MCP 9345 대역 무접촉(실앱 9371 은 현빈이 보고 있다).
 *   하네스는 tests/dom/modal-resize.dom.spec.js 의 page.route 를 그대로 쓴다.
 *
 * ★변이 명부(지디 발주 ⑶) — 이 파일이 지는 칸:
 *     V3 panel-dispatch 의 coupon 줄을 빼면        → C-PANEL 빨강
 *     V4 save-load 의 renderCouponBlock 줄을 빼면  → C-LOAD  빨강
 *     V5 addCouponBlock 이름을 add…Block 밖으로    → C-UNDO  빨강(칸이 하나 줄어 모달과 갈린다)
 *     V6 다섯 중 한 칸을 _cpnEffFontSize 밖으로    → C-SHRINK 빨강
 *   (V1·V2 는 tests/unit/coupon-path.test.mjs 가 진다 — 여기선 안 겹친다.)
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js coupon-block
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

/* 실제 캔버스와 같은 모양 — 오버레이는 #canvas-scaler «밖»이다(줌에 안 곱해진다).
   호스트 폭 860 = 고디터 캔버스 폭. */
const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-blocks.css"></head><body style="margin:0">
<div id="canvas-scaler" style="transform: scale(1); transform-origin: 0 0;">
  <div id="canvas" style="width:860px">
    <div class="section-block"><div class="section-inner" id="host" style="width:860px"></div></div>
  </div>
</div>
<div id="ss-handles-overlay"></div>
<div id="panel-right"><div class="panel-body"></div></div>
<script src="/js/feature-flags.js"></script>
<!-- ★«진짜» panel-dispatch + selectBlock 을 얹는다(플레인 스크립트).
     스텁을 쓰면 C-PANEL 의 전제(「표가 패널을 연다」)가 사라져 거짓 그린이 된다. -->
<script src="/js/panel-dispatch.js"></script>
<script src="/js/block-edit.js"></script>
<script>
  /* ★공용 클릭 루프(js/block-drag.js)가 쓰는 «앱 수준» 함수 다섯 — 하네스엔 없다.
     ⛔없이 두면 핸들러가 «deselectAll is not a function» 으로 ★첫 줄에서 죽고,
       검사는 「패널이 안 열렸다」를 ★제품 결함으로 읽는다(실측으로 물렸다 · 2026-10-07).
     ★선택 배선 자체는 이 칸이 재는 것이 아니다 — 그건 C-PANEL1 이 ★진짜 selectBlock 으로 잰다.
     ★그래서 ★최소로만 세우고, 각 칸이 ★pageerror 0 을 같이 단언한다(다음에 또 빠지면 드러난다). */
  window.deselectAll = () => {
    document.querySelectorAll('.selected').forEach(e => e.classList.remove('selected'));
  };
  window.syncSection = () => {};
  window.highlightBlock = () => {};
  window.setBlockAnchor = () => {};
  window.toggleBlockSelect = () => {};
</script>
<script type="module">
  import { makeCouponBlock, renderCouponBlock, addCouponBlock, couponStubHasRoom,
           COUPON_SLOTS, COUPON_DEFAULTS } from '/js/blocks/coupon-block.js';
  import { showCouponProperties } from '/js/props/prop-coupon.js';
  /* ★대조군용 — ★래퍼 «밖» 원본. C-UNDO 가 「같은 문으로 쟀나」를 이것과 견줘 확인한다.
     ⛔이것을 ★부르지 마라(수가 하나 적다) — ★비교용으로만 둔다. */
  import { addModalBlock as __rawModal } from '/js/blocks/modal-block.js';
  window.__rawModal = __rawModal;
  import { showHandlesFor } from '/js/overlay-handles.js';
  import { bindBlock } from '/js/drag-drop.js';
  window.__mk = makeCouponBlock;
  window.__render = renderCouponBlock;
  window.__add = addCouponBlock;
  window.__open = showCouponProperties;
  window.__show = showHandlesFor;
  window.__bind = bindBlock;
  window.__stubRoom = couponStubHasRoom;
  window.__SLOTS = COUPON_SLOTS;
  window.__DEF = COUPON_DEFAULTS;
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

/** 쿠폰 하나를 캔버스에 올린다. 아직 «선택»하지 않는다 — 양성대조(손잡이 0개)를 먼저 재기 위해. */
async function mount(page, ds = {}) {
  await page.evaluate((ds) => {
    const { row, block } = window.__mk({});
    Object.assign(block.dataset, ds);
    document.getElementById('host').appendChild(row);
    window.__render(block);
    window.__block = block;
  }, ds);
}

/** 실제 앱과 같은 경로 — .selected 를 붙이고 showHandlesFor 를 부른다. */
async function select(page) {
  await page.evaluate(() => { window.__block.classList.add('selected'); window.__show(window.__block); });
  await raf(page);
}

const handleCount = (page) => page.evaluate(() =>
  document.querySelectorAll('#ss-handles-overlay .cpn-overlay-handle').length);

/* ═══════════════════════════════════════════════════════════════════════════
   C-MAKE — 블럭이 «실제로» 생기고, 배경 SVG 와 글자 칸이 화면에 있다
═══════════════════════════════════════════════════════════════════════════ */

test('C-MAKE1 ★블럭이 선다 — 클래스·id 접두·16:9 크기·배경 SVG 한 장', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  const r = await page.evaluate(() => {
    const b = window.__block, s = getComputedStyle(b);
    const svg = b.querySelector('.cpn-bg svg');
    return {
      cls: b.className, idPfx: b.id.slice(0, 4), type: b.dataset.type,
      w: Math.round(parseFloat(s.width)), h: Math.round(parseFloat(s.height)),
      svgCount: b.querySelectorAll('svg').length,
      svgW: svg && svg.getAttribute('width'), svgH: svg && svg.getAttribute('height'),
      viewBox: svg && svg.getAttribute('viewBox'),
      paths: b.querySelectorAll('.cpn-bg path').length,
    };
  });
  expect(r.cls).toBe('coupon-block');
  expect(r.idPfx).toBe('cpn_');                        // ★save-load 의 접두와 같아야 한다
  expect(r.type).toBe('coupon');
  expect(r.w).toBe(460);
  expect(r.h).toBe(259);                               // ★16:9 — 폭에서 «나온» 값
  expect(r.svgCount).toBe(1);
  /* ★전제 — 생성기 출력의 width/height 를 «실제로» 100% 로 바꿨나(cpnResponsiveSvg).
     ⛔안 바뀌면 그림이 460px 에 고정돼 폭을 줄여도 배경만 안 줄어든다. */
  expect(r.svgW).toBe('100%');
  expect(r.svgH).toBe('100%');
  expect(r.viewBox).toBe('0 0 460 259');               // ★좌표계는 ★안 건드렸다
  expect(r.paths).toBeGreaterThanOrEqual(1);
  expect(errs).toEqual([]);
});

test('C-MAKE2 ★글자 칸 — 기본은 «세 칸»이 보이고 다섯 칸이 모델에 있다(시안 그대로)', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  const r = await page.evaluate(() => {
    const b = window.__block;
    const shown = [...b.querySelectorAll('[data-cpn-slot]')].map(e => e.dataset.cpnSlot);
    return {
      shown,
      modelKeys: window.__SLOTS.map(s => s.key),
      defaultOn: window.__SLOTS.filter(s => s.on).map(s => s.key),
      stubRoom: window.__stubRoom(b),
      cls: [...b.querySelectorAll('[data-cpn-slot]')].map(e => e.className),
    };
  });
  /* ★다섯은 ★모델에 있다. 화면에 ★세 칸인 것은 ★시안 baseState 의 on=false 그대로다
     (bot·stub 이 꺼져 있다). ⛔「넷/다섯이 안 보인다」를 결함으로 읽지 마라 — 지디 Q2 ㈁ 판정. */
  expect(r.modelKeys).toEqual(['top', 'num', 'unit', 'bot', 'stub']);
  expect(r.defaultOn).toEqual(['top', 'num', 'unit']);
  expect(r.shown.sort()).toEqual(['num', 'top', 'unit']);
  /* ★스텁은 ★자리부터 없다 — 분할·절취선이 꺼져 있다(지디 Q2). */
  expect(r.stubRoom).toBe(false);
  /* ★내보내기 보험 — 글자 칸 클래스가 tb- 로 시작해야 generic 폴백에 걸린다. */
  for (const c of r.cls) expect(c).toMatch(/\btb-cpn-line\b/);
  expect(errs).toEqual([]);
});

test('C-MAKE3 ★스텁 칸을 켜도 «자리»가 없으면 안 그린다 — 분할을 켜면 그린다', async ({ page }) => {
  const errs = await boot(page);
  await mount(page, { slotStubOn: '1' });
  const before = await page.evaluate(() =>
    [...window.__block.querySelectorAll('[data-cpn-slot]')].map(e => e.dataset.cpnSlot));
  expect(before).not.toContain('stub');          // ★자리가 없으니 «없는 칸»이다
  await page.evaluate(() => { window.__block.dataset.split = 'lr'; window.__render(window.__block); });
  const after = await page.evaluate(() => ({
    slots: [...window.__block.querySelectorAll('[data-cpn-slot]')].map(e => e.dataset.cpnSlot),
    room: window.__stubRoom(window.__block),
  }));
  expect(after.room).toBe(true);
  expect(after.slots).toContain('stub');
  expect(errs).toEqual([]);
});

/* ═══════════════════════════════════════════════════════════════════════════
   C-PANEL — ★V3 의 자리. 「고른 칸만 열린다」(현빈 지시)
═══════════════════════════════════════════════════════════════════════════ */

test('C-PANEL1 ★정본 표가 쿠폰 패널을 연다 — selectBlock «만»으로', async ({ page }) => {
  // ⇐ 되돌리기(V3): js/panel-dispatch.js 의 ['coupon-block', …] 줄 제거 → 빨강
  const errs = await boot(page);
  await mount(page);
  const r = await page.evaluate(() => {
    document.querySelector('#panel-right .panel-body').innerHTML = '';
    /* ★전제 — 표가 이 블럭을 «안다»고 말하나. 모르면 아래 「패널이 떴다」는 다른 까닭이다. */
    const known = window.hasPanelForBlock ? window.hasPanelForBlock(window.__block) : null;
    window.selectBlock?.(window.__block.id);
    const html = document.getElementById('panel-right').innerHTML;
    return { known, hasHeader: /Coupon/.test(html), hasSlotList: /글자 칸/.test(html), len: html.length };
  });
  expect(r.known).toBe(true);
  expect(r.hasHeader).toBe(true);
  expect(r.hasSlotList).toBe(true);
  expect(errs).toEqual([]);
});

test('C-PANEL2 ★다섯을 «다 펼치지 않는다» — 아무 칸도 안 골랐으면 목록만', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  const r = await page.evaluate(() => {
    window.__open(window.__block);
    const html = document.getElementById('panel-right').innerHTML;
    return {
      openPanels: document.querySelectorAll('#cpn-slot-text').length,
      listRows: document.querySelectorAll('[data-cpn-open]').length,
      saysNone: /아무 칸도 펼치지 않은/.test(html),
    };
  });
  expect(r.openPanels).toBe(0);               // ★펼쳐진 칸 0 — 현빈 지시의 핵심
  expect(r.listRows).toBe(5);                 // ★다섯이 «목록»으로는 다 보인다
  expect(r.saysNone).toBe(true);
  expect(errs).toEqual([]);
});

test('C-PANEL3 ★캔버스 글자를 누르면 «그 칸만» 열리고, 또 누르면 닫힌다', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  await page.evaluate(() => window.__bind(window.__block));
  /* ★실제 클릭 — 좌표가 아니라 그 요소를 집어 누른다(맞힌 요소를 확인한다). */
  const hit = await page.evaluate(() => {
    const e = window.__block.querySelector('[data-cpn-slot="num"]');
    return e ? e.dataset.cpnSlot : null;
  });
  expect(hit).toBe('num');                    // ★전제: 누를 대상이 실제로 있다
  await page.locator('[data-cpn-slot="num"]').click();
  const one = await page.evaluate(() => ({
    open: document.querySelectorAll('#cpn-slot-text').length,
    title: document.querySelector('.prop-section-title:last-of-type')?.textContent || '',
    which: window.__block._cpnOpenSlot,
  }));
  expect(one.open).toBe(1);                   // ★한 칸만
  expect(one.which).toBe('num');
  /* ★같은 것을 또 누르면 «닫힌다» — 시안 setSel 의 토글. */
  await page.locator('[data-cpn-slot="num"]').click();
  const zero = await page.evaluate(() => ({
    open: document.querySelectorAll('#cpn-slot-text').length,
    which: window.__block._cpnOpenSlot,
  }));
  expect(zero.open).toBe(0);
  expect(zero.which).toBe(null);
  expect(errs).toEqual([]);
});

test('C-PANEL4 ★자리가 없는 스텁 줄은 «회색»이고 까닭을 적는다', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  const r = await page.evaluate(() => {
    window.__open(window.__block);
    const row = document.querySelector('[data-cpn-on="stub"]')?.closest('.prop-row');
    const other = document.querySelector('[data-cpn-on="num"]')?.closest('.prop-row');
    return {
      stubOpacity: row ? getComputedStyle(row).opacity : null,
      numOpacity: other ? getComputedStyle(other).opacity : null,
      why: /들어갈 자리가 없습니다/.test(document.getElementById('panel-right').innerHTML),
    };
  });
  expect(parseFloat(r.stubOpacity)).toBeLessThan(0.6);
  /* ★음성대조 — «다른» 줄은 ★안 흐리다. 전부 흐리면 아무것도 안 재는 것이다. */
  expect(parseFloat(r.numOpacity)).toBe(1);
  expect(r.why).toBe(true);
  expect(errs).toEqual([]);
});

/* ═══════════════════════════════════════════════════════════════════════════
   C-SHRINK — ★V6 의 자리. 폭을 줄이면 ★다섯 칸이 «전부» 비율로 줄어든다
═══════════════════════════════════════════════════════════════════════════ */

test('C-SHRINK ★폭을 반으로 줄이면 글자가 «전부» 반이 된다 (다섯 칸 전수 · 화면 값으로)', async ({ page }) => {
  // ⇐ 되돌리기(V6): renderCouponBlock 의 _lineEl 에서 한 칸만 저장값을 그대로 쓰게 하면 빨강
  const errs = await boot(page);
  /* ★다섯을 ★전부 켜고 ★자리까지 만든다(split lr) — 안 그러면 셋만 재고 「전수」라 적게 된다. */
  await mount(page, { split: 'lr', slotBotOn: '1', slotStubOn: '1' });
  const read = () => page.evaluate(() => {
    const out = {};
    for (const e of window.__block.querySelectorAll('[data-cpn-slot]')) {
      out[e.dataset.cpnSlot] = Math.round(parseFloat(getComputedStyle(e).fontSize) * 10) / 10;
    }
    return out;
  });
  const full = await read();
  /* ★전제 — ★다섯이 다 화면에 있나. 넷이면 「전수」가 거짓이 된다. */
  expect(Object.keys(full).sort()).toEqual(['bot', 'num', 'stub', 'top', 'unit']);

  await page.evaluate(() => { window.__block.dataset.width = '230'; window.__render(window.__block); });
  const half = await read();
  expect(Object.keys(half).sort()).toEqual(['bot', 'num', 'stub', 'top', 'unit']);

  /* ★한 칸씩 ★이름으로 잰다 — 「평균이 줄었다」로 뭉개지 않는다. 잰 값을 단언에 ★찍는다. */
  const moved = [];
  for (const k of Object.keys(full)) {
    const want = Math.max(6, Math.min(150, Math.round(full[k] * 0.5)));
    expect(half[k], `${k}: 폭 460→230 에서 ${full[k]}px → ${half[k]}px (기대 ${want}px)`).toBeCloseTo(want, 0);
    if (half[k] < full[k]) moved.push(k);
  }
  expect(moved.sort(), '★다섯이 전부 줄어야 한다').toEqual(['bot', 'num', 'stub', 'top', 'unit']);

  /* ★★저장본은 ★안 고친다 — 다시 넓히면 ★원래 크기가 되살아난다(zoom-geometry 규약). */
  await page.evaluate(() => { window.__block.dataset.width = '460'; window.__render(window.__block); });
  const back = await read();
  for (const k of Object.keys(full)) {
    expect(back[k], `${k}: 폭을 되돌렸는데 ${back[k]}px (원래 ${full[k]}px)`).toBeCloseTo(full[k], 0);
  }
  expect(errs).toEqual([]);
});

test('C-SHRINK2 ★배경도 같이 줄어든다 — 높이는 «폭에서 나온다»', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  await page.evaluate(() => { window.__block.dataset.width = '230'; window.__render(window.__block); });
  const r = await page.evaluate(() => {
    const b = window.__block, s = getComputedStyle(b);
    const svg = b.querySelector('.cpn-bg svg').getBoundingClientRect();
    return { w: Math.round(parseFloat(s.width)), h: Math.round(parseFloat(s.height)),
             svgW: Math.round(svg.width), svgH: Math.round(svg.height) };
  });
  expect(r.w).toBe(230);
  expect(r.h).toBe(130);                // round(259 * 230/460) = 130
  expect(r.svgW).toBe(230);             // ★배경이 «상자를 채운다»(100% 가 실제로 먹었다)
  expect(r.svgH).toBe(130);
  expect(errs).toEqual([]);
});

/* ═══════════════════════════════════════════════════════════════════════════
   C-HANDLE — ★Q3. 손잡이가 붙고, ★폭만 끌리고, 글자는 손을 뗀 뒤 비율로 맞는다
═══════════════════════════════════════════════════════════════════════════ */

test('C-HANDLE1 ★고르면 모서리 넷, 풀면 0 — ⛔라디우스 손잡이는 «안» 준다', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  expect(await handleCount(page)).toBe(0);     // ★양성대조 — 고르기 «전»엔 0
  await select(page);
  expect(await handleCount(page)).toBe(4);
  /* ★쿠폰의 모서리는 배경 SVG 가 그린다 ⇒ 모달의 라디우스 손잡이를 «빌리지 않았다». */
  const borrowed = await page.evaluate(() => ({
    mdl: document.querySelectorAll('#ss-handles-overlay .mdl-overlay-handle').length,
    radius: document.querySelectorAll('#ss-handles-overlay .mdl-radius-handle').length,
  }));
  expect(borrowed.mdl).toBe(0);
  expect(borrowed.radius).toBe(0);
  /* 선택이 풀리면 스스로 걷힌다(rAF 가드). */
  await page.evaluate(() => window.__block.classList.remove('selected'));
  await raf(page);
  expect(await handleCount(page)).toBe(0);
  expect(errs).toEqual([]);
});

test('C-HANDLE2 ★모서리를 «진짜 마우스»로 끌면 폭이 변하고 글자가 비율로 맞는다', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  await select(page);
  const before = await page.evaluate(() => ({
    w: Number(window.__block.dataset.width),
    fs: Math.round(parseFloat(getComputedStyle(window.__block.querySelector('[data-cpn-slot="num"]')).fontSize)),
  }));
  const box = await page.locator('#ss-handles-overlay .cpn-overlay-handle.se').boundingBox();
  expect(box, 'se 손잡이가 화면에 없다').not.toBeNull();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 50, y - 50, { steps: 6 });   // ★안쪽으로 = 좁아진다
  await page.mouse.up();
  await raf(page);
  const after = await page.evaluate(() => ({
    w: Number(window.__block.dataset.width),
    h: Math.round(parseFloat(getComputedStyle(window.__block).height)),
    fs: Math.round(parseFloat(getComputedStyle(window.__block.querySelector('[data-cpn-slot="num"]')).fontSize)),
    savedSize: Number(window.__block.dataset.slotNumSize),
  }));
  /* Δ = 2·dx — 가운데 고정 상자(modal 산식). dx=−50 ⇒ 460 − 100 = 360 */
  expect(after.w, `폭 ${before.w} → ${after.w} (기대 360)`).toBe(360);
  expect(after.h).toBe(Math.round(259 * 360 / 460));
  /* ★글자는 ★줄었다 — 그리고 ★저장본은 ★그대로다. */
  expect(after.fs, `num 글자 ${before.fs}px → ${after.fs}px`).toBeLessThan(before.fs);
  expect(after.savedSize).toBe(46);
  expect(errs).toEqual([]);
});

/* ═══════════════════════════════════════════════════════════════════════════
   C-UNDO — ★V5 의 자리. ⌘Z 를 ★「몇 칸 늘었나」로 센다(⛔「되돌려진다」가 아니다)
═══════════════════════════════════════════════════════════════════════════ */

/* ═══ ★「＋1 인가」를 재러 갔다가 ★기대값이 틀린 것을 찾았다 (2026-10-07 실측) ═══════
   ★발주서(지디)와 내 첫 검사는 ★「넣기 한 번 = 스택 ＋1」을 기대했다. ★재 보니 ★＋2 다.
   ⛔제품을 고쳐 ＋1 로 맞추지 ★않았다 — 먼저 ★이미 쓰는 블럭(모달)을 ★같은 자로 쟀다:
       ⑴ 첫 대조: 모달 ＋1 · 쿠폰 ＋2 ⇒ 「쿠폰이 틀렸다」로 ★보였다.
       ⑵ ★그 대조가 ★불공정했다 — 모달은 ★import 한 «원본»(래퍼 ★밖)을 불렀고,
          쿠폰은 ★window 의 «감싼» 것을 불렀다. ★같은 문이 아니었다.
       ⑶ ★같은 문(window.addModalBlock)으로 다시: ★모달 ＋2 · 쿠폰 ＋2 — ★같다.
   ⇒ ★＋2 가 이 레포의 ★설계다: js/insert-history.js 머리말의 「삽입: [S0, S1]」 그것이고,
     ★⌘Z 가 ★한 번인 까닭은 「undo 첫머리의 ensureHistoryCheckpoint 가 top==live 를 보고
     아무것도 안 쌓기 때문」이라고 ★그 머리말이 적어 뒀다.
   ⇒ 그래서 이 칸은 ★맨숫자를 박지 않고 ★둘을 센다: ㉠모달과 ★같은가(빌린 수 0 · 같은 실행에서
     같은 문으로 잰다) ㉡그 둘이 ★누구인가(안쪽 push-before ＋ 래퍼 끝표본).
═══════════════════════════════════════════════════════════════════════════ */
test('C-UNDO ★쿠폰 넣기 한 번 = ★모달과 «같은 칸 수» ＋ 그 둘이 누구인지까지 (수로 센다)', async ({ page }) => {
  // ⇐ 되돌리기(V5): addCouponBlock 이름을 addCouponBlk 로 바꾸면 래퍼 로스터 밖 → 칸이 하나 줄어 모달과 갈린다
  const errs = await boot(page);
  const r = await page.evaluate(async () => {
    /* ★진짜 두 파일을 얹는다 — insert-history 가 add*Block 을 «이름으로» 로스터하는 그 동작을 잰다.
       ⛔pushHistory 를 스텁으로 세면 「몇 칸」을 못 세므로, ★세는 가짜 스택을 쓴다. */
    const stack = [];
    let seq = 0;
    window.pushHistory = (label) => { stack.push({ seq: ++seq, label }); };
    window.getHistoryTip = () => stack.length ? { ...stack[stack.length - 1], empty: false } : { empty: true };
    window.restampHistoryTop = () => {};
    window.getSelectedSection = () => document.querySelector('.section-block');
    window.triggerAutoSave = () => {};
    window.buildLayerPanel = () => {};

    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = '/js/insert-history.js'; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
    window.__insertSeamInstall?.();
    /* ★전제 ① — 래퍼가 ★이 이름을 ★실제로 로스터했나. 안 했으면 아래 ＋1 은 다른 까닭이다. */
    const roster = window.__insertSeamRoster ? window.__insertSeamRoster() : [];
    const rostered = roster.includes('addCouponBlock');
    /* ★음성대조용 — 패턴에 ★안 걸리는 이름을 세워 두고 다시 설치해 본다(V5 변이의 꼴 그대로). */
    window.addCouponBlk = () => {};
    window.__insertSeamInstall?.();
    const rosterNeg = (window.__insertSeamRoster ? window.__insertSeamRoster() : []).includes('addCouponBlk');
    delete window.addCouponBlk;

    /* ★대조군 — ★이미 쓰는 블럭. ⛔import 한 원본을 부르지 마라(래퍼 밖이라 수가 하나 적다).
       ★window 의 «감싼» 것을 불러야 ★쿠폰과 «같은 문»이다. 그 사실도 같이 돌려준다. */
    const sameDoor = (window.addModalBlock !== window.__rawModal);
    const m0 = stack.length; window.addModalBlock(); const m1 = stack.length;
    const n0 = stack.length;
    window.addCouponBlock();
    const n1 = stack.length;
    const mine = stack.slice(n0).map(x => x.label === undefined ? '(라벨없음)' : x.label);
    return { rostered, rosterNeg, roster, rosterLen: roster.length,
             n0, n1, delta: n1 - n0, modalDelta: m1 - m0, sameDoor, mine };
  });
  /* ★전제가 먼저. ⛔「로스터가 N개 넘는다」같은 ★지어낸 바닥을 쓰지 않는다 —
       하네스에 실린 add*Block 수는 ★하네스가 무엇을 얹었나에 달렸고(실측 4개),
       내가 적은 「>5」는 ★근거가 없었다. 재야 하는 성질은 ⑴설치됐나 ⑵이 이름이 들었나
       ⑶★같은 자가 «걸리지 않는 이름»은 ★안 넣나 — 셋이다. */
  expect(r.rosterLen, '래퍼 로스터가 비었다 — insert-history 가 안 설치됐다').toBeGreaterThan(0);
  expect(r.rostered, `로스터 ${r.rosterLen}개(${r.roster.join(',')})에 addCouponBlock 이 없다`).toBe(true);
  /* ★음성대조 — 패턴 밖 이름은 ★안 들어야 한다. 다 넣는 자라면 ⑵는 아무것도 안 지킨다. */
  expect(r.rosterNeg, `패턴 밖 이름(addCouponBlk)이 로스터에 들었다 — 자가 아무거나 담는다`).toBe(false);
  /* ★㉠ 대조 전제 — ★같은 문으로 쟀나. 아니면 두 수를 ★견줄 수 없다(내가 실제로 물린 함정). */
  expect(r.sameDoor, '★모달을 래퍼 «밖» 원본으로 쟀다 — 쿠폰과 같은 문이 아니다').toBe(true);
  /* ★㉠ 본단언 — ★모달과 ★같은 칸 수. ★빌린 수가 아니라 ★이 실행에서 잰 수다. */
  expect(r.delta, `쿠폰 ${r.delta}칸 vs 모달 ${r.modalDelta}칸 — 넣기 한 번의 칸 수가 갈렸다`)
    .toBe(r.modalDelta);
  /* ★㉠ 음성대조 — 그 수가 ★0 이면 둘이 «같이 아무것도 안 한 것»이라 위 단언이 항등식이 된다. */
  expect(r.modalDelta, '모달조차 0칸이다 — 하네스가 pushHistory 를 못 받고 있다').toBeGreaterThan(0);
  /* ★㉡ 그 둘이 ★누구인가 — 안쪽 push-before(라벨 없음) ＋ 래퍼 끝표본('블럭 추가').
     ⛔수만 맞추면 «엉뚱한 둘»이어도 초록이다. 이 줄이 ★어느 둘인지를 못박는다.
     ★이것이 ⌘Z 가 한 걸음인 근거다 — S1(끝표본)==live 라 undo 첫머리가 칸을 더 안 쌓는다. */
  expect(r.mine, `쿠폰이 쌓은 칸: ${JSON.stringify(r.mine)}`).toEqual(['(라벨없음)', '블럭 추가']);
  expect(errs).toEqual([]);
});

test('C-UNDO2 ★`updateCouponBlock` 이라는 이름이 «없다» — 있으면 래퍼가 칸을 하나 더 쌓는다', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(() => ({
    hasUpdate: typeof window.updateCouponBlock,
    hasCommit: typeof window.commitCouponSlot,
    matches: /^update[A-Z][A-Za-z0-9]*Block$/.test('updateCouponBlock'),
  }));
  /* ★전제 — 그 이름 꼴이 ★실제로 래퍼 패턴에 걸리나(안 걸리면 이 검사는 아무것도 안 지킨다). */
  expect(r.matches).toBe(true);
  expect(r.hasUpdate).toBe('undefined');
  /* ★대신 ★이것이 있다 — 「없다」만 재면 «기능이 빠진 것»과 구분이 안 된다. */
  expect(r.hasCommit).toBe('function');
  expect(errs).toEqual([]);
});

/* ═══════════════════════════════════════════════════════════════════════════
   C-LOAD — ★V4 의 자리. 저장→로드 왕복 뒤에도 «그림»이 산다
═══════════════════════════════════════════════════════════════════════════ */

test('C-LOAD ★dataset 이 진실이다 — HTML 만 되살리고 재렌더하면 그림이 돌아온다', async ({ page }) => {
  // ⇐ 되돌리기(V4): js/io/save-load.js 의 `renderCouponBlock?.(b)` 줄 제거 → 로드 경로가 이 성질을 잃는다
  const errs = await boot(page);
  await mount(page, { width: '300', bodyCol: '#0000ff', slotNumText: '77' });
  const saved = await page.evaluate(() => {
    const html = document.getElementById('host').innerHTML;
    /* ★저장본 HTML 에서 ★그림을 통째로 지운다 — 로드가 «스냅샷에 기대고 있나»를 가린다. */
    return html.replace(/<div class="cpn-bg"[\s\S]*?<\/div>/, '<div class="cpn-bg"></div>');
  });
  const r = await page.evaluate((html) => {
    const host = document.getElementById('host');
    host.innerHTML = html;
    const b = host.querySelector('.coupon-block');
    const before = { paths: b.querySelectorAll('.cpn-bg path').length };
    /* ★로드 경로가 하는 ★그 한 줄 */
    window.renderCouponBlock(b);
    const s = getComputedStyle(b);
    return {
      before,
      paths: b.querySelectorAll('.cpn-bg path').length,
      w: Math.round(parseFloat(s.width)),
      num: b.querySelector('[data-cpn-slot="num"]')?.textContent,
      fill: b.querySelector('.cpn-bg path')?.getAttribute('fill'),
      slots: b.querySelectorAll('[data-cpn-slot]').length,
    };
  }, saved);
  /* ★전제 — 지운 것이 ★실제로 지워졌나(0건에서 출발해야 「되살아났다」가 참이다). */
  expect(r.before.paths).toBe(0);
  expect(r.paths).toBeGreaterThanOrEqual(1);
  expect(r.w).toBe(300);                 // dataset.width 가 살았다
  expect(r.num).toBe('77');              // 글자가 dataset 에서 되살아났다
  expect(r.fill).toBe('#0000ff');        // 색도 dataset 에서
  expect(r.slots).toBe(3);
  /* ★★위까지는 「재렌더하면 돌아온다」는 ★성질이다. ★그런데 ★로드 경로가 ★그 재렌더를 ★부르나?
     ⇒ 그건 이 하네스에서 못 돈다(save-load 는 앱 전역을 끌고 온다). ★소스에서 ★그 한 줄을 잰다.
     ⛔「낱말이 있나」가 아니라 ★「rebindAll 의 그 루프 안에 있나」로 ★자리까지 본다.
     ★음성대조를 ★같이 돌린다 — 그 줄을 지운 사본에서 ★거짓이 되는지. 안 되면 이 칸은 아무것도 안 잠근다. */
  const src = fs.readFileSync(path.join(REPO, 'js/io/save-load.js'), 'utf8');
  const loop = src.slice(src.indexOf("canvasEl.querySelectorAll('.text-block, .asset-block"));
  const RE = /if \(b\.classList\.contains\('coupon-block'\)\) window\.renderCouponBlock\?\.\(b\);/;
  expect(RE.test(loop.slice(0, 6000)), '★save-load 의 로드 루프가 renderCouponBlock 을 안 부른다 — 로드 뒤 그림이 빈다').toBe(true);
  expect(RE.test(loop.slice(0, 6000).replace(RE, '')), '★자가 죽었다 — 줄을 지운 사본도 통과한다').toBe(false);
  /* ★접두도 같은 자리에서 — genId('cpn') 과 ★갈리면 id 가 둘이 된다. */
  expect(/contains\('coupon-block'\) \? 'cpn'/.test(src), "★save-load 의 id 접두가 'cpn' 이 아니다").toBe(true);
  expect(errs).toEqual([]);
});

/* ═══════════════════════════════════════════════════════════════════════════
   C-EXPORT — ★알려진 결함(지디 Q1 판정). ⛔1단계에서 «고치지 않는다»
   ───────────────────────────────────────────────────────────────────────────
   ★test.fail(true, …) 로 둔다 — 「지금은 빨갛다」를 그냥 빨간 검사로 두면 ★다음 빨강을 가린다.
     2단계에서 고치는 ★순간 「Expected to fail, but passed」로 빨개져서 알려 준다.
     ★그때 ★이 test.fail 줄을 떼라.
   ★선례 = tests/dom/grid-save-export-axes.dom.spec.js E4(B8) 의 그 꼴.
   ⛔조건부로 두지 않는다(지디 지시) — 플래그로 켜고 끄면 passed 수가 조용히 움직인다.
   ★병의 이름 = js/blocks/zoom-block.js:26 「피그마로 업로드하면 ★조용히 빠진다(오류도 안 난다)」.
     ★글자는 산다(tb- 폴백) — ★배경 SVG 가 안 실린다. 그 둘을 ★따로 잰다.
═══════════════════════════════════════════════════════════════════════════ */

test('C-EXPORT ★알려진 결함 — 피그마 내보내기에 쿠폰 «배경 SVG»가 안 실린다 (2단계에서 고친다)', async ({ page }) => {
  test.fail(true, '★아직 안 고쳤다(지디 Q1 = 2단계). 고치면 이 표시가 빨개진다 — 그때 test.fail 을 떼라.');
  const errs = await boot(page);
  await mount(page);
  const r = await page.evaluate(async () => {
    const m = await import('/js/io/export-figma-json.js');
    const fn = m.buildFigmaJson || m.default || window.buildFigmaJson;
    if (typeof fn !== 'function') return { noFn: true };
    const out = JSON.stringify(await fn());
    return { noFn: false, hasPath: /"type"\s*:\s*"(VECTOR|coupon)"/.test(out) || /couponPath|cpn-bg/.test(out) };
  });
  /* ★전제 — 내보내기 함수를 ★실제로 불렀나. 못 불렀으면 이 칸은 «못 쟀다»지 «결함»이 아니다. */
  expect(r.noFn, '★내보내기 입구를 못 찾았다 — 이 칸은 결함을 재고 있지 않다').toBe(false);
  expect(r.hasPath, '★쿠폰 배경이 내보내기에 실렸다').toBe(true);
  expect(errs).toEqual([]);
});
