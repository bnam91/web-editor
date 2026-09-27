/* grid-nested-line-select.dom.spec.js — T-200 커밋 ② «보이게만». (2026-09-25, 현빈 지시)
 *
 * ★무엇을 재나 — 커밋 ① 이 중첩 안 줄에 붙인 주소(data-nroot/data-npath)로
 *   ⑴ 클릭이 «그 줄»을 집고 ⑵ 캔버스가 «그 줄»에 마커를 붙이고 ⑶ 우측 패널이 «그 줄»을
 *   가리키되 ⑷ ★«고치는 손잡이를 한 개도 안 내놓는가».
 *
 * ★★⑷ 가 이 카드의 «전부»다 — 쓰는 길이 아직 없다(patchCell{lineIndex} 는 cells[r][c].lines
 *   로 가는 정수 하나뿐이라 중첩으로 못 내려간다). 손잡이를 내면 사용자가 슬라이더를 움직이는데
 *   화면이 안 바뀌는 «거짓 성공»이 된다. 현빈 지시: 「보이게만 — 고치는 손잡이는 일부러 안 낸다」.
 *
 * ★바일아웃은 «안 하는 일»이라 그물이 없으면 다음 사람이 조용히 되돌린다.
 *   그래서 소비자 넷을 «각각» 잠그고, 넷 다 ★양성대조(그 한 줄을 떼면 빨개지는가)를 세웠다:
 *   ⛔여기 «넷»은 아래 열거한 «바일아웃 자리»의 수다 — grid-block.js 의 `[data-line]` 소비자
 *     명부(★아홉)와 «다른 수»다. 옛 수를 훑을 때 이 넷을 같이 고치지 마라.
 *     editor.js deleteSelectedFromCanvas(⌫)  → B1 · B1-양성
 *     overlay-handles.js _gridImgFindEl        → B2 (소스 단언)
 *     overlay-handles.js _gridImgActiveImageLine → B2 (소스 단언)
 *     prop-grid.js _grdResolveAnyAddr / _grdResolveAddr → A3 · A3-양성(안내문·손잡이 둘 다)
 *
 * ⚠️★이 그물이 «못» 닿는 곳(정직하게) — 진짜 마우스 이벤트다. `_gridAddrAt` 은 block-drag.js
 *   안의 내부 함수라 소스를 떠서 «그 함수 자체»를 돌린다(grid-line-delete.dom.spec.js 의
 *   deleteSelectedFromCanvas 선례와 «같은 수법»). 즉 재는 것은 「그 술어가 중첩 안 줄을 집는가」
 *   이고, 「캔버스 mousedown 리스너가 그 술어를 정말 부르는가」는 ★앱 실기의 몫이다
 *   (현빈 앱 9376 무접촉이라 이번 판에선 못 밟았다). 그 한 칸이 이 카드의 사각지대다.
 *
 * ⛔앱을 «안» 띄운다. 실행: npx playwright test --config=tests/dom/playwright.dom.config.js grid-nested-line-select
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };
const EDITOR_SRC = fs.readFileSync(path.join(REPO, 'js/editor.js'), 'utf8');
const DRAG_SRC = fs.readFileSync(path.join(REPO, 'js/block-drag.js'), 'utf8');
const OVERLAY_SRC = fs.readFileSync(path.join(REPO, 'js/overlay-handles.js'), 'utf8');

/** 함수 «전체»를 중괄호 균형으로 떠낸다. grid-line-delete.dom.spec.js 와 «같은 부품». */
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
const DEL_SRC = extractFn(EDITOR_SRC, 'deleteSelectedFromCanvas');
const ADDR_AT_SRC = extractFn(DRAG_SRC, '_gridAddrAt');

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-layout.css">
<link rel="stylesheet" href="/css/editor-canvas.css">
<link rel="stylesheet" href="/css/editor-panels.css">
<link rel="stylesheet" href="/css/editor-props.css">
<link rel="stylesheet" href="/css/color-picker.css">
<link rel="stylesheet" href="/css/editor-blocks.css"></head><body>
<div id="canvas"><div class="section-block"><div class="section-inner" id="host"></div></div></div>
<div id="panel-right"><div class="panel-body"></div></div>
<script src="/js/design-system.js"></script>
<script src="/js/io/section-serialize.js"></script>
<script type="module">
  import { makeGridBlock, renderGridBlock, updateGridBlock, getGridModel } from '/js/blocks/grid-block.js';
  import { showGridProperties, grdSetActiveLine, grdGetActiveLine } from '/js/props/prop-grid.js';
  window.__mk = makeGridBlock;
  window.__render = renderGridBlock;
  window.__update = updateGridBlock;
  window.__model = getGridModel;
  window.__open = showGridProperties;
  window.__setActive = grdSetActiveLine;
  window.__getActive = grdGetActiveLine;
  window.__ready = true;
</script></body></html>`;

/** ★양성대조용: 서빙하는 «소스»를 갈아친다.
 *  @param {{path:string, from:string, to:string}|Array} [mutate] — 여럿이면 순서대로 먹인다.
 *  ⛔닻을 못 찾으면 «조용히 원본»을 주지 않는다 — 그러면 양성대조가 초록으로 거짓 통과한다. */
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

/* 칸(0,0) = 글자 줄 하나 ＋ 중첩 duo 하나(2열 · 안쪽 줄 2+1 = ★3).
   ⇒ 바깥 줄 2개(data-line 2) · 중첩 안 줄 3개(data-npath 3). */
const FIXTURE = {
  cols: [
    { width: 1, lines: [
      { type: 'body', text: 'TOPLINE' },
      { type: 'duo', cols: [
        { width: 1, lines: [{ type: 'body', text: 'IN-A' }, { type: 'body', text: 'IN-B' }] },
        { width: 1, lines: [{ type: 'body', text: 'IN-C' }] },
      ] },
    ] },
    { width: 1, lines: [{ type: 'body', text: '내용을 입력하세요.' }] },
  ],
};

async function mount(page) {
  await page.evaluate((fx) => {
    const { row, block } = window.__mk(fx);
    document.getElementById('host').appendChild(row);
    block.classList.add('selected');
    window.__block = block;
  }, FIXTURE);
}

/** 패널 안의 «고치는 손잡이» 수 — input/select/textarea/button/슬라이더. */
const HANDLE_SEL = 'input, select, textarea, button, [role="slider"], .prop-slider';

/* ═══ A — 「잡힌다 · 가리킨다 · ⛔안 고쳐진다」 ═══════════════════════════ */

test('A0 ★양성대조(먼저) — 커밋 ① 의 주소가 «실제로» DOM 에 3개 있다', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  /* ⛔블록 «전체»로 세지 않는다 — 칸(0,1)에도 줄이 하나 있어서 data-line 은 3이 된다.
     내가 첫 판에서 그렇게 세고 「2가 아니다」로 빨간 줄을 하나 만들었다(재는 양이 틀렸던 것).
     ⇒ 분모를 «칸(0,0)» 으로 좁히고, 블록 전체 수도 같이 적어 둔다(둘은 다른 양이다). */
  const n = await page.evaluate(() => {
    const cell = window.__block.querySelector('.grd-cell[data-r="0"][data-c="0"]');
    return {
      nested: cell.querySelectorAll('[data-npath]').length,
      outer: cell.querySelectorAll('[data-line]').length,
      blockOuter: window.__block.querySelectorAll('[data-line]').length,
      texts: [...cell.querySelectorAll('[data-npath]')].map(e => e.textContent.trim()),
    };
  });
  expect(n.nested, '★중첩 안 줄의 주소가 3개가 아니다 — 아래 전부가 «다른 것»을 재게 된다').toBe(3);
  expect(n.outer, '★칸(0,0)의 data-line 수가 2가 아니다 — 중첩이 그 이름을 쓰기 시작했다').toBe(2);
  expect(n.blockOuter, '★블록 전체 data-line 수가 3이 아니다(칸 0,0 의 2 ＋ 칸 0,1 의 1)').toBe(3);
  expect(n.texts, '★주소가 엉뚱한 줄에 붙었다').toEqual(['IN-A', 'IN-B', 'IN-C']);
  expect(errs).toEqual([]);
});

test('A1 ★클릭 판정(_gridAddrAt)이 «중첩 안 줄»을 집는다 — 바깥 중첩 셸이 아니라', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  const got = await page.evaluate((src) => {
    const fn = new Function(`${src}; return _gridAddrAt;`)();
    const el = [...window.__block.querySelectorAll('[data-npath]')].find(e => e.textContent.trim() === 'IN-B');
    return { addr: fn(el, window.__block), outer: fn(window.__block.querySelector('[data-line]'), window.__block) };
  }, ADDR_AT_SRC);
  expect(got.addr, '★중첩 안 줄을 눌렀는데 주소를 못 냈다').toEqual({ r: 0, c: 0, li: 1, np: '0.1' });
  // ⛔바깥 줄 판정은 «한 글자도» 안 바뀌어야 한다 — np 가 붙으면 기존 소비자 전부가 흔들린다.
  expect(got.outer, '★바깥 줄의 주소 꼴이 바뀌었다 — 기존 소비자 아홉(grid-block.js _gridNestAddr 위 명부)이 이 꼴을 전제한다')
    .toEqual({ r: 0, c: 0, li: 0 });
  expect(errs).toEqual([]);
});

test('A2 ★캔버스 마커가 «그 중첩 안 줄»에 붙는다(바깥 셸이 아니라)', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  await page.evaluate(() => window.__open(window.__block, { r: 0, c: 0, li: 1, np: '1.0' }));
  const mark = await page.evaluate(() => {
    const els = [...document.querySelectorAll('.grd-line-selected')];
    return { n: els.length, npath: els[0] ? els[0].dataset.npath : null, text: els[0] ? els[0].textContent.trim() : null };
  });
  expect(mark.n, '★마커가 정확히 하나가 아니다').toBe(1);
  expect(mark.npath, '★마커가 중첩 안 줄이 아닌 데 붙었다').toBe('1.0');
  expect(mark.text, '★마커가 엉뚱한 줄에 붙었다').toBe('IN-C');
  expect(errs).toEqual([]);
});

test('A3 ★★패널이 «그 줄»을 가리키되 «고치는 손잡이»는 «한 개도 안 는다»', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);

  /* ★★재는 양을 바로잡는다 — 「패널의 손잡이 수」가 «아니다».
     이 패널엔 줄과 무관한 블록 단위 손잡이가 언제나 있다(칸 수 피커·비율·행 높이·간격·정렬 …
     첫 판에서 그걸 세고 「12개 나왔다」로 빨개졌다 — 그건 결함이 아니라 내가 틀린 저울이었다).
     ⇒ ★기준은 «줄 선택 없음»(addr=null)이다. 「중첩을 골랐을 때 «그 상태보다 손잡이가
       한 개라도 느는가»」가 진짜 물음이다. 늘면 그게 전부 헛도는 손잡이다. */
  const measure = (addr) => page.evaluate(({ a, sel }) => {
    window.__open(window.__block, a);
    const hintEl = document.getElementById('grd-nest-hint');
    return {
      handles: document.querySelectorAll(`#panel-right ${sel}`).length,
      delBtn: !!document.getElementById('grd-line-del-btn'),
      lineSection: !!document.getElementById('grd-line-body'),
      hint: !!hintEl,
      hintText: hintEl ? hintEl.textContent.replace(/\s+/g, ' ').trim() : '',
      usesLabel: !!(hintEl && hintEl.querySelector('.prop-label')),
      hintClipped: hintEl ? [...hintEl.querySelectorAll('.prop-hint')]
        .some(e => e.scrollWidth > e.clientWidth + 1) : null,
      height: document.getElementById('panel-right').scrollHeight,
    };
  }, { a: addr, sel: HANDLE_SEL });

  const none   = await measure(null);                              // 줄 선택 없음 = 바닥값
  const outer  = await measure({ r: 0, c: 0, li: 0 });             // 바깥 줄 = 대조군
  const nested = await measure({ r: 0, c: 0, li: 1, np: '0.0' });  // 본론

  // ⑴ ★양성대조 — 「줄 절이 손잡이를 «더하기는» 하는가」. 안 더하면 아래 등호는 헛것이다.
  expect(outer.handles - none.handles,
    '★바깥 줄을 골라도 손잡이가 안 는다 — 이 저울은 «줄 절»을 못 재고 있다').toBeGreaterThan(0);
  expect(outer.delBtn, '★바깥 줄에서 「줄 삭제」가 안 떴다 — 대조군이 안 선다').toBe(true);
  expect(none.hint, '★줄 선택이 없는데 중첩 안내문이 떴다').toBe(false);
  expect(outer.hint, '★바깥 줄인데 중첩 안내문이 떴다').toBe(false);

  /* ⑵ ★★본론이 «뒤집혔다» (T-220, 2026-09-27)
     ~~[폐기] 「중첩은 바닥값과 «같아야» 한다 — 한 개라도 늘면 전부 헛도는 손잡이다」~~
     ⇒ ★**쓰는 길이 났다**(patchCell{lineIndex, np} ＋ gridPreviewLine 6번째 인자).
       그래서 이제 손잡이가 «나야» 한다. 안 나면 현빈이 만든 중첩 줄을 못 고친다.
     ★그런데 «나기만» 하면 옛 결함(헛돎)이 그대로다 — 그래서 ⑶에서 «실제로 고쳐지는가»를 잰다.
       ⛔둘 중 하나만 두지 마라: 손잡이 수만 재면 「났는데 안 먹는다」를 못 잡고,
         고쳐지는 것만 재면 「API 로는 되는데 손이 닿을 데가 없다」를 못 잡는다. */
  expect(nested.handles - none.handles,
    '★중첩 안 줄에 손잡이가 «하나도» 안 난다 — 쓰는 길이 났는데 손이 닿을 데가 없다(T-220)')
    .toBeGreaterThan(0);
  /* ⛔「줄 꾸미기」 절(#grd-line-body)은 «아직» 안 난다 — 그 절은 `_grdResolveAnyAddr` 에 걸려 있고,
       그 리졸버의 np 바일아웃은 ⌫·코너핸들 등 «여섯 소비자»가 같이 쓴다(그 함수 머리말).
     ⇒ T-220 이 연 것은 «글자 꾸미기»(Typography) 한 길이다 — 카드가 현빈께 청한 걸음이
       「그 줄의 글씨 크기나 정렬을 바꿔 보십니다」이기 때문이다.
     ★나머지 다섯 소비자를 같이 여는 것은 «다른 카드»다. 여기서 그 사실을 못박아,
       다음 사람이 「왜 어떤 절은 나고 어떤 절은 안 나나」를 다시 캐지 않게 한다. */
  expect(nested.lineSection, '★「줄 꾸미기」 절이 났다 — 그 길(_grdResolveAnyAddr)은 아직 안 열었다').toBe(false);
  /* ⛔「줄 삭제」는 «아직» 길이 없다 — 지우는 쪽은 `lines` 배열을 통째로 갈아치우는 경로라
       li(=품은 중첩 줄의 자리)가 그대로 흘러 «그 중첩이 통째로» 지워진다.
     ⇒ 고치는 길만 냈다. 이 단언이 「지우기도 됐다」로 바뀌려면 «그 길»부터 나야 한다. */
  expect(nested.delBtn, '★「줄 삭제」가 나왔다 — 누르면 «품은 중첩 줄»이 통째로 지워진다(그 길은 아직 없다)').toBe(false);

  /* ⑶ ★★핵심 — 난 손잡이가 «실제로 그 줄»을 고치는가. ⛔이게 없으면 ⑵는 「헛도는 손잡이가
       늘었다」와 구별이 안 된다. 그것이 옛 A3 가 막으려던 바로 그 결함이다.
     ★패널 위젯을 «사람처럼» 움직인다 — 글자 크기 칸에 값을 넣고 change 를 쏜다. */
  const edited = await page.evaluate(() => {
    window.__open(window.__block, { r: 0, c: 0, li: 1, np: '0.0' });
    const el = document.getElementById('grd-typo-size-number');
    if (!el) return { ok: false, why: '#grd-typo-size-number 가 없다' };
    el.value = '37';
    el.dispatchEvent(new Event('change', { bubbles: true }));
    const m = window.__model(window.__block);
    const nestedLine = m.cells?.[0]?.[0]?.lines?.[1]?.cols?.[0]?.lines?.[0];
    const sibling    = m.cells?.[0]?.[0]?.lines?.[1]?.cols?.[1]?.lines?.[0];
    const outerLine  = m.cells?.[0]?.[0]?.lines?.[0];
    return { ok: true, nested: nestedLine, sibling, outer: outerLine };
  });
  expect(edited.ok, `★글자 크기 칸을 못 찾았다: ${edited.why || ''}`).toBe(true);
  expect(edited.nested && edited.nested.fontSize,
    '★손잡이를 움직였는데 «그 줄»이 안 바뀐다 — 손잡이만 나고 길이 안 닿는다(헛돎)').toBe(37);
  expect(edited.sibling && edited.sibling.fontSize,
    '★옆 «열»까지 바뀌었다 — 주소가 열을 안 가른다').toBeUndefined();
  expect(edited.outer && edited.outer.fontSize,
    '★바깥 줄까지 바뀌었다 — np 를 안 보고 li 로만 쓰고 있다').toBeUndefined();

  // ⑶ ★그런데 «말은» 해야 한다 — 잡혔다는 것과 아직 못 고친다는 것.
  expect(nested.hint, '★중첩 안 줄을 골랐는데 패널이 «아무 말도» 안 한다').toBe(true);
  expect(nested.hintText, '★안내문이 「이 줄입니다」를 안 말한다').toContain('이 줄입니다');
  expect(nested.hintText, '★안내문이 「아직 못 고친다」를 안 말한다 — 그 말이 이 갈래의 전부다').toContain('고치는');
  expect(nested.hintText, '★안내문이 주소를 안 보여 준다').toContain('0.0');
  expect(nested.usesLabel, '★안내문을 .prop-label 에 실었다 — 56px 고정이라 잘린다(전례 있음)').toBe(false);
  expect(nested.hintClipped, '★안내문이 가로로 잘린다 — 읽히지 않으면 없는 것과 같다').toBe(false);

  /* ⑷ ~~[폐기 · 2026-09-27 T-220] 「세로 예산 — 안내문 세 줄이 «줄 절»보다 짧아야 한다
       (손잡이를 다 뺐으므로)」~~
     ⇒ ★그 단언은 「손잡이를 뺐다」의 «방증»이었다. 이제 손잡이가 «나므로» 당연히 길어진다.
       ⛔방증은 본론이 없을 때만 값이 있다 — 지금은 ⑵(손잡이가 난다)와 ⑶(실제로 고쳐진다)이
         그 사실을 «직접» 재므로 이 대리 지표는 지운다.
       ★수(730/773)를 조건으로 남겨 두면 안내문 한 줄만 늘어도 빨개지는 «늙는 자»가 된다. */
  console.log(`[세로 예산·기록] 선택없음 ${none.height} · 바깥 줄 ${outer.height} · 중첩 줄 ${nested.height}`);
  expect(errs).toEqual([]);
});

test('A3-양성 ★안내문을 지우면 A3 가 «빨개진다»', async ({ page }) => {
  const errs = await boot(page, {
    path: '/js/props/prop-grid.js',
    from: 'function _grdNestHintHtml(nestHit) {',
    to: 'function _grdNestHintHtml(nestHit) { return \'\';',
  });
  await mount(page);
  await page.evaluate(() => window.__open(window.__block, { r: 0, c: 0, li: 1, np: '0.0' }));
  const hint = await page.evaluate(() => !!document.getElementById('grd-nest-hint'));
  expect(hint, '★안내문을 떼었는데도 떴다 — 이 양성대조는 «안 재고» 있다').toBe(false);
  expect(errs, '★변이 닻을 못 찾았다(MUTATION_ANCHOR_MISSING)').toEqual([]);
});

/* ★★문이 «둘»이다 — 첫 판에서 이걸 몰라 양성대조 하나가 «아무것도 안 재고» 초록이었다.
 *   ⑴ showGridProperties 의 `_nestHit ? null : …`  — 패널을 «안 짓는» 문
 *   ⑵ _grdResolveAnyAddr 의 `if (addr.np) return null` — 주소를 «안 푸는» 문
 *   ⑴만 떼도 ⑵ 가 잡으므로 손잡이는 여전히 0개다(그게 아래 A3-양성2a 가 재는 것).
 *   ⇒ 「그 한 줄이 정말 일하는가」는 ⑵ 까지 떼 봐야 보인다(A3-양성2b).
 *   ★둘 다 남겨 둔다 — ⑵ 는 패널 말고도 줄바·칸·이미지·줄 절의 wire 넷과 T/G/K 단축키가
 *     «따로» 들어오는 문이다(B3 가 그 길을 잰다). 겹쳐 막은 것이지 죽은 규칙이 아니다. */
const GATE_PANEL = {
  path: '/js/props/prop-grid.js',
  from: '  const _anyHit = _nestHit ? null : _grdResolveAnyAddr(block, _addrIn);',
  to:   '  const _anyHit = _grdResolveAnyAddr(block, _addrIn);',
};
const GATE_RESOLVER = {
  path: '/js/props/prop-grid.js',
  from: '  if (addr.np) return null;\n  const r = Number(addr.r), c = Number(addr.c);',
  to:   '  const r = Number(addr.r), c = Number(addr.c);',
};

/** 「줄 선택 없음」 대비 손잡이가 몇 개 늘었나 — A3 와 «같은 저울». */
const grewHandles = (page) => page.evaluate((sel) => {
  const count = () => document.querySelectorAll(`#panel-right ${sel}`).length;
  window.__open(window.__block, null);
  const none = count();
  window.__open(window.__block, { r: 0, c: 0, li: 1, np: '0.0' });
  return count() - none;
}, HANDLE_SEL);

/* ~~[폐기 · 2026-09-27 T-220] A3-양성2a 「패널 문만 떼면 — 리졸버 문이 «혼자서» 막는다」
     ＋ A3-양성2b 「두 문을 «다» 떼면 손잡이가 되살아난다」~~
   ⇒ ★그 둘은 「문이 «겹쳐» 막는다」를 증명하던 짝이다. T-220 이 **리졸버 문(`_grdResolveAddr`)을
     열었으므로** 「겹쳐 막는다」 자체가 더는 참이 아니다.
   ★대신 «반대 방향»을 잠근다 — 아래 A3-양성2 가 「연 그 자리를 도로 막으면 손잡이가 사라지는가」를
     잰다. ⛔방향만 뒤집은 것이 아니다: 옛 짝은 «두 문»을 재야 했고, 지금은 «한 문»이 정본이라
     닻도 하나다. 닻이 둘이던 까닭(한쪽만 떼도 증상이 안 바뀐다)이 사라졌다. */

/** 2026-09-27 이후의 정본 닻 — 리졸버가 중첩을 «받는» 그 분기. */
const GATE_RESOLVER_NOW = {
  path: '/js/props/prop-grid.js',
  from: '  if (addr.np) {\n    const hit = _grdResolveNestAddr(block, addr);',
  to:   '  if (addr.np) {\n    return null;\n    // eslint-disable-next-line no-unreachable\n    const hit = _grdResolveNestAddr(block, addr);',
};

test('A3-양성2 ★연 문을 도로 «막으면» 고치는 손잡이가 사라진다', async ({ page }) => {
  /* ⛔「고쳤더니 초록」은 판정이 아니다. 내가 «연» 문이라 방향은 «도로 막기»다.
     ★이것이 빨개지면(=막았는데도 손잡이가 난다) A3 의 초록은 «그 문»을 재고 있지 않다는 뜻이다. */
  const errs = await boot(page, GATE_RESOLVER_NOW);
  await mount(page);
  expect(await grewHandles(page),
    '★리졸버 문을 도로 막았는데도 손잡이가 늘었다 — A3 가 재는 것은 «그 문»이 아니다').toBe(0);
  expect(errs, '★변이 닻을 못 찾았다(MUTATION_ANCHOR_MISSING)').toEqual([]);
});

/* ═══ B — 바일아웃 넷을 «각각» 잠근다 ═══════════════════════════════════ */

async function runDelete(page, delSrc = DEL_SRC) {
  return page.evaluate((src) => {
    const calls = { showToast: [] };
    const scope = { clearAssetImage: () => {} };
    window.showToast = (msg) => calls.showToast.push(msg);
    const names = Object.keys(scope);
    const fn = new Function(...names, `${src}; return deleteSelectedFromCanvas;`)(...names.map(n => scope[n]));
    return { consumed: fn(), calls };
  }, delSrc);
}

test('B1 ★중첩 안 줄이 잡힌 채 ⌫ 를 눌러도 «아무 줄도» 안 지워진다(블록도 안전)', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  await page.evaluate(() => window.__setActive(window.__block, { r: 0, c: 0, li: 1, np: '0.0' }));

  const before = await page.evaluate(() => JSON.stringify(window.__model(window.__block).cells[0][0].lines));
  const r = await runDelete(page);

  expect(r.consumed, '★삭제를 «안 먹었다» — 아래 블록 삭제로 새면 블럭이 통째로 사라진다').toBe(true);
  const after = await page.evaluate(() => ({
    lines: JSON.stringify(window.__model(window.__block).cells[0][0].lines),
    alive: document.body.contains(window.__block),
    nested: window.__block.querySelectorAll('[data-npath]').length,
  }));
  expect(after.alive, '★그리드 블록이 통째로 지워졌다 — 바일아웃이 consumed 를 안 세웠다').toBe(true);
  expect(after.lines, '★모델이 바뀌었다 — 중첩 줄이나 그 품은 duo 줄이 지워졌다').toBe(before);
  expect(after.nested, '★중첩 안 줄이 사라졌다').toBe(3);
  expect(r.calls.showToast.length, '★아무 말도 없이 삼켰다 — 사용자는 ⌫ 가 왜 안 먹는지 모른다').toBeGreaterThan(0);
  expect(errs).toEqual([]);
});

test('B1-양성 ★⌫ 바일아웃을 떼면 «품은 duo 줄»이 통째로 지워진다(그래서 그 한 줄이 필요하다)', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  await page.evaluate(() => window.__setActive(window.__block, { r: 0, c: 0, li: 1, np: '0.0' }));

  const ANCHOR = 'if (gridSel && gridAddr && gridAddr.np) {';
  expect(DEL_SRC.includes(ANCHOR), '★변이 닻을 못 찾았다 — 이 양성대조는 «안 재고» 있다').toBe(true);
  // 바일아웃 분기의 조건을 «늘 거짓»으로 만든다 — 분기 몸통은 그대로 둔다(문법 안전).
  const mutated = DEL_SRC.replace(ANCHOR, 'if (false) {');
  const r = await runDelete(page, mutated);

  expect(r.consumed).toBe(true);
  const after = await page.evaluate(() => ({
    lines: window.__model(window.__block).cells[0][0].lines.length,
    nested: window.__block.querySelectorAll('[data-npath]').length,
  }));
  expect(after.lines, '★바일아웃을 떼었는데도 줄이 그대로다 — 이 양성대조는 «안 재고» 있다').toBe(1);
  expect(after.nested, '★중첩 그리드가 통째로 사라지는 것이 «막으려던 그 일»이다').toBe(0);
  expect(errs).toEqual([]);
});

test('B2 ★이미지 코너 핸들의 두 문이 중첩 주소를 «명시적으로» 물린다(소스 단언)', () => {
  /* ⛔이 둘은 「아무것도 안 한다」가 답이라 화면에서 «차이»로 못 잰다(핸들이 원래도 안 뜬다).
     ⇒ 「그 판정이 소스에 실제로 있는가」를 잰다. ★이름으로 0건을 세지 않는다 — 함수가
       거기 있는지부터 확인한 뒤 그 «몸통 안»을 본다. */
  for (const name of ['_gridImgFindEl', '_gridImgActiveImageLine']) {
    const body = extractFn(OVERLAY_SRC, name);   // 없으면 여기서 throw 한다
    expect(body.includes('addr.np'),
      `★${name} 에 중첩 주소 바일아웃이 없다 — addr.li(=품은 duo 줄)로 조회해 «딴 그림»에 핸들이 앉는다`).toBe(true);
  }
});

test('B3 ★T/G/K 단축키도 중첩 주소에선 «그리드를 건드리지 않는다»', async ({ page }) => {
  /* grdAddLineToSelectedCell 은 _grdResolveAnyAddr 로 주소를 푼다 ⇒ np 바일아웃에 같이 걸린다.
     false 를 돌려주면 호출부가 «기존 전역 동작»(텍스트/갭 블록 추가)으로 흘려보낸다 — 오늘
     「줄 선택 없음」과 같은 길이다. ★여기서 재는 것은 「그리드가 안 바뀐다」 하나다. */
  const errs = await boot(page);
  await mount(page);
  await page.evaluate(() => window.__setActive(window.__block, { r: 0, c: 0, li: 1, np: '0.0' }));
  const before = await page.evaluate(() => JSON.stringify(window.__model(window.__block).cells[0][0].lines));
  const ret = await page.evaluate(() => window.grdAddLineToSelectedCell?.('body'));
  const after = await page.evaluate(() => JSON.stringify(window.__model(window.__block).cells[0][0].lines));
  expect(ret, '★중첩 주소인데 그리드가 단축키를 «먹었다» — 어느 줄 뒤에 넣을지 정할 길이 없다').toBe(false);
  expect(after, '★그리드 모델이 바뀌었다').toBe(before);
  expect(errs).toEqual([]);
});

test('B3-양성 ★리졸버 문을 떼면 T/G/K 가 «품은 duo 줄» 뒤에 줄을 끼워 넣는다', async ({ page }) => {
  /* ★이 자가 GATE_RESOLVER 의 «제 일»을 보여 준다 — 패널 문(A3-양성2a)과 달리 이 길은
     _grdResolveAnyAddr «하나»로만 막힌다. 떼면 hit.li(=품은 duo 줄) 뒤에 새 줄이 생긴다:
     사용자가 «중첩 안 줄»을 고르고 T 를 눌렀는데 줄이 엉뚱한 «바깥» 자리에 생기는 꼴. */
  const errs = await boot(page, GATE_RESOLVER);
  await mount(page);
  await page.evaluate(() => window.__setActive(window.__block, { r: 0, c: 0, li: 1, np: '0.0' }));
  const before = await page.evaluate(() => window.__model(window.__block).cells[0][0].lines.length);
  const ret = await page.evaluate(() => window.grdAddLineToSelectedCell?.('body'));
  const after = await page.evaluate(() => window.__model(window.__block).cells[0][0].lines.length);
  expect(ret, '★문을 떼었는데도 단축키가 안 먹었다 — 이 양성대조는 «안 재고» 있다').toBe(true);
  expect(after - before, '★문을 떼었는데도 줄이 안 늘었다 — 막고 있던 것이 이 문이 아니다').toBe(1);
  expect(errs, '★변이 닻을 못 찾았다(MUTATION_ANCHOR_MISSING)').toEqual([]);
});

/* ═══ C — 바깥 길이 «한 글자도» 안 흔들렸나(대조) ═══════════════════════ */

test('C1 ★바깥 줄 선택은 예전 그대로다 — 마커·손잡이·삭제 전부', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  await page.evaluate(() => window.__open(window.__block, { r: 0, c: 0, li: 0 }));
  const st = await page.evaluate(() => {
    const el = document.querySelector('.grd-line-selected');
    return {
      markNpath: el ? (el.dataset.npath ?? null) : 'NO-MARK',
      markLine: el ? el.dataset.line : null,
      delBtn: !!document.getElementById('grd-line-del-btn'),
      hint: !!document.getElementById('grd-nest-hint'),
    };
  });
  expect(st.markNpath, '★바깥 줄 마커가 중첩 요소에 붙었다').toBeNull();
  expect(st.markLine, '★바깥 줄 마커가 엉뚱한 줄에 붙었다').toBe('0');
  expect(st.delBtn, '★바깥 줄의 「줄 삭제」가 사라졌다 — 중첩 작업이 기존 길을 깨뜨렸다').toBe(true);
  expect(st.hint, '★바깥 줄인데 중첩 안내문이 떴다').toBe(false);

  await page.evaluate(() => window.__setActive(window.__block, { r: 0, c: 0, li: 0 }));
  const r = await runDelete(page);
  expect(r.consumed).toBe(true);
  const n = await page.evaluate(() => window.__model(window.__block).cells[0][0].lines.length);
  expect(n, '★바깥 줄 ⌫ 삭제가 안 먹는다 — 중첩 바일아웃이 너무 넓게 물었다').toBe(1);
  expect(errs).toEqual([]);
});
