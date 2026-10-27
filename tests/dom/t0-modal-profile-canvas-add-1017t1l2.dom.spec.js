/* t0-modal-profile-canvas-add-1017t1l2.dom.spec.js — 1017t1l2 ② 「캔버스에서 어떻게 추가하는지?」
 *
 * ★현빈 원문(T0-NOTE-ORIGINAL-261025.txt :12 · :18 의 👉 뒤)
 *   「우측패널에 들어는 가있는데 실제 추가하려면 어떻게해야하는지?」 · 「캔버스에서 어떻게 추가하는지?」
 * ★잰 사람(S3 · t8 재채점 · 판 f62653ce) — 패널(#mdl-pf-img-btn · #mdl-pf-emoji)로는 6/6 붙었고,
 *   캔버스엔 «지우는» × 하나뿐 «붙이는» 입구가 0 이었다(우클릭 메뉴도 「블록 템플릿으로 저장」 하나).
 * ★고침 = 이식 — 패널의 두 입구(이미지 선택 · 이모지)를 ★캔버스 칩으로 옮긴다. 쓰는 문은 ★하나
 *   (js/blocks/modal-block.js setModalProfile — 패널·캔버스가 같이 부른다).
 *
 * ★칸
 *   P  전제 — plain 모달이 섰고 프로필이 없다(사진·이모지 키 0 · .mdl-profile 0) · 패널 Profile 절이 있다(양성: 패널 길은 원래 있다)
 *   C1 모달을 진짜 마우스로 고르면 «캔버스 쪽»(우측 패널 밖)에 「프로필 추가」 단추가 보이고, 그 자리가 모달 곁이다
 *   C2 그 단추 → 이모지 칸에 😊 + Enter ⇒ 모달에 .mdl-profile-emoji 가 그려지고 글은 그대로 · ⌘Z 한 번이면 프로필이 없어진다
 *   C3 그 단추 → 「이미지 선택」 → 파일 고름 ⇒ .mdl-profile-img(src = data:image) 가 그려진다
 *   C4 버즈 카드(버즈 묶음 안 낱개 모달)에서도 같은 길로 붙고, 그 row 폭이 프로필만큼 넓어진다(refitBuzzRowWidth — 패널 길과 같은 결과)
 *   C5 프로필이 생긴 뒤엔 「프로필 추가」 단추가 안 보인다(× 와 겹치지 않게)
 * ⛔고정 대기 0 — 조건 대기(waitForFunction) 만 쓴다.
 * 실행: bash ~/taeyang-098/run-test.sh dom tests/dom/t0-modal-profile-canvas-add-1017t1l2.dom.spec.js
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const PNG1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

async function setupModal(page) {
  await page.setViewportSize({ width: 1400, height: 1000 });
  const errs = await bootApp(page);
  const id = await page.evaluate(async () => {
    await window.addSection();
    const made = window.addModalBlock({ variant: 'plain' });
    window.deselectAll?.();
    return made.block.id;
  });
  await waitStableRect(page, '#' + id);
  return { errs, id };
}

/** 진짜 마우스로 모달 가운데를 누른다 — 고르기는 사람 길로. */
async function pickModal(page, sel) {
  const r = await waitStableRect(page, sel);
  await page.mouse.click(r.cx, r.cy);
  await page.waitForFunction((s) => document.querySelector(s)?.classList.contains('selected'), sel, { timeout: 5000 });
}

/** 우측 패널 «밖»에 보이는 「프로필 추가」 단추(없으면 null). */
async function canvasAddBtn(page) {
  return page.evaluate(() => {
    const b = [...document.querySelectorAll('button[aria-label="프로필 추가"]')]
      .find((e) => !e.closest('#panel-right') && e.offsetParent !== null && e.getBoundingClientRect().width > 0);
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  });
}

test('P·C1 ★모달을 고르면 캔버스 쪽에 「프로필 추가」 단추가 모달 곁에 보인다', async ({ page }) => {
  const { errs, id } = await setupModal(page);
  const pre = await page.evaluate((id) => {
    const b = document.getElementById(id);
    return { img: b.dataset.profileImg || null, emoji: b.dataset.profileEmoji || null, n: b.querySelectorAll('.mdl-profile').length };
  }, id);
  expect(pre, 'P 전제: 프로필이 없는 모달').toEqual({ img: null, emoji: null, n: 0 });
  await pickModal(page, '#' + id);
  const panelHas = await page.evaluate(() => !!document.getElementById('mdl-pf-img-btn') && !!document.getElementById('mdl-pf-emoji'));
  expect(panelHas, 'P 양성: 패널 Profile 절(이미지 선택·이모지)은 원래 있다').toBe(true);
  await page.waitForFunction(() => [...document.querySelectorAll('button[aria-label="프로필 추가"]')].some((e) => !e.closest('#panel-right') && e.offsetParent !== null), null, { timeout: 3000 }).catch(() => {});
  const btn = await canvasAddBtn(page);
  expect(btn, 'C1 캔버스 쪽 「프로필 추가」 단추').not.toBeNull();
  const mr = await page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; }, id);
  expect(btn.x, 'C1 단추가 모달 곁(가로)').toBeGreaterThan(mr.l - 40);
  expect(btn.x, 'C1 단추가 모달 곁(가로)').toBeLessThan(mr.r + 40);
  expect(btn.y, 'C1 단추가 모달 곁(세로)').toBeGreaterThan(mr.t - 40);
  expect(btn.y, 'C1 단추가 모달 곁(세로)').toBeLessThan(mr.b + 40);
  expect(errs).toEqual([]);
});

test('C2·C5 ★캔버스 단추 → 이모지 ⇒ 그려지고 ⌘Z 한 번에 걷힌다 · 생긴 뒤엔 단추가 숨는다', async ({ page }) => {
  const { errs, id } = await setupModal(page);
  await pickModal(page, '#' + id);
  const textBefore = await page.evaluate((id) => document.querySelector('#' + id + ' .tb-mdl-text')?.textContent, id);
  await page.waitForFunction(() => [...document.querySelectorAll('button[aria-label="프로필 추가"]')].some((e) => !e.closest('#panel-right') && e.offsetParent !== null), null, { timeout: 3000 });
  const btn = await canvasAddBtn(page);
  await page.mouse.click(btn.x, btn.y);
  const emoji = page.locator('input[aria-label="프로필 이모지"]').filter({ visible: true }).first();
  await expect(emoji, 'C2 이모지 칸이 열린다').toBeVisible();
  await emoji.fill('😊');
  await emoji.press('Enter');
  await page.waitForFunction((id) => !!document.querySelector('#' + id + ' .mdl-profile-emoji'), id, { timeout: 3000 });
  const after = await page.evaluate((id) => {
    const b = document.getElementById(id);
    return { emoji: b.dataset.profileEmoji, face: b.querySelector('.mdl-profile-emoji')?.textContent, text: b.querySelector('.tb-mdl-text')?.textContent };
  }, id);
  expect(after.emoji, 'C2 dataset').toBe('😊');
  expect(after.face, 'C2 그려진 얼굴').toBe('😊');
  expect(after.text, 'C2 글은 그대로').toBe(textBefore);
  await page.waitForFunction(() => ![...document.querySelectorAll('button[aria-label="프로필 추가"]')].some((e) => !e.closest('#panel-right') && e.offsetParent !== null), null, { timeout: 3000 });
  expect(await canvasAddBtn(page), 'C5 생긴 뒤엔 단추가 숨는다').toBeNull();
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await page.waitForFunction((id) => { const b = document.getElementById(id); return b && !b.querySelector('.mdl-profile') && !b.dataset.profileEmoji; }, id, { timeout: 3000 });
  expect(errs).toEqual([]);
});

test('C3 ★캔버스 단추 → 이미지 선택 → 파일 ⇒ .mdl-profile-img 가 data:image 로 그려진다', async ({ page }) => {
  const { errs, id } = await setupModal(page);
  await pickModal(page, '#' + id);
  await page.waitForFunction(() => [...document.querySelectorAll('button[aria-label="프로필 추가"]')].some((e) => !e.closest('#panel-right') && e.offsetParent !== null), null, { timeout: 3000 });
  const btn = await canvasAddBtn(page);
  await page.mouse.click(btn.x, btn.y);
  const pick = page.locator('button[aria-label="프로필 이미지 선택"]').filter({ visible: true }).first();
  await expect(pick, 'C3 이미지 선택 단추').toBeVisible();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser', { timeout: 3000 }), pick.click()]);
  await chooser.setFiles({ name: 'p.png', mimeType: 'image/png', buffer: PNG1 });
  await page.waitForFunction((id) => /^data:image\//.test(document.querySelector('#' + id + ' .mdl-profile-img')?.getAttribute('src') || ''), id, { timeout: 3000 });
  expect(errs).toEqual([]);
});

test('C4 ★버즈 카드에서도 같은 길로 붙고 그 row 폭이 넓어진다', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1000 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(async () => {
    await window.addSection();
    window.addBuzzBlock();
    const fr = [...document.querySelectorAll('.frame-block')].find((f) => f.dataset.buzz === '1');
    const card = fr?.querySelector('.modal-block');
    window.deselectAll?.();
    return { fr: fr?.id, card: card?.id };
  });
  expect(ids.fr && ids.card, 'C4 전제: 버즈 묶음과 카드가 섰다').toBeTruthy();
  await waitStableRect(page, '#' + ids.card);
  const w0 = await page.evaluate((id) => document.getElementById(id).closest('.row').getBoundingClientRect().width, ids.card);
  /* 버즈 카드는 묶음(프레임) 안이라 «첫 누름 = 묶음», «한 번 더 = 카드» 일 수 있다 — 카드가 골라질 때까지 사람처럼 다시 누른다. */
  for (let i = 0; i < 3; i++) {
    const r = await waitStableRect(page, '#' + ids.card);
    await page.mouse.click(r.cx, r.cy);
    const ok = await page.waitForFunction((id) => document.getElementById(id)?.classList.contains('selected'), ids.card, { timeout: 1500 }).then(() => true, () => false);
    if (ok) break;
  }
  await page.waitForFunction(() => [...document.querySelectorAll('button[aria-label="프로필 추가"]')].some((e) => !e.closest('#panel-right') && e.offsetParent !== null), null, { timeout: 3000 });
  const btn = await canvasAddBtn(page);
  await page.mouse.click(btn.x, btn.y);
  const emoji = page.locator('input[aria-label="프로필 이모지"]').filter({ visible: true }).first();
  await emoji.fill('🐶');
  await emoji.press('Enter');
  await page.waitForFunction((id) => !!document.querySelector('#' + id + ' .mdl-profile-emoji'), ids.card, { timeout: 3000 });
  const w1 = await page.evaluate((id) => document.getElementById(id).closest('.row').getBoundingClientRect().width, ids.card);
  expect(w1, `C4 row 폭 ${w0} → ${w1}`).toBeGreaterThan(w0 + 4);
  expect(errs).toEqual([]);
});
