/* 재기동 왕복 하네스 — 「저장 → 앱 완전 재기동 → 재오픈」(지디 전 유닛 인수조건).
 * 실행: node --test "tests/unit/*.test.js"
 *
 * ★같은 프로세스에서 두 번 부르는 건 재기동이 아니다(main.js 는 모듈 싱글턴이라 메모리가 남는다).
 *   진짜 «다른 프로세스»를 띄워 같은 userData 를 다시 열게 한다 — 디스크만 넘어가는지 그때 드러난다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { mkTmpRoot } = require('./_tmproot');
const { execFileSync } = require('child_process');

const HARNESS = path.join(__dirname, '_ipc-harness.js');
const MARK = '<<<GOYA-JSON>>>';

/** 자식 «프로세스»에서 main.js 를 새로 적재해 스크립트를 돌린다. 반환값은 JSON 으로 받는다. */
function inChildProcess(userData, body) {
  const src = [
    'const { loadMain } = require(' + JSON.stringify(HARNESS) + ');',
    'const H = loadMain({ userData: ' + JSON.stringify(userData) + ' });',
    "const fs = require('fs'), path = require('path');",
    'const M = ' + JSON.stringify(MARK) + ';',
    '(async () => {',
    '  const out = await (async () => { ' + body + ' })();',
    '  process.stdout.write(M + JSON.stringify(out) + M);',
    '  process.exit(0);',
    '})().catch(e => { process.stdout.write(M + JSON.stringify({ __error: e.message }) + M); process.exit(1); });',
  ].join('\n');
  const raw = execFileSync(process.execPath, ['-e', src], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const parts = raw.split(MARK);
  assert.ok(parts.length >= 2, '자식 프로세스 출력 파싱 실패:\n' + raw.slice(0, 2000));
  const r = JSON.parse(parts[1]);
  assert.ok(!r.__error, '자식 프로세스 실패: ' + r.__error);
  return r;
}

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const sec = (id, name, inner) =>
  '<div class="section-block" id="' + id + '" data-name="' + name + '"><div class="section-inner">' + (inner || '') + '</div></div>';
const PROJ_SRC = (id) =>
  'const proj = (canvas) => ({ id: ' + JSON.stringify(id) + ", name: '재기동시험', version: 2, currentPageId: 'page_1', pages: [{ id: 'page_1', name: 'Page 1', canvas }], checklistItems: [] });";

test('RS1 ★저장 → 프로세스 종료 → 새 프로세스에서 재오픈 — 버전 기록이 살아 있다', () => {
  const ud = mkTmpRoot('goya-restart-');
  const id = 'proj_1787700000000';
  const canvasA = sec('sec_a', '혜택정리', '<img src="' + PNG + '">') + sec('sec_b', 'FAQ') + sec('sec_c', '배송안내');

  // ── 1차 실행: 저장(스냅샷 생성) ─────────────────────────────────────────
  const first = inChildProcess(ud, PROJ_SRC(id) + `
    await H.invoke('projects:save', proj(${JSON.stringify(canvasA)}));
    const l = await H.invoke('projects:history-list', { projectId: ${JSON.stringify(id)} });
    return { entries: l.entries.length, ts: l.entries[0].ts, sections: l.entries[0].counts.sections,
             assets: l.entries[0].assets, curSections: l.current.counts.sections };
  `);
  assert.equal(first.entries, 1);
  assert.equal(first.sections, 3);
  assert.equal(first.assets.length, 1);

  // ── 2차 실행(완전 재기동): 사고를 내고 → 목록에서 손실이 보이는가 ────────
  const second = inChildProcess(ud, PROJ_SRC(id) + `
    await H.invoke('projects:save', proj(${JSON.stringify(sec('sec_a', '혜택정리', '<img src="' + PNG + '">'))}));
    const l = await H.invoke('projects:history-list', { projectId: ${JSON.stringify(id)} });
    const e = l.entries.find(x => x.ts === ${first.ts});
    const lost = e.secs.filter(s => !l.current.secs.some(c => c.k === s.k)).map(s => s.n);
    const read = await H.invoke('projects:history-read', { projectId: ${JSON.stringify(id)}, ts: ${first.ts} });
    return { entries: l.entries.length, curSections: l.current.counts.sections, lost,
             readOk: read.ok, readHasFaq: JSON.stringify(read.data).includes('FAQ') };
  `);
  assert.equal(second.curSections, 1, '★재기동 후 current 가 디스크 실제 상태를 가리켜야 한다');
  assert.deepEqual(second.lost, ['FAQ', '배송안내'],
    '★재기동해도 「어느 버전에 내 것이 살아 있나」가 그대로 나와야 한다');
  assert.equal(second.readOk, true);
  assert.equal(second.readHasFaq, true, '스냅샷 내용이 재기동을 넘어 읽혀야 한다');

  // ── 3차 실행: 사본으로 복구 → 이미지까지 살아 있는가 ─────────────────────
  const third = inChildProcess(ud, `
    const r = await H.invoke('projects:history-open-copy', { projectId: ${JSON.stringify(id)}, ts: ${first.ts} });
    const dir = path.join(H.projectsDir, r.newProjectId);
    const copy = JSON.parse(fs.readFileSync(path.join(dir, 'proj.json'), 'utf8'));
    const assets = fs.existsSync(path.join(dir, 'assets')) ? fs.readdirSync(path.join(dir, 'assets')) : [];
    const urls = copy.pages[0].canvas.match(/goya-asset:\\/\\/[\\w.-]+\\/[\\w.-]+/g) || [];
    return { ok: r.ok, newId: r.newProjectId, hasFaq: copy.pages[0].canvas.includes('FAQ'),
             assets, urls, allAssetsExist: urls.every(u => assets.includes(u.split('/').pop())) };
  `);
  assert.equal(third.ok, true);
  assert.equal(third.hasFaq, true, '★복구본에 잃었던 섹션이 있어야 한다 — 이게 이 기능의 존재 이유다');
  assert.ok(third.urls.length > 0 && third.urls.every(u => u.includes(third.newId)),
    '★URL 이 새 프로젝트를 가리켜야 한다');
  assert.equal(third.allAssetsExist, true, '★재기동을 넘어서도 사본의 이미지가 실제로 존재해야 한다');

  // ── 4차 실행: 원본 프로젝트를 지워도 복구본이 멀쩡한가 ────────────────────
  const fourth = inChildProcess(ud, `
    await H.invoke('projects:delete', ${JSON.stringify(id)});
    const dir = path.join(H.projectsDir, ${JSON.stringify(third.newId)});
    const copy = JSON.parse(fs.readFileSync(path.join(dir, 'proj.json'), 'utf8'));
    const assets = fs.readdirSync(path.join(dir, 'assets'));
    return { originGone: !fs.existsSync(path.join(H.projectsDir, ${JSON.stringify(id)})),
             hasFaq: copy.pages[0].canvas.includes('FAQ'), assets };
  `);
  assert.equal(fourth.originGone, true);
  assert.equal(fourth.hasFaq, true);
  assert.equal(fourth.assets.length, 1, '★원본 삭제로 에셋이 사라지면 하드링크가 아니라 참조였던 것이다');

  fs.rmSync(ud, { recursive: true, force: true });
});

test('RS2 ★인덱스를 잃은 채 재기동해도 목록이 복원된다 (인덱스는 파생 데이터)', () => {
  const ud = mkTmpRoot('goya-restart2-');
  const id = 'proj_1787700001000';
  const r1 = inChildProcess(ud, PROJ_SRC(id) + `
    await H.invoke('projects:save', proj(${JSON.stringify(sec('sec_a', '혜택정리') + sec('sec_b', 'FAQ'))}));
    const l = await H.invoke('projects:history-list', { projectId: ${JSON.stringify(id)} });
    return { n: l.entries.length, names: l.entries[0].secs.map(s => s.n) };
  `);
  assert.equal(r1.n, 1);

  fs.unlinkSync(path.join(ud, 'projects', id, 'proj_history', 'index.json'));

  const r2 = inChildProcess(ud, `
    const l = await H.invoke('projects:history-list', { projectId: ${JSON.stringify(id)} });
    return { n: l.entries.length, names: l.entries[0].secs.map(s => s.n), current: !!l.current };
  `);
  assert.equal(r2.n, 1, '★인덱스 유실이 버전 유실이 되면 안 된다');
  assert.deepEqual(r2.names, r1.names);
  assert.equal(r2.current, true, 'current 도 다시 계산돼야 한다');
  fs.rmSync(ud, { recursive: true, force: true });
});

test('RS3 ★proj.json 이 손상돼도 재기동 후 스냅샷에서 복구되고 «이미지가 살아 있다»', () => {
  const ud = mkTmpRoot('goya-restart3-');
  const id = 'proj_1787700002000';
  inChildProcess(ud, PROJ_SRC(id) + `
    await H.invoke('projects:save', proj(${JSON.stringify(sec('sec_a', '혜택정리', '<img src="' + PNG + '">'))}));
    return {};
  `);
  // proj.json 과 롤링 백업을 «모두» 파괴 → 남은 복구 재료는 히스토리 슬롯뿐
  const dir = path.join(ud, 'projects', id);
  fs.writeFileSync(path.join(dir, 'proj.json'), '{ 손상');
  fs.writeFileSync(path.join(dir, 'proj_backup.json'), '{ 손상');

  const r = inChildProcess(ud, `
    const p = await H.invoke('projects:load', ${JSON.stringify(id)}, {});
    const dir = path.join(H.projectsDir, ${JSON.stringify(id)});
    const canvas = (p && p.pages && p.pages[0] && p.pages[0].canvas) || '';
    const urls = canvas.match(/goya-asset:\\/\\/[\\w.-]+\\/[\\w.-]+/g) || [];
    const assets = fs.existsSync(path.join(dir, 'assets')) ? fs.readdirSync(path.join(dir, 'assets')) : [];
    return { recovered: p && p._recovered, sections: (canvas.match(/section-block/g) || []).length,
             urls, assetsPresent: urls.every(u => assets.includes(u.split('/').pop())) };
  `);
  assert.equal(r.recovered, 'history', '★히스토리 슬롯에서 복구돼야 한다(GAP-004 체인)');
  assert.equal(r.sections, 1);
  assert.ok(r.urls.length > 0, '정규형 스냅샷이므로 goya-asset 참조가 있어야 한다');
  assert.equal(r.assetsPresent, true,
    '★복구는 됐는데 이미지가 없으면 «조용히 깨진» 복구다 — 그게 제일 나쁘다');
  fs.rmSync(ud, { recursive: true, force: true });
});
