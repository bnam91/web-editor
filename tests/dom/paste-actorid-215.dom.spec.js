/* paste-actorid-215.dom.spec.js — 215 BINDPASTED-ISSUES-IDS-WITHOUT-ACTORID-01 (S3 · 261028)
 *
 * ★병: 공용 붙여넣기 문 _bindPastedEl(js/editor.js)이 id 를 `${prefix}_${rand()}` 로 다시 지어 actorId 조각을 뺐다
 *   (genId = prefix_<actorId>_<rand> · drag-utils.js). 소비자 10 자리(⌘C⌘V 흐름 · 섹션 복제 등)가 다 이 문을 지난다.
 * 재는 것: P1 ⌘C⌘V(섹션 흐름 = insertAfterSelected + _bindPastedEl 길) 붙여넣은 id 에 actorId · N 원본 id 그대로.
 *   ⚠️자유배치 프레임 안에서 붙이면 PASTE_FREE_FRAME 길(이미 genId · 216)로 가서 이 병을 못 본다 — 전제로 «프레임 밖» 을 단언.
 * ⛔고정 대기 0 · 키는 page.keyboard(실 키) · 고르기는 window.selectBlock(앱 문 · 클릭은 안 잼).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  const s = await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((x) => x.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" data-section="1" id="sF"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>');
    window.rebindAll?.(); window.applyZoom?.(100);
    window.deselectAll?.(); window.selectSection(document.getElementById('sF'));
    window.addQABlock();
    const q = document.querySelector('#sF .qa-block');
    return { id: q?.id ?? null, inFrame: !!q?.closest('.frame-block'), actor: window.getActorId?.() ?? null };
  });
  return { ...s, errs };
}

async function copyPaste(page, id) {
  await page.evaluate((i) => window.selectBlock(i), id);
  await expect.poll(() => page.evaluate((i) => document.getElementById(i)?.classList.contains('selected'), id), { message: '전제: 골라졌다' }).toBe(true);
  await page.keyboard.press('Meta+c');
  await page.keyboard.press('Meta+v');
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('#sF .qa-block').length), { message: '전제: 붙여넣기로 하나 늘었다' }).toBe(2);
  return page.evaluate((orig) => [...document.querySelectorAll('#sF .qa-block')].map((q) => ({ id: q.id, inFrame: !!q.closest('.frame-block') })), id);
}

test('P1 ★⌘C⌘V(섹션 흐름) 붙여넣은 id 에 actorId 조각', async ({ page }) => {
  const s = await scene(page);
  expect([!!s.id, s.inFrame, typeof s.actor === 'string' && s.actor.length > 0], '전제: 섹션 흐름 qa 하나 · actorId 있음').toEqual([true, false, true]);
  const all = await copyPaste(page, s.id);
  const pasted = all.filter((q) => q.id !== s.id);
  expect(pasted.length).toBe(1);
  expect(pasted[0].inFrame, '전제: 붙여넣은 것도 흐름(_bindPastedEl 길)').toBe(false);
  expect(pasted[0].id.includes(`_${s.actor}_`), `P1 붙여넣은 id «${pasted[0].id}» 에 actorId «${s.actor}»`).toBe(true);
  expect(s.errs).toEqual([]);
});

test('N (음성) 원본 id 는 그대로', async ({ page }) => {
  const s = await scene(page);
  expect(s.id).toBeTruthy();
  const all = await copyPaste(page, s.id);
  expect(all.map((q) => q.id)).toContain(s.id);
});
