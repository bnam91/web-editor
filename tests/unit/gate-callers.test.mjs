/* gate-callers.test.mjs — ★266 GATE-FILES-IN-REPO-WITH-ZERO-CALLERS-01 · 레포 안 «*.gate.js» 마다 «부르는 자»가 레포 안 슬롯(tools/slots/*.sh)에 있다 (S3 · 261029 · 지디 23:0x)
 *   ★병(지디 23:0x 뒤집음): «자는 레포 안 · 부르는 자(레인 슬롯)는 버전관리 밖» ⇒ git grep 으로 «누가 부르나» 가 안 보였다.
 *   ★부르는 자 = 주석 밖 줄에 `node <그 게이트 경로>` 가 있는 tools/slots/*.sh(⛔이름만 든 줄 · 주석 · echo 는 안 친다).
 *   ⛔CI(.github/workflows)·package.json 에 있는 것은 «부르는 자» 로 세지 않는다 — 기록(last_over 등)을 커밋 못 하고 사람이 판정 안 한다(tools/slots 머리말).
 *   ⚠️자 한계: 게이트 = 파일 이름이 «.gate.js/.gate.mjs» 인 것만(이름 꼴 ⇒ ≥) · 슬롯이 실제로 «돌았나» 는 안 잰다(부름 줄이 있나만).
 *   한 쌍: G1 = 지금 레포에서 게이트마다 부르는 슬롯 ≥1 / G2 = 같은 자에 «부름 줄을 뺀» 슬롯 글자를 주면 0(빨강이 서는 자).
 *   ★⒞ 모집단을 «이름» 말고 «부름» 으로(261031 · ORDER-295 §3): tools/deploy-gate.js 는 이름에 .gate.js 가 없는데 release:mac·release:win 이 부른다.
 *   «세는 쪽» = *.sh(tools·scripts·tests) + .github/workflows + package.json scripts / «임자» = 그중 tools/slots/*.sh 뿐(⛔CI·package.json 은 세기만 · 위 머리말).
 *   ⚠️자 한계(부름 꼴 ⇒ ≥): 글자 그대로 `node <경로>` 만 — 변수 경로(node "$SK/x.js")·플래그 뒤(node --test x)·$(node x)·js 안 spawn·.cjs·.md 안내문은 못 본다.
 *   한 쌍: G3 = 부름이 가리키는 파일이 레포에 없는 것 0 / G4 = 양성 deploy-gate 걸림·음성 04-saveload-gate(이름에 gate · 부름 없음) 안 걸림 + «부름 줄을 뺀» 글자 ⇒ 빠짐. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const { toPosix } = createRequire(import.meta.url)('./_srcread.js');   // ★검사 키는 posix 한 자(win-portability ④-2 · 레포 규약)

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SLOTS = path.join(ROOT, 'tools', 'slots');

function walk(dir, out = [], name = /\.gate\.(js|mjs)$/) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, out, name); }
    else if (name.test(e.name)) out.push(toPosix(path.relative(ROOT, p)));
  }
  return out;
}
/** 주석(#)과 echo/printf 꼬리를 뗀 줄 — echo "node x.js" 는 안내문이지 부름이 아니다 */
const codeLines = (text) => text.split('\n').map((l) => l.replace(/(^|\s)#.*$/, '').replace(/(^\s*|[;&|]\s*)(echo|printf)\s.*$/, ''));
/** 슬롯 글자 하나에서 그 게이트를 «부르는» 줄 수 — 주석(#)을 뗀 줄에 `node <경로>` */
export function callsIn(text, gateRel) {
  const re = new RegExp(`(^|[\\s;&|(])node\\s+(\\./)?${gateRel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$|["'])`);
  return codeLines(text).filter((l) => re.test(l)).length;
}
/** 글자 하나가 `node <경로>` 로 부르는 js/mjs 들(callsIn 과 같은 꼴 · 이름을 미리 안 받는다) */
export function calleesIn(text) {
  return codeLines(text).flatMap((l) => [...l.matchAll(/(?:^|[\s;&|(])node\s+(?:\.\/)?([\w./-]+\.m?js)(?=\s|$|["'])/g)].map((m) => m[1]));
}
/** [출처, 글자] — «세는 쪽» 전부. package.json 은 scripts 값만(설명문 등은 부름이 아니다) */
function callSources() {
  const read = (rel) => [rel, fs.readFileSync(path.join(ROOT, rel), 'utf8')];
  const sh = ['tools', 'scripts', 'tests'].flatMap((d) => walk(path.join(ROOT, d), [], /\.sh$/));
  const wf = walk(path.join(ROOT, '.github', 'workflows'), [], /\.ya?ml$/);
  return [...[...sh, ...wf].map(read), ['package.json', Object.values(JSON.parse(read('package.json')[1]).scripts).join('\n')]];
}
/** 부름 경로 → 그것을 부르는 출처들 */
export function calleeMap(sources) {
  const m = new Map();
  for (const [src, text] of sources) for (const c of calleesIn(text)) m.set(c, (m.get(c) || new Set()).add(src));
  return m;
}
const isOwner = (src) => /^tools\/slots\/[^/]+\.sh$/.test(src);   // G1 의 «슬롯» 과 같은 자리 · CI·package.json 은 임자 아님
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

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
test('G3 ★⒞ 부름 모집단 — 부름이 가리키는 파일이 레포에 없는 것 0', () => {
  const m = calleeMap(callSources());
  const owned = [...m].filter(([, s]) => [...s].some(isOwner)).length;
  const dangling = [...m.keys()].filter((c) => !exists(c));
  console.log(`  [266⒞] 부름 모집단 ${m.size} · 슬롯 임자 ${owned} · 세기만 ${m.size - owned} · 이름 꼴(.gate.) 밖 ${[...m.keys()].filter((c) => !/\.gate\.(js|mjs)$/.test(c)).length} · 파일 없는 부름 ${dangling.length} (부름 꼴 ⇒ ≥)`);
  assert.deepEqual(dangling, [], `★부름 줄이 없는 파일을 가리킨다 · ${dangling.join(' | ')}`);
});
test('G4 ★자가 산다 — 양성 deploy-gate 걸림 · 음성 안 걸림 · 부름 줄을 빼면 빠짐', () => {
  const sources = callSources();
  const m = calleeMap(sources);
  /* ★양성: 이름에 .gate. 가 없는데 부름으로 걸린다 · package.json 과 CI 양쪽 · 그러나 임자는 0(세기만) */
  const dg = 'tools/deploy-gate.js';
  assert.ok(!walk(path.join(ROOT, 'tools')).includes(dg), '★전제: 이름 꼴 자에는 안 걸린다');
  assert.ok(m.get(dg)?.has('package.json'), 'deploy-gate 가 package.json 부름으로 안 걸렸다');
  assert.ok(m.get(dg)?.has('.github/workflows/release-mac.yml'), 'deploy-gate 가 CI 부름으로 안 걸렸다');
  assert.ok(![...m.get(dg)].some(isOwner), '★CI·package.json 을 임자로 셌다');
  console.log(`  [266⒞] 양성 ${dg} ← ${[...m.get(dg)].join(' · ')}`);
  /* ★음성: 레포에 있고 이름에 gate 가 들었는데 아무도 안 부른다(README 안내문은 세는 쪽이 아니다) */
  const none = 'tests/measure/frame-textcenter/04-saveload-gate.js';
  assert.ok(exists(none), '★전제: 음성 파일이 레포에 있다(없으면 안 걸리는 게 당연하다)');
  assert.equal(m.has(none), false, '아무도 안 부르는 js 를 부름으로 셌다');
  console.log(`  [266⒞] 음성 ${none} · 있음 ${exists(none)} · 걸림 ${m.has(none)}`);
  /* ★한 쌍 — 실제 글자에서 그 부름 줄을 «뺀» 글자 ⇒ 빠진다 / 없는 파일 부름을 먹이면 G3 이 빨개질 자리 */
  const cut = sources.map(([s, t]) => [s, t.split('\n').filter((l) => !l.includes(dg)).join('\n')]);
  assert.equal(calleeMap(cut).has(dg), false, '부름 줄을 뺐는데도 부른다고 셌다');
  assert.ok([...calleeMap([['x.sh', 'node tools/no-such-gate.js\n']]).keys()].some((c) => !exists(c)), '없는 파일 부름을 못 잡았다');
  /* ★꼴 — 주석·echo(node 가 든 안내문 포함)·다른 확장자·변수 경로는 부름이 아니다 · ./ 는 같은 파일 */
  assert.deepEqual(calleesIn(`# node ${dg}\necho "  node ${dg} a"\nnode ${dg}x\nnode "$D/a.js"\n`), []);
  assert.deepEqual(calleesIn(`a && node ./${dg} && b\n`), [dg]);
  assert.equal(callsIn(`echo "  node ${dg} a"\n`, dg), 0, 'node 든 echo 를 부름으로 셌다');
});
