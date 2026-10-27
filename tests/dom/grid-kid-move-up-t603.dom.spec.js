/* grid-kid-move-up-t603.dom.spec.js — t6-03 그리드 밑 자식 블럭 «순서 바꾸기 · 그리드 위로»
 * 원문: 「… ‘+ 블럭 넣기(그리드 밑)’ 드랍다운에서 블럭을 추가하면 그리드 블럭아래에 추가가 되는데 말야. 추가된 그리드 블럭의
 *   신규 블럭이 그리드 블럭 위로 옮기거나 순서를 바꾸고 싶은 경우도 있을건데 그렇게 되게 해줄래?」
 * 지혜(아이맥 · ca702d40 ×3): grd-children 에 들어가고 패널 순서/위로 단추 0 · ⌥↑·⌘↑·⇧⌘↑ → 여전히 칸 밑.
 * 칸
 *   P0  전제 — 그리드 밑 그릇에 자식 둘(A·B 순) · B 를 진짜 클릭하면 B 가 골라진다
 *   O   B 고르고 ⌘↑ → 그릇 안 순서 B·A · 그리드는 제자리
 *   X   이어 ⌘↑ → B 가 그릇 «밖» 그리드 바로 위(같은 흐름 그릇에서 그리드보다 앞) · 그릇엔 A 하나
 *   Z   X 뒤 ⌘Z → B 가 다시 그릇 안
 * 양성대조: GD1001_ROOT=<핀 d772f49e 사본> ⇒ O·X·Z 빨강 · P0 초록.
 * ⛔고정 대기 없음 — waitForFunction 만. ⛔앱 무접촉(_root-harness.bootApp). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    window.addSection(); const sec = c.querySelector('.section-block');
    window.selectSection(sec); window.addGridBlock();
    const g = sec.querySelector('.grid-block'); window.__g = g; window.__sec = sec;
    const a = window.addGridChild(g, 'h2').block; a.querySelector('[class^="tb-"]').textContent = 'A 자식'; a.id = a.id || 'kA'; window.__a = a;
    const b = window.addGridChild(g, 'h2').block; b.querySelector('[class^="tb-"]').textContent = 'B 자식'; window.__b = b;
    window.deselectAll?.(); b.scrollIntoView({ block: 'center' });
  });
  await page.waitForFunction(() => window.__g.querySelectorAll('.grd-children > *').length === 2);
  return errs;
}
const st = (page) => page.evaluate(() => {
  const box = window.__g.querySelector(':scope > .grd-children');
  const kids = box ? [...box.children].map(u => u.contains(window.__a) ? 'A' : u.contains(window.__b) ? 'B' : '?').join('') : '';
  const unitOf = (el) => { let u = el; while (u && u.parentElement && !u.parentElement.classList.contains('section-inner')) u = u.parentElement; return u; };
  const flow = [...window.__sec.querySelector('.section-inner').children];
  const gi = flow.indexOf(unitOf(window.__g)), bi = flow.indexOf(unitOf(window.__b));
  return { kids, bInKids: !!(box && box.contains(window.__b)), bAboveGrid: bi >= 0 && gi >= 0 && bi < gi && !window.__g.contains(window.__b), bSel: window.__b.classList.contains('selected') };
});
async function pickB(page) {
  const p = await page.evaluate(() => { const r = window.__b.getBoundingClientRect(); return [r.left + 8, r.top + r.height / 2]; });
  await page.mouse.click(p[0], p[1]);
  await page.waitForFunction(() => window.__b.classList.contains('selected'));
}

test('P0 전제 — 그릇에 A·B · B 클릭으로 골라짐', async ({ page }) => {
  const errs = await setup(page);
  expect((await st(page)).kids).toBe('AB');
  await pickB(page);
  expect((await st(page)).bSel).toBe(true);
  expect(errs).toEqual([]);
});
test('O ⌘↑ → 그릇 안 B·A', async ({ page }) => {
  const errs = await setup(page); await pickB(page);
  await page.keyboard.press('Meta+ArrowUp');
  await page.waitForFunction(() => { const box = window.__g.querySelector(':scope > .grd-children'); return box && box.firstElementChild?.contains(window.__b); });
  expect(await st(page)).toMatchObject({ kids: 'BA', bInKids: true });
  expect(errs).toEqual([]);
});
test('X 이어 ⌘↑ → B 가 그리드 바로 위(그릇 밖) · 그릇엔 A', async ({ page }) => {
  const errs = await setup(page); await pickB(page);
  await page.keyboard.press('Meta+ArrowUp');
  await page.waitForFunction(() => window.__g.querySelector(':scope > .grd-children')?.firstElementChild?.contains(window.__b));
  await page.keyboard.press('Meta+ArrowUp');
  await page.waitForFunction(() => !window.__g.contains(window.__b));
  expect(await st(page)).toMatchObject({ kids: 'A', bInKids: false, bAboveGrid: true });
  expect(errs).toEqual([]);
});
test('Z X 뒤 ⌘Z → B 가 다시 그릇 안', async ({ page }) => {
  const errs = await setup(page); await pickB(page);
  await page.keyboard.press('Meta+ArrowUp');
  await page.waitForFunction(() => window.__g.querySelector(':scope > .grd-children')?.firstElementChild?.contains(window.__b));
  await page.keyboard.press('Meta+ArrowUp');
  await page.waitForFunction(() => !window.__g.contains(window.__b));
  await page.evaluate(() => { document.activeElement?.blur?.(); window.undo(); });
  await page.waitForFunction(() => { const g = document.querySelector('#canvas .grid-block'); return !!g && g.querySelectorAll(':scope > .grd-children > *').length === 2; });
  expect(errs).toEqual([]);
});
