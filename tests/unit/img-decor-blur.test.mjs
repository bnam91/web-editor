/* img-decor-blur — IMG-FX-BLUR-01(현빈 261121 ⓑ) 꾸밈 «흐림» 셈·배선.
 * U1 normalizeDecorBlur — 0/음수/NaN = 0 · 정수 반올림 · 상한 40
 * U2 합성 — writeImgFilter: 흐림만 = blur(Npx) + 호스트 --decor-blur · 가림이 켜지면 가림 px 만(흐림 몫 0 · 변수 지움) · 색보정 몫과 같이 산다
 * U3 Figma 배선 — export-figma-json 이 decorBlur 를 싣고(가림이면 0) · 렌더러가 block.decorBlur 로 LAYER_BLUR set_effects
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readSrc } from './_srcread.js';
import { mkTmpRoot } from './_tmproot.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const _tmp = path.join(mkTmpRoot('img-decor-blur-'), 'image-redact.mjs');
fs.writeFileSync(_tmp, readSrc(ROOT, 'js', 'effects', 'image-redact.js'));
const R = await import(pathToFileURL(_tmp).href);

/* 가짜 DOM — host(.asset-block) > clip(.asset-img-clip) > img */
function scene(ds = {}) {
  const sty = () => { const p = {}; return { _p: p, filter: '', setProperty(k, v) { p[k] = String(v); }, removeProperty(k) { delete p[k]; }, getPropertyValue(k) { return p[k] || ''; } }; };
  const host = { dataset: { ...ds }, style: sty(), classList: { contains: (c) => c === 'asset-block' } };
  const clip = { parentElement: host, classList: { contains: (c) => c === 'asset-img-clip' } };
  const img = { parentElement: clip, style: sty() };
  return { host, img };
}

test('U1 normalizeDecorBlur', () => {
  for (const [v, w] of [[0, 0], [-3, 0], ['x', 0], [7.6, 8], [40, 40], [99, 40]]) assert.equal(R.normalizeDecorBlur(v), w, String(v));
  assert.equal(R.DECOR_BLUR_MAX, 40);
});

test('U2 합성 — 흐림 · 가림이 이김 · 색보정 공존', () => {
  const a = scene({ decorBlur: '12' }); R.writeImgFilter(a.img, '');
  assert.equal(a.img.style.filter, 'blur(12px)'); assert.equal(a.host.style.getPropertyValue('--decor-blur'), '12px');
  const b = scene({ decorBlur: '12', redact: '40' }); b.host.style.setProperty('--decor-blur', '12px'); R.writeImgFilter(b.img, '');
  assert.equal(b.img.style.filter, 'blur(8px)', '가림 40 = 8px 만'); assert.equal(b.host.style.getPropertyValue('--decor-blur'), '', '가림이면 흐림 변수 지움');
  const c = scene({ decorBlur: '5' }); R.writeImgFilter(c.img, 'url(#adj)');
  assert.equal(c.img.style.filter, 'url(#adj) blur(5px)');
  const d = scene({}); R.writeImgFilter(d.img, ''); assert.equal(d.img.style.filter, ''); assert.equal(d.host.style.getPropertyValue('--decor-blur'), '');
});

test('U3 Figma 배선 — JSON decorBlur · 렌더러 LAYER_BLUR', () => {
  const exp = readSrc(ROOT, 'js', 'io', 'export-figma-json.js'), ren = readSrc(ROOT, 'figma-renderer', 'sangpe_to_figma.mjs');
  assert.match(exp, /function _imageDecorBlur\(el\) \{\n\s*return readRedact\(el\) > 0 \? 0 : normalizeDecorBlur\(el\?\.dataset\?\.decorBlur\);/);
  assert.equal((exp.match(/\.\.\.\(_imageDecorBlur\(el\) \? \{ decorBlur: _imageDecorBlur\(el\) \} : \{\}\)/g) || []).length, 2, '그림 두 갈래(asset · image) 다 싣는다');
  assert.match(ren, /if \(block\.decorBlur > 0\) run\('set_effects', \{ nodeId: _fillId, effects: \[\{ type: 'LAYER_BLUR', radius: block\.decorBlur \}\] \}\);/);
});
