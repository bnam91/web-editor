/* 단위 하네스 — main/gdt/export.js 의 goya-asset:// 동봉 (+ import.js 왕복)
 * 실행: node --test tests/unit/gdt-goya.test.js
 * 라이브 userData 무접촉: 모든 케이스가 os.tmpdir() 아래 격리 디렉터리에서 돈다. Electron 불필요.
 *
 * ★dedup 을 «검사하지 않는다» — formatVersion 1 은 「출현 하나 = 엔트리 하나」가 불변식이다
 *   (verifyGdt §11-1ⓐ refs == images == unique · import 의 restored == images). goya 도 그 규칙을 따른다.
 *   같은 goya URL 이 N번이면 엔트리 N개이고, 대신 sha256 이 같아야 한다(여기서 그걸 검사한다).
 */
'use strict';
const test = require('node:test');
const { mkTmpRoot } = require('./_tmproot.js');

const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const yauzl = require('yauzl');
const { exportGdt, transformProjectJson } = require('../../main/gdt/export');
const { importGdt } = require('../../main/gdt/import');

// 1x1 PNG·GIF (진짜 바이트 — probeImage 를 통과해야 verifyGdt 가 ok 다)
const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const GIF_B64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const PNG = Buffer.from(PNG_B64, 'base64');
const GIF = Buffer.from(GIF_B64, 'base64');
// 두 번째 PNG — 바이트가 달라야 「중복」과 「다른 이미지」가 구분된다(마지막 바이트 앞 IDAT 데이터 비트 하나 뒤집기는
// CRC 가 깨지지만 probePng 는 IHDR 만 본다 ⇒ 검증엔 영향 없다)
const PNG2 = Buffer.from(PNG); PNG2[PNG2.length - 1] ^= 0x01;
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

function mkRoot() { return mkTmpRoot('gdt-goya-'); }
function writeProject(root, id, canvas, assets) {
  const dir = path.join(root, id);
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
  for (const [name, buf] of Object.entries(assets || {})) fs.writeFileSync(path.join(dir, 'assets', name), buf);
  const proj = { version: 2, id, name: `t-${id}`, currentPageId: 'p1', pages: [{ id: 'p1', name: 'Page 1', canvas }], checklistItems: [] };
  fs.writeFileSync(path.join(dir, 'proj.json'), JSON.stringify(proj, null, 2));
  return path.join(dir, 'proj.json');
}

/** zip 엔트리 이름 목록 + 각 엔트리 바이트 */
function readZip(gdtPath) {
  return new Promise((resolve, reject) => {
    const entries = {};
    yauzl.open(gdtPath, { lazyEntries: true, autoClose: true }, (err, zf) => {
      if (err) return reject(err);
      zf.on('error', reject);
      zf.on('entry', (e) => {
        zf.openReadStream(e, (er, rs) => {
          if (er) return reject(er);
          const bufs = [];
          rs.on('data', (d) => bufs.push(d));
          rs.on('end', () => { entries[e.fileName] = Buffer.concat(bufs); zf.readEntry(); });
        });
      });
      zf.on('end', () => resolve(entries));
      zf.readEntry();
    });
  });
}
const b64In = (text) => [...text.matchAll(/data:image\/[a-z+]+;base64,([A-Za-z0-9+/=]+)/g)].map(m => m[1]);

const PID = 'proj_1700000000001';
const A = `goya-asset://${PID}/aaaaaaaaaaaaaaaa.png`;
const B = `goya-asset://${PID}/bbbbbbbbbbbbbbbb.gif`;
const INLINE = `data:image/png;base64,${Buffer.from(PNG2).toString('base64')}`;

test('ⓐⓑ goya 2종(중복 포함)+base64 혼재 → export 엔트리·project.json 치환 → import 로 원본 바이트 base64 복원', async () => {
  const root = mkRoot();
  // A 두 번(속성 + HTML 엔티티 인용 url()), B 한 번, base64 한 장. 엔티티·JSON 이스케이프 문맥을 실데이터대로 섞는다.
  const canvas = `<div class="section-block"><img src="${A}"><div style="background-image:url(&quot;${A}&quot;)"></div>` +
                 `<div data-img-src="${B}"></div><img src="${INLINE}"><p>텍스트 한글</p></div>`;
  const src = writeProject(root, PID, canvas, { 'aaaaaaaaaaaaaaaa.png': PNG, 'bbbbbbbbbbbbbbbb.gif': GIF });
  const out = path.join(root, 'a.gdt');

  const r = await exportGdt({ srcProjJson: src, outPath: out, projectsDir: root, meta: { name: 't', sourceId: PID } });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.images, 4);            // A×2 + B + base64 (출현 = 엔트리, dedup 없음)
  assert.equal(r.goyaAssets, 3);
  assert.deepEqual(r.missingAssets, []);
  assert.equal(r.verify.ok, true);

  const z = await readZip(out);
  const imgEntries = Object.keys(z).filter(n => n.startsWith('images/')).sort();
  assert.deepEqual(imgEntries, ['images/img_0001.png', 'images/img_0002.png', 'images/img_0003.gif', 'images/img_0004.png']);
  // 엔트리 바이트 = 에셋 원본 그대로(재인코딩 없음) · 중복 출현은 같은 sha
  assert.equal(sha(z['images/img_0001.png']), sha(PNG));
  assert.equal(sha(z['images/img_0002.png']), sha(PNG));
  assert.equal(sha(z['images/img_0003.gif']), sha(GIF));
  assert.equal(sha(z['images/img_0004.png']), sha(PNG2));
  const pj = z['project.json'].toString('utf8');
  assert.equal((pj.match(/goya-asset:\/\//g) || []).length, 0);
  assert.equal((pj.match(/gdt:\/\/images\//g) || []).length, 4);
  assert.equal((pj.match(/data:image\//g) || []).length, 0);
  // 토큰 «주변» 바이트는 손대지 않는다 — 엔티티 인용·한글 그대로
  assert.ok(pj.includes('url(&quot;gdt://images/img_0002.png&quot;)'));
  assert.ok(pj.includes('텍스트 한글'));
  const manifest = JSON.parse(z['manifest.json'].toString('utf8'));
  assert.equal(manifest.formatVersion, 1);
  assert.equal(manifest.images.length, 4);
  assert.equal(manifest.images[0].goya, `${PID}/aaaaaaaaaaaaaaaa.png`);
  assert.equal(manifest.images[3].goya, undefined);
  assert.deepEqual(manifest.missingAssets, []);
  assert.equal(manifest.inlineRetained.goyaAssetMissing, 0);

  // ⓑ import — 현행 포맷 그대로 base64 로 돌아온다
  const importRoot = mkRoot();
  const ir = await importGdt({ gdtPath: out, projectsDir: importRoot });
  assert.equal(ir.ok, true, JSON.stringify(ir));
  assert.equal(ir.images, 4);
  const restored = fs.readFileSync(path.join(importRoot, ir.projectId, 'proj.json'), 'utf8');
  assert.equal((restored.match(/goya-asset:\/\//g) || []).length, 0);
  assert.equal((restored.match(/gdt:\/\//g) || []).length, 0);
  const b64s = b64In(restored);
  assert.equal(b64s.length, 4);
  // 바이트 동일 — 원본 에셋과 같고, 재인코딩이 없다
  assert.deepEqual(b64s.map(s => sha(Buffer.from(s, 'base64'))), [sha(PNG), sha(PNG), sha(GIF), sha(PNG2)]);
  assert.ok(restored.includes('data:image/gif;base64,'));
  const data = JSON.parse(restored);
  assert.equal(data.id, ir.projectId);             // §7 새 id · 내부 id 일치
  assert.equal(data.pages[0].canvas.includes('텍스트 한글'), true);
});

test('ⓒ 누락 에셋 → 실패가 아니라 경고: 토큰은 그대로, missingAssets 에 사유 기록, 나머지는 동봉', async () => {
  const root = mkRoot();
  const MISSING = `goya-asset://${PID}/cccccccccccccccc.png`;       // 파일 없음
  const OTHER = `goya-asset://proj_9999999999999/dddddddddddddddd.png`; // 프로젝트 자체가 없음
  const TRAV = `goya-asset://../eeeeeeeeeeeeeeee.png`;               // 경로 탈출 시도
  const BADEXT = `goya-asset://${PID}/ffffffffffffffff.txt`;         // 이미지 아님
  const LINK = `goya-asset://${PID}/gggggggggggggggg.png`;           // assets 밖을 가리키는 심볼릭 링크
  const canvas = `<img src="${A}"><img src="${MISSING}"><img src="${OTHER}"><img src="${TRAV}"><img src="${BADEXT}"><img src="${LINK}">`;
  const src = writeProject(root, PID, canvas, { 'aaaaaaaaaaaaaaaa.png': PNG });
  fs.writeFileSync(path.join(root, 'outside.png'), PNG);
  fs.symlinkSync(path.join(root, 'outside.png'), path.join(root, PID, 'assets', 'gggggggggggggggg.png'));
  const out = path.join(root, 'c.gdt');

  const r = await exportGdt({ srcProjJson: src, outPath: out, projectsDir: root });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.images, 1);
  assert.equal(r.goyaAssets, 1);
  assert.deepEqual(r.missingAssets, [
    { url: MISSING, reason: 'not_found' },
    { url: OTHER, reason: 'not_found' },
    { url: TRAV, reason: 'unsafe_path' },
    { url: BADEXT, reason: 'unsupported_ext' },
    { url: LINK, reason: 'unsafe_path' },
  ]);
  assert.equal(r.inlineRetained.goyaAssetMissing, 5);
  const z = await readZip(out);
  assert.deepEqual(Object.keys(z).filter(n => n.startsWith('images/')), ['images/img_0001.png']);
  const pj = z['project.json'].toString('utf8');
  // project.json 은 JSON 이라 따옴표가 `\"` 로 이스케이프돼 있다 — 토큰 자체와 그 뒤의 닫는 따옴표까지 그대로여야 한다
  for (const u of [MISSING, OTHER, TRAV, BADEXT, LINK]) assert.ok(pj.includes(`${u}\\"`), `토큰 보존: ${u}`);
  assert.ok(!pj.includes(A));
  assert.equal(JSON.parse(z['manifest.json'].toString('utf8')).missingAssets.length, 5);

  // import 도 된다(누락 토큰은 그대로 남는다 — 원본 맥에서도 깨져 있던 참조다)
  const ir = await importGdt({ gdtPath: out, projectsDir: mkRoot() });
  assert.equal(ir.ok, true, JSON.stringify(ir));
  assert.equal(ir.images, 1);
});

test('projectsDir 미지정 → src 경로에서 유도(<projectsDir>/<pid>/proj.json)', async () => {
  const root = mkRoot();
  const src = writeProject(root, PID, `<img src="${A}">`, { 'aaaaaaaaaaaaaaaa.png': PNG });
  const r = await exportGdt({ srcProjJson: src, outPath: path.join(root, 'd.gdt') });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.goyaAssets, 1);
  assert.deepEqual(r.missingAssets, []);
});

test('ⓓ 청크 경계: 토큰이 어느 오프셋에서 잘려도 결과가 1MB 청크와 바이트 동일', async () => {
  const root = mkRoot();
  // 긴 텍스트 사이에 goya·base64·누락 goya·평문 data URI·가짜 접두(goya-asset://만 있고 경로 없음)를 섞는다
  const pad = (n, ch) => ch.repeat(n);
  const MISSING = `goya-asset://${PID}/cccccccccccccccc.png`;
  const canvas = [
    pad(37, 'x'), `<img src="${A}">`, pad(91, '한'), `<div style="background:url(${B})">`, pad(5, 'y'),
    `<img src="${INLINE}">`, pad(130, 'z'), `<img src="${MISSING}">`, 'goya-asset://', pad(70, 'w'),
    `<i style="cursor:url(data:image/svg+xml,%3Csvg/%3E)">`, `<img src="${A}">`, pad(200, 'k'),
    `goya-asset://${'p'.repeat(80)}/x.png`,   // pid 65자 초과 → 토큰 아님, 그대로
    `<img src="${B}">`,
  ].join('');
  const src = writeProject(root, PID, canvas, { 'aaaaaaaaaaaaaaaa.png': PNG, 'bbbbbbbbbbbbbbbb.gif': GIF });

  const run = async (chunkSize) => {
    const stageDir = fs.mkdtempSync(path.join(root, 'stage-'));
    const t = await transformProjectJson({ srcPath: src, stageDir, projectsDir: root, chunkSize });
    return { t, pj: fs.readFileSync(t.projectJsonPath, 'latin1') };
  };
  const ref = await run(1 << 20);
  assert.equal(ref.t.images.length, 5);           // A, B, inline, A, B
  assert.equal(ref.t.goyaAssets, 4);
  assert.deepEqual(ref.t.missingAssets, [{ url: MISSING, reason: 'not_found' }]);
  assert.equal(ref.t.inlineRetained.plainDataUri, 1);
  assert.equal((ref.pj.match(/goya-asset:\/\//g) || []).length, 3);   // 누락 1 + 가짜 접두 1 + 과장 pid 1
  assert.ok(ref.pj.includes(`goya-asset://${'p'.repeat(80)}/x.png`));

  // 토큰 최대 길이(13+64+1+64=142) 안팎과 아주 작은 청크까지 — 모든 오프셋에서 경계가 한 번은 토큰을 자른다
  for (const cs of [1, 2, 3, 5, 7, 11, 13, 16, 29, 37, 64, 100, 141, 142, 143, 256, 1000]) {
    const r = await run(cs);
    assert.equal(r.pj, ref.pj, `chunkSize=${cs} project.json 불일치`);
    assert.deepEqual(r.t.images.map(i => [i.entry, i.sha256]), ref.t.images.map(i => [i.entry, i.sha256]), `chunkSize=${cs} images 불일치`);
    assert.deepEqual(r.t.missingAssets, ref.t.missingAssets, `chunkSize=${cs} missing 불일치`);
  }
});

/* ⓔ #16 스크래치패드 이식성 — 참고이미지 참조는 «캔버스 HTML 밖»(page.scratchpad 매니페스트)에도 산다.
 *   스캐너가 proj.json 을 «바이트로» 훑으니 원리상 잡히지만, 이 경로가 깨지면
 *   「참고이미지만 빠진 .gdt」가 나오고 그건 캔버스 이미지가 멀쩡해서 «눈에 안 띈다».
 *   ⇒ 매니페스트 «전용» 참조(캔버스엔 없음) + 좌표·그룹·linkDy 보존을 여기서 못 박는다.
 */
test('ⓔ page.scratchpad 매니페스트의 goya 참조도 동봉·복원되고 좌표/링크가 보존된다', async () => {
  const root = mkRoot();
  const dir = path.join(root, PID);
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'assets', 'aaaaaaaaaaaaaaaa.png'), PNG);
  fs.writeFileSync(path.join(dir, 'assets', 'bbbbbbbbbbbbbbbb.gif'), GIF);
  // ★캔버스엔 참조가 «없다» — 매니페스트만으로 동봉되는지 보는 게 이 테스트의 요점
  const proj = {
    version: 2, id: PID, name: 't-scratch', currentPageId: 'p1',
    pages: [{
      id: 'p1', name: 'Page 1', canvas: '<div class="section-block"><p>참고이미지 없음</p></div>',
      scratchpad: [
        { id: 's_1', src: A, x: 10, y: 20, w: 300, g: null, linkDy: 0 },
        { id: 's_2', src: B, x: -40, y: 90, w: 200, g: 'g1', linkDy: 12 },
      ],
    }],
    checklistItems: [],
  };
  const src = path.join(dir, 'proj.json');
  fs.writeFileSync(src, JSON.stringify(proj, null, 2));
  const out = path.join(root, 'scratch.gdt');

  const r = await exportGdt({ srcProjJson: src, outPath: out, projectsDir: root, meta: { name: 't', sourceId: PID } });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.goyaAssets, 2);
  assert.equal(r.images, 2);
  assert.deepEqual(r.missingAssets, []);

  const z = await readZip(out);
  assert.equal(sha(z['images/img_0001.png']), sha(PNG));
  assert.equal(sha(z['images/img_0002.gif']), sha(GIF));

  // 「다른 PC」 모사 — 완전히 다른 projectsDir 로 불러온다(원본 assets/ 가 없는 곳)
  const importRoot = mkRoot();
  const ir = await importGdt({ gdtPath: out, projectsDir: importRoot });
  assert.equal(ir.ok, true, JSON.stringify(ir));
  assert.equal(ir.images, 2);
  const restoredPath = path.join(importRoot, ir.projectId, 'proj.json');
  const restored = fs.readFileSync(restoredPath, 'utf8');
  // 깨진 참조가 하나도 없어야 한다 — 남으면 그 참고이미지는 다른 PC 에서 «안 보인다»
  assert.equal((restored.match(/goya-asset:\/\//g) || []).length, 0);
  assert.equal((restored.match(/gdt:\/\//g) || []).length, 0);

  const sp = JSON.parse(restored).pages[0].scratchpad;
  assert.equal(sp.length, 2);
  // 바이트 동일 — 재인코딩 없음
  assert.deepEqual(sp.map(s => sha(Buffer.from(String(s.src).split(';base64,')[1], 'base64'))), [sha(PNG), sha(GIF)]);
  assert.ok(sp[0].src.startsWith('data:image/png;base64,'));
  assert.ok(sp[1].src.startsWith('data:image/gif;base64,'));
  // 좌표·그룹·링크 오프셋은 손대지 않는다(하이드레이션이 이걸로 배치를 되살린다)
  assert.deepEqual(sp.map(({ id, x, y, w, g, linkDy }) => ({ id, x, y, w, g, linkDy })), [
    { id: 's_1', x: 10, y: 20, w: 300, g: null, linkDy: 0 },
    { id: 's_2', x: -40, y: 90, w: 200, g: 'g1', linkDy: 12 },
  ]);
});
