#!/usr/bin/env node
/* gdt-import-cli.js — 앱을 띄우지 않고 .gdt를 불러온다(검증·측정용).
 *
 *   node scripts/gdt-import-cli.js <입력.gdt> <projects 디렉터리>
 *
 * ★projects 디렉터리는 «반드시» 검증용 사본을 줘라. 실사용 데이터에 쓰지 말 것.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { importGdt } = require('../main/gdt/import');

const [gdtArg, dirArg] = process.argv.slice(2);
if (!gdtArg || !dirArg) {
  console.error('usage: node scripts/gdt-import-cli.js <in.gdt> <projectsDir>');
  process.exit(2);
}
const gdtPath = path.resolve(gdtArg);
const projectsDir = path.resolve(dirArg);
if (!fs.existsSync(gdtPath)) { console.error('입력 없음:', gdtPath); process.exit(2); }
fs.mkdirSync(projectsDir, { recursive: true });

importGdt({
  gdtPath, projectsDir,
  onProgress: (p) => { if (p.phase !== 'restore') process.stderr.write(`  ${p.phase}…\n`); },
}).then((r) => {
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.ok ? 0 : 1);
});
