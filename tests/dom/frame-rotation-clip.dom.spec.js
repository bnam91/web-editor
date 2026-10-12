/* frame-rotation-clip — ★★«회전 ★0 인 아이콘이 ★프레임의 ★자르기를 ★끄지 않는다» (2026-10-12)
 *
 * ★★왜 이 벌이 있나 — ★`css/editor-blocks.css` 의 ★`.frame-block:has([data-rotation])` 는
 *   ★★«`data-rotation` 은 ★0이면 ★지워진다 ⇒ ★존재 == 비영» 을 ★★전제로 ★`:not()` 을 ★안 붙였다.
 *   ★★그 전제가 ★★깨져 있었다 — ★실측(2026-10-12): ★쓰는 자 ★14 · ★지우는 자 ★3 ·
 *   ★★그중 ★★세 자리가 ★★행위로 ★`data-rotation="0"` 을 ★쓴다:
 *     ★`js/blocks/modal-frameify.js:106` · ★`js/blocks/iconify-block.js:21` · ★`js/props/prop-modal.js:616`
 *   ⇒ ★★그 프레임이 ★★자르기를 ★멈춰 ★★현빈 1009t3-②(「프레임 밖은 안 보여야」)가 ★조용히 ★꺼졌다.
 *   ★증상: ★`modal-frameify-pixel` 의 ★`icon-stack frame 100%` 에서 ★그림자가 ★★130,656px 어긋났다.
 *
 * ★★이 벌이 ★잠그는 것 = ★★«그 전제»다. ⛔주석으로 두지 않는다 — ★★행위로 ★잰다.
 * ★R1 ★0회전 아이콘 ⇒ ★hidden (★전제)   ★R2 ★비영 회전 ⇒ ★visible (★★원래 기능이 ★산다)
 * ★R3 ★아이콘 없음 ⇒ ★hidden (★음성대조)
 * ⛔앱 무접촉 — bootApp. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SEC = `<div class="section-block" id="sX" data-section="1" data-name="X"><div class="section-hitzone"></div><div class="section-inner" id="innerX" style="padding-left: 32px; padding-right: 32px;">
<div class="gap-block" data-type="gap" id="gTop" style="height:140px"></div><div id="slot"></div>
<div class="gap-block" data-type="gap" id="gEnd" style="height:200px"></div></div></div>`;

/** ★프레임 하나를 놓고 ★rot 값을 ★가진 아이콘을 ★그 안에 넣는다. ★rot===null ⇒ ★아이콘 없음 */
const build = (page, rot) => page.evaluate(([SEC, rot]) => {
  const c = document.getElementById('canvas');
  c.querySelectorAll('.section-block').forEach((s) => s.remove());
  c.insertAdjacentHTML('beforeend', SEC);
  const f = window.makeFrameBlock({ fullWidth: true, bg: '#fafafa', padding: 24 });
  f.id = 'hostF';
  document.getElementById('slot').replaceWith(f);
  let icon = null;
  if (rot !== null) {
    /* ★앱의 ★제 입구로 만든다 — ⛔손으로 div 를 ★짓지 않는다(★그 꼴이 ★앱에서 ★생기나부터) */
    const made = window.makeIconifyBlock('', '', 64);
    f.appendChild(made.row);
    icon = made.block;
    icon.dataset.rotation = String(rot);
  }
  return {
    ov: getComputedStyle(f).overflow,
    inline: f.style.overflow || '-',
    rots: [...f.querySelectorAll('[data-rotation]')].map((q) => q.getAttribute('data-rotation')),
    iconFound: !!icon,
  };
}, [SEC, rot]);

test('R1 ★★회전 0 인 아이콘이 프레임 안에 있어도 ★★프레임은 ★자른다 (★전제 — 1009t3-②)', async ({ page }) => {
  const errs = await bootApp(page);
  const s = await build(page, 0);
  expect(errs, errs.join(' | ')).toEqual([]);
  expect(s.iconFound, '★전제: 아이콘이 만들어졌다').toBe(true);
  expect(s.rots, `★전제: data-rotation 이 "0" 으로 달렸다. 잰 값 ${JSON.stringify(s.rots)}`).toEqual(['0']);
  expect(s.inline, `★전제: 프레임에 인라인 overflow 가 없다(있으면 CSS 를 못 잰다). 잰 값 ${s.inline}`).toBe('-');
  expect(s.ov, `★★프레임이 자르기를 멈췄다 — 회전 0 짜리가 :has([data-rotation]) 를 켰다. 잰 값 ${s.ov}`).toBe('hidden');
});

test('R2 ★★비영 회전(15도) 아이콘은 ★여전히 ★프레임 자르기를 ★푼다 (★★원래 기능 — 고침이 과하지 않다)', async ({ page }) => {
  const errs = await bootApp(page);
  const s = await build(page, 15);
  expect(errs, errs.join(' | ')).toEqual([]);
  expect(s.rots, `★전제: data-rotation="15". 잰 값 ${JSON.stringify(s.rots)}`).toEqual(['15']);
  expect(s.ov, `★★회전한 자식이 잘린다 — 고침이 너무 넓다. 잰 값 ${s.ov}`).toBe('visible');
});

test('R3 ★음성대조 — ★아이콘이 ★없으면 ★당연히 ★hidden (★이 벌이 ★무엇이든 ★visible 로 읽지 않는다)', async ({ page }) => {
  const errs = await bootApp(page);
  const s = await build(page, null);
  expect(errs, errs.join(' | ')).toEqual([]);
  expect(s.rots, '★전제: data-rotation 자손이 0개').toEqual([]);
  expect(s.ov, `★아이콘도 없는데 안 자른다. 잰 값 ${s.ov}`).toBe('hidden');
});
