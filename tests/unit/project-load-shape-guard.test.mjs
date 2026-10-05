/* project-load-shape-guard.test.mjs — 「★«파싱되면 프로젝트»가 아니다」를 «정상 경로»에도 건다. (T-232, 2026-09-27)
 *
 * ★★무엇이 실제로 났나 — 디스크에 `undefined.json` 이 있었다(1곳, mtime 2026-07-14, CRASHTEST userData).
 *   그 파일을 복원해 보니 키 24개 중 숫자 키 18개가 문자열 `'proj_1775704460431'` 이었고,
 *   나머지가 `version/currentPageId/pages/id:'undefined'/name/updatedAt` 이었다.
 *   ⇒ 꼴이 **`{ ...<문자열 id>, ...<프로젝트 본문>, id: String(undefined), name, updatedAt }`**.
 *
 * ★사슬(판 a9f5735b 에서 짚음)
 *   ⑴ `projects:load`(main.js) 의 «정상 경로»가 `JSON.parse` 결과를 ★그대로 돌려줬다
 *      ⇒ 파일 내용이 `"proj_…"`(문자열만 든 JSON)이면 ★문자열이 반환된다.
 *   ⑵ 저장 자리(`js/io/save-load.js` · `js/commit-system.js`)의 `{ ...existingWithoutMeta, … }` 가
 *      그 문자열을 구조분해 잔여로 받아 `{0:'p',1:'r',…}` 로 ★펼쳤다.
 *   ⑶ `id: targetId` 가 undefined ⇒ 파일명이 `undefined.json`.
 *   ⇒ ★★**두 증상(파일명·내용)이 «한 원인»이다** — 추측이 아니라 한 파일이 둘을 같이 들고 있다.
 *
 * ★★그 규율은 이미 그 파일에 «적혀» 있었다 — 「★[A2 치명] «파싱되면 프로젝트»가 아니다」.
 *   그런데 가드가 ⛔**폴백 체인에만** 걸려 있었고, 그 주석 자신이 「폴백 루프«만» 안 걸러서」라고
 *   적으며 폴백만 고쳤다. ⇒ ★**적는 것 ≠ 갖다 대는 것.** 정상 경로는 두 달 반 뒤에도 안 걸려 있었다.
 *
 * ★무엇을 잠그나
 *   S1~S4  `isProjectShaped` 의 «계약» — 이 함수를 재는 검사가 그때까지 ★0개였다
 *   W1     ★정상 경로가 그 가드를 거친다(＋거절이 아니라 «폴백으로 내려보낸다»)
 *   W2     ★★모듈 부재 폴백(`_SS_FALLBACK`)에도 그 함수가 있다 — 없으면 가드가 TypeError 로 죽는다
 *   W3     ★모르면 «통과»다 — 판정 모듈이 없을 때 로드를 막으면 프로젝트가 안 열린다
 *   N1     ★음성대조 — 가드를 떼면 W1 이 빨개진다
 *
 * 실행: node --test tests/unit/project-load-shape-guard.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const _req = createRequire(import.meta.url);
const { stripComments } = _req('./_strip-comments.js');
const { isProjectShaped } = _req(path.join(ROOT, 'main/project-store/snapshot-store.js'));

/* ═══ S — `isProjectShaped` 의 계약 ═══════════════════════════════════════
 * ⛔이 함수를 재는 검사가 그때까지 «0개»였다(`git grep -l isProjectShaped -- tests/` ⇒ 0).
 *   그런데 두 곳이 이것으로 「프로젝트인가」를 판정한다. ⇒ 계약을 여기서 못박는다. */

test('S1 ★문자열은 프로젝트가 아니다 — 이 한 줄이 undefined.json 을 만든 자리다', () => {
  assert.equal(isProjectShaped('proj_1775704460431'), false);
  assert.equal(isProjectShaped(''), false);
});

test('S2 ★객체가 아닌 것·배열·빈 것은 프로젝트가 아니다', () => {
  for (const v of [null, undefined, 0, 1, true, [], [1, 2], () => {}]) {
    assert.equal(isProjectShaped(v), false, `${typeof v} ${JSON.stringify(v) ?? String(v)}`);
  }
  assert.equal(isProjectShaped({}), false, '★빈 객체를 프로젝트로 봤다 — 자가치유가 빈 판으로 덮는다');
});

test('S3 ★pages 배열이 있으면 프로젝트다(신 꼴) · canvas 문자열이면 프로젝트다(옛 꼴)', () => {
  assert.equal(isProjectShaped({ pages: [] }), true, '★빈 pages 도 프로젝트다 — 새 프로젝트가 그 꼴이다');
  assert.equal(isProjectShaped({ pages: [{ id: 'page_1' }] }), true);
  assert.equal(isProjectShaped({ canvas: '<div></div>' }), true);
});

test('S4 ★그 실물 꼴(펼쳐진 문자열 ＋ 본문)은 «프로젝트로 보인다» — 그래서 «읽을 때»는 못 막는다', () => {
  /* ★★정직하게 적는다 — 저장돼 «버린» 그 파일은 pages 를 가지므로 이 자가 통과시킨다.
     ⇒ 이 가드는 「그 파일이 만들어지는 것」을 막고, 「이미 만들어진 그 파일」은 못 가른다.
     그 축(이미 생긴 것 청소)은 이 검사의 범위 밖이다 — SKIP 이 아니라 «다른 일»이다. */
  const asSaved = { 0: 'p', 1: 'r', version: 2, currentPageId: 'page_1', pages: [{ id: 'page_1' }], id: 'undefined' };
  assert.equal(isProjectShaped(asSaved), true);
});

/* ═══ W — 배선: 정상 경로가 그 자를 거치는가 ═══════════════════════════════ */

/** `projects:load` 핸들러 «몸통»을 중괄호 균형으로 떠낸다. ⛔글자수 창을 쓰지 마라. */
function loadHandler(src) {
  const A = "ipcMain.handle('projects:load'";
  const n = src.split(A).length - 1;
  assert.equal(n, 1, `projects:load 핸들러가 ${n} 곳이다 — 하나여야 한다`);
  const k = src.indexOf(A);
  let d = 0, i = src.indexOf('{', k);
  for (; i < src.length; i++) {
    if (src[i] === '{') d++;
    else if (src[i] === '}') { d--; if (d === 0) { i++; break; } }
  }
  assert.ok(i < src.length, 'projects:load 핸들러의 끝을 못 찾았다');
  return src.slice(k, i);
}

const MAIN = read('main.js');

/* ★E168(2026-10-06 lane-drag): 읽기·가드·폴백 체인은 핸들러에서 공용 readProjectWithFallback 으로 «옮겨졌다»(목록도 같이 부른다).
   핸들러는 그것을 부르기만 한다 → 자리를 그 함수 몸통으로 옮겨 «같은 것»을 잰다. 핸들러가 그 함수를 부르는지도 본다. */
function readerBody(src) {
  const A = 'function readProjectWithFallback(';
  assert.equal(src.split(A).length - 1, 1, 'readProjectWithFallback 은 하나여야 한다');
  const k = src.indexOf(A); let d = 0, i = src.indexOf('{', src.indexOf(')', k));
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (d === 0) { i++; break; } } }
  return src.slice(k, i);
}

test('W1 ★정상 경로가 「프로젝트 형태인가」를 거친다 — 그리고 «폴백으로 내려보낸다»', () => {
  assert.match(stripComments(loadHandler(MAIN)), /readProjectWithFallback\(/, '★로드 핸들러가 공용 읽기를 안 부른다');
  const fn = stripComments(readerBody(MAIN));
  const iParse = fn.indexOf('JSON.parse(fs.readFileSync(filePath');
  const iGuard = fn.indexOf('isProjectShaped(parsed)');
  const iFall = fn.indexOf('loadFallbackCandidates');
  assert.ok(iParse >= 0, '정상 경로의 읽기가 사라졌다 — 이 검사는 «안 재고» 있다');
  assert.ok(iGuard >= 0,
    '★★정상 경로가 「파싱되면 프로젝트」로 돌려준다 — 문자열이 그대로 새어 나가 저장 쪽에서 «0,1,2…» 로 펼쳐진다');
  assert.ok(iParse < iGuard, '★가드를 읽기보다 앞에 뒀다 — 파싱 결과를 못 잰다');
  assert.ok(iGuard < iFall, '★가드가 폴백 체인 «뒤»다 — 정상 경로가 이미 반환해 버린다');
  /* ⛔거절(throw/ok:false)이 아니라 «폴백으로 흐르는» 것이어야 한다 — 손상 JSON 과 «같은 처분». */
  assert.match(fn.slice(iGuard, iGuard + 220), /return \{ proj: parsed,/,
    '★통과할 때 parsed 를 안 돌려준다');
  assert.ok(!/throw new Error/.test(fn.slice(iGuard, iGuard + 220)),
    '★모양이 아니면 «던진다» — 백업에 성한 판이 있어도 프로젝트가 안 열린다(새 뜻을 만들지 마라)');
});

test('W2 ★★모듈 부재 폴백에도 그 함수가 있다 — 없으면 가드가 TypeError 로 죽는다', () => {
  const m = /const _SS_FALLBACK = \{[^;]*\};/.exec(stripComments(MAIN));
  assert.ok(m, '_SS_FALLBACK 을 못 찾았다 — 패턴을 갱신하라');
  assert.match(m[0], /isProjectShaped:/,
    '★★폴백에 isProjectShaped 가 없다 — snapshot-store 가 없는 판에서 「프로젝트를 못 여는」 앱이 된다');
});

test('W3 ★모르면 «통과»다 — 판정 모듈이 없을 때 로드를 막지 않는다(덜 하는 쪽이 안전)', () => {
  const m = /const _SS_FALLBACK = \{[^;]*\};/.exec(stripComments(MAIN));
  assert.match(m[0], /isProjectShaped: \(\) => true/,
    '★폴백이 false 를 돌려준다 — 모듈 없는 판에서 «모든» 프로젝트가 폴백으로 새고 결국 안 열린다');
});

/* ═══ N1 — 음성대조 ═══════════════════════════════════════════════════════ */

test('N1 ★음성대조 — 가드 줄을 떼면 W1 이 빨개진다(자리를 재고 있음을 증명)', () => {
  const ANCHOR = "if (_SS().isProjectShaped(parsed)) return { proj: parsed, from: 'proj',";
  assert.ok(MAIN.includes(ANCHOR), '★변이 닻을 못 찾았다 — 이 음성대조는 «안 재고» 있다');
  const mutated = MAIN.replace(ANCHOR, "return { proj: parsed, from: 'proj',");
  const fn = stripComments(readerBody(mutated));
  assert.equal(fn.indexOf('isProjectShaped(parsed)'), -1,
    '★가드를 떼었는데도 남아 있다 — 이 음성대조는 «안 재고» 있다');
});
