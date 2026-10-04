/* _click-at.js — 좌표 클릭 «한 벌»(지디 하네스 규율, 2026-10-04 E80 꾸밈 뒤).
 *   누르기 «직전» document.elementFromPoint 를 찍고, 기대(expect)와 안 맞으면 빨강.
 *   까닭: 16:29 판에서 「프레임 모서리」 좌표가 글자 회전 핫존(tb-rotate-zone)을 맞혀 E83(안 움직인 회전도 칸을 찍음)이
 *   «남음»을 만들었다 — 좌표 클릭이 «무엇을» 눌렀는지 안 찍으면 결과의 까닭을 모른다.
 * expect: { sel, not } — 맞힌 요소(또는 그 조상)가 sel 에 맞아야 하고, not 에 맞으면 안 된다. sel 이 '#id' 면 «맞힌 요소 자체»가 그 id 여야 한다.
 * 돌려줌: { hit, x, y } — hit = 맞힌 요소의 id 또는 className. */
const { expect } = require('@playwright/test');

async function hitAt(page, x, y) {
  return page.evaluate(([x, y]) => {
    const e = document.elementFromPoint(x, y);
    if (!e) return null;
    return { id: e.id || '', cls: typeof e.className === 'string' ? e.className : '', tag: e.tagName };
  }, [x, y]);
}

async function clickAt(page, x, y, expectSpec, { label = '', dbl = false } = {}) {
  const ok = await page.evaluate(([x, y, spec]) => {
    const e = document.elementFromPoint(x, y);
    if (!e) return { ok: false, hit: null };
    const desc = e.id || (typeof e.className === 'string' ? e.className : e.tagName);
    let good = true;
    if (spec && spec.sel) {
      if (/^#[\w-]+$/.test(spec.sel)) good = e.id === spec.sel.slice(1);
      else good = !!(e.matches(spec.sel) || e.closest(spec.sel));
    }
    if (good && spec && spec.not) good = !(e.matches(spec.not) || e.closest(spec.not));
    return { ok: good, hit: desc };
  }, [x, y, expectSpec || null]);
  expect(ok.ok, `clickAt${label ? ' ' + label : ''}: (${Math.round(x)},${Math.round(y)}) 맞힌 요소 «${ok.hit}» 가 기대 ${JSON.stringify(expectSpec)} 와 다르다`).toBe(true);
  if (dbl) await page.mouse.dblclick(x, y); else await page.mouse.click(x, y);
  return { hit: ok.hit, x, y };
}

module.exports = { clickAt, hitAt };
