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
if (cmd === 'get_node_info') out = { document: { id: 'svgroot', type: 'FRAME', fills: [], children: [{ id: 'vfill', type: 'VECTOR', fills: [{ type: 'SOLID' }], children: [] }, { id: 'vline', type: 'VECTOR', fills: [], children: [] }] }, absoluteBoundingBox: { width: 30, height: 20 } };   // 폭 30 = 85행 W1 자리 셈용(다른 칸은 document 만 봄)
if (cmd === 'set_node_properties') out = process.env.FAKE_OLD ? { id: p.nodeId, visible: true } : { id: p.nodeId, visible: true, fillsVisible: p.fillsVisible !== false };
console.log(JSON.stringify(out));`;
function render(blocks, old, srcDir) {
  const dir = mkTmpRoot('fill-f7-');
  const src = srcDir || path.join(ROOT, 'figma-renderer');
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

/* ── F8(시트 83행 FIGMA-EXPORT-EMPTY-FRAME-COUPON-ZOOM-BRIDGE-01 · 지디 261125) — svg 가 곧 몸인 generic 셋을 렌더러가 그린다
 *   S1 쿠폰·줌·브리지: create_node_from_svg 1 · 부모 = 그 블럭 프레임 · [지킴] vector 그대로 1 · 모달(svg 있어도) 0
 *   S2 숨김: 브리지 = 칠 있는 벡터 fillsVisible:false · 쿠폰 = 걷지 않음(fillsVisible 명령 0 — 스텁 칠을 끄지 않게)
 * 재현(고치기 전 70f325a69 실측): 셋 다 create_node_from_svg 0 · 투명 프레임 하나 · 양성대조: _patches/fill-f8-CTL-svgkinds.patch(_SVG_BODY_KINDS = vector 만) → S1·S2 빨강 */
const SVG8 = '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="120" viewBox="0 0 300 120"><path d="M0 0H300V120H0Z" fill="#12ab34"/></svg>';
const gen = (kind, extra) => ({ type: 'generic', id: kind.slice(0, 2), kind, width: 300, height: 120, bg: '', radius: 0, svg: SVG8, texts: [], ...extra });
for (const kind of ['bridge', 'coupon', 'zoom', 'vector', 'modal']) {
  test(`S1 ${kind} — svg 몸 그림(${kind === 'modal' ? '[지킴] 안 그림' : '1번 · 부모 = 그 프레임'})`, () => {
    const { cmds } = render([gen(kind)]);
    const fr = cmds.find((c) => c.cmd === 'create_frame' && c.params.name === `${kind}_${kind.slice(0, 2)}`);
    const sv = cmds.filter((c) => c.cmd === 'create_node_from_svg');
    assert.ok(fr, '[전제] 블럭 프레임');
    if (kind === 'modal') assert.equal(sv.length, 0, '모달 svg 를 그렸다(겹쳐 그림 위험 · 종전대로 0)');
    else assert.deepEqual(sv.map((c) => c.params.parentId), [fr.id], `${kind} svg 가 그 프레임에 한 번 안 그려졌다(빈 프레임)`);
  });
}
test('S2 숨김 — 브리지 = 칠 벡터 fillsVisible:false · 쿠폰 = 걷지 않음', () => {
  const b = render([gen('bridge', { fillHidden: true })]).cmds, c = render([gen('coupon', { fillHidden: true })]).cmds;
  assert.deepEqual(b.filter((x) => x.cmd === 'set_node_properties' && x.params.fillsVisible === false).map((x) => x.params.nodeId), ['vfill'], '브리지 몸 칠을 안 껐다');
  assert.equal(c.filter((x) => x.cmd === 'set_node_properties' && 'fillsVisible' in x.params).length, 0, '쿠폰을 걸어 칠을 껐다(스텁까지 꺼짐)');
  assert.equal(c.filter((x) => x.cmd === 'create_node_from_svg').length, 1, '[전제] 쿠폰도 그렸다');
});

/* ── F8 ①(시트 81행 · 지디 261125) — 에셋 배경색(bg) = 프레임 자기 칠 · 그림 있으면 그림 = 자식 프레임 imgfill_<id>
 *   A1 ⓐ bg 없는 에셋(그림·빈 칸·크롭·둥글기) = 명령 목록·이름·부모가 «고치기 전 판(4188f69c1 렌더러 · git 에서 읽음)»과 같다(노드 id 뺀 바이트 대조)
 *   A2 빈 칸 + bg = 그 프레임 칠 = bg · 체커 svg 0
 *   A3 그림 + bg = 프레임 칠 bg · 자식 imgfill(부모 = 프레임 · clipsContent true · 둥글기 같음) · set_image_fill = 자식 · 자르기 끔이어도 자식은 자름
 *   A4 ⓑ 크롭 + bg = 자식 하나(imgcrop) · imgfill 0 · 부모 칠 = bg
 *   A5 숨김 = 부모 칠만 fillsVisible:false(그림 자식·크롭 자식 손 0) · 빈 칸 숨김도 체커 0(캔버스 css background-image none)
 * 양성대조: _patches/fill-f8-CTL-assetbg.patch(렌더러 _abg = '') → A2~A5 빨강 · A1 초록 */
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const img = (extra) => ({ type: 'image', id: 'ab', height: 200, sizePct: 100, padX: 0, style: { borderRadius: 0 }, src: PNG, overlayOn: false, ...extra });
const strip = (cmds) => { const ids = new Map(cmds.map((c, i) => [c.id, 'N' + i])); return JSON.stringify(cmds.map((c) => [c.cmd, JSON.stringify(c.params).replace(/"n\d+"/g, (m) => ids.get(m.slice(1, -1)) || m)])); };
const PRE_F8A = '4188f69c1';   // 고치기 전 판(F8 ① 바로 앞) — HEAD 로 두면 커밋 뒤 자기 자신과 비교 = 빈 시험
function oldRenderer() {
  const dir = mkTmpRoot('fill-f8a-old-');
  const ls = spawnSync('git', ['-C', ROOT, 'ls-tree', '--name-only', `${PRE_F8A}:figma-renderer`], { encoding: 'utf8' });
  assert.equal(ls.status, 0, `[전제] 고치기 전 판 ${PRE_F8A} 를 못 읽음(얕은 clone?) — ${ls.stderr}`);
  for (const f of ls.stdout.split('\n').filter((x) => x.endsWith('.mjs'))) {
    const r = spawnSync('git', ['-C', ROOT, 'show', `${PRE_F8A}:figma-renderer/${f}`], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr); fs.writeFileSync(path.join(dir, f), r.stdout);
  }
  return dir;
}
const kidNamed = (cmds, pre) => cmds.filter((c) => c.cmd === 'create_frame' && String(c.params.name).startsWith(pre));
test('A1 ⓐ bg 없는 에셋 = 고치기 전 렌더러와 명령·이름·부모 같음(그림·빈 칸·크롭·둥글기·자르기 끔)', () => {
  const old = oldRenderer();
  for (const b of [img(), img({ src: null }), img({ crop: { x: 0.1, y: 0.1, w: 0.5, h: 0.5 } }), img({ style: { borderRadius: 24 }, clip: false })]) {
    assert.equal(strip(render([b]).cmds), strip(render([b], false, old).cmds), `옛 판과 달라졌다: ${JSON.stringify({ src: !!b.src, crop: !!b.crop, r: b.style.borderRadius })}`);
  }
});
test('A2 빈 칸 + bg = 프레임 칠 bg · 체커 0', () => {
  const { cmds } = render([img({ src: null, bg: '#12ab34' })]);
  const fr = kidNamed(cmds, 'image_ab')[0];
  assert.deepEqual(cmds.filter((c) => c.cmd === 'set_fill_color' && isG(c.params.color)).map((c) => c.params.nodeId), [fr.id], '배경색이 그 프레임에 안 칠해졌다');
  assert.equal(cmds.filter((c) => c.cmd === 'create_node_from_svg').length, 0, '배경색이 있는데 체커를 그렸다(캔버스엔 체커 없음 · D33 b)');
});
test('A3 그림 + bg = 프레임 칠 bg · 그림 = 자식 imgfill(자름 · 둥글기 같음) · 자르기 끔이어도', () => {
  const { cmds } = render([img({ bg: '#12ab34', style: { borderRadius: 24 }, clip: false })]);
  const fr = kidNamed(cmds, 'image_ab')[0], kid = kidNamed(cmds, 'imgfill_ab');
  assert.equal(kid.length, 1, '그림 자식 프레임이 하나가 아니다');
  assert.equal(kid[0].params.parentId, fr.id); assert.equal(kid[0].params.clipsContent, true, '자식이 안 자른다');
  assert.deepEqual([kid[0].params.width, kid[0].params.height], [fr.params.width, fr.params.height], '자식 크기 ≠ 부모');
  assert.deepEqual(cmds.filter((c) => c.cmd === 'set_fill_color' && isG(c.params.color)).map((c) => c.params.nodeId), [fr.id], '배경색이 부모에 안 칠해졌다');
  assert.deepEqual(cmds.filter((c) => c.cmd === 'set_image_fill').map((c) => c.params.nodeId), [kid[0].id], '그림이 자식에 안 갔다(부모에 가면 배경을 갈아 끼움)');
  const rad = cmds.filter((c) => c.cmd === 'set_corner_radius' && c.params.radius === 24).map((c) => c.params.nodeId).sort();
  assert.deepEqual(rad, [fr.id, kid[0].id].sort(), 'ⓒ 둥글기가 부모·자식 둘 다 아니다(자르기 끔이면 자식 모서리가 부모 밖으로)');
});
test('A4 ⓑ 크롭 + bg = 자식 하나(imgcrop) · imgfill 0 · 부모 칠 bg', () => {
  const { cmds } = render([img({ bg: '#12ab34', crop: { x: 0.1, y: 0.1, w: 0.5, h: 0.5 } })]);
  const fr = kidNamed(cmds, 'image_ab')[0];
  assert.equal(kidNamed(cmds, 'imgfill_').length, 0, '크롭 자식이 있는데 그림 자식을 하나 더 만들었다(이중 자식)');
  const cr = kidNamed(cmds, 'imgcrop_ab'); assert.equal(cr.length, 1);
  assert.deepEqual(cmds.filter((c) => c.cmd === 'set_image_fill').map((c) => c.params.nodeId), [cr[0].id]);
  assert.deepEqual(cmds.filter((c) => c.cmd === 'set_fill_color' && c.params.nodeId === fr.id).map((c) => isG(c.params.color)), [true], '부모 칠 = bg 하나(투명 칠이 덮으면 안 됨)');
});
test('A5 숨김 = 부모 칠만 눈 끔(그림·크롭 자식 손 0) · 빈 칸 숨김 체커 0', () => {
  for (const extra of [{}, { src: null }, { crop: { x: 0, y: 0, w: 0.5, h: 0.5 } }]) {
    const { cmds } = render([img({ bg: '#12ab34', fillHidden: true, ...extra })]);
    const fr = kidNamed(cmds, 'image_ab')[0];
    assert.deepEqual(cmds.filter((c) => c.cmd === 'set_node_properties' && c.params.fillsVisible === false).map((c) => c.params.nodeId), [fr.id], `숨김이 부모 칠 하나가 아니다 ${JSON.stringify(extra)}`);
    assert.equal(cmds.filter((c) => c.cmd === 'create_node_from_svg').length, 0);
  }
  assert.equal(render([img({ fillHidden: true })]).cmds.filter((c) => 'fillsVisible' in (c.params || {})).length, 0, '[지킴] bg 없으면 숨김 명령 0');
});

/* ── 미카사 F7/F8 Figma 실기(261125) ① — 아이콘원 «보임» 쪽이 Figma 에서 흰 원
 *   내보내기는 보임 원 색을 계산 style 로 읽어 «rgb(46, 173, 107)» 로 보낸다(9c5baa666 · 2026-06 부터 · F7 회귀 아님 — F7 은 숨김 갈래만 dataset HEX 로 바꿈)
 *   렌더러 아이콘원 갈래의 로컬 hexToRgb 가 HEX 만 읽어 set_fill_color r:null(relay.log) → Figma 흰 칠 · 같은 꼴: 에셋 오버레이 글 색(ovEl.style.color = rgb())
 *   K1 아이콘원 rgb()/rgba()/#hex → 그 색(null 0) · K2 오버레이 글 색 rgb() → 그 색
 * 양성대조: _patches/f7-icon-rgb-CTL.patch(로컬 HEX 파서로 되돌림) → K1·K2 빨강 */
const near = (c, r, g, b, a = 1) => c && [c.r, c.g, c.b, c.a ?? 1].every((v, i) => typeof v === 'number' && Math.abs(v - [r / 255, g / 255, b / 255, a][i]) < 0.01);
for (const [label, bg, rgba] of [['rgb()', 'rgb(46, 173, 107)', [46, 173, 107, 1]], ['rgba() 반투명', 'rgba(46, 173, 107, 0.5)', [46, 173, 107, 0.5]], ['#hex [지킴]', '#2ead6b', [46, 173, 107, 1]]]) {
  test(`K1 아이콘원 보임 색 ${label} → set_fill_color 가 그 색(null 0)`, () => {
    const { cmds } = render([{ type: 'circle', id: 'ic', size: 120, bgColor: bg, src: null }]);
    const fills = cmds.filter((c) => c.cmd === 'set_fill_color').map((c) => c.params.color);
    assert.ok(fills.some((c) => near(c, ...rgba)), `원 칠이 ${bg} 가 아니다: ${JSON.stringify(fills)}`);
    assert.equal(fills.some((c) => [c.r, c.g, c.b].some((v) => v === null || Number.isNaN(v))), false, 'null/NaN 색이 갔다(Figma 흰 칠)');
  });
}
test('K2 에셋 오버레이 글 색 rgb() → create_text fontColor 가 그 색', () => {
  const { cmds } = render([img({ overlayOn: true, overlayText: '오버레이', overlayColor: 'rgb(255, 0, 0)', overlayBg: 0.3 })]);
  const t = cmds.find((c) => c.cmd === 'create_text' && c.params.text === '오버레이');
  assert.ok(t, '[전제] 오버레이 글이 그려졌다');
  assert.ok(near(t.params.fontColor, 255, 0, 0), `오버레이 글 색이 빨강이 아니다: ${JSON.stringify(t.params.fontColor)}`);
});

/* ── F8b(미카사 F7/F8 실기 12k · 지디 OK 261125) — 원·별 스티커가 Figma 빈 프레임
 *   원·네모 = CSS 배경 + 둥글기(svg 0) → 내보내기가 bg·radius·글(.sticker-text)을 실음(DOM D35) · 렌더러는 generic bg 칠·둥글기·글 갈래 그대로
 *   별(톱니) = svg 다각형(class stk-burst) → 렌더러가 그린다(_SVG_BODY_KINDS 에 sticker)
 *   T1 별 svg 1번 그림(부모 = 그 프레임) · T2 [지킴] stk-burst 아닌 스티커 svg = 0 · T3 원 = 프레임 칠 bg(rgb()) + 둥글기
 *   (스티커의 다른 svg — 둘레 글자 등 — 는 내보내기가 안 싣는다: DOM D35)
 * 양성대조: _patches/f8b-CTL-renderer.patch(목록에서 sticker 뺌) → T1 빨강 */
const BURST = '<svg class="stk-burst" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" style="position:absolute;inset:0;width:100%;height:100%;"><polygon points="50,0 61,35 98,35 68,57 79,91 50,70 21,91 32,57 2,35 39,35" fill="#e74c3c"/></svg>';
const stk = (extra) => ({ type: 'generic', id: 'sk', kind: 'sticker', width: 80, height: 80, bg: '', radius: 0, svg: '', texts: [{ t: 'NEW', fs: 14, color: 'rgb(255, 255, 255)', x: 0, y: 0 }], ...extra });
test('T1 별 스티커 svg(stk-burst) = 1번 그림 · 부모 = 그 프레임', () => {
  const { cmds } = render([stk({ svg: BURST })]);
  const fr = cmds.find((c) => c.cmd === 'create_frame' && c.params.name === 'sticker_sk');
  assert.deepEqual(cmds.filter((c) => c.cmd === 'create_node_from_svg').map((c) => c.params.parentId), [fr.id], '별 몸이 안 그려졌다(빈 프레임)');
});
test('T2 [지킴] svg 없는 스티커(원·네모) = svg 그림 0 · 어노 svg 는 여전히 안 그림', () => {
  assert.equal(render([stk({})]).cmds.filter((c) => c.cmd === 'create_node_from_svg').length, 0);
  assert.equal(render([stk({ kind: 'annotation', svg: BURST })]).cmds.filter((c) => c.cmd === 'create_node_from_svg').length, 0, '어노 svg 를 그렸다');
});
test('T3 원 스티커 = 프레임 칠 bg(rgb()) + 둥글기 = 짧은 변 ÷ 2 + 글', () => {
  const { cmds } = render([stk({ bg: 'rgb(231, 76, 60)', radius: 40 })]);
  const fr = cmds.find((c) => c.cmd === 'create_frame' && c.params.name === 'sticker_sk');
  assert.ok(cmds.some((c) => c.cmd === 'set_fill_color' && c.params.nodeId === fr.id && near(c.params.color, 231, 76, 60)), '원 배경색이 안 칠해졌다');
  assert.ok(cmds.some((c) => c.cmd === 'set_corner_radius' && c.params.nodeId === fr.id && c.params.radius === 40), '둥글기 없음');
  assert.ok(cmds.some((c) => c.cmd === 'create_text' && c.params.text === 'NEW'), '글이 없다');
});

/* ── 85행 FIGMA-GENERIC-TEXT-STYLE-LOST-01(미카사 2차 실기) — 쿠폰·스티커 글이 Figma 에서 검정·보통·왼위·작게 · 별 스티커 안쪽 고리 선 없음
 *   G1 generic 글 굵기(fw) → create_text fontWeight·set_font_name 스타일 · [지킴] fw 없으면 400·Regular(옛 그대로)
 *   G2 svg 몸의 vector-effect="non-scaling-stroke" → 속성 빼고 선 굵기를 viewBox 단위로(화면 1.2px · 60px 그림 → 2) · [지킴] 그 속성 없는 svg 는 바이트 그대로
 *   (색·크기·자리·정렬은 내보내기 쪽 = DOM D36)
 * 양성대조: _patches/g85-CTL-renderer.patch(옛 렌더러) → G1·G2 빨강 */
const RING = '<svg class="stk-burst" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="50,0 100,50 50,100 0,50" fill="#e74c3c"/><circle cx="50" cy="50" r="36" fill="none" stroke="#ffffff" stroke-width="1.2" stroke-opacity="0.6" vector-effect="non-scaling-stroke"/></svg>';
test('G1 generic 글 굵기 fw 700 → Bold · [지킴] fw 없으면 Regular 400', () => {
  const { cmds } = render([stk({ texts: [{ t: 'NEW', fs: 14, color: 'rgb(255, 255, 255)', x: 0, y: 20, w: 60, align: 'CENTER', fw: 700 }, { t: '보통', fs: 14, color: '#111111', x: 0, y: 40 }] })]);
  const tx = cmds.filter((c) => c.cmd === 'create_text');
  const ids = Object.fromEntries(tx.map((c) => [c.params.text, c.id]));
  assert.deepEqual(tx.map((c) => [c.params.text, c.params.fontWeight]), [['NEW', 700], ['보통', 400]]);
  const fn = Object.fromEntries(cmds.filter((c) => c.cmd === 'set_font_name').map((c) => [c.params.nodeId, c.params.style]));
  assert.equal(fn[ids['NEW']], 'Bold', 'NEW 가 Bold 가 아니다'); assert.equal(fn[ids['보통']], 'Regular');
  assert.equal(tx[0].params.textAlignHorizontal, 'CENTER');
});
test('G2 non-scaling-stroke 고리 → 속성 빼고 굵기 viewBox 단위(60px 그림 · 1.2 → 2) · [지킴] 없는 svg 바이트 그대로', () => {
  const { cmds } = render([stk({ width: 60, height: 60, svg: RING })]);
  const sv = cmds.find((c) => c.cmd === 'create_node_from_svg').params.svg;
  assert.equal(/vector-effect/i.test(sv), false, 'vector-effect 가 남았다(Figma 가 선을 버림)');
  assert.match(sv, /<circle[^>]*stroke-width="2"[^>]*\/>/, `고리 굵기가 2 가 아니다: ${sv}`);
  assert.match(sv, /<polygon[^>]*fill="#e74c3c"/);
  const plain = render([stk({ width: 60, height: 60, svg: BURST })]).cmds.find((c) => c.cmd === 'create_node_from_svg').params.svg;
  assert.equal(plain.replace(/^<svg[^>]*>/, ''), BURST.replace(/^<svg[^>]*>/, ''), '[지킴] vector-effect 없는 svg 몸이 바뀌었다');
});

/* ── 86행 FIGMA-CANVAS-LAYERS-CONTENT-NOT-EXPORTED-01(+81행 ② 칸마다 배경 · 59dcad090 의 겉 프레임 한 칠은 1×1 만 맞았다)
 *   C1 2×2 칸 · scale 0.5 · 칸마다 자리·칠·둥글기 · 레이어(도형·글·그림) 칸마다 되풀이 · 글 크기 × scale
 *   C2 숨김 = 칸 칠 4개만 눈 끔 · C3 [지킴] 심플 card-grid 겉 프레임 옛 투명 · 둥글기·숨김 명령 0
 * 양성대조: _patches/c86-CTL-renderer.patch(옛 렌더러) → C1·C2 빨강 */
const PNG1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const CL = { type: 'canvas-layers', id: 'cv', scale: 0.5, width: 372, height: 306,
  grid: { cols: 2, rows: 2, gap: 12, cellW: 360, cellH: 300, radius: 12, padX: 0, bg: '#12ab34' },
  layers: [{ type: 'shape', x: 20, y: 20, w: 120, h: 80, color: '#ff0000', radius: 8 }, { type: 'text', x: 30, y: 150, w: 260, h: 40, content: '레이어 글', fontSize: 28, color: '#000000', fontWeight: '700', align: 'center' }, { type: 'image', x: 200, y: 20, w: 100, h: 100, src: PNG1 }] };
test('C1 레이어 모드 2×2 · scale 0.5 → 칸 4 · 칸마다 칠·둥글기 · 레이어 셋 칸마다 · 글 크기 × scale', () => {
  const { cmds } = render([CL]);
  const outer = cmds.find((c) => c.cmd === 'create_frame' && c.params.name === 'canvas_cv');
  const cells = cmds.filter((c) => c.cmd === 'create_frame' && /^cell_\d_\d$/.test(c.params.name));
  assert.equal(cells.length, 4, '칸이 4 가 아니다');
  assert.deepEqual(cells.map((c) => [c.params.parentId === outer.id, c.params.x, c.params.y, c.params.width, c.params.height, c.params.clipsContent]),
    [[true, 0, 0, 180, 150, true], [true, 186, 0, 180, 150, true], [true, 0, 156, 180, 150, true], [true, 186, 156, 180, 150, true]], '칸 자리·크기(× 0.5 · 틈 12)');
  for (const cl of cells) {
    assert.ok(cmds.some((c) => c.cmd === 'set_fill_color' && c.params.nodeId === cl.id && isG(c.params.color)), '칸 칠 = 초록 아님');
    assert.ok(cmds.some((c) => c.cmd === 'set_corner_radius' && c.params.nodeId === cl.id && c.params.radius === 6), '칸 둥글기 12×0.5');
  }
  assert.equal(cmds.filter((c) => c.cmd === 'create_frame' && c.params.name === 'layer_0_shape').length, 4, '도형 레이어가 칸마다 아님');
  const tx = cmds.filter((c) => c.cmd === 'create_text' && c.params.text === '레이어 글');
  assert.deepEqual([tx.length, tx[0].params.fontSize, tx[0].params.fontWeight, tx[0].params.textAlignHorizontal], [4, 14, 700, 'CENTER']);
  assert.equal(cmds.filter((c) => c.cmd === 'set_image_fill').length, 4, '그림 레이어 칠이 칸마다 아님');
  assert.equal(cmds.some((c) => c.cmd === 'set_fill_color' && c.params.nodeId === outer.id && isG(c.params.color)), false, '겉 프레임에 칠(틈까지 칠함 = 59dcad090 꼴)');
});
test('C2 숨김 = 칸 칠만 눈 끔(4) · 겉·레이어 손 0', () => {
  const { cmds } = render([{ ...CL, grid: { ...CL.grid, bgHidden: true } }]);
  const cells = new Set(cmds.filter((c) => c.cmd === 'create_frame' && /^cell_/.test(c.params.name)).map((c) => c.id));
  const hid = cmds.filter((c) => c.cmd === 'set_node_properties' && c.params.fillsVisible === false).map((c) => c.params.nodeId);
  assert.equal(hid.length, 4); assert.ok(hid.every((h) => cells.has(h)), '칸 밖 칠을 껐다');
});
const CG = { type: 'card-grid', id: 'cv', cards: [], gridCols: 1, cardGap: 10, canvasW: 360, canvasH: 300, radius: 16, imgRatio: 75, cardMode: 'simple', textBg: '#cccccc', labelPos: 'below', height: 300 };
test('C3 [지킴] 심플 card-grid 겉 프레임 옛 투명 · 둥글기·숨김 명령 0', () => {
  const { cmds } = render([CG]);
  const wr = cmds.find((c) => c.cmd === 'create_frame' && c.params.name === 'card-grid_cv');
  assert.deepEqual(cmds.filter((c) => c.cmd === 'set_fill_color' && c.params.nodeId === wr.id).map((c) => c.params.color), [{ r: 1, g: 1, b: 1, a: 0 }]);
  assert.equal(cmds.filter((c) => (c.cmd === 'set_corner_radius' || c.cmd === 'set_node_properties') && c.params.nodeId === wr.id).length, 0);
});

/* ── 85행 미카사 3차 T1 — 쿠폰 «12»→«1/2» 꺾임: 한 줄 글을 앱 DOM 폭으로 고정 + HEIGHT 라 Figma 글꼴 폭이 넘침
 *   W1 한 줄·가운데 → width 안 줌 · WIDTH_AND_HEIGHT · 잰 폭(가짜 30) 기준 가운데로 move_node(x = tx + (w-30)/2)
 *   W2 [지킴] 여러 줄 → width 고정 · HEIGHT · move 0 · W3 한 줄·왼쪽 → width 안 줌 · move 0
 * 양성대조: _patches/w85-CTL-renderer.patch(옛 렌더러) → W1·W3 빨강 */
const tx1 = (extra) => stk({ texts: [{ t: '12', fs: 40, color: '#ffffff', x: 100, y: 10, w: 50, align: 'CENTER', fw: 700, ...extra }] });
test('W1 한 줄·가운데 글 → 폭 고정 안 함 · WIDTH_AND_HEIGHT · 가운데 자리 맞춤', () => {
  const { cmds } = render([tx1({})]);
  const ct = cmds.find((c) => c.cmd === 'create_text' && c.params.text === '12');
  assert.equal('width' in ct.params, false, '한 줄 글에 폭을 고정했다(꺾임)'); assert.equal(ct.params.textAutoResize, 'WIDTH_AND_HEIGHT');
  const mv = cmds.find((c) => c.cmd === 'move_node' && c.params.nodeId === ct.id);
  assert.ok(mv, '가운데 자리 맞춤(move_node)이 없다'); assert.equal(mv.params.x, Math.round(100 + (50 - 30) / 2)); assert.equal(mv.params.y, 10);
});
test('W2 [지킴] 여러 줄 글 → 폭 고정 · HEIGHT · move 0', () => {
  const { cmds } = render([tx1({ t: '첫 줄\n둘째 줄' })]);
  const ct = cmds.find((c) => c.cmd === 'create_text' && c.params.text.startsWith('첫 줄'));
  assert.deepEqual([ct.params.width, ct.params.textAutoResize], [50, 'HEIGHT']);
  assert.equal(cmds.filter((c) => c.cmd === 'move_node' && c.params.nodeId === ct.id).length, 0);
});
test('W3 한 줄·왼쪽 글 → 폭 고정 안 함 · move 0(왼쪽 기준 = 처음 자리 그대로)', () => {
  const { cmds } = render([tx1({ align: 'LEFT' })]);
  const ct = cmds.find((c) => c.cmd === 'create_text' && c.params.text === '12');
  assert.deepEqual(['width' in ct.params, ct.params.textAutoResize, ct.params.x], [false, 'WIDTH_AND_HEIGHT', 100]);
  assert.equal(cmds.filter((c) => c.cmd === 'move_node' && c.params.nodeId === ct.id).length, 0);
});

/* ── 71행 FIGMA-FRAME-BG-IMAGE-MISSING-01 — 프레임 배경 그림(bgImg) → Figma
 *   B1 색 없음 = 프레임 칠 = 그림 · contain = FIT · B2 색 있음 = 자식 bgimg_(같은 둥글기) 에 그림 · 프레임은 색 · B3 [지킴] bgImg 없음·data: 아님 = 그림 명령 0
 * 양성대조: _patches/b71-CTL-renderer.patch(옛 렌더러) → B1·B2 빨강 */
const FR = (extra) => ({ type: 'frame', id: 'fb', width: 300, height: 200, bg: '', radius: 12, free: true, children: [], ...extra });
test('B1 색 없는 프레임 + 그림 → 프레임 칠 = 그림 · contain = FIT', () => {
  const { cmds } = render([FR({ bgImg: PNG1, bgSize: 'contain' })]);
  const fr = cmds.find((c) => c.cmd === 'create_frame' && c.params.name === 'frame_fb');
  assert.deepEqual(cmds.filter((c) => c.cmd === 'set_image_fill').map((c) => [c.params.nodeId, c.params.scaleMode]), [[fr.id, 'FIT']]);
});
test('B2 색 있는 프레임 + 그림 → 자식 bgimg_ 에 그림(같은 둥글기) · 프레임 = 색', () => {
  const { cmds } = render([FR({ bg: '#12ab34', bgImg: PNG1 })]);
  const fr = cmds.find((c) => c.cmd === 'create_frame' && c.params.name === 'frame_fb');
  const bi = cmds.find((c) => c.cmd === 'create_frame' && c.params.name === 'bgimg_fb');
  assert.ok(bi && bi.params.parentId === fr.id, '그림 자식이 없다');
  assert.deepEqual(cmds.filter((c) => c.cmd === 'set_image_fill').map((c) => [c.params.nodeId, c.params.scaleMode]), [[bi.id, 'FILL']]);
  assert.ok(cmds.some((c) => c.cmd === 'set_fill_color' && c.params.nodeId === fr.id && isG(c.params.color)), '프레임 색이 없어졌다');
  assert.ok(cmds.some((c) => c.cmd === 'set_corner_radius' && c.params.nodeId === bi.id && c.params.radius === 12));
});
test('B3 [지킴] bgImg 없음·data: 아님 = 그림 명령 0 · 자식 0', () => {
  for (const b of [FR({}), FR({ bgImg: 'goya-asset://p/x.png' })]) {
    const { cmds } = render([b]);
    assert.equal(cmds.filter((c) => c.cmd === 'set_image_fill' || (c.cmd === 'create_frame' && /^bgimg_/.test(c.params.name))).length, 0);
  }
});
