/* 0919r3 textshadow — text-shadow 목록 → drop-shadow 체인 순수 변환 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// package.json "type":"commonjs" 라 .js 를 직접 import 하면 CJS 로 잡힌다 → 원문을 임시 .mjs 로 복사해 로드.
const SRC = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'js', 'props', 'text-shadow-filter.js'), 'utf8');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tsf-'));
const MOD = path.join(TMP, 'text-shadow-filter.mjs');
fs.writeFileSync(MOD, SRC);
const { splitShadowList, parseShadowItem, textShadowToDropShadowFilter, DROP_SHADOW_BLUR_FACTOR, parseShadowList, shadowFilterId, svgShadowFilterMarkup } = await import(pathToFileURL(MOD).href);
fs.rmSync(TMP, { recursive: true, force: true });

test('blur 계수 = 0.5 (크로미움 실측으로 확정한 값)', () => {
  assert.equal(DROP_SHADOW_BLUR_FACTOR, 0.5);
});

test('rgba 안 쉼표는 자르지 않는다', () => {
  assert.deepEqual(splitShadowList('rgba(0, 0, 0, 0.5) 2px 2px 4px, rgb(255, 0, 0) 0px 0px 1px'),
    ['rgba(0, 0, 0, 0.5) 2px 2px 4px', 'rgb(255, 0, 0) 0px 0px 1px']);
});

test('색 위치 무관 — computed(색 앞)·인라인(색 뒤)', () => {
  assert.deepEqual(parseShadowItem('rgba(0, 0, 0, 0.5) 2px 3px 4px'), { x: 2, y: 3, blur: 4, color: 'rgba(0, 0, 0, 0.5)' });
  assert.deepEqual(parseShadowItem('2px 3px 4px #000'), { x: 2, y: 3, blur: 4, color: '#000' });
  assert.deepEqual(parseShadowItem('-1.4px 0px rgb(1, 2, 3)'), { x: -1.4, y: 0, blur: 0, color: 'rgb(1, 2, 3)' });
  assert.equal(parseShadowItem('none'), null);
  assert.equal(parseShadowItem('2px'), null);
});

test('한 겹: blur × 0.5, 색 보존', () => {
  assert.equal(textShadowToDropShadowFilter('rgba(0, 0, 0, 0.5) 2px 2px 4px'),
    'drop-shadow(2px 2px 2px rgba(0, 0, 0, 0.5))');
});

test('여러 겹: 역순 (text-shadow 첫 항목 = 맨 위 = 체인 마지막)', () => {
  const f = textShadowToDropShadowFilter('rgb(255, 255, 255) 0px 0px 1.4px, rgb(255, 45, 110) 0px 0px 4.2px, rgba(0, 255, 255, 0.6) 0.7px 0px 0.7px');
  assert.equal(f, 'drop-shadow(0.7px 0px 0.35px rgba(0, 255, 255, 0.6)) drop-shadow(0px 0px 2.1px rgb(255, 45, 110)) drop-shadow(0px 0px 0.7px rgb(255, 255, 255))');
});

test('없음·빈값·해석 불가 → 빈 문자열(= 파생값 안 붙임)', () => {
  assert.equal(textShadowToDropShadowFilter('none'), '');
  assert.equal(textShadowToDropShadowFilter(''), '');
  assert.equal(textShadowToDropShadowFilter(undefined), '');
  assert.equal(textShadowToDropShadowFilter('rgb(0,0,0) 1px 1px 1px, garbage words here'), '');
});

test('여러 겹 SVG 필터: 겹마다 SourceAlpha 에서 따로(누적 없음) · 맨 아래 겹부터 merge · 마지막 = SourceGraphic', () => {
  const ts = 'rgb(255, 255, 255) 0px 0px 2px, rgba(0, 51, 255, 0.5) 3px -4px 20px';
  const items = parseShadowList(ts);
  assert.equal(items.length, 2);
  const id = shadowFilterId(ts);
  assert.match(id, /^tgs-f-[0-9a-z]+$/);
  assert.equal(shadowFilterId(ts), id, '같은 목록 = 같은 id');
  assert.notEqual(shadowFilterId(ts + ' '), id);
  const m = svgShadowFilterMarkup(id, items);
  assert.equal((m.match(/in="SourceAlpha"/g) || []).length, 2, '겹마다 원본 알파에서 — 앞 그림자를 다시 그림자 내지 않는다');
  // 역순: s0 = 목록 마지막(파랑, 맨 아래), s1 = 목록 첫(흰색, 맨 위)
  assert.match(m, /stdDeviation="10" result="b0"\/><feOffset in="b0" dx="3" dy="-4"[^>]*\/><feFlood flood-color="rgba\(0, 51, 255, 0.5\)"/);
  assert.match(m, /stdDeviation="1" result="b1"\/><feOffset in="b1" dx="0" dy="0"[^>]*\/><feFlood flood-color="rgb\(255, 255, 255\)"/);
  assert.match(m, /<feMerge><feMergeNode in="s0"\/><feMergeNode in="s1"\/><feMergeNode in="SourceGraphic"\/><\/feMerge>/);
  // 영역: 퍼짐(4 + 3σ + 4 = 38)만큼 왼쪽·위 여유
  assert.match(m, /filterUnits="userSpaceOnUse" x="-38" y="-38"/);
  assert.equal(parseShadowList('none'), null);
  assert.equal(svgShadowFilterMarkup('x', []), '');
});

test('배선: CSS .tgs 규칙 · 쓰기 경로 sync 호출 · Figma 원본 목록 · h2c 걷기 · showShadowBehindNode', () => {
  const src = (p) => fs.readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
  assert.match(src('css/editor-blocks.css'), /\.tgs\s*\{[^}]*text-shadow:\s*none\s*!important;[^}]*filter:\s*var\(--tgs-filter\)\s*!important;/);
  assert.match(src('js/props/prop-text-wireup-shadow.js'), /syncTextGradShadow\?\.\(el\)/);
  const tfx = src('js/text-effect-transform.js');
  assert.equal((tfx.match(/syncTextGradShadow\?\.\(textEl\)/g) || []).length, 2, 'applyTextEffect·clearTextEffect 둘 다 sync');
  assert.match(src('js/io/export-figma-json.js'), /textShadowSource\(_li\)/);
  assert.match(src('js/io/capture-safety.js'), /classList\.remove\('tgs'\)/);
  assert.match(src('figma-renderer/sangpe_to_figma.mjs'), /showShadowBehindNode: false/);
  assert.match(src('figma-plugin/code.js'), /fx\.showShadowBehindNode = effect\.showShadowBehindNode/);
});
