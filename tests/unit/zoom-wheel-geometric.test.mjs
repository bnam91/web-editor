/* U-M67 — 휠 줌이 «거칠다». 노치 하나가 배율에 따라 ×1.15 였다가 ×1.75 가 되고,
 *   줌아웃은 세 노치에 바닥을 친다.
 *   실행: node --test "tests/unit/*.test.mjs"  ·  editor.js 에서 «원문 그대로» 잘라 가짜 DOM 에서 돌린다.
 *
 * [실측 260906 맥 · tools/perf/baseline-mac-2026-09-06-flags-on.txt — 옛 코드]
 *     wheel-100-in   deltaY=-100  100 → 130 → 160 → 190 → 220 → 250   계단 [30,30,30,30,30]
 *     wheel-120-in   deltaY=-120  100 → 130 → 160 → 190 → 220 → 250   ← «같다»(상한 포화의 증거)
 *     wheel-100-out  deltaY= 100  100 →  70 →  40 →  10 →  10 →  10   ← 세 노치에 바닥
 *   원인은 두 겹이다.
 *     ⑴ `Math.max(-30, Math.min(30, Math.round(d*2)))` — d=100 이면 200 이라 «항상» 상한에 포화.
 *     ⑵ zoomStep 이 `currentZoom + delta` 인 «%p 덧셈» — 같은 30%p 가 40% 에선 ×1.75, 200% 에선 ×1.15.
 *   ⇒ 고침: 휠은 «비율»로 센다(노치 하나 = ×ZOOM_RATIO_PER_NOTCH). zoomStep 의 인자 뜻(%p)은 안 바꾼다.
 *
 * ⛔이 검사는 상수를 베끼지 않는다 — 「한 노치 뒤 배율이 얼마인가」라는 «관찰 가능한 결과»로 잰다.
 *   ⑴ 어느 배율에서 돌려도 «같은 비율»로 움직이는가(균일성)  ⑵ 줌아웃이 바닥으로 안 무너지는가
 *   ⑶ 왕복하면 제자리로 오는가  ⑷ 트랙패드 체감이 옛 판과 같은가  ⑸ ⌘+/− 의 뜻이 안 변했는가
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSrc } from './_srcread.js';        // ★CRLF 체크아웃 방어(윈도우 core.autocrlf=true)

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const SRC = readSrc(ROOT, 'js/editor.js');

/** 최상위 함수를 «원문 그대로» 잘라낸다(0열 `}` 로 끝난다). */
function slice(head) {
  const i = SRC.indexOf(head);
  assert.ok(i >= 0, `${head} 를 못 찾음 — 검사가 옛 소스를 보고 있다`);
  const end = SRC.indexOf('\n}\n', i);
  assert.ok(end > i, `${head} 의 끝(0열 \`}\`)을 못 찾음`);
  return SRC.slice(i, end + 3);
}
/** 주석을 지운다 — 「부르는 이름」을 세는 자가 주석 속 낱말을 세면 안 된다. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
}
/** 최상위 const 한 줄. */
function constLine(name) {
  const m = SRC.match(new RegExp(`^const ${name} = .*$`, 'm'));
  assert.ok(m, `const ${name} 을 못 찾음`);
  return m[0];
}

const DEPS = [
  'function applyZoom(z, opts) {',
  'function zoomStep(delta) {',
  'function zoomByRatio(ratio) {',
  'function wheelZoomAccumulate(acc, deltaY) {',
  'function wheelZoomNotches(acc) {',
].map(slice);
const CONSTS = ['ZOOM_RATIO_PER_NOTCH', 'WHEEL_NOTCH_MIN_DELTA', 'PINCH_DELTA_PER_NOTCH',
                'ZOOM_MAX_NOTCHES_PER_TICK'].map(constLine);

/* ── 가짜 환경 ──
 *   canvas-wrap 을 없는 셈 치면 zoomStep 이 «앵커 계산 없이» applyZoom 으로 빠진다(소스 첫 줄의 가드).
 *   앵커/스크롤은 U-M62·pan-native-scroll 이 이미 잠그고 있다 — 여기서 재는 것은 «배율 사다리»뿐이다. */
function makeEnv() {
  const win = { resetCanvasTail: () => {} };
  const doc = {
    documentElement: { style: { setProperty() {} } },
    getElementById: () => null,
    querySelector: () => null,
    body: { classList: { contains: () => false } },
  };
  const prelude = `
    let currentZoom = 100;
    let panOffsetX = 0, panOffsetY = 0;
    function _applyScalerTransformAndSync() {}
    function scheduleNotchUpdate() {}
  `;
  const body = [prelude, ...CONSTS, ...DEPS].join('\n');
  const api = new Function('document', 'window', 'scaler', 'zoomDisplay', 'requestAnimationFrame',
    `${body}
     return {
       applyZoom, zoomStep, zoomByRatio, wheelZoomAccumulate, wheelZoomNotches,
       RATIO: ZOOM_RATIO_PER_NOTCH,
       getZoom: () => currentZoom,
       setZoom: z => applyZoom(z),
     };`
  )(doc, win, { style: {}, offsetWidth: 860, offsetHeight: 1 }, { textContent: '' }, cb => cb());
  return api;
}

/** 한 스로틀 틱: 이 틱에 들어온 deltaY 들을 «실제 코드 그대로» 모아 한 번 적용한다. */
function tick(e, deltas) {
  const acc = { notches: 0, pinch: 0 };
  for (const dy of deltas) e.wheelZoomAccumulate(acc, dy);
  const n = e.wheelZoomNotches(acc);
  if (n !== 0) e.zoomByRatio(Math.pow(e.RATIO, n));
  return e.getZoom();
}
/** 옛 판의 휠 산식 — 양성대조 전용. (dev 1b22658 js/editor.js:3046~3048 원문) */
function tickOld(e, deltas) {
  const d = deltas.reduce((a, dy) => a + -dy, 0);
  const step = Math.max(-30, Math.min(30, Math.round(d * 2)));
  if (step !== 0) e.zoomStep(step);
  return e.getZoom();
}
/** 시작 배율에서 노치 n회 — 배율 경로를 돌려준다. */
function ladder(runTick, from, deltaY, notches = 5) {
  const e = makeEnv();
  e.setZoom(from);
  const seq = [e.getZoom()];
  for (let i = 0; i < notches; i++) seq.push(runTick(e, [deltaY]));
  return seq;
}
/** 경로의 «연속 비율». 균일하면 전부 같은 값이다. */
const ratios = seq => seq.slice(1).map((z, i) => z / seq[i]);

/* ═════ 0. 하네스 무결성 ═══════════════════════════════════════════════ */
test('U-M67-0 ★하네스가 잘라 넣은 코드가 부르는 «최상위 선언 전부»를 싣는다', () => {
  const joined = stripComments(DEPS.join('\n'));
  const called = new Set(
    [...joined.matchAll(/(?<![.\w$])([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g)].map(m => m[1]));
  const loaded = new Set([
    ...DEPS.map(d => d.match(/function\s+(\w+)/)[1]),
    ...CONSTS.map(c => c.match(/const\s+(\w+)/)[1]),
    '_applyScalerTransformAndSync', 'scheduleNotchUpdate',   // prelude 에 «명시해» 꽂는 둘
  ]);
  const declaredInSrc = n => new RegExp(`(?:^|\\n)\\s*(?:function|const|let|var)\\s+${n}\\b`).test(SRC);
  const missing = [...called].filter(n => !loaded.has(n) && declaredInSrc(n));
  assert.deepEqual(missing, [], `하네스가 «안 실은» 선언: ${missing.join(', ')} — DEPS/CONSTS 에 추가하라`);
  // 문자열 검사만으론 «로드 실패»를 못 잡는다 — 실제로 도는지까지 본다.
  const e = makeEnv();
  e.setZoom(100);
  assert.equal(typeof e.getZoom(), 'number');
  assert.ok(tick(e, [-100]) > 100, '하네스가 줌인조차 못 한다 — 픽스처가 죽었다');
});

/* ═════ 1. 균일성 — 어느 배율에서 돌려도 «같은 정도» ═════════════════════ */
/* 상·하한(10~400)에 닿지 않는 범위에서만 «비율»을 비교한다 — 벽에 붙은 계단은 0 이라 당연하다. */
const IN_RANGE = [[40, -100, 5], [100, -100, 5], [200, -100, 3],
                  [40, +100, 3], [100, +100, 5], [200, +100, 5]];

test('U-M67-1 휠 한 노치의 «비율»이 시작 배율 40·100·200% 의 줌인·줌아웃 어디서나 같다', () => {
  const inR = [], outR = [];
  for (const [from, dy, n] of IN_RANGE) {
    const seq = ladder(tick, from, dy, n);
    assert.ok(seq.at(-1) > 10 && seq.at(-1) < 400, `픽스처가 벽에 닿았다: ${seq.join(' → ')}`);
    (dy < 0 ? inR : outR).push(...ratios(seq));
  }
  for (const [name, arr] of [['줌인', inR], ['줌아웃', outR]]) {
    const lo = Math.min(...arr), hi = Math.max(...arr);
    assert.ok(hi / lo < 1.01,
      `${name} 노치의 세기가 배율에 따라 갈린다: 최소 ×${lo.toFixed(3)} ~ 최대 ×${hi.toFixed(3)}`);
  }
  // 줌인 비율과 줌아웃 비율은 «서로 역수» 여야 한다(왕복 대칭).
  assert.ok(Math.abs(inR[0] * outR[0] - 1) < 0.005,
    `줌인 ×${inR[0].toFixed(4)} 과 줌아웃 ×${outR[0].toFixed(4)} 이 역수가 아니다`);
});

test('U-M67-2 [양성대조] 옛 %p 덧셈은 같은 자에서 «실제로» 갈린다', () => {
  const all = [];
  for (const [from, dy, n] of IN_RANGE) all.push(...ratios(ladder(tickOld, from, dy, n)));
  const lo = Math.min(...all), hi = Math.max(...all);
  assert.ok(hi / lo >= 1.01,
    `양성대조가 «안 빨갛다» — 이 자는 M67 결함을 볼 수 없다(픽스처를 고쳐라). lo=${lo} hi=${hi}`);
  // 옛 판이 실제로 어땠는지 못 박아 둔다(실측 기준선과 같은 숫자여야 한다).
  assert.deepEqual(ladder(tickOld, 100, -100), [100, 130, 160, 190, 220, 250]);
  assert.deepEqual(ladder(tickOld, 40, -100).slice(0, 3), [40, 70, 100]);
});

/* ═════ 2. 줌아웃이 «바닥으로 무너지지» 않는다 ══════════════════════════ */
test('U-M67-3 줌아웃 5노치 뒤에도 바닥(10%)에 닿지 않는다', () => {
  for (const from of [40, 100, 200]) {
    const seq = ladder(tick, from, +100);
    assert.ok(seq.at(-1) > 10,
      `${from}% 에서 5노치 만에 바닥: ${seq.join(' → ')}`);
    assert.ok(new Set(seq).size === seq.length,
      `같은 배율이 반복된다 = 이미 포화 — ${seq.join(' → ')}`);
  }
});

test('U-M67-4 [양성대조] 옛 판은 100% 에서 «세 노치»에 바닥을 치고 그 뒤 반응이 없다', () => {
  const seq = ladder(tickOld, 100, +100);
  assert.deepEqual(seq, [100, 70, 40, 10, 10, 10]);
  assert.equal(seq[3], 10, '양성대조가 안 빨갛다 — 옛 판의 바닥 붕괴를 재현 못 한다');
});

/* ═════ 3. 왕복 — 들어간 만큼 나오면 제자리 ═════════════════════════════ */
test('U-M67-5 줌인 N노치 → 줌아웃 N노치 면 시작 배율로 돌아온다', () => {
  for (const [from, n] of [[40, 4], [100, 4], [200, 3]]) {   // 400% 벽에 안 닿는 만큼만
    const e = makeEnv();
    e.setZoom(from);
    for (let i = 0; i < n; i++) tick(e, [-100]);
    for (let i = 0; i < n; i++) tick(e, [+100]);
    assert.ok(Math.abs(e.getZoom() - from) / from < 0.005,
      `왕복이 안 닫힌다: ${from}% → ${e.getZoom()}%`);
  }
});

/* ═════ 4. 트랙패드 핀치 — 옛 체감을 «100% 자리»에서 보존 ═══════════════ */
test('U-M67-6 핀치(deltaY −10 / −3)의 100% 에서의 세기가 옛 판과 같다', () => {
  for (const dy of [-10, -3, -5]) {
    const eNew = makeEnv(); eNew.setZoom(100); tick(eNew, [dy]);
    const eOld = makeEnv(); eOld.setZoom(100); tickOld(eOld, [dy]);
    const diff = Math.abs(eNew.getZoom() - eOld.getZoom());
    assert.ok(diff <= 1,
      `핀치 체감이 옛 판과 갈렸다(deltaY ${dy}): 새 ${eNew.getZoom()}% vs 옛 ${eOld.getZoom()}%`);
  }
});

test('U-M67-7 핀치는 «작은 배율»에서도 균일하다 (옛 판은 여기서 갈렸다)', () => {
  const r = [];
  for (const from of [40, 100, 200]) {
    const e = makeEnv(); e.setZoom(from);
    tick(e, [-10]);
    r.push(e.getZoom() / from);
  }
  assert.ok(Math.max(...r) / Math.min(...r) < 1.01, `핀치가 배율에 따라 갈린다: ${r.join(', ')}`);
});

/* ═════ 5. 마우스 노치는 «개수»로 센다 (기기별 deltaY 차이를 흡수) ═══════ */
test('U-M67-8 deltaY −100(윈도우) 과 −120(맥) 이 같은 한 노치다', () => {
  assert.deepEqual(ladder(tick, 100, -100), ladder(tick, 100, -120));
  assert.deepEqual(ladder(tick, 100, -100), ladder(tick, 100, -53));   // 리눅스
});

test('U-M67-9 한 틱에 몰린 입력에도 상한이 있다 (폭주 방지)', () => {
  const e = makeEnv(); e.setZoom(100);
  tick(e, Array(20).fill(-120));
  assert.ok(e.getZoom() <= 100 * 1.75 + 0.01,
    `한 틱에 ${e.getZoom()}% 까지 뛰었다 — 옛 판의 최대 도약(40%에서 ×1.75)보다 사납다`);
  assert.ok(e.getZoom() > 100, '상한이 0 이 돼 버렸다');
});

/* ═════ 6. 배율 상·하한 유지 ═════════════════════════════════════════════ */
test('U-M67-10 상·하한 10~400% 이 그대로다', () => {
  const up = makeEnv(); up.setZoom(100);
  for (let i = 0; i < 40; i++) tick(up, [-120]);
  assert.equal(up.getZoom(), 400);
  const dn = makeEnv(); dn.setZoom(100);
  for (let i = 0; i < 40; i++) tick(dn, [+120]);
  assert.equal(dn.getZoom(), 10);
});

/* ═════ 7. ⌘+/− · 툴바 ± 보호 — zoomStep 의 인자는 «여전히 %p» ══════════ */
test('U-M67-11 zoomStep 의 인자 뜻이 안 바뀌었다 (키보드·툴바 체감 보존)', () => {
  const e = makeEnv();
  for (const [from, delta, want] of [[100, 10, 110], [100, -10, 90], [40, 10, 50], [200, -10, 190]]) {
    e.setZoom(from); e.zoomStep(delta);
    assert.equal(e.getZoom(), want,
      `zoomStep(${delta}) 이 %p 가 아니게 됐다 — ⌘+/− 와 툴바 ± 가 같이 끌려간다`);
  }
});

test('U-M67-12 키보드·툴바가 «여전히» ±10%p 로 부른다', () => {
  const kb = SRC.match(/zoomStep\((-?\+?10)\)/g) || [];
  assert.ok(kb.length >= 2, `editor.js 의 ⌘+/− 호출이 사라졌다: ${JSON.stringify(kb)}`);
  const html = readSrc(ROOT, 'index.html');
  assert.ok(/zoomStep\(-10\)/.test(html) && /zoomStep\(\+10\)/.test(html),
    '툴바 ± 버튼의 호출이 바뀌었다 — 키보드/버튼 체감은 이 작업의 대상이 아니다');
});

/* ═════ 8. 휠은 zoomStep 을 «직접» 부르지 않는다 (재발 방지 핀) ═════════ */
test('U-M67-13 핀: 휠 핸들러가 옛 «%p 포화» 산식을 다시 들이지 않는다', () => {
  const i = SRC.indexOf('initTrackpadGestures');
  const seg = SRC.slice(i, i + 2500);
  assert.ok(/zoomByRatio\(/.test(seg), '휠이 비율 스텝을 안 쓴다');
  assert.ok(!/Math\.min\(30,/.test(seg), '옛 ±30%p 포화 클램프가 돌아왔다');
});
