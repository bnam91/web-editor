/* stroke-look.js — 표준 Stroke «Stroke 설정» 값 ↔ 저장 키 ↔ SVG (§4c ②b · 단계 3-2)
 * L1 기본(실선·끝/꼭짓점 기본·Miter 28.96) = 키 0개(옛 저장본 바이트 무변) · L2 점선 = 굵기 파생 3w·2w(vector 식) · L3 사용자 = 길이·간격 키
 * L4 Miter 각도 ↔ miterlimit(28.96° ≈ 4 · 60° = 2) · L5 기본으로 되돌리면 키가 다시 사라짐 · L6 기본은 부르는 쪽(선·화살표 끝 = round)
 * 양성대조(예측): writeLook 의 isDef 를 false 로 → L1·L5 빨강 · derivedDash 의 3 → 2 → L2 빨강 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkTmpRoot } from './_tmproot.js';
/* js/*.js 는 node 에선 CommonJS 로 읽힌다 → 임시 .mjs 사본으로 올린다(cert-render-smoke 와 같은 손) */
const ROOT = process.env.GD1001_ROOT || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const _dir = mkTmpRoot('stroke-look-');
fs.copyFileSync(path.join(ROOT, 'js', 'stroke-look.js'), path.join(_dir, 'stroke-look.mjs'));
const { readLook, writeLook, svgLook, derivedDash, MITER_DEG_DEFAULT } = await import(pathToFileURL(path.join(_dir, 'stroke-look.mjs')).href);

test('L1 기본 = 키 0개', () => {
  const ds = {}; writeLook(ds, readLook(ds), {});
  assert.deepEqual(ds, {});
  assert.deepEqual(svgLook(readLook({}), 3), { dasharray: '', linecap: 'butt', linejoin: 'miter', miterlimit: 4 });
});
test('L2 점선 = 굵기 파생 3w·2w · 키는 strokeStyle 하나', () => {
  const ds = {}; writeLook(ds, { ...readLook(ds), style: 'dashed' });
  assert.deepEqual(ds, { strokeStyle: 'dashed' });
  assert.equal(svgLook(readLook(ds), 4).dasharray, '12 8');
  assert.deepEqual(derivedDash(0), { dash: 3, gap: 2 });   // 굵기 0 이라도 0 길이 점선(= 안 보임)은 안 만든다
});
test('L3 사용자 = 길이·간격 키 · SVG 그대로', () => {
  const ds = {}; writeLook(ds, { ...readLook(ds), style: 'custom', dash: 6, gap: 3 });
  assert.deepEqual(ds, { strokeStyle: 'custom', strokeDashLen: '6', strokeGapLen: '3' });
  assert.equal(svgLook(readLook(ds), 99).dasharray, '6 3');
});
test('L4 Miter 각도 ↔ miterlimit', () => {
  assert.equal(svgLook({ ...readLook({}), miter: MITER_DEG_DEFAULT }, 1).miterlimit, 4);
  assert.equal(svgLook({ ...readLook({}), miter: 60 }, 1).miterlimit, 2);
});
test('L5 기본으로 되돌리면 키가 사라짐', () => {
  const ds = { strokeStyle: 'custom', strokeDashLen: '6', strokeGapLen: '3', strokeCap: 'round', strokeJoin: 'bevel', strokeMiter: '60' };
  writeLook(ds, { style: 'solid', dash: null, gap: null, cap: 'none', join: 'miter', miter: MITER_DEG_DEFAULT });
  assert.deepEqual(ds, {});
});
test('L6 기본은 부르는 쪽 — 선 끝 기본 round 면 round 는 키 없음 · none 은 키', () => {
  const def = { cap: 'round' }, ds = {};
  writeLook(ds, readLook(ds, def), def);
  assert.deepEqual(ds, {});
  writeLook(ds, { ...readLook(ds, def), cap: 'none' }, def);
  assert.deepEqual(ds, { strokeCap: 'none' });
  assert.equal(svgLook(readLook(ds, def), 3).linecap, 'butt');
});

test('L7 면별 — 넷 다 표준이면 키 0 · 하나라도 다르면 넷 다 키 · CSS 4값 · Mixed', async () => {
  const { readSides, writeSides, cssSideWidths, sidesMixed, hasSides } = await import(pathToFileURL(path.join(_dir, 'stroke-look.mjs')).href);
  const ds = {};
  writeSides(ds, { top: 2, right: 2, bottom: 2, left: 2 }, 2);
  assert.deepEqual(ds, {});
  assert.equal(cssSideWidths(ds, 2), '');
  writeSides(ds, { top: 4, right: 0, bottom: 2, left: 0 }, 2);
  assert.deepEqual(ds, { strokeWidthTop: '4', strokeWidthRight: '0', strokeWidthBottom: '2', strokeWidthLeft: '0' });
  assert.equal(cssSideWidths(ds, 2), '4px 0px 2px 0px');
  assert.equal(sidesMixed(ds, 2), true);
  assert.deepEqual(readSides(ds, 9), { top: 4, right: 0, bottom: 2, left: 0 });
  writeSides(ds, null, 2);
  assert.equal(hasSides(ds), false);
});
