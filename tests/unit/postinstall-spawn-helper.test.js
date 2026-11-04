/* postinstall-spawn-helper — 새 npm ci 개발판에서 내부 터미널이 pty 를 못 쓴다 (시트 FRESH-NPM-CI-NODE-PTY-SPAWN-HELPER-NO-EXEC-01)
 * 왜: node-pty 1.1.0 묶음의 prebuilds/darwin-* /spawn-helper 는 644 라 posix_spawnp 가 실패하고, 터미널이 파이프로 내려앉았다(앱 3/3).
 * 변이: package.json postinstall 을 빼면 P0·P1 이 빨강. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { mkTmpRoot } = require('./_tmproot.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8'));
const script = pkg.scripts.postinstall;
// 윈도우의 chmod 는 읽기 전용 비트만 다룬다 — 스크립트는 그대로 돌고 값만 666 이다.
const want = process.platform === 'win32' ? '666' : '755';

test('P0 postinstall 이 있다', () => assert.ok(script, 'package.json scripts.postinstall 없음'));

test('P1 두 아키텍처 spawn-helper 가 644 에서 755 가 된다', () => {
  const root = mkTmpRoot('gdpty-');
  const files = ['arm64', 'x64'].map((a) => path.join(root, `node_modules/node-pty/prebuilds/darwin-${a}/spawn-helper`));
  for (const f of files) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, ''); fs.chmodSync(f, 0o644); }
  execSync(script, { cwd: root, stdio: 'pipe' });
  assert.deepStrictEqual(files.map((f) => (fs.statSync(f).mode & 0o777).toString(8)), [want, want]);
});

test('P2 음성: 파일이 없어도(윈도우·다른 묶음) 설치를 깨지 않는다', () => {
  assert.doesNotThrow(() => execSync(script, { cwd: mkTmpRoot('gdpty-'), stdio: 'pipe' }));
});
