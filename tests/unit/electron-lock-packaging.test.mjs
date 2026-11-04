/* Electron 판 올리기가 배포 길을 깨지 않게 lock 만 읽어 잠근다(node_modules 무접촉 — 공유 심링크 레인에서도 같은 값).
 * 왜: 801d80c4 lock 은 npm 11 ci 가 EUSAGE(windows-sign 등 7개 빠짐) · node-abi 4.28 은 electron-builder 가 «Could not detect abi for version 43.8.6» 로 멈췄다. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../../', import.meta.url);
const read = (f) => JSON.parse(fs.readFileSync(new URL(f, root), 'utf8'));
const { packages } = read('package-lock.json');
const nums = (v) => v.split('.').map(Number);

function resolves(from, name) {
  for (let at = from; ; at = at.slice(0, at.lastIndexOf('/node_modules/'))) {
    if (packages[`${at ? at + '/' : ''}node_modules/${name}`]) return true;
    if (!at.includes('/node_modules/')) return !!packages[`node_modules/${name}`];
  }
}

test('lock 의 모든 dependencies·optionalDependencies 가 lock 안에서 풀린다(npm ci 조건)', () => {
  const missing = [];
  for (const [p, v] of Object.entries(packages)) {
    for (const name of Object.keys({ ...v.dependencies, ...v.optionalDependencies })) {
      if (!resolves(p, name)) missing.push(`${p || '(root)'} → ${name}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('package.json 의 electron 고정 판 = lock 판', () => {
  assert.equal(read('package.json').devDependencies.electron, packages['node_modules/electron'].version);
});

test('node-abi 가 Electron 43 을 아는 판이다(실측 4.28 모름 · 4.40 앎)', () => {
  const [ma, mi] = nums(packages['node_modules/node-abi'].version);
  assert.ok(ma > 4 || (ma === 4 && mi >= 40), packages['node_modules/node-abi'].version);
});
