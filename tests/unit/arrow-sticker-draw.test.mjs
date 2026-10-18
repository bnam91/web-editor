/* arrow-sticker-draw — 화살표 스티커(1013t2C4)의 그리개(js/fx/arrow-render.js · window.ArrowFx)를 ★불러서 잰다.
 *
 * ★무엇을 잠그나 (계획 plan-1013t2-C4C5 C4-7 U1~U6 + 배선)
 *   AR0 전제 — DOM 없이 실리고 계약한 이름만 낸다 · 값 이름 표(종류 4 · 머리 3 · 머리 꼴 2 · 선 3)와 기본값
 *   AR1 (U1) 결정성 — 같은 입력 = 같은 문자열 · Math.random 호출 0 · 손그림은 seed 가 다르면 다르다(다른 종류는 seed 무관)
 *   AR2 (U2) 종류 4 × 머리 3 — 머리 path 수 = { end:1, both:2, none:0 } · 맞힘 path 1 · 몸통 path 1
 *   AR3 (U3) ★머리 방향 = 끝 접선 — 직선·곡선·꺾은·손그림 각각, 꼭짓점이 끝점과 «같고», 머리 밑변 가운데가 «몸통 쪽»(접선 반대)에 있다
 *   AR4 (U4) 파선·점선은 몸통에만 stroke-dasharray — 머리·맞힘 path 엔 없다
 *   AR5 (U5) ⛔marker 요소 · 필터 · Math.random — 그리개 소스(주석 벗김)와 출력 문자열 둘 다 0
 *   AR6 (U6) 모르는 값(종류 'zzz' · 두께 NaN · 색 'javascript:' · 범위 밖) → 기본값/가둠 · 어떤 입력에도 안 던진다
 *   AR7 맞힘 — 상자(svg)는 pointer-events:none · 투명 굵은 맞힘 path 하나만 pointer-events="stroke"(폭 ≥ 14) · 상자가 모든 점을 담는다
 *   AR8 배선 — index.html 에 스크립트 1번(seeded-random 뒤 · sticker-block 모듈 앞) · 메뉴 「Arrow Line」이 #fp-pen-menu 안 Highlight 다음
 *        · 그 단추 글자·title 에 형광펜 영문 이름 0(HJ1 과 안 부딪힌다)
 * ★기대값은 «글자로» 박았다(피검 함수에서 뽑으면 항등식이다).
 * ⛔앱 0 · 네트워크 0. 두 파일 다 최상위에서 DOM 을 안 건드리므로 vm 으로 그대로 싣는다.
 * DOM 짝: tests/dom/sticker-arrow-c4.dom.spec.js (안 돌림 — GO 대기).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const { stripComments } = require('./_strip-comments.js');
const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../');
const DRAW = 'js/fx/arrow-render.js';

/* Math.random 을 «세는» 판으로 싣는다 — 그리개가 한 번이라도 부르면 AR1 이 본다. */
function load() {
  const calls = { random: 0 };
  const M = Object.create(Math);
  M.random = () => { calls.random++; return 0.5; };
  const ctx = { Math: M, console: { error() {} } };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(readSrc(REPO, 'js/fx/seeded-random.js'), ctx);
  vm.runInContext(readSrc(REPO, DRAW), ctx);
  return { A: ctx.ArrowFx, calls };
}
const pathsOf = (html, cls) => [...html.matchAll(new RegExp(`<path class="arrow-${cls}"[^>]*/>`, 'g'))].map(m => m[0]);
const attr = (tag, name) => (tag.match(new RegExp(`\\s${name}="([^"]*)"`)) || [])[1];
const nums = (d) => (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
const near = (a, b, eps = 0.02) => Math.abs(a - b) <= eps;
const unitv = (x, y) => { const L = Math.hypot(x, y); return [x / L, y / L]; };
const BASE = { x1: 20, y1: 30, x2: 220, y2: 130, thickness: 4, bend: 40, color: '#1a1a1a', seed: 12345 };

test('AR0 전제 — DOM 없이 실리고, 계약한 이름·값 표·기본값', () => {
  const { A } = load();
  assert.equal(typeof A?.svg, 'function');
  assert.deepEqual(Object.keys(A).sort(), ['DASHES', 'DEFAULTS', 'HEADS', 'KINDS', 'LIMITS', 'TIPS', 'geom', 'headLen', 'svg'],
    '★계약한 이름이 아니다 — 머리말·패널(js/props/prop-sticker-arrow.js)과 같이 고쳐라');
  assert.deepEqual([...A.KINDS], ['straight', 'curve', 'elbow', 'hand']);
  assert.deepEqual([...A.HEADS], ['end', 'both', 'none']);
  assert.deepEqual([...A.TIPS], ['fill', 'open']);
  assert.deepEqual([...A.DASHES], ['solid', 'dashed', 'dotted']);
  assert.deepEqual({ ...A.DEFAULTS }, { kind: 'straight', head: 'end', tip: 'fill', dash: 'solid', thickness: 4, bend: 40, color: '#1a1a1a', len: 160 });
  assert.deepEqual([...A.LIMITS.thickness], [1, 40]);
  assert.deepEqual([...A.LIMITS.bend], [-100, 100]);
  assert.ok(Object.isFrozen(A) && Object.isFrozen(A.DEFAULTS) && Object.isFrozen(A.KINDS));
  assert.equal(A.headLen(4), 12); assert.equal(A.headLen(1), 10); assert.equal(A.headLen(20), 60);
});

test('AR1 (U1) ★결정성 — 같은 입력 = 같은 문자열 · Math.random 0 · 손그림만 seed 를 탄다', () => {
  const { A, calls } = load();
  for (const kind of A.KINDS) {
    const p = { ...BASE, kind, head: 'both', tip: 'open', dash: 'dashed' };
    assert.equal(A.svg(p).html, A.svg({ ...p }).html, `${kind}: 같은 입력이 다른 그림`);
    const other = A.svg({ ...p, seed: 999 }).html;
    if (kind === 'hand') assert.notEqual(A.svg(p).html, other, '손그림: seed 가 달라도 같은 그림 — 흔들림이 seed 를 안 탄다');
    else assert.equal(A.svg(p).html, other, `${kind}: seed 를 타면 안 된다(손그림만)`);
  }
  assert.equal(calls.random, 0, `그리개가 Math.random 을 ${calls.random}번 불렀다 — 리로드·undo 마다 그림이 바뀐다`);
});

test('AR2 (U2) 종류 4 × 머리 3 — 머리 path 수 {end:1, both:2, none:0} · 몸통 1 · 맞힘 1', () => {
  const { A } = load();
  const WANT = { end: 1, both: 2, none: 0 };
  let n = 0;
  for (const kind of A.KINDS) for (const head of A.HEADS) for (const tip of A.TIPS) {
    const { html } = A.svg({ ...BASE, kind, head, tip });
    assert.equal(pathsOf(html, 'head').length, WANT[head], `${kind}/${head}/${tip}: 머리 수`);
    assert.equal(pathsOf(html, 'body').length, 1, `${kind}/${head}/${tip}: 몸통 수`);
    assert.equal(pathsOf(html, 'hit').length, 1, `${kind}/${head}/${tip}: 맞힘 수`);
    if (head === 'both') assert.deepEqual(pathsOf(html, 'head').map(h => attr(h, 'data-end')), ['start', 'end']);
    n++;
  }
  assert.equal(n, 24, '★전제: 4×3×2 칸을 다 돌았다');
  // 글자로 박은 표본 — 직선 · 끝 머리 · 채운 삼각 · 두께 4 ⇒ 머리 길이 12 · 반폭 6
  const { html } = load().A.svg({ x1: 0, y1: 0, x2: 100, y2: 0, thickness: 4, head: 'end', tip: 'fill' });
  assert.equal(attr(pathsOf(html, 'head')[0], 'd'), 'M100,0 L88,6 L88,-6 Z');
  assert.equal(attr(pathsOf(html, 'body')[0], 'd'), 'M0,0 L92.8,0', '채운 머리는 몸통을 머리 안쪽(머리 길이×0.6)까지만');
  assert.equal(attr(pathsOf(html, 'hit')[0], 'd'), 'M0,0 L100,0', '맞힘은 끝점에서 끝점까지(머리까지 잡힌다)');
});

test('AR3 (U3) ★머리 방향 = 끝 접선 — 꼭짓점 = 끝점 · 밑변 가운데 = 꼭짓점 − 접선×머리길이', () => {
  const { A } = load();
  const a = [BASE.x1, BASE.y1], b = [BASE.x2, BASE.y2];
  const L = A.headLen(BASE.thickness);
  let checked = 0;
  for (const kind of A.KINDS) for (const tip of A.TIPS) {
    const p = { ...BASE, kind, head: 'both', tip };
    const g = A.geom(p);
    // «정답 접선»은 그리개 밖에서 따로 셈한다
    let uEnd, uStart;
    if (kind === 'straight') { uEnd = unitv(b[0] - a[0], b[1] - a[1]); uStart = unitv(a[0] - b[0], a[1] - b[1]); }
    if (kind === 'curve') {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]); const [ux, uy] = unitv(b[0] - a[0], b[1] - a[1]);
      const k = (BASE.bend / 100) * (len / 2);
      const c = [(a[0] + b[0]) / 2 - uy * k, (a[1] + b[1]) / 2 + ux * k];
      assert.ok(near(g.ctrl[0], c[0]) && near(g.ctrl[1], c[1]), `곡선 제어점 ${g.ctrl} ≠ ${c}`);
      const q = nums(attr(pathsOf(A.svg(p).html, 'hit')[0], 'd'));   // M a Q c b
      assert.ok(near(q[2], c[0]) && near(q[3], c[1]), '그린 곡선의 제어점이 기하와 다르다');
      uEnd = unitv(b[0] - c[0], b[1] - c[1]); uStart = unitv(a[0] - c[0], a[1] - c[1]);
    }
    if (kind === 'elbow') { uEnd = [1, 0]; uStart = [-1, 0]; }   // 가로 먼저 꺾기 · dx > 0
    if (kind === 'hand') {
      const m = g.mids; assert.ok(m && m.length >= 2, '★전제: 손그림 사이 점');
      uEnd = unitv(b[0] - m[m.length - 1][0], b[1] - m[m.length - 1][1]); uStart = unitv(a[0] - m[0][0], a[1] - m[0][1]);
    }
    for (const [end, T, u] of [['end', b, uEnd], ['start', a, uStart]]) {
      const h = g.heads.find(x => x.end === end);
      assert.ok(h, `${kind}/${tip}: ${end} 머리가 없다`);
      const d = nums(h.d);
      const tipPt = tip === 'fill' ? [d[0], d[1]] : [d[2], d[3]];
      const wings = tip === 'fill' ? [[d[2], d[3]], [d[4], d[5]]] : [[d[0], d[1]], [d[4], d[5]]];
      assert.ok(near(tipPt[0], T[0]) && near(tipPt[1], T[1]), `${kind}/${tip}/${end}: 꼭짓점 ${tipPt} ≠ 끝점 ${T}`);
      const mid = [(wings[0][0] + wings[1][0]) / 2, (wings[0][1] + wings[1][1]) / 2];
      const want = [T[0] - u[0] * L, T[1] - u[1] * L];
      assert.ok(near(mid[0], want[0], 0.05) && near(mid[1], want[1], 0.05),
        `${kind}/${tip}/${end}: 밑변 가운데 ${mid.map(v => v.toFixed(2))} ≠ 꼭짓점−접선×${L} ${want.map(v => v.toFixed(2))} — 머리가 접선을 안 따른다(부호·각도)`);
      checked++;
    }
  }
  assert.equal(checked, 16, '★전제: 종류 4 × 꼴 2 × 끝 2');
});

test('AR4 (U4) 파선·점선은 몸통에만 — 머리·맞힘엔 stroke-dasharray 0', () => {
  const { A } = load();
  const WANT = { solid: undefined, dashed: '12 8', dotted: '0.01 8' };   // 두께 4
  for (const kind of A.KINDS) for (const dash of A.DASHES) for (const tip of A.TIPS) {
    const { html } = A.svg({ ...BASE, kind, dash, tip, head: 'both' });
    assert.equal(attr(pathsOf(html, 'body')[0], 'stroke-dasharray'), WANT[dash], `${kind}/${dash}: 몸통 dasharray`);
    for (const h of [...pathsOf(html, 'head'), ...pathsOf(html, 'hit')]) assert.ok(!/stroke-dasharray/.test(h), `${kind}/${dash}/${tip}: 머리·맞힘에 점선이 묻었다`);
  }
});

test('AR5 (U5) ⛔marker 요소 · 필터 · Math.random — 소스(주석 벗김)와 출력 둘 다 0', () => {
  const src = stripComments(readSrc(REPO, DRAW));
  assert.ok(src.includes('function svg('), '★전제: 주석을 벗긴 소스가 비지 않았다');
  assert.ok(!/<marker|marker-end|marker-start/i.test(src), '그리개 소스에 marker 가 있다');
  assert.ok(!/filter/i.test(src), '그리개 소스에 filter 가 있다(썸네일·PNG 에서 죽는다)');
  assert.ok(!/Math\.random/.test(src), '그리개 소스가 Math.random 을 부른다');
  const { A } = load();
  for (const kind of A.KINDS) for (const head of A.HEADS) for (const tip of A.TIPS) for (const dash of A.DASHES) {
    const { html } = A.svg({ ...BASE, kind, head, tip, dash });
    assert.ok(!/marker|filter|\sid="/i.test(html), `${kind}/${head}/${tip}/${dash}: 출력에 marker·filter·id 가 있다(복제 id 충돌 원천)`);
  }
});

test('AR6 (U6) 모르는 값 → 기본값/가둠 · 어떤 입력에도 안 던진다', () => {
  const { A } = load();
  const g = A.geom({ x1: 0, y1: 0, x2: 50, y2: 0, kind: 'zzz', head: 'up', tip: 'star', dash: 'wavy', thickness: 'NaN', bend: 'x', color: 'javascript:alert(1)', seed: 'q' });
  assert.deepEqual({ kind: g.n.kind, head: g.n.head, tip: g.n.tip, dash: g.n.dash, t: g.n.t, bend: g.n.bend, color: g.n.color, seed: g.n.seed },
    { kind: 'straight', head: 'end', tip: 'fill', dash: 'solid', t: 4, bend: 40, color: '#1a1a1a', seed: 1 });
  assert.equal(A.geom({ thickness: 999, bend: 500 }).n.t, 40, '두께 위로 가둠');
  assert.equal(A.geom({ thickness: -3 }).n.t, 1, '두께 아래로 가둠');
  assert.equal(A.geom({ bend: -500 }).n.bend, -100, '휨 아래로 가둠');
  assert.equal(A.geom({ color: 'rgba(10, 20, 30, 0.5)' }).n.color, 'rgba(10, 20, 30, 0.5)', 'rgba 는 산다');
  assert.equal(A.geom({ color: '#abc' }).n.color, '#abc');
  assert.ok(!A.svg({ color: '"><script>' }).html.includes('<script'), '색 칸으로 태그가 새면 안 된다');
  for (const p of [undefined, {}, { x1: 'abc', y2: null }, { x1: 5, y1: 5, x2: 5, y2: 5 }, { kind: 'elbow', x1: 10, x2: 10, y1: 0, y2: 80 },
    { kind: 'hand', x1: 0, y1: 0, x2: 0, y2: 0 }, { kind: 'curve', x1: 1e9, y1: -1e9, x2: 0, y2: 0 }, { kind: 'toString' }]) {
    assert.doesNotThrow(() => A.svg(p), `던졌다: ${JSON.stringify(p)}`);
    const { bbox, html } = A.svg(p);
    assert.ok([bbox.left, bbox.top, bbox.w, bbox.h].every(Number.isFinite) && !/NaN|undefined/.test(html), `NaN/undefined 가 그림에 샜다: ${JSON.stringify(p)}`);
  }
});

test('AR7 맞힘 — 상자는 pointer-events:none · 맞힘 path 하나만 stroke · 상자가 모든 점을 담는다', () => {
  const { A } = load();
  for (const kind of A.KINDS) {
    const p = { ...BASE, kind, head: 'both', tip: 'fill', thickness: 2 };
    const { html, bbox } = A.svg(p);
    assert.match(html, /^<svg class="sticker-arrow-svg"[^>]*style="[^"]*pointer-events:none;/, `${kind}: svg 상자가 pointer-events:none 이 아니다`);
    const hit = pathsOf(html, 'hit')[0];
    assert.equal(attr(hit, 'pointer-events'), 'stroke');
    assert.equal(attr(hit, 'stroke-opacity'), '0', '맞힘 띠는 투명');
    assert.ok(+attr(hit, 'stroke-width') >= 14, '가는 화살표도 잡히게 맞힘 폭 ≥ 14');
    assert.equal((html.match(/pointer-events="stroke"/g) || []).length, 1);
    assert.equal(attr(pathsOf(html, 'body')[0], 'pointer-events'), undefined, '몸통은 svg 의 none 을 물려받는다(맞힘은 맞힘 path 한 벌)');
    const g = A.geom(p);
    const pts = [[BASE.x1, BASE.y1], [BASE.x2, BASE.y2], ...g.heads.flatMap(h => h.corners), ...(g.ctrl ? [g.ctrl] : []), ...(g.mids || [])];
    for (const [x, y] of pts) assert.ok(x >= bbox.left && x <= bbox.left + bbox.w && y >= bbox.top && y <= bbox.top + bbox.h, `${kind}: 점 ${x},${y} 이 상자 밖`);
    assert.match(html, new RegExp(`viewBox="${bbox.left} ${bbox.top} ${bbox.w} ${bbox.h}"`), `${kind}: viewBox = 섹션 좌표 상자`);
  }
});

test('AR8 배선 — 스크립트 1번(순서) · 메뉴 「Arrow Line」이 Highlight 다음 · 형광펜 영문 이름 0', () => {
  const html = readSrc(REPO, 'index.html');
  const tags = html.match(/<script[^>]*src="js\/fx\/arrow-render\.js"[^>]*>/g) || [];
  assert.equal(tags.length, 1, 'arrow-render.js script 태그 수');
  assert.ok(!/type="module"/.test(tags[0]), '고전 스크립트여야 한다(모듈 sticker-block.js 보다 먼저 실행)');
  const at = html.indexOf(tags[0]);
  const sr = html.indexOf('src="js/fx/seeded-random.js"');
  assert.ok(sr > 0 && sr < at, 'seeded-random.js 뒤여야 한다(FxSeed)');
  assert.ok(at < html.indexOf('src="js/blocks/sticker-block.js"'), 'sticker-block.js 앞이어야 한다');
  const m0 = html.indexOf('id="fp-pen-menu"');
  assert.ok(m0 > 0, '★전제: #fp-pen-menu 가 있다');
  const menu = html.slice(m0, html.indexOf('</div>', m0)).replace(/<!--[\s\S]*?-->/g, '');
  const items = [...menu.matchAll(/<button class="fp-menu-item" onclick="([^"]*)" title="([^"]*)">([^<]*)<\/button>/g)].map((m) => ({ on: m[1], title: m[2], label: m[3] }));
  assert.ok(items.length >= 7, `★전제: 메뉴 항목을 떼어냈다(${items.length})`);
  const i = items.findIndex((x) => x.label === 'Arrow Line');
  assert.ok(i > 0, '메뉴에 「Arrow Line」이 없다');
  assert.equal(items[i].on, "addStickerBlock({shape:'arrow'});toggleFpDropdown('fp-pen-dropdown')");
  assert.equal(items[i - 1].label, 'Highlight', '「Arrow Line」은 Highlight 바로 다음');
  assert.equal(items[i + 1]?.label, 'Glow', '「Arrow Line」은 Glow 바로 앞');
  assert.ok(!/highlight/i.test(items[i].title + items[i].label + items[i].on), '화살표 단추에 형광펜 영문 이름 — HJ1(정확히 1개)과 부딪힌다');
});
