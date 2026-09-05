/* 단위 — main/report/queue.js 의 «주소 폴백».
 * ★이 테스트가 지키는 것: 「정본 라우트가 아직 없을 때 신고가 조용히 사라지지 않는가」.
 *   실측(2026-09-05) POST /api/report = 404 not_found(message 없음, 라우팅 404) ·
 *                    POST /api/license/report = 400 empty_text(message 있음, 핸들러 살아 있음).
 *   폴백이 없으면 큐는 404 를 «일시적 실패»로 보고 영원히 재시도만 한다 — 현빈은 0건을 받는다.
 * ⛔실제 소스 모듈을 require 한다. fetch 만 갈아끼워 «주소»를 잰다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require_ = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const Q = require_(path.join(__dirname, '../../main/report/queue.js'));

/** @param {(url:string)=>{status:number,json:any}} handler */
function withFetch(handler, fn) {
  const orig = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (url) => {
    seen.push(String(url));
    const r = handler(String(url));
    return { status: r.status, json: async () => r.json };
  };
  Q._resetPathPref();
  return Promise.resolve(fn(seen)).finally(() => { globalThis.fetch = orig; Q._resetPathPref(); });
}

const ROUTING_404 = { status: 404, json: { ok: false, error: 'not_found' } };          // message «없음»
const HANDLER_404 = { status: 404, json: { ok: false, error: 'not_found', message: '찾을 수 없습니다' } };

test('Q1 ★라우팅 404 면 alias 로 넘어간다 — 안 넘어가면 신고가 한 건도 안 간다', () =>
  withFetch(u => (u.endsWith('/api/report') ? ROUTING_404 : { status: 200, json: { ok: true } }), async (seen) => {
    const r = await Q._postReport({ text: 'x' });
    assert.equal(r.status, 200);
    assert.equal(seen.length, 2);
    assert.ok(seen[0].endsWith('/api/report'), seen[0]);
    assert.ok(seen[1].endsWith(Q.ALIAS_PATH), seen[1]);
  }));

test('Q2 ★핸들러가 «말과 함께» 낸 404 는 alias 로 안 넘긴다 — 같은 신고가 두 번 들어간다', () =>
  withFetch(() => HANDLER_404, async (seen) => {
    const r = await Q._postReport({ text: 'x' });
    assert.equal(r.status, 404);
    assert.equal(seen.length, 1, '두 번 보냈다: ' + seen.join(', '));
  }));

test('Q3 정본이 살아 있으면 alias 를 두드리지 않는다', () =>
  withFetch(() => ({ status: 200, json: { ok: true } }), async (seen) => {
    await Q._postReport({ text: 'x' });
    assert.equal(seen.length, 1);
    assert.ok(seen[0].endsWith('/api/report'));
  }));

test('Q4 한 번 통한 주소는 기억한다 — 매 건 왕복 두 번 하지 않는다', () =>
  withFetch(u => (u.endsWith('/api/report') ? ROUTING_404 : { status: 200, json: { ok: true } }), async (seen) => {
    await Q._postReport({ text: 'a' });
    await Q._postReport({ text: 'b' });
    assert.equal(seen.length, 3, seen.join(', '));            // 1차: 정본+alias, 2차: alias 만
    assert.ok(seen[2].endsWith(Q.ALIAS_PATH), seen[2]);
  }));

test('Q5 둘 다 404 면 «일시적 실패»로 남는다(버리지 않는다)', () =>
  withFetch(() => ROUTING_404, async () => {
    const r = await Q._postReport({ text: 'x' });
    assert.equal(r.status, 404);   // PERMANENT 집합에 404 가 없으므로 flush 는 큐에 남긴다
  }));

/* ★Q6 — 위 5개는 postReport «단독»을 잰다. 실제 배선(flush → postReport)이 끊겨도
   그것들은 전부 초록이다(변이 N1 이 살아남는 것으로 실측). 그래서 «큐를 실제로 비우는»
   경로를 한 번 통째로 돌린다. 이게 없으면 「고쳤다」가 증명되지 않는다. */
import fs from 'fs';
import os from 'os';

test('Q6 ★flush 가 실제로 alias 로 보낸다 — 배선까지 잰다', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rq-'));
  Q.init({ userDataDir: dir, apiBase: 'https://example.test', readAuth: () => null, log: () => {} });
  Q.enqueue({ app: 'goditor', type: 'bug', text: '내보내기가 안 됩니다', errors: [{ level: 'app', msg: '[export-fail] k=fail n=1/3' }] });

  const orig = globalThis.fetch;
  const seen = [];
  let bodySeen = null;
  globalThis.fetch = async (url, opt) => {
    seen.push(String(url));
    bodySeen = JSON.parse(opt.body);
    return String(url).endsWith('/api/report')
      ? { status: 404, json: async () => ({ ok: false, error: 'not_found' }) }        // 라우팅 404(실측 꼴)
      : { status: 200, json: async () => ({ ok: true, message: '접수했습니다' }) };
  };
  Q._resetPathPref();
  try {
    const r = await Q.flush();
    assert.equal(r.sent, 1, '보내지 못했다 — ' + JSON.stringify(r));
    assert.equal(r.left, 0, '큐에 남았다');
    assert.ok(seen.some(u => u.endsWith(Q.ALIAS_PATH)), 'alias 를 안 두드렸다: ' + seen.join(', '));
    // ★신고에 실린 [export-fail] 기록이 «그대로» 서버로 간다 — 이게 이번 작업의 도달 경로다.
    assert.equal(bodySeen.errors[0].msg, '[export-fail] k=fail n=1/3');
  } finally {
    globalThis.fetch = orig; Q._resetPathPref();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
