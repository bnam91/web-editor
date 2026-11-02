/* env-head.test.mjs — 시트 335 tools/env-head.mjs. 양성 · 음성 · 가림 · 파생 · 자가 죽음 · --check 한 쌍. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { mkTmpRoot } = createRequire(import.meta.url)('./_tmproot.js');
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TOOL = path.join(ROOT, 'tools', 'env-head.mjs');
const clean = () => Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(EXPECT_SHA|GODITOR_|ZZZ_)/.test(k)));
const run = (args, env = {}) => spawnSync(process.execPath, [TOOL, ...args], { encoding: 'utf8', env: { ...clean(), ...env } });

test('E1 음성 · 양성 — 안 주면 (없음) · 주면 그 값(EXPECT_SHA)', () => {
  assert.match(run([ROOT]).stdout, /\bEXPECT_SHA=\(없음\)/);
  assert.match(run([ROOT], { EXPECT_SHA: 'deadbeef' }).stdout, /\bEXPECT_SHA=deadbeef\b/);
});
test('E2 ★가림 — 이름 · URL 인증 · 긴 값 · 그리고 안 가릴 것은 그대로', () => {
  const o = run([ROOT], { GODITOR_TEST_ADMIN_CODE: 'hunter2', GODITOR_LICENSE_API: 'https://u:pw@api.example.com/v1', GODITOR_COLLAB_API: 'http://127.0.0.1:3000' }).stdout;
  assert.match(o, /GODITOR_TEST_ADMIN_CODE=\(가림:이름\)/);
  assert.ok(!o.includes('hunter2'), '원값이 샜다');
  assert.match(o, /GODITOR_LICENSE_API=\(가림:URL인증\)/);
  assert.ok(!o.includes('u:pw'), 'URL 인증이 샜다');
  assert.match(o, /GODITOR_COLLAB_API=http:\/\/127\.0\.0\.1:3000/, '⛔전부 가리면 이 자의 목적이 죽는다');
});
test('E3 ★파생 · 자가 죽음 — 새 이름은 저절로 든다 · 명부 0 이면 rc 2 · 긴 값은 가린다', () => {
  const d = mkTmpRoot('env-head-');
  fs.mkdirSync(path.join(d, 'tests'));
  assert.equal(run([d]).status, 2, '★명부 0 은 자가 죽은 것이다');
  fs.writeFileSync(path.join(d, 'tests', 'x.spec.js'), 'process.env.ZZZ_NEW_ONE;\n');
  const r = run([d], { ZZZ_NEW_ONE: 'hello' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^env\(명부 1 · /);
  assert.match(r.stdout, /ZZZ_NEW_ONE=hello/);
  assert.match(run([d], { ZZZ_NEW_ONE: 'x'.repeat(40) }).stdout, /ZZZ_NEW_ONE=\(가림:값\)/);
  assert.match(run([d], { ZZZ_NEW_ONE: '/some/long/path/'.repeat(4) }).stdout, /ZZZ_NEW_ONE=\/some/, '경로는 길어도 보인다');
});
test('E4 ★--check — 새 머리 rc 0 · 옛 꼴 rc 3 · 못 읽음 rc 2', () => {
  const d = mkTmpRoot('env-head-');
  const log = (n, t) => { const p = path.join(d, n); fs.writeFileSync(p, t); return p; };
  assert.equal(run(['--check', log('new', 'x\n' + run([ROOT]).stdout)]).status, 0);
  assert.equal(run(['--check', log('old', 'env: GOYA_TEST_JUNIT=(없음) · GD1001_ROOT=(없음) · E81_GOLDEN=(없음) · DOM_WORKERS=(없음)\n')]).status, 3);
  assert.equal(run(['--check', path.join(d, '없음')]).status, 2);
});
