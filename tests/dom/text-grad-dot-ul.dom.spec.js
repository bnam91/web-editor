/* text-grad-dot-ul — ⑸그라데이션＋점 버그 · ⑵형광펜 획 세로자리 · ⑷밑줄 두께·색·위치
 * (2026-10-08 현빈 직접 지시 — ★원문:
 *   「텍스트 블럭에 ★그라데이션 색지정과, ★점 효과를 같이 주니까 ★텍스트가 안보이던가 버그가 있어 개선해줘」 tb_64wad_7yqfksr
 *   「하이라이트(형광펜) 기능 ★바높이 ★및 y값도 조절」
 *   「언더라인 기능도 ★두께 조절」)
 *
 * ★★⑸ 를 ★고치기 ★전에 ★쟀다 — ★무엇이 덮는지를 ★가르는 대조 (이 하네스 · 같은 자):
 *     단색·점✗ dark ★2278 / 그라✓·점✗ ★2315 / ★그라✓·점✓ ★354   ⇒ ★글자 ★85% 소실
 *   ★한 변수씩 되돌리면 ★셋 다 살린다:
 *     .tb-dot 에 채움색 ★2538 · .tb-dot 을 position:static ★2478 · .tb-dot 에 제 그라데이션 상속 ★2566
 *   ★판정 = ★«한 쌍»이고 ★바뀐 쪽은 ★점이다 —
 *     그라데이션의 -webkit-text-fill-color:transparent 는 ★혼자서는 ★무해하다(그라만 켠 판 2315 가 증거).
 *     ★.tb-dot 이 ★positioned 라 ★그 글자가 ★부모의 background-clip:text ★밖으로 나가
 *     ★«메울 것 없는 투명 글자» = ★빈 구멍이 된다.
 *   ⇒ ★.tb-dot 이 ★제 글자를 ★스스로 칠한다(--tb-grad-fb = 그라데이션 ★첫 스탑).
 *
 * ★★이 파일의 ★자 — ⛔span 수·변수값이 아니라 ★★«그려진 픽셀»을 센다.
 *   dark = 흰 배경과의 거리 ≥60 인 픽셀 수 · wideRows = 가로로 ★6할 이상 채워진 ★줄 수(= 선의 두께)
 *   ★문턱은 ★맨숫자가 아니라 ★«같은 판에서 잰 다른 상태»에 대한 ★비율이다(절대수를 박으면 폰트·DPR 에 썩는다).
 *
 * 재는 것
 *   G0  ★전제 — 그라데이션이 ★실제로 걸렸고 점 span 이 ★생겼다(단언이 공중에 안 떠 있게)
 *   G1  ★★양성 — 그라✓＋점✓ 에서 ★글자가 ★보인다(그라만 켠 판의 ★8할 이상). ★고치기 전 판에서 ★0.15 ⇒ ★빨강
 *   G2  ★음성대조 — ★하나만 켠 판은 ★전과 같다(점만 / 그라만 둘 다 단색 판의 8할 이상)
 *   G-N1 ★무접촉 증명 — 그라데이션이 ★없으면 새 규칙이 ★inert 하다(점 글자의 채움색 == 그 글자의 color)
 *   G3  ★저장 왕복 — 저장본에 --tb-grad-fb 가 실리고, 다시 열어도 ★글자가 보인다
 *   G4  ★옛 저장본 — --tb-grad-fb 가 ★없어도 ★currentColor 로 내려앉아 ★글자가 보인다(마이그레이션 불요)
 *   Y0  ★전제 — 패널 Y 칸의 ★처음 값이 ★computed --tb-hl-y 에서 ★파생한다(명부 둘 방지)
 *   Y1  ★★형광펜 Y — 패널로 바꾸면 ★그려진 획이 ★그만큼 ★옮겨간다
 *   Y-N1 ★repeat 음성대조 — 획을 ★상자 높이만큼 위로 밀면 ★아래쪽엔 ★아무것도 없다
 *        (no-repeat 가 빠지면 ★다음 벌이 ★아래쪽에 그려진다 — ★그 둘을 가르는 자다)
 *   U-C1 ★밑줄 «색 칸»이 ★실제로 선다 — ★골든이 ★못 보는 그 자리(typo-section-ssot.test.mjs 머리말의 셋째)
 *   U1  ★★밑줄 두께 — 칸에 수를 넣으면 ★그려진 선이 ★두꺼워진다
 *   U2  ★빈 값 = ★자동으로 되돌린다(인라인이 지워지고 ★두께가 처음으로)
 *   U3  ★밑줄 위치 — 칸을 주면 ★선이 ★내려간다
 *   U4  ⚠️★취소선 동반 — ★같이 두꺼워진다. ⛔「밑줄만 바뀐다」가 ★아님을 ★적는다(CSS 가 선별로 못 준다)
 *
 * ⛔이 하네스로 «못 재는» 축: Electron 재기동 · 파일로 쓰인 export.html 바이트 · 네이티브 메뉴 ·
 *   현빈의 그 블럭(tb_64wad_7yqfksr) ★자체(라이브 트리 무접촉 ⇒ ★같은 꼴을 ★내가 만들어 쟀다).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js text-grad-dot-ul
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SEC = '<div class="section-block" id="sA" data-section="1" data-name="sA" style="background-color:#ffffff;padding:80px 0 0 80px"><div class="section-hitzone"></div><div class="section-inner" id="inA"></div></div>';
const GRAD = 'linear-gradient(90deg, #00aa55 0%, #3300ff 100%)';
const HL_HEX = '#ffd400';          /* 글자(#555 계열)·흰 배경과 ★안 섞이는 색 — 그림에서 획만 골라 센다 */

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate((html) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', html);
    window.rebindAll?.(); window.deselectAll?.(); window.applyZoom?.(100);
    document.getElementById('sA').classList.add('selected');
  }, SEC);
  await page.waitForTimeout(250);
  return errs;
}
const insertText = (page, content = 'AAA BBB CCC') => page.evaluate((t) => {
  const before = new Set([...document.querySelectorAll('#canvas [id]')].map(e => e.id));
  document.getElementById('sA').classList.add('selected');
  window.addTextBlock('body', { content: t });
  const fresh = [...document.querySelectorAll('#canvas .text-block')].filter(e => !before.has(e.id));
  return fresh.length ? fresh[fresh.length - 1].id : null;
}, content);
const openPanel = async (page, id) => {
  await page.evaluate((i) => window.showTextProperties(document.getElementById(i)), id);
  await page.waitForSelector('#txt-style-group', { state: 'attached' });
};
async function clickBtn(page, sel) {
  const b = await page.locator(sel).first().boundingBox();
  if (!b) throw new Error('no box: ' + sel);
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(200);
}
async function typeField(page, sel, v) {
  await page.fill(sel, String(v));
  await page.press(sel, 'Enter');
  await page.waitForTimeout(180);
}
const putGrad = async (page, id) => {
  await page.evaluate(([i, g]) => window.applyTextGradient(document.getElementById(i), { css: g }, { commit: true }), [id, GRAD]);
  await page.waitForTimeout(180);
};

/* ★★찍기 «전»에 편집 전용 표시를 걷는다 — 고른 블럭의 ★파란 외곽선이 잉크로 세어진다
   (text-dot-over.dom.spec.js paintedDots 가 같은 일을 같은 까닭으로 한다). 재고 나서 되돌린다. */
async function shot(page, sel) {
  const restore = await page.evaluate(() => {
    const picked = [...document.querySelectorAll('#canvas .selected, #canvas .editing')];
    return picked.map(e => { e.classList.remove('selected', 'editing'); return e.id || ''; });
  });
  const el = await page.$(sel);
  if (!el) throw new Error('no element: ' + sel);
  const b64 = (await el.screenshot()).toString('base64');
  await page.evaluate((ids) => ids.forEach(i => { if (i) document.getElementById(i)?.classList.add('selected'); }), restore);
  return b64;
}
/* dark = 흰색과의 거리 ≥60 · rows = 줄마다 dark 개수 · band = 어떤 색이 ★6할 이상인 줄 구간들 */
function measureInPage() {
  return async (s, hex) => {
    const im = new Image(); im.src = 'data:image/png;base64,' + s; await im.decode();
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    const want = hex ? [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)] : null;
    let dark = 0; const rows = []; const hitRows = [];
    for (let y = 0; y < c.height; y++) {
      let rd = 0, rh = 0;
      for (let xx = 0; xx < c.width; xx++) {
        const i = (y * c.width + xx) * 4;
        if (d[i + 3] < 8) continue;
        if (Math.max(255 - d[i], 255 - d[i + 1], 255 - d[i + 2]) >= 60) rd++;
        if (want && Math.abs(d[i] - want[0]) < 40 && Math.abs(d[i + 1] - want[1]) < 40 && Math.abs(d[i + 2] - want[2]) < 40) rh++;
      }
      dark += rd; rows.push(rd); hitRows.push(rh);
    }
    /* ★★선의 «두께»는 ★맨숫자로 못 잰다 — 글자 폭이 상자 폭보다 ★한참 좁아
         「상자 폭의 6할」로 재면 ★0건이 나온다(2026-10-08 ★내가 그 0건을 ★겪었다 — ★부재가 아니라 ★창이었다).
       ⇒ ★같은 그림의 ★peak(가장 진한 줄)에 ★견준다 — ★선은 글자 사이 틈까지 ★이어져 ★언제나 peak 다.
         ★글자 가로획(A 의 그 줄)은 ★글자 사이가 ★비어 peak 의 85% 에 ★못 미친다. */
    const peak = rows.length ? Math.max(...rows) : 0;
    const TH = peak * 0.85;
    let run = { start: -1, len: 0 }, cs2 = -1;
    for (let y = 0; y <= rows.length; y++) {
      const on = y < rows.length && peak > 0 && rows[y] >= TH;
      if (on && cs2 < 0) cs2 = y;
      if (!on && cs2 >= 0) { if (y - cs2 > run.len) run = { start: cs2, len: y - cs2 }; cs2 = -1; }
    }
    const wide = run.len;
    /* ★색 띠 — ★문턱 ★1.5할. ⛔3할로 두면 ★글자의 ★가로획이 색을 ★가려 ★한 띠가 ★둘로 쪼개진다
       (2026-10-08 실측: Y −10 에서 [[16,23],[27,32]] — ★가운데 24~26 이 ★'A' 의 가로획이었다.
        ⛔그걸 「획이 두 줄이 됐다」로 읽으면 ★제품을 엉뚱하게 고친다. ★쪼갠 것은 ★자였다). */
    const bands = []; let st = -1; let firstHit = -1, lastHit = -1, hitTotal = 0;
    for (let y = 0; y <= c.height; y++) {
      const on = y < c.height && hitRows[y] >= c.width * 0.15;
      if (y < c.height) { hitTotal += hitRows[y]; if (hitRows[y] > 0) { if (firstHit < 0) firstHit = y; lastHit = y; } }
      if (on && st < 0) st = y;
      if (!on && st >= 0) { bands.push([st, y - 1]); st = -1; }
    }
    return { dark, wide, peak, run, w: c.width, h: c.height, bands, firstHit, lastHit, hitTotal };
  };
}
async function measure(page, sel, hex) {
  const b64 = await shot(page, sel);
  return page.evaluate(async ([s, h, fnSrc]) => (eval('(' + fnSrc + ')')())(s, h), [b64, hex || null, measureInPage.toString()]);
}

/* ══ ⑸ 그라데이션 ＋ 점 ══════════════════════════════════════════════════ */

test('G0·G1·G2 ★그라데이션＋점 — 글자가 보인다(양성) ＋ 하나만 켠 판은 전과 같다(음성)', async ({ page }) => {
  const errs = await setup(page);
  const id = await insertText(page);
  await openPanel(page, id);
  const sel = `#${id} .tb-body`;

  const solid = await measure(page, sel);
  expect(solid.dark, `★전제 — 아무것도 안 켠 글자가 ★안 그려졌다(잰 dark ${solid.dark}). 자가 고장났다`).toBeGreaterThan(500);

  await clickBtn(page, '#txt-dot-btn');
  const solidDot = await measure(page, sel);
  await clickBtn(page, '#txt-dot-btn');          // 끄기

  await putGrad(page, id);
  const gradOnly = await measure(page, sel);
  // ── G0 전제 ──
  const g0 = await page.evaluate((i) => {
    const ce = document.getElementById(i).querySelector('.tb-body');
    const cs = getComputedStyle(ce);
    return { clip: cs.backgroundClip + '|' + cs.webkitBackgroundClip, fill: cs.webkitTextFillColor,
             img: /gradient\(/.test(cs.backgroundImage), fb: cs.getPropertyValue('--tb-grad-fb').trim() };
  }, id);
  expect(g0.img, '★전제 — 그라데이션이 ★안 걸렸다').toBe(true);
  expect(g0.clip, `★전제 — background-clip 이 text 가 아니다. 잰 값 ${g0.clip}`).toMatch(/text/);
  expect(g0.fill, `★전제 — 채움색이 투명이 아니다(그러면 이 버그의 판이 아니다). 잰 값 ${g0.fill}`).toMatch(/rgba\(0, 0, 0, 0\)/);
  /* ★--tb-grad-fb 가 ★«첫 스탑»인가 — ★그 값은 ★textGradientFallbackColor(내보내기 경로의 그 함수)에서 ★읽는다.
     ⇒ ★여기서는 ★걸린 그라데이션의 ★첫 색과 ★견준다. ★어긋나면 ★화면과 PNG 가 ★갈린다. */
  expect(g0.fb, `★--tb-grad-fb 가 그라데이션 ★첫 스탑이 아니다. 잰 값 ${JSON.stringify(g0.fb)} (걸린 css ${GRAD})`).toBe('#00aa55');
  /* ★★지디 요구 ⑶ — ★「그라만 켠 판」이 ★실제로 ★글자를 그린다를 ★절대수로 먼저 단언한다.
     ⛔이 수는 ★환경에 묶인 ★닻이다(헤드리스 크로미움 · Pretendard · DPR1 · 16px body · 'AAA BBB CCC').
       ★실측 2026-10-08 = ★2315. ★느슨하게 ★2000 으로 둔다 — ★안 서면 ★아래 ★비율 단언이 ★공허해진다.
       ★환경이 바뀌어 빨개지면 ★먼저 ★이 줄의 ★닻을 다시 재고 ★왜 바뀌었는지 적어라. */
  expect(gradOnly.dark, `★전제 — 그라만 켠 판의 글자 픽셀이 ${gradOnly.dark} 다(닻 2315). ★이게 안 서면 아래 비율이 공허하다`).toBeGreaterThan(2000);

  await openPanel(page, id);
  await clickBtn(page, '#txt-dot-btn');
  const nSpan = await page.evaluate((i) => document.getElementById(i).querySelectorAll('span.tb-dot').length, id);
  expect(nSpan, `★전제 — 점 span 이 ★안 생겼다. 잰 값 ${nSpan}`).toBe(9);
  const gradDot = await measure(page, sel);

  console.log(`  G: solid=${solid.dark} solidDot=${solidDot.dark} gradOnly=${gradOnly.dark} gradDot=${gradDot.dark}`);
  // ── G2 음성대조 — 하나만 켠 판은 단색 판과 비슷하다 ──
  expect(solidDot.dark / solid.dark, `★음성 — 점만 켰는데 글자가 줄었다 (${solidDot.dark} / ${solid.dark})`).toBeGreaterThan(0.8);
  expect(gradOnly.dark / solid.dark, `★음성 — 그라만 켰는데 글자가 줄었다 (${gradOnly.dark} / ${solid.dark})`).toBeGreaterThan(0.8);
  // ── G1 양성 — ★고치기 전 판에서 이 비는 ★0.15 였다(354/2315) ⇒ ★그 판에서 ★빨강이다 ──
  expect(gradDot.dark / gradOnly.dark,
    `★★그라데이션＋점에서 ★글자가 사라졌다 — 잰 dark ${gradDot.dark} vs 그라만 ${gradOnly.dark}. ` +
    '고치기 전 판의 비는 0.15 였다(354/2315). css .tb-dot 의 -webkit-text-fill-color 규칙을 보라')
    .toBeGreaterThan(0.8);
  /* ★★지디 요구 ⑴ — ★절대 하한도 ★같이 건다(★고친 뒤 실측 2538/2643 에서 ★느슨하게 2000). */
  expect(gradDot.dark, `★★그라데이션＋점의 글자 픽셀이 ${gradDot.dark} 다 — 고친 뒤 실측 닻 2538. 고치기 전은 ★354 였다`).toBeGreaterThan(2000);
  expect(errs, `★페이지 오류: ${errs.join(' | ')}`).toEqual([]);
});

test('G-N1 ★그라데이션이 없으면 새 규칙이 inert 하다 (점 글자 채움색 == 그 글자 color)', async ({ page }) => {
  await setup(page);
  const id = await insertText(page, 'ABC');
  await openPanel(page, id);
  await clickBtn(page, '#txt-dot-btn');
  const v = await page.evaluate((i) => {
    const sp = document.getElementById(i).querySelector('span.tb-dot');
    if (!sp) return { err: 'no dot span' };
    const cs = getComputedStyle(sp);
    return { fill: cs.webkitTextFillColor, color: cs.color, fb: cs.getPropertyValue('--tb-grad-fb').trim() };
  }, id);
  expect(v.err).toBeUndefined();
  expect(v.fb, `★전제 — 그라데이션을 안 걸었는데 --tb-grad-fb 가 있다. 잰 값 ${JSON.stringify(v.fb)}`).toBe('');
  expect(v.fill, `★그라데이션이 없는데 점 글자의 채움색이 ★글자색과 다르다 — 새 규칙이 ★안 켠 글을 바꾼다. 채움 ${v.fill} / 색 ${v.color}`)
    .toBe(v.color);
});

test('G3·G4 ★저장 왕복 ＋ 옛 저장본(--tb-grad-fb 없음) 내려앉기', async ({ page }) => {
  /* ★★자 주의 — ★재로드 뒤에는 ★상자가 ★달라진다. 2026-10-08 실측: 같은 블럭이
       ★780×57.6 → ★286×23.0 으로 바뀌었다(줌·캔버스 폭이 다시 선다) ⇒ ★저장 전 수와 ★저장 후 수를
       그대로 견주면 ★0.43 이 나온다. ★그것은 「글자가 사라졌다」가 ★아니라 ★★«내 창이 바뀌었다»다.
     ⇒ ★★대조군을 ★★«같은 창 안»에서 ★만든다 — 재로드 ★뒤에 ★단색으로 되돌린 판을 ★기준으로 쓴다. */
  await setup(page);
  const id = await insertText(page, 'ABC');
  await openPanel(page, id);
  await putGrad(page, id);
  await openPanel(page, id);
  await clickBtn(page, '#txt-dot-btn');
  const sel = `#${id} .tb-body`;

  const snap = await page.evaluate(() => window.serializeProject());
  expect(/--tb-grad-fb/.test(snap), '★저장본에 --tb-grad-fb 가 ★안 실렸다 — 다시 열면 글자가 다시 사라진다').toBe(true);

  await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(JSON.parse(d)), snap);
  await page.waitForTimeout(400);

  // ── 전제: 재로드 뒤에도 «그 판»이다(그라데이션·점·대체색이 다 살아 있나) ──
  const st = await page.evaluate((i) => {
    const tb = document.getElementById(i); if (!tb) return { err: 'tb 가 다시 안 생겼다' };
    const ce = tb.querySelector('.tb-body'); const sp = ce && ce.querySelector('span.tb-dot');
    if (!sp) return { err: '점 span 이 다시 안 생겼다' };
    return { nDot: ce.querySelectorAll('span.tb-dot').length, fb: getComputedStyle(sp).getPropertyValue('--tb-grad-fb').trim(),
             fill: getComputedStyle(sp).webkitTextFillColor, text: ce.innerText };
  }, id);
  expect(st.err).toBeUndefined();
  expect(st.nDot, `★다시 연 뒤 점이 사라졌다. 잰 값 ${st.nDot}`).toBe(3);
  expect(st.fb, `★다시 연 뒤 --tb-grad-fb 가 사라졌다. 잰 값 ${JSON.stringify(st.fb)}`).toBe('#00aa55');
  expect(st.fill, `★다시 연 뒤 점 글자의 채움색이 ★첫 스탑이 아니다. 잰 값 ${st.fill}`).toBe('rgb(0, 170, 85)');

  const gd = await measure(page, sel);                 // 그라✓점✓ (재로드 뒤)
  // ── G4 ★옛 저장본 — 그 변수가 ★없는 판 (★같은 창) ──
  await page.evaluate((i) => document.getElementById(i).querySelector('.tb-body').style.removeProperty('--tb-grad-fb'), id);
  await page.waitForTimeout(150);
  const noFb = await measure(page, sel);
  // ── ★같은 창의 ★기준 = 그라데이션을 ★푼 판(단색) ──
  await page.evaluate((i) => { const ce = document.getElementById(i).querySelector('.tb-body'); ce.style.removeProperty('--tb-grad-fb'); window.applyTextBlockColor(document.getElementById(i), '#555555'); }, id);
  await page.waitForTimeout(200);
  const solid = await measure(page, sel);
  console.log(`  G3/G4(재로드 뒤 ★같은 창 ${solid.w}x${solid.h}): gradDot=${gd.dark} noFb=${noFb.dark} solid=${solid.dark}`);
  expect([gd.w, gd.h], `★전제 — 세 번 재는 사이에 ★창이 바뀌었다 (${gd.w}x${gd.h} vs ${solid.w}x${solid.h})`).toEqual([solid.w, solid.h]);
  expect(gd.dark / solid.dark, `★다시 연 뒤 글자가 사라졌다 (${gd.dark} / ${solid.dark})`).toBeGreaterThan(0.8);
  expect(noFb.dark / solid.dark, `★--tb-grad-fb 가 ★없는 ★옛 저장본에서 글자가 사라졌다 (${noFb.dark} / ${solid.dark}) — currentColor 로 내려앉지 않는다`).toBeGreaterThan(0.6);
});

/* ══ ⑵ 형광펜 획 세로자리 ════════════════════════════════════════════════ */

test('Y0·Y1·Y-N1 ★형광펜 획 세로자리 — 준 만큼 옮겨가고, 아래로 또 그려지지 않는다', async ({ page }) => {
  /* ★★자 주의 ★둘 (2026-10-08 ★내가 ★둘 다 겪었다):
     ⑴ ★창 — .tb-body 상자는 ★780px 인데 글자는 ★100px 쯤이다 ⇒ 「상자 폭의 3할」로 색 띠를 찾으면 ★0건이다.
        ⇒ ★★획 그 자체(.tb-hl span)를 ★찍는다 — 띠가 ★그 상자를 ★가로로 다 채운다.
     ⑵ ★바 높이 ★100% 면 ★띠가 ★상자를 ★다 덮어 ★Y 를 줘도 ★띠의 ★윗줄이 ★안 움직인다(위로 잘린다).
        ⇒ ★먼저 ★바 높이를 ★40 으로 낮춰 ★띠를 ★상자 ★안쪽에 둔다. ⛔이걸 안 하면 ★제품이 맞는데 ★빨강이 난다. */
  const errs = await setup(page);
  const id = await insertText(page, 'AAAAAA');
  await openPanel(page, id);
  await clickBtn(page, '#txt-highlight-btn');
  await page.evaluate(([i, c]) => document.getElementById(i).style.setProperty('--tb-hl-color', c), [id, HL_HEX]);
  await typeField(page, '#txt-hl-h-num', 40);

  // ── Y0 전제 — 패널 칸의 처음 값이 computed 에서 파생한다 ──
  const y0 = await page.evaluate((i) => ({
    panel: document.getElementById('txt-hl-y-num')?.value,
    css: getComputedStyle(document.getElementById(i)).getPropertyValue('--tb-hl-y').trim(),
    rowShown: getComputedStyle(document.getElementById('txt-hl-y-row')).display,
    repeat: getComputedStyle(document.querySelector(`#${i} .tb-hl`)).backgroundRepeat,
  }), id);
  expect(y0.rowShown, `★전제 — 형광펜을 켰는데 Y 줄이 ★안 열렸다. 잰 값 ${y0.rowShown}`).not.toBe('none');
  expect(`${y0.panel}px`, `★패널 칸(${y0.panel})과 computed --tb-hl-y(${y0.css})가 어긋난다 — 명부가 둘이다`).toBe(y0.css);
  expect(y0.repeat, `★전제 — .tb-hl 이 no-repeat 가 아니다. 잰 값 ${y0.repeat}`).toBe('no-repeat');

  const sel = `#${id} .tb-hl`;
  const at0 = await measure(page, sel, HL_HEX);
  expect(at0.bands.length, `★전제 — 획이 ★한 띠로 안 그려졌다. 잰 띠 ${JSON.stringify(at0.bands)} (상자 ${at0.w}x${at0.h})`).toBe(1);
  expect(at0.bands[0][0] / at0.h, `★전제 — 바 높이 40 인데 띠가 ★아래 40% 에 ★안 앉았다. 잰 띠 ${JSON.stringify(at0.bands)} / 높이 ${at0.h}`).toBeGreaterThan(0.4);
  expect(at0.lastHit, `★전제 — 띠가 ★상자 ★밑까지 안 닿는다(잰 끝 ${at0.lastHit} / 높이 ${at0.h})`).toBeGreaterThan(at0.h - 4);

  // ── Y1 ★양성 — 띠가 ★위로 옮겨갔다(음수 = 위) ──
  await typeField(page, '#txt-hl-y-num', -10);
  const up = await measure(page, sel, HL_HEX);
  console.log(`  Y(상자 ${at0.w}x${at0.h}): at0 band=${JSON.stringify(at0.bands)} first=${at0.firstHit} · y-10 band=${JSON.stringify(up.bands)} first=${up.firstHit}`);
  expect([up.w, up.h], `★전제 — 재는 사이에 창이 바뀌었다 (${at0.w}x${at0.h} → ${up.w}x${up.h})`).toEqual([at0.w, at0.h]);
  const moved = at0.firstHit - up.firstHit;
  expect(moved, `★Y −10 을 줬는데 획이 ★안 옮겨갔다(옮긴 px ${moved}) — 잰 첫 줄 ${at0.firstHit} → ${up.firstHit}`).toBeGreaterThan(4);

  /* ── Y-N1 ★★음성대조 — ★repeat 이면 ★«또 한 벌»이 그려진다.
       ⛔작은 Y(−10)로는 ★안 갈린다 — 그림 한 벌이 상자(약 ${''}h px)만 하니 다음 벌이 ★상자 밖이다.
         ⇒ ★★Y 를 ★상자 높이만큼(−h) 민다. 그러면
            no-repeat → 획이 ★위로 ★다 빠져 ★아래쪽엔 ★아무것도 없고
            repeat    → ★아래쪽에 ★다음 벌의 획이 ★나타난다.
       ⇒ ★★그래서 ★«아래 6할에 색이 없다»가 ★그 둘을 ★가르는 자다. */
  /* ⛔칸의 ★하한을 ★맨숫자로 적지 않는다 — ★칸에서 ★읽는다(마크업과 두 벌이 되면 조용히 갈린다). */
  const yMin = await page.evaluate(() => parseInt(document.getElementById('txt-hl-y-num').min, 10));
  const farY = Math.max(yMin, -at0.h);
  await typeField(page, '#txt-hl-y-num', farY);
  const far = await measure(page, sel, HL_HEX);
  console.log(`  Y-N1(y=${farY} · 칸 하한 ${yMin} · 상자높이 ${at0.h}): band=${JSON.stringify(far.bands)} first=${far.firstHit} last=${far.lastHit} hitTotal=${far.hitTotal}`);
  expect(far.lastHit, `★획을 ${farY}px(상자 높이 ${at0.h} · 칸 하한 ${yMin})만큼 위로 밀었는데 ★아래쪽(줄 ${far.lastHit})에 ★색이 남았다 ` +
    `— background-repeat:no-repeat 가 빠져 ★다음 벌이 그려진 것이다. 잰 띠 ${JSON.stringify(far.bands)}`)
    .toBeLessThan(at0.h * 0.4);
  expect(errs, `★페이지 오류: ${errs.join(' | ')}`).toEqual([]);
});

test('U-C1 ★밑줄 «색 칸»이 실제로 선다 (골든이 못 보는 자리)', async ({ page }) => {
  await setup(page);
  const id = await insertText(page, 'ABC');
  await openPanel(page, id);
  await clickBtn(page, '#txt-underline-btn');
  const v = await page.evaluate(() => {
    const row = document.getElementById('txt-ul-color-row');
    return {
      row: row ? getComputedStyle(row).display : null,
      swatch: !!document.querySelector('#txt-ul-color-row .prop-color-swatch'),
      hex: !!document.getElementById('txt-ul-color-hex'),
      thickShown: document.getElementById('txt-ul-row') ? getComputedStyle(document.getElementById('txt-ul-row')).display : null,
    };
  });
  expect(v.row, `★밑줄을 켰는데 색 줄이 ★안 열렸다. 잰 값 ${v.row}`).not.toBe('none');
  expect(v.swatch, '★밑줄 «색 칸» 스와치가 ★0건 — 골든은 이 자리를 ★못 본다(그래서 여기서 잰다)').toBe(true);
  expect(v.hex, '★밑줄 색 ★hex 칸이 ★없다 — colorFieldHTML 이 안 꽂혔다').toBe(true);
  expect(v.thickShown, `★두께·위치 줄이 ★안 열렸다. 잰 값 ${v.thickShown}`).not.toBe('none');
});

test('U1·U2·U3·U4 ★밑줄 두께·되돌리기·위치 ＋ ⚠️취소선 동반', async ({ page }) => {
  /* ★★자 주의 — ★선의 두께를 ★«상자 폭의 6할»로 재면 ★0건이다(글자가 상자보다 ★한참 좁다).
       2026-10-08 ★내가 그 0건을 ★겪었고 ⇒ ★★같은 그림의 ★peak(가장 진한 줄)에 ★견주는 자로 갈았다
       (measureInPage 의 run — ★선은 글자 사이 틈까지 ★이어져 ★언제나 peak 다).
     ★글자는 ★가로획이 있는 'A' 를 쓴다 — ★그 가로획이 ★peak 의 85% 에 ★못 미쳐야 ★자가 ★선만 고른다.
       ⇒ ★그 «못 미침»을 ★전제로 ★단언한다(안 서면 자가 ★글자를 선으로 센다). */
  const errs = await setup(page);
  const id = await insertText(page, 'AAAAAAAA');
  await openPanel(page, id);
  await clickBtn(page, '#txt-underline-btn');
  const sel = `#${id} .tb-body`;

  const base = await measure(page, sel);
  expect(base.peak, `★전제 — 그림이 ★비었다(peak ${base.peak}). 자가 고장났다`).toBeGreaterThan(10);
  expect(base.wide, `★전제 — 밑줄을 켰는데 ★선 줄이 ★0건이다. 잰 run ${JSON.stringify(base.run)} (상자 ${base.w}x${base.h})`).toBeGreaterThan(0);
  expect(base.wide, `★전제 — 자가 ★글자까지 ★선으로 센다(run ${base.wide}줄). 그러면 두께 변화를 못 가른다`).toBeLessThan(5);

  // ── U1 ★두께 ──
  await typeField(page, '#txt-ul-thick', 6);
  const thick = await measure(page, sel);
  const inl = await page.evaluate((i) => document.getElementById(i).style.getPropertyValue('--tb-ul-thick').trim(), id);
  expect(inl, `★정본(인라인 --tb-ul-thick)이 ★안 박혔다. 잰 값 ${JSON.stringify(inl)}`).toBe('6px');
  console.log(`  U(상자 ${base.w}x${base.h}): base.run=${JSON.stringify(base.run)} thick6.run=${JSON.stringify(thick.run)}`);
  expect([thick.w, thick.h], '★전제 — 재는 사이에 창이 바뀌었다').toEqual([base.w, base.h]);
  expect(thick.wide, `★두께 6 을 줬는데 ★그려진 선이 ★안 두꺼워졌다 (${base.wide} → ${thick.wide}줄)`).toBeGreaterThan(base.wide);

  // ── U2 ★빈 값 = 자동으로 되돌린다 ──
  await typeField(page, '#txt-ul-thick', '');
  const inl2 = await page.evaluate((i) => document.getElementById(i).getAttribute('style') || '', id);
  expect(/--tb-ul-thick/.test(inl2), `★칸을 비웠는데 인라인이 ★남았다 — auto 로 안 돌아간다. 잰 값 ${inl2}`).toBe(false);
  const restored = await measure(page, sel);
  expect(restored.wide, `★칸을 비웠는데 ★두께가 ★안 돌아왔다 (${base.wide} → ${thick.wide} → ${restored.wide}줄)`).toBe(base.wide);

  // ── U3 ★위치 — 선이 ★내려간다 ──
  await typeField(page, '#txt-ul-offset', 5);
  const off = await measure(page, sel);
  const offInl = await page.evaluate((i) => document.getElementById(i).style.getPropertyValue('--tb-ul-offset').trim(), id);
  expect(offInl, `★위치 정본이 ★안 박혔다. 잰 값 ${JSON.stringify(offInl)}`).toBe('5px');
  expect([off.w, off.h], '★전제 — 재는 사이에 창이 바뀌었다(줄 번호를 못 견준다)').toEqual([base.w, base.h]);
  console.log(`  U3: base.run.start=${base.run.start} offset5.run.start=${off.run.start}`);
  expect(off.run.start - base.run.start, `★위치 5 를 줬는데 선이 ★안 내려갔다 (줄 ${base.run.start} → ${off.run.start})`).toBeGreaterThan(2);
  await typeField(page, '#txt-ul-offset', '');

  // ── U4 ⚠️취소선 동반 — ★같이 두꺼워진다. ⛔「밑줄만 바뀐다」가 아니다 ──
  await clickBtn(page, '#txt-strike-btn');
  const bothBase = await measure(page, sel);
  await typeField(page, '#txt-ul-thick', 6);
  const bothThick = await measure(page, sel);
  const got = await page.evaluate((i) => {
    const ce = document.getElementById(i).querySelector('.tb-body');
    return { line: ce.style.textDecorationLine, used: getComputedStyle(ce).textDecorationThickness };
  }, id);
  console.log(`  U4(밑줄＋취소선): line=${got.line} used=${got.used} base.run=${JSON.stringify(bothBase.run)} thick6.run=${JSON.stringify(bothThick.run)}`);
  expect(got.line, `★전제 — 둘이 같이 켜져 있지 않다. 잰 값 ${JSON.stringify(got.line)}`).toBe('underline line-through');
  expect(got.used, `⚠️★CSS 는 장식선 두께를 ★선별로 못 준다 — ★한 요소에 ★한 값이고 ★그 값이 ★둘 다에 걸린다. 잰 값 ${got.used}`).toBe('6px');
  expect(errs, `★페이지 오류: ${errs.join(' | ')}`).toEqual([]);
});
