/* layout-std-c3.dom.spec.js — 표준 Layout C3(현빈 261124 L-4/7 · 지디 GO): label-group · row · page · mockup · text · slide · zoom · annotation
 *   ⑴ 옛 Layout 슬라이더가 패널에 0(걷은 id 전수) ⑵ 숫자 칸 id 무변 + 부품 안(data-part="layout" 또는 부품 슬롯) + 라벨 끌기 손잡이(#<id>-scrub)
 *   ⑶ 칸에 값 넣고 change → 블럭에 들어가고 이력 정확히 1 ⑷ 빈 칸 change = 옛 값 되돌림 · 이력 0(부품 동작)
 *   ⛔옛 코드(기준판 P 1baa53b8f)에서는 ⑴·⑵ 가 빨강이어야 한다(재현 빨강).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/layout-std-c3.dom.spec.js --workers=1 --retries=0 --reporter=line */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection(); const sec = c.querySelector('.section-block'); window.__secEl = () => sec;
    window.__ph = 0; const o = window.pushHistory; window.pushHistory = (...a) => { window.__ph++; return o?.(...a); };
  });
  return errs;
}

/* 갈래 = 만들고(make 본문 · 블럭을 돌려준다) · 열고(open) · 걷은 슬라이더(gone) · 남은 숫자 칸(nums) · 한 칸 조작(set: [id, 값, 블럭에서 읽기]) */
const V = [
  { name: 'label-group', make: `return add('label-group-block', () => window.addLabelGroupBlock());`, open: 'showLabelGroupProperties',
    gone: ['lg-width-slider', 'lg-all-height-slider', 'lg-item-height-slider', 'lg-gap-slider'], nums: ['lg-all-height-number', 'lg-gap-number'],
    set: ['lg-gap-number', 20, `b.style.gap`, '20px'] },
  { name: 'row', make: `const r = document.createElement('div'); r.className = 'row'; r.id = 'rowC3'; r.dataset.layout = 'flex'; r.innerHTML = '<div class="col" data-flex="1"><div class="text-block">A</div></div><div class="col" data-flex="1"><div class="text-block">B</div></div>'; sec.querySelector('.section-inner').appendChild(r); return r;`, open: 'showRowProperties',
    gone: ['row-height-slider', 'row-gap-slider', 'row-padx-slider', 'row-child-h-slider'], nums: ['row-height-number', 'row-gap-number', 'row-padx-number', 'row-child-h-number'],
    set: ['row-padx-number', 24, `b.dataset.padX`, '24'] },
  { name: 'page', make: `return null;`, open: 'showPageProperties',
    gone: ['section-gap-slider', 'page-padx-slider', 'page-pady-slider'], nums: ['section-gap-number', 'page-padx-number', 'page-pady-number'],
    set: ['page-pady-number', 30, `document.getElementById('canvas').style.getPropertyValue('--page-pady')`, '30px'] },
  { name: 'mockup', make: `return add('mockup-block', () => window.addMockupBlock());`, open: 'showMockupProperties',
    gone: ['mkp-width-slider'], nums: ['mkp-width-number'], set: ['mkp-width-number', 300, `b.dataset.width`, '300'] },
  { name: 'text', make: `return add('text-block', () => window.addTextBlock('body'));`, open: 'showTextProperties',
    gone: ['txt-pv-slider', 'txt-ph-slider', 'txt-pl-slider', 'txt-pr-slider', 'txt-width-scrub'], nums: ['txt-width-number', 'txt-height-number'],   /* 패딩 칸(txt-pv/ph/pl/pr-number)은 옛 줄 꼴(잠금 사슬·좌/우 줄) 유지 — 부품 밖이 맞다 · 슬라이더 0 은 gone 이 잰다 */
    set: ['txt-width-number', 400, `(document.querySelector('#canvas [data-width="400"]') ? '400' : 'none')`   /* 쓰는 자리 = applyW 가 고른 곳(줄 · 글 프레임 · 글 중 하나 · r2 실측: b 기준 셋 다 undefined) — 캔버스 어디든 data-width=400 이면 들어간 것 */, '400'] },
  { name: 'slide', make: `return add('slide-block', () => window.addSlideBlock());`, open: 'showSlideProperties',
    gone: ['sld-cardw-slider', 'sld-h-slider', 'sld-gap-slider'], nums: ['sld-cardw-number', 'sld-h-number', 'sld-gap-number'],
    set: ['sld-gap-number', -10, `window.readSlideState(b).layout.gap`, '-10'] },
  { name: 'zoom', make: `return add('zoom-block', () => window.addZoomBlock());`, open: 'showZoomProperties',
    gone: ['zm-size'], nums: ['zm-size-num'], set: ['zm-size-num', 200, `b.dataset.size`, '200'] },
  { name: 'annotation', make: `const b = window.makeAnnotationBlock({ points: [[200, 160], [500, 160]], text: '라벨' }); sec.querySelector('.section-inner').appendChild(b); window.bindAnnotationSelect?.(b); return b;`, open: 'showAnnotationProperties',
    gone: ['annot-label-pad'], nums: ['annot-label-pad-num'], set: ['annot-label-pad-num', 12, `b.dataset.labelPad`, '12'] },
];

const run = (page, v) => page.evaluate(async (v) => {
  const sec = window.__secEl();
  const add = (cls, fn) => { window.deselectAll?.(); window.selectSection(sec); const b0 = new Set(sec.querySelectorAll('.' + cls)); fn(); const f = [...sec.querySelectorAll('.' + cls)].find((x) => !b0.has(x)); if (!f) throw new Error('새 ' + cls + ' 없음'); return f; };
  const b = await (new Function('add', 'sec', v.make))(add, sec);
  if (b) window[v.open](b); else { window.deselectAll?.(); window[v.open](); }
  const panel = document.querySelector('#panel-right .panel-body') || document.body;
  const out = {
    gone: v.gone.filter((id) => document.getElementById(id)),
    missing: v.nums.filter((id) => !document.getElementById(id)),
    outsidePart: v.nums.filter((id) => !document.getElementById(id)?.closest('[data-part="layout"], .ui-lay-slot')),
    noScrub: v.nums.filter((id) => !document.getElementById(id)?.disabled && !document.getElementById(id + '-scrub')),
    rangesInLayout: [...panel.querySelectorAll('#psec-size input[type=range], #psec-padding input[type=range]')].map((r) => r.id),
  };
  const [id, val, readSrc, want] = v.set;
  const n = document.getElementById(id); const read = () => String(new Function('b', 'return (' + readSrc + ')')(b));
  window.__ph = 0;
  n.value = String(val); n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true }));
  out.wrote = [read(), window.__ph];
  window.__ph = 0;
  n.value = ''; n.dispatchEvent(new Event('change', { bubbles: true }));
  out.blank = [n.value, read(), window.__ph];
  out.want = want;
  return out;
}, v);

for (const v of V) {
  test(`LC3 [${v.name}] 슬라이더 0 · 숫자 칸 id 무변 = 부품 안 · 라벨 끌기 · 값 = 블럭 + 이력 1 · 빈 칸 = 되돌림 + 이력 0`, async ({ page }) => {
    const errs = await scene(page);
    const o = await run(page, v);
    expect(o.gone, `${v.name}: 걷은 슬라이더가 남았다`).toEqual([]);
    expect(o.missing, `${v.name}: 옛 숫자 칸 id 가 사라졌다`).toEqual([]);
    expect(o.outsidePart, `${v.name}: 숫자 칸이 부품(data-part="layout") 밖`).toEqual([]);
    expect(o.noScrub, `${v.name}: 라벨 끌기 손잡이 없음`).toEqual([]);
    expect(o.rangesInLayout, `${v.name}: Size/Padding 절에 슬라이더`).toEqual([]);
    expect(o.wrote, `${v.name}: 값이 블럭에 안 들어갔거나 이력이 1 이 아니다`).toEqual([o.want, 1]);
    expect(o.blank, `${v.name}: 빈 칸 = 옛 값 되돌림 · 이력 0`).toEqual([String(v.set[1]), o.want, 0]);
    expect(errs).toEqual([]);
  });
}
