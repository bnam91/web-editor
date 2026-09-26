/* grid-line-move-cmdarrow.dom.spec.js — 「칸 안의 줄을 ⌘↑/↓ 로 옮긴다」. (2026-09-26, 현빈 실기 관측)
 *
 * ★증상 — 「그리드 칸 안에 줄을 고른 뒤 ⌘방향키를 누르면 그 줄이 칸 안에서 움직여야 하는데
 *   «그리드 블럭이 통째로» 움직인다」.
 * ★왜 그랬나 — ⌘↑/↓ 분기(js/editor.js)는 `.selected` «블럭»만 봤다. 줄은 모델(WeakMap,
 *   _grdActiveLine)에만 선택되고 .grid-block 의 .selected 는 그대로 붙어 있으므로, 그 분기가
 *   `closest('.row')` 를 집어 «행»을 옮겼다. ⇒ ★회귀가 아니라 «없던 기능»이다.
 *
 * ★이번 판의 범위 — ⓐ«바깥 줄»(칸의 lines[] 최상위)을 «같은 칸 안»에서만 옮긴다.
 *   ⛔ⓑ중첩(duo) «안»의 줄은 옮기지 않는다 — 쓰는 길(patchCell)이 중첩으로 못 내려간다(T-220 몫).
 *     대신 «먹고 멈춘다»(토스트) — T-200 의 ⌫ np 바일아웃과 «같은 꼴»이다.
 *
 * ★무엇을 잠그나
 *   M1·M2  ⓐ 바깥 줄이 «칸 안에서» 움직인다 — 그리고 ★행(.row)은 «제자리»다.
 *   M3     칸의 끝에서는 «먹고 멈춘다» — ⛔여기서 흘리면 「맨 위 줄에서 ⌘↑」가 블럭 이동이 된다.
 *   M4     ⓑ 중첩 안 줄은 먹고 멈춘다(토스트) — ★이력에 «빈 항목»도 안 쌓인다.
 *   M5     ⛔회귀 1순위 — 줄이 «안» 골라졌으면 블럭 이동은 예전 그대로다.
 *   M6     다중선택이면 줄 이동을 안 한다(⌫ 의 0918r2 T-058 게이트와 같은 판정).
 *   ★양성대조를 «셋»으로 갈랐다(M1-양성 · M3-양성 · M4-양성) — 이 레포는 «문이 둘»인 것이
 *     버릇이라 한쪽만 떼면 증상이 안 바뀔 수 있다. 세 문을 각각 떼서 각각 «무엇으로 새는가»를 잰다.
 *
 * ⚠️★이 그물이 «못» 닿는 곳(정직하게) — 진짜 키보드 이벤트다. ⌘↑/↓ 분기는 editor.js 의
 *   «익명 keydown 리스너» 안에 있어 import 로 못 잡는다 ⇒ 분기 «몸통»을 중괄호 균형으로 떠내
 *   함수로 감싸 직접 때린다(tests/dom/keys-esc-arrow.dom.spec.js 의 _ARROW 선례와 같은 수법).
 *   즉 재는 것은 「그 분기가 줄을 옮기는가」이고, 「document keydown 이 그 분기에 정말 닿는가」는
 *   ★tests/unit/grid-line-move-wiring.test.mjs(소스 배선) ＋ 앱 실기의 몫이다
 *   (현빈 앱 9376 무접촉이라 이번 판에선 실기를 못 밟았다).
 *
 * ⛔앱을 «안» 띄운다. 실행: npm run test:dom -- grid-line-move-cmdarrow
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };
const EDITOR_SRC = fs.readFileSync(path.join(REPO, 'js/editor.js'), 'utf8');

/** 함수 «전체»를 중괄호 균형으로 떠낸다. grid-nested-line-select.dom.spec.js 와 «같은 부품». */
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

/* ⌘↑/↓ 분기의 «몸통»을 떠낸다.
   ⛔글자수 창(`slice(k, k+N)`)을 쓰지 마라 — keys-esc-arrow-wiring 이 실측한 실패 모드다
     (창이 옆 분기까지 덮어서, 재려던 줄을 지워도 «옆집 것»에 걸려 초록이 났다). */
const CMD_ARROW_ANCHOR = "if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && (e.metaKey || e.ctrlKey)) {";
function extractCmdArrowBlock(src) {
  const n = src.split(CMD_ARROW_ANCHOR).length - 1;
  if (n !== 1) throw new Error(`⌘방향키 분기가 ${n} 곳이다 — 하나여야 한다 (editor.js)`);
  const k = src.indexOf(CMD_ARROW_ANCHOR);
  let d = 0, i = k;
  for (; i < src.length; i++) {
    if (src[i] === '{') d++;
    else if (src[i] === '}') { d--; if (d === 0) { i++; break; } }
  }
  if (i >= src.length) throw new Error('⌘방향키 분기의 끝을 못 찾았다 (editor.js)');
  return src.slice(k, i);
}
const CMD_ARROW_SRC = extractCmdArrowBlock(EDITOR_SRC);
const MOVE_SRC = extractFn(EDITOR_SRC, 'moveGridLineFromCanvas');

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
  import { showGridProperties, grdSetActiveLine, grdGetActiveLine, grdMoveLine } from '/js/props/prop-grid.js';
  window.__mk = makeGridBlock;
  window.__render = renderGridBlock;
  window.__update = updateGridBlock;
  window.__model = getGridModel;
  window.__open = showGridProperties;
  window.__setActive = grdSetActiveLine;
  window.__getActive = grdGetActiveLine;
  window.__moveLine = grdMoveLine;
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

/* 칸(0,0) = 바깥 줄 ★3개 — [0]'L0' · [1]'L1' · [2]중첩 duo(안쪽 줄 2+1 = ★3).
   ⇒ 바깥 줄을 옮길 자리(M1·M2)와 중첩 게이트(M4)를 «한 fixture»로 같이 잰다. */
const FIXTURE = {
  cols: [
    { width: 1, lines: [
      { type: 'body', text: 'L0' },
      { type: 'body', text: 'L1' },
      { type: 'duo', cols: [
        { width: 1, lines: [{ type: 'body', text: 'IN-A' }, { type: 'body', text: 'IN-B' }] },
        { width: 1, lines: [{ type: 'body', text: 'IN-C' }] },
      ] },
    ] },
    { width: 1, lines: [{ type: 'body', text: '내용을 입력하세요.' }] },
  ],
};

/** 그리드 행을 «가운데»에 두고 위·아래로 옆 행을 심는다.
 *  ★왜 가운데인가 — 맨 위에 두면 「⌘↑ 로 블럭이 새어 움직이는가」를 «잴 수 없다»(위로 갈 자리가
 *    없어 누수가 있어도 행이 제자리다). M3-양성이 그래서 한 번 «아무것도 안 재고» 빨개졌다
 *    (2026-09-26 실측) — 계측기가 아니라 «기댓값»이 틀렸던 자리다. 양쪽으로 잴 수 있게 둔다. */
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

/** ⌘↑/↓ 분기를 «직접» 때린다. pushHistory 는 세는 가짜 — updateGridBlock 이 window.pushHistory 로
 *  스스로 쌓는 것과 분기가 부르는 것을 «라벨»로 가른다(분기는 '블록 이동', updateGridBlock 은 undefined). */
async function pressCmdArrow(page, key, { moveSrc = MOVE_SRC, arrowSrc = CMD_ARROW_SRC } = {}) {
  return page.evaluate(({ key, moveSrc, arrowSrc }) => {
    window.__pushLog = [];
    window.__toasts = [];
    window.pushHistory = (label) => window.__pushLog.push(label === undefined ? '(updateGridBlock)' : label);
    window.showToast = (m) => window.__toasts.push(m);
    window.buildLayerPanel = () => {};
    const fn = new Function('pushHistory', `${moveSrc};\nreturn function (e) { ${arrowSrc} };`)(window.pushHistory);
    let pd = 0;
    fn({ key, metaKey: true, ctrlKey: false, altKey: false, shiftKey: false,
         target: document.body, preventDefault() { pd++; } });
    return { pd, pushLog: window.__pushLog, toasts: window.__toasts };
  }, { key, moveSrc, arrowSrc });
}

/** 지금 화면/모델 상태 — «칸의 줄 차례» · «행의 자리» · «중첩 줄 수» · «활성줄». */
async function snap(page) {
  return page.evaluate(() => {
    const lines = window.__model(window.__block).cells[0][0].lines;
    const host = document.getElementById('host');
    return {
      order: lines.map(l => (l.type === 'duo' ? 'DUO' : l.text)),
      rowAt: [...host.children].indexOf(window.__row),
      nested: window.__block.querySelectorAll('[data-npath]').length,
      active: window.__getActive(window.__block),
      alive: document.body.contains(window.__block),
    };
  });
}

/* ═══ M0 — 양성대조를 «먼저»: fixture 가 정말 그 모양인가 ══════════════════ */

test('M0 ★양성대조(먼저) — 바깥 줄 3 · 중첩 안 줄 3 · 그리드 행이 «가운데» 행이다', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  const s = await snap(page);
  expect(s.order, '★fixture 가 기대한 모양이 아니다 — 아래 검사들은 «안 재고» 있다').toEqual(['L0', 'L1', 'DUO']);
  expect(s.nested, '★중첩 안 줄이 3개가 아니다').toBe(3);
  expect(s.rowAt, '★그리드 행이 «가운데»가 아니다 — 위·아래 두 방향을 못 잰다').toBe(1);
  expect(errs).toEqual([]);
});

/* ═══ M1·M2 — ⓐ 바깥 줄이 «칸 안에서» 움직인다 ════════════════════════════ */

test('M1 ★바깥 줄 [0] 에서 ⌘↓ — 줄이 칸 안에서 내려가고 «행»은 제자리다', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  await page.evaluate(() => window.__setActive(window.__block, { r: 0, c: 0, li: 0 }));

  const r = await pressCmdArrow(page, 'ArrowDown');
  const s = await snap(page);

  expect(s.order, '★줄이 칸 안에서 안 내려갔다').toEqual(['L1', 'L0', 'DUO']);
  expect(s.rowAt, '★★행이 움직였다 = 현빈이 본 그 증상(블럭이 통째로 움직인다)').toBe(1);
  expect(s.active, '★선택이 «옮긴 줄»을 따라가지 않았다 — 패널이 딴 줄을 가리킨다')
    .toEqual({ r: 0, c: 0, li: 1 });
  expect(r.pd, '★키를 안 먹었다 — 브라우저 기본 스크롤이 캔버스를 민다').toBe(1);
  expect(r.pushLog, '★이력이 «블록 이동»으로 쌓였다 = 분기가 블럭을 옮겼다는 뜻')
    .toEqual(['(updateGridBlock)']);
  expect(errs).toEqual([]);
});

test('M2 ★바깥 줄 [1] 에서 ⌘↑ — 줄이 칸 안에서 올라가고 «행»은 제자리다', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  await page.evaluate(() => window.__setActive(window.__block, { r: 0, c: 0, li: 1 }));

  await pressCmdArrow(page, 'ArrowUp');
  const s = await snap(page);

  expect(s.order).toEqual(['L1', 'L0', 'DUO']);
  expect(s.rowAt, '★행이 움직였다').toBe(1);
  expect(s.active).toEqual({ r: 0, c: 0, li: 0 });
  expect(errs).toEqual([]);
});

test('M1-양성 ★줄 이동 분기를 떼면 «행»이 통째로 움직인다(그래서 그 분기가 필요하다)', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  await page.evaluate(() => window.__setActive(window.__block, { r: 0, c: 0, li: 0 }));

  const ANCHOR = "if (moveGridLineFromCanvas({ dir: e.key === 'ArrowUp' ? -1 : 1 })) { e.preventDefault(); return; }";
  expect(CMD_ARROW_SRC.includes(ANCHOR), '★변이 닻을 못 찾았다 — 이 양성대조는 «안 재고» 있다').toBe(true);
  const mutated = CMD_ARROW_SRC.replace(ANCHOR, '');
  await pressCmdArrow(page, 'ArrowDown', { arrowSrc: mutated });
  const s = await snap(page);

  expect(s.order, '★줄이 움직였다 — 배선을 떼었는데도? 이 양성대조는 «안 재고» 있다').toEqual(['L0', 'L1', 'DUO']);
  expect(s.rowAt, '★★행이 «안» 움직였다 — 이 양성대조는 «안 재고» 있다(옛 동작이 이게 아니었다는 뜻)').toBe(2);
  expect(errs).toEqual([]);
});

/* ═══ M3 — 칸의 끝: «먹고 멈춘다» ═════════════════════════════════════════ */

test('M3 ★맨 위 줄에서 ⌘↑ — 아무것도 안 바뀌고 «행»도 제자리다(먹고 멈춘다)', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  await page.evaluate(() => window.__setActive(window.__block, { r: 0, c: 0, li: 0 }));

  const r = await pressCmdArrow(page, 'ArrowUp');
  const s = await snap(page);

  expect(s.order, '★칸의 끝인데 줄 차례가 바뀌었다').toEqual(['L0', 'L1', 'DUO']);
  expect(s.rowAt, '★★맨 위 줄에서 ⌘↑ 가 «블럭 이동»으로 새었다 — 사용자에겐 갑자기 딴 일이 일어난다').toBe(1);
  expect(r.pd, '★키를 안 먹었다').toBe(1);
  expect(r.pushLog, '★★아무것도 안 바꿨는데 이력이 쌓였다 = ⌘Z 가 «빈 칸»을 되돌린다').toEqual([]);
  expect(errs).toEqual([]);
});

test('M3-양성 ★바깥 줄 분기의 consumed 를 떼면 칸의 끝에서 «행»이 움직인다', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  await page.evaluate(() => window.__setActive(window.__block, { r: 0, c: 0, li: 0 }));

  const ANCHOR = "if (gridSel && gridAddr && gridAddr.li !== null && gridAddr.li !== undefined) {";
  expect(MOVE_SRC.includes(ANCHOR), '★변이 닻을 못 찾았다 — 이 양성대조는 «안 재고» 있다').toBe(true);
  const mutated = MOVE_SRC.replace(ANCHOR, 'if (false) {');
  await pressCmdArrow(page, 'ArrowUp', { moveSrc: mutated });
  const s = await snap(page);

  expect(s.rowAt, '★분기를 떼었는데도 행이 제자리다 — 이 양성대조는 «안 재고» 있다').toBe(0);
  expect(errs).toEqual([]);
});

/* ═══ M4 — ⓑ 중첩(duo) 안 줄: 먹고 멈춘다 ════════════════════════════════ */

test('M4 ★중첩 안 줄이 잡힌 채 ⌘↑ — 아무것도 안 움직이고 토스트로 말한다', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  await page.evaluate(() => window.__setActive(window.__block, { r: 0, c: 0, li: 2, np: '0.0' }));

  const r = await pressCmdArrow(page, 'ArrowUp');
  const s = await snap(page);

  expect(s.order, '★★중첩 안 줄을 옮기려 했는데 «품은 duo 줄»이 통째로 옮겨졌다').toEqual(['L0', 'L1', 'DUO']);
  expect(s.rowAt, '★행이 움직였다 — np 바일아웃이 consumed 를 안 세웠다').toBe(1);
  expect(s.nested, '★중첩 안 줄 수가 바뀌었다').toBe(3);
  expect(s.alive, '★그리드 블록이 사라졌다').toBe(true);
  expect(r.pd, '★키를 안 먹었다').toBe(1);
  expect(r.toasts.length, '★아무 말도 없이 삼켰다 — 사용자는 ⌘↑ 가 왜 안 먹는지 모른다').toBeGreaterThan(0);
  expect(r.pushLog, '★★막기만 했는데 이력이 쌓였다 = ⌘Z 가 «빈 칸»을 되돌린다(규약: 막는 분기는 pushHistory 앞)').toEqual([]);
  expect(errs).toEqual([]);
});

test('M4-양성 ★np 바일아웃을 떼면 «품은 duo 줄»이 통째로 옮겨진다', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  await page.evaluate(() => window.__setActive(window.__block, { r: 0, c: 0, li: 2, np: '0.0' }));

  const ANCHOR = 'if (gridSel && gridAddr && gridAddr.np) {';
  expect(MOVE_SRC.includes(ANCHOR), '★변이 닻을 못 찾았다 — 이 양성대조는 «안 재고» 있다').toBe(true);
  const mutated = MOVE_SRC.replace(ANCHOR, 'if (false) {');
  await pressCmdArrow(page, 'ArrowUp', { moveSrc: mutated });
  const s = await snap(page);

  expect(s.order, '★바일아웃을 떼었는데도 차례가 그대로다 — 이 양성대조는 «안 재고» 있다')
    .toEqual(['L0', 'DUO', 'L1']);
  expect(errs).toEqual([]);
});

/* ═══ M5 — ⛔회귀 1순위: 줄이 «안» 골라졌으면 블럭 이동 그대로 ═══════════ */

test('M5 ⛔★줄을 안 골랐으면 ⌘↓ 는 «블럭(행)»을 옮긴다 — 기존 동작이 그대로 산다', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  // 활성줄 없음 = 「블럭 전체 선택」. grdSetActiveLine 을 부르지 않는다.

  const r = await pressCmdArrow(page, 'ArrowDown');
  const s = await snap(page);

  expect(s.rowAt, '★★블럭 이동이 죽었다 — 이게 회귀 1순위다').toBe(2);
  expect(s.order, '★줄을 안 골랐는데 줄 차례가 바뀌었다').toEqual(['L0', 'L1', 'DUO']);
  expect(r.pushLog, '★블럭 이동이 되돌리기에 안 쌓인다').toEqual(['블록 이동']);
  expect(r.toasts, '★줄을 안 골랐는데 줄 이동 안내문이 떴다').toEqual([]);
  expect(errs).toEqual([]);
});

test('M5-b ⛔★활성줄이 «빈 칸»(li:null, 셀 모드)이면 블럭 이동으로 흐른다 — ⌫ 와 같은 뜻', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  await page.evaluate(() => window.__setActive(window.__block, { r: 0, c: 1, li: null }));

  await pressCmdArrow(page, 'ArrowDown');
  const s = await snap(page);
  expect(s.rowAt, '★빈 칸 선택에서 ⌘↓ 가 먹혀 아무 일도 안 일어났다 — ⌫ 는 그때 블럭을 지운다').toBe(2);
  expect(errs).toEqual([]);
});

/* ═══ M6 — 다중선택이면 줄 이동을 안 한다(⌫ 의 0918r2 T-058 게이트와 같은 판정) ═ */

test('M6 ★다른 블럭도 골라져 있으면 줄을 안 옮긴다 — 줄 선택을 끝내고 블럭 이동으로 흐른다', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  await page.evaluate(() => {
    window.__setActive(window.__block, { r: 0, c: 0, li: 0 });
    document.getElementById('tb-row-after').classList.add('selected');   // ⌘클릭 다중선택 꼴
  });

  await pressCmdArrow(page, 'ArrowDown');
  const s = await snap(page);

  expect(s.order, '★★다중선택인데 첫 그리드의 줄이 조용히 옮겨졌다(⌫ 쪽에서 실제로 났던 누수)')
    .toEqual(['L0', 'L1', 'DUO']);
  expect(s.active, '★줄 선택이 안 풀렸다 — 다음 키도 같은 누수로 간다').toBe(null);
  expect(errs).toEqual([]);
});
