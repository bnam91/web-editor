/* load-input-gate-363 — 쓰기 도구는 로드가 끝나기를 기다리고, 안 끝나면 거절한다 · 화면 면 전수
 * 재는 자리 = 서버 디스패처(mcp-project-gate 와 같다). 앱 값은 ~/gd-lane/imac-gd-L1/363d.
 * 변이: _awaitProjectLoaded 호출을 빼면 M1·M2 빨강 | 조건에서 undo 를 빼면 M4 빨강.
 */
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { startHarness } = require('./_mcp-harness');

let H = null; let blocked = false; let polls = 0;
const loadBlocked = async () => { polls++; return blocked; };
before(async () => { H = await startHarness({ activeProject: 'proj_1', confirmProject: true, rawInvoker: { loadBlocked } }); });
after(async () => { if (H) await H.stop(); });

test('M1 막는 동안 쓰기 도구는 기다렸다가 돈다', async () => {
  blocked = true; polls = 0;
  const p = H.call('add_section', {});
  while (polls < 2) await new Promise(r => setTimeout(r, 20));
  blocked = false;
  const r = await p;
  assert.notStrictEqual(r.result && r.result.code, 'project_loading');
  assert.ok(polls >= 2, '★기다리지 않았다');
});

test('M2 [음성] 안 막으면 렌더러에 한 번만 묻고 돈다', async () => {
  blocked = false; polls = 0;
  await H.call('add_section', {});
  assert.strictEqual(polls, 1);
});

test('M3 [음성] 읽기 도구는 안 묻는다', async () => {
  blocked = true; polls = 0;
  await H.call('get_canvas_state', {});
  blocked = false;
  assert.strictEqual(polls, 0);
});

test('M4 되돌리기도 쓰기다(_NON_MUTATING 에 있어도)', async () => {
  blocked = false; polls = 0;
  await H.call('undo_last_mcp_change', {});
  assert.strictEqual(polls, 1);
});

test('C1 body 바로 밑 면은 막는 면이거나 지나가는 면으로 분류돼 있다 — 새 면이 생기면 여기서 빨강', () => {
  const root = path.join(__dirname, '../..');
  const gate = fs.readFileSync(path.join(root, 'js/load-input-gate.js'), 'utf8');
  const surface = /var SURFACE = '([^']+)'/.exec(gate)[1];
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const body = html.slice(html.indexOf('<body'));
  const ids = [...body.matchAll(/^<(?:div|aside|main|header|nav|section)\b[^>]*\bid="([^"]+)"/gm)].map(m => m[1]);
  /* 지나가는 면 = 사람이 답해야 끝나는 창(막으면 못 나간다) */
  const pass = new Set(['figma-upload-modal', 'figma-import-modal', 'preview-overlay', 'preview-topbar', 'preview-navigator', 'anim-gif-modal']);
  const unknown = ids.filter(id => !surface.includes('#' + id) && !pass.has(id));
  assert.deepStrictEqual(unknown, []);
});
