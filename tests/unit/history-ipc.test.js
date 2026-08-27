/* U2+U5 하네스 — main.js 의 «진짜» IPC 핸들러를 직접 부른다(_ipc-harness.js).
 * 실행: node --test "tests/unit/*.test.js"
 * ★핸들러를 흉내낸 테스트는 배선 오류를 못 잡는다. 여기선 ipcMain.handle 에 등록된 함수 그 자체를 부른다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { loadMain } = require('./_ipc-harness');

const H = loadMain();
const DIR = H.projectsDir;
const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const PNG = `data:image/png;base64,${PNG_B64}`;
const hash16 = (b64) => crypto.createHash('sha256').update(Buffer.from(b64, 'base64')).digest('hex').slice(0, 16);

let seq = 0;
const sec = (id, name, inner = '') =>
  `<div class="section-block" id="${id}" data-name="${name}"><div class="section-inner">${inner}</div></div>`;
const proj = (id, canvas) => ({ id, name: '테스트상세', version: 2, currentPageId: 'page_1',
  pages: [{ id: 'page_1', name: 'Page 1', canvas }], checklistItems: [] });

/** 실제 저장 경로(projects:save)를 태워 프로젝트를 만든다 — 스냅샷도 그 경로에서 생긴다. */
async function mkProject(canvas) {
  const id = `proj_${1787700000000 + (seq++) * 1000}`;
  const r = await H.invoke('projects:save', proj(id, canvas));
  assert.equal(r.ok, true);
  return id;
}
function snapDir(dir) {
  const out = {};
  (function walk(d, rel) {
    let e = [];
    try { e = fs.readdirSync(d, { withFileTypes: true }); } catch (_) { return; }
    for (const x of e) {
      const full = path.join(d, x.name), r = rel ? `${rel}/${x.name}` : x.name;
      if (x.isDirectory()) walk(full, r);
      else out[r] = `${fs.statSync(full).size}:${crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex')}`;
    }
  })(dir, '');
  return out;
}

/* ═══ 배선 ═══════════════════════════════════════════════════════════════ */

test('IPC0 4개 채널이 실제로 등록돼 있다', () => {
  for (const c of ['projects:history-list', 'projects:history-read',
                   'projects:history-diff-payload', 'projects:history-open-copy']) {
    assert.ok(H.has(c), `${c} 미등록`);
  }
});

test('IPC1 ★저장하면 스냅샷이 «자동으로» 생긴다 — 렌더러가 따로 요청하지 않는다', async () => {
  const id = await mkProject(sec('sec_a', '혜택정리', `<img src="${PNG}">`));
  const r = await H.invoke('projects:history-list', { projectId: id });
  assert.equal(r.ok, true);
  assert.equal(r.entries.length, 1);
  assert.equal(r.entries[0].counts.sections, 1);
  assert.deepEqual(r.entries[0].secs.map(s => s.n), ['혜택정리']);
  assert.equal(r.entries[0].canon, 1, '저장 경로를 탄 스냅샷은 정규형이어야 한다');
  assert.deepEqual(r.entries[0].assets, [`${hash16(PNG_B64)}.png`]);
});

test('IPC2 ★목록의 current 가 «지금»을 가리킨다 — 손실 비교의 기준점', async () => {
  const id = await mkProject(sec('sec_a', 'A') + sec('sec_b', 'B') + sec('sec_c', 'C'));
  // 섹션 2개를 지운 채 다시 저장(= 사고)
  await H.invoke('projects:save', proj(id, sec('sec_a', 'A')));
  const r = await H.invoke('projects:history-list', { projectId: id });
  assert.equal(r.current.counts.sections, 1, '지금은 1개');
  assert.equal(r.entries[0].counts.sections, 3, '스냅샷엔 3개가 살아 있다');
  const lostNames = r.entries[0].secs.filter(s => !r.current.secs.some(c => c.k === s.k)).map(s => s.n);
  assert.deepEqual(lostNames, ['B', 'C'], '★사고 직후 「어느 버전에 내 것이 있나」가 목록만으로 나와야 한다');
});

test('IPC3 diff-payload 가 «양쪽을 같은 좌표계»로 준다', async () => {
  const id = await mkProject(sec('sec_a', 'A', `<img src="${PNG}">`));
  const ts = (await H.invoke('projects:history-list', { projectId: id })).entries[0].ts;
  // 현재본은 base64 로 되돌린 상태(미외부화 프로젝트 = 실사용의 기본 케이스)
  await H.invoke('projects:save', proj(id, sec('sec_a', 'A', `<img src="${PNG}">`)));
  const r = await H.invoke('projects:history-diff-payload', { projectId: id, ts });
  assert.equal(r.ok, true);
  assert.ok(!JSON.stringify(r.snapCanvas).includes('data:image'));
  assert.ok(!JSON.stringify(r.curCanvas).includes('data:image'),
    '★현재본이 base64 인 채로 넘어가면 이미지 든 모든 섹션이 「변경」으로 뜬다');
  assert.equal(r.snapCanvas.page_1, r.curCanvas.page_1, '내용이 같으면 정규화 후 문자열도 같아야 한다');
});

test('IPC4 ★조회 3채널이 프로젝트 데이터를 안 바꾼다 (사이드카 제외)', async () => {
  const id = await mkProject(sec('sec_a', 'A', `<img src="${PNG}">`));
  const dir = path.join(DIR, id);
  await H.invoke('projects:history-list', { projectId: id });
  const before = snapDir(dir);
  const ts = (await H.invoke('projects:history-list', { projectId: id })).entries[0].ts;
  await H.invoke('projects:history-read', { projectId: id, ts });
  await H.invoke('projects:history-diff-payload', { projectId: id, ts });
  const after = snapDir(dir);
  const changed = Object.keys({ ...before, ...after })
    .filter(k => !['proj_history/index.json', 'proj_history/pins.json'].includes(k))
    .filter(k => before[k] !== after[k]);
  assert.deepEqual(changed, [], `★조회가 데이터를 바꿨다: ${changed.join(', ')}`);
});

test('IPC5 잘못된 인자에 «정직하게» 답한다 — 던지지 않고, 밖으로 새지 않는다', async () => {
  const BAD = [{}, { projectId: '' }, { projectId: 'p', ts: '../x' }, { projectId: '../../etc', ts: 1 },
               { projectId: 'p', ts: '1;rm' }, { projectId: 'p', ts: null }];
  for (const args of BAD) {
    // read / diff-payload 는 «못 준다»가 정답
    for (const ch of ['projects:history-read', 'projects:history-diff-payload']) {
      const r = await H.invoke(ch, args);
      assert.ok(r && r.ok === false, `${ch} ${JSON.stringify(args)} → ${JSON.stringify(r)}`);
    }
    // list 는 «없는 프로젝트 = 빈 목록»이 정답이다(ok:false 로 만들면 신규 프로젝트가 오류로 보인다).
    // 요구는 ①던지지 않을 것 ②남의 데이터를 보여주지 않을 것.
    const l = await H.invoke('projects:history-list', args);
    assert.equal(typeof l, 'object');
    if (l.ok) assert.deepEqual(l.entries, [], `★없는/부정 projectId 로 목록이 나왔다: ${JSON.stringify(args)}`);
  }
  // 경로 조각이 PROJECTS_DIR 밖에 디렉터리를 만들지 않았는지
  assert.ok(!fs.existsSync(path.join(DIR, '..', '..', 'etc')), '★base 밖에 흔적을 남겼다');
});

/* ═══ U5 사본으로 열기 ═══════════════════════════════════════════════════ */

test('U5-1 ★사본의 이미지가 «실제로» 보인다 — goya-asset 이 새 id 로 치환되고 에셋이 존재한다', async () => {
  const id = await mkProject(sec('sec_a', '혜택정리', `<img src="${PNG}">`) + sec('sec_b', 'FAQ'));
  const ts = (await H.invoke('projects:history-list', { projectId: id })).entries[0].ts;
  await H.invoke('projects:save', proj(id, sec('sec_a', '혜택정리'))); // 사고: FAQ 소실

  const r = await H.invoke('projects:history-open-copy', { projectId: id, ts });
  assert.equal(r.ok, true, JSON.stringify(r));
  const newId = r.newProjectId;
  const copy = JSON.parse(fs.readFileSync(path.join(DIR, newId, 'proj.json'), 'utf8'));

  assert.equal(copy.pages[0].canvas.includes(`goya-asset://${newId}/`), true,
    '★URL 이 원본 id 를 가리키면 사본이 원본 폴더를 몰래 참조한다(원본 삭제 시 404)');
  assert.ok(!copy.pages[0].canvas.includes(`goya-asset://${id}/`));
  const asset = `${hash16(PNG_B64)}.png`;
  assert.ok(fs.existsSync(path.join(DIR, newId, 'assets', asset)),
    '★에셋이 사본 폴더에 없으면 이미지가 안 보인다');
  assert.equal(copy.pages.length, 1);
  assert.ok(copy.pages[0].canvas.includes('FAQ'), '사라진 섹션이 사본에 살아 있어야 복구가 성립한다');
});

test('U5-2 ★원본을 지워도 사본이 안 깨진다 (market.js 결합 버그의 역검증)', async () => {
  const id = await mkProject(sec('sec_a', 'A', `<img src="${PNG}">`));
  const ts = (await H.invoke('projects:history-list', { projectId: id })).entries[0].ts;
  const r = await H.invoke('projects:history-open-copy', { projectId: id, ts });
  assert.equal(r.ok, true);
  await H.invoke('projects:delete', id);
  assert.ok(!fs.existsSync(path.join(DIR, id)), '원본이 지워져야 시험이 성립한다');

  const asset = `${hash16(PNG_B64)}.png`;
  assert.ok(fs.existsSync(path.join(DIR, r.newProjectId, 'assets', asset)),
    '★하드링크가 아니라 참조였다면 여기서 파일이 사라진다');
  const copy = JSON.parse(fs.readFileSync(path.join(DIR, r.newProjectId, 'proj.json'), 'utf8'));
  assert.ok(copy.pages[0].canvas.includes(`goya-asset://${r.newProjectId}/${asset}`));
});

test('U5-3 ★사본에 collabRef 가 딸려가지 않는다 — 두 프로젝트가 같은 협업방을 가리키면 데이터 사고', async () => {
  const id = await mkProject(sec('sec_a', 'A'));
  fs.writeFileSync(path.join(DIR, id, 'proj_meta.json'),
    JSON.stringify({ id, name: 'x', collabRef: { room: 'r1', token: 't' }, thumbnail: 'data:image/png;base64,AA' }));
  const ts = (await H.invoke('projects:history-list', { projectId: id })).entries[0].ts;
  const r = await H.invoke('projects:history-open-copy', { projectId: id, ts });
  assert.equal(r.ok, true);
  const meta = JSON.parse(fs.readFileSync(path.join(DIR, r.newProjectId, 'proj_meta.json'), 'utf8'));
  assert.equal(meta.collabRef, undefined, '★사본이 원본의 협업 세션에 붙었다');
  assert.ok(meta.thumbnail, '썸네일 같은 나머지 메타는 보존돼야 한다');
});

test('U5-4 ★사본을 만들어도 원본은 한 바이트도 안 바뀐다', async () => {
  const id = await mkProject(sec('sec_a', 'A', `<img src="${PNG}">`));
  const ts = (await H.invoke('projects:history-list', { projectId: id })).entries[0].ts;
  const dir = path.join(DIR, id);
  await H.invoke('projects:history-list', { projectId: id });
  const before = snapDir(dir);
  const r = await H.invoke('projects:history-open-copy', { projectId: id, ts });
  assert.equal(r.ok, true);
  const changed = Object.keys({ ...before, ...snapDir(dir) })
    .filter(k => !['proj_history/index.json', 'proj_history/pins.json'].includes(k))
    .filter(k => before[k] !== snapDir(dir)[k]);
  assert.deepEqual(changed, [], `★원본이 바뀌었다: ${changed.join(', ')}`);
});

test('U5-5 사본 이름에 «어느 시점»인지가 들어간다', async () => {
  const id = await mkProject(sec('sec_a', 'A'));
  const ts = (await H.invoke('projects:history-list', { projectId: id })).entries[0].ts;
  const r = await H.invoke('projects:history-open-copy', { projectId: id, ts });
  assert.match(r.newName, /테스트상세 \(v \d{2}-\d{2} \d{2}:\d{2}\)/, `이름=${r.newName}`);
  assert.equal(r.fromTs, ts);
});

test('U5-6 없는 버전을 열려 하면 정직하게 실패한다 — 빈 프로젝트를 만들지 않는다', async () => {
  const id = await mkProject(sec('sec_a', 'A'));
  const beforeDirs = fs.readdirSync(DIR).length;
  const r = await H.invoke('projects:history-open-copy', { projectId: id, ts: 1 });
  assert.equal(r.ok, false);
  assert.equal(fs.readdirSync(DIR).length, beforeDirs, '★실패했는데 프로젝트가 늘었다');
});

/* ═══ U7 기준선 — 현행 삭제가 «무엇을 파괴하는지» 사진 찍어 둔다 ══════════
 * ★U7 이 fs.rmSync → shell.trashItem 으로 바꿀 때, 무엇이 어떻게 달라졌는지가 이 테스트의 diff 로 보인다.
 *   U0 에서 쓴 것과 같은 패턴이다(기준선 없이 낸 초록은 가짜다).
 * ⚠️ 이 테스트들이 «초록»이라는 건 현행이 옳다는 뜻이 «아니다» — 현행이 이렇다는 기록일 뿐이다.
 *   설계 §8-0 이 이걸 설계 결함으로 규정했고 §12-C(U7)가 고친다.
 */

test('DEL0-a ★현행: 삭제가 «복구 수단까지 같은 봉투로» 지운다 (U7 이 고칠 대상)', async () => {
  const id = await mkProject(sec('sec_a', '혜택정리', `<img src="${PNG}">`));
  await H.invoke('projects:save', proj(id, sec('sec_a', '혜택정리') + sec('sec_b', 'FAQ')));
  const dir = path.join(DIR, id);
  // 삭제 «전»에 이 봉투 안에 무엇이 있는지 — 전부 복구 재료다
  const had = {
    proj:    fs.existsSync(path.join(dir, 'proj.json')),
    backup:  fs.existsSync(path.join(dir, 'proj_backup.json')),
    history: fs.existsSync(path.join(dir, 'proj_history')),
    slots:   fs.readdirSync(path.join(dir, 'proj_history')).filter(f => /^\d+\.json$/.test(f)).length,
    assets:  fs.readdirSync(path.join(dir, 'assets')).length,
  };
  assert.equal(had.proj && had.backup && had.history, true);
  assert.ok(had.slots >= 1 && had.assets >= 1, '기준선이 성립하려면 복구 재료가 있어야 한다');

  const r = await H.invoke('projects:delete', id);
  assert.equal(r, true, '현행 반환은 boolean 이다 — U7 이 { ok, trashed, reason } 으로 바꾼다');
  assert.equal(fs.existsSync(dir), false,
    '★현행은 봉투를 통째로 없앤다 — proj.json·백업·히스토리 스냅샷·에셋이 «동시에» 사라진다(설계 §8-0)');
});

test('DEL0-b ★현행: 구 flat 레이아웃의 «복구 재료»도 같이 영구 소멸한다', async () => {
  const id = await mkProject(sec('sec_a', 'A'));
  // 폴백 체인(§D3)이 읽는 구 flat 잔재를 만든다 — loadFallbackCandidates 가 실제로 후보로 삼는 것들
  fs.writeFileSync(path.join(DIR, `${id}.json`), '{}');
  fs.writeFileSync(path.join(DIR, `${id}_backup.json`), '{}');
  fs.mkdirSync(path.join(DIR, `${id}_history`), { recursive: true });
  fs.writeFileSync(path.join(DIR, `${id}_history`, '1787700000000.json'), '{}');

  await H.invoke('projects:delete', id);
  for (const p of [`${id}.json`, `${id}_backup.json`, `${id}_history`]) {
    assert.equal(fs.existsSync(path.join(DIR, p)), false,
      `★${p} 도 영구 소멸한다 — 이건 폴백 체인이 읽는 복구 재료다(U7 D-U7-2 가 휴지통으로 보낸다)`);
  }
});

test('DEL0-c ★현행: 삭제는 «동기»라 반쯤 지워진 상태가 없다 — U7 의 async 전환이 깨면 안 되는 성질', async () => {
  const id = await mkProject(sec('sec_a', 'A'));
  const dir = path.join(DIR, id);
  const r = H.invoke('projects:delete', id); // await 하기 «전»에 이미 끝나 있어야 한다
  assert.equal(fs.existsSync(dir), false,
    '★현행은 반환 시점에 이미 완료다. trashItem(Promise)로 바꾸면 그 사이 autosave 가 끼어들 수 있다(D-U7-4)');
  await r;
});

test('DEL0-d ★현행: 없는 프로젝트를 지워도 «성공»으로 답한다(구분 불가) — U7 이 정직하게 나눈다', async () => {
  const r = await H.invoke('projects:delete', 'proj_9999999999999');
  assert.equal(r, true,
    '★「지웠다」와 「지울 게 없었다」가 같은 값이다. U7 의 { ok, trashed, reason } 이 이걸 나눈다');
});
