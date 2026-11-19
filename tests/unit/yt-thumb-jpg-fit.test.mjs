/* yt-thumb-jpg-fit.test.mjs — t13C-04 ④ 유튜브 썸네일 JPG 2MB 지킴 · 순수 함수 fitUnderBytes (js/io/jpg-fit.js) + 배선 (261119 · 태양)
 *   가짜 encode(q → {size}) 로 잰다 — 캔버스·DOM 0.
 *   F1 3MB→…→1.9MB 에서 멈춘다(그 품질 · 그 횟수) · F2 한도 안이면 첫 품질 그대로(재인코딩 0) · F3 끝까지 넘으면 over · F4 encode null 은 그대로
 *   W1 배선 — export-image.js 의 1280·JPG 길만 fitUnderBytes(encode, YT_JPG_LIMIT) 를 부르고, 다른 길은 0.95 그대로
 * ★양성대조: _patches/yt-thumb-4-fit.patch (멈춤 조건을 걷어 늘 끝까지 내림) ⇒ F1·F2 빨강.
 * 실행: node --test tests/unit/yt-thumb-jpg-fit.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkTmpRoot } from './_tmproot.js';
const { stripComments } = createRequire(import.meta.url)('./_strip-comments.js');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
/* package.json 이 commonjs 라 tmp .mjs 사본으로 싣는다(export-formats-single-roster 와 같은 수법) — 내용은 바이트 그대로 */
const _tmp = path.join(mkTmpRoot('jpg-fit-'), 'jpg-fit.mjs');
fs.writeFileSync(_tmp, read('js/io/jpg-fit.js'));
const { fitUnderBytes, YT_JPG_LIMIT, JPG_QUALITY_STEPS } = await import(pathToFileURL(_tmp).href);

/** 품질 → 크기 표(가짜) · 부른 품질을 적는다 */
const fake = (table) => { const asked = []; return { asked, encode: async (q) => { asked.push(q); return table[q] == null ? null : { size: table[q] }; } }; };

test('F0 한도 = 2,000,000 · 첫 품질 0.95(옛 고정값) · 내려가는 차례', () => {
  assert.equal(YT_JPG_LIMIT, 2000000);
  assert.equal(JPG_QUALITY_STEPS[0], 0.95);
  for (let i = 1; i < JPG_QUALITY_STEPS.length; i++) assert.ok(JPG_QUALITY_STEPS[i] < JPG_QUALITY_STEPS[i - 1], '품질이 내려가지 않는다');
});

test('F1 3MB → 2.4MB → 1.9MB 에서 멈춘다', async () => {
  const f = fake({ 0.95: 3000000, 0.9: 2400000, 0.85: 1900000, 0.8: 1500000 });
  const r = await fitUnderBytes(f.encode, YT_JPG_LIMIT);
  assert.deepEqual(f.asked, [0.95, 0.9, 0.85], '한도 안이 나온 뒤에도 더 구웠다');
  assert.equal(r.quality, 0.85);
  assert.equal(r.blob.size, 1900000);
  assert.equal(r.tries, 3);
  assert.equal(r.over, false);
});

test('F2 한도 안이면 첫 품질 그대로 — 재인코딩 0', async () => {
  const f = fake({ 0.95: 800000, 0.9: 600000 });
  const r = await fitUnderBytes(f.encode, YT_JPG_LIMIT);
  assert.deepEqual(f.asked, [0.95]);
  assert.equal(r.quality, 0.95);
  assert.equal(r.over, false);
  /* 경계 — 딱 한도면 안이다 */
  const g = fake({ 0.95: YT_JPG_LIMIT });
  assert.equal((await fitUnderBytes(g.encode, YT_JPG_LIMIT)).over, false);
  assert.deepEqual(g.asked, [0.95]);
});

test('F3 끝까지 넘으면 마지막 것 + over', async () => {
  const table = Object.fromEntries(JPG_QUALITY_STEPS.map((q) => [q, 2500000]));
  const f = fake(table);
  const r = await fitUnderBytes(f.encode, YT_JPG_LIMIT);
  assert.deepEqual(f.asked, [...JPG_QUALITY_STEPS]);
  assert.equal(r.over, true);
  assert.equal(r.quality, JPG_QUALITY_STEPS.at(-1));
  assert.equal(r.blob.size, 2500000);
});

test('F4 encode 가 null(toBlob 실패) — 그대로 돌려주고 더 안 구운다', async () => {
  const f = fake({});
  const r = await fitUnderBytes(f.encode, YT_JPG_LIMIT);
  assert.equal(r.blob, null);
  assert.deepEqual(f.asked, [0.95]);
});

test('W1 배선 — 1280·JPG 길만 fitUnderBytes · 다른 길은 0.95 그대로', () => {
  const s = stripComments(read('js/io/export-image.js'));
  assert.match(s, /import \{ fitUnderBytes, YT_JPG_LIMIT \} from '\.\/jpg-fit\.js'/);
  const i = s.indexOf('fitUnderBytes(encode, YT_JPG_LIMIT)');
  assert.ok(i > 0, '1280·JPG 길이 fitUnderBytes 를 안 부른다');
  const head = s.slice(Math.max(0, i - 200), i);
  assert.match(head, /if \(w === YT_THUMB_W && mime === 'image\/jpeg'\)/, '부르는 조건이 1280·JPG 가 아니다');
  assert.match(s, /blob = await encode\(0\.95\)/, '다른 길의 0.95 고정이 사라졌다');
  assert.equal((s.match(/fitUnderBytes\(/g) || []).length, 1, 'fitUnderBytes 를 부르는 자리가 하나가 아니다');
});
