/* checker-asset-tone.dom.spec.js — t4-15 «체커 어둡게»를 ★에셋블럭에도 (현빈 ④ 확정 · 2026-10-22 · 지디 발주)
 *   현빈 원문: 「배경이미지 체크패턴 어둡게 옵션이 있던데, 일반 에셋블럭도 넣어줘」
 *   ⇒ 「있던데」 = 섹션 체커(tests/dom/checker-section-tone.dom.spec.js · v0.9.7~). 요구는 «에셋블럭 쪽» 이다.
 *   ⛔js/props/prop-section.js 는 안 건드린다 — 거긴 다 돼 있다.
 *
 * 설계(섹션 선례 그대로 · 새 관용구 0): 전용 쌍 --goya-checker-asset-a/b (기본값 = 큰 쌍을 «가리킨다»)
 *   · .asset-block[data-checker-tone="dark"] 가 그 쌍만 덮는다 · 정본 = ab.dataset.checkerTone 하나.
 *
 *   T1 ⑴ 양성 — 라디오 켬 → 그 에셋 배경에 #7c7c7c·#949494 가 든다(옆 에셋은 밝다 · 두 칸 같이).
 *   T2 ⑵ ★음성대조 — 속성 없음 → 고치기 «전»과 같은 글자(큰 쌍을 바로 쓴 탐침과 같다) ∧ :root 큰 쌍을 바꾸면 따라온다.
 *      ★고치기 전에도 초록이어야 한다 — 이것이 「옛 프로젝트가 안 바뀐다」를 잠근다. ⛔빼지 마라.
 *   T3 ⑶ ★덮기 음성대조 — 어둡게 켠 에셋 «안»의 다른 체커(빈 카드 · 큰 쌍)는 그대로 = «전용 쌍»의 존재 이유.
 *   T4 ⑷ 라디오 그룹 — 섹션 토글과 에셋 토글이 한 문서에 같이 있어도 서로를 안 끈다(name 이 같으면 섞인다 —
 *      이 발주의 가장 조용한 함정).
 *   T5 입구 — 조건 없는 줄 하나(체크 배경 켜기류 ⛔) · 이미지 있는 에셋에선 숨김(현빈 QA 자 「불필요한 프롭힌트」).
 *   T6 저장본 — 톤이 실린다 · 체커 무늬·어두운 값 0.   T7 단독 HTML — 서명 0 · 토큰 0 (양성대조 raw > 0).
 *   T8 PNG — 어두운 체커 픽셀 0 (잣대 음성대조: 걷기 없이 찍으면 센다).
 *
 * 변이 명부(각 단언이 무엇을 잡나 · 사본에서 잼 · ~/taeyang-098/reports/S5-T4-15.md):
 *   M1 전용 쌍을 큰 쌍으로 되돌림(톤 규칙이 --goya-checker-big-a/b 를 덮음) ⇒ T3 빨강
 *   M2 기본값 var() 를 hex 로 박음 ⇒ T2 빨강
 *   M3 라디오 name 을 sec-checker-tone 과 같게 ⇒ T4 빨강
 *   ⇒ 변이 없이 모두 초록이면 그 단언은 항등식이다.
 *
 * ⛔범위 밖(이름만): ASSET-TONE-NOT-SEEN-BY-INLINE-CHECKER-01 (js/checker-tokens.js 는 :root 만 읽는다 ⇒ JS 가 인라인으로
 *   박는 체커는 이 톤을 안 따른다) · ASSET-CHECKER-TONE-NO-CONTRAST-AID-01 (js/canvas-contrast.js 는 섹션 톤만 본다).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/checker-asset-tone.dom.spec.js
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const DARK_A = '#7c7c7c', DARK_B = '#949494';                      // css/editor-base.css — 섹션과 같은 두 값(WCAG 표를 물려받는다)
const LIGHT_A = '#d8d8d8', LIGHT_B = '#f0f0f0';                    // :root 정본(--goya-checker-big-*)
const RGB = (h) => `rgb(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)})`;
const DARK_RGB = [[124, 124, 124], [148, 148, 148]];
/* 고치기 «전» .asset-block 무늬의 글자 그대로(css/editor-layout.css:775 · f68ea15f) — 탐침이 이 꼴로 그린다 */
const OLD_BG = 'repeating-conic-gradient(var(--goya-checker-big-a) 0% 25%, var(--goya-checker-big-b) 0% 50%) 0 0 / var(--goya-checker-big-size) var(--goya-checker-big-size)';

/* 섹션1: 에셋 둘(akA · akB) + 표식 · akA 안에 빈 카드 탐침(⑶ · 선택자가 `.canvas-block .cvb-img-empty` 라 캔버스블록 안에 둔다 —
   red0 에서 맨 cvb-img-empty 로 두었다가 «전제: 체커가 아니다»에서 멈췄다 = 내 픽스처 결함) / 섹션2: 체크 배경 켠 섹션(⑷ 섹션 라디오 자리) */
async function buildFixture(page) {
  await page.evaluate((OLD) => {
    document.getElementById('canvas').innerHTML = `
      <div class="section-block" id="akS1" data-section="1" data-name="S1" style="background-color:#ffffff">
        <div class="section-inner">
          <div id="akMark" style="width:100px;height:40px;background:#ff00aa"></div>
          <div class="asset-block" id="akA" style="height:200px">
            <div class="canvas-block" id="akCv"><div class="cvb-img-empty" id="akCard" style="width:80px;height:80px"></div></div>
          </div>
          <div class="asset-block" id="akB" style="height:120px"></div>
          <div id="akOld" style="width:200px;height:120px;background:${OLD}"></div>
        </div>
      </div>
      <div class="section-block sec-bg-empty" id="akS2" data-section="1" data-name="S2" data-bg-img-empty="1" style="background-color:#ffffff">
        <div class="section-inner"><div style="height:60px"></div></div>
      </div>`;
  }, OLD_BG);
}
const bgOf = (page, id) => page.evaluate((i) => getComputedStyle(document.getElementById(i)).backgroundImage, id);
/* 켜는 문이 없으면 30초 기다리지 않고 «없다»로 멈춘다(고치기 전 판의 빨강이 이 한 줄에서 서게) */
const clickTone = async (page) => {
  expect(await page.locator('#asset-checker-tone-on').count(), '★전제 — 에셋 패널에 «체커 어둡게» 켬 라디오가 없다').toBe(1);
  await page.click('#asset-checker-tone-on');
};
const openAsset = async (page, id) => {
  await page.evaluate((i) => window.showAssetProperties(document.getElementById(i)), id);
  await page.waitForSelector('#asset-bg-clear', { state: 'attached' });
};

test('T1 ⑴ 양성 — 에셋 라디오 켬 → 그 에셋 배경만 #7c7c7c·#949494 (옆 에셋은 밝다)', async ({ page }) => {
  const errs = await bootApp(page);
  await buildFixture(page);
  expect(await bgOf(page, 'akA'), '★전제 — 켜기 «전» 에셋이 밝은 체커다').toContain(RGB(LIGHT_A));
  await openAsset(page, 'akA');
  expect(await page.locator('#asset-checker-tone-on').count(), '★빈 에셋 패널에 «체커 어둡게» 라디오가 없다').toBe(1);
  await clickTone(page);
  const r = await page.evaluate(() => ({
    a: getComputedStyle(document.getElementById('akA')).backgroundImage,
    b: getComputedStyle(document.getElementById('akB')).backgroundImage,
    dsA: document.getElementById('akA').dataset.checkerTone ?? null,
    dsB: document.getElementById('akB').dataset.checkerTone ?? null,
    rootA: getComputedStyle(document.documentElement).getPropertyValue('--goya-checker-big-a').trim(),
  }));
  expect(r.dsA).toBe('dark');
  expect(r.dsB, '★옆 에셋에 톤이 번졌다').toBeNull();
  expect(r.a, '★켠 에셋이 안 어두워졌다').toContain(RGB(DARK_A));
  expect(r.a).toContain(RGB(DARK_B));
  expect(r.b, '★안 켠 에셋까지 어두워졌다').toContain(RGB(LIGHT_A));
  expect(r.rootA, '★:root 큰 쌍이 바뀌었다 — 에셋 범위가 아니라 전역이다').toBe(LIGHT_A);
  await page.click('#asset-checker-tone-off');
  expect(await page.evaluate(() => document.getElementById('akA').dataset.checkerTone ?? null)).toBeNull();
  expect(await bgOf(page, 'akA')).toContain(RGB(LIGHT_A));
  expect(errs).toEqual([]);
});

test('T2 ⑵ ★음성대조 — 속성 없는 에셋 = 고치기 전 꼴과 같은 글자 · :root 큰 쌍을 바꾸면 따라온다(가리킨다)', async ({ page }) => {
  const errs = await bootApp(page);
  await buildFixture(page);
  const r = await page.evaluate(() => {
    const g = (i) => getComputedStyle(document.getElementById(i)).backgroundImage;
    const before = { asset: g('akA'), old: g('akOld') };
    /* ★«가리킨다»를 재는 이빨 — 큰 쌍의 값을 잠깐 바꾸면 에셋도 바뀌어야 한다(hex 를 박으면 안 따라온다). */
    const st = document.createElement('style'); st.id = '__ak-big'; st.textContent = ':root{--goya-checker-big-a:#123456;--goya-checker-big-b:#654321}';
    document.head.appendChild(st);
    const moved = { asset: g('akA'), old: g('akOld') };
    st.remove();
    return { before, moved, ds: document.getElementById('akA').dataset.checkerTone ?? null };
  });
  expect(r.ds).toBeNull();
  expect(r.before.old, '★전제 — 탐침이 체커다').toContain(RGB(LIGHT_A));
  expect(r.before.asset, '★속성 없는 에셋이 고치기 전 꼴과 다르다 — 옛 프로젝트의 그림이 바뀐다').toBe(r.before.old);
  expect(r.moved.old, '★전제 — 큰 쌍을 바꾸면 탐침이 바뀐다').toContain('rgb(18, 52, 86)');
  expect(r.moved.asset, '★에셋이 큰 쌍을 «가리키지» 않는다(값을 박았다) — 정본이 둘이 된다').toBe(r.moved.old);
  expect(errs).toEqual([]);
});

test('T3 ⑶ ★덮기 음성대조 — 어둡게 켠 에셋 «안»의 빈 카드 체커는 그대로', async ({ page }) => {
  const errs = await bootApp(page);
  await buildFixture(page);
  const before = await bgOf(page, 'akCard');
  expect(before, '★전제 — 안쪽 빈 카드가 체커다(아니면 「그대로」가 공허하다)').toContain('repeating-conic-gradient');
  await openAsset(page, 'akA');
  await clickTone(page);
  const after = { card: await bgOf(page, 'akCard'), asset: await bgOf(page, 'akA') };
  expect(after.asset, '★전제 — 에셋은 어두워졌어야 한다').toContain(RGB(DARK_A));
  expect(after.card, '★안쪽 빈 카드가 같이 어두워졌다 — 톤 규칙이 큰 쌍을 덮었다(전용 쌍 설계가 깨졌다)').toBe(before);
  expect(errs).toEqual([]);
});

test('T4 ⑷ 라디오 그룹 — 섹션 토글과 에셋 토글이 한 문서에 같이 있어도 서로를 안 끈다', async ({ page }) => {
  const errs = await bootApp(page);
  await buildFixture(page);
  /* 실제 섹션 패널이 그린 라디오 줄을 패널 «밖»으로 옮겨 둔다(같은 문서 · 같은 form 없음 = name 그룹이 문서 단위로 묶이는 판) */
  await page.evaluate(() => window.showSectionProperties(document.getElementById('akS2')));
  await page.waitForSelector('#sec-checker-tone-on', { state: 'attached' });
  await page.evaluate(() => {
    const row = document.getElementById('sec-checker-tone-on').closest('.prop-row');
    const hold = document.createElement('div'); hold.id = '__ak-hold'; hold.appendChild(row); document.body.appendChild(hold);
    document.getElementById('sec-checker-tone-on').checked = true;
  });
  await openAsset(page, 'akA');
  await clickTone(page);
  const r = await page.evaluate(() => {
    const s = document.getElementById('sec-checker-tone-on'), a = document.getElementById('asset-checker-tone-on');
    return { secName: s?.name, assetName: a?.name, secOn: s?.checked, assetOn: a?.checked,
             both: !!document.getElementById('__ak-hold')?.contains(s) && !!a };
  });
  expect(r.both, '★전제 — 두 라디오가 한 문서에 같이 있다').toBe(true);
  expect(r.assetOn).toBe(true);
  expect(r.secOn, '★에셋 «켬»이 섹션 «켬»을 껐다 — 두 라디오가 한 그룹이다(name 이 같다)').toBe(true);
  expect(r.assetName).not.toBe(r.secName);
  expect(errs).toEqual([]);
});

test('T5 입구 — 빈 에셋엔 조건 없는 줄 하나 · 이미지 있는 에셋엔 없다(안 보이는 것을 정하라 하지 않는다)', async ({ page }) => {
  const errs = await bootApp(page);
  await buildFixture(page);
  await openAsset(page, 'akA');
  const empty = await page.evaluate(() => ({
    n: document.querySelectorAll('#asset-checker-tone-on').length,
    nOff: document.querySelectorAll('#asset-checker-tone-off').length,
    offChecked: document.getElementById('asset-checker-tone-off')?.checked ?? null,
    label: document.getElementById('asset-checker-tone-on')?.closest('.prop-row')?.querySelector('.prop-label')?.textContent.trim() ?? null,
  }));
  expect(empty).toEqual({ n: 1, nOff: 1, offChecked: true, label: '체커 어둡게' });
  await page.evaluate(() => { const ab = document.getElementById('akB'); ab.classList.add('has-image'); window.showAssetProperties(ab); });
  await page.waitForSelector('#asset-bg-clear', { state: 'attached' });
  const img = await page.evaluate(() => ({
    replace: document.querySelectorAll('#asset-replace-btn').length,
    n: document.querySelectorAll('#asset-checker-tone-on, #asset-checker-tone-off').length,
  }));
  expect(img.replace, '★전제 — 이미지 있는 에셋 패널이 떴다').toBe(1);
  expect(img.n, '★이미지가 체커를 가리는데 체커 톤 줄이 떴다(불필요한 프롭힌트)').toBe(0);
  expect(errs).toEqual([]);
});

test('T6 저장본 — 톤이 실린다 · 체커 무늬 0 · 어두운 값 0', async ({ page }) => {
  const errs = await bootApp(page);
  await buildFixture(page);
  await openAsset(page, 'akA');
  await clickTone(page);
  const r = await page.evaluate(() => {
    const p = window.serializeProject();
    const s = typeof p === 'string' ? p : JSON.stringify(p);
    return { hasAsset: s.includes('akA'), tone: (s.match(/data-checker-tone/g) || []).length,
             conic: (s.match(/repeating-conic-gradient\((?!var)/g) || []).length,
             darkHex: (s.match(/#7c7c7c|#949494/gi) || []).length };
  });
  expect(r.hasAsset, '★저장본에 픽스처 에셋이 없다 — 엉뚱한 것을 셌다').toBe(true);
  expect(r.tone, '★에셋 톤이 저장본에 안 실렸다').toBeGreaterThan(0);
  expect({ conic: r.conic, darkHex: r.darkHex }).toEqual({ conic: 0, darkHex: 0 });
  expect(errs).toEqual([]);
});

test('T7 단독 HTML — 체커 서명 0 · 체커 토큰 선언 0 · 어두운 값 0 (양성대조: 톤 규칙에 토큰이 «있었다»)', async ({ page }) => {
  const errs = await bootApp(page);
  await buildFixture(page);
  await openAsset(page, 'akA');
  await clickTone(page);
  const r = await page.evaluate(async () => {
    const mod = await import('../../js/io/export-css-collect.js');
    const sec = document.getElementById('akS1');
    const css = mod.collectCanvasCss(sec, document);
    let raw = 0;
    for (const ss of document.styleSheets) {
      let rules = null; try { rules = ss.cssRules; } catch (_) { continue; }
      for (const rl of rules || []) {
        if (!rl.selectorText || !rl.style || !/\.asset-block\[data-checker-tone/.test(rl.selectorText)) continue;
        raw += (rl.cssText.match(/--goya-checker-/g) || []).length;
      }
    }
    return { hasAppCss: /\.asset-block/.test(css), conic: (css.match(/repeating-conic-gradient/g) || []).length,
             token: (css.match(/--goya-checker-/g) || []).length, toneSel: (css.match(/data-checker-tone/g) || []).length,
             darkHex: (css.match(/#7c7c7c|#949494/gi) || []).length, raw,
             live: getComputedStyle(document.getElementById('akA')).backgroundImage };
  });
  console.log('  T7:', JSON.stringify({ conic: r.conic, token: r.token, toneSel: r.toneSel, darkHex: r.darkHex, raw: r.raw }));
  expect(r.live, '★라이브 에셋이 어두운 체커가 아니다 — 공회전').toContain(RGB(DARK_A));
  expect(r.raw, '★양성대조 — 에셋 톤 규칙에 체커 토큰 선언이 «있어야» 한다').toBeGreaterThan(0);
  expect(r.hasAppCss, '★배송본 CSS 에 에셋 규칙이 없다 — 우연한 0 일 수 있다').toBe(true);
  expect({ conic: r.conic, token: r.token, toneSel: r.toneSel, darkHex: r.darkHex }).toEqual({ conic: 0, token: 0, toneSel: 0, darkHex: 0 });
  expect(errs).toEqual([]);
});

/* 실앱 PNG = main.js 'capture-section-cdp' — 하네스 electronAPI 는 null ⇒ 같은 CDP 명령을 흉내(섹션 spec S8 과 같은 손) */
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

test('T8 PNG — 톤 켠 에셋을 내보낸 그림에 어두운 체커 픽셀 0 (잣대 음성대조: 걷기 없이 찍으면 센다)', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  const errs = await bootApp(page);
  await installCdpCapture(page);
  await buildFixture(page);
  await openAsset(page, 'akA');
  await clickTone(page);
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
    const probe = document.createElement('div');
    probe.className = 'asset-block';
    probe.setAttribute('data-checker-tone', 'dark');
    probe.style.cssText = 'position:fixed;left:0;top:0;width:300px;height:200px;z-index:2147483647;outline:none;margin:0';
    document.body.appendChild(probe);
    await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
    let live = null;
    try { live = await count('data:image/png;base64,' + await window.__cdpShot({ x: scrollX, y: scrollY, width: 300, height: 200 })); }
    catch (e) { live = { err: String(e && e.message || e).slice(0, 160) }; }
    probe.remove();
    const sec = document.getElementById('akS1');
    let native = null;
    try {
      const url = await window.exportSection(sec, 'png', 860, { returnDataUrl: true });
      native = (typeof url === 'string' && url.startsWith('data:image/png')) ? await count(url) : { err: 'not png' };
    } catch (e) { native = { err: String(e && (e.message || e.type) || e).slice(0, 200) }; }
    return { live, native, toneAfter: document.getElementById('akA').dataset.checkerTone };
  }, DARK_RGB);
  console.log('  T8:', JSON.stringify(r));
  expect(r.live?.n, '★잣대 — 걷기 없이 찍은 어두운 에셋 상자(60,000점)에 어두운 픽셀이 거의 없다').toBeGreaterThan(50000);
  expect(r.native.err, 'native 내보내기가 죽었다').toBeUndefined();
  expect(r.native.mark, '★내보낸 PNG 에 표식(#ff00aa 100×40)이 없다 — 엉뚱한 곳을 찍었다').toBeGreaterThan(3000);
  expect(r.native.n, '★톤을 켠 채 내보낸 PNG 에 어두운 체커 픽셀').toBe(0);
  expect(r.toneAfter, '내보내기가 사용자 설정을 바꿨다').toBe('dark');
  expect(errs).toEqual([]);
});
