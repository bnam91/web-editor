/* qa0920b-layer-panel-type.dom.spec.js — 0920b 통합 QA 반영(medium).
 *
 * ★무엇이 깨졌나 — 좌측 LAYERS 패널에서 «Gradient» 행을 누르면 블록은 골라지는데 우측에
 *   «에셋(이미지) 속성 패널»이 떴다. js/panels/layer-panel-items.js 의 타입 분기에
 *   gradient/sticker 갈래가 없어 최종 else → window.showAssetProperties(block) 로 떨어진다.
 *   ⇒ 그라데이션 전용 UI(stop 색·투명도 .grad-stop-alpha, 방향, #grad-width-slider)에
 *     레이어 패널 경로로는 «아예 도달할 수 없다»(현빈 원문 ⑪ 시나리오의 그 입력칸).
 *   더 나쁜 점: 잘못 뜬 에셋 패널의 「너비」가 실제로 먹어서 block.style.width 는 바뀌는데
 *   dataset.gradWidth 는 그대로라 저장값과 화면이 어긋난다.
 *   ★회귀는 아니다 — 기준선 dev@20e50e3 에도 있던 결함(git diff 20e50e3..HEAD -- js/panels/ 비어 있음).
 *
 * ★고침의 근거 — 「클릭 경로와 같은 한 벌」. js/history.js _restoreSelection 이 이미 같은
 *   판정을 쓴다(gradient → window._selectGradient · sticker → window._selectSticker):
 *   두 타입은 «선택+핸들+패널»을 자기 진입점이 통째로 처리한다.
 *
 * ⛔앱을 «안» 띄운다. 실행: npm run test:dom -- qa0920b-layer-panel-type
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

const HARNESS = `<!doctype html><html><head><meta charset="utf-8"></head><body>
  <div id="canvas-wrap" style="height:400px;overflow:auto;">
    <div id="canvas">
      <div class="section-block" id="sec1">
        <div class="section-inner" id="inner1"></div>
        <div class="gradient-block" id="grad_test" style="position:absolute;left:10px;top:10px;width:200px;height:80px;"></div>
        <div class="sticker-block" id="stk_test" style="position:absolute;left:10px;top:120px;width:60px;height:60px;"></div>
        <div class="asset-block" id="ab_test" style="position:relative;width:200px;height:80px;"></div>
        <div class="vector-block" id="vec_test" style="position:relative;width:120px;height:120px;"></div>
        <div class="step-block" id="stp_test" style="position:relative;width:400px;height:120px;"></div>
      </div>
    </div>
  </div>
  <div id="layers"></div>
  <script>
    window.__calls = [];
    const rec = (n) => (el) => window.__calls.push({ fn: n, id: el && el.id });
    window.showAssetProperties = rec('asset');
    window._selectGradient = rec('gradient');
    window._selectSticker = rec('sticker');
    window.showTextProperties = rec('text');
    window.showShapeProperties = rec('shape');
    window.showVectorProperties = rec('vector');
    window.showStepProperties = rec('step');
    window.deselectAll = () => document.querySelectorAll('.selected').forEach(e => e.classList.remove('selected'));
    window.syncSection = () => {};
    window.highlightBlock = () => window.__calls.push({ fn: 'highlight' });
    window.setBlockAnchor = () => {};
    window.showHandlesFor = () => window.__calls.push({ fn: 'handles' });
    window.restoreFrameSelectionFor = () => {};
    window.buildLayerPanel = () => {};
    window.pushHistory = () => {};
    window.AutoSaveSuppress = { begin: () => ({}), end: () => {} };
  </script>
  <script type="module">
    import { makeLayerBlockItem } from '/js/panels/layer-panel-items.js';
    window.__mkItem = makeLayerBlockItem;
    window.__ready = true;
  </script></body></html>`;

async function boot(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html; charset=utf-8', body: HARNESS });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

/** 레이어 행 하나를 만들어 클릭하고, 어느 패널 진입점이 불렸는지 돌려준다. */
async function clickLayerRowFor(page, blockId) {
  return page.evaluate((id) => {
    window.__calls = [];
    const block = document.getElementById(id);
    const sec = document.getElementById('sec1');
    const item = window.__mkItem(block, block, sec, 1);
    document.getElementById('layers').appendChild(item);
    item.click();
    return { calls: window.__calls, layerType: item.dataset.layerType, selected: block.classList.contains('selected') };
  }, blockId);
}

test('전제 — 레이어 아이템 모듈이 에러 없이 로드된다', async ({ page }) => {
  const errs = await boot(page);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('L1 ★Gradient 행을 누르면 «그라데이션» 진입점이 불린다 (에셋 패널이 아니라)', async ({ page }) => {
  await boot(page);
  const r = await clickLayerRowFor(page, 'grad_test');
  expect(r.layerType, '전제: 이 행은 gradient 로 렌더된다').toBe('gradient');
  const fns = r.calls.map(c => c.fn);
  expect(fns, `에셋 패널이 떴다 — 그라데이션 전용 UI 에 도달할 수 없다. calls=${JSON.stringify(r.calls)}`).not.toContain('asset');
  expect(fns).toContain('gradient');
});

test('L2 ★Sticker 행도 같은 결 — 스티커 진입점이 불린다', async ({ page }) => {
  await boot(page);
  const r = await clickLayerRowFor(page, 'stk_test');
  const fns = r.calls.map(c => c.fn);
  expect(fns, `calls=${JSON.stringify(r.calls)}`).not.toContain('asset');
  expect(fns).toContain('sticker');
});

/* ── L4·L5 ★2026-09-20 최종 통합 라운드에서 «같은 꼴»을 하나 더 찾았다 ─────────────
   L1·L2 가 닫은 것은 gradient·sticker 두 갈래였다. 그런데 최종 else 의
   `window.showAssetProperties(block)` 는 «목록에 없는 전부»를 에셋 패널로 보낸다.
   실제로 두 타입이 더 새고 있었다 — vector·step.
   ★증거가 같은 파일 안에 있었다: isVector·isStep 은 «선언은 돼 있는데»(:163·:164)
     행 이름표(type) 를 고를 때만 쓰이고 패널 분기에는 «한 번도» 안 나온다.
     즉 레이어에서 Vector/Step 행을 누르면 우측에 «에셋 패널»이 뜨고, 거기 「너비/높이」가
     실제로 먹어 그 블럭의 style 을 건드린다(gradient 에서 실측된 그 손상과 같은 길).
   ★고침은 한 줄씩이 아니라 «기계»로도 지킨다 — tests/unit/layer-panel-panel-table.test.mjs 가
     정본 표(js/panel-dispatch.js 의 _PANEL_BY_CLASS, 클릭 경로를 베낀 것)와 이 분기 사슬을 대조한다.
     ★2026-09-21 T-079 에서 그 표가 js/history.js → js/panel-dispatch.js 로 이사했다. */
test('L4 ★Vector 행을 누르면 «벡터» 패널이 뜬다 (에셋 패널이 아니라)', async ({ page }) => {
  await boot(page);
  const r = await clickLayerRowFor(page, 'vec_test');
  expect(r.layerType, '전제: 이 행은 vector 로 렌더된다').toBe('vector');
  const fns = r.calls.map(c => c.fn);
  expect(fns, `에셋 패널이 떴다 — 그 패널의 너비/높이가 벡터 블럭에 먹는다. calls=${JSON.stringify(r.calls)}`).not.toContain('asset');
  expect(fns).toContain('vector');
});

test('L5 ★Step 행도 같은 결 — 스텝 패널이 뜬다', async ({ page }) => {
  await boot(page);
  const r = await clickLayerRowFor(page, 'stp_test');
  expect(r.layerType, '전제: 이 행은 step 으로 렌더된다').toBe('step');
  const fns = r.calls.map(c => c.fn);
  expect(fns, `calls=${JSON.stringify(r.calls)}`).not.toContain('asset');
  expect(fns).toContain('step');
});

test('L3 회귀 — 진짜 에셋 행은 그대로 에셋 패널을 연다', async ({ page }) => {
  await boot(page);
  const r = await clickLayerRowFor(page, 'ab_test');
  const fns = r.calls.map(c => c.fn);
  expect(fns).toContain('asset');
  expect(fns).not.toContain('gradient');
});
