/* put-image-path.test.js — `put_image(path)` 로 «로컬 파일»을 넣는 길. (2026-09-10 현빈 발주)
 * 실행: node --test tests/unit/put-image-path.test.js
 *
 * ★왜 생겼나
 *   클로드앱에 이미지를 «첨부»하면 모델은 그림을 «볼» 뿐 **원본 바이트를 못 얻는다.**
 *   그래서 「이 이미지를 이 블록에 넣어줘」가 **원리적으로 불가능**했다 — 모델이 헤매다 응답이 끊겼다
 *   (현빈 실측 2026-09-10: 1.9MB PNG, `ab_kuxvd_7mo5ror`).
 *   ⇒ 경로를 받아 «앱이 직접» 읽는다. 데이터가 모델 컨텍스트를 통과하지 않는다.
 *
 * ★이 파일이 재는 것
 *   ⑴ 방어선 셋이 «실제로» 막는가 (홈 밖 · 이미지 아님 · 크기)
 *   ⑵ ★그 「막힌다」가 «못 재서»가 아닌가 — 양성대조를 같이 세운다
 *   ⑶ ⛔새 검사기를 짓지 않았는가 — 온전성은 기존 `_assertImageSrcIntact` 가 본다
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { readSrc } = require('./_srcread.js');   // ⛔CRLF — win-portability ①-3

const ROOT = path.join(__dirname, '..', '..');
const SRC = readSrc(ROOT, 'main', 'claude-pm', 'mcp-server.js');

/** 헬퍼를 «소스에서 떼어» 실제로 돌린다. ⛔손으로 베끼면 따로 늙는다. */
function loadHelper() {
  const i = SRC.indexOf('function _imageFileToDataUrl(');
  assert.ok(i > 0, '★_imageFileToDataUrl 이 없다 — 이 검사가 겨누는 대상이 사라졌다');
  let d = 0, st = SRC.indexOf('{', i), end = -1;
  for (let j = st; j < SRC.length; j++) {
    if (SRC[j] === '{') d++;
    else if (SRC[j] === '}') { d--; if (!d) { end = j + 1; break; } }
  }
  const sniffM = SRC.match(/const _IMG_SNIFF = \[[\s\S]*?\n\];/);
  assert.ok(sniffM, '★_IMG_SNIFF 표를 못 찾았다');
  const body = `${sniffM[0]}\n${SRC.slice(i, end)}\nreturn _imageFileToDataUrl;`;
  return new Function('fs', 'os', 'path', body)(fs, os, path);
}
const toDataUrl = loadHelper();
const MAX = 7 * 1024 * 1024;

/* ── 픽스처: 진짜 PNG 1×1 ── */
const PNG1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64');
let tmp;
function fixture(name, buf) {
  if (!tmp) { tmp = fs.mkdtempSync(path.join(os.homedir(), '.gdt-putimg-test-')); }
  const p = path.join(tmp, name);
  fs.writeFileSync(p, buf);
  return p;
}
process.on('exit', () => { try { if (tmp) fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {} });

/* ═══ 본 단언 ═══════════════════════════════════════════════════════════ */

test('P1 ★진짜 PNG 는 dataURL 로 «읽힌다» (양성대조 — 아래 「막힌다」가 늘 막는 게 아님을 보인다)', () => {
  const f = fixture('ok.png', PNG1x1);
  const r = toDataUrl(f, MAX);
  assert.match(r.dataUrl, /^data:image\/png;base64,/, '★PNG 를 못 읽는다');
  assert.equal(r.format, 'image/png');
  assert.equal(r.bytes, PNG1x1.length);
  assert.equal(r.resolvedPath, fs.realpathSync(f));
});

test('P2 ★`~` 를 편다 — 사용자는 「~/Downloads/…」로 말한다', () => {
  const f = fixture('tilde.png', PNG1x1);
  const rel = '~' + f.slice(os.homedir().length);
  const r = toDataUrl(rel, MAX);
  assert.equal(r.resolvedPath, fs.realpathSync(f), '★~ 확장이 안 된다');
});

test('P3 ★★확장자가 아니라 «내용»으로 판정한다 — .png 로 이름만 바꾼 남의 파일', () => {
  /* ⛔이게 이 기능의 제일 큰 위험이다. 확장자를 믿으면 `id_rsa` 를 `key.png` 로 바꿔 읽힌다. */
  const f = fixture('fake.png', Buffer.from('-----BEGIN OPENSSH PRIVATE KEY-----\nAAAA\n'));
  assert.throws(() => toDataUrl(f, MAX), /not an image file/,
    '★확장자만 보고 통과시켰다 — 임의 파일을 읽는 구멍이다');
});

/* 홈 «밖»에 «실재하는» 파일 — 플랫폼별로 고른다(윈도우엔 /etc/hosts 가 없다). */
const OUTSIDE_FILE = (() => {
  const cands = process.platform === 'win32'
    ? [path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'drivers', 'etc', 'hosts'),
       path.join(process.env.SystemRoot || 'C:\\Windows', 'win.ini')]
    : ['/etc/hosts', '/etc/passwd'];
  const hit = cands.find(f => { try { return fs.statSync(f).isFile(); } catch (_) { return false; } });
  assert.ok(hit, `★홈 밖에 «실재하는» 파일을 못 찾았다(${cands.join(', ')}) — 이 대조가 성립하지 않는다`);
  return hit;
})();

test('P4 ★홈 «밖»은 거절한다', () => {
  assert.throws(() => toDataUrl(OUTSIDE_FILE, MAX), /outside home directory|not an image file/,
    '★홈 밖 파일을 읽는다');
  /* ★양성대조 — 위 OUTSIDE_FILE 선정에서 «실재»를 이미 단언했다(없으면 그 자리에서 빨강) */
});

test('P5 ★★링크로 홈 밖을 읽지 못한다 (realpath 로 «편 뒤» 판정)', () => {
  /* ⛔윈도우 이식성(Ⓒ-3): 비승격 윈도우에서 «파일» 심링크는 EPERM 이다.
     ⇒ ★«디렉터리 정션»을 쓴다(맥에서는 type 이 무시되고 그냥 심링크로 만들어진다).
     ⛔그리고 실패를 «조용히 return» 하지 않는다 — 그러면 윈도우에서 이 검사가 영영 안 돈다. */
  fixture('seed.png', PNG1x1);            // tmp 를 확실히 만든다
  const outsideDir = path.dirname(OUTSIDE_FILE);
  const link = path.join(tmp, 'escape-dir');
  fs.symlinkSync(outsideDir, link, 'junction');   // ★실패하면 «던진다»
  const viaLink = path.join(link, path.basename(OUTSIDE_FILE));
  assert.throws(() => toDataUrl(viaLink, MAX), /outside home directory|not an image file/,
    '★홈 «안»의 링크로 밖을 읽었다 — realpath 를 안 편 것이다');
});

test('P6 ★크기 상한 — 기존 _PUT_IMAGE_MAX 와 «같은 자»를 쓴다', () => {
  const f = fixture('big.png', Buffer.concat([PNG1x1, Buffer.alloc(2048)]));
  const tiny = 64;   // base64 64자 ≈ 48바이트
  assert.throws(() => toDataUrl(f, tiny), /too large/, '★상한을 안 본다');
  /* ★음성대조 — 넉넉한 상한에서는 통과해야 한다(늘 막는 게 아님) */
  assert.ok(toDataUrl(f, MAX).dataUrl, '★넉넉한 상한에서도 막는다');
});

test('P7 ★없는 파일·디렉터리·빈 파일을 «각각» 구분해 거절한다', () => {
  assert.throws(() => toDataUrl(path.join(os.homedir(), '__no_such__.png'), MAX), /file not found/);
  assert.throws(() => toDataUrl(os.homedir(), MAX), /not a file/);
  assert.throws(() => toDataUrl(fixture('empty.png', Buffer.alloc(0)), MAX), /empty file/);
});

test('P8 ★webp 흉내(RIFF)만으로는 안 통과한다 — wav·avi 도 RIFF 다', () => {
  const riff = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE')]);
  assert.throws(() => toDataUrl(fixture('fake.webp', riff), MAX), /not an image file/,
    '★RIFF 만 보고 통과시켰다');
});

/* ═══ 배선 — 도구가 실제로 그 길을 쓰는가 ═════════════════════════════════ */

test('W1 ★put_image 가 `path` 를 받고, 기존 `image` 와 «배타»다', () => {
  assert.match(SRC, /path: imgPath/, '★핸들러가 path 를 안 받는다');
  assert.match(SRC, /pass either image \(data URL\) or path \(local file\) — not both/,
    '★둘 다 줬을 때 «조용히 하나를 고른다» — 어느 것이 쓰였는지 모르게 된다');
  assert.match(SRC, /path: \{ type: 'string'/, '★스키마에 path 가 없다 — 모델이 못 본다');
});

test('W2 ★★설명문이 「첨부는 못 읽는다」를 «먼저» 말한다', () => {
  /* ⛔이게 없으면 모델이 첨부 이미지를 넣으려고 계속 시도하다 응답이 끊긴다 — 현빈이 겪은 그것. */
  assert.match(SRC, /If the user ATTACHED an image to the chat, you CANNOT read its bytes/,
    '★모델이 「첨부는 안 된다」를 모른다. 그러면 또 헤맨다');
  assert.match(SRC, /ask for the file path/, '★대안(경로를 물어라)을 안 알려준다');
});

test('W3 ⛔새 검사기를 «짓지 않았다» — 온전성은 기존 검사기가 본다', () => {
  /* ★_imageFileToDataUrl 은 «읽어서 dataURL 로 만들 뿐»이어야 한다.
     PNG CRC·JPEG 마커 같은 구조 검사를 여기서 또 하면 두 벌이 되어 따로 늙는다. */
  const i = SRC.indexOf('function _imageFileToDataUrl(');
  let d = 0, st = SRC.indexOf('{', i), end = -1;
  for (let j = st; j < SRC.length; j++) {
    if (SRC[j] === '{') d++; else if (SRC[j] === '}') { d--; if (!d) { end = j + 1; break; } }
  }
  const body = SRC.slice(i, end);
  for (const bad of ['_checkPng', '_checkJpeg', '_checkGif', '_checkWebp', 'IEND', 'crc']) {
    assert.ok(!body.includes(bad), `★구조 검사(${bad})를 여기서 또 한다 — 기존 _assertImageSrcIntact 가 할 일이다`);
  }
  assert.ok(body.includes('_IMG_SNIFF'), '★매직바이트 표를 «재사용»해야 한다(손으로 베끼지 마라)');
});

test('W4 ★path 로 넣은 것도 기존 온전성 검사를 «탄다»', () => {
  /* fileInfo 로 image 를 만든 «뒤»에 _assertImageSrcIntact 가 와야 한다.
     순서가 뒤집히면 파일 경로는 검사를 건너뛴다. */
  const iPath = SRC.indexOf('fileInfo = _imageFileToDataUrl(');
  const iCheck = SRC.indexOf("_assertImageSrcIntact(image, 'image')");
  assert.ok(iPath > 0 && iCheck > 0, '★두 자리를 못 찾았다');
  assert.ok(iPath < iCheck, '★파일을 읽는 자리가 온전성 검사 «뒤»에 있다 — 그러면 검사를 건너뛴다');
});
