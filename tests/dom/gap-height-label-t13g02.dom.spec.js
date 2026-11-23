/* t13G-02 갭 높이 라벨(관리자만 · js/gap-height-label.js · 현빈 261122 시안 승인).
 *   G1 일반 계정 = 갭을 골라도 라벨 0(★양성대조 짝 = G2 — 같은 장면에서 관리자만 다르다)
 *   G2 관리자 = 갭 하나 고르면 «H N»(N = offsetHeight) · 자리 = 블럭 오른쪽 · 세로 가운데 · #canvas 밖(#ss-handles-overlay) · 리사이즈 손잡이 0
 *   G3 라벨 누름 → 입력(값 전체 선택) → 120 Enter = 높이 120 · 우측 패널 #gap-number 120 · 라벨 120 · ⌘Z 한 번 = 원래 높이
 *   G4 Esc = 취소(높이·이력 무변) · 입력 중 Backspace 가 블럭을 안 지운다
 *   G5 저장본(serializeProject)에 라벨 0 · 고름 풀면 라벨 사라짐
 *   G6~G8 상한 2000(현빈 261122 · GAP_MAX 하나) — 라벨 2000 들어감 · 2001 → 2000 / 패널 숫자칸 2001 → 높이·칸 2000 / 슬라이더 끝 = 2000 · 슬라이더·숫자칸 max = GAP_MAX
 *   G9 옛 저장본에 상한 넘는 갭(2500) — 저장 → 다시 열기 · 라벨 열고 Enter(값 안 바꿈) 해도 그대로(조용히 안 깎임) · 실측값을 적는다
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
      handles: document.querySelectorAll('#ss-handles-overlay [class*="resize-handle"], #ss-handles-overlay [data-tbx-dir], #canvas .gap-block [class*="handle"]').length };   // data-tbx-dir 도 센다(갭 손잡이 꼴) — ⚠️이 칸(캔버스 클릭 길)은 showHandlesFor 를 안 불러 손잡이가 늘 0 이다(수지맥 CTL 261123 실측) · 손잡이 지킴은 G10(레이어 패널 길)
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

async function labelSet(page, v) {
  await page.click('.gap-h-label'); await page.keyboard.press('ControlOrMeta+a'); await page.keyboard.type(String(v)); await page.keyboard.press('Enter');
}
test('G6 상한 2000 — 라벨 입력 2000 = 들어감 · 2001 = 2000 으로 죄임', async ({ page }) => {
  const { errs, gid } = await scene(page, true);
  await page.waitForSelector('.gap-h-label');
  expect(await page.evaluate(() => window.GAP_MAX), '정본 하나').toBe(2000);
  await labelSet(page, 2000); await expect.poll(() => H(page, gid)).toBe(2000);
  await labelSet(page, 50); await expect.poll(() => H(page, gid)).toBe(50);
  await labelSet(page, 2001); await expect.poll(() => H(page, gid)).toBe(2000);
  await expect.poll(() => page.evaluate(() => document.querySelector('.gap-h-label').dataset.h)).toBe('2000');
  expect(errs).toEqual([]);
});

test('G7 상한 2000 — 패널 숫자칸 2001 = 높이·칸 2000 · 2000 = 들어감', async ({ page }) => {
  const { errs, gid } = await scene(page, true);
  await page.waitForSelector('#gap-number');
  await page.fill('#gap-number', '2001'); await page.press('#gap-number', 'Enter'); await page.evaluate(() => document.getElementById('gap-number').blur());
  await expect.poll(() => H(page, gid)).toBe(2000);
  await expect.poll(() => page.evaluate(() => document.getElementById('gap-number').value)).toBe('2000');
  await page.fill('#gap-number', '100'); await expect.poll(() => H(page, gid)).toBe(100);
  await page.fill('#gap-number', '2000'); await expect.poll(() => H(page, gid)).toBe(2000);
  expect(errs).toEqual([]);
});

test('G8 상한 2000 — 슬라이더 끝 = 2000 · 슬라이더·숫자칸 max = GAP_MAX', async ({ page }) => {
  const { errs, gid } = await scene(page, true);
  await page.waitForSelector('#gap-slider');
  expect(await page.evaluate(() => [document.getElementById('gap-slider').max, document.getElementById('gap-number').max])).toEqual(['2000', '2000']);
  await page.evaluate(() => { const s = document.getElementById('gap-slider'); s.value = '2001'; s.dispatchEvent(new Event('input', { bubbles: true })); });   // 브라우저가 max 로 죈다
  await expect.poll(() => H(page, gid)).toBe(2000);
  expect(await page.evaluate(() => document.getElementById('gap-slider').value)).toBe('2000');
  expect(errs).toEqual([]);
});

test('G9 옛 저장본의 상한 넘는 갭(2500) — 다시 열어도 · 라벨 Enter(무변) 해도 그대로(실측)', async ({ page }) => {
  const { gid } = await scene(page, true);
  await page.evaluate((id) => { document.getElementById(id).style.height = '2500px'; }, gid);   // 옛 판(상한 없던 때)·손편집 저장본을 흉내
  const snap = await page.evaluate(() => window.serializeProject());
  const errs2 = await bootApp(page);
  await page.evaluate(() => window.__admin._forceState({ ok: true, isAdmin: true }));
  await page.evaluate((d) => window.applyProjectData(d), JSON.parse(snap));
  await page.waitForFunction((id) => !!document.getElementById(id), gid);
  const loaded = await H(page, gid);
  console.log('[G9 실측] 2500 저장 → 다시 연 높이 =', loaded);
  expect(loaded, '★열 때 깎이면 데이터 변경(현빈 결정) — 지금은 그대로').toBe(2500);
  { const r = await waitStableRect(page, '#' + gid); await page.mouse.click(r.cx, Math.min(r.cy, r.top + 40)); }
  await page.waitForSelector('.gap-h-label');
  expect(await page.evaluate(() => document.querySelector('.gap-h-label').dataset.h)).toBe('2500');
  await page.click('.gap-h-label'); await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => document.querySelector('.gap-h-label').classList.contains('is-editing'))).toBe(false);
  expect(await H(page, gid), '★값 안 바꾸고 Enter = 그대로(조용히 안 깎임)').toBe(2500);
  expect(await page.evaluate(() => [document.getElementById('gap-number').value, document.getElementById('gap-slider').value]), '패널 = 숫자 2500 그대로 · 슬라이더는 끝(2000)에 선다').toEqual(['2500', '2000']);
  expect(errs2).toEqual([]);
});

/* G10 (현빈 261123 t13G-02 ⓐ «갭 손잡이 없게» · 수지맥 CTL 261123 «G2 는 손잡이 되살린 판에서도 초록 = 죽은 초록») — 실측: 캔버스 클릭으로 갭을 고르는 길(G2)은 showHandlesFor 를 «안» 부른다
 * (CTL 판에서 2초 동안 [data-tbx-dir] 0). 갭 손잡이가 실제로 뜨던 길 = 레이어 패널 줄 누름(layer-panel-items.js → showHandlesFor · 미카사 실앱 갭 손잡이 끌기 120→218 의 길)
 * ⇒ 그 길로 골라 손잡이 0 을 잰다. 양성대조 = _patches/regrade-184-CTL.patch(갭 갈래 되살림) ⇒ G10 빨강 */
test('G10 레이어 패널로 갭을 골라도 캔버스 리사이즈 손잡이 0 (높이는 라벨로만)', async ({ page }) => {
  const { errs, gid } = await scene(page, true);
  await page.evaluate(() => window.buildLayerPanel?.());
  const pt = await page.evaluate((id) => { const g = document.getElementById(id); const it = [...document.querySelectorAll('.layer-item')].find((x) => x._dragTarget === g || x._block === g); if (!it) return null; it.scrollIntoView({ block: 'nearest' }); const r = it.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, gid);
  expect(pt, '[전제] 갭의 레이어 줄이 있다').toBeTruthy();
  await page.mouse.click(pt[0], pt[1]);
  await page.waitForFunction((id) => document.getElementById(id).classList.contains('selected'), gid);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const n = await page.evaluate(() => document.querySelectorAll('#ss-handles-overlay [data-tbx-dir]').length);
  expect(n, '★레이어 패널로 고른 갭 = 캔버스 손잡이 0').toBe(0);
  expect(errs).toEqual([]);
});
