/* fx-particles-panel — ★섹션 배경 파티클의 «켜는 칸»이 ★수·이름을 ★«읽는가» (2026-10-08 현빈 발주 · 지디 GO)
 *
 * ★이 파일이 재는 것 = ★「칸이 ★제 손으로 수를 적지 않았나」. ⛔칸이 ★뜨는지는 ★DOM 수트 몫이다
 *   (tests/dom/fx-particles-panel.dom.spec.js — 전제·양성·음성·저장 왕복 넷).
 *
 * ★★왜 unit 이 ★이것을 재나 — ★발주의 ⛔가 ★「하드코딩 금지」였다:
 *   「★상한 60(★ParticlesFx.MAX_COUNT — ★그 수를 ★하드코딩하지 말고 ★읽어라)」
 *     ⚠️★★그 「60」은 ★★발주 당시(2026-10-08 오전)의 ★인용이다 — ⛔지금 값이 아니다.
 *       ★그 날 ★오후에 ★현빈이 ★120 으로 올렸고, ★★이 검사들은 ★한 줄도 ★안 고쳤다.
 *       ⇒ ★★그것이 ★「읽어라」를 ★지켰다는 ★증거다(★수를 박았으면 ★전부 빨개졌을 자리).
 *   ⇒ ★★「읽었다」는 ★★«출처를 바꾸면 ★출력이 따라온다»로만 ★증명된다(P4·P5).
 *     ⛔`max === P.MAX_COUNT` ★하나로는 ★아무것도 안 잠근다 — ★둘이 ★같은 소스라 ★항등식이다
 *       (★그 덫: 2026-10-04 「내가 건 단언이 항상 참이라 아무것도 안 잠갔다」).
 *     ⇒ ★그래서 ★P4·P5 는 ★★«상수를 갈아 끼운 판»에서 ★출력이 ★갈리나를 잰다.
 *
 * ★★안 재는 것(⛔「닫았다」로 적지 않는다):
 *   · 칸이 ★화면에 ★뜨나 · ★눌리나 · ★그림이 ★나나 ⇒ ★DOM 수트
 *   · 배선(`wireSecParticles`)의 ★고리 — ★document 가 필요하다 ⇒ ★DOM 수트
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

/* ★window 대역 — 실앱에선 고전 스크립트(index.html)가 모듈보다 먼저 돈다. ★그 주서를 흉내낸다. */
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
if (typeof globalThis.window.addEventListener !== 'function') globalThis.window.addEventListener = () => {};
{
  const ctx = { Math, JSON, console }; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(readSrc(REPO, 'js/fx/seeded-random.js'), ctx);
  vm.runInContext(readSrc(REPO, 'js/fx/particles-render.js'), ctx);
  globalThis.window.FxSeed = ctx.FxSeed;
  globalThis.window.ParticlesFx = ctx.ParticlesFx;
}

/* ★js/*.js 는 브라우저 ESM 인데 package.json 에 type:module 이 없어 Node 가 CJS 로 읽는다.
   ★선례(tests/unit/fx-particles-wiring.test.mjs:53)와 ★같은 벌 — tmp 에 type:module 을 얹는다.
   ★`prop-section-particles.js` 의 import 는 ★`./_helpers.js` ★하나다(★escHtml 정본 · ⛔사본 금지 게이트 X9)
     ⇒ ★그 파일은 ★import 가 ★0 이라 ★사본 하나로 끝난다(★행위로 센 값 — 그 파일에 `^import` 0줄).
   ⚠️★이름은 ★`_helpers.js` 그대로 둔다 — ⛔`panel.js` 처럼 ★바꾸면 ★import 가 ★안 풀린다. */
const { PANEL, WIRING } = await (async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gd-fxpanel-'));
  fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
  fs.copyFileSync(path.join(REPO, 'js/effects-registry.js'), path.join(tmp, 'effects-registry.js'));
  fs.copyFileSync(path.join(REPO, 'js/effects-particles.js'), path.join(tmp, 'effects-particles.js'));
  fs.copyFileSync(path.join(REPO, 'js/props/_helpers.js'), path.join(tmp, '_helpers.js'));
  fs.copyFileSync(path.join(REPO, 'js/props/prop-section-particles.js'), path.join(tmp, 'panel.js'));
  const wiring = await import(pathToFileURL(path.join(tmp, 'effects-particles.js')).href);
  const panel  = await import(pathToFileURL(path.join(tmp, 'panel.js')).href);
  /* ★사본은 ★여기서 «동기로» 치운다 — ⛔exit 핸들러에 맡기면 ★남는다(그 선례의 실측). */
  fs.rmSync(tmp, { recursive: true, force: true });
  return { PANEL: panel, WIRING: wiring };
})();

/* ★저장 다리를 ★창에 얹는다 — ★실앱에서 effects-particles.js 가 하는 ★그 일(그 파일 :167~172). */
Object.assign(globalThis.window, {
  hasParticles: WIRING.hasParticles, readParticles: WIRING.readParticles,
  writeParticles: WIRING.writeParticles, clearParticles: WIRING.clearParticles,
  FX_PARTICLES_WRAP: WIRING.FX_PARTICLES_WRAP,
});

const P = globalThis.window.ParticlesFx;

/** ★가짜 섹션 — ⛔이름을 ★지어내지 않았다. `dataset`·`querySelector` 는 ★그리개가 ★실제로 부르는 둘이다. */
function mkSec({ cfg = null, wrapHtml = null } = {}) {
  const sec = {
    dataset: {},
    querySelector: (sel) => (wrapHtml != null && String(sel).includes(WIRING.FX_PARTICLES_WRAP)
      ? { innerHTML: wrapHtml } : null),
  };
  if (cfg) WIRING.writeParticles(sec.dataset, cfg);
  return sec;
}

/** ★그리개를 ★«이 ParticlesFx 로» 한 번 돌린다 — ★상수를 갈아 끼우는 판(P4·P5)이 쓴다. */
function htmlWith(fx, sec) {
  const keep = globalThis.window.ParticlesFx;
  globalThis.window.ParticlesFx = fx;
  try { return PANEL.secParticlesHTML(sec); }
  finally { globalThis.window.ParticlesFx = keep; }
}

const attr = (html, re) => (html.match(re) || [])[1];

/* ═══ P0 전제 ═══════════════════════════════════════════════════════════════ */

test('P0 전제 — 그리개·배선이 실렸고 저장 다리·그림 모듈이 창에 있다', () => {
  assert.equal(typeof PANEL.secParticlesHTML, 'function', '★전제: 그리개를 실제로 import 했다');
  assert.equal(typeof PANEL.wireSecParticles, 'function', '★전제: 배선을 실제로 import 했다');
  assert.equal(typeof P?.svg, 'function', '★전제: 그림 모듈(ParticlesFx)이 창에 있다');
  assert.equal(typeof globalThis.window.hasParticles, 'function', '★전제: 켜짐 판정 다리가 창에 있다');
  /* ★창 다리를 ★스스로 깔았나 — ★prop-section.js 가 ★이 이름으로 부른다(그 파일 Background 절 한 줄) */
  assert.equal(typeof globalThis.window.secParticlesHTML, 'function', 'window.secParticlesHTML 다리가 없다 — prop-section.js 가 못 부른다');
  assert.equal(typeof globalThis.window.wireSecParticles, 'function', 'window.wireSecParticles 다리가 없다 — 배선이 안 붙는다');
});

/* ═══ P1 모양 글 — ★«둘째 명부»가 될 싹을 재는 자 ════════════════════════════ */

test('P1 ★모양 글이 SHAPES 를 ★양방향으로 덮는다 — 모양이 늘면 ★여기가 빨개진다', () => {
  const LBL = globalThis.window.SEC_PARTICLES_SHAPE_LABEL;
  assert.ok(LBL && typeof LBL === 'object', '★전제: 모양 글 표를 창으로 냈다(검사가 볼 수 있게)');
  /* ★전제 — ★모양이 ★하나라도 있다(⛔0개면 아래 둘이 ★공집합으로 ★조용히 통과한다) */
  assert.ok(P.SHAPES.length > 0, '★전제: ParticlesFx.SHAPES 가 비었다 — 아래 단언이 공집합으로 거짓통과한다');
  /* ★★`Array.from` 으로 ★이 판의 배열로 옮긴다 — ★`P.SHAPES` 는 ★vm 판에서 왔고
     ★거기서 난 배열은 ★프로토타입이 ★다른 realm 이라 ★`deepStrictEqual` 이 ★내용과 ★무관하게 ★거절한다
     (★2026-10-08 실측: `[]` 와 `[]` 가 ★빨갰다). ⇒ ★자를 고친다. ⛔단언을 ★느슨하게 풀지 않는다. */
  const missing = Array.from(P.SHAPES).filter((k) => !LBL[k]);
  const extra   = Array.from(Object.keys(LBL)).filter((k) => !P.SHAPES.includes(k));
  assert.deepEqual(missing, [], `★모양에 사람 글이 없다 — 패널에 키가 그대로 뜬다(${missing.join(',')})`);
  assert.deepEqual(extra, [], `★글 표에 ★없는 모양이 있다 — 정본(SHAPES)에서 빠진 뒤 글만 남았다(${extra.join(',')})`);
});

/* ═══ P2·P3 칸의 꼴 — 끈 상태 / 켠 상태 ═══════════════════════════════════════ */

test('P2 ★끈 섹션 — ★켜는 단추 하나뿐이고 ★조절 칸은 ★없다', () => {
  const sec = mkSec();
  assert.equal(globalThis.window.hasParticles(sec.dataset), false, '★전제: 이 섹션은 꺼져 있다');
  const h = PANEL.secParticlesHTML(sec);
  assert.ok(h.includes('id="sec-fxpart-toggle"'), '켜는 단추가 없다 — ★켤 길이 없으면 발주를 못 지킨다');
  assert.ok(h.includes('파티클 켜기'), '단추 글이 「켜기」가 아니다');
  for (const id of ['sec-fxpart-card', 'sec-fxpart-presets', 'sec-fxpart-shapes', 'sec-fxpart-seed']) {
    assert.ok(!h.includes(`id="${id}"`), `★꺼진 섹션에 ${id} 가 떴다 — 끈 상태에 조절 칸이 보인다`);
  }
  assert.equal((h.match(/data-fxpart-axis=/g) || []).length, 0, '★꺼진 섹션에 ★조절 축이 떴다');
});

test('P3 ★켠 섹션 — ★★시안의 칸이 ★이름·순서 ★그대로 ★다 있다', () => {
  const sec = mkSec({ cfg: { preset: P.KINDS[0], seed: 7 }, wrapHtml: '<svg></svg>' });
  const cfg0 = WIRING.readParticles(sec.dataset);
  assert.equal(globalThis.window.hasParticles(sec.dataset), true, '★전제: 이 섹션은 켜져 있다');
  const h = PANEL.secParticlesHTML(sec);
  for (const id of ['sec-fxpart-card', 'sec-fxpart-toggle', 'sec-fxpart-fold', 'sec-fxpart-presets',
                    'sec-fxpart-reroll', 'sec-fxpart-seed', 'sec-fxpart-redraw', 'sec-fxpart-colors',
                    'sec-fxpart-rot', 'sec-fxpart-dist', 'sec-fxpart-shapes', 'sec-fxpart-off']) {
    assert.ok(h.includes(`id="${id}"`), `★켠 섹션에 ${id} 가 없다 — 현빈이 만질 칸이 빠졌다`);
  }
  assert.ok(h.includes('파티클 끄기'), '단추 글이 「끄기」로 안 바뀌었다');
  /* ★프리셋 수 — ⛔4 를 적지 않는다. ★KINDS 에서 센다. */
  const pres = (h.match(/data-fxpart-preset="/g) || []).length;
  assert.equal(pres, P.KINDS.length, `프리셋 단추 수가 KINDS 수와 다르다 (단추 ${pres} · KINDS ${P.KINDS.length})`);
  /* ★모양 단추 수 — ⛔5 를 적지 않는다. ★SHAPES 에서 센다. */
  const btns = (h.match(/data-fxpart-shape="/g) || []).length;
  assert.equal(btns, P.SHAPES.length, `모양 단추 수가 SHAPES 수와 다르다 (단추 ${btns} · SHAPES ${P.SHAPES.length})`);
  /* ★분포 수 — ⛔3 을 적지 않는다. ★DISTS 에서 센다. */
  const dn = (h.match(/<option value="/g) || []).length;
  assert.equal(dn, P.DISTS.length, `분포 option 수가 DISTS 수와 다르다 (option ${dn} · DISTS ${P.DISTS.length})`);
  /* ★색 스와치 수 — ★이 프리셋의 colors 수 그대로 */
  const cn = (h.match(/data-fxpart-color-in="/g) || []).length;
  assert.equal(cn, cfg0.colors.length, `색 스와치 수가 colors 수와 다르다 (${cn} vs ${cfg0.colors.length})`);
  /* ★★시안의 ★칸 이름·순서 ★그대로인가 — ★시안 `:264~318`.
     ★★현빈 2026-10-08 「시안보여줬던대로 ★안보이는데?? ★조절하는 항목들 ★어디갔냐??」 ⇒ ★이 줄이 ★그걸 잠근다. */
  const labels = (h.match(/class="prop-label"[^>]*>[^<]*/g) || []).map((x) => x.split('>').pop().trim());
  assert.deepEqual(Array.from(labels),
    ['무늬번호', '갯수', '색', '크기', '불투명도', '흔들림', '회전', '분포', '글로우', '퍼짐', '모양'],
    '★★칸의 이름·순서가 ★시안과 다르다');
  /* ★그림이 났으면 ★안내는 ★안 뜬다(아래 P7 이 반대쪽을 잰다) */
  assert.ok(!h.includes('섹션 크기를 아직 못 재서'), '★그림이 났는데 「못 쟀다」 안내가 떴다');
});

/* ═══ P4·P5 ★★하드코딩 금지 — ★출처를 갈아 끼우면 ★출력이 ★따라오나 ════════════ */

test('P4 ★★개수 상한을 ★읽는다 — ★MAX_COUNT 를 7 로 둔 판에서 ★칸의 max 가 7 이 된다', () => {
  /* ★★전제부터 — ★실물 상한이 ★7 이면 ★이 시험은 ★아무것도 안 가른다(항등식이 된다) */
  assert.notEqual(P.MAX_COUNT, 7, '★전제 깨짐: 실물 MAX_COUNT 가 7 이다 — 이 대조가 값을 못 잠근다. 다른 수로 바꿔라');
  const sec = mkSec({ cfg: { preset: P.KINDS[0], seed: 7 }, wrapHtml: '<svg></svg>' });

  /* ⑴ ★실물 판 — 칸의 max 가 ★실물 상한이다 */
  const real = attr(PANEL.secParticlesHTML(sec), /data-fxpart-axis="count"[^>]*max="(\d+)"/);
  assert.equal(real, String(P.MAX_COUNT), `칸의 상한이 ParticlesFx.MAX_COUNT 와 다르다 (칸 ${real} · 정본 ${P.MAX_COUNT})`);

  /* ⑵ ★★갈아 끼운 판 — ★상한을 7 로 ★내린 ParticlesFx 로 ★같은 그리개를 돌린다.
     ★대역은 ★실물에서 ★파생시킨다(⛔이름을 지어내지 않는다 — 「테스트 더블 이름은 실물에서 뽑아라」). */
  const SEVEN = Object.freeze({ ...P, MAX_COUNT: 7, RANGES: Object.freeze({ ...P.RANGES, count: Object.freeze({ min: 0, max: 7 }) }) });
  const patched = attr(htmlWith(SEVEN, sec), /data-fxpart-axis="count"[^>]*max="(\d+)"/);
  /* ★★7 은 ★리터럴이다 — ⛔`String(SEVEN.MAX_COUNT)` 로 쓰면 ★또 항등식이 된다 */
  assert.equal(patched, '7', `★상한을 7 로 내렸는데 칸이 ${patched} 다 — ★칸이 수를 ★제 손으로 적었다(하드코딩)`);
  assert.notEqual(real, patched, '★두 판의 칸이 ★같다 — 그리개가 ParticlesFx 를 ★안 읽는다');
});

test('P5 ★★프리셋 ★글·★이름을 ★읽는다 — ★label 을 바꾼 판에서 ★단추 글이 따라온다', () => {
  const k0 = P.KINDS[0];
  const MARK = '＠검사용프리셋글＠';
  assert.ok(!PANEL.secParticlesHTML(mkSec({ cfg: { preset: k0, seed: 7 } })).includes(MARK),
    '★전제: 표식이 실물 출력에 ★이미 있다 — 다른 표식을 골라라');

  const FAKE = Object.freeze({
    ...P,
    PRESETS: Object.freeze({ ...P.PRESETS, [k0]: Object.freeze({ ...P.PRESETS[k0], label: MARK }) }),
  });
  const h = htmlWith(FAKE, mkSec({ cfg: { preset: k0, seed: 7 }, wrapHtml: '<svg></svg>' }));
  assert.ok(h.includes(MARK), `★프리셋 글을 바꿨는데 칸이 안 따라왔다 — ★글을 ★제 손으로 적었다(${k0})`);
  /* ★음성대조 — ★실물 글은 ★사라졌다(안 사라졌으면 ★둘 다 적고 있는 것이다) */
  assert.ok(!h.includes(P.PRESETS[k0].label), `★바꾼 판에 ★실물 글(${P.PRESETS[k0].label})이 ★남아 있다 — 글이 두 자리에서 온다`);
});

test('P6 ★모양 ★이름을 ★읽는다 — ★SHAPES 를 줄인 판에서 ★단추도 줄어든다', () => {
  assert.ok(P.SHAPES.length > 1, '★전제: 모양이 둘 이상이다 — 아니면 「줄였다」를 못 만든다');
  const ONE = Object.freeze({ ...P, SHAPES: Object.freeze([P.SHAPES[0]]) });
  const sec = mkSec({ cfg: { preset: P.KINDS[0], seed: 7 }, wrapHtml: '<svg></svg>' });
  const n = (htmlWith(ONE, sec).match(/data-fxpart-shape="/g) || []).length;
  assert.equal(n, 1, `★모양을 하나로 줄였는데 단추가 ${n} 개다 — ★칸이 모양 이름을 ★제 손으로 적었다`);
});

/* ═══ P7 ★그림이 ★안 났을 때 — ⛔「켰다」와 「그려졌다」를 ★섞지 않는다 ══════════ */

test('P7 ★켰는데 ★그림이 ★안 났으면 ★사람에게 말해 준다', () => {
  /* ★섹션 크기를 못 믿으면 applySectionParticles 가 ★물러난다(js/effects-particles.js:137)
     ⇒ ★층이 ★없거나 ★비어 있다. ★그때 ★칸이 ★조용하면 사람은 「고장」으로 읽는다. */
  const noWrap = mkSec({ cfg: { preset: P.KINDS[0], seed: 7 } });                 // 층 자체가 없다
  const empty  = mkSec({ cfg: { preset: P.KINDS[0], seed: 7 }, wrapHtml: '' });   // 층은 있고 비었다
  for (const [name, sec] of [['층 없음', noWrap], ['층 빔', empty]]) {
    assert.ok(PANEL.secParticlesHTML(sec).includes('섹션 크기를 아직 못 재서'),
      `★${name} 인데 안내가 없다 — 사람이 「켰는데 아무 일도 없다」로 읽는다`);
  }
});

/* ═══ P8 ★그리개가 ★죽지 않는다 — ★패널은 ★살아야 한다 ═══════════════════════ */

test('P8 ★ParticlesFx 나 저장 다리가 ★없으면 ★빈 글자 — ⛔패널을 통째로 죽이지 않는다', () => {
  const sec = mkSec({ cfg: { preset: P.KINDS[0], seed: 7 } });
  /* ★전제 — ★있을 때는 ★안 비었다(아니면 아래 「비었다」가 ★항상 참이다) */
  assert.notEqual(PANEL.secParticlesHTML(sec), '', '★전제: 정상 판에서는 칸이 그려진다');
  assert.equal(htmlWith(null, sec), '', '★ParticlesFx 가 없을 때 ★빈 글자가 아니다 — 패널이 깨질 수 있다');

  const keep = globalThis.window.writeParticles;
  globalThis.window.writeParticles = undefined;
  try { assert.equal(PANEL.secParticlesHTML(sec), '', '★저장 다리가 없을 때 ★빈 글자가 아니다'); }
  finally { globalThis.window.writeParticles = keep; }

  assert.equal(PANEL.secParticlesHTML(null), '', '★섹션이 null 일 때 던졌거나 글자를 냈다');
  /* ★배선도 ★같다 — ⛔document 없이 불러도 ★안 던진다(그리개가 빈 글자면 ★칸이 없다) */
  assert.doesNotThrow(() => PANEL.wireSecParticles(null, () => {}), '★배선이 섹션 null 에 던졌다');
});

/* ═══ P9 ★★⛔«on» 둘째 칸 금지 — ★소스로 재는 보조 자 ════════════════════════ */

test('P9 ★칸이 ★«on» 둘째 칸을 ★만들지 않았다 — ★켜짐은 hasParticles 하나로', () => {
  const src = readSrc(REPO, 'js/props/prop-section-particles.js');
  /* ★dataset 에 ★우리 키 ★둘 말고 ★다른 것을 ★쓰는 자리가 ★없다 —
     ★쓰기는 ★`writeParticles`·`clearParticles` ★둘로만 간다. */
  assert.equal((src.match(/\.dataset\s*\[/g) || []).length, 0,
    '★칸이 dataset 에 ★직접 쓴다 — ★저장 꼴의 정본이 ★둘이 된다(writeParticles 만 써라)');
  assert.equal((src.match(/\.dataset\.\w+\s*=/g) || []).length, 0,
    '★칸이 dataset 속성에 ★직접 대입한다 — ★writeParticles 를 거치지 않는 길이 생겼다');
  /* ★★끄기가 ★`clearParticles` 로 간다 — ⛔빈 문자열로 덮는 길이 ★없다 */
  assert.ok(src.includes('clearParticles'), '★끄기가 clearParticles 를 안 부른다');
  /* ★배경 계약 — ⛔«섹션»의 배경색·배경이미지를 ★한 번도 안 건드린다(현빈 2026-10-07
       「배경색이 계속 바뀌면 안되는거 알지?」 · js/effects-particles.js:17~22 의 그 계약).
     ⛔★2026-10-08 ★내 흠: 처음엔 ★`/style\.background|dataset\.bg/` 였는데 ★그것이
       ★★«색 스와치»의 `host.style.background`(=★패널 제 요소)를 ★잡아 ★빨개졌다
       ⇒ ★★«게이트가 ★잘못된 양을 ★재고 있었다». ★재야 하는 것은 ★★«섹션에 쓰나»다.
     ★★그래서 ★좁혔다 — ★그리고 ★좁히다 ★자가 ★죽는 것을 막으려고 ★★양성대조를 ★같이 건다. */
  const SEC_BG = /sec\.style\.|sec\.dataset\.bg/g;
  assert.equal((src.match(SEC_BG) || []).length, 0,
    '★칸이 ★섹션 배경·인라인 스타일을 건드린다 — 「배경색이 계속 바뀌면 안되는거 알지?」를 깬다');
  /* ★★양성대조 — ★이 자가 ★위반 꼴을 ★정말 잡나(⛔좁히다 ★아무것도 안 잡게 된 것을 막는다) */
  assert.equal(('sec.style.background = "#fff";'.match(SEC_BG) || []).length, 1,
    '⛔★이 자가 ★`sec.style.` 위반을 ★못 잡는다 — regex 가 죽었다(위 0건은 뜻이 없다)');
  assert.equal(('sec.dataset.bgImg = x;'.match(SEC_BG) || []).length, 1,
    '⛔★이 자가 ★`sec.dataset.bg` 위반을 ★못 잡는다 — regex 가 죽었다');
  /* ★전제 — ★이 파일이 ★`sec.` 를 ★실제로 쓴다(★안 쓰면 위 0건이 ★당연해서 ★아무것도 안 잠근다) */
  assert.ok(/\bsec\.dataset\b/.test(src), '★전제: 이 파일이 sec.dataset 을 쓴다 — 아니면 위 0건이 공허하다');
});

test('P10 ★prop-section.js 가 ★그리개와 ★배선을 ★한 쌍으로 부른다', () => {
  /* ★★둘 중 ★하나만 있으면 ★칸은 ★뜨는데 ★안 눌린다(또는 ★반대) — ★그 반쪽 고장을 ★이름으로 잠근다. */
  const src = readSrc(REPO, 'js/props/prop-section.js');
  assert.ok(src.includes('window.secParticlesHTML'), 'prop-section.js 가 ★그리개를 안 부른다 — 칸이 안 뜬다');
  assert.ok(src.includes('window.wireSecParticles'), 'prop-section.js 가 ★배선을 안 부른다 — 칸이 안 눌린다');
  /* ★★자리 — ★「Background」 절 ★안이다(지디 2026-10-07 Q1 판정 ⒞).
     ★재는 법: ★그리개 호출이 ★Background 제목 ★뒤, ★그 다음 `prop-section` 제목 ★앞에 있다. */
  const bg   = src.indexOf('>Background<');
  const call = src.indexOf('window.secParticlesHTML');
  const next = src.indexOf('prop-section-title">Text Color', bg);
  assert.ok(bg > 0, '★전제: Background 절 제목을 못 찾았다 — 이 검사가 자리를 못 잰다');
  assert.ok(next > bg, '★전제: Background 다음 절을 못 찾았다 — 구간을 못 만든다');
  assert.ok(call > bg && call < next,
    `★그리개 호출이 ★Background 절 밖에 있다 (Background ${bg} · 호출 ${call} · 다음 절 ${next})`);
  /* ★index.html 이 ★칸을 ★싣는다 — ⛔배선 2줄이 빠져 앱에서 죽은 ★그 사고(aecd7545)의 자리다 */
  const html = readSrc(REPO, 'index.html');
  assert.ok(html.includes('js/props/prop-section-particles.js'),
    '★index.html 이 칸을 안 싣는다 — ★「머지됐다 ≠ 앱에 있다」의 그 자리다');
});

/* ═══ P11~P13 ★★«축 전수» — ★★지디 2026-10-08 2차 발주의 ★핵심 잠금 ═════════════
   ★현빈 「★조절하는 항목들 ★어디갔냐?? ★아티팩트에 있던것들 말야 ★조절옵션들 ★왜 줄여」
   ⇒ ★1차는 ★축이 ★`count` ★하나였다. ★★다시 줄어드는 것을 ★구조로 막는 자가 ★이 셋이다. */

test('P11 ★★축이 늘면 ★칸이 ★저절로 생긴다 — ★RANGES 에 ★가짜 축을 더한 판에서 ★칸이 ★하나 늘어난다', () => {
  /* ★★이것이 ★지디가 ★콕 집은 ★양성대조다. ⛔`칸 수 === RANGES 키 수` ★하나로는
     ★★둘이 ★같은 소스라 ★항등식이고 ★★«손으로 7줄 적은 판»도 ★초록으로 지나간다.
     ⇒ ★★출처(RANGES)를 ★갈아 끼워 ★출력이 ★따라오는지로만 ★증명된다(★P4·P5·P6 과 같은 꼴). */
  const sec = mkSec({ cfg: { preset: P.KINDS[0], seed: 7 }, wrapHtml: '<svg></svg>' });
  const axes = (h) => (h.match(/data-fxpart-axis="([^"]+)"/g) || []).map((x) => x.slice(18, -1));

  const base = axes(PANEL.secParticlesHTML(sec));
  /* ★전제 ⑴ — ★실물에서 ★칸 == RANGES 키(★이 자가 ★지금 ★맞게 서 있나) */
  assert.deepEqual(Array.from(base).sort(), Array.from(Object.keys(P.RANGES)).sort(),
    `★칸과 RANGES 키가 다르다 (칸 ${base.join(',')} · RANGES ${Object.keys(P.RANGES).join(',')})`);
  /* ★전제 ⑵ — ★가짜 축 이름이 ★실물에 ★없다(있으면 아래가 뜻이 없다) */
  const FAKE_AXIS = '__wobble';
  assert.ok(!Object.keys(P.RANGES).includes(FAKE_AXIS), `★전제: ${FAKE_AXIS} 가 실물 RANGES 에 이미 있다 — 다른 이름을 골라라`);

  /* ★★갈아 끼운 판 — ★RANGES 에 ★축 하나를 ★더한다. ★대역은 ★실물에서 ★파생시킨다 */
  const MORE = Object.freeze({
    ...P,
    RANGES: Object.freeze({ ...P.RANGES, [FAKE_AXIS]: Object.freeze({ min: 0, max: 9 }) }),
  });
  const got = axes(htmlWith(MORE, sec));
  /* ★★`base.length + 1` 이 ★아니라 ★★«실물 수 ＋ 1» 을 ★쓴다 — 둘은 같지만 ★뜻이 다르다:
     ★앞은 ★자기 출력끼리 견주고, ★뒤는 ★«정본 수»에 ★견준다 */
  assert.equal(got.length, Object.keys(P.RANGES).length + 1,
    `★RANGES 에 축을 하나 더했는데 ★칸이 ${got.length} 다 — ★★그리개가 ★손으로 적은 명부를 쓴다(축이 늘어도 안 생긴다)`);
  assert.ok(got.includes(FAKE_AXIS), `★더한 축(${FAKE_AXIS})의 칸이 ★안 생겼다 — [${got.join(',')}]`);
  /* ★★글이 없는 축도 ★죽지 않는다 — ★`|| key` 폴백이 ★사람 글 자리에 ★키를 넣는다 */
  assert.ok(htmlWith(MORE, sec).includes(FAKE_AXIS), '★글 없는 축이 ★조용히 사라졌다');
});

test('P12 ★★«저장되는 축 전수»가 ★칸을 가진다 — ★normalize 가 돌려주는 키 ★하나도 빠짐없이', () => {
  /* ★★축의 ★참 명부 = ★`normalize` 가 ★돌려주는 ★키다(⛔RANGES «만»이 아니다 —
     ★`rot`·`colors`·`shapes`·`dist`·`preset`·`seed` ★여섯은 ★RANGES 에 ★없다).
     ★★그래서 ★RANGES 전수만 걸면 ★★여섯이 ★조용히 빠진다 — ★1차가 ★정확히 그렇게 ★줄었다. */
  const sec = mkSec({ cfg: { preset: P.KINDS[0], seed: 7 }, wrapHtml: '<svg></svg>' });
  const h = PANEL.secParticlesHTML(sec);

  /* ★«어느 칸이 ★그 축을 쥐나» — ★이 표가 ★둘째 명부가 ★되지 않게
     ★★아래에서 ★키집합을 ★`normalize` 와 ★등호로 ★묶는다 ⇒ ★축이 늘면 ★이 표부터 ★빨개진다. */
  const CONTROL_OF = {
    preset:    'data-fxpart-preset="',
    seed:      'id="sec-fxpart-seed"',
    count:     'data-fxpart-axis="count"',
    colors:    'id="sec-fxpart-colors"',
    shapes:    'id="sec-fxpart-shapes"',
    smin:      'data-fxpart-axis="smin"',
    smax:      'data-fxpart-axis="smax"',
    rot:       'id="sec-fxpart-rot"',
    dist:      'id="sec-fxpart-dist"',
    glow:      'data-fxpart-axis="glow"',
    spread:    'data-fxpart-axis="spread"',
    fxOpacity: 'data-fxpart-axis="fxOpacity"',
    jit:       'data-fxpart-axis="jit"',
  };
  const stored = Array.from(Object.keys(P.normalize({}))).sort();
  assert.ok(stored.length > 1, '★전제: normalize 가 키를 여럿 돌려준다');
  /* ★★표와 ★정본이 ★어긋나면 ★여기서 멈춘다 — ⛔표를 ★늙게 두지 않는다 */
  assert.deepEqual(Array.from(Object.keys(CONTROL_OF)).sort(), stored,
    '★★이 표가 ★normalize 키와 어긋난다 — ★축이 늘었거나 줄었다. ★표를 고치고 ★칸도 같이 지어라');
  /* ★★본 단언 — ★그 축마다 ★칸이 ★정말 있나 */
  const missing = stored.filter((k) => !h.includes(CONTROL_OF[k]));
  assert.deepEqual(missing, [],
    `★★저장되는 축에 ★칸이 ★없다 (${missing.join(',')}) — ★현빈이 ★못 만지는 축이다`);
});

test('P13 ★축 글이 ★RANGES 를 ★양방향으로 덮는다 — ★축이 늘면 ★여기가 빨개진다', () => {
  const LBL = globalThis.window.SEC_PARTICLES_AXIS_LABEL;
  assert.ok(LBL && typeof LBL === 'object', '★전제: 축 글 표를 창으로 냈다');
  const keys = Array.from(Object.keys(P.RANGES));
  assert.ok(keys.length > 0, '★전제: RANGES 가 비었다 — 아래 단언이 공집합으로 거짓통과한다');
  const missing = keys.filter((k) => !LBL[k]);
  const extra   = Array.from(Object.keys(LBL)).filter((k) => !keys.includes(k));
  assert.deepEqual(missing, [], `★축에 사람 글이 없다 — 패널에 키가 그대로 뜬다(${missing.join(',')})`);
  assert.deepEqual(extra, [], `★글 표에 ★없는 축이 있다 — 정본(RANGES)에서 빠진 뒤 글만 남았다(${extra.join(',')})`);
  /* ★분포 글도 같은 자 — ★`DISTS` 를 ★양방향으로 */
  const D = globalThis.window.SEC_PARTICLES_DIST_LABEL;
  const dk = Array.from(P.DISTS);
  assert.ok(dk.length > 0, '★전제: DISTS 가 비었다');
  assert.deepEqual(dk.filter((k) => !D[k]), [], '★분포에 사람 글이 없다');
  assert.deepEqual(Array.from(Object.keys(D)).filter((k) => !dk.includes(k)), [], '★글 표에 없는 분포가 있다');
});
