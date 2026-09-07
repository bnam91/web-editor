/* mcp-delete-project.test.js — 프로젝트 «삭제»(휴지통). 2026-09-07 신설 · 현빈 지시.
 *
 * ★왜 필요했나: 도구 33개에 삭제가 «없었다». 그래서 사람이 파일시스템에서 rm 해야 했고,
 *   그러면 앱이 그걸 «모르고» activeProjectId 가 죽은 id 를 계속 가리켰다(2026-09-07 실측).
 *
 * ★설계 결정 셋 — 이 검사가 «그 결정»을 붙들어 둔다:
 *   ⑴ 휴지통으로 «옮긴다» — 영구삭제 아님. 되돌릴 수 있어야 위험 등급이 내려간다.
 *   ⑵ 마지막 프로젝트도 지울 수 있다 — 갤러리에 그 제약이 없고 0개 상태를 앱이 이미 다룬다.
 *   ⑶ expectedProject 를 «안» 붙인다 — projectId 를 직접 지목하므로 벨트가 필요 없다.
 */
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startHarness } = require('./_mcp-harness');


/** ★`_deleteProjectImpl` 의 «전체» 본문. ⛔고정 길이 창(slice(i, i+4000))을 쓰지 마라 —
 *  2026-09-07 실측: 주석을 늘렸더니 코드가 «창 밖»으로 밀려 D7 이 «가짜 빨강»을 냈다.
 *  검사가 「주석 길이」에 딸려 가면 그건 검사가 아니다. 함수 끝까지 잡는다. */
function implBody() {
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'main.js'), 'utf8');
  const i = src.indexOf('async function _deleteProjectImpl');
  assert.ok(i > 0, '_deleteProjectImpl 이 없다');
  const j = src.indexOf('\n}\n', i);
  return src.slice(i, j > 0 ? j : i + 20000);
}
/** 주석을 «통째로» 걷어낸 코드만. 줄 단위로 거르면 여러 줄 주석 안쪽이 남는다. */
const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

let H = null;
const trashed = [];          // 가짜 «휴지통» — 무엇이 들어갔나를 «센다»
let projects = null;

before(async () => {
  H = await startHarness({ activeProject: 'proj_1' });
  // 가짜 projectOps.delete — 진짜 fs 를 안 만지고 «계약»만 잰다
  projects = new Set(['proj_1', 'proj_2']);
  H.mod.setProjectOps({
    list: () => ({ ok: true, projects: [...projects].map(id => ({ id, name: id })) }),
    create: async () => ({ ok: true, projectId: 'proj_new', name: 'x' }),
    open: async () => ({ ok: true }),
    duplicate: async () => ({ ok: true }),
    delete: async ({ projectId }) => {
      if (!/^proj_[A-Za-z0-9_-]+$/.test(projectId || ''))
        return { ok: false, error: `invalid projectId: ${projectId}`, code: 'not_proj' };
      if (!projects.has(projectId))
        return { ok: false, error: `project not found: ${projectId}`, code: 'not_found' };
      const wasActive = (projectId === 'proj_1');
      projects.delete(projectId);
      trashed.push(projectId);                      // ★휴지통으로 «갔다»
      return { ok: true, projectId, trashed: true, wasActive, activeCleared: wasActive };
    },
  });
});
after(async () => { if (H) await H.stop(); });

const said = (r) => JSON.stringify(r.error || r.result || r.rawText || '');

test('D1 ★도구가 «존재»한다 — 없어서 사람이 rm 하던 자리다', async () => {
  const names = (await H.listTools(true)).map(t => t.name);
  assert.ok(names.includes('delete_project'),
    `★delete_project 가 tools/list 에 «없다». registerTool 배선이 빠졌다: ${names.filter(n=>n.includes('project'))}`);
});

test('D2 ★지우면 «휴지통으로 간다» — 영구삭제가 아니다', async () => {
  trashed.length = 0;
  const r = await H.call('delete_project', { projectId: 'proj_2' });
  const txt = said(r);
  console.error(`  응답: ${txt.slice(0, 180)}`);
  assert.ok((r.result || {}).ok === true, `삭제가 실패했다: ${txt.slice(0, 200)}`);
  assert.deepStrictEqual(trashed, ['proj_2'], '★휴지통에 «안» 들어갔다 — 영구삭제면 되돌릴 수 없다');
  assert.strictEqual((r.result || {}).trashed, true, 'trashed:true 를 «말하지» 않으면 호출자가 영구삭제로 읽는다');
  assert.ok(/Trash|휴지통/i.test(txt), '응답이 「휴지통」이라고 «말해주지» 않는다');
});

test('D3 ★활성을 지우면 «활성도 같이» 비운다 (죽은 id 방지)', async () => {
  const r = await H.call('delete_project', { projectId: 'proj_1' });   // proj_1 = 활성
  const res = r.result || {};
  console.error(`  wasActive=${res.wasActive} activeCleared=${res.activeCleared}`);
  assert.strictEqual(res.wasActive, true, '활성이었는데 «아니라고» 말한다');
  assert.strictEqual(res.activeCleared, true,
    '★활성을 «안» 비웠다 — activeProjectId 가 죽은 id 를 가리키게 된다(2026-09-07 실측된 상태)');
  assert.ok(/open_project/.test(JSON.stringify(res)),
    '★「다음에 뭘 해야 하나」를 안 알려준다 — 거절·경고는 곧 «안내»여야 한다');
});

test('D4 ★마지막 프로젝트도 «지울 수 있다» (갤러리와 같은 규칙)', async () => {
  // D2·D3 로 둘 다 지워졌다 = 지금 0개. 「마지막이라 못 지운다」로 막히지 «않았다»는 뜻.
  assert.strictEqual(projects.size, 0,
    '★마지막 프로젝트가 «안» 지워졌다 — 도구가 사람(갤러리)보다 빡빡하면 그건 안전이 아니라 불일치다');
});

test('D5 없는 id · 형식 오류는 «제대로» 거절한다 (반대방향)', async () => {
  const a = await H.call('delete_project', { projectId: 'proj_999999' });
  assert.ok(/not found|없/.test(said(a)), `없는 id 를 «조용히» 통과시킨다: ${said(a).slice(0,160)}`);
  const b = await H.call('delete_project', { projectId: '../etc/passwd' });
  assert.ok(/invalid|proj_/.test(said(b)), `★경로 traversal 을 안 막는다: ${said(b).slice(0,160)}`);
  const c = await H.call('delete_project', {});
  assert.ok(/required/.test(said(c)), `projectId 없이도 도는가: ${said(c).slice(0,160)}`);
});

test('D6 ⛔expectedProject 를 «요구하지 않는다» — 지목형이라 벨트가 불필요하다', async () => {
  const t = (await H.listTools(true)).find(x => x.name === 'delete_project');
  const props = Object.keys((t.inputSchema || {}).properties || {});
  assert.deepStrictEqual(props, ['projectId'],
    `★인자가 늘었다. expectedProject 를 붙였다면 «왜»를 남기고 이 검사를 고쳐라: ${props}`);
  assert.deepStrictEqual(t.inputSchema.required, ['projectId']);
});

test('D7 ★활성을 비울 땐 «읽는 곳을 전부» 비운다 (2026-09-07 G2 에서 잡힌 자리)', () => {
  // ⛔G2 실측: global.currentActiveProjectId 만 비웠더니 «안 비워졌다».
  //   원인 = _activeProjectId() 가 «두 곳»을 본다 — ⑴콜백(global) ⑵★창 URL 의 ?project=
  //   한 곳만 비우면 「비웠다」가 «거짓말»이 된다. 이건 소스로만 잴 수 있어 정적 검사로 둔다.
  const body = implBody();
  assert.ok(/global\.currentActiveProjectId\s*=\s*null/.test(body),
    '★콜백이 읽는 global 을 안 비운다');
  assert.ok(/getURL\(\)/.test(body) && /project=/.test(body),
    '★창 URL 의 ?project= 를 «안» 본다 — _activeProjectId() 는 거기도 읽는다(그래서 G2 가 실패했다)');
});

test('D8 ★rename_project · update_section(name) — 「이름을 못 바꾼다」가 «닫혔나»', async () => {
  const names = (await H.listTools(true)).map(t => t.name);
  assert.ok(names.includes('rename_project'), '★rename_project 가 없다');
  const us = (await H.listTools(true)).find(t => t.name === 'update_section');
  const props = Object.keys((us.inputSchema || {}).properties || {});
  assert.ok(props.includes('name'),
    `★update_section 이 아직 name 을 안 받는다: ${props}`);
  // ⛔거절 문구가 «낡지» 않았나 — 기능이 생겼는데 「못 한다」고 말하면 그게 더 나쁘다
  assert.ok(!/NOT settable via MCP/i.test(us.description || ''),
    '★기능이 생겼는데 설명은 아직 「MCP 로 못 바꾼다」고 말한다 — 되는 걸 안 된다고 하면 아무도 안 쓴다');
});

test('D9 ★도구 원장이 «도구명·대상»을 남긴다 (H4 — 사고 후 추적 가능성)', async () => {
  const fs = require('fs'), path = require('path');
  const led = path.join(H.userData, 'claude-pm', 'tool-audit.jsonl');
  try { fs.unlinkSync(led); } catch (_) {}
  H.reset();
  await H.call('list_projects', { limit: 1 });
  assert.ok(fs.existsSync(led), `★원장이 «안» 써졌다: ${led}`);
  const last = fs.readFileSync(led, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse).pop();
  console.error(`  원장: ${JSON.stringify(last)}`);
  assert.strictEqual(last.tool, 'list_projects', '★도구 «이름»이 안 남는다 — 그게 없어서 426건을 못 셌다');
  assert.ok(Array.isArray(last.argKeys), 'argKeys 가 없다');
  assert.ok(last.at && typeof last.ms === 'number', '시각·소요가 없다');
  // ★★값은 «안» 남아야 한다 — PII·본문 유출 방지
  const raw = fs.readFileSync(led, 'utf8');
  assert.ok(!/"limit":\s*1/.test(raw), `★원장에 인자 «값»이 새어 들어갔다: ${raw.slice(0, 200)}`);
});

test('D10 ★휴지통엔 «알아볼 수 있는 이름» — 단 ⛔`.gdt` 는 «쓰면 안 된다»', () => {
  /* ⚠️★2026-09-07 «검사를 고쳤다» — 이 검사는 원래 「.gdt 로 담나」를 «정답»으로 굳혀 뒀다.
     그건 틀렸다. `.gdt` 는 이미 «확정된» 고디터 프로젝트 파일 포맷이다:
       zip(deflate) + manifest.json/project.json/images/ · package.json fileAssociations 등록(mac·win)
       · gdt-verify 적대적 픽스처에 `bad_02_plaintext.gdt`(확장자만 .gdt) = «거부»가 정답
     ⇒ 내가 만든 게 정확히 그 «거부 대상」이었고, 검사가 그걸 지켜 주고 있었다.
     ★오늘 계약 픽스처에서 겪은 것과 «같은 모양»이다 — 검사가 결함을 정답으로 굳힌다.
     ⇒ 지금 지켜야 할 것은 「.gdt 를 «안» 쓰나」 + 「그래도 알아볼 수 있나」 + 「되돌릴 길이 있나」다. */
  const body = implBody();
  /* ⛔주석을 «줄 단위»로 거르면 여러 줄 주석 «안쪽»이 코드로 남는다(내가 그걸로 한 번 틀렸다).
     ⇒ 블록주석(/* … *​/)과 줄주석을 «통째로» 지운 뒤에 본다. */
  const code = stripComments(body);

  // ★핵심: «코드»가 .gdt 를 만들지 않는다(주석의 설명은 남아도 된다)
  assert.ok(!/\.gdt/.test(code),
    `★코드가 아직 .gdt 를 만든다 — 규격의 «이름»을 달고 규격이 «아닌» 것이 제일 나쁘다:\n${
      code.split('\n').filter(l => /\.gdt/.test(l)).join('\n')}`);

  // 그래도 «알아볼 수 있어야» 한다 — 프로젝트 이름을 쓴다
  assert.ok(/proj\.name|\.name \|\| projectId/.test(body), '★프로젝트 «이름»을 안 쓴다 — 휴지통에서 못 알아본다');
  // 되돌릴 길
  assert.ok(/restore\.json/.test(body), '★restore.json 을 안 남긴다 — 어디로 되돌릴지 모른다');
  assert.ok(/originalPath/.test(body), 'restore.json 에 원래 경로가 없다');
  // ⛔이름 충돌 시 덮어쓰면 남의 것을 지운다
  assert.ok(/existsSync\(staged\)/.test(body), '★이름 충돌 시 덮어쓴다');
  // ★담기에 실패해도 «삭제 자체»는 되어야 한다(그게 사용자가 시킨 일이다)
  assert.ok(/담기 실패/.test(body), '★담기 실패 시 폴백이 없다');
});
