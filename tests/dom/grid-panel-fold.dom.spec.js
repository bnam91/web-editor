/* grid-panel-fold.dom.spec.js — 「Grid (N×M)」 절을 «접는다»(현빈 발주, 2026-09-25 · 시안2).
 * 기준선 ed74f65.
 *
 * ★이 파일이 있어야 하는 까닭 — 이 변경은 패널 높이를 «크게 줄인다». 그런데 이 저장소의
 *   높이 그물(grid-cell-panel-handles G2)은 ⛔「Δ<0 은 «절이 하나 안 뜬» 사고일 수 있다」고
 *   의심하게 설계돼 있다. 그 의심은 옳다 — 그래서 «줄어든 까닭»을 여기서 기계로 댄다.
 *
 *   ★핵심 명제: **「사라진 것」이 아니라 「접힌 것」이다.**
 *     접힘은 DOM 을 지우지 않는다. 몸(#grd-size-body)이 display:none 일 뿐이고
 *     피커 셀 16개·힌트 두 줄·라벨은 «그 자리에 그대로» 있다.
 *   ⇒ F2 가 그것을 «한 창·한 픽스처»에서 접힘/펼침 두 번 재어 «같은 수»임을 보인다.
 *
 * ⚠️★왜 controlN 하나로는 안 되나 (팀리드 물음에 대한 답을 여기 적어 둔다)
 *   G2 의 `controlN` 은 `body.querySelectorAll('input,select,textarea,button').length` 다
 *   — 즉 ★«DOM»을 센다(보이는 것을 세지 않는다). 그래서 접어도 안 줄어드는 것은 맞다.
 *   ⛔그런데 이 절 «안»에는 그 네 태그가 «0개»다. 피커 칸은 전부 `<div>` 고, 힌트도 div 다.
 *   ⇒ controlN 은 이 절에 대해 «처음부터 눈이 없다» — 안 줄어도 그건 증명이 아니라 무관이다.
 *     (controlN 불변은 「다른 절이 같이 안 사라졌다」만 말해 준다. 그것도 F2 가 같이 잰다.)
 *   ★이 절의 증인은 따로 세운다: `#grd-size-body` 안의 «전체 원소 수»와 `.grid-picker-cell` 수.
 *
 * ⛔앱을 «안» 띄운다 — 고디터 인스턴스·MCP 9345 대역 무접촉. 레포 파일만 크로미움에 얹는다.
 *   하네스 골격은 tests/dom/grid-panel-r1r6.dom.spec.js 를 그대로 베꼈다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js grid-panel-fold
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

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
<script>window.openIconifyModal = (cb) => cb({ svg: '<svg xmlns="http://www.w3.org/2000/svg"/>', size: 64 });</script>
<script type="module">
  import { makeGridBlock, getGridModel } from '/js/blocks/grid-block.js';
  import { showGridProperties } from '/js/props/prop-grid.js';
  window.__mk = makeGridBlock; window.__model = getGridModel; window.__open = showGridProperties;
  window.__ready = true;
</script></body></html>`;

function installMount(page) {
  return page.addInitScript(() => {
    window.__mount = (fx, addr) => {
      const HOST = document.getElementById('host');
      HOST.innerHTML = ''; document.querySelector('#panel-right .panel-body').innerHTML = '';
      const { row, block } = window.__mk(JSON.parse(JSON.stringify(fx)));
      HOST.appendChild(row); block.classList.add('selected');
      window.__b = block; window.__open(block, addr);
      return block;
    };
    /* 「접힘 절」의 상태를 한 번에 긁는 자. ⛔«보이는 것»과 «DOM 에 있는 것»을 따로 적는다 —
       이 파일의 명제가 정확히 그 둘의 «차이»다. */
    window.__foldProbe = () => {
      const body = document.querySelector('#panel-right .panel-body');
      const head = document.getElementById('grd-size-toggle');
      const sec  = head ? head.closest('.prop-section') : null;
      const sbody = document.getElementById('grd-size-body');
      const picker = document.getElementById('grd-grid-picker');
      const label = document.getElementById('grd-grid-picker-label');
      const cells = picker ? [...picker.querySelectorAll('.grid-picker-cell')] : [];
      return {
        headText: head ? head.textContent.trim() : null,
        headVisible: !!(head && head.getBoundingClientRect().height > 0),
        bodyDisplay: sbody ? getComputedStyle(sbody).display : null,
        // ─ 보이는 것 ─
        sectionH: sec ? Math.round(sec.getBoundingClientRect().height) : null,
        panelScrollH: body.scrollHeight,
        // ─ DOM 에 있는 것(★증인) ─
        sizeBodyNodes: sbody ? sbody.querySelectorAll('*').length : null,
        pickerCellN: cells.length,
        pickerDeadN: cells.filter(c => c.classList.contains('grid-picker-cell--off')).length,
        hintN: sbody ? sbody.querySelectorAll('.prop-hint').length : null,
        // ─ 패널 전체 ─
        controlN: body.querySelectorAll('input,select,textarea,button').length,
        sectionN: body.querySelectorAll('.prop-section').length,
        sectionTitles: [...body.querySelectorAll('.prop-section-title')].map(t => t.textContent.trim()),
        // ─ 피커 «현재값» ─
        activeN: cells.filter(c => c.classList.contains('active')).length,
        activeMax: cells.filter(c => c.classList.contains('active'))
          .reduce((a, c) => ({ c: Math.max(a.c, +c.dataset.c), r: Math.max(a.r, +c.dataset.r) }), { c: 0, r: 0 }),
        labelText: label ? label.textContent.trim() : null,
      };
    };
  });
}

async function boot(page) {
  await installMount(page);
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  await page.setViewportSize({ width: 1280, height: 900 });
  return errs;
}

/* ★G2 와 «같은 픽스처·같은 창»이다 (4×4 · (0,0) li:1 · 1280x900).
   까닭 — 이 파일이 대는 「줄어든 까닭」이 G2 가 본 그 수를 설명해야 하기 때문이다.
   다른 자로 잰 설명은 그 자의 Δ 를 설명하지 못한다. */
const FIX_4x4 = (() => {
  const line = (t, s) => ({ type: t, text: s });
  const cell = (tag) => ({ lines: [line('body', tag + '-0'), line('caption', tag + '-1')] });
  const cells = [];
  for (let r = 0; r < 4; r++) {
    const row = [];
    for (let c = 0; c < 4; c++) row.push(cell(`${r}${c}`));
    cells.push(row);
  }
  cells[0][0] = { lines: [line('body', 'A0'), line('h2', 'A1'), line('caption', 'A2')] };
  return {
    cols: [0, 1, 2, 3].map(() => ({ width: 1, lines: [] })),
    rows: [0, 1, 2, 3].map(() => ({ height: 'auto' })),
    cells,
  };
})();
const A_4x4 = { r: 0, c: 0, li: 1 };

const FIX_2x2 = {
  cols: [{ width: 1, lines: [] }, { width: 1, lines: [] }],
  rows: [{ height: 'auto' }, { height: 'auto' }],
  cells: [
    [{ lines: [{ type: 'body', text: 'A' }] }, { lines: [{ type: 'body', text: 'B' }] }],
    [{ lines: [{ type: 'body', text: 'C' }] }, { lines: [{ type: 'body', text: 'D' }] }],
  ],
};

/* ── F1 ────────────────────────────────────────────────────────────────────
 * 깨뜨리면 빨개지는 것: 기본값을 «펼침»으로 되돌리는 순간(_grdSecOpen(block,'size') 를
 *   true 로 두거나 display 를 block 으로 고정). 그리고 제목에서 (N×M) 을 빼는 순간. */
test('F1 ★기본은 «접힘»이고, 접힌 제목이 «지금 몇 칸인지»를 스스로 말한다', async ({ page }) => {
  const errs = await boot(page);
  const p = await page.evaluate((fx) => { window.__mount(fx, { r: 0, c: 0, li: 1 }); return window.__foldProbe(); }, FIX_4x4);
  expect(errs).toEqual([]);
  expect(p.headText, '★절 머리(#grd-size-toggle)가 아예 없다 — 이 검사는 아무것도 안 본다').not.toBe(null);
  expect(p.bodyDisplay, '★기본이 «펼침»이다 — 발주(시안2 「위를 접는다」)는 «기본 접힘»이다').toBe('none');
  expect(p.headVisible, '★접었더니 제목까지 사라졌다 — 그러면 «몇 칸인지»를 알 길이 없다').toBe(true);
  /* ★현빈 말씀 「제목만으로 지금 몇 칸인지 알려 준다」를 기계로 옮긴 줄이다. */
  expect(p.headText, `★접힌 제목이 «지금 몇 칸인지»를 안 말한다 (지금 제목: "${p.headText}")`).toContain('4×4');
  expect(p.headText, '★접힌 제목이 «무엇을 여는 절인지»를 안 말한다').toContain('칸 수');
});

/* ── F2 ★★이 파일의 핵심 ─────────────────────────────────────────────────
 * 깨뜨리면 빨개지는 것: 접힘을 «display:none» 이 아니라 «DOM 에서 빼는 것»으로 구현하는 순간
 *   (예: `${open ? pickerHtml : ''}`). 그 순간 높이는 똑같이 줄지만 이 검사가 빨개진다.
 *   ⇒ 그것이 바로 G2 가 의심하는 「절이 «하나 안 뜬»」 사고다. */
test('F2 ★줄어든 것은 «접힌» 것이지 «빠진» 것이 아니다 — 접힘/펼침의 DOM 수가 같다', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate((fx) => {
    window.__mount(fx, { r: 0, c: 0, li: 1 });
    const folded = window.__foldProbe();
    document.getElementById('grd-size-toggle').click();     // 사람이 누르는 그 길로 편다
    const open = window.__foldProbe();
    return { folded, open };
  }, FIX_4x4);
  expect(errs).toEqual([]);

  const { folded, open } = r;
  const rep = `\n   접힘 sec ${folded.sectionH}px · 패널 ${folded.panelScrollH}px\n` +
              `   펼침 sec ${open.sectionH}px · 패널 ${open.panelScrollH}px`;

  // ⑴ 실제로 접혔다 — «보이는 높이»는 줄었다.
  expect(open.bodyDisplay, '★눌러도 안 펴진다 — 배선(_grdWireDisclosure)이 안 붙었다').toBe('block');
  expect(folded.sectionH, `★접었는데 절 높이가 안 줄었다.${rep}`).toBeLessThan(open.sectionH);
  expect(folded.panelScrollH, `★접었는데 패널 높이가 안 줄었다.${rep}`).toBeLessThan(open.panelScrollH);

  // ⑵ ★그런데 «DOM 은 한 개도 안 없어졌다» — 이 세 줄이 곧 「접힌 것이지 빠진 것이 아니다」의 증거다.
  expect(folded.pickerCellN, `★접었더니 피커 칸이 ${open.pickerCellN} → ${folded.pickerCellN} 로 «없어졌다». ` +
    '접힘은 DOM 을 지우는 것이 아니다 — 지웠다면 그건 「빠진 것」이고 높이 감소는 사고다').toBe(open.pickerCellN);
  expect(folded.sizeBodyNodes, `★접었더니 절 안 원소가 ${open.sizeBodyNodes} → ${folded.sizeBodyNodes} 로 줄었다`)
    .toBe(open.sizeBodyNodes);
  expect(folded.hintN, '★접었더니 안내문 줄이 없어졌다 — 펴면 다시 있어야 한다').toBe(open.hintN);
  expect(folded.pickerCellN, '★피커가 4×4(16칸)가 아니다 — 전제가 안 선다').toBe(16);

  // ⑶ ★«다른 절»이 같이 사라지지 않았다 — G2 의 controlN·절 수로 댄다(그것이 G2 가 세는 양이다).
  expect(folded.controlN, `★접었더니 손잡이(input/select/textarea/button)가 ` +
    `${open.controlN} → ${folded.controlN} 로 줄었다 — 절이 «하나 안 뜬» 것이다`).toBe(open.controlN);
  expect(folded.sectionN, `★절 수가 ${open.sectionN} → ${folded.sectionN} 로 달라졌다`).toBe(open.sectionN);
  expect(folded.sectionTitles, '★절 제목 명부가 달라졌다 — 무엇이 빠졌는지 세라').toEqual(open.sectionTitles);
});

/* ── F3 ────────────────────────────────────────────────────────────────────
 * 깨뜨리면 빨개지는 것: buildGridPicker 호출부에서 `cur` 를 빼는 순간(= 옛 동작). */
test('F3 ★펼치면 «지금 칸»이 칠해져 있다 — hover 하기 전에', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate((fxs) => {
    const out = {};
    for (const [k, fx] of Object.entries(fxs)) {
      window.__mount(fx, null);
      document.getElementById('grd-size-toggle').click();
      out[k] = window.__foldProbe();
    }
    return out;
  }, { four: FIX_4x4, two: FIX_2x2 });
  expect(errs).toEqual([]);

  expect(r.four.activeN, `★4×4 인데 칠해진 칸이 ${r.four.activeN}개다 (16 이어야 한다) — ` +
    'hover 전엔 아무 칸도 안 칠해지던 옛 동작 그대로다').toBe(16);
  expect(r.four.activeMax, '★칠해진 범위의 오른쪽·아래 끝이 4×4 가 아니다').toEqual({ c: 4, r: 4 });
  expect(r.four.labelText, '★라벨이 «지금 값»을 안 말한다').toBe('4 × 4');

  expect(r.two.activeN, `★2×2 인데 칠해진 칸이 ${r.two.activeN}개다 (4 여야 한다)`).toBe(4);
  expect(r.two.activeMax, '★칠해진 범위가 2×2 가 아니다').toEqual({ c: 2, r: 2 });
  expect(r.two.labelText).toBe('2 × 2');
});

/* ── F4 ────────────────────────────────────────────────────────────────────
 * 깨뜨리면 빨개지는 것: mouseleave 의 clear() 를 옛 꼴(전부 지우고 '—')로 되돌리는 순간.
 * ★왜 이것까지 재나 — 「처음엔 칠해져 있는데 마우스가 한 번 스치면 «영영» 빈 피커가 되는」
 *   상태가 제일 나쁘다. 사용자는 그걸 「내가 뭘 지웠다」로 읽는다. */
test('F4 ★마우스가 스쳤다 나가면 «빈 피커»가 아니라 지금 값으로 돌아온다', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate((fx) => {
    window.__mount(fx, null);
    document.getElementById('grd-size-toggle').click();
    const picker = document.getElementById('grd-grid-picker');
    const c2r2 = [...picker.querySelectorAll('.grid-picker-cell')].find(c => c.dataset.c === '2' && c.dataset.r === '2');
    c2r2.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    const hovering = window.__foldProbe();
    picker.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }));
    const after = window.__foldProbe();
    return { hovering, after };
  }, FIX_4x4);
  expect(errs).toEqual([]);
  expect(r.hovering.activeN, '★hover 미리보기가 안 먹는다 — 전제가 안 선다').toBe(4);
  expect(r.hovering.labelText).toBe('2 × 2');
  expect(r.after.activeN, `★마우스가 나가자 피커가 비었다(칠해진 칸 ${r.after.activeN}개). ` +
    '사용자는 이걸 「내가 뭘 지웠다」로 읽는다').toBe(16);
  expect(r.after.labelText, '★마우스가 나가자 라벨이 «—» 로 떨어졌다').toBe('4 × 4');
});

/* ── F5 ────────────────────────────────────────────────────────────────────
 * 깨뜨리면 빨개지는 것: 열림 상태를 dataset/저장본에 얹는 순간. */
test('F5 ★접고 펴는 것은 «저장본»을 한 글자도 안 건드린다', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate((fx) => {
    const b = window.__mount(fx, { r: 0, c: 0, li: 1 });
    const snap = () => JSON.stringify({ ...b.dataset });
    const before = snap();
    document.getElementById('grd-size-toggle').click();
    const opened = snap();
    document.getElementById('grd-size-toggle').click();
    return { before, opened, closed: snap(), display: getComputedStyle(document.getElementById('grd-size-body')).display };
  }, FIX_4x4);
  expect(errs).toEqual([]);
  expect(r.opened, '★절을 펴자 dataset 이 바뀌었다 — 저장 포맷이 움직였다').toBe(r.before);
  expect(r.closed, '★절을 다시 접자 dataset 이 바뀌었다').toBe(r.before);
  expect(r.display, '★두 번 눌렀는데 안 닫혔다 — 토글이 한 방향으로만 돈다').toBe('none');
});

/* ── F6 ────────────────────────────────────────────────────────────────────
 * ★왜 이것까지 재나 — 칸 수를 고르면 onPick 이 showGridProperties 를 다시 불러 패널을
 *   ★통째로 다시 그린다. 그때 절이 «도로 접히면» 사용자는 한 번 고를 때마다 다시 펴야 한다
 *   (그리고 방금 무엇을 골랐는지 그림으로 확인할 길도 같이 사라진다).
 *   열림 상태가 블록별 WeakMap 이라 지금은 살아남는데, 그건 «설계»지 «잰 것»이 아니었다.
 * 깨뜨리면 빨개지는 것: 열림 상태를 재렌더에 안 살아남는 자리(DOM 참조·지역 변수)로 옮기는 순간.
 * ⛔이 검사는 커밋을 갈라 «따로» 들어왔다 — 앞 커밋(9d00ec1)이 골든의 기준선이라 그 sha 를
 *   못 움직인다. 제품코드는 한 줄도 안 바뀐다. */
test('F6 ★칸 수를 고른 «뒤»에도 절이 열려 있고, 제목·피커가 새 값을 말한다', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate((fx) => {
    window.__mount(fx, null);
    document.getElementById('grd-size-toggle').click();
    const picker = document.getElementById('grd-grid-picker');
    const c3r2 = [...picker.querySelectorAll('.grid-picker-cell')].find(c => c.dataset.c === '3' && c.dataset.r === '2');
    c3r2.dispatchEvent(new MouseEvent('click', { bubbles: true }));   // 사람이 누르는 그 길
    const p = window.__foldProbe();
    return { p, cols: JSON.parse(window.__b.dataset.cols || '[]').length };
  }, FIX_2x2);
  expect(errs).toEqual([]);
  expect(r.cols, '★피커 클릭이 모델에 안 닿았다 — 전제가 안 선다').toBe(3);
  expect(r.p.bodyDisplay, '★고르자마자 절이 도로 접혔다 — 한 번 고를 때마다 다시 펴야 한다').toBe('block');
  expect(r.p.headText, `★제목이 옛 값을 말한다 (지금 제목: "${r.p.headText}")`).toContain('3×2');
  expect(r.p.activeN, `★새로 그린 피커가 «새 값»을 안 칠한다 (칠해진 칸 ${r.p.activeN}개, 6 이어야 한다)`).toBe(6);
  expect(r.p.labelText, '★라벨이 새 값을 안 말한다').toBe('3 × 2');
});
