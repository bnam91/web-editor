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

function census() {
  const out = { read: 0, readers: [], unguarded: [] };
  for (const f of fs.readdirSync(DOM).filter((n) => n.endsWith('.spec.js')).sort()) {
    out.read++;
    const s = stripComments(fs.readFileSync(path.join(DOM, f), 'utf8'));
    if (!READS.test(s)) continue;
    out.readers.push(f);
    if (!GUARD.test(s)) out.unguarded.push(f);
  }
  return out;
}

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
