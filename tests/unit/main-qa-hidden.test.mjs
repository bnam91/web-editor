/* main-qa-hidden.test.mjs — main.js QA 숨김 창(GODITOR_QA_HIDDEN=1)이 «환경변수 없으면 지금과 같다»를 «구조»로 잠근다.
 *   ⚠️행위가 아니라 소스 대조다 — Electron 을 띄워 재지 않는다. 2026-10-02 태양(현빈 승인 설계 ②).
 *   git 판 대조(22d94bf0 과 ▼▲ 블록 셋만 다름)는 넣은 커밋에서 한 번 했다 — 여기서 하면 main.js 의 다른 수정마다 빨개져 파일을 얼린다. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.GD1001_ROOT || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
const LINES = SRC.split('\n');

/* ▼QA_HIDDEN … ▲QA_HIDDEN 블록의 [시작, 끝] 줄 번호(0 기준) */
function blocks() {
  const out = []; let open = -1;
  LINES.forEach((l, i) => {
    if (/\/\/\s*▼QA_HIDDEN/.test(l)) { assert.equal(open, -1, `★${i + 1}행: ▼ 가 닫히기 전에 또 열렸다`); open = i; }
    else if (/\/\/\s*▲QA_HIDDEN/.test(l)) { assert.notEqual(open, -1, `★${i + 1}행: ▼ 없이 ▲`); out.push([open, i]); open = -1; }
  });
  assert.equal(open, -1, '★▼ 가 안 닫혔다');
  return out;
}
const inBlock = (i, bs) => bs.some(([a, b]) => i > a && i < b);

test('Q0 전제 — 표식 블록을 «찾았다»(0개면 아래 검사가 공짜로 초록)', () => {
  assert.ok(blocks().length >= 3, `표식 블록 ${blocks().length}개 — 셋(플래그·활성화 정책·show:false)이 있어야 한다`);
});
test('Q1 ★_QA_HIDDEN 은 정확히 한 번, «GODITOR_QA_HIDDEN === \'1\'» 로만 정의된다', () => {
  const defs = SRC.match(/const _QA_HIDDEN\s*=\s*[^;]+;/g) || [];
  assert.equal(defs.length, 1);
  assert.match(defs[0], /process\.env\.GODITOR_QA_HIDDEN === '1'/);
});
test('Q2 ★숨김 관련 줄은 «전부» 표식 블록 안에 있다 — 블록 밖에서 숨김이 새지 않는다', () => {
  const bs = blocks();
  const NEEDLES = [/_QA_HIDDEN/, /show:\s*false/, /setActivationPolicy/, /disable-backgrounding-occluded-windows/, /disable-renderer-backgrounding/, /CalculateNativeWinOcclusion/];
  const outside = [];
  LINES.forEach((l, i) => { if (NEEDLES.some(re => re.test(l)) && !inBlock(i, bs) && !/^\s*\/\//.test(l)) outside.push(`${i + 1}: ${l.trim()}`); });
  assert.deepEqual(outside, [], '★표식 블록 밖에 숨김 관련 코드가 있다');
});
test('Q3 ★표식 블록 안 «코드»는 전부 _QA_HIDDEN 조건 아래다 — 환경변수가 없으면 아무 일도 안 한다', () => {
  const bad = [];
  for (const [a, b] of blocks()) {
    const code = LINES.slice(a + 1, b).filter(l => l.trim() && !/^\s*\/\//.test(l));
    const first = code[0] || '';
    const ok = /^\s*const _QA_HIDDEN\b/.test(first) || /^\s*if \(_QA_HIDDEN\b/.test(first) || /^\s*\.\.\.\(_QA_HIDDEN \?/.test(first);
    if (!ok) bad.push(`${a + 1}: ${first.trim()}`);
    // const 정의 블록은 바로 뒤 if 블록이 나머지를 감싸야 한다
    if (/const _QA_HIDDEN/.test(first)) {
      const rest = code.slice(1);
      assert.ok(rest.length === 0 || /^\s*if \(_QA_HIDDEN\)\s*\{/.test(rest[0]), `★${a + 1}행 블록: 정의 뒤 코드가 if (_QA_HIDDEN) 밖이다`);
    }
  }
  assert.deepEqual(bad, [], '★조건 없이 도는 코드가 표식 블록 안에 있다');
});
