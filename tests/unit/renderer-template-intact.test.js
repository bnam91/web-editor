/* ★렌더러로 보내는 JS 템플릿이 «중간에 닫히지» 않았나.
   실측 근거(2026-09-07, 같은 실수 2회): main.js 의 executeJavaScript 용 템플릿 리터럴 «안»에
   한국어 주석을 쓰다가 백틱을 넣었다. 백틱은 템플릿을 «닫는다» ⇒ 뒤 내용이 코드로 파싱된다.
     `.asset-block` → 템플릿 종료 + `.asset - block` ⇒ 런타임 ReferenceError: block is not defined.
   ⛔node --check 는 이걸 «통과시킨다» — 잘린 뒤에도 문법은 성립하기 때문이다.
   ⇒ 「닫는 표시(})()」가 템플릿 «안»에 남아 있나」로 잰다. */
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { readSrc } = require('./_srcread.js');   // ⛔CRLF — win-portability ①-3

const MAIN = readSrc(path.join(__dirname, '..', '..'), 'main.js');

/** `const <name> = ` 다음의 템플릿을, «이스케이프 안 된» 첫 백틱까지 잘라 낸다(= 실제 파서와 같은 규칙). */
function templates(src) {
  const out = [];
  const re = /const (\w*[jJ]s\w*) = `/g;
  let m;
  while ((m = re.exec(src))) {
    const start = re.lastIndex;
    let i = start;
    while (i < src.length) {
      if (src[i] === '\\') { i += 2; continue; }
      if (src[i] === '`') break;
      i++;
    }
    out.push({ name: m[1], line: src.slice(0, m.index).split('\n').length, body: src.slice(start, i) });
  }
  return out;
}

test('R1 ★양성대조 — 검사할 템플릿이 «있다»(0개면 이 검사는 장식이다)', () => {
  const t = templates(MAIN);
  assert.ok(t.length >= 10, `템플릿을 ${t.length}개 찾았다 — 패턴이 썩었다. 0개면 아래가 전부 자동통과다`);
});

test('R2 템플릿이 «중간에 닫히지» 않았다 — 닫는 표시가 안에 있다', () => {
  const bad = templates(MAIN)
    .filter(t => t.body.trimStart().startsWith('(() =>'))
    .filter(t => !/\}\)\(\)\s*$/.test(t.body.trimEnd()));
  assert.deepEqual(bad.map(t => `main.js:${t.line} ${t.name}`), [],
    '★IIFE 템플릿이 «})()» 로 안 끝난다 = 중간에 백틱으로 닫혔다. 주석의 백틱을 지워라');
});

test('R3 ★변이대조 — 템플릿 안에 백틱을 하나 넣으면 R2 가 빨개져야 한다', () => {
  const i = MAIN.indexOf('const atomicJs = `');
  assert.ok(i > 0);
  const cut = MAIN.slice(0, i + 40) + '`' + MAIN.slice(i + 40);
  const bad = templates(cut)
    .filter(t => t.body.trimStart().startsWith('(() =>'))
    .filter(t => !/\}\)\(\)\s*$/.test(t.body.trimEnd()));
  assert.ok(bad.length > 0, '변이가 안 잡힌다 = R2 는 이 결함 모양을 «못» 본다');
});
