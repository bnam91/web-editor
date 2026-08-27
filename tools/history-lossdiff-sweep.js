/* history-lossdiff-sweep.js — ★손실 diff(L1)를 «실데이터 전수»에 태운다. READ-ONLY.
 * 실행: node --max-old-space-size=8192 tools/history-lossdiff-sweep.js
 *
 * 왜 필요한가: 단위테스트의 캔버스는 내가 «깨끗하게» 만든 합성 픽스처다. 실캔버스엔
 *   data-memo 안의 개행, &quot; 이스케이프, data-name 없는 섹션, 여러 페이지, noid 섹션이 섞여 있다.
 *   fingerprint → index → lossDiff 사슬 전체가 실데이터를 만나는 건 여기가 처음이다.
 *
 * ⛔라이브 userData 는 «읽기»만 한다. 인덱스는 스크래치 사본에만 만든다.
 * 검사하는 «성질»(합성 픽스처로는 잘 안 드러나는 것들):
 *   ① 분할 불변식 — lost + kept == 스냅샷 섹션수, gained + kept == 현재 섹션수
 *   ② 키 형식 — 모든 키가 `pageId::sectionId`, 빈 이름 0
 *   ③ 중복 키 0 (같은 섹션이 두 번 세지면 손실 수가 거짓말한다)
 *   ④ 던지지 않는다
 *   ⑤ ★«전량 손실» 비율 — 스냅샷의 «모든» 섹션이 사라졌다고 나오는 건 대개 진짜 손실이 아니라
 *      «키가 안 맞물린 것»이다(실제로 이걸로 218건 중 66건이 거짓 경보였다: raw 지문의 `?::` 페이지
 *      플레이스홀더가 `page_1::` 와 안 맞물렸다). 헤드라인이 노이즈가 되면 기능 자체가 실패다.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const SS = require('../main/project-store/snapshot-store');

// version-diff.js 는 브라우저 IIFE — 가짜 window 에 얹어 «진짜» lossDiff 를 쓴다(재구현 금지).
const win = {};
new Function('window', fs.readFileSync(path.join(__dirname, '../js/version-diff.js'), 'utf8'))(win);
const { lossDiff } = win.versionDiff;

const LIVE = path.join(process.env.HOME, 'Library/Application Support/GODITOR/projects');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'goya-loss-'));
let projs = 0, versions = 0, fails = 0, lostTotal = 0, gainedTotal = 0, noid = 0, emptyName = 0;
let fullLoss = 0, recent = 0, recentFullLoss = 0;
const problems = [];

for (const d of fs.readdirSync(LIVE)) {
  const srcHist = path.join(LIVE, d, 'proj_history');
  const srcProj = path.join(LIVE, d, 'proj.json');
  if (!fs.existsSync(srcHist) || !fs.existsSync(srcProj)) continue;

  // 사본으로만 작업한다 — 라이브에 index.json 을 만들지 않는다
  const dst = path.join(scratch, d);
  fs.mkdirSync(dst, { recursive: true });
  fs.cpSync(srcHist, path.join(dst, 'proj_history'), { recursive: true });
  fs.copyFileSync(srcProj, path.join(dst, 'proj.json'));

  let list;
  try { list = SS.listVersions(scratch, d); }
  catch (e) { fails++; problems.push(`${d}: listVersions THREW ${e.message}`); continue; }
  if (!list.ok || !list.current) { problems.push(`${d}: current 없음`); continue; }
  // pending 이 남아 있으면 다 채운다(전수 검사가 목적이라 예산제를 끝까지 돌린다)
  let guard = 0;
  while (list.pendingCount > 0 && guard++ < 20) list = SS.listVersions(scratch, d);
  projs++;

  const cur = list.current.secs || [];
  for (const e of list.entries) {
    if (!e.counts) continue; // 끝내 미분석
    versions++;
    let r;
    try { r = lossDiff(e.secs || [], cur); }
    catch (err) { fails++; problems.push(`${d}/${e.ts}: lossDiff THREW ${err.message}`); continue; }

    // ① 분할 불변식
    const entryUniq = new Set((e.secs || []).map(x => x.k)).size;
    const curUniq = new Set(cur.map(x => x.k)).size;
    if (r.lost.length + r.keptCount !== entryUniq)
      problems.push(`${d}/${e.ts}: lost(${r.lost.length})+kept(${r.keptCount}) != 스냅샷 고유섹션(${entryUniq})`);
    if (r.gained.length + r.keptCount !== curUniq)
      problems.push(`${d}/${e.ts}: gained(${r.gained.length})+kept(${r.keptCount}) != 현재 고유섹션(${curUniq})`);

    // ② 키 형식 · 빈 이름  ③ 중복 키
    for (const src of [e.secs || [], cur]) {
      const seen = new Set();
      for (const x of src) {
        if (!/^[^:]*::.+$/.test(x.k)) problems.push(`${d}/${e.ts}: 키 형식 이상 ${JSON.stringify(x.k)}`);
        if (!x.n || !String(x.n).trim()) emptyName++;
        if (x.k.includes('::noid_')) noid++;
        if (seen.has(x.k)) problems.push(`${d}/${e.ts}: 중복 키 ${x.k}`);
        seen.add(x.k);
      }
    }
    lostTotal += r.lost.length;
    gainedTotal += r.gained.length;
    const entryTotal = (e.secs || []).length;
    if (entryTotal > 0 && r.lost.length === entryTotal) fullLoss++;
    if (list.current.ts && (list.current.ts - e.ts) < 7 * 86400000) {
      recent++;
      if (entryTotal > 0 && r.lost.length === entryTotal) recentFullLoss++;
    }
  }
}

fs.rmSync(scratch, { recursive: true, force: true });
console.log(`프로젝트 ${projs} · 버전 ${versions} 개에 손실 diff 를 태웠다`);
console.log(`  사라진 섹션 누적 ${lostTotal} · 새로 생긴 섹션 누적 ${gainedTotal}`);
console.log(`  noid 폴백 키 ${noid} · 빈 이름 ${emptyName} · 예외 ${fails}`);
console.log(`  ★전량손실 ${fullLoss}/${versions} · 최근 7일 내 전량손실 ${recentFullLoss}/${recent}`);
// ⑤ 게이트 — 최근 버전에서 «전량 손실»이 절반을 넘으면 키가 안 맞물리는 것이다(진짜 손실이 아니다).
if (recent > 0 && recentFullLoss / recent > 0.5) {
  problems.push(`★최근 7일 버전의 ${recentFullLoss}/${recent} 가 «전량 손실» — 키가 안 맞물린다(헤드라인이 노이즈)`);
}
const uniq = [...new Set(problems)];
if (uniq.length) { console.log(`\n★문제 ${uniq.length}종:`); for (const p of uniq.slice(0, 20)) console.log('  ' + p); }
else console.log('\n전부 PASS — 분할 불변식·키 형식·중복 0');
process.exit(uniq.length || fails ? 1 : 0);
