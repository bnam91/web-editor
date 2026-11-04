/* externalize-safety.test.js — 자동 변환 기본 켬 리뷰 ①~⑤ 의 자. 진짜 externalizer · main.js·preload.js 원문 · 작은 픽스처. 앱 값은 tests/tools/conv-measure.cjs.
 * 실행: node --test tests/unit/externalize-safety.test.js */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { readSrc } = require('./_srcread.js');
const { sliceBlock } = require('./_slice-block.js');
const { mkTmpRoot } = require('./_tmproot.js');
const REPO = path.join(__dirname, '..', '..');
const XPATH = path.join(REPO, 'main/project-store/externalizer.js');
const X = require(XPATH);
const PNG = (n = 7) => 'data:image/png;base64,' + Buffer.alloc(3000, n).toString('base64');
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function fx(n = 7, extra = {}) {
  const root = mkTmpRoot('goya-exts-'); const id = 'p1'; const dir = path.join(root, id);
  fs.mkdirSync(dir, { recursive: true });
  const proj = path.join(dir, 'proj.json');
  fs.writeFileSync(proj, JSON.stringify({ id, version: 2, updatedAt: '2026-01-01T00:00:00.000Z', pages: [{ id: 'a', canvas: `<div class="section-block"><img data-img-src="${PNG(n)}"></div>` }], ...extra }));
  return { root, id, dir, proj, pre: path.join(dir, X.BACKUP_NAME), meta: path.join(dir, 'proj_meta.json') };
}
const addImage = (f, n) => { const d = JSON.parse(fs.readFileSync(f.proj, 'utf8')); d.pages[0].canvas += `<img data-img-src="${PNG(n)}">`; fs.writeFileSync(f.proj, JSON.stringify(d)); };
const allShas = (f) => fs.readdirSync(f.dir).filter((n) => /^proj_pre-externalize/.test(n)).map((n) => sha(path.join(f.dir, n)));
test('① 새 파일을 쓰다 죽어도 proj.json 은 원본으로 남고 원본 사본도 있다', () => {
  const f = fx(); const orig = sha(f.proj);
  const crash = `const fs=require('fs');for(const k of ['writeFileSync','openSync']){const o=fs[k];fs[k]=function(p,...a){if(typeof p==='string'&&p.endsWith('proj.json.tmp'))process.kill(process.pid,'SIGKILL');return o.call(this,p,...a)}}
require(${JSON.stringify(XPATH)}).externalizeProjectFile(${JSON.stringify(f.root)},${JSON.stringify(f.id)});`;
  const r = spawnSync(process.execPath, ['-e', crash]);
  assert.strictEqual(r.signal, 'SIGKILL', '쓰기 자리까지 갔다');
  assert.strictEqual(fs.existsSync(f.proj), true, 'proj.json 이 사라졌다');
  assert.strictEqual(sha(f.proj), orig);
  assert.strictEqual(sha(f.pre), orig);
});
test('① 쓰기 실패: proj.json 그대로 · 변환 전 본을 남기지 않는다 · 정직한 실패', () => {
  const f = fx(); const orig = sha(f.proj); const o = fs.renameSync;
  fs.renameSync = function (a, b) { if (String(b).endsWith('proj.json')) throw new Error('boom'); return o.call(this, a, b); };
  let r; try { r = X.externalizeProjectFile(f.root, f.id); } finally { fs.renameSync = o; }
  assert.strictEqual(r.ok, false); assert.strictEqual(r.reason, 'write_failed');
  assert.strictEqual(sha(f.proj), orig); assert.strictEqual(fs.existsSync(f.pre), false);
});
test('① 변환 전 본·새 파일을 디스크로 내린다(fsync)', () => {
  const f = fx(); const o = fs.fsyncSync; let n = 0;
  fs.fsyncSync = function (...a) { n++; return o.apply(this, a); };
  try { assert.strictEqual(X.externalizeProjectFile(f.root, f.id).ok, true); } finally { fs.fsyncSync = o; }
  assert.ok(n >= 3, `fsync ${n}번`);
});
test('④ 재변환이 쌓여도 최초 원본이 남는다', () => {
  const f = fx(); const first = sha(f.proj);
  assert.strictEqual(X.externalizeProjectFile(f.root, f.id).ok, true);
  for (let n = 20; n < 26; n++) { addImage(f, n); const t = Date.now(); while (Date.now() === t); assert.strictEqual(X.externalizeProjectFile(f.root, f.id).ok, true); }
  assert.ok(allShas(f).includes(first), '최초 원본이 회전으로 지워졌다');
  assert.ok(allShas(f).length <= 4, `쌓임 ${allShas(f).length}`);
});
