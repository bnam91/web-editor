/* ⛔`?? alert(...)` 금지 — 렌더러를 «얼리는» 패턴
 *
 * ★무엇이 문제인가 (2026-09-07 툴매니저가 실물로 포착)
 *   `window.showToast?.(m) ?? alert(m)` 는 「토스트가 없으면 alert 으로 대신한다」로 «읽히지만»
 *   실제로는 그렇지 않다. showToast(js/drag-utils.js:192)는 **return 이 없어 항상 undefined** 다.
 *   ⇒ `??` 가 «언제나» 통과 ⇒ 토스트 + 네이티브 alert 이 «둘 다» 뜬다.
 *   ⇒ 그리고 Electron 의 native alert 은 **렌더러를 막는다.** 사용자는 모달을 눌러 없앨 때까지
 *     아무것도 못 한다. 실물: CDP 로 `{"type":"alert","message":"섹션을 먼저 선택하세요"}` 포착,
 *     검증 세션이 실제로 그 자리에서 «얼어붙었다»(스크린샷도 무응답).
 *
 * ★왜 «검사»로 닫나
 *   이 패턴은 읽으면 그럴듯해서 다음 사람이 또 쓴다. 「앞으로 조심」은 닫힌 게 아니다.
 *   ⇒ 다시 들어오면 «빨강»이 되게 한다.
 *
 * ⛔fallback 이 정말 필요하면: 반환값(`??`)이 아니라 «존재 여부»로 갈라라.
 *     if (window.showToast) window.showToast(m); else alert(m);
 *   그건 이 검사에 안 걸린다 — 막는 건 «?? 로 alert 을 잇는 것» 하나다.
 *
 * ⚠️이 검사가 «안» 보는 것
 *   · `||` 로 이은 경우(`showToast?.(m) || alert(m)`) — 같은 병인데 아직 실물이 없어 안 막았다.
 *     ★나오면 여기 규칙을 늘려라(지금 넣으면 «없는 것을 지키는» 검사가 된다).
 *   · alert 자체의 사용 — 의도적으로 쓰는 자리가 있을 수 있어 «?? 로 이은 것»만 본다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { readSrc } = require('./_srcread.js');

const ROOT = path.resolve(__dirname, '../..');
/* ★`??` 뒤에 alert 이 오는 것만 본다. 공백·줄바꿈을 허용한다. */
const BAD = /\?\?\s*alert\s*\(/;

/** 브라우저로 나가는 소스 전수. ⛔node_modules·dist·검사 자신은 뺀다. */
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(js|cjs|mjs|html)$/.test(e.name)) out.push(p);
  }
  return out;
}

const FILES = ['js', 'main', 'services'].flatMap((d) => {
  const abs = path.join(ROOT, d);
  return fs.existsSync(abs) ? walk(abs) : [];
}).concat([path.join(ROOT, 'index.html'), path.join(ROOT, 'main.js')].filter(fs.existsSync));

/* ★공용 거르개 — 스캔과 대조가 «같은 함수»를 쓴다.
     ⛔전에는 대조 검사가 «사본»을 재고 있었다 — 진짜 필터를 고쳐도 대조는 옛 논리로 초록이었다.
       (「기대값을 대상 코드로 만들면 같이 틀린다」의 사촌: «대조가 대상이 아닌 사본을 잰다»)
     ⇒ 하나로 합쳤다. 이 함수가 틀리면 «양쪽이 같이» 빨개진다. */
function makeStripper() {
  let inBlock = false;
  return function stripComments(line) {
    let t = line;
    if (inBlock) {
      const e = t.indexOf('*/');
      if (e < 0) return '';
      inBlock = false; t = t.slice(e + 2);
    }
    for (;;) {
      const b = t.indexOf('/*');
      if (b < 0) break;
      const e = t.indexOf('*/', b + 2);
      if (e < 0) { t = t.slice(0, b); inBlock = true; break; }
      t = t.slice(0, b) + t.slice(e + 2);
    }
    if (t.trimStart().startsWith('//')) return '';
    return t;
  };
}

test('⛔`?? alert(` 가 «0건»이다 (렌더러를 얼리는 패턴)', () => {
  const hits = [];
  for (const abs of FILES) {
    const rel = path.relative(ROOT, abs);
    const src = readSrc(ROOT, ...rel.split(path.sep));
    const strip = makeStripper();
    src.split('\n').forEach((line, i) => {
      const code = strip(line);
      if (code && BAD.test(code)) hits.push(`${rel}:${i + 1}`);
    });
  }
  assert.deepEqual(hits, [], '★`?? alert(` 가 다시 들어왔다: ' + hits.join(' / '));
});

test('★양성대조 — 이 검사가 «실제로» 파일을 읽고 있다 (0건이 «못 잰 것»이 아니다)', () => {
  assert.ok(FILES.length > 50, `훑은 파일이 ${FILES.length}개뿐이다 — 수집이 깨졌다`);
  /* 알려진 문자열이 잡히나 — 잡히면 readSrc·순회가 살아 있다는 뜻 */
  const idx = FILES.find((f) => f.endsWith(path.join('js', 'drag-utils.js')));
  assert.ok(idx, 'drag-utils.js 를 못 찾았다 — 파일 수집 범위가 틀렸다');
  const src = readSrc(ROOT, 'js', 'drag-utils.js');
  assert.match(src, /function showToast\s*\(/, '★대조 실패 — 파일을 못 읽고 있다');
});

test('★주석 필터 대조 — «금지 주석»은 안 잡고 «진짜 코드»는 잡는다', () => {
  /* ★1판이 여기서 깨졌다. 정규식만 대조하고 «줄 필터»를 안 쟀더니,
     「이 패턴 쓰지 마라」는 주석이 그대로 위반으로 잡혔다(dev 가 빨강이 됐다).
     ⇒ 필터도 «판정기»다. 판정기는 전부 대조해야 한다. */
  const run = (lines) => { const st = makeStripper(); return lines.map(st); };
  const skip = (line) => run([line])[0] === '';
  /* ⛔한 줄짜리는 «한 줄»로, 여러 줄짜리는 «여는 /* 와 같이» 준다.
       상태를 드는 거르개는 `* …` 한 줄만 떼어 주면 주석인지 «알 수 없다» — 그게 옳다.
       (옛 판은 「`*` 로 시작하면 주석」이라는 어림이었고, 그래서 «이어지는 줄»을 놓쳤다.) */
  const 한줄주석 = [
    "    //   (⛔`?? alert(` 금지 — showToast 가 undefined 를 반환해 …)",
    "/* window.showToast?.(m) ?? alert(m) 는 렌더러를 얼린다 */",
  ];
  for (const c of 한줄주석) assert.equal(skip(c), true, `★금지 주석을 위반으로 세고 있다: ${c}`);

  const 여러줄주석 = ["  /*", "     * ⛔`?? alert(` 를 쓰지 마라", "   */"];
  for (const [i, out] of run(여러줄주석).entries())
    assert.equal(BAD.test(out), false, `★여러 줄 주석의 ${i + 1}번째 줄을 코드로 읽고 있다`);

  const 진짜코드 = [
    "      window.showToast?.('x') ?? alert('x');",
    "  foo() ?? alert(1)",
  ];
  /* ★2026-09-08 실제로 새어나간 경우 — 블록 주석의 «이어지는 줄».
       툴매니저의 주석이 이 검사에 위반으로 잡혔다(오탐). 줄 자신의 시작만 보면 못 거른다. */
  const 이어지는줄 = [
    "  /* 설명이 시작되고",
    "     여기서 showToast?.(m) ?? alert(m) 를 쓰면 안 된다",
    "     그래서 뺐다 */",
    "  realCode() ?? alert('진짜');",
  ];
  const 결과 = run(이어지는줄);
  assert.equal(BAD.test(결과[1]), false, '★블록 주석의 «이어지는 줄»을 코드로 읽고 있다');
  assert.equal(BAD.test(결과[2]), false, '★블록 주석의 «닫는 줄»을 코드로 읽고 있다');
  assert.equal(BAD.test(결과[3]), true,  '★주석이 끝난 «진짜 코드»를 못 잡는다 — 거르개가 과하다');

  for (const c of 진짜코드) {
    assert.equal(skip(c), false, `★진짜 코드를 «건너뛰고» 있다: ${c}`);
    assert.equal(BAD.test(c), true);
  }
});

test('★판정기 대조 — 그 패턴을 «주면» 잡는다 (규칙이 죽지 않았다)', () => {
  assert.equal(BAD.test("window.showToast?.('x') ?? alert('x');"), true);
  assert.equal(BAD.test('foo() ??  alert(1)'), true);
  /* 안 걸려야 하는 것 — 존재 여부로 가른 «올바른» fallback */
  assert.equal(BAD.test('if (window.showToast) window.showToast(m); else alert(m);'), false);
  assert.equal(BAD.test("window.showToast?.('x');"), false);
});
