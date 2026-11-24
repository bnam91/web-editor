/* 표준 Fill F1 — 부품 꼴(_fill-section.js) + 칠 없음('transparent') Figma 길(현빈 GO 261124 · 지디 (ㄱ) · 시트 0.9.14 DS-FILL-STD-SECTION-01)
 *  M1 켬 = .ui-fill[data-part=fill] › .ui-fill-layer[data-fill-index="0"] 하나 · 옛 색 칸 id 그대로 · 눈 막힘(F6 전) · − · 머리 ＋ 없음
 *  M2 칠 없음 = 겹 줄 0 · «칠 없음» 줄 · 머리 ＋(id) · M3 이름칸 Linear/Angular/Image = 읽기 전용 · 단색 = 옛 HEX 바이트 그대로
 *  M4 setFillKindName 단색 복귀 = 읽기 전용 풂
 *  R1 렌더러 'transparent' = 면 fill:none · 선 = 박힌 선 색 · R2 [음성] 알파 0 색 = 옛 SVG 문자열 바이트 그대로(«켬·0%» · 지디 단언)
 * 양성대조(예측): 렌더러 faceFill 의 paint 를 color 로 되돌리면 R1 빨강 · R2 초록 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkTmpRoot } from './_tmproot.js';

const ROOT = process.env.GD1001_ROOT || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const _dir = mkTmpRoot('fill-f1-part-');   // js/*.js 는 node 에선 CommonJS — 임시 .mjs 사본(stroke-look.test 와 같은 손 · 부품은 import 0)
fs.copyFileSync(path.join(ROOT, 'js', 'props', '_fill-section.js'), path.join(_dir, 'fill-section.mjs'));
const { fillSectionHTML, fillHeadToolsHTML, setFillKindName } = await import(pathToFileURL(path.join(_dir, 'fill-section.mjs')).href);
const FIELD = `
    <div class="prop-color-field">
      <div class="prop-color-swatch" style="background:#ff0000"><input type="color" id="shape-color-color" value="#ff0000"></div>
      <input type="text" class="prop-color-hex" id="shape-color-hex" value="FF0000" maxlength="7" aria-label="Color">
      <label class="prop-color-alpha" title="Opacity"><input type="text" class="prop-color-alpha-input" id="shape-color-alpha" value="100" aria-label="Opacity"><span class="prop-color-alpha-suffix">%</span></label>
    </div>`;

test('M1 켬 = 겹 줄 하나 · 옛 id · 눈 막힘 · − · 머리 ＋ 없음', () => {
  const h = fillSectionHTML({ prefix: 'shape-fill', colorHtml: FIELD });
  assert.match(h, /<div class="ui-fill" data-part="fill">/);
  assert.equal((h.match(/class="ui-fill-layer"/g) || []).length, 1);
  assert.match(h, /data-fill-index="0"/);
  for (const id of ['shape-color-color', 'shape-color-hex', 'shape-color-alpha', 'shape-fill-eye', 'shape-fill-remove']) assert.match(h, new RegExp(`id="${id}"`));
  assert.match(h, /id="shape-fill-eye"[^>]*aria-disabled="true"/);
  assert.match(h, /value="FF0000"/);
  assert.equal(fillHeadToolsHTML({ prefix: 'shape-fill', on: true }), '');
});
test('M2 칠 없음 = 겹 줄 0 · «칠 없음» · 머리 ＋', () => {
  const h = fillSectionHTML({ prefix: 'shape-fill', colorHtml: FIELD, on: false });
  assert.doesNotMatch(h, /ui-fill-layer|shape-color-hex|shape-fill-remove/);
  assert.match(h, /data-empty="1"/);
  assert.match(h, /칠 없음/);
  assert.match(fillHeadToolsHTML({ prefix: 'shape-fill', on: false }), /id="shape-fill-add"/);
});
test('M3 이름칸 — 그라데이션·이미지 = 읽기 전용 이름 · 단색 = HEX', () => {
  for (const [k, n] of [['linear', 'Linear'], ['radial', 'Radial'], ['conic', 'Angular'], ['image', 'Image']]) {
    const h = fillSectionHTML({ prefix: 'p', colorHtml: FIELD, kind: k });
    assert.match(h, new RegExp(`id="shape-color-hex" value="${n}" readonly data-fill-kind="${k}"`), k);
  }
  assert.match(fillSectionHTML({ prefix: 'p', colorHtml: FIELD, kind: 'solid' }), /id="shape-color-hex" value="FF0000" maxlength/);
});
test('M4 setFillKindName — 단색 복귀 = 읽기 전용 풂', () => {
  const el = { value: 'FF0000', readOnly: false, dataset: {} };
  setFillKindName(el, 'linear');
  assert.deepEqual([el.value, el.readOnly, el.dataset.fillKind], ['Linear', true, 'linear']);
  setFillKindName(el, 'solid');
  assert.deepEqual([el.readOnly, el.dataset.fillKind], [false, undefined]);
});

const FAKE = `import { appendFileSync } from 'fs';
const a = process.argv; const cmd = a[a.indexOf('--command') + 1]; const p = a[a.indexOf('--params') + 1];
const id = 'n' + process.hrtime.bigint();
appendFileSync(process.env.FAKE_LOG, JSON.stringify({ cmd, params: JSON.parse(p), id }) + '\\n');
console.log(JSON.stringify(cmd === 'get_document_info' ? { children: [] } : { id }));`;
function svgOf(block) {
  const dir = mkTmpRoot('renderer-fill-f1-');
  const src = path.join(ROOT, 'figma-renderer');
  for (const f of fs.readdirSync(src)) if (f.endsWith('.mjs')) fs.copyFileSync(path.join(src, f), path.join(dir, f));
  fs.writeFileSync(path.join(dir, 'figma_cmd.mjs'), FAKE);
  const json = path.join(dir, 'd.json'), log = path.join(dir, 'l.log');
  fs.writeFileSync(json, JSON.stringify({ meta: { canvasWidth: 860, theme: { sectionGap: 100 } }, sections: [{ id: 's', name: 's', background: '#ffffff', paddingBottom: 0, minHeight: 0, blocks: [block] }] }));
  const r = spawnSync('node', [path.join(dir, 'sangpe_to_figma.mjs'), 'CH', json], { encoding: 'utf8', env: { ...process.env, FAKE_LOG: log } });
  assert.equal(r.status, 0, r.stderr);
  const c = fs.readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).find((x) => x.cmd === 'create_node_from_svg');
  assert.ok(c, '[전제] 도형 SVG 를 만들었다');
  return c.params.svg;
}
const SHAPE = { type: 'shape', id: 's1', shapeType: 'rectangle', strokeWidth: 2, rotation: 0, width: 100, height: 100 };
test('R1 칠 없음(transparent) = 면 fill:none · 선 = 박힌 선 색', () => {
  const s = svgOf({ ...SHAPE, color: 'transparent', strokeColor: '#000000' });
  assert.match(s, /fill:none;stroke:#000000;/);
});
test('R2 [음성] 알파 0 색 = 옛 꼴 그대로(켬·0%)', () => {
  const s = svgOf({ ...SHAPE, color: 'rgba(255, 0, 0, 0)' });
  assert.match(s, /style="color:rgba\(255, 0, 0, 0\);stroke-width:2;fill:rgba\(255, 0, 0, 0\);stroke:rgba\(255, 0, 0, 0\);"/);
});

/* F2-2 — banner02 칠 없음(bg 'transparent') = Figma 프레임 칠 투명(옛 hex() 는 # 아닌 글자를 흰색으로 읽어 흰 상자가 갔다) · R4 [음성] 단색 = 옛 명령 그대로
 * 양성대조(예측): 렌더러 banner02 줄의 transparent 갈래를 빼면 R3 빨강 · R4 초록 */
function cmdsOf(block) {
  const dir = mkTmpRoot('renderer-fill-f22-');
  const src = path.join(ROOT, 'figma-renderer');
  for (const f of fs.readdirSync(src)) if (f.endsWith('.mjs')) fs.copyFileSync(path.join(src, f), path.join(dir, f));
  fs.writeFileSync(path.join(dir, 'figma_cmd.mjs'), FAKE);
  const json = path.join(dir, 'd.json'), log = path.join(dir, 'l.log');
  fs.writeFileSync(json, JSON.stringify({ meta: { canvasWidth: 860, theme: { sectionGap: 100 } }, sections: [{ id: 's', name: 's', background: '#ffffff', paddingBottom: 0, minHeight: 0, blocks: [block] }] }));
  const r = spawnSync('node', [path.join(dir, 'sangpe_to_figma.mjs'), 'CH', json], { encoding: 'utf8', env: { ...process.env, FAKE_LOG: log } });
  assert.equal(r.status, 0, r.stderr);
  return fs.readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
}
const BN2 = { type: 'banner02', id: 'b1', bannerW: 780, bannerH: 260, radius: 20, textX: 36, textY: 35, textW: 358, lines: [], imgW: 0 };
const bn2Fill = (cmds) => { const f = cmds.find((c) => c.cmd === 'create_frame' && /^banner02_/.test(c.params.name)); assert.ok(f, '[전제] 배너 프레임'); return cmds.find((c) => c.cmd === 'set_fill_color' && c.params.nodeId === f.id)?.params.color; };
test('R3 banner02 칠 없음(transparent) = 칠 투명(a 0)', () => { assert.equal(bn2Fill(cmdsOf({ ...BN2, bg: 'transparent' })).a, 0); });
test('R4 [음성] banner02 단색 = 옛 hex 그대로', () => { assert.deepEqual(bn2Fill(cmdsOf({ ...BN2, bg: '#ff0000' })), { r: 1, g: 0, b: 0, a: 1 }); });
