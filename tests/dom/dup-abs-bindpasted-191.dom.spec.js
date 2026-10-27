/* dup-abs-bindpasted-191.dom.spec.js — 191 ⌘D 절대 위치 갈래가 공용 _bindPastedEl 을 지나나 (S3 · 261028)
 *
 * ★병: duplicateSelected 의 freeLayout 절대 갈래(옛 bind-list:DUP_ABS)가 _bindPastedEl 의 «절반»만 베꼈다
 *   (id 재발급 + bindBlock 손 명부 + chat 특례) ⇒ 다시 그리기(rerenderTree)·migrateGridIdentity·syncAutoGridWidth 가 빠졌다.
 *   보이는 증상 = qa 블럭 사본의 풋터 ID 칩이 «원본 id» 를 그대로 보인다(칩은 그릴 때의 block.id · 사본은 다시 안 그려짐).
 * ★id 꼴: _bindPastedEl 의 재발급은 215 커밋이 genId 로 바꿨다(지디 판정) ⇒ 이 갈래도 그 문을 지나 actorId 를 안 잃는다(K2).
 * 재는 것: K1 ⌘D 사본 칩 = 사본 id(전제 = 정상 갈래: 같은 프레임 · +20) · K2 ⌘D 사본 id 들에 actorId(옛 판도 genId 라 «안 잃음» 지킴 칸) ·
 *   (붙여넣기 id 의 actorId 는 215 의 paste-actorid-215.dom.spec.js 가 잰다)
 *   N 원본은 그대로(id·칩).
 * ⛔고정 대기 0 · 키는 page.keyboard(실 키) · 고르기는 window.selectBlock(앱 문 · 클릭 안 잼).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/* 섹션 하나 · freeLayout 프레임 하나 · 그 안 절대 위치 qa 블럭 하나 */
async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  const r = await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" data-section="1" id="sD"><div class="section-hitzone"></div><div class="section-inner">'
      + '<div class="frame-block" id="ss_d191" data-free-layout="true" style="position:relative;height:700px;width:100%"></div></div></div>');
    window.rebindAll?.(); window.applyZoom?.(100);
    window.deselectAll?.(); window.selectSection(document.getElementById('sD'));
    window.addQABlock();
    const q = document.querySelector('#sD .qa-block');
    if (!q) return { ok: false, why: 'qa 블럭 못 만듦' };
    const fr = document.getElementById('ss_d191');
    fr.appendChild(q); q.style.position = 'absolute'; q.style.left = '40px'; q.style.top = '60px';
    window.deselectAll?.();
    return { ok: true, id: q.id, actor: window.getActorId?.() ?? null };
  });
  return { ...r, errs };
}

const look = (page) => page.evaluate(() => [...document.querySelectorAll('#ss_d191 > .qa-block')].map((q) => ({
  id: q.id, left: q.style.left, top: q.style.top, parent: q.parentElement?.id ?? null,
  chip: q.querySelector('.qa-id-chip')?.textContent ?? null,
  innerIds: [...q.querySelectorAll('[id]')].map((e) => e.id),
})));

/* 고르기 = 앱의 고르기 문(window.selectBlock · block-edit.js — insert-select·MCP 가 쓰는 길). 첫 판 «실 클릭(+8,+8)»은 4/4 전제 빨강(골라지지 않음)이라 바꿈.
   ⚠️그래서 «클릭으로 고르기»는 이 spec 이 안 잰다 · 키(⌘D·⌘C·⌘V)는 실 키 그대로. */
async function selectQa(page, id) {
  await page.evaluate((i) => window.selectBlock(i), id);
  await expect.poll(() => page.evaluate((i) => document.getElementById(i)?.classList.contains('selected'), id), { message: '전제: qa 블럭이 골라졌다' }).toBe(true);
}

test('K1 ★⌘D 절대 사본의 qa 풋터 ID 칩 = 사본 id (다시 그려졌다)', async ({ page }) => {
  const s = await scene(page);
  expect(s.ok, s.why).toBe(true);
  await selectQa(page, s.id);
  await page.keyboard.press('Meta+d');
  await expect.poll(async () => (await look(page)).length, { message: '전제: 같은 프레임에 qa 둘' }).toBe(2);
  const [o, d] = await look(page);
  expect(o.id, '전제: 앞 = 원본').toBe(s.id);
  expect([d.parent, d.left, d.top], '전제: 정상 갈래(같은 프레임 · +20)').toEqual(['ss_d191', '60px', '80px']);
  expect(d.id, '사본 id 는 새것').not.toBe(o.id);
  expect(d.chip, 'K1 사본 칩 = 사본 id(원본 id 가 남으면 다시 안 그려진 것)').toBe(d.id);
  expect(s.errs).toEqual([]);
});

test('K2 ★⌘D 절대 사본의 id 들에 actorId 조각 (genId)', async ({ page }) => {
  const s = await scene(page);
  expect(s.ok, s.why).toBe(true);
  expect(typeof s.actor === 'string' && s.actor.length > 0, '전제: actorId 있음').toBe(true);
  await selectQa(page, s.id);
  await page.keyboard.press('Meta+d');
  await expect.poll(async () => (await look(page)).length).toBe(2);
  const d = (await look(page))[1];
  const ids = [d.id, ...d.innerIds];
  expect(ids.filter((i) => !i.includes(`_${s.actor}_`)), 'K2 actorId 없는 id').toEqual([]);
});

test('N (음성) 원본은 그대로 — id · 칩 · 자리', async ({ page }) => {
  const s = await scene(page);
  expect(s.ok, s.why).toBe(true);
  await selectQa(page, s.id);
  await page.keyboard.press('Meta+d');
  await expect.poll(async () => (await look(page)).length).toBe(2);
  const o = (await look(page))[0];
  expect([o.id, o.chip, o.left, o.top]).toEqual([s.id, s.id, '40px', '60px']);
});
