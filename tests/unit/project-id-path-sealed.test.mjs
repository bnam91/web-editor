/* project-id-path-sealed.test.mjs — 「`undefined.json` 이 «생길 수 없다»」를 잠근다. (T-232, 2026-09-27)
 *
 * ★★왜 «가드»가 아니라 «검사»인가 — 실측하니 그 길은 ★이미 두 겹으로 막혀 있었다:
 *   ⑴ `PROJECTS_DIR` 에 «flat 파일»(`<id>.json`)을 «쓰는» 자리가 ★0건이다. 저장은 전부
 *      `_ensureNewLayoutPaths`(신 레이아웃 `<id>/proj.json`)를 거친다. flat 을 가리키는 6곳은
 *      전부 «읽기»다(`_resolve*JsonPath` 의 폴백 판정 · 삭제 대상 찾기 · `existsSync`).
 *   ⑵ `_safeSeg(undefined)` === `'_'` — `String(s || '')` 이라 undefined 가 빈 문자열로 떨어지고
 *      그 다음 `'' → '_'` 가 된다. ⇒ 설령 flat 을 쓴다 해도 파일명은 `_.json` 이다.
 *   ⇒ ★그러니 「id 없으면 저장 거절」 같은 ★새 가드는 «없는 길에 문을 세우는 것»이다.
 *     ⛔오늘 T-228 에서 내가 정확히 그 실수를 했다(중첩 안에 `.grd-cell` 이 없는데 가드를 세웠다).
 *     ⇒ **막는 코드가 아니라 «지키는 검사»가 답이다** — 회귀하면 여기가 빨개진다.
 *
 * ★실물 4곳의 날짜가 그 봉쇄를 뒷받침한다(작업목록매니저 실측 ＋ 내 대조):
 *   `_safeSeg`(GAP-009) = 2026-06-23 · 신 레이아웃 = 05-23~06-27
 *   ⇒ 04-09 · 06-22 는 두 방어 «전», 06-23 은 그날. ⚠️07-14 «하나만» 방어 이후이고 미설명이다
 *     (그 하나는 `CRASHTEST` userData — 「크래시 테스트가 만든 비정상 상태」는 ⛔추정이고 안 쟀다).
 *
 * ★무엇을 잠그나
 *   P1  `_safeSeg` 의 계약 — undefined·null·빈 문자열이 «파일명이 되지 않는다»
 *   P2  ★`_ensureNewLayoutPaths` 가 `_safeSeg` 를 «먼저» 거치고 «신 레이아웃»만 만든다
 *   P3  ★★저장 코어가 그 함수로 경로를 얻는다 — flat 을 직접 조립하지 않는다
 *   P4  ★`PROJECTS_DIR` 의 flat 파일 표현이 나오는 곳은 «전부 읽기»다(쓰기 0건)
 *   N1  음성대조 — `_safeSeg` 의 빈-문자열 처리를 떼면 P1 이 빨개진다
 *
 * 실행: node --test tests/unit/project-id-path-sealed.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const MAIN = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
const { stripComments, makeStripper } = createRequire(import.meta.url)('./_strip-comments.js');

/** `const _safeSeg = s => { … };` 를 중괄호 균형으로 떠낸다. */
function safeSegSrc(src) {
  const A = 'const _safeSeg = ';
  const n = src.split(A).length - 1;
  assert.equal(n, 1, `_safeSeg 정의가 ${n} 곳이다 — 하나여야 한다`);
  const k = src.indexOf(A);
  let d = 0, i = src.indexOf('{', k);
  for (; i < src.length; i++) {
    if (src[i] === '{') d++;
    else if (src[i] === '}') { d--; if (d === 0) { i++; break; } }
  }
  return src.slice(k, i) + ';';
}

const makeSafeSeg = (src = MAIN) => new Function(`${safeSegSrc(src)} return _safeSeg;`)();

test('P1 ★`_safeSeg` — undefined·null·빈 것은 «파일명이 되지 않는다»', () => {
  const f = makeSafeSeg();
  for (const v of [undefined, null, '', 0, false, NaN]) {
    assert.equal(f(v), '_', `★${String(v)} 가 «_» 가 아니다 — 그 값이 그대로 파일명에 실린다`);
  }
  assert.equal(f('undefined'), 'undefined',
    '★문자열 "undefined" 는 그대로다 — 이 자는 «값이 없음»만 막고, 문자열로 굳은 뒤는 못 막는다(정직하게 적는다)');
  assert.equal(f('proj_123'), 'proj_123', '★정상 id 가 바뀌었다 — 저장 경로가 통째로 달라진다');
  assert.equal(f('../etc'), '.._etc', '★traversal 가드(GAP-009)가 죽었다');
  assert.equal(f('..'), '_', '★순수 점이 «_» 가 아니다 — 상위 디렉터리를 가리킨다');
});

test('P2 ★`_ensureNewLayoutPaths` 가 `_safeSeg` 를 «먼저» 거치고 «신 레이아웃»만 만든다', () => {
  const A = 'function _ensureNewLayoutPaths(id) {';
  const k = MAIN.indexOf(A);
  assert.ok(k >= 0, '_ensureNewLayoutPaths 를 못 찾았다 — 패턴을 갱신하라');
  let d = 0, i = MAIN.indexOf('{', k);
  for (; i < MAIN.length; i++) {
    if (MAIN[i] === '{') d++;
    else if (MAIN[i] === '}') { d--; if (d === 0) { i++; break; } }
  }
  const fn = stripComments(MAIN.slice(k, i));
  const iSafe = fn.indexOf('_safeSeg(id)');
  const iJoin = fn.indexOf('path.join(PROJECTS_DIR, id)');
  assert.ok(iSafe >= 0, '★★살균을 안 거친다 — undefined 가 그대로 디렉터리 이름이 된다');
  assert.ok(iJoin >= 0, '★신 레이아웃 폴더를 안 만든다');
  assert.ok(iSafe < iJoin, '★★살균이 경로 조립 «뒤»다 — 막기 전에 이미 경로가 생겼다');
  assert.match(fn, /'proj\.json'/, '★신 레이아웃 파일명이 아니다');
  /* ⛔여기서 flat 을 만들면 봉쇄가 풀린다. */
  assert.equal(/\$\{id\}\.json/.test(fn), false,
    '★★이 함수가 flat(`${id}.json`)을 만든다 — `undefined.json` 이 다시 생길 길이 열린다');
});

test('P3 ★★저장 코어가 그 함수로 경로를 얻는다 — flat 을 직접 조립하지 않는다', () => {
  const A = 'async function _saveProjectImpl(project) {';
  const k = MAIN.indexOf(A);
  assert.ok(k >= 0, '_saveProjectImpl 을 못 찾았다 — 패턴을 갱신하라');
  let d = 0, i = MAIN.indexOf('{', k);
  for (; i < MAIN.length; i++) {
    if (MAIN[i] === '{') d++;
    else if (MAIN[i] === '}') { d--; if (d === 0) { i++; break; } }
  }
  const fn = stripComments(MAIN.slice(k, i));
  assert.match(fn, /_ensureNewLayoutPaths\(project\.id\)/, '★저장이 신 레이아웃 경로를 안 쓴다');
  assert.equal(/path\.join\(PROJECTS_DIR, *`/.test(fn), false,
    '★★저장 코어가 PROJECTS_DIR 아래 파일명을 «직접» 조립한다 — 살균을 건너뛸 자리다');
});

test('P4 ★`PROJECTS_DIR` 의 flat 파일 표현이 나오는 곳은 «전부 읽기»다(쓰기 0건)', () => {
  /* ★자 — 그 표현이 있는 «줄»을 모아, 각 줄이 읽기 꼴인지 본다.
     ⛔주석 줄은 세지 않는다(공용 부품으로 걷는다 — 이 파일 머리말에도 그 표현이 적혀 있다). */
  const strip = makeStripper();
  const RE = /path\.join\(PROJECTS_DIR, *`\$\{[^}]+\}(_[a-z]+)?\.json`\)/;
  const READ = /(existsSync|readFileSync|const\s+flat\s*=|const\s+target\s*=|return\s)/;
  const hits = [];
  MAIN.split('\n').forEach((line, i) => {
    const code = strip(line);
    if (RE.test(code)) hits.push({ n: i + 1, code: code.trim() });
  });
  assert.ok(hits.length > 0, '★그 표현이 0곳이다 — 이 검사는 «안 재고» 있다(자가 낡았다)');
  for (const h of hits) {
    assert.match(h.code, READ,
      `★★main.js:${h.n} 가 flat 경로를 «읽기가 아닌» 꼴로 쓴다 — 쓰기면 \`undefined.json\` 이 다시 생긴다: ${h.code}`);
    assert.equal(/(writeFileSync|_atomicWriteFileSync|copyFileSync|renameSync|mkdirSync)/.test(h.code), false,
      `★★main.js:${h.n} 가 flat 경로에 «쓴다»: ${h.code}`);
  }
});

test('N1 ★음성대조 — `_safeSeg` 의 빈-문자열 처리를 떼면 P1 이 빨개진다', () => {
  const ANCHOR = "return (v === '' || /^\\.+$/.test(v)) ? '_' : v;";
  assert.ok(MAIN.includes(ANCHOR), '★변이 닻을 못 찾았다 — 이 음성대조는 «안 재고» 있다');
  const f = makeSafeSeg(MAIN.replace(ANCHOR, 'return v;'));
  assert.equal(f(undefined), '', '★처리를 떼었는데도 «_» 다 — 이 음성대조는 «안 재고» 있다');
});
