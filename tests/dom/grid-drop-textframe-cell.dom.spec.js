/* grid-drop-textframe-cell.dom.spec.js — E126(G9 2차) «T▾ 로 만든 새 글자 블럭이 그리드 칸에 안 들어간다» 잠금 (태양 lane-g9-tframe 2026-10-05)
 * ★실측(실앱 a4aaf436, $S/reports/E126/README.md): T▾ Heading/Body/Caption/Bullet/Label → 칸 줄 수 1→1(3/3 · 다섯 종 모두).
 *   까닭: T▾ 블럭의 꼴은 `section-inner > frame-block[data-text-frame] > text-block` 이고 끌기 단위는 «글자 프레임»이다
 *   (block-drag.js 끌기 단위). 받는 판정 prop-grid.js grdTextDropSource 는 «맨 글자 블럭 / 글자 블럭 하나뿐인 .row» 만 받았다.
 * ★이 시험은 «앱이 지금 짓는 꼴»로 잰다 — 글자 블럭은 전부 window.addTextBlock(T▾ 메뉴 단추가 부르는 바로 그 함수)로 만든다.
 *   ⛔옛 꼴(.row > .text-block)을 손으로 짓지 마라 — 그 꼴은 grid-drop-textblock-cell(G9 1차)이 지킨다(G1·G2 는 여기서도 «같이 받는다»만 본다).
 * 고침: grdTextDropSource 가 «글자 블럭 하나뿐인 글자 프레임»도 받는다(허용 종류 목록은 그대로) · grdDropTextBlockOnCell 이 «프레임째» 뗀다(빈 프레임 금지).
 * ⛔E128(copySelected 가 프레임을 벗기는 것)은 여기서 안 다룬다 — 순서: E126 먼저 → E128 나중(지디).
 * 끌기: 진짜 마우스(page.mouse — Playwright 가 Chromium 에서 Input.setInterceptDrags/dispatchDragEvent 로 HTML5 끌기를 낸다, E126 측정과 같은 기제).
 *   누르기 전 «시작 점 맨 위 요소 ∈ 그 글자 프레임» · «놓는 점 맨 위 요소 ∈ 그 칸» 단언(_click-at 규율) · 좌표는 «두 번 연속 같음» · 고정 대기 0(drop 관측 + 두 프레임).
 * 양성대조: dev a4aaf436(고치기 전) 나무 안에서 → A1 A2 A3 G3 빨강 · N1 N2 G1 G2 초록 (predict: $S/g9/predict.md).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/grid-drop-textframe-cell.dom.spec.js */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const COLS = '[{&quot;width&quot;:1,&quot;lines&quot;:[{&quot;type&quot;:&quot;body&quot;,&quot;text&quot;:&quot;가&quot;}]},{&quot;width&quot;:1,&quot;lines&quot;:[{&quot;type&quot;:&quot;body&quot;,&quot;text&quot;:&quot;다&quot;},{&quot;type&quot;:&quot;body&quot;,&quot;text&quot;:&quot;라&quot;}]}]';
const SEC = `<div class="section-block" id="sG" data-section="1" data-name="G"><div class="section-hitzone"></div><div class="section-inner" id="sGI">
<div class="gap-block" data-type="gap" style="height:60px"></div>
<div class="row" id="rG"><div class="grid-block" id="gG" data-type="grid" data-gap="24" data-valign="top" data-cols="${COLS}"></div></div>
<div class="gap-block" id="gEnd" data-type="gap" style="height:300px"></div></div></div>`;

const raf2 = (page) => page.waitForFunction(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));

/** 앱 + 섹션(그리드) · kind 에 따라 글자 블럭을 «앱 함수로» 만든다. 돌려줌 = 끌 단위의 id. */
async function setup(page, kind) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  const id = await page.evaluate(([SEC, kind]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', SEC);
    window.rebindAll?.(); window.deselectAll?.(); window.renderGridBlock?.(document.getElementById('gG'));
    const S = document.getElementById('sG');
    const mk = (type, content) => { window.selectSection(S); window.addTextBlock(type, { content }); return [...S.querySelectorAll('.text-block')].pop(); };
    let unit;
    if (kind === 'h2' || kind === 'body') { unit = mk(kind, kind === 'h2' ? '끌 제목' : '끌 본문').parentElement; }
    else if (kind === 'bubble') {          // N1 — 글자 프레임 «안» 말풍선(허용 목록 밖 종류)
      unit = mk('h2', 'x').parentElement;
      unit.innerHTML = '<div class="text-block speech-bubble-block" id="tB"><div class="tb-sender-name" style="display:none">Your name</div><div class="tb-bubble">말풍선 본문</div></div>';
    } else if (kind === 'two') {           // N2 — 글자 프레임 안 글자 블럭 «둘»
      unit = mk('h2', '첫 글').parentElement;
      const tb2 = mk('body', '둘째 글'); const tf2 = tb2.parentElement; unit.appendChild(tb2); tf2.remove();
    } else if (kind === 'bare') {          // G1 — 맨 글자 블럭(⌘D·⌘V 사본의 꼴, E126 ⓑ) = 프레임에서 꺼낸 같은 블럭
      const tb = mk('h2', '맨 글'); const tf = tb.parentElement; const html = tb.outerHTML; tf.insertAdjacentHTML('afterend', html); unit = tf.nextElementSibling; tf.remove();   // 새 요소로(묶음은 rebindAll 이 새로 건다 — 사본과 같은 처지)
    } else if (kind === 'rowtf') {        // G3 가드 — .row > 글자 프레임(혼자) > 글자 블럭. 지금 앱이 짓는 자리는 못 찾았다(코드독해) — 그래도 빈 행이 남으면 안 된다
      const tf = mk('h2', '행 속 프레임 글').parentElement; tf.insertAdjacentHTML('afterend', `<div class="row" id="rowTF" data-layout="stack">${tf.outerHTML}</div>`); unit = tf.nextElementSibling; tf.remove();
    } else if (kind === 'row') {           // G2 — 옛 문서 꼴 .row(layout 없음) > text-block (E126 ⓒ)
      const tb = mk('h2', '행 글'); const tf = tb.parentElement; tf.insertAdjacentHTML('afterend', `<div class="row" id="rowT">${tb.outerHTML}</div>`); unit = tf.nextElementSibling; tf.remove();
    }
    if (!unit.id) unit.id = 'u_' + kind;
    window.rebindAll?.(); window.deselectAll?.(); window.clearHistory?.();
    window.__drops = 0; document.addEventListener('drop', () => { window.__drops++; }, true);   // dragend 는 못 쓴다 — 받힌 끌 단위는 떼어져 그 이벤트가 문서까지 안 온다
    return unit.id;
  }, [SEC, kind]);
  await raf2(page);
  return { id, errs };
}
/** 화면 안 + 두 번 연속 같은 점 */
async function stablePoint(page, fn, arg) {
  let prev = await page.evaluate(fn, arg);
  for (let i = 0; i < 30; i++) { await raf2(page); const cur = await page.evaluate(fn, arg); if (cur && prev && cur.x === prev.x && cur.y === prev.y) return cur; prev = cur; }
  return prev;
}
const cellTexts = (page) => page.evaluate(() => [...document.querySelectorAll('#gG [data-r="0"][data-c="1"][data-line]')].map(e => e.textContent.trim()));
const facts = (page, id) => page.evaluate((id) => ({
  unit: !!document.getElementById(id),
  emptyRows: [...document.querySelectorAll('#canvas .row')].filter(r => ![...r.children].some(k => !k.classList.contains('drop-indicator'))).length,
  emptyTextFrames: [...document.querySelectorAll('#canvas .frame-block[data-text-frame]')].filter(f => !f.querySelector('.text-block')).length,
  textBlocks: document.querySelectorAll('#canvas .text-block').length,
}), id);

/** 진짜 끌기 — 시작·놓기 점 맨 위 요소 단언 → press → 걸음 이동 → release → drop 관측 + 두 프레임 */
async function dragToCellBottom(page, id) {
  const s = await stablePoint(page, (id) => { const u = document.getElementById(id); const t = [...u.querySelectorAll('[class^="tb-"]')].find(e => e.getBoundingClientRect().height > 0) || u; t.scrollIntoView({ block: 'nearest' }); const q = t.getBoundingClientRect(); return { x: Math.round(q.left + Math.min(30, q.width / 2)), y: Math.round(q.top + q.height / 2) }; }, id);
  const d = await stablePoint(page, () => { const l = document.querySelector('#gG [data-r="0"][data-c="1"][data-line="1"]'); const q = l.getBoundingClientRect(); return { x: Math.round(q.left + q.width / 2), y: Math.round(q.bottom - 2) }; });
  const hits = await page.evaluate(([s, d, id]) => {
    const a = document.elementFromPoint(s.x, s.y), b = document.elementFromPoint(d.x, d.y);
    return { start: !!a && !!a.closest(`[id="${id}"]`), startHit: a && (a.id || a.className), drop: !!b && !!b.closest('#gG .grd-cell[data-r="0"][data-c="1"]'), dropHit: b && (b.id || b.className) };
  }, [s, d, id]);
  expect(hits.start, `시작 점 맨 위 요소 «${hits.startHit}» 가 끌 단위 #${id} 안이 아니다`).toBe(true);
  expect(hits.drop, `놓는 점 맨 위 요소 «${hits.dropHit}» 가 칸(r0,c1) 안이 아니다`).toBe(true);
  const n0 = await page.evaluate(() => window.__drops);
  await page.mouse.move(s.x, s.y); await page.mouse.down();
  await page.mouse.move(s.x + 10, s.y + 10, { steps: 3 });
  await page.mouse.move(d.x, d.y, { steps: 12 });
  await page.mouse.up();
  await page.waitForFunction((n0) => window.__drops > n0, n0, { timeout: 3000 }).catch(() => { throw new Error('drop 이 안 왔다 — 끌기가 시작되지 않았다'); });
  await raf2(page);
}

for (const [kind, label, text] of [['h2', 'T▾ Heading', '끌 제목'], ['body', 'T▾ Body', '끌 본문']]) {
  test(`A${kind === 'h2' ? 1 : 2} ★${label} 로 만든 블럭(글자 프레임째)을 칸에 놓으면 줄 +1 · 블럭과 «그 프레임»이 사라진다(빈 프레임 0)`, async ({ page }) => {
    const { id, errs } = await setup(page, kind);
    const shape = await page.evaluate((id) => { const u = document.getElementById(id); return { tf: u.dataset.textFrame, parent: u.parentElement.id, kids: u.children.length, kid: u.children[0]?.className }; }, id);
    expect(shape, '전제 — 앱이 짓는 꼴 section-inner > frame-block[data-text-frame] > text-block 하나').toEqual({ tf: 'true', parent: 'sGI', kids: 1, kid: 'text-block' });
    expect(await cellTexts(page), '전제 — 칸 줄').toEqual(['다', '라']);
    const f0 = await facts(page, id);
    await dragToCellBottom(page, id);
    expect(await cellTexts(page)).toEqual(['다', '라', text]);
    expect(await facts(page, id), '프레임째 사라짐 · 빈 글자 프레임 0 · 빈 행 0 · 글자 블럭 하나 줄었다').toEqual({ unit: false, emptyRows: 0, emptyTextFrames: 0, textBlocks: f0.textBlocks - 1 });
    expect(errs).toEqual([]);
  });
}

test('A3 ★⌘Z 한 번 = 놓기 전으로 — 칸 줄 원래대로 · 글자 프레임(과 안의 블럭)이 제자리로', async ({ page }) => {
  const { id } = await setup(page, 'h2');
  const before = await page.evaluate((id) => { const u = document.getElementById(id); return { prev: u.previousElementSibling?.id, text: u.textContent.trim() }; }, id);
  await dragToCellBottom(page, id);
  expect(await cellTexts(page), '전제 — 들어갔다').toEqual(['다', '라', '끌 제목']);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await page.waitForFunction(() => document.querySelectorAll('#gG [data-r="0"][data-c="1"][data-line]').length === 2, null, { timeout: 3000 });
  expect(await cellTexts(page)).toEqual(['다', '라']);
  expect(await page.evaluate((id) => { const u = document.getElementById(id); return u && { tf: u.dataset.textFrame, prev: u.previousElementSibling?.id, text: u.textContent.trim(), kids: u.querySelectorAll(':scope > .text-block').length }; }, id))
    .toEqual({ tf: 'true', prev: before.prev, text: before.text, kids: 1 });
});

test('N1 거절 — 글자 프레임 «안» 말풍선은 칸이 안 받는다(허용 종류 목록 그대로) · 블럭 그대로', async ({ page }) => {
  const { id } = await setup(page, 'bubble');
  await dragToCellBottom(page, id);
  expect(await cellTexts(page)).toEqual(['다', '라']);
  expect(await page.evaluate((id) => !!document.getElementById(id)?.querySelector('#tB .tb-bubble') && document.getElementById('canvas').innerText.includes('말풍선 본문'), id)).toBe(true);
});

test('N2 거절 — 글자 블럭 «둘»을 품은 글자 프레임은 칸이 안 받는다 · 둘 다 그대로', async ({ page }) => {
  const { id } = await setup(page, 'two');
  expect(await page.evaluate((id) => document.getElementById(id).querySelectorAll(':scope > .text-block').length, id), '전제 — 자식 둘').toBe(2);
  await dragToCellBottom(page, id);
  expect(await cellTexts(page)).toEqual(['다', '라']);
  expect(await page.evaluate((id) => document.getElementById(id)?.querySelectorAll(':scope > .text-block').length, id)).toBe(2);
});

for (const [kind, name] of [['bare', 'G1 지킴 — 맨 글자 블럭(⌘D·⌘V 사본 꼴)'], ['row', 'G2 지킴 — .row > 글자 블럭(옛 문서 꼴)'], ['rowtf', 'G3 가드 — .row > 글자 프레임(혼자) > 글자 블럭 · 놓은 뒤 빈 행 0']]) {
  test(`${name} 은 종전대로 받는다 · 단위가 사라진다`, async ({ page }) => {
    const { id } = await setup(page, kind);
    await dragToCellBottom(page, id);
    expect((await cellTexts(page)).length).toBe(3);
    expect(await facts(page, id)).toMatchObject({ unit: false, emptyRows: 0, emptyTextFrames: 0 });
  });
}
