// R5(현빈 261123) — 이미지 편집 모드 «높이» 칸(늘 disabled)을 안 그린다. 편집 모드 진입이 무거워 소스로 잰다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../../js/image-handling.js', import.meta.url), 'utf8');
test('R5 이미지 편집 «높이» 칸 없음(두 편집 모드)', () => {
  assert.equal(/id="img-h"/.test(src), false, 'img-h 칸이 다시 생겼다');
  assert.equal(/id="icb-img-h"/.test(src), false, 'icb-img-h 칸이 다시 생겼다');
  assert.match(src, /id="img-w"/, '전제: 너비 칸은 있다');
  assert.match(src, /id="icb-img-w"/, '전제: 너비 칸은 있다');
});
