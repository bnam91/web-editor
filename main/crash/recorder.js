/* ══════════════════════════════════════════════════════════════════════════
   main/crash/recorder.js — 크래시·메인오류를 «로컬에» 남긴다. (H2, 2026-09-06)
   ──────────────────────────────────────────────────────────────────────────
   ★고치기 전의 실측(지디): main.js·main/ 어디에도 render-process-gone ·
     child-process-gone · uncaughtException 핸들러가 «하나도 없다». 렌더러가 죽으면
     사용자는 「앱이 갑자기 사라졌다」만 겪고, 우리는 왜 죽었는지 영영 모른다.
     ⇒ 이 파일이 남기는 목표는 딱 하나다: «다음 실행 때 우리가 읽을 수 있는 흔적».

   ★기록처 = <userData>/logs/  — 프로젝트 데이터와 «섞이지 않는다»
     · <userData>/projects/ 와 형제다. 여기가 통째로 깨지거나 지워져도 프로젝트
       로드 경로는 이 폴더를 «읽지 않는다» ⇒ 앱 시작에 영향이 없다.
     · crash-<epoch>.json  한 사건 = 한 파일. 한 파일이 깨져도 나머지는 읽힌다
       (한 파일에 append 하면 반쪽 줄 하나가 전체를 못 읽게 만든다).
     · main.log            메인 프로세스가 «스스로 말한 것»(warn/error). 크래시가 아닌
       고장(저장 실패·복구)은 여기에만 남는다.
     ⇒ 이 이름·모양은 내 취향이 아니다. tools/hardening/judge/crashlog.mjs 가
       ★이미 이 규약(`/^crash-\d+\.json$/` · 필수 5필드 · logs/main.log)으로 «잰다».

   ★기록이 실패해도 앱은 계속 산다. 그러나 «삼키지는» 않는다
     크래시 기록 코드가 크래시를 만들면 최악이다 ⇒ 전부 try/catch.
     ⛔단, catch(_){} 로 끝내지 않는다 — 삼킨 «횟수와 첫 사유»를 셋에 남긴다:
       ⑴ stats().swallowed (IPC·H3 가 읽는다)  ⑵ stderr 한 줄  ⑶ «다음» 기록의 recorder 필드.
     오늘 이 프로젝트에서 「오류를 삼키는 코드 = 그 위 모든 판정이 거짓말」로 세 번 오진했다.

   ★상한 — 무한히 쌓지 않되, «최신»을 지우지 않는다
     파일 20개 · 세션당 50건 · 같은 사건 3초 중복억제 · main.log 512KB(회전 1세대).
     ⛔버리는 방향은 «오래된 것»이다. 크래시 루프에서 마지막 크래시가 제일 중요하다.

   ★PII — 무엇이 죽었는지는 «내용 없이도» 적을 수 있다
     문서 본문·프로젝트 본문·이메일은 «담지 않는다». 담는 건 종류·사유·종료코드·
     버전·OS·아키텍처, 그리고 이미 씻긴 렌더러 오류 줄뿐이다. 메인이 만든 문장은
     scrub.js 로 씻어서 넣는다(홈 경로·에셋 파일명·data: 페이로드).
══════════════════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { scrub, source: scrubSource } = require('./scrub');

const MAX_FILES        = 20;              // 남겨 두는 crash-*.json 개수
const MAX_PER_SESSION  = 50;              // 한 실행이 만들 수 있는 기록 수(크래시 루프 방어)
const DEDUPE_MS        = 3000;            // 같은 kind+reason 이 이 안에 또 오면 안 쓴다
const MAIN_LOG_MAX     = 512 * 1024;      // main.log 상한. 넘으면 main.log.1 로 회전
const MAX_MIRRORS      = 8;               // 창별 링버퍼 사본 보관 수
const MAX_ERR_LINES    = 20;              // 미러 한 벌의 줄 수(렌더러 MAX 와 같은 수)
const MAX_ERR_LEN      = 1000;            // 한 줄 길이(렌더러 MAX_LEN 과 같은 수)

let _opts = null;                          // { getUserDataDir, appVersion, now }
let _sessionCount = 0;
const _lastAt = new Map();                 // "kind|reason" → epoch ms
const _mirrors = new Map();                // webContentsId → { errors, at, projectId }
let _inSwallow = false;
let _inMainLog = false;

const _self = { swallowed: 0, first: null, firstAt: null, last: null, lastAt: null };

/* ── 삼킨 사실을 «남기는» 자리 ────────────────────────────────────────────
   여기서 console.* 를 부르지 않는다 — install() 이 console 을 후킹하므로 재귀가 된다.
   process.stderr.write 는 후킹 대상이 아니다. */
function swallow(where, err) {
  if (_inSwallow) return;
  _inSwallow = true;
  try {
    const msg = where + ': ' + ((err && err.message) || String(err));
    _self.swallowed++;
    if (!_self.first) { _self.first = msg; _self.firstAt = new Date().toISOString(); }
    _self.last = msg; _self.lastAt = new Date().toISOString();
    try { process.stderr.write('[crash-recorder] 기록 실패(삼킴 ' + _self.swallowed + '): ' + msg + '\n'); } catch (_) {}
  } catch (_) {
    /* 삼킴 회계 자체가 죽어도 앱은 산다 — 여기까지 왔으면 더 할 수 있는 게 없다 */
  } finally {
    _inSwallow = false;
  }
}

function now() { return (_opts && _opts.now ? _opts.now() : Date.now()); }

/** logs 폴더. 없으면 만든다. 못 만들면 null — 부르는 쪽이 «조용히» 넘어간다. */
function logsDir({ create = true } = {}) {
  try {
    const ud = _opts && _opts.getUserDataDir && _opts.getUserDataDir();
    if (!ud) return null;
    const d = path.join(ud, 'logs');
    if (create) fs.mkdirSync(d, { recursive: true });
    return d;
  } catch (e) { swallow('logsDir', e); return null; }
}

/* ── 미러: 렌더러 링버퍼의 사본 ────────────────────────────────────────────
   ★왜 «메인»이 들고 있어야 하나 — 렌더러가 죽으면 링버퍼도 같이 죽는다. 크래시가 난
     «뒤에» 물어보는 건 불가능하다. 그래서 살아 있는 동안 계속 보내오게 하고, 크래시
     기록엔 «마지막으로 받은 사본»을 붙인다. errorsAsOf 가 그 사본의 시각이다.
   ⚠️들어오는 문자열은 이미 렌더러가 씻은 것이지만, 여기서 한 번 더 씻는다 —
     구버전 렌더러·다른 경로로 들어온 문자열을 믿지 않는다. */
function mirror(payload, wcId) {
  try {
    const p = payload || {};
    const errors = (Array.isArray(p.errors) ? p.errors : []).slice(-MAX_ERR_LINES).map((e) => ({
      at: String((e && e.at) || ''),
      level: String((e && e.level) || '').slice(0, 20),
      msg: scrub(String((e && e.msg) || '')).slice(0, MAX_ERR_LEN),
    }));
    const id = Number.isFinite(wcId) ? wcId : 0;
    _mirrors.set(id, {
      errors,
      at: Number(p.at) || now(),
      projectId: String(p.projectId || '').slice(0, 64),
    });
    while (_mirrors.size > MAX_MIRRORS) _mirrors.delete(_mirrors.keys().next().value);  // ★오래된 것부터
    return true;
  } catch (e) { swallow('mirror', e); return false; }
}

function pickMirror(wcId) {
  if (Number.isFinite(wcId) && _mirrors.has(wcId)) return _mirrors.get(wcId);
  let best = null;
  for (const m of _mirrors.values()) if (!best || m.at > best.at) best = m;
  return best;
}

/* ── crash-*.json 쓰기 ──────────────────────────────────────────────────── */
function pruneOld(dir) {
  try {
    const files = fs.readdirSync(dir)
      .filter((n) => /^crash-\d+\.json$/.test(n))
      .map((n) => ({ n, ts: parseInt(n.slice(6), 10) }))
      .sort((a, b) => a.ts - b.ts);                         // 오래된 것이 앞
    while (files.length > MAX_FILES) {
      const victim = files.shift();                          // ★앞(=오래된 것)만 버린다
      try { fs.unlinkSync(path.join(dir, victim.n)); } catch (_) {}
    }
  } catch (e) { swallow('pruneOld', e); }
}

/** 겹치지 않는 파일명. 판정기 정규식(`crash-<숫자>.json`)을 깨지 않게 «숫자만» 늘린다. */
function freeName(dir, ts) {
  let t = ts;
  for (let i = 0; i < 1000; i++) {
    const p = path.join(dir, 'crash-' + t + '.json');
    if (!fs.existsSync(p)) return p;
    t++;
  }
  return path.join(dir, 'crash-' + (ts + 1000) + '.json');
}

/**
 * 사건 하나를 기록한다. ⛔절대 던지지 않는다.
 * @param {string} kind   'render-process-gone' | 'child-process-gone' | 'uncaught-exception' |
 *                        'unhandled-rejection' | 'unresponsive' | 그 밖에 부르는 쪽이 정한 이름
 * @param {object} [info] { reason, exitCode, main, wcId, projectId, extra }
 * @returns {{written:boolean, file:string|null, reason:string|null}}
 */
function record(kind, info) {
  try {
    const i = info || {};
    const t = now();

    // ⑴ 세션 상한 — 크래시 루프가 디스크를 먹지 못하게. 「막았다」는 사실을 남긴다.
    if (_sessionCount >= MAX_PER_SESSION) {
      swallow('record', new Error('세션 기록 상한 ' + MAX_PER_SESSION + ' 도달 — kind=' + kind));
      return { written: false, file: null, reason: 'session_cap' };
    }
    // ⑵ 중복 억제 — 같은 사건이 연달아 터질 때(GPU 재시작 루프 등)
    const key = String(kind) + '|' + String(i.reason || '');
    const prev = _lastAt.get(key);
    if (prev != null && t - prev < DEDUPE_MS) return { written: false, file: null, reason: 'deduped' };

    const dir = logsDir();
    if (!dir) return { written: false, file: null, reason: 'no_logs_dir' };

    const mir = pickMirror(i.wcId);
    const rec = {
      /* 필수 5 — judge/crashlog.mjs CRASH_SCHEMA.required */
      at: new Date(t).toISOString(),
      kind: String(kind),
      appVersion: String((_opts && _opts.appVersion) || ''),
      os: process.platform + ' ' + os.release(),
      arch: process.arch,
    };
    if (i.reason != null) rec.reason = scrub(String(i.reason)).slice(0, 200);
    if (i.exitCode != null && Number.isFinite(Number(i.exitCode))) rec.exitCode = Number(i.exitCode);
    if (i.main) rec.main = scrub(String(i.main)).slice(0, 4000);      // 메인 스택 — 씻어서
    const projectId = String(i.projectId || (mir && mir.projectId) || '');
    if (projectId) rec.projectId = projectId.slice(0, 64);
    if (mir && mir.errors && mir.errors.length) {
      rec.errors = mir.errors;                                        // ★렌더러 링버퍼 사본
      rec.errorsAsOf = mir.at;                                        //   그 사본의 시각
    }
    if (i.extra && typeof i.extra === 'object') {
      // 부르는 쪽이 주는 «구조화된 부속». 값은 문자열로 씻어 넣는다(객체 통째로 안 넣는다).
      rec.extra = {};
      for (const k of Object.keys(i.extra).slice(0, 12)) {
        rec.extra[String(k).slice(0, 40)] = scrub(String(i.extra[k])).slice(0, 300);
      }
    }
    /* ★삼킨 사실이 «기록 안에» 실린다 — 셋 중 세 번째 자리(파일 헤더 참조). */
    rec.recorder = {
      swallowed: _self.swallowed,
      firstSwallow: _self.first,
      scrub: scrubSource().source,
      session: _sessionCount + 1,
    };

    const file = freeName(dir, t);
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(rec), 'utf8');
    fs.renameSync(tmp, file);                                          // 원자적 — 반쪽 JSON 이 안 남는다
    _sessionCount++;
    _lastAt.set(key, t);
    pruneOld(dir);
    return { written: true, file, reason: null };
  } catch (e) {
    swallow('record(' + kind + ')', e);
    return { written: false, file: null, reason: 'error' };
  }
}

/* ── main.log — 메인이 «스스로 말한 것» ─────────────────────────────────── */
function appendMainLog(level, msg) {
  if (_inMainLog) return false;
  _inMainLog = true;
  try {
    const dir = logsDir();
    if (!dir) return false;
    const p = path.join(dir, 'main.log');
    const line = new Date(now()).toISOString() + ' [' + String(level).slice(0, 10) + '] ' +
                 scrub(String(msg)).replace(/\s+$/, '').slice(0, MAX_ERR_LEN) + '\n';
    /* 회전 — 넘치면 «지금 것»을 main.log.1 로 옮기고 새로 시작한다.
       ⛔최신을 지우는 방향이 아니다: 지워지는 건 «지지난» 세대(main.log.1)뿐이다. */
    let size = 0;
    try { size = fs.statSync(p).size; } catch (_) {}
    if (size + Buffer.byteLength(line) > MAIN_LOG_MAX) {
      /* ⚠️윈도우는 rename 이 «기존 파일을 안 덮는다»(EEXIST) — 지우고 옮겨야 한다.
         안 그러면 두 번째 회전부터 조용히 실패해서 main.log 가 무한히 자란다.
         (POSIX 는 덮으므로 맥에선 증상이 «안 보인다» — 그래서 여기 적어 둔다.) */
      try { fs.unlinkSync(p + '.1'); } catch (_) {}
      try { fs.renameSync(p, p + '.1'); } catch (_) {}
    }
    fs.appendFileSync(p, line, 'utf8');
    return true;
  } catch (e) { swallow('appendMainLog', e); return false; }
  finally { _inMainLog = false; }
}

/* ── 읽는 쪽 — H3(신고 첨부)가 이어받는 자리 ───────────────────────────── */
/**
 * 최근 기록을 «새 것부터» 준다. H3 는 이걸 읽어서 신고에 붙이면 된다.
 * ⛔읽기가 기록을 «바꾸지 않는다»(attachedAt 도장은 H3 의 몫이고, 여기선 안 찍는다).
 * @returns {Array<{file:string, at:string, kind:string, record:object}>}
 */
function readRecent(limit) {
  const out = [];
  try {
    const dir = logsDir({ create: false });
    if (!dir) return out;
    let names = [];
    try { names = fs.readdirSync(dir); } catch (_) { return out; }
    const files = names.filter((n) => /^crash-\d+\.json$/.test(n))
      .map((n) => ({ n, ts: parseInt(n.slice(6), 10) }))
      .sort((a, b) => b.ts - a.ts)                                     // 새 것이 앞
      .slice(0, Math.max(1, Math.min(Number(limit) || 5, MAX_FILES)));
    for (const f of files) {
      try {
        const rec = JSON.parse(fs.readFileSync(path.join(dir, f.n), 'utf8'));
        out.push({ file: f.n, at: rec.at || null, kind: rec.kind || null, record: rec });
      } catch (e) {
        /* 한 파일이 깨져도 나머지는 준다. «깨졌다»는 사실도 같이 준다 — 조용히 빠지면
           H3 가 「기록이 없다」로 읽는다. */
        out.push({ file: f.n, at: null, kind: null, record: null, error: 'unreadable' });
      }
    }
  } catch (e) { swallow('readRecent', e); }
  return out;
}

/** 지금 상태. ★swallowed 가 0 이 아니면 «기록이 새고 있다»는 뜻이다. */
function stats() {
  const s = {
    dir: null, files: 0, mainLogBytes: -1,
    sessionRecords: _sessionCount, maxFiles: MAX_FILES, maxPerSession: MAX_PER_SESSION,
    mirrors: _mirrors.size,
    swallowed: _self.swallowed, firstSwallow: _self.first, lastSwallow: _self.last,
    scrub: scrubSource().source, scrubError: scrubSource().error,
  };
  try {
    const dir = logsDir({ create: false });
    s.dir = dir;
    if (dir) {
      let names = [];
      try { names = fs.readdirSync(dir); } catch (_) { names = []; }
      s.files = names.filter((n) => /^crash-\d+\.json$/.test(n)).length;
      try { s.mainLogBytes = fs.statSync(path.join(dir, 'main.log')).size; } catch (_) {}
    }
  } catch (e) { swallow('stats', e); }
  return s;
}

/** @param {{getUserDataDir:Function, appVersion?:string, now?:Function}} o */
function init(o) {
  _opts = {
    getUserDataDir: (o && o.getUserDataDir) || (() => null),
    appVersion: (o && o.appVersion) || '',
    now: o && o.now,
  };
  return stats();
}

/** 테스트 전용 — 세션 상태를 되돌린다(파일은 안 건드린다). */
function _resetForTest() {
  _sessionCount = 0; _lastAt.clear(); _mirrors.clear();
  _self.swallowed = 0; _self.first = null; _self.firstAt = null; _self.last = null; _self.lastAt = null;
}

module.exports = {
  init, record, mirror, appendMainLog, readRecent, stats,
  MAX_FILES, MAX_PER_SESSION, DEDUPE_MS, MAIN_LOG_MAX,
  _resetForTest,
};
