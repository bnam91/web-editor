/* shape-handle-resize.dom.spec.js — 도형 «모서리 핸들» 드래그 두 가지 [0920b-shapesize 후속]
 *   ㉠ 높이를 «줄일 수» 있다(M*)   ㉡ 끌고 난 뒤에도 «선택이 유지»된다(K*)
 *
 * ★최종통합 QA(2026-09-21, medium): 「도형 모서리 핸들로 높이를 줄일 수 없고, 그 동안 우측 패널 H 칸이
 *   화면과 다른 수를 보여준다.」 실측 — 새 Rectangle(100×100)에서 SE 핸들을 안쪽으로 40px:
 *   style.height=60px · 패널 H=60 인데 «렌더 높이는 100». 최대 40px 거짓.
 *
 * 뿌리 — addShapeBlock(js/block-factory.js:2172)이 래퍼 frame 에 min-height:100px 를 심는다.
 *   크기를 쓰는 자리는 셋인데 «세트 규약»(height + minHeight 를 같이 쓴다)을 둘만 지켰다:
 *     ✅ js/props/prop-shape.js applySize        (패널 H 칸 — 여기로 내리면 렌더도 따라온다)
 *     ✅ js/overlay-handles.js _onFrameHandleMouseDown
 *     ⛔ js/block-drag.js _onShapeHandleMouseDown  ← 이 자리만 height/dataset 만 썼다
 *
 * ⚠️정직하게 — 이건 int/0920b 머지가 «만든» 회귀가 아니다(dev 20e50e3 의 같은 함수에도 minHeight 가
 *   없다). 다만 fix/0920b-shapesize 가 내건 「패널 W/H 가 실제값」이 «줄이는 방향»에서 깨지던 자리라
 *   이 라운드에서 같이 닫는다.
 *
 * 여기서 재는 것:
 *   M1 SE 핸들로 100 → 60 으로 줄이면 «렌더 높이»가 60 이다(style·dataset·렌더가 한 값).
 *   M2 NW 핸들도 같다 — 60/70/80 연속 조정 내내 렌더가 따라온다.
 *   M3 «키우는 방향»은 회귀 없음(100 → 180).
 *   M4 폭은 원래 min-width 가 없다 — 이 픽스가 폭 쪽에 아무 것도 안 심는다(minWidth 는 빈 채).
 *   M1-pre/M2-pre ★음성대조 — «현재 소스»에서 minHeight 줄만 걷어낸 변형본은 렌더가 100 에 바닥친다.
 *     (변형본을 손으로 베껴 두지 않는 이유 = resize-undo-history.dom.spec.js 머리말과 같다.)
 *
 * ㉡ 선택 유지 (2026-09-21 최종통합 QA, medium): 「도형을 모서리 핸들로 키우면 마우스업 순간 선택이
 *   풀리고 우측 패널이 «Section 01»로 되돌아간다」 — fix/0920b-shapesize 가 고친 W/H 를 «그 값을 바꾼
 *   바로 그 동작» 직후에 확인할 수도, 이어서 조정할 수도 없었다.
 *   기전: .shape-handle 은 블럭의 «자식»이라 press/release 의 공통 조상이 섹션이다 ⇒ 브라우저가
 *   섹션에서 click 을 합성 → js/editor.js sec.click → selectSectionWithModifier → deselectAll.
 *   (mousedown 의 stopPropagation 은 소용없다 — click 은 공통 조상에서 «새로» 난다.)
 *   K1 끌고 난 뒤의 click 은 섹션에 «안» 닿는다(=선택 유지)   K1-pre ★음성대조(삼키기 제거본)
 *   K2 «안 끌고» 그냥 누르면 삼키지 않는다(손잡이 클릭은 선택 동작이다)
 *   K3 120ms 뒤의 «다음» 클릭은 정상으로 섹션에 닿는다(영구 봉쇄가 아니다)
 *
 * ⛔앱을 «안» 띄운다 — js/block-drag.js 의 _onShapeHandleMouseDown 을 _slice-block 으로 떠서 돌린다.
 * 실행: npm run test:dom -- shape-handle-resize
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { sliceBlock } = require('../unit/_slice-block.js');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8');

const SHAPE_SRC = sliceBlock(read('js/block-drag.js'), 'function _onShapeHandleMouseDown(');

/* ── ⓪-b 전제 — 섹션 click 핸들러가 정말 deselectAll 을 부르는 꼴인지 «진짜 파일»에서 확인.
   여기가 바뀌면 아래 K* 가 재는 대상이 사라진 것이다. */
const EDITOR_SRC = read('js/editor.js');
if (!/sec\.addEventListener\('click'/.test(EDITOR_SRC) || !/selectSectionWithModifier\(sec/.test(EDITOR_SRC)) {
  throw new Error('⛔js/editor.js 의 섹션 click → selectSectionWithModifier 사슬이 안 보인다 — K* 가 늙었다');
}

/* ── ⓪ 전제 — 픽스가 실제로 «이 함수 안»에 있다. 없으면 아래 M1 이 자가통과한다. */
if (!/minHeight/.test(SHAPE_SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''))) {
  throw new Error('⛔_onShapeHandleMouseDown 에 minHeight 가 없다 — 픽스가 사라졌거나 슬라이스가 늙었다');
}

/* ── 음성대조본 ①: «현재» 소스에서 minHeight 를 쓰는 조각만 걷는다 = 고치기 «전» 모양. */
function toNoMinHeight(src) {
  // ⛔주석은 «안» 건드린다 — 주석까지 지우려던 초판 정규식이 코드를 같이 먹어 하네스가 안 떴다.
  //   판정은 «주석을 뺀 코드»에만 한다(아래 가드).
  const out = src.replace(/\s*ss\.style\.minHeight\s*=\s*`\$\{newH\}px`;/g, '');
  if (/minHeight/.test(out.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''))) {
    throw new Error('⛔음성대조본에 minHeight 잔재 — 변환이 늙었다');
  }
  if (!/ss\.style\.height/.test(out)) throw new Error('⛔음성대조본에서 height 까지 지워졌다 — 변환이 과했다');
  return out.replace('function _onShapeHandleMouseDown(', 'function _onShapeHandleMouseDown_PRE(');
}
const SHAPE_PRE = toNoMinHeight(SHAPE_SRC);

/* ── 음성대조본 ②: 합성 click 삼키기(killClick)만 걷는다 = 선택이 풀리던 «전» 모양. */
function toNoKillClick(src) {
  const i = src.indexOf('if (_moved) {');
  if (i < 0) throw new Error('⛔killClick 가드(if (_moved) {)가 안 보인다 — 픽스가 사라졌거나 변환이 늙었다');
  const j = src.indexOf('\n    }', i);
  if (j < 0) throw new Error('⛔killClick 블록의 끝을 못 찾았다 — 변환이 늙었다');
  const out = src.slice(0, i) + src.slice(j + 6);
  // ⛔판정은 «주석을 뺀 코드»에만 — 바로 위 안내 주석이 killClick 를 «말로» 쓴다(M* 가드와 같은 이유).
  const code = out.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  if (/killClick/.test(code)) throw new Error('⛔음성대조본에 killClick 잔재 — 변환이 늙었다');
  if (!/pushHistory/.test(out)) throw new Error('⛔음성대조본에서 pushHistory 까지 지워졌다 — 변환이 과했다');
  return out.replace('function _onShapeHandleMouseDown(', 'function _onShapeHandleMouseDown_NOKILL(');
}
const SHAPE_NOKILL = toNoKillClick(SHAPE_SRC);

const HARNESS_JS = `
${SHAPE_SRC}
${SHAPE_PRE}
${SHAPE_NOKILL}
window.__handlers = {
  shape: _onShapeHandleMouseDown,
  shapePre: _onShapeHandleMouseDown_PRE,
  shapeNoKill: _onShapeHandleMouseDown_NOKILL,
};
window.__ready = true;
`;

const BODY = `
<div id="canvas-scaler" style="transform:scale(1);transform-origin:0 0">
  <div id="canvas"><div class="section-block" id="sec"><div class="section-inner" id="inner"></div></div></div>
</div>
<div id="panel-right"><div class="panel-body">
  <input id="shape-h-num" type="number"><input id="shape-h-slider" type="range" min="20" max="900">
  <input id="shape-w-num" type="number"><input id="shape-w-slider" type="range" min="20" max="900">
</div></div>`;

async function boot(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === '/__harness.html') {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html><head><meta charset="utf-8">
          <style>
            *{margin:0}
            .frame-block{position:relative;box-sizing:border-box}
            .shape-block{width:100%;height:100%;position:absolute;inset:0}
            .section-inner{width:800px}
            .shape-handle{position:absolute;width:8px;height:8px}
          </style>
          <script type="module" src="/__harness.js"></script></head><body>${BODY}</body></html>`,
      });
    }
    if (u.pathname === '/__harness.js') return route.fulfill({ contentType: 'application/javascript', body: HARNESS_JS });
    return route.fulfill({ status: 404, body: '' });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

/* 브라우저 안 시나리오 — addShapeBlock 과 «같은 꼴»로 프레임을 만든다(min-height:100px 포함),
   그 다음 dir 핸들을 dx,dy 만큼 끈다. 반환 = 끌고 난 뒤의 렌더/스타일/패널 값. */
const SCENARIO = ([which, dir, steps]) => {
  const inner = document.getElementById('inner');
  inner.innerHTML = '';
  const ss = document.createElement('div');
  ss.className = 'frame-block';
  ss.dataset.freeLayout = 'true';
  ss.dataset.width = '100'; ss.dataset.height = '100';
  ss.style.width = '100px';
  ss.style.height = '100px';
  ss.style.minHeight = '100px';   // ★addShapeBlock(js/block-factory.js:2172) 이 심는 그 줄
  const blk = document.createElement('div');
  blk.className = 'shape-block';
  blk.dataset.shapeType = 'rectangle';
  const h = document.createElement('div');
  h.className = `shape-handle ${dir}`; h.dataset.dir = dir;
  blk.appendChild(h);
  ss.appendChild(blk);
  inner.appendChild(ss);

  const fresh = {
    renderedH: ss.getBoundingClientRect().height,
    styleH: ss.style.height, minH: ss.style.minHeight,
  };

  const out = [];
  const hr = h.getBoundingClientRect();
  const sx = hr.left + 4, sy = hr.top + 4;
  const down = new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: sx, clientY: sy });
  Object.defineProperty(down, 'target', { value: h });
  window.__handlers[which](down, blk, dir);
  for (const [dx, dy] of steps) {
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: sx + dx, clientY: sy + dy }));
    out.push({
      renderedH: Math.round(ss.getBoundingClientRect().height),
      renderedW: Math.round(ss.getBoundingClientRect().width),
      styleH: ss.style.height,
      minH: ss.style.minHeight,
      minW: ss.style.minWidth,
      panelH: document.getElementById('shape-h-num').value,
    });
  }
  document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  return { fresh, out };
};

test('M1 ★SE 핸들로 100 → 60 — «렌더 높이»가 실제로 60 이다', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(SCENARIO, ['shape', 'se', [[-40, -40]]]);
  console.log('  M1-head:', r);
  expect(r.fresh, '하네스 전제 — 새 도형은 min-height:100px 를 달고 태어난다')
    .toEqual({ renderedH: 100, styleH: '100px', minH: '100px' });
  expect(r.out[0].styleH).toBe('60px');
  expect(r.out[0].panelH).toBe('60');
  expect(r.out[0].minH, '★minHeight 를 세트로 안 내리면 렌더가 100 에 바닥친다').toBe('60px');
  expect(r.out[0].renderedH, '★패널은 60 인데 화면이 100 이면 40px 거짓말이다').toBe(60);
  expect(errs).toEqual([]);
});

test('M1-pre ★음성대조 — minHeight 줄을 걷으면 패널 60 / 화면 100 으로 갈린다', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(SCENARIO, ['shapePre', 'se', [[-40, -40]]]);
  console.log('  M1-pre:', r.out[0]);
  expect(r.out[0].styleH, '음성대조본도 style 은 60 으로 내려간다(그래서 «조용한» 결함이었다)').toBe('60px');
  expect(r.out[0].panelH).toBe('60');
  expect(r.out[0].renderedH, '★여기서도 60 이면 이 검사는 아무것도 안 보고 있다').toBe(100);
});

test('M2 ★NW 핸들로 60→70→80 연속 조정 — 렌더가 내내 따라온다', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(SCENARIO, ['shape', 'nw', [[40, 40], [30, 30], [20, 20]]]);
  console.log('  M2-head:', r.out.map(o => ({ rH: o.renderedH, sH: o.styleH, panelH: o.panelH })));
  expect(r.out.map(o => o.styleH)).toEqual(['60px', '70px', '80px']);
  expect(r.out.map(o => o.panelH)).toEqual(['60', '70', '80']);
  expect(r.out.map(o => o.renderedH), '★패널만 움직이고 화면은 100 고정이던 자리').toEqual([60, 70, 80]);
  expect(errs).toEqual([]);
});

test('M2-pre ★음성대조 — 같은 연속 조정이 렌더 100 에 고정된다', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(SCENARIO, ['shapePre', 'nw', [[40, 40], [30, 30], [20, 20]]]);
  console.log('  M2-pre:', r.out.map(o => ({ rH: o.renderedH, sH: o.styleH, panelH: o.panelH })));
  expect(r.out.map(o => o.panelH)).toEqual(['60', '70', '80']);
  expect(r.out.map(o => o.renderedH)).toEqual([100, 100, 100]);
});

test('M3 ★키우는 방향은 회귀 없음 — 100 → 180', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(SCENARIO, ['shape', 'se', [[80, 80]]]);
  console.log('  M3-head:', r.out[0]);
  expect(r.out[0].styleH).toBe('180px');
  expect(r.out[0].renderedH).toBe(180);
  expect(r.out[0].panelH).toBe('180');
  expect(errs).toEqual([]);
});

test('M4 ★폭 쪽엔 아무 것도 안 심는다 — minWidth 는 빈 채 (사정거리 초과 금지)', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(SCENARIO, ['shape', 'se', [[-40, -40]]]);
  console.log('  M4-head:', { minW: r.out[0].minW, renderedW: r.out[0].renderedW });
  expect(r.out[0].minW, '★min-width 는 addShapeBlock 이 심지도 않는다 — 여기서 새로 만들지 말 것').toBe('');
  expect(r.out[0].renderedW).toBe(60);
  expect(errs).toEqual([]);
});

/* ══ K* 선택 유지 — 끌고 난 «뒤»의 합성 click 이 섹션에 닿지 않는다 ═══════════════════
   ⚠️계측 정직성: 브라우저는 «합성» 이벤트로 click 을 만들어 주지 않는다. 그래서 여기선
     실제 브라우저가 하는 일(=공통 조상인 «섹션»에서 click 이 난다)을 그대로 손으로 쏜다.
     섹션 리스너는 js/editor.js:3390 의 꼴을 그대로 베꼈다(stopPropagation + 선택 해제). */
const K_SCENARIO = ([which, dragBy, waitMs]) => new Promise((resolve) => {
  const inner = document.getElementById('inner');
  const sec = document.getElementById('sec');
  inner.innerHTML = '';
  const ss = document.createElement('div');
  ss.className = 'frame-block';
  ss.style.width = '150px'; ss.style.height = '150px'; ss.style.minHeight = '100px';
  const blk = document.createElement('div');
  blk.className = 'shape-block selected';
  blk.dataset.shapeType = 'ellipse';
  const h = document.createElement('div');
  h.className = 'shape-handle se'; h.dataset.dir = 'se';
  blk.appendChild(h); ss.appendChild(blk); inner.appendChild(ss);

  // js/editor.js:3390 과 «같은 꼴» — 섹션이 click 을 먹으면 블럭 선택을 푼다.
  let secClicks = 0;
  sec.onclick = (e) => {
    e.stopPropagation();
    secClicks++;
    document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected')); // deselectAll
  };

  const hr = h.getBoundingClientRect();
  const sx = hr.left + 4, sy = hr.top + 4;
  const down = new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: sx, clientY: sy });
  Object.defineProperty(down, 'target', { value: h });
  window.__handlers[which](down, blk, 'se');
  const [dx, dy] = dragBy;
  if (dx || dy) {
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: sx + dx, clientY: sy + dy }));
  }
  document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: sx + dx, clientY: sy + dy }));

  const fire = () => {
    // 브라우저가 «공통 조상»에서 합성하는 그 click — 섹션에서 난다.
    sec.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: sx + dx, clientY: sy + dy }));
    resolve({
      secClicks,
      stillSelected: blk.classList.contains('selected'),
      styleW: ss.style.width,
      styleH: ss.style.height,
    });
  };
  if (waitMs) setTimeout(fire, waitMs); else fire();
});

test('K1 ★끌고 난 뒤의 합성 click 이 섹션에 안 닿는다 — 선택 유지', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(K_SCENARIO, ['shape', [40, 40], 0]);
  console.log('  K1-head:', r);
  expect(r.styleW, '크기는 실제로 바뀌었다(=끈 게 맞다)').toBe('190px');
  expect(r.secClicks, '★섹션 click 이 한 번이라도 돌면 deselectAll 이 돈다').toBe(0);
  expect(r.stillSelected, '★선택이 풀리면 방금 바꾼 W/H 를 볼 수도 이어 조정할 수도 없다').toBe(true);
  expect(errs).toEqual([]);
});

test('K1-pre ★음성대조 — 삼키기를 걷으면 그 자리에서 선택이 풀린다', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(K_SCENARIO, ['shapeNoKill', [40, 40], 0]);
  console.log('  K1-pre:', r);
  expect(r.styleW).toBe('190px');
  expect(r.secClicks, '★여기서도 0 이면 이 검사는 아무것도 안 보고 있다').toBe(1);
  expect(r.stillSelected).toBe(false);
});

test('K2 ★«안 끌고» 그냥 누르면 삼키지 않는다 (손잡이 클릭은 선택 동작이다)', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(K_SCENARIO, ['shape', [0, 0], 0]);
  console.log('  K2-head:', r);
  expect(r.styleW, '안 끌었으니 크기도 그대로').toBe('150px');
  expect(r.secClicks, '★제자리 클릭까지 삼키면 «못 누르는 손잡이»가 된다').toBe(1);
  expect(errs).toEqual([]);
});

test('K3 ★영구 봉쇄가 아니다 — 120ms 뒤 다음 클릭은 정상으로 섹션에 닿는다', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(K_SCENARIO, ['shape', [40, 40], 200]);
  console.log('  K3-head:', r);
  expect(r.secClicks, '★계속 0 이면 드래그 한 번에 섹션 클릭이 영영 죽는 것이다').toBe(1);
  expect(errs).toEqual([]);
});
