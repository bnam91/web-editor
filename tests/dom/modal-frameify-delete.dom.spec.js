/* modal-frameify-delete — M1 프레임화 «뒤» 지우기 (2026-10-04, 지디 E55 교훈: G19 「자식 고르고 Delete → 그리드 통째 삭제」)
 *   ⒜ 바뀐 줄(텍스트블럭) 고름 → Delete / Backspace = 그 줄만
 *   ⒝ 프레임 고름 → Delete = 프레임 + 줄 전부
 *   ⒞ 줄 글자 편집 중 ⌫ = 글자만(블럭은 산다)
 *   ⒟ 지운 뒤 ⌘Z 한 걸음 = 지운 것만 돌아온다
 *   ⒠ 누르기 직전 선택 목록을 로그로 남긴다([D-sel])
 * ★손짓은 실제 마우스·키(page.mouse / keyboard) — 함수 직접 호출 금지(지우기 경로가 키 처리기 안에 산다).
 * ⛔빨강이 나오면 «고치지 말고» 보고(태양 지시). ⛔앱 무접촉 — bootApp. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SEC = `<div class="section-block" id="sF" data-section="1" data-name="F"><div class="section-hitzone"></div><div class="section-inner" id="innerF" style="padding-left: 32px; padding-right: 32px;">
<div class="gap-block" data-type="gap" id="gTop" style="height:120px"></div>
<div class="gap-block" data-type="gap" id="gEnd" style="height:300px"></div></div></div>`;

/** 모달 → 프레임화 → 줄 둘 더함(본문 + 2 = 3줄). 돌려주는 것: { fid, rows:[tb id…] } */
async function setup(page, variant = 'plain') {
  await page.setViewportSize({ width: 1500, height: 1400 });
  const errs = await bootApp(page);
  const r = await page.evaluate(([h, variant]) => {
    window.applyZoom?.(100);
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', h); window.rebindAll?.(); window.deselectAll?.();
    const { row, block } = window.makeModalBlock({ variant, title: '제목', text: '첫 줄 본문' });
    document.getElementById('gTop').after(row); window.renderModalBlock(block); window.bindBlock?.(block);
    const f = window.frameifyModal(block);
    window.addTextBlock('body'); window.addTextBlock('body');
    window.deselectAll?.(); document.activeElement?.blur?.();
    window.clearHistory?.();
    return { fid: f.id, rows: [...f.querySelectorAll('.text-block')].map(t => t.id) };
  }, [SEC, variant]);
  await page.waitForTimeout(400);
  return { errs, ...r };
}
const selList = (page) => page.evaluate(() => [...document.querySelectorAll('#canvas .selected')].map(e => `${e.id || '-'}.${[...e.classList].filter(c => c !== 'selected').join('.')}`));
const state = (page, fid) => page.evaluate((fid) => { const f = document.getElementById(fid);
  return { frame: !!f, rows: f ? [...f.querySelectorAll('.text-block')].map(t => t.id) : [], gEnd: !!document.getElementById('gEnd'), gTop: !!document.getElementById('gTop'), sec: !!document.getElementById('sF') }; }, fid);
async function clickAt(page, sel, where = 'center') {
  const p = await page.evaluate(([sel, where]) => { const el = document.querySelector(sel); el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect();
    return where === 'corner' ? [r.right - 4, r.top + 4] : [r.left + Math.min(40, r.width / 2), r.top + r.height / 2]; }, [sel, where]);
  await page.mouse.click(p[0], p[1]);
  await page.waitForTimeout(150);
}
/** 줄 하나를 «고른다» — 프레임 밖에서 처음 누르면 프레임이 먼저 잡힐 수 있다(드릴인). 몇 번 눌렀는지 돌려준다. */
async function pickRow(page, id) {
  for (let n = 1; n <= 3; n++) {
    await clickAt(page, `#${id}`);
    if (await page.evaluate((id) => document.getElementById(id)?.classList.contains('selected'), id)) return n;
  }
  return -1;
}
const blurAll = (page) => page.evaluate(() => document.activeElement?.blur?.());

for (const key of ['Delete', 'Backspace']) {
  test(`⒜⒟ 줄(가운데) 고름 → ${key} = 그 줄만 · ⌘Z 한 걸음 = 그 줄만 돌아온다`, async ({ page }) => {
    const { errs, fid, rows } = await setup(page);
    const before = await state(page, fid);
    const clicks = await pickRow(page, rows[1]);
    const sel = await selList(page);
    console.log(`[D-sel ⒜ ${key}] clicks=${clicks}`, JSON.stringify(sel));
    expect(clicks, '★줄을 고르지 못했다').toBeGreaterThan(0);
    await blurAll(page);
    await page.keyboard.press(key); await page.waitForTimeout(200);
    const after = await state(page, fid);
    console.log(`[D-after ⒜ ${key}]`, JSON.stringify(after));
    expect(after.frame, '★프레임이 같이 지워졌다(E55 꼴)').toBe(true);
    expect(after.rows, '그 줄만 빠진다').toEqual(before.rows.filter(x => x !== rows[1]));
    expect([after.gTop, after.gEnd, after.sec]).toEqual([true, true, true]);
    await page.keyboard.press('Meta+z'); await page.waitForTimeout(200);
    const back = await state(page, fid);
    console.log(`[D-undo ⒜ ${key}]`, JSON.stringify(back));
    expect(back).toEqual(before);
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}

test('⒜ 본문 줄(프레임화가 만든 첫 줄) 고름 → Delete = 그 줄만', async ({ page }) => {
  const { fid, rows } = await setup(page);
  const before = await state(page, fid);
  const clicks = await pickRow(page, rows[0]);
  console.log('[D-sel ⒜ body] clicks=' + clicks, JSON.stringify(await selList(page)));
  await blurAll(page);
  await page.keyboard.press('Delete'); await page.waitForTimeout(200);
  const after = await state(page, fid);
  console.log('[D-after ⒜ body]', JSON.stringify(after));
  expect(after.frame).toBe(true);
  expect(after.rows).toEqual(before.rows.filter(x => x !== rows[0]));
});

test('⒝⒟ 프레임 고름 → Delete = 프레임 + 줄 전부 · ⌘Z 한 걸음 = 프레임·줄 그대로', async ({ page }) => {
  const { fid } = await setup(page, 'titled');
  const before = await state(page, fid);
  await clickAt(page, `#${fid}`, 'corner');
  const sel = await selList(page);
  console.log('[D-sel ⒝]', JSON.stringify(sel));
  expect(await page.evaluate((fid) => document.getElementById(fid).classList.contains('selected'), fid), '★프레임을 고르지 못했다').toBe(true);
  await blurAll(page);
  await page.keyboard.press('Delete'); await page.waitForTimeout(200);
  const after = await state(page, fid);
  console.log('[D-after ⒝]', JSON.stringify(after));
  expect(after.frame).toBe(false);
  expect(await page.evaluate((ids) => ids.filter(id => document.getElementById(id)).length, before.rows), '줄도 같이 사라진다').toBe(0);
  expect([after.gTop, after.gEnd, after.sec], '이웃·섹션은 산다').toEqual([true, true, true]);
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(200);
  expect(await state(page, fid)).toEqual(before);
});

test('⒞ 줄 글자 편집 중 ⌫ = 글자 하나만 · 블럭·프레임 그대로', async ({ page }) => {
  const { fid, rows } = await setup(page);
  const id = rows[0];
  const before = await state(page, fid);
  await pickRow(page, id);
  const p = await page.evaluate((id) => { const r = document.getElementById(id).querySelector('[class^="tb-"]').getBoundingClientRect(); return [r.left + 20, r.top + r.height / 2]; }, id);
  await page.mouse.dblclick(p[0], p[1]); await page.waitForTimeout(200);
  const editing = await page.evaluate((id) => ({ ed: document.getElementById(id).querySelector('[class^="tb-"]').getAttribute('contenteditable'), cls: document.getElementById(id).classList.contains('editing'), active: document.activeElement?.className }), id);
  console.log('[D-sel ⒞]', JSON.stringify({ editing, sel: await selList(page) }));
  expect(editing.ed, '★편집 모드에 못 들어갔다').toBe('true');
  /* 캐럿을 글 끝에 둔다 — ⚠️맥 크로미움은 End 가 캐럿을 안 옮긴다(첫 판: 더블클릭이 고른 「첫」이 그대로 지워져 " 줄 본문" — 그것도 «글자만»이었다).
     캐럿 놓기만 Selection API 로, 지우기는 «진짜 키»로. */
  await page.evaluate((id) => { const ce = document.getElementById(id).querySelector('[class^="tb-"]'); const r = document.createRange(); r.selectNodeContents(ce); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }, id);
  await page.keyboard.press('Backspace'); await page.waitForTimeout(150);
  const txt = await page.evaluate((id) => document.getElementById(id).querySelector('[class^="tb-"]').textContent, id);
  const after = await state(page, fid);
  console.log('[D-after ⒞]', JSON.stringify({ txt, after }));
  expect(txt).toBe('첫 줄 본');
  expect(after).toEqual(before);
});
