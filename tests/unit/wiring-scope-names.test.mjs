/* wiring-scope-names.test.mjs — ★198 소스에서 떠 온 배선이 읽는 바깥 이름을 spec 이 다 넘기나 (imac-gd-L3 · J196E)
 *   ★병: 제품 함수가 이름을 하나 늘리면 손 하네스의 scope 가 조용히 뒤처진다. 그 갈래가 안 지나면 초록인 채 잠복한다(a78196de GRID_NESTED_GAP).
 *   ★자 = tests/unit/_wiring-scope-scan.cjs. 자식 node --expose-internals 로 부른다(내장 acorn · 그 파일 머리말).
 *   W1 지금 레포 빠짐 0 · ⛔«못 잼» 은 0 이 아니라 안 잰 것 ⇒ 수를 따로 찍는다(래칫은 안 건다 — 지디 198 판정 ⑶→⑴→⑵)
 *   W2 양성: grid-nested-create 에서 GRID_NESTED_GAP 을 빼면 잡는다 / W3 음성: 뺀 게 없으면 안 잡는다 · W4 못 정하면 못 잼으로 낸다 · W5 자가 스코프 안 이름을 바깥으로 안 센다 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { mkTmpRoot } = createRequire(import.meta.url)('./_tmproot.js');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCAN = path.join(ROOT, 'tests', 'unit', '_wiring-scope-scan.cjs');

/** 인자 파일들을 자식에서 잰다 */
function scanFiles(files) {
  const r = spawnSync(process.execPath, ['--expose-internals', SCAN, ...files], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
  assert.equal(r.status, 0, `자가 못 돌았다 — 못 잰다\n${r.stderr}`);
  return JSON.parse(r.stdout);
}
const domSpecs = () => fs.readdirSync(path.join(ROOT, 'tests', 'dom')).filter((f) => f.endsWith('.spec.js'))
  .map((f) => `tests/dom/${f}`).filter((f) => fs.readFileSync(path.join(ROOT, f), 'utf8').includes('new Function('));

test('W1 ★new Function 으로 띄운 배선이 읽는 바깥 이름을 spec 이 다 넘긴다', () => {
  const res = scanFiles(domSpecs());
  const rows = Object.entries(res).flatMap(([f, rs]) => rs.map((r) => ({ f, ...r })));
  const bad = rows.filter((r) => r.missing?.length || r.maybe?.length);
  const un = rows.filter((r) => r.unmeasured);
  console.log(`  [198] spec ${Object.keys(res).length} · 자리 ${rows.length} · 잰 자리 ${rows.length - un.length} · 빠짐 ${bad.length} · ⚠️못 잼 ${un.length}(0 아님 · 안 잰 것)`);
  assert.ok(rows.length - un.length > 0, '잰 자리가 0 이다 — 자가 죽었다');
  assert.deepEqual(bad.map((r) => `${r.f}:${r.line} ${[...(r.missing || []), ...(r.maybe || [])].join(',')}`), [],
    '배선이 읽는데 scope 에 없는 이름이다 — 그 갈래를 지나면 ReferenceError 다. spec 의 scope 에 더해라');
});

const SPEC = 'tests/dom/grid-nested-create.dom.spec.js';
/** 글자를 임시 파일에 두고 그 spec 자리에서 잰다 — 임시는 공용 자가 치운다(tmproot-sole-owner) */
function scanText(text, spec = SPEC) {
  const t = path.join(mkTmpRoot('wiring-scope-'), 's.txt');
  fs.writeFileSync(t, text);
  return scanFiles([`${spec}=${t}`])[spec];
}
test('W2 ★양성 — grid-nested-create 에서 GRID_NESTED_GAP 을 빼면 잡는다 / 음성 — 안 빼면 안 잡는다', () => {
  const src = fs.readFileSync(path.join(ROOT, SPEC), 'utf8');
  const line = '    GRID_NESTED_GAP: window.__NESTED_GAP,\n';
  assert.ok(src.includes(line), '★전제: 뺄 줄이 그대로다');
  const cut = scanText(src.replace(line, ''));
  assert.ok(cut.some((r) => r.missing?.includes('GRID_NESTED_GAP')), `못 잡았다 ${JSON.stringify(cut)}`);
  const ok = scanText(src);
  assert.ok(ok.some((r) => r.missing) && !ok.some((r) => r.missing?.includes('GRID_NESTED_GAP')), `★음성: 안 뺐는데 잡았거나 못 쟀다 ${JSON.stringify(ok)}`);
});

test('W3 음성 — 넘긴 이름 · 지역 선언 · typeof · 속성 이름은 바깥으로 안 센다', () => {
  const rows = scanText("const S = 'function f(a){ const b = a; try { g(b); } catch (e) { e.x; } return typeof zz === \"x\" ? ({ qq: 1 }).qq : b.rr; }';\nnew Function('g', S);\n");
  assert.deepEqual(rows[0].missing, []);
  assert.deepEqual(rows[0].maybe, []);
});
test('W4 ★못 정하면 못 잼 — 0 으로 접지 않는다', () => {
  const rows = scanText("function h(p) { return new Function(p); }\n");
  assert.ok(rows[0].unmeasured, JSON.stringify(rows));
  assert.equal(rows[0].missing, undefined);
});
test('W6 ★양성 — 함수 인자로 받은 글자는 부르는 자리를 따라가 갈래마다 잰다', () => {
  const rows = scanText("function h(p) { return new Function(p); }\nh('return nopeA;');\nh('return nopeB;');\n");
  assert.deepEqual(rows[0].missing, ['nopeA', 'nopeB']);
  assert.equal(rows[0].branches, 2);
});
test('W7 ★갈래 하나라도 못 풀면 그 자리 전체가 못 잼이다', () => {
  const rows = scanText("function h(p) { return new Function(p); }\nh('return nopeA;');\nh(unknownFn());\n");
  assert.ok(rows[0].unmeasured, JSON.stringify(rows));
  assert.equal(rows[0].missing, undefined);
});
test('W8 양성·음성 — for…of 원소의 칸 · 따옴표 안 자리는 값을 몰라도 잰다 · 따옴표 밖이면 못 잼', () => {
  const a = scanText("const L = [{ m: 'return nopeC;' }, { x: 1 }];\nfor (const f of L) new Function(f.m);\n");
  assert.deepEqual(a[0].missing, ['nopeC']);
  const q = scanText("function h(id) { return new Function(`return g('${id}');`); }\nh(ask());\n");
  assert.deepEqual(q[0].missing, ['g']);
  const o = scanText("function h(id) { return new Function(`return ${id};`); }\nh(ask());\n");
  assert.ok(o[0].unmeasured, JSON.stringify(o));
});
test('W5 ★양성 — 없는 이름은 함수 안쪽 갈래에 있어도 센다', () => {
  const rows = scanText("const S = 'function f(a){ if (a) { return nope.x; } return 1; }';\nnew Function('z', S);\n");
  assert.deepEqual(rows[0].missing, ['nope']);
});
