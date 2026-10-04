/* e80-fix.dom.spec.js — E80 고침(처방 ⒤: 끝만 찍던 삭제 넷에 앞 «삭제 전» 체크포인트)의 짝 시험.
 *   F-K2 서브섹션 삭제(editor.js) · F-K6 행 삭제 · F-K7 열 삭제 · F-U1 월계 줄 삭제(prop-laurel.js) + F-U4 어노테이션(앞만 — 가설 대조, 고침 대상 아님).
 * 꼴: S1 의 글자 eT 편집 → topbar 진짜 클릭으로 끝냄(끝 표본 없음 · clickAt) → 그 삭제(진짜 손) → [⌘Z 직전 재기] → ⌘Z 1.
 * 단언 둘(E80_FIX 가 있을 때):
 *   ⒜ 결과 — E80_FIX=1: 편집 남음 · E80_FIX=0(고치기 전 판): 사라짐
 *   ⒝ 까닭 — ⌘Z 직전 «꼭대기 바로 아래 칸»에 편집(EDIT)이 있나: 고친 뒤 있음 · 고치기 전 없음.
 *        그리고 «화면 vs 꼭대기 표본»(_sameEdit 과 같은 걷기)을 sha·길이·firstDiff 로 «나란히» 찍는다(지디 가설: 전 == · 후 ≠ — 단언하지 않고 기록).
 * 표본 바이트를 읽는 법(제품 0줄): history.js 는 표본을 «전역» window.getSerializedCanvas() 로 뜬다 → 그 함수를 감싸 «뜬 바이트 + 그때 꼭대기»를 적고,
 *   다음 뜨기(또는 지금) 꼭대기 seq 가 바뀌었으면 그 뜨기가 칸이 된 것으로 센다. */
const crypto = require('crypto');
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');
const { stripNonEdit } = require('./_history-step.js');
const { structCmp } = require('./_struct-cmp.js');

const FIX = process.env.E80_FIX;                       // '1' 고친 판 기대 · '0' 고치기 전 판 기대 · 없으면 기록만
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 12);
const fd = (a, b) => { if (a === b) return null; let i = 0; while (i < a.length && a[i] === b[i]) i++; return { at: i, a: a.slice(Math.max(0, i - 40), i + 40), b: b.slice(Math.max(0, i - 40), i + 40) }; };
const tip = (page) => page.evaluate(() => { const t = window.getHistoryTip?.(); return t ? `${t.action}@${t.pos}/${t.len}` : null; });

async function scene(page, build) {
  await page.setViewportSize({ width: 1500, height: 1400 });
  await bootApp(page);
  await page.evaluate((build) => {
    /* 표본 기록기 — clearHistory «전»에 건다(바닥 표본도 잡히게) */
    const orig = window.getSerializedCanvas; window.__caps = [];
    window.getSerializedCanvas = function () { const s = orig.apply(this, arguments); const st = new Error().stack || '';
      const via = /ensureHistoryCheckpoint/.test(st) ? 'ensure' : /pushHistory/.test(st) ? 'push' : /clearHistory/.test(st) ? 'clear' : null;
      if (via) { const t = window.getHistoryTip?.(); window.__caps.push({ via, s, seq: t ? t.seq : null, len: t ? t.len : null }); }
      return s; };
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    const sec = (id) => `<div class="section-block" id="${id}" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="${id}I">
      <div class="gap-block" data-type="gap" style="height:40px"></div><div class="row" id="${id}R" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:120px"></div></div></div>`;
    c.insertAdjacentHTML('beforeend', sec('S1') + sec('S2'));
    const TX = (id, s) => { const { block: tb } = window.makeTextBlock('h2'); const tf = window._makeTextFrame(); window.applyTextOpts(tb, tf, {}, 'h2'); tf.appendChild(tb); tb.id = id; tb.querySelector('[class^="tb-"]').textContent = s; return tf; };
    document.getElementById('S1R').appendChild(TX('eT', '편집글'));
    (new Function('TX', build))(TX);
    window.rebindAll?.(); window.deselectAll?.(); window.applyZoom?.(100); window.applyPageSettings?.(); window.clearHistory?.();
  }, build);
  await page.waitForTimeout(300);
}
const rect = (page, sel) => page.evaluate((sel) => { const e = document.querySelector(sel); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; }, sel);
const editing = (page) => page.evaluate(() => !!document.querySelector('#canvas [contenteditable="true"]'));
async function editAndEndWithoutRecord(page) {
  const q = await rect(page, '#eT [class^="tb-"]');
  for (let n = 0; n < 3 && !(await editing(page)); n++) { await clickAt(page, q.r - 4, q.t + q.h / 2, { sel: '#eT, #eT *, #S1R .frame-block' }, { label: '글자 dblclick', dbl: true }); await page.waitForTimeout(150); }
  expect(await editing(page), '전제 — 편집 중').toBe(true);
  await page.keyboard.press('End'); await page.keyboard.type('EDIT'); await page.waitForTimeout(100);
  await clickAt(page, 300, 4, { sel: '#topbar, .topbar' }, { label: 'topbar(끝 표본 없이 끝냄)' }); await page.waitForTimeout(250);
  expect(await page.evaluate(() => document.querySelector('#eT [class^="tb-"]').textContent), '전제 — 편집 글자').toBe('편집글EDIT');
}
/* ⌘Z 직전 — 화면 vs 꼭대기 표본 · 꼭대기 아래 칸 */
async function probe(page) {
  const r = await page.evaluate(() => {
    const caps = window.__caps || []; const t = window.getHistoryTip(); const made = [];
    for (let i = 0; i < caps.length; i++) { const nextSeq = i + 1 < caps.length ? caps[i + 1].seq : t.seq; if (nextSeq !== caps[i].seq) made.push(caps[i]); }
    return { screen: window.getSerializedCanvas.call(window), top: made.length ? made[made.length - 1].s : null, below: made.length > 1 ? made[made.length - 2].s : null, made: made.map(m => m.via), tip: `${t.action}@${t.pos}/${t.len}` };
  });
  const A = stripNonEdit(r.screen), B = r.top == null ? '' : stripNonEdit(r.top);
  const sc = await structCmp(page, A, B);   // ★내용 비교(지디 — 날 바이트 «≠»는 거짓일 수 있다)
  return { tip: r.tip, made: r.made, screenEqTopContent: sc.diffs.length === 0, contentDiffs: sc.diffs.slice(0, 2), styleOnly: sc.styleOnly, screenEqTopRaw: A === B, screen: { sha: sha(A), len: A.length }, top: { sha: sha(B), len: B.length }, firstDiff: fd(A, B), belowHasEdit: r.below == null ? null : />[^<]*EDIT/.test(r.below), topHasEdit: r.top == null ? null : />[^<]*EDIT/.test(r.top) };   // 글자 노드 안의 EDIT(eT «편집글EDIT» · 오버레이 «EDIT» 둘 다)
}
async function finish(page, key, branchName) {
  const p = await probe(page);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(300);
  const t = await page.evaluate(() => document.querySelector('#eT [class^="tb-"]')?.textContent ?? null);
  const result = t === '편집글EDIT' ? '남음' : '사라짐';
  console.log(`[FIX] ${key} | ${branchName} | E80_FIX=${FIX ?? '-'} | ⌘Z 직전 ${JSON.stringify(p)} | ⌘Z 뒤 top=${await tip(page)} eT=${JSON.stringify(t)} → ${result}`);
  return { p, result };
}
function judge(key, out, { target = true } = {}) {
  if (!FIX || !target) return;
  const want = FIX === '1';
  expect(out.result, `⒜ ${key} 결과`).toBe(want ? '남음' : '사라짐');
  expect(out.p.belowHasEdit, `⒝ ${key} 까닭 — ⌘Z 직전 꼭대기 아래 칸에 편집이 ${want ? '있다(앞 체크포인트)' : '없다'}`).toBe(want);
}

test('F-K2 서브섹션 삭제', async ({ page }) => {
  await scene(page, `const f = window.makeFrameBlock({ fullWidth: true }); f.id = 'xF'; f.style.minHeight = '120px'; f.style.padding = '20px'; f.appendChild(TX('xFT', '프레임 안')); document.getElementById('S2R').appendChild(f);`);
  await editAndEndWithoutRecord(page);
  const pt = await page.evaluate(() => { const f = document.getElementById('xF'); f.scrollIntoView({ block: 'center' }); const r = f.getBoundingClientRect();
    for (let y = r.bottom - 6; y > r.top + 4; y -= 6) { const x = r.left + r.width / 2; if (document.elementFromPoint(x, y) === f) return [x, y]; } return null; });
  await clickAt(page, pt[0], pt[1], { sel: '#xF' }, { label: '프레임 안 빈 곳' }); await page.waitForTimeout(200);
  await page.keyboard.press('Delete'); await page.waitForTimeout(250);
  expect(await tip(page), '갈래').toMatch(/^서브섹션 삭제@/);
  judge('F-K2', await finish(page, 'F-K2', '서브섹션 삭제'));
});

const COLS = `const r = document.getElementById('S2R'); r.dataset.layout = 'flex'; r.dataset.ratioStr = '1*1';
  r.innerHTML = '<div class="col" id="xC1" data-flex="1" style="flex:1;min-height:120px"></div><div class="col" id="xC2" data-flex="1" style="flex:1;min-height:120px"></div>';
  document.getElementById('xC1').appendChild(TX('xCT', '열 글'));`;
test('F-K6 행 삭제(옛 다열 행)', async ({ page }) => {
  await scene(page, COLS);
  await editAndEndWithoutRecord(page);
  const c = await rect(page, '#xC2'); await clickAt(page, c.l + c.w / 2, c.t + c.h / 2, { sel: '#xC2' }, { label: '빈 열' }); await page.waitForTimeout(200);
  expect(await page.evaluate(() => document.getElementById('S2R').classList.contains('row-active')), '전제 — 행 활성').toBe(true);
  await page.keyboard.press('Delete'); await page.waitForTimeout(250);
  expect(await tip(page), '갈래').toMatch(/^행 삭제@/);
  judge('F-K6', await finish(page, 'F-K6', '행 삭제'));
});
test('F-K7 열 삭제(⌘클릭 둘)', async ({ page }) => {
  await scene(page, COLS);
  await editAndEndWithoutRecord(page);
  for (const id of ['xC1', 'xC2']) { const c = await rect(page, '#' + id); const y = id === 'xC1' ? c.b - 8 : c.t + c.h / 2;
    await page.keyboard.down('Meta'); await clickAt(page, c.l + c.w / 2, y, { sel: '#' + id }, { label: '⌘ ' + id }); await page.keyboard.up('Meta'); await page.waitForTimeout(150); }
  expect(await page.evaluate(() => window.multiSel?.cols?.size), '전제 — 열 둘').toBe(2);
  await page.keyboard.press('Delete'); await page.waitForTimeout(250);
  expect(await tip(page), '갈래').toMatch(/^열 삭제@/);
  judge('F-K7', await finish(page, 'F-K7', '열 삭제'));
});
test('F-U1 월계 줄 삭제', async ({ page }) => {
  await scene(page, ``);
  const ok = await page.evaluate(() => { window.selectSection(document.getElementById('S2')); window.addLaurelBlock?.({ cells: [{ lines: [{ text: '첫' }, { text: '둘' }] }] }); const b = document.querySelector('#S2 .laurel-block'); if (b) b.id = 'xL';
    window.deselectAll?.(); window.applyPageSettings?.(); window.clearHistory?.(); return !!b; });
  expect(ok, '전제 — 월계 블럭').toBe(true);
  await editAndEndWithoutRecord(page);
  const l = await rect(page, '#xL'); await clickAt(page, l.l + l.w / 2, l.t + l.h / 2, { sel: '#xL, #xL *' }, { label: '월계 고름' }); await page.waitForTimeout(250);
  if (!(await page.locator('.lrl-line-remove').count())) await page.evaluate(() => window.showLaurelProperties?.(document.getElementById('xL')));
  await page.locator('.lrl-line-remove').first().click(); await page.waitForTimeout(250);
  expect(await tip(page), '갈래').toMatch(/^줄 삭제@/);
  judge('F-U1', await finish(page, 'F-U1', '월계 줄 삭제'));
});
test('F-U4 어노테이션 삭제(앞만 — 가설 대조 · 고침 대상 아님)', async ({ page }) => {
  await scene(page, ``);
  const ok = await page.evaluate(() => { const r = window.makeAnnotationBlock?.({ ax: 10, ay: 10, lx: 120, ly: 40, text: '주석' }); const b = r && (r.block || r); if (!b || !b.classList) return false;
    b.id = 'xAn'; document.getElementById('S2I').appendChild(b); window.rebindAll?.(); window.deselectAll?.(); window.applyPageSettings?.(); window.clearHistory?.(); return true; });
  expect(ok, '전제 — 어노테이션').toBe(true);
  await editAndEndWithoutRecord(page);
  await page.evaluate(() => window._selectAnnotation?.(document.getElementById('xAn')));
  await page.keyboard.press('Delete'); await page.waitForTimeout(250);
  expect(await tip(page), '갈래').toMatch(/^어노테이션 삭제@/);
  judge('F-U4', await finish(page, 'F-U4', '어노테이션 삭제'), { target: false });
});

/* F-S1 에셋 → 스크래치 이동(scratch-pad.js _moveAssetToScratch · 범위 다섯째 · 승인 approvals/lane-e80-fix).
 *   오버레이 글자 편집(topbar 로 끝냄 = 끝 표본 없음) → 에셋을 섹션 밖 캔버스 바닥으로 끌어 놓음 → ⌘Z → ⌘⇧Z → ⌘Z → ⌘Z.
 *   ⒜ 결과: 첫 ⌘Z 뒤 에셋이 돌아오고 EDIT 가 있다(E80_FIX=1) / 없다(E80_FIX=0).
 *   ⒝ 스크래치 쪽: 첫 ⌘Z 뒤 스크래치 항목이 이동 전 수로 · ⌘⇧Z 뒤 +1 · 끝 ⌘Z 둘 뒤 이동 전 수 · id 중복 없음.
 *   ⒞ 기록만: 이동 직후 · ⌘⇧Z 뒤 «스크래치 항목 안»에 EDIT 가 있나. */
test('F-S1 에셋 → 스크래치 이동', async ({ page }) => {
  await scene(page, ``);
  const setup = await page.evaluate(() => {
    const s = document.getElementById('S2'); window.selectSection(s);
    window.addAssetBlock?.(); const ab = s.querySelector('.asset-block'); if (!ab) return null;
    const cv = document.createElement('canvas'); cv.width = 300; cv.height = 200; cv.getContext('2d').fillRect(0, 0, 300, 200);
    window.updateAssetBlock(ab.id, { imgSrc: cv.toDataURL('image/png'), overlay: 'true' });
    window.deselectAll(); window.selectBlock?.(ab.id); window.addTextBlock('body');
    const otb = ab.querySelector('.overlay-tb'); if (otb) otb.classList.add('xOT');
    window.deselectAll(); window.applyPageSettings?.(); window.clearHistory();
    return { ab: ab.id, otb: !!otb, scratch0: document.querySelectorAll('.scratch-item').length };
  });
  expect(setup && setup.otb, '전제 — 오버레이 글자 든 에셋').toBe(true);
  const abSel = '#' + setup.ab;
  const q = await page.evaluate(() => { const e = document.querySelector('.xOT [class^="tb-"]'); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return [r.right - 4, r.top + r.height / 2]; });
  for (let n = 0; n < 4 && !(await page.evaluate(() => !!document.querySelector('.xOT [contenteditable="true"]'))); n++) { await clickAt(page, q[0], q[1], { sel: `${abSel}, ${abSel} *` }, { label: '오버레이 글자 dblclick', dbl: true }); await page.waitForTimeout(200); }
  expect(await page.evaluate(() => !!document.querySelector('.xOT [contenteditable="true"]')), '전제 — 오버레이 글자 편집 중').toBe(true);
  await page.keyboard.press('End'); await page.keyboard.type('EDIT'); await page.waitForTimeout(100);
  await clickAt(page, 300, 4, { sel: '#topbar, .topbar' }, { label: 'topbar' }); await page.waitForTimeout(250);
  /* ⒞ 자(데이터) — 항목에 «실리는» fx 를 그 자리에서 읽는다(DOM 아님 · 제품 0줄):
     이동은 window.captureAssetFx(ab) 로 fx 를 떠서 항목을 만들고(scratch-pad.js _moveAssetToScratch),
     ⌘⇧Z 는 onRedo 의 window._scratchAddAndSaveFx(…, fx) 로 항목을 다시 만든다 — 둘 다 전역 조회라 감싸서 그 인자/반환을 적는다.
     E80_S1_FXPOS=1 이면 양성대조: 떠 낸 fx 에서 overlay 를 비운다 → ⒞ 가 «없음»을 내야 한다(자 고장 아님을 보인다). */
  await page.evaluate((pos) => {
    window.__fxLog = [];
    const cap = window.captureAssetFx; window.captureAssetFx = function (ab) { let fx = cap.apply(this, arguments); if (pos && fx) fx = { ...fx, overlay: null }; window.__fxLog.push({ via: 'capture', overlay: fx && fx.overlay ? fx.overlay.html : null }); return fx; };
    const add = window._scratchAddAndSaveFx; window._scratchAddAndSaveFx = function (src, x, y, w, g, id, fx) { window.__fxLog.push({ via: 'redo', overlay: fx && fx.overlay ? fx.overlay.html : null }); return add.apply(this, arguments); };
  }, process.env.E80_S1_FXPOS === '1');
  const src = await page.evaluate((s) => { const e = document.querySelector(s); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return [r.left + 12, r.top + 12]; }, abSel);
  const dst = await page.evaluate(() => { const s = document.querySelector('.section-block').getBoundingClientRect();
    for (const y of [window.innerHeight / 2, window.innerHeight * 0.7]) for (let x = s.left - 30; x > 4; x -= 10) { const e = document.elementFromPoint(x, y); if (e && !e.closest('.section-block') && e.closest('#canvas-wrap')) return [x, y]; } return null; });
  expect(dst, '전제 — 섹션 밖 바닥 점').not.toBeNull();
  expect(await page.evaluate(([x, y, s]) => !!document.elementFromPoint(x, y)?.closest(s), [src[0], src[1], abSel]), '전제 — 끌기 시작점이 그 에셋').toBe(true);
  await page.mouse.move(src[0], src[1]); await page.mouse.down(); await page.mouse.move(src[0] + 20, src[1] + 10, { steps: 4 }); await page.mouse.move(dst[0], dst[1], { steps: 12 }); await page.mouse.up(); await page.waitForTimeout(600);
  const st = () => page.evaluate((s) => { const items = [...document.querySelectorAll('.scratch-item')];
    return { asset: !!document.querySelector(s), canvasEdit: (document.getElementById('canvas').textContent || '').includes('EDIT'), scratch: items.length, scratchIdsUnique: new Set(items.map(i => i.id || i.dataset.id)).size === items.length, scratchHasEdit: items.some(i => (i.textContent || '').includes('EDIT') || (i.innerHTML || '').includes('EDIT')), tip: (() => { const t = window.getHistoryTip(); return `${t.action}@${t.pos}/${t.len}`; })() }; }, abSel);
  const moved = await st();
  expect(moved.asset, '동작 증명 — 에셋이 캔버스에서 빠졌다').toBe(false);
  expect(moved.scratch, '동작 증명 — 스크래치 항목 +1').toBe(setup.scratch0 + 1);
  const p = await probe(page);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(500); const u1 = await st();
  await page.keyboard.press('Meta+Shift+z'); await page.waitForTimeout(500); const r1 = await st();
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(500); const u2 = await st();
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(500); const u3 = await st();
  const fxLog = await page.evaluate(() => (window.__fxLog || []).map(e => ({ via: e.via, hasOVTXT: !!(e.overlay && /OVTXT|본문|>[^<]*EDIT/.test(e.overlay)), hasEDIT: !!(e.overlay && />[^<]*EDIT/.test(e.overlay)), len: e.overlay ? e.overlay.length : 0 })));
  const cMove = fxLog.find(e => e.via === 'capture'), cRedo = fxLog.find(e => e.via === 'redo');
  console.log(`[FIX] F-S1 | 에셋→스크래치 | E80_FIX=${FIX ?? '-'} | ⌘Z 직전 ${JSON.stringify(p)} | 이동=${JSON.stringify(moved)} | ⌘Z=${JSON.stringify(u1)} | ⌘⇧Z=${JSON.stringify(r1)} | ⌘Z=${JSON.stringify(u2)} | ⌘Z=${JSON.stringify(u3)} | ⒞ fx(데이터)=${JSON.stringify(fxLog)} 양성=${process.env.E80_S1_FXPOS === '1'}`);
  expect(cMove, '⒞ 전제 — 이동이 captureAssetFx 를 불렀다').toBeTruthy();
  const wantFx = process.env.E80_S1_FXPOS !== '1';
  expect(cMove.hasEDIT, `⒞ 이동 직후 항목 fx.overlay 에 편집 ${wantFx ? '있음' : '없음(양성대조)'}`).toBe(wantFx);
  if (cRedo) expect(cRedo.hasEDIT, `⒞ ⌘⇧Z 가 다시 만든 항목 fx.overlay 에 편집 ${wantFx ? '있음' : '없음(양성대조)'}`).toBe(wantFx);
  if (FIX) {
    const want = FIX === '1';
    expect(u1.asset && u1.canvasEdit, `⒜ 첫 ⌘Z 뒤 에셋 + EDIT ${want ? '있음' : '없음'}`).toBe(want);
    expect(p.belowHasEdit, `⒝' 까닭 — 꼭대기 아래 칸에 편집 ${want ? '있음' : '없음'}`).toBe(want);
    if (want) {
      expect(u1.scratch, '⒝ 첫 ⌘Z 뒤 스크래치 = 이동 전 수(onUndo)').toBe(setup.scratch0);
      expect(r1.scratch, '⒝ ⌘⇧Z 뒤 스크래치 +1(onRedo)').toBe(setup.scratch0 + 1);
      expect([u3.scratch, u3.scratchIdsUnique], '⒝ 끝 ⌘Z 둘 뒤 스크래치 = 이동 전 수 · id 중복 없음').toEqual([setup.scratch0, true]);
    }
  }
});
