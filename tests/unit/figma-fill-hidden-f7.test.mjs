/* figma-fill-hidden-f7 — 0.9.14 DS-FILL-STD F7(지디 261124) · 표준 Fill 숨김(data-fill-hidden) → Figma «칠 페인트 visible:false»
 * 자: 플러그인 = figma-plugin/code.js 를 vm 에 가짜 figma 로 올려 handleCommand(figma-asset-clip-crop-0912 선례) · ⛔실 Figma 0
 * 칸
 *   P1 set_node_properties fillsVisible:false = 칠마다 visible false(색·종류·순서 그대로) · 돌려준 값 fillsVisible false · true = 다시 켬
 *   P2 [지킴] fillsVisible 안 주면 칠 손 0 · 돌려준 값엔 fillsVisible 이 «있다»(옛 플러그인은 이 키가 없다 = 렌더러가 옛 판을 알아보는 표)
 *   P3 칠 배열이 없는 노드(글자 섞인 칠 = figma.mixed 등)는 던진다(조용히 넘어가지 않는다)
 * 양성대조: _patches/fill-f7-CTL-plugin.patch(setNodeProperties 의 fillsVisible 갈래 뺌) → P1 빨강
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function plugin(nodes) {
  const figma = {
    showUI() {}, ui: { postMessage() {}, onmessage: null }, on() {}, notify() {}, clientStorage: { getAsync: async () => null, setAsync: async () => {} }, currentPage: { appendChild() {} },
    mixed: Symbol('mixed'), getNodeByIdAsync: async (id) => nodes[id] || null, getNodeById: (id) => nodes[id] || null,
  };
  const ctx = vm.createContext({ figma, __html__: '', console, setTimeout, clearTimeout });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'figma-plugin/code.js'), 'utf8') + '\n;globalThis.__hc = handleCommand;', ctx);
  return { hc: ctx.__hc, figma };
}
const solid = { type: 'SOLID', color: { r: 0.1, g: 0.6, b: 0.2 }, opacity: 1, visible: true };
const grad = { type: 'GRADIENT_LINEAR', gradientStops: [{ position: 0, color: { r: 1, g: 0, b: 0, a: 1 } }], gradientTransform: [[1, 0, 0], [0, 1, 0]] };

test('P1 fillsVisible false = 칠마다 visible false · 색·종류 그대로 · true = 다시 켬', async () => {
  const n = { id: '1:1', name: 'f', type: 'FRAME', visible: true, locked: false, opacity: 1, fills: [solid, grad] };
  const { hc } = plugin({ '1:1': n });
  const r = await hc('set_node_properties', { nodeId: '1:1', fillsVisible: false });
  assert.deepEqual(JSON.parse(JSON.stringify(n.fills.map((f) => [f.type, f.visible]))), [['SOLID', false], ['GRADIENT_LINEAR', false]], '칠 visible 이 안 꺼졌다');
  assert.deepEqual(JSON.parse(JSON.stringify(n.fills[0].color)), solid.color, '색이 바뀌었다(숨김은 색을 지우지 않는다)');
  assert.equal(n.visible, true, '노드 visible 을 건드렸다(칠만 꺼야 한다)');
  assert.equal(r.fillsVisible, false);
  const r2 = await hc('set_node_properties', { nodeId: '1:1', fillsVisible: true });
  assert.equal(n.fills.every((f) => f.visible === true), true); assert.equal(r2.fillsVisible, true);
});

test('P2 [지킴] fillsVisible 안 주면 칠 손 0 · 돌려준 값엔 fillsVisible 키가 있다(옛 판 구별)', async () => {
  const fills = [solid];
  const n = { id: '1:2', name: 'f', type: 'FRAME', visible: true, locked: false, opacity: 1, fills };
  const { hc } = plugin({ '1:2': n });
  const r = await hc('set_node_properties', { nodeId: '1:2', opacity: 0.5 });
  assert.equal(n.fills, fills, '안 줬는데 칠 배열을 갈았다'); assert.equal(n.opacity, 0.5);
  assert.equal('fillsVisible' in r, true, '새 판은 fillsVisible 을 돌려줘야 렌더러가 옛 판과 가른다'); assert.equal(r.fillsVisible, true);
});

test('P3 칠 배열이 없는 노드는 던진다', async () => {
  const { hc, figma } = plugin({});
  const n = { id: '1:3', name: 't', type: 'TEXT', visible: true, locked: false, opacity: 1, fills: figma.mixed };
  const p = plugin({ '1:3': n });
  await assert.rejects(() => p.hc('set_node_properties', { nodeId: '1:3', fillsVisible: false }), /does not support fills/);
  void hc;
});

/* ── 렌더러(진짜 figma-renderer/sangpe_to_figma.mjs + 가짜 figma_cmd.mjs · figma-asset-clip-crop-0912 선례) ──
 *   R1 종류마다: fillHidden 이면 «그 칠을 받은 노드»에 set_node_properties fillsVisible:false · 아니면 그 명령 0 · 나머지 명령 줄(이름 순서)은 같다
 *   R2 도형: SVG 자식 중 칠 있는 벡터마다 fillsVisible:false(선만 있는 벡터·껍데기 프레임은 안 건드림)
 *   R3 옛 플러그인(돌려준 값에 fillsVisible 없음) = 경고 문구 «한 번»(블럭이 여럿이어도)
 * 양성대조: _patches/fill-f7-CTL-renderer.patch(_hideFills 몸 비움) → R1·R2·R3 빨강 */
import { spawnSync } from 'node:child_process';
import { mkTmpRoot } from './_tmproot.js';
const FAKE = `import { appendFileSync } from 'fs';
const a = process.argv; const cmd = a[a.indexOf('--command') + 1]; const p = JSON.parse(a[a.indexOf('--params') + 1]);
const id = 'n' + process.hrtime.bigint();
appendFileSync(process.env.FAKE_LOG, JSON.stringify({ cmd, params: p, id }) + '\\n');
let out = { id };
if (cmd === 'get_document_info') out = { children: [] };
if (cmd === 'get_node_info') out = { document: { id: 'svgroot', type: 'FRAME', fills: [], children: [{ id: 'vfill', type: 'VECTOR', fills: [{ type: 'SOLID' }], children: [] }, { id: 'vline', type: 'VECTOR', fills: [], children: [] }] } };
if (cmd === 'set_node_properties') out = process.env.FAKE_OLD ? { id: p.nodeId, visible: true } : { id: p.nodeId, visible: true, fillsVisible: p.fillsVisible !== false };
console.log(JSON.stringify(out));`;
function render(blocks, old) {
  const dir = mkTmpRoot('fill-f7-');
  const src = path.join(ROOT, 'figma-renderer');
  for (const f of fs.readdirSync(src)) if (f.endsWith('.mjs')) fs.copyFileSync(path.join(src, f), path.join(dir, f));
  fs.writeFileSync(path.join(dir, 'figma_cmd.mjs'), FAKE);
  const json = path.join(dir, 'd.json'), log = path.join(dir, 'l.log');
  fs.writeFileSync(json, JSON.stringify({ meta: { canvasWidth: 860, theme: { sectionGap: 100 } }, sections: [{ id: 's', name: 's', background: '#ffffff', paddingBottom: 0, minHeight: 0, blocks }] }));
  const r = spawnSync('node', [path.join(dir, 'sangpe_to_figma.mjs'), 'CH', json], { encoding: 'utf8', env: { ...process.env, FAKE_LOG: log, ...(old ? { FAKE_OLD: '1' } : {}) } });
  assert.equal(r.status, 0, r.stderr);
  return { cmds: fs.readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l)), out: r.stdout };
}
const G = { r: 18 / 255, g: 171 / 255, b: 52 / 255 };
const isG = (c) => c && Math.abs(c.r - G.r) < 0.01 && Math.abs(c.g - G.g) < 0.01 && Math.abs(c.b - G.b) < 0.01;
const R1 = {
  frame: { type: 'frame', id: 'fr', width: 300, height: 120, bg: '#12ab34', radius: 0, free: true, children: [] },
  modal: { type: 'generic', id: 'md', kind: 'modal', variant: 'plain', width: 300, height: 120, bg: '#12ab34', radius: 0, padX: 0, padY: 0, texts: [], svg: '' },
  radial: { type: 'generic', id: 'rd', kind: 'radial', width: 300, height: 120, bg: '#12ab34', radius: 0, svg: '', texts: [] },
  circle: { type: 'circle', id: 'ic', size: 120, bgColor: '#12ab34', src: null },
  step: { type: 'step', id: 'st', height: 120, cardBg: '#12ab34', items: [{ title: 'A', desc: 'B' }], titleSize: 36, descSize: 24, titleColor: '#222222', descColor: '#888888', badgeFormat: 'padded', badgeGap: 20 },
  banner02: { type: 'banner02', id: 'bn', bannerW: 780, bannerH: 260, radius: 20, bg: '#12ab34', textX: 36, textY: 35, lines: [] },
};
for (const [name, b] of Object.entries(R1)) {
  test(`R1 ${name} — 숨김 = 그 칠 노드에 fillsVisible:false · 아니면 0 · 나머지 같음`, () => {
    const on = render([{ ...b, fillHidden: true }]).cmds, off = render([b]).cmds;
    const painted = on.filter((c) => c.cmd === 'set_fill_color' && isG(c.params.color)).map((c) => c.params.nodeId);
    const hid = on.filter((c) => c.cmd === 'set_node_properties' && c.params.fillsVisible === false).map((c) => c.params.nodeId);
    assert.equal(painted.length, 1, `[전제] 유일 색 칠이 한 번(${painted.length})`);
    assert.deepEqual(hid, painted, '칠 눈을 «그 칠 노드»에 안 껐다');
    assert.equal(off.filter((c) => c.cmd === 'set_node_properties' && 'fillsVisible' in c.params).length, 0, '안 숨겼는데 fillsVisible 명령이 갔다');
    assert.deepEqual(on.filter((c) => !(c.cmd === 'set_node_properties' && 'fillsVisible' in c.params)).map((c) => c.cmd), off.map((c) => c.cmd), '숨김이 다른 명령까지 바꿨다');
  });
}

test('R1 simple-card — 글 배경 칸 이름표 프레임마다 · 칸별 cellBg 칸은 안 건드림', () => {
  const b = { type: 'card-grid', id: 'cg', cols: 2, rows: 1, gap: 12, radius: 16, imgRatio: 75, cardMode: 'simple', textBg: '#12ab34', labelPos: 'below', overlayHeight: 180, overlayWidth: 100, gradientBg: '', imgShape: 'rect', titleSize: 32, descSize: 20, width: 600,
    cards: [{ title: 'A', desc: 'a' }, { title: 'B', desc: 'b', cellBg: '#ff0000' }] };
  const on = render([{ ...b, fillHidden: true }]).cmds, off = render([b]).cmds;
  const painted = on.filter((c) => c.cmd === 'set_fill_color' && isG(c.params.color)).map((c) => c.params.nodeId);
  const hid = on.filter((c) => c.cmd === 'set_node_properties' && c.params.fillsVisible === false).map((c) => c.params.nodeId);
  assert.ok(painted.length >= 1, '[전제] 글 배경 칠이 갔다');
  assert.deepEqual(hid, painted, '글 배경 칠 노드에만(cellBg 칸 빼고) 꺼야 한다');
  assert.equal(off.filter((c) => c.cmd === 'set_node_properties' && 'fillsVisible' in c.params).length, 0);
});

test('R2 도형 — SVG 자식 중 칠 있는 벡터만 fillsVisible:false · 안 숨기면 0', () => {
  const b = { type: 'shape', id: 'sh', shapeType: 'rectangle', color: '#12ab34', width: 200, height: 100, strokeWidth: 0, strokeColor: '#000000', radius: 0, rotation: 0 };
  const on = render([{ ...b, fillHidden: true }]).cmds, off = render([b]).cmds;
  assert.deepEqual(on.filter((c) => c.cmd === 'set_node_properties' && c.params.fillsVisible === false).map((c) => c.params.nodeId), ['vfill'], '칠 있는 벡터(vfill)만 · 선뿐인 벡터·뿌리 프레임은 안 건드림');
  assert.equal(off.filter((c) => c.cmd === 'set_node_properties' && 'fillsVisible' in c.params).length, 0);
  assert.equal(off.filter((c) => c.cmd === 'get_node_info').length, 0, '[지킴] 안 숨기면 자식 걷기(get_node_info)도 0');
});

test('R3 옛 플러그인 — 경고 문구 «한 번»(숨긴 블럭 둘이어도)', () => {
  const b = R1.frame;
  const { out } = render([{ ...b, id: 'a', fillHidden: true }, { ...b, id: 'b', fillHidden: true }], true);
  assert.equal((out.match(/Figma 플러그인이 옛 판이에요/g) || []).length, 1, '경고가 없거나 여러 번');
  const nw = render([{ ...b, id: 'a', fillHidden: true }]).out;
  assert.equal(/Figma 플러그인이 옛 판이에요/.test(nw), false, '새 판인데 경고');
});
