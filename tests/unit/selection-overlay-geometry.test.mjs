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
// ⚠️주석에는 «왜 뺐는지»가 남아 있어야 하므로 «코드»만 보고 판정한다.
const CODE_ONLY = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
assert.ok(!/function _dedupe|function _span|subtractInterval|TOUCH_DEVICE_PX/.test(CODE_ONLY),
  '★dedupe 잔재가 «코드»에 남아 있다 — 명분이 실측으로 사라져 통째로 뺐다(되살리려면 먼저 재라)');
const SNAP = [...SRC.matchAll(/const _snap(Lo|Hi) = [^\n;]+;/g)].map(m => m[0]);
assert.equal(SNAP.length, 2, '_snapLo/_snapHi 정의를 못 찾았다 — 스냅이 «두 갈래»여야 선이 상자 밖으로 안 샌다');
const ctx = vm.createContext({});
vm.runInContext(
  SNAP.join('\n') + '\n' +
  slice('function _edgesOf') + '\n' +
  'const _ZERO_R = { nw:[0,0], ne:[0,0], se:[0,0], sw:[0,0] };\n' +
  'globalThis.__pure = { _edgesOf, _snapLo, _snapHi };',
  ctx);
const { _edgesOf, _snapLo, _snapHi } = ctx.__pure;
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


test('★적대검수 조건③ — 굵기 1.5px(흰 점선)에서도 선이 상자 «안»에 있다', () => {
  const b = box(100.3, 200.7, 400.9, 500.1, { h: 0.75 });
  assert.ok(b.g.T - 0.75 >= 200.7 - 1e-9, '1.5px 선의 위쪽 가장자리가 상자 밖으로 나갔다');
  assert.ok(b.g.B + 0.75 <= 500.1 + 1e-9, '아래쪽 가장자리가 상자 밖으로 나갔다');
  assert.ok(b.g.L - 0.75 >= 100.3 - 1e-9, '왼쪽 가장자리가 상자 밖으로 나갔다');
  assert.ok(b.g.R + 0.75 <= 400.9 + 1e-9, '오른쪽 가장자리가 상자 밖으로 나갔다');
});

test('★§4-2 의 «진짜 근거» — 맞닿은 두 상자의 선은 dedupe 없이도 «겹치지 않는다»', () => {
  /* 설계안은 「dedupe 가 유일한 해법」이라 했고 팀장이 승인했다. 실측이 그 전제를 뒤집었다:
   * 안쪽 디바이스 격자 스냅이 각 선을 자기 상자 «안»으로 밀기 때문에, 간격 0 이어도 두 선은
   * 이미 떨어져 있다. ⇒ 경계에 «2px 띠»가 생길 수 없다(각 선은 여전히 1 CSS px).
   * ★이 검사가 그 «메커니즘»을 지킨다 — 스냅을 되돌리면 여기서 빨강이 된다. */
  for (const edge of [200, 200.4, 429.375, 523.773, 77.9]) {
    for (const k of [1, 2, 3]) for (const h of [0.5, 0.75]) {
      const aB = _snapHi(edge, k, h);        // 위 상자의 아랫선 중심
      const bT = _snapLo(edge, k, h);        // 아래 상자의 윗선 중심 (같은 변에서 맞닿음)
      assert.ok(bT - aB >= 2 * h - 1e-9,
        `dpr${k}/h${h}/edge${edge}: 두 선이 ${bT - aB} 만큼 떨어져 있다 — 2h(${2*h}) 미만이면 «겹쳐서 2px 띠»가 된다`);
      assert.ok(aB + h <= edge + 1e-9 && bT - h >= edge - 1e-9,
        `dpr${k}/h${h}/edge${edge}: 선이 자기 상자 «밖»으로 나갔다`);
    }
  }
});

test('★맞닿아도 각 변은 «온전히» 그려진다(정보를 지우지 않는다)', () => {
  /* dedupe 가 하던 일 = 뒤 상자의 그 변을 «통째로» 삭제. 그 결과 두 블록이 «한 상자»로 읽혔다.
   * 현빈 제보는 「두꺼워 보인다」였지 「경계를 없애라」가 아니다 — 두 블록이면 테두리도 둘이다. */
  const A = box(100, 100, 300, 200);
  const B = box(100, 200, 300, 300);
  const len = ivs => ivs.reduce((s, [a, b]) => s + (b - a), 0);
  assert.ok(len(A.edges.bottom) > 0 && len(B.edges.top) > 0,
    '맞닿은 두 상자의 «마주보는 변»이 둘 다 살아 있어야 한다');
  assert.ok(Math.abs(len(A.edges.bottom) - len(B.edges.top)) < 1e-9, '두 변 길이가 같아야 한다');
});

test('★조건② — 맞닿은 두 상자의 «세로변»이 모퉁이에서 끊기지 않는다', () => {
  const A = box(100, 100, 300, 200);
  const B = box(100, 200, 300, 300);
  const aL = A.edges.left.at(-1), bL = B.edges.left[0];
  assert.ok(aL && bL, '세로변이 비었다');
  assert.ok(Math.abs(bL[0] - aL[1]) < 1e-9,
    `구멍이 ${bL[0] - aL[1]} 남았다 — 두 세로변은 «같은 좌표»(생 변)에서 만나야 한다`);
  assert.ok(aL[1] <= A.g.raw.b + 1e-9 && bL[0] >= B.g.raw.t - 1e-9, '상자 «밖»까지 늘렸다');
});
