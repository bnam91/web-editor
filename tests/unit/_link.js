/* _link — 「경로가 «밖»을 가리키게 만든다」의 «플랫폼 공용» 정본.
 *
 * ★왜 있나 (미니4호기 윈도우 실기, 31a7723 · 비승격)
 *   `fs.symlinkSync(파일, 링크)` 는 윈도우에서 **SeCreateSymbolicLink 권한**을 요구한다.
 *   승격 셸이나 「개발자 모드」가 아니면 `EPERM: operation not permitted, symlink` 로 죽는다.
 *   ⇒ 그런데 우리 쓰기-거부 검사(denywrite)는 «승격이면 스스로 던진다».
 *     ★한 셸로 둘 다 초록은 «불가능»하다 — 그래서 symlink 쪽을 «비승격에서 되는 방법»으로 바꾼다.
 *
 * ★정션(junction)은 «디렉터리에 한해» 비승격에서 만들 수 있다.
 *   `fs.symlinkSync(target, link, 'junction')` — type 인자는 POSIX 에선 무시된다(같은 코드 한 벌).
 *   ⇒ 「밖을 가리키는 링크」라는 «재려던 성질»은 그대로다: realpath 가 assets 루트를 벗어난다.
 *
 * ⛔`fs.linkSync`(하드링크)로 바꾸면 «다른 것»을 재게 된다 — 하드링크의 realpath 는 자기 자신이라
 *   「밖을 가리킨다」가 성립하지 않는다. 통과해 버린다.
 * ⛔`catch { return; }` 로 건너뛰지 마라 — 그 검사는 윈도우에서 영영 안 돈다(가짜 초록).
 */
'use strict';
const fs = require('fs');
const path = require('path');

/**
 * `linkPath` 가 «디렉터리» `targetDir` 을 가리키게 만든다(비승격에서 된다).
 * ★만들고 나서 realpath 로 «정말 밖을 가리키는지» 확인한다 — 못 만들었으면 «소리내어» 던진다.
 */
function linkToDirOutside(targetDir, linkPath) {
  if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
    throw new Error(`[_link] 대상이 디렉터리가 아니다(정션은 디렉터리만 된다): ${targetDir}`);
  }
  try {
    fs.symlinkSync(path.resolve(targetDir), linkPath, 'junction');
  } catch (e) {
    throw new Error(
      `[_link] 링크를 못 만들었다(${e && e.code}): ${linkPath}\n` +
      '  ⛔건너뛰지 마라 — 건너뛴 검사는 이 플랫폼에서 영영 안 돈다.\n' +
      '  윈도우라면: 정션은 «디렉터리»만 된다(파일 심링크는 승격/개발자 모드가 필요하다).'
    );
  }
  const real = fs.realpathSync(linkPath);
  if (real !== fs.realpathSync(targetDir)) {
    throw new Error(`[_link] 링크가 대상을 안 가리킨다: ${real} ≠ ${fs.realpathSync(targetDir)}`);
  }
  return linkPath;
}

/** 링크만 지운다 — ★대상 «안»은 건드리지 않는다(윈도우 정션은 unlink 가 안 먹는다). */
function unlinkDirLink(linkPath) {
  try { fs.unlinkSync(linkPath); return true; }         // POSIX 심링크
  catch (_) {}
  try { fs.rmdirSync(linkPath); return true; }          // 윈도우 정션 — 대상은 그대로 남는다
  catch (_) {}
  return false;
}

module.exports = { linkToDirOutside, unlinkDirLink };
