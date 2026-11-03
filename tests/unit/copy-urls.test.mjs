/* 복제본 goya-asset URL 재매핑 — canvas 와 scratchpad 매니페스트 둘 다 (S3 market ①) */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { rewriteProjectCopyUrls } = require('../../main/project-store/copy-urls.js');

const proj = () => ({ pages: [{ id: 'p1', canvas: '<img src="goya-asset://proj_1/a.png"><img src="goya-asset://proj_9/b.png">', scratchpad: [{ id: 's', src: 'goya-asset://proj_1/s.png' }, { id: 'd', src: 'data:image/png;base64,AA' }, { id: 'o', src: 'goya-asset://proj_9/o.png' }] }, { id: 'p2', canvas: 'x' }, null] });

test('canvas·scratchpad 의 원본 id 만 새 id 로', () => {
  const p = proj(); rewriteProjectCopyUrls(p, 'proj_1', 'proj_2');
  assert.equal(p.pages[0].canvas, '<img src="goya-asset://proj_2/a.png"><img src="goya-asset://proj_9/b.png">');
  assert.deepEqual(p.pages[0].scratchpad.map((x) => x.src), ['goya-asset://proj_2/s.png', 'data:image/png;base64,AA', 'goya-asset://proj_9/o.png']);
});
test('음성: 앞자리만 같은 다른 id 는 안 건드린다, pages 없어도 안 던진다', () => {
  const p = { pages: [{ canvas: 'goya-asset://proj_12/a.png', scratchpad: [{ src: 'goya-asset://proj_12/s.png' }] }] };
  rewriteProjectCopyUrls(p, 'proj_1', 'proj_2');
  assert.equal(p.pages[0].canvas, 'goya-asset://proj_12/a.png'); assert.equal(p.pages[0].scratchpad[0].src, 'goya-asset://proj_12/s.png');
  assert.doesNotThrow(() => rewriteProjectCopyUrls({}, 'a', 'b'));
});
