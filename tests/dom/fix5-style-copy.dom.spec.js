// fix5-style-copy — 1020t2d2 텍스트 블럭 «스타일 복사 ⌥⌘C / 스타일 붙여넣기 ⌥⌘V» (현빈 시트 L20 「애플과 같은 단축키」)
// 아이맥 실측(ca702d40 ❌): 블럭0(52px/600/#333) ⌥⌘C → 블럭2 ⌥⌘V ⇒ 블럭2 24px/400/#555 그대로 · 우클릭 메뉴에 스타일 항목 0.
// 고침: js/props/text-style-copy.js(본체) · js/editor.js(⌥⌘C/⌥⌘V 갈래 — ⌘C/⌘V 갈래 «앞») · js/block-factory.js(우클릭 두 항목).
// 칸(--grep @d2 → Running 12):
//   D1  ⓐ 한 대상 — 글꼴·크기·굵기·색·줄간격·자간·정렬·그림자가 A 와 같아지고 글은 그대로 · A 불변 · 블럭 수 불변 · 패널이 새 값
//   D2  ⓐ 여러 대상 — B·C 를 골라(⇧ 범위) ⌥⌘V 한 번 ⇒ 둘 다
//   D3  붙여넣기 한 번 = 이력 +1 · ⌘Z 한 번 — B 가 붙이기 전 모양으로(글 불변) · ⌘⇧Z — 다시 A 꼴
//   D4  우클릭 메뉴 — 텍스트 블럭에 두 항목(담기 전 붙여넣기는 흐림) · 복사/붙여넣기가 단축키와 같은 일 · 텍스트 아닌 블럭(여백)엔 두 항목 숨김
//   D5  텍스트 아닌 블럭(여백)을 골라 ⌥⌘V ⇒ 무시(블럭 수·글자 모양·이력 칸 불변 — 블럭 붙여넣기로 새지 않는다)
//   R1  회귀(t5-17 꼴) — ⌥⌘C 로 스타일을 담아 둔 «뒤»에도, 편집 중 보통 ⌘C/⌘V 로 붙인 글자는 목적지 모양(짐 모양 0)
//   R2  회귀(t4-12 꼴) — 블럭을 골라 보통 ⌘C/⌘V ⇒ 사본 블럭이 하나 생기고 붙일 자리 B 의 모양은 그대로
//   D6  이력에 안 찍힌 앞 변경(evaluate 로 주입) 뒤 붙여넣기 ⇒ ⌘Z 한 번은 붙여넣기만 되돌린다(앞 변경은 남는다 — ensureHistoryCheckpoint)
//   D7  편집 중 ⌥⌘V ⇒ 아무 일 없음(크기 불변 · 편집 유지 — ⓑ ⬜)
//   F1  ⌥ 깃발(_optionKeyHeld)이 굳은 상태의 보통 ⌘C/⌘V ⇒ 블럭 복사/붙여넣기(스타일 갈래로 안 샌다) — 굳은 깃발은 evaluate 로 «심는다»(결함 주입 · 사람 손으로는 keyup 유실)
//   F2  정렬을 준 적 없는 원천(C) ⇒ 대상의 명시 정렬(A 오른쪽)·말풍선 발신자 정렬이 안 바뀐다
//   F3  자리표시 상태 원천(손 안 댄 말풍선 · 흐린 색) ⇒ 대상 색이 흐린 색으로 굳지 않는다
// 양성대조(고치기 전 빨강): GD1001_ROOT=<바닥 46d444b1 사본> 로 같은 시험 — D1·D2·D3·D4·D5·D6 빨강 / R1·R2 초록 기대(D7·F1·F2·F3 은 바닥에 기능이 없어 뜻이 다르다 — 검수 사본 F1/F2/F3 로 잰다).
//   바닥에선 합성 키 ⌥⌘C/⌥⌘V 의 e.key 가 'c'/'v' 라 ⌘C/⌘V 갈래(블럭 복사/붙여넣기)로 샌다 ⇒ D5 는 블럭 수 +1 로 빨강.
// 규칙: 장면은 앱 제 문(새 섹션 단추 · 텍스트 메뉴 · 캔버스 클릭 · 패널 칸 · 실제 키보드)으로만 짓는다. evaluate 는 읽기 · 캐럿 놓기 · 배율만.
//   ⛔고정 대기 0줄 — waitForFunction / expect.poll / waitStableRect. 좌표 클릭은 clickAt(맞힌 요소 단언). 전제 hard · 성공 soft.
// 돌리는 법(트리 cwd):
//   npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/fix5-style-copy.dom.spec.js --grep @d2 --workers=1 --retries=0
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

const VIEW = { width: 1500, height: 1000 };
const STYLE_COPY = 'ControlOrMeta+Alt+KeyC';
const STYLE_PASTE = 'ControlOrMeta+Alt+KeyV';
const WORDS = { A: 'Alpha', B: 'Bravo', C: 'Charlie' };
// 바꿀 모양(A = 출처) · B = 아이맥 장면의 블럭2
const A_LOOK = { size: '52', weight: '600', hex: '333333', font: 'Noto Serif KR', lh: '1.8', ls: '2', align: 'right' };
const B_LOOK = { size: '24', weight: '400', hex: '555555' };
const KEYS = ['fontSize', 'fontWeight', 'color', 'fontFamily', 'fontStyle', 'lineHeight', 'letterSpacing', 'textAlign', 'textShadow'];

async function attach(ti, name, o) { await ti.attach(name, { body: JSON.stringify(o, null, 1), contentType: 'application/json' }); }
function pre(cond, msg) { expect(!!cond, '장면 미성립: ' + msg).toBe(true); }

// ── 띄우기 ──
async function boot(page) {
  const cerr = [];
  page.on('console', (m) => { if (m.type() === 'error') cerr.push(m.text().slice(0, 300)); });
  page.on('dialog', (d) => { d.dismiss().catch(() => {}); });
  await page.setViewportSize(VIEW);
  const errs = await bootApp(page);
  await page.evaluate(() => window.applyZoom?.(100));
  await page.waitForFunction(() => {
    const S = document.getElementById('canvas-scaler');
    if (!S || S.getAnimations().length) return false;
    const tf = getComputedStyle(S).transform; const m = /^matrix\(([^,]+),/.exec(tf);
    const k = tf === 'none' ? 1 : m ? Number(m[1]) : NaN;
    return Math.abs(k - 1) < 1e-3;
  }, null, { timeout: 15000 });
  return { errs, cerr };
}
async function pollTrue(page, fn, arg, timeout = 6000) {
  try { await page.waitForFunction(fn, arg, { timeout, polling: 100 }); return true; } catch { return false; }
}
// 가라앉힘 — 캔버스 innerHTML · 선택 · 포커스가 연달아 4번(100ms 간격) 같을 때까지
async function settle(page, timeout = 8000) {
  await page.evaluate(() => { window.__d2Last = null; window.__d2N = 0; });
  return pollTrue(page, () => {
    const c = document.getElementById('canvas'); const a = document.activeElement;
    const s = (c ? c.innerHTML : '') + '|' + [...document.querySelectorAll('#canvas .selected')].map((e) => e.id).join(',') + '|' + (a ? a.tagName + (a.className || '') : '');
    if (s === window.__d2Last) window.__d2N++; else { window.__d2Last = s; window.__d2N = 0; }
    return window.__d2N >= 4;
  }, null, timeout);
}
async function stableTwice(page, sel, index = 0) {
  const a = await waitStableRect(page, sel, { index }); const b = await waitStableRect(page, sel, { index });
  return { ...b, twiceSame: a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height };
}
const scrollTo = (page, sel) => page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center', behavior: 'instant' }), sel);
const reExact = (s) => new RegExp('^\\s*' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$');
const secIds = (page) => page.evaluate(() => [...document.querySelectorAll('#canvas .section-block:not([data-ghost])')].map((s) => s.id));
const textIds = (page) => page.evaluate(() => [...document.querySelectorAll('#canvas .text-block')].map((t) => t.id));
const blockCount = (page) => page.evaluate(() => document.querySelectorAll('#canvas .section-inner :is(.text-block,.gap-block,.frame-block)').length);
const histTip = (page) => page.evaluate(() => { const t = window.getHistoryTip?.(); return t ? { pos: t.pos, len: t.len } : null; });
const tbCe = (id) => `[id="${id}"] .tb-body`;

// ── 앱 문 ──
async function pickSec(page, id) {
  const SEC = `[id="${id}"]`; await scrollTo(page, SEC);
  const hz = await stableTwice(page, SEC + ' .section-hitzone');
  await clickAt(page, hz.left + hz.width / 8, hz.cy, { sel: SEC + ' .section-hitzone' }, { label: '섹션 꼬리표' });
  return pollTrue(page, (id) => window.getSelectedSection?.()?.id === id, id, 3000);
}
async function newSection(page) {
  const before = await secIds(page);
  await page.click('.fp-btn.primary[title="새 섹션 추가"]');
  await pollTrue(page, (n) => document.querySelectorAll('#canvas .section-block:not([data-ghost])').length > n, before.length);
  const id = (await secIds(page)).find((x) => !before.includes(x)) || null;
  pre(id, '새 섹션이 생겼다');
  let picked = await page.evaluate((id) => window.getSelectedSection?.()?.id === id, id);
  if (!picked) picked = await pickSec(page, id);
  pre(picked, '새 섹션이 골라졌다');
  await settle(page);
  return id;
}
async function insBody(page) {
  const before = await textIds(page);
  await page.click('#fp-text-dropdown .fp-dropdown-trigger');
  await page.locator('#fp-text-menu .fp-menu-item').filter({ hasText: reExact('Body') }).first().click();
  await pollTrue(page, (n) => document.querySelectorAll('#canvas .text-block').length > n, before.length, 6000);
  await settle(page);
  const fresh = (await textIds(page)).filter((i) => !before.includes(i));
  pre(fresh.length === 1, `텍스트 메뉴 ▸ Body 로 블럭 하나 ${JSON.stringify(fresh)}`);
  return fresh[0];
}
async function insBubble(page) {
  const ids = () => page.evaluate(() => [...document.querySelectorAll('#canvas .speech-bubble-block')].map((e) => e.id));
  const before = await ids();
  await page.click('#fp-text-dropdown .fp-dropdown-trigger');
  await page.locator('#fp-text-menu .fp-menu-item').filter({ hasText: reExact('Bubble') }).first().click();
  await pollTrue(page, (n) => document.querySelectorAll('#canvas .speech-bubble-block').length > n, before.length, 6000);
  await settle(page);
  const fresh = (await ids()).filter((i) => !before.includes(i));
  pre(fresh.length === 1, `텍스트 메뉴 ▸ Bubble 로 말풍선 하나 ${JSON.stringify(fresh)}`);
  return fresh[0];
}
const BUB = '.tb-bubble';
// 말풍선 정렬 «저장값» 세 곳 — 발신자 이름표 인라인 · data-sender-align · 글자칸 인라인
const bubbleAlign = (page, id) => page.evaluate((id) => {
  const tb = document.getElementById(id); if (!tb) return null;
  return { sender: tb.querySelector('.tb-sender-name')?.style.textAlign ?? null, senderData: tb.dataset.senderAlign ?? null, bubble: tb.querySelector('.tb-bubble')?.style.textAlign ?? null };
}, id);
// 글 블럭 고르기(편집 아님) — modifier 'Shift' 면 그 키를 누른 채(범위 다중선택 문)
async function clickBlock(page, id, { modifier = null, button = 'left', ce = null } = {}) {
  const sel = ce ? `[id="${id}"] ${ce}` : tbCe(id);
  await scrollTo(page, sel);
  const r = await stableTwice(page, sel);
  if (modifier) await page.keyboard.down(modifier);
  try { await clickAt(page, r.left + Math.min(30, r.width / 4), r.cy, { sel: `[id="${id}"]`, not: '.tb-rotate-zone, #ss-handles-overlay' }, { label: '고르기 ' + id, button }); }
  finally { if (modifier) await page.keyboard.up(modifier); }
  if (button === 'right') return true;
  return pollTrue(page, (id) => !!document.getElementById(id)?.classList.contains('selected') && !document.getElementById(id)?.classList.contains('editing'), id, 3000);
}
async function dblBlock(page, id) {
  const sel = tbCe(id);
  await scrollTo(page, sel);
  const r = await stableTwice(page, sel);
  await clickAt(page, r.left + Math.min(30, r.width / 4), r.cy, { sel: `[id="${id}"]`, not: '.tb-rotate-zone, #ss-handles-overlay' }, { label: '편집 ' + id, dbl: true });
  return pollTrue(page, (id) => { const tb = document.getElementById(id); const a = document.activeElement; return !!tb && tb.classList.contains('editing') && !!a && a.isContentEditable && tb.contains(a); }, id, 3000);
}
const caretToEndActive = (page) => page.evaluate(() => {
  const ce = document.activeElement; if (!ce || !ce.isContentEditable) return false;
  const rg = document.createRange(); rg.selectNodeContents(ce); rg.collapse(false);
  const s = window.getSelection(); s.removeAllRanges(); s.addRange(rg); return true;
});
// 글 넣기 — 더블클릭 편집 → 자리표시를 덮어 타이핑 → Esc
async function typeInto(page, id, word) {
  pre(await dblBlock(page, id), `${id} 편집 들어감`);
  await page.keyboard.type(word);
  pre(await pollTrue(page, ([s, w]) => (document.querySelector(s)?.textContent || '') === w, [tbCe(id), word], 3000), `${id} 글자 = ${word}`);
  await page.keyboard.press('Escape');
  pre(await pollTrue(page, (id) => !document.getElementById(id)?.classList.contains('editing'), id, 3000), `${id} 편집 끝`);
  await settle(page);
}
const panelOn = (page, id) => pollTrue(page, (id) => document.querySelector('#panel-right .prop-block-id')?.dataset?.copyId === id && !!document.getElementById('txt-size-number'), id, 3000);
async function fillEnter(page, sel, v) { const l = page.locator(sel); await l.fill(v); await l.press('Enter'); }

// ── 재기 ──
const readLook = (page, id, ce = null) => page.evaluate(([sel, KEYS]) => {
  const ce = document.querySelector(sel); if (!ce) return null;
  const cs = getComputedStyle(ce); const o = {};
  for (const k of KEYS) o[k] = cs[k];
  o.text = ce.textContent;
  o.shadowOn = ce.dataset.shadowEnabled || null;
  return o;
}, [ce ? `[id="${id}"] ${ce}` : tbCe(id), KEYS]);
const lookOnly = (L) => { if (!L) return null; const o = {}; for (const k of KEYS) o[k] = L[k]; return o; };
const diffKeys = (a, b) => KEYS.filter((k) => !a || !b || a[k] !== b[k]);

// ── 장면 — 새 섹션 · Body 셋(A·B·C, 글 Alpha·Bravo·Charlie) · A 를 패널로 꾸밈 · B 를 블럭2 꼴로 ──
async function scene(page, o) {
  o.sec = await newSection(page);
  const ids = {};
  for (const k of ['A', 'B', 'C']) {
    if (k !== 'A') pre(await pickSec(page, o.sec), `${k} 넣기 전 섹션 다시 고름`);
    ids[k] = await insBody(page);
  }
  for (const k of ['A', 'B', 'C']) await typeInto(page, ids[k], WORDS[k]);
  o.ids = ids;
  // A 꾸밈 — 크기·굵기·색·글꼴·줄간격·자간·정렬·그림자
  pre(await clickBlock(page, ids.A), 'A 골라짐');
  pre(await panelOn(page, ids.A), 'A 글자 패널');
  await fillEnter(page, '#txt-size-number', A_LOOK.size);
  await page.locator('#txt-font-weight').selectOption(A_LOOK.weight);
  await fillEnter(page, '#txt-color-hex', A_LOOK.hex);
  await page.click('#txt-font-trigger');
  await page.locator('#txt-font-list .font-item').filter({ has: page.locator('.font-item-name', { hasText: reExact(A_LOOK.font) }) }).first().click();
  await fillEnter(page, '#txt-lh-number', A_LOOK.lh);
  await fillEnter(page, '#txt-ls-number', A_LOOK.ls);
  await page.locator(`#panel-right .prop-align-btn[data-align="${A_LOOK.align}"]`).first().click();
  // 그림자 토글 — 체크박스는 숨김 꼴(prop-toggle)이라 사람이 누르는 트랙(label)을 누른다
  await page.locator('#txt-shadow-section label.prop-toggle').first().click();
  pre(await pollTrue(page, () => !!document.getElementById('txt-shadow-on')?.checked, null, 3000), 'A 그림자 켜짐');
  await expect.poll(async () => { const L = await readLook(page, ids.A); return L && [L.fontSize, L.fontWeight, L.color, L.textAlign, L.shadowOn, /Noto Serif KR/.test(L.fontFamily)].join('|'); },
    { message: '장면 미성립: A 꼴 52px·600·#333·오른쪽·그림자·Noto Serif KR' }).toBe('52px|600|rgb(51, 51, 51)|right|true|true');
  await settle(page);
  // B 꼴 — 블럭2(24·400·#555)
  pre(await clickBlock(page, ids.B), 'B 골라짐');
  pre(await panelOn(page, ids.B), 'B 글자 패널');
  await fillEnter(page, '#txt-size-number', B_LOOK.size);
  await page.locator('#txt-font-weight').selectOption(B_LOOK.weight);
  await fillEnter(page, '#txt-color-hex', B_LOOK.hex);
  await expect.poll(async () => { const L = await readLook(page, ids.B); return L && [L.fontSize, L.fontWeight, L.color].join('|'); },
    { message: '장면 미성립: B 꼴 24px·400·#555' }).toBe('24px|400|rgb(85, 85, 85)');
  await settle(page);
  o.A0 = await readLook(page, ids.A); o.B0 = await readLook(page, ids.B); o.C0 = await readLook(page, ids.C);
  // 전제: A 와 B·C 가 고르는 칸마다 다르다(같으면 «옮겨졌다»를 못 가른다) — 그림자 글자는 B·C 가 none
  o.diffAB = diffKeys(o.A0, o.B0); o.diffAC = diffKeys(o.A0, o.C0);
  for (const k of ['fontSize', 'fontWeight', 'color', 'fontFamily', 'lineHeight', 'letterSpacing', 'textAlign', 'textShadow']) {
    pre(o.diffAB.includes(k), `A·B 의 ${k} 가 다르다 ${JSON.stringify({ A: o.A0[k], B: o.B0[k] })}`);
  }
  pre(o.diffAC.includes('fontSize') && o.diffAC.includes('color'), `A·C 크기·색이 다르다 ${JSON.stringify({ A: lookOnly(o.A0), C: lookOnly(o.C0) })}`);
}
async function copyStyleFromA(page, o) {
  pre(await clickBlock(page, o.ids.A), 'A 골라짐(스타일 복사)');
  await page.keyboard.press(STYLE_COPY);
  await settle(page);
}
// 성공 칸 — 대상이 A 의 모양과 같고 글은 그대로
function expectSameLook(label, got, want, word) {
  expect.soft(diffKeys(got, want), `성공 ${label}: 모양이 A 와 같다 ${JSON.stringify({ got: lookOnly(got), want: lookOnly(want) })}`).toEqual([]);
  expect.soft(got && got.text, `성공 ${label}: 글은 그대로 «${word}»`).toBe(word);
}
function tail(o, B) {
  o.pageerror = B.errs.slice(0, 20).map((s) => String(s).slice(0, 300));
  expect.soft(o.pageerror, 'pageerror 0').toEqual([]);
}

test.describe('1020t2d2 스타일 복사/붙여넣기 @d2', () => {
  test('D1 ⓐ 한 대상 — ⌥⌘C A → ⌥⌘V B ⇒ B 모양 = A · 글 불변 · A 불변 @d2', async ({ page }, ti) => {
    test.setTimeout(90000);
    const B = await boot(page); const o = {};
    try {
      await scene(page, o);
      o.n0 = await blockCount(page);
      await copyStyleFromA(page, o);
      pre(await clickBlock(page, o.ids.B), 'B 골라짐(붙여넣기)');
      await page.keyboard.press(STYLE_PASTE);
      await pollTrue(page, ([s, v]) => getComputedStyle(document.querySelector(s)).fontSize === v, [tbCe(o.ids.B), o.A0.fontSize], 4000);
      await settle(page);
      o.B1 = await readLook(page, o.ids.B); o.A1 = await readLook(page, o.ids.A); o.n1 = await blockCount(page);
      o.panelSize = await page.evaluate(() => document.getElementById('txt-size-number')?.value ?? null);
      expectSameLook('D1 B', o.B1, o.A0, WORDS.B);
      expect.soft(o.B1 && o.B1.shadowOn, '성공 D1: B 그림자 켜짐(dataset)').toBe('true');
      expect.soft(diffKeys(o.A1, o.A0), '성공 D1: A 는 그대로').toEqual([]);
      expect.soft(o.n1, `성공 D1: 블럭 수 불변 ${o.n0}→${o.n1}(블럭 붙여넣기로 새지 않음)`).toBe(o.n0);
      expect.soft(o.panelSize, '성공 D1: 패널 크기 칸이 새 값(52)').toBe(A_LOOK.size);
      tail(o, B);
    } finally { await attach(ti, 'd1.json', o); }
  });

  test('D2 ⓐ 여러 대상 — B·C 를 골라 ⌥⌘V 한 번 ⇒ 둘 다 @d2', async ({ page }, ti) => {
    test.setTimeout(90000);
    const B = await boot(page); const o = {};
    try {
      await scene(page, o);
      await copyStyleFromA(page, o);
      pre(await clickBlock(page, o.ids.B), 'B 골라짐');
      await clickBlock(page, o.ids.C, { modifier: 'Shift' });
      o.sel = await page.evaluate(() => [...document.querySelectorAll('#canvas .text-block.selected')].map((e) => e.id));
      pre(o.sel.includes(o.ids.B) && o.sel.includes(o.ids.C) && !o.sel.includes(o.ids.A), `B·C 만 골라짐 ${JSON.stringify(o.sel)}`);
      await page.keyboard.press(STYLE_PASTE);
      await pollTrue(page, ([s, v]) => getComputedStyle(document.querySelector(s)).fontSize === v, [tbCe(o.ids.C), o.A0.fontSize], 4000);
      await settle(page);
      o.B1 = await readLook(page, o.ids.B); o.C1 = await readLook(page, o.ids.C); o.A1 = await readLook(page, o.ids.A);
      expectSameLook('D2 B', o.B1, o.A0, WORDS.B);
      expectSameLook('D2 C', o.C1, o.A0, WORDS.C);
      expect.soft(diffKeys(o.A1, o.A0), '성공 D2: A 는 그대로').toEqual([]);
      tail(o, B);
    } finally { await attach(ti, 'd2.json', o); }
  });

  test('D3 ⌘Z 한 번 — 스타일 붙여넣기를 통째로 되돌린다 @d2', async ({ page }, ti) => {
    test.setTimeout(90000);
    const B = await boot(page); const o = {};
    try {
      await scene(page, o);
      await copyStyleFromA(page, o);
      pre(await clickBlock(page, o.ids.B), 'B 골라짐');
      o.h0 = await histTip(page);
      await page.keyboard.press(STYLE_PASTE);
      o.pasted = await pollTrue(page, ([s, v]) => getComputedStyle(document.querySelector(s)).fontSize === v, [tbCe(o.ids.B), o.A0.fontSize], 4000);
      await settle(page);
      o.h1 = await histTip(page);
      expect.soft(o.pasted, '성공 D3: 붙여넣기가 먼저 됐다(크기 52)').toBe(true);
      expect.soft(o.h1 && o.h0 && [o.h1.len - o.h0.len, o.h1.pos - o.h0.pos], `성공 D3: 붙여넣기 한 번 = 이력 +1 ${JSON.stringify({ h0: o.h0, h1: o.h1 })}`).toEqual([1, 1]);
      await page.keyboard.press('ControlOrMeta+z');
      await pollTrue(page, ([s, v]) => getComputedStyle(document.querySelector(s) || document.body).fontSize === v, [tbCe(o.ids.B), o.B0.fontSize], 4000);
      await settle(page);
      o.h2 = await histTip(page);
      o.B2 = await readLook(page, o.ids.B); o.A2 = await readLook(page, o.ids.A);
      expect.soft(diffKeys(o.B2, o.B0), `성공 D3: ⌘Z 한 번에 B 가 붙이기 전 모양 ${JSON.stringify({ got: lookOnly(o.B2), want: lookOnly(o.B0) })}`).toEqual([]);
      expect.soft(o.B2 && o.B2.text, '성공 D3: B 글 그대로').toBe(WORDS.B);
      expect.soft(diffKeys(o.A2, o.A0), '성공 D3: A 는 그대로(⌘Z 가 A 꾸밈까지 먹지 않음)').toEqual([]);
      await page.keyboard.press('ControlOrMeta+Shift+z');
      await pollTrue(page, ([s, v]) => getComputedStyle(document.querySelector(s) || document.body).fontSize === v, [tbCe(o.ids.B), o.A0.fontSize], 4000);
      await settle(page);
      o.B3 = await readLook(page, o.ids.B);
      expect.soft(diffKeys(o.B3, o.A0), `성공 D3: ⌘⇧Z 로 B 가 다시 A 꼴 ${JSON.stringify({ got: lookOnly(o.B3), want: lookOnly(o.A0) })}`).toEqual([]);
      tail(o, B);
    } finally { await attach(ti, 'd3.json', o); }
  });

  test('D4 우클릭 메뉴 — 텍스트 블럭에 「스타일 복사 / 스타일 붙여넣기」 · 여백엔 숨김 @d2', async ({ page }, ti) => {
    test.setTimeout(90000);
    const B = await boot(page); const o = {};
    const menuState = () => page.evaluate(() => {
      const m = document.getElementById('block-context-menu');
      const it = (id) => { const e = document.getElementById(id); return e ? { shown: e.style.display !== 'none' && m.style.display !== 'none', disabled: e.getAttribute('aria-disabled'), text: e.textContent.trim(), direct: e.parentElement === m } : null; };
      return { open: !!m && m.style.display === 'block', copy: it('bcm-style-copy'), paste: it('bcm-style-paste') };
    });
    try {
      await scene(page, o);
      // ① A 우클릭(담기 전) — 두 항목 · 붙여넣기 흐림
      await clickBlock(page, o.ids.A, { button: 'right' });
      await pollTrue(page, () => document.getElementById('block-context-menu')?.style.display === 'block', null, 3000);
      o.m1 = await menuState();
      expect.soft(o.m1.open, '성공 D4①: 메뉴가 열렸다').toBe(true);
      expect.soft(o.m1.copy && o.m1.copy.shown && o.m1.copy.direct, `성공 D4①: 「스타일 복사」 보임 ${JSON.stringify(o.m1.copy)}`).toBe(true);
      expect.soft(o.m1.paste && o.m1.paste.shown, `성공 D4①: 「스타일 붙여넣기」 보임 ${JSON.stringify(o.m1.paste)}`).toBe(true);
      expect.soft(o.m1.paste && o.m1.paste.disabled, '성공 D4①: 담기 전 붙여넣기는 흐림').toBe('true');
      // ② 「스타일 복사」 누름
      if (o.m1.copy && o.m1.copy.shown) await page.click('#bcm-style-copy');
      else await page.keyboard.press('Escape');
      await settle(page);
      // ③ B 우클릭 → 붙여넣기 켜짐 → 누름 ⇒ B 모양 = A
      await clickBlock(page, o.ids.B, { button: 'right' });
      await pollTrue(page, () => document.getElementById('block-context-menu')?.style.display === 'block', null, 3000);
      o.m3 = await menuState();
      expect.soft(o.m3.paste && o.m3.paste.disabled, '성공 D4③: 담은 뒤 붙여넣기 켜짐').toBe('false');
      if (o.m3.paste && o.m3.paste.shown) await page.click('#bcm-style-paste');
      await pollTrue(page, ([s, v]) => getComputedStyle(document.querySelector(s)).fontSize === v, [tbCe(o.ids.B), o.A0.fontSize], 4000);
      await settle(page);
      o.B1 = await readLook(page, o.ids.B);
      expectSameLook('D4③ B', o.B1, o.A0, WORDS.B);
      // ④ 여백(텍스트 아님) 우클릭 ⇒ 두 항목 숨김
      pre(await clickBlock(page, o.ids.C), 'C 골라짐(여백 넣기 자리)');
      const gaps0 = await page.evaluate(() => [...document.querySelectorAll('#canvas .gap-block')].map((g) => g.id));
      await page.keyboard.press('g');
      pre(await pollTrue(page, (n) => document.querySelectorAll('#canvas .gap-block').length > n, gaps0.length, 4000), 'G 로 여백 하나');
      await settle(page);
      o.gap = (await page.evaluate(() => [...document.querySelectorAll('#canvas .gap-block')].map((g) => g.id))).find((g) => !gaps0.includes(g));
      const GS = `[id="${o.gap}"]`; await scrollTo(page, GS);
      const gr = await stableTwice(page, GS);
      await clickAt(page, gr.left + gr.width / 2, gr.cy, { sel: GS }, { label: '여백 우클릭', button: 'right' });
      await pollTrue(page, () => document.getElementById('block-context-menu')?.style.display === 'block', null, 3000);
      o.m4 = await menuState();
      pre(o.m4.open, `여백 우클릭에 메뉴가 열렸다(여백 넣기 항목) ${JSON.stringify(o.m4)}`);
      expect.soft(!!(o.m4.copy && o.m4.copy.shown), `성공 D4④: 여백엔 「스타일 복사」 숨김 ${JSON.stringify(o.m4.copy)}`).toBe(false);
      expect.soft(!!(o.m4.paste && o.m4.paste.shown), `성공 D4④: 여백엔 「스타일 붙여넣기」 숨김 ${JSON.stringify(o.m4.paste)}`).toBe(false);
      await page.keyboard.press('Escape');
      tail(o, B);
    } finally { await attach(ti, 'd4.json', o); }
  });

  test('D5 텍스트 아닌 블럭(여백)에 ⌥⌘V ⇒ 무시 @d2', async ({ page }, ti) => {
    test.setTimeout(90000);
    const B = await boot(page); const o = {};
    try {
      await scene(page, o);
      await copyStyleFromA(page, o);
      pre(await clickBlock(page, o.ids.C), 'C 골라짐(여백 넣기 자리)');
      const gaps0 = await page.evaluate(() => [...document.querySelectorAll('#canvas .gap-block')].map((g) => g.id));
      await page.keyboard.press('g');
      pre(await pollTrue(page, (n) => document.querySelectorAll('#canvas .gap-block').length > n, gaps0.length, 4000), 'G 로 여백 하나');
      await settle(page);
      o.gap = (await page.evaluate(() => [...document.querySelectorAll('#canvas .gap-block')].map((g) => g.id))).find((g) => !gaps0.includes(g));
      const GS = `[id="${o.gap}"]`; await scrollTo(page, GS);
      const gr = await stableTwice(page, GS);
      await clickAt(page, gr.left + gr.width / 2, gr.cy, { sel: GS }, { label: '여백 고르기' });
      pre(await pollTrue(page, (id) => !!document.getElementById(id)?.classList.contains('selected'), o.gap, 3000), '여백 골라짐');
      o.sel = await page.evaluate(() => [...document.querySelectorAll('#canvas .text-block.selected')].map((e) => e.id));
      pre(o.sel.length === 0, `텍스트 블럭은 안 골라짐 ${JSON.stringify(o.sel)}`);
      await settle(page);
      o.n0 = await blockCount(page); o.t0 = (await textIds(page)).length; o.h0 = await histTip(page);
      await page.keyboard.press(STYLE_PASTE);
      // 블럭 붙여넣기는 keydown 뒤 30ms 에 돈다 — 가라앉힘(400ms+)이 그 뒤를 덮는다
      await settle(page);
      o.n1 = await blockCount(page); o.t1 = (await textIds(page)).length; o.h1 = await histTip(page);
      o.B1 = await readLook(page, o.ids.B); o.C1 = await readLook(page, o.ids.C);
      expect.soft(o.n1, `성공 D5: 블럭 수 불변 ${o.n0}→${o.n1}`).toBe(o.n0);
      expect.soft(o.t1, `성공 D5: 텍스트 블럭 수 불변 ${o.t0}→${o.t1}`).toBe(o.t0);
      expect.soft(diffKeys(o.B1, o.B0), '성공 D5: B 모양 불변').toEqual([]);
      expect.soft(diffKeys(o.C1, o.C0), '성공 D5: C 모양 불변').toEqual([]);
      expect.soft(o.h1 && o.h1.len, `성공 D5: 이력 칸 불변 ${JSON.stringify({ h0: o.h0, h1: o.h1 })}`).toBe(o.h0 && o.h0.len);
      tail(o, B);
    } finally { await attach(ti, 'd5.json', o); }
  });

  test('R1 회귀(t5-17 꼴) — 스타일을 담아 둔 뒤에도 편집 중 ⌘C/⌘V 는 글만 @d2', async ({ page }, ti) => {
    test.setTimeout(90000);
    const B = await boot(page); const o = {};
    const WORD = 'pha';   // Alpha 의 끝 셋
    try {
      await scene(page, o);
      await copyStyleFromA(page, o);   // 스타일 칸을 채워 둔다 — 보통 붙여넣기가 그것을 집어 오면 안 된다
      pre(await dblBlock(page, o.ids.A), 'A 편집 들어감(글 복사)');
      pre(await caretToEndActive(page), 'A 끝 캐럿');
      for (let i = 0; i < WORD.length; i++) await page.keyboard.press('Shift+ArrowLeft');
      o.copySel = await page.evaluate(() => window.getSelection().toString());
      pre(o.copySel === WORD, `«${WORD}» 골라짐 «${o.copySel}»`);
      await page.keyboard.press('ControlOrMeta+C');
      await page.keyboard.press('Escape');
      pre(await pollTrue(page, (id) => !document.getElementById(id)?.classList.contains('editing'), o.ids.A, 3000), 'A 편집 끝');
      await settle(page);
      pre(await dblBlock(page, o.ids.B), 'B 편집 들어감(붙이기)');
      pre(await caretToEndActive(page), 'B 끝 캐럿');
      await page.keyboard.press('ControlOrMeta+V');
      o.came = await pollTrue(page, ([s, w]) => (document.querySelector(s)?.textContent || '').includes(w), [tbCe(o.ids.B), WORDS.B + WORD], 4000);
      pre(o.came, `B 에 «${WORD}» 가 붙었다`);
      o.parents = await page.evaluate((sel) => {
        const ce = document.querySelector(sel); const out = []; const w = document.createTreeWalker(ce, NodeFilter.SHOW_TEXT); let n;
        while ((n = w.nextNode())) { if (!n.nodeValue.trim()) continue; const cs = getComputedStyle(n.parentElement); out.push({ text: n.nodeValue, fontSize: cs.fontSize, fontWeight: cs.fontWeight, color: cs.color, fontFamily: cs.fontFamily }); }
        return out;
      }, tbCe(o.ids.B));
      await page.keyboard.press('Escape');
      await settle(page);
      o.B1 = await readLook(page, o.ids.B);
      const want = { fontSize: o.B0.fontSize, fontWeight: o.B0.fontWeight, color: o.B0.color, fontFamily: o.B0.fontFamily };
      o.bad = o.parents.filter((p) => p.fontSize !== want.fontSize || p.fontWeight !== want.fontWeight || p.color !== want.color || p.fontFamily !== want.fontFamily);
      expect.soft(o.bad, `성공 R1: 붙은 글자까지 B 모양(짐 모양 0) ${JSON.stringify({ want, parents: o.parents })}`).toEqual([]);
      expect.soft(diffKeys(o.B1, o.B0), '성공 R1: B 블럭 모양 불변').toEqual([]);
      tail(o, B);
    } finally { await attach(ti, 'r1.json', o); }
  });

  test('R2 회귀(t4-12 꼴) — 블럭 ⌘C/⌘V 는 사본 하나 · 붙일 자리 B 모양 불변 @d2', async ({ page }, ti) => {
    test.setTimeout(90000);
    const B = await boot(page); const o = {};
    try {
      await scene(page, o);
      await copyStyleFromA(page, o);   // 스타일 칸을 채워 둔 상태에서도 보통 ⌘V 는 블럭 붙여넣기
      o.t0 = await textIds(page);
      // 블럭 ⌘C/⌘V 갈래는 e.key 소문자('c'/'v')를 본다 — 'V' 로 누르면 e.key 가 대문자라 그 갈래에 안 닿는다(t4-12 spec 과 같은 꼴)
      await page.keyboard.press('ControlOrMeta+c');
      pre(await clickBlock(page, o.ids.B), 'B 골라짐(붙일 자리)');
      await page.keyboard.press('ControlOrMeta+v');
      await pollTrue(page, (n) => document.querySelectorAll('#canvas .text-block').length > n, o.t0.length, 4000);
      await settle(page);
      o.t1 = await textIds(page);
      o.fresh = o.t1.filter((i) => !o.t0.includes(i));
      o.B1 = await readLook(page, o.ids.B);
      expect.soft(o.fresh.length, `성공 R2: 사본 블럭 하나 ${JSON.stringify(o.fresh)}`).toBe(1);
      expect.soft(diffKeys(o.B1, o.B0), `성공 R2: 붙일 자리 B 모양 불변 ${JSON.stringify({ got: lookOnly(o.B1), want: lookOnly(o.B0) })}`).toEqual([]);
      expect.soft(o.B1 && o.B1.text, '성공 R2: B 글 그대로').toBe(WORDS.B);
      tail(o, B);
    } finally { await attach(ti, 'r2.json', o); }
  });

  test('D6 기록 안 된 앞 변경 뒤 붙여넣기 — ⌘Z 한 번은 붙여넣기만 되돌린다(앞 변경은 남는다) @d2', async ({ page }, ti) => {
    test.setTimeout(90000);
    const B = await boot(page); const o = {};
    try {
      await scene(page, o);
      await copyStyleFromA(page, o);
      pre(await clickBlock(page, o.ids.B), 'B 골라짐');
      // 결함 주입 — «이력에 아직 안 찍힌» 앞 변경(C 자간 5px). 블럭 넣기는 insert-history 가 끝 표본을 찍어 이 이음매가 안 생긴다(첫 런 실측 m5 생존).
      await page.evaluate((s) => { document.querySelector(s).style.letterSpacing = '5px'; }, tbCe(o.ids.C));
      await settle(page);
      o.C0x = await readLook(page, o.ids.C);
      pre(o.C0x && o.C0x.letterSpacing === '5px', 'C 자간 5px(기록 안 된 앞 변경)');
      await page.keyboard.press(STYLE_PASTE);
      o.pasted = await pollTrue(page, ([s, v]) => getComputedStyle(document.querySelector(s)).fontSize === v, [tbCe(o.ids.B), o.A0.fontSize], 4000);
      await settle(page);
      pre(o.pasted, 'B 에 붙여넣기가 됐다(크기 52)');
      await page.keyboard.press('ControlOrMeta+z');
      await pollTrue(page, ([s, v]) => getComputedStyle(document.querySelector(s) || document.body).fontSize === v, [tbCe(o.ids.B), o.B0.fontSize], 4000);
      await settle(page);
      o.B1 = await readLook(page, o.ids.B); o.C1 = await readLook(page, o.ids.C);
      expect.soft(diffKeys(o.B1, o.B0), `성공 D6: ⌘Z 한 번에 B 가 붙이기 전 모양 ${JSON.stringify({ got: lookOnly(o.B1), want: lookOnly(o.B0) })}`).toEqual([]);
      expect.soft(o.C1 && o.C1.letterSpacing, '성공 D6: 앞 변경(C 자간 5px)은 ⌘Z 한 번에 같이 사라지지 않는다').toBe('5px');
      tail(o, B);
    } finally { await attach(ti, 'd6.json', o); }
  });

  test('D7 편집 중 ⌥⌘V — 아무 일 없음(ⓑ ⬜) @d2', async ({ page }, ti) => {
    test.setTimeout(90000);
    const B = await boot(page); const o = {};
    try {
      await scene(page, o);
      await copyStyleFromA(page, o);
      pre(await dblBlock(page, o.ids.B), 'B 편집 들어감');
      o.h0 = await histTip(page);
      await page.keyboard.press(STYLE_PASTE);
      await settle(page);
      o.B1 = await readLook(page, o.ids.B);
      o.editing = await page.evaluate((id) => !!document.getElementById(id)?.classList.contains('editing'), o.ids.B);
      o.h1 = await histTip(page);
      expect.soft(o.B1 && o.B1.fontSize, '성공 D7: 편집 중 ⌥⌘V 뒤 B 크기 불변').toBe(o.B0.fontSize);
      expect.soft(o.B1 && o.B1.color, '성공 D7: 편집 중 ⌥⌘V 뒤 B 색 불변').toBe(o.B0.color);
      expect.soft(o.editing, '성공 D7: 편집이 그대로 이어진다').toBe(true);
      expect.soft(o.h1 && o.h1.len, `성공 D7: 이력 칸 불변 ${JSON.stringify({ h0: o.h0, h1: o.h1 })}`).toBe(o.h0 && o.h0.len);
      await page.keyboard.press('Escape');
      tail(o, B);
    } finally { await attach(ti, 'd7.json', o); }
  });

  test('F1 ⌥ 깃발이 굳어도 보통 ⌘C/⌘V 는 블럭 복사/붙여넣기 @d2', async ({ page }, ti) => {
    test.setTimeout(90000);
    const B = await boot(page); const o = {};
    try {
      await scene(page, o);
      // 결함 주입 — ⌥ keyup 을 놓친 상태(editor.js _optionKeyHeld 굳음). 사람 손으로는 창 밖에서 ⌥ 를 뗄 때 난다.
      await page.evaluate(() => { window._optionKeyHeld = true; });
      pre(await clickBlock(page, o.ids.A), 'A 골라짐');
      o.t0 = await textIds(page);
      o.clipBefore = await page.evaluate(() => !!window.hasTextStyleClipboard?.());
      await page.keyboard.press('ControlOrMeta+c');
      pre(await clickBlock(page, o.ids.B), 'B 골라짐(붙일 자리)');
      await page.keyboard.press('ControlOrMeta+v');
      await pollTrue(page, (n) => document.querySelectorAll('#canvas .text-block').length > n, o.t0.length, 4000);
      await settle(page);
      o.flag = await page.evaluate(() => window._optionKeyHeld === true);
      pre(o.flag, '깃발이 런 내내 굳어 있었다');
      o.t1 = await textIds(page);
      o.fresh = o.t1.filter((i) => !o.t0.includes(i));
      o.B1 = await readLook(page, o.ids.B);
      o.clipAfter = await page.evaluate(() => !!window.hasTextStyleClipboard?.());
      expect.soft(o.fresh.length, `성공 F1: ⌘C/⌘V 가 블럭 사본 하나를 만든다 ${JSON.stringify(o.fresh)}`).toBe(1);
      expect.soft(diffKeys(o.B1, o.B0), `성공 F1: B 모양 불변(스타일 붙여넣기로 안 샘) ${JSON.stringify({ got: lookOnly(o.B1), want: lookOnly(o.B0) })}`).toEqual([]);
      expect.soft([o.clipBefore, o.clipAfter], '성공 F1: ⌘C 가 스타일 칸을 채우지 않는다').toEqual([false, false]);
      tail(o, B);
    } finally { await attach(ti, 'f1.json', o); }
  });

  test('F2 정렬을 준 적 없는 원천 — 대상의 명시 정렬·말풍선 발신자 정렬 불변 @d2', async ({ page }, ti) => {
    test.setTimeout(90000);
    const B = await boot(page); const o = {};
    try {
      await scene(page, o);
      o.cInline = await page.evaluate((s) => document.querySelector(s)?.style.textAlign ?? null, tbCe(o.ids.C));
      pre(o.cInline === '', `C 는 정렬을 준 적 없다(인라인 text-align 없음) «${o.cInline}»`);
      pre(await clickBlock(page, o.ids.C), '말풍선 넣기 전 C 고름(그 뒤에 들어간다)');
      o.BB = await insBubble(page);
      o.bb0 = await bubbleAlign(page, o.BB);
      // ① C → A(오른쪽) ⇒ A 오른쪽 그대로
      pre(await clickBlock(page, o.ids.C), 'C 골라짐(스타일 복사)');
      await page.keyboard.press(STYLE_COPY);
      await settle(page);
      pre(await clickBlock(page, o.ids.A), 'A 골라짐');
      await page.keyboard.press(STYLE_PASTE);
      o.pastedA = await pollTrue(page, ([s, v]) => getComputedStyle(document.querySelector(s)).fontSize === v, [tbCe(o.ids.A), o.C0.fontSize], 4000);
      await settle(page);
      pre(o.pastedA, 'A 에 C 스타일이 붙었다(크기)');
      o.A1 = await readLook(page, o.ids.A);
      expect.soft(o.A1 && o.A1.textAlign, '성공 F2①: A 의 명시 정렬(오른쪽)이 그대로').toBe('right');
      // ② C → 말풍선 ⇒ 발신자 정렬·글자칸 정렬 저장값 그대로
      pre(await clickBlock(page, o.BB, { ce: BUB }), '말풍선 골라짐');
      await page.keyboard.press(STYLE_PASTE);
      o.pastedBB = await pollTrue(page, ([s, v]) => getComputedStyle(document.querySelector(s)).fontSize === v, [`[id="${o.BB}"] .tb-bubble`, o.C0.fontSize], 4000);
      await settle(page);
      pre(o.pastedBB, '말풍선에 C 스타일이 붙었다(크기)');
      o.bb1 = await bubbleAlign(page, o.BB);
      expect.soft(o.bb1, `성공 F2②: 말풍선 발신자·글자칸 정렬 저장값 불변 ${JSON.stringify({ before: o.bb0, after: o.bb1 })}`).toEqual(o.bb0);
      tail(o, B);
    } finally { await attach(ti, 'f2.json', o); }
  });

  test('F3 자리표시 상태 원천(손 안 댄 말풍선) — 대상 색이 흐린 색으로 굳지 않는다 @d2', async ({ page }, ti) => {
    test.setTimeout(90000);
    const B = await boot(page); const o = {};
    try {
      await scene(page, o);
      pre(await clickBlock(page, o.ids.C), '말풍선 넣기 전 C 고름(그 뒤에 들어간다)');
      o.BB = await insBubble(page);
      o.src = await page.evaluate((id) => { const ce = document.querySelector(`[id="${id}"] .tb-bubble`); return ce ? { ph: ce.dataset.isPlaceholder || null, inlineColor: ce.style.color, color: getComputedStyle(ce).color, fontSize: getComputedStyle(ce).fontSize } : null; }, o.BB);
      pre(o.src && o.src.ph === 'true' && !o.src.inlineColor, `말풍선이 자리표시 상태 · 인라인 색 없음 ${JSON.stringify(o.src)}`);
      pre(o.src.color !== o.B0.color && o.src.fontSize !== o.B0.fontSize, `원천 색·크기가 B 와 다르다 ${JSON.stringify({ src: o.src, B: lookOnly(o.B0) })}`);
      pre(await clickBlock(page, o.BB, { ce: BUB }), '말풍선 골라짐(스타일 복사)');
      await page.keyboard.press(STYLE_COPY);
      await settle(page);
      pre(await clickBlock(page, o.ids.B), 'B 골라짐');
      await page.keyboard.press(STYLE_PASTE);
      o.pasted = await pollTrue(page, ([s, v]) => getComputedStyle(document.querySelector(s)).fontSize === v, [tbCe(o.ids.B), o.src.fontSize], 4000);
      await settle(page);
      pre(o.pasted, 'B 에 말풍선 스타일이 붙었다(크기)');
      o.B1 = await readLook(page, o.ids.B);
      expect.soft(o.B1 && o.B1.color, `성공 F3: B 색은 그대로(흐린 자리표시 색 ${o.src.color} 이 안 굳는다)`).toBe(o.B0.color);
      tail(o, B);
    } finally { await attach(ti, 'f3.json', o); }
  });
});
