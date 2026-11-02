#!/usr/bin/env node
/* env-head.mjs — 시트 335 · 전수 로그 머리의 env 한 줄. 어느 env 로 돌았나를 사후에 세려고 쓴다.
 *   명부 = tests/ 소스에서 파생(process.env.NAME · ⛔손 열거 · 접두사도 열거다). 값은 찍되 자격증명 꼴은 가린다: 이름 · 값 꼴 · URL 인증.
 *   쓰기: node tools/env-head.mjs [레포] → 한 줄 · rc 0 · 명부 0 이면 rc 2(자가 죽었다).
 *        node tools/env-head.mjs --check <로그> → rc 0 머리 있음 · rc 3 없음(그 로그로 판 정체를 판정하지 마라) · rc 2 못 읽음. */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const HEAD = /^env\(명부 (\d+) · /m;
const argv = process.argv.slice(2);
if (argv[0] === '--check') {
  let t; try { t = fs.readFileSync(argv[1], 'utf8'); } catch (e) { console.error(`못 읽음 ${argv[1]}: ${e.code}`); process.exit(2); }
  const m = t.match(HEAD);
  if (!m) { console.error('⛔env 머리 없음 — 이 로그로 «판 정체»를 판정하지 마라'); process.exit(3); }
  console.log(`● 있다 · 명부 ${m[1]}`);
  process.exit(0);
}
const root = path.resolve(argv[0] || '.');
const names = new Set();
const walk = (d) => {
  let es; try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
  for (const e of es) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p); }
    else if (/\.(c|m)?js$/.test(e.name)) for (const m of fs.readFileSync(p, 'utf8').matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) names.add(m[1]);
  }
};
walk(path.join(root, 'tests'));
if (!names.size) { console.error('⛔명부 0 건 — 자가 죽었다'); process.exit(2); }
const SECRET_NAME = /KEY|SECRET|TOKEN|PUBKEY|CODE|PASS|CRED|AUTH/;
const show = (n) => {
  const v = process.env[n];
  if (v === undefined) return `${n}=(없음)`;
  if (SECRET_NAME.test(n)) return `${n}=(가림:이름)`;
  if (/:\/\/[^/]*@/.test(v)) return `${n}=(가림:URL인증)`;
  if (v.length >= 32 && !/^[/~.]/.test(v) || /-----BEGIN /.test(v)) return `${n}=(가림:값)`;   // 경로는 길어도 보인다(GOLDEN_DIR 류)
  return `${n}=${v}`;
};
const sha = spawnSync('git', ['rev-parse', '--short=8', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout?.trim() || '(못 읽음)';
console.log(`env(명부 ${names.size} · 검사 소스 파생 · 판 ${sha}): ${[...names].sort().map(show).join(' · ')}`);
