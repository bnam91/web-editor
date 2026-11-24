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
