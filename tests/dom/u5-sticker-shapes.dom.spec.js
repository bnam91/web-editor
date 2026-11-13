/* u5-sticker-shapes — U5(right-panel-unify) 스티커 패널은 «모양마다 있는 칸만» 그린다 ⇒ 배선이 없는 칸을 만지면 죽는다.
 * (평가자 FAIL 261113: #stk-text 무방비 → 원·사각 말고 전 모양에서 TypeError, 그 뒤 배선 전부 죽음 · bindNumPair · #stk-fw.)
 * 모양 9가지를 하나씩 골라: ⑴ 페이지 에러 0 ⑵ 그 모양의 칸 하나를 실제로 움직이면 dataset 에 써진다(배선이 끝까지 돌았다는 증거 —
 *   고른 칸들은 전부 prop-sticker.js 에서 #stk-text 배선 «뒤»에 묶인다) ⑶ 빈 절 머리 0(모든 data-sec 절의 몸에 컨트롤이 있다).
 * 양성대조: prop-sticker.js 의 `if (txt) {` 가드를 지우면(옛 꼴 txt.value = text) circle/square 밖 모양 전부 ⑴·⑵ 빨강.
 *   bindNumPair 의 `if (!s || !n) return;` 를 지우면 count 빨강(stk-size 없음). #stk-fw 의 ?. 를 지우면 text·highlight… 빨강.
 *   prop-sticker-count.js appearance 를 다시 무조건 내면 count ⑶ 빨강(원 마킹의 빈 Appearance). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SHAPES = [
  { name: 'circle',     opts: { shape: 'circle' },                                   ctl: 'stk-size-num',       key: 'size',      val: '88' },
  { name: 'square',     opts: { shape: 'square' },                                   ctl: 'stk-size-num',       key: 'size',      val: '90' },
  { name: 'count',      opts: { shape: 'circle', count: 1, text: '1' },              ctl: 'stk-count-size-num', key: 'sizeW',     val: '84' },
  { name: 'text',       opts: { shape: 'text' },                                     ctl: 'stk-t-rot-num',      key: 'rotation',  val: '15' },
  { name: 'icon',       opts: { shape: 'icon' },                                     ctl: 'stk-icon-size-num',  key: 'size',      val: '120' },
  { name: 'highlight',  opts: { shape: 'highlight', x: 40, y: 40 },                  ctl: 'stk-hl-w-num',       key: 'hlW',       val: '210' },
  { name: 'highlightB', opts: { shape: 'highlightB', x1: 60, y1: 200, x2: 220, y2: 200 }, ctl: 'stk-hlb-thick-num', key: 'thickness', val: '20' },
  { name: 'glow',       opts: { shape: 'glow', fxKind: 'star' },                     ctl: 'stk-glow-int',       key: 'intensity', val: '33' },
  { name: 'coin',       opts: { shape: 'coin' },                                     ctl: 'stk-coin-seed',      key: 'seed',      val: '7' },
  { name: 'arrow',      opts: { shape: 'arrow', x1: 100, y1: 200, x2: 400, y2: 260 }, ctl: 'stk-arrow-thick-num', key: 'thickness', val: '9' },
];

test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1500, height: 1100 }); });

for (const S of SHAPES) {
  test(`S ${S.name} — 패널 에러 0 · 칸 «${S.ctl}» 가 dataset.${S.key} 에 쓴다 · 빈 절 머리 0`, async ({ page }) => {
    const errs = await bootApp(page);
    const pageErrs = []; page.on('pageerror', (e) => pageErrs.push(String(e.message)));
    const id = await page.evaluate(async (opts) => {
      const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
      await window.addSection(); const sec = c.querySelector('.section-block'); window.deselectAll?.();
      const b = window.makeStickerBlock(opts); sec.appendChild(b);
      window.renderStickerBlock?.(b); window.bindStickerSelect?.(b); window._selectSticker?.(b);
      window.showStickerProperties(b);   // 고르기 경로가 패널을 안 그렸어도 이 모양 패널을 확실히 그린다
      return b.id;
    }, S.opts);
    await expect(page.locator('#' + S.ctl), `[전제] ${S.name} 패널에 ${S.ctl} 가 있다`).toBeAttached();
    const r = await page.evaluate(({ id, ctl, key, val }) => {
      const el = document.getElementById(ctl);
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      const empty = [...document.querySelectorAll('#panel-right .prop-section[data-sec]')]
        .filter((s) => !s.querySelector(':scope > .prop-sec-body input, :scope > .prop-sec-body select, :scope > .prop-sec-body button, :scope > .prop-sec-body textarea, :scope > .prop-sec-body .stk-fav-grid')
          && !s.querySelector(':scope > .prop-sec-head input, :scope > .prop-sec-head select, :scope > .prop-sec-head button'))
        .map((s) => s.dataset.sec);
      return { got: document.getElementById(id).dataset[key], empty };
    }, { id, ctl: S.ctl, key: S.key, val: S.val });
    expect(pageErrs, '★페이지 에러(배선이 없는 칸을 만졌다)').toEqual([]);
    expect(r.got, `★배선이 끝까지 돌았다 — ${S.ctl} → dataset.${S.key}`).toBe(S.val);
    expect(r.empty, '★컨트롤 없는 빈 절 머리').toEqual([]);
    expect(errs).toEqual([]);
  });
}
