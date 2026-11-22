/* t13G-02 갭 높이 라벨(관리자만 · js/gap-height-label.js · 현빈 261122 시안 승인).
 *   G1 일반 계정 = 갭을 골라도 라벨 0(★양성대조 짝 = G2 — 같은 장면에서 관리자만 다르다)
 *   G2 관리자 = 갭 하나 고르면 «H N»(N = offsetHeight) · 자리 = 블럭 오른쪽 · 세로 가운데 · #canvas 밖(#ss-handles-overlay) · 리사이즈 손잡이 0
 *   G3 라벨 누름 → 입력(값 전체 선택) → 120 Enter = 높이 120 · 우측 패널 #gap-number 120 · 라벨 120 · ⌘Z 한 번 = 원래 높이
 *   G4 Esc = 취소(높이·이력 무변) · 입력 중 Backspace 가 블럭을 안 지운다
 *   G5 저장본(serializeProject)에 라벨 0 · 고름 풀면 라벨 사라짐
 *   변이(실측 261122): _isAdmin 을 true 로 박으면 G1 빨강 · 입력 key 의 stopPropagation 을 빼면 G3 빨강(Enter 가 에디터로 샌다).
 *     ※ _apply 의 pushHistory 를 빼도 G3 ⌘Z 는 초록 — 이력이 이 높이 바뀜을 따로 잡는다. pushHistory 는 패널(prop-gap.js)과 같은 길이라 둔다(⌘Z 한 번 = 원래 값은 G3 이 잰다). */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

async function scene(page, admin) {
  await page.setViewportSize({ width: 1600, height: 1200 });
  const errs = await bootApp(page);
  page.on('dialog', (d) => { errs.push('dialog: ' + d.message()); d.dismiss(); });
  await page.evaluate((admin) => {
    window.__admin._forceState(admin ? { ok: true, isAdmin: true } : { ok: true, isAdmin: false, hasRoleField: true });
    document.querySelectorAll('#canvas .section-block').forEach((s) => s.remove());
  }, admin);
  await page.click('.fp-btn.primary[onclick="addSection()"]');
  const gid = await page.evaluate(() => document.querySelector('#canvas .gap-block').id);
  { const r = await waitStableRect(page, '#' + gid); await page.mouse.click(r.cx, r.cy); }   // 실앱과 같은 길(클릭 = 갭 + 섹션에 .selected · selectBlock 은 섹션 고름을 안 남겨 그 경우를 못 봤다)
  await page.waitForFunction((id) => document.getElementById(id).classList.contains('selected'), gid);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));   // 라벨 고리 rAF 두 장(고정 대기 아님 · 레포 관용구)
  return { errs, gid };
}
const H = (page, gid) => page.evaluate((id) => Math.round(document.getElementById(id).offsetHeight), gid);

test('G1 일반 계정 — 갭을 골라도 라벨 0', async ({ page }) => {
  const { errs, gid } = await scene(page, false);
  expect(await page.evaluate((id) => document.getElementById(id).classList.contains('selected'), gid), '[전제] 갭 고름').toBe(true);
  expect(await page.evaluate(() => document.querySelectorAll('.gap-h-label').length)).toBe(0);
  expect(errs).toEqual([]);
});

test('G2 관리자 — «H N» · 블럭 오른쪽 · 세로 가운데 · #canvas 밖 · 손잡이 0', async ({ page }) => {
  const { errs, gid } = await scene(page, true);
  await page.waitForSelector('.gap-h-label');
  const r = await page.evaluate((id) => {
    const g = document.getElementById(id), l = document.querySelector('.gap-h-label'), gr = g.getBoundingClientRect(), lr = l.getBoundingClientRect();
    return { n: document.querySelectorAll('.gap-h-label').length, h: l.dataset.h, oh: Math.round(g.offsetHeight), text: getComputedStyle(l, '::after').content,
      right: lr.left >= gr.right, mid: Math.abs((lr.top + lr.height / 2) - (gr.top + gr.height / 2)) <= 1, inCanvas: !!l.closest('#canvas'), inOverlay: !!l.closest('#ss-handles-overlay'),
      handles: document.querySelectorAll('#ss-handles-overlay [class*="resize-handle"], #canvas .gap-block [class*="handle"]').length };
  }, gid);
  expect(r).toEqual({ n: 1, h: String(r.oh), oh: r.oh, text: `"${r.oh}"`, right: true, mid: true, inCanvas: false, inOverlay: true, handles: 0 });
  expect(errs).toEqual([]);
});

test('G3 누름 → 입력 → Enter 적용 · 패널 같이 · ⌘Z 한 번에 되돌림', async ({ page }) => {
  const { errs, gid } = await scene(page, true);
  await page.waitForSelector('.gap-h-label');
  const h0 = await H(page, gid);
  await page.click('.gap-h-label');
  const ed = await page.evaluate(() => { const i = document.querySelector('.gap-h-label input'); return { editing: i.closest('.gap-h-label').classList.contains('is-editing'), focus: document.activeElement === i, all: i.selectionStart === 0 && i.selectionEnd === i.value.length, v: i.value }; });
  expect(ed).toEqual({ editing: true, focus: true, all: true, v: String(h0) });
  await page.keyboard.type('120'); await page.keyboard.press('Enter');
  await expect.poll(() => H(page, gid)).toBe(120);
  await expect.poll(() => page.evaluate(() => document.getElementById('gap-number') && document.getElementById('gap-number').value), { message: '우측 패널 값 같이' }).toBe('120');
  await expect.poll(() => page.evaluate(() => document.querySelector('.gap-h-label').dataset.h)).toBe('120');
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z');
  await expect.poll(() => H(page, gid)).toBe(h0);
  expect(errs).toEqual([]);
});

test('G4 Esc 취소 · 입력 중 Backspace 는 블럭을 안 지운다', async ({ page }) => {
  const { errs, gid } = await scene(page, true);
  await page.waitForSelector('.gap-h-label');
  const h0 = await H(page, gid);
  await page.click('.gap-h-label');
  await page.keyboard.press('Backspace'); await page.keyboard.press('Backspace');
  expect(await page.evaluate((id) => !!document.getElementById(id), gid), 'Backspace 가 갭 블럭을 지우지 않는다').toBe(true);
  await page.keyboard.type('30'); await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => document.querySelector('.gap-h-label').classList.contains('is-editing'))).toBe(false);
  expect(await H(page, gid)).toBe(h0);
  expect(errs).toEqual([]);
});

test('G5 저장본에 라벨 0 · 고름 풀면 라벨 사라짐', async ({ page }) => {
  const { errs, gid } = await scene(page, true);
  await page.waitForSelector('.gap-h-label');
  const snap = await page.evaluate(() => JSON.stringify(window.serializeProject()));
  expect(snap.includes('gap-h-label')).toBe(false);
  await page.evaluate(() => { window.deselectAll ? window.deselectAll() : document.querySelectorAll('#canvas .selected').forEach((e) => e.classList.remove('selected')); });
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('.gap-h-label').length)).toBe(0);
  expect(errs).toEqual([]);
});
