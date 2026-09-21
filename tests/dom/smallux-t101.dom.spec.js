/* smallux-t101.dom.spec.js — T-101 「작은 불편 셋」 (2026-09-21 사용자관점훑기 유닛 smallux)
 *
 *   ① 새 디자인을 누르면 회색 화면만 나오고 무엇을 먼저 할지 안내가 없다
 *   ② 레이어 긴 이름이 …로 잘리는데 전체를 볼 길이 없다
 *   ③ 이미지 프리셋 단추에 «지금 어느 것이 적용됐는지» 표시가 없다
 *
 * ★셋 다 «실앱에서» 먼저 재현했다(포트 9550, 실측):
 *   ① New Design 직후 #canvas.children.length=0 · innerText='' (화면에 글자 0자)
 *   ② 이름을 길게 바꾼 뒤 .layer-item-name clientWidth 120 < scrollWidth 222 = 잘림,
 *      그런데 그 span 과 조상 행 전부 title=null
 *   ③ Square 로 만든 블록에서 Tall 을 눌러 height 가 1032px 이 됐는데도
 *      ["Standard:-","Square:-","Tall:-","Wide:-","Logo:-","A4:-"] — 아무것도 안 켜짐
 *
 * ★왜 DOM 검사인가 — 셋 다 «레이아웃이 실제로 그려진 뒤»에만 답이 나온다.
 *   ②는 scrollWidth>clientWidth(진짜 잘렸나), ①은 [hidden] 이 display:flex 를 이기나,
 *   ③은 calc() 폭을 offsetWidth 로 재는 갈래 — 소스 문자열 검사로는 못 잰다.
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

/* ═══════════════ ① 빈 캔버스 안내 ═══════════════ */

const HARNESS_HINT = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-canvas.css">
<style>html,body{margin:0;height:600px} #canvas-area{height:600px}</style>
</head><body>
<div id="canvas-area"><div id="canvas-wrap"><div id="canvas-scaler"><div id="canvas"></div></div></div></div>
<script type="module">
  import { installCanvasEmptyHint, syncCanvasEmptyHint } from '/js/canvas-empty-hint.js';
  window.__install = installCanvasEmptyHint;
  window.__sync = syncCanvasEmptyHint;
  window.__ready = true;
</script></body></html>`;

const hintState = (page) => page.evaluate(() => {
  const h = document.getElementById('canvas-empty-hint');
  if (!h) return { exists: false };
  const cs = getComputedStyle(h);
  const r = h.getBoundingClientRect();
  return {
    exists: true,
    hidden: h.hidden,
    display: cs.display,
    pointerEvents: cs.pointerEvents,
    visibleArea: Math.round(r.width) * Math.round(r.height),
    text: (h.innerText || '').replace(/\s+/g, ' ').trim(),
    insideCanvas: !!h.closest('#canvas'),
  };
});

const addSection = (page) => page.evaluate(() => {
  const s = document.createElement('div');
  s.className = 'section-block';
  document.getElementById('canvas').appendChild(s);
  return document.querySelectorAll('#canvas .section-block').length;
});

test('①-T1 섹션 0개면 안내가 «보인다»(글자까지 실제로 그려진다)', async ({ page }) => {
  const errs = await boot(page, HARNESS_HINT);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
  const s = await hintState(page);
  expect(s.exists).toBe(true);
  expect(s.hidden).toBe(false);
  expect(s.display).not.toBe('none');
  expect(s.visibleArea).toBeGreaterThan(1000);   // 0×0 유령이 아니다
  expect(s.text.length).toBeGreaterThan(10);
  expect(s.text).toContain('섹션');
});

test('①-T2 섹션이 생기면 «손으로 부르지 않아도» 사라지고, 다시 0이 되면 돌아온다', async ({ page }) => {
  await boot(page, HARNESS_HINT);
  expect((await hintState(page)).hidden).toBe(false);

  const n = await addSection(page);
  expect(n).toBe(1);
  /* ★__sync 를 부르지 않는다 — MutationObserver 가 스스로 따라오는지를 재는 자리다. */
  await expect.poll(async () => (await hintState(page)).hidden, { timeout: 3000 }).toBe(true);
  expect((await hintState(page)).display).toBe('none');   // [hidden] 이 display:flex 를 이긴다

  await page.evaluate(() => document.querySelector('#canvas .section-block').remove());
  await expect.poll(async () => (await hintState(page)).hidden, { timeout: 3000 }).toBe(false);
});

test('①-T3 안내는 «클릭을 가로채지 않고» 내보내기 나무(#canvas) 밖에 있다', async ({ page }) => {
  await boot(page, HARNESS_HINT);
  const s = await hintState(page);
  expect(s.pointerEvents).toBe('none');
  expect(s.insideCanvas).toBe(false);
  /* 힌트 한가운데를 찍으면 힌트가 아니라 그 아래가 잡혀야 한다. */
  const hitId = await page.evaluate(() => {
    const r = document.getElementById('canvas-empty-hint').getBoundingClientRect();
    const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return el ? el.id : null;
  });
  expect(hitId).not.toBe('canvas-empty-hint');
});

test('①-T4 유령 섹션(data-ghost)은 «있는 것»으로 세지 않는다', async ({ page }) => {
  await boot(page, HARNESS_HINT);
  await page.evaluate(() => {
    const s = document.createElement('div');
    s.className = 'section-block';
    s.setAttribute('data-ghost', '1');
    document.getElementById('canvas').appendChild(s);
  });
  await page.waitForTimeout(150);
  expect((await hintState(page)).hidden).toBe(false);
});

/* ═══════════════ ② 잘린 레이어 이름 ═══════════════ */

const HARNESS_LAYER = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-panels.css">
<style>html,body{margin:0} #layer-panel-body{width:180px}
  .layer-item{display:flex;align-items:center;gap:4px;width:180px}</style>
</head><body>
<div id="layer-panel-body">
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
