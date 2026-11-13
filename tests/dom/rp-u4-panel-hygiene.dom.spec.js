/* rp-u4-panel-hygiene — U4 평가자 지적 ②③ 의 회귀: «빈 머리» 0 · 패널당 prop-hint ≤ 2 — 기본이 아닌 상태에서.
 * 상태: asset 영상(실제 setAssetVideoFromSrc · 꽉 채우기 · 트림 준비됨) · shape 원+가림막+레거시 모자이크 · shape 사각+가림막 · iconify 플로팅.
 * H1 힌트 ≤ 2 — `#panel-right .prop-hint` 수.
 * H2 빈 머리 0 — data-sec 절마다 «보이는» 몸통 요소(getClientRects 가 있는 것)나 머리 손잡이(headTools)가 하나는 있다.
 * ★내장 양성대조 HP: 같은 판정 함수가 ⑴ 힌트 하나 더 심으면 3 을 세고 ⑵ 절 몸통의 줄을 전부 display:none 으로 하면 그 절을 «빈 머리»로 잡는다. */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { bootApp } = require('./_root-harness.js');

const WEBM = 'data:video/webm;base64,' + fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'tiny-video.webm')).toString('base64');

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection();
    const sec = c.querySelector('.section-block'); window.__secEl = () => sec;
    window.__add = (cls, fn) => { window.deselectAll?.(); window.selectSection(sec); const b0 = new Set(sec.querySelectorAll('.' + cls)); fn(); return [...sec.querySelectorAll('.' + cls)].find((x) => !b0.has(x)); };
  });
  return errs;
}
const judge = (page) => page.evaluate(() => {
  const body = document.querySelector('#panel-right .panel-body');
  const empty = [...body.querySelectorAll(':scope > .prop-section[data-sec]')].filter((s) => {
    const sb = s.querySelector(':scope > .prop-sec-body');
    if (sb?.hidden) return false;   // 사람이 접은 절은 판정 밖
    const tools = [...s.querySelector(':scope > .prop-sec-head').children].some((c) => !c.classList.contains('prop-section-title') && c.getClientRects().length);
    const vis = sb && [...sb.querySelectorAll('*')].some((e) => e.getClientRects().length && e.getBoundingClientRect().width > 0);
    return !tools && !vis;
  }).map((s) => s.dataset.sec + (s.dataset.secState?.startsWith('special:') ? ':' + s.dataset.secState.slice(8) : ''));
  return { hints: body.querySelectorAll('.prop-hint').length, empty };
});

const STATES = {
  async 'asset 영상'(page) {
    await page.evaluate((src) => { const b = window.__add('asset-block', () => window.addAssetBlock('standard')); window.__b = b; window.setAssetVideoFromSrc(b, src); }, WEBM);
    await page.waitForFunction(() => window.__b.dataset.trimOut !== undefined, null, { timeout: 8000 }).catch(() => {});
    await page.evaluate(() => window.showAssetProperties(window.__b));
    return page.evaluate(() => ({ video: window.__b.dataset.assetType === 'video-pending', cover: (window.__b.dataset.fit || 'cover') === 'cover' }));
  },
  async 'shape 원+가림막+레거시 모자이크'(page) {
    await page.evaluate(() => { const b = window.__add('shape-block', () => window.addShapeBlock('ellipse')); b.dataset.shapeRedact = 'true'; b.dataset.shapeRedactMode = 'mosaic'; window.showShapeProperties(b); });
    return page.evaluate(() => ({ legacy: !!document.getElementById('shape-redact-legacy-note'), countHint: !!document.getElementById('shape-ellipse-count-hint') }));
  },
  async 'shape 사각+가림막(토글로 켬)'(page) {
    await page.evaluate(() => { const b = window.__add('shape-block', () => window.addShapeBlock('rectangle')); window.showShapeProperties(b); document.getElementById('shape-redact-toggle').click(); });
    return page.evaluate(() => ({ redactOn: document.getElementById('shape-redact-toggle')?.checked === true }));
  },
  async 'iconify 플로팅'(page) {
    await page.evaluate(() => { const b = window.__add('icon-block', () => window.addIconifyBlock()); window.showIconifyProperties(b); document.getElementById('icn-float-toggle').click(); });
    return page.evaluate(() => ({ floating: !!document.querySelector('#canvas .icon-block[data-overlay-block="true"]') }));
  },
};

test('H1·H2 비기본 상태 — 힌트 ≤ 2 · 빈 머리 0', async ({ page }) => {
  const errs = await scene(page);
  const out = {};
  for (const [name, make] of Object.entries(STATES)) {
    const pre = await make(page);
    out[name] = { pre, ...(await judge(page)) };
  }
  console.log('[H] ' + JSON.stringify(out));
  expect(out['asset 영상'].pre, '[전제] 영상·꽉 채우기 상태').toEqual({ video: true, cover: true });
  expect(out['shape 원+가림막+레거시 모자이크'].pre, '[전제] 레거시 고지 + 원 갯수 힌트가 뜨는 상태').toEqual({ legacy: true, countHint: true });
  expect(out['shape 사각+가림막(토글로 켬)'].pre, '[전제] 가림막 켜짐').toEqual({ redactOn: true });
  expect(out['iconify 플로팅'].pre, '[전제] 플로팅').toEqual({ floating: true });
  for (const [name, o] of Object.entries(out)) {
    expect(o.hints, `★${name}: prop-hint ${o.hints} > 2`).toBeLessThanOrEqual(2);
    expect(o.empty, `★${name}: 빈 머리`).toEqual([]);
  }
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('HP ★양성대조 — 판정이 힌트 3 과 빈 머리를 잡는다', async ({ page }) => {
  await scene(page);
  await STATES['shape 사각+가림막(토글로 켬)'](page);
  const base = await judge(page);
  expect(base.empty, '[전제] 깨끗한 판').toEqual([]);
  await page.evaluate(() => { const b = document.querySelector('#panel-right .prop-section[data-sec] > .prop-sec-body'); for (let i = 0; i < 3; i++) b.insertAdjacentHTML('beforeend', '<div class="prop-hint">x</div>'); });
  expect((await judge(page)).hints, '★힌트 수를 못 센다').toBeGreaterThan(2);
  await page.evaluate(() => { const s = document.querySelector('#panel-right .prop-section[data-sec="size"] > .prop-sec-body'); [...s.children].forEach((c) => { c.style.display = 'none'; }); });
  expect((await judge(page)).empty, '★몸통이 다 숨은 절을 «빈 머리»로 못 잡는다').toContain('size');
});

/* X1 (U0 ㉑ expandSection) — 원 갯수를 2 로 올리면 «원마다 색» 줄이 Fill 절에 생긴다 ⇒ 접혀 있던 Fill 이 열린다.
 * ★대조 X1n: 새 줄이 안 생기는 조작(회전)은 접힌 Fill 을 그대로 둔다 — 「무조건 연다」가 아니다. */
test('X1 새 줄이 Fill 에 생기면 접힌 Fill 을 연다 · 대조: 안 생기면 접힌 채', async ({ page }) => {
  const errs = await scene(page);
  await page.evaluate(() => { const b = window.__add('shape-block', () => window.addShapeBlock('ellipse')); window.__b = b; window.showShapeProperties(b); });
  const fillHead = page.locator('#panel-right .prop-section[data-sec="fill"] > .prop-sec-head > .prop-section-title');
  await fillHead.click();
  await expect(fillHead, '[전제] Fill 접힘').toHaveAttribute('aria-expanded', 'false');
  // 대조 — 회전(새 줄 없음)
  await page.evaluate(() => { const r = document.getElementById('shape-rot-slider'); r.value = '20'; r.dispatchEvent(new Event('input', { bubbles: true })); window.showShapeProperties(window.__b); });
  await expect(fillHead, '★새 줄이 없는데 Fill 을 열었다').toHaveAttribute('aria-expanded', 'false');
  // 원 2개 — 원마다 색 줄이 Fill 에 생긴다
  await page.evaluate(() => { const n = document.getElementById('shape-ellipse-count-num'); n.value = '2'; n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForFunction(() => !!document.getElementById('shape-ellipse-c1-hex'));
  await expect(fillHead, '★새 줄(원마다 색)이 생겼는데 Fill 이 접힌 채').toHaveAttribute('aria-expanded', 'true');
  expect(errs, errs.join(' | ')).toEqual([]);
});
