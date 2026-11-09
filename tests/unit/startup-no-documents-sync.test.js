/* startup-no-documents-sync — STARTUP-DOCUMENTS-SYNC-MKDIR-01
 *   예전: main.js 가 «시작 때» ~/Documents/design-bot-builder 를 동기 existsSync·mkdirSync → 첫 실행 TCC 확인창이면 기동 멈춤.
 *   S1 main.js «맨 위층»(함수 밖) 문장에 사용자 문서·데스크톱·다운로드 폴더 동기 fs 0 (homedir()/Documents|Desktop|Downloads 를 쥔 이름 · getPath('documents'|'desktop'|'downloads'))
 *   S2 intake 세 핸들러는 비동기 fs 만 · INTAKE_DIR 동기 접근 0 · 폴더는 저장할 때 만든다
 *   ★양성대조: 기준판 main.js(4010 행 existsSync/mkdirSync(INTAKE_DIR)) → S1·S2 빨강.
 *   (main.js 는 electron 없이 못 띄운다 — «안 돌아오는 fs 에도 시작이 끝남» 은 S1 로 대신 잰다: 시작 경로에 그 접근이 «없다») */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { sliceCall } = require('./_slice-block.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'main.js'), 'utf8');
/* 맨 위층 문장 = 들여쓰기 없는 줄(이 파일 관례 — 함수·핸들러 본문은 들여쓴다 = «부를 때» 돈다).
   ⛔중괄호 셈으로 깊이를 재지 마라 — 4000 줄 넘는 파일의 정규식·문자열 속 괄호로 깊이가 어긋나 옛 4010 행을 놓쳤다(양성대조로 잡음). */
const topLevelLines = (src) => src.split('\n').filter((l) => /^[A-Za-z_$(!]/.test(l));
const USERDIR = /homedir\(\)\s*,\s*['"](Documents|Desktop|Downloads)['"]|getPath\(\s*['"](documents|desktop|downloads)['"]\s*\)/;

test('S1 시작 때(맨 위층) 사용자 문서·데스크톱·다운로드 폴더 동기 접근 0', () => {
  const top = topLevelLines(SRC);
  assert.ok(top.length > 200, `[전제] 맨 위층 줄을 셌다(${top.length})`);
  const names = new Set();
  for (const l of top) { const m = /const\s+(\w+)\s*=.*/.exec(l); if (m && USERDIR.test(l)) names.add(m[1]); }
  const bad = top.filter((l) => /\w+Sync\(/.test(l) && (USERDIR.test(l) || [...names].some((n) => new RegExp(`\\b${n}\\b`).test(l))));
  assert.deepStrictEqual(bad.map((l) => l.trim()), [], '시작 경로에서 사용자 폴더를 동기로 만진다');
});

test('S2 intake 핸들러 = 비동기 fs 만 · 폴더는 저장할 때', () => {
  assert.ok(!/(existsSync|mkdirSync|readdirSync|readFileSync|writeFileSync)\(\s*(path\.join\()?INTAKE_DIR/.test(SRC), 'INTAKE_DIR 동기 접근이 남았다');
  for (const ch of ['intake:save', 'intake:load', 'intake:list']) {
    const body = sliceCall(SRC, `ipcMain.handle('${ch}'`, ch);
    assert.ok(!/Sync\(/.test(body), `${ch} 안에 동기 fs`);
    assert.ok(/async\s*\(/.test(body), `${ch} 는 async`);
  }
  assert.match(sliceCall(SRC, "ipcMain.handle('intake:save'", 'save'), /fs\.promises\.mkdir\(INTAKE_DIR/, '저장할 때 폴더를 만든다');
});
