/* mcp-project-crud.test.js — 프로젝트 «화면 단위» CRUD (T1~T9).
 * 출처: skills/goditor-manager-mcp/todo/TEST-project-crud-0907.md (2026-09-07 현빈 제기)
 *
 * ★왜 이 파일이 따로 있나 — 고디터를 열면 «프로젝트 화면»이 있다. 거기서 사람이 하는 일
 *   (목록·만들기·복제·열기·이름수정·삭제)을 MCP 로도 «같게» 할 수 있나를 잰다.
 *   기존 검사들은 «게이트»(누가 못 하게 막나)와 «예산»(응답이 큰가)을 재지,
 *   「무엇이 실제로 일어났나」는 안 잰다.
 *
 * ★★대역(스텁) 규칙 — 오늘 팀이 두 번 데인 자리다:
 *   하네스의 projectOps 는 «흉내»다(list 는 고정 1건, duplicate 는 proj_999 를 «말만» 한다).
 *   그걸 대상으로 재면 main.js 의 진짜 함수를 망가뜨려도 초록이 난다.
 *   ⇒ 이 파일은 main.js 에서 «진짜 구현»을 떼어내 «진짜 파일시스템» 위에 꽂고,
 *      MCP 도구를 그 위로 부른다. list/duplicate/rename 은 스텁이 «아니다».
 *      (open/create/delete 만 Electron 창·휴지통에 묶여 있어 대역이다 — 그 셋의 계약은
 *       mcp-delete-project.test.js(D1~D10)·mcp-project-gate.test.js(G7·G12)가 이미 잰다.)
 *   ★그리고 도구 «층»이 앞에서 막아 주는 검사는 진짜 함수를 망가뜨려도 안 잡힌다
 *     (변이확인에서 실제로 그랬다). 그래서 T9 는 MCP 를 지나는 길과 «구현을 직접 부르는 길»을
 *     둘 다 둔다 — 위층 가드가 사라지는 날 아래층이 벌거벗은 걸 알아야 한다.
 *
 * ⛔이미 덮여 있어 «안» 쓴 것 (겹치는 검사는 가치가 0이다):
 *   G6  duplicate_project 빈 호출 거절          G7   create_project 가 게이트를 안 타는 것
 *   G12 open_project load_timeout → 확정 안 섬   F4-5 read_project «기본»이 목차인 것
 *   D1~D10 delete_project 전반(휴지통·활성비움)  M1~M22c 계정별 프로젝트 뿌리 격리
 *   F3-1 required 인자 누락 거절                 F3-2 도구 전수의 브리지 배선
 */
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { startHarness } = require('./_mcp-harness');
const { readSrc } = require('./_srcread.js');   // ★CRLF 체크아웃 방어(윈도우 core.autocrlf=true)
const { sliceBlock } = require('./_slice-block.js');   // ★구간 떠내기는 «공용 부품»(_slice-block.js) 하나로 — ⛔여기서 자를 새로 만들지 마라(끝은 «균형괄호»로 찾는다)
const { CASES } = require('../contract/mcp-cases');

const REPO = path.join(__dirname, '..', '..');
const MAIN_SRC = readSrc(REPO, 'main.js');

/* ── main.js 의 «진짜 함수»를 떼어내 진짜 fs 위에 꽂는다 ────────────────────
 * account-projects-root.test.js 와 같은 수법이다. main.js 는 Electron 없이 통째로 못 읽으니
 * 대상 함수만 잘라 new Function 으로 다시 세운다.
 * ⛔고정 길이 창(slice(i, i+N)) 금지 — 주석이 늘면 코드가 창 밖으로 밀려 «가짜 빨강»이 난다
 *   (2026-09-07 D7 이 그렇게 한 번 틀렸다). 함수 끝까지 «괄호를 세서» 잡는다.
 * ⛔「열 0 의 `}`」로 끝을 찾는 것도 금지 — `};`·`})` 로 끝나는 구간을 못 맞추고 다음 함수까지 삼킨다.
 * ⚠️`async function` 을 «먼저» 찾는다 — `function` 부터 자르면 async 가 떨어져 나가
 *   본문의 await 가 SyntaxError 를 낸다(실제로 그렇게 한 번 죽었다). */
function fnSrc(name) {
  for (const pat of [`async function ${name}(`, `function ${name}(`, `const ${name} = `]) {
    const i = MAIN_SRC.indexOf(pat);
    if (i < 0) continue;
    /* ★끝은 «균형괄호»로 찾는다 — 꼬리 모양(`}` · `};` · `})`)마다 «명부»를 늘리면
       다음 모양이 올 때 또 난다. 못 찾으면 던진다(못 잰 것은 통과가 아니다). */
    return sliceBlock(MAIN_SRC, pat, '검사가 «대상을 놓친» 것이지 통과가 아니다');
  }
  throw new Error(`★main.js 에 ${name} 이(가) 없다 — 이름이 바뀌었으면 이 검사도 «같이» 고쳐라`);
}

const REAL_FNS = ['_safeSeg', '_getMigrator', '_atomicWriteFileSync', '_resolveProjectJsonPath',
  '_resolveMetaJsonPath', '_ensureNewLayoutPaths', '_refreshListMeta', '_listItemFor',
  '_listProjectsImpl', '_duplicateProjectImpl', '_renameProjectImpl'];

/** 떼어낸 «진짜» 구현. PROJECTS_DIR 만 임시 폴더로 바꿔 꽂는다. */
function loadRealImpls(projectsDir) {
  /* rename 이 쓰는 _saveProjectImpl 은 자동저장·스냅샷·외부화까지 물고 있어 통째로 못 뗀다.
     «디스크에 쓴다»는 계약만 최소로 세운다 — rename 자신의 검증·되읽기는 «진짜»가 돈다.
     ★저장을 «갈아끼울 수» 있게 둔다(setSave) — rename 의 「썼다고 믿지 말고 되읽어라」를
       재려면 «거짓말하는 저장»이 필요하다. 없으면 그 줄은 영원히 안 밟힌다. */
  let hook = null;
  const saveProject = async (proj) => {
    if (hook) return hook(proj);
    const p = path.join(projectsDir, proj.id, 'proj.json');
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(proj, null, 2), 'utf8');
    return { ok: true };
  };
  const req = (m) => require(m.startsWith('.') ? path.join(REPO, m) : m);
  const factory = new Function('fs', 'path', 'PROJECTS_DIR', 'require', 'console', '_saveProjectImpl',
    REAL_FNS.map(fnSrc).join('\n\n') + `\n; return { ${REAL_FNS.join(', ')} };`);
  const api = factory(fs, path, projectsDir, req, { log() {}, warn() {}, error() {} }, saveProject);
  api.__setSave = (fn) => { hook = fn; };
  return api;
}

let H = null;      // MCP 하네스(진짜 디스패처)
let R = null;      // main.js 에서 떼어낸 «진짜» 프로젝트 구현
let DIR = null;    // 진짜 projects 뿌리
const opsLog = []; // 대역(open/create/delete)이 «실제로 불렸나» — 계측기

function seedOne(id, name, at) {
  const d = path.join(DIR, id);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'proj.json'), JSON.stringify({
    id, name, createdAt: at || '2026-01-01T00:00:00.000Z', updatedAt: at || '2026-01-01T00:00:00.000Z',
    pages: [{ id: 'page_1', name: 'Page 1', canvas: '<div id="canvas"></div>' }],
  }), 'utf8');
}

/** proj_* 를 싹 지우고 지정한 것만 심는다 — 앞 검사의 잔재가 다음 판정을 오염시키지 않게. */
function reseed(specs) {
  for (const e of fs.readdirSync(DIR)) {
    if (/^\.?proj_/.test(e)) fs.rmSync(path.join(DIR, e), { recursive: true, force: true });
  }
  for (const s of specs) {
    seedOne(s.id, s.name, s.at);
    if (s.canvas != null) {
      const p = path.join(DIR, s.id, 'proj.json');
      const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      j.pages[0].canvas = s.canvas;
      fs.writeFileSync(p, JSON.stringify(j), 'utf8');
    }
  }
}

const dirsNow = () => fs.readdirSync(DIR).filter(e => /^proj_\d+$/.test(e)).sort();
const said = (r) => JSON.stringify((r && (r.error || r.result)) || '');
const rejected = (r) => !!r.error || !!(r.result && r.result.ok === false);

before(async () => {
  H = await startHarness({ activeProject: 'proj_1000000000001', confirmProject: false });
  DIR = H.projectsDir;
  R = loadRealImpls(DIR);
  /* ★여기가 이 파일의 «진짜»다 — list/duplicate/rename 은 main.js 의 그 함수 «그대로»다.
     open/create/delete 만 Electron(창 전환·휴지통)에 묶여 있어 최소 대역을 쓴다. */
  H.mod.setProjectOps({
    list: R._listProjectsImpl,
    duplicate: R._duplicateProjectImpl,
    rename: R._renameProjectImpl,
    create: async ({ name } = {}) => {
      opsLog.push('create');
      const nm = (name && String(name).trim()) || 'Untitled';
      const id = `proj_9${Date.now()}`;
      seedOne(id, nm);
      return { ok: true, projectId: id, name: nm };
    },
    open: async ({ projectId } = {}) => {
      opsLog.push('open:' + projectId);
      if (!fs.existsSync(path.join(DIR, projectId, 'proj.json'))) {
        return { ok: false, error: `project not found: ${projectId}`, code: 'not_found' };
      }
      H.setActiveProject(projectId);
      return { ok: true, projectId, activeProjectId: projectId, ready: true, waitedMs: 0, sections: 0 };
    },
    delete: async ({ projectId } = {}) => {
      opsLog.push('delete:' + projectId);
      const d = path.join(DIR, projectId);
      if (!fs.existsSync(d)) return { ok: false, error: `project not found: ${projectId}`, code: 'not_found' };
      fs.rmSync(d, { recursive: true, force: true });
      return { ok: true, projectId, trashed: true, wasActive: false, activeCleared: false };
    },
  });
});
after(async () => { if (H) await H.stop(); });

/* ══════════════════════════════════════════════════════════════════════════
   T1 — list_projects 가 «전부» 보여주나
        (상한이 숨어 있으면 「프로젝트가 없다」로 오독한다)
   ══════════════════════════════════════════════════════════════════════════ */
test('T1 ★list_projects 의 «숨은 상한» — 기본 100 에서 잘리고, 잘렸다고 «말한다»', async () => {
  const N = 137;   // ⛔기본 상한(100)보다 «확실히» 많아야 자극이 된다
  const specs = [];
  for (let i = 0; i < N; i++) {
    specs.push({
      id: `proj_10000000${String(i).padStart(5, '0')}`, name: `프로젝트 ${i}`,
      at: new Date(Date.UTC(2026, 0, 1) + i * 60000).toISOString(),
    });
  }
  reseed(specs);

  // ★양성대조 ⑴ — «진짜» 구현이 137개를 실제로 세는가. 여기가 어긋나면 아래 판정은 전부 무의미하다.
  const real = R._listProjectsImpl({ withDiag: true });
  assert.strictEqual(real.dirError, null, `디스크를 못 읽었다: ${real.dirError}`);
  assert.strictEqual(real.items.length, N,
    `★main.js _listProjectsImpl 이 ${real.items.length}개만 셌다(디스크엔 ${N}개) — 도구가 아니라 «구현»이 못 본다`);

  const r = await H.call('list_projects', {});
  const o = r.result;
  console.error(`  [실측] total=${o.total} returned=${o.returned} truncated=${o.truncated} ${r.bytes}B`);
  assert.strictEqual(o.total, N, '★total 이 «전체»가 아니다 — 이 값이 틀리면 「없다」로 오독한다');
  assert.strictEqual(o.returned, 100, `★인자 없이 부르면 «전부»가 아니라 100개다(실측 ${o.returned})`);
  assert.strictEqual(o.truncated, true,
    '★★잘라 놓고 truncated 를 «안» 말한다 — 부르는 쪽은 이게 전부인 줄 안다(그게 「없다」 오독의 원인이다)');
  assert.strictEqual(o.projects.length, 100);

  // ★상한을 올리면 «진짜로» 더 온다 (반대방향 — 「늘 100」이 아니라 «상한»임을 증명)
  const full = (await H.call('list_projects', { limit: 200 })).result;
  assert.strictEqual(full.returned, N, `limit=200 인데 ${full.returned}개만 왔다`);
  assert.strictEqual(full.truncated, false, 'limit 을 올렸는데도 잘렸다고 말한다');

  // ★한도의 «벽»도 잰다 — 201·0 은 거절한다(조용히 200 으로 깎지 않는다)
  assert.ok(rejected(await H.call('list_projects', { limit: 201 })),
    '★limit 201 을 «조용히» 받아들인다 — 한도가 설명과 다르면 아무도 못 믿는다');
  assert.ok(rejected(await H.call('list_projects', { limit: 0 })), 'limit 0 을 통과시킨다');
  assert.ok(rejected(await H.call('list_projects', { limit: 1.5 })), 'limit 이 정수가 아닌데 통과한다');
});

test('T1b ★목록 순서·무게 — «최근 수정»이 먼저이고, 썸네일(base64)은 안 실린다', async () => {
  reseed([
    { id: 'proj_1000000000001', name: '오래된 것', at: '2026-01-01T00:00:00.000Z' },
    { id: 'proj_1000000000002', name: '가장 최근', at: '2026-09-01T00:00:00.000Z' },
    { id: 'proj_1000000000003', name: '중간', at: '2026-05-01T00:00:00.000Z' },
  ]);
  // 양성대조 — 썸네일이 «실제로 있는» 프로젝트로 잰다(자극 없는 초록 방지)
  fs.writeFileSync(path.join(DIR, 'proj_1000000000002', 'proj_meta.json'), JSON.stringify({
    id: 'proj_1000000000002', name: '가장 최근', listMetaV: 1, updatedAt: '2026-09-01T00:00:00.000Z',
    thumbnail: 'data:image/png;base64,' + 'A'.repeat(5000),
  }), 'utf8');

  const r = await H.call('list_projects', {});
  assert.deepStrictEqual(r.result.projects.map(p => p.name), ['가장 최근', '중간', '오래된 것'],
    '★정렬이 updatedAt 내림차순이 아니다 — 클로드는 「저번에 만든 그것」을 첫 줄에서 찾는다');
  assert.ok(!/base64|thumbnail/.test(r.rawText),
    `★썸네일이 목록에 실렸다 — 실측 11,320B → 315,581B(28배)로 뛴 자리다 (${r.bytes}B)`);
});

/* ══════════════════════════════════════════════════════════════════════════
   T2 — query 가 «무엇으로» 거르나 (설명에 안 적혀 있던 자리)
   ══════════════════════════════════════════════════════════════════════════ */
test('T2 ★query = «이름»의 부분일치·대소문자 무시 — id 로는 안 걸린다', async () => {
  reseed([
    { id: 'proj_1000000000001', name: 'Summer Sale' },
    { id: 'proj_1000000000002', name: 'summer sale (사본)' },
    { id: 'proj_1000000000003', name: '겨울 상세페이지' },
  ]);
  // ★양성대조 — 「안 걸린다」를 말하기 전에 «걸리는 것»부터 확인한다
  const kor = (await H.call('list_projects', { query: '겨울' })).result;
  assert.strictEqual(kor.matched, 1, `★한글 부분일치가 «안» 된다(matched=${kor.matched})`);
  assert.strictEqual(kor.unique.id, 'proj_1000000000003');

  const mid = (await H.call('list_projects', { query: '상세' })).result;
  assert.strictEqual(mid.matched, 1, '★«가운데» 부분일치가 안 된다 — startsWith 로 좁혀졌나');

  const up = (await H.call('list_projects', { query: 'SUMMER' })).result;
  assert.strictEqual(up.matched, 2, `★대소문자를 가린다(matched=${up.matched}) — 사람은 대문자로 안 친다`);

  // ★id 로는 «안» 걸린다. 그리고 그 프로젝트는 «분명히 있다»(total 이 양성대조다)
  const byId = (await H.call('list_projects', { query: 'proj_1000000000003' })).result;
  assert.strictEqual(byId.matched, 0, '★설명은 「name 부분일치」인데 id 도 걸린다 — 설명이 사실보다 좁다');
  assert.strictEqual(byId.total, 3, '★양성대조 실패 — 프로젝트가 아예 없어서 0인 것이면 위 판정은 무의미하다');
  assert.match(byId.hint, /matched nothing/, '0건일 때 «다음 수»를 안 알려준다');
});

test('T2b ★여러 개에 맞으면 «모양이 달라진다» — 클로드가 첫 줄을 집지 못하게', async () => {
  reseed([
    { id: 'proj_1000000000001', name: 'Untitled' },
    { id: 'proj_1000000000002', name: 'Untitled' },
    { id: 'proj_1000000000004', name: '다른 이름' },
  ]);
  const many = (await H.call('list_projects', { query: 'untitled' })).result;
  assert.strictEqual(many.matched, 2);
  assert.strictEqual(many.ambiguous, true,
    '★중복 이름 2건인데 «하나로 좁혀진 척»한다 — 실사용 62개 중 21개가 "Untitled" 다(실측)');
  assert.strictEqual(many.unique, undefined,
    '★애매한데 unique 를 준다 — 클로드는 그걸 열고, 그건 «틀린 프로젝트»다');
  assert.match(many.hint, /DO NOT pick one yourself/i, '「네가 고르지 마라」를 안 말한다');

  // 반대방향 — 하나면 unique 를 «준다»(막기만 하면 정상 사용이 죽는다)
  const one = (await H.call('list_projects', { query: '다른' })).result;
  assert.strictEqual(one.matched, 1);
  assert.strictEqual(one.unique.id, 'proj_1000000000004');
  assert.strictEqual(one.ambiguous, undefined);

  assert.ok(rejected(await H.call('list_projects', { query: 'x'.repeat(101) })), 'query 101자를 통과시킨다');
  assert.ok(rejected(await H.call('list_projects', { query: 12345 })), 'query 가 문자열이 아닌데 통과한다');
});

/* ══════════════════════════════════════════════════════════════════════════
   T3 — create_project 가 «활성»을 바꾸나
        (G7 은 «응답값»만 잰다. 여기서는 «반대쪽 끝»에서 다시 읽고, 둘이 «같은 말»을 하나 본다.)
   ══════════════════════════════════════════════════════════════════════════ */
test('T3 ★create 는 «활성»을 안 바꾼다 — 응답과 «다른 도구의 눈»을 대조한다', async () => {
  reseed([{ id: 'proj_1000000000001', name: '열려 있던 것' }]);
  H.setActiveProject('proj_1000000000001');
  opsLog.length = 0;

  const before = (await H.call('list_projects', {})).result.activeProjectId;
  assert.strictEqual(before, 'proj_1000000000001', '기준선이 안 섰다');

  const c = (await H.call('create_project', { name: '새로 만든 것' })).result;
  assert.strictEqual(c.ok, true, JSON.stringify(c));

  const after = (await H.call('list_projects', {})).result.activeProjectId;
  assert.strictEqual(after, before,
    `★create 가 활성을 «몰래» 바꿨다: ${before} → ${after}. 다음 편집이 새 프로젝트로 샌다`);
  // ★양끝 대조 — 도구가 «말한» 활성과 서버가 «읽는» 활성이 갈리면 어느 쪽도 못 믿는다.
  assert.strictEqual(c.activeProject, after,
    `★create 응답의 activeProject(${c.activeProject})가 실제 활성(${after})과 다르다 — 응답이 거짓말한다`);
  assert.strictEqual(c.opened, false, '★opened:true 라고 말한다 — 열지 않았는데');
  assert.ok(!opsLog.some(x => x.startsWith('open:')),
    `★create 가 open 을 «따라 부른다»: ${opsLog.join(',')} — 응답은 opened:false 라고 말하는데도`);

  // ★양성대조 — 활성이 안 바뀐 게 「아무 일도 안 해서」가 아니다. 만들긴 «만들었다».
  assert.ok(opsLog.includes('create'), '★계측기가 죽어 있다 — create 가 ops 까지 안 갔다');
  assert.ok(fs.existsSync(path.join(DIR, c.projectId, 'proj.json')),
    '★활성은 안 바뀌었는데 프로젝트도 «안» 생겼다 — 그건 성공이 아니다');
  const listed = (await H.call('list_projects', {})).result.projects.map(p => p.id);
  assert.ok(listed.includes(c.projectId), '★만든 것이 목록에 «안» 보인다 — 만들고 못 찾으면 못 쓴다');
});

/* ══════════════════════════════════════════════════════════════════════════
   T4 — duplicate_project 가 «무엇까지» 복제하나
        (「복제됐다」와 「전부 복제됐다」는 다른 사실이다)
   ★대상은 main.js _duplicateProjectImpl «본체»다. 스텁이 아니다.
   ══════════════════════════════════════════════════════════════════════════ */
const SRC_ID = 'proj_1000000000001';
const SRC_META_AT = '2020-05-05T00:00:00.000Z';   // ★원본 meta 의 «낡은» 시각 — 사본에 새면 잡힌다
function seedRichSource() {
  reseed([]);
  const d = path.join(DIR, SRC_ID);
  fs.mkdirSync(path.join(d, 'images'), { recursive: true });
  fs.mkdirSync(path.join(d, 'assets'), { recursive: true });
  fs.mkdirSync(path.join(d, 'claude-pm'), { recursive: true });
  fs.writeFileSync(path.join(d, 'images', 'aig_1.png'), 'IMAGE-BYTES');
  fs.writeFileSync(path.join(d, 'assets', 'ast_hash.png'), 'ASSET-BYTES');
  fs.writeFileSync(path.join(d, 'claude-pm', 'memo.md'), '섹션 메모·체크리스트가 사는 곳');
  fs.writeFileSync(path.join(d, 'proj.json'), JSON.stringify({
    id: SRC_ID, name: '원본', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    pages: [{
      id: 'page_1', name: 'Page 1',
      canvas: `<div id="canvas"><img src="goya-asset://${SRC_ID}/assets/ast_hash.png"></div>`,
    }],
    blocks: [{ blockId: 'b1', blobPath: `/${SRC_ID}/images/aig_1.png` }],
    branches: { main: { snapshot: '{}', createdAt: 1, updatedAt: 1 } },
  }), 'utf8');
  fs.writeFileSync(path.join(d, 'proj_meta.json'), JSON.stringify({
    id: SRC_ID, name: '원본', thumbnail: 'THUMB-BASE64', collabRef: 'room-abc',
    externalized: true, listMetaV: 1, createdAt: SRC_META_AT, updatedAt: SRC_META_AT,
  }), 'utf8');
}

test('T4 ★복제의 «범위»를 하나하나 센다 — 진짜 파일시스템에서', async () => {
  seedRichSource();
  H.setActiveProject(SRC_ID);

  const r = (await H.call('duplicate_project', { sourceProjectId: SRC_ID, newName: '사본 A' })).result;
  assert.strictEqual(r.ok, true, JSON.stringify(r));
  const NEW = r.newProjectId;
  assert.match(NEW, /^proj_\d+$/, `새 id 모양이 이상하다: ${NEW}`);
  assert.notStrictEqual(NEW, SRC_ID, '★같은 id 를 돌려줬다 — 복제가 아니라 덮어쓰기다');
  console.error(`  [실측] ${SRC_ID} → ${NEW} · 사본 구성: ${fs.readdirSync(path.join(DIR, NEW)).sort().join(' ')}`);

  const dup = JSON.parse(fs.readFileSync(path.join(DIR, NEW, 'proj.json'), 'utf8'));
  // ⑴ 문서 — id·이름·시각이 갈아끼워졌나
  assert.strictEqual(dup.id, NEW, '★사본 안의 id 가 «원본»이다 — 두 프로젝트가 같은 id 를 주장한다');
  assert.strictEqual(dup.name, '사본 A', 'newName 이 안 먹었다');
  assert.notStrictEqual(dup.createdAt, '2026-01-01T00:00:00.000Z', '사본의 createdAt 이 원본 값 그대로다');

  // ⑵ ★캔버스 안의 goya-asset:// — 원본 id 가 남으면 프로토콜 핸들러가 «원본 폴더»를 읽는다
  assert.ok(dup.pages[0].canvas.includes(`goya-asset://${NEW}/`),
    `★캔버스 URL 이 원본을 가리킨다 — 원본을 지우면 사본 이미지가 깨진다:\n    ${dup.pages[0].canvas}`);
  assert.ok(!dup.pages[0].canvas.includes(SRC_ID), '★캔버스에 원본 id 가 남아 있다');
  // ⑶ blobPath 재매핑
  assert.strictEqual(dup.blocks[0].blobPath, `/${NEW}/images/aig_1.png`,
    `★blobPath 가 원본을 가리킨다: ${dup.blocks[0].blobPath}`);

  // ⑷ images = «실복사»(가변) · assets = «하드링크 공유»(content-hash 불변, 85MB 재복사 회피)
  const ino = (id, sub, f) => fs.statSync(path.join(DIR, id, sub, f)).ino;
  assert.strictEqual(fs.readFileSync(path.join(DIR, NEW, 'images', 'aig_1.png'), 'utf8'), 'IMAGE-BYTES',
    '★images 가 «안» 따라왔다 — AI 생성 이미지가 사본에서 사라진다');
  assert.notStrictEqual(ino(NEW, 'images', 'aig_1.png'), ino(SRC_ID, 'images', 'aig_1.png'),
    '★images 를 하드링크로 «공유»한다 — 사본에서 편집하면 원본 이미지가 같이 바뀐다');
  assert.strictEqual(ino(NEW, 'assets', 'ast_hash.png'), ino(SRC_ID, 'assets', 'ast_hash.png'),
    '★assets 를 실복사한다 — dedup 이 깨져 85MB 가 한 벌 더 쌓인다(설계는 하드링크다)');

  // ⑸ meta — 썸네일은 «따라오고», collabRef·externalized 는 «안» 따라온다
  const meta = JSON.parse(fs.readFileSync(path.join(DIR, NEW, 'proj_meta.json'), 'utf8'));
  assert.strictEqual(meta.thumbnail, 'THUMB-BASE64', '★썸네일이 안 따라왔다 — 갤러리에서 빈 칸이 된다');
  assert.strictEqual(meta.collabRef, undefined,
    '★★collabRef 가 사본에 딸려갔다 — 두 프로젝트가 «같은 협업방»을 가리켜 서로의 편집을 덮어쓴다(데이터 사고)');
  assert.strictEqual(meta.externalized, undefined,
    '★externalized 마커가 딸려갔다 — 사본에는 되돌릴 원본이 없어 의미가 없다');
  assert.strictEqual(meta.name, '사본 A',
    '★목록 캐시(meta.name)가 «원본 이름»이다 — 갤러리에 같은 이름 둘이 뜬다');
  /* ★목록 캐시는 «사본 기준»으로 다시 써야 한다. 원본 meta 를 그대로 복사하면 meta.mtime 이
     proj.json 보다 최신이라 목록이 «원본의 낡은 시각»을 그대로 보여준다(빠른 경로가 그걸 믿는다). */
  assert.strictEqual(meta.createdAt, dup.createdAt,
    `★meta 의 목록필드가 «원본 값»으로 stale 하다(meta ${meta.createdAt} / 사본 ${dup.createdAt}) — 갤러리 정렬이 틀어진다`);
  assert.notStrictEqual(meta.createdAt, SRC_META_AT, '★원본 meta 의 시각이 사본에 그대로 남았다');

  // ⑹ 목록에서 «둘 다» 보인다 (진짜 _listProjectsImpl 로 확인)
  const ids = R._listProjectsImpl({ withDiag: true }).items.map(i => i.id);
  assert.ok(ids.includes(SRC_ID) && ids.includes(NEW), `목록에 둘 다 없다: ${ids.join(' ')}`);
});

test('T4b ⚠️현행 동작(정답 아님) — claude-pm 이 «안» 따라온다. 고치면 여기가 빨개진다 · 고칠 때 같이 지워라', () => {
  /* ⛔이 검사는 «규격이 아니다». 계약 픽스처가 결함을 「정답」으로 굳히는 모양을 막으려고
     그 사실을 «검사 이름»에 박았다 — 다음 사람이 목록만 보고 규격으로 읽지 못하게.
     지디 판단(2026-09-07): 설명문은 «오늘» 고친다(거짓이므로), 동작 확대는 «별건»으로 온다
     — 메모가 가리키는 섹션/블록 id 가 사본에서도 유효한가(참조 무결성)를 안 쟀기 때문이다. */
  /* ★2026-09-07 실측. duplicate_project 의 설명문은
       "full copy (proj.json + assets/images + claude-pm folder)"
     라고 «말하지만», _duplicateProjectImpl 이 tmpDir 로 옮기는 건 images/ 와 assets/ 뿐이다.
     ⇒ 사본을 열면 섹션 메모·체크리스트가 «조용히» 없다. 설명문이 사실보다 «넓다».
     ⛔이 줄은 그것이 옳다는 뜻이 «아니다». 「지금 이렇다」를 못 박아 둔 것이다 —
       복사하도록 고치면 이 검사가 «빨강»으로 알려 준다. 그때 여기와 설명문을 «같이» 뒤집어라. */
  const dupId = dirsNow().find(id => id !== SRC_ID);
  assert.ok(dupId, '★사본이 없다 — T4 가 먼저 돌아야 한다(양성대조)');
  assert.ok(fs.existsSync(path.join(DIR, SRC_ID, 'claude-pm', 'memo.md')),
    '★양성대조 실패 — 원본에 claude-pm 이 애초에 없으면 아래 판정은 «못 잰» 것이다');
  assert.strictEqual(fs.existsSync(path.join(DIR, dupId, 'claude-pm')), false,
    '★claude-pm 이 «따라왔다» — 좋은 변화다. 설명문과 이 검사를 같이 고쳐라(TEST-project-crud-0907 T4)');
});

/* ══════════════════════════════════════════════════════════════════════════
   T5 — 복제본이 «원본과 독립»인가 (얕은 복사면 사고가 조용히 난다)
   ══════════════════════════════════════════════════════════════════════════ */
test('T5 ★복제 후 원본을 고쳐도 사본은 «안» 변한다 (문서·이미지 양쪽 + 반대방향)', async () => {
  seedRichSource();
  H.setActiveProject(SRC_ID);
  const NEW = (await H.call('duplicate_project', { sourceProjectId: SRC_ID })).result.newProjectId;

  // 원본을 «고친다» — 이름·캔버스·blobPath·이미지 파일까지
  const sp = path.join(DIR, SRC_ID, 'proj.json');
  const src = JSON.parse(fs.readFileSync(sp, 'utf8'));
  src.name = '원본을 고쳤다';
  src.pages[0].canvas = '<div id="canvas">원본만 바뀐 내용</div>';
  src.blocks[0].blobPath = '/바뀐/경로.png';
  fs.writeFileSync(sp, JSON.stringify(src), 'utf8');
  fs.writeFileSync(path.join(DIR, SRC_ID, 'images', 'aig_1.png'), 'ORIGINAL-CHANGED');

  const dup = JSON.parse(fs.readFileSync(path.join(DIR, NEW, 'proj.json'), 'utf8'));
  assert.strictEqual(dup.name, '원본 (사본)', `★사본 이름이 원본을 따라 변했다: ${dup.name}`);
  assert.ok(!dup.pages[0].canvas.includes('원본만 바뀐 내용'), '★사본 캔버스가 원본을 따라 변했다(얕은 복사)');
  assert.strictEqual(dup.blocks[0].blobPath, `/${NEW}/images/aig_1.png`, '★사본 blobPath 가 원본을 따라 변했다');
  assert.strictEqual(fs.readFileSync(path.join(DIR, NEW, 'images', 'aig_1.png'), 'utf8'), 'IMAGE-BYTES',
    '★★사본 이미지가 원본을 따라 바뀌었다 — images 를 공유하고 있다');

  // ★반대방향 — 사본을 고쳐도 «원본»이 안 변한다
  const dp = path.join(DIR, NEW, 'proj.json');
  const d2 = JSON.parse(fs.readFileSync(dp, 'utf8'));
  d2.name = '사본만 고쳤다';
  fs.writeFileSync(dp, JSON.stringify(d2), 'utf8');
  assert.strictEqual(JSON.parse(fs.readFileSync(sp, 'utf8')).name, '원본을 고쳤다',
    '★사본을 고쳤더니 원본이 변했다');

  /* ★assets 는 «일부러» 하드링크다(불변 content-hash). 그래서 «자리를 갈아끼우면»(unlink→write,
     실제 쓰기 경로) 갈라지고 «제자리 덮어쓰기»만 같이 바뀐다 — 후자는 이 저장소에서 안 일어난다.
     ⇒ 하드링크 하나로 「독립이 아니다」라고 오판하지 않도록 «갈아끼워» 확인한다. */
  const aNew = path.join(DIR, NEW, 'assets', 'ast_hash.png');
  fs.unlinkSync(aNew); fs.writeFileSync(aNew, 'REPLACED');
  assert.strictEqual(fs.readFileSync(path.join(DIR, SRC_ID, 'assets', 'ast_hash.png'), 'utf8'), 'ASSET-BYTES',
    '★asset 을 갈아끼웠더니 원본까지 바뀌었다');
});

test('T5b ★★sourceData 로 넘긴 «호출측 객체»를 그 자리에서 뜯어고치지 않는다', async () => {
  /* ⚠️MCP 는 sourceData 를 안 쓴다 — 그래서 MCP 만 지나가는 검사로는 이 줄을 «못 잰다»
     (실측: 깊은복제를 얕은복제로 바꿔도 T4·T5 가 전부 초록이었다).
     이 인자는 «버전 히스토리 → 사본으로 열기»(main.js U5)와 H4 가 쓴다. 거기서 얕은 복제면
     사용자가 «보고 있던» 옛 스냅샷 객체의 id·name 이 그 자리에서 바뀐다.
     ⇒ 구현을 «직접» 불러서 잰다. 대역을 지나가면 안 보이는 자리다. */
  seedRichSource();
  const caller = JSON.parse(fs.readFileSync(path.join(DIR, SRC_ID, 'proj.json'), 'utf8'));
  const snapshot = JSON.stringify(caller);

  const r = await R._duplicateProjectImpl({ sourceProjectId: SRC_ID, sourceData: caller, newName: '사본 B' });
  assert.strictEqual(r.ok, true, JSON.stringify(r));
  assert.strictEqual(JSON.stringify(caller), snapshot,
    `★호출측이 넘긴 객체를 «그 자리에서» 고쳤다 — id/name/blobPath 가 사본 것으로 바뀐다:\n    ${JSON.stringify(caller).slice(0, 200)}`);

  // ★양성대조 — 그래도 사본은 «제대로» 만들어졌다(아무 일도 안 해서 안 변한 게 아니다)
  const made = JSON.parse(fs.readFileSync(path.join(DIR, r.newProjectId, 'proj.json'), 'utf8'));
  assert.strictEqual(made.id, r.newProjectId);
  assert.strictEqual(made.name, '사본 B');
});

/* ══════════════════════════════════════════════════════════════════════════
   T6 — open_project 가 «없는 id»·«형식오류»에 무엇을 하나
        ★핵심은 「활성이 비워지나」다 — 파괴 도구(delete/rename)가 그 값을 보고 판단한다.
        (G12 는 load_timeout 갈래를 잰다. 여기는 «형식오류»·«없는 id» 갈래다.)
   ══════════════════════════════════════════════════════════════════════════ */
test('T6 ★열기 실패는 «활성을 안 건드린다» — 그리고 형식오류는 ops 를 부르지도 않는다', async () => {
  reseed([{ id: 'proj_1000000000001', name: '열려 있는 것' }]);
  H.setActiveProject('proj_1000000000001');
  await H.call('open_project', { projectId: 'proj_1000000000001' });   // 확정 세우기
  const before = (await H.call('list_projects', {})).result.activeProjectId;
  assert.strictEqual(before, 'proj_1000000000001', '기준선이 안 섰다');

  // ⑴ 형식오류 — 도구가 «앞에서» 막는다(ops 까지 가면 그건 이미 창을 흔든 것이다)
  opsLog.length = 0;
  for (const bad of ['nope', '../etc/passwd', 'proj_abc', '', 'proj_1000000000001 ']) {
    const r = await H.call('open_project', { projectId: bad });
    assert.ok(rejected(r), `★형식오류 ${JSON.stringify(bad)} 를 통과시킨다: ${said(r)}`);
    assert.match(said(r), /proj_/, `거절이 «무슨 모양이어야 하는지»를 안 알려준다: ${said(r)}`);
  }
  assert.deepStrictEqual(opsLog, [],
    `★형식만 틀렸는데 창 전환을 «시도»했다: ${opsLog.join(',')} — 검사는 도구 안에서 끝나야 한다`);

  // ★양성대조 — 계측기(opsLog)가 «살아 있나». 멀쩡한 id 는 실제로 ops 를 부른다.
  await H.call('open_project', { projectId: 'proj_1000000000001' });
  assert.deepStrictEqual(opsLog, ['open:proj_1000000000001'],
    '★계측기가 죽어 있었다 — 위의 「0건」은 «못 잰» 것이지 「안 불렀다」가 아니다');

  // ⑵ 형식은 맞지만 «없는» id — ops 까지 가고, 실패하고, ★활성은 그대로여야 한다
  opsLog.length = 0;
  const ghost = await H.call('open_project', { projectId: 'proj_9999999999999' });
  assert.ok(rejected(ghost), '★없는 프로젝트를 «열었다»고 말한다');
  assert.deepStrictEqual(opsLog, ['open:proj_9999999999999'], '없는 id 인데 ops 까지 안 갔다');
  const after = (await H.call('list_projects', {})).result.activeProjectId;
  assert.strictEqual(after, before,
    `★★열기에 실패했는데 활성이 «비워졌다»: ${before} → ${after}. ` +
    'delete_project·rename_project 가 이 값을 보고 판단한다 — 여기가 흔들리면 파괴가 엉뚱한 데로 간다');

  // ⑶ 실패한 전환이 «확정»까지 깨뜨리지는 않는다 (아무 일도 없었는데 다시 열게 하면 안 된다)
  const add = await H.call('add_section', {});
  assert.ok(add.result && add.result.ok === true,
    `★실패한 open 이 확정을 깨뜨렸다 — 캔버스는 그대로인데 사용자가 다시 열어야 한다: ${said(add)}`);
});

/* ══════════════════════════════════════════════════════════════════════════
   T7 — read_project(includeFull) 이 «얼마나» 주나
        (절단을 「내용이 없다」로 오독할 수 있다. F4-5 는 «기본»을 잰다 — 여기는 includeFull.)
   ══════════════════════════════════════════════════════════════════════════ */
test('T7 ★includeFull 은 «한 글자도» 안 자른다 — 그리고 그 사실을 truncated 로 말한다', async () => {
  const BIG = 'X'.repeat(1500000) + '<div id="sec_1"></div>';   // 1.5MB
  reseed([{ id: 'proj_1000000000001', name: '큰 것', canvas: BIG }]);
  H.setActiveProject('proj_1000000000001');
  await H.call('open_project', { projectId: 'proj_1000000000001' });

  const full = await H.call('read_project', { includeFull: true });
  const o = full.result;
  assert.strictEqual(o.ok, true, said(full).slice(0, 200));
  assert.strictEqual(o.truncated, false, '★includeFull 인데 truncated:true — 어느 쪽이 사실인가');
  assert.ok(o.project, '★includeFull 인데 project 본문이 없다');
  assert.strictEqual(o.project.pages[0].canvas.length, BIG.length,
    `★★조용히 잘렸다: ${o.project.pages[0].canvas.length} / ${BIG.length} — ` +
    '자른 걸 안 말하면 부르는 쪽은 「내용이 없다」로 읽는다');
  assert.ok(o.projectSize >= BIG.length, `projectSize(${o.projectSize})가 캔버스보다 작다`);
  console.error(`  [실측] includeFull 응답 ${full.bytes}B · projectSize ${o.projectSize}B (캔버스 ${BIG.length}자)`);

  // ★반대방향 — 같은 프로젝트를 기본으로 부르면 «그 큰 것을 안 싣는다»(비교가 성립해야 판정이다)
  const idx = await H.call('read_project', {});
  assert.strictEqual(idx.result.truncated, true);
  assert.ok(idx.bytes * 100 < full.bytes,
    `★기본(${idx.bytes}B)과 includeFull(${full.bytes}B)의 차이가 없다 — 둘 중 하나가 거짓말이다`);
  assert.strictEqual(idx.result.summary.pages[0].canvasSize, BIG.length,
    '★목차가 «원래 크기»를 안 알려준다 — 그러면 includeFull 을 부를지 판단할 수 없다');
});

/* ══════════════════════════════════════════════════════════════════════════
   T8 — ⛔삭제를 «우회»로 하고 있나 (도구가 없다고 «못 지우는» 건 아닐 수 있다)
   ══════════════════════════════════════════════════════════════════════════ */
test('T8 ★delete_project «말고는» 어떤 도구도 프로젝트를 지우지 못한다 (전수 + 양성대조)', async () => {
  reseed([
    { id: 'proj_1000000000001', name: '대상' },
    { id: 'proj_1000000000002', name: '옆 프로젝트' },   // ★일부러 놔둔다 — 남의 것이 도는 동안 무사한가
  ]);
  H.setActiveProject('proj_1000000000001');
  await H.call('open_project', { projectId: 'proj_1000000000001' });
  const baseline = dirsNow();
  assert.deepStrictEqual(baseline, ['proj_1000000000001', 'proj_1000000000002'], '기준선이 안 섰다');

  const names = (await H.listTools(true)).map(t => t.name).filter(n => n !== 'delete_project');
  assert.ok(names.length >= 30, `★도구가 ${names.length}개뿐 — 「전수를 다 돌았다」고 말할 수 없다`);
  const vanished = [];
  let ran = 0;
  for (const n of names) {
    const c = CASES[n];
    if (!c) continue;                       // 케이스 커버리지 자체는 F3-0 이 따로 지킨다
    for (const [sn, sa] of (c.setup || [])) await H.call(sn, sa);
    await H.call(n, c.args);
    ran++;
    for (const id of baseline) {
      if (!fs.existsSync(path.join(DIR, id, 'proj.json')) && !vanished.some(v => v.id === id)) {
        vanished.push({ id, by: n });
      }
    }
  }
  assert.deepStrictEqual(vanished, [],
    '★★삭제 «아닌» 도구가 프로젝트를 지웠다 — 그게 우회 경로다:\n  ' +
    vanished.map(v => `${v.id} ← ${v.by}`).join('\n  '));
  console.error(`  [셈] 삭제 제외 도구 ${ran}개 전수 호출 후 프로젝트 ${baseline.length}개 «전부 생존»`);

  // ★★양성대조 — 이 계측이 «지워지는 것을 볼 수 있나». 못 보면 위 초록은 「안 잰」 것이다.
  const del = await H.call('delete_project', { projectId: 'proj_1000000000002' });
  assert.strictEqual((del.result || {}).ok, true, `양성대조가 실패했다: ${said(del)}`);
  assert.ok(!fs.existsSync(path.join(DIR, 'proj_1000000000002')),
    '★★계측기가 «삭제조차» 못 본다 — 위의 「아무도 안 지웠다」는 증거가 아니다');
  assert.ok(fs.existsSync(path.join(DIR, 'proj_1000000000001', 'proj.json')),
    '★삭제가 «지목한 것 말고»까지 가져갔다');
});

/* ══════════════════════════════════════════════════════════════════════════
   T9 — 이름 수정. D8 은 «도구가 있나»만 본다.
        여기서는 main.js _renameProjectImpl 을 «진짜 fs»에 돌려 «효과»를 잰다.
   ══════════════════════════════════════════════════════════════════════════ */
test('T9 ★rename 은 «디스크에» 남고 목록에 반영되며, 옆 프로젝트로 안 샌다', async () => {
  reseed([
    { id: 'proj_1000000000001', name: '옛 이름' },
    { id: 'proj_1000000000002', name: '건드리면 안 되는 것' },
  ]);
  H.setActiveProject('proj_1000000000001');
  await H.call('open_project', { projectId: 'proj_1000000000001' });
  const projPath = path.join(DIR, 'proj_1000000000001', 'proj.json');

  const r = (await H.call('rename_project', { projectId: 'proj_1000000000001', name: '새 이름' })).result;
  assert.strictEqual(r.ok, true, JSON.stringify(r));
  assert.strictEqual(r.previousName, '옛 이름', '★무엇을 바꿨는지 안 말한다 — 되돌릴 근거가 없다');
  assert.strictEqual(r.changed, true);
  // ★효과로 판정한다 — 「응답이 ok」가 아니라 «디스크에서 다시 읽어»
  assert.strictEqual(JSON.parse(fs.readFileSync(projPath, 'utf8')).name, '새 이름',
    '★응답은 ok 인데 디스크는 안 바뀌었다');
  const listed = (await H.call('list_projects', {})).result.projects;
  assert.strictEqual(listed.find(p => p.id === 'proj_1000000000001').name, '새 이름',
    '★★목록에는 «옛 이름»이 남는다 — 사람은 갤러리를 본다');
  assert.strictEqual(listed.find(p => p.id === 'proj_1000000000002').name, '건드리면 안 되는 것',
    '★옆 프로젝트 이름까지 바뀌었다');

  // 같은 이름으로 다시 → changed:false («했다»고 거짓말하지 않는다)
  const again = (await H.call('rename_project', { projectId: 'proj_1000000000001', name: '새 이름' })).result;
  assert.strictEqual(again.changed, false, '★안 바꿨는데 바꿨다고 말한다');

  // 반대방향 — 빈 이름·공백만·101자·없는 프로젝트는 «거절»하고 원본은 그대로다
  for (const bad of ['', '   ', 'ㄱ'.repeat(101)]) {
    assert.ok(rejected(await H.call('rename_project', { projectId: 'proj_1000000000001', name: bad })),
      `★이름 ${JSON.stringify(bad.slice(0, 12))} 를 받아들인다`);
  }
  const ghost = await H.call('rename_project', { projectId: 'proj_9999999999999', name: 'x' });
  assert.ok(rejected(ghost), '★없는 프로젝트의 이름을 «바꿨다»고 말한다');
  assert.match(said(ghost), /not found|없/,
    `★거절은 하는데 «왜»를 안 말한다(fs 예외가 그대로 새어 나온다): ${said(ghost)}`);
  assert.strictEqual(JSON.parse(fs.readFileSync(projPath, 'utf8')).name, '새 이름',
    '★거절된 호출이 값을 건드렸다');
});

test('T9b ★★도구 층이 아니라 «구현 자체»가 이름을 검사한다 (위층 가드가 사라져도 안 벌거벗게)', async () => {
  /* ⚠️실측(2026-09-07): _renameProjectImpl 의 빈이름 가드를 지워도 T9 는 초록이었다 —
     MCP 도구가 «앞에서» 같은 걸 막아 주기 때문이다. 그건 「이 구현이 안전하다」의 증거가 아니다.
     (rename 은 IPC·버전복원 등 도구 말고 다른 데서도 불린다.) ⇒ 구현을 «직접» 부른다. */
  reseed([{ id: 'proj_1000000000001', name: '지켜야 할 이름' }]);
  const p = path.join(DIR, 'proj_1000000000001', 'proj.json');
  for (const bad of [undefined, null, '', '   ', '\t\n', 'ㄱ'.repeat(101)]) {
    const r = await R._renameProjectImpl({ projectId: 'proj_1000000000001', name: bad });
    assert.strictEqual(r.ok, false, `★구현이 이름 ${JSON.stringify(bad)} 를 «그냥 받는다»`);
    assert.strictEqual(r.code, 'invalid', `거절 사유가 invalid 가 아니다: ${JSON.stringify(r)}`);
  }
  for (const bad of ['', 'nope', '../etc/passwd', 'proj_1/../x']) {
    const r = await R._renameProjectImpl({ projectId: bad, name: 'x' });
    assert.strictEqual(r.ok, false, `★구현이 projectId ${JSON.stringify(bad)} 를 «그냥 받는다»`);
  }
  assert.strictEqual(JSON.parse(fs.readFileSync(p, 'utf8')).name, '지켜야 할 이름',
    '★거절된 호출이 값을 건드렸다');
  // ★양성대조 — 멀쩡한 이름은 «된다»(막기만 하는 검사는 반대방향 오탐을 못 잡는다)
  const good = await R._renameProjectImpl({ projectId: 'proj_1000000000001', name: '정상 이름' });
  assert.strictEqual(good.ok, true, JSON.stringify(good));
  assert.strictEqual(JSON.parse(fs.readFileSync(p, 'utf8')).name, '정상 이름');
});

test('T9c ★★「썼다」를 안 믿고 «되읽어» 확인한다 — 저장이 거짓말하면 ok 를 안 준다', async () => {
  /* ★rename 은 저장 뒤 디스크에서 다시 읽어 값을 대조한다(code:'noeffect').
     그 줄은 «저장이 거짓말할 때»만 밟힌다 — 정상 저장으로는 영원히 안 밟혀서,
     지워도 아무 검사가 안 울렸다(실측). ⇒ «거짓말하는 저장»을 꽂아서 잰다. */
  reseed([{ id: 'proj_1000000000001', name: '원래 이름' }]);
  const p = path.join(DIR, 'proj_1000000000001', 'proj.json');
  R.__setSave(async (proj) => {                       // 저장은 «성공»했다고 말하면서 딴 값을 쓴다
    fs.writeFileSync(p, JSON.stringify(Object.assign({}, proj, { name: '엉뚱한 이름' })), 'utf8');
    return { ok: true };
  });
  try {
    const r = await R._renameProjectImpl({ projectId: 'proj_1000000000001', name: '원하는 이름' });
    assert.strictEqual(r.ok, false,
      '★★저장이 «딴 값»을 썼는데 성공이라고 답한다 — 사용자는 바뀐 줄 알고, 갤러리는 딴 이름을 띄운다');
    assert.strictEqual(r.code, 'noeffect', `사유가 noeffect 가 아니다: ${JSON.stringify(r)}`);
  } finally {
    R.__setSave(null);
  }
  // ★양성대조 — 저장을 되돌리면 «된다»(위 빨강이 「무조건 실패」가 아니었음을 증명)
  const ok = await R._renameProjectImpl({ projectId: 'proj_1000000000001', name: '원하는 이름' });
  assert.strictEqual(ok.ok, true, JSON.stringify(ok));
  assert.strictEqual(JSON.parse(fs.readFileSync(p, 'utf8')).name, '원하는 이름');
});
