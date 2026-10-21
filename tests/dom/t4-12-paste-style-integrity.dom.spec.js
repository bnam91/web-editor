// t4-12 — 붙여넣기 뒤 «서식이 어느 블럭에 가나» (현빈 수지맥 «복사해온 원본 스타일까지 바뀜»).
// 판 A 측정(핀 f7355b4e ×3): ⌘V 뒤 우측 패널이 사본으로 안 넘어가 패널 조작이 원본 A(P1) 또는 붙일 자리 B(P2)에 썼다.
// 고침: js/editor.js _panelFollowsPasted — 붙여넣기·⌘D 꼬리에서 고른 사본이 1개면 openPanelForBlock, 아니면 페이지 패널.
// 시험 8개(--grep @t412 → Running 8): B0(EXPECT_SHA 있을 때만) · P1-size · P1-weight · P1-color · P2 · P3 · P4 · P5.
//   양성대조 기대(핀 f7355b4e): P1×3 · P2 · P5 빨강 / P3 · P4 초록 · B0 초록(EXPECT_SHA=f7355b4e 일 때).
// 돌리는 법:
//   bash ~/taeyang-098/run-test.sh dom tests/dom/t4-12-paste-style-integrity.dom.spec.js --grep @t412
//   판 정체까지: GD1001_ROOT=<판 체크아웃> EXPECT_SHA=<그 판 풀 sha> 를 앞에 붙인다(없으면 B0 은 건너뛴다).
// 규칙:
//  - 장면은 앱 제 문(섹션 추가 단추 · 플로팅 텍스트 메뉴 · 섹션 꼬리표 · 캔버스 클릭 · 패널 칸 · 키보드)으로만 짓는다.
//    생성 함수(addTextBlock 등 add·make 계열) evaluate 직접 호출 0. evaluate 는 읽기 · scrollIntoView · 캐럿 놓기 · 합성 paste 이벤트만.
//  - 고정 대기 0줄 — 기다림은 waitForFunction(polling) / expect.poll / 하네스 waitStableRect 뿐.
//  - 캔버스 클릭은 _click-at.js clickAt(맞힌 요소 단언). 성공 칸은 expect.soft, 전제는 hard.
//  - 파일 쓰기 0 — 잰 값은 testInfo.attach 로만 남긴다.
//  - 블록 주석을 쓰지 않는다 — 줄 주석만.
const { test, expect } = require('@playwright/test');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { ROOT, ORIGIN, bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

const VIEW = { width: 1500, height: 1000 };
const EXPECT_SHA = process.env.EXPECT_SHA || '';
// 이 고침이 만지는 제품 파일 — B0 이 페이지가 실제로 받은 바이트를 git blob 과 맞춘다
const IDENT_FILES = ['js/editor.js'];
const sha1 = (b) => crypto.createHash('sha1').update(b).digest('hex');
const blobSha1 = (buf) => sha1(Buffer.concat([Buffer.from('blob ' + buf.length + '\0'), buf]));

async function attach(ti, name, o) {
  await ti.attach(name, { body: JSON.stringify(o, null, 1), contentType: 'application/json' });
}

// ── 띄우기 ──
async function boot(page) {
  const cerr = [];
  page.on('console', m => { if (m.type() === 'error') cerr.push(m.text().slice(0, 300)); });
  page.on('dialog', d => { d.dismiss().catch(() => {}); });
  await page.setViewportSize(VIEW);
  const errs = await bootApp(page);
  return { errs, cerr };
}
function errsOf(B) { return { pageerror: B.errs.slice(0, 20).map(s => String(s).slice(0, 300)), consoleError: B.cerr.slice(0, 20) }; }

async function pollTrue(page, fn, arg, timeout = 6000) {
  try { await page.waitForFunction(fn, arg, { timeout, polling: 100 }); return true; } catch { return false; }
}
// 가라앉힘 — 캔버스 innerHTML · 선택 id · 패널 머리(id·이름)가 연달아 4번(100ms 간격) 같을 때까지
async function settle(page, timeout = 8000) {
  await page.evaluate(() => { window.__t412Last = null; window.__t412N = 0; });
  return pollTrue(page, () => {
    const c = document.getElementById('canvas');
    const r = document.querySelector('#panel-right');
    const s = (c ? c.innerHTML : '') + '|' + [...document.querySelectorAll('#canvas .selected')].map(e => e.id).join(',')
      + '|' + (r?.querySelector('.prop-block-id')?.dataset?.copyId || '') + '|' + (r?.querySelector('.prop-block-name')?.textContent || '');
    if (s === window.__t412Last) window.__t412N++; else { window.__t412Last = s; window.__t412N = 0; }
    return window.__t412N >= 4;
  }, null, timeout);
}
async function stableTwice(page, sel, index = 0) {
  const a = await waitStableRect(page, sel, { index }); const b = await waitStableRect(page, sel, { index });
  return { ...b, twiceSame: a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height };
}
async function scrollTo(page, sel) { await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center', behavior: 'instant' }), sel); }
const secIds = (page) => page.evaluate(() => [...document.querySelectorAll('#canvas .section-block:not([data-ghost])')].map(s => s.id));
const textIds = (page) => page.evaluate(() => [...document.querySelectorAll('#canvas .text-block')].map(t => t.id));
const selectedIds = (page) => page.evaluate(() => [...document.querySelectorAll('#canvas .selected')].map(e => e.id));

async function panelRead(page) {
  return page.evaluate(() => {
    const r = document.querySelector('#panel-right'); const idEl = r?.querySelector('.prop-block-id');
    const v = (s) => { const e = document.getElementById(s); return e ? e.value : null; };
    return {
      copyId: idEl?.dataset?.copyId || null, idText: idEl?.textContent?.trim() || null,
      name: r?.querySelector('.prop-block-name')?.textContent?.trim() || null,
      size: v('txt-size-number'), weight: v('txt-font-weight'), hex: v('txt-color-hex'),
      hasSize: !!document.getElementById('txt-size-number'),
    };
  });
}
const targetIs = (copyId, ids) => {
  for (const k of Object.keys(ids)) if (ids[k] && copyId === ids[k]) return k;
  return copyId ? 'other' : 'none';
};

// ── 메뉴(앱 제 문) ──
const reExact = (s) => new RegExp('^\\s*' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$');
async function menuItems(page) {
  return page.evaluate(() => ({ found: !!document.getElementById('fp-text-menu'),
    items: [...document.querySelectorAll('#fp-text-menu .fp-menu-item')].map(i => i.textContent.trim()) }));
}
async function clickTextMenu(page, label) {
  await page.click('#fp-text-dropdown .fp-dropdown-trigger');
  await page.locator('#fp-text-menu .fp-menu-item').filter({ hasText: reExact(label) }).first().click();
}
async function insText(page, label) {
  const before = await textIds(page);
  await clickTextMenu(page, label);
  await pollTrue(page, (n) => document.querySelectorAll('#canvas .text-block').length > n, before.length, 6000);
  await settle(page);
  const now = await textIds(page);
  const fresh = now.filter(i => !before.includes(i));
  return { fresh, id: fresh.length === 1 ? fresh[0] : null };
}
async function pickSec(page, id) {
  const SEC = `[id="${id}"]`; await scrollTo(page, SEC);
  const hz = await stableTwice(page, SEC + ' .section-hitzone');
  const c = await clickAt(page, hz.left + 20, hz.cy, { sel: SEC + ' .section-hitzone' }, { label: '섹션 꼬리표' });
  const ok = await pollTrue(page, (id) => window.getSelectedSection?.()?.id === id && !!document.getElementById(id)?.classList.contains('selected'), id, 3000);
  return { ok, hit: c.hit, twiceSame: hz.twiceSame };
}
async function newSection(page) {
  const before = await secIds(page);
  await page.click('.fp-btn.primary[title="새 섹션 추가"]');
  await pollTrue(page, (n) => document.querySelectorAll('#canvas .section-block:not([data-ghost])').length > n, before.length);
  const id = (await secIds(page)).find(x => !before.includes(x)) || null;
  if (!id) return { id: null, picked: false };
  let picked = await page.evaluate((id) => window.getSelectedSection?.()?.id === id, id);
  let pick = null;
  if (!picked) { pick = await pickSec(page, id); picked = pick.ok; }
  await settle(page);
  return { id, picked, pick };
}
// 글자 블럭 누르기 — 가라앉힌 글자 칸 rect · clickAt · 골라질 때까지(편집 중이던 블럭이 있으면 첫 클릭이 편집만 끝낼 수 있어 한 번 더)
// modifier: 'Shift' 면 그 키를 누른 채 누른다(범위 다중선택 문) — 그때는 패널 = 그 블럭을 기다리지 않는다
async function clickText(page, id, { modifier = null } = {}) {
  const CE = `[id="${id}"] [class^="tb-"]`;
  const tries = [];
  let selected = false; let panelOk = false;
  for (let k = 0; k < 2 && !selected; k++) {
    await scrollTo(page, CE);
    const r = await stableTwice(page, CE);
    const x = r.left + Math.min(30, r.width / 3), y = r.cy;
    if (modifier) await page.keyboard.down(modifier);
    let c;
    try { c = await clickAt(page, x, y, { sel: `[id="${id}"]`, not: '.tb-rotate-zone, #ss-handles-overlay' }, { label: '글자 고르기 ' + id }); }
    finally { if (modifier) await page.keyboard.up(modifier); }
    selected = await pollTrue(page, (id) => !!document.getElementById(id)?.classList.contains('selected') && !document.getElementById(id)?.classList.contains('editing'), id, 3000);
    tries.push({ hit: c.hit, x: Math.round(x), y: Math.round(y), twiceSame: r.twiceSame, selected });
  }
  if (!modifier) panelOk = await pollTrue(page, (id) => document.querySelector('#panel-right .prop-block-id')?.dataset?.copyId === id && !!document.getElementById('txt-size-number'), id, 3000);
  await settle(page);
  return { tries, selected, panelOk, panel: await panelRead(page) };
}
// 글자 블럭 편집 들어가기 — 더블클릭(앱 문) · .editing ∧ 포커스가 그 블럭의 글자 칸
async function dblText(page, id) {
  const CE = `[id="${id}"] [class^="tb-"]`;
  await scrollTo(page, CE);
  const r = await stableTwice(page, CE);
  const x = r.left + Math.min(30, r.width / 3), y = r.cy;
  const c = await clickAt(page, x, y, { sel: `[id="${id}"]`, not: '.tb-rotate-zone, #ss-handles-overlay' }, { label: '글자 편집 ' + id, dbl: true });
  const editing = await pollTrue(page, (id) => {
    const tb = document.getElementById(id); const a = document.activeElement;
    return !!tb && tb.classList.contains('editing') && !!a && a.isContentEditable && tb.contains(a);
  }, id, 3000);
  return { hit: c.hit, editing };
}
// 편집 중인 글자 칸 끝에 캐럿(캐럿 놓기만 — 글자는 안 바꾼다)
async function caretToEnd(page, id) {
  return page.evaluate((id) => {
    const tb = document.getElementById(id); const ce = tb?.querySelector('[contenteditable="true"]');
    if (!ce) return false;
    const rg = document.createRange(); rg.selectNodeContents(ce); rg.collapse(false);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(rg);
    return document.activeElement === ce || ce.contains(document.activeElement);
  }, id);
}
const activeTag = (page) => page.evaluate(() => { const a = document.activeElement; return a ? { tag: a.tagName, id: a.id || null, ce: !!a.isContentEditable } : null; });

// ── 재기 ──
// ⑴ 바깥 프레임(.frame-block[data-text-frame] 있으면 그것, 없으면 text-block)의 정규화 outerHTML
//    (selected · editing · multi-selected class 와 contenteditable 속성을 뺀다) → node 에서 sha1
// ⑵ 글자 칸 computed fontSize · fontWeight · color · fontFamily ⑶ 글자 노드 부모들 · 인라인 서식 요소 수
async function measure(page, id) {
  const m = await page.evaluate((id) => {
    const tb = document.getElementById(id); if (!tb) return { exists: false, id };
    const tf = tb.parentElement?.matches?.('.frame-block[data-text-frame]') ? tb.parentElement : null;
    const outer = tf || tb;
    const norm = (root, dropIds) => {
      const cl = root.cloneNode(true);
      [cl, ...cl.querySelectorAll('*')].forEach(e => {
        if (e.classList) { ['selected', 'editing', 'multi-selected'].forEach(k => e.classList.remove(k)); if (e.getAttribute('class') === '') e.removeAttribute('class'); }
        e.removeAttribute?.('contenteditable');
        if (dropIds) e.removeAttribute?.('id');
      });
      return cl.outerHTML;
    };
    const ce = tb.querySelector('[contenteditable]') || tb.querySelector('.tb-h1,.tb-h2,.tb-h3,.tb-body,.tb-caption,.tb-label,.tb-bullet,.tb-liner,.itb-text');
    const pick = (e) => { const cs = getComputedStyle(e); return { fontSize: cs.fontSize, fontWeight: cs.fontWeight, color: cs.color, fontFamily: cs.fontFamily }; };
    const parents = [];
    if (ce) {
      const w = document.createTreeWalker(ce, NodeFilter.SHOW_TEXT);
      let n; while ((n = w.nextNode())) {
        if (!n.nodeValue.trim()) continue;
        const p = n.parentElement;
        parents.push({ tag: p.tagName, text: n.nodeValue.slice(0, 40), isCe: p === ce, ...pick(p) });
      }
    }
    const varAttrs = [];
    [outer, ...outer.querySelectorAll('*')].forEach(e => { for (const a of e.attributes) if (/^data-var-/.test(a.name)) varAttrs.push(e.tagName + '[' + a.name + ']'); });
    const strokeAttrs = [];
    [outer, ...outer.querySelectorAll('*')].forEach(e => { for (const a of e.attributes) if (/^data-stroke/.test(a.name)) strokeAttrs.push(e.tagName + '[' + a.name + ']'); });
    const ceStyle = ce ? (ce.getAttribute('style') || '') : null;
    return {
      exists: true, id, idParts: tb.id.split('_').length, inFrame: !!tf, frameId: tf ? tf.id : null,
      selected: tb.classList.contains('selected'), editing: tb.classList.contains('editing'),
      normHtml: norm(outer, false), normHtmlNoIds: norm(outer, true),
      text: ce ? ce.textContent : null, ce: ce ? pick(ce) : null, textParents: parents,
      inlineStyled: ce ? ce.querySelectorAll('span[style], font, b, strong').length : null,
      pre: { varAttrs, strokeAttrs, ceStyleHasVar: !!(ceStyle && /var\(--/.test(ceStyle)), tbStyleHasVar: /var\(--/.test(tb.getAttribute('style') || '') },
    };
  }, id);
  if (m.exists) { m.sha1 = sha1(m.normHtml); m.sha1NoIds = sha1(m.normHtmlNoIds); delete m.normHtml; delete m.normHtmlNoIds; }
  return m;
}
const view = (m) => m && m.exists ? { sha1: m.sha1, ce: m.ce } : null;

// ── 패널 조작(앱 제 문 — 패널 칸) ──
const OPS = {
  size: { key: 'fontSize', want: '22px', run: async (page) => { const l = page.locator('#txt-size-number'); await l.fill('22'); await l.press('Enter'); } },
  weight: { key: 'fontWeight', want: '400', run: async (page) => { await page.locator('#txt-font-weight').selectOption('400'); } },
  color: { key: 'color', want: 'rgb(37, 99, 235)', run: async (page) => { const l = page.locator('#txt-color-hex'); await l.fill('2563EB'); await l.press('Enter'); } },
};
// A 의 꼴(조작 전 전제) — 크기 40 · 굵기 700 · 색 E11D48
const A_STYLE = { fontSize: '40px', fontWeight: '700', color: 'rgb(225, 29, 72)' };

// 장면: 새 섹션 → Heading(A) → 섹션 다시 고름 → Body(B) → A 를 패널로 꾸밈(크기·굵기·색) → 전제 단언
async function scene(page, o) {
  o.menu = await menuItems(page);
  expect(o.menu.found && o.menu.items.includes('Heading') && o.menu.items.includes('Body'), `[전제] 텍스트 메뉴에 Heading·Body 가 있다 ${JSON.stringify(o.menu)}`).toBe(true);
  o.sec = await newSection(page);
  expect(o.sec.id && o.sec.picked, `[전제] 새 섹션이 생기고 골라졌다 ${JSON.stringify(o.sec)}`).toBeTruthy();
  o.insA = await insText(page, 'Heading');
  expect(o.insA.id, `[전제] Heading 하나가 생겼다 ${JSON.stringify(o.insA.fresh)}`).toBeTruthy();
  o.pickForB = await pickSec(page, o.sec.id);
  expect(o.pickForB.ok, '[전제] B 를 넣기 전 섹션을 다시 골랐다').toBe(true);
  o.insB = await insText(page, 'Body');
  expect(o.insB.id, `[전제] Body 하나가 생겼다 ${JSON.stringify(o.insB.fresh)}`).toBeTruthy();
  const A = o.insA.id, B = o.insB.id;
  o.ids = { A, B };
  o.styleClickA = await clickText(page, A);
  expect(o.styleClickA.selected && o.styleClickA.panelOk, `[전제] A 를 누르면 A 의 글자 패널 ${JSON.stringify(o.styleClickA.panel)}`).toBe(true);
  { const l = page.locator('#txt-size-number'); await l.fill('40'); await l.press('Enter'); }
  await expect.poll(async () => (await measure(page, A)).ce?.fontSize, { message: '[전제] A 크기 40 적용' }).toBe(A_STYLE.fontSize);
  await page.locator('#txt-font-weight').selectOption('700');
  await expect.poll(async () => (await measure(page, A)).ce?.fontWeight, { message: '[전제] A 굵기 700 적용' }).toBe(A_STYLE.fontWeight);
  { const l = page.locator('#txt-color-hex'); await l.fill('E11D48'); await l.press('Enter'); }
  await expect.poll(async () => (await measure(page, A)).ce?.color, { message: '[전제] A 색 E11D48 적용' }).toBe(A_STYLE.color);
  await settle(page);
  o.styledA = await measure(page, A);
  o.styledB = await measure(page, B);
  expect(o.styledA.inFrame, '[전제] A 는 흐름 글자 프레임 안').toBe(true);
  expect(o.styledA.pre.varAttrs, '[전제] A 에 변수 바인딩(data-var-*) 0').toEqual([]);
  expect(o.styledA.pre.ceStyleHasVar || o.styledA.pre.tbStyleHasVar, '[전제] A 인라인 style 에 var(--) 0').toBe(false);
  expect(o.styledA.pre.strokeAttrs, '[전제] A 에 외곽선(data-stroke*) 0').toEqual([]);
  expect(o.styledB.ce?.fontSize !== A_STYLE.fontSize || o.styledB.ce?.color !== A_STYLE.color, '[전제] B 는 A 와 다른 꼴').toBe(true);
  return { A, B };
}

// ⌘V 뒤 사본: 새 글자 블럭이 정확히 n 개 생길 때까지 → 가라앉힘
async function pasteAndFindCopies(page, o, n = 1) {
  const before = await textIds(page);
  o.activeBeforePaste = await activeTag(page);
  await page.keyboard.press('Meta+v');
  await pollTrue(page, ([b, n]) => [...document.querySelectorAll('#canvas .text-block')].filter(t => !b.includes(t.id)).length >= n, [before, n], 6000);
  await settle(page);
  const now = await textIds(page);
  o.pastedFresh = now.filter(i => !before.includes(i));
  expect(o.pastedFresh.length, `[전제] ⌘V 로 새 글자 블럭 정확히 ${n}개 ${JSON.stringify(o.pastedFresh)}`).toBe(n);
  return o.pastedFresh;
}
// 조작 뒤: A·B·C 중 누가(조작 전 값과 다르게) 새 값이 될 때까지(최대 4s · 못 오면 그대로) → 가라앉힘
async function baseOf(page, ids, op) {
  return page.evaluate(([ids, key]) => ids.map(id => {
    const tb = document.getElementById(id); const ce = tb && (tb.querySelector('[contenteditable]') || tb.querySelector('[class^="tb-"]'));
    return ce ? getComputedStyle(ce)[key] : null;
  }), [ids, op.key]);
}
async function waitAnyChanged(page, ids, op, base) {
  const came = await pollTrue(page, ([ids, key, want, base]) => ids.some((id, i) => {
    if (base[i] === want) return false;
    const tb = document.getElementById(id); const ce = tb && (tb.querySelector('[contenteditable]') || tb.querySelector('[class^="tb-"]'));
    return !!ce && getComputedStyle(ce)[key] === want;
  }), [ids, op.key, op.want, base], 4000);
  await settle(page);
  return came;
}
async function premiseNotInInput(page, o) {
  o.activeBeforeCopy = await activeTag(page);
  expect(['INPUT', 'TEXTAREA', 'SELECT'].includes(o.activeBeforeCopy?.tag) || !!o.activeBeforeCopy?.ce, `[전제] ⌘C 때 포커스가 입력칸이 아니다 ${JSON.stringify(o.activeBeforeCopy)}`).toBe(false);
}

// ───────────────────────── B0 판 정체 (EXPECT_SHA 있을 때만) ─────────────────────────
// 성공 = ⑴ git -C ROOT rev-parse HEAD === EXPECT_SHA ∧ ⑵ IDENT_FILES 마다 페이지가 받은 바이트의 blob sha1 === git EXPECT_SHA:<file>
test('B0 board identity head sha and served blob sha1 @t412 @B0', async ({ page }, ti) => {
  test.skip(!EXPECT_SHA, 'EXPECT_SHA env 가 없다 — 판 정체는 양성대조·고친 판 런에서만 잰다');
  test.setTimeout(60000);
  const Bt = await boot(page);
  const id = { root: ROOT, expectSha: EXPECT_SHA, headSha: null, files: [] };
  expect(EXPECT_SHA, '판 정체: EXPECT_SHA 가 풀 sha 40자').toMatch(/^[0-9a-f]{40}$/);
  id.headSha = execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD']).toString().trim();
  for (const f of IDENT_FILES) {
    const want = execFileSync('git', ['-C', ROOT, 'rev-parse', `${EXPECT_SHA}:${f}`]).toString().trim();
    const got = await page.evaluate(async (u) => {
      const r = await fetch(u, { cache: 'no-store' });
      const a = new Uint8Array(await r.arrayBuffer());
      let bin = ''; for (let i = 0; i < a.length; i += 0x8000) bin += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000));
      return { status: r.status, b64: btoa(bin) };
    }, `${ORIGIN}/${f}`);
    const buf = Buffer.from(got.b64, 'base64');
    id.files.push({ file: f, status: got.status, bytes: buf.length, pageBlob: blobSha1(buf), gitBlob: want });
  }
  Object.assign(id, errsOf(Bt));
  await attach(ti, 't412-B0.json', id);
  expect(id.headSha, '판 정체 ⑴: ROOT 의 HEAD === EXPECT_SHA').toBe(EXPECT_SHA);
  for (const r of id.files) expect(r.pageBlob, `판 정체 ⑵: 페이지가 받은 ${r.file} blob sha1 === git ${EXPECT_SHA.slice(0, 8)}:${r.file}`).toBe(r.gitBlob);
});

// ───────────────────────── P1 원본 판정 ─────────────────────────
// 사람 순서: A 누름 → ⌘C → ⌘V → (다른 곳 안 누름) → 패널 칸 하나 조작
// 성공 = 붙인 직후 패널 대상 = C ∧ A 불변(sha1 + computed) ∧ 사본 C 에 새 값 ∧ B 불변
for (const k of ['size', 'weight', 'color']) {
  test('P1-' + k + ' copy paste then panel ' + k + ' change goes to copy not original @t412', async ({ page }, ti) => {
    test.setTimeout(150000);
    const op = OPS[k];
    const Bt = await boot(page); const o = { cell: 'P1-' + k, op: { key: op.key, want: op.want } };
    try {
      const { A, B } = await scene(page, o);
      o.clickA = await clickText(page, A);
      expect(o.clickA.selected && o.clickA.panelOk, '[전제] A 골라짐 · 패널 = A').toBe(true);
      await premiseNotInInput(page, o);
      o.before = { A: await measure(page, A), B: await measure(page, B) };
      await page.keyboard.press('Meta+c');
      const [C] = await pasteAndFindCopies(page, o, 1);
      o.ids.C = C;
      o.afterPaste = { C: await measure(page, C), panel: await panelRead(page), selectedIds: await selectedIds(page) };
      o.panelTargetIs = targetIs(o.afterPaste.panel.copyId, o.ids);
      o.copyEqualsAModIds = o.afterPaste.C.sha1NoIds === o.before.A.sha1NoIds;
      o.baseBeforeOp = await baseOf(page, [A, B, C], op);
      await op.run(page);
      o.changedCame = await waitAnyChanged(page, [A, B, C], op, o.baseBeforeOp);
      o.after = { A: await measure(page, A), B: await measure(page, B), C: await measure(page, C), panel: await panelRead(page) };
    } catch (e) { o.err = String(e).slice(0, 800); }
    finally { Object.assign(o, errsOf(Bt)); await attach(ti, 't412-' + o.cell + '.json', o); }
    expect(o.err, '측정 중 예외 없음(장면 전제 포함)').toBeUndefined();
    expect.soft(o.panelTargetIs, '성공: 붙인 직후 우측 패널 대상 = 사본 C').toBe('C');
    expect.soft(view(o.after.A), `성공: 원본 A 불변(sha1 + computed) — 붙인 직후 패널 대상 = ${o.panelTargetIs}`).toEqual(view(o.before.A));
    expect.soft(o.after.C.ce?.[op.key], `성공: 사본 C 글자 칸 computed ${op.key} = ${op.want}`).toBe(op.want);
    expect.soft(view(o.after.B), '성공: B 불변(sha1 + computed)').toEqual(view(o.before.B));
  });
}

// ───────────────────────── P2 붙일 자리 ─────────────────────────
// 사람 순서: A 누름 → ⌘C → B 누름 → ⌘V → 패널 크기 22
// 성공 = 붙인 직후 패널 대상 = C ∧ B 불변 ∧ A 불변 ∧ 사본 C fontSize = 22px
test('P2 copy A click B paste then panel size change goes to copy not paste target @t412', async ({ page }, ti) => {
  test.setTimeout(150000);
  const op = OPS.size;
  const Bt = await boot(page); const o = { cell: 'P2', op: { key: op.key, want: op.want } };
  try {
    const { A, B } = await scene(page, o);
    o.clickA = await clickText(page, A);
    expect(o.clickA.selected && o.clickA.panelOk, '[전제] A 골라짐 · 패널 = A').toBe(true);
    await premiseNotInInput(page, o);
    await page.keyboard.press('Meta+c');
    o.clickB = await clickText(page, B);
    expect(o.clickB.selected && o.clickB.panelOk, '[전제] B 골라짐 · 패널 = B').toBe(true);
    o.before = { A: await measure(page, A), B: await measure(page, B) };
    const [C] = await pasteAndFindCopies(page, o, 1);
    o.ids.C = C;
    o.afterPaste = { C: await measure(page, C), panel: await panelRead(page), selectedIds: await selectedIds(page) };
    o.panelTargetIs = targetIs(o.afterPaste.panel.copyId, o.ids);
    o.baseBeforeOp = await baseOf(page, [A, B, C], op);
    await op.run(page);
    o.changedCame = await waitAnyChanged(page, [A, B, C], op, o.baseBeforeOp);
    o.after = { A: await measure(page, A), B: await measure(page, B), C: await measure(page, C), panel: await panelRead(page) };
  } catch (e) { o.err = String(e).slice(0, 800); }
  finally { Object.assign(o, errsOf(Bt)); await attach(ti, 't412-P2.json', o); }
  expect(o.err, '측정 중 예외 없음(장면 전제 포함)').toBeUndefined();
  expect.soft(o.panelTargetIs, '성공: 붙인 직후 우측 패널 대상 = 사본 C').toBe('C');
  expect.soft(view(o.after.B), `성공: 붙일 자리 B 불변(sha1 + computed) — 붙인 직후 패널 대상 = ${o.panelTargetIs}`).toEqual(view(o.before.B));
  expect.soft(view(o.after.A), '성공: 원본 A 불변(sha1 + computed)').toEqual(view(o.before.A));
  expect.soft(o.after.C.ce?.fontSize, `성공: 사본 C 글자 칸 computed fontSize = ${op.want}`).toBe(op.want);
});

// ───────────────────────── P3 지킴 — 편집 중 붙여넣기 ─────────────────────────
// 사람 순서: A 더블클릭 → 끝에서 Shift+← ×3 (⌘C) → B 더블클릭 → 끝에 캐럿 → 붙여넣기
//   붙여넣기는 Chromium 이 다른 글자 블럭에서 복사했을 때 싣는 꼴(text/plain + 서식 span 의 text/html)을 합성 ClipboardEvent 로 쏜다
//   (Electron 실제 클립보드는 못 잰다 — 앱의 paste 핸들러는 그대로 탄다).
// 성공 = A 불변 ∧ B 글자에 붙인 글자가 있다 ∧ B 안 인라인 서식 요소 수가 안 늘었다 ∧ 붙인 글자의 부모 computed = B 자기 값
test('P3 edit mode paste of styled html into another text keeps target own style @t412', async ({ page }, ti) => {
  test.setTimeout(150000);
  const Bt = await boot(page); const o = { cell: 'P3' };
  try {
    const { A, B } = await scene(page, o);
    o.dblA = await dblText(page, A);
    expect(o.dblA.editing, '[전제] A 편집 들어감').toBe(true);
    o.caretA = await caretToEnd(page, A);
    expect(o.caretA, '[전제] A 글자 칸 끝에 캐럿').toBe(true);
    for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowLeft');
    o.chars = await page.evaluate(() => window.getSelection().toString());
    expect(o.chars.length, `[전제] Shift+← ×3 으로 글자 3개 골라짐 «${o.chars}»`).toBe(3);
    await page.keyboard.press('Meta+c');
    o.dblB = await dblText(page, B);
    expect(o.dblB.editing, '[전제] B 편집 들어감').toBe(true);
    o.aLeftEditing = await page.evaluate((a) => !document.getElementById(a)?.classList.contains('editing'), A);
    expect(o.aLeftEditing, '[전제] A 는 편집에서 나왔다').toBe(true);
    o.caretB = await caretToEnd(page, B);
    expect(o.caretB, '[전제] B 글자 칸 끝에 캐럿').toBe(true);
    await settle(page);   // A 가 편집에서 나온 뒤의 정리(있다면)가 끝난 뒤를 «전»으로 삼는다
    o.before ={ A: await measure(page, A), B: await measure(page, B) };
    const html = `<meta charset='utf-8'><span style="color: ${A_STYLE.color}; font-size: ${A_STYLE.fontSize}; font-weight: ${A_STYLE.fontWeight}; font-family: Georgia, serif;">${o.chars}</span>`;
    o.pasteHtml = html;
    o.dispatch = await page.evaluate(([b, text, html]) => {
      const ce = document.getElementById(b).querySelector('[contenteditable="true"]');
      const dt = new DataTransfer(); dt.setData('text/plain', text); dt.setData('text/html', html);
      const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
      ce.dispatchEvent(ev);
      return { defaultPrevented: ev.defaultPrevented };
    }, [B, o.chars, html]);
    o.came = await pollTrue(page, ([b, t]) => (document.getElementById(b)?.querySelector('[contenteditable]')?.textContent || '').includes(t)
      && (document.getElementById(b)?.querySelector('[contenteditable]')?.textContent || '').length > 0, [B, o.chars], 4000);
    await settle(page);
    o.after = { A: await measure(page, A), B: await measure(page, B) };
    o.pastedParent = await page.evaluate(([b, t]) => {
      const ce = document.getElementById(b)?.querySelector('[contenteditable]'); if (!ce) return null;
      const w = document.createTreeWalker(ce, NodeFilter.SHOW_TEXT);
      let n, hit = null; while ((n = w.nextNode())) { if (n.nodeValue === t) { hit = n; break; } if (!hit && n.nodeValue.endsWith(t)) hit = n; }
      if (!hit) return { found: false };
      const p = hit.parentElement; const cs = getComputedStyle(p);
      return { found: true, exact: hit.nodeValue === t, tag: p.tagName, isCe: p === ce, style: p.getAttribute('style') || '',
        fontSize: cs.fontSize, fontWeight: cs.fontWeight, color: cs.color, fontFamily: cs.fontFamily };
    }, [B, o.chars]);
  } catch (e) { o.err = String(e).slice(0, 800); }
  finally { Object.assign(o, errsOf(Bt)); await attach(ti, 't412-P3.json', o); }
  expect(o.err, '측정 중 예외 없음(장면 전제 포함)').toBeUndefined();
  expect.soft(view(o.after.A), '성공: A 불변(sha1 + computed)').toEqual(view(o.before.A));
  expect.soft(o.after.B.text || '', `성공: B 글자에 붙인 글자 «${o.chars}» 가 있다`).toContain(o.chars);
  expect.soft(o.after.B.inlineStyled, '성공: B 안 인라인 서식 요소(span[style]·font·b·strong) 수가 안 늘었다').toBe(o.before.B.inlineStyled);
  const own = o.before.B.ce;
  const got = o.pastedParent && o.pastedParent.found
    ? { fontSize: o.pastedParent.fontSize, fontWeight: o.pastedParent.fontWeight, color: o.pastedParent.color, fontFamily: o.pastedParent.fontFamily } : null;
  expect.soft(got, '성공: 붙인 글자의 부모 computed 4속성 = B 자기 값').toEqual(own);
});

// ───────────────────────── P4 무결성 — 편집 중 ⌘C 뒤 블럭 붙여넣기 (관찰) ─────────────────────────
// 사람 순서: A 더블클릭 → 끝에서 Shift+← ×3 → ⌘C(편집 중 = 네이티브 복사) → B 누름(블럭 선택 · 편집 아님) → ⌘V
// 성공 = A · B 의 sha1(+computed) 불변. 무엇이 붙었는지(새 블럭 · 그 글자)는 관찰로만 남긴다(H3 · 별건).
test('P4 edit mode copy then block paste leaves original and target intact @t412', async ({ page }, ti) => {
  test.setTimeout(150000);
  const Bt = await boot(page); const o = { cell: 'P4' };
  try {
    const { A, B } = await scene(page, o);
    o.dblA = await dblText(page, A);
    expect(o.dblA.editing, '[전제] A 편집 들어감').toBe(true);
    o.caretA = await caretToEnd(page, A);
    expect(o.caretA, '[전제] A 글자 칸 끝에 캐럿').toBe(true);
    for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowLeft');
    o.chars = await page.evaluate(() => window.getSelection().toString());
    expect(o.chars.length, `[전제] Shift+← ×3 으로 글자 3개 골라짐 «${o.chars}»`).toBe(3);
    await page.keyboard.press('Meta+c');
    o.clickB = await clickText(page, B);
    expect(o.clickB.selected, '[전제] B 블럭 골라짐(편집 아님)').toBe(true);
    o.aLeftEditing = await page.evaluate((a) => !document.getElementById(a)?.classList.contains('editing'), A);
    expect(o.aLeftEditing, '[전제] A 는 편집에서 나왔다').toBe(true);
    o.activeBeforePaste = await activeTag(page);
    o.before = { A: await measure(page, A), B: await measure(page, B) };
    const beforeIds = await textIds(page);
    await page.keyboard.press('Meta+v');
    await settle(page);
    const nowIds = await textIds(page);
    o.pastedFresh = nowIds.filter(i => !beforeIds.includes(i));
    o.observe = { newTextBlocks: o.pastedFresh.length, newTexts: [] , panel: await panelRead(page), selectedIds: await selectedIds(page),
      toast: await page.evaluate(() => [...document.querySelectorAll('.toast, .ss-toast, #toast, [class*="toast"]')].map(t => (t.textContent || '').trim()).filter(Boolean).slice(0, 5)) };
    for (const id of o.pastedFresh) o.observe.newTexts.push((await measure(page, id)).text);
    o.after = { A: await measure(page, A), B: await measure(page, B) };
  } catch (e) { o.err = String(e).slice(0, 800); }
  finally { Object.assign(o, errsOf(Bt)); await attach(ti, 't412-P4.json', o); }
  expect(o.err, '측정 중 예외 없음(장면 전제 포함)').toBeUndefined();
  expect.soft(view(o.after.A), '성공: A 불변(sha1 + computed)').toEqual(view(o.before.A));
  expect.soft(view(o.after.B), `성공: B 불변(sha1 + computed) — 관찰: 새 글자 블럭 ${o.observe?.newTextBlocks}개 ${JSON.stringify(o.observe?.newTexts)}`).toEqual(view(o.before.B));
});

// ───────────────────────── P5 다중 붙여넣기 ─────────────────────────
// 사람 순서: A 누름 → ⇧ 누른 채 B 누름(범위 다중선택) → ⌘C → ⌘V
// 성공 = 사본 2개 ∧ 붙인 뒤 우측 패널 = 페이지 패널(A·B 의 패널이 아니다) ∧ A · B 불변
//   (다중 붙여넣기 뒤 패널을 다중선택 패널로 할지는 결정거리 — 기본은 페이지)
test('P5 multi select copy paste releases panel to page and keeps originals @t412', async ({ page }, ti) => {
  test.setTimeout(150000);
  const Bt = await boot(page); const o = { cell: 'P5' };
  try {
    const { A, B } = await scene(page, o);
    o.clickA = await clickText(page, A);
    expect(o.clickA.selected && o.clickA.panelOk, '[전제] A 골라짐 · 패널 = A').toBe(true);
    o.shiftB = await clickText(page, B, { modifier: 'Shift' });
    o.multiOk = await pollTrue(page, ([a, b]) => !!document.getElementById(a)?.classList.contains('selected') && !!document.getElementById(b)?.classList.contains('selected'), [A, B], 3000);
    expect(o.multiOk, '[전제] ⇧클릭으로 A · B 둘 다 골라짐').toBe(true);
    await settle(page);
    o.panelBeforeCopy = await panelRead(page);
    await premiseNotInInput(page, o);
    o.before = { A: await measure(page, A), B: await measure(page, B) };
    await page.keyboard.press('Meta+c');
    const copies = await pasteAndFindCopies(page, o, 2);
    o.ids.C1 = copies[0]; o.ids.C2 = copies[1];
    o.afterPaste = { panel: await panelRead(page), selectedIds: await selectedIds(page),
      copiesSelected: await page.evaluate((ids) => ids.map(i => !!document.getElementById(i)?.classList.contains('selected')), copies) };
    o.panelTargetIs = targetIs(o.afterPaste.panel.copyId, o.ids);
    o.after = { A: await measure(page, A), B: await measure(page, B) };
  } catch (e) { o.err = String(e).slice(0, 800); }
  finally { Object.assign(o, errsOf(Bt)); await attach(ti, 't412-P5.json', o); }
  expect(o.err, '측정 중 예외 없음(장면 전제 포함)').toBeUndefined();
  expect.soft(o.afterPaste.panel.name, `성공: 붙인 뒤 우측 패널 = 페이지 패널 (패널 대상 ${o.panelTargetIs})`).toBe('Page');
  expect.soft(['A', 'B'].includes(o.panelTargetIs), '성공: 붙인 뒤 패널 대상이 원본 A · B 가 아니다').toBe(false);
  expect.soft(view(o.after.A), '성공: A 불변(sha1 + computed)').toEqual(view(o.before.A));
  expect.soft(view(o.after.B), '성공: B 불변(sha1 + computed)').toEqual(view(o.before.B));
});
