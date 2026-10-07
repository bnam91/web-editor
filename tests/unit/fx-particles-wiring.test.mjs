/* fx-particles-wiring — 섹션 배경 파티클의 «배선»(js/effects-particles.js)을 ★불러서 잰다.
 *
 * ★무엇을 잠그나 (지디 판정 2026-10-07 Q1~Q7 의 ⛔조건들이 ★이 파일의 칸이다)
 *   W1 ★★배경색 계약 — 이 배선이 ★배경을 한 번도 안 쓴다 · ★lum 을 안 부른다(Q2 「자동 적용 0건」)
 *   W2 ★명부에서 «문만» 빌렸다 — `fxTypeKeys` 에 뜨지만 `fxTypesFor(블럭)` 에는 ★안 뜬다
 *      ＋ ★`registerFxType` 이 ★덮지 않고 ★이어 붙인다(지디 조건: 「기존 호출을 끊지 마라」)
 *   W3 ★다시그리기 문이 ★실제로 열렸다 — `watchAllFx` 가 ★내 함수를 ★부른다(음성대조 포함)
 *   W4 ★★Q6 「끄면 dataset 0건」 — 플래그가 아니라 ★지운다(명부가 하나라는 증명)
 *   W5·W6 저장 꼴 왕복 · ★배경 칸은 들어와도 ★떨어진다
 *   W7 ★★⑤ `EDITOR_ONLY_SEL`(조각 54)에 내 이름이 ★안 걸린다 — ★자를 «그 자리에 심는다»
 *      (지디 조건 Q3: 「0건은 한 시점이다 — 다음 사람이 이름을 바꿀 때 빨개지게」)
 *   W8 CSS 가 «자리»만 정한다 — ⛔색·배경 선언 0건   W9 필터 id 가 섹션마다 다르다
 *
 * ⚠️★여기서 ★안 재는 것 — ⛔「닫았다」로 적지 않는다
 *   ㉠ `applySectionParticles` 의 ★DOM 동작(층을 깔고 거둔다) — 진짜 DOM 이 필요하다(jsdom 없음 · 행위로 확인)
 *   ㉡ ★식구 ★셋(reflect·shadow·particles)이 ★진짜로 공존하나 — index.html 이 셋 다 싣는 ★브라우저의 일이다
 *      (아래 로더가 ★tmp 에 ★둘만 복사하므로 이 파일의 명부엔 파티클만 있다)
 *   ⇒ 둘 다 ★DOM 수트 `tests/dom/fx-particles-section.dom.spec.js` ㉠㉡㉢㉣ 의 몫이고 ★아직 ★미실시다(지디 창 대기).
 * ⛔앱 0 · 네트워크 0.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../');

/* ★그림 모듈(고전 스크립트)을 window 대역에 ★배선 import «전»에 실어 둔다 —
   실제 앱의 상시 스크립트(index.html:1089~1090)가 모듈보다 먼저 도는 것과 ★같은 주서다. */
/* window 대역 — 명부(effects-registry.js:136)가 load 리스너를 단다. ★그 등록을 «세어» 둔다:
   ⛔리스너를 «부르지는» 않는다(document 가 없다). ★대신 W0 이 「하나만 달렸나」를 잰다. */
const LOAD_HOOKS = [];
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
if (typeof globalThis.window.addEventListener !== 'function') {
  globalThis.window.addEventListener = (ev, fn) => { LOAD_HOOKS.push([ev, fn]); };
}
{
  const ctx = { Math, JSON, console }; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(readSrc(REPO, 'js/fx/seeded-random.js'), ctx);
  vm.runInContext(readSrc(REPO, 'js/fx/particles-render.js'), ctx);
  globalThis.window.FxSeed = ctx.FxSeed;
  globalThis.window.ParticlesFx = ctx.ParticlesFx;
}

/* ★js/*.js 는 브라우저에선 ESM 이지만 package.json 에 type:module 이 없어 Node 가 CJS 로 읽는다.
   ★선례(tests/unit/bulk-align-targets.test.mjs)와 «같은 벌» — tmp 에 type:module 을 얹고 싣는다.
   ★의존은 «effects-registry.js 하나»다(행위로 센 값 — 그 파일 자신은 import 0) ⇒ 둘만 복사한다.
   ⚠️★명부 인스턴스는 ★이 tmp 에 사는 한 벌이다 ⇒ REG 도 ★같은 tmp 에서 싣는다(아니면 두 명부를 본다). */
const { W, REG, TMP } = await (async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gd-fxpart-'));
  fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
  for (const f of ['effects-registry.js', 'effects-particles.js']) {
    fs.copyFileSync(path.join(REPO, 'js', f), path.join(tmp, f));
  }
  const reg = await import(pathToFileURL(path.join(tmp, 'effects-registry.js')).href);
  const w = await import(pathToFileURL(path.join(tmp, 'effects-particles.js')).href);
  /* ★사본은 ★여기서 «동기로» 치운다(만든 1 / 치운 1) — import 가 이미 평가를 마치다.
     ⚠️★process.on('exit') 로 둡다가 ★사본이 ★남은 것을 잡았다(2026-10-07 실제로 T/gd-fxpart-2lEaXk 남아 있었다)
       ⇒ ⛔exit 핸들러에 치우기를 맡기지 마라. ★선례(tests/unit/fit-scale.test.mjs)도 import 뒤 동기로 지운다. */
  fs.rmSync(tmp, { recursive: true, force: true });
  return { W: w, REG: reg, TMP: tmp };
})();

/* ★★«오염 전»에 떠 두는 측정 — 2026-10-07 양성대조 N4 가 잡은 가짜 초록의 처방.
   W3 은 음성대조 뒤 «제 손으로» 식구를 다시 등록한다 ⇒ 제품에서 `watchAll:` 줄을 떼도 W3 은 초록이었다
   (★명부를 재는 자가 자기 자신을 센다). ⇒ ★갓 실린 그 순간의 수를 ★테스트 밖에서 한 번 떠 둔다 —
   그러면 어느 테스트도 이 값을 ★오염시킬 수 없고, 제품 등록이 문을 안 달면 ★W0 이 빨개진다. */
const PRISTINE_WATCH_CALLS = (() => {
  let n = 0;
  REG.watchAllFx({ querySelectorAll: (sel) => { if (sel === '.section-block') n++; return { forEach: () => {} }; } });
  return n;
})();

test('W0 전제 — 배선과 그림이 둘 다 실렸고, 배선이 명부에 스스로 올랐다', () => {
  assert.equal(typeof W.applySectionParticles, 'function', '★전제: 배선을 실제로 import 했다');
  assert.equal(typeof globalThis.window.ParticlesFx?.svg, 'function', '★전제: 그림 모듈이 window 에 있다');
  assert.equal(W.FX_PARTICLES_KEY, 'fxParticles');
  assert.equal(W.FX_PARTICLES_SEED, 'fxParticlesSeed');
  assert.equal(W.FX_PARTICLES_WRAP, 'sec-fxpart-wrap');
  assert.ok(REG.fxTypeKeys().includes('particles'), '★전제: import 만으로 명부에 올랐다');
  /* ★★제품 등록이 «스스로» 다시기리기 문을 달았나 — ⛔이 값은 어떤 시험도 못 건드린다(위 PRISTINE 주서) */
  assert.equal(PRISTINE_WATCH_CALLS, 1,
    '★제품의 registerFxType 에 watchAll 이 없다 — 문이 어디서도 안 열린다(문서를 여는 등 다시 그리기가 죽는다)');
  /* ★다시기리기 발화 문은 «명부 한 자리»에만 있다 — ⛔내 파일은 제 load 리스너를 ★따로 달지 않는다 */
  assert.equal(LOAD_HOOKS.filter(([ev]) => ev === 'load').length, 1,
    `load 리스너가 ${LOAD_HOOKS.length} 개다 — 배선이 명부 밖에 또 달았다(문이 둘이면 두 번 도는다)`);
});

/* ── W1 ★★배경색 계약 — 「안 부른다」는 소스가 ★맞는 자다. ★그래서 양성대조가 ★필수다 ── */
test('W1 ★★배경을 한 번도 안 쓴다 · lum 을 안 부른다 (★양성대조 = 같은 자가 다른 파일에선 잡는다)', () => {
  /* 주석을 떼고 센다 — ⛔주석에 적은 이름이 측정값이 되면 안 된다(261007 교훈) */
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const code = strip(readSrc(REPO, 'js/effects-particles.js'));
  const BG_WRITE = /\.style\.background|\.dataset\.bg|backgroundColor|_applySectionBg/g;
  const LUM_CALL = /\blum\s*\(/g;
  /* ★양성대조 먼저 — 자가 히트를 내야 아래 0건이 증인이 된다 */
  const posN = (strip(readSrc(REPO, 'js/props/prop-section.js')).match(BG_WRITE) || []).length;
  assert.ok(posN > 10, `⛔★양성대조가 죽었다 — 같은 자가 prop-section.js 에서 ${posN} 건만 잡는다`);
  const lumN = (strip(readSrc(REPO, 'js/fx/particles-render.js')).match(LUM_CALL) || []).length;
  assert.ok(lumN > 0, '⛔★양성대조가 죽었다 — lum 자가 particles-render.js 의 정의/호출을 못 잡는다');
  /* ★음성대조 — 같은 자로 배선을 잰다 */
  const hits = code.match(BG_WRITE) || [];
  assert.deepEqual(hits, [], `배선이 섹션 배경을 건드린다: ${hits.join(',')} — 현빈이 막은 바로 그것`);
  const lum = code.match(LUM_CALL) || [];
  assert.deepEqual(lum, [], '배선이 lum 을 부른다 — 배경 휘도로 팔레트를 자동 고르면 되돌릴 자리가 없다(지디 Q2)');
});

/* ── W2 ★명부에서 «문만» 빌렸다 ───────────────────────────────────────── */
test('W2 ★「문만」 빌렸다 — 명부엔 있고 블럭 목록엔 없다 ＋ 재등록이 식구를 «덮지» 않는다', () => {
  /* ★블럭 넷을 흉내 낸 가짜로 — ⛔파티클이 블럭 패널 목록·카드에 뜨면 안 된다 */
  const fake = (cls) => ({ classList: { contains: (c) => cls.includes(c) }, dataset: {} });
  for (const cls of [['text-block'], ['asset-block'], ['shape-block'], ['sticker-block']]) {
    const got = REG.fxTypesFor(fake(cls)).map((t) => t.key);
    assert.ok(!got.includes('particles'), `${cls[0]} 패널에 파티클이 뜬다: ${got.join(',')}`);
  }
  /* ★음성대조 — supports 없는 가짜 식구는 ★뜬다(자가 「언제나 빈 목록」이 아니다) */
  REG.registerFxType({ key: '__fake_any', label: 'any', has: () => false, watchAll: () => 0 });
  assert.ok(REG.fxTypesFor(fake(['shape-block'])).map((t) => t.key).includes('__fake_any'),
    '⛔★음성대조가 죽었다 — fxTypesFor 가 아무것도 안 돌려준다');
  /* ★★지디 조건「기존 호출을 끊지 마라」 — 가짜 식구를 올려 두고 내 키를 ★다시 올려도 ★안 사라지나 */
  const before = REG.fxTypeKeys().length;
  REG.registerFxType({ key: 'particles', label: '파티클', supports: () => false, has: () => false, watchAll: W.watchAllParticles });
  const after = REG.fxTypeKeys();
  assert.ok(after.includes('__fake_any'), `★내 재등록이 남의 식구를 덮었다: ${after.join(',')}`);
  assert.equal(after.length, before, `같은 key 재등록이 식구 수를 바꿨다: ${after.join(',')}`);
  REG.unregisterFxType('__fake_any');
  assert.ok(!REG.fxTypeKeys().includes('__fake_any'), '★치웠다(만든 1 / 치운 1)');
});

test('W3 ★다시그리기 문이 열렸다 — watchAllFx 가 내 함수를 «실제로» 부른다(음성대조 포함)', () => {
  let asked = 0;
  /* 가짜 root — watchAllParticles 가 쓰는 문(querySelectorAll)만 가진다 */
  const root = { querySelectorAll: (sel) => { if (sel === '.section-block') asked++; return { forEach: () => {} }; } };
  const n = REG.watchAllFx(root);
  assert.equal(asked, 1, '★watchAllFx 가 파티클의 watchAll 을 안 불렀다 — 문이 안 열렸다');
  assert.equal(n, 0, '걸린 섹션이 0이면 돌려주는 수도 0이어야 한다');
  /* ★음성대조 — 내 식구를 빼면 ★안 불린다(자가 「언제나 1」이 아니다) */
  REG.unregisterFxType('particles');
  asked = 0; REG.watchAllFx(root);
  assert.equal(asked, 0, '⛔★음성대조 실패 — 등록을 뺐는데도 불린다');
  /* ★되돌린다 — ⛔「원복했다」도 잰다 */
  REG.registerFxType({ key: 'particles', label: '파티클', supports: () => false, has: () => false, watchAll: W.watchAllParticles });
  asked = 0; REG.watchAllFx(root);
  assert.equal(asked, 1, '★원복 확인 — 문이 다시 열렸다');
});

/* ── W4~W6 저장 꼴 ────────────────────────────────────────────────────── */
test('W4 ★★Q6 끄면 dataset 0건 — 플래그가 아니라 «지운다»(명부가 하나라는 증명)', () => {
  const ds = {};
  assert.equal(W.hasParticles(ds), false, '★전제: 처음엔 안 걸려 있다');
  W.writeParticles(ds, { preset: 'star', seed: 777, count: 40 });
  assert.equal(W.hasParticles(ds), true, '★전제: 걸렸다');
  assert.deepEqual(Object.keys(ds).sort(), ['fxParticles', 'fxParticlesSeed'], '쓰는 칸이 둘이 아니다');
  W.clearParticles(ds);
  assert.deepEqual(Object.keys(ds), [], `끄고 남은 칸이 있다: ${Object.keys(ds).join(',')} — 「어느 쪽이 참인가」가 생긴다`);
  assert.equal(W.hasParticles(ds), false);
  assert.equal(W.readParticles(ds), null, '끈 뒤에도 설정이 읽힌다');
  assert.equal(W.hasParticles({ fxParticles: '' }), false, '빈 문자열도 «꺼짐»이다');
});

test('W5 저장 꼴 왕복 — seed 는 «따로» 살고, 깨진 JSON 은 null(「꺼짐」과 섞지 않는다)', () => {
  const ds = {};
  W.writeParticles(ds, { preset: 'dust', seed: 20261007, count: 55, colors: ['#FFFFFF', 'rgba(255,0,0,0.5)'], shapes: ['circle'] });
  assert.equal(ds.fxParticlesSeed, '20261007', 'seed 가 따로 안 나갔다 — 사람이 보고 적는 수다');
  assert.ok(!/20261007/.test(ds.fxParticles), 'seed 가 JSON 안에도 들었다 — 명부가 둘이다');
  const got = W.readParticles(ds);
  assert.equal(got.seed, 20261007, 'seed 를 따로 읽어 합치지 않았다');
  assert.equal(got.count, 55);
  assert.deepEqual([...got.colors], ['#FFFFFF', 'rgba(255,0,0,0.5)'], '★쉼표 든 색이 JSON 으로 온전히 살아야 한다');
  /* 깨진 값 — ⛔「꺼짐」과 섞지 않는다: 둘 다 null 이지만 hasParticles 는 ★갈린다 */
  const bad = { fxParticles: '{이건 JSON 이 아니다', fxParticlesSeed: '1' };
  assert.equal(W.readParticles(bad), null);
  assert.equal(W.hasParticles(bad), true, '깨진 값은 «걸려 있다»로 읽혀야 패널이 고칠 길을 준다');
});

test('W6 ★★배경 칸은 들어와도 «떨어진다» — 저장본에 배경이 굳지 않는다', () => {
  const ds = {};
  W.writeParticles(ds, { preset: 'star', seed: 5, bg: '#3B1E6E', background: 'red', bgColor: '#000', count: 3 });
  assert.ok(!/3B1E6E|background|bgColor/i.test(ds.fxParticles), `배경 칸이 저장됐다: ${ds.fxParticles}`);
  const bgish = Object.keys(W.readParticles(ds)).filter((k) => /^(bg|background)/i.test(k));
  assert.deepEqual(bgish, [], `읽은 설정에 배경 칸이 있다: ${bgish.join(',')}`);
});

/* ── W7 ★★⑤ 배송본 CSS 쓸기 — 자를 «그 자리에 심는다» ───────────────── */
/** `export-css-collect.js` 의 EDITOR_ONLY_SEL 을 ★판에서 떠 와 ★되살린다.
 *  ⚠️★소스 문자열 리터럴의 이스케이프를 ★«해석»해야 한다 — 안 하면 `-handle\b` 의 백슬래시가
 *    리터럴이 되어 ★조각 절반이 죽고 「0건」이 ★가짜 초록이 된다(2026-10-07 실측: 내가 밟았고 양성대조가 잡았다). */
function editorOnlySel() {
  const src = readSrc(REPO, 'js/io/export-css-collect.js');
  const body = src.match(/EDITOR_ONLY_SEL = new RegExp\(\[([\s\S]*?)\]\.join/)[1];
  const unq = (x) => JSON.parse('"' + x.slice(1, -1).replace(/"/g, '\\"') + '"');
  const frags = (body.match(/'((?:[^'\\]|\\.)*)'/g) || []).map(unq);
  return { re: new RegExp(frags.join('|'), 'i'), n: frags.length };
}

test('W7 ★★내 이름이 배송본 CSS 쓸기에 안 걸린다 — ★양성대조로 자를 먼저 증명한다', () => {
  const { re, n } = editorOnlySel();
  assert.ok(n >= 50, `★전제: 조각을 다 떠 왔다(받음 ${n})`);
  /* ★양성대조 — 이 넷이 «걸려야» 자가 산다. ⛔이스케이프를 안 풀면 둘째가 통과해 버린다. */
  for (const bad of ['.sec-bg-editing', '.sec-fxpart-handle', '.sec-fxpart-placeholder', '.fxpart-line-selected']) {
    assert.ok(re.test(bad), `⛔★양성대조가 죽었다 — 자가 «${bad}» 를 못 잡는다(이스케이프 해석 실패?)`);
  }
  /* ★음성대조 — 내가 쓰는 이름 전부 */
  for (const sel of ['.' + W.FX_PARTICLES_WRAP, '.sec-fxpart-svg', '.sec-fxpart-layer', '.sec-fxpart-halo',
    '.section-block > .' + W.FX_PARTICLES_WRAP]) {
    assert.ok(!re.test(sel), `★«${sel}» 가 배송본 CSS 쓸기에 걸린다 — 에디터에선 맞고 내보낸 배송본에서 이 규칙이 빠진다`);
  }
  /* ★그림 모듈이 «실제로 내는» 클래스도 같은 자로 — ⛔내가 «적은» 이름이 아니라 «나온» 이름을 잰다 */
  const svg = globalThis.window.ParticlesFx.svg({ preset: 'star', seed: 1, count: 3, glow: 60, spread: 8, w: 100, h: 100, filterId: 'pfx-x' });
  const cls = [...new Set([...svg.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)))];
  assert.ok(cls.length >= 3, `★전제: 그림에서 클래스를 뽑았다(받음 ${cls.join(',')})`);
  for (const c of cls) assert.ok(!re.test('.' + c), `그림이 내는 클래스 «.${c}» 가 배송본 CSS 쓸기에 걸린다`);
});

test('W8 CSS 는 «자리»만 정한다 — ⛔색·배경 선언 0건', () => {
  const css = readSrc(REPO, 'css/editor-canvas.css');
  const rule = css.match(/\.section-block\s*>\s*\.sec-fxpart-wrap\s*\{([^}]*)\}/);
  assert.ok(rule, '층 규칙이 CSS 에 없다 — 층이 상자를 못 채운다');
  const decl = rule[1];
  assert.match(decl, /position:\s*absolute/);
  assert.match(decl, /inset:\s*0/);
  assert.match(decl, /pointer-events:\s*none/, '층이 클릭을 먹으면 섹션을 못 고른다');
  assert.match(decl, /overflow:\s*hidden/, '후광이 섹션 밖으로 번진다');
  const bad = decl.match(/background|(?<!-)\bcolor\s*:/g) || [];
  assert.deepEqual(bad, [], `층 CSS 가 색·배경을 정한다: ${bad.join(',')} — 섹션 배경은 섹션 것이다`);
});

test('W9 ★필터 id 는 섹션마다 다르다 — 문서 전역 id 가 겹치지 않게', () => {
  assert.equal(W.particlesFilterId('sec_abc'), 'pfx-sec_abc');
  assert.notEqual(W.particlesFilterId('sec_a'), W.particlesFilterId('sec_b'));
  assert.equal(W.particlesFilterId('sec/<>"'), 'pfx-sec', 'id 에 못 쓸 글자를 안 걸렀다');
  assert.equal(W.particlesFilterId(''), 'pfx-tmp', 'id 가 없는 섹션에도 그림이 나야 한다');
});
