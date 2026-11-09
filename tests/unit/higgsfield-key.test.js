/* higgsfield-key — Higgsfield API 키 암호 보관 (t2-03 · 0.9.11)
 *
 * ★진짜 main/higgsfield-key.js 에 «가짜 safeStorage»(가역 변환 + 머리표)와 임시 폴더를 주입해 돌린다.
 * ★지디 보안 기준: 전체 키가 파일·반환값·IPC 응답·console 어디에도 안 나와야 한다.
 * ⛔진짜 키 없음 — 아래 값은 일부러 가짜다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { mkTmpRoot } = require('./_tmproot.js');   /* ★임시 루트의 임자 = _tmproot.js(치우기도 거기서) */
const { readSrc } = require('./_srcread.js');
const { sliceBlock } = require('./_slice-block.js');
const { createHiggsfieldKey, MAX_LEN } = require('../../main/higgsfield-key.js');

const REPO = path.join(__dirname, '..', '..');
const KEY = 'hf_TESTKEY_abcd1234';
const fakeSafe = (avail = true) => ({
  isEncryptionAvailable: () => avail,
  // 가역 변환: 바이트 뒤집기 + 머리표 — «평문이 그대로 안 남는다»를 잴 수 있게
  encryptString: (s) => Buffer.concat([Buffer.from('ENC1'), Buffer.from(s, 'utf8').reverse()]),
  decryptString: (b) => Buffer.from(b.subarray(4)).reverse().toString('utf8'),
});
function mk(avail) {
  const dir = mkTmpRoot('hfkey-');
  const filePath = path.join(dir, 'higgsfield.key.bin');
  return { dir, filePath, k: createHiggsfieldKey({ safeStorage: fakeSafe(avail), fs, filePath }) };
}
const noKey = (v, where) => assert.ok(!JSON.stringify(v ?? null).includes(KEY), `전체 키가 ${where} 에 나왔다`);

test('H1 set → 파일은 암호 바이트(평문 없음) · status 는 ••••끝4 만', () => {
  const { filePath, dir, k } = mk(true);
  const r = k.set('  ' + KEY + '  ');
  assert.strictEqual(r.ok, true);
  noKey(r, 'set 반환');
  const bytes = fs.readFileSync(filePath);
  assert.ok(!bytes.toString('utf8').includes(KEY), '파일에 평문 키가 있다');
  assert.ok(!bytes.toString('latin1').includes(KEY));
  assert.deepStrictEqual(fs.readdirSync(dir), ['higgsfield.key.bin'], '원자 쓰기 tmp 가 남았다');
  const st = k.status();
  assert.deepStrictEqual(st, { hasKey: true, masked: '••••1234' });
  noKey(st, 'status');
});

test('H2 암호화 불가 → no_encryption 거절 · 파일 없음(평문 폴백 0)', () => {
  const { filePath, dir, k } = mk(false);
  const r = k.set(KEY);
  assert.deepStrictEqual(r, { ok: false, reason: 'no_encryption' });
  assert.strictEqual(fs.existsSync(filePath), false);
  assert.deepStrictEqual(fs.readdirSync(dir), []);
});

test('H3 빈 값·너무 긴 값 거절 · clear 는 파일을 지운다', () => {
  const { filePath, k } = mk(true);
  assert.deepStrictEqual(k.set('   '), { ok: false, reason: 'empty' });
  assert.deepStrictEqual(k.set(undefined), { ok: false, reason: 'empty' });
  assert.deepStrictEqual(k.set('x'.repeat(MAX_LEN + 1)), { ok: false, reason: 'too_long' });
  assert.strictEqual(k.set('x'.repeat(MAX_LEN)).ok, true, '512자는 받는다');
  assert.strictEqual(k.clear().ok, true);
  assert.strictEqual(fs.existsSync(filePath), false);
  assert.deepStrictEqual(k.status(), { hasKey: false, masked: '' });
  assert.strictEqual(k.clear().ok, true, '없는 파일 지우기도 ok');
});

test('H4 registerIpc 핸들러 3개 · 반환값 어디에도 전체 키 없음 · console 에 키 안 찍힘', async () => {
  const { k } = mk(true);
  const h = {};
  k.registerIpc({ handle: (ch, fn) => { h[ch] = fn; } });
  assert.deepStrictEqual(Object.keys(h).sort(), ['higgsfield:key-clear', 'higgsfield:key-set', 'higgsfield:key-status']);
  const logged = [];
  const orig = {};
  for (const m of ['log', 'info', 'warn', 'error', 'debug']) { orig[m] = console[m]; console[m] = (...a) => logged.push(a.map(String).join(' ')); }
  try {
    const outs = [await h['higgsfield:key-set']({}, KEY), await h['higgsfield:key-status']({}),
      await h['higgsfield:key-set']({}, ''), await h['higgsfield:key-clear']({}), await h['higgsfield:key-status']({})];
    outs.forEach((o, i) => noKey(o, `IPC 응답 #${i}`));
    assert.strictEqual(outs[1].masked, '••••1234');
  } finally { Object.assign(console, orig); }
  assert.ok(!logged.join('\n').includes(KEY), 'console 에 키가 찍혔다');
});

test('H5 src-guard — preload 은 원문 getter 없음 · DEFAULT_SETTINGS/FALLBACK 에 키 칸 없음', () => {
  const pre = readSrc(REPO, 'preload.js');
  const m = /higgsfield:\s*\{([\s\S]*?)\n\s*\},/.exec(pre);
  assert.ok(m, 'preload 에 electronAPI.higgsfield 가 없다');
  const names = [...m[1].matchAll(/^\s*(\w+)\s*:/gm)].map((x) => x[1]).sort();
  assert.deepStrictEqual(names, ['clearKey', 'setKey', 'status'], 'higgsfield 브리지에 다른 길이 생겼다(원문 getter?)');
  const chans = [...pre.matchAll(/'higgsfield:[\w-]+'/g)].map((x) => x[0]).sort();
  assert.deepStrictEqual(chans, ["'higgsfield:key-clear'", "'higgsfield:key-set'", "'higgsfield:key-status'"]);

  const main = readSrc(REPO, 'main.js');
  const def = sliceBlock(main, 'const DEFAULT_SETTINGS = {');
  assert.match(def, /higgsfieldModel:\s*''/);
  assert.doesNotMatch(def.replace(/\/\/.*$/gm, ''), /higgsfield(?!Model)/i, 'DEFAULT_SETTINGS 에 Higgsfield 키 칸이 생겼다');
  const store = readSrc(REPO, 'js/settings/settings-store.js');
  assert.match(store, /higgsfieldModel:\s*''/, '렌더러 FALLBACK 에 higgsfieldModel 이 없다');
});
