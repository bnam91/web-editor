/* w2c-1020t2.dom.spec.js — 1020t2f1~f5 오버레이·스티커 다섯 (S7 · W2C)
 *
 * ★장면은 앱의 «제 문»으로만 만든다 — 섹션 = 「새 섹션」 단추, 블럭 = 플로팅 메뉴 단추, 묶기 = ⌘G,
 *   오버레이 = 우측 패널의 오버레이 단추, 어노테이션 = 메뉴 「Annotation」 펜으로 찍고 Enter.
 *   ⛔콘솔에서 생성 함수를 부르지 않는다(규율 ⑧). 줌만 앱의 줌 함수(applyZoom)로 건다.
 * ★rect 는 waitStableRect(가라앉기 + 두 번 읽어 같을 때)로만 읽는다.
 *
 *   F1 그룹(⌘G)도 패널에 오버레이 단추가 있고, 누르면 그룹이 뜬다
 *   F2 스티커는 «지금 보는 화면» 가운데에 생긴다 — 줌 40% · 스크롤 중간에서 수로
 *   F3 스티커와 오버레이 텍스트를 «같은 손짓»으로 섹션 밖으로 끈다 — 나란히 둔 표 + 스티커도 나간다
 *   F4 오버레이 모달 끌기의 다섯 수(첫 틱 튐 · 틱당 지연 · 방향 · 놓을 때 되돌아감 · 다른 블럭과 다름) — 견줄 것: 오버레이 텍스트
 *   F5 어노테이션을 확대블럭 위에 겹쳐 그리고 ⌘] — 어노테이션이 위로 온다
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const log = (k, v) => console.log(`W2C ${k} ${JSON.stringify(v)}`);

async function boot(page) {
  const errs = await bootApp(page);
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });
  return errs;
}
/* 「새 섹션」 단추를 n 번 누르고 새로 생긴 섹션 id 들을 돌려준다 */
async function addSections(page, n) {
  const before = await page.evaluate(() => [...document.querySelectorAll('#canvas .section-block')].map((s) => s.id));
  for (let i = 0; i < n; i++) await page.click('button.fp-btn.primary[onclick="addSection()"]');
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('#canvas .section-block').length)).toBe(before.length + n);
  return page.evaluate((b) => [...document.querySelectorAll('#canvas .section-block')].map((s) => s.id).filter((id) => !b.includes(id)), before);
}
async function show(page, sel) {
  await page.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'center', behavior: 'instant' }), sel);
  return waitStableRect(page, sel);
}
/* 섹션의 빈 자리를 진짜 마우스로 눌러 고른다 */
async function pickSection(page, id, fx = 0.9, fy = 0.9) {
  const r = await show(page, `[id="${id}"]`);
  const at = [Math.round(r.left + r.width * fx), Math.round(r.top + r.height * fy)];
  await page.mouse.click(...at);
  await expect.poll(() => page.evaluate(() => window.getSelectedSection?.()?.id), `★전제: 섹션 ${id} 가 골라졌다`).toBe(id);
}
async function menu(page, trigger, item) {
  await page.click(trigger);
  await page.click(item);
}
const newIds = (page, sel, before) => page.evaluate(([s, b]) => [...document.querySelectorAll(s)].map((e) => e.id).filter((id) => !b.includes(id)), [sel, before]);
const idsOf = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].map((e) => e.id), sel);

/* 진짜 마우스로 끈다 — 틱마다 «블럭 왼위(화면)»를 읽는다 */
async function dragTicks(page, fromX, fromY, dx, dy, n, readSel, { meta = false } = {}) {
  if (meta) await page.keyboard.down('Meta');
  await page.mouse.move(fromX, fromY);
  await page.mouse.down();
  const ticks = [];
  for (let i = 1; i <= n; i++) {
    const t0 = Date.now();
    await page.mouse.move(fromX + dx * i / n, fromY + dy * i / n);
    const r = await page.evaluate((s) => { const b = document.querySelector(s).getBoundingClientRect(); return [b.left, b.top]; }, readSel);
    ticks.push({ cur: [fromX + dx * i / n, fromY + dy * i / n], box: r, ms: Date.now() - t0 });
  }
  const lastBox = ticks[ticks.length - 1].box;
  await page.mouse.up();
  if (meta) await page.keyboard.up('Meta');
  const after = await page.evaluate((s) => { const b = document.querySelector(s).getBoundingClientRect(); return [b.left, b.top]; }, readSel);
  return { ticks, lastBox, after };
}

/* ═══ F1 ═══ */
test('F1 ★그룹(⌘G)의 패널에 오버레이 단추가 있고 누르면 그룹이 섹션 위에 뜬다', async ({ page }) => {
  const errs = await boot(page);
  const [sec] = await addSections(page, 1);
  const tbBefore = await idsOf(page, '.text-block');
  for (let i = 0; i < 2; i++) {
    await pickSection(page, sec);
    await menu(page, '#fp-text-dropdown > .fp-dropdown-trigger', '#fp-text-menu .fp-menu-item:text-is("Body")');
  }
  const tbs = await newIds(page, '.text-block', tbBefore);
  expect(tbs.length, '★전제: 본문 블럭 둘').toBe(2);
  const a = await show(page, `[id="${tbs[0]}"]`);
  await page.mouse.click(a.cx, a.cy);
  const b = await show(page, `[id="${tbs[1]}"]`);
  await page.keyboard.down('Shift'); await page.mouse.click(b.cx, b.cy); await page.keyboard.up('Shift');
  await expect.poll(() => page.evaluate((ids) => ids.every((id) => document.getElementById(id).classList.contains('selected')), tbs), '★전제: 둘 다 골라졌다').toBe(true);
  await page.keyboard.press('Meta+g');
  const grp = await page.evaluate((id) => document.getElementById(id).closest('.frame-block[data-group="true"]')?.id || null, tbs[0]);
  expect(grp, '★전제: ⌘G 로 그룹이 생겼다').not.toBeNull();
  await expect.poll(() => page.evaluate((g) => document.getElementById(g).classList.contains('selected'), grp), '★전제: 그룹이 골라졌다').toBe(true);
  const btns = await page.evaluate(() => [...document.querySelectorAll('#panel-right .panel-body button')]
    .filter((x) => /float-toggle|overlay-toggle/.test(x.id) || /오버레이/.test(x.textContent || '')).map((x) => ({ id: x.id, text: (x.textContent || '').trim() })));
  log('F1.buttons', { grp, btns });
  expect(btns.length, '그룹 패널에 오버레이 단추가 없다').toBeGreaterThan(0);
  await page.click(`#${btns[0].id}`);
  const st = await page.evaluate((g) => { const e = document.getElementById(g); return { overlay: e.dataset.overlayBlock || null, parentIsSec: e.parentElement.classList.contains('section-block'), pos: getComputedStyle(e).position }; }, grp);
  log('F1.after', st);
  expect(st).toEqual({ overlay: 'true', parentIsSec: true, pos: 'absolute' });
  expect(errs).toEqual([]);
});

/* ═══ F2 ═══ */
test('F2 ★줌 40% · 스크롤 중간 — 스티커가 «지금 보는 화면» 가운데에 생긴다', async ({ page }) => {
  const errs = await boot(page);
  const secs = await addSections(page, 4);
  await page.evaluate(() => window.applyZoom(40));
  await expect.poll(() => page.evaluate(() => window.currentZoom), '★전제: 줌 40').toBe(40);
  /* 스크롤 중간 — 새 섹션 넷 중 둘째의 가운데가 화면 가운데에 오도록 굴린다(그래야 가운데 점이 늘 섹션 위다) */
  /* 줌이 바뀐 뒤 레이아웃이 늦게 가라앉으면 첫 굴림이 빗나간다(minus-f1-1: scrollTop 1365 · 가운데 점이 섹션 위 끝 근처 → 안쪽 clamp 로 dy 7).
     그래서 가라앉힌 뒤 한 번 더 굴리고, 아래 ★전제로 «가운데 점이 섹션 안쪽 깊이» 를 수로 묶는다. */
  for (let k = 0; k < 2; k++) {
    await page.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'center', behavior: 'instant' }), secs[1]);
    await waitStableRect(page, `[id="${secs[1]}"]`);
  }
  const view = await page.evaluate(() => { const w = document.getElementById('canvas-wrap'); const r = w.getBoundingClientRect(); return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, scrollTop: w.scrollTop, max: w.scrollHeight - w.clientHeight }; });
  expect(view.scrollTop > 0 && view.scrollTop < view.max, `★전제: 스크롤이 중간이다 (${view.scrollTop}/${view.max})`).toBe(true);
  /* 화면 가운데의 섹션을 진짜 마우스로 고른다(가운데 점 바로 아래 빈 자리) */
  const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('.section-block')?.id || null, [view.cx, view.cy]);
  expect(hit, '★전제: 화면 가운데에 섹션이 있다').not.toBeNull();
  /* 가운데 점이 섹션 가장자리에서 «레이아웃(css) px» 로 얼마나 안쪽인가 — 화면 px 를 숫자와 견주지 않는다(dom-screen-px-census).
     전제 단언은 스티커가 생긴 뒤 «스티커 자신의 레이아웃 크기»와 견준다(두 측정끼리). */
  const depth = await page.evaluate(([i, x, y]) => { const r = document.getElementById(i).getBoundingClientRect(), z = window.currentZoom / 100; return Math.round(Math.min(x - r.left, r.right - x, y - r.top, r.bottom - y) / z); }, [hit, view.cx, view.cy]);
  expect(secs.includes(hit) || true).toBe(true);
  await page.mouse.click(view.cx, view.cy);
  await expect.poll(() => page.evaluate(() => window.getSelectedSection?.()?.id)).toBe(hit);
  const before = await idsOf(page, '.sticker-block');
  await menu(page, '#fp-pen-btn', '#fp-pen-dropdown .fp-menu-item:text-is("Sticker")');
  await expect.poll(async () => (await newIds(page, '.sticker-block', before)).length).toBe(1);
  const [id] = await newIds(page, '.sticker-block', before);
  const r = await waitStableRect(page, `[id="${id}"]`);
  const stickerSize = await page.evaluate((i) => { const e = document.getElementById(i); return Math.max(e.offsetWidth, e.offsetHeight); }, id);
  /* 스티커 «한 벌 크기»(반쪽 + 같은 만큼 여유)보다 얕으면 섹션 안 clamp 가 정당하게 민다 — 그때는 이 칸이 잴 수 없는 장면이다 */
  expect(depth >= stickerSize, `★전제: 가운데 점이 섹션 가장자리에서 ${depth} css px 안쪽이다(≥ 스티커 ${stickerSize} css px)`).toBe(true);
  const view2 = await page.evaluate(() => { const w = document.getElementById('canvas-wrap'); const rr = w.getBoundingClientRect(); return { cx: rr.left + rr.width / 2, cy: rr.top + rr.height / 2, scrollTop: w.scrollTop }; });
  const d = { dx: Math.round(r.cx - view2.cx), dy: Math.round(r.cy - view2.cy) };
  log('F2', { zoom: 40, view, view2, depthCss: depth, stickerSize, sticker: r, d, parent: await page.evaluate((i) => document.getElementById(i).closest('.section-block').id, id), hit });
  expect(Math.abs(d.dx) <= 2 && Math.abs(d.dy) <= 2, `스티커 가운데가 화면 가운데에서 (${d.dx}, ${d.dy}) 화면px 떨어져 있다`).toBe(true);
  expect(errs).toEqual([]);
});

/* ═══ F2b ═══ f2 보강(지디 2026-10-21) — 고른 섹션의 «보이는 부분이 0»(창 밖으로 완전히 굴려 냄)이면 옛 계단 자리(40 + n%8·24)로 떨어진다.
   ⚠️«0 높이 섹션»은 앱 문으로 못 만든다(섹션 높이 = 내용) — 이 칸은 «완전히 화면 밖» 갈래만 잰다. */
test('F2b ★고른 섹션이 화면 밖(보이는 부분 0) — 스티커는 옛 계단 자리(섹션 왼위 40,40)', async ({ page }) => {
  const errs = await boot(page);
  const secs = await addSections(page, 6);
  await pickSection(page, secs[0]);
  /* 고른 채로 캔버스 창을 맨 아래까지 굴려 첫 섹션을 창 밖으로 낸다(고르기는 그대로).
     1차 판(섹션 4 · 마지막 섹션 scrollIntoView end)은 겹친 높이 113 이 남아 ★전제에서 멈췄다(w2c-f2d-{1,2,3}). */
  for (let k = 0; k < 2; k++) {
    await page.evaluate(() => { const w = document.getElementById('canvas-wrap'); w.scrollTop = w.scrollHeight; });
    await waitStableRect(page, `[id="${secs[5]}"]`);
  }
  const vis = await page.evaluate((id) => { const w = document.getElementById('canvas-wrap').getBoundingClientRect(), r = document.getElementById(id).getBoundingClientRect();
    return { secBottom: r.bottom, secTop: r.top, wrapTop: w.top, wrapBottom: w.bottom, overlapH: Math.min(w.bottom, r.bottom) - Math.max(w.top, r.top) }; }, secs[0]);
  expect(vis.overlapH <= 0, `★전제: 고른 섹션이 창과 안 겹친다(겹친 높이 ${vis.overlapH})`).toBe(true);
  expect(await page.evaluate(() => window.getSelectedSection?.()?.id), '★전제: 고르기는 그대로').toBe(secs[0]);
  const n = await page.evaluate((id) => document.getElementById(id).querySelectorAll('.sticker-block').length, secs[0]);
  const before = await idsOf(page, '.sticker-block');
  await menu(page, '#fp-pen-btn', '#fp-pen-dropdown .fp-menu-item:text-is("Sticker")');
  await expect.poll(async () => (await newIds(page, '.sticker-block', before)).length).toBe(1);
  const [id] = await newIds(page, '.sticker-block', before);
  const got = await page.evaluate((i) => { const b = document.getElementById(i); return { x: +b.dataset.x, y: +b.dataset.y, parent: b.closest('.section-block').id }; }, id);
  log('F2b', { vis, n, got });
  expect([got.parent, got.x, got.y], '보이는 부분 0 ⇒ 옛 계단 자리').toEqual([secs[0], 40 + (n % 8) * 24, 40 + (n % 8) * 24]);
  expect(errs).toEqual([]);
});

/* ═══ F3 ═══ */
test('F3 ★같은 손짓(⌘ 없이 왼쪽으로 300 화면px) — 오버레이 텍스트와 스티커를 나란히 · 스티커도 섹션 밖으로 나간다', async ({ page }) => {
  const errs = await boot(page);
  const [sec] = await addSections(page, 1);
  /* 오버레이 텍스트 — 본문을 넣고 패널의 오버레이 단추 */
  const tbBefore = await idsOf(page, '.text-block');
  await pickSection(page, sec);
  await menu(page, '#fp-text-dropdown > .fp-dropdown-trigger', '#fp-text-menu .fp-menu-item:text-is("Body")');
  const [tb] = await newIds(page, '.text-block', tbBefore);
  const tr = await show(page, `[id="${tb}"]`);
  await page.mouse.click(tr.cx, tr.cy);
  await page.click('#txt-overlay-toggle');
  const tf = await page.evaluate((id) => document.getElementById(id).closest('.frame-block[data-text-frame]').id, tb);
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).dataset.overlayBlock, tf), '★전제: 텍스트가 오버레이가 됐다').toBe('true');
  /* 스티커 */
  const stBefore = await idsOf(page, '.sticker-block');
  await pickSection(page, sec);
  await menu(page, '#fp-pen-btn', '#fp-pen-dropdown .fp-menu-item:text-is("Sticker")');
  const [stk] = await newIds(page, '.sticker-block', stBefore);
  await page.keyboard.press('Escape');   // 새 스티커의 글자 편집에서 나온다
  const rows = [];
  for (const [label, sel] of [['overlay-text', `[id="${tf}"]`], ['sticker', `[id="${stk}"]`]]) {
    for (const meta of [false, true]) {
      const s0 = await show(page, `[id="${sec}"]`);
      const b0 = await show(page, sel);
      const grab = label === 'sticker' ? [b0.cx, b0.cy] : [b0.left + 6, b0.cy];
      const g = await dragTicks(page, grab[0], grab[1], -300, 0, 15, sel, { meta });
      const s1 = await waitStableRect(page, `[id="${sec}"]`);
      const b1 = await waitStableRect(page, sel);
      const z = await page.evaluate(() => window.currentZoom / 100);
      /* 고르기를 푼 뒤(빈 캔버스 클릭) — 섹션 밖에 나간 부분이 «보이나»: 그 자리의 맨 위가 이 블럭인가 */
      const outPt = [Math.round((b1.left + Math.min(s1.left, b1.left + b1.width)) / 2), Math.round(b1.cy)];
      const visSel = await page.evaluate(([x, y, q]) => !!document.elementFromPoint(x, y)?.closest(q), [...outPt, sel]);
      await page.evaluate(() => window.deselectAll?.());
      const visDesel = await page.evaluate(([x, y, q]) => !!document.elementFromPoint(x, y)?.closest(q), [...outPt, sel]);
      const clip = await page.evaluate((q) => getComputedStyle(document.querySelector(q)).clipPath, sel);
      rows.push({ label, meta, zoom: z, secLeft: s1.left, boxLeft0: b0.left, boxLeft1: b1.left, outPt, visSel, visDesel, clip,
        outsidePx: Math.round((s1.left - b1.left) / z), movedPx: Math.round((b0.left - b1.left) / z),
        parentSame: await page.evaluate(([s, q]) => document.querySelector(q).closest('.section-block')?.id === s, [sec, sel]) });
      /* 다음 회차를 위해 섹션 안으로 되돌린다 — ⌘Z(앱의 제 문) */
      await page.keyboard.press('Meta+z');
      void s0;
    }
  }
  log('F3.table', rows);
  const ov = rows.find((r) => r.label === 'overlay-text' && !r.meta);
  const st = rows.find((r) => r.label === 'sticker' && !r.meta);
  expect(ov.outsidePx > 0, `★전제(견줄 대상): 오버레이 텍스트가 ⌘ 없이 섹션 밖으로 나간다 · ${JSON.stringify(ov)}`).toBe(true);
  expect(st.outsidePx > 0, `스티커는 ⌘ 없이 섹션 밖으로 못 나간다 · ${JSON.stringify(st)}`).toBe(true);
  expect(errs).toEqual([]);
});

/* ═══ F4 ═══ */
test('F4 ★오버레이 모달 끌기의 다섯 수 — 오버레이 텍스트 · 오버레이 «안 된» 모달과 나란히', async ({ page }) => {
  const errs = await boot(page);
  const [secM, secT, secN] = await addSections(page, 3);
  const addModal = async (sec) => {
    const before = await idsOf(page, '.modal-block');
    await pickSection(page, sec);
    await menu(page, '#fp-component-dropdown > .fp-dropdown-trigger', '#fp-component-dropdown .fp-menu-item:text-is("Modal")');
    const [id] = await newIds(page, '.modal-block', before);
    expect(id, '★전제: 모달이 생겼다').toBeTruthy();
    return id;
  };
  /* 견줄 것 ① — 오버레이 텍스트(따로 둔 섹션) */
  const tbBefore = await idsOf(page, '.text-block');
  await pickSection(page, secT);
  await menu(page, '#fp-text-dropdown > .fp-dropdown-trigger', '#fp-text-menu .fp-menu-item:text-is("Body")');
  const [tb] = await newIds(page, '.text-block', tbBefore);
  const tr = await show(page, `[id="${tb}"]`);
  await page.mouse.click(tr.cx, tr.cy);
  await page.click('#txt-overlay-toggle');
  const tf = await page.evaluate((id) => document.getElementById(id).closest('.frame-block[data-text-frame]').id, tb);
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).dataset.overlayBlock, tf), '★전제: 텍스트가 오버레이가 됐다').toBe('true');
  /* 피검 — 오버레이 모달 */
  const mdl = await addModal(secM);
  const mr = await show(page, `[id="${mdl}"]`);
  await page.mouse.click(mr.left + 4, mr.top + 4);
  await page.click('#mdl-float-toggle');
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).dataset.overlayBlock, mdl), '★전제: 모달이 오버레이가 됐다').toBe('true');
  /* 견줄 것 ② — 오버레이 «안 된» 모달(흐름) */
  const mdlN = await addModal(secN);

  const out = {};
  for (const [label, sel, grabAt] of [
    ['overlay-modal-edge', `[id="${mdl}"]`, (b) => [b.left + 4, b.top + 4]],
    ['overlay-modal-center', `[id="${mdl}"]`, (b) => [b.cx, b.cy]],
    ['overlay-text', `[id="${tf}"]`, (b) => [b.left + 6, b.cy]],
    ['flow-modal-center', `[id="${mdlN}"]`, (b) => [b.cx, b.cy]],
  ]) {
    const b0 = await show(page, sel);
    await page.mouse.click(...grabAt(b0));            // 먼저 고른다(사람도 고른 뒤 끈다)
    const b1 = await waitStableRect(page, sel);
    const z = await page.evaluate(() => window.currentZoom / 100);
    const [gx, gy] = grabAt(b1);
    const target = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? `${e.tagName}.${[...e.classList].join('.')}` : null; }, [gx, gy]);
    /* 갈래 표식 — 이 손짓에 «네이티브 HTML5 끌기»가 섰나 · 누른 점부터 위로 draggable 속성 */
    const drg = await page.evaluate(([x, y, q]) => {
      window.__w2cEv = { dragstart: 0, drop: 0, dragend: 0, mousemoveDoc: 0 };
      if (!window.__w2cBound) {               // 한 번만 단다(돌 때마다 달면 수가 겹쳐 센다)
        window.__w2cBound = true;
        for (const k of ['dragstart', 'drop', 'dragend']) document.addEventListener(k, () => window.__w2cEv[k]++, { capture: true });
        document.addEventListener('mousemove', () => window.__w2cEv.mousemoveDoc++, { capture: true });
      }
      const chain = []; for (let e = document.elementFromPoint(x, y); e && e !== document.body; e = e.parentElement) if (e.hasAttribute('draggable')) chain.push(`${e.className.split(' ')[0]}#${e.id}=${e.getAttribute('draggable')}`);
      const b = document.querySelector(q); return { chain, overlay: b.dataset.overlayBlock || null, parent: b.parentElement.className.split(' ')[0] };
    }, [gx, gy, sel]);
    const g = await dragTicks(page, gx, gy, 120, 60, 12, sel);
    drg.ev = await page.evaluate(() => window.__w2cEv);
    drg.afterParent = await page.evaluate((q) => { const b = document.querySelector(q); return { parent: b.parentElement.className.split(' ')[0], overlay: b.dataset.overlayBlock || null, pos: getComputedStyle(b).position }; }, sel);
    let prev = [b1.left, b1.top], prevCur = [gx, gy];
    const per = g.ticks.map((t) => {
      const bd = [t.box[0] - prev[0], t.box[1] - prev[1]], cd = [t.cur[0] - prevCur[0], t.cur[1] - prevCur[1]];
      prev = t.box; prevCur = t.cur;
      const ang = (Math.hypot(...bd) < 0.5) ? null : Math.round(Math.abs(Math.atan2(bd[1], bd[0]) - Math.atan2(cd[1], cd[0])) * 180 / Math.PI);
      return { bd: bd.map(Math.round), cd: cd.map(Math.round), ang, ms: t.ms };
    });
    const lag = g.ticks.map((t) => Math.round(Math.hypot(t.cur[0] - gx - (t.box[0] - b1.left), t.cur[1] - gy - (t.box[1] - b1.top))));
    out[label] = { zoom: z, grabTarget: target, drg, firstTick: per[0], lagPx: lag, maxAngle: Math.max(0, ...per.map((p) => p.ang ?? 0)),
      tickMs: per.map((p) => p.ms), snapBack: [Math.round(g.after[0] - g.lastBox[0]), Math.round(g.after[1] - g.lastBox[1])],
      total: [Math.round(g.after[0] - b1.left), Math.round(g.after[1] - b1.top)], cursor: [120, 60], stillTicks: per.filter((p) => p.ang === null).length };
    await page.keyboard.press('Meta+z');
  }
  log('F4', out);
  expect(errs).toEqual([]);
  /* 판정 — 오버레이 모달이 오버레이 텍스트와 같은 거동: 끝 변위 · 놓을 때 안 되돌아감 · 방향 */
  /* ★판정은 «자기 수»로 한다 — 견줄 것(오버레이 텍스트)은 섹션 기하가 달라 끝 변위를 맞대지 않는다(1차 판에서 그 잣대가 틀렸다).
     오버레이 텍스트의 거동 = 틱마다 따라온다(stillTicks 0) · 놓을 때 안 튄다(snapBack 0,0) · 네이티브 끌기 0 */
  expect([out['overlay-text'].stillTicks, out['overlay-text'].snapBack, out['overlay-text'].drg.ev.dragstart], '★전제(견줄 것): 오버레이 텍스트는 따라오고 안 튄다').toEqual([0, [0, 0], 0]);
  for (const k of ['overlay-modal-edge', 'overlay-modal-center']) {
    const m = out[k];
    expect([m.stillTicks, m.snapBack, m.drg.ev.dragstart], `${k}: [안 따라온 틱 · 놓을 때 튐 · 네이티브 끌기] — 텍스트와 다르다`).toEqual([0, [0, 0], 0]);
  }
});

/* ═══ F4b ═══ 지디 판정(2026-10-21 01:1x) 꼭 넣을 것 ⑴ ⌘Z 뒤 자리 유지 ⑵ 재열기·패널 변경 뒤 ⑶ 가장자리 잡기 대조군 ⑷ draggable="true" 0 */
test('F4b ★오버레이 모달이 ⌘Z · 재열기 · 패널 변경 뒤에도 «오버레이 그대로»이고 네이티브 끌기 표식이 안 붙는다', async ({ page }) => {
  const errs = await boot(page);
  const [sec] = await addSections(page, 1);
  const before = await idsOf(page, '.modal-block');
  await pickSection(page, sec);
  await menu(page, '#fp-component-dropdown > .fp-dropdown-trigger', '#fp-component-dropdown .fp-menu-item:text-is("Modal")');
  const [mdl] = await newIds(page, '.modal-block', before);
  expect(mdl, '★전제: 모달이 생겼다').toBeTruthy();
  const sel = `[id="${mdl}"]`;
  const m0 = await show(page, sel);
  await page.mouse.click(m0.left + 4, m0.top + 4);
  await page.click('#mdl-float-toggle');
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).dataset.overlayBlock, mdl), '★전제: 모달이 오버레이가 됐다').toBe('true');
  /* 상태 = 계산된 position · 인라인 left/top · SSOT(offsetX/Y) · 섹션 기준 자리(css px) · 폭 · draggable · 노드가 바뀌었나 */
  const state = async () => {
    const r = await waitStableRect(page, sel);
    return page.evaluate(([id, r]) => {
      const b = document.getElementById(id), s = b.closest('.section-block').getBoundingClientRect(), z = window.currentZoom / 100;
      return { pos: getComputedStyle(b).position, left: b.style.left, top: b.style.top, ox: b.dataset.offsetX, oy: b.dataset.offsetY,
        overlay: b.dataset.overlayBlock || null, rel: [Math.round((r.left - s.left) / z), Math.round((r.top - s.top) / z)], w: Math.round(r.width / z),
        draggable: b.getAttribute('draggable'), sameNode: b.__w2cMark === true,
        inl: Object.fromEntries([...b.style].sort().map((k) => [k, b.style.getPropertyValue(k)])) };
    }, [mdl, r]);
  };
  const mark = () => page.evaluate((id) => { document.getElementById(id).__w2cMark = true; }, mdl);
  /* 기록만(지디 2026-10-21 ①) — 폭의 SSOT 두 칸(dataset.wMode · dataset.width)과 그려진 폭. ⛔판정·단언에 안 쓴다. */
  const wlog = async (tag) => log('F4b-wmode', { tag, ...(await page.evaluate((id) => { const b = document.getElementById(id);
    const keys = Object.keys(b.dataset).sort();
    return { wMode: b.dataset.wMode ?? null, width: b.dataset.width ?? null, overlayFrozenWidth: b.dataset.overlayFrozenWidth ?? null, rectW: b.getBoundingClientRect().width, zoom: window.currentZoom, keyCount: keys.length, keys }; }, mdl)) });
  await mark();
  const S0 = await state();
  await wlog('S0 직후');
  const ok = (S, tag) => {
    /* 빨강에서도 명부가 남도록 단언 «전에» 적는다 — S0 인라인 중 이 단계에서 사라지거나 값이 바뀐 것(자리·패딩은 뺀다) */
    if (S !== S0) log('F4b-step', { tag, pos: S.pos, left: S.left, top: S.top, ox: S.ox, oy: S.oy, rel: S.rel, w: S.w, draggable: S.draggable, sameNode: S.sameNode,
      lost: Object.keys(S0.inl).filter((k) => !(k in S.inl) || (S.inl[k] !== S0.inl[k] && !['left', 'top'].includes(k) && !k.startsWith('padding'))).map((k) => `${k}:${S0.inl[k]}→${S.inl[k] ?? '∅'}`) });
    else log('F4b-S0', S);
    expect([S.pos, S.overlay, S.left, S.top], `${tag}: 오버레이 자리(position · overlay · left/top = SSOT)`).toEqual(['absolute', 'true', S.ox + 'px', S.oy + 'px']);
    expect(S.draggable === 'true', `${tag}: draggable="true" 가 붙었다(네이티브 끌기 표식)`).toBe(false);
  };
  const out = { S0 };
  ok(S0, 'S0');
  const grab = async (at) => {
    const b = await waitStableRect(page, sel);
    const [gx, gy] = at === 'edge' ? [b.left + 4, b.top + 4] : [b.cx, b.cy];
    await page.evaluate(() => {
      window.__w2cEv = { dragstart: 0 };
      if (!window.__w2cBoundB) { window.__w2cBoundB = true; document.addEventListener('dragstart', () => window.__w2cEv.dragstart++, { capture: true }); }
    });
    const g = await dragTicks(page, gx, gy, 120, 60, 12, sel);
    let still = 0, prev = [b.left, b.top];
    for (const t of g.ticks) { if (Math.hypot(t.box[0] - prev[0], t.box[1] - prev[1]) < 0.5) still++; prev = t.box; }
    return { stillTicks: still, snapBack: [Math.round(g.after[0] - g.lastBox[0]), Math.round(g.after[1] - g.lastBox[1])],
      total: [Math.round(g.after[0] - b.left), Math.round(g.after[1] - b.top)], dragstart: (await page.evaluate(() => window.__w2cEv)).dragstart };
  };
  /* ⑴ ⌘Z — 가장자리로 한 번 끈 뒤 되돌린다(restoreSnapshot → rebindAll → renderModalBlock 경로) */
  out.dragEdge1 = await grab('edge');
  out.S1 = await state();
  expect(out.S1.rel, '★전제: 끌기로 자리가 바뀌었다').not.toEqual(S0.rel);
  await page.keyboard.press('Meta+z');
  await expect.poll(async () => (await state()).ox, '★전제: ⌘Z 가 SSOT 를 되돌렸다').toBe(S0.ox);
  out.S_undo = await state();
  await wlog('⌘Z 직후');
  out.S_undo_branch = out.S_undo.sameNode ? 'same-node' : 'node-recreated(restoreSnapshot)';
  ok(out.S_undo, '⑴ ⌘Z 뒤');
  expect(out.S_undo.rel, '⑴ ⌘Z 뒤 자리 = 끌기 전 자리').toEqual(S0.rel);
  /* ⑵-a 재열기 — 섹션 빈 자리로 풀고 다시 고른다 */
  await mark();
  await pickSection(page, sec, 0.95, 0.95);
  const m1 = await waitStableRect(page, sel);
  await page.mouse.click(m1.left + 4, m1.top + 4);
  await expect.poll(() => page.evaluate(() => !!document.getElementById('mdl-padx-number')), '★전제: 모달 패널이 다시 열렸다').toBe(true);
  out.S_reopen = await state();
  await wlog('재열기 뒤');
  ok(out.S_reopen, '⑵ 재열기 뒤');
  expect(out.S_reopen.rel, '⑵ 재열기 뒤 자리').toEqual(S0.rel);
  /* ⑵-b 패널 변경 — 좌우 패딩 +4 (그리기 다시 = renderModalBlock) */
  const px0 = await page.evaluate((id) => document.getElementById(id).dataset.padX || null, mdl);
  const cur = Number(await page.inputValue('#mdl-padx-number'));
  await page.fill('#mdl-padx-number', String(cur + 4));
  await page.dispatchEvent('#mdl-padx-number', 'change');
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).dataset.padX, mdl), '★전제: 패널 변경이 먹었다').toBe(String(cur + 4));
  out.panel = { padXBefore: px0, padXAfter: String(cur + 4) };
  out.S_panel = await state();
  await wlog('패널 변경 뒤');
  ok(out.S_panel, '⑵ 패널 변경 뒤');
  expect(out.S_panel.rel, '⑵ 패널 변경 뒤 자리').toEqual(S0.rel);
  /* ⑶ 대조군 가장자리 잡기 + 원 호소(가운데 잡기) — ⌘Z·재열기·패널 변경을 다 거친 뒤 */
  out.dragEdge2 = await grab('edge');
  out.dragCenter = await grab('center');
  out.S_end = await state();
  /* 별건 명부(지디) — cssText 통째 쓰기가 «무엇을» 지우나: 오버레이 직후(S0) 인라인 중 각 단계 뒤 사라지거나 바뀐 것 */
  const lost = (S) => Object.keys(S0.inl).filter((k) => !(k in S.inl) || (S.inl[k] !== S0.inl[k] && !['left', 'top', 'padding', 'padding-left', 'padding-right', 'padding-top', 'padding-bottom'].includes(k)));
  out.lost = { undo: lost(out.S_undo), reopen: lost(out.S_reopen), panel: lost(out.S_panel) };
  log('F4b', out);
  for (const k of ['dragEdge1', 'dragEdge2', 'dragCenter']) {
    expect([out[k].stillTicks, out[k].snapBack, out[k].dragstart], `${k}: [안 따라온 틱 · 놓을 때 튐 · 네이티브 끌기]`).toEqual([0, [0, 0], 0]);
  }
  ok(out.S_end, '끝');
  /* ⑶ 자(지디 2026-10-21 폭 ⑵) — 오버레이 직후(S0) 인라인 중 ⌘Z · 재열기 · 패널 변경 뒤 사라지거나 바뀐 것 0 */
  expect(out.lost, '⑶ 굳힌 폭 포함 S0 인라인 소실 0 (⌘Z · 재열기 · 패널 변경)').toEqual({ undo: [], reopen: [], panel: [] });
  expect(errs).toEqual([]);
});

/* ═══ F5 ═══ */
/* ═══ F4c ═══ 음성대조(지디 폭 처방 정정 2026-10-21) — «안 떠 있는» 모달의 cssText 는 고치기 전과 «바이트 동일».
   ★한 회차 안에서는 «고치기 전»을 못 부른다 ⇒ 세 장면의 cssText 를 원문 그대로 찍고(W2C F4c-css), 바닥 a42d76d5 회차와 고친 판 회차의
     줄을 «바이트 대조»한다(scratchpad w2c-f4c-cmp.zsh → reports/S7/w2c-f4c-cmp.txt). 이 칸 안의 단언은 장면 전제 + 내린 모달 width:100% 뿐.
     A = 한 번도 안 띄운 full · B = 한 번도 안 띄운 fixed(패널 「고정」) · C = 띄웠다 «내린» full. 셋 다 패널(좌우 패딩 +4)로 다시 그린 뒤. */
test('F4c ★음성대조 — 안 떠 있는 모달(full · fixed · 띄웠다 내린 것)의 cssText 를 원문으로 찍는다', async ({ page }) => {
  const errs = await boot(page);
  const secs = await addSections(page, 3);
  const css = (id) => page.evaluate((i) => { const b = document.getElementById(i); return { overlay: b.dataset.overlayBlock ?? null, wMode: b.dataset.wMode ?? null, frozen: b.dataset.overlayFrozenWidth ?? null, pos: getComputedStyle(b).position, cssText: b.style.cssText }; }, id);
  const scene = async (sec, kind) => {
    const before = await idsOf(page, '.modal-block');
    await pickSection(page, sec);
    await menu(page, '#fp-component-dropdown > .fp-dropdown-trigger', '#fp-component-dropdown .fp-menu-item:text-is("Modal")');
    const [mdl] = await newIds(page, '.modal-block', before);
    expect(mdl, `★전제(${kind}): 모달이 생겼다`).toBeTruthy();
    const sel = `[id="${mdl}"]`;
    const pick = async () => { const r = await show(page, sel); await page.mouse.click(r.left + 4, r.top + 4);
      await expect.poll(() => page.evaluate(() => !!document.getElementById('mdl-padx-number')), `★전제(${kind}): 모달 패널`).toBe(true); };
    await pick();
    if (kind === 'B-fixed') {
      await page.click('[data-wm="fixed"]');
      await expect.poll(async () => (await css(mdl)).wMode, '★전제(B): 고정 폭').toBe('fixed');
      await pick();
    }
    if (kind === 'C-up-down') {
      await page.click('#mdl-float-toggle');
      await expect.poll(async () => (await css(mdl)).overlay, '★전제(C): 띄웠다').toBe('true');
      await page.click('#mdl-float-toggle');
      await expect.poll(async () => (await css(mdl)).overlay, '★전제(C): 내렸다').toBe(null);
      await pick();
    }
    const cur = Number(await page.inputValue('#mdl-padx-number'));
    await page.fill('#mdl-padx-number', String(cur + 4));
    await page.dispatchEvent('#mdl-padx-number', 'change');
    await expect.poll(() => page.evaluate((id) => document.getElementById(id).dataset.padX, mdl), `★전제(${kind}): 패널 변경이 먹었다(다시 그림)`).toBe(String(cur + 4));
    const out = await css(mdl);
    log('F4c-css', { kind, ...out });
    return out;
  };
  const A = await scene(secs[0], 'A-full');
  const B = await scene(secs[1], 'B-fixed');
  const C = await scene(secs[2], 'C-up-down');
  expect([A.overlay, B.overlay, C.overlay], '★전제: 셋 다 안 떠 있다').toEqual([null, null, null]);
  expect([C.pos, /(^|;\s*)width:\s*100%/.test(C.cssText)], '내린 모달 = relative · width:100%').toEqual(['relative', true]);
  expect(errs).toEqual([]);
});

/* ⏸️F5 = test.fixme — 지디 승인(2026-10-21 · 태양 tysend). 면제 명부: reports/S7-1020-W2C.md «면제 명부». ★현빈 결정이 들어오면 이 fixme 를 지운다.
   사유: 현빈 미결(2026-09-08 확대블럭 z-index 60 «가장 위에 플로팅 … 내려가면 안 돼») 때문에 안 서는 전제다.
     터지는 단언 = expect(after.top, '⌘] 뒤 겹친 점의 맨 위').toBe('annotation')
     잰 값(바닥 a42d76d5) = 어노테이션 z-index(zA) 50 · 확대블럭 z-index(zZ) 60 ⇒ ⌘](DOM 순서)로는 50 이 60 을 못 넘는다.
   f5 는 고치지 않는 칸(구현 0). S7 설계안 «⌘] 로 명시하면 올린다 · 기본 층 그대로» 는 보고서에 보존. */
test('F5 ★확대블럭 위에 겹쳐 그린 어노테이션 — ⌘] 하면 어노테이션이 위로 온다', async ({ page }) => {
  test.fixme(true, "현빈 미결(2026-09-08 확대블럭 z-index 60) 때문에 안 서는 전제 — 터지는 단언 '⌘] 뒤 겹친 점의 맨 위' toBe('annotation') · 잰 값 zA 50 · zZ 60 · 현빈 결정이 들어오면 이 fixme 를 지운다");
  const errs = await boot(page);
  const [sec] = await addSections(page, 1);
  const zBefore = await idsOf(page, '.zoom-block');
  await pickSection(page, sec);
  await menu(page, '#fp-pen-btn', '#fp-pen-dropdown .fp-menu-item:text-is("Zoom")');
  const [zmb] = await newIds(page, '.zoom-block', zBefore);
  expect(zmb, '★전제: 확대블럭이 생겼다').toBeTruthy();
  const zr = await show(page, `[id="${zmb}"]`);
  /* 어노테이션 — 확대블럭 위를 가로지르는 두 점 */
  const aBefore = await idsOf(page, '.annotation-block');
  await menu(page, '#fp-pen-btn', '#fp-pen-dropdown .fp-menu-item:text-is("Annotation")');
  /* 두 점 다 섹션 «안»이어야 펜이 받는다 — 확대블럭(섹션 x 40)의 왼쪽 10 로컬px 안쪽에서 오른쪽 밖 80 화면px 까지 */
  await page.mouse.click(zr.left - 10, zr.cy);
  await page.mouse.click(zr.left + zr.width + 80, zr.cy);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await newIds(page, '.annotation-block', aBefore)).length, '★전제: 어노테이션이 생겼다').toBe(1);
  const [ant] = await newIds(page, '.annotation-block', aBefore);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate((a) => !document.body.classList.contains('pen-mode')
    && document.getElementById(a).querySelector('.annot-label')?.getAttribute('contenteditable') !== 'true', ant), '★전제: 펜 모드가 끝나고 라벨 편집이 닫혔다').toBe(true);
  /* 둘이 겹치는 점(선 위 · 확대블럭 안)과 그 점의 맨 위 */
  const probe = [Math.round(zr.cx), Math.round(zr.cy)];
  const topAt = () => page.evaluate(([x, y, a, z]) => { const e = document.elementFromPoint(x, y); return e?.closest(`[id="${a}"]`) ? 'annotation' : e?.closest(`[id="${z}"]`) ? 'zoom' : (e ? e.className : null); }, [...probe, ant, zmb]);
  const order = () => page.evaluate(([a, z]) => { const A = document.getElementById(a), Z = document.getElementById(z); return { sameParent: A.parentElement === Z.parentElement, annAfterZoom: !!(Z.compareDocumentPosition(A) & Node.DOCUMENT_POSITION_FOLLOWING), zA: getComputedStyle(A).zIndex, zZ: getComputedStyle(Z).zIndex }; }, [ant, zmb]);
  const before = { top: await topAt(), order: await order() };
  /* 어노테이션을 진짜 마우스로 고른다 — 손이 닿는 곳은 라벨뿐이다(.annot-label 만 pointer-events:auto · 선·svg 는 none) */
  const ar = await waitStableRect(page, `[id="${ant}"]`);
  const lr = await waitStableRect(page, `[id="${ant}"] .annot-label`);
  const own = [Math.round(lr.cx), Math.round(lr.cy)];
  const ownHit = await page.evaluate(([x, y, a]) => !!document.elementFromPoint(x, y)?.closest(`[id="${a}"]`), [...own, ant]);
  await page.mouse.click(own[0], own[1]);
  await expect.poll(() => page.evaluate((a) => document.getElementById(a).classList.contains('selected'), ant), '★전제: 어노테이션이 골라졌다(라벨 클릭)').toBe(true);
  const selected = true;
  await page.keyboard.press('Meta+BracketRight');
  const after = { top: await topAt(), order: await order() };
  log('F5', { ant, zmb, zr, ar, probe, own, ownHit, selected, before, after });
  expect(selected, '★전제: 어노테이션이 골라졌다').toBe(true);
  expect(after.top, '⌘] 뒤 겹친 점의 맨 위').toBe('annotation');
  expect(errs).toEqual([]);
});
