/* shared-click-guard-consumers-140.dom.spec.js — ★140 ⒜ 공용 클릭 루프(js/block-drag.js 「grid/infocard … 클릭-선택」)의 «편집 중이면 재선택 안 함» 가드 소비자 명부.
 * 지디 판정(261026): 소비자 = ★다섯(grid · modal · quote · radial · table) — 캔버스 첫 글 더블클릭으로 편집이 «들어가는» 블럭.
 *   넷(infocard · innercard · qa · coupon) = 지킬 것 없음 → SKIP(⛔FAIL 아님) — 앱 실측(45bb7d6e · 인텔 · t140g): 첫 글 더블클릭 → 편집 칸 0.
 * 자(다섯): 첫 글 더블클릭 → 편집 칸이 선다 → 그 칸 안 제자리 누르고 떼기 → 편집 칸이 «산다» · 블럭 고름 그대로.
 * ⚠️가드를 무력화해도 grid·modal·quote·radial 은 편집이 산다(다른 막이 있다 · 앱 실측) — 가드가 «지금» 일하는 건 table 뿐. 이 명부는 «행위»를 잠근다(가드 혼자의 자 아님).
 * 기다림은 전부 조건 — 고정 대기 0. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const FIVE = [['grid', 'addGridBlock', '.grid-block'], ['modal', 'addModalBlock', '.modal-block'], ['quote', 'addQuoteBlock', '.quote-block'], ['radial', 'addRadialBlock', '.radial-block'], ['table', 'addTableBlock', '.table-block']];
const FOUR = [['infocard', 'DIV.ifc-label'], ['innercard', 'DIV.grd-line grd-h2'], ['qa', 'SPAN'], ['coupon', 'DIV.tb-cpn-line']];

async function setup(page, add, cls) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  const id = await page.evaluate(([add, cls]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="gS" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>');
    window.rebindAll?.(); window.applyZoom?.(100);
    window.selectSection(document.getElementById('gS')); window[add]();
    const b = [...document.querySelectorAll('#gS ' + cls)].pop(); window.deselectAll?.(); b.scrollIntoView({ block: 'center' }); return b.id;
  }, [add, cls]);
  await waitStableRect(page, '#' + id);
  return { errs, id };
}

for (const [name, add, cls] of FIVE) {
  test(`C-${name} 소비자 — 첫 글 더블클릭 → 편집 → 그 칸 안 누르고 떼도 편집이 산다`, async ({ page }) => {
    const { errs, id } = await setup(page, add, cls);
    const corner = await page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + 5, r.top + 4]; }, id);
    await page.mouse.click(corner[0], corner[1]);
    await expect.poll(() => page.evaluate((id) => document.getElementById(id).classList.contains('selected'), id), { message: '[전제] 블럭이 골라졌다' }).toBe(true);
    const t = await page.evaluate(([id, name]) => { const b = document.getElementById(id); let el = name === 'table' ? b.querySelector('th') : null;
      if (!el) el = [...b.querySelectorAll('*')].find(e => e.children.length === 0 && e.textContent.trim().length >= 2 && e.offsetWidth > 10 && getComputedStyle(e).visibility !== 'hidden');
      const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, [id, name]);
    await page.mouse.dblclick(t[0], t[1]);
    await expect.poll(() => page.evaluate((id) => !!document.getElementById(id).querySelector('[contenteditable="true"]'), id), { message: '[전제] 편집 칸이 섰다' }).toBe(true);
    const e = await page.evaluate((id) => { const r = document.getElementById(id).querySelector('[contenteditable="true"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, id);
    await page.mouse.move(e[0], e[1]); await page.mouse.down(); await page.mouse.up();
    await page.waitForFunction(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
    expect(await page.evaluate((id) => { const b = document.getElementById(id); return [!!b.querySelector('[contenteditable="true"]'), b.classList.contains('selected')]; }, id), '편집 칸 살아 있음 · 블럭 고름').toEqual([true, true]);
    expect(errs).toEqual([]);
  });
}
for (const [name, hit] of FOUR) {
  test.skip(`C-${name} — 지킬 것 없음(SKIP · FAIL 아님): 앱 실측 45bb7d6e · 첫 글(${hit}) 더블클릭 → 편집 칸 0 · 캔버스 더블클릭 편집이 없는 블럭`, () => {});
}
