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
const TOUCH = SRC.match(/const TOUCH_EPS = ([\d.]+)/);
assert.ok(TOUCH, 'TOUCH_EPS 상수를 못 찾았다');
const SNAP = SRC.match(/const _snap = [^\n;]+;/);
assert.ok(SNAP, '_snap 정의를 못 찾았다');
const ctx = vm.createContext({});
vm.runInContext(
  `const TOUCH_EPS = ${TOUCH[1]};\n` +
  SNAP[0] + '\n' +
  slice('export function subtractInterval') + '\n' +
  slice('function _dedupe') + '\n' +
  slice('function _edgesOf') + '\n' +
  'globalThis.__pure = { subtractInterval, _dedupe, _edgesOf, _snap };',
  ctx);
const { subtractInterval, _dedupe, _edgesOf, _snap } = ctx.__pure;

/** 축정렬 상자 하나를 items 원소로. (l,t,r,b) = 스크린 CSS px 생좌표. */
function box(l, t, r, b, opts = {}) {
  const g = {
    rot: false,
    raw: { l, t, r, b },
    L: _snap(l + 0.5), T: _snap(t + 0.5), R: _snap(r - 0.5), B: _snap(b - 0.5),
  };
  return { g, edges: _edgesOf(g), dedupable: opts.dedupable !== false };
}
const len = ivs => ivs.reduce((s, [a, b]) => s + (b - a), 0);
// ⚠️vm 컨텍스트의 배열은 «다른 Array.prototype» 이라 deepStrictEqual 이 프로토타입에서 갈린다
//   (실제로 여기서 한 번 헛짚었다). 값만 비교한다.
const eqIv = (got, want, msg) => assert.equal(JSON.stringify(got), JSON.stringify(want), msg);

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

test('★음성대조 — 3px 떨어져 있으면 «지우지 않는다»', () => {
  const a = box(100, 100, 300, 200);
  const b = box(100, 203, 300, 300);
  _dedupe([a, b]);
  assert.ok(len(b.edges.top) > 0, '떨어진 상자의 변을 지우면 «선이 없어진» 것이지 고친 게 아니다');
});

test('부분 겹침 — 겹친 x 구간만 빠지고 «남는 구간»은 그린다', () => {
  const a = box(100, 100, 200, 200);
  const b = box(150, 200, 300, 300);          // x 로 150~200 만 겹친다
  _dedupe([a, b]);
  const total = b.g.R - b.g.L;
  assert.ok(len(b.edges.top) > 0, '남는 구간이 있어야 한다');
  assert.ok(len(b.edges.top) < total, '겹친 구간은 빠져야 한다');
  assert.ok(Math.abs(len(b.edges.top) - (total - (200 - 150))) < 2, `남은 길이가 어긋난다: ${len(b.edges.top)}`);
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
