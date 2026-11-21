/* figma-asset-clip-crop-0912 — 0.9.12 134 FIGMA-ASSET-CLIP-OFF-AND-CROP-MISMATCH-01
 *   ⑴ «내용 자르기» 끈 에셋(data-clip-content=false)도 Figma 에서 잘림 ⑵ 크롭한 단일 그림의 크롭이 Figma 에 안 실림(src 만).
 * 고침: export _assetFigmaClipCrop(clip:false · crop 비) → 렌더러 image_ 프레임 clipsContent 명시 · crop 이면 imgcrop_ 자식 프레임에 그림
 *   → 플러그인 create_frame 이 clipsContent 를 늘 명시(false 만 끔).
 * 자: 보내는 쪽 = _assetFigmaClipCrop 를 _slice-block 으로 잘라 «실행» · 렌더러 = 진짜 sangpe_to_figma.mjs + 가짜 figma_cmd.mjs
 *   · 플러그인 = figma-plugin/code.js 를 vm 에 가짜 figma 객체로 올려 handleCommand. ⛔실 Figma·REST·토큰 0.
 * 칸
 *   A1 보내는 쪽 — 끔 = clip:false(켬·모름 = 키 0) · 그림 편집 = crop 비(높이 = imgW × 원본 세로/가로) · 원본 크기 모르면 crop 0
 *   A2 렌더러 — clipsContent 명시(끔 false · 켬 true) · crop 이면 imgcrop_ 자식에 그림 · [지킴] 없으면 옛 그대로 image_ 에 칠
 *   A3 플러그인 create_frame — false = false · 안 주면 명시 true(가짜 프레임은 처음 undefined — 기본값에 기대면 빨강)
 *   A4 배선 — 단일 그림 export 가 _assetFigmaClipCrop 를 부른다
 * 양성대조: _patches/controls/ASSET-CTL.patch(고친 줄 되돌림) → A1·A2·A3·A4 빨강.
 * 안 잰 것: 실 Figma 화면 · 그림 회전(imgRotate)·object-position·블럭 padding(안 싣는다) · 묶음(collab) 그림.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { mkTmpRoot } from './_tmproot.js';
const require = createRequire(import.meta.url);
const { sliceBlock } = require('./_slice-block.js');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const EXP = fs.readFileSync(path.join(ROOT, 'js/io/export-figma-json.js'), 'utf8');

function clipCropFn(clips) {
  const window = { clipsContent: () => clips };
  const document = { getElementById: () => null };
  return new Function('window', 'document', `${sliceBlock(EXP, 'function _assetFigmaClipCrop(')}; return _assetFigmaClipCrop;`)(window, document);
}
const mkAsset = (ds, img = { naturalWidth: 800, naturalHeight: 400 }) => ({ id: '', dataset: ds, offsetWidth: 400, offsetHeight: 300, querySelector: (s) => (s === '.asset-img' ? img : null) });

test('A1 보내는 쪽 에셋 — 자르기 끔 = clip:false(켬·모름 = 키 0) · 그림 편집 = crop 비', () => {
  assert.deepEqual(clipCropFn(false)(mkAsset({})), { clip: false }, '자르기 끈 에셋이 clip:false 를 안 싣는다');
  assert.deepEqual(clipCropFn(true)(mkAsset({})), {}, '켬 = 키 0(옛 바이트)');
  assert.deepEqual(clipCropFn(null)(mkAsset({})), {}, '모름 = 키 0');
  // 블럭 400×300 · 그림 폭 600(원본 800×400 → 높이 300) · 왼위 (-100, 30)
  assert.deepEqual(clipCropFn(true)(mkAsset({ imgW: '600', imgX: '-100', imgY: '30' })), { crop: { x: -0.25, y: 0.1, w: 1.5, h: 1 } }, '크롭이 안 실렸다(src 만)');
  assert.deepEqual(clipCropFn(true)(mkAsset({ imgW: '600' }, { naturalWidth: 0, naturalHeight: 0 })), {}, '원본 크기를 모르면 crop 키 0');
});

test('A4 배선 — 단일 그림 export 가 _assetFigmaClipCrop 를 부른다(묶음 그림은 아님)', () => {   // ★기대 바뀜(IMG-FX-HALFTONE-01 261121): 하프톤 켠 그림은 src 가 «상자 그대로 구운 그림»이라 clip·crop 을 안 씀 — 가드에 && !_assetOut.halftone
  assert.equal((EXP.match(/(?<!function )_assetFigmaClipCrop\(el\)/g) || []).length, 1, '_assetFigmaClipCrop(el) 호출은 콜라보 가드 안 한 자리뿐이어야 한다');
  assert.match(EXP, /if \(!el\.dataset\.collab && !_assetOut\.halftone\) Object\.assign\(_assetOut, _assetFigmaClipCrop\(el\)\);[ \t]*(?:\/\/[^\n]*)?\n\s*return el\.dataset\.collab \? _assetCollabFigmaFrame\(el, _assetOut\) : _assetOut;/);
});

const FAKE = `import { appendFileSync } from 'fs';
const a = process.argv; const cmd = a[a.indexOf('--command') + 1]; const p = a[a.indexOf('--params') + 1];
const id = 'n' + process.hrtime.bigint();
appendFileSync(process.env.FAKE_LOG, JSON.stringify({ cmd, params: JSON.parse(p), id }) + '\\n');
console.log(JSON.stringify(cmd === 'get_document_info' ? { children: [] } : { id }));`;
function render(blocks) {
  const dir = mkTmpRoot('renderer-gaps0912-');
  const src = path.join(ROOT, 'figma-renderer');
  for (const f of fs.readdirSync(src)) if (f.endsWith('.mjs')) fs.copyFileSync(path.join(src, f), path.join(dir, f));
  fs.writeFileSync(path.join(dir, 'figma_cmd.mjs'), FAKE);
  const json = path.join(dir, 'd.json'), log = path.join(dir, 'l.log');
  fs.writeFileSync(json, JSON.stringify({ meta: { canvasWidth: 860, theme: { sectionGap: 100 } }, sections: [{ id: 's', name: 's', background: '#ffffff', paddingBottom: 0, minHeight: 0, blocks }] }));
  const r = spawnSync('node', [path.join(dir, 'sangpe_to_figma.mjs'), 'CH', json], { encoding: 'utf8', env: { ...process.env, FAKE_LOG: log } });
  assert.equal(r.status, 0, r.stderr);
  return fs.readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
}
const frame = (cmds, re) => cmds.filter((c) => c.cmd === 'create_frame' && re.test(c.params.name || ''));
test('A2 렌더러 에셋 — clipsContent 명시 · crop 이면 imgcrop_ 자식에 그림 · 없으면 옛 그대로', () => {
  const SRC = 'data:image/png;base64,QUJD';
  const IMG = { type: 'image', id: 'im', height: 300, sizePct: 100, padX: 0, style: { borderRadius: 0 }, src: SRC };
  const c1 = render([{ ...IMG, clip: false, crop: { x: -0.25, y: 0.1, w: 1.5, h: 1 } }]);
  const [fr] = frame(c1, /^image_im$/), [cf] = frame(c1, /^imgcrop_im$/);
  assert.equal(fr.params.clipsContent, false, '«내용 자르기» 끈 에셋이 Figma 에서 잘린다(clipsContent 미명시/true)');
  assert.ok(cf, '크롭 자식 프레임이 없다(크롭이 Figma 로 안 감)');
  assert.equal(cf.params.parentId, fr.id);
  assert.deepEqual([cf.params.x, cf.params.y, cf.params.width, cf.params.height],
    [Math.round(-0.25 * fr.params.width), Math.round(0.1 * fr.params.height), Math.round(1.5 * fr.params.width), Math.round(1 * fr.params.height)], '크롭 상자 자리·크기');
  const fills = c1.filter((c) => c.cmd === 'set_image_fill');
  assert.deepEqual(fills.map((c) => [c.params.nodeId, c.params.imageSource]), [[cf.id, 'QUJD']], '그림은 크롭 자식에만 칠한다');
  // [지킴] crop·clip 없음 = image_ 에 칠 · clipsContent true(명시)
  const c0 = render([IMG]);
  const [f0] = frame(c0, /^image_im$/);
  assert.equal(f0.params.clipsContent, true, '켬도 명시(true)');
  assert.equal(frame(c0, /^imgcrop_/).length, 0);
  assert.deepEqual(c0.filter((c) => c.cmd === 'set_image_fill').map((c) => c.params.nodeId), [f0.id]);
});

test('A3 플러그인 create_frame — clipsContent false = false · 안 주면 명시 true', async () => {
  const made = [];
  const page = { appendChild() {} };
  const figma = {
    showUI() {}, ui: { postMessage() {}, onmessage: null }, on() {}, notify() {}, clientStorage: { getAsync: async () => null, setAsync: async () => {} }, currentPage: page,
    createFrame() { const f = { id: 'f' + made.length, clipsContent: undefined, fills: [], resize(w, h) { this.width = w; this.height = h; } }; made.push(f); return f; },
    getNodeByIdAsync: async () => null,
  };
  const ctx = vm.createContext({ figma, __html__: '', console, setTimeout, clearTimeout });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'figma-plugin/code.js'), 'utf8') + '\n;globalThis.__hc = handleCommand;', ctx);
  await ctx.__hc('create_frame', { width: 10, height: 10, clipsContent: false });
  await ctx.__hc('create_frame', { width: 10, height: 10 });
  assert.equal(made[0].clipsContent, false, 'clipsContent:false 를 플러그인이 안 먹는다');
  assert.equal(made[1].clipsContent, true, '안 주면 Figma 기본값에 기댄다(명시 true 아님)');
});
