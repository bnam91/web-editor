// text-gradient-solid-writers.test.mjs — 0918r2 textgrad 위험④ 방지 감시.
// 글자 그라데이션은 contentEl 인라인(background-clip:text + text-fill:transparent)이라,
// 누가 contentEl.style.color 에 «단색만» 넣으면 그라데이션이 그 단색을 가린다(단색이 안 먹는 것처럼 보인다).
// ⇒ js/ 전역에서 글자 contentEl 에 color 를 대입하는 줄을 «기계가» 전수로 뽑아,
//   그 앞 12줄 안에 clearTextGradient 호출이 있거나 `textgrad-ok:` 사유 주석이 있어야 통과.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
function walk(d, out = []) {
  for (const n of readdirSync(d)) {
    const p = path.join(d, n);
    if (n === 'vendor' || n === 'node_modules') continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.m?js$/.test(n)) out.push(p);
  }
  return out;
}
const WRITER = /\b(?:ctx\.)?contentEl\.style\.color\s*=(?!=)|\bhost\.style\.color\s*=(?!=)/;

test('글자 contentEl 에 단색을 쓰는 모든 줄은 clearTextGradient 를 먼저 부르거나 사유(textgrad-ok)를 적는다', () => {
  const hits = [], bad = [];
  for (const f of walk(path.join(REPO, 'js'))) {
    const lines = readFileSync(f, 'utf8').split('\n');
    lines.forEach((ln, i) => {
      if (!WRITER.test(ln) || /^\s*(\/\/|\*)/.test(ln)) return;
      // 빈 문자열 대입(= 인라인 색 지우기)은 단색 쓰기가 아니다 — 가릴 단색이 없다
      if (/style\.color\s*=\s*(''|"")\s*;/.test(ln)) return;
      hits.push(`${path.relative(REPO, f)}:${i + 1}`);
      const ctx = lines.slice(Math.max(0, i - 12), i + 1).join('\n');
      if (!/clearTextGradient|textgrad-ok:/.test(ctx)) bad.push(`${path.relative(REPO, f)}:${i + 1}  ${ln.trim()}`);
    });
  }
  // 앞끝 양성대조: 감시가 실제로 줄을 잡고 있다(0이면 정규식이 죽은 것)
  assert.ok(hits.length >= 5, `감시 대상이 너무 적다(${hits.length}) — 정규식이 죽었나`);
  assert.deepEqual(bad, [], '그라데이션을 안 풀고 단색을 쓰는 경로:\n' + bad.join('\n'));
});
