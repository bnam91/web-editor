/* checker-section-tone.dom.spec.js — S1 «체커 어둡게»를 ★섹션마다
 *   (2026-10-06 현빈 「체커가 일괄이 아니라 섹션마다 … [체크 배경 끄기] 이거할때마다 옆에 있을 옵션」.
 *    그림으로 여쭌 뒤 ★R1 확정 = 「섹션 ★배경 체커만 · 빈 카드는 그대로」)
 *
 * ★이 파일이 checker-dark-toggle.dom.spec.js 를 ★대신한다 — 그 판(전역 :root · localStorage)은 2026-10-06 에 걷어냈다.
 *   ⛔전역 토글을 되살리는 변경이 오면 S5 가 빨강이어야 한다. 그게 「명부를 둘로 두지 마라」를 잠그는 자다.
 *
 * 무엇을 재나 — «앱 통째로»(bootApp) 에서 진짜 패널·진짜 내보내기를 돌린다.
 *   S1 기본 = 라이트 ⇒ 토큰이 한 글자도 안 바뀐다(옛 판과 픽셀 동일). dataset 없음.
 *   S2 ★섹션 격리 — 섹션 둘 중 ★하나만 켜면 그 섹션 배경만 어둡고 ★다른 섹션은 밝다. «두 칸을 같이» 단언한다
 *      (한쪽만 보면 「전역으로 켜졌다」와 구분이 안 된다).
 *   S3 ★R1 경계 — 켠 섹션 «안»의 빈 카드·에셋·표칸·도형은 ★안 바뀐다(현빈: 「빈 카드는 그대로」).
 *      ⛔이게 빨강이면 누군가 --goya-checker-big-* 를 섹션에서 직접 덮은 것이다(상속 사고).
 *   S4 ★자리와 조건 — 라디오가 [체크 배경] 단추 «바로 뒤 형제»이고, 체크 배경이 꺼져 있으면 ★없다.
 *   S5 ★명부 하나 — 페이지 패널에 전역 라디오가 없고, 전역 보기설정 키·톤 속성이 어디에도 없다.
 *   S6 저장·복원 — dataset 가 저장본에 실리고 되살아난다(마이그레이션: 옛 프로젝트는 키가 없어 라이트).
 *   S7 ★단독 HTML — 체커 서명 0 · 체커 «토큰 선언» 0. ★양성대조: 거르개를 끄면 토큰이 실제로 샌다.
 *   S8 ★PNG — 어두운 체커 픽셀 0 (음성대조: 같은 CDP 로 걷기 없이 찍으면 센다 — 잣대가 산다).
 *
 * ⛔이 하네스로 «못 재는» 축: Electron 실앱 재기동. 새로고침까지만 잰다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/checker-section-tone.dom.spec.js
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const DARK_A = '#7c7c7c', DARK_B = '#949494';                      // css/editor-base.css .section-block[data-checker-tone="dark"]
const LIGHT_A = '#d8d8d8', LIGHT_B = '#f0f0f0';                    // :root 정본(--goya-checker-big-*)
const RGB = (h) => `rgb(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)})`;
const DARK_RGB = [[124, 124, 124], [148, 148, 148]];

/* 섹션 둘 — 둘 다 체크 배경 ON. 섹션1 안에는 R1 경계를 재는 «빈 카드·에셋·표칸»도 같이 둔다. */
async function buildFixture(page) {
  await page.evaluate(() => {
    document.getElementById('canvas').innerHTML = `
      <div class="section-block sec-bg-empty" id="ckS1" data-section="1" data-name="S1" data-bg-img-empty="1" style="background-color:#ffffff">
        <div class="section-inner">
          <div id="ckMark" style="width:100px;height:40px;background:#ff00aa"></div>
          <div class="canvas-block" id="ckCard"><div class="cvb-img-empty" id="ckCardImg" style="width:80px;height:80px"></div></div>
          <div class="asset-block" id="ckAsset" style="height:120px"></div>
          <div class="table-block" id="ckTb"><table class="tb-table"><tbody><tr data-row-img="true">
            <td><div class="tbl-img-cell" id="ckTic" style="height:60px;width:100%;position:relative;"></div></td>
          </tr></tbody></table></div>
        </div>
      </div>
      <div class="section-block sec-bg-empty" id="ckS2" data-section="1" data-name="S2" data-bg-img-empty="1" style="background-color:#ffffff">
        <div class="section-inner"><div style="height:60px"></div></div>
      </div>`;
  });
}

const bgOf = (page, id) => page.evaluate((i) => getComputedStyle(document.getElementById(i)).backgroundImage, id);
const openSec = async (page, id) => {
  await page.evaluate((i) => window.showSectionProperties(document.getElementById(i)), id);
  await page.waitForSelector('#sec-bg-img-empty', { state: 'attached' });
};

test('S1 기본 = 라이트 — dataset 없음 · 토큰이 한 글자도 안 바뀐다(옛 판과 픽셀 동일)', async ({ page }) => {
  const errs = await bootApp(page);
  await buildFixture(page);
  const t = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const g = (n) => cs.getPropertyValue(n).trim();
    const s1 = getComputedStyle(document.getElementById('ckS1'));
    return {
      tone: document.getElementById('ckS1').dataset.checkerTone ?? null,
      bigA: g('--goya-checker-big-a'), bigB: g('--goya-checker-big-b'),
      smallA: g('--goya-checker-small-a'), smallB: g('--goya-checker-small-b'),
      clearA: g('--goya-checker-clear-a'), clearB: g('--goya-checker-clear-b'),
      svgA: g('--goya-checker-svg-a'), svgB: g('--goya-checker-svg-b'),
      bigSize: g('--goya-checker-big-size'), smallSize: g('--goya-checker-small-size'),
      secbgA: getComputedStyle(document.getElementById('ckS1')).getPropertyValue('--goya-checker-secbg-a').trim(),
      drawn: s1.backgroundImage,
    };
  });
  expect(t.tone, '새 프로젝트에 톤이 박혀 있다').toBeNull();
  // ★옛 판(v0.9.6) 의 :root 값 전부 — 한 글자라도 다르면 「픽셀 동일」이 깨진 것
  expect({ bigA: t.bigA, bigB: t.bigB, smallA: t.smallA, smallB: t.smallB, clearA: t.clearA, clearB: t.clearB, svgA: t.svgA, svgB: t.svgB, bigSize: t.bigSize, smallSize: t.smallSize })
    .toEqual({ bigA: LIGHT_A, bigB: LIGHT_B, smallA: '#e3e3e3', smallB: '#efefef', clearA: '#e0e0e0', clearB: 'transparent', svgA: LIGHT_A, svgB: LIGHT_B, bigSize: '72px', smallSize: '16px' });
  expect(t.secbgA, '새 토큰의 기본값은 big 정본을 «가리킨다»').toBe(LIGHT_A);
  expect(t.drawn, '★전제 — 섹션 배경이 실제로 체커로 그려져 있다(아니면 아래 검사가 공회전)').toContain(RGB(LIGHT_A));
  expect(errs).toEqual([]);
});

test('S2 ★섹션 격리 — 섹션1만 켜면 섹션1 배경만 어둡고 섹션2 는 밝다 (두 칸을 같이 단언)', async ({ page }) => {
  const errs = await bootApp(page);
  await buildFixture(page);
  const before = { s1: await bgOf(page, 'ckS1'), s2: await bgOf(page, 'ckS2') };
  expect(before.s1, '★전제 — 켜기 «전»엔 둘 다 밝다').toContain(RGB(LIGHT_A));
  expect(before.s2).toContain(RGB(LIGHT_A));

  await openSec(page, 'ckS1');
  await page.click('#sec-checker-tone-on');

  const after = await page.evaluate(() => ({
    s1: getComputedStyle(document.getElementById('ckS1')).backgroundImage,
    s2: getComputedStyle(document.getElementById('ckS2')).backgroundImage,
    ds1: document.getElementById('ckS1').dataset.checkerTone ?? null,
    ds2: document.getElementById('ckS2').dataset.checkerTone ?? null,
    rootA: getComputedStyle(document.documentElement).getPropertyValue('--goya-checker-big-a').trim(),
  }));
  expect(after.ds1).toBe('dark');
  expect(after.ds2, '★옆 섹션에 톤이 번졌다').toBeNull();
  expect(after.s1, '★켠 섹션이 안 어두워졌다').toContain(RGB(DARK_A));
  expect(after.s1).toContain(RGB(DARK_B));
  expect(after.s2, '★안 켠 섹션까지 어두워졌다 — 전역으로 샌 것이다').toContain(RGB(LIGHT_A));
  expect(after.rootA, '★:root 토큰이 바뀌었다 — 섹션 범위가 아니라 전역이 된 것이다').toBe(LIGHT_A);

  // 끄면 되돌아온다
  await page.click('#sec-checker-tone-off');
  expect(await page.evaluate(() => document.getElementById('ckS1').dataset.checkerTone ?? null)).toBeNull();
  expect(await bgOf(page, 'ckS1')).toContain(RGB(LIGHT_A));
  expect(errs).toEqual([]);
});

test('S3 ★R1 경계 — 켠 섹션 «안»의 빈 카드·에셋·표칸은 그대로다 (현빈: 「빈 카드는 그대로」)', async ({ page }) => {
  const errs = await bootApp(page);
  await buildFixture(page);
  const before = await page.evaluate(() => ({
    card: getComputedStyle(document.getElementById('ckCardImg')).backgroundImage,
    asset: getComputedStyle(document.getElementById('ckAsset')).backgroundImage,
    tic: getComputedStyle(document.getElementById('ckTic')).backgroundImage,
  }));
  // ★전제 — 셋 다 실제로 체커로 그려져 있다(아니면 「안 바뀌었다」가 공허하다)
  for (const [k, v] of Object.entries(before)) expect(v, `★전제 — ${k} 가 체커가 아니다`).toContain('repeating-conic-gradient');

  await openSec(page, 'ckS1');
  await page.click('#sec-checker-tone-on');

  const after = await page.evaluate(() => ({
    card: getComputedStyle(document.getElementById('ckCardImg')).backgroundImage,
    asset: getComputedStyle(document.getElementById('ckAsset')).backgroundImage,
    tic: getComputedStyle(document.getElementById('ckTic')).backgroundImage,
    sec: getComputedStyle(document.getElementById('ckS1')).backgroundImage,
  }));
  expect(after.sec, '★전제 — 섹션 배경은 어두워졌어야 한다(안 그러면 아래 「안 바뀜」은 아무것도 안 잰다)').toContain(RGB(DARK_A));
  expect(after.card, '★빈 카드가 같이 어두워졌다 — big 토큰을 섹션에서 덮은 것이다(R1 위반)').toBe(before.card);
  expect(after.asset, '★에셋 블록이 같이 어두워졌다(R1 위반)').toBe(before.asset);
  expect(after.tic, '★표 이미지칸이 같이 어두워졌다(R1 위반)').toBe(before.tic);
  expect(errs).toEqual([]);
});

test('S4 ★자리 — 라디오는 [체크 배경] 단추 바로 뒤 형제이고, 체크 배경이 꺼져 있으면 «없다»', async ({ page }) => {
  const errs = await bootApp(page);
  await buildFixture(page);
  await openSec(page, 'ckS1');
  const on = await page.evaluate(() => {
    const btn = document.getElementById('sec-bg-img-empty');
    const row = document.getElementById('sec-checker-tone-on')?.closest('.prop-row');
    return { nBtn: document.querySelectorAll('#sec-bg-img-empty').length, btnTxt: btn?.textContent.trim(),
             nRadio: document.querySelectorAll('#sec-checker-tone-on').length,
             isNextSibling: !!row && btn?.nextElementSibling === row,
             type: document.getElementById('sec-checker-tone-on')?.type,
             offChecked: document.getElementById('sec-checker-tone-off')?.checked };
  });
  expect(on).toEqual({ nBtn: 1, btnTxt: '체크 배경 끄기', nRadio: 1, isNextSibling: true, type: 'radio', offChecked: true });

  // 체크 배경을 끄면 — 라디오가 사라진다(정할 것이 없다)
  await page.click('#sec-bg-img-empty');
  await page.waitForSelector('#sec-bg-img-empty', { state: 'attached' });
  const off = await page.evaluate(() => ({
    btnTxt: document.getElementById('sec-bg-img-empty')?.textContent.trim(),
    nRadio: document.querySelectorAll('#sec-checker-tone-on').length,
  }));
  expect(off).toEqual({ btnTxt: '체크 배경으로 두기', nRadio: 0 });
  expect(errs).toEqual([]);
});

test('S5 ★명부 하나 — 전역 라디오·전역 보기설정 키·html 톤 속성이 «어디에도» 없다', async ({ page }) => {
  const errs = await bootApp(page);
  await buildFixture(page);
  await openSec(page, 'ckS1');
  await page.click('#sec-checker-tone-on');
  await page.evaluate(() => window.showPageProperties());
  const r = await page.evaluate(() => ({
    pageRadio: document.querySelectorAll('#page-checker-dark-on, #page-checker-dark-off').length,
    lsKey: localStorage.getItem('gdt.checkerDark'),
    htmlAttr: document.documentElement.getAttribute('data-goya-checker-tone'),
    win: ['readCheckerDarkOn', 'setCheckerDarkOn'].filter(k => typeof window[k] === 'function'),
  }));
  expect(r, '★전역 토글이 되살아났다 — 같은 것을 두 군데서 정하게 된다(2026-10-06 에 일부러 걷어냈다)')
    .toEqual({ pageRadio: 0, lsKey: null, htmlAttr: null, win: [] });
  expect(errs).toEqual([]);
});

test('S6 저장·복원 — 톤이 저장본에 실리고 되살아난다 · 톤 없는 옛 저장본은 라이트', async ({ page }) => {
  const errs = await bootApp(page);
  await buildFixture(page);
  await openSec(page, 'ckS1');
  await page.click('#sec-checker-tone-on');
  const r = await page.evaluate(() => {
    const p = window.serializeProject();
    const s = typeof p === 'string' ? p : JSON.stringify(p);
    /* ⚠️저장본은 JSON 문자열이라 속성 따옴표가 \" 로 escape 돼 있다 — `tone="dark"` 로 찾으면 ★안 걸린다
         (2026-10-06 실측: 그렇게 썼다가 0건이 나와 «제품이 안 싣는다»로 잘못 읽을 뻔했다). 이름만 센다. */
    return { hasSection: s.includes('ckS1'), tone: (s.match(/data-checker-tone/g) || []).length,
             globalKey: (s.match(/checkerDark|goya-checker-tone/g) || []).length };
  });
  expect(r.hasSection, '★저장본에 픽스처 섹션이 없다 — 엉뚱한 것을 셌다').toBe(true);
  expect(r.tone, '★섹션 톤이 저장본에 안 실렸다 — 다시 열면 사라진다').toBeGreaterThan(0);
  expect(r.globalKey, '전역 토글 흔적이 저장본에 실렸다').toBe(0);

  // ★마이그레이션 — 톤 키가 «없는» 섹션(옛 저장본과 같은 꼴)은 라이트
  const old = await page.evaluate(() => {
    const s = document.getElementById('ckS2');           // 톤을 한 번도 안 건드린 섹션
    return { ds: s.dataset.checkerTone ?? null, bg: getComputedStyle(s).backgroundImage };
  });
  expect(old.ds).toBeNull();
  expect(old.bg, '★톤 키가 없는 섹션이 라이트가 아니다 — 옛 프로젝트의 그림이 바뀐다').toContain(RGB(LIGHT_A));
  expect(errs).toEqual([]);
});

test('S7 ★단독 HTML — 체커 서명 0 · 체커 토큰 선언 0 (양성대조: 거르개를 끄면 실제로 샌다)', async ({ page }) => {
  const errs = await bootApp(page);
  await buildFixture(page);
  await openSec(page, 'ckS1');
  await page.click('#sec-checker-tone-on');
  const r = await page.evaluate(async () => {
    const mod = await import('../../js/io/export-css-collect.js');
    const sec = document.getElementById('ckS1');
    const css = mod.collectCanvasCss(sec, document);

    /* ★양성대조 — «같은 판»에서 거르개만 무력화하면 토큰이 실제로 샌다.
       ⛔제품 코드를 고치지 않는다: CSSOM 규칙을 그대로 두고 수집기가 보는 «규칙 집합»만 손으로 훑어
         거르개를 안 통과시킨 결과(=cssText 그대로)를 만든다. 「샐 것이 있었나」를 재는 자다. */
    let raw = 0, rawSample = '';
    for (const ss of document.styleSheets) {
      let rules = null; try { rules = ss.cssRules; } catch (_) { continue; }
      for (const rl of rules || []) {
        if (!rl.selectorText || !rl.style) continue;
        if (!/data-checker-tone/.test(rl.selectorText)) continue;
        const n = (rl.cssText.match(/--goya-checker-/g) || []).length;
        if (n) { raw += n; rawSample = rawSample || rl.cssText.slice(0, 160); }
      }
    }
    return {
      len: css.length,
      hasAppCss: /\.section-block/.test(css),
      conic: (css.match(/repeating-conic-gradient/g) || []).length,
      token: (css.match(/--goya-checker-/g) || []).length,
      toneSel: (css.match(/data-checker-tone/g) || []).length,
      darkHex: (css.match(new RegExp('#7c7c7c|#949494', 'gi')) || []).length,
      raw, rawSample,
      liveSec: getComputedStyle(sec).backgroundImage,
    };
  });
  console.log('  S7:', JSON.stringify({ len: r.len, conic: r.conic, token: r.token, toneSel: r.toneSel, darkHex: r.darkHex, raw: r.raw, rawSample: r.rawSample }));
  // 음성대조 — 지울 것이 «있었다»
  expect(r.liveSec, '★라이브 섹션이 어두운 체커가 아니다 — 이 검사는 공회전').toContain(RGB(DARK_A));
  expect(r.raw, '★양성대조 — 톤 규칙에 체커 토큰 선언이 «있어야» 한다(없으면 0 은 증거가 아니다)').toBeGreaterThan(0);
  // 양성대조 — 배송본이 비지 않았다(앱 CSS 는 실렸고, 체커만 빠진 것)
  expect(r.hasAppCss, '★배송본 CSS 에 섹션 규칙이 없다 — 우연한 0건일 수 있다').toBe(true);
  expect({ conic: r.conic, token: r.token, toneSel: r.toneSel, darkHex: r.darkHex }).toEqual({ conic: 0, token: 0, toneSel: 0, darkHex: 0 });
  expect(errs).toEqual([]);
});

/* ★실앱의 PNG 는 «native» 길이다 — main.js 'capture-section-cdp'. 하네스의 electronAPI 는 null 이라 그 길이 죽는다
   ⇒ 같은 CDP 명령을 Playwright CDP 세션으로 흉내 낸다(옛 spec 과 같은 손). */
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

test('S8 ★PNG — 톤을 켠 채 내보낸 그림에 어두운 체커 픽셀 0 (음성대조: 걷기 없이 찍으면 센다)', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  const errs = await bootApp(page);
  await installCdpCapture(page);
  await buildFixture(page);
  await openSec(page, 'ckS1');
  await page.click('#sec-checker-tone-on');
  const r = await page.evaluate(async (DARK) => {
    const count = async (url) => {
      const i = new Image(); i.src = url; await i.decode();
      const c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
      const g = c.getContext('2d'); g.drawImage(i, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let n = 0, mark = 0;
      for (let k = 0; k < d.length; k += 4) {
        if (DARK.some(([a, b, cc]) => d[k] === a && d[k + 1] === b && d[k + 2] === cc)) n++;
        if (d[k] === 255 && d[k + 1] === 0 && d[k + 2] === 170) mark++;
      }
      return { n, mark, w: c.width, h: c.height };
    };
    /* 음성대조 — 캔버스와 무관한 «맨 위 고정 상자»에 같은 톤 규칙을 걸어 걷기 없이 찍는다. 300×200 = 60,000점. */
    const probe = document.createElement('div');
    probe.className = 'section-block sec-bg-empty';
    probe.setAttribute('data-checker-tone', 'dark');
    probe.style.cssText = 'position:fixed;left:0;top:0;width:300px;height:200px;z-index:2147483647;outline:none';
    document.body.appendChild(probe);
    await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
    let live = null;
    try { live = await count('data:image/png;base64,' + await window.__cdpShot({ x: scrollX, y: scrollY, width: 300, height: 200 })); }
    catch (e) { live = { err: String(e && e.message || e).slice(0, 160) }; }
    probe.remove();

    const sec = document.getElementById('ckS1');
    let native = null;
    try {
      const url = await window.exportSection(sec, 'png', 860, { returnDataUrl: true });
      native = (typeof url === 'string' && url.startsWith('data:image/png')) ? await count(url) : { err: 'not png' };
    } catch (e) { native = { err: String(e && (e.message || e.type) || e).slice(0, 200) }; }
    return { live, native, toneAfter: sec.dataset.checkerTone };
  }, DARK_RGB);
  console.log('  S8:', JSON.stringify(r));
  expect(r.live?.n, '★잣대 — 걷기 없이 찍은 어두운 체커 상자(60,000점)에 어두운 픽셀이 거의 없다(잣대가 죽었다)').toBeGreaterThan(50000);
  expect(r.native.err, 'native 내보내기가 죽었다').toBeUndefined();
  expect(r.native.mark, '★내보낸 PNG 에 섹션 표식(#ff00aa 100×40)이 없다 — 엉뚱한 곳을 찍었으면 0 은 증거가 아니다').toBeGreaterThan(3000);
  expect(r.native.n, '★톤을 켠 채 내보낸 PNG 에 어두운 체커 픽셀').toBe(0);
  expect(r.toneAfter, '내보내기가 사용자 설정을 바꿨다').toBe('dark');
  expect(errs).toEqual([]);
});
