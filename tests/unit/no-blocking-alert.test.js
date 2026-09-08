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

test('⛔`?? alert(` 가 «0건»이다 (렌더러를 얼리는 패턴)', () => {
  const hits = [];
  for (const abs of FILES) {
    const rel = path.relative(ROOT, abs);
    const src = readSrc(ROOT, ...rel.split(path.sep));
    src.split('\n').forEach((line, i) => {
      /* ⛔주석은 «센다면 역설»이 된다 — 「이 패턴 쓰지 마라」고 적을수록 검사가 빨개진다.
       *   ★실제로 그랬다(2026-09-07 머지 직후 dev 가 빨강): ai-image-gen.js 의 «금지 주석» 두 줄이
       *     그대로 위반으로 잡혔다. 1판 필터가 `★` 포함 여부로 걸렀는데 그 주석엔 ⛔만 있었다.
       *   ⇒ «장식 문자»로 거르지 마라. 「주석 줄인가」를 «구문»으로 판정한다.
       *   ⚠️전례: goditor-qa 의 design-gate.sh 가 «토큰 정의 줄»을 하드코딩으로 세서
       *     토큰을 승격할수록 FAIL 이 나던 역설(v1.2.1 수정). 같은 병이다. */
      const t = line.trimStart();
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
      if (BAD.test(line)) hits.push(`${rel}:${i + 1}`);
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
  const skip = (line) => {
    const t = line.trimStart();
    return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
  };
  const 주석들 = [
    "    //   (⛔`?? alert(` 금지 — showToast 가 undefined 를 반환해 …)",
    "     * ⛔`?? alert(` 를 쓰지 마라",
    "/* window.showToast?.(m) ?? alert(m) 는 렌더러를 얼린다 */",
  ];
  for (const c of 주석들) assert.equal(skip(c), true, `★금지 주석을 위반으로 세고 있다: ${c}`);

  const 진짜코드 = [
    "      window.showToast?.('x') ?? alert('x');",
    "  foo() ?? alert(1)",
  ];
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
