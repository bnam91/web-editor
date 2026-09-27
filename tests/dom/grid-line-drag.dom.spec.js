/* grid-line-drag.dom.spec.js — 「칸 «안»의 줄을 마우스로 끌어 옮긴다」 (T-228, 2026-09-27)
 *
 * ★현빈 발주(0926) — 「지금은 키보드(⌘↑/↓)로만 됩니다 ⇒ 손맛」. 확인 항목도 카드에 있다:
 *   「줄을 ★끌어서 같은 칸 안에서 위아래로 옮기고, ★놓을 자리가 ★어디인지 ★보이는지(표시선)」.
 *
 * ★어떻게 만들었나 — 손잡이(⠿)를 #ss-handles-overlay 에 얹는다. ⛔줄 HTML 에 넣으면 내보내기
 *   산출 «바이트»가 바뀌어 골든(grid-gap-clamp, 기준판 55f3a1a)이 빨개진다. 오버레이는
 *   #canvas-scaler «바깥»이라 저장본·export 에 애초에 없다 ⇒ 렌더 산출 무변화.
 * ★표시선은 ★새로 만들지 않았다 — `.drop-indicator` 를 «칸 안»에 끼운다(카드 measured 의
 *   「새로 만들지 말고 그것을 쓰십시오」 그대로). 칸이 flex-direction:column 이라 가로 띠가 된다.
 *
 * ★무엇을 잠그나
 *   D0  양성대조(먼저) — 손잡이는 «고른 줄»에만 뜬다(안 고르면 0개)
 *   D1  ⓐ 같은 칸에서 끌어 내리면 순서가 바뀐다 — ★그리고 «끄는 동안» 표시선이 보인다
 *   D2  ★다른 칸으로도 끌린다(T-227 과 짝) — 꾸밈째 따라온다
 *   D3  ⛔중첩(duo) «안»의 칸에는 안 놓인다 — 표시선 0개 · 순서 불변
 *   D4  ⛔중첩 «안»의 줄을 고르면 손잡이가 아예 안 뜬다(집을 수 없다)
 *   D5  임계 미달(누르고 바로 떼기)엔 아무 일도 없다 — 이력도 0
 *   D6  ★제자리에 놓으면 아무 일도 없다(SAME_SPOT) — 이력 0. 끌다 되돌리는 것은 «흔한 일»이다
 *   D7  놓은 뒤 표시선이 ★남지 않는다
 *   P1  ★★양성대조 — 「떼고 넣는다」 보정을 떼면 같은 칸에서 «한 칸 더» 간다
 *
 * ⚠️★이 그물이 «못» 닿는 곳(정직하게) — 진짜 앱의 캔버스 스케일(줌)이다. 하네스는 배율 1 이다.
 *   손잡이 자리는 getBoundingClientRect 로만 재므로 배율에 자동으로 따라가지만, «낮은 배율에서
 *   손잡이가 줄보다 커지는가»는 여기서 못 본다(GRD_GRIP_MIN_SCREEN_PX 가 그 방어선이고, 그 수가
 *   맞는지는 앱 실기의 몫이다).
 *
 * ⛔앱을 «안» 띄운다. 실행: npm run test:dom -- grid-line-drag
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json' };

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-layout.css">
<link rel="stylesheet" href="/css/editor-canvas.css">
<link rel="stylesheet" href="/css/editor-props.css">
<link rel="stylesheet" href="/css/editor-blocks.css">
<style>body{margin:0;padding:40px;} #canvas{width:700px;}</style></head><body>
<div id="canvas"><div class="section-block"><div class="section-inner" id="host"></div></div></div>
<div id="panel-right"><div class="panel-body"></div></div>
<div id="ss-handles-overlay"></div>
<script src="/js/design-system.js"></script>
<script src="/js/io/section-serialize.js"></script>
<script type="module">
  import { makeGridBlock, renderGridBlock, updateGridBlock, getGridModel } from '/js/blocks/grid-block.js';
  import { showGridProperties, grdSetActiveLine, grdGetActiveLine } from '/js/props/prop-grid.js';
  import { showGridLineGrip, hideGridLineGrip } from '/js/overlay-handles.js';
  /* ★drag-utils 는 «부수효과»로 window.clearDropIndicators 를 낸다 — 끄는 길이 그것을 부른다.
     ⛔안 불러 두면 표시선이 지워지지 않아 D7 이 «다른 이유로» 빨개진다(그건 계측기 고장이다). */
  await import('/js/drag-utils.js');
  window.__mk = makeGridBlock;
  window.__render = renderGridBlock;
  window.__update = updateGridBlock;
  window.__model = getGridModel;
  window.__open = showGridProperties;
  window.__setActive = grdSetActiveLine;
  window.__getActive = grdGetActiveLine;
  window.__grip = showGridLineGrip;
  window.__ungrip = hideGridLineGrip;
  window.__ready = true;
</script></body></html>`;

/** ★양성대조용: 서빙하는 «소스»를 갈아친다. ⛔닻을 못 찾으면 «조용히 원본»을 주지 않는다. */
async function boot(page, mutate) {
  const muts = !mutate ? [] : (Array.isArray(mutate) ? mutate : [mutate]);
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    let body = fs.readFileSync(file);
    const mine = muts.filter(m => m.path === url.pathname);
    if (mine.length) {
      let txt = body.toString('utf8');
      for (const m of mine) {
        if (!txt.includes(m.from)) {
          return route.fulfill({ contentType: 'text/javascript', body: 'throw new Error("MUTATION_ANCHOR_MISSING");' });
        }
        txt = txt.replace(m.from, m.to);
      }
      body = Buffer.from(txt, 'utf8');
    }
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

/* 칸(0,0) = 바깥 줄 4개 — [0]'A'(★꾸밈) · [1]'B' · [2]'C' · [3]중첩 duo · 칸(0,1) = 'X'.
   ⇒ 「같은 칸 안 임의 자리」(D1·P1)·「다른 칸」(D2)·「중첩엔 안 놓인다」(D3)를 한 fixture 로. */
const FIXTURE = {
  cols: [
    { width: 1, lines: [
      { type: 'body', text: 'A', fontSize: 30, color: '#112233' },
      { type: 'body', text: 'B' },
      { type: 'body', text: 'C' },
      { type: 'duo', cols: [
        { width: 1, lines: [{ type: 'body', text: 'IN-A' }] },
        { width: 1, lines: [{ type: 'body', text: 'IN-B' }] },
      ] },
    ] },
    { width: 1, lines: [{ type: 'body', text: 'X' }] },
  ],
};

async function mount(page) {
  await page.evaluate((fx) => {
    const host = document.getElementById('host');
    const { row, block } = window.__mk(fx);
    host.appendChild(row);
    block.classList.add('selected');
    window.__block = block;
    window.__row = row;
    window.__pushLog = [];
    window.pushHistory = (label) => window.__pushLog.push(label === undefined ? '(updateGridBlock)' : label);
    window.showToast = () => {};
    window.buildLayerPanel = () => {};
  }, FIXTURE);
}

/** 그 줄을 고르고 손잡이를 띄운다. @returns 손잡이의 화면 중심 좌표(없으면 null) */
async function selectLineAndGrip(page, addr) {
  return page.evaluate((a) => {
    window.__setActive(window.__block, a);
    window.__grip(window.__block);
    const g = document.querySelector('#ss-handles-overlay .grd-line-grip');
    if (!g) return null;
    const r = g.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, addr);
}

/** 그 줄(바깥)의 화면 사각형. */
async function lineRect(page, r, c, li) {
  return page.evaluate(({ r, c, li }) => {
    const el = window.__block.querySelector(`[data-r="${r}"][data-c="${c}"][data-line="${li}"]`);
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2, top: b.top, bottom: b.bottom, h: b.height };
  }, { r, c, li });
}

async function cellTexts(page) {
  return page.evaluate(() => {
    const cells = window.__model(window.__block).cells[0];
    const t = (l) => (l.type === 'duo' ? 'DUO' : l.text);
    return { c0: cells[0].lines.map(t), c1: cells[1].lines.map(t) };
  });
}

async function indicatorCount(page) {
  return page.evaluate(() => document.querySelectorAll('.drop-indicator').length);
}

async function pushLog(page) {
  return page.evaluate(() => window.__pushLog.slice());
}

/* ═══ D0 — 양성대조를 «먼저»: 손잡이는 «고른 줄»에만 뜬다 ══════════════════ */

test('D0 ★양성대조(먼저) — 줄을 안 고르면 손잡이가 0개, 고르면 1개이고 그 줄 «왼쪽»에 온다', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);

  const none = await page.evaluate(() => {
    window.__grip(window.__block);
    return document.querySelectorAll('#ss-handles-overlay .grd-line-grip').length;
  });
  expect(none, '★줄을 안 골랐는데 손잡이가 떴다 — 무엇을 끄는지 알 수 없다').toBe(0);

  const g = await selectLineAndGrip(page, { r: 0, c: 0, li: 1 });
  expect(g, '★줄을 골랐는데 손잡이가 안 떴다 — 이 검사들 전부가 «안 재게» 된다').toBeTruthy();
  const lr = await lineRect(page, 0, 0, 1);
  expect(g.x, '★손잡이가 줄 «왼쪽 밖»이 아니다 — 줄 위에 얹으면 글자를 가린다').toBeLessThan(lr.x);
  expect(Math.abs(g.y - lr.y), '★손잡이가 그 줄 높이에 안 맞춰졌다').toBeLessThan(6);
  expect(errs).toEqual([]);
});

/* ═══ D1 — ⓐ 같은 칸 안에서 끌어 내린다 ＋ ★표시선이 보인다 ═══════════════ */

test('D1 ★같은 칸에서 [0] 을 [2] 아래로 끌면 순서가 바뀐다 — 그리고 «끄는 동안» 표시선이 보인다', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  const g = await selectLineAndGrip(page, { r: 0, c: 0, li: 0 });
  const c = await lineRect(page, 0, 0, 2);

  await page.mouse.move(g.x, g.y);
  await page.mouse.down();
  await page.mouse.move(g.x + 8, g.y + 8);            // 임계를 넘겨 무장
  await page.mouse.move(c.x, c.bottom - 2);           // 'C' 의 아래쪽 절반 = 그 «뒤» 자리
  const shown = await indicatorCount(page);
  expect(shown, '★★놓을 자리가 «안 보인다» — 현빈이 카드에 적으신 확인 항목이 바로 이것이다').toBe(1);
  await page.mouse.up();

  const t = await cellTexts(page);
  expect(t.c0, '★끌어 옮겨지지 않았다').toEqual(['B', 'C', 'A', 'DUO']);
  expect(await indicatorCount(page), '★놓은 뒤 표시선이 남았다').toBe(0);
  expect(await pushLog(page), '★이력이 한 칸이 아니다').toEqual(['(updateGridBlock)']);
  expect(errs).toEqual([]);
});

/* ═══ D2 — ★다른 칸으로도 끌린다(T-227 과 짝) ════════════════════════════ */

test('D2 ★다른 칸으로 끌면 그 칸으로 간다 — 꾸밈(크기·색)도 따라온다', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  const before = await page.evaluate(() => {
    const el = window.__block.querySelector('[data-r="0"][data-c="0"][data-line="0"]');
    return { fontSize: el.style.fontSize, color: el.style.color };
  });
  const g = await selectLineAndGrip(page, { r: 0, c: 0, li: 0 });
  const x = await lineRect(page, 0, 1, 0);

  await page.mouse.move(g.x, g.y);
  await page.mouse.down();
  await page.mouse.move(g.x + 8, g.y);
  await page.mouse.move(x.x, x.bottom - 2);
  await page.mouse.up();

  const t = await cellTexts(page);
  expect(t.c0, '★출발 칸에서 안 빠졌다').toEqual(['B', 'C', 'DUO']);
  expect(t.c1, '★도착 칸에 안 들어갔다').toEqual(['X', 'A']);
  const after = await page.evaluate(() => {
    const el = [...window.__block.querySelectorAll('[data-r="0"][data-c="1"][data-line]')]
      .find(e => (e.textContent || '').trim() === 'A');
    return el ? { fontSize: el.style.fontSize, color: el.style.color } : null;
  });
  expect(after, '★옮긴 줄이 도착 칸 «화면»에 없다').toBeTruthy();
  expect(after.fontSize, '★★크기가 안 따라왔다').toBe(before.fontSize);
  expect(after.color, '★★색이 안 따라왔다').toBe(before.color);
  expect(await pushLog(page), '★★두 칸을 고쳤는데 이력이 한 칸이 아니다 — ⌘Z 가 반쪽을 남긴다')
    .toEqual(['(updateGridBlock)']);
  expect(errs).toEqual([]);
});

/* ═══ D3·D4 — ⛔중첩(duo) 은 놓을 자리도, 집을 대상도 아니다 ══════════════ */

/* ★★2026-09-27 정정 — 이 검사의 첫 판은 「중첩 안 칸에 표시선이 안 뜬다」를 재려 했고,
 *   `.grd-nested .grd-cell` 을 찾다 «0개»로 빨개졌다. ⇒ ★중첩 «안»에는 `.grd-cell` 이 아예
 *   없다(열이 `.grd-nested-col`). 즉 제가 코드에 넣었던 `closest('.grd-nested')` 가드는
 *   ★아무것도 안 재는 문이었고, 그 가드를 근거로 세운 이 검사도 «없는 것»을 재고 있었다.
 *   ⇒ 가드를 지우고, ★실제로 일어나는 일을 잠근다: 중첩 줄은 바깥 칸의 «한 줄»이므로
 *     그 위/아래로 놓인다. 중첩 «안»으로 들어가는 길은 애초에 없다(그것을 같이 단언한다). */
test('D3 ★중첩(duo) 줄 «아래»에 놓으면 그 줄 뒤로 간다 — 중첩 «안»으로는 안 들어간다', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  const nestedCells = await page.evaluate(() =>
    window.__block.querySelectorAll('.grd-nested .grd-cell').length);
  expect(nestedCells, '★중첩 안에 .grd-cell 이 생겼다 — 그러면 이 검사의 전제가 바뀐다(다시 재라)').toBe(0);

  const g = await selectLineAndGrip(page, { r: 0, c: 0, li: 0 });
  const duo = await lineRect(page, 0, 0, 3);
  expect(duo, '★중첩 줄이 바깥 칸의 한 줄로 안 그려졌다 — 이 검사는 «안 재고» 있다').toBeTruthy();

  await page.mouse.move(g.x, g.y);
  await page.mouse.down();
  await page.mouse.move(g.x + 8, g.y);
  await page.mouse.move(duo.x, duo.bottom - 2);       // 중첩 줄의 아래쪽 절반 = 그 «뒤»
  const shown = await indicatorCount(page);
  await page.mouse.up();

  expect(shown, '★놓을 자리가 안 보인다').toBe(1);
  const t = await cellTexts(page);
  expect(t.c0, '★중첩 줄 «뒤»로 안 갔다').toEqual(['B', 'C', 'DUO', 'A']);
  expect(await page.evaluate(() => window.__block.querySelectorAll('[data-npath]').length),
    '★★중첩 «안»의 줄 수가 바뀌었다 — 줄이 중첩 안으로 밀려 들어갔다(쓰는 길은 거기로 안 간다)').toBe(2);
  expect(errs).toEqual([]);
});

test('D4 ⛔★중첩 «안»의 줄을 고르면 손잡이가 아예 안 뜬다', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  const g = await selectLineAndGrip(page, { r: 0, c: 0, li: 3, np: '0.0' });
  expect(g, '★★중첩 안 줄에 손잡이가 떴다 — 끌면 «품은 duo 줄»이 통째로 옮겨진다').toBeNull();
  expect(errs).toEqual([]);
});

/* ═══ D5·D6 — 아무 일도 안 일어나야 하는 두 경우 ══════════════════════════ */

test('D5 ★누르고 바로 떼면(임계 미달) 아무 일도 없다 — 손잡이를 누른 것은 클릭이다', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  const g = await selectLineAndGrip(page, { r: 0, c: 0, li: 0 });

  await page.mouse.move(g.x, g.y);
  await page.mouse.down();
  await page.mouse.move(g.x + 1, g.y + 1);   // 임계(3px) 미달
  await page.mouse.up();

  expect((await cellTexts(page)).c0).toEqual(['A', 'B', 'C', 'DUO']);
  expect(await pushLog(page), '★안 끌었는데 이력이 쌓였다 = ⌘Z 가 «빈 칸»을 되돌린다').toEqual([]);
  expect(errs).toEqual([]);
});

test('D6 ★제자리에 놓으면 아무 일도 없다(SAME_SPOT) — 끌다 되돌리는 것은 흔한 일이다', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  const g = await selectLineAndGrip(page, { r: 0, c: 0, li: 1 });
  const b = await lineRect(page, 0, 0, 1);

  await page.mouse.move(g.x, g.y);
  await page.mouse.down();
  await page.mouse.move(g.x + 8, g.y);
  await page.mouse.move(b.x, b.top + 2);     // 'B' 의 위쪽 절반 = 「B 앞」 = 제자리
  await page.mouse.up();

  expect((await cellTexts(page)).c0, '★제자리인데 순서가 바뀌었다').toEqual(['A', 'B', 'C', 'DUO']);
  expect(await pushLog(page), '★★제자리에 놓았는데 이력이 쌓였다 — ⌘Z 한 번이 헛돈다').toEqual([]);
  expect(errs).toEqual([]);
});

test('D7 ★놓은 뒤 표시선이 남지 않는다 — 남으면 저장본·내보내기로 샐 자리가 된다', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  const g = await selectLineAndGrip(page, { r: 0, c: 0, li: 0 });
  const c = await lineRect(page, 0, 0, 2);

  await page.mouse.move(g.x, g.y);
  await page.mouse.down();
  await page.mouse.move(g.x + 8, g.y);
  await page.mouse.move(c.x, c.bottom - 2);
  await page.mouse.up();

  expect(await indicatorCount(page), '★표시선이 남았다').toBe(0);
  /* ★그리고 «저장본»에도 없다 — section-serialize 가 지운다는 것을 여기서 한 번 확인한다
     (남았더라도 그 세척이 막아 주는지 갈라 재는 자리다). */
  const inSaved = await page.evaluate(() => {
    const sec = document.querySelector('.section-block');
    const clone = sec.cloneNode(true);
    window.serializeCleanRoot?.(clone);
    return clone.querySelectorAll('.drop-indicator').length;
  });
  expect(inSaved, '★저장본에 표시선이 실렸다').toBe(0);
  expect(errs).toEqual([]);
});

/* ═══ P1 — ★★양성대조: 「떼고 넣는다」 보정 ═══════════════════════════════ */

test('P1 ★★양성대조 — 보정(insertAt-1)을 떼면 같은 칸에서 «한 칸 더» 간다', async ({ page }) => {
  const errs = await boot(page, {
    path: '/js/overlay-handles.js',
    from: '  return insertAt > fromLi ? insertAt - 1 : insertAt;',
    to: '  return insertAt;',
  });
  await mount(page);
  const g = await selectLineAndGrip(page, { r: 0, c: 0, li: 0 });
  const c = await lineRect(page, 0, 0, 2);

  await page.mouse.move(g.x, g.y);
  await page.mouse.down();
  await page.mouse.move(g.x + 8, g.y);
  await page.mouse.move(c.x, c.top + 2);     // 'C' 의 위쪽 절반 = 「C 앞」(삽입 자리 2)
  await page.mouse.up();

  /* ★바른 판: 삽입 자리 2 → 떼면 [B,C,DUO] ⇒ to=1 ⇒ [B,A,C,DUO]
     ★변이 판: to=2 그대로 ⇒ [B,C,A,DUO] — «한 칸 더» 갔다. */
  expect((await cellTexts(page)).c0, '★보정을 떼었는데 결과가 같다 — 이 양성대조는 «안 재고» 있다')
    .toEqual(['B', 'C', 'A', 'DUO']);
  expect(errs).toEqual([]);
});
