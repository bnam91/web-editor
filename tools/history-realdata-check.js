/* history-realdata-check.js — 실데이터 인수시험(U1).
 * 라이브 프로젝트를 «스크래치패드로 복사한 뒤» 그 사본에만 저장 6회를 재현한다.
 * ⛔라이브 userData 는 읽기만 한다. 실행: node --max-old-space-size=4096 tools/history-realdata-check.js [projectId]
 *
 * 인수 기준(DESIGN-version-history.md §2-3 / §12-B U1)
 *   ① 신방식 총합(스냅샷 JSON + 에셋)이 구방식(원본 통째 복사)의 25% 미만
 *   ② 2회차부터 에셋 추가 바이트 0 (dedup)
 *   ③ ★원본 proj.json 의 «바이트»가 한 바이트도 안 변한다
 *   ④ 섹션 수가 스냅샷에서 보존된다
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const SS = require('../main/project-store/snapshot-store');

const PID = process.argv[2] || 'proj_1787026440333';
const LIVE = path.join(process.env.HOME, 'Library/Application Support/GODITOR/projects');
const src = path.join(LIVE, PID, 'proj.json');
if (!fs.existsSync(src)) { console.error(`실데이터 없음: ${src} — 건너뜀`); process.exit(0); }

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'goya-real-'));
fs.mkdirSync(path.join(root, PID), { recursive: true });
const projPath = path.join(root, PID, 'proj.json');
fs.copyFileSync(src, projPath);
// 이미 외부화된 프로젝트면 에셋도 같이 복사(정직한 재현)
const srcAssets = path.join(LIVE, PID, 'assets');
if (fs.existsSync(srcAssets)) fs.cpSync(srcAssets, path.join(root, PID, 'assets'), { recursive: true });

const raw = fs.readFileSync(projPath, 'utf8');
const data = JSON.parse(raw);
const origBytes = fs.readFileSync(projPath);
const rawSize = Buffer.byteLength(raw);
const fpBefore = SS.fingerprint(data);

const MIN = 60 * 1000;
const NOW = Date.now();
let snapTotal = 0, assetWritten = 0;
const rows = [];
for (let i = 0; i < 6; i++) {
  const t0 = Date.now();
  const r = SS.writeSnapshot(root, PID, data, { now: NOW + i * 20 * MIN });
  if (!r.ok) { console.error(`FAIL: ${i}회차 스냅샷 실패 — ${r.skipped || r.error}`); process.exit(1); }
  snapTotal += r.bytes; assetWritten += r.bytesWritten;
  rows.push({ i, bytes: r.bytes, imgs: r.images, reused: r.reused, wrote: r.bytesWritten, ms: Date.now() - t0 });
}
const assetsDir = path.join(root, PID, 'assets');
const assetBytes = fs.existsSync(assetsDir)
  ? fs.readdirSync(assetsDir).reduce((s, f) => s + fs.statSync(path.join(assetsDir, f)).size, 0) : 0;

const MB = (x) => (x / 1048576).toFixed(3);
console.log(`프로젝트 ${PID} — proj.json ${MB(rawSize)}MB · 섹션 ${fpBefore.counts.sections} · 블록 ${fpBefore.counts.blocks} · 이미지 ${fpBefore.counts.images}`);
for (const r of rows) console.log(`  ${r.i + 1}회차  스냅샷 ${MB(r.bytes)}MB  이미지 ${r.imgs}(재사용 ${r.reused})  새 에셋 ${MB(r.wrote)}MB  ${r.ms}ms`);
const oldWay = rawSize * 6, newWay = snapTotal + assetWritten;
console.log(`구방식(통째 복사 6회) ${MB(oldWay)}MB  →  신방식 ${MB(newWay)}MB  = ${(newWay / oldWay * 100).toFixed(1)}%`);

let fail = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : '★FAIL'}  ${msg}`); if (!ok) fail++; };
check(newWay / oldWay < 0.25, `① 총량이 구방식의 25% 미만 (실측 ${(newWay / oldWay * 100).toFixed(1)}%)`);
check(rows.slice(1).every(r => r.wrote === 0), `② 2회차부터 에셋 추가 바이트 0 (dedup)`);
check(origBytes.equals(fs.readFileSync(projPath)), `③ ★원본 proj.json 바이트 불변`);
const last = SS.readVersion(root, PID, SS.listVersions(root, PID).entries[0].ts);
check(last.ok && SS.fingerprint(last.data).counts.sections === fpBefore.counts.sections,
  `④ 섹션 수 보존 (${fpBefore.counts.sections})`);
// ⑤ «캔버스 안» base64 잔여 0 — canonicalize 의 대상이 캔버스이기 때문이다.
//    assetsTree 썸네일 같은 캔버스 밖 소형 base64(실측 이 프로젝트 12건 ≈ 8KB)는 externalizer 와
//    같은 이유로 «대상이 아니다». raw 전체로 재면 정상 동작을 FAIL 로 오판한다(초판이 그랬다).
const lastEntry = SS.listVersions(root, PID).entries[0];
const snapData = JSON.parse(fs.readFileSync(path.join(root, PID, 'proj_history', lastEntry.file), 'utf8'));
const snapCanvas = (snapData.pages || []).map(p => p.canvas || '').join('');
check(snapCanvas.indexOf('data:image') === -1, `⑤ 스냅샷 «캔버스» 인라인 base64 잔여 0`);

// ⑥ GC 계약은 방향이 중요하다 — 「디스크의 모든 파일이 살아있다」가 아니라
//    「스냅샷이 참조하는 모든 에셋이 살아있다 & 실제로 디스크에 있다」이다.
//    전자로 재면 GC 가 «미참조 파일을 지우는 것»조차 금지하는 셈이라 계약을 잘못 고정한다.
const live = SS.listReferencedAssets(root, PID);
const snapRefs = lastEntry.assets || [];
check(snapRefs.length > 0 && snapRefs.every(f => live.has(f)),
  `⑥ ★GC 계약 — 스냅샷 참조 에셋 ${snapRefs.length}개가 전부 «살아있음»에 든다 (live ${live.size}개)`);
check(snapRefs.every(f => fs.existsSync(path.join(assetsDir, f))),
  `⑦ 스냅샷의 에셋 참조가 «디스크에 실제로» 있다 (dangling 0)`);

fs.rmSync(root, { recursive: true, force: true });
console.log(fail === 0 ? '\n전부 PASS' : `\n★${fail}건 FAIL`);
process.exit(fail === 0 ? 0 : 1);
