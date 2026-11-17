/* builtin-library — 0.9.13 내장 라이브러리 명부(js/data/builtin-library.js) · 동봉 파일 · main 가드 · 배선(현빈 결정 261117).
 * L1 명부 꼴: 묶음 id 겹침 0 · 칸(name·dir·source·license·items) 빈 것 0 · 파일 이름 겹침 0
 * L2 동봉 파일: 명부의 파일이 전부 레포에 있고 PNG/JPEG 머리 · main 가드(resolveBundledAsset)가 받아들임
 * L3 가드: assets/library 밖·꼼수 경로는 거절(옛 textures 는 그대로 받아들임)
 * L4 묶음별 내용(항목 커밋마다 한 줄씩 는다)
 * L5 배선(소스): 플러그인 패널 단추 → openLibraryModal · 모듈 script 태그
 * 양성대조(예측 · CTL): main/bundled-asset.js SAFE_DIRS 에서 'library' 를 빼면 → L2 빨강(가드가 거절) · L3 은 초록
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire as _cr } from 'node:module';
const _require = _cr(import.meta.url);
const { mkTmpRoot } = _require('./_tmproot.js');
const { readSrc } = _require('./_srcread.js');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../');
/* js/*.js 는 Node 가 CJS 로 읽는다 — texture-paper-seed 선례처럼 임시 폴더에 type:module 을 얹어 싣는다. */
const { LIBRARY, LIBRARY_ROOT } = await (async () => {
  const tmp = mkTmpRoot('gd-builtinlib-');
  fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
  fs.copyFileSync(path.join(ROOT, 'js/data/builtin-library.js'), path.join(tmp, 'm.js'));
  return await import(pathToFileURL(path.join(tmp, 'm.js')).href);
})();
const { resolveBundledAsset } = _require('../../main/bundled-asset.js');
const col = (id) => LIBRARY.find((c) => c.id === id);
const rel = (c, it) => `${LIBRARY_ROOT}/${c.dir}/${it.file}`;

test('L1 명부 꼴', () => {
  assert.equal(new Set(LIBRARY.map((c) => c.id)).size, LIBRARY.length, '묶음 id 겹침');
  for (const c of LIBRARY) {
    for (const k of ['id', 'name', 'dir', 'source', 'license']) assert.ok(typeof c[k] === 'string' && c[k].trim(), `${c.id}.${k} 빈칸`);
    assert.ok(Array.isArray(c.items) && c.items.length > 0, `${c.id} 칸 0`);
    assert.equal(new Set(c.items.map((i) => i.file)).size, c.items.length, `${c.id} 파일 겹침`);
    for (const it of c.items) assert.ok(it.name && it.file, `${c.id} 칸 이름/파일 빈칸`);
  }
});

test('L2 동봉 파일 — 전부 있고 그림 머리 · 가드가 받아들임', () => {
  for (const c of LIBRARY) for (const it of c.items) {
    const r = rel(c, it), full = path.join(ROOT, r);
    assert.ok(fs.existsSync(full), `없음: ${r}`);
    const b = fs.readFileSync(full);
    const png = b[0] === 0x89 && b[1] === 0x50, jpg = b[0] === 0xff && b[1] === 0xd8;
    assert.ok(png || jpg, `${r} PNG/JPEG 아님`);
    const g = resolveBundledAsset(ROOT, r);
    assert.equal(g.ok, true, `${r}: ${g.error}`);
    assert.equal(g.mime, png ? 'image/png' : 'image/jpeg', `${r} 확장자와 내용이 다름`);
  }
});

test('L3 가드 — library 밖·꼼수는 거절 · textures 는 그대로', () => {
  for (const bad of ['assets/library/../../main.js', 'assets/libraryX/a.png', 'assets/library/a.png.js', 'assets/library/x.txt',
                     'assets/library', 'assets/goditor-icon-128.png', '/etc/passwd']) {
    assert.equal(resolveBundledAsset(ROOT, bad).ok, false, `거절해야 함: ${bad}`);
  }
  assert.equal(resolveBundledAsset(ROOT, 'assets/textures/paper/paper-01.jpg').ok, true, '옛 textures 길');
});

test('L4 묶음별 내용', () => {
  const qr = col('qr-barcode');   // #16 t3-03
  assert.ok(qr, 'QR·바코드 묶음');
  assert.equal(qr.items.filter((i) => i.file.startsWith('qr_')).length, 7);
  assert.equal(qr.items.filter((i) => i.file.startsWith('bar_')).length, 6);
});

test('L5 배선 — 플러그인 패널 단추 · 모듈 script', () => {
  const html = readSrc(ROOT, 'index.html');
  assert.match(html, /id="plugin-library" onclick="openLibraryModal\(\)"/);
  assert.match(html, /<script type="module" src="js\/panels\/library-panel\.js"><\/script>/);
  const js = readSrc(ROOT, 'js/panels/library-panel.js');
  assert.match(js, /window\.openLibraryModal = openLibraryModal;/);
  assert.match(js, /from '\.\.\/data\/builtin-library\.js'/);
});
