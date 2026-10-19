/* ══════════════════════════════════════════════════════════════════════════
   graph-vlabel-offset-1017t1f5 — 꺾은선 값 라벨(.grb-line-vlabel) 개별 위치 오프셋.

   ★왜 이 파일이 생겼나 — 1017t1f5 는 제품은 들어갔는데(판 cc564ac7·8e4eb4db) 검사가
     ★tests/dom 한 벌«뿐»이었다. 그 DOM 벌은 ⑴ 이 맥에서 못 돌고(메모리) ⑵ 머리말의
     [처음 실행 기록] 2회차가 rc 1 · 빨강 3(V4 V6 V7) 이고 ⑶ 그 뒤 6ad0b657 이 기대값을
     고친 뒤 ★3회차 기록이 없다 — 즉 지금 이 기능을 «재는 초록»이 하나도 없었다.
     ⇒ DOM 없이 잴 수 있는 자리(순수 식 · 상수 명부 · 소스에서 뜬 렌더 식)를 여기서 잠근다.
     ⛔이 파일은 「마우스로 끌린다」를 ★안 잰다(그건 DOM 몫) — 섞어 읽지 마라.

   무엇을 잠그나:
     F1 ★한계 명부가 «둘»인 자리를 «재는 자»로 묶는다 — js/graph-limits.js
        VLABEL_OFFSET_MIN/MAX 와 js/blocks/annotation-block.js ANNOT_LIMITS.labelDx/labelDy 는
        ±600 «같은 수»를 두 파일이 따로 들고 있다(graph-limits.js:53 주석이 「같은 범위를 그대로
        썼다」고 ★선언만» 한다). 구조로 합치지 않은 까닭은 보고에 적었다 — 대신 어긋나면 빨개진다.
     F2 js/graph-shape.js carryItemExtras 가 vDx/vDy 를 옮긴다(MCP partial update 경로).
        ★0·무효는 키를 «안 남긴다» = 옛 저장본 무회귀의 핵.
     F3 렌더 오프셋 식 _vOffCss(js/drag-utils.js, 모듈 안이라 못 import ⇒ ★소스에서 떠서 vm)
        — 0/없음이면 «빈 글자»(옛 바이트) · 값이 있으면 CSS translate · 한도로 자른다.
     F4 고르기 표식 grb-vlabel-cell-selected 가 js/io/section-serialize.js RUNTIME_MARKER_RE 에
        걸려 저장본에서 벗겨진다(＋반례: 라벨 자체 클래스는 안 걸린다).

   ★기대값은 손으로 안 적는다 — 전부 «소스에서 파생»한다. 칸마다 음성대조(변형본을 만들어
     그 칸이 ★빨개지는지)를 같이 둔다. ⛔전제 단언 없는 칸을 두지 않는다(∅ 이 통과로 읽히지 않게).
═══════════════════════════════════════════════════════════════════════════ */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ANNOT_SRC   = path.join(ROOT, 'js', 'blocks', 'annotation-block.js');
const DRAG_SRC    = path.join(ROOT, 'js', 'drag-utils.js');
const SERIAL_SRC  = path.join(ROOT, 'js', 'io', 'section-serialize.js');

const GRAPH_LIMITS = require('../../js/graph-limits.js');
const GS = require('../../js/graph-shape.js');

/* ── 소스에서 뜨는 자들 ─────────────────────────────────────────────────── */

/** js/blocks/annotation-block.js 의 ANNOT_LIMITS 객체 리터럴을 «소스에서» 평가한다.
 *  ⛔import 못 한다 — 이 파일은 ESM 이면서 top-level 에서 window.* 에 쓴다(node 에선 ReferenceError). */
function annotLimitsLiteral(src) {
  const m = src.match(/const ANNOT_LIMITS = (\{[\s\S]*?\});/);
  assert.ok(m, '★전제: ANNOT_LIMITS 정의를 소스에서 찾았다');
  return m[1];
}
function evalLimits(literal) {
  const o = vm.runInNewContext('(' + literal + ')');
  assert.equal(typeof o, 'object', '★전제: 리터럴이 객체로 평가됐다');
  return o;
}

/** js/drag-utils.js 의 `const _vOffCss = (it) => { … };` 를 중괄호 짝으로 떠낸다. */
function sliceVOffCss(src) {
  const head = 'const _vOffCss = (it) => {';
  const at = src.indexOf(head);
  assert.ok(at >= 0, '★전제: _vOffCss 정의를 소스에서 찾았다');
  let i = at + head.length - 1, depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) break; }
  }
  assert.ok(depth === 0 && i < src.length, '★전제: 중괄호 짝을 찾았다');
  const expr = src.slice(at + 'const _vOffCss = '.length, i + 1);
  assert.ok(/^\(it\)\s*=>/.test(expr), `★전제: 떠낸 것이 그 화살표 함수다(${expr.slice(0, 20)}…)`);
  return expr;
}
function makeVOffCss(expr, limits = GRAPH_LIMITS) {
  return vm.runInNewContext('(' + expr + ')', { window: { GRAPH_LIMITS: limits } });
}

/** js/io/section-serialize.js 의 RUNTIME_MARKER_RE 정규식 리터럴을 «소스에서» 평가한다. */
function runtimeMarkerRe(src) {
  const m = src.match(/const RUNTIME_MARKER_RE\s*=\s*\/(.*)\/([a-z]*)\s*;/);
  assert.ok(m, '★전제: RUNTIME_MARKER_RE 정의를 소스에서 찾았다');
  // ⛔vm 으로 평가하면 «다른 realm» 의 RegExp 가 와서 instanceof 가 거짓이다 — 이 realm 에서 짓는다.
  const re = new RegExp(m[1], m[2]);
  assert.ok(re instanceof RegExp, '★전제: 정규식으로 평가됐다');
  assert.ok(/cell\b/.test(m[1]) && m[1].includes('selected'), `★전제: 떠낸 정규식이 cell…selected 분기를 든다(${m[1]})`);
  return { re, literal: m[0] };
}

/* ══ F1 ±600 명부가 둘 — 어긋나면 빨개진다 ═══════════════════════════════ */

test('F1a ★한계 파생 — GRAPH_LIMITS.VLABEL_OFFSET_MIN/MAX = ANNOT_LIMITS.labelDx/labelDy 의 min/max (두 파일이 같은 수를 따로 든다)', () => {
  const A = evalLimits(annotLimitsLiteral(fs.readFileSync(ANNOT_SRC, 'utf8')));
  // ★전제 — 양쪽이 «실제로 값을 들고 있다»(∅ 끼리의 일치를 통과로 읽지 않게)
  assert.ok(A.labelDx && A.labelDy, '★전제: ANNOT_LIMITS 에 labelDx·labelDy 칸이 있다');
  for (const [k, v] of [['labelDx.min', A.labelDx.min], ['labelDx.max', A.labelDx.max],
                        ['labelDy.min', A.labelDy.min], ['labelDy.max', A.labelDy.max],
                        ['VLABEL_OFFSET_MIN', GRAPH_LIMITS.VLABEL_OFFSET_MIN],
                        ['VLABEL_OFFSET_MAX', GRAPH_LIMITS.VLABEL_OFFSET_MAX]]) {
    assert.equal(typeof v, 'number', `★전제: ${k} 가 수다`);
    assert.ok(Number.isFinite(v), `★전제: ${k} 가 유한하다`);
  }
  assert.ok(GRAPH_LIMITS.VLABEL_OFFSET_MIN < GRAPH_LIMITS.VLABEL_OFFSET_MAX, '★전제: MIN < MAX (뒤집히면 clamp 가 늘 MIN 을 뱉는다)');
  assert.ok(GRAPH_LIMITS.VLABEL_OFFSET_MIN < 0 && GRAPH_LIMITS.VLABEL_OFFSET_MAX > 0, '★전제: 양방향 — 음수도 허용해야 왼/위로 끌 수 있다');

  assert.deepEqual(
    { min: GRAPH_LIMITS.VLABEL_OFFSET_MIN, max: GRAPH_LIMITS.VLABEL_OFFSET_MAX },
    { min: A.labelDx.min, max: A.labelDx.max },
    '꺾은선 값 라벨 한계가 어노테이션 labelDx 한계와 갈렸다(graph-limits.js 주석 「같은 범위를 그대로 썼다」가 거짓이 됐다)');
  assert.deepEqual({ min: A.labelDy.min, max: A.labelDy.max }, { min: A.labelDx.min, max: A.labelDx.max },
    '어노테이션 쪽 labelDx·labelDy 끼리도 같아야 한다(가로/세로 비대칭은 설계에 없다)');
});

test('F1b ★음성(계측기 자가검사) — 어노테이션 쪽 수를 하나 바꾼 변형본이면 F1a 의 대조가 깨진다', () => {
  const src = fs.readFileSync(ANNOT_SRC, 'utf8');
  const lit = annotLimitsLiteral(src);
  /* ★무력화 값을 «손으로 적지 않는다» — 제품 값 +1 로 짓는다. 손으로 -500 을 박았더니,
     제품 쪽을 -500 으로 바꾸는 변이(M1)에서 둘이 «우연히 같아져» 이 칸이 같이 빨개졌다
     (= 무력화 값이 제품 값에 묶여 있었다). +1 은 제품 값이 무엇이든 절대 안 겹친다. */
  assert.ok(/^\{\s*labelDx:/.test(lit), `★전제: 리터럴의 첫 칸이 labelDx 다(${lit.slice(0, 20)}…)`);
  const bogus = GRAPH_LIMITS.VLABEL_OFFSET_MIN + 1;
  const sab = lit.replace(/min:\s*-?\d+/, `min: ${bogus}`);
  assert.notEqual(sab, lit, '★전제: 무력화가 실제로 문자열을 바꿨다');
  const A2 = evalLimits(sab);
  assert.equal(A2.labelDx.min, bogus, '★전제: 변형본이 바뀐 수를 든다');
  assert.notEqual(GRAPH_LIMITS.VLABEL_OFFSET_MIN, A2.labelDx.min,
    '변형본에서도 둘이 같다면 이 대조는 아무것도 안 잠근 것이다(항등식)');
});

/* ══ F2 carryItemExtras — 0 이면 키 없음 ═════════════════════════════════ */

test('F2a carryItemExtras vDx/vDy — 옛 값을 물려받고 · 들어온 유효값이 이기고 · 0·무효는 키를 «안 남긴다» · 음수를 지킨다', () => {
  const { carryItemExtras } = GS;
  assert.equal(typeof carryItemExtras, 'function', '★전제: 함수가 실렸다');
  const prev = { label: 'p', value: 1, vDx: 30, vDy: -20 };

  assert.deepEqual(carryItemExtras({ label: 'n', value: 5 }, prev, { label: 'n', value: 5 }),
    { label: 'n', value: 5, vDx: 30, vDy: -20 }, '라벨·값만 들어오면 옛 오프셋을 물려받는다');
  assert.deepEqual(carryItemExtras({ label: 'n', value: 5 }, prev, null),
    { label: 'n', value: 5, vDx: 30, vDy: -20 }, 'incoming 이 없어도 같다');
  assert.deepEqual(carryItemExtras({ label: 'n', value: 5 }, prev, { vDx: 7, vDy: -3 }),
    { label: 'n', value: 5, vDx: 7, vDy: -3 }, '들어온 유효값이 이긴다');
  assert.deepEqual(carryItemExtras({ label: 'n', value: 5 }, prev, { vDx: 0, vDy: '0' }),
    { label: 'n', value: 5 }, '★들어온 0 = 키를 걷는다(자동 배치로 복귀 · 「0 이면 키 없음」 규약)');
  assert.deepEqual(carryItemExtras({ label: 'n', value: 5 }, prev, { vDx: 'abc', vDy: true }),
    { label: 'n', value: 5, vDx: 30, vDy: -20 }, '무효 입력은 옛 값으로');
  assert.deepEqual(carryItemExtras({ label: 'n', value: 5 }, { label: 'p', value: 1 }, { vDx: 'abc' }),
    { label: 'n', value: 5 }, '옛 값도 없으면 키 없음(쓰레기를 안 싣는다)');
  assert.deepEqual(carryItemExtras({ label: 'n', value: 5 }, prev, { vDx: -12.4, vDy: 8.6 }),
    { label: 'n', value: 5, vDx: -12, vDy: 9 }, '정수로 반올림한다(소수를 저장본에 안 싣는다)');
});

test('F2b ★옛 저장본 무회귀 — vDx/vDy 가 어디에도 없으면 그 키가 «생기지 않는다»(바이트 불변의 핵)', () => {
  const { carryItemExtras, reconcileItems } = GS;
  const out = carryItemExtras({ label: 'n', value: 5 }, { label: 'p', value: 1 }, { label: 'n', value: 5 });
  assert.deepEqual(Object.keys(out).sort(), ['label', 'value'], `오프셋 키가 새로 생겼다: ${JSON.stringify(out)}`);
  assert.ok(!('vDx' in out) && !('vDy' in out), '키 자체가 없어야 한다(값 0 도 아니다)');

  // ★같은 규율을 «실제 쓰는 자리»(reconcileItems — 패널·MCP 가 items 를 다시 짓는 길)에서도 본다
  assert.equal(typeof reconcileItems, 'function', '★전제: reconcileItems 가 실렸다');
  const old = [{ label: '1월', value: 10 }, { label: '2월', value: 40 }];
  const got = reconcileItems(old, old.map(o => ({ ...o })));
  assert.equal(JSON.stringify(got), JSON.stringify(old), `오프셋 없는 옛 items 는 한 글자도 안 달라야 한다(받은 것: ${JSON.stringify(got)})`);
});

test('F2c ★음성대조 — 명부(VLABEL_OFFSET_KEYS) 밖의 비슷한 키는 «안» 옮겨진다', () => {
  const { carryItemExtras } = GS;
  const out = carryItemExtras({ label: 'n', value: 5 }, { label: 'p', value: 1, vDz: 9, labelDx: 9 }, {});
  assert.ok(!('vDz' in out), 'vDz 가 넘어왔다 — 「아무 키나 옮긴다」면 F2a 는 계측기가 아니다');
  assert.ok(!('labelDx' in out), '어노테이션 쪽 키 이름도 안 넘어온다(두 모델이 섞이지 않는다)');
});

/* ══ F3 렌더 오프셋 식 — 0 이면 빈 글자 ══════════════════════════════════ */

test('F3a _vOffCss — 오프셋이 없거나 0 이면 «빈 글자»(옛 바이트 그대로)', () => {
  const f = makeVOffCss(sliceVOffCss(fs.readFileSync(DRAG_SRC, 'utf8')));
  assert.equal(typeof f, 'function', '★전제: 소스에서 뜬 것이 함수다');
  assert.equal(f({ label: '1월', value: 10 }), '', '키가 없으면 빈 글자');
  assert.equal(f({ vDx: 0, vDy: 0 }), '', '둘 다 0 이면 빈 글자');
  assert.equal(f({}), '', '빈 항목');
  assert.equal(f(null), '', 'null 항목에도 안 터진다');
  assert.equal(f(undefined), '', 'undefined 항목에도 안 터진다');
  assert.equal(f({ vDx: 'abc', vDy: null }), '', '무효 값은 0 과 같다');
});

test('F3b _vOffCss — 값이 있으면 CSS translate 한 줄(transform 은 안 건드린다) · 한쪽만 있어도 둘 다 찍는다', () => {
  const f = makeVOffCss(sliceVOffCss(fs.readFileSync(DRAG_SRC, 'utf8')));
  assert.equal(f({ vDx: 10, vDy: -20 }), 'translate:10px -20px;');
  assert.equal(f({ vDx: 10 }), 'translate:10px 0px;', '세로만 없어도 두 값을 다 찍는다(translate 는 한 속성)');
  assert.equal(f({ vDy: -7 }), 'translate:0px -7px;');
  assert.ok(!/transform/.test(f({ vDx: 10, vDy: 10 })), '★transform 을 쓰면 가운데 정렬 translate(-50%,0) 를 덮어쓴다 — 쓰지 않는다');
});

test('F3c _vOffCss — 한도(GRAPH_LIMITS.VLABEL_OFFSET_*) 로 자른다 · 소수는 정수로', () => {
  const f = makeVOffCss(sliceVOffCss(fs.readFileSync(DRAG_SRC, 'utf8')));
  const MAX = GRAPH_LIMITS.VLABEL_OFFSET_MAX, MIN = GRAPH_LIMITS.VLABEL_OFFSET_MIN;
  assert.equal(f({ vDx: MAX + 1000, vDy: MIN - 1000 }), `translate:${MAX}px ${MIN}px;`);
  assert.equal(f({ vDx: 12.4, vDy: -3.6 }), 'translate:12px -4px;');
});

test('F3d ★음성(계측기 자가검사) — 소스의 `(dx || dy) ?` 가드를 걷은 변형본이면 F3a 가 깨진다', () => {
  const src = fs.readFileSync(DRAG_SRC, 'utf8');
  const expr = sliceVOffCss(src);
  const sab = expr.replace('(dx || dy) ?', 'true ?');
  assert.notEqual(sab, expr, '★전제: 무력화가 실제로 문자열을 바꿨다(가드가 그 꼴로 소스에 있다)');
  const f = makeVOffCss(sab);
  assert.notEqual(f({ label: '1월', value: 10 }), '',
    '가드를 걷었는데도 빈 글자면 F3a 는 아무것도 안 잠근 것이다(항등식)');
  assert.equal(f({ label: '1월', value: 10 }), 'translate:0px 0px;', '걷으면 0 짜리 키가 저장본·그림에 실린다 — 이것이 F3a 가 막는 것');
});

/* ══ F5 ⛔style 에서 translate 는 «맨 끝» ════════════════════════════════ */

/** 꺾은선 값 라벨 div 의 템플릿 한 줄을 소스에서 떠낸다. */
function vlabelTemplateLine(src) {
  const line = src.split('\n').find(l => l.includes('<div class="grb-line-vlabel"'));
  assert.ok(line, '★전제: 값 라벨 div 템플릿 줄을 소스에서 찾았다');
  const m = line.match(/style="([^"]*)"/);
  assert.ok(m, `★전제: 그 줄에서 style="…" 를 떠냈다(${line.trim().slice(0, 60)}…)`);
  return { line, style: m[1] };
}

test('F5 ⛔오프셋(_vOffCss)은 style 값의 «맨 끝»에 붙는다 — 어노테이션의 그 규율(annotation-block.js:39)을 꺾은선에서도 잠근다', () => {
  const { style } = vlabelTemplateLine(fs.readFileSync(DRAG_SRC, 'utf8'));
  const CALL = '${_vOffCss(items[o.i])}';
  const n = style.split(CALL).length - 1;
  assert.equal(n, 1, `★전제: style 안에 _vOffCss 호출이 정확히 하나다(${n}개)`);
  assert.ok(style.endsWith(CALL),
    `translate 가 style 값의 맨 끝이 아니다 — 다시 그린 라벨과 «라이브 끌기»(el.style.translate 대입, 늘 맨 끝에 직렬화)의 style 문자열이 갈려 ⌘Z 유령 칸이 난다(annotation-block.js:39 와 같은 병). 지금 꼴: …${style.slice(-60)}`);
});

test('F5b ★음성(계측기 자가검사) — 호출을 style 앞으로 옮긴 변형본이면 F5 가 깨진다', () => {
  const { style } = vlabelTemplateLine(fs.readFileSync(DRAG_SRC, 'utf8'));
  const CALL = '${_vOffCss(items[o.i])}';
  const rest = style.replace(CALL, '');
  /* ★전제는 「옮기기가 문자열을 바꿨다」가 ★아니다 — 그렇게 걸면, 제품이 이미 «앞»에 둔 변이판에서
     옮긴 결과가 원본과 같아져 이 칸까지 같이 빨개진다(F1b 가 같은 병으로 M1 에서 빨개졌던 자리).
     참 전제는 「style 에 오프셋 말고 ★다른 내용이 있다」 — 그래야 «앞»과 «끝»이 다른 자리다. */
  assert.ok(rest.length > 0, `★전제: style 에 오프셋 말고 다른 선언이 있다(${rest.length}자)`);
  assert.equal((CALL + rest).endsWith(CALL), false, '앞으로 옮겨도 「맨 끝」이면 F5 는 아무것도 안 잠근 것이다(항등식)');
});

/* ══ F4 고르기 표식은 저장본에 안 실린다 ═════════════════════════════════ */

test('F4 고르기 표식 grb-vlabel-cell-selected 는 RUNTIME_MARKER_RE 에 걸린다 ＋반례: 라벨 자체 클래스는 «안» 걸린다', () => {
  const { re } = runtimeMarkerRe(fs.readFileSync(SERIAL_SRC, 'utf8'));
  assert.equal(re.test('grb-vlabel-cell-selected'), true, '값 라벨 고르기 표식이 세척 대상이다(저장본·복사본에 안 남는다)');
  // ★반례 짝 — 「걸린다」만 재면 «전부 걸리는» 정규식도 통과한다
  assert.equal(re.test('grb-line-vlabel'), false, '라벨 자체 클래스가 걸리면 저장본에서 라벨이 사라진다');
  assert.equal(re.test('grb-line-xlabel'), false, '카테고리 라벨도 걸리지 않는다');
  assert.equal(re.test('grb-line-overlay'), false, '라벨층도 걸리지 않는다');
  // 같은 길의 이웃들(겹치는 음성대조 자리 — 한 군데 고치면 셋 다 돌아온다)
  assert.equal(re.test('grb-pie-cell-selected'), true, '조각 고르기(1013t1C4)와 같은 자를 쓴다');
  assert.equal(re.test('annot-cell-selected'), true, '어노테이션 라벨 고르기(1013t1A3)와 같은 자를 쓴다');
});
