/* fx-particles-render — 섹션 배경 파티클의 «그림»(js/fx/particles-render.js)을 ★불러서 잰다.
 *
 * ★★가장 중요한 칸 = P1 ★배경색 계약 (현빈 2026-10-07 「배경색이 ★계속 바뀌면 ★안되는거 알지?」)
 *   ⇒ 「파티클은 섹션 배경색을 읽기만 하고 쓰지 않는다」를 ★두 쪽에서 잠근다:
 *      ⒜ PRESETS 어디에도 bg 가 없다  ⒝ 그려 준 SVG 에 ★상자를 덮는 사각형이 없다(투명 층)
 *   ★★양성대조는 ★지디 시안 파일에서 ★buildSVG 를 ★떠 와 돌린다 — 시안은 bg 사각형을 ★넣는다.
 *      ⇒ 그 출력에서 내 자가 ★빨개져야 자가 사는 증인이다. ⛔대조 꼴을 이 파일에 «글자로» 적지 않는다
 *        (적으면 내가 내 글자를 센다 — 명부를 재는 자의 함정).
 * ★«불러서» 잰다 — ⛔소스 정규식으로 판정하지 않는다(엉뚱한 줄에 속는다).
 * ⛔앱 0 · 네트워크 0 · DOM 0(vm 안에 window 대역 하나).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../');

/** 피검 대상 — FxSeed(공용 부품) 위에 ParticlesFx 를 싣는다. 둘 다 고전 스크립트다. */
function load() {
  const ctx = {}; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(readSrc(REPO, 'js/fx/seeded-random.js'), ctx);
  vm.runInContext(readSrc(REPO, 'js/fx/particles-render.js'), ctx);
  assert.equal(typeof ctx.FxSeed?.mulberry32, 'function', '★전제: 공용 부품 FxSeed 를 실제로 실었다');
  assert.equal(typeof ctx.ParticlesFx?.svg, 'function', '★전제: ParticlesFx 를 실제로 실었다');
  return ctx.ParticlesFx;
}

/* ── ★자 — 「상자를 덮는 사각형」이 들었나 ─────────────────────────────────
   파티클 조각의 rect 는 ★언제나 x·y 를 가진다(particles-render shapeSVG).
   배경 사각형은 ★x·y 가 없다(상자 전체) ⇒ 「x 없는 rect」 하나로 가른다.
   ★이 자는 아래 P1 에서 ★양성대조로 먼저 증명된다. */
const BG_RECT = /<rect(?![^>]*\sx=)[^>]*\swidth=/i;
const countNodes = (s) => (s.match(/<(?:circle|rect|path|polygon)\b/g) || []).length;

/* ── ★양성대조용 — 지디 시안(내 산출물 아님 · 읽기만)에서 ★그림 코드를 떠 온다 ──
   ⚠️시안은 IIFE 안에서 DOM 을 만지므로 통째로는 못 돈다 ⇒ ★필요한 조각만 중괄호 균형으로 떼어낸다. */
const MOCK = '/Users/a1/.claude/skills/지디/dashboard/artifacts/goditor-effects-particles.html';
function sliceFn(src, head) {
  const i = src.indexOf(head);
  if (i < 0) return null;
  let j = src.indexOf('{', i), d = 0;
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); }
  }
  return null;
}
function loadMockBuildSVG() {
  if (!fs.existsSync(MOCK)) return null;                       // 시안이 없으면 이 대조는 ★제 칸에서 SKIP
  const src = fs.readFileSync(MOCK, 'utf8');
  const need = ['function mulberry32(a)', 'function r1(v)', 'function shapeSVG(k,x,y,s,rot,c,op)', 'function buildSVG(st)'];
  const code = need.map((h) => sliceFn(src, h));
  if (code.some((c) => !c)) return null;
  const wh = src.match(/var W=(\d+),H=(\d+);/);
  if (!wh) return null;
  const ctx = { Math, JSON }; vm.createContext(ctx);
  vm.runInContext('var W=' + wh[1] + ',H=' + wh[2] + ';' + code.join('\n') + ';this.__b=buildSVG;this.__W=+W;this.__H=+H;', ctx);
  return ctx.__b ? { build: ctx.__b, W: ctx.__W, H: ctx.__H } : null;
}
const MOCK_ST = {
  seed: 20261006, on: true, count: 40, colors: ['#FFFFFF'], shapes: ['circle'],
  smin: 3, smax: 14, rot: true, dist: 'even', glow: 0, spread: 0, opacity: 100, jit: 0,
};

test('P0 전제 — 공용 부품·프리셋·상한이 판에 있다', () => {
  const F = load();
  assert.equal(F.MAX_COUNT, 320, '상한 320/섹션(지디 판정 2026-10-06 ㉣)');
  assert.deepEqual([...F.KINDS], ['star', 'gold', 'party', 'dust']);
  assert.deepEqual([...F.SHAPES], ['rect', 'ribbon', 'circle', 'star4', 'tri']);
  assert.equal(F.RANGES.count.max, F.MAX_COUNT, '범위 표와 상한이 «한 수»다');
});

test('P1a ★★배경색 계약 — PRESETS 어디에도 bg 가 없다 (프리셋은 파티클 값만 바꾼다)', () => {
  const F = load();
  const withBg = [...F.KINDS].filter((k) => Object.prototype.hasOwnProperty.call(F.PRESETS[k], 'bg'));
  assert.deepEqual(withBg, [], '프리셋에 bg 가 남아 있다 — 프리셋을 고르면 섹션 배경색이 바뀐다(현빈이 막은 것)');
  /* ★배경을 가리키는 ★어떤 키»도 없는지 — 「bg」만 막으면 background·bgColor 로 되살아난다 */
  const bgish = [...F.KINDS].flatMap((k) => [...Object.keys(F.PRESETS[k])].filter((x) => /^(bg|background)/i.test(x)));
  assert.deepEqual(bgish, [], '배경을 가리키는 키가 프리셋에 있다: ' + bgish.join(','));
});

test('P1b ★★배경색 계약 — 그려 준 SVG 에 «상자를 덮는 사각형»이 없다 (★양성대조 = 시안은 넣는다)', (t) => {
  const F = load();
  const mock = loadMockBuildSVG();
  /* ★양성대조 먼저 — 자가 ★히트를 내야 아래 「없다」가 증인이 된다.
     ★조건부 SKIP 은 ★제 칸을 따로 가진다(SKIP 이 형제 단언을 먹지 않게). */
  if (!mock) {
    t.diagnostic('⛔안 쟀다: 시안 파일을 못 떠 왔다 — 양성대조 없음, 아래 음성대조는 ★증인이 없다');
  } else {
    const mockSvg = mock.build({ ...MOCK_ST, bg: '#3B1E6E' });
    assert.match(mockSvg, /#3B1E6E/i, '★전제: 시안이 실제로 bg 를 그림에 썼다');
    assert.ok(BG_RECT.test(mockSvg), '⛔★양성대조가 죽었다 — 자가 시안의 배경 사각형을 못 잡는다');
    assert.ok(countNodes(mockSvg) > MOCK_ST.count, '★전제: 시안 출력엔 조각 + 배경 사각형이 들었다');
  }
  /* ★음성대조 — 같은 자로 내 출력을 잰다 */
  const mine = F.svg({ preset: 'star', seed: 20261006, count: 40, colors: ['#FFFFFF'], shapes: ['circle'],
    glow: 0, spread: 0, jit: 0, w: 540, h: 700, filterId: 'pfx-t1' });
  assert.ok(!BG_RECT.test(mine), '파티클 층이 상자를 덮는 사각형을 그렸다 — 섹션 배경색을 가린다');
  assert.equal(countNodes(mine), 40, '조각 수가 갯수와 다르다(배경 사각형이 섞였거나 빠뜨렸다)');
  /* ★「색을 ★어디서도 ★안 받는다」 — 배경색을 넘겨도 출력에 안 샌다 */
  const probe = F.svg({ preset: 'star', seed: 1, count: 5, colors: ['#FFFFFF'], shapes: ['circle'],
    glow: 0, spread: 0, jit: 0, w: 100, h: 100, filterId: 'pfx-t2', bg: '#3B1E6E', background: '#3B1E6E', bgColor: '#3B1E6E' });
  assert.ok(!/3B1E6E/i.test(probe), '배경색으로 준 값이 그림에 샜다');
});

test('P1c ★★프리셋을 바꿔도 «파티클 값만» 바뀐다 — 넷을 전수로', () => {
  const F = load();
  const keys = new Set();
  for (const k of F.KINDS) for (const x of Object.keys(F.normalize({ preset: k }))) keys.add(x);
  /* ★정본 = normalize 가 내는 칸들. 배경을 가리키는 칸이 ★하나도 없어야 한다. */
  const bgish = [...keys].filter((x) => /^(bg|background)/i.test(x));
  assert.deepEqual(bgish, [], '저장 꼴에 배경 칸이 있다: ' + bgish.join(','));
  assert.deepEqual([...keys].sort(), ['colors', 'count', 'dist', 'fxOpacity', 'glow', 'jit', 'preset', 'rot', 'seed', 'shapes', 'smax', 'smin', 'spread'],
    '저장 칸 명부가 바뀌었다 — 패널·직렬화와 같이 보라');
});

test('P2 ★시드 결정성 — 같은 시드 = 같은 글자 · 다른 시드 = 다른 글자', () => {
  const F = load();
  const mk = (seed) => F.svg({ preset: 'party', seed, w: 860, h: 600, filterId: 'pfx-d' });
  const a = mk(12345), b = mk(12345), c = mk(99991);
  assert.ok(a.length > 500, '★전제: 그림이 있다');
  assert.equal(b, a, '같은 시드인데 글자가 다르다 — 그림 안에 시드 아닌 난수가 섞였다');
  assert.notEqual(c, a, '다른 시드인데 글자가 같다 — 시드가 그림에 안 닿는다');
});

test('P3 ★상한 320 — 넘으면 «거절이 아니라 320 까지만 그린다»', () => {
  const F = load();
  const big = F.svg({ preset: 'party', seed: 7, count: 1000, glow: 0, spread: 0, w: 860, h: 600, filterId: 'pfx-c' });
  assert.equal(countNodes(big), 320, '상한에서 안 잘렸다(또는 거절해 0이 됐다)');
  assert.equal(F.normalize({ count: 1000 }).count, 320);
  assert.equal(F.normalize({ count: -5 }).count, 0, '음수는 0 으로');
  /* ★음성대조 — 상한 아래는 그대로 그린다(자가 «언제나 320» 이 아니다) */
  assert.equal(countNodes(F.svg({ preset: 'party', seed: 7, count: 11, glow: 0, spread: 0, w: 860, h: 600, filterId: 'pfx-c2' })), 11);
});

test('P4 ★필터 id 는 호출자가 준다 — 섹션이 둘이면 안 겹친다(시안의 고정 id 함정)', () => {
  const F = load();
  const a = F.svg({ preset: 'star', seed: 1, count: 10, glow: 60, spread: 8, w: 860, h: 600, filterId: 'pfx-secA' });
  const b = F.svg({ preset: 'star', seed: 1, count: 10, glow: 60, spread: 8, w: 860, h: 600, filterId: 'pfx-secB' });
  assert.match(a, /<filter id="pfx-secA"/, '준 id 를 안 썼다');
  assert.match(a, /filter="url\(#pfx-secA\)"/, '후광이 그 필터를 안 쓴다');
  assert.match(b, /<filter id="pfx-secB"/);
  assert.ok(!/pfx-secA/.test(b), '둘째 섹션이 첫 섹션의 필터 id 를 쓴다 — 문서 전역 id 가 겹친다');
  /* ★음성대조: 후광이 꺼지면 필터를 아예 안 만든다 */
  const off = F.svg({ preset: 'star', seed: 1, count: 10, glow: 0, spread: 8, w: 860, h: 600, filterId: 'pfx-secC' });
  assert.ok(!/<filter/.test(off), '세기 0 인데 필터를 만들었다');
});

test('P5 ★후광 — 3겹이고, 영역이 퍼짐에서 «계산»된다(⛔150 을 박지 않는다)', () => {
  const F = load();
  const narrow = F.svg({ preset: 'dust', seed: 3, count: 10, glow: 70, spread: 4, w: 860, h: 600, filterId: 'pfx-n' });
  const wide   = F.svg({ preset: 'dust', seed: 3, count: 10, glow: 70, spread: 20, w: 860, h: 600, filterId: 'pfx-w' });
  assert.equal((narrow.match(/<feGaussianBlur/g) || []).length, 3, '후광 3겹이 아니다');
  const xOf = (s) => +s.match(/<filter[^>]*\sx="(-?\d+)"/)[1];
  assert.ok(xOf(wide) < xOf(narrow), '퍼짐을 키웠는데 필터 영역이 안 넓어졌다 — 번짐이 잘린다');
  /* ★세기는 «진하기»로만 — 같은 퍼짐에서 반경(stdDeviation)이 안 바뀌어야 두 축이 갈려 있다 */
  const sd = (s) => s.match(/stdDeviation="([\d.]+)"/)[1];
  const g30 = F.svg({ preset: 'dust', seed: 3, count: 10, glow: 30, spread: 8, w: 860, h: 600, filterId: 'pfx-g1' });
  const g90 = F.svg({ preset: 'dust', seed: 3, count: 10, glow: 90, spread: 8, w: 860, h: 600, filterId: 'pfx-g2' });
  assert.equal(sd(g90), sd(g30), '세기가 반경까지 바꿨다 — 두 축이 묶였다(글로우가 겪은 그 결함)');
  const op = (s) => s.match(/class="sec-fxpart-halo"[^>]*opacity="([\d.]+)"/)[1];
  assert.ok(+op(g90) > +op(g30), '세기를 올렸는데 후광이 진해지지 않았다');
});

test('P6 ⛔두 내보내기 경로에서 죽는 기법을 쓰지 않는다 — CSS filter · mix-blend-mode 0건', () => {
  const F = load();
  const s = F.svg({ preset: 'star', seed: 5, count: 30, glow: 80, spread: 12, w: 860, h: 600, filterId: 'pfx-x' });
  assert.ok(!/mix-blend-mode/i.test(s), 'mix-blend-mode 는 html2canvas 에서 죽는다');
  assert.ok(!/drop-shadow|filter:\s/i.test(s), 'CSS filter 는 html2canvas 에서 죽는다');
  assert.match(s, /color-interpolation-filters="sRGB"/, '선례(glow-render)와 같은 색 보간을 안 썼다 — 두 경로가 갈릴 수 있다');
});

test('P7 ★상자 크기 = viewBox — 입자가 찌그러지지 않는다', () => {
  const F = load();
  for (const [w, h] of [[860, 600], [780, 1234], [100, 100]]) {
    const s = F.svg({ preset: 'star', seed: 2, count: 5, w, h, filterId: 'pfx-v' });
    assert.match(s, new RegExp('viewBox="0 0 ' + w + ' ' + h + '"'), `viewBox 가 상자(${w}×${h})와 다르다`);
    assert.ok(!/preserveAspectRatio="none"/.test(s), 'none 으로 늘이면 별이 타원이 된다');
  }
});

test('P8 normalize — 쓰레기 입력에도 그림이 난다(저장본이 낡았거나 사람이 손으로 적었어도)', () => {
  const F = load();
  const n = F.normalize({ preset: '없는프리셋', count: 'abc', colors: [], shapes: ['없는모양'], smin: 50, smax: 5, dist: 'zzz', glow: 999, jit: -9 });
  assert.equal(n.preset, 'star', '모르는 프리셋은 기본으로');
  /* ★vm 안에서 만든 배열은 ★다른 realm 이다 — deepStrictEqual 이 prototype 으로 갈린다 ⇒ 호스트 배열로 떠서 견준다 */
  assert.deepEqual([...n.shapes], ['circle'], '모르는 모양만 주면 원으로 떨어진다');
  assert.ok(n.smin <= n.smax, '최소가 최대보다 크면 바꿔 끼운다');
  assert.equal(n.glow, 100, '범위를 넘으면 자른다');
  assert.equal(n.jit, 0);
  assert.ok(F.svg({ ...n, w: 860, h: 600, filterId: 'pfx-z' }).length > 100, '그림이 안 났다');
});

test('P9 lum — 못 읽으면 ★null(「검정」과 구분한다) · 읽히면 0~1', () => {
  const F = load();
  assert.equal(F.lum('뭐지'), null, '못 읽은 것을 0(검정)으로 돌려주면 호출자가 «어둡다»로 오판한다');
  assert.equal(F.lum(''), null);
  assert.ok(Math.abs(F.lum('#000000') - 0) < 1e-9);
  assert.ok(Math.abs(F.lum('#ffffff') - 1) < 1e-9);
  assert.ok(Math.abs(F.lum('rgba(255,255,255,0.5)') - 1) < 1e-9, 'rgba 도 읽는다(알파는 휘도가 아니다)');
});
