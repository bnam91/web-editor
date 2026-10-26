/* history-strip-memo.dom.spec.js — ★130㉡ 무변화 비교의 «a 쪽 memo»(js/history.js _strippedOf · _setSnapCanvas)가 썩지 않는다.
 * 고침: 꼭대기 canvas 의 «벗긴 꼴»을 그 항목에 들고 있는다(호출마다 같은 37MB 를 다시 벗기던 몫). canvas 쓰기는 전부 _setSnapCanvas(비우기).
 * ★이 파일이 재는 것 = «비우기»가 진짜 필요한가: 제자리 갈아끼우기 두 길(:706 restampHistoryTop · :536 _restampRestored)마다
 *   «편집 아닌 차이(--sec-clip)만» 남은 라이브가 «새 칸을 안 만든다»(= memo 가 새 canvas 를 따라갔다).
 *   비우기를 없애면 썩은 memo(옛 canvas)가 라이브와 달라 새 칸이 생긴다 → M1·M2 가 각각 빨개진다.
 * 기다림은 전부 조건 — 고정 대기 0.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/history-strip-memo.dom.spec.js */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function setup(page) {
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="sM" data-section="1" style="height:300px;"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>');
    window.rebindAll?.(); window.clearHistory();
  });
  return errs;
}
const clip = (page, v) => page.evaluate((v) => document.getElementById('sM').style.setProperty('--sec-clip', v), v);
const tip = (page) => page.evaluate(() => window.getHistoryTip());

test('M0 (양성대조) 편집 아닌 차이(--sec-clip)만 다르면 새 칸이 없다 · 진짜 편집은 새 칸', async ({ page }) => {
  const errs = await setup(page);
  await clip(page, 'inset(0px)'); await page.evaluate(() => window.pushHistory('m0'));
  const t0 = await tip(page);
  await clip(page, 'inset(3px)'); await page.evaluate(() => window.pushHistory());
  expect((await tip(page)).seq, '--sec-clip 만 다르면 무변화').toBe(t0.seq);
  await page.evaluate(() => { document.getElementById('sM').style.height = '310px'; window.pushHistory('h'); });
  expect((await tip(page)).seq, '★전제: 진짜 편집은 새 칸').not.toBe(t0.seq);
  expect(errs).toEqual([]);
});

test('M1 :706 restampHistoryTop 이 꼭대기 canvas 를 갈아끼운 뒤 — memo 가 새 canvas 를 따른다(새 칸 0)', async ({ page }) => {
  const errs = await setup(page);
  await clip(page, 'inset(0px)'); await page.evaluate(() => window.pushHistory('m1'));
  const t0 = await tip(page);
  await clip(page, 'inset(3px)'); await page.evaluate(() => window.pushHistory());   // ← 꼭대기 memo 가 찬다(a≠b · 벗기면 같음)
  expect((await tip(page)).seq, '★전제: 무변화').toBe(t0.seq);
  const ok = await page.evaluate((seq) => { document.getElementById('sM').style.height = '320px'; return window.restampHistoryTop(seq); }, t0.seq);
  expect(ok, '★전제: 꼭대기를 다시 찍었다(:706)').toBe(true);
  await clip(page, 'inset(5px)'); await page.evaluate(() => window.pushHistory());
  const t1 = await tip(page);
  expect([t1.seq, t1.len], '다시 찍힌 꼭대기와 --sec-clip 만 다르다 — 새 칸이 생기면 memo 가 옛 canvas 로 썩은 것').toEqual([t0.seq, t0.len]);
  expect(errs).toEqual([]);
});

test('M2 :536 _restampRestored(⌘Z 복원이 비멱등) 뒤 — memo 가 새 canvas 를 따른다(새 칸 0 · ⌘⇧Z 산다)', async ({ page }) => {
  const errs = await setup(page);
  await clip(page, 'inset(0px)'); await page.evaluate(() => window.pushHistory('e1'));
  const e1 = await tip(page);
  await clip(page, 'inset(3px)'); await page.evaluate(() => window.pushHistory());   // ← E1 memo
  await page.evaluate(() => { document.getElementById('sM').style.height = '330px'; window.pushHistory('e2'); });
  const e2 = await tip(page);
  expect(e2.seq, '★전제: E2 가 쌓였다').not.toBe(e1.seq);
  /* 복원을 비멱등으로 — 복원 직후 rebindAll 이 «편집»을 하나 더 한다 ⇒ _restampRestored 가 E1 canvas 를 갈아끼운다(:536) */
  await page.evaluate(() => { const orig = window.rebindAll; window.rebindAll = function (...a) { const r = orig.apply(this, a); window.rebindAll = orig; document.getElementById('sM').style.minHeight = '12px'; return r; }; window.undo(); });
  const u = await tip(page);
  expect([u.seq, u.pos], '★전제: ⌘Z 한 번 = E1').toEqual([e1.seq, e2.pos - 1]);
  expect(await page.evaluate(() => document.getElementById('sM').style.minHeight), '★전제: 복원이 비멱등이었다').toBe('12px');
  await clip(page, 'inset(5px)'); await page.evaluate(() => window.pushHistory());
  const t = await tip(page);
  expect([t.seq, t.len], '다시 찍힌 E1 과 --sec-clip 만 다르다 — 새 칸(⌘⇧Z 죽음)이 생기면 memo 가 썩은 것').toEqual([e1.seq, e2.len]);
  expect(errs).toEqual([]);
});

test('M3 넘기기 — 편집이 연달아 새 칸을 쌓을 때 두 번째부터는 «b 하나만» 벗긴다(꼭대기는 넘겨받은 memo)', async ({ page }) => {
  /* 원 블럭 누름·놓음 꼴: 비교마다 꼭대기가 «막 생긴» 항목(seq/len [3,1]→[4,2]→[5,3]). 넘기기가 없으면 호출마다 둘(a·b)을 벗긴다. */
  const errs = await setup(page);
  await page.evaluate(() => { document.getElementById('sM').style.height = '301px'; window.pushHistory('k1'); });   // 첫 비교: 꼭대기(초기) memo 없음 → 둘
  const c0 = (await page.evaluate(() => window.getHistoryStripStats())).calls;
  const t0 = await tip(page);
  await page.evaluate(() => { document.getElementById('sM').style.height = '302px'; window.pushHistory('k2'); });
  const t1 = await tip(page);
  expect(t1.seq, '★전제: 새 칸이 쌓였다').not.toBe(t0.seq);
  const d = (await page.evaluate(() => window.getHistoryStripStats())).calls - c0;
  expect(d, `두 번째 새 칸의 비교에서 벗긴 수 = 1(b) — 2 면 넘기기가 안 돈 것(꼭대기를 다시 벗김)`).toBe(1);
  expect(errs).toEqual([]);
});

test('M4 짝 — 넘겨받은 memo 가 «그 항목의» 벗긴 꼴이다: Y 로 바꾼 뒤 X 로 되돌리는 편집이 «같다»로 먹히지 않는다', async ({ page }) => {
  /* 짝이 어긋나 꼭대기(Y) memo 에 X 의 벗긴 꼴이 들어가면 X 로 되돌린 편집을 «무변화»로 읽어 안 쌓는다(T-130 병 — 가장 위험). */
  const errs = await setup(page);
  await page.evaluate(() => { document.getElementById('sM').style.height = '300px'; window.pushHistory('x'); });
  await page.evaluate(() => { document.getElementById('sM').style.height = '360px'; window.pushHistory('y'); });   // 꼭대기 = Y (넘겨받은 memo)
  const ty = await tip(page);
  await page.evaluate(() => { document.getElementById('sM').style.height = '300px'; window.pushHistory('back-x'); });
  const tx = await tip(page);
  expect(tx.seq, 'X 로 되돌린 편집이 새 칸으로 쌓였다 — 안 쌓이면 memo 짝이 어긋난 것').not.toBe(ty.seq);
  await clip(page, 'inset(4px)'); await page.evaluate(() => window.pushHistory());
  expect((await tip(page)).seq, '그리고 X 위 --sec-clip 만 다르면 무변화(memo = X 의 것)').toBe(tx.seq);
  expect(errs).toEqual([]);
});
