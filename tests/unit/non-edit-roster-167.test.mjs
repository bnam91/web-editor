/* non-edit-roster-167 — ★167(지디 처방 2026-10-26): «편집 아닌 차이»의 이름 명부(js/non-edit-roster.js)와
 *   비교 정규식(js/history.js _NON_EDIT_ATTR_RE · _CHROME_RE)이 «한 정의»인가를 바이트째 잰다.
 *   ⛔history.js 의 두 정규식은 글자 그대로 둔다(무접촉 · 게이트 history-chrome-noise · insert-seam-settle · grad-sec-clip-rail 가 그 선언을 글로 읽는다)
 *   ⇒ 대신 «이름으로 조립한 정규식의 .source === 그 글자»를 단언한다 — 한쪽만 바꾸면 빨강.
 *   짝: 감시자 쪽(js/io/save-load.js _isGenNeutral)은 tests/dom/history-gate-130.dom.spec.js S1~S4 가 잰다
 *   ⇒ 명부를 비우면 «두 쪽이 같이» 빨강(이 파일 R1 · 그 spec S1/S4). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const HISTORY = fs.readFileSync(path.join(ROOT, 'js/history.js'), 'utf8');
/* ★명부를 «글로» 읽는다(선례: pan-native-scroll.test.js ROSTER_REL · buzz-profile-chrome.test.mjs [파일, 상수이름] 표) — 실행 0.
   ⛔import() 로 싣지 마라 — 이 레포 .js 는 CJS 로 읽히고, data: URL import 는 win-portability ②-4 가 막는다(윈도우 ERR_UNSUPPORTED_ESM_URL_SCHEME).
   ★«선언 한 줄» 앵커가 이름을 뽑는다(주석엔 export const … Object.freeze([…]) 꼴이 없다 ⇒ 주석이 지금 답을 바꾸지 않는다 · 지디 탐침 261026).
   codeOnly 는 ★보험(필수 아님) — 머리말에 history.js 글자(draggable="(?:true|false)")가 그대로 있어, 앵커가 느슨해지는 날을 막는다. */
const ROSTER_REL = 'js/non-edit-roster.js';
const codeOnly = (t) => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const ROSTER = codeOnly(fs.readFileSync(path.join(ROOT, ROSTER_REL), 'utf8'));
const list = (name) => {
  const m = ROSTER.match(new RegExp(`export const ${name} = Object\\.freeze\\(\\[([^\\]]*)\\]\\);`));
  return m ? [...m[1].matchAll(/'([^']*)'/g)].map(x => x[1]) : null;   // null = 파싱이 못 찾음(R0 가 그 이름으로 낸다)
};
const NON_EDIT_ATTRS = list('NON_EDIT_ATTRS');
const NON_EDIT_CSSVARS = list('NON_EDIT_CSSVARS');
const CHROME_SEL = (ROSTER.match(/export const CHROME_SEL = '([^']*)';/) || [])[1];

test('R0 [전제] 파싱이 찾았다 — 세 선언 줄 · 뽑힌 이름 ≥1 · history.js 두 정규식 선언(못 찾으면 «안 돈» 것 — «갈렸다»로 보고하지 않는다)', () => {
  assert.ok(NON_EDIT_ATTRS && NON_EDIT_CSSVARS && CHROME_SEL, `${ROSTER_REL} 의 선언 줄을 파싱이 못 찾았다(NON_EDIT_ATTRS·NON_EDIT_CSSVARS·CHROME_SEL)`);
  assert.ok(NON_EDIT_ATTRS.length + NON_EDIT_CSSVARS.length >= 1, '선언 줄은 찾았는데 뽑힌 이름이 0 이다');
  assert.ok(/const _NON_EDIT_ATTR_RE = \/(.*)\/g;/.test(HISTORY), '_NON_EDIT_ATTR_RE 선언을 못 찾았다');
  assert.ok(/const _CHROME_RE = \/(.*)\/g;/.test(HISTORY), '_CHROME_RE 선언을 못 찾았다');
});

test('R1 ★이름으로 조립한 글자 === history.js _NON_EDIT_ATTR_RE 글자(바이트째) — «한 글자도 안 바꿈»을 수로', () => {
  const lit = HISTORY.match(/const _NON_EDIT_ATTR_RE = \/(.*)\/g;/)[1];
  const built = [
    ...NON_EDIT_ATTRS.map(a => ` ${a}="(?:true|false)"`),
    ...NON_EDIT_CSSVARS.map(v => `\\s*${v}:\\s*[^;"]*;?`),
  ].join('|');   // ⛔new RegExp 로 감싸지 않는다 — 글자 비교로 충분(지디)
  assert.equal(lit, ' draggable="(?:true|false)"|\\s*--sec-clip:\\s*[^;"]*;?', '[양성대조] 글자가 오늘(614e5f22) 값이다');
  assert.equal(built, lit, '명부와 비교 정규식이 갈렸다 — 한쪽만 바꿨다');
});

test('R2 ★CHROME_SEL 이 history.js _CHROME_RE 의 그 자리다', () => {
  const lit = HISTORY.match(/const _CHROME_RE = \/(.*)\/g;/)[1];
  assert.ok(CHROME_SEL.startsWith('.'), 'CHROME_SEL 은 class 선택자다');
  assert.equal(lit, `<div class="${CHROME_SEL.slice(1)}">[\\s\\S]*?<\\/div>`, '명부와 _CHROME_RE 가 갈렸다');
});
