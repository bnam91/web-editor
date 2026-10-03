/* bt2-lines.dom.spec.js — BT2 버블·챗 «줄» 동작 (2026-10-04 태양 lane-bt2-lines)
 *   T2  줄을 더하면 보인다(+ 저장→불러오기 왕복)        · T3  버블과 챗이 «같은» 줄 기능(같은 종류·같은 손잡이·같은 결과)
 *   T4  조작마다 ⌘Z 한 걸음                           · T7  G19 — 그리드 «밑» 버블의 줄을 고쳐도 그리드 칸은 그대로
 *   T8  D4 — 줄이 있으면 MCP·AI 글자 쓰기는 거절        · T9  D10 — ⌫·T·Esc 가 «줄»에 먹는다
 * ★전제부터 단언한다(이름 붙인 조건이 섰는지 먼저 잰다).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/bt2-lines.dom.spec.js --workers=1 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const SEC = `<div class="section-block" data-section="1" id="sL"><div class="section-hitzone"></div>
  <div class="section-inner" style="padding-left: 60px; padding-right: 60px;" data-padding-x="60"></div></div>`;

async function fresh(page) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate((h) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', h); window.rebindAll?.();
    window.selectSection(document.getElementById('sL'));
  }, SEC);
  return errs;
}
async function addBubble(page, text = '안녕하세요') {
  await page.evaluate(() => window.addSpeechBubbleBlock('left'));
  const id = await page.evaluate(() => [...document.querySelectorAll('.speech-bubble-block')].pop().id);
  await page.evaluate(({ id, text }) => window.updateSpeechBubbleBlock(id, { text }), { id, text });
  return id;
}
async function addChat(page) {
  await page.evaluate(() => window.addChatBlock({ messages: [{ text: '첫 메시지', align: 'left' }, { text: '둘째', align: 'right' }] }));
  return page.evaluate(() => document.querySelector('.chat-block').id);
}
async function click(page, sel) { const r = await waitStableRect(page, sel); await page.mouse.click(r.cx, r.cy); await page.waitForTimeout(80); }
/** 블럭 하나만 고른다(첫 클릭) — 패널이 열렸는지까지 */
async function selectBlock(page, id, inner) { await page.evaluate(() => window.deselectAll?.()); await click(page, `#${id} ${inner}`); }
const linesOf = (page, id) => page.evaluate((id) => { const b = document.getElementById(id); return b.dataset.lines ? JSON.parse(b.dataset.lines) : null; }, id);
const msgOf = (page, id, m) => page.evaluate(({ id, m }) => JSON.parse(document.getElementById(id).dataset.messages)[m], { id, m });
/** 「줄 꾸미기」 절은 글자 줄이면 접혀 있다 — 열고 쓴다(접힘 기억은 블럭·종류별이라 한 번 열면 남는다). */
async function openLineSec(page) {
  if (!(await page.locator('#grd-line-body').isVisible())) { await page.locator('#grd-line-toggle').click(); await page.waitForTimeout(60); }
}
async function addKind(page, kind) {
  await expect(page.locator('#grd-line-add-kind'), '전제: 「+ 줄 추가」가 패널에 있다').toBeVisible();
  await page.locator('#grd-line-add-kind').selectOption(kind);
  await page.waitForTimeout(120);
}

// ─────────── T2 ───────────
test('T2-b 버블 — 「+ 줄 추가▾ 제목2」 하면 본문이 첫 줄로 구워지고(겉모습 유지) 둘째 줄이 제목2 크기로 보인다 · 왕복 뒤 그대로', async ({ page }) => {
  const errs = await fresh(page);
  const id = await addBubble(page);
  const before = await page.evaluate((id) => { const tb = document.querySelector(`#${id} .tb-bubble`); const r = tb.getBoundingClientRect(); return { fs: getComputedStyle(tb).fontSize, w: Math.round(r.width) }; }, id);
  await selectBlock(page, id, '.tb-bubble');
  await addKind(page, 'h2');
  const lines = await linesOf(page, id);
  expect(lines, '줄 2개').toHaveLength(2);
  expect(lines[0], '첫 줄 = 지금 본문(굽기)').toMatchObject({ type: 'body', text: '안녕하세요', fontSize: 28 });
  expect(lines[1], '둘째 줄 = 제목2').toMatchObject({ type: 'h2', text: '' });
  const dom = await page.evaluate((id) => {
    const rows = [...document.querySelectorAll(`#${id} .tb-bubble > .ln-row`)];
    return { n: rows.length, fs: rows.map(r => getComputedStyle(r.firstElementChild).fontSize), t0: rows[0]?.innerText, ce: document.querySelector(`#${id} .tb-bubble`).getAttribute('contenteditable') };
  }, id);
  expect(dom.n, '캔버스에 줄 2개').toBe(2);
  expect(dom.fs, '첫 줄은 옛 본문 크기 · 둘째는 제목2 역할 크기').toEqual([before.fs, '40px']);
  expect(dom.t0).toBe('안녕하세요');
  expect(dom.ce, '본체는 contenteditable 속성을 그대로 갖는다(12곳의 [contenteditable] 가 본체를 집는다)').toBe('false');
  // 저장 → 불러오기
  const after = await page.evaluate((id) => {
    const html = window.getSerializedCanvas();
    const c = document.getElementById('canvas'); c.innerHTML = window.sanitizeCanvasHtml(html); window.rebindAll();
    const b = document.getElementById(id);
    return { lines: JSON.parse(b.dataset.lines), n: b.querySelectorAll('.tb-bubble > .ln-row').length, mark: b.querySelectorAll('.ln-line-selected').length, html };
  }, id);
  expect(after.lines).toEqual(lines);
  expect(after.n).toBe(2);
  expect(after.html.includes('ln-line-selected'), '줄 선택 표시는 저장본에 안 실린다').toBe(false);
  expect(errs, 'pageerror 0').toEqual([]);
});

test('T2-c 챗 — 메시지를 한 번 더 누르고 「+ 줄 추가▾ 제목2」 하면 그 메시지만 줄 모드(본문=첫 줄) · text 는 줄 글자 거울 · 왕복', async ({ page }) => {
  const errs = await fresh(page);
  const id = await addChat(page);
  await selectBlock(page, id, '.chb-btext[data-msg-idx="0"]');
  await click(page, `#${id} .chb-btext[data-msg-idx="0"]`);         // 두 번째 클릭 = 메시지 고르기
  await addKind(page, 'h2');
  const m0 = await msgOf(page, id, 0), m1 = await msgOf(page, id, 1);
  expect(m0.lines, '메시지 0 은 줄 2개').toHaveLength(2);
  expect(m0.lines[0]).toMatchObject({ type: 'body', text: '첫 메시지', fontSize: 32 });
  expect(m0.text, 'D3 — text 는 줄 글자 거울').toBe('첫 메시지\n');
  expect(m1.lines, '메시지 1 은 그대로(줄 없음)').toBeUndefined();
  const dom = await page.evaluate((id) => ({ rows: document.querySelectorAll(`#${id} .ln-row[data-ln-m="0"]`).length, bt1: !!document.querySelector(`#${id} .chb-btext[data-msg-idx="1"]`), bt0: !!document.querySelector(`#${id} .chb-btext[data-msg-idx="0"]`) }), id);
  expect(dom).toEqual({ rows: 2, bt1: true, bt0: false });
  const after = await page.evaluate((id) => { const html = window.getSerializedCanvas(); const c = document.getElementById('canvas'); c.innerHTML = window.sanitizeCanvasHtml(html); window.rebindAll();
    const b = document.getElementById(id); return { m0: JSON.parse(b.dataset.messages)[0], rows: b.querySelectorAll('.ln-row[data-ln-m="0"]').length }; }, id);
  expect(after.m0.lines).toEqual(m0.lines);
  expect(after.rows).toBe(2);
  expect(errs).toEqual([]);
});

// ─────────── T3 ───────────
test('T3 버블과 챗이 «같은» 줄 기능 — 종류 목록·줄 손잡이 id·같은 조작의 결과(첫 줄 굽기 제외)가 같다', async ({ page }) => {
  await fresh(page);
  const sb = await addBubble(page);
  const ch = await addChat(page);
  // 버블: 줄 모드로 → 둘째 줄 고르기
  await selectBlock(page, sb, '.tb-bubble');
  const kindsB = await page.locator('#grd-line-add-kind option').evaluateAll(os => os.map(o => o.value));
  await addKind(page, 'h2');
  const idsB = await page.evaluate(() => [...document.querySelectorAll('#ln-line-panel [id]')].map(e => e.id).sort());
  // 챗
  await selectBlock(page, ch, '.chb-btext[data-msg-idx="0"]');
  await click(page, `#${ch} .chb-btext[data-msg-idx="0"]`);
  const kindsC = await page.locator('#grd-line-add-kind option').evaluateAll(os => os.map(o => o.value));
  await addKind(page, 'h2');
  const idsC = await page.evaluate(() => [...document.querySelectorAll('#ln-line-panel [id]')].map(e => e.id).sort());
  expect(kindsB, '「+ 줄 추가」 종류가 같다').toEqual(kindsC);
  expect(kindsB.filter(Boolean), 'D5 — 글자 역할 + 여백만(그림·구분선 없음)').toEqual(['label', 'h1', 'h2', 'h3', 'body', 'caption', 'gap']);
  expect(idsB, '같은 줄(제목2)을 골랐을 때 패널 손잡이 id 가 같다').toEqual(idsC);
  expect(idsB).toEqual(expect.arrayContaining(['grd-line-summary', 'grd-line-dup-btn', 'grd-line-del-btn', 'grd-line-kind', 'grd-line-align', 'grd-line-reset']));
  // 같은 조작열 — 둘째 줄(제목2)에: 정렬 가운데 → 종류 본문 → 복사 → 둘째 줄 지우기
  const seq = async (id, rowSel) => {
    await openLineSec(page);
    await page.locator('#grd-line-align').selectOption('center'); await page.waitForTimeout(80);
    await openLineSec(page);
    await page.locator('#grd-line-kind').selectOption('caption'); await page.waitForTimeout(120);
    await page.locator('#grd-line-dup-btn').click(); await page.waitForTimeout(120);
  };
  await selectBlock(page, sb, '.tb-bubble'); await click(page, `#${sb} .ln-row[data-ln="1"]`); await seq(sb);
  await selectBlock(page, ch, '.ln-row[data-ln-m="0"][data-ln="0"]'); await click(page, `#${ch} .ln-row[data-ln-m="0"][data-ln="1"]`); await seq(ch);
  const lb = (await linesOf(page, sb)).slice(1), lc = (await msgOf(page, ch, 0)).lines.slice(1);
  expect(lb, '조작 결과(굽힌 첫 줄 뺀 나머지)가 같다').toEqual(lc);
  expect(lb).toEqual([{ type: 'caption', text: '', align: 'center' }, { type: 'caption', text: '', align: 'center' }]);
});

// ─────────── T4 ───────────
const snapB = (page, id) => page.evaluate((id) => { const b = document.getElementById(id); return { l: b.dataset.lines ?? null, h: b.querySelector('.tb-bubble').innerHTML }; }, id);
const snapC = (page, id) => page.evaluate((id) => document.getElementById(id).dataset.messages, id);
async function undoOnce(page) { await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z'); await page.waitForTimeout(250); }

test('T4-b 버블 — 첫 전환·복사·종류·정렬·글자 크기·↺기본·삭제·글자 편집이 각각 ⌘Z 한 번에 한 걸음', async ({ page }) => {
  await fresh(page);
  const id = await addBubble(page);
  await selectBlock(page, id, '.tb-bubble');
  const steps = [
    ['첫 전환(+ 제목2)', async () => addKind(page, 'h2')],
    ['줄 복사', async () => { await click(page, `#${id} .ln-row[data-ln="1"]`); await page.locator('#grd-line-dup-btn').click(); }],
    ['종류 바꾸기', async () => { await click(page, `#${id} .ln-row[data-ln="1"]`); await openLineSec(page); await page.locator('#grd-line-kind').selectOption('label'); }],
    ['줄 정렬', async () => { await click(page, `#${id} .ln-row[data-ln="2"]`); await openLineSec(page); await page.locator('#grd-line-align').selectOption('right'); }],
    ['줄 글자 크기(Typography)', async () => { await click(page, `#${id} .ln-row[data-ln="2"]`); const f = page.locator('#grd-typo-size-number'); await f.fill('50'); await f.press('Enter'); }],
    ['↺ 기본', async () => { await click(page, `#${id} .ln-row[data-ln="2"]`); await openLineSec(page); await page.locator('#grd-line-reset').click(); }],
    ['줄 삭제', async () => { await click(page, `#${id} .ln-row[data-ln="1"]`); await page.locator('#grd-line-del-btn').click(); }],
    ['글자 편집', async () => { const r = await waitStableRect(page, `#${id} .ln-row[data-ln="0"]`); await page.mouse.dblclick(r.cx, r.cy); await page.keyboard.type('!'); await page.evaluate(() => document.activeElement?.blur?.()); }],
  ];
  for (const [name, act] of steps) {
    const s0 = await snapB(page, id);
    await act(); await page.waitForTimeout(200);
    const s1 = await snapB(page, id);
    expect(s1.l, `전제: «${name}» 가 데이터를 바꿨다`).not.toEqual(s0.l);
    await undoOnce(page);
    expect((await snapB(page, id)).l, `«${name}» ⌘Z 한 번 = 바로 앞`).toEqual(s0.l);
    await page.keyboard.press('Meta+Shift+z'); await page.waitForTimeout(250);
    expect((await snapB(page, id)).l, `«${name}» ⌘⇧Z = 다시 뒤`).toEqual(s1.l);
    await selectBlock(page, id, '.tb-bubble');
  }
});

test('T4-c 챗 — 첫 전환·복사·삭제·글자 편집이 각각 ⌘Z 한 걸음', async ({ page }) => {
  await fresh(page);
  const id = await addChat(page);
  const pick = async (sel) => { await selectBlock(page, id, sel); await click(page, `#${id} ${sel}`); };
  const steps = [
    ['첫 전환(+ 제목2)', async () => { await pick('.chb-btext[data-msg-idx="0"]'); await addKind(page, 'h2'); }],
    ['줄 복사', async () => { await pick('.ln-row[data-ln-m="0"][data-ln="1"]'); await page.locator('#grd-line-dup-btn').click(); }],
    ['줄 삭제', async () => { await pick('.ln-row[data-ln-m="0"][data-ln="2"]'); await page.locator('#grd-line-del-btn').click(); }],
    ['글자 편집', async () => { const r = await waitStableRect(page, `#${id} .ln-row[data-ln-m="0"][data-ln="0"]`); await page.mouse.dblclick(r.cx, r.cy); await page.keyboard.type('!'); await page.evaluate(() => document.activeElement?.blur?.()); }],
  ];
  for (const [name, act] of steps) {
    const s0 = await snapC(page, id);
    await act(); await page.waitForTimeout(200);
    const s1 = await snapC(page, id);
    expect(s1, `전제: «${name}» 가 데이터를 바꿨다`).not.toEqual(s0);
    await undoOnce(page);
    expect(await snapC(page, id), `«${name}» ⌘Z 한 번 = 바로 앞`).toEqual(s0);
    await page.keyboard.press('Meta+Shift+z'); await page.waitForTimeout(250);
    expect(await snapC(page, id), `«${name}» ⌘⇧Z = 다시 뒤`).toEqual(s1);
  }
});

// ─────────── T7 ───────────
test('T7 G19 — 그리드 «밑» 자식 버블의 줄을 더블클릭해 고쳐도 그리드 칸 줄은 그대로', async ({ page }) => {
  await fresh(page);
  const r = await page.evaluate(() => {
    window.addGridBlock({ cols: [{ lines: [{ type: 'body', text: '그리드 칸' }] }] });
    const g = document.querySelector('.grid-block');
    window.addSpeechBubbleBlock('left');
    const sb = [...document.querySelectorAll('.speech-bubble-block')].pop();
    window.updateSpeechBubbleBlock(sb.id, { lines: [{ type: 'body', text: '버블 줄' }] });
    let kids = g.querySelector(':scope > .grd-children');
    if (!kids) { kids = document.createElement('div'); kids.className = 'grd-children'; g.appendChild(kids); }
    kids.appendChild(sb.closest('.row') || sb.closest('.frame-block') || sb);
    return { g: g.id, sb: sb.id, gl: g.dataset.cols, inside: g.contains(sb) };
  });
  expect(r.inside, '전제: 버블이 그리드 «안»(.grd-children)에 있다').toBe(true);
  await page.evaluate(() => window.deselectAll?.());
  const rr = await waitStableRect(page, `#${r.sb} .ln-row[data-ln="0"]`);
  await page.mouse.dblclick(rr.cx, rr.cy); await page.keyboard.type('X'); await page.evaluate(() => document.activeElement?.blur?.()); await page.waitForTimeout(150);
  const after = await page.evaluate(({ g, sb }) => ({ gl: document.getElementById(g).dataset.cols, bl: JSON.parse(document.getElementById(sb).dataset.lines) }), r);
  expect(after.gl, '그리드 칸 데이터 무변').toBe(r.gl);
  expect(after.bl[0].text, '버블 줄이 고쳐졌다').toContain('X');
});

// ─────────── T8 ───────────
test('T8 D4 — 줄이 있으면 MCP 글자 쓰기(버블 text · 챗 editMessage.text)·AI 슬롯은 «분명한 오류로» 거절, 줄을 끄면 다시 된다', async ({ page }) => {
  await fresh(page);
  const sb = await addBubble(page);
  const ch = await addChat(page);
  const r = await page.evaluate(({ sb, ch }) => {
    const L = [{ type: 'h2', text: '제목' }, { type: 'body', text: '본문 <b>' }];
    const out = {};
    out.setB = window.updateSpeechBubbleBlock(sb, { lines: L });
    out.textB = window.updateSpeechBubbleBlock(sb, { text: 'x' });
    out.setC = window.updateChatBlock(ch, { editMessage: { index: 0, lines: L } });
    out.mirror = JSON.parse(document.getElementById(ch).dataset.messages)[0].text;
    out.textC = window.updateChatBlock(ch, { editMessage: { index: 0, text: 'x' } });
    out.badKind = window.updateSpeechBubbleBlock(sb, { lines: [{ type: 'image', imgSrc: 'data:,' }] });
    out.badField = window.updateChatBlock(ch, { editMessage: { index: 0, lines: [{ type: 'body', txt: 'oops' }] } });
    out.offB = window.updateSpeechBubbleBlock(sb, { lines: null });
    out.afterOffB = document.querySelector(`#${sb} .tb-bubble`).innerText;
    out.textB2 = window.updateSpeechBubbleBlock(sb, { text: 'y' });
    out.offC = window.updateChatBlock(ch, { editMessage: { index: 0, lines: null } });
    out.textC2 = window.updateChatBlock(ch, { editMessage: { index: 0, text: 'z' } });
    out.m0 = JSON.parse(document.getElementById(ch).dataset.messages)[0];
    return out;
  }, { sb, ch });
  expect(r.setB.ok && r.setC.ok, '전제: 줄을 얹었다').toBe(true);
  expect(r.mirror, 'D3 거울(이스케이프 평문)').toBe('제목\n본문 &lt;b&gt;');
  expect(r.textB).toMatchObject({ ok: false, code: 'INVALID' });
  expect(r.textB.message).toContain('has lines');
  expect(r.textC).toMatchObject({ ok: false, code: 'INVALID' });
  expect(r.textC.message).toContain('has lines');
  expect(r.badKind, 'D5 — 그림 줄 거절').toMatchObject({ ok: false });
  expect(r.badField, '모르는 줄 필드 거절(그리드 명부)').toMatchObject({ ok: false });
  expect(r.offB.ok).toBe(true);
  expect(r.afterOffB, '줄을 끄면 본문 = 줄 글자 평문').toBe('제목\n본문 <b>');
  expect(r.textB2.ok, '줄을 끈 뒤엔 text 가 된다').toBe(true);
  expect(r.offC.ok && r.textC2.ok).toBe(true);
  expect(r.m0.lines, '챗도 줄이 꺼졌다').toBeUndefined();
  expect(r.m0.text).toBe('z');
  // AI 슬롯 — 줄 모드 버블은 쓸 자리가 아니다
  await page.evaluate((sb) => window.updateSpeechBubbleBlock(sb, { lines: [{ type: 'body', text: 'L' }] }), sb);
  const slot = await page.evaluate(async (sb) => { const m = await import('/js/ai-text-slots.js'); return m.findTextSlot(document.getElementById(sb)); }, sb);
  expect(slot, 'AI 슬롯 없음(건너뜀)').toBeNull();
});

// ─────────── T9 D10 ───────────
test('T9 D10 — 버블 줄을 고른 채 T 는 줄 추가 · ⌫ 는 그 줄만 지움 · Esc 는 줄 선택만 풀고 블럭은 남김', async ({ page }) => {
  await fresh(page);
  const id = await addBubble(page);
  await page.evaluate((id) => window.updateSpeechBubbleBlock(id, { lines: [{ type: 'h2', text: 'A' }, { type: 'body', text: 'B' }] }), id);
  await selectBlock(page, id, '.ln-row[data-ln="0"]');
  await click(page, `#${id} .ln-row[data-ln="0"]`);
  await page.keyboard.press('t'); await page.waitForTimeout(150);
  expect((await linesOf(page, id)).map(l => l.type), 'T = 고른 줄 다음에 본문 줄').toEqual(['h2', 'body', 'body']);
  await page.keyboard.press('Backspace'); await page.waitForTimeout(150);
  expect((await linesOf(page, id)).map(l => l.text), '⌫ = 그 줄만').toEqual(['A', 'B']);
  expect(await page.evaluate((id) => !!document.getElementById(id), id), '블럭은 남았다').toBe(true);
  await page.keyboard.press('Escape'); await page.waitForTimeout(100);
  const s = await page.evaluate((id) => ({ sel: document.getElementById(id).classList.contains('selected'), act: window.grdGetActiveLine(document.getElementById(id)) }), id);
  expect(s, 'Esc = 줄 선택만 풀림').toEqual({ sel: true, act: null });
});

// ─────────── T10 지우기 경우의 수 (지디 E55 교훈 — G19 「자식 고르고 Delete = 그리드 통째」) ───────────
/* ⒜ 줄 고름 → ⌫/Delete = 그 줄만(블럭·다른 줄 남음) ⒝ 블럭 고름 → Delete = 블럭(+줄) 통째 ⒞ 줄 글자 편집 중 ⌫ = 글자만
   ⒟ 각각 ⌘Z 한 걸음 ⒠ 누르기 «직전» 선택 목록을 남긴다(annotation) — 무엇을 고른 상태였는지가 판정의 절반이다.
   양성대조: lnDeleteActiveLine 을 «안 먹게»(false) 한 변이에서 ⒜ 가 빨강(블럭 통째 삭제)이어야 한다 — BT2_DEL_MUT=1. */
async function selList(page) {
  return page.evaluate(() => {
    const sel = [...document.querySelectorAll('#canvas .selected')].map(e => e.id || e.className.split(' ')[0]);
    const b = document.querySelector('.speech-bubble-block.selected, .chat-block.selected');
    return { selected: sel, activeLine: b ? window.grdGetActiveLine?.(b) : null, editing: !!document.querySelector('#canvas [contenteditable="true"]') };
  });
}
async function note(page, label) { const s = await selList(page); test.info().annotations.push({ type: 'selection', description: `${label}: ${JSON.stringify(s)}` }); return s; }
/** 줄 경로 뒤에도 블럭을 «고르고 조작»할 수 있다 — 선택+패널 · 레이어 선택 · ⌘C/⌘V · ⌘↓(드래그 = 손짓 미확정 — 미측정: 핀도 같은 손짓에 0→0). */
async function operable(page, id, sel, panelSel) {
  await page.evaluate(() => window.deselectAll()); await click(page, `#${id} ${sel}`);
  const a = await page.evaluate(({ id, panelSel }) => ({ sel: document.getElementById(id).classList.contains('selected'), panel: !!document.querySelector(panelSel) }), { id, panelSel });
  expect(a, '줄 경로 뒤 클릭 = 선택 + 우측 패널').toEqual({ sel: true, panel: true });
  const d = await page.evaluate(({ id, panelSel }) => { window.deselectAll(); window.buildLayerPanel?.(); const b = document.getElementById(id); b._layerItem?.click(); return { sel: b.classList.contains('selected'), panel: !!document.querySelector(panelSel) }; }, { id, panelSel });
  expect(d, '레이어 패널로 선택 + 우측 패널').toEqual({ sel: true, panel: true });
  const n0 = await page.evaluate(() => document.querySelectorAll('.speech-bubble-block, .chat-block').length);
  await page.keyboard.press('Meta+c'); await page.keyboard.press('Meta+v'); await page.waitForTimeout(300);
  expect(await page.evaluate(() => document.querySelectorAll('.speech-bubble-block, .chat-block').length), '⌘C/⌘V = 하나 늘었다').toBe(n0 + 1);
  await undoOnce(page);
  // ⌘↓ — 아래에 블럭 하나를 두고(섹션 끝에 텍스트 블럭) 순서가 한 칸 내려가나
  await page.evaluate(() => { window.deselectAll(); window.selectSection(document.getElementById('sL')); window.addTextBlock('body'); });
  const idx = () => page.evaluate((id) => [...document.querySelectorAll('#sL .section-inner > *')].findIndex(k => k.contains(document.getElementById(id))), id);
  await page.evaluate(() => window.deselectAll()); await click(page, `#${id} ${sel}`);
  const i0 = await idx();
  await page.keyboard.press('Meta+ArrowDown'); await page.waitForTimeout(250);
  expect(await idx(), '⌘↓ = 한 칸 아래로').toBe(i0 + 1);
  await undoOnce(page); await undoOnce(page);
}
/** 캐럿을 편집 중인 요소의 «끝»으로 — ⛔End 키를 쓰지 않는다: 맥 End = scrollToEndOfDocument 라 캔버스가 튀고(E60),
 *  하네스(headless)에선 안 돌아온다. Selection API 로 끝에 접는다. */
async function caretEnd(page) {
  await page.evaluate(() => { const el = document.activeElement; const s = window.getSelection(); s.selectAllChildren(el); s.collapseToEnd(); });
}
async function mutate(page) { if (process.env.BT2_DEL_MUT === '1') { await page.evaluate(() => { window.lnDeleteActiveLine = () => false; }); console.log('[MUT] lnDeleteActiveLine 무효화 적용'); } }

for (const key of ['Backspace', 'Delete']) {
  test(`T10-b ${key} — 버블: ⒜ 줄 고름 = 그 줄만 ⒝ 블럭 고름 = 통째 ⒞ 편집 중 = 글자만 ⒟ ⌘Z 한 걸음`, async ({ page }) => {
    await fresh(page);
    const id = await addBubble(page);
    await page.evaluate((id) => window.updateSpeechBubbleBlock(id, { lines: [{ type: 'h2', text: 'AAA' }, { type: 'body', text: 'BBB' }] }), id);
    await mutate(page);
    // ⒜
    await selectBlock(page, id, '.ln-row[data-ln="1"]'); await click(page, `#${id} .ln-row[data-ln="1"]`);
    const sa = await note(page, '⒜ 전');
    expect(sa.activeLine, '전제: 줄 1 을 골랐다').toEqual({ r: 0, c: 0, li: 1 });
    const l0 = await linesOf(page, id);
    await page.keyboard.press(key); await page.waitForTimeout(200);
    expect(await page.evaluate((id) => !!document.getElementById(id), id), '⒜ 버블은 남는다').toBe(true);
    expect((await linesOf(page, id)).map(l => l.text), '⒜ 그 줄만 지워졌다').toEqual(['AAA']);
    await undoOnce(page);
    expect(await linesOf(page, id), '⒟ ⌘Z 한 걸음 = 두 줄').toEqual(l0);
    // ⒞
    const rr = await waitStableRect(page, `#${id} .ln-row[data-ln="0"]`);
    await page.mouse.dblclick(rr.cx, rr.cy); await page.waitForTimeout(100);
    const sc = await note(page, '⒞ 전');
    expect(sc.editing, '전제: 줄 글자 편집 중').toBe(true);
    await caretEnd(page); if (key === 'Delete') await page.keyboard.press('ArrowLeft'); await page.keyboard.press(key);
    await page.evaluate(() => document.activeElement?.blur?.()); await page.waitForTimeout(150);
    const lc = await linesOf(page, id);
    expect(lc.length, '⒞ 줄 수 그대로').toBe(2);
    expect(lc[0].text, '⒞ 글자 한 자만').toBe('AA');
    await undoOnce(page);
    expect((await linesOf(page, id))[0].text, '⒟ ⌘Z 한 걸음 = 글자 되돌림').toBe('AAA');
    await operable(page, id, '.tb-bubble', '#bubble-style-section');
    // ⒝
    await page.evaluate(() => window.deselectAll());
    await selectBlock(page, id, '.tb-bubble');
    const sb = await note(page, '⒝ 전');
    expect(sb.activeLine, '전제: 줄은 안 골랐다(블럭만)').toBeNull();
    await page.keyboard.press(key); await page.waitForTimeout(200);
    expect(await page.evaluate((id) => !!document.getElementById(id), id), '⒝ 블럭 통째 지워짐').toBe(false);
    expect(await page.evaluate(() => !!document.getElementById('sL')), '⒝ 섹션은 남는다(블럭만)').toBe(true);
    await undoOnce(page);
    expect(await linesOf(page, id), '⒟ ⌘Z 한 걸음 = 블럭+줄 복원').toEqual(l0);
  });

  test(`T10-c ${key} — 챗: ⒜ 줄 고름 = 그 메시지의 그 줄만 ⒝ 블럭 고름 = 통째 ⒞ 편집 중 = 글자만 ⒟ ⌘Z 한 걸음`, async ({ page }) => {
    await fresh(page);
    const id = await addChat(page);
    await page.evaluate((id) => window.updateChatBlock(id, { editMessage: { index: 0, lines: [{ type: 'h2', text: 'AAA' }, { type: 'body', text: 'BBB' }] } }), id);
    await mutate(page);
    const m0 = await snapC(page, id);
    await selectBlock(page, id, '.ln-row[data-ln-m="0"][data-ln="1"]'); await click(page, `#${id} .ln-row[data-ln-m="0"][data-ln="1"]`);
    const sa = await note(page, '⒜ 전');
    expect(sa.activeLine, '전제: 메시지0 줄1').toEqual({ r: 0, c: 0, li: 1 });
    await page.keyboard.press(key); await page.waitForTimeout(200);
    expect(await page.evaluate((id) => !!document.getElementById(id), id), '⒜ 챗은 남는다').toBe(true);
    const a = JSON.parse(await snapC(page, id));
    expect(a[0].lines.map(l => l.text), '⒜ 그 줄만').toEqual(['AAA']);
    expect(a[1].text, '⒜ 다른 메시지 그대로').toBe('둘째');
    await undoOnce(page);
    expect(await snapC(page, id), '⒟').toEqual(m0);
    const rr = await waitStableRect(page, `#${id} .ln-row[data-ln-m="0"][data-ln="0"]`);
    await page.mouse.dblclick(rr.cx, rr.cy); await page.waitForTimeout(100);
    expect((await note(page, '⒞ 전')).editing, '전제: 편집 중').toBe(true);
    await caretEnd(page); if (key === 'Delete') await page.keyboard.press('ArrowLeft'); await page.keyboard.press(key);
    await page.evaluate(() => document.activeElement?.blur?.()); await page.waitForTimeout(150);
    const c = JSON.parse(await snapC(page, id));
    expect(c[0].lines.map(l => l.text), '⒞ 글자만').toEqual(['AA', 'BBB']);
    await undoOnce(page);
    expect(await snapC(page, id), '⒟').toEqual(m0);
    await operable(page, id, '.chb-btext[data-msg-idx="1"]', '#chb-add-msg');
    await page.evaluate(() => window.deselectAll());
    await selectBlock(page, id, '.chb-btext[data-msg-idx="1"]');
    expect((await note(page, '⒝ 전')).activeLine, '전제: 블럭만').toBeNull();
    await page.keyboard.press(key); await page.waitForTimeout(200);
    expect(await page.evaluate((id) => !!document.getElementById(id), id), '⒝ 통째').toBe(false);
    expect(await page.evaluate(() => !!document.getElementById('sL')), '⒝ 섹션은 남는다(블럭만)').toBe(true);
    await undoOnce(page);
    expect(await snapC(page, id), '⒟').toEqual(m0);
  });
}
