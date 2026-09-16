/* overlay-drag-reparent-continuity.dom.spec.js — 2026-09-16n P0 (현빈 실측):
 * "오버레이를 하고 바로 밑에 섹션으로 옮길려고 했더니 바로 밑에 섹션으로 가지는게 아니라
 * 그 밑에 섹션으로 좌표가 이동이되네? 밑으로 드래그했더니 말야. 게다가, 섹션 밑으로
 * 위치되어서 가려서 잘안보여"
 *
 * ★근본원인(재현 확정, 라이브 admin 인스턴스에서 tb_ts0he_zah1mkk 직접 드래그로 확인) —
 *   _bindOverlayMoveDrag의 재부모 분기가 옛 섹션 기준 로컬 좌표(curLeft/curTop)를 «변환
 *   없이» 그대로 새 섹션에 appendChild했다. 옛 섹션이 새 섹션보다 훨씬 크면(재현: 910px
 *   섹션 → 283px 섹션) 옛 top값(예: 909)이 새 섹션 높이를 한참 넘어 — DOM 부모는 올바른
 *   "바로 다음 섹션"이 됐는데(hover 판정 자체는 맞았다) 화면상으로는 그 섹션의 바닥을
 *   한참 지나 «그 다음» 섹션 영역에 그려졌다.
 * ★고침 — 재부모 순간, 옛 섹션과 새 섹션의 화면 좌상단 차이(스크린, zoom 보정)를 옛 로컬
 *   좌표에 더해 새 로컬 좌표로 재앵커한다 — 화면상 «같은 자리»를 유지한 채로 부모만 바뀐다.
 *
 * ⛔앱을 «안» 띄운다 — 고디터 인스턴스·MCP 9345 대역 무접촉. prop-text-wireup-overlay.js와
 *   실제 _findSectionAt(js/sticker-select.js)을 그대로 로드해서 진짜 elementsFromPoint
 *   히트테스트 + 진짜 mousedown/mousemove/mouseup(Playwright page.mouse)으로 돌린다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js overlay-drag-reparent-continuity
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const OVERLAY_JS = fs.readFileSync(path.join(REPO, 'js/props/prop-text-wireup-overlay.js'), 'utf8');
const FRAME_GEOMETRY_JS = fs.readFileSync(path.join(REPO, 'js/frame-geometry.js'), 'utf8');
const STICKER_SELECT_JS = fs.readFileSync(path.join(REPO, 'js/sticker-select.js'), 'utf8');

/* 재현 수치 그대로: A(910local≈큰 섹션) → B(283local≈아주 짧은 섹션) → C(985local).
   스크린 배율은 zoom=100으로 둬 로컬=스크린이라 계산이 쉽다. */
async function boot(page, { zoom = 100, buggyNoConvert = false } = {}) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html><head><meta charset="utf-8">
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; }
            .section-block { position: relative; width: 800px; background: #fff; }
            #secA { height: 500px; }
            #secB { height: 120px; }
            #secC { height: 500px; }
            .frame-block[data-text-frame="true"] {
              position: absolute; width: 200px; height: 40px;
              background: rgba(0,0,255,0.15);
            }
          </style>
          <script src="/sticker-select.js"></script>
          <script type="module" src="/props/overlay-wireup.js"></script>
          </head><body>
          <div class="section-block" id="secA">
            <div class="frame-block" data-text-frame="true" data-overlay-block="true" id="tf1"
                 style="left:50px; top:400px;">
              <div class="tb-h2" contenteditable="false" id="txt1" style="width:100%;height:100%;">텍스트</div>
            </div>
          </div>
          <div class="section-block" id="secB"></div>
          <div class="section-block" id="secC"></div>
          <script>
            window.currentZoom = ${zoom};
            window.pushHistory = () => {};
            window.scheduleAutoSave = () => {};
            window.triggerAutoSave = () => {};
            ${buggyNoConvert ? `
            // ★양성대조용 — 고치기 «전» 버그를 흉내낸다: 재부모 시 좌표 변환 없이 그대로 appendChild.
            window._findSectionAt = window._findSectionAt; // 실제 hit-test는 그대로 쓴다
            const _origBind = window._bindOverlayMoveDrag;
            const posEl = document.getElementById('tf1');
            posEl.addEventListener('mousedown', e => {
              if (e.target.closest('.resize-handle, [contenteditable="true"]')) return;
              e.preventDefault();
              let sec = posEl.closest('.section-block');
              const zoomFrac = ${zoom / 100};
              let startClientX = e.clientX, startClientY = e.clientY;
              let startLeft = parseFloat(posEl.style.left) || 0;
              let startTop = parseFloat(posEl.style.top) || 0;
              const onMove = ev => {
                const hover = window._findSectionAt(ev.clientX, ev.clientY);
                if (hover && hover !== sec) {
                  // ⛔옛 버그 — 좌표 변환 없이 그대로 재부모.
                  const dxs0 = (ev.clientX - startClientX) / zoomFrac, dys0 = (ev.clientY - startClientY) / zoomFrac;
                  startLeft += dxs0; startTop += dys0;
                  hover.appendChild(posEl);
                  sec = hover;
                  startClientX = ev.clientX; startClientY = ev.clientY;
                }
                const rawX = startLeft + (ev.clientX - startClientX) / zoomFrac;
                const rawY = startTop + (ev.clientY - startClientY) / zoomFrac;
                posEl.style.left = rawX + 'px';
                posEl.style.top = rawY + 'px';
              };
              const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
              document.addEventListener('mousemove', onMove);
              document.addEventListener('mouseup', onUp);
            }, true);
            ` : ''}
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
    if (url.pathname === '/sticker-select.js') {
      return route.fulfill({ contentType: 'application/javascript', body: STICKER_SELECT_JS });
    }
    return route.fulfill({ status: 404, body: '' });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  if (!buggyNoConvert) {
    await page.waitForFunction(() => !!window._bindOverlayMoveDrag);
    await page.evaluate(() => window._bindOverlayMoveDrag(document.getElementById('tf1')));
  }
  return errs;
}

async function centerOf(page, id) {
  return page.evaluate((elId) => {
    const r = document.getElementById(elId).getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, id);
}

async function dragTo(page, fromId, targetX, targetY) {
  const c = await centerOf(page, fromId);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  const steps = 20;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(c.x + (targetX - c.x) * i / steps, c.y + (targetY - c.y) * i / steps);
  }
  await page.mouse.up();
}

test('전제 — window._bindOverlayMoveDrag가 실제로 로드된다', async ({ page }) => {
  const errs = await boot(page);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('전제2 — secB(120px)가 secA(500px)보다 훨씬 짧아 재현 조건이 성립한다', async ({ page }) => {
  await boot(page);
  const { hA, hB } = await page.evaluate(() => ({
    hA: document.getElementById('secA').clientHeight,
    hB: document.getElementById('secB').clientHeight,
  }));
  expect(hB, 'secB가 secA보다 훨씬 짧아야 재현 조건이 성립한다').toBeLessThan(hA / 2);
});

test('P1 ★핵심 — secA에서 secB로 드래그하면 부모는 secB, 화면 위치도 드롭 지점과 일치한다(점프 없음)', async ({ page }) => {
  await boot(page);
  // secA 안, secB 바로 위쪽 끝에서 secB 중간으로 드래그.
  const targetY = 560; // secA 끝(500) + secB(120) 중간 지점 근처
  await dragTo(page, 'tf1', 400, targetY);
  const { parentId, rect } = await page.evaluate(() => {
    const f = document.getElementById('tf1');
    const r = f.getBoundingClientRect();
    return { parentId: f.parentElement.id, rect: { top: r.top, bottom: r.bottom, cy: r.top + r.height / 2 } };
  });
  expect(parentId, `부모가 secB(바로 다음 섹션)가 아니다: ${parentId}`).toBe('secB');
  // ★핵심 — 드롭한 화면 y(targetY) 근처에 블록 중심이 있어야 한다(점프 없음).
  expect(Math.abs(rect.cy - targetY), `화면 위치가 드롭 지점과 동떨어졌다(점프) — cy=${rect.cy}, target=${targetY}`).toBeLessThan(5);
  // secB(120px) 안에 있어야지, secC 쪽으로 넘어가면 안 된다.
  const secCRect = await page.evaluate(() => document.getElementById('secC').getBoundingClientRect());
  expect(rect.bottom, `블록이 secB를 넘어 secC 영역까지 내려갔다 — 회귀`).toBeLessThanOrEqual(secCRect.top + 5);
});

test('P2 secB를 지나 secC까지 드래그하면 부모는 secC, 위치도 드롭 지점과 일치한다', async ({ page }) => {
  await boot(page);
  const targetY = 700; // secA(500)+secB(120)=620 지나 secC 안쪽
  await dragTo(page, 'tf1', 400, targetY);
  const { parentId, cy } = await page.evaluate(() => {
    const f = document.getElementById('tf1');
    const r = f.getBoundingClientRect();
    return { parentId: f.parentElement.id, cy: r.top + r.height / 2 };
  });
  expect(parentId, `부모가 secC가 아니다: ${parentId}`).toBe('secC');
  expect(Math.abs(cy - targetY), `연속 재부모(A→B→C) 후에도 화면 위치가 드롭 지점과 동떨어졌다: cy=${cy}, target=${targetY}`).toBeLessThan(5);
});

test('P3 [양성대조] 좌표변환 없이 재부모하면 P1이 실패한다(secB를 넘어 secC 쪽으로 튐)', async ({ page }) => {
  await boot(page, { buggyNoConvert: true });
  const targetY = 560;
  await dragTo(page, 'tf1', 400, targetY);
  const { parentId, cy } = await page.evaluate(() => {
    const f = document.getElementById('tf1');
    const r = f.getBoundingClientRect();
    return { parentId: f.parentElement.id, cy: r.top + r.height / 2 };
  });
  expect(parentId, '부모 판정 자체는 buggy 버전도 맞다(hit-test는 문제없었다)').toBe('secB');
  expect(Math.abs(cy - targetY), `양성대조가 재현 안 됨 — 옛(변환 없는) 재부모도 드롭 지점과 가까우면 P1이 이 회귀를 못 잡는다는 뜻`).toBeGreaterThan(50);
});
