/* logo-collab-model.test.mjs — 1013t2A2 로고 «콜라보» [로고1 × 로고2 (× 로고3)] 순수 모델 (js/blocks/logo-collab-model.js)
 * 현빈 원문: 「logo 블럭 : 우측패널에 옵션을 하나 추가… 콜라보 옵션인데 로고갯수를 별모양 블럭처럼 추가할 수 있게…
 *            로고1과 2 사이에 ‘x’를 넣어서 [ 로고1 X 로고2 ] 구조로… 로고 갯수를 3개까지 늘릴 수 있어.」
 * 이 파일이 재는 것 = 갯수 막기 · 기하(폭·칸·× 자리) · CSS 폴백과 상수의 «한 수» · 배선 잔존(소스).
 * 화면·저장 왕복·Figma 는 tests/dom/logo-collab.dom.spec.js (LC1~LC9).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire as _cr } from 'node:module';
const { mkTmpRoot } = _cr(import.meta.url)('./_tmproot.js');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const M = await (async () => {
  const tmp = mkTmpRoot('gd-logo-collab-');
  fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
  fs.copyFileSync(path.join(ROOT, 'js/blocks/logo-collab-model.js'), path.join(tmp, 'logo-collab-model.js'));
  return import(pathToFileURL(path.join(tmp, 'logo-collab-model.js')).href);
})();

test('LM1 갯수 막기 — 1~3 · 숫자 아니면 1(꺼짐)', () => {
  assert.equal(typeof M.clampCollabCount, 'function', '전제 — 모듈이 실렸다');
  assert.equal(M.COLLAB_MIN, 1);
  assert.equal(M.COLLAB_MAX, 3, '★원문 「로고 갯수를 3개까지」');
  const cases = [[0, 1], [1, 1], [2, 2], [3, 3], [4, 3], ['abc', 1], ['2', 2], [undefined, 1], [2.4, 2]];
  for (const [inp, want] of cases) assert.equal(M.clampCollabCount(inp), want, `clampCollabCount(${String(inp)})`);
});

test('LM2 기하 — W = n·S + (n−1)(2·gap + x) · 칸·× 자리 · n=1 이면 옛 폭', () => {
  const g2 = M.collabGeometry(200, 2, 16, 32);
  assert.equal(g2.width, 464);
  assert.deepEqual(g2.slots, [0, 264]);
  assert.deepEqual(g2.xs, [216]);
  const g3 = M.collabGeometry(200, 3, 16, 32);
  assert.equal(g3.width, 728);
  assert.deepEqual(g3.slots, [0, 264, 528]);
  assert.deepEqual(g3.xs, [216, 480]);
  const g1 = M.collabGeometry(200, 1, 16, 32);
  assert.equal(g1.width, 200, '★꺼짐 = 칸 하나 = 옛 폭');
  assert.deepEqual(g1.xs, []);
  // × 는 칸1 오른쪽 끝에서 gap 뒤, 칸2 는 × 오른쪽 끝에서 gap 뒤
  assert.equal(g2.xs[0], 200 + 16);
  assert.equal(g2.slots[1], g2.xs[0] + 32 + 16);
  assert.equal(M.collabXSizeDefault(64), 32, '× 기본 = 칸 높이의 절반');
});

test('LM3 CSS 폴백 --collab-gap 의 px 와 COLLAB_GAP_DEFAULT 는 한 수다 (명부 둘 방지)', () => {
  const css = read('css/editor-layout.css');
  const hits = [...css.matchAll(/var\(--collab-gap,\s*(\d+)px\)/g)].map(m => Number(m[1]));
  assert.ok(hits.length >= 2, `전제 — CSS 에 --collab-gap 폴백이 있다(gap·padding-left) · 찾은 수 ${hits.length}`);
  for (const v of hits) assert.equal(v, M.COLLAB_GAP_DEFAULT, 'CSS 폴백 ≠ JS 상수');
  assert.match(css, /\.asset-block\[data-collab\]\s*>\s*\.asset-img-clip\s*\{[^}]*width:\s*var\(--collab-slot-w\)/,
    '★칸1(.asset-img-clip)을 한 칸 폭으로 좁히는 규칙이 없다');
});

test('LM4 배선 잔존 — 패널 갯수 칸 · innerHTML 재작성 3자리 보존 · Figma 갈래 · 내보내기 HTML 제외', () => {
  const pa = read('js/props/prop-asset.js');
  assert.match(pa, /from '\.\.\/blocks\/logo-collab\.js'/, 'prop-asset 가 logo-collab 를 안 불러온다');
  assert.match(pa, /id="asset-collab-count-slider" min="\$\{COLLAB_MIN\}" max="\$\{COLLAB_MAX\}"/, '갯수 slider 의 min/max 가 모델 상수가 아니다');
  assert.match(pa, /id="asset-collab-count-num"/);
  const ih = read('js/image-handling.js');
  /* ★줄 머리에서만 센다 — 주석 처리한 호출(// restoreAssetCollab…)을 «있다»로 세면 빠진 자리를 못 본다(음성대조에서 실제로 놓쳤다). */
  const cap = (ih.match(/^\s*const \w+ = captureAssetCollab\(ab\);/gm) || []).length;
  const res = (ih.match(/^\s*restoreAssetCollab\(ab,\s*\w+\);/gm) || []).length;
  const rewrites = (ih.match(/^\s*ab\.innerHTML = `/gm) || []).length;
  assert.equal(rewrites, 3, `전제 — ab.innerHTML 재작성 자리 수(영상·그림·지우기) · 셈 ${rewrites}`);
  assert.equal(cap, rewrites, `★capture 수 ${cap} ≠ 재작성 수 ${rewrites} — 빠진 자리에서 ×·로고2·3 이 사라진다`);
  assert.equal(res, rewrites, `★restore 수 ${res} ≠ 재작성 수 ${rewrites}`);
  const fj = read('js/io/export-figma-json.js');
  assert.match(fj, /el\.dataset\.collab \? _assetCollabFigmaFrame\(el, _assetOut\) : _assetOut/, 'Figma export 콜라보 갈래가 없다');
  const eh = read('js/io/export-html.js');
  assert.match(eh, /\.asset-block\.has-image img:not\(\.asset-img\):not\(\.asset-collab-img\)\{/, '내보내기 HTML 폴백이 콜라보 칸 img 를 덮는다');
  const ins = read('js/inspector.js');
  assert.match(ins, /function logoBlocksOf[\s\S]{0,400}!!ab\.dataset\.collab/, 'inspector 로고 판정에 data-collab 이 없다');
});
