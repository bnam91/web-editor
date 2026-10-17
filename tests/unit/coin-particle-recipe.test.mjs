/* coin-particle-recipe — 섹션 파티클의 «코인 레시피» (1012t1 I1-B · 프로토 3c3a25bb 를 정식으로).
 *
 * ★무엇을 잠그나
 *   R1 모양 coin — 코인 «그림»(CoinFx.draw)이 갯수만큼 난다 · id 가 섹션 필터 id 아래이고 안 겹친다 · 같은 시드 = 같은 글자
 *   R2 ★음성대조 — CoinFx 가 없는 판에서는 원으로 떨어지고 콘솔에 한 번 적는다(그리개를 안 부르면 R1 이 빨개진다는 증인)
 *   R3 옛 그림 불변 — 다섯 모양만 쓰는 설정은 CoinFx 를 실어도 글자가 한 자도 안 바뀐다
 *   R4 색 한 칸 → 생김새(lookFromColor) · 한 닢 그리기(draw)
 *   R5 레시피 값 — 모양 coin · 금 «하나»(CoinFx 대표 금색 · 은 없음) · 후광 0 · smax ≤ 크기 상한 · ⛔프리셋 명부(KINDS)는 그대로 넷
 *   R6 ★⒟ 무늬번호는 그대로 — 이미 켜진 섹션에 레시피를 쓰면 seed 불변(누르기 전 번호를 먼저 찍는다) · 꺼진 섹션은 새로 뽑는다
 *   R7 입구가 «한 자리»에서 쓰기·그리기·기록을 한다 — writeParticles·applySectionParticles·pushHistory 를 한 번씩 · 섹션이 아니면 아무것도 안 쓴다
 *   R8 배선 — index.html 에 입구 스크립트 1번 · 패널 단추(id·data·title) · 단추는 프리셋 속성이 없다 · 프로토 이름이 정식 코드에 없다
 * ⛔앱 0 · DOM 0(vm 안에 window 대역 하나).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../');

function load({ coin = true, errs = null } = {}) {
  const ctx = errs ? { console: { error: (...a) => errs.push(a.map(String).join(' ')) } } : {};
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(readSrc(REPO, 'js/fx/seeded-random.js'), ctx);
  if (coin) vm.runInContext(readSrc(REPO, 'js/fx/coin-draw.js'), ctx);
  vm.runInContext(readSrc(REPO, 'js/fx/particles-render.js'), ctx);
  vm.runInContext(readSrc(REPO, 'js/coin-particle-recipe.js'), ctx);
  return ctx;
}
const CFG = { preset: 'gold', shapes: ['coin'], colors: ['#f5c542'], count: 14, smin: 28, smax: 90, glow: 0, spread: 0, jit: 0, seed: 20261014, w: 860, h: 600, filterId: 'pfx-sec1' };
const coinGroups = (s) => (s.match(/<g transform="translate\([^)]*\)"><g transform="rotate\(0\)"><defs><linearGradient id="[^"]*-c\d+s"/g) || []).length;
const ids = (s) => [...s.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);

test('R1 모양 coin — 코인 그림이 갯수만큼 · id 가 섹션 필터 id 아래 · 결정성', () => {
  const W = load();
  const s = W.ParticlesFx.svg(CFG);
  assert.equal(coinGroups(s), 14, '코인이 갯수만큼 안 그려졌다');
  assert.equal((s.match(/<ellipse rx="[^"]+" ry="[^"]+" fill="url\(#pfx-sec1-c\d+f\)"\/>/g) || []).length, 14, '앞면 타원이 코인마다 하나');
  assert.ok(!/<circle\b/.test(s), '코인 자리에 원이 났다');
  assert.ok(s.includes(W.CoinFx.PALETTES.gold.face[1]) && !s.includes(W.CoinFx.PALETTES.silver.face[1]), '금 표로 그려진다');
  const I = ids(s);
  assert.equal(new Set(I).size, I.length, '같은 id 가 두 번 났다');
  assert.ok(I.length >= 14 * 8 && I.every((x) => x.startsWith('pfx-sec1-c')));
  assert.deepEqual(ids(W.ParticlesFx.svg({ ...CFG, filterId: 'pfx-sec2' })).filter((x) => I.includes(x)), [], '섹션 둘의 id 가 겹친다');
  assert.equal(W.ParticlesFx.svg(CFG), s);
  assert.notEqual(W.ParticlesFx.svg({ ...CFG, seed: 20261015 }), s);
  /* 움직이는 판 — 꼬리표가 코인의 바깥 <g> 에 달린다(움직이개가 그 transform 을 덮어쓴다) */
  assert.equal((W.ParticlesFx.svg({ ...CFG, speed: 40 }).match(/<g[^>]* data-fxp="[^"]+"><g transform="translate\(/g) || []).length, 14);
  assert.equal((s.match(/data-fxp=/g) || []).length, 0);
});

test('R2 ★음성대조 — CoinFx 가 없는 판에서는 원으로 떨어지고 콘솔에 한 번 적는다', () => {
  const errs = [];
  const W = load({ coin: false, errs });
  const s = W.ParticlesFx.svg(CFG);
  assert.equal(coinGroups(s), 0, '★자가 죽었다 — CoinFx 가 없는데 코인 그림을 셌다');
  assert.equal((s.match(/<circle\b/g) || []).length, 14);
  W.ParticlesFx.svg(CFG);
  assert.equal(errs.filter((e) => e.includes('CoinFx')).length, 1, '콘솔에 한 번만');
});

test('R3 옛 그림 불변 — 다섯 모양만 쓰는 설정은 CoinFx 를 실어도 글자가 같다', () => {
  const A = load({ coin: false }), B = load();
  for (const preset of ['star', 'gold', 'party', 'dust']) for (const extra of [{}, { speed: 40, spin: 90, blur: 4 }, { glow: 60, spread: 8 }]) {
    const c = { preset, seed: 7, count: 30, w: 860, h: 420, filterId: 'pfx-i', ...extra };
    assert.equal(B.ParticlesFx.svg(c), A.ParticlesFx.svg(c), `${preset} ${JSON.stringify(extra)}: CoinFx 를 실었더니 그림이 달라졌다`);
  }
});

test('R4 색 한 칸 → 생김새 · 한 닢 그리기', () => {
  const { CoinFx: C } = load();
  assert.deepEqual({ ...C.lookFromColor('#F5C542') }, { metal: 'gold' });
  assert.deepEqual({ ...C.lookFromColor(C.baseColors('silver').face) }, { metal: 'silver' });
  assert.deepEqual({ ...C.lookFromColor('#2D6FE8') }, { metal: 'custom', face: '#2d6fe8', side: '#204ea2' });
  for (const bad of ['', 'red', null, undefined, 12]) assert.deepEqual({ ...C.lookFromColor(bad) }, { metal: 'gold' });
  const g = C.draw({ idPrefix: 'p-c3', x: 120.5, y: 40, d: 90, tilt: 30, dir: 0, extRot: 15, metal: 'gold' });
  assert.ok(g.startsWith('<g transform="translate(120.5 40)"><g transform="rotate(0)">') && !/<svg|viewBox/.test(g));
  assert.ok(g.includes('<ellipse rx="45" ry="38.97" fill="url(#p-c3f)"/>'), '지름 90 이 앞면 타원에 안 들어갔다');
  /* 칩 색을 바꾸면 그 색의 코인 */
  const blue = load().ParticlesFx.svg({ ...CFG, colors: ['#2D6FE8'] });
  assert.ok(blue.includes('#2d6fe8') && !blue.includes(C.PALETTES.gold.face[1]));
});

test('R5 레시피 값 — 모양 coin · 금 하나 · 후광 0 · 크기 상한 안 · ⛔프리셋 명부는 그대로', () => {
  const W = load();
  const r = W.coinParticleRecipe();
  assert.deepEqual(JSON.parse(JSON.stringify(r)), { preset: 'gold', shapes: ['coin'], count: 14, smin: 28, smax: 90, rot: true, dist: 'even',
    glow: 0, spread: 0, jit: 0, fxOpacity: 100, speed: 0, blur: 0, spin: 0, colors: ['#f5c542'] });
  assert.equal(r.colors[0], W.CoinFx.baseColors('gold').face, '레시피 금색이 CoinFx 의 금 대표색이 아니다');
  assert.ok(r.smax <= W.ParticlesFx.RANGES.smax.max);
  assert.deepEqual(JSON.parse(JSON.stringify(W.ParticlesFx.normalize(r))).shapes, ['coin'], 'normalize 가 모양 coin 을 버렸다');
  assert.deepEqual([...W.ParticlesFx.KINDS], ['star', 'gold', 'party', 'dust'], '프리셋 명부가 바뀌었다 — 코인은 프리셋이 아니다');
  assert.ok(!W.ParticlesFx.PRESETS.coin);
});

/* 입구를 «대역 창»에서 부른다 — 쓰기·그리기·기록이 몇 번 불렸나 센다 */
function harness(initial) {
  const W = load();
  const calls = { write: 0, apply: 0, push: [], save: 0, newSeed: 0 };
  const ds = { ...(initial || {}) };
  const sec = { dataset: ds, classList: { contains: (c) => c === 'section-block' } };
  /* 저장 꼴은 effects-particles.js 의 그 셋을 흉내 낸다(JSON 통째 + seed 따로) */
  W.writeParticles = (d, cfg) => { calls.write++; const { seed, ...rest } = cfg; d.fxParticles = JSON.stringify(rest); d.fxParticlesSeed = String((seed >>> 0) || 1); };
  W.readParticles = (d) => { if (!d.fxParticles) return null; const raw = JSON.parse(d.fxParticles); return W.ParticlesFx.normalize({ ...raw, seed: parseInt(d.fxParticlesSeed, 10) }); };
  W.applySectionParticles = () => { calls.apply++; return true; };
  W.pushHistory = (l) => calls.push.push(l);
  W.scheduleAutoSave = () => { calls.save++; };
  const ns = W.FxSeed.newSeed; W.FxSeed = { ...W.FxSeed, newSeed: () => { calls.newSeed++; return 4242; } };
  return { W, sec, ds, calls, ns };
}

test('R6 ★⒟ 무늬번호는 그대로 — 켜진 섹션은 seed 불변 · 꺼진 섹션은 새로 뽑는다', () => {
  /* 켜진 섹션 — 누르기 전 무늬번호를 먼저 찍는다 */
  const on = harness();
  on.W.writeParticles(on.ds, { preset: 'star', seed: 987654321, count: 40 });
  const before = on.W.readParticles(on.ds).seed;
  assert.equal(before, 987654321, '★전제: 누르기 전 무늬번호');
  assert.equal(on.W.applyCoinParticleRecipe(on.sec), true);
  const after = on.W.readParticles(on.ds);
  assert.equal(after.seed, before, '레시피를 눌렀더니 무늬번호가 바뀌었다');
  assert.deepEqual([after.shapes, on.calls.newSeed], [['coin'], 0], '레시피가 쓰였고 새 번호는 안 뽑았다');
  /* 꺼진 섹션 — 새 번호 하나 */
  const off = harness();
  assert.equal(off.W.applyCoinParticleRecipe(off.sec), true);
  assert.deepEqual([off.W.readParticles(off.ds).seed, off.calls.newSeed], [4242, 1]);
  /* 두 번 눌러도 번호 그대로 */
  off.W.applyCoinParticleRecipe(off.sec);
  assert.equal(off.W.readParticles(off.ds).seed, 4242);
});

test('R7 입구 한 자리 — 쓰기·그리기·기록을 한 번씩 · 섹션이 아니면 아무것도 안 쓴다', () => {
  const h = harness();
  h.W.applyCoinParticleRecipe(h.sec);
  assert.deepEqual([h.calls.write, h.calls.apply, h.calls.push, h.calls.save], [1, 1, ['코인 레시피'], 1]);
  const n = harness();
  let hint = 0; n.W.showNoSelectionHint = () => { hint++; };
  for (const bad of [null, undefined, {}, { classList: { contains: () => false }, dataset: {} }]) assert.equal(n.W.applyCoinParticleRecipe(bad), false);
  assert.deepEqual([n.calls.write, n.calls.apply, n.calls.push.length, hint], [0, 0, 0, 4]);
});

test('R8 배선 — 입구 스크립트 1번 · 패널 단추 · 프리셋 속성 없음 · 프로토 이름 없음', () => {
  const html = readSrc(REPO, 'index.html');
  assert.equal((html.match(/<script src="js\/coin-particle-recipe\.js"><\/script>/g) || []).length, 1);
  assert.ok(html.indexOf('js/fx/particles-render.js') < html.indexOf('js/coin-particle-recipe.js'), '입구는 그리개 뒤에 실린다');
  assert.ok(!/proto-coin-particles|protoCoinParticles/.test(html), 'index.html 에 프로토 이름이 남았다');
  const pan = readSrc(REPO, 'js/props/prop-section-particles.js');
  /* ★금지 단언 — 레시피 단추의 «여는 태그 통째»에 프리셋 속성이 있나. 옛 자(/id="sec-fxpart-recipe"[^>]*data-fxpart-preset/)는
     속성이 id «앞»에 오면 못 잡았다(아래 반례 ⑵). 그래서 여는 태그를 먼저 떼고 그 안을 본다. */
  const recipeHasPreset = (src) => [...src.matchAll(/<button\b[^>]*>/g)].some((m) => /\bid="sec-fxpart-recipe"/.test(m[0]) && /\bdata-fxpart-preset\b/.test(m[0]));
  /* 반례 한 쌍(걸려야 산 자다) — ⑴ 속성이 id 뒤 ⑵ 속성이 id 앞 · 그리고 음성: 프리셋 칩(다른 단추)의 속성은 안 걸린다 */
  assert.equal(recipeHasPreset('<button class="prop-align-btn" id="sec-fxpart-recipe" data-fxpart-preset="coin">x</button>'), true, '★자가 죽었다 — 반례 ⑴(id 뒤)을 못 잡는다');
  assert.equal(recipeHasPreset('<button data-fxpart-preset="coin" class="prop-align-btn"\n  id="sec-fxpart-recipe">x</button>'), true, '★자가 죽었다 — 반례 ⑵(id 앞 · 줄바꿈)를 못 잡는다');
  assert.equal(recipeHasPreset('<button id="sec-fxpart-recipe" data-fxpart-recipe="coin">x</button><button data-fxpart-preset="gold">y</button>'), false, '★자가 너무 넓다 — 이웃 프리셋 칩을 레시피 단추로 읽었다');
  assert.equal(recipeHasPreset(pan), false, '레시피 단추에 프리셋 속성이 붙었다');
  const btn = /<button class="([^"]+)" id="sec-fxpart-recipe" data-fxpart-recipe="coin"\s+title="코인 레시피 — 모양·갯수·크기·색을 3D 코인 묶음으로 바꿉니다\(무늬번호는 그대로\)">코인 레시피<\/button>/.exec(pan);
  assert.ok(btn, '패널에 코인 레시피 단추(id·data·title)가 없다');
  assert.equal(btn[1], 'prop-align-btn', '단추 꼴이 프리셋 칩과 같은 class 가 아니다');
  assert.ok(/\$\('sec-fxpart-recipe'\)\?\.addEventListener\('click', \(\) => \{\s*window\.applyCoinParticleRecipe\?\.\(sec\);/.test(pan), '단추가 입구를 안 부른다');
  for (const f of ['js/fx/particles-render.js', 'js/props/prop-section-particles.js', 'js/coin-particle-recipe.js'])
    assert.ok(!/protoCoinParticles|proto-coin-particles\.js'|I1 프로토/.test(readSrc(REPO, f).replace(/프로토 3c3a25bb[^\n]*/g, '')), `${f} 에 프로토 이름이 남았다`);
});
