/* overlay-icon-text-exit-width.dom.spec.js
 * 「아이콘+텍스트를 손잡이로 키운 뒤 오버레이를 끄면 블럭이 제 행을 넘어선다」
 *
 * ★신고 (2026-09-21 최종통합 QA medium)
 *   .icon-text-block 을 오버레이 모서리 핸들로 키우면(현빈이 지시한 바로 그 조작) 핸들이
 *   블럭에 인라인 width 를 박는다(792px). 그 뒤 오버레이를 «끄면» 블럭이 돌아가는 .row 는
 *   716px 인데 인라인 792 가 그대로 남아
 *     ⑴ 블럭이 제 행을 76px, 섹션 오른쪽 끝을 4px 넘어 글자가 섹션 경계에서 잘리고
 *     ⑵ 그 뒤 우측 패널 «너비» 칸으로 되돌리려 해도 패널은 row 만 바꿔 블럭에 효과가 없다
 *   ⇒ 사용자는 키운 크기를 «패널로 되돌릴 길»이 없다.
 *
 * ★대조군이 답을 알려준다 — 같은 절차를 «일반 텍스트»로 하면 래퍼 .frame-block[data-text-frame]
 *   이 CSS `max-width:100%` 를 갖고 있어 렌더 폭이 행으로 깎인다(넘침 음수). 아이콘+텍스트는
 *   래퍼가 «없고» .icon-text-block 에 max-width 규칙도 없어 깎이지 않는다.
 *   ⇒ 고침 = 같은 결로 .icon-text-block 에도 `max-width:100%` 를 준다(css/editor-extra.css).
 *     «사용자가 정한 폭은 남는다»(현빈 2026-09-20 결정, tests/dom/text-overlay-resize D7)는
 *     그대로다 — style.width 는 792 로 남고 «그리는 폭»만 행에 맞춰진다. 일반 텍스트가
 *     이미 그렇게 동작한다(그 «패널 값 ≠ 렌더 폭» 축은 js/overlay-float.js:404~414 가
 *     현빈 판단 대기로 기록해 둔 별개 축이고, 이 고침은 그 축을 건드리지 않는다).
 *
 * 재는 것
 *   X1 ★음성대조 — max-width 를 인라인으로 «풀면» 블럭이 행을 넘는다(고치기 전 상태 재현)
 *   X2 ★고침 — 오버레이를 끈 뒤 블럭이 행·섹션을 «안» 넘는다
 *   X3 ★사용자가 정한 폭은 «지워지지 않는다» — style.width 는 792 그대로다
 *   X4 ★패널이 행 폭을 바꾸면 블럭도 따라 그려진다(되돌릴 길이 생긴다)
 *   X5 대조군 — 일반 텍스트(프레임 래퍼)는 전과 같다(회귀 0)
 *
 * ⛔앱을 «안» 띄운다. 실행: npm run test:dom -- overlay-icon-text-exit-width
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-canvas.css">
<link rel="stylesheet" href="/css/editor-layout.css">
<link rel="stylesheet" href="/css/editor-blocks.css">
<link rel="stylesheet" href="/css/editor-extra.css">
<style>
  body{margin:0}
  #canvas{width:860px}
  .section-block{position:relative;background:#fff;min-height:600px}
  /* 실앱 기본 — 섹션 좌우 패딩 72 ⇒ 본문(행) 폭 716 */
  .section-inner{padding-left:72px;padding-right:72px;display:block}
  .row{position:relative;display:flex;width:100%}
</style></head><body>
<div id="canvas-scaler" style="transform:scale(1);transform-origin:0 0;">
  <div id="canvas">
    <div class="section-block" id="sec">
      <div class="section-inner" id="inner" data-padding-x="72"></div>
    </div>
  </div>
</div>
<div id="ss-handles-overlay"></div>
<script src="/js/feature-flags.js"></script>
<script src="/js/drag-history.js"></script>
<script type="module">
  import '/js/block-factory.js';                       // window.makeIconTextBlock
  import { showHandlesFor } from '/js/overlay-handles.js';
  import { enterFloat, exitFloat, posElOf } from '/js/overlay-float.js';
  window.currentZoom = 100;
  window.__show = showHandlesFor;
  window.__enter = enterFloat;
  window.__exit = exitFloat;
  window.__posElOf = posElOf;
  window.__ready = true;
</script></body></html>`;

async function boot(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, decodeURIComponent(url.pathname));
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

const raf = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

/** 아이콘+텍스트(또는 대조군 텍스트)를 행에 올리고 «진짜» enterFloat 으로 오버레이를 켠다. */
async function mount(page, kind) {
  await page.evaluate((kind) => {
    const inner = document.getElementById('inner');
    let block;
    if (kind === 'itb') {
      const made = window.makeIconTextBlock();
      inner.appendChild(made.row);
      block = made.block;
    } else {
      // 대조군 — 일반 텍스트(프레임 래퍼가 붙는 꼴)
      const row = document.createElement('div');
      row.className = 'row'; row.id = 'row_tb'; row.dataset.layout = 'stack';
      const fr = document.createElement('div');
      fr.className = 'frame-block'; fr.id = 'fr_tb'; fr.dataset.textFrame = 'true';
      const tb = document.createElement('div');
      tb.className = 'text-block tb-body'; tb.id = 'tb1'; tb.textContent = '본문 내용을 입력하세요.';
      fr.appendChild(tb); row.appendChild(fr); inner.appendChild(row);
      block = tb;
    }
    block.classList.add('selected');
    window.__block = block;
    window.__pos = window.__posElOf(block);
    window.__pushes = [];
    window.pushHistory = (l) => window.__pushes.push(l);
    window.beginDragHistory = () => ({ arm: () => {} });
    window.__enter(window.__pos);
    window.__show(block);
  }, kind);
  await raf(page);
}

async function dragHandle(page, dir, dx, dy) {
  const box = await page.locator(`#ss-handles-overlay .tfo-overlay-handle.${dir}`).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 8 });
  await page.mouse.up();
  await raf(page);
}

/** 오버레이를 끄고(진짜 exitFloat) 흐름으로 돌아온 «결과»를 잰다. */
const exitAndMeasure = (page, unfixInline) => page.evaluate((unfixInline) => {
  window.__exit(window.__pos);
  const pos = window.__pos;
  /* ★음성대조 — 고침(css .icon-text-block{max-width:100%})을 «그 블럭만» 무력화한다.
     CSS 파일을 되돌리지 않고 같은 실행 안에서 빨강을 만든다. */
  if (unfixInline) pos.style.maxWidth = 'none';
  const row = pos.closest('.row');
  const innerEl = document.getElementById('inner');
  const pr = pos.getBoundingClientRect();
  const rr = row.getBoundingClientRect();
  const ir = innerEl.getBoundingClientRect();
  return {
    renderW: +pr.width.toFixed(1),
    styleW: pos.style.width,
    rowW: +rr.width.toFixed(1),
    overflowRowPx: +(pr.right - rr.right).toFixed(1),
    overflowInnerPx: +(pr.right - ir.right).toFixed(1),
  };
}, unfixInline);

test.describe('아이콘+텍스트 — 오버레이로 키운 뒤 «끄면»', () => {
  test('X1 ★음성대조 — max-width 를 풀면 블럭이 제 행과 섹션 본문을 넘어선다', async ({ page }) => {
    const errs = await boot(page);
    await mount(page, 'itb');
    expect(await page.locator('#ss-handles-overlay .tfo-overlay-handle').count(), '손잡이가 안 붙었다').toBe(4);
    await dragHandle(page, 'se', 120, 30);
    const r = await exitAndMeasure(page, true);
    console.log('  X1(고치기 전):', JSON.stringify(r));
    expect(parseFloat(r.styleW), '전제 — 손잡이가 행 폭보다 큰 인라인 폭을 박아야 한다').toBeGreaterThan(r.rowW + 20);
    expect(r.overflowRowPx, '★고치기 전인데 행을 안 넘는다 — 이 음성대조가 아무것도 안 보고 있다')
      .toBeGreaterThan(20);
    expect(errs, errs.join(' | ')).toEqual([]);
  });

  test('X2 ★고침 — 오버레이를 끈 뒤 블럭이 행·섹션 본문을 «안» 넘는다', async ({ page }) => {
    const errs = await boot(page);
    await mount(page, 'itb');
    await dragHandle(page, 'se', 120, 30);
    const r = await exitAndMeasure(page, false);
    console.log('  X2(고친 뒤):', JSON.stringify(r));
    expect(r.overflowRowPx, `행을 ${r.overflowRowPx}px 넘는다 (렌더 ${r.renderW} / 행 ${r.rowW})`).toBeLessThanOrEqual(0.5);
    expect(r.overflowInnerPx, `섹션 본문을 ${r.overflowInnerPx}px 넘는다`).toBeLessThanOrEqual(0.5);
    expect(r.renderW, '행 폭까지는 꽉 차야 한다(작아지면 다른 회귀다)').toBeCloseTo(r.rowW, 0);
    expect(errs, errs.join(' | ')).toEqual([]);
  });

  test('X3 ★사용자가 정한 폭은 지워지지 않는다 (현빈 2026-09-20 결정 — 키운 값이 이긴다)', async ({ page }) => {
    await boot(page);
    await mount(page, 'itb');
    await dragHandle(page, 'se', 120, 30);
    const r = await exitAndMeasure(page, false);
    expect(parseFloat(r.styleW), `style.width 가 ${r.styleW} 로 지워지거나 깎였다 — 키운 값이 증발하면 안 된다`)
      .toBeGreaterThan(r.rowW + 20);
  });

  test('X4 ★되돌릴 길 — 행 폭을 바꾸면 블럭도 따라 그려진다', async ({ page }) => {
    await boot(page);
    await mount(page, 'itb');
    await dragHandle(page, 'se', 120, 30);
    await exitAndMeasure(page, false);
    const r = await page.evaluate(() => {
      const pos = window.__pos, row = pos.closest('.row');
      row.style.width = '300px';
      const pr = pos.getBoundingClientRect();
      return { rowW: +row.getBoundingClientRect().width.toFixed(1), renderW: +pr.width.toFixed(1) };
    });
    console.log('  X4:', JSON.stringify(r));
    expect(r.renderW, `행을 300 으로 줄였는데 블럭은 ${r.renderW} — 패널로 되돌릴 길이 없다`).toBeCloseTo(300, 0);
  });

  test('X5 대조군 — 일반 텍스트(프레임 래퍼)는 전과 같다', async ({ page }) => {
    const errs = await boot(page);
    await mount(page, 'tb');
    await dragHandle(page, 'se', 120, 30);
    const r = await exitAndMeasure(page, false);
    console.log('  X5(대조군 텍스트):', JSON.stringify(r));
    expect(r.overflowRowPx, '대조군이 행을 넘는다 — 이 고침과 무관한 회귀다').toBeLessThanOrEqual(0.5);
    expect(errs, errs.join(' | ')).toEqual([]);
  });
});
