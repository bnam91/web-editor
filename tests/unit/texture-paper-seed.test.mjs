/* U-PAPERTEX — background 폴더 아래 「texture paper」 + 종이 8장 «한 번만» 시드 (1013t2A4)
 *   실행: bash /Users/a1/.gd-work/taeyang-098/run-test.sh unit
 *
 * ★무엇을 잠그나 (지디 승인 조건)
 *   ⓐ 보호 안 함 — 폴더·이미지에 favorite/texture/locked 가 없다(사용자가 지울 수 있다)
 *   ⓑ 한 번만 — background 폴더 seeded[] 의 표식. 지운 뒤 다시 열어도 안 돌아온다
 *   ⓒ 옛 프로젝트(표식 없음)는 첫 열기 때 한 번 시드
 *   + 8개·이름·순서 · 인라인 data URI 없음(bundled 만) · 동봉 파일 8개가 실제 JPEG · main 가드
 *
 * ★음성대조(이 파일을 만든 뒤 실제로 돌려 본 값 — 보고서 참조)
 *   seedPaperTexturesOnce 의 표식 검사 줄(`if (bgFolder.seeded.includes(...)) return false;`)을 빼고
 *   run-test.sh unit 으로 잰 값(2026-10-14): ✖ T2(한 번만) · ✖ T3(폴더째 지우면 안 돌아옴) · ✖ T5(표식 한 번) · ✖ T6(옛 프로젝트 두 번째 열기).
 *   ⚠️T4(한 장만 지움)는 그때도 초록이다 — 폴더가 남아 있으면 같은 id 폴더 가드(T8)가 겹쳐 만들기를 막기 때문.
 *     즉 T4 가 잠그는 것은 «빠진 장을 채워 넣는» 변형이지 표식이 아니다.
 *
 * ⚠️DOM·앱 없이 «순수 함수 + 저장 왕복(JSON)»만 잰다. 앱에서 폴더가 실제로 보이는지·캔버스·내보내기는
 *   /Users/a1/.gd-work/taeyang-098/proto/A4-measure/ 의 측정 스크립트가 잰다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire as _cr } from 'node:module';
const _require = _cr(import.meta.url);
const { mkTmpRoot } = _require('./_tmproot.js');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../');

/* js/*.js 는 Node 가 CJS 로 읽는다 — 선례(bulk-align-targets.test.mjs)처럼 임시 폴더에 type:module 을 얹어 싣는다. */
const M = await (async () => {
  const tmp = mkTmpRoot('gd-papertex-');
  fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
  fs.copyFileSync(path.join(ROOT, 'js/data/paper-textures.js'), path.join(tmp, 'm.js'));
  return await import(pathToFileURL(path.join(tmp, 'm.js')).href);
})();
const { seedPaperTexturesOnce, PAPER_TEX_FOLDER_ID, PAPER_TEX_FOLDER_NAME, PAPER_TEX_SEED_MARK, PAPER_TEXTURES } = M;
const { resolveBundledAsset } = _require('../../main/bundled-asset.js');
const { readSrc } = _require('./_srcread.js');          // ★소스 읽기는 LF 정규화본으로(win-portability ①-3)
const { sliceBlock, sliceCall } = _require('./_slice-block.js');  // ★구간 끝은 세어서 찾는다(slice-block-shared SB-16)

const newBg = () => ({ id: 'ast_bg', type: 'folder', name: 'background', texture: true, children: [], collapsed: false });
const roundTrip = (o) => JSON.parse(JSON.stringify(o));   // 저장(직렬화) → 다시 열기(파싱)
const paperFolders = (bg) => (bg.children || []).filter(n => n && n.id === PAPER_TEX_FOLDER_ID);
const EXPECT_NAMES = ['paper-01', 'paper-02', 'paper-03', 'paper-04', 'paper-05', 'paper-06', 'paper-07', 'paper-08'];

test('T1 새 프로젝트: texture paper 폴더 1개 + 이미지 8개 · 이름·순서 · bundled 만(인라인 data URI 없음)', () => {
  const bg = newBg();
  assert.equal(bg.children.length, 0, '전제: 빈 background');
  assert.equal(seedPaperTexturesOnce(bg, '2026-10-14T00:00:00.000Z'), true);
  const fs_ = paperFolders(bg);
  assert.equal(fs_.length, 1);
  const f = fs_[0];
  assert.equal(f.type, 'folder');
  assert.equal(f.name, PAPER_TEX_FOLDER_NAME);
  assert.equal(f.name, 'texture paper');
  assert.equal(f.children.length, 8);
  assert.deepEqual(f.children.map(n => n.name), EXPECT_NAMES);
  assert.deepEqual(f.children.map(n => n.id), EXPECT_NAMES.map((_, i) => `ast_paperbg_0${i + 1}`));
  for (const n of f.children) {
    assert.equal(n.type, 'image');
    assert.equal(n.mime, 'image/jpeg');
    assert.match(n.bundled, /^assets\/textures\/paper\/paper-0[1-8]\.jpg$/);
    assert.equal(n.blobPath, undefined, 'blobPath 없음(프로젝트 폴더에 복사 안 함)');
    assert.equal(n.src, undefined, '⛔인라인 src 금지');
    assert.ok(!JSON.stringify(n).includes('data:'), '⛔노드 어디에도 data URI 없음');
  }
  assert.ok(JSON.stringify(f).length < 2000, `폴더 직렬화 크기 ${JSON.stringify(f).length} B — 프로젝트 JSON 이 거의 안 늘어난다`);
});

test('T2 한 번만: 다시 열어도(왕복 후 재시드) 중복 없음', () => {
  let bg = newBg();
  seedPaperTexturesOnce(bg);
  bg = roundTrip(bg);
  assert.equal(seedPaperTexturesOnce(bg), false);
  bg = roundTrip(bg);
  assert.equal(seedPaperTexturesOnce(bg), false);
  assert.equal(paperFolders(bg).length, 1);
  assert.equal(paperFolders(bg)[0].children.length, 8);
});

test('T3 지우면 안 돌아옴: 폴더째 지우고 저장·다시 열기 → 다시 안 생김', () => {
  let bg = newBg();
  seedPaperTexturesOnce(bg);
  assert.equal(paperFolders(bg).length, 1, '전제: 시드됨');
  bg.children = bg.children.filter(n => n.id !== PAPER_TEX_FOLDER_ID);   // 사용자가 지움
  bg = roundTrip(bg);
  seedPaperTexturesOnce(bg);
  bg = roundTrip(bg);
  seedPaperTexturesOnce(bg);
  assert.equal(paperFolders(bg).length, 0, '지운 폴더가 되살아났다');
});

test('T4 지우면 안 돌아옴: 한 장만 지워도 그 장이 안 돌아옴', () => {
  let bg = newBg();
  seedPaperTexturesOnce(bg);
  const f = paperFolders(bg)[0];
  f.children = f.children.filter(n => n.id !== 'ast_paperbg_03');
  assert.equal(f.children.length, 7, '전제: 7장');
  bg = roundTrip(bg);
  seedPaperTexturesOnce(bg);
  assert.equal(paperFolders(bg).length, 1);
  assert.equal(paperFolders(bg)[0].children.length, 7);
  assert.ok(!paperFolders(bg)[0].children.some(n => n.id === 'ast_paperbg_03'));
});

test('T5 표식: background.seeded 에 정확히 한 번 · 왕복 뒤에도 남음', () => {
  let bg = newBg();
  assert.equal(bg.seeded, undefined, '전제: 표식 없음');
  seedPaperTexturesOnce(bg);
  bg = roundTrip(bg);
  seedPaperTexturesOnce(bg);
  assert.equal(PAPER_TEX_SEED_MARK, 'paper-textures-v1');
  assert.deepEqual(bg.seeded.filter(x => x === PAPER_TEX_SEED_MARK), [PAPER_TEX_SEED_MARK]);
});

test('T6 옛 프로젝트(표식 없음 · 노트패널·사용자 폴더 있음) 첫 열기 → 한 번 시드, 기존 것은 그대로, 맨 끝에', () => {
  const old = {
    id: 'ast_bg', type: 'folder', name: 'background', texture: true, collapsed: false,
    children: [
      { id: 'ast_notebg_folder', type: 'folder', name: '노트패널', locked: true, children: [{ id: 'ast_notebg_01', type: 'image', name: '모노 줄눈' }] },
      { id: 'ast_user1', type: 'folder', name: '내 배경', children: [] },
    ],
  };
  const before = JSON.stringify(old.children);
  let bg = roundTrip(old);
  assert.equal(seedPaperTexturesOnce(bg), true);
  assert.equal(bg.children.length, 3);
  assert.equal(JSON.stringify(bg.children.slice(0, 2)), before, '기존 자식이 바뀌었다');
  assert.equal(bg.children[2].id, PAPER_TEX_FOLDER_ID);
  bg = roundTrip(bg);
  assert.equal(seedPaperTexturesOnce(bg), false, '두 번째 열기에서 또 시드했다');
  assert.equal(paperFolders(bg).length, 1);
});

test('T7 보호 안 됨: 폴더·이미지에 favorite/texture/locked 없음 · 패널 보호 판정은 그 세 플래그만 본다', () => {
  const bg = newBg();
  seedPaperTexturesOnce(bg);
  const f = paperFolders(bg)[0];
  for (const n of [f, ...f.children]) {
    assert.notEqual(n.favorite, true); assert.notEqual(n.texture, true); assert.notEqual(n.locked, true);
  }
  // 패널의 보호 판정(삭제·이동·이름변경 · assets-panel.js)이 이 세 플래그 꼴로만 쓰인다는 전제를 잰다
  const src = readSrc(ROOT, 'js/panels/assets-panel.js');
  const guard = /\.favorite === true \|\| [\w.]+\.texture === true \|\| [\w.]+\.locked === true/g;
  const n = (src.match(guard) || []).length;
  assert.ok(n >= 4, `보호 판정 자리 ${n}개(전제 ≥4: 삭제·이동·이름변경 ×2)`);
  // 판정식을 그대로 돌려 본다 — 시드 폴더는 «보호 아님»
  const isProtected = (node) => node.type === 'folder' && (node.favorite === true || node.texture === true || node.locked === true);
  assert.equal(isProtected(f), false);
  assert.equal(isProtected(bg), true, '양성대조: background 자체는 보호');
});

test('T8 표식은 잃고 폴더만 남은 경우 겹쳐 만들지 않음', () => {
  const bg = newBg();
  seedPaperTexturesOnce(bg);
  delete bg.seeded;
  assert.equal(seedPaperTexturesOnce(bg), true);
  assert.equal(paperFolders(bg).length, 1);
  assert.deepEqual(bg.seeded, [PAPER_TEX_SEED_MARK]);
});

test('T9 동봉 파일: 8개가 레포에 있고 JPEG · main 가드가 받아들임 · 밖은 거절', () => {
  assert.equal(PAPER_TEXTURES.length, 8);
  for (const p of PAPER_TEXTURES) {
    const full = path.join(ROOT, p.bundled);
    assert.ok(fs.existsSync(full), `없음: ${p.bundled}`);
    const b = fs.readFileSync(full);
    assert.ok(b.length > 10000, `${p.bundled} ${b.length} B`);
    assert.deepEqual([...b.subarray(0, 3)], [0xff, 0xd8, 0xff], `${p.bundled} JPEG 아님`);
    const r = resolveBundledAsset(ROOT, p.bundled);
    assert.equal(r.ok, true, `${p.bundled}: ${r.error}`);
    assert.equal(r.mime, 'image/jpeg');
    assert.equal(path.resolve(r.full), path.resolve(full));
  }
  for (const bad of ['../package.json', 'assets/textures/../../main.js', 'main.js', 'js/data/paper-textures.js',
                     '/etc/passwd', 'assets/textures/paper/x.txt', '', null, 'assets/texturesX/a.png']) {
    assert.equal(resolveBundledAsset(ROOT, bad).ok, false, `거절해야 함: ${bad}`);
  }
});

test('T10 배선(소스): 로드 때 시드 호출 · 패널 bundled 갈래 · preload · main IPC', () => {
  const sl = readSrc(ROOT, 'js/io/save-load.js');
  const iNote = sl.indexOf('seedNoteBgPatterns(_texFolder);');
  const iPaper = sl.indexOf('seedPaperTexturesOnce(_texFolder);');
  assert.ok(iNote > 0 && iPaper > iNote, 'seedPaperTexturesOnce(_texFolder) 가 노트패널 시드 바로 뒤에 있어야 한다');
  assert.ok(iPaper - iNote < 400, '같은 자리(loadProjectData 의 background 보정 직후)');
  assert.match(sl, /import \{ seedPaperTexturesOnce \} from '\.\.\/data\/paper-textures\.js'/);
  const ap = readSrc(ROOT, 'js/panels/assets-panel.js');
  const body = sliceBlock(ap, 'async function assetsGetDataUrl(', '패널의 에셋 data URL 문');   // ⛔닻에 매개변수 안 넣는다(anchor-signature-ratchet R1)
  const iB = body.indexOf('f.node.bundled'), iNull = body.indexOf('if (!f.node.blobPath) return null;');
  assert.ok(iB > 0 && iNull > iB, 'bundled 갈래가 «blobPath 없으면 null» 보다 먼저');
  assert.match(body, /assetsReadBundled/);
  const pl = readSrc(ROOT, 'preload.js');
  assert.match(pl, /assetsReadBundled:.*ipcRenderer\.invoke\('assets:readBundled'/);
  const mj = readSrc(ROOT, 'main.js');
  const h = sliceCall(mj, "ipcMain.handle('assets:readBundled'", 'main 의 동봉 에셋 IPC');
  assert.match(h, /resolveBundledAsset\(__dirname, bundled\)/);
});
