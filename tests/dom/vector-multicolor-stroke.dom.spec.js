/* vector-multicolor-stroke — VECTOR-MULTICOLOR-STROKE-P2-01 (시트 0.9.13 131행 · 현빈 순서 ② 여러 색·두께·끝모양·점선)
 *   여러 색 SVG = 색 무리마다 한 줄(패널 열 때 «칠 슬롯»을 얼린다 — 고치는 중 다른 무리와 같은 색이 돼도 안 합쳐진다) ·
 *   선 = 두께·끝모양(평평·둥글게·네모)·선 꼴(실선·대시 3:2·점 1:1 — 두께의 배수) · 가져온 SVG 는 선 요소마다 · 펜은 dataset + 공용 재빌드.
 *   펜 재빌드는 지금 viewBox 를 지킨다(크기 조절 뒤 색·두께를 바꾸면 점이 어긋나던 것 — 분석 261118 추정).
 * 칸 (조작은 패널 «진짜 입력» · 판정은 그린 요소 getComputedStyle / data-svg)
 *   C1 세 무리(빨강·파랑·칠 없음=검정) → 줄 셋 · 둘째 줄만 초록 → 그 무리만 바뀐다
 *   C2 얼림 — 첫 무리를 둘째와 같은 파랑으로 → 다시 자홍으로 = 첫 무리만 자홍(둘째는 파랑 그대로) · ⌘Z 한 번 = 첫 무리 파랑
 *   C3 검정 무리 굽기 — data-color 초록인 판에서 검정 무리 줄을 검정으로 → 정말 검정(초록으로 다시 칠해지지 않는다) · 빨강 무리 그대로
 *   S1 가져온 SVG 선 — 두께 6 · 끝 네모 · 대시(18 12) · 두께 4 로 바꾸면 대시도 12 8 · 저장→다시 열기 뒤 그대로
 *   S2 펜 — 크기 120 으로 늘린 뒤 두께·끝모양·점 → viewBox 그대로(0 0 60 60) · 재빌드 글자에 끝·점선
 * 양성대조: _patches/vector-p2-CTL-pen-viewbox.patch(재빌드가 viewBox 를 새 w·h 로 다시 씀) → S2 빨강 · C1~C3·S1 초록.
 * ⛔고정 대기 0(expect.poll · 조건 대기).
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const NS = 'xmlns="http://www.w3.org/2000/svg"';
const THREE = `<svg ${NS} viewBox="0 0 30 10" width="120" height="40"><rect width="10" height="10" fill="#ff0000"/><rect x="10" width="10" height="10" fill="#0000ff"/><path d="M20 0h10v10H20z"/></svg>`;
const TWO = `<svg ${NS} viewBox="0 0 20 10" width="80" height="40"><rect width="10" height="10" fill="#ff0000"/><rect x="10" width="10" height="10" fill="#0000ff"/></svg>`;
const BLACK_RED = `<svg ${NS} viewBox="0 0 20 10" width="80" height="40"><path d="M0 0h10v10H0z"/><rect x="10" width="10" height="10" fill="#ff0000"/></svg>`;
const LINE = `<svg ${NS} viewBox="0 0 40 10" width="160" height="40"><line x1="2" y1="5" x2="38" y2="5" stroke="#000000" stroke-width="2"/></svg>`;
const PEN = `<svg ${NS} viewBox="0 0 60 60" width="60" height="60"><path d="M5 5L55 55" fill="none" stroke="#1a1a1a" stroke-width="2"/></svg>`;
const R = 'rgb(255, 0, 0)', B = 'rgb(0, 0, 255)', K = 'rgb(0, 0, 0)', G = 'rgb(0, 255, 0)', M = 'rgb(255, 0, 255)';

async function scene(page, svg, { color, pen } = {}) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate(async ([svg, color, pen]) => {
    document.querySelectorAll('#canvas .section-block').forEach((s) => s.remove());
    await window.addSection();
    const b = window.addVectorBlock(svg, { w: pen ? 60 : 120, h: pen ? 60 : 40, ...(color ? { color } : {}) });
    b.id = 'vbT';
    if (pen) { b.dataset.penNodes = JSON.stringify([{ x: 5, y: 5 }, { x: 55, y: 55 }]); b.dataset.penClosed = '0'; b.dataset.strokeWidth = '2'; }
    window.renderVector(b);
    window.deselectAll?.();
    b.scrollIntoView({ block: 'center', inline: 'center' });
  }, [svg, color || null, !!pen]);
  await openPanel(page);
  return errs;
}
async function openPanel(page) {
  const r = await waitStableRect(page, '#vbT');
  await page.mouse.click(r.cx, r.cy);
  await page.waitForSelector('#vb-w', { timeout: 5000 });   // [전제] 벡터 패널
}
/** 색 칸에 진짜로 쳐서 확정(input → 그리기 · Tab = change → 히스토리) */
async function hex(page, prefix, v) {
  await page.locator(`#${prefix}-hex`).fill(v);
  await page.locator(`#${prefix}-hex`).press('Tab');
}
async function num(page, id, v) { await page.locator('#' + id).fill(String(v)); await page.locator('#' + id).press('Tab'); }
const fills = (page) => page.evaluate(() => [...document.querySelectorAll('#vbT .vb-inner svg :is(path, rect, line)')].map((el) => getComputedStyle(el).fill));
const strokeCs = (page) => page.evaluate(() => { const cs = getComputedStyle(document.querySelector('#vbT .vb-inner svg :is(path, line)')); return [cs.strokeWidth, cs.strokeLinecap, cs.strokeDasharray]; });
const dsvg = (page) => page.evaluate(() => document.getElementById('vbT').dataset.svg);

test('C1 세 무리 → 줄 셋 · 둘째 줄만 초록', async ({ page }) => {
  const errs = await scene(page, THREE);
  expect(await page.locator('[id^="vb-g"][id$="-hex"]').count(), '★색 무리 줄 셋(빨강·파랑·칠 없음)').toBe(3);
  expect(await fills(page), '[전제] 처음 그림').toEqual([R, B, K]);
  await hex(page, 'vb-g1', '00FF00');
  await expect.poll(() => fills(page), '★둘째 무리만 초록').toEqual([R, G, K]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('C2 얼린 슬롯 — 같은 색이 돼도 안 합쳐진다 · ⌘Z', async ({ page }) => {
  const errs = await scene(page, TWO);
  await hex(page, 'vb-g0', '0000FF');
  await expect.poll(() => fills(page), '[전제] 둘 다 파랑').toEqual([B, B]);
  await hex(page, 'vb-g0', 'FF00FF');
  await expect.poll(() => fills(page), '★첫 무리만 자홍(얼린 슬롯)').toEqual([M, B]);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await expect.poll(() => fills(page), '★⌘Z 한 번 = 첫 무리 파랑').toEqual([B, B]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('C3 검정 무리 굽기 — data-color 초록 판에서 검정을 고르면 정말 검정', async ({ page }) => {
  const errs = await scene(page, BLACK_RED, { color: '#00ff00' });
  expect(await fills(page), '[전제] 검정 무리는 data-color(초록)로 그려진다').toEqual([G, R]);
  await hex(page, 'vb-g0', '000000');
  await expect.poll(() => fills(page), '★검정 무리 = 검정 · 빨강 무리 그대로').toEqual([K, R]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S1 가져온 SVG 선 — 두께·끝·대시 · 두께 따라 대시 · 저장→다시 열기', async ({ page }) => {
  const errs = await scene(page, LINE);
  expect(await strokeCs(page), '[전제] 두께 2 · 평평 · 실선').toEqual(['2px', 'butt', 'none']);
  await num(page, 'vb-stroke-w-num', 6);
  await page.locator('#vb-stroke-cap').selectOption('square');
  await page.locator('#vb-stroke-dash').selectOption('dash');
  await expect.poll(() => strokeCs(page), '★두께 6 · 네모 · 대시 18 12').toEqual(['6px', 'square', '18px, 12px']);
  await num(page, 'vb-stroke-w-num', 4);
  await expect.poll(() => strokeCs(page), '★두께 4 → 대시도 12 8').toEqual(['4px', 'square', '12px, 8px']);
  const canvas = await page.evaluate(() => window.getSerializedCanvas());
  await page.evaluate((c) => window.applyProjectData({ canvas: c }), canvas);
  await page.waitForSelector('#vbT');
  await page.evaluate(() => window.renderVector(document.getElementById('vbT')));
  expect(await strokeCs(page), '★다시 열고 다시 그려도 그대로').toEqual(['4px', 'square', '12px, 8px']);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S2 펜 — 크기 늘린 뒤 두께·끝·점 → viewBox 그대로 · 재빌드에 끝·점선', async ({ page }) => {
  const errs = await scene(page, PEN, { pen: true });
  await num(page, 'vb-w', 120);
  await expect.poll(() => page.evaluate(() => document.getElementById('vbT').dataset.w), '[전제] 폭 120').toBe('120');
  await num(page, 'vb-stroke-w-num', 4);
  await page.locator('#vb-stroke-cap').selectOption('butt');
  await page.locator('#vb-stroke-dash').selectOption('dot');
  await expect.poll(() => dsvg(page).then((s) => /stroke-dasharray="4 4"/.test(s) && /stroke-linecap="butt"/.test(s) && /stroke-width="4"/.test(s)), '★재빌드 글자에 두께·끝·점').toBe(true);
  expect((await dsvg(page)).match(/viewBox="([^"]+)"/)[1], '★viewBox 그대로(점 좌표와 같은 판)').toBe('0 0 60 60');
  expect(errs, errs.join(' | ')).toEqual([]);
});
