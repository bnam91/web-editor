/* market-carry-images — 마켓 올리기가 에셋 패널·AI 갤러리 그림을 올린 본에 싣는다(그 칸은 blobPath 만 있어 받는 쪽에 안 갔다). 원본 파일·proj.json 은 안 고친다.
 * 진짜 main.js 원문의 market:push 처리기를 돌린다, git·gh 없음. 받는 쪽은 tests/dom/market-carry-images.dom.spec.js, 앱 값은 회신 S3-MKT2. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { readSrc } = require('./_srcread.js');
const { sliceBlock } = require('./_slice-block.js');
const { mkTmpRoot } = require('./_tmproot.js');
const REPO = path.join(__dirname, '..', '..');
const BIG = (n) => Buffer.alloc(3000, n);

function boot({ maxOne = 95 * 1048576, maxAll = 400 * 1048576 } = {}) {
  const src = readSrc(REPO, 'main.js');
  const root = mkTmpRoot('goya-mkc-'), repo = mkTmpRoot('goya-mkr-');
  let handler; const gitCalls = [];
  const body = [
    sliceBlock(src, 'function _readAssetDataUri(', '대상'), sliceBlock(src, 'function _inlineGoyaAssets(', '대상'), sliceBlock(src, 'async function _carryProjectImages(', '대상'), sliceBlock(src, 'function _countMarketBytes(', '대상'), sliceBlock(src, 'function _marketTooBig(', '대상'),
    sliceBlock(src, 'function _blobsDir(', '대상'), sliceBlock(src, 'function _extractBlobs(', '대상'),
    src.slice(src.indexOf("ipcMain.handle('market:push'"), src.indexOf("ipcMain.handle('market:list'")),
  ].join('\n') + ';';
  new Function('fs', 'path', 'PROJECTS_DIR', '_safeSeg', '_GOYA_ASSET_MIME', '_crypto', 'ipcMain', '_ensureMarketRepo', '_safe', '_MAX_BYTES', '_MARKET_TOTAL_MAX', '_BLOB_MIN', '_BLOB_RE', '_versionHash', '_rebuildMarketIndex', '_execFileP', '_pushWithRebase', body)(
    fs, path, root, (x) => path.basename(String(x)), { png: 'image/png', jpg: 'image/jpeg' }, crypto, { handle: (_c, f) => { handler = f; } }, async () => repo, (x) => x, maxOne, maxAll, 2048, /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g, () => 'v', () => {}, async (c, a) => { gitCalls.push(a); }, async () => ({ ok: true }));
  const put = (sub, name, buf) => { const d = path.join(root, 'p1', sub); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, name), buf); return path.join(d, name); };
  const push = async (data) => {
    const r = await handler(null, { account: 'a', id: 'p1', name: 'n', data: JSON.stringify(data), scratch: [] });
    const f = path.join(repo, 'market', 'a', 'p1.json');
    return { r, saved: r.ok ? JSON.parse(fs.readFileSync(f, 'utf8')) : null };
  };
  const blobs = () => { try { return fs.readdirSync(path.join(repo, 'market', '_blobs')); } catch (_) { return []; } };
  return { put, push, root, repo, blobs, gitCalls, handler: (...a) => handler(...a) };
}
const base = (x) => ({ version: 2, pages: [{ id: 'p', canvas: '<p>글</p>' }], assetsTree: [], imageGallery: [], ...x });

const goya = (f) => '<img src="goya-asset://p1/' + f + '">';
const hash16 = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
const onCanvas = (...fs_) => ({ pages: [{ id: 'p', canvas: fs_.map(goya).join('') }] });
test('캔버스에 쓴 패널·갤러리 그림만 실린다: 파일명이 같거나 내용 해시가 같은 그림', async () => {
  const b = boot();
  b.put('assets', 'ast_a.png', BIG(1)); b.put('assets', 'ast_b.png', BIG(2));
  b.put('images', 'aig_c.png', BIG(3)); b.put('assets', hash16(BIG(3)) + '.png', BIG(3));
  const { r, saved } = await b.push(base({ ...onCanvas('ast_a.png', 'ast_b.png', hash16(BIG(3)) + '.png'),
    assetsTree: [{ id: 'ast_a', type: 'image', name: 'a', blobPath: 'assets/ast_a.png' }, { id: 'f', type: 'folder', children: [{ id: 'ast_b', type: 'image', blobPath: 'assets/ast_b.png' }] }],
    imageGallery: [{ id: 'aig_c', prompt: 'p', blobPath: 'images/aig_c.png' }] }));
  assert.strictEqual(r.ok, true); assert.strictEqual(r.omitted, 0);
  const d = JSON.parse(saved.data);
  assert.ok(!saved.data.includes('blobPath'));
  assert.match(d.assetsTree[0].src, /^goditor-blob:/); assert.strictEqual(d.assetsTree[0].carried, true);
  assert.match(d.assetsTree[1].children[0].src, /^goditor-blob:/);
  assert.match(d.imageGallery[0].src, /^goditor-blob:/); assert.strictEqual(d.imageGallery[0].prompt, 'p');
  assert.strictEqual(d.imageGallery[0].src, JSON.parse(saved.data).pages[0].canvas.match(/goditor-blob:[a-f0-9]+/g)[2], '같은 그림은 blob 하나');
});
test('캔버스의 data 그림과 내용이 같아도 쓴 것이다', async () => {
  const b = boot(); b.put('images', 'g.png', BIG(4));
  const { r, saved } = await b.push(base({ pages: [{ id: 'p', canvas: '<img src="data:image/png;base64,' + BIG(4).toString('base64') + '">' }], imageGallery: [{ id: 'g', blobPath: 'images/g.png' }] }));
  assert.strictEqual(r.omitted, 0); assert.strictEqual(JSON.parse(saved.data).imageGallery[0].carried, true);
});
test('안 쓴 항목은 이름·프롬프트까지 빠지고 파일도 안 실린다, 빠진 장수를 양쪽에 남긴다, 폴더는 남는다', async () => {
  const b = boot();
  b.put('assets', 'ast_u.png', BIG(5)); b.put('images', 'aig_u.png', BIG(6)); b.put('assets', 'ast_a.png', BIG(1));
  const { r, saved } = await b.push(base({ ...onCanvas('ast_a.png'),
    assetsTree: [{ id: 'f', type: 'folder', name: '폴더', children: [{ id: 'ast_u', type: 'image', name: '비밀이름', blobPath: 'assets/ast_u.png' }] }, { id: 'ast_a', type: 'image', blobPath: 'assets/ast_a.png' }],
    imageGallery: [{ id: 'aig_u', prompt: '비밀프롬프트', blobPath: 'images/aig_u.png' }] }));
  assert.strictEqual(r.ok, true); assert.strictEqual(r.omitted, 2); assert.strictEqual(saved.omittedImages, 2); assert.strictEqual(saved.blobCount, 2);
  assert.ok(!saved.data.includes('비밀')); assert.ok(!saved.data.includes('ast_u'));
  const d = JSON.parse(saved.data); assert.deepStrictEqual(d.assetsTree[0].children, []); assert.strictEqual(d.assetsTree[0].name, '폴더'); assert.deepStrictEqual(d.imageGallery, []);
  assert.strictEqual(b.blobs().length, 1);
});
test('음성: 스크래치에만 있는 패널 항목은 안 쓴 것이다, 스크래치 그림은 실린다', async () => {
  const b = boot(); b.put('assets', 'ast_s.png', BIG(7));
  const r = await b.handler(null, { account: 'a', id: 'p1', name: 'n', data: JSON.stringify(base({ assetsTree: [{ id: 's', type: 'image', blobPath: 'assets/ast_s.png' }] })), scratch: [{ src: 'goya-asset://p1/ast_s.png' }] });
  assert.strictEqual(r.ok, true); assert.strictEqual(r.omitted, 1);
  assert.match(JSON.parse(fs.readFileSync(path.join(b.repo, 'market', 'a', 'p1.json'), 'utf8')).scratch, /goditor-blob:/);
});
test('원본 파일은 안 고친다', async () => {
  const b = boot();
  const f = b.put('assets', 'ast_a.png', BIG(1));
  const pj = b.put('.', 'proj.json', Buffer.from('{"원본":1}'));
  const t = [fs.statSync(f).mtimeMs, fs.statSync(pj).mtimeMs];
  await b.push(base({ ...onCanvas('ast_a.png'), assetsTree: [{ id: 'ast_a', type: 'image', blobPath: 'assets/ast_a.png' }] }));
  assert.deepStrictEqual(fs.readFileSync(f), BIG(1)); assert.strictEqual(fs.readFileSync(pj, 'utf8'), '{"원본":1}');
  assert.deepStrictEqual([fs.statSync(f).mtimeMs, fs.statSync(pj).mtimeMs], t);
});
test('프로젝트 폴더 밖 경로는 안 읽는다, 그 항목은 빠진다', async () => {
  const b = boot();
  fs.writeFileSync(path.join(b.root, 'secret.png'), BIG(9));
  const { r, saved } = await b.push(base({ imageGallery: [{ id: 'x', blobPath: '../../secret.png' }, { id: 'y', blobPath: 'assets/../../secret.png' }, { id: 'z', blobPath: 'proj.json' }] }));
  assert.strictEqual(r.omitted, 3); assert.strictEqual(saved.blobCount, 0); assert.deepStrictEqual(JSON.parse(saved.data).imageGallery, []);
});
test('음성: blobPath 없는 프로젝트의 data 는 한 글자도 안 바뀐다, 앱 동봉 인라인 노드에 표식이 안 붙는다', async () => {
  const b = boot();
  const data = base({ assetsTree: [{ id: 'ast_notebg_01', type: 'image', src: 'data:image/png;base64,AQID' }] });
  const { r, saved } = await b.push(data);
  assert.strictEqual(r.ok, true); assert.strictEqual(saved.data, JSON.stringify(data)); assert.strictEqual(saved.omittedImages, 0);
});
test('갤러리 지우기·읽기 IPC 는 images/ 밖을 안 건드린다, 음성 images/ 안은 된다', () => {
  const src = readSrc(REPO, 'main.js'); const root = mkTmpRoot('goya-mkd-'); const h = {};
  const cut = (ch) => src.slice(src.indexOf("ipcMain.handle('" + ch + "'"), src.indexOf('});\n', src.indexOf("ipcMain.handle('" + ch + "'")) + 3);
  new Function('fs', 'path', 'PROJECTS_DIR', 'ipcMain', '_PAP', cut('ai:readImage') + ';' + cut('ai:deleteImage') + ';')(fs, path, root, { handle: (c, f) => { h[c] = f; } }, require('../../main/project-asset-path'));   // SEC ⑤ 경로 문 · id 는 허용목록 모양
  const d = path.join(root, 'proj_1'); fs.mkdirSync(path.join(d, 'images'), { recursive: true });
  const pj = path.join(d, 'proj.json'), g = path.join(d, 'images', 'g.png'); fs.writeFileSync(pj, '{}'); fs.writeFileSync(g, 'x');
  for (const ch of ['ai:deleteImage', 'ai:readImage']) for (const bp of ['proj.json', 'images/../proj.json', '../proj_1/proj.json']) {
    assert.strictEqual(h[ch](null, { projectId: 'proj_1', blobPath: bp }).ok, false, ch + ' ' + bp); assert.ok(fs.existsSync(pj));
  }
  assert.strictEqual(h['ai:readImage'](null, { projectId: 'proj_1', blobPath: 'images/g.png' }).ok, true);
  assert.strictEqual(h['ai:deleteImage'](null, { projectId: 'proj_1', blobPath: 'images/g.png' }).ok, true); assert.ok(!fs.existsSync(g));
});
const reads = (fn) => { const o = fs.promises.readFile; const r = fs.readFileSync; const seen = []; fs.promises.readFile = (p, ...a) => { seen.push(String(p)); return o.call(fs.promises, p, ...a); }; fs.readFileSync = (p, ...a) => { seen.push(String(p)); return r.call(fs, p, ...a); }; return fn().finally(() => { fs.promises.readFile = o; fs.readFileSync = r; }).then((v) => ({ v, seen })); };
test('한 장이 상한을 넘으면 읽기 전에 거절한다, 사람 말, blob·파일 0', async () => {
  const b = boot({ maxOne: 3000 });
  b.put('assets', 'big.png', BIG(1)); b.put('assets', 'ok.png', Buffer.alloc(30, 2));
  const { v: { r }, seen } = await reads(() => b.push(base({ ...onCanvas('ok.png', 'big.png'), assetsTree: [{ id: 'o', type: 'image', blobPath: 'assets/ok.png' }, { id: 'a', type: 'image', blobPath: 'assets/big.png' }] })));
  assert.strictEqual(r.ok, false); assert.match(r.message, /그림 한 장이 .*MB 라 올리지 않았습니다/);
  assert.ok(!seen.some((p) => /assets[\\/](big|ok)\.png$/.test(p)), '읽지 말아야 한다');
  assert.deepStrictEqual(b.blobs(), []); assert.deepStrictEqual(b.gitCalls, []);
});
test('합계가 상한을 넘으면 읽기 전에 거절한다, goya·스크래치 그림도 합계에 든다', async () => {
  const b = boot({ maxAll: 9000 });
  b.put('assets', 'a.png', BIG(1)); b.put('images', 'g.png', BIG(2)); b.put('assets', 'c.png', BIG(3));
  const { v: { r }, seen } = await reads(() => b.push(base({ assetsTree: [{ id: 'a', type: 'image', blobPath: 'assets/a.png' }], imageGallery: [{ id: 'g', blobPath: 'images/g.png' }], ...onCanvas('a.png', 'g.png', 'c.png') })));
  assert.strictEqual(r.ok, false); assert.match(r.message, /그림이 모두 .*MB 라 올리지 않았습니다/);
  assert.ok(!seen.some((p) => /(a|g|c)\.png$/.test(p)));
});
test('음성: 상한 안이면 올라간다', async () => {
  const b = boot({ maxOne: 5000, maxAll: 90000 });
  b.put('assets', 'a.png', BIG(1));
  const { r } = await b.push(base({ ...onCanvas('a.png'), assetsTree: [{ id: 'a', type: 'image', blobPath: 'assets/a.png' }] }));
  assert.strictEqual(r.ok, true); assert.strictEqual(b.blobs().length, 1);
});
test('data 그림이 상한을 넘어 거절돼도 blob 을 안 남긴다, 다음 올리기에 안 실린다', async () => {
  const b = boot({ maxOne: 4000 });
  const big = 'data:image/png;base64,' + Buffer.alloc(9000, 7).toString('base64');
  const { r } = await b.push(base({ pages: [{ id: 'p', canvas: '<img src="' + big + '">' }] }));
  assert.strictEqual(r.ok, false); assert.deepStrictEqual(b.blobs(), []); assert.deepStrictEqual(b.gitCalls, []);
  assert.strictEqual((await b.push(base())).r.ok, true); assert.deepStrictEqual(b.blobs(), []);
});
test('이 올리기가 쓰는 파일만 git add 한다, 옛 판이 남긴 blob 은 안 들어간다', async () => {
  const b = boot();
  const bdir = path.join(b.repo, 'market', '_blobs'); fs.mkdirSync(bdir, { recursive: true }); fs.writeFileSync(path.join(bdir, 'old.b64'), 'x');
  b.put('assets', 'a.png', BIG(1));
  await b.push(base({ ...onCanvas('a.png'), assetsTree: [{ id: 'a', type: 'image', blobPath: 'assets/a.png' }] }));
  const added = b.gitCalls.filter((a) => a.includes('add')).flatMap((a) => a.slice(a.indexOf('--') + 1));
  assert.ok(!b.gitCalls.some((a) => a.includes('-A'))); assert.ok(!added.includes('market/_blobs/old.b64'));
  const now = b.blobs().filter((f) => f !== 'old.b64');
  assert.deepStrictEqual(added.sort(), ['index.json', 'market/a/p1.json', 'market/_blobs/' + now[0]].sort());
});
test('음성: 큰 그림이어도 안 쓴 항목이면 거절하지 않고 뺀다', async () => {
  const b = boot({ maxOne: 3000 });
  b.put('images', 'big.png', BIG(1));
  const { r } = await b.push(base({ imageGallery: [{ id: 'g', blobPath: 'images/big.png' }] }));
  assert.strictEqual(r.ok, true); assert.strictEqual(r.omitted, 1);
});
test('폴더·권한 없는 파일은 올리기를 안 죽이고 뺀다, 나머지는 실린다', async () => {
  const b = boot();
  b.put('assets', 'b.png', BIG(2)); fs.mkdirSync(path.join(b.root, 'p1', 'assets', 'dir.png'));
  const no = b.put('assets', 'no.png', BIG(3)); fs.chmodSync(no, 0);
  const denied = (() => { try { fs.readFileSync(no); return false; } catch (_) { return true; } })();
  const { r, saved } = await b.push(base({ ...onCanvas('b.png'), assetsTree: [{ id: 'd', type: 'image', blobPath: 'assets/dir.png' }, { id: 'n', type: 'image', blobPath: 'assets/no.png' }, { id: 'b', type: 'image', blobPath: 'assets/b.png' }] }));
  fs.chmodSync(no, 0o644);
  assert.ok(denied, '시험 전제: 이 계정이 권한으로 막혀야 한다');
  assert.strictEqual(r.ok, true); assert.strictEqual(r.omitted, 2);
  const d = JSON.parse(saved.data); assert.strictEqual(d.assetsTree.length, 1); assert.match(d.assetsTree[0].src, /^goditor-blob:/);
});
test('캔버스에 쓴 그림을 못 읽으면 사람 말로 거절한다, 시스템 오류 원문이 안 나온다', async () => {
  const b = boot();
  const no = b.put('assets', 'no.png', BIG(3)); fs.chmodSync(no, 0);
  const { r } = await b.push(base({ ...onCanvas('no.png'), assetsTree: [{ id: 'n', type: 'image', blobPath: 'assets/no.png' }] }));
  fs.chmodSync(no, 0o644);
  assert.strictEqual(r.ok, false); assert.match(r.message, /찾지 못해/); assert.ok(!/EACCES/.test(r.message));
  assert.deepStrictEqual(b.blobs(), []);
});
