/* ⛔렌더러에서 `prompt(` 호출 «0건» — Electron 은 prompt() 를 지원하지 않는다
 *
 * ★무엇이 문제인가 (현빈 2026-10-02 00:14 실앱 콘솔)
 *   `Uncaught Error: prompt() is not supported.` (design-system.js:521 addColorVarFromPanel)
 *   Electron 렌더러는 prompt() 를 부르는 순간 «던진다» — 대화창이 안 뜨는 게 아니라 그 기능이 통째로 죽는다.
 *   dd407e27 이 디자인시스템 2곳을 인라인 이름 폼으로 바꿨고, 같은 뿌리의 마지막 호출
 *   js/branch-system.js 「+ 섹션」(스코프에 섹션 추가)을 같은 폼 «재사용»으로 바꿨다(2026-10-05).
 *   ⇒ 다시 들어오면 «빨강»이 되게 한다.
 *
 * ★대체 = DesignSystem.openInlineNameForm (js/design-system.js) — ⛔둘째 입력 모달을 만들지 마라.
 *
 * 지금 집행되는 선 = 호출 0건 · 예외 명부(EXCEPT) 0개. 목표 선 = 같다.
 *   예외가 필요하면 «그 자리에서» EXCEPT 에 `파일:줄 내용 조각`으로 이름을 올려라(수가 아니라 이름).
 *
 * ⚠️이 검사가 «안» 보는 것(의도됨 · 2026-10-05 지디)
 *   · alert( · confirm( — Electron 에서 «동작한다»(그래서 범위 밖). 다만 네이티브 모달이라 CDP 로 안 보인다.
 *   · main/ · services/ (노드 쪽 — prompt 가 애초에 없다).
 *   · 문자열 조립으로 부르는 것(`window['pro'+'mpt']`) — 실물이 없다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { readSrc } = require('./_srcread.js');
const { makeStripper } = require('./_strip-comments.js');

const ROOT = path.resolve(__dirname, '../..');
/* bare prompt( · window.prompt( · globalThis.prompt( · self.prompt( — 함수 이름 promptXxx( 와 obj.prompt( 는 아니다 */
const BAD = /(^|[^\w$.])(?:(?:window|globalThis|self)\s*\.\s*)?prompt\s*\(/;
const EXCEPT = [];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(js|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
}
/** 렌더러로 가는 소스 = js/ 전수 + index.html */
const FILES = walk(path.join(ROOT, 'js')).concat([path.join(ROOT, 'index.html')]);

function scan(src, rel) {
  const strip = makeStripper();
  const hits = [];
  src.split('\n').forEach((line, i) => {
    const code = strip(line);
    if (code && BAD.test(code)) hits.push(`${rel}:${i + 1} ${code.trim().slice(0, 60)}`);
  });
  return hits;
}

test('⛔렌더러(js/ · index.html)에 prompt( 호출이 «0건»이다', () => {
  const hits = [];
  for (const abs of FILES) {
    const rel = path.relative(ROOT, abs).split(path.sep).join('/');
    hits.push(...scan(readSrc(ROOT, ...rel.split('/')), rel));
  }
  const left = hits.filter((h) => !EXCEPT.some((x) => h.startsWith(x)));
  assert.deepEqual(left, [], '★prompt( 가 다시 들어왔다(Electron 에서 던진다 — DesignSystem.openInlineNameForm 을 써라): ' + left.join(' / '));
});

test('★양성대조 — 파일을 실제로 읽고 있다 · 심은 prompt( 는 빨강이다', () => {
  assert.ok(FILES.length > 50, `훑은 파일이 ${FILES.length}개뿐이다 — 수집이 깨졌다`);
  const br = FILES.find((f) => f.endsWith(path.join('js', 'branch-system.js')));
  assert.ok(br, 'branch-system.js 를 못 찾았다');
  /* 실물 파일 한 벌에 한 줄을 «심어» 같은 scan 으로 잰다 — 0건이 «못 잰 것»이 아님을 보인다 */
  const src = readSrc(ROOT, 'js', 'branch-system.js');
  const planted = src + "\n  const input = prompt('x');\n";
  assert.equal(scan(src, 'b').length, 0, '대조 전제 — 심기 전엔 0건이어야 한다');
  assert.equal(scan(planted, 'b').length, 1, '★심은 prompt( 를 못 잡는다 — 검사가 장님이다');
});

test('★판정기 대조 — 잡을 꼴은 잡고, 주석·함수 이름은 안 잡는다', () => {
  const caught = ["prompt('a')", "  const x = prompt(`q`);", "window.prompt('a')", "globalThis.prompt ('a')", "if (!prompt(m)) return"];
  for (const c of caught) assert.equal(scan(c, 'c').length, 1, `★잡아야 할 꼴을 놓친다: ${c}`);
  const passed = [
    "promptAddSectionToScope(name, btn);",
    "window.promptAddSectionToScope = promptAddSectionToScope;",
    "this.prompt('a')",
    "// prompt() 대체",
    "/* ⛔prompt() 금지 */",
  ];
  for (const c of passed) assert.equal(scan(c, 'p').length, 0, `★잡지 말아야 할 꼴을 잡는다: ${c}`);
  const block = ['  /* ── 이름 받는 폼', '   *   prompt() 를 지원하지 않는다', '   */'].join('\n');
  assert.equal(scan(block, 'm').length, 0, '★여러 줄 주석 안의 prompt() 를 코드로 읽는다');
});
