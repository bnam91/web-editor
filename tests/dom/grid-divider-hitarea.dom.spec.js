/* grid-divider-hitarea.dom.spec.js — 「구분선 줄이 선택이 안 된다」 (현빈 2026-09-30, grd_owr55_gql6n0n)
 *
 * ★증상: 그리드 칸에 구분선 줄을 넣으면 «클릭으로 고를 수가 없다» ⇒ 굵기·색을 못 고친다.
 * ★원인은 «선택 규칙»이 아니다 — 줄 주소(data-r/data-c/data-line)는 구분선에도 처음부터
 *   붙고, 클릭 해석(js/block-drag.js _gridAddrAt)은 그걸 그대로 읽는다.
 *   ⇒ 못 고른 까닭은 «잡을 데가 1px» 이라서다. 줌 40%면 화면상 0.4px 이다.
 *
 * ★그래서 이 검사가 재는 것은 «규칙»이 아니라 «면적»이다 — 진짜 크로미움 레이아웃에
 *   앱 CSS(css/editor-blocks.css)를 그대로 얹고 document.elementFromPoint 로 묻는다.
 *   ⛔「CSS 파일에 그 선택자가 있나」로 재면 오타·스코프 실수·우선순위 패배를 다 놓친다.
 *
 * ★픽스처가 «렌더러와 같은 꼴»인지는 여기서 안 잰다 — 그 자리는
 *   tests/unit/grid-divider-handle.test.mjs D1 이 문다(렌더러 산출을 직접 떠서 대조).
 *   ⛔둘을 한 파일에 몰지 않는다: 이쪽은 브라우저가 필요하고 저쪽은 아니다.
 *
 * ★양성대조 — 고치기 «전» css 를 가리키면 H1 이 빨개져야 한다:
 *     mkdir -p /tmp/dv-before && git archive 969f0340 css | tar -x -C /tmp/dv-before
 *     DIVIDER_HIT_CSS=/tmp/dv-before/css/editor-blocks.css npx playwright test \
 *       --config=tests/dom/playwright.dom.config.js grid-divider-hitarea
 *   ⛔판을 «HEAD» 로 쓰지 마라 — 고친 뒤엔 HEAD 가 곧 고친 판이라 대조가 초록이 되고,
 *     그 초록을 「증상을 잡는다」로 읽게 된다. 그래서 «작업 직전 판»을 못박는다: 969f0340.
 *   ★실측(969f0340 기준) — H1 빨강(±5px 이 안 잡힌다) / H2·H3 초록.
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js grid-divider-hitarea
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const CSS_PATH = process.env.DIVIDER_HIT_CSS || path.join(REPO, 'css', 'editor-blocks.css');
if (process.env.DIVIDER_HIT_CSS) console.warn(`[grid-divider-hitarea] ★양성대조 모드 — css 를 ${CSS_PATH} 에서 읽는다`);
const APP_CSS = fs.readFileSync(CSS_PATH, 'utf8');

/* 렌더러(js/blocks/grid-block.js)가 내는 꼴 그대로 — 굵기 1px · 인라인 배경 · margin-block 8px.
   ★글자 줄을 위아래로 둔다: 구분선의 «잡을 데»가 옆 줄을 훔치면 그쪽이 안 골라진다. */
const BODY = `
<div id="canvas" style="--inv-zoom:1;">
  <div class="grid-block" id="grd1" style="width:400px;">
    <div class="grd-inner">
      <div class="grd-cell" data-r="0" data-c="0" id="cell00" style="width:400px;">
        <div data-r="0" data-c="0" data-line="0" class="grd-body" id="ln0" style="height:24px;">위 글자</div>
        <div data-r="0" data-c="0" data-line="1" class="grd-divider" id="dv" style="height:1px;background:#e0e0e0;margin-block:8px;"></div>
        <div data-r="0" data-c="0" data-line="2" class="grd-body" id="ln2" style="height:24px;">아래 글자</div>
      </div>
    </div>
  </div>
</div>`;

async function boot(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html><head><meta charset="utf-8">
          <style>* { box-sizing: border-box; } body { margin:0; } .grd-cell { position: relative; }</style>
          <link rel="stylesheet" href="/css/editor-blocks.css">
          </head><body>${BODY}</body></html>`,
      });
    }
    if (url.pathname === '/css/editor-blocks.css') return route.fulfill({ contentType: 'text/css', body: APP_CSS });
    return route.fulfill({ status: 404, body: '' });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForLoadState('load');
  return errs;
}

/* 한 점에서 «클릭이 어느 줄로 해석되는가» — js/block-drag.js _gridAddrAt 과 «같은 술어»
   (closest('[data-r][data-c][data-line]')). ⛔그 함수를 베낀 게 아니라 «그 함수가 보는 것»을 본다. */
const PROBE = `(dy) => {
  const r = document.getElementById('dv').getBoundingClientRect();
  const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2 + dy);
  const line = el?.closest('[data-r][data-c][data-line]');
  return { hit: el?.id || null, line: line?.id || null, li: line?.dataset.line ?? null };
}`;

test('H1 ★구분선 «위아래 5px» 을 눌러도 구분선 줄이 골라진다 (1px 만으로는 손이 못 닿는다)', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate((src) => {
    const probe = new Function('return ' + src)();
    return { up: probe(-5), on: probe(0), down: probe(5) };
  }, PROBE);
  expect(errs).toEqual([]);
  expect(r.on.line).toBe('dv');
  expect(r.up.line).toBe('dv');
  expect(r.down.line).toBe('dv');
  expect(r.on.li).toBe('1');
});

test('H2 ⛔잡을 데가 «옆 줄»을 훔치지 않는다 — 위아래 글자 줄은 그대로 골라진다', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(() => {
    const at = (id, frac) => {
      const b = document.getElementById(id).getBoundingClientRect();
      const el = document.elementFromPoint(b.left + b.width / 2, b.top + b.height * frac);
      const line = el?.closest('[data-r][data-c][data-line]');
      return line?.dataset.line ?? null;
    };
    return { top: at('ln0', 0.5), topEdge: at('ln0', 0.95), bottom: at('ln2', 0.5), bottomEdge: at('ln2', 0.05) };
  });
  expect(errs).toEqual([]);
  expect(r.top).toBe('0');
  expect(r.topEdge).toBe('0');
  expect(r.bottom).toBe('2');
  expect(r.bottomEdge).toBe('2');
});

test('H3 ★굵기를 올리면 «원래도» 골라졌다 — 이 결함이 면적 문제였다는 대조', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate((src) => {
    const probe = new Function('return ' + src)();
    document.getElementById('dv').style.height = '20px';
    return probe(0);
  }, PROBE);
  expect(errs).toEqual([]);
  expect(r.line).toBe('dv');
});
