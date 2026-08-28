/* 임시 루트 — «만들면 반드시 치운다». 그리고 «못 치우고 죽어도 다음 실행이 치운다».
 * (파일명이 _ 로 시작해 테스트 글롭에 안 걸린다 — 도구다.)
 *
 * ★사고 기록(2026-08-28): 테스트가 mkdtempSync 만 하고 아무도 안 지웠다.
 *   이 스위트는 36MB·126MB 픽스처를 쓰고 변이 스윕은 스위트를 15회 돌린다.
 *   실측 «임시 디렉터리 25,102개 · 30GB» → 디스크 100% → 스윕이 ENOSPC 로 죽었고,
 *   ★그 과정에서 «남의 세션»(blokit 등)과 사용자의 GODITOR 앱까지 멈춰세웠다.
 *   ⇒ 자기가 죽는 건 자기 손해지만, 디스크를 다 먹고 죽는 건 남을 죽인다.
 *
 * 설계 셋:
 *   ⑴ 우산 하나  — 모든 임시루트를 $TMPDIR/goya-run-<pid>/ «한 폴더» 아래 둔다.
 *                 회수 단위가 1개라 어떻게 죽든 그 폴더만 지우면 끝난다.
 *   ⑵ 사후 회수  — ★process.on('exit') 는 SIGKILL·OOM 에서 «안 돈다».
 *                 36MB·126MB 픽스처라 강제종료가 실재한다(오늘 실제로 겪었다).
 *                 ⇒ 종료훅에 기대지 않고, «다음 실행이 시작할 때» 죽은 pid 의 우산을 회수한다.
 *   ⑶ 사전 게이트 — 디스크 여유가 모자라면 «시작을 거부»한다.
 *                 「돌다가 실패」보다 「안 시작」이 옳다 — 돌다가 실패하면 남이 죽는다.
 */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const { execFileSync } = require('child_process');

const UMBRELLA_RE = /^goya-run-(\d+)$/;
const MIN_FREE_GB = Number(process.env.GOYA_TEST_MIN_FREE_GB || 5);
/** pid 재사용 대비 — 테스트 실행이 이보다 오래갈 리 없다. */
const STALE_MS = 24 * 60 * 60 * 1000;

let _umbrella = null;
let _hooked = false;
const _tracked = [];

/** 디스크 여유(바이트). 못 재면 null — «못 쟀다»를 «여유 있다»로 읽지 않는다. */
function freeBytes(dir) {
  try {
    const out = execFileSync('df', ['-k', dir || os.tmpdir()], { encoding: 'utf8' });
    const line = out.trim().split('\n').pop().trim().split(/\s+/);
    // df -k: Filesystem 1024-blocks Used Available ...
    const availKb = parseInt(line[3], 10);
    return Number.isFinite(availKb) ? availKb * 1024 : null;
  } catch (_) { return null; }
}

/** 시작 전 게이트. 모자라면 «숫자를 말하며» 던진다 — 「디스크 부족」만으론 뭘 지울지 모른다. */
function requireFreeSpace(minGb) {
  const need = (minGb == null ? MIN_FREE_GB : minGb) * 1024 ** 3;
  if (need <= 0) return { ok: true, free: null, need: 0 };
  const free = freeBytes();
  if (free == null) return { ok: true, free: null, need };   // 못 재면 막지 않는다(오탐으로 CI를 세우지 않는다)
  if (free >= need) return { ok: true, free, need };
  const g = b => (b / 1024 ** 3).toFixed(2) + 'GB';
  const err = new Error(
    `[goya-test] 디스크 여유 부족으로 시작을 거부한다 — 여유 ${g(free)} · 필요 ${g(need)}.\n` +
    `  이 스위트는 큰 픽스처를 쓴다. 돌다가 디스크를 다 먹으면 «다른 세션»이 멈춘다.\n` +
    `  치울 것: ${path.join(os.tmpdir(), 'goya-run-*')} (죽은 실행 잔재) · 빌드 산출물 · 오래된 릴리스 아티팩트\n` +
    `  기준을 바꾸려면 GOYA_TEST_MIN_FREE_GB=<숫자>`
  );
  err.code = 'GOYA_LOW_DISK';
  throw err;
}

/** 죽은 pid 의 우산을 회수한다. ★살아있는 pid 는 절대 안 건드린다 — 남의 병렬 실행을 죽인다. */
function reapDeadUmbrellas() {
  const tmp = os.tmpdir();
  const out = { scanned: 0, reaped: 0, skippedAlive: 0, bytes: 0 };
  let names;
  try { names = fs.readdirSync(tmp); } catch (_) { return out; }
  for (const name of names) {
    const m = UMBRELLA_RE.exec(name);
    if (!m) continue;
    out.scanned++;
    const pid = parseInt(m[1], 10);
    const dir = path.join(tmp, name);
    if (pid === process.pid) continue;                  // 내 것은 종료훅이 치운다
    let alive = false;
    try { process.kill(pid, 0); alive = true; }          // 살아있음
    catch (e) { alive = (e && e.code === 'EPERM'); }     // ★EPERM = 남의 유저 프로세스 = «살아있다»
    if (alive) {
      // pid 재사용 대비: 아주 오래된 우산은 그 pid 가 이 실행의 것이 아니다.
      let old = false;
      try { old = (Date.now() - fs.statSync(dir).mtimeMs) > STALE_MS; } catch (_) {}
      if (!old) { out.skippedAlive++; continue; }
    }
    try { fs.rmSync(dir, { recursive: true, force: true }); out.reaped++; } catch (_) {}
  }
  return out;
}

function _cleanup() {
  while (_tracked.length) {
    const r = _tracked.pop();
    try { fs.rmSync(r, { recursive: true, force: true }); } catch (_) {}
  }
  if (_umbrella) { try { fs.rmSync(_umbrella, { recursive: true, force: true }); } catch (_) {} }
}

function _hook() {
  if (_hooked) return; _hooked = true;
  process.on('exit', _cleanup);
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(sig, () => { _cleanup(); process.exit(130); });
  }
}

/** 이 프로세스의 우산. 처음 부를 때 ⑵사후회수 + ⑶게이트를 «먼저» 통과한다. */
function umbrella() {
  if (_umbrella) return _umbrella;
  reapDeadUmbrellas();        // ★게이트보다 «먼저» — 잔재를 치우면 여유가 생겨 통과할 수 있다
  requireFreeSpace();
  const d = path.join(os.tmpdir(), `goya-run-${process.pid}`);
  fs.mkdirSync(d, { recursive: true });
  _hook();
  _umbrella = d;
  return d;
}

/** 임시 루트를 만들고 «종료 시 삭제»에 등록한다. */
function mkTmpRoot(prefix) {
  return fs.mkdtempSync(path.join(umbrella(), String(prefix || 'goya-')));
}
/** 내가 안 만든 디렉터리(하위 경로 등)도 정리 목록에 넣는다. */
function trackTmp(dir) { _hook(); _tracked.push(dir); return dir; }

module.exports = {
  mkTmpRoot, trackTmp, umbrella,
  reapDeadUmbrellas, requireFreeSpace, freeBytes,
  _cleanup, _UMBRELLA_RE: UMBRELLA_RE, _STALE_MS: STALE_MS,
};
