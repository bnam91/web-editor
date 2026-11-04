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
test('되돌린 프로젝트는 열 때 다시 변환하지 않는다 · 원본 해시 일치', () => {
  const f = fixture(); const orig = sha(f.proj);
  f.open();
  assert.strictEqual(inline(f), false);
  assert.strictEqual(sha(f.pre), orig, '변환 전 본 = 원본');
  assert.strictEqual(X.rollbackExternalize(f.root, f.id).ok, true);
  assert.strictEqual(sha(f.proj), orig);
  f.open();
  assert.strictEqual(sha(f.proj), orig, '되돌린 뒤 열기가 재변환하면 되돌리기가 안 된 것이다');
  assert.strictEqual(fs.existsSync(f.pre), false);
  assert.strictEqual(X.externalizeProjectFile(f.root, f.id).ok, true, '수동 변환은 된다');
  assert.strictEqual(inline(f), false);
});
function settings(raw) {
  const root = mkTmpRoot('goya-exts-'); const p = path.join(root, 'settings.json');
  if (raw) fs.writeFileSync(p, JSON.stringify(raw));
  const DEF = new Function(sliceBlock(MAIN, 'const DEFAULT_SETTINGS = ', '대상') + '\nreturn DEFAULT_SETTINGS;')();
  return new Function('fs', 'getSettingsPath', 'DEFAULT_SETTINGS', sliceBlock(MAIN, 'function readSettings(', '대상') + '\n' + sliceBlock(MAIN, 'function writeSettings(', '대상') + '\nreturn { readSettings, writeSettings };')(fs, () => p, DEF);
}
test('기본 켬: 새 설정 · 옛 판이 저장한 false 는 켜지고, 표지가 든 뒤의 끄기는 지킨다', () => {
  assert.strictEqual(settings().readSettings().autoExternalizeOnOpen, true);
  const s = settings({ autoExternalizeOnOpen: false, betaChannel: true });
  assert.strictEqual(s.readSettings().autoExternalizeOnOpen, true, '옛 false');
  assert.strictEqual(s.readSettings().betaChannel, true, '다른 값은 그대로');
  s.writeSettings({ betaChannel: false });
  assert.strictEqual(s.readSettings().autoExternalizeOnOpen, true, '다른 설정 저장 뒤에도');
  s.writeSettings({ autoExternalizeOnOpen: false });
  assert.strictEqual(s.readSettings().autoExternalizeOnOpen, false, '사용자가 끈 값');
  s.writeSettings({ betaChannel: true });
  assert.strictEqual(s.readSettings().autoExternalizeOnOpen, false, '끈 값이 다음 저장에도 산다');
  s.writeSettings({ autoExternalizeOnOpen: true });
  assert.strictEqual(s.readSettings().autoExternalizeOnOpen, true);
});
test('기본값 세 자리가 같다', () => {
  assert.match(readSrc(REPO, 'js/settings/settings-store.js'), /autoExternalizeOnOpen: true,/);
  assert.match(readSrc(REPO, 'js/settings/settings-modal.js'), /autoExternalizeOnOpen: cur\.autoExternalizeOnOpen !== false,/);
  assert.match(MAIN, /\n  autoExternalizeOnOpen: true,\n/);
});
test('성공은 말 없이, 일부 실패·변환 실패는 안내', () => {
  const toasts = []; const on = {};
  const window = { electronAPI: { onProjectExternalized: (c) => { on.ok = c; }, onExternalizeHint: (c) => { on.hint = c; } }, showToast: (m) => toasts.push(m) };
  const localStorage = { getItem: () => null, setItem() {} };
  new Function('window', 'localStorage', '_fmtMB', '_HINT_KEY', sliceBlock(readSrc(REPO, 'js/io/asset-externalize.js'), 'function _bindExternalizeEvents(', '대상') + '\n_bindExternalizeEvents();')(window, localStorage, () => '1MB', () => 'k');
  on.ok({ projectId: 'p', images: 2, skipped: 0 });
  assert.strictEqual(toasts.length, 0);
  on.ok({ projectId: 'p', images: 2, skipped: 1 });
  assert.match(toasts[0], /1장은 변환 실패/);
  on.hint({ projectId: 'p', reason: 'failed', error: 'x' });
  assert.match(toasts[1], /자동 최적화 실패/);
});
test('줄어들지 않는 변환은 실패 안내를 안 띄우고 파일도 안 건드린다', () => {
  // 작은 그림 + 들여쓴 재기록으로 커지는 본: 켜진 기본값에서 열 때마다 뜨면 안 된다
  const f = fixture(null, { pad: Array.from({ length: 3000 }, (_, i) => i) });
  const orig = sha(f.proj); f.open();
  assert.strictEqual(sha(f.proj), orig); assert.strictEqual(f.sent.length, 0);
});
test('열기 로드가 복구본 값을 싣는다 · 없으면 안 싣는다', () => {
  const src = readSrc(REPO, 'js/io/save-load.js');
  const store = {};
  const localStorage = { getItem: (k) => (k in store ? store[k] : null) };
  const hint = new Function('localStorage', 'SAVE_KEY_PREFIX', '_lsBaseKey', sliceBlock(src, 'function _lsOpenHint(', '대상') + '\nreturn _lsOpenHint;')(localStorage, 'web-editor-autosave', (i) => 'b__' + i);
  assert.deepStrictEqual(hint('p'), {});
  store['web-editor-autosave__p_ts'] = '5';
  assert.deepStrictEqual(hint('p'), {}, '본 없는 ts');
  store['web-editor-autosave__p'] = '{}'; store['b__p'] = UPD;
  assert.deepStrictEqual(hint('p'), { lsTs: 5, lsBase: UPD });
});
test('측정 스크립트의 대조가 맞은 변환은 통과, 어긋난 변환은 잡는다', () => {
  const { verifyConverted } = require(path.join(REPO, 'tools/conv-measure.cjs'));
  const f = fixture(); const src = f.proj + '.src'; fs.copyFileSync(f.proj, src); f.open();
  const v = verifyConverted(REPO, f.dir, f.id, src);
  assert.deepStrictEqual(v, { imagesUnique: 1, refs: 1, missing: 0, badAsset: 0, leftInline: 0, canvasExact: true });
  const a = fs.readdirSync(path.join(f.dir, 'assets'))[0];
  fs.writeFileSync(path.join(f.dir, 'assets', a), 'x');
  assert.strictEqual(verifyConverted(REPO, f.dir, f.id, src).badAsset, 1);
  const d = JSON.parse(fs.readFileSync(f.proj, 'utf8')); d.pages[0].canvas += 'y'; fs.writeFileSync(f.proj, JSON.stringify(d));
  assert.strictEqual(verifyConverted(REPO, f.dir, f.id, src).canvasExact, false);
});
