/* youtube-thumb-export-size.dom.spec.js — t13C-03 ① 유튜브 썸네일 «1280px (유튜브)» 폭 + 출력 1280×720 잠금 (261119 · 태양)
 *   꼴(현빈 Q1·Q2 권장안): 썸네일 = 높이 484 로 핀 박은 섹션 → 폭 1280 으로 내보내면 860 배치를 ×1280/860 으로 찍는다.
 *   484 × 1280/860 = 720.37 — CDP 원본이 720 줄인지 721 줄인지는 «여기서 잰다»(console 로 찍는다 · 단언은 최종 PNG 에만).
 *
 *   (잠금·JPG 품질 내림은 «썸네일 섹션(data-thumb="youtube")»만 — 보통 섹션의 1280 은 없다/자르지 않는다 · Y5)
 *   Y1 ★핀 484 썸네일 섹션 → 최종 PNG 1280×720 · 맨 아래 줄 = 섹션 바탕(캔버스 회색 비침 없음) · 핀 아래로 넘친 블럭은 그림에 없다(클론에서도 잘린다)
 *   Y2 ★잠금 — 핀 높이가 484 가 아니어도(500) 1280 은 언제나 1280×720 (잠금 없으면 744)
 *   Y3 ★게이트 켠 실제 내보내기(JPG) — 내려받은 파일 1280×720 · truth 도 같은 크기(sizeMismatch 없음)
 *   Y4 «1280px (유튜브)» 는 썸네일 섹션 선택칸에만 — 고르면 1280 으로 내보낸다 · 보통 섹션 칸엔 없다
 *   Y5 ★음성 — 보통(썸네일 아님) 긴 섹션을 1280 으로 내보내면 잘리지 않는다(높이 = 860 높이 × 1280/860)
 *
 * ★양성대조: _patches/yt-thumb-1-lock.patch (js/io/export-image.js 의 잠금만 걷음) ⇒ Y2 빨강(744) · Y1 은 «지키는» 칸(484 는 잠금 없이도 720).
 *   _patches/yt-thumb-1b-scope.patch (판정에서 썸네일 표시 조건을 걷어 폭만 봄 — 고치기 전 꼴) ⇒ Y5 빨강(720 으로 잘림).
 * 실행: NODE_PRESERVE_SYMLINKS=1 node --preserve-symlinks-main node_modules/@playwright/test/cli.js test \
 *        --config=tests/dom/playwright.dom.config.js --retries=0 --workers=1 tests/dom/youtube-thumb-export-size.dom.spec.js
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/* 실앱 PNG = main.js 'capture-section-cdp' 흉내(export-width-1000-upscale installCdpCapture 와 같은 손) — 원본 줄 수를 window.__asked 에 남긴다 */
async function installCdpCapture(page) {
  const cdp = await page.context().newCDPSession(page);
  await page.exposeFunction('__cdpShot', async ({ x = 0, y = 0, width, height, scale = 1 }) => {
    const s = Number(scale); const clipScale = (s > 0 && s <= 4) ? s : 1;   // main.js 와 같은 막기
    const r = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: Math.round(x), y: Math.round(y), width: Math.ceil(width), height: Math.ceil(height), scale: clipScale }, captureBeyondViewport: true, fromSurface: true });
    return r.data;
  });
  await page.evaluate(() => {
    const old = window.electronAPI;
    window.__asked = [];
    window.electronAPI = new Proxy({}, { get: (t, k) => (k === 'captureSectionCdp'
      ? async (o) => {
          const b64 = await window.__cdpShot(o);
          const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
          window.__asked.push({ ...o, rawW: im.naturalWidth, rawH: im.naturalHeight });
          return b64;
        }
      : old[k]) });
  });
}

const BG = [32, 64, 128];   // 섹션 바탕 #204080 — 캔버스 회색(#acacac)·흰색과 갈린다
/* 핀 썸네일 섹션 — 위 표식(분홍) · 핀 선 아래로 «통째로» 넘친 초록 블럭(높이 600 갭 뒤). thumb:false 면 표시·핀 없는 보통 섹션(같은 내용 · 높이 = 내용). */
async function buildPinned(page, id, h, { thumb = true } = {}) {
  await page.evaluate(([id, h, thumb]) => {
    const mark = thumb ? ` data-thumb="youtube" data-height-pin="true"` : '';
    const hs = thumb ? `;height:${h}px` : '';
    document.getElementById('canvas').insertAdjacentHTML('beforeend', `
      <div class="section-block" id="${id}" data-section="1" data-name="${id}"${mark} style="background-color:#204080${hs}">
        <div class="section-inner" style="padding-left:32px;padding-right:32px">
          <div class="row"><div class="gap-block" style="height:40px"></div></div>
          <div class="row"><div id="${id}_mk" style="width:100px;height:40px;background:#ff00aa"></div></div>
          <div class="row"><div class="gap-block" style="height:600px"></div></div>
          <div class="row"><div id="${id}_over" style="width:300px;height:80px;background:#30d030"></div></div>
        </div>
      </div>`);
  }, [id, h, thumb]);
}

const DECODE = `async (src) => { const im = new Image(); im.src = src; await im.decode();
  const cv = document.createElement('canvas'); cv.width = im.naturalWidth; cv.height = im.naturalHeight;
  cv.getContext('2d').drawImage(im, 0, 0); return cv; }`;
/* 그림 안에서 한 색(±12) 픽셀 수 · 맨 아래 줄이 바탕색(±6)인 비율 */
const STATS = `(cv, colors, bg) => { const W = cv.width, H = cv.height, D = cv.getContext('2d').getImageData(0, 0, W, H).data;
  const near = (i, c, t) => Math.abs(D[i] - c[0]) <= t && Math.abs(D[i + 1] - c[1]) <= t && Math.abs(D[i + 2] - c[2]) <= t;
  const count = {}; for (const [k, c] of Object.entries(colors)) { let n = 0; for (let i = 0; i < D.length; i += 4) if (near(i, c, 12)) n++; count[k] = n; }
  let bottomBg = 0; for (let x = 0; x < W; x++) if (near(((H - 1) * W + x) * 4, bg, 6)) bottomBg++;
  return { w: W, h: H, count, bottomBgShare: bottomBg / W }; }`;

test('Y1 ★핀 484 → 1280×720 · 끝 줄 = 섹션 바탕 · 넘친 블럭은 잘린다', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  const errs = await bootApp(page);
  await installCdpCapture(page);
  await buildPinned(page, 'yt484', 484);
  const r = await page.evaluate(async ([DECODE, STATS, BG]) => {
    const dec = eval(DECODE), stats = eval(STATS);
    const sec = document.getElementById('yt484');
    const live = { h: sec.offsetHeight, overBelow: document.getElementById('yt484_over').getBoundingClientRect().top >= sec.getBoundingClientRect().bottom };   // 두 rect 견주기 — 배율 상쇄
    window.__asked.length = 0;
    const cv = await dec(await window.exportSection(sec, 'png', 1280, { returnDataUrl: true }));
    return { live, asked: window.__asked.slice(), ...stats(cv, { mk: [255, 0, 170], over: [48, 208, 48] }, BG) };
  }, [DECODE, STATS, BG]);
  console.log('  Y1 측정:', JSON.stringify(r));   // ★rawH = CDP 원본 줄 수(720/721 질문의 답) — 단언 아님
  expect(r.live.h, '★전제 — 화면의 핀 섹션 높이 484').toBe(484);
  expect(r.live.overBelow, '★전제 — 초록 블럭이 섹션 바닥 아래에 있다(통째로 넘침)').toBe(true);
  expect(r.asked.length, '★전제 — CDP 캡처 한 번').toBe(1);
  expect(r.asked[0].width, '860 배치를 찍는다').toBe(860);
  expect(r.asked[0].height, '클론 높이도 핀 484').toBe(484);
  expect(r.asked[0].scale).toBeCloseTo(1280 / 860, 4);
  expect([r.w, r.h], '★최종 PNG').toEqual([1280, 720]);
  expect(r.count.mk, '★전제 — 위 표식이 그림에 있다').toBeGreaterThan(1000);
  expect(r.count.over, '★핀 아래로 넘친 블럭이 내보낸 그림에 나왔다(클론에서 안 잘림)').toBe(0);
  expect(r.bottomBgShare, '★맨 아래 줄이 섹션 바탕이 아니다(회색 줄 비침)').toBeGreaterThanOrEqual(0.99);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('Y2 ★잠금 — 핀 500 이어도 1280 은 1280×720 (위에서부터 720 줄)', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  const errs = await bootApp(page);
  await installCdpCapture(page);
  await buildPinned(page, 'yt500', 500);
  const r = await page.evaluate(async ([DECODE, STATS, BG]) => {
    const dec = eval(DECODE), stats = eval(STATS);
    const sec = document.getElementById('yt500');
    const cv = await dec(await window.exportSection(sec, 'png', 1280, { returnDataUrl: true }));
    const c860 = await dec(await window.exportSection(sec, 'png', 860, { returnDataUrl: true }));
    return { h: sec.offsetHeight, h860: c860.height, ...stats(cv, { mk: [255, 0, 170] }, BG) };
  }, [DECODE, STATS, BG]);
  console.log('  Y2:', JSON.stringify(r));
  expect(r.h, '★전제 — 핀 500').toBe(500);
  expect(r.h860, '860 은 잠그지 않는다').toBe(500);
  expect([r.w, r.h], '★1280 은 언제나 1280×720').toEqual([1280, 720]);
  expect(r.count.mk, '위 표식이 남는다(아래만 잘린다)').toBeGreaterThan(1000);
  expect(r.bottomBgShare).toBeGreaterThanOrEqual(0.99);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('Y3 ★게이트 켠 실제 내보내기 JPG 1280 — 파일 1280×720 · sizeMismatch 없음', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  const errs = await bootApp(page);
  await installCdpCapture(page);
  await buildPinned(page, 'ytG', 484);
  await page.evaluate(() => {
    window.__blobs = [];
    const orig = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (b) => { const u = orig(b); window.__blobs.push({ u, type: b.type }); return u; };
    URL.revokeObjectURL = () => {};
  });
  const r = await page.evaluate(async (DECODE) => {
    const dec = eval(DECODE);
    window.__asked.length = 0;
    const res = await window.exportSection(document.getElementById('ytG'), 'jpg', 1280);
    const f = await dec(window.__blobs[0].u);
    return { fw: f.width, fh: f.height, type: window.__blobs[0].type, gate: res && res.gate, asked: window.__asked.length };
  }, DECODE);
  console.log('  Y3:', JSON.stringify({ ...r, gate: r.gate && { tier: r.gate.tier, reasons: r.gate.reasons } }));
  expect(r.type).toBe('image/jpeg');
  expect([r.fw, r.fh], '내려받은 파일').toEqual([1280, 720]);
  expect(r.gate, '★전제 — 게이트가 돌았다').toBeTruthy();
  expect(r.asked, '★전제 — export + truth 두 번 캡처').toBe(2);
  expect(r.gate.reasons || []).not.toContain('sizeMismatch');
  expect(r.gate.metrics && r.gate.metrics.sizeMismatch, 'truth 와 export 크기가 다르다').toBeFalsy();
  expect(errs, errs.join('\n')).toEqual([]);
});

test('Y4 «1280px (유튜브)» 는 썸네일 섹션 칸에만 — 고르면 1280 으로 내보낸다 · 보통 섹션 칸엔 없다', async ({ page }) => {
  const errs = await bootApp(page);
  await buildPinned(page, 'ytS', 484);
  await buildPinned(page, 'plainS', 0, { thumb: false });
  const r = await page.evaluate(async () => {
    const calls = [];
    window.exportSection = async (s, f, w) => { calls.push(w); return { gate: null }; };
    await window.showSectionProperties(document.getElementById('plainS'));
    const plainOpts = [...document.getElementById('sec-export-width').options].map(o => o.value);
    await window.showSectionProperties(document.getElementById('ytS'));
    const sel = document.getElementById('sec-export-width');
    const opt = [...sel.options].find(o => o.value === '1280');
    sel.value = '1280';
    document.getElementById('sec-export-btn').click();
    return { label: opt && opt.textContent.trim(), calls, plainOpts };
  });
  expect(r.plainOpts, '★보통 섹션 칸에 1280 이 있다').toEqual(['860', '780', '1000']);
  expect(r.label).toBe('1280px (유튜브)');
  expect(r.calls, '클릭이 동기로 exportSection 을 부른다(첫 await 전)').toEqual([1280]);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('Y5 ★음성 — 보통 긴 섹션을 1280 으로 내보내면 잘리지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  const errs = await bootApp(page);
  await installCdpCapture(page);
  await buildPinned(page, 'plainL', 0, { thumb: false });
  const r = await page.evaluate(async ([DECODE, STATS, BG]) => {
    const dec = eval(DECODE), stats = eval(STATS);
    const sec = document.getElementById('plainL');
    const c860 = await dec(await window.exportSection(sec, 'png', 860, { returnDataUrl: true }));
    const cv = await dec(await window.exportSection(sec, 'png', 1280, { returnDataUrl: true }));
    return { thumb: sec.dataset.thumb ?? null, h860: c860.height, ...stats(cv, { over: [48, 208, 48] }, BG) };
  }, [DECODE, STATS, BG]);
  console.log('  Y5:', JSON.stringify(r));
  expect(r.thumb, '★전제 — 썸네일 아님').toBeNull();
  expect(r.h860, '★전제 — 내용이 720 보다 길다(잘리면 티가 난다)').toBeGreaterThan(720);
  expect(r.w).toBe(1280);
  expect(r.h, `★보통 섹션이 잘렸다 — 높이 ${r.h} ≠ ${r.h860}×1280/860`).toBe(Math.round(r.h860 * 1280 / 860));
  expect(r.count.over, '아래 초록 블럭이 그림에 남는다(잘리지 않음)').toBeGreaterThan(1000);
  expect(errs, errs.join('\n')).toEqual([]);
});
