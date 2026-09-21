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

