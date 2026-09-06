/* denywrite.cjs — 「쓰기를 «진짜로» 거부시킨다」의 «플랫폼 공용» 정본.
 *
 * ★왜 CJS 인가: 검사가 .test.js(CJS)·.test.mjs(ESM) 양쪽에 걸쳐 있다.
 *   CJS 는 `require()`, ESM 은 `import { denyWrite } from '.../denywrite.cjs'` 로
 *   «같은 구현»을 쓴다(module.exports 객체 리터럴이라 이름이 뽑힌다).
 *
 * ★왜 있나 (미니4호기 윈도우 실기, b9edc92)
 *   `fs.chmodSync(dir, 0o500)` 은 윈도우에서 «디렉터리에 아무 효과가 없다».
 *   그래서 「못 쓰는 상황」을 만들었다고 믿은 검사가 실은 «쓸 수 있는» 상황을 재고 있었다.
 *   ⇒ 맥에서는 진짜를 재고 윈도우에서는 가짜 초록이 난다.
 *
 * ⛔윈도우에서 «건너뛰지» 않는다 — 건너뛴 검사는 거기서 영영 안 돈다.
 *   POSIX = chmod / 윈도우 = icacls /deny 로 «같은 상황»을 만들고,
 *   양쪽 다 «써 봐서» 정말 막혔는지 확인한다(플래그를 믿지 않는다).
 *   정말 못 막는 환경(root·관리자 승격)은 «조용히 통과»가 아니라 «소리내어» 던진다.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const WIN = process.platform === 'win32';

/** 실제로 못 쓰는지 «써 봐서» 확인한다. */
function probeWritable(dir) {
  const p = path.join(dir, `.denywrite-probe-${process.pid}-${Math.random().toString(36).slice(2, 8)}`);
  try { fs.writeFileSync(p, 'x'); fs.rmSync(p, { force: true }); return { writable: true, code: null }; }
  catch (e) { return { writable: false, code: (e && e.code) || 'UNKNOWN' }; }
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
 * dir 에 «새 파일을 만들 수 없게» 만든다. 돌려주는 핸들의 restore() 로 되돌린다.
 * @returns {{dir, how, errCode, denied: string[], restore: () => void}}
 */
function denyWrite(dir) {
  if (!fs.existsSync(dir)) throw new Error(`[denywrite] 대상이 없다: ${dir}`);
  const before = probeWritable(dir);
  if (!before.writable) throw new Error(`[denywrite] 전제 미달 — 막기 «전»부터 못 쓴다(${before.code}): ${dir}`);
  if (elevated()) {
    throw new Error(
      `[denywrite] ${WIN ? '관리자로 승격된 셸' : 'root'} 에서는 쓰기 거부가 «안 먹는다» — 이 검사는 그 상황을 잴 수 없다.\n` +
      `  ⛔건너뛰지 말고 «일반 권한»으로 다시 돌려라: ${dir}`
    );
  }

  let restore;
  if (WIN) {
    const user = winUser();
    execFileSync('icacls', [dir, '/deny', `${user}:(OI)(CI)(W)`], { stdio: 'ignore' });
    restore = () => { try { execFileSync('icacls', [dir, '/remove:d', user], { stdio: 'ignore' }); } catch (_) {} };
  } else {
    const beforeMode = fs.statSync(dir).mode & 0o777;
    fs.chmodSync(dir, 0o500);                       // 읽기·탐색만 — 새 파일 생성 거부
    restore = () => { try { fs.chmodSync(dir, beforeMode); } catch (_) {} };
  }

  const after = probeWritable(dir);
  if (after.writable) {
    restore();
    throw new Error(
      `[denywrite] sanity 미달 — ${WIN ? 'icacls /deny' : 'chmod 0500'} 를 했는데 «여전히 써진다»: ${dir}\n` +
      '  ⛔이대로 두면 「못 쓰는 상황」을 잰다고 믿으면서 «쓸 수 있는» 상황을 재게 된다(가짜 초록).'
    );
  }
  return {
    dir,
    how: WIN ? 'icacls /deny (OI)(CI)(W)' : 'chmod 0500',
    errCode: after.code,                            // POSIX EACCES / 윈도우 EPERM|EACCES
    denied: [dir],                                  // ★판정기에 넘길 «선언» — 「못 쟀다」가 「없다」가 되지 않게
    sanity: `막기 전 쓰기 가능 → 막은 뒤 ${after.code}`,
    restore,
  };
}

/** try/finally 상용구 축소. 예외가 나도 «반드시» 되돌린다. */
function withDeniedWrite(dir, fn) {
  const h = denyWrite(dir);
  try { return fn(h); } finally { h.restore(); }
}

module.exports = { denyWrite, withDeniedWrite, probeWritable, elevated, WIN_DENY: WIN };
