/* fx-section-parts.test.mjs — js/effects-registry.js fxSectionParts / fxSectionHtml. (right-panel-unify U0b ①)
 *   실행: node --test tests/unit/fx-section-parts.test.mjs
 *
 * ★fxSectionHtml 은 fxSectionParts 위의 얇은 껍데기가 됐다 — 옛 호출부(asset · text-template · grid)의 산출은 «바이트 그대로»여야 한다.
 *   P1 ★바이트 불변 — 옛 fxSectionHtml(판 2852c9f44 의 몸통을 아래 OLD 에 박아 둠)과 새 것이 네 상태(효과 0 · 추가만 · 카드만 · 둘 다)에서 같다
 *   P2 조각 — { headTools, body, id } · id = `${P}-fx-section`(옛 절 id 유지) · 틀 판 호출꼴 sec('effects', body, { headTools, id })
 *   N1 ★양성대조 — 새 껍데기에 공백 하나를 넣은 판이면 P1 이 빨강
 * 소스를 vm 에 그대로 올린다(이 파일은 import 0 — 머리 주석 규약).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const { readSrc } = createRequire(import.meta.url)('./_srcread.js');
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = readSrc(ROOT, 'js/effects-registry.js');

/* ★옛 몸통(판 2852c9f44 · js/effects-registry.js:85-104) — ⛔고치지 마라: 「옛 호출부가 안 바뀌었다」의 증거다. */
const OLD = `function oldFxSectionHtml(el, prefix) {
  const P = prefix;
  const types = fxTypesFor(el);
  const present = types.filter(t => t.has(el));
  const missing = types.filter(t => !t.has(el) && typeof t.add === 'function');
  const add = missing.length ? \`
        <select class="prop-select" id="\${P}-fx-add" style="flex:0 1 104px;min-width:0;width:auto;"
                title="고른 효과가 추가된다" aria-label="효과 추가">
          <option value="">\${FX_ADD_HEAD_LABEL}</option>
          \${missing.map(t => \`<option value="\${t.key}">\${t.label}</option>\`).join('')}
        </select>\` : '';
  return \`
    <div class="prop-section" id="\${P}-fx-section">
      <div class="prop-section-title-row">
        <div class="prop-section-title">Effects</div>\${add}
      </div>\${present.length ? \`
      <div id="\${P}-fx-list">\${present.map(t => t.card(el, P)).join('')}
      </div>\` : ''}
    </div>\`;
}`;

function load(src = SRC) {
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(src.replace(/^export\s+/gm, '') + '\n;' + OLD + '\n;globalThis.__R = { registerFxType, fxSectionHtml, fxSectionParts, oldFxSectionHtml };', ctx);
  return ctx.__R;
}
/** 가짜 식구 둘 — on 이 참이면 «걸림»(카드), 아니면 «추가 목록». */
function register(R, onA, onB) {
  R.registerFxType({ key: 'a', label: '가', has: () => onA, add() {}, card: (el, P) => `<div class="fx-card" data-p="${P}">A</div>`, wire() {} });
  R.registerFxType({ key: 'b', label: '나', has: () => onB, add() {}, card: () => '<div class="fx-card">B</div>', wire() {} });
}
const STATES = [['효과 0(식구 없음)', null], ['추가만', [false, false]], ['카드만', [true, true]], ['둘 다', [true, false]]];

function sameAsOld(R) {
  const out = [];
  for (const [name, st] of STATES) {
    if (st) register(R, ...st);
    out.push([name, R.fxSectionHtml({}, 'txt') === R.oldFxSectionHtml({}, 'txt')]);
  }
  return out;
}

test('P1 ★바이트 불변 — 네 상태에서 새 fxSectionHtml == 옛 몸통', () => {
  const r = sameAsOld(load());
  assert.deepEqual(r, STATES.map(([n]) => [n, true]));
});

test('P2 조각 — headTools · body · id', () => {
  const R = load();
  const empty = R.fxSectionParts({}, 'asset');
  assert.deepEqual({ ...empty }, { headTools: '', body: '', id: 'asset-fx-section' });
  register(R, true, false);
  const p = R.fxSectionParts({}, 'asset');
  assert.match(p.headTools, /<select class="prop-select" id="asset-fx-add"/);
  assert.match(p.headTools, /<option value="b">나<\/option>/);
  assert.doesNotMatch(p.headTools, /value="a"/, '★걸린 식구가 추가 목록에도 떴다');
  assert.match(p.body, /^\s*<div id="asset-fx-list"><div class="fx-card" data-p="asset">A<\/div>\s*<\/div>$/);
  assert.equal(p.id, 'asset-fx-section');
});

test('N1 ★양성대조 — 껍데기에 공백 하나 넣으면 P1 이 빨강', () => {
  const ANCHOR = '<div class="prop-section-title">Effects</div>${headTools}';
  assert.ok(SRC.includes(ANCHOR), '★변이 닻을 못 찾았다 — 이 대조는 «안 재고» 있다');
  const r = sameAsOld(load(SRC.replace(ANCHOR, ANCHOR.replace('Effects</div>', 'Effects </div>'))));
  assert.ok(r.some(([, same]) => !same), '★바뀐 판인데도 같다 — P1 이 바이트를 안 잰다');
});
