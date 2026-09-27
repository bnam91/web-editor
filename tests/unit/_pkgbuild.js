/* _pkgbuild.js — main.js `_isPackagedBuild()` «원문»을 떼어 가짜 app·authService 로 만든다 (0920 pkgguard, T-063).
 * (파일명이 _ 로 시작해 테스트 글롭에 안 걸린다 — 도구다.)
 *
 * ★왜 원문을 쓰나: 게이트 하네스(runAdmin·runLaunchBlock·debug-port 등)가 «내가 흉내낸» 헬퍼를 주입하면
 *   헬퍼가 망가져도 초록이다. 원문을 떼어 돌리면 헬퍼 본문이 바뀔 때 여기가 같이 빨개진다.
 * @param {{appIsPackaged:boolean, asar?:boolean, authThrows?:boolean}} o
 *   appIsPackaged — Electron 의 답(실행파일 이름 규칙)
 *   asar          — authService 런타임 판정(⒜ app.asar 안에서 로드됨). 진짜 authService 는
 *                   applyRuntime 이후 «asar OR app.isPackaged» 를 돌려준다 — 그 모양 그대로 흉내낸다.
 *   authThrows    — authService require 가 깨진 경우(→ 막는 쪽 true 여야 한다)
 */
'use strict';
const path = require('path');
const { readSrc } = require('./_srcread.js');
const { sliceBlock } = require('./_slice-block.js');

const ROOT = path.join(__dirname, '..', '..');
const MAIN = readSrc(ROOT, 'main.js');
const SRC = sliceBlock(MAIN, 'function _isPackagedBuild(', 'main.js _isPackagedBuild 가 사라졌다');

function makePkgBuild({ appIsPackaged, asar = false, authThrows = false } = {}) {
  const app = { isPackaged: appIsPackaged };
  const calls = [];
  const req = (m) => {
    calls.push(m);
    if (m === './services/authService') {
      if (authThrows) throw new Error('authService load failed (test)');
      return { isPackaged: () => !!(asar || appIsPackaged === true) };
    }
    throw new Error('unexpected require in _isPackagedBuild: ' + m);
  };
  const fn = new Function('app', 'require', `${SRC}\nreturn _isPackagedBuild;`)(app, req);
  fn.__calls = calls;
  return fn;
}

module.exports = { makePkgBuild, PKG_BUILD_SRC: SRC };
