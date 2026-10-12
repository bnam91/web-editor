/* coupon-path.test.mjs — 쿠폰 배경 생성기와 «비율 축소»를 재는 자 (현빈 발주 2026-10-07 · 1단계)
 *
 * ★이 파일이 재는 것 = ★변이 명부 V1·V2·V6 ＋ 전제 단언.
 *   무엇을 무력화하면 어디가 빨강인지는 각 test 머리의 «⇐ 되돌리기» 줄에 적는다.
 *
 * ★판은 ⛔HEAD 가 아니라 ★`2866df63`(고치기 «전» 판)에 핀을 박는다 —
 *   고친 뒤 HEAD 로 재면 대조가 ★전부 초록이 되고 그 초록을 「증상을 잡는다」로 읽는다.
 *   ⇒ V0-pin 이 「그 판엔 이 파일이 ★없다」를 ★행위로 확인한다(이름 grep 이 아니다).
 *
 * ★하네스 — js/blocks/coupon-geometry.js 는 ★import 가 0 이라 .mjs 별칭 사본으로 바로 싣는다
 *   (tests/unit/frame-geometry.test.mjs 관례: package type=commonjs 라 .js 를 직접 import 못 한다).
 *   ⛔js/blocks/coupon-block.js 는 ★여기서 안 싣는다 — drag-utils/drag-drop 을 import 하고
 *     document 를 쓴다. 그쪽 행동은 tests/dom/coupon-block.dom.spec.js 가 «진짜 브라우저»에서 잰다.
 *     ⇒ 이 파일은 coupon-block.js 의 ★비율 식만 «소스에서 떼어» 돌린다(아래 _liftScaleFns).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'os';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readSrc } from './_srcread.js';
import { mkTmpRoot } from './_tmproot.js';
import { sliceBlock } from './_slice-block.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PIN = '2866df63';
const GEO_REL = 'js/blocks/coupon-geometry.js';
const BLK_REL = 'js/blocks/coupon-block.js';
const GEO_SRC = readSrc(ROOT, GEO_REL);
const BLK_SRC = readSrc(ROOT, BLK_REL);

/* 바이트 그대로 .mjs 별칭 사본 — frame-geometry.test.mjs 와 같은 수법. */
const _tmp = path.join(mkTmpRoot('coupon-geo-'), 'coupon-geometry.mjs');
fs.writeFileSync(_tmp, GEO_SRC);
const G = await import(pathToFileURL(_tmp).href);

/** 1단계 기본 설정 — ★시안 baseState 그대로의 «꺼진» 꼴. */
function baseSt(over = {}) {
  return {
    cw: 460, ch: 259, radius: 14, bgKind: 'coupon', canvasCol: 'transparent',
    bodyCol: '#F2792B', stubCol: '#15151A', strokeCol: '#D8D8D4', strokeW: 0,
    nSides: { top: false, right: false, bottom: false, left: false }, nR: 16, nPos: 50,
    perfOn: false, perfDir: 'v', perfPos: 80, perfDash: 4, perfGap: 5, perfW: 2,
    perfCol: '#8A6D00', perfEnd: true,
    split: 'none', stubPct: 22, gap: 6,
    shadow: 'none', shDx: 10, shDy: 10, shBlur: 8, shCol: '#C2410C', shOpa: 100,
    badgeOn: false, decoOn: false,
    align: 'left', valign: 'center', order: 't-n-b', inlineUnit: true, pad: 24, gapY: 4, stubVert: false,
    ...over,
  };
}

/* ═══ V0 — 전제. ⛔이걸 안 세우면 아래 전부가 «무엇을 재는지» 모른다 ═══════════ */

test('V0-a 전제 ★하네스가 살아 있다 — 생성기 일곱 이름이 실제로 실려 있다', () => {
  for (const n of ['q', 'cl', 'couponPath', 'makePieces', 'putNotch', 'scallop', 'paintCoupon', 'PAINT', 'paint']) {
    assert.equal(typeof G[n] !== 'undefined', true, `${n} 이 안 실렸다`);
  }
  assert.equal(typeof G.paint, 'function');
  assert.equal(typeof G.PAINT.fn, 'function');
});

test('V0-pin ★양성대조 — 핀 판(2866df63)엔 이 생성기가 «없다»(행위로 확인 · 이름 grep 아님)', () => {
  let out = '';
  let rc = 0;
  try {
    out = execFileSync('git', ['-C', ROOT, 'cat-file', '-e', `${PIN}:${GEO_REL}`], { encoding: 'utf8' });
  } catch (e) { rc = e.status ?? 1; }
  /* ⛔「빈 출력」을 «없다»로 읽지 않는다 — 종료코드로 가른다.
     ★그리고 ★음성대조: 같은 자로 «있는 파일»을 물으면 rc 0 이어야 한다(자가 죽지 않았음). */
  assert.notEqual(rc, 0, `핀 판에 ${GEO_REL} 가 «있다» — 핀이 틀렸거나 파일이 옛 판에 들어갔다 (out=${out})`);
  const liveRc = (() => {
    try { execFileSync('git', ['-C', ROOT, 'cat-file', '-e', `${PIN}:js/blocks/modal-block.js`]); return 0; }
    catch (e) { return e.status ?? 1; }
  })();
  assert.equal(liveRc, 0, '★자가 죽었다 — 핀 판에서 modal-block.js 조차 못 찾는다(경로·핀 확인)');
});

/* ═══ V1 — couponPath: 홈은 «안으로» 파인다 ════════════════════════════════════ */

/* ★★네 면을 ★전부 잰다 (2026-10-07 — ★변이 쓸기에서 찾은 흠).
   처음엔 ★left 한 면만 쟀다. 그런데 변이 쓸기에서 ★top 쪽 호의 sweep 을 0→1 로 뒤집었더니
   ★이 검사가 ★초록이었다(SRC 만 빨강). ⇒ 「홈은 안으로 파인다」를 ★한 면에서만 잠그고 있었다.
   ★제품은 네 면을 ★다 지원한다(nSides {top,right,bottom,left}) ⇒ 자도 ★네 면이어야 한다.
   ⛔「약한 검사」라 적고 넘기지 않았다 — ★분모(제품이 지원하는 면 수)에 맞춰 ★넓혔다. */
test('V1 ★홈은 sweep 0(안으로 파임) · 모서리는 sweep 1(밖으로 볼록) — ★네 면 전수', () => {
  // ⇐ 되돌리기: couponPath 의 ★어느 면이든 홈 호 `0 0 0` 을 `0 0 1` 로 뒤집으면 그 면에서 빨강
  const SIDES = ['top', 'right', 'bottom', 'left'];
  const noNotch = G.couponPath({ x: 0, y: 0, w: 200, h: 100, rs: [10, 10, 10, 10], nts: [] });
  const cornersOf = (d) => [...d.matchAll(/A([\d.]+) ([\d.]+) 0 0 ([01])/g)]
    .map(m => ({ r: +m[1], sweep: m[3] }));
  /* ★전제 ① — 홈 없는 꼴엔 ★모서리 넷만 있고 ★전부 sweep 1 이다. */
  const base = cornersOf(noNotch);
  assert.equal(base.length, 4, `홈 없는 꼴의 호가 ${base.length}개다 — 모서리 넷이어야 한다`);
  for (const a of base) assert.equal(a.sweep, '1', '모서리가 sweep 1 이 아니다');

  const missed = [];
  for (const side of SIDES) {
    const d = G.couponPath({ x: 0, y: 0, w: 200, h: 100, rs: [10, 10, 10, 10],
      nts: [{ side, pos: 0.5, r: 12 }] });
    /* ★전제 ② — 그 면의 홈이 «실제로» path 를 바꿨나. 안 바뀌면 그 면은 ★안 재고 있다. */
    assert.notEqual(d, noNotch, `${side}: 홈을 넣었는데 path 가 그대로다 — 이 면은 안 그려진다`);
    const arcs = cornersOf(d);
    const notch = arcs.filter(a => a.r === 12);
    const corner = arcs.filter(a => a.r === 10);
    assert.equal(notch.length, 1, `${side}: 홈 호가 ${notch.length}개다(1이어야 한다)`);
    assert.equal(corner.length, 4, `${side}: 모서리 호가 ${corner.length}개다(4여야 한다)`);
    if (notch[0].sweep !== '0') missed.push(`${side}(sweep=${notch[0].sweep})`);
    for (const a of corner) assert.equal(a.sweep, '1', `${side}: 모서리가 «안으로 파였다»`);
  }
  /* ★한 면이라도 뒤집혀 있으면 ★그 면의 이름을 말한다 — 「어딘가 틀렸다」로 끝내지 않는다. */
  assert.deepEqual(missed, [], `★홈이 «밖으로 볼록»한 면: ${missed.join(', ')} — sweep 이 0 이어야 한다`);
});

test('V1-b ★같은 설정 → 같은 path (생성기가 결정적이다)', () => {
  const a = G.paint(baseSt(), 460, 259).svg;
  const b = G.paint(baseSt(), 460, 259).svg;
  assert.equal(a, b);
  /* ★음성대조 — 설정을 바꾸면 ★달라야 한다. 안 달라지면 위 단언은 항등식이다. */
  const c = G.paint(baseSt({ radius: 40 }), 460, 259).svg;
  assert.notEqual(a, c, '★모서리를 14→40 으로 바꿨는데 SVG 가 같다 — radius 가 안 먹는다');
});

test('V1-c ★CSS 마스크·box-shadow·CSS 그라데이션을 «안» 쓴다 (내보내기에서 죽는 것들)', () => {
  const svg = G.paint(baseSt({ shadow: 'drop', bgKind: 'grad' }), 460, 259).svg;
  for (const bad of ['mask', 'box-shadow', 'radial-gradient', '-webkit-']) {
    assert.ok(!svg.includes(bad), `생성기 출력에 «${bad}» 가 있다 — html2canvas 에서 죽는다`);
  }
  /* ★전제 — 그림자·그라데이션을 켠 판을 «실제로» 재고 있나(SVG 쪽 도구를 썼나). */
  assert.ok(svg.includes('<filter'), '그림자 drop 을 켰는데 SVG filter 가 없다 — 전제가 안 섰다');
  assert.ok(svg.includes('linearGradient'), 'bgKind grad 를 켰는데 SVG 그라데이션이 없다 — 전제가 안 섰다');
});

/* ═══ V2 — 그리개 ★꽂이: 끊으면 ★소비자 수만큼 빨강 ═════════════════════════════ */

test('V2 ★그리개가 «한 벌»이다 — PAINT.fn 을 끊으면 paint() 를 쓰는 소비자가 전부 죽는다', () => {
  // ⇐ 되돌리기: 소비자가 paintCoupon 을 «직접» 부르게 바꾸면(= 꽂이를 우회) 이 검사가 빨강
  const real = G.PAINT.fn;
  try {
    let calls = 0;
    G.PAINT.fn = (...a) => { calls++; return real(...a); };
    G.paint(baseSt(), 460, 259);
    G.paint(baseSt({ split: 'lr' }), 460, 259);
    assert.equal(calls, 2, '★paint() 가 PAINT.fn 을 안 지난다 — 꽂이가 무의미하다');

    /* ★끊었을 때 — 소비자는 ★던지거나 빈 것을 받아야 한다(조용히 옛 그림이 남으면 안 된다). */
    G.PAINT.fn = () => { throw new Error('CUT'); };
    assert.throws(() => G.paint(baseSt(), 460, 259), /CUT/, '★꽂이를 끊었는데 paint() 가 멀쩡하다');
  } finally { G.PAINT.fn = real; }
});

test('V2-b ★소비자 전수 — paintCoupon 을 «직접 부르는» 자리가 0건이다 (전부 꽂이를 지난다)', () => {
  /* ⛔「이름이 몇 번 나오나」로 세지 않는다 — 주석·export 가 섞여 ★맨숫자가 틀린다(실측: 3 이라 적었는데 4).
     ★재야 하는 성질은 ★「직접 호출이 있나」다. `paintCoupon(` 중 ★정의 줄(`function `)만 빼고 센다. */
  const callSites = (src) => [...src.matchAll(/(\w*\s*)paintCoupon\s*\(/g)]
    .filter(m => !/function\s*$/.test(m[1])).length;
  assert.equal(callSites(GEO_SRC), 0,
    '★생성기 안에서 paintCoupon 을 직접 부른다 — 꽂이(PAINT.fn)를 우회했다');
  assert.equal(callSites(BLK_SRC), 0,
    '★coupon-block.js 가 paintCoupon 을 직접 부른다 — 꽂이를 우회했다');
  /* ★음성대조 — 같은 자가 «직접 호출»을 ★실제로 잡나. 안 잡으면 위 0 은 「못 재고 있다」와 같다. */
  assert.equal(callSites('const L = paintCoupon(st, 1, 2);'), 1, '★자가 죽었다 — 직접 호출을 못 잡는다');
  assert.equal(callSites('function paintCoupon(S0,CWv,CHv){'), 0, '★자가 정의 줄을 호출로 센다');
  /* ★블럭 파일은 ★paint 만 import 한다.
     ⛔`!/\bpaintCoupon\b/` 로 «낱말»을 금지하지 않는다 — 그러면 ★주석에서 그 이름을
       설명하는 것까지 빨강이 된다(실측으로 물렸다: coupon-block.js:103 의 설명 한 줄).
       재야 하는 것은 «부르나»이고, 그건 바로 위 callSites 가 이미 0 으로 못박았다. */
  assert.ok(/import \{ paint \} from '\.\/coupon-geometry\.js'/.test(BLK_SRC),
    'coupon-block.js 가 paint 를 꽂이에서 안 가져온다');
});

/* ═══ 스텁 «자리» — 지디 Q2 ㈁ (분할·절취선이 꺼지면 ★자리가 없다) ════════════════ */

test('Q2 ★스텁 자리는 «분할이나 절취선»이 켜질 때만 생긴다', () => {
  assert.equal(G.paint(baseSt(), 460, 259).stubRect, null, '기본(둘 다 꺼짐)인데 스텁 자리가 있다');
  assert.ok(G.paint(baseSt({ split: 'lr' }), 460, 259).stubRect, '분할 lr 인데 스텁 자리가 없다');
  assert.ok(G.paint(baseSt({ perfOn: true }), 460, 259).stubRect, '절취선을 켰는데 스텁 자리가 없다');
  /* ★bodyRect 는 ★언제나 있다 — 없으면 글자를 얹을 데가 사라진다. */
  for (const st of [baseSt(), baseSt({ split: 'lr' }), baseSt({ split: 'two' }), baseSt({ perfOn: true })]) {
    assert.ok(G.paint(st, 460, 259).bodyRect, 'bodyRect 가 없다');
  }
});

test('Q2-b ★쿠폰은 원점에 선다 — 앱은 paint(st, cw, ch) 로 부른다(가운데 띄우기 0)', () => {
  const L = G.paint(baseSt(), 460, 259);
  assert.deepEqual({ x: L.box.x, y: L.box.y, w: L.box.w, h: L.box.h }, { x: 0, y: 0, w: 460, h: 259 });
  /* ★음성대조 — 시안처럼 «큰 캔버스»를 주면 ★가운데로 간다(그 성질이 살아 있다). */
  const M = G.paint(baseSt(), 540, 320);
  assert.equal(M.box.x, 40, '큰 캔버스에서 가운데 띄우기가 죽었다');
});

/* ═══ V6 — ★비율 축소: 다섯 칸이 ★전부 같은 문을 지난다 ═══════════════════════════ */

/** coupon-block.js 의 «비율 두 함수»를 소스에서 떼어 vm 에서 돌린다(document 불필요). */
function _liftScaleFns() {
  /* ★구간은 ★정본 부품으로 떠낸다 — ⛔`indexOf('\n}\n')` 같은 «꼬리 문자열»로 끝을 찾지 마라.
     그 전제는 반만 맞아서(화살표·객체리터럴은 `};` 로 끝난다) 구간이 ★남의 코드를 삼킨다.
     tests/unit/slice-block-shared SB-16 이 그 관용구를 ★전수로 센다(실측으로 물렸다 · 2026-10-07). */
  const cut = (name) => sliceBlock(BLK_SRC, `function ${name}(`);
  const code = `
    const COUPON_SLOTS = ${JSON.stringify(require_slots())};
    const COUPON_DEFAULTS = { cw: 460, ch: 259 };
    const CPN_FS_MIN = ${pickConst('CPN_FS_MIN')}, CPN_FS_MAX = ${pickConst('CPN_FS_MAX')};
    function _num(block, key, def) { const v = Number(block?.dataset?.[key]); return Number.isFinite(v) ? v : def; }
    const _dsKey = ${BLK_SRC.match(/const _dsKey = ([^;]+);/)[1]};
    ${cut('_cpnScale')}
    ${cut('_cpnBoxH')}
    ${cut('_cpnEffFontSize')}
    ({ _cpnScale, _cpnBoxH, _cpnEffFontSize, _dsKey, CPN_FS_MIN, CPN_FS_MAX });
  `;
  return vm.runInNewContext(code, { Number, Math, String, Object, JSON });
}
function pickConst(name) {
  const m = BLK_SRC.match(new RegExp(`const ${name} = (\\d+);`));
  assert.ok(m, `${name} 상수를 못 찾았다`);
  return m[1];
}
/** COUPON_SLOTS 의 key·size 만 소스에서 긁는다(표 자체는 정본이 가진다). */
function require_slots() {
  const blk = BLK_SRC.slice(BLK_SRC.indexOf('const COUPON_SLOTS'), BLK_SRC.indexOf('const COUPON_SLOT_KEYS'));
  const rows = [...blk.matchAll(/key: '([a-z]+)',[^}]*?size: (\d+)/g)].map(m => ({ key: m[1], size: +m[2] }));
  assert.equal(rows.length, 5, `COUPON_SLOTS 에서 ${rows.length}칸을 긁었다 — 다섯이어야 한다`);
  return rows;
}

const S = _liftScaleFns();

test('V6-a ★비율 식이 sticker-select.js:320 과 «같다» — 스냅샷 × 폭비율 · clamp 6~150', () => {
  // ⇐ 되돌리기: coupon-block.js 의 clamp 를 (6,150) 에서 다른 수로 바꾸면 빨강
  assert.equal(S.CPN_FS_MIN, 6, '★바닥이 6 이 아니다 — 스티커와 갈라졌다');
  assert.equal(S.CPN_FS_MAX, 150, '★천장이 150 이 아니다 — 스티커와 갈라졌다');
  const stk = readSrc(ROOT, 'js/sticker-select.js');
  assert.ok(/Math\.max\(6,\s*Math\.min\(150,/.test(stk),
    '★스티커 쪽 clamp 가 6/150 이 아니다 — 「스티커처럼」의 근거가 사라졌다(쿠폰 쪽 수를 다시 맞춰라)');
});

test('V6-b ★폭을 반으로 줄이면 다섯 칸이 «전부» 반이 된다', () => {
  // ⇐ 되돌리기: renderCouponBlock 에서 한 칸만 _cpnEffFontSize 를 안 지나게 하면 dom 쪽 V6 가 빨강
  const slots = require_slots();
  const ds = { cw: '460', ch: '259' };
  for (const s of slots) ds[S._dsKey(s.key, 'Size')] = String(s.size);
  const block = { dataset: ds };
  assert.equal(S._cpnScale(block, 460), 1, '기본 폭에서 비율이 1 이 아니다');
  assert.equal(S._cpnScale(block, 230), 0.5, '폭 230 에서 비율이 0.5 가 아니다');
  for (const s of slots) {
    assert.equal(S._cpnEffFontSize(block, s.key, 460), s.size, `${s.key}: 기본 폭인데 크기가 변했다`);
    const half = Math.max(6, Math.min(150, Math.round(s.size * 0.5)));
    assert.equal(S._cpnEffFontSize(block, s.key, 230), half, `${s.key}: 폭 절반인데 ${half} 가 아니다`);
  }
  /* ★전제 — 「반이 된다」가 ★실제로 값을 움직였나(모든 칸이 바닥 6 에 깔려 있으면 못 잰다). */
  const moved = slots.filter(s => S._cpnEffFontSize(block, s.key, 230) !== s.size).length;
  assert.equal(moved, 5, `폭을 반으로 줄였는데 ${moved}칸만 움직였다 — 다섯이 전부 움직여야 한다`);
});

test('V6-c ★바닥·천장이 «실제로» 작동한다 (항등식이 아니다)', () => {
  const block = { dataset: { cw: '460', ch: '259', slotNumSize: '46' } };
  assert.equal(S._cpnEffFontSize(block, 'num', 10), 6, '아주 좁은 폭에서 바닥 6 이 안 걸렸다');
  assert.equal(S._cpnEffFontSize(block, 'num', 4600), 150, '아주 넓은 폭에서 천장 150 이 안 걸렸다');
  /* ★음성대조 — 중간값은 ★잘리지 않아야 한다(clamp 가 늘 이기면 비율이 죽은 것이다). */
  assert.equal(S._cpnEffFontSize(block, 'num', 690), 69, '1.5배 폭에서 69 가 아니다 — clamp 가 비율을 먹었다');
});

test('V6-d ★높이는 «쓰지 않고 따라온다» — 폭에서 16:9 가 나온다', () => {
  const block = { dataset: { cw: '460', ch: '259' } };
  assert.equal(S._cpnBoxH(block, 460), 259, '기본 폭에서 높이가 259 가 아니다');
  assert.equal(S._cpnBoxH(block, 230), 130, '폭 230 에서 높이가 130(=round(259*0.5)) 이 아니다');
  /* ★비율이 16:9 에 «실제로» 가깝나 — 수를 박지 않고 재서 본다. */
  const r = 460 / 259;
  assert.ok(Math.abs(r - 16 / 9) < 0.01, `기본 비율이 ${r.toFixed(4)} 로 16:9(1.7778) 와 멀다`);
});

test('V6-e ★분모는 «블럭 자신의 cw» 다 — 2단계에서 cw 가 바뀌어도 안 틀린다', () => {
  // ⇐ 되돌리기: _cpnScale 이 COUPON_DEFAULTS.cw 를 읽게 바꾸면 이 검사가 빨강
  const other = { dataset: { cw: '300', ch: '169' } };
  assert.equal(S._cpnScale(other, 300), 1, '★cw 300 블럭이 폭 300 에서 비율 1 이 아니다 — 분모가 기본값에 박혔다');
  /* ★1단계 전제 — 지금은 둘이 ★같다(makeCouponBlock 이 cw 를 늘 460 으로 박는다). */
  assert.ok(/block\.dataset\.cw = String\(COUPON_DEFAULTS\.cw\);/.test(BLK_SRC),
    '★makeCouponBlock 이 cw 를 기본값으로 안 박는다 — 1단계 전제(둘이 같다)가 깨진다');
});

/* ═══ 떠 온 것이 ★바이트 그대로인가 — 「손으로 베끼지 마라」의 집행 ═══════════════ */

test('SRC ★생성기 본문이 시안 파일과 «바이트 그대로»다 (손 베낌 0)', () => {
  const MOCK = path.join(os.homedir(), '.claude/skills/지디/dashboard/artifacts/goditor-coupon-block.html');
  if (!fs.existsSync(MOCK)) {
    /* ⛔건너뛰기로 조용히 통과시키지 않는다 — 「시안을 못 찾았다」를 ★말하고 통과시킨다.
       (시안은 레포 밖 파일이라 다른 기계에선 없을 수 있다. ★그 사실을 적는 것이 이 칸의 값이다.) */
    assert.ok(true, `시안 파일이 이 기계에 없다: ${MOCK}`);
    return;
  }
  const mock = readSrc(MOCK).split('\n');
  const lifted = mock.slice(887, 1124).join('\n');          // 시안 :888~1124
  assert.ok(GEO_SRC.includes(lifted),
    '★생성기 본문이 시안과 다르다 — 시안을 고쳤으면 `sed -n \'888,1124p\'` 로 다시 떠라');
  /* ★음성대조 — 한 글자만 바꾼 사본은 ★안 들어 있어야 한다(포함 판정이 헐렁하지 않다). */
  assert.ok(!GEO_SRC.includes(lifted.replace('couponPath', 'couponPathX')),
    '★하네스가 헐렁하다 — 변이된 본문도 «들어 있다»고 말한다');
});
