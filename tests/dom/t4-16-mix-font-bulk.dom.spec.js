// t4-16-mix-font-bulk.dom.spec.js — S3 t4-16 «mix 블럭의 전체 굵기·글꼴이 일괄로 안 바뀐다» 성공 단언 (커밋 spec).
// 현빈 원문: «텍스트 블럭 중에 폰트나 색상이 mix인 경우 폰트 스타일을 바꾸면 일괄 바꿔져야되는데 그러지 않는 문제»
// 돌리는 법(레인에서):
//   EXPECT_SHA=<판 sha> bash ~/taeyang-098/run-test.sh dom tests/dom/t4-16-mix-font-bulk.dom.spec.js --grep @t416
//   (EXPECT_SHA 가 없으면 B0 판 정체만 건너뛴다)
// 칸:
//   W1 부분 굵기 span + 부분 색 → 전체 굵기 700 = 글자 전부 700 · font-weight span 0 · 색 span 은 남는다
//   W2 ⌘B 부분 <b> → 전체 굵기 300 = 글자 전부 300 · b/strong 0
//   F1 [전제: 심은 꼴] font-family span 하나(앱에 부분 글꼴 문이 없어서 evaluate 로 심는다 — 이 칸만) → 글꼴 고름 = 전부 그 체인 · 인라인 font-family 0 · 빈 span 0
//   지킴(바닥에서도 초록): G1 전체 크기 · G2 전체 색 · G3 부분 선택이 있으면 그 범위만(굵기)
// 양성대조: 바닥 핀(f7355b4e)에서 W1·W2·F1 은 빨강, G1·G2·G3 은 초록이어야 한다.
// 규칙:
//  - 장면은 앱 제 문(새 섹션 단추 · 플로팅 텍스트 메뉴 · 섹션 꼬리표 · 글자 클릭/더블클릭 · 키보드 · 패널 칸)으로만 짓는다.
//    생성 함수(add·make 계열) evaluate 호출 0. evaluate 는 읽기와 scrollIntoView 뿐 — 예외는 F1 의 «심은 꼴» 한 번(제목·주석에 표시).
//  - 고정 대기 0줄 — 기다림은 waitForFunction(polling) / expect.poll / 하네스 waitStableRect 뿐.
//  - 장면(전제)은 hard expect — 메시지 머리 «장면 미성립:» (빨강이면 제품 결함이 아니라 장면이 안 선 것) · 제품 단언은 expect.soft — 머리 «성공:».
//  - 블록 주석을 쓰지 않는다(별-슬래시 사고 방지) — 줄 주석만.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { ROOT, ORIGIN, bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

const VIEW = { width: 1500, height: 1000 };
const TEXT = 'AAA BBB CCC';
const WORD_AT = { AAA: 0, BBB: 4, CCC: 8 };
const RED = { hex: 'E11D48', rgb: 'rgb(225, 29, 72)' };
const BLUE = { hex: '2563EB', rgb: 'rgb(37, 99, 235)' };

// ── 판 정체 (EXPECT_SHA 있을 때만) ──
// ⑴ git -C ROOT rev-parse HEAD === EXPECT_SHA
// ⑵ 이 고침이 만진 파일 3개: 페이지가 fetch 로 받은 바이트의 git blob sha1 === git -C ROOT rev-parse EXPECT_SHA:<file>
const EXPECT_SHA = process.env.EXPECT_SHA || '';
const IDENT_FILES = ['js/props/prop-text-wireup-font.js', 'js/props/prop-text-wireup-text-edit.js', 'js/props/prop-text-utils.js'];
const sha1 = (b) => crypto.createHash('sha1').update(b).digest('hex');
const blobSha1 = (buf) => sha1(Buffer.concat([Buffer.from('blob ' + buf.length + '\0'), buf]));

// ── 띄우기 · 기다리기 ──
async function boot(page) {
  page.on('dialog', d => { d.dismiss().catch(() => {}); });
  await page.setViewportSize(VIEW);
  return bootApp(page);
}
async function pollTrue(page, fn, arg, timeout = 6000) {
  try { await page.waitForFunction(fn, arg, { timeout, polling: 100 }); return true; } catch { return false; }
}
// 가라앉힘 — 캔버스 innerHTML · 선택 id · 패널 머리 id 가 연달아 4번(100ms 간격) 같을 때까지
async function settle(page, timeout = 8000) {
  await page.evaluate(() => { window.__t416Last = null; window.__t416N = 0; });
  return pollTrue(page, () => {
    const c = document.getElementById('canvas');
    const s = (c ? c.innerHTML : '') + '|' + [...document.querySelectorAll('#canvas .selected')].map(e => e.id).join(',')
      + '|' + (document.querySelector('#panel-right .prop-block-id')?.dataset?.copyId || '');
    if (s === window.__t416Last) window.__t416N++; else { window.__t416Last = s; window.__t416N = 0; }
    return window.__t416N >= 4;
  }, null, timeout);
}
async function stableTwice(page, sel, index = 0) {
  const a = await waitStableRect(page, sel, { index }); const b = await waitStableRect(page, sel, { index });
  return { ...b, twiceSame: a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height };
}
async function scrollTo(page, sel) { await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center', behavior: 'instant' }), sel); }
const secIds = (page) => page.evaluate(() => [...document.querySelectorAll('#canvas .section-block:not([data-ghost])')].map(s => s.id));
const textIds = (page) => page.evaluate(() => [...document.querySelectorAll('#canvas .text-block')].map(t => t.id));
const CE = (id) => `[id="${id}"] [class^="tb-"]`;

// ── 앱 제 문 ──
const reExact = (s) => new RegExp('^\\s*' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$');
async function insText(page, label) {
  const before = await textIds(page);
  await page.click('#fp-text-dropdown .fp-dropdown-trigger');
  await page.locator('#fp-text-menu .fp-menu-item').filter({ hasText: reExact(label) }).first().click();
  await pollTrue(page, (n) => document.querySelectorAll('#canvas .text-block').length > n, before.length, 6000);
  await settle(page);
  const fresh = (await textIds(page)).filter(i => !before.includes(i));
  return fresh.length === 1 ? fresh[0] : null;
}
async function pickSec(page, id) {
  const SEC = `[id="${id}"]`; await scrollTo(page, SEC);
  const hz = await stableTwice(page, SEC + ' .section-hitzone');
  await clickAt(page, hz.left + 20, hz.cy, { sel: SEC + ' .section-hitzone' }, { label: '섹션 꼬리표' });
  return pollTrue(page, (id) => window.getSelectedSection?.()?.id === id && !!document.getElementById(id)?.classList.contains('selected'), id, 3000);
}
async function newSection(page) {
  const before = await secIds(page);
  await page.click('.fp-btn.primary[title="새 섹션 추가"]');
  await pollTrue(page, (n) => document.querySelectorAll('#canvas .section-block:not([data-ghost])').length > n, before.length);
  const id = (await secIds(page)).find(x => !before.includes(x)) || null;
  if (!id) return { id: null, picked: false };
  let picked = await page.evaluate((id) => window.getSelectedSection?.()?.id === id, id);
  if (!picked) picked = await pickSec(page, id);
  await settle(page);
  return { id, picked };
}
// 글자 블럭 누르기 — 골라지고 패널 머리 id 가 그 블럭이 될 때까지
async function clickText(page, id) {
  await scrollTo(page, CE(id));
  const r = await stableTwice(page, CE(id));
  await clickAt(page, r.left + Math.min(30, r.width / 3), r.cy, { sel: `[id="${id}"]`, not: '.tb-rotate-zone, #ss-handles-overlay' }, { label: '글자 고르기 ' + id });
  const selected = await pollTrue(page, (id) => !!document.getElementById(id)?.classList.contains('selected'), id, 3000);
  const panelOk = await pollTrue(page, (id) => document.querySelector('#panel-right .prop-block-id')?.dataset?.copyId === id && !!document.getElementById('txt-font-weight'), id, 3000);
  await settle(page);
  return selected && panelOk;
}
// 새 섹션 → Body 하나 → 고르고 더블클릭으로 편집 → ⌘A 뒤 TEXT 를 친다
async function sceneEditing(page) {
  const sec = await newSection(page);
  expect(sec.id && sec.picked, `장면 미성립: 새 섹션이 생기고 골라졌다 ${JSON.stringify(sec)}`).toBeTruthy();
  const id = await insText(page, 'Body');
  expect(id, '장면 미성립: 플로팅 텍스트 메뉴로 Body 하나가 생겼다').toBeTruthy();
  expect(await clickText(page, id), '장면 미성립: Body 를 누르면 골라지고 패널 = 그 블럭').toBe(true);
  const r = await stableTwice(page, CE(id));
  await clickAt(page, r.left + r.width - 4, r.cy, { sel: `[id="${id}"]` }, { label: '편집 더블클릭', dbl: true });
  expect(await pollTrue(page, (s) => document.querySelector(s)?.getAttribute('contenteditable') === 'true', CE(id)), '장면 미성립: 더블클릭 = 편집').toBe(true);
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type(TEXT);
  expect(await pollTrue(page, ([s, t]) => document.querySelector(s)?.textContent === t, [CE(id), TEXT]), `장면 미성립: 글자 = ${TEXT}`).toBe(true);
  return { sec: sec.id, id };
}
// 편집 중 글자칸 안에서 낱말 하나를 ⇧→ 로 고른다
// 캐럿을 맨 앞으로 = ← 를 글자 수만큼(맥 Chromium 은 Home 이 캐럿을 안 옮긴다 — 첫 판 ×3 빨강의 원인) · 맨 앞에서 더 누른 ← 는 아무 일도 안 한다
async function selWord(page, id, word) {
  for (let i = 0; i <= TEXT.length; i++) await page.keyboard.press('ArrowLeft');
  for (let i = 0; i < WORD_AT[word]; i++) await page.keyboard.press('ArrowRight');
  for (let i = 0; i < word.length; i++) await page.keyboard.press('Shift+ArrowRight');
  const ok = await pollTrue(page, ([s, w]) => { const g = getSelection(); const h = document.querySelector(s);
    return g.rangeCount === 1 && g.toString() === w && !!h && h.contains(g.anchorNode) && h.contains(g.focusNode); }, [CE(id), word], 3000);
  const now = ok ? null : await page.evaluate(() => ({ sel: getSelection().toString(), act: document.activeElement?.className || document.activeElement?.tagName }));
  expect(ok, `장면 미성립: 글자칸 안에 ${word} 가 선택됐다 ${JSON.stringify(now)}`).toBe(true);
}
// 패널 칸에 있다가 세워 둔 편집 글자칸으로 돌아온다(글자를 한 번 누름)
async function backToText(page, id) {
  const r = await stableTwice(page, CE(id));
  await clickAt(page, r.left + Math.min(30, r.width / 3), r.cy, { sel: CE(id) }, { label: '편집 글자칸으로 돌아옴' });
  expect(await pollTrue(page, (s) => { const h = document.querySelector(s); return !!h && h.getAttribute('contenteditable') === 'true' && (document.activeElement === h || h.contains(document.activeElement)); }, CE(id), 3000),
    '장면 미성립: 편집 글자칸에 포커스가 돌아왔다').toBe(true);
}
// 패널 칸을 진짜 마우스로 누른다(왼쪽 가까이)
async function clickField(page, sel) {
  await scrollTo(page, sel);
  const b = await stableTwice(page, sel);
  // 맞힌 요소가 그 칸 «안»(자식 span 포함)이면 된다 — '#id' 꼴은 clickAt 이 id 일치만 보므로 [id=] 꼴로 넘긴다
  await clickAt(page, b.left + Math.min(12, b.width / 3), b.cy, { sel: `[id="${sel.replace(/^#/, '')}"]` }, { label: '패널 칸 ' + sel });
}
// 부분 색: hex 칸에 타이핑 + Enter (선택은 패널 pointerdown 위임이 먼저 저장)
async function partialHex(page, hex) {
  await clickField(page, '#txt-color-hex');
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type(hex);
  await page.keyboard.press('Enter');
}
// 부분 굵기: select 를 진짜로 눌러 열고 글자키(type-ahead) 하나 — 'l' = Light 300 (L 로 시작하는 줄은 하나뿐)
async function partialWeightLight(page) {
  await clickField(page, '#txt-font-weight');
  await page.keyboard.press('l');
}
// 선택 풀기 — 편집 밖 Esc(전역 deselectAll) → 그 블럭이 안 골라진 상태가 될 때까지
async function escDeselect(page, id) {
  await page.keyboard.press('Escape');
  expect(await pollTrue(page, (i) => !document.getElementById(i)?.classList.contains('selected'), id, 3000), '장면 미성립: 편집 밖 Esc = 블럭 선택 풀림').toBe(true);
}
// 편집을 끝낸다 — 글자칸으로 돌아와 Esc(블럭 Esc = 편집 끝 · 블럭 선택 유지 · block-drag.js 규약) → Esc 한 번 더(선택 풀기)
//   → 블럭을 다시 눌러 패널을 새로 그린다(Mix 판정은 패널을 그릴 때 한다)
// ⚠️첫 판은 섹션 꼬리표를 눌렀다 — 섹션이 골라져 있으면 꼬리표는 pointer-events:none(css/editor-extra.css .section-block.selected .section-hitzone)이라 canvas-wrap 이 맞았다(F1 빨강)
async function endEditAndReselect(page, sec, id) {
  await backToText(page, id);
  await page.keyboard.press('Escape');
  expect(await pollTrue(page, ([i, s]) => !document.getElementById(i)?.classList.contains('editing') && document.querySelector(s)?.getAttribute('contenteditable') !== 'true', [id, CE(id)], 3000),
    '장면 미성립: 편집이 끝났다').toBe(true);
  await escDeselect(page, id);
  expect(await clickText(page, id), '장면 미성립: 블럭을 다시 누르면 골라지고 패널 = 그 블럭').toBe(true);
  expect(await page.evaluate((s) => document.querySelector(s)?.getAttribute('contenteditable') === 'true', CE(id)), '장면 미성립: 다시 누른 뒤 편집 중이 아니다(전체 갈래)').toBe(false);
}

// ── 재기 ──
async function inspect(page, id) {
  return page.evaluate((s) => {
    const ce = document.querySelector(s);
    if (!ce) return { exists: false };
    const pick = (e) => { const cs = getComputedStyle(e); return { fontWeight: cs.fontWeight, fontFamily: cs.fontFamily, color: cs.color, fontSize: cs.fontSize }; };
    const parents = [];
    const w = document.createTreeWalker(ce, NodeFilter.SHOW_TEXT);
    let n; while ((n = w.nextNode())) { if (!n.nodeValue.trim()) continue; parents.push({ text: n.nodeValue, tag: n.parentElement.tagName, ...pick(n.parentElement) }); }
    const word = {};
    for (const wd of ['AAA', 'BBB', 'CCC']) {
      const hit = parents.find(p => p.text.includes(wd));
      word[wd] = hit ? { fontWeight: hit.fontWeight, fontFamily: hit.fontFamily, color: hit.color, fontSize: hit.fontSize } : null;
    }
    const spans = [...ce.querySelectorAll('span')];
    return {
      exists: true, text: ce.textContent, ce: pick(ce), parents, word,
      counts: {
        fwSpan: ce.querySelectorAll('span[style*="font-weight"]').length,
        bStrong: ce.querySelectorAll('b, strong').length,
        colorSpan: spans.filter(sp => sp.style && sp.style.color).length,
        ffInline: ce.querySelectorAll('[style*="font-family"]').length,
        fontFace: ce.querySelectorAll('font[face]').length,
        emptySpan: spans.filter(sp => [...sp.attributes].every(a => a.name === 'style' && !a.value.replace(/;|\s/g, ''))).length,
      },
      html: ce.innerHTML.slice(0, 600),
    };
  }, CE(id));
}
const uniq = (arr, key) => [...new Set(arr.map(p => p[key]))];

// ───────────────────────── B0 판 정체 ─────────────────────────
test('B0 board identity head sha and served blob sha1 of touched files @t416', async ({ page }) => {
  test.skip(!EXPECT_SHA, 'EXPECT_SHA env 가 없으면 판 정체를 건너뛴다');
  test.setTimeout(60000);
  await boot(page);
  expect(EXPECT_SHA, '장면 미성립: 판 정체: EXPECT_SHA 가 풀 sha 40자').toMatch(/^[0-9a-f]{40}$/);
  const head = execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD']).toString().trim();
  expect(head, '판 정체 ⑴: ROOT 의 HEAD === EXPECT_SHA').toBe(EXPECT_SHA);
  for (const f of IDENT_FILES) {
    const want = execFileSync('git', ['-C', ROOT, 'rev-parse', `${EXPECT_SHA}:${f}`]).toString().trim();
    const got = await page.evaluate(async (u) => {
      const r = await fetch(u, { cache: 'no-store' });
      const a = new Uint8Array(await r.arrayBuffer());
      let bin = ''; for (let i = 0; i < a.length; i += 0x8000) bin += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000));
      return { status: r.status, b64: btoa(bin) };
    }, `${ORIGIN}/${f}`);
    expect(got.status, `판 정체: ${f} 를 받았다`).toBe(200);
    const buf = Buffer.from(got.b64, 'base64');
    let disk = null; try { disk = blobSha1(fs.readFileSync(path.join(ROOT, f))); } catch (e) { disk = 'read-fail'; }
    expect(blobSha1(buf), `판 정체 ⑵: 페이지가 받은 ${f} blob sha1 === git ${EXPECT_SHA.slice(0, 8)}:${f} (disk ${disk})`).toBe(want);
  }
});

// ───────────────────────── W1 ─────────────────────────
// 사람 순서: 편집 → CCC 고름 → hex 색 → 글자로 돌아와 AAA 고름 → 굵기 Light 300 → 편집 끝 → 블럭 고름(패널 굵기 Mix) → 굵기 700
// 성공 = 글자 부모 전부 computed 700 ∧ 안쪽 font-weight span 0 ∧ 색 span 남음(CCC 색 그대로 · AAA 는 그 색 아님)
test('W1 partial weight span and partial color then whole weight 700 applies to all text @t416', async ({ page }) => {
  test.setTimeout(150000);
  await boot(page);
  const { sec, id } = await sceneEditing(page);
  const base = await inspect(page, id);
  await selWord(page, id, 'CCC');
  await partialHex(page, RED.hex);
  await expect.poll(async () => (await inspect(page, id)).word.CCC?.color, { message: '장면 미성립: 부분 색 — CCC 가 E11D48' }).toBe(RED.rgb);
  await backToText(page, id);
  await selWord(page, id, 'AAA');
  await partialWeightLight(page);
  await expect.poll(async () => (await inspect(page, id)).word.AAA?.fontWeight, { message: '장면 미성립: 부분 굵기 — AAA 가 300' }).toBe('300');
  await endEditAndReselect(page, sec, id);
  const pre = await inspect(page, id);
  expect(pre.word.BBB?.fontWeight, `장면 미성립: BBB 는 바탕 굵기 ${base.ce.fontWeight} ${pre.html}`).toBe(base.ce.fontWeight);
  expect(pre.counts.fwSpan, `장면 미성립: 부분 굵기 span 이 있다 ${pre.html}`).toBeGreaterThan(0);
  expect(pre.counts.colorSpan, `장면 미성립: 부분 색 span 이 있다 ${pre.html}`).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => { const s = document.getElementById('txt-font-weight'); return s ? s.value + '|' + (s.selectedOptions[0]?.textContent || '').trim() : null; }),
    { message: '장면 미성립: 패널 굵기 칸 = Mix (value "" · 글자 Mix)' }).toBe('|Mix');
  await page.locator('#txt-font-weight').selectOption('700');
  await expect.poll(async () => (await inspect(page, id)).ce.fontWeight, { message: '장면 미성립: 블럭 굵기 700 적용' }).toBe('700');
  await settle(page);
  const after = await inspect(page, id);
  expect.soft(uniq(after.parents, 'fontWeight'), `성공: 글자 부모 전부 computed 700 ${after.html}`).toEqual(['700']);
  expect.soft(after.counts.fwSpan, `성공: 안쪽 font-weight span 0 ${after.html}`).toBe(0);
  expect.soft(after.counts.colorSpan, `성공: 색 span 은 남는다(색 mix 유지) ${after.html}`).toBeGreaterThan(0);
  expect.soft(after.word.CCC?.color, '성공: CCC 색 그대로').toBe(RED.rgb);
  expect.soft(after.word.AAA?.color, '성공: AAA 는 그 색이 아니다').not.toBe(RED.rgb);
  expect.soft(after.text, '성공: 글자 그대로').toBe(TEXT);
});

// ───────────────────────── W2 ─────────────────────────
// 사람 순서: 편집 → BBB 고름 → ⌘B → 편집 끝 → 블럭 고름 → 굵기 300
// 성공 = 글자 부모 전부 computed 300 ∧ b/strong 0
test('W2 partial bold tag via cmd B then whole weight 300 applies to all text @t416', async ({ page }) => {
  test.setTimeout(150000);
  await boot(page);
  const { sec, id } = await sceneEditing(page);
  await selWord(page, id, 'BBB');
  await page.keyboard.press('ControlOrMeta+b');
  await expect.poll(async () => (await inspect(page, id)).counts.bStrong, { message: '장면 미성립: ⌘B 로 부분 <b>/<strong> 이 생겼다' }).toBeGreaterThan(0);
  await endEditAndReselect(page, sec, id);
  const pre = await inspect(page, id);
  expect(pre.counts.bStrong, `장면 미성립: 편집 뒤에도 <b>/<strong> 이 있다 ${pre.html}`).toBeGreaterThan(0);
  expect(pre.word.BBB?.fontWeight, `장면 미성립: BBB 가 굵다 ${pre.html}`).toBe('700');
  await page.locator('#txt-font-weight').selectOption('300');
  await expect.poll(async () => (await inspect(page, id)).ce.fontWeight, { message: '장면 미성립: 블럭 굵기 300 적용' }).toBe('300');
  await settle(page);
  const after = await inspect(page, id);
  expect.soft(uniq(after.parents, 'fontWeight'), `성공: 글자 부모 전부 computed 300 ${after.html}`).toEqual(['300']);
  expect.soft(after.counts.bStrong, `성공: b/strong 0 ${after.html}`).toBe(0);
  expect.soft(after.text, '성공: 글자 그대로').toBe(TEXT);
});

// ───────────────────────── F1 ─────────────────────────
// [전제: 심은 꼴] 앱에는 «부분 글꼴» 문이 없다 ⇒ 이 칸만 BBB 를 font-family span 하나로 evaluate 로 심는다(생성 함수 호출 아님 · 글자 노드 감싸기만).
// 사람 순서: 편집 → 편집 끝 → [심음] → 블럭 고름 → 글꼴 피커 열기 → Inter
// 성공 = 글자 부모 전부 computed fontFamily === 글자칸 computed(Inter 체인) ∧ 안쪽 인라인 font-family 0 ∧ font[face] 0 ∧ 빈 span 0
test('F1 [전제: 심은 꼴] planted font-family span then font pick applies to all text @t416', async ({ page }) => {
  test.setTimeout(150000);
  await boot(page);
  const { sec, id } = await sceneEditing(page);
  await endEditAndReselect(page, sec, id);
  // [전제: 심은 꼴] — 이 spec 에서 유일한 DOM 쓰기 evaluate
  const planted = await page.evaluate((s) => {
    const ce = document.querySelector(s); if (!ce) return false;
    const w = document.createTreeWalker(ce, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) {
      const i = n.nodeValue.indexOf('BBB'); if (i < 0) continue;
      const mid = n.splitText(i); mid.splitText(3);
      const sp = document.createElement('span'); sp.style.fontFamily = 'serif';
      mid.parentNode.insertBefore(sp, mid); sp.appendChild(mid);
      return true;
    }
    return false;
  }, CE(id));
  expect(planted, '장면 미성립: [전제: 심은 꼴] BBB 를 font-family span 으로 감쌌다').toBe(true);
  await escDeselect(page, id);
  expect(await clickText(page, id), '장면 미성립: 블럭을 다시 누르면 패널 = 그 블럭').toBe(true);
  const pre = await inspect(page, id);
  expect(pre.counts.ffInline, `장면 미성립: [전제: 심은 꼴] 안쪽 인라인 font-family 1 ${pre.html}`).toBe(1);
  expect(pre.word.BBB?.fontFamily, `장면 미성립: [전제: 심은 꼴] BBB 글꼴이 바깥과 다르다 ${pre.html}`).not.toBe(pre.word.AAA?.fontFamily);
  await clickField(page, '#txt-font-trigger');
  await expect(page.locator('#txt-font-dropdown'), '장면 미성립: 글꼴 목록이 열렸다').toBeVisible();
  await page.locator('#txt-font-list .font-item .font-item-name').filter({ hasText: reExact('Inter') }).first().click();
  await expect.poll(async () => (await inspect(page, id)).ce.fontFamily, { message: '장면 미성립: 글자칸 글꼴 = Inter 체인' }).toMatch(/^"?Inter"?,/);
  await settle(page);
  const after = await inspect(page, id);
  expect.soft(uniq(after.parents, 'fontFamily'), `성공: 글자 부모 전부 computed fontFamily = 고른 체인 ${after.html}`).toEqual([after.ce.fontFamily]);
  expect.soft(after.counts.ffInline, `성공: 안쪽 인라인 font-family 0 ${after.html}`).toBe(0);
  expect.soft(after.counts.fontFace, `성공: font[face] 0 ${after.html}`).toBe(0);
  expect.soft(after.counts.emptySpan, `성공: 빈 span 0 ${after.html}`).toBe(0);
  expect.soft(after.text, '성공: 글자 그대로').toBe(TEXT);
});

// ───────────────────────── 지킴 G1 · G2 · G3 (바닥에서도 초록) ─────────────────────────
// G1 부분 크기 20 → 편집 끝 → 전체 크기 48 = 전부 48px
test('G1 guard whole size change over mixed sizes makes all the same @t416', async ({ page }) => {
  test.setTimeout(150000);
  await boot(page);
  const { sec, id } = await sceneEditing(page);
  await selWord(page, id, 'BBB');
  await clickField(page, '#txt-size-number');
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('20');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await inspect(page, id)).word.BBB?.fontSize, { message: '장면 미성립: 부분 크기 — BBB 20px' }).toBe('20px');
  await endEditAndReselect(page, sec, id);
  const pre = await inspect(page, id);
  expect(uniq(pre.parents, 'fontSize').length, `장면 미성립: 크기가 섞였다 ${pre.html}`).toBeGreaterThan(1);
  { const l = page.locator('#txt-size-number'); await l.fill('48'); await l.press('Enter'); }
  await expect.poll(async () => (await inspect(page, id)).ce.fontSize, { message: '장면 미성립: 블럭 크기 48 적용' }).toBe('48px');
  await settle(page);
  const after = await inspect(page, id);
  expect.soft(uniq(after.parents, 'fontSize'), `성공: 글자 부모 전부 48px ${after.html}`).toEqual(['48px']);
});

// G2 부분 색 → 편집 끝 → 전체 색 = 전부 그 색
test('G2 guard whole color change over mixed colors makes all the same @t416', async ({ page }) => {
  test.setTimeout(150000);
  await boot(page);
  const { sec, id } = await sceneEditing(page);
  await selWord(page, id, 'BBB');
  await partialHex(page, RED.hex);
  await expect.poll(async () => (await inspect(page, id)).word.BBB?.color, { message: '장면 미성립: 부분 색 — BBB 가 E11D48' }).toBe(RED.rgb);
  await endEditAndReselect(page, sec, id);
  const pre = await inspect(page, id);
  expect(uniq(pre.parents, 'color').length, `장면 미성립: 색이 섞였다 ${pre.html}`).toBeGreaterThan(1);
  { const l = page.locator('#txt-color-hex'); await l.fill(BLUE.hex); await l.press('Enter'); }
  await expect.poll(async () => (await inspect(page, id)).ce.color, { message: '장면 미성립: 블럭 색 2563EB 적용' }).toBe(BLUE.rgb);
  await settle(page);
  const after = await inspect(page, id);
  expect.soft(uniq(after.parents, 'color'), `성공: 글자 부모 전부 2563EB ${after.html}`).toEqual([BLUE.rgb]);
});

// G3 부분 선택이 있으면 굵기는 그 범위만 — BBB 300 · AAA·CCC 는 바탕 굵기
test('G3 guard weight change with partial selection changes only the range @t416', async ({ page }) => {
  test.setTimeout(150000);
  await boot(page);
  const { sec, id } = await sceneEditing(page);
  const base = await inspect(page, id);
  await selWord(page, id, 'BBB');
  await partialWeightLight(page);
  await expect.poll(async () => (await inspect(page, id)).word.BBB?.fontWeight, { message: '성공: 부분 굵기 — BBB 가 300' }).toBe('300');
  await settle(page);
  const mid = await inspect(page, id);
  expect.soft(mid.word.AAA?.fontWeight, `성공: AAA 는 바탕 굵기 ${mid.html}`).toBe(base.ce.fontWeight);
  expect.soft(mid.word.CCC?.fontWeight, `성공: CCC 는 바탕 굵기 ${mid.html}`).toBe(base.ce.fontWeight);
  expect.soft(mid.ce.fontWeight, '성공: 글자칸(블럭) 굵기는 그대로').toBe(base.ce.fontWeight);
  await endEditAndReselect(page, sec, id);
  const after = await inspect(page, id);
  expect.soft(after.word, `성공: 편집을 끝낸 뒤에도 BBB 만 300 ${after.html}`).toEqual({
    AAA: { ...mid.word.AAA }, BBB: { ...mid.word.BBB }, CCC: { ...mid.word.CCC },
  });
});
