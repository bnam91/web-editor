/* frame-paste-grid-real.dom.spec.js — F2 (현빈 proj_1790917712926 · grd_ts0he_vvckure, 2026-10-03)
 * ★증상: 자유 프레임(764×216, 직계 absolute 그리드 · 폭 100%)의 그리드를 골라 ⌘C ⌘V → 붙은 그리드가 «화면 가운데»를 왼쪽 위 모서리로 써서
 *   프레임 밖으로 넘친다(Evaluator 실측 +382/+716 · +382/−22). 붙은 걸 끌면 프레임 밖으로 빠져 섹션 row 로 간다.
 *   원인 = pasteClipboard freeLayout 갈래가 _viewportCenterInContainerLocal 값을 «그대로» 왼쪽 위로 쓴다(블록 크기 절반을 안 빼고 · 클램프 없음).
 * ★픽스처 = 현빈 섹션의 «꼴»: 섹션(배경 #818181) 안에 같은 프레임(ss_… 764×216 · data-free-layout · padding 0 · margin 0 auto) 둘이 갭을 사이에 두고 쌓였고,
 *   각 프레임의 직계가 같은 그리드 블럭(data-cols 2열 0.67:1.33 · position:absolute;left:0;top:43px;width:100%;box-sizing:border-box · data-offset-x/y).
 *   ⛔실물 파일을 시험에 쓰지 않는다 — 속성·구조는 그대로, 글만 바꿨다.
 * ★재는 것: 사본이 «프레임 안»(left·top ≥ 0, 오른쪽·아래가 프레임을 안 넘는다 — 사본이 프레임보다 크면 0) · 원본과 «같은 자리에 안 겹친다» ·
 *   두 번 ⌘V 하면 서로 «다른 자리» · 사본 부모가 원본 프레임(섹션 row 로 안 샌다). 프레임이 화면 위쪽일 때·가운데일 때 둘 다.
 *   (⚠️216 높이 프레임에 ~90 높이 그리드 — 원본(43~133)과 «면적»이 안 겹치는 자리는 없다. 그래서 「겹침」은 «같은 좌표»로 정의한다.)
 * ★양성대조: GD1001_ROOT=<bf9161d0 체크아웃> → 프레임 안·다른 자리 시험이 빨강.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js --workers=2 frame-paste-grid-real */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const COLS = '[{&quot;width&quot;:0.67,&quot;lines&quot;:[{&quot;type&quot;:&quot;body&quot;,&quot;text&quot;:&quot;왼쪽 칸 글&quot;}]},{&quot;width&quot;:1.33,&quot;lines&quot;:[{&quot;type&quot;:&quot;body&quot;,&quot;text&quot;:&quot;오른쪽 칸 첫 줄&quot;},{&quot;type&quot;:&quot;gap&quot;,&quot;height&quot;:16},{&quot;type&quot;:&quot;body&quot;,&quot;text&quot;:&quot;&quot;}]}]';
const LINE = 'font-size:22px;font-weight:400;line-height:1.6;letter-spacing:0;text-align:left;color:#555555;white-space:pre-wrap;word-break:keep-all;';
const grid = (id) => `<div class="grid-block" id="${id}" data-type="grid" data-gap="24" data-valign="top" data-cols="${COLS}" style="width: 100%; box-sizing: border-box; position: absolute; left: 0px; top: 43px;" data-offset-x="0" data-offset-y="43"><div class="grd-inner" style="display:grid;grid-template-columns:0.67fr 1.33fr;grid-template-rows:auto;row-gap:24px;column-gap:24px;width:100%;">
    <div class="grd-cell" data-r="0" data-c="0" style="min-width:0;min-height:0;display:flex;flex-direction:column;justify-content:flex-start;"><div data-r="0" data-c="0" data-line="0" class="grd-line grd-body" style="${LINE}">왼쪽 칸 글</div></div><div class="grd-cell" data-r="0" data-c="1" style="min-width:0;min-height:0;display:flex;flex-direction:column;justify-content:flex-start;"><div data-r="0" data-c="1" data-line="0" class="grd-line grd-body" style="${LINE}">오른쪽 칸 첫 줄</div><div data-r="0" data-c="1" data-line="1" class="grd-gap" style="height:16px;"></div><div data-r="0" data-c="1" data-line="2" class="grd-line grd-body" style="${LINE}"></div></div>
  </div></div>`;
const frame = (id, gid) => `<div class="frame-block" id="${id}" data-bg="#ffffff" data-free-layout="true" data-width="764" data-height="216" data-pad-y="0" style="background: rgb(255, 255, 255); padding: 0px; width: 764px; max-width: 100%; margin: 0px auto; min-height: 216px; height: 216px;">${grid(gid)}</div>`;
const SEC = (n) => `<div class="section-block" id="secF2" data-section="6" data-name="Section 06" data-bg="#818181" style="background-image: none; background-color: rgb(129, 129, 129);"><div class="section-hitzone"></div><div class="section-inner" id="innF2" style="padding-left:0;padding-right:0;">
  <div class="gap-block" id="gTop" data-type="gap" style="height:${n}px;"></div>${frame('ssF2a', 'grdF2a')}<div class="gap-block" data-type="gap" id="gMid" style="height:40px;"></div>${frame('ssF2b', 'grdF2b')}<div class="gap-block" id="gBot" data-type="gap" style="height:600px;"></div>
</div></div>`;

async function setup(page, where) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate((h) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove()); c.insertAdjacentHTML('beforeend', h); window.rebindAll?.(); window.deselectAll?.(); }, SEC(800));
  await page.waitForTimeout(400);
  await page.evaluate((where) => {
    const wrap = document.getElementById('canvas-wrap'); const f = document.getElementById('ssF2a');
    f.scrollIntoView({ block: where === 'top' ? 'start' : 'center' });
    if (where === 'top') wrap.scrollTop += 0;
  }, where);
  await page.waitForTimeout(500);
  await page.evaluate(() => window.clearHistory?.());
  return errs;
}
async function pickGrid(page) {
  const fr = await page.evaluate(() => { const r = document.getElementById('ssF2a').getBoundingClientRect(); return [r.left + r.width * 0.5, r.top + 12]; });
  await page.mouse.click(fr[0], fr[1]);                       // 그리드 위(top 43 위쪽) 프레임 빈 자리 — 프레임 선택
  const g = await page.evaluate(() => { const r = document.getElementById('grdF2a').getBoundingClientRect(); return [r.left + r.width * 0.5, r.top + r.height * 0.5]; });
  await page.mouse.click(g[0], g[1]);
  await expect.poll(() => page.evaluate(() => document.getElementById('grdF2a').classList.contains('selected')), { timeout: 2000 }).toBe(true);
}
const press = async (page, k) => { await page.keyboard.press(k); await page.waitForTimeout(300); };
const state = (page) => page.evaluate(() => {
  const F = document.getElementById('ssF2a');
  const grids = [...document.querySelectorAll('#secF2 .grid-block')];
  const mine = grids.filter(g => g.parentElement === F);
  const b = (g) => ({ id: g.id, left: parseInt(g.style.left) || 0, top: parseInt(g.style.top) || 0, w: g.offsetWidth, h: g.offsetHeight });
  return { fw: F.clientWidth, fh: F.clientHeight, inFrame: mine.map(b), total: grids.length, stray: grids.filter(g => g.parentElement !== F && g.id !== 'grdF2b').length, rowsInInner: document.getElementById('innF2').children.length };
});
const inside = (g, fw, fh) => g.left >= 0 && g.top >= 0 && g.left + g.w <= fw + 1 && (g.top + g.h <= fh + 1 || g.top === 0);

for (const where of ['top', 'center']) {
  test(`P0-${where} 전제 — 그리드가 골라지고 원본은 프레임 직계 absolute(0,43)다`, async ({ page }) => {
    const errs = await setup(page, where);
    await pickGrid(page);
    const s = await state(page);
    expect(errs).toEqual([]);
    expect(s.inFrame.length).toBe(1);
    expect([s.inFrame[0].left, s.inFrame[0].top]).toEqual([0, 43]);
  });

  test(`P1-${where} ★그리드 ⌘C ⌘V → 사본이 «프레임 안»이고 원본 자리(0,43)와 «다르다»`, async ({ page }) => {
    const errs = await setup(page, where);
    await pickGrid(page);
    await press(page, 'Meta+c'); await press(page, 'Meta+v');
    const s = await state(page);
    expect(errs).toEqual([]);
    expect(s.inFrame.length, '사본이 프레임 직계로 안 붙었다').toBe(2);
    const copy = s.inFrame.find(g => g.id !== 'grdF2a');
    expect(inside(copy, s.fw, s.fh), `★사본이 프레임(${s.fw}×${s.fh}) 밖으로 넘친다: ${JSON.stringify(copy)}`).toBe(true);
    expect([copy.left, copy.top], '★사본이 원본과 «같은 좌표»에 겹쳤다').not.toEqual([0, 43]);
    expect(s.stray, '섹션 row 로 샌 그리드').toBe(0);
  });

  test(`P2-${where} ★⌘V 두 번 → 사본 둘이 서로 «다른 자리»이고 둘 다 프레임 안`, async ({ page }) => {
    const errs = await setup(page, where);
    await pickGrid(page);
    await press(page, 'Meta+c'); await press(page, 'Meta+v');
    // 붙인 뒤 선택은 사본 — 다시 ⌘V 가 같은 프레임으로 가도록 클립보드(sourceFrameId)는 그대로다
    await press(page, 'Meta+v');
    const s = await state(page);
    expect(errs).toEqual([]);
    expect(s.inFrame.length).toBe(3);
    const pos = s.inFrame.map(g => `${g.left},${g.top}`);
    expect(new Set(pos).size, `★세 그리드 중 같은 자리가 있다: ${pos.join(' | ')}`).toBe(3);
    for (const g of s.inFrame.filter(g => g.id !== 'grdF2a')) expect(inside(g, s.fw, s.fh), `프레임 밖: ${JSON.stringify(g)}`).toBe(true);
  });
}
