/* graph-old-axis-tick-edit-150.dom.spec.js — 150 GRAPH-SAVED-TICK-OLD-MARKUP-UNCLICKABLE-01 ㉡(지디 판정 «블럭보다 위 위임»)
 *
 * ★원문(시트 150): 「저장본의 축 눈금이 옛 마크업(data-grb-tick · pointer-events:auto 없음)이라 위임이 걸려도 못 누른다 ⇒ 축 눈금 캔버스 편집이 저장본에서 안 된다」
 * ★잰 값(S3 실앱 5e4256d1 ×3 · 현빈 저장본 사본 proj_1792549411283 sha 22d1bbcce7bd · 읽기만): 눈금 6/6 옛 꼴 · 「20」 눈금 더블클릭 → 편집 0 · 점 밑 임자 = 프레임.
 * ★처방 — js/drag-utils.js OLD_AXIS_TICK_SEL(옛 꼴만 · 술어 한 자리) · document capture dblclick 이 «점이 옛 눈금 상자 안»일 때만
 *   그 그래프를 renderGraph 로 새 꼴로 다시 그리고 같은 순번 눈금 편집(_graphAxisTickBeginEdit)을 연다.
 *
 * ★칸
 *   P  전제 — 막대 그래프 · 축 켬 · 눈금을 옛 꼴로 되돌렸다(data-grb-tick 0 · pointer-events 안 밝힘 = 저장본 꼴)
 *   O1 옛 눈금 더블클릭(진짜 마우스) ⇒ 그 눈금 편집(contenteditable) · 새 꼴로 다시 그려짐(data-grb-tick 생김)
 *   O2 편집 확정(글자 바꿈 + Enter) ⇒ dataset.axisTickText 에 그 눈금 키로 실림
 *   N1 (지키는 칸) 옛 눈금 «밖»(그래프 몸통) 더블클릭 ⇒ 눈금 편집 0 · 옛 꼴 그대로(다시 그리지 않음 — 바이트 무변)
 * ⛔고정 대기 0 — 조건 대기만.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  const id = await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="sG" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>');
    window.rebindAll?.(); window.applyZoom?.(100);
    const S = document.getElementById('sG'); window.selectSection(S); window.addGraphBlock({ chartType: 'bar-v' });
    const g = [...document.querySelectorAll('#sG .graph-block')].pop();
    g.dataset.showAxis = '1'; window.renderGraph(g);
    /* 저장본 꼴로 되돌림 — 옛 판은 data-grb-tick · pointer-events:auto · title 이 없었다(drag-utils.js 1017t1f6㉠ 이전) */
    g.querySelectorAll('.grb-ov-tick').forEach((t) => { t.removeAttribute('data-grb-tick'); t.removeAttribute('title'); t.style.pointerEvents = ''; });
    window.deselectAll?.(); g.scrollIntoView({ block: 'center' });
    return g.id;
  });
  await page.waitForFunction(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
  return { errs, id };
}
const S = (page, id) => page.evaluate((id) => { const g = document.getElementById(id); const t = [...g.querySelectorAll('.grb-ov-tick')];
  return { n: t.length, newMarkup: g.querySelectorAll('.grb-ov-tick[data-grb-tick]').length, ce: g.querySelector('.grb-ov-tick[contenteditable="true"]')?.textContent.trim() ?? null, editing: g.classList.contains('editing'), ov: g.dataset.axisTickText ?? null }; }, id);
/* 눈금 자리가 «멈춘» 뒤에 잰다 — 스크롤·배치가 끝나기 전에 재면 누르는 순간 눈금이 딴 데 있다(실측: 세 판 좌표가 셋 다 달랐다) */
const tickPt = (page, id, i) => page.evaluate(([id, i]) => new Promise((res) => {
  let last = null, same = 0, n = 0;
  const tick = () => { const e = document.getElementById(id).querySelectorAll('.grb-ov-tick')[i]; const r = e.getBoundingClientRect(); const k = Math.round(r.left) + ',' + Math.round(r.top);
    same = k === last ? same + 1 : 0; last = k; n++;
    if (same >= 5 || n > 120) res({ x: r.left + r.width / 2, y: r.top + r.height / 2, text: e.textContent.trim(), stable: same >= 5 }); else requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}), [id, i]);

test('P·O1·O2 ★옛 꼴 눈금 더블클릭 ⇒ 편집 · 확정 저장', async ({ page }) => {
  const { errs, id } = await setup(page);
  const s0 = await S(page, id);
  expect([s0.n > 1, s0.newMarkup], 'P 눈금 있음 · 새 꼴 0').toEqual([true, 0]);
  const g = await page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return { x: r.left + 20, y: r.top + 20 }; }, id);
  await page.mouse.click(g.x, g.y);
  await page.waitForFunction((id) => document.getElementById(id).classList.contains('selected'), id, { timeout: 3000 });
  const p = await tickPt(page, id, 1);
  expect(p.stable, '전제: 눈금 자리가 멈췄다').toBe(true);
  await page.mouse.dblclick(p.x, p.y);
  await page.waitForFunction((id) => !!document.getElementById(id).querySelector('.grb-ov-tick[contenteditable="true"]'), id, { timeout: 3000 });
  const s1 = await S(page, id);
  expect({ ce: s1.ce, editing: s1.editing, newMarkup: s1.newMarkup }, 'O1 그 눈금 편집 · 새 꼴').toEqual({ ce: p.text, editing: true, newMarkup: s0.n });
  await page.keyboard.press('Meta+a'); await page.keyboard.type('스물'); await page.keyboard.press('Enter');
  await page.waitForFunction((id) => !!document.getElementById(id).dataset.axisTickText, id, { timeout: 3000 });
  const s2 = await S(page, id);
  expect(JSON.parse(s2.ov), 'O2 덮어쓴 글자').toEqual({ [p.text]: '스물' });
  expect(errs).toEqual([]);
});

test('N1 옛 눈금 «밖» 더블클릭 ⇒ 눈금 편집 0 · 옛 꼴 그대로', async ({ page }) => {
  const { errs, id } = await setup(page);
  const g = await page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return { x: r.left + r.width * 0.6, y: r.top + r.height * 0.5 }; }, id);
  await page.mouse.click(g.x, g.y);
  await page.waitForFunction((id) => document.getElementById(id).classList.contains('selected'), id, { timeout: 3000 });
  await page.mouse.dblclick(g.x, g.y);
  await page.waitForFunction(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
  const s = await S(page, id);
  expect({ ce: s.ce, newMarkup: s.newMarkup }, 'N1').toEqual({ ce: null, newMarkup: 0 });
  expect(errs).toEqual([]);
});
