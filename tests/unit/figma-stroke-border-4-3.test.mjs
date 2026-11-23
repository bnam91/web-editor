/* 표준 Stroke 4-3 — CSS 테두리·면별 굵기·표 바깥 변이 Figma 로 간다(지디 261124 · 그전엔 «아예 안 감» 실측)
 * 자 ① 렌더러 = 진짜 sangpe_to_figma.mjs + 기록하는 가짜 figma_cmd.mjs(figma-renderer-images 와 같은 손) ② 플러그인 = code.js 를 vm 에(figma-asset-clip-crop A3 와 같은 손 · 가짜 figma)
 *  B0 [음성] border 없는 프레임 = set_stroke_color 0(옛 명령 그대로) · B1 프레임 균일 = set_stroke_color{굵기·색·INSIDE} · B2 프레임 면별 = sides
 *  B3 모달(generic) · B4 그리드 G17 면별 꼴 · B5 표 바깥 변(x 끔 y 켬) · B6 에셋 · B7 도형 사각형 strokeSides = 선 둘
 *  P1 플러그인 sides → strokeTop/Right/Bottom/LeftWeight · align INSIDE · P2 sides 없으면 옛 동작(면별 속성 안 건드림)
 * ⛔실 Figma 0 — 화면 확인은 미카사 실기(handoff/STROKE-FIGMA-4-3-mikasa.md)
 * 양성대조(예측): 렌더러 applyBorder 몸을 return 으로 → B1~B6 빨강 · B0 초록 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkTmpRoot } from './_tmproot.js';

const ROOT = process.env.GD1001_ROOT || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FAKE = `import { appendFileSync } from 'fs';
const a = process.argv; const cmd = a[a.indexOf('--command') + 1]; const p = a[a.indexOf('--params') + 1];
const id = 'n' + process.hrtime.bigint();
appendFileSync(process.env.FAKE_LOG, JSON.stringify({ cmd, params: JSON.parse(p), id }) + '\\n');
console.log(JSON.stringify(cmd === 'get_document_info' ? { children: [] } : { id }));`;
function render(blocks) {
  const dir = mkTmpRoot('renderer-border43-');
  const src = path.join(ROOT, 'figma-renderer');
  for (const f of fs.readdirSync(src)) if (f.endsWith('.mjs')) fs.copyFileSync(path.join(src, f), path.join(dir, f));
  fs.writeFileSync(path.join(dir, 'figma_cmd.mjs'), FAKE);
  const json = path.join(dir, 'd.json'), log = path.join(dir, 'l.log');
  fs.writeFileSync(json, JSON.stringify({ meta: { canvasWidth: 860, theme: { sectionGap: 100 } }, sections: [{ id: 's', name: 's', background: '#ffffff', paddingBottom: 0, minHeight: 0, blocks }] }));
  const r = spawnSync('node', [path.join(dir, 'sangpe_to_figma.mjs'), 'CH', json], { encoding: 'utf8', env: { ...process.env, FAKE_LOG: log } });
  assert.equal(r.status, 0, r.stderr);
  return fs.readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
}
const strokes = (cmds) => cmds.filter((c) => c.cmd === 'set_stroke_color').map((c) => ({ w: c.params.strokeWeight, sides: c.params.sides ?? null, align: c.params.align, r: Math.round(c.params.color.r * 255) }));
const FRAME = { type: 'frame', id: 'f1', width: 300, height: 120, bg: '#ffffff', radius: 0, free: true, children: [] };

test('B0 [음성] border 없는 프레임 = set_stroke_color 0', () => { assert.deepEqual(strokes(render([FRAME])), []); });
test('B1 프레임 균일 = 굵기·색·INSIDE', () => {
  assert.deepEqual(strokes(render([{ ...FRAME, border: { width: 3, style: 'solid', color: '#ff0000' } }])), [{ w: 3, sides: null, align: 'INSIDE', r: 255 }]);
});
test('B2 프레임 면별 = sides 넷', () => {
  const s = strokes(render([{ ...FRAME, border: { width: 2, style: 'solid', color: '#000000', sides: { top: 6, right: 0, bottom: 3, left: 0 } } }]));
  assert.deepEqual(s, [{ w: 2, sides: { top: 6, right: 0, bottom: 3, left: 0 }, align: 'INSIDE', r: 0 }]);
});
test('B3 모달(generic) 테두리', () => {
  const s = strokes(render([{ type: 'generic', kind: 'modal', id: 'm1', width: 300, height: 100, bg: '#ffffff', radius: 8, texts: [], border: { width: 2, style: 'solid', color: '#c3c3ca' } }]));
  assert.deepEqual(s.map((x) => [x.w, x.align]), [[2, 'INSIDE']]);
});
test('B4 그리드 블럭 외곽선(G17 꼴) = 면별 · 굵기 = 가장 큰 변', () => {
  const s = strokes(render([{ type: 'generic', kind: 'grid', id: 'g1', width: 300, height: 100, bg: '', radius: 0, svg: '', texts: [], border: { top: { width: 2, style: 'solid', color: 'rgb(0, 0, 0)' }, right: null, bottom: { width: 2, style: 'solid', color: 'rgb(0, 0, 0)' }, left: null } }]));
  assert.deepEqual(s, [{ w: 2, sides: { top: 2, right: 0, bottom: 2, left: 0 }, align: 'INSIDE', r: 0 }]);
});
test('B5 표 바깥 변 — 좌우 끔 · 상하 켬 · 굵기 3', () => {
  const s = strokes(render([{ type: 'table', id: 't1', width: 400, rows: [{ cells: [{ text: 'a' }, { text: 'b' }] }], showVLines: true, showHLines: true, lineColor: '#cccccc', outer: { x: false, y: true, width: 3 } }]));
  assert.deepEqual(s, [{ w: 3, sides: { top: 3, bottom: 3, left: 0, right: 0 }, align: 'INSIDE', r: 204 }]);
});
test('B6 에셋 테두리', () => {
  const s = strokes(render([{ type: 'image', id: 'a1', height: 200, sizePct: 100, padX: 0, style: { borderRadius: 0 }, src: null, border: { width: 4, style: 'solid', color: '#000000' } }]));
  assert.deepEqual(s.map((x) => x.w), [4]);
});
test('B7 도형 사각형 strokeSides = SVG 에 선 둘(위 6 · 아래 3) · 옛 rect 아님', () => {
  const c = render([{ type: 'shape', id: 'r1', shapeType: 'rectangle', color: '#ffffff', strokeWidth: 2, rotation: 0, width: 120, height: 80, strokeSides: [6, 0, 3, 0] }]).find((x) => x.cmd === 'create_node_from_svg');
  assert.ok(c, '[전제] 도형 SVG');
  assert.deepEqual([...c.params.svg.matchAll(/<line [^>]*y1="([\d.]+)"[^>]*stroke-width="([\d.]+)"/g)].map((m) => `${m[1]}:${m[2]}`), ['3:6', '98.5:3']);
});

function plugin() {
  const nodes = {};
  const figma = { showUI() {}, ui: { postMessage() {}, onmessage: null }, on() {}, notify() {}, clientStorage: { getAsync: async () => null, setAsync: async () => {} }, currentPage: { appendChild() {} },
    getNodeByIdAsync: async (id) => nodes[id] || null };
  const ctx = vm.createContext({ figma, __html__: '', console, setTimeout, clearTimeout });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'figma-plugin/code.js'), 'utf8') + '\n;globalThis.__hc = handleCommand;', ctx);
  return { ctx, nodes };
}
const FRAME_NODE = () => ({ id: 'x', name: 'x', strokes: [], strokeWeight: 1, strokeTopWeight: 1, strokeRightWeight: 1, strokeBottomWeight: 1, strokeLeftWeight: 1, strokeAlign: 'CENTER' });
test('P1 플러그인 sides → 면별 굵기 · align INSIDE', async () => {
  const { ctx, nodes } = plugin(); nodes.x = FRAME_NODE();
  await ctx.__hc('set_stroke_color', { nodeId: 'x', color: { r: 0, g: 0, b: 0, a: 1 }, strokeWeight: 2, sides: { top: 6, right: 0, bottom: 3, left: 0 }, align: 'INSIDE' });
  const n = nodes.x;
  assert.deepEqual([n.strokeTopWeight, n.strokeRightWeight, n.strokeBottomWeight, n.strokeLeftWeight, n.strokeAlign], [6, 0, 3, 0, 'INSIDE']);
});
test('P2 [옛 호출] sides·align 없으면 면별·정렬 안 건드림', async () => {
  const { ctx, nodes } = plugin(); nodes.x = FRAME_NODE();
  await ctx.__hc('set_stroke_color', { nodeId: 'x', color: { r: 0, g: 0, b: 0, a: 1 }, strokeWeight: 5 });
  const n = nodes.x;
  assert.deepEqual([n.strokeWeight, n.strokeTopWeight, n.strokeAlign], [5, 1, 'CENTER']);
});
