/* checker-dark-toggle.dom.spec.js — S1 «체커 어둡게» 단추 (2026-10-04 현빈 「켜고 끄는 단추를 두기」·지디: 전역 :root·기본 끔·값 A).
 *
 * 무엇을 재나 — «앱 통째로»(bootApp: index.html + 전 모듈, electronAPI 가짜) 에서 진짜 단추·진짜 내보내기를 돌린다.
 *   D1 기본은 끔 — 저장값이 없으면 html 에 톤 속성이 없고, 토큰은 지금 값이고, 단추는 «끔»에 체크.
 *   D2 단추(페이지 패널 Grid 절 라디오)를 «진짜로» 누르면 켜지고, 새로고침 뒤에도 켜져 있고, 끄면 지금 값으로 돌아온다.
 *   D3 프로젝트 저장본(serializeProject)에 토글 상태가 «안» 실린다. 켠 채 만든 목업 인라인 체커는 어두운 hex 로 굳는다(넣는 줄 알고 넣는 부작용 — 단언으로 못박는다).
 *   D4 ★단독 HTML 배송본 — 켠 채 내보내도 체커 서명·토큰·톤 속성·켬 hex 가 «0건».
 *      음성대조: 같은 순간 라이브 화면엔 켬 체커가 실제로 그려져 있다(지울 것이 있었다) · 배송본에 앱 CSS 는 실렸다.
 *   D5 ★PNG — 켠 채 exportSection 한 그림에 켬 hex 픽셀이 «0»(native=실앱 CDP 길 · 웹 폴백 html2canvas 둘 다).
 *      음성대조: 같은 CDP 명령으로 «걷기 없이» 켬 체커 상자를 찍으면 켬 hex 픽셀이 > 50,000/60,000 (잣대가 산다).
 *      ⚠️웹 폴백(html2canvas)은 conic-gradient 를 못 그린다 — 걷기를 꺼도(변이 M2) 0 이었다(실측). 그 길의 0 은 «증거가 아니다», 기록만 한다.
 *   D6 카드 빈칸 '+' 대비 실측 — 끔·켬(A)·B(조상 덮기) 셋을 «그려서» 잰다(설계 표 1.51 은 계산값이었다).
 *
 * ⛔이 하네스로 «못 재는» 축: Electron 실앱의 localStorage 영속(앱 재기동)·네이티브 메뉴. 새로고침 영속까지만 잰다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/checker-dark-toggle.dom.spec.js
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const DARK_HEX = ['#7c7c7c', '#949494', '#868686', '#929292', '#838383'];          // css/editor-base.css 톤 규칙(값 A)
const DARK_RGB = [[124, 124, 124], [148, 148, 148], [134, 134, 134], [146, 146, 146], [131, 131, 131]];
const RGB_OF = (h) => `rgb(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)})`;   // CSSOM 은 인라인 hex 를 rgb() 로 고쳐 돌려준다(실측)
const CLEAR_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const rootTok = (page, n) => page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), n);
const toneAttr = (page) => page.evaluate(() => document.documentElement.getAttribute('data-goya-checker-tone'));

async function openPagePanel(page) {
  await page.evaluate(() => window.showPageProperties());
  await page.waitForSelector('#page-checker-dark-on', { state: 'attached' });
}

/* 켬 체커가 «그려질» 자리들 — 섹션 체크배경 · 빈 에셋 · 표 이미지칸(투명 쌍) · 켠 채 만든 목업(인라인으로 굳는다). 배경은 흰색(회색 없음). */
async function buildFixture(page) {
  await page.evaluate((png) => {
    const cv = document.getElementById('canvas');
    cv.innerHTML = `
      <div class="section-block sec-bg-empty" id="ckS" data-section="1" data-name="CK" data-bg-img-empty="1" style="background-color:#ffffff">
        <div class="section-inner">
          <div id="ckMark" style="width:100px;height:40px;background:#ff00aa"></div>
          <div class="asset-block" id="ckAsset" style="height:300px"></div>
          <div class="table-block" id="ckTb"><table class="tb-table"><tbody><tr data-row-img="true">
            <td><div class="tbl-img-cell" id="ckTic" style="height:60px;width:100%;position:relative;"></div></td>
          </tr></tbody></table></div>
          <div class="mockup-block" id="ckMkp"><div class="mkp-screen" id="ckMkps" style="width:200px;height:120px"></div></div>
        </div>
      </div>`;
    window.applyMockupScreenImage(document.getElementById('ckMkp'), png);
  }, CLEAR_PNG);
}

test('D1 기본은 끔 — 저장값 없음 ⇒ 톤 속성 없음 · 토큰은 지금 값 · 단추는 «끔»(Grid 절 안)', async ({ page }) => {
  const errs = await bootApp(page);
  expect(await page.evaluate(() => localStorage.getItem('gdt.checkerDark'))).toBeNull();
  expect(await toneAttr(page)).toBeNull();
  expect(await rootTok(page, '--goya-checker-big-a')).toBe('#d8d8d8');
  expect(await rootTok(page, '--goya-checker-small-a')).toBe('#e3e3e3');
  expect(await rootTok(page, '--goya-checker-clear-a')).toBe('#e0e0e0');
  await openPagePanel(page);
  const ui = await page.evaluate(() => {
    const on = document.getElementById('page-checker-dark-on'), off = document.getElementById('page-checker-dark-off');
    const sec = on.closest('.prop-section');
    return { on: on.checked, off: off.checked, type: on.type, nOn: document.querySelectorAll('#page-checker-dark-on').length,
             title: sec?.querySelector('.prop-section-title')?.textContent.trim(), sameSecAsPad: sec === document.getElementById('page-pad-hint-on')?.closest('.prop-section') };
  });
  expect(ui).toEqual({ on: false, off: true, type: 'radio', nOn: 1, title: 'Grid', sameSecAsPad: true });
  expect(errs).toEqual([]);
});

test('D2 ★단추를 진짜로 누르면 켜지고 · 새로고침 뒤에도 켜져 있고 · 끄면 지금 값으로 돌아온다', async ({ page }) => {
  const errs = await bootApp(page);
  await openPagePanel(page);
  await page.click('#page-checker-dark-on');
  expect(await toneAttr(page), '★켬을 눌렀는데 html 에 톤 속성이 없다').toBe('dark');
  expect(await page.evaluate(() => localStorage.getItem('gdt.checkerDark'))).toBe('{"on":true}');
  expect(await rootTok(page, '--goya-checker-big-a')).toBe('#7c7c7c');
  expect(await rootTok(page, '--goya-checker-big-b')).toBe('#949494');
  expect(await rootTok(page, '--goya-checker-small-a')).toBe('#868686');
  expect(await rootTok(page, '--goya-checker-small-b')).toBe('#929292');
  expect(await rootTok(page, '--goya-checker-clear-a')).toBe('#838383');
  expect(await rootTok(page, '--goya-checker-clear-b'), 'clear-b 는 «비침» 그대로').toBe('transparent');
  expect(await rootTok(page, '--goya-checker-svg-a'), 'svg 는 big 을 따라간다').toBe('#7c7c7c');
  expect(await rootTok(page, '--goya-checker-big-size'), '크기는 안 바뀐다').toBe('72px');
  // 실제로 «그려지는» 값 — 빈 에셋 블록의 computed 배경
  await buildFixture(page);
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('ckAsset')).backgroundImage)).toContain('rgb(124, 124, 124)');

  // 새로고침 — 패널을 «안 열어도» 부팅 때 켜져 있다
  await page.reload();
  await page.waitForFunction(() => typeof window.rebindAll === 'function', null, { timeout: 20000 });
  expect(await toneAttr(page), '★새로고침 뒤 켬이 사라졌다').toBe('dark');
  await openPagePanel(page);
  expect(await page.evaluate(() => document.getElementById('page-checker-dark-on').checked)).toBe(true);

  // 끈다(라디오는 «끔 쪽»을 누른다)
  await page.click('#page-checker-dark-off');
  expect(await toneAttr(page)).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('gdt.checkerDark'))).toBe('{"on":false}');
  expect(await rootTok(page, '--goya-checker-big-a')).toBe('#d8d8d8');
  expect(await rootTok(page, '--goya-checker-svg-a')).toBe('#d8d8d8');
  expect(errs).toEqual([]);
});

test('D3 프로젝트 저장본에 토글 상태가 «안» 실린다 — 켠 채 만든 목업 인라인만 어두운 hex 로 굳는다(넣는 줄 알고)', async ({ page }) => {
  const errs = await bootApp(page);
  await page.evaluate(() => window.setCheckerDarkOn(true));
  await buildFixture(page);
  const r = await page.evaluate(() => {
    const p = window.serializeProject();
    const s = typeof p === 'string' ? p : JSON.stringify(p);
    return { len: s.length, tone: (s.match(/goya-checker-tone/g) || []).length, key: (s.match(/checkerDark/g) || []).length,
             hasSection: s.includes('ckS'), mkp: document.getElementById('ckMkps').style.background };
  });
  expect(r.hasSection, '★저장본에 픽스처 섹션이 없다 — 엉뚱한 것을 셌다').toBe(true);
  expect(r.tone, '톤 속성이 저장본에 실렸다').toBe(0);
  expect(r.key, '토글 키가 저장본에 실렸다').toBe(0);
  expect(r.mkp, 'R1 — 켠 채 만든 목업은 그때 읽은 켬 값으로 굳는다(꺼도 안 돌아온다)').toContain(RGB_OF('#7c7c7c'));
  expect(errs).toEqual([]);
});

test('D4 ★단독 HTML — 켠 채 내보내도 체커 서명·토큰·톤 속성·켬 hex 가 0건 (음성대조: 라이브엔 켬 체커가 그려져 있다)', async ({ page }) => {
  const errs = await bootApp(page);
  await page.evaluate(() => window.setCheckerDarkOn(true));
  await buildFixture(page);
  const r = await page.evaluate(async () => {
    const live = {
      asset: getComputedStyle(document.getElementById('ckAsset')).backgroundImage,
      sec: getComputedStyle(document.getElementById('ckS')).backgroundImage,
      tic: getComputedStyle(document.getElementById('ckTic')).backgroundImage,
      mkp: document.getElementById('ckMkps').style.background,
    };
    let blob = null;
    const oC = URL.createObjectURL, oR = URL.revokeObjectURL, oClick = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = (b) => { blob = b; return 'blob:__stub__'; };
    URL.revokeObjectURL = () => {};
    HTMLAnchorElement.prototype.click = function () {};
    let err = null;
    try { await window.exportHTMLFile(); } catch (e) { err = String(e && e.message || e); }
    finally { URL.createObjectURL = oC; URL.revokeObjectURL = oR; HTMLAnchorElement.prototype.click = oClick; }
    const html = blob ? await blob.text() : '';
    return { live, err, len: html.length, hasAsset: html.includes('ckAsset'), hasAppCss: /\.asset-block\s*\{/.test(html), html };
  });
  expect(r.err).toBeNull();
  // 음성대조 — 지울 것이 «있었다»
  expect(r.live.asset, '★라이브 에셋이 켬 체커가 아니다 — 이 검사는 공회전').toContain('rgb(124, 124, 124)');
  expect(r.live.sec).toContain('rgb(124, 124, 124)');
  expect(r.live.tic).toContain('rgb(131, 131, 131)');
  expect(r.live.mkp).toContain(RGB_OF('#7c7c7c'));
  // 양성대조 — 배송본은 비지 않았고 앱 CSS 도 실렸다(체커만 빠진 것)
  expect(r.hasAsset, '★배송본에 픽스처가 없다').toBe(true);
  expect(r.hasAppCss, '★배송본에 앱 CSS(.asset-block 규칙)가 없다 — 우연한 0건일 수 있다').toBe(true);
  const count = (re) => (r.html.match(re) || []).length;
  const hits = {
    conic: count(/repeating-conic-gradient/g),
    token: count(/--goya-checker-/g),
    toneAttr: count(/goya-checker-tone/g),
    darkHex: DARK_HEX.reduce((n, h) => n + count(new RegExp(h, 'gi')), 0),
    darkRgb: DARK_RGB.reduce((n, [a, b, c]) => n + count(new RegExp(`rgb\\(${a},\\s*${b},\\s*${c}\\)`, 'g')), 0),
  };
  const ctx = [];
  for (const h of DARK_HEX) for (const m of r.html.matchAll(new RegExp(h, 'gi'))) ctx.push(r.html.slice(Math.max(0, m.index - 160), m.index + 40));
  console.log('  D4:', { len: r.len, ...hits }, ctx.length ? '\n  켬 hex 자리:\n  ' + ctx.join('\n  ---\n  ') : '');
  expect(hits).toEqual({ conic: 0, token: 0, toneAttr: 0, darkHex: 0, darkRgb: 0 });
  expect(errs).toEqual([]);
});

/* ★실앱의 PNG 는 «native» 길이다 — main.js 'capture-section-cdp' 가 CDP Page.captureScreenshot(captureBeyondViewport) 으로 클론을 찍는다.
   하네스의 electronAPI 는 모든 호출이 null 이라 그 길이 «Event» 로 죽는다(실측) ⇒ 같은 CDP 명령을 Playwright CDP 세션으로 그대로 흉내 낸다.
   ⚠️html2canvas(웹 폴백)는 conic-gradient 를 «못 그린다»(실측: 걷기 없이 찍어도 켬 픽셀 0) — 그 길만 재면 «거짓 0» 이다. */
async function installCdpCapture(page) {
  const cdp = await page.context().newCDPSession(page);
  await page.exposeFunction('__cdpShot', async ({ x = 0, y = 0, width, height }) => {
    const r = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: Math.round(x), y: Math.round(y), width: Math.ceil(width), height: Math.ceil(height), scale: 1 }, captureBeyondViewport: true, fromSurface: true });
    return r.data;
  });
  await page.evaluate(() => {
    const old = window.electronAPI;
    window.electronAPI = new Proxy({}, { get: (t, k) => (k === 'captureSectionCdp' ? (o) => window.__cdpShot(o) : old[k]) });
  });
}

test('D5 ★PNG(native = 실앱 길) — 켠 채 exportSection 한 그림에 켬 hex 픽셀 0 (음성대조: 같은 CDP 로 켬 체커 상자를 찍으면 > 50,000/60,000)', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  const errs = await bootApp(page);
  await installCdpCapture(page);
  await page.evaluate(() => window.setCheckerDarkOn(true));
  await buildFixture(page);
  const r = await page.evaluate(async (DARK) => {
    const countDark = async (url) => {
      const i = new Image(); i.src = url; await i.decode();
      const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data; let n = 0;
      let mark = 0;
      for (let k = 0; k < d.length; k += 4) { if (DARK.some(([a, b, cc]) => d[k] === a && d[k + 1] === b && d[k + 2] === cc)) n++; if (d[k] === 255 && d[k + 1] === 0 && d[k + 2] === 170) mark++; }
      return { n, mark, w: c.width, h: c.height };
    };
    const sec = document.getElementById('ckS');
    /* 음성대조 — 같은 CDP 명령으로 «걷기 없이» 켬 체커를 찍으면 센다(잣대가 산다).
       ⚠️라이브 «섹션»을 찍으면 흔들렸다(실측: 37,126 / 17,874 / 34점 — 캔버스 배율·부팅 때 뜨는 덮개에 따라 자리가 달라진다).
       ⇒ 캔버스와 무관한 «맨 위 고정 상자»(같은 .asset-block 규칙 = 켬 체커)를 찍는다. 300×200 = 60,000점. */
    const probe = document.createElement('div');
    probe.className = 'asset-block';
    probe.style.cssText = 'position:fixed;left:0;top:0;width:300px;height:200px;z-index:2147483647;outline:none';
    document.body.appendChild(probe);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    let live = null;
    try { live = await countDark('data:image/png;base64,' + await window.__cdpShot({ x: scrollX, y: scrollY, width: 300, height: 200 })); }
    catch (e) { live = { err: String(e && e.message || e).slice(0, 160) }; }
    probe.remove();
    const run = async (opts) => {
      try { const url = await window.exportSection(sec, 'png', 860, { returnDataUrl: true, ...opts }); return typeof url === 'string' && url.startsWith('data:image/png') ? await countDark(url) : { err: 'not png' }; }
      catch (e) { return { err: String(e && (e.message || e.type) || e).slice(0, 200) }; }
    };
    const native = await run({});
    const h2c = await run({ forceH2C: true });
    return { live, native, h2c, attrAfter: document.documentElement.getAttribute('data-goya-checker-tone') };
  }, DARK_RGB);
  console.log('  D5:', JSON.stringify(r));
  expect(r.live?.n, '★잣대 — 걷기 없이 CDP 로 찍은 켬 체커 상자(60,000점)에서 켬 픽셀이 거의 없다(잣대가 죽었다)').toBeGreaterThan(50000);
  expect(r.native.err, 'native 내보내기가 죽었다').toBeUndefined();
  expect(r.native.w).toBeGreaterThan(100);
  expect(r.native.mark, '★내보낸 PNG 에 섹션 표식(#ff00aa 100×40)이 없다 — 엉뚱한 곳을 찍었으면 0 은 증거가 아니다').toBeGreaterThan(3000);
  expect(r.native.n, '★켠 채 내보낸 PNG(native)에 켬 체커 픽셀').toBe(0);
  expect(r.h2c.err, '웹 폴백 내보내기가 죽었다').toBeUndefined();
  expect(r.h2c.n, '켠 채 내보낸 PNG(웹 폴백)에 켬 체커 픽셀 — ⚠️html2canvas 가 conic 을 못 그려 늘 0(변이 M2 실측), 회귀 기록용').toBe(0);
  expect(r.attrAfter, '내보내기가 사용자 토글을 바꿨다').toBe('dark');
  expect(errs).toEqual([]);
});

test('D6 카드 빈칸 「+」 대비 실측 — 끔 · 켬(A) · B(조상 덮기, 비교용) 를 «그려서» 잰다', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 600 });
  const errs = await bootApp(page);
  /* 36×36 칸 = 72px 격자의 «한 칸»만 보인다 → 바탕이 한 색. 위치 0 0 이면 왼쪽 위 칸(b), -36px 0 이면 오른쪽 위 칸(a). */
  const mk = (id, extra) => `<div class="canvas-block" id="${id}" style="${extra || ''}"><div class="cvb-img-empty" style="width:36px;height:36px"></div></div>`
                          + `<div class="canvas-block" id="${id}A" style="${extra || ''}"><div class="cvb-img-empty" style="width:36px;height:36px;background-position:-36px 0"></div></div>`;
  const measure = async (sel) => {
    const b64 = (await (await page.$(sel + ' .cvb-img-empty')).screenshot()).toString('base64');
    return page.evaluate(async (s) => {
      const i = new Image(); i.src = 'data:image/png;base64,' + s; await i.decode();
      const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data; const freq = {}; let min = 999, minPx = null;
      for (let k = 0; k < d.length; k += 4) { const key = d[k] + ',' + d[k + 1] + ',' + d[k + 2]; freq[key] = (freq[key] || 0) + 1; const y = 0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2]; if (y < min) { min = y; minPx = [d[k], d[k + 1], d[k + 2]]; } }
      const bg = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0].split(',').map(Number);
      const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      const L = (p) => 0.2126 * lin(p[0]) + 0.7152 * lin(p[1]) + 0.0722 * lin(p[2]);
      const cr = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
      const ideal = bg.map(v => Math.round(v * 0.65));               // rgba(0,0,0,.35) 를 바탕 위에 합성한 «이론» 획 색
      return { bg, glyphDarkest: minPx, measured: +cr(bg, minPx).toFixed(2), ideal: +cr(bg, ideal).toFixed(2), glyphPx: d.length / 4 - (freq[bg.join(',')] || 0) };
    }, b64);
  };
  const stage = async (html) => page.evaluate((h) => {
    let st = document.getElementById('plus-stage');
    if (!st) { st = document.createElement('div'); st.id = 'plus-stage'; st.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;background:#fff;padding:20px;display:flex;gap:20px'; document.body.appendChild(st); }
    st.innerHTML = h;
  }, html);
  const B = '--goya-checker-big-a:#4c4c4c;--goya-checker-big-b:#646464';
  await stage(mk('pOff') + mk('pB', B));
  const off = { b: await measure('#pOff'), a: await measure('#pOffA') };
  const bb = { b: await measure('#pB'), a: await measure('#pBA') };
  await page.evaluate(() => window.setCheckerDarkOn(true));
  await page.waitForTimeout(50);
  const on = { b: await measure('#pOff'), a: await measure('#pOffA') };
  const row = (n, o) => `${n}: a칸 bg=${o.a.bg} 실측 ${o.a.measured} (이론 ${o.a.ideal}) · b칸 bg=${o.b.bg} 실측 ${o.b.measured} (이론 ${o.b.ideal})`;
  console.log('  D6 「+」 대비\n  ' + [row('끔', off), row('켬A', on), row('B', bb)].join('\n  '));
  // 전제 — 바탕이 정말 그 칸 색이고, 「+」 획이 실제로 그려졌다
  expect(off.b.bg).toEqual([240, 240, 240]); expect(off.a.bg).toEqual([216, 216, 216]);
  expect(on.b.bg).toEqual([148, 148, 148]);  expect(on.a.bg).toEqual([124, 124, 124]);
  expect(bb.b.bg).toEqual([100, 100, 100]);  expect(bb.a.bg).toEqual([76, 76, 76]);
  for (const o of [off, on, bb]) for (const k of ['a', 'b']) expect(o[k].glyphPx, '★「+」 획이 안 그려졌다').toBeGreaterThan(10);
  // 설계 판단의 근거 — 켬(A)의 「+」 는 B 보다 덜 묻힌다(두 칸 모두, 실측으로)
  expect(Math.min(on.a.measured, on.b.measured)).toBeGreaterThan(Math.max(bb.a.measured, bb.b.measured));
  expect(errs).toEqual([]);
});
