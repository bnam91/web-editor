#!/usr/bin/env node
/* admin-library-prep — 관리자 로컬 라이브러리 재료 PNG → WebP 사전 변환(LIB-FIGMA-MEMOJI-INCLUSIVE-192-2-01 · 261118).
 *   앱 밖 1회 · PNG 옆에 같은 이름 .webp 를 둔다(있으면 건너뜀 · 원본 PNG 무수정). 앱은 명부가 정한 확장자(미모지 = webp)만 읽는다.
 *   도구 = cwebp(새 npm 의존성 0). 원래 크기 유지(421² → 장당 ~9KB · 145MB → ~16MB).
 *   쓰는 법: node scripts/admin-library-prep.cjs ~/goditor-admin-library/memoji-inclusive-192-2
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const dir = process.argv[2];
if (!dir || !fs.statSync(dir).isDirectory()) { console.error('쓰는 법: admin-library-prep.cjs <폴더>'); process.exit(2); }
let made = 0, skip = 0, inB = 0, outB = 0;
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    if (!/\.png$/i.test(e.name)) continue;
    const out = p.replace(/\.png$/i, '.webp');
    if (fs.existsSync(out)) { skip++; continue; }
    execFileSync('cwebp', ['-quiet', '-q', '80', '-alpha_q', '90', p, '-o', out]);
    made++; inB += fs.statSync(p).size; outB += fs.statSync(out).size;
  }
})(dir);
console.log(`[admin-library-prep] 만듦 ${made} · 건너뜀 ${skip} · PNG ${(inB / 1048576).toFixed(1)}MB → WebP ${(outB / 1048576).toFixed(1)}MB`);
