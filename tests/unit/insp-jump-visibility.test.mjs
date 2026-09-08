/* U-INSPJUMP — 인스펙터 통계 행 «점프»의 도착 표시가 «실제로 보이는가».
 *   실행: node --test "tests/unit/*.test.mjs"  ·  소스만 읽는다(라이브 무접촉).
 *
 * ★현빈 2026-09-09: 「통계 행을 누르면 캔버스에 이동할 때 아웃라인이 «생겼다 안 생겼다» 한다」
 *   조사해 보니 «간헐»이 아니라 두 조건이 각각 0%/100% 로 결정론적이었고, 병이 «셋» 겹쳐 있었다.
 *   앱 실측(9351 · 파테나 프로젝트 · heading 12개 · zoom 40% · 조건당 클릭 12회):
 *
 *     [고치기 전]                  칠해짐        첫칠     정착후 보임(6클릭 훑고 손 뗀 뒤·10회)
 *       대상 비선택 · 200ms          1/12       334ms        10/10
 *       대상 비선택 · 300ms          1/12       334ms        10/10
 *       대상 비선택 · 500ms         12/12       334ms        10/10
 *       대상 «선택됨» · 200/300/500  0/12          –         ★0/10  ← 100% 안 보인다
 *       점프 뒤 대상에 .selected      0/12
 *
 *     [고친 뒤]  모든 칸 12/12 · 첫칠 4~8ms · 정착후 보임 10/10 · .selected 12/12
 *
 * ⇒ 병 ① selectBlock 에 «요소»를 넘겼다(id 를 받는 함수다) — 선택이 «한 번도» 안 됐다
 *   병 ② 320ms «선지연» — 훑는 리듬(200~300ms)이 그보다 빠르면 붙기 전에 지워진다
 *   병 ③ 중화 절이 특이성으로 이겨 «선택된 대상»의 강조를 투명으로 덮었다
 *
 * ★이 파일이 지키는 것은 「세 병이 각각 돌아오지 않는다」이고,
 *   ★★단언 «앞»에 「입력이 살아 있다」를 먼저 세운다 — 이 저장소가 오늘 여섯 번 밟은 병이
 *   「검사는 있는데 그 자리를 안 밟는다」였다. 아래 T0 가 먼저 빨개지지 않으면 나머지는 무의미하다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const decomment = s => s.replace(/\/\*[\s\S]*?\*\//g, '');
const strip = s => decomment(s).replace(/^\s*\/\/.*$/gm, '');

const INSP      = strip(rd('js/inspector.js'));
const BLOCKEDIT = strip(rd('js/block-edit.js'));
const EDITOR    = strip(rd('js/editor.js'));
const PANELCSS  = decomment(rd('css/editor-panels.css'));
const BLOCKCSS  = decomment(rd('css/editor-blocks.css'));

/** `name(` 부터 괄호 짝을 세어 인자 전체를 잘라낸다(중첩 setTimeout 도 옳게 판다). */
function callSpans(src, name) {
  const out = [];
  const re = new RegExp('\\b' + name + '\\s*\\(', 'g');
  let m;
  while ((m = re.exec(src))) {
    let d = 1, i = m.index + m[0].length;
    for (; i < src.length && d > 0; i++) {
      if (src[i] === '(') d++;
      else if (src[i] === ')') d--;
    }
    out.push([m.index, i]);
    re.lastIndex = i;
  }
  return out;
}
/** setTimeout(...) 인자 안을 «공백으로» 지운 소스 — 남아 있으면 «동기»로 실행되는 코드다. */
function blankOut(src, name) {
  let s = src;
  for (const [a, b] of callSpans(s, name).reverse()) s = s.slice(0, a) + ' '.repeat(b - a) + s.slice(b);
  return s;
}
/** jumpToElement 함수 본문만 — 다른 함수의 코드가 섞여 통과하는 것을 막는다. */
function jumpBody() {
  const i = INSP.indexOf('function jumpToElement');
  assert.ok(i >= 0, 'jumpToElement 를 못 찾았다 — 이름이 바뀌었으면 이 검사도 같이 옮겨라');
  let d = 0, started = false, j = i;
  for (; j < INSP.length; j++) {
    if (INSP[j] === '{') { d++; started = true; }
    else if (INSP[j] === '}') { d--; if (started && d === 0) break; }
  }
  return INSP.slice(i, j + 1);
}
const BODY = jumpBody();

/* ══════════ T0 — ★입력 생존. 이게 먼저 빨개져야 아래가 뜻을 가진다 ══════════ */
test('T0 ★입력 생존 — 점프 행·대상 배열·강조 클래스 «세 이름»이 실제로 이어져 있다', () => {
  // ⑴ 통계 행이 «점프 행»으로 그려지고 대상 배열을 실제로 담는가
  assert.match(INSP, /class="insp-stat-row insp-jump"/,
    '통계 행에 insp-jump 가 안 붙는다 — 클릭 위임이 아무것도 못 잡는다');
  assert.match(INSP, /_jumpTargets\[key\]\s*=\s*list/,
    '_jumpTargets 에 대상 배열을 안 담는다 — 눌러도 갈 곳이 없다');
  assert.match(INSP, /closest\?\.\('\.insp-jump'\)/,
    '문서 레벨 클릭 위임이 .insp-jump 를 안 본다');
  assert.match(INSP, /jumpToElement\(list\[i\]\)/, '클릭이 jumpToElement 로 이어지지 않는다');

  // ⑵ ★세 파티가 «같은 클래스 이름»을 말하는가 — 하나만 개명돼도 조용히 죽는다
  const inJs  = BODY.match(/classList\.add\('([a-z-]+)'\)/);
  assert.ok(inJs, 'jumpToElement 가 강조 클래스를 «안 붙인다»');
  const CLS = inJs[1];
  assert.equal(CLS, 'insp-jump-flash', '강조 클래스 이름이 바뀌었다 — CSS·중화 절도 같이 옮겨라');

  const cssRule = new RegExp('\\.' + CLS + '\\s*\\{[^}]*outline\\s*:');
  assert.match(PANELCSS, cssRule, `css/editor-panels.css 에 .${CLS} 의 outline 규칙이 없다 — 붙여도 «안 그려진다»`);

  const neutral = BLOCKCSS.match(/body\.sel-ov #canvas \.selected(:not\([^)]*\))+/);
  assert.ok(neutral, '중화 절을 못 찾았다');
  assert.ok(neutral[0].includes(':not(.' + CLS + ')'),
    `중화 절이 .${CLS} 를 «면제»하지 않는다 — 선택된 대상으로 점프하면 강조가 투명으로 덮인다(실측 0/12)`);
});

/* ══════════ T1 — 병① selectBlock 에 «id» 를 넘긴다 ══════════ */
test('T1 F3 — 점프는 selectBlock 에 «id»를 넘긴다(요소를 넘기면 항상 null 이었다)', () => {
  // 받는 쪽이 «정말» id 를 받는다는 것을 코드로 확인한다 — 추측으로 고치지 않는다
  assert.match(BLOCKEDIT, /function getBlockById\(id\)[\s\S]{0,200}getElementById\(String\(id\)\)/,
    'selectBlock 은 getElementById(String(id)) 로 찾는다 — 그 전제가 바뀌면 이 검사도 같이 옮겨라');
  assert.match(BLOCKEDIT, /function selectBlock\(id\)/, 'selectBlock 의 인자 이름이 id 가 아니다');

  // 넘기는 쪽
  assert.match(BODY, /window\.selectBlock\?\.\(el\.id\)/,
    '★요소를 넘기면 String(el)="[object HTMLDivElement]" ⇒ getElementById 가 항상 null ⇒ 선택이 «영영» 안 된다');
  assert.doesNotMatch(BODY, /selectBlock\s*\(\s*el\s*\)/,
    '요소를 그대로 넘기는 옛 호출이 남아 있다');
  assert.match(BODY, /el\.id\s*&&|if\s*\(\s*el\.id\s*\)/,
    'id 가 빈 문자열인 블록을 막아야 한다 — getElementById("") 는 못 찾는다');

  // ★섹션 갈래는 «요소»가 맞다 — 두 갈래의 인자가 다르다는 것이 이 병의 핵심이었다
  assert.match(BODY, /window\.selectSection\?\.\(el\)/, '섹션 갈래는 요소를 넘겨야 한다');
  assert.match(EDITOR, /function selectSection\(sec[^)]*\)\s*\{[\s\S]{0,120}sec\.classList\.add\('selected'\)/,
    'selectSection 은 «요소»를 받아 그 위에 classList 를 쓴다 — id 를 받게 바뀌었으면 호출부도 같이 고쳐라');
});

/* ══════════ T2 · T2b — 병③ 특이성 싸움. ★양성대조를 검사 «안»에 넣는다 ══════════ */
/** 셀렉터 특이성 (a,b,c). :not() 은 «괄호 안»의 특이성을 그대로 쓴다. */
function specificity(sel) {
  let s = sel, a = 0, b = 0, c = 0;
  s = s.replace(/:not\(([^)]*)\)/g, (_, inner) => { const [x, y, z] = specificity(inner); a += x; b += y; c += z; return ' '; });
  a += (s.match(/#[\w-]+/g) || []).length;
  b += (s.match(/\.[\w-]+/g) || []).length + (s.match(/\[[^\]]+\]/g) || []).length
     + (s.match(/:(?!:)[a-z-]+/g) || []).length;
  c += (s.match(/(^|[\s>+~])([a-z][a-z0-9]*)/gi) || []).length;
  return [a, b, c];
}
const cmpSpec = (x, y) => (x[0] - y[0]) || (x[1] - y[1]) || (x[2] - y[2]);

/** 중화 절의 «본체»가 이 클래스 집합을 가진 요소에 걸리는가. */
const neutralHits = (sel, classes) =>
  ![...sel.matchAll(/:not\(\.([a-z0-9-]+)\)/g)].some(m => classes.includes(m[1]));

test('T2 ★F1 — .selected 이면서 .insp-jump-flash 인 요소의 강조가 «투명으로 덮이지 않는다»', () => {
  const neutral = BLOCKCSS.match(/body\.sel-ov #canvas \.selected(:not\([^)]*\))+/);
  assert.ok(neutral, '중화 절을 못 찾았다');
  const NSEL = neutral[0];
  const FSEL = '.insp-jump-flash';

  // ⑴ 둘 다 !important 다 — 그러면 «특이성»이 이긴다는 것이 이 병의 전제였다
  assert.match(BLOCKCSS, /body\.sel-ov #canvas \.selected[\s\S]{0,600}?outline-color:\s*transparent\s*!important/,
    '중화가 !important 로 outline-color 를 지운다는 전제가 깨졌다');
  assert.match(PANELCSS, /\.insp-jump-flash\s*\{[^}]*outline:[^;]*!important/,
    '강조가 !important 라는 전제가 깨졌다');
  assert.ok(cmpSpec(specificity(NSEL), specificity(FSEL)) > 0,
    `중화(${specificity(NSEL)}) 가 강조(${specificity(FSEL)}) 보다 특이성이 낮아졌다 — ` +
    '이 검사의 «전제»가 바뀌었으니 고치는 방법도 다시 정해라');

  // ⑵ 그래서 «이기는 유일한 길»은 중화가 아예 «안 걸리는» 것이다
  const both = ['text-block', 'selected', 'insp-jump-flash'];
  assert.equal(neutralHits(NSEL, both), false,
    '선택 + 강조가 «같이» 걸린 요소를 중화가 여전히 잡는다 ⇒ 강조가 투명해진다(실측 0/12)');

  // ⑶ ★양성대조 — :not(.insp-jump-flash) 를 빼면 «반드시» 다시 잡혀야 한다.
  //    이게 없으면 위 단언은 「아무 셀렉터나 통과시키는 판정기」여도 초록이다.
  const mutated = NSEL.replace(':not(.insp-jump-flash)', '');
  assert.equal(neutralHits(mutated, both), true,
    '판정기가 «변이를 못 가른다» — 이 검사는 아무것도 안 지키고 있다');
});

test('T2b ★대조군 — 강조 없이 .selected «만» 인 요소는 여전히 중화된다(선택 표시 동작 불변)', () => {
  const neutral = BLOCKCSS.match(/body\.sel-ov #canvas \.selected(:not\([^)]*\))+/);
  /* ★중화 절을 «통째로 지우는» 변이는 여기서 잡힌다 — T2 만 있으면 중화가 없어도 초록이라
     「강조를 살리려다 선택 중화를 다 날린」 사고(선이 2겹이 된다)를 아무도 못 본다. */
  assert.ok(neutral, '★중화 절이 통째로 사라졌다 — 옛 선과 새 오버레이가 «2겹»으로 그려진다');
  const NSEL = neutral[0];
  assert.match(BLOCKCSS, /body\.sel-ov #canvas \.selected[\s\S]{0,600}?outline-color:\s*transparent\s*!important/,
    '중화 절은 있는데 색을 «안 지운다» — 그래도 2겹이 된다');

  assert.equal(neutralHits(NSEL, ['text-block', 'selected']), true,
    '★강조가 없는 평범한 선택까지 중화에서 빠졌다 — 선택 표시가 2겹이 된다');

  // ★판정기 자기검증 — 면제 대상은 «걸리지 않아야» 한다. 늘 true 만 뱉는 판정기가 아님을 본다.
  assert.equal(neutralHits(NSEL, ['section-block', 'selected']), false,
    '판정기가 :not() 을 «안 보고» 있다 — 위 단언이 아무것도 안 지킨다');
});

/* ══════════ T3 — 병② 선지연 없음 ══════════ */
test('T3 F2 — 강조는 «클릭 즉시» 붙는다(setTimeout 안에서 붙이면 훑는 리듬에 먹힌다)', () => {
  const sync = blankOut(BODY, 'setTimeout');
  assert.match(sync, /classList\.add\('insp-jump-flash'\)/,
    '★강조 부착이 setTimeout 안에 있다 — 200~300ms 로 훑으면 붙기 «전에» 다음 클릭이 지운다(실측 1/12)');

  // 옛 판의 320ms 선지연이 되돌아오지 않았는가
  assert.doesNotMatch(BODY, /setTimeout\([^)]*\bel\.classList\.add/,
    '선지연 뒤에 붙이는 옛 구조가 돌아왔다');

  // 지우기는 반대로 «스크롤이 멈춘 뒤»부터 — 긴 점프에서 도착 전에 꺼지던 병
  assert.match(BODY, /addEventListener\('scrollend'/,
    '지우기를 scrollend 뒤로 미뤄야 긴 점프에서 «도착 전에» 표시가 죽지 않는다');
  assert.match(BODY, /removeEventListener\('scrollend'/,
    'scrollend 리스너를 거두지 않으면 클릭마다 쌓인다');
  assert.match(BODY, /willScroll/,
    '★스크롤이 «아예 안 일어나는» 경우(이미 화면 안) scrollend 는 영영 안 온다 — 그 갈래가 필요하다');
  assert.match(BODY, /setTimeout\(onEnd,\s*\d+\)/,
    '폴백 타이머가 없으면 scrollend 를 못 받는 판에서 표시가 «영구히» 남는다');
});

/* ══════════ T4 — [M59] 회귀 방지 ══════════ */
test('T4 ★[M59] 회귀 — 지우기는 «화면에서 찾아» 한다(대상을 기억하면 앞 블록이 영구히 남는다)', () => {
  assert.match(BODY, /querySelectorAll\('\.insp-jump-flash'\)[\s\S]{0,80}remove\('insp-jump-flash'\)/,
    '_clearFlash 가 «문서 질의»로 지우지 않는다 — 현빈 2026-09-06 의 «영구 잔류» 버그가 돌아온다');

  // ★remove 는 «오직» _clearFlash 안에서만 일어나야 한다. 한 군데라도 «기억한 대상»을
  //   지우는 코드가 생기면 타이머가 취소될 때 그 블록이 남는다.
  const removes = [...BODY.matchAll(/classList\.remove\('insp-jump-flash'\)/g)].length;
  assert.equal(removes, 1,
    `강조 제거가 ${removes}곳이다 — 제거는 _clearFlash «한 곳»이어야 [M59] 가 재발하지 않는다`);
  assert.doesNotMatch(BODY, /setTimeout\([^)]*\bel\.classList\.remove\('insp-jump-flash'\)/,
    '«그 요소»를 기억해 지우는 구조 — 연속 클릭에서 앞 블록이 남는다');

  // 새 클릭은 앞 클릭의 «대기»를 전부 거둬야 한다(타이머 + scrollend)
  assert.match(BODY, /clearTimeout\(jumpToElement\._t\)/, '앞 클릭의 타이머를 안 거둔다');
  assert.match(BODY, /clearTimeout\(jumpToElement\._t2\)/, '앞 클릭의 지우기 타이머를 안 거둔다');
});
