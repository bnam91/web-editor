/* anchor-signature-ratchet.test.mjs — ★«서명을 닻으로 쓰는 검사»를 ★늘지 않게 막는 래칫
 *
 * ★★왜 있나 — ★2026-10-07 ★실제로 났다:
 *   `tests/unit/variant-ship-leak.test.mjs` 가 `const statRow = (key, label, list) =>` 를
 *   ★닻으로 ★덩이를 떴다. ★내가 `statRow` 에 ★매개변수 ★하나를 더하자 ★그 닻이 ★못 찾히고
 *   ★그 검사의 `stat` 판정이 ★false 로 떨어졌다 ⇒ ★★「개수 = 갈 곳」을 재던 자가 ★★조용히 ★눈이 멀었다.
 *   ⚠️그때 ★내 unit·DOM 은 ★★전부 초록이었다 — ★영향 묶음을 돌려서야 잡혔다.
 * ⇒ ★★그 꼴은 ★★«빨개지지 않는다». ★★«조용히 초록»이 된다 ⇒ ★머지 게이트의 ★사각이다.
 *
 * ★★처방은 ★래칫이다(지디 판정 2026-10-07 · ⛔㉠「52건 한꺼번에 빨강」이 아니다):
 *   ★까닭 — 닻 52개를 ★다 느슨하게 고치면 ★그 52개가 ★각각 「★느슨해져서 ★아무것도 안 잠그나」를
 *   ★다시 재야 한다(★내 ★하나를 느슨하게 할 때 ★변이 주입 ★한 번이 들었다 ⇒ ★×52).
 *   ⇒ ★먼저 ★«늘지 않게» 막는다. ★기존 52 를 ★고치는 일은 ★그 뒤다.
 *
 * ★★⛔이 자가 ★«못 보는 꼴» — ★적어 둬야 ★다음 사람이 ★안 속는다:
 *   ⑴ ★★닻을 ★«변수»로 넘기는 호출 ★37건 — ★이 자로 ★★못 가른다
 *      (`sliceBlock(src, ANCHOR)` 꼴. ★그 변수가 ★어디서 왔는지 ★따라가야 한다)
 *   ⑵ ★자르개 ★이름을 ★여섯만 안다(CUTTERS) — ★새 이름의 자르개가 생기면 ★안 센다
 *   ⑶ ★주석 거르개가 ★한 파일에서 ★빈 출력을 낸다(실측 ★1건) ⇒ ★그 파일은 ★원본으로 센다
 *      ⇒ ★그 파일에선 ★주석 속 예시가 ★세어질 수 있다
 *   ⑷ ★여러 줄에 걸친 닻·백틱 닻·"큰따옴표" 닻은 ★안 센다
 *   ⇒ ★★그래서 ★기준값은 ★★«하한»이다. ★늘면 ★빨강이고, ★★줄면 ★기준을 ★내려라(그게 래칫이다).
 *
 * ★★⚠️이 파일 자신에 대하여 — ★처음 돌릴 때 ★★54 가 나왔다(기준 52).
 *   ★★까닭이 ★★«이 래칫 자신»이었다: 대조용 닻 문자열이 ★소스에 ★`sliceBlock(src, '…'` 꼴로
 *   ★글자로 남아 ★자기 자가 ★자기를 ★셌다(sig +2 · name +2 · sel +2 · cond +1 ★전부 딱 그만큼).
 *   ⛔기준을 54 로 ★올리지 않았다 — ★그러면 ★진짜 닻 ★2건이 ★여유로 들어온다.
 *   ⇒ ★★대신 ★자르개 이름을 ★런타임 조립(`_C`)해 ★그 꼴이 ★소스에 ★안 남게 했고,
 *     ★★R0 가 ★이 파일의 ★기여 = 0 을 ★단언한다(★누가 조립을 ★한 줄로 합치면 ★R0 가 빨개진다).
 */
import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { stripComments } = require('./_strip-comments.js');

const ROOT = path.join(import.meta.dirname, '..', '..');
const TESTS = path.join(ROOT, 'tests');
const SELF = 'unit/anchor-signature-ratchet.test.mjs';

/* ★★기준값 — ★«버전관리 안»에 둔다(지디 조건 ① · ⛔스크래치패드 금지).
   ★2026-10-07 ★아래 자로 ★직접 떠서 박았다(⛔남이 준 수를 베끼지 않았다 — 지디 조건 ②).
   ⚠️내 자가 ★두 번 틀렸던 뒤(TAP 파서 · argv 자리) ★고친 자로 ★다시 뜬 수다. */
const BASELINE = { sig: 52, files: 19, name: 189, sel: 4, cond: 1, lit: 246, var: 37 };

const CUTTERS = ['sliceBlock', 'bodyOf', 'arrowBodyOf', 'arrowBody', 'ruleOf', 'balanced'];
const CALL = new RegExp(`(?:${CUTTERS.join('|')})\\(\\s*[A-Za-z_$][\\w$]*\\s*,\\s*'([^']+)'`, 'g');
const VARCALL = new RegExp(`(?:${CUTTERS.join('|')})\\(\\s*[A-Za-z_$][\\w$]*\\s*,\\s*[A-Za-z_$][\\w$]*\\s*[,)]`, 'g');
const SIG  = /(?:function\s+[\w$]+\s*\(|=>|(?:const|let|var)\s+[\w$]+\s*=\s*\()/;
const COND = /^\s*(?:if|for|while|switch)\s*\(/;

/** 닻 문자열의 ★위험 등급. ★sig = ★«매개변수가 든» 서명 ⇒ ★인자 하나만 더해도 눈이 먼다. */
export function anchorKind(a) {
  if (COND.test(a)) return 'cond';
  if (SIG.test(a) && /\(\s*[A-Za-z_$]/.test(a)) return 'sig';
  if (/[.#][\w-]+|::|\s>\s|\[[\w-]+/.test(a)) return 'sel';
  return 'name';
}

/* ★★대조용 닻을 ★런타임에 ★조립한다 — ★이 파일 소스에 ★`자르개(src, '…'` 꼴이 ★남지 않게.
   ⛔한 줄로 합치지 마라: ★R0 가 빨개진다(그게 ★이 조립의 ★재는 자다). */
const _C = 'slice' + 'Block', _R = 'rule' + 'Of';
const probe = (cut, anchor) => `${cut}(src, '${anchor}');\n`;

function censusOne(src, c, sigFiles, rel) {
  let s = stripComments(src);
  if (!s.trim()) { c.stripEmpty++; s = src; }   /* ⛔거르개가 먹은 파일은 원본으로 — 「0건이 초록」 방지 */
  for (const m of s.matchAll(CALL)) {
    const k = anchorKind(m[1]); c[k]++; c.lit++;
    if (k === 'sig' && sigFiles) sigFiles.add(rel);
  }
  c.var += [...s.matchAll(VARCALL)].length;
}
function blank() { return { sig: 0, name: 0, sel: 0, cond: 0, var: 0, lit: 0, stripEmpty: 0 }; }

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(f, out); }
    else if (/\.(?:js|mjs|cjs)$/.test(e.name)) out.push(f);
  }
  return out;
}

/** tests/ 전수. ★extra = 임시로 더해 보는 가상 파일 [rel, src] (양성·음성대조용). */
function census(extra = null) {
  const files = walk(TESTS);
  const c = blank(), sigFiles = new Set();
  const srcs = files.map(f => [path.relative(TESTS, f), fs.readFileSync(f, 'utf8')]);
  if (extra) srcs.push(extra);
  for (const [rel, src] of srcs) censusOne(src, c, sigFiles, rel);
  return { ...c, files: sigFiles.size, total: files.length, sigList: [...sigFiles].sort() };
}

/* ─────────────────────────────────────────────
   R0 ★★자기검사 — ★래칫이 ★자기를 세지 않는다
   ⇐ 되돌리면 빨강: `_C` 조립을 한 줄로 합치면 이 칸이 0 이 아니게 된다.
   ───────────────────────────────────────────── */
test('R0 ★래칫 자신의 기여 = 0 (★재는 자가 자기를 세면 기준이 썩는다)', () => {
  const src = fs.readFileSync(path.join(TESTS, SELF), 'utf8');
  const c = blank();
  censusOne(src, c, null, SELF);
  console.log(`  R0 ★자기 기여 — sig ${c.sig} · name ${c.name} · sel ${c.sel} · cond ${c.cond} · lit ${c.lit}`);
  assert.strictEqual(c.lit, 0,
    `★이 래칫 파일이 ★리터럴 닻 ${c.lit}건을 ★스스로 들고 있다 — 기준값이 ★자기 오염만큼 부푼다.\n`
    + `  ⇒ ★처방: 대조 문자열의 ★자르개 이름을 ★조립해라(\`_C\`). ⛔한 줄로 합치지 마라.`);
});

/* ─────────────────────────────────────────────
   T0 ★입력이 살아 있다 — ★자가 «무언가를 실제로 보고 있나»
   ───────────────────────────────────────────── */
test('T0 ★입력이 살아 있다 — 파일·거르개·분류기', () => {
  const c = census();
  assert.ok(c.total > 200, `★tests/ 에서 ${c.total}개를 찾았다 — 200 이상이어야 한다(아래가 공회전)`);
  assert.ok(c.lit > 100, `★리터럴 닻이 ${c.lit}건 — 100 이상이어야 한다(자르개 이름이 바뀌었나)`);
  /* ★거르개 양성대조 — ★주석 속 닻은 ★안 세어진다 */
  const st = stripComments(`const a=1;\n/* ${probe(_C, 'function f(x) {')} */\n${probe(_C, '.cls')}`);
  assert.ok(!st.includes('function f(x)'), '★거르개가 주석 속 닻을 남겼다 — 수가 ★주석에 따라 흔들린다');
  assert.ok(st.includes('.cls'), '★거르개가 코드까지 먹었다');
  /* ★분류기 양성대조 — ★네 등급이 ★실제로 갈린다 */
  assert.strictEqual(anchorKind('function applyZoom(z, opts) {'), 'sig');
  assert.strictEqual(anchorKind('function _clampToSection('), 'name');
  assert.strictEqual(anchorKind('body.gdt-pad-on .section-inner::before'), 'sel');
  assert.strictEqual(anchorKind('if (A && B) {'), 'cond');
});

/* ─────────────────────────────────────────────
   R1 ★래칫 — ★서명 닻이 ★늘지 않았다
   ───────────────────────────────────────────── */
test('R1 ★서명 닻이 ★늘지 않았다 (기준 52 · 파일 19 · 2026-10-07 실측)', () => {
  const c = census();
  console.log(`  R1 ★지금 — 서명 ${c.sig}건 · 파일 ${c.files}개 · 이름 ${c.name} · 선택자 ${c.sel}`
    + ` · 조건식 ${c.cond} · 리터럴 ${c.lit} · 변수닻 ${c.var}(★못 가른다) · 거르개 빈출력 ${c.stripEmpty}건`);
  assert.ok(c.sig <= BASELINE.sig,
    `★서명 닻이 ${c.sig}건 — 기준 ${BASELINE.sig} 를 넘었다. ★새 검사가 «매개변수가 든 서명»을 닻으로 썼다.\n`
    + `  ⇒ ★처방: 닻에서 ★매개변수 목록을 ★빼라(예: 'const f = (' · 'function f(').\n`
    + `  ⇒ ★까닭: 누가 ★인자 하나만 더해도 ★그 검사가 ★조용히 눈이 먼다(2026-10-07 실측).`);
  assert.ok(c.files <= BASELINE.files,
    `★서명 닻을 쓰는 파일이 ${c.files}개 — 기준 ${BASELINE.files} 를 넘었다:\n  ${c.sigList.join('\n  ')}`);
  /* ★★줄었으면 ★기준을 내려라 — ★그게 래칫이다(⛔느슨히 두면 다시 늘 수 있다) */
  if (c.sig < BASELINE.sig)
    console.log(`  R1 ⚠️★${c.sig} 로 ★줄었다(기준 ${BASELINE.sig}) ⇒ ★★BASELINE.sig 를 ${c.sig} 로 내려라`);
});

/* ─────────────────────────────────────────────
   R2 ★★양성대조 — ★서명 닻 하나를 ★더하면 ★래칫이 ★빨개지나
   ⛔안 빨개지면 ★이 래칫은 ★「안 재고 있다」다.
   ───────────────────────────────────────────── */
test('R2 ★양성대조 — 서명 닻을 ★하나 더하면 ★기준을 넘는다', () => {
  const base = census();
  const added = census(['__probe__.test.mjs', probe(_C, 'function probeFn(a, b) {')]);
  assert.strictEqual(added.sig, base.sig + 1,
    `★서명 닻 하나를 더했는데 ${base.sig} → ${added.sig} 다 — ★분류기가 그 꼴을 ★안 센다(래칫이 죽었다)`);
  assert.ok(added.sig > BASELINE.sig,
    `★하나 더해도 기준 ${BASELINE.sig} 를 ★안 넘는다(지금 ${base.sig}) — ★기준이 ★느슨하다. 내려라`);
  /* ★그 닻이 ★진짜로 ★눈이 머는 꼴인가 — ★매개변수를 하나 더하면 ★못 찾힌다 */
  const body = 'function probeFn(a, b, c) { return 1; }';
  assert.ok(!body.includes('function probeFn(a, b) {'),
    '★매개변수를 더해도 그 닻이 ★여전히 찾힌다 — 이 꼴은 ★위험하지 않다(분류기를 다시 봐라)');
  assert.ok(body.includes('function probeFn('), '★이름까지만 닻은 ★살아남는다 — 그게 처방인 까닭');
});

/* ─────────────────────────────────────────────
   R3 ★★음성대조 — ★«함수 이름까지만» 닻은 ★기준을 안 건드린다
   ★그게 ★「위험 높음/낮음」을 ★가르는 자가 ★살아 있다는 ★증인이다.
   ───────────────────────────────────────────── */
test('R3 ★음성대조 — 이름까지만 · 선택자 · 조건식 닻은 ★초록이다', () => {
  const base = census();
  for (const [lbl, cut, anchor, box] of [
    ['이름까지만', _C, 'function probeFn(',       'name'],
    ['선택자',     _R, 'body.x .y::before',       'sel' ],
    ['조건식',     _C, 'if (A && B) {',           'cond'],
  ]) {
    const c = census(['__probe__.test.mjs', probe(cut, anchor)]);
    assert.strictEqual(c.sig, base.sig,
      `★${lbl} 닻을 더했는데 ★서명 수가 ${base.sig} → ${c.sig} 로 늘었다 — ★분류기가 ★과하게 잡는다`);
    /* ★★그 닻이 ★«다른 칸»에는 들어갔나 — 아니면 ★아무것도 안 세는 것이다(0 이 초록인 꼴) */
    assert.strictEqual(c[box], base[box] + 1,
      `★${lbl} 닻이 ★${box} 칸에도 ★안 들어갔다(${base[box]} → ${c[box]}) — ★자가 ★그 줄을 ★못 봤다`);
  }
});

/* ─────────────────────────────────────────────
   R4 ★곁 칸도 잠근다 — ★분류기가 ★«등급을 옮기는» 식으로 느슨해지는 것을 막는다
   (예: SIG 정규식을 좁히면 sig 는 줄고 name 이 그만큼 는다 ⇒ R1 만으론 초록)
   ───────────────────────────────────────────── */
test('R4 ★네 칸 합이 ★리터럴 총수와 같다 (등급 이동으로 ★래칫을 피할 수 없다)', () => {
  const c = census();
  assert.strictEqual(c.sig + c.name + c.sel + c.cond, c.lit,
    `★등급 합 ${c.sig + c.name + c.sel + c.cond} ≠ 리터럴 ${c.lit} — ★분류기에 ★새 칸이 생겼다`);
  assert.ok(c.lit >= BASELINE.lit,
    `★리터럴 닻이 ${c.lit} < 기준 ${BASELINE.lit} — ★줄었으면 ★기준을 내려라(⛔자르개가 안 세어지는 중일 수도)`);
  assert.strictEqual(c.var, BASELINE.var,
    `★변수 닻이 ${c.var}건(기준 ${BASELINE.var}) — ★이 자로 ★못 가르는 칸이다. ★수가 바뀌면 ★기준도 갱신하고\n`
    + `  ⇒ ★늘었다면 ★그 ${c.var - BASELINE.var}건이 ★서명을 변수에 담은 것인지 ★손으로 봐라`);
});
