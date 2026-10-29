/* img-edit-undo-handles-274.dom.spec.js — ★274 IMG-EDIT-UNDO-LEAVES-FOUR-HANDLES-IN-FIXED-LAYER-01 (S3 · 261029 · 지디 13:1x ④)
 *   증상(앱 사용자 길 · Q227-4 ㉠ main-a·b): 이미지 편집 모드(실 더블클릭)에서 ⌘Z → 이력 복원이 블럭을 «같은 id 의 새 요소» 로 갈아끼우고
 *   옛 요소를 떼어낸다 ⇒ 옛 요소의 편집 정리(image-handling.js _imgEditCleanup · 2중 휩쓸기)가 안 돌아 #ss-handles-overlay 에 손잡이 넷이 남는다.
 *   한 쌍(지디 ④): ⑴ U2(편집 중 ⌘Z) 뒤 손잡이 0 ⑵ U0(Esc) · U1(Delete) 는 그대로 0(음성) ⑶ ⌘Z 가 여전히 «새 요소» 로 되살린다(sameEl false — 되살림 자체를 안 바꿨음을 잠금)
 *   ★전제(이게 빨강이면 아래는 «안 쟀다»): 편집 모드 손잡이 >0 · ⌘Z 뒤 편집 모드 끝.
 *   장면 = tests/dom/q2274-handle-leak-userpath.dom.spec.js 와 같은 꼴(이미지 = window.loadImageToAsset · 드롭 처리기 길 · 진짜 더블클릭 · 진짜 키).
 *   ⛔고정 대기 없음 · 키·마우스는 진짜 입력. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGNocFDAihiGlgQA+gM4Acru2/oAAAAASUVORK5CYII=';   // 8×8 RGB(파이썬 zlib 로 지음)

async function scene(page) {
  await page.setViewportSize({ width: 1600, height: 1200 });
  const errs = await bootApp(page);
  const id = await page.evaluate(async (b64) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    const sec = c.querySelector('.section-block'); window.selectSection(sec);
    window.addAssetBlock();
    const ab = [...sec.querySelectorAll('.asset-block')].pop();
    const bin = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
    window.loadImageToAsset(ab, new File([bin], 'q.png', { type: 'image/png' }));
    return ab.id;
  }, PNG);
  await page.waitForFunction((id) => document.getElementById(id)?.classList.contains('has-image'), id);
  await page.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'center' }), id);
  const r = await page.evaluate((id) => { const b = document.getElementById(id).getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, id);
  await page.mouse.dblclick(r.x, r.y);
  await page.waitForFunction((id) => document.getElementById(id)?.classList.contains('img-editing'), id);
  await page.evaluate((id) => { window.__q274old = document.getElementById(id); }, id);
  const n0 = await state(page, id);
  expect(n0.handles, `★전제: 편집 모드 손잡이가 안 섰다 ${JSON.stringify(n0)}`).toBeGreaterThan(0);
  return { errs, id };
}
const state = (page, id) => page.evaluate((id) => {
  const ov = document.getElementById('ss-handles-overlay'), b = document.getElementById(id), old = window.__q274old;
  return { handles: ov ? ov.querySelectorAll('.img-corner-handle').length : -1, editing: !!b && b.classList.contains('img-editing'),
    sameEl: !!old && b === old, oldEditing: !!old && old.classList.contains('img-editing') };
}, id);
const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

test('H1 ★274 ⑴ 편집 중 ⌘Z 뒤 고정층 손잡이 0', async ({ page }) => {
  const s = await scene(page);
  await page.keyboard.press('Meta+z'); await settle(page);
  const a = await state(page, s.id);
  console.log(`[274] H1 ${JSON.stringify(a)}`);
  expect(a.editing, `★전제: ⌘Z 뒤 편집 모드가 안 끝났다 ${JSON.stringify(a)}`).toBe(false);
  expect(a.handles, `★편집 중 ⌘Z 뒤 손잡이가 고정층에 남았다(옛 요소 고아) ${JSON.stringify(a)}`).toBe(0);
  expect(s.errs).toEqual([]);
});
test('H2 ★274 ⑶ ⌘Z 는 여전히 «새 요소» 로 되살린다(되살림 자체는 안 바꿨다 · 잠금)', async ({ page }) => {
  const s = await scene(page);
  await page.keyboard.press('Meta+z'); await settle(page);
  const a = await state(page, s.id);
  expect(a.sameEl, `★⌘Z 가 이제 같은 요소를 다시 쓴다 — 274 처방이 되살림 꼴을 바꿨다 ${JSON.stringify(a)}`).toBe(false);
});
test('H3 274 ⑵ 음성 — Esc · Delete 로 나가면 손잡이 0(그대로)', async ({ page }) => {
  for (const key of ['Escape', 'Delete']) {
    const s = await scene(page);
    await page.keyboard.press(key); await settle(page);
    const a = await state(page, s.id);
    expect(a.handles, `★${key} 로 나갔는데 손잡이가 남았다 ${JSON.stringify(a)}`).toBe(0);
  }
});

/* ★274 ⬜(지디 ②) — 옛 요소의 손잡이 자리 맞춤 고리(image-handling.js _syncLoop · requestAnimationFrame)가 갈린 뒤에도 «도나».
 *   자: 편집 들어가기 전에 window.requestAnimationFrame 을 감싸 «함수 이름이 _syncLoop 인 콜백» 이 걸린 수를 센다 · ⌘Z 뒤 몇 프레임 동안 센 수가 0 이어야(정리가 cancelAnimationFrame 을 불렀다).
 *   ★전제: 편집 중에는 그 수가 늘어야 한다(자가 산다 — 안 늘면 이 칸은 «안 쟀다»). */
test('H4 ★274 ⌘Z 뒤 옛 요소의 _syncLoop 고리가 멈춘다(rAF 다시 걸림 0)', async ({ page }) => {
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    window.__syncLoopRafs = 0;
    window.requestAnimationFrame = (cb) => { if (cb && cb.name === '_syncLoop') window.__syncLoopRafs++; return raf(cb); };
  });
  const s = await scene(page);
  const n0 = await page.evaluate(() => window.__syncLoopRafs);
  await settle(page); await settle(page);
  const n1 = await page.evaluate(() => window.__syncLoopRafs);
  expect(n1 - n0, `★전제: 편집 중인데 _syncLoop rAF 가 안 늘었다(자가 못 본다) ${n0}→${n1}`).toBeGreaterThan(0);
  await page.keyboard.press('Meta+z'); await settle(page);
  const m0 = await page.evaluate(() => window.__syncLoopRafs);
  await settle(page); await settle(page); await settle(page);
  const m1 = await page.evaluate(() => window.__syncLoopRafs);
  console.log(`[274] H4 ${JSON.stringify({ editing: [n0, n1], afterUndo: [m0, m1] })}`);
  expect(m1 - m0, `★⌘Z 뒤에도 옛 요소의 _syncLoop 가 돈다(rAF ${m0}→${m1})`).toBe(0);
  expect(s.errs).toEqual([]);
});
