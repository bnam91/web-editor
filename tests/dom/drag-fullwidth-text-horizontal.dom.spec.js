/* drag-fullwidth-text-horizontal.dom.spec.js — D3 (lane-drag · 2026-10-05 · 현빈 «자유 이동이 되어야지?» · 지디 ⒜ 승인)
 *
 * 자유 프레임 안 «가운데/오른쪽 정렬» 글자는 폭 100% 로 놓인다(block-factory.js _clampTextFrameWidth — 설계).
 * 그래서 끌기 클램프(:765)가 가로 여유 0 을 주어 «좌우로는 0px» 움직였다(실앱 실측 ss_ts0he_kj382m6: 가로만 (80,0) → Δ0 ·
 * (60,40) → 가로 0 · 세로 +100).
 * ⒜ = 그 글자를 «가로로» 끄는 순간에만 폭을 내용 폭 px 로 바꾸고 보이는 자리를 지킨다(끈 글자만 dataset.width 100%→px).
 * 조건(지디): ㉠ 바꾸는 순간 글자 자리 가로 델타 0 ㉢ 세로만 ×3 이면 dataset.width 그대로 '100%'.
 * (㉡ 저장·다시 연 뒤 프레임 폭 바꾸기 = 실앱 표가 진다.)
 *
 * ⛔앱을 «안» 띄운다 — js/block-drag.js 를 진짜 ES 모듈로 얹고 bindBlock 만. 마우스는 page.mouse.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/drag-fullwidth-text-horizontal.dom.spec.js
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

const HARNESS = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; } body { margin:0; font: 32px/1.4 sans-serif; }
  #canvas-wrap { position:relative; width:1000px; height:800px; background:#555; }
  .section-block { position:relative; width:800px; height:600px; background:#fff; }
  .frame-block { position:relative; overflow:hidden; }
</style></head><body>
<div id="canvas-wrap"><div id="canvas-scaler" style="transform:scale(1);transform-origin:0 0"><div id="canvas">
  <div class="section-block" id="sec"><div class="section-inner" id="inner"></div></div>
</div></div></div>
<div id="ss-handles-overlay"></div>
<script src="/js/feature-flags.js"></script>
<script>
  window.currentZoom = 100;
  window.__pushes = [];
  window.pushHistory = (label) => window.__pushes.push(label || '');
  window.scheduleAutoSave = () => {}; window.triggerAutoSave = () => {}; window.buildLayerPanel = () => {};
  window.beginDragHistory = () => ({ arm: () => {} });
  window._findSectionAt = () => null;
  window.deselectAll = () => document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
</script>
<script type="module">
  import '/js/block-drag.js';
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
  await page.waitForFunction(() => window.__ready === true && typeof window.bindBlock === 'function');
  return errs;
}

/* 사본 꼴(자유 프레임 516×361 · 위치 없음 > 글자 프레임 absolute · 폭 100% > 가운데 «25%»). ⚠️top 은 40 — 사본의 152 는 이 하네스 글자 높이(45)에서
   프레임 세로 가운데(158)와 6px 라 스냅이 세로를 6 끌어당겨 «가로만» 장면이 깨졌다(고치기 전 판도 152→158). 요구(가로)를 재도록 장면을 옮겼다. */
async function mount(page, align = 'center') {
  await page.evaluate((align) => {
    document.getElementById('inner').innerHTML =
      '<div class="frame-block" id="fr" data-free-layout="true" style="width:516px;height:361px;padding:0;margin:0 auto">' +
      '<div class="frame-block" id="tf" data-text-frame="true" data-width="100%" data-offset-x="0" data-offset-y="40" ' +
      'style="background:transparent;width:100%;box-sizing:border-box;position:absolute;left:0px;top:40px">' +
      `<div class="text-block" id="tb" data-type="body"><div class="tb-body" style="text-align:${align}">25%</div></div></div></div>`;
    const fr = document.getElementById('fr');
    window.bindBlock(document.getElementById('tb'));
    // 사람 순서(실앱 ㉠): 첫 클릭 = 프레임 고름 → 그 뒤 글자 위를 끈다
    fr.classList.add('selected'); window._activeFrame = fr;
  }, align);
}
const glyph = (page) => page.evaluate(() => {
  const n = document.querySelector('#tb .tb-body').firstChild; const r = document.createRange(); r.selectNodeContents(n);
  const b = r.getBoundingClientRect(); const tf = document.getElementById('tf');
  return { gx: Math.round(b.left * 10) / 10, gy: Math.round(b.top * 10) / 10, w: tf.style.width, dw: tf.dataset.width, L: parseFloat(tf.style.left), T: parseFloat(tf.style.top) };
});
async function drag(page, dx, dy) {
  const g = await page.evaluate(() => { const n = document.querySelector('#tb .tb-body').firstChild; const r = document.createRange(); r.selectNodeContents(n); const b = r.getBoundingClientRect(); return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) }; });
  await page.mouse.move(g.x, g.y);
  await page.mouse.down();
  await page.mouse.move(g.x + dx / 2, g.y + dy / 2);
  await page.mouse.move(g.x + dx, g.y + dy);
  await page.mouse.up();
}

test('전제 — block-drag.js 가 콘솔 오류 없이 얹힌다', async ({ page }) => {
  const errs = await boot(page);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

for (const align of ['center', 'right']) {
  test(`D3a[${align}] ★프레임 고른 뒤 가로로 끌면 글자가 «끈 만큼» 움직인다(바꾸는 순간 튐 0)`, async ({ page }) => {
    await boot(page);
    await mount(page, align);
    const b = await glyph(page);
    const DX = align === 'right' ? -120 : 120;
    await drag(page, DX, 0);
    const a = await glyph(page);
    expect(Math.abs((a.gx - b.gx) - DX), `글자 가로 이동=${(a.gx - b.gx).toFixed(1)} 기대 ${DX} · 전=${JSON.stringify(b)} 뒤=${JSON.stringify(a)} (고치기 전 실측 = 0)`).toBeLessThanOrEqual(1);
    expect(Math.abs(a.gy - b.gy), `세로는 안 움직여야 한다(Δ${a.gy - b.gy})`).toBeLessThanOrEqual(1);
    expect(a.dw, `끈 글자만 폭이 px 로 바뀐다(dataset.width=${a.dw})`).not.toBe('100%');
  });
}

test('D3b ㉢ 세로만 100 ×3 — dataset.width 는 그대로 100%', async ({ page }) => {
  await boot(page);
  await mount(page, 'center');
  const b = await glyph(page);
  for (let i = 0; i < 3; i++) { await drag(page, 0, 30); }
  const a = await glyph(page);
  expect({ dw: a.dw, w: a.w }, `세로만 끈 뒤=${JSON.stringify(a)}`).toEqual({ dw: '100%', w: '100%' });
  expect(a.gy - b.gy, '세로는 움직였어야 한다(장면 확인)').toBeGreaterThan(50);
});

/* ══════════════════════════════════════════════════════════════════════════════
 * ★★W (2026-10-10) — ★★「프레임에 텍스트를 더하면 ★처음 1줄인데 ★움직이면 ★2줄로 바뀐다」
 *   ★현빈 2026-10-10 · ★측정 t3frame · ★고침 = `fitContentWidthPx`(js/frame-geometry.js)
 *
 * ★★왜 ★위 D3a/D3b 가 ★이 증상을 ★못 잡았나 — ★★하네스 글자가 ★`"25%"` 라 ★★넘칠 수가 없다.
 *   ⇒ ★D3a 의 ★「글자 가로이동 ±1px」은 ★★줄바꿈 표본에서 ★★깨진다(실측: ★비줄바꿈 ★정확히 120 ·
 *     ★줄바꿈 ★211.4 — ★★91px 튄다). ★즉 ★자가 ★있었는데 ★★장면이 ★증상을 ★안 만들었다.
 *
 * ★★⒜ ★양성대조를 ★★«글꼴 운»에 맡기지 ★않는다 — ★★«결정론 장면»을 쓴다:
 *   ★`width:50.1px` ★인라인블록 ★둘 ⇒ ★자연폭 ★100.2 ⇒ ★`offsetWidth` ★100(★내림) ⇒
 *   ★100px 에 ★100.2 가 ★안 들어가 ★★둘째가 ★줄바꿈 ⇒ ★★높이가 ★2배.
 *   ★★글꼴에 ★전혀 ★안 기댄다 ⇒ ★★어느 기계에서도 ★같은 빨강이 ★선다.
 *
 * ★★⛔`Math.ceil` 을 ★단언에 ★쓰지 ★않는다 — ★그건 ★★구현을 ★다시 적는 것이고,
 *   ★`ceil(자연폭) ≥ 자연폭` 이라 ★★거의 ★항등식이다(t3frame 이 ★자기 가름칸에서 ★그 흠을 ★겪었다).
 *   ⇒ ★★단언은 ★★«불변식»으로: ★★「끌기 뒤 ★줄 수 == ★자연폭에서의 ★줄 수」.
 *     ★그 식은 ★부호가 ★어느 쪽이든 ★참이어야 하고, ★★옛 코드에서는 ★★양수 표본에서 ★깨진다.
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js drag-fullwidth-text
 * ══════════════════════════════════════════════════════════════════════════════ */

/* ★결정론 장면 — ★글자가 아니라 ★«폭이 못박힌 인라인블록 둘». ★`font-size:0` 은 ★사이 공백을 없앤다. */
const SPAN_W = 50.1;
async function mountSpans(page, align = 'center', dw = '100%') {
  await page.evaluate(({ align, dw, sw }) => {
    const w = dw === '100%' ? '100%' : dw + 'px';
    document.getElementById('inner').innerHTML =
      '<div class="frame-block" id="fr" data-free-layout="true" style="width:516px;height:361px;padding:0;margin:0 auto">' +
      `<div class="frame-block" id="tf" data-text-frame="true" data-width="${dw}" data-offset-x="0" data-offset-y="40" ` +
      `style="background:transparent;width:${w};box-sizing:border-box;position:absolute;left:0px;top:40px">` +
      '<div class="text-block" id="tb" data-type="body">' +
      `<div class="tb-body" style="text-align:${align};font-size:0">` +
      `<span style="display:inline-block;width:${sw}px;height:20px;background:#39f"></span>` +
      `<span style="display:inline-block;width:${sw}px;height:20px;background:#f93"></span>` +
      '</div></div></div></div>';
    window.bindBlock(document.getElementById('tb'));
    const fr = document.getElementById('fr');
    fr.classList.add('selected'); window._activeFrame = fr;
  }, { align, dw, sw: SPAN_W });
}

/* ★자연폭에서의 ★높이·정수폭 — ★«옛 식»이 ★무엇을 박았을지까지 ★같이 돌려준다. */
const fitProbe = (page) => page.evaluate(() => {
  const tf = document.getElementById('tf');
  const prev = tf.style.width;
  tf.style.width = 'fit-content';
  const fitH = tf.offsetHeight;
  const oldFormulaW = Math.round(tf.offsetWidth);   /* ★고치기 «전» 판이 쓰던 식을 ★검사가 ★직접 적는다 */
  tf.style.width = prev;
  return { fitH, oldFormulaW };
});
const boxOf = (page) => page.evaluate(() => {
  const tf = document.getElementById('tf');
  return { h: tf.offsetHeight, w: tf.style.width, dw: tf.dataset.width };
});
/* ★상자 가운데를 ★가로로 끈다(글자 노드가 없는 장면이라 Range 를 못 쓴다). */
async function dragBox(page, dx, dy) {
  const b = await page.evaluate(() => {
    const r = document.getElementById('tf').getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  });
  await page.mouse.move(b.x, b.y);
  await page.mouse.down();
  await page.mouse.move(b.x + dx / 2, b.y + dy / 2);
  await page.mouse.move(b.x + dx, b.y + dy);
  await page.mouse.up();
}

test('W1 ★양성대조 — ★«옛 식»(정수 내림)을 손으로 박으면 ★줄이 ★늘어난다 (★이 장면이 증상을 만드는가)', async ({ page }) => {
  await boot(page);
  await mountSpans(page);
  const { fitH, oldFormulaW } = await fitProbe(page);
  const grown = await page.evaluate((w) => {
    const tf = document.getElementById('tf');
    tf.style.width = w + 'px';
    const h = tf.offsetHeight;
    tf.style.width = '100%';
    return h;
  }, oldFormulaW);
  expect(fitH, '전제 — 자연폭에서 한 줄이어야 한다').toBeGreaterThan(0);
  expect(grown, `★옛 식 폭(${oldFormulaW}px)에서 높이가 ${grown}, 자연폭에서 ${fitH} — ★늘지 않으면 ★이 장면은 ★증상을 못 만든다(검사 설계의 흠)`)
    .toBeGreaterThan(fitH);
});

test('W2 ★고친 뒤 — ★가로로 끌어도 ★줄 수가 ★자연폭과 ★같다 (★불변식)', async ({ page }) => {
  await boot(page);
  await mountSpans(page);
  const { fitH, oldFormulaW } = await fitProbe(page);
  const before = await boxOf(page);
  await dragBox(page, 120, 0);
  const after = await boxOf(page);
  expect(before.dw, '전제 — 끌기 전엔 폭이 100% 다').toBe('100%');
  expect(after.dw, `★전제(⒟) — 끌기가 폭을 100%→px 로 ★바꿨다 (dw=${after.dw})`).not.toBe('100%');
  expect(after.h, `★★끌기 뒤 높이 ${after.h} ≠ 자연폭 높이 ${fitH} — ★줄 수가 바뀌었다(= 현빈 「1줄→2줄」)`).toBe(fitH);
  expect(after.dw, `★★«옛 식»이 박던 정수(${oldFormulaW})가 ★그대로면 ★고침이 안 걸렸다`).not.toBe(String(oldFormulaW));
});

test('W3 ★음성대조 — ★발동 조건이 ★안 서면(left 정렬 ＋ 폭 px) ★폭도 ★줄도 ★안 바뀐다', async ({ page }) => {
  await boot(page);
  await mountSpans(page, 'left', '500');
  const before = await boxOf(page);
  await dragBox(page, 120, 0);
  const after = await boxOf(page);
  expect(after.dw, '폭이 바뀌면 안 된다').toBe('500');
  expect(after.h, '줄 수가 바뀌면 안 된다').toBe(before.h);
});

/* ★★현빈 ★원문 글자 — ★실재성 칸. ★단언은 ★위와 ★같은 ★불변식 하나다.
   ⚠️★이 하네스 글꼴은 `32px/1.4 sans-serif`(파일 머리 HARNESS)라 ★실앱 프리셋과 ★다르다
     ⇒ ★★«버린양의 부호»는 ★기계·글꼴에 따라 ★달라질 수 있다. ★그래서 ★★부호를 ★단언하지 ★않고
       ★★«불변식»만 단언한다 — ★부호가 음수여도 ★참이고, ★양수일 때 ★옛 코드에서 ★깨진다.
     ★★결정론 빨강은 ★W1 이 ★맡는다(★이 칸은 ★그 보조다). */
for (const t of ['본문 내용을 입력하세요.', '본문 내용을 입력하세요']) {
  test(`W4 ★현빈 원문 「${t}」 — ★끌기 뒤 ★줄 수가 ★자연폭과 ★같다`, async ({ page }) => {
    await boot(page);
    await mount(page, 'center');
    await page.evaluate((txt) => { document.querySelector('#tb .tb-body').textContent = txt; }, t);
    const lines = () => page.evaluate(() => {
      const n = document.querySelector('#tb .tb-body').firstChild;
      const r = document.createRange(); r.selectNodeContents(n);
      return r.getClientRects().length;
    });
    const natural = await page.evaluate(() => {
      const tf = document.getElementById('tf');
      const prev = tf.style.width;
      tf.style.width = 'fit-content';
      const n = document.querySelector('#tb .tb-body').firstChild;
      const r = document.createRange(); r.selectNodeContents(n);
      const L = r.getClientRects().length;
      const frac = Math.round(tf.getBoundingClientRect().width * 100) / 100;
      const intW = tf.offsetWidth;
      tf.style.width = prev;
      return { L, frac, intW, lost: Math.round((frac - intW) * 100) / 100 };
    });
    expect(await lines(), '전제 — 폭 100% 에서 한 줄이다').toBe(1);
    await drag(page, 120, 0);
    const after = await lines();
    expect(after, `★끌기 뒤 ${after}줄 · 자연폭에서 ${natural.L}줄 · 버린양 ${natural.lost}(자연폭 ${natural.frac} − offsetWidth ${natural.intW})`)
      .toBe(natural.L);
  });
}
