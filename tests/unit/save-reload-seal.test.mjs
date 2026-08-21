/* 단위 하네스 — js/io/save-reload-seal.js (F4 되돌리기 봉인 코어)
 * ★리허설의 «손으로 쓴 seal 모델»이 아니라 «실제 소스 파일»을 import 한다.
 *   렌더러 파일은 ESM .js(package type=commonjs라 Node가 직접 import 못함) → 바이트 그대로 .mjs 별칭으로
 *   복사해 import(내용 동일). 구멍1(드레인 타임아웃 반환)·구멍2(대상만 제거)의 회귀를 방지한다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcPath = path.join(__dirname, '../../js/io/save-reload-seal.js');
const aliasPath = path.join(os.tmpdir(), `seal-alias-${process.pid}.mjs`);
fs.copyFileSync(srcPath, aliasPath);
const { clearPendingForReload, isDrainSettled } = await import(pathToFileURL(aliasPath).href);
fs.unlinkSync(aliasPath);

test('구멍2: clearPendingForReload는 되돌리기 대상만 지우고 타 프로젝트 큐는 보존', () => {
  const map = new Map([['projA', { s: 1 }], ['projB', { s: 2 }], ['projC', { s: 3 }]]);
  clearPendingForReload(map, 'projB');
  assert.deepEqual([...map.keys()].sort(), ['projA', 'projC']); // B만 삭제
  assert.ok(map.has('projA') && map.has('projC'));
});

test('구멍2 폴백: targetId 없으면(방어) 전체 clear', () => {
  const map = new Map([['a', 1], ['b', 2]]);
  clearPendingForReload(map, undefined);
  assert.equal(map.size, 0);
  const map2 = new Map([['a', 1]]);
  clearPendingForReload(map2, null);
  assert.equal(map2.size, 0);
});

test('구멍2 방어: 비-Map 인자에도 예외 없음', () => {
  assert.doesNotThrow(() => clearPendingForReload(null, 'x'));
  assert.doesNotThrow(() => clearPendingForReload({}, 'x'));
  assert.doesNotThrow(() => clearPendingForReload(undefined, undefined));
});

test('구멍1: isDrainSettled — 저장 중이면 false(되돌리기 중단 신호), 정지면 true', () => {
  assert.equal(isDrainSettled(true), false);   // in-flight 살아있음 → 되돌리기 내보내면 안 됨
  assert.equal(isDrainSettled(false), true);   // 완전 정지 → 안전
});

test('통합: save-load 봉인 시퀀스 동일 조합(대상만 제거 2회 + 드레인 판정)', () => {
  // in-flight A 진행 중 + 큐에 A(coalesce)·B. 봉인은 A만 제거, 저장 살아있으면 false 반환.
  const pending = new Map([['A', { v: 'A2' }], ['B', { v: 'B1' }]]);
  let saving = true;
  clearPendingForReload(pending, 'A');          // 봉인 1차
  clearPendingForReload(pending, 'A');          // 드레인 후 2차(재적재 대비)
  assert.ok(!pending.has('A'), 'A(되돌리기 대상) 큐 제거');
  assert.ok(pending.has('B'), '★B(타 프로젝트) 큐 보존 — 구멍2 회귀방지');
  assert.equal(isDrainSettled(saving), false, '저장 살아있으면 되돌리기 중단(구멍1)');
  saving = false;
  assert.equal(isDrainSettled(saving), true, '드레인 완료면 되돌리기 진행');
});
