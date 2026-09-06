/* ═══════════════════════════════════════════════════════════════════════════
   break/kill9-midsave.mjs — «저장 도중»에 SIGKILL.
   ───────────────────────────────────────────────────────────────────────────
   ★적대 검수가 지목한 함정(PLAN §5 H7 ⑶ 첫째):
     「kill 이 저장 «전»에 떨어져 I7 이 «자명 통과»하나」
     ⇒ 그래서 sleep 으로 때리지 않는다. proj.json.tmp 가 «생기는 순간»을 fs.watch 로 잡아
       그때 죽인다. 그리고 죽인 시각의 tmp 존재를 증거로 싣는다.
       tmp 를 못 봤으면 `midsave:false` 로 «스스로» 표시한다 — 그 실행의 I7 초록은
       「원자쓰기가 이겼다」가 아니라 「도중을 못 때렸다」다. 둘은 다른 문장이다.
   ⚠️원자쓰기(main.js:912 tmp→rename)가 «빠르면» 창이 좁다. 손잡이는 fixture padKb 다.
   ⛔모든 대기에 상한. 저장이 아예 안 오면 HARNESS_ERROR(=3) 로 끝난다 — 매달리지 않는다.
═══════════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { HarnessError, sleep, withDeadline } from '../lib/deadline.mjs';

/**
 * @param projDir   감시할 프로젝트 폴더(«내» ud 안)
 * @param pid       죽일 프로세스 — ⛔반드시 «내가 띄운» pid
 * @param armed     감시를 건 «뒤» 저장을 발화시키는 콜백(여기서 편집·triggerAutoSave)
 */
export async function killMidSave(projDir, pid, armed, {
  timeout = 30000, watchNames = ['proj.json.tmp', 'proj_backup.json.tmp'],
} = {}) {
  if (!pid || pid === process.pid) throw new HarnessError(`kill 대상 pid 가 이상하다: ${pid}`);
  if (!fs.existsSync(projDir)) throw new HarnessError(`감시 대상 폴더가 없다: ${projDir}`);

  const seen = [];
  let killAt = null, killedOn = null, tmpAtKill = null, watcher = null;

  const fired = new Promise((resolve, reject) => {
    try {
      watcher = fs.watch(projDir, { persistent: true }, (evt, name) => {
        if (!name) return;
        seen.push({ evt, name, at: Date.now() });
        if (!watchNames.includes(name) || killAt) return;
        // ★죽이기 «직전»에 tmp 가 실재하는지 stat — 이게 「도중이었다」의 증거다.
        const tmpPath = path.join(projDir, name);
        try { const st = fs.statSync(tmpPath); tmpAtKill = { name, bytes: st.size }; } catch (_) { tmpAtKill = null; }
        killAt = Date.now(); killedOn = name;
        try { process.kill(pid, 'SIGKILL'); } catch (e) { reject(new HarnessError(`SIGKILL 실패: ${e.message}`)); return; }
        resolve();
      });
    } catch (e) { reject(new HarnessError(`fs.watch 실패: ${e.message}`)); }
  });

  await sleep(50);                       // 감시가 «먼저» 걸리게
  const armedAt = Date.now();
  if (armed) await armed();              // ← 저장 발화

  let midsave = true, note = null;
  try {
    await withDeadline(fired, timeout, 'proj.json.tmp 출현 대기(=저장 도중)');
  } catch (e) {
    // tmp 를 못 봤다. 저장이 «너무 빨라» rename 까지 한 프레임에 끝났거나, 저장 자체가 안 왔다.
    midsave = false;
    note = `tmp 를 못 봤다(${e.message}). ⇒ 이 실행의 I7 초록은 「도중을 못 때렸다」는 뜻이다 — ` +
           `자명 통과다. padKb 를 올리거나 코퍼스 사본으로 다시 재라.`;
    killAt = Date.now();
    try { process.kill(pid, 'SIGKILL'); } catch (_) {}
  } finally { try { watcher && watcher.close(); } catch (_) {} }

  await sleep(500);
  const residue = fs.existsSync(path.join(projDir, 'proj.json.tmp'));

  /* ★★sanity 를 «watch 가 울렸다»로 판정하면 안 된다 — 자체 실기가 나를 여기서 잡았다.
     fs.watch 는 tmp «생성»에도 울고 «rename(=삭제)»에도 운다. rename 쪽에 울면
     stat 이 실패하고, 그때 kill 은 이미 «저장이 끝난 뒤»에 떨어진 것이다.
     그 실행의 I7 초록은 「원자쓰기가 이겼다」가 아니라 「도중을 못 때렸다」 — 자명 통과다.
     ⇒ 「도중이었다」의 증거는 «kill 직전 stat 성공» 또는 «kill 뒤 tmp 잔재» 둘 중 하나뿐이다. */
  const proven = !!tmpAtKill || residue;
  const verdict = !midsave ? 'MISS' : (proven ? 'HIT' : 'UNCERTAIN');
  if (verdict === 'UNCERTAIN') {
    note = (note ? note + ' ' : '') +
      `watch 는 ${killedOn} 로 울었지만 kill 직전 stat 이 실패했고 잔재도 없다 ⇒ ` +
      `rename «뒤»에 때렸을 가능성이 크다. 이 실행의 I7 초록은 «자명 통과»로 읽어라 ` +
      `(--pad-kb 를 올리거나 --corpus 로 다시).`;
  }
  return {
    breaker: 'kill9-midsave', pid, projDir, armedAt, killAt,
    killedOn, tmpAtKill, midsave, verdict, midsaveProven: proven, note,
    tmpResidueAfter: residue,
    fsEvents: seen.slice(0, 40),
    sanity: verdict === 'HIT'
      ? `저장 도중 «증명» — ${killedOn} 실재(${tmpAtKill ? tmpAtKill.bytes + 'B' : '잔재로 확인'}) 뒤 ${killAt - armedAt}ms 만에 SIGKILL`
      : verdict === 'UNCERTAIN'
      ? `⚠️도중 «미증명» — watch 는 울었으나 tmp 실재를 못 봤다(자명 통과 위험)`
      : `⚠️도중 미확인 — sanity 미달(자명 통과 위험)`,
    summary: `kill9-midsave ${verdict} — 발화→kill ${killAt - armedAt}ms · tmp잔재 ${residue}`,
  };
}
