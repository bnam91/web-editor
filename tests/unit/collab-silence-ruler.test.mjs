/* collab-silence-ruler — 협업 코드에서 «조용히 삼키는» 자리를 센다(지디 발주 TWO ⑤ 「무엇으로 세나」).
 *
 * 자(2026-10-06 태양 · 이 식을 건 쪽이 돌린다):
 *   ㉠ 빈 catch 0건      /catch\s*(\([^)]*\))?\s*\{\s*\}/  ·  /\.catch\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/
 *   ㉡ 모든 catch 에 «말» 또는 «까닭» — catch 가 있는 줄 · 그 위 3줄 · 그 아래 1줄(본문 첫 줄) 안에
 *      console.  ·  「조용한 까닭」  ·  「말한다」(호출부가 reason 으로 말하는 갈래) 중 하나
 *   ㉢ 사건(emit)은 tests/unit/collab-notify-classes.test.mjs 가 센다(emit 종류 == notify 분류 칸)
 * 범위 = js/collab/*.js · main/collab/*.js (정의 자리에서 파일 목록을 읽는다 — 새 파일이 생기면 자동으로 든다).
 * ⚠️못 보는 꼴: catch 없이 `if (!r.ok) return;` 하고 끝나는 «조용한 return» — 그건 이 자가 못 센다. 그 꼴은
 *   2026-10-06 명부(SPEC-collab-next.md · A~E 23줄)를 사람이 읽어 분류했다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../');
const FILES = ['js/collab', 'main/collab'].flatMap(d =>
  fs.readdirSync(path.join(REPO, d)).filter(f => f.endsWith('.js')).map(f => `${d}/${f}`));

test('Z0 — 전제: 협업 파일을 «읽었다»(0개면 0건 초록)', () => {
  assert.ok(FILES.length >= 7, `파일이 너무 적다: ${FILES.join(',')}`);
  const catches = FILES.reduce((n, f) => n + (readSrc(REPO, f).match(/\bcatch\b/g) || []).length, 0);
  assert.ok(catches >= 15, `catch 를 너무 적게 읽었다(${catches})`);
});

test('Z1 — 빈 catch 0건', () => {
  const hits = [];
  for (const f of FILES) {
    readSrc(REPO, f).split('\n').forEach((l, i) => {
      if (/catch\s*(\([^)]*\))?\s*\{\s*\}/.test(l) || /\.catch\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/.test(l)) hits.push(`${f}:${i + 1}`);
    });
  }
  assert.deepEqual(hits, [], `빈 catch: ${hits.join(' · ')}`);
});

test('Z2 — 모든 catch 에 «말»(console) 또는 «까닭» 주석이 있다', () => {
  const bad = [];
  for (const f of FILES) {
    const L = readSrc(REPO, f).split('\n');
    L.forEach((l, i) => {
      if (!/\bcatch\b/.test(l) || /^\s*(\*|\/\/)/.test(l)) return;   // 주석 줄 속 「catch」 낱말은 뺀다
      const win = L.slice(Math.max(0, i - 3), i + 2).join('\n');
      if (!/console\.|조용한 까닭|말한다/.test(win)) bad.push(`${f}:${i + 1}`);
    });
  }
  assert.deepEqual(bad, [], `말도 까닭도 없는 catch: ${bad.join(' · ')}`);
});
