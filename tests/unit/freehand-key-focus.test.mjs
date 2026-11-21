/* freehand-key-focus.test.mjs — t13A-02 채점 261120 «⇧B 눌러도 '연필 N' 그대로»
 *   뿌리: 보정 손잡이(#fh-bar input[type=range])를 만지면 포커스가 거기 남고, js/editor.js N·⇧B 분기의 «입력칸 거름»(INPUT)에 막혀 키가 안 먹었다.
 *   K1 editor.js N·⇧B 분기를 잘라 실행 — 포커스가 #fh-bar 안 range/select 여도 toggleFreehand('brush'|'pencil') · 글자 칸(INPUT text)은 여전히 거름
 *   K2 freehand-tool.js _onKey — #fh-bar 안 포커스에서도 Esc = 끝 · 글자 칸은 거름
 * 양성대조: _patches/freehand-CTL-key-focus.patch(두 거름에서 #fh-bar 예외 되돌림) → K1·K2 빨강
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const { sliceBlock } = require('./_slice-block.js');

const ROOT = path.join(import.meta.dirname, '..', '..');
const el = (tagName, inBar) => ({ tagName, isContentEditable: false, closest: (s) => (s === '#fh-bar' && inBar ? {} : null) });
const key = (code, shiftKey, key = '') => ({ code, key, shiftKey, metaKey: false, ctrlKey: false, altKey: false, preventDefault() {}, stopPropagation() {} });

test('K1 N·⇧B — 막대 손잡이 포커스에서도 도구 바꿈 · 글자 칸은 거름', () => {
  const branch = sliceBlock(readSrc(ROOT, 'js', 'editor.js'), "if (((e.code === 'KeyN' && !e.shiftKey) || (e.code === 'KeyB' && e.shiftKey))", 'N·⇧B 분기');
  const run = (e, ae) => { const calls = []; new Function('e', 'document', 'window', branch)(e, { activeElement: ae }, { toggleFreehand: (t) => calls.push(t) }); return calls; };
  assert.deepEqual(run(key('KeyB', true), el('INPUT', true)), ['brush'], '★보정 손잡이(range) 포커스 + ⇧B = 붓');
  assert.deepEqual(run(key('KeyN', false), el('SELECT', true)), ['pencil'], '★붓 고르기 포커스 + N = 연필');
  assert.deepEqual(run(key('KeyB', true), el('BODY', false)), ['brush'], '[전제] 포커스 없음 = 붓');
  assert.deepEqual(run(key('KeyB', true), el('INPUT', false)), [], '★막대 밖 글자 칸 = 거름(글자 입력 보존)');
});

test('K2 Esc — 막대 손잡이 포커스에서도 끝 · 글자 칸은 거름', () => {
  const fn = sliceBlock(readSrc(ROOT, 'js', 'freehand-tool.js'), 'function _onKey(', '_onKey');
  const run = (ae) => { let n = 0; const g = { document: { activeElement: ae }, exitFreehand: () => n++ }; new Function('document', 'exitFreehand', `${fn}; _onKey(arguments[2]);`)(g.document, g.exitFreehand, key('', false, 'Escape')); return n; };
  assert.equal(run(el('INPUT', true)), 1, '★보정 손잡이 포커스 + Esc = 끝');
  assert.equal(run(el('INPUT', false)), 0, '★막대 밖 글자 칸 = 거름');
});
