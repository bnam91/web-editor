/* externalize-safety2.test.js — 자동 변환 기본 켬 2차 리뷰의 자. 진짜 externalizer · main.js·preload.js 원문 · 작은 픽스처. 앱 값은 tests/tools/conv-measure.cjs.
 * 실행: node --test tests/unit/externalize-safety2.test.js */
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
test('① 재변환 쓰기 실패: 앞 변환 전 본이 고정 이름으로 돌아온다(되돌리기 버튼이 산다)', () => {
  const f = fx(); X.externalizeProjectFile(f.root, f.id);
  const prev = sha(f.pre); addImage(f, 30); const cur = sha(f.proj);
  const o = fs.renameSync;
  fs.renameSync = function (a, b) { if (String(b).endsWith('proj.json')) throw new Error('boom'); return o.call(this, a, b); };
  let r; try { r = X.externalizeProjectFile(f.root, f.id); } finally { fs.renameSync = o; }
  assert.strictEqual(r.reason, 'write_failed');
  assert.strictEqual(sha(f.proj), cur);
  assert.strictEqual(sha(f.pre), prev);
  assert.strictEqual(fs.readdirSync(f.dir).filter((n) => /^proj_pre-externalize\.\d+/.test(n)).length, 0, '회전본이 남았다');
  assert.strictEqual(X.scanProjectFile(f.root, f.id).hasBackup, true);
});
test('① 백업 자리 잡기 실패도 앞 본을 돌려놓는다', () => {
  const f = fx(); X.externalizeProjectFile(f.root, f.id);
  const prev = sha(f.pre); addImage(f, 31);
  const o = fs.renameSync;
  fs.renameSync = function (a, b) { if (String(a).endsWith('.tmp') && String(b).endsWith(X.BACKUP_NAME)) throw new Error('boom'); return o.call(this, a, b); };
  let r; try { r = X.externalizeProjectFile(f.root, f.id); } finally { fs.renameSync = o; }
  assert.strictEqual(r.reason, 'backup_failed');
  assert.strictEqual(sha(f.pre), prev);
});
