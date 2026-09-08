/* modal-resize.dom.spec.js — 모달 핸들의 «진짜 끝». (2026-09-08 신설)
 *
 * ★왜 필요한가
 *   현빈: 「파란색 아웃라인과 핸들이 없네? 잡고 컨테이너의 크기 조절 및 보더의 코너 모서리에
 *   애셋블럭처럼 보더 라디우스 조절되게 해줘」
 *   ⇒ 재야 할 것은 «dataset 이 바뀌었나»가 아니라 «사람이 보는 것이 바뀌었나»다.
 *     그래서 여기서는 핸들을 «세고», 진짜 마우스로 «끌고», getComputedStyle 로 «잰다».
 *
 * ★★그리고 이 파일은 «변이를 잡는 그물이 아니다».
 *   tests/dom 은 playwright 라 검수자가 돌리는 node --test 스위트에 «안 들어간다».
 *   변이를 빨갛게 만드는 책임은 tests/unit/modal-resize-handles.test.mjs 가 진다.
 *
 * ⛔앱을 «안» 띄운다 — 고디터 인스턴스·MCP 대역 무접촉. 레포 파일만 크로미움에 얹는다.
 *   (modal-variant.dom.spec.js 의 page.route 하네스를 그대로 쓴다.)
 *
 * ⚠️css/editor-base.css 를 «같이» 얹는다 — 안 얹으면 --sel-outline-w/--sel-color 가 안 살아
 *   outline 이 `3px currentColor` 로 나와 «있는데 없다»고 읽힌다(계획 단계에서 실제로 물렸다).
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js modal-resize
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

/* 실제 캔버스와 같은 모양 — 오버레이는 #canvas-scaler «밖»이다(줌에 안 곱해진다).
   호스트 폭 860 = 고디터 캔버스 폭. 모달의 풀폭이 곧 860 이 된다. */
const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-blocks.css"></head><body style="margin:0">
<div id="canvas-scaler" style="transform: scale(1); transform-origin: 0 0;">
  <div id="canvas" style="width:860px">
    <div class="section-block"><div class="section-inner" id="host" style="width:860px"></div></div>
    <div id="assethost"></div>
  </div>
</div>
<div id="ss-handles-overlay"></div>
<div id="panel-right"><div class="panel-body"></div></div>
<script src="/js/feature-flags.js"></script>
<!-- ★block-edit.js 의 «진짜» selectBlock 을 얹는다(플레인 스크립트).
     스텁을 쓰면 「selectBlock 만으로는 핸들이 안 붙는다」는 이 검사의 «전제»가 사라진다. -->
<script src="/js/block-edit.js"></script>
<script type="module">
  import { makeModalBlock, renderModalBlock, addModalBlock } from '/js/blocks/modal-block.js';
  window.__add = addModalBlock;
  import { showModalProperties } from '/js/props/prop-modal.js';
  import { showHandlesFor, showAssetResizeHandles } from '/js/overlay-handles.js';
  import { bindBlock } from '/js/drag-drop.js';
  /* ★block-factory.js 를 «진짜로» 얹는다 — D13 이 스텁이 아니라 실제 _insertToFlowFrame 을 탄다.
     스텁을 쓰면 「그 갈래가 실제로 돈다」를 못 지킨다. */
  import '/js/block-factory.js';
  window.__mk = makeModalBlock;
  window.__render = renderModalBlock;
  window.__open = showModalProperties;
  window.__show = showHandlesFor;
  window.__showAsset = showAssetResizeHandles;
  window.__bind = bindBlock;
  window.__ready = true;
</script></body></html>`;

async function boot(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

/** 모달 하나를 캔버스에 올린다. 아직 «선택»하지 않는다 — 양성대조(핸들 0개)를 먼저 재기 위해. */
async function mount(page, ds = {}) {
  await page.evaluate((ds) => {
    const { row, block } = window.__mk({});
    Object.assign(block.dataset, ds);
    document.getElementById('host').appendChild(row);
    window.__render(block);
    window.__block = block;
  }, ds);
}

/** 실제 앱과 같은 경로 — .selected 를 붙이고 showHandlesFor 를 부른다(레이어 패널·클릭이 하는 일). */
async function select(page) {
  await page.evaluate(() => { window.__block.classList.add('selected'); window.__show(window.__block); });
  await raf(page);
}
const raf = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const counts = (page) => page.evaluate(() => ({
  resize: document.querySelectorAll('#ss-handles-overlay .mdl-overlay-handle').length,
  radius: document.querySelectorAll('#ss-handles-overlay .mdl-radius-handle').length,
  asset:  document.querySelectorAll('#ss-handles-overlay .asset-overlay-handle').length,
}));
const styleOf = (page) => page.evaluate(() => {
  const s = getComputedStyle(window.__block);
  return { width: s.width, borderRadius: s.borderTopLeftRadius, textAlign: s.textAlign, minHeight: s.minHeight };
});

/** 핸들을 «진짜 마우스»로 끈다. dx/dy 는 화면px. */
async function dragHandle(page, sel, dx, dy) {
  const box = await page.locator(`#ss-handles-overlay ${sel}`).boundingBox();
  expect(box, `${sel} 핸들이 화면에 없다`).not.toBeNull();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 6 });
  await page.mouse.up();
  await raf(page);
}

test('D1 ★핸들이 «실제로 DOM 에 생긴다» — 4 + 4 (선택 전 0개가 양성대조다)', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  const before = await counts(page);
  expect(before.resize, '선택 전에 이미 핸들이 있다 — 대조가 성립하지 않는다').toBe(0);
  expect(before.radius).toBe(0);
  await select(page);
  const after = await counts(page);
  /* ⛔셀렉터 «문자열»이 소스에 있는지를 읽지 않는다 — 실제로 붙은 것을 «센다». */
  expect(after.resize, '리사이즈 핸들이 네 모서리에 안 생겼다').toBe(4);
  expect(after.radius, '라디우스 핸들이 네 모서리에 안 생겼다').toBe(4);
  expect(errs).toEqual([]);
});

/** editor.js 의 deselectAll 이 «실제로 부르는» hide 목록을 소스에서 뽑는다.
 *  ⛔목록을 여기 베껴 적지 않는다 — 베끼면 deselectAll 에서 줄을 지워도 이 검사는 초록이다. */
function deselectHideCalls() {
  const src = fs.readFileSync(path.join(REPO, 'js/editor.js'), 'utf8');
  const i = src.indexOf('function deselectAll(');
  let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) { j = k + 1; break; } } }
  const body = src.slice(i, j);
  return {
    all:   [...body.matchAll(/window\.(hide[A-Za-z]+)\?\.\(\)/g)].map(m => m[1]),
    modal: [...body.matchAll(/window\.(hideModal[A-Za-z]+)\?\.\(\)/g)].map(m => m[1]),
  };
}

test('D2 «남의 정리»에 안 쓸리고, deselectAll 로 사라지고, 다시 클릭하면 돌아온다', async ({ page }) => {
  await boot(page);
  await mount(page);
  await select(page);
  const total = () => page.evaluate(() => document.getElementById('ss-handles-overlay').children.length);
  expect(await counts(page)).toEqual({ resize: 4, radius: 4, asset: 0 });
  const t0 = await total();
  expect(t0, '모달 핸들 여덟 개').toBe(8);

  /* ★① 남의 핸들을 띄워도 «내 것»이 안 줄어든다.
     showAssetResizeHandles 는 자기 시작에 hideAssetResizeHandles() 로 .asset-overlay-handle 을
     «전부» 쓸어담아 지운다. 모달이 그 클래스를 «빌리면» 여기서 내 핸들이 같이 사라진다
     — 아이콘 원형이 실제로 그렇게 물렸다(재클릭 시 1→0개). */
  await page.evaluate(() => {
    const ab = document.createElement('div');
    ab.className = 'asset-block selected';
    ab.style.cssText = 'width:200px;height:120px;background:#ccc;';
    document.getElementById('assethost').appendChild(ab);
    window.__showAsset(ab);
  });
  await raf(page);
  expect(await total(), '남의 정리가 내 핸들을 먹었다 — 클래스를 빌리고 있다').toBe(t0 + 4);
  expect((await counts(page)).asset).toBe(4);

  /* ★② deselectAll 이 «실제로 부르는» 호출만 그대로 실행한다. */
  const calls = deselectHideCalls();
  expect(calls.all.length, 'deselectAll 의 hide 목록을 못 찾았다 — 검사가 대상을 놓쳤다').toBeGreaterThanOrEqual(8);
  await page.evaluate((names) => names.forEach(n => window[n] && window[n]()), calls.modal);
  const afterDeselect = await counts(page);
  expect(afterDeselect.resize, 'deselectAll 이 모달 리사이즈 핸들을 안 지운다').toBe(0);
  expect(afterDeselect.radius, 'deselectAll 이 모달 라디우스 핸들을 안 지운다').toBe(0);
  expect(afterDeselect.asset, '모달을 정리하면서 에셋 핸들까지 쓸어갔다').toBe(4);

  /* ★③ 다시 클릭하면 돌아온다 — hide 가 자기 «상태변수»를 null 로 되돌리지 않으면
     동일블록 가드에 걸려 no-op 이 되고 «영영» 안 돌아온다(실측된 병). */
  await page.evaluate(() => window.__show(window.__block));
  await raf(page);
  expect(await counts(page)).toEqual({ resize: 4, radius: 4, asset: 4 });

  /* ★④ rAF 경로 — .selected 만 떼어도 스스로 사라진다. */
  await page.evaluate(() => { window.__block.classList.remove('selected'); });
  await raf(page); await raf(page);
  const afterRaf = await counts(page);
  expect(afterRaf.resize).toBe(0);
  expect(afterRaf.radius).toBe(0);
  expect(afterRaf.asset, '에셋 핸들은 그대로다').toBe(4);
});

test('D3 ★라디우스 — 진짜로 끌면 getComputedStyle 의 border-radius 가 바뀐다', async ({ page }) => {
  await boot(page);
  await mount(page);
  await select(page);
  const before = await styleOf(page);
  expect(before.borderRadius, '전제: 처음엔 반경이 0 이다').toBe('0px');
  // se 모서리에서 «안쪽»으로 40px → delta = (−dx−dy)/2 = 40
  await dragHandle(page, '.mdl-radius-handle.se', -40, -40);
  const after = await styleOf(page);
  /* ⛔dataset 만 보지 않는다 — 「의도는 바뀌었는데 화면은 그대로」가 이 레포의 고질이다. */
  expect(parseFloat(after.borderRadius), `반경이 안 바뀌었다: ${before.borderRadius} → ${after.borderRadius}`).toBeGreaterThan(20);
  expect(await page.evaluate(() => window.__block.dataset.radius)).toBe(String(Math.round(parseFloat(after.borderRadius))));
});

test('D4 ★리사이즈 — 폭이 바뀌고, «재렌더를 한 번 더 해도» 살아 있다', async ({ page }) => {
  await boot(page);
  await mount(page);
  await select(page);
  const before = await styleOf(page);
  expect(before.width, '전제: 풀폭이면 호스트 폭 860 이다').toBe('860px');
  // se 를 100px 왼쪽으로 → ★가운데 고정 상자라 폭은 «200» 줄어야 한다
  await dragHandle(page, '.mdl-overlay-handle.se', -100, 0);
  const after = await styleOf(page);
  expect(parseFloat(after.width), `폭이 안 바뀌었다: ${before.width} → ${after.width}`).toBeLessThan(860);
  expect(Math.round(parseFloat(after.width)), '커서 100px 에 폭 200px — 가운데 고정 상자의 산식').toBe(660);
  /* ★★함정1 을 여기서 잡는다 — 인라인 style 에 썼다면 재렌더가 cssText 를 갈아끼우며 증발한다.
     실측(계획 단계): 인라인 {300px,222px,33px} → renderModalBlock 1회 → {860px,59.8px,0px}. */
  await page.evaluate(() => window.__render(window.__block));
  const survived = await styleOf(page);
  expect(survived.width, '재렌더 한 번에 폭이 증발했다 — dataset 이 아니라 인라인에 썼다').toBe(after.width);
});

test('D5 클램프 — 한참 끌어도 폭이 80px 아래로 안 내려간다', async ({ page }) => {
  await boot(page);
  await mount(page);
  await select(page);
  await dragHandle(page, '.mdl-overlay-handle.se', -820, -300);
  const after = await styleOf(page);
  expect(parseFloat(after.width)).toBeGreaterThanOrEqual(80);
  expect(await page.evaluate(() => window.__block.dataset.width)).toBe('80');
});

test('D6 ★줌 100%가 아닌 상태 — 핸들 크기·자리·드래그 환산', async ({ page }) => {
  await boot(page);
  for (const scale of [0.5, 2]) {
    await page.evaluate((s) => {
      document.getElementById('ss-handles-overlay').innerHTML = '';
      document.getElementById('host').innerHTML = '';
      document.getElementById('canvas-scaler').style.transform = `scale(${s})`;
    }, scale);
    await mount(page, { wMode: 'fixed', width: '400', hMode: 'fixed', height: '200' });
    await select(page);

    // ⒜ 오버레이는 스케일러 «밖» ⇒ 핸들은 줌에 안 곱해진다. 항상 7×7.
    const hb = await page.locator('#ss-handles-overlay .mdl-overlay-handle.se').boundingBox();
    expect(Math.round(hb.width), `scale ${scale}: 핸들이 7px 이 아니다`).toBe(7);
    expect(Math.round(hb.height)).toBe(7);

    // ⒝ 리사이즈 핸들 «중심»이 블록 rect 꼭지점 ±0.6px 안
    const br = await page.evaluate(() => {
      const r = window.__block.getBoundingClientRect();
      return { right: r.right, bottom: r.bottom, w: r.width };
    });
    // ★양성대조 — 상자가 «실재»해야 「꼭지점과 일치」가 무언가를 가른다(둘 다 0 이면 그냥 통과한다)
    expect(br.w, `scale ${scale}: 블록 폭이 ${br.w} — 잴 상자가 없다`).toBeGreaterThan(10);
    expect(Math.abs(hb.x + hb.width / 2 - br.right), `scale ${scale}: se 핸들 x 가 꼭지점에서 벗어났다`).toBeLessThan(0.6);
    expect(Math.abs(hb.y + hb.height / 2 - br.bottom), `scale ${scale}: se 핸들 y 가 꼭지점에서 벗어났다`).toBeLessThan(0.6);

    // ⒞ 화면 1px 드래그 = 문서 1/scale px. 가로는 그 «두 배»가 폭이 된다.
    const startW = Number(await page.evaluate(() => window.__block.dataset.width));
    const screenDx = -20;
    await dragHandle(page, '.mdl-overlay-handle.se', screenDx, 0);
    const endW = Number(await page.evaluate(() => window.__block.dataset.width));
    const expected = startW + (screenDx / scale) * 2;
    expect(endW, `scale ${scale}: ${startW} → ${endW}, 기대 ${expected}`).toBe(expected);
  }
});

test('D7 ★「늘어나면 가운데」 — 높이 300 고정에서 슬롯이 상자 중앙에 온다', async ({ page }) => {
  await boot(page);
  await mount(page, { hMode: 'fixed', height: '300' });
  /* ★양성대조 — vAlign 이 없으면(=지금까지의 모습) 슬롯은 «맨 위»다. */
  const top = await page.evaluate(() => {
    const b = window.__block, s = b.querySelector('[data-mdl-slot]');
    return s.getBoundingClientRect().top - b.getBoundingClientRect().top;
  });
  expect(top, '전제: vAlign 없이는 슬롯이 위쪽 패딩 자리에 있다').toBeLessThan(30);

  // 「늘어나는 그 순간」이 채우는 값과 같은 것을 넣고 다시 그린다
  await page.evaluate(() => {
    window.__block.dataset.vAlign = 'center';
    window.__render(window.__block);
  });
  const m = await page.evaluate(() => {
    const b = window.__block.getBoundingClientRect();
    const s = window.__block.querySelector('[data-mdl-slot]').getBoundingClientRect();
    return { gap: (s.top + s.height / 2) - (b.top + b.height / 2), boxH: b.height, slotH: s.height };
  });
  /* ★양성대조가 «먼저» 온다 — 상자와 슬롯이 «둘 다 0» 이면 중심차도 0 이라
     아래 「±2px 안」이 그냥 통과한다. ⛔0 이 「가운데다」와 「잴 게 없다」 두 뜻을 갖게 두지 마라. */
  expect(m.boxH, `상자 높이가 ${m.boxH} — 높이 300 을 고정했는데 안 잡혔다`).toBeGreaterThan(280);
  expect(m.slotH, '슬롯 높이가 0 이다 — 잴 대상이 없다').toBeGreaterThan(0);
  expect(m.boxH - m.slotH, '슬롯이 상자를 꽉 채우면 «가운데»가 아무것도 안 가른다').toBeGreaterThan(50);
  expect(Math.abs(m.gap), `슬롯 중심이 상자 중앙에서 ${m.gap}px 벗어났다`).toBeLessThan(2);
});

test('D8 ★「명시한 왼쪽 정렬」은 리사이즈 뒤에도 남는다 (표시키가 있는 블록)', async ({ page }) => {
  await boot(page);
  /* 이미 한 번 자동 정렬이 채워졌고(autoCentered='1'), 사용자가 그 뒤 왼쪽으로 «되돌린» 블록.
     ⛔값비교식이면 「align === 'left' 니까 안 건드린 것」으로 읽혀 여기서 다시 center 로 덮인다. */
  await mount(page, { align: 'left', autoCentered: '1' });
  await select(page);
  expect((await styleOf(page)).textAlign).toBe('left');
  await dragHandle(page, '.mdl-overlay-handle.se', -100, 40);
  const after = await styleOf(page);
  expect(parseFloat(after.width), '전제: 실제로 리사이즈가 일어났다').toBeLessThan(860);
  expect(after.textAlign, '사용자가 되돌린 정렬을 리사이즈가 다시 덮었다').toBe('left');
  expect(await page.evaluate(() => window.__block.dataset.align)).toBe('left');
});

test('D9 ★저장 왕복 — 새 dataset 키(vAlign/autoCentered)가 «실제로» 실려 나간다', async ({ page }) => {
  await boot(page);
  await mount(page, { vAlign: 'center', autoCentered: '1', wMode: 'fixed' });
  /* 저장 경로(getSerializedCanvas)의 세척은 js/io/section-serialize.js 의 «진짜 함수»,
     로드 경로의 정화는 js/io/save-load.js 의 sanitizeCanvasHtml «본문 그대로»를 떼어 쓴다.
     ⛔재구현하지 않는다 — 재구현하면 「검사만 통과하는 왕복」을 재게 된다. */
  await page.addScriptTag({ url: '/js/io/section-serialize.js' });
  const src = fs.readFileSync(path.join(REPO, 'js/io/save-load.js'), 'utf8');
  const i = src.indexOf('function sanitizeCanvasHtml');
  let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) { j = k + 1; break; } } }
  await page.addScriptTag({ content: src.slice(i, j) + '\nwindow.__san = sanitizeCanvasHtml;' });

  const out = await page.evaluate(() => {
    const clone = document.getElementById('canvas').cloneNode(true);
    window.serializeCleanRoot(clone);
    const saved = clone.innerHTML;               // ← getSerializedCanvas 가 돌려주는 것
    const host = document.createElement('div');
    host.innerHTML = window.__san(saved);        // ← applyProjectData 가 캔버스에 넣는 것
    const back = host.querySelector('.modal-block');
    return {
      savedHasVAlign: /data-v-align="center"/.test(saved),
      savedHasMarker: /data-auto-centered="1"/.test(saved),
      backVAlign: back && back.dataset.vAlign,
      backMarker: back && back.dataset.autoCentered,
      backWMode: back && back.dataset.wMode,
    };
  });
  expect(out).toEqual({
    savedHasVAlign: true, savedHasMarker: true,
    backVAlign: 'center', backMarker: '1', backWMode: 'fixed',
  });
});

test('D10 ★«진짜 클릭» — 캔버스에서 모달을 누르면 핸들이 붙는다 (등록 지점 ②)', async ({ page }) => {
  /* ★D1 은 showHandlesFor 를 «직접» 부른다. 그런데 결함이 살던 곳은 그게 아니라
     block-drag 의 «클릭 경로»였다 — 모달은 grid/infocard 와 함께 공용 루프에 얹혀 있고
     그 루프엔 핸들 호출이 «아예 없었다». 그래서 여기서는 bindBlock 을 걸고 진짜로 «누른다».
     ⇒ block-drag 의 showHandlesFor 한 줄을 지우면 여기가 빨개진다. */
  const errs = await boot(page);
  const stubbed = await page.evaluate(() => {
    /* 클릭 핸들러가 «옵셔널 체이닝 없이» 부르는 앱 전역만 최소로 세운다.
       ⛔핸들 관련은 하나도 안 세운다 — 세우면 이 검사가 자기 손으로 통과한다. */
    const missing = [];
    for (const n of ['deselectAll', 'syncSection', 'highlightBlock', 'setBlockAnchor', 'showModalProperties', 'buildLayerPanel']) {
      if (!window[n]) { window[n] = () => {}; missing.push(n); }
    }
    const { row, block } = window.__mk({});
    document.getElementById('host').appendChild(row);
    window.__render(block);
    window.__bind(block);                 // ← 앱이 블록에 거는 «그» 바인딩
    window.__block = block;
    return missing;
  });
  expect(stubbed).not.toContain('showHandlesFor');

  expect(await counts(page)).toEqual({ resize: 0, radius: 0, asset: 0 });
  await page.locator('#host .modal-block').click();
  await raf(page);
  const after = await counts(page);
  expect(await page.evaluate(() => window.__block.classList.contains('selected')), '클릭이 선택조차 못 했다').toBe(true);
  expect(after.resize, '클릭 경로가 핸들을 안 띄운다 — 공용 루프에 호출이 없다').toBe(4);
  expect(after.radius).toBe(4);
  expect(errs).toEqual([]);
});

test('D11 ★작은 상자·낮은 배율에서 라디우스 핸들이 «교차하지 않는다»', async ({ page }) => {
  /* ⚠️에셋의 INSET=10 은 «화면px» 고정이다. 화면 높이가 20px 미만이면 위·아래 라디우스
     핸들이 서로를 «지나쳐» 위아래가 뒤집힌다. 모달 기본 높이 60px 는 줌 33% 이하에서
     실제로 그 구간에 든다. ⇒ 모달 자기 update 에서 INSET 을 상자에 맞춰 좁힌다.
     ⛔에셋 쪽 INSET 은 공용이라 안 건드린다(고치면 에셋 «모습»이 바뀐다).
     ⇐ 되돌리기: 모달 update 의 INSET 을 10 고정으로 돌리면 여기가 빨강. */
  await boot(page);
  await page.evaluate(() => { document.getElementById('canvas-scaler').style.transform = 'scale(0.5)'; });
  // 화면 높이 ≈ 15px · 화면 폭 ≈ 15px 로 «일부러» 작게 (min-height 30 이 지배한다)
  await mount(page, { hMode: 'fixed', height: '30', wMode: 'fixed', width: '80', padX: '0', padY: '0', fontSize: '10' });
  await select(page);

  const box = await page.evaluate(() => {
    const r = window.__block.getBoundingClientRect();
    return { w: r.width, h: r.height };
  });
  expect(box.h, '전제: 화면 높이가 20px 미만이어야 이 검사가 무언가를 가른다').toBeLessThan(20);

  const pos = async (dir) => {
    const b = await page.locator(`#ss-handles-overlay .mdl-radius-handle.${dir}`).boundingBox();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  const [nw, ne, sw, se] = await Promise.all([pos('nw'), pos('ne'), pos('sw'), pos('se')]);
  expect(nw.y, `위 핸들이 아래 핸들보다 «아래»에 있다 (nw.y=${nw.y}, sw.y=${sw.y}) — INSET 이 상자보다 크다`).toBeLessThan(sw.y);
  expect(ne.y).toBeLessThan(se.y);
  expect(nw.x, `왼 핸들이 오른 핸들보다 «오른쪽»에 있다 (nw.x=${nw.x}, ne.x=${ne.x})`).toBeLessThan(ne.x);
  expect(sw.x).toBeLessThan(se.x);
  // 그리고 «상자 안»에 있다 — 좁히느라 밖으로 나가면 안 된다
  const r = await page.evaluate(() => { const b = window.__block.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; });
  for (const [name, p] of [['nw', nw], ['ne', ne], ['sw', sw], ['se', se]]) {
    expect(p.x, `${name} 이 상자 밖이다`).toBeGreaterThanOrEqual(r.l - 0.5);
    expect(p.x).toBeLessThanOrEqual(r.r + 0.5);
    expect(p.y).toBeGreaterThanOrEqual(r.t - 0.5);
    expect(p.y).toBeLessThanOrEqual(r.b + 0.5);
  }
});

test('D12 ★«툴바로 추가한 그 순간» 핸들이 있다 — 한 번 더 클릭해야 나오면 안 된다', async ({ page }) => {
  /* 현빈 지적: 「처음 버튼 눌러 추가하면 모서리 버튼이 안 보여. 몇 번 클릭해야 보이는데
     첨부터 핸들이 있어야 되는 거잖아」.
     ★소스에 문자열이 있나로 끝내지 않는다 — 이 결함이 정확히 그 «틈»에서 살았다.
       addModalBlock 은 window.selectBlock 을 «부르고 있었다». 그런데 그건 block-edit.js 의
       MCP 진입점이라 showHandlesFor 를 아예 안 부른다 ⇒ 호출은 있는데 핸들은 0개였다.
     ⇐ 되돌리기: _selectNewModal 의 showHandlesFor / showModalProperties 두 줄을 지우면 빨강. */
  const errs = await boot(page);

  const made = await page.evaluate(() => {
    /* addModalBlock 이 옵셔널 체이닝 «없이» 기대하는 앱 전역만 최소로 세운다.
       ⛔핸들·패널 관련은 하나도 안 세운다 — 세우면 검사가 자기 손으로 통과한다. */
    window.getSelectedSection = () => document.querySelector('.section-block');
    /* ⛔여기서 «터지게» 두지 마라 — 터지면 playwright 가 TypeError 를 던지고,
       아래 양성대조가 «자기 말»로 원인을 대지 못한다(실측: 「reading 'classList'」만 남았다). */
    try {
      const r = window.__add({});
      const b = r && r.block;
      return { threw: null, block: !!b, id: b ? b.id : null,
               blocksInDom: document.querySelectorAll('#canvas .modal-block').length,
               selected: !!(b && b.classList.contains('selected')) };
    } catch (e) {
      return { threw: String(e && e.message || e), block: false, blocksInDom: 0, selected: false };
    }
  });
  expect(made.threw, `addModalBlock 이 던졌다: ${made.threw}`).toBeNull();
  /* ★「입력이 살아 있다」 — 블록이 «안 만들어졌으면» 아래 4+4 검사는 공회전한다.
     ⛔0 이 「핸들이 없다」와 「잴 블록이 없다」 두 뜻을 갖게 두지 마라. */
  expect(made.block, 'addModalBlock 이 블록을 못 만들었다 — 아래 검사가 공회전한다').toBe(true);
  expect(made.blocksInDom, '캔버스에 모달이 안 들어갔다').toBe(1);

  await raf(page);
  const after = await page.evaluate(() => ({
    resize: document.querySelectorAll('#ss-handles-overlay .mdl-overlay-handle').length,
    radius: document.querySelectorAll('#ss-handles-overlay .mdl-radius-handle').length,
    panel: document.querySelector('#panel-right .prop-block-name')?.textContent ?? null,
  }));
  /* ★핸들 단언이 «먼저» 온다 — D13 과 같은 이유다.
     ⛔selected 를 «전제»로 앞에 두면, 호출 한 줄을 통째로 지우는 변이에서 그게 먼저 터져
       검사가 「핸들이 없다」 대신 「선택이 안 됐다」로 말한다(실측). 본문이 먼저다. */
  expect(after.resize, '추가 «직후»에 리사이즈 핸들이 없다 — 한 번 더 클릭해야 나온다').toBe(4);
  expect(after.radius, '추가 «직후»에 라디우스 핸들이 없다').toBe(4);
  expect(after.panel, '패널이 모달로 안 열렸다 — showTextProperties 로 샜다').toBe('Modal');
  // 선택 클래스도 같이 따라왔나 (핸들과 «같은» 헬퍼가 맡는다)
  expect(made.selected, '선택 클래스가 안 붙었다').toBe(true);
  expect(errs).toEqual([]);
});

test('D13 ★«프레임 안»으로 추가하는 갈래도 핸들이 붙는다 (addModalBlock 의 두 번째 문)', async ({ page }) => {
  /* ★D12 는 «일반 갈래»만 지킨다. addModalBlock 에는 문이 «둘»이다:
       ⑴ window._insertToFlowFrame 이 참 → 프레임 안에 넣고 «거기서» 끝난다(early return)
       ⑵ 아니면 섹션에 row 로 넣는다
     실측으로 확인된 구멍: ⑴의 호출 «한 줄»만 지워도 D12·U 전부 초록이었다.
     ⛔헬퍼(_selectNewModal)로 «모았기 때문에» 갈래가 하나로 보인다 — 모은 건 옳고,
       그래서 «갈래마다» 검사가 필요하다.
     ⛔grep 으로 「파일에 _selectNewModal 이 두 번 있다」로 때우면 안 된다 —
       한 줄을 지워도 정의 1 + 호출 1 로 «둘»이라 그 검사는 통과한다.
     ⇐ 되돌리기: 프레임 갈래의 _selectNewModal(made.block) 한 줄을 지우면 여기가 빨강(D12 는 초록). */
  const errs = await boot(page);

  const made = await page.evaluate(() => {
    /* _insertToFlowFrame 이 옵셔널 체이닝 «없이» 부르는 것만 최소로 세운다.
       ⛔핸들·패널 관련은 하나도 안 세운다 — 세우면 검사가 자기 손으로 통과한다. */
    window.pushHistory = () => {};
    window.buildLayerPanel = () => {};
    window.getSelectedSection = () => document.querySelector('.section-block');

    // 자유배치 프레임을 «진짜로» 만들고 활성 프레임으로 둔다
    const frame = document.createElement('div');
    frame.className = 'frame-block';
    frame.id = 'ss_d13';
    frame.dataset.freeLayout = 'true';
    frame.style.cssText = 'position:relative;width:600px;height:400px;';
    document.getElementById('host').appendChild(frame);
    window._activeFrame = frame;

    try {
      const r = window.__add({});
      const b = r && r.block;
      return {
        threw: null,
        insertFn: typeof window._insertToFlowFrame,
        block: !!b,
        // ★이 갈래를 «실제로 탔다»는 증거 = 블록이 프레임의 직계 자식이다
        //   (일반 갈래였다면 .row 에 담겨 section-inner 로 들어간다)
        parentIsFrame: !!(b && b.parentElement === frame),
        inFrame: frame.querySelectorAll(':scope > .modal-block').length,
        inSectionInner: document.querySelectorAll('#host > .row .modal-block').length,
        selected: !!(b && b.classList.contains('selected')),
      };
    } catch (e) {
      return { threw: String(e && e.message || e) };
    }
  });

  /* ★「입력이 살아 있다」 — 이 갈래를 «안 타면» 아래 4+4 는 D12 를 다시 재는 것일 뿐이다. */
  expect(made.threw, `addModalBlock 이 던졌다: ${made.threw}`).toBeNull();
  expect(made.insertFn, '_insertToFlowFrame 이 window 에 없다 — block-factory 가 안 실렸다').toBe('function');
  expect(made.block, 'addModalBlock 이 블록을 못 만들었다').toBe(true);
  expect(made.parentIsFrame, '★프레임 갈래를 «안 탔다» — 이 검사는 D12 를 다시 재고 있을 뿐이다').toBe(true);
  expect(made.inFrame, '프레임 안에 모달이 안 들어갔다').toBe(1);
  expect(made.inSectionInner, '일반 갈래로 샜다 — 프레임 갈래가 아니다').toBe(0);

  await raf(page);
  const after = await page.evaluate(() => ({
    resize: document.querySelectorAll('#ss-handles-overlay .mdl-overlay-handle').length,
    radius: document.querySelectorAll('#ss-handles-overlay .mdl-radius-handle').length,
  }));
  /* ★핸들 단언이 «먼저» 온다 — 이게 이 검사의 본문이다.
     ⛔selected 를 «전제»로 앞에 두면 안 된다: 이 갈래에서는 selectBlock 도 같은 헬퍼 안에 있어서
       호출 한 줄을 지우면 selected 가 먼저 터지고, 검사가 「핸들이 없다」 대신 「선택이 안 됐다」로
       말한다(실측으로 그 꼴을 봤다). 원인을 «틀리게» 대는 검사는 다음 사람을 헤매게 한다. */
  expect(after.resize, '★프레임 안에 추가한 «직후»에 리사이즈 핸들이 없다').toBe(4);
  expect(after.radius, '★프레임 안에 추가한 «직후»에 라디우스 핸들이 없다').toBe(4);
  // 선택·레이어 하이라이트도 같이 따라왔나 (핸들과 «같은» 헬퍼가 맡는다)
  expect(made.selected, '선택 클래스가 안 붙었다').toBe(true);
  expect(errs).toEqual([]);
});
