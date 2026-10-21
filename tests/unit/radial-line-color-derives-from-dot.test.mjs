/* radial-line-color-derives-from-dot.test.mjs — ★T4-02-DERIVE-LOCK (2026-10-21 지디)
 *
 * ★요구는 «값»이 아니라 «★관계»다.
 *   현빈 t4-02 원문: 「선 색이 왜 이걸로 되어있는지? C9BDF5이걸로 되어있는데 ★점색과 통일시켜줘 c9cdd6」
 *   ⇒ 뜻은 「★선 색 = ★점 색」. (적어 주신 `c9cdd6` 는 코드에 ★0건이고 참 점색이 `#c8cdd6` 라
 *      지디가 「점색과 통일」을 따라 `#c8cdd6` 로 확정했다 — ★현빈 확인 대기. 노트 「현빈 결정 대기」.)
 *
 * ★★왜 이 자가 따로 필요한가 (S6 가 2026-10-21 에 실측으로 찾은 구멍)
 *   라디얼 A1 spec 은 선 색·점 색·dataset·패널 hex 를 ★모두 ★리터럴 '#c8cdd6' 에 묶는다.
 *   ⇒ 「항등식」은 아니다(점 색 기본값이 바뀌면 그 단언이 빨강이 된다).
 *   ⛔그런데 ★★«값은 그대로 두고 ★파생만 끊는» 변이 —
 *        `lineColor: RADIAL_DOT_COLOR` → `lineColor: '#c8cdd6'`
 *      — 는 ★★아무 검사도 못 잡는다. 값이 맞으니 전부 초록이다.
 *   ⇒ ★두 기본값 «사이의 관계»를 재는 칸이 ★없었다.
 *
 * ★왜 행위(DOM)로 안 재고 구조로 잠그나
 *   이 관계는 «★기본값 둘» 사이의 것이다. 런타임에 점 색을 바꿔도 ★기본값은 안 움직인다
 *   ⇒ 사용자 길로는 이 관계가 ★드러나지 않는다. ★행위로 못 재는 자리는 ★구조로 잠근다.
 *
 * ★단언 셋은 «한 묶음»이다 — 하나만으로는 각각 새는 구멍이 있다
 *   ㉠ 둘의 오른쪽이 ★같은 식별자다        ← 홀로 두면: 둘이 «다른 상수»를 가리켜도 통과
 *   ㉡ ⛔둘 다 «#» 리터럴이 ★아니다        ← 홀로 두면: 값만 같게 적어도 통과(★그 구멍)
 *   ㉢ 그 식별자의 정의가 '#c8cdd6' 이다   ← 홀로 두면: ㉠ 가 깨져도 값은 맞아 보인다
 *
 * ⛔이 파일이 ★이름에 안 매이게 짜여 있다 — `RADIAL_DOT_COLOR` 라는 ★이름을 단언하지 않는다.
 *   까닭: 이 자를 쓸 때 상수는 ★다른 레인(인텔)에 있었고 나는 그 판을 ★못 읽었다.
 *   ⇒ 「상수 이름」은 ★남이 준 수다. ★관계만 재면 이름이 무엇이든 선다.
 *
 * ⚠️★이 커밋에 ★«실파일 단언»은 ★없다 — ★일부러다.
 *   dev(8f9730da)에는 상수가 ★아직 없다(`lineColor: '#c9bdf5'` · `dotColor: '#c8cdd6'` 리터럴 둘).
 *   실파일 단언을 지금 넣으면 ★★«일부러 빨강»이 되고, 그 빨강이 ★다음 빨강을 가린다.
 *   ⇒ 여기서는 ★«자»(파서 + 단언 셋)를 ★fixture 로 잠그고,
 *     ★★실파일 한 줄은 ★S6 ⒜ 머지 커밋에 ★같이 넣는다(BACKLOG T4-02-DERIVE-LOCK 머지 게이트).
 *   ★그 한 줄이 없으면 ⒜ 머지 GO 를 주지 않는다 — 그게 이 규칙을 ★집행하는 자리다.
 *
 * ⚠️★거둘 조건: 현빈이 ⒝(적으신 `c9cdd6` 그대로)를 고르면 ★「통일」이 뜻을 잃는다
 *   ⇒ 파생을 풀 때 ★이 파일도 ★같이 거둬라. ⛔남기면 ★영원히 빨강인 자가 되고,
 *     그러면 누군가 기준선을 ★조용히 낮춘다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const _req = createRequire(import.meta.url);
/* ⛔주석 걷개를 손으로 짜지 마라 — 레포에 부품이 «하나» 있다(그 머리말에 까닭 11벌 사례). */
const { makeStripper, templateBalanced } = _req('./_strip-comments.js');

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC_REL = 'js/blocks/radial-block.js';

/** 상태를 든 거르개로 «줄마다» 훑는다(부품 머리말이 요구하는 꼴). */
const strip = (src) => { const s = makeStripper(); return src.split('\n').map(s).join('\n'); };

/** `const <NAME> = Object.freeze({ … })` 의 «몸»만 돌려준다.
 *  ⛔객체 몸으로 좁히는 까닭: 같은 파일 뒤쪽에 `lineColor: _color(d.lineColor, D.lineColor)` 가 있다.
 *     파일 전체에서 `lineColor:` 를 집으면 ★그 줄을 집어 ★엉뚱한 것을 잰다. */
function frozenObjectBody(code, name) {
  const m = code.match(new RegExp(`const\\s+${name}\\s*=\\s*Object\\.freeze\\(\\s*\\{([\\s\\S]*?)\\}\\s*\\)`));
  return m ? m[1] : null;
}

/** 객체 몸에서 키의 «오른쪽 토큰»을 그대로(문자열 꼴 포함) 돌려준다. */
function rhsOf(body, key) {
  const m = body.match(new RegExp(`(?:^|[,{\\s])${key}\\s*:\\s*([^,\\n}]+)`));
  return m ? m[1].trim() : null;
}

/** `const <ident> = '<값>'` 의 값. 없으면 null. */
function constLiteral(code, ident) {
  const m = code.match(new RegExp(`const\\s+${ident}\\s*=\\s*'([^']*)'`));
  return m ? m[1] : null;
}

const HEX_LITERAL = /^'#[0-9a-fA-F]{3,8}'$/;

/** ★자 — 단언 셋을 한 번에 재서 «무엇이 깨졌나»를 이름으로 돌려준다.
 *  ⇒ 테스트가 rc 하나로 뭉개지지 않게, ★깨진 칸의 «이름»을 세는 꼴로 둔다. */
function measure(code, { objName = 'RADIAL_DEFAULTS', expectHex = '#c8cdd6' } = {}) {
  const body = frozenObjectBody(code, objName);
  if (body === null) return { premise: false, broken: ['전제: 객체를 못 찾음'] };
  const line = rhsOf(body, 'lineColor');
  const dot = rhsOf(body, 'dotColor');
  if (line === null || dot === null) return { premise: false, broken: ['전제: 키를 못 찾음'], line, dot };

  const broken = [];
  /* ㉠ 같은 식별자인가 */
  if (line !== dot) broken.push('㉠ 선 색과 점 색이 같은 식별자가 아니다');
  /* ㉡ 둘 다 # 리터럴이 아닌가 — ★값만 같게 적는 변이를 잡는 칸 */
  if (HEX_LITERAL.test(line)) broken.push('㉡ 선 색이 # 리터럴로 박혀 있다(파생이 끊겼다)');
  if (HEX_LITERAL.test(dot)) broken.push('㉡ 점 색이 # 리터럴로 박혀 있다(파생이 끊겼다)');
  /* ㉢ 그 식별자의 정의가 기대 값인가 — ㉠㉡ 가 섰을 때만 뜻이 있다 */
  if (!broken.length) {
    const v = constLiteral(code, line);
    if (v === null) broken.push(`㉢ 식별자 ${line} 의 정의를 못 찾았다`);
    else if (v !== expectHex) broken.push(`㉢ ${line} = '${v}' (기대 '${expectHex}')`);
  }
  return { premise: true, broken, line, dot };
}

/* ───────────── fixture — ★자를 잠근다 ───────────── */

const FIX = {
  /* 파생된 꼴 — S6 가 b919e05c 에 넣은 모양(★내가 그 판을 못 읽어 «꼴»로만 적는다) */
  good: `
const RADIAL_DOT_COLOR = '#c8cdd6';
const RADIAL_DEFAULTS = Object.freeze({
  line: 'orbit', lineColor: RADIAL_DOT_COLOR, lineStyle: 'dashed',
  marker: 'cell', dotSize: 18, dotColor: RADIAL_DOT_COLOR, iconSize: 36,
});
`,
  /* ★★이 커밋의 이유 — 값은 맞고 파생만 끊긴 꼴. 다른 어떤 검사도 이걸 못 잡는다. */
  literalBoth: `
const RADIAL_DOT_COLOR = '#c8cdd6';
const RADIAL_DEFAULTS = Object.freeze({
  line: 'orbit', lineColor: '#c8cdd6', lineStyle: 'dashed',
  marker: 'cell', dotSize: 18, dotColor: '#c8cdd6', iconSize: 36,
});
`,
  /* 둘이 «다른» 상수를 가리키는 꼴 — ㉠ 만 있으면 통과해 버리는 구멍 */
  twoConsts: `
const RADIAL_DOT_COLOR = '#c8cdd6';
const RADIAL_LINE_COLOR = '#c8cdd6';
const RADIAL_DEFAULTS = Object.freeze({
  line: 'orbit', lineColor: RADIAL_LINE_COLOR, lineStyle: 'dashed',
  marker: 'cell', dotSize: 18, dotColor: RADIAL_DOT_COLOR, iconSize: 36,
});
`,
  /* 상수 정의 값이 바뀐 꼴 */
  wrongConst: `
const RADIAL_DOT_COLOR = '#000000';
const RADIAL_DEFAULTS = Object.freeze({
  line: 'orbit', lineColor: RADIAL_DOT_COLOR, lineStyle: 'dashed',
  marker: 'cell', dotSize: 18, dotColor: RADIAL_DOT_COLOR, iconSize: 36,
});
`,
  /* dev(8f9730da)가 지금 가진 꼴 — 선은 보라, 점은 회색. ★실파일 단언의 «고치기 전 판»이다. */
  devToday: `
const RADIAL_DEFAULTS = Object.freeze({
  line: 'orbit', lineColor: '#c9bdf5', lineStyle: 'dashed',
  marker: 'cell', dotSize: 18, dotColor: '#c8cdd6', iconSize: 36,
});
`,
};

test('B0 전제 — 부품이 살아 있고 실파일이 읽히고 템플릿이 닫혀 있다', () => {
  assert.equal(typeof makeStripper, 'function', 'makeStripper 가 함수여야 한다');
  const raw = fs.readFileSync(path.join(REPO, SRC_REL), 'utf8');
  assert.ok(raw.length > 1000, `${SRC_REL} 가 읽혀야 한다 (${raw.length} 바이트)`);
  assert.equal(templateBalanced(raw), true, '템플릿 리터럴이 닫혀 있어야 한다(거르개의 전제)');
  /* ★실파일에서도 자가 «돈다»는 것까지 — 깨진 칸 이름은 여기서 안 센다(아래 R0 가 기록한다) */
  const m = measure(strip(raw));
  assert.equal(m.premise, true, `실파일에서 ${SRC_REL} 의 RADIAL_DEFAULTS 를 찾아야 한다`);
});

test('D1 자가 산다 — 파생된 꼴은 깨진 칸이 0이다', () => {
  const m = measure(strip(FIX.good));
  assert.deepEqual(m.broken, [], '파생된 꼴은 통과해야 한다');
  assert.equal(m.line, m.dot, '두 오른쪽이 같은 토큰이어야 한다');
});

test('★D2 양성대조 — 값은 그대로 두고 파생만 끊으면 ㉠·㉡ 가 빨강 (★이 파일이 있는 이유)', () => {
  const m = measure(strip(FIX.literalBoth));
  assert.equal(m.premise, true);
  assert.ok(m.broken.some((b) => b.startsWith('㉡')), `㉡ 가 잡아야 한다 — 잡힌 것: ${JSON.stringify(m.broken)}`);
  /* ⛔값으로 재는 자는 이 꼴을 못 잡는다는 것을 «같이» 단언한다 —
     그래야 이 칸이 사라질 때 「왜 있었나」가 드러난다. */
  const body = frozenObjectBody(strip(FIX.literalBoth), 'RADIAL_DEFAULTS');
  assert.equal(rhsOf(body, 'lineColor'), "'#c8cdd6'", '값으로만 보면 기대 값과 같다(그래서 안 잡혔다)');
  assert.equal(rhsOf(body, 'lineColor'), rhsOf(body, 'dotColor'), '값으로만 보면 선과 점이 같다(그래서 안 잡혔다)');
});

test('★D3 양성대조 — 서로 다른 상수를 가리키면 ㉠ 가 빨강', () => {
  const m = measure(strip(FIX.twoConsts));
  assert.ok(m.broken.some((b) => b.startsWith('㉠')), `㉠ 가 잡아야 한다 — 잡힌 것: ${JSON.stringify(m.broken)}`);
});

test('★D4 양성대조 — 상수 정의 값이 다르면 ㉢ 가 빨강', () => {
  const m = measure(strip(FIX.wrongConst));
  assert.ok(m.broken.some((b) => b.startsWith('㉢')), `㉢ 가 잡아야 한다 — 잡힌 것: ${JSON.stringify(m.broken)}`);
  assert.ok(m.broken.every((b) => !b.startsWith('㉠') && !b.startsWith('㉡')), '㉠㉡ 는 서 있어야 한다(㉢ 만 깨진 판)');
});

test('★D5 양성대조 — dev 가 오늘 가진 꼴(선=보라 · 점=회색)은 ㉠·㉡ 둘 다 빨강', () => {
  const m = measure(strip(FIX.devToday));
  assert.ok(m.broken.some((b) => b.startsWith('㉠')), '㉠ 가 잡아야 한다');
  assert.ok(m.broken.some((b) => b.startsWith('㉡')), '㉡ 가 잡아야 한다');
});

/* ⛔★이 칸은 ★한 번 ★죽은 자였다(2026-10-21) — ★고친 기록을 남긴다.
 *   첫 판은 가짜 주석을 ★객체 ★«밖»(const 줄 앞)에 심었다. 그런데 `frozenObjectBody` 는
 *   ★중괄호 ★«안»만 읽으므로 ★걷든 안 걷든 ★측정에 ★닿지 않았다
 *   ⇒ ★거르개를 ★빼도 ★초록이었다 = ★★이 칸은 ★아무것도 증명하지 않았다.
 *   ★고침: 가짜를 ★객체 ★«안»의, ★진짜 `lineColor` ★«앞»에 심는다 — 걷지 않으면 ★그것이 먼저 잡힌다. */
const FIX_COMMENT_INJECTED = `
const RADIAL_DOT_COLOR = '#c8cdd6';
const RADIAL_DEFAULTS = Object.freeze({
  // lineColor: '#c9bdf5'   ← 가짜(줄 주석) · 걷지 않으면 이것이 먼저 잡힌다
  /* lineColor: '#c9bdf5'      가짜(블록 주석) */
  line: 'orbit', lineColor: RADIAL_DOT_COLOR, lineStyle: 'dashed',
  marker: 'cell', dotSize: 18, dotColor: RADIAL_DOT_COLOR, iconSize: 36,
});
`;

test('⛔D6 주석대조 — 객체 «안»에 심은 가짜 lineColor 는 안 센다(거르개가 도는지)', () => {
  const m = measure(strip(FIX_COMMENT_INJECTED));
  assert.deepEqual(m.broken, [], `주석을 심어도 통과해야 한다 — 잡힌 것: ${JSON.stringify(m.broken)}`);
  assert.equal(m.line, 'RADIAL_DOT_COLOR', '걷은 뒤에는 ★진짜 오른쪽이 잡혀야 한다');
  /* ★★이 칸이 ★사는지의 증거 — ★걷지 ★않으면 ★가짜가 ★잡힌다. ★그래야 ★거르개가 ★뜻이 있다. */
  const unstripped = measure(FIX_COMMENT_INJECTED);
  /* ⛔꼬리까지 ★그대로 잡힌다(쉼표가 없어 줄 끝까지) — ★그래서 ★완전일치로 재지 않는다.
     ★재는 것은 ★「가짜가 ★잡혔나」다. */
  assert.ok(
    unstripped.line.startsWith("'#c9bdf5'"),
    `★걷지 않으면 주석의 가짜가 잡힌다(= 거르개가 일을 한다) — 잡힌 것: ${JSON.stringify(unstripped.line)}`,
  );
  assert.notEqual(unstripped.line, m.line, '★걷은 값과 안 걷은 값이 ★달라야 한다(같으면 이 칸은 아무것도 안 잰다)');
  assert.ok(unstripped.broken.length > 0, '★걷지 않으면 깨진 칸이 생긴다');
});

test('⛔D7 음성대조 — 없는 객체 이름으로는 전제가 서지 않는다(자가 아무것이나 통과시키지 않는다)', () => {
  const m = measure(strip(FIX.good), { objName: 'ZZZ_NO_SUCH_OBJECT' });
  assert.equal(m.premise, false, '없는 객체면 전제 거짓이어야 한다');
  assert.deepEqual(m.broken, ['전제: 객체를 못 찾음']);
});

test('R0 기록 — 실파일이 ★지금 어느 꼴인가 (⛔판정이 아니라 ★기록이다)', () => {
  const code = strip(fs.readFileSync(path.join(REPO, SRC_REL), 'utf8'));
  const m = measure(code);
  assert.equal(m.premise, true);
  /* ⛔여기서 `broken` 이 0 이라고 ★단언하지 않는다 — 상수가 들어오는 것은 S6 ⒜ 머지다.
     ★대신 «오른쪽 토큰 둘»을 단언해 ★판을 못 박는다. 머지가 들어오면 ★이 줄이 빨강이 되고,
     그때 ★여기를 «파생 단언»으로 바꾸는 것이 ⒜ 머지 커밋의 ★할 일이다(BACKLOG 머지 게이트). */
  assert.deepEqual(
    [m.line, m.dot],
    ["'#c9bdf5'", "'#c8cdd6'"],
    '★이 줄이 빨개지면 = 라디얼 기본값이 움직였다 ⇒ T4-02-DERIVE-LOCK 의 «실파일 단언»으로 바꿔라(BACKLOG)',
  );
});
