/* scratch-del-mate-undo-155.dom.spec.js — 시트 155 `SCRATCH-GROUP-G-NOT-RESTORED-BY-UNDO-01`
 *
 * 증상(S6 탐침 P155b · 75ce69a1·8128a953 두 판 빨강): 2장 그룹에서 한 장을 ✕ → ⌘Z 하면
 *   지운 장은 g 를 들고 돌아오지만 ★남은 짝은 g 가 없다 — ✕ 가 1장 그룹을 풀고(`_dissolveLoneGroup` ⑧)
 *   ⌘Z 는 «지운 장»만 되살리고 «풀린 짝»은 안 되돌렸다.
 * 같은 꼴을 변환 길은 이미 닫았다(128 F1 ⒞ `groupMatesBefore` · fix5-f1-drop-group D3) — 지우기 길만 없었다.
 *
 * K1 양성 — 2장 그룹 ✕ 한 장 ⇒ 짝 풀림(전제) · ⌘Z 1 = 둘 다 같은 g(메모리·DOM·저장본)
 * K2 redo  — K1 뒤 ⌘⇧Z ⇒ 처음 ✕ 직후와 같다(짝 다시 풀림)
 * K3 음성 — 3장 그룹 ✕ 한 장 ⇒ 남은 둘 그대로 · ⌘Z 1 = 셋 다 같은 g(고치기 전부터 초록)
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const KEY = 'scratch-pad-pZ-pg1';

/** n장을 사람 길(클릭 · ⇧클릭 · 묶기)로 한 그룹에 넣는다 — ⛔g 를 손으로 주지 않는다. */
async function scene(page, n) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await bootApp(page);
  const ids = ['sp_a', 'sp_b', 'sp_c'].slice(0, n);
  await page.evaluate(async ({ px, ids }) => {
    window.applyZoom?.(100);
    window.__raw = (key) => new Promise((res, rej) => { const o = indexedDB.open('ScratchPadDB');
      o.onsuccess = () => { const q = o.result.transaction('scratch', 'readonly').objectStore('scratch').get(key);
        q.onsuccess = () => { res(q.result || []); o.result.close(); }; q.onerror = () => rej(q.error); }; o.onerror = () => rej(o.error); });
    await window.initScratchPad('pZ', 'pg1');
    let x = 1100;
    for (const id of ids) { await window._scratchAddAndSave(px, x, 120, 140, undefined, id); x += 170; }
  }, { px: PX, ids });
  await page.waitForFunction((k) => document.querySelectorAll('.scratch-item').length === k, n, { timeout: 15000 });
  for (let i = 0; i < ids.length; i++) {
    await page.locator(`.scratch-item[data-scratch-id="${ids[i]}"]`).click({ modifiers: i > 0 ? ['Shift'] : [] });
    await expect.poll(() => page.evaluate(() => document.querySelectorAll('.scratch-item.scratch-selected').length)).toBe(i + 1);
  }
  await page.evaluate(() => window._scratchGroupAndAlign?.());
  await page.mouse.click(300, 900);
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('.scratch-item.scratch-selected').length)).toBe(0);
  const g = await groups(page);
  expect(new Set(Object.values(g.mem)).size === 1 && !!Object.values(g.mem)[0], `전제 — ${n}장이 한 그룹: ${JSON.stringify(g)}`).toBe(true);
  return { ids, gid: Object.values(g.mem)[0] };
}
/** 세 출처의 g — 메모리(_scratchItemById) · DOM(data-scratch-group) · 저장본(IndexedDB). 없는 장은 키가 없다. */
const groups = (page) => page.evaluate(async (k) => {
  const ids = [...document.querySelectorAll('.scratch-item')].map((e) => e.dataset.scratchId);
  const disk = await window.__raw(k);
  const o = { mem: {}, dom: {}, disk: {} };
  for (const id of ids) {
    o.mem[id] = window._scratchItemById(id)?.g ?? null;
    o.dom[id] = document.querySelector(`.scratch-item[data-scratch-id="${id}"]`).dataset.scratchGroup ?? null;
  }
  for (const s of disk) o.disk[s.id] = s.g ?? null;
  return o;
}, KEY);
const all = (ids, v) => Object.fromEntries(ids.map((id) => [id, v]));
async function closeX(page, id) {
  const card = page.locator(`.scratch-item[data-scratch-id="${id}"]`);
  await card.hover();
  const btn = card.locator('.scratch-close');
  await expect(btn, `전제 — ${id} 에 ✕ 하나`).toHaveCount(1);
  const r = await btn.boundingBox();
  const hit = await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('.scratch-close'), [r.x + r.width / 2, r.y + r.height / 2]);
  expect(hit, `전제 — ${id} 의 ✕ 가 안 가렸다`).toBe(true);
  await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
  await expect.poll(() => page.evaluate(async ([k, id]) => !!(await window.__raw(k)).find((x) => x.id === id), [KEY, id]), { message: `${id} 가 저장본에서 빠졌다` }).toBe(false);
}
async function key(page, combo) {
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press(combo);
}

test('K1 ★2장 그룹 ✕ 한 장 → ⌘Z 1 = 지운 장·풀렸던 짝 둘 다 같은 g(메모리·DOM·저장본)', async ({ page }) => {
  const { ids, gid } = await scene(page, 2);
  await closeX(page, 'sp_b');
  const del = await groups(page);
  expect(del.mem, '전제 — ✕ 가 1장 그룹을 풀었다(⑧)').toEqual({ sp_a: null });
  await key(page, 'Meta+z');
  await expect.poll(() => groups(page), { message: '★⌘Z 1 = 둘 다 같은 g', timeout: 5000 })
    .toEqual({ mem: all(ids, gid), dom: all(ids, gid), disk: all(ids, gid) });
});

test('K2 redo — K1 뒤 ⌘⇧Z = 처음 ✕ 직후와 같다(짝 다시 풀림)', async ({ page }) => {
  const { ids, gid } = await scene(page, 2);
  await closeX(page, 'sp_b');
  await key(page, 'Meta+z');
  await expect.poll(() => groups(page).then((g) => g.mem), { timeout: 5000 }).toEqual(all(ids, gid));
  await key(page, 'Meta+Shift+z');
  await expect.poll(() => groups(page), { timeout: 5000 })
    .toEqual({ mem: { sp_a: null }, dom: { sp_a: null }, disk: { sp_a: null } });
});

test('K3 음성 — 3장 그룹 ✕ 한 장 ⇒ 남은 둘 그대로 · ⌘Z 1 = 셋 다 같은 g', async ({ page }) => {
  const { ids, gid } = await scene(page, 3);
  await closeX(page, 'sp_b');
  expect((await groups(page)).mem, '남은 둘은 풀리지 않는다').toEqual({ sp_a: gid, sp_c: gid });
  await key(page, 'Meta+z');
  await expect.poll(() => groups(page), { timeout: 5000 })
    .toEqual({ mem: all(ids, gid), dom: all(ids, gid), disk: all(ids, gid) });
});
