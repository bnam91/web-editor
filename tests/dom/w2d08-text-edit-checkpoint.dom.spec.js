// W2D-08 — 인라인 글 편집이 «끝 표본»을 남기는가(js/CLAUDE.md 양쪽 끝 · reports/S3-W2D08-FIX.md 처방 ㉮).
// 장면은 앱 제 문(메뉴 넣기 · 마우스 클릭/dblclick · 키보드)만 쓴다. page.evaluate 는 읽기·스크롤만.
// 수 = window.getHistoryTip() 의 pos·len(히스토리 스택 자체) + 블럭 글/HTML.
// 단언 머리: «장면 미성립:» = 전제(빨강이면 결함이 아니라 장면이 안 섰다) · «성공:» = 제품 판정.
// 양성대조: GD1001_ROOT=<002d9725 핀> EXPECT_SHA=002d9725… 로 돌리면 E1·E3a·E3b·E4·E5·E5b·E7·F 의 «성공:» 줄이 빨강,
//   E2·E6·F2·B0 은 초록이어야 한다. 고친 판(커밋 뒤)은 전부 초록.
// 파일 쓰기 없음(testInfo.attach 만) · 고정 대기 없음.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { ROOT, waitStableRect } = require('./_root-harness.js');

test.describe.configure({ retries: 0 });
const ORIGIN = 'http://goditor.dom.test';
const VIEW = { width: 1440, height: 900 };
const MIME = { '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
const T_MS = 120000;
const EXPECT_SHA = process.env.EXPECT_SHA || '';
const IDENT_FILES = ['js/block-drag.js', 'js/history.js'];
const sha1 = (b) => crypto.createHash('sha1').update(b).digest('hex');
const reExact = (s) => new RegExp('^\\s*' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$');

async function boot(page) {
  const B = { errs: [], cerr: [] };
  page.on('pageerror', e => B.errs.push(String(e).slice(0, 300)));
  page.on('console', m => { if (m.type() === 'error') B.cerr.push(m.text().slice(0, 300)); });
  page.on('dialog', d => { d.dismiss().catch(() => {}); });
  await page.setViewportSize(VIEW);
  await page.addInitScript(() => Object.defineProperty(window, 'COLLAB_ENABLED', { configurable: true, get: () => false, set: () => {} }));
  await page.addInitScript(() => { window.electronAPI = new Proxy({}, { get: () => (() => Promise.resolve(null)) }); });
  await page.addInitScript(() => { window.prompt = () => { throw new Error('prompt() is not supported.'); }; });
  await page.route('**/*', async (r) => {
    const url = r.request().url();
    if (!url.startsWith(ORIGIN + '/')) return r.abort();
    const u = new URL(url); const f = path.join(ROOT, decodeURIComponent(u.pathname));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
  });
  await page.goto(`${ORIGIN}/index.html`);
  await page.waitForFunction(() => typeof window.rebindAll === 'function' && typeof window.getHistoryTip === 'function' && typeof window.serializeProject === 'function', null, { timeout: 30000 });
  expect(await page.evaluate(() => window.COLLAB_ENABLED), '장면 미성립: P0 COLLAB off (window.COLLAB_ENABLED === false)').toBe(false);
  await page.evaluate(() => {
    window.__w08norm = () => {
      const p = JSON.parse(window.serializeProject()); const pg = (p.pages || []).find(x => x.id === p.currentPageId) || (p.pages || [])[0] || {};
      return String(pg.canvas || '');
    };
  });
  return B;
}
async function pollTrue(page, fn, arg, timeout = 6000) {
  try { await page.waitForFunction(fn, arg, { timeout, polling: 100 }); return true; } catch { return false; }
}
async function settle(page, timeout = 8000) {
  await page.evaluate(() => { window.__w08last = null; });
  return pollTrue(page, () => { const s = window.__w08norm(); const ok = s === window.__w08last; window.__w08last = s; return ok; }, null, timeout);
}
async function stableTwice(page, sel) {
  const a = await waitStableRect(page, sel); const b = await waitStableRect(page, sel);
  return { ...b, twiceSame: a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height };
}
async function softClick(page, x, y, sel, { dbl = false, not = null } = {}) {
  const hit = await page.evaluate(([x, y, sel, not]) => { const e = document.elementFromPoint(x, y); if (!e) return { ok: false, hit: null };
    const desc = (e.id ? '#' + e.id : '') + '.' + String(e.className?.baseVal ?? e.className ?? e.tagName).split(' ').slice(0, 2).join('.');
    let ok = sel ? !!(e.matches(sel) || e.closest(sel)) : true; if (ok && not) ok = !(e.matches(not) || e.closest(not)); return { ok, hit: desc }; }, [x, y, sel, not]);
  if (!hit.ok) return hit;
  if (dbl) await page.mouse.dblclick(x, y); else await page.mouse.click(x, y);
  return hit;
}
const scrollTo = (page, sel) => page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center', behavior: 'instant' }), sel);
const secIds = (page) => page.evaluate(() => [...document.querySelectorAll('#canvas .section-block:not([data-ghost])')].map(s => s.id));
const tip = (page) => page.evaluate(() => { const t = window.getHistoryTip(); return { pos: t.pos, len: t.len, seq: t.seq, action: t.action }; });
const d = (a, b) => ({ dLen: b.len - a.len, dPos: b.pos - a.pos });
const blk = (page, id) => page.evaluate((id) => { const b = document.getElementById(id); const ed = b?.querySelector('[contenteditable]');
  return { exists: !!b, text: ed ? ed.textContent : null, html: ed ? ed.innerHTML : null, isPh: ed?.dataset?.isPlaceholder ?? null,
    blank: (ed?.dataset?.blank ?? null) || (b?.dataset?.blank ?? null), editing: !!b?.classList.contains('editing'),
    underline: !!ed?.querySelector('u, [style*="underline"]'), bold: !!ed?.querySelector('b, strong, [style*="font-weight"]') }; }, id);

async function pickSec(page, id) {
  const SEC = `[id="${id}"]`; await scrollTo(page, SEC); const hz = await stableTwice(page, SEC + ' .section-hitzone');
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await softClick(page, hz.left + 20, hz.cy, SEC + ' .section-hitzone');
  return pollTrue(page, (id) => window.getSelectedSection?.()?.id === id && !!document.getElementById(id)?.classList.contains('selected'), id, 3000);
}
async function newSection(page) {
  const before = await secIds(page);
  await page.click('.fp-btn.primary[title="새 섹션 추가"]');
  await pollTrue(page, (n) => document.querySelectorAll('#canvas .section-block:not([data-ghost])').length > n, before.length);
  const id = (await secIds(page)).find(x => !before.includes(x)) || null;
  expect(id, '장면 미성립: 새 섹션이 생겼다').toBeTruthy();
  let picked = await page.evaluate((id) => window.getSelectedSection?.()?.id === id, id);
  if (!picked) picked = await pickSec(page, id);
  expect(picked, '장면 미성립: 새 섹션이 골라졌다').toBe(true);
  await settle(page);
  return id;
}
async function insertHeading(page) {
  await page.evaluate(() => document.querySelectorAll('.text-block').forEach(e => { e.__w08Seen = true; }));
  await page.click('#fp-text-dropdown .fp-dropdown-trigger');
  await page.locator('#fp-text-menu .fp-menu-item').filter({ hasText: reExact('Heading') }).first().click();
  await pollTrue(page, () => [...document.querySelectorAll('.text-block')].some(e => !e.__w08Seen));
  await settle(page);
  const id = await page.evaluate(() => [...document.querySelectorAll('.text-block')].find(e => !e.__w08Seen)?.id || null);
  expect(id, '장면 미성립: Heading 블럭이 생겼다').toBeTruthy();
  return id;
}
// 새 섹션 → Heading 넣기 → 넣은 직후 값
async function setup(page) {
  const sid = await newSection(page);
  const id = await insertHeading(page);
  const b = await blk(page, id);
  expect(b.isPh, '장면 미성립: 넣은 Heading 은 자리표시로 태어난다').toBe('true');
  return { sid, id, text0: b.text, html0: b.html, t1: await tip(page) };
}
const editingIn = (page, id) => pollTrue(page, (id) => { const a = document.activeElement; return !!(a && a.isContentEditable && document.getElementById(id)?.contains(a)); }, id, 3000);
// 한 번 눌러 고르고 → dblclick 으로 편집 진입
async function enterDbl(page, id) {
  const BS = `[id="${id}"]`; await scrollTo(page, BS);
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  const r = await stableTwice(page, BS);
  const h1 = await softClick(page, r.cx, r.cy, BS); await settle(page);
  expect(h1.ok, `장면 미성립: 블럭 한 번 누름이 그 블럭에 닿았다 (${h1.hit})`).toBe(true);
  const r2 = await stableTwice(page, BS);
  const h2 = await softClick(page, r2.cx, r2.cy, BS, { dbl: true });
  expect(h2.ok, `장면 미성립: dblclick 이 그 블럭에 닿았다 (${h2.hit})`).toBe(true);
  expect(await editingIn(page, id), '장면 미성립: dblclick 뒤 그 블럭 글자칸에 초점').toBe(true);
}
// 캔버스 빈 곳 누르기(Escape 없이)
async function clickEmpty(page) {
  const pt = await page.evaluate(() => { const w = document.getElementById('canvas-wrap').getBoundingClientRect(); const s = document.querySelector('#canvas .section-block:not([data-ghost])');
    if (!s) return null; const r = s.getBoundingClientRect(); const x = Math.max(w.left + 10, r.left - 40); const y = Math.min(Math.max(w.top + 60, r.top + 40), w.bottom - 40); return { x, y }; });
  expect(pt, '장면 미성립: 빈 곳 좌표').toBeTruthy();
  const hit = await softClick(page, pt.x, pt.y, '#canvas-wrap', { not: '.section-block, .fp-dropdown, #floating-panel' });
  expect(hit.ok, `장면 미성립: 빈 곳 누름이 캔버스 빈 곳에 닿았다 (${hit.hit})`).toBe(true);
}
// 편집 떠나기 = Escape(blur) → 빈 곳 누르기 → 가라앉힘
async function leave(page, id) {
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await clickEmpty(page); await settle(page);
  expect((await blk(page, id)).editing, '장면 미성립: 떠난 뒤 .editing 이 풀렸다').toBe(false);
}
async function undo1(page) { await page.keyboard.press('Meta+z'); await settle(page); }
function rec(ti, B, o) {
  return ti.attach('w08-record', { body: JSON.stringify({ root: ROOT, ...o, errs: B.errs.slice(0, 10), cerr: B.cerr.slice(0, 10) }, null, 1), contentType: 'application/json' });
}
// 편집 하나 → 떠남 → ⌘Z 1번 공통 판정(끝 표본 +1 · ⌘Z 구제 0 · 넣은 직후 글로)
async function oneEditUndo(page, o, label) {
  o.tPre = await tip(page);
  await leave(page, o.id);
  o.b2 = await blk(page, o.id); o.t2 = await tip(page);
  o.leaveD = d(o.tPre, o.t2);
  return o;
}
async function judgeUndo(page, o, label, wantText) {
  await undo1(page);
  o.b3 = await blk(page, o.id); o.t3 = await tip(page); o.undoD = d(o.t2, o.t3);
  expect([o.undoD.dLen, o.undoD.dPos], `성공: ${label} ⌘Z 1번 = 구제 칸 없이 한 칸 아래 [Δlen,Δpos] (구제면 [1,0])`).toEqual([0, -1]);
  expect(o.b3.exists, `성공: ${label} ⌘Z 뒤 블럭 유지`).toBe(true);
  expect(o.b3.text, `성공: ${label} ⌘Z 1번 = 편집 전 글`).toBe(wantText);
}

test('B0 판 정체 — HEAD 와 서빙 파일이 EXPECT_SHA', async ({ page }, ti) => {
  test.setTimeout(T_MS);
  expect(EXPECT_SHA, '장면 미성립: EXPECT_SHA 없음').toMatch(/^[0-9a-f]{40}$/);
  const B = await boot(page);
  const head = execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD']).toString().trim();
  const files = {};
  for (const f of IDENT_FILES) {
    const want = sha1(execFileSync('git', ['-C', ROOT, 'show', `${EXPECT_SHA}:${f}`]));
    const b64 = await page.evaluate(async (u) => { const a = new Uint8Array(await (await fetch(u, { cache: 'no-store' })).arrayBuffer());
      let bin = ''; for (let i = 0; i < a.length; i += 0x8000) bin += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(bin); }, `${ORIGIN}/${f}`);
    files[f] = { git: want, page: sha1(Buffer.from(b64, 'base64')) };
  }
  await rec(ti, B, { cell: 'B0', head, expect: EXPECT_SHA, files });
  expect(head, '장면 미성립: ROOT HEAD === EXPECT_SHA').toBe(EXPECT_SHA);
  for (const f of IDENT_FILES) expect(files[f].page, `장면 미성립: 서빙 ${f} sha1 === git ${EXPECT_SHA.slice(0, 8)}:${f}`).toBe(files[f].git);
});

const REAL = '진짜 제목';

test('E1 진짜 글 Heading — 쓰기도 지우기도 제 칸 · ⌘Z 1번에 진짜 제목', async ({ page }, ti) => {
  test.setTimeout(T_MS);
  const B = await boot(page); const o = { cell: 'E1' };
  try {
    Object.assign(o, await setup(page));
    await enterDbl(page, o.id);
    await page.keyboard.press('Meta+a'); await page.keyboard.type(REAL);
    o.tA = await tip(page);
    await leave(page, o.id);
    o.bA = await blk(page, o.id); o.tA2 = await tip(page); o.leave1 = d(o.tA, o.tA2);
    expect(o.bA.text, '장면 미성립: 진짜 제목이 써졌다').toBe(REAL);
    expect([o.leave1.dLen, o.leave1.dPos], '성공: E1 쓴 뒤 떠남 = 끝 표본 한 칸 [Δlen,Δpos]').toEqual([1, 1]);
    await enterDbl(page, o.id);
    await page.keyboard.press('Meta+a'); await page.keyboard.press('Delete');
    o.tB = await tip(page);
    await leave(page, o.id);
    o.b2 = await blk(page, o.id); o.t2 = await tip(page); o.leave2 = d(o.tB, o.t2);
    expect(o.b2.isPh, '장면 미성립: 다 지운 뒤 자리표시로 되써짐').toBe('true');
    expect([o.leave2.dLen, o.leave2.dPos], '성공: E1 지운 뒤 떠남 = 끝 표본 한 칸 [Δlen,Δpos]').toEqual([1, 1]);
    await judgeUndo(page, o, 'E1', REAL);
  } finally { await rec(ti, B, o); }
});

test('E2 자리표시 Heading 다 지움 — 현 동작 고정 — 현빈 결정 대기', async ({ page }, ti) => {
  test.setTimeout(T_MS);
  const B = await boot(page); const o = { cell: 'E2' };
  try {
    Object.assign(o, await setup(page));
    await enterDbl(page, o.id);
    await page.keyboard.press('Meta+a'); await page.keyboard.press('Delete');
    await oneEditUndo(page, o, 'E2');
    expect(o.b2.isPh, '장면 미성립: 자리표시로 되써짐').toBe('true');
    expect(o.b2.text, '장면 미성립: 되써진 글 = 넣은 직후 글').toBe(o.text0);
    expect([o.leaveD.dLen, o.leaveD.dPos], '성공: E2 떠남 = 무변화라 칸 없음 [Δlen,Δpos]').toEqual([0, 0]);
    await undo1(page);
    o.b3 = await blk(page, o.id); o.t3 = await tip(page); o.undoD = d(o.t2, o.t3);
    expect([o.undoD.dLen, o.undoD.dPos], '성공: E2 ⌘Z 1번 [Δlen,Δpos] (현 동작)').toEqual([0, -1]);
    expect(o.b3.exists, '성공: E2 ⌘Z 1번 = 넣기 전(블럭 없음 · 현 동작 고정)').toBe(false);
  } finally { await rec(ti, B, o); }
});

test('E3a 자리표시 Heading 끝에 덧쓰기 — 끝 표본 · ⌘Z 1번에 넣은 직후 글', async ({ page }, ti) => {
  test.setTimeout(T_MS);
  const B = await boot(page); const o = { cell: 'E3a' };
  try {
    Object.assign(o, await setup(page));
    await enterDbl(page, o.id);
    await page.keyboard.press('ArrowRight'); await page.keyboard.type('가나다');
    await oneEditUndo(page, o, 'E3a');
    expect(o.b2.text, '장면 미성립: 덧쓴 글').toBe(o.text0 + '가나다');
    expect([o.leaveD.dLen, o.leaveD.dPos], '성공: E3a 떠남 = 끝 표본 한 칸 [Δlen,Δpos]').toEqual([1, 1]);
    await judgeUndo(page, o, 'E3a', o.text0);
  } finally { await rec(ti, B, o); }
});

test('E3b 자리표시 Heading 갈아쓰기 — 끝 표본 · ⌘Z 1번에 넣은 직후 글', async ({ page }, ti) => {
  test.setTimeout(T_MS);
  const B = await boot(page); const o = { cell: 'E3b' };
  try {
    Object.assign(o, await setup(page));
    await enterDbl(page, o.id);
    await page.keyboard.press('Meta+a'); await page.keyboard.type('새 제목');
    await oneEditUndo(page, o, 'E3b');
    expect(o.b2.text, '장면 미성립: 갈아쓴 글').toBe('새 제목');
    expect([o.leaveD.dLen, o.leaveD.dPos], '성공: E3b 떠남 = 끝 표본 한 칸 [Δlen,Δpos]').toEqual([1, 1]);
    await judgeUndo(page, o, 'E3b', o.text0);
  } finally { await rec(ti, B, o); }
});

test('E4 다 지움 뒤 Enter 로 data-blank — 끝 표본 · ⌘Z 1번에 넣은 직후 글', async ({ page }, ti) => {
  test.setTimeout(T_MS);
  const B = await boot(page); const o = { cell: 'E4' };
  try {
    Object.assign(o, await setup(page));
    await enterDbl(page, o.id);
    await page.keyboard.press('Meta+a'); await page.keyboard.press('Delete'); await page.keyboard.press('Enter');
    await oneEditUndo(page, o, 'E4');
    expect(o.b2.blank, '장면 미성립: 떠난 뒤 data-blank=true').toBe('true');
    expect([o.leaveD.dLen, o.leaveD.dPos], '성공: E4 떠남 = 끝 표본 한 칸 [Δlen,Δpos]').toEqual([1, 1]);
    await judgeUndo(page, o, 'E4', o.text0);
    expect(o.b3.isPh, '성공: E4 ⌘Z 1번 = 자리표시로(두 칸 아님)').toBe('true');
  } finally { await rec(ti, B, o); }
});

// 편집 중 패널 크기 칸을 눌러 «세운다»(parkEditing)
async function park(page, o) {
  await page.click('#txt-size-number');
  const parked = await page.evaluate((id) => {
    const f = window.__textSelection?.isEditingParked;
    const editing = !!document.getElementById(id)?.classList.contains('editing');
    if (typeof f === 'function') return { how: 'isEditingParked', ok: f() === true && editing };
    return { how: 'activeElement', ok: document.activeElement?.id === 'txt-size-number' && editing };
  }, o.id);
  o.parked = parked;
  expect(parked.ok, `장면 미성립: 패널 칸을 눌러 편집이 세워졌다 (${parked.how})`).toBe(true);
  o.tPark = await tip(page);
}

test('E5 패널 칸으로 세운 뒤 빈 곳 — 한 제스처에 끝 표본 한 칸', async ({ page }, ti) => {
  test.setTimeout(T_MS);
  const B = await boot(page); const o = { cell: 'E5' };
  try {
    Object.assign(o, await setup(page));
    await enterDbl(page, o.id);
    o.tE = await tip(page);
    await page.keyboard.press('Meta+a'); await page.keyboard.type('새 제목');
    await park(page, o);
    o.parkD = d(o.tE, o.tPark);
    expect([o.parkD.dLen, o.parkD.dPos], '성공: E5 세움 자체는 칸을 안 만든다 [Δlen,Δpos]').toEqual([0, 0]);
    await clickEmpty(page); await settle(page);
    o.b2 = await blk(page, o.id); o.t2 = await tip(page); o.leaveD = d(o.tE, o.t2);
    expect(o.b2.editing, '장면 미성립: 빈 곳 누른 뒤 .editing 이 풀렸다').toBe(false);
    expect(o.b2.text, '장면 미성립: 갈아쓴 글').toBe('새 제목');
    expect([o.leaveD.dLen, o.leaveD.dPos], '성공: E5 진입→세움→빈 곳 = 끝 표본 정확히 한 칸 [Δlen,Δpos]').toEqual([1, 1]);
    await judgeUndo(page, o, 'E5', o.text0);
  } finally { await rec(ti, B, o); }
});

test('E5b 세운 뒤 같은 글자칸으로 돌아와 Esc — 끝 표본 한 칸', async ({ page }, ti) => {
  test.setTimeout(T_MS);
  const B = await boot(page); const o = { cell: 'E5b' };
  try {
    Object.assign(o, await setup(page));
    await enterDbl(page, o.id);
    o.tE = await tip(page);
    await page.keyboard.press('Meta+a'); await page.keyboard.type('새 제목');
    await park(page, o);
    const ED = `[id="${o.id}"] [contenteditable]`;
    const r = await stableTwice(page, ED);
    const h = await softClick(page, r.cx, r.cy, ED);
    expect(h.ok, `장면 미성립: 같은 글자칸 누름이 닿았다 (${h.hit})`).toBe(true);
    expect(await editingIn(page, o.id), '장면 미성립: 같은 글자칸으로 초점이 돌아왔다').toBe(true);
    o.tBack = await tip(page);
    await leave(page, o.id);
    o.b2 = await blk(page, o.id); o.t2 = await tip(page); o.leaveD = d(o.tE, o.t2);
    expect(o.b2.text, '장면 미성립: 갈아쓴 글').toBe('새 제목');
    expect([o.leaveD.dLen, o.leaveD.dPos], '성공: E5b 진입→세움→복귀→떠남 = 끝 표본 정확히 한 칸 [Δlen,Δpos]').toEqual([1, 1]);
    await judgeUndo(page, o, 'E5b', o.text0);
  } finally { await rec(ti, B, o); }
});

test('E6 진입만 하고 안 고침 — 자리표시 Heading 과 진짜 글 Heading 모두 칸 없음', async ({ page }, ti) => {
  test.setTimeout(T_MS);
  const B = await boot(page); const o = { cell: 'E6' };
  try {
    Object.assign(o, await setup(page));
    await enterDbl(page, o.id);
    o.tP = await tip(page);
    await leave(page, o.id);
    o.tP2 = await tip(page); o.leaveP = d(o.tP, o.tP2);
    expect((await blk(page, o.id)).text, '장면 미성립: 자리표시 그대로').toBe(o.text0);
    expect([o.leaveP.dLen, o.leaveP.dPos], '성공: E6 자리표시 Heading 진입만 → 떠남 칸 없음 [Δlen,Δpos]').toEqual([0, 0]);
    // 진짜 글 Heading 으로 만든 뒤(이 단계의 칸 수는 E1 이 잰다) 진입만 하고 떠난다
    await enterDbl(page, o.id);
    await page.keyboard.press('Meta+a'); await page.keyboard.type(REAL);
    await leave(page, o.id);
    expect((await blk(page, o.id)).text, '장면 미성립: 진짜 제목이 써졌다').toBe(REAL);
    await enterDbl(page, o.id);
    o.tR = await tip(page);
    await leave(page, o.id);
    o.tR2 = await tip(page); o.leaveR = d(o.tR, o.tR2);
    expect((await blk(page, o.id)).text, '장면 미성립: 진짜 제목 그대로').toBe(REAL);
    expect([o.leaveR.dLen, o.leaveR.dPos], '성공: E6 진짜 글 Heading 진입만 → 떠남 칸 없음 [Δlen,Δpos]').toEqual([0, 0]);
  } finally { await rec(ti, B, o); }
});

test('E7 블럭 고른 뒤 Enter 로 진입 — 끝 표본 · ⌘Z 1번에 넣은 직후 글', async ({ page }, ti) => {
  test.setTimeout(T_MS);
  const B = await boot(page); const o = { cell: 'E7' };
  try {
    Object.assign(o, await setup(page));
    const BS = `[id="${o.id}"]`; await scrollTo(page, BS);
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    const r = await stableTwice(page, BS);
    const h = await softClick(page, r.cx, r.cy, BS); await settle(page);
    expect(h.ok, `장면 미성립: 블럭 한 번 누름이 닿았다 (${h.hit})`).toBe(true);
    expect(await pollTrue(page, (id) => !!document.getElementById(id)?.classList.contains('selected'), o.id, 3000), '장면 미성립: 블럭이 골라졌다').toBe(true);
    await page.keyboard.press('Enter');
    expect(await editingIn(page, o.id), '장면 미성립: Enter 뒤 그 블럭 글자칸에 초점').toBe(true);
    await page.keyboard.type('새 제목');
    await oneEditUndo(page, o, 'E7');
    expect(o.b2.text, '장면 미성립: 갈아쓴 글').toBe('새 제목');
    expect([o.leaveD.dLen, o.leaveD.dPos], '성공: E7 떠남 = 끝 표본 한 칸 [Δlen,Δpos]').toEqual([1, 1]);
    await judgeUndo(page, o, 'E7', o.text0);
  } finally { await rec(ti, B, o); }
});

// ABC DEF 를 써서 굳히고 → 다시 진입 → 끝으로 → 뒤 세 글자 고르기
const ABC = 'ABC DEF';
async function commitAbcAndSelectTail(page, o) {
  await enterDbl(page, o.id);
  await page.keyboard.press('Meta+a'); await page.keyboard.type(ABC);
  await leave(page, o.id);
  expect((await blk(page, o.id)).text, '장면 미성립: ABC DEF 가 써졌다').toBe(ABC);
  await enterDbl(page, o.id);
  o.tE = await tip(page);
  for (let i = 0; i < ABC.length + 3; i++) await page.keyboard.press('ArrowRight');
  for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowLeft');
  const sel = await page.evaluate(() => String(window.getSelection()));
  expect(sel, '장면 미성립: 뒤 세 글자 DEF 가 골라졌다').toBe('DEF');
}

test('F 서식만 바뀐 편집(⌘U 밑줄) — 끝 표본 · ⌘Z 1번에 밑줄 없음', async ({ page }, ti) => {
  test.setTimeout(T_MS);
  const B = await boot(page); const o = { cell: 'F' };
  try {
    Object.assign(o, await setup(page));
    await commitAbcAndSelectTail(page, o);
    await page.keyboard.press('Meta+u');
    o.tU = await tip(page); o.uD = d(o.tE, o.tU);
    const bu = await blk(page, o.id);
    expect(bu.underline, '장면 미성립: ⌘U 로 밑줄이 생겼다').toBe(true);
    expect(bu.text, '장면 미성립: 글은 그대로').toBe(ABC);
    expect([o.uD.dLen, o.uD.dPos], '장면 미성립: ⌘U 는 스스로 칸을 안 만든다(이 칸의 전제)').toEqual([0, 0]);
    await oneEditUndo(page, o, 'F');
    expect([o.leaveD.dLen, o.leaveD.dPos], '성공: F 서식만 바뀐 떠남 = 끝 표본 한 칸 [Δlen,Δpos]').toEqual([1, 1]);
    await judgeUndo(page, o, 'F', ABC);
    expect(o.b3.underline, '성공: F ⌘Z 1번 = 밑줄 없음').toBe(false);
  } finally { await rec(ti, B, o); }
});

test('F2 편집 중 ⌘B 는 제 칸 · 떠남은 더하지 않음 · ⌘Z 1번에 굵게 없음', async ({ page }, ti) => {
  test.setTimeout(T_MS);
  const B = await boot(page); const o = { cell: 'F2' };
  try {
    Object.assign(o, await setup(page));
    await commitAbcAndSelectTail(page, o);
    o.bBefore = await blk(page, o.id);
    expect(o.bBefore.bold, '장면 미성립: ⌘B 전 굵게 없음').toBe(false);
    await page.keyboard.press('Meta+b');
    o.tB = await tip(page); o.bD = d(o.tE, o.tB);
    expect((await blk(page, o.id)).bold, '장면 미성립: ⌘B 로 굵게').toBe(true);
    expect([o.bD.dLen, o.bD.dPos], '성공: F2 ⌘B 자기 칸 한 칸 [Δlen,Δpos]').toEqual([1, 1]);
    await oneEditUndo(page, o, 'F2');
    expect([o.leaveD.dLen, o.leaveD.dPos], '성공: F2 떠남은 칸을 더하지 않는다 [Δlen,Δpos]').toEqual([0, 0]);
    o.totalD = d(o.tE, o.t2);
    expect([o.totalD.dLen, o.totalD.dPos], '성공: F2 진입→⌘B→떠남 합 한 칸 [Δlen,Δpos]').toEqual([1, 1]);
    await judgeUndo(page, o, 'F2', ABC);
    expect(o.b3.bold, '성공: F2 ⌘Z 1번 = 굵게 없음').toBe(false);
  } finally { await rec(ti, B, o); }
});
