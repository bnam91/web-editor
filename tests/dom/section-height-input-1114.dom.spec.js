/* section-height-input-1114.dom.spec.js — 섹션 우측 패널 «높이» 숫자칸 (현빈 직접 · 261114 · prop-section.js 옛 주석 «숫자칸은 1차 생략 · Q13 ⓖ» 의 빈자리)
 * 고침: #sec-height-value 가 글자(span) → <input type=number>. 값을 넣으면(Enter/blur) «핀 켜기 + 그 높이»(js/section-pin.js setHeight) ·
 *   하한 = 손잡이 핀 하한(아래패딩 + 20 · section-bottom-handle.js pinMin) · 상한 20000 · ⌘Z 한 걸음 ·
 *   section-height.js 갱신은 «치는 중(포커스)»엔 칸을 안 덮는다.
 * 칸
 *   H1 꺼진 섹션에 200 + Enter → height 200px · 핀 켜짐(📌 눌림) · 넘친 블럭 → 「숨은 블럭」 줄 · ⌘Z 한 번 = 핀 전(높이·핀 없음)
 *   H2 범위 — 5 → 하한(아래패딩+20) · 99999 → 20000 · 칸에도 깎인 수 · Esc = 안 바뀜(기록 0)
 *   H3 치는 중엔 갱신이 칸을 안 덮는다 · 포커스 밖이면 덮는다(공용 자와 같은 수)
 * 양성대조: ⑴ setHeight 의 `sec.dataset.heightPin = 'true'` 를 지우면 H1 빨강(핀 꺼짐 · 📌 안 눌림)
 *   ⑵ setHeight 의 Math.min/Math.max 깎기를 걷으면 H2 빨강(5px·99999px)
 *   ⑶ section-height.js 의 `document.activeElement !== cell &&` 를 지우면 H3 빨강(치던 77 이 덮인다)
 *   (참고) prop-section.js 의 `if (esc) return;` 은 Esc→blur 가 change 를 낼 때만 뜻이 있다 — 크롬이 내면 걷을 때 H3 빨강(pin 'true') · 안 내면 초록(대조 아님 · 인텔 실측)
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SECS = `
<div class="section-block" id="hA" data-section="1" data-name="A" style="background:#ffffff">
  <div class="section-hitzone"><span class="section-label">A</span></div>
  <div class="section-inner">
    <div class="row" id="hR1"><div class="text-block" id="hT1" style="height:120px;overflow:hidden"><p style="margin:0">위</p></div></div>
    <div class="row" id="hR2"><div class="text-block" id="hT2" style="height:400px;background:#ff00aa"><p style="margin:0">아래</p></div></div>
  </div>
</div>
<div class="section-block" id="hB" data-section="2" data-name="B" style="background:#eeeeee">
  <div class="section-hitzone"><span class="section-label">B</span></div>
  <div class="section-inner"><div class="gap-block" data-type="gap" style="height:200px"></div></div>
</div>`;

async function setup(page) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate((html) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', html); window.rebindAll?.(); window.deselectAll?.();
    window.clearHistory?.();
    window.__push = 0; const op = window.pushHistory; window.pushHistory = function () { window.__push++; return op?.apply(this, arguments); };
    window.showSectionProperties(document.getElementById('hA'));
  }, SECS);
  await page.waitForFunction(() => document.getElementById('sec-height-value')?.dataset.secId === 'hA' && document.getElementById('sec-height-value').value !== '');
  return errs;
}

const st = (page) => page.evaluate(() => {
  const sec = document.getElementById('hA'), inp = document.getElementById('sec-height-value');
  return { tag: inp.tagName, value: inp.value, height: sec.style.height, pin: sec.dataset.heightPin ?? null,
    pressed: document.getElementById('sec-pin-btn')?.getAttribute('aria-pressed'),
    hiddenRow: getComputedStyle(document.getElementById('sec-pin-hidden-row')).display !== 'none', offH: sec.offsetHeight };
});

async function typeH(page, v, key = 'Enter') {
  await page.fill('#sec-height-value', String(v));
  await page.press('#sec-height-value', key);
}

test('H1 숫자 넣기 → 핀 켜기 + 그 높이 · ⌘Z 한 걸음', async ({ page }) => {
  const errs = await setup(page);
  const s0 = await st(page);
  expect(s0, '[전제] 숫자칸 · 핀 꺼짐').toMatchObject({ tag: 'INPUT', height: '', pin: null, pressed: 'false', hiddenRow: false });
  expect(Number(s0.value), '[전제] 내용 높이(120+400 이상)').toBeGreaterThanOrEqual(520);
  await typeH(page, 200);
  await expect.poll(() => st(page), 'Enter 뒤 — 200 고정 · 📌 눌림 · 넘친 블럭 알림')
    .toMatchObject({ value: '200', height: '200px', pin: 'true', pressed: 'true', hiddenRow: true, offH: 200 });
  expect(await page.evaluate(() => document.activeElement?.id), 'Enter 는 칸을 떠난다(확정)').not.toBe('sec-height-value');
  await page.keyboard.press('Meta+z');
  await expect.poll(() => page.evaluate(() => { const s = document.getElementById('hA'); return { height: s.style.height, pin: s.dataset.heightPin ?? null }; }),
    '⌘Z 한 번 = 핀 전').toEqual({ height: '', pin: null });
  expect(errs, errs.join('\n')).toEqual([]);
});

test('H2 범위 — 하한 = 손잡이 핀 하한 · 상한 20000 · Esc 는 안 바뀜', async ({ page }) => {
  const errs = await setup(page);
  const floor = await page.evaluate(() => (parseFloat(getComputedStyle(document.getElementById('hA')).paddingBottom) || 0) + 20);
  expect(await page.evaluate(() => window.sectionPin.minH(document.getElementById('hA'))), '[전제] 하한 = 아래패딩+20').toBe(floor);
  await typeH(page, 5);
  await expect.poll(() => st(page), '5 → 하한').toMatchObject({ height: floor + 'px', value: String(floor), pin: 'true' });
  await typeH(page, 99999);
  await expect.poll(() => st(page), '99999 → 20000').toMatchObject({ height: '20000px', value: '20000' });
  const n = await page.evaluate(() => window.__push);
  await typeH(page, 333, 'Escape');
  expect(await st(page), 'Esc = 되돌림').toMatchObject({ height: '20000px', value: '20000' });
  expect(await page.evaluate(() => window.__push), 'Esc 는 기록 0').toBe(n);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('H3 치는 중엔 높이 갱신이 칸을 안 덮는다 · 포커스 밖이면 덮는다', async ({ page }) => {
  const errs = await setup(page);
  await page.fill('#sec-height-value', '77');      // 확정 전(포커스 그대로)
  const typing = await page.evaluate(() => { window.renderSectionHeights(); return document.getElementById('sec-height-value').value; });
  expect(typing, '★치던 수를 갱신이 덮었다').toBe('77');
  await page.press('#sec-height-value', 'Escape');   // 치던 것 버리고 떠난다(change 없음)
  const after = await page.evaluate(() => {
    const sec = document.getElementById('hA'), inp = document.getElementById('sec-height-value');
    const focused = document.activeElement === inp;
    inp.value = '77';                                 // 포커스 밖의 묵은 값 — 갱신이 덮어야 한다
    window.renderSectionHeights();
    return { focused, v: inp.value, want: String(window.measureSectionHeight(sec)), pin: sec.dataset.heightPin ?? null };
  });
  expect(after, '포커스 밖 — 공용 자와 같은 수 · 핀 무변').toEqual({ focused: false, v: after.want, want: after.want, pin: null });
  expect(after.want).not.toBe('77');
  expect(errs, errs.join('\n')).toEqual([]);
});
