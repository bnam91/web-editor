/* admin-library — LIB-FIGMA(261118) 관리자 로컬 라이브러리: main 가드(main/admin-library.js) · IPC 문지기 · 단색 정규화(js/util/mono-svg.js) · 명부 짝.
 * A1 list: 명부 dir 만 · 그 dir 확장자만(PNG·DONE.txt 거름) · 묶음 폴더는 미모지·두들 더보기만 · 한글 묶음 폴더(NFC·NFD) · 두들 더보기 PNG 는 같은 이름 SVG 없을 때만 · 폴더 없으면 dirs = {}
 * A2 resolve 가드: .. · 절대 · \0 · 명부 밖 dir · 깊이 초과 · 확장자 밖 · 심링크로 밖 → 거절 / 안쪽 → 통과
 * A3 normalizeMonoSvg: 단색 stroke·fill(#짧은 hex · black) → currentColor + 원래 색 · 다색·그라데이션(url(#…)) → 그대로 multi · none 는 손 안 댐 · sanitize 멱등
 * A4 IPC 문지기(main.js 원문 조각 + 가짜): 비관리자·role 모름 → not_admin · 가드/fs 안 불림 / 앱 관리자 · 서버 role admin → 통과
 * A5 재료 실측(ADMIN_LIB_SRC=<~/goditor-admin-library> 있을 때만): 두들 102 · 화살표 34 · 미모지 1,785 webp · 두들 더보기 8묶음 SVG 53(261118 재추출 53/53 · 같은 이름 PNG@2x 는 list 가 뺌) · SVG 전부 거름 뒤 비지 않음 · 다색 목록 출력
 * A7 prep viewBox 고침(LIB-FIGMA-SVG-VIEWBOX-CLIP-01): 곡선 극값 · 넘을 때만 넓힘 · 획/2 · use 펼침 · 멱등
 * A6 명부 짝: ADMIN_LOCAL dir = main DIRS · 덧붙임 대상 = 내장 탭(arrow) 또는 «앞선» 로컬 탭(figma-doodle) · 새 탭 id 가 기존·서로와 안 겹침 · 레포 assets/ 에 재료 0
 * 양성대조(CTL · _patches/): ⓑ main 문지기 줄을 빼면 A4 빨강 · ⓒ normalize 건너뜀은 DOM L1 빨강
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire } from 'node:module';
const _require = createRequire(import.meta.url);
const { mkTmpRoot } = _require('./_tmproot.js');
const { readSrc } = _require('./_srcread.js');
const { sliceBlock, sliceCall } = _require('./_slice-block.js');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../');
const G = _require('../../main/admin-library.js');
/* js/*.js 는 ESM — builtin-library.test 선례처럼 임시 폴더에 type:module 을 얹어 싣는다. */
const esm = async (rels) => {
  const tmp = mkTmpRoot('gd-adminlib-');
  fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
  const out = [];
  for (const r of rels) { const f = path.join(tmp, path.basename(r)); fs.copyFileSync(path.join(ROOT, r), f); out.push(await import(pathToFileURL(f).href)); }
  return out;
};
const [{ normalizeMonoSvg }, SAN, LIB] = await esm(['js/util/mono-svg.js', 'js/util/sanitize-svg.js', 'js/data/builtin-library.js']);

function fixture() {
  const root = path.join(mkTmpRoot('gd-adminlib-root-'), 'admin-library');
  const w = (rel, s = '<svg/>') => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), s); };
  w('doodle-figma-191-38/Heart_195-288.svg'); w('doodle-figma-191-38/Heart_195-288.png'); w('doodle-figma-191-38/DONE.txt', 'x');
  w('arrow-figma-191-2/Vector_191-10.svg');
  w('memoji-inclusive-192-2/Frame_2/a-sticker_1_192-9.webp'); w('memoji-inclusive-192-2/Frame_10/b-sticker_1_192-8.webp'); w('memoji-inclusive-192-2/Frame_2/a.png');
  w('memoji-inclusive-192-2/Frame_2/deep/x.webp');
  w('doodle-figma-more/두들002_Crispy_doodles/Star_195-466.svg'); w('doodle-figma-more/두들002_Crispy_doodles/Star_195-466.png');
  w('doodle-figma-more/두들002_Crispy_doodles/024_195-468.png'); w('doodle-figma-more/두들003_update/109_195-762.svg');
  w('doodle-figma-more/' + '두들009_nfd'.normalize('NFD') + '/a_1-1.svg');
  w('other-dir/x.svg');
  /* 밖으로 새는 링크(가드 꼼수) — win-portability Ⓒ-3: 정션(디렉터리 링크)이어야 비승격 윈도우에서도 선다 · 실패는 던진다(조용히 건너뛰지 않음).
     정션은 «폴더»만 가리키므로 밖의 폴더(secret.svg 를 품은)를 묶음 폴더 자리(doodle-figma-more/evil)에 잇는다 → evil/secret.svg 는 realpath 로 밖 = 거절(A2). */
  const outsideDir = path.join(path.dirname(root), 'escape-dir'); fs.mkdirSync(outsideDir, { recursive: true }); fs.writeFileSync(path.join(outsideDir, 'secret.svg'), '<svg/>');
  fs.symlinkSync(outsideDir, path.join(root, 'doodle-figma-more/evil'), 'junction');
  return root;
}

test('A1 list — 명부 dir·확장자만 · 묶음은 미모지만 · 폴더 없으면 빈 것', () => {
  const root = fixture();
  const r = G.listAdminLibrary(root);
  assert.deepEqual(Object.keys(r.dirs).sort(), ['arrow-figma-191-2', 'doodle-figma-191-38', 'doodle-figma-more', 'memoji-inclusive-192-2']);
  const more = r.dirs['doodle-figma-more'].map((f) => f.normalize('NFC'));
  assert.deepEqual(more.sort(), ['두들002_Crispy_doodles/024_195-468.png', '두들002_Crispy_doodles/Star_195-466.svg', '두들003_update/109_195-762.svg', '두들009_nfd/a_1-1.svg'], 'SVG 있는 PNG 는 뺌 · 실패분 PNG 는 남김 · NFD 폴더도');
  const nfd = r.dirs['doodle-figma-more'].find((f) => f.endsWith('a_1-1.svg'));
  assert.equal(G.resolveAdminLibraryFile(root, 'doodle-figma-more', nfd).ok, true, 'list 가 준 이름 그대로 읽힌다');
  assert.ok(!r.dirs['doodle-figma-191-38'].some((f) => /\.(png|txt)$/.test(f)), 'PNG·DONE.txt 거름');
  assert.deepEqual(r.dirs['memoji-inclusive-192-2'], ['Frame_2/a-sticker_1_192-9.webp', 'Frame_10/b-sticker_1_192-8.webp'], '한 층만 · webp 만 · 숫자 순');
  assert.deepEqual(G.listAdminLibrary(path.join(root, 'nope')), { dirs: {} });
  assert.deepEqual(G.listAdminLibrary(''), { dirs: {} });
});

test('A2 resolve 가드 — 꼼수 거절 · 안쪽 통과', () => {
  const root = fixture();
  const ok = G.resolveAdminLibraryFile(root, 'doodle-figma-191-38', 'Heart_195-288.svg');
  assert.equal(ok.ok, true); assert.equal(ok.mime, 'image/svg+xml');
  assert.equal(G.resolveAdminLibraryFile(root, 'memoji-inclusive-192-2', 'Frame_2/a-sticker_1_192-9.webp').ok, true);
  assert.equal(G.resolveAdminLibraryFile(root, 'doodle-figma-more', '두들002_Crispy_doodles/024_195-468.png').mime, 'image/png');
  const bad = [
    ['doodle-figma-191-38', '../other-dir/x.svg'], ['doodle-figma-191-38', '/etc/passwd'], ['doodle-figma-191-38', 'a\0.svg'],
    ['other-dir', 'x.svg'], ['__proto__', 'x.svg'], ['doodle-figma-191-38', 'Heart_195-288.png'], ['doodle-figma-191-38', 'DONE.txt'],
    ['doodle-figma-191-38', 'sub/x.svg'], ['memoji-inclusive-192-2', 'Frame_2/deep/x.webp'], ['memoji-inclusive-192-2', '../doodle-figma-191-38/Heart_195-288.svg'],
    ['doodle-figma-more', 'evil/secret.svg'], ['doodle-figma-more', '두들002_Crispy_doodles/../../other-dir/x.svg'], ['doodle-figma-more', '두들 002/x.svg'], ['doodle-figma-191-38', 'missing.svg'], ['doodle-figma-191-38', 42],
  ];
  for (const [d, f] of bad) assert.equal(G.resolveAdminLibraryFile(root, d, f).ok, false, `${d} ${String(f)}`);
});

test('A3 normalizeMonoSvg — 단색 → currentColor · 다색 그대로', () => {
  const san = (s) => SAN.sanitizeSvgString(s, { maxLen: SAN.SVG_MAX_LEN_CEIL });
  const a = normalizeMonoSvg(san('<svg viewBox="0 0 10 10" fill="none"><path d="M0 0L9 9" stroke-width="2" stroke="#A98467"/><path d="M1 1" stroke="#a98467"/></svg>'));
  assert.equal(a.color, '#a98467'); assert.equal(a.multi, false);
  assert.match(a.svg, /stroke="currentColor"/); assert.doesNotMatch(a.svg, /#a98467/i); assert.match(a.svg, /fill="none"/);
  const b = normalizeMonoSvg(san('<svg viewBox="0 0 10 10"><path d="M0 0" fill="black"/></svg>'));
  assert.equal(b.color, '#000000'); assert.match(b.svg, /fill="currentColor"/);
  assert.equal(normalizeMonoSvg(san('<svg viewBox="0 0 1 1"><path d="M0 0" fill="#fff"/></svg>')).color, '#ffffff');
  const m = normalizeMonoSvg(san('<svg viewBox="0 0 10 10"><path d="M0 0" fill="#f00"/><path d="M1 1" stroke="#00f"/></svg>'));
  assert.equal(m.multi, true); assert.equal(m.color, null); assert.match(m.svg, /#f00|#ff0000/i);
  assert.equal(normalizeMonoSvg(san('<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>')).color, null);
  const g = san('<svg viewBox="0 0 9 9"><path d="M0 0" stroke="#111"/><path d="M1 1" fill="url(#p)"/><defs><radialGradient id="p"><stop stop-color="#f00"/></radialGradient></defs></svg>');
  assert.deepEqual(normalizeMonoSvg(g), { svg: g, color: null, multi: true }, '그라데이션 = 다색(손 안 댐)');
  assert.equal(san(a.svg), a.svg, '정규화 뒤 다시 걸러도 같다(그릴 때 renderVector 가 또 거른다)');
});

test('A4 IPC 문지기 — 비관리자는 폴더를 보지도 않는다', async () => {
  const MAIN = readSrc(ROOT, 'main.js');
  const readCall = sliceCall(MAIN, "ipcMain.handle('adminLibrary:read'");
  const i0 = MAIN.indexOf('const _ADMIN_LIB_MAX');   // 상한·루트 상수 + list + read 한 덩이(사이에 남의 코드 0 — 길이로 확인)
  const block = MAIN.slice(i0, MAIN.indexOf(readCall) + readCall.length);
  assert.ok(i0 > 0 && block.split('\n').length < 30, `IPC 덩이 ${block.split('\n').length}줄`);
  const src = `${sliceBlock(MAIN, 'async function _isAdminOrServerRole(')}\n${block}`;
  const run = (appAdmin, role) => {
    const calls = { list: 0, resolve: 0, fs: 0 }; const H = {};
    const req = (m) => {
      if (m === './main/admin') return { _fetchRole: async () => { if (role instanceof Error) throw role; return role; } };
      if (m === './main/admin-library') return { listAdminLibrary: () => { calls.list++; return { dirs: { d: ['a.svg'] } }; }, resolveAdminLibraryFile: () => { calls.resolve++; return { ok: true, full: '/x.svg', ext: 'svg', mime: 'image/svg+xml' }; } };
      throw new Error(m);
    };
    const fsFake = { statSync: () => { calls.fs++; return { size: 5 }; }, readFileSync: () => { calls.fs++; return Buffer.from('<svg/>'); } };
    new Function('isAdminAuthorized', 'require', 'ipcMain', 'fs', 'path', 'app', `${src}`)(
      () => appAdmin, req, { handle: (ch, fn) => { H[ch] = fn; } }, fsFake, path, { getPath: () => '/ud' });
    return { H, calls };
  };
  for (const [appAdmin, role, tag] of [[false, { ok: true, isAdmin: false }, '일반'], [false, new Error('net'), '오프라인'], [false, null, 'null'], [false, { isAdmin: 'true' }, '이상한 값']]) {
    const { H, calls } = run(appAdmin, role);
    assert.deepEqual(await H['adminLibrary:list'](), { ok: false, code: 'not_admin' }, tag);
    assert.deepEqual(await H['adminLibrary:read']({}, { dir: 'd', file: 'a.svg' }), { ok: false, code: 'not_admin' }, tag);
    assert.deepEqual(calls, { list: 0, resolve: 0, fs: 0 }, `${tag}: 가드·fs 안 불림`);
  }
  for (const [appAdmin, role, tag] of [[true, new Error('불리면 안 됨'), '앱 관리자'], [false, { ok: true, isAdmin: true }, '서버 role']]) {
    const { H } = run(appAdmin, role);
    assert.deepEqual(await H['adminLibrary:list'](), { ok: true, dirs: { d: ['a.svg'] } }, tag);
    assert.deepEqual(await H['adminLibrary:read']({}, { dir: 'd', file: 'a.svg' }), { ok: true, svg: '<svg/>' }, tag);
  }
});

test('A5 재료 실측', { skip: !process.env.ADMIN_LIB_SRC && 'ADMIN_LIB_SRC 없음(재료가 있는 맥에서만)' }, () => {
  const root = process.env.ADMIN_LIB_SRC;
  const r = G.listAdminLibrary(root);
  assert.equal(r.dirs['doodle-figma-191-38']?.length, 102);
  assert.equal(r.dirs['arrow-figma-191-2']?.length, 34);
  if (r.dirs['memoji-inclusive-192-2']) assert.equal(r.dirs['memoji-inclusive-192-2'].length, 1785);
  const more = r.dirs['doodle-figma-more'] || [];
  assert.equal(more.length, 53, '두들 더보기 = SVG 53');
  assert.equal(new Set(more.map((f) => f.split('/')[0])).size, 8, '묶음 8');
  assert.deepEqual(more.filter((f) => f.endsWith('.png')), [], 'SVG 짝이 다 있어 PNG 0');
  const multi = [];
  for (const d of ['doodle-figma-191-38', 'arrow-figma-191-2', 'doodle-figma-more']) for (const f of r.dirs[d].filter((x) => x.endsWith('.svg'))) {
    const p = G.resolveAdminLibraryFile(root, d, f); assert.equal(p.ok, true, f);
    const clean = SAN.sanitizeSvgString(fs.readFileSync(p.full, 'utf8'), { maxLen: SAN.SVG_MAX_LEN_CEIL });
    assert.ok(clean, `${d}/${f} 거름 뒤 빈 글자`);
    if (normalizeMonoSvg(clean).multi) multi.push(`${d}/${f}`);
  }
  console.log(`[admin-library] 다색 ${multi.length}: ${multi.join(' ') || '(없음)'}`);
});

test('A6 명부 짝 · 레포에 재료 0', () => {
  assert.deepEqual(LIB.ADMIN_LOCAL.map((a) => a.dir).sort(), Object.keys(G.DIRS).sort());
  const ids = new Set(LIB.LIBRARY.map((c) => c.id));
  const localIds = new Set();   // 렌더러(_adminLocal)는 명부 순서대로 돈다 — 로컬 탭에 덧붙이려면 그 탭이 «앞»에 있어야 한다
  for (const a of LIB.ADMIN_LOCAL) {
    if (a.mergeInto) assert.ok(ids.has(a.mergeInto) || localIds.has(a.mergeInto), `${a.dir} → ${a.mergeInto}(내장 탭 또는 앞선 로컬 탭)`);
    else { assert.ok(a.id && a.name && !ids.has(a.id) && !localIds.has(a.id), `${a.dir} 새 탭 id`); localIds.add(a.id); }
    assert.ok(a.source && a.license, `${a.dir} 출처·라이선스 줄`);
    assert.equal(fs.existsSync(path.join(ROOT, 'assets', a.dir)), false, `assets/${a.dir} 커밋 금지`);
    assert.equal(fs.existsSync(path.join(ROOT, 'assets/library', a.dir)), false, `assets/library/${a.dir} 커밋 금지`);
  }
  assert.equal(LIB.LIBRARY.find((c) => c.id === 'arrow').items.length, 20, '기존 손그림 화살표 20 유지');
});

/* A7 LIB-FIGMA-SVG-VIEWBOX-CLIP-01 — scripts/admin-library-prep.cjs viewBox 고침(재료 손질 · 앱 밖).
 *   극값 = 조절점이 아니라 곡선 위 점 · 넘을 때만 합집합으로 넓힘(안쪽이면 글자 그대로) · 획/2 여유 · <use> 펼침 · 모르는 명령 = 건너뜀(추측 0) */
test('A7 viewBox 고침 — 곡선 극값 · 넘을 때만 · use 펼침', () => {
  const P = _require('../../scripts/admin-library-prep.cjs');
  assert.deepEqual(P.cubicRange(0, -100, -100, 0).map((v) => Math.round(v)), [-75, 0], '조절점 −100 이어도 곡선 극값은 −75');
  assert.deepEqual(P.pathBBox('M10 10L20 30H5V0Z'), { x0: 5, y0: 0, x1: 20, y1: 30 });
  assert.equal(P.pathBBox('M0 0l5 5'), null, '상대 명령 = 모름');
  const over = '<svg width="100" height="50" viewBox="0 0 100 50" fill="none"><path d="M0 25C30 -100 70 -100 100 25" stroke-width="10" stroke="#000"/></svg>';
  const r = P.fixViewBox(over);
  assert.equal(r.changed, true);
  const [x, y, w, h] = r.newVB.split(' ').map(Number);
  assert.ok(Math.abs(y - (-68.75 - 5)) < 0.02 && x === -5 && Math.abs(w - 110) < 0.02 && Math.abs(h - (y < 0 ? 50 - y : 50)) < 0.02, r.newVB);   // 극값 −68.75 · 획 10/2 · 좌우도 끝점±5
  assert.match(r.svg, new RegExp(`height="${Math.round((50 * h) / 50 * 100) / 100}"`), 'height 도 같은 비로');
  const inside = '<svg viewBox="0 0 100 100"><path d="M10 10L90 90" stroke-width="4" stroke="#000"/></svg>';
  assert.deepEqual([P.fixViewBox(inside).changed, P.fixViewBox(inside).svg], [false, inside], '안쪽이면 글자 그대로');
  const edge = '<svg viewBox="0 0 100 100"><path d="M0 50H100" stroke-width="20" stroke="#000"/></svg>';
  assert.equal(P.fixViewBox(edge).changed, false, '패스가 틀 안 = 획 여유만 넘어도 무변(피그마 «안 잘림»과 같은 판정)');
  const fillOnly = '<svg viewBox="0 0 10 10"><path d="M0 0H10V10H0Z" fill="#000"/></svg>';
  assert.equal(P.fixViewBox(fillOnly).changed, false, '채움만 = 획 여유 0 → 딱 맞으면 무변');
  const use = '<svg viewBox="0 0 10 10"><use xlink:href="#s0" fill="black"/><defs><path id="s0" d="M1 1H9V9Z"/></defs></svg>';
  const u = P.fixViewBox(use);
  assert.equal(u.uses, 1); assert.match(u.svg, /<path d="M1 1H9V9Z" fill="black"\/>/); assert.doesNotMatch(u.svg, /<use/);
  assert.equal(P.fixViewBox(P.fixViewBox(over).svg).changed, false, '고친 본을 다시 재면 안쪽(멱등)');
});
