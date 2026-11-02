/* Figma 렌더러 — 섹션 프레임 높이가 아래 여백·바닥(min-height)을 따른다 (시트 186 FIGMA-EXPORT-DROPS-SECTION-PADDING-BOTTOM-01)
 * 까닭: 빌더는 _sectionBox 로 두 칸을 싣는데 렌더러가 height: blockY 로 잘랐다. 앱 실측: 캔버스 900·380 ↔ Figma 300·300.
 * 자: 진짜 sangpe_to_figma.mjs 를 임시 자리에 복사하고 figma_cmd.mjs 만 «기록하는 가짜»로 바꿔 돌린다(ws 안 띄움). Figma 실물은 안 잰다.
 * 변이: secH 를 blockY 로 되돌리면 H1·H2·H3 빨강 · H0 은 늘 초록. */
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
appendFileSync(process.env.FAKE_LOG, JSON.stringify({ cmd, params: JSON.parse(p) }) + '\\n');
console.log(JSON.stringify(cmd === 'get_document_info' ? { children: [] } : { id: 'n' + process.hrtime.bigint() }));`;

function render(sections) {
  const dir = mkTmpRoot('renderer-186-');
  const src = path.join(ROOT, 'figma-renderer');
  for (const f of fs.readdirSync(src)) if (f.endsWith('.mjs')) fs.copyFileSync(path.join(src, f), path.join(dir, f));
  fs.writeFileSync(path.join(dir, 'figma_cmd.mjs'), FAKE);
  const json = path.join(dir, 'd.json'), log = path.join(dir, 'l.log');
  fs.writeFileSync(json, JSON.stringify({ meta: { canvasWidth: 860, theme: { sectionGap: 100 } }, sections }));
  const r = spawnSync('node', [path.join(dir, 'sangpe_to_figma.mjs'), 'CH', json], { encoding: 'utf8', env: { ...process.env, FAKE_LOG: log } });
  assert.equal(r.status, 0, r.stderr);
  const cmds = fs.readFileSync(log, 'utf8').trim().split('\n').map(l => JSON.parse(l));
  return {
    heights: cmds.filter(c => c.cmd === 'resize_node').map(c => c.params.height),
    ys: cmds.filter(c => c.cmd === 'create_frame' && !c.params.parentId).map(c => c.params.y),
    map: r.stdout.split('\n').filter(l => l.startsWith('SECTION_MAP:')).map(l => JSON.parse(l.slice(12)).height),
  };
}
const gap = [{ type: 'gap', height: 300 }];
const s = (id, box) => ({ id, name: id, background: '#ffffff', blocks: gap, ...box });

test('H0 [음성] 두 칸이 0 이거나 없으면(옛 JSON) 블럭 합 그대로', () => {
  const r = render([s('z', { paddingBottom: 0, minHeight: 0 }), s('old', {})]);
  assert.deepEqual(r.heights, [300, 300]);
  assert.deepEqual(r.ys, [0, 400]);
});
const R = render([s('a', { paddingBottom: 80, minHeight: 900 }), s('c', { paddingBottom: 80, minHeight: 0 }), s('t', { paddingBottom: 80, minHeight: 350 }), s('b', { paddingBottom: 0, minHeight: 0 })]);
test('H1 섹션 높이 = max(블럭 합 + 아래 여백, 바닥)', () => {
  assert.deepEqual(R.heights, [900, 380, 380, 300]);
});
test('H2 다음 섹션이 늘어난 높이 뒤에 온다(겹치지 않는다)', () => {
  assert.deepEqual(R.ys, [0, 1000, 1480, 1960]);
});
test('H3 SECTION_MAP 높이(node_map)도 같은 값', () => {
  assert.deepEqual(R.map, [900, 380, 380, 300]);
});
