/* svg-icon-idprefix-dropped.test.mjs — VISUAL-9-SVG-ICON-ID-TEXT-01(현빈 261119 · 0.9.13 144행 · AUDIT-visual-svg #9)
 * 증상: ① 사용자 SVG 라이브러리 미리보기·아이콘 블럭·아이콘 스티커가 세척 때 id 접두사를 안 붙여 피그마 SVG 의 «clip0» 가 겹침
 *        → 둘째 아이콘이 첫째의 clipPath 로 잘림. ② 글자(<text>) 든 SVG 는 세척에서 글자가 조용히 사라짐(알림 없음).
 * 고침: 세척기의 기존 옵션(idPrefix · dropped — 마킹 블럭·벡터 블럭이 쓰는 것)을 세 길에 넘김.
 *   미리보기 = 칸마다(icnp<칸번호>-) · 아이콘 블럭 적용 = 블럭 id(icn-<id>-) · 아이콘 스티커 = 블럭 id(stk-<id>-, id 든 svg 만).
 *   버린 태그 = 미리보기 칸 툴팁 + 적용 때 토스트. ⛔허용 목록(SVG_ALLOWED_TAGS · 보안 경계)은 안 넓힘.
 * 자 ⑴ = 세 부르는 자리의 원문(옵션을 넘기나) · 자 ⑵ = 실제 세척기로 «같은 clip0 둘»이 접두사로 갈리고 제 것을 가리키나 · text 가 dropped 에 잡히나.
 * 양성대조 = 미리보기·적용의 옵션을 빼면 빨강(_patches/visual5-144-CTL-no-prefix.patch).
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
const read = (f) => fs.readFileSync(path.join(REPO, f), 'utf8');
const src = readSrc(REPO, 'js/util/sanitize-svg.js');
const names = [...src.matchAll(/export\s+(?:const|function)\s+([A-Za-z0-9_$]+)/g)].map((m) => m[1]);
const { sanitizeSvgString: clean, SVG_ALLOWED_TAGS } = new Function(src.replace(/\bexport\s+/g, '') + `\n;return { ${names.join(', ')} };`)();

test('144 ⑴ 아이콘 라이브러리 미리보기·적용 = idPrefix + dropped', () => {
  const s = read('js/props/prop-iconify.js');
  const calls = [...s.matchAll(/sanitizeSvgString\(res\.svg([^)]*)\)/g)].map((m) => m[1]);
  assert.equal(calls.length, 2, '[전제] 미리보기·적용 두 자리');
  for (const c of calls) {
    assert.match(c, /idPrefix\s*:/, `idPrefix 넘김: ${c}`);
    assert.match(c, /\bdropped\b/, `dropped 넘김: ${c}`);
  }
  assert.match(calls[0], /idPrefix:\s*`icnp\$\{idx\}-`/, '미리보기 = 칸마다 다른 접두사');
  assert.match(calls[1], /icn-\$\{bid\}-/, '적용 = 블럭 id 접두사');
  assert.match(s, /if \(dropped\.length\) window\.showToast\?\.\(/, '적용 때 버린 태그 토스트');
});

test('144 ⑴ 아이콘 스티커 그리기 = 블럭 id 접두사', () => {
  const s = read('js/blocks/sticker-block.js');
  assert.match(s, /sanitizeIconMarkup\(iconSvg, _sbid \? \{ idPrefix: `stk-\$\{_sbid\}-` \} : undefined\)/);
});

const FIG = (w) => `<svg viewBox="0 0 24 24"><g clip-path="url(#clip0)"><rect width="${w}" height="24"/></g><defs><clipPath id="clip0"><rect width="${w}" height="24"/></clipPath></defs></svg>`;

test('144 ⑵ 같은 clip0 두 svg — 접두사로 갈리고 각자 제 틀을 가리킨다', () => {
  const a = clean(FIG(12), { idPrefix: 'icnp0-' }), b = clean(FIG(24), { idPrefix: 'icnp1-' });
  const ids = (s) => [...s.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const refs = (s) => [...s.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]);
  assert.deepEqual(ids(a), ['icnp0-clip0']); assert.deepEqual(refs(a), ['icnp0-clip0']);
  assert.deepEqual(ids(b), ['icnp1-clip0']); assert.deepEqual(refs(b), ['icnp1-clip0']);
});

test('144 ⑵ 글자 든 svg — text 가 dropped 에 잡힌다 · 허용 목록은 그대로', () => {
  const dropped = [];
  clean('<svg viewBox="0 0 10 10"><rect width="10" height="10"/><text x="1" y="8">AB</text></svg>', { dropped });
  assert.deepEqual(dropped, ['text']);
  assert.equal(SVG_ALLOWED_TAGS.includes('text'), false, '⛔허용 목록 안 넓힘(보안 경계)');
});
