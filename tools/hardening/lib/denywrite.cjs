/* denywrite.cjs — 「쓰기를 «진짜로» 거부시킨다」의 «플랫폼 공용» 정본.
 *
 * ★왜 CJS 인가: 검사가 .test.js(CJS)·.test.mjs(ESM) 양쪽에 걸쳐 있다.
 *   CJS 는 `require()`, ESM 은 `import { denyWrite } from '.../denywrite.cjs'` 로
 *   «같은 구현»을 쓴다(module.exports 객체 리터럴이라 이름이 뽑힌다).
 *
 * ★사고 두 개가 이 파일을 만들었다 — 그리고 «방향이 반대»였다.
 *   ⑴ 옛 판(`fs.chmodSync`)   : 윈도우에서 chmod 는 «디렉터리에 무효» ⇒ 「못 쓰는 상황」을
 *      잰다고 믿으면서 «쓸 수 있는» 상황을 쟀다 = **가짜 초록**.
 *   ⑵ 첫 이식(`icacls /deny (W)`): icacls 의 `(W)` = FILE_GENERIC_WRITE 는
 *      **READ_CONTROL·SYNCHRONIZE 까지 포함**한다. 그걸 deny 하면 «여는 것 자체»가 막힌다.
 *      실측(미니4호기, 비승격): deny 후 `readdirSync` EPERM(scandir) · `readFileSync` EPERM(open).
 *      ⇒ 「못 쓰고 «못 읽는»」 상황을 만들어 놓고 제품이 못 읽는다고 나무랐다 = **가짜 빨강**.
 *      (POSIX `chmod 0500` 은 나열·읽기가 «된다». 그게 재려던 상황이다.)
 *   ⇒ ★그래서 이 파일은 «막은 뒤 스스로 재고», 모양이 다르면 «되돌리고 던진다».
 *     읽기가 죽었으면 그건 검사 실패가 아니라 «도구 고장»이다. 그 둘을 코드가 가른다.
 *
 * ⛔윈도우에서 «건너뛰지» 않는다 — 건너뛴 검사는 거기서 영영 안 돈다.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const WIN = process.platform === 'win32';

/* ★윈도우에서 «쓰기만» 거부하는 권한 집합.
     WD 쓰기/파일추가 · AD 덧붙이기/하위폴더추가 · WEA·WA 속성쓰기 · DC 자식삭제
   ⛔`(W)` 를 쓰면 안 된다 — READ_CONTROL·SYNCHRONIZE 가 딸려 들어가 «읽기까지» 죽는다.
   ⛔`(OI)(CI)` 도 안 붙인다 — POSIX `chmod 0500` 은 «이미 있는 자식 파일»의 권한을 안 바꾼다. */
const WIN_DENY_RIGHTS = 'WD,AD,WEA,WA,DC';
const POSIX_DENY_MODE = 0o500;                 // r-x — 나열·읽기는 되고 «새로 만들기»만 막힌다

/** 지금 이 디렉터리에서 «나열·읽기·쓰기»가 각각 되는지 «해 봐서» 잰다. 플래그를 믿지 않는다. */
function probeAccess(dir) {
  const out = { list: false, listCode: null, read: null, readCode: null, write: false, writeCode: null };
  let names = [];
  try { names = fs.readdirSync(dir); out.list = true; } catch (e) { out.listCode = (e && e.code) || 'UNKNOWN'; }
  if (out.list) {
    /* ★읽기 확인은 «이미 있는» 파일로만 한다 — 검사 대상 폴더에 파일을 만들면
       그 폴더를 세는 판정기(listVersions·judgeCrashLog)를 오염시킨다. */
    const victim = names
      .map((n) => path.join(dir, n))
      .find((p) => { try { return fs.statSync(p).isFile(); } catch (_) { return false; } });
    if (victim) {
      try { fs.readFileSync(victim); out.read = true; }
      catch (e) { out.read = false; out.readCode = (e && e.code) || 'UNKNOWN'; }
    }
  }
  const probe = path.join(dir, `.denywrite-probe-${process.pid}-${Math.random().toString(36).slice(2, 8)}`);
  try { fs.writeFileSync(probe, 'x'); fs.rmSync(probe, { force: true }); out.write = true; }
  catch (e) { out.writeCode = (e && e.code) || 'UNKNOWN'; }
  return out;
}

/** 하위호환 — 옛 이름. */
function probeWritable(dir) {
  const a = probeAccess(dir);
  return { writable: a.write, code: a.writeCode };
}

/** 승격 여부 — 승격돼 있으면 deny 가 «안 먹는다». 조용히 넘기지 말고 이름을 부른다. */
function elevated() {
  if (!WIN) return typeof process.getuid === 'function' && process.getuid() === 0;
  try { execFileSync('net', ['session'], { stdio: 'ignore' }); return true; }   // 관리자만 성공
  catch (_) { return false; }
}

function winUser() {
  try { return execFileSync('whoami', { encoding: 'utf8' }).trim(); }           // DOMAIN\user
  catch (_) { return os.userInfo().username; }
}

/**
 * ★판정 자 — 「막은 뒤의 모양」이 «재려던 상황»인가.
 *   순수 함수라 검사에서 직접 먹여 볼 수 있다(윈도우 없이도 이 규약을 지킬 수 있게).
 * @returns {null} 문제 없음 / {string} 문제면 «사람이 읽는» 사유
 */
function denialShapeProblem(before, after, how) {
  if (after.write) {
    return `막았다는데 «여전히 써진다»(${how}) — 이대로 두면 「못 쓰는 상황」을 잰다고 믿으면서\n` +
           '  «쓸 수 있는» 상황을 재게 된다(가짜 초록).';
  }
  if (before.list && !after.list) {
    return `쓰기를 막았더니 «나열»까지 죽었다(${after.listCode}, ${how}) — 이건 검사 실패가 아니라 «도구 고장»이다.\n` +
           '  POSIX chmod 0500 은 나열이 «된다». 재려던 건 「못 쓰는」 상황이지 「못 읽는」 상황이 아니다(가짜 빨강).';
  }
  if (before.read === true && after.read === false) {
    return `쓰기를 막았더니 «읽기»까지 죽었다(${after.readCode}, ${how}) — 도구 고장이다(가짜 빨강).\n` +
           '  윈도우라면 icacls 권한을 `(W)` 로 주지 않았는지 봐라 — READ_CONTROL·SYNCHRONIZE 가 딸려 온다.';
  }
  return null;
}

/**
 * dir 에 «새 파일을 만들 수 없게» 만든다. 나열·읽기는 «그대로 산다».
 * 돌려주는 핸들의 restore() 로 되돌린다.
 * @returns {{dir, how, errCode, denied: string[], sanity: string, before, after, restore: () => void}}
 */
function denyWrite(dir) {
  if (!fs.existsSync(dir)) throw new Error(`[denywrite] 대상이 없다: ${dir}`);
  const before = probeAccess(dir);
  if (!before.write) throw new Error(`[denywrite] 전제 미달 — 막기 «전»부터 못 쓴다(${before.writeCode}): ${dir}`);
  if (elevated()) {
    throw new Error(
      `[denywrite] ${WIN ? '관리자로 승격된 셸' : 'root'} 에서는 쓰기 거부가 «안 먹는다» — 이 검사는 그 상황을 잴 수 없다.\n` +
      `  ⛔건너뛰지 말고 «일반 권한»으로 다시 돌려라(윈도우: schtasks /RL LIMITED): ${dir}`
    );
  }

  let restore, how;
  if (WIN) {
    const user = winUser();
    how = `icacls /deny ${user}:(${WIN_DENY_RIGHTS})`;
    execFileSync('icacls', [dir, '/deny', `${user}:(${WIN_DENY_RIGHTS})`], { stdio: 'ignore' });
    restore = () => { try { execFileSync('icacls', [dir, '/remove:d', user], { stdio: 'ignore' }); } catch (_) {} };
  } else {
    const beforeMode = fs.statSync(dir).mode & 0o777;
    how = 'chmod 0500';
    fs.chmodSync(dir, POSIX_DENY_MODE);
    restore = () => { try { fs.chmodSync(dir, beforeMode); } catch (_) {} };
  }

  const after = probeAccess(dir);
  const problem = denialShapeProblem(before, after, how);
  if (problem) { restore(); throw new Error(`[denywrite] ${problem}\n  대상: ${dir}`); }

  return {
    dir,
    how,
    errCode: after.writeCode,                       // POSIX EACCES / 윈도우 EPERM|EACCES
    denied: [dir],                                  // ★판정기에 넘길 «선언» — 「못 쟀다」가 「없다」가 되지 않게
    sanity: `막기 전 write=ok/list=${before.list} → 막은 뒤 write=${after.writeCode}/list=${after.list}/read=${after.read}`,
    before, after,
    restore,
  };
}

/** try/finally 상용구 축소. 예외가 나도 «반드시» 되돌린다. */
function withDeniedWrite(dir, fn) {
  const h = denyWrite(dir);
  try { return fn(h); } finally { h.restore(); }
}

module.exports = {
  denyWrite, withDeniedWrite, probeAccess, probeWritable, denialShapeProblem, elevated,
  WIN_DENY: WIN, WIN_DENY_RIGHTS, POSIX_DENY_MODE,
};
