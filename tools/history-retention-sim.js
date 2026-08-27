/* history-retention-sim.js — ★보관 정책(D5)의 «핵심 약속»을 실데이터로 시뮬레이션한다. READ-ONLY(사본).
 * 실행: node --max-old-space-size=8192 tools/history-retention-sim.js [projectId] [days]
 *
 * 검증하려는 약속(설계 §D5):
 *   「최근 20개(10분 간격) + 하루 1개 × 14일」이면 **「어제 그거」를 복구할 수 있다**.
 *   구정책(5슬롯 × 10분)의 실효 보관기간은 **50분**이었다. 그게 이 기능을 만든 이유다.
 *
 * ★여태 프룬 테스트는 «합성 ts» 뿐이었다 — 실제 편집 패턴(하루 여러 번, 몇 주치)으로 돌린 적이 없다.
 *   실프로젝트를 실제 저장 경로(writeSnapshot + pruneVersions)에 태워 며칠치를 굴려 본다.
 *
 * 재는 것:
 *   ① «어제/3일 전/1주 전/2주 전»에 복구 지점이 실제로 남아 있나 (핵심)
 *   ② 총 용량 · 슬롯 수 · 인덱스 크기 (약속한 경량화가 유지되나)
 *   ③ 구정책이었다면 무엇이 남았을까 (대조군)
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const SS = require('../main/project-store/snapshot-store');

const LIVE = path.join(process.env.HOME, 'Library/Application Support/GODITOR/projects');
const PID = process.argv[2] || 'proj_1787026440333';
const DAYS = Number(process.argv[3] || 60);
const MIN = 60 * 1000, DAY = 86400000;

const src = path.join(LIVE, PID, 'proj.json');
if (!fs.existsSync(src)) { console.error(`실데이터 없음: ${src}`); process.exit(0); }

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'goya-ret-'));
fs.mkdirSync(path.join(root, PID), { recursive: true });
fs.copyFileSync(src, path.join(root, PID, 'proj.json'));
const base = JSON.parse(fs.readFileSync(path.join(root, PID, 'proj.json'), 'utf8'));

// 편집 패턴 모사: 하루 6번 저장(작업시간 10~18시), 매번 섹션 이름 하나를 바꿔 «내용이 변한» 상태로.
const T0 = Date.now() - DAYS * DAY;
const slots = [];
for (let d = 0; d < DAYS; d++) for (let k = 0; k < 6; k++) slots.push(T0 + d * DAY + (10 + k * 1.5) * 3600000);

let created = 0;
for (let i = 0; i < slots.length; i++) {
  const now = slots[i];
  // 매 저장마다 캔버스를 조금 바꾼다(같은 내용이면 스냅샷의 «다름»을 못 본다)
  const data = { ...base, name: base.name, pages: (base.pages || []).map((p, pi) =>
    pi === 0 ? { ...p, canvas: (p.canvas || '').replace(/data-name="[^"]*"/, `data-name="편집 ${i}"`) } : p) };
  // 실제 저장 경로가 하는 그대로: proj.json 기록 → 스냅샷 → 프룬
  fs.writeFileSync(path.join(root, PID, 'proj.json'), JSON.stringify(data, null, 2));
  if (SS.writeSnapshot(root, PID, data, { now }).ok) created++;
  SS.pruneVersions(root, PID, { now });
}

const endNow = slots[slots.length - 1];
const list = SS.listVersions(root, PID);
const ages = list.entries.map(e => (endNow - e.ts) / DAY);
const has = (loD, hiD) => ages.some(a => a >= loD && a < hiD);
const histDir = path.join(root, PID, 'proj_history');
const files = fs.readdirSync(histDir).filter(f => /^\d+\.json$/.test(f));
const totalBytes = files.reduce((s, f) => s + fs.statSync(path.join(histDir, f)).size, 0);
const idxBytes = fs.statSync(path.join(histDir, 'index.json')).size;
const assetsDir = path.join(root, PID, 'assets');
const assetBytes = fs.existsSync(assetsDir)
  ? fs.readdirSync(assetsDir).reduce((s, f) => s + fs.statSync(path.join(assetsDir, f)).size, 0) : 0;
const MB = (x) => (x / 1048576).toFixed(2);

console.log(`${PID} — ${DAYS}일 × 하루 6저장 = ${slots.length}회 저장 (스냅샷 ${created}개 생성)`);
console.log(`남은 슬롯 ${files.length} · 스냅샷 ${MB(totalBytes)}MB + 에셋 ${MB(assetBytes)}MB + 인덱스 ${(idxBytes / 1024).toFixed(0)}KB`);
console.log(`가장 오래된 복구 지점: ${ages.length ? Math.max(...ages).toFixed(1) : '—'}일 전 · 가장 최근: ${ages.length ? Math.min(...ages).toFixed(2) : '—'}일 전`);

let fail = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : '★FAIL'}  ${msg}`); if (!ok) fail++; };
check(has(0, 0.5),  '① «오늘» 복구 지점이 있다');
check(has(0.5, 1.6), '② ★«어제» 복구 지점이 있다 — 이게 복구의 실제 단위다(§1)');
check(has(2.5, 3.6), '③ «3일 전» 복구 지점이 있다');
check(has(6.5, 7.6), '④ «1주 전» 복구 지점이 있다');
check(has(13, 14.6), '⑤ «2주 전» 복구 지점이 있다');
// ★상한 «경계»는 상수에서 끌어온다 — 상수를 바꾸고 검사 문구가 안 따라오면 그게 가짜 초록이다
const D = SS.DAILY_DAYS;
check(has(D - 2, D + 0.6), `⑥ ★보관 상한 경계(${D}일)에 복구 지점이 있다 — 중간만 재면 상한이 실제로 서는지 모른다`);
check(!has(D + 2, 9999), `⑦ 상한(${D}일)을 «넘는» 슬롯은 남지 않는다(핀·레거시 제외)`);
check(files.length <= SS.RECENT_KEEP + SS.DAILY_DAYS + SS.PINNED_MAX + 2,
  `⑧ 슬롯 수가 정책 상한 안이다 (${files.length} ≤ ${SS.RECENT_KEEP}+${SS.DAILY_DAYS}+여유)`);
check(totalBytes + assetBytes < SS.BUDGET_BYTES,
  `⑨ 총량이 예산 안이다 (${MB(totalBytes + assetBytes)}MB / ${MB(SS.BUDGET_BYTES)}MB = ${((totalBytes + assetBytes) / SS.BUDGET_BYTES * 100).toFixed(1)}%)`);
check(idxBytes < 2 * 1024 * 1024, `⑩ 인덱스가 «가볍다» — 목록이 파일 0개로 뜨는 전제 (${(idxBytes / 1024).toFixed(0)}KB)`);

// ③ 대조군 — 구정책(5슬롯 × 10분)이었다면?
const oldPolicyOldest = 5 * 10 * MIN / DAY;
console.log(`\n대조군: 구정책(5슬롯 × 10분 간격)의 실효 보관기간 = ${(oldPolicyOldest * 24 * 60).toFixed(0)}분`);
console.log(`        「어제 그거」는 구조적으로 복구 불가였다 → 신정책 ${ages.length ? Math.max(...ages).toFixed(0) : 0}일`);

fs.rmSync(root, { recursive: true, force: true });
console.log(fail === 0 ? '\n전부 PASS' : `\n★${fail}건 FAIL`);
process.exit(fail ? 1 : 0);
