/* fix5-159-undo-skip.dom.spec.js — ★159 SCRATCH-UNDO-RESTORE-APPEARS-LATE-01 (지디 ㉯ · 2026-10-26)
 * ⌘Z 의 갈 칸이 «지금 라이브와 같으면»(undo 첫머리 체크포인트의 «라이브 ≡ 꼭대기» + 떠나는 칸 ≡ 갈 칸 — 둘 다 기존 _sameEdit) 캔버스를 통째로 갈지 않는다.
 * 자 = 섹션 노드에 단 표식(통째로 갈면 새 노드라 표식이 사라진다) + getHistoryStripStats().undoRestoreSkips.
 * U1 [새 것] 그룹 진입 중 「삭제」 → ⌘Z = 건너뜀 · 섹션 노드 그대로 · 되살린 장 그룹·순서·모드 제자리(⑱ 값)
 * ★음성대조: N1 캔버스가 바뀐 편집의 ⌘Z 는 여전히 통째 복원 · N3 페이지를 다녀온 뒤 캔버스 편집의 ⌘Z 도 통째 복원(높이 되돌아감)
 *   · N4 사다리(높이 편집 → 스크래치 삭제): 첫 ⌘Z = 건너뜀(장만) · 둘째 ⌘Z = 통째 복원(높이 되돌아감)
 * 기다림은 전부 조건 — 고정 대기 0. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const T = { timeout: 15000 };

async function setup(page) {
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="uS" data-section="1" style="height:300px;"><div class="section-hitzone"></div><div class="section-inner"><div class="asset-block" id="uA" data-type="asset" style="height:120px"></div></div></div>');
    window.rebindAll?.();
    const cv = document.createElement('canvas'); cv.width = 200; cv.height = 140; const x = cv.getContext('2d'); x.fillStyle = '#3a86ff'; x.fillRect(0, 0, 200, 140);
    const src = cv.toDataURL('image/png');
    let y = 40; for (const id of ['sp_a', 'sp_b', 'sp_c']) { await window._scratchAddAndSave(src, -320, y, 200, 'g_u', id); y += 220; }
    window.clearHistory();
  });
  await page.waitForFunction(() => document.querySelectorAll('.scratch-item[data-scratch-group="g_u"]').length === 3, null, T);
  return errs;
}
const st = (page) => page.evaluate(() => ({
  order: [...document.querySelectorAll('.scratch-item')].map((e) => e.dataset.scratchId),
  g: Object.fromEntries([...document.querySelectorAll('.scratch-item')].map((e) => [e.dataset.scratchId, e.dataset.scratchGroup ?? null])),
  mode: window._scratchGroupMode?.() ?? null,
  skips: window.getHistoryStripStats().undoRestoreSkips ?? null,
  same: document.getElementById('uS')?.__mark159 === 1,
}));
const mark = (page) => page.evaluate(() => { document.getElementById('uS').__mark159 = 1; });
async function undo(page) { await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z'); }
/* 진입·우클릭은 장의 듣개에 바로 보낸다(이 spec 은 진입·메뉴를 재지 않는다 — fix5-t419-group-rclick 이 잰다) */
async function rDelete(page, enterId, id) {
  await page.evaluate(([a, b]) => {
    const ev = (el, t) => el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, button: t === 'contextmenu' ? 2 : 0, clientX: 10, clientY: 10 }));
    ev(document.querySelector(`.scratch-item[data-scratch-id="${a}"]`), 'dblclick');
    ev(document.querySelector(`.scratch-item[data-scratch-id="${b}"]`), 'contextmenu');
  }, [enterId, id]);
  await page.locator('.scratch-send-menu [data-scratch-group-act="delete"]').click();
  await page.waitForFunction((b) => !document.querySelector(`.scratch-item[data-scratch-id="${b}"]`), id, T);
}

test('U1 그룹 진입 중 「삭제」 → ⌘Z = 캔버스 복원 건너뜀(섹션 노드 그대로) · 장 그룹·순서·모드 제자리', async ({ page }) => {
  const errs = await setup(page);
  const s0 = await st(page);
  await rDelete(page, 'sp_a', 'sp_b');
  expect((await st(page)).mode, '전제: 모드 유지').toBe('g_u');
  await mark(page);
  await undo(page);
  await page.waitForFunction(() => !!document.querySelector('.scratch-item[data-scratch-id="sp_b"]'), null, T);
  await expect.poll(async () => (await st(page)).order, { timeout: 5000 }).toEqual(s0.order);
  const s1 = await st(page);
  console.log('[U1] ' + JSON.stringify({ s0, s1 }));
  expect(s1.skips, '★건너뜀 1').toBe((s0.skips ?? 0) + 1);
  expect(s1.same, '★섹션 노드가 그대로(통째 교체 아님)').toBe(true);
  expect(s1.g, '그룹 제자리').toEqual({ sp_a: 'g_u', sp_b: 'g_u', sp_c: 'g_u' });
  expect(s1.mode, '모드 제자리').toBe('g_u');
  expect(errs).toEqual([]);
});

test('N1 [음성대조] 캔버스가 바뀐 편집(섹션 높이)의 ⌘Z 는 여전히 통째 복원 · 높이 되돌아감', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => { document.getElementById('uS').style.height = '360px'; window.pushHistory('높이'); });
  await mark(page);
  const s0 = await st(page);
  await undo(page);
  await page.waitForFunction(() => document.getElementById('uS')?.style.height === '300px', null, T);
  const s1 = await st(page);
  const gate = await page.evaluate(() => window.getHistoryStripStats().lastUndoGate ?? null);
  console.log('[N1] ' + JSON.stringify({ s0, s1, gate }));
  /* ★㉡ 음성대조(지디 22:32) — 진짜 편집 하나(높이)만 다른 두 칸에서 비교가 «다름»을 낸다(거짓 «같음» 0).
     다른 칸(라이브≡꼭대기·페이지·설정·영상)은 다 참이어야 «다름»이 비교에서 나온 것이다. 옛 판엔 이 자(lastUndoGate)가 없다 → null = 건너뜀 0 으로만 잰다. */
  if (gate) expect({ liveIsTop: gate.liveIsTop, page: gate.page, settings: gate.settings, video: gate.video, canvas: gate.canvas }, '★다른 칸은 같고 캔버스 비교만 «다름»')
    .toEqual({ liveIsTop: true, page: true, settings: true, video: true, canvas: false });
  expect(s1.skips, '건너뜀 안 늘어남').toBe(s0.skips);
  expect(s1.same, '통째 복원 = 새 노드').toBe(false);
  expect(errs).toEqual([]);
});

/* ⚠️페이지를 다녀오면 다시 그린 캔버스가 꼭대기와 «다르게» 직렬화된다(실측 · d0a6b6fa 도 같음) ⇒ 첫 ⌘Z 의 체크포인트가 「현재 상태」 칸을 새로 만들고
   그 칸에서 「높이」 칸으로 내려간다(높이 360 그대로 — 원래 있던 꼴 · 이 시험이 재는 것 아님). 재는 것 = «옛 길을 탔나»(건너뜀 0 · 노드 갈림 · liveIsTop false). */
test('N3 [음성대조] 페이지를 다녀온 뒤 ⌘Z = 옛 길(통째 복원 · 건너뜀 0 · 판정 칸 liveIsTop false)', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => { document.getElementById('uS').style.height = '360px'; window.pushHistory('높이'); });
  const p1 = await page.evaluate(() => window.state.currentPageId);
  await page.evaluate(async () => { await window.addPage?.(); });
  await page.waitForFunction((p) => window.state.currentPageId !== p, p1, T);
  await page.evaluate(async (p) => { await window.switchPage?.(p); }, p1);
  await page.waitForFunction(() => document.getElementById('uS')?.style.height === '360px', null, T);
  await page.keyboard.press('Escape');
  await mark(page);
  const s0 = await st(page);
  await undo(page);
  await page.waitForFunction(() => document.getElementById('uS')?.__mark159 !== 1, null, T);   // 통째 복원 = 표식 단 노드가 갈린다
  const s1 = await st(page);
  const gate = await page.evaluate(() => window.getHistoryStripStats().lastUndoGate ?? null);
  console.log('[N3] ' + JSON.stringify({ s0, s1, gate }));
  expect(s1.skips, '건너뜀 안 늘어남').toBe(s0.skips);
  expect(s1.same, '통째 복원 = 새 노드').toBe(false);
  expect(errs).toEqual([]);
});

test('N4 [음성대조] 사다리 — 높이 편집 → 스크래치 삭제: 첫 ⌘Z = 건너뜀(장만 돌아옴 · 높이 그대로) · 둘째 ⌘Z = 통째 복원(높이 되돌아감)', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => { document.getElementById('uS').style.height = '360px'; window.pushHistory('높이'); });
  await rDelete(page, 'sp_a', 'sp_b');
  await mark(page);
  const s0 = await st(page);
  await undo(page);
  await page.waitForFunction(() => !!document.querySelector('.scratch-item[data-scratch-id="sp_b"]'), null, T);
  const s1 = await st(page);
  const h1 = await page.evaluate(() => document.getElementById('uS').style.height);
  expect(s1.skips, '★첫 ⌘Z 건너뜀').toBe((s0.skips ?? 0) + 1);
  expect(s1.same, '섹션 노드 그대로').toBe(true);
  expect(h1, '높이는 그대로(아직 안 되돌림)').toBe('360px');
  await undo(page);
  await page.waitForFunction(() => document.getElementById('uS')?.style.height === '300px', null, T);
  const s2 = await st(page);
  console.log('[N4] ' + JSON.stringify({ s0, s1, s2 }));
  expect(s2.skips, '둘째 ⌘Z 는 건너뛰지 않는다').toBe(s1.skips);
  expect(s2.same, '통째 복원 = 새 노드').toBe(false);
  expect(errs).toEqual([]);
});
