/* figma-star-export-0912 — 0.9.12 131 SHAPE-STAR-FIGMA-EXPORT-FIXED-FORM-01
 *   별 Figma 내보내기가 «별 하나 고정 꼴»이었다 — 갯수·간격·통통함·꼭짓점 둥글기·평점 칠이 Figma 로 0건.
 * 고침: export-figma-json _shapeFigmaBlock 이 캔버스 SVG(viewBox + polygon 점·단색 칠)를 starViewBox·starPolygons 로 싣고,
 *   figma-renderer 도형 분기가 그것으로 SVG 를 짓는다(꼴 틀린 값은 안 받고 옛 별 하나).
 * 자: 보내는 쪽 = _shapeFigmaBlock 을 _slice-block 으로 잘라 가짜 DOM 으로 «실행» · 렌더러 = 진짜 sangpe_to_figma.mjs + 기록하는 가짜 figma_cmd.mjs. ⛔실 Figma 0.
 * 칸
 *   S1 보내는 쪽 — viewBox·polygon 점·단색 칠 그대로(url(#…) 칠은 안 싣는다) · S1b [지킴] 옛 별 하나 = 키 0(옛 바이트)
 *   S2 렌더러 — polygon 3 · 별마다 칠 · S2b [지킴] 키 없으면 옛 별 하나 · 꼴 틀린 points 는 안 꽂는다
 * 양성대조: _patches/controls/STAR-CTL.patch(고친 두 줄 되돌림) → S1·S2 빨강 · S1b·S2b 초록.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { mkTmpRoot } from './_tmproot.js';
const require = createRequire(import.meta.url);
const { sliceBlock } = require('./_slice-block.js');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const EXP = fs.readFileSync(path.join(ROOT, 'js/io/export-figma-json.js'), 'utf8');
const OLD = '100,8 122,70 188,70 135,110 155,172 100,132 45,172 65,110 12,70 78,70';

function shapeFn() {
  const document = { getElementById: () => null };
  return new Function('document', 'XMLSerializer', `const _REDACT_COVER = '#4a4a4a'; ${sliceBlock(EXP, 'function _shapeFigmaBlock(')}; return _shapeFigmaBlock;`)(document, class {});
}
function mkStar(vb, polys, ds = {}) {
  const P = polys.map((a) => ({ getAttribute: (k) => (k in a ? a[k] : null) }));
  const svg = { style: { color: '' }, querySelector: () => null, querySelectorAll: (s) => (s === 'polygon' ? P : []), getAttribute: (k) => (k === 'viewBox' ? vb : null) };
  return { id: 'shp_s', dataset: { shapeType: 'star', shapeColor: '#ffcc00', shapeStrokeWidth: '0', ...ds }, style: {}, offsetWidth: 630, offsetHeight: 190,
    parentElement: null, querySelector: (s) => (/svg/.test(s) ? svg : null) };
}

test('S1 보내는 쪽 별 — 캔버스 SVG 의 viewBox·polygon 점·단색 칠 그대로(url 칠은 안 싣는다)', () => {
  const pts = ['100,8 130,60 190,70 100,132 10,70 70,60', '330,8 360,60 420,70 330,132 240,70 300,60', '560,8 590,60 650,70 560,132 470,70 530,60'];
  const el = mkStar('0 0 630 190', [{ points: pts[0], fill: '#ffc107' }, { points: pts[1], fill: 'url(#grad-x)' }, { points: '  ' + pts[2] + '\n' }], { starCount: '3', starInner: '50', starRound: '20' });
  const out = shapeFn()(el);
  assert.equal(out.starViewBox, '0 0 630 190', 'viewBox 가 안 실렸다(별 갯수·간격이 Figma 로 0건)');
  assert.deepEqual(out.starPolygons, [{ points: pts[0], fill: '#ffc107' }, { points: pts[1] }, { points: pts[2] }], 'polygon 점·단색 칠이 그대로 안 실렸다');
});

test('S1b [지킴] 옛 별 하나(기본 viewBox · polygon 1 · 칠 없음 · 옛 점) = 별 키 0(옛 JSON 바이트)', () => {
  const out = shapeFn()(mkStar('0 0 200 190', [{ points: OLD }]));
  assert.equal('starViewBox' in out, false);
  assert.equal('starPolygons' in out, false);
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
const starSvg = (cmds) => cmds.filter((c) => c.cmd === 'create_node_from_svg').map((c) => c.params.svg).find((s) => /<polygon/.test(s)) || '';
const STAR = { type: 'shape', id: 'st', shapeType: 'star', color: '#ffcc00', strokeWidth: 0, width: 630, height: 190 };

test('S2 렌더러 별 — starViewBox·starPolygons 로 SVG(polygon 3 · 별마다 칠)', () => {
  const polys = [{ points: '100,8 190,70 10,70', fill: '#ffc107' }, { points: '330,8 420,70 240,70' }, { points: '560,8 650,70 470,70', fill: 'rgb(158, 158, 158)' }];
  const svg = starSvg(render([{ ...STAR, starViewBox: '0 0 630 190', starPolygons: polys }]));
  assert.match(svg, /viewBox="0 0 630 190"/, '별 viewBox 가 옛 200×190 그대로다');
  assert.equal((svg.match(/<polygon /g) || []).length, 3, '별 갯수가 Figma 로 안 갔다');
  assert.match(svg, /<polygon points="100,8 190,70 10,70" fill="#ffc107"\/><polygon points="330,8 420,70 240,70"\/><polygon points="560,8 650,70 470,70" fill="rgb\(158, 158, 158\)"\/>/);
});

test('S2b [지킴] 키 없으면 옛 별 하나 · 꼴 틀린 값(글자 꽂기)은 안 받는다', () => {
  const old = starSvg(render([STAR]));
  assert.match(old, /viewBox="0 0 200 190"/);
  assert.match(old, new RegExp(`<polygon points="${OLD}"/>`));
  const bad = starSvg(render([{ ...STAR, starViewBox: '0 0 630 190', starPolygons: [{ points: '1,2"/><script>' }] }]));
  assert.match(bad, /viewBox="0 0 200 190"/, '꼴 틀린 points 를 SVG 에 꽂았다');
  assert.doesNotMatch(bad, /script/);
});
