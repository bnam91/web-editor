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
/* 이 레포 package.json 에 type:module 이 없어 .js 는 CJS 로 읽힌다 ⇒ 명부 «그 파일 글»을 ESM 으로 싣는다(사본 0) */
const { NON_EDIT_ATTRS, NON_EDIT_CSSVARS, CHROME_SEL } = await import('data:text/javascript,' + encodeURIComponent(fs.readFileSync(path.join(ROOT, 'js/non-edit-roster.js'), 'utf8')));

test('R0 [전제] 명부가 비지 않았다 · 두 정규식 선언을 찾았다(못 찾으면 «안 돈» 것)', () => {
  assert.ok(NON_EDIT_ATTRS.length >= 1 && NON_EDIT_CSSVARS.length >= 1 && CHROME_SEL, '명부가 비었다');
  assert.ok(/const _NON_EDIT_ATTR_RE = \/(.*)\/g;/.test(HISTORY), '_NON_EDIT_ATTR_RE 선언을 못 찾았다');
  assert.ok(/const _CHROME_RE = \/(.*)\/g;/.test(HISTORY), '_CHROME_RE 선언을 못 찾았다');
});

test('R1 ★이름으로 조립한 정규식 .source === history.js _NON_EDIT_ATTR_RE 글자(바이트째) — «한 글자도 안 바꿈»을 수로', () => {
  const lit = HISTORY.match(/const _NON_EDIT_ATTR_RE = \/(.*)\/g;/)[1];
  const built = new RegExp([
    ...NON_EDIT_ATTRS.map(a => ` ${a}="(?:true|false)"`),
    ...NON_EDIT_CSSVARS.map(v => `\\s*${v}:\\s*[^;"]*;?`),
  ].join('|'), 'g');
  assert.equal(lit, ' draggable="(?:true|false)"|\\s*--sec-clip:\\s*[^;"]*;?', '[양성대조] 글자가 오늘(614e5f22) 값이다');
  assert.equal(built.source, new RegExp(lit, 'g').source, '명부와 비교 정규식이 갈렸다 — 한쪽만 바꿨다');
});

test('R2 ★CHROME_SEL 이 history.js _CHROME_RE 의 그 자리다', () => {
  const lit = HISTORY.match(/const _CHROME_RE = \/(.*)\/g;/)[1];
  assert.ok(CHROME_SEL.startsWith('.'), 'CHROME_SEL 은 class 선택자다');
  assert.equal(lit, `<div class="${CHROME_SEL.slice(1)}">[\\s\\S]*?<\\/div>`, '명부와 _CHROME_RE 가 갈렸다');
});
