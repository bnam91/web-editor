'use strict';
/* put_image / update_asset_block / update_block(ab_) 이 «잘린 이미지»를 거절하는가.
 *
 * ★왜 이 파일이 있나 — 2026-09-07 실측에서 나온 사고다.
 *   클로드 데스크톱에 사진을 첨부해 「넣어줘」 하면 모델이 자기 샌드박스에서 파일을 읽어
 *   base64 «문자열»로 인자에 실어 나른다. 그 문자열이 잘렸다.
 *     원본 4,849B (sha 1df744f1…)  →  모델 샌드박스 4,849B «동일»  →  고디터 3,472B (sha a57afb24…)
 *   IHDR 이 선언한 IDAT 길이는 4,792B 인데 파일 전체가 3,472B 였다. 그런데 우리 검사는
 *   «접두사 정규식 + 길이 상한» 둘뿐이라 그대로 통과해 «깨진 PNG 가 성공으로» 저장됐다.
 *   대조군: 같은 세션에 원본 바이트를 dataURL 로 직접 넣은 것은 scratch·canvas 둘 다 sha256 일치 —
 *   ⇒ 고디터 저장 경로는 무손실이고, 손실은 «모델이 base64 를 손으로 나르는» 구간이었다.
 *
 * 이 테스트가 지키는 것: 「돌아가는데 결과가 손상된다」를 「거절하고 숫자로 말한다」로 바꾼 것.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const zlib = require('node:zlib');

const { _assertImageSrcIntact } = require('../../main/claude-pm/mcp-server.js');

/* node:assert 의 throws() 는 «에러를 돌려주지 않는다»(undefined). 우리는 code/detail 을 봐야 하므로
   직접 잡는다. ⚠️「안 던졌다」를 «통과»로 읽지 않도록 명시적으로 실패시킨다. */
function grab(fn) {
  try { fn(); } catch (e) { return e; }
  assert.fail('던져야 하는데 «안 던졌다»');
}

// ── 픽스처: 외부 파일 없이 «진짜» PNG 를 만든다(테스트가 자기 완결이어야 한다) ──
function makePng(w, h, rgb) {
  const raw = Buffer.concat(
    Array.from({ length: h }, () => Buffer.concat([Buffer.from([0]), Buffer.from(Array(w).fill(rgb).flat())]))
  );
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32 ? zlib.crc32(body) >>> 0 : crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  function crc32(buf) { // Node 20 이하 폴백
    let c, crc = 0xffffffff;
    for (let n = 0; n < buf.length; n++) {
      c = (crc ^ buf[n]) & 0xff;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crc = c ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))
  ]);
}
const png = makePng(60, 40, [220, 80, 80]);
const dataUrl = (mime, buf) => `data:${mime};base64,` + buf.toString('base64');
const GOOD_PNG = dataUrl('image/png', png);

// 사고를 «비율 그대로» 재현한다: 6,468자 → 4,632자 (실측치), 4의 배수로 잘려 base64 는 멀쩡하다
function truncateLikeIncident(url) {
  const [head, b64] = url.split(';base64,');
  const keep = Math.floor((b64.length * 4632 / 6468) / 4) * 4;
  return `${head};base64,` + b64.slice(0, keep);
}

test('정상 PNG 는 통과하고 «어디까지 봤는지»를 돌려준다', () => {
  const r = _assertImageSrcIntact(GOOD_PNG, 'image');
  assert.equal(r.checked, 'png-structure');
  assert.equal(r.format, 'image/png');
  assert.equal(r.bytes, png.length);
});

test('★잘린 PNG 는 «거절»된다 — 오늘 사고와 같은 모양(base64 길이는 4의 배수라 멀쩡하다)', () => {
  const bad = truncateLikeIncident(GOOD_PNG);
  const b64 = bad.split(';base64,')[1];
  assert.equal(b64.length % 4, 0, '전제: base64 자체는 «멀쩡»해야 이 시험이 의미가 있다');
  assert.doesNotThrow(() => Buffer.from(b64, 'base64'), '전제: 디코드도 «성공»한다');
  const e = grab(() => _assertImageSrcIntact(bad, 'image'));
  assert.equal(e.code, 'IMAGE_TRUNCATED');
  assert.equal(e.detail.reason, 'PNG_CHUNK_TRUNCATED');
});

test('★거절 메시지는 «숫자»로 말한다 — 몇 바이트 받았고 몇을 기대했나', () => {
  const e = grab(() => _assertImageSrcIntact(truncateLikeIncident(GOOD_PNG), 'image'));
  const d = e.detail;
  assert.ok(Number.isInteger(d.decodedBytes) && d.decodedBytes > 0, 'decodedBytes 가 있어야 한다');
  assert.ok(Number.isInteger(d.declaredChunkBytes), 'declaredChunkBytes 가 있어야 한다');
  assert.ok(Number.isInteger(d.expectedAtLeastBytes), 'expectedAtLeastBytes 가 있어야 한다');
  assert.ok(d.expectedAtLeastBytes > d.decodedBytes, '기대 > 받음 이어야 한다');
  assert.match(e.message, new RegExp(String(d.decodedBytes)), '메시지에 받은 바이트 수가 있어야 한다');
  assert.match(e.message, new RegExp(String(d.declaredChunkBytes)), '메시지에 선언 길이가 있어야 한다');
});

test('IEND 가 없으면 거절한다', () => {
  const noEnd = png.subarray(0, png.length - 12); // IEND 청크만 떼어낸다
  const e = grab(() => _assertImageSrcIntact(dataUrl('image/png', noEnd), 'image'));
  assert.equal(e.code, 'IMAGE_TRUNCATED');
  assert.ok(['PNG_NO_IEND', 'PNG_CHUNK_TRUNCATED'].includes(e.detail.reason), e.detail.reason);
});

test('매직바이트가 선언 mime 과 다르면 거절한다 (확장자만 바꾼 파일)', () => {
  const e = grab(() => _assertImageSrcIntact(dataUrl('image/jpeg', png), 'image'));
  assert.equal(e.code, 'IMAGE_TRUNCATED');
  assert.equal(e.detail.reason, 'MAGIC_MISMATCH');
  assert.equal(e.detail.declaredMime, 'image/jpeg');
});

/* ⛔이 자리에 있던 「4의 배수가 아니면 거절」 테스트는 «폐기»했다 —
   패딩(=) 생략은 RFC 4648 에서 정상이고, 그걸 거절한 게 적대검수에서 오탐으로 잡혔다.
   대신 「나머지가 1이면 거절」(있을 수 없는 값)로 좁혔다. 아래 참조. */

test('base64 에 이상한 문자가 있으면 거절한다', () => {
  const [h, b] = GOOD_PNG.split(';base64,');
  const e = grab(() => _assertImageSrcIntact(`${h};base64,` + '!!!' + b.slice(3), 'image'));
  assert.equal(e.detail.reason, 'BASE64_BAD_CHARS');
});

test('★구조를 못 보는 포맷은 «막지 않는다» — 이제 jpeg/gif/webp 는 «끝 표식»까지 본다', () => {
  // 첫 판에서는 셋 다 magic-bytes 까지만 보고 통과시켰다(=잘린 JPEG 가 그대로 저장됐다).
  // 적대검수에서 그게 「사고 유형의 절반 이상이 남았다」로 잡혔다 ⇒ 구조 검사를 붙였다.
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 7), Buffer.from([0xff, 0xd9])]);
  assert.equal(_assertImageSrcIntact(dataUrl('image/jpeg', jpeg), 'image').checked, 'jpeg-structure');
});

test('모르는 mime 은 디코드까지만 보고 통과시킨다 (되던 게 안 되면 안 된다)', () => {
  const r = _assertImageSrcIntact(dataUrl('image/avif', Buffer.alloc(40, 1)), 'image');
  assert.equal(r.checked, 'decode-only');
});

test('우리가 바이트를 안 가진 src 는 검사 대상이 아니다 (http/assets/blob)', () => {
  for (const s of ['https://x.example/a.png', 'assets/a.png', 'blob:abc']) {
    assert.equal(_assertImageSrcIntact(s, 'imgSrc').checked, 'skipped:not-a-data-url');
  }
});

// ── ★배선: 세 호출처가 «그 함수»를 실제로 부르는가 ─────────────────────────────
// 모듈은 완벽한데 아무도 안 부르는 것을 막는다. 소스에서 호출 지점을 «센다».
test('★배선 — put_image 와 _validateAssetOpts 가 검사 함수를 «부른다»', () => {
  const fs = require('node:fs');
  const src = fs.readFileSync(require.resolve('../../main/claude-pm/mcp-server.js'), 'utf8');
  const calls = src.match(/_assertImageSrcIntact\(/g) || [];
  // 정의 1 + export 0(참조만) + 호출 2 = 최소 3
  assert.ok(calls.length >= 3, `검사 함수 호출이 사라졌다 (found ${calls.length})`);
  assert.match(src, /imageCheck = _assertImageSrcIntact\(image, 'image'\)/, 'put_image 배선이 없다');
  assert.match(src, /_assertImageSrcIntact\(args\.imgSrc, 'imgSrc'\)/, 'asset imgSrc 배선이 없다');
});

test('★배선 — update_block(ab_) 이 update_asset_block 으로 가는 경로가 살아 있다', () => {
  const fs = require('node:fs');
  const bt = fs.readFileSync(require.resolve('../../main/claude-pm/mcp-block-tools.js'), 'utf8');
  assert.match(bt, /update_asset_block/, 'asset 타입이 통합 update_block 표에서 빠졌다');
  assert.match(bt, /ab_/, 'ab_ 접두 매핑이 사라졌다');
});

test('★거절은 «어느 경로로도» 코드 이름을 잃지 않는다 (던져도 문장에 남는다)', () => {
  const e = grab(() => _assertImageSrcIntact(truncateLikeIncident(GOOD_PNG), 'imgSrc'));
  assert.equal(e.code, 'IMAGE_TRUNCATED');
  assert.match(e.message, /\[IMAGE_TRUNCATED\]/,
    'JSON-RPC 에러로 납작해지면 code 필드가 사라진다 — 문장에도 남아 있어야 한다');
});

test('★배선 — update_asset_block 이 잘린 imgSrc 를 put_image 와 «같은 모양»으로 거절한다', () => {
  const fs = require('node:fs');
  const src = fs.readFileSync(require.resolve('../../main/claude-pm/mcp-server.js'), 'utf8');
  const hits = src.match(/return \{ ok: false, code: 'IMAGE_TRUNCATED'/g) || [];
  assert.ok(hits.length >= 2,
    `put_image 와 update_asset_block «둘 다» ok:false 로 답해야 한다 (found ${hits.length})`);
});


// ── ★배선: «다섯 곳 각각»이 그 함수를 부르는가 ────────────────────────────────
// 한 곳만 지워도 빨강이어야 한다. 「검사 함수는 있는데 아무도 안 부른다」가 오늘 반복해 밟은 병이다.
// ⛔같은 _assertImageSrcIntact() 를 부르는 것 외의 방법은 쓰지 않는다 —
//   겹을 늘리면 각 겹이 «실제로 일하는지» 못 잰다(지디 2026-09-07).
/* 함수 «영역»을 잡는다: 이 함수 머리 ~ «다음» 함수 머리 직전.
   ⛔중괄호 세기는 못 쓴다 — 문자열/정규식 안의 { } 까지 세서 영역이 일찍 끝난다(실측). */
function regionOf(src, header) {
  const at = src.indexOf(header);
  assert.notEqual(at, -1, `함수를 못 찾았다: ${header}`);
  const heads = [...src.matchAll(/\n[ \t]*function [A-Za-z_$][\w$]*\s*\(/g)].map(m => m.index);
  const next = heads.find(i => i > at);
  return src.slice(at, next === undefined ? src.length : next);
}

const IMG_SITES = [
  ['_validateAssetOpts',      'function _validateAssetOpts('],       // update_asset_block + update_block(ab_)
  ['_validateBanner02Opts',   'function _validateBanner02Opts('],
  ['_validateStickerOpts',    'function _validateStickerOpts('],
  ['_validateIconCircleOpts', 'function _validateIconCircleOpts('],
  ['_validateIconTextOpts',   'function _validateIconTextOpts('],
  ['_validateMkpImgSrc',      'function _validateMkpImgSrc(']        // ★put_image 와 같은 7MB 상한
];

for (const [name, header] of IMG_SITES) {
  test(`★배선 — ${name} 이 _assertImageSrcIntact 를 «부른다»`, () => {
    const fs = require('node:fs');
    const src = fs.readFileSync(require.resolve('../../main/claude-pm/mcp-server.js'), 'utf8');
    const body = regionOf(src, header);
    assert.match(body, /_assertImageSrcIntact\(/,
      `${name} 에서 검사 호출이 사라졌다 — 이 경로로는 잘린 이미지가 그대로 들어간다`);
  });
}

test('★상한은 «양»을 막지 «구조»를 못 막는다 — 200,000자 이하인데도 잘린 PNG 는 거절된다', () => {
  const bad = truncateLikeIncident(GOOD_PNG);
  assert.ok(bad.length < 200000, `전제: 200,000자 상한 «안»이어야 이 시험이 의미가 있다 (${bad.length})`);
  const e = grab(() => _assertImageSrcIntact(bad, 'imgSrc'));
  assert.equal(e.code, 'IMAGE_TRUNCATED');
});

test('imgSrc:"" (이미지 제거 의도) 는 여전히 통과한다 — 되던 게 안 되면 안 된다', () => {
  assert.equal(_assertImageSrcIntact('', 'imgSrc').checked, 'skipped:not-a-string');
});

test('svg+xml 은 매직바이트 표에 없어 «막지 않고» 디코드까지만 본다', () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>', 'utf8');
  const r = _assertImageSrcIntact('data:image/svg+xml;base64,' + svg.toString('base64'), 'imgSrc');
  assert.equal(r.checked, 'decode-only');
});


// ══ 적대검수(2026-09-07)에서 나온 것들 — 오탐 3종 + 우회 8종 ══════════════════
const b64of = b => b.toString('base64');
const PNG_B64 = b64of(png);

/* ★오탐 — «정상인데 거절»이 구멍보다 나쁘다.
   셋 다 디코드하면 원본과 바이트가 «같다». 옛 코드에선 통과하던 것들이다. */
test('★오탐 — 76열로 줄바꿈된 base64는 통과한다 (파이썬 base64.encodebytes 기본값)', () => {
  const wrapped = PNG_B64.replace(/(.{76})/g, '$1\n');
  assert.ok(wrapped.includes('\n'), '전제: 실제로 줄바꿈이 있어야 한다');
  assert.deepEqual(Buffer.from(wrapped.replace(/\s/g, ''), 'base64'), png, '전제: 바이트는 원본과 같다');
  assert.equal(_assertImageSrcIntact('data:image/png;base64,' + wrapped, 'image').checked, 'png-structure');
});
test('★오탐 — 공백이 섞인 base64는 통과한다', () => {
  const spaced = PNG_B64.slice(0, 40) + ' \t ' + PNG_B64.slice(40);
  assert.equal(_assertImageSrcIntact('data:image/png;base64,' + spaced, 'image').checked, 'png-structure');
});
test('★오탐 — 패딩(=) 없는 «완전한» base64는 통과한다 (RFC 4648 에서 패딩은 생략 가능)', () => {
  const nopad = PNG_B64.replace(/=+$/, '');
  assert.notEqual(nopad.length % 4, 0, '전제: 길이가 4배수가 아니어야 이 시험이 의미가 있다');
  const r = _assertImageSrcIntact('data:image/png;base64,' + nopad, 'image');
  assert.equal(r.checked, 'png-structure');
  assert.equal(r.bytes, png.length, '패딩만 없을 뿐 «같은 그림»이다');
});
test('base64 길이 나머지가 1이면 «있을 수 없는» 값이라 거절한다', () => {
  // 나머지 1 은 base64 로 만들 수 «없는» 길이다 — 잘렸다는 확실한 신호다.
  const stripped = PNG_B64.replace(/=+$/, '');
  const bad = stripped + 'A'.repeat((1 - (stripped.length % 4) + 4) % 4 || 4);
  assert.equal(bad.length % 4, 1, '전제: 나머지가 1이어야 한다');
  const e = grab(() => _assertImageSrcIntact('data:image/png;base64,' + bad, 'image'));
  assert.equal(e.detail.reason, 'BASE64_LENGTH');
});

/* ★우회 — 선언 mime 표기로 구조 검사를 건너뛰던 길들 */
const truncPng = () => truncateLikeIncident(GOOD_PNG).split(';base64,')[1];
for (const [name, url] of [
  ['대문자 mime',        () => 'data:IMAGE/PNG;base64,' + truncPng()],
  ['charset 파라미터',   () => 'data:image/png;charset=utf-8;base64,' + truncPng()],
  ['오타 mime image/jpg', () => 'data:image/jpg;base64,' + truncPng()],
  ['image/x-png',        () => 'data:image/x-png;base64,' + truncPng()]
]) {
  test(`★우회막힘 — ${name} 로 위장한 잘린 PNG 도 거절된다`, () => {
    const e = grab(() => _assertImageSrcIntact(url(), 'image'));
    assert.equal(e.code, 'IMAGE_TRUNCATED');
  });
}

/* ★PNG 구조 위조 — 길이 대조만으로는 통과하던 것들. CRC 가 잡는다. */
test('★청크 길이 필드를 «작게 위조»해도 CRC 가 잡는다', () => {
  const forged = Buffer.from(png);
  forged.writeUInt32BE(4, 33 - 25 >= 0 ? 33 : 33); // IDAT 길이 자리(offset 33)를 4로 위조
  const e = grab(() => _assertImageSrcIntact('data:image/png;base64,' + b64of(forged), 'image'));
  assert.equal(e.code, 'IMAGE_TRUNCATED');
  assert.equal(e.detail.reason, 'PNG_CRC_MISMATCH');
});
test('★길이는 그대로 두고 «내용만» 파괴해도 CRC 가 잡는다', () => {
  const corrupt = Buffer.from(png);
  corrupt[60] ^= 0xff;
  const e = grab(() => _assertImageSrcIntact('data:image/png;base64,' + b64of(corrupt), 'image'));
  assert.equal(e.detail.reason, 'PNG_CRC_MISMATCH');
});

/* ★JPEG/GIF/WebP — 셋 다 «끝 표식»이 있다. 잘리면 그게 없다. */
const JPEG_OK = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(120, 7), Buffer.from([0xff, 0xd9])]);
const GIF_OK  = Buffer.concat([Buffer.from('GIF89a', 'latin1'), Buffer.alloc(60, 3), Buffer.from([0x3b])]);
const WEBP_OK = (() => {
  const body = Buffer.alloc(40, 9); const b = Buffer.alloc(12 + body.length);
  b.write('RIFF', 0, 'latin1'); b.writeUInt32LE(4 + body.length, 4); b.write('WEBP', 8, 'latin1');
  body.copy(b, 12); return b;
})();
for (const [fmt, mime, ok] of [['jpeg','image/jpeg',JPEG_OK], ['gif','image/gif',GIF_OK], ['webp','image/webp',WEBP_OK]]) {
  test(`정상 ${fmt} 는 통과하고 구조를 봤다고 적는다`, () => {
    assert.equal(_assertImageSrcIntact(`data:${mime};base64,` + b64of(ok), 'image').checked, `${fmt}-structure`);
  });
  test(`★잘린 ${fmt} 는 거절된다 (첫 판에서는 뚫렸던 자리)`, () => {
    const cut = ok.subarray(0, ok.length - 3);
    const e = grab(() => _assertImageSrcIntact(`data:${mime};base64,` + b64of(cut), 'image'));
    assert.equal(e.code, 'IMAGE_TRUNCATED');
  });
}
test('선언 mime 과 실제 내용이 «둘 다 아는 형식»인데 다르면 거절한다', () => {
  const e = grab(() => _assertImageSrcIntact('data:image/gif;base64,' + PNG_B64, 'image'));
  assert.equal(e.detail.reason, 'MAGIC_MISMATCH');
  assert.equal(e.detail.sniffedMime, 'image/png');
});

test('★스킴/인코딩 표기 대소문자 — DATA:…;BASE64, 도 «읽고» 잘렸으면 거절한다', () => {
  // 정규식의 i 플래그가 실제로 일하는 자리. 없으면 이 입력이 «데이터URL이 아님»으로 빠져나가
  // 검사를 통째로 건너뛴다(=우회로). 실측: /i 없으면 매치 실패.
  const e = grab(() => _assertImageSrcIntact('DATA:IMAGE/PNG;BASE64,' + truncateLikeIncident(GOOD_PNG).split(';base64,')[1], 'image'));
  assert.equal(e.code, 'IMAGE_TRUNCATED');
});
test('★패딩 없는 base64는 Node 가 그대로 읽는다 — 우리가 채우지 않는다', () => {
  const nopad = PNG_B64.replace(/=+$/, '');
  assert.deepEqual(Buffer.from(nopad, 'base64'), png, '전제: Node 가 패딩 없이도 원본을 준다');
  assert.equal(_assertImageSrcIntact('data:image/png;base64,' + nopad, 'image').bytes, png.length);
});

test('★mime 별칭표가 «실제로» 판정을 가른다 — 온전한 PNG 를 image/jpg 로 선언하면 불일치로 거절', () => {
  // 별칭표가 없으면 'image/jpg' 가 «우리가 아는 형식» 목록에 없어서 불일치 검사를 통째로 건너뛴다
  //  ⇒ 선언과 내용이 달라도 통과한다. 별칭표는 그 구멍을 막는 자리다(변이로 확인).
  // ⚠️여기서 거절되는 것은 «온전한» 그림이다 — 잘림이 아니라 «표기가 내용과 다름»이고,
  //   메시지도 그렇게 말한다(「잘려서 들어왔습니다」라고 거짓말하지 않는다).
  const e = grab(() => _assertImageSrcIntact('data:image/jpg;base64,' + PNG_B64, 'image'));
  assert.equal(e.detail.reason, 'MAGIC_MISMATCH');
  assert.equal(e.detail.declaredMime, 'image/jpg');
  assert.equal(e.detail.sniffedMime, 'image/png');
  assert.doesNotMatch(e.message, /잘려서/, '온전한 그림에 「잘렸다」고 말하면 안 된다');
});

test('별칭 덕분에 image/jpg + «진짜 JPEG» 은 통과한다 (흔한 오타를 막지 않는다)', () => {
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 7), Buffer.from([0xff, 0xd9])]);
  const r = _assertImageSrcIntact('data:image/jpg;base64,' + jpeg.toString('base64'), 'image');
  assert.equal(r.checked, 'jpeg-structure');
  assert.equal(r.declaredMime, 'image/jpg', '표기가 달랐다는 사실은 응답에 남는다');
});
