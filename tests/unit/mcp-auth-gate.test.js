/* mcp-auth-gate.test.js — 로그인 게이트가 «가장 먼저» 선다. 2026-09-07 · 현빈 지시.
 *
 * ★왜: 그전엔 MCP 가 인증을 «아예 안 봤다»(mcp-server.js 참조 0건).
 *   게이트는 main.js 의 open_project 한 곳뿐이라 실측이 이랬다:
 *     list_projects 통과 · create_project 통과 · open_project 거절
 *   ⇒ 문 «앞»의 도구가 열려 있었다. 「막혔나」를 안전한 도구로 재면 「안 막혔다」가 나오는 이유다.
 * ★현빈: 「로그인이 안 되면 MCP 를 이후에 쓸 수 없어야 되는 게 맞아. 가장 먼저 확인해야지.」
 */
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startHarness } = require('./_mcp-harness');

let H = null;
before(async () => { H = await startHarness({ activeProject: 'proj_1' }); });
after(async () => { if (H) await H.stop(); });
const said = (r) => JSON.stringify(r.error || r.result || r.rawText || '');
const work = (r) => (r.rendererCalls || []).filter(c => c.method !== 'historyTip');

test('A1 ★로그인 안 됐으면 «문 앞» 도구도 거절된다 (그전엔 통과했다)', async () => {
  H.mod.setAuthProbe(() => ({ authed: false }));
  try {
    for (const t of ['list_projects', 'create_project', 'read_project', 'open_project']) {
      H.reset();
      const r = await H.call(t, t === 'open_project' ? { projectId: 'proj_1' } : {});
      const txt = said(r);
      assert.ok(/NOT_LOGGED_IN/.test(txt), `★${t} 이 로그인 없이 «통과»했다: ${txt.slice(0, 160)}`);
      assert.deepStrictEqual(work(r), [], `★거절했다면서 ${t} 이 렌더러를 «이미 만졌다»`);
    }
  } finally { H.mod.setAuthProbe(() => ({ authed: true })); }
});

test('A2 ★거절이 «안내»다 — 그리고 「기능이 없다」로 읽히면 안 된다', async () => {
  H.mod.setAuthProbe(() => ({ authed: false }));
  try {
    H.reset();
    const txt = said(await H.call('list_projects', {}));
    assert.ok(/NOTHING was done/.test(txt), '「아무 일도 안 했다」를 안 말한다');
    assert.ok(/sign in|로그인/i.test(txt), '★「로그인하라」를 안 알려준다 — 순환이 안 끊긴다');
    // ⛔2026-09-07 실측: 클로드가 «호출 실패»를 「그런 기능이 없습니다」로 «단정»했다.
    //   그래서 거절 문구가 「없는 게 아니라 지금 못 한다」를 «명시»해야 한다.
    assert.ok(/NOT a missing feature/i.test(txt),
      '★「기능이 없는 게 아니다」를 안 말한다 — 클로드가 「지원 안 됨」으로 단정한다');
  } finally { H.mod.setAuthProbe(() => ({ authed: true })); }
});

test('A3 ★「왜 안 되는지」 물어볼 통로는 «남겨» 둔다 (전부 막으면 진단이 죽는다)', async () => {
  H.mod.setAuthProbe(() => ({ authed: false }));
  try {
    const txt = said(await H.call('goditor_which_instance', {}));
    assert.ok(!/NOT_LOGGED_IN/.test(txt), '★진단 도구까지 막았다 — 막힌 이유조차 못 알아낸다');
  } finally { H.mod.setAuthProbe(() => ({ authed: true })); }
});

test('A4 로그인돼 있으면 «그대로» 통과한다 (반대방향 오탐 방지)', async () => {
  H.mod.setAuthProbe(() => ({ authed: true }));
  H.reset();
  const txt = said(await H.call('list_projects', {}));
  assert.ok(!/NOT_LOGGED_IN/.test(txt), `★로그인했는데 막혔다: ${txt.slice(0, 160)}`);
});

test('A5 ★«못 잰» 경우(프로브 미주입)는 «거절»한다 — fail-closed', async () => {
  /* ⛔이 검사는 2026-09-07 에 «뒤집혔다». 1판은 「못 재면 판정하지 않는다(통과)」였고
     근거는 「앱 버전이 낡아 주입이 없을 수 있다」였다. ★그 근거가 틀렸다 —
     프로브를 꽂는 main.js 와 게이트가 있는 mcp-server.js 는 «같은 바이너리»다. 어긋날 수 없다.
     남는 경우는 «배선을 빠뜨렸다» 하나뿐이고, 그때 문을 열어 두면 로그인 게이트가 통째로 증발한다.
     ⇒ 뿌리 주입(NO_PROJECTS_ROOT)과 실패 모드를 맞춘다. 둘이 갈리면 안 된다.
     ★그리고 거절 사유를 «로그인 안 됨»과 구분한다 — 이건 앱 버그지 사용자 잘못이 아니다. */
  H.mod.setAuthProbe(null);          // 배선을 «빠뜨린» 상황
  const txt = said(await H.call('list_projects', {}));
  assert.ok(/AUTH_PROBE_MISSING/.test(txt),
    '★못 재는데 통과시키면, 배선 하나 빠진 빌드에서 로그인 게이트가 «영영» 안 걸린다');
  assert.ok(!/NOT_LOGGED_IN/.test(txt),
    '★「로그인 안 됨」과 «다른 사유»여야 한다 — 사용자가 로그인해도 안 풀리는 문제다');
  assert.ok(/app bug|앱/i.test(txt), '★사용자가 무엇을 할지 알려야 한다(재시작·신고)');
  H.mod.setAuthProbe(() => ({ authed: true }));
});

test('A6 ★게이트 «순서» — 로그인 거절이 «프로젝트 게이트보다 먼저» 난다', async () => {
  /* ⛔변이시험이 이 구멍을 잡았다(2026-09-07): 게이트를 프로젝트 게이트 «뒤»로 옮겨도
     A1~A5 가 전부 초록이었다. 순서를 «아무도 안 지키고» 있었던 것이다.
     ★왜 순서가 중요한가: 로그인이 없는데 PROJECT_NOT_CONFIRMED 가 나면 «틀린 사유»를 댄다.
       그러면 클로드는 프로젝트를 열려고 하고, 그것도 막히고, 왜 막히는지 영영 모른다.
       (오늘 실측된 병과 같다 — 「도구가 말한 사유」와 「진짜 사유」는 다른 사실이다.) */
  /* ⛔A6 을 처음 썼을 때 «장식»이었다 — 변이(게이트를 뒤로 옮김)에 빨강이 «안» 났다.
     원인: 하네스가 활성 프로젝트를 proj_1 로 세팅해 둬서 «프로젝트 게이트가 안 물었다».
     두 거절이 «동시에» 성립해야 순서를 잴 수 있는데, 하나만 성립하니 순서가 무의미했다.
     ⇒ ★활성을 «비워» 두 게이트가 «둘 다» 물게 만든 뒤에 잰다. */
  H.mod.setAuthProbe(() => ({ authed: false }));
  H.setActiveProject(null);
  try {
    H.reset();
    const txt = said(await H.call('add_section', {}));
    assert.ok(/NOT_LOGGED_IN/.test(txt),
      `★로그인 거절이 «먼저» 안 났다 — 사유가 틀리면 클로드가 엉뚱한 걸 고치려 든다: ${txt.slice(0, 200)}`);
    assert.ok(!/NO_ACTIVE_PROJECT|PROJECT_NOT_CONFIRMED/.test(txt),
      `★프로젝트 사유가 «먼저» 나왔다 — 진짜 원인(로그인)이 가려진다: ${txt.slice(0, 200)}`);
  } finally { H.mod.setAuthProbe(() => ({ authed: true })); H.setActiveProject('proj_1'); }
});

test('A7 ★list_memories 가 «뿌리 밖»을 못 읽는다 (계정을 넘어 읽던 우회로)', async () => {
  /* 적대적 리뷰 발견: projectFolder 검증이 «0줄»이라 절대경로 하나로 남의 계정
     claude-pm/NOTES.md 를 전문 반환했다. ★뿌리를 계정별로 갈라 놓고 «뿌리를 아예 안 쓰는»
     우회로가 남아 있으면 격리는 없는 것과 같다.
     ⚠️같은 파일의 export_sections 는 outDir 을 검사한다 — 「이 파일이 원래 검증을 안 한다」가
       아니라 «여기만» 없었다. */
  const fs = require('fs'); const os = require('os'); const path = require('path');
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'gdt-other-acct-'));
  fs.writeFileSync(path.join(outside, 'NOTES.md'), '# 철수 대외비 메모\n남의 계정 내용이다');

  const txt = said(await H.call('list_memories', { projectFolder: outside }));
  assert.ok(/FOLDER_OUT_OF_ROOT/.test(txt), `★뿌리 밖을 읽었다 — 거절해야 한다. 응답: ${txt.slice(0, 200)}`);
  assert.ok(!/대외비/.test(txt), '★내용이 한 글자도 새면 안 된다');

  // ★양성대조 — 심은 파일이 «진짜 거기 있고 읽히는» 상태여야 이 검사가 의미가 있다
  assert.strictEqual(fs.readFileSync(path.join(outside, 'NOTES.md'), 'utf8').includes('대외비'), true,
    '★양성대조: 파일이 실제로 있어야 「못 읽었다」가 의미를 갖는다');

  // 반대방향 — 뿌리 «안»은 통과해야 한다(막기만 하면 도구가 죽는다)
  const inside = said(await H.call('list_memories', {}));
  assert.ok(!/FOLDER_OUT_OF_ROOT/.test(inside), '★인자를 안 주면 현재 뿌리를 쓰고 통과해야 한다');
  fs.rmSync(outside, { recursive: true, force: true });
});
