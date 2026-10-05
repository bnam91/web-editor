/* frame-drill-in.dom.spec.js — E93 «보통 프레임 드릴인» 잠금: 첫 클릭 = 프레임 · 두 번째 클릭 = 안의 글자 (태양 lane-e93-drill 2026-10-05)
 *   + U16①/U17②(2026-10-05 지디): 선택 안 된 프레임 우클릭 = 프레임의 메뉴 · 「바로 아래에 여백 넣기 (G)」.
 *
 * ★형제: tests/dom/grid-first-click-block.dom.spec.js(T-058 — 그리드 «첫 클릭 = 블럭 · 두 번째 = 줄»).
 *   같은 사용자 규칙(첫 클릭 = 그릇)의 두 구현 — 프레임 = CSS :145 · 그리드 = JS 걸쇠(block-drag · grdWasCanvasDrilled).
 *   양성대조로 갈림 확인(:145 뺌 → 이 spec 5/5 빨강 · grid-first-click-block 15/15 초록).
 * ★규칙의 자리:
 *   css/editor-blocks.css:145 `.frame-block:not(.selected):not([data-text-frame]):not(:has(.selected)) *:not(.shape-block):not(.shape-handle){pointer-events:none}`
 *     — 선택 안 된 프레임의 자식은 클릭을 못 받는다 → 첫 클릭은 프레임 자체가 맞는다.
 *   css/editor-blocks.css:149 `.frame-block.selected *{pointer-events:auto}` — 고른 프레임은 자식이 받는다 → 두 번째 클릭이 글자로 내려간다.
 *   문서: .claude/rules/js-structure.md(«변경 금지»).
 * ★«같은 규칙, 두 얼굴»(지디): 선택 안 된 프레임 위에선 «클릭»도 «우클릭»도 프레임을 집는다 — 같은 :145 가 우클릭의 e.target 도
 *   프레임으로 만든다. 우클릭 입구 = block-drag.js bindFrameDropZone 의 contextmenu 리스너(U16①).
 * ★프레임 메뉴엔 「블록 템플릿으로 저장」이 «없다» — 왕복 실측에서 넣은 프레임이 선택 안 됨(bindFrameDropZone 미부착).
 *   지디 조건대로 숨겼다(block-factory.js openMenu 주석). ⑤가 그 숨김도 같이 잠근다 — 고쳐지면 거기서 판정을 받아라.
 * ★현빈이 이 규칙을 바꾸면 이 시험이 뒤집힌다 — 그 뒤집힘이 «바뀌었다»의 증거다(맞춰 고치지 말고 판정을 받아라).
 * 잰 사실(2026-10-05 · 772ccadc · 진단 판):
 *   flow 프레임: 1회 = 프레임(F) · 2회 = 글자(T, 프레임도 selected 로 남음).
 *   freeLayout 프레임: flow 와 같다.
 *   중첩(F > F2 > 글자): 1회 = F · 2회 = F2(F 는 풀림) · 3회 = 글자.
 * 규율: 좌표 클릭은 전부 clickAt(맞힌 요소 단언 · _click-at.js) · 고정 대기 0(상태 대기) · 좌표는 «화면 안 + 두 번 연속 같음»일 때만.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/frame-drill-in.dom.spec.js --workers=1 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

async function scene(page, kind) {
  await page.setViewportSize({ width: 1500, height: 1400 });
  const errs = await bootApp(page);
  await page.evaluate((kind) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="S1" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="S1I"><div class="gap-block" data-type="gap" style="height:40px"></div><div class="row" id="S1R" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:60px"></div></div></div>`);
    const TX = (id, s) => { const { block: tb } = window.makeTextBlock('h2'); const tf = window._makeTextFrame(); window.applyTextOpts(tb, tf, {}, 'h2'); tf.appendChild(tb); tb.id = id; tb.querySelector('[class^="tb-"]').textContent = s; return tf; };
    const R = document.getElementById('S1R');
    if (kind === 'flow') { const f = window.makeFrameBlock({ fullWidth: true }); f.id = 'F'; f.style.padding = '30px'; f.appendChild(TX('T', '프레임 안 글')); R.appendChild(f); }
    if (kind === 'free') { const f = window.makeFrameBlock({}); f.id = 'F'; f.style.minHeight = '240px'; const t = TX('T', '자유 프레임 글'); t.style.position = 'absolute'; t.style.left = '40px'; t.style.top = '60px'; f.appendChild(t); R.appendChild(f); }
    if (kind === 'nested') { const f1 = window.makeFrameBlock({ fullWidth: true }); f1.id = 'F'; f1.style.padding = '30px'; const f2 = window.makeFrameBlock({ fullWidth: true }); f2.id = 'F2'; f2.style.padding = '30px'; f2.appendChild(TX('T', '안쪽 글')); f1.appendChild(f2); R.appendChild(f1); }
    window.rebindAll?.(); window.deselectAll?.(); window.applyZoom?.(100);
  }, kind);
  await page.waitForFunction(() => !!document.getElementById('T') && !document.querySelector('#canvas .selected'));
  return errs;
}
/* 글자 안 한 점 — «화면 안 + 두 번 연속 같음»일 때만(e80-delete-sweep pt 와 같은 자). 밖이면 다시 scrollIntoView. */
async function textPoint(page) {
  const once = () => page.evaluate(() => {
    const e = document.querySelector('#T [class^="tb-"]'); let q = e.getBoundingClientRect();
    if (q.top < 0 || q.bottom > window.innerHeight) { e.scrollIntoView({ block: 'center' }); q = e.getBoundingClientRect(); }
    return { p: [q.left + 20, q.top + q.height / 2], r: [q.left, q.top, q.right, q.bottom], inView: q.top >= 0 && q.bottom <= window.innerHeight };
  });
  let prev = await once();
  for (let i = 0; i < 30; i++) {
    await page.waitForFunction(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));   // 두 프레임 기다림(고정 ms 아님)
    const cur = await once();
    if (cur.inView && prev.inView && cur.p[0] === prev.p[0] && cur.p[1] === prev.p[1]) return cur;
    prev = cur;
  }
  return prev;
}
const sel = (page) => page.evaluate(() => [...document.querySelectorAll('#canvas .selected')].map(e => e.id || e.className.split(' ')[0]));
const waitSel = (page, fn, label) => page.waitForFunction(fn, null, { timeout: 3000 }).catch(async () => { throw new Error(`상태 기다림 시간초과 — ${label} · 지금 선택 ${JSON.stringify(await sel(page))}`); });
/** 한 번 누르기 — 전제(점이 글자 사각형 안) 단언 · clickAt(맞힌 요소) · 상태 대기 */
async function press(page, expectHit, waitFn, label, opts = {}) {
  const t = await textPoint(page);
  expect(t.p[0] >= t.r[0] && t.p[0] <= t.r[2] && t.p[1] >= t.r[1] && t.p[1] <= t.r[3], `전제 — 누를 점이 글자 사각형 안 ${JSON.stringify(t)}`).toBe(true);
  const h = await clickAt(page, t.p[0], t.p[1], expectHit, { label, ...opts });
  await waitSel(page, waitFn, label);
  return h;
}

for (const kind of ['flow', 'free']) {
  const name = kind === 'flow' ? 'flow 프레임' : 'freeLayout 프레임';
  test(`① ${name} — 선택 안 된 프레임 안 글자를 누르면 «맞힌 요소» = 프레임 자체 · 선택 = 프레임(글자 아님)`, async ({ page }) => {
    const errs = await scene(page, kind);
    expect(await page.evaluate(() => document.getElementById('F').classList.contains('selected')), '전제 — 누르기 전 프레임 안 골라짐').toBe(false);
    await press(page, { sel: '#F' }, () => document.getElementById('F').classList.contains('selected'), `${kind} 1회`);
    expect(await page.evaluate(() => document.getElementById('T').classList.contains('selected')), '글자는 안 골라짐').toBe(false);
    expect(errs).toEqual([]);
  });
  test(`② ${name} — 같은 자리를 한 번 더 누르면 선택 = 글자(프레임도 selected 로 남는다 · 잰 사실)`, async ({ page }) => {
    await scene(page, kind);
    await press(page, { sel: '#F' }, () => document.getElementById('F').classList.contains('selected'), `${kind} 1회`);
    await press(page, { sel: '[id="T"]' }, () => document.getElementById('T').classList.contains('selected'), `${kind} 2회`);
    const s = await sel(page);
    expect(s.includes('T') && s.includes('F'), `2회 뒤 선택 ${JSON.stringify(s)}`).toBe(true);
  });
}

test('④ 중첩 프레임(F > F2 > 글자) — 글자까지 «세 번»: 1회 = F · 2회 = F2(F 풀림) · 3회 = 글자', async ({ page }) => {
  await scene(page, 'nested');
  expect(await page.evaluate(() => !document.getElementById('F').classList.contains('selected') && !document.getElementById('F2').classList.contains('selected')), '전제 — 두 프레임 다 안 골라짐').toBe(true);
  await press(page, { sel: '#F' }, () => document.getElementById('F').classList.contains('selected'), '중첩 1회');
  expect(await page.evaluate(() => document.getElementById('T').classList.contains('selected')), '1회 뒤 글자 안 골라짐').toBe(false);
  await press(page, { sel: '#F2' }, () => document.getElementById('F2').classList.contains('selected'), '중첩 2회');
  expect(await page.evaluate(() => ({ F: document.getElementById('F').classList.contains('selected'), T: document.getElementById('T').classList.contains('selected') })), '2회 뒤 F 풀림 · 글자 아직').toEqual({ F: false, T: false });
  await press(page, { sel: '[id="T"]' }, () => document.getElementById('T').classList.contains('selected'), '중첩 3회');
});

/* ── U16① · U17② — 우클릭 메뉴 ── */
const menuState = (page) => page.evaluate(() => {
  const m = document.getElementById('block-context-menu'); const vis = (id) => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none'; };
  return { open: m.style.display === 'block', save: vis('bcm-save-template'), gap: vis('bcm-insert-gap'), gapText: document.getElementById('bcm-insert-gap')?.textContent.trim() };
});
const menuOpen = () => document.getElementById('block-context-menu').style.display === 'block';

for (const kind of ['flow', 'free']) {
  const name = kind === 'flow' ? 'flow 프레임' : 'freeLayout 프레임';
  test(`⑤ ${name} — 선택 안 된 프레임 안 글자 위 «우클릭» = 맞힌 요소 프레임 · 메뉴가 뜬다 · 대상 = 프레임(여백 넣기가 프레임 row 뒤에 선다 · 저장 항목 보임)`, async ({ page }) => {
    const errs = await scene(page, kind);
    expect(await menuState(page), '전제 — 메뉴 닫힘').toMatchObject({ open: false });
    expect(await page.evaluate(() => document.getElementById('F').classList.contains('selected')), '전제 — 프레임 안 골라짐').toBe(false);
    await press(page, { sel: '#F' }, menuOpen, `${kind} 우클릭`, { button: 'right' });
    /* 대상 판별(2026-10-06 바꿈 · lane-drag): 옛 판은 「블록 템플릿으로 저장」이 프레임에서만 숨는 것으로 갈랐다 — 이제 프레임도 보인다
       (insertTemplate block 갈래가 새 id + 묶기를 받아 U16① 숨김을 걷었다 · 3f832141). 그래서 «여백 넣기»를 «실제로» 눌러 가른다:
       대상이 프레임이면 갭이 프레임의 row(S1R) «바로 뒤»에 선다. 대상이 글자(T)였다면 flow 에선 프레임 «안»에 서고, free 에선 그 항목이 안 보였다. */
    expect(await menuState(page)).toEqual({ open: true, save: true, gap: true, gapText: '바로 아래에 여백 넣기 (G)' });
    const gapAt = await page.evaluate(() => {
      const before = new Set(document.querySelectorAll('.gap-block'));
      document.getElementById('bcm-insert-gap').click();
      const g = [...document.querySelectorAll('.gap-block')].find(x => !before.has(x));
      return g ? { prev: g.previousElementSibling?.id || null, inFrame: !!g.closest('#F') } : null;
    });
    expect(gapAt, `여백 자리=${JSON.stringify(gapAt)} — 대상이 프레임이면 S1R 바로 뒤 · 프레임 밖`).toEqual({ prev: 'S1R', inFrame: false });
    expect(await sel(page), '우클릭 = 클릭과 같은 «집기»: 프레임(과 섹션)만 골라짐 · 글자 아님').toEqual(['S1', 'F']);
    expect(errs).toEqual([]);
  });
}

test('⑥ 「바로 아래에 여백 넣기」 — 대상(프레임의 row) «바로 뒤»에 갭 하나 · ⌘Z 한 번 = 넣기 직전(앞 동작은 남는다) · ⌘⇧Z 로 다시', async ({ page }) => {
  const errs = await scene(page, 'flow');
  /* 이음매: push-before 동작 직후(꼭대기 ≠ 라이브)에서 재야 «⌘Z 한 번이 두 걸음»을 잡는다(DEF-01 의 ensure 가 못 메우는 꼴). */
  const before = await page.evaluate(() => {
    window.pushHistory?.('시험 앞 동작'); document.querySelector('#T [class^="tb-"]').textContent = '앞 동작 글';
    const R = document.getElementById('S1R'); return { next: R.nextElementSibling?.className, gaps: document.querySelectorAll('#S1I > .gap-block').length };
  });
  expect(before, '전제 — row 뒤는 원래 60px 갭 · 갭 둘').toEqual({ next: 'gap-block', gaps: 2 });
  await press(page, { sel: '#F' }, menuOpen, '우클릭', { button: 'right' });
  const ip = await page.evaluate(() => { const q = document.getElementById('bcm-insert-gap').getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; });
  await clickAt(page, ip[0], ip[1], { sel: '[id="bcm-insert-gap"]' }, { label: '여백 항목' });
  await page.waitForFunction(() => document.querySelectorAll('#S1I > .gap-block').length === 3, null, { timeout: 3000 });
  const after = await page.evaluate(() => {
    const R = document.getElementById('S1R'); const g = R.nextElementSibling;
    return { menu: document.getElementById('block-context-menu').style.display, nextIsNewGap: !!g && g.classList.contains('gap-block') && !g.style.height.startsWith('60'), newGapPrevIsRowOfF: g?.previousElementSibling === R && R.contains(document.getElementById('F')), thenOld: g?.nextElementSibling?.style.height, inFrame: !!document.getElementById('F').querySelector('.gap-block') };
  });
  expect(after, 'DOM 순서: [row(F)] → [새 갭] → [원래 60px 갭] · 프레임 «안»엔 안 들어감').toEqual({ menu: 'none', nextIsNewGap: true, newGapPrevIsRowOfF: true, thenOld: '60px', inFrame: false });
  await page.keyboard.press('Meta+z');
  await page.waitForFunction(() => document.querySelectorAll('#S1I > .gap-block').length === 2, null, { timeout: 3000 });
  expect(await page.evaluate(() => ({ text: document.querySelector('#T [class^="tb-"]')?.textContent, next: document.getElementById('S1R')?.nextElementSibling?.style.height })), '⌘Z 한 번 = 갭만 빠짐 · 앞 동작(글 바꿈)은 남음').toEqual({ text: '앞 동작 글', next: '60px' });
  await page.keyboard.press('Meta+Shift+z');
  await page.waitForFunction(() => document.querySelectorAll('#S1I > .gap-block').length === 3, null, { timeout: 3000 });
  expect(errs).toEqual([]);
});
