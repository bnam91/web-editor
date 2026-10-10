/* scratch-cut-paste-group.dom.spec.js — ★⌘X 로 잘라내 ★그룹 밖에 붙여넣기 (현빈 2026-10-10)
 *
 * 현빈 원문: 「★그룹 안에서 ★특정 스크래치 패드를 ★★커맨드 x로 ★잘라내기를 한뒤 ★★그룹 밖으로
 *   ★붙여넣기를 하면 ★★기존의 그룹에서 ★빠질 수 있게해줘. ★★삭제하지않고 ★그룹에서 ★빼는 방법이야.
 *   ★★이미그렇게 되어있나?」
 *
 * ★★이 파일이 재는 것 = ★★«이미 되어 있나»다. ⛔고치는 파일이 ★아니다(먼저 ★재고 ★올린다).
 *
 * ★★⛔«안 재는 것»을 먼저 적는다:
 *   ⒜ ★★OS 클립보드 ★왕복은 ★안 잰다 — 제품은 `window.electronAPI.clipboardWriteImage` 로 간다(:1634).
 *      ★이 하네스엔 Electron 이 ★없으므로 ★그 함수를 ★★세워 둔다(production 과 ★같은 갈래를 타게).
 *      ⇒ ★★«클립보드에 ★참으로 담기나»는 ★이 파일이 ★★못 잰다.
 *   ⒝ ★붙여넣기도 ★합성 `ClipboardEvent` 로 ★민다 — ★⌘V 키가 ★OS 클립보드를 ★읽는 구간은 ★안 잰다.
 *   ⇒ ★그래서 ★★잰 것은 ★★«제품의 ★두 입구»(`scratchCutSelected` ＋ `paste` 리스너)의 ★동작이다.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function clickItem(page, id, { shift = false, dbl = false } = {}) {
  const el = page.locator('.scratch-item[data-scratch-id="' + id + '"]');
  if (dbl) await el.dblclick({ modifiers: shift ? ['Shift'] : [] });
  else await el.click({ modifiers: shift ? ['Shift'] : [] });
  await page.waitForTimeout(140);
}
/** ★n장을 ★사람이 하는 길로 ★묶는다(⛔g 를 손으로 주지 않는다). */
async function scene(page, n) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await bootApp(page);
  const ids = ['sp_a', 'sp_b', 'sp_c'].slice(0, n);
  await page.evaluate(async ({ px, ids }) => {
    window.applyZoom?.(100);
    /* ★production 갈래를 타게 — 제품은 Electron 쪽으로 간다(navigator.clipboard 아님) */
    window.electronAPI = window.electronAPI || {};
    window.__clipCalls = 0;
    window.electronAPI.clipboardWriteImage = async () => { window.__clipCalls += 1; return { ok: true }; };
    let x = 1100;
    for (const id of ids) { await window._scratchAddAndSave(px, x, 120, 140, undefined, id); x += 170; }
  }, { px: PX, ids });
  await page.waitForFunction((k) => document.querySelectorAll('.scratch-item').length === k, n, { timeout: 15000 });
  for (let i = 0; i < ids.length; i++) await clickItem(page, ids[i], { shift: i > 0 });
  await page.evaluate(() => window._scratchGroupAndAlign?.());
  await page.mouse.click(300, 900); await page.waitForTimeout(150);
  return ids;
}
const snap = (page) => page.evaluate(() => ({
  pads: document.querySelectorAll('.scratch-item').length,
  ids: [...document.querySelectorAll('.scratch-item')].map((e) => e.dataset.scratchId),
  groups: [...document.querySelectorAll('.scratch-item')].map((e) => e.dataset.scratchGroup ?? null),
  mode: window._scratchGroupMode?.() ?? null,
  clip: window.__clipCalls,
}));
/** ★합성 붙여넣기 — `paste` 리스너가 ★읽는 꼴(`clipboardData.items` 중 image/*)로 ★민다. */
async function pasteImage(page) {
  const before = await page.evaluate(() => document.querySelectorAll('.scratch-item').length);
  await page.evaluate(async (px) => {
    /* ⛔`fetch(data:…)` 는 ★file:// origin 에서 ★막힌다 — ★실측 `TypeError: Failed to fetch`.
       ⇒ ★base64 를 ★손으로 풀어 Blob 을 만든다(★하네스 흠이었다 · ★제품 흠이 ★아니다). */
    const b64 = px.split(',')[1];
    const bin = atob(b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) u8[i] = bin.charCodeAt(i);
    const blob = new Blob([u8], { type: 'image/png' });
    const dt = new DataTransfer();
    dt.items.add(new File([blob], 'p.png', { type: 'image/png' }));
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, PX);
  await page.waitForFunction((n) => document.querySelectorAll('.scratch-item').length > n, before, { timeout: 6000 })
    .catch(() => {});
  await page.waitForTimeout(250);
  return before;
}
async function cutSelected(page) {
  /* ★제품은 복사 실패를 ★`console.error` ＋ 토스트로만 적고 ★조용히 ★안 지운다(:1655).
     ⇒ ★★그 줄을 ★잡아야 ★«제품이 안 지웠다»와 ★«하네스가 못 돌렸다»를 ★가른다. */
  const logs = [];
  const onMsg = (m) => { if (m.type() === 'error' || m.text().includes('ScratchPad')) logs.push(m.text()); };
  page.on('console', onMsg);
  /* ★★하네스가 ★제 `electronAPI` 를 ★★«나중에» 깐다 — ★실측: scene 에서 세운 내 stub 이 ★덮였다
     (`clipCalls=0` 인데 제품은 `:1636 clipboard write failed` 로 ★던졌다 = ★★남의 stub 이 ★불렸다).
     ⇒ ★★부르기 ★직전에 ★다시 세우고 ★★«세워졌나»를 ★읽어서 ★확인한다(⛔세운 것으로 ★믿지 않는다). */
  const stubOk = await page.evaluate(() => {
    /* ★★하네스는 `electronAPI` 를 ★★Proxy 로 깐다(`_root-harness.js:45`) — ★`get` 트랩이 ★★모든 키에
       ★«null 을 돌려주는 함수»를 ★내준다 ⇒ ★★속성을 ★넣어도 ★읽히지 ★않는다(★그래서 clipCalls 가 0 이었다).
       ⇒ ★★Proxy 를 ★★통째로 ★갈아 끼운다 — ★내 키만 ★내주고 ★나머지는 ★하네스 꼴(null)을 ★그대로 ★유지한다.
       ⚠️★이것은 ★★하네스 한계를 ★★일부러 ★비킨 것이다(그 파일 :40 이 「이 하네스로 ★못 재는 축」이라 적어 뒀다).
          ⇒ ★★그래서 ★«OS 클립보드에 ★참으로 담기나»는 ★★여전히 ★안 잰다. ★그 줄은 ★머리말에도 적었다. */
    window.__clipCalls = 0;
    const nullFn = () => Promise.resolve(null);
    const f = async () => { window.__clipCalls += 1; return { ok: true }; };
    f.__stub = true;
    window.electronAPI = new Proxy({ clipboardWriteImage: f },
      { get: (t, k) => (k in t ? t[k] : nullFn) });
    return window.electronAPI.clipboardWriteImage.__stub === true;
  });
  expect(stubOk, '★★전제 — 클립보드 stub 이 ★참으로 섰다(⛔안 서면 cut 이 ★제품 흠 아닌 까닭으로 멈춘다)').toBe(true);
  const before = await page.evaluate(() => document.querySelectorAll('.scratch-item').length);
  const ret = await page.evaluate(() => window.scratchCutSelected?.());
  await page.waitForFunction((n) => document.querySelectorAll('.scratch-item').length < n, before, { timeout: 6000 })
    .catch(() => {});
  await page.waitForTimeout(250);
  page.off('console', onMsg);
  const clip = await page.evaluate(() => window.__clipCalls);
  if (logs.length) console.log('[cut 콘솔] ' + JSON.stringify(logs.slice(0, 4)));
  console.log('[cut] ret=' + ret + ' clipCalls=' + clip + ' 장수 ' + before
    + '→' + (await page.evaluate(() => document.querySelectorAll('.scratch-item').length)));
  return { ret, before, clip, logs };
}

test('C0 전제 ＋ ★양성대조 — ⌘X 입구가 있고 ★합성 붙여넣기가 ★참으로 장을 만든다', async ({ page }) => {
  await scene(page, 3);
  const s0 = await snap(page);
  expect(s0.pads, '전제 — 3장').toBe(3);
  expect(new Set(s0.groups).size, '전제 — 한 그룹').toBe(1);
  expect(s0.groups[0], '전제 — 그룹 id 가 있다').toBeTruthy();
  expect(await page.evaluate(() => typeof window.scratchCutSelected), '전제 — ⌘X 입구').toBe('function');
  /* ★양성대조 — ★이 합성 paste 가 ★먹지 않으면 ★아래 칸들이 ★전부 헛돈다 */
  await pasteImage(page);
  const s1 = await snap(page);
  console.log('[C0] ' + JSON.stringify(s1));
  expect(s1.pads, '★★양성대조 — 합성 붙여넣기로 장이 ★늘었다(★이게 3 이면 자가 눈이 먼 것이다)').toBe(4);
});

test('C1 ★★현빈 물음 — 진입→한 장 ⌘X→붙여넣기: ★새 장은 ★그룹 밖이고 ★남은 둘은 ★그대로인가', async ({ page }) => {
  const ids = await scene(page, 3);
  await clickItem(page, ids[2], { dbl: true });
  expect((await snap(page)).mode, '전제 — 진입').toBeTruthy();
  const gid = (await snap(page)).groups[0];
  const { ret } = await cutSelected(page);
  const mid = await snap(page);
  console.log('[C1 cut] ret=' + ret + ' ' + JSON.stringify(mid));
  await pasteImage(page);
  const end = await snap(page);
  console.log('[C1 paste] ' + JSON.stringify(end));
  const pasted = await page.evaluate((known) => [...document.querySelectorAll('.scratch-item')]
    .filter((e) => !known.includes(e.dataset.scratchId))
    .map((e) => ({ id: e.dataset.scratchId, g: e.dataset.scratchGroup ?? null })), ids);
  console.log('[C1 새 장] ' + JSON.stringify(pasted));
  expect(pasted.length, '★붙여넣은 장이 ★하나 생겼다').toBe(1);
  expect(pasted[0].g, '★★단언⑴ — ★붙여넣은 장은 ★그룹에 ★안 든다').toBeNull();
  const remain = end.groups.filter((g) => g === gid).length;
  expect(remain, `★★단언⑵ — ★남은 ★2장이 ★여전히 ★같은 그룹(${gid})이다`).toBe(2);
});

test('C2 ★★«삭제하지 않고»인가 — ★원본이 ★사라지고 ★새것이 ★생기나(★id 로 잰다)', async ({ page }) => {
  const ids = await scene(page, 3);
  await clickItem(page, ids[2], { dbl: true });
  await cutSelected(page);
  const after = await snap(page);
  console.log('[C2] 자른 뒤 ' + JSON.stringify(after));
  /* ★★현빈 요구의 핵 = 「★삭제하지않고 ★그룹에서 ★빼는 방법」.
     ⇒ ★★그런데 ★구현은 ★★«지우고 ★새로 만든다»다. ★그 차이를 ★★수로 적는다(⛔판정은 현빈 몫). */
  expect(after.ids.includes(ids[2]), `★★원본 id(${ids[2]})가 ★사라졌나 — ★«지우고 새로 만든다»면 true`)
    .toBe(false);
  await pasteImage(page);
  const end = await snap(page);
  expect(end.ids.includes(ids[2]), '★★그 id 가 ★돌아오지 ★않는다 — ★새 id 로 생긴다').toBe(false);
  console.log('[C2 끝] ' + JSON.stringify(end));
});

test('C3 ★★흠㉠ — ★두 장을 골라 ⌘X 하면 ★첫 장만 잘린다(★나머지는 그대로)', async ({ page }) => {
  const ids = await scene(page, 3);
  await clickItem(page, ids[0]);
  await clickItem(page, ids[1], { shift: true });
  const sel = await page.evaluate(() => document.querySelectorAll('.scratch-item.scratch-selected').length);
  console.log('[C3] 고른 수=' + sel);
  const { before } = await cutSelected(page);
  const after = await snap(page);
  console.log('[C3] ' + before + ' → ' + after.pads + ' ' + JSON.stringify(after.ids));
  expect(before - after.pads, `★몇 장이 ★잘렸나 — ★고른 ${sel}장 중`).toBe(1);
});

test('C4 ★★흠㉡ — ★잘라내고 붙여넣으면 ★무엇을 ★잃나(★dataset 키 전수)', async ({ page }) => {
  const ids = await scene(page, 3);
  const beforeKeys = await page.evaluate((id) => {
    const e = document.querySelector('.scratch-item[data-scratch-id="' + id + '"]');
    return { keys: Object.keys(e.dataset).sort(), w: e.offsetWidth };
  }, ids[2]);
  await clickItem(page, ids[2], { dbl: true });
  await cutSelected(page);
  await pasteImage(page);
  const afterKeys = await page.evaluate((known) => {
    const e = [...document.querySelectorAll('.scratch-item')].find((x) => !known.includes(x.dataset.scratchId));
    return e ? { keys: Object.keys(e.dataset).sort(), w: e.offsetWidth } : null;
  }, ids);
  console.log('[C4] 전=' + JSON.stringify(beforeKeys) + ' 후=' + JSON.stringify(afterKeys));
  expect(afterKeys, '★붙여넣은 장을 찾았다').not.toBeNull();
  const lost = beforeKeys.keys.filter((k) => !afterKeys.keys.includes(k));
  const gained = afterKeys.keys.filter((k) => !beforeKeys.keys.includes(k));
  console.log('[C4] ★잃은 키=' + JSON.stringify(lost) + ' ★얻은 키=' + JSON.stringify(gained)
    + ' ★폭 ' + beforeKeys.w + '→' + afterKeys.w);
  /* ⛔여기서 ★무엇을 잃어야 ★옳은지는 ★안 박는다 — ★★잰 값을 ★올린다.
     ★단 ★폭은 ★제품이 ★보존한다고 ★적어 뒀다(:1484 `_scratchCopiedMeta.w`) ⇒ ★그것만 ★잠근다. */
  expect(afterKeys.w, `★표시 폭은 ★보존한다(제품 주석 :1484) — 전 ${beforeKeys.w} 후 ${afterKeys.w}`)
    .toBe(beforeKeys.w);
});

test('C5 ★★⑧ 과 ⌘X — ★2장 그룹에서 ★한 장 ⌘X 하면 ★그룹이 ★자동으로 풀리나', async ({ page }) => {
  const ids = await scene(page, 2);
  const gid = (await snap(page)).groups[0];
  expect(gid, '전제 — 2장이 한 그룹').toBeTruthy();
  await clickItem(page, ids[1], { dbl: true });
  await cutSelected(page);
  const end = await snap(page);
  console.log('[C5] ' + JSON.stringify(end));
  expect(end.pads, '★한 장만 남았다').toBe(1);
  /* ★★⊘ 길(_detachFromGroup)은 ★1장 남으면 ★푼다. ★★⌘X 길은 ★★«다른 함수»(_deleteScratchItemsWithHistory)다.
     ⇒ ★★두 길이 ★같이 서야 한다(지디 ⒞). ★★이 칸이 ★그 둘을 ★견준다. */
  expect(end.groups[0], '★★남은 1장의 ★그룹이 ★풀렸나 — ★⊘ 길과 ★같이 서야 한다').toBeNull();
});

test('C6 ★★⊘ 길 대조 — ★2장에서 ★한 장 빼면 ★풀린다(★같은 상황 · ★다른 길)', async ({ page }) => {
  const ids = await scene(page, 2);
  await clickItem(page, ids[1], { dbl: true });
  const r = await page.evaluate((id) => {
    const btn = document.querySelector('.scratch-item[data-scratch-id="' + id + '"] .scratch-close');
    btn.click(); return true;
  }, ids[1]);
  await page.waitForTimeout(300);
  const end = await snap(page);
  console.log('[C6] ' + r + ' ' + JSON.stringify(end));
  expect(end.pads, '★장은 ★안 지워진다(빼기다)').toBe(2);
  expect(end.groups.filter((g) => g === null).length, '★★둘 다 ★그룹이 ★풀렸다(1장 그룹은 무의미)').toBe(2);
});

test('C7 ★★음성대조 — ★3장에서 ★한 장 빼면 ★★안 풀린다(2장 그룹이 남는다)', async ({ page }) => {
  const ids = await scene(page, 3);
  const gid = (await snap(page)).groups[0];
  await clickItem(page, ids[2], { dbl: true });
  await page.evaluate((id) => document.querySelector('.scratch-item[data-scratch-id="' + id + '"] .scratch-close').click(), ids[2]);
  await page.waitForTimeout(300);
  const end = await snap(page);
  console.log('[C7] ' + JSON.stringify(end));
  expect(end.pads, '★장 수 무변 — ★빼기지 ★지우기가 아니다').toBe(3);
  expect(end.groups.filter((g) => g === gid).length, `★★2장은 ★여전히 ★그룹(${gid}) — ★안 풀렸다`).toBe(2);
  expect(end.groups.filter((g) => g === null).length, '★빠진 ★한 장만 ★그룹 밖').toBe(1);
});
