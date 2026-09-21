/* select-block-submarks.dom.spec.js — 「블럭을 넣은 «그 순간» 파란 표시가 «새 블럭 하나»뿐인가」. (2026-09-21 T-084 신설)
 *
 * ★왜 필요한가 — «사용자 관점 훑기»(0920) T-084
 *   「배너 안의 한 줄을 고른 다음 아래 도구막대로 블럭을 하나 더 넣었더니,
 *    파란 테두리가 «아까 만진 배너 줄»에 그대로 남아 있습니다 — 지금 뭘 고치는 중인지 모르겠어요.」
 *   뿌리는 배너가 아니라 «선택 해제가 두 벌»이었다는 것이다.
 *   js/editor.js 의 deselectAll 은 부가 마커(.bn2-line-selected · 그리드 줄/칸 · 스텝 ·
 *   .item-selected · .cell-selected · .row-active · 레이어 패널 .active)를 전부 알았지만,
 *   삽입·MCP·점검점프가 쓰는 js/block-edit.js 의 selectBlock 은 `.selected` «한 클래스»만 벗겼다.
 *
 * ★음성대조(고침을 되돌렸을 때) — 아래 세 검사가 실제로 빨강이 되는지 돌려서 확인할 것.
 *   ⑴ selectBlock 의 `window.clearSelectionMarks()` 를 옛 `.selected` 일괄 제거로 되돌리면 → 1 빨강
 *   ⑵ selectBlock 의 `window.highlightBlock?.(block, block._layerItem)` 을 지우면 → 2 빨강
 *   ⑶ clearSelectionMarks 끝의 «성질 판정»(.selected 일괄 제거)을 지우면 → 3 빨강
 *
 * ⛔앱을 «안» 띄운다 — 레포 파일만 크로미움에 얹는다(panel-route-on-add.dom.spec.js 하네스 복제).
 * ⛔사본을 두지 않는다 — clearSelectionMarks / highlightBlock 은 «실물 소스»에서 중괄호 균형으로 떠 온다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js select-block-submarks
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

/** 실물 소스에서 함수 하나를 중괄호 균형으로 떠 온다(사본을 두지 않기 위함). */
function extractFn(src, name) {
  const m = new RegExp('function\\s+' + name + '\\s*\\(').exec(src);
  if (!m) throw new Error('★함수를 못 찾았다: ' + name + ' — 이름이 바뀌었으면 이 검사부터 고쳐라');
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

const EDITOR_SRC = fs.readFileSync(path.join(REPO, 'js/editor.js'), 'utf8');
const LAYER_SRC  = fs.readFileSync(path.join(REPO, 'js/panels/layer-panel.js'), 'utf8');
const PROPBN2_SRC = fs.readFileSync(path.join(REPO, 'js/props/prop-banner02.js'), 'utf8');

const SHIM = `
  var canvasEl = document.getElementById('canvas');
  function _setAttrIfChanged(el, name, value) { if (el.getAttribute(name) !== value) el.setAttribute(name, value); }
  ${extractFn(EDITOR_SRC, 'clearSelectionMarks')}
  ${extractFn(LAYER_SRC, 'highlightBlock')}
  window.clearSelectionMarks = clearSelectionMarks;
  window.highlightBlock = highlightBlock;
`;

const HARNESS = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">
<div id="canvas">
  <div class="section-block selected"><div class="section-inner" id="host">
    <div class="row">
      <div class="banner02-block" id="bn2_1" data-type="banner02">
        <div class="bn2-label" data-line-idx="0">라벨</div>
        <div class="bn2-title bn2-line-selected" data-line-idx="1">제목</div>
      </div>
    </div>
    <div class="row"><div class="gradient-block" id="grad_1" data-type="gradient"></div></div>
    <div class="row"><div class="divider-block" id="dvd_1" data-type="divider"></div></div>
  </div></div>
</div>
<div id="layer-panel-body">
  <div class="layer-item active" id="li_bn2">Banner</div>
  <div class="layer-item" id="li_dvd">Divider</div>
</div>
<script>${SHIM}</script>
<!-- ★정본 패널 디스패치를 block-edit.js «앞»에 얹는다(U-DISPATCH-6 계약).
     스텁을 쓰면 selectBlock 이 패널을 «못 열고도» 초록이 된다. -->
<script src="/js/panel-dispatch.js"></script>
<script src="/js/block-edit.js"></script>
<script>
  document.getElementById('bn2_1')._layerItem = document.getElementById('li_bn2');
  document.getElementById('dvd_1')._layerItem = document.getElementById('li_dvd');
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
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

test('D-SELMARK-0 ★고정 장치가 «실제» 마커 이름을 쓴다 (이름이 바뀌면 검사가 조용히 참이 된다)', () => {
  expect(PROPBN2_SRC).toContain('bn2-line-selected');
  expect(HARNESS).toContain('bn2-line-selected');
});

test('D-SELMARK-1 ★새 블럭을 고르면 배너 «줄» 표시가 남지 않는다 (파란 상자가 둘이 되던 그 결함)', async ({ page }) => {
  const errs = await boot(page);
  const got = await page.evaluate(() => {
    const before = document.querySelectorAll('.bn2-line-selected').length;
    // addDividerBlock 이 삽입 직후에 하는 «그 한 줄»
    const ok = window.selectBlock('dvd_1');
    return {
      ok, before,
      after: document.querySelectorAll('.bn2-line-selected').length,
      selected: [...document.querySelectorAll('#canvas .selected')].map(e => e.id || e.className),
    };
  });
  expect(errs).toEqual([]);
  expect(got.ok).toBe(true);
  expect(got.before).toBe(1);          // 전제: 고르기 «전»엔 배너 줄 표시가 있었다
  expect(got.after).toBe(0);           // ★음성대조 지점 ⑴
  expect(got.selected).toEqual(['dvd_1']);
});

test('D-SELMARK-2 ★좌측 레이어 패널의 «지금 이것» 표시도 새 블럭으로 옮겨간다', async ({ page }) => {
  const errs = await boot(page);
  const got = await page.evaluate(() => {
    window.selectBlock('dvd_1');
    return [...document.querySelectorAll('#layer-panel-body .layer-item.active')].map(e => e.id);
  });
  expect(errs).toEqual([]);
  expect(got).toEqual(['li_dvd']);     // ★음성대조 지점 ⑵ (고치기 전 = [] — 아무 데도 강조가 없었다)
});

test('D-SELMARK-3 ★«열거에 없는» 타입도 선택을 잃는다 (성질로 판정하는지 = 목록이 낡아도 안 새는지)', async ({ page }) => {
  const errs = await boot(page);
  const got = await page.evaluate(() => {
    /* .gradient-block 은 clearSelectionMarks 안의 «타입 열거»에 없다.
       열거가 정본이면 여기서 선택이 남는다 = 새 블록 타입이 생길 때마다 조용히 새는 구조. */
    document.getElementById('grad_1').classList.add('selected');
    window.selectBlock('dvd_1');
    return {
      gradStill: document.getElementById('grad_1').classList.contains('selected'),
      secStill: document.querySelector('.section-block').classList.contains('selected'),
    };
  });
  expect(errs).toEqual([]);
  expect(got.gradStill).toBe(false);   // ★음성대조 지점 ⑶
  expect(got.secStill).toBe(false);
});
