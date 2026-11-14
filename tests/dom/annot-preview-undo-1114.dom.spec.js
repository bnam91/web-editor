/* annot-preview-undo-1114.dom.spec.js — ANNOT-PREVIEW-LEFT-AFTER-UNDO-01 (0.9.13 당김 · 현빈 GO · 261114)
 *   증상 ⑴(앱 ×3): 치수선·펜을 만들고 ⌘Z → 그리던 미리보기(.annot-preview)가 캔버스에 남는다.
 *   증상 ⑵(imac-gd-L5 J229F ×3): 세 클릭 치수선 → 곧바로 ⌘Z → 블럭 1·자리 그대로(먹통 한 칸).
 *   뿌리(읽기 → 둘이 다르다):
 *     ⑴ _finalizeAnnotation 의 만들기 «전» 표본(pushHistory)이 _cancelPending «앞»이라 .annot-preview 가 든 캔버스를 찍는다.
 *        저장·기록 직렬화(section-serialize.js serializeCleanRoot)의 지울 목록에 .annot-preview 가 없었다(.vpen-preview 는 있다)
 *        ⇒ ⌘Z 가 그 표본으로 미리보기를 되살린다 · 그리는 중 자동저장이 끼면 저장본에도 실린다(S1).
 *        고침 = 그 목록에 .annot-preview 한 이름(캡처는 capture-safety.js:523 이 이미 지운다).
 *     ⑵ 세 클릭 길은 라벨 편집이 바로 열린다(contenteditable·포커스). editor.js _yieldsUndoToNative 는 자유변형 글상자 말고는
 *        contenteditable 이면 무조건 네이티브 undo 로 넘겨 — 손 안 댄 라벨에선 되돌릴 게 없어 먹통.
 *        고침 = .annot-label 도 글상자와 같은 규칙(이번 진입 뒤 친 글이 있을 때만 네이티브).
 * 칸
 *   U1 치수 두 점+Esc → ⌘Z = 블럭 0 · 미리보기 0
 *   U2 펜 두 점+Esc → ⌘Z = 블럭 0 · 미리보기 0
 *   U3 세 클릭 치수선(라벨 편집 열린 채) → 곧바로 ⌘Z = 블럭 0 · 미리보기 0 · ⌘⇧Z = 블럭 1 · 미리보기 0
 *   S1 그리는 중(두 점) 캔버스 직렬화(저장·기록이 쓰는 getSerializedCanvas)에 annot-preview 0 · 라이브엔 1(전제)
 *   N1 음성 — 세 클릭 뒤 라벨에 글을 치고 ⌘Z = 네이티브(글만 되돌림 · 블럭 1)
 * 양성대조: ⑴ section-serialize.js 의 `.annot-preview, ` 를 걷으면 U1·U2·U3·S1 빨강(미리보기 1 · 직렬화에 실림) · N1 초록
 *   ⑵ editor.js 의 `, .annot-label` 을 걷으면 U3 빨강(블럭 1 = 먹통) · U1·U2·S1·N1 초록
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const B = '#canvas .annotation-block';
const st = (page) => page.evaluate((B) => ({ n: document.querySelectorAll(B).length, pv: document.querySelectorAll('#canvas .annot-preview').length }), B);

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    document.getElementById('canvas').innerHTML = '<div class="section-block" id="secA" style="position:relative;height:520px;background:#f4f4f6"><div class="section-inner"></div></div>';
    window.rebindAll?.(); window.clearHistory?.(); window.applyZoom?.(100); window.deselectAll?.();
    document.getElementById('secA').scrollIntoView({ block: 'center', behavior: 'instant' });
  });
  return { errs, sr: await waitStableRect(page, '#secA') };
}
async function twoPoints(page, sr, tool) {
  await page.click('#fp-pen-dropdown .fp-dropdown-trigger');
  await page.click(`#fp-pen-menu .fp-menu-item[onclick*="${tool}"]`);
  await expect.poll(() => page.evaluate(() => document.body.classList.contains('pen-mode')), '[전제] 펜 모드').toBe(true);
  const y = sr.top + sr.height * 0.6, P = [[sr.left + sr.width * 0.25, y], [sr.left + sr.width * 0.75, y]];
  for (const [k, q] of P.entries()) {
    await page.mouse.click(q[0], q[1]);
    await expect.poll(() => page.evaluate(() => document.querySelectorAll('.annot-preview .annot-preview-dot').length), `[전제] 점 ${k + 1}`).toBeGreaterThanOrEqual(k + 1);
  }
}
const labelEditing = (page) => page.evaluate((B) => { const l = document.querySelector(B + ' .annot-label'); return !!l && l.getAttribute('contenteditable') === 'true' && document.activeElement === l; }, B);
async function threeClicks(page, sr) {
  await twoPoints(page, sr, 'toggleDimMode');
  await page.mouse.click(sr.left + sr.width * 0.5, sr.top + sr.height * 0.3);
  await expect.poll(() => st(page).then(s => s.n), '[전제] 블럭 생김').toBe(1);
  await expect.poll(() => labelEditing(page), '[전제] 라벨 편집 열림(포커스)').toBe(true);
}

for (const [name, tool] of [['U1 치수', 'toggleDimMode'], ['U2 펜', 'togglePenMode']]) {
  test(`${name} 두 점+Esc → ⌘Z = 블럭 0 · 미리보기 0`, async ({ page }) => {
    const { errs, sr } = await setup(page);
    await twoPoints(page, sr, tool);
    await page.keyboard.press('Escape');
    await expect.poll(() => st(page), '[전제] 블럭 1 · 미리보기 걷힘').toEqual({ n: 1, pv: 0 });
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.keyboard.press('Meta+z');
    await expect.poll(() => st(page), '★⌘Z 뒤 미리보기가 되살아났다').toEqual({ n: 0, pv: 0 });
    expect(errs).toEqual([]);
  });
}

test('U3 세 클릭 치수선 → 곧바로 ⌘Z = 만들기 되돌림(먹통 아님) · ⌘⇧Z = 돌아옴 · 미리보기 0', async ({ page }) => {
  const { errs, sr } = await setup(page);
  await threeClicks(page, sr);
  /* 진단(지디 261114 — 고친 판 인텔 U3 n:1): ⌘Z 가 어디로 갔나.
     window 캡처 = 키가 들어왔나 · document 거품(편집기 핸들러 «뒤»에 건 것) = 거기까지 왔나 + defaultPrevented(앱 undo 길만 preventDefault)
     · 앞뒤 기록 꼭대기(pos/len/action) · 초점 요소 · 라벨 innerHTML · queryCommandEnabled('undo') · undo 의 마지막 관문 */
  const pre = await page.evaluate((B) => {
    window.__dz = { cap: null, bub: null };
    window.addEventListener('keydown', (e) => { if (e.metaKey && e.key === 'z') { const a = document.activeElement; window.__dz.cap = { tgt: e.target?.className || e.target?.tagName, ae: a?.className || a?.tagName, ce: !!a?.isContentEditable, html: a?.innerHTML?.slice(0, 80) }; } }, true);
    document.addEventListener('keydown', (e) => { if (e.metaKey && e.key === 'z') window.__dz.bub = { prevented: e.defaultPrevented }; });
    const l = document.querySelector(B + ' .annot-label');
    return { tip: window.getHistoryTip?.(), html: l?.innerHTML?.slice(0, 80), qce: document.queryCommandEnabled('undo') };
  }, B);
  await page.keyboard.press('Meta+z');
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const post = await page.evaluate((B) => ({ dz: window.__dz, tip: window.getHistoryTip?.(), n: document.querySelectorAll(B).length,
    gate: window.getHistoryStripStats?.().lastUndoGate, ae: document.activeElement?.className || document.activeElement?.tagName }), B);
  const diag = JSON.stringify({ pre, post });
  test.info().annotations.push({ type: 'U3 진단', description: diag });
  console.log('[U3 진단]', diag);
  await expect.poll(() => st(page), '★⌘Z 가 먹통(블럭 1) 또는 미리보기 되살림 — 진단 ' + diag).toEqual({ n: 0, pv: 0 });
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+Shift+z');
  await expect.poll(() => st(page), '⌘⇧Z').toEqual({ n: 1, pv: 0 });
  expect(errs).toEqual([]);
});

test('S1 그리는 중 직렬화(저장·기록)에 미리보기가 안 실린다', async ({ page }) => {
  const { errs, sr } = await setup(page);
  await twoPoints(page, sr, 'toggleDimMode');
  const r = await page.evaluate(() => ({ live: document.querySelectorAll('#canvas .annot-preview').length, ser: (window.getSerializedCanvas().match(/annot-preview/g) || []).length }));
  expect(r.live, '[전제] 라이브엔 미리보기').toBeGreaterThan(0);
  expect(r.ser, '★저장·기록 직렬화에 미리보기가 실렸다').toBe(0);
  await page.keyboard.press('Escape');
  expect(errs).toEqual([]);
});

test('N1 음성 — 세 클릭 뒤 라벨에 글을 치고 ⌘Z = 네이티브(블럭 그대로)', async ({ page }) => {
  const { errs, sr } = await setup(page);
  await threeClicks(page, sr);
  await page.keyboard.type('12');
  await page.keyboard.press('Meta+z');
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  expect((await st(page)).n, '친 글이 있으면 ⌘Z 는 글 몫 — 블럭을 지우면 안 된다').toBe(1);
  expect(errs).toEqual([]);
});
