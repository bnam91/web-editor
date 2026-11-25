/* FIGMA-ANNOTATION-LINE-ANCHOR-MISSING-01 (0.9.14 row 70 · 미카사 261124 N1 재실기 곁 ③)
 * 증상: 주석 블럭을 Figma 로 보내면 라벨(글·상자)만 나오고 선·앵커 점이 없다.
 * 어디서 빠지나: 보내는 쪽(export-figma-json generic)은 block.svg 에 .annot-svg outerHTML 을 싣는다(.annot-line · .annot-anchor).
 *   받는 쪽 renderer generic 갈래는 kind 'vector' 의 svg 만 create_node_from_svg 로 그렸다 ⇒ kind 'annotation' svg 는 버려졌다.
 * 자: figma-renderer-shape-stroke-look 과 같은 손(진짜 sangpe_to_figma.mjs + 기록하는 가짜 figma_cmd.mjs). ⛔실 Figma 0 — 실기 확인은 미카사.
 * A1 주석 svg = create_node_from_svg 하나(선 polyline + 앵커 circle) · 글보다 «먼저»(층 아래) · 크기 = 블럭 w/h
 * A2 고른 동안만 사는 손잡이(.annot-handle)는 안 그린다
 * A3 [음성] kind 없는 generic svg 는 여전히 안 그린다(겹쳐 그릴 위험 · 별건)
 * 양성대조(예측): 렌더러 조건에서 `|| block.kind === 'annotation'` 을 빼면 A1·A2 빨강 · A3 초록 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkTmpRoot } from './_tmproot.js';

const ROOT = process.env.GD1001_ROOT || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FAKE = `import { appendFileSync } from 'fs';
const a = process.argv; const cmd = a[a.indexOf('--command') + 1]; const p = a[a.indexOf('--params') + 1];
const id = 'n' + process.hrtime.bigint();
appendFileSync(process.env.FAKE_LOG, JSON.stringify({ cmd, params: JSON.parse(p), id }) + '\\n');
console.log(JSON.stringify(cmd === 'get_document_info' ? { children: [] } : { id }));`;
function cmdsOf(block) {
  const dir = mkTmpRoot('renderer-annot-line-');
  const src = path.join(ROOT, 'figma-renderer');
  for (const f of fs.readdirSync(src)) if (f.endsWith('.mjs')) fs.copyFileSync(path.join(src, f), path.join(dir, f));
  fs.writeFileSync(path.join(dir, 'figma_cmd.mjs'), FAKE);
  const json = path.join(dir, 'd.json'), log = path.join(dir, 'l.log');
  fs.writeFileSync(json, JSON.stringify({ meta: { canvasWidth: 860, theme: { sectionGap: 100 } }, sections: [{ id: 's', name: 's', background: '#ffffff', paddingBottom: 0, minHeight: 0, blocks: [block] }] }));
  const r = spawnSync('node', [path.join(dir, 'sangpe_to_figma.mjs'), 'CH', json], { encoding: 'utf8', env: { ...process.env, FAKE_LOG: log } });
  assert.equal(r.status, 0, r.stderr);
  return fs.readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
}
/* 브라우저 outerHTML 꼴(빈 svg 자식도 닫는 꼬리 · annotation-block.js makeAnnotationBlock 의 polyline + _renderAnchorSVG circle) */
const LINE = '<polyline class="annot-line" points="200,80 500,80" fill="none" stroke="#ff3b30" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></polyline>';
const DOT = '<circle class="annot-anchor" cx="200" cy="80" r="5" fill="#ff3b30"></circle>';
const HANDLE = '<circle class="annot-handle" cx="200" cy="80" r="6" fill="#fff" stroke="#1592fe" data-point-idx="0"></circle>';
const ANNOT = { type: 'generic', id: 'N1', kind: 'annotation', width: 860, height: 283, bg: '', radius: 0,
  svg: `<svg class="annot-svg" xmlns="http://www.w3.org/2000/svg">\n      ${LINE}\n      ${DOT}\n    </svg>`,
  texts: [{ t: '라벨', fs: 24, color: '#111111', x: 500, y: 80 }] };

test('A1 주석 svg(선 + 앵커 점) = create_node_from_svg · 글보다 먼저 · 블럭 크기', () => {
  const c = cmdsOf(ANNOT);
  const svgs = c.filter((x) => x.cmd === 'create_node_from_svg');
  assert.equal(svgs.length, 1, '★주석 선·앵커를 그리는 create_node_from_svg 가 없다 — FIGMA-ANNOTATION-LINE-ANCHOR-MISSING-01');
  const s = svgs[0].params.svg;
  assert.ok(s.includes(LINE), '선(polyline.annot-line)이 그대로 실려야 한다');
  assert.ok(s.includes(DOT), '앵커 점(circle.annot-anchor)이 그대로 실려야 한다');
  assert.match(s, /^<svg[^>]*\swidth="860" height="283">/, '뿌리 크기 = 블럭 w/h');
  const frame = c.find((x) => x.cmd === 'create_frame' && x.params.name === 'annotation_N1');
  assert.ok(frame, '[전제] 주석 프레임');
  assert.equal(svgs[0].params.parentId, frame.id, '주석 프레임 안에 그린다');
  const iSvg = c.indexOf(svgs[0]), iTxt = c.findIndex((x) => x.cmd === 'create_text');
  assert.ok(iTxt > iSvg, '선은 라벨 글보다 먼저(층 아래) — 앱에서 .annot-svg 가 .annot-label 앞');
});

test('A2 고른 동안만 사는 손잡이(.annot-handle)는 안 그린다', () => {
  const c = cmdsOf({ ...ANNOT, svg: ANNOT.svg.replace('</svg>', `${HANDLE}</svg>`) });
  const s = c.find((x) => x.cmd === 'create_node_from_svg')?.params.svg || '';
  assert.ok(s.includes(LINE) && s.includes(DOT), '[전제] 선·점은 그린다');
  assert.ok(!/annot-handle/.test(s), `손잡이가 Figma 에 실렸다: ${s}`);
});

test('A3 [음성] kind 없는 generic svg 는 여전히 안 그린다', () => {
  const c = cmdsOf({ ...ANNOT, id: 'g1', kind: '' });
  assert.equal(c.filter((x) => x.cmd === 'create_node_from_svg').length, 0);
});
