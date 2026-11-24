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

/* P3 ★하위 호환(지디 261124 · 미카사 실측: 아이맥 Figma 에 등록된 플러그인 = dev 옛 판 → 새 인자를 «조용히 버림»)
 *   옛 플러그인(dev 11a67a399 의 code.js · sides·align 모름) + 새 렌더러 인자 → 최소 «균일 테두리»(굵기·색)는 그려진다 · 면별은 안 됨(그게 옛 판의 한계 · 릴리스 때 플러그인 갱신 = 시트 210 E) */
test('P3 옛 플러그인(dev) + 새 인자 = 균일 테두리는 그려짐(굵기·색) · 면별은 무시', async () => {
  const { execFileSync } = await import('node:child_process');
  let old;
  try { old = execFileSync('git', ['show', '11a67a399:figma-plugin/code.js'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }); }
  catch (e) { assert.fail('[전제] dev 옛 플러그인을 git 에서 못 꺼냄: ' + e.message); }
  assert.ok(!/strokeTopWeight/.test(old), '[전제] 옛 판은 면별을 모른다');
  const nodes = {};
  const figma = { showUI() {}, ui: { postMessage() {}, onmessage: null }, on() {}, notify() {}, clientStorage: { getAsync: async () => null, setAsync: async () => {} }, currentPage: { appendChild() {} }, getNodeByIdAsync: async (id) => nodes[id] || null };
  const ctx = vm.createContext({ figma, __html__: '', console, setTimeout, clearTimeout });
  vm.runInContext(old + '\n;globalThis.__hc = handleCommand;', ctx);
  nodes.x = FRAME_NODE();
  await ctx.__hc('set_stroke_color', { nodeId: 'x', color: { r: 1, g: 0, b: 0, a: 1 }, strokeWeight: 2, sides: { top: 6, right: 0, bottom: 3, left: 0 }, align: 'INSIDE' });
  const n = nodes.x;
  assert.equal(n.strokes.length, 1, '★옛 플러그인도 선 칠을 단다');
  assert.equal(n.strokeWeight, 2, '★옛 플러그인도 굵기(균일)는 단다');
  assert.deepEqual([n.strokeTopWeight, n.strokeAlign], [1, 'CENTER'], '옛 판은 면별·정렬을 모른다(무시 — 오류 없이)');
});

/* E 단계 5 — 선·화살표 끝점: 보내는 쪽 shapeInner(캔버스 SVG) → 렌더러가 꼴 검사 후 그대로 · 아니면 옛 DEFS */
const ARROW = { type: 'shape', id: 'a1', shapeType: 'arrow', color: '#ff0000', strokeWidth: 3, rotation: 0, width: 200, height: 60 };
const svgOfShape = (b) => render([b]).find((x) => x.cmd === 'create_node_from_svg').params.svg;
test('E0 [음성] shapeInner 없음 = 옛 화살표(선 172 + polygon 170,10 194,20 170,30)', () => {
  const s = svgOfShape(ARROW);
  assert.match(s, /<line x1="10" y1="20" x2="172" y2="20" stroke-linecap="round"\/><polygon points="170,10 194,20 170,30"/);
});
test('E1 shapeInner(원 화살표 시작 · 선 화살표 끝) = 그 SVG · currentColor → 선 색', () => {
  const inner = '<line x1="14" y1="20" x2="194" y2="20" stroke-linecap="butt" data-end-main="1"></line><circle cx="14" cy="20" r="8" fill="currentColor" stroke="none" data-end="1"></circle><polyline points="180,12 194,20 180,28" fill="none" stroke-linejoin="miter" stroke-linecap="butt" data-end="1" stroke-dasharray="none"></polyline>';
  const s = svgOfShape({ ...ARROW, shapeInner: inner });
  assert.ok(s.includes('<circle cx="14" cy="20" r="8" fill="#ff0000"'), s);
  assert.ok(s.includes('<polyline points="180,12 194,20 180,28"'), s);
  assert.ok(!/170,10 194,20 170,30/.test(s), '옛 화살표가 남았다');
});
test('E2 꼴 틀린 shapeInner(스크립트·모르는 속성) = 안 씀 · 옛 화살표', () => {
  for (const bad of ['<script>alert(1)</script>', '<line x1="1" onclick="a"/>', '<image href="x"/>']) {
    const s = svgOfShape({ ...ARROW, shapeInner: bad });
    assert.ok(/170,10 194,20 170,30/.test(s) && !/script|onclick|image/.test(s), bad);
  }
});

/* D 점선 dashPattern(Stroke 마지막 칸 · 지디 261124): CSS dashed = [3w,2w] · dotted = [w,w] · 실선 = 인자 없음(옛 명령) · 플러그인 node.dashPattern · 옛 플러그인 = 무시(실선) */
const dashOf = (cmds) => cmds.filter((c) => c.cmd === 'set_stroke_color').map((c) => c.params.dashPattern ?? null);
test('D1 프레임 dashed 굵기 2 = dashPattern [6,4]', () => { assert.deepEqual(dashOf(render([{ ...FRAME, border: { width: 2, style: 'dashed', color: '#000000' } }])), [[6, 4]]); });
/* ★기대 바뀜(미카사 261124 Figma 실측 · 지디): dotted [w,w]+끝 NONE = 네모 토막 → [0,2w] + strokeCap ROUND(둥근 점) */
const capOf = (cmds) => cmds.filter((c) => c.cmd === 'set_stroke_color').map((c) => c.params.strokeCap ?? null);
test('D2 프레임 dotted 굵기 3 = [0,6] + 끝 ROUND · 그리드 G17 면별 dotted 도 · dashed 는 끝 인자 없음', () => {
  const c3 = render([{ ...FRAME, border: { width: 3, style: 'dotted', color: '#000000' } }]);
  assert.deepEqual([dashOf(c3), capOf(c3)], [[[0, 6]], ['ROUND']]);
  const g = render([{ type: 'generic', kind: 'grid', id: 'g2', width: 300, height: 100, bg: '', radius: 0, svg: '', texts: [], border: { top: { width: 2, style: 'dotted', color: 'rgb(0, 0, 0)' }, right: null, bottom: null, left: null } }]);
  assert.deepEqual([dashOf(g), capOf(g)], [[[0, 4]], ['ROUND']]);
  assert.deepEqual(capOf(render([{ ...FRAME, border: { width: 2, style: 'dashed', color: '#000000' } }])), [null]);
});
test('D6 플러그인 strokeCap ROUND → node.strokeCap · 모르는 값은 안 씀', async () => {
  const { ctx, nodes } = plugin(); nodes.x = { ...FRAME_NODE(), dashPattern: [], strokeCap: 'NONE' };
  await ctx.__hc('set_stroke_color', { nodeId: 'x', color: { r: 0, g: 0, b: 0, a: 1 }, strokeWeight: 2, dashPattern: [0, 4], strokeCap: 'ROUND' });
  assert.deepEqual([nodes.x.dashPattern, nodes.x.strokeCap], [[0, 4], 'ROUND']);
  await ctx.__hc('set_stroke_color', { nodeId: 'x', color: { r: 0, g: 0, b: 0, a: 1 }, strokeWeight: 2, strokeCap: 'X";' });
  assert.equal(nodes.x.strokeCap, 'ROUND', '모르는 값으로 안 덮음');
});
test('D3 [음성] 실선 = dashPattern 인자 없음(옛 명령 글자 그대로)', () => {
  const c = render([{ ...FRAME, border: { width: 3, style: 'solid', color: '#ff0000' } }]).find((x) => x.cmd === 'set_stroke_color');
  assert.equal('dashPattern' in c.params, false);
});
test('D4 플러그인 dashPattern → node.dashPattern', async () => {
  const { ctx, nodes } = plugin(); nodes.x = { ...FRAME_NODE(), dashPattern: [] };
  await ctx.__hc('set_stroke_color', { nodeId: 'x', color: { r: 0, g: 0, b: 0, a: 1 }, strokeWeight: 2, dashPattern: [6, 4] });
  assert.deepEqual(nodes.x.dashPattern, [6, 4]);
});
test('D5 옛 플러그인(dev) + dashPattern = 무시 · 실선으로 그려짐(오류 0)', async () => {
  const { execFileSync } = await import('node:child_process');
  const old = execFileSync('git', ['show', '11a67a399:figma-plugin/code.js'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
  const nodes = {};
  const figma = { showUI() {}, ui: { postMessage() {}, onmessage: null }, on() {}, notify() {}, clientStorage: { getAsync: async () => null, setAsync: async () => {} }, currentPage: { appendChild() {} }, getNodeByIdAsync: async (id) => nodes[id] || null };
  const ctx = vm.createContext({ figma, __html__: '', console, setTimeout, clearTimeout });
  vm.runInContext(old + '\n;globalThis.__hc = handleCommand;', ctx);
  nodes.x = { ...FRAME_NODE(), dashPattern: [] };
  await ctx.__hc('set_stroke_color', { nodeId: 'x', color: { r: 0, g: 0, b: 0, a: 1 }, strokeWeight: 2, dashPattern: [0, 4], strokeCap: 'ROUND' });
  assert.deepEqual([nodes.x.strokeWeight, nodes.x.strokes.length, nodes.x.dashPattern, nodes.x.strokeCap], [2, 1, [], undefined]);   // 옛 플러그인 = 점·끝 둘 다 무시 = 실선(지금 꼴)
});

/* C 도형 선 색(지디 261124 · 실측: 렌더러가 선을 면 색으로 칠함) — strokeColor 있으면 svg stroke = 그 색 · 없으면 옛(면 색) · 꼴 틀리면 옛 · 화살촉 color = 면 색 그대로 */
const RECT = { type: 'shape', id: 'r1', shapeType: 'rectangle', color: '#cccccc', strokeWidth: 4, rotation: 0, width: 120, height: 80 };
const styleOf = (b) => (svgOfShape(b).match(/<svg[^>]*style="([^"]*)"/) || [])[1];
test('C0 [음성] strokeColor 없음 = 옛 글자(stroke = 면 색)', () => { assert.equal(styleOf(RECT), 'color:#cccccc;stroke-width:4;fill:#cccccc;stroke:#cccccc;'); });
test('C1 strokeColor #000000 = stroke 만 검정 · color·fill = 면 색', () => { assert.equal(styleOf({ ...RECT, strokeColor: '#000000' }), 'color:#cccccc;stroke-width:4;fill:#cccccc;stroke:#000000;'); });
test('C2 꼴 틀린 strokeColor = 옛(면 색)', () => { assert.equal(styleOf({ ...RECT, strokeColor: 'red;fill:url(x)' }), 'color:#cccccc;stroke-width:4;fill:#cccccc;stroke:#cccccc;'); });
