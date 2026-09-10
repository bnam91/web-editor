/* gallery-path.test.js — 「main 이 가리키는 html 경로가 «실재하나»」 (2026-09-08 사고에서)
 *
 * ★사고: 활성 프로젝트를 지우면 창이 `chrome-error://chromewebdata/` 로 갔다.
 *   원인은 URL 문자열을 손으로 조립해 «없는 경로»를 만든 것 —
 *     file:///…/index.html?project=x  →  file:///…/projects.html   (루트)
 *   그런데 실제 파일은 `pages/projects.html` 이다. 루트엔 없다.
 *   ⛔「지웠다」는 성공을 답했다. 도구가 초록이라 아무도 몰랐다 — «화면»은 죽어 있었다.
 *
 * ★그래서 이 검사는 «문자열끼리» 비교하지 않는다. 문자열 비교는 두 문자열이 같이 낡으면 통과한다.
 *   ⇒ 「말」이 아니라 «말이 가리키는 사실»을 잰다: fs.existsSync.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { readSrc } = require('./_srcread.js');   // ⛔CRLF — win-portability ①-3
const { sliceBlock } = require('./_slice-block.js');   // ★구간 떠내기는 «공용 부품»(_slice-block.js) 하나로 — ⛔여기서 자를 새로 만들지 마라(끝은 «균형괄호»로 찾는다)
const ROOT = path.join(__dirname, '..', '..');
/* ★소스를 «문자열로 잘라» 보는 검사는 반드시 readSrc 를 탄다.
     윈도우 체크아웃(core.autocrlf=true)에서 \r 이 섞이면 정규식이 조용히 빗나가
     «검사 파일이 통째로 안 도는» 사고가 난다(실측: 맥 1215 / 윈도우 1108).
   ⛔내가 이 가드를 어겼고 팀의 win-portability ①-3 이 잡았다 — 가드가 사는 이유다. */
const SRC = readSrc(ROOT, 'main.js');

test('P1 ★main.js 가 loadFile 로 여는 html 이 «전부 실재한다»', () => {
  const found = [...SRC.matchAll(/loadFile\(\s*'([^']+\.html)'\s*\)/g)].map(m => m[1]);
  assert.ok(found.length >= 3, `loadFile 호출을 못 찾았다(${found.length}) — 검사가 «못 재고» 있다`);
  const missing = found.filter(rel => !fs.existsSync(path.join(ROOT, rel)));
  assert.deepEqual(missing, [],
    `★없는 파일을 연다 — 창이 chrome-error 로 간다:\n  ${missing.join('\n  ')}`);
});

test('P2 ★갤러리 경로 «정본»이 하나다 — 두 벌이면 하나가 낡는다', () => {
  assert.match(SRC, /const GALLERY_PAGE = '([^']+)'/, '★갤러리 경로 상수가 없다');
  const page = SRC.match(/const GALLERY_PAGE = '([^']+)'/)[1];
  assert.ok(fs.existsSync(path.join(ROOT, page)), `★GALLERY_PAGE 가 없는 파일을 가리킨다: ${page}`);
});

test('P3 ⛔갤러리로 갈 때 «URL 문자열을 조립»하지 않는다 (사고의 직접 원인)', () => {
  /* 조립하면 `pages/` 같은 실제 배치를 «모른 채» 경로가 만들어진다.
     loadFile 은 앱 뿌리 기준이라 배치를 안다. */
  assert.ok(!/replace\([^)]*projects\.html'\)/.test(SRC),
    '★URL 을 문자열로 조립해 projects.html 을 만든다 — 그게 chrome-error 를 냈다');
  assert.ok(!/replace\(\/\[\^\/\]\*\$\/, 'projects\.html'\)/.test(SRC),
    '★마지막 세그먼트 치환으로 갤러리 경로를 만든다 — 배치가 바뀌면 조용히 깨진다');
});

test('P4 ★활성 삭제 경로가 «그 정본»을 쓴다 — 상수만 있고 안 쓰면 죽은 배선이다', () => {
  const body = sliceBlock(SRC, 'async function _clearActiveIfNeeded', '_clearActiveIfNeeded 가 없다');
  assert.match(body, /loadFile\(GALLERY_PAGE\)/,
    '★활성 프로젝트를 지운 뒤 갤러리로 갈 때 정본 상수를 안 쓴다');
});
