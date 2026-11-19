/* t13c-07-ifg-icon-scale — t13C-07: 인포그래픽(그리드 표식 data-ifg-preset) 원 칸 안 «아이콘»만 따로 줄이는 「아이콘 크기(%)」.
 *   원 지름(줄 height = 프리셋 iconSize)은 그대로 · 그림(img.grd-img)만 가운데에서 줄어든다.
 *   장면: 새 섹션 → addInfographicBlock → 패널(showGridProperties) #grd-ifg-icon-scale 기본 100 · img 인라인 = 옛 바이트 →
 *         60 으로 확정(change) → 모든 원: 그림 폭 = 원 폭 × 0.6 · 가운데 · 원 폭 불변 →
 *         Figma JSON(buildFigmaExportJSON) images = 그림 자리(원 폭 × 0.6) · circle:false →
 *         저장→다시 열기(serializeProject/applyProjectData) 뒤에도 0.6 · 패널 60.
 *   PNG(html2canvas)·단독 HTML(클론)은 캔버스 DOM 의 인라인 style 을 그대로 쓴다 — 인라인 width:60% 를 단언한다(파일 내보내기 자체는 안 돈다).
 * ⛔고정 대기 0(조건 대기).
 * 양성대조(CTL _patches/t13c-07-ifg-icon-scale-ctl.patch): grid-block.js 원 가지가 배율을 안 읽게(iSc = 100 고정) → «그림 폭 0.6» 단언 빨강. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const OLD_IMG_STYLE = 'display:block;width:100%;height:100%;object-fit:cover;';

/* 모든 원 칸의 {원 폭, 그림 폭/원 폭, 가운데 어긋남} — 레이아웃 px(화면 ÷ 배율) */
const circles = (page, id) => page.evaluate((id) => {
  const g = document.getElementById(id); const z = g.getBoundingClientRect().width / g.offsetWidth;
  return [...g.querySelectorAll('.grd-img-circle')].filter(f => f.querySelector('img.grd-img')).map((f) => {
    const fr = f.getBoundingClientRect(), ir = f.querySelector('img.grd-img').getBoundingClientRect();
    return { fw: Math.round(fr.width / z), ratio: +(ir.width / fr.width).toFixed(3),
      off: Math.round(Math.max(Math.abs((ir.left + ir.width / 2) - (fr.left + fr.width / 2)), Math.abs((ir.top + ir.height / 2) - (fr.top + fr.height / 2))) / z),
      style: f.querySelector('img.grd-img').getAttribute('style') };
  });
}, id);

test('I1 아이콘 크기 — 원 지름 그대로 그림만 줄어듦 · Figma JSON 같은 자리 · 저장/다시 열기 유지 · 기본 = 옛 바이트', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1400 });
  const errs = await bootApp(page);
  await page.click('.fp-btn.primary[title="새 섹션 추가"]');
  await expect.poll(() => page.evaluate(() => !!window.getSelectedSection?.())).toBe(true);
  const id = await page.evaluate(() => window.addInfographicBlock()?.id);
  expect(id, '[전제] 인포그래픽 그리드가 생겼다').toBeTruthy();
  await page.evaluate(async () => { await (window.whenGridRatiosSettled?.() ?? Promise.resolve()); });

  const c0 = await circles(page, id);
  expect(c0.length, '[전제] 원 아이콘 칸 9개(3×3)').toBe(9);
  expect(c0.every(c => c.style === OLD_IMG_STYLE), `기본 = 옛 바이트(${c0[0].style})`).toBe(true);

  const openPanel = () => page.evaluate((id) => { window.selectBlock(id); window.showGridProperties(document.getElementById(id)); }, id);
  await openPanel();
  const field = page.locator('#grd-ifg-icon-scale');
  await expect(field).toHaveValue('100');
  /* 지디 실앱 채점 ◑: 라벨 «아이콘 크기(%)» 가 56px 고정 폭에 «아이콘 크…» 로 잘렸다 → 다른 패널과 같은 이름 «아이콘 크기» + .prop-label--auto(내용폭 · editor-props.css 변형) */
  expect(await page.evaluate(() => { const l = document.getElementById('grd-ifg-icon-scale')?.closest('.prop-row')?.querySelector('.prop-label'); return l ? { t: l.textContent.trim(), cut: l.scrollWidth > l.clientWidth + 0.5 } : null; }), '★아이콘 크기 라벨 글귀 잘림 0').toEqual({ t: '아이콘 크기', cut: false });
  await field.fill('60');
  await field.dispatchEvent('change');
  await expect.poll(async () => (await circles(page, id)).map(c => c.ratio)).toEqual(Array(9).fill(0.6));
  const c1 = await circles(page, id);
  expect(c1.map(c => c.fw), '원 지름은 그대로').toEqual(c0.map(c => c.fw));
  expect(c1.every(c => c.off <= 1), `그림이 원 가운데(${c1.map(c => c.off)})`).toBe(true);
  expect(c1[0].style, 'PNG·HTML 이 싣는 인라인 꼴').toContain('width:60%');

  /* Figma JSON — 그림 자리 = 캔버스 그림 자리 · 원 자르기 없음 */
  const fig = await page.evaluate(async (id) => {
    await (window.whenGridRatiosSettled?.() ?? Promise.resolve());
    window.flushCurrentPage?.();
    const json = window.buildFigmaExportJSON(null);
    let hit = null; const walk = (o) => { if (hit) return; if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') { if (o.type === 'generic' && o.id === id) hit = o; else Object.values(o).forEach(walk); } }; walk(json);
    return hit ? (hit.images || []).map(im => ({ w: im.w, h: im.h, circle: im.circle })) : null;
  }, id);
  expect(fig, '[전제] 그리드가 generic 으로 나간다').not.toBeNull();
  expect(fig.length).toBe(9);
  fig.forEach((im, i) => {
    expect(Math.abs(im.w - c1[i].fw * 0.6), `Figma 그림 폭 ${im.w} ≈ 원 ${c1[i].fw} × 0.6`).toBeLessThanOrEqual(1);
    expect(im.circle, '줄인 아이콘은 원 자르기 없음(원 안에 다 든다)').toBe(false);
  });

  /* 저장 → 다시 열기 */
  const snap = await page.evaluate(() => window.serializeProject());
  await bootApp(page);
  await page.evaluate((d) => { document.getElementById('canvas').innerHTML = ''; window.applyProjectData(JSON.parse(d)); window.deselectAll?.(); }, snap);
  await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
  await expect.poll(async () => (await circles(page, id)).map(c => c.ratio)).toEqual(Array(9).fill(0.6));
  await openPanel();
  await expect(page.locator('#grd-ifg-icon-scale')).toHaveValue('60');
  expect(errs).toEqual([]);
});
