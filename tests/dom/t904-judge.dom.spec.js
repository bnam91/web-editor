/* t904-judge — t9-04 닫는 칸. ⑴분모 = SECTION_BLOCK_TYPE_SEL 길이 ⑵종별 양성 전부 빨강(종·길·망가뜨림). 음성: 안 망가뜨리면 네 길 초록. 칸 표는 tests/unit/t904-cells.test.mjs.
 * 값: T904_OUT(기본 test-results/t904)/inject-<자리>.json. 입구 없는 종은 gray. 찾은 것은 고치지 않는다. */
const { test, expect } = require('@playwright/test');
const fs = require('fs'); const path = require('path');
const { bootApp, ROOT } = require('./_root-harness.js');
const { rosterOf } = require('./_block-roster-294.js');
const { planOf, kindsOf } = require('./_t904-plan.js');
const J = require('./_t904-judge.js');
const OUT = process.env.T904_OUT || path.join(__dirname, '..', '..', 'test-results', 't904');
const MODES = ['dataset', 'node'];
/* 저장 왕복 때 진짜 달라지는 것(t9-04 값 · 재현은 회신). 판정기가 잡았다는 증거이기도 하다 */
const KNOWN_NEGATIVE = [];
const { build } = J;
test('⑴ 분모 = SECTION_BLOCK_TYPE_SEL 길이 · 입구가 앱과 같다', async ({ page }) => {
  await bootApp(page);
  const plan = planOf(ROOT); const sel = await page.evaluate(() => window.SECTION_BLOCK_TYPE_SEL.split(', ').map((s) => s.slice(1)));
  expect(plan.kinds.map((k) => k.cls)).toEqual(sel); expect(kindsOf(ROOT)).toEqual(sel);
  expect(plan.cells.length, '전 칸 = 종 × 자리 × 조작').toBe(sel.length * plan.places.length * plan.ops.length);
  const live = await page.evaluate((names) => names.map((n) => typeof window[n] === 'function'), plan.kinds.map((k) => k.entry || '-'));
  plan.kinds.forEach((k, i) => expect(live[i], `${k.cls} 입구 ${k.entry}`).toBe(!!k.entry));
  expect(await rosterOf(page), '[전제] t9-03 분모와 같은 종').toHaveLength(sel.length);
});
const plan = planOf(path.join(__dirname, '..', '..'));
const label = (v, id) => (J.pointsAt(v, id) ? 'red' : v.red ? 'red-elsewhere' : 'green');
for (const place of ['section', 'free', 'stack', 'deep2']) test(`⑵ 종별 양성·음성 — ${place}`, async ({ page }) => {
  test.setTimeout(300000);
  await bootApp(page); const rows = [];
  for (const kind of plan.kinds) {
    const row = { kind: kind.cls, place, inject: {}, negative: {} }; rows.push(row);
    if (!kind.entry) { row.gray = '입구 없음'; continue; }
    const b = await build(page, kind, place); await J.settle(page); if (!b.id) { row.err = b.err; continue; } Object.assign(row, { inHost: b.inHost, hostMode: b.hostMode, hostDepth: b.hostDepth });
    if (place === 'stack') expect(b.hostMode, '[전제] 그릇이 stack').toBe('stack'); if (place === 'free') expect(b.hostMode, '[전제] 그릇이 free').toBe('free'); if (place === 'deep2') expect(b.hostDepth, '[전제] 깊이 2').toBe(2);
    const base = await J.serial(page); const file = await J.fileCanvas(page);
    const noted = (v) => (v.red ? { red: true, diffs: v.diffs.slice(0, 3) } : v.soft ? `green soft:${v.soft}` : 'green');
    row.negative.undo = noted(await J.judgeUndo(page, base)); row.negative.saved = noted(await J.judgeSaved(page, base, file));
    for (const mode of MODES) { const m = await J.mangleBytes(page, file, b.id, mode); row.inject[`saved:${mode}`] = m.touched ? label(await J.judgeSaved(page, base, m.bytes), b.id) : 'unreached'; }
    /* 다시 쓰면 나무가 바뀐다 — 첫 rebind 뒤 바이트가 다음 기준 */
    row.negative.rebind = noted(await J.judgeRebind(page, base, base)); const base2 = await J.serial(page);
    row.negative.rebind2 = noted(await J.judgeRebind(page, base2, base2));
    /* 진짜 열기 — 첫 열기 차이는 음성 칸, 열기 뒤 바이트가 다음 기준(열기 둘째는 달라지면 안 된다) */
    row.negative.open = noted(await J.judgeOpen(page, base2)); const base4 = await J.serial(page);
    row.negative.open2 = noted(await J.judgeOpen(page, base4));
    for (const mode of MODES) { const v = await J.judgeOpen(page, base4, { id: b.id, mode }); const r = v ? label(v, b.id) : 'unreached'; row.inject[`open:${mode}`] = r === 'green' && kind.groups.includes('G3') ? 'healed' : r; /* 열기는 지금 나무를 저장해 연다 — 앞 망가뜨림이 안 남게 바이트로 되돌린다 */ await J.judgeRebind(page, base4, base4); }
    for (const mode of MODES) {
      const m = await J.mangleBytes(page, base2, b.id, mode); const r = m.touched ? label(await J.judgeRebind(page, m.bytes, base2), b.id) : 'unreached';
      /* 다시 그리는 종은 저장 노드를 dataset 에서 되살린다 — healed. 그 뒤 나무를 망가뜨려 비교기가 그 자식을 걷는지 따로 잰다 */
      row.inject[`rebind:${mode}`] = r === 'green' && kind.groups.includes('G3') ? 'healed' : r;
      await J.judgeRebind(page, base2, base2);
      row.inject[`rendered:${mode}`] = (await J.mangleLive(page, b.id, mode)) ? label(await J.judgeUndo(page, base2), b.id) : 'unreached';
      await J.judgeRebind(page, base2, base2);
    }
  }
  fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, `inject-${place}.json`), JSON.stringify(rows, null, 1));
  const live = rows.filter((r) => !r.gray);
  expect(live.filter((r) => r.err).map((r) => `${r.kind}: ${r.err}`), '입구 오류').toEqual([]);
  /* 음성 빨강은 찾은 것이다. 없어지면 이 칸이 빨개진다 — KNOWN 을 지워라 */
  expect(live.flatMap((r) => Object.entries(r.negative).filter(([, v]) => typeof v !== 'string').map(([k]) => `${r.kind} ${place} ${k}`)), '음성 빨강').toEqual(KNOWN_NEGATIVE.filter((x) => x.includes(` ${place} `)));
  expect(live.flatMap((r) => Object.entries(r.inject).filter(([, v]) => !(v === 'red' || v === 'healed')).map(([k, v]) => `${r.kind} ${k}=${v}`)), '양성 초록').toEqual([]);
  if (place !== 'section') expect(live.filter((r) => r.inHost === false).map((r) => r.kind), '떠 있는 종 = 입구 몸으로 뜬 것').toEqual(plan.kinds.filter((k) => k.floats).map((k) => k.cls));
});
test('⑶ 가르기 — 안전 거절 · 말없는 무동작 · 손실 · 변함', async ({ page }) => {
  await bootApp(page);
  const kid = (t) => `<div class="section-block"><div class="text-block" id="a">${t}</div></div>`;
  const two = '<div class="section-block"><div class="text-block" id="a">x</div><div class="asset-block" id="b"></div></div>';
  const c = (before, after, o = {}) => J.classify(page, { before, after, selBefore: o.sb || [], selAfter: o.sa || [], toast: !!o.toast });
  expect(await c(two, two, { sb: ['a'], sa: ['a'] })).toBe('safe-reject');
  expect(await c(two, two, { toast: true })).toBe('safe-reject');
  expect(await c(two, two), '[음성] 변화도 말도 없음').toBe('silent-noop');
  expect(await c(two, two, { sb: ['a'], sa: ['b'] }), '[음성] 선택이 바뀌면 거절이 아니다').toBe('silent-noop');
  expect(await c(two, kid('x'))).toBe('loss');
  expect(await c(kid('x'), kid('y'))).toBe('changed');
  expect(await c(kid('x'), two)).toBe('changed');
});
/* 진짜 고르기·키 — 판정기 검증 소량(축 1 전체 런 아님). 못 고른 칸은 measured:false */
for (const cls of ['text-block', 'asset-block', 'joker-block', 'grid-block', 'chat-block', 'sticker-block']) test(`⑷ ⌘D·⌫·⌘Z 소량 — ${cls}`, async ({ page }) => {
  await bootApp(page); const kind = plan.kinds.find((k) => k.cls === cls); const b = await build(page, kind, 'section'); await J.settle(page);
  const base = await J.serial(page); const row = await J.smallRound(page, b.id, base);
  fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, `small-${cls}.json`), JSON.stringify({ kind: cls, ...row }, null, 1));
  expect(row.measured, row.why || '').toBe(true);
  expect(row.dup.outcome, '⌘D').toBe('changed'); expect(row.dup.undo.red, JSON.stringify(row.dup.undo.diffs[0])).toBe(false);
  expect(row.del.outcome, '⌫').toBe('loss'); expect(row.del.undo.red, JSON.stringify(row.del.undo.diffs[0])).toBe(false);
  expect(row.saved.red, JSON.stringify(row.saved.diffs[0])).toBe(false);
});
