/* chat-width-handles.dom.spec.js — ⒜ 「챗 블럭 너비가 더 늘어날 순 없는지?」 (현빈 2026-10-06 · 지디 발주)
 *
 * ★이 파일이 재는 것 둘
 *   W1 ★«0» 이 그대로 그려진다 — 모델이 0 을 받는데 렌더러가 기본값으로 되돌리던 ★세 자리.
 *      ⚠️네 번째(profileSize)는 ★이 시험이 «안 잰다» — 모델 하한이 24 라 0 이 못 오고, 그래서 그 폴백은
 *        ★안 닿는 코드다(실측: 그 자리만 되돌려도 W1 초록). ⛔「넷을 잠근다」로 적지 마라.
 *      ⛔`parseInt(x) || d` 가 0 을 삼켰다(gap 0→8 · radius 0→16 · padding 0→16).
 *      ⇒ dataset 엔 0 이 저장되고 화면은 안 바뀌었다 = 「값은 사는데 화면이 안 바뀐다」.
 *      ★그게 ⒜ 의 한 범인이다 — 「패딩 0」으로 되찾을 32px 를 ★못 되찾았다.
 *   W2 ★세 손잡이를 차례로 풀면 폭이 ★어디까지 가나 — 현빈께 보여 드릴 수의 ★증인.
 *      ⛔기대값을 «수»로 박지 않는다 — 캔버스 폭·padX 가 바뀌면 낡는다. ★그 판에서 재어 ★식으로 견준다.
 *      ⛔반올림이 끼는 ①(70%)은 «정확한 수»로 안 잰다 — ②보다 작다 ＋ 대략 0.7 로만. ②③④ 는 정확한 식이다.
 *
 * ★전제를 먼저 세운다 — 섹션에 padX 가 «실제 길»(prop-page.js applyPadXToSection)로 걸려야 한다.
 *   ⛔안 걸면 섹션 안쪽이 캔버스와 같아져 이 시험이 「패딩 없는 판」을 재고, 그 수를 현빈께 보여 드리면 틀린 수가 된다
 *   (실측 2026-10-06: 그 함정에 한 번 빠졌다 — sectionInner 860 · block 860 이 나왔다).
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/chat-width-handles.dom.spec.js --workers=1
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const LONG = '길고 긴 메시지 '.repeat(40);

/** 실앱 장면을 세우고 챗 하나를 넣는다. ★offsetWidth(레이아웃 px)로 잰다 — rect 는 줌이 곱해져 40% 에서 틀린다. */
async function scene(page) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  const errs = await bootApp(page);
  const info = await page.evaluate((LONG) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend',
      '<div class="section-block" data-section="1" id="sW"><div class="section-hitzone"></div>'
      + '<div class="section-inner" id="siW"></div></div>');
    window.rebindAll?.();
    const padX = window.state?.pageSettings?.padX ?? 0;
    window.applyPadXToSection?.(document.getElementById('siW'), padX);
    window.selectSection(document.getElementById('sW'));
    window.addChatBlock({ messages: [{ text: LONG, align: 'left' }] });
    const b = document.querySelector('.chat-block');
    return { id: b.id, canvas: c.offsetWidth, padX, block: b.offsetWidth };
  }, LONG);
  return { errs, ...info };
}
const measure = (page, id) => page.evaluate((id) => {
  const b = document.getElementById(id);
  window.renderChatBlock(b);
  const cs = getComputedStyle(b);
  return {
    block: b.offsetWidth,
    padL: parseInt(cs.paddingLeft) || 0,
    msg: b.querySelector('.chb-msg').offsetWidth,
    bubble: b.querySelector('.chb-bubble').offsetWidth,
    canvas: document.getElementById('canvas').offsetWidth,
  };
}, id);
const set = (page, id, patch) => page.evaluate(({ id, patch }) => window.updateChatBlock(id, patch), { id, patch });

test('W0 ★전제 — 섹션에 padX 가 «실제로» 걸렸다(블럭 폭 = 캔버스 − 2·padX)', async ({ page }) => {
  const s = await scene(page);
  expect(`블럭 ${s.block} = 캔버스 ${s.canvas} − 2×${s.padX}`)
    .toBe(`블럭 ${s.canvas - 2 * s.padX} = 캔버스 ${s.canvas} − 2×${s.padX}`);
  expect(s.padX, '전제: 이 판의 padX 가 0 이 아니다(0 이면 W2 ④가 아무것도 안 잰다)').toBeGreaterThan(0);
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});

test('W1 ★«0» 이 그대로 그려진다 — ★세 자리(gap·radius·padding) · profileSize 는 안 닿아 못 잰다', async ({ page }) => {
  const s = await scene(page);
  await set(page, s.id, { showProfile: 1 });
  /* ★전제 — 0 을 주기 «전»엔 기본값이 그려진다(이 시험이 「언제나 0」을 재는 게 아님을 세운다). */
  const before = await page.evaluate((id) => {
    const b = document.getElementById(id);
    return { pad: parseInt(getComputedStyle(b).paddingLeft) || 0,
      gap: parseInt(b.querySelector('.chb-msg').style.marginBottom) || 0,
      radius: parseInt(b.querySelector('.chb-bubble').style.borderRadius) || 0,
      prof: b.querySelector('.chb-profile') ? b.querySelector('.chb-profile').offsetWidth : null };
  }, s.id);
  expect([before.pad > 0, before.gap > 0, before.radius > 0, before.prof > 0],
    `전제: 기본값이 0 이 아니다 (잰 값 ${JSON.stringify(before)})`).toEqual([true, true, true, true]);

  await set(page, s.id, { gap: 0, radius: 0, padding: 0, profileSize: 24 });
  const after = await page.evaluate((id) => {
    const b = document.getElementById(id);
    window.renderChatBlock(b);
    return { ds: { gap: b.dataset.gap, radius: b.dataset.radius, padding: b.dataset.padding },
      pad: parseInt(getComputedStyle(b).paddingLeft) || 0,
      gap: parseInt(b.querySelector('.chb-msg').style.marginBottom),
      radius: parseInt(b.querySelector('.chb-bubble').style.borderRadius) };
  }, s.id);
  /* ★모델에 들어간 값과 ★화면에 그려진 값을 ★나란히 단언한다 — 갈리면 그게 결함이다. */
  expect(`모델 ${JSON.stringify(after.ds)} · 화면 pad=${after.pad} gap=${after.gap} radius=${after.radius}`)
    .toBe('모델 {"gap":"0","radius":"0","padding":"0"} · 화면 pad=0 gap=0 radius=0');
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});

test('W2 ★세 손잡이를 풀면 말풍선이 «캔버스 전부»까지 간다 — ①기본 → ②최대폭 → ③패딩 → ④패딩제외', async ({ page }) => {
  const s = await scene(page);
  const r1 = await measure(page, s.id);
  await set(page, s.id, { bubbleMaxW: 100 });     const r2 = await measure(page, s.id);
  await set(page, s.id, { padding: 0 });          const r3 = await measure(page, s.id);
  await set(page, s.id, { fullBleed: true });     const r4 = await measure(page, s.id);
  console.log('WIDTHS ' + JSON.stringify({ padX: s.padX, r1, r2, r3, r4 }));

  /* ★①은 70% 라 반올림이 낀다 — «정확한 수»로 안 잰다. ②보다 작고 대략 0.7 인 것만. */
  expect(r1.bubble, '① 기본은 ② 보다 좁다(최대폭 70%)').toBeLessThan(r2.bubble);
  expect(Math.abs(r1.bubble / r2.bubble - 0.7), `① / ② ≈ 0.70 (잰 값 ${r1.bubble}/${r2.bubble})`).toBeLessThan(0.01);
  /* ★②③④ 는 정확한 식이다 — 반올림이 안 낀다. */
  expect(`② ${r2.bubble} = 블럭 ${r2.block} − 2×패딩 ${r2.padL}`)
    .toBe(`② ${r2.block - 2 * r2.padL} = 블럭 ${r2.block} − 2×패딩 ${r2.padL}`);
  expect(`③ ${r3.bubble} = 블럭 ${r3.block} (패딩 ${r3.padL})`)
    .toBe(`③ ${r3.block} = 블럭 ${r3.block} (패딩 0)`);
  expect(`④ ${r4.bubble} = 캔버스 ${r4.canvas}`)
    .toBe(`④ ${r4.canvas} = 캔버스 ${r4.canvas}`);
  /* ★그리고 ★단조 증가 — 손잡이를 풀 때마다 넓어진다(어느 단계도 «제자리»가 아니다). */
  expect([r1.bubble < r2.bubble, r2.bubble < r3.bubble, r3.bubble < r4.bubble],
    `단계마다 넓어진다 (잰 값 ${r1.bubble} → ${r2.bubble} → ${r3.bubble} → ${r4.bubble})`)
    .toEqual([true, true, true]);
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});
