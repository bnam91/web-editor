/* overlay-drag-elastic-resist.dom.spec.js — 2026-09-16k 현빈 지시:
 * "커맨드를 누르고 드래그해야지만 나가게 할 필요가 있어? 나는 지금처럼 마그네틱이라 해야
 * 되나 방울에 넣고 나오고 그런거거든? ... 넣고 나갈때 둘다 저항이 있으면 돼 살짝 턱이 있는
 * 느낌도 괜찮고"
 *
 * ★변경 — 기존엔 ⌘(Cmd)를 눌러야만 섹션 경계 밖으로 나갈 수 있었다(하드 클램프가 기본).
 *   이제 기본 드래그 자체가 «탄성 클램프»(js/props/prop-text-wireup-overlay.js의
 *   _elasticAxis/_elasticClampToSection)를 쓴다 — 경계를 넘는 만큼(over)을 RESIST_ZONE(40
 *   로컬px) 안에서는 RESIST_FACTOR(0.35)로 눌러 «무겁게» 움직이다가, 그 구간을 다 채우면
 *   그 지점부터 1:1로 완전히 자유(방울이 막을 뚫고 나가는 느낌). 위치 기반 순수 함수라
 *   나갈 때·들어올 때 같은 곡선을 그대로 타 — 재진입도 자동으로 대칭 저항이 걸린다.
 *   ⌘는 이 저항을 완전히 끄는 파워유저 단축키로 남는다.
 *
 * ⛔앱을 «안» 띄운다 — 고디터 인스턴스·MCP 9345 대역 무접촉. prop-text-wireup-overlay.js
 *   원본을 실제 ES 모듈로 그대로 로드해서 진짜 mousedown/mousemove/mouseup(Playwright
 *   page.mouse, 합성 dispatchEvent 아님)으로 돌린다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js overlay-drag-elastic-resist
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const OVERLAY_JS = fs.readFileSync(path.join(REPO, 'js/props/prop-text-wireup-overlay.js'), 'utf8');
const FRAME_GEOMETRY_JS = fs.readFileSync(path.join(REPO, 'js/frame-geometry.js'), 'utf8');

const RESIST_ZONE = 40;
const RESIST_FACTOR = 0.35;
/* 원본 _elasticAxis와 같은 식 — 테스트가 기대값을 독립적으로 계산한다(원본을 베껴 항상
   맞는 게 아니라, 같은 수학을 테스트 쪽에서도 재도출). */
function expectedElastic(raw, boundMax) {
  if (raw < 0) {
    const over = -raw;
    return over <= RESIST_ZONE ? -(over * RESIST_FACTOR) : -(RESIST_ZONE * RESIST_FACTOR + (over - RESIST_ZONE));
  }
  if (raw > boundMax) {
    const over = raw - boundMax;
    return over <= RESIST_ZONE ? boundMax + over * RESIST_FACTOR : boundMax + RESIST_ZONE * RESIST_FACTOR + (over - RESIST_ZONE);
  }
  return raw;
}

async function boot(page, { rotationDeg = 0, zoom = 100, boxW = 300, boxH = 40, secW = 800, secH = 600, hardClampRegression = false } = {}) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html><head><meta charset="utf-8">
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; }
            .section-block { position: relative; width: ${secW}px; height: ${secH}px; background: #fff; }
            .frame-block[data-text-frame="true"] {
              position: absolute; width: ${boxW}px; height: ${boxH}px;
              transform-origin: center center;
              background: rgba(0,0,255,0.15);
            }
          </style>
          <script type="module" src="/props/overlay-wireup.js"></script>
          </head><body>
          <div class="section-block" id="sec1">
            <div class="frame-block" data-text-frame="true" data-overlay-block="true" id="tf1"
                 ${rotationDeg ? `data-rotation="${rotationDeg}"` : ''}
                 style="left:0px; top:100px; transform: rotate(${rotationDeg}deg);">
              <div class="tb-h2" contenteditable="false" id="txt1" style="width:100%;height:100%;">텍스트</div>
            </div>
          </div>
          <script>
            window.currentZoom = ${zoom};
            window.pushHistory = () => {};
            window.scheduleAutoSave = () => {};
            window.triggerAutoSave = () => {};
            window._findSectionAt = () => null;
            ${hardClampRegression ? `
            // ★양성대조용 — 옛 하드클램프를 흉내내 탄성 파일 안의 _elasticClampToSection을
            // 무력화할 순 없으니(모듈 내부 함수), 대신 window._clampToSection을 하드클램프로
            // 세팅해 "탄성 대신 하드클램프를 썼다면" 시나리오를 별도 핸들러로 재현한다.
            const posEl = document.getElementById('tf1');
            posEl.addEventListener('mousedown', e => {
              const startLeft = parseFloat(posEl.style.left) || 0;
              const startClientX = e.clientX;
              const onMove = ev => {
                const raw = startLeft + (ev.clientX - startClientX) / ${zoom / 100};
                const maxX = ${secW} - ${boxW};
                posEl.style.left = Math.max(0, Math.min(maxX, raw)) + 'px';
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
    return route.fulfill({ status: 404, body: '' });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  if (!hardClampRegression) {
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

async function dragBy(page, fromId, dxPage, dyPage, { meta = false } = {}) {
  const c = await centerOf(page, fromId);
  if (meta) await page.keyboard.down('Meta');
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + dxPage / 2, c.y + dyPage / 2);
  await page.mouse.move(c.x + dxPage, c.y + dyPage);
  await page.mouse.up();
  if (meta) await page.keyboard.up('Meta');
}

test('전제 — window._bindOverlayMoveDrag가 실제로 로드된다', async ({ page }) => {
  const errs = await boot(page);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('E1 저항구간 안(over<=40) — 화면 20px 왼쪽 드래그는 로컬 -7px 근처로 눌린다(0.35배)', async ({ page }) => {
  await boot(page, { zoom: 100, boxW: 300, boxH: 40, secW: 800, secH: 600 });
  await dragBy(page, 'tf1', -20, 0);
  const left = await page.evaluate(() => parseFloat(document.getElementById('tf1').style.left));
  const expected = expectedElastic(-20, 500); // boundMax = secW-boxW = 500
  expect(left, `raw=-20일 때 기대 저항값(${expected})과 다르다: left=${left}`).toBeCloseTo(expected, 0);
  expect(Math.abs(left), `저항 없이 그대로 -20 움직였다(고침 전 하드클램프/무저항과 구분 안 됨)`).toBeLessThan(15);
});

test('E2 저항구간을 다 채우고 나가면(over>40) 그 지점부터 1:1로 완전히 자유롭다', async ({ page }) => {
  await boot(page, { zoom: 100, boxW: 300, boxH: 40, secW: 800, secH: 600 });
  await dragBy(page, 'tf1', -100, 0);
  const left = await page.evaluate(() => parseFloat(document.getElementById('tf1').style.left));
  const expected = expectedElastic(-100, 500); // = -(40*0.35 + 60) = -74
  expect(left, `raw=-100일 때 기대값(${expected})과 다르다: left=${left}`).toBeCloseTo(expected, 0);
  // ★옛 하드클램프였다면 0에서 뚝 멈췄을 것 — 실제로는 경계(0)를 넘어 음수로 나갔다.
  expect(left, `섹션 경계(0)를 못 넘었다 — 하드클램프로 되돌아간 회귀`).toBeLessThan(-1);
});

test('E3 재진입 — 이미 저항구간 밖(-74)에서 오른쪽으로 끌면 다시 같은 곡선으로 저항이 걸린다(대칭)', async ({ page }) => {
  await boot(page, { zoom: 100, boxW: 300, boxH: 40, secW: 800, secH: 600 });
  await page.evaluate(() => { document.getElementById('tf1').style.left = '-74px'; });
  await dragBy(page, 'tf1', 50, 0); // raw = -74 + 50 = -24 (저항구간 안)
  const left = await page.evaluate(() => parseFloat(document.getElementById('tf1').style.left));
  const expected = expectedElastic(-24, 500); // -(24*0.35) = -8.4
  expect(left, `재진입 시 기대 저항값(${expected})과 다르다: left=${left}`).toBeCloseTo(expected, 0);
});

test('E4 ⌘(Cmd) 드래그 — 저항을 완전히 끄고 1:1 자유이동(파워유저 단축키)', async ({ page }) => {
  await boot(page, { zoom: 100, boxW: 300, boxH: 40, secW: 800, secH: 600 });
  await dragBy(page, 'tf1', -100, 0, { meta: true });
  const left = await page.evaluate(() => parseFloat(document.getElementById('tf1').style.left));
  // ⌘는 trulyFree — 탄성 클램프 자체를 안 태운다. raw 그대로.
  expect(left, `⌘ 드래그인데 저항이 걸렸다(raw=-100 그대로여야 함): left=${left}`).toBeCloseTo(-100, 0);
});

test('E5 [양성대조] 탄성 대신 하드클램프였다면 E2 기대값(-74)이 안 나오고 0에서 멈춘다', async ({ page }) => {
  await boot(page, { zoom: 100, boxW: 300, boxH: 40, secW: 800, secH: 600, hardClampRegression: true });
  await dragBy(page, 'tf1', -100, 0);
  const left = await page.evaluate(() => parseFloat(document.getElementById('tf1').style.left));
  expect(left, `양성대조가 재현 안 됨 — 하드클램프도 -74 근처로 나갔다면 E2가 이 회귀를 못 잡는다는 뜻`).toBe(0);
});
