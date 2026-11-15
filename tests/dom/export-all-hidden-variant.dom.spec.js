/* export-all-hidden-variant.dom.spec.js — 시트 0.9.12 EXPORT-ALL-INCLUDES-HIDDEN-AB-VARIANT-01 (지디 261116)
 *   증상: A/B 시안이 있으면 «전체 섹션 내보내기»가 숨긴 B안(data-variation-active="0" · display:none)까지 넣어
 *         «Cannot take screenshot with 0 height» 실패 1건 + 진행 n 에 숨김 섹션 포함.
 *   옛 동작: 29e516019 에서도 같다 — export-image.js·prop-page.js 의 섹션 목록이 `.section-block:not([data-ghost])` 뿐이었다.
 *   고침: export-image.js exportableSections() = ghost·숨긴 시안 제외(js/variation-visibility.js 술어) — 전체·한 섹션 순번·Export 메뉴가 공유.
 *         prop-page.js 단추 개수도 같은 셈.
 * 시험:
 *   H1 ★실제 exportAllSections(CDP 캡처 = main.js 와 같은 명령) — A/B 든 3섹션(캔버스엔 4) = total 3 · 실패 0 · 진행 n 3 · 파일 3 · 도는 섹션 = 보이는 것
 *   H2 Page 패널 «전체 섹션 내보내기» 단추가 보이는 섹션 수(3)를 말한다
 *   H3 ★전환(toggleVariation)하면 B 가 대신 나간다 — «B 를 늘 뺀다»가 아니라 «숨은 쪽을 뺀다»
 * 양성대조(srv 미실행 · 아이맥):
 *   EXPORT-HIDDEN-CTL.patch = exportableSections 의 `+ NOT_HIDDEN_VARIATION` 만 뺌 ⇒ H1·H3 빨강
 *     (total 4 · failed 1건 «0 height» · 진행 1/4…4/4) · H2 초록(단추 셈은 prop-page 쪽).
 *   prop-page.js _secCount 의 `+ NOT_HIDDEN_VARIATION` 을 빼면 H2 빨강(«전체 4개»).
 * ⛔고정 대기 0(진행 사이 300ms 는 제품 코드) · 앱 = bootApp.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/* main.js 'capture-section-cdp' 와 같은 CDP 명령 — 높이 0 이면 크로미움이 실앱과 같은 «0 height» 오류를 낸다 */
async function installCdpCapture(page) {
  const cdp = await page.context().newCDPSession(page);
  await page.exposeFunction('__cdpShot', async ({ x = 0, y = 0, width, height, scale = 1 }) => {
    const r = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: Math.round(x), y: Math.round(y), width: Math.ceil(width), height: Math.ceil(height), scale }, captureBeyondViewport: true, fromSurface: true });
    return r.data;
  });
  await page.evaluate(() => {
    const old = window.electronAPI || {};
    window.electronAPI = new Proxy({}, { get: (t, k) => (k === 'captureSectionCdp' ? (o) => window.__cdpShot(o) : old[k]) });
    window.__blobs = [];
    const orig = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (b) => { const u = orig(b); window.__blobs.push(u); return u; };
    URL.revokeObjectURL = () => {};
  });
}

/* 섹션 셋(S1·S2·S3) — S2 에 A/B 를 만든다(B = 숨김). 캔버스 4 · 보이는 3. */
async function setup(page) {
  await page.setViewportSize({ width: 1200, height: 900 });
  const errs = await bootApp(page);
  await installCdpCapture(page);
  const pre = await page.evaluate(() => {
    const sec = (id) => `<div class="section-block" id="${id}" data-section="1" data-name="${id}" style="background-color:#ffffff">
      <div class="section-inner"><div class="row"><div class="text-block"><h2 class="tb-h2" style="font-size:40px;margin:0">${id} 제목</h2></div></div>
      <div class="row"><div class="gap-block" style="height:120px"></div></div></div></div>`;
    document.getElementById('canvas').innerHTML = sec('hS1') + sec('hS2') + sec('hS3');
    window.createVariation(document.getElementById('hS2'));
    const all = [...document.querySelectorAll('#canvas .section-block:not([data-ghost])')];
    return { all: all.length, hidden: all.filter((s) => s.offsetHeight === 0).map((s) => s.dataset.variation) };
  });
  expect(pre, '[전제] 캔버스 4섹션 · 숨은 것 = B 하나(높이 0)').toEqual({ all: 4, hidden: ['B'] });
  return errs;
}

const runAll = (page) => page.evaluate(async () => {
  window.__blobs.length = 0;
  const steps = [];
  const res = await window.exportAllSections('png', 860, (i, t, sec) => steps.push([i, t, sec?.dataset?.name ?? null, sec?.dataset?.variation ?? null]), { gate: false });
  return { total: res.total, failed: res.failed, errors: res.results.filter((r) => r.failed).map((r) => r.error), steps, files: window.__blobs.length };
});

test('H1 ★A/B 든 페이지 전체 내보내기 — 실패 0 · 진행 n = 보이는 섹션 수(3) · 숨긴 B 는 안 돈다', async ({ page }) => {
  test.setTimeout(90000);
  const errs = await setup(page);
  const r = await runAll(page);
  console.log('  H1:', JSON.stringify(r));
  expect(r.errors, '★실패(숨긴 시안 «0 height»)').toEqual([]);
  expect(r.failed).toEqual([]);
  expect(r.total, '진행 n = 보이는 섹션 수').toBe(3);
  expect(r.steps.map((s) => s.slice(0, 2)), '진행 i / n').toEqual([[1, 3], [2, 3], [3, 3]]);
  expect(r.steps.map((s) => s[3]), '도는 시안 — S2 는 A(보이는 쪽)만').toEqual([null, 'A', null]);
  expect(r.files, '파일 수').toBe(3);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('H2 Page 패널 «전체 섹션 내보내기» 단추 — 보이는 섹션 수(3)를 말한다', async ({ page }) => {
  const errs = await setup(page);
  const title = await page.evaluate(async () => {
    (await import('/js/props/prop-page.js')).showPageProperties();
    return document.getElementById('page-export-all-btn')?.title ?? null;
  });
  expect(title).toBe('전체 3개 섹션을 내보냅니다');
  expect(errs, errs.join('\n')).toEqual([]);
});

test('H3 ★전환하면 B 가 나간다 — 숨은 쪽을 빼는 것이지 B 를 늘 빼는 게 아니다', async ({ page }) => {
  test.setTimeout(90000);
  const errs = await setup(page);
  await page.evaluate(() => window.toggleVariation(document.getElementById('hS2')));
  const r = await runAll(page);
  console.log('  H3:', JSON.stringify(r));
  expect(r.errors).toEqual([]);
  expect(r.total).toBe(3);
  expect(r.steps.map((s) => s[3]), '전환 뒤 S2 자리 = B').toEqual([null, 'B', null]);
  expect(errs, errs.join('\n')).toEqual([]);
});
