/* grid-nested-create.dom.spec.js — 「칸 «안»을 열로 나누는 줄을 ★사람 손으로 만들 수 있는가」
 * (T-221 · 2026-09-27 · 현빈 물음 「그리드 블럭에서 중첩이 가능하니? ★내가 만들려면 어떻게?」)
 *
 * ★이 카드가 선 까닭 — 「그리는 자리」는 있고 「짓는 자리」가 «0건» 이었다.
 *   렌더러에는 GRID_NESTED_LINE_TYPE 분기가 있어 화면에 나오는데, 제품 코드에 그 줄을 «스스로
 *   만드는» 자리가 한 군데도 없었다. 그래서 지디가 API 로 꽂아야만 생겼고, 현빈은 직접 만드실
 *   수가 없었다. ⇒ ★「만들 수 없는 것을 고치는 손잡이는 쓸 자리가 없다」(0926 순서 결정).
 *
 * ★재는 양 — 「소스에 글자가 있나」가 아니라 «손잡이를 실제로 눌러 모델·화면이 바뀌는가».
 *   ⛔소스 grep 으로 갈음하지 마라: 항목이 있어도 배선이 없으면 「눌렀는데 아무 일도 안 난다」가
 *     되고, 그건 이 레포의 고질(헛돎)이다.
 *
 * ⛔★손잡이가 «우클릭 메뉴»에 있는 까닭 — 처음엔 우측 패널 「+ 줄 추가」 select 에 넣었고 되돌렸다.
 *   검사 둘이 막았다(tests/dom/grid-cell-panel-handles.dom.spec.js):
 *     E12 「추가」와 「종류 바꾸기」 명부가 «같아야» 한다 ⇒ 추가에만 넣으면 깨지고,
 *         바꾸기에도 넣으면 글이 있는 줄을 중첩으로 바꿀 때 그 글이 사라진다.
 *     E13 «페이로드 없이 고르면 줄이 사라지는» 종류가 목록에 없어야 한다 ⇒ 중첩은 cols 가 없으면
 *         렌더러가 `return ''` 한다. ★E13 머리말이 「종류 목록이 늘어나는 그 패치에서 문다」라고
 *         «미리» 적어 두었고, 정확히 그 패치에서 물었다.
 *   ⇒ ★검사를 고치는 대신 «손잡이를 옮겼다». 우클릭은 「이미지 추가」가 이미 쓰는 길이다.
 *
 * ★모수를 먼저 세운다 — N1 이 「그 옵션이 실재하는가」를 단언한다. ⛔안 그러면 옵션이 사라져도
 *   「아무것도 못 골랐으니 아무것도 안 깨졌다」로 조용히 초록이 난다.
 *
 * ⛔앱을 «안» 띄운다 — 레포 파일만 크로미움에 얹는다(고디터 인스턴스·MCP 9345 대역 무접촉).
 *   하네스 골격은 tests/dom/grid-panel-icon-spec.dom.spec.js 를 그대로 베꼈다.
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js grid-nested-create
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

/** 중첩 줄의 «정본 이름» — 소스에서 뜬다. ⛔검사 안에 'duo' 를 손으로 베끼지 마라:
 *  그 글자는 grid-rename-residue S1 이 「데이터 토큰으로만 남긴다」로 잠가 둔 것이고,
 *  여기 박아 두면 이름이 바뀌는 날 이 검사가 «조용히» 아무것도 안 재게 된다. */
const SRC_GRID = fs.readFileSync(path.join(REPO, 'js/blocks/grid-block.js'), 'utf8');
const NESTED_TYPE = (SRC_GRID.match(/const GRID_NESTED_LINE_TYPE = '([^']+)'/) || [])[1] || null;

/** 우클릭 메뉴 항목의 «실물 마크업» — index.html 에서 뜬다(검사 안에 베끼지 않는다). */
const SRC_HTML = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
const MENU_ITEM_HTML = (SRC_HTML.match(/<div class="bcm-item" id="bcm-grid-nested"[\s\S]*?<\/div>\s*\n/) || [])[0] || null;

/** 그 항목의 «클릭 배선» — block-factory.js 에서 통째로 뜬다.
 *  ★block-factory.js 는 통째로 로드하면 import 그래프가 다 딸려 온다(캔버스·드래그·프레임…).
 *    그래서 «이 한 배선»만 떠서 하네스에서 돌린다 — grid-panel-icon-spec 이 쓰는 것과 같은 수법. */
const WIRE_SRC = (fs.readFileSync(path.join(REPO, 'js/block-factory.js'), 'utf8')
  .match(/document\.getElementById\('bcm-grid-nested'\)\?\.addEventListener\('click',[\s\S]*?\n  \}\);/) || [])[0] || null;

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
<div id="block-context-menu" style="display:none;"></div>
<script src="/js/design-system.js"></script>
<script src="/js/io/section-serialize.js"></script>
<script type="module">
  import { makeGridBlock, getGridModel, updateGridBlock, renderGridBlock } from '/js/blocks/grid-block.js';
  import { showGridProperties } from '/js/props/prop-grid.js';
  window.__mk = makeGridBlock; window.__model = getGridModel;
  window.__upd = updateGridBlock; window.__render = renderGridBlock;
  window.__open = showGridProperties;
  window.pushHistory = () => {}; window.buildLayerPanel = () => {}; window.triggerAutoSave = () => {};
  window.__toasts = []; window.showToast = (m) => window.__toasts.push(m);
  window.__ready = true;
</script></body></html>`;

const FIXTURE = {
  cols: [{ width: 1, lines: [] }, { width: 1, lines: [] }],
  rows: [{ height: 'auto' }],
  cells: [[{ lines: [{ type: 'body', text: 'A0' }] }, { lines: [{ type: 'body', text: 'B0' }] }]],
};
const ADDR = { r: 0, c: 0, li: 0 };

/** @param {(src:string, pathname:string)=>string} [mutate] 양성대조 전용 — 서빙 직전 한 군데만 비튼다. */
async function boot(page, mutate) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    const body = fs.readFileSync(file);
    const ct = MIME[path.extname(file)] || 'text/plain';
    if (mutate) return route.fulfill({ contentType: ct, body: mutate(body.toString('utf8'), url.pathname) });
    return route.fulfill({ contentType: ct, body });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 });
  await page.evaluate((t) => { window.__NESTED_TYPE = t; }, NESTED_TYPE);
  return errs;
}

/** 블록을 하나 띄우고 «그 칸» 패널을 연다. */
async function mount(page, addr) {
  await page.evaluate(({ fixture, addr }) => {
    const HOST = document.getElementById('host');
    const PANEL = document.querySelector('#panel-right .panel-body');
    HOST.innerHTML = ''; PANEL.innerHTML = '';
    const { row, block } = window.__mk(JSON.parse(JSON.stringify(fixture)));
    HOST.appendChild(row);
    block.classList.add('selected');
    window.__block = block;
    window.__open(block, addr);
  }, { fixture: FIXTURE, addr });
}

/** 우클릭 메뉴 항목을 «심고» 그 배선을 걸어, 사람처럼 «누른다».
 *  ★block-factory.js 를 통째로 로드하지 않는다 — import 그래프(캔버스·드래그·프레임…)가 다 딸려 온다.
 *    대신 «그 한 배선»만 소스에서 떠서 같은 이름의 스코프를 주고 돌린다
 *    (tests/dom/grid-cell-emptied.dom.spec.js 의 ⌫ 검사가 쓰던 수법 그대로). */
const clickNestedMenu = (page, addr) => page.evaluate(({ itemHtml, wireSrc, addr }) => {
  const menu = document.getElementById('block-context-menu');
  menu.innerHTML = itemHtml;
  /* ⛔배선이 «모듈 스코프»에서 읽는 이름을 «전부» 줘야 한다 — 하나라도 빠지면 ReferenceError 로
     죽고, 겉으로는 「눌렀는데 아무 일도 안 난다」와 구별이 안 된다(2026-09-27 에 실제로 그랬다).
     ★상수는 «검사가 지어내지 않고» 위에서 소스로 떠 온 NESTED_TYPE 을 넘긴다. */
  const scope = {
    _targetBlock: window.__block,
    _targetGridAddr: addr,
    closeMenu: () => { menu.style.display = 'none'; },
    GRID_NESTED_LINE_TYPE: window.__NESTED_TYPE,
  };
  const names = Object.keys(scope);
  new Function(...names, wireSrc)(...names.map(n => scope[n]));
  const item = document.getElementById('bcm-grid-nested');
  if (!item) return { ok: false, why: '#bcm-grid-nested 가 심기지 않았다' };
  item.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  return { ok: true, label: (item.textContent || '').trim() };
}, { itemHtml: MENU_ITEM_HTML, wireSrc: WIRE_SRC, addr });

const survey = (page) => page.evaluate(() => {
  const b = window.__block;
  const lines = (window.__model(b).cells?.[0]?.[0]?.lines) || [];
  return {
    types: lines.map(l => l && l.type),
    last: lines.length ? JSON.parse(JSON.stringify(lines[lines.length - 1])) : null,
    nestedEls: b.querySelectorAll('.grd-nested').length,
    nestedCols: b.querySelectorAll('.grd-nested-col').length,
    toasts: (window.__toasts || []).slice(),
  };
});

test.describe('T-221 — 칸 «안»을 열로 나누는 줄을 «사람 손»으로 만든다', () => {
  test('N0 계측기 — 이름·마크업·배선을 «소스에서» 다 떴다', () => {
    expect(NESTED_TYPE, '★GRID_NESTED_LINE_TYPE 을 grid-block.js 에서 못 떴다').not.toBeNull();
    expect(MENU_ITEM_HTML, '★index.html 에서 #bcm-grid-nested 항목을 못 떴다 — 손잡이가 사라졌거나 모양이 바뀌었다').not.toBeNull();
    expect(WIRE_SRC, '★block-factory.js 에서 그 항목의 click 배선을 못 떴다 — 항목만 있고 배선이 없으면 «헛돎»이다').not.toBeNull();
  });

  test('N1 모수 — 손잡이에 «보이는 글자»가 있다', () => {
    /* ⛔항목이 있어도 글자가 없으면 사용자는 무엇을 누르는지 모른다. 글자 «내용»은 안 잠근다
       (사람이 읽을 이름은 바뀔 수 있다) — «비어 있지 않은가»만 잰다. */
    const text = MENU_ITEM_HTML.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    expect(text.length, '★메뉴 항목에 보이는 글자가 없다').toBeGreaterThan(0);
  });

  test('N2 ★핵심 — 누르면 «실제로» 중첩 줄이 생긴다 (모델 ＋ 화면)', async ({ page }) => {
    const errs = await boot(page);
    await mount(page, ADDR);
    const before = await survey(page);
    expect(before.nestedEls, '★전제 — 시작할 때 중첩이 0개여야 «생겼다»를 잰다').toBe(0);

    const clicked = await clickNestedMenu(page, ADDR);
    expect(clicked.ok, `★손잡이를 못 눌렀다: ${JSON.stringify(clicked)}`).toBe(true);

    const after = await survey(page);
    expect(after.types, '★모델에 중첩 줄이 안 생겼다 — 항목은 있는데 배선이 안 먹는다(헛돎)')
      .toContain(NESTED_TYPE);
    expect(after.nestedEls, '★모델엔 생겼는데 화면에 «안 그려졌다»').toBe(1);
    expect(after.toasts, `★조용히 실패했다(토스트): ${JSON.stringify(after.toasts)}`).toEqual([]);
    expect(errs).toEqual([]);
  });

  test('N3 ★만든 것이 «쓸 수 있는 꼴»이다 — 두 열이 서고, 각 열에 줄이 있다', async ({ page }) => {
    /* ⛔`cols:[]` 로 만들면 렌더러가 `if (!cols.length) return ''` 로 아무것도 안 그린다.
       ⇒ 「눌렀는데 화면이 그대로」가 된다. 그 꼴로 퇴화하지 않는지를 여기서 잠근다. */
    const errs = await boot(page);
    await mount(page, ADDR);
    await clickNestedMenu(page, ADDR);
    const r = await survey(page);
    expect(Array.isArray(r.last && r.last.cols), '★만들어진 줄에 cols 배열이 없다').toBe(true);
    expect(r.last.cols.length, '★열이 둘이 아니다 — 「나란히 두 칸」이라 말해 놓고 다르게 만들었다').toBe(2);
    expect(r.nestedCols, '★화면에 열이 둘로 안 섰다').toBe(2);
    for (const [i, col] of r.last.cols.entries()) {
      expect(Array.isArray(col.lines) && col.lines.length,
        `★열 ${i} 에 줄이 «하나도» 없다 — 빈 열은 눈에 안 보이고 손에도 안 닿는다`).toBeGreaterThan(0);
    }
    expect(errs).toEqual([]);
  });

  test('N4 ★패널 select 에는 «없다» — E12·E13 이 막는 자리다', async ({ page }) => {
    /* ★「+ 줄 추가」와 「종류 바꾸기」는 같은 명부를 읽는다(E12). 거기에 중첩을 넣으면
       ⑴바꾸기에도 떠서 글이 사라지거나 ⑵두 명부가 갈린다. ⇒ 패널에는 «없는» 것이 계약이다.
       ⛔이 단언이 빨개지면 「손잡이를 늘렸다」가 아니라 «그 계약을 깼다»는 뜻이다. */
    const errs = await boot(page);
    await mount(page, ADDR);
    const vals = await page.evaluate(() => {
      const add = document.getElementById('grd-line-add-kind');
      const chg = document.getElementById('grd-line-kind');
      return { add: add ? [...add.options].map(o => o.value) : null,
               chg: chg ? [...chg.options].map(o => o.value) : null };
    });
    expect(vals.add, '★「+ 줄 추가」 select 가 없다 — 이 검사가 아무것도 안 잰다').not.toBeNull();
    expect(vals.add).not.toContain(NESTED_TYPE);
    expect(vals.chg, '★「종류 바꾸기」 select 가 없다 — 픽스처가 글자 줄인가').not.toBeNull();
    expect(vals.chg).not.toContain(NESTED_TYPE);
    expect(errs).toEqual([]);
  });

  test('N5 ★양성대조 — 배선에서 cols 를 «빼면» N2·N3 가 빨개진다', async ({ page }) => {
    /* ⛔「고쳤더니 초록」은 판정이 아니다. 내가 «세운» 것이라 방향은 «망가뜨리기»다.
       ★cols 를 뺀 사본은 렌더러가 `return ''` 하므로 «화면에서 사라져야» 한다.
         그게 안 일어나면 N2·N3 가 재는 것은 cols 가 아니다(자물쇠가 헐렁하다). */
    const errs = await boot(page);
    await mount(page, ADDR);
    const broken = WIRE_SRC.replace(/cols: \[[\s\S]*?\],/, 'cols: [],');
    expect(broken, '★변이가 주입되지 않았다 — 이 대조는 아무것도 안 쟀다').not.toBe(WIRE_SRC);
    const r = await page.evaluate(({ itemHtml, wireSrc, addr }) => {
      const menu = document.getElementById('block-context-menu');
      menu.innerHTML = itemHtml;
        const scope = { _targetBlock: window.__block, _targetGridAddr: addr, closeMenu: () => {},
                      GRID_NESTED_LINE_TYPE: window.__NESTED_TYPE };
      const names = Object.keys(scope);
      new Function(...names, wireSrc)(...names.map(n => scope[n]));
      document.getElementById('bcm-grid-nested').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const b = window.__block;
      const lines = (window.__model(b).cells?.[0]?.[0]?.lines) || [];
      return { hasType: lines.some(l => l && l.type === 'duo' || (l && l.cols)), nestedEls: b.querySelectorAll('.grd-nested').length };
    }, { itemHtml: MENU_ITEM_HTML, wireSrc: broken, addr: ADDR });
    expect(r.nestedEls, '★cols 를 뺐는데도 화면에 중첩이 그려졌다 — 렌더러 가드가 안 물거나 변이가 빗나갔다').toBe(0);
    expect(errs).toEqual([]);
  });
});
