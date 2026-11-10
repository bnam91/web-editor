/* removebg-scratch-target.dom.spec.js — REMOVEBG-SCRATCH-SELECTION-NEVER-TARGETED-01 (t2-11 실앱 실측에서 나옴 · 지디 261110)
 *   옛: js/removebg-plugin.js _pickTarget 이 `.scratch-item.selected` 와 `el.id` 를 찾았다 — 스크래치 고르기 표식은
 *       `.scratch-selected` + `data-scratch-id`(scratch-pad.js) 라 스크래치 그림은 «영영» 대상이 안 됐다 →
 *       «❌ 배경을 지울 이미지를 먼저 선택하세요» · 전송 0 (실앱 9440 실측 · handoff/t211-261110/05-scratch.png).
 *   새: 스크래치 쪽 다른 파일(scratch-ocr.js:225 · scratchpad-link.js:1213)이 읽는 꼴 그대로 — `.scratch-item.scratch-selected` + dataset.scratchId → _scratchGetItemById.
 *   S1 스크래치 그림을 «진짜 클릭»으로 고름 → 플러그인 → remove.bg → 전송 0→1(PNG b64) · 결과가 «같은 id» 스크래치 항목에 들어감
 *   S2 ⌘Z 한 번 = 원래 그림 · 같은 id
 *   S3 [음성] 아무것도 안 고름 → «먼저 선택» 안내 · 전송 0
 *   S4 [대조] 이미지 블럭과 스크래치를 같이 골랐으면 이미지 블럭이 먼저(옛 순서 그대로) · 스크래치 무변
 *   S5 적대 리뷰 — 그룹·순서·선택·효과 표식이 그대로(그림만 바뀜) · ⌘Z 도 그 자리에서(옛 판은 지우고 다시 넣어 그룹이 풀리고 맨 위로 갔다)
 *   S6 적대 리뷰 2 — 그룹 둘째를 클릭(그룹 클릭 = 둘 다 고름) → 안 보냄 · «하나만 골라 주세요» · 둘 다 무변(OCR 의 «하나일 때만» 규칙과 같게)
 *   S7 적대 리뷰 2 — 보내는 사이 그 항목이 지워짐 → «완료» 아님 · «사라졌습니다» · 이력 안 쌓음
 *   ★모의: electronAPI.removebgCutout(=main 의 fetch 앞 IPC 문)를 세는 가짜 — 실제 키·remove.bg 호출 0.
 * ★양성대조(지디 인텔): js/removebg-plugin.js _pickTarget 의 `'.scratch-item.scratch-selected'` 를 옛 `'.scratch-item.selected'` 로 → S1·S2 빨강 · S3·S4 초록. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/* 원본 = 빨간 칸 하나 든 64×64 PNG(캔버스로 만든다) · 결과 = 1×1 PNG */
const OUT_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const OUT_B64 = OUT_PNG.split(',')[1];
const SID = 'sp_rbs1';

async function setup(page, { withAsset = false } = {}) {
  await page.addInitScript((OUT_B64) => {
    window.__cuts = [];
    const fake = {
      hasApiKey: async () => true,
      removebgCutout: async (p) => { window.__cuts.push(p); if (window.__vanish) await window._scratchRemoveById(window.__vanish); return { ok: true, b64: OUT_B64, mime: 'image/png' }; },
    };
    Object.defineProperty(window, 'electronAPI', { configurable: true, get: () => new Proxy(fake, { get: (t, k) => (k in t ? t[k] : () => Promise.resolve(null)) }), set: () => {} });
  }, OUT_B64);
  await page.setViewportSize({ width: 1700, height: 1100 });
  const errs = await bootApp(page);
  const src0 = await page.evaluate(async ({ SID, withAsset }) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
    const x = cv.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#d02020'; x.fillRect(16, 16, 32, 32);
    const px = cv.toDataURL('image/png');
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="sR" data-section="1"><div class="section-hitzone"></div><div class="section-inner">
      <div class="row" data-layout="stack"><div class="text-block" id="tR" data-type="text"><div class="tb-h2">배경 제거 판</div></div></div>
      ${withAsset ? `<div class="row" data-layout="stack"><div class="asset-block" id="abR" data-img-src="${px}" style="width:200px;height:120px"><img class="asset-img" src="${px}"></div></div>` : ''}
      <div class="gap-block" data-type="gap" style="height:200px"></div></div></div>`);
    window.rebindAll?.(); window.deselectAll?.();
    await window._scratchAddAndSave(px, 1500, 120, 320, undefined, SID);
    return px;
  }, { SID, withAsset });
  await page.waitForSelector(`.scratch-item[data-scratch-id="${SID}"]`);
  await page.evaluate(() => window.clearHistory?.());
  return { errs, src0 };
}
/* 스크래치 항목을 «진짜 클릭»으로 고른다(가운데 = 늘 상자 안 · cmd-link-new-section clickItem 과 같은 손). */
async function pickScratch(page) {
  await page.evaluate((s) => document.querySelector(`.scratch-item[data-scratch-id="${s}"]`).scrollIntoView({ block: 'center', inline: 'center' }), SID);
  await page.locator(`.scratch-item[data-scratch-id="${SID}"]`).click();
  await expect.poll(() => page.evaluate((s) => document.querySelector(`.scratch-item[data-scratch-id="${s}"]`).classList.contains('scratch-selected'), SID), '[전제] 스크래치가 골라졌다').toBe(true);
}
async function runPickRemoveBg(page, expectDialog = true) {
  await page.evaluate(() => { window.__toasts = []; const o = window.showToast; window.showToast = (m) => { window.__toasts.push(String(m)); o?.(m); }; window.runRemoveBg(); });
  if (!expectDialog) return;
  const btn = page.locator('[data-rb-model="removebg"]');
  await expect(btn).toBeVisible();
  await btn.click();
}
const state = (page) => page.evaluate((s) => ({
  cuts: window.__cuts.length, mime: window.__cuts[0]?.mime || null, b64len: (window.__cuts[0]?.b64 || '').length,
  scratchSrc: window._scratchGetItemById?.(s)?.src || null,   // ⛔앞 몇 자만 견주지 마라 — PNG data URL 은 머리가 같다
  scratchN: document.querySelectorAll(`.scratch-item[data-scratch-id="${s}"]`).length,
  assetSrc: document.querySelector('#abR img')?.getAttribute('src') || null,
  toasts: window.__toasts || [],
}), SID);

test('S1 스크래치 그림을 클릭으로 고름 → remove.bg 전송 0→1 · 결과가 같은 id 항목에', async ({ page }) => {
  const { errs } = await setup(page);
  await pickScratch(page);
  expect((await state(page)).cuts, '[전] 전송 0').toBe(0);
  await runPickRemoveBg(page);
  await expect.poll(async () => (await state(page)).cuts, '★스크래치 그림을 안 보냈다(옛 «먼저 선택»)').toBe(1);
  const s = await state(page);
  expect(s.mime).toBe('image/png');
  expect(s.b64len).toBeGreaterThan(20);
  await expect.poll(async () => (await state(page)).scratchSrc).toBe(OUT_PNG);
  expect((await state(page)).scratchN, '같은 id 하나').toBe(1);
  expect(s.toasts.some(t => /먼저 선택/.test(t))).toBe(false);
  expect(errs).toEqual([]);
});

test('S2 ⌘Z 한 번 = 원래 그림 · 같은 id', async ({ page }) => {
  const { errs, src0 } = await setup(page);
  await pickScratch(page);
  await runPickRemoveBg(page);
  await expect.poll(async () => (await state(page)).scratchSrc).toBe(OUT_PNG);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await expect.poll(async () => (await state(page)).scratchSrc).toBe(src0);
  expect((await state(page)).scratchN).toBe(1);
  expect(errs).toEqual([]);
});

test('S3 [음성] 아무것도 안 고름 → «먼저 선택» · 전송 0', async ({ page }) => {
  const { errs } = await setup(page);
  await runPickRemoveBg(page, false);
  await expect.poll(async () => (await state(page)).toasts.some(t => /먼저 선택/.test(t))).toBe(true);
  expect((await state(page)).cuts).toBe(0);
  expect(errs).toEqual([]);
});

test('S4 [대조] 이미지 블럭과 스크래치를 같이 골랐으면 이미지 블럭이 먼저 · 스크래치 무변', async ({ page }) => {
  const { errs, src0 } = await setup(page, { withAsset: true });
  await pickScratch(page);
  await page.evaluate(() => document.getElementById('abR').classList.add('selected'));   // 이미지 블럭 고르기 길은 이 검사 대상 아님(t211b 와 같은 꼴)
  await runPickRemoveBg(page);
  await expect.poll(async () => (await state(page)).cuts).toBe(1);
  await expect.poll(async () => (await state(page)).assetSrc, '이미지 블럭 그림이 바뀌었다(결과는 grdAssetSrcFor 가 정한 꼴 — 프로젝트 없는 하네스면 data URL)').not.toBe(src0);
  expect((await state(page)).scratchSrc, '스크래치 그대로').toBe(src0);
  expect(errs).toEqual([]);
});

test('S5 그룹 든 스크래치 — 결과 뒤에도 그룹·순서·선택 그대로 · ⌘Z 뒤에도', async ({ page }) => {
  const { errs, src0 } = await setup(page);
  await page.evaluate(async (SID) => {
    const px = window._scratchGetItemById(SID).src;
    await window._scratchRemoveById(SID);
    await window._scratchAddAndSave(px, 1500, 120, 320, 'g_rb', SID);
    await window._scratchAddAndSave(px, 1500, 520, 320, 'g_rb', 'sp_rbs2');
    await window._scratchAddAndSave(px, 1900, 120, 320, undefined, 'sp_rbs3');   // 순서 확인용 — 그룹 밖 하나 더(맨 뒤)
    window.clearHistory?.();
  }, SID);
  await pickScratch(page);
  const look = () => page.evaluate(() => ({
    order: [...document.querySelectorAll('.scratch-item')].map(e => e.dataset.scratchId),
    groups: ['sp_rbs1', 'sp_rbs2'].map(id => window._scratchItemById(id)?.g ?? null),
    sel: !!document.querySelector('.scratch-item[data-scratch-id="sp_rbs1"].scratch-selected'),
  }));
  const before = await look();
  expect(before.groups, '[전제] 둘 다 그룹').toEqual(['g_rb', 'g_rb']);
  await runPickRemoveBg(page);
  await expect.poll(async () => (await state(page)).scratchSrc).toBe(OUT_PNG);
  expect(await look(), '그룹·순서·선택 그대로').toEqual(before);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await expect.poll(async () => (await state(page)).scratchSrc).toBe(src0);
  const after = await look();
  expect([after.order, after.groups], '⌘Z 뒤에도 그룹·순서 그대로').toEqual([before.order, before.groups]);
  expect(errs).toEqual([]);
});

test('S6 그룹 둘째를 클릭(둘 다 골라짐) → 안 보냄 · «하나만 골라 주세요» · 둘 다 무변', async ({ page }) => {
  const { errs, src0 } = await setup(page);
  await page.evaluate(async (SID) => {
    const px = window._scratchGetItemById(SID).src;
    await window._scratchRemoveById(SID);
    await window._scratchAddAndSave(px, 1500, 120, 320, 'g_rb', SID);
    await window._scratchAddAndSave(px, 1500, 520, 320, 'g_rb', 'sp_rbs2');
  }, SID);
  await page.evaluate(() => document.querySelector('.scratch-item[data-scratch-id="sp_rbs2"]').scrollIntoView({ block: 'center', inline: 'center' }));
  await page.locator('.scratch-item[data-scratch-id="sp_rbs2"]').click();
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('.scratch-item.scratch-selected').length), '[전제] 그룹 클릭 = 둘 다 골라짐').toBe(2);
  await runPickRemoveBg(page, false);
  await expect.poll(async () => (await state(page)).toasts.some(t => /하나만 골라/.test(t))).toBe(true);
  expect((await state(page)).cuts).toBe(0);
  const srcs = await page.evaluate(() => ['sp_rbs1', 'sp_rbs2'].map(id => window._scratchGetItemById(id).src));
  expect(srcs).toEqual([src0, src0]);
  expect(errs).toEqual([]);
});

test('S7 보내는 사이 그 항목이 지워짐 → «완료» 아님 · «사라졌습니다»', async ({ page }) => {
  const { errs } = await setup(page);
  await pickScratch(page);
  await page.evaluate((SID) => { window.__vanish = SID; }, SID);
  await runPickRemoveBg(page);
  await expect.poll(async () => (await state(page)).toasts.some(t => /사라졌습니다/.test(t))).toBe(true);
  const s = await state(page);
  expect(s.cuts).toBe(1);
  expect(s.toasts.some(t => /배경 제거 완료/.test(t)), '없는 것을 «완료»라 하지 않는다').toBe(false);
  expect(s.scratchN).toBe(0);
  expect(errs).toEqual([]);
});
