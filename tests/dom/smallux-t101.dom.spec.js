/* smallux-t101.dom.spec.js — T-101 「작은 불편 셋」 중 ②③ (2026-09-21 사용자관점훑기 유닛 smallux)
 *
 *   ② 레이어 긴 이름이 …로 잘리는데 전체를 볼 길이 없다
 *   ③ 이미지 프리셋 단추에 «지금 어느 것이 적용됐는지» 표시가 없다
 *
 * ★①(빈 캔버스 안내)은 «여기 없다» — 2026-09-22 현빈 직접 지시로 기능째 철회됐다.
 *   ⛔결함이라 뺀 게 아니다. 구현은 정상 동작했다(「최초에 '아직비어있어요...' 이런건
 *     없어도 될거 같은데」). 기능이 사라졌으니 그 4건(①-T1~T4)도 같이 뺐다.
 *   ★★이 파일을 «통째로» 지울 뻔했다 — ① 4건 + ②③ 9건 = 13건이 한 파일에 있었는데,
 *     「지운 스펙의 test( 수」와 「DOM 총계가 준 수」가 13로 «딱 맞아» 안심해 버렸다.
 *     수가 맞은 까닭은 «13이 전부 ① 것이라서»가 아니라 «파일을 통째로 지워서»였다.
 *     ⇒ 참값이 맞아떨어지는 것은 «안을 안 봐도 된다»는 뜻이 아니다. 갈래가 섞인
 *       파일에서는 «총계»가 아니라 «갈래별 제목»을 세라. (작업목록매니저가 잡았다)
 *   ⇒ 철회 고침 = `fix/0922-drop-empty-hint`. 되살릴 근거는 그 커밋 메시지에 있다.
 *
 * ★둘 다 «실앱에서» 먼저 재현했다(포트 9550, 실측):
 *   ② 이름을 길게 바꾼 뒤 .layer-item-name clientWidth 120 < scrollWidth 222 = 잘림,
 *      그런데 그 span 과 조상 행 전부 title=null
 *   ③ Square 로 만든 블록에서 Tall 을 눌러 height 가 1032px 이 됐는데도
 *      ["Standard:-","Square:-","Tall:-","Wide:-","Logo:-","A4:-"] — 아무것도 안 켜짐
 *
 * ★왜 DOM 검사인가 — 둘 다 «레이아웃이 실제로 그려진 뒤»에만 답이 나온다.
 *   ②는 scrollWidth>clientWidth(진짜 잘렸나), ③은 calc() 폭을 offsetWidth 로 재는
 *   갈래 — 소스 문자열 검사로는 못 잰다.
 *
 * ⛔앱을 «안» 띄운다 — 레포 파일만 크로미움에 얹는다(qa0920b-asset-width-set 하네스 꼴).
 * 실행: npm run test:dom -- smallux-t101
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

function router(page, harness) {
  return page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html; charset=utf-8', body: harness });
    const file = path.join(REPO, decodeURIComponent(url.pathname));
    if (!file.startsWith(REPO) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
}

async function boot(page, harness) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await router(page, harness);
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

/* ═══════════════ ② 잘린 레이어 이름 ═══════════════ */

const HARNESS_LAYER = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-panels.css">
<style>html,body{margin:0} #layer-panel-body{width:180px}
  .layer-item{display:flex;align-items:center;gap:4px;width:180px}</style>
</head><body>
<div id="layer-panel-body">
  <div class="layer-section"><div class="layer-section-header" id="sec-hd"><span class="layer-section-name" id="sn-long">아주 아주 아주 길고 긴 섹션 이름입니다 가을 신상 컬렉션 메인 히어로 섹션</span></div></div>
  <div class="layer-section"><div class="layer-section-header" id="sec-hd2"><span class="layer-section-name" id="sn-short">Section 01</span></div></div>
  <div class="layer-item" id="row-long"><span class="layer-item-name" id="nm-long">상단 히어로 대표 이미지 — 가을 신상 컬렉션 메인컷</span><span class="layer-item-type">Asset</span></div>
  <div class="layer-item" id="row-short"><span class="layer-item-name" id="nm-short">Gap</span><span class="layer-item-type">Gap</span></div>
</div>
<script type="module">
  import { installLayerNameTooltips } from '/js/panels/layer-panel.js';
  window.__installTips = installLayerNameTooltips;
  window.__ready = true;
</script></body></html>`;

const clipInfo = (page, id) => page.evaluate((i) => {
  const el = document.getElementById(i);
  return { clipped: el.scrollWidth > el.clientWidth + 1, title: el.getAttribute('title') };
}, id);

test('②-T1 전제 — 긴 이름은 실제로 잘려 있다(짧은 이름은 안 잘린다)', async ({ page }) => {
  const errs = await boot(page, HARNESS_LAYER);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
  expect((await clipInfo(page, 'nm-long')).clipped).toBe(true);
  expect((await clipInfo(page, 'nm-short')).clipped).toBe(false);
});

test('②-T2 잘린 이름에 마우스를 올리면 «전체»가 이름표로 뜬다', async ({ page }) => {
  await boot(page, HARNESS_LAYER);
  expect((await clipInfo(page, 'nm-long')).title).toBe(null);   // 올리기 전엔 없다
  await page.hover('#nm-long');
  const full = await page.evaluate(() => document.getElementById('nm-long').textContent.trim());
  await expect.poll(async () => (await clipInfo(page, 'nm-long')).title, { timeout: 3000 }).toBe(full);
});

test('②-T3 안 잘린 이름엔 이름표를 «안» 붙인다(쓸데없이 뜨지 않게)', async ({ page }) => {
  await boot(page, HARNESS_LAYER);
  await page.hover('#nm-short');
  await page.waitForTimeout(150);
  expect((await clipInfo(page, 'nm-short')).title).toBe(null);
});

test('②-T4 «나중에 생긴» 행·«바뀐» 이름도 따라온다(손목록 없이)', async ({ page }) => {
  await boot(page, HARNESS_LAYER);
  /* buildLayerPanel 이 innerHTML 로 통째로 갈아치우는 상황을 그대로 재현한다. */
  await page.evaluate(() => {
    const p = document.getElementById('layer-panel-body');
    p.innerHTML = '<div class="layer-item" id="row-new"><span class="layer-item-name" id="nm-new">새로 만들어진 레이어의 아주 아주 긴 이름입니다</span></div>';
  });
  await page.hover('#nm-new');
  const full = await page.evaluate(() => document.getElementById('nm-new').textContent.trim());
  await expect.poll(async () => (await clipInfo(page, 'nm-new')).title, { timeout: 3000 }).toBe(full);

  /* 이름을 짧게 «바꾸면» 이름표도 없어져야 한다(낡은 이름표가 남으면 그것도 거짓말이다). */
  await page.evaluate(() => { document.getElementById('nm-new').textContent = 'A'; });
  /* ★진짜로 «나갔다 들어와야» mouseover 가 다시 난다 — 같은 점에 hover 를 또 부르면
     포인터가 움직이지 않아 이벤트가 없고, 검사가 스스로를 속인다. */
  await page.mouse.move(600, 500);
  await page.hover('#nm-new');
  await expect.poll(async () => (await clipInfo(page, 'nm-new')).title, { timeout: 3000 }).toBe(null);
});

test('②-T5 이름을 «고치는 중»(contenteditable)엔 이름표를 안 건다', async ({ page }) => {
  await boot(page, HARNESS_LAYER);
  await page.hover('#nm-long');
  await expect.poll(async () => (await clipInfo(page, 'nm-long')).title !== null, { timeout: 3000 }).toBe(true);
  await page.evaluate(() => {
    const el = document.getElementById('nm-long');
    el.contentEditable = 'true';
    el.classList.add('editing');
    window.syncLayerNameTooltip(el);
  });
  expect((await clipInfo(page, 'nm-long')).title).toBe(null);
});

/* ★아래 둘은 «절 머리(.layer-section-name)» 자리다 — 2026-09-22 실앱(9644)에서
     그 자리만 따로 잰 결과다. 위 ②-T1~T5 가 다 통과하는 동안에도 여기는 죽어 있었다:
       white-space 가 normal 이라 이름이 «잘리는» 대신 «흘러서», 같은 이름에
       clientHeight 가 13 → 26 → 39 로 늘고 헤더(28px)를 11px 넘겼다.
       그리고 scrollWidth == clientWidth(185==185) 라 syncLayerNameTooltip 의
       잘림 판정이 영영 거짓 ⇒ '.layer-section-name' 은 셀렉터에만 있고 한 번도 안 탔다.
   ⛔「말줄임표가 붙었다」만 재면 아무것도 안 잠근다 — T7 이 «hover 해서 전체가 뜨는가»를
     잰다. 잘려도 볼 길이 없으면 ② 는 안 고쳐진 것이다. */

const clipInfo2 = (page, id) => page.evaluate((i) => {
  const el = document.getElementById(i);
  const cs = getComputedStyle(el);
  return {
    clippedX: el.scrollWidth > el.clientWidth + 1,
    clientH: el.clientHeight,
    title: el.getAttribute('title'),
    ws: cs.whiteSpace,
    headerH: el.closest('.layer-section-header').offsetHeight,
    spillPx: Math.round(el.getBoundingClientRect().bottom - el.closest('.layer-section-header').getBoundingClientRect().bottom),
  };
}, id);

test('②-T6 긴 «절 머리» 이름은 흘러 넘치지 않고 «잘린다»(행 높이가 안 늘어난다)', async ({ page }) => {
  await boot(page, HARNESS_LAYER);
  const long = await clipInfo2(page, 'sn-long');
  const short = await clipInfo2(page, 'sn-short');
  /* 한 줄 높이는 «짧은 이름»이 정한다 — 폰트가 바뀌어도 따라오게 상수를 안 박는다. */
  expect(long.clientH, `긴 이름이 ${long.clientH}px 로 흘렀다(한 줄=${short.clientH}px)`).toBe(short.clientH);
  expect(long.spillPx, '이름이 절 머리 아래로 삐져나왔다').toBeLessThanOrEqual(0);
  expect(long.headerH).toBe(short.headerH);
  expect(long.clippedX, '가로로 잘려 있어야 이름표를 걸 수 있다').toBe(true);
  expect(short.clippedX).toBe(false);
});

test('②-T7 잘린 «절 머리» 이름에 마우스를 올리면 «전체»가 이름표로 뜬다', async ({ page }) => {
  await boot(page, HARNESS_LAYER);
  expect((await clipInfo2(page, 'sn-long')).title).toBe(null);   // 올리기 전엔 없다
  await page.hover('#sn-long');
  const full = await page.evaluate(() => document.getElementById('sn-long').textContent.trim());
  await expect.poll(async () => (await clipInfo2(page, 'sn-long')).title, { timeout: 3000 }).toBe(full);
  /* 안 잘린 절 머리엔 안 붙는다 — 쓸데없이 뜨지 않게. */
  await page.mouse.move(600, 500);
  await page.hover('#sn-short');
  await page.waitForTimeout(150);
  expect((await clipInfo2(page, 'sn-short')).title).toBe(null);
});

/* ═══════════════ ③ 이미지 프리셋 현재값 표시 ═══════════════ */

const HARNESS_ASSET = `<!doctype html><html><head><meta charset="utf-8">
<style>*{box-sizing:border-box}body{margin:0}
  .section-block{position:relative;width:860px}
  .section-inner{position:relative;padding:0 72px}</style>
</head><body>
<div id="canvas">
  <div class="section-block" id="sec1"><div class="section-inner" id="inner1" data-padding-x="72">
    <div class="asset-block" id="ab1" data-use-padx="true" style="width:calc(100% + 144px);height:860px;margin-left:-72px;margin-right:-72px;"></div>
  </div></div>
</div>
<div id="panel-right"><div class="panel-body"></div></div>
<div id="canvas-wrap"></div>
<script>
  window.currentZoom = 100;
  window.pushHistory = () => {};
  window.scheduleAutoSave = () => {};
  window.triggerAutoSave = () => {};
  window.buildLayerPanel = () => {};
  window.getBlockBreadcrumb = () => 'Section 1';
  window.getEffectiveUsePadx = (ab) => ab.dataset.usePadx !== 'false';
</script>
<script type="module">
  import { showAssetProperties } from '/js/props/prop-asset.js';
  window.__openAsset = showAssetProperties;
  window.__ready = true;
</script></body></html>`;

const presetState = (page) => page.evaluate(() => {
  const ab = document.getElementById('ab1');
  return {
    h: ab.style.height,
    offsetW: ab.offsetWidth,
    btns: [...document.querySelectorAll('.prop-preset-btn')]
      .map(b => `${b.textContent.trim()}:${b.classList.contains('active') ? 'ACTIVE' : '-'}`),
    activeCount: [...document.querySelectorAll('.prop-preset-btn.active')].length,
  };
});

test('③-T1 패널을 열면 «지금 값»에 해당하는 단추 하나만 켜져 있다', async ({ page }) => {
  const errs = await boot(page, HARNESS_ASSET);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
  await page.evaluate(() => window.__openAsset(document.getElementById('ab1')));
  const s = await presetState(page);
  expect(s.offsetW).toBe(860);
  expect(s.activeCount).toBe(1);
  expect(s.btns).toContain('Square:ACTIVE');
});

test('③-T2 프리셋을 누르면 표시가 «그 단추»로 옮겨간다', async ({ page }) => {
  await boot(page, HARNESS_ASSET);
  await page.evaluate(() => window.__openAsset(document.getElementById('ab1')));
  await page.evaluate(() => {
    [...document.querySelectorAll('.prop-preset-btn')].find(b => b.textContent.trim() === 'Tall').click();
  });
  await expect.poll(async () => (await presetState(page)).btns, { timeout: 3000 }).toContain('Tall:ACTIVE');
  expect((await presetState(page)).activeCount).toBe(1);
});

test('③-T3 ★크기를 «다른 길로» 바꾸면 표시가 꺼진다 — 거짓말을 안 한다', async ({ page }) => {
  await boot(page, HARNESS_ASSET);
  await page.evaluate(() => window.__openAsset(document.getElementById('ab1')));
  expect((await presetState(page)).activeCount).toBe(1);
  /* 프리셋 단추를 거치지 않고 블록 높이만 바꾼다(슬라이더·핸들·undo 가 하는 일). */
  await page.evaluate(() => { document.getElementById('ab1').style.height = '700px'; });
  await expect.poll(async () => (await presetState(page)).activeCount, { timeout: 3000 }).toBe(0);
});

test('③-T4 「패딩 제외」가 꺼져 폭이 줄어든 블록에서도 같은 프리셋이 켜진다', async ({ page }) => {
  await boot(page, HARNESS_ASSET);
  /* 패딩 포함 모드의 Standard: 폭 716(=860-2·72), 높이 round(780·716/860)=650. */
  await page.evaluate(() => {
    const ab = document.getElementById('ab1');
    ab.dataset.usePadx = 'false';
    ab.style.width = '';
    ab.style.marginLeft = '';
    ab.style.marginRight = '';
    ab.style.height = '650px';
    window.__openAsset(ab);
  });
  const s = await presetState(page);
  expect(s.offsetW).toBe(716);
  expect(s.btns).toContain('Standard:ACTIVE');
  expect(s.activeCount).toBe(1);
});


/* ═══════════════ ③-b 「지금 값」이 «눈에» 남는가(명시도) ═══════════════ */

/* ★위 ③-T1~T4 는 «active 클래스가 옳은 단추에 붙는가»만 잰다 — 그건 prop-asset.js 의 몫이고
     실제로 옳게 붙고 있었다. 그런데 2026-09-22 실앱(9644)에서 computed 를 재 보니
     active 단추와 idle 단추의 background 가 «둘 다 rgb(42,42,42)» 로 같았다 —
     css/editor-props.css 의 `.prop-preset-btn.active { background:#1a2a3a }` 가
     `.prop-type-group:has(.prop-preset-btn) .prop-preset-btn.prop-type-btn`(0,5,0) 에
     덮여 한 번도 안 그려진 것이다(active 규칙은 0,2,0). 살아남은 표시는 1px 테두리 색뿐이었다.
   ⇒ 「클래스가 붙었다」와 「표시가 남았다」는 «다른 축»이다. 클래스만 재는 검사는
     CSS 가 죽어도 초록이다 — 그 자리를 여기서 잠근다. 그래서 이 하네스는 진짜 CSS 를 «불러온다».
   ⛔여기서 prop-asset.js 를 안 부른다 — 재는 것이 «CSS 명시도»라 JS 가 끼면 무엇이
     이겼는지 흐려진다. 마크업은 prop-asset.js 가 찍는 것과 같은 꼴로 손으로 쓴다
     (.prop-type-group > button.prop-preset-btn.prop-type-btn — 2026-09-22 실앱 조상 체인 실측). */
const HARNESS_PRESET_CSS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-props.css">
</head><body>
<div class="prop-section"><div class="prop-type-group">
  <button class="prop-preset-btn prop-type-btn active" id="pb-on" data-w="860" data-h="780">Standard</button>
  <button class="prop-preset-btn prop-type-btn" id="pb-off" data-w="860" data-h="860">Square</button>
</div></div>
<script>window.__ready = true;</script></body></html>`;

const btnPaint = (page, id) => page.evaluate((i) => {
  const s = getComputedStyle(document.getElementById(i));
  return { bg: s.backgroundColor, border: s.borderTopColor };
}, id);

test('③-T5 켜진 단추는 «배경»으로도 구분된다 — active 가 명시도에 먹혀 죽지 않는다', async ({ page }) => {
  await boot(page, HARNESS_PRESET_CSS);
  const on = await btnPaint(page, 'pb-on');
  const off = await btnPaint(page, 'pb-off');
  /* 색값을 박지 않는다 — 테마가 바뀌어도 「구분되는가」는 그대로여야 한다. */
  expect(on.bg, `켜진 단추와 꺼진 단추의 배경이 같다(${on.bg}) — active 가 덮였다`).not.toBe(off.bg);
  /* 투명으로 «구분»되는 것은 구분이 아니다 — 둘 다 실제로 칠해져 있어야 한다. */
  expect(on.bg).not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
  expect(off.bg).not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
});

test('③-T6 테두리 표시도 같이 남아 있다(배경만 고치다 테두리를 잃지 않게)', async ({ page }) => {
  await boot(page, HARNESS_PRESET_CSS);
  const on = await btnPaint(page, 'pb-on');
  const off = await btnPaint(page, 'pb-off');
  expect(on.border, `켜진/꺼진 테두리 색이 같다(${on.border})`).not.toBe(off.border);
});

/* ═══════════════ ③-b2 1017t1a2+a3 — «떨어뜨린 프리셋 그룹»의 왼쪽 테두리가 ★다른 색으로 샌다 ═══════════════
 * ★2026-09-09 가 ★page-grid-col-presets(칼럼 12) ★하나만 ★반쪽으로 고쳤다(border-left-color 를 안 적어
 *   currentcolor(#969696)로 남았다) ⇒ ★같은 꼴(.prop-type-btn ★+ .prop-preset-btn, ★gap 으로 떨어진 그룹)인
 *   prop-asset Preset(6개) · prop-graph Chart Type(5개)에도 ★같은 병이 있었다(치료가 ★없어 0px none 이었다).
 * ★마크업은 ★실물(prop-page.js:419-421 · prop-asset.js:220-225 · prop-graph.js:415-417+:110-116)에서 ★그대로 떠 온다.
 * ⛔JS 는 ★안 부른다(★위 ③-T5/T6 머리말의 그 까닭 그대로) — ★재는 것은 ★CSS 명시도다. */
const HARNESS_PRESET_CSS2 = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-props.css">
</head><body>
<div class="prop-section">
  <!-- prop-page.js:418-421 — 칼럼 프리셋 2개(12 는 disabled 로 뜬다) -->
  <div class="prop-type-group" id="page-grid-col-presets">
    <button class="prop-preset-btn prop-type-btn" id="g6" data-cols="6">6</button>
    <button class="prop-preset-btn prop-type-btn" id="g12" data-cols="12" disabled>12</button>
  </div>
  <!-- prop-asset.js:220-225 — Preset 6개 -->
  <div class="prop-type-group">
    <button class="prop-preset-btn prop-type-btn" id="a1">Standard</button>
    <button class="prop-preset-btn prop-type-btn" id="a2">Square</button>
    <button class="prop-preset-btn prop-type-btn active" id="a3">Tall</button>
    <button class="prop-preset-btn prop-type-btn" id="a4">Wide</button>
    <button class="prop-preset-btn prop-type-btn" id="a5">Logo</button>
    <button class="prop-preset-btn prop-type-btn" id="a6">A4</button>
  </div>
  <!-- prop-graph.js:415-417 ＋ GRAPH_TYPES(:110-116) — Chart Type 5개 -->
  <div class="prop-type-group">
    <button class="prop-preset-btn prop-type-btn active" id="c1">세로 막대</button>
    <button class="prop-preset-btn prop-type-btn" id="c2">가로 막대</button>
    <button class="prop-preset-btn prop-type-btn" id="c3">꺾은선</button>
    <button class="prop-preset-btn prop-type-btn" id="c4">비교 막대</button>
    <button class="prop-preset-btn prop-type-btn" id="c5">원형</button>
  </div>
  <!-- ★음성대조 ⑴ — 진짜 이어붙은 세그먼트(.prop-preset-btn 이 ★없다). prop-quote.js:213-215 「한 줄/스택」과 같은 꼴 -->
  <div class="prop-type-group">
    <button class="prop-type-btn active" id="s1">한 줄</button>
    <button class="prop-type-btn" id="s2">스택</button>
  </div>
</div>
<script>window.__ready = true;</script></body></html>`;

const GROUPS2 = {
  page: ['g6', 'g12'],
  asset: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'],
  graph: ['c1', 'c2', 'c3', 'c4', 'c5'],
};

const borderOf = (page, id) => page.evaluate((i) => {
  const s = getComputedStyle(document.getElementById(i));
  return { top: s.borderTopColor, left: s.borderLeftColor, lw: s.borderLeftWidth, ls: s.borderLeftStyle, br: s.borderTopLeftRadius };
}, id);

test('③-T7 떨어뜨린 프리셋 그룹(칼럼·Preset·Chart Type) — 네 변이 같은 색 1px 테두리다', async ({ page }) => {
  await boot(page, HARNESS_PRESET_CSS2);
  /* ★전제 — 세 그룹 다 «떨어뜨린» 그룹이다(gap>0). ⛔붙은 그룹에 이 자를 대면 틀린다. */
  for (const [name, ids] of Object.entries(GROUPS2)) {
    const gap = await page.evaluate((i) => getComputedStyle(document.getElementById(i).parentElement).gap, ids[0]);
    expect(parseFloat(gap), `★전제 — ${name} 그룹이 ★떨어진 그룹이 아니다(gap=${gap})`).toBeGreaterThan(0);
  }
  const all = [].concat(...Object.values(GROUPS2));
  const rows = [];
  for (const id of all) rows.push({ id, ...(await borderOf(page, id)) });
  for (const r of rows) {
    expect(r.ls, `★${r.id} 의 border-left-style 이 none 이다 — 왼쪽 테두리가 없다. 잰 값 ${JSON.stringify(r)}`).not.toBe('none');
    expect(parseFloat(r.lw), `★${r.id} 의 border-left-width 가 0 이다. 잰 값 ${JSON.stringify(r)}`).toBeGreaterThan(0);
    expect(r.left, `★${r.id} 의 왼쪽 테두리 색이 위쪽과 다르다(left=${r.left} top=${r.top}) — 왼쪽만 어긋나 보인다. 잰 값 ${JSON.stringify(r)}`).toBe(r.top);
  }
});

test('③-T7-음성 ⑴ 진짜 세그먼트(프리셋 아님)는 ★그대로 border-left:none 이다', async ({ page }) => {
  await boot(page, HARNESS_PRESET_CSS2);
  const s2 = await borderOf(page, 's2');
  expect(s2.ls, `★s2(진짜 세그먼트 가운데/끝)가 border-left:none 을 잃었다 — 공용 규칙을 통째로 걷은 것이다. 잰 값 ${JSON.stringify(s2)}`).toBe('none');
  const s1 = await borderOf(page, 's1');
  expect(s1.left, `★s1(첫째)의 왼쪽 테두리까지 none 이면 안 된다. 잰 값 ${JSON.stringify(s1)}`).not.toBe('rgba(0, 0, 0, 0)');
});

test('③-T7-음성 ⑵ .active 단추는 ★네 변이 같이 accent 색이다(왼쪽만 회색으로 때우지 않는다)', async ({ page }) => {
  await boot(page, HARNESS_PRESET_CSS2);
  const a3 = await borderOf(page, 'a3');   // active
  const a1 = await borderOf(page, 'a1');   // idle
  expect(a3.left, `★active(a3) 의 왼쪽이 위쪽과 다른 색이다. 잰 값 ${JSON.stringify(a3)}`).toBe(a3.top);
  expect(a3.left, `★active 의 왼쪽이 ★idle 의 회색(--ui-border #333)으로 때워졌다. 잰 값 ${JSON.stringify(a3)}`).not.toBe('rgb(51, 51, 51)');
  expect(a3.left, `★active 와 idle 의 왼쪽 테두리 색이 같다 — active 가 ★안 켜졌다`).not.toBe(a1.left);
});

test('③-T7-음성 ⑶ border-radius 는 ★고치기 전후 동일(4px) — 모서리를 바꾸지 않았다', async ({ page }) => {
  await boot(page, HARNESS_PRESET_CSS2);
  const all = [].concat(...Object.values(GROUPS2));
  for (const id of all) {
    const r = await borderOf(page, id);
    expect(r.br, `★${id} 의 border-radius 가 4px 가 아니다(${r.br}) — 모서리가 바뀌었다`).toBe('4px');
  }
});

test('③-T8 ★무력화 대조 — :not(.prop-preset-btn) 을 빼면 세 그룹이 전부 빨개지고, 음성대조는 초록이다', async ({ page }) => {
  const css = fs.readFileSync(path.join(REPO, 'css', 'editor-props.css'), 'utf8');
  const broken = css.replace(
    /\.prop-type-btn:not\(\.prop-preset-btn\):first-child \{ border-radius: var\(--ui-radius-sm\) 0 0 var\(--ui-radius-sm\); \}\n\.prop-type-btn:not\(\.prop-preset-btn\):not\(:first-child\):not\(:last-child\) \{ border-radius: 0; border-left: none; \}\n\.prop-type-btn:not\(\.prop-preset-btn\):last-child \{ border-radius: 0 var\(--ui-radius-sm\) var\(--ui-radius-sm\) 0; border-left: none; \}/,
    '.prop-type-btn:first-child { border-radius: 4px 0 0 4px; }\n'
    + '.prop-type-btn:not(:first-child):not(:last-child) { border-radius: 0; border-left: none; }\n'
    + '.prop-type-btn:last-child { border-radius: 0 4px 4px 0; border-left: none; }',
  );
  expect(broken, '★무력화 전제 — 치환 대상을 못 찾았다(정규식이 소스와 어긋났다)').not.toBe(css);
  const base = fs.readFileSync(path.join(REPO, 'css', 'editor-base.css'), 'utf8');
  const harness = HARNESS_PRESET_CSS2.replace(
    '<link rel="stylesheet" href="/css/editor-base.css">\n<link rel="stylesheet" href="/css/editor-props.css">',
    `<style>${base}\n${broken}</style>`,
  );
  await boot(page, harness);
  let redCount = 0;
  for (const [name, ids] of Object.entries(GROUPS2)) {
    const r = await borderOf(page, ids[ids.length - 1]);  // 각 그룹 마지막 단추(:last-child 가 가장 먼저 걸린다)
    if (r.ls === 'none' || r.left !== r.top) redCount++;
    else throw new Error(`★무력화했는데 ${name} 그룹이 ★여전히 초록이다 — ③-T7 이 공용 본문을 안 잰다. 잰 값 ${JSON.stringify(r)}`);
  }
  expect(redCount, '★무력화 ⇒ 세 그룹(칼럼·Preset·Chart Type) 전부 빨개져야 한다').toBe(3);
  /* ★음성대조는 ★여전히 초록 — 무력화가 공용 .prop-type-btn 규칙은 안 건드렸다(:not() 만 뺐다) */
  const s2 = await borderOf(page, 's2');
  expect(s2.ls, '★무력화해도 진짜 세그먼트(s2)는 여전히 border-left:none 이어야 한다').toBe('none');
});
