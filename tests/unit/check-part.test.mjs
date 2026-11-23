// check 부품(현빈 261123 «온/오프 = 고디터 커스텀 체크박스» · 태양 PLAN §2c) — checkHTML 계약 · wireCheck(Mixed · 막힘)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const src = readFileSync(new URL('../../js/props/_helpers.js', import.meta.url), 'utf8');
const fn = (name) => { const i = src.indexOf(`export function ${name}(`); assert.ok(i >= 0, name + ' 없음'); const j = src.indexOf('\n}\n', i); return src.slice(i, j + 3).replace(/^export /, ''); };
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fn('escHtml') + fn('checkHTML') + fn('wireCheck') + ';globalThis.__c = { checkHTML, wireCheck };', ctx);
const { checkHTML, wireCheck } = ctx.__c;

test('C1 마크업 = label.ui-check[data-part=check] > input.ui-check-box + span.ui-check-label', () => {
  const h = checkHTML({ id: 'x', label: 'Clip content', checked: true });
  assert.match(h, /^<label class="ui-check" data-part="check"><input type="checkbox" class="ui-check-box" id="x" checked><span class="ui-check-label">Clip content<\/span><\/label>$/);
  assert.doesNotMatch(checkHTML({ id: 'y', label: 'a', checked: false }), /checked/);
});
test('C2 이름 — 글 없으면 aria-label/labelledby · 막힘 = aria-disabled + title(disabled 안 씀) · Mixed = data-mixed', () => {
  assert.match(checkHTML({ ariaLabel: '보이기' }), /aria-label="보이기"/);
  assert.match(checkHTML({ labelledby: 'row-l' }), /aria-labelledby="row-l"/);
  const b = checkHTML({ label: 'a', blockedWhy: '꼭짓점이 없어요' });
  assert.match(b, /aria-disabled="true"/); assert.match(b, /title="꼭짓점이 없어요"/); assert.doesNotMatch(b, /\sdisabled[\s>]/);
  assert.match(checkHTML({ label: 'a', checked: null }), /data-mixed="1"/);
  assert.match(checkHTML({ label: '<b>' }), /&lt;b&gt;/, '글은 이스케이프');
});
test('C3 wireCheck — Mixed 면 indeterminate · 막힘이면 click 막음 · onChange 는 바뀔 때만(Mixed 표식 걷음)', () => {
  const L = {}; const el = { dataset: { mixed: '1' }, indeterminate: false, checked: false, attrs: { 'aria-disabled': 'true' },
    getAttribute(k) { return this.attrs[k] ?? null; }, addEventListener(t, f) { (L[t] = L[t] || []).push(f); } };
  let got = null; wireCheck(el, { onChange: (v) => { got = v; } });
  assert.equal(el.indeterminate, true);
  let prevented = false; L.click.forEach((f) => f({ preventDefault() { prevented = true; } })); assert.equal(prevented, true, '막힘 click 이 안 막힘');
  el.attrs['aria-disabled'] = null; prevented = false; L.click.forEach((f) => f({ preventDefault() { prevented = true; } })); assert.equal(prevented, false, '안 막힌 click 을 막음');
  el.checked = true; L.change.forEach((f) => f()); assert.equal(got, true); assert.equal(el.dataset.mixed, undefined);
});
