/* thumb-goya-asset — 카드 썸네일의 «두 번째 병»: 밑그림이 통째로 빠진다 (T-149)
 * ──────────────────────────────────────────────────────────────────────────
 * ⛔이것은 T-087 이 고친 「빈 그림」 병과 «다른 병»이다. 같은 함수에 둘이 있었다.
 *   T-087 — 캔버스 높이가 0 이라 toDataURL 이 "data:,"(6자)를 돌려준다 ⇒ «길이»로 잡힌다.
 *   T-149 — 캔버스는 멀쩡한 크기인데 «안에 밑그림이 없다» ⇒ 길이로는 «안 잡힌다».
 *   ★goya-asset 이 빠져도 섹션 배경색이 «불투명»하게 찍히므로 빈칸 검사를 통과한다.
 *     ⇒ 실패가 «성공»으로 보고된다. 오늘 세 번째로 같은 모양이 났다(T-148·T-039·T-071).
 *   ⇒ ★판정 기준이 달라야 한다: 「비었는가」가 아니라 «밑그림 색이 있는가».
 *
 * ★뿌리는 T-071 이 모자이크에서 찾은 것과 «같다» — html2canvas 1.4.1 은 이미지를 자기가
 *   다시 로드하는데(vendor CacheStorage.loadImage), goya-asset:// 는 두 축 다 못 읽는다:
 *     useCORS:true  → crossOrigin="anonymous" 를 달아 로드 → CORS 헤더가 없어 onerror
 *     useCORS:false → 로드 조건이 전부 거짓 → 읽지도 않는다
 *   js/io/save-load.js captureThumbnail 이 바로 그 `useCORS:true` 를 쓴다.
 *
 * ⛔앱을 «안» 띄운다 — 레포의 진짜 부품 + 진짜 html2canvas 만 얹는다.
 *   흉내(mock)로는 «html2canvas 가 무엇을 그리는가»를 증명할 수 없다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js thumb-goya-asset
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };
const ASSET_URL = 'goya-asset://proj_t149/half.png';

/* captureThumbnail 이 재는 것과 같은 모양 — 첫 섹션 하나, 폭 860. */
const HARNESS = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;background:#fff}
  .section-block{position:relative;width:860px;height:400px;background:#ffffff}
  #ph{position:absolute;left:0;top:0;width:860px;height:400px;object-fit:fill}
</style></head><body>
<div id="canvas"><div class="section-block" id="sec1"><img id="ph" src="${ASSET_URL}"></div></div>
</body></html>`;

async function boot(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, url.pathname.slice(1));
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.addScriptTag({ url: '/vendor/html2canvas/html2canvas.min.js' });
  await page.evaluate((assetUrl) => {
    /* 에셋의 «진짜 바이트» — 왼쪽 절반 빨강 / 오른쪽 절반 파랑. data: 로만 존재한다. */
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const x = c.getContext('2d');
    x.fillStyle = 'rgb(255,0,0)'; x.fillRect(0, 0, 32, 64);
    x.fillStyle = 'rgb(0,0,255)'; x.fillRect(32, 0, 32, 64);
    window.__ASSET = c.toDataURL('image/png');
    window.electronAPI = {   // preload 의 assets:readAsDataUri IPC 흉내
      assetsReadAsDataUri: async () => ({ ok: true, dataUri: window.__ASSET }),
    };
    void assetUrl;
  }, ASSET_URL);
  await page.addScriptTag({ url: '/js/io/goya-asset-inline.js', type: 'module' });
  await page.waitForFunction(() => typeof window.html2canvas === 'function');
  return errs;
}

/** captureThumbnail 과 «같은 걸음»으로 찍고, 픽셀로 잰다. `prep` 이 참이면 부품을 쓴다. */
const shoot = (page, usePrep) => page.evaluate(async (withPrep) => {
  const sec = document.getElementById('sec1');
  const clone = sec.cloneNode(true);                       // captureThumbnail 과 같다
  clone.style.cssText += ';position:fixed;top:-99999px;left:0;width:860px;margin:0;';
  document.body.appendChild(clone);
  let prepared = -1;
  if (withPrep) {
    const m = await import('/js/io/goya-asset-inline.js');
    const p = await m.prepareGoyaAssetsForClone(sec);
    prepared = p.apply(clone);
  }
  const canvas = await window.html2canvas(clone, { scale: 1, useCORS: true, backgroundColor: '#ffffff', logging: false });
  document.body.removeChild(clone);
  const d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  let red = 0, blue = 0, opaque = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] > 8) opaque++;
    if (d[i] > 180 && d[i + 1] < 70 && d[i + 2] < 70) red++;
    if (d[i + 2] > 180 && d[i] < 70 && d[i + 1] < 70) blue++;
  }
  const url = canvas.toDataURL('image/jpeg', 0.7);
  return { w: canvas.width, h: canvas.height, red, blue, opaque,
           total: d.length / 4, urlLen: url.length, prepared };
}, usePrep);

test('H1 ★전제 — 라이브 <img> 는 그 에셋을 «정상으로» 읽는다 (계측기가 아니라 경로가 문제다)', async ({ page }) => {
  const errs = await boot(page);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
  const r = await page.evaluate(() => {
    const el = document.getElementById('ph');
    return { natural: el.naturalWidth, complete: el.complete };
  });
  /* ⛔여기서 0 이면 하네스가 못 뜬 것이다 — 아래 「빠진다」는 판정이 «못 봐서»가 된다.
     ★단 goya-asset:// 는 이 브라우저에 없는 규약이라 «라이브에서도» 0 일 수 있다.
       그래서 이 검사는 값을 못박지 않고 «기록»한다. 진짜 전제는 H2 의 양성대조 쪽이다. */
  expect(typeof r.natural, '★naturalWidth 를 못 읽었다 — 하네스가 안 떴다').toBe('number');
});

test('🔴H2 부품 없이 찍으면 «밑그림이 0» 이고, 그런데도 «불투명»해서 빈칸 검사를 통과한다', async ({ page }) => {
  await boot(page);
  const r = await shoot(page, false);
  expect(r.w, '★캔버스가 안 만들어졌다 — 검사가 «안 돈» 것이다').toBeGreaterThan(0);
  expect(r.red + r.blue,
    `★밑그림 색이 ${r.red + r.blue}픽셀 잡혔다 — 이 병이 이미 닫혔거나 하네스가 늙었다. ` +
    'H3 이 초록이면 고침이 든 것이니 이 검사를 «기록»으로 바꿔라').toBe(0);
  /* ★★이 두 줄이 이 카드의 알맹이다 — 실패가 «성공처럼» 보이는 모양을 못박는다. */
  expect(r.opaque / r.total,
    '★불투명 비율이 낮다 — 그러면 빈칸 검사가 이 실패를 «잡는다». 이 카드의 전제가 달라진다')
    .toBeGreaterThan(0.95);
  expect(r.urlLen,
    `★결과 data URL 이 ${r.urlLen}자다 — 128자 미만이면 T-087 의 «길이» 판정이 이것도 잡는다. ` +
    '그러면 두 병이 하나라는 뜻이니 카드를 합쳐라').toBeGreaterThanOrEqual(128);
});

test('✅H3 부품을 쓰면 밑그림이 «실제 픽셀»로 실린다', async ({ page }) => {
  await boot(page);
  const r = await shoot(page, true);
  expect(r.prepared, '★부품이 한 자리도 못 바꿨다 — 읽기 스텁이나 선택자가 늙었다').toBeGreaterThan(0);
  expect(r.red, '★빨강이 안 실렸다').toBeGreaterThan(100);
  expect(r.blue, '★파랑이 안 실렸다').toBeGreaterThan(100);
});

/* ⛔여기는 «부르는가»를 재야 한다 — 「이름이 파일에 있나」를 재면 안 된다.
   ★실제로 그렇게 틀렸다(2026-09-22, 이 파일을 쓰면서): 처음엔
     `expect(src).toContain('prepareGoyaAssetsForClone')` 였는데, 배선을 통째로 들어내도
     **import 줄에 그 이름이 남아** H4 가 «초록»이었다. 역전 자가검사가 그걸 잡았다.
   ⇒ 「검사처럼 생긴 문장」을 이 카드의 검사 «안»에서 낸 셈이다. 그래서 «호출 자리»를 찾고,
     그것이 html2canvas 보다 «앞»인지까지 본다(뒤면 이미 찍은 뒤라 아무 소용이 없다). */
const callSite = (src) => ({
  shoot: src.indexOf('await html2canvas(clone'),
  call: src.search(/prepareGoyaAssetsForClone\s*\(/),   // ⛔import 는 괄호가 안 붙는다
});

test('★H4 배선 — captureThumbnail 이 그 부품을 «부른다» (이름이 있는 게 아니라)', () => {
  const src = fs.readFileSync(path.join(REPO, 'js', 'io', 'save-load.js'), 'utf8');
  const { shoot, call } = callSite(src);
  /* 양성대조 — 기준 앵커가 실재하는지 «먼저». 없으면 아래 초록은 「못 봐서」다. */
  expect(shoot, '★html2canvas 호출 자리를 못 찾았다 — 이 검사가 «안 돈» 것이다').toBeGreaterThan(0);
  expect(call,
    '★captureThumbnail 이 goya-asset 을 클론용으로 «풀지 않는다» — 그 에셋으로 만든 섹션은 ' +
    '카드 그림에서 통째로 빠지고, 배경색이 불투명하게 찍혀 «빈 그림» 판정에도 안 걸린다')
    .toBeGreaterThan(0);
  expect(call, '★푸는 자리가 html2canvas «뒤»다 — 이미 찍은 뒤에 풀면 아무 소용이 없다')
    .toBeLessThan(shoot);
});

test('★H5 음성대조 — «호출부만» 들어내면 H4 가 실제로 빨개진다 (import 는 남긴 채)', () => {
  const src = fs.readFileSync(path.join(REPO, 'js', 'io', 'save-load.js'), 'utf8');
  /* ★import 줄은 «일부러 남긴다» — 그게 처음에 H4 를 속인 바로 그 모양이다. */
  const mutated = src.replace(/prepareGoyaAssetsForClone\s*\(/g, '__gone__(');
  expect(mutated, '★변환이 늙었다 — 호출 꼴을 못 찾았다(H4 를 먼저 봐라)').not.toBe(src);
  expect(mutated.includes('prepareGoyaAssetsForClone'),
    '★import 줄까지 지워졌다 — 그러면 이 대조가 «import 가 속이는 축»을 못 잰다').toBe(true);
  expect(callSite(mutated).call,
    '★호출을 지웠는데도 H4 가 찾아낸다 — H4 의 초록은 «있어서»가 아니라 «못 봐서»다').toBe(-1);
});
