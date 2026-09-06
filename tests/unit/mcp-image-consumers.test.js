'use strict';
/* ★소비자가 «셋»이고, 우리가 통과시킨 것을 셋 다 읽을 수 있어야 한다.
 *
 * 이 파일이 생긴 이유(적대검수 2026-09-07):
 *   검사 기준을 「Node 가 디코드하나」 → 「브라우저 data URL 파서가 읽나」로 옮겼는데,
 *   **그게 유일한 소비자가 아니었다.** 저장 시 «에셋 외부화»가 더 좁은 정규식을 쓴다:
 *       main/project-store/externalizer.js
 *       /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+\/]+=*​/g
 *   소문자 `data:image/` 고정 · 파라미터 불가 · base64 안에 공백 불가.
 *   실측: 76열로 감긴 dataURL 6,575자 중 **98자만 매치** ⇒ 앞부분만 goya-asset:// 로 치환되고
 *   나머지 base64 가 쓰레기로 남아 **저장하면 이미지가 영구 파손**된다. 게다가 5단계 검증
 *   게이트가 «같은 정규식»이라 그 쓰레기를 0 으로 세고 통과시킨다 — 파손이 게이트를 그냥 지난다.
 *
 * ⇒ 받아들이는 집합은 «모든 소비자의 교집합»이어야 한다.
 *   브라우저가 받아도 저장이 깨뜨리면 「돌아가는데 결과가 손상된다」 — 이 판이 막으려던 그 모양이다.
 *
 * ★정규식을 «복사하지 않고 소스에서 읽는다» — 복사하면 둘이 갈릴 때 이 검사가 조용히 거짓이 된다.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const zlib = require('node:zlib');
const { _assertImageSrcIntact } = require('../../main/claude-pm/mcp-server.js');

/** externalizer 가 «실제로» 쓰는 정규식을 그 파일에서 읽어 온다. */
function externalizerRe() {
  const src = fs.readFileSync(require.resolve('../../main/project-store/externalizer.js'), 'utf8');
  const m = /const DATA_URI_RE = (\/.*\/)([gimsuy]*);/.exec(src);
  assert.ok(m, '★externalizer.js 에서 DATA_URI_RE 를 못 찾았다 — 이름이 바뀌었으면 이 검사가 죽은 것이다');
  return new RegExp(m[1].slice(1, -1), m[2].replace('g', ''));
}

function makePng() {
  const w = 40, h = 24;
  const raw = Buffer.concat(Array.from({ length: h },
    () => Buffer.concat([Buffer.from([0]), Buffer.from(Array(w).fill([9, 200, 120]).flat())])));
  const chunk = (t, d) => {
    const L = Buffer.alloc(4); L.writeUInt32BE(d.length);
    const b = Buffer.concat([Buffer.from(t, 'latin1'), d]);
    const c = Buffer.alloc(4); c.writeUInt32BE(zlib.crc32(b) >>> 0);
    return Buffer.concat([L, b, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]);
}
const PNG = makePng();
const B64 = PNG.toString('base64');

const CASES = [
  ['정상',              'data:image/png;base64,' + B64],
  ['패딩 생략',          'data:image/png;base64,' + B64.replace(/=+$/, '')],
  ['76열 줄바꿈',        'data:image/png;base64,' + B64.replace(/(.{76})/g, '$1\n')],
  ['공백 섞임',          'data:image/png;base64,' + B64.slice(0, 40) + '  ' + B64.slice(40)],
  ['대문자 IMAGE/PNG',   'data:IMAGE/PNG;base64,' + B64],
  ['charset 파라미터',   'data:image/png;charset=utf-8;base64,' + B64]
];

test('★★우리가 «통과»시킨 src 는 저장 소비자가 «온전히» 읽는다 (한 알파벳)', () => {
  const RE = externalizerRe();
  let passed = 0, rejected = 0;
  for (const [name, url] of CASES) {
    let ours = null;
    try { _assertImageSrcIntact(url, 'image'); ours = 'pass'; }
    catch (e) { ours = 'reject'; assert.ok(e.imageCheckError, `${name}: 거절이면 이미지검사 에러여야 한다`); }

    const m = RE.exec(url);
    const storable = !!m && m[0].length === url.length;   // «통째로» 매치해야 온전히 외부화된다

    if (ours === 'pass') {
      passed++;
      assert.ok(storable,
        `★${name}: 우리는 통과시켰는데 외부화가 온전히 못 읽는다 `
        + `(${m ? m[0].length : 0}/${url.length}자) — 저장하면 파손된다`);
    } else {
      rejected++;
    }
  }
  assert.ok(passed >= 2, `통과 케이스가 있어야 의미가 있다 (passed=${passed})`);
  assert.ok(rejected >= 3, `거절 케이스도 있어야 의미가 있다 (rejected=${rejected})`);
});

test('★거절 사유가 «저장» 때문임을 말한다 — 「잘렸다」고 하지 않는다', () => {
  for (const [name, url] of CASES.slice(2)) {
    let e = null;
    try { _assertImageSrcIntact(url, 'image'); } catch (x) { e = x; }
    assert.ok(e, `${name}: 거절되어야 한다`);
    assert.equal(e.code, 'IMAGE_INVALID', `${name}: 잘린 게 아니다`);
    assert.doesNotMatch(e.message, /잘려서/, `${name}: 원인을 거짓으로 말하면 안 된다`);
    assert.match(e.message, /저장/, `${name}: 왜 안 되는지(저장 단계)를 말해야 한다`);
  }
});

test('★externalizer 의 정규식을 «소스에서» 읽는다 — 복사본이면 갈려도 모른다', () => {
  const src = fs.readFileSync(require.resolve('../../main/project-store/externalizer.js'), 'utf8');
  assert.match(src, /const DATA_URI_RE = \//, 'DATA_URI_RE 가 사라지면 이 검사는 «검사가 아니다»');
  assert.ok(externalizerRe().test('data:image/png;base64,' + B64), '읽어온 정규식이 정상 dataURL 을 매치해야 한다');
});
