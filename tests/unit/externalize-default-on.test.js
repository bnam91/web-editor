/* externalize-default-on.test.js — 열 때 자동 변환 기본 켬(현빈 답 6661)이 지킬 것.
 * main.js 원문을 잘라 진짜 externalizer 와 작은 픽스처로 돌린다. 앱 값은 tools/conv-measure.cjs.
 * 실행: node --test tests/unit/externalize-default-on.test.js */
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
const X = require(path.join(REPO, 'main/project-store/externalizer.js'));
const MAIN = readSrc(REPO, 'main.js');
const PNG = 'data:image/png;base64,' + Buffer.alloc(3000, 7).toString('base64');
const UPD = '2026-01-01T00:00:00.000Z';
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

function fixture(meta, extra = {}) {
  const root = mkTmpRoot('goya-extd-'); const id = 'p1'; const dir = path.join(root, id);
  fs.mkdirSync(dir, { recursive: true });
  const canvas = `<div class="section-block"><img data-img-src="${PNG}"></div>`;
  fs.writeFileSync(path.join(dir, 'proj.json'), JSON.stringify({ id, version: 2, updatedAt: UPD, pages: [{ id: 'a', canvas }], ...extra }));
  const metaPath = path.join(dir, 'proj_meta.json');
  if (meta != null) fs.writeFileSync(metaPath, meta);
  const sent = [];
  const fn = new Function('fs', '_getExternalizer', '_safeSeg', '_resolveMetaJsonPath', 'PROJECTS_DIR', 'readSettings', '_refreshListMeta', 'EXTERNALIZE_HINT_MIN_BYTES',
    sliceBlock(MAIN, 'function _externalizeOnOpen(', '대상') + '\nreturn _externalizeOnOpen;')(
    fs, () => X, (s) => s, () => (fs.existsSync(metaPath) ? metaPath : null), root, () => ({ autoExternalizeOnOpen: true }), () => {}, 20 * 1024 * 1024);
  const open = (opts) => fn({ sender: { send: (ch, p) => sent.push({ ch, p }) } }, id, { open: true, ...opts });
  return { root, id, dir, proj: path.join(dir, 'proj.json'), pre: path.join(dir, X.BACKUP_NAME), sent, open };
}
const inline = (f) => fs.readFileSync(f.proj, 'utf8').includes('data:image');

test('복구본이 파일을 이길 수 있으면 변환을 미루고, 복구가 파일에 든 다음 열기에 변환한다', () => {
  const f = fixture();
  const before = sha(f.proj);
  f.open({ lsTs: Date.parse(UPD) + 1000, lsBase: UPD });
  assert.strictEqual(sha(f.proj), before, '이번 열기는 파일을 안 건드린다');
  assert.strictEqual(f.sent.length, 0);
  const d = JSON.parse(fs.readFileSync(f.proj, 'utf8'));   // 복구 저장
  d.pages[0].canvas += '<i>MARK-C</i>'; d.updatedAt = '2026-01-01T00:00:02.000Z';
  fs.writeFileSync(f.proj, JSON.stringify(d));
  f.open({ lsTs: Date.parse(UPD) + 1000, lsBase: d.updatedAt });
  assert.strictEqual(inline(f), false, '다음 열기는 변환한다');
  assert.ok(fs.readFileSync(f.pre, 'utf8').includes('MARK-C'), '변환 전 본에 복구분');
  assert.ok(fs.readFileSync(f.proj, 'utf8').includes('MARK-C'));
});
test('[음성] 복구 자격이 없는 본은 변환을 안 막는다: 파일보다 낡음 · 표시가 다름 · 본 없음', () => {
  for (const hint of [{ lsTs: Date.parse(UPD) - 1, lsBase: UPD }, { lsTs: Date.parse(UPD) + 1000, lsBase: 'other' }, {}]) {
    const f = fixture(); f.open(hint);
    assert.strictEqual(inline(f), false, JSON.stringify(hint));
  }
});
test('[음성] 협업·meta 못 읽음은 보류 유지', () => {
  for (const [meta, reason] of [['{"collabRef":"x"}', 'collab'], ['{잘림', 'meta_unreadable']]) {
    const f = fixture(meta); const before = sha(f.proj); f.open();
    assert.strictEqual(sha(f.proj), before); assert.strictEqual(f.sent[0].p.reason, reason);
  }
});
