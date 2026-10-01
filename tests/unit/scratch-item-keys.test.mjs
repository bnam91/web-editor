/* scratch-item-keys.test.mjs — 스크래치 항목 «칸 목록»은 한 곳(SCRATCH_ITEM_KEYS)에서만 (2026-10-01 C1)
 * 무엇이 문제였나: 같은 칸 목록이 일곱 자리에 손으로 따로 적혀 있었다. 칸(fx)을 더하려면 일곱 곳을 다 고쳐야 했고,
 *   하나라도 빠지면 «그 길로만» 효과가 조용히 사라진다. ⇒ 목록 하나 + _pickScratch 파생으로 합쳤다.
 * ★양성대조 판 = 7699ea33 → K1 K2 빨강(목록·fx 가 없다).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.GD1001_ROOT || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'js/scratch-pad.js'), 'utf8');

test('K1 ★칸 목록이 한 곳에 있고 fx 를 담는다', () => {
  const m = SRC.match(/const SCRATCH_ITEM_KEYS\s*=\s*\[([^\]]*)\]/);
  assert.ok(m, 'SCRATCH_ITEM_KEYS 가 없다');
  const keys = [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
  for (const k of ['src', 'x', 'y', 'w', 'id', 'g', 'linkDy', 'fx']) assert.ok(keys.includes(k), `칸 «${k}» 가 목록에 없다`);
});

test('K2 ★저장·전환·매니페스트·가져오기·삭제복원이 «손 목록» 대신 _pickScratch 로 파생된다', () => {
  // 손으로 적은 «객체 리터럴 목록» 꼴: ({ src, x, y, w, id, g ...}) => ({ src, x, ... }) 또는 { id: it.id, src, x: it.x ...}
  const handLists = [
    ...SRC.matchAll(/=>\s*\(\{\s*src\s*,\s*x\s*,\s*y\s*,\s*w\s*,\s*id/g),
    ...SRC.matchAll(/\{\s*src:\s*\w+\.src,\s*x:\s*\w+\.x/g),
    ...SRC.matchAll(/\{\s*id:\s*it\.id,\s*src,\s*x:\s*it\.x/g),
  ];
  assert.deepEqual(handLists.map(h => h[0]), [], '칸 목록을 손으로 다시 적은 자리가 생겼다 — _pickScratch 를 써라');
  const uses = (SRC.match(/_pickScratch\(/g) || []).length;
  assert.ok(uses >= 7, `_pickScratch 를 부르는 자리가 ${uses}개뿐 — 정의 1 + 파생 6 이상이어야 한다`);
});
