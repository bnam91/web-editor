/* layout-std-c2.dom.spec.js — 표준 Layout L2~L4 · C2 갈래 일곱 패널(정본 시안 8910 #mkp-layoutstd · PLAN-appearance-layout-std-261124 §2·§2-b · 탑 C2 발주·판정 261124)
 *   대상 일곱 = sticker(글·기본·형광펜) · innercard · coupon · laurel · step · iconify · cert(simple-card·canvas 는 대성 갈래로 이관 261125)
 *   슬라이더 걷음(현빈 L-4) → 숫자 칸 + 라벨 끌기(부품 js/props/_layout-section.js) · ⛔숫자 칸 id·저장 키·범위 무변
 *   LC1 Size·Layout·Padding 절 슬라이더 0 · 옛 숫자 칸 id 가 전부 부품(data-part="layout") 안 · 끌기 손잡이(${id}-scrub) 있음
 *   LC2 칸 하나 값 → 저장 키 · 범위 밖 = 잘림 · 이력 1(칸마다 대표 하나)
 *   LC3 sticker 글 너비 모드(§2-b · 옛 체크 stk-t-boxw-on) — 고정 → boxW px · 너비 칸 열림 / 자동 → 'auto' · 너비 칸 막힘
 *   LC4 step 패딩 L/R + 옛 사슬 stb-ph-chain(슬롯 끝 칸) — 잠금이면 L 을 바꿀 때 R 도 같은 값
 *   양성대조(CTL) = 제품 파일 7 을 P 머리(1baa53b8f)로 되돌림 → LC1·LC3·LC4 빨강(슬라이더 남음 · 칸이 부품 밖 · 드롭다운 없음) · LC2 는 숫자 칸이 옛에도 있어 일부 초록일 수 있음.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/layout-std-c2.dom.spec.js --workers=1 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/* [이름, 넣기, 블럭 클래스, 부품 안에 있어야 할 숫자 칸 id, 대표 칸 { id, v, 넘침, 잘린 값, 키(dataset) , 기대 값(키) }] */
const CASES = [
  ['sticker(글)', "window.addStickerBlock({ shape: 'text' })", 'sticker-block', ['stk-t-boxw-num', 'stk-t-pad-x-num', 'stk-t-pad-y-num'],
    { id: 'stk-t-pad-x-num', v: 22, over: 999, cut: 400, key: 'padX' }],
  ['sticker(기본)', 'window.addStickerBlock()', 'sticker-block', ['stk-size-num'], { id: 'stk-size-num', v: 90, over: 9999, cut: 600, key: 'size' }],
  ['sticker(형광펜)', "window.addStickerBlock({ shape: 'highlight' })", 'sticker-block', ['stk-hl-w-num', 'stk-hl-h-num'], { id: 'stk-hl-w-num', v: 300, over: 9999, cut: 1200, key: 'hlW' }],
  ['innercard', 'window.addInnerCardBlock()', 'innercard-block', ['icd-pad-number'], { id: 'icd-pad-number', v: 30, over: 999, cut: 120, key: 'padding' }],
  ['coupon', 'window.addCouponBlock()', 'coupon-block', ['cpn-width-number'], null],   // 폭 change = 패널 다시 그림 → 값 칸은 LC1 만
  ['laurel', 'window.addLaurelBlock()', 'laurel-block', ['lrl-all-height-num', 'lrl-all-gap-num'], { id: 'lrl-all-height-num', v: 200, over: 9999, cut: 600, key: null }],
  ['step', 'window.addStepBlock()', 'step-block', ['stb-num-size-number', 'stb-gap-number', 'stb-badge-gap-number', 'stb-padl-number', 'stb-padr-number'],
    { id: 'stb-gap-number', v: 40, over: 9999, cut: 200, key: 'gap' }],
  ['iconify', "window.addIconifyBlock('', '', 64)", 'icon-block', ['icn-size-number'], { id: 'icn-size-number', v: 100, over: 9999, cut: 512, key: 'size' }],
  /* cert 새 블럭 기본 = 격자(⑩) — 격자: 용지 높이·가로/세로 간격 / 스택: 용지 크기·높이·흩뿌림(수지 261125 r1: 스택 칸을 격자에서 찾아 [전제] 빨강 → 둘로 가름) */
  ['cert(격자)', 'window.addCertBlock()', 'cert-block', ['crt-sheeth-number', 'crt-gapx-number', 'crt-gapy-number'], { id: 'crt-gapx-number', v: -20, over: 999, cut: 80, key: 'gapX' }],
  ['cert(스택)', "window.addCertBlock(); { const b = [...document.querySelectorAll('#canvas .cert-block')].pop(); b.dataset.mode = 'stack'; window.renderCertBlock?.(b); window.showCertProperties(b); }", 'cert-block',
    ['crt-sheetw-number', 'crt-sheeth-number', 'crt-jitter-number'], { id: 'crt-jitter-number', v: 30, over: 999, cut: 100, key: 'jitter', keyV: ['0.3', '1'] }],
];

async function scene(page, add, firstId) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async (add) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); window.deselectAll?.(); window.selectSection?.(sec);
    (0, eval)(add);
    document.activeElement?.blur?.();   // 넣자마자 글 편집(글 스티커 등)이면 빠진다 — 재는 동안 편집 커밋 이력이 끼지 않게(수지 261125 r1 LC2 sticker(글))
  }, add);
  await expect(page.locator(`#${firstId}`), `[전제] ${firstId} 칸`).toHaveCount(1);
  return errs;
}
const setNum = (page, id, v) => page.evaluate(([id, v]) => {
  let ph = 0; const o = window.pushHistory; window.pushHistory = (...a) => { ph++; return o?.(...a); };
  const n = document.getElementById(id); n.value = String(v); n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true }));
  window.pushHistory = o; return { ph, shown: document.getElementById(id)?.value };
}, [id, v]);
const ds = (page, cls, key) => page.evaluate(([cls, key]) => [...document.querySelectorAll(`#canvas .${cls}`)].pop()?.dataset[key] ?? null, [cls, key]);

for (const [name, add, cls, ids, one] of CASES) {
  test(`LC1 ${name} — Size·Layout·Padding 슬라이더 0 · 숫자 칸 ${ids.length} 개가 부품 안 · 끌기 손잡이`, async ({ page }) => {
    const errs = await scene(page, add, ids[0]);
    const o = await page.evaluate((ids) => ({
      slider: [...document.querySelectorAll('#panel-right .prop-section[data-sec="size"], #panel-right .prop-section[data-sec="layout"], #panel-right .prop-section[data-sec="padding"]')]
        .reduce((n, s) => n + s.querySelectorAll('input[type=range]').length, 0),
      out: ids.filter((id) => !document.getElementById(id)?.closest('[data-part="layout"]')),
      noScrub: ids.filter((id) => !document.getElementById(`${id}-scrub`)),
    }), ids);
    expect(o).toEqual({ slider: 0, out: [], noScrub: [] });
    expect(errs, errs.join('\n')).toEqual([]);
  });

  if (one) test(`LC2 ${name} — ${one.id} 값 → 저장 · 넘침 = 잘림(${one.cut}) · 이력 1`, async ({ page }) => {
    const errs = await scene(page, add, ids[0]);
    const a = await setNum(page, one.id, one.v);
    const b = await setNum(page, one.id, one.over);
    const got = { a: a.ph, b: [b.ph, b.shown] };
    const want = { a: 1, b: [1, String(one.cut)] };
    if (one.key) { got.key = await ds(page, cls, one.key); want.key = one.keyV ? one.keyV[1] : String(one.cut); }
    expect(got).toEqual(want);
    expect(errs, errs.join('\n')).toEqual([]);
  });
}

test('LC3 sticker 글 너비 모드 — 드롭다운 고정/자동(옛 체크 자리) · 자동 = boxW auto · 너비 칸 막힘 / 고정 = px · 칸 열림 · 높이 = 자동 칸', async ({ page }) => {
  const errs = await scene(page, "window.addStickerBlock({ shape: 'text' })", 'stk-t-boxw-num');
  const st = () => page.evaluate(() => {
    const b = [...document.querySelectorAll('#canvas .sticker-block')].pop();
    return { mode: document.getElementById('stk-t-boxw-mode')?.value ?? null, boxW: b.dataset.boxW ?? null,
      wDis: document.getElementById('stk-t-boxw-num')?.disabled ?? null, hDis: document.getElementById('stk-t-h-auto')?.disabled ?? null,
      oldCheck: !!document.getElementById('stk-t-boxw-on') };
  });
  const s0 = await st();
  expect([s0.mode, s0.wDis, s0.hDis, s0.oldCheck], '[전제] 기본 = 자동 · 너비 칸 막힘 · 높이 자동 · 옛 체크 없음').toEqual(['auto', true, true, false]);
  await page.selectOption('#stk-t-boxw-mode', 'fixed');
  await expect.poll(async () => { const s = await st(); return [s.mode, s.wDis, /^\d+$/.test(s.boxW || '')]; }, 'LC3 고정 → px · 칸 열림').toEqual(['fixed', false, true]);
  await page.selectOption('#stk-t-boxw-mode', 'auto');
  await expect.poll(async () => { const s = await st(); return [s.mode, s.wDis, s.boxW]; }, 'LC3 자동 → auto · 칸 막힘').toEqual(['auto', true, 'auto']);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('LC4 step 패딩 L/R — 옛 사슬 stb-ph-chain 이 슬롯 끝 칸 · 잠금이면 L → R 같은 값 · 풀면 따로', async ({ page }) => {
  const errs = await scene(page, 'window.addStepBlock()', 'stb-padl-number');
  const st = () => page.evaluate(() => { const b = [...document.querySelectorAll('#canvas .step-block')].pop(); return { l: b.dataset.stepPadL ?? null, r: b.dataset.stepPadR ?? null }; });
  const where = await page.evaluate(() => { const c = document.getElementById('stb-ph-chain'); return { inSlot: c?.closest('[data-part="layout"]') === document.getElementById('stb-padl-number')?.closest('[data-part="layout"]'), on: c?.getAttribute('aria-pressed') }; });
  expect(where, '[전제] 사슬 = 슬롯 끝 칸 · 기본 L=R 이라 잠김').toEqual({ inSlot: true, on: 'true' });
  await setNum(page, 'stb-padl-number', 36);
  expect(await st(), 'LC4 잠금 — R 도 36').toEqual({ l: '36', r: '36' });
  await page.click('#stb-ph-chain');
  await setNum(page, 'stb-padl-number', 12);
  expect(await st(), 'LC4 풂 — R 그대로').toEqual({ l: '12', r: '36' });
  expect(errs, errs.join('\n')).toEqual([]);
});
