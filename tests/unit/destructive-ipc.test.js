/* 3차 적대검수(파괴 경로) — «진짜 IPC» end-to-end 회귀.
 * 실행: node tests/unit/destructive-ipc.test.js
 * ★여기 있는 건 전부 「사용자 데이터를 잃는다」 경로다. 흉내내지 않고 main.js 핸들러를 직접 부른다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadMain } = require('./_ipc-harness');

const H = loadMain();
const DIR = H.projectsDir;
let seq = 0;
const sec = (id, name) => `<div class="section-block" id="${id}" data-name="${name}"></div>`;
const proj = (id, canvas) => ({ id, name: '삭제테스트', version: 2, currentPageId: 'page_1',
  pages: [{ id: 'page_1', name: 'Page 1', canvas }], checklistItems: [] });
async function mkProject(canvas) {
  const id = `proj_${1787800000000 + (seq++) * 1000}`;
  const r = await H.invoke('projects:save', proj(id, canvas));
  assert.equal(r.ok, true);
  return id;
}
const histDir = (id) => path.join(DIR, id, 'proj_history');

/* ═══ A① (치명) — «진짜» 되돌리기 6회. 검수자 재현 그대로 ═════════════ */

test('A1e ★36MB 프로젝트 교체 6회 — 6회차 안전판이 «같은 트랜잭션의 프룬» 뒤에도 살아있다', async () => {
  /* ★유닛(destructive.test.js A1a)은 인덱스 bytes 를 찍어 예산 초과를 «만들었다».
   *   여기선 진짜로 예산(200MB)을 넘기는 실물을 쓴다 — 안전판 6개 × 약 36MB.
   *   그래야 「bytes 를 찍는 방식이 실제 경로와 다르다」는 반론이 안 남는다. 실측 3초 안쪽이다. */
  const big = '<p>' + '가나다라마바사'.repeat(1_700_000) + '</p>';   // ≈ 35.7MB
  const id = `proj_${1787900000000 + (seq++) * 1000}`;
  const mk = (n) => ({ id, name: '큰텍스트', version: 2, currentPageId: 'page_1',
    pages: [{ id: 'page_1', name: 'Page 1',
              canvas: `<div class="section-block" id="sec_${n}" data-name="작업${n}">${big}</div>` }] });
  assert.equal((await H.invoke('projects:save', mk(0))).ok, true);
  const first = (await H.invoke('projects:history-list', { projectId: id })).entries[0].ts;

  let last = null;
  for (let i = 1; i <= 6; i++) {
    // 매번 내용을 바꿔 두고(=잃을 작업이 생긴다) 그 상태에서 옛 버전으로 교체한다.
    assert.equal((await H.invoke('projects:save', mk(i))).ok, true);
    const r = await H.invoke('projects:history-restore', { projectId: id, ts: first, openProjectIds: [] });
    assert.equal(r.ok, true, `${i}회차 교체 실패: ${JSON.stringify(r)}`);
    assert.ok(r.preRestoreTs, `${i}회차 안전판 ts 가 없다`);
    last = r.preRestoreTs;
  }

  // ★UI 는 방금 「↩ 교체됨 — 직전 상태는 버전 목록 맨 위에 있어요」를 띄운 참이다.
  const list = await H.invoke('projects:history-list', { projectId: id });
  const live = new Set(list.entries.map(e => e.ts));
  assert.ok(live.has(last),
    `★6회차 안전판(${last})이 «같은 트랜잭션의 프룬»에 지워졌다 — 확인창이 「잘못 골랐으면 그걸로 `
    + `다시 되돌릴 수 있습니다」라고 약속한 직후다. 현재 상태는 «되돌아간 옛 버전»이므로 `
    + `교체 직전의 작업은 여기 말고 어디에도 없다`);
  assert.ok(fs.existsSync(path.join(histDir(id), `${last}.json`)), '★인덱스엔 있는데 파일이 없다');

  // ★그리고 «실제로 되돌아가진다» — 목록에 보이는 것과 쓸 수 있는 것은 다른 약속이다.
  const back = await H.invoke('projects:history-restore', { projectId: id, ts: last, openProjectIds: [] });
  assert.equal(back.ok, true, `★목록엔 있는데 되돌릴 수 없다: ${JSON.stringify(back && back.reason)}`);
  const now = JSON.parse(fs.readFileSync(path.join(DIR, id, 'proj.json'), 'utf8'));
  assert.match(now.pages[0].canvas, /id="sec_6"/, '★취소했는데 교체 직전 작업이 아니다');
});

