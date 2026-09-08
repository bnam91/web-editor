/* 공용 주석 거르개(_strip-comments)의 «대조» + 사본이 늘지 못하게 하는 가드.
 *
 * ★2026-09-08 툴매니저가 실물로 잡은 것: 이 레포의 stripComments 11벌 중 9벌이
 *   `src.replace(/\/\*[\s\S]*?\*\//g,'')` 형태라 `accept="image/*"` 뒤를 통째로 삼킨다.
 *   ⇒ 진짜 코드가 «없는 것»이 되고 검사는 「0건 = 통과」로 초록이 된다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { makeStripper, stripComments } = require('./_strip-comments.js');

const UNIT = __dirname;

test('S-1 ★image/* 뒤의 «진짜 코드»가 살아남는다 (9벌이 여기서 부서졌다)', () => {
  const src = 'input.accept = "image/*";\nconst x = "prop-align-btn";';
  assert.ok(stripComments(src).includes('prop-align-btn'),
    '★image/* 를 블록 주석 시작으로 읽고 뒤를 삼켰다 — 코드가 «없는 것»이 된다');
});

test('S-2 ★진짜 주석은 지운다 (거르개가 «아무 일도 안 하는» 게 아니다)', () => {
  const out = stripComments('const b = 2;  /* 지워질것 */\n// 이줄도\nconst c = 3;');
  assert.ok(!out.includes('지워질것'), '★블록 주석을 안 지운다 — 거르개가 죽었다');
  assert.ok(!out.includes('이줄도'), '★줄 주석을 안 지운다');
  assert.ok(out.includes('const c = 3;'), '★코드까지 지웠다 — 과하다');
});

test('S-3 ★여러 줄 블록 주석을 «상태로» 넘긴다 (줄 자신의 시작만 보면 못 거른다)', () => {
  const out = stripComments('/* 설명 시작\n   이어지는 줄에 forbiddenToken 이 있다\n   끝 */\nconst real = 1;');
  assert.ok(!out.includes('forbiddenToken'), '★이어지는 줄을 «코드»로 읽고 있다');
  assert.ok(out.includes('const real = 1;'), '★주석이 끝난 뒤 코드를 못 살렸다');
});

test('S-4 ★문자열 속 http:// 를 안 자른다 (줄 중간 // 를 지우면 코드가 사라진다)', () => {
  assert.ok(stripComments("const u = 'http://www.w3.org/2000/svg';").includes('w3.org'),
    '★문자열 안의 // 를 주석으로 읽었다');
});

test('S-5 ★파일마다 «새» stripper 를 만들어야 한다 (상태가 새면 다음 파일이 오염된다)', () => {
  const a = makeStripper();
  a('/* 안 닫힌 주석 시작');            // a 는 이제 inBlock=true
  const b = makeStripper();             // ★새로 만들면 깨끗해야 한다
  assert.equal(b('const clean = 1;'), 'const clean = 1;',
    '★새 stripper 가 앞 파일의 상태를 물려받았다');
});

test('S-6 ⛔새 검사가 «자기 stripComments 를 만들지» 못한다 — 공용 부품을 써라', () => {
  /* ★허용목록은 «오늘의 빚»이다. 줄면 여기서 지워라. ⛔늘리려면 «왜»를 커밋에 적어라.
     자동으로 따라가게 두면 검사가 아니라 «기록»이 된다. */
  const LEGACY = new Set([
    'account-projects-root.test.js', 'tpl-open-window-await.test.mjs',
    'grid-rename-residue.test.mjs', 'pan-native-scroll.test.js',
    'modal-variant-identity.test.mjs', 'mcp-delete-project.test.js',
    'spacing-wiring.test.js', 'zoom-wheel-geometric.test.mjs',
    'zoom-block.test.js', 'no-blocking-alert.test.js',
  ]);
  const own = [];
  for (const n of fs.readdirSync(UNIT)) {
    if (!/\.test\.(js|mjs)$/.test(n) || LEGACY.has(n)) continue;
    if (n === path.basename(__filename)) continue;   // ★자기 자신 — 검출 정규식이 여기 «있어서» 걸린다
    const s = fs.readFileSync(path.join(UNIT, n), 'utf8');
    if (/function stripComments|const stripComments\s*=|function makeStripper/.test(s)) own.push(n);
  }
  assert.deepEqual(own, [],
    '★자기 stripComments 를 만든 검사가 있다 — ./_strip-comments.js 를 써라:\n  ' + own.join('\n  '));

  // ★양성대조 — 이 잣대가 «실제로» 잡는다(허용목록이 비면 전부 걸려야 한다)
  const wouldCatch = [...LEGACY].filter((n) => {
    try { return /function stripComments|const stripComments\s*=|function makeStripper/
      .test(fs.readFileSync(path.join(UNIT, n), 'utf8')); } catch { return false; }
  });
  assert.ok(wouldCatch.length >= 8,
    `★잣대가 죽었다 — 알려진 사본 ${LEGACY.size}개 중 ${wouldCatch.length}개만 잡힌다`);
});
