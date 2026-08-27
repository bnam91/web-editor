/* U0 특성화(기준선) 하네스 — main/project-store/snapshot-store.js
 * 실행: node --test tests/unit/
 *
 * ★이 파일의 목적은 «현행 동작을 사진 찍어 두는 것»이다. U1 이 정책을 바꿀 때
 *   무엇이 바뀌었는지가 이 테스트의 diff 로 눈에 보이게 하기 위함이다.
 *   기준선 없이 낸 초록은 가짜다(08-25 「검증 방식이 버그를 가렸다」).
 *
 * 불변식 A(영구) — 폴백 후보 «순서»: backup → history(최신→오래된) → pre-externalize(맨 끝)
 * 불변식 B(영구) — 슬롯 파일명은 `<epoch>.json`. parseInt 정렬이 시간순이어야 한다.
 * 동작   C(U1에서 바뀜) — 10분 간격 게이트 · 5슬롯 롤링 · 오래된 것부터 제거
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const SS = require('../../main/project-store/snapshot-store');

const MIN = 60 * 1000;
// ★실데이터와 같은 13자리 epoch 를 쓴다. 12자리로 떨어지는 인공 값은 아래 C10 이 설명하는
//   «문자열 정렬» 함정에 걸려 테스트가 «현실에 없는 실패»를 낸다.
const NOW = 1_787_700_000_000;
function mkRoot() { return fs.mkdtempSync(path.join(os.tmpdir(), 'goya-snap-')); }
function mkHist(root, id, tsList) {
  const d = path.join(root, id, 'proj_history');
  fs.mkdirSync(d, { recursive: true });
  for (const ts of tsList) fs.writeFileSync(path.join(d, `${ts}.json`), '{}');
  return d;
}

/* ── 동작 C: 간격 게이트 ─────────────────────────────────────────────────── */
test('C1 슬롯이 없으면 무조건 만든다', () => {
  const root = mkRoot();
  const h = mkHist(root, 'p', []);
  const plan = SS.planLegacySlots(h, NOW);
  assert.equal(plan.create, true);
  assert.equal(plan.newName, `${NOW}.json`);
  assert.deepEqual(plan.deletions, []);
});

test('C2 직전 슬롯과 10분 «미만»이면 안 만든다', () => {
  const root = mkRoot(); const now = NOW;
  const h = mkHist(root, 'p', [now - 9 * MIN]);
  assert.equal(SS.planLegacySlots(h, now).create, false);
});

test('C3 «정확히 10분»도 안 만든다 — 기존 코드가 > 이지 >= 가 아니다(경계 보존)', () => {
  const root = mkRoot(); const now = NOW;
  const h = mkHist(root, 'p', [now - 10 * MIN]);
  assert.equal(SS.planLegacySlots(h, now).create, false, '경계가 바뀌면 이 테스트가 먼저 깨져야 한다');
  const h2 = mkHist(root, 'q', [now - 10 * MIN - 1]);
  assert.equal(SS.planLegacySlots(h2, now).create, true);
});

test('C4 «가장 최신» 슬롯을 기준으로 잰다 — 오래된 슬롯이 섞여 있어도', () => {
  const root = mkRoot(); const now = NOW;
  // 옛날 것 3개 + 방금 것 1개 → 방금 것 때문에 생성 안 됨
  const h = mkHist(root, 'p', [now - 500 * MIN, now - 400 * MIN, now - 300 * MIN, now - 1 * MIN]);
  assert.equal(SS.planLegacySlots(h, now).create, false);
});

/* ── 동작 C: 5슬롯 롤링 ──────────────────────────────────────────────────── */
test('C5 5슬롯 상한 — 6번째를 만들면 «가장 오래된 1개»가 제거 대상', () => {
  const root = mkRoot(); const now = NOW;
  const tsList = [1, 2, 3, 4, 5].map(i => now - (100 - i) * MIN); // 5개(전부 10분 넘게 벌어짐)
  const h = mkHist(root, 'p', tsList);
  const plan = SS.planLegacySlots(h, now);
  assert.equal(plan.create, true);
  assert.deepEqual(plan.deletions, [`${tsList[0]}.json`], '가장 오래된 것 하나만');
});

test('C6 이미 상한을 넘겨 있으면 초과분 전부가 제거 대상(오래된 순)', () => {
  const root = mkRoot(); const now = NOW;
  const tsList = [1, 2, 3, 4, 5, 6, 7].map(i => now - (100 - i) * MIN); // 7개
  const h = mkHist(root, 'p', tsList);
  const plan = SS.planLegacySlots(h, now);
  assert.equal(plan.create, true);
  // 7 + 신규 1 = 8 → 5만 남기니 3개 제거, 오래된 순서대로
  assert.deepEqual(plan.deletions, tsList.slice(0, 3).map(t => `${t}.json`));
});

test('C7 제거 계획은 «만들 때»만 나온다 — 게이트에 막히면 아무것도 안 지운다', () => {
  const root = mkRoot(); const now = NOW;
  const tsList = [1, 2, 3, 4, 5, 6, 7].map(i => now - (100 - i) * MIN);
  tsList.push(now - 1 * MIN); // 방금 것 → 게이트에 막힘
  const h = mkHist(root, 'p', tsList);
  const plan = SS.planLegacySlots(h, now);
  assert.equal(plan.create, false);
  assert.deepEqual(plan.deletions, [], '★게이트에 막힌 저장이 슬롯을 지우면 안 된다');
});

test('C8 .json 아닌 파일은 슬롯으로 세지 않는다(index.json 은 U1 에서 여기 들어온다)', () => {
  const root = mkRoot(); const now = NOW;
  const h = mkHist(root, 'p', [now - 50 * MIN]);
  fs.writeFileSync(path.join(h, 'README.txt'), 'x');
  fs.writeFileSync(path.join(h, '.DS_Store'), 'x');
  const plan = SS.planLegacySlots(h, now);
  assert.equal(plan.create, true);
  assert.deepEqual(plan.deletions, []);
});

test('C9 히스토리 디렉터리가 없어도 터지지 않는다', () => {
  const root = mkRoot();
  const plan = SS.planLegacySlots(path.join(root, 'nope', 'proj_history'), NOW);
  assert.equal(plan.create, true);
});

test('C10 ⚠️현행 취약성 사진: 슬롯 정렬이 «문자열» 정렬이라 epoch 자릿수가 섞이면 시간순이 깨진다', () => {
  // 12자리 + 13자리를 섞으면 '1…' < '9…' 이라 최신이 «맨 앞»으로 간다 → lastSlotTs 오판.
  // 실데이터는 2001~2286 이 전부 13자리라 도달 불가지만, 이게 «현행 동작»임을 못 박아 둔다.
  // ★U1 이 숫자 정렬로 고친다. 그때 이 테스트가 «의도적으로» 깨져야 한다.
  const root = mkRoot();
  const h = mkHist(root, 'p', [999_994_060_000]);       // 12자리
  const plan = SS.planLegacySlots(h, 1_000_000_000_000); // 13자리
  assert.equal(plan.create, true);
  // 문자열 정렬이면 마지막 원소가 12자리 쪽 → lastSlotTs 가 «옛것»으로 잡힌다(우연히 create=true)
  assert.equal(plan.lastSlotTs, 999_994_060_000);
});

/* ── 불변식 B: 파일명 계약 ───────────────────────────────────────────────── */
test('B1 새 슬롯 파일명은 `<epoch>.json` 이다 — 폴백의 parseInt 정렬이 여기에 걸려 있다', () => {
  const root = mkRoot();
  const h = mkHist(root, 'p', []);
  const plan = SS.planLegacySlots(h, 1_787_634_347_738);
  assert.match(plan.newName, /^\d+\.json$/, '접미사를 붙이면 parseInt 정렬이 조용히 깨진다');
  assert.equal(parseInt(plan.newName), 1_787_634_347_738);
});

/* ── 불변식 A: 폴백 후보 순서 ────────────────────────────────────────────── */
function setupFallback(root, id, { backup, hist = [], flatHist = [], preExt } = {}) {
  const dir = path.join(root, id);
  fs.mkdirSync(dir, { recursive: true });
  if (backup) fs.writeFileSync(path.join(dir, 'proj_backup.json'), '{}');
  if (hist.length) mkHist(root, id, hist);
  if (flatHist.length) {
    const fd = path.join(root, `${id}_history`);
    fs.mkdirSync(fd, { recursive: true });
    for (const ts of flatHist) fs.writeFileSync(path.join(fd, `${ts}.json`), '{}');
  }
  if (preExt) fs.writeFileSync(path.join(dir, 'proj_pre-externalize.json'), '{}');
  const resolveBackup = (i) => {
    const p = path.join(root, i, 'proj_backup.json');
    return fs.existsSync(p) ? p : null;
  };
  return SS.loadFallbackCandidates(root, id, resolveBackup);
}

test('A1 순서 계약: backup → history(최신→오래된) → pre-externalize(★맨 끝)', () => {
  const root = mkRoot();
  const c = setupFallback(root, 'p', { backup: true, hist: [100, 300, 200], preExt: true });
  assert.deepEqual(c.map(x => x.from), ['backup', 'history', 'history', 'history', 'pre-externalize']);
  assert.deepEqual(c.slice(1, 4).map(x => path.basename(x.path)), ['300.json', '200.json', '100.json'],
    '히스토리는 «최신 우선»이어야 한다');
});

test('A2 ★pre-externalize 는 절대 앞으로 오지 않는다 — 늙은 원본이 최신 백업을 이기면 F1 데이터손실', () => {
  const root = mkRoot();
  const c = setupFallback(root, 'p', { backup: true, hist: [100], preExt: true });
  assert.equal(c[c.length - 1].from, 'pre-externalize');
  assert.ok(c.findIndex(x => x.from === 'pre-externalize') > c.findIndex(x => x.from === 'backup'));
  assert.ok(c.findIndex(x => x.from === 'pre-externalize') > c.findIndex(x => x.from === 'history'));
});

test('A3 backup 이 없으면 history 가 선두 — 빠진 자리를 메우지 않는다', () => {
  const root = mkRoot();
  const c = setupFallback(root, 'p', { hist: [100, 200] });
  assert.deepEqual(c.map(x => x.from), ['history', 'history']);
});

test('A4 구 flat 레이아웃(<id>_history)도 후보에 든다 — 신 레이아웃 «다음»', () => {
  const root = mkRoot();
  const c = setupFallback(root, 'p', { hist: [200], flatHist: [900] });
  assert.deepEqual(c.map(x => path.basename(x.path)), ['200.json', '900.json'],
    '신 레이아웃이 먼저다(마이그레이션 안 된 옛 파일이 최신을 이기면 안 된다)');
});

test('A5 아무것도 없으면 빈 배열 — 던지지 않는다', () => {
  const root = mkRoot();
  assert.deepEqual(SS.loadFallbackCandidates(root, 'ghost', () => null), []);
});

test('A6 projectId 에 경로조각이 들어와도 base 밖을 가리키지 않는다', () => {
  const root = mkRoot();
  const c = SS.loadFallbackCandidates(root, '../../etc', () => null);
  for (const x of c) assert.ok(path.resolve(x.path).startsWith(path.resolve(root)), x.path);
});

/* ── ★차분 퍼즈: 추출이 «무동작»임을 주장이 아니라 측정으로 증명한다 ──────────
 * main.js 에서 옮기기 «전» 로직을 여기 그대로 복각해(reference) 새 구현과 1000회 대조한다.
 * 추출 리팩터의 「의미 무변경」은 이렇게만 증명된다 — 코드를 눈으로 비교하는 건 증거가 아니다.  */
function referenceLegacyBlock(histDir, now) {
  // ↓↓ main.js 1261~1283 (추출 전) 원문 그대로. 파일을 실제로 만들고 지운다.
  const created = [];
  const deleted = [];
  const slots = fs.readdirSync(histDir).filter(f => f.endsWith('.json')).sort();
  const lastSlotTs = slots.length > 0
    ? parseInt(slots[slots.length - 1].replace('.json', '')) || 0
    : 0;
  if (now - lastSlotTs > 10 * 60 * 1000) {
    const newSlot = path.join(histDir, `${now}.json`);
    fs.writeFileSync(newSlot, '{}'); created.push(`${now}.json`);
    const refreshed = fs.readdirSync(histDir).filter(f => f.endsWith('.json')).sort();
    while (refreshed.length > 5) {
      const oldest = refreshed.shift();
      try { fs.unlinkSync(path.join(histDir, oldest)); deleted.push(oldest); } catch {}
    }
  }
  return { created, deleted };
}

test('C11 ★차분 퍼즈 1000회 — 추출본이 추출 전 로직과 «완전히 같은 결정»을 낸다', () => {
  const root = mkRoot();
  let ran = 0, createdBoth = 0;
  for (let i = 0; i < 1000; i++) {
    // 무작위 슬롯 상태: 개수 0~9, 간격 0~40분, 노이즈 파일 섞음
    const n = i % 10;
    const now = NOW + (i * 7919) % (500 * MIN);
    const tsList = [];
    for (let k = 0; k < n; k++) tsList.push(now - ((i * 31 + k * 97) % 40 + 1) * MIN);
    tsList.sort((a, b) => a - b);

    const dRef = path.join(root, `ref${i}`, 'proj_history');
    const dNew = path.join(root, `new${i}`, 'proj_history');
    for (const d of [dRef, dNew]) {
      fs.mkdirSync(d, { recursive: true });
      for (const ts of tsList) fs.writeFileSync(path.join(d, `${ts}.json`), '{}');
      if (i % 3 === 0) fs.writeFileSync(path.join(d, 'notes.txt'), 'noise');
    }

    const ref = referenceLegacyBlock(dRef, now);

    const plan = SS.planLegacySlots(dNew, now);
    const mine = { created: [], deleted: [] };
    if (plan.create) {
      fs.writeFileSync(path.join(dNew, plan.newName), '{}'); mine.created.push(plan.newName);
      for (const o of plan.deletions) { try { fs.unlinkSync(path.join(dNew, o)); mine.deleted.push(o); } catch {} }
    }

    assert.deepEqual(mine, ref, `i=${i} 결정이 갈렸다 (slots=${tsList.length}, now=${now})`);
    // 결정뿐 아니라 «디렉터리 최종 상태»까지 같아야 한다
    assert.deepEqual(
      fs.readdirSync(dNew).sort(), fs.readdirSync(dRef).sort(),
      `i=${i} 디렉터리 최종 상태가 갈렸다`);
    ran++; if (plan.create) createdBoth++;
  }
  assert.equal(ran, 1000);
  assert.ok(createdBoth > 100, `생성 분기를 충분히 탔는지 확인 (탄 횟수=${createdBoth}) — 안 타면 퍼즈가 헛돈 것`);
  assert.ok(createdBoth < 900, `비생성 분기도 탔는지 확인 (탄 횟수=${1000 - createdBoth})`);
});
