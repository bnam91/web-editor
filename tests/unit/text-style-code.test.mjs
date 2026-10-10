/* text-style-code.test.mjs — ★«스타일 번호»(1010t1a2 ③)의 ★자기검사.
 *   실행: node --test "tests/unit/*.test.mjs" "tests/unit/*.test.js"   (= npm test)
 *
 * ★무엇을 잠그나 — ★이 파일이 ★없으면 ★다음 사람이 ★전부 되돌릴 수 있는 것들:
 *   ⑴ ★정본은 ★CSS 변수다 — ★번호는 ★파생이다(저장 0)
 *   ⑵ ★개별은 ★복합을 ★자른 것이다 (★두 길이 ★한 글자도 안 다르다)
 *   ⑶ ★버전 1 은 ★3칸이다 (⒜-2 ㉢ · 지디 판정) ＋ ★명부가 늘어도 ★안 늘어난다
 *   ⑷ ★체크섬이 ★«칸 밀림»까지 잡는다 (dot 은 vars 5개 — ★한 칸 밀리면 size→gap)
 *   ⑸ ★버전이 다른 번호는 ★거절된다
 *
 * ⛔★기대값을 ★«피검 대상에서» 끌지 ★않는다 —
 *   `text-style-recent.dom.spec.js:375` 가 못박아 둔 그 규율이다:
 *   「기대값은 이 파일에 ★손으로 적은 리터럴이고, ⛔저장소 자기 코드에서 ★읽어 오지 않는다
 *     (읽어 오면 ★죽여도 ★초록이 된다)」
 *   ⇒ ★그래서 ★아래 ★번호 문자열 ★셋은 ★손으로 적었다. ★꼴을 바꾸면 ★여기도 ★같이 고쳐야 한다 —
 *     ★그게 ★«꼴이 바뀌었다»를 ★사람이 ★보게 하는 ★유일한 자다.
 *
 * ⛔★«빈 조각»의 ★뜻(손대지 않는다 / 끈다)은 ★미결이다 — ★이 파일은 ★그 갈림에 ★안 걸린다.
 *   `decode` 가 ★`null` 을 돌려주는 것까지만 ★잠근다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const _req = createRequire(import.meta.url);
const { loadTextStyleCode, loadRoster } = _req('./_text-style-code-harness.js');

const M = loadTextStyleCode();
const R = loadRoster();

/* ★표본 — ★나쁜 값을 ★일부러 넣는다: rgba 의 ★콤마 · ★소수점 · ★음수 px */
const VALS = {
  hl: { '--tb-hl-color': 'rgba(255,0,0,.5)', '--tb-hl-h': '0.5px', '--tb-hl-y': '-2px' },
  dot: { '--tb-dot-color': '#f00', '--tb-dot-size': '7px', '--tb-dot-gap': '2px', '--tb-dot-x': '0px', '--tb-dot-y': '-1px' },
  ul: { '--tb-ul-color': '#00f', '--tb-ul-thick': '3px', '--tb-ul-offset': '-10px' },
};
/* ★★손으로 적은 ★기대 번호 — ⛔tsEncode 로 ★만들지 않는다(그러면 ★항등식) */
const WANT_COMPOSITE = 'T1-rgba(255%2C0%2C0%2C%2E5),0%2E5px,%2D2px.#f00,7px,2px,0px,%2D1px.#00f,3px,%2D10px-6y';
const WANT_UL_ONE = 'T1-ul:#00f,3px,%2D10px-cn';
const WANT_HL_OFF = 'T1-.#f00,7px,2px,0px,%2D1px.#00f,3px,%2D10px-ka';

test('A1 전제 — 명부를 ★소스에서 긁었고 ★kind 4종·vars 11개다 (⛔손으로 안 적었다)', () => {
  assert.deepEqual(R.map((d) => d.k), ['hl', 'dot', 'ul', 'grad']);
  assert.deepEqual(R.map((d) => d.vars.length), [3, 5, 3, 0]);
  assert.equal(R.reduce((a, d) => a + d.vars.length, 0), 11);
});

test('A2 ★버전 1 은 ★3칸이다 — `grad` 는 ★없다 (⒜-2 ㉢)', () => {
  assert.deepEqual(M.TS_CODE_V1_KINDS, ['hl', 'dot', 'ul']);
  assert.equal(M.TS_CODE_VERSION, 1);
  assert.deepEqual(M.tsShape(R), [3, 5, 3]);
});

/* ★A2 와 ★짝 — ⛔이것이 없으면 ★명부가 늘 때 ★버전 1 이 ★조용히 어긋난다 */
test('A2b ★짝 — 「오늘 vars>0 인 kind 집합」 == TS_CODE_V1_KINDS (늘면 ★빨강 ⇒ ★버전 2 로 가라)', () => {
  const withVars = R.filter((d) => d.vars.length > 0).map((d) => d.k);
  assert.deepEqual(withVars, M.TS_CODE_V1_KINDS,
    `★vars 를 가진 kind 가 [${withVars}] 인데 ★버전 1 꼴은 [${M.TS_CODE_V1_KINDS}] 다`
    + ' — ★kind 가 늘었으면 ⛔버전 1 을 넓히지 말고 ★`TS_CODE_VERSION` 을 ★2 로 올려라');
});

test('A2c ★짝 — 명부에 kind 를 ★더해도 ★버전 1 꼴은 ★안 늘어난다 (M3)', () => {
  const grown = R.concat([{ k: 'zz', vars: ['--tb-zz-a', '--tb-zz-b'] }]);
  assert.deepEqual(M.tsShape(grown), [3, 5, 3], '★kind 를 더했는데 ★버전 1 조각 모양이 ★변했다');
  assert.equal(M.tsEncode(grown, VALS), WANT_COMPOSITE, '★kind 를 더했는데 ★버전 1 번호가 ★변했다');
});

test('A3 ★복합 — 번호가 ★손으로 적은 기대와 같다 (rgba 콤마·소수점·음수px 를 담는다)', () => {
  assert.equal(M.tsEncode(R, VALS), WANT_COMPOSITE);
});

test('A4 ★왕복 — decode 가 ★한 글자도 안 잃는다', () => {
  const d = M.tsDecode(R, WANT_COMPOSITE);
  assert.equal(d.ok, true, d.why);
  assert.deepEqual(d.vals, VALS);
});

test('A5 ★파생 — ★개별은 ★복합을 ★자른 것이다 (★두 길이 ★같다)', () => {
  assert.equal(M.tsEncodeOne(R, 'ul', VALS.ul), WANT_UL_ONE);
  assert.equal(M.tsSliceOne(R, WANT_COMPOSITE, 'ul'), WANT_UL_ONE);
  for (const k of M.TS_CODE_V1_KINDS) {
    assert.equal(M.tsSliceOne(R, WANT_COMPOSITE, k), M.tsEncodeOne(R, k, VALS[k]),
      `★${k}: ★복합에서 자른 것과 ★개별이 ★다르다 — ★파생이 ★두 벌이다`);
  }
});

test('A6 ★빈 조각 — ★꺼진 kind 는 ★빈 조각이 되고 decode 가 ★null 로 돌려준다 (★뜻은 ★미결)', () => {
  assert.equal(M.tsEncode(R, { hl: null, dot: VALS.dot, ul: VALS.ul }), WANT_HL_OFF);
  const d = M.tsDecode(R, WANT_HL_OFF);
  assert.equal(d.ok, true, d.why);
  assert.equal(d.vals.hl, null, '★빈 조각이 ★null 이 아니다 — 부르는 쪽이 ★뜻을 정할 수 없다');
  assert.deepEqual(d.vals.dot, VALS.dot);
});

test('A7 ⒞ 체크섬 — ★한 글자를 바꾸면 ★거절한다', () => {
  const bad = WANT_COMPOSITE.replace(/-([0-9a-z]{2})$/, (m, s) => `-${s[0]}${s[1] === 'z' ? 'y' : 'z'}`);
  assert.notEqual(bad, WANT_COMPOSITE, '★변이가 안 꽂혔다 — 이 통과는 0건짜리');
  const d = M.tsDecode(R, bad);
  assert.equal(d.ok, false);
  assert.match(d.why, /체크섬/);
});

test('A7b ⒞ 체크섬 — ★dot 조각의 ★칸을 ★한 칸 밀면 ★거절한다 (★size→gap 오타)', () => {
  /* dot 조각(둘째)에서 ★칸 하나를 ★뺀다 ⇒ ★값은 그럴듯한데 ★칸 수가 ★4개가 된다 */
  const segs = WANT_COMPOSITE.replace(/^T1-/, '').replace(/-[0-9a-z]{2}$/, '').split('.');
  segs[1] = segs[1].split(',').slice(1).join(',');
  const body = segs.join('.');
  const bad = `T1-${body}-${M.tsChecksum(WANT_COMPOSITE.slice(3, -3), [3, 5, 3])}`;
  const d = M.tsDecode(R, bad);
  assert.equal(d.ok, false, '★칸이 밀렸는데 ★통과했다');
  assert.match(d.why, /체크섬|칸이/);
});

test('A8 ⒝ 버전 — ★다른 버전 번호는 ★거절한다 (★조용히 다른 그림이 되지 않게)', () => {
  const v2 = WANT_COMPOSITE.replace(/^T1-/, 'T2-');
  const d = M.tsDecode(R, v2);
  assert.equal(d.ok, false);
  assert.match(d.why, /버전/);
});

test('A9 ★음성 — ★한 kind 의 조각만 바꾸면 ★다른 kind 는 ★안 변한다 (M6)', () => {
  const other = M.tsEncode(R, { ...VALS, ul: { ...VALS.ul, '--tb-ul-thick': '9px' } });
  assert.notEqual(other, WANT_COMPOSITE, '★바꿨는데 번호가 같다');
  const d = M.tsDecode(R, other);
  assert.equal(d.ok, true, d.why);
  assert.deepEqual(d.vals.hl, VALS.hl, '★ul 을 바꿨더니 ★hl 이 변했다');
  assert.deepEqual(d.vals.dot, VALS.dot, '★ul 을 바꿨더니 ★dot 이 변했다');
  assert.equal(d.vals.ul['--tb-ul-thick'], '9px');
});

test('A10 ★escape — ★구분자가 ★값 안에 있어도 ★왕복한다 (★개별 자로 따로)', () => {
  for (const s of ['rgba(1,2,3,.4)', '-10px', '0.5px', 'a%b', 'x:y', 'a.b-c,d%e']) {
    assert.equal(M.tsUnesc(M.tsEsc(s)), s, `★왕복이 깨졌다: ${s}`);
    assert.ok(!/[,.\-:]/.test(M.tsEsc(s).replace(/%[0-9A-Fa-f]{2}/g, '')), `★구분자가 ★남았다: ${s}`);
  }
});

/* ══ ★★«빈 조각»의 뜻 — ★미확정을 ★«검사로» 잠근다 ═══════════════════════════
 * ⛔「나중에」로 두면 ★다음 사람이 ★⌘Z 를 ★안 재고 ★한 갈래를 ★채운다.
 * ⇒ ★`TS_EMPTY_MEANS` 가 ★`'UNDECIDED'` 임을 ★단언한다 — ★채우려면 ★이 칸이 ★빨개지고,
 *   ★그 메시지가 ★★«무엇을 재야 하는지»(⌘Z 세 조건)를 ★그 자리에서 말한다.
 */
test('B1 ★갈림이 ★한 자리에 ★모여 있고 ★아직 ★미확정이다 (⛔가정으로 짓지 않았다)', () => {
  assert.equal(M.TS_EMPTY_MEANS, 'UNDECIDED',
    '★«빈 조각»의 뜻이 ★채워졌다 — ★채우기 ★전에 ★★«⌘Z 한 번으로 돌아오나»를 ★재야 한다:\n'
    + '  ㉠ 창 차례의 ★첫 칸  ㉡ ★양성대조(⌘Z 가 ★무언가는 되돌린다를 ★먼저)\n'
    + '  ㉢ ★깊이 — 붙여넣기가 ★한 칸인가 ★N 칸인가 (N 칸이면 ★한 번으로 안 돌아온다)\n'
    + '  ⇒ 돌아오면 ★㉡(끈다) · 안 돌아오면 ★㉠(손대지 않는다) · N 칸이면 ★한 칸 묶기는 ★지디 판정');
});

test('B2 ★계획 — ★입힐 것과 ★빈 조각을 ★갈라 주고, ⛔입히지는 ★않는다', () => {
  const p = M.tsApplyPlan(R, WANT_HL_OFF);
  assert.equal(p.ok, true, p.why);
  assert.deepEqual(p.empty, ['hl'], '★빈 조각을 ★안 골라냈다');
  assert.deepEqual(Object.keys(p.set).sort(), ['dot', 'ul']);
  assert.deepEqual(p.set.dot, VALS.dot);
  assert.equal(p.emptyMeans, 'UNDECIDED', '★부르는 쪽이 ★멈출 근거가 없다');
  /* ★음성 — 빈 조각이 ★없으면 empty 가 ★빈 배열 */
  const q = M.tsApplyPlan(R, WANT_COMPOSITE);
  assert.deepEqual(q.empty, [], '★빈 조각이 없는데 ★있다고 한다');
  assert.deepEqual(Object.keys(q.set).sort(), ['dot', 'hl', 'ul']);
});

test('B3 ★나쁜 번호 — 계획이 ★ok:false 와 ★까닭을 준다 (⛔조용히 빈 계획을 주지 않는다)', () => {
  const p = M.tsApplyPlan(R, 'T2-x-aa');
  assert.equal(p.ok, false);
  assert.match(p.why, /버전/);
  assert.deepEqual(p.set, {}, '★실패인데 ★입힐 것을 줬다');
});
