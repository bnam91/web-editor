/* paste-free-frame-bindpasted-216.dom.spec.js — 216 ⌘V 자유배치 프레임 갈래가 공용 _bindPastedEl 을 지나나 (S3 · 261028)
 *
 * ★병: pasteClipboard 의 자유배치 프레임 갈래(옛 bind-list:PASTE_FREE_FRAME)가 _bindPastedEl 의 «절반»만 베꼈다
 *   (genId id + _ALL bindBlock 손 명부 + 프레임) ⇒ 다시 그리기(rerenderTree) 가 빠져 qa 사본 풋터 ID 칩이 «원본 id» 를 보인다.
 * 재는 것: F1 ⌘C⌘V(자유배치 프레임 안) 붙여넣은 qa 칩 = 그 id(전제 = 그 갈래: 같은 프레임 · 절대 위치) · F2 붙여넣은 id 에 actorId(지킴 —
 *   옛 갈래도 genId) · N 원본 그대로.
 * ⛔고정 대기 0 · 키는 page.keyboard(실 키) · 고르기는 window.selectBlock(앱 문 · 클릭은 안 잼).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  const r = await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" data-section="1" id="sP"><div class="section-hitzone"></div><div class="section-inner">'
      + '<div class="frame-block" id="ss_p216" data-free-layout="true" style="position:relative;height:700px;width:100%"></div></div></div>');
    window.rebindAll?.(); window.applyZoom?.(100);
    window.deselectAll?.(); window.selectSection(document.getElementById('sP'));
    window.addQABlock();
    const q = document.querySelector('#sP .qa-block');
    if (!q) return { ok: false, why: 'qa 블럭 못 만듦' };
    const fr = document.getElementById('ss_p216');
    fr.appendChild(q); q.style.position = 'absolute'; q.style.left = '40px'; q.style.top = '60px';
    window.deselectAll?.();
    return { ok: true, id: q.id, actor: window.getActorId?.() ?? null };
  });
  return { ...r, errs };
}

const look = (page) => page.evaluate(() => [...document.querySelectorAll('#ss_p216 > .qa-block')].map((q) => ({
  id: q.id, pos: q.style.position, parent: q.parentElement?.id ?? null,
  chip: q.querySelector('.qa-id-chip')?.textContent ?? null, left: q.style.left, top: q.style.top,
})));

async function copyPaste(page, id) {
  await page.evaluate((i) => window.selectBlock(i), id);
  await expect.poll(() => page.evaluate((i) => document.getElementById(i)?.classList.contains('selected'), id), { message: '전제: 골라졌다' }).toBe(true);
  await page.keyboard.press('Meta+c');
  await page.keyboard.press('Meta+v');
  await expect.poll(async () => (await look(page)).length, { message: '전제: 같은 자유배치 프레임에 qa 둘(그 갈래)' }).toBe(2);
  return look(page);
}

test('F1 ★⌘V 자유배치 프레임 — 붙여넣은 qa 칩 = 그 id (다시 그려졌다)', async ({ page }) => {
  const s = await scene(page);
  expect(s.ok, s.why).toBe(true);
  const all = await copyPaste(page, s.id);
  const p = all.find((q) => q.id !== s.id);
  expect([p.parent, p.pos], '전제: 그 갈래(같은 프레임 · 절대 위치)').toEqual(['ss_p216', 'absolute']);
  expect(p.chip, 'F1 붙여넣은 칩 = 그 id(원본 id 가 남으면 다시 안 그려진 것)').toBe(p.id);
  expect(s.errs).toEqual([]);
});

test('F2 붙여넣은 id 에 actorId 조각 (지킴)', async ({ page }) => {
  const s = await scene(page);
  expect(s.ok, s.why).toBe(true);
  const p = (await copyPaste(page, s.id)).find((q) => q.id !== s.id);
  expect(p.id.includes(`_${s.actor}_`), `F2 «${p.id}» 에 actorId «${s.actor}»`).toBe(true);
});

test('N (음성) 원본은 그대로 — id · 칩 · 자리', async ({ page }) => {
  const s = await scene(page);
  expect(s.ok, s.why).toBe(true);
  const o = (await copyPaste(page, s.id)).find((q) => q.id === s.id);
  expect([o.id, o.chip, o.left, o.top]).toEqual([s.id, s.id, '40px', '60px']);
});
