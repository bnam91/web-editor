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

/* ═══ U7 — 삭제 안전망(휴지통). 기준선 DEL0 을 «의도적으로» 대체한다 ══════
 * DEL0 이 사진 찍어둔 현행(봉투째 영구소멸 · flat 복구재료 소멸 · 동기 · 성공/무대상 구분불가)을
 * U7 이 전부 바꿨다. 무엇이 어떻게 달라졌는지가 이 diff 로 보인다.
 * ★규약(설계 §8-0): «되돌릴 수단»을 대상과 «같은 봉투»에 두지 마라 — 휴지통이 그 봉투 밖 안전망이다.
 */

test('U7-1 ★삭제하면 «휴지통에» 실제로 있다 — 「에러 안 났다」는 증거가 아니다', async () => {
  const id = await mkProject(sec('sec_a', '혜택정리', `<img src="${PNG}">`));
  await H.invoke('projects:save', proj(id, sec('sec_a', '혜택정리') + sec('sec_b', 'FAQ')));
  const dir = path.join(DIR, id);
  assert.ok(fs.existsSync(path.join(dir, 'proj_history')));

  const r = await H.invoke('projects:delete', id);
  assert.equal(r.ok, true);
  assert.equal(r.trashed, true, '★영구삭제가 아니라 휴지통이어야 한다');
  assert.equal(fs.existsSync(dir), false, '원래 자리에선 사라져야 한다');

  const entry = fs.readdirSync(H.trashDir).find(f => f.startsWith(id));
  assert.ok(entry, '★휴지통에 «실제로» 있어야 복구 가능이다');
});

test('U7-2 ★휴지통에서 되살리면 스냅샷·에셋이 «같이» 살아 돌아온다 — 왕복 전체', async () => {
  const id = await mkProject(sec('sec_a', '혜택정리', `<img src="${PNG}">`));
  await H.invoke('projects:save', proj(id, sec('sec_a', '혜택정리') + sec('sec_b', 'FAQ')));
  const before = {
    slots: fs.readdirSync(path.join(DIR, id, 'proj_history')).filter(f => /^\d+\.json$/.test(f)).length,
    assets: fs.readdirSync(path.join(DIR, id, 'assets')),
  };
  assert.ok(before.slots >= 1 && before.assets.length >= 1);

  await H.invoke('projects:delete', id);
  const entry = fs.readdirSync(H.trashDir).find(f => f.startsWith(id));
  H.restoreFromTrash(entry, id);

  // ★되살린 뒤 «목록에 다시 뜨고 열리는가» — 여기까지 돼야 「복구 가능」이다
  const list = await H.invoke('projects:list');
  assert.ok(list.some(p => p.id === id), '★되살렸는데 목록에 안 뜨면 사용자는 못 찾는다');
  const loaded = await H.invoke('projects:load', id, {});
  assert.ok(loaded && loaded.pages, '열려야 한다');

  assert.equal(fs.readdirSync(path.join(DIR, id, 'proj_history')).filter(f => /^\d+\.json$/.test(f)).length,
    before.slots, '★스냅샷이 같이 돌아와야 한다');
  assert.deepEqual(fs.readdirSync(path.join(DIR, id, 'assets')), before.assets, '★에셋도 같이');
  // ★그림이 실제로 있나 — 「폴더는 돌아왔는데 그림이 빈다」가 제일 나쁜 결과다
  const urls = loaded.pages[0].canvas.match(/goya-asset:\/\/[\w.-]+\/([\w.-]+)/g) || [];
  for (const u of urls) {
    assert.ok(fs.existsSync(path.join(DIR, id, 'assets', u.split('/').pop())), `★${u} 가 없다`);
  }
  // 되살린 버전 기록도 읽힌다
  const l = await H.invoke('projects:history-list', { projectId: id });
  assert.equal(l.ok, true);
  assert.ok(l.entries.length >= 1, '★버전 기록이 같이 돌아와야 한다 — 그게 §8-0 의 요점이다');
});

test('U7-3 ★구 flat 레이아웃의 «복구 재료»도 휴지통으로 간다 — 영구 소멸 0', async () => {
  const id = await mkProject(sec('sec_a', 'A'));
  fs.writeFileSync(path.join(DIR, `${id}.json`), '{}');
  fs.writeFileSync(path.join(DIR, `${id}_backup.json`), '{}');
  fs.mkdirSync(path.join(DIR, `${id}_history`), { recursive: true });
  fs.writeFileSync(path.join(DIR, `${id}_history`, '1787700000000.json'), '{}');

  const r = await H.invoke('projects:delete', id);
  assert.equal(r.ok, true);
  const trash = fs.readdirSync(H.trashDir);
  for (const n of [`${id}.json`, `${id}_backup.json`, `${id}_history`]) {
    assert.equal(fs.existsSync(path.join(DIR, n)), false, `${n} 이 제자리에 남았다`);
    assert.ok(trash.some(f => f.startsWith(n)),
      `★${n} 이 «영구 소멸»했다 — 폴백 체인이 읽는 복구 재료다`);
  }
});

test('U7-4 ★음성대조 — 휴지통 이동을 강제 실패시키면 삭제가 «일어나지 않는다»', async () => {
  const id = await mkProject(sec('sec_a', 'A'));
  const dir = path.join(DIR, id);
  H.failTrash('EACCES: 휴지통 접근 거부');
  let r;
  try { r = await H.invoke('projects:delete', id); }
  finally { H.failTrash(null); }

  assert.equal(r.ok, false, '★실패했는데 성공으로 답했다');
  assert.equal(r.reason, 'trash_failed');
  assert.ok(r.message.includes('EACCES'), '왜 실패했는지 말해야 2차 확인 문구를 쓸 수 있다');
  assert.equal(fs.existsSync(dir), true, '★반쯤 지워진 상태가 최악이다 — 아무것도 안 지워져야 한다');
  assert.ok(fs.existsSync(path.join(dir, 'proj.json')));
  // ⛔조용히 영구삭제로 폴백하지 않았다
  const list = await H.invoke('projects:list');
  assert.ok(list.some(p => p.id === id), '프로젝트가 살아 있어야 한다');
});

test('U7-5 «영구 삭제»는 사용자가 2차 확인으로 «선택»했을 때만 — 기본값이 아니다', async () => {
  const id = await mkProject(sec('sec_a', 'A'));
  H.failTrash('EACCES');
  try {
    const r1 = await H.invoke('projects:delete', id);
    assert.equal(r1.ok, false);
    // 사용자가 「그래도 영구 삭제」를 골랐다
    const r2 = await H.invoke('projects:delete', id, { permanent: true });
    assert.equal(r2.ok, true);
    assert.equal(r2.trashed, false, '★영구삭제였다는 걸 반환값이 말해야 한다');
    assert.equal(fs.existsSync(path.join(DIR, id)), false);
  } finally { H.failTrash(null); }
});

test('U7-6 ★휴지통에서 «찾을 수 있게» 마커를 남긴다 — proj_178… 이 수십 개면 못 고른다', async () => {
  const id = await mkProject(sec('sec_a', '혜택정리') + sec('sec_b', 'FAQ'));
  await H.invoke('projects:save-meta', id, { name: '세이프본 무릎보호대' });
  await H.invoke('projects:delete', id);
  const entry = fs.readdirSync(H.trashDir).find(f => f.startsWith(id));
  const info = JSON.parse(fs.readFileSync(path.join(H.trashDir, entry, '_deleted-info.json'), 'utf8'));
  assert.equal(info.id, id);
  assert.equal(info.name, '세이프본 무릎보호대', '★이름이 있어야 자기 걸 고른다');
  assert.ok(info.deletedAt);
  assert.equal(info.sections, 2);
});

test('U7-7 ★디렉터리 «이름»은 안 바꾼다 — trash 실패 시 살아있는 프로젝트가 깨진 이름으로 남는다', async () => {
  const id = await mkProject(sec('sec_a', 'A'));
  H.failTrash('EACCES');
  try { await H.invoke('projects:delete', id); } finally { H.failTrash(null); }
  assert.ok(fs.existsSync(path.join(DIR, id)), '★id 가 곧 디렉터리명이다 — 바꿨다가 실패하면 프로젝트가 깨진다');
  const loaded = await H.invoke('projects:load', id, {});
  assert.ok(loaded && loaded.pages, '실패 뒤에도 정상적으로 열려야 한다');
});

test('U7-8 «지웠다»와 «지울 게 없었다»를 구분한다 — 구 boolean 은 둘 다 true 였다', async () => {
  const r = await H.invoke('projects:delete', 'proj_9999999999999');
  assert.equal(r.ok, true);
  assert.equal(r.trashed, false);
  assert.equal(r.reason, 'not_found', '★구분이 안 되면 UI 가 「지웠습니다」라고 거짓말한다');
});

test('U7-9 잘못된 id 는 거부한다 — 경로 조작 차단', async () => {
  for (const bad of ['', '..', '../etc', 'a/b', 'a\\b', '.']) {
    const r = await H.invoke('projects:delete', bad);
    assert.equal(r.ok, false, `거부되지 않았다: ${JSON.stringify(bad)}`);
    assert.equal(r.reason, 'invalid_id');
  }
});

test('U7-10 ★렌더러가 반환값을 «본다» — 안 보면 실패해도 화면엔 성공으로 보인다', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../pages/projects.html'), 'utf8');
  assert.match(src, /return await window\.electronAPI\.deleteProject\(id\)/,
    '★removeProject 가 결과를 «돌려줘야» 호출측이 볼 수 있다');
  assert.match(src, /r\.ok === false/, '★실패를 «검사»해야 한다');
  assert.match(src, /permanent: true/, '2차 확인으로 영구삭제를 선택하는 경로');
  assert.match(src, /휴지통으로 보낼까요/, '★기대되는 되돌림 가능성이 달라졌으니 문구도 바뀌어야 한다');
  assert.ok(!/프로젝트를 삭제할까요/.test(src), '옛 「삭제할까요」 문구가 남아 있다');
});

/* ═══ U7 적대검수 회귀 — 「변이시켜도 빨강이 안 되던」 동작들 ══════════════
 * 검수자가 변이 스윕으로 증명했다: 아래 동작들은 «없애도» 테스트가 전부 초록이었다.
 * (부분이동 정직보고 · 삭제 순서 · inBase 봉쇄 · deleted 카운트 · _meta 팔 · 렌더러 재렌더)
 * 각 항목마다 «그 동작을 없애면 빨강이 되는» 테스트를 붙인다. */

/** 특정 호출 순번만 실패시킨다 — 하네스의 failTrash 는 전부-아니면-전무라 부분실패를 표현 못 한다. */
function failTrashOnCall(nth, err) {
  const el = require.cache['electron'].exports;
  const orig = el.shell.trashItem;
  let n = 0;
  el.shell.trashItem = async (p) => { n++; if (n === nth) { const e = new Error(err || 'EPERM'); throw e; } return orig(p); };
  return { restore: () => { el.shell.trashItem = orig; }, calls: () => n };
}

test('U7-11 ★부분 이동을 «전부 실패»로 말하지 않는다 — 번들이 이미 휴지통인데 trashed:false 는 거짓말이다', async () => {
  const id = await mkProject(sec('sec_a', 'A'));
  fs.writeFileSync(path.join(DIR, `${id}.json`), '{}');
  fs.writeFileSync(path.join(DIR, `${id}_meta.json`), '{}');
  const f = failTrashOnCall(2, 'EPERM: 권한 없음');
  let r;
  try { r = await H.invoke('projects:delete', id); } finally { f.restore(); }

  assert.equal(r.ok, false);
  assert.equal(r.reason, 'trash_partial', '★부분 이동은 «부분»이라고 말해야 한다');
  assert.equal(r.trashed, true, '★일부는 «실제로» 휴지통에 갔다 — false 면 사용자가 판단을 그르친다');
  assert.ok(r.deleted >= 1, `deleted 가 실제 이동 수여야 한다 (=${r.deleted})`);
  const mine = fs.readdirSync(H.trashDir).filter(f => f.startsWith(id));
  assert.equal(mine.length, r.deleted, `★deleted 가 휴지통 실물과 맞아야 한다 (${JSON.stringify(mine)})`);
});

test('U7-12 ★삭제 «순서» — 잔재 먼저, 번들 나중. 반대면 「좀비 부활」이 난다', async () => {
  const id = await mkProject(sec('sec_a', '지금것'));
  // 폴백 체인이 읽는 구 flat 히스토리(옛 내용) — 번들이 먼저 사라지면 이게 좀비를 만든다
  fs.mkdirSync(path.join(DIR, `${id}_history`), { recursive: true });
  fs.writeFileSync(path.join(DIR, `${id}_history`, '1700000000000.json'),
    JSON.stringify(proj(id, sec('sec_old', '1년 전 옛것'))));

  // ★몇 번째가 번들인지 픽스처에 의존하지 않는다 — «번들 경로»를 직접 지목해 실패시킨다
  const el = require.cache['electron'].exports;
  const origT = el.shell.trashItem;
  const bundle = path.join(DIR, id);
  el.shell.trashItem = async (p) => { if (String(p) === bundle) throw new Error('EPERM'); return origT(p); };
  const f = { restore: () => { el.shell.trashItem = origT; } };
  let r;
  try { r = await H.invoke('projects:delete', id); } finally { f.restore(); }
  assert.equal(r.ok, false);
  // ★번들이 «남아 있어야» 한다 — 순서가 반대면 번들이 먼저 가서 좀비가 부활한다
  assert.ok(fs.existsSync(path.join(DIR, id, 'proj.json')),
    '★번들을 먼저 치우면 「본체는 휴지통인데 옛 잔재로 좀비가 살아나는」 상태가 된다');
  const loaded = await H.invoke('projects:load', id, {});
  assert.ok(loaded && !loaded._recovered, '폴백으로 «옛 내용»이 살아나지 않아야 한다');
  assert.ok(loaded.pages[0].canvas.includes('지금것'), '현재 내용이어야 한다');
  assert.ok(!loaded.pages[0].canvas.includes('1년 전 옛것'), '★옛 잔재로 되살아나면 안 된다');
});

test('U7-13 ★실패하면 살아남은 프로젝트에 «마커를 남기지 않는다» — 거짓 deletedAt 이 박힌다', async () => {
  const id = await mkProject(sec('sec_a', 'A'));
  H.failTrash('EACCES');
  try { await H.invoke('projects:delete', id); } finally { H.failTrash(null); }
  assert.ok(fs.existsSync(path.join(DIR, id, 'proj.json')), '프로젝트는 살아 있다');
  assert.equal(fs.existsSync(path.join(DIR, id, '_deleted-info.json')), false,
    '★살아있는 프로젝트에 「삭제됨」 마커가 영구히 남는다');
});

test('U7-14 permanent 모드엔 마커를 안 쓴다 — 휴지통에서 찾을 일이 없다', async () => {
  const id = await mkProject(sec('sec_a', 'A'));
  const dir = path.join(DIR, id);
  await H.invoke('projects:delete', id, { permanent: true });
  assert.equal(fs.existsSync(dir), false);
  // (지워졌으므로 마커 확인은 불가 — 대신 소스로 조건을 고정한다)
  const src = fs.readFileSync(path.join(__dirname, '../../main.js'), 'utf8');
  assert.match(src, /if \(!permanent && fs\.existsSync\(dirPath\)\)/, '★permanent 면 마커를 안 써야 한다');
});

test('U7-15 ★마커 쓰기가 PROJECTS_DIR «밖»으로 새지 않는다 (symlink 봉쇄)', async () => {
  const outside = fs.mkdtempSync(path.join(require('os').tmpdir(), 'goya-outside-'));
  fs.writeFileSync(path.join(outside, 'proj.json'), '{}');
  const linkId = 'proj_1799999999999';
  try { fs.symlinkSync(outside, path.join(DIR, linkId)); }
  catch (_) { return; }   // symlink 불가 환경이면 건너뛴다
  H.failTrash('EACCES');
  try { await H.invoke('projects:delete', linkId); } finally { H.failTrash(null); }
  assert.equal(fs.existsSync(path.join(outside, '_deleted-info.json')), false,
    '★realpath 봉쇄가 없으면 PROJECTS_DIR 밖에 파일을 쓴다');
  try { fs.unlinkSync(path.join(DIR, linkId)); } catch (_) {}
  fs.rmSync(outside, { recursive: true, force: true });
});

test('U7-16 ★이미 없는 것은 «성공»으로 센다 — 연타에 「영구 삭제할까요」라는 거짓 경고를 띄우지 않는다', async () => {
  const id = await mkProject(sec('sec_a', 'A'));
  const el = require.cache['electron'].exports;
  const orig = el.shell.trashItem;
  el.shell.trashItem = async (p) => { const e = new Error('ENOENT: no such file'); e.code = 'ENOENT'; throw e; };
  let r;
  try { r = await H.invoke('projects:delete', id); } finally { el.shell.trashItem = orig; }
  assert.equal(r.ok, true, '★ENOENT 를 실패로 보면 이미 안전한 프로젝트에 영구삭제를 권한다');
  assert.equal(r.trashed, true);
});

test('U7-17 ★삭제 도중 프로젝트가 «다시 만들어지면» 성공이라고 말하지 않는다', async () => {
  const id = await mkProject(sec('sec_a', 'A'));
  const el = require.cache['electron'].exports;
  const orig = el.shell.trashItem;
  el.shell.trashItem = async (p) => {
    await orig(p);
    // await 창에서 autosave 가 끼어들어 프로젝트를 되살린 상황
    if (String(p).endsWith(id)) { fs.mkdirSync(path.join(DIR, id), { recursive: true });
      fs.writeFileSync(path.join(DIR, id, 'proj.json'), JSON.stringify(proj(id, sec('sec_z', '되살아남')))); }
  };
  let r;
  try { r = await H.invoke('projects:delete', id); } finally { el.shell.trashItem = orig; }
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'recreated_during_delete',
    '★「휴지통에 보냈다」고 답하는데 제자리에 프로젝트가 있으면 그건 사실이 아니다');
});

test('U7-18 «_meta.json» 잔재도 실제로 치운다 — 이 팔은 여태 픽스처가 만들지 않아 죽어 있었다', async () => {
  const id = await mkProject(sec('sec_a', 'A'));
  fs.writeFileSync(path.join(DIR, `${id}_meta.json`), '{"legacy":1}');
  const r = await H.invoke('projects:delete', id);
  assert.equal(r.ok, true);
  assert.equal(fs.existsSync(path.join(DIR, `${id}_meta.json`)), false, '★_meta 잔재가 제자리에 남았다');
  assert.ok(fs.readdirSync(H.trashDir).some(f => f.startsWith(`${id}_meta.json`)));
});

test('U7-19 ★렌더러가 «어느 경로로 빠져나가도» 화면을 다시 그린다 — 안 그리면 좀비 카드가 남는다', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../pages/projects.html'), 'utf8');
  const fn = src.slice(src.indexOf('async function deleteProject('), src.indexOf('/* ── 원격으로 올리기'));
  assert.match(fn, /\}\s*finally\s*\{[\s\S]*renderGrid\(\)/,
    '★취소·실패 return 이 renderGrid() 를 건너뛰면 이미 휴지통에 간 프로젝트의 카드가 남는다');
  assert.match(fn, /trash_partial/, '부분 이동을 «부분»이라고 말해야 한다');
  assert.match(fn, /_deleting/, '연타 방어');
});
