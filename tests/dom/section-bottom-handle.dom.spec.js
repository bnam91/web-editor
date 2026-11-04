/* 섹션 바닥 높이 손잡이 — 「만들었다」를 ★행위로 닫는다.
   (261027 srv-t803 · 뜻 바뀜 : 아래 여백 → 바닥 높이 min-height) */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const raf2 = (p) => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

test('섹션 바닥 손잡이: 끌면 섹션 바닥 높이(min-height)가 생기고, 섹션 밖에서 놓아도 선택이 남는다', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1500, height: 950 });
  const errs = await bootApp(page);
  const id = await page.evaluate(async () => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    await window.addSection();
    const el = [...c.querySelectorAll('.section-block')].pop();
    window.selectSection?.(el);
    window.sectionBottomHandleSweep?.();
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
    await page.evaluate(() => window.sectionBottomHandleSweep?.());
  }

  const pre = await page.evaluate((i) => {
    const s = document.getElementById(i);
    return { handle: !!s.querySelector(':scope > .section-bottom-handle'), pad: s.style.paddingBottom || '(없음)',
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

/* ── 188 — 앱 QA 로만 재던 칸을 CI 로 옮긴다 ─────────────────────────────
   변이: 저장에서 min-height 를 걷으면 S1·D1 빨강 · onDblClick 을 안 걸면 D1 빨강 · 바닥 없을 때 되돌아 나가는 줄을 빼면 D2 빨강.
   장면 준비만 evaluate — 끌기·더블클릭은 진짜 마우스. 다시 열기 = 저장 글자를 applyProjectData 로 되읽기. */
async function floorScene(page) {
  await page.setViewportSize({ width: 1500, height: 1400 });
  const errs = await bootApp(page);
  const id = await page.evaluate(() => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    window.addSection();
    const el = [...c.querySelectorAll('.section-block')].pop();
    window.applyZoom?.(100);
    window.selectSection?.(el);
    el.scrollIntoView({ block: 'start' });
    return el.id;
  });
  await waitStableRect(page, '#' + id);
  return { errs, id };
}
async function dragFloor(page, id, dy) {
  const s = await waitStableRect(page, '#' + id);
  const x = s.left + s.width / 2, y = s.top + s.height - 3;
  await page.mouse.move(x, y - 40); await page.mouse.move(x, y); await raf2(page);
  await page.mouse.down(); await page.mouse.move(x, y + dy / 2, { steps: 3 }); await page.mouse.move(x, y + dy, { steps: 3 }); await page.mouse.up(); await raf2(page);
  await expect.poll(() => page.evaluate((i) => document.getElementById(i).style.minHeight, id), { message: '전제 — 끌어 바닥이 생겼다' }).not.toBe('');
}
const floorOf = (page, id) => page.evaluate((i) => { const e = document.getElementById(i); return { min: e.style.minHeight, h: e.offsetHeight, handles: e.querySelectorAll(':scope > .section-bottom-handle').length }; }, id);

test('S1 ★188 직렬화 — 저장 → 다시 열기 뒤 바닥 높이·그려진 높이가 같다 · 손잡이는 저장에 안 실리고 다시 붙는다', async ({ page }) => {
  const { errs, id } = await floorScene(page);
  await dragFloor(page, id, 120);
  const before = await floorOf(page, id);
  const saved = await page.evaluate(() => window.serializeProject());
  expect(saved, '★저장 글자에 바닥 높이가 실린다').toContain(`min-height: ${before.min}`);
  expect(saved, '★손잡이는 저장에 안 실린다').not.toContain('section-bottom-handle');
  await page.evaluate((d) => { document.getElementById('canvas').innerHTML = ''; window.applyProjectData(JSON.parse(d)); }, saved);
  await page.waitForFunction((i) => document.querySelector(`#${i} > .section-bottom-handle`), id, { timeout: 5000 });
  expect(await floorOf(page, id), '★다시 연 뒤 값이 같다').toEqual(before);
  expect(errs).toEqual([]);
});

test('D1 ★188 더블클릭 — 바닥이 있으면 없앤다 · ⌘Z 한 번에 돌아온다', async ({ page }) => {
  const { errs, id } = await floorScene(page);
  const natural = (await floorOf(page, id)).h;
  await dragFloor(page, id, 120);
  const made = await floorOf(page, id);
  const s = await waitStableRect(page, '#' + id);
  const x = s.left + s.width / 2, y = s.top + s.height - 3;
  await page.mouse.move(x, y - 40); await page.mouse.move(x, y); await raf2(page);
  await page.mouse.dblclick(x, y);
  await expect.poll(() => floorOf(page, id).then((f) => f.min), { message: '★더블클릭 = 바닥 없앰' }).toBe('');
  expect((await floorOf(page, id)).h, '★높이가 블럭 높이로 돌아왔다').toBe(natural);
  await page.keyboard.press('Meta+z');
  await expect.poll(() => floorOf(page, id).then((f) => f.min), { message: '★⌘Z 한 번에 바닥이 돌아온다' }).toBe(made.min);
  expect(errs).toEqual([]);
});

test('D2 [음성] 바닥이 없으면 더블클릭해도 아무 일 없다 · 기록이 안 쌓인다', async ({ page }) => {
  const { errs, id } = await floorScene(page);
  const before = await floorOf(page, id);
  const s = await waitStableRect(page, '#' + id);
  const x = s.left + s.width / 2, y = s.top + s.height - 3;
  await page.mouse.move(x, y - 40); await page.mouse.move(x, y); await raf2(page);
  await page.evaluate(() => { const o = window.pushHistory; window.__ph = 0; window.pushHistory = (...a) => { window.__ph++; return o(...a); }; document.addEventListener('dblclick', () => { window.__dbl = (window.__dbl || 0) + 1; }, true); });
  await page.mouse.dblclick(x, y);
  await expect.poll(() => page.evaluate(() => window.__dbl), { message: '전제 — 더블클릭이 왔다' }).toBeGreaterThan(0);
  expect(await page.evaluate((i) => document.elementFromPoint(...(() => { const r = document.getElementById(i).getBoundingClientRect(); return [r.left + r.width / 2, r.bottom - 3]; })())?.closest('.section-bottom-handle') !== null, id), '전제 — 손잡이를 눌렀다').toBe(true);
  expect(await floorOf(page, id)).toEqual(before);
  expect(await page.evaluate(() => window.__ph), '★기록 0').toBe(0);
  expect(errs).toEqual([]);
});
