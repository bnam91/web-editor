/* export-width-1000-upscale.dom.spec.js — 0.9.12 ③ SECTION-EXPORT-1000PX-OPTION-01 (현빈 결정 Q1 ㉮ · 2026-11-12)
 *   현빈 원문: 「지금 860px 내보내기가 있는데 1000px 내보내기도 추가(기존 860 과 별도 옵션)」
 *   결정: 1000 = 860 화면 «그대로 확대»(글자·줄바꿈·여백 동일 · 해상도만 1000). 780 은 지금처럼 «다시 배치».
 *   ★선명도: 860 배치를 «캡처 배율 1000/860» 으로 찍는다(main.js capture-section-cdp clip.scale) — 860 PNG 를 늘리지 않는다.
 *
 *   U1 경로 = main.js 핸들러가 렌더러의 scale 을 clip.scale 로 넘기고(기본 1) 범위를 막는다.
 *   U2 ★섹션 PNG 1000 — 출력 1000 × (860높이 × 1000/860) · 캡처 요청 {width 860, scale 1.163} · 구도 = 860 PNG 와 같다
 *   U3 ★dpr=1 에서 «업스케일 아님» — CDP 가 돌려준 원본 PNG 폭이 이미 1000(늘린 게 아니다) + 선명도 자(늘린 그림보다 날카롭다)
 *   U4 ★게이트 truth 도 같은 배율 — 실제 내보내기(게이트 켬)에서 sizeMismatch 없음 · 내려받은 파일 1000폭
 *   U5 ★배치 내보내기(exportAllSections 1000) — 섹션마다 파일 1000폭 · 높이 비율대로
 *   U6 ★780 회귀 — 지금 방식 그대로: 클론 780 으로 다시 배치 · scale 1 · 출력 780
 *   U7 선택칸 두 곳 — 섹션(#sec-export-width)·페이지(#page-export-width)에 「1000px」 · 고르면 1000 으로 내보낸다
 *   U8 페이지 선택 기억(localStorage gdt.pageExport) — 1000 이 저장되고 패널을 다시 열면 복원된다
 *
 * ★양성대조(고침만 되돌리면 빨강):
 *   · js/io/export-image.js 만 aded4a28a 로 되돌림 ⇒ U2·U3·U4·U5 빨강(클론 1000 재배치 · scale 없음 · 원본 860/1000 재배치)
 *   · main.js 만 되돌림 ⇒ U1 빨강
 *   · prop-section.js / prop-page.js option 줄만 지움 ⇒ U7·U8 빨강
 *   · U6 은 «지키는» 칸 — 되돌려도 초록이어야 한다(780 무변의 증거).
 * ⛔HTML·Figma 내보내기는 이 폭을 «안» 쓴다 — exportSection/exportAllSections 호출처는 prop-section·prop-page·
 *   Export 메뉴(860 고정) 셋뿐(grep). 그래서 여기 칸이 없다.
 * 실행: NODE_PRESERVE_SYMLINKS=1 node --preserve-symlinks-main node_modules/@playwright/test/cli.js test \
 *        --config=tests/dom/playwright.dom.config.js --retries=0 --workers=1 tests/dom/export-width-1000-upscale.dom.spec.js
 */
const { test, expect } = require('@playwright/test');
const { bootApp, src } = require('./_root-harness.js');

const K = 1000 / 860;

/* 실앱 PNG = main.js 'capture-section-cdp' — 같은 CDP 명령을 «같은 인자 처리»로 흉내(checker-asset-tone installCdpCapture 와 같은 손 + scale).
 * ★요청 인자와 원본 PNG 폭을 window.__asked 에 남긴다(U3 의 «업스케일 아님» 자). */
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

/* 실제 내용 든 섹션 둘 — 글(제목·본문 여러 줄) · 풀블리드 그림(무늬 1200×800) · 고정폭 그림 220 · 갭. 빈 껍데기 아님. */
async function buildFixture(page) {
  await page.evaluate(() => {
    const cv = document.createElement('canvas'); cv.width = 1200; cv.height = 800;
    const c = cv.getContext('2d');
    c.fillStyle = '#fff'; c.fillRect(0, 0, 1200, 800);
    for (let x = 0; x < 1200; x += 6) { c.fillStyle = (x / 6) % 2 ? '#1a1a1a' : '#e0e0e0'; c.fillRect(x, 0, 3, 800); }
    c.fillStyle = '#d02040'; c.font = 'bold 90px sans-serif'; c.fillText('GODITOR 1000', 120, 420);
    const IMG = cv.toDataURL('image/png');
    const P = '고디터 1000px 내보내기 검사용 본문입니다. 줄바꿈이 860 화면과 같아야 합니다. '.repeat(4);
    const sec = (id, n) => `
      <div class="section-block" id="${id}" data-section="1" data-name="${n}" style="background-color:#ffffff">
        <div class="section-inner" style="padding-left:32px;padding-right:32px">
          <div class="row"><div class="gap-block" style="height:40px"></div></div>
          <div class="row"><div id="${id}_mkA" style="width:100px;height:40px;background:#ff00aa"></div></div>
          <div class="row"><div class="text-block"><h2 class="tb-h2" style="font-size:40px;margin:0">${n} 제목 — 확대 내보내기</h2></div></div>
          <div class="row"><div class="text-block"><p style="font-size:18px;line-height:1.6;margin:0">${P}</p></div></div>
          <div class="row"><div id="${id}_mkB" style="width:120px;height:30px;background:#00b4ff;margin-left:300px"></div></div>
          <div class="row" data-layout="stack">
            <div class="asset-block has-image" id="${id}_full" data-use-padx="true"
                 style="width:calc(100% + 64px);margin-left:-32px;margin-right:-32px;height:573.33px;">
              <div class="asset-img-clip"><img class="asset-img" src="${IMG}" style="object-fit:cover"></div>
            </div>
          </div>
          <div class="row"><div id="${id}_mkC" style="width:80px;height:24px;background:#30d030;margin-left:600px"></div></div>
          <div class="row" data-layout="stack">
            <div class="asset-block has-image" id="${id}_fixed" style="width:220px;align-self:center;height:165px;">
              <div class="asset-img-clip"><img class="asset-img" src="${IMG}" style="object-fit:cover"></div>
            </div>
          </div>
          <div class="row"><div class="gap-block" style="height:40px"></div></div>
        </div>
      </div>`;
    document.getElementById('canvas').innerHTML = sec('xS1', 'S1') + sec('xS2', 'S2');
    return Promise.all([...document.querySelectorAll('#canvas img')].map(i => i.decode().catch(() => {})));
  });
}

/* PNG(dataURL·Blob URL) → {w,h,data} — 페이지 안에서 푼다 */
const DECODE = `async (src) => { const im = new Image(); im.src = src; await im.decode();
  const cv = document.createElement('canvas'); cv.width = im.naturalWidth; cv.height = im.naturalHeight;
  const cx = cv.getContext('2d'); cx.drawImage(im, 0, 0); return { cv, w: cv.width, h: cv.height }; }`;

test('U1 main.js — capture-section-cdp 가 렌더러 scale 을 clip.scale 로 넘긴다(기본 1 · 범위 막기)', () => {
  const m = src('main.js');
  const i = m.indexOf("ipcMain.handle('capture-section-cdp'");
  expect(i, '핸들러가 없다').toBeGreaterThan(0);
  const h = m.slice(i, m.indexOf('});', i));
  expect(h, '인자에 scale(기본 1)을 안 받는다').toMatch(/\{\s*x = 0, y = 0, width, height, scale = 1\s*\}/);
  expect(h, 'clip.scale 이 아직 1 로 박혀 있다').not.toMatch(/scale:\s*1,/);
  expect(h, 'clip.scale 에 막은 값을 쓰지 않는다').toMatch(/scale:\s*clipScale/);
  expect(h, '범위 막기(0<s≤4 아니면 1)가 없다').toMatch(/\(_s > 0 && _s <= 4\) \? _s : 1/);
});

test('U2·U3 ★섹션 PNG 1000 = 860 구도 그대로 확대 · dpr=1 에서도 캡처 배율(업스케일 아님)', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  const errs = await bootApp(page);
  await installCdpCapture(page);
  await buildFixture(page);
  const r = await page.evaluate(async (DECODE) => {
    const dec = eval(DECODE);
    const sec = document.getElementById('xS1');
    window.__asked.length = 0;
    const u860 = await window.exportSection(sec, 'png', 860, { returnDataUrl: true });
    const a860 = window.__asked.slice(); window.__asked.length = 0;
    const u1000 = await window.exportSection(sec, 'png', 1000, { returnDataUrl: true });
    const a1000 = window.__asked.slice();
    const p860 = await dec(u860), p1000 = await dec(u1000);
    /* ★구도 자 = «표식 상자 좌표» (지디 261112 — 픽셀 평균차는 리샘플링·안티앨리어싱·무늬 모아레만으로 문턱을 넘어 «구도»를 못 가른다).
       표식 셋: A(글 위) · B(본문 «뒤» — 줄바꿈이 바뀌면 y 가 바뀐다) · C(풀블리드 그림 «뒤» — 그림 높이가 바뀌면 y 가 바뀐다).
       출력 PNG 에서 그 색의 순수 픽셀 상자를 찾아 1000 상자 = 860 상자 × 1000/860 (±2px) 인지 본다. */
    const bbox = (cv, [R, G, Bc]) => { const { width: W, height: H } = cv; const D = cv.getContext('2d').getImageData(0, 0, W, H).data;
      let x0 = W, y0 = H, x1 = -1, y1 = -1;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4;
        if (Math.abs(D[i] - R) <= 12 && Math.abs(D[i + 1] - G) <= 12 && Math.abs(D[i + 2] - Bc) <= 12) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
      return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }; };
    const MK = { A: [255, 0, 170], B: [0, 180, 255], C: [48, 208, 48] };
    const marks = {}; for (const [k, c] of Object.entries(MK)) marks[k] = { b860: bbox(p860.cv, c), b1000: bbox(p1000.cv, c) };
    /* 진단(단언 아님) — 옛 자의 8.40 이 어디서 나는지: 1/10 축소 평균차를 «글 띠(A~B)»·«그림 띠(B~C)» 로 갈라 찍는다 */
    const small = (cv) => { const d = document.createElement('canvas'); d.width = 86; d.height = Math.round(p860.h / 10);
      const dx = d.getContext('2d'); dx.imageSmoothingQuality = 'high'; dx.drawImage(cv, 0, 0, d.width, d.height); return dx.getImageData(0, 0, d.width, d.height).data; };
    const SA = small(p1000.cv), SB = small(p860.cv);
    const band = (ya, yb) => { let s = 0, n = 0; for (let y = Math.floor(ya / 10); y < Math.min(Math.ceil(yb / 10), Math.round(p860.h / 10)); y++) for (let x = 0; x < 86; x++) {
      const i = (y * 86 + x) * 4; s += (Math.abs(SA[i] - SB[i]) + Math.abs(SA[i + 1] - SB[i + 1]) + Math.abs(SA[i + 2] - SB[i + 2])) / 3; n++; } return n ? +(s / n).toFixed(2) : null; };
    const mA = marks.A.b860, mB = marks.B.b860, mC = marks.C.b860;
    const diag = (mA && mB && mC) ? { all: band(0, p860.h), text: band(mA.y, mB.y), image: band(mB.y + mB.h, mC.y) } : null;
    /* 선명도 자: 860 PNG 를 1000 으로 «늘린» 그림과 1000 PNG 의 제곱기울기 합(번짐이 크면 작아진다) */
    const up = document.createElement('canvas'); up.width = p1000.w; up.height = p1000.h;
    const ux = up.getContext('2d'); ux.imageSmoothingQuality = 'high'; ux.drawImage(p860.cv, 0, 0, p1000.w, p1000.h);
    const energy = (cx, w, h) => { const D = cx.getImageData(0, 0, w, h).data; let e = 0;
      for (let y = 0; y < h; y++) for (let x = 1; x < w; x++) { const i = (y * w + x) * 4; const g = D[i] - D[i - 4]; e += g * g; } return e; };
    return { dpr: window.devicePixelRatio, w860: p860.w, h860: p860.h, w1000: p1000.w, h1000: p1000.h, a860, a1000,
      marks, diag,
      eNative: energy(p1000.cv.getContext('2d'), p1000.w, p1000.h), eUp: energy(ux, p1000.w, p1000.h) };
  }, DECODE);
  console.log('  U2:', JSON.stringify({ ...r, a860: r.a860.map(a => [a.width, a.scale, a.rawW]), a1000: r.a1000.map(a => [a.width, a.scale, a.rawW]) }));
  expect(r.dpr, '전제 — 이 칸은 dpr=1 을 잰다').toBe(1);
  expect(r.w860).toBe(860);
  expect(r.w1000, '1000 내보내기 폭').toBe(1000);
  expect(r.h1000, `높이가 860 높이(${r.h860}) × 1000/860 이 아니다 — 다시 배치됐다`).toBeGreaterThanOrEqual(Math.round(r.h860 * K) - 1);
  expect(r.h1000).toBeLessThanOrEqual(Math.round(r.h860 * K) + 1);
  expect(r.a1000.length, '캡처 요청 수').toBe(1);
  expect(r.a1000[0].width, '★1000 은 860 배치를 찍어야 한다(클론 폭)').toBe(860);
  expect(r.a1000[0].scale, '★캡처 배율 1000/860').toBeCloseTo(K, 4);
  expect(r.a860[0].scale ?? 1, '860 은 배율 1').toBe(1);
  /* U3 ★업스케일 아님 — 원본 PNG 가 이미 1000 폭(늘린 게 아니다) */
  expect(r.a1000[0].rawW, '★CDP 원본 폭이 1000 이 아니다 — 860 을 늘려 1000 을 만든다(흐림)').toBe(1000);
  for (const k of ['A', 'B', 'C']) {
    const { b860, b1000 } = r.marks[k];
    expect(b860 && b1000, `★전제 — 표식 ${k} 가 PNG 에 없다`).toBeTruthy();
    for (const f of ['x', 'y', 'w', 'h']) {
      expect(Math.abs(b1000[f] - b860[f] * K), `구도 — 표식 ${k}.${f}: 1000 ${b1000[f]} ≠ 860 ${b860[f]}×1000/860=${(b860[f] * K).toFixed(1)}`).toBeLessThanOrEqual(2);
    }
  }
  expect(r.eNative, `선명도 — 1000(${r.eNative}) 이 860 을 늘린 그림(${r.eUp})보다 날카롭지 않다`).toBeGreaterThan(r.eUp * 1.05);
  expect(errs, errs.join('\n')).toEqual([]);
});

/* 내려받은 파일 잡기 — triggerDownload 가 쓰는 Blob URL 을 가로챈다 */
const catchBlobs = (page) => page.evaluate(() => {
  window.__blobs = [];
  const orig = URL.createObjectURL.bind(URL);
  URL.createObjectURL = (b) => { const u = orig(b); window.__blobs.push(u); return u; };
  URL.revokeObjectURL = () => {};
});

test('U4 ★게이트 켠 실제 내보내기 1000 — 파일 1000폭 · truth 도 같은 배율(sizeMismatch 없음)', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  const errs = await bootApp(page);
  await installCdpCapture(page);
  await buildFixture(page);
  await catchBlobs(page);
  const r = await page.evaluate(async (DECODE) => {
    const dec = eval(DECODE);
    const ref = await dec(await window.exportSection(document.getElementById('xS1'), 'png', 860, { returnDataUrl: true }));
    window.__asked.length = 0; window.__blobs.length = 0;
    const res = await window.exportSection(document.getElementById('xS1'), 'png', 1000);
    const f = await dec(window.__blobs[0]);
    return { h860: ref.h, fw: f.w, fh: f.h, gate: res && res.gate, asked: window.__asked.map(a => [a.width, a.scale]) };
  }, DECODE);
  console.log('  U4:', JSON.stringify({ ...r, gate: r.gate && { tier: r.gate.tier, reasons: r.gate.reasons } }));
  expect(r.fw, '내려받은 파일 폭').toBe(1000);
  expect(Math.abs(r.fh - Math.round(r.h860 * K))).toBeLessThanOrEqual(1);
  expect(r.gate, '★전제 — 게이트가 돌았다(이 칸은 truth 를 잰다)').toBeTruthy();
  expect(r.asked.length, '★전제 — export + truth 두 번 캡처').toBe(2);
  for (const [w, s] of r.asked) { expect(w, 'truth/export 클론 폭').toBe(860); expect(s).toBeCloseTo(K, 4); }
  expect(r.gate.reasons || [], `게이트 사유 ${JSON.stringify(r.gate.reasons)}`).not.toContain('sizeMismatch');
  expect(r.gate.metrics && r.gate.metrics.sizeMismatch, 'truth 와 export 크기가 다르다').toBeFalsy();
  expect(errs, errs.join('\n')).toEqual([]);
});

test('U5 ★배치 내보내기 1000 — 섹션마다 파일 1000폭 · 높이 비율대로', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  const errs = await bootApp(page);
  await installCdpCapture(page);
  await buildFixture(page);
  await catchBlobs(page);
  const r = await page.evaluate(async (DECODE) => {
    const dec = eval(DECODE);
    const ref = [];
    for (const id of ['xS1', 'xS2']) ref.push((await dec(await window.exportSection(document.getElementById(id), 'png', 860, { returnDataUrl: true }))).h);
    window.__blobs.length = 0;
    const res = await window.exportAllSections('png', 1000, null, { gate: false });
    const files = [];
    for (const u of window.__blobs) { const p = await dec(u); files.push([p.w, p.h]); }
    return { ref, files, total: res.total, failed: res.failed };
  }, DECODE);
  console.log('  U5:', JSON.stringify(r));
  expect(r.total).toBe(2);
  expect(r.failed).toEqual([]);
  expect(r.files.length, '파일 수').toBe(2);
  r.files.forEach(([w, h], i) => {
    expect(w, `섹션 ${i + 1} 폭`).toBe(1000);
    expect(Math.abs(h - Math.round(r.ref[i] * K)), `섹션 ${i + 1} 높이 ${h} ≠ ${r.ref[i]}×1000/860`).toBeLessThanOrEqual(1);
  });
  expect(errs, errs.join('\n')).toEqual([]);
});

test('U6 780 회귀 — 지금 방식 그대로(클론 780 으로 다시 배치 · 배율 1 · 출력 780)', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  const errs = await bootApp(page);
  await installCdpCapture(page);
  await buildFixture(page);
  const r = await page.evaluate(async (DECODE) => {
    const dec = eval(DECODE);
    const sec = document.getElementById('xS1');
    const h860 = (await dec(await window.exportSection(sec, 'png', 860, { returnDataUrl: true }))).h;
    window.__asked.length = 0;
    const p = await dec(await window.exportSection(sec, 'png', 780, { returnDataUrl: true }));
    return { h860, w: p.w, h: p.h, asked: window.__asked.map(a => ({ width: a.width, scale: a.scale ?? 1, rawW: a.rawW })) };
  }, DECODE);
  console.log('  U6:', JSON.stringify(r));
  expect(r.w).toBe(780);
  expect(r.asked[0].width, '780 은 클론 폭 780(다시 배치)').toBe(780);
  expect(r.asked[0].scale, '780 은 배율 1').toBe(1);
  expect(r.asked[0].rawW).toBe(780);
  /* 다시 배치의 증거 — 단순 축소면 h860×780/860 이다. 본문 줄이 늘어 그보다 «커야» 한다. */
  expect(r.h, `780 높이 ${r.h} 가 단순 축소(${Math.round(r.h860 * 780 / 860)})와 같다 — 재배치가 아니다`).toBeGreaterThan(Math.round(r.h860 * 780 / 860) + 2);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('U7 선택칸 두 곳에 「1000px」 — 고르면 1000 으로 내보낸다', async ({ page }) => {
  const errs = await bootApp(page);
  await buildFixture(page);
  const r = await page.evaluate(async () => {
    const calls = [];
    window.exportSection = async (s, f, w) => { calls.push(['sec', w]); return { gate: null }; };
    window.exportAllSections = async (f, w) => { calls.push(['page', w]); return { total: 0, failed: [], results: [] }; };
    window.confirm = () => true;
    await window.showSectionProperties(document.getElementById('xS1'));
    const sSel = document.getElementById('sec-export-width');
    const sOpts = [...sSel.options].map(o => [o.value, o.textContent.trim()]);
    sSel.value = '1000';
    document.getElementById('sec-export-btn').click();
    await new Promise(r => setTimeout(r, 50));
    window.showPageProperties();
    const pSel = document.getElementById('page-export-width');
    const pOpts = [...pSel.options].map(o => [o.value, o.textContent.trim()]);
    pSel.value = '1000';
    document.getElementById('page-export-all-btn').click();
    await new Promise(r => setTimeout(r, 50));
    return { sOpts, pOpts, calls };
  });
  console.log('  U7:', JSON.stringify(r));
  const WANT = [['860', '860px (기본)'], ['780', '780px (쿠팡)'], ['1000', '1000px']];
  expect(r.sOpts, '섹션 선택칸').toEqual(WANT);
  expect(r.pOpts, '페이지 선택칸').toEqual(WANT);
  expect(r.calls).toContainEqual(['sec', 1000]);
  expect(r.calls).toContainEqual(['page', 1000]);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('U8 페이지 선택 기억 — 1000 을 고르면 gdt.pageExport 에 실리고 다시 열면 복원', async ({ page }) => {
  const errs = await bootApp(page);
  await buildFixture(page);
  const r = await page.evaluate(() => {
    localStorage.removeItem('gdt.pageExport');
    window.showPageProperties();
    const s = document.getElementById('page-export-width');
    s.value = '1000'; s.dispatchEvent(new Event('change'));
    const saved = JSON.parse(localStorage.getItem('gdt.pageExport') || '{}');
    document.getElementById('page-export-width').value = '860';   // 화면 값 흔들기 — 복원은 저장본에서 와야 한다
    window.showPageProperties();
    return { saved, restored: document.getElementById('page-export-width').value };
  });
  expect(r.saved.w, '저장된 폭').toBe(1000);
  expect(r.restored, '다시 연 패널의 폭').toBe('1000');
  expect(errs, errs.join('\n')).toEqual([]);
});
