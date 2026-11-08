/* t906-bring-forward-14.dom.spec.js — T906-BRING-FORWARD-BACK-KEY-DEAD-01 (0.9.10 · 현빈 7125)
 *   S7 t906 표의 ⌘] ⌘[ 먹통 14칸(t906-results.json layerorder · «⌘] ⌘[ 먹통»)을 같은 하네스(_t905-ops buildCell·pick)로 잰다.
 *   칸마다: 같은 그릇에 글자 형제 T 를 넣고 → 블럭을 진짜 클릭으로 고름(B안 더블클릭 진입 포함) → T 쪽으로 ⌘] 또는 ⌘[
 *     ⇒ 블럭·T 의 문서 순서가 뒤집힌다(겹침 순서 = 형제 순서) · 블럭 선택 유지 · ⌘Z 한 번 = 캔버스 직렬 바이트 그대로.
 *   원인 둘(editor.js moveSelectedBlocks 겹침 갈래): ① 자유 프레임 안 .row 래퍼가 단위인데 블럭만 봤다 ② 깊이 2 에서 .selected 로 남은 부모 프레임이 단위로 잡혔다.
 *   ⚠️joker-block stack 1칸은 빼 둔다 — 떠 있는 조커 vs 흐름 글자는 DOM 순서로 겹침이 안 바뀐다(positioned > static) ⇒ 뜻을 정해야 한다(지디·현빈 질문 · test.fixme).
 * ★양성대조: 고치기 전 판(c61110044 editor.js)에서 13칸 전부 빨강. */
const { test, expect } = require('@playwright/test');
const fs = require('fs'); const path = require('path');
const { bootApp } = require('./_root-harness.js');
const O = require('./_t905-ops.js');
const J = require('./_t904-judge.js');
const FILE = JSON.parse(fs.readFileSync(path.join(__dirname, 't904-cells.json'), 'utf8'));

const CELLS = [
  ['asset-block', 'deep2', 'entry'], ['banner02-block', 'deep2', 'entry'], ['canvas-block', 'deep2', 'entry'], ['coupon-block', 'deep2', 'entry'],
  ['grid-block', 'deep2', 'entry'], ['grid-block', 'free', 'entry'], ['icon-block', 'deep2', 'entry'], ['innercard-block', 'deep2', 'entry'],
  ['innercard-block', 'free', 'entry'], ['radial-block', 'deep2', 'entry'], ['step-block', 'deep2', 'entry'], ['step-block', 'free', 'entry'],
];
/* zoom-block · deep2 · group 은 아래 따로 — 그 자리 확대블럭은 클릭이 안 닿는다(pointer-events:none · 레이어 줄 고르기도 실패 = «고르기» 별건).
   ⌘] 판정만 보려고 «다른 깊이 2 칸이 진짜 클릭으로 도달하는 선택 상태»(섹션·부모 프레임·블럭 .selected + _activeFrame=부모)를 직접 세운다. */
/** 같은 그릇(블럭의 가장 가까운 프레임)에 글자 형제 — _t906-ops addSibling 과 같은 길 */
const addSibling = (page, id) => page.evaluate(({ id, FR }) => { const e = document.getElementById(id); const par = e.parentElement.closest(FR); const sec = e.closest('.section-block');
  window.deselectAll(); window.selectSection(sec); window._activeFrame = par; const before = new Set(sec.querySelectorAll('.text-block'));
  window.addTextBlock('body', { content: 'T' }); const tb = [...sec.querySelectorAll('.text-block')].find((x) => !before.has(x)); window._activeFrame = null; window.deselectAll(); window.clearHistory?.(); return tb?.id; }, { id, FR: J.FR });
const synthPick = (page, id) => page.evaluate(({ id, FR }) => { const e = document.getElementById(id); const par = e.parentElement.closest(FR); const sec = e.closest('.section-block');
  window.deselectAll(); sec.classList.add('selected'); par.classList.add('selected'); window._activeFrame = par; e.classList.add('selected'); return true; }, { id, FR: J.FR });
const after = (page, id, t) => page.evaluate(({ id, t }) => !!(document.getElementById(id).compareDocumentPosition(document.getElementById(t)) & Node.DOCUMENT_POSITION_FOLLOWING), { id, t });

for (const [cls, place, route, synth] of [...CELLS, ['zoom-block', 'deep2', 'group', true]]) test(`${cls} · ${place} · ${route}${synth ? ' (선택 상태 직접 · 클릭 고르기 별건)' : ''} — ⌘]/⌘[ 가 형제 순서를 바꾸고 ⌘Z 한 번에 돌아온다`, async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1500, height: 1400 }); await bootApp(page); page.on('dialog', (d) => d.dismiss().catch(() => {}));
  const kind = FILE.kinds.find((x) => x.cls === cls);
  const b = await O.buildCell(page, kind, place, route);
  expect(b.id, `칸을 못 지음: ${b.err}`).toBeTruthy();
  const t = await addSibling(page, b.id); await J.settle(page);
  expect(t, '[전제] 같은 그릇 글자 형제').toBeTruthy();
  /* 새 글자가 (0,0) 근처에 떠 작은 블럭(아이콘·쿠폰)을 덮으면 클릭이 글자에 간다 — 겹침 순서와 무관하게 글자 «단위»만 블럭 아래로 비킨다 */
  await page.evaluate(({ id, t }) => { const tf = document.getElementById(t).closest('.frame-block[data-text-frame]') || document.getElementById(t);
    if (tf.style.position === 'absolute') { const r = document.getElementById(id).offsetHeight; tf.style.top = ((parseFloat(tf.style.top) || 0) + r + 120) + 'px'; } window.clearHistory?.(); }, { id: b.id, t });
  await J.settle(page);
  const base = await J.serial(page);
  const k = synth ? { ok: await synthPick(page, b.id) } : await O.pick(page, b.id);
  expect(k.ok, '[전제] 블럭을 골랐다').toBe(true);
  const o0 = await after(page, b.id, t);
  await page.keyboard.press(o0 ? 'Meta+]' : 'Meta+[');
  await J.settle(page);
  expect(await after(page, b.id, t), `${o0 ? '⌘]' : '⌘['} 뒤 형제 순서가 뒤집힌다`).toBe(!o0);
  expect(await page.evaluate((id) => document.getElementById(id).classList.contains('selected'), b.id), '블럭 선택 유지').toBe(true);
  await page.keyboard.press('Meta+z'); await J.settle(page);
  const u = await J.judgeUndo(page, base);   // 하네스 공용 비교(draggable·style 선언 순서는 soft — t904 규약)
  expect(u.red, `⌘Z 한 번 = 캔버스 그대로 — ${JSON.stringify(u.diffs).slice(0, 400)}`).toBe(false);
});

test.fixme('joker-block · stack — 떠 있는 조커 vs 흐름 글자: ⌘]/⌘[ 의 뜻 미정(지디·현빈 질문)', async () => {});
