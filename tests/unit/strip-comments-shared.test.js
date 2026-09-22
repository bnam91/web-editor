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

/* ═══════════════════════════════════════════════════════════════════════
   S-7 — ★«블록 주석이 열리는 자리»를 꼴로 못박는다 (2026-09-22)
   ──────────────────────────────────────────────────────────────────────
   S-1 은 «따옴표 안»의 `/*` 만 막았다. 그런데 같은 병에 입구가 더 있었다.
   초판은 한 줄을 «두 번» 훑었다 — ⑴블록 주석 먼저 ⑵줄 주석 나중. 그래서 «나중에 걷힐»
   줄 주석 안의 `/*` 를 «진짜 블록 시작»으로 읽었다. 실측(기준선 b7d0a10):
     js/branch-system.js:9  … }; // 파랑 (feature/*)      → 그 뒤 74줄(인라인 핸들러 2개)이 사라졌다
     js/editor.js:3230      // … presets/*.json 과 동기화 → 선언 2줄이 사라졌다
   ★★그때 검사는 «전부 초록»이었다. 「검사가 있다」 ≠ 「그 꼴을 밟는다」.
   ⇒ 그래서 «입구를 꼴로 나열»한다. ⛔한 꼴을 막고 닫지 마라 — 이 도구는 이미 한 번 그렇게 닫혔다.
   ⛔새 꼴을 찾으면 «여기»에 더해라. 자기 stripComments 를 만들지 마라(S-6).
   ═══════════════════════════════════════════════════════════════════════ */
test('S-7 ★블록 주석이 «아닌 자리»에서 열리지 않는다 — 입구를 꼴로 나열한다', () => {
  const OPEN = '/' + '*', CLOSE = '*' + '/';   // ⛔이 파일 자신이 그 꼴에 걸리지 않게 쪼개 쓴다

  /** 그 줄 하나를 먹인 뒤 제거기가 «블록 안이라고 믿는가». 믿으면 true. */
  const opensBlock = (line) => {
    const s = makeStripper();
    s(line);
    return s('CODE_AFTER;').trim() !== 'CODE_AFTER;';
  };
  /** 그 줄에서 «코드»가 살아남는가. */
  const keeps = (line, token) => stripComments(line).includes(token);

  /* ⑴ 따옴표 «안» — 초판도 막았다. 대조군으로 남긴다. */
  assert.equal(opensBlock(`input.accept = "image${OPEN}";`), false, `★쌍따옴표 안의 ${OPEN}`);
  assert.equal(opensBlock(`const a = 'x${OPEN}y';`), false, `★홑따옴표 안의 ${OPEN}`);

  /* ⑵ 줄 주석 «안» — 초판이 못 막은 자리. 실물 두 건의 꼴 그대로. */
  assert.equal(opensBlock(`return { dot: '#2d6fe8' }; // 파랑 (feature${OPEN})`), false,
    `★줄 주석 안의 ${OPEN} 에서 블록이 열렸다 — js/branch-system.js:9 가 74줄을 잃은 꼴이다`);
  assert.equal(opensBlock(`// PRESET_FALLBACK 을 presets${OPEN}.json 과 동기화`), false,
    `★줄 주석 안의 ${OPEN} — js/editor.js:3230 의 꼴이다`);
  assert.equal(opensBlock(`// 이유: js${OPEN}${'*'}.js 를 node 가 못 읽는다`), false,
    `★줄 주석 안의 ${OPEN} (글롭 두 개) — js/blocks/zoom-geometry.js:3 의 꼴이다`);
  assert.ok(keeps(`const keepMe = 1; // feature${OPEN}\nconst alsoKeepMe = 2;`, 'alsoKeepMe'),
    '★줄 주석 뒤의 «다음 줄 코드»가 사라졌다');

  /* ⑶ 템플릿 리터럴 «안»(같은 줄) — 초판이 못 막은 둘째 자리.
       블록 훑기가 백틱을 안 봤다(줄 주석 훑기만 봤다). 그래서 «먼저 훑는 쪽»이 삼켰다. */
  assert.equal(opensBlock('const s = `a ' + OPEN + ' b`;'), false,
    `★템플릿 안의 ${OPEN} 에서 블록이 열렸다 — 템플릿 «내용»은 코드다`);
  assert.ok(keeps('const s = `a ' + OPEN + ' TOKEN ' + CLOSE + ' c`;', 'TOKEN'),
    '★템플릿 안의 주석처럼 생긴 «내용»을 지웠다');
  assert.ok(keeps('const u = `https://a.com/TOKEN`;', 'TOKEN'),
    '★템플릿 안의 // 를 줄 주석으로 읽어 «줄 나머지»를 먹었다');

  /* ⑷ 블록 주석 «안»의 // 와 URL — 닫는 표기를 놓치면 그 뒤가 통째로 사라진다.
       실물: js/report-buffer.js:35 가 「URL(https://…)은 … 」 뒤에 블록을 닫는다. */
  assert.ok(keeps(`${OPEN} 설명 https://a.com/b ${CLOSE} const TOKEN = 1;`, 'TOKEN'),
    `★블록 주석 안의 URL 때문에 닫는 ${CLOSE} 를 못 봤다 — 그 뒤 코드가 전부 사라진다`);
  assert.ok(keeps(`${OPEN} 시작\n   https://a.com ${CLOSE} const TOKEN = 1;`, 'TOKEN'),
    '★여러 줄 블록 주석을 «닫는» 줄에 URL 이 있으면 안 닫힌다 — 그 뒤가 통째로 사라진다');

  /* ⑸ 음성대조 — 넓히다 반대로 새지 않았나. «진짜» 주석은 여전히 걷힌다·열린다. */
  assert.equal(opensBlock(`const a = 1; ${OPEN} 안 닫힌 블록`), true,
    '★진짜 블록 주석도 안 연다 — 거르개가 죽었다(모든 검사가 «늘 초록»이 된다)');
  assert.ok(!keeps(`const a = 1; ${OPEN} FORBIDDEN ${CLOSE}`, 'FORBIDDEN'), '★같은 줄 블록 주석을 안 지운다');
  assert.ok(!keeps('const a = 1; // FORBIDDEN', 'FORBIDDEN'), '★꼬리 줄 주석을 안 지운다');
  assert.equal(stripComments('a\n// x\nb').split('\n').length, 3, '★줄 수가 안 보존된다(줄번호가 밀린다)');
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
