/* open-load-notice-e170.test.js — E170 반쪽: «열기» 입구가 어디든 복구 알림이 «한 곳»에서 나간다 (lane-drag · 2026-10-06 · 태양 «E170» · 지디 «한 곳»)
 *
 * 입구 셈(코드독해 · 1c210496): 프로젝트를 «여는» 입구 10 개가 렌더러의 «열기 로드» 두 자리로 모인다.
 *   ① js/io/save-load.js 부팅 로드(index.html?project=) — 프로젝트 카드 · 홈 최근 탭 · 설정 · 협업 수락(폴백) · MCP open_project(main loadFile)
 *   ② js/tab-system.js switchTab 첫 로드 — 탭 바 클릭 · 탭 닫기 뒤 다음 탭 · 「+」 메뉴 최근 목록 · 새 프로젝트(빈 판 — 복구 없음) · 협업 수락
 *   옛 판: ① 만 복구 토스트 · ② 는 없음(말없는 복구 — E170 전부터).
 * 고침: 열기 로드를 «한 함수» loadProjectForOpen(id) 로 — 토스트(_recoveryToastText 같은 글)와 표식 걷기가 그 안. 두 자리가 그것을 부른다.
 *   잠금: 렌더러에 날 loadProject(…, { open: true }) 는 그 함수 안 «하나»뿐(새 입구가 생겨도 이 함수를 지나야 한다).
 * 실행: node --test tests/unit/open-load-notice-e170.test.js
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { readSrc } = require('./_srcread.js');
const { sliceBlock } = require('./_slice-block.js');

const REPO = path.join(__dirname, '..', '..');
const SL = readSrc(REPO, 'js/io/save-load.js');
const TAB = readSrc(REPO, 'js/tab-system.js');
const fnSrc = (src, name) => {
  for (const pat of [`async function ${name}(`, `function ${name}(`]) if (src.includes(pat)) return sliceBlock(src, pat, '대상을 놓침');
  throw new Error(`★${name} 이(가) 없다`);
};

/** js/ 아래 모든 .js 에서 «열기 로드» 날 호출 자리 */
function rawOpenLoads() {
  const out = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.js')) {
      const src = fs.readFileSync(p, 'utf8');
      const re = /loadProject\(([^()]|\([^()]*\))*\{\s*open:\s*true\s*\}\s*\)/g; let m;
      while ((m = re.exec(src))) out.push({ file: path.relative(REPO, p), at: src.slice(0, m.index).split('\n').length });
    } } };
  walk(path.join(REPO, 'js'));
  return out;
}

test('L1 ★잠금 — 렌더러의 날 «열기 로드»는 loadProjectForOpen 안 «하나»뿐(입구가 늘어도 한 곳을 지난다)', () => {
  const raw = rawOpenLoads();
  assert.equal(raw.length, 1, `날 열기 로드 ${raw.length} 곳: ${JSON.stringify(raw)} (옛 판 = save-load.js · tab-system.js 두 곳)`);
  assert.equal(raw[0].file, path.join('js', 'io', 'save-load.js'));
  assert.match(fnSrc(SL, 'loadProjectForOpen'), /loadProject\([^)]*\{\s*open:\s*true\s*\}\)/, '그 하나가 loadProjectForOpen 안이 아니다');
});

test('L2 ★두 자리가 그 함수를 부른다 — 부팅 로드(save-load) · 탭 첫 로드(tab-system)', () => {
  assert.match(TAB, /window\.loadProjectForOpen\(id\)/, '★탭 열기 길이 공용 함수를 안 부른다(말없는 복구)');
  assert.match(SL, /await loadProjectForOpen\(activeProjectId\)/, '★부팅 로드가 공용 함수를 안 부른다');
});

/* 동작: 그 함수 하나를 떼어 가짜 electronAPI 위에서 — 첫 로드만 복구 표식, 세 번 열면 토스트 «한 번» · 같은 글 · 표식은 걷힌다 */
function harness(responses) {
  const toasts = []; let n = 0;
  const window = { electronAPI: { loadProject: async (id, opts) => { const r = responses[Math.min(n++, responses.length - 1)]; return r === null ? null : { ...r, _opts: opts }; } }, showToast: (m) => toasts.push(m) };
  const f = new Function('window', fnSrc(SL, '_recoveryToastText') + '\n' + fnSrc(SL, 'loadProjectForOpen') + '\n; return loadProjectForOpen;')(window);
  return { f, toasts };
}
const PLAIN = { id: 'p', pages: [] };
const REC = { ...PLAIN, _recovered: 'backup', _recoveredAt: 1, _recoveredAtLabel: '10-06 02:55', _healed: true };

test('B1 ★탭 전환으로 복구된 프로젝트를 열면 토스트 «한 번» · 부팅 길과 «같은 글» · 표식은 돌려주는 판에서 걷힌다', async () => {
  const { f, toasts } = harness([REC, PLAIN, PLAIN]);
  const got = [await f('p'), await f('p'), await f('p')];
  assert.deepEqual(toasts, ['⚠️ 프로젝트 파일이 손상되어 백업에서 복구했습니다 (10-06 02:55 저장분) — 그 뒤 작업은 없을 수 있습니다']);
  for (const p of got) for (const k of ['_recovered', '_recoveredAt', '_recoveredAtLabel', '_healed', '_healError']) assert.ok(!(k in p), `표식 ${k} 가 남았다`);
  assert.deepEqual(got[0]._opts, { open: true }, '열기 로드여야 한다(main 표지는 open:true 에만 실린다)');
});

test('B2 음성대조 — 성한 파일이면 토스트 0', async () => {
  const { f, toasts } = harness([PLAIN, PLAIN, PLAIN]);
  await f('p'); await f('p'); await f('p');
  assert.deepEqual(toasts, []);
});

test('B3 로드가 null(없는 프로젝트)이면 그대로 null · 토스트 0', async () => {
  const { f, toasts } = harness([null]);
  assert.equal(await f('p'), null);
  assert.deepEqual(toasts, []);
});
