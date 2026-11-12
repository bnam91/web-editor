/* sec-asset-path-traversal — SEC-ASSET-PATH-TRAVERSAL-01 (Codex 감사 ⑤ · 현빈 GO 261112)
 *   ★진짜 main 핸들러(_ipc-harness) · 진짜 claude-pm ipc 문. 렌더러가 줄 수 있는 값만 넣는다.
 *   공격(고치기 전 빨강):
 *     A1 assets:saveFile · ai:saveImage — projectId '../outside' 로 프로젝트 루트 «밖»에 파일 쓰기
 *     A2 assets:readFile — projectId '../outside' + blobPath 'assets/s.png' (옛 검사는 같은 id 로 루트를 지어 통과)
 *     A3 assets:readFile·deleteFile — 접두어 함정 blobPath 'assets-evil/s.png' (옛 검사 startsWith 에 구분자 없음)
 *     A4 ai:readImage·deleteImage — projectId '../outside' (옛 검사는 images/+sep 였지만 id 가 날것)
 *     A5 assets:readFile — assets/ 안 정션(디렉터리 링크)이 밖을 가리킴(realpath) · 어디서나 «있는 칸»
 *     A6 claudePM:ensureFolder — 렌더러가 basePath 로 임의 폴더를 주면 거기에 CLAUDE.md·.mcp.json 을 만든다
 *   정상(지금도 초록이어야):
 *     N1 proj_·plan_ 프로젝트 assets 쓰기→읽기→지우기 · N2 AI 이미지 쓰기→읽기→지우기 · N3 ensureFolder 기본 자리
 *     N4 첫 실행 샘플 'proj_sample' 자산·AI 이미지 왕복 (회귀 · 수지맥 실앱 261113)
 *   A7 proj_sample «닮은꼴»(proj_sample../x · proj_sample/../x · 대소문자 · 꼬리 글자)은 거절 — 예외는 정확히 한 글자열
 *   가드 되돌림 양성대조: main.js 의 _PAP 줄들(이 커밋 hunk)과 ipc.js ensureFolder 문을 되돌리면 A1~A6 빨강. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { loadMain } = require('./_ipc-harness');
const { mkTmpRoot } = require('./_tmproot');

const H = loadMain();
const OUT = path.join(path.dirname(H.projectsDir), 'outside');      // 프로젝트 루트의 «이웃» — ../outside 가 닿는 곳
const B64 = Buffer.from('PNGDATA').toString('base64');
const put = (p, s = 'SECRET') => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); return p; };
const filesUnder = (d) => { try { return fs.readdirSync(d, { recursive: true }); } catch (_) { return []; } };

test('A1 쓰기 — projectId ../outside 로 루트 밖에 파일이 안 생긴다 (assets:saveFile · ai:saveImage)', async () => {
  for (const ch of ['assets:saveFile', 'ai:saveImage']) {
    const r = await H.invoke(ch, { projectId: '../outside', b64: B64, mime: 'image/png' });
    assert.equal(r.ok, false, `★${ch} 가 받았다: ${JSON.stringify(r)}`);
  }
  assert.deepEqual(filesUnder(OUT), [], '★프로젝트 루트 밖에 파일이 생겼다');
});

test('A2 읽기 — projectId ../outside 로 루트 밖 assets/ 를 못 읽는다', async () => {
  put(path.join(OUT, 'assets', 's.png'));
  const r = await H.invoke('assets:readFile', { projectId: '../outside', blobPath: 'assets/s.png' });
  assert.equal(r.ok, false, '★루트 밖 파일을 읽었다');
});

test('A3 접두어 함정 — assets-evil/ 은 assets/ 가 아니다 (읽기 · 지우기)', async () => {
  const f = put(path.join(H.projectsDir, 'proj_7001', 'assets-evil', 's.png'));
  assert.equal((await H.invoke('assets:readFile', { projectId: 'proj_7001', blobPath: 'assets-evil/s.png' })).ok, false, '★assets-evil 을 읽었다');
  await H.invoke('assets:deleteFile', { projectId: 'proj_7001', blobPath: 'assets-evil/s.png' });
  assert.ok(fs.existsSync(f), '★assets-evil 파일을 지웠다');
  const pj = put(path.join(H.projectsDir, 'proj_7001', 'proj.json'), '{}');
  await H.invoke('assets:deleteFile', { projectId: 'proj_7001', blobPath: 'assets/../proj.json' });
  assert.ok(fs.existsSync(pj), '★assets/../proj.json 을 지웠다');
});

test('A4 AI 갤러리 — projectId ../outside 로 루트 밖 images/ 를 못 읽고 못 지운다', async () => {
  const f = put(path.join(OUT, 'images', 'g.png'));
  assert.equal((await H.invoke('ai:readImage', { projectId: '../outside', blobPath: 'images/g.png' })).ok, false, '★루트 밖 이미지를 읽었다');
  await H.invoke('ai:deleteImage', { projectId: '../outside', blobPath: 'images/g.png' });
  assert.ok(fs.existsSync(f), '★루트 밖 이미지를 지웠다');
});

/* A5 — 정션(디렉터리 링크 · 비승격 윈도우에서도 된다 · _link.js 정본 · win-portability Ⓒ-3). 못 만들면 «소리내어» 던진다(건너뛰지 않는다). */
const { linkToDirOutside } = require('./_link');
test('A5 링크 — assets/ 안 정션이 루트 밖 폴더를 가리키면 안 읽는다 (realpath 경계)', async () => {
  const outDir = path.join(path.dirname(H.projectsDir), 'outside-link');      // A1 이 재는 OUT 과 따로
  put(path.join(outDir, 'linked.png'));
  const assets = path.join(H.projectsDir, 'proj_7002', 'assets');
  fs.mkdirSync(assets, { recursive: true });
  const link = linkToDirOutside(outDir, path.join(assets, 'lnk'));
  assert.equal(fs.readFileSync(path.join(link, 'linked.png'), 'utf8'), 'SECRET', '[전제] 링크를 따라가면 밖 파일이 읽힌다');
  const r = await H.invoke('assets:readFile', { projectId: 'proj_7002', blobPath: 'assets/lnk/linked.png' });
  assert.equal(r.ok, false, '★링크를 따라 루트 밖 파일을 읽었다');
  assert.equal(r.error, 'path traversal', `경계에서 막혀야 한다: ${JSON.stringify(r)}`);
});

const PM = require('../../main/claude-pm/ipc');
const pmRoot = mkTmpRoot('sec-pm-');
PM.setPmProjectsRoot(() => pmRoot);
const pmH = {};
PM.registerClaudePMIPC({ handle: (c, f) => { pmH[c] = f; } }, () => true);

test('A6 claudePM:ensureFolder — 렌더러가 준 basePath 폴더에 아무것도 안 만든다', async () => {
  const evil = path.join(mkTmpRoot('sec-pm-evil-'), 'pwn');
  fs.mkdirSync(path.join(pmRoot, 'proj_7003'), { recursive: true });
  const r = await pmH['claudePM:ensureFolder']({}, { projectId: 'proj_7003', projectName: 'x', basePath: evil });
  assert.equal(fs.existsSync(evil), false, `★basePath 로 준 폴더가 생겼다: ${JSON.stringify(r)}`);
  assert.ok(!r || !r.folderPath || path.resolve(r.folderPath).startsWith(path.resolve(pmRoot) + path.sep), `★PM 폴더가 뿌리 밖: ${r && r.folderPath}`);
});

test('N1 [정상] proj_·plan_ 프로젝트 자산 쓰기 → 읽기 → 지우기', async () => {
  for (const pid of ['proj_7010', 'plan_7011']) {
    const s = await H.invoke('assets:saveFile', { projectId: pid, b64: B64, mime: 'image/png' });
    assert.equal(s.ok, true, JSON.stringify(s));
    assert.match(s.blobPath, /^assets\/ast_\w+\.png$/);
    const r = await H.invoke('assets:readFile', { projectId: pid, blobPath: s.blobPath });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.dataUrl, 'data:image/png;base64,' + B64);
    assert.equal((await H.invoke('assets:deleteFile', { projectId: pid, blobPath: s.blobPath })).ok, true);
    assert.equal(fs.existsSync(path.join(H.projectsDir, pid, s.blobPath)), false);
  }
  const c = await H.invoke('assets:saveCanvasImage', { projectId: 'proj_7010', b64: B64, mime: 'image/png' });
  assert.equal(c.ok, true, JSON.stringify(c));
});

test('N2 [정상] AI 이미지 쓰기 → 읽기 → 지우기', async () => {
  const s = await H.invoke('ai:saveImage', { projectId: 'proj_7012', b64: B64, mime: 'image/png' });
  assert.equal(s.ok, true, JSON.stringify(s));
  assert.equal((await H.invoke('ai:readImage', { projectId: 'proj_7012', blobPath: s.blobPath })).ok, true);
  assert.equal((await H.invoke('ai:deleteImage', { projectId: 'proj_7012', blobPath: s.blobPath })).ok, true);
});

test('N3 [정상] ensureFolder 기본 자리(<뿌리>/<id>/claude-pm) 는 그대로 만든다', async () => {
  fs.mkdirSync(path.join(pmRoot, 'proj_7004'), { recursive: true });
  const r = await pmH['claudePM:ensureFolder']({}, { projectId: 'proj_7004', projectName: '정상' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(path.resolve(r.folderPath), path.join(path.resolve(pmRoot), 'proj_7004', 'claude-pm'));
});

test("N4 [정상·회귀] 첫 실행 샘플 'proj_sample' — 자산·AI 이미지 쓰기 → 읽기 → 지우기", async () => {
  const pid = 'proj_sample';
  const s = await H.invoke('assets:saveFile', { projectId: pid, b64: B64, mime: 'image/png' });
  assert.equal(s.ok, true, `★샘플 프로젝트에 이미지를 못 넣는다: ${JSON.stringify(s)}`);
  const r = await H.invoke('assets:readFile', { projectId: pid, blobPath: s.blobPath });
  assert.equal(r.ok && r.dataUrl, 'data:image/png;base64,' + B64, JSON.stringify(r));
  assert.equal((await H.invoke('assets:deleteFile', { projectId: pid, blobPath: s.blobPath })).ok, true);
  assert.equal(fs.existsSync(path.join(H.projectsDir, pid, s.blobPath)), false);
  const g = await H.invoke('ai:saveImage', { projectId: pid, b64: B64, mime: 'image/png' });
  assert.equal(g.ok, true, JSON.stringify(g));
  assert.equal((await H.invoke('ai:readImage', { projectId: pid, blobPath: g.blobPath })).ok, true);
  assert.equal((await H.invoke('ai:deleteImage', { projectId: pid, blobPath: g.blobPath })).ok, true);
});

test('A7 proj_sample 닮은꼴은 거절 — 예외는 «정확히» proj_sample 하나', async () => {
  const before = filesUnder(OUT).sort();          // A2·A4 가 심은 표식은 이미 있다 — «늘지 않음»을 잰다
  for (const pid of ['proj_sample../outside', 'proj_sample/../../outside', '../outside/proj_sample', 'PROJ_SAMPLE', 'proj_sample ', 'proj_sample_1', 'proj_samplex', 'proj_sample\n']) {
    const r = await H.invoke('assets:saveFile', { projectId: pid, b64: B64, mime: 'image/png' });
    assert.equal(r.ok, false, `★${JSON.stringify(pid)} 를 받았다: ${JSON.stringify(r)}`);
    assert.equal((await H.invoke('ai:saveImage', { projectId: pid, b64: B64, mime: 'image/png' })).ok, false, JSON.stringify(pid));
  }
  assert.deepEqual(filesUnder(OUT).sort(), before, '★프로젝트 루트 밖에 파일이 생겼다');
});
