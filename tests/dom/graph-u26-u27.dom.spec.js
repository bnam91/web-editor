/* graph-u26-u27.dom.spec.js — E99 U26(손대기 전 그래프: 패널 두께 = 실제 막대 두께) · E103 U27(「카테고리 …」 라벨 안 잘림)
 *
 * 머리표(지디 규율 — «옛 판에서도 초록이면 무엇을 재나»):
 *   [새 것]   772ccadc 에서 빨강이어야 한다 — 고친 것을 잰다.
 *   [회귀 지킴] 772ccadc 에서도 초록 — 고치며 깨뜨리지 않았나를 잰다.
 *   [전제]    재기 위한 조건이 섰나(키 없음 · 패널 열림 · 선택됨).
 * 하네스 = bootApp(앱 통째 · 진짜 마우스 clickAt — 누르기 직전 맞힌 요소 단언). 값 = offsetWidth/Height · scrollWidth/clientWidth.
 * 원인(U26 «code-read»): 패널 prop-graph.js 는 키 없으면 24, 세로·비교 렌더(drag-utils.js _barVSettings)는 키 없으면 폭을 안 걸어 칸 전폭.
 *   고침 = 기본값 «한 자리» GRAPH_LIMITS.BAR_THICKNESS_DEFAULT 를 패널·렌더 셋이 읽는다.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

async function setup(page, chartType) {
  await page.setViewportSize({ width: 1600, height: 1200 });
  const errs = await bootApp(page);
  const id = await page.evaluate((ct) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="sG" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>');
    window.rebindAll?.(); window.deselectAll?.(); window.applyZoom?.(100);
    const sec = document.getElementById('sG'); sec.classList.add('selected');
    const before = new Set([...document.querySelectorAll('.graph-block')].map(b => b.id));
    window.addGraphBlock({ chartType: ct });
    const nb = [...document.querySelectorAll('.graph-block')].find(b => !before.has(b.id));
    window.deselectAll?.();
    if (nb) nb.scrollIntoView({ block: 'center' });
    return nb ? nb.id : null;
  }, chartType);
  expect(id, `[전제] ${chartType} 그래프가 생겼다`).toBeTruthy();
  await page.waitForTimeout(200);
  // 진짜 클릭으로 고른다(누르기 직전 맞힌 요소 = 그 그래프)
  const p = await page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + 12, r.top + 12]; }, id);
  await clickAt(page, p[0], p[1], { sel: `.graph-block` }, { label: chartType });
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).classList.contains('selected') && !!document.getElementById('grb-bar-thickness-number'), id),
    { timeout: 3000, message: `[전제] ${chartType} 선택 + 패널 두께 칸이 열렸다` }).toBe(true);
  return { errs, id };
}

const measure = (page, id) => page.evaluate((id) => {
  const b = document.getElementById(id);
  const ct = b.dataset.chartType;
  const keys = { barThickness: b.dataset.barThickness ?? null, vBarThickness: b.dataset.vBarThickness ?? null };
  const panel = Number(document.getElementById('grb-bar-thickness-number').value);
  let actual = null;
  if (ct === 'bar-h') { const t = b.querySelector('.grb-bar-h-track'); actual = t ? t.offsetHeight : null; }
  else { const fills = [...b.querySelectorAll('.grb-bar-fill')]; actual = fills.length ? Math.max(...fills.map(f => f.offsetWidth)) : null; }
  const labels = [...document.querySelectorAll('.prop-label')].filter(l => l.textContent.includes('카테고리') && l.getBoundingClientRect().width > 0)
    .map(l => ({ text: l.textContent.trim(), sw: l.scrollWidth, cw: l.clientWidth }));
  return { ct, keys, panel, actual, labels };
}, id);

for (const ct of ['bar-v', 'bar-pair', 'bar-h']) {
  const tag = ct === 'bar-h' ? '회귀 지킴' : '새 것';
  test(`U26 [${tag}] ${ct} 손대기 전 — 패널 두께 = 실제 막대 두께`, async ({ page }) => {
    const { errs, id } = await setup(page, ct);
    const m = await measure(page, id);
    expect(m.keys, `[전제] 두께 키 없음(손대기 전) ${JSON.stringify(m)}`).toEqual({ barThickness: null, vBarThickness: null });
    expect(m.actual, `[전제] 막대를 찾았다 ${JSON.stringify(m)}`).not.toBeNull();
    expect(Math.abs(m.actual - m.panel), `★패널 ${m.panel} vs 실제 ${m.actual}px (${ct})`).toBeLessThanOrEqual(1);
    expect(errs).toEqual([]);
  });

  test(`U27 [새 것] ${ct} — 「카테고리 색상」·「카테고리 표시」 라벨이 안 잘린다`, async ({ page }) => {
    const { errs, id } = await setup(page, ct);
    const m = await measure(page, id);
    expect(m.labels.map(l => l.text).sort(), `[전제] 두 라벨이 보인다 ${JSON.stringify(m.labels)}`).toEqual(['카테고리 색상', '카테고리 표시']);
    for (const l of m.labels) expect(l.sw, `★「${l.text}」 scrollWidth ${l.sw} ≤ clientWidth ${l.cw} (${ct})`).toBeLessThanOrEqual(l.cw);
    expect(errs).toEqual([]);
  });
}

/* [회귀 지킴] 넓힌 것은 «그 두 라벨»뿐 — 같은 패널의 다른 라벨과 다른 패널(섹션)의 .prop-label 은 여전히 56px */
test('U27 [회귀 지킴] 다른 라벨 · 다른 패널의 .prop-label 폭은 56px 그대로', async ({ page }) => {
  const { errs, id } = await setup(page, 'bar-v');
  const g = await page.evaluate(() => [...document.querySelectorAll('.prop-label')].filter(l => l.getBoundingClientRect().width > 0 && !l.textContent.includes('카테고리') && !l.classList.contains('prop-label--auto') && !l.classList.contains('prop-label--narrow') && !l.style.width).map(l => ({ t: l.textContent.trim(), w: l.offsetWidth })));
  expect(g.length, '[전제] 그래프 패널에 다른 라벨이 있다').toBeGreaterThan(0);
  expect(g.filter(x => x.w !== 56), `그래프 패널 다른 라벨 폭 ${JSON.stringify(g.filter(x => x.w !== 56))}`).toEqual([]);
  await page.evaluate(async () => { window.deselectAll?.(); const s = document.getElementById('sG'); s.classList.add('selected'); await window.showSectionProperties(s); });
  await page.waitForTimeout(300);
  const sec = await page.evaluate(() => [...document.querySelectorAll('.prop-label')].filter(l => l.getBoundingClientRect().width > 0 && !l.classList.contains('prop-label--auto') && !l.classList.contains('prop-label--narrow') && !l.style.width).map(l => ({ t: l.textContent.trim(), w: l.offsetWidth })));
  expect(sec.length, '[전제] 섹션 패널에 라벨이 있다').toBeGreaterThan(0);
  expect(sec.filter(x => x.w !== 56), `섹션 패널 라벨 폭 ${JSON.stringify(sec.filter(x => x.w !== 56))}`).toEqual([]);
  expect(errs).toEqual([]);
});
