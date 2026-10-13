/* buzz-layout.test.mjs — 버즈(1012t1Z5)의 배치 규칙과 현빈 고침 ⑴⑵⑶ 을 재는 자.
 *
 * ★재는 것
 *   U1~U9  js/blocks/buzz-layout.js 의 순수 함수를 «진짜로» 돌린다(브라우저 0).
 *          고침 ⑵ 「프레임 높이 그대로 — 넘치면 그 안에서 자리를 줄여 맞춘다」의 산수가 여기 있다(U2 · U4 · U5 · U6).
 *   U10    고침 ⑴⑵ 의 «구조» — buzz-frame.js 에서 프레임 높이를 쓰는 자리가 삽입(addBuzzBlock) 하나뿐이고,
 *          「손으로 옮긴 것」을 기억하는 값이 없다.
 *   U11    고침 ⑶ — 아이콘의 꼴(이웃과 같은 viewBox 12 · 선 1.3)과 이름 · 메뉴의 배선.
 *   칸마다 「⇐ 깨뜨리면」 줄에 음성대조(무엇을 한 글자 깨뜨리면 그 칸이 빨개지나)를 적는다.
 *
 * ★하네스 — buzz-layout.js · buzz-mark.js 는 import 가 0 이라 .mjs 별칭 사본으로 바로 싣는다
 *   (package type=commonjs 라 .js 를 직접 import 못 한다 · 선례 tests/unit/coupon-path.test.mjs).
 *   난수는 js/fx/seeded-random.js 를 vm 에 올려 얻은 FxSeed.mulberry32 다(제품이 넘기는 그 함수 · 선례 fx-seeded-random.test.mjs).
 * ⛔U10 · U11 은 소스 글자를 본다 — 행동은 tests/dom/buzz-frame.dom.spec.js 가 진짜 브라우저에서 잰다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { readSrc } from './_srcread.js';
import { mkTmpRoot } from './_tmproot.js';
import { stripCommentsTA, templateBalanced } from './_strip-comments.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const LAYOUT_SRC = readSrc(ROOT, 'js/blocks/buzz-layout.js');
const MARK_SRC = readSrc(ROOT, 'js/blocks/buzz-mark.js');
const FRAME_SRC = readSrc(ROOT, 'js/blocks/buzz-frame.js');
const PANEL_SRC = readSrc(ROOT, 'js/props/prop-frame-buzz.js');

const _tmp = mkTmpRoot('buzz-layout-');
async function loadAlias(name, src) {
  const p = path.join(_tmp, name);
  fs.writeFileSync(p, src);
  return import(pathToFileURL(p).href);
}
const L = await loadAlias('buzz-layout.mjs', LAYOUT_SRC);
const M = await loadAlias('buzz-mark.mjs', MARK_SRC);

function fxSeed() {
  const ctx = {}; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(readSrc(ROOT, 'js/fx/seeded-random.js'), ctx);
  assert.equal(typeof ctx.FxSeed?.mulberry32, 'function', '★전제: FxSeed 를 실제로 실었다');
  return ctx.FxSeed;
}
const rngOf = (seed) => fxSeed().mulberry32(seed);

/* 낱개 크기 표본 — 한 줄짜리 여섯(실측 꼴 438×79 근처) + 두 줄짜리 하나. */
const BASE = [{ w: 438, h: 79 }, { w: 402, h: 79 }, { w: 441, h: 79 }, { w: 386, h: 79 }, { w: 322, h: 79 }, { w: 258, h: 118 }];
const sizesOf = (n) => Array.from({ length: n }, (_, i) => BASE[i % BASE.length]);
const SEEDS = [1, 7, 2291, 4127, 99999];
const STAGE_W = 860;
const MARGIN = L.BUZZ_MARGIN;
const extraOf = (sizes, tilt) => Math.round(sizes.reduce((m, s) => Math.max(m, s.w), 0) * 0.5 * Math.sin(tilt * Math.PI / 180));
const scatter = (seed, sizes, stageH, over = {}) => L.scatterLayout({ rng: rngOf(seed), sizes, stageW: STAGE_W, stageH, margin: MARGIN, spread: 60, tilt: 4, overlap: true, padY: 20, ...over });

test('U0 전제 — 모듈이 실렸고 상수가 그 값이다', () => {
  for (const k of ['scatterLayout', 'stackLayout', 'pickSpot', 'buzzRotations', 'depthTiers']) assert.equal(typeof L[k], 'function', k);
  assert.equal(L.BUZZ_MARGIN, 30);
  assert.equal(L.BUZZ_STRETCH_MAX, 1.5);
});

/* ⇐ 깨뜨리면: scatterLayout 안의 난수 하나를 Math.random() 으로 */
test('U1 시드 재현 — 같은 seed · 같은 입력이면 같은 자리, seed 가 다르면 다른 자리', () => {
  const sizes = sizesOf(6);
  for (const s of SEEDS) assert.deepEqual(scatter(s, sizes, 630), scatter(s, sizes, 630), `seed ${s}`);
  const distinct = new Set(SEEDS.map((s) => JSON.stringify(scatter(s, sizes, 630).items)));
  assert.ok(distinct.size >= 4, `다른 seed 5개 중 서로 다른 결과 ${distinct.size}`);
});

/* ⇐ 깨뜨리면: 맞춤의 Math.min(yy, bot - h) 를 yy 로 */
test('U2 ★⑵ 흩어짐 — 프레임 높이가 얼마든 낱개는 프레임 안이다(넘치면 줄여 놓는다)', () => {
  let checked = 0, squeezedSeen = 0;
  for (const seed of SEEDS) for (const n of [1, 2, 6, 12]) for (const stageH of [300, 520, 630, 900, 1200]) for (const overlap of [true, false]) {
    const sizes = sizesOf(n);
    const out = scatter(seed, sizes, stageH, { overlap });
    const extra = extraOf(sizes, 4);
    const top = MARGIN + extra, bot = stageH - MARGIN - extra;
    assert.equal(out.items.length, n);
    out.items.forEach((p, i) => {
      const { h } = sizes[i];
      const tag = `seed ${seed} n ${n} H ${stageH} #${i}`;
      assert.ok(Number.isInteger(p.y) && Number.isInteger(p.x), tag + ' 정수');
      assert.ok(p.y >= top, `${tag} 위로 나갔다 y=${p.y} top=${top}`);
      if (h <= bot - top) assert.ok(p.y + h <= bot, `${tag} 아래로 나갔다 ${p.y + h} > ${bot}`);
      else assert.equal(p.y, top, tag + ' 프레임보다 큰 낱개는 top');
      checked++;
    });
    if (out.squeezed) squeezedSeen++;
    assert.equal(out.squeezed, out.natural > stageH || sizes.some((s) => s.h > bot - top), `seed ${seed} n ${n} H ${stageH} squeezed 표시`);
  }
  /* 프레임보다 큰 낱개가 섞여도 — 그것은 top(머리가 보인다), 나머지는 안 */
  for (const seed of SEEDS) {
    const sizes = [...sizesOf(4), { w: 300, h: 400 }];
    const out = scatter(seed, sizes, 300);
    const extra = extraOf(sizes, 4);
    assert.equal(out.items[4].y, MARGIN + extra, `seed ${seed} 큰 낱개는 top`);
    out.items.slice(0, 4).forEach((p, i) => assert.ok(p.y >= MARGIN + extra && p.y + sizes[i].h <= 300 - MARGIN - extra, `seed ${seed} #${i} 는 안`));
    assert.equal(out.squeezed, true);
  }
  assert.ok(checked > 800, `★전제: 실제로 잰 낱개 수 ${checked}`);
  assert.ok(squeezedSeen > 20, `★전제: 넘치는 판이 표본에 있다 ${squeezedSeen}`);
});

/* ⇐ 깨뜨리면: x 의 Math.max(0, Math.min(stageW - w, …)) 죔을 뺌 */
test('U3 흩어짐 — 가로로도 프레임 안이다(프레임만큼 넓은 낱개 포함)', () => {
  for (const seed of SEEDS) {
    const sizes = [...sizesOf(5), { w: 840, h: 79 }];
    scatter(seed, sizes, 900, { spread: 100 }).items.forEach((p, i) => {
      assert.ok(p.x >= 0, `seed ${seed} #${i} x=${p.x}`);
      assert.ok(p.x + sizes[i].w <= STAGE_W, `seed ${seed} #${i} 오른쪽 ${p.x + sizes[i].w}`);
    });
  }
});

/* ⇐ 깨뜨리면: BUZZ_STRETCH_MAX 1.5 → 9 */
test('U4 ★⑵ 흩어짐 — 프레임이 남으면 최대 1.5배까지만 벌리고 가운데에 둔다', () => {
  for (const seed of SEEDS) {
    const sizes = sizesOf(2);
    const nat = L.scatterLayout({ rng: rngOf(seed), sizes, stageW: STAGE_W, margin: MARGIN, spread: 60, tilt: 4, overlap: true, padY: 20 });
    const fit = scatter(seed, sizes, 1200);
    const extra = extraOf(sizes, 4);
    const top = MARGIN + extra, bot = 1200 - MARGIN - extra;
    const dNat = Math.abs(nat.items[0].y - nat.items[1].y), dFit = Math.abs(fit.items[0].y - fit.items[1].y);
    assert.ok(dNat > 0, '★전제: 두 낱개의 세로 자리가 다르다');
    assert.ok(dFit <= dNat * 1.5 + 1, `seed ${seed} 벌림 ${dFit} > ${dNat} × 1.5`);
    assert.ok(dFit > dNat, `seed ${seed} ★전제: 벌어지긴 했다 ${dFit} vs ${dNat}`);
    const above = Math.min(...fit.items.map((p) => p.y)) - top;
    const below = bot - Math.max(...fit.items.map((p, i) => p.y + sizes[i].h));
    assert.ok(Math.abs(above - below) <= 1, `seed ${seed} 가운데가 아니다 위 ${above} 아래 ${below}`);
    assert.equal(fit.squeezed, false);
  }
});

const stack = (sizes, stageH, over = {}) => L.stackLayout({ sizes, stageW: STAGE_W, stageH, margin: MARGIN, offset: 60, gap: 28, tilt: 0, tailRoom: 0, ...over });
const gapsOf = (items, sizes) => items.slice(1).map((p, i) => p.y - (items[i].y + sizes[i].h));

/* ⇐ 깨뜨리면: gapEff 의 Math.min(gap, …) 을 Math.max 로 */
test('U5 ★⑵ 스택 — 넘치면 간격을 고르게 줄이고(음수 = 겹침), 안 넘치면 설정 간격 그대로 가운데', () => {
  const sizes = sizesOf(6);
  const over = stack(sizes, 400);
  const bot = 400 - MARGIN;
  const g1 = gapsOf(over.items, sizes);
  assert.ok(g1.every((g) => g < 0), `넘치는데 간격이 음수가 아니다 ${g1}`);
  assert.ok(Math.max(...g1) - Math.min(...g1) <= 1, `간격이 고르지 않다 ${g1}`);
  const last = over.items[5].y + sizes[5].h;
  assert.ok(Math.abs(last - bot) <= 1, `마지막 밑변 ${last} ≠ ${bot}`);
  assert.equal(over.items[0].y, MARGIN);
  assert.equal(over.squeezed, true);

  const fit = stack(sizes, 1200);
  const g2 = gapsOf(fit.items, sizes);
  assert.ok(g2.every((g) => Math.abs(g - 28) <= 1), `안 넘치는데 간격이 28 이 아니다 ${g2}`);
  const above = fit.items[0].y - MARGIN, below = (1200 - MARGIN) - (fit.items[5].y + sizes[5].h);
  assert.ok(Math.abs(above - below) <= 1, `가운데가 아니다 위 ${above} 아래 ${below}`);
  assert.equal(fit.squeezed, false);
  assert.deepEqual(fit.items.map((p) => p.z), [1, 2, 3, 4, 5, 6], '아래 것이 위 것을 덮는다');
  assert.deepEqual(stack(sizes, 400, { topFirst: true }).items.map((p) => p.z), [6, 5, 4, 3, 2, 1], 'topFirst(꼬리) — 위 것이 아래 것을 덮는다');
  assert.deepEqual(stack(sizes, 400, { topFirst: true }).items.map((p) => p.y), over.items.map((p) => p.y), 'topFirst 는 자리를 안 바꾼다');
  /* 엇갈림: 짝은 가운데 − offset/2, 홀은 + offset/2 */
  fit.items.forEach((p, i) => assert.ok(Math.abs((p.x + sizes[i].w / 2) - (STAGE_W / 2 + (i % 2 ? 30 : -30))) <= 1, `#${i} 가로 중심`));
  /* 꼬리 자리 */
  const tail = stack(sizes, 400, { tailRoom: L.BUZZ_TAIL_ROOM });
  assert.ok(tail.items[5].y + sizes[5].h <= 400 - MARGIN - L.BUZZ_TAIL_ROOM + 1, '꼬리 자리를 남긴다');
});

/* ⇐ 깨뜨리면: stackLayout 의 Math.max(top, …) 를 뺌 */
test('U6 스택 — 가장자리: 0개 · 1개 · 프레임보다 큰 낱개', () => {
  assert.deepEqual(stack([], 400).items, []);
  const one = stack([{ w: 300, h: 100 }], 500);
  assert.equal(one.items[0].y, MARGIN + Math.floor((500 - 2 * MARGIN - 100) / 2), '한 개는 세로 가운데');
  const big = stack([{ w: 300, h: 900 }], 400);
  assert.equal(big.items[0].y, MARGIN, '프레임보다 큰 낱개는 top(머리가 보인다)');
  const many = stack(sizesOf(12), 200);
  assert.ok(many.items.every((p) => p.y >= MARGIN), `위로 나간 낱개가 있다 ${many.items.map((p) => p.y)}`);
});

const overlapArea = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/* ⇐ 깨뜨리면: pickSpot 의 비용 비교 cost < bestCost 를 > 로 */
test('U7 pickSpot — 프레임 안에서, 덜 겹치는 자리를 고른다', () => {
  const size = { w: 258, h: 118 };
  const leftHalf = [{ x: 0, y: 0, w: 430, h: 630 }];
  let free = 0;
  for (const seed of SEEDS) {
    const a = L.pickSpot({ rng: rngOf(seed), size, others: leftHalf, stageW: STAGE_W, stageH: 630, margin: MARGIN });
    const b = L.pickSpot({ rng: rngOf(seed), size, others: leftHalf, stageW: STAGE_W, stageH: 630, margin: MARGIN });
    assert.deepEqual(a, b, '같은 rng 면 같은 자리');
    assert.ok(a.x >= MARGIN && a.x + size.w <= STAGE_W - MARGIN, `seed ${seed} 가로 ${a.x}`);
    assert.ok(a.y >= MARGIN && a.y + size.h <= 630 - MARGIN, `seed ${seed} 세로 ${a.y}`);
    if (overlapArea({ ...a, ...size }, leftHalf[0]) === 0) free++;
  }
  assert.ok(free >= 4, `왼쪽 절반이 찼는데 빈 오른쪽을 고른 seed ${free}/5`);
  /* 프레임보다 큰 낱개 — 구간이 뒤집히면 가로 가운데 · 세로 margin */
  const big = L.pickSpot({ rng: rngOf(1), size: { w: 900, h: 700 }, others: [], stageW: STAGE_W, stageH: 630, margin: MARGIN });
  assert.deepEqual(big, { x: -20, y: MARGIN });
});

/* ⇐ 깨뜨리면: buzzRotations 의 Math.round 를 뺌 */
test('U8 회전 — 방향 규칙 · 정수 · 범위 안', () => {
  const tops = [300, 30, 120, 210, 400, 520];
  const one = L.buzzRotations({ rng: rngOf(1), tops, angle: -5, range: 0, dir: 'one' });
  assert.deepEqual(one, [-5, -5, -5, -5, -5, -5]);
  const alt = L.buzzRotations({ rng: rngOf(1), tops, angle: 5, range: 0, dir: 'alt' });
  const byTop = tops.map((t, i) => [t, alt[i]]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  assert.deepEqual(byTop, [5, -5, 5, -5, 5, -5], '위→아래로 부호가 번갈아');
  for (const dir of ['alt', 'one', 'rand']) for (const seed of SEEDS) {
    const r = L.buzzRotations({ rng: rngOf(seed), tops, angle: 3, range: 4, dir });
    assert.ok(r.every((v) => Number.isInteger(v)), `${dir} seed ${seed} 정수가 아니다 ${r}`);
    assert.ok(r.every((v) => Math.abs(v) <= 7), `${dir} seed ${seed} 범위 밖 ${r}`);
    assert.ok(r.every((v) => !Object.is(v, -0)), '−0 을 내지 않는다(dataset 에 "-0" 이 안 남는다)');
  }
  const spread = new Set(SEEDS.flatMap((seed) => L.buzzRotations({ rng: rngOf(seed), tops, angle: 0, range: 4, dir: 'alt' })));
  assert.ok(spread.size >= 4, `★전제: 범위가 실제로 흔든다 ${[...spread]}`);
});

/* ⇐ 깨뜨리면: depthTiers 의 정렬을 내림차순으로(zs[b] - zs[a]) */
test('U9 깊이 단계 — z 가 낮은(뒤쪽) 것부터 2 · 1 · 0', () => {
  const zs = [4, 1, 6, 2, 5, 3];
  const t = L.depthTiers(zs);
  assert.deepEqual(t, [1, 2, 0, 2, 0, 1]);
  assert.deepEqual(L.depthTiers([2, 1]), [0, 0], '둘이면 전부 앞');
  assert.deepEqual(L.depthTiers([]), []);
});

/* ⇐ 깨뜨리면: relayoutBuzzFrame 안에 frame.style.height = res.natural + 'px'; 한 줄 */
test('U10 ★⑴⑵ 구조 — 프레임 높이를 쓰는 자리는 삽입 하나뿐 · 「옮긴 것」을 기억하는 값이 없다', () => {
  assert.ok(templateBalanced(FRAME_SRC), '★전제: buzz-frame.js 의 백틱이 짝이 맞는다(주석 걷기가 믿을 만하다)');
  const code = stripCommentsTA(FRAME_SRC);
  const at = code.indexOf('\nfunction addBuzzBlock(');
  assert.ok(at > 0, '★전제: 삽입 함수가 0열에서 시작한다');
  const before = code.slice(0, at), after = code.slice(at);
  const HEIGHT_WRITE = /(?:dataset\.height|style\.height|style\.minHeight)\s*=(?!=)|setProperty\(\s*['"](?:min-)?height|style\.cssText\s*\+?=/g;
  assert.deepEqual(before.match(HEIGHT_WRITE) || [], [], '삽입 «앞» 구역(다시 놓기 · 스타일 · 개수)이 프레임 높이를 쓴다');
  assert.equal((after.match(HEIGHT_WRITE) || []).length, 3, '★전제: 이 자가 높이 쓰기를 실제로 본다(삽입의 세 줄)');
  assert.ok(/clientHeight/.test(before), '★전제: 다시 놓기는 «지금 프레임 높이»를 읽는다');
  for (const word of ['isMoved', 'movedRows', '_stamp', 'bzX', 'buzzX', 'buzzY', 'dataset.bz']) {
    assert.ok(!code.includes(word), `buzz-frame.js 에 「${word}」 — 손으로 옮긴 것을 기억하는 값은 없어야 한다`);
  }
  assert.ok(/const rows = buzzRows\(frame\);/.test(before), '★전제: 다시 놓기의 대상은 row 전부다');
  assert.ok(!/buzzRows\(frame\)\.(?:filter|slice)\(/.test(before), '다시 놓기가 row 를 걸러 낸다');
  /* 패널: 「풀기」 단추가 없고 높이를 안 쓴다 */
  for (const word of ['release', '옮긴', '풀기']) assert.ok(!PANEL_SRC.includes(word), `prop-frame-buzz.js 에 「${word}」`);
  assert.deepEqual(stripCommentsTA(PANEL_SRC).match(HEIGHT_WRITE) || [], [], 'Buzz 절 배선이 프레임 높이를 쓴다');
});

/* ⇐ 깨뜨리면: buzz-mark.js 의 BUZZ_ICON_STROKE_WIDTH '1.3' → '1.4' */
test('U11 ★⑶ 이름 · 아이콘 — 이웃과 같은 꼴(viewBox 12 · 선 1.3)이고 레이어 줄 · 패널 머리 · 삽입 메뉴에 배선돼 있다', () => {
  const layer = M.buzzIconSvg({ cls: 'layer-item-icon' });
  for (const part of ['class="layer-item-icon"', 'viewBox="0 0 12 12"', 'stroke-width="1.3"', 'fill="none"', 'stroke="currentColor"']) {
    assert.ok(layer.includes(part), `레이어 줄 아이콘에 ${part} 가 없다: ${layer}`);
  }
  const head = M.buzzIconSvg({ size: 12, stroke: '#888' });
  assert.ok(head.includes('width="12" height="12"') && head.includes('stroke="#888"') && !head.includes('class='), `패널 머리 아이콘 꼴: ${head}`);
  /* 이웃(레이어 줄의 modal 아이콘)과 같은 껍데기 값인가 — 이웃의 소스에서 읽어 견준다 */
  const LAYER_SRC = readSrc(ROOT, 'js/panels/layer-panel-items.js');
  const neighbor = /modal:\s*`<svg class="layer-item-icon" viewBox="([^"]+)" fill="([^"]+)" stroke="currentColor" stroke-width="([^"]+)"/.exec(LAYER_SRC);
  assert.ok(neighbor, '★전제: 이웃(modal) 레이어 아이콘을 소스에서 찾았다');
  assert.deepEqual([M.BUZZ_ICON_VIEWBOX, 'none', M.BUZZ_ICON_STROKE_WIDTH], [neighbor[1], neighbor[2], neighbor[3]], '이웃 아이콘과 viewBox · fill · 선 굵기가 같다');
  /* 판정 */
  const el = (ds, cls = ['frame-block']) => ({ classList: { contains: (c) => cls.includes(c) }, dataset: ds });
  assert.equal(M.isBuzzFrame(el({ buzz: '1', freeLayout: 'true' })), true);
  assert.equal(M.isBuzzFrame(el({ freeLayout: 'true' })), false, '표식 없는 자유배치 프레임은 버즈가 아니다');
  assert.equal(M.isBuzzFrame(el({ buzz: '1' })), false, '자유배치가 아니면 버즈가 아니다');
  assert.equal(M.isBuzzFrame(el({ buzz: '1', freeLayout: 'true' }, ['row'])), false);
  assert.equal(M.isBuzzFrame(null), false);
  /* 배선 */
  const PROP_SRC = readSrc(ROOT, 'js/props/prop-frame.js');
  for (const [name, src] of [['layer-panel-items.js', LAYER_SRC], ['prop-frame.js', PROP_SRC]]) {
    assert.ok(src.includes('buzzIconSvg(') && src.includes("'Buzz'") && src.includes('isBuzzFrame('), `${name} 에 Buzz 이름 · 아이콘 · 판정이 없다`);
  }
  const IX = readSrc(ROOT, 'index.html');
  const from = IX.indexOf('id="fp-component-menu"');
  assert.ok(from > 0, '★전제: 삽입 메뉴(#fp-component-menu)를 찾았다');
  const menu = IX.slice(from, IX.indexOf('</div>', from));
  assert.equal(menu.split('onclick="addBuzzBlock();').length - 1, 1, '삽입 메뉴에 Buzz 항목이 하나');
  assert.ok(/<button class="fp-menu-item" onclick="addBuzzBlock\(\);toggleFpDropdown\('fp-component-dropdown'\)">Buzz<\/button>/.test(menu), '메뉴 항목은 맨몸 button 이고 글자는 Buzz');
  assert.equal(IX.split('src="js/blocks/buzz-frame.js"').length - 1, 1, 'buzz-frame.js 스크립트 태그가 하나');
  assert.ok(IX.indexOf('src="js/blocks/modal-block.js"') < IX.indexOf('src="js/blocks/buzz-frame.js"'), 'buzz-frame.js 는 modal-block.js 뒤');
});

/* ⇐ 깨뜨리면: modal-block.js _tapeHtml 의 Object.hasOwn(MODAL_TAPE_POS, side) 를 MODAL_TAPE_POS[side] 로 */
test('U12 테이프 자리 표는 «자기 키»만 본다 — constructor · toString 같은 값으로 깨진 테이프를 그리지 않는다(판정서 L-2)', () => {
  const { loadModalModule, fakeBlock } = createRequire(import.meta.url)('./_modal-harness.js');
  const M2 = loadModalModule();
  for (const bad of ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'middle', '']) {
    const block = fakeBlock({ variant: 'plain', decoTape: bad, textText: '글' });
    block.insertAdjacentHTML = (pos, html) => { block.innerHTML += html; };
    M2.renderModalBlock(block);
    assert.ok(!block.innerHTML.includes('mdl-deco-tape') && !block.innerHTML.includes('undefined'), `decoTape="${bad}" 에 테이프가 그려졌다: ${block.innerHTML.slice(-160)}`);
  }
  /* 양성대조 — 표에 있는 값은 그려진다(이 하네스가 장식을 실제로 지난다) */
  const ok = fakeBlock({ variant: 'plain', decoTape: 'center', textText: '글' });
  ok.insertAdjacentHTML = (pos, html) => { ok.innerHTML += html; };
  M2.renderModalBlock(ok);
  assert.ok(ok.innerHTML.includes('class="mdl-deco-tape" data-side="center"'), '★전제: 바른 값이면 테이프가 그려진다');
});
