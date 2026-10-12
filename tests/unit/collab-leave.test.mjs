/* collab-leave — main/collab/index.js leave() (SIX ② · 2026-10-06 · 현빈 「주인이 자기가 올린 걸 못 내린다」).
 *
 * ★고친 결함 둘:
 *   ⑴ 설정 「연결 끊기」는 { collabId } 만 보냈는데 leave() 는 projectId 로만 찾아 «서버를 부르기도 전에» not_linked 로 끝났다
 *      (실측 2026-10-06: leave({collabId}) → not_linked · 서버 호출 0) — 참여자도 못 나갔다.
 *   ⑵ 서버는 주인의 leave 를 owner_cannot_leave 로 거절하고 해산은 action:'disband' 를 명시해야 하는데, 앱이 안 보냈다.
 * ★transport 를 «require 전에» 가짜로 갈아 끼운다(index.js 가 require 시점에 request 를 구조분해한다 — 뒤에 바꾸면 안 먹는다).
 * ⛔네트워크 0.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../');
const calls = [];
let reply = { status: 200, json: { ok: true, left: true } };
require.cache[require.resolve(path.join(ROOT, 'main/collab/transport.js'))] = {
  id: 'fake-transport', filename: 'fake', loaded: true,
  exports: { request: async (p, body) => { calls.push({ p, body: { ...body, sessionToken: body.sessionToken ? '<tok>' : undefined } }); return reply; } },
};
const C = require(path.join(ROOT, 'main/collab/index.js'));
const writes = [];
C.init({ handle() {} }, {
  readAuth: () => ({ email: 'a@x.com', sessionToken: 'secret' }),
  readMeta: (id) => (id === 'proj_1' ? { collabRef: { collabId: 'cb_1', role: 'owner' } } : {}),
  writeMeta: (id, patch) => writes.push({ id, patch }),
});

test('L0 전제 — 가짜 transport 가 실제로 쓰인다(서버 호출이 세어진다)', async () => {
  calls.length = 0; reply = { status: 200, json: { ok: true, left: true } };
  await C.leave({ projectId: 'proj_1' });
  assert.equal(calls.length, 1, '가짜 transport 를 안 탔다 — 이 검사가 헛돈다');
});

test('L1 ★설정 꼴 { collabId } 만 와도 서버를 부른다(옛 판: not_linked · 호출 0)', async () => {
  calls.length = 0; reply = { status: 200, json: { ok: true, left: true } };
  const r = await C.leave({ collabId: 'cb_9' });
  assert.equal(r.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].p, 'leave');
  assert.equal(calls[0].body.collabId, 'cb_9');
  assert.equal(calls[0].body.action, undefined, '참여자 나가기엔 action 이 없다');
});

test('L2 ★주인 해산 — action:\'disband\' 를 «실제로» 싣고, 로컬 연결(collabRef)을 지운다', async () => {
  calls.length = 0; writes.length = 0; reply = { status: 200, json: { ok: true, disbanded: true } };
  const r = await C.leave({ projectId: 'proj_1', collabId: 'cb_1', action: 'disband' });
  assert.deepEqual({ ok: r.ok, disbanded: r.disbanded }, { ok: true, disbanded: true });
  assert.equal(calls[0].body.action, 'disband');
  assert.equal(calls[0].body.collabId, 'cb_1');
  assert.deepEqual(writes, [{ id: 'proj_1', patch: { collabRef: null } }]);
});

test('L3 주인이 action 없이 나가면 서버 reason(owner_cannot_leave)을 «그대로» 돌려준다(삼키지 않는다)', async () => {
  calls.length = 0; writes.length = 0; reply = { status: 403, json: { ok: false, reason: 'owner_cannot_leave' } };
  const r = await C.leave({ projectId: 'proj_1' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'owner_cannot_leave');
  assert.equal(writes.length, 0, '거절당했는데 로컬 연결을 지웠다');
});
