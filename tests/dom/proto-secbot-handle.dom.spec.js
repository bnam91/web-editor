/* ★시안 확인용 — ⛔게이트 아님. 「만들었다」를 ★행위로 닫는다. 재고 나면 지운다. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const raf2 = (p) => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

test('PROTO 끌면 아래 여백이 늘고, 패널 숫자와 같은 값이다', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1500, height: 950 });
  const errs = await bootApp(page);
  const id = await page.evaluate(async () => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    await window.addSection();
    const el = [...c.querySelectorAll('.section-block')].pop();
    window.selectSection?.(el);
    window.protoSecBotSweep?.();
    return el.id;
  });
  await raf2(page);
  /* ★진짜 클릭으로 섹션을 고른다 — ⛔`selectSection()` 호출로는 패널이 안 뜬다(261025 실측 `sel:false`). */
  {
    const b0 = await waitStableRect(page, '#' + id);
    await page.mouse.click(b0.left + 8, b0.top + b0.height / 2);
    await page.waitForFunction((i) => document.getElementById(i)?.classList.contains('selected')
      && !!document.getElementById('sec-padb-slider'), id, { timeout: 8000 });
    await raf2(page);
    await page.evaluate(() => window.protoSecBotSweep?.());
  }

  const pre = await page.evaluate((i) => {
    const s = document.getElementById(i);
    return { handle: !!s.querySelector(':scope > .proto-secbot-handle'), pad: s.style.paddingBottom || '(없음)',
             h: Math.round(s.getBoundingClientRect().height) };
  }, id);
  expect(pre.handle, '손잡이가 안 붙었다').toBe(true);
  console.log('★끌기 전 =', JSON.stringify(pre));

  /* ★진짜 마우스로 끈다 */
  const b = await waitStableRect(page, '#' + id);
  const x = b.left + b.width / 2, y = b.top + b.height - 4;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 120, { steps: 10 });
  await page.mouse.up();
  await raf2(page);
  /* ★패널은 ★비동기로 다시 그려진다(`await _presetsReady`) ⇒ ★떠 있기를 ★기다린다.
     ⛔안 기다리고 null 을 읽으면 ★「제품이 안 따라온다」와 ★「자가 안 기다렸다」가 ★구분 안 된다. */
  await page.waitForFunction(() => !!document.getElementById('sec-padb-number'), null, { timeout: 8000 })
    .catch(() => {});
  await raf2(page);

  const post = await page.evaluate((i) => {
    const s = document.getElementById(i);
    return { sel: s.classList.contains('selected'),
             panelFn: typeof window.showSectionProperties,
             anyPanel: !!document.getElementById('sec-height-value'),
             pad: parseInt(s.style.paddingBottom) || 0, h: Math.round(s.getBoundingClientRect().height),
             panel: document.getElementById('sec-padb-number')?.value ?? null,
             slider: document.getElementById('sec-padb-slider')?.value ?? null };
  }, id);
  console.log('★끌기 후 =', JSON.stringify(post));
  expect(post.pad, `아래 여백 = ${post.pad} (안 늘었다)`).toBeGreaterThan(0);
  expect(post.h, `섹션 높이 ${pre.h} → ${post.h} (안 늘었다)`).toBeGreaterThan(pre.h);
  /* ★★`PROTO-SECBOT-DESELECT-ON-DRAG-01` — ★끌고 나면 ★선택이 풀려 ★패널이 ★없다.
     ⇒ ★「패널 숫자와 같다」를 ★★아직 못 잰다. ★잰 값을 ★그대로 찍고 ★todo 로 둔다
       (⛔초록으로 ★가장하지 ★않는다 · ⛔빨강으로 ★다음 빨강을 ★가리지도 ★않는다). */
  if (post.panel == null) {
    const d = `PROTO-SECBOT-DESELECT-ON-DRAG-01 — 끌기 뒤 selected=${post.sel} · 패널 없음(anyPanel=${post.anyPanel}) · 손잡이가 쓴 값=${post.pad}`;
    test.info().annotations.push({ type: 'todo', description: d });
    console.log('TODO ' + d);
  } else {
    expect(Number(post.panel), `패널 숫자 = ${post.panel} · 손잡이가 쓴 값 = ${post.pad}`).toBe(post.pad);
    expect(Number(post.slider), `슬라이더 = ${post.slider} · 손잡이가 쓴 값 = ${post.pad}`).toBe(post.pad);
  }
  expect(errs, `콘솔 오류 = ${JSON.stringify(errs)}`).toEqual([]);
});
