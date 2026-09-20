/* modal-icon-align.dom.spec.js — 「아이콘과 글자의 중앙이 서로 맞는가」를 «사람이 보는 값»으로.
 *   (현빈 신고 2026-09-20: 「mdl_ts0he_z6q0otw > 모달에 아이콘+텍스트 프리셋을 했는데
 *    서로 중앙이 안 맞는 문제」)
 *
 * ★왜 DOM 이어야 하나
 *   이 결함은 dataset 으로는 «안 보인다». dataset.vAlign 은 애초에 «없었고»(키 자체가
 *   MODAL_DEFAULTS 에 없다), 그래서 폴백 'top' → align-items:flex-start 가 걸렸다.
 *   24px 아이콘과 61.2px 줄높이가 위 기준으로 붙어 중심이 18.59px 어긋난 것 —
 *   그 18.59 는 «계산된 rect»에서만 나온다.
 *
 * ★음성대조 (dev@20e50e3 실측, 이 파일을 고치기 «전»에 재 둔 값)
 *   M1 한 줄   : |아이콘중심 − 글자중심| = 18.59  → red
 *   M2 다섯 줄 : 아이콘중심 48.59 vs 첫줄중심 48.60 기준으로 122.4 어긋남 → red
 *   M3 고정높이+vAlign: 래퍼 없이 align-items:center 로만 때우면 세로정렬이 죽는다 → red
 *
 * ⛔앱을 «안» 띄운다 — 레포 파일만 크로미움에 얹는다(modal-variant.dom.spec.js 와 같은 부팅).
 * ⚠️⚠️이 파일은 «변이를 잡는 그물이 아니다». tests/dom 은 `npm test` 스위트에 안 들어간다.
 *   변이 책임은 tests/unit/modal-icon-align.test.mjs 가 진다.
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js modal-icon-align
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-blocks.css"></head><body>
<div id="canvas"><div class="section-block"><div class="section-inner" id="host" style="width:600px;"></div></div></div>
<div id="panel-right"><div class="panel-body"></div></div>
<script type="module">
  import { makeModalBlock, renderModalBlock } from '/js/blocks/modal-block.js';
  import { showModalProperties } from '/js/props/prop-modal.js';
  window.__mk = makeModalBlock;
  window.__render = renderModalBlock;
  window.__open = showModalProperties;
  window.__ready = true;
</script></body></html>`;

async function boot(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
}

/** dataset 을 얹고 «진짜로» 렌더한 모달 하나를 캔버스에 올린다. */
async function mount(page, ds) {
  await page.evaluate((d) => {
    document.getElementById('host').innerHTML = '';
    const { row, block } = window.__mk({ variant: d.variant || 'icon' });
    Object.assign(block.dataset, d);
    document.getElementById('host').appendChild(row);
    window.__render(block);
    window.__block = block;
  }, ds);
}

/** ★사람이 보는 값 — 아이콘의 중심 Y 와 «첫 줄»의 중심 Y. */
const measure = (page) => page.evaluate(() => {
  const b = window.__block;
  const icon = b.querySelector('.mdl-icon');
  const text = b.querySelector('.tb-mdl-text');
  const ir = icon.getBoundingClientRect();
  const tr = text.getBoundingClientRect();
  const lh = parseFloat(getComputedStyle(text).lineHeight);
  return {
    iconCenter: +(ir.top + ir.height / 2).toFixed(2),
    textCenter: +(tr.top + tr.height / 2).toFixed(2),
    firstLineCenter: +(tr.top + lh / 2).toFixed(2),
    lineHeight: +lh.toFixed(2),
    rowTop: (() => { const r = b.querySelector('.mdl-iconrow'); return r ? +r.getBoundingClientRect().top.toFixed(2) : null; })(),
    blockTop: +b.getBoundingClientRect().top.toFixed(2),
    blockHeight: +b.getBoundingClientRect().height.toFixed(2),
  };
});

const FIVE = '한 줄\n두 줄\n세 줄\n네 줄\n다섯 줄';

test.describe('모달 icon 변형 — 아이콘과 첫 줄의 중앙', () => {
  test.beforeEach(async ({ page }) => { await boot(page); });

  test('M1 한 줄 — 아이콘 중심과 글자 중심이 맞는다 (음성대조 18.59px)', async ({ page }) => {
    await mount(page, { variant: 'icon', textText: '배송은 2~3일 걸려요' });
    const m = await measure(page);
    expect(Math.abs(m.iconCenter - m.textCenter),
      `아이콘중심 ${m.iconCenter} vs 글자중심 ${m.textCenter}`).toBeLessThanOrEqual(1);
  });

  test('M2 다섯 줄 — 아이콘이 «첫 줄»과 맞는다 (문단 한가운데로 안 내려간다)', async ({ page }) => {
    await mount(page, { variant: 'icon', textText: FIVE });
    const m = await measure(page);
    // ⛔align-items:center 로만 때우면 여기서 red — 아이콘이 문단 한가운데(≈171px)로 내려간다
    expect(Math.abs(m.iconCenter - m.firstLineCenter),
      `아이콘중심 ${m.iconCenter} vs 첫줄중심 ${m.firstLineCenter}`).toBeLessThanOrEqual(1);
    expect(m.lineHeight).toBeGreaterThan(40); // 줄높이가 진짜 붙어 있나(전제 확인)
  });

  for (const [vAlign, label] of [['center', '가운데'], ['bottom', '아래']]) {
    test(`M3 고정높이 300 + vAlign:${vAlign} — 행은 ${label}로 내려가고 M1 은 유지된다`, async ({ page }) => {
      await mount(page, { variant: 'icon', hMode: 'fixed', height: '300', vAlign, textText: '한 줄' });
      const m = await measure(page);
      expect(Math.abs(m.iconCenter - m.textCenter),
        `아이콘중심 ${m.iconCenter} vs 글자중심 ${m.textCenter}`).toBeLessThanOrEqual(1);
      // ★vAlign 이 «살아 있어야» 한다 — 래퍼 없이 align-items 만 고치면 이 축이 죽는다
      expect(m.rowTop, '.mdl-iconrow 래퍼가 없다 — 세로정렬을 걸 자리가 없다').not.toBeNull();
      expect(m.rowTop - m.blockTop,
        `고정높이 ${m.blockHeight} 인데 행이 위에 붙어 있다 — vAlign 이 안 먹는다`).toBeGreaterThan(40);
    });
  }

  test('M4 icon-stack 의 cssText 는 종전과 «바이트 동일» (래칫)', async ({ page }) => {
    await mount(page, { variant: 'icon-stack', textText: '한 줄' });
    const out = await page.evaluate(() => ({
      css: window.__block.style.cssText,
      hasRow: !!window.__block.querySelector('.mdl-iconrow'),
      iconStyle: window.__block.querySelector('.mdl-icon').getAttribute('style'),
    }));
    expect(out.hasRow, 'icon-stack 까지 래퍼로 감쌌다 — 기존 블록 전부의 생김새가 달라진다').toBe(false);
    expect(out.iconStyle, 'icon-stack 아이콘에 오프셋이 붙었다').not.toContain('margin-top');
    expect(out.css).toContain('display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 9px; text-align: center;');
  });

  test('M5 ★패널 경로 — variant 셀렉트에 진짜 change 를 쏴서 plain→icon 전환 후 재측정', async ({ page }) => {
    // 「프리셋을 눌렀을 때」가 신고 경로다. 함수를 직접 부르면 그 한 줄을 되돌려도 초록이다.
    await page.evaluate(() => {
      const { row, block } = window.__mk({});
      document.getElementById('host').appendChild(row);
      block.dataset.textText = '배송은 2~3일 걸려요';
      window.__render(block);
      window.__block = block;
      window.__open(block);
    });
    await page.selectOption('#mdl-variant', 'icon');
    await expect(page.locator('#mdl-variant')).toHaveValue('icon');
    const m = await measure(page);
    expect(Math.abs(m.iconCenter - m.textCenter),
      `전환 후 아이콘중심 ${m.iconCenter} vs 글자중심 ${m.textCenter}`).toBeLessThanOrEqual(1);
  });

  test('M6 Text>정렬이 «아이콘 행»에 먹는다 (좌/중/우)', async ({ page }) => {
    const lefts = {};
    for (const a of ['left', 'center', 'right']) {
      await mount(page, { variant: 'icon', align: a, textText: '짧은 줄' });
      lefts[a] = await page.evaluate(() => {
        const b = window.__block;
        return +(b.querySelector('.mdl-icon').getBoundingClientRect().left
               - b.getBoundingClientRect().left).toFixed(1);
      });
    }
    expect(lefts.center, `left=${lefts.left} center=${lefts.center}`).toBeGreaterThan(lefts.left);
    expect(lefts.right, `center=${lefts.center} right=${lefts.right}`).toBeGreaterThan(lefts.center);
  });
});
