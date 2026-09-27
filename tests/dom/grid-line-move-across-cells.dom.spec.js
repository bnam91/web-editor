/* grid-line-move-across-cells.dom.spec.js — 「칸 안의 줄을 ⌘←/→ 로 «옆 칸»으로 옮긴다」 (T-227, 2026-09-27)
 *
 * ★무엇이 없었나 — ⌘↑/↓ 는 «같은 칸 안»에서만 줄을 옮긴다(T-220 ⓐ). 칸을 건너뛰는 길은 0건이었다.
 *   ★현빈이 이 카드에 적은 확인 항목이 그대로 이 검사의 뼈대다: 「한 칸의 줄을 골라 ★옆 칸으로
 *   옮기고, ★그 줄의 꾸밈(크기·색)이 ★그대로 따라오는지」.
 *
 * ★왜 «두 문»인가 — updateGridBlock 은 「구조 필드는 한 번에 하나만」이라 patchCell 을 두 칸에
 *   같이 보낼 수 없다. ⇒ patchCell 두 문 + 이력 한 칸(둘째 문을 opts.noHistory 로 끈다).
 *   ★그 「이력 한 칸」이 이 카드에서 제일 깨지기 쉬운 곳이라 양성대조를 따로 세웠다(P1).
 *
 * ★무엇을 잠그나
 *   A0  양성대조(먼저) — fixture 가 정말 그 모양인가(꾸밈 붙은 줄이 «화면에» 있는가)
 *   A1  ⓐ 줄이 «옆 칸»으로 간다 — 출발에서 빠지고 도착의 «끝»에 붙고 ★행(.row)은 제자리다
 *   A2  ★꾸밈(크기·색)이 «화면에서» 따라온다 — 모델이 아니라 렌더된 style 로 잰다
 *   A3  맨 왼쪽에서 ⌘← 는 «먹고 멈춘다» — 아무것도 안 바뀐다(EDGE 와 같은 뜻)
 *   A4  중첩(duo) 안 줄은 먹고 멈춘다(토스트) — ⌘↑/↓ 와 «같은 말»
 *   A5  ⛔줄을 «안» 골랐으면 ⌘→ 는 아무 일도 안 한다(소진도 안 한다) — 새 뜻을 지어내지 않는다
 *   A6  ★이력이 «한 칸»이다 — 두 문인데 pushHistory 는 한 번
 *   P1  ★양성대조 — noHistory 를 떼면 이력이 «두 칸»이 된다(그래서 그 플래그가 필요하다)
 *   P2  ★양성대조 — 상한 먼저보기 ＋ 되돌림을 «둘 다» 떼면 ★줄이 어느 칸에도 없다
 *   P2b ★그 둘 중 «상한 먼저보기»만 남기면 줄이 산다 — 첫 방어선이 어느 쪽인지 가른다
 *
 * ⚠️★이 그물이 «못» 닿는 곳(정직하게) — 진짜 ⌘Z 다. pushHistory 는 세는 가짜다. 「⌘Z 한 번이
 *   두 칸을 되돌리나」의 나머지 반쪽은 앱 실기의 몫이다(A6·P1 이 「한 번만 쌓인다」까지 잠근다).
 *   그리고 진짜 키보드 이벤트도 아니다 — ⌘←/→ 분기를 중괄호 균형으로 떠내 직접 때린다
 *   (tests/dom/grid-line-move-cmdarrow.dom.spec.js 와 «같은 수법·같은 한계»).
 *
 * ⛔앱을 «안» 띄운다. 실행: npm run test:dom -- grid-line-move-across-cells
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };
const EDITOR_SRC = fs.readFileSync(path.join(REPO, 'js/editor.js'), 'utf8');

/** 함수 «전체»를 중괄호 균형으로 떠낸다. grid-line-move-cmdarrow.dom.spec.js 와 «같은 부품». */
function extractFn(src, name) {
  const m = new RegExp('function\\s+' + name + '\\s*\\(').exec(src);
  if (!m) throw new Error('함수를 못 찾았다: ' + name);
  let i = m.index + m[0].length - 1, d = 0;
  for (; i < src.length; i++) {
    if (src[i] === '(') d++;
    else if (src[i] === ')') { d--; if (d === 0) { i++; break; } }
  }
  while (i < src.length && src[i] !== '{') i++;
  let b = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') b++;
    else if (src[i] === '}') { b--; if (b === 0) { i++; break; } }
  }
  return src.slice(m.index, i);
}

const CMD_LR_ANCHOR = "if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && (e.metaKey || e.ctrlKey)) {";
function extractCmdLRBlock(src) {
  const n = src.split(CMD_LR_ANCHOR).length - 1;
  if (n !== 1) throw new Error(`⌘←/→ 분기가 ${n} 곳이다 — 하나여야 한다 (editor.js)`);
  const k = src.indexOf(CMD_LR_ANCHOR);
  let d = 0, i = k;
  for (; i < src.length; i++) {
    if (src[i] === '{') d++;
    else if (src[i] === '}') { d--; if (d === 0) { i++; break; } }
  }
  if (i >= src.length) throw new Error('⌘←/→ 분기의 끝을 못 찾았다 (editor.js)');
  return src.slice(k, i);
}
const CMD_LR_SRC = extractCmdLRBlock(EDITOR_SRC);
/* ⛔모듈 스코프의 이름을 «하나라도» 안 심으면 이 수법은 ReferenceError 로 끊긴다 — 2026-09-27 에
   cmdarrow 쪽에서 아홉 개가 한꺼번에 그렇게 빨개졌다. 새 이름을 부르기 시작하면 여기에 같이 심어라. */
const GATE_SRC = extractFn(EDITOR_SRC, '_gridActiveOuterLine');
const ACROSS_SRC = extractFn(EDITOR_SRC, 'moveGridLineAcrossCells');

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-layout.css">
<link rel="stylesheet" href="/css/editor-canvas.css">
<link rel="stylesheet" href="/css/editor-props.css">
<link rel="stylesheet" href="/css/editor-blocks.css"></head><body>
<div id="canvas"><div class="section-block"><div class="section-inner" id="host"></div></div></div>
<div id="panel-right"><div class="panel-body"></div></div>
<script src="/js/design-system.js"></script>
<script src="/js/io/section-serialize.js"></script>
<script type="module">
  import { makeGridBlock, renderGridBlock, updateGridBlock, getGridModel } from '/js/blocks/grid-block.js';
  import { showGridProperties, grdSetActiveLine, grdGetActiveLine, grdMoveLineToCell } from '/js/props/prop-grid.js';
  window.__mk = makeGridBlock;
  window.__render = renderGridBlock;
  window.__update = updateGridBlock;
  window.__model = getGridModel;
  window.__open = showGridProperties;
  window.__setActive = grdSetActiveLine;
  window.__getActive = grdGetActiveLine;
  window.__toCell = grdMoveLineToCell;
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

/* 칸(0,0) = 바깥 줄 ★3개 — [0]'A'(★꾸밈 붙음) · [1]'B' · [2]중첩 duo · 칸(0,1) = 'X' 하나.
   ⇒ 「옆 칸으로」(A1)·「꾸밈이 따라오나」(A2)·중첩 게이트(A4)를 «한 fixture»로 같이 잰다. */
const FIXTURE = {
  cols: [
    { width: 1, lines: [
      { type: 'body', text: 'A', fontSize: 33, color: '#aabbcc' },
      { type: 'body', text: 'B' },
      { type: 'duo', cols: [
        { width: 1, lines: [{ type: 'body', text: 'IN-A' }] },
        { width: 1, lines: [{ type: 'body', text: 'IN-B' }] },
      ] },
    ] },
    { width: 1, lines: [{ type: 'body', text: 'X' }] },
  ],
};

/** 그리드 행을 «가운데»에 둔다 — 「행이 새어 움직이나」를 위·아래 양쪽으로 잴 수 있게
 *  (cmdarrow 스펙이 그 까닭을 실측으로 적어 둔 그 자리와 같은 규약). */
async function mount(page) {
  await page.evaluate((fx) => {
    const host = document.getElementById('host');
    const mkRow = (id, label) => {
      const r = document.createElement('div');
      r.className = 'row';
      r.id = id;
      r.innerHTML = `<div class="col"><div class="text-block" id="tb-${id}">${label}</div></div>`;
      return r;
    };
    host.appendChild(mkRow('row-before', '윗 행'));
    const { row, block } = window.__mk(fx);
    host.appendChild(row);
    host.appendChild(mkRow('row-after', '아랫 행'));
    block.classList.add('selected');
    window.__block = block;
    window.__row = row;
  }, FIXTURE);
}

/** ⌘←/→ 분기를 «직접» 때린다. pushHistory 는 세는 가짜 — 라벨로 누가 쌓았는지 가른다. */
async function pressCmdLR(page, key, { acrossSrc = ACROSS_SRC, arrowSrc = CMD_LR_SRC, gateSrc = GATE_SRC } = {}) {
  return page.evaluate(({ key, acrossSrc, arrowSrc, gateSrc }) => {
    window.__pushLog = [];
    window.__toasts = [];
    window.pushHistory = (label) => window.__pushLog.push(label === undefined ? '(updateGridBlock)' : label);
    window.showToast = (m) => window.__toasts.push(m);
    window.buildLayerPanel = () => {};
    const fn = new Function('pushHistory',
      `${gateSrc};\n${acrossSrc};\nreturn function (e) { ${arrowSrc} };`)(window.pushHistory);
    let pd = 0;
    fn({ key, metaKey: true, ctrlKey: false, altKey: false, shiftKey: false,
         target: document.body, preventDefault() { pd++; } });
    return { pd, pushLog: window.__pushLog, toasts: window.__toasts };
  }, { key, acrossSrc, arrowSrc, gateSrc });
}

/** 지금 «모델»과 «화면». ★꾸밈은 렌더된 style 로 읽는다 — 그게 「화면과 같은 말」이다. */
async function snap(page) {
  return page.evaluate(() => {
    const cells = window.__model(window.__block).cells[0];
    const txt = (l) => (l.type === 'duo' ? 'DUO' : l.text);
    const host = document.getElementById('host');
    const shown = (r, c) => [...window.__block.querySelectorAll(`[data-r="${r}"][data-c="${c}"][data-line]`)]
      .map(el => ({ text: (el.textContent || '').trim(), fontSize: el.style.fontSize, color: el.style.color }));
    return {
      c0: cells[0].lines.map(txt),
      c1: cells[1].lines.map(txt),
      rowAt: [...host.children].indexOf(window.__row),
      nested: window.__block.querySelectorAll('[data-npath]').length,
      active: window.__getActive(window.__block),
      alive: document.body.contains(window.__block),
      shown0: shown(0, 0),
      shown1: shown(0, 1),
    };
  });
}

/* ═══ A0 — 양성대조를 «먼저»: fixture 가 정말 그 모양인가 ══════════════════ */

test('A0 ★양성대조(먼저) — 칸0 은 줄 3(첫 줄에 꾸밈) · 칸1 은 줄 1 · 그리드 행이 «가운데»다', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  const s = await snap(page);
  expect(s.c0).toEqual(['A', 'B', 'DUO']);
  expect(s.c1).toEqual(['X']);
  expect(s.rowAt, '★그리드가 가운데 행이 아니면 「행이 새는가」를 못 잰다').toBe(1);
  expect(s.nested, '★중첩 안 줄이 안 그려졌다 — A4 가 «안 재게» 된다').toBe(2);
  const a = s.shown0.find(x => x.text === 'A');
  expect(a, '★꾸밈 붙은 줄이 화면에 없다 — A2 가 «안 재게» 된다').toBeTruthy();
  expect(a.fontSize, '★크기가 화면에 안 붙었다 — 이 대조는 «안 재고» 있다').toBe('33px');
  expect(a.color, '★색이 화면에 안 붙었다 — 이 대조는 «안 재고» 있다').toBeTruthy();
  expect(errs).toEqual([]);
});

/* ═══ A1·A2 — ⓐ 옆 칸으로 가고, 꾸밈이 따라온다 ═══════════════════════════ */

test('A1 ★바깥 줄 [0] 에서 ⌘→ — 줄이 «옆 칸»의 끝으로 가고 «행»은 제자리다', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  await page.evaluate(() => window.__setActive(window.__block, { r: 0, c: 0, li: 0 }));

  const r = await pressCmdLR(page, 'ArrowRight');
  const s = await snap(page);

  expect(s.c0, '★출발 칸에서 줄이 안 빠졌다').toEqual(['B', 'DUO']);
  expect(s.c1, '★도착 칸의 «끝»에 안 붙었다').toEqual(['X', 'A']);
  expect(s.rowAt, '★★⌘→ 가 «블럭 이동»으로 새었다').toBe(1);
  expect(s.active, '★선택이 옮긴 줄을 안 따라갔다').toEqual({ r: 0, c: 1, li: 1 });
  expect(r.pd, '★키를 안 먹었다').toBe(1);
  expect(errs).toEqual([]);
});

test('A2 ★꾸밈(크기·색)이 «화면에서» 그대로 따라온다 — 현빈이 적은 확인 항목', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  const before = (await snap(page)).shown0.find(x => x.text === 'A');
  await page.evaluate(() => window.__setActive(window.__block, { r: 0, c: 0, li: 0 }));

  await pressCmdLR(page, 'ArrowRight');
  const s = await snap(page);

  const after = s.shown1.find(x => x.text === 'A');
  expect(after, '★옮긴 줄이 도착 칸 «화면»에 없다').toBeTruthy();
  expect(after.fontSize, '★★크기가 안 따라왔다').toBe(before.fontSize);
  expect(after.color, '★★색이 안 따라왔다').toBe(before.color);
  expect(s.shown0.some(x => x.text === 'A'), '★출발 칸 화면에 아직 남아 있다').toBe(false);
  expect(errs).toEqual([]);
});

/* ═══ A3 — 칸의 끝: 먹고 멈춘다 ═══════════════════════════════════════════ */

test('A3 ★맨 왼쪽 칸에서 ⌘← — 아무것도 안 바뀌고 «행»도 제자리다(먹고 멈춘다)', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  await page.evaluate(() => window.__setActive(window.__block, { r: 0, c: 0, li: 0 }));

  const r = await pressCmdLR(page, 'ArrowLeft');
  const s = await snap(page);

  expect(s.c0, '★갈 칸이 없는데 줄이 움직였다').toEqual(['A', 'B', 'DUO']);
  expect(s.c1).toEqual(['X']);
  expect(s.rowAt, '★★갈 칸이 없으니 ⌘← 가 «블럭 이동»으로 샜다').toBe(1);
  expect(r.pd, '★키를 안 먹었다 — 「아무 일도 안 일어난다」로 보이는 것이 맞다').toBe(1);
  expect(r.pushLog, '★★아무것도 안 바꿨는데 이력이 쌓였다 = ⌘Z 가 «빈 칸»을 되돌린다').toEqual([]);
  expect(errs).toEqual([]);
});

/* ═══ A4 — ⓑ 중첩(duo) 안 줄: 먹고 멈춘다 ════════════════════════════════ */

test('A4 ★중첩 안 줄이 잡힌 채 ⌘→ — 아무것도 안 움직이고 토스트로 말한다', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  await page.evaluate(() => window.__setActive(window.__block, { r: 0, c: 0, li: 2, np: '0.0' }));

  const r = await pressCmdLR(page, 'ArrowRight');
  const s = await snap(page);

  expect(s.c0, '★★중첩 안 줄을 옮기려 했는데 «품은 duo 줄»이 통째로 옮겨졌다').toEqual(['A', 'B', 'DUO']);
  expect(s.c1).toEqual(['X']);
  expect(s.nested, '★중첩 안 줄 수가 바뀌었다').toBe(2);
  expect(s.alive, '★그리드 블록이 사라졌다').toBe(true);
  expect(r.pd, '★키를 안 먹었다').toBe(1);
  expect(r.toasts.length, '★아무 말도 없이 삼켰다').toBeGreaterThan(0);
  expect(r.pushLog, '★★막기만 했는데 이력이 쌓였다').toEqual([]);
  expect(errs).toEqual([]);
});

/* ═══ A5 — ⛔줄을 안 골랐으면 아무 일도 안 한다 ══════════════════════════ */

test('A5 ⛔★줄을 안 골랐으면 ⌘→ 는 아무 일도 안 한다 — 소진조차 안 한다(새 뜻을 안 만든다)', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  // 활성줄 없음 = 「블럭 전체 선택」. grdSetActiveLine 을 부르지 않는다.

  const r = await pressCmdLR(page, 'ArrowRight');
  const s = await snap(page);

  expect(s.c0).toEqual(['A', 'B', 'DUO']);
  expect(s.c1).toEqual(['X']);
  expect(s.rowAt, '★★줄도 안 골랐는데 블럭이 움직였다 — ⌘→ 에 없던 뜻이 생겼다').toBe(1);
  expect(r.pd, '★★키를 먹었다 — 흘려보내야 예전 동작(브라우저 기본)이 그대로 산다').toBe(0);
  expect(r.pushLog).toEqual([]);
  expect(errs).toEqual([]);
});

/* ═══ A6·P1 — 이력은 «한 칸» ══════════════════════════════════════════════ */

test('A6 ★★두 문이 나가는데 이력은 «한 칸»이다 — ⌘Z 한 번이 두 칸을 되돌린다', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  await page.evaluate(() => window.__setActive(window.__block, { r: 0, c: 0, li: 0 }));

  const r = await pressCmdLR(page, 'ArrowRight');

  expect(r.pushLog, '★★이력이 한 칸이 아니다 — 두 칸이면 ⌘Z 한 번은 «줄이 두 칸에 다 있는» 반쪽을 남긴다')
    .toEqual(['(updateGridBlock)']);
  expect(errs).toEqual([]);
});

test('P1 ★양성대조 — noHistory 를 떼면 이력이 «두 칸»이 된다(그래서 그 플래그가 필요하다)', async ({ page }) => {
  const MUT = {
    path: '/js/blocks/grid-block.js',
    from: 'if (opts.noHistory !== true) window.pushHistory?.();',
    to: 'window.pushHistory?.();',
  };
  const errs = await boot(page, MUT);
  await mount(page);
  await page.evaluate(() => window.__setActive(window.__block, { r: 0, c: 0, li: 0 }));

  const r = await pressCmdLR(page, 'ArrowRight');

  expect(r.pushLog.length, '★플래그를 떼었는데도 한 칸이다 — 이 양성대조는 «안 재고» 있다').toBe(2);
  expect(errs).toEqual([]);
});

/* ═══ P2 — 보호막 둘(상한 먼저보기 · 되돌림)을 갈라 잰다 ══════════════════ */

const LIMIT_GUARD = `  if (dstLines.length >= MAX_CELL_LINES) {
    window.showToast?.(\`⚠️ 줄 옮기기 실패: 셀당 최대 \${MAX_CELL_LINES}줄\`);
    return { ok: false, code: 'LIMIT' };
  }`;
/* ⛔닻은 «되돌림 한 덩이 전부»다 — 쓰기 한 줄만 떼면 아래 `if (back …)` 가 남아
   ReferenceError 로 죽는다(2026-09-27 실측: 이 대조가 그렇게 한 번 «안 재고» 빨개졌다).
   ★변이는 「그 보호막이 없던 판」을 만들어야 한다 — 「깨진 판」을 만들면 아무것도 못 잰다. */
const ROLLBACK = `    const back = window.updateGridBlock?.(block.id, { patchCell: { r: fr, c: fc, lines: srcLines } },
      { noHistory: true });
    if (back && back.ok === false) {
      window.showToast?.('⚠️ 줄 옮기기가 실패하고 되돌리지도 못했습니다 — ⌘Z 를 눌러 주세요');
    }`;

/** 도착 칸을 «꽉» 채운다(상한 20). ⇒ 보호막이 없으면 둘째 문이 TOO_MANY_LINES 로 거절된다. */
async function mountFull(page) {
  await page.evaluate(() => {
    const host = document.getElementById('host');
    const full = Array.from({ length: 20 }, (_, i) => ({ type: 'body', text: `F${i}` }));
    const { row, block } = window.__mk({ cols: [
      { width: 1, lines: [{ type: 'body', text: 'A' }, { type: 'body', text: 'B' }] },
      { width: 1, lines: full },
    ] });
    host.appendChild(row);
    block.classList.add('selected');
    window.__block = block;
    window.__row = row;
  });
}

async function cellTexts(page) {
  return page.evaluate(() => {
    const cells = window.__model(window.__block).cells[0];
    return { c0: cells[0].lines.map(l => l.text), c1: cells[1].lines.map(l => l.text) };
  });
}

test('P2 ★★양성대조 — 상한 먼저보기 ＋ 되돌림을 «둘 다» 떼면 줄이 ★어느 칸에도 없다', async ({ page }) => {
  const errs = await boot(page, [
    { path: '/js/props/prop-grid.js', from: LIMIT_GUARD, to: '' },
    { path: '/js/props/prop-grid.js', from: ROLLBACK, to: '' },
  ]);
  await mountFull(page);
  await page.evaluate(() => window.__setActive(window.__block, { r: 0, c: 0, li: 0 }));

  await pressCmdLR(page, 'ArrowRight');
  const t = await cellTexts(page);

  expect(t.c0, '★출발 칸에서 안 빠졌다 — 이 양성대조는 «안 재고» 있다').toEqual(['B']);
  expect(t.c1.includes('A'), '★★도착 칸에 들어갔다? 상한이 20인데 21번째가 통과했다 = 대조가 틀렸다').toBe(false);
  expect(t.c1.length, '★도착 칸이 바뀌었다').toBe(20);
  // ★여기까지가 「줄이 사라진다」의 증명이다 — 그래서 아래 P2b 가 「어느 보호막이 먼저 막나」를 가른다.
  expect(errs).toEqual([]);
});

test('P2b ★그 둘 중 «상한 먼저보기»를 남기면 줄이 산다 — 첫 방어선이 어느 쪽인지 가른다', async ({ page }) => {
  const errs = await boot(page, { path: '/js/props/prop-grid.js', from: ROLLBACK, to: '' });
  await mountFull(page);
  await page.evaluate(() => window.__setActive(window.__block, { r: 0, c: 0, li: 0 }));

  const r = await pressCmdLR(page, 'ArrowRight');
  const t = await cellTexts(page);

  expect(t.c0, '★★되돌림만 떼었는데 줄이 사라졌다 — 상한 먼저보기가 첫 방어선이 아니었다').toEqual(['A', 'B']);
  expect(t.c1.length).toBe(20);
  expect(r.toasts.length, '★막았는데 아무 말도 안 했다').toBeGreaterThan(0);
  expect(r.pushLog, '★아무것도 안 바꿨는데 이력이 쌓였다').toEqual([]);
  expect(errs).toEqual([]);
});
