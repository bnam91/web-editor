/* asset-bg-api-reset.dom.spec.js — T-011 곁가지: 「도구(API)로는 아직 되돌릴 수 없다」.
 *
 * ★무엇이 병인가 (2026-09-22 실측)
 *   패널 축은 닫혔다(asset-image-bg-reach.dom.spec.js). 그런데 «같은 고장»이 API 쪽에 남아 있다.
 *   js/block-factory.js 의 updateAssetBlock 은 스스로 이렇게 약속한다(:2555 · :2720):
 *       - 배경: bgColor("" reset; hex/rgb/rgba/hsl/transparent 허용)
 *   그런데 reset 가지(:2722~)는 dataset.bgColor 를 지우고 style.backgroundColor 만 비운다.
 *   ⇒ 그라데이션은 style.background(단축 속성)에 실려 있어 «그대로 남아 계속 칠해진다».
 *     도구는 ok:true 와 applied.bgColor:'' 를 돌려준다 — 즉 «되돌렸다고 말하면서 안 되돌린다».
 *   같은 비대칭이 «솔리드로 덮어쓰기»에도 있다: backgroundColor 만 쓰면 위에 깔린 그라데이션이
 *   계속 이겨서 화면이 한 픽셀도 안 바뀐다. 패널 쪽 onApply 는 이미 이걸 알고
 *   `ab.style.background = ''` 를 «먼저» 한다(prop-asset.js, prop-frame.js ss-bg 와 같은 패턴).
 *
 * ★재는 방식 = «약속»이 아니라 «화면»
 *   ok:true 나 applied 값을 세지 않는다 — 그건 도구가 자기 입으로 하는 말이다(거짓 통과의 단골).
 *   getComputedStyle 로 «실제로 무엇이 칠해져 있는가»를 잰다.
 *   ⛔B0 양성대조가 초록이어야 아래 빨강이 「계측기가 그라데이션을 못 본다」가 아님이 증명된다.
 *
 * ★하네스가 «직접 만든» 상태로 재지 않는다
 *   - 블럭   = js/block-factory.js 의 makeAssetBlock()
 *   - 그라데이션 = 진짜 컬러피커 팝오버의 「그라데이션」 탭 클릭(실제 사용자 경로)
 *   - 초기화 = window.updateAssetBlock — MCP update_asset_block 이 실제로 부르는 그 함수(:4766)
 *
 * ⛔앱을 «안» 띄운다 — 레포 파일만 크로미움에 얹는다.
 * 실행: npm run test:dom -- asset-bg-api-reset
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

const USER_HEX = 'FF3B30';
const USER_RGB = 'rgb(255, 59, 48)';

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-blocks.css">
<link rel="stylesheet" href="/css/color-picker.css">
<style>
  body{margin:0;background:#1b1b1b}
  /* 실앱과 같은 우측 패널 — ⛔흐름에 두면 패널 높이가 캔버스 좌표를 밀어 엉뚱한 빨강이 난다
     (scratch-drop-export-width 가 실제로 그렇게 깨졌다, 2026-09-22). */
  #panel-right{position:fixed;right:0;top:0;width:240px;height:100%;overflow:auto;background:#252525}
  #panel-right .panel-body{padding:8px}
</style></head><body>
<div id="canvas-wrap"><div id="canvas">
  <div class="section-block"><div class="section-inner" id="host" style="width:860px;"></div></div>
</div></div>
<div id="panel-right"><div class="panel-body"></div></div>
<script type="module">
  window.__hist = 0;
  window.pushHistory = () => { window.__hist++; };
  window.bindBlock = () => {};
  window.buildLayerPanel = () => {};
  window.scheduleAutoSave = () => {};
  window.triggerAutoSave = () => {};
  window.getBlockBreadcrumb = () => 'Section > Row';
  window.getEffectiveUsePadx = (ab) => ab.dataset.usePadx === 'true';
  window.state = { pageSettings: { padX: 32 } };

  const bf = await import('/js/block-factory.js');
  await import('/js/image-handling.js');
  const pa = await import('/js/props/prop-asset.js');
  await import('/js/props/color-picker.js');

  window.__mk = () => {
    const host = document.getElementById('host');
    host.innerHTML = '';
    const { row, block } = bf.makeAssetBlock();
    block.id = 'ab_api';                 // updateAssetBlock 은 blockId 로 찾는다
    block.style.width = '400px';
    block.style.height = '300px';
    host.appendChild(row);
    window.__ab = block;
    return block;
  };
  window.__open = (ab) => pa.showAssetProperties(ab);
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
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 20000 });
  return errs;
}

/** 블럭이 «지금 무엇을 칠하고 있는가» — 도구의 말이 아니라 화면. */
const paint = (page) => page.evaluate(() => {
  const ab = window.__ab;
  const cs = getComputedStyle(ab);
  return {
    dataBg: ab.dataset.bgColor === undefined ? '(undefined)' : ab.dataset.bgColor,
    inlineBackground: ab.style.background,
    /* ★★style.background(단축)는 «믿을 수 없다» — 실측 2026-09-22:
         그라데이션을 단축으로 쓴 뒤 backgroundColor 만 ''로 지우면 단축이 직렬화되지 못해
         style.background 가 «빈 문자열»로 읽힌다. 그런데 background-image 는 살아서 계속 칠해진다.
       ⇒ 「style.background 가 ''이니 지워졌다」로 읽으면 거짓 초록이다. 긴 이름(longhand)으로 잰다. */
    inlineBgImage: ab.style.backgroundImage,
    inlineBgColor: ab.style.backgroundColor,
    computedImage: cs.backgroundImage,
    computedColor: cs.backgroundColor,
  };
});

async function openBgPicker(page) {
  const pos = await page.evaluate(() => {
    const body = document.querySelector('#panel-right .panel-body');
    const sec = [...body.querySelectorAll('.prop-section')].find(s => /배경/.test(s.innerText));
    const sw = sec && sec.querySelector('.prop-color-swatch');
    if (!sw) return null;
    const r = sw.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return null;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  if (!pos) return false;
  await page.mouse.click(pos.x, pos.y);
  await page.waitForFunction(() => { const p = document.querySelector('.goya-cp-popover'); return p && !p.hidden; }, null, { timeout: 4000 });
  return true;
}

/** 진짜 사용자 경로로 그라데이션을 얹는다 — 하네스가 style 을 직접 쓰지 않는다. */
async function seedGradient(page) {
  expect(await openBgPicker(page), '전제: 배경 스와치를 누를 수 있어야 한다').toBe(true);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);
  await page.evaluate((h) => {
    const body = document.querySelector('#panel-right .panel-body');
    const sec = [...body.querySelectorAll('.prop-section')].find(s => /배경/.test(s.innerText));
    const inp = sec.querySelector('.prop-color-hex');
    inp.value = h;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
  }, USER_HEX);
  await openBgPicker(page);
  await page.click('.goya-cp-popover .goya-cp-tab[data-tab="gradient"]');
  await page.waitForTimeout(250);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
}

/** MCP update_asset_block 이 실제로 부르는 그 함수(window.updateAssetBlock, block-factory.js:4766). */
const api = (page, partial) => page.evaluate((p) => window.updateAssetBlock('ab_api', p), partial);

test.describe('T-011 곁가지 — 도구(update_asset_block)의 bgColor "" reset 이 그라데이션도 지우는가', () => {
  let pageErrs;
  test.beforeEach(async ({ page }) => {
    pageErrs = await boot(page);
    await page.evaluate(() => { window.__open(window.__mk()); });
  });

  test('B0 ★양성대조 — 계측기가 그라데이션을 «본다» (이게 빨강이면 아래는 전부 무의미)', async ({ page }) => {
    await seedGradient(page);
    const p = await paint(page);
    expect(p.dataBg, `전제: 진짜 피커로 그라데이션이 걸렸다 — 실제 «${p.dataBg}»`).toMatch(/gradient\s*\(/i);
    expect(p.computedImage, '전제: 그리고 실제로 칠해진다').toMatch(/gradient/i);
    expect(p.computedImage, '전제: 칠해진 것이 내가 고른 색이다').toContain(USER_RGB);
    expect(pageErrs).toEqual([]);
  });

  test('B1 ★본검사 — bgColor:"" 는 «reset» 이라 했으니 그라데이션도 0 이 되어야 한다', async ({ page }) => {
    await seedGradient(page);
    const r = await api(page, { bgColor: '' });
    expect(r.ok, `도구가 실패했으면 이 검사의 빨강은 뜻이 없다 — ${JSON.stringify(r)}`).toBe(true);

    const p = await paint(page);
    /* ⛔ok:true·applied 를 «되돌려졌다»로 읽지 않는다 — 화면을 본다. */
    expect(p.computedImage,
      `도구가 reset 했다는데 화면엔 그라데이션이 그대로다 — computed «${p.computedImage}», inline style.background «${p.inlineBackground}»`)
      .toBe('none');
    expect(p.inlineBgImage,
      `인라인 background-image 가 남아 있다 — «${p.inlineBgImage}». ⛔style.background(단축)는 이 상태에서 ''로 읽히니 그걸로 재지 마라`)
      .toBe('');
    expect(p.dataBg, 'reset 인데 dataset.bgColor 가 남았다').toBe('(undefined)');
  });

  test('B2 ★같은 비대칭 — 그라데이션 위에 솔리드를 쓰면 그 솔리드가 실제로 보여야 한다', async ({ page }) => {
    await seedGradient(page);
    const r = await api(page, { bgColor: '#00FF00' });
    expect(r.ok, `도구 실패 — ${JSON.stringify(r)}`).toBe(true);

    const p = await paint(page);
    expect(p.computedColor, '요청한 솔리드가 backgroundColor 에 실려야 한다').toBe('rgb(0, 255, 0)');
    expect(p.computedImage,
      `솔리드를 썼는데 옛 그라데이션이 위에 남아 화면이 안 바뀐다 — computed «${p.computedImage}»`)
      .toBe('none');
  });

  test('B3 ★음성대조/회귀 — 그라데이션이 «없던» 블럭의 reset 은 예전 그대로다', async ({ page }) => {
    const set = await api(page, { bgColor: '#123456' });
    expect(set.ok).toBe(true);
    const mid = await paint(page);
    expect(mid.computedColor, '솔리드가 먼저 실린다').toBe('rgb(18, 52, 86)');
    expect(mid.dataBg).toBe('#123456');

    const r = await api(page, { bgColor: '' });
    expect(r.ok).toBe(true);
    expect(r.applied.bgColor, '도구가 reset 을 적용했다고 보고한다').toBe('');
    const p = await paint(page);
    expect(p.dataBg, 'reset 뒤 dataset.bgColor 가 사라진다').toBe('(undefined)');
    expect(p.inlineBgColor, 'reset 뒤 인라인 배경색이 비워진다').toBe('');
    expect(p.computedImage, '원래도 그라데이션은 없었다').toBe('none');
    expect(pageErrs).toEqual([]);
  });

  test('B4 ★UI 축과 갈리지 않는다 — 패널의 「초기화」는 여전히 «기본 솔리드»로 돌아간다(현재 규약 고정)', async ({ page }) => {
    /* ⛔API 의 reset(값을 지운다)과 패널의 「초기화」(setHex('#a0a0a0')로 기본 회색을 다시 쓴다)는
       «다른 약속»이다. API 를 고치면서 UI 를 따라가게 만들면 T-100/T-059 규약이 조용히 바뀐다.
       이 검사는 그 둘이 갈린 채로 있어야 함을 못박는다. */
    await seedGradient(page);
    await page.evaluate(() => document.getElementById('asset-bg-clear').click());
    await page.waitForTimeout(150);
    const p = await paint(page);
    expect(p.computedImage, 'UI 초기화도 그라데이션은 지운다').toBe('none');
    expect(p.dataBg, 'UI 초기화는 «빈 값»이 아니라 기본 솔리드로 돌아간다(현재 규약)').toBe('#a0a0a0');
  });
});
