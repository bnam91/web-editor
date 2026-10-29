/* gate-callers.test.mjs — ★266 GATE-FILES-IN-REPO-WITH-ZERO-CALLERS-01 · 레포 안 «*.gate.js» 마다 «부르는 자»가 레포 안 슬롯(tools/slots/*.sh)에 있다 (S3 · 261029 · 지디 23:0x)
 *   ★병(지디 23:0x 뒤집음): «자는 레포 안 · 부르는 자(레인 슬롯)는 버전관리 밖» ⇒ git grep 으로 «누가 부르나» 가 안 보였다.
 *   ★부르는 자 = 주석 밖 줄에 `node <그 게이트 경로>` 가 있는 tools/slots/*.sh(⛔이름만 든 줄 · 주석 · echo 는 안 친다).
 *   ⛔CI(.github/workflows)·package.json 에 있는 것은 «부르는 자» 로 세지 않는다 — 기록(last_over 등)을 커밋 못 하고 사람이 판정 안 한다(tools/slots 머리말).
 *   ⚠️자 한계: 게이트 = 파일 이름이 «.gate.js/.gate.mjs» 인 것만(이름 꼴 ⇒ ≥) · 슬롯이 실제로 «돌았나» 는 안 잰다(부름 줄이 있나만).
 *   한 쌍: G1 = 지금 레포에서 게이트마다 부르는 슬롯 ≥1 / G2 = 같은 자에 «부름 줄을 뺀» 슬롯 글자를 주면 0(빨강이 서는 자). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SLOTS = path.join(ROOT, 'tools', 'slots');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, out); }
    else if (/\.gate\.(js|mjs)$/.test(e.name)) out.push(path.relative(ROOT, p).split(path.sep).join('/'));
  }
  return out;
}
/** 슬롯 글자 하나에서 그 게이트를 «부르는» 줄 수 — 주석(#)을 뗀 줄에 `node <경로>` */
export function callsIn(text, gateRel) {
  const re = new RegExp(`(^|[\\s;&|(])node\\s+(\\./)?${gateRel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$|["'])`);
  return text.split('\n').map((l) => l.replace(/(^|\s)#.*$/, '')).filter((l) => re.test(l)).length;
}

test('G0 전제 — 게이트 ≥1 · 슬롯 폴더 있음(이게 빨강이면 아래는 「안 쟀다」)', () => {
  assert.ok(walk(path.join(ROOT, 'tests')).length >= 1, 'tests/ 아래 *.gate.js 0 — 자가 아무것도 못 본다');
  assert.ok(fs.existsSync(SLOTS), 'tools/slots 가 없다');
});
test('G1 ★게이트마다 레포 안 슬롯이 부른다(부르는 자 0 인 게이트 0)', () => {
  const gates = walk(path.join(ROOT, 'tests'));
  const slots = fs.readdirSync(SLOTS).filter((f) => f.endsWith('.sh')).map((f) => [f, fs.readFileSync(path.join(SLOTS, f), 'utf8')]);
  const orphan = gates.filter((g) => slots.every(([, t]) => callsIn(t, g) === 0));
  console.log(`  [266] 게이트 ${gates.length} · 슬롯 ${slots.length} · 부르는 자 없는 게이트 ${orphan.length} (이름 꼴 ⇒ ≥)`);
  assert.deepEqual(orphan, [], `★부르는 자 없는 게이트 — tools/slots/ 에 부르는 슬롯을 두라(⛔CI 한 줄로 갈음 금지 · 머리말) · ${orphan.join(' | ')}`);
});
test('G2 ★자가 산다 — 부름 줄이 있으면 1 · 주석/이름만/echo 면 0', () => {
  const g = 'tests/unit-time.gate.js';
  assert.equal(callsIn(`x=1\nnode ${g} "$OUT/u1.xml" --record\n`, g), 1);
  assert.equal(callsIn(`x=1\n# node ${g} "$OUT/u1.xml"\n`, g), 0, '주석 줄을 부름으로 셌다');
  assert.equal(callsIn(`echo "이 슬롯은 ${g} 를 부른다"\n`, g), 0, '이름만 든 줄을 부름으로 셌다');
  assert.equal(callsIn(`node tests/unit-time.gate.jsx a\n`, g), 0, '다른 파일을 부름으로 셌다');
  /* ★한 쌍 — 실제 슬롯에서 그 부름 줄을 «뺀» 글자 ⇒ 0(G1 이 빨개질 자리) */
  const real = fs.readFileSync(path.join(SLOTS, 'unit-time-slot.sh'), 'utf8');
  assert.ok(callsIn(real, g) >= 1, '★전제: 실제 슬롯이 그 게이트를 부른다');
  const cut = real.split('\n').filter((l) => !/^\s*node\s+tests\/unit-time\.gate\.js/.test(l)).join('\n');
  assert.equal(callsIn(cut, g), 0, '부름 줄을 뺐는데도 부른다고 셌다');
});
