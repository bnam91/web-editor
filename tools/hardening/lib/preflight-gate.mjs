/* ═══════════════════════════════════════════════════════════════════════════
   preflight-gate.mjs — 「통과 «로그 파일» 없이는 어떤 실행도 인정 안 함」의 집행자.
   ───────────────────────────────────────────────────────────────────────────
   ⛔preflight 와 기동을 «한 명령에 체인으로» 묶지 마라 — 그렇게 묶어서 FAIL 위에서
     두 번 기동한 실사고가 있다(팀장 1회 + 검수자 2회, 같은 밤). 파이프(`| tail`)를 쓰면
     `$?` 가 파이프 마지막 명령의 것이 돼 또 틀린다.
   ⇒ 그래서 이 하네스는 preflight 를 «부르지 않는다». 사람이 «별도 명령»으로 돌린 뒤,
     그 로그가 ⑴★PASS 이고 ⑵같은 포트이며 ⑶충분히 최근인지를 «읽어서» 확인한다.
     읽는 검사라 exit code 파이프 함정 자체가 없다.
═══════════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { HarnessError } from './deadline.mjs';

export const RUNS_DIR = path.join(os.homedir(), '.claude/skills/goditor-qa/runs');

/** preflight 로그 전부를 «최신순»으로. (--check-origin·--verify 로그도 같은 폴더에 섞인다.) */
export function preflightLogs(dir = RUNS_DIR) {
  const out = [];
  let hosts; try { hosts = fs.readdirSync(dir); } catch (_) { return out; }
  for (const h of hosts) {
    const d = path.join(dir, h);
    let names; try { names = fs.readdirSync(d); } catch (_) { continue; }
    for (const n of names) {
      if (!/^preflight-\d+\.log$/.test(n)) continue;
      const f = path.join(d, n);
      try { out.push({ file: f, mtime: fs.statSync(f).mtimeMs }); } catch (_) {}
    }
  }
  return out.sort((a, b) => b.mtime - a.mtime);
}

/**
 * @param port     이번에 띄울 포트 — 로그의 port= 와 «같아야» 한다
 * @param maxAgeMs 로그가 낡으면 인정 안 한다(기본 30분)
 * @param logFile  명시하면 그 파일만 본다. 없으면 «이 포트의» 가장 최근 통과 로그.
 *
 * ★같은 폴더에 --check-origin·--verify 로그가 섞인다. 「가장 최근 파일」을 집으면
 *   방금 돌린 정당한 통과를 놓치고 엉뚱하게 막힌다(초판이 실제로 그랬다).
 *   ⇒ 최신순으로 훑되 «★PASS 이고 포트가 같은» 첫 로그를 채택한다.
 */
export function requirePreflightPass(port, { maxAgeMs = 30 * 60 * 1000, logFile = null } = {}) {
  const cands = logFile ? [{ file: logFile, mtime: fs.existsSync(logFile) ? fs.statSync(logFile).mtimeMs : 0 }]
                        : preflightLogs();
  if (!cands.length) {
    throw new HarnessError(
      'preflight 로그가 «하나도 없다» — 실행으로 인정하지 않는다.\n' +
      `  먼저 «별도 명령»으로: bash ~/.claude/skills/goditor-qa/tools/preflight.sh ${port} <ud이름> --standing N\n` +
      '  ⛔파이프로 받지 마라(`| tail` 은 $? 를 깨뜨린다). 종료코드를 «변수»에 담아 확인하라.');
  }
  const seen = [];
  for (const c of cands) {
    let txt; try { txt = fs.readFileSync(c.file, 'utf8'); } catch (_) { continue; }
    const passLine = txt.split('\n').reverse().find(l => l.includes('★PASS'));
    if (!passLine) continue;
    const m = passLine.match(/port=(\d+)/);
    const logPort = m ? Number(m[1]) : null;
    seen.push({ file: c.file, port: logPort, ageMin: Math.round((Date.now() - c.mtime) / 60000) });
    if (logPort !== port) continue;
    const ageMs = Date.now() - c.mtime;
    if (ageMs > maxAgeMs) {
      throw new HarnessError(
        `포트 ${port} 의 preflight 통과가 너무 낡았다(${Math.round(ageMs / 60000)}분 전) — ` +
        `그 사이 포트 상황이 바뀌었을 수 있다. 다시 돌려라.\n  log=${c.file}`);
    }
    return { log: c.file, port: logPort, ageMs, line: passLine.trim() };
  }
  throw new HarnessError(
    `포트 ${port} 의 preflight «통과»(★PASS) 로그가 없다 — 실행 금지.\n` +
    `  먼저 «별도 명령»으로: bash ~/.claude/skills/goditor-qa/tools/preflight.sh ${port} <ud이름> --standing N\n` +
    `  ⛔preflight 와 기동을 한 줄에 체인으로 묶지 마라. EX=$? 로 «변수»에 받아 확인하라.`,
    { 최근통과로그: seen.slice(0, 5) });
}

/** 종료 후 원본 무접촉 확인 — --check-origin 로그 줄을 읽는다. */
export function readOriginClean(logFile) {
  try {
    const t = fs.readFileSync(logFile, 'utf8');
    return { clean: t.includes('★ORIGIN-CLEAN'), file: logFile };
  } catch (_) { return { clean: null, file: logFile }; }
}
