/* overlay-exit-drop-height.dom.spec.js — T-037 ㉗ (현빈 결정 2026-09-22):
 * 「오버레이를 다른 섹션으로 옮긴 뒤 풀면 «놓은 높이에 맞는 자리»에 들어간다.」
 *
 * ★그 전(2026-09-16)에는 target.prepend = «무조건 맨 위»였다. 그건 설계가 아니라
 *   응급처치였다(그보다 전엔 «처음 섹션»으로 순간이동하는 더 나쁜 버그).
 * ★위로 한참 벗어나게 놓으면 여전히 맨 위다 — 달라지는 것은 «중간·아래»뿐이다.
 * ⛔여백(.gap-block)은 기준에서 뺀다 — 여백과 여백 사이엔 안 들어간다.
 *
 * ⛔앱을 «안» 띄운다 — 고디터 인스턴스·MCP 9345 대역 무접촉. 실제 ES 모듈
 *   (prop-text-wireup-overlay.js → overlay-float.js)을 그대로 실어 진짜 버튼 핸들러를 돌린다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js overlay-exit-drop-height
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const OVERLAY_JS = fs.readFileSync(path.join(REPO, 'js/props/prop-text-wireup-overlay.js'), 'utf8');
const FRAME_GEOMETRY_JS = fs.readFileSync(path.join(REPO, 'js/frame-geometry.js'), 'utf8');
const OVERLAY_FLOAT_JS = fs.readFileSync(path.join(REPO, 'js/overlay-float.js'), 'utf8');
const SHAPE_FRAME_JS = fs.readFileSync(path.join(REPO, 'js/shape-frame.js'), 'utf8');

/* ── 골격 (화면 좌표 — body margin 0, 스크롤 없음) ────────────────────────
   secA  y    0 ~  300
   secB  y  300 ~  900   ← innerB 가 y=300 에서 시작한다
     idx0 gap  300~340            idx1 B1  340~440 (중심 390)
     idx2 gap  440~480            idx3 B2  480~580 (중심 530)
     idx4 gap  580~620            idx5 B3  620~720 (중심 670)
   오버레이 블럭 tf1 은 높이 40 ⇒ secB 안 top=T 로 두면 중심 = 300 + T + 20.      */
const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; }
    .section-block { position: relative; width: 800px; background: #fff; }
    #secA { height: 300px; }
    #secB { height: 600px; }
    .blk { height: 100px; background: #eef; }
    .gap-block { height: 40px; }
  </style>
  <script type="module">
    import { wireOverlaySection } from '/props/overlay-wireup.js';
    window.__wireOverlaySection = wireOverlaySection;
  </script>
  </head><body>
  <button id="txt-overlay-toggle" style="display:none;"></button>
  <div class="section-block" id="secA">
    <div class="section-inner" id="innerA">
      <div class="gap-block" data-type="gap" id="a_g0"></div>
      <div class="blk text-block" id="a_b1"></div>
      <div class="gap-block" data-type="gap" id="a_g1"></div>
      <div class="frame-block" data-text-frame="true" id="tf1"
           style="position:relative; width:200px; height:40px; background:rgba(0,0,255,0.15);">
        <div class="tb-h2" id="tb1" contenteditable="false" style="width:100%;height:100%;">텍스트</div>
      </div>
      <div class="gap-block" data-type="gap" id="a_g2"></div>
      <div class="blk text-block" id="a_b2"></div>
    </div>
  </div>
  <div class="section-block" id="secB">
    <div class="section-inner" id="innerB">
      <div class="gap-block" data-type="gap" id="b_g0"></div>
      <div class="blk text-block" id="b_b1"></div>
      <div class="gap-block" data-type="gap" id="b_g1"></div>
      <div class="blk asset-block" id="b_b2"></div>
      <div class="gap-block" data-type="gap" id="b_g2"></div>
      <div class="blk text-block" id="b_b3"></div>
    </div>
  </div>
  <script>
    window.currentZoom = 100;
    window.pushHistory = () => {};
    window.scheduleAutoSave = () => {};
    window.triggerAutoSave = () => {};
    window.buildLayerPanel = () => {};
    window.showTextProperties = () => {};
    window._bindOverlayMoveDrag = () => {}; // 이 스펙은 진입/이탈만 잰다 — 드래그는 별도 스펙
  </script>
  </body></html>`;

async function boot(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') {
      return route.fulfill({ contentType: 'text/html', body: HARNESS });
    }
    if (url.pathname === '/props/overlay-wireup.js') {
      return route.fulfill({ contentType: 'application/javascript', body: OVERLAY_JS });
    }
    if (url.pathname === '/frame-geometry.js') {
      return route.fulfill({ contentType: 'application/javascript', body: FRAME_GEOMETRY_JS });
    }
    if (url.pathname === '/overlay-float.js') {
      return route.fulfill({ contentType: 'application/javascript', body: OVERLAY_FLOAT_JS });
    }
    if (url.pathname === '/shape-frame.js') {
      return route.fulfill({ contentType: 'application/javascript', body: SHAPE_FRAME_JS });
    }
    return route.fulfill({ status: 404, body: '' });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => !!window.__wireOverlaySection);
  await page.evaluate(() => window.__wireOverlaySection({ tb: document.getElementById('tb1') }));
  return errs;
}

/* 오버레이 진입 → secB 로 재부모 → secB 안 top=T 에 놓기 → 해제.
   돌려주는 값: 들어간 부모·인덱스 + 「놓은 높이」로 실제로 잰 블럭 중심 y. */
async function dropAt(page, topInSecB) {
  await page.evaluate(() => document.getElementById('txt-overlay-toggle').click()); // 진입(secA)
  return await page.evaluate((T) => {
    const f = document.getElementById('tf1');
    document.getElementById('secB').appendChild(f);   // 드래그로 옮긴 상태를 흉내
    f.dataset.offsetX = '20'; f.dataset.offsetY = String(T);
    f.style.left = '20px';   f.style.top = T + 'px';
    const r = f.getBoundingClientRect();
    const droppedCenterY = r.top + r.height / 2;
    document.getElementById('txt-overlay-toggle').click();  // 해제
    const parent = f.parentElement;
    return {
      parentId: parent.id,
      index: [...parent.children].indexOf(f),
      ids: [...parent.children].map(c => c.id),
      droppedCenterY,
    };
  }, topInSecB);
}

test('전제 — 모듈이 실제로 로드되고, secB 형제들의 중심 y 가 설계대로다', async ({ page }) => {
  const errs = await boot(page);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
  const centers = await page.evaluate(() =>
    [...document.getElementById('innerB').children].map(c => {
      const r = c.getBoundingClientRect();
      return { id: c.id, center: r.top + r.height / 2 };
    }));
  expect(centers.map(c => c.id)).toEqual(['b_g0', 'b_b1', 'b_g1', 'b_b2', 'b_g2', 'b_b3']);
  expect(centers.map(c => c.center)).toEqual([320, 390, 460, 530, 600, 670]);
});

/* ══ 자리 표 — 놓은 높이 → 들어간 인덱스 ═══════════════════════════════════ */

test('D1 «위»(중심 320 — 첫 블럭 b_b1 중심 390 보다 위)에 놓으면 맨 위(0)', async ({ page }) => {
  await boot(page);
  const r = await dropAt(page, 0);
  expect(r.droppedCenterY).toBe(320);
  expect(r.parentId).toBe('innerB');
  expect(r.index, `자리=${r.index} · 순서=${r.ids.join(',')}`).toBe(0);
});

test('D2 «중간»(중심 460 — b_b1 390 과 b_b2 530 사이)에 놓으면 b_b2 앞(3)', async ({ page }) => {
  await boot(page);
  const r = await dropAt(page, 140);
  expect(r.droppedCenterY).toBe(460);
  expect(r.parentId).toBe('innerB');
  expect(r.index, `자리=${r.index} · 순서=${r.ids.join(',')}`).toBe(3);
  expect(r.ids[2]).toBe('b_g1');  // ★여백 «뒤»에 들어간다 — 여백과 여백 사이가 아니다
  expect(r.ids[4]).toBe('b_b2');
});

test('D3 «중간 아래»(중심 600 — b_b2 530 과 b_b3 670 사이)에 놓으면 b_b3 앞(5)', async ({ page }) => {
  await boot(page);
  const r = await dropAt(page, 280);
  expect(r.droppedCenterY).toBe(600);
  expect(r.index, `자리=${r.index} · 순서=${r.ids.join(',')}`).toBe(5);
});

test('D4 «아래»(중심 700 — 마지막 블럭 b_b3 670 보다 아래)에 놓으면 맨 아래(6)', async ({ page }) => {
  await boot(page);
  const r = await dropAt(page, 380);
  expect(r.droppedCenterY).toBe(700);
  expect(r.index, `자리=${r.index} · 순서=${r.ids.join(',')}`).toBe(6);
});

/* ══ 경계 밖 ═══════════════════════════════════════════════════════════════ */

test('D5 [경계] 섹션 첫 블럭보다 «한참 위»(중심 120, secB 밖)에 놓아도 맨 위(0) — 옛 동작 유지', async ({ page }) => {
  await boot(page);
  const r = await dropAt(page, -200);
  expect(r.droppedCenterY).toBe(120);
  expect(r.index, `자리=${r.index} · 순서=${r.ids.join(',')}`).toBe(0);
});

test('D6 [경계] 마지막 블럭보다 «한참 아래»(중심 880)에 놓으면 맨 아래(6)', async ({ page }) => {
  await boot(page);
  const r = await dropAt(page, 560);
  expect(r.droppedCenterY).toBe(880);
  expect(r.index, `자리=${r.index} · 순서=${r.ids.join(',')}`).toBe(6);
});

/* ══ ⛔회귀 — 같은 섹션 규칙(㉘)을 깨지 않는다 ════════════════════════════ */

test('R1 ★같은 섹션에서 켰다 끄면 «원래 정확한 자리»(innerA 의 3번)로 복귀한다 — 높이 산식이 끼어들지 않는다', async ({ page }) => {
  await boot(page);
  const before = await page.evaluate(() => {
    const f = document.getElementById('tf1');
    return { parentId: f.parentElement.id, index: [...f.parentElement.children].indexOf(f) };
  });
  expect(before).toEqual({ parentId: 'innerA', index: 3 });
  await page.evaluate(() => document.getElementById('txt-overlay-toggle').click()); // 진입
  await page.evaluate(() => document.getElementById('txt-overlay-toggle').click()); // 이탈(안 옮김)
  const after = await page.evaluate(() => {
    const f = document.getElementById('tf1');
    return { parentId: f.parentElement.id, index: [...f.parentElement.children].indexOf(f), ids: [...f.parentElement.children].map(c => c.id) };
  });
  expect(after.parentId).toBe('innerA');
  expect(after.index, `원래 3번이었는데 ${after.index}번에 들어갔다 · 순서=${after.ids.join(',')}`).toBe(3);
});

test('R2 ★같은 섹션 안에서 «높이만» 바꿔 놓아도 원래 자리(3번)로 복귀한다 — 같은 섹션은 기억이 이긴다', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => document.getElementById('txt-overlay-toggle').click()); // 진입
  await page.evaluate(() => {
    // 같은 섹션 안에서 맨 위로 끌어올린 상황(기억이 있으니 높이는 안 본다)
    const f = document.getElementById('tf1');
    f.style.top = '0px'; f.dataset.offsetY = '0';
  });
  await page.evaluate(() => document.getElementById('txt-overlay-toggle').click()); // 이탈
  const after = await page.evaluate(() => {
    const f = document.getElementById('tf1');
    return { parentId: f.parentElement.id, index: [...f.parentElement.children].indexOf(f) };
  });
  expect(after, '같은 섹션인데 원래 자리(innerA 3번)로 안 돌아갔다').toEqual({ parentId: 'innerA', index: 3 });
});

test('R3 ★T-037 ㉖ — 다른 섹션으로 옮긴 뒤 해제하면 «지금 섹션»(innerB)에 들어간다(처음 섹션 아님)', async ({ page }) => {
  await boot(page);
  const r = await dropAt(page, 140);
  expect(r.parentId, `처음 섹션으로 순간이동했다: ${r.parentId}`).toBe('innerB');
});

test('R4 다른 섹션으로 갔다가 «원래 섹션»으로 되돌아온 뒤 해제 — 원래 자리(3번)로 복귀한다', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => document.getElementById('txt-overlay-toggle').click()); // 진입
  await page.evaluate(() => {
    document.getElementById('secB').appendChild(document.getElementById('tf1'));
    document.getElementById('secA').appendChild(document.getElementById('tf1'));
  });
  await page.evaluate(() => document.getElementById('txt-overlay-toggle').click()); // 이탈
  const after = await page.evaluate(() => {
    const f = document.getElementById('tf1');
    return { parentId: f.parentElement.id, index: [...f.parentElement.children].indexOf(f) };
  });
  expect(after).toEqual({ parentId: 'innerA', index: 3 });
});

/* ══ 양성대조 — 옛 산식(무조건 prepend)이었다면 D2·D4 가 빨강이다 ══════════ */

test('D0 [양성대조] "무조건 맨 위"(옛 target.prepend)로는 D2·D4 가 재현되지 않는다', async ({ page }) => {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html><body style="margin:0">
          <button id="t"></button>
          <div class="section-block" id="secB"><div class="section-inner" id="innerB">
            <div id="b_b1" style="height:100px"></div>
            <div id="b_b2" style="height:100px"></div>
            <div class="frame-block" id="tf1" style="position:absolute;top:400px">텍스트</div>
          </div></div>
          <script>
            document.getElementById('t').addEventListener('click', () => {
              // ⛔옛 산식 — 높이를 안 보고 무조건 맨 앞
              document.getElementById('innerB').prepend(document.getElementById('tf1'));
            });
          </script>
          </body></html>`,
      });
    }
    return route.fulfill({ status: 404, body: '' });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.click('#t');
  const index = await page.evaluate(() => {
    const f = document.getElementById('tf1');
    return [...f.parentElement.children].indexOf(f);
  });
  // 아래(top=400)에 놓았는데도 0 — 이 스펙이 겨누는 «옛 동작»이 이것이다.
  expect(index, '양성대조가 재현 안 됨 — 옛 산식도 0 이 아니면 D2·D4 가 이 회귀를 못 잡는다').toBe(0);
});
