/* icon-variant — ICON-FEATHER-MATERIAL-RESEARCH-01(현빈 261121 발주2 #3) 아이콘 «선 두께 · 채움» 셈(js/blocks/icon-variant.js).
 * V1 normIconStroke — 0.25 눈금 · 0.5..4 · 빈칸/글자 = null
 * V2 applyIconStroke — 뿌리 stroke-width 있을 때만 · 멱등 · 없으면 손 안 댐
 * V4 [미카사 채점 ②] Iconify 실제 꼴(뿌리 아닌 path 에 stroke-width — Lucide·Feather 둘 다) → 선 아이콘 · 지금 두께 · 입히기
 * V3 Material Symbols 이름 — 채움↔선 · -rounded/-sharp 꼬리 보존 · 다른 모음 = null
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readSrc } from './_srcread.js';
import { mkTmpRoot } from './_tmproot.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const _tmp = path.join(mkTmpRoot('icon-variant-'), 'icon-variant.mjs');
fs.writeFileSync(_tmp, readSrc(ROOT, 'js', 'blocks', 'icon-variant.js'));
const V = await import(pathToFileURL(_tmp).href);

test('V1 normIconStroke', () => {
  for (const [v, w] of [[2, 2], [2.1, 2], [2.2, 2.25], [0.1, 0.5], [9, 4], ['3.5', 3.5]]) assert.equal(V.normIconStroke(v), w, String(v));
  for (const v of ['', null, undefined, 'x']) assert.equal(V.normIconStroke(v), null, String(v));
});

test('V2 applyIconStroke', () => {
  const mk = (attrs, ds) => { const a = { ...attrs }; const svg = { getAttribute: (k) => (k in a ? a[k] : null), setAttribute: (k, v) => { a[k] = v; } }; return { a, block: { dataset: { ...ds }, querySelector: () => svg } }; };
  const s1 = mk({ 'stroke-width': '2' }, { iconStroke: '3.5' }); assert.equal(V.applyIconStroke(s1.block), 3.5); assert.equal(s1.a['stroke-width'], '3.5');
  assert.equal(V.applyIconStroke(s1.block), 3.5, '멱등');
  const s2 = mk({}, { iconStroke: '3' }); assert.equal(V.applyIconStroke(s2.block), null); assert.equal(s2.a['stroke-width'], undefined, '선 아이콘 아니면 안 씀');
  const s3 = mk({ 'stroke-width': '2' }, {}); assert.equal(V.applyIconStroke(s3.block), null); assert.equal(s3.a['stroke-width'], '2', '값 없으면 그대로');
});

test('V3 Material Symbols 채움/선', () => {
  assert.equal(V.msFillState('material-symbols:home'), 'fill');
  assert.equal(V.msFillState('material-symbols:home-outline'), 'outline');
  assert.equal(V.msFillState('material-symbols:home-outline-rounded'), 'outline');
  assert.equal(V.msFillState('mdi:home'), null);
  assert.equal(V.msNameFor('material-symbols:home', 'outline'), 'material-symbols:home-outline');
  assert.equal(V.msNameFor('material-symbols:home-outline', 'fill'), 'material-symbols:home');
  assert.equal(V.msNameFor('material-symbols:favorite-rounded', 'outline'), 'material-symbols:favorite-outline-rounded');
  assert.equal(V.msNameFor('material-symbols:favorite-outline-sharp', 'fill'), 'material-symbols:favorite-sharp');
  assert.equal(V.msNameFor('material-symbols:arrow-back-ios', 'outline'), 'material-symbols:arrow-back-ios-outline');
  assert.equal(V.msNameFor('feather:heart', 'outline'), null);
  assert.equal(V.msNameFor('material-symbols:home', 'bold'), null);
});

test('V4 Iconify 실제 꼴 — path 의 stroke-width', () => {
  const mkEl = (attrs) => { const a = { ...attrs }; return { a, getAttribute: (k) => (k in a ? a[k] : null), setAttribute: (k, v) => { a[k] = v; } }; };
  const path = mkEl({ fill: 'none', stroke: 'currentColor', 'stroke-width': '2' });
  const root = mkEl({ viewBox: '0 0 24 24' }); root.querySelectorAll = (sel) => (sel === '[stroke-width]' ? [path] : []);
  assert.equal(V.isStrokeIcon(root), true, '뿌리에 없어도 선 아이콘');
  assert.equal(V.iconStrokeOf(root), '2');
  const block = { dataset: { iconStroke: '3' }, querySelector: () => root };
  assert.equal(V.applyIconStroke(block), 3);
  assert.equal(path.a['stroke-width'], '3', 'path 에 입힘');
  assert.equal(root.a['stroke-width'], undefined, '뿌리에 새로 만들지 않음');
  const filled = mkEl({}); filled.querySelectorAll = () => [];
  assert.equal(V.isStrokeIcon(filled), false);
});
