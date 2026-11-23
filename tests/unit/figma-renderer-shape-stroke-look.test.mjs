/* Figma 렌더러 — 도형 «Stroke 설정»(점선·끝·꼭짓점·Miter · 표준 Stroke 단계 3-2) 이 create_node_from_svg 의 SVG 에 실린다
 * 자: figma-renderer-images 와 같은 손(진짜 sangpe_to_figma.mjs + 기록하는 가짜 figma_cmd.mjs). ⛔실 Figma 0 — Figma SVG 가져오기가 stroke-dasharray 를 dashPattern 으로 읽는 것은 Figma 쪽 동작(실기 확인은 지디 게이트).
 * F0 [음성] 필드 없는 도형 = 옛 SVG 문자열 그대로(점선·끝·꼭짓점 글자 0) · F1 사각 점선+bevel+miterlimit = style 에 그대로 · F2 선 끝 butt = <line> 의 round 속성까지 바뀜 · F3 꼴 틀린 값은 안 실음
 * 양성대조(예측): 렌더러의 `+ (_dash ? …` 줄을 빼면 F1 빨강 · F0 초록 */
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
function svgOf(block) {
  const dir = mkTmpRoot('renderer-stroke-look-');
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
const RECT = { type: 'shape', id: 'r1', shapeType: 'rectangle', color: '#cccccc', strokeWidth: 4, rotation: 0, width: 120, height: 80 };

test('F0 [음성] 필드 없음 = 점선·끝·꼭짓점 글자 0', () => {
  const s = svgOf(RECT);
  assert.ok(!/stroke-dasharray|stroke-linejoin|stroke-miterlimit|stroke-linecap/.test(s), s);
});
test('F1 사각 점선 + bevel + miterlimit = SVG style 에 그대로', () => {
  const s = svgOf({ ...RECT, strokeDasharray: '12 8', strokeLinejoin: 'bevel', strokeMiterlimit: 2 });
  assert.match(s, /style="[^"]*stroke-dasharray:12 8;[^"]*stroke-linejoin:bevel;[^"]*stroke-miterlimit:2;/);
});
test('F2 선 끝 butt = svg style + <line> 자기 속성까지', () => {
  const s = svgOf({ ...RECT, id: 'l1', shapeType: 'line', strokeLinecap: 'butt', strokeDasharray: '9 6' });
  assert.match(s, /stroke-linecap:butt;/);
  assert.match(s, /<line [^>]*stroke-linecap="butt"/);
  assert.ok(!/stroke-linecap="round"/.test(s), '★옛 round 속성이 남아 끝 모양을 이긴다');
});
test('F3 꼴 틀린 값은 안 실음(SVG 문자열에 글자를 꽂으므로)', () => {
  const s = svgOf({ ...RECT, strokeDasharray: '1;fill:red', strokeLinejoin: 'zig', strokeLinecap: 'x"y', strokeMiterlimit: 'a' });
  assert.ok(!/stroke-dasharray|stroke-linejoin|stroke-miterlimit|stroke-linecap|fill:red/.test(s), s);
});
