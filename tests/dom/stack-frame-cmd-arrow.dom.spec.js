/* stack-frame-cmd-arrow — 스택 프레임 안에서 블럭을 골라 ⌘↑/⌘↓ 하면 «그 블럭»이 옮겨진다 (수지④ · 2026-10-08 지디 배정 T3).
 *
 * 수지 원문(현빈 4018 전달): 「스택모드에서 블럭을 선택후 커맨드 위아래를 하면 블럭간 이동이되어야되는데 그게 안된다. (드래그로는 가능한데)」
 * 재현(3141ccec · 5f177748 · 진짜 손): 프레임 클릭 → 자식 클릭(선택 = [섹션, 프레임, 글자]) → ⌘↑ ⇒ 프레임 안·섹션 순서 둘 다 무변.
 * 장면: 앱 함수로 자유배치 프레임에 글자 둘 → 앱의 스택 변환(__convertFreeLayoutToStack — 패널 「스택」 단추가 부르는 그 함수).
 *   변환은 자식 사이에 gap 블럭을 끼운다(실측 [gap, 글1, gap, 글2, gap]) — 그래서 «글2 가 글1 앞으로» 를 «몇 번 안에» 로 잰다.
 * 머리표: SM1 [새 것] 고치기 전 판에서 빨강 · SM2·SM3 [지킴·음성대조] 고치기 전에도 초록이어야.
 * 규율: 누를 자리는 «누르기 직전»에 다시 잰다(첫 클릭 뒤 줌이 늦게 서서 자리가 바뀐다 — 2026-10-08 실측 344→516).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page, { stack = true } = {}) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  await bootApp(page);
  const ids = await page.evaluate((stack) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="sSM" data-section="1"><div class="section-hitzone"><span class="section-label">sSM</span></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>`);
    window.rebindAll?.(); window.applyZoom?.(60);
    const sec = document.getElementById('sSM');
    const made = (sel, fn) => { const b = new Set([...document.querySelectorAll('#canvas ' + sel)].map(e => e.id)); fn(); return [...document.querySelectorAll('#canvas ' + sel)].find(e => !b.has(e.id)); };
    window.deselectAll?.(); window._activeFrame = null; window.selectSection?.(sec);
    const top = made('.text-block', () => window.addTextBlock('body'));   // 섹션 직속 글자(프레임 위)
    window.deselectAll?.(); window._activeFrame = null; window.selectSection?.(sec);
    const fr = made('.frame-block:not([data-text-frame])', () => window.addFrameBlock());
    const kids = [0, 1].map(i => {
      window.deselectAll?.(); window._activeFrame = fr;
      const t = made('.text-block', () => window.addTextBlock('body'));
      const ed = t.querySelector('[contenteditable]') || t.querySelector('[class^="tb-"]'); if (ed) ed.textContent = '글 ' + (i + 1);
      const tu = t.closest('.frame-block[data-text-frame]') || t; tu.style.left = '60px'; tu.style.top = (40 + i * 120) + 'px'; tu.style.width = '300px';
      return { tb: t.id, tu: tu.id };
    });
    fr.style.height = '320px'; fr.style.minHeight = '320px';
    if (stack) window.__convertFreeLayoutToStack(fr);
    window.deselectAll?.(); window._activeFrame = null; window.buildLayerPanel?.();
    const inner = sec.querySelector('.section-inner');
    const unit = (e) => { let u = e; while (u && u.parentElement !== inner) u = u.parentElement; return u; };
    return { fr: fr.id, kids, topUnit: unit(top).id, topTb: top.id, frStack: fr.dataset.freeLayout !== 'true' };
  }, stack);
  await page.waitForTimeout(800);
  return ids;
}
const pt = (page, id, fx = 0.5, fy = 0.5) => page.evaluate(({ id, fx, fy }) => { const r = document.getElementById(id).getBoundingClientRect(); return { x: r.left + r.width * fx, y: r.top + r.height * fy }; }, { id, fx, fy });
async function clickOn(page, id, fx, fy, expectId) {
  const p = await pt(page, id, fx, fy);
  const ok = await page.evaluate(({ x, y, id }) => !!document.elementFromPoint(x, y)?.closest('#' + id), { x: p.x, y: p.y, id: expectId || id });
  expect(ok, `[전제] 누르는 점이 #${expectId || id} 위다`).toBe(true);
  await page.mouse.click(p.x, p.y); await page.waitForTimeout(500);
}
const frOrder = (page, ids) => page.evaluate((ids) => [...document.getElementById(ids.fr).children].map(c => c.id).filter(id => ids.kids.some(k => k.tu === id)), ids);
const secOrder = (page) => page.evaluate(() => [...document.querySelector('#sSM .section-inner').children].map(c => c.id || c.className.split(' ')[0]));
const sel = (page) => page.evaluate(() => [...document.querySelectorAll('#canvas .selected')].map(e => e.id));

test('SM1 ★스택 프레임 안 글자를 골라 ⌘↑ — 그 글자가 위로 간다 · 프레임은 제자리', async ({ page }) => {
  const ids = await scene(page);
  expect(ids.frStack, '[전제] 스택으로 바뀌었다').toBe(true);
  await clickOn(page, ids.fr, 0.9, 0.95);                               // 첫 클릭 = 프레임
  await clickOn(page, ids.kids[1].tu, 0.2, 0.5, ids.kids[1].tu);       // 두 번째 = 안의 글자(드릴인)
  expect(await sel(page), '[전제] 글2 가 골라졌다(드릴인)').toContain(ids.kids[1].tb);
  const o0 = await frOrder(page, ids), s0 = await secOrder(page);
  expect(o0, '[전제] 프레임 안 순서 = 글1, 글2').toEqual([ids.kids[0].tu, ids.kids[1].tu]);
  let n = 0;
  for (; n < 3; n++) { await page.keyboard.press('Meta+ArrowUp'); await page.waitForTimeout(250); const o = await frOrder(page, ids); if (o[0] === ids.kids[1].tu) break; }
  const o1 = await frOrder(page, ids), s1 = await secOrder(page);
  expect(s1, `프레임(또는 섹션의 다른 블럭)이 옮겨졌다 — 섹션 ${s0} → ${s1}`).toEqual(s0);
  expect(o1, `⌘↑ ${n + 1}번에도 글2 가 글1 위로 안 갔다 — ${o0} → ${o1}`).toEqual([ids.kids[1].tu, ids.kids[0].tu]);
  expect(await sel(page), '옮긴 뒤에도 글2 가 골라져 있다').toContain(ids.kids[1].tb);
});

test('SM2 [지킴·음성대조] 프레임을 «통째로» 골라 ⌘↑ — 프레임이 섹션에서 위로 간다', async ({ page }) => {
  const ids = await scene(page);
  await clickOn(page, ids.fr, 0.9, 0.95);
  expect(await sel(page), '[전제] 프레임만 골라졌다(자식 아님)').not.toContain(ids.kids[1].tb);
  const s0 = await secOrder(page);
  const fi0 = s0.indexOf(ids.fr), ti0 = s0.indexOf(ids.topUnit);
  expect(ti0 < fi0, `[전제] 섹션 직속 글자가 프레임보다 위 — ${s0}`).toBe(true);
  for (let n = 0; n < 3; n++) { await page.keyboard.press('Meta+ArrowUp'); await page.waitForTimeout(250); const s = await secOrder(page); if (s.indexOf(ids.fr) < s.indexOf(ids.topUnit)) break; }
  const s1 = await secOrder(page);
  expect(s1.indexOf(ids.fr) < s1.indexOf(ids.topUnit), `프레임이 위로 안 갔다 — ${s0} → ${s1}`).toBe(true);
});

test('SM3 [지킴·음성대조] 섹션 직속 글자를 골라 ⌘↓ — 그 글자가 아래로 간다', async ({ page }) => {
  const ids = await scene(page);
  await clickOn(page, ids.topTb, 0.2, 0.5);
  expect(await sel(page), '[전제] 섹션 직속 글자가 골라졌다').toContain(ids.topTb);
  const s0 = await secOrder(page);
  for (let n = 0; n < 3; n++) { await page.keyboard.press('Meta+ArrowDown'); await page.waitForTimeout(250); const s = await secOrder(page); if (s.indexOf(ids.topUnit) > s.indexOf(ids.fr)) break; }
  const s1 = await secOrder(page);
  expect(s1.indexOf(ids.topUnit) > s1.indexOf(ids.fr), `글자가 아래로 안 갔다 — ${s0} → ${s1}`).toBe(true);
});
