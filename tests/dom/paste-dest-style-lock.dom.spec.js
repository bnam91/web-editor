// paste-dest-style-lock — S6 [10] ⑴ «⌘V = 목적지(우리) 서식» 지금 동작을 잠근다 (제품 무변 · 2026-10-22)
// 현빈 확정 ⒤: 기본 붙여넣기(⌘V)는 목적지 스타일. 서식 있는 클립보드(굵게·색·크기·글꼴)를 편집 중 칸에 붙여도
//   붙은 글자는 «캐럿 자리의 목적지 서식»을 따르고, 확정 뒤 데이터에 짐의 서식이 남지 않는다.
// 칸(--grep @pds → Running 8 · 변이 런은 --grep @pds-style → Running 7 · P0 제외):
//   P0      판 정체 — git -C ROOT rev-parse HEAD = EXPECT_SHA · ID_FILES 마다 페이지가 받은 바이트 sha1 = 디스크 = EXPECT_FILES_SHA1
//   K1      KEY 길 전제 — 진짜 ControlOrMeta+C/V 로 paste 1회 · text/html 실림(서식 있음) · 글 블럭 리스너가 기본 동작을 막음 · 블럭 수 불변
//   S1-SYN · S1-KEY   글 블럭(.text-block · block-drag.js _bindTextEditEl paste 리스너)
//   S2-SYN · S2-KEY   말풍선 발신자 이름(.tb-sender-name · block-drag.js 이름표 onPaste)
//   S3-SYN · S3-KEY   말풍선 «줄»(line-host.js lnBeginEdit onPaste) — 줄 모드는 기본이 아니다 ⇒ 캔버스 ＋(앱 문)로 들어간다
//                     ★ⓔ 만 todo — PASTE-DOUBLE-INSERT-LINE-IN-BUBBLE-01(임시 이름 · 아래 TODO_DOUBLE)
// 단언 꼴: ⓐ = 전제(붙인 글자가 들어왔나) — 안 서면 «장면 미성립» · ⓑ 편집칸 서식 요소(b,strong,i,em,u,font,span[style]) 수 = 전
//   ⓒ 편집칸 모든 글자 노드 부모의 계산 {weight,color,size,family} = 붙이기 전 캐럿 부모 값 · ⓓ 확정 뒤 데이터에 짐 서식 0 · ⓔ 글자가 한 번만(두 길)
//   전제(hard «장면 미성립:») — 목적지 캐럿 자리 계산 4속성이 짐과 넷 다 다르다(같으면 ⓒ 가 못 가른다) · 붙이기 전 편집칸 글자 부모가 한 꼴.
//   성공(soft «성공 ⓑ…»). 칸마다 console 한 줄 «PDS <칸> {a,b,c,d,e}» 를 찍는다(변이 표 근거).
// 두 길:
//   SYN = 합성 ClipboardEvent('paste') 를 편집칸에 쏜다. 재는 축: 리스너 «논리»(무엇을 읽어 무엇을 넣나).
//     ⚠️한계: 합성 이벤트는 기본 동작이 0 이다 ⇒ 리스너를 «지우는» 변이(M1)·preventDefault 를 빼는 변이(M2)를 못 본다(ⓐ 만 빨강이거나 초록). KEY 칸이 그 몫이다. (예외: S3-SYN 은 ⓔ 로 M1 을 본다 — 조상 리스너 ② 가 빠지면 이중 넣기가 사라져 «todo 가 닫혔다»)
//   KEY = 원본 글 블럭 A(패널로 40px·700·#E11D48·Noto Serif KR)를 더블클릭 편집 → Shift+← ×3 → ControlOrMeta+C → 목적지 더블클릭 → 캐럿 → ControlOrMeta+V.
//     재는 축: 리스너 + 브라우저 기본 붙여넣기(Chromium 이 직렬화한 text/html). 짐 = A 의 계산 4속성(측정값).
//     클립보드는 같은 워커 안 테스트끼리 공유된다(«해석») ⇒ 칸마다 새로 복사하고 받은 text/plain = 방금 고른 글자를 전제로 잰다.
// 안 재는 축: Electron 실 OS 클립보드·맥 메뉴 가속기(pasteAndMatchStyle) · 다른 앱(Docs·Word)에서 온 html · 한글 입력기 ·
//   리스너 없는 편집칸(그리드 줄·표·Tags·Icon Text·Quote·Chat·Comparison·Card 등 — 사람 게이트 G1) · S4·S6(기존 M6c · section-memo-rich C9·P3 가 잠금) · ★S5(annotation-select.js:705 onPaste)는 아무도 안 잰다(빈칸) · headed.
// 규칙: 블럭은 메뉴(앱 문)로 만든다 — 생성 함수 evaluate 호출 0. evaluate 는 읽기 · 캐럿 놓기 · 배율(applyZoom 100, 보기 상태) · 합성 paste · 세는 리스너 걸기만.
//   ⛔고정 대기 0줄 — waitForFunction / expect.poll / waitStableRect. 좌표 클릭은 clickAt(맞힌 요소 단언).
// 돌리는 법(레인 cwd):
//   env 는 손으로 베끼지 않는다: python3 -I ~/taeyang-098/ty-specenv.py <ROOT> tests/dom/paste-dest-style-lock.dom.spec.js → EXPECT_FILES_SHA1
//   EXPECT_SHA=<HEAD 40자> EXPECT_FILES_SHA1='<위 값>' bash ~/taeyang-098/run-test.sh dom tests/dom/paste-dest-style-lock.dom.spec.js --grep @pds --retries=0
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { ROOT, bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

// 판 정체 — 이 검사가 «실제로 기대는» 파일(메뉴 · 글 블럭/이름표 리스너 · 줄 리스너 · ⌘V 블럭 붙여넣기 거름 · 문서 paste 리스너 전수
//   (scratch-pad · prop-text-wireup-text-edit keepDotSpansOnEdit · prop-number-commit-guard capture · report-modal) · 목적지 기본 서식·말풍선 DOM(block-factory))
//   ⚠️EXPECT_FILES_SHA1 은 ty-specenv 가 런 시점 디스크에서 만든다 ⇒ «받은 바이트 = EXPECT» 는 «받은 바이트 = 디스크»와 같은 말. 판을 묶는 것은 HEAD 대조 ＋ 로그 머리 «미커밋 numstat».
const ID_FILES = ['index.html', 'js/block-drag.js', 'js/blocks/line-host.js', 'js/editor.js', 'js/scratch-pad.js', 'js/props/prop-text-wireup-text-edit.js', 'js/props/prop-number-commit-guard.js', 'js/report-modal.js', 'js/block-factory.js'];
const sha1 = (buf) => crypto.createHash('sha1').update(buf).digest('hex');

const VIEW = { width: 1500, height: 1000 };
const COPY = 'ControlOrMeta+C';
const PASTE = 'ControlOrMeta+V';
const WORD = '굵빨강';
// 합성 짐(B-1) — 굵게 · 색 · 크기 · 글꼴 넷
const SYN_HTML = `<meta charset='utf-8'><b>굵</b><span style="color: rgb(225, 29, 72); font-size: 40px; font-family: Georgia, serif;">빨강</span>`;
const SYN_LOAD = { fontWeight: '700', color: 'rgb(225, 29, 72)', fontSize: '40px', fontFamily: 'Georgia' };
const FMT_SEL = 'b,strong,i,em,u,font,span[style]';
const MARKERS = ['225, 29, 72', 'Georgia', 'Noto Serif', '<b>', 'font-weight', '40px'];

async function attach(ti, name, o) { await ti.attach(name, { body: JSON.stringify(o, null, 1), contentType: 'application/json' }); }

// ── 띄우기 ──
async function boot(page) {
  const cerr = [];
  page.on('console', (m) => { if (m.type() === 'error') cerr.push(m.text().slice(0, 300)); });
  page.on('dialog', (d) => { d.dismiss().catch(() => {}); });
  await page.setViewportSize(VIEW);
  const errs = await bootApp(page);
  // 배율 100 — 이름표 같은 작은 글자를 좌표로 누르기 위한 «보기 상태». 스케일러 전환이 끝날 때까지 기다린다(bubble-line-plus 와 같은 자).
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
const errsOf = (B) => ({ pageerror: B.errs.slice(0, 20).map((s) => String(s).slice(0, 300)), consoleError: B.cerr.slice(0, 20) });

async function pollTrue(page, fn, arg, timeout = 6000) {
  try { await page.waitForFunction(fn, arg, { timeout, polling: 100 }); return true; } catch { return false; }
}
// 가라앉힘 — 캔버스 innerHTML · 선택 · 포커스가 연달아 4번(100ms 간격) 같을 때까지
async function settle(page, timeout = 8000) {
  await page.evaluate(() => { window.__pdsLast = null; window.__pdsN = 0; });
  return pollTrue(page, () => {
    const c = document.getElementById('canvas');
    const a = document.activeElement;
    const s = (c ? c.innerHTML : '') + '|' + [...document.querySelectorAll('#canvas .selected')].map((e) => e.id).join(',') + '|' + (a ? a.tagName + (a.className || '') : '');
    if (s === window.__pdsLast) window.__pdsN++; else { window.__pdsLast = s; window.__pdsN = 0; }
    return window.__pdsN >= 4;
  }, null, timeout);
}
async function stableTwice(page, sel, index = 0) {
  const a = await waitStableRect(page, sel, { index }); const b = await waitStableRect(page, sel, { index });
  return { ...b, twiceSame: a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height };
}
const sameSec = (page, id, sec) => page.evaluate(([id, sec]) => document.getElementById(id)?.closest('.section-block')?.id === sec, [id, sec]);
const scrollTo = (page, sel) => page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center', behavior: 'instant' }), sel);

// 장면 미성립 = hard · 메시지 머리 «장면 미성립:»
function pre(cond, msg) { expect(!!cond, '장면 미성립: ' + msg).toBe(true); }

// ── 메뉴(앱 제 문) ──
const reExact = (s) => new RegExp('^\\s*' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$');
const secIds = (page) => page.evaluate(() => [...document.querySelectorAll('#canvas .section-block:not([data-ghost])')].map((s) => s.id));
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
// 메뉴 누름 → 그 종류 블럭이 하나 더 생김 → 새 id
async function insFromMenu(page, dd, label, blockSel) {
  const ids = () => page.evaluate((s) => [...document.querySelectorAll('#canvas ' + s)].map((e) => e.id), blockSel);
  const before = await ids();
  await page.click(`#fp-${dd}-dropdown .fp-dropdown-trigger`);
  await page.locator(`#fp-${dd}-menu .fp-menu-item`).filter({ hasText: reExact(label) }).first().click();
  await pollTrue(page, ([s, n]) => document.querySelectorAll('#canvas ' + s).length > n, [blockSel, before.length], 6000);
  await settle(page);
  const fresh = (await ids()).filter((i) => !before.includes(i));
  pre(fresh.length === 1, `메뉴 ${dd} ▸ ${label} 로 블럭 하나 ${JSON.stringify(fresh)}`);
  return fresh[0];
}

// ── 글 블럭 ──
const tbCe = (id) => `[id="${id}"] .tb-body`;
async function clickBlock(page, sel, id) {
  await scrollTo(page, sel);
  const r = await stableTwice(page, sel);
  await clickAt(page, r.left + r.width / 4, r.cy, { sel: `[id="${id}"]`, not: '.tb-rotate-zone, #ss-handles-overlay' }, { label: '고르기 ' + id });
  return pollTrue(page, (id) => !!document.getElementById(id)?.classList.contains('selected') && !document.getElementById(id)?.classList.contains('editing'), id, 3000);
}
async function dblAt(page, sel, hitSel, label) {
  await scrollTo(page, sel);
  const r = await stableTwice(page, sel);
  await clickAt(page, r.left + r.width / 4, r.cy, { sel: hitSel, not: '.tb-rotate-zone, #ss-handles-overlay' }, { label, dbl: true });
}
// 편집 중인 칸(activeElement) 끝에 캐럿만 놓는다
const caretToEndActive = (page) => page.evaluate(() => {
  const ce = document.activeElement; if (!ce || !ce.isContentEditable) return false;
  const rg = document.createRange(); rg.selectNodeContents(ce); rg.collapse(false);
  const s = window.getSelection(); s.removeAllRanges(); s.addRange(rg); return true;
});
// 글 블럭 B 편집 진입 → 자리표시가 통째 골라진 채 '목적' 타이핑 → 끝에 캐럿
async function enterTextDest(page, B) {
  await dblAt(page, tbCe(B), `[id="${B}"]`, '목적지 편집 ' + B);
  pre(await pollTrue(page, (id) => { const tb = document.getElementById(id); const a = document.activeElement; return !!tb && tb.classList.contains('editing') && !!a && a.isContentEditable && tb.contains(a); }, B, 3000), '목적지 글 블럭 편집 들어감');
  await page.keyboard.type('목적');
  pre(await pollTrue(page, (s) => (document.querySelector(s)?.textContent || '') === '목적', tbCe(B), 3000), '목적지 글자 = 목적(자리표시를 덮어씀)');
  pre(await caretToEndActive(page), '목적지 끝에 캐럿');
  return tbCe(B);
}
// 원본 A 꾸밈(패널) — 크기 40 · 굵기 700 · 색 E11D48 · 글꼴 Noto Serif KR → 글자 '굵빨강'
async function styleSource(page, A) {
  pre(await clickBlock(page, tbCe(A), A), 'A 골라짐');
  pre(await pollTrue(page, (id) => document.querySelector('#panel-right .prop-block-id')?.dataset?.copyId === id && !!document.getElementById('txt-size-number'), A, 3000), 'A 글자 패널');
  { const l = page.locator('#txt-size-number'); await l.fill('40'); await l.press('Enter'); }
  await expect.poll(() => page.evaluate((s) => getComputedStyle(document.querySelector(s)).fontSize, tbCe(A)), { message: '장면 미성립: A 크기 40' }).toBe('40px');
  await page.locator('#txt-font-weight').selectOption('700');
  await expect.poll(() => page.evaluate((s) => getComputedStyle(document.querySelector(s)).fontWeight, tbCe(A)), { message: '장면 미성립: A 굵기 700' }).toBe('700');
  { const l = page.locator('#txt-color-hex'); await l.fill('E11D48'); await l.press('Enter'); }
  await expect.poll(() => page.evaluate((s) => getComputedStyle(document.querySelector(s)).color, tbCe(A)), { message: '장면 미성립: A 색 E11D48' }).toBe('rgb(225, 29, 72)');
  await page.click('#txt-font-trigger');
  await page.locator('#txt-font-list .font-item').filter({ has: page.locator('.font-item-name', { hasText: reExact('Noto Serif KR') }) }).first().click();
  await expect.poll(() => page.evaluate((s) => getComputedStyle(document.querySelector(s)).fontFamily, tbCe(A)), { message: '장면 미성립: A 글꼴 Noto Serif KR' }).toContain('Noto Serif KR');
  await settle(page);
  await dblAt(page, tbCe(A), `[id="${A}"]`, 'A 편집');
  pre(await pollTrue(page, (id) => document.getElementById(id)?.classList.contains('editing') && document.activeElement?.isContentEditable, A, 3000), 'A 편집 들어감');
  await page.keyboard.type(WORD);
  pre(await pollTrue(page, ([s, w]) => (document.querySelector(s)?.textContent || '') === w, [tbCe(A), WORD], 3000), `A 글자 = ${WORD}`);
  await page.keyboard.press('Escape');
  pre(await pollTrue(page, (id) => !document.getElementById(id)?.classList.contains('editing'), A, 3000), 'A 편집 끝');
  await settle(page);
}
// 사람 순서: A 더블클릭 → 끝 캐럿 → Shift+← ×3 → ControlOrMeta+C. 짐 = A 계산 4속성(측정)
async function copyFromSource(page, A, o) {
  await installCounters(page);
  await dblAt(page, tbCe(A), `[id="${A}"]`, 'A 편집(복사)');
  pre(await pollTrue(page, (id) => document.getElementById(id)?.classList.contains('editing') && document.activeElement?.isContentEditable, A, 3000), 'A 편집 들어감(복사)');
  pre(await caretToEndActive(page), 'A 끝 캐럿');
  for (let i = 0; i < WORD.length; i++) await page.keyboard.press('Shift+ArrowLeft');
  o.copySel = await page.evaluate(() => window.getSelection().toString());
  pre(o.copySel === WORD, `Shift+← ×${WORD.length} 로 «${WORD}» 골라짐 «${o.copySel}»`);
  o.load = await page.evaluate((s) => { const cs = getComputedStyle(document.querySelector(s)); return { fontWeight: cs.fontWeight, color: cs.color, fontSize: cs.fontSize, fontFamily: cs.fontFamily }; }, tbCe(A));
  const c0 = await page.evaluate(() => window.__pds.copyN);
  await page.keyboard.press(COPY);
  pre(await pollTrue(page, (n) => window.__pds.copyN === n + 1, c0, 3000), 'ControlOrMeta+C 로 copy 이벤트 1회');
}
// 세는 리스너(preventDefault 0) — window capture 에서 paste·copy 를 세고, document bubble 에서 defaultPrevented 를 본다
const installCounters = (page) => page.evaluate(() => {
  if (window.__pds) return;
  window.__pds = { copyN: 0, pasteN: 0, types: [], html: '', plain: '', dp: null };
  window.addEventListener('copy', () => { window.__pds.copyN++; }, true);
  window.addEventListener('paste', (e) => {
    const d = e.clipboardData; window.__pds.pasteN++;
    window.__pds.types = d ? [...d.types] : []; window.__pds.html = d ? d.getData('text/html') : ''; window.__pds.plain = d ? d.getData('text/plain') : '';
  }, true);
  document.addEventListener('paste', (e) => { window.__pds.dp = e.defaultPrevented; }, false);
});

// ── 재기 ──
// 편집칸 읽기: 글자 · html · 서식 요소 수 · 글자 노드 부모들의 계산 4속성 · 캐럿 부모 4속성 · 포커스 여부
const readCe = (page, sel) => page.evaluate(([sel, FMT]) => {
  const ce = document.querySelector(sel); if (!ce) return { exists: false };
  const pick = (e) => { const cs = getComputedStyle(e); return { fontWeight: cs.fontWeight, color: cs.color, fontSize: cs.fontSize, fontFamily: cs.fontFamily }; };
  const parents = []; const w = document.createTreeWalker(ce, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) { if (!n.nodeValue.trim()) continue; parents.push({ text: n.nodeValue.slice(0, 40), tag: n.parentElement.tagName, ...pick(n.parentElement) }); }
  const s = window.getSelection(); let caret = null;
  if (s && s.rangeCount && ce.contains(s.anchorNode)) { const an = s.anchorNode; caret = { collapsed: s.isCollapsed, ...pick(an.nodeType === 1 ? an : an.parentElement) }; }
  return { exists: true, text: ce.textContent, html: ce.innerHTML, fmt: ce.querySelectorAll(FMT).length, parents, caret,
    active: document.activeElement === ce, editable: ce.isContentEditable };
}, [sel, FMT_SEL]);
const P4 = (x) => x && { fontWeight: x.fontWeight, color: x.color, fontSize: x.fontSize, fontFamily: x.fontFamily };
const countOf = (t, w) => (String(t || '').split(w).length - 1);
// 짐 4속성과 목적지 4속성이 «넷 다» 다른가 (SYN 짐은 글꼴 이름 포함으로 견준다)
function loadDiffers(dest, load) {
  return { fontWeight: dest.fontWeight !== load.fontWeight, color: dest.color !== load.color, fontSize: dest.fontSize !== load.fontSize,
    fontFamily: load.fontFamily.includes(',') || load.fontFamily.includes('"') ? dest.fontFamily !== load.fontFamily : !dest.fontFamily.includes(load.fontFamily) };
}
// 붙이기 전 전제: 포커스·캐럿(접힘) · 글자 부모가 한 꼴 = 캐럿 부모 · 짐과 넷 다 다름
function premiseBefore(o, r0, load) {
  pre(r0.exists && r0.active && r0.editable, `편집칸에 포커스 ${JSON.stringify({ active: r0.active, editable: r0.editable })}`);
  pre(r0.caret && r0.caret.collapsed, `편집칸 안 접힌 캐럿 ${JSON.stringify(r0.caret)}`);
  o.uniform = r0.parents.every((p) => JSON.stringify(P4(p)) === JSON.stringify(P4(r0.caret)));
  pre(o.uniform, `붙이기 전 편집칸 글자 부모가 한 꼴(= 캐럿 부모) ${JSON.stringify(r0.parents)}`);
  o.differs = loadDiffers(P4(r0.caret), load);
  pre(Object.values(o.differs).every(Boolean), `목적지 4속성 ≠ 짐 ${JSON.stringify({ dest: P4(r0.caret), load, differs: o.differs })}`);
}
// SYN 쏘기 — 포커스된 편집칸에 합성 paste
const synPaste = (page) => page.evaluate(([text, html]) => {
  const ce = document.activeElement; const dt = new DataTransfer(); dt.setData('text/plain', text); dt.setData('text/html', html);
  const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }); ce.dispatchEvent(ev);
  return { defaultPrevented: ev.defaultPrevented };
}, [WORD, SYN_HTML]);
// 붙인 뒤: 글자가 들어올 때까지(ⓐ) → 편집칸 innerHTML 이 4번 연달아 같을 때까지
async function afterPaste(page, sel) {
  const came = await pollTrue(page, ([s, w]) => (document.querySelector(s)?.textContent || '').includes(w), [sel, WORD], 4000);
  await page.evaluate(() => { window.__pdsH = null; window.__pdsHN = 0; });
  await pollTrue(page, (s) => { const h = document.querySelector(s)?.innerHTML ?? ''; if (h === window.__pdsH) window.__pdsHN++; else { window.__pdsH = h; window.__pdsHN = 0; } return window.__pdsHN >= 4; }, sel, 4000);
  return came;
}
// ⓐⓑⓒⓔ 판정(값만) — 단언은 test 끝에서
function judge(o, r0, r1) {
  const base = JSON.stringify(P4(r0.caret));
  o.v = o.v || {};
  o.v.a = !!(r1.exists && (r1.text || '').includes(WORD));
  o.v.b = r1.fmt === r0.fmt;
  o.v.c = r1.parents.length > 0 && r1.parents.every((p) => JSON.stringify(P4(p)) === base);
  o.v.eN = countOf(r1.text, WORD);
  o.v.e = o.v.eN === 1;   // 두 길 다 — 합성 paste 도 한 번 쏜다(기본 동작 0) ⇒ 리스너 넣기도 한 번이어야(S3 이중 넣기가 SYN 에서도 났다 · a-diag-1)
}
const markersNew = (h0, h1) => MARKERS.filter((m) => !String(h0).includes(m) && String(h1).includes(m));

// ★todo — PASTE-DOUBLE-INSERT-LINE-IN-BUBBLE-01 (★임시 이름 · 지디 확정 전 · 지디 판정 261022: test.fail/skip/fixme 아님 · todo)
//   결함: 본문을 한 번 편집한 말풍선의 «줄» 편집 중 붙여넣기 1회에 글자가 두 번 들어간다(KEY·SYN 둘 다 · 바닥 05eefbd5 에 있다).
//   원인(a 보고 · logs/a-diag-1.log): ① js/blocks/line-host.js:803 onPaste 가 execCommand('insertText') 후 stopPropagation 이 없다
//     ＋ ② js/block-drag.js:1281–1288 _bindTextEditEl paste 리스너가 .tb-bubble 에 최초 1회 걸리고(:1451) 안 떼져서, 올라온 이벤트로 한 번 더 넣는다.
//   ⛔제품 고침은 ⑴ 범위 밖(별건).
//   꼴: playwright 엔 node:test { todo } 가 없고 이 집 dom spec 에도 todo 관용구가 없다 ⇒ ★S3 의 ⓔ 한 단언만 test.info().annotations {type:'todo'} ＋ console «TODO …» 로 돌린다.
//     ⓐⓑⓒⓓ·장면 전제는 그대로 단언 ⇒ 이 todo 가 다음 빨강을 가리지 않는다. 잰 수(count · 글자)는 todo 문자열에 그대로 찍는다.
//   닫힘: ⓔ 가 서면(count 1) soft 빨강 «todo 가 닫혔다» ⇒ 고치는 커밋에서 TODO_DOUBLE 을 떼고 ⓔ 를 보통 단언으로.
const TODO_DOUBLE = 'PASTE-DOUBLE-INSERT-LINE-IN-BUBBLE-01(임시 이름) — 닫는 이: 별건 제품 고침 카드(line-host.js:803 · block-drag.js:1281–1288 · 지디 배정)';
// 공통 단언(soft) — ⓐ 는 전제라 hard
function assertCell(o, todoE) {
  console.log(`PDS ${o.cell} ${JSON.stringify(o.v || null)}${o.err ? ' ERR ' + o.err.slice(0, 160) : ''}`);
  expect(o.err, '장면 미성립(예외 — 메시지 머리를 보라)').toBeUndefined();
  expect(o.v.a, `장면 미성립 ⓐ: 붙인 글자 «${WORD}» 가 편집칸에 들어왔다 — 뒤 «${o.r1?.text}»`).toBe(true);
  expect.soft(o.v.b, `성공 ⓑ: 편집칸 서식 요소(${FMT_SEL}) 수 불변 ${o.r0?.fmt}→${o.r1?.fmt} · html «${String(o.r1?.html).slice(0, 200)}»`).toBe(true);
  expect.soft(o.v.c, `성공 ⓒ: 모든 글자 부모 계산 4속성 = 붙이기 전 캐럿 부모 ${JSON.stringify(P4(o.r0?.caret))} · 뒤 ${JSON.stringify(o.r1?.parents)}`).toBe(true);
  expect.soft(o.v.d, `성공 ⓓ: 확정 뒤 데이터에 짐 서식 0 ${JSON.stringify(o.dData)}`).toBe(true);
  expect.soft(o.pageerror, 'pageerror 0').toEqual([]);
  if (!todoE) { expect.soft(o.v.e, `성공 ⓔ: 붙인 글자가 한 번만 — count:${o.v.eN} «${o.r1?.text}»`).toBe(true); return; }
  if (o.v.e === false) {
    const d = `${todoE} · ${o.cell} 잰 값 count:${o.v.eN} «${o.r1?.text}»`;
    test.info().annotations.push({ type: 'todo', description: d });
    console.log(`TODO ${d}`);
    // todo 는 «지금 잰 꼴»만 덮는다 — 더 나빠지면(세 번 · 다른 글자) 빨강
    expect.soft(o.r1?.text, `todo 수 고정 — ${todoE} · 잰 꼴 count:2 «말풍선${WORD}${WORD}» 와 달라졌다`).toBe('말풍선' + WORD + WORD);
  } else expect.soft(o.v.e, `todo 가 닫혔다 — ${todoE} · ${o.cell} count:${o.v.eN} «${o.r1?.text}» ⇒ TODO_DOUBLE 을 떼고 ⓔ 를 보통 단언으로`).toBe(false);
}
// KEY 전제 — 진짜 키가 paste 를 한 번 일으켰고 방금 복사한 글자·html 을 실었다
function keyPremise(o) {
  o.clip = { ...o.pds, html: String(o.pds.html).slice(0, 400) };
  pre(o.pds.pasteN === 1, `ControlOrMeta+V 로 paste 이벤트 1회 ${o.pds.pasteN}`);
  pre(o.pds.plain === WORD, `받은 text/plain = 방금 복사한 «${WORD}» «${o.pds.plain}»`);
  pre(o.pds.types.includes('text/html') && /font-weight|<b|color/.test(o.pds.html), `text/html 에 서식이 실렸다 ${JSON.stringify(o.clip)}`);
}
const keyPaste = async (page) => {
  await page.evaluate(() => { window.__pds.pasteN = 0; window.__pds.dp = null; window.__pds.html = ''; window.__pds.plain = ''; window.__pds.types = []; });
  await page.keyboard.press(PASTE);
};
const blockCount = (page) => page.evaluate(() => document.querySelectorAll('#canvas .section-inner [id]:is(.text-block,.frame-block,.speech-bubble-block)').length);

// ───────────────────────── P0 판 정체 ─────────────────────────
test.describe('S6 [10] ⑴ 붙여넣기 = 목적지 서식 잠금', () => {
  test('P0 판 정체 — HEAD = EXPECT_SHA · 페이지가 받은 ID_FILES 바이트 sha1 = 디스크 = EXPECT_FILES_SHA1 @pds @pds-id', async ({ page }) => {
    const want = process.env.EXPECT_SHA || '';
    expect(/^[0-9a-f]{40}$/.test(want), `EXPECT_SHA 는 40 hex — 받은 값 «${want}»`).toBe(true);
    let wantMap = null;
    try { wantMap = JSON.parse(process.env.EXPECT_FILES_SHA1 || ''); } catch (_) { wantMap = null; }
    expect(wantMap && typeof wantMap === 'object', `EXPECT_FILES_SHA1 은 JSON 객체 — 받은 값 «${process.env.EXPECT_FILES_SHA1 || ''}»`).toBe(true);
    expect(Object.keys(wantMap).sort(), 'EXPECT_FILES_SHA1 열쇠 = ID_FILES 그대로').toEqual([...ID_FILES].sort());
    for (const rel of ID_FILES) expect(/^[0-9a-f]{40}$/.test(String(wantMap[rel])), `EXPECT_FILES_SHA1[${rel}] 은 40 hex — 받은 값 «${wantMap[rel]}»`).toBe(true);
    const head = execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    expect(head, `git -C ${ROOT} rev-parse HEAD`).toBe(want);
    const errs = await bootApp(page);
    for (const rel of ID_FILES) {
      const d = sha1(fs.readFileSync(path.join(ROOT, rel)));
      const got = await page.evaluate(async (r) => {
        const res = await fetch('/' + r, { cache: 'no-store' });
        if (!res.ok) return null;
        const u8 = new Uint8Array(await res.arrayBuffer());
        let s = '';
        for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
        return btoa(s);
      }, rel);
      expect(got, `전제: 페이지가 ${rel} 를 받았다`).toBeTruthy();
      const sv = sha1(Buffer.from(got, 'base64'));
      expect(sv, `${rel}: 페이지가 받은 바이트 = 디스크`).toBe(d);
      expect(sv, `${rel}: 페이지가 받은 바이트 = EXPECT_FILES_SHA1`).toBe(wantMap[rel]);
    }
    expect(errs, 'pageerror').toEqual([]);
  });

  // ───────────────────────── 글 블럭 장면 ─────────────────────────
  // 새 섹션 → Text ▾ Body(A, KEY 만) → 섹션 다시 고름 → Text ▾ Body(B)
  async function textScene(page, o, withSource) {
    o.sec = await newSection(page);
    if (withSource) { o.A = await insFromMenu(page, 'text', 'Body', '.text-block'); await styleSource(page, o.A); pre(await clickBlock(page, tbCe(o.A), o.A), '다음 블럭 넣기 전 A 를 고름(A 다음 자리에 들어간다)'); }
    o.B = await insFromMenu(page, 'text', 'Body', '.text-block');
    pre(await sameSec(page, o.B, o.sec), 'B 가 새 섹션 안');
  }

  // 재는 축: KEY 길 전제(이벤트 · 클립보드 · 리스너가 막았나 · ⌘V 가 블럭 붙여넣기로 안 샘) / 안 재는 축: 붙은 글자 서식(S1-KEY 몫)
  test('K1 KEY 길 전제 — 진짜 키 paste 1회 · html 실림 · 글 블럭 리스너가 기본 동작을 막음 · 블럭 수 불변 @pds @pds-style', async ({ page }, ti) => {
    test.setTimeout(150000);
    const Bt = await boot(page); const o = { cell: 'K1' };
    try {
      await textScene(page, o, true);
      await copyFromSource(page, o.A, o);
      const sel = await enterTextDest(page, o.B);
      o.n0 = await blockCount(page);
      await keyPaste(page);
      await afterPaste(page, sel);
      await settle(page);
      o.pds = await page.evaluate(() => ({ ...window.__pds }));
      o.n1 = await blockCount(page);
      keyPremise(o);
    } catch (e) { o.err = String(e).slice(0, 800); }
    finally { Object.assign(o, errsOf(Bt)); await attach(ti, 'pds-K1.json', o); }
    console.log(`PDS K1 ${JSON.stringify({ dp: o.pds?.dp, n0: o.n0, n1: o.n1 })}${o.err ? ' ERR ' + o.err.slice(0, 160) : ''}`);
    expect(o.err, '장면 미성립(예외 — 메시지 머리를 보라)').toBeUndefined();
    expect.soft(o.pds.dp, '성공: 글 블럭 paste 리스너가 기본 동작을 막았다(document 버블에서 defaultPrevented)').toBe(true);
    expect.soft(o.n1, `성공: ⌘V 가 블럭 붙여넣기로 새지 않았다(블럭 수 ${o.n0}→${o.n1})`).toBe(o.n0);
    expect.soft(o.pageerror, 'pageerror 0').toEqual([]);
  });

  // 재는 축: 글 블럭 리스너 논리(ⓑⓒ) + 한 번만(ⓔ) + 확정 뒤 편집칸 DOM innerHTML(ⓓ · 직렬화 저장 경로는 안 잰다) / 안 재는 축: 기본 동작(합성 = 0 — M1·M2 는 KEY 몫)
  for (const way of ['SYN', 'KEY']) {
    test(`S1-${way} 글 블럭 편집 중 붙여넣기 — 붙은 글자 = 목적지 서식 · 확정 뒤 짐 서식 0 @pds @pds-style`, async ({ page }, ti) => {
      test.setTimeout(150000);
      const Bt = await boot(page); const o = { cell: 'S1-' + way };
      try {
        await textScene(page, o, way === 'KEY');
        if (way === 'KEY') await copyFromSource(page, o.A, o);
        const sel = await enterTextDest(page, o.B);
        o.r0 = await readCe(page, sel);
        premiseBefore(o, o.r0, way === 'KEY' ? o.load : SYN_LOAD);
        if (way === 'KEY') await keyPaste(page); else o.dispatch = await synPaste(page);
        o.came = await afterPaste(page, sel);
        o.r1 = await readCe(page, sel);
        if (way === 'KEY') { o.pds = await page.evaluate(() => ({ ...window.__pds })); keyPremise(o); }
        judge(o, o.r0, o.r1);
        if (o.v.a) {
          await page.keyboard.press('Escape');
          pre(await pollTrue(page, (id) => !document.getElementById(id)?.classList.contains('editing'), o.B, 3000), '목적지 편집 끝(Escape)');
          await settle(page);
          o.r2 = await readCe(page, sel);
          o.dData = { fmt0: o.r0.fmt, fmt2: o.r2.fmt, newMarkers: markersNew(o.r0.html, o.r2.html), html: String(o.r2.html).slice(0, 300) };
          o.v.d = o.r2.fmt === o.r0.fmt && o.dData.newMarkers.length === 0;
        }
      } catch (e) { o.err = String(e).slice(0, 800); }
      finally { Object.assign(o, errsOf(Bt)); await attach(ti, `pds-${o.cell}.json`, o); }
      assertCell(o);
    });
  }

  // ───────────────────────── 말풍선 장면 ─────────────────────────
  // 새 섹션 → (KEY: Body A) → Text ▾ Bubble(B)
  async function bubbleScene(page, o, withSource) {
    o.sec = await newSection(page);
    if (withSource) { o.A = await insFromMenu(page, 'text', 'Body', '.text-block'); await styleSource(page, o.A); pre(await clickBlock(page, tbCe(o.A), o.A), '다음 블럭 넣기 전 A 를 고름(A 다음 자리에 들어간다)'); }
    o.B = await insFromMenu(page, 'text', 'Bubble', '.speech-bubble-block');
    pre(await sameSec(page, o.B, o.sec), '말풍선이 새 섹션 안');
  }
  const nameSel = (id) => `[id="${id}"] .tb-sender-name`;

  // 재는 축: 이름표 onPaste 논리(ⓑⓒ) + 한 번만(ⓔ) + 확정(Enter) 뒤 dataset.senderName 평문(ⓓ — 확정이 평문화하므로 «붙여넣기가 서식을 안 실음»이 아니라 «확정 정규화»를 잠근다 · M3-S2 에서 ⓓ 초록) / 안 재는 축: 기본 동작(SYN) · 이름표 밖 본문
  for (const way of ['SYN', 'KEY']) {
    test(`S2-${way} 말풍선 발신자 이름 편집 중 붙여넣기 — 목적지 서식 · 확정 뒤 이름 평문 @pds @pds-style`, async ({ page }, ti) => {
      test.setTimeout(150000);
      const Bt = await boot(page); const o = { cell: 'S2-' + way };
      try {
        await bubbleScene(page, o, way === 'KEY');
        // 패널 「발신자 이름」 켜기(앱 문) — 기본은 숨김
        pre(await clickBlock(page, `[id="${o.B}"] .tb-bubble`, o.B), '말풍선 골라짐');
        await page.locator('label.prop-toggle:has(#bubble-show-sender)').click();   // 토글 스위치(입력칸은 숨김)
        pre(await pollTrue(page, () => document.getElementById('bubble-show-sender')?.checked === true, null, 3000), '패널 「발신자 이름」 켜짐');
        pre(await pollTrue(page, (s) => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.offsetWidth > 0; }, nameSel(o.B), 3000), '이름표가 보인다');
        await settle(page);
        if (way === 'KEY') await copyFromSource(page, o.A, o);
        await dblAt(page, nameSel(o.B), '.tb-sender-name', '이름표 편집');
        pre(await pollTrue(page, (s) => { const e = document.querySelector(s); return !!e && e.getAttribute('contenteditable') === 'true' && document.activeElement === e; }, nameSel(o.B), 3000), '이름표 편집 들어감');
        pre(await caretToEndActive(page), '이름표 끝 캐럿');
        o.r0 = await readCe(page, nameSel(o.B));
        premiseBefore(o, o.r0, way === 'KEY' ? o.load : SYN_LOAD);
        if (way === 'KEY') await keyPaste(page); else o.dispatch = await synPaste(page);
        o.came = await afterPaste(page, nameSel(o.B));
        o.r1 = await readCe(page, nameSel(o.B));
        if (way === 'KEY') { o.pds = await page.evaluate(() => ({ ...window.__pds })); keyPremise(o); }
        judge(o, o.r0, o.r1);
        if (o.v.a) {
          await page.keyboard.press('Enter');
          pre(await pollTrue(page, (s) => !document.querySelector(s)?.hasAttribute('contenteditable'), nameSel(o.B), 3000), '이름 확정(Enter)');
          await settle(page);
          o.dData = await page.evaluate(([id, s]) => { const b = document.getElementById(id); const e = document.querySelector(s); return { senderName: b.dataset.senderName, text: e.textContent, children: e.children.length, html: e.innerHTML.slice(0, 300) }; }, [o.B, nameSel(o.B)]);
          o.v.d = o.dData.senderName === o.dData.text && o.dData.children === 0 && o.dData.senderName.includes(WORD);
        }
      } catch (e) { o.err = String(e).slice(0, 800); }
      finally { Object.assign(o, errsOf(Bt)); await attach(ti, `pds-${o.cell}.json`, o); }
      assertCell(o);
    });
  }

  // 재는 축: 줄 onPaste 논리(ⓑⓒ) + 한 번만(ⓔ · todo) + 줄 커밋 뒤 모델(dataset.lines[0]) 의 textHtml·글자 꼴(ⓓ) / 안 재는 축: 기본 동작(SYN) · Chat·Comparison·Laurel·Card 줄(같은 lnBeginEdit — 주인만 다름)
  for (const way of ['SYN', 'KEY']) {
    test(`S3-${way} 말풍선 줄 편집 중 붙여넣기 — 목적지 서식 · 줄 커밋 뒤 textHtml 0 @pds @pds-style`, async ({ page }, ti) => {
      test.setTimeout(150000);
      const Bt = await boot(page); const o = { cell: 'S3-' + way };
      try {
        await bubbleScene(page, o, way === 'KEY');
        // 줄 모드는 기본이 아니다(전제로 잰다) — 본문에 '말풍선' 을 치고 캔버스 ＋(앱 문)로 줄 모드에 들어간다
        o.linesAtBirth = await page.evaluate((id) => document.getElementById(id).dataset.lines ?? null, o.B);
        pre(o.linesAtBirth === null, `새 말풍선은 줄 모드가 아니다(기본) ${o.linesAtBirth}`);
        await dblAt(page, `[id="${o.B}"] .tb-bubble`, `[id="${o.B}"]`, '말풍선 본문 편집');
        pre(await pollTrue(page, (id) => document.getElementById(id)?.classList.contains('editing') && document.activeElement?.isContentEditable, o.B, 3000), '말풍선 본문 편집 들어감');
        await page.keyboard.type('말풍선');
        await page.keyboard.press('Escape');
        pre(await pollTrue(page, (id) => { const b = document.getElementById(id); return b.classList.contains('selected') && !b.classList.contains('editing'); }, o.B, 3000), '말풍선 골라진 채 편집 끝');
        const plus = `#grd-plus-layer > .ln-add-btn[data-ln-for="${o.B}"]`;
        pre(await pollTrue(page, (s) => !!document.querySelector(s), plus, 4000), '캔버스 ＋ 가 떴다');
        const pr = await stableTwice(page, plus);
        await clickAt(page, pr.cx, pr.cy, { sel: '.ln-add-btn' }, { label: '줄 ＋' });
        pre(await pollTrue(page, (id) => { try { return JSON.parse(document.getElementById(id).dataset.lines || '[]').length >= 1 && !!document.querySelector(`[id="${id}"] .ln-row[data-ln="0"] > .grd-line`); } catch { return false; } }, o.B, 4000), '줄 모드가 됐다(dataset.lines · .ln-row)');
        await settle(page);
        o.line0 = await page.evaluate((id) => JSON.parse(document.getElementById(id).dataset.lines)[0], o.B);
        pre(o.line0 && o.line0.text === '말풍선', `첫 줄 = 구운 본문 «말풍선» ${JSON.stringify(o.line0)}`);
        if (way === 'KEY') await copyFromSource(page, o.A, o);
        const rowSel = `[id="${o.B}"] .ln-row[data-ln="0"] > .grd-line`;
        await dblAt(page, rowSel, '.ln-row', '줄 0 편집');
        pre(await pollTrue(page, (s) => { const e = document.querySelector(s); return !!e && e.getAttribute('contenteditable') === 'true' && document.activeElement === e; }, rowSel, 3000), '줄 0 편집 들어감');
        pre(await caretToEndActive(page), '줄 0 끝 캐럿');
        o.r0 = await readCe(page, rowSel);
        premiseBefore(o, o.r0, way === 'KEY' ? o.load : SYN_LOAD);
        if (way === 'KEY') await keyPaste(page); else o.dispatch = await synPaste(page);
        o.came = await afterPaste(page, rowSel);
        o.r1 = await readCe(page, rowSel);
        if (way === 'KEY') { o.pds = await page.evaluate(() => ({ ...window.__pds })); keyPremise(o); }
        judge(o, o.r0, o.r1);
        if (o.v.a) {
          await page.keyboard.press('Escape');
          pre(await pollTrue(page, (id) => !document.getElementById(id)?.classList.contains('editing'), o.B, 3000), '줄 커밋(Escape)');
          await settle(page);
          o.dData = await page.evaluate((id) => JSON.parse(document.getElementById(id).dataset.lines)[0], o.B);
          const keep = ['fontSize', 'weight', 'color', 'fontFamily', 'italic'];
          o.v.d = String(o.dData.text || '').includes(WORD) && !o.dData.textHtml && keep.every((k) => JSON.stringify(o.dData[k]) === JSON.stringify(o.line0[k]));
        }
      } catch (e) { o.err = String(e).slice(0, 800); }
      finally { Object.assign(o, errsOf(Bt)); await attach(ti, `pds-${o.cell}.json`, o); }
      assertCell(o, TODO_DOUBLE);
    });
  }
});
