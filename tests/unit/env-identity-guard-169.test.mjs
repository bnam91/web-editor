/* env-identity-guard-169.test.mjs — ★169 DOM-SWEEP-UNREADABLE-ENV-PRECONDITION-SPECS-01 · 판 정체(EXPECT_SHA)를 읽는 DOM spec 은
 *   «env 없는 일반 런» 에서 판 정체 전제만 건너뛴다 — 가드 없는 벌이 다시 생기면 빨강 (S3 · 261028)
 *
 * ★왜: 전수(env 없음)에서 판 정체 단언이 «장면 미성립» 빨강 47 을 냈다(S7 183 A · 행위 47 = 내 169 정적 47 · 지디 08:3x).
 *   그 47 은 제품 결함이 아니라 하네스 전제라 137 기준선을 더럽힌다.
 * ★두 꼴만 허용(지디 판정):
 *   ㈀ 판 정체가 boot()/assertBoard 안(제품 칸 전부가 부름) ⇒ _cr-harness 꼴 `if (!process.env.EXPECT_SHA && !…) return;` — ⛔test.skip
 *   ㈁ 판 정체 «전용 칸»(P0/B0) ⇒ radial-t4-a 꼴 `test.skip(!… EXPECT_SHA …, 'ID — …')`
 * ★자: 명부를 손으로 안 적는다 — tests/dom/*.spec.js 중 `process.env.EXPECT_SHA` 를 읽는 것(주석 뗌)을 긁어,
 *   그 파일에 위 두 꼴(또는 옛 꼴 `test.skip(!EXPECT_SHA` · `test.skip(!want`) 중 하나가 있어야 한다. 잰 수를 찍는다.
 * ⚠️한계(적음): «가드가 그 단언 앞에 있나»(순서·같은 함수)는 안 잰다 — 파일 안 «있음» 만. 행위(env 없이 돌려 빨강 0)는 DOM 런 몫.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const { stripComments } = createRequire(import.meta.url)('./_strip-comments.js');

const ROOT = process.env.GD1001_ROOT || path.join(import.meta.dirname, '..', '..');
const DOM = path.join(ROOT, 'tests', 'dom');
const READS = /process\.env\.EXPECT_SHA\b/;
const GUARD = /if\s*\(\s*!process\.env\.EXPECT_SHA\b[^)]*\)\s*(?:\{\s*[^}]*?)?return\b|test\.skip\(\s*!\s*(?:process\.env\.EXPECT_SHA|EXPECT_SHA|want)\b/;

/* ★283(지디 261029 15:4x) — ㈀ 꼴 «조용한 return» 만 따로 센다: env 없으면 그 spec 은 판 정체를 안 재고 «passed» 로 셈한다(skip 수에도 안 잡힘). */
const SILENT = /if\s*\(\s*!process\.env\.EXPECT_SHA\b[^)]*\)\s*(?:\{\s*[^}]*?)?return\b/;
const USES_CR = /require\(\s*['"]\.\/_cr-harness(?:\.js)?['"]\s*\)/;
/** @param extra 임시로 더해 보는 가상 spec [이름, 글자] (한 쌍용 · 디스크 안 씀) */
function census(extra = null) {
  const out = { read: 0, readers: [], unguarded: [], silent: [], crUsers: [] };
  const files = fs.readdirSync(DOM).filter((n) => n.endsWith('.spec.js')).sort().map((f) => [f, fs.readFileSync(path.join(DOM, f), 'utf8')]);
  if (extra) files.push(extra);
  for (const [f, raw] of files) {
    out.read++;
    const s = stripComments(raw);
    if (USES_CR.test(s)) out.crUsers.push(f);
    if (!READS.test(s)) continue;
    out.readers.push(f);
    if (!GUARD.test(s)) out.unguarded.push(f);
    if (SILENT.test(s)) out.silent.push(f);
  }
  return out;
}
/* ★283 래칫 기준 — ㈀ 꼴 spec 수(판 Intel refs/gd-pin/270 = 3ea20db3 · S3 261029 15:5x · 이 자로 잼). ⛔0 으로 내리라는 수가 아니다(가드의 까닭은 산다) — «늘지 않기» · 줄면 여기서 내려라. */
const SILENT_BASE = 7;

test('E0 ★자가 산다 — 미끼 양성·음성', () => {
  assert.equal(GUARD.test("async function assertBoard(page) {\n  if (!process.env.EXPECT_SHA && !process.env.CR_REQUIRE_BOARD) return;\n"), true, '㈀ 꼴을 못 본다');
  assert.equal(GUARD.test("  test.skip(!process.env.EXPECT_SHA && !process.env.CR_REQUIRE_BOARD, 'ID — x');"), true, '㈁ 꼴을 못 본다');
  assert.equal(GUARD.test("test.skip(!EXPECT_SHA, 'x');"), true, '옛 꼴(t4-12·t4-16)을 못 본다');
  assert.equal(GUARD.test("const want = process.env.EXPECT_SHA || '';\n  expect(want).toMatch(/^[0-9a-f]{40}$/);"), false, '가드 없는 꼴을 가드로 읽는다');
  assert.equal(READS.test(stripComments('// process.env.EXPECT_SHA 를 읽는다\n')), false, '주석 안 글자를 읽기로 센다');
});

test('E1 ★판 정체를 읽는 DOM spec 은 전부 가드가 있다(명부 파생)', () => {
  const c = census();
  console.log(`[169] tests/dom spec 읽음 ${c.read} · EXPECT_SHA 읽는 spec ${c.readers.length} · 가드 없음 ${c.unguarded.length}`);
  assert.ok(c.read > 0 && c.readers.length > 0, '전제: 읽은 spec 0 이거나 EXPECT_SHA 읽는 spec 0 — 자가 빈 순회');
  assert.deepEqual(c.unguarded, [], 'env 없는 일반 런에서 판 정체가 «장면 미성립» 빨강을 낸다 — ㈀ _cr-harness 꼴 또는 ㈁ test.skip+ID 를 붙여라');
});

test('E2 ★283 ㈀ «조용한 return» spec 수가 늘지 않는다(래칫 · 찍는 것이 처방)', () => {
  const c = census();
  const crOnly = c.crUsers.filter((f) => !c.readers.includes(f));
  console.log(`[283] ㈀ 조용한 return spec ${c.silent.length}(기준 ${SILENT_BASE}) · _cr-harness 를 부르는데 EXPECT_SHA 글자 없는 spec ${crOnly.length}(그 하네스 assertBoard 도 ㈀) ⇒ env 없이 판 정체 안 재고 passed 로 셈하는 spec ≥ ${c.silent.length + crOnly.length} · 이름 ${c.silent.join(' ')}`);
  assert.ok(c.silent.length <= SILENT_BASE, `★㈀ 꼴(env 없으면 판 정체 안 재고 통과)이 늘었다 ${SILENT_BASE} → ${c.silent.length} — 판 정체 «전용 칸»(㈁ test.skip+ID)으로 두라 · ${c.silent.join(' ')}`);
  assert.equal(c.silent.length, SILENT_BASE, `㈀ 꼴이 줄었다 ${SILENT_BASE} → ${c.silent.length} — SILENT_BASE 를 내려라(래칫)`);
});
test('E3 ★283 한 쌍 — ㈀ 꼴 spec 을 하나 더 심으면(가상 · 디스크 0) E2 가 빨강이 될 수다', () => {
  const plant = ['zz-283-plant.dom.spec.js', "async function assertBoard(page) {\n  if (!process.env.EXPECT_SHA && !process.env.CR_REQUIRE_BOARD) return;\n  expect(process.env.EXPECT_SHA).toMatch(/^[0-9a-f]{40}$/);\n}\n"];
  const c = census(plant);
  assert.equal(c.silent.length, census().silent.length + 1, '심은 ㈀ 꼴을 못 셌다');
  assert.ok(c.silent.length > SILENT_BASE, '심었는데도 기준 안 — E2 가 안 빨개질 수');
});
