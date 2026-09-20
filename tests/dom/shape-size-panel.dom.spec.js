/* shape-size-panel.dom.spec.js — 도형 패널 Size(W·H) 가 «실제 크기»를 읽는다 [0920b-shapesize]
 *
 * 현빈 원문: 「도형 블럭 우측 패널의 W·H 가 항상 100/100 이다. 그 상태에서 W 만 고치면 H 가 100 으로 내려간다.」
 *
 * 근본원인: showShapeProperties 가 `parseInt(block.style.width) || 100` 로 «shape-block 의 인라인
 *   스타일»을 읽었다. 도형은 인라인 width/height 를 안 쓰고(css/editor-blocks.css .shape-block = 100%)
 *   크기를 래퍼 frame 에 둔다(js/block-factory.js addShapeBlock) → 언제나 NaN → 100.
 *   쓰는 쪽 applySize 는 래퍼(ss)에 쓴다 — «읽는 곳과 쓰는 곳이 다른 객체»였다.
 *   폴백 꼴은 레포 선례(prop-mockup.js Width, js/overlay-handles.js _onMockupHandleMouseDown)를 따른다.
 *
 * 여기서 재는 것:
 *   S1 style 로 잰 프레임 크기를 패널이 그대로 보인다(슬라이더·숫자칸 둘 다).
 *   S2 style 이 비고 dataset 만 있어도 읽는다(폴백 1단).
 *   S3 style·dataset 둘 다 없으면 실제 레이아웃 크기(offsetWidth/Height)로 읽는다(폴백 2단).
 *   S4 도형 타입 전수(rectangle·ellipse·polygon·star·line·arrow) 동일.
 *   S5 줌(canvas-scaler scale 0.4/1.0/1.5)이 달라도 같은 값 — transform 은 layout 크기를 안 바꾼다.
 *   S6 W 칸만 입력·Enter → W 만 바뀌고 H 불변(예전엔 H 가 경고 없이 100 으로 파괴됨).
 *   S7 H 칸만 입력·Enter → H 만 바뀌고 W 불변.
 *   S8 슬라이더도 한 축만 움직인다.
 *   S9 패널 재렌더(딴 블럭 갔다 오기) 후에도 값 유지.
 *   S10 핸들 리사이즈가 프레임에 쓰는 꼴 그대로 써도 패널이 따라온다.
 *   S11 H 를 100 아래로 내려도 화면·패널이 같은 값(addShapeBlock 의 min-height:100px 잔존 방지).
 *
 * ⛔앱을 «안» 띄운다 — js/props/prop-shape.js 원본을 route-fulfill 로 단독 로드
 *   (globals.js / color-picker.js / gradient-model.js 만 스텁). shape-frame-isolation.dom.spec.js 부트 패턴.
 * 실행: npm run test:dom -- shape-size-panel
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const PROP_SHAPE_JS = fs.readFileSync(path.join(REPO, 'js/props/prop-shape.js'), 'utf8');
const COMMIT_GUARD_JS = fs.readFileSync(path.join(REPO, 'js/props/prop-number-commit-guard.js'), 'utf8');

const GLOBALS_STUB = `export const propPanel = document.getElementById('prop-panel');`;
const COLOR_PICKER_STUB = `
export function colorFieldHTML({ idPrefix, hex }) {
  return '<input type="text" id="' + idPrefix + '-color" value="' + (hex || '') + '">'
       + '<input type="number" class="prop-number" id="' + idPrefix + '-alpha" value="100">';
}
export function wireColorField() {}
export function parseAlphaFromColor() { return 100; }
`;
const GRADIENT_MODEL_STUB = `export function svgStopRemap() { return []; }`;

/** 프레임(래퍼) + 도형 한 벌. size 를 style/dataset 중 어디에 둘지 골라서 만든다. */
function fixtureHtml({ shapeType = 'rectangle', w = 300, h = 270, where = 'style', scale = 1 } = {}) {
  const styleAttr = where === 'style' || where === 'both' ? `width:${w}px;height:${h}px;` : '';
  const dataAttr = where === 'dataset' || where === 'both' ? ` data-width="${w}" data-height="${h}"` : '';
  // 폴백 2단(offset)용 — style·dataset 이 없으면 CSS 클래스로만 크기를 준다
  const cssSize = where === 'none' ? `#fr1{width:${w}px;height:${h}px;}` : '';
  return `
    <style>
      .section-block{position:relative;width:800px;}
      .section-inner{width:740px;}
      .frame-block{position:relative;}
      .shape-block{position:absolute;width:100%;height:100%;}
      ${cssSize}
    </style>
    <div id="canvas-scaler" style="transform:scale(${scale});transform-origin:0 0;">
      <div class="section-block" id="sec1">
        <div class="section-inner">
          <div class="frame-block" id="fr1" data-free-layout="true" style="${styleAttr}"${dataAttr}>
            <div class="shape-block" id="shp1" data-shape-type="${shapeType}">
              <svg class="shape-svg" viewBox="0 0 100 100"></svg>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div id="prop-panel"></div>`;
}

async function boot(page, bodyHtml) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    const js = (body) => route.fulfill({ contentType: 'application/javascript', body });
    if (url.pathname === '/__harness.html') {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html><head><meta charset="utf-8">
          <script type="module">
            import '/js/props/prop-number-commit-guard.js';
            import * as PS from '/js/props/prop-shape.js';
            window.__PS = PS;
            window.pushHistory = () => { window.__history = (window.__history || 0) + 1; };
            window.scheduleAutoSave = () => {};
            window.__ready = true;
          </script>
          </head><body>${bodyHtml}</body></html>`,
      });
    }
    if (url.pathname === '/js/props/prop-shape.js') return js(PROP_SHAPE_JS);
    if (url.pathname === '/js/props/prop-number-commit-guard.js') return js(COMMIT_GUARD_JS);
    if (url.pathname === '/js/globals.js') return js(GLOBALS_STUB);
    if (url.pathname === '/js/props/color-picker.js') return js(COLOR_PICKER_STUB);
    if (url.pathname === '/js/props/gradient-model.js') return js(GRADIENT_MODEL_STUB);
    return route.fulfill({ status: 404, body: '' });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  expect(errs, 'harness pageerror').toEqual([]);
}

/** 패널을 열고 W·H 표시값(슬라이더·숫자칸)을 읽는다. */
async function openPanelAndRead(page) {
  return page.evaluate(() => {
    window.showShapeProperties(document.getElementById('shp1'));
    const v = (id) => document.getElementById(id)?.value;
    return {
      wNum: v('shape-w-num'), wSlider: v('shape-w-slider'),
      hNum: v('shape-h-num'), hSlider: v('shape-h-slider'),
    };
  });
}

/** 래퍼 프레임의 «실제» 크기(쓰는 쪽이 쓴 값). */
async function readFrame(page) {
  return page.evaluate(() => {
    const fr = document.getElementById('fr1');
    return {
      styleW: fr.style.width, styleH: fr.style.height,
      dataW: fr.dataset.width, dataH: fr.dataset.height,
      offW: fr.offsetWidth, offH: fr.offsetHeight,
    };
  });
}

/** 숫자칸에 «타이핑»해서 Enter 로 커밋 — prop-number-commit-guard 경로를 그대로 탄다. */
async function typeAndCommit(page, id, value) {
  const el = page.locator('#' + id);
  await el.click({ clickCount: 3 });
  await el.pressSequentially(String(value));
  await el.press('Enter');
}

test('S1 — style 로 잰 프레임 크기(300×270)를 패널이 그대로 보인다', async ({ page }) => {
  await boot(page, fixtureHtml({ w: 300, h: 270, where: 'both' }));
  const got = await openPanelAndRead(page);
  expect(got).toEqual({ wNum: '300', wSlider: '300', hNum: '270', hSlider: '270' });
});

test('S2 — style 이 비고 dataset 만 있어도 읽는다(폴백 1단)', async ({ page }) => {
  await boot(page, fixtureHtml({ w: 275, h: 225, where: 'dataset' }));
  expect(await openPanelAndRead(page)).toEqual({ wNum: '275', wSlider: '275', hNum: '225', hSlider: '225' });
});

test('S3 — style·dataset 둘 다 없으면 실제 레이아웃 크기로 읽는다(폴백 2단)', async ({ page }) => {
  await boot(page, fixtureHtml({ w: 240, h: 180, where: 'none' }));
  expect(await openPanelAndRead(page)).toEqual({ wNum: '240', wSlider: '240', hNum: '180', hSlider: '180' });
});

test('S4 — 도형 타입 전수에서 동일', async ({ page }) => {
  for (const t of ['rectangle', 'ellipse', 'polygon', 'star', 'line', 'arrow']) {
    await boot(page, fixtureHtml({ shapeType: t, w: 320, h: 140, where: 'both' }));
    expect(await openPanelAndRead(page), `shapeType=${t}`)
      .toEqual({ wNum: '320', wSlider: '320', hNum: '140', hSlider: '140' });
  }
});

test('S5 — 줌 40/100/150% 에서 같은 값(transform 은 layout 크기를 안 바꾼다)', async ({ page }) => {
  for (const scale of [0.4, 1, 1.5]) {
    await boot(page, fixtureHtml({ w: 300, h: 270, where: 'both', scale }));
    expect(await openPanelAndRead(page), `scale=${scale}`)
      .toEqual({ wNum: '300', wSlider: '300', hNum: '270', hSlider: '270' });
  }
});

test('S6 — W 칸만 101 입력·Enter → W 만 바뀌고 H(270) 불변', async ({ page }) => {
  await boot(page, fixtureHtml({ w: 300, h: 270, where: 'both' }));
  await openPanelAndRead(page);
  await typeAndCommit(page, 'shape-w-num', 101);
  const fr = await readFrame(page);
  expect(fr.styleW).toBe('101px');
  expect(fr.dataW).toBe('101');
  expect(fr.styleH, 'H 가 끌려가면 안 된다').toBe('270px');
  expect(fr.dataH, 'H dataset 이 끌려가면 안 된다').toBe('270');
  // 패널 표시도 같이 맞아야 한다
  const shown = await page.evaluate(() => ({
    wNum: document.getElementById('shape-w-num').value,
    hNum: document.getElementById('shape-h-num').value,
  }));
  expect(shown).toEqual({ wNum: '101', hNum: '270' });
});

test('S7 — H 칸만 333 입력·Enter → H 만 바뀌고 W(300) 불변', async ({ page }) => {
  await boot(page, fixtureHtml({ w: 300, h: 270, where: 'both' }));
  await openPanelAndRead(page);
  await typeAndCommit(page, 'shape-h-num', 333);
  const fr = await readFrame(page);
  expect(fr.styleH).toBe('333px');
  expect(fr.dataH).toBe('333');
  expect(fr.styleW, 'W 가 끌려가면 안 된다').toBe('300px');
  expect(fr.dataW, 'W dataset 이 끌려가면 안 된다').toBe('300');
});

test('S8 — W 슬라이더만 움직여도 H 불변', async ({ page }) => {
  await boot(page, fixtureHtml({ w: 300, h: 270, where: 'both' }));
  await openPanelAndRead(page);
  await page.evaluate(() => {
    const s = document.getElementById('shape-w-slider');
    s.value = '420';
    s.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const fr = await readFrame(page);
  expect(fr.styleW).toBe('420px');
  expect(fr.styleH).toBe('270px');
});

test('S9 — 패널 재렌더(딴 블럭 갔다 오기) 후에도 값 유지', async ({ page }) => {
  await boot(page, fixtureHtml({ w: 300, h: 270, where: 'both' }));
  await openPanelAndRead(page);
  await typeAndCommit(page, 'shape-w-num', 101);
  // 딴 블럭 → 패널 비움 → 다시 도형
  await page.evaluate(() => { document.getElementById('prop-panel').innerHTML = '<div>other block</div>'; });
  expect(await openPanelAndRead(page)).toEqual({ wNum: '101', wSlider: '101', hNum: '270', hSlider: '270' });
});

test('S10 — 핸들 리사이즈(프레임에 직접 기록)와 같은 모양으로 써도 패널이 따라온다', async ({ page }) => {
  await boot(page, fixtureHtml({ w: 100, h: 100, where: 'both' }));
  expect(await openPanelAndRead(page)).toMatchObject({ wNum: '100', hNum: '100' });
  // js/overlay-handles.js _onFrameHandleMouseDown onMove 이 쓰는 꼴 그대로
  await page.evaluate(() => {
    const fr = document.getElementById('fr1');
    fr.style.width = '300px'; fr.dataset.width = '300';
    fr.style.height = '270px'; fr.style.minHeight = '270px'; fr.dataset.height = '270';
  });
  expect(await openPanelAndRead(page)).toEqual({ wNum: '300', wSlider: '300', hNum: '270', hSlider: '270' });
});

test('S11 — H 를 100 아래(50)로 내려도 화면·패널이 같은 값(min-height 잔존 방지)', async ({ page }) => {
  await boot(page, fixtureHtml({ w: 100, h: 100, where: 'both' }));
  // addShapeBlock 이 심는 min-height:100px 재현
  await page.evaluate(() => { document.getElementById('fr1').style.minHeight = '100px'; });
  await openPanelAndRead(page);
  await typeAndCommit(page, 'shape-h-num', 50);
  const fr = await readFrame(page);
  expect(fr.styleH).toBe('50px');
  expect(fr.offH, '화면 높이도 같이 내려가야 한다').toBe(50);
  expect(await openPanelAndRead(page)).toMatchObject({ hNum: '50', wNum: '100' });
});
