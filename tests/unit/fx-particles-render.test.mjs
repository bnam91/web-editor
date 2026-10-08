/* fx-particles-render — 섹션 배경 파티클의 «그림»(js/fx/particles-render.js)을 ★불러서 잰다.
 *
 * ★★가장 중요한 칸 = P1 ★배경색 계약 (현빈 2026-10-07 「배경색이 ★계속 바뀌면 ★안되는거 알지?」)
 *   ⇒ 「파티클은 섹션 배경색을 읽기만 하고 쓰지 않는다」를 ★두 쪽에서 잠근다:
 *      ⒜ PRESETS 어디에도 bg 가 없다  ⒝ 그려 준 SVG 에 ★상자를 덮는 사각형이 없다(투명 층)
 *   ★★양성대조는 ★지디 시안 파일에서 ★buildSVG 를 ★떠 와 돌린다 — 시안은 bg 사각형을 ★넣는다.
 *      ⇒ 그 출력에서 내 자가 ★빨개져야 자가 사는 증인이다. ⛔대조 꼴을 이 파일에 «글자로» 적지 않는다
 *        (적으면 내가 내 글자를 센다 — 명부를 재는 자의 함정).
 * ★«불러서» 잰다 — ⛔소스 정규식으로 판정하지 않는다(엉뚱한 줄에 속는다).
 *
 * ★★★이 효과는 «정지 한 장면»이다 — 그래서 ★이 검사도 ★정지 프레임으로 잰다.
 *   `svg()` 는 ★순수 함수다: (시드 ＋ 설정 ＋ 상자 크기) 하나만 받아 ★글자를 돌려준다. 시간이 안 들어간다.
 *   ⇒ ⛔`requestAnimationFrame` 을 기다려 재지 마라. ★그런 검사는 ★부하에 «값을 잃는다»
 *     (2026-10-07 규율: ★부하는 느리게만이 아니라 ★틀리게도 만든다 — 고정 대기 위에 선 검사가 값을 잃었다).
 *   ⚠️＋현빈이 지디의 패닝 시안을 보고 ★「이건 왜 ★영상으로 나왔니?」라 물었다(2026-10-07)
 *     ⇒ ★움직이는 미리보기는 ★「영상」으로 읽힌다. ★우리 것은 ★주사위를 굴린 ★한 프레임이다.
 *     ⇒ ★앞으로 지을 DOM 수트도 ★같다: ★시드를 고정하고 ★좌표·픽셀을 단언하라. ⛔프레임을 기다리지 마라.
 * ⛔앱 0 · 네트워크 0 · DOM 0(vm 안에 window 대역 하나).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../');

/** 피검 대상 — FxSeed(공용 부품) 위에 ParticlesFx 를 싣는다. 둘 다 고전 스크립트다. */
function load() { return loadWithCap(null); }

/** ★상한을 «다른 값으로» 둔 판을 싣는다 — P0b 가 「프리셋이 상한을 따라오나」를 재는 길.
 *  ⛔사본을 만들지 않는다(글자를 메모리에서 갈아 vm 에 싣는다) · cap=null 이면 ★판 그대로. */
function loadWithCap(cap, errSink) {
  const src = readSrc(REPO, 'js/fx/particles-render.js');
  /* ★★닻 — ⛔제품의 상한 값이 바뀌면 ★이 줄도 ★같이 고쳐야 한다(아래 전제 단언이 그 말을 한다).
     ★2026-10-07 `= 60;` → ★★2026-10-08 `= 120;`(현빈 「120개까지하자 최대」).
     ★★왜 이 줄이 위험한가: ★닻이 ★죽으면 ★치환이 ★전부 실패하고 ★★«측정 0» 이
       ★★«결과처럼 생긴 출력»로 ★나온다(★2026-10-08 다른 레인이 ★정확히 그 사고를 냈다). */
  const ANCHOR = 'const MAX_COUNT = 120;';
  let s = src;
  if (cap != null) {
    assert.ok(src.includes(ANCHOR), `★전제: 치환 닻을 찾았다 — 「${ANCHOR}」(상한 값이 바뀌면 이 줄도 고쳐라)`);
    s = src.replace(ANCHOR, `const MAX_COUNT = ${cap};`);
    /* ★★«치환이 ★안 먹었다»와 ★«치환할 ★필요가 없었다»를 ★가린다 (★지디 2026-10-08 실측 교훈).
       ★그가 이 자를 베껴 쓰며 `cap` 에 ★제품과 ★같은 수를 넣었더니 ★`s === src` 가 ★참이 되어
       ★★«거짓 경보»가 났다. ⇒ ★«이미 그 값이면» ★치환이 ★필요 없었던 것이라 ★정상이다. */
    assert.ok(s !== src || src.includes(`const MAX_COUNT = ${cap};`),
      `⛔치환이 안 먹었다 — 자가 죽었다(닻 「${ANCHOR}」 · cap ${cap})`);
  }
  /* ★console 은 ★errSink 가 있을 때만 넣는다 — ★「조용히 실패했나」를 재는 칸이 ★제 전제를 «세우는» 길이다.
     ⚠️★이것이 없어서 P11 이 한 번 ★빨갰다 — 제품은 `typeof console !== 'undefined'` 가드를 ★쓰므로
       ★vm 안에 console 이 없으면 ★진짜로 ★안 부른다. ★호스트 console 을 대역해도 ★vm 은 ★못 본다.
     ⇒ ★「검사는 ★자기 전제를 ★단언해야 한다」의 자리였다 — 「콘솔을 센다」면 ★「콘솔이 그 판에 있나」부터. */
  const ctx = errSink ? { console: { error: (...a) => errSink.push(a.map(String).join(' ')) } } : {};
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(readSrc(REPO, 'js/fx/seeded-random.js'), ctx);
  vm.runInContext(s, ctx);
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
  /* ★★이 파일에서 「60」을 ★글자로 적는 자리는 ★여기 ★하나뿐이다 — 그래야 ★값이 잠긴다.
     (⛔다른 칸까지 60 을 박으면 명부가 둘이고, ⛔전부 F.MAX_COUNT 로 쓰면 ★항등식이라 아무것도 안 잠근다.
      ⇒ ★여기서 ★값을, 다른 칸에서 ★동작을 잠근다. 지디 2026-10-07 「상수 하나에서 둘이 파생돼야 한다」의 쓰임.) */
  assert.equal(F.MAX_COUNT, 120,
    '상한 120/섹션 — ★현빈 2026-10-08 「60개 말고 ★120개까지하자 최대」'
    + ' (★옛 값: 320 → 60(2026-10-07 「개수는 상한 60개로 하자」) → ★120)');
  assert.deepEqual([...F.KINDS], ['star', 'gold', 'party', 'dust']);
  assert.deepEqual([...F.SHAPES], ['rect', 'ribbon', 'circle', 'star4', 'tri']);
  assert.equal(F.RANGES.count.max, F.MAX_COUNT, '범위 표와 상한이 «한 수»다');
});

test('P0b ★★프리셋 count 가 «상한을 참조»한다 — 상한을 바꾼 판에서 ★따라오나', () => {
  /* ★★이 칸은 한 번 «버려지고» 다시 세워졌다(2026-10-07) — 그 역사를 남긴다:
       ⑴ 처음: 「프리셋 count ≤ 상한」. ★상한이 320→60 으로 내려오자 셋(90·70·130)이 넘어 ★빨개졌고
          그래서 이 칸이 생겼다 — ★실제로 사고를 잡았다.
       ⑵ 현빈 확정 「다 60 으로」(2026-10-07) ⇒ 프리셋 count 를 ★`MAX_COUNT` 참조로 바꿨다.
          ⇒ ★★그 순간 「≤ 상한」도 「＝ 상한」도 ★★«항상 참»이 됐다 — ★참조라서 갈릴 수가 없다.
          ⇒ ★내가 건 단언이 ★아무것도 안 잠근다(⛔그대로 두면 ★가짜 초록이다).
       ⑶ ⇒ ★그 칸을 ★버리고 ★«구조가 섰나»를 잰다: ★★상한을 ★다른 값으로 둔 판에서 ★프리셋이 ★따라오나.
          ★이건 항등식이 아니다 — ★「참조한다」와 「60 을 박았다」는 ★다른 판이고, 그 둘을 ★갈라 준다.
     ⇒ ★★「행위로 못 재는 자리는 ★구조로 잠가라」의 짝: ★구조로 잠갔으면 ★그 구조를 ★재라. */
  const CAP_PROBE = 7;                             // ⛔60 과 겹치지 않는 아무 수
  const M = loadWithCap(CAP_PROBE);
  assert.equal(M.MAX_COUNT, CAP_PROBE, '★전제: 치환이 먹어 그 판의 상한이 바뀌었다(자가 살아 있다)');
  for (const k of M.KINDS) {
    assert.equal(M.PRESETS[k].count, CAP_PROBE,
      `${k}: 상한을 ${CAP_PROBE} 로 둔 판에서 프리셋 count 가 안 따라왔다(${M.PRESETS[k].count}) — 수를 손으로 박았다`);
  }
  /* ★음성대조 — 원래 판은 ★치환 판과 ★다르다(치환이 «전역으로» 먹은 게 아니다) */
  const F = load();
  assert.notEqual(F.MAX_COUNT, CAP_PROBE, '⛔음성대조 실패 — 원래 판까지 바뀌었다');
  for (const k of F.KINDS) assert.equal(F.PRESETS[k].count, F.MAX_COUNT, `${k}: 원래 판에서 상한과 다르다`);
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
  /* ★2026-10-09 ★패닝 1차 — ★speed·blur·spin 이 ★늘었다. ⛔옛 열셋은 ★하나도 ★안 지웠다 */
  assert.deepEqual([...keys].sort(), ['blur', 'colors', 'count', 'dist', 'fxOpacity', 'glow', 'jit', 'preset',
                                      'rot', 'seed', 'shapes', 'smax', 'smin', 'speed', 'spin', 'spread'],
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

test('P3 ★상한 — 넘으면 «거절이 아니라 상한까지만 그린다»', () => {
  const F = load();
  /* ★여기선 수를 ★상수에서 받는다 — ★동작을 잠근다(값은 P0 이 글자로 잠갔다). */
  const CAP = F.MAX_COUNT;
  const big = F.svg({ preset: 'party', seed: 7, count: 1000, glow: 0, spread: 0, w: 860, h: 600, filterId: 'pfx-c' });
  assert.equal(countNodes(big), CAP, '상한에서 안 잘렸다(또는 거절해 0이 됐다)');
  assert.equal(F.normalize({ count: 1000 }).count, CAP);
  assert.equal(F.normalize({ count: -5 }).count, 0, '음수는 0 으로');
  /* ★음성대조 — 상한 아래는 그대로 그린다(자가 «언제나 상한» 이 아니다) */
  assert.equal(countNodes(F.svg({ preset: 'party', seed: 7, count: 11, glow: 0, spread: 0, w: 860, h: 600, filterId: 'pfx-c2' })), 11);
});

test('P10 ★estimateNodes 가 «실제로 나온 요소 수»와 맞다 — 안내 문구의 수가 여기서 나온다', () => {
  const F = load();
  /* ⛔공식을 믿지 않는다 — ★svg() 를 돌려 ★여는 태그를 세고 ★견준다(두 독립 경로 · 항등식 아님). */
  const tags = (s) => (s.match(/<[a-zA-Z]/g) || []).length;
  const cases = [
    { name: '후광 켜짐', cfg: { preset: 'star', seed: 1, count: 30, glow: 60, spread: 8 } },
    { name: '후광 꺼짐(세기 0)', cfg: { preset: 'party', seed: 2, count: 25, glow: 0, spread: 8 } },
    { name: '후광 꺼짐(퍼짐 0)', cfg: { preset: 'gold', seed: 3, count: 12, glow: 70, spread: 0 } },
    { name: '갯수 0', cfg: { preset: 'dust', seed: 4, count: 0, glow: 70, spread: 8 } },
    { name: '상한 넘김', cfg: { preset: 'party', seed: 5, count: 999, glow: 50, spread: 5 } },
  ];
  for (const c of cases) {
    const s = F.svg({ ...c.cfg, w: 860, h: 600, filterId: 'pfx-e' });
    assert.equal(F.estimateNodes(c.cfg), tags(s), `${c.name}: 어림수가 실제와 다르다(어림 ${F.estimateNodes(c.cfg)} · 실제 ${tags(s)})`);
  }
  /* ★「후광을 켜면 약 2배」 — ★패널 안내가 쓸 수. ⛔여기서도 손으로 박지 않는다. */
  const on  = F.estimateNodes({ preset: 'star', count: F.MAX_COUNT, glow: 60, spread: 8 });
  const off = F.estimateNodes({ preset: 'star', count: F.MAX_COUNT, glow: 0,  spread: 0 });
  assert.ok(on > off * 1.8 && on < off * 2.3, `「약 2배」가 깨졌다 — 켜짐 ${on} · 꺼짐 ${off}`);
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

test('P11 ★★«출력에 들어가는 수»에 폴백이 없다 — w·h 는 필수다 (지디 조건 2026-10-07)', () => {
  const F = load();
  /* ★이 칸이 ★그 꼴을 찾는 ★자다 — ★행위로 잰다: ★필수 인자를 빼고 불러 ★«그림이 나나» 본다.
     ⇒ 그림이 나면 ★폴백이 있다 = ★그 폴백이 ★출력을 정한다 = ★결정성이 깨지는 자리.
     ★★폴백은 ★「없을 때 메운다」인데 ★메운 값이 ★결과를 정하면 ★「없었다」와 ★「다른 값이었다」가 구분 안 된다. */
  const said = [];
  const G = loadWithCap(null, said);          /* ★console 대역을 ★vm 안에 싣고 부른다 */
  assert.equal(typeof G.svg, 'function', '★전제: console 대역을 가진 판을 실었다');
  {
    for (const [name, arg] of [
      ['w·h 둘 다 없음', { preset: 'star', seed: 1, count: 5, filterId: 'p' }],
      ['h 만 없음',      { preset: 'star', seed: 1, count: 5, w: 860, filterId: 'p' }],
      ['w 만 없음',      { preset: 'star', seed: 1, count: 5, h: 600, filterId: 'p' }],
      ['w·h 가 0',       { preset: 'star', seed: 1, count: 5, w: 0, h: 0, filterId: 'p' }],
      ['h 가 음수',      { preset: 'star', seed: 1, count: 5, w: 860, h: -5, filterId: 'p' }],
    ]) {
      const s = G.svg(arg);
      assert.equal(s, '', `${name}: 그림이 났다 — 폴백이 출력을 정한다(같은 seed 가 다른 그림을 낸다)`);
    }
    assert.equal(said.length, 5, `조용히 실패했다 — 콘솔에 말해야 한다(받음 ${said.length}건)`);
    assert.ok(said.every((m) => /w·h/.test(m)), `콘솔이 무엇이 없는지 안 말한다: ${said[0]}`);
  }
  /* ★음성대조 — 제 크기를 주면 ★그린다(자가 «언제나 빈 문자열» 이 아니다) */
  const ok = F.svg({ preset: 'star', seed: 1, count: 5, w: 860, h: 600, filterId: 'p' });
  assert.ok(ok.length > 100 && /viewBox="0 0 860 600"/.test(ok), '★음성대조: 멀쩡한 크기에서는 그린다');
  /* ★★예외 명부 — ★다른 필드는 ★폴백이 «맞다»(프리셋 기본이 ★정의된 답이다).
     ⇒ 이 둘을 섞지 않는다: ★w·h 만 필수고, ★나머지는 normalize 가 떨어뜨려도 ★틀리지 않는다. */
  const bare = F.svg({ w: 860, h: 600, filterId: 'p' });
  assert.ok(bare.length > 100, 'preset·seed·count 를 안 줘도 그림은 나야 한다(프리셋 기본이 답이다)');
});

test('P9 lum — 못 읽으면 ★null(「검정」과 구분한다) · 읽히면 0~1', () => {
  const F = load();
  assert.equal(F.lum('뭐지'), null, '못 읽은 것을 0(검정)으로 돌려주면 호출자가 «어둡다»로 오판한다');
  assert.equal(F.lum(''), null);
  assert.ok(Math.abs(F.lum('#000000') - 0) < 1e-9);
  assert.ok(Math.abs(F.lum('#ffffff') - 1) < 1e-9);
  assert.ok(Math.abs(F.lum('rgba(255,255,255,0.5)') - 1) < 1e-9, 'rgba 도 읽는다(알파는 휘도가 아니다)');
});

/* ═══════════════════════════════════════════════════════════════════════════
   ★패닝 1차 (2026-10-09 · 현빈 「빠진게 있지않니 파티클 효과에? 시안대로 — ★패닝효과」 · 지디 GO)
   ★시안 = artifact BcCGv6AJJCp7o4pfNouY9N 「패닝 컨페티 — 네 판 비교」
   ★★1차에 ★그리는 것은 ★`blur`(방향성 번짐) ★하나뿐이다 —
     ★`speed`·`spin` 은 ★«저장만» 되고 ★v1.5(rAF)에서 ★그려진다.
     ⇒ ⛔「시안 기본을 넣으면 그림이 달라진다」로 ★그 둘을 ★재지 마라. ★아래 P16 이 ★그 경계를 ★적는다.
   ═══════════════════════════════════════════════════════════════════════════ */

/** ★소스 한 줄을 갈아 끼운 판 — ★`loadWithCap` 과 ★같은 법(⛔사본 안 만든다).
 *  ★★닻이 죽으면 ★치환이 ★조용히 ★0 이 되고 ★「측정 0」이 ★결과처럼 생겨 나온다 ⇒ ★전제로 ★단언한다. */
function loadSwapped(anchor, replacement) {
  const src = readSrc(REPO, 'js/fx/particles-render.js');
  assert.ok(src.includes(anchor), `★전제: 치환 닻을 찾았다 — 「${anchor}」`);
  const s = src.replace(anchor, replacement);
  assert.notEqual(s, src, `⛔치환이 안 먹었다 — 자가 죽었다(닻 「${anchor}」)`);
  const ctx = {}; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(readSrc(REPO, 'js/fx/seeded-random.js'), ctx);
  vm.runInContext(s, ctx, { filename: 'particles-render.js(swapped)' });
  return ctx.ParticlesFx;
}

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

test('P14a ★★inert — ★옛 저장본은 ★그림이 ★한 글자도 ★안 바뀐다 (★양방향 한 쌍)', () => {
  const F = load();
  /* ★옛 저장본 = ★새 축 ★셋이 ★«없는» 꼴. ★그것이 ★어제까지 ★저장되던 ★전부다. */
  const old = { preset: 'star', seed: 7, count: 40, colors: ['#ffffff'], shapes: ['circle'],
                smin: 3, smax: 14, rot: true, dist: 'even', glow: 55, spread: 6, fxOpacity: 100, jit: 60 };
  const box = { w: 860, h: 420, filterId: 'pfx-inert' };
  const a = F.svg({ ...old, ...box });
  const b = F.svg({ ...old, speed: 0, blur: 0, spin: 0, ...box });
  const c = F.svg({ ...old, speed: 58, blur: 5, spin: 190, ...box });   // ★시안 기본값 셋
  assert.ok(a.length > 500, '★전제: 옛 저장본이 ★그림을 낸다');

  /* ⒜ ★inert — ★새 축이 ★0 이면 ★옛 그림 ★그대로 */
  assert.equal(sha(b), sha(a), '★★inert 가 깨졌다 — 새 축이 0 인데 그림이 달라졌다');
  /* ⒝ ★★그 단언이 ★항등식이 ★아님을 ★같은 칸에서 보인다 — ⛔⒜ 만 걸면 ★아무것도 안 잠근다
       (★2026-10-08 바닥 실측: ★축이 ★없을 때는 ★a=b=c 가 ★전부 같았다 — ★그 초록은 ★증거가 아니었다) */
  assert.notEqual(sha(c), sha(a), '★★자가 죽었다 — 시안 기본을 넣어도 그림이 같다(번짐이 안 그려진다)');
});

test('P14b ★★`speed` 의 ★min 이 ★0 이어야 ★inert 가 산다 — ★10 으로 둔 판에서 ★0 이 ★10 으로 밀린다', () => {
  const F = load();
  assert.equal(F.RANGES.speed.min, 0, '★전제: 지금 min 은 0 이다');
  assert.equal(F.normalize({ preset: 'star' }).speed, 0, '★전제: 프리셋 기본이 0 이고 clamp 가 안 민다');

  /* ★★출처를 갈아 끼운다 — ★시안의 ★10 을 ★그대로 썼다면 ★무엇이 됐나 */
  const G = loadSwapped('speed:     Object.freeze({ min: 0, max: 160 }),',
                        'speed:     Object.freeze({ min: 10, max: 160 }),');
  assert.equal(G.RANGES.speed.min, 10, '★전제: 갈아 낀 판의 min 이 10 이다');
  assert.equal(G.normalize({ preset: 'star' }).speed, 10,
    '★★clamp 가 0 을 10 으로 밀지 않았다 — 이 칸의 까닭(시안 min 10 을 안 쓴 이유)이 사라졌다');
});

test('P14c ★★PRESETS ★네 벌 × ★패닝 셋 = ★열두 칸이 ★전부 0 — ★한 벌만 빠져도 ★그 프리셋이 ★움직인다', () => {
  const F = load();
  /* ★★P14a 로는 ★이것을 ★못 잡는다 — ★1차에서 ★`speed`·`spin` 은 ★그림에 ★안 들어가서
     ★기본이 ★58 이어도 ★sha 가 ★안 바뀐다. ⇒ ★★그 둘은 ★«값»으로 ★직접 재야 한다.
     ★그러지 않으면 ★v1.5 에서 ★rAF 를 켜는 ★그날 ★옛 섹션이 ★한꺼번에 ★움직인다. */
  const AXES = ['speed', 'blur', 'spin'];
  assert.ok(F.KINDS.length > 1, '★전제: 프리셋이 여럿이다');
  const bad = [];
  for (const k of F.KINDS) {
    const n = F.normalize({ preset: k });        /* ★«없을 때 떨어지는 값»을 ★본다 — ★그게 옛 저장본이 받는 것 */
    for (const ax of AXES) if (n[ax] !== 0) bad.push(`${k}.${ax}=${n[ax]}`);
  }
  assert.deepEqual(bad, [], `★0 이 아닌 칸: ${bad.join(' · ')} — ★그 프리셋의 ★옛 저장본이 ★저절로 움직인다`);
  /* ★전제 — ★칸 수를 ★세서 ★「돌 게 없어 초록」을 ★막는다(★KINDS×AXES 만큼 ★정말 봤나) */
  assert.equal(F.KINDS.length * AXES.length, 12, `★전제: 센 칸이 ${F.KINDS.length * AXES.length} 개다(프리셋 ${F.KINDS.length} × 축 ${AXES.length})`);
});

test('P15 ★방향성 번짐 — ★`blur` 가 ★0 이면 ★없고 ★크면 ★«두 값»으로 난다', () => {
  const F = load();
  const box = { preset: 'party', seed: 7, w: 860, h: 420, filterId: 'pfx-pan' };
  const two = (s) => (s.match(/stdDeviation="0 [0-9.]+"/g) || []).length;
  const anySd = (s) => (s.match(/stdDeviation="/g) || []).length;

  const off = F.svg({ ...box, blur: 0 });
  const on  = F.svg({ ...box, blur: 6 });
  /* ★음성 — ★끄면 ★두 값 꼴이 ★0건. ★단 ★후광의 ★단일 값은 ★있을 수 있다(★그 둘을 ★가린다) */
  assert.equal(two(off), 0, '★blur=0 인데 방향성 번짐이 났다');
  /* ★양성 — ★켜면 ★정확히 ★한 벌(★층 통째에 ★한 번) */
  assert.equal(two(on), 1, `★blur=6 인데 방향성 번짐이 ${two(on)}건이다 — 층 통째에 한 번이어야 한다`);
  assert.ok(on.includes('stdDeviation="0 6"'), '★세로 번짐 값이 blur 를 안 따라간다');
  /* ★★가로는 ★0 이어야 한다 — ★그것이 ★「진행 방향으로만 늘어난다」의 전부다 */
  assert.ok(!/stdDeviation="[1-9][0-9.]* /.test(on), '★가로에 0 이 아닌 값이 들어갔다 — 등방이 된다');
  /* ★후광이 ★꺼진 판에서도 ★난다 — ⛔후광 필터에 ★묻어 가는 것이 ★아니다 */
  const noGlow = F.svg({ ...box, blur: 6, glow: 0, spread: 0 });
  assert.equal(two(noGlow), 1, '★후광을 끄면 방향성 번짐도 같이 죽는다 — 둘은 따로여야 한다');
  assert.ok(anySd(noGlow) === 1, '★후광이 꺼졌는데 단일 값 번짐이 남아 있다');
  /* ★필터 id 가 ★후광과 ★갈렸나 — ★한 문서에 섹션이 여럿이다 */
  assert.ok(on.includes('id="pfx-pan-pan"'), '★번짐 필터 id 가 호출자 id 에서 안 났다');
  assert.ok(on.includes('filter="url(#pfx-pan-pan)"'), '★층이 번짐 필터를 안 쓴다');
});

test('P16 ★★1차의 ★경계 — ★`speed`·`spin` 은 ★저장만 되고 ★그림엔 ★안 들어간다 (v1.5)', () => {
  const F = load();
  const box = { preset: 'party', seed: 7, w: 860, h: 420, filterId: 'pfx-b' };
  const base = F.svg({ ...box, speed: 0, spin: 0 });
  const moved = F.svg({ ...box, speed: 160, spin: 500 });
  assert.equal(sha(moved), sha(base),
    '★speed·spin 이 ★그림을 ★바꿨다 — ★1차는 ★저장만이다(움직임은 v1.5 · rAF)');
  /* ★★그런데 ★저장은 ★되어야 한다 — ⛔「안 그린다」가 ★「안 받는다」가 되면 ★v1.5 가 ★빈손이 된다 */
  const n = F.normalize({ preset: 'party', speed: 160, spin: 500 });
  assert.equal(n.speed, 160, '★speed 가 저장 꼴에 안 남는다');
  assert.equal(n.spin, 500, '★spin 이 저장 꼴에 안 남는다');
  /* ★정지 한 장면 계약은 ★그대로다 — ★애니메이션 표지 0 (★이 파일 머리말의 그 계약) */
  for (const mark of ['<animate', '<animateTransform', '@keyframes', 'dur=']) {
    assert.equal(moved.split(mark).length - 1, 0, `★1차인데 ${mark} 가 났다 — 아직 정지 한 장면이다`);
  }
});
