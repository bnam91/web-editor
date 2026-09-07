/* 비상 사본·복구가 «계정»을 아는가 — ★진짜 모듈을 임시 userData 위에서 돌려서 잰다.
   적대적 리뷰(2026-09-07) 발견: PROJECTS_DIR 만 계정별로 갈렸고, 「저장 못 한 프로젝트 원문」이
   통째로 들어가는 emergency-saves / quit-save-failure.json / recovery-state.json 은 여전히 공용이라
   ★철수의 저장 실패본이 민수 복구 화면에 뜨고 버튼 한 번에 민수 계정 폴더로 복제됐다.
   ⇒ 이번 판이 막으려던 시나리오가 «손도 안 댄 문»으로 성립하고 있었다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');

const R = path.join(__dirname, '..', '..');
const sg = require(path.join(R, 'main/quit/save-guard.js'));
const rec = require(path.join(R, 'main/recovery/index.js'));

function setup() {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'recov-acct-'));
  const A = path.join(ud, 'accounts', 'acct_chulsoo');
  const B = path.join(ud, 'accounts', 'acct_minsoo');
  fs.mkdirSync(path.join(A, 'projects'), { recursive: true });
  fs.mkdirSync(path.join(B, 'projects'), { recursive: true });
  let ws = A;
  sg._reset && sg._reset();
  sg.init({ userDataDir: ud, workspaceDir: () => ws, appVersion: '0.9.2', log: () => {} });
  rec.init({ userDataDir: ud, workspaceDir: () => ws, saveGuard: sg, log: () => {} });
  return { ud, A, B, to: (w) => { ws = w; } };
}

test('R1 ★저장 실패본이 «계정 폴더 안»에 남는다 (공용 폴더가 아니라)', () => {
  const s = setup();
  sg.recordSyncSaveFailure({
    projectId: 'proj_1111', projectName: '★철수 대외비 상세페이지',
    snapshot: JSON.stringify({ sections: [{ id: 's1', html: '<h1>철수의 미공개 카피</h1>' }] }),
  });
  const mine = path.join(s.A, 'emergency-saves');
  assert.ok(fs.existsSync(mine), '★계정 폴더 안에 있어야 한다');
  assert.ok(fs.readdirSync(mine).some(f => f.startsWith('proj_1111')), '★사본이 «실제로» 있어야 한다(양성대조)');
  assert.ok(!fs.existsSync(path.join(s.ud, 'emergency-saves')),
    '★공용 폴더에 남으면 다음 계정이 보고 되살릴 수 있다');
  assert.ok(fs.existsSync(path.join(s.A, 'quit-save-failure.json')), '마커도 계정 폴더 안');
});

test('R2 ★★다음 계정에게 «안 보인다» — 그리고 「0건」이 못 잰 게 아님을 같이 보인다', () => {
  const s = setup();
  sg.recordSyncSaveFailure({
    projectId: 'proj_1111', projectName: '★철수 대외비 상세페이지',
    snapshot: JSON.stringify({ sections: [{ id: 's1', html: '<h1>철수의 미공개 카피</h1>' }] }),
  });
  // ★양성대조 — 철수 자신에겐 «보여야» 한다. 안 보이면 아래 0건은 「못 잰 것」이다
  const mineRaw = rec.localItems();
  const mine = (mineRaw && mineRaw.items) || mineRaw || [];
  assert.strictEqual(mine.length, 1, `★주인에게조차 안 보이면 이 검사가 무의미하다 (${JSON.stringify(mineRaw).slice(0,200)})`);
  assert.match(String(mine[0].projectName), /철수/);

  s.to(s.B);                                    // 민수가 로그인
  const otherRaw = rec.localItems();
  const other = (otherRaw && otherRaw.items) || otherRaw || [];
  assert.strictEqual(other.length, 0,
    `★민수에게 철수 작업물이 보인다 — 버튼 한 번이면 민수 폴더로 복제된다: ${JSON.stringify(other).slice(0, 300)}`);
});

test('R3 ★비로그인은 «오늘과 바이트 동일» (지금 되던 것이 안 되게 되지 않는다)', () => {
  /* 계정 작업공간 = 프로젝트 뿌리의 «부모». 비로그인이면 <userData>/projects 의 부모 = <userData>
     ⇒ 예전 자리와 «같다». 이 판이 비로그인 사용자의 복구를 깨지 않는다. */
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'recov-legacy-'));
  sg._reset && sg._reset();
  sg.init({ userDataDir: ud, workspaceDir: () => ud, appVersion: '0.9.2', log: () => {} });
  sg.recordSyncSaveFailure({ projectId: 'proj_2222', projectName: '비로그인 것', snapshot: '{}' });
  assert.ok(fs.existsSync(path.join(ud, 'emergency-saves')), '★비로그인은 예전 자리에 그대로');
});

test('R4 ★«작업물»과 «도구»의 선이 코드에 적혀 있다', () => {
  /* 지디 판단(2026-09-07): templates·presets·goditor-market·svg-presets 는 «공유가 맞다» —
     그건 사람이 아니라 «기계»에 붙는 도구다. emergency-saves·recovery 는 «작업물»이라 다르다.
     ★판단은 근거와 같이 남아야 다음 사람이 되짚는다. 그리고 그 선이 흐려지면 여기가 알린다. */
  for (const f of ['main/quit/save-guard.js', 'main/recovery/index.js']) {
    const src = fs.readFileSync(path.join(R, f), 'utf8');
    assert.match(src, /작업물이면 가르고, 도구·진단이면 공유한다/, `★${f} 에 그 선이 안 적혀 있다`);
    assert.match(src, /function _ws\(\)/, `★${f} 가 계정 작업공간을 안 쓴다`);
  }
  const main = fs.readFileSync(path.join(R, 'main.js'), 'utf8');
  assert.match(main, /function _accountWorkspaceDir\(\)/);
  const wired = (main.match(/workspaceDir: _accountWorkspaceDir/g) || []).length;
  assert.ok(wired >= 4, `★배선이 ${wired} 곳뿐이다 — init 자리를 빠뜨리면 그 경로만 조용히 공용으로 간다`);
});
