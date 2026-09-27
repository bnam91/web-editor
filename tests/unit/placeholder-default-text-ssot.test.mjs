/* U-26/placeholder — 「안내문구 기본문구는 «정본 한 곳»에서만 온다」. (2026-09-21)
 *   실행: npm test  (node --test 'tests/unit/*.test.mjs' 'tests/unit/*.test.js')
 *   선례: align-btn-ssot.test.mjs / grid-callsite-ssot.test.mjs — «소스 문자열»을 재는 SSOT 그물.
 *
 * ★왜 있나 (둘 다 «실제로 난» 일이다)
 *   ⑴ 배너 판정 함수는 banner02-block.js 의 기본문구 3개만 알았는데,
 *      「+ 텍스트 줄 추가」가 만드는 줄의 문구('새 줄')는 prop-banner02.js 에 «따로» 박혀 있었다.
 *      ⇒ 그 줄만 더블클릭해도 전체선택이 안 돼 「강아지 간식새 줄」로 이어붙었다.
 *   ⑵ 그리드 판정은 window 브리지(정본)를 읽으면서 `|| '내용을 입력하세요.'` 폴백 리터럴을 함께 뒀다.
 *      ⇒ 정본이 바뀌면 폴백만 혼자 낡아 «조용히» 전체선택이 멈춘다(동작 검사로는 안 잡히는 축).
 *   두 경우 모두 「값은 맞는데 정본이 둘」이라 동작 검사는 초록이었다. 그 축에 그물을 친다.
 *
 * ⚠️이 검사는 «소스 문자열»을 본다. 정상적인 리팩터링에도 빨강이 날 수 있다 —
 *   그때는 지우지 말고 「기본문구가 여전히 한 곳에서 오는가」를 확인한 뒤 패턴을 고쳐라.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '../../');
const { readSrc } = createRequire(import.meta.url)('./_srcread.js');

/* ── ⑴ 배너: 줄 기본문구 리터럴은 banner02-block.js «밖»에서 만들어지지 않는다 ─────────────
   규칙: js/ 어느 파일이든 `_bn2Lines.normalize({ ... })` 로 «새 줄»을 지을 때
        text 에 문자열 리터럴을 쓰면 안 된다(정본 window._bn2Lines.newLineText 를 읽어야 한다).
   ★파일 목록을 사람이 관리하지 않는다 — `_bn2Lines.normalize(` 를 쓰는 «순간» 검사 대상이 된다. */
test('배너: _bn2Lines.normalize 로 줄을 지을 때 기본문구를 «리터럴로» 쓰지 않는다', () => {
  const files = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, e.name);
      if (e.isDirectory()) walk(f);
      else if (e.name.endsWith('.js')) files.push(f);
    }
  })(path.join(REPO, 'js'));

  const offenders = [];
  let callsites = 0;
  for (const f of files) {
    const src = readSrc(f);
    // `_bn2Lines.normalize(` 부터 그 줄 끝까지를 본다(이 repo 의 호출은 전부 한 줄이다).
    const re = /_bn2Lines\.normalize\(([^\n]*)/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      callsites++;
      const arg = m[1];
      if (/text\s*:\s*['"`]/.test(arg)) {
        const line = src.slice(0, m.index).split('\n').length;
        offenders.push(`${path.relative(REPO, f)}:${line}  ${arg.trim().slice(0, 120)}`);
      }
    }
  }
  assert.ok(callsites > 0, '_bn2Lines.normalize 호출을 하나도 못 찾았다 — 검사가 «헛돌고» 있다(양성대조 실패)');
  assert.deepEqual(offenders, [],
    '배너 줄 기본문구는 banner02-block.js 의 정본(BANNER02_NEW_LINE_TEXT)을 window._bn2Lines.newLineText 로\n' +
    '읽어 써야 한다. 여기 리터럴을 두면 _isBanner02PlaceholderText 가 그 줄을 «안내문구로 안 본다»:\n  ' +
    offenders.join('\n  '));
});

test('배너: 정본 리터럴은 banner02-block.js 안에 «있다»(양성대조 — 검사가 헛돌지 않는다)', () => {
  const src = readSrc(path.join(REPO, 'js/blocks/banner02-block.js'));
  assert.match(src, /const BANNER02_NEW_LINE_TEXT = '[^']+';/,
    'banner02-block.js 에 BANNER02_NEW_LINE_TEXT 정본이 없다 — 정본이 어디로 갔는지 확인하라');
  assert.match(src, /newLineText:\s*BANNER02_NEW_LINE_TEXT/,
    'window._bn2Lines 브리지에 newLineText 가 없다 — prop-banner02.js 가 정본을 읽을 길이 끊긴다');
});

/* ── ⑵ 그리드: 편집진입의 기본문구 비교에 «그림자 폴백 리터럴»이 없다 ───────────────────── */
test('그리드: _gridBeginEdit 의 기본문구 비교에 폴백 리터럴이 «없다»', () => {
  const src = readSrc(path.join(REPO, 'js/block-drag.js'));
  const lines = src.split('\n');
  const hits = lines
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => t.includes('window.GRID_CELL_DEFAULT_TEXT'));
  assert.ok(hits.length > 0,
    'block-drag.js 가 window.GRID_CELL_DEFAULT_TEXT 를 «안 읽는다» — 그리드 안내문구 전체선택이 통째로 사라졌는지 확인하라');
  for (const { t, i } of hits) {
    assert.ok(!/['"`]/.test(t.replace(/\/\/.*$/, '')),
      `block-drag.js:${i + 1} — 정본(grid-block.js GRID_CELL_DEFAULT_TEXT) 옆에 문자열 리터럴이 있다.\n` +
      `  정본이 바뀌면 이 복제만 낡아 «조용히» 전체선택이 멈춘다. 리터럴을 지우고 브리지 값만 써라.\n  ${t.trim()}`);
  }
});

test('그리드: 정본은 grid-block.js «한 곳»이고 window 브리지로만 건너간다', () => {
  const src = readSrc(path.join(REPO, 'js/blocks/grid-block.js'));
  assert.match(src, /export const GRID_CELL_DEFAULT_TEXT = '[^']+';/,
    'grid-block.js 의 GRID_CELL_DEFAULT_TEXT 정본이 없다');
  assert.match(src, /window\.GRID_CELL_DEFAULT_TEXT = GRID_CELL_DEFAULT_TEXT;/,
    'window 브리지가 없다 — block-drag.js 가 값을 못 읽어 «조용히» 전체선택이 멈춘다');
});
