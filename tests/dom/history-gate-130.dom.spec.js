/* history-gate-130.dom.spec.js — ★130 싼 게이트(js/history.js pushHistory 머리): «무변화 차단이 버릴 게 확실하면» 직렬화 «앞»에서 돌아간다.
 * 셋을 다 잰다: ㉠ 캔버스 세대(js/io/save-load.js 기존 감시자 · class 는 런타임 마커만 바뀐 것만 뺀다) ㉡ pageSettings ㉢ 미확정 영상 사이드카 열쇠(라이브).
 * G0 [전제] 감시자가 돈다(세대 null 아님) · G1 [새 것] 아무것도 안 바뀐 push = 게이트로 버림(직렬화 0) · G2 런타임 마커(selected)만 바뀐 push = 게이트로 버림
 * ★음성대조(셋이 여전히 쌓이나): N1 설정만 바뀐 편집 · N2 미확정 영상만 바뀐 편집 · N3 sideEffects 있는 편집 · N4 콘텐츠 class(has-image) 만 바뀐 편집 · N5 진짜 편집(높이)
 * 기다림은 전부 조건 — 고정 대기 0. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function setup(page) {
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="hS" data-section="1" style="height:300px;"><div class="section-hitzone"></div><div class="section-inner"><div class="asset-block" id="hA" data-type="asset" style="height:120px"></div></div></div>');
    window.rebindAll?.(); window.clearHistory();
    window.__ser = 0; const f = window.getSerializedCanvas; window.getSerializedCanvas = function (...a) { window.__ser++; return f.apply(this, a); };
  });
  return errs;
}
const tip = (page) => page.evaluate(() => window.getHistoryTip());
const gate = (page) => page.evaluate(() => window.getHistoryStripStats().gateSkips);
const ser = (page) => page.evaluate(() => window.__ser);
async function base(page, label) { await page.evaluate((l) => { document.getElementById('hS').style.height = (parseInt(document.getElementById('hS').style.height) + 1) + 'px'; window.pushHistory(l); }, label); return { t: await tip(page), g: await gate(page), s: await ser(page) }; }

test('G0 [전제] 기존 감시자가 세대를 준다(null 아님) · 꼭대기에 세대가 달린다', async ({ page }) => {
  const errs = await setup(page);
  expect(await page.evaluate(() => window.__canvasGen()), '[전제] 감시 중').not.toBe(null);
  expect(errs).toEqual([]);
});

test('G1 [새 것] 아무것도 안 바뀐 push(끌기 시작 표본 꼴) = 게이트로 버림 · 직렬화 0 · 칸 그대로', async ({ page }) => {
  const errs = await setup(page); const b = await base(page, 'e1');
  await page.evaluate(() => window.pushHistory('again'));
  expect(await gate(page) - b.g, '게이트가 버렸다').toBe(1);
  expect(await ser(page) - b.s, '직렬화 0').toBe(0);
  expect((await tip(page)).seq, '칸 그대로').toBe(b.t.seq);
  expect(errs).toEqual([]);
});

test('G2 [새 것] 런타임 마커(selected)만 바뀐 push = 게이트로 버림(세척이 벗기는 class)', async ({ page }) => {
  const errs = await setup(page); const b = await base(page, 'e1');
  await page.evaluate(() => { document.getElementById('hA').classList.add('selected'); window.pushHistory('sel'); });
  expect(await gate(page) - b.g, '게이트가 버렸다').toBe(1);
  expect((await tip(page)).seq).toBe(b.t.seq);
  expect(errs).toEqual([]);
});

test('N1 [음성대조] 설정(pageSettings)만 바뀐 편집은 쌓인다', async ({ page }) => {
  const errs = await setup(page); const b = await base(page, 'e1');
  await page.evaluate(() => { const st = window.__goyaState || window.state; (st?.pageSettings || window.getPageSettings?.()); });
  const changed = await page.evaluate(() => { const s = window.state || window.__state; if (!s || !s.pageSettings) return false; s.pageSettings = { ...s.pageSettings, gap: (s.pageSettings.gap || 0) + 7 }; window.pushHistory('설정'); return true; });
  expect(changed, '[전제] pageSettings 에 닿았다').toBe(true);
  expect((await tip(page)).seq, '설정만 바뀌어도 새 칸').not.toBe(b.t.seq);
  expect(await gate(page) - b.g, '게이트가 안 버렸다').toBe(0);
  expect(errs).toEqual([]);
});

test('N2 [음성대조] 미확정 영상만 바뀐 편집은 쌓인다', async ({ page }) => {
  const errs = await setup(page); const b = await base(page, 'e1');
  await page.evaluate(() => { const a = document.getElementById('hA'); a.dataset.assetType = 'video-pending'; a.dataset.imgSrc = 'data:video/mp4;base64,AAAA'; window.pushHistory('영상'); });
  expect((await tip(page)).seq, '미확정 영상만 바뀌어도 새 칸').not.toBe(b.t.seq);
  expect(await gate(page) - b.g).toBe(0);
  expect(errs).toEqual([]);
});

test('N3 [음성대조] sideEffects 있는 편집(스크래치 리사이즈 꼴)은 쌓인다 — 캔버스 그대로여도', async ({ page }) => {
  const errs = await setup(page); const b = await base(page, 'e1');
  await page.evaluate(() => window.pushHistory('스크래치', { onUndo() {}, onRedo() {} }));
  expect((await tip(page)).seq, 'sideEffects = 새 칸').not.toBe(b.t.seq);
  expect(await gate(page) - b.g).toBe(0);
  expect(errs).toEqual([]);
});

test('N4 [음성대조] 콘텐츠 class(has-image)만 바뀐 편집은 게이트가 안 버린다(옛 길이 가른다)', async ({ page }) => {
  const errs = await setup(page); const b = await base(page, 'e1');
  await page.evaluate(() => { document.getElementById('hA').classList.add('has-image'); window.pushHistory('img'); });
  expect(await gate(page) - b.g, '게이트가 안 버렸다(세대가 올랐다)').toBe(0);
  expect(await ser(page) - b.s, '옛 길 = 직렬화 1').toBe(1);
  expect(errs).toEqual([]);
});

test('N5 [음성대조] 진짜 편집(높이)은 쌓인다', async ({ page }) => {
  const errs = await setup(page); const b = await base(page, 'e1');
  await page.evaluate(() => { document.getElementById('hS').style.height = '360px'; window.pushHistory('h'); });
  expect((await tip(page)).seq).not.toBe(b.t.seq);
  expect(await gate(page) - b.g).toBe(0);
  expect(errs).toEqual([]);
});

/* ══ ★167(2026-10-26 · 지디 처방 · F4-GATE-NEVER-FIRES-IN-APP-01) — «앱 장면»을 재는 칸 ══════════════════════════════
 *   G1·G2 는 «꼭대기 직후 변이 없는 push»만 잰다 ⇒ 앱의 막힘(오버레이 켜기 push 뒤 늦게 오는 --sec-clip style 한 묶음 → 끌기 시작 표본)을 못 봤다.
 *   이름 명부 = js/non-edit-roster.js(비교 정규식과는 tests/unit/non-edit-roster-167 이 바이트째 묶음). ⛔undo 쪽엔 안 쓴다. */
test('S1 [167 새 것] 진짜 편집 push → 뒤늦은 --sec-clip 만의 style 묶음 → 시작 표본 push = 게이트로 버림 · 직렬화 0', async ({ page }) => {
  const errs = await setup(page); const b = await base(page, '오버레이로 전환');
  await page.evaluate(() => { document.getElementById('hA').style.setProperty('--sec-clip', 'inset(0px 0px 111px 0px)'); window.pushHistory('끌기 시작 표본'); });
  expect(await gate(page) - b.g, '★게이트가 버렸다(뒤늦은 --sec-clip 은 세대를 안 올린다)').toBe(1);
  expect(await ser(page) - b.s, '직렬화 0').toBe(0);
  expect((await tip(page)).seq, '칸 그대로').toBe(b.t.seq);
  expect(errs).toEqual([]);
});

test('S2 [167 · 안 닫힘을 잠금] 휠 한 번(lazy 셋: data-lazy-bg · ±lazy-unloaded) 뒤 push = 게이트 «안» 걸림(이번 처방 밖 — 따로 잰다)', async ({ page }) => {
  const errs = await setup(page); const b = await base(page, 'e1');
  await page.evaluate(() => { const s = document.getElementById('hS'); s.classList.add('lazy-unloaded'); s.setAttribute('data-lazy-bg', 'initial'); window.pushHistory('휠 뒤'); });
  expect(await gate(page) - b.g, '⛔lazy 셋은 중립 아님(안 잰 것을 넣지 않았다) — 이 칸이 초록으로 바뀌면 처방 범위가 바뀐 것').toBe(0);
  expect(await ser(page) - b.s, '옛 길 = 직렬화 1').toBe(1);
  expect(errs).toEqual([]);
});

test('S3 [167 음성대조] --sec-clip 과 진짜 속성(높이)이 같이 바뀐 style = 게이트 안 버림 · 쌓인다', async ({ page }) => {
  const errs = await setup(page); const b = await base(page, 'e1');
  await page.evaluate(() => { const a = document.getElementById('hA'); a.style.setProperty('--sec-clip', 'inset(0px 0px 7px 0px)'); a.style.height = '150px'; window.pushHistory('높이'); });
  expect(await gate(page) - b.g).toBe(0);
  expect((await tip(page)).seq, '진짜 편집 = 새 칸').not.toBe(b.t.seq);
  expect(errs).toEqual([]);
});

test('S4 [167 새 것] draggable true↔false 만 = 게이트로 버림(비교 정규식과 같은 값 범위)', async ({ page }) => {
  const errs = await setup(page); const b = await base(page, 'e1');
  await page.evaluate(() => { document.getElementById('hA').setAttribute('draggable', 'true'); window.pushHistory('dr'); });
  expect(await gate(page) - b.g).toBe(1);
  expect(errs).toEqual([]);
});
