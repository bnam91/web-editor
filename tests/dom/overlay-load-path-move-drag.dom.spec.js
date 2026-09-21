/* overlay-load-path-move-drag.dom.spec.js — 「저장된 오버레이 블럭이 «다시 연 뒤»에도 마우스로
 * 움직이는가」 (2026-09-21 마지막 라운드 / 최종반영 QA medium)
 *
 * ★신고 — 오버레이를 켠 «아이콘+텍스트»(.icon-text-block)가 마우스로 전혀 안 옮겨지고,
 *   끌면 선택까지 풀린다.
 *
 * ★실측으로 가른 것(실앱 9515, 줌 40%) — 신고보다 «좁다»:
 *     · 패널 토글로 «방금» 켠 직후  → 움직인다(left 72→248 / top 183→309, 선택 유지)
 *       ⇒ enterFloat 이 마지막 줄에서 window._bindOverlayMoveDrag(posEl) 을 직접 걸어준다.
 *     · 저장 → 다시 열기(=로드 경로) → «0px 도 안 움직이고 선택도 전부 풀린다»
 *       실측: _overlayMoveBound=false · _blockBound=true · 드래그 후 left/top 그대로 248/309 ·
 *             남은 .selected 0개.
 *   즉 «토글 경로»에만 배선이 있고 «로드 경로»(bindBlock)에는 없었다.
 *
 * ★뿌리 — js/block-drag.js bindBlock 이 이동 드래그를 «클래스»로 갈라 걸었다:
 *     `if (isShape || isAsset)` 과 `if (isText)`(그것도 .frame-block[data-text-frame] 래퍼를
 *     찾아서) 둘뿐. .icon-text-block 은 .text-block 이 «아니고» 그 래퍼도 없어서
 *     (posElOf 가 블럭 «자신»을 돌려준다) 어느 갈래에도 안 걸렸다.
 *   같은 bindBlock 안의 «일반 드래그 비켜가기» 가드는 이미 타입과 무관하게
 *     `_floatPosElOf(block)?.dataset.overlayBlock === 'true'` 로 판정한다 — 비켜가기는
 *     전 타입인데 «받아줄 전용 드래그»만 세 타입이라, 아이콘텍스트는 두 드래그 «사이»로 샜다.
 *   드래그가 없으니 누른 뒤의 합성 click 이 #canvas-wrap 까지 올라가 deselectAll() 이 돈다 —
 *   29ae1cb 가 삼키기로 한 바로 그 click 이다(그 수정은 bindFloatMoveDrag 안에 있어서,
 *   «걸리지 않은» 블럭은 혜택을 못 받는다).
 *
 * ★그래서 이 검사는 «타입 전수»로 잰다 — 한 축(도형·에셋·텍스트)만 초록이던 것이 이 결함의
 *   모양이다(「한 축의 0건 ≠ 결함 0」).
 *
 * ⛔앱을 «안» 띄운다 — js/block-drag.js 를 진짜 ES 모듈로 얹고 window.bindBlock 만 부른다
 *   (=로드 경로가 하는 일 그대로). 마우스는 page.mouse(진짜 입력).
 * ⚠️tests/dom 은 `npm test` 밖이다 — 변이 책임은 tests/unit/overlay-icon-text-handles.test.mjs 문④.
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js overlay-load-path-move-drag
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

const SEC_W = 800, SEC_H = 400, BOX_W = 300, BOX_H = 40, X0 = 60, Y0 = 40;

/* 「로드된 프로젝트」 모양 그대로 — 오버레이 상태가 «이미» DOM 에 박혀 있고, 앱은
   bindBlock 만 다시 건다(enterFloat 은 안 돈다. 그게 이 결함이 사는 자리다). */
const HARNESS = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; } body { margin:0; }
  #canvas-wrap { position:relative; width:1000px; height:700px; background:#555; }
  .section-block { position:relative; width:${SEC_W}px; height:${SEC_H}px; background:#fff; }
  .section-block > [data-overlay-block="true"], .frame-block[data-overlay-block="true"] {
    position:absolute; width:${BOX_W}px; height:${BOX_H}px; background:rgba(0,0,255,.12);
  }
  .shape-block, .text-block, .tb-h2 { width:100%; height:100%; }
</style></head><body>
<div id="canvas-wrap">
  <div id="canvas-scaler" style="transform:scale(1);transform-origin:0 0">
    <div id="canvas">
      <div class="section-block" id="sec"></div>
    </div>
  </div>
</div>
<div id="ss-handles-overlay"></div>
<script src="/js/feature-flags.js"></script>
<script>
  window.currentZoom = 100;
  window.__pushes = [];
  window.pushHistory = (label) => window.__pushes.push(label || '');
  window.scheduleAutoSave = () => {};
  window.triggerAutoSave = () => {};
  window.beginDragHistory = () => ({ arm: () => {} });
  window._findSectionAt = () => null;          // 재부모 hit-test 는 이 검사의 관심 밖
  window.__deselects = 0;
  window.deselectAll = () => {
    window.__deselects++;
    document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
  };
  /* 앱의 캔버스 배경 규약 그대로 — js/editor.js 의 #canvas-wrap click 핸들러. */
  document.getElementById('canvas-wrap').addEventListener('click', e => {
    if (['canvas-wrap','canvas-scaler','canvas'].includes(e.target.id)) window.deselectAll();
  });
</script>
<script type="module">
  import '/js/block-drag.js';                  // window.bindBlock
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
  await page.waitForFunction(() => window.__ready === true && typeof window.bindBlock === 'function');
  return errs;
}

/** 타입별 «로드 직후» DOM 을 세우고 bindBlock 을 건다. 돌려주는 것은 posEl 의 id. */
async function mount(page, kind) {
  return page.evaluate(({ kind, X0, Y0 }) => {
    const sec = document.getElementById('sec');
    sec.innerHTML = '';
    const pos = document.createElement('div');
    pos.dataset.overlayBlock = 'true';
    pos.dataset.offsetX = String(X0); pos.dataset.offsetY = String(Y0);
    pos.style.left = X0 + 'px'; pos.style.top = Y0 + 'px';
    let block = pos;
    if (kind === 'icon-text') {
      pos.className = 'icon-text-block'; pos.id = 'itb1';
      pos.innerHTML = '<div class="itb-icon"></div><div class="itb-text" contenteditable="false">본문</div>';
    } else if (kind === 'asset') {
      pos.className = 'asset-block'; pos.id = 'ab1';
    } else if (kind === 'text') {
      pos.className = 'frame-block'; pos.id = 'tf1'; pos.dataset.textFrame = 'true';
      pos.innerHTML = '<div class="text-block" id="tb1"><div class="tb-h2" contenteditable="false">텍스트</div></div>';
      block = pos.querySelector('#tb1');
    } else if (kind === 'shape') {
      pos.className = 'frame-block'; pos.id = 'sf1'; pos.dataset.freeLayout = 'true';
      pos.innerHTML = '<div class="shape-block" id="shp1"></div>';
      block = pos.querySelector('#shp1');
    }
    sec.appendChild(pos);
    pos.classList.add('selected');
    block.classList.add('selected');
    window.bindBlock(block);            // ★로드 경로가 하는 «유일한» 배선
    window.__pos = pos;
    window.__deselects = 0;
    window.__pushes = [];
    return { posId: pos.id, bound: !!pos._overlayMoveBound };
  }, { kind, X0, Y0 });
}

async function dragBy(page, dx, dy) {
  const c = await page.evaluate(() => {
    const r = window.__pos.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  });
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + dx / 2, c.y + dy / 2);
  await page.mouse.move(c.x + dx, c.y + dy);
  await page.mouse.up();
}

const posOf = (page) => page.evaluate(() => ({
  left: parseFloat(window.__pos.style.left) || 0,
  top: parseFloat(window.__pos.style.top) || 0,
  ox: +(window.__pos.dataset.offsetX || 0),
  oy: +(window.__pos.dataset.offsetY || 0),
  sel: document.querySelectorAll('.selected').length,
  deselects: window.__deselects,
  pushes: window.__pushes.slice(),
}));

const KINDS = ['icon-text', 'text', 'shape', 'asset'];

test('전제 — block-drag.js 가 콘솔 오류 없이 얹힌다', async ({ page }) => {
  const errs = await boot(page);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

for (const kind of KINDS) {
  test(`L1[${kind}] ★로드 경로(bindBlock)만으로도 마우스 드래그가 «실제로» 움직인다`, async ({ page }) => {
    await boot(page);
    const m = await mount(page, kind);
    expect(m.bound, `★bindBlock 이 ${kind} 의 오버레이 이동 드래그를 안 걸었다(posEl=${m.posId})`).toBe(true);
    const before = await posOf(page);
    expect(before, '전제').toMatchObject({ left: X0, top: Y0 });
    await dragBy(page, 120, 60);
    const after = await posOf(page);
    expect(after.left, `${kind}: 가로로 안 움직였다`).toBe(X0 + 120);
    expect(after.top, `${kind}: 세로로 안 움직였다`).toBe(Y0 + 60);
    // dataset 이 SSOT — style 만 맞고 dataset 이 낡으면 패널·저장이 옛 자리를 쓴다
    expect(after.ox, `${kind}: dataset.offsetX 가 안 따라왔다`).toBe(X0 + 120);
    expect(after.oy, `${kind}: dataset.offsetY 가 안 따라왔다`).toBe(Y0 + 60);
  });

  test(`L2[${kind}] ★그 드래그가 «전용 onUp»까지 간다 — 마우스업 가드를 같이 탄다`, async ({ page }) => {
    /* ⚠️여기서 «선택이 풀리나»를 직접 재지 않는다 — 이 하네스에서는 합성 click 이 아예
       안 나서(실측: canvas-wrap 에 click 0건, 끌린 요소가 draggable=true) 고침 전후가
       똑같이 초록인 «빈 검사»가 된다. 대신 «같은 드래그가 bindFloatMoveDrag 의 onUp 까지
       도달했는가»를 잰다 — 그 onUp 안에 마우스업 click 가드(killClick)가 산다.
       선택 유지 자체의 숫자는 tests/dom/overlay-drag-mouseup-selection.dom.spec.js S1~S4 가
       이미 지고, 실앱 실측(9515, 줌 40%)은 고침 전 «이동 0px · 남은 선택 0개»였다. */
    await boot(page);
    await mount(page, kind);
    await dragBy(page, 120, 60);
    const after = await posOf(page);
    expect(after.pushes, `${kind}: 전용 드래그의 onUp 이 안 돌았다(마우스업 가드도 같이 빠진다)`)
      .toContain('오버레이 이동');
  });
}
