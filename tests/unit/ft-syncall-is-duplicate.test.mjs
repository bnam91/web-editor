/* ft-syncall-is-duplicate.test.mjs — ★`watchAllFxFreeTransform` 안의 `ftHandlesSyncAll(root)` 은
 *   ★★«중복»이라는 ★판정을 ★잠근다. ★이름 = `FT-SYNCALL-IN-WATCHALL-DUPLICATE-01` (2026-10-24 신설)
 *
 * ★왜 있나
 *   ★261024 에 ★내가 ★그 줄의 `return n;` 자리를 고치고 ★커밋 메시지에 「★재는 자 = … H6」이라
 *   ★적었다 — ★★거짓이었다. ★변이로 재니(줄을 ★다시 `return` 뒤로 옮겨도) ★11벌 ★전부 초록이었다.
 *   ⇒ ★그 줄은 ★★어떤 검사도 ★안 잠그고 있었다. ★「★규칙은 ★재는 자가 있어야 집행된다」 그 자리.
 *
 * ★★이 파일이 ★잠그는 것 = ★★«중복의 ★근거»다 — ★두 자리가 ★같은 집합을 도는가.
 *   ⒜ `watchAllFxFreeTransform` 의 선택자 ⒝ `ftHandlesSyncAll` 의 선택자 — ★★둘이 ★같아야 한다.
 *   ★누가 ★한쪽을 ★넓히면 ★여기서 ★빨강이고, ★그때 ★「아직 중복인가」를 ★다시 판정하게 ★된다.
 *   ⛔주석으로는 ★못 막는다. ⛔「중복이니 지워라」로도 ★닫지 않는다 —
 *     ★지워도 동작은 같지만 ★★그 줄을 재는 자가 없어 ★지운 뒤 깨지면 ★아무도 모른다.
 *
 * ★★이 파일이 ★안 잠그는 것(★정직하게 적는다)
 *   · ★`applyFxFreeTransform` 의 early return 넷 중 ★`noCE`(contenteditable 없음) 판은 ★★미측정이다
 *     — ★261024 에 ★변조가 ★실패해 `applied=true` 가 나왔다. ★행위로 ★다시 재야 한다.
 *   · ★이 파일은 ★★«소스»를 ★읽는다 — ★행위 측정은 ★DOM 쪽 몫이다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '..', '..');
const FT   = fs.readFileSync(path.join(ROOT, 'js', 'effects-freetransform.js'), 'utf8');
const HND  = fs.readFileSync(path.join(ROOT, 'js', 'effects-ft-handles.js'), 'utf8');

/** 함수 하나의 본문을 ★닻으로 떠낸다(⛔줄번호로 집지 않는다 — 덧붙이면 밀린다).
 *  ★★닻은 ★★«부르는 자리의 ★리터럴»로 ★받는다 — ⛔여기서 ★`${name}` 으로 ★조립하지 ★않는다.
 *    ★까닭 : ★조립하면 ★★그 함수 이름이 ★이 파일에 ★★«글자»로 ★안 남아 ★★누가 ★이름을 ★바꿀 때
 *      ★grep 이 ★이 검사를 ★못 찾는다. ★`tests/unit/anchor-signature-ratchet.test.mjs` R4 가
 *      ★261024 에 ★바로 ★그걸 ★잡았다(★변수 닻 ★37 → ★38) ⇒ ★★기준을 올리지 ★않고 ★원인을 없앴다. */
function bodyAfter(src, anchor) {
  const i = src.indexOf(anchor);
  assert.notEqual(i, -1, `★닻을 못 찾았다 — 이 검사의 자가 낡았다(이름이 바뀌었나): ${anchor}`);
  const open = src.indexOf('{', i);
  let depth = 0;
  for (let j = open; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) return src.slice(open, j + 1); }
  }
  assert.fail(`★본문 끝을 못 찾았다: ${anchor}`);
}

/** 본문에서 `querySelectorAll('...')` 의 선택자 전부 — ★주석 안의 것은 뺀다. */
function selectorsIn(body) {
  const noComments = body
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
  return [...noComments.matchAll(/querySelectorAll\(\s*'([^']+)'/g)].map(m => m[1]);
}

test('F1 ★전제 — 두 함수가 실재하고, 각각 querySelectorAll 을 ★한 번만 쓴다', () => {
  const w = selectorsIn(bodyAfter(FT, 'export function watchAllFxFreeTransform('));
  const a = selectorsIn(bodyAfter(HND, 'export function ftHandlesSyncAll('));
  assert.equal(w.length, 1, `★watchAllFxFreeTransform 의 querySelectorAll 이 ${w.length} 개다 — 구조가 바뀌었으면 F2 의 비교가 무의미하다 (${JSON.stringify(w)})`);
  assert.equal(a.length, 1, `★ftHandlesSyncAll 의 querySelectorAll 이 ${a.length} 개다 (${JSON.stringify(a)})`);
  /* ★★음성대조 — ★뽑은 것이 ★빈 문자열이 아니다(★정규식이 헛돌면 둘 다 ∅ 로 ★같아진다) */
  assert.ok(w[0].length > 5, `★선택자가 너무 짧다 — 파싱이 헛돌았다: ${JSON.stringify(w[0])}`);
});

test('F2 ★★두 자리가 ★같은 집합을 돈다 = ★중복의 근거 (갈리면 「아직 중복인가」를 다시 판정해라)', () => {
  const w = selectorsIn(bodyAfter(FT, 'export function watchAllFxFreeTransform('))[0];
  const a = selectorsIn(bodyAfter(HND, 'export function ftHandlesSyncAll('))[0];
  assert.equal(a, w,
    '★두 선택자가 갈렸다 — `ftHandlesSyncAll` 이 `watchAllFxFreeTransform` 과 ★다른 집합을 돈다.\n' +
    `  watchAllFxFreeTransform: ${JSON.stringify(w)}\n` +
    `  ftHandlesSyncAll       : ${JSON.stringify(a)}\n` +
    '  ⇒ ★그러면 그 줄은 더는 «중복»이 아니다. `FT-SYNCALL-IN-WATCHALL-DUPLICATE-01` 을 다시 판정해라.');
});

test('F3 ★사슬 — `applyFxFreeTransform` 이 ★제 끝에서 `ftHandlesSync` 를 부른다(중복의 나머지 반쪽)', () => {
  const body = bodyAfter(FT, 'export function applyFxFreeTransform(');
  assert.match(body, /window\.ftHandlesSync\?\.\(\s*tb\s*\)/,
    '★`applyFxFreeTransform` 이 더는 `ftHandlesSync(tb)` 를 안 부른다 — ' +
    '그러면 `ftHandlesSyncAll` 은 ★중복이 아니라 ★★유일한 길이 된다. 그 줄을 지우지 마라.');
  /* ★그 줄이 ★`return` ★앞에 있나 — ★261024 에 ★뒤에 있어 ★죽은 코드였다(적대적 C1 이 잡았다) */
  const noComments = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const iCall = noComments.indexOf('window.ftHandlesSync?.(tb)');
  const iTrue = noComments.lastIndexOf('return true');
  assert.ok(iCall > -1 && iTrue > -1 && iCall < iTrue,
    `★\`ftHandlesSync(tb)\` 가 \`return true\` ★뒤에 있다 = ★★죽은 코드다 (call=${iCall} · return=${iTrue})`);
});

test('F4 ★`watchAllFxFreeTransform` 의 그 줄이 ★`return n;` ★앞에 있다 (261024 고침의 재는 자)', () => {
  const body = bodyAfter(FT, 'export function watchAllFxFreeTransform(');
  const noComments = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const iCall = noComments.indexOf('window.ftHandlesSyncAll?.(root)');
  const iRet  = noComments.lastIndexOf('return n');
  assert.ok(iCall > -1, '★`ftHandlesSyncAll?.(root)` 줄이 사라졌다 — 지우려면 F2·F3 를 먼저 다시 판정해라');
  assert.ok(iRet > -1, '★`return n` 이 없다 — 이 검사의 자가 낡았다');
  assert.ok(iCall < iRet,
    `★그 줄이 ★\`return n;\` ★뒤에 있다 = ★★죽은 코드다 (261024 에 그랬다 · call=${iCall} · return=${iRet})`);
});
