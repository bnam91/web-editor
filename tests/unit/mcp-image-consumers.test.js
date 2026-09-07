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

/** 이름 붙은 정규식을 «그 파일에서» 읽어 온다. ⛔복사하면 갈릴 때 이 검사가 조용히 거짓이 된다. */
function reFrom(modPath, name) {
  const src = fs.readFileSync(require.resolve(modPath), 'utf8');
  const m = new RegExp('const ' + name + ' = (\\/.*\\/)([gimsuy]*);').exec(src);
  assert.ok(m, `★${modPath} 에서 ${name} 을 못 찾았다 — 이름이 바뀌었으면 이 검사가 죽은 것이다`);
  return new RegExp(m[1].slice(1, -1), m[2].replace('g', ''));
}
const externalizerRe = () => reFrom('../../main/project-store/externalizer.js', 'DATA_URI_RE');

/* ★소비자는 «하나가 아니다». 적대검수가 전수로 세어 최소 다섯을 찾았고, 그중 셋이
   put_image/imgSrc 가 실제로 지나는 길이다. 앞 판의 이 파일은 #2 «하나»만 읽어서,
   나머지가 갈라져도 초록이었다.
     #2 main/project-store/externalizer.js  — 저장 시 외부화(메인)
     #3 js/io/asset-externalize.js          — 렌더러 쪽 «두 번째 사본»(오늘은 #2 와 문자열 동일)
     #4 js/scratch-pad.js                   — ★put_image 가 지나는 길. 알파벳이 «실제로 다르다»
                                              (`[^;]+` 서브타입 · base64 는 `.` 라 줄바꿈 불가)
   ⚠️#4 는 인라인 정규식이라 이름으로 못 읽는다 — «소스에 그 패턴이 아직 있는지»를 같이 확인해서
     조용히 바뀌면 알게 한다. */
const CONSUMERS = () => {
  const spSrc = fs.readFileSync(require.resolve('../../js/scratch-pad.js'), 'utf8');
  const sp = /\/\^data:\(image\\\/\[\^;\]\+\);base64,\(\.\+\)\$\//.test(spSrc);
  assert.ok(sp, '★js/scratch-pad.js 의 dataURI 패턴이 바뀌었다 — 이 검사가 낡았다는 뜻이다');
  return [
    ['#2 externalizer(메인)', externalizerRe(), 'full'],
    ['#3 asset-externalize(렌더러 사본)', reFrom('../../js/io/asset-externalize.js', 'DATA_URI_RE'), 'full'],
    ['#4 scratch-pad(put_image 경로)', /^data:(image\/[^;]+);base64,(.+)$/, 'test']
  ];
};

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

/* ══ 3차 적대검수(2026-09-07)가 뚫은 다섯 — 「금지할 것을 «열거»」해서 샌 자리들 ══
   앞 판은 대소문자·파라미터·공백을 «항목으로» 막았다. 그래서 «안 떠올린 것»은 통째로 샜다.
   이제 판정은 `_STORABLE_RE` 하나가 하고, 아래는 그 다섯이 «전부» 막히는지 잰다.
   ★각 케이스마다 「externalizer 가 온전히 못 읽는다」를 «같이» 확인한다 —
     그래야 이게 「우리가 까다로운 것」이 아니라 「저장이 못 받는 것」임이 증명된다. */
const HOLES = [
  ['앞에 공백 한 칸',   (b) => ' data:image/png;base64,' + b,            'SRC_HAS_SURROUNDING_WHITESPACE'],
  ['앞에 탭',          (b) => '\tdata:image/png;base64,' + b,           'SRC_HAS_SURROUNDING_WHITESPACE'],
  ['base64 중간 =',    (b) => 'data:image/png;base64,' + b.slice(0, 50) + '=' + b.slice(50), 'BASE64_PADDING_MISPLACED'],
  ['빈 서브타입',       (b) => 'data:image/;base64,' + b,                'MIME_SUBTYPE_NOT_STORABLE'],
  ['밑줄 서브타입',      (b) => 'data:image/x_y;base64,' + b,             'MIME_SUBTYPE_NOT_STORABLE'],
  ['mime 안 공백',     (b) => 'data:image/png ;base64,' + b,            'MIME_SUBTYPE_NOT_STORABLE']
];

for (const [name, mk, reason] of HOLES) {
  test(`★3차에서 뚫렸던 자리 — ${name} 는 거절되고, 저장 소비자도 «못 읽는다»`, () => {
    const url = mk(B64);
    const RE = externalizerRe();
    const m = RE.exec(url);
    assert.ok(!m || m[0].length !== url.length,
      `전제: externalizer 가 «온전히 못 읽어야» 거절이 정당하다 (${m ? m[0].length : 0}/${url.length})`);
    let e = null;
    try { _assertImageSrcIntact(url, 'image'); } catch (x) { e = x; }
    assert.ok(e, `${name}: 거절되어야 한다 — 앞 판은 여기서 «검사 자체를 안 했다»`);
    assert.equal(e.detail.reason, reason);
  });
}

test('★«되던 것»은 좁히면서도 그대로 통과한다 — 좁히다 막는 게 이 판의 상습 실수였다', () => {
  const ok = [
    ['정상',          'data:image/png;base64,' + B64],
    ['패딩 생략',      'data:image/png;base64,' + B64.replace(/=+$/, '')],
    ['svg+xml',      'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64')],
    ['vnd.ms-photo', 'data:image/vnd.ms-photo;base64,' + B64]
  ];
  const RE = externalizerRe();
  for (const [name, url] of ok) {
    const m = RE.exec(url);
    assert.ok(m && m[0].length === url.length, `전제: ${name} 는 저장 소비자가 온전히 읽는다`);
    assert.doesNotThrow(() => _assertImageSrcIntact(url, 'image'), name);
  }
});

test('★http(s)·assets 경로는 여전히 «검사 대상이 아니다» — 느슨한 입구가 남을 삼키면 안 된다', () => {
  for (const s of ['https://x.example/a.png', 'assets/a.png', 'blob:abc',
                   'https://cdn.example/path/data:image/png-lookalike']) {
    assert.equal(_assertImageSrcIntact(s, 'imgSrc').checked, 'skipped:not-a-data-url', s);
  }
});


test('★★소비자를 «전수»로 대조한다 — 하나만 읽으면 나머지가 갈라져도 초록이다', () => {
  const consumers = CONSUMERS();
  const ok = [
    ['정상',          'data:image/png;base64,' + B64],
    ['패딩 생략',      'data:image/png;base64,' + B64.replace(/=+$/, '')],
    ['서브타입 대문자',  'data:image/PNG;base64,' + B64],
    ['svg+xml',      'data:image/svg+xml;base64,' + Buffer.from('<svg/>').toString('base64')],
    ['x-icon',       'data:image/x-icon;base64,' + B64],
    ['vnd.ms-photo', 'data:image/vnd.ms-photo;base64,' + B64]
  ];
  for (const [name, url] of ok) {
    assert.doesNotThrow(() => _assertImageSrcIntact(url, 'image'), `${name}: 우리가 통과시켜야 한다`);
    for (const [cname, re, mode] of consumers) {
      const reads = mode === 'full'
        ? (() => { const m = re.exec(url); return !!m && m[0].length === url.length; })()
        : re.test(url);
      assert.ok(reads, `★${name}: 우리는 통과시켰는데 «${cname}» 가 못 읽는다 — 그 경로에서 깨진다`);
    }
  }
});

test('★#2 와 #3 은 «사본»이다 — 갈라지면 알아야 한다', () => {
  const a = reFrom('../../main/project-store/externalizer.js', 'DATA_URI_RE').source;
  const b = reFrom('../../js/io/asset-externalize.js', 'DATA_URI_RE').source;
  assert.equal(b, a,
    '★메인/렌더러의 dataURI 정규식이 갈라졌다. 둘 중 하나만 맞추면 «한쪽 경로에서만» 파손이 난다 — '
    + '갈라뜨릴 이유가 있으면 이 테스트를 «의식적으로» 고쳐라(조용히 갈리는 것을 막는 자리다).');
});
