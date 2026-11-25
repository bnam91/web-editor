/* text-lorem-fit-height — 0.9.13 t13E-08·09 2차(현빈 확정 261123 · handoff/SPEC-text-height-lorem-vs-typed-261123.md «2차 확정») · 태양
 *   더미 글 = «높이가 주인» · 사용자 글 = «내용이 주인». 상자 높이 = 하한(data-fixed-h) · 실제 = max(정한 높이, 사용자 글).
 *   고침: js/props/prop-text-wireup-lorem.js applyLorem·loremRefit·loremMark(표식 data-lorem = 단위·글·씨앗·개수·최대·넣은 글 해시) · 패널 개수 = 슬라이더+숫자 · js/overlay-handles.js 아래 변 끌기가 loremRefit 먼저.
 * H1 높이 정한 상자(200) + 채우기 → 높이 200 그대로 · 글이 상자 안 · 꽉(한 조각 더면 넘침) · 슬라이더 0~최대 · 값 = 최대 · 표식 있음
 * H2 한 줄 상자(100) + 문단 → 낱말로 채움 · 높이 그대로
 * H3 auto 상자 · 채우기 = 그 순간 높이를 굳힘 · 꽉 · 슬라이더 0~최대(★기대 바뀜 174 · 현빈 261125 ⓐ — 옛: 개수 3 · 상자가 글을 따름)
 * H4 더미 그대로 + 아래 변 −80 → 정한 높이가 줄고 더미가 그 높이로 다시 꽉(개수 줄어듦) · +160 → 다시 꽉(늘어남) · 슬라이더 최대 따라감
 * H5 사용자 글 — 한 글자 고치면 표식 버림 → 아래 변을 위로 끌어도 글 높이 아래로 안 줄어듦(자름 0) · 다시 채우기 0
 * H6 슬라이더로 줄이기 — 더미 그대로면 끄는 대로 개수 줄어듦 · 높이 그대로
 * H7 저장·열기·⌘Z — 표식이 저장본(applyProjectData 왕복)·되돌리기·다시하기에 같이 옮겨짐 · 옛 저장본(표식 없음) = 사용자 글
 * 양성대조: _patches/text-height2-CTL.patch(손잡이의 loremRefit 줄 걷음) ⇒ H4 빨강 · _patches/text-height2-CTL-full.patch(높이 정한 상자 기본 = 최대 → 2) ⇒ H1 빨강.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function scene(page, fixedH) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(async (fixedH) => {
    window.__admin = { ...(window.__admin || {}), state: () => ({ isAdmin: true }) };   // [전제] 상자 손잡이(H4·H5) = 관리자만(t13E-10)
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection();
    const sec = c.querySelector('.section-block'); sec.id = 'sH'; sec.style.minHeight = '1200px'; window.applyZoom?.(100);
    window.deselectAll(); window.selectSection(sec); window.addTextBlock('body');
    const tf = sec.querySelector('.frame-block[data-text-frame]'), tb = tf.querySelector('.text-block'); tb.id = 'tbH';
    const ed = tb.querySelector('[class^="tb-"]'); if (ed) ed.style.fontSize = '18px';   // [전제] 본문 기본 글자가 커서(한 줄 ≈ 83px) 상자에 문장이 몇 개 들게 — 셈은 글자 크기와 무관
    if (fixedH) { tf.dataset.fixedH = String(fixedH); tf.style.minHeight = fixedH + 'px'; }   // 손잡이가 쓰는 두 키 그대로
    window.selectBlock(tb.id); window.showTextProperties?.(tb); window.clearHistory?.();
    return { tf: tf.id, tb: tb.id };
  }, fixedH);
  await waitZoomSettled(page, 100);
  await page.waitForFunction(() => !!document.getElementById('txt-lorem-run'), null, { polling: 100, timeout: 5000 });
  return { errs, ids };
}
const run = async (page) => { await page.click('#txt-lorem-run'); await raf(page); };
const st = (page) => page.evaluate(() => {
  const b = document.getElementById('tbH'), f = b.closest('.frame-block[data-text-frame]'),   // tbH 자기 프레임(IAL 이 프레임 자리를 옮겨도 같은 것)
    mh = f.style.minHeight; f.style.minHeight = ''; const content = f.offsetHeight; f.style.minHeight = mh;
  const t = b.textContent || '', sl = document.getElementById('txt-lorem-count-slider');
  let mk = null; try { mk = JSON.parse(b.dataset.lorem || 'null'); } catch (_) {}
  return { h: f.offsetHeight, content, fh: f.dataset.fixedH ?? null, dots: (t.match(/\./g) || []).length, words: t.trim() ? t.trim().split(/\s+/).length : 0, mk, valid: !!window.loremMark?.(b), sl: sl ? { min: sl.min, max: sl.max, v: sl.value } : null };
});
async function dragS(page, dy) {
  await page.evaluate(() => { window.selectBlock('tbH'); window.showHandlesFor?.(document.getElementById('tbH')); document.activeElement?.blur?.(); }); await raf(page);
  const p = await page.evaluate(() => { const h = document.querySelector('#ss-handles-overlay [data-tbx-dir="s"]'); if (!h) return null; const r = h.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  expect(p, '[전제] 아래 변 손잡이').toBeTruthy();
  await page.mouse.move(p[0], p[1]); await page.mouse.down(); await page.mouse.move(p[0], p[1] + dy, { steps: 6 }); await page.mouse.up(); await raf(page);
}

test('H1 높이 정한 상자 — 채우기 = 꽉 · 높이 그대로 · 슬라이더 0~최대 = 최대', async ({ page }) => {
  const { errs } = await scene(page, 240);
  await run(page);
  const a = await st(page);
  const over = await page.evaluate(() => { const b = document.getElementById('tbH'), m = window.loremMark(b); window.applyLorem(b, { unit: m.u, lang: m.l, seed: m.s, n: m.n + 1 }); return null; });   // 한 조각 더 = 넘침인지(최대 셈 확인)
  const b2 = await st(page);
  console.log('[H1 실측]', JSON.stringify({ a, b2 }));
  expect([a.h, a.content <= 240, a.valid], '★높이 그대로 · 글 상자 안 · 표식').toEqual([240, true, true]);
  expect(a.sl, '★슬라이더 0~최대 · 값 = 최대(꽉)').toEqual({ min: '0', max: String(a.mk.m), v: String(a.mk.m) });
  expect(a.mk.n === a.mk.m && a.mk.m >= 1, `★기본 = 최대 ${JSON.stringify(a.mk)}`).toBe(true);
  expect(b2.mk.n, '★최대 위로는 안 넣음(n+1 을 청해도 최대)').toBe(a.mk.m);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('H2 한 줄 상자 + 문단 → 낱말로 · 높이 그대로', async ({ page }) => {
  const { errs } = await scene(page, 100);
  await page.selectOption('#txt-lorem-unit', 'paragraph');
  await run(page);
  const a = await st(page);
  console.log('[H2 실측]', JSON.stringify(a));
  expect([a.h, a.content <= 100, a.words > 0], '★높이 그대로 · 넘침 0 · 글 있음').toEqual([100, true, true]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('H3 auto 상자 — 채우기 = 그 순간 높이를 굳힘 · 높이 그대로 · 꽉 · 슬라이더 0~최대 = 최대', async ({ page }) => {
  /* ★기대 바뀜(174 t13E-08 · 현빈 결정 261125 21:27 «ⓐ 높이 지키기 우선»): 옛 = «개수 3 · 높이 키 없음 · 상자가 글을 따라 커짐»(지디 안전 기본값) → 채우기 순간 높이를 정한 높이로 굳히고 그 높이에 꽉 */
  const { errs } = await scene(page, 0);
  await page.evaluate(() => { const e = document.querySelector('#tbH [class^="tb-"]'); e.innerHTML = '가<br>나<br>다<br>라'; delete e.dataset.isPlaceholder; });   // 사용자 글 네 줄 = auto 상자 몇 줄 높이
  const a0 = await st(page);
  expect(a0.fh, '[전제] 높이 auto').toBeNull();
  await run(page);
  const a = await st(page);
  console.log('[H3 실측]', JSON.stringify({ a0: a0.h, a: { h: a.h, fh: a.fh, mk: a.mk, sl: a.sl } }));
  expect([a.h, a.fh], `★높이 그대로 · 정한 높이 = 채우기 전 ${a0.h}`).toEqual([a0.h, String(a0.h)]);
  expect(a.content <= a0.h + 1 && a.valid, '★글이 상자 안 · 더미 표식').toBe(true);
  expect(a.sl, '★슬라이더 0~최대 · 값 = 최대(꽉)').toEqual({ min: '0', max: String(a.mk.m), v: String(a.mk.m) });
  expect(a.mk.m >= 1, `★최대 ≥ 1 ${JSON.stringify(a.mk)}`).toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('H4 더미 그대로 + 높이 바꿈 → 다시 꽉(줄이면 덜 · 늘리면 더)', async ({ page }) => {
  const { errs } = await scene(page, 300);
  await run(page);
  const a = await st(page);
  await dragS(page, -120);
  const b = await st(page);
  await dragS(page, 240);
  const c = await st(page);
  console.log('[H4 실측]', JSON.stringify({ a: [a.h, a.mk.n], b: [b.h, b.mk?.n, b.content], c: [c.h, c.mk?.n, c.content], sl: [b.sl, c.sl] }));
  expect([b.h < a.h, b.content <= b.h, b.mk?.n < a.mk.n, b.valid], `★줄임 = 정한 높이 줄고 더미 덜 · 표식 그대로 ${a.h}/${a.mk.n} → ${b.h}/${b.mk?.n}`).toEqual([true, true, true, true]);
  expect([c.h > b.h, c.content <= c.h, c.mk?.n > b.mk?.n], `★늘림 = 더 · ${c.h}/${c.mk?.n}`).toEqual([true, true, true]);
  expect([b.sl.max, b.sl.v, c.sl.max, c.sl.v], '★슬라이더 최대·값 = 새 최대').toEqual([String(b.mk.m), String(b.mk.m), String(c.mk.m), String(c.mk.m)]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('H5 사용자 글 — 한 글자 고치면 표식 버림 · 글 아래로 안 줄어듦 · 다시 채우기 0', async ({ page }) => {
  const { errs } = await scene(page, 200);
  await run(page);
  await page.evaluate(() => { const e = document.querySelector('#tbH [class^="tb-"]'); e.appendChild(document.createTextNode(' 사용자가 덧붙인 꽤 긴 문장이 여러 줄로 이어져 상자를 넘칩니다 사용자가 덧붙인 꽤 긴 문장이 여러 줄로 이어져 상자를 넘칩니다 사용자가 덧붙인 꽤 긴 문장')); });
  const a = await st(page);
  const t0 = await page.evaluate(() => document.getElementById('tbH').textContent);
  await dragS(page, -150);
  const b = await st(page);
  const t1 = await page.evaluate(() => document.getElementById('tbH').textContent);
  console.log('[H5 실측]', JSON.stringify({ a: [a.h, a.content, a.valid], b: [b.h, b.content, b.valid, b.fh] }));
  expect(a.valid, '★고친 글 = 표식 버림(사용자 글)').toBe(false);
  expect(a.h >= a.content, '★사용자 글 = 상자가 늘어남(자름 0)').toBe(true);
  expect([t1 === t0, b.h >= b.content], '★다시 채우기 0 · 글 높이 아래로 안 줄어듦').toEqual([true, true]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('H6 슬라이더로 줄이기 — 더미 그대로면 끄는 대로 · 높이 그대로', async ({ page }) => {
  const { errs } = await scene(page, 300);
  await run(page);
  const a = await st(page);
  await page.fill('#txt-lorem-count', '2'); await page.press('#txt-lorem-count', 'Enter'); await raf(page);
  const b = await st(page);
  console.log('[H6 실측]', JSON.stringify({ a: [a.h, a.mk.n], b: [b.h, b.mk?.n, b.valid] }));
  expect([b.mk?.n, b.h, b.valid], '★개수 2 · 높이 그대로 · 더미 그대로').toEqual([Math.min(2, a.mk.m), 300, true]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('H7 저장·열기·⌘Z 가 표식을 옮김 · 옛 저장본 = 사용자 글', async ({ page }) => {
  const { errs } = await scene(page, 240);
  await run(page);
  const r = await page.evaluate(async () => {
    const get = () => { const b = document.getElementById('tbH'); return b ? { has: !!b.dataset.lorem, valid: !!window.loremMark(b) } : null; };
    const filled = get();
    window.undo(); const undone = get();
    window.redo(); const redone = get();
    const snap = window.serializeProject(); await window.applyProjectData(typeof snap === 'string' ? JSON.parse(snap) : snap);   // 저장 = JSON 글(탭 열기 tab-system.js 와 같은 길)
    const find = () => document.querySelector('#canvas .text-block[data-lorem]');   // 다시 연 캔버스 — 블럭은 표식으로 찾는다(열기가 시험이 단 id 를 안 지킬 수 있음)
    for (let i = 0; i < 50 && !find(); i++) await new Promise((r) => requestAnimationFrame(r));   // 열기 = 캔버스 다시 그림(비동기)
    const rb = find(); const reopened = rb ? { has: true, valid: !!window.loremMark(rb) } : null;
    const b = rb; if (b) delete b.dataset.lorem; const old = { valid: !!(b && window.loremMark(b)) };   // 옛 저장본 꼴(표식 없음)
    return { filled, undone, redone, reopened, old };
  });
  console.log('[H7 실측]', JSON.stringify(r));
  expect(r, '★⌘Z = 넣기 전(표식 없음) · ⌘⇧Z = 다시 · 저장·열기 = 그대로 · 표식 없음 = 사용자 글').toEqual({
    filled: { has: true, valid: true }, undone: { has: false, valid: false }, redone: { has: true, valid: true }, reopened: { has: true, valid: true }, old: { valid: false } });
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ★0.9.13 마감 채점 ❌(지디 261125 · 아이맥 GRADE-0913close-3 E08 · 판 dev 1cd189937) — 현빈 원문 «높이에 맞춰 양만 채우고 블럭 높이는 고정»
 *   E08-1 흐름 Body(높이 auto) «채우기»(문장·2) ×4 → 230/173/173/230(넣을 때마다 들쭉날쭉) · E08-2 IAL 켬 → 아래 변 +100(346) → «채우기» ×3 → 288/346/288
 * H8 auto 상자 — 채우기 ×4 → 높이 = 채우기 전 높이 그대로(넣을 때마다 같음) · 글이 상자 안
 * H9 IAL 켬 + 아래 변 +100 → 채우기 ×3 → 높이 = 끈 높이 그대로 · 글이 상자 안 */
const fillN = async (page, n) => { const hs = []; for (let i = 0; i < n; i++) { await run(page); hs.push(await st(page)); } return hs; };
test('H8 (174 마감) auto 상자 — 채우기 ×4 = 높이 그대로(채우기 전 높이) · 글 상자 안', async ({ page }) => {
  const { errs } = await scene(page, 0);
  const pre = await st(page);
  expect(pre.fh, '[전제] 높이 auto(정한 높이 없음)').toBeNull();
  const hs = await fillN(page, 4);
  console.log('[H8 실측]', JSON.stringify({ pre: pre.h, hs: hs.map((h) => [h.h, h.content, h.dots]) }));
  expect(hs.map((h) => h.h), `★넣을 때마다 높이 = 채우기 전 ${pre.h}`).toEqual([pre.h, pre.h, pre.h, pre.h]);
  expect(hs.every((h) => h.content <= pre.h + 1), '★글이 상자 안').toBe(true);
  expect(hs.every((h) => h.valid), '★더미 표식').toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('H9 (174 마감) IAL 켬 + 아래 변 +100 → 채우기 ×3 = 끈 높이 그대로 · 글 상자 안', async ({ page }) => {
  const { errs } = await scene(page, 0);
  const tg = await page.evaluate(() => { const e = document.getElementById('txt-overlay-toggle'); if (!e) return null; e.scrollIntoView({ block: 'center' }); const q = e.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; });   // t13d-06 toggleTxt 와 같은 손
  expect(tg, '[전제] 글자 패널 IAL 단추').toBeTruthy(); await page.mouse.click(tg[0], tg[1]); await raf(page);
  expect(await page.evaluate(() => document.getElementById('tbH').closest('.frame-block[data-text-frame]').dataset.overlayBlock), '[전제] IAL 켬').toBe('true');
  await run(page);   // 그레이드 E08-2 순서: 더미가 들어 있는 상자를 끌었다
  await dragS(page, 100);
  const after = await st(page);
  await page.evaluate(() => { window.selectBlock('tbH'); window.showTextProperties?.(document.getElementById('tbH')); });
  await page.waitForFunction(() => !!document.getElementById('txt-lorem-run'), null, { polling: 100, timeout: 5000 });
  const hs = await fillN(page, 3);
  console.log('[H9 실측]', JSON.stringify({ after: [after.h, after.fh], hs: hs.map((h) => [h.h, h.content, h.fh]) }));
  expect(hs.map((h) => h.h), `★채울 때마다 높이 = 끈 높이 ${after.h}`).toEqual([after.h, after.h, after.h]);
  expect(hs.every((h) => h.content <= after.h + 1), '★글이 상자 안').toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});
