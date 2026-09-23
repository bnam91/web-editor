/* assert-strength.test.mjs — T-177 «단언이 제자리에서 약해지는 것»을 잡는 자의 자기검사.
 *   실행: node --test "tests/unit/*.test.mjs" "tests/unit/*.test.js"
 *
 * ★이 파일이 하는 일은 하나다 — **그 자를 일부러 깨뜨려서, 정말로 빨개지는지 본다.**
 *   ⛔「만들었다」는 근거가 아니다. 「약하게 만들어 봤더니 잡더라」만 근거다(카드 T-177 🔎).
 *
 * ★★계측기가 «자기 자신»을 재는 자리도 같이 둔다 — 이 원장의 「양성대조는 계측기만
 *   증명한다」·「계측기가 자기 자신을 잰다」가 겹치는 자리다:
 *     ⒜ 변이가 «실제로 꽂혔나» — 원본과 한 글자도 안 다르면 그 «통과»는 0건짜리 거짓이다.
 *     ⒝ 음성대조 — 안 약해진 손질(주석 추가·단언 «강화»·약한 단언 «삭제»)에 안 빨개지나.
 *     ⒞ 바닥 — 레포 검사 전수에서 단언을 0건으로 세면 자가 죽은 것이다.
 *
 * ⛔표본은 «합성»이다 — 레포에 「이런 꼴이 있어야 한다」를 전제로 걸지 않는다.
 *   그렇게 걸면 그 꼴을 고쳐 없앨수록 빨개진다(실물 건수는 CLI 가 메시지로만 말한다).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { census, diffCensus, blank } from '../../tools/assert-strength.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '../../');

/* ── 합성 «기준판» — 이 자가 잴 것을 전부 한 벌에 담는다 ────────────────── */
const BASE = `
const { test, expect } = require('@playwright/test');
const assert = require('node:assert/strict');

test('S1 값이 같다', async () => {
  const r = await run();
  expect(r.count).toBe(3);
  expect(r.rows).toEqual(['a', 'b']);
  assert.strictEqual(r.name, 'goditor');
});

test('S2 두 자리', async () => {
  const r = await run();
  expect(r.alive).toBe(true);
  expect(r.depth).toBe(0);
});

test('S3 한 자리', async () => {
  expect(await value()).toBe(7);
});
`;

/** 변이 하나 — {이름, 찾을것, 바꿀것, 기대하는 «까닭» 조각} */
const MUTANTS = [
  { name: '자를 약한 것으로 바꾼다 (toBe → toBeTruthy)',
    find: "expect(r.count).toBe(3);", repl: "expect(r.count).toBeTruthy();", why: '세기 합' },
  { name: '값 대조를 «일부만» 으로 바꾼다 (toEqual → toContain)',
    find: "expect(r.rows).toEqual(['a', 'b']);", repl: "expect(r.rows).toContain('a');", why: '세기 합' },
  { name: 'assert 를 ok 로 낮춘다 (strictEqual → ok)',
    find: "assert.strictEqual(r.name, 'goditor');", repl: "assert.ok(r.name);", why: '세기 합' },
  { name: '단언을 하나 지운다',
    find: "  expect(r.depth).toBe(0);\n", repl: "", why: '단언 수' },
  { name: '단언을 «안 돌 수도 있는 자리»(if)로 옮긴다',
    find: "  expect(r.alive).toBe(true);", repl: "  if (r.alive !== undefined) { expect(r.alive).toBe(true); }", why: '안 돌 수도 있는 자리' },
  { name: 'expect 를 soft 로 바꾼다 (빨개도 안 멈춘다)',
    find: "expect(await value()).toBe(7);", repl: "expect.soft(await value()).toBe(7);", why: 'expect.soft' },
  { name: "검사를 건너뛴다 (test → test.skip)",
    find: "test('S3 한 자리'", repl: "test.skip('S3 한 자리'", why: 'run→skip' },
  { name: "검사를 «빨간 것이 정상»으로 돌린다 (test → test.fail)",
    find: "test('S2 두 자리'", repl: "test.fail('S2 두 자리'", why: 'run→fail' },
  { name: '본문 안에서 조건부로 건너뛴다 (test.skip(cond))',
    find: "  const r = await run();\n  expect(r.alive)", repl: "  test.skip(!process.env.CI, '느려서');\n  const r = await run();\n  expect(r.alive)", why: 'run→cond-skip' },
];

const baseRows = census(BASE, 'synthetic.spec.js');

test('T0 ★계측기가 살아 있다 — 합성 기준판을 제대로 센다(0건을 통과로 안 읽는다)', () => {
  assert.equal(baseRows.length, 3, '합성 표본의 검사 셋을 다 찾아야 한다');
  const byName = Object.fromEntries(baseRows.map(r => [r.name.split(' » ').pop().slice(0, 2), r]));
  assert.equal(byName.S1.n, 3);
  assert.equal(byName.S1.w, 12, 'toBe·toEqual·strictEqual = 4+4+4');
  assert.equal(byName.S2.n, 2);
  assert.equal(byName.S3.n, 1);
  for (const r of baseRows) assert.equal(r.state, 'run');
  for (const r of baseRows) assert.equal(r.guarded, 0);
});

test('T1 ★★변이 아홉을 «하나씩 꽂아» 전부 빨간지 본다 — 이 자가 근거인지의 시험', () => {
  const missed = [];
  for (const m of MUTANTS) {
    /* ⒜ 계측기 자가검사 — 변이가 «정말로» 꽂혔나. 안 꽂히면 그 통과는 0건짜리 거짓이다. */
    assert.ok(BASE.includes(m.find), `⛔변이 닻이 늙었다(못 꽂았다): ${m.name}`);
    const head = BASE.replace(m.find, m.repl);
    assert.notEqual(head, BASE, `⛔변이가 소스를 «한 글자도» 안 바꿨다: ${m.name}`);

    const { weakened } = diffCensus(baseRows, census(head, 'synthetic.spec.js'));
    if (!weakened.length) { missed.push(`${m.name} — 아무것도 안 잡았다`); continue; }
    const why = weakened.map(w => w.why.join(' · ')).join(' | ');
    if (!why.includes(m.why)) missed.push(`${m.name} — 잡긴 했는데 까닭이 다르다: ${why}`);
  }
  assert.deepEqual(missed, [],
    `⛔이 자가 놓친 «느슨해짐»:\n  ${missed.join('\n  ')}\n` +
    '  ⇒ 놓치는 꼴이 있으면 이 자는 근거가 아니다. 사다리(LADDER)나 scanBody 를 고쳐라.');
});

test('T2 ★음성대조 — 안 약해진 손질엔 «안» 빨개진다', () => {
  const same = [
    ['주석만 더한다', BASE.replace("test('S3", "/* 설명 주석 — expect(x).toBe(1) 같은 글자가 들어 있어도 안 세야 한다 */\ntest('S3")],
    ['빈 줄·들여쓰기만 바꾼다', BASE.replace('\n\ntest(', '\n\n\ntest(')],
    ['★단언을 «강화»한다 (toBe → toEqual 로 값까지)', BASE.replace('expect(r.alive).toBe(true);', "expect(r.alive).toEqual(true);")],
    ['★단언을 하나 «더한다»', BASE.replace('expect(r.depth).toBe(0);', "expect(r.depth).toBe(0);\n  expect(r.extra).toBe(1);")],
    ['★검사를 통째로 «지운다» — 그건 이미 다른 자가 본다(여기선 빨강 아님)',
      BASE.replace(/test\('S3[\s\S]*?\n\}\);\n/, '')],
  ];
  for (const [label, head] of same) {
    assert.notEqual(head, BASE, `⛔변이가 안 꽂혔다: ${label}`);
    const { weakened } = diffCensus(baseRows, census(head, 'synthetic.spec.js'));
    assert.deepEqual(weakened.map(w => `${w.name}: ${w.why.join('·')}`), [],
      `⛔거짓 경보 — ${label} 에 빨개졌다`);
  }
});

test('T3 ★★주석·문자열 «안»의 expect 는 안 센다 — 닻을 가로채는 그 사고(4b0e6a1) 계열', () => {
  const src = `
test('C1', async () => {
  // expect(a).toBe(1);
  /* expect(b).toBe(2); assert.ok(c); */
  const s = "expect(d).toBe(3)";
  const t = \`expect(e).toBe(4)\`;
  const rx = /expect\\(f\\)\\.toBe/;
  expect(real).toBe(5);
});
`;
  const [row] = census(src, 'c.spec.js');
  assert.equal(row.n, 1, '진짜 단언 하나만 세야 한다(주석·문자열·정규식 속은 0)');
  assert.equal(row.w, 4);
  /* blank 는 «길이»를 안 바꾼다 — 안 그러면 오프셋이 어긋나 위 셈이 통째로 틀린다 */
  assert.equal(blank(src).length, src.length);
});

test('T4 ★바닥 — 레포 검사 전수에서 단언이 0건이면 이 자가 죽은 것이다', () => {
  /* ⛔「이런 꼴이 있어야 한다」가 아니다 — «0 이 아니다»만 본다. 고칠수록 빨개지지 않는다.
     ★두 «말»을 다 밟는다 — tests/unit 은 node assert, tests/dom 은 playwright expect 다.
       한쪽만 보면 다른 쪽 말을 못 알아듣게 돼도 이 바닥이 초록이다.
     ⚠️전수는 안 돈다(전수 정적 파싱은 15초다 — 실측). 매번 도는 자리라 표본으로 센다:
       unit 은 앞 40개, dom 은 앞 12개(이름순 — 사람이 고르지 않는다). */
  const sample = (d, k) => fs.readdirSync(path.join(REPO, d)).sort()
    .filter(f => /\.(test|spec)\.(js|mjs)$/.test(f)).slice(0, k).map(f => `${d}/${f}`);
  let tests = 0, asserts = 0, files = 0, domAsserts = 0, unitAsserts = 0;
  for (const rel of [...sample('tests/unit', 40), ...sample('tests/dom', 12)]) {
    files++;
    for (const r of census(fs.readFileSync(path.join(REPO, rel), 'utf8'), rel)) {
      tests++; asserts += r.n;
      if (rel.startsWith('tests/dom')) domAsserts += r.n; else unitAsserts += r.n;
    }
  }
  assert.ok(unitAsserts > 0, '★tests/unit(node assert) 에서 단언을 0건으로 셌다 — 그 말을 못 알아듣는다');
  assert.ok(domAsserts > 0, '★tests/dom(playwright expect) 에서 단언을 0건으로 셌다 — 그 말을 못 알아듣는다');
  assert.ok(files >= 50, `검사 파일을 ${files}개밖에 못 찾았다 — 자가 눈이 멀었다`);
  assert.ok(tests > 100, `검사를 ${tests}개밖에 못 셌다 — 자가 눈이 멀었다`);
  assert.ok(asserts > tests, `단언(${asserts})이 검사 수(${tests})보다 적다 — 자가 눈이 멀었다`);
});
