#!/usr/bin/env node
/* crlf-sim — 윈도우 체크아웃(`core.autocrlf=true`)을 «맥에서» 흉내 낸다.
 *
 * ★왜: 윈도우 실기 52건 중 최다가 CRLF 였고, 그 때문에 검사 파일 5개가 «한 줄도 안 돌았다».
 *   ⇒ 맥 게이트에서 «고치기 전에 빨강을 재현»할 수 있어야 고쳤는지도 알 수 있다.
 *
 * 쓰는 법 (⚠️반드시 «깨끗한» 작업트리에서 — 되돌리기가 `git checkout -- .` 이다)
 *   node tools/test/crlf-sim.mjs --apply
 *   node --test 'tests/unit/*.test.mjs' 'tests/unit/*.test.js'
 *   git checkout -- .                     # 되돌리기
 *
 * 대상 = `git ls-files --eol` 이 `i/lf` 라고 답한 파일(= autocrlf 가 CRLF 로 내려보낼 것들).
 * ⛔`i/-text`(바이너리)는 안 건드린다.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();

if (!process.argv.includes('--apply')) {
  console.error('사용법: node tools/test/crlf-sim.mjs --apply   (되돌리기: git checkout -- .)');
  process.exit(2);
}
const dirty = execFileSync('git', ['-C', root, 'status', '--porcelain'], { encoding: 'utf8' }).trim();
if (dirty) {
  console.error('⛔작업트리가 깨끗하지 않다. 되돌리기가 `git checkout -- .` 이라 커밋 안 된 변경을 «지운다».');
  console.error(dirty.split('\n').slice(0, 10).join('\n'));
  process.exit(1);
}

const out = execFileSync('git', ['-C', root, 'ls-files', '--eol'], { encoding: 'utf8' });
let n = 0, skipped = 0;
for (const ln of out.split('\n')) {
  const m = ln.match(/^i\/lf\s+\S+\s+\S+\s+(.*)$/);
  if (!m) continue;
  const rel = m[1];
  if (rel.startsWith('"')) { skipped++; continue; }   // 이름에 비ASCII — git 이 인용해 준다(문서뿐)
  const fp = path.join(root, rel);
  let b; try { b = fs.readFileSync(fp); } catch (_) { skipped++; continue; }
  const nb = Buffer.from(b.toString('binary').replace(/\r\n/g, '\n').replace(/\n/g, '\r\n'), 'binary');
  if (!nb.equals(b)) { fs.writeFileSync(fp, nb); n++; }
}
console.log(`CRLF 로 바꾼 파일 ${n}개 (건너뜀 ${skipped}개). 되돌리기: git checkout -- .`);
