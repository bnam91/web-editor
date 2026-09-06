/* ═══════════════════════════════════════════════════════════════════════════
   break/deny-write.mjs — 쓰기를 «거부»시킨다(권한 없음 / 디스크 꽉 참 흉내).
   ───────────────────────────────────────────────────────────────────────────
   ★★적대 검수가 지목한 함정(PLAN §5 H7 ⑶ 둘째):
     「deny-write 가 userData 전체를 막아 logs 도 못 써서 H2 판정이 «못 쟀다»를 «없다»로 읽나」
     ⇒ 그래서 이 도구는 ⑴ «범위를 좁게» 막고 ⑵ 막은 경로를 «선언»해서 돌려준다.
       판정기(judgeCrashLog)는 그 선언과 겹치면 NOT_MEASURED 를 낸다. 침묵 통과 없음.
   ★두 가지 방식
     perm   chmod 0o000 — EACCES. 되돌릴 수 있다.
     enospc 대상 파일 경로를 «디렉터리»로 선점 — 쓰기가 EISDIR 로 실패한다.
            ⚠️ENOSPC 를 진짜로 내려면 별도 볼륨이 필요하다. 이건 «쓰기 실패»의 대역이지
              ENOSPC 자체가 아니다 — 보고에 그렇게 적는다(추정/실측 구분).
   ⛔macOS 에서 root 로 돌면 chmod 000 이 «안 막힌다». 그래서 실제로 막혔는지 «써 봐서» 확인한다.
═══════════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { assertWritableTarget } from '../lib/fixture.mjs';
import { HarnessError } from '../lib/deadline.mjs';

/** 실제로 못 쓰는지 «써 봐서» 확인한다 — 플래그를 믿지 않는다. */
export function probeWritable(dir) {
  const p = path.join(dir, `.h7-probe-${process.pid}`);
  try { fs.writeFileSync(p, 'x'); fs.rmSync(p, { force: true }); return { writable: true, code: null }; }
  catch (e) { return { writable: false, code: e.code }; }
}

export function denyWrite(targetDir, { mode = 'perm' } = {}) {
  const dir = assertWritableTarget(targetDir);
  if (!fs.existsSync(dir)) throw new HarnessError(`deny-write: 대상이 없다 ${dir}`);
  if (os.userInfo().uid === 0) throw new HarnessError('⛔root 로 돌면 chmod 000 이 안 막힌다 — 일반 사용자로 돌려라');
  const beforeMode = fs.statSync(dir).mode & 0o777;
  const beforeProbe = probeWritable(dir);
  if (!beforeProbe.writable) throw new HarnessError(`deny-write sanity 미달 — 막기 «전»부터 못 쓴다(${beforeProbe.code})`);

  if (mode !== 'perm') throw new HarnessError(`아직 없는 deny 모드: ${mode}`);
  fs.chmodSync(dir, 0o000);
  const afterProbe = probeWritable(dir);
  if (afterProbe.writable) {
    fs.chmodSync(dir, beforeMode);
    throw new HarnessError('deny-write sanity 미달 — chmod 000 을 했는데 «여전히 써진다»', { dir });
  }
  return {
    breaker: 'deny-write', mode, dir, beforeMode,
    denied: [dir],                       // ★판정기에 넘길 «선언». 안 넘기면 「못 쟀다」가 「없다」가 된다.
    errCode: afterProbe.code,
    sanity: `막기 전 쓰기 가능 → 막은 뒤 ${afterProbe.code}`,
    summary: `deny-write(perm) ${dir} — ${afterProbe.code}`,
    restore() {
      try { fs.chmodSync(dir, beforeMode); } catch (_) {}
      return probeWritable(dir);
    },
  };
}

/** 여러 경로를 한 번에. 하나라도 sanity 미달이면 «전부» 되돌리고 던진다. */
export function denyAll(dirs, opts) {
  const done = [];
  try {
    for (const d of dirs) done.push(denyWrite(d, opts));
    return {
      handles: done, denied: done.flatMap(h => h.denied),
      restore() { const r = done.map(h => h.restore()); return r; },
      summary: done.map(h => h.summary).join(' | '),
    };
  } catch (e) { for (const h of done) h.restore(); throw e; }
}
