/* Figma 렌더러 — 핀 섹션(0.9.12 ⑦ · Q13 ⓕ) 은 섹션 프레임 높이 = heightPin (블럭 합·바닥보다 우선)
 * 자: figma-renderer-section-height-186 과 같은 손(진짜 sangpe_to_figma.mjs + 기록하는 가짜 figma_cmd.mjs). Figma 실물·clipsContent 는 안 잰다.
 * 양성대조(기대): 렌더러 secH 의 heightPin 분기를 되돌리면 F1·F2 빨강 · F0 은 늘 초록. */
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
  const dir = mkTmpRoot('renderer-pin-');
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
const blocks = [{ type: 'gap', height: 500 }];
const s = (id, box) => ({ id, name: id, background: '#ffffff', blocks, ...box });

test('F0 [음성] heightPin 0/없음 — 186 규칙 그대로(블럭 합+아래여백 · 바닥)', () => {
  const r = render([s('a', { paddingBottom: 40, minHeight: 0, heightPin: 0 }), s('b', { paddingBottom: 0, minHeight: 800 })]);
  assert.deepEqual(r.heights, [540, 800]);
});
const R = render([s('p', { paddingBottom: 40, minHeight: 0, heightPin: 300 }), s('q', { paddingBottom: 0, minHeight: 900, heightPin: 250 }), s('n', { paddingBottom: 0, minHeight: 0 })]);
test('F1 핀이면 섹션 높이 = heightPin(내용 500 · 바닥 900 보다 우선)', () => {
  assert.deepEqual(R.heights, [300, 250, 500]);
  assert.deepEqual(R.map, [300, 250, 500]);
});
test('F2 다음 섹션은 핀 높이 뒤에 온다(sectionGap 100)', () => {
  assert.deepEqual(R.ys, [0, 400, 750]);
});
