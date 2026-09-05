/* U-SELOV-G — 선택 오버레이의 «변 구간 산술»(dedupe) 이 실제로 도는가.
 *   실행: node --test "tests/unit/*.test.mjs"  ·  DOM 없이 «소스에서 순수 함수만» 떼어 실행한다.
 *
 * ★왜 이 검사가 필요한가 — 울트라플랜은 「오버레이로 옮기면 세 증상이 다 해결된다」고 적었는데
 *   그건 «틀렸다». 증상 ⑶(맞닿은 두 블록을 둘 다 선택하면 경계가 2px)은 «페인트 층» 문제가
 *   아니라 «두 상자가 각자 선을 갖는» 기하 문제다. 층을 옮겨도 그대로 난다.
 *   ⇒ 유일한 해법이 이 dedupe 다. 즉 이 파일이 «인수조건 §4-2 를 지탱하는 코드»를 지킨다.
 *
 * ★음성대조를 같이 건다 — 「3px 떨어진 두 상자는 «지우지 않는다»」.
 *   양성만 재면 「전부 지우는」 구현도 통과한다(그건 선이 사라진 것이지 고쳐진 게 아니다).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const SRC = fs.readFileSync(path.join(ROOT, 'js/selection-overlay.js'), 'utf8');

/** 이름으로 최상위 선언 한 덩이를 잘라낸다(중괄호 균형). export 접두는 벗긴다. */
function slice(head) {
  const i = SRC.indexOf(head);
  assert.ok(i >= 0, `소스에서 «${head}» 를 못 찾았다 — 이름이 바뀌었으면 이 검사도 같이 옮겨라`);
  let j = SRC.indexOf('{', i), depth = 0;
  for (let k = j; k < SRC.length; k++) {
    if (SRC[k] === '{') depth++;
    else if (SRC[k] === '}') { depth--; if (!depth) { j = k + 1; break; } }
  }
  return SRC.slice(i, j).replace(/^export\s+/, '');
}

// ★DOM 을 안 쓰는 조각만 떼어 «진짜로 실행»한다 — 문자열 대조가 아니라 동작 검사다.
const TOUCH = SRC.match(/const TOUCH_DEVICE_PX = ([\d.]+)/);
assert.ok(TOUCH, 'TOUCH_DEVICE_PX 상수를 못 찾았다');
assert.equal(TOUCH[1], '1',
  '맞닿음 임계는 «디바이스 픽셀 1개» — 두 선이 한 픽셀 안에 겹쳐 «구분 불가»일 때만 지운다는 뜻이다');
const SNAP = [...SRC.matchAll(/const _snap(Lo|Hi) = [^\n;]+;/g)].map(m => m[0]);
assert.equal(SNAP.length, 2, '_snapLo/_snapHi 정의를 못 찾았다 — 스냅이 «두 갈래»여야 선이 상자 밖으로 안 샌다');
const ctx = vm.createContext({});
vm.runInContext(
  `const TOUCH_DEVICE_PX = ${TOUCH[1]};\nconst _dpr = () => 2;\nconst _touchEps = () => TOUCH_DEVICE_PX / _dpr();\n` +
  SNAP.join('\n') + '\n' +
  slice('export function subtractInterval') + '\n' +
  slice('function _span') + '\n' +
  slice('function _dedupe') + '\n' +
  slice('function _edgesOf') + '\n' +
  'const _ZERO_R = { nw:[0,0], ne:[0,0], se:[0,0], sw:[0,0] };\n' +
  'globalThis.__pure = { subtractInterval, _dedupe, _edgesOf, _snapLo, _snapHi };',
  ctx);
const { subtractInterval, _dedupe, _edgesOf, _snapLo, _snapHi } = ctx.__pure;
const DPR = 2;   // 실측 기기(dpr 2). 아래 검사는 dpr 1 에서도 성립해야 하므로 둘 다 돈다.

/** 축정렬 상자 하나를 items 원소로. (l,t,r,b) = 스크린 CSS px 생좌표. */
function box(l, t, r, b, opts = {}) {
  const h = opts.h ?? 0.5;                       // 기본 = 굵기 1px 의 절반
  const R0 = { nw:[0,0], ne:[0,0], se:[0,0], sw:[0,0] };
  const g = {
    rot: false, h, sw: h * 2, r: opts.r || R0,
    raw: { l, t, r, b },
    L: _snapLo(l, DPR, h), T: _snapLo(t, DPR, h), R: _snapHi(r, DPR, h), B: _snapHi(b, DPR, h),
    xlo: l, xhi: r, ylo: t, yhi: b,
  };
  return { g, edges: _edgesOf(g), dedupable: opts.dedupable !== false };
}
const len = ivs => ivs.reduce((s, [a, b]) => s + (b - a), 0);
// ⚠️vm 컨텍스트의 배열은 «다른 Array.prototype» 이라 deepStrictEqual 이 프로토타입에서 갈린다
//   (실제로 여기서 한 번 헛짚었다). 값만 비교한다.
const eqIv = (got, want, msg) => assert.equal(JSON.stringify(got), JSON.stringify(want), msg);

test('★스냅은 선을 «상자 밖으로» 내보내지 않는다(분수 좌표에서도)', () => {
  // 실측으로 잡힌 결함: 429.375 같은 분수 변에서 round() 스냅이 선을 0.5px 바깥으로 밀었다.
  for (const [t, b] of [[429.375, 523.773], [100, 200], [10.9, 20.1], [0.2, 3.8]]) {
    for (const k of [1, 2, 3]) for (const h of [0.5, 0.75]) {   // 0.75 = --overlay 흰 점선(1.5px)
      const T = _snapLo(t, k, h), B = _snapHi(b, k, h);
      assert.ok(T - h >= t - 1e-9, `dpr${k}/h${h}: 윗선 ${T} 이 상자 위(${t}) «밖»으로 나갔다`);
      assert.ok(B + h <= b + 1e-9, `dpr${k}/h${h}: 아랫선 ${B} 이 상자 아래(${b}) «밖»으로 나갔다`);
      // ★인수조건 「코너 일치 = 축별 ≤ 0.5 + 1/dpr」의 «유도»를 여기서 못박는다.
      //   축별 편차 = (선 중심 − 상자 변) = 0.5(굵기 절반) + snapGap, snapGap < 1/dpr.
      assert.ok(T - t <= h + 1 / k + 1e-9,
        `dpr${k}/h${h}: 축별 편차 ${T - t} 가 유도 상한 ${h + 1 / k} 를 넘었다 — 상한이 깨지면 «표류»다`);
      assert.ok(T - h - t < 1 / k + 1e-9, `dpr${k}/h${h}: 스냅 몫이 1/dpr 을 넘었다`);
    }
  }
});

test('구간 빼기 — 겹침 없음·전부·부분·가운데 쪼개기', () => {
  eqIv(subtractInterval([[0, 10]], 20, 30), [[0, 10]], '떨어진 구간은 안 건드린다');
  eqIv(subtractInterval([[0, 10]], 0, 10), [], '완전히 겹치면 사라진다');
  eqIv(subtractInterval([[0, 10]], -5, 4), [[4, 10]], '왼쪽 부분겹침 → 남는 구간만');
  eqIv(subtractInterval([[0, 10]], 6, 99), [[0, 6]], '오른쪽 부분겹침 → 남는 구간만');
  eqIv(subtractInterval([[0, 10]], 4, 6), [[0, 4], [6, 10]], '가운데는 «둘로 쪼갠다»');
});

test('★§4-2 — 위아래로 «맞닿은» 두 상자: 뒤 상자의 «윗변만» 사라진다', () => {
  const a = box(100, 100, 300, 200);          // A.bottom = 200
  const b = box(100, 200, 300, 300);          // B.top    = 200  (간격 0)
  _dedupe([a, b]);
  assert.equal(len(b.edges.top), 0, 'B 의 윗변이 남아 있으면 경계가 «2px» 로 그려진다(현빈 제보 ⑶ 그 자체)');
  assert.ok(len(a.edges.bottom) > 0, 'A 의 아랫변은 «살아야» 한다 — 경계선이 아예 사라지면 그건 고친 게 아니다');
  assert.ok(len(a.edges.top) > 0 && len(b.edges.bottom) > 0, '맞닿지 않은 변은 손대지 않는다');
  assert.ok(len(b.edges.left) > 0 && len(b.edges.right) > 0, '세로변은 손대지 않는다');
});

test('★위험4(10% 거짓 맞닿음) — «디바이스 픽셀 하나보다 넓게» 벌어지면 지우지 않는다', () => {
  /* 실측으로 정정된 규칙. 10% 축소 · 문서 8px 간격 = 화면 0.8px 일 때 옛 임계(1 CSS px)는
   * 아래 상자의 윗변을 통째로 지웠다 — 화면엔 «두 선 + 그 사이 배경 2행»이 실재했는데도.
   * dpr 2 → 임계 0.5. 0.8 은 «지우면 안 되고», 0.4 는 한 픽셀 안이라 지워도 된다. */
  const A = box(100, 100, 300, 200);
  const far = box(100, 200.8, 300, 300);      // 0.8px — 사람이 «볼 수 있다»
  _dedupe([A, far]);
  assert.ok(len(far.edges.top) > 0, '0.8px(디바이스 1.6행) 떨어진 선을 지웠다 — 한 줄이 «없어진다»');

  const A2 = box(100, 100, 300, 200);
  const near = box(100, 200.4, 300, 300);     // 0.4px — 한 디바이스 픽셀 안, 구분 불가
  _dedupe([A2, near]);
  assert.equal(len(near.edges.top), 0, '한 픽셀 안에서 겹치는 두 선은 여전히 «한 줄»이어야 한다');

  const A3 = box(100, 100, 300, 200);
  const flush = box(100, 200, 300, 300);      // 진짜 맞닿음 — 어떤 배율에서도 잡혀야 한다
  _dedupe([A3, flush]);
  assert.equal(len(flush.edges.top), 0, '간격 0 인 «진짜» 맞닿음을 놓쳤다');
});

test('★음성대조 — 3px 떨어져 있으면 «지우지 않는다»', () => {
  const a = box(100, 100, 300, 200);
  const b = box(100, 203, 300, 300);
  _dedupe([a, b]);
  assert.ok(len(b.edges.top) > 0, '떨어진 상자의 변을 지우면 «선이 없어진» 것이지 고친 게 아니다');
});

test('부분 겹침 — 겹친 x 구간만 빠지고 «남는 구간»은 그린다', () => {
  const a = box(100, 100, 200, 200);
  const b = box(150, 200, 300, 300);          // x 로 150~200 만 겹친다
  const base = len(box(150, 200, 300, 300).edges.top);   // 지우기 «전» 길이(모퉁이 연장 포함)
  _dedupe([a, b]);
  const now = len(b.edges.top);
  assert.ok(now > 0, '남는 구간이 있어야 한다');
  assert.ok(now < base, '겹친 구간은 빠져야 한다');
  // ★기대값을 «스냅된 실제 좌표»에서 뽑는다 — 원좌표 50 을 박아 두면 스냅·모퉁이 연장이 바뀔 때마다 늙는다.
  const overlap = Math.min(a.g.R, b.g.R) - Math.max(a.g.L, b.g.L);
  assert.ok(Math.abs((base - now) - overlap) < 1e-6,
    `지운 길이 ${base - now} 가 두 변의 실제 겹침 ${overlap} 과 다르다`);
  // ⛔부분 겹침에서는 «안쪽 끝»을 h 만큼 더 갉으면 안 된다 — 남아야 할 선이 줄어든다.
  assert.ok(b.edges.top.some(([p, q]) => q - p > 90), '오른쪽에 남아야 할 긴 구간이 사라졌다');
});

test('좌우로 맞닿아도 «세로변»이 중복제거된다', () => {
  const a = box(100, 100, 200, 300);
  const b = box(200, 100, 320, 300);
  _dedupe([a, b]);
  assert.equal(len(b.edges.left), 0, 'B 의 왼변이 남으면 세로 경계도 2px 이 된다');
  assert.ok(len(a.edges.right) > 0, 'A 의 오른변은 살아야 한다');
});

test('★회전/조상회전 상자는 dedupe 에 «참여하지 않는다»', () => {
  const a = box(100, 100, 300, 200, { dedupable: false });
  const b = box(100, 200, 300, 300);
  _dedupe([a, b]);
  assert.ok(len(b.edges.top) > 0,
    '폴리곤이 «틀린»(AABB) 상자로 남의 변을 지우면 두 배로 나쁘다 — 회전 상자는 빠져야 한다');
});

test('★3단 쌓임 — 가운데 상자는 «위·아래 둘 다» 빠지고 바깥 변은 산다', () => {
  const a = box(100, 100, 300, 200);
  const b = box(100, 200, 300, 300);
  const c = box(100, 300, 300, 400);
  _dedupe([a, b, c]);
  assert.equal(len(b.edges.top), 0);
  assert.equal(len(c.edges.top), 0);
  assert.ok(len(a.edges.top) > 0 && len(c.edges.bottom) > 0, '맨 위·맨 아래 바깥 변은 살아야 한다');
  assert.ok(len(a.edges.bottom) > 0 && len(b.edges.bottom) > 0, '앞 상자 쪽 선이 «경계»를 책임진다');
});

test('★DOM 뒤 상자에서 뺀다 — 순서를 뒤집어도 «지워지는 쪽»이 뒤 상자다', () => {
  const b = box(100, 200, 300, 300);   // 이번엔 아래 상자가 «앞»
  const a = box(100, 100, 300, 200);   // 위 상자가 «뒤»
  _dedupe([b, a]);
  assert.equal(len(a.edges.bottom), 0, '뒤 상자(a)의 아랫변이 빠져야 한다');
  assert.ok(len(b.edges.top) > 0, '앞 상자(b)의 윗변은 살아야 한다');
});


test('★적대검수 조건① — border-radius 가 있으면 직선이 «호만큼 물러나고» 호가 따로 그려진다', () => {
  const R = 12;
  const plain  = box(100, 100, 300, 300);
  const rounded = box(100, 100, 300, 300, { r: { nw:[R,R], ne:[R,R], se:[R,R], sw:[R,R] } });
  const len = ivs => ivs.reduce((s, [a, b]) => s + (b - a), 0);
  assert.ok(len(rounded.edges.top) < len(plain.edges.top) - 2 * R + 1e-6,
    '반경이 있는데 윗변이 «끝까지» 그려진다 — SVG 직선이 둥근 모서리를 가로지른다(퇴행 그 자체)');
  const g = plain.g;
  assert.ok(Math.abs(len(rounded.edges.top) - ((g.R - g.L) - 2 * R)) < 1e-6,
    `윗변은 «스냅 좌표 사이 − 양쪽 반경» 이어야 한다(반경이 있으면 생 변까지 안 늘린다): ${len(rounded.edges.top)}`);
  for (const e of ['top','bottom','left','right']) assert.ok(len(rounded.edges[e]) > 0, e + ' 가 통째로 사라졌다');
});

test('★적대검수 조건② — 맞닿은 두 상자의 «세로변»이 모퉁이에서 끊기지 않는다', () => {
  const A = box(100, 100, 300, 200);
  const B = box(100, 200, 300, 300);
  _dedupe([A, B]);
  const aL = A.edges.left.at(-1), bL = B.edges.left[0];
  assert.ok(aL && bL, '세로변이 비었다');
  assert.ok(bL[0] <= aL[1] + 1e-9,
    `위 상자 왼변이 ${aL[1]} 에서 끝나는데 아래 상자 왼변이 ${bL[0]} 에서 시작한다 — 그 사이가 «구멍»이다`);
  // 늘림은 «반굵기까지만» — 그 이상이면 상자 밖이라 §4-3 이 깨진다
  assert.ok(aL[1] <= A.g.raw.b + 1e-9, '아래로 상자 «밖»까지 늘렸다 — 이웃 불가침이 깨진다');
  assert.ok(bL[0] >= B.g.raw.t - 1e-9, '위로 상자 «밖»까지 늘렸다');
  assert.ok(Math.abs(bL[0] - aL[1]) < 1e-9,
    `구멍이 ${bL[0] - aL[1]} 남았다 — 두 세로변은 «같은 좌표»에서 만나야 한다(h 만 늘리면 절반만 닫힌다)`);
});

test('★적대검수 조건③ — 굵기 1.5px(흰 점선)에서도 선이 상자 «안»에 있다', () => {
  const b = box(100.3, 200.7, 400.9, 500.1, { h: 0.75 });
  assert.ok(b.g.T - 0.75 >= 200.7 - 1e-9, '1.5px 선의 위쪽 가장자리가 상자 밖으로 나갔다');
  assert.ok(b.g.B + 0.75 <= 500.1 + 1e-9, '아래쪽 가장자리가 상자 밖으로 나갔다');
  assert.ok(b.g.L - 0.75 >= 100.3 - 1e-9, '왼쪽 가장자리가 상자 밖으로 나갔다');
  assert.ok(b.g.R + 0.75 <= 400.9 + 1e-9, '오른쪽 가장자리가 상자 밖으로 나갔다');
});
