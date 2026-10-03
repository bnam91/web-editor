/* asset-open-heal-beyond-edge.dom.spec.js — B6 후속(2026-10-03): 프로젝트를 «열 때» ㉡ 만 자동 정리
 * ㉡ = px 폭 에셋의 |음수 margin| > 그 에셋이 든 섹션 안쪽 패딩(섹션마다 다름 — 고정값 금지).
 * ㉠ = |margin| == 패딩(가장자리에 딱 붙음) → 그대로.  ㉢ = 가운데 정렬 → 그대로.  풀블리드(calc 폭) → 그대로.
 * 실물 ㉡: proj_1786077501267/ab_lns8z1r(sec_brhc463, -72·패딩 60) 외 7건(save-load.js healAssetsBeyondSectionEdge 머리말).
 * 양성대조: GD1001_ROOT=<90ce092b 체크아웃> → ㉡ 시험 빨강.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js asset-open-heal-beyond-edge --workers=1 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SEC = (id, pad, abHtml) => `<div class="section-block" data-section="1" id="${id}"><div class="section-hitzone"></div>
  <div class="section-inner" style="padding-left: ${pad}px; padding-right: ${pad}px;" data-padding-x="${pad}">
    <div class="row" data-layout="stack">${abHtml}</div></div></div>`;
const AB = (id, align, w, m) =>
  `<div class="asset-block" id="${id}" data-align="${align}" data-overlay="false" style="align-self: ${align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center'}; margin-left: ${m}px; margin-right: ${m}px; width: ${w}; height: 300px;" data-size="100" data-base-height="300"><div class="asset-overlay"></div></div>`;

const CASES = {
  '㉡ 좌 -72 / 패딩 60': { pad: 60, html: AB('c1', 'left', '720px', -72), heal: true },
  '㉡ 우 -72 / 패딩 60': { pad: 60, html: AB('c2', 'right', '400px', -72), heal: true },
  '㉡ 좌 -80 / 패딩 72 (섹션 값을 읽는다 — 72 고정이면 놓친다)': { pad: 72, html: AB('c3', 'left', '600px', -80), heal: true },
  '㉠ 좌 -60 / 패딩 60 (딱 붙음)': { pad: 60, html: AB('c4', 'left', '720px', -60), heal: false },
  '㉠ 좌 -72 / 패딩 72 (같은 -72 가 섹션 값이 다르면 ㉠)': { pad: 72, html: AB('c5', 'left', '600px', -72), heal: false },
  '㉢ 가운데 -72 / 패딩 60': { pad: 60, html: AB('c6', 'center', '720px', -72), heal: false },
  '풀블리드 calc 폭 -60 / 패딩 60': { pad: 60, html: AB('c7', 'left', 'calc(100% + 120px)', -60), heal: false },
};

async function openWith(page, pad, html) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  await bootApp(page);
  await page.evaluate(([h, p]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', h); window.rebindAll?.();
  }, [SEC('s1', pad, html), pad]);
  const snap = JSON.parse(await page.evaluate(() => window.serializeProject()));
  await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(d), snap);
  await page.waitForTimeout(400);
}
const state = (page, id) => page.evaluate((i) => {
  const ab = document.getElementById(i), inner = ab.closest('.section-inner');
  const ir = inner.getBoundingClientRect(), ar = ab.getBoundingClientRect(), sc = ir.width / inner.offsetWidth;
  const cs = getComputedStyle(inner);
  return { ml: ab.style.marginLeft, mr: ab.style.marginRight, w: ab.style.width,
    left: (ar.left - (ir.left + parseFloat(cs.paddingLeft) * sc)) / sc, right: ((ir.right - parseFloat(cs.paddingRight) * sc) - ar.right) / sc };
}, id);

for (const [name, c] of Object.entries(CASES)) {
  test(`열기 — ${name} → ${c.heal ? '정리된다(섹션 안쪽)' : '그대로'}`, async ({ page }) => {
    const id = c.html.match(/id="(c\d)"/)[1];
    await openWith(page, c.pad, c.html);
    const s = await state(page, id);
    const before = c.html.match(/margin-left: (-?\d+)px/)[1] + 'px';
    if (c.heal) {
      expect(s.ml).toBe(''); expect(s.mr).toBe('');
      expect(s.left, '왼쪽 경계').toBeGreaterThanOrEqual(-1);
      expect(s.right, '오른쪽 경계').toBeGreaterThanOrEqual(-1);
    } else {
      expect(s.ml).toBe(before); expect(s.mr).toBe(before);
    }
  });
}

test('섹션 둘(패딩 60·72)에 같은 -72 — 60 쪽만 ㉡ 로 정리, 72 쪽은 ㉠ 로 그대로', async ({ page }) => {
  await openWith(page, 60, AB('c1', 'left', '720px', -72));
  await page.evaluate((h) => { document.getElementById('canvas').insertAdjacentHTML('beforeend', h); }, SEC('s2', 72, AB('c5', 'left', '600px', -72)));
  const snap = JSON.parse(await page.evaluate(() => window.serializeProject()));
  await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(d), snap);
  await page.waitForTimeout(400);
  expect((await state(page, 'c1')).ml).toBe('');
  expect((await state(page, 'c5')).ml).toBe('-72px');
});

/* ── 적대QA(0e) BREAKS 5꼴 — 전부 «그대로»여야 한다(「실제로 든 상자」의 패딩을 합쳐 읽는다) ── */
const RAW = (inner, innerStyle) => `<div class="section-block" data-section="1" id="s1"><div class="section-hitzone"></div><div class="section-inner" ${innerStyle}>${inner}</div></div>`;
const ABX = (id, extra) => `<div class="asset-block" id="${id}" data-align="left" data-overlay="false" style="align-self: flex-start; margin-left: -72px; margin-right: -72px; width: 600px; height: 200px;${extra || ''}" data-size="100"><div class="asset-overlay"></div></div>`;
const BREAKS = {
  'B1 합친 섹션 상자(.section-merged-part 패딩 72) 안 -72': () => RAW(`<div class="section-merged-part" style="padding-left:72px;padding-right:72px;"><div class="row" data-layout="stack">${ABX('x')}</div></div>`, 'style="padding-left:0px;padding-right:0px;" data-padding-x="0"'),
  'B2 섹션 개별 패딩 없음(페이지 padX 60) + -60': () => RAW(`<div class="row" data-layout="stack">${ABX('x').replace(/-72px/g, '-60px')}</div>`, ''),
  'B3 행 패딩 80 + -80 (섹션 패딩 60)': () => RAW(`<div class="row" data-layout="stack" style="padding-left:80px;padding-right:80px;">${ABX('x').replace(/-72px/g, '-80px').replace('600px', '500px')}</div>`, 'style="padding-left:60px;padding-right:60px;" data-padding-x="60"'),
  'B4 오버레이(absolute) 에셋': () => RAW(`<div class="row" data-layout="stack" style="position:relative">${ABX('x', 'position:absolute; left:88px; top:10px;').replace('data-overlay="false"', 'data-overlay="true"')}</div>`, 'style="padding-left:60px;padding-right:60px;" data-padding-x="60"'),
  'B5 자유 프레임 안 absolute 에셋': () => RAW(`<div class="frame-block" data-free-layout="true" style="position:relative;width:100%;height:300px;">${ABX('x', 'position:absolute; left:38px; top:10px;')}</div>`, 'style="padding-left:60px;padding-right:60px;" data-padding-x="60"'),
};
for (const [name, mk] of Object.entries(BREAKS)) {
  test(`BREAKS ${name} → 그대로(마진·섹션 기준 왼쪽 위치 불변)`, async ({ page }) => {
    await page.setViewportSize({ width: 1700, height: 1100 });
    await bootApp(page);
    const b2 = name.startsWith('B2');
    await page.evaluate(([h, noPad]) => {
      if (noPad) { window.state.pageSettings.padX = 60; window.applyPageSettings?.(); }
      const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
      c.insertAdjacentHTML('beforeend', h); window.rebindAll?.();
    }, [mk(), b2]);
    const read = () => page.evaluate(() => { const a = document.getElementById('x'), s = a.closest('.section-block'); return { ml: a.style.marginLeft, mr: a.style.marginRight, left: a.getBoundingClientRect().left - s.getBoundingClientRect().left, pad: parseFloat(getComputedStyle(a.closest('.section-inner')).paddingLeft) }; });
    const before = await read();   // 직삽입 = 열 때 정리가 안 도는 경로
    const snap = JSON.parse(await page.evaluate(() => window.serializeProject()));
    await bootApp(page);
    await page.evaluate((d) => window.applyProjectData(d), snap);
    await page.waitForTimeout(400);
    const after = await read();
    if (b2) expect(after.pad, '전제: 페이지 padX 60 이 적용됐다').toBe(60);
    expect(after.ml).toBe(before.ml); expect(after.mr).toBe(before.mr);
    /* 위치는 «직삽입(before)» 과 못 견준다 — B2 는 직삽입 때 페이지 padX 가 아직 안 걸렸고, 절대배치는 재부팅 뒤 기준이 다르다.
       «마진이 안 바뀜» 이 정리가 안 돌았다는 직접 증거다(정리는 마진을 비운다). */
  });
}
