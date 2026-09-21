/* overlay-drag-mouseup-selection.dom.spec.js — 「오버레이를 끌고 놓으면 선택이 풀린다」
 * (2026-09-21 마무리 라운드, 수리공 유닛 ②)
 *
 * ★현빈/QA 신고는 «간헐(9회 중 2회)»이었는데, 실앱 실측(9516, 40% 줌)에서 조건을 가르니
 *   간헐이 아니라 «조건부 100%»였다:
 *     - 마우스업이 «블럭 위»에서 끝나면        → 선택 유지 (실측 20/20, 10/10)
 *     - 마우스업이 «섹션 밖 캔버스 배경» 위면  → 선택 «전부» 풀림 (실측 12/12)
 *   뿌리 = 드래그 «뒤»에 브라우저가 누름·놓음의 «공통 조상»에서 click 을 새로 합성하는데,
 *   오버레이는 현빈 결정으로 섹션 밖까지 나갈 수 있어(2026-09-20) 놓는 자리가 자주
 *   #canvas-wrap 이 된다. 거기 달린 핸들러가 곧바로 deselectAll() 한다
 *   (js/editor.js — `if (['canvas-wrap','canvas-scaler','canvas'].includes(e.target.id)) deselectAll()`).
 *   실사용에서 «2/9» 로 보인 건 놓는 자리가 그때그때 달랐기 때문이다.
 *
 * ★고치는 꼴은 레포 선례 그대로 — 끈 «뒤»의 합성 click 만 삼킨다
 *   (js/block-drag.js:409 도형 손잡이 · js/blocks/mockup-block.js:190). «끈 적 없으면»
 *   (제자리 클릭) 안 삼킨다 — 그건 선택 동작이다.
 *
 * ⛔앱을 «안» 띄운다 — js/overlay-float.js 를 실제 ES 모듈로 로드하고 진짜 마우스로 돌린다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js overlay-drag-mouseup-selection
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const FILES = {
  '/overlay-float.js': 'js/overlay-float.js',
  '/frame-geometry.js': 'js/frame-geometry.js',
  '/shape-frame.js': 'js/shape-frame.js',
};

/* 앱의 캔버스 배경 규약을 «그대로» 옮겨 둔다 — js/editor.js 의 canvas-wrap click 핸들러.
   (이 검사는 오버레이 쪽 고침만 잰다. 배경 규약 자체는 앱 그대로여야 뜻이 있다.) */
async function boot(page, { killClickRegression = false } = {}) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html><head><meta charset="utf-8"><style>
          * { box-sizing: border-box; } body { margin:0; }
          #canvas-wrap { position:relative; width:900px; height:700px; background:#555; }
          .section-block { position:relative; width:800px; height:200px; background:#fff; }
          .frame-block[data-text-frame="true"] { position:absolute; width:300px; height:40px;
            transform-origin:center center; background:rgba(0,0,255,.15); }
        </style>
        <script type="module">
          import { bindFloatMoveDrag } from '/overlay-float.js';
          window._bindOverlayMoveDrag = bindFloatMoveDrag;
        </script>
        </head><body>
        <div id="canvas-wrap">
          <div class="section-block" id="sec1">
            <div class="frame-block" data-text-frame="true" data-overlay-block="true" id="tf1"
                 style="left:0px; top:20px;">
              <div class="tb-h2 selected" contenteditable="false" id="txt1" style="width:100%;height:100%;">텍스트</div>
            </div>
          </div>
        </div>
        <script>
          window.currentZoom = 100;
          window.pushHistory = () => {};
          window.scheduleAutoSave = () => {};
          window.triggerAutoSave = () => {};
          window._findSectionAt = () => null;
          window.__deselects = 0;
          function deselectAll() {
            window.__deselects++;
            document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
          }
          document.getElementById('canvas-wrap').addEventListener('click', e => {
            if (['canvas-wrap','canvas-scaler','canvas'].includes(e.target.id)) deselectAll();
          });
          ${killClickRegression ? `
          // ★양성대조 — 고침 «전» 배선을 흉내낸다: ⑴끈 뒤의 합성 click 을 «안» 삼키고
          //   ⑵섹션 밖에서는 탄성으로 뒤처진다(원본 _elasticClampToSection 의 손맛 — 여기선
          //   델타의 절반만 따라가는 것으로 단순화). 뒤처짐이 있어야 마우스업 지점이 블럭
          //   «밖»(=캔버스 배경)이 되어 이 병이 재현된다 — 1:1 로 따라가면 커서가 늘 블럭
          //   위라 배경 click 이 아예 안 난다(이 양성대조를 처음 짤 때 밟은 함정).
          const posEl = document.getElementById('tf1');
          posEl.addEventListener('mousedown', e => {
            const sl = parseFloat(posEl.style.left)||0, st = parseFloat(posEl.style.top)||0;
            const sx = e.clientX, sy = e.clientY;
            const onMove = ev => { posEl.style.left = (sl+(ev.clientX-sx)*0.5)+'px'; posEl.style.top = (st+(ev.clientY-sy)*0.5)+'px'; };
            const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
          }, true);
          ` : ''}
        </script>
        </body></html>`,
      });
    }
    const f = FILES[url.pathname];
    if (f) return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(REPO, f), 'utf8') });
    return route.fulfill({ status: 404, body: '' });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  if (!killClickRegression) {
    await page.waitForFunction(() => !!window._bindOverlayMoveDrag);
    await page.evaluate(() => window._bindOverlayMoveDrag(document.getElementById('tf1')));
  }
  return errs;
}

async function dragTo(page, x2, y2) {
  const c = await page.evaluate(() => {
    const r = document.getElementById('tf1').getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move((c.x + x2) / 2, (c.y + y2) / 2);
  await page.mouse.move(x2, y2);
  await page.mouse.up();
}

const selCount = (page) => page.evaluate(() => document.querySelectorAll('.selected').length);

test('전제 — bindFloatMoveDrag 가 로드된다', async ({ page }) => {
  const errs = await boot(page);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('S1 ★섹션 밖(캔버스 배경)에서 놓아도 선택이 안 풀린다', async ({ page }) => {
  await boot(page);
  expect(await selCount(page), '전제: 시작 시 선택 1개').toBe(1);
  await dragTo(page, 450, 500);            // 섹션(높이 200) 한참 아래 = #canvas-wrap 배경
  expect(await page.evaluate(() => document.elementFromPoint(450, 500)?.id),
    '전제: 놓는 자리가 정말 캔버스 배경인가').toBe('canvas-wrap');
  expect(await selCount(page), '마우스업에 선택이 풀렸다(합성 click → deselectAll)').toBe(1);
  expect(await page.evaluate(() => window.__deselects), 'deselectAll 이 불렸다').toBe(0);
});

test('S2 양성대조 — 삼키는 가드가 없으면 같은 드래그에서 선택이 «풀린다»', async ({ page }) => {
  await boot(page, { killClickRegression: true });
  expect(await selCount(page)).toBe(1);
  await dragTo(page, 450, 500);
  expect(await selCount(page), '양성대조가 안 터졌다 — 이 검사가 뭘 재는지 다시 봐라').toBe(0);
  expect(await page.evaluate(() => window.__deselects)).toBeGreaterThan(0);
});

test('S3 «끈 적 없는» 제자리 클릭은 삼키지 않는다(선택 동작 보존)', async ({ page }) => {
  await boot(page);
  const c = await page.evaluate(() => {
    const r = document.getElementById('tf1').getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  let got = 0;
  await page.exposeFunction('__note', () => { got++; });
  await page.evaluate(() => document.getElementById('tf1').addEventListener('click', () => window.__note()));
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(50);
  expect(got, '제자리 클릭까지 삼켰다 — 블럭을 «누르는» 동작이 죽는다').toBe(1);
});

test('S4 섹션 «안»에서 놓는 기존 동작은 그대로(회귀 금지선)', async ({ page }) => {
  await boot(page);
  await dragTo(page, 300, 60);             // 섹션 안
  expect(await selCount(page)).toBe(1);
  expect(await page.evaluate(() => window.__deselects)).toBe(0);
});
