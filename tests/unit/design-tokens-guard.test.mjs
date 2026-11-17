/* design-tokens-guard.test.mjs — scripts/check-design-tokens.sh 를 npm test 에 배선한다. (right-panel-unify U0 · A-4)
 *   실행: node --test tests/unit/design-tokens-guard.test.mjs
 *
 * ★무엇을 잠그나
 *   G1 레포 그대로 rc 0 — 미정의 --ui-* 0 · 신규 패널 층 리터럴 0 · 래칫(baseline.json) 안 넘음
 *   G2 ★양성대조 — tmp 가짜 신규층 파일 `style="color:#123456"` 를 인자로 주면 rc 1 + 그 파일이 출력에 찍힌다
 *   G3 ★음성대조 — 같은 자리 깨끗한 파일(var(--ui-*) 만)은 rc 0 (G2 가 «인자 경로 자체가 실패»라서 빨간 게 아님을 증명)
 *   G4 ★양성대조 — PF_CSS=tmp CSS(panel-frame:BEGIN~END 안 color:#123) → rc 1 · 같은 꼴 토큰만이면 rc 0
 *   G5 ★양성대조 — BASELINE=tmp json(props-inline-hardcoded = 현재−1) → rc 1 · 현재값 그대로면 rc 0
 * ⛔tmp 는 공용 자 tests/unit/_tmproot.js mkTmpRoot 로만 만든다 — 우산 폴더가 종료·다음 실행에 회수한다(손으로 rmSync 안 함 · tmproot-sole-owner).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const { mkTmpRoot } = createRequire(import.meta.url)('./_tmproot.js');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SCRIPT = path.join(ROOT, 'scripts/check-design-tokens.sh');
const run = (...args) => cp.spawnSync('bash', [SCRIPT, ...args], { encoding: 'utf8', cwd: ROOT });
const runEnv = (env) => cp.spawnSync('bash', [SCRIPT], { encoding: 'utf8', cwd: ROOT, env: { ...process.env, ...env } });

function withTmp(body, fn, name = 'fake-new-layer.js') {
  const f = path.join(mkTmpRoot('gd-tokens-guard-'), name);
  fs.writeFileSync(f, body);
  return fn(f);
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

const pfCss = (decl) => `.x { color: #fff; }\n/* panel-frame:BEGIN */\n.prop-sec-body { ${decl} }\n/* panel-frame:END */\n`;

test('G4 ★양성대조 — 패널 절 CSS 블록 안 리터럴 → rc 1 (밖의 리터럴은 안 센다)', () => {
  withTmp(pfCss('color:#123;'), (f) => {
    const r = runEnv({ PF_CSS: f });
    assert.equal(r.status, 1, `★블록 안 #123 을 못 잡았다\n${r.stdout}${r.stderr}`);
    assert.match(r.stdout, /#123/);
  }, 'fake.css');
  withTmp(pfCss('color:var(--ui-text);'), (f) => {
    const r = runEnv({ PF_CSS: f });
    assert.equal(r.status, 0, `★토큰만인데 빨갛다(블록 밖 #fff 를 셌나)\n${r.stdout}${r.stderr}`);
  }, 'fake.css');
});

test('G5 ★양성대조 — baseline 을 현재−1 로 두면 래칫 rc 1', () => {
  const cur = Number(/props-inline-hardcoded: (\d+)/.exec(run().stdout)?.[1]);
  assert.ok(cur > 0, '[전제] 현재값을 못 읽었다');
  const real = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/design-tokens.baseline.json'), 'utf8'));
  withTmp(JSON.stringify({ ...real, 'props-inline-hardcoded': cur - 1 }), (f) => {
    const r = runEnv({ BASELINE: f });
    assert.equal(r.status, 1, `★늘어난 하드코딩을 못 잡았다\n${r.stdout}`);
    assert.match(r.stdout, /props-inline-hardcoded: \d+ > 기준/);
  }, 'baseline.json');
  withTmp(JSON.stringify({ ...real, 'props-inline-hardcoded': cur }), (f) => {
    assert.equal(runEnv({ BASELINE: f }).status, 0, '★같은 값인데 빨갛다');
  }, 'baseline.json');
});
