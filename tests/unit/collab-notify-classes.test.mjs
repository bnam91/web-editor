/* collab-notify-classes — sync.js 가 내는 사건 «종류»마다 notify.js 에 분류 칸이 있는가.
 *
 * ★왜 있나 (2026-10-06, 지디 발주 TWO ⑴㉠)
 *   듣는 문이 하나(js/collab/notify.js)여야 새 emit 이 생겨도 안 샌다. 그런데 문이 하나여도
 *   «분류 표»에 칸이 없으면 그 사건은 조용히 버려진다 ⇒ 두 명부(sync.js 의 emit · notify.js 의 CLASS)를
 *   «같은 집합»으로 묶는다. emit 을 더하고 칸을 안 만들면 N1 이 빨강, 죽은 칸을 남기면 N2 가 빨강.
 * ★emit 종류는 «정의 자리»(sync.js 의 emit({ type: '…' }) 문자열)에서 센다. CLASS 는 notify.js 를 «실행»해 읽는다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../');
const SYNC = readSrc(REPO, 'js/collab/sync.js');
const NOTIFY = readSrc(REPO, 'js/collab/notify.js');

function emitted() {
  const set = new Set();
  for (const m of SYNC.matchAll(/\bemit\(\{\s*type:\s*'([a-z_]+)'/g)) set.add(m[1]);
  return set;
}
function classes() {
  const ctx = { console }; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(NOTIFY, ctx);
  assert.ok(ctx.collabNotify && ctx.collabNotify.CLASS, '★전제: notify.js 를 실제로 실었다');
  return ctx.collabNotify.CLASS;
}

test('N0 — 전제: sync.js 에서 emit 종류를 «하나 이상» 읽었다(0건 초록 방지)', () => {
  assert.ok(emitted().size >= 10, `emit 종류가 너무 적다(${emitted().size}) — 정규식이 소스를 못 읽는다`);
});

test('N1 — sync.js 가 내는 모든 사건 종류에 분류 칸이 있다', () => {
  const C = classes();
  const missing = [...emitted()].filter(t => !Object.prototype.hasOwnProperty.call(C, t));
  assert.deepEqual(missing, [], `분류 없는 사건: ${missing.join(',')} — js/collab/notify.js CLASS 에 칸을 만들어라`);
});

test('N2 — 분류 표에 «아무도 안 내는» 죽은 칸이 없다', () => {
  const E = emitted();
  const dead = Object.keys(classes()).filter(t => !E.has(t));
  assert.deepEqual(dead, [], `죽은 칸: ${dead.join(',')}`);
});

test('N3 — 분류 값은 정해진 셋 중 하나(speak · status · source)', () => {
  const bad = Object.entries(classes()).filter(([, v]) => !['speak', 'status', 'source'].includes(v));
  assert.deepEqual(bad, []);
});
