/* frame-grid-dblclick-parity — 프레임 «자식» 진입이 그리드 «줄» 진입과 같은 움직임이다 (수지④ · 현빈 2026-10-08 「그리드블럭의 줄 블럭과 같은 움직임」).
 *
 * 실측(2026-10-08 · dev 04320d84 · 코드 변경 0): 네 동작 모두 같은 끝 상태 ⇒ «이미 같다» — 이 검사가 그 상태를 잠근다.
 *   클릭 = 그릇만 골라짐 · 클릭→(0.7초)→클릭 = 안(줄/자식)이 골라짐·편집 아님 · 더블클릭 = 안 골라짐 + 편집 · 클릭→더블클릭 = 같다.
 * ★항등식이 아니다: 두 길은 «다른 처리기»다 — 그리드 = block-drag.js isGrid dblclick → _gridBeginEdit · 프레임 글자 = block-drag.js isText dblclick.
 *   양쪽 다 «같은 글자 표»(EXPECT)에 단다 — 서로에게서 기대값을 끌어오지 않는다.
 *   양성대조(커밋 메시지에 판·수): isText dblclick 을 끈 판 → 프레임 더블 두 칸만 빨강 · isGrid dblclick 을 끈 판 → 그리드 더블 두 칸만 빨강.
 * ⛔이 검사가 «안» 잠그는 것: 프레임 «빈 곳» 더블클릭(그리드엔 대응 자리가 없다 · 수지 답 대기) · 편집 중 재더블클릭의 선택 범위(그리드=낱말 · 프레임=전체 — 실측 차이).
 * 규율: 누를 자리는 «누르기 직전» 다시 재고 [전제] 그 점이 대상 위다(첫 클릭 뒤 줌이 늦게 서 자리가 바뀐다 — 2026-10-08 실측).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const EXPECT = {
  'click':       { inner: false, editing: false },
  'click+click': { inner: true,  editing: false },
  'dbl':         { inner: true,  editing: true },
  'click+dbl':   { inner: true,  editing: true },
};

async function scene(page, target) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  await bootApp(page);
  return page.evaluate((target) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="sDP" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>`);
    window.rebindAll?.(); window.applyZoom?.(60);
    const sec = document.getElementById('sDP');
    const made = (sel, fn) => { const b = new Set([...document.querySelectorAll('#canvas ' + sel)].map(e => e.id)); fn(); return [...document.querySelectorAll('#canvas ' + sel)].find(e => !b.has(e.id)); };
    window.deselectAll?.(); window._activeFrame = null; window.selectSection?.(sec);
    if (target === 'grid') { const g = made('.grid-block', () => window.addGridBlock()); window.deselectAll?.(); return { host: g.id }; }
    const fr = made('.frame-block:not([data-text-frame])', () => window.addFrameBlock());
    window.deselectAll?.(); window._activeFrame = fr; const t = made('.text-block', () => window.addTextBlock('body'));
    const ed = t.querySelector('[contenteditable]') || t.querySelector('[class^="tb-"]'); if (ed) ed.textContent = '안의 글';
    const tu = t.closest('.frame-block[data-text-frame]') || t; tu.style.left = '60px'; tu.style.top = '40px'; tu.style.width = '300px';
    fr.style.height = '240px'; fr.style.minHeight = '240px';
    window.deselectAll?.(); window._activeFrame = null;
    return { host: fr.id, child: tu.id, tb: t.id };
  }, target);
}
const point = (page, target, ids) => page.evaluate(({ target, ids }) => {
  const el = target === 'grid' ? document.querySelector('#' + ids.host + ' .grd-line') : document.getElementById(ids.child);
  if (!el) return null;
  const r = el.getBoundingClientRect(); return { x: r.left + r.width * 0.3, y: r.top + r.height * 0.5 };
}, { target, ids });
async function press(page, target, ids, how) {
  const p = await point(page, target, ids);
  expect(p, `[전제] ${target} 의 안쪽(줄/자식)이 있다`).toBeTruthy();
  const hit = await page.evaluate(({ x, y, host }) => !!document.elementFromPoint(x, y)?.closest('#' + host), { ...p, host: ids.host });
  expect(hit, `[전제] 누르는 점이 ${target} 위다`).toBe(true);
  if (how === 'dbl') await page.mouse.dblclick(p.x, p.y); else await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(700);
}
const state = (page, target, ids) => page.evaluate(({ target, ids }) => {
  const host = document.getElementById(ids.host);
  const inner = target === 'grid'
    ? !!(window.grdGetActiveLine?.(host)) && document.querySelectorAll('#' + ids.host + ' .grd-line-selected').length === 1
    : document.getElementById(ids.tb).classList.contains('selected');
  return { hostSel: host.classList.contains('selected'), inner, editing: !!document.querySelector('#canvas .editing') || !!document.activeElement?.isContentEditable };
}, { target, ids });

for (const target of ['grid', 'frame']) {
  for (const g of Object.keys(EXPECT)) {
    test(`DP ${target} · ${g} — 끝 상태가 표와 같다(그리드 줄 = 프레임 자식)`, async ({ page }) => {
      const ids = await scene(page, target);
      await page.waitForTimeout(800);
      if (g === 'dbl') await press(page, target, ids, 'dbl');
      else {
        await press(page, target, ids, 'click');
        const s1 = await state(page, target, ids);
        expect(s1, '[전제] 첫 클릭 = 그릇만 골라짐 · 편집 아님').toEqual({ hostSel: true, inner: false, editing: false });
        if (g === 'click+click') await press(page, target, ids, 'click');
        if (g === 'click+dbl') await press(page, target, ids, 'dbl');
      }
      const s = await state(page, target, ids);
      expect(s.hostSel, `${target} ${g}: 그릇 선택이 풀렸다`).toBe(true);
      expect({ inner: s.inner, editing: s.editing }, `${target} ${g}: 진입 움직임이 표와 다르다`).toEqual(EXPECT[g]);
    });
  }
}
