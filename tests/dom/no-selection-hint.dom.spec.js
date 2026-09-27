/* no-selection-hint.dom.spec.js — 「선택하세요」가 «선택할 것이 있을 때만» 말이 되게 한다
 *
 * 현빈 실기 제보(2026-09-23, userlens): 새 「New Design」 프로젝트는 캔버스가 «텅 비어» 있다
 *   (섹션 0개). 거기서 블럭 추가를 누르면 「⚠️ 섹션 또는 블록을 먼저 선택하세요」가 뜬다.
 *   ⛔그런데 «선택할 섹션이 하나도 없다». 사용자가 해야 할 일은 «선택»이 아니라 «추가»다.
 *   ⇒ 안내가 시키는 일을 할 수 없는 상태다. 첫 화면에서 바로 만난다.
 *
 * ★여기서 재는 것은 «문구»가 아니라 «갈라짐»이다 — 섹션이 0개일 때와 1개 이상일 때
 *   같은 말을 하면 빨강. (문구를 글자 그대로 박아 두면 다듬을 때마다 검사가 깨진다 —
 *   그건 「검사처럼 생긴 문장」이 된다.)
 *
 * ⛔앱을 «안» 띄운다 — js/drag-utils.js 원본만 route-fulfill.
 * 실행: npm run test:dom -- no-selection-hint
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const SHAPE_FRAME_JS = fs.readFileSync(path.join(REPO, 'js/shape-frame.js'), 'utf8');
const DRAG_UTILS_JS = fs.readFileSync(path.join(REPO, 'js/drag-utils.js'), 'utf8');

async function boot(page, bodyHtml) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html><head><meta charset="utf-8">
          <script type="module">
            import * as DU from '/js/drag-utils.js';
            window.__DU = DU; window.__ready = true;
          </script></head><body>${bodyHtml}</body></html>`,
      });
    }
    if (url.pathname === '/js/shape-frame.js') return route.fulfill({ contentType: 'application/javascript', body: SHAPE_FRAME_JS });
    if (url.pathname === '/js/drag-utils.js') return route.fulfill({ contentType: 'application/javascript', body: DRAG_UTILS_JS });
    if (url.pathname === '/js/globals.js') return route.fulfill({ contentType: 'application/javascript', body: 'export const state = {};' });
    return route.fulfill({ status: 404, body: '' });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

const say = (page) => page.evaluate(() => {
  const t = document.getElementById('editor-toast');
  if (t) t.remove();                       // 앞 시험의 찌꺼기를 지우고 «이번» 말만 받는다
  window.showNoSelectionHint();
  const el = document.getElementById('editor-toast');
  return el ? (el.textContent || '').trim() : null;
});

test('N0 전제 — 어느 쪽이든 «말은 한다»(흔들 게 없어도 토스트는 뜬다)', async ({ page }) => {
  const errs = await boot(page, '');        // floating-panel 도 섹션도 없다
  const msg = await say(page);
  expect(errs).toEqual([]);
  expect(msg, '★아무 말도 안 했다 — 2026-09-21 수리공 유닛이 고친 자리가 되돌아갔다').toBeTruthy();
});

test('N1 ★섹션이 «하나도 없을» 때와 «있을» 때가 «다른» 말을 한다', async ({ page }) => {
  const errs = await boot(page, '<div id="floating-panel"></div>');
  const 빈판 = await say(page);
  await page.evaluate(() => {
    const s = document.createElement('div');
    s.className = 'section-block';
    s.innerHTML = '<div class="section-inner"></div>';
    document.body.appendChild(s);
  });
  const 섹션있는판 = await say(page);
  expect(errs).toEqual([]);
  expect(빈판).toBeTruthy();
  expect(섹션있는판).toBeTruthy();
  expect(빈판 === 섹션있는판,
    `★섹션이 0개일 때와 1개일 때가 «같은» 말을 한다: "${빈판}"\n` +
    '   섹션이 0개면 사용자가 할 수 있는 일은 «선택»이 아니라 «추가»다.\n' +
    '   새 프로젝트 첫 화면이 정확히 그 상태다(현빈 실기 제보, 2026-09-23 userlens).\n' +
    '   ⇒ 안내가 «할 수 없는 일»을 시키고 있다.').toBe(false);
});

test('N2 ★빈 판의 안내는 «추가»를 가리킨다 (「선택」만 말하지 않는다)', async ({ page }) => {
  const errs = await boot(page, '<div id="floating-panel"></div>');
  const 빈판 = await say(page);
  expect(errs).toEqual([]);
  expect(/추가|만드|새 섹션|＋|\+/.test(빈판),
    `★빈 판인데 안내가 «추가»를 안 가리킨다: "${빈판}"`).toBe(true);
});

test('N3 짝 검사 — 섹션이 «있을» 때는 여전히 「선택」을 가리킨다 (고침이 너무 넓지 않다)', async ({ page }) => {
  const errs = await boot(page, '<div id="floating-panel"></div>' +
    '<div class="section-block"><div class="section-inner"></div></div>');
  const msg = await say(page);
  expect(errs).toEqual([]);
  expect(/선택/.test(msg),
    `★섹션이 있는데도 「선택」을 안 가리킨다: "${msg}" — 원래 동작을 잃었다`).toBe(true);
});
