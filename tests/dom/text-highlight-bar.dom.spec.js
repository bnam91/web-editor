/* text-highlight-bar.dom.spec.js — 텍스트 형광펜 «획» (2026-10-06 현빈 tb_5bkw8dq:
 *   「하이라이트 기능은 ★텍스트 길이만큼 해주고, ★색변경 및 ★하이라이트 바 높이 조절가능하게」)
 *
 * ★고치기 «전» 실측(핀 e7444dd3, 실앱 100% 줌): 칠해진 폭 716px · 글자 폭 298px ⇒ ★2.40배.
 *   까닭 = H 단추의 «무선택» 갈래가 contentEl(블록 레벨 div)에 background-color 를 걸었다.
 *   (부분 선택 갈래는 execCommand 로 span 을 둘러 «이미» 글자 길이였다 — ★같은 단추가 두 갈래였다.)
 *
 * 무엇을 재나
 *   H1 ★길이 — 무선택으로 켜도 획이 «글자 폭»이다(비율 1.00±0.06). ★전제로 블록 폭 ≫ 글자 폭 임을 먼저 단언한다
 *      (그게 아니면 두 값이 같아 「고쳐졌다」가 공짜로 참이 된다 — 옛 판에서 2.40 이던 그 간격).
 *   H2 ★여러 줄 — 줄바꿈된 글에서 획이 «줄마다» 그 줄 길이다(한 상자로 그리면 둘째 줄이 비거나 넘친다).
 *      ⇒ box-decoration-break:clone 이 살아 있는지를 «그림»이 아니라 조각 개수·폭으로 잰다.
 *   H3 ★색 — 패널에서 고른 색이 실제로 그려진다. 안 고른 블럭은 --ui-highlight 를 따라온다(hex 가 안 굳는다).
 *   H4 ★바 높이 — 100 과 40 의 «칠해진 세로 픽셀»이 실제로 다르다. ⛔값을 넣었다가 아니라 ★전제를 먼저 단언한다.
 *   H5 ★끄기 — 다시 누르면 획이 사라지고 «글자는 남는다» · 색·높이 칸도 같이 닫힌다.
 *   H6 ★옛 저장본 호환 — 2026-10-06 이전 꼴(span[style=background-color])도 «켜짐»으로 읽고, 한 번에 꺼진다.
 *   H7 ★배송본 — 단독 HTML CSS 에 .tb-hl 규칙과 box-decoration-break 가 실린다(형광펜은 «나가야» 하는 것이다).
 *   H8 ★PNG — 화면의 획 폭·높이가 내보낸 그림에 ±3% 안으로 같다.
 *
 *   H9 ★웹 폴백(html2canvas) — ★한 줄짜리 획은 그 길에서도 «글자 길이»로 그려진다.
 *
 * ★2026-10-06 실측 — html2canvas 폴백의 «아는 것/모르는 것»(지디 발주: 한 칸만 재라)
 *   번들 문자열 센서스(vendor/html2canvas/html2canvas.min.js): `linear-gradient` 5건 · `box-decoration-break` ★0건.
 *   그려서 잰 결과(섹션 폭 344 → 860 내보내기, 배율 2.5):
 *     ⒜ ★한 줄  — 화면 span 101px·획 높이 8px → 그림 띠 252×21 ≈ 101·8 ×2.5 ★맞다
 *     ⒝ ★여러 줄 — ★틀리게 그린다. 줄마다가 아니라 ★한 상자로 칠해져 둘째 줄이 첫 줄 폭까지 번지고
 *        두 띠가 하나로 합쳐진다(실측 524×43 = 두 줄 높이 합). box-decoration-break 를 모르기 때문이다.
 *   ★어디에 영향이 있나 — Electron 실앱의 PNG 내보내기는 native(CDP) 길이라 ★안 탄다(H8 이 그 길을 잰다).
 *     h2c 를 타는 길은 ⑴ 프로젝트 썸네일(js/io/save-load.js:137) ⑵ 캡처 보조(js/io/capture-safety.js:537)
 *     ⑶ 웹 빌드 PNG 폴백(js/io/export-image.js:484).
 *   ⛔★H9 는 «여러 줄»을 ★안 잠갔다 — h2c 는 그걸 ★한 상자로 칠한다(실측 524×43 = 두 줄 높이 합).
 *     ★까닭의 증거: 번들에 `box-decoration-break` ★0건(`linear-gradient` 는 5건 — 그라데이션은 안다).
 *     고치려면 capture-safety.js 의 neutralize*ForH2C 꼴로 클론에서 획을 줄마다 상자로 펴야 하고
 *     ★세 길(썸네일·캡처 보조·웹 폴백)에 다 영향이 간다 ⇒ ★별건 카드다(지디 2026-10-06 판정:
 *     「이번 판에 고치지 마라 — 주 경로인 Electron PNG 는 native 라 멀쩡하고, 섞으면 첫 빨강이
 *      어디서 났는지 못 가린다」).
 *   ⛔H9 를 「여러 줄도 된다」로 넓히지 마라 — 지금은 거짓이다. 전제 `lines === 1` 이 그걸 막는다.
 *
 * ⛔이 하네스로 «못 재는» 축: 실제 Electron 재기동·네이티브 메뉴.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/text-highlight-bar.dom.spec.js
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const TEXT_1 = '형광펜 길이 시험입니다';
const TEXT_N = '첫 줄은 꽤 길게 적어서 반드시 줄이 넘어가게 만든다 그리고 둘째 줄';

/* 글자를 «진짜로» 넣은 텍스트 블럭 하나 — 패널은 이 블럭으로 연다. */
async function buildText(page, text) {
  return page.evaluate((t) => {
    document.getElementById('canvas').innerHTML = `
      <div class="section-block" id="hlSec" data-section="1" data-name="HL" style="background-color:#ffffff">
        <div class="section-inner">
          <div id="hlMark" style="width:100px;height:40px;background:#ff00aa"></div>
          <div class="text-block" data-type="body" id="hlTb">
            <div class="tb-body" contenteditable="false" style="width:600px">${t}</div>
          </div>
        </div>
      </div>`;
    return 'hlTb';
  }, text);
}

const openText = async (page) => {
  await page.evaluate(() => window.showTextProperties(document.getElementById('hlTb')));
  await page.waitForSelector('#txt-highlight-btn', { state: 'attached' });
};

/* 획(span.tb-hl)의 조각들과 글자 폭을 «같은 자»로 잰다.
   ⚠️★글꼴이 앉기를 먼저 기다린다 — 안 그러면 폭이 흔들린다. 특히 «두 번 재서 견주는» H2 는
     한 번은 대체 글꼴, 한 번은 실제 글꼴로 재서 197/177 ↔ 210/188 로 어긋났다(2026-10-06, 병렬 부하에서 1회).
     ⛔「줄바꿈 공백 탓」으로 읽으면 안 된다 — 단독 6회는 두 값이 늘 같았다. 원인은 ★자였다. */
const measure = (page) => page.evaluate(async () => {
  try { await document.fonts.ready; } catch (_) {}
  await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
  const tb = document.getElementById('hlTb');
  const ce = tb.querySelector('[contenteditable]');
  const spans = [...ce.querySelectorAll('span.tb-hl')];
  const r = document.createRange(); r.selectNodeContents(ce);
  const textRects = [...r.getClientRects()].map(x => ({ w: Math.round(x.width), h: Math.round(x.height) }));
  const spanRects = spans.flatMap(sp => [...sp.getClientRects()].map(x => ({ w: Math.round(x.width), h: Math.round(x.height) })));
  const cs = spans[0] ? getComputedStyle(spans[0]) : null;
  return {
    nSpan: spans.length,
    blockW: Math.round(ce.getBoundingClientRect().width),
    textW: Math.round(r.getBoundingClientRect().width),
    spanW: spans[0] ? Math.round(spans[0].getBoundingClientRect().width) : null,
    textRects, spanRects,
    bgImage: cs ? cs.backgroundImage : null,
    decoClone: cs ? (cs.boxDecorationBreak || cs.webkitBoxDecorationBreak) : null,
    ceInlineBg: ce.style.backgroundColor,
    colorVar: tb.style.getPropertyValue('--tb-hl-color'),
    hVar: tb.style.getPropertyValue('--tb-hl-h'),
    active: document.getElementById('txt-highlight-btn')?.classList.contains('active'),
    optsDisp: ['txt-hl-color-row', 'txt-hl-h-row'].map(i => { const e = document.getElementById(i); return e ? getComputedStyle(e).display : null; }),
    text: ce.innerText,
  };
});

test('H1 ★길이 — 무선택으로 켜도 획이 «글자 폭»이다 (전제: 블록 폭 ≫ 글자 폭)', async ({ page }) => {
  const errs = await bootApp(page);
  await buildText(page, TEXT_1);
  await openText(page);
  const before = await measure(page);
  /* ★전제 — 블록이 글자보다 «뚜렷이» 넓다. 아니면 아래 비율 1.00 이 공짜로 참이 된다(옛 판의 간격 = 2.40). */
  expect(before.blockW / before.textW, '★전제 — 블록이 글자보다 안 넓다. 이 판에선 H1 이 아무것도 안 잰다').toBeGreaterThan(1.3);
  expect(before.nSpan).toBe(0);

  await page.click('#txt-highlight-btn');
  const after = await measure(page);
  console.log('  H1:', JSON.stringify({ blockW: after.blockW, textW: after.textW, spanW: after.spanW, ratio: +(after.spanW / after.textW).toFixed(3) }));
  expect(after.nSpan, '★획이 안 생겼다').toBe(1);
  expect(after.spanW / after.textW, '★획이 글자 길이가 아니다').toBeGreaterThan(0.94);
  expect(after.spanW / after.textW).toBeLessThan(1.06);
  expect(after.ceInlineBg, '★옛 갈래(블록 상자 배경칠)가 살아 있다 — 그게 2.40배의 원인이었다').toBe('');
  expect(after.bgImage, '획이 그라데이션 기전이 아니다').toContain('linear-gradient');
  expect(errs).toEqual([]);
});

test('H2 ★여러 줄 — 획이 «줄마다» 그 줄 길이다 (box-decoration-break:clone 이 산다)', async ({ page }) => {
  const errs = await bootApp(page);
  await buildText(page, TEXT_N);
  await openText(page);
  /* ⚠️줄 수·줄 폭은 «두르기 전»에 잰다 — 두른 뒤 Range.getClientRects() 는 span 상자와 글자 상자를
       겹쳐 세어 ★2배가 나온다(2026-10-06 실측: 2줄인데 4). 두른 뒤 수를 기준으로 삼으면 영영 안 맞는다. */
  const pre = await measure(page);
  expect(pre.textRects.length, '★전제 — 글이 두 줄이 아니다. 이 판에선 H2 가 아무것도 안 잰다').toBeGreaterThan(1);
  await page.click('#txt-highlight-btn');
  const m = await measure(page);
  console.log('  H2:', JSON.stringify({ lines: pre.textRects, spanRects: m.spanRects, deco: m.decoClone }));
  expect(m.decoClone, '★clone 이 아니다 — 둘째 줄 획이 깨진다').toBe('clone');
  expect(m.spanRects.length, '★획 조각 수가 «글자 줄 수»와 다르다').toBe(pre.textRects.length);
  /* ⚠️허용오차가 «한 글자»인 까닭(2026-10-06 실측, 36px 글꼴): 획 조각 210·188 vs 글자 Range 197·177 = +13.
       줄이 넘어가는 자리의 ★공백 한 칸이 span 의 인라인 상자에는 들어가고 Range 에는 안 들어가서다
       (span 안쪽에서 다시 재면 210·188 로 «제 내용과 정확히 같다» — 획이 번진 것이 아니다).
     ⛔그래서 ±4px 같은 고정값을 쓰면 글꼴 크기가 바뀔 때마다 빨개진다. 1em 으로 건다. */
  const em = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#hlTb span.tb-hl')).fontSize));
  for (let i = 0; i < pre.textRects.length; i++) {
    const d = m.spanRects[i].w - pre.textRects[i].w;
    expect(d, `★${i + 1}번째 줄 — 획이 그 줄 글자보다 ★좁다(글자를 다 못 덮는다)`).toBeGreaterThanOrEqual(-2);
    expect(d, `★${i + 1}번째 줄 — 획이 그 줄 글자보다 한 글자 넘게 넓다(줄 길이를 안 따라간다)`).toBeLessThanOrEqual(em);
  }
  /* ★조각들이 «서로 다른 폭»이어야 per-line 이다 — 다 같으면 한 상자를 줄마다 복사한 것과 구분이 안 된다. */
  const ws = m.spanRects.map(r => r.w);
  expect(new Set(ws).size, '★획 조각이 모두 같은 폭이다 — 줄마다 길이를 따라가는 것이 아니다').toBeGreaterThan(1);
  expect(Math.max(...ws), '★획이 블록 폭만큼 넓다 — 글자 길이가 아니다').toBeLessThan(m.blockW);
  expect(errs).toEqual([]);
});

test('H3 ★색 — 고른 색이 그려진다 · 안 고르면 --ui-highlight 를 «따라온다»(hex 가 안 굳는다)', async ({ page }) => {
  const errs = await bootApp(page);
  await buildText(page, TEXT_1);
  await openText(page);
  await page.click('#txt-highlight-btn');

  // 안 고른 상태 — 인라인이 «없고», 토큰을 바꾸면 획이 따라온다
  const d0 = await measure(page);
  expect(d0.colorVar, '★색을 고르지도 않았는데 hex 가 굳었다 — 토큰을 바꿔도 안 따라온다').toBe('');
  expect(d0.bgImage).toContain('rgb(255, 235, 59)');            // --ui-highlight 기본 #ffeb3b
  const followed = await page.evaluate(() => {
    document.documentElement.style.setProperty('--ui-highlight', '#0000ff');
    const v = getComputedStyle(document.querySelector('#hlTb span.tb-hl')).backgroundImage;
    document.documentElement.style.removeProperty('--ui-highlight');
    return v;
  });
  expect(followed, '★토큰을 바꿨는데 획이 안 따라온다').toContain('rgb(0, 0, 255)');

  // 고른 색 — hex 칸에 «진짜» 타이핑
  await page.fill('#txt-hl-color-hex', '22AA55');
  await page.press('#txt-hl-color-hex', 'Enter');
  const d1 = await measure(page);
  console.log('  H3:', JSON.stringify({ colorVar: d1.colorVar, bg: d1.bgImage.slice(0, 70) }));
  expect(d1.colorVar.toLowerCase()).toBe('#22aa55');
  expect(d1.bgImage, '★고른 색이 안 그려진다').toContain('rgb(34, 170, 85)');
  expect(errs).toEqual([]);
});

test('H4 ★바 높이 — 100 과 40 의 «칠해진 세로 픽셀»이 실제로 다르다', async ({ page }) => {
  const errs = await bootApp(page);
  await buildText(page, TEXT_1);
  await openText(page);
  await page.click('#txt-highlight-btn');
  await page.fill('#txt-hl-color-hex', '22AA55');
  await page.press('#txt-hl-color-hex', 'Enter');

  /* 칠해진 세로 픽셀을 «그려서» 센다 — 변수를 읽는 것이 아니라 그림에서 센다. */
  const paintedRows = async () => {
    const b64 = (await (await page.$('#hlTb span.tb-hl')).screenshot()).toString('base64');
    return page.evaluate(async (s) => {
      const i = new Image(); i.src = 'data:image/png;base64,' + s; await i.decode();
      const c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
      const g = c.getContext('2d'); g.drawImage(i, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let rows = 0;
      for (let y = 0; y < c.height; y++) {
        let hit = 0;
        for (let x = 0; x < c.width; x++) {
          const k = (y * c.width + x) * 4;
          if (Math.abs(d[k] - 34) < 26 && Math.abs(d[k + 1] - 170) < 30 && Math.abs(d[k + 2] - 85) < 30) hit++;
        }
        if (hit > c.width * 0.5) rows++;
      }
      return { rows, h: c.height };
    }, b64);
  };

  await page.fill('#txt-hl-h-num', '100');
  await page.press('#txt-hl-h-num', 'Enter');
  expect((await measure(page)).hVar, '★전제 — 100 을 넣었는데 변수가 100% 가 아니다').toBe('100%');
  const full = await paintedRows();

  await page.fill('#txt-hl-h-num', '40');
  await page.press('#txt-hl-h-num', 'Enter');
  expect((await measure(page)).hVar, '★전제 — 40 을 넣었는데 변수가 40% 가 아니다').toBe('40%');
  const band = await paintedRows();

  console.log('  H4:', JSON.stringify({ full, band, ratio: +(band.rows / full.rows).toFixed(2) }));
  expect(full.rows, '★전제 — 100% 에서 칠해진 줄이 거의 없다(잣대가 죽었다)').toBeGreaterThan(10);
  expect(band.rows, '★바 높이를 40 으로 줄였는데 칠해진 줄이 안 줄었다').toBeLessThan(full.rows * 0.75);
  expect(band.rows, '★40% 인데 아예 안 그려진다').toBeGreaterThan(0);
  // 슬라이더와 숫자칸이 같은 값을 들고 있다(명부 둘 방지)
  expect(await page.inputValue('#txt-hl-h')).toBe('40');
  expect(errs).toEqual([]);
});

test('H5 ★끄기 — 획은 사라지고 글자는 남는다 · 색·높이 칸도 닫힌다', async ({ page }) => {
  const errs = await bootApp(page);
  await buildText(page, TEXT_1);
  await openText(page);
  await page.click('#txt-highlight-btn');
  const on = await measure(page);
  expect(on.nSpan).toBe(1);
  expect(on.optsDisp, '★켰는데 색·높이 칸이 안 열렸다').toEqual(['flex', 'flex']);

  await page.click('#txt-highlight-btn');
  const off = await measure(page);
  expect(off.nSpan, '★꺼도 획이 남는다').toBe(0);
  expect(off.text, '★끄면서 글자가 사라졌다').toBe(TEXT_1);
  expect(off.active).toBe(false);
  expect(off.optsDisp, '★껐는데 색·높이 칸이 남아 있다').toEqual(['none', 'none']);
  expect(errs).toEqual([]);
});

test('H6 ★옛 저장본 호환 — 2026-10-06 이전 꼴(span[style=background-color])도 켜짐으로 읽고 한 번에 꺼진다', async ({ page }) => {
  const errs = await bootApp(page);
  await page.evaluate(() => {
    document.getElementById('canvas').innerHTML = `
      <div class="section-block" id="hlSec" data-section="1" data-name="HL" style="background-color:#ffffff">
        <div class="section-inner">
          <div class="text-block" data-type="body" id="hlTb">
            <div class="tb-body" contenteditable="false" style="width:600px"><span style="background-color: rgb(255, 235, 59);">옛 형광펜</span> 뒤 글자</div>
          </div>
        </div>
      </div>`;
  });
  await openText(page);
  expect(await page.evaluate(() => document.getElementById('txt-highlight-btn').classList.contains('active')),
    '★옛 «부분» 형광펜(span[style=background-color])을 꺼짐으로 읽는다 — 그러면 한 번 누를 때 그 획을 지우고 새로 칠한다').toBe(true);

  await page.click('#txt-highlight-btn');          // 한 번에 꺼져야 한다
  const off = await page.evaluate(() => {
    const ce = document.querySelector('#hlTb [contenteditable]');
    return { oldSpans: ce.querySelectorAll('span[style*="background"]').length, newSpans: ce.querySelectorAll('span.tb-hl').length, text: ce.innerText };
  });
  expect(off, '★옛 꼴이 한 번에 안 꺼졌다').toEqual({ oldSpans: 0, newSpans: 0, text: '옛 형광펜 뒤 글자' });
  expect(errs).toEqual([]);
});

test('H7 ★배송본 — 단독 HTML CSS 에 .tb-hl 규칙과 clone 이 실린다(형광펜은 나가야 하는 것)', async ({ page }) => {
  const errs = await bootApp(page);
  await buildText(page, TEXT_1);
  await openText(page);
  await page.click('#txt-highlight-btn');
  await page.fill('#txt-hl-color-hex', '22AA55');
  await page.press('#txt-hl-color-hex', 'Enter');
  const r = await page.evaluate(async () => {
    const mod = await import('../../js/io/export-css-collect.js');
    const css = mod.collectCanvasCss(document.getElementById('hlSec'), document);
    const tb = document.getElementById('hlTb');
    return { rule: /\.tb-hl\s*\{/.test(css), clone: /box-decoration-break/.test(css),
             varDecl: (css.match(/--tb-hl-/g) || []).length,
             inlineKept: tb.getAttribute('style') || '', len: css.length };
  });
  console.log('  H7:', JSON.stringify(r));
  expect(r.rule, '★배송본 CSS 에 .tb-hl 규칙이 없다 — 내보내면 형광펜이 사라진다').toBe(true);
  expect(r.clone, '★clone 이 안 실렸다 — 배송본에서 둘째 줄 획이 깨진다').toBe(true);
  expect(r.varDecl, '★--tb-hl-* 기본값이 안 실렸다 — 색을 안 고른 블럭의 획이 배송본에서 투명해진다').toBeGreaterThan(0);
  expect(r.inlineKept, '★고른 색 인라인이 블럭에서 사라졌다').toContain('--tb-hl-color');
  expect(errs).toEqual([]);
});

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

test('H8 ★PNG — 화면의 획 폭·높이가 내보낸 그림과 ±3% 안으로 같다', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  const errs = await bootApp(page);
  await installCdpCapture(page);
  await buildText(page, TEXT_1);
  await openText(page);
  await page.click('#txt-highlight-btn');
  await page.fill('#txt-hl-color-hex', '22AA55');
  await page.press('#txt-hl-color-hex', 'Enter');
  await page.fill('#txt-hl-h-num', '40');
  await page.press('#txt-hl-h-num', 'Enter');

  const r = await page.evaluate(async () => {
    /* ⚠️★계측기 먼저 — 글꼴이 앉기 «전»에 화면을 재면 폭이 흔들린다(2026-10-06 실측 5회: 132·137·132·132·132,
         같은 판의 PNG 는 351 로 ★한 번도 안 흔들렸다). 내보내기 길은 제 안에서 글꼴을 기다리는데
         이 검사의 «화면 쪽»만 안 기다렸다 ⇒ 빨강의 원인이 제품이 아니라 ★자였다. */
    try { await document.fonts.ready; } catch (_) {}
    await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
    const sp = document.querySelector('#hlTb span.tb-hl');
    const sr = sp.getBoundingClientRect();
    /* ⚠️화면과 PNG 는 «배율이 다르다» — 내보내기는 섹션을 860px 폭으로 맞춰 그린다.
         ⇒ 길이를 px 로 바로 견주면 안 된다(2026-10-06 실측: 화면 141 · PNG 351 — 고쳐진 판인데도 빨강).
         ★둘 다 «섹션 폭에 대한 비율»로 바꿔 견준다. 높이는 그 배율을 곱해 px 로 본다. */
    const secW = document.getElementById('hlSec').getBoundingClientRect().width;
    const screen = { w: Math.round(sr.width), h: Math.round(sr.height * 0.40), secW: Math.round(secW),
                     wRatio: +(sr.width / secW).toFixed(4), scale: 860 / secW };

    const url = await window.exportSection(document.getElementById('hlSec'), 'png', 860, { returnDataUrl: true });
    if (typeof url !== 'string' || !url.startsWith('data:image/png')) return { err: 'not png', screen };
    const i = new Image(); i.src = url; await i.decode();
    const c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
    const g = c.getContext('2d'); g.drawImage(i, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let maxRun = 0, rows = 0, mark = 0;
    for (let y = 0; y < c.height; y++) {
      let run = 0, best = 0;
      for (let x = 0; x < c.width; x++) {
        const k = (y * c.width + x) * 4;
        if (d[k] === 255 && d[k + 1] === 0 && d[k + 2] === 170) mark++;
        if (Math.abs(d[k] - 34) < 26 && Math.abs(d[k + 1] - 170) < 30 && Math.abs(d[k + 2] - 85) < 30) { run++; best = Math.max(best, run); }
        else run = 0;
      }
      if (best > 20) { rows++; maxRun = Math.max(maxRun, best); }
    }
    return { screen, png: { w: maxRun, h: rows, mark, wRatio: +(maxRun / c.width).toFixed(4) }, size: [c.width, c.height] };
  });
  console.log('  H8:', JSON.stringify(r));
  expect(r.err).toBeUndefined();
  expect(r.png.mark, '★내보낸 PNG 에 섹션 표식(#ff00aa)이 없다 — 엉뚱한 곳을 찍었으면 아래 수는 증거가 아니다').toBeGreaterThan(3000);
  expect(r.screen.wRatio, '★전제 — 화면에서 획이 섹션 폭을 다 덮는다(그러면 「글자 길이」를 못 잰다)').toBeLessThan(0.9);
  expect(r.png.wRatio / r.screen.wRatio, '★내보낸 획 폭(섹션 대비)이 화면과 다르다 — 「화면엔 보이는데 내보내면 달라진다」').toBeGreaterThan(0.97);
  expect(r.png.wRatio / r.screen.wRatio).toBeLessThan(1.03);
  expect(Math.abs(r.png.h - r.screen.h * r.screen.scale), '★내보낸 획 높이가 화면과 다르다(배율 보정 뒤)').toBeLessThanOrEqual(3);
  expect(errs).toEqual([]);
});

test('H9 ★웹 폴백(html2canvas) — 한 줄짜리 획은 그 길에서도 «글자 길이»로 그려진다', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  const errs = await bootApp(page);
  await buildText(page, TEXT_1);
  await openText(page);
  await page.click('#txt-highlight-btn');
  await page.fill('#txt-hl-color-hex', '22AA55');
  await page.press('#txt-hl-color-hex', 'Enter');
  await page.fill('#txt-hl-h-num', '40');
  await page.press('#txt-hl-h-num', 'Enter');

  const r = await page.evaluate(async () => {
    try { await document.fonts.ready; } catch (_) {}
    await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
    const sp = document.querySelector('#hlTb span.tb-hl');
    const sr = sp.getBoundingClientRect();
    const secW = document.getElementById('hlSec').getBoundingClientRect().width;
    const scale = 860 / secW;
    const screen = { w: Math.round(sr.width), h: Math.round(sr.height * 0.40), lines: sp.getClientRects().length };

    /* ★forceH2C — Electron 이어도 «웹 폴백» 길로 보낸다(export-image.js isNativeCapture). */
    const url = await window.exportSection(document.getElementById('hlSec'), 'png', 860, { returnDataUrl: true, forceH2C: true });
    if (typeof url !== 'string' || !url.startsWith('data:image/png')) return { err: 'not png', screen };
    const i = new Image(); i.src = url; await i.decode();
    const c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
    const g = c.getContext('2d'); g.drawImage(i, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let maxRun = 0, rows = 0, mark = 0;
    for (let y = 0; y < c.height; y++) {
      let run = 0, best = 0;
      for (let x = 0; x < c.width; x++) {
        const k = (y * c.width + x) * 4;
        if (d[k] === 255 && d[k + 1] === 0 && d[k + 2] === 170) mark++;
        if (Math.abs(d[k] - 34) < 30 && Math.abs(d[k + 1] - 170) < 34 && Math.abs(d[k + 2] - 85) < 34) { run++; best = Math.max(best, run); }
        else run = 0;
      }
      if (best > 20) { rows++; maxRun = Math.max(maxRun, best); }
    }
    return { screen, scale, png: { w: maxRun, h: rows, mark } };
  });
  console.log('  H9:', JSON.stringify(r));
  expect(r.err).toBeUndefined();
  expect(r.screen.lines, '★전제 — 한 줄짜리여야 한다(여러 줄은 이 길에서 아직 틀리게 그려진다 — 머리말 참조)').toBe(1);
  expect(r.png.mark, '★내보낸 PNG 에 섹션 표식(#ff00aa)이 없다 — 엉뚱한 곳을 찍었으면 아래 수는 증거가 아니다').toBeGreaterThan(3000);
  expect(r.png.w, '★웹 폴백에서 획이 아예 안 그려졌다 — linear-gradient 를 못 그리는 것이다').toBeGreaterThan(0);
  expect(r.png.w / (r.screen.w * r.scale), '★웹 폴백의 획 폭이 화면과 다르다').toBeGreaterThan(0.95);
  expect(r.png.w / (r.screen.w * r.scale)).toBeLessThan(1.05);
  expect(Math.abs(r.png.h - r.screen.h * r.scale), '★웹 폴백의 획 높이가 화면과 다르다 — 바 높이가 그 길에서 죽었다').toBeLessThanOrEqual(3);
  expect(errs).toEqual([]);
});
