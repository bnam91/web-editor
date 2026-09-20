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
            <!-- tb 는 box-sizing:border-box — 실앱에서 텍스트 블럭은 프레임 폭에 갇힌 flex 아이템이라
                 패딩을 줘도 «블럭 바깥 폭»이 안 커진다(9502 실측: pl 64 → 블럭 716 그대로, contentEl 716→588). -->
            <div class="frame-block" data-text-frame="true" style="position:absolute;left:180px;top:120px;width:520px;">
              <div class="text-block selected" id="tb" style="position:relative;width:520px;box-sizing:border-box;">
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
          <!-- ★0920b 픽스라운드: 배선 ②(패널이 showGradientLine 을 부른다)를 «행동»으로 재려면
               wireTextEditSection 이 실제로 도는 최소 패널이 필요하다. 캔버스 마우스 시험을 방해하지
               않게 화면 밖에 둔다. id 는 prop-text-wireup-text-edit.js 가 가드 없이 찾는 것들. -->
          <div id="prop-panel" style="position:absolute;left:-9999px;top:0;width:260px;">
            <div class="prop-color-swatch"><input id="txt-color" type="text" value="#ff0000"></div>
            <input id="txt-color-hex" value="FF0000">
            <input id="txt-color-alpha" value="100">
            <input id="txt-size-number" type="number" value="48">
          </div>
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


/* ══════════════════════════════════════════════════════════════════════════════
 * 0920b 픽스라운드 — 이벨류에이터 지적 5건의 회귀 스펙.
 * B7   : 검사의 절반이 소스 grep 이고 «배선 ②»가 행동으로 한 번도 안 재어졌다(지적 ⑤)
 * B8   : 칠 영역(contentEl)만 줄어도 바가 «옛 폭»에 남는다 — 라이브 재측정이 블럭 기하만 본다(지적 ①, medium)
 * B9   : 인라인 스타일 정규화 때문에 «끈 끝점 기억»이 텍스트에선 절대 안 맞는다(지적 ②)
 * B10  : 바의 조작부가 글자 위를 덮어 캐럿·드래그선택을 가져간다(지적 ③)
 * (지적 ④ 죽은 가드 = 코드 삭제. 남은 코드가 없으니 감시할 행동도 없다 — 주석으로만 기록)
 * ══════════════════════════════════════════════════════════════════════════════ */

// 두 프레임 기다린다 — 포털 rAF 루프가 한 번 돌고 그 결과가 레이아웃에 반영될 때까지.
const rafs = (page) => page.evaluate(() => new Promise(r =>
  requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));

test('B7 ★배선 ② 행동측정 — 패널(wireTextEditSection)만 돌려도 바가 뜬다 (스펙은 showGradientLine 을 직접 안 부른다)', async ({ page }) => {
  const errs = await boot(page);
  const out = await page.evaluate(async () => {
    const tb = document.getElementById('tb');
    const before = document.querySelectorAll('.grad-line-overlay').length;
    // 누가 무엇으로 불렸는지 기록 — «소스에 문자열이 있다»가 아니라 «실제로 불렸다»를 잰다.
    const seen = { show: [], bind: [] };
    const realShow = window.showGradientLine, realBind = window.bindGradientLinePicker;
    window.showGradientLine = (el, o) => { seen.show.push(el?.id || '?'); return realShow(el, o); };
    window.bindGradientLinePicker = (el, inp) => {
      seen.bind.push((el?.id || '?') + ':' + (inp?.id || '?'));
      return realBind ? realBind(el, inp) : undefined;
    };
    // 실파일을 그대로 불러 prop-text.js:180 과 «같은 인자»로 돌린다.
    const m = await import('/js/props/prop-text-wireup-text-edit.js');
    m.wireTextEditSection({ tb, ctx: { contentEl: tb.querySelector('.tb-h1') }, currentColorAlpha: 100 });
    window.showGradientLine = realShow; window.bindGradientLinePicker = realBind;
    return { before, after: document.querySelectorAll('.grad-line-overlay').length, seen };
  });
  expect(out.before, '이 스펙은 showGradientLine 을 직접 부르지 않았다(=바는 패널이 켠 것)').toBe(0);
  expect(out.seen.show, '패널 배선이 showGradientLine(tb) 를 부른다').toContain('tb');
  expect(out.seen.bind, '패널↔캔버스 양방향 배선 bindGradientLinePicker(tb, #txt-color)').toContain('tb:txt-color');
  expect(out.after, '배선 ②가 되돌려지면 여기서 0 이 된다').toBe(1);
  expect(errs).toEqual([]);
});

test('B7b ★음성대조 — 배선을 끊으면(showGradientLine 부재) 패널을 돌려도 바가 0개다', async ({ page }) => {
  const errs = await boot(page);
  const n = await page.evaluate(async () => {
    const tb = document.getElementById('tb');
    const real = window.showGradientLine;
    window.showGradientLine = undefined;              // dev 현행(호출부 0건)과 같은 상태
    const m = await import('/js/props/prop-text-wireup-text-edit.js');
    m.wireTextEditSection({ tb, ctx: { contentEl: tb.querySelector('.tb-h1') }, currentColorAlpha: 100 });
    const cnt = document.querySelectorAll('.grad-line-overlay').length;
    window.showGradientLine = real;
    return cnt;
  });
  expect(n, '배선이 없으면 0 — B7 의 1 은 배선이 만든 것이다').toBe(0);
  expect(errs).toEqual([]);
});

test('B8 ★칠 영역(contentEl)만 줄어도 바가 따라온다 — 블럭 기하는 그대로인데도', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => window.showGradientLine(document.getElementById('tb')));
  await rafs(page);
  const snap = () => page.evaluate(() => {
    const tb = document.getElementById('tb');
    const refs = tb._gradLine;
    const ce = tb.querySelector('.tb-h1');
    const ends = [...refs.overlay.querySelectorAll('.grad-line-end')]
      .map(e => { const r = e.getBoundingClientRect(); return Math.round(r.left + r.width / 2); });
    return {
      blockW: Math.round(tb.getBoundingClientRect().width),
      portalKey: refs.portalKey,
      ovW: Math.round(refs.overlay.getBoundingClientRect().width),
      ovL: Math.round(refs.overlay.getBoundingClientRect().left),
      ceW: Math.round(ce.getBoundingClientRect().width),
      ceL: Math.round(ce.getBoundingClientRect().left),
      ends,
    };
  });
  const before = await snap();
  // 실앱의 «L/R 패딩» 슬라이더와 같은 쓰기(prop-text-wireup-padding.js 는 tb 에 padding 을 준다)
  await page.evaluate(() => { document.getElementById('tb').style.padding = '0 64px'; });
  await rafs(page);
  const after = await snap();

  // ★이 두 줄이 «옛 코드라면 재측정이 안 돌았다»는 증거다 — 포털 키(=블럭 기하)가 한 글자도 안 변했다.
  expect(after.blockW, '블럭 폭은 그대로(border-box)').toBe(before.blockW);
  expect(after.portalKey, '포털 키가 같다 = 옛 코드의 재측정 트리거는 안 걸린다').toBe(before.portalKey);

  expect(after.ceW, '칠 영역은 좌우 64px 씩 줄었다').toBeLessThan(before.ceW - 100);
  expect(Math.abs(after.ovW - after.ceW), '바의 폭 = 칠 영역 폭').toBeLessThanOrEqual(1);
  expect(Math.abs(after.ovL - after.ceL), '바의 좌표 = 칠 영역 좌표').toBeLessThanOrEqual(1);
  // 끝 원(0%/100%)이 칠 영역 «안»에 선다 — 이벨류 실측의 gapLeft -64 / gapRight +64 가 사라졌는지
  expect(after.ends[0], '왼쪽 끝 원이 칠 영역 밖으로 안 나간다').toBeGreaterThanOrEqual(after.ceL - 1);
  expect(after.ends[1], '오른쪽 끝 원이 칠 영역 밖으로 안 나간다').toBeLessThanOrEqual(after.ceL + after.ceW + 1);
  expect(errs).toEqual([]);
});

test('B9 끈 끝점 기억 — 인라인 스타일 정규화(#hex→rgb())를 넘어 유지되고, 값이 «진짜로» 바뀌면 버려진다', async ({ page }) => {
  const errs = await boot(page);
  // ★어긋남이 드러나려면 «반투명 스탑»이 있어야 한다 — 불투명 hex 만 있으면 모델을 한 번 거친 뒤부터는
  //   쓰는 글자와 읽는 글자가 우연히 같아진다(rgb(255, 0, 0) ↔ rgb(255, 0, 0)). 실앱에서 어긋난 자리도
  //   알파 스탑이었다(쓴 값 `rgba(26,26,26,0.000)` ↔ 읽은 값 `rgba(26, 26, 26, 0)`) — gradient-model
  //   _stopColor 는 공백 없이·소수 3자리로 쓰고, 브라우저는 공백 넣고 `0` 으로 줄여 돌려준다.
  const seeded = await page.evaluate(() => {
    const tb = document.getElementById('tb');
    window.applyTextGradient(tb.querySelector('.tb-h1'),
      { css: 'linear-gradient(90deg, #1a1a1a 0%, rgba(26,26,26,0.000) 100%)' }, { commit: false });
    window.showGradientLine(tb);
    return tb.querySelector('.tb-h1').style.backgroundImage;
  });
  expect(seeded, '브라우저가 되읽으며 표기를 바꾼다(이 어긋남이 문제의 씨앗)').toMatch(/rgba\(26, 26, 26, 0\)/);
  const p = await page.evaluate(() => {
    const r = document.getElementById('tb')._gradLine.overlay
      .querySelector('[data-grad-handle="end"]').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x - 70, p.y + 110, { steps: 6 });
  await page.mouse.up();

  const endsOf = () => page.evaluate(() => [...document.getElementById('tb')._gradLine.overlay
    .querySelectorAll('.grad-line-end')].map(e => {
      const r = e.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    }));
  const dragged = await endsOf();

  // 블럭 재선택과 같은 길: 바를 내렸다가 «저장값을 다시 읽어» 다시 켠다.
  const recalled = await page.evaluate(() => {
    const tb = document.getElementById('tb');
    window.hideGradientLine(tb);
    window.showGradientLine(tb);
    return !!tb._gradLine.view;
  });
  expect(recalled, '되읽은 문자열이 정규화돼도 기억이 살아 있어야 한다').toBe(true);
  const after = await endsOf();
  for (let i = 0; i < 2; i++) {
    expect(Math.abs(after[i].x - dragged[i].x), `끝 원 ${i} x`).toBeLessThanOrEqual(1);
    expect(Math.abs(after[i].y - dragged[i].y), `끝 원 ${i} y`).toBeLessThanOrEqual(1);
  }

  // ★음성대조 — 값이 «진짜로» 달라지면(외부 편집·undo) 기억을 버려야 한다(안 버리면 옛 끈이 남는다).
  const dropped = await page.evaluate(() => {
    const tb = document.getElementById('tb');
    window.applyTextGradient(tb.querySelector('.tb-h1'),
      { css: 'linear-gradient(17deg, #112233 0%, #445566 100%)' }, { commit: false });
    window.hideGradientLine(tb);
    window.showGradientLine(tb);
    return tb._gradLine.view;
  });
  expect(dropped, '다른 그라데이션이면 기억을 버리고 저장값에서 유도한다').toBeNull();
  expect(errs).toEqual([]);
});

test('B10 글자 편집 중엔 바가 캐럿 자리를 안 뺏는다 (.editing → 조작부 pointer-events:none)', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => window.showGradientLine(document.getElementById('tb')));
  await rafs(page);
  const hit = () => page.evaluate(() => {
    const refs = document.getElementById('tb')._gradLine;
    const r = refs.chips[1].getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { cls: el?.className || '', muted: refs.overlay.classList.contains('is-muted') };
  });
  const normal = await hit();
  expect(normal.cls, '평소엔 칩을 잡을 수 있어야 한다(양성대조)').toMatch(/grad-stop-chip/);
  expect(normal.muted).toBe(false);

  await page.evaluate(() => document.getElementById('tb').classList.add('editing'));
  await rafs(page);
  const editing = await hit();
  expect(editing.muted, '편집 중엔 바가 비켜선다').toBe(true);
  expect(editing.cls, '같은 점이 이제 글자(칩이 아니다)로 잡힌다').not.toMatch(/grad-stop-chip|grad-line-end/);

  await page.evaluate(() => document.getElementById('tb').classList.remove('editing'));
  await rafs(page);
  const back = await hit();
  expect(back.muted, '편집을 나오면 바로 돌아온다').toBe(false);
  expect(back.cls).toMatch(/grad-stop-chip/);
  expect(errs).toEqual([]);
});
