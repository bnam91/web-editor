/* ai-text-slots-ssot — 「AI 채우기가 말풍선·불릿·라이너 구조를 지운다」(2026-10-03 AI 묶음 A)의 «명부» 자.
 *
 * ★지디 요구: 「이번에 만지는 명부는 넷 다 고쳤나 세는 검사」.
 *   만지는 명부 = ⑴ 렌더러 정본 js/ai-text-slots.js(TEXT_SLOT_KINDS)
 *                ⑵⑶⑷ 서비스 3벌의 STYLE_HINTS + _detectStyle(gemini·openai·anthropic — 손으로 복사된 사본)
 *   그리고 «읽기·쓰기가 같은 정본에서 파생되는가»(js/ai-section-fill.js 안에 셀렉터 명부가 두 벌로 «다시» 생기지 않는가).
 *
 * 여기서 재는 것:
 *   S1 정본 — 종류 넷(plain·bullet·bubble·liner)이 있고, 공용 셀렉터가 명부에서 파생된 그 값이다.
 *   S2 ★읽기·쓰기 단일 출처 — ai-section-fill.js 의 collectSectionTextBlocks 와 applyAIReplacements 가 «둘 다»
 *      findTextSlot 을 부르고, 글자 클래스 셀렉터 리터럴(.tb-h1/.tb-bubble/.tb-bullet/.tb-liner)이 파일에 «0»이며,
 *      래퍼로 떨어지는 `|| tb` 가 없다.
 *   S2-pin ★양성대조 — 같은 판정을 고치기 전 판(37ab1c65)의 소스에 걸면 «빨강»이어야 한다(판정기가 살아 있다).
 *   S3 ★서비스 3벌 — STYLE_HINTS·_detectStyle 이 세 파일에서 «같고», 정본의 모든 style 이 hint 키로 풀리며,
 *      bubble·bullet·liner 는 «자기 이름»의 hint 로 간다(본문 hint 로 흘러가면 불릿이 줄바꿈 없는 산문으로 온다).
 *
 * ⛔이 파일이 «못 재는 것»: 실제 DOM 에서 구조가 살아남는가 — 그건 tests/dom/ai-fill-structure.dom.spec.js(실앱 하네스).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readSrc } from './_srcread.js';
import { sliceBlock } from './_slice-block.js';
import { mkTmpRoot } from './_tmproot.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SLOTS_SRC = readSrc(ROOT, 'js', 'ai-text-slots.js');
const FILL_SRC = readSrc(ROOT, 'js', 'ai-section-fill.js');
const PIN = '37ab1c65';

/* 정본은 import 가 없는 순수 모듈이다 — package.json 이 commonjs 라 tmp .mjs 사본으로 싣는다
   (aifill-goya-asset.test.js · figma-goya.test.js 와 같은 수법). 내용은 바이트 그대로다. */
const _tmp = path.join(mkTmpRoot('ai-text-slots-'), 'ai-text-slots.mjs');
fs.writeFileSync(_tmp, SLOTS_SRC);
const slots = await import(pathToFileURL(_tmp).href);

test('S1 정본 — 종류 넷 · 공용 셀렉터는 명부에서 파생', () => {
  const kinds = slots.TEXT_SLOT_KINDS.map(k => k.kind);
  assert.deepEqual(kinds, ['plain', 'bullet', 'bubble', 'liner']);
  assert.equal(slots.TEXT_SLOT_SELECTOR, slots.TEXT_SLOT_KINDS.map(k => k.selector).join(', '));
  for (const k of slots.TEXT_SLOT_KINDS) assert.ok(k.styles.length > 0, `${k.kind} 의 style 이 비었다`);
  // 명부가 실제로 그 클래스를 고르는지(셀렉터 문자열과 style 이 서로 어긋나지 않게)
  for (const k of slots.TEXT_SLOT_KINDS) for (const st of k.styles) {
    assert.ok(k.selector.split(',').map(s => s.trim()).some(s => s.endsWith('.' + st)), `${k.kind}: style ${st} 를 셀렉터가 안 고른다`);
  }
});

/* ── S2 판정기: 소스 문자열 → 위반 목록(빈 배열 = 통과) ── */
function fnBody(src, name) {
  try { return sliceBlock(src, `function ${name}(`); } catch (_) { return null; }
}
function judgeSingleSource(src) {
  const v = [];
  const collect = fnBody(src, 'collectSectionTextBlocks');
  const apply = fnBody(src, 'applyAIReplacements');
  if (!collect || !apply) throw new Error('★판정 대상 함수를 못 찾았다 — 못 잰 검사는 통과가 아니다');
  if (!/findTextSlot\(/.test(collect)) v.push('collect 가 findTextSlot 을 안 부른다');
  if (!/findTextSlot\(/.test(apply)) v.push('apply 가 findTextSlot 을 안 부른다');
  if (!/import\s*\{[^}]*\bfindTextSlot\b[^}]*\}\s*from\s*'\.\/ai-text-slots\.js'/.test(src)) v.push('정본 모듈에서 import 하지 않는다');
  const lit = src.match(/['"`][^'"`\n]*\.tb-(?:h1|h2|h3|body|caption|label|bubble|bullet|liner)\b[^'"`\n]*['"`]/g) || [];
  if (lit.length) v.push(`글자 클래스 셀렉터 리터럴 ${lit.length}개(명부가 두 벌이 된다): ${lit.join(' | ')}`);
  if (/\)\s*\|\|\s*tb\s*;/.test(src)) v.push('래퍼 폴백 `|| tb` 가 남아 있다');
  return v;
}

test('S2 ★읽기·쓰기 단일 출처 — ai-section-fill.js 는 정본에서만 파생한다', () => {
  assert.deepEqual(judgeSingleSource(FILL_SRC), []);
});

test(`S2-pin ★양성대조 — 고치기 전 판(${PIN})엔 같은 판정이 «빨강»`, () => {
  let old;
  try {
    old = execFileSync('git', ['show', `${PIN}:js/ai-section-fill.js`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 24 });
  } catch (e) {
    assert.fail(`★기준판(${PIN}) 소스를 못 떴다 — S2 가 살아 있는지 모른다: ${e.message}`);
  }
  const v = judgeSingleSource(old.replace(/\r\n/g, '\n'));
  assert.ok(v.some(x => x.includes('리터럴')), `옛 판의 두 벌 명부를 판정기가 못 봤다: ${JSON.stringify(v)}`);
  assert.ok(v.some(x => x.includes('|| tb')), `옛 판의 래퍼 폴백을 판정기가 못 봤다: ${JSON.stringify(v)}`);
});

/* ── S3 서비스 3벌 ── */
const SERVICES = ['geminiService.js', 'openaiService.js', 'anthropicService.js'];
function loadHints(file) {
  const src = readSrc(ROOT, 'services', file);
  const hints = sliceBlock(src, 'const STYLE_HINTS = {', `${file} STYLE_HINTS`);
  const detect = sliceBlock(src, 'function _detectStyle(', `${file} _detectStyle`);
  const ctx = {};
  vm.runInNewContext(hints + ';\n' + detect + '\nthis.H = STYLE_HINTS; this.D = _detectStyle;', ctx);
  return { file, H: ctx.H, D: ctx.D };
}

test('S3 ★서비스 3벌 — STYLE_HINTS·_detectStyle 이 같고, 정본의 style 을 전부 받는다', () => {
  const all = SERVICES.map(loadHints);
  const styles = slots.TEXT_SLOT_KINDS.flatMap(k => k.styles.map(st => ({ kind: k.kind, st })));
  assert.ok(styles.length >= 9, '정본 style 이 너무 적다 — 명부를 못 읽었다');
  const ref = all[0];
  for (const s of all.slice(1)) {
    assert.deepEqual({ ...s.H }, { ...ref.H }, `${s.file} 의 STYLE_HINTS 가 ${ref.file} 와 다르다`);
    for (const { st } of styles) assert.equal(s.D({ style: st }), ref.D({ style: st }), `${s.file} _detectStyle(${st}) 가 다르다`);
  }
  for (const s of all) for (const { kind, st } of styles) {
    const key = s.D({ style: st });
    assert.ok(Object.prototype.hasOwnProperty.call(s.H, key) && s.H[key], `${s.file}: ${st} → ${key} 에 hint 가 없다`);
    if (kind !== 'plain') assert.equal(key, kind, `${s.file}: ${st} 가 «${kind}» hint 로 안 간다(→${key})`);
  }
});
