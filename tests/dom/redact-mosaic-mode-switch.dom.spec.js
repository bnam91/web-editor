/* redact-mosaic-mode-switch.dom.spec.js — 「모자이크 버튼 눌러도 바로 안 된다」(0918 redact) 회귀.
 *
 * ★원인(2026-09-19, fix/0918-redact, 실측 9502):
 *   (a) 모드 전환이 reuseFullRes 로 «옛 캡처»를 다시 썼고, 블러/해제 때 캐시·캡처표시를 안 비웠다
 *       → 모자이크→블러→(밑 내용 변경)→모자이크 에서 옛 화면 모자이크가 뜨고 html2canvas 0회.
 *   (b) 클릭 1번에 applyRedact·패널 재렌더·mouseup 디바운스가 각자 html2canvas(문서 전체 복제)를
 *       불러 3회 겹침(1.0~1.3초).
 *   (c) await 뒤 블록이 여전히 모자이크인지 안 봐서, 늦게 끝난 캡처가 블러/해제 뒤 캔버스를 되살림.
 *   ⇒ redact-mosaic.js: 블록별 캡처 합치기(진행 중 1개 + 뒤따르는 1회) + 세대 번호 + await 뒤
 *     «아직 라이브 모자이크인가» 확인 + invalidateMosaic 단일 창구.
 *
 * ⛔앱을 «안» 띄운다 — redact-mosaic-transparent-guard.dom.spec.js 와 같은 하네스(모듈만 얹고
 *   window.html2canvas 는 이 파일이 흉내: 호출 카운터 + 수동 resolve + 호출마다 다른 색).
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MOSAIC_SRC = fs.readFileSync(path.join(REPO, 'js/effects/redact-mosaic.js'), 'utf8');

const HARNESS = `<!doctype html><html><head><meta charset="utf-8"></head><body>
<div class="section-block" id="sec1" style="position:relative;width:300px;height:150px;">
  <div class="shape-block shape-redact" id="shp_1" data-shape-redact="true" data-shape-redact-mode="mosaic"
       style="position:absolute;left:0;top:0;width:100px;height:60px;"></div>
</div>
</body></html>`;

async function boot(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    return route.fulfill({ status: 404, body: '' });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.addScriptTag({ content: MOSAIC_SRC, type: 'module' });
  await page.waitForFunction(() => typeof window.captureMosaicSnapshot === 'function');
  // html2canvas 흉내 — 호출마다 대기열에 쌓이고, __resolveNext() 로 하나씩 끝낸다.
  // n 번째 호출은 색 COLORS[n-1] 로 꽉 채운 캔버스를 돌려준다(어느 캡처가 최종인지 픽셀로 판정).
  await page.evaluate(() => {
    const COLORS = [[255, 0, 0], [0, 128, 0], [0, 0, 255], [255, 255, 0], [0, 255, 255], [255, 0, 255]];
    window.__h2c = { calls: 0, queue: [] };
    window.html2canvas = (_scope, _opts) => new Promise((resolve) => {
      const n = ++window.__h2c.calls;
      window.__h2c.queue.push(() => {
        const c = document.createElement('canvas');
        c.width = 100; c.height = 60;
        const ctx = c.getContext('2d');
        const [r, g, b] = COLORS[(n - 1) % COLORS.length];
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(0, 0, 100, 60);
        resolve(c);
      });
    });
    // 다음 대기 중 호출 하나를 끝내고, 뒤따르는 캡처가 시작될 틈(redact-mosaic.js 의 32ms 양보)을 준다.
    const settle = () => new Promise((r) => setTimeout(r, 80));
    window.__resolveNext = async () => {
      const f = window.__h2c.queue.shift();
      if (f) f();
      await settle();
      return !!f;
    };
    window.__flush = async () => { while (window.__h2c.queue.length) await window.__resolveNext(); };
    window.__px = (block) => {
      const c = block.querySelector(':scope > canvas.redact-mosaic-canvas');
      if (!c) return null;
      return [...c.getContext('2d').getImageData(0, 0, 1, 1).data].slice(0, 3);
    };
  });
  return errs;
}

test('M6 양성대조 — 정상 흐름: 1회 캡처로 isMosaicCaptured=true', async ({ page }) => {
  const errs = await boot(page);
  const out = await page.evaluate(async () => {
    const b = document.getElementById('shp_1');
    const p = window.captureMosaicSnapshot(b);
    const pendingDuring = window.isMosaicPending(b);
    await window.__flush();
    const ok = await p;
    return { ok, calls: window.__h2c.calls, cap: window.isMosaicCaptured(b), pendingDuring, pendingAfter: window.isMosaicPending(b), px: window.__px(b) };
  });
  expect(out).toEqual({ ok: true, calls: 1, cap: true, pendingDuring: true, pendingAfter: false, px: [255, 0, 0] });
  expect(errs).toEqual([]);
});

test('M1 ★합치기 — 캡처 진행 중에 5번 더 불러도 html2canvas 는 2회(1 + 뒤따르는 1)', async ({ page }) => {
  const errs = await boot(page);
  const out = await page.evaluate(async () => {
    const b = document.getElementById('shp_1');
    const ps = [window.captureMosaicSnapshot(b)];
    for (let i = 0; i < 5; i++) ps.push(window.captureMosaicSnapshot(b));
    const callsWhileRunning = window.__h2c.calls;
    await window.__flush();
    await window.__flush();
    const results = await Promise.all(ps);
    return { callsWhileRunning, calls: window.__h2c.calls, results, px: window.__px(b) };
  });
  expect(out.callsWhileRunning, '★진행 중 요청이 html2canvas 를 새로 불렀다(합치기 안 됨)').toBe(1);
  expect(out.calls, '★뒤따르는 캡처는 딱 1회여야 한다').toBe(2);
  expect(out.results.every(Boolean)).toBe(true);
  expect(out.px, '★최종 비트맵은 «요청 이후 시작된» 두 번째 캡처여야 한다').toEqual([0, 128, 0]);
  expect(errs).toEqual([]);
});

test('M1-b join 요청(패널 재렌더 방어동기화)은 뒤따르는 캡처를 예약하지 않는다', async ({ page }) => {
  const errs = await boot(page);
  const out = await page.evaluate(async () => {
    const b = document.getElementById('shp_1');
    const p1 = window.captureMosaicSnapshot(b);
    const p2 = window.captureMosaicSnapshot(b, { join: true });
    await window.__flush(); await window.__flush();
    return { same: p1 === p2, calls: window.__h2c.calls, r: await p2 };
  });
  expect(out).toEqual({ same: true, calls: 1, r: true });
  expect(errs).toEqual([]);
});

test('M2 ★늦은 캡처 차단 — 캡처 도중 블러로 바뀌면 결과를 버린다(캔버스 0개, 캡처표시 없음)', async ({ page }) => {
  const errs = await boot(page);
  const out = await page.evaluate(async () => {
    const b = document.getElementById('shp_1');
    const p = window.captureMosaicSnapshot(b);
    b.dataset.shapeRedactMode = 'blur';
    await window.__flush();
    const ok = await p;
    return { ok, cap: window.isMosaicCaptured(b), canvases: b.querySelectorAll('canvas').length };
  });
  expect(out).toEqual({ ok: false, cap: false, canvases: 0 });
  expect(errs).toEqual([]);
});

test('M3 ★가림막 해제 뒤 늦게 끝난 캡처가 캔버스를 되살리지 않는다', async ({ page }) => {
  const errs = await boot(page);
  const out = await page.evaluate(async () => {
    const b = document.getElementById('shp_1');
    const p = window.captureMosaicSnapshot(b);
    b.classList.remove('shape-redact');
    delete b.dataset.shapeRedact; delete b.dataset.shapeRedactMode;
    window.invalidateMosaic(b);
    await window.__flush();
    const ok = await p;
    return { ok, cap: window.isMosaicCaptured(b), canvases: b.querySelectorAll('canvas').length };
  });
  expect(out).toEqual({ ok: false, cap: false, canvases: 0 });
  expect(errs).toEqual([]);
});

test('M3-b DOM 에서 떨어진(undo/redo 로 교체된) 블록의 늦은 캡처는 버려진다', async ({ page }) => {
  const errs = await boot(page);
  const out = await page.evaluate(async () => {
    const b = document.getElementById('shp_1');
    const p = window.captureMosaicSnapshot(b);
    b.remove();
    await window.__flush();
    return { ok: await p, cap: window.isMosaicCaptured(b), canvases: b.querySelectorAll('canvas').length };
  });
  expect(out).toEqual({ ok: false, cap: false, canvases: 0 });
  expect(errs).toEqual([]);
});

test('M3-c 모자이크 아닌 블록엔 html2canvas 를 부르지도 않는다', async ({ page }) => {
  const errs = await boot(page);
  const out = await page.evaluate(async () => {
    const b = document.getElementById('shp_1');
    b.dataset.shapeRedactMode = 'blur';
    const ok = await window.captureMosaicSnapshot(b);
    return { ok, calls: window.__h2c.calls, canvases: b.querySelectorAll('canvas').length };
  });
  expect(out).toEqual({ ok: false, calls: 0, canvases: 0 });
  expect(errs).toEqual([]);
});

test('M4 ★invalidateMosaic — 캡처 성공 → 무효화 → 캐시를 못 쓰고 reuseFullRes 요청도 다시 찍는다', async ({ page }) => {
  const errs = await boot(page);
  const out = await page.evaluate(async () => {
    const b = document.getElementById('shp_1');
    const p1 = window.captureMosaicSnapshot(b); await window.__flush(); await p1;
    const capBefore = window.isMosaicCaptured(b);
    window.invalidateMosaic(b);
    const capAfterInvalidate = window.isMosaicCaptured(b);
    const canvasesAfterInvalidate = b.querySelectorAll('canvas').length;
    const p2 = window.captureMosaicSnapshot(b, { reuseFullRes: true });
    const callsAfterReuse = window.__h2c.calls;
    await window.__flush();
    const ok2 = await p2;
    return { capBefore, capAfterInvalidate, canvasesAfterInvalidate, callsAfterReuse, ok2, cap: window.isMosaicCaptured(b), px: window.__px(b) };
  });
  expect(out).toEqual({ capBefore: true, capAfterInvalidate: false, canvasesAfterInvalidate: 0, callsAfterReuse: 2, ok2: true, cap: true, px: [0, 128, 0] });
  expect(errs).toEqual([]);
});

test('M4-b 모자이크→블러→(밑 내용 변경)→모자이크: 옛 비트맵이 아니라 새 캡처가 들어간다(사용자 시나리오)', async ({ page }) => {
  const errs = await boot(page);
  const out = await page.evaluate(async () => {
    const b = document.getElementById('shp_1');
    const p1 = window.captureMosaicSnapshot(b); await window.__flush(); await p1; // 빨강
    // 블러로 전환 — prop-shape.js applyRedact 가 하는 일
    b.dataset.shapeRedactMode = 'blur'; window.invalidateMosaic(b);
    // 다시 모자이크 — 모드가 바뀌었으니 reuseFullRes 없이
    b.dataset.shapeRedactMode = 'mosaic';
    const staleShown = window.isMosaicCaptured(b);
    const p2 = window.captureMosaicSnapshot(b); await window.__flush();
    return { staleShown, ok: await p2, calls: window.__h2c.calls, px: window.__px(b) };
  });
  expect(out).toEqual({ staleShown: false, ok: true, calls: 2, px: [0, 128, 0] });
  expect(errs).toEqual([]);
});

test('M5 ★순서 — A 진행 중 B 요청 → A 끝 → 뒤따르는 캡처 끝: 최종 픽셀은 마지막 캡처 색', async ({ page }) => {
  const errs = await boot(page);
  const out = await page.evaluate(async () => {
    const b = document.getElementById('shp_1');
    const pA = window.captureMosaicSnapshot(b);
    const pB = window.captureMosaicSnapshot(b);
    await window.__resolveNext(); // A (빨강)
    const afterA = { calls: window.__h2c.calls, px: window.__px(b) };
    await window.__resolveNext(); // 뒤따르는 (초록)
    return { afterA, rA: await pA, rB: await pB, sameP: pA === pB, calls: window.__h2c.calls, px: window.__px(b) };
  });
  expect(out.afterA.calls, 'A 가 끝나면 뒤따르는 캡처가 바로 시작돼야 한다').toBe(2);
  expect(out.sameP).toBe(true);
  expect(out.rA && out.rB).toBe(true);
  expect(out.calls).toBe(2);
  expect(out.px).toEqual([0, 128, 0]);
  expect(errs).toEqual([]);
});

test('M7 런타임 상태가 dataset(저장 HTML)에 새지 않는다 — 진행 중에도 속성 추가 없음', async ({ page }) => {
  const errs = await boot(page);
  const out = await page.evaluate(async () => {
    const b = document.getElementById('shp_1');
    const attrsBefore = [...b.attributes].map(a => a.name).sort();
    const p = window.captureMosaicSnapshot(b);
    const attrsDuring = [...b.attributes].map(a => a.name).sort();
    await window.__flush(); await p;
    const attrsAfter = [...b.attributes].map(a => a.name).sort();
    return { attrsBefore, attrsDuring, attrsAfter };
  });
  expect(out.attrsDuring).toEqual(out.attrsBefore);
  expect(out.attrsAfter).toEqual(out.attrsBefore);
  expect(errs).toEqual([]);
});

/* ── 픽스 라운드(T-061): 방식 버튼 클릭 1회 = html2canvas 2회였다(applyRedact 캡처 + mouseup
 *    디바운스가 그 캡처를 dirty 로 만들어 뒤따르는 캡처 1회). 클릭은 mousedown→mouseup→click 순서라
 *    click 에서 시작한 캡처는 «이미 mouseup 이후의 화면»을 찍는다 → 디바운스는 그 캡처에 합류만. */
test('M8 ★mouseup 뒤에 시작된 캡처가 있으면 디바운스가 뒤따르는 캡처를 걸지 않는다(클릭 1회 = 1회)', async ({ page }) => {
  const errs = await boot(page);
  const out = await page.evaluate(async () => {
    const b = document.getElementById('shp_1');
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); // 버튼의 mouseup
    await new Promise((r) => setTimeout(r, 5));
    const p = window.captureMosaicSnapshot(b);                           // click 핸들러의 캡처
    await new Promise((r) => setTimeout(r, 200));                         // 디바운스(120ms) 발화
    const callsAfterDebounce = window.__h2c.calls;
    await window.__flush(); await window.__flush();
    // 캡처가 끝난 «뒤» 디바운스가 와도(느린 머신) 다시 찍지 않는다.
    return { callsAfterDebounce, calls: window.__h2c.calls, ok: await p, cap: window.isMosaicCaptured(b) };
  });
  expect(out).toEqual({ callsAfterDebounce: 1, calls: 1, ok: true, cap: true });
  expect(errs).toEqual([]);
});

test('M8-b 양성대조 — 캡처가 mouseup «전»에 시작됐으면(그 사이 밑 내용이 바뀌었을 수 있음) 디바운스가 다시 찍는다', async ({ page }) => {
  const errs = await boot(page);
  const out = await page.evaluate(async () => {
    const b = document.getElementById('shp_1');
    const p = window.captureMosaicSnapshot(b);
    await new Promise((r) => setTimeout(r, 5));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 200));
    await window.__flush(); await window.__flush();
    await p;
    return { calls: window.__h2c.calls, px: window.__px(b) };
  });
  expect(out.calls, '★mouseup 이전 캡처만 있는데 디바운스가 새로 찍지 않았다(밑 내용 변화 누락)').toBe(2);
  expect(out.px).toEqual([0, 128, 0]);
  expect(errs).toEqual([]);
});

test('M8-c 캡처가 끝난 뒤 새 mouseup(다른 편집) → 디바운스가 새로 찍는다', async ({ page }) => {
  const errs = await boot(page);
  const out = await page.evaluate(async () => {
    const b = document.getElementById('shp_1');
    const p = window.captureMosaicSnapshot(b);
    await window.__flush(); await p;
    await new Promise((r) => setTimeout(r, 5));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 200));
    await window.__flush();
    return { calls: window.__h2c.calls, px: window.__px(b) };
  });
  expect(out).toEqual({ calls: 2, px: [0, 128, 0] });
  expect(errs).toEqual([]);
});
