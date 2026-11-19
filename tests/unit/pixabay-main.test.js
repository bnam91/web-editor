/* pixabay-main — t13A-06 main/pixabay.js(키 암호 보관 · 검색·그림 받기는 main) · 실키·실호출 0(가짜 safeStorage · 가짜 net)
 * M1 키: 꼴 틀림 거절 · 저장 뒤 status = ••••끝4 · 파일에 평문 없음 · ★반환값·console 어디에도 전체 키 없음
 * M2 검색: 키 없음 = no_key · 있으면 net 에만 key= 로 실림 · 429 = rate_limited · 400 = bad_key · 반환에 키·주소 없음 · 조건은 main 이 다시 조임
 * M3 그림 받기: pixabay https 만 · http/남의 호스트/넘겨받은 끝 주소가 남이면 blocked · 그림 아님 = not_image · 15MB 넘음 = too_big · 맞으면 data URL
 * 양성대조: _patches/free-image-CTL-key-in-reply.patch(검색 오류에 요청 주소를 실음) → M2 빨강
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { mkTmpRoot } = require('./_tmproot.js');
const { createPixabay } = require('../../main/pixabay.js');

const KEY = '12345678-fakepixabaykey00';
const fakeSafe = { isEncryptionAvailable: () => true, encryptString: (s) => Buffer.concat([Buffer.from('ENC1'), Buffer.from(s, 'utf8').reverse()]), decryptString: (b) => Buffer.from(b.subarray(4)).reverse().toString('utf8') };
const resp = (status, body, { type = 'application/json', url = '' } = {}) => ({ status, ok: status >= 200 && status < 300, url, headers: { get: (h) => (h.toLowerCase() === 'content-type' ? type : null) }, json: async () => body, arrayBuffer: async () => (Buffer.isBuffer(body) ? body : Buffer.from(String(body))) });
function mk(reply = () => resp(200, { hits: [] })) {
  const dir = mkTmpRoot('pxb-'), filePath = path.join(dir, 'pixabay.key.bin'), calls = [], opened = [];
  const net = { fetch: async (u) => { calls.push(u); return reply(u); } };
  return { filePath, calls, opened, px: createPixabay({ safeStorage: fakeSafe, fs, filePath, net, shell: { openExternal: (u) => opened.push(u) } }) };
}
const logs = [];
for (const k of ['log', 'warn', 'error', 'info']) { const o = console[k]; console[k] = (...a) => { logs.push(a.map(String).join(' ')); return o.apply(console, a); }; }
const noKey = (v, where) => assert.ok(!JSON.stringify(v ?? null).includes(KEY), `전체 키가 ${where} 에 나왔다`);

test('M1 키 보관', () => {
  const { px, filePath } = mk();
  assert.deepEqual(px.setKey('short'), { ok: false, reason: 'bad_format' });
  const r = px.setKey(`  ${KEY} `); noKey(r, 'set 반환');
  assert.equal(r.ok, true);
  assert.deepEqual(px.status(), { hasKey: true, masked: '••••ey00' });
  assert.ok(!fs.readFileSync(filePath).toString('utf8').includes(KEY), '파일 평문');
  noKey(px.status(), 'status');
  assert.deepEqual(px.clear(), { ok: true, hasKey: false, masked: '' });
});

test('M2 검색 — 키는 net 에만', async () => {
  let { px, calls } = mk();
  assert.deepEqual(await px.search({ q: 'cat' }), { ok: false, reason: 'no_key' });
  px.setKey(KEY);
  const r = await px.search({ q: ' 고양이 ', page: 999, per_page: 3, key: 'injected' });
  assert.equal(r.ok, true); noKey(r, '검색 반환');
  assert.equal(calls.length, 1);
  const u = new URL(calls[0]);
  assert.deepEqual([u.origin + u.pathname, u.searchParams.get('key'), u.searchParams.get('q'), u.searchParams.get('page'), u.searchParams.get('per_page'), u.searchParams.getAll('key').length], ['https://pixabay.com/api/', KEY, '고양이', '20', '20', 1]);
  for (const [st, why] of [[429, 'rate_limited'], [400, 'bad_key'], [500, 'http_500']]) {
    ({ px } = mk(() => resp(st, {}))); px.setKey(KEY);
    const e = await px.search({ q: 'x' }); noKey(e, `오류 ${st}`);
    assert.deepEqual(e, { ok: false, reason: why });
  }
  ({ px } = mk(() => { throw new Error('boom ' + 'net'); })); px.setKey(KEY);
  assert.deepEqual(await px.search({ q: 'x' }), { ok: false, reason: 'network' });
  assert.ok(logs.every((l) => !l.includes(KEY)), '★console 에 키 0');
});

test('M3 그림 받기 — pixabay https · 그림 · 상한', async () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  let { px, calls } = mk((u) => resp(200, png, { type: 'image/png', url: u }));
  for (const bad of ['http://pixabay.com/get/a.png', 'https://evil.example/a.png', 'https://pixabay.com.evil.example/a.png', 'javascript:alert(1)', '']) assert.equal((await px.fetchImage(bad)).ok, false, bad);
  assert.equal(calls.length, 0, '막힌 주소는 net 을 안 부른다');
  const ok = await px.fetchImage('https://cdn.pixabay.com/photo/a_1280.png');
  assert.deepEqual(ok, { ok: true, dataUrl: 'data:image/png;base64,' + png.toString('base64') });
  ({ px } = mk(() => resp(200, png, { type: 'image/png', url: 'https://evil.example/x.png' })));
  assert.deepEqual(await px.fetchImage('https://pixabay.com/get/a.png'), { ok: false, reason: 'blocked' }, '넘겨받은 끝 주소');
  ({ px } = mk((u) => resp(200, '<html>', { type: 'text/html', url: u })));
  assert.deepEqual(await px.fetchImage('https://pixabay.com/get/a.png'), { ok: false, reason: 'not_image' });
  ({ px } = mk((u) => resp(200, Buffer.alloc(15 * 1024 * 1024 + 1), { type: 'image/jpeg', url: u })));
  assert.deepEqual(await px.fetchImage('https://pixabay.com/get/a.jpg'), { ok: false, reason: 'too_big' });
});
