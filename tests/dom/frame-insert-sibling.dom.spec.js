/* frame-insert-sibling.dom.spec.js — F1 (현빈 2026-10-03, 지디 결정): 프레임을 «마우스로 골라» 둔 채 ⌘V·g·⌘D 하면 «다음 형제»로 들어간다.
 * 키보드 입구(⌘V 일반·다중 폴백 · g→addGapBlock · ⌘D→duplicateSelected)만 — 패널 삽입(insertAfterSelected 기본·_insertToFlowFrame)은
 *   09-23 결정대로 «안»에 넣는 그대로다(frame-accepts-component-blocks F1 이 잠금 — 짝 시험). ⛔t 는 이 규칙에 넣지 않는다.
 * ★H11(2026-10-05): 09-23 결정 = 패널 삽입은 «안»(현빈 「그리드가 프레임에 안 들어간다」) → 10-05 재지시로 «밖»(현빈 「한 번 클릭 후에는 프레임 밖에 삽입되어야지」) · 까닭 = drill-in 이 09-23 의 요구를 대신 채운다.
 *   ⇒ 패널(툴바) 삽입도 이제 한 번 클릭이면 «다음 형제» — 판정 한 자리 drag-utils.js frameTakesInsert. 들어간 상태(프레임 → 자식 클릭)의 «안»은 h11-toolbar-depth 가 잠근다.
 * 실제 앱(bootApp) + 실제 마우스·키. 프레임은 «자유 프레임»과 «흐름 프레임» 둘 다 잰다.
 * ★양성대조: GD1001_ROOT=<bf9161d0 체크아웃> 으로 돌리면 S1·S2·S3·S5 가 빨강이어야 한다(S0·S4 는 지키는 시험 — 양쪽 초록).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js --workers=2 frame-insert-sibling */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const KINDS = {
  free: 'data-free-layout="true" data-width="600" data-height="300" style="position:relative;width:600px;height:300px;"',
  flow: 'data-full-width="true" style="width:600px;min-height:300px;"',
};
const CHILD = '<div class="text-block" id="kid" data-type="body" style="position:absolute;left:10px;top:10px;width:200px;"><div class="tb-body" contenteditable="false">자식</div></div>';
const FLOWCHILD = '<div class="gap-block" id="kid" data-type="gap" style="height:40px;"></div>';
const sec = (kind, extra = '') => `
<div class="section-block" id="sF1" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="inF1" style="padding-left:0;padding-right:0;">
  <div class="gap-block" id="gBefore" data-type="gap" style="height:30px;"></div>
  <div class="row" id="rowF" data-layout="stack"><div class="frame-block" id="FR" ${KINDS[kind]}>${kind === 'free' ? CHILD : FLOWCHILD}${extra}</div></div>
  <div class="gap-block" id="gAfter" data-type="gap" style="height:30px;"></div>
</div></div>`;

async function setup(page, kind, extra) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate((h) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', h); window.rebindAll?.(); window.deselectAll?.();
    document.getElementById('FR').scrollIntoView({ block: 'center' });
  }, sec(kind, extra));
  await page.waitForTimeout(400);
  await page.evaluate(() => window.clearHistory?.());
  return errs;
}
const rectOf = (page, id, fx, fy) => page.evaluate(([id, fx, fy]) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + r.width * fx, r.top + r.height * fy]; }, [id, fx, fy]);
async function pickFrame(page) {
  const [x, y] = await rectOf(page, 'FR', 0.85, 0.85);   // 자식이 없는 구석
  await page.mouse.click(x, y);
  await expect.poll(() => page.evaluate(() => document.getElementById('FR').classList.contains('selected')), { timeout: 2000 }).toBe(true);
}
const snap = (page) => page.evaluate(() => {
  const FR = document.getElementById('FR');
  const row = FR.parentElement;
  const nxt = row.nextElementSibling;
  return {
    frameKids: FR.children.length,
    sectionFrames: document.querySelectorAll('#sF1 .frame-block:not([data-text-frame])').length,
    nextIsNew: !!nxt && nxt.id !== 'gAfter',
    nextHasFrame: !!(nxt && (nxt.matches('.frame-block') || nxt.querySelector('.frame-block'))),
    gaps: document.querySelectorAll('#sF1 .gap-block').length,
    rowAfterAfter: row.nextElementSibling?.nextElementSibling?.id || null,
  };
});
const press = async (page, k) => { await page.keyboard.press(k); await page.waitForTimeout(250); };

for (const kind of ['free', 'flow']) {
  test(`S0-${kind} 전제 — 마우스로 프레임을 고르면 프레임만 선택돼 있다(자식은 아님)`, async ({ page }) => {
    const errs = await setup(page, kind);
    await pickFrame(page);
    const o = await page.evaluate(() => ({ sel: [...document.querySelectorAll('#sF1 .selected')].map(e => e.id).filter(Boolean), kid: document.getElementById('kid').classList.contains('selected') }));
    expect(errs).toEqual([]);
    expect(o.kid).toBe(false);
    expect(o.sel).toContain('FR');
  });

  test(`S1a-${kind} ★프레임을 고르고 ⌘C ⌘V → 사본이 원본 프레임의 «다음 형제», 원본 프레임 자식 수 그대로`, async ({ page }) => {
    const errs = await setup(page, kind);
    await pickFrame(page);
    const before = await snap(page);
    await press(page, 'Meta+c'); await press(page, 'Meta+v');
    const a = await snap(page);
    expect(errs).toEqual([]);
    expect(a.frameKids, '원본 프레임 안으로 들어갔다').toBe(before.frameKids);
    expect(a.sectionFrames, '프레임 중첩').toBe(2);
    expect(a.nextHasFrame, '사본이 원본 바로 다음 형제가 아니다').toBe(true);
    expect(a.rowAfterAfter).toBe('gAfter');
  });

  test(`S1b-${kind} ★갭을 복사해 두고 프레임을 골라 ⌘V → 갭이 프레임 «밖 다음 형제»`, async ({ page }) => {
    const errs = await setup(page, kind);
    const [gx, gy] = await rectOf(page, 'gBefore', 0.5, 0.5);
    await page.mouse.click(gx, gy);
    await press(page, 'Meta+c');
    await pickFrame(page);
    const before = await snap(page);
    await press(page, 'Meta+v');
    const a = await snap(page);
    expect(errs).toEqual([]);
    expect(a.frameKids, '프레임 안으로 들어갔다').toBe(before.frameKids);
    expect(a.gaps).toBe(before.gaps + 1);
    expect(a.nextIsNew).toBe(true);
  });

  test(`S2-${kind} ★프레임을 고르고 g → 갭이 프레임 «다음 형제», 프레임 자식 수 그대로`, async ({ page }) => {
    const errs = await setup(page, kind);
    await pickFrame(page);
    const before = await snap(page);
    await press(page, 'g');
    const a = await snap(page);
    expect(errs).toEqual([]);
    expect(a.frameKids, '프레임 안으로 들어갔다').toBe(before.frameKids);
    expect(a.gaps).toBe(before.gaps + 1);
    expect(a.nextIsNew).toBe(true);
    expect(a.rowAfterAfter).toBe('gAfter');
  });

  test(`S3-${kind} ★프레임을 고르고 ⌘D → 사본이 «다음 형제», 프레임 자식 수 그대로`, async ({ page }) => {
    const errs = await setup(page, kind);
    await pickFrame(page);
    const before = await snap(page);
    await press(page, 'Meta+d');
    const a = await snap(page);
    expect(errs).toEqual([]);
    expect(a.frameKids).toBe(before.frameKids);
    expect(a.sectionFrames).toBe(2);
    expect(a.nextHasFrame).toBe(true);
  });

  test(`S6-${kind} ⌘Z 한 걸음이면 g 이전으로 돌아온다(빈 칸 없음)`, async ({ page }) => {
    const errs = await setup(page, kind);
    await pickFrame(page);
    const before = await snap(page);
    await press(page, 'g');
    await page.evaluate(() => { window.deselectAll?.(); document.activeElement?.blur?.(); });
    await press(page, 'Meta+z');
    const a = await snap(page);
    expect(errs).toEqual([]);
    expect(a.gaps).toBe(before.gaps);
    expect(a.frameKids).toBe(before.frameKids);
  });
}

test('S4 자식을 고른 채 ⌘V 는 «안쪽» — 그 자식 뒤로 들어간다(정상, 양쪽 판 초록)', async ({ page }) => {
  const errs = await setup(page, 'flow');
  const [gx, gy] = await rectOf(page, 'gBefore', 0.5, 0.5);
  await page.mouse.click(gx, gy);
  await press(page, 'Meta+c');
  const [kx, ky] = await rectOf(page, 'kid', 0.5, 0.5);
  await page.mouse.click(kx, ky);   // 선택 안 된 프레임의 자식 — 프레임이 먼저 잡히면 한 번 더
  if (!(await page.evaluate(() => document.getElementById('kid').classList.contains('selected')))) await page.mouse.click(kx, ky);
  expect(await page.evaluate(() => document.getElementById('kid').classList.contains('selected'))).toBe(true);
  await press(page, 'Meta+v');
  const o = await page.evaluate(() => ({ kids: document.getElementById('FR').children.length, after: document.getElementById('kid').nextElementSibling?.classList.contains('gap-block') }));
  expect(errs).toEqual([]);
  expect(o.kids).toBe(2);
  expect(o.after).toBe(true);
});

test('S5 중첩 — 바깥 자유 프레임 안의 안쪽 프레임을 골라 g → 안쪽 프레임의 «다음 형제»(바깥 프레임 안, 좌표 absolute)', async ({ page }) => {
  const INNER = '<div class="frame-block" id="IN" data-free-layout="true" data-width="300" data-height="120" style="position:absolute;left:20px;top:150px;width:300px;height:120px;"><div class="text-block" id="ikid" data-type="body" style="position:absolute;left:5px;top:5px;width:100px;"><div class="tb-body" contenteditable="false">안쪽자식</div></div></div>';
  const errs = await setup(page, 'free', INNER);
  const [ox, oy] = await rectOf(page, 'FR', 0.9, 0.2);
  await page.mouse.click(ox, oy);                       // 바깥 프레임 먼저
  const [ix, iy] = await rectOf(page, 'IN', 0.9, 0.9);
  await page.mouse.click(ix, iy);                       // 그다음 안쪽 프레임
  await expect.poll(() => page.evaluate(() => document.getElementById('IN').classList.contains('selected')), { timeout: 2000 }).toBe(true);
  const before = await page.evaluate(() => ({ outer: document.getElementById('FR').children.length, inner: document.getElementById('IN').children.length }));
  await press(page, 'g');
  const a = await page.evaluate(() => {
    const IN = document.getElementById('IN'); const nx = IN.nextElementSibling;
    return { outer: document.getElementById('FR').children.length, inner: IN.children.length, nextIsGap: !!nx && (nx.classList.contains('gap-block') || !!nx.querySelector?.('.gap-block')),
      abs: !!nx && nx.style.position === 'absolute', inFR: !!nx && nx.parentElement === document.getElementById('FR') };
  });
  expect(errs).toEqual([]);
  expect(a.inner, '안쪽 프레임 안으로 들어갔다').toBe(before.inner);
  expect(a.outer).toBe(before.outer + 1);
  expect(a.nextIsGap).toBe(true);
  expect(a.inFR).toBe(true);
  expect(a.abs, '자유 프레임 직계인데 좌표(absolute)가 없다').toBe(true);
});

/* ★S7·S8 — 적대QA(2026-10-03)가 31e97078 에서 깬 것. 양성대조 판 = 31e97078 (빨강: S7 4건·S8 2건).
 * S7: 자유 프레임의 «절대배치» 자식(그리드·에셋)을 골라도 프레임에 .selected 가 남는다. isFlowAnchorBlock 은 absolute 를 빼서
 *     「프레임을 오브젝트로 골랐다」로 읽혔다 ⇒ g·⌘V 가 프레임 «밖»으로 샜다. 자식을 골랐으면 «안쪽»이다(bf9161d0 과 같다).
 * S8: 그룹(data-group)은 F1 범위 밖 — 그룹을 골라 g·⌘V 는 예전대로 그룹 «안». */
const ABS = {
  grid: '<div class="grid-block" id="kidX" data-type="grid" style="position:absolute;left:300px;top:20px;width:200px;height:60px;"></div>',
  asset: '<div class="asset-block" id="kidX" style="position:absolute;left:300px;top:20px;width:100px;height:80px;"></div>',
};
for (const kind of ['grid', 'asset']) for (const how of ['g', 'paste']) {
  test(`S7-${kind}-${how} ★절대배치 ${kind} 자식을 고른 채 ${how === 'g' ? 'g' : '갭 ⌘V'} → 프레임 «안»(밖 다음 형제 아님)`, async ({ page }) => {
    const errs = await setup(page, 'free', ABS[kind]);
    if (how === 'paste') { const [gx, gy] = await rectOf(page, 'gBefore', 0.5, 0.5); await page.mouse.click(gx, gy); await press(page, 'Meta+c'); }
    await pickFrame(page);
    const [kx, ky] = await rectOf(page, 'kidX', 0.5, 0.5);
    await page.mouse.click(kx, ky);
    expect(await page.evaluate(() => document.getElementById('kidX').classList.contains('selected')), '전제 — 자식이 골라졌다').toBe(true);
    const before = await snap(page);
    await press(page, how === 'g' ? 'g' : 'Meta+v');
    const a = await snap(page);
    expect(errs).toEqual([]);
    expect(a.frameKids, '프레임 «밖»으로 샜다').toBe(before.frameKids + 1);
    expect(a.gaps).toBe(before.gaps + 1);
  });
}
for (const how of ['g', 'paste']) {
  test(`S8-${how} 그룹(data-group)을 고른 채 ${how === 'g' ? 'g' : '갭 ⌘V'} → 예전대로 그룹 «안»`, async ({ page }) => {
    const errs = await setup(page, 'free');
    await page.evaluate(() => { document.getElementById('FR').dataset.group = 'true'; });
    if (how === 'paste') { const [gx, gy] = await rectOf(page, 'gBefore', 0.5, 0.5); await page.mouse.click(gx, gy); await press(page, 'Meta+c'); }
    await pickFrame(page);
    const before = await snap(page);
    await press(page, how === 'g' ? 'g' : 'Meta+v');
    const a = await snap(page);
    expect(errs).toEqual([]);
    expect(a.frameKids, '그룹 «밖»으로 나갔다').toBe(before.frameKids + 1);
  });
}
