/* ★시안 확인용 — ⛔게이트 아님. 「만들었다」를 ★행위로 닫는다. 재고 나면 지운다.
   (261027 srv-t803 · 뜻 바뀜 : 아래 여백 → 바닥 높이 min-height) */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const raf2 = (p) => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

test('PROTO 끌면 섹션 바닥 높이(min-height)가 생기고, 섹션 밖에서 놓아도 선택이 남는다', async ({ page }) => {
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
             h: s.offsetHeight };   // ★모델 px(post.h 와 같은 자)
  }, id);
  expect(pre.handle, '손잡이가 안 붙었다').toBe(true);
  console.log('★끌기 전 =', JSON.stringify(pre));

  /* ★진짜 마우스로 끈다 */
  const b = await waitStableRect(page, '#' + id);
  const x = b.left + b.width / 2, y = b.top + b.height - 4;
  await page.mouse.move(x, y);
  await page.mouse.down();
  /* ★섹션 «밖»(오른쪽)에서 놓는다 — click 이 #canvas-wrap 으로 가는 자리(PROTO-SECBOT-DESELECT-ON-DRAG-01) */
  await page.mouse.move(b.left + b.width + 60, y + 120, { steps: 10 });
  await page.mouse.up();
  await raf2(page);
  /* ★패널은 ★비동기로 다시 그려진다(`await _presetsReady`) ⇒ ★떠 있기를 ★기다린다.
     ⛔안 기다리고 null 을 읽으면 ★「제품이 안 따라온다」와 ★「자가 안 기다렸다」가 ★구분 안 된다. */
  await page.waitForFunction(() => !!document.getElementById('sec-padb-number'), null, { timeout: 8000 })
    .catch(() => {});
  await raf2(page);

  const post = await page.evaluate((i) => {
    const s = document.getElementById(i);
    const mh = s.style.minHeight; s.style.minHeight = ''; const nat = s.offsetHeight; s.style.minHeight = mh;
    const scale = s.getBoundingClientRect().width / s.offsetWidth;
    return { scale, sel: s.classList.contains('selected'), panel: !!document.getElementById('sec-padb-slider'),
             mh, pb: s.style.paddingBottom, h: s.offsetHeight, nat };
  }, id);
  console.log('★끌기 후 =', JSON.stringify(post));
  /* ★배율을 먹는다 — 화면 120px = 모델 120/scale px (40% 면 300) */
  const want = pre.h + 120 / post.scale;
  expect(Math.abs(post.h - want), `섹션 높이 ${pre.h} → ${post.h} (≈${Math.round(want)} 이어야)`).toBeLessThanOrEqual(3);
  expect(post.mh, '바닥(min-height)이 안 생겼다').toBe(post.h + 'px');
  expect(post.pb, '⛔아래 여백은 손잡이가 안 건드린다').toBe('');
  expect(post.sel && post.panel, `선택/패널이 풀렸다 sel=${post.sel} panel=${post.panel}`).toBe(true);

  /* ★블럭이 바닥 안에 들면 높이 유지 · 지우면 바닥으로 */
  const r = await page.evaluate(async (i) => {
    const s = document.getElementById(i), H = s.offsetHeight;
    const before = new Set(s.querySelectorAll('.gap-block'));
    window.addGapBlock(100); await new Promise(r => setTimeout(r, 200));
    const nw = [...s.querySelectorAll('.gap-block')].filter(g => !before.has(g));
    const hIn = s.offsetHeight; nw.forEach(g => g.remove());
    return { H, hIn, added: nw.length, hBack: s.offsetHeight };
  }, id);
  expect(r.added, 'gap 이 이 섹션에 안 들어갔다').toBeGreaterThan(0);
  expect(r.hIn, '바닥 안에서 높이가 변했다').toBe(r.H);
  expect(r.hBack, '지운 뒤 바닥으로 안 돌아왔다').toBe(r.H);
  expect(errs, `콘솔 오류 = ${JSON.stringify(errs)}`).toEqual([]);
});
