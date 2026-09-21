/* fit-zoom-page.dom.spec.js — 「Fit」이 «화면에 맞추는가». (2026-09-21, 사용자 관점 훑기 U-26/fitzoom)
 *
 * ★배경 — 무엇이 안 잡혔나
 *   zoomFit() 은 `(wrap.clientWidth - 80) / CANVAS_W` «가로 하나»로만 배율을 정했다.
 *   이 앱의 정상 모양은 «세로로 긴» 랜딩페이지라 콘텐츠 총높이가 항상 폭보다 훨씬 크다
 *   ⇒ 폭만 맞춘 배율은 정의상 «전체가 들어오는 배율»보다 크다 ⇒ Fit 을 눌렀는데 «확대»된다.
 *   (2026-09-20 훑기 T-0xx / .userlens A32 「Fit 눌렀더니 123% 로 확대」와 같은 뿌리)
 *   ⛔「currentZoom === floor((clientWidth-80)/860*100)」 을 그대로 단언하는 검사는 이 병을
 *     «영영 못 본다» — 버그를 그대로 베낀 기대값이기 때문이다(.guard/FEATURE_REGISTRY.md 가 그랬다).
 *   ⇒ 그래서 여기서는 «공식»이 아니라 «성질»을 잰다: 고른 배율에서 콘텐츠가 실제로 뷰포트 안에 드는가.
 *
 * ★재는 것 넷
 *   ⑴ 세로가 병목일 때 — 고른 배율에서 «가로도 세로도» 뷰포트 안에 든다 (=Fit 의 뜻)
 *   ⑵ 가로가 병목일 때 — 옛 동작(폭기준)이 그대로다 (회귀 방지)
 *   ⑶ 콘텐츠가 0 일 때  — 폭기준으로 폴백한다 (오늘 범위 밖인 0섹션을 새로 건드리지 않는다)
 *   ⑷ 현재 배율 40% 와 100% 에서 «같은 답» — 높이를 미축소(자연) 높이로 재는가
 *      (scaler 의 transform:scale 은 레이아웃 박스를 안 바꾼다 — 그 전제가 깨지면 Fit 이 배율에 끌려다닌다)
 *
 * ⛔앱을 «안» 띄운다. 실행:
 *   npx playwright test --config=tests/dom/playwright.dom.config.js fit-zoom-page
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const EDITOR_SRC = fs.readFileSync(path.join(REPO, 'js/editor.js'), 'utf8');

/** 함수 «전체»를 중괄호 균형으로 떠낸다(매개변수 괄호를 먼저 닫는다). — duplicate-zoom.dom.spec.js 관례 */
function extractFn(src, name) {
  const m = new RegExp('function\\s+' + name + '\\s*\\(').exec(src);
  if (!m) throw new Error('함수를 못 찾았다: ' + name);
  let i = m.index + m[0].length - 1, d = 0;
  for (; i < src.length; i++) {
    if (src[i] === '(') d++;
    else if (src[i] === ')') { d--; if (d === 0) { i++; break; } }
  }
  while (i < src.length && src[i] !== '{') i++;
  let b = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') b++;
    else if (src[i] === '}') { b--; if (b === 0) { i++; break; } }
  }
  return src.slice(m.index, i);
}
const FIT_SRC = extractFn(EDITOR_SRC, 'zoomFit');
/* 공용 비율 계산은 스텁으로 흉내 내지 않고 «진짜 소스»를 export 만 벗겨 올린다(window.FitScale). */
const FIT_SCALE_PATH = path.join(REPO, 'js/fit-scale.js');
const FIT_SCALE_CLASSIC = fs.existsSync(FIT_SCALE_PATH)
  ? fs.readFileSync(FIT_SCALE_PATH, 'utf8').replace(/^export /gm, '')
  : 'function fitScale(cw, ch, vw, vh) { throw new Error("js/fit-scale.js 가 없다"); }';

const CANVAS_W = 860;
const PAD = 40;   // #canvas-wrap { padding: 40px } — css/editor-canvas.css

/** 섹션 높이 배열로 캔버스를 세운다. wrap 은 box-sizing:border-box 라 clientWidth = 지정폭. */
function harness({ wrapW, wrapH, sectionH }) {
  const secs = sectionH.map((h, i) =>
    `<div class="section-block" id="sec${i}" style="height:${h}px;background:#fff"></div>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { margin:0; }
    #canvas-wrap { box-sizing:border-box; width:${wrapW}px; height:${wrapH}px;
      display:flex; align-items:flex-start; justify-content:flex-start;
      overflow:auto; padding:${PAD}px; background:#969696; }
    #canvas-scaler { transform-origin: top center; position:relative; flex-shrink:0; }
    #canvas-scaler > #canvas { margin-inline:auto; }
    #canvas { width:${CANVAS_W}px; background:transparent; overflow:visible;
      display:flex; flex-direction:column; gap:20px; }
  </style></head><body>
  <div id="canvas-wrap"><div id="canvas-scaler"><div id="canvas">${secs}</div></div></div>
  </body></html>`;
}

async function boot(page, fixture) {
  await page.route(`${ORIGIN}/**`, (route) =>
    route.fulfill({ contentType: 'text/html', body: harness(fixture) }));
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.addScriptTag({ content: FIT_SCALE_CLASSIC });
  return errs;
}

/** zoomFit 을 «진짜 소스 그대로» 돌리고, applyZoom 은 스파이로 받아 «고른 배율»만 본다. */
async function runFit(page, fitSrc, scalerScale) {
  return page.evaluate(({ fitSrc, CANVAS_W, scalerScale }) => {
    const scalerEl = document.getElementById('canvas-scaler');
    // 현재 배율을 흉내 낸다 — transform 은 «레이아웃 박스»를 안 바꾸는 것이 전제다.
    scalerEl.style.transform = `translate(0px, 0px) scale(${scalerScale})`;
    void scalerEl.offsetHeight;

    const calls = [];
    const scope = {
      applyZoom: (z, opts) => { calls.push({ z, opts }); },
      CANVAS_W,
      fitScale: window.fitScale,
    };
    const names = Object.keys(scope);
    const fn = new Function(...names, `${fitSrc}; return zoomFit;`)(...names.map(n => scope[n]));
    fn();

    const wrap = document.getElementById('canvas-wrap');
    const canvas = document.getElementById('canvas');
    return {
      calls,
      wrapClientW: wrap.clientWidth,
      wrapClientH: wrap.clientHeight,
      naturalH: canvas.scrollHeight,
    };
  }, { fitSrc, CANVAS_W, scalerScale });
}

test('FZ0 ★떠낸 zoomFit 이 «비어 있지 않다»', () => {
  expect(FIT_SRC.length, 'zoomFit 을 못 떼었다 — 아래는 아무것도 안 잰다').toBeGreaterThan(60);
});

test('FZ1 ★세로가 병목일 때 Fit 이 «화면에 든다» (확대되지 않는다)', async ({ page }) => {
  // 세로로 긴 랜딩페이지 = 이 앱의 정상 모양. 섹션 5개 × 400px + gap 20×4 = 2080px.
  const errs = await boot(page, { wrapW: 800, wrapH: 600, sectionH: [400, 400, 400, 400, 400] });
  const out = await runFit(page, FIT_SRC, 0.4);

  expect(out.calls.length, 'applyZoom 이 안 불렸다 — 잴 것이 없었다').toBe(1);
  expect(out.naturalH, '픽스처가 세로로 길지 않다 — 이 검사는 공짜로 초록이 된다')
    .toBeGreaterThan(out.wrapClientH * 2);

  const z = out.calls[0].z;
  const s = z / 100;
  const availW = out.wrapClientW - 2 * PAD;
  const availH = out.wrapClientH - 2 * PAD;

  expect(z, 'Fit 배율이 수가 아니다').toBeGreaterThan(0);
  expect(Math.round(CANVAS_W * s), `★가로가 화면 밖이다 (배율 ${z}%)`).toBeLessThanOrEqual(availW);
  expect(Math.round(out.naturalH * s),
    `★세로가 화면 밖이다 — Fit 인데 «확대»됐다 (배율 ${z}%, 콘텐츠 ${out.naturalH}px × ${s} = ` +
    `${Math.round(out.naturalH * s)}px > 가용 ${availH}px). 폭 하나로만 계산하면 여기서 빨강이다.`)
    .toBeLessThanOrEqual(availH);

  // 두 축 중 «작은 쪽»을 실제로 골랐는가 — 필요 이상으로 줄이지도 않는다.
  const widthFit = (availW / CANVAS_W) * 100;
  const heightFit = (availH / out.naturalH) * 100;
  expect(z, '★두 축의 min 이 아니다').toBe(Math.floor(Math.min(widthFit, heightFit)));
  expect(out.calls[0].opts && out.calls[0].opts.keepViewportCenter,
    '★keepViewportCenter 가 빠졌다 — M62 보정이 Fit 에서 사라진다').toBe(true);

  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('FZ2 ★가로가 병목일 때는 «옛 동작 그대로» (폭기준 회귀 방지)', async ({ page }) => {
  // 좁은 창 + 짧은 콘텐츠 → 폭이 먼저 걸린다.
  const errs = await boot(page, { wrapW: 400, wrapH: 900, sectionH: [120] });
  const out = await runFit(page, FIT_SRC, 1);

  expect(out.calls.length, 'applyZoom 이 안 불렸다').toBe(1);
  const availW = out.wrapClientW - 2 * PAD;
  const availH = out.wrapClientH - 2 * PAD;
  const widthFit = (availW / CANVAS_W) * 100;
  const heightFit = (availH / out.naturalH) * 100;
  expect(heightFit, '픽스처에서 세로가 병목이다 — 이 검사가 재려던 것이 아니다')
    .toBeGreaterThan(widthFit);

  expect(out.calls[0].z, '★폭 병목에서 배율이 달라졌다 — 기존 동작 회귀')
    .toBe(Math.floor(widthFit));
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('FZ3 ★섹션이 0개면 폭기준으로 «폴백» (0섹션을 새로 건드리지 않는다)', async ({ page }) => {
  const errs = await boot(page, { wrapW: 800, wrapH: 600, sectionH: [] });
  const out = await runFit(page, FIT_SRC, 0.4);

  expect(out.naturalH, '빈 캔버스인데 높이가 0 이 아니다 — 픽스처 전제가 깨졌다').toBe(0);
  expect(out.calls.length, 'applyZoom 이 안 불렸다').toBe(1);
  const widthFit = ((out.wrapClientW - 2 * PAD) / CANVAS_W) * 100;
  expect(out.calls[0].z, '★0섹션에서 폭기준 폴백이 아니다 (0 나눗셈으로 NaN/Infinity 가 샜을 수 있다)')
    .toBe(Math.floor(widthFit));
  expect(Number.isFinite(out.calls[0].z), '★배율이 유한수가 아니다').toBe(true);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('FZ4 ★현재 배율 40% 와 100% 가 «같은 답» — 높이를 자연(미축소) 높이로 잰다', async ({ page }) => {
  const fixture = { wrapW: 800, wrapH: 600, sectionH: [400, 400, 400, 400, 400] };
  const errs1 = await boot(page, fixture);
  const at40 = await runFit(page, FIT_SRC, 0.4);      // 현빈 실사용 기본 40%
  const at100 = await runFit(page, FIT_SRC, 1.0);

  expect(at40.naturalH, '★40% 에서 잰 높이가 «축소된» 값이다 — scaler transform 을 타고 있다')
    .toBe(at100.naturalH);
  expect(at40.calls[0].z, '★Fit 결과가 «현재 배율»에 끌려다닌다 — 누를 때마다 값이 달라진다')
    .toBe(at100.calls[0].z);
  expect(errs1, `pageerror: ${errs1.join(' | ')}`).toEqual([]);
});

/* ═══════════════════════════════════════════════════════════════════════════
   FZ5 — 「어떤 때는 캔버스가 텅 빈다」

   ★재현(실측 2026-09-21 앱 9526, 섹션 5개·40%): #canvas-wrap 은 가로 팬 여지를 «상시» 갖는다
     (scrollWidth 2860 vs clientWidth 954 — S2 팬 여지). 옆으로 끝까지 밀면 캔버스가 가로로
     화면 밖으로 완전히 나간다(가로 교집합 ★0 = 회색만 보인다). 그 상태에서 Fit 을 눌러도
     옛 코드는 scrollLeft 를 «한 번도» 안 건드려서 화면은 그대로 텅 비어 있었다.
     applyZoom 의 keepViewportCenter 는 «세로 전용»이라(editor.js:216 앵커 = 세로 정규화 좌표)
     구해 주지 못한다 ⇒ 사용자가 스스로 빠져나올 길이 없었다.
   ⇒ Fit 은 «배율»만이 아니라 «어디를 보는지»까지 되돌려야 한다.

   ⚠️여기서만 applyZoom 을 «기하학적으로만» 흉내 낸다(transform + scaler 높이 동기).
     앵커·팬잔여·노치 같은 applyZoom 의 나머지 일은 이 검사의 대상이 아니다 —
     재는 것은 «zoomFit 이 그 뒤에 스크롤을 어디로 놓는가» 하나다.
   ═══════════════════════════════════════════════════════════════════════════ */
async function runFitWithLayout(page, fitSrc, prescroll) {
  return page.evaluate(({ fitSrc, CANVAS_W, prescroll }) => {
    const wrap = document.getElementById('canvas-wrap');
    const scaler = document.getElementById('canvas-scaler');
    const canvas = document.getElementById('canvas');

    /* applyZoom 의 «기하»만 흉내 낸다 — _applyScalerTransformAndSync 가 하는 두 가지. */
    const applyZoom = (z) => {
      const s = z / 100;
      scaler.style.transform = `translate(0px, 0px) scale(${s})`;
      scaler.style.height = '';
      void scaler.offsetHeight;
      scaler.style.height = Math.round(scaler.offsetHeight * s) + 'px';
      void wrap.scrollHeight;
    };

    const snap = () => {
      const wr = wrap.getBoundingClientRect(), cr = canvas.getBoundingClientRect();
      return {
        교집합W: Math.max(0, Math.min(wr.right, cr.right) - Math.max(wr.left, cr.left)),
        교집합H: Math.max(0, Math.min(wr.bottom, cr.bottom) - Math.max(wr.top, cr.top)),
        여백위: Math.round(cr.top - wr.top),
        여백아래: Math.round(wr.bottom - cr.bottom),
        여백왼: Math.round(cr.left - wr.left),
        여백오른: Math.round(wr.right - cr.right),
        scrollTop: Math.round(wrap.scrollTop), scrollLeft: Math.round(wrap.scrollLeft),
      };
    };

    applyZoom(40);                                   // 현빈 실사용 기본 배율에서 출발
    wrap.scrollLeft = prescroll.left === 'max' ? wrap.scrollWidth : prescroll.left;
    wrap.scrollTop = prescroll.top === 'max' ? wrap.scrollHeight : prescroll.top;
    void wrap.scrollTop;
    const before = snap();

    const scope = { applyZoom, CANVAS_W, fitScale: window.fitScale };
    const names = Object.keys(scope);
    new Function(...names, `${fitSrc}; return zoomFit;`)(...names.map(n => scope[n]))();

    return { before, after: snap(), naturalH: canvas.scrollHeight,
             clientW: wrap.clientWidth, clientH: wrap.clientHeight };
  }, { fitSrc, CANVAS_W, prescroll });
}

for (const [이름, prescroll] of [
  ['오른쪽 끝 + 아래 끝', { left: 'max', top: 'max' }],
  ['왼쪽 끝 + 위 끝',     { left: 0, top: 0 }],
]) {
  test(`FZ5 ★캔버스가 화면 밖으로 나간 상태(${이름})에서 Fit 이 «되찾아온다»`, async ({ page }) => {
    // 가로 팬 여지를 앱처럼 만든다(scaler 가 wrap 보다 넓다 = S2 팬 여지).
    const errs = await boot(page, { wrapW: 800, wrapH: 600, sectionH: [400, 400, 400, 400, 400] });
    await page.evaluate(() => { document.getElementById('canvas-scaler').style.width = '2400px'; });
    const out = await runFitWithLayout(page, FIT_SRC, prescroll);

    // ★전제 확인 — 정말로 «텅 빈» 상태에서 출발했나. 아니면 이 검사는 아무것도 안 잰다.
    expect(Math.min(out.before.교집합W, out.before.교집합H),
      `출발이 «텅 빈» 상태가 아니다 — 재현 전제가 깨졌다: ${JSON.stringify(out.before)}`).toBe(0);

    // 되찾아왔나 — 두 축 다, «전부» 보이게.
    expect(out.after.교집합W, `★Fit 뒤에도 가로로 화면 밖이다 (scrollLeft 를 안 건드렸다): ${JSON.stringify(out.after)}`)
      .toBeGreaterThan(0);
    expect(out.after.교집합H, `★Fit 뒤에도 세로로 화면 밖이다: ${JSON.stringify(out.after)}`).toBeGreaterThan(0);
    for (const k of ['여백위', '여백아래', '여백왼', '여백오른']) {
      expect(out.after[k], `★${k} 이 음수 = 그쪽이 잘려 나갔다: ${JSON.stringify(out.after)}`)
        .toBeGreaterThanOrEqual(0);
    }
    // 가운데에 놓였나 — 위아래·좌우 여백이 1px 안쪽으로 같다(반올림 여유).
    expect(Math.abs(out.after.여백위 - out.after.여백아래),
      `★상하 여백이 비대칭이다: ${JSON.stringify(out.after)}`).toBeLessThanOrEqual(1);
    expect(Math.abs(out.after.여백왼 - out.after.여백오른),
      `★좌우 여백이 비대칭이다: ${JSON.stringify(out.after)}`).toBeLessThanOrEqual(1);

    expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
  });
}
