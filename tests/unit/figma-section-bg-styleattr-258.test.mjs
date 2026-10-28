/* 258 — Figma 빌더 _sectionBgImgRaw 의 «style 속성 글자» 갈래가 data URI 를 «;base64» 에서 끊나(옛 흠)
 *   그 갈래만 남긴다: 레이어 없음 · 인라인 style.backgroundImage 빈 값 · data-bg-img 없음(뒤 갈래가 가리지 못하게).
 *   한 쌍(S5): 지금 판(2bf5aa2c) 빨강 · 정규식만 고친 사본 초록 — GD1001_ROOT 로 읽힌다. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { sliceBlock } = require('./_slice-block.js');
const ROOT = process.env.GD1001_ROOT || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const EXP = fs.readFileSync(path.join(ROOT, 'js/io/export-figma-json.js'), 'utf8');
const raw = new Function(`${sliceBlock(EXP, 'function _sectionBgImgRaw(')}; return _sectionBgImgRaw;`)();
const sec = (attr) => ({ style: { backgroundImage: '' }, dataset: {}, getAttribute: (k) => (k === 'style' ? attr : null), querySelector: () => null });

test('T0 갈래만 남았다(전제) — ; 없는 URL 은 지금도 온전', () => {
  assert.equal(raw(sec('background-image: url("goya-asset://p/a.png"); color: red')), 'url("goya-asset://p/a.png")');
});
test('T1 style 속성 글자의 data URI 를 «;base64» 에서 안 끊는다(258)', () => {
  const U = 'data:image/png;base64,iVBORw0KGgo=';
  assert.equal(raw(sec(`background-image: url("${U}"); background-size: cover;`)), `url("${U}")`);
});
