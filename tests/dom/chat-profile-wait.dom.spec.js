/* chat-profile-wait.dom.spec.js — 프로필 이미지 자산 저장을 기다리는 사이 말풍선·패널이 바뀌어도 그림과 편집을 안 잃는가.
 * 양성대조: GD1001_ROOT=<고치기 전 판> 로 돌리면 빨강.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const PNG = { name: 'p.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==', 'base64') };
const MSGS = [{ text: '첫째', align: 'left' }, { text: '둘째', align: 'right' }, { text: '셋째', align: 'left' }];
const URL_ = 'goya-asset://p/x.png';

/* idx 말풍선에 그림을 고르고, 자산 저장이 끝나기 직전에 멈춘다 */
async function pickAndHold(page, idx) {
  const errs = await bootApp(page);
  await page.setViewportSize({ width: 1700, height: 1100 });
  await page.evaluate((m) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((x) => x.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" data-section="1" id="s1"><div class="section-hitzone"></div><div class="section-inner"></div></div>');
    window.rebindAll?.();
    window.selectSection(document.getElementById('s1'));
    window.addChatBlock({ messages: m });
    const b = window.__b = document.querySelector('.chat-block');
    b.dataset.showProfile = '1';
    window.renderChatBlock(b);
    b.classList.add('selected');
    window.showChatProperties(b);
    window.grdAssetSrcFor = () => new Promise((r) => { window.__go = r; });
  }, MSGS);
  await page.locator(`.chb-profile-file[data-idx="${idx}"]`).setInputFiles(PNG);
  await page.waitForFunction(() => typeof window.__go === 'function');
  return errs;
}
const finish = (page) => page.evaluate(async (u) => { window.__go(u); await new Promise((r) => setTimeout(r, 50)); return JSON.parse(window.__b.dataset.messages); }, URL_);

test('기다리는 사이 앞 말풍선을 지워도 그림은 고른 말풍선에 간다', async ({ page }) => {
  const errs = await pickAndHold(page, 2);
  await page.locator('.chb-del-btn[data-idx="0"]').click();
  const m = await finish(page);
  expect(m.map((x) => x.text)).toEqual(['둘째', '셋째']);
  expect(m[1].profileImg).toBe(URL_);
  expect(m[0].profileImg).toBeUndefined();
  expect(errs).toEqual([]);
});
test('기다리는 사이 그 말풍선을 지우면 오류 없이 안 넣고 말한다', async ({ page }) => {
  const errs = await pickAndHold(page, 2);
  await page.evaluate(() => { window.__toasts = []; window.showToast = (t) => window.__toasts.push(t); });
  await page.locator('.chb-del-btn[data-idx="2"]').click();
  const m = await finish(page);
  expect(m.map((x) => x.text)).toEqual(['첫째', '둘째']);
  expect(m.some((x) => x.profileImg)).toBe(false);
  expect(await page.evaluate(() => window.__toasts.length)).toBe(1);
  expect(errs).toEqual([]);
});
test('기다리는 사이 패널이 다시 그려져 고친 글은 안 사라지고, 새 패널의 다음 편집도 그림을 안 지운다', async ({ page }) => {
  const errs = await pickAndHold(page, 0);
  await page.evaluate(() => window.showChatProperties(window.__b));
  await page.locator('.chb-text-input[data-idx="1"]').fill('고침');
  const m = await finish(page);
  expect(m[1].text).toBe('고침');
  expect(m[0].profileImg).toBe(URL_);
  await page.locator('.chb-text-input[data-idx="2"]').fill('또 고침');
  const m2 = await page.evaluate(() => JSON.parse(window.__b.dataset.messages));
  expect(m2[2].text).toBe('또 고침');
  expect(m2[0].profileImg).toBe(URL_);
  expect(errs).toEqual([]);
});
test('[양성] 아무 일 없으면 고른 말풍선에 들어가고 같은 패널의 다음 편집도 그림을 안 지운다', async ({ page }) => {
  const errs = await pickAndHold(page, 1);
  expect((await finish(page))[1].profileImg).toBe(URL_);
  await page.locator('.chb-text-input[data-idx="0"]').fill('고침');
  const m = await page.evaluate(() => JSON.parse(window.__b.dataset.messages));
  expect(m[0].text).toBe('고침');
  expect(m[1].profileImg).toBe(URL_);
  expect(errs).toEqual([]);
});
