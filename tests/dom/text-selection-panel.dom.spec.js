/* text-selection-panel.dom.spec.js — TX1: 텍스트 «일부 선택» 뒤 우측 패널을 눌러도 선택이 남고, 연달아 두 번째도 같은 글자에 간다.
 *
 * 현빈 원문(2026-10-03): 「선택영역이 풀려도 편집이 되더라. 근데 폰트크기만 바꿨는데 맘에 안들어서 다시 폰트크기수정하려는데
 *   선택영역이 이 타이밍에도 풀려서 다시 가서 영역선택해야되고」 — 텍스트를 입력할 수 있는 «모든 곳»에서.
 * 측정(PLANNER-REPORT, 핀 37ab1c65): 크기·굵기·색 세 칸 모두 1회는 BBB 에만 먹고 2회는 BBB 밖(블럭 전체 등)으로 갔다.
 *   그리드 줄은 크기 칸 첫 클릭이 «먹혔다»(패널을 통째로 다시 그려 누른 칸이 떨어져 나감).
 *
 * ★진짜 입력만 잰다 — page.mouse(클릭·더블클릭)·page.keyboard(타이핑·Enter·⇧←). 측정 단계에 element.click()·.value 대입 없음.
 *   (예외 = 시험 «준비»: 블럭 넣기는 앱 입구 함수, 시험 S1 의 select 포커스는 locator.focus — 그 단계는 재는 대상이 아니다.)
 * ★각 시험은 «전제»부터 단언한다 — 선택이 서 있다(rangeCount 1 · 펼쳐짐 · 글자 "BBB" · 그 글자칸 안).
 * ★양성대조: GD1001_ROOT=<37ab1c65 체크아웃> 으로 돌리면 결함 시험이 빨강이어야 한다(명부는 커밋 메시지·보고).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js text-selection-panel
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/* 「바깥」 = 캔버스 빈 곳(패널은 x≥1360). 섹션 아래 회색 바탕. */
const OUTSIDE = { x: 800, y: 960 };
const SEC = '<div class="section-block" id="sA" data-section="1" data-name="sA"><div class="section-hitzone"></div><div class="section-inner" id="inA"></div></div>';

async function setup(page, { noHighlights = false } = {}) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  if (noHighlights) {
    // ★폴백 판: CSS Custom Highlight API 가 «없는» 브라우저 — 칠하기만 없고 동작은 같아야 한다
    await page.addInitScript(() => {
      try { Object.defineProperty(CSS, 'highlights', { get: () => undefined, configurable: true }); } catch (_) {}
    });
  }
  const errs = await bootApp(page);
  await page.evaluate((html) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', html); window.rebindAll?.(); window.deselectAll?.();
    window.applyZoom?.(100);
    document.getElementById('sA').classList.add('selected');
  }, SEC);
  await page.waitForTimeout(250);
  return errs;
}

/* 블럭 넣기(준비) — 앱 입구 함수. 돌려주는 것 = 새 블럭 id */
const insert = (page, kind) => page.evaluate((kind) => {
  const before = new Set([...document.querySelectorAll('#canvas [id]')].map(e => e.id));
  document.getElementById('sA').classList.add('selected');
  if (kind === 'text') window.addTextBlock('body', { content: 'AAA BBB CCC' });
  else if (kind === 'bubble') window.addSpeechBubbleBlock('left');
  else if (kind === 'grid') window.addGridBlock({});
  else if (kind === 'modal') window.addModalBlock({});
  else if (kind === 'table') window.addTableBlock({});
  const cls = { text: 'text-block', bubble: 'speech-bubble-block', grid: 'grid-block', modal: 'modal-block', table: 'table-block' }[kind];
  const fresh = [...document.querySelectorAll('#canvas .' + cls)].filter(e => !before.has(e.id));
  return fresh.length ? fresh[fresh.length - 1].id : null;
}, kind);

async function center(page, sel) {
  await page.locator(sel).first().scrollIntoViewIfNeeded();
  const b = await page.locator(sel).first().boundingBox();
  if (!b) throw new Error('no box: ' + sel);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, b };
}
/* 패널 칸을 «진짜 마우스»로 누른다(왼쪽 가까이 — 숫자칸 스피너를 피한다) */
async function clickField(page, sel) {
  const { b } = await center(page, sel);
  await page.mouse.click(b.x + Math.min(12, b.width / 3), b.y + b.height / 2);
  await page.waitForTimeout(120);
}
/* 글자칸에 들어가 «AAA BBB CCC» 를 만들고(필요하면 타이핑) BBB 를 ⇧← 로 고른다 */
async function editAndSelectBBB(page, hostSel, { type = false, preClick = false } = {}) {
  const { b } = await center(page, hostSel);
  if (preClick) { await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(250); }
  await page.mouse.dblclick(b.x + b.width - 4, b.y + b.height / 2);
  await page.waitForTimeout(300);
  if (type) {
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('AAA BBB CCC');
  }
  await page.keyboard.press('End');
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowLeft');
  for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowLeft');
  await page.waitForTimeout(150);
}
/* 전제 단언 — 선택 1개 · 펼쳐짐 · "BBB" · 그 글자칸 안 */
async function assertPremise(page, hostSel) {
  const p = await page.evaluate((hs) => {
    const s = getSelection(); const host = document.querySelector(hs);
    return { rc: s.rangeCount, col: s.isCollapsed, str: s.toString(), inHost: !!host && host.contains(s.anchorNode) && host.contains(s.focusNode),
             ce: host && host.getAttribute('contenteditable') };
  }, hostSel);
  expect(p, '전제: 글자칸 안에 BBB 가 선택돼 있어야 한다').toEqual({ rc: 1, col: false, str: 'BBB', inHost: true, ce: 'true' });
}
/* 전제 단언(글자 지정판) — 선택 1개 · 펼쳐짐 · 글자 = want · 그 글자칸 안 */
async function assertPremiseText(page, hostSel, want) {
  const p = await page.evaluate((hs) => {
    const s = getSelection(); const host = document.querySelector(hs);
    return { rc: s.rangeCount, col: s.isCollapsed, str: s.toString(), inHost: !!host && host.contains(s.anchorNode) && host.contains(s.focusNode) };
  }, hostSel);
  expect(p, `전제: 글자칸 안에 ${want} 가 선택돼 있어야 한다`).toEqual({ rc: 1, col: false, str: want, inHost: true });
}
/* 지금 DOM 선택의 글자칸 안 오프셋(전제용) */
const hlOrSel = (page) => page.evaluate(() => {
  const s = getSelection(); const r = s.getRangeAt(0);
  const e = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement;
  const host = e.closest('[contenteditable="true"]');
  const pre = document.createRange(); pre.selectNodeContents(host); pre.setEnd(r.startContainer, r.startOffset);
  return { start: pre.toString().length };
});
/* 글자별 계산 스타일 — [글자, 값] 의 줄 */
const perChar = (page, hostSel, prop) => page.evaluate(([hs, prop]) => {
  const host = document.querySelector(hs); const out = [];
  const w = document.createTreeWalker(host, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) { const v = getComputedStyle(n.parentElement)[prop]; for (const ch of n.nodeValue) out.push([ch, v]); }
  return out;
}, [hostSel, prop]);
/* BBB 의 값 · BBB 밖 글자들의 값 집합 */
async function split(page, hostSel, prop) {
  const pc = (await perChar(page, hostSel, prop)).filter(([ch]) => ch.trim());
  const text = pc.map(x => x[0]).join('');
  const i = text.indexOf('BBB');
  const inB = [...new Set(pc.slice(i, i + 3).map(x => x[1]))];
  const out = [...new Set([...pc.slice(0, i), ...pc.slice(i + 3)].map(x => x[1]))];
  return { text, inB, out };
}
const highlight = (page) => page.evaluate(() => {
  const h = (typeof CSS !== 'undefined' && CSS.highlights) ? CSS.highlights.get('goditor-text-sel') : null;
  return h ? [...h].map(r => r.toString()) : null;
});
const act = (page) => page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
async function typeEnter(page, v) { await page.keyboard.type(v); await page.keyboard.press('Enter'); await page.waitForTimeout(250); }

/* ══ 텍스트블럭 ════════════════════════════════════════════════════ */
test('T1 텍스트블럭 크기 두 번 연달아 — 둘 다 BBB 에만 · 두 번째 클릭은 값 전체 선택 · 선택이 보인다', async ({ page }) => {
  const errs = await setup(page);
  const id = await insert(page, 'text'); expect(id).toBeTruthy();
  const host = `#${id} [class^="tb-"]`;
  await editAndSelectBBB(page, host, { preClick: true });
  await assertPremise(page, host);
  const base = await split(page, host, 'fontSize');
  expect(base.inB).toEqual(base.out);                                   // 전제: 처음엔 BBB 와 나머지가 같은 크기

  await clickField(page, '#txt-size-number');
  expect(await act(page)).toBe('txt-size-number');                      // 칸이 포커스를 받았다(타이핑 가능)
  await typeEnter(page, '40');
  let r = await split(page, host, 'fontSize');
  expect(r.inB, '1회: BBB 가 40px').toEqual(['40px']);
  expect(r.out, '1회: BBB 밖은 그대로').toEqual(base.out);
  expect(await highlight(page), '1회 뒤: 패널에 포커스가 있어도 BBB 선택이 «보인다»').toEqual(['BBB']);
  expect(await act(page), '커밋 뒤 포커스는 칸에 남는다').toBe('txt-size-number');

  await clickField(page, '#txt-size-number');
  expect(await page.evaluate(() => getSelection().toString()), '2회째 칸 클릭 = 값 전체 선택(피그마)').toBe('40');
  await typeEnter(page, '52');
  r = await split(page, host, 'fontSize');
  expect(r.inB, '★2회: 같은 BBB 에 52px (옛 판 = 블럭 전체)').toEqual(['52px']);
  expect(r.out, '★2회: BBB 밖은 그대로').toEqual(base.out);
  expect(await page.evaluate((h) => document.querySelector(h).querySelectorAll('span').length, host), '겹 span 이 안 생긴다').toBe(1);
  expect(await highlight(page)).toEqual(['BBB']);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('T1-esc 크기 칸 Esc 는 여전히 되돌린다(적용 시점 불변) — 선택은 남는다', async ({ page }) => {
  const errs = await setup(page);
  const id = await insert(page, 'text');
  const host = `#${id} [class^="tb-"]`;
  await editAndSelectBBB(page, host, { preClick: true });
  await assertPremise(page, host);
  const base = await split(page, host, 'fontSize');
  await clickField(page, '#txt-size-number');
  await page.keyboard.type('77'); await page.waitForTimeout(150);
  expect((await split(page, host, 'fontSize')).inB, '타이핑 중엔 적용 안 됨(커밋 가드)').toEqual(base.inB);
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  expect((await split(page, host, 'fontSize')).inB, 'Esc = 적용 없음').toEqual(base.inB);
  expect(await highlight(page)).toEqual(['BBB']);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('T2 텍스트블럭 굵기(select) 두 번 연달아 — 진짜 마우스로 목록을 열고 글자키(type-ahead)로 고른다, 둘 다 BBB 에만', async ({ page }) => {
  const errs = await setup(page);
  const id = await insert(page, 'text');
  const host = `#${id} [class^="tb-"]`;
  await editAndSelectBBB(page, host, { preClick: true });
  await assertPremise(page, host);
  const base = await split(page, host, 'fontWeight');
  const pick = async (key) => {
    await clickField(page, '#txt-font-weight');                         // 진짜 클릭 — 예외 칸(select)이라 막지 않는다 → 목록이 열린다
    expect(await act(page), 'select 가 포커스를 받았다(목록이 열린다)').toBe('txt-font-weight');
    // ⚠️헤드리스 목록에선 화살표·Enter 가 안 먹는다(실측) — 글자키 type-ahead 는 먹는다(측정 스크립트와 같은 손).
    await page.keyboard.press(key); await page.waitForTimeout(1100);    // type-ahead 버퍼(≈1s)가 다음 글자와 붙지 않게
  };
  await pick('b');                                                       // Bold 700
  let r = await split(page, host, 'fontWeight');
  const w1 = r.inB;
  expect(w1, '1회: BBB 굵기가 바뀌었다').not.toEqual(base.inB);
  expect(r.out, '1회: BBB 밖 그대로').toEqual(base.out);
  await pick('t');                                                       // Thin 100
  r = await split(page, host, 'fontWeight');
  expect(r.inB, '★2회: 같은 BBB 굵기가 다시 바뀌었다').not.toEqual(w1);
  expect(r.out, '★2회: BBB 밖 그대로(옛 판 = BBB 밖에 먹음)').toEqual(base.out);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('T3 텍스트블럭 색 — 스펙트럼 두 번 연달아 + hex 칸 두 번, 넷 다 BBB 에만', async ({ page }) => {
  const errs = await setup(page);
  const id = await insert(page, 'text');
  const host = `#${id} [class^="tb-"]`;
  await editAndSelectBBB(page, host, { preClick: true });
  await assertPremise(page, host);
  const base = await split(page, host, 'color');
  // 스와치 → 스펙트럼(포커스를 안 뺏는 칸) 두 번 — 측정표의 «색 2회»와 같은 손
  await clickField(page, `#txt-color`);
  await page.waitForTimeout(300);
  const spAt = (fx, fy) => page.evaluate(([fx, fy]) => { const e = [...document.querySelectorAll('.goya-cp-spectrum')].find(x => x.getBoundingClientRect().width > 0);
    if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x + b.width * fx, y: b.y + b.height * fy }; }, [fx, fy]);
  let sp = await spAt(0.8, 0.2);
  expect(sp, '전제: 스펙트럼이 열렸다').not.toBeNull();
  await page.mouse.click(sp.x, sp.y); await page.waitForTimeout(250);
  let r = await split(page, host, 'color');
  expect(r.inB, '1회(스펙트럼): BBB 색이 바뀌었다').not.toEqual(base.inB);
  expect(r.out, '1회: BBB 밖 그대로').toEqual(base.out);
  const c1 = r.inB;
  sp = await spAt(0.3, 0.6);
  await page.mouse.click(sp.x, sp.y); await page.waitForTimeout(250);
  r = await split(page, host, 'color');
  expect(r.inB, '★2회(스펙트럼): 같은 BBB 색이 또 바뀌었다').not.toEqual(c1);
  expect(r.out, '★2회: BBB 밖 그대로(옛 판 = 블럭 전체)').toEqual(base.out);
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);   // 피커 닫기
  // hex 칸(포커스를 가져가는 예외 칸) 두 번
  for (const [hex, rgb] of [['CC2929', 'rgb(204, 41, 41)'], ['2929CC', 'rgb(41, 41, 204)']]) {
    await clickField(page, '#txt-color-hex');
    expect(await act(page)).toBe('txt-color-hex');
    await page.keyboard.press('ControlOrMeta+a'); await typeEnter(page, hex);
    r = await split(page, host, 'color');
    expect(r.inB, `hex ${hex}: BBB`).toEqual([rgb]);
    expect(r.out, `hex ${hex}: BBB 밖 그대로`).toEqual(base.out);
  }
  expect(await page.evaluate((h) => document.querySelector(h).querySelectorAll('span').length, host), '겹 span 이 안 생긴다').toBe(1);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('T4 말풍선 글자 크기 두 번 연달아 — 둘 다 BBB 에만', async ({ page }) => {
  const errs = await setup(page);
  const id = await insert(page, 'bubble'); expect(id).toBeTruthy();
  const host = `#${id} .tb-bubble`;
  await editAndSelectBBB(page, host, { type: true, preClick: true });
  await assertPremise(page, host);
  const base = await split(page, host, 'fontSize');
  await clickField(page, '#txt-size-number'); await typeEnter(page, '40');
  let r = await split(page, host, 'fontSize');
  expect(r.inB).toEqual(['40px']); expect(r.out).toEqual(base.out);
  await clickField(page, '#txt-size-number'); await typeEnter(page, '52');
  r = await split(page, host, 'fontSize');
  expect(r.inB, '★2회: 같은 BBB').toEqual(['52px']); expect(r.out, '★2회: BBB 밖 그대로').toEqual(base.out);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('T8 세워 둔 편집의 끝 — 패널 칸에서 바깥(캔버스 빈 곳)을 누르면 편집이 끝나고 선택도 끝난다 · Esc 는 그대로 편집을 끝낸다', async ({ page }) => {
  const errs = await setup(page);
  const id = await insert(page, 'text');
  const host = `#${id} [class^="tb-"]`;
  await editAndSelectBBB(page, host, { preClick: true });
  await assertPremise(page, host);
  await clickField(page, '#txt-size-number'); await typeEnter(page, '40');
  const mid = await page.evaluate(([i, h]) => ({ ce: document.querySelector(h).getAttribute('contenteditable'), editing: document.getElementById(i).classList.contains('editing') }), [id, host]);
  expect(mid, '패널에 있는 동안 편집은 «세워져» 있다').toEqual({ ce: 'true', editing: true });
  await page.mouse.click(OUTSIDE.x, OUTSIDE.y); await page.waitForTimeout(250);
  const out = await page.evaluate(([i, h]) => ({ ce: document.querySelector(h).getAttribute('contenteditable'), editing: document.getElementById(i).classList.contains('editing') }), [id, host]);
  expect(out, '바깥 클릭 = 편집 끝').toEqual({ ce: 'false', editing: false });
  expect(await highlight(page), '바깥 클릭 = 선택 끝').toBeNull();
  // Esc: 패널을 거치지 않은 blur 는 예전처럼 편집을 끝낸다(세우지 않는다) — select 를 한 번 누른 «뒤»에도
  await editAndSelectBBB(page, host, { preClick: true });
  await assertPremise(page, host);
  await clickField(page, '#txt-font-weight'); await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  const { b } = await center(page, host);
  await page.mouse.dblclick(b.x + b.width - 4, b.y + b.height / 2); await page.waitForTimeout(300);
  expect(await page.evaluate((h) => document.querySelector(h).getAttribute('contenteditable'), host), '전제: 다시 편집 중').toBe('true');
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  expect(await page.evaluate(([i, h]) => ({ ce: document.querySelector(h).getAttribute('contenteditable'), editing: document.getElementById(i).classList.contains('editing') }), [id, host]),
    'Esc = 편집 끝(세우지 않음)').toEqual({ ce: 'false', editing: false });
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ══ 표 칸 ═════════════════════════════════════════════════════════ */
test('T5 표 칸 글자색 두 번 연달아(hex 칸) — 둘 다 BBB 에만', async ({ page }) => {
  const errs = await setup(page);
  const id = await insert(page, 'table'); expect(id).toBeTruthy();
  const host = `#${id} tbody tr td`;
  await editAndSelectBBB(page, host, { type: true, preClick: true });
  await assertPremise(page, host);
  const base = await split(page, host, 'color');
  await clickField(page, '#tbl-text-hex');
  expect(await act(page)).toBe('tbl-text-hex');
  await page.keyboard.press('ControlOrMeta+a'); await typeEnter(page, 'CC2929');
  let r = await split(page, host, 'color');
  expect(r.inB).toEqual(['rgb(204, 41, 41)']); expect(r.out).toEqual(base.out);
  await clickField(page, '#tbl-text-hex');
  await page.keyboard.press('ControlOrMeta+a'); await typeEnter(page, '2929CC');
  r = await split(page, host, 'color');
  expect(r.inB, '★2회: 같은 BBB (옛 판 = 표 기본색으로 빠짐)').toEqual(['rgb(41, 41, 204)']);
  expect(r.out, '★2회: BBB 밖 그대로').toEqual(base.out);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ══ 그리드 줄 ═════════════════════════════════════════════════════ */
test('T6 그리드 줄 — 크기 칸 첫 클릭이 «안 먹힌다» · 누른 순간 편집·선택이 남는다 · 적용 뒤 글자·선택이 산다', async ({ page }) => {
  const errs = await setup(page);
  const id = await insert(page, 'grid'); expect(id).toBeTruthy();
  const line = `#${id} .grd-line[data-r="0"][data-c="0"]`;
  await editAndSelectBBB(page, line, { type: true, preClick: true });
  await assertPremise(page, line);
  await page.evaluate(() => { window.__tx1Field = document.getElementById('grd-typo-size-number'); });
  await clickField(page, '#grd-typo-size-number');
  const f = await page.evaluate((ln) => ({
    act: document.activeElement?.id, same: window.__tx1Field === document.getElementById('grd-typo-size-number'),
    ce: document.querySelector(ln)?.getAttribute('contenteditable'),
  }), line);
  expect(f, '★첫 클릭: 같은 칸이 포커스를 받고(패널 안 다시 그림) 줄 편집은 이어진다').toEqual({ act: 'grd-typo-size-number', same: true, ce: 'true' });
  expect(await highlight(page), '누른 순간 BBB 선택이 보인다').toEqual(['BBB']);
  await typeEnter(page, '40');
  const after1 = await page.evaluate((ln) => ({ text: document.querySelector(ln)?.innerText, fs: getComputedStyle(document.querySelector(ln)).fontSize }), line);
  expect(after1, '1회: 친 글자가 남고(데이터로 커밋) 줄 크기 40').toEqual({ text: 'AAA BBB CCC', fs: '40px' });
  expect(await highlight(page), '1회 뒤(블럭을 다시 그렸어도) BBB 선택이 남는다').toEqual(['BBB']);
  await clickField(page, '#grd-typo-size-number');
  expect(await page.evaluate(() => getSelection().toString()), '2회째 칸 클릭 = 값 전체 선택').toBe('40');
  await typeEnter(page, '52');
  const after2 = await page.evaluate((ln) => ({ text: document.querySelector(ln)?.innerText, fs: getComputedStyle(document.querySelector(ln)).fontSize }), line);
  expect(after2).toEqual({ text: 'AAA BBB CCC', fs: '52px' });
  expect(await highlight(page)).toEqual(['BBB']);
  // 바깥(캔버스 빈 곳)을 누르면 선택이 끝난다
  await page.mouse.click(OUTSIDE.x, OUTSIDE.y); await page.waitForTimeout(200);
  expect(await highlight(page), '바깥 클릭 = 선택 끝').toBeNull();
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ══ 모달 ═════════════════════════════════════════════════════════ */
test('T7 모달 본문 — 크기 칸을 눌러도·적용해도 BBB 선택이 남는다(두 번)', async ({ page }) => {
  const errs = await setup(page);
  const id = await insert(page, 'modal'); expect(id).toBeTruthy();
  const host = `#${id} .tb-mdl-text`;
  await editAndSelectBBB(page, host, { type: true, preClick: true });
  await assertPremise(page, host);
  await clickField(page, '#mdl-typo-size-number');
  expect(await act(page)).toBe('mdl-typo-size-number');
  expect(await highlight(page), '누른 순간 BBB 선택이 보인다').toEqual(['BBB']);
  await typeEnter(page, '40');
  expect(await page.evaluate((h) => document.querySelector(h)?.textContent, host), '친 글자가 남는다').toBe('AAA BBB CCC');
  expect(await highlight(page), '★1회 뒤(모달을 다시 그렸어도) BBB 선택이 남는다').toEqual(['BBB']);
  await clickField(page, '#mdl-typo-size-number');
  await typeEnter(page, '44');
  expect(await page.evaluate((h) => getComputedStyle(document.querySelector(h)).fontSize, host)).toBe('44px');
  expect(await highlight(page), '★2회 뒤에도 남는다').toEqual(['BBB']);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ══ 예외 칸 · Mixed · 폴백 · 곁가지 ═══════════════════════════════ */
test('E1 예외 칸은 그대로 일한다 — 슬라이더(range)는 끌린다 · 숫자칸은 타이핑된다(편집 중에)', async ({ page }) => {
  const errs = await setup(page);
  const id = await insert(page, 'text');
  const host = `#${id} [class^="tb-"]`;
  await editAndSelectBBB(page, host, { preClick: true });
  await assertPremise(page, host);
  const slider = await page.evaluate(() => {
    const s = [...document.querySelectorAll('#panel-right input[type=range]')].find(e => e.getBoundingClientRect().width > 40);
    if (!s) return null; s.scrollIntoView({ block: 'center' }); const b = s.getBoundingClientRect();
    return { id: s.id, v: s.value, x: b.x, y: b.y + b.height / 2, w: b.width };
  });
  expect(slider, '전제: 패널에 슬라이더가 있다').not.toBeNull();
  await page.mouse.move(slider.x + 4, slider.y); await page.mouse.down();
  await page.mouse.move(slider.x + slider.w * 0.8, slider.y, { steps: 6 }); await page.mouse.up();
  await page.waitForTimeout(150);
  expect(await page.evaluate((i) => document.getElementById(i).value, slider.id), '슬라이더가 끌렸다').not.toBe(slider.v);
  await clickField(page, '#txt-size-number');
  await page.keyboard.type('33');
  expect(await page.evaluate(() => document.getElementById('txt-size-number').value), '숫자칸 타이핑이 들어간다').toBe('33');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('E2 Mixed 칸(값 "" · placeholder "Mix")은 클릭해도 «전체 선택»하지 않는다 — 숫자칸은 한다(대조)', async ({ page }) => {
  const errs = await setup(page);
  const id = await insert(page, 'text');
  const host = `#${id} [class^="tb-"]`;
  await editAndSelectBBB(page, host, { preClick: true });
  await clickField(page, '#txt-size-number'); await typeEnter(page, '60');
  // 블럭을 다시 고르면 패널이 블럭 안 섞임(Mix)을 보인다
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  const { b } = await center(page, `#${id}`);
  await page.mouse.click(OUTSIDE.x, OUTSIDE.y); await page.waitForTimeout(200);
  await page.mouse.click(b.x + 20, b.y + b.height / 2); await page.waitForTimeout(300);
  const f = await page.evaluate(() => { const e = document.getElementById('txt-size-number'); return { v: e.value, ph: e.placeholder }; });
  expect(f, '전제: 크기 칸이 Mixed 로 보인다').toEqual({ v: '', ph: 'Mix' });
  await clickField(page, '#txt-size-number');
  await page.waitForTimeout(80);
  expect(await act(page)).toBe('txt-size-number');
  expect(await page.evaluate(() => getSelection().toString()), 'Mixed 칸 = 전체 선택 없음').toBe('');
  // 대조: 숫자가 든 칸(줄간격 등)은 첫 클릭에 값 전체 선택
  const other = await page.evaluate(() => [...document.querySelectorAll('#panel-right input.prop-number[type=number]')]
    .find(e => e.value !== '' && e.id !== 'txt-size-number' && e.getBoundingClientRect().width > 20)?.id);
  expect(other, '전제: 값이 든 다른 숫자칸이 있다').toBeTruthy();
  await clickField(page, '#' + other);
  const v = await page.evaluate((i) => document.getElementById(i).value, other);
  expect(await page.evaluate(() => getSelection().toString()), '대조: 숫자칸은 값 전체 선택').toBe(v);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('F1 폴백 — CSS.highlights 가 없어도 크기 두 번째가 같은 BBB 에 간다(칠하기만 없다)', async ({ page }) => {
  const errs = await setup(page, { noHighlights: true });
  expect(await page.evaluate(() => typeof CSS !== 'undefined' && !!CSS.highlights), '전제: 이 판엔 CSS.highlights 가 없다').toBe(false);
  const id = await insert(page, 'text');
  const host = `#${id} [class^="tb-"]`;
  await editAndSelectBBB(page, host, { preClick: true });
  await assertPremise(page, host);
  const base = await split(page, host, 'fontSize');
  await clickField(page, '#txt-size-number'); await typeEnter(page, '40');
  await clickField(page, '#txt-size-number'); await typeEnter(page, '52');
  const r = await split(page, host, 'fontSize');
  expect(r.inB, '★폴백 2회: 같은 BBB').toEqual(['52px']);
  expect(r.out).toEqual(base.out);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S1 select 에 포커스가 있을 때 S 키는 섹션을 추가하지 않는다', async ({ page }) => {
  const errs = await setup(page);
  const id = await insert(page, 'text');
  const { b } = await center(page, `#${id}`);
  await page.mouse.click(b.x + 20, b.y + b.height / 2); await page.waitForTimeout(300);
  await page.locator('#txt-font-weight').focus();                       // 준비 — 재는 것은 아래 «진짜 키»
  expect(await act(page), '전제: select 에 포커스').toBe('txt-font-weight');
  const n0 = await page.evaluate(() => document.querySelectorAll('#canvas .section-block').length);
  await page.keyboard.press('s'); await page.waitForTimeout(250);
  const n1 = await page.evaluate(() => document.querySelectorAll('#canvas .section-block').length);
  expect(n1, 'S 가 섹션을 추가했다(SELECT 가드 누락)').toBe(n0);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('H1 보이는 선택 색 = --ui-accent 35% 반투명 — 크로미움이 color-mix 를 «실제로» 받아들였다(규칙이 살아 있고 계산값이 반투명)', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(() => {
    let decl = null;
    for (const sh of document.styleSheets) { let rules; try { rules = sh.cssRules; } catch (_) { continue; }
      for (const ru of rules) if (ru.selectorText && /::highlight\(goditor-text-sel\)$/.test(ru.selectorText)) decl = ru.style.backgroundColor; }
    const d = document.createElement('div'); d.style.backgroundColor = decl || ''; document.body.appendChild(d);
    const computed = getComputedStyle(d).backgroundColor;
    // 기준값은 «지금 이 앱의» --ui-accent 에서 끌어온다(테마가 덮어쓸 수 있다 — 손으로 박지 않는다)
    d.style.backgroundColor = 'var(--ui-accent)'; document.body.appendChild(d);
    const accent = getComputedStyle(d).backgroundColor; d.remove();
    return { decl, computed, accent };
  });
  expect(r.decl, '규칙의 background-color 가 버려졌다(color-mix 미지원이면 빈 값)').toContain('color-mix');
  const m = r.computed.match(/^color\(srgb ([\d.]+) ([\d.]+) ([\d.]+) \/ 0\.35\)$/);
  expect(m, `계산값이 35% 반투명이 아니다: ${r.computed}`).not.toBeNull();
  const a = r.accent.match(/\d+/g).slice(0, 3).map(Number);
  expect(m.slice(1, 4).map(x => Math.round(Number(x) * 255)), `색이 --ui-accent(${r.accent}) 와 다르다`).toEqual(a);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ══ R2 — Evaluator·적대QA 되돌림 묶음 (2026-10-03, 지디 승인) ═══════════════════════════════
 * 근거: scratchpad/tx1/EVAL-REPORT.md · QA-REPORT.md. 각 시험은 be5b4590 에서 빨강을 먼저 확인했다(커밋 메시지에 명부). */
/* 하이라이트 범위 = { 글자, 그 글자칸 안의 시작·끝 오프셋, 글자칸 꼴 } */
const hlOffsets = (page) => page.evaluate(() => {
  const h = CSS.highlights && CSS.highlights.get('goditor-text-sel'); if (!h) return null;
  const r = [...h][0]; if (!r) return null;
  const e = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement;
  const host = e.closest('.grd-line, [data-mdl-slot], td, th, [class^="tb-"]');
  const pre = document.createRange(); pre.selectNodeContents(host); pre.setEnd(r.startContainer, r.startOffset);
  const s = pre.toString().length;
  return { text: r.toString(), start: s, end: s + r.toString().length, line: host.dataset.line ?? null, hostText: host.textContent };
});
async function selectTail(page, n) {
  await page.keyboard.press('End');
  for (let i = 0; i < n; i++) await page.keyboard.press('Shift+ArrowLeft');
  await page.waitForTimeout(150);
}
async function editTypeSelectTail(page, hostSel, text) {
  const { b } = await center(page, hostSel);
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(250);
  await page.mouse.dblclick(b.x + b.width - 4, b.y + b.height / 2); await page.waitForTimeout(300);
  await page.keyboard.press('ControlOrMeta+a'); await page.keyboard.type(text);
  await selectTail(page, 3);
}

test('R1 그리드 줄 색(스펙트럼) 두 번 — 친 글자가 남고(자리표시로 안 바뀜) .editing 이 쌓이지 않는다', async ({ page }) => {
  const errs = await setup(page);
  const id = await insert(page, 'grid');
  const line = `#${id} .grd-line[data-r="0"][data-c="0"]`;
  await editAndSelectBBB(page, line, { type: true, preClick: true });
  await assertPremise(page, line);
  await clickField(page, '#grd-typo-color'); await page.waitForTimeout(300);
  for (const [fx, fy] of [[0.8, 0.2], [0.3, 0.6]]) {
    const sp = await page.evaluate(([fx, fy]) => { const e = [...document.querySelectorAll('.goya-cp-spectrum')].find(x => x.getBoundingClientRect().width > 0);
      if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x + b.width * fx, y: b.y + b.height * fy }; }, [fx, fy]);
    expect(sp, '전제: 스펙트럼이 열려 있다').not.toBeNull();
    await page.mouse.click(sp.x, sp.y); await page.waitForTimeout(300);
    const st = await page.evaluate(([i, ln]) => ({ text: document.querySelector(ln)?.innerText, editing: document.querySelectorAll(`#${i}.editing, #${i} .editing`).length }), [id, line]);
    expect(st.text, '★줄 글자가 남는다(옛 판 = 「내용을 입력하세요.」)').toBe('AAA BBB CCC');
    expect(st.editing, '★.editing 이 쌓이지 않는다').toBeLessThanOrEqual(1);
  }
  await page.keyboard.press('Escape'); await page.mouse.click(OUTSIDE.x, OUTSIDE.y); await page.waitForTimeout(250);
  const end = await page.evaluate(([i, ln]) => ({ text: document.querySelector(ln)?.innerText, editing: document.querySelectorAll(`#${i}.editing, #${i} .editing`).length }), [id, line]);
  expect(end, '바깥 클릭 뒤: 글자는 데이터에 있고 편집 표시는 0').toEqual({ text: 'AAA BBB CCC', editing: 0 });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('R2 텍스트블럭 Mixed(36/60): 편집으로 돌아와 ⌘A·Esc 뒤 크기 칸은 「Mix」다(「60」 아님)', async ({ page }) => {
  const errs = await setup(page);
  const id = await insert(page, 'text');
  const host = `#${id} [class^="tb-"]`;
  await editAndSelectBBB(page, host, { preClick: true });
  await assertPremise(page, host);
  await clickField(page, '#txt-size-number'); await typeEnter(page, '60');
  const r = await split(page, host, 'fontSize');
  expect([r.inB, r.out], '전제: 36/60 이 섞였다').toEqual([['60px'], ['36px']]);
  const { b } = await center(page, host);
  await page.mouse.dblclick(b.x + 30, b.y + b.height / 2); await page.waitForTimeout(400);
  await page.keyboard.press('ControlOrMeta+a'); await page.waitForTimeout(300);
  const field = () => page.evaluate(() => { const e = document.getElementById('txt-size-number'); return { v: e.value, ph: e.placeholder }; });
  expect(await field(), '★(a) 편집 중 ⌘A').toEqual({ v: '', ph: 'Mix' });
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  expect(await field(), '★(b) Esc 뒤').toEqual({ v: '', ph: 'Mix' });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('R3 그리드 줄 «구조»가 바뀌면 저장 선택이 남의 줄에 붙지 않는다 — 줄 삭제(QA B1 꼴)', async ({ page }) => {
  const errs = await setup(page);
  const id = await insert(page, 'grid');
  const l0 = `#${id} .grd-line[data-r="0"][data-c="0"][data-line="0"]`;
  await editTypeSelectTail(page, l0, 'AAA BBB AAA');
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  await clickField(page, '#grd-line-dup-btn'); await page.waitForTimeout(300);           // 「줄 복사」 → 같은 글자의 줄 1
  expect(await page.evaluate((i) => [...document.querySelectorAll(`#${i} .grd-line[data-r="0"][data-c="0"]`)].map(e => e.innerText), id),
    '전제: 같은 글자 두 줄').toEqual(['AAA BBB AAA', 'AAA BBB AAA']);
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  const { b } = await center(page, l0);
  await page.mouse.dblclick(b.x + b.width - 4, b.y + b.height / 2); await page.waitForTimeout(300);
  await selectTail(page, 3);
  await assertPremiseText(page, l0, 'AAA');
  expect((await hlOrSel(page)).start, '전제: 0번 줄 «뒤» AAA(8–11)').toBe(8);
  await clickField(page, '#grd-line-del-btn'); await page.waitForTimeout(400);           // 0번 줄 삭제 → 1번 줄이 0번으로 당겨진다
  expect(await page.evaluate((i) => document.querySelectorAll(`#${i} .grd-line[data-r="0"][data-c="0"]`).length, id), '전제: 한 줄 남음').toBe(1);
  expect(await highlight(page), '★지운 줄의 선택이 «남은 줄»에 붙지 않는다').toBeNull();
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('R3-b 그리드 줄을 «더해도» 저장 선택이 남의 줄로 밀리지 않는다(줄 복사)', async ({ page }) => {
  const errs = await setup(page);
  const id = await insert(page, 'grid');
  const l0 = `#${id} .grd-line[data-r="0"][data-c="0"][data-line="0"]`;
  await editTypeSelectTail(page, l0, 'AAA BBB AAA');
  await assertPremiseText(page, l0, 'AAA');
  await clickField(page, '#grd-line-dup-btn'); await page.waitForTimeout(400);
  const h = await hlOffsets(page);
  expect(h === null || (h.line === '0' && h.start === 8), `★남의 줄로 안 밀림: ${JSON.stringify(h)}`).toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

for (const [name, kind, hostOf, field] of [
  ['그리드 줄', 'grid', (id) => `#${id} .grd-line[data-r="0"][data-c="0"]`, '#grd-typo-size-number'],
  ['모달 본문', 'modal', (id) => `#${id} .tb-mdl-text`, '#mdl-typo-size-number'],
]) {
  test(`R3-c 같은 글자 둘(AAA BBB AAA) — ${name} 크기 40·52 뒤에도 «뒤» AAA(8–11)에 남는다`, async ({ page }) => {
    const errs = await setup(page);
    const id = await insert(page, kind);
    const host = hostOf(id);
    await editTypeSelectTail(page, host, 'AAA BBB AAA');
    await assertPremiseText(page, host, 'AAA');
    for (const v of ['40', '52']) {
      await clickField(page, field); await typeEnter(page, v);
      const h = await hlOffsets(page);
      expect(h && [h.text, h.start, h.end], `${v}: 뒤 AAA 8–11`).toEqual(['AAA', 8, 11]);
    }
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}

test('R3-d 텍스트블럭 ⌘Z·⌘⇧Z 는 저장 선택을 버린다(B2 판정) — 앞 AAA 로도 새지 않는다', async ({ page }) => {
  const errs = await setup(page);
  const id = await insert(page, 'text');
  const host = `#${id} [class^="tb-"]`;
  await editTypeSelectTail(page, host, 'AAA BBB AAA');
  await assertPremiseText(page, host, 'AAA');
  await clickField(page, '#txt-size-number'); await typeEnter(page, '40');
  await page.mouse.click(OUTSIDE.x, OUTSIDE.y); await page.waitForTimeout(200);
  await page.keyboard.press('ControlOrMeta+z'); await page.waitForTimeout(300);
  expect(await highlight(page), '⌘Z 뒤 저장 선택 없음').toBeNull();
  await page.keyboard.press('ControlOrMeta+Shift+z'); await page.waitForTimeout(300);
  expect(await highlight(page), '⌘⇧Z 뒤 저장 선택 없음').toBeNull();
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('R4 B2: BBB 40 → ⌘Z → 블럭 클릭(편집 밖) → 크기 30 ⇒ 블럭 «전체» 30 (핀과 같은 값)', async ({ page }) => {
  const errs = await setup(page);
  const id = await insert(page, 'text');
  const host = `#${id} [class^="tb-"]`;
  await editAndSelectBBB(page, host, { preClick: true });
  await assertPremise(page, host);
  await clickField(page, '#txt-size-number'); await typeEnter(page, '40');
  await page.keyboard.press('ControlOrMeta+z'); await page.waitForTimeout(300);
  const { b } = await center(page, `#${id}`);
  await page.mouse.click(b.x + 20, b.y + b.height / 2); await page.waitForTimeout(300);
  expect(await page.evaluate((h) => document.querySelector(h).getAttribute('contenteditable'), host), '전제: 편집 밖(선택만)').not.toBe('true');
  await clickField(page, '#txt-size-number'); await typeEnter(page, '30');
  const r = await split(page, host, 'fontSize');
  expect([r.inB, r.out], '★블럭 전체 30').toEqual([['30px'], ['30px']]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('R5 type 속성이 «없는» 패널 input 도 예외 — 편집 중 눌러 타이핑이 된다', async ({ page }) => {
  const errs = await setup(page);
  const id = await insert(page, 'text');
  const host = `#${id} [class^="tb-"]`;
  await editAndSelectBBB(page, host, { preClick: true });
  await assertPremise(page, host);
  // 준비: 우측 패널에 type 없는 input 하나(변수 서랍의 #var-name-input 과 같은 꼴 — 서랍이 지금 숨겨져 있어 직접 둔다)
  await page.evaluate(() => { const i = document.createElement('input'); i.id = 'tx1-untyped'; i.style.cssText = 'width:120px;height:22px';
    document.querySelector('#panel-right').prepend(i); });
  await clickField(page, '#tx1-untyped');
  await page.keyboard.type('abc');
  expect(await page.evaluate(() => document.getElementById('tx1-untyped').value), '★type 없는 input 에 타이핑이 들어간다').toBe('abc');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('R6 KEEP_FOCUS 밖 표면(채팅)에서 편집이 진짜로 끝나면 하이라이트도 지워진다', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => { document.getElementById('sA').classList.add('selected'); window.addChatBlock({}); });
  await page.waitForTimeout(400);
  const bt = '#canvas .chat-block .chb-btext';
  const { b } = await center(page, bt);
  await page.mouse.click(b.x + 5, b.y + b.height / 2); await page.waitForTimeout(250);
  await page.mouse.dblclick(b.x + 5, b.y + b.height / 2); await page.waitForTimeout(300);
  await page.keyboard.press('ControlOrMeta+a'); await page.keyboard.type('AAA BBB CCC');
  await page.keyboard.press('End');
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowLeft');
  for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowLeft');
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => getSelection().toString()), '전제: BBB').toBe('BBB');
  /* ★2026-10-06 ⒝ — #chb-fontsize(손제작 숫자칸)가 공용 Typography 절의 #chb-typo-size-number 로 갈렸다.
     ⛔이 검사가 재는 것은 «패널 칸을 누르면 챗 인라인 편집이 blur 로 끝나나»다 — 어느 칸이든 된다. 칸 이름만 갈았다. */
  await clickField(page, '#chb-typo-size-number'); await page.waitForTimeout(200);
  expect(await page.evaluate((s) => document.querySelector(s).getAttribute('contenteditable'), bt), '전제: 채팅 편집은 blur 로 진짜 끝났다').not.toBe('true');
  expect(await highlight(page), '★편집이 끝났으면 하이라이트가 없다').toBeNull();
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('R7 (덤으로 나아진 것 지키기) 크기 두 번 뒤 글자 끝을 «한 번» 클릭하고 Q — 편집이 이어져 AAA BBB CCCQ (핀은 편집으로 못 돌아감)', async ({ page }) => {
  const errs = await setup(page);
  const id = await insert(page, 'text');
  const host = `#${id} [class^="tb-"]`;
  await editAndSelectBBB(page, host, { preClick: true });
  await assertPremise(page, host);
  await clickField(page, '#txt-size-number'); await typeEnter(page, '40');
  await clickField(page, '#txt-size-number'); await typeEnter(page, '52');
  const { b } = await center(page, host);
  await page.mouse.click(b.x + b.width - 3, b.y + b.height - 6); await page.waitForTimeout(250);
  await page.keyboard.press('End'); await page.keyboard.type('Q'); await page.waitForTimeout(150);
  expect(await page.evaluate((h) => document.querySelector(h).textContent, host)).toBe('AAA BBB CCCQ');
  expect(errs, errs.join(' | ')).toEqual([]);
});

for (const [label, bg, want, other] of [['흰 섹션', '#ffffff', 'goditor-text-sel', 'goditor-text-sel-dark'], ['#111 섹션', '#111111', 'goditor-text-sel-dark', 'goditor-text-sel']]) {
  test(`R8 하이라이트 둘 — ${label} 위에선 ${want} 가 등록된다(바탕 판정 = canvas-contrast textToneAt)`, async ({ page }) => {
    const errs = await setup(page);
    await page.evaluate((bg) => { document.getElementById('sA').style.backgroundColor = bg; }, bg);
    const id = await insert(page, 'text');
    const host = `#${id} [class^="tb-"]`;
    const secBg = await page.evaluate(() => getComputedStyle(document.getElementById('sA')).backgroundColor);
    expect(secBg, '전제: 섹션 바탕이 정말 그 색').toBe(bg === '#ffffff' ? 'rgb(255, 255, 255)' : 'rgb(17, 17, 17)');
    await editAndSelectBBB(page, host, { preClick: true });
    await assertPremise(page, host);
    await clickField(page, '#txt-size-number'); await page.waitForTimeout(100);
    const reg = await page.evaluate(([a, b]) => ({ want: CSS.highlights.has(a) ? [...CSS.highlights.get(a)].map(r => r.toString()) : null, other: CSS.highlights.has(b) }), [want, other]);
    expect(reg, `${want} 에 BBB, ${other} 는 비어 있다`).toEqual({ want: ['BBB'], other: false });
    if (want.endsWith('-dark')) {
      // 규칙이 살아 있다: 같은 바탕 + 흰 글자
      const rule = await page.evaluate(() => { for (const sh of document.styleSheets) { let rs; try { rs = sh.cssRules; } catch (_) { continue; }
        for (const r of rs) if (r.selectorText && /::highlight\(goditor-text-sel-dark\)$/.test(r.selectorText)) return { bg: r.style.backgroundColor, color: r.style.color }; } return null; });
      expect(rule && rule.bg, '어두운 판 규칙의 바탕').toContain('color-mix');
      expect(rule && rule.color, '어두운 판 규칙의 글자색').toBe('rgb(255, 255, 255)');
    }
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}
