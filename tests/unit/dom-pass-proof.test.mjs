/* dom-pass-proof.test.mjs — tools/dom-pass-proof.js 판정 + release-mac.yml 배선 (0.9.12 · B안)
 * ★건너뜀은 «전부 맞을 때» 단 하나. 나머지 전부 = 실행. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const { decide, MIN_PASSED } = require('../../tools/dom-pass-proof.js');

const H = 'a'.repeat(39) + 'b';
const base = { event: 'push', refType: 'tag', head: H };
const ok = `v0.9.12\n\nDOM-PASS commit=${H} passed=6994 flaky=1\n`;

test('P1 ★양성 — 태그 푸시 + sha 일치 + passed≥하한 = 건너뜀', () => {
  assert.equal(decide({ ...base, message: ok }).skip, true);
});
test('P2 sha 불일치 = 실행', () => {
  const r = decide({ ...base, message: ok.replace(H, 'c'.repeat(40)) });
  assert.equal(r.skip, false); assert.match(r.reason, /≠/);
});
test('P3 메시지 없음 · 형식 깨짐 = 실행', () => {
  for (const m of ['', undefined, 'v0.9.12\n', `DOM-PASS commit=${H.slice(0, 7)} passed=6994 flaky=1`,
    `DOM-PASS commit=${H} passed=abc flaky=1`, `dom-pass commit=${H} passed=6994 flaky=1`,
    `DOM-PASS commit=${H.toUpperCase()} passed=6994 flaky=1`, ` DOM-PASS commit=${H} passed=6994 flaky=1`]) {
    assert.equal(decide({ ...base, message: m }).skip, false, JSON.stringify(m));
  }
});
test('P4 곁 — dispatch/브랜치 = 늘 실행 · passed 미달 = 실행 · 증명 줄 둘 = 실행 · head 못 읽음 = 실행', () => {
  assert.equal(decide({ ...base, event: 'workflow_dispatch', message: ok }).skip, false);
  assert.equal(decide({ ...base, refType: 'branch', message: ok }).skip, false);
  assert.equal(decide({ ...base, message: ok.replace('6994', String(MIN_PASSED - 1)) }).skip, false);
  assert.equal(decide({ ...base, message: ok + ok.split('\n')[2] + '\n' }).skip, false);
  assert.equal(decide({ ...base, head: '', message: ok }).skip, false);
});
test('P5 ★배선 — DOM 단계는 증명 판정 «뒤»에서 그 출력으로만 건너뛰고, 빌드보다 앞이다', () => {
  const y = fs.readFileSync(path.join(ROOT, '.github/workflows/release-mac.yml'), 'utf8').replace(/^\s*#.*$/gm, '');   // 주석 속 같은 낱말에 안 속게
  const proof = y.indexOf('node tools/dom-pass-proof.js'), dom = y.indexOf('npm run test:dom'), b = y.indexOf('electron-builder');
  assert.ok(proof > -1 && dom > -1 && b > -1, '조각을 못 찾음 — 검사가 안 돈 것');
  assert.ok(proof < dom && dom < b);
  assert.match(y.slice(y.lastIndexOf('- name:', dom), dom), /if: \$\{\{ steps\.dom_proof\.outputs\.skip_dom != 'true' \}\}/);
  assert.ok(!/pull_request|workflow_run|issue_comment/.test(y), '위험 트리거 금지');
});
