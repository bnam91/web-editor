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

test('패널(폴더 안 포함)·갤러리 그림이 blob 으로 실리고 blobPath 는 빠진다', async () => {
  const b = boot();
  b.put('assets', 'ast_a.png', BIG(1)); b.put('assets', 'ast_b.png', BIG(2)); b.put('images', 'aig_c.png', BIG(3));
  const { r, saved } = await b.push(base({
    assetsTree: [{ id: 'ast_a', type: 'image', name: 'a', blobPath: 'assets/ast_a.png' }, { id: 'f', type: 'folder', children: [{ id: 'ast_b', type: 'image', blobPath: 'assets/ast_b.png' }] }],
    imageGallery: [{ id: 'aig_c', prompt: 'p', blobPath: 'images/aig_c.png' }],
  }));
  assert.strictEqual(r.ok, true); assert.strictEqual(r.skipped, 0); assert.strictEqual(saved.blobCount, 3);
  const d = JSON.parse(saved.data);
  assert.ok(!saved.data.includes('blobPath'));
  assert.match(d.assetsTree[0].src, /^goditor-blob:/); assert.strictEqual(d.assetsTree[0].carried, true);
  assert.match(d.assetsTree[1].children[0].src, /^goditor-blob:/);
  assert.match(d.imageGallery[0].src, /^goditor-blob:/); assert.strictEqual(d.imageGallery[0].prompt, 'p');
});
test('원본 파일은 안 고친다', async () => {
  const b = boot();
  const f = b.put('assets', 'ast_a.png', BIG(1));
  const pj = b.put('.', 'proj.json', Buffer.from('{"원본":1}'));
  const t = [fs.statSync(f).mtimeMs, fs.statSync(pj).mtimeMs];
  await b.push(base({ assetsTree: [{ id: 'ast_a', type: 'image', blobPath: 'assets/ast_a.png' }] }));
  assert.deepStrictEqual(fs.readFileSync(f), BIG(1)); assert.strictEqual(fs.readFileSync(pj, 'utf8'), '{"원본":1}');
  assert.deepStrictEqual([fs.statSync(f).mtimeMs, fs.statSync(pj).mtimeMs], t);
});
test('없는 파일은 세어 알리고 나머지는 올린다, 캔버스 그림과 달리 올리기를 막지 않는다', async () => {
  const b = boot();
  b.put('assets', 'ast_a.png', BIG(1));
  const { r, saved } = await b.push(base({ assetsTree: [{ id: 'ast_a', type: 'image', blobPath: 'assets/ast_a.png' }], imageGallery: [{ id: 'g', blobPath: 'images/none.png' }] }));
  assert.strictEqual(r.ok, true); assert.strictEqual(r.skipped, 1);
  const d = JSON.parse(saved.data);
  assert.match(d.assetsTree[0].src, /^goditor-blob:/); assert.strictEqual(d.imageGallery[0].blobPath, 'images/none.png'); assert.strictEqual(d.imageGallery[0].carried, undefined);
});
test('프로젝트 폴더 밖 경로는 안 읽는다', async () => {
  const b = boot();
  fs.writeFileSync(path.join(b.root, 'secret.png'), BIG(9));
  const { r, saved } = await b.push(base({ imageGallery: [{ id: 'x', blobPath: '../../secret.png' }, { id: 'y', blobPath: 'assets/../../secret.png' }, { id: 'z', blobPath: 'proj.json' }] }));
  assert.strictEqual(r.skipped, 3); assert.strictEqual(saved.blobCount, 0);
  assert.ok(!JSON.parse(saved.data).imageGallery.some((n) => n.src));
});
test('음성: blobPath 없는 프로젝트의 data 는 한 글자도 안 바뀐다, 앱 동봉 인라인 노드에 표식이 안 붙는다', async () => {
  const b = boot();
  const data = base({ assetsTree: [{ id: 'ast_notebg_01', type: 'image', src: 'data:image/png;base64,AQID' }] });
  const { r, saved } = await b.push(data);
  assert.strictEqual(r.ok, true); assert.strictEqual(saved.data, JSON.stringify(data));
});
test('갤러리 지우기·읽기 IPC 는 images/ 밖을 안 건드린다, 음성 images/ 안은 된다', () => {
  const src = readSrc(REPO, 'main.js'); const root = mkTmpRoot('goya-mkd-'); const h = {};
  const cut = (ch) => src.slice(src.indexOf("ipcMain.handle('" + ch + "'"), src.indexOf('});\n', src.indexOf("ipcMain.handle('" + ch + "'")) + 3);
  new Function('fs', 'path', 'PROJECTS_DIR', 'ipcMain', cut('ai:readImage') + ';' + cut('ai:deleteImage') + ';')(fs, path, root, { handle: (c, f) => { h[c] = f; } });
  const d = path.join(root, 'p1'); fs.mkdirSync(path.join(d, 'images'), { recursive: true });
  const pj = path.join(d, 'proj.json'), g = path.join(d, 'images', 'g.png'); fs.writeFileSync(pj, '{}'); fs.writeFileSync(g, 'x');
  for (const ch of ['ai:deleteImage', 'ai:readImage']) for (const bp of ['proj.json', 'images/../proj.json', '../p1/proj.json']) {
    assert.strictEqual(h[ch](null, { projectId: 'p1', blobPath: bp }).ok, false, ch + ' ' + bp); assert.ok(fs.existsSync(pj));
  }
  assert.strictEqual(h['ai:readImage'](null, { projectId: 'p1', blobPath: 'images/g.png' }).ok, true);
  assert.strictEqual(h['ai:deleteImage'](null, { projectId: 'p1', blobPath: 'images/g.png' }).ok, true); assert.ok(!fs.existsSync(g));
});
const reads = (fn) => { const o = fs.promises.readFile; const r = fs.readFileSync; const seen = []; fs.promises.readFile = (p, ...a) => { seen.push(String(p)); return o.call(fs.promises, p, ...a); }; fs.readFileSync = (p, ...a) => { seen.push(String(p)); return r.call(fs, p, ...a); }; return fn().finally(() => { fs.promises.readFile = o; fs.readFileSync = r; }).then((v) => ({ v, seen })); };
test('한 장이 상한을 넘으면 읽기 전에 거절한다, 사람 말, blob·파일 0', async () => {
  const b = boot({ maxOne: 3000 });
  b.put('assets', 'big.png', BIG(1)); b.put('assets', 'ok.png', Buffer.alloc(30, 2));
  const { v: { r }, seen } = await reads(() => b.push(base({ assetsTree: [{ id: 'o', type: 'image', blobPath: 'assets/ok.png' }, { id: 'a', type: 'image', blobPath: 'assets/big.png' }] })));
  assert.strictEqual(r.ok, false); assert.match(r.message, /그림 한 장이 .*MB 라 올리지 않았습니다/);
  assert.ok(!seen.some((p) => /assets[\\/](big|ok)\.png$/.test(p)), '읽지 말아야 한다');
  assert.deepStrictEqual(b.blobs(), []); assert.deepStrictEqual(b.gitCalls, []);
});
test('합계가 상한을 넘으면 읽기 전에 거절한다, goya·스크래치 그림도 합계에 든다', async () => {
  const b = boot({ maxAll: 9000 });
  b.put('assets', 'a.png', BIG(1)); b.put('images', 'g.png', BIG(2)); b.put('assets', 'c.png', BIG(3));
  const { v: { r }, seen } = await reads(() => b.push(base({ assetsTree: [{ id: 'a', type: 'image', blobPath: 'assets/a.png' }], imageGallery: [{ id: 'g', blobPath: 'images/g.png' }], pages: [{ id: 'p', canvas: '<img src="goya-asset://p1/c.png">' }] })));
  assert.strictEqual(r.ok, false); assert.match(r.message, /그림이 모두 .*MB 라 올리지 않았습니다/);
  assert.ok(!seen.some((p) => /(a|g|c)\.png$/.test(p)));
});
test('음성: 상한 안이면 올라간다', async () => {
  const b = boot({ maxOne: 5000, maxAll: 90000 });
  b.put('assets', 'a.png', BIG(1));
  const { r } = await b.push(base({ assetsTree: [{ id: 'a', type: 'image', blobPath: 'assets/a.png' }] }));
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
  await b.push(base({ assetsTree: [{ id: 'a', type: 'image', blobPath: 'assets/a.png' }] }));
  const added = b.gitCalls.filter((a) => a.includes('add')).flatMap((a) => a.slice(a.indexOf('--') + 1));
  assert.ok(!b.gitCalls.some((a) => a.includes('-A'))); assert.ok(!added.includes('market/_blobs/old.b64'));
  const now = b.blobs().filter((f) => f !== 'old.b64');
  assert.deepStrictEqual(added.sort(), ['index.json', 'market/a/p1.json', 'market/_blobs/' + now[0]].sort());
});
test('폴더·권한 없는 파일은 세고 나머지는 올린다, 올리기 전체를 안 죽인다', async () => {
  const b = boot();
  b.put('assets', 'b.png', BIG(2)); fs.mkdirSync(path.join(b.root, 'p1', 'assets', 'dir.png'));
  const no = b.put('assets', 'no.png', BIG(3)); fs.chmodSync(no, 0);
  const denied = (() => { try { fs.readFileSync(no); return false; } catch (_) { return true; } })();
  const { r, saved } = await b.push(base({ assetsTree: [{ id: 'd', type: 'image', blobPath: 'assets/dir.png' }, { id: 'n', type: 'image', blobPath: 'assets/no.png' }, { id: 'b', type: 'image', blobPath: 'assets/b.png' }] }));
  fs.chmodSync(no, 0o644);
  assert.ok(denied, '시험 전제: 이 계정이 권한으로 막혀야 한다');
  assert.strictEqual(r.ok, true); assert.strictEqual(r.skipped, 2);
  const d = JSON.parse(saved.data); assert.match(d.assetsTree[2].src, /^goditor-blob:/); assert.strictEqual(d.assetsTree[0].blobPath, 'assets/dir.png');
});
