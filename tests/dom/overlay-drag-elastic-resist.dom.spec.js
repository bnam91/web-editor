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
/* ★2026-09-20 — 오버레이 알맹이가 js/overlay-float.js 로 이관됐다(0920b-overlay-extend).
   prop-text-wireup-overlay.js 는 이제 그 모듈을 import 하는 얇은 배선이라 같이 서빙한다. */
const OVERLAY_FLOAT_JS = fs.readFileSync(path.join(REPO, 'js/overlay-float.js'), 'utf8');
const SHAPE_FRAME_JS = fs.readFileSync(path.join(REPO, 'js/shape-frame.js'), 'utf8');

const RESIST_ZONE_SCREEN_PX = 40;
const MAGNET_ZONE_SCREEN_PX = 10;
const MAGNET_FRACTION = MAGNET_ZONE_SCREEN_PX / RESIST_ZONE_SCREEN_PX;
const RESIST_FACTOR = 0.35;
/* 원본 _elasticAxis와 같은 식 — 테스트가 기대값을 독립적으로 계산한다(원본을 베껴 항상
   맞는 게 아니라, 같은 수학을 테스트 쪽에서도 재도출). zone은 «로컬 단위로 환산된» 저항폭
   (zoom 100%면 RESIST_ZONE_SCREEN_PX와 같다 — 기본 인자로 기존 테스트 호환). 경계 바로
   옆(zone*MAGNET_FRACTION)은 마그네틱 캐치 — 위치가 경계값에 딱 붙어 고정된다(2026-09-16m). */
function expectedElastic(raw, boundMax, zone = RESIST_ZONE_SCREEN_PX) {
  const magnet = zone * MAGNET_FRACTION;
  if (raw < 0) {
    const over = -raw;
    if (over <= magnet) return 0;
    return over <= zone ? -((over - magnet) * RESIST_FACTOR) : -((zone - magnet) * RESIST_FACTOR + (over - zone));
  }
  if (raw > boundMax) {
    const over = raw - boundMax;
    if (over <= magnet) return boundMax;
    return over <= zone ? boundMax + (over - magnet) * RESIST_FACTOR : boundMax + (zone - magnet) * RESIST_FACTOR + (over - zone);
  }
  return raw;
}

async function boot(page, { rotationDeg = 0, zoom = 100, boxW = 300, boxH = 40, secW = 800, secH = 600, hardClampRegression = false, zoomObliviousZoneRegression = false, noMagnetRegression = false } = {}) {
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
            ${zoomObliviousZoneRegression ? `
            // ★양성대조용 — 2026-09-16l 고치기 «전» 버그를 흉내낸다: RESIST_ZONE을 zoom으로
            // 안 나누고 로컬 40px 그대로 쓰면(옛 코드), 낮은 줌에서 저항 구간이 화면상 아주
            // 좁아진다(zoom 40%면 화면 16px밖에 안 됨).
            const posEl = document.getElementById('tf1');
            const zoomFrac = ${zoom / 100};
            posEl.addEventListener('mousedown', e => {
              const startLeft = parseFloat(posEl.style.left) || 0;
              const startClientX = e.clientX;
              const onMove = ev => {
                const raw = startLeft + (ev.clientX - startClientX) / zoomFrac;
                const boundMax = ${secW} - ${boxW};
                const zone = 40; // ⛔zoom으로 안 나눈 옛 고정 로컬 상수 — 이게 회귀 지점
                let out = raw;
                if (raw < 0) {
                  const over = -raw;
                  out = over <= zone ? -(over * 0.35) : -(zone * 0.35 + (over - zone));
                } else if (raw > boundMax) {
                  const over = raw - boundMax;
                  out = over <= zone ? boundMax + over * 0.35 : boundMax + zone * 0.35 + (over - zone);
                }
                posEl.style.left = out + 'px';
              };
              const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
              document.addEventListener('mousemove', onMove);
              document.addEventListener('mouseup', onUp);
            }, true);
            ` : ''}
            ${noMagnetRegression ? `
            // ★양성대조용 — 2026-09-16m 고치기 «전» 버그를 흉내낸다: magnet 캐치 없이
            // 저항 커브만(0.35배 감쇠) 그대로 — 경계 바로 옆에서도 «조금씩» 움직인다.
            const posEl = document.getElementById('tf1');
            const zoomFrac = ${zoom / 100};
            posEl.addEventListener('mousedown', e => {
              const startLeft = parseFloat(posEl.style.left) || 0;
              const startClientX = e.clientX;
              const onMove = ev => {
                const raw = startLeft + (ev.clientX - startClientX) / zoomFrac;
                const boundMax = ${secW} - ${boxW};
                const zone = 40;   // magnet 없음 — over 전체를 0.35배로만 누른다
                let out = raw;
                if (raw < 0) {
                  const over = -raw;
                  out = over <= zone ? -(over * 0.35) : -(zone * 0.35 + (over - zone));
                } else if (raw > boundMax) {
                  const over = raw - boundMax;
                  out = over <= zone ? boundMax + over * 0.35 : boundMax + zone * 0.35 + (over - zone);
                }
                posEl.style.left = out + 'px';
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
  if (!hardClampRegression && !zoomObliviousZoneRegression && !noMagnetRegression) {
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

/* _applyOverlayPos가 Math.round를 거치므로(SSOT — dataset.offsetX/Y는 정수) 기대값과 최대
   0.5px 반올림 오차가 날 수 있다. toBeCloseTo(x,0)의 임계(0.5)는 부동소수점 경계에서 그
   0.5 자체와 부딪혀 깨지므로, 1px 여유를 명시적으로 준다. */
function expectNear(left, expected, msg) {
  expect(Math.abs(left - expected), `${msg}: left=${left}, expected=${expected}`).toBeLessThanOrEqual(1);
}

test('전제 — window._bindOverlayMoveDrag가 실제로 로드된다', async ({ page }) => {
  const errs = await boot(page);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('E1 저항구간 안(magnet<over<=zone) — 화면 20px 왼쪽 드래그는 로컬 -3.5px 근처로 눌린다', async ({ page }) => {
  await boot(page, { zoom: 100, boxW: 300, boxH: 40, secW: 800, secH: 600 });
  await dragBy(page, 'tf1', -20, 0);
  const left = await page.evaluate(() => parseFloat(document.getElementById('tf1').style.left));
  const expected = expectedElastic(-20, 500); // boundMax = secW-boxW = 500, magnet(10) 지나 저항구간
  expectNear(left, expected, `raw=-20일 때 기대 저항값(${expected})과 다르다: left=${left}`);
  expect(Math.abs(left), `저항 없이 그대로 -20 움직였다(고침 전 하드클램프/무저항과 구분 안 됨)`).toBeLessThan(15);
});

test('E2 저항구간을 다 채우고 나가면(over>40) 그 지점부터 1:1로 완전히 자유롭다', async ({ page }) => {
  await boot(page, { zoom: 100, boxW: 300, boxH: 40, secW: 800, secH: 600 });
  await dragBy(page, 'tf1', -100, 0);
  const left = await page.evaluate(() => parseFloat(document.getElementById('tf1').style.left));
  const expected = expectedElastic(-100, 500); // = -((40-10)*0.35 + 60) = -70.5
  expectNear(left, expected, `raw=-100일 때 기대값(${expected})과 다르다: left=${left}`);
  // ★옛 하드클램프였다면 0에서 뚝 멈췄을 것 — 실제로는 경계(0)를 넘어 음수로 나갔다.
  expect(left, `섹션 경계(0)를 못 넘었다 — 하드클램프로 되돌아간 회귀`).toBeLessThan(-1);
});

/* ★2026-09-20(int/0920b QA 반영) — 이 검사의 «기준선»이 바뀌었다.
   옛 판은 저장된 left(-74)를 «raw» 자리에 도로 넣어 탄성을 «두 번» 걸었다. 그 결과
   블록을 건드리기만 해도(델타 0) -74 → -44.5 로 경계 쪽으로 툭 되감겼다 —
   현빈 실사용 증상 「오른쪽으로 끌었는데 왼쪽으로 간다」의 뿌리다.
   지금은 드래그 시작에 «출력 → raw»(_elasticAxisInverse)로 한 번 되돌린 뒤 델타를 더한다.
   ⇒ -74 는 raw -103.5 에서 온 자리다(=elastic(-103.5) = -74). 이 검사의 «뜻»
     (재진입해도 같은 곡선으로 저항이 걸린다)은 그대로 두고 기대값만 그 규약으로 다시 잡는다. */
const RAW_OF_M74 = -((74 - (RESIST_ZONE_SCREEN_PX - MAGNET_ZONE_SCREEN_PX) * RESIST_FACTOR) + RESIST_ZONE_SCREEN_PX);  // = -103.5
test('E3-0 ★제자리 — 섹션 밖(-74)에서 끌었다 놓아도 «델타 0 이면» 자리가 안 변한다', async ({ page }) => {
  await boot(page, { zoom: 100, boxW: 300, boxH: 40, secW: 800, secH: 600 });
  await page.evaluate(() => { document.getElementById('tf1').style.left = '-74px'; });
  await dragBy(page, 'tf1', 0, 0);
  const left = await page.evaluate(() => parseFloat(document.getElementById('tf1').style.left));
  expectNear(left, -74, `건드리기만 했는데 자리가 움직였다(탄성 이중적용)`);
});

test('E3 재진입 — 이미 저항구간 밖(-74)에서 오른쪽으로 끌면 다시 같은 곡선으로 저항이 걸린다(대칭)', async ({ page }) => {
  await boot(page, { zoom: 100, boxW: 300, boxH: 40, secW: 800, secH: 600 });
  await page.evaluate(() => { document.getElementById('tf1').style.left = '-74px'; });
  await dragBy(page, 'tf1', 80, 0); // raw = -103.5 + 80 = -23.5 (magnet 지나 저항구간 «안»)
  const left = await page.evaluate(() => parseFloat(document.getElementById('tf1').style.left));
  const raw = RAW_OF_M74 + 80;
  const expected = expectedElastic(raw, 500); // -((23.5-10)*0.35) = -4.725
  expectNear(left, expected, `재진입 시 기대 저항값(${expected})과 다르다: left=${left}`);
  // ★저항이 «실제로» 걸렸나 — 저항이 없었다면 raw(-23.5) 그대로였을 것이다.
  expect(Math.abs(left - raw), '저항이 안 걸렸다 — raw 그대로 움직였다(곡선이 사라진 회귀)').toBeGreaterThan(5);
});

test('E4 ⌘(Cmd) 드래그 — 저항을 완전히 끄고 1:1 자유이동(파워유저 단축키)', async ({ page }) => {
  await boot(page, { zoom: 100, boxW: 300, boxH: 40, secW: 800, secH: 600 });
  await dragBy(page, 'tf1', -100, 0, { meta: true });
  const left = await page.evaluate(() => parseFloat(document.getElementById('tf1').style.left));
  // ⌘는 trulyFree — 탄성 클램프 자체를 안 태운다. raw 그대로.
  expect(left, `⌘ 드래그인데 저항이 걸렸다(raw=-100 그대로여야 함): left=${left}`).toBeCloseTo(-100, 0);
});

test('E5 [양성대조] 탄성 대신 하드클램프였다면 E2 기대값(-70.5)이 안 나오고 0에서 멈춘다', async ({ page }) => {
  await boot(page, { zoom: 100, boxW: 300, boxH: 40, secW: 800, secH: 600, hardClampRegression: true });
  await dragBy(page, 'tf1', -100, 0);
  const left = await page.evaluate(() => parseFloat(document.getElementById('tf1').style.left));
  expect(left, `양성대조가 재현 안 됨 — 하드클램프도 -70.5 근처로 나갔다면 E2가 이 회귀를 못 잡는다는 뜻`).toBe(0);
});

/* ── M. 마그네틱 캐치(2026-09-16m 현빈 실측 — "지금도 없는거 같은데?" → "아니면 살짝
 * 마그네틱 기능이 있으면 나으려나?") ──
 * 부드러운 감쇠 커브만으로는 빠른 실제 드래그에서 저항이 잘 안 느껴진다는 실측 피드백에 따라,
 * 경계 바로 옆(화면 10px, magnet = zone*MAGNET_FRACTION)은 위치가 경계값에 «딱 붙어 고정»
 * 되는 캐치 구간을 추가했다 — 커서가 그만큼 지나가도 블록은 안 움직인다.
 */
test('M1 ★핵심 — magnet구간 안(over<=10)에서는 경계값에 «딱 붙어» 전혀 안 움직인다', async ({ page }) => {
  await boot(page, { zoom: 100, boxW: 300, boxH: 40, secW: 800, secH: 600 });
  await dragBy(page, 'tf1', -7, 0); // over=7 <= magnet(10)
  const left = await page.evaluate(() => parseFloat(document.getElementById('tf1').style.left));
  expect(left, `magnet구간 안인데도 경계(0)에 안 붙고 움직였다: left=${left}`).toBe(0);
});

test('M2 magnet구간을 넘으면(over>10) 그때부터 저항 커브를 따라 움직이기 시작한다', async ({ page }) => {
  await boot(page, { zoom: 100, boxW: 300, boxH: 40, secW: 800, secH: 600 });
  await dragBy(page, 'tf1', -15, 0); // over=15 > magnet(10)
  const left = await page.evaluate(() => parseFloat(document.getElementById('tf1').style.left));
  const expected = expectedElastic(-15, 500); // -((15-10)*0.35) = -1.75
  expectNear(left, expected, `magnet 넘은 뒤 기대값(${expected})과 다르다: left=${left}`);
  expect(left, `magnet구간을 넘었는데도 여전히 0에 붙어 있다 — 캐치가 안 풀리는 회귀`).toBeLessThan(0);
});

test('M3 [양성대조] magnet 캐치가 없으면 M1의 -7 드래그도 이미 움직인다(0이 안 나옴)', async ({ page }) => {
  await boot(page, { zoom: 100, boxW: 300, boxH: 40, secW: 800, secH: 600, noMagnetRegression: true });
  await dragBy(page, 'tf1', -7, 0);
  const left = await page.evaluate(() => parseFloat(document.getElementById('tf1').style.left));
  expect(left, `양성대조가 재현 안 됨 — magnet 없이도 -7 드래그가 0으로 나오면 M1이 이 회귀를 못 잡는다는 뜻`).not.toBe(0);
});

/* ── F. 줌 무관 저항폭(2026-09-16l 현빈 실측 — "섹션 밖으로 옮길 때 약간의 저항도 없니
 * 지금은? 마그네틱같은") ──
 * 저항 존(RESIST_ZONE)이 «로컬 단위» 상수로 고정돼 있으면, 화면 픽셀로는 zoom을 곱한 값이라
 * 낮은 줌(예: 40%)에서는 저항구간이 화면상 아주 좁아져(40px → 16px) 실제 마우스 드래그로는
 * 거의 못 느낀다. 저항은 매 드래그 시점의 zoom으로 나눠 «화면 픽셀 기준»으로 일정해야 한다.
 */
test('E6 ★핵심 — 줌 40%에서도 저항폭은 «화면 30px» 기준으로 일정하다(로컬 40px 아님)', async ({ page }) => {
  await boot(page, { zoom: 40, boxW: 300, boxH: 40, secW: 800, secH: 600 });
  await page.evaluate(() => { document.getElementById('tf1').style.left = '500px'; }); // 경계(boundMax=500)에 둔다
  await dragBy(page, 'tf1', 30, 0); // 화면 30px만 오른쪽으로 — 옛(줌 무관) 버그라면 이미 저항구간(화면 16px) 밖
  const left = await page.evaluate(() => parseFloat(document.getElementById('tf1').style.left));
  // 로컬 delta = 30 / 0.4 = 75. zone(로컬) = 40(화면px) / 0.4 = 100 → over=75<=100, 저항구간 안.
  const expected = expectedElastic(500 + 30 / 0.4, 500, 40 / 0.4); // ≈ 526.25
  expectNear(left, expected, `줌 40%에서 화면 30px 드래그의 기대 저항값(${expected})과 다르다: left=${left}`);
  // ★옛(줌 무관 로컬 40px 고정) 버그였다면 이미 저항구간을 벗어나 1:1 자유였을 것(≈549, 훨씬 큼).
  expect(left, `줌 낮을 때 저항이 화면상 너무 일찍 끝났다 — 로컬 고정폭 회귀`).toBeLessThan(540);
});

test('E7 [양성대조] 저항폭을 zoom으로 안 나눈 옛 산식이면 E6가 실패한다(화면 30px에 이미 자유)', async ({ page }) => {
  await boot(page, { zoom: 40, boxW: 300, boxH: 40, secW: 800, secH: 600, zoomObliviousZoneRegression: true });
  await page.evaluate(() => { document.getElementById('tf1').style.left = '500px'; });
  await dragBy(page, 'tf1', 30, 0);
  const left = await page.evaluate(() => parseFloat(document.getElementById('tf1').style.left));
  // 옛 산식: zone=40(로컬 고정), over=75>40 → 자유구간: 500+40*0.35+(75-40)=549.
  expect(left, `양성대조가 재현 안 됨 — 옛(줌 무관) 산식도 E6와 같은 값이 나오면 E6가 이 회귀를 못 잡는다는 뜻`).toBeCloseTo(549, 0);
});
