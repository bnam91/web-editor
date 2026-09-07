/* ═══════════════════════════════════════════════════════════════════════════
   judge/crashlog.mjs — H2 가 남길 «크래시 기록»의 자.
   ───────────────────────────────────────────────────────────────────────────
   ★이 자는 H2 «전»에도 돈다. 지금 돌리면 「없다」가 나오는 게 정상이다 —
     그게 곧 H2 의 착수 근거고, H2 뒤엔 같은 자가 「있다」를 내야 한다.
   ⛔★「못 쟀다」를 「없다」로 읽지 마라 (PLAN §5 H7 ⑶ 적대검수 두 번째)
     deny-write 로 logs 폴더를 막아 놓고 이 자를 돌리면 파일이 «없는» 게 당연하다.
     그래서 호출자는 denied 목록을 «넘겨야» 하고, 겹치면 verdict 가 NOT_MEASURED 다.
═══════════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';

/** H2 기록 스키마(PLAN §2 B-3). 없는 필드는 missing 으로 나온다. */
export const CRASH_SCHEMA = {
  required: ['at', 'kind', 'appVersion', 'os', 'arch'],
  optional: ['reason', 'exitCode', 'projectId', 'errors', 'errorsAsOf', 'main', 'attachedAt'],
};

export function judgeCrashLog(userDataDir, {
  sinceMs = 0, denied = [], expect = 'present', kind = null,
} = {}) {
  const logsDir = path.join(userDataDir, 'logs');
  const res = {
    judge: 'CRASHLOG', logsDir, expect, files: [], records: [], schemaErrors: [],
    mainLogBytes: -1, notMeasured: null,
  };

  // ⑴ «못 쟀다» 판정을 «먼저». 막아 놓고 없다고 말하는 것이 이 자의 최악 실패다.
  const deniedHit = denied.map(d => path.resolve(d)).find(d => logsDir.startsWith(d) || d.startsWith(logsDir));
  let statErr = null;
  let exists = false;
  try { exists = fs.statSync(logsDir).isDirectory(); } catch (e) { statErr = e.code; }
  if (deniedHit || statErr === 'EACCES' || statErr === 'EPERM') {
    res.notMeasured = `logs 폴더가 «막혀 있다»(${deniedHit || statErr}) — 기록 유무를 판정할 수 없다`;
    res.verdict = 'NOT_MEASURED'; res.pass = null;
    res.summary = `CRASHLOG NOT_MEASURED — ${res.notMeasured}`;
    return res;
  }
  if (!exists) {
    res.verdict = expect === 'present' ? 'ABSENT' : 'ABSENT_AS_EXPECTED';
    res.pass = expect !== 'present';
    res.summary = `CRASHLOG ${res.verdict} — logs 폴더 자체가 없다 (${logsDir})`;
    return res;
  }

  let names = [];
  try { names = fs.readdirSync(logsDir); } catch (e) {
    res.notMeasured = `logs 폴더를 못 읽는다(${e.code})`; res.verdict = 'NOT_MEASURED'; res.pass = null;
    res.summary = `CRASHLOG NOT_MEASURED — ${res.notMeasured}`; return res;
  }
  try { res.mainLogBytes = fs.statSync(path.join(logsDir, 'main.log')).size; } catch (_) {}

  for (const n of names) {
    if (!/^crash-\d+\.json$/.test(n)) continue;
    const f = path.join(logsDir, n);
    let st; try { st = fs.statSync(f); } catch (_) { continue; }
    if (st.mtimeMs < sinceMs) continue;
    res.files.push({ file: f, bytes: st.size, mtime: st.mtimeMs });
    let rec;
    try { rec = JSON.parse(fs.readFileSync(f, 'utf8')); }
    catch (e) { res.schemaErrors.push({ file: n, reason: `JSON 깨짐: ${e.message.slice(0, 80)}` }); continue; }
    const missing = CRASH_SCHEMA.required.filter(k => rec[k] === undefined);
    if (missing.length) res.schemaErrors.push({ file: n, reason: `필수 필드 누락: ${missing.join(',')}` });
    res.records.push(rec);
  }

  const kindOk = !kind || res.records.some(r => String(r.kind) === kind);
  if (expect === 'present') {
    res.pass = res.files.length > 0 && res.schemaErrors.length === 0 && kindOk;
    res.verdict = res.files.length === 0 ? 'ABSENT' : (res.pass ? 'PRESENT' : 'MALFORMED');
  } else {
    res.pass = res.files.length === 0;
    res.verdict = res.pass ? 'ABSENT_AS_EXPECTED' : 'UNEXPECTED_PRESENT';
  }
  res.summary = `CRASHLOG ${res.verdict} — crash 파일 ${res.files.length}건 · 스키마오류 ${res.schemaErrors.length}` +
    (kind ? ` · kind=${kind} ${kindOk ? '있음' : '없음'}` : '') + ` · main.log ${res.mainLogBytes}B`;
  return res;
}

/** 기록 안의 errors 배열에 «크래시 직전 마커»가 들어왔나 — 미러가 실제로 도착했다는 증거(C2). */
export function judgeMirrorMarker(records, marker) {
  const hit = records.some(r => JSON.stringify(r.errors || []).includes(marker));
  return { judge: 'MIRROR', marker, pass: hit, records: records.length,
    summary: `MIRROR ${hit ? 'PASS' : 'FAIL'} — 기록 ${records.length}건에서 마커 «${marker}» ${hit ? '발견' : '없음'}` };
}
