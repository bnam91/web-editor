/* overlay-exit-return-section.dom.spec.js — 2026-09-16o P0 (현빈 실측):
 * "오버레이를 한 상태로 다른 섹션 위로 올려는 뒀어. 그 상태에서 오버레이 버튼을 풀었더니
 * 다시 처음 섹션으로 가지거든?"
 *
 * ★근본원인(재현 확정, 라이브 admin 인스턴스에서 tb_ts0he_zah1mkk로 직접 확인) —
 *   _exitOverlay가 dataset.overlayReturnParent(오버레이 «진입 당시»의 원래 부모)를 무조건
 *   따른다. 오버레이 상태로 다른 섹션에 드래그해 옮긴 뒤 해제하면, 원래 부모가 여전히
 *   DOM에 살아있으니(isConnected) 무조건 그리로 되돌아가 — 지금 눈에 보이는(옮겨간) 섹션이
 *   아니라 «처음» 섹션 본문으로 순간이동한다.
 * ★고침 — 원래 부모가 지금도 «같은 섹션» 소속일 때만 정확한 원위치로 복귀하고, 오버레이
 *   중 다른 섹션으로 옮겨졌으면 그 되돌리기를 포기하고 지금 있는 섹션 본문(«.section-inner»)
 *   맨 앞으로 넣는다 — 원래 부모가 사라진 경우(행 정리 등)와 같은 폴백 경로를 탄다.
 *
 * ⛔앱을 «안» 띄운다 — 고디터 인스턴스·MCP 9345 대역 무접촉. prop-text-wireup-overlay.js
 *   원본을 실제 ES 모듈로 그대로 로드해서 wireOverlaySection()이 심는 실제 버튼 클릭
 *   핸들러(_enterOverlay/_exitOverlay)를 그대로 돌린다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js overlay-exit-return-section
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const OVERLAY_JS = fs.readFileSync(path.join(REPO, 'js/props/prop-text-wireup-overlay.js'), 'utf8');
const FRAME_GEOMETRY_JS = fs.readFileSync(path.join(REPO, 'js/frame-geometry.js'), 'utf8');

async function boot(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html><head><meta charset="utf-8">
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; }
            .section-block { position: relative; width: 800px; height: 300px; background: #fff; }
          </style>
          <script type="module">
            import { wireOverlaySection } from '/props/overlay-wireup.js';
            window.__wireOverlaySection = wireOverlaySection;
          </script>
          </head><body>
          <button id="txt-overlay-toggle" style="display:none;"></button>
          <div class="section-block" id="secA">
            <div class="section-inner" id="innerA">
              <div class="text-block" id="tbwrap">
                <div class="frame-block" data-text-frame="true" id="tf1"
                     style="position:relative; width:200px; height:40px; background:rgba(0,0,255,0.15);">
                  <div class="tb-h2" id="tb1" contenteditable="false" style="width:100%;height:100%;">텍스트</div>
                </div>
              </div>
            </div>
          </div>
          <div class="section-block" id="secB">
            <div class="section-inner" id="innerB"></div>
          </div>
          <script>
            window.currentZoom = 100;
            window.pushHistory = () => {};
            window.scheduleAutoSave = () => {};
            window.triggerAutoSave = () => {};
            window.buildLayerPanel = () => {};
            window.showTextProperties = () => {};
            window._bindOverlayMoveDrag = () => {}; // 이 테스트는 진입/이탈만 잰다 — 드래그는 별도 스펙
          </script>
          </body></html>`,
      });
    }
    if (url.pathname === '/props/overlay-wireup.js') {
      return route.fulfill({ contentType: 'application/javascript', body: OVERLAY_JS });
    }
    if (url.pathname === '/frame-geometry.js') {
      return route.fulfill({ contentType: 'application/javascript', body: FRAME_GEOMETRY_JS });
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

test('전제 — wireOverlaySection이 실제로 로드된다', async ({ page }) => {
  const errs = await boot(page);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('전제2 — 오버레이 진입 시 posEl이 secA 직속으로, overlayReturnParent가 원래 부모(tbwrap)로 기록된다', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => document.getElementById('txt-overlay-toggle').click()); // 진입
  const state = await page.evaluate(() => {
    const f = document.getElementById('tf1');
    return { parentId: f.parentElement.id, overlay: f.dataset.overlayBlock, returnParent: f.dataset.overlayReturnParent };
  });
  expect(state.parentId).toBe('secA');
  expect(state.overlay).toBe('true');
  expect(state.returnParent).toBe('tbwrap'); // posEl.parentElement — 하네스에선 .text-block(#tbwrap)
});

test('X1 같은 섹션 안에서 진입→즉시 이탈 — 정확히 원래 자리(tbwrap)로 복귀한다(회귀 없음)', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => document.getElementById('txt-overlay-toggle').click()); // 진입
  await page.evaluate(() => document.getElementById('txt-overlay-toggle').click()); // 이탈 (섹션 이동 없음)
  const parentId = await page.evaluate(() => document.getElementById('tf1').parentElement.id);
  expect(parentId, `같은 섹션 안 진입→이탈인데 원래 자리(tbwrap)로 안 돌아갔다: ${parentId}`).toBe('tbwrap');
});

test('X2 ★핵심 — 오버레이 중 다른 섹션(secB)으로 옮긴 뒤 이탈하면 secB 본문(innerB)에 들어간다(처음 섹션 아님)', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => document.getElementById('txt-overlay-toggle').click()); // 진입 (secA)
  await page.evaluate(() => {
    // 오버레이 상태로 다른 섹션에 드래그해 옮긴 상황을 흉내낸다(재부모만 수행).
    document.getElementById('secB').appendChild(document.getElementById('tf1'));
  });
  await page.evaluate(() => document.getElementById('txt-overlay-toggle').click()); // 이탈
  const parentId = await page.evaluate(() => document.getElementById('tf1').parentElement.id);
  expect(parentId, `★회귀 — 다른 섹션으로 옮긴 뒤 이탈했는데 처음 섹션(innerA)으로 순간이동했다: ${parentId}`).toBe('innerB');
});

test('X3 [양성대조] "원래 부모로 무조건 복귀"였다면 X2가 실패한다(innerA로 감)', async ({ page }) => {
  // ★이 검사가 실제로 그 회귀를 겨눈다는 증거 — _exitOverlay를 안 쓰고, 옛(버그) 산식대로
  //   overlayReturnParent가 살아있으면 무조건 그리로 되돌리는 핸들러를 심어 재현한다.
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html><body>
          <button id="txt-overlay-toggle"></button>
          <div class="section-block" id="secA"><div class="section-inner" id="innerA">
            <div class="frame-block" data-text-frame="true" id="tf1" data-overlay-return-parent="innerA">텍스트</div>
          </div></div>
          <div class="section-block" id="secB"><div class="section-inner" id="innerB"></div></div>
          <script>
            document.getElementById('secB').appendChild(document.getElementById('tf1')); // 이미 옮겨진 상태로 시작
            document.getElementById('txt-overlay-toggle').addEventListener('click', () => {
              const f = document.getElementById('tf1');
              const p = document.getElementById(f.dataset.overlayReturnParent);
              if (p && p.isConnected) p.prepend(f);   // ⛔옛 버그 — 같은 섹션인지 확인 없이 무조건 복귀
            });
          </script>
          </body></html>`,
      });
    }
    return route.fulfill({ status: 404, body: '' });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.click('#txt-overlay-toggle');
  const parentId = await page.evaluate(() => document.getElementById('tf1').parentElement.id);
  expect(parentId, '양성대조가 재현 안 됨 — 옛 산식도 innerB에 남으면 X2가 이 회귀를 못 잡는다는 뜻').toBe('innerA');
});

/* ── Q. 작업목록매니저(a1-a3) 독립 리뷰에서 확인한 조합 — 결과를 스펙으로 고정 ──
 * a1-a3가 이 파일의 하네스를 그대로 써서 조사용 검사를 돌리고 지웠다("저장소에 안
 * 남겼다") — 재현 불가능한 결론이라는 내용 게이트 지적을 받아, 그 세 조합을 여기 정식
 * 스펙으로 옮긴다(Q1·Q2는 a1-a3 조사 결과 그대로 "정상"을 고정, Q3도 동일).
 * ★Q2는 "그 섹션 맨 앞에 들어간다"는 현빈 검수(🔎㉗)에서 바뀔 수 있는 항목이다 — 바뀌면
 *   이 테스트가 빨개져서 알려준다(의도적으로 "지금 값을 고정"하는 스펙).
 */
test('Q1 다른 섹션(secB)으로 옮겼다가 원래 섹션(secA)으로 되돌아온 뒤 이탈 — 정확히 원래 자리(tbwrap)로 복귀한다', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => document.getElementById('txt-overlay-toggle').click()); // 진입 (secA)
  await page.evaluate(() => {
    document.getElementById('secB').appendChild(document.getElementById('tf1')); // secA → secB
    document.getElementById('secA').appendChild(document.getElementById('tf1')); // secB → secA (되돌아옴)
  });
  await page.evaluate(() => document.getElementById('txt-overlay-toggle').click()); // 이탈
  const parentId = await page.evaluate(() => document.getElementById('tf1').parentElement.id);
  expect(parentId, `원래 섹션으로 되돌아왔는데도 원래 자리(tbwrap)로 복귀 안 함: ${parentId}`).toBe('tbwrap');
});

test('Q2 [현재값 고정 — 🔎㉗ 현빈 검수 대기] 기존 블럭이 있는 섹션으로 옮겨 이탈하면 그 섹션 «맨 앞»(자리 0)에 들어간다', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    // innerB에 기존 블럭 셋을 미리 넣어 둔다(a1-a3 조사와 동일 조건).
    const inner = document.getElementById('innerB');
    for (let i = 0; i < 3; i++) {
      const d = document.createElement('div');
      d.id = `existing${i}`;
      inner.appendChild(d);
    }
  });
  await page.evaluate(() => document.getElementById('txt-overlay-toggle').click()); // 진입 (secA)
  await page.evaluate(() => document.getElementById('secB').appendChild(document.getElementById('tf1')));
  await page.evaluate(() => document.getElementById('txt-overlay-toggle').click()); // 이탈 → innerB로 폴백
  const { parentId, indexInParent } = await page.evaluate(() => {
    const f = document.getElementById('tf1');
    return { parentId: f.parentElement.id, indexInParent: [...f.parentElement.children].indexOf(f) };
  });
  expect(parentId).toBe('innerB');
  // ★현재 동작(target.prepend) 고정 — "놓아 둔 높이 근처"로 바뀌면 여기가 빨개진다(의도적).
  expect(indexInParent, `innerB 안에서 맨 앞(0)이 아니다 — target.prepend 동작이 바뀌었다: index=${indexInParent}`).toBe(0);
});

test('Q3 원래 부모가 자유배치 프레임(data-free-layout)이어도 다른 섹션으로 옮겨 이탈하면 innerB로 들어가고 position·width가 정리된다', async ({ page }) => {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html><head><meta charset="utf-8">
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; }
            .section-block { position: relative; width: 800px; height: 300px; background: #fff; }
          </style>
          <script type="module">
            import { wireOverlaySection } from '/props/overlay-wireup.js';
            window.__wireOverlaySection = wireOverlaySection;
          </script>
          </head><body>
          <button id="txt-overlay-toggle" style="display:none;"></button>
          <div class="section-block" id="secA">
            <div class="section-inner" id="innerA">
              <div class="frame-block" data-free-layout="true" id="tbwrap" style="position:relative;">
                <div class="frame-block" data-text-frame="true" id="tf1"
                     style="position:relative; width:200px; height:40px; background:rgba(0,0,255,0.15);">
                  <div class="tb-h2" id="tb1" contenteditable="false" style="width:100%;height:100%;">텍스트</div>
                </div>
              </div>
            </div>
          </div>
          <div class="section-block" id="secB">
            <div class="section-inner" id="innerB"></div>
          </div>
          <script>
            window.currentZoom = 100;
            window.pushHistory = () => {};
            window.scheduleAutoSave = () => {};
            window.triggerAutoSave = () => {};
            window.buildLayerPanel = () => {};
            window.showTextProperties = () => {};
            window._bindOverlayMoveDrag = () => {};
          </script>
          </body></html>`,
      });
    }
    if (url.pathname === '/props/overlay-wireup.js') {
      return route.fulfill({ contentType: 'application/javascript', body: OVERLAY_JS });
    }
    if (url.pathname === '/frame-geometry.js') {
      return route.fulfill({ contentType: 'application/javascript', body: FRAME_GEOMETRY_JS });
    }
    return route.fulfill({ status: 404, body: '' });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => !!window.__wireOverlaySection);
  await page.evaluate(() => window.__wireOverlaySection({ tb: document.getElementById('tb1') }));
  await page.evaluate(() => document.getElementById('txt-overlay-toggle').click()); // 진입 (원래 부모=자유배치 프레임)
  await page.evaluate(() => document.getElementById('secB').appendChild(document.getElementById('tf1')));
  await page.evaluate(() => document.getElementById('txt-overlay-toggle').click()); // 이탈
  const state = await page.evaluate(() => {
    const f = document.getElementById('tf1');
    return { parentId: f.parentElement.id, position: f.style.position, width: f.style.width };
  });
  expect(state.parentId, `원래 부모가 자유배치 프레임이었는데 innerB로 안 들어감: ${state.parentId}`).toBe('innerB');
  expect(state.position, `position이 안 비워졌다: "${state.position}"`).toBe('');
  expect(state.width, `overlay가 새로 심은 width가 안 비워졌다: "${state.width}"`).toBe('');
});
