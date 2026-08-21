'use strict';
/* 데이터손실 수정 사이클 실재현 리허설 — externalizer 모듈 + projects:load 폴백체인 로직.
   Electron 없이 «데이터손실 경로»만 재현한다(F1 체인·F2 되돌리기·F3 updatedAt/회전·F6 skipped·왕복). */
const fs = require('fs');
const path = require('path');
const os = require('os');
const X = require('/Users/a1/web-editor-taeyang/main/project-store/externalizer.js');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL', m); } };

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'goya-rehearse-'));
function mkproj(id, canvas, updatedAt) {
  const dir = path.join(ROOT, id); fs.mkdirSync(dir, { recursive: true });
  const proj = { id, name: id, version: 2, updatedAt: updatedAt || '2026-07-20T00:00:00.000Z',
    pages: [{ id: 'p1', name: 'P1', canvas }] };
  fs.writeFileSync(path.join(dir, 'proj.json'), JSON.stringify(proj, null, 2));
  return dir;
}
// 작은 1x1 png base64 (유효)
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCA',  _ = 0; // 실제 디코드 되는 유효 base64는 아래에서 생성
const goodB64 = Buffer.from('hello-image-bytes-'.repeat(4)).toString('base64');
const goodURI = `data:image/png;base64,${goodB64}`;
const badB64  = '!!!not-base64!!!'; // Buffer.from(...,'base64')는 빈/쓰레기 → skipped 유발용은 빈 버퍼로
const canvasWith = (uri, n = 2) => {
  let c = '<div class="section-block"><div class="section-inner">';
  for (let i = 0; i < n; i++) c += `<div class="asset-block" data-img-src="${uri}"></div>`;
  c += '</div></div><div class="section-block"><div class="section-inner"></div></div>'; // 섹션 2개
  return c;
};

/* ── F3: externalize가 updatedAt을 갱신하는가 ── */
console.log('\n[F3] externalize bumps updatedAt (LS-우선 되돌림 루프 차단)');
{
  const id = 'f3-updatedat';
  mkproj(id, canvasWith(goodURI, 2), '2026-07-20T00:00:00.000Z');
  const before = JSON.parse(fs.readFileSync(path.join(ROOT, id, 'proj.json'), 'utf8')).updatedAt;
  const r = X.externalizeProjectFile(ROOT, id, { now: () => Date.parse('2026-08-20T12:00:00.000Z') });
  ok(r.ok && !r.noop, 'externalize ok');
  const after = JSON.parse(fs.readFileSync(path.join(ROOT, id, 'proj.json'), 'utf8')).updatedAt;
  ok(after !== before, `updatedAt 갱신 ${before} → ${after}`);
  ok(Date.parse(after) === Date.parse('2026-08-20T12:00:00.000Z'), 'updatedAt = 변환시각(opts.now 반영)');
  ok(fs.existsSync(path.join(ROOT, id, 'proj_pre-externalize.json')), 'pre-externalize 원본 보존');
  const outStr = fs.readFileSync(path.join(ROOT, id, 'proj.json'), 'utf8');
  ok(outStr.indexOf('data:image') === -1, '변환본에 base64 잔존 0');
  ok(outStr.indexOf('goya-asset://') !== -1, 'goya-asset 참조로 치환됨');
}

/* ── F3: 회전본 상한 ── */
console.log('\n[F3] pre-externalize 회전본 상한(MAX+현재만 유지)');
{
  const id = 'f3-rotate';
  const dir = path.join(ROOT, id); fs.mkdirSync(dir, { recursive: true });
  // 이미 존재하는 오래된 회전본 여러 개 흉내
  for (const ts of [1000, 2000, 3000, 4000]) fs.writeFileSync(path.join(dir, `proj_pre-externalize.${ts}.json`), '{}');
  fs.writeFileSync(path.join(dir, 'proj_pre-externalize.json'), '{"old":true}'); // 직전 백업 존재 → 회전 발생
  fs.writeFileSync(path.join(dir, 'proj.json'), JSON.stringify({ id, name: id, version: 2, updatedAt: '2026-07-20T00:00:00.000Z', pages: [{ id: 'p1', canvas: canvasWith(goodURI, 1) }] }, null, 2));
  const r = X.externalizeProjectFile(ROOT, id, { now: () => Date.parse('2026-08-20T13:00:00.000Z') });
  ok(r.ok, 'externalize(백업 존재→회전) ok');
  const rots = fs.readdirSync(dir).filter(f => /^proj_pre-externalize\.\d+\.json$/.test(f));
  ok(rots.length <= 2, `회전본 ${rots.length}개 ≤ 2 (상한 적용)`);
  ok(fs.existsSync(path.join(dir, 'proj_pre-externalize.json')), '현재 백업본 존재');
}

/* ── F6: 유효 이미지 전량 변환 → skipped=0, remaining 게이트 통과 ── */
console.log('\n[F6] 전량 성공 → skipped=0');
{
  const id = 'f6-clean';
  mkproj(id, canvasWith(goodURI, 3));
  const r = X.externalizeProjectFile(ROOT, id);
  ok(r.ok && r.skipped === 0, `ok & skipped=0 (images=${r.images}, refs=${r.refs})`);
}

/* ── F6: 일부 저장 실패(빈 버퍼) → ok:true지만 skipped>0, 남은 base64는 실패분뿐 ── */
console.log('\n[F6] 일부 실패 → 부분완료(skipped>0), 원본 base64 보존');
{
  const id = 'f6-partial';
  // 빈 base64(디코드하면 length 0) → skipped. 유효 1 + 빈 1 혼합.
  const emptyURI = 'data:image/png;base64,A'; // 정규식엔 매치되나 Buffer.from('A','base64').length===0 → skipped
  const canvas = `<div class="section-block"><div class="section-inner">`
    + `<div class="asset-block" data-img-src="${goodURI}"></div>`
    + `<div class="asset-block" data-img-src="${emptyURI}"></div>`
    + `</div></div>`;
  mkproj(id, canvas);
  const r = X.externalizeProjectFile(ROOT, id);
  console.log('    result:', JSON.stringify({ ok: r.ok, images: r.images, skipped: r.skipped, refs: r.refs, reason: r.reason }));
  ok(r.ok === true, 'ok:true (부분 성공도 데이터 무손실이므로 진행)');
  ok(r.skipped >= 1, `skipped ${r.skipped} ≥ 1 (빈 이미지 실패분)`);
  const outStr = fs.readFileSync(path.join(ROOT, id, 'proj.json'), 'utf8');
  ok(outStr.indexOf(goodURI) === -1, '성공한 이미지는 치환됨');
}

/* ── F2 + 왕복: 되돌리기가 전용파일에 현재작업 보존 + 원본 복원 ── */
console.log('\n[F2] 되돌리기 = 전용 proj_pre-rollback.json 보존 + dryRun 진단');
{
  const id = 'f2-rollback';
  const origCanvas = canvasWith(goodURI, 2); // 섹션 2개
  mkproj(id, origCanvas, '2026-07-20T00:00:00.000Z');
  const origBytes = fs.statSync(path.join(ROOT, id, 'proj.json')).size;
  const rE = X.externalizeProjectFile(ROOT, id, { now: () => Date.parse('2026-07-20T01:00:00.000Z') });
  ok(rE.ok, '변환 ok');
  // 「한 달 후」 편집 흉내 — 변환본(goya-asset)에 섹션 하나 추가해 저장
  const cur = JSON.parse(fs.readFileSync(path.join(ROOT, id, 'proj.json'), 'utf8'));
  cur.pages[0].canvas += '<div class="section-block"><div class="section-inner">edit</div></div>'; // 섹션 3개
  cur.updatedAt = '2026-08-20T00:00:00.000Z';
  fs.writeFileSync(path.join(ROOT, id, 'proj.json'), JSON.stringify(cur, null, 2));
  // dryRun 진단
  const d = X.rollbackExternalize(ROOT, id, { dryRun: true });
  console.log('    dryRun diag:', JSON.stringify({ ok: d.ok, ageDays: d.ageDays, currentSections: d.currentSections, restoreSections: d.restoreSections }));
  ok(d.ok && d.dryRun, 'dryRun ok');
  ok(d.currentSections === 3 && d.restoreSections === 2, `진단 섹션 현재3→복원2 (실측 ${d.currentSections}→${d.restoreSections})`);
  ok(typeof d.ageDays === 'number' && d.ageDays >= 25, `ageDays≈${d.ageDays} (약 한달전 변환)`);
  ok(!fs.existsSync(path.join(ROOT, id, 'proj_pre-rollback.json')), 'dryRun은 파일 무변경');
  // 실제 되돌리기
  const r = X.rollbackExternalize(ROOT, id);
  ok(r.ok, '되돌리기 ok');
  ok(fs.existsSync(path.join(ROOT, id, 'proj_pre-rollback.json')), '★현재작업이 전용 proj_pre-rollback.json에 보존됨(F2)');
  const preRb = JSON.parse(fs.readFileSync(path.join(ROOT, id, 'proj_pre-rollback.json'), 'utf8'));
  ok((preRb.pages[0].canvas.match(/section-block/g) || []).length === 3, '보존본 = 되돌리기 직전(섹션3, 변환후 작업)');
  const restored = JSON.parse(fs.readFileSync(path.join(ROOT, id, 'proj.json'), 'utf8'));
  ok(restored.pages[0].canvas.indexOf('data:image') !== -1, '복원본 = 변환 전 원본(base64 복귀)');
  ok(!fs.existsSync(path.join(ROOT, id, 'proj_pre-externalize.json')), '백업 소비됨(재변환 유령방지)');
}

/* ── F1: 폴백 체인 — 손상 proj.json + 늙은 pre-externalize + 최신 history → history가 이겨야 ── */
console.log('\n[F1] 폴백체인 재현: 늙은 pre-externalize가 최신 history를 이기면 안 됨');
{
  // main.js projects:load 후보구성 로직을 «수정 후 순서»로 복제(backup → history 최신 → pre-externalize 맨끝)
  function buildCandidates(dir) {
    const candidates = [];
    const backup = path.join(dir, 'proj_backup.json');
    if (fs.existsSync(backup)) candidates.push({ path: backup, from: 'backup' });
    const histDir = path.join(dir, 'proj_history');
    if (fs.existsSync(histDir)) {
      const slots = fs.readdirSync(histDir).filter(f => f.endsWith('.json')).sort((a, b) => (parseInt(b) || 0) - (parseInt(a) || 0));
      for (const s of slots) candidates.push({ path: path.join(histDir, s), from: 'history' });
    }
    const preExt = path.join(dir, 'proj_pre-externalize.json');
    if (fs.existsSync(preExt)) candidates.push({ path: preExt, from: 'pre-externalize' });
    for (const c of candidates) { try { const p = JSON.parse(fs.readFileSync(c.path, 'utf8')); return { from: c.from, proj: p }; } catch (_) {} }
    return null;
  }
  const id = 'f1-chain';
  const dir = path.join(ROOT, id); fs.mkdirSync(dir, { recursive: true });
  // proj.json 손상(잘림)
  fs.writeFileSync(path.join(dir, 'proj.json'), '{"pages":[{"canvas":"<div class=sec'); // 잘린 JSON
  // 롤링 백업도 크래시로 잘림
  fs.writeFileSync(path.join(dir, 'proj_backup.json'), '{"trunc');
  // 늙은 pre-externalize (한 달 전, 유효)
  fs.writeFileSync(path.join(dir, 'proj_pre-externalize.json'), JSON.stringify({ id, updatedAt: '2026-07-20T00:00:00.000Z', marker: 'OLD-PRE-EXT' }));
  // 최신 history (어제, 유효)
  const histDir = path.join(dir, 'proj_history'); fs.mkdirSync(histDir);
  fs.writeFileSync(path.join(histDir, `${Date.parse('2026-08-19T00:00:00Z')}.json`), JSON.stringify({ id, updatedAt: '2026-08-19T00:00:00.000Z', marker: 'FRESH-HISTORY' }));
  const rec = buildCandidates(dir);
  console.log('    recovered from:', rec && rec.from, '· marker:', rec && rec.proj.marker);
  ok(rec && rec.from === 'history', '★최신 history에서 복구(늙은 pre-externalize 아님)');
  ok(rec && rec.proj.marker === 'FRESH-HISTORY', '복구본 = 최신 상태(한달전 원본 아님)');
}

/* ── F3-LS: 「LS 채운 자동경로」 — initLoad의 LS-우선 판정을 재현. updatedAt 갱신이 결정을 뒤집는가 ── */
console.log('\n[F3-LS] LS 채운 자동경로: 변환 후 fileTs>lsTs → 파일(goya) 우선 (base64 되돌림 루프 차단)');
{
  // save-load.js initLoad 실제 조건 복제: lsTs + 500 > fileTs 이면 LS(=base64 스냅샷) 우선.
  const decideLSWins = (lsTs, fileTs) => (lsTs > 0 && lsTs + 500 > fileTs);
  const lsTs = Date.parse('2026-08-20T11:59:00.000Z'); // 변환 직전 마지막 autosave가 남긴 LS(base64 포함)
  // 수정 전(회귀): externalize가 updatedAt 미갱신 → fileTs=마지막 autosave와 사실상 동일 → LS 우선(버그)
  const fileTsBefore = lsTs; // 갱신 안 하면 동일 시각
  ok(decideLSWins(lsTs, fileTsBefore) === true, '수정 전이라면 LS(base64) 우선 → 외부화 되돌림(버그 재현)');
  // 수정 후: externalize가 updatedAt=변환시각으로 갱신 → fileTs가 lsTs보다 확실히 새로움 → 파일 우선
  const fileTsAfter = Date.parse('2026-08-20T12:00:00.000Z'); // opts.now 반영된 변환시각
  ok(decideLSWins(lsTs, fileTsAfter) === false, '★수정 후 파일(goya) 우선 → base64 되돌림 루프 차단');
}

/* ── F4: 되돌리기 봉인 «전체 플로우» 모델 (라운드3 반영). ★핵심 결정 2개(대상만 제거·드레인 반환)의
 *   회귀방지 «실코드» 단위테스트는 tests/unit/save-reload-seal.test.mjs (js/io/save-reload-seal.js를 직접 import).
 *   여기서는 그 결정들이 되돌리기 핸들러 흐름에서 어떻게 쓰이는지(구멍1 중단·구멍2 타프로젝트 보존·③ dirty복원)를 모델링. ── */
console.log('\n[F4] 되돌리기 봉인 전체 플로우: 대상만 제거·드레인 반환값 사용·dirty 봉인직전값 복원');
{
  // save-load 봉인 모델(라운드3): 대기열은 «되돌리기 대상만» 삭제, dirty는 봉인 직전값 캡처, 반환=드레인완료여부.
  const makeState = (dirty0) => ({ suppress: false, timer: 1, pending: new Map([['A', 1], ['B', 1]]), dirty: dirty0, dirtyBeforeSeal: false, saving: true });
  function seal(st, targetId, savingResolves) {
    st.suppress = true; st.timer = null;
    st.dirtyBeforeSeal = st.dirty;                 // ③ 봉인 직전값 캡처
    if (targetId) st.pending.delete(targetId); else st.pending.clear(); // ★구멍2: 대상만
    st.dirty = false;
    if (savingResolves) st.saving = false;
    if (targetId) st.pending.delete(targetId); else st.pending.clear();
    return !st.saving;                             // ★구멍1: 드레인 완료여부 반환
  }
  const resume = (st) => { st.suppress = false; st.dirty = st.dirtyBeforeSeal; }; // ③ 봉인직전값 복원

  // 구멍2: 탭A 되돌리기 봉인 → A 큐만 제거, B(타 프로젝트) 저장 보존
  const st = makeState(true);
  const drained = seal(st, 'A', true);
  ok(!st.pending.has('A'), '봉인: 되돌리기 대상 A 큐 제거');
  ok(st.pending.has('B'), '★구멍2: 타 프로젝트 B 큐 보존(마지막 편집 미유실)');
  ok(drained === true && st.suppress === true, '봉인: 드레인 완료 true 반환·suppress 올림');

  // 구멍1: in-flight이 5s 내 안 끝나면 false → 호출측이 되돌리기 중단
  const stuck = makeState(true);
  ok(seal(stuck, 'A', false) === false, '★구멍1: 드레인 타임아웃 false → 되돌리기 중단(복원본 재덮기 차단)');

  // ③ dirty 봉인직전값 복원: 편집 있던 경우 복원 시 dirty=true, 무편집이었으면 false(오염 방지)
  const dirtyCase = makeState(true); seal(dirtyCase, 'A', false); resume(dirtyCase);
  ok(dirtyCase.dirty === true && dirtyCase.suppress === false, '실패복구(편집有): dirty=true 복원·suppress 해제');
  const cleanCase = makeState(false); seal(cleanCase, 'A', false); resume(cleanCase);
  ok(cleanCase.dirty === false, '③ 실패복구(편집無): dirty=false 유지 → updatedAt 오염·협업 발화 방지');
}

console.log(`\n=== 리허설 결과: ${pass} PASS · ${fail} FAIL ===`);
fs.rmSync(ROOT, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
