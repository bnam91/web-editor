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

test('base64 길이가 4의 배수가 아니면 거절한다', () => {
  const e = grab(() => _assertImageSrcIntact(GOOD_PNG.slice(0, GOOD_PNG.length - 1), 'image'));
  assert.equal(e.code, 'IMAGE_TRUNCATED');
  assert.equal(e.detail.reason, 'BASE64_LENGTH');
});

test('base64 에 이상한 문자가 있으면 거절한다', () => {
  const [h, b] = GOOD_PNG.split(';base64,');
  const e = grab(() => _assertImageSrcIntact(`${h};base64,` + '!!!' + b.slice(3), 'image'));
  assert.equal(e.detail.reason, 'BASE64_BAD_CHARS');
});

test('★구조를 못 보는 포맷은 «막지 않는다» — 통과시키고 어디까지 봤는지 적는다', () => {
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 7)]);
  const rj = _assertImageSrcIntact(dataUrl('image/jpeg', jpeg), 'image');
  assert.equal(rj.checked, 'magic-bytes');
  assert.ok(rj.note && rj.note.includes('구조 검사'), '어디까지 봤는지 응답에 있어야 한다');

  const gif = Buffer.concat([Buffer.from('GIF89a', 'latin1'), Buffer.alloc(32, 3)]);
  assert.equal(_assertImageSrcIntact(dataUrl('image/gif', gif), 'image').checked, 'magic-bytes');

  const webp = Buffer.concat([Buffer.from('RIFF', 'latin1'), Buffer.alloc(4), Buffer.from('WEBP', 'latin1'), Buffer.alloc(16)]);
  assert.equal(_assertImageSrcIntact(dataUrl('image/webp', webp), 'image').checked, 'magic-bytes');
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
