/* golden-guard-224.test.mjs — ★224 GOLDEN-GUARD-READS-ATTR-CHANGE-AS-DELETE-01 · tests/dom/_golden-guard.js «id 로 맞춘 뒤 속성 차집합» (S3 · 261028)
 *   쌍(지디 09:0x): ⑴ id 를 뺀 것(BT2_T6_MUT=del 꼴 · id 없는 prop-row 를 뺌)은 «여전히» 거절 ⑵ «같은 id · 속성만 바뀜» 은 통과(«바뀐 id» 로 남김).
 *   실데이터 1 회(보고서): 레포 골든 → 7f3c6de2 패널 = 지움 0 · 바뀜 16(전부 min:0→-50 · 421798a8) / 새 골든 → MUT=del 지움 1 · MUT=add 지움 0.
 *   ⛔DOM 안 돌림 · 파일 쓰기 0.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { _guardNoDeletes, _pairChanged } = createRequire(import.meta.url)('../dom/_golden-guard.js');

const ROW = (id, min) => `<div class="prop-row"><input type="number" class="prop-number" id="${id}" min="${min}" max="200" value="24"></div>`;
const PANEL = (...rows) => ({ block: `<div class="panel">${rows.join('')}<div class="prop-row"><span>끝</span></div></div>` });

test('K1 ★«같은 id · 속성만 바뀜» = 통과 · 바뀐 id 로 남는다', () => {
  const r = _guardNoDeletes('t', PANEL(ROW('a', 0), ROW('b', 0)), PANEL(ROW('a', -50), ROW('b', 0)));
  assert.deepEqual(r.dels, [], '속성 바뀜을 지움으로 읽었다(224 의 병)');
  assert.deepEqual(r.changedIds, ['id="a"']);
  assert.deepEqual(r.addedIds, []);
});

test('K2 ★id 가 사라지면 여전히 거절', () => {
  const r = _guardNoDeletes('t', PANEL(ROW('a', 0), ROW('b', 0)), PANEL(ROW('a', 0)));
  assert.ok(r.dels.length > 0, 'id 를 뺐는데 통과했다');
  assert.deepEqual(r.changedIds, []);
});

test('K3 ★id 없는 줄을 빼면(BT2_T6_MUT=del 꼴) 여전히 거절', () => {
  const old = PANEL(ROW('a', 0));
  const got = { block: old.block.replace(/<div class="prop-row"><span>끝<\/span><\/div>/, '') };
  assert.notEqual(got.block, old.block, '전제: 변이가 꽂혔다');
  assert.ok(_guardNoDeletes('t', old, got).dels.length > 0, 'id 없는 줄을 뺐는데 통과했다');
});

test('K4 같은 id 라도 태그가 바뀌면 «바뀜» 이 아니라 지움', () => {
  const p = _pairChanged(['<input id="a" min="0">'], ['<select id="a">']);
  assert.deepEqual([p.del.length, p.changed.length], [1, 0]);
});

test('K5 공백만 바뀌면 아무 일 없음 · 더함은 더한 id 로', () => {
  const old = PANEL(ROW('a', 0));
  assert.deepEqual(_guardNoDeletes('t', old, { block: old.block.replace('><input', '>\n   <input') }).report, []);
  const r = _guardNoDeletes('t', old, { block: old.block + '<div class="prop-row" id="zz-t6-added"></div>' });
  assert.deepEqual([r.dels.length, r.addedIds], [0, ['id="zz-t6-added"']]);
});

test('K6 같은 id 가 둘이면 하나씩만 짝짓는다(남은 것은 지움)', () => {
  const p = _pairChanged(['<input id="a" min="0">', '<input id="a" min="1">'], ['<input id="a" min="-50">']);
  assert.deepEqual([p.changed.length, p.del.length, p.add.length], [1, 1, 0]);
});
