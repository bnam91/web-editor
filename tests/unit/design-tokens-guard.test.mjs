/* design-tokens-guard.test.mjs — scripts/check-design-tokens.sh 를 npm test 에 배선한다. (right-panel-unify U0 · A-4)
 *   실행: node --test tests/unit/design-tokens-guard.test.mjs
 *
 * ★무엇을 잠그나
 *   G1 레포 그대로 rc 0 — 미정의 --ui-* 0 · 신규 패널 층 리터럴 0 · 래칫(baseline.json) 안 넘음
 *   G2 ★양성대조 — tmp 가짜 신규층 파일 `style="color:#123456"` 를 인자로 주면 rc 1 + 그 파일이 출력에 찍힌다
 *   G3 ★음성대조 — 같은 자리 깨끗한 파일(var(--ui-*) 만)은 rc 0 (G2 가 «인자 경로 자체가 실패»라서 빨간 게 아님을 증명)
 * ⛔tmp 파일은 os.tmpdir() 에만 만들고 finally 로 지운다(레포 안에 부산물 금지).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import cp from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SCRIPT = path.join(ROOT, 'scripts/check-design-tokens.sh');
const run = (...args) => cp.spawnSync('bash', [SCRIPT, ...args], { encoding: 'utf8', cwd: ROOT });

function withTmp(body, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gd-tokens-guard-'));
  const f = path.join(dir, 'fake-new-layer.js');
  try { fs.writeFileSync(f, body); return fn(f); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('G1 레포 그대로 check-design-tokens.sh rc 0', () => {
  const r = run();
  assert.equal(r.status, 0, `rc ${r.status}\n${r.stdout}${r.stderr}`);
  assert.match(r.stdout, /미정의 --ui-\* 토큰 없음/);
  assert.match(r.stdout, /신규 층 리터럴 0/);
  assert.match(r.stdout, /props-inline-hardcoded: \d+/, '★래칫 줄이 없다 — ③ 이 안 돌았다');
});

test('G2 ★양성대조 — 가짜 신규층 파일의 인라인 style 리터럴 → rc 1', () => {
  withTmp('export const x = `<div style="color:#123456">a</div>`;\n', (f) => {
    const r = run(f);
    assert.equal(r.status, 1, `★가짜 하드코딩을 못 잡았다 — 하드게이트가 «안 재고» 있다\n${r.stdout}${r.stderr}`);
    assert.ok(r.stdout.includes(f), `★실패 줄에 그 파일이 안 찍힌다\n${r.stdout}`);
    assert.match(r.stdout, /#123456/);
  });
});

test('G3 ★음성대조 — 깨끗한 신규층 파일(토큰만) → rc 0', () => {
  withTmp('export const x = `<div style="color:var(--ui-text-sub)">a</div>`;\n', (f) => {
    const r = run(f);
    assert.equal(r.status, 0, `★깨끗한 파일인데 빨갛다 — G2 의 빨강이 «인자 경로 고장»일 수 있다\n${r.stdout}${r.stderr}`);
  });
});
