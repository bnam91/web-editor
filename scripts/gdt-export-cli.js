#!/usr/bin/env node
/* gdt-export-cli.js — 앱을 띄우지 않고 .gdt를 만든다(검증·측정용).
 *
 * 용도: 두장의 왕복 판정 입력 생성, 대용량 실측(시간·피크메모리), CI 스모크.
 * 원본 proj.json은 «읽기만» 한다.
 *
 *   node scripts/gdt-export-cli.js <proj.json 경로> <출력.gdt> [프로젝트명]
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { exportGdt } = require('../main/gdt/export');

const [srcArg, outArg, nameArg] = process.argv.slice(2);
if (!srcArg || !outArg) {
  console.error('usage: node scripts/gdt-export-cli.js <proj.json> <out.gdt> [name]');
  process.exit(2);
}
const src = path.resolve(srcArg);
const out = path.resolve(outArg);
if (!fs.existsSync(src)) { console.error('원본 없음:', src); process.exit(2); }

const appVersion = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).version;
const sourceId = path.basename(path.dirname(src));

let lastPct = -1;
exportGdt({
  srcProjJson: src, outPath: out,
  meta: { name: nameArg || sourceId, sourceId, appVersion },
  onProgress: (p) => {
    if (p.phase === 'scan') {
      const pct = Math.floor((p.bytesDone / p.bytesTotal) * 100);
      if (pct !== lastPct && pct % 20 === 0) { lastPct = pct; process.stderr.write(`  scan ${pct}%\n`); }
    } else if (p.phase === 'verify') process.stderr.write('  verify…\n');
  },
}).then((r) => {
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.ok ? 0 : 1);
});
