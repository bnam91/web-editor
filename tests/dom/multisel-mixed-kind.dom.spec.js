/* multisel-mixed-kind.dom.spec.js — T-091 「종류가 다른 블럭을 ⇧클릭으로 같이 고르면
 * 먼저 고른 것이 풀리고, 우측 패널이 «Page» 로 떠서 정렬을 못 쓴다」
 *
 * ★실측 재현(2026-09-21, 포트 9544 실앱)
 *   ① 글자 블럭 클릭 → 패널 「Text Block」, .selected = [sec, tb]
 *   ② 같은 섹션의 그룹 프레임(.frame-block[data-group]) ⇧클릭
 *      → .selected = [sec, frame] «글자가 빠졌다» · 패널 = 「Page」
 *
 * ★뿌리 둘 (둘 다 코드에서 실측)
 *   ⒜ js/block-drag.js 프레임 pointerdown 갈래가 보조키를 «안 보고» deselectAll() 을 불렀다.
 *      deselectAll 은 js/editor.js 에서 `_lastClickedBlock = null` 로 앵커를 지운다 ⇒ 뒤이은
 *      click 의 rangeSelectBlocks 가 앵커를 잃고 «단일 선택» 폴백으로 떨어진다.
 *      (같은 요소의 mousedown 갈래는 이미 같은 가드를 갖고 있었다 — 한쪽만 빠져 있었다)
 *   ⒝ 세는 목록(FLOW_BLOCK_SEL_SELECTED)에 «.frame-block» 이 없었다. ⇧클릭의 «단위»를 정하는
 *      SIBLING_MULTI_SEL 엔 '.frame-block' 이 있는데 세는 쪽엔 없어서, 「글자1+프레임1」이
 *      둘 다 골라져도 n=1 ⇒ 멀티선택 패널이 안 뜨고 직전 deselectAll 이 띄운 «Page» 가 남았다.
 *
 * ⛔앱을 «안» 띄운다 — 진짜 소스에서 «그 핸들러/함수»를 떠내 실행한다(선례: qa0920b-multi-delete).
 * 실행: npm run test:dom -- multisel-mixed-kind
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const DRAG_SRC   = fs.readFileSync(path.join(REPO, 'js/block-drag.js'), 'utf8');
const EDITOR_SRC = fs.readFileSync(path.join(REPO, 'js/editor.js'), 'utf8');

/** 중괄호 균형으로 «그 자리»의 블록을 떠낸다(문자열·주석은 안 건너뛴다 — 대상이 짧아 충분). */
function sliceBraces(src, from) {
  let i = src.indexOf('{', from);
  if (i < 0) throw new Error('여는 중괄호를 못 찾았다');
  let b = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') b++;
    else if (src[i] === '}') { b--; if (b === 0) return src.slice(src.indexOf('{', from) + 1, i); }
  }
  throw new Error('닫는 중괄호를 못 찾았다');
}
/** `function NAME(...) {...}` 전체. */
function extractFn(src, name) {
  const m = new RegExp('function\\s+' + name + '\\s*\\(').exec(src);
  if (!m) throw new Error('함수를 못 찾았다: ' + name);
  return 'function ' + name + '(' + src.slice(src.indexOf('(', m.index) + 1, src.indexOf(')', m.index)) + ') {'
    + sliceBraces(src, src.indexOf(')', m.index)) + '}';
}
/** `const NAME = '...';` 의 문자열 값. */
function declString(src, name) {
  const i = src.indexOf(`const ${name} = '`);
  if (i < 0) throw new Error(`선언을 못 찾았다: ${name}`);
  const s = src.indexOf("'", i + `const ${name} = `.length);
  const e = src.indexOf("';", s + 1);
  if (e < 0) throw new Error('선언의 끝을 못 찾았다');
  return src.slice(s + 1, e);
}

/* ⒜ 프레임 pointerdown 핸들러 «원문». 손으로 베껴 적지 않는다 — 베끼면 소스가 바뀌어도 초록이다. */
const PD_MARK = "ss.addEventListener('pointerdown', e => {";
const PD_AT = DRAG_SRC.indexOf(PD_MARK);
if (PD_AT < 0) throw new Error('프레임 pointerdown 핸들러를 못 찾았다 — 검사가 대상을 놓쳤다');
const PD_BODY = sliceBraces(DRAG_SRC, PD_AT + PD_MARK.length - 1);

/* ⒝ 세는 자리 — 목록·거르개 둘 다 «정본»에서 떠온다. */
const FLOW_SEL   = declString(EDITOR_SRC, 'FLOW_BLOCK_SEL_SELECTED');
const IS_FREE_FN = extractFn(EDITOR_SRC, '_isInFreeLayout');
const IS_UNIT_FN = extractFn(EDITOR_SRC, '_isFlowMultiSelUnit');

const HARNESS = `<!doctype html><html><head><meta charset="utf-8"></head><body>
  <div id="canvas">
    <div class="section-block" id="sec1">
      <div class="section-inner" id="inner1">
        <div class="frame-block" data-text-frame="true" id="tf1"><div class="text-block" id="tb1">글자</div></div>
        <div class="frame-block" data-group="true" id="gf1">
          <div class="divider-block" id="dvd1"></div>
          <div class="divider-block" id="dvd2"></div>
        </div>
        <!-- 도형 한 벌 — 실앱과 같은 골격: 전용 래퍼(data-free-layout) + 그 «안»의 shape-block.
             selectShapeBlock 은 이 둘을 «한 몸으로» 켠다(js/block-drag.js:2652~2658). -->
        <div class="frame-block" data-free-layout="true" id="sf1">
          <div class="shape-block" id="shp1" style="position:absolute;left:0;top:0"></div>
        </div>
      </div>
    </div>
  </div>
  <script>window.__ready = true;</script></body></html>`;

async function boot(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(`${ORIGIN}/**`, route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: HARNESS }));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

/** 프레임 pointerdown «원문»을 진짜로 돌려서 deselectAll 이 불렸는지 센다. */
async function runPointerDown(page, body, mods) {
  return page.evaluate(([src, m]) => {
    const ss = document.getElementById('gf1');
    ss.classList.remove('selected');
    let deselects = 0;
    window.deselectAll = () => { deselects++; document.querySelectorAll('.selected').forEach(e => e.classList.remove('selected')); };
    window.syncLayerActive = () => {};
    window.highlightBlock = () => {};
    window.showFrameProperties = () => {};
    const e = {
      target: ss, shiftKey: !!m.shift, metaKey: !!m.meta, ctrlKey: !!m.ctrl,
    };
    new Function('ss', 'e', src)(ss, e);
    return { deselects, frameSelected: ss.classList.contains('selected') };
  }, [body, mods]);
}

test('P1 ★프레임 ⇧/⌘ pointerdown 은 선택을 «건드리지 않는다» (앵커가 살아야 ⇧범위선택이 산다)', async ({ page }) => {
  const errs = await boot(page);
  for (const mods of [{ shift: 1 }, { meta: 1 }, { ctrl: 1 }]) {
    const r = await runPointerDown(page, PD_BODY, mods);
    expect(r.deselects, `보조키(${JSON.stringify(mods)})인데 deselectAll 이 불렸다 — 앵커가 지워진다`).toBe(0);
    expect(r.frameSelected, '보조키 pointerdown 이 프레임을 단독 선택했다').toBe(false);
  }
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('P2 대조 — 보조키 «없이» 빈 영역을 누르면 종전대로 즉시 단독 선택된다', async ({ page }) => {
  await boot(page);
  const r = await runPointerDown(page, PD_BODY, {});
  expect(r.deselects, '평범한 클릭인데 선택 정리가 안 일어났다 — 가드가 너무 넓다').toBe(1);
  expect(r.frameSelected, '평범한 클릭인데 프레임이 안 골라졌다').toBe(true);
});

/** 정본 목록 + 정본 거르개로 «단위 수»를 센다(_countFlowMultiSel 과 같은 식).
 *  ⚠️거르개는 «목록 상수»도 읽는다(2026-09-22 T-091 ⑥ — 조상 판정이 「.selected 아무거나」에서
 *    「세는 목록에 드는 .selected」로 바뀌었다). 그래서 상수도 같이 떠서 스코프에 넣는다. */
async function countUnits(page) {
  return page.evaluate(([sel, freeFn, unitFn]) => {
    const f = new Function(
      `const FLOW_BLOCK_SEL_SELECTED = ${JSON.stringify(sel)}; ${freeFn}; ${unitFn}; return _isFlowMultiSelUnit;`)();
    return [...document.querySelectorAll(sel)].filter(f).length;
  }, [FLOW_SEL, IS_FREE_FN, IS_UNIT_FN]);
}

test('U1 ★「글자 1 + 그룹 프레임 1」 = 2 단위 (1 이면 패널이 Page 로 남는다)', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => {
    document.getElementById('tb1').classList.add('selected');
    document.getElementById('gf1').classList.add('selected');
  });
  expect(await countUnits(page), '종류가 다른 둘을 골랐는데 1 로 센다').toBe(2);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('U2 회귀 — 프레임 «자체»만 고르면 1 (멀티 패널이 뜨면 안 된다)', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => document.getElementById('gf1').classList.add('selected'));
  expect(await countUnits(page)).toBe(1);
});

test('U3 회귀 — 프레임 «안»의 블록을 고르면 그 프레임은 «조상»이라 안 센다', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    document.getElementById('gf1').classList.add('selected');   // 조상으로 켜진 프레임
    document.getElementById('dvd1').classList.add('selected');
  });
  expect(await countUnits(page), '조상 프레임까지 세면 블록 하나에도 멀티 패널이 뜬다').toBe(1);
});

/* ⒟ 2026-09-22 — T-091 «나온 뒤» ⑥ 「정렬이 실제로 되는지」를 쫓아가다 나온 나머지 반쪽.
   실측(포트 9634, 고치기 «전»): 글자를 고르고 도형을 ⇧클릭하면 둘 다 .selected 가 되긴 하는데
     · 세는 목록에서 도형 래퍼가 «조상»으로 버려져 흐름 단위가 2(글자둘)뿐이었고
     · 패널은 «방금 누른 블록»만 보고 자유배치 멀티셀렉(X/Y/W/H)으로 갔다.
   그 패널의 정렬은 style.left/top 을 쓴다 ⇒ 글자는 꿈쩍 않고(정적 배치) 도형은 자기 래퍼 밖으로
   날아갔다 — shape 의 섹션 기준 왼쪽 여백이 308 → 924 (섹션 오른끝을 308px 넘어감). */

test('U5 ★「글자 1 + 도형 1」 = 2 단위 — 도형은 래퍼와 알맹이가 «한 몸»으로 켜진다', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => {
    document.getElementById('tb1').classList.add('selected');
    document.getElementById('sf1').classList.add('selected');   // selectShapeBlock 이 켜는 둘…
    document.getElementById('shp1').classList.add('selected');  // …을 그대로 재현
  });
  expect(await countUnits(page), '도형 래퍼가 «조상»으로 버려졌다 — 글자와 같이 골라도 도형만 빠진다').toBe(2);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('U5-neg 음성대조 — 옛 규칙(«.selected 아무거나»)으로 재면 같은 자리가 1 이 된다', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    document.getElementById('tb1').classList.add('selected');
    document.getElementById('sf1').classList.add('selected');
    document.getElementById('shp1').classList.add('selected');
  });
  const old = await page.evaluate(([sel, freeFn]) => {
    /* 옛 거르개 한 벌 — 프레임 조상 판정만 «.selected 아무거나»로 되돌린 판 */
    const f = new Function(`${freeFn}; return function (el) {
      if (!el || _isInFreeLayout(el)) return false;
      if (el.classList.contains('frame-block')) {
        if (el.dataset.textFrame === 'true') return false;
        if (el.querySelector('.selected')) return false;
      }
      return true;
    };`)();
    return [...document.querySelectorAll(sel)].filter(f).length;
  }, [FLOW_SEL, IS_FREE_FN]);
  expect(old, '옛 규칙인데도 2 가 나온다 — 이 검사는 고침을 안 재고 있다').toBe(1);
});

/* ⒠ 패널 «고르기» — 어느 멀티셀렉 패널을 띄우느냐. 원문을 떠서 돌린다. */
const PANEL_FN = extractFn(EDITOR_SRC, '_updateMultiSelPanel');

async function pickPanel(page, { flowUnits, inFree }) {
  return page.evaluate(([src, n, free]) => {
    const calls = [];
    const scope = {
      _countFlowMultiSel: () => n,
      _isInFreeLayout: () => !!free,
      _updateFreeLayoutMultiSelPanel: () => calls.push('free'),
      propPanel: { innerHTML: '' },
    };
    window.showFlowMultiSelPanel = () => calls.push('flow');
    const names = Object.keys(scope);
    new Function(...names, src + '; return _updateMultiSelPanel;')(...names.map(k => scope[k]))({});
    return calls;
  }, [PANEL_FN, flowUnits, inFree]);
}

test('R1 ★흐름 단위가 둘 이상이면 «방금 누른 게 도형이어도» 흐름 패널이다', async ({ page }) => {
  await boot(page);
  expect(await pickPanel(page, { flowUnits: 3, inFree: true }),
    '도형을 눌렀다는 이유로 자유배치 패널로 갔다 — 거기 정렬은 left/top 이라 글자가 안 움직인다').toEqual(['flow']);
});

test('R2 회귀 — 순수 자유배치 선택(흐름 단위 0)은 종전대로 자유배치 패널', async ({ page }) => {
  await boot(page);
  expect(await pickPanel(page, { flowUnits: 0, inFree: true })).toEqual(['free']);
});

test('R3 회귀 — 흐름 단위가 1 이하면 패널을 억지로 바꾸지 않는다(단일 선택)', async ({ page }) => {
  await boot(page);
  expect(await pickPanel(page, { flowUnits: 1, inFree: false })).toEqual([]);
});

test('U4 회귀 — 텍스트프레임은 «그릇»이다(단위는 안의 text-block)', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    document.getElementById('tf1').classList.add('selected');
    document.getElementById('tb1').classList.add('selected');
  });
  expect(await countUnits(page), '텍스트프레임을 따로 세면 글자 하나가 둘로 센다').toBe(1);
});

/* ⒞ 같은 병의 «다른 문» — 레이어패널의 프레임 줄. 실측(2026-09-21): 글자 줄을 고른 뒤
   Group 줄을 ⇧클릭하면 먼저 고른 것이 풀렸다. 블록 줄(makeLayerBlockItem)은 예전부터
   rangeSelectBlocks/toggleBlockSelect 로 보내는데 프레임 줄만 «안 보고» deselectAll 로 시작했다.
   ⇒ 고르기가 «같은 판정»을 쓰는지 잰다. 여기도 원문을 떠서 돌린다. */
const ITEMS_SRC = fs.readFileSync(path.join(REPO, 'js/panels/layer-panel-items.js'), 'utf8');
const FRAME_FN_AT = ITEMS_SRC.indexOf('function makeLayerFrameItem');
if (FRAME_FN_AT < 0) throw new Error('makeLayerFrameItem 을 못 찾았다 — 검사가 대상을 놓쳤다');
function clickBodyAfter(src, from, marker) {
  const at = src.indexOf(marker, from);
  if (at < 0) throw new Error('클릭 핸들러를 못 찾았다: ' + marker);
  return sliceBraces(src, at + marker.length - 1);
}
/* 자식 없는 프레임 줄(wrapper) · 자식 있는 프레임 줄(header) — 둘 다 «그 프레임의 줄»이다. */
const LP_BODIES = {
  wrapper: clickBodyAfter(ITEMS_SRC, FRAME_FN_AT, "wrapper.addEventListener('click', e => {"),
  header:  clickBodyAfter(ITEMS_SRC, FRAME_FN_AT, "header.addEventListener('click', e => {"),
};

async function runLayerClick(page, body, which, mods) {
  return page.evaluate(([src, w, m]) => {
    const ssEl = document.getElementById('gf1');
    const calls = [];
    window.toggleBlockSelect = () => calls.push('toggle');
    window.rangeSelectBlocks = () => calls.push('range');
    window.deselectAll = () => { calls.push('deselect'); document.querySelectorAll('.selected').forEach(e => e.classList.remove('selected')); };
    window.syncLayerActive = () => {}; window.highlightBlock = () => {};
    window.showFrameProperties = () => {}; window.showFrameHandles = () => {};
    window.selectShapeBlock = () => false;
    const scope = {
      ssEl, sec: document.getElementById('sec1'),
      wrapper: document.createElement('div'), header: document.createElement('div'),
      _isShapeFrameEl: () => false,
      group: document.createElement('div'),
    };
    const e = { target: document.createElement('span'), shiftKey: !!m.shift, metaKey: !!m.meta, ctrlKey: !!m.ctrl };
    e.target.closest = () => null;
    const names = Object.keys(scope);
    new Function(...names, 'e', src)(...names.map(n => scope[n]), e);
    return { calls, which: w };
  }, [body, which, mods]);
}

for (const which of ['wrapper', 'header']) {
  test(`L-${which} ★레이어패널 프레임 줄도 ⇧/⌘ 는 «같은 판정»으로 보낸다 (캔버스와 한 자리)`, async ({ page }) => {
    const errs = await boot(page);
    const sh = await runLayerClick(page, LP_BODIES[which], which, { shift: 1 });
    expect(sh.calls, `⇧클릭이 rangeSelectBlocks 로 안 갔다 (calls=${sh.calls})`).toEqual(['range']);
    const cm = await runLayerClick(page, LP_BODIES[which], which, { meta: 1 });
    expect(cm.calls, `⌘클릭이 toggleBlockSelect 로 안 갔다 (calls=${cm.calls})`).toEqual(['toggle']);
    const pl = await runLayerClick(page, LP_BODIES[which], which, {});
    expect(pl.calls[0], '평범한 클릭이 단독 선택으로 시작하지 않는다 — 가드가 너무 넓다').toBe('deselect');
    expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
  });
}
