/* block-opacity-a4 — 블럭 불투명도 A4(지디 261124 · data-opacity 0~100 · 100 = 키 없음)
 * 칸
 *   U1 js/block-opacity.js 계약 — 반올림·자르기 · 100 = 키·인라인 지움 · 키 없으면 100 · 래퍼(text-frame·도형 래퍼) → 안쪽 «한 번만»
 *   U2 export-figma-json _block — 키 있으면 opacity(0~1) · 없으면 키 0(옛 바이트)
 *   U3 렌더러(진짜 sangpe_to_figma.mjs + 가짜 figma_cmd) — 프레임 .5 > 글 .4 = set_node_properties 둘(제 값 · 곱하지 않음) · 없으면 0
 *   U4 플러그인(figma-plugin/code.js vm) — set_node_properties opacity → node.opacity (옛 플러그인에 이미 있다 = 플러그인 갱신 불필요)
 * 양성대조: base b03691dfa 판 = js/block-opacity.js 없음 · _opacityOf 없음 · 렌더러 set_node_properties 0 → U1·U2·U3 빨강(U4 는 지키는 칸 = 초록).
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

function loadOpacity() {
  const src = fs.readFileSync(path.join(ROOT, 'js/block-opacity.js'), 'utf8').replace(/^export\s+/gm, '');
  return new Function('window', `${src}\n;return { setBlockOpacity, readBlockOpacity };`)(undefined);
}
function el(cls, ds = {}, kids = []) {
  const e = { classList: { contains: (c) => cls.includes(c) }, dataset: { ...ds }, _style: {}, kids };
  e.style = { removeProperty: (k) => { delete e._style[k]; } };
  Object.defineProperty(e.style, 'opacity', { get: () => e._style.opacity ?? '', set: (v) => { e._style.opacity = v; }, enumerable: true });
  e.querySelector = (sel) => { const m = /:scope > \.([\w-]+)/.exec(sel); return kids.find((k) => k.classList.contains(m[1])) || null; };
  return e;
}

test('U1 계약 — 반올림·자르기 · 100 = 지움 · 키 없으면 100 · 래퍼 → 안쪽 한 번', () => {
  const { setBlockOpacity: set, readBlockOpacity: read } = loadOpacity();
  const b = el(['asset-block']);
  assert.equal(read(b), 100);
  set(b, 49.6); assert.deepEqual([b.dataset.opacity, b._style.opacity, read(b)], ['50', '0.5', 50]);
  set(b, -5); assert.deepEqual([b.dataset.opacity, b._style.opacity], ['0', '0']);
  set(b, 250); assert.equal('opacity' in b.dataset, false, '100 이상인데 키가 남았다'); assert.equal('opacity' in b._style, false, '100 인데 인라인이 남았다');
  set(b, 30); set(b, 100); assert.equal(read(b), 100); assert.equal('opacity' in b.dataset, false);
  const tb = el(['text-block']); const tf = el(['frame-block'], { textFrame: 'true' }, [tb]);
  set(tf, 40);
  assert.deepEqual([tb.dataset.opacity, tb._style.opacity], ['40', '0.4'], 'text-frame 래퍼를 줘도 안쪽 글 블럭에 걸려야 한다');
  assert.equal('opacity' in tf.dataset || 'opacity' in tf._style, false, '래퍼에도 걸렸다(두 번)');
  assert.equal(read(tf), 40);
  const sh = el(['shape-block']); const sf = el(['frame-block'], {}, [sh]);
  set(sf, 70); assert.equal(sh.dataset.opacity, '70'); assert.equal('opacity' in sf.dataset, false);
  const fr = el(['frame-block'], { freeLayout: 'true' }, []);
  set(fr, 20); assert.equal(fr.dataset.opacity, '20', '진짜 프레임은 제 자신');
  const fh = el(['asset-block'], { fillHidden: '1' }); set(fh, 30); set(fh, 100);
  assert.equal(fh.dataset.fillHidden, '1', 'Fill 눈 키를 건드렸다');
});

test('U2 export-figma-json _block — 키 있으면 opacity 0~1 · 없으면 키 0', () => {
  const EXP = fs.readFileSync(path.join(ROOT, 'js/io/export-figma-json.js'), 'utf8');
  const fn = new Function(`const _blockRaw = () => ({ type: 'x' });
    ${sliceBlock(EXP, 'function _opacityOf(')}
    ${sliceBlock(EXP, 'function _block(')}
    return _block;`)();
  assert.deepEqual(fn({ dataset: {} }), { type: 'x' }, '키 없는데 opacity 가 실렸다(옛 바이트 바뀜)');
  assert.deepEqual(fn({ dataset: { opacity: '50' } }), { type: 'x', opacity: 0.5 });
  assert.deepEqual(fn({ dataset: { opacity: '0' } }), { type: 'x', opacity: 0 });
  assert.match(EXP, /const _op = _opacityOf\(fb\); if \(_op != null\) out\.opacity = _op;/, '_frameBlock 이 프레임 제 값을 안 싣는다');
});

const FAKE = `import { appendFileSync } from 'fs';
const a = process.argv; const cmd = a[a.indexOf('--command') + 1]; const p = a[a.indexOf('--params') + 1];
const id = 'n' + process.hrtime.bigint();
appendFileSync(process.env.FAKE_LOG, JSON.stringify({ cmd, params: JSON.parse(p), id }) + '\\n');
console.log(JSON.stringify(cmd === 'get_document_info' ? { children: [] } : { id }));`;
function renderWithFake(doc) {
  const dir = mkTmpRoot('renderer-opacity-');
  const src = path.join(ROOT, 'figma-renderer');
  for (const f of fs.readdirSync(src)) if (f.endsWith('.mjs')) fs.copyFileSync(path.join(src, f), path.join(dir, f));
  fs.writeFileSync(path.join(dir, 'figma_cmd.mjs'), FAKE);
  const json = path.join(dir, 'd.json'), log = path.join(dir, 'l.log');
  fs.writeFileSync(json, JSON.stringify(doc));
  const r = spawnSync('node', [path.join(dir, 'sangpe_to_figma.mjs'), 'CH', json], { encoding: 'utf8', env: { ...process.env, FAKE_LOG: log } });
  assert.equal(r.status, 0, r.stderr);
  return fs.readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
}
const doc = (blocks) => ({ meta: { canvasWidth: 860, theme: { sectionGap: 100 } }, sections: [{ id: 's', name: 's', background: '#ffffff', paddingBottom: 0, minHeight: 0, blocks }] });

test('U3 렌더러 — 프레임 .5 > 블럭 .4 = 제 노드에 제 값(곱하지 않음) · 없으면 set_node_properties 0', () => {
  const kid = { type: 'gap', height: 40, opacity: 0.4 };
  const cmds = renderWithFake(doc([{ type: 'frame', id: 'F', width: 400, height: 200, bg: '#ff0000', free: true, opacity: 0.5, children: [{ x: 0, y: 0, w: 400, block: kid }] }]));
  const fr = cmds.find((c) => c.cmd === 'create_frame' && c.params.name === 'frame_F');
  const gp = cmds.find((c) => c.cmd === 'create_frame' && c.params.name === 'gap' && c.params.parentId === fr.id);
  const sp = cmds.filter((c) => c.cmd === 'set_node_properties');
  assert.deepEqual(sp.map((c) => [c.params.nodeId, c.params.opacity]).sort(), [[fr.id, 0.5], [gp.id, 0.4]].sort(), '노드마다 제 값이 아니다');
  const none = renderWithFake(doc([{ type: 'frame', id: 'F', width: 400, height: 200, bg: '#ff0000', free: true, children: [{ x: 0, y: 0, w: 400, block: { type: 'gap', height: 40 } }] }]));
  assert.equal(none.filter((c) => c.cmd === 'set_node_properties').length, 0, '불투명도 없는데 명령이 나갔다');
});

test('U4 플러그인 set_node_properties — opacity 를 노드에 건다', async () => {
  const node = { id: 'x', type: 'FRAME', name: 'x', opacity: 1, visible: true, locked: false };
  const figma = { showUI() {}, ui: { postMessage() {}, onmessage: null }, on() {}, notify() {}, clientStorage: { getAsync: async () => null, setAsync: async () => {} },
    currentPage: { appendChild() {} }, getNodeByIdAsync: async (id) => (id === 'x' ? node : null) };
  const ctx = vm.createContext({ figma, __html__: '', console, setTimeout, clearTimeout });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'figma-plugin/code.js'), 'utf8') + '\n;globalThis.__hc = handleCommand;', ctx);
  await ctx.__hc('set_node_properties', { nodeId: 'x', opacity: 0.4 });
  assert.equal(node.opacity, 0.4);
});
