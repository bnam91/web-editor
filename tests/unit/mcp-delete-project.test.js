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
const { readSrc } = require('./_srcread.js');   // ★CRLF 체크아웃 방어(윈도우 core.autocrlf=true)


/** ★`_deleteProjectImpl` 의 «전체» 본문. ⛔고정 길이 창(slice(i, i+4000))을 쓰지 마라 —
 *  2026-09-07 실측: 주석을 늘렸더니 코드가 «창 밖»으로 밀려 D7 이 «가짜 빨강»을 냈다.
 *  검사가 「주석 길이」에 딸려 가면 그건 검사가 아니다. 함수 끝까지 잡는다. */
function implBody() {
  const fs = require('fs'), path = require('path');
  const src = readSrc(__dirname, '..', '..', 'main.js');
  const i = src.indexOf('async function _deleteProjectImpl');
  assert.ok(i > 0, '_deleteProjectImpl 이 없다');
  const j = src.indexOf('\n}\n', i);
  return src.slice(i, j > 0 ? j : i + 20000);
}
/** ★2026-09-08: 활성 비우기가 «두 삭제 경로가 공유하는 헬퍼»로 빠졌다.
 *   본문만 보면 「사라졌다」로 보이는데 «옮긴 것»이다 — 옮긴 자리를 재고,
 *   ⛔«실제로 부르는지»도 같이 재라. 안 그러면 헬퍼만 있고 아무도 안 부르는 «죽은 배선»이 초록이 된다. */
function clearActiveBody() {
  const src = readSrc(__dirname, '..', '..', 'main.js');
  const i = src.indexOf('async function _clearActiveIfNeeded');
  assert.ok(i > 0, '_clearActiveIfNeeded 가 없다 — 활성 비우기가 통째로 사라졌다');
  const j = src.indexOf('\n}\n', i);
  return src.slice(i, j > 0 ? j : i + 8000);
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
  const body = clearActiveBody();
  assert.ok(/global\.currentActiveProjectId\s*=\s*null/.test(body),
    '★콜백이 읽는 global 을 안 비운다');
  assert.ok(/getURL\(\)/.test(body) && /project=/.test(body),
    '★창 URL 의 ?project= 를 «안» 본다 — _activeProjectId() 는 거기도 읽는다(그래서 G2 가 실패했다)');
  // ⛔헬퍼가 «있기만» 하면 안 된다 — 삭제 경로가 실제로 불러야 한다
  assert.match(implBody(), /_clearActiveIfNeeded\(/,
    '★헬퍼는 있는데 삭제가 «안 부른다» — 죽은 배선이다');
});

test('D11 ★설명이 «런타임과 같은 말»을 한다 — 게이트 계약 (앱매니저 제보, 2026-09-08)', async () => {
  /* ⛔여기 설명은 「projectId 를 직접 받으니 active 에 작용하지 않고 expectedProject 가드가 필요 없다」
       였는데, 런타임은 확정(open_project 성공)을 «요구»한다. 다른 세션이 그 어긋남에 걸렸다.
     ★어느 쪽이 맞나: 런타임이 맞다(F3-7 이 옛 면제 시도를 빨강으로 잡았다).
       축은 「지목했느냐」가 아니라 「지목이 틀렸을 때 남의 것이 변하느냐」다 — 삭제는 변한다.
     ⇒ 이 검사는 «설명»과 «실제 거절»을 «같은 실행»에서 대조한다. 한쪽만 고치면 빨개진다. */
  const tool = (await H.listTools(true)).find(t => t.name === 'delete_project');
  const d = String(tool.description || '');

  /* ⑴ 런타임 — 확정을 «실제로 푼 뒤» projectId 만 주면 거절한다.
     ⚠️confirmProject 는 하네스 «기동» 옵션이라 호출에 못 쓴다(그렇게 썼다가 못 쟀다).
       ⇒ 엇갈린 expectedProject 로 게이트를 «한 번 튕겨» 확정을 풀고(그때 _setConfirmed(null) 된다),
         그 상태에서 다시 부른다. 이게 사용자가 실제로 겪는 순서다. */
  const bump = await H.call('delete_project',
    { projectId: 'proj_1700000000000', expectedProject: 'proj_1700000000001' });
  assert.match(JSON.stringify(bump.result || bump.error), /PROJECT_MISMATCH/,
    '전제: 엇갈린 expectedProject 가 게이트를 튕겨야 확정이 풀린다');
  const r = await H.call('delete_project', { projectId: 'proj_1700000000000' });
  const said = JSON.stringify(r.result || r.error || r.rawText);
  assert.match(said, /NO_ACTIVE_PROJECT|PROJECT_NOT_CONFIRMED/,
    `★확정 없이 통과시켰다 — 파괴 도구가 열린 적 없는 대상에 작용한다: ${said}`);

  /* ⑵ ★★«다른 칸»도 밟는다 — expectedProject 는 «대조»가 아니라 «확인 경로 그 자체»다.
     ⛔내가 한 번 「대조만 한다」로 잘못 적었고(앱매니저가 원자료로 반증), D11 이 그 거짓을 «잠그고» 있었다.
       원인은 «한쪽 시퀀스만 재고 게이트 전체를 안다고 쓴 것». ⇒ 검사가 두 칸을 다 밟게 만든다. */
  /* ⛔조건부로 «건너뛰지» 않는다 — 첫 판이 H.activeProjectOf(없는 함수)를 봐서 이 블록이
       «조용히 건너뛰어졌다»(가짜 초록). 활성은 위 거절 응답이 «들고 있다» — 거기서 꺼낸다. */
  const active = (r.result && r.result.activeProject) || null;
  assert.ok(active, `전제: 활성이 서 있어야 «두 번째 칸»을 잴 수 있다 — 응답: ${said}`);
  const viaExpected = await H.call('delete_project',
    { projectId: 'proj_1700000000000', expectedProject: active });
  const s2 = JSON.stringify(viaExpected.result || viaExpected.error || viaExpected.rawText);
  assert.ok(!/PROJECT_NOT_CONFIRMED/.test(s2),
    `★expectedProject 를 줬는데도 「지목한 적 없다」고 한다 — 확인 경로가 하나뿐이면 사용자가 갇힌다: ${s2}`);

  // ⑶ 설명 — 그 «두 조건·두 길»을 다 말한다
  assert.match(d, /open_project/, '★확정이 필요한데 설명이 open_project 를 안 말한다');
  /* ⛔낱말이 «어딘가» 있는 걸로 재면 안 된다 — 변이 M16(「or expectedProject」만 지움)이 살아남았다.
       설명 안에 `expectedProject alone does NOT satisfy this`(⒜ 쪽 경고)가 따로 있어서 통과해 버렸다.
     ⇒ 「«또 하나의» 지목 경로」라고 말하는지를 잰다. */
  assert.match(d, /or\s+you\s+pass\s+expectedProject/i,
    '★expectedProject 가 «또 하나의 지목 경로»라는 걸 설명이 안 말한다 — 모르면 PROJECT_NOT_CONFIRMED 에 갇힌다');
  assert.ok(!/needs no expectedProject guard|does NOT act on the "active" project/i.test(d),
    '★설명이 아직 「가드가 필요 없다」고 말한다 — 런타임은 요구한다(계약이 거짓말)');
  assert.ok(!/expectedProject does NOT bypass|only cross-checks/i.test(d),
    '★설명이 「expectedProject 는 대조만 한다」고 말한다 — 실제로는 «확인 경로»다(내가 틀렸던 자리)');
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
  /* ⚠️★2026-09-07 이 검사는 원래 「.gdt 로 담나」를 «정답»으로 굳혀 뒀다. 그건 틀렸다 —
       `.gdt` 는 이미 «확정된» zip 포맷이고, gdt-verify 픽스처 `bad_02_plaintext.gdt`(확장자만 .gdt)는
       «거부»가 정답이다. 내가 만든 게 정확히 그 거부 대상이었고, 검사가 그걸 지켜 줬다.
     ★2026-09-08 «재는 자리를 옮겼다» — 휴지통 구현이 main/trash.js 로 갔다(현빈 지시, 앱 휴지통 탭).
       지킬 것은 그대로다: 「.gdt 를 «안» 쓴다」 + 「알아볼 수 있다」 + 「되돌릴 길이 있다」. */
  const src = readSrc(__dirname, '..', '..', 'main', 'trash.js');
  const code = stripComments(src);

  /* ★★2026-09-08 «전제가 바뀌었다» — 현빈 지시로 만료분을 «진짜» .gdt 로 포장하게 됐다.
       옛 규칙은 「.gdt 를 쓰지 마라」였는데, 그건 «확장자만 .gdt 인 폴더»를 만들던 시절의 것이다.
       ★지켜야 할 것은 「.gdt 를 안 쓴다」가 아니라 ⇒ 「.gdt 라는 이름을 달았으면 «진짜여야 한다»」다.
         (규격의 이름을 달고 규격이 아닌 것이 제일 나쁘다 — 그 원칙은 그대로다.)
     ⇒ 이제 잰다: ⑴포장기를 «주입»받아 쓰는가(직접 zip 을 흉내내지 않는가)
                  ⑵포장 «성공을 확인한 뒤에만» 원본을 치우는가 */
  const gdtLines = code.split('\n').filter(l => /\.gdt/.test(l));
  if (gdtLines.length) {
    assert.match(code, /packageGdt/,
      '★.gdt 를 «직접» 만들고 있다 — 포장은 검증까지 하는 main/gdt/export 에 맡겨야 한다');
    assert.match(code, /!fs\.existsSync\(out\)/,
      '★「만들었다」를 «파일이 있나»로 확인하지 않는다 — 거짓 성공에 원본을 잃는다');
    assert.match(code, /package_failed/, '★포장 실패를 «말하지» 않는다');
  }
  // 알아볼 수 있어야 한다 — 이름을 «갤러리와 같은 출처»에서 가져온다
  assert.match(code, /proj_meta\.json/, '★갤러리가 쓰는 이름(proj_meta)을 안 본다 — 휴지통에 옛 이름이 뜬다');
  assert.match(code, /name:\s*projName/, '★이름을 안 남긴다 — 휴지통에서 못 알아본다');
  // 되돌릴 길
  assert.match(code, /function restoreFromTrash/, '★되살리는 길이 없다');
  assert.match(code, /deletedAt/, '★언제 지웠는지가 없으면 «며칠 남았나»를 못 센다');
  // ⛔되살릴 때 «덮어쓰지» 않는다
  assert.match(code, /id_taken/, '★자리가 차 있어도 덮어쓴다 — 남의 작업이 사라진다');
});

