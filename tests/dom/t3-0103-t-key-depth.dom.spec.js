/* t3-0103-t-key-depth — 현빈 t3-01·02·03(261109): T 키가 새 텍스트를 «어느 깊이»에 넣나. 진짜 클릭·진짜 키(page.mouse · page.keyboard).
 *   t3-01 섹션에 프레임을 «방금 추가»(툴바 Frame 추가) → T = 프레임 안이 아니라 그 프레임 «바로 아래»(다음 형제).
 *   t3-02 프레임을 «한 번 클릭»(오브젝트 선택 · 진입 아님) → T = 프레임 «바로 아래».
 *   t3-03 프레임 «여백 더블클릭»(진입) → T = 그 프레임 «안» 자식.
 *   각 장면 깊이 1(섹션의 프레임)·깊이 2(프레임 안 프레임) · 자유(free)·흐름(flow) · T 두 번(둘째 = 첫째 바로 다음, 같은 그릇).
 * 머리표: t3-01 d1·d2 = [새 것] e7d97f1ec(v0.9.10)에서 빨강 3/3(빈 새 프레임 «안»에 섬) · 나머지 8 = [회귀 지킴] 그 판에서 초록 3/3.
 * 기록: 각 장면이 `T3MEAS {...}` 한 줄을 찍는다(부모 · 프레임 안인가 · 앞 형제) — 계획서 표의 근거. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const KIND = {
  free: 'data-free-layout="true" style="position:relative;width:600px;height:320px;"',
  flow: 'data-full-width="true" style="width:600px;min-height:260px;"',
};
const KID = {
  free: (n) => `<div class="text-block" id="kid${n}" data-type="heading" style="position:absolute;left:20px;top:20px;width:260px;"><div class="tb-h2" contenteditable="false">자식</div></div>`,
  flow: (n) => `<div class="frame-block" id="kidTF${n}" data-text-frame="true" data-bg="transparent" style="background:transparent;width:100%;box-sizing:border-box;"><div class="text-block" id="kid${n}" data-type="heading"><div class="tb-h2" contenteditable="false">자식</div></div></div>`,
};
/* 깊이 1: 섹션 > row > FR · 깊이 2: 섹션 > row > P(자유) > FR(절대) */
function html(kind, depth) {
  const fr = (extra) => `<div class="frame-block" id="FR" ${KIND[kind].replace('style="', `style="${extra}`)}>${KID[kind](1)}</div>`;
  const body = depth === 1 ? fr('')
    : `<div class="frame-block" id="P" data-free-layout="true" style="position:relative;width:760px;height:520px;">${fr('position:absolute;left:20px;top:20px;')}</div>`;
  return `<div class="section-block" id="sH" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="inH">
    <div class="gap-block" data-type="gap" style="height:30px"></div><div class="row" id="rowF" data-layout="stack">${body}</div>
    <div class="gap-block" id="gAfter" data-type="gap" style="height:200px"></div></div></div>`;
}
async function setup(page, h, focus) {
  await page.setViewportSize({ width: 1600, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate(([h, focus]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', h); window.rebindAll?.(); window.deselectAll?.(); window.applyZoom?.(100); window._activeFrame = null;
    document.getElementById(focus).scrollIntoView({ block: 'center' });
  }, [h, focus]);
  await waitStableRect(page, '#' + focus);   // 배율 맞추기가 멎은 뒤 좌표를 잰다(안 멎으면 더블클릭이 빗나가 «진입 0»으로 보였다)
  return errs;
}
/* 프레임 «안» 빈 자리(자식 사각형 밖 · 오른쪽 아래 안쪽) — 덮개 때문에 elementFromPoint 는 바깥 프레임일 수 있어 기하로 고른다 */
const emptyPt = (page, id) => page.evaluate((id) => { const f = document.getElementById(id); const r = f.getBoundingClientRect();
  const kids = [...f.querySelectorAll('*')].map((k) => k.getBoundingClientRect()).filter((k) => k.width > 0);
  for (let y = Math.round(r.bottom - 40); y > r.top + 30; y -= 6) for (let x = Math.round(r.right - 60); x > r.left + 30; x -= 20)   // 모서리는 피한다 — 첫 클릭 뒤 크기 손잡이가 그 자리를 맞혀 더블클릭이 프레임 밖으로 갔다
    if (!kids.some((k) => x >= k.left && x <= k.right && y >= k.top && y <= k.bottom)) return [x, y];
  return null; }, id);
/* 새로 골라진 텍스트의 «단위»(그릇 바로 아래까지 올라간 것) */
const rec = (page, F) => page.evaluate((F) => {
  const tb = document.querySelector('#canvas .text-block.selected'); if (!tb) return null;
  let u = tb; while (u.parentElement && !u.parentElement.classList.contains('section-inner')
    && !(u.parentElement.classList.contains('frame-block') && !u.parentElement.dataset.textFrame)) u = u.parentElement;
  const f = document.getElementById(F);
  return { tb: tb.id, unit: u.id, parent: u.parentElement.id, inF: f.contains(tb), prev: u.previousElementSibling?.id || null };
}, F);
const state = (page, F) => page.evaluate((F) => ({ sel: document.getElementById(F)?.classList.contains('selected'), act: window._activeFrame?.id || null,
  ent: window._enteredFrame?.id || null, selKids: document.querySelectorAll(`[id="${F}"] .selected`).length }), F);
/* F 의 «단위»(row 안이면 row) — 바로 아래 = 이것의 다음 형제 */
const fUnit = (page, F) => page.evaluate((F) => { const f = document.getElementById(F); return f.parentElement.classList.contains('row') ? f.parentElement.id : f.id; }, F);

async function pressT(page, prevTb) {
  await page.keyboard.press('t'); await raf(page);
  await expect.poll(() => page.evaluate(() => document.querySelector('#canvas .text-block.selected')?.id || null), { message: 'T: 새 텍스트가 골라짐' }).not.toBe(prevTb);
}
/* 두 번 눌러 잰다 · want: 'below' | 'inside' */
async function measure(page, name, F, want, pre) {
  const fu = await fUnit(page, F);
  const host = await page.evaluate((F) => { const f = document.getElementById(F); const u = f.parentElement.classList.contains('row') ? f.parentElement : f; return u.parentElement.id; }, F);
  await pressT(page, null); const a = await rec(page, F);
  await pressT(page, a?.tb); const b = await rec(page, F);
  console.log('T3MEAS ' + JSON.stringify({ name, want, pre, fUnit: fu, host, t1: a, t2: b }));
  if (want === 'below') {
    expect(a, `${name} T1 = ${F} 바로 아래(${host} 안, ${fu} 다음) ${JSON.stringify(a)}`).toMatchObject({ inF: false, parent: host, prev: fu });
  } else {
    expect(a, `${name} T1 = ${F} 안 ${JSON.stringify(a)}`).toMatchObject({ inF: true, parent: F });
  }
  expect(b, `${name} T2 = T1 바로 다음 같은 그릇 ${JSON.stringify(b)}`).toMatchObject({ parent: a.parent, prev: a.unit });
}
const toolbarFrame = async (page) => {
  const fb = await page.evaluate(() => { const e = [...document.querySelectorAll('button[title]')].find((x) => x.title.includes('Frame 추가') && x.getBoundingClientRect().width > 0); const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  const before = await page.evaluate(() => [...document.querySelectorAll('#canvas .frame-block:not([data-text-frame])')].map((f) => f.id));
  await clickAt(page, fb[0], fb[1], { sel: 'button[title]' }, { label: 'Frame 추가' });
  await expect.poll(() => page.evaluate((b) => [...document.querySelectorAll('#canvas .frame-block:not([data-text-frame])')].find((f) => !b.includes(f.id))?.id || null, before), { message: '[전제] 새 프레임' }).not.toBeNull();
  return page.evaluate((b) => [...document.querySelectorAll('#canvas .frame-block:not([data-text-frame])')].find((f) => !b.includes(f.id)).id, before);
};

/* ── t3-01 방금 추가한 프레임 ── */
test('t3-01 d1 — 섹션 고름 → 툴바 Frame 추가 → T T = 새 프레임 바로 아래', async ({ page }) => {
  const errs = await setup(page, html('free', 1), 'rowF');
  await page.evaluate(() => { window.deselectAll(); window.selectSection(document.getElementById('sH')); });
  const F = await toolbarFrame(page);
  const pre = await state(page, F);
  expect(pre, '[전제] 새 프레임 골라짐').toMatchObject({ sel: true });
  await measure(page, 't3-01-d1', F, 'below', pre);
  expect(errs).toEqual([]);
});
test('t3-01 d2 — P 여백 더블클릭(진입) → 툴바 Frame 추가 → T T = 새 프레임 바로 아래(P 안)', async ({ page }) => {
  const errs = await setup(page, html('free', 2), 'P');
  const p = await page.evaluate(() => { const r = document.getElementById('P').getBoundingClientRect(); return [r.right - 20, r.bottom - 20]; });
  await page.mouse.dblclick(...p); await raf(page);
  await expect.poll(() => state(page, 'P'), { message: '[전제] P 진입' }).toMatchObject({ ent: 'P' });
  const F = await toolbarFrame(page);
  const pre = await state(page, F);
  expect(await page.evaluate((F) => document.getElementById(F).closest('#P') !== null, F), '[전제] 새 프레임이 P 안').toBe(true);
  await measure(page, 't3-01-d2', F, 'below', pre);
  expect(errs).toEqual([]);
});

/* ── t3-02 한 번 클릭 · t3-03 여백 더블클릭 ── */
for (const kind of ['free', 'flow']) {
  test(`t3-02 d1 ${kind} — FR 한 번 클릭 → T T = FR 바로 아래`, async ({ page }) => {
    const errs = await setup(page, html(kind, 1), 'FR');
    const p = await emptyPt(page, 'FR'); expect(p).toBeTruthy();
    await page.mouse.click(...p); await raf(page);
    await expect.poll(() => state(page, 'FR'), { message: '[전제] FR 오브젝트 선택' }).toMatchObject({ sel: true, selKids: 0, ent: null });
    await measure(page, `t3-02-d1-${kind}`, 'FR', 'below', await state(page, 'FR'));
    expect(errs).toEqual([]);
  });
  test(`t3-03 d1 ${kind} — FR 여백 더블클릭(진입) → T T = FR 안`, async ({ page }) => {
    const errs = await setup(page, html(kind, 1), 'FR');
    const p = await emptyPt(page, 'FR'); expect(p).toBeTruthy();
    await page.mouse.dblclick(...p); await raf(page);
    await expect.poll(() => state(page, 'FR'), { message: '[전제] FR 진입' }).toMatchObject({ ent: 'FR' });
    await measure(page, `t3-03-d1-${kind}`, 'FR', 'inside', await state(page, 'FR'));
    expect(errs).toEqual([]);
  });
  test(`t3-02 d2 ${kind} — P 안 FR 을 더블클릭(P 진입 + FR 오브젝트) → T T = FR 바로 아래(P 안)`, async ({ page }) => {
    const errs = await setup(page, html(kind, 2), 'P');
    const p = await emptyPt(page, 'FR'); expect(p).toBeTruthy();
    await page.mouse.dblclick(...p); await raf(page);
    await expect.poll(() => state(page, 'FR'), { message: '[전제] FR 오브젝트 선택(P 진입)' }).toMatchObject({ sel: true, selKids: 0 });
    await measure(page, `t3-02-d2-${kind}`, 'FR', 'below', await state(page, 'FR'));
    expect(errs).toEqual([]);
  });
  test(`t3-03 d2 ${kind} — P 안 FR 고른 뒤 FR 여백 더블클릭(FR 진입) → T T = FR 안`, async ({ page }) => {
    const errs = await setup(page, html(kind, 2), 'P');
    const p = await emptyPt(page, 'FR'); expect(p).toBeTruthy();
    await page.mouse.dblclick(...p); await raf(page);
    await expect.poll(() => state(page, 'FR'), { message: '[전제] FR 오브젝트 선택' }).toMatchObject({ sel: true, selKids: 0 });
    await page.mouse.dblclick(...p); await raf(page);
    await expect.poll(() => state(page, 'FR'), { message: '[전제] FR 진입' }).toMatchObject({ ent: 'FR' });
    await measure(page, `t3-03-d2-${kind}`, 'FR', 'inside', await state(page, 'FR'));
    expect(errs).toEqual([]);
  });
}

/* [대조] 같은 장면에서 G(갭)는 이미 «바로 아래»다 — G 는 addGapBlock({asSibling}) → frameSelectedAsObject(빈 프레임도 오브젝트) 길.
 *   T 만 addTextBlock 의 활성 프레임 갈래 → frameTakesInsert(빈 프레임 = 안쪽, H11 ⒜) 길이라 갈린다. */
test('t3-01 대조 G — 섹션 고름 → 툴바 Frame 추가 → G = 새 프레임 바로 아래', async ({ page }) => {
  const errs = await setup(page, html('free', 1), 'rowF');
  await page.evaluate(() => { window.deselectAll(); window.selectSection(document.getElementById('sH')); });
  const F = await toolbarFrame(page);
  const n0 = await page.evaluate(() => document.querySelectorAll('#canvas .gap-block').length);
  await page.keyboard.press('g'); await raf(page);
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('#canvas .gap-block').length)).toBe(n0 + 1);
  const r = await page.evaluate((F) => { const g = document.querySelector('#canvas .gap-block.selected') || [...document.querySelectorAll('#canvas .gap-block')].find((x) => !x.id || x.previousElementSibling?.id === F);
    return { inF: document.getElementById(F).contains(g), prev: g?.previousElementSibling?.id || null }; }, F);
  console.log('T3MEAS ' + JSON.stringify({ name: 't3-01-d1-G', F, r }));
  expect(r).toEqual({ inF: false, prev: F });
  expect(errs).toEqual([]);
});
