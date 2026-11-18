/* css-token-static-proof.test.mjs — CSS 토큰 통일 A단계 «정적증명» (PLAN-css-token-unify-261118 §5 ②(i)).
 *   실행: node --test tests/unit/css-token-static-proof.test.mjs
 *         CSS_TOKEN_BASE=<레인 바탕 sha> node --test tests/unit/css-token-static-proof.test.mjs   ← 레인 단위마다
 *
 * S0 자 자체의 양성·음성대조(늘 돈다 · git·레포 상태 무관): 맞는 교체는 초록 · 엉뚱한 토큰/역할 다름/테마 토큰/교체 아닌 변경/정의 변경은 빨강
 * S1 레포 사실: A단계 명부 토큰은 전부 :root 에 있고 · :root 밖 재정의 0 · 런타임 덮어쓰기 명부와 겹침 0 · 테마 토큰은 런타임 명부에 잡힌다
 * S2 CSS_TOKEN_BASE 대비 css 변경 = 전부 «한 줄 ↔ 한 줄 토큰 교체»이고 var→:root 값 치환이 원문과 같다(n/n). 변수 없으면 skip(레인 밖에선 잴 바탕이 없다).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const A = createRequire(import.meta.url)('../../scripts/css-token-a-stage.cjs');

const FAKE = {
  values: { '--ui-border-mid': '#3a3a3a', '--ui-border': '#333333', '--ui-text-sub': '#aaaaaa', '--ui-fs-12': '12px', '--ui-fw-semibold': '600', '--ui-space-1': '4px', '--ui-space-2': '8px', '--ui-accent-primary': '#2d6fe8' },
  scoped: new Set(),
  runtime: { names: new Set(['--ui-border', '--ui-accent-primary']), prefixes: new Set(['--color-']) },
};

test('S0 자 양성·음성대조', () => {
  const ok = (r, a) => A.proofPair(r, a, FAKE);
  assert.equal(ok('  border: 1px solid #3a3a3a;', '  border: 1px solid var(--ui-border-mid);').ok, true, '맞는 색 교체');
  assert.equal(ok('  border:1px solid #3A3A3A;', '  border:1px solid var(--ui-border-mid);').ok, true, '대소문자만 다른 표기');
  assert.equal(ok('  color: #aaa;', '  color: var(--ui-text-sub);').ok, true, '3자리 hex');
  assert.equal(ok('  font-weight: 600;', '  font-weight: var(--ui-fw-semibold);').ok, true, 'fw');
  assert.equal(ok('  padding: 4px 8px;', '  padding: var(--ui-space-1) var(--ui-space-2);').ok, true, '간격 두 개');
  assert.equal(ok('.a{font-size:12px;color:#aaa}', '.a{font-size:var(--ui-fs-12);color:var(--ui-text-sub)}').ok, true, '한 줄 여러 선언');
  const bad = [
    ['  border: 1px solid #3a3a3a;', '  border: 1px solid var(--ui-border);', /테마|원문/],          // 값 다름 + 테마
    ['  border: 1px solid #333;', '  border: 1px solid var(--ui-border);', /테마/],                  // 값 같아도 테마 토큰
    ['  border: 1px solid #aaaaaa;', '  border: 1px solid var(--ui-text-sub);', /역할/],              // text 토큰을 border 에
    ['  line-height: 12px;', '  line-height: var(--ui-fs-12);', /역할/],                              // fs 토큰을 line-height 에
    ['  width: 4px;', '  width: var(--ui-space-1);', /역할/],                                         // 간격 토큰을 크기에
    ['  color: #3a3a3a;', '  color: var(--ui-border-mid);', /역할/],
    ['  padding: 4px;', '  padding: 5px;', /교체가 아닌/],                                            // 값 바꿈
    ['  padding: 4px;', '  padding: var(--ui-radius-sm);', /명부 밖/],
    ['  --ui-fs-12: 12px;', '  --ui-fs-12: 13px;', /정의/],
    ['  padding: 4px;', '  padding: var(--ui-space-2);', /원문/],                                     // 값 다른 토큰
  ];
  for (const [r, a, why] of bad) { const x = ok(r, a); assert.equal(x.ok, false, `빨강이어야: ${a}`); assert.match(x.why, why, a); }
});

test('S1 레포 사실 — 명부 토큰 :root 정의 · 재정의 0 · 테마 토큰은 런타임 명부', () => {
  const ctx = A.loadCtx(ROOT);
  const aNames = Object.keys(ctx.values).filter((n) => A.tokenRule(n));
  assert.ok(aNames.length >= 20, `A 명부 토큰이 :root 에 있다(${aNames.length})`);
  for (const n of ['--ui-space-1', '--ui-fs-base', '--ui-fw-semibold', '--ui-border-mid', '--ui-text-sub']) assert.ok(ctx.values[n], `${n} 정의`);
  for (const n of aNames) {
    assert.equal(ctx.scoped.has(n), false, `${n} :root 밖 재정의`);
    assert.equal(A.isRuntime(n, ctx.runtime), false, `${n} 런타임 덮어쓰기`);
  }
  for (const n of ['--ui-accent-primary', '--ui-text', '--ui-bg-input', '--ui-border']) assert.ok(A.isRuntime(n, ctx.runtime), `${n} 는 테마가 덮는다(명부 뽑기가 살아 있다)`);
  assert.ok(A.isRuntime('--color-accent', ctx.runtime), 'design-system.js --color-<이름> 접두사');
});

test('S2 CSS_TOKEN_BASE 대비 css 변경 = 토큰 교체만 · 치환=원문', { skip: !process.env.CSS_TOKEN_BASE && 'CSS_TOKEN_BASE 없음(레인 단위에서만 잰다)' }, () => {
  const r = A.proveDiff(ROOT, process.env.CSS_TOKEN_BASE);
  const bad = r.pairs.filter((p) => !p.ok);
  console.log(`[css-token] 정적증명 ${r.pairs.length - bad.length}/${r.pairs.length} · 짝 안 맞음 ${r.unpaired.length}`);
  assert.deepEqual([...r.unpaired.map((u) => `${u.file}:${u.line} ${u.why}`), ...bad.map((p) => `${p.file}:${p.line} ${p.why}`)], []);
});
