/* qa0920b-overlay-seams.dom.spec.js — 0920b 통합(int/0920b) QA 반영 회귀 그물.
 *
 * 이 파일이 지키는 것 (전부 «음성대조» 통과 — 고치기 전 빨강을 확인하고 넣었다)
 *   A1 오버레이 «이동 드래그»가 히스토리 «양쪽 끝»을 찍는다(js/drag-history.js 규약).
 *      옛 판은 push-before 단독이라 끝 표본이 없었다.
 *   A2 드래그 «뒤»에 push-after(우측 패널) 동작이 와도 ⌘Z 한 번이 «둘을 같이» 안 먹는다.
 *   A3 오버레이 «토글»도 같은 규약 — 토글 뒤 패널 동작을 ⌘Z 하면 패널 값만 돌아오고
 *      오버레이는 켜진 채 남는다(옛 판: radius 와 오버레이가 같이 풀렸다).
 *   A4 섹션 밖으로 나간 오버레이를 «다시» 드래그해도 탄성이 이중으로 걸리지 않는다
 *      (델타 0 = 제자리, 오른쪽으로 끌면 오른쪽으로 간다).
 *   A5 오버레이 리사이즈로 정한 폭을 «해제»하면 패널 값(dataset.width)과 실제 렌더 폭이
 *      같다 + 우리가 심은 메모(overlayFrozenWidth·overlayPrevWidth)가 안 남는다.
 *
 * ⛔앱을 «안» 띄운다 — 실제 js/overlay-float.js · js/drag-history.js · css/editor-blocks.css 를 그대로 먹인다.
 * 실행: npm run test:dom -- qa0920b-overlay-seams
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

/* 섹션 1개(860×400) + 흐름 텍스트프레임 1개. 줌 100% 로 둔다(좌표 계산을 단순하게). */
const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
  <link rel="stylesheet" href="/css/editor-blocks.css">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; }
    #canvas { position: relative; }
    .section-block { position: relative; width: 860px; height: 400px; background: #fff; }
    .section-inner { position: relative; padding: 0; width: 716px; margin: 0 auto; }
    .tb-body { font-size: 16px; }
  </style>
  </head><body>
  <div id="canvas">
    <div class="section-block" id="sec1">
      <div class="section-inner" id="inner1">
        <div class="frame-block" data-text-frame="true" id="tf1">
          <div class="text-block" id="tb1"><div class="tb-body">본문 텍스트</div></div>
        </div>
      </div>
    </div>
  </div>
  <script src="/js/drag-history.js"></script>
  <script>
    window.currentZoom = 100;
    window.scheduleAutoSave = () => {};
    window.triggerAutoSave = () => {};
    window.buildLayerPanel = () => {};
    window._findSectionAt = () => null;

    /* ── 히스토리 «축소 모형» — js/history.js 와 같은 규약만 흉내낸다:
         · pushHistory 는 «지금 살아있는 캔버스»를 찍는다
         · 꼭대기와 같은 상태면 안 쌓는다(무변화 중복 차단)
         · undo = 한 칸 앞 표본으로 되돌린다 */
    window.__stack = [];
    window.__pos = -1;
    window.pushHistory = (action) => {
      const html = document.getElementById('canvas').innerHTML;
      const top = window.__stack[window.__pos];
      if (top && top.html === html) return;
      window.__stack = window.__stack.slice(0, window.__pos + 1);
      window.__stack.push({ html, action: action || '작업' });
      window.__pos++;
    };
    window.getHistoryTip = () => window.__stack[window.__pos] || null;
    window.__undo = () => {
      if (window.__pos <= 0) return false;
      window.__pos--;
      document.getElementById('canvas').innerHTML = window.__stack[window.__pos].html;
      return true;
    };
  </script>
  <script type="module">
    import { posElOf, isFloat, enterFloat, exitFloat, bindFloatMoveDrag, wireFloatToggle } from '/js/overlay-float.js';
    window.__OF = { posElOf, isFloat, enterFloat, exitFloat, bindFloatMoveDrag, wireFloatToggle };
    window._bindOverlayMoveDrag = bindFloatMoveDrag;
    window.__ready = true;
  </script>
  </body></html>`;

async function open(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html; charset=utf-8', body: HARNESS });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
}

/** 화면 좌표로 드래그 한 번 (mousedown → mousemove … → mouseup). */
async function dragBy(page, id, steps) {
  await page.evaluate(({ id, steps }) => {
    const el = document.getElementById(id);
    const r = el.getBoundingClientRect();
    const sx = Math.round(r.left + r.width / 2), sy = Math.round(r.top + r.height / 2);
    const fire = (type, x, y) => {
      const ev = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
      (type === 'mousedown' ? el : document).dispatchEvent(ev);
    };
    fire('mousedown', sx, sy);
    steps.forEach(([dx, dy]) => fire('mousemove', sx + dx, sy + dy));
    fire('mouseup', sx + steps[steps.length - 1][0], sy + steps[steps.length - 1][1]);
  }, { id, steps });
}

test('A1 오버레이 이동 드래그는 히스토리 «양쪽 끝»을 찍는다 (끝 표본이 있다)', async ({ page }) => {
  await open(page);
  const out = await page.evaluate(() => {
    const tf = document.getElementById('tf1');
    window.pushHistory('텍스트 추가');           // 앞 이웃 = push-before 삽입류
    window.__OF.enterFloat(tf);
    window.__OF.bindFloatMoveDrag(tf);
    return { before: window.__stack.length };
  });
  await dragBy(page, 'tf1', [[10, 0], [60, 20]]);
  const after = await page.evaluate(() => {
    const tf = document.getElementById('tf1');
    return {
      n: window.__stack.length,
      tipHasMovedPos: window.__stack[window.__pos].html.includes('data-offset-x="' + tf.dataset.offsetX + '"'),
      offsetX: tf.dataset.offsetX,
    };
  });
  // 시작 표본 + 끝 표본 = 최소 2칸이 늘어야 한다(옛 판은 1칸 = 시작만).
  expect(after.n - out.before).toBeGreaterThanOrEqual(2);
  // 꼭대기 표본이 «드래그가 끝난 자리»를 담고 있어야 한다.
  expect(after.tipHasMovedPos).toBe(true);
});

test('A2 드래그 뒤 우측패널(push-after) 동작 → ⌘Z 한 번이 둘을 같이 먹지 않는다', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const tf = document.getElementById('tf1');
    window.pushHistory('텍스트 추가');
    window.__OF.enterFloat(tf);
    window.__OF.bindFloatMoveDrag(tf);
  });
  await dragBy(page, 'tf1', [[10, 0], [60, 20]]);
  const res = await page.evaluate(() => {
    const tf = document.getElementById('tf1');
    const movedX = tf.dataset.offsetX, movedY = tf.dataset.offsetY;
    // 우측 패널류(push-after) — 폭을 바꾸고 «뒤»에 찍는다
    tf.style.width = '300px'; tf.dataset.width = '300';
    window.pushHistory('텍스트 너비');
    window.__undo();
    const after = document.getElementById('tf1');
    return {
      movedX, movedY,
      undoX: after.dataset.offsetX, undoY: after.dataset.offsetY,
      undoWidth: after.dataset.width || '',
    };
  });
  expect(res.undoWidth).not.toBe('300');      // 패널 동작은 되돌아갔고
  expect(res.undoX).toBe(res.movedX);         // 드래그한 «자리»는 그대로 남아야 한다
  expect(res.undoY).toBe(res.movedY);
});

test('A3 오버레이 토글 뒤 패널 동작 → ⌘Z 는 패널 값만 되돌린다(오버레이는 켜진 채)', async ({ page }) => {
  await open(page);
  const res = await page.evaluate(() => {
    const tf = document.getElementById('tf1');
    const tb = document.getElementById('tb1');
    // 패널 토글 버튼 배선 — 실제 wireFloatToggle 을 쓴다
    const btn = document.createElement('button');
    btn.id = 'txt-overlay-toggle';
    document.body.appendChild(btn);
    window.pushHistory('텍스트 추가');
    window.__OF.wireFloatToggle({ block: tb, buttonId: 'txt-overlay-toggle' });
    btn.click();                                   // 오버레이 ON
    const onAfterToggle = tf.dataset.overlayBlock === 'true';
    // 우측 패널(push-after) — 라운드값 변경
    tb.style.borderRadius = '24px';
    window.pushHistory('모서리');
    window.__undo();
    const tf2 = document.getElementById('tf1');
    return {
      onAfterToggle,
      undoRadius: (document.getElementById('tb1') || {}).style?.borderRadius || '',
      undoOverlay: tf2 ? tf2.dataset.overlayBlock === 'true' : false,
    };
  });
  expect(res.onAfterToggle).toBe(true);
  expect(res.undoRadius).not.toBe('24px');   // 패널 값은 되돌아가고
  expect(res.undoOverlay).toBe(true);        // 오버레이는 «안» 풀려야 한다
});

test('A4 섹션 밖 오버레이를 다시 드래그해도 탄성이 이중으로 걸리지 않는다', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const tf = document.getElementById('tf1');
    window.__OF.enterFloat(tf);
    window.__OF.bindFloatMoveDrag(tf);
    // 섹션 밖(오른쪽)으로 이미 나가 있는 상태를 «저장본에서 열린 직후»처럼 만든다
    tf.dataset.offsetX = '914'; tf.dataset.offsetY = '0';
    tf.style.left = '914px'; tf.style.top = '0px';
  });
  /* ⑴ 끌었다가 «제자리»로 놓으면 자리가 그대로여야 한다.
       옛 판: 저장된 914 를 raw 로 다시 넣어 탄성이 한 번 더 걸려 885 로 되감겼다. */
  await dragBy(page, 'tf1', [[10, 0], [0, 0]]);
  const still = await page.evaluate(() => Number(document.getElementById('tf1').dataset.offsetX));
  expect(still).toBe(914);
  /* ⑵ 저항구간(zone)을 한참 지난 자리에서는 1:1 로 움직인다 — 오른쪽 40px = 정확히 +40.
       옛 판은 «되감김 29.5px» 이 매번 먹혀 +10 밖에 안 갔다(줌 40% 실사용에서는 아예 뒤로 갔다). */
  await dragBy(page, 'tf1', [[10, 0], [40, 0]]);
  const moved = await page.evaluate(() => Number(document.getElementById('tf1').dataset.offsetX));
  expect(moved).toBe(954);
});

/* ★★이 검사는 «재진입»을 실제로 밟는데도 T-068 의 재진입 결함을 못 잡았다 (2026-09-22 기록).
     까닭 둘 — 다음 사람이 「A5 가 그 축을 덮는다」고 읽지 않도록 남긴다:
   ⑴ **재는 양이 다르다.** 아래는 `style.width`(=«사용자의 뜻»)만 본다. 결함은 CSS
      `.frame-block{max-width:100%}` 가 «화면»을 깎는 것이라 `style.width` 는 큰 값을 그대로
      들고 있다 ⇒ 그 상태에서도 초록이다. 화면을 보려면 `getComputedStyle(...).width` 를
      재야 한다(그 꼴은 tests/dom/text-overlay-resize.dom.spec.js D8·D16 에 있다).
   ⑵ **숫자가 결함에 못 닿는다.** 이 하네스는 섹션 860 / inner 716 인데 폭을 811 로 준다.
      811 < 860 이라 «섹션 폭 캡»에 애초에 안 걸린다. 결함은 폭이 섹션을 «넘을 때»만 보인다.
   ⇒ 재진입 폭 축은 D16(유지) · D17(음성대조)이 맡는다. 여기는 «메모 잔류 0» 이 일이다. */
test('A5 오버레이 리사이즈 폭 → 해제해도 우리가 심은 메모가 안 남는다(재진입이 폭을 안 덮는다)', async ({ page }) => {
  await open(page);
  const res = await page.evaluate(() => {
    const tf = document.getElementById('tf1');
    window.__OF.enterFloat(tf);
    /* overlay-handles.js _onTextOverlayResizeMouseDown 가 남기는 «그 상태»를 그대로 만든다:
       폭의 주인이 사용자가 되고(도장 떼기) 섹션 폭 캡(maxWidth)도 풀린다. */
    tf.style.width = '811px';
    tf.dataset.width = '811';
    delete tf.dataset.overlayIntroducedWidth;
    tf.style.maxWidth = 'none';
    tf.dataset.overlayFreeWidth = 'true';
    window.__OF.exitFloat(tf);
    const afterExit = {
      frozen: tf.dataset.overlayFrozenWidth || '',
      prev: tf.dataset.overlayPrevWidth || '',
      introduced: tf.dataset.overlayIntroducedWidth || '',
      styleW: tf.style.width,
      panel: tf.dataset.width || '',
    };
    // 다시 켠다 — 옛 판은 메모가 남아 있어 _freezeWidth 가 조용히 어긋난 값을 들고 있었다
    window.__OF.enterFloat(tf);
    return {
      afterExit,
      reFrozen: tf.dataset.overlayFrozenWidth || '',
      reStyleW: tf.style.width,
      rePanel: tf.dataset.width || '',
    };
  });
  // ★메모 잔류 0 — 해제는 «우리가 심은 것»을 남기지 않는다
  expect(res.afterExit.frozen).toBe('');
  expect(res.afterExit.prev).toBe('');
  expect(res.afterExit.introduced).toBe('');
  // ★사용자가 정한 폭은 남는다(현빈 2026-09-20 결정 — D7 과 같은 뜻)
  expect(res.afterExit.styleW).toBe('811px');
  expect(res.afterExit.panel).toBe('811');
  // ★다시 켜도 그 폭 그대로 — 재진입이 옛 메모를 들고 오지 않는다
  expect(res.reStyleW).toBe('811px');
  expect(res.rePanel).toBe('811');
  expect(res.reFrozen).toBe('');
});
