/* graph-shape-math — 「SVG 를 그래프 모양으로」의 순수 식(js/graph-shape.js) (1012t1G2 · G3 · G4 · 2026-10-12)
 * 재는 자리 = 순수 함수 그대로(require · DOM 없음). «그려진» 채움·마스크·마디는 tests/dom/graph-shape-fill · graph-shape-segments 가 따로 잰다.
 *   U1 fillRatio 가드(0 · NaN · 글자 · 분모 초과 → 1 · 분모 ≤ 0)      U2 segRatios(합 1 · 0 마디 · 빈 배열 · 험한 값)
 *   U3 segAlpha 단조 감소 · (0,1] 안                                  U4 shapeAspect(viewBox · width/height · 둘 다 없음 · % 단위)
 *   U5 shapeMaskUrl(base64 아님 · 날것 ' ( ) " 0 · xmlns 는 여기서만)   U6 내장 모양마다 viewBox 있고 상한 미만 · 잉크가 viewBox 를 안 넘는다
 *   U7 한계 상수가 graph-limits 에 있다                                U8 usesShape · fillMaxOf(분모 규칙) · segSum
 * 전제 단언: 칸마다 «비교할 것이 실제로 있다»를 먼저 본다 — 빈 목록이 통과로 읽히지 않게. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const GS = require('../../js/graph-shape.js');
const LIM = require('../../js/graph-limits.js');
const { fillRatio, segRatios, segSum, segAlpha, shapeAspect, shapeMaskUrl, shapeSvgOf, usesShape, fillMaxOf, GRAPH_SHAPE_PRESETS } = GS;

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

test('U1 fillRatio — 0 · NaN · 글자 · 음수는 0, 분모를 넘으면 1, 분모가 0 이하·NaN 이면 0', () => {
  assert.equal(typeof fillRatio, 'function', '전제: 함수가 실렸다');
  assert.equal(fillRatio(30, 60), 0.5);
  assert.equal(fillRatio(65, 100), 0.65);
  assert.equal(fillRatio(0, 100), 0);
  assert.equal(fillRatio(NaN, 100), 0);
  assert.equal(fillRatio('abc', 100), 0);
  assert.equal(fillRatio(null, 100), 0);
  assert.equal(fillRatio(-5, 100), 0);
  assert.equal(fillRatio(Infinity, 100), 0);
  assert.equal(fillRatio(90, 60), 1, '분모 초과는 1 로 자른다');
  assert.equal(fillRatio(100, 100), 1);
  assert.equal(fillRatio(50, 0), 0);
  assert.equal(fillRatio(50, -10), 0);
  assert.equal(fillRatio(50, NaN), 0);
  assert.equal(fillRatio(50, undefined), 0);
  assert.equal(fillRatio('25', '50'), 0.5, '숫자 글자는 수로 읽는다');
});

test('U2 segRatios — 합 1 · 값 0 마디는 0 · 빈 배열 · 험한 값', () => {
  const a = segRatios([{ value: 40 }, { value: 30 }, { value: 20 }, { value: 10 }]);
  assert.equal(a.ratios.length, 4, '전제: 몫 수 = 마디 수');
  assert.deepEqual(a.ratios, [0.4, 0.3, 0.2, 0.1]);
  assert.equal(a.total, 100);
  assert.ok(near(a.ratios.reduce((x, y) => x + y, 0), 1));
  const z = segRatios([{ value: 5 }, { value: 0 }, { value: 15 }]);
  assert.deepEqual(z.ratios, [0.25, 0, 0.75], '값 0 마디도 자리는 남는다(색 순번이 안 밀린다)');
  const e = segRatios([]);
  assert.deepEqual(e, { ratios: [], total: 0 });
  assert.deepEqual(segRatios(null), { ratios: [], total: 0 });
  assert.deepEqual(segRatios(undefined), { ratios: [], total: 0 });
  const bad = segRatios([{ value: -3 }, { value: 'x' }, null, { value: NaN }]);
  assert.equal(bad.ratios.length, 4);
  assert.deepEqual(bad, { ratios: [0, 0, 0, 0], total: 0 }, '합 0 이면 전부 0(0 으로 안 나눈다)');
  const mix = segRatios([{ value: -3 }, { value: 4 }, { value: '6' }]);
  assert.deepEqual(mix.ratios, [0, 0.4, 0.6]);
  const huge = segRatios([{ value: 1e308 }, { value: 1e308 }]);
  assert.deepEqual(huge.ratios, [0.5, 0.5], '유한한 값끼리 더해 넘쳐도 몫은 유한');
  assert.ok(huge.ratios.every(Number.isFinite));
  assert.equal(segSum([{ value: 0.1 }, { value: 0.2 }]), 0.3, '합의 소수 오차를 자른다');
  assert.equal(segSum([{ value: 40 }, { value: 30 }, { value: 20 }, { value: 10 }]), 100);
});

test('U3 segAlpha — 단조 감소 · (0, 1] 안', () => {
  const xs = Array.from({ length: 12 }, (_, i) => segAlpha(i));
  assert.equal(xs.length, 12, '전제: 열두 단을 쟀다');
  assert.equal(xs[0], 1, '맨 아래 마디는 막대색 그대로');
  for (let i = 1; i < xs.length; i++) assert.ok(xs[i] < xs[i - 1], `${i}번째가 앞보다 옅다(${xs[i - 1]} → ${xs[i]})`);
  assert.ok(xs.every(a => a > 0 && a <= 1));
  assert.equal(segAlpha(-1), 1);
  assert.equal(segAlpha(NaN), 1);
});

test('U4 shapeAspect — viewBox 우선 · 없으면 width/height · 둘 다 없으면 null', () => {
  assert.deepEqual(shapeAspect('<svg viewBox="0 0 76 240"><path d="M0 0"/></svg>'), { w: 76, h: 240, ratio: 76 / 240 });
  assert.deepEqual(shapeAspect("<svg viewBox='10,20,300,150'></svg>"), { w: 300, h: 150, ratio: 2 }, '쉼표·작은따옴표·0 아닌 원점');
  assert.deepEqual(shapeAspect('<svg width="24" height="48"></svg>'), { w: 24, h: 48, ratio: 0.5 });
  assert.deepEqual(shapeAspect('<svg width="24px" height="12px"></svg>'), { w: 24, h: 12, ratio: 2 });
  assert.deepEqual(shapeAspect('<svg viewBox="0 0 10 20" width="999" height="1"></svg>'), { w: 10, h: 20, ratio: 0.5 }, 'viewBox 가 이긴다');
  assert.equal(shapeAspect('<svg><path d="M0 0"/></svg>'), null);
  assert.equal(shapeAspect('<svg width="100%" height="100%"></svg>'), null, '% 는 크기를 모른다');
  assert.equal(shapeAspect('<svg viewBox="0 0 0 10"></svg>'), null, '폭 0');
  assert.equal(shapeAspect('<svg viewBox="0 0 a b"></svg>'), null);
  assert.equal(shapeAspect('<div viewBox="0 0 1 1"></div>'), null);
  assert.equal(shapeAspect(''), null);
  assert.equal(shapeAspect(null), null);
  /* 안쪽 요소의 width/height 를 루트 것으로 읽지 않는다 */
  assert.equal(shapeAspect('<svg><rect width="10" height="10"/></svg>'), null);
});

test('U5 shapeMaskUrl — base64 가 아니고 · 날것 따옴표·괄호가 없고 · xmlns 는 여기서만 붙는다', () => {
  const src = '<svg viewBox="0 0 10 10"><path d="M0 0L10 10" style="fill:rgb(1,2,3)" id=\'a\'/></svg>';
  assert.ok(/['"()]/.test(src), '전제: 입력에 따옴표·괄호가 실제로 있다');
  const u = shapeMaskUrl(src);
  assert.ok(u.startsWith("url('data:image/svg+xml,"), u.slice(0, 40));
  assert.ok(u.endsWith("')"));
  assert.ok(!u.includes(';base64'), 'base64 금지(저장 길목이 goya-asset 으로 바꿔 마스크가 깨진다)');
  const body = u.slice("url('".length, -"')".length);
  assert.ok(!/['"()\s<>]/.test(body), '본문에 날것 따옴표·괄호·공백·꺾쇠 0');
  assert.ok(!/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/]+=*/.test(u), 'asset-externalize 의 정규식에 안 걸린다');
  const back = decodeURIComponent(body.slice('data:image/svg+xml,'.length));
  assert.equal(back, src.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"'), '되풀면 원문 + xmlns');
  assert.equal(shapeMaskUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>').split('xmlns').length, 2, '이미 있으면 또 안 붙인다');
  assert.equal(shapeMaskUrl(''), '');
  assert.equal(shapeMaskUrl('<p>x</p>'), '');
  assert.equal(shapeMaskUrl(null), '');
});

test('U6 내장 모양 — 이름마다 viewBox 가 있고 상한 미만 · 좌표가 viewBox 를 안 넘는다 · 외부 참조 0', () => {
  const names = Object.keys(GRAPH_SHAPE_PRESETS);
  assert.deepEqual(names, ['person', 'bottle', 'drop'], '전제: 내장 셋');
  for (const n of names) {
    const p = GRAPH_SHAPE_PRESETS[n];
    assert.ok(p.label && typeof p.label === 'string', n + ' 라벨');
    const a = shapeAspect(p.svg);
    assert.ok(a && a.w > 0 && a.h > 0, n + ' viewBox');
    assert.ok(/viewBox="0 0 [\d.]+ [\d.]+"/.test(p.svg), n + ' viewBox 는 0 0 에서 시작');
    assert.ok(p.svg.length < LIM.SHAPE_SVG_MAX, n + ' 상한 미만');
    assert.ok(!/href|url\(|<script|<image|:\/\//i.test(p.svg), n + ' 외부 참조·스크립트 0');
    assert.equal(shapeSvgOf(n), p.svg);
    assert.ok(shapeMaskUrl(p.svg).startsWith("url('data:image/svg+xml,"));
    /* 원·사각의 끝이 viewBox 안(잉크가 잘리지 않는다) — 그리고 어느 한 요소는 네 변에 닿는다(여백 0) */
    const ext = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    const grow = (x0, y0, x1, y1) => { ext.x0 = Math.min(ext.x0, x0); ext.y0 = Math.min(ext.y0, y0); ext.x1 = Math.max(ext.x1, x1); ext.y1 = Math.max(ext.y1, y1); };
    for (const m of p.svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/g)) grow(+m[1] - +m[3], +m[2] - +m[3], +m[1] + +m[3], +m[2] + +m[3]);
    for (const m of p.svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)) grow(+m[1], +m[2], +m[1] + +m[3], +m[2] + +m[4]);
    for (const m of p.svg.matchAll(/ d="([^"]+)"/g)) {
      /* 절대 좌표 명령만 쓴 path(M L H V Q C A Z) — 끝점들만 모아 바깥 상자를 어림한다(제어점은 끝점 상자 안에 두었다) */
      assert.ok(!/[a-z]/.test(m[1].replace(/Z/gi, '')), n + ' path 는 절대 좌표만');
      const toks = m[1].match(/[MLHVQCAZ]|-?[\d.]+/g);
      let i = 0, cmd = '', x = 0, y = 0;
      const nx = () => +toks[i++];
      while (i < toks.length) {
        if (/[A-Z]/.test(toks[i])) cmd = toks[i++];
        if (cmd === 'Z') continue;
        if (cmd === 'M' || cmd === 'L') { x = nx(); y = nx(); }
        else if (cmd === 'H') x = nx();
        else if (cmd === 'V') y = nx();
        else if (cmd === 'Q') { i += 2; x = nx(); y = nx(); }
        else if (cmd === 'C') { i += 4; x = nx(); y = nx(); }
        else if (cmd === 'A') { i += 5; x = nx(); y = nx(); }
        else assert.fail(n + ' 모르는 명령 ' + cmd);
        grow(x, y, x, y);
      }
    }
    assert.ok(Number.isFinite(ext.x0), n + ' 전제: 잰 요소가 있다');
    assert.ok(ext.x0 >= 0 && ext.y0 >= 0 && ext.x1 <= a.w && ext.y1 <= a.h, `${n} 잉크가 viewBox 안: ${JSON.stringify(ext)} / ${a.w}×${a.h}`);
    assert.ok(ext.y0 === 0 && ext.y1 === a.h, `${n} 위·아래 여백 0(채움 %가 모양 높이와 맞는다): ${JSON.stringify(ext)}`);
    assert.ok(ext.x0 === 0 && ext.x1 === a.w, `${n} 좌·우 여백 0: ${JSON.stringify(ext)}`);
  }
  assert.equal(shapeSvgOf('nope'), '', '모르는 이름 = 빈 글자(사각으로 떨어진다)');
  assert.equal(shapeSvgOf('constructor'), '', '상속 이름을 모양으로 안 읽는다');
  assert.equal(shapeSvgOf('custom', '<svg viewBox="0 0 2 4"><path/></svg>'), '<svg viewBox="0 0 2 4"><path/></svg>');
  assert.equal(shapeSvgOf('custom', '<svg><path/></svg>'), '', '크기를 못 읽는 글자는 안 쓴다');
  assert.equal(shapeSvgOf('custom'), '');
});

test('U7 한계 상수 — graph-limits 한 자리(패널·렌더가 같이 읽는다)', () => {
  assert.equal(LIM.SHAPE_SVG_MAX, 60000);
  assert.equal(LIM.SHAPE_FILL_MAX_DEFAULT, 100);
  assert.ok(LIM.SHAPE_TRACK_OPACITY > 0 && LIM.SHAPE_TRACK_OPACITY < 1, '트랙은 채움보다 옅다');
  assert.ok(Number.isInteger(LIM.SEG_GAP_DEFAULT) && LIM.SEG_GAP_DEFAULT >= 0);
  assert.ok(Object.isFrozen(LIM));
});

test('U8 usesShape · fillMaxOf — 키가 없으면 옛 길 · 모양이면 분모 100(또는 fillMax) · 사각이면 max(items)', () => {
  const items = [{ label: 'a', value: 30 }, { label: 'b', value: 80, value2: 500 }];
  assert.equal(usesShape({}, items), false, '키 없음 = 옛 세로 막대');
  assert.equal(usesShape({ barShape: 'person' }, items), true);
  assert.equal(usesShape({}, [{ label: 'a', value: 1, segments: [] }]), false, '빈 마디 배열은 마디가 아니다');
  assert.equal(usesShape({}, [{ label: 'a', value: 1, segments: [{ label: 's', value: 1 }] }]), true);
  assert.equal(usesShape({}, [{ label: 'a', value: 1, shape: 'drop' }]), false, '항목 모양만으로는 안 켜진다(블럭 모양이 스위치)');
  assert.equal(usesShape(null, null), false);
  assert.equal(fillMaxOf({ barShape: 'drop' }, items), 100);
  assert.equal(fillMaxOf({ barShape: 'drop', fillMax: '60' }, items), 60);
  assert.equal(fillMaxOf({ barShape: 'drop', fillMax: '0' }, items), 100, '0 이하·글자는 기본');
  assert.equal(fillMaxOf({ barShape: 'drop', fillMax: 'x' }, items), 100);
  assert.equal(fillMaxOf({}, items), 80, '사각: max(items) — value2 는 안 본다');
  assert.equal(fillMaxOf({ fillMax: '60' }, items), 80, '사각은 fillMax 를 안 읽는다');
  assert.equal(fillMaxOf({}, []), 1);
});

test('U9 carryItemExtras — 항목을 다시 써도 마디·항목 모양이 남는다 · 새 값엔 같은 비율로 · 들어온 마디가 있으면 그것', () => {
  const { carryItemExtras, normSegments } = GS;
  const prev = { label: 'a', value: 100, shape: 'custom', shapeSvg: '<svg viewBox="0 0 1 1"/>', segments: [{ label: 'x', value: 40, color: '#111' }, { label: 'y', value: 60 }] };
  assert.equal(prev.segments.length, 2, '전제: 옛 마디 2');
  assert.deepEqual(carryItemExtras({ label: 'n', value: 50 }, prev, { label: 'n', value: 50 }),
    { label: 'n', value: 50, shape: 'custom', shapeSvg: prev.shapeSvg, segments: [{ label: 'x', value: 20, color: '#111' }, { label: 'y', value: 30 }] });
  assert.deepEqual(prev.segments.map(s => s.value), [40, 60], '옛 항목을 안 고친다');
  assert.deepEqual(carryItemExtras({ label: 'n', value: 0 }, prev, {}).segments.map(s => s.value), [40, 60], '새 값 0 = 비율 유지');
  assert.equal(carryItemExtras({ label: 'n', value: 0 }, prev, {}).value, 100);
  assert.deepEqual(carryItemExtras({ label: 'n', value: 7 }, prev, { segments: [{ label: 'k', value: 3 }, { value: '4' }] }),
    { label: 'n', value: 7, shape: 'custom', shapeSvg: prev.shapeSvg, segments: [{ label: 'k', value: 3 }, { label: '', value: 4 }] });
  assert.deepEqual(carryItemExtras({ label: 'n', value: 9 }, prev, { segments: [] }), { label: 'n', value: 9, shape: 'custom', shapeSvg: prev.shapeSvg }, '빈 배열 = 마디를 걷는다');
  assert.deepEqual(carryItemExtras({ label: 'n', value: 9 }, undefined, null), { label: 'n', value: 9 }, '옛 항목이 없으면 그대로');
  assert.deepEqual(carryItemExtras({ label: 'n', value: 9 }, { label: 'p', value: 1 }, {}), { label: 'n', value: 9 });
  const many = normSegments(Array.from({ length: 30 }, (_, i) => ({ label: 'L'.repeat(200), value: i, color: i % 2 ? 'red' : 'x;y' })));
  assert.equal(many.length, 20, '마디는 20개까지');
  assert.equal(many[0].label.length, 80, '라벨 80자');
  assert.equal(many[1].color, 'red');
  assert.equal('color' in many[0], false, '검증 못 지난 색은 안 싣는다');
  assert.deepEqual(normSegments('nope'), []);
});
