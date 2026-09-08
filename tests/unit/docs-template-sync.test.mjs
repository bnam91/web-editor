/* docs/TEMPLATE_SYSTEM.md 가 «가리키는 사실»이 실재하는지 회귀로 붙잡는다.
 *
 * ★왜 테스트로도 두나 — 문서는 «고쳐놓으면 다시 낡는다». 고친 순간만 맞고 다음 리팩터에
 *   또 어긋나면 고친 의미가 없다. 검사가 아니라 «구조»로 닫으려면 회귀가 물고 있어야 한다.
 *
 * 실제 판정은 tools/docs-sync-check.mjs 하나가 한다(세는 명령과 «같은 것»을 쓴다) —
 * 두 곳에 판정 로직을 두면 둘이 갈린다.
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('docs/TEMPLATE_SYSTEM.md — 적힌 경로·API·type 이 코드에 실재한다', () => {
  let out = '';
  let failed = false;
  try {
    out = execFileSync('node', ['tools/docs-sync-check.mjs'], {
      cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    failed = true;
    out = String((e.stdout || '') + (e.stderr || ''));
  }
  assert.equal(
    failed, false,
    '문서가 «없는 것»을 가리킨다. 세는 명령: node tools/docs-sync-check.mjs\n' + out
  );
  assert.match(out, /불일치 0/, '판정 줄을 못 찾았다:\n' + out);
});
