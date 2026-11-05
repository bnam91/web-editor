/* collab:seq — 진도와 함께 «그때 서버와 같았던 해시»를 proj_meta 에 남긴다. 다른 필드는 안 날린다. 네트워크 0. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../');
require.cache[require.resolve(path.join(ROOT, 'main/collab/transport.js'))] = {
  id: 'fake-transport', filename: 'fake', loaded: true, exports: { request: async () => ({ status: 200, json: { ok: true } }) },
};
const C = require(path.join(ROOT, 'main/collab/index.js'));
const handlers = {};
let meta = { collabRef: { collabId: 'cb_1', role: 'member', seq: 2, owner: 'a@x.com' } };
C.init({ handle: (ch, fn) => { handlers[ch] = fn; } }, {
  readAuth: () => ({ email: 'b@x.com', sessionToken: 's' }),
  readMeta: () => meta,
  writeMeta: (_id, patch) => { meta = { ...meta, ...patch }; },
});
const seq = (p) => handlers['collab:seq']({}, { projectId: 'proj_1', ...p });

test('해시를 진도와 같이 남기고 ref 의 다른 칸은 그대로다', () => {
  assert.deepEqual(seq({ seq: 3, hashes: { 'p::s': 'h1' } }), { ok: true, seq: 3 });
  assert.deepEqual(meta.collabRef, { collabId: 'cb_1', role: 'member', seq: 3, owner: 'a@x.com', hashes: { 'p::s': 'h1' } });
});

test('해시 없이 온 진도는 앞서 남긴 해시를 안 지운다 · 뒤로 가는 진도는 안 쓴다', () => {
  seq({ seq: 4 });
  assert.equal(meta.collabRef.seq, 4);
  assert.deepEqual(meta.collabRef.hashes, { 'p::s': 'h1' });
  seq({ seq: 1, hashes: { 'p::s': 'old' } });
  assert.equal(meta.collabRef.seq, 4);
  assert.deepEqual(meta.collabRef.hashes, { 'p::s': 'h1' });
});

test('진도가 그대로여도 해시는 쓴다(보류 패치가 진도를 묶을 때) · 해시 없으면 안 쓴다', () => {
  seq({ seq: 4, hashes: { 'p::s': 'h2' } });
  assert.equal(meta.collabRef.seq, 4);
  assert.deepEqual(meta.collabRef.hashes, { 'p::s': 'h2' });
  seq({ seq: 4 });
  assert.deepEqual(meta.collabRef.hashes, { 'p::s': 'h2' });
});

