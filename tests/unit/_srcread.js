/* _srcread — «소스를 문자열로 잘라 재는» 검사가 소스를 읽는 «단 하나의» 문.
 *
 * ★왜 있나 (미니4호기 윈도우 실기, b9edc92)
 *   그 기계는 `core.autocrlf=true` 라 체크아웃이 CRLF 다. 그러면
 *   `src.indexOf('\n}\n')` · `/^const X = .*;$/m` · 소스 문자열 비교가 전부 어긋나고,
 *   자르기가 던져서 «검사 파일이 통째로 한 줄도 안 돈다».
 *   실측: 맥 1215통과 / 윈도우 1108개만 «돌았다» — 게이트가 절반만 돈 상태였다.
 *
 * ⛔건너뛰기(skip)로 막지 않는다 — 건너뛴 검사는 윈도우에서 영영 안 돈다.
 *   개행만 «한 가지»로 만들어 «같은 검사를 양쪽에서» 돌린다.
 *
 * ⚠️바이트를 그대로 재야 하는 자리(해시·픽스처 대조)에는 쓰지 마라. 여기는 «소스 텍스트» 전용.
 *
 * (파일명이 _ 로 시작해 테스트 글롭(`*.test.js`)에 안 걸린다 — 도구다.)
 * ★ESM(.mjs)에서도 `import { readSrc } from './_srcread.js'` 로 쓸 수 있다
 *   (module.exports 객체 리터럴이라 cjs-module-lexer 가 이름을 뽑는다).
 */
'use strict';
const fs = require('fs');
const path = require('path');

/** CRLF → LF. 그 밖의 것은 건드리지 않는다(앞뒤 공백·탭 보존). */
function normalizeEol(src) {
  return String(src).replace(/\r\n/g, '\n');
}

/** 소스 파일을 «LF 로 정규화해» 읽는다. */
function readSrc(...segs) {
  return normalizeEol(fs.readFileSync(path.join(...segs), 'utf8'));
}

/** 경로를 검사 키로 쓸 때 — 윈도우 `js\a.js` 를 `js/a.js` 로 (④ 경로 구분자). */
function toPosix(p) {
  return String(p).split(path.sep).join(path.posix.sep);
}

module.exports = { normalizeEol, readSrc, toPosix };
