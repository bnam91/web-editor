/* Figma 빌더 — 섹션 배경 그림을 «style 이 비면 data-bg-img 에서» 읽는다(245) · 섹션 아래 여백·바닥을 싣는다(186)
 *
 * 까닭(S5 261029 · 앱 ×3): 245 가 저장(serializeCleanRoot)에서 섹션 style 의 같은 url() 을 뺐다(정본 = data-bg-img).
 *   Figma 빌더는 flushCurrentPage → page.canvas(저장 문자열)를 읽어 :1437 에서 style 만 봤다 ⇒ 무거운 7 섹션 bgImage 7 → 0(E1).
 *   186 — 빌더 섹션 칸에 paddingBottom·minHeight 가 없어 Figma 에서 섹션 아래 빈 공간이 사라졌다(v0.9.8 에도).
 * 자: js/io/export-figma-json.js 의 _sectionBgImgRaw · _sectionBox 를 _slice-block 으로 잘라 가짜 섹션으로 «실행»(모양 말고 행동) +
 *   _section 이 둘을 실제로 부르는지(구조). GD1001_ROOT 로 다른 판을 읽힌다(양성대조). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { sliceBlock } = require('./_slice-block.js');
const { stripComments } = require('./_strip-comments.js');

const ROOT = process.env.GD1001_ROOT || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const EXP = fs.readFileSync(path.join(ROOT, 'js/io/export-figma-json.js'), 'utf8');
const fn = (head, name) => new Function(`${sliceBlock(EXP, head)}; return ${name};`)();

/** 가짜 섹션 — style 은 인라인 longhand · dataset · 레이어(있으면) */
function sec({ style = {}, attr = '', ds = {}, layer = '' } = {}) {
  const lay = layer ? { style: { backgroundImage: layer } } : null;
  return { style: { backgroundImage: '', paddingBottom: '', minHeight: '', ...style }, dataset: { ...ds }, getAttribute: (k) => (k === 'style' ? attr : null),
    querySelector: (s) => (/sec-bg-img/.test(s) ? lay : null) };
}

test('F1 style 이 비고 data-bg-img 가 있으면 그 속성을 url() 로 읽는다(245 · 고치기 전엔 이 함수가 없다)', () => {
  const raw = fn('function _sectionBgImgRaw(', '_sectionBgImgRaw');
  assert.equal(raw(sec({ ds: { bgImg: 'data:image/png;base64,AAA' } })), 'url("data:image/png;base64,AAA")');
});
test('F2 읽는 차례 — 레이어 > 인라인 style > style 속성 글자 > data-bg-img · 아무것도 없으면 빈 값', () => {
  const raw = fn('function _sectionBgImgRaw(', '_sectionBgImgRaw');
  const A = 'data:image/png;base64,A', B = 'data:image/png;base64,B';
  assert.deepEqual([
    raw(sec({ layer: `url("${A}")`, style: { backgroundImage: 'none' }, ds: { bgImg: B } })),
    raw(sec({ style: { backgroundImage: `url("${A}")` }, ds: { bgImg: B } })),
    raw(sec({ attr: 'background-image: url("goya-asset://p/a.png"); color: red', ds: { bgImg: B } })),   // ⚠️style 속성 글자 갈래의 정규식 ([^;]+) 은 data URI 의 «;base64» 에서 끊긴다 — 옛 흠(이 고침 밖 · 따로 올림) ⇒ 여기선 ; 없는 URL
    raw(sec({ style: { backgroundImage: 'none' }, ds: { bgImg: B } })),
    raw(sec({})),
  ], [`url("${A}")`, `url("${A}")`, 'url("goya-asset://p/a.png")', `url("${B}")`, '']);
});
test('F3 186 — 섹션 아래 여백·바닥을 싣는다(없으면 0)', () => {
  const box = fn('function _sectionBox(', '_sectionBox');
  assert.deepEqual([box(sec({ style: { paddingBottom: '48px', minHeight: '900px' } })), box(sec({}))], [{ paddingBottom: 48, minHeight: 900 }, { paddingBottom: 0, minHeight: 0 }]);
});
test('F4 빌더 _section 이 두 함수를 «실제로» 쓴다(구조 — 함수만 있고 안 부르면 빨강)', () => {
  const body = stripComments(sliceBlock(EXP, '  function _section(secEl, ps) {'));
  assert.match(body, /const\s+bgImgRaw\s*=\s*_sectionBgImgRaw\(secEl\)/, '_section 의 배경 원문 = _sectionBgImgRaw(secEl)');
  assert.match(body, /return\s*\{[^}]*\.\.\._sectionBox\(secEl\)/, '_section 의 반환 칸에 ..._sectionBox(secEl)');
});
