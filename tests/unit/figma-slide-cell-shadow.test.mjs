/* figma-slide-cell-shadow — SLIDE-CELL-SHADOW-FIGMA-01(현빈 «반드시» · 지디 261121 안B) 피그마에서 슬라이드 칸 그림자가 잘리던 것.
 * 고침: export-figma-json 프레임 슬라이드 칸 block.shadow {y,blur,color} → 렌더러 frame 갈래:
 *   칸 그림자가 있으면 바깥 «슬라이드 그림자 여백»(폭 그대로 · 위아래 pad = max blur+|y| · clipsContent true = 가로만 자름)
 *   안에 슬라이드 프레임(clipsContent false · 그 자리 y=pad) · 칸 프레임에 DROP_SHADOW · 흐름 높이 = 블럭 높이 그대로.
 * 자: 진짜 sangpe_to_figma.mjs + 가짜 figma_cmd.mjs(명령 기록) ⛔실 Figma·REST·토큰 0.
 * R1 그림자 칸 → 감싸개 자리·크기·자름 · 슬라이드 프레임 부모·자리·자르기 끔 · 칸 DROP_SHADOW(옅게 = y 18 · blur 50 · 알파 .22)
 * R2 [지킴] 흐름 높이 — 뒤 블럭 y 가 그림자 있음/없음에서 같다(감싸개가 높이를 늘리지 않음)
 * R3 [지킴] 그림자 없음 → 감싸개 0 · 슬라이드 프레임 옛 인자 그대로(clipsContent 키 0) · set_effects 0
 * 양성대조: _patches/slide-shadow-figma-CTL.patch(pad = 0 — 옛 자름) → R1·R2 빨강(실측).
 * 안 잰 것: 실 Figma 화면(그림자 모양 · CSS blur ↔ Figma radius 같은 수로 보냄).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkTmpRoot } from './_tmproot.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FAKE = `import { appendFileSync } from 'fs';
const a = process.argv; const cmd = a[a.indexOf('--command') + 1]; const p = a[a.indexOf('--params') + 1];
const id = 'n' + process.hrtime.bigint();
appendFileSync(process.env.FAKE_LOG, JSON.stringify({ cmd, params: JSON.parse(p), id }) + '\\n');
console.log(JSON.stringify(cmd === 'get_document_info' ? { children: [] } : { id }));`;
function render(blocks) {
  const dir = mkTmpRoot('renderer-sldshadow-');
  const src = path.join(ROOT, 'figma-renderer');
  for (const f of fs.readdirSync(src)) if (f.endsWith('.mjs')) fs.copyFileSync(path.join(src, f), path.join(dir, f));
  fs.writeFileSync(path.join(dir, 'figma_cmd.mjs'), FAKE);
  const json = path.join(dir, 'd.json'), log = path.join(dir, 'l.log');
  fs.writeFileSync(json, JSON.stringify({ meta: { canvasWidth: 860, theme: { sectionGap: 100 } }, sections: [{ id: 's', name: 's', background: '#ffffff', paddingBottom: 0, minHeight: 0, blocks }] }));
  const r = spawnSync('node', [path.join(dir, 'sangpe_to_figma.mjs'), 'CH', json], { encoding: 'utf8', env: { ...process.env, FAKE_LOG: log } });
  assert.equal(r.status, 0, r.stderr);
  return fs.readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
}
const SOFT = { y: 18, blur: 50, color: 'rgba(0,0,0,0.22)' };
const cell = (id, x, shadow) => ({ x, y: 0, w: 300, block: { type: 'frame', id, width: 300, height: 400, bg: '#e8e8e8', radius: 0, free: true, children: [], ...(shadow ? { shadow } : {}) } });
const slide = (shadow) => ({ type: 'frame', id: 'sld', width: 860, height: 400, bg: '', radius: 0, free: true, clip: true, children: [cell('c0', 0, shadow), cell('c1', 316, shadow), cell('c2', 632, shadow)] });
const NEXT = { type: 'frame', id: 'next', width: 860, height: 50, bg: '#ff0000', radius: 0, free: true, children: [] };
const fr = (cmds, name) => cmds.find((c) => c.cmd === 'create_frame' && c.params.name === name);

test('R1 그림자 칸 → «슬라이드 그림자 여백» 감싸개(가로만 자름) · 슬라이드 프레임 자르기 끔 · 칸 DROP_SHADOW', () => {
  const c = render([slide(SOFT)]);
  const w = fr(c, '슬라이드 그림자 여백'), s = fr(c, 'frame_sld'), c0 = fr(c, 'frame_c0');
  assert.ok(w, '감싸개가 없다(칸 그림자가 슬라이드 프레임에 잘림)');
  assert.deepEqual([w.params.width, w.params.height, w.params.clipsContent], [860, 400 + 2 * 68, true], '감싸개 = 폭 그대로 · 위아래 68 · 자름');
  assert.deepEqual([s.params.parentId, s.params.x, s.params.y, s.params.y - 68 === 0, s.params.clipsContent], [w.id, 0, 68, true, false], '슬라이드 프레임 = 감싸개 안 y=pad · 자르기 끔');
  assert.equal(c0.params.parentId, s.id);
  const fxs = c.filter((x) => x.cmd === 'set_effects');
  assert.equal(fxs.length, 3, '칸 셋 다 그림자');
  const e = fxs.find((x) => x.params.nodeId === c0.id).params.effects[0];
  assert.deepEqual([e.type, e.offset, e.radius, +e.color.a.toFixed(2)], ['DROP_SHADOW', { x: 0, y: 18 }, 50, 0.22]);
  assert.equal(c.find((x) => x.cmd === 'set_fill_color' && x.params.nodeId === w.id)?.params.color.a, 0, '감싸개는 투명');
});

test('R2 [지킴] 흐름 높이 — 뒤 블럭 자리가 그림자 있음/없음에서 같다', () => {
  const a = render([slide(SOFT), NEXT]), b = render([slide(null), NEXT]);
  const ya = fr(a, 'frame_next').params.y, yb = fr(b, 'frame_next').params.y;
  assert.equal(ya, yb, `감싸개가 흐름 높이를 바꿨다 ${ya} ≠ ${yb}`);
  assert.equal(fr(a, '슬라이드 그림자 여백').params.y, fr(b, 'frame_sld').params.y - 68, '감싸개 = 옛 슬라이드 자리에서 pad 위');
});

test('R3 [지킴] 그림자 없음 → 감싸개 0 · 옛 인자 · set_effects 0', () => {
  const c = render([slide(null)]);
  assert.equal(fr(c, '슬라이드 그림자 여백'), undefined);
  const s = fr(c, 'frame_sld');
  assert.equal('clipsContent' in s.params, false, '옛 인자(clipsContent 키 없음)');
  assert.equal(c.filter((x) => x.cmd === 'set_effects').length, 0);
});
