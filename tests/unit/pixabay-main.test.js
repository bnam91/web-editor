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
  const dir = mkTmpRoot('pxb-'), filePath = path.join(dir, 'pixabay.key.bin'), calls = [], opened = [], inits = [];
  const net = { fetch: async (u, init) => { calls.push(u); inits.push(init); return reply(u, init); } };
  return { filePath, calls, opened, inits, px: createPixabay({ safeStorage: fakeSafe, fs, filePath, net, shell: { openExternal: (u) => opened.push(u) } }) };
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
  /* ★기대 바뀜(보안 리뷰 261120 ⑤ · 매직바이트): 옛 픽스처는 4바이트(PNG 서명 아님) — 이제 첫 바이트가 그 꼴이어야 받는다 → 진짜 PNG 서명 8바이트 + 꼬리 */
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
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

/* 보안 리뷰 261120(지디 · 치명 0) 다섯 고침의 자 — 양성대조 = _patches/free-image-CTL-fetch-defaults.patch(net.fetch 옵션 빼기 → M4 빨강) */
const PNG8 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x24, 0, 0, 0]), Buffer.from('WEBPVP8 ')]);

test('M4 ①②④ 받기 옵션 — 디스크 캐시 0 · 쿠키 0 · 넘겨주기 = error · 시간 상한(검색·그림) · 시간 넘김 = timeout', async () => {
  const s = mk(() => resp(200, { hits: [] }));
  s.px.setKey(KEY);
  await s.px.search({ q: 'cat' });
  const g = mk((u) => resp(200, PNG8, { type: 'image/png', url: u }));
  await g.px.fetchImage('https://cdn.pixabay.com/photo/a.png');
  const all = [...s.inits, ...g.inits];
  assert.equal(all.length, 2, '[전제] 검색 한 번 · 그림 한 번');
  for (const init of all) {
    assert.equal(init?.cache, 'no-store', '★디스크 HTTP 캐시에 키 든 주소를 안 남김');
    assert.equal(init?.credentials, 'omit');
    assert.equal(init?.redirect, 'error', '★넘겨주기 = 거부(SSRF 관례)');
    assert.ok(init?.signal && typeof init.signal.aborted === 'boolean', '★시간 상한 신호');
  }
  const to = mk(() => { const e = new Error('t'); e.name = 'TimeoutError'; throw e; });
  to.px.setKey(KEY);
  assert.deepEqual(await to.px.search({ q: 'cat' }), { ok: false, reason: 'timeout' });
  assert.deepEqual(await to.px.fetchImage('https://pixabay.com/get/a.png'), { ok: false, reason: 'timeout' });
});

test('M5 ③⑤ 그림 — Content-Length 먼저 · 흐름 중 넘으면 끊음 · 첫 바이트 = 그 꼴', async () => {
  let read = 0;
  let { px } = mk((u) => ({ ...resp(200, PNG8, { type: 'image/png', url: u }), headers: { get: (h) => (h.toLowerCase() === 'content-type' ? 'image/png' : h.toLowerCase() === 'content-length' ? String(15 * 1024 * 1024 + 1) : null) }, arrayBuffer: async () => { read++; return PNG8; } }));
  assert.deepEqual(await px.fetchImage('https://pixabay.com/get/a.png'), { ok: false, reason: 'too_big' });
  assert.equal(read, 0, '★Content-Length 가 넘으면 본문을 안 받음');
  let cancelled = false, pulled = 0;
  const chunk = new Uint8Array(4 * 1024 * 1024); chunk.set(PNG8);
  ({ px } = mk((u) => ({ ...resp(200, null, { type: 'image/png', url: u }), body: { getReader: () => ({ read: async () => { pulled++; return pulled > 10 ? { done: true } : { done: false, value: chunk }; }, cancel: async () => { cancelled = true; } }) } })));
  assert.deepEqual(await px.fetchImage('https://pixabay.com/get/a.png'), { ok: false, reason: 'too_big' });
  assert.ok(cancelled && pulled <= 5, `★받는 도중 끊음(읽은 조각 ${pulled})`);
  ({ px } = mk((u) => resp(200, Buffer.from('<svg onload=x>............'), { type: 'image/png', url: u })));
  assert.deepEqual(await px.fetchImage('https://pixabay.com/get/a.png'), { ok: false, reason: 'not_image' }, '★머리말만 png · 첫 바이트 아님');
  ({ px } = mk((u) => resp(200, JPG, { type: 'image/png', url: u })));
  assert.deepEqual(await px.fetchImage('https://pixabay.com/get/a.png'), { ok: false, reason: 'not_image' }, '★머리말 ≠ 실제 꼴');
  for (const [buf, type] of [[PNG8, 'image/png'], [JPG, 'image/jpeg'], [WEBP, 'image/webp']]) {
    ({ px } = mk((u) => resp(200, buf, { type, url: u })));
    assert.equal((await px.fetchImage('https://pixabay.com/get/a')).ok, true, type);
  }
});

test('M6 호스트 — evilpixabay · pixabay.com.evil · 대문자 · 끝 주소 http 강등', async () => {
  const { px, calls } = mk((u) => resp(200, PNG8, { type: 'image/png', url: u }));
  for (const bad of ['https://evilpixabay.com/a.png', 'https://pixabay.com.evil.com/a.png', 'https://xpixabay.com/a.png']) assert.deepEqual(await px.fetchImage(bad), { ok: false, reason: 'blocked' }, bad);
  assert.equal(calls.length, 0);
  assert.equal((await px.fetchImage('https://CDN.PIXABAY.COM/a.png')).ok, true, '대문자 = 같은 호스트(URL 이 소문자로 고침)');
  const down = mk(() => resp(200, PNG8, { type: 'image/png', url: 'http://pixabay.com/a.png' }));
  assert.deepEqual(await down.px.fetchImage('https://pixabay.com/a.png'), { ok: false, reason: 'blocked' }, '★끝 주소 http 강등');
});

test('M7 openSite — 무슨 인자든 고정 두 곳만', () => {
  const { px, opened } = mk();
  for (const w of ['docs', 'register', 'https://evil.example', '../x', null, { url: 'x' }]) px.openSite(w);
  assert.deepEqual([...new Set(opened)].sort(), ['https://pixabay.com/accounts/register/', 'https://pixabay.com/api/docs/']);
  assert.equal(opened.length, 6);
});

test('M8 암호화 불가 → 키 저장 거부 · 파일 0', () => {
  const dir = mkTmpRoot('pxb-noenc-'), filePath = path.join(dir, 'pixabay.key.bin');
  const px = createPixabay({ safeStorage: { ...fakeSafe, isEncryptionAvailable: () => false }, fs, filePath, net: { fetch: async () => { throw new Error('no'); } }, shell: { openExternal: () => {} } });
  const r = px.setKey(KEY); noKey(r, 'set 반환');
  assert.equal(r.ok, false, '★평문 폴백 없음');
  assert.equal(fs.existsSync(filePath), false, '★파일 0');
});
