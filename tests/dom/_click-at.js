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

async function clickAt(page, x, y, expectSpec, { label = '', dbl = false, button = 'left' } = {}) {   // button:'right' = 우클릭(E93 ⑤)
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
  if (dbl) await page.mouse.dblclick(x, y, { button }); else await page.mouse.click(x, y, { button });
  return { hit: ok.hit, x, y };
}

/* 그 요소를 «맞히는» 점 — 가운데부터 안쪽 격자. 두 rAF 를 먼저 기다린다(손잡이 자리 잡은 뒤).
 *   까닭(int-3 · 261110): t2-02b 전체 상자 손잡이(.ss-union-handle 7px · js/selection-overlay.js _placeUnionHandles)는 선택이 바뀐 «다음 rAF» 에
 *   변 가운데·모서리에 붙는다 ⇒ 다음 ⌘클릭 대상의 한가운데를 가릴 때가 있고, 그게 rAF 타이밍에 따라 갈렸다
 *   (sticker-multisel-c1 S2 3/6 · group-scale-marking-t202 T3·T5). 손잡이가 이기는 것은 제품 규약(낱개 손잡이 _onHandleMouseDown 도 수식키를 안 본다).
 *   ⛔못 찾으면 가운데를 돌려준다 — clickAt 단언이 무엇을 맞혔는지 찍고 빨강이다(잣대 그대로). */
async function freePointOn(page, sel) {
  return page.evaluate(async (sel) => {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const el = document.querySelector(sel), q = el.getBoundingClientRect();
    for (const [fx, fy] of [[.5, .5], [.35, .35], [.65, .35], [.35, .65], [.65, .65], [.25, .5], [.75, .5], [.5, .25], [.5, .75]]) {
      const x = q.left + q.width * fx, y = q.top + q.height * fy, e = document.elementFromPoint(x, y);
      if (e && (e === el || el.contains(e))) return [x, y];
    }
    return [q.left + q.width / 2, q.top + q.height / 2];
  }, sel);
}

module.exports = { clickAt, hitAt, freePointOn };
