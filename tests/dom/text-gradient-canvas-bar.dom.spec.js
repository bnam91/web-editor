/* text-gradient-canvas-bar.dom.spec.js — 0920b «textgrad-bar»
 * 현빈 0920 원문 8번: 「텍스트 → 그라데이션은 그라데이션 바가 안 보이는 문제」(도형·프레임엔 보인다).
 *
 * dev @20e50e3 원인(소스 실독): ① gradient-model.js 어댑터 레지스트리에 text-block 이 없어
 *   getGradientTarget(tb)===null → showGradientLine 첫 세 줄에서 조용히 리턴(오버레이 DOM 자체가 안 생김)
 *   ② 텍스트 패널이 showGradientLine 을 한 번도 안 부른다. ⇒ 기능 미배선(두 지점).
 *
 * ⛔앱을 «안» 띄운다(9500/9334/MCP 대역 무접촉). 실파일(gradient-model.js · gradient-line-overlay.js ·
 *   text-block-color.js + 그 import 체인)과 실 CSS 만 로드해 진짜 레이아웃·진짜 마우스로 잰다.
 *   (선례: gradient-canvas-bar.dom.spec.js / gradient-shape-rotation-box.dom.spec.js)
 * 실행: npm run test:dom -- text-gradient-canvas-bar
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const BLOCKS_CSS = fs.readFileSync(path.join(REPO, 'css/editor-blocks.css'), 'utf8');

const GRAD = 'linear-gradient(90deg, #ff0000 0%, #00ff00 50%, #0000ff 100%)';
const GRAD_STYLE = (g) =>
  `background-image:${g};-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;caret-color:#ff0000;`;

// 실앱 골격: #canvas-wrap(overflow:auto) > #canvas-scaler(줌) > .section-block > .text-block > .tb-*
// ★/js/** 는 «디스크 원문»을 그대로 준다 — 하네스가 자기 복사본(가짜 구현)으로 거짓 그린을 내지 않게.
async function boot(page, { zoom = 100, gradient = GRAD } = {}) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html><head><meta charset="utf-8">
          <style>${BLOCKS_CSS}</style>
          <style>body{margin:0}.section-block{position:relative;}
            #canvas-scaler{position:relative;transform-origin:0 0;transform:scale(${zoom / 100});}
            #canvas-wrap{position:relative;overflow:auto;padding:40px;width:1300px;height:900px;box-sizing:border-box;}
          </style>
          <script>
            window.currentZoom = ${zoom};
            document.documentElement.style.setProperty('--inv-zoom', String(100 / ${zoom}));
            window.__hist = 0; window.pushHistory = () => { window.__hist++; };
            window.__save = 0; window.scheduleAutoSave = () => { window.__save++; };
          </script>
          <script type="module" src="/js/props/text-block-color.js"></script>
          <script type="module" src="/js/gradient-line-overlay.js"></script>
          </head><body>
          <div id="canvas-wrap"><div id="canvas-scaler">
          <div class="section-block" style="width:1100px;height:900px;">
            <div class="frame-block" data-text-frame="true" style="position:absolute;left:180px;top:120px;width:520px;">
              <div class="text-block selected" id="tb" style="position:relative;width:520px;">
                <div class="tb-h1" contenteditable="true" style="${GRAD_STYLE(gradient)}font-size:48px;line-height:1.2;">그라데이션 제목</div>
              </div>
            </div>
            <div class="frame-block" data-text-frame="true" style="position:absolute;left:180px;top:420px;width:320px;">
              <div class="text-block" id="tblabel" style="position:relative;width:320px;">
                <div class="tb-label" contenteditable="true" style="${GRAD_STYLE(gradient)}font-size:20px;">라벨</div>
              </div>
            </div>
            <div class="frame-block" data-text-frame="true" style="position:absolute;left:180px;top:560px;width:320px;">
              <div class="text-block" id="tbsolid" style="position:relative;width:320px;">
                <div class="tb-body" contenteditable="true" style="color:#222222;font-size:20px;">단색 본문</div>
              </div>
            </div>
          </div>
          </div></div>
          </body></html>`,
      });
    }
    if (url.pathname.startsWith('/js/')) {
      const f = path.join(REPO, url.pathname.replace(/^\//, ''));
      if (fs.existsSync(f)) return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(f, 'utf8') });
    }
    return route.fulfill({ status: 404, body: '' });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => !!window.showGradientLine && !!window.GradientModel?.gradientLine
    && !!window.getTextGradient && !!window.applyTextGradient && !!window.resolveTextContentEl);
  return errs;
}

const contentCss = (page, id) => page.evaluate((id) =>
  document.getElementById(id).querySelector('.tb-h1,.tb-body,.tb-label').style.backgroundImage, id);

// 기대 칩 중심(클라이언트 px) — gradient-canvas-bar.dom.spec.js 의 expectedChips 와 같은 계산
async function expectedChips(page, id) {
  return page.evaluate((id) => {
    const refs = document.getElementById(id)._gradLine;
    const GM = window.GradientModel;
    const or = refs.overlay.getBoundingClientRect();
    const z = (window.currentZoom || 100) / 100;
    const W = refs.box.w, H = refs.box.h;
    const ln = GM.gradientLine(refs.model, { space: refs.target.space, w: W, h: H });
    const p0 = { x: ln.p0.x * W, y: ln.p0.y * H }, p1 = { x: ln.p1.x * W, y: ln.p1.y * H };
    const d = 16 * (100 / (window.currentZoom || 100));
    return refs.model.stops.map((s, i) => {
      const pl = GM.chipPlacement(p0, p1, s.offset, d);
      const r = refs.chips[i].getBoundingClientRect();
      return {
        want: { x: or.left + pl.x * z, y: or.top + pl.y * z },
        got: { x: r.left + r.width / 2, y: r.top + r.height / 2 },
      };
    });
  }, id);
}

test('B0 ★음성대조 — 어댑터를 «지우면» 지금(dev)과 똑같이 오버레이가 0개다 (이 스펙이 그 배선을 본다는 증거)', async ({ page }) => {
  const errs = await boot(page);
  const n = await page.evaluate(() => {
    // dev 현행 재현: 레지스트리에서 text-block 어댑터만 뺀다 (= getGradientTarget(tb) === null)
    const orig = window.getGradientTarget;
    window.getGradientTarget = (el) => (el?.classList?.contains('text-block') ? null : orig(el));
    window.showGradientLine(document.getElementById('tb'));
    const cnt = document.querySelectorAll('.grad-line-overlay').length;
    window.getGradientTarget = orig;
    return cnt;
  });
  expect(n, 'dev 증상: 텍스트엔 오버레이 DOM 자체가 안 생긴다').toBe(0);
  expect(errs).toEqual([]);
});

test('B1 구조 — 그라데이션 글자에 바가 뜬다: 오버레이 1 · 선 1 · 끝 원 2 · 칩 = 스탑 수', async ({ page }) => {
  const errs = await boot(page);
  const out = await page.evaluate(() => {
    window.showGradientLine(document.getElementById('tb'));
    const o = document.querySelectorAll('.grad-line-overlay');
    const ov = o[0];
    return {
      overlays: o.length,
      portals: document.querySelectorAll('.grad-line-portal').length,
      line: ov ? ov.querySelectorAll('.grad-line').length : -1,
      end: ov ? ov.querySelectorAll('.grad-line-end').length : -1,
      chip: ov ? ov.querySelectorAll('.grad-stop-chip').length : -1,
      space: document.getElementById('tb')._gradLine.target.space,
    };
  });
  expect(out).toEqual({ overlays: 1, portals: 1, line: 1, end: 2, chip: 3, space: 'css' });
  expect(errs).toEqual([]);
});

for (const zoom of [100, 40]) {
  test(`B2 기하 정합 — 칩 중심이 gradientLine+chipPlacement 기대값과 ±1px (줌 ${zoom}%)`, async ({ page }) => {
    const errs = await boot(page, { zoom });
    await page.evaluate(() => window.showGradientLine(document.getElementById('tb')));
    // 박스는 «블럭»이 아니라 그라데이션이 칠해지는 contentEl 이어야 한다
    const box = await page.evaluate(() => {
      const tb = document.getElementById('tb');
      const ce = tb.querySelector('.tb-h1');
      const s = tb._gradLine.box;
      return { w: s.w, h: s.h, ceW: ce.offsetWidth, ceH: ce.offsetHeight };
    });
    expect(Math.abs(box.w - box.ceW), '오버레이 폭 = contentEl 폭').toBeLessThanOrEqual(1);
    expect(Math.abs(box.h - box.ceH), '오버레이 높이 = contentEl 높이').toBeLessThanOrEqual(1);
    for (const c of await expectedChips(page, 'tb')) {
      expect(Math.abs(c.got.x - c.want.x), 'chip x').toBeLessThanOrEqual(1);
      expect(Math.abs(c.got.y - c.want.y), 'chip y').toBeLessThanOrEqual(1);
    }
    expect(errs).toEqual([]);
  });
}

test('B3 끝 원 드래그 — 글자 그라데이션 각도가 따라오고, background-clip:text 유지, history 는 mouseup 에 1회', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => window.showGradientLine(document.getElementById('tb')));
  const before = await contentCss(page, 'tb');
  const p = await page.evaluate(() => {
    const r = document.getElementById('tb')._gradLine.overlay
      .querySelector('[data-grad-handle="end"]').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x - 60, p.y + 120, { steps: 6 });
  const midHist = await page.evaluate(() => window.__hist);
  await page.mouse.up();
  const out = await page.evaluate(() => {
    const ce = document.getElementById('tb').querySelector('.tb-h1');
    return {
      css: ce.style.backgroundImage,
      clip: ce.style.getPropertyValue('-webkit-background-clip'),
      fill: ce.style.getPropertyValue('-webkit-text-fill-color'),
      hist: window.__hist,
    };
  });
  expect(midHist, '드래그 «중»엔 기록 0회(되돌리기 한 번에 드래그 전으로)').toBe(0);
  expect(out.hist, 'mouseup 에 1회').toBe(1);
  expect(out.css).not.toBe(before);
  expect(out.css).toMatch(/^linear-gradient\(/);
  expect(out.clip, 'applyTextGradient 재진입이 글자 클리핑을 깨면 안 된다').toBe('text');
  expect(out.fill).toBe('transparent');
  expect(errs).toEqual([]);
});

test('B4 칩 드래그 — 그 스탑의 offset 만 바뀌고 글자 클리핑은 유지된다', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => window.showGradientLine(document.getElementById('tb')));
  const pos = await page.evaluate(() => {
    const refs = document.getElementById('tb')._gradLine;
    const r = refs.chips[1].getBoundingClientRect();
    const or = refs.overlay.getBoundingClientRect();
    const z = (window.currentZoom || 100) / 100;
    const W = refs.box.w, H = refs.box.h;
    const ln = window.GradientModel.gradientLine(refs.model, { space: refs.target.space, w: W, h: H });
    const t = 0.75;
    return {
      from: { x: r.left + r.width / 2, y: r.top + r.height / 2 },
      to: { x: or.left + (ln.p0.x + (ln.p1.x - ln.p0.x) * t) * W * z, y: or.top + (ln.p0.y + (ln.p1.y - ln.p0.y) * t) * H * z },
    };
  });
  await page.mouse.move(pos.from.x, pos.from.y);
  await page.mouse.down();
  await page.mouse.move((pos.from.x + pos.to.x) / 2, (pos.from.y + pos.to.y) / 2, { steps: 4 });
  await page.mouse.move(pos.to.x, pos.to.y, { steps: 4 });
  await page.mouse.up();
  const out = await page.evaluate(() => {
    const ce = document.getElementById('tb').querySelector('.tb-h1');
    // ★저장소가 «인라인 스타일»이라 브라우저가 읽을 때 #hex 를 rgb() 로 정규화한다(도형은 dataset 문자열이라
    //   원문 그대로였다). 그래서 문자열 통짜 비교 대신 모델로 되읽어 잰다 — 파서는 둘 다 받는다.
    const m = window.GradientModel.parseGradient(ce.style.backgroundImage);
    return {
      raw: ce.style.backgroundImage,
      angle: m && m.angle,
      offsets: m && m.stops.map(s => s.offset),
      // 패널이 되읽는 경로(스와치·hex 칸)도 hex 로 정상 복원되는지 — 정규화가 UI 를 깨지 않는다는 증거
      hexes: (window.getTextGradient(ce) || {}).stops?.map(s => s.color),
      clip: ce.style.getPropertyValue('background-clip'),
      hist: window.__hist,
    };
  });
  expect(out.angle, '칩 드래그는 각도를 안 건드린다').toBe(90);
  expect(out.offsets, '가운데 스탑만 0.5 → 0.75').toEqual([0, 0.75, 1]);
  expect(out.hexes, '패널 되읽기(getTextGradient)는 hex 로 복원된다').toEqual(['#ff0000', '#00ff00', '#0000ff']);
  expect(out.raw).toMatch(/75%/);
  expect(out.clip).toBe('text');
  expect(out.hist).toBe(1);
  expect(errs).toEqual([]);
});

test('B5 단색 복귀(clearTextGradient) → 바가 사라진다', async ({ page }) => {
  const errs = await boot(page);
  const out = await page.evaluate(() => {
    const tb = document.getElementById('tb');
    window.showGradientLine(tb);
    const on = document.querySelectorAll('.grad-line-overlay').length;
    window.clearTextGradient(tb.querySelector('.tb-h1'));
    return { on, off: document.querySelectorAll('.grad-line-overlay').length, portals: document.querySelectorAll('.grad-line-portal').length };
  });
  expect(out.on).toBe(1);
  expect(out.off, '«단색으로 바꿨는데 바가 남아 있다»가 되면 안 된다').toBe(0);
  expect(out.portals).toBe(0);
  expect(errs).toEqual([]);
});

test('B6 게이트 — 단색 글자와 라벨(그라데이션 미지원 타입)엔 바가 안 뜬다', async ({ page }) => {
  const errs = await boot(page);
  const out = await page.evaluate(() => {
    window.showGradientLine(document.getElementById('tbsolid'));
    const solid = document.querySelectorAll('.grad-line-overlay').length;
    // 라벨은 «인라인 그라데이션이 억지로 남아 있어도» 바가 뜨면 안 된다 —
    // applyTextGradient 가 칠을 막으므로 끌 수는 있는데 글자는 안 바뀌는 거짓 컨트롤이 된다.
    window.showGradientLine(document.getElementById('tblabel'));
    return {
      solid,
      label: document.querySelectorAll('.grad-line-overlay').length,
      allowed: window.textGradientAllowed(document.getElementById('tblabel').querySelector('.tb-label')),
    };
  });
  expect(out.solid, '단색 글자').toBe(0);
  expect(out.label, '라벨').toBe(0);
  expect(out.allowed, '게이트 자체(양성대조): 라벨은 그라데이션 미지원').toBe(false);
  expect(errs).toEqual([]);
});
