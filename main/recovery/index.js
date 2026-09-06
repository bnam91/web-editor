/* ══════════════════════════════════════════════════════════════════════════
   main/recovery/index.js — 지난 실행의 «흔적»을 사용자가 쓸 수 있게 만든다. (H3, 2026-09-06)
   ──────────────────────────────────────────────────────────────────────────
   ★이 파일은 «새 규격을 만들지 않는다». 읽는 것 둘 다 이미 있다:
       ⑴ H2  require('../crash').readRecent(n) → [{file, at, kind, record}]  (새 것부터)
       ⑵ H4  require('../quit/save-guard').pendingFailures() → 마커의 handled=false 기록들
     여기가 하는 일은 셋뿐이다 — «모으기 · 도장 찍기 · 나갈 것 고르기».

   ★★가장 중요한 규율 — «나가는 것»과 «보이는 것»을 «구조로» 가른다
     이 단위는 크래시 기록을 신고에 실을 수 있게 만든다. 크래시 기록에는 렌더러 링버퍼
     사본(errors[])이 붙는다. 지금은 안전하지만(지디 전수조사 2026-09-06: js/ 의
     console.error 58곳 어디도 프로젝트 «본문»을 안 찍는다), ★위험은 «미래»다 —
     앞으로 누가 `console.error('...', block)` 을 쓰면 fmtArg 가 그걸 JSON.stringify 해서
     그 순간 본문이 링버퍼에 들어온다.
     ⇒ 그래서 이 파일은 두 가지를 «다른 함수»로 만든다:
         localItems(...)  화면에 보이는 것. 프로젝트 이름·비상 사본 경로가 «들어간다».
         reportLines(...) 서버로 나갈 수 있는 것. ★허용목록 투영이다 — 스냅샷 원문도,
                          비상 사본 «경로»도, 프로젝트 «이름»도 이 함수에 아예 «안 들어간다».
       두 함수는 인자가 다르다. 「깜빡하고 안 지웠다」가 성립할 수 없게 만든 것이다.
     ⇒ tests/unit/recovery-exposure.test.mjs 가 양성대조(비상 사본 안에 표식을 심고
       그 표식이 reportLines 어디에도 없는지)로 이걸 «기계로» 잰다.

   ★⛔자동 전송 금지. 이 파일에는 네트워크 호출이 «한 줄도» 없다.
     reportLines() 는 «문자열 배열»을 만들 뿐이고, 그걸 실제로 보내는 건 사용자가
     신고 창에서 [보내기] 를 누를 때뿐이다(js/report-modal.js 의 기존 경로).

   ★⛔비상 사본(emergency-saves/)은 «사용자 문서 본문 그 자체»다 — 자동 첨부 절대 금지.
     복구는 «로컬»에서 한다: recovery:restore(사본으로 되살리기) · recovery:reveal(파일 위치).

   ★도장(attachedAt) — 「한 번 처리한 기록은 다시 안 뜬다」
     · 읽히는 crash-*.json 은 «파일 안에» attachedAt 를 새긴다(H2 스키마가 비워 둔 자리).
     · ⛔도장을 찍었다고 원본을 «지우지 않는다» — 사용자가 나중에 다시 찾을 수 있어야 한다.
     · ★깨져서 못 읽는 파일(readRecent 가 error:'unreadable' 로 주는 것)은 «안에» 못 새긴다.
       그것만을 위해 곁장부(recovery-state.json)를 둔다. 곁장부는 «폴백»이지 정본이 아니다
       — 읽히는 파일의 정본은 언제나 파일 안의 attachedAt 다.
     · 저장 실패 마커는 H4 가 이미 handled 칸을 비워 뒀다(pendingFailures 가 그걸 거른다).
══════════════════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('fs');
const path = require('path');
/* ★H2 의 세척기를 «그대로» 쓴다 — 규칙을 여기 다시 쓰면 갈라지고, 갈라진 쪽은 아무도 안 본다
   (main/crash/scrub.js 헤더의 그 판단과 같다). 못 불러오면 둔한 쪽으로 fail-closed 된다. */
const { scrub } = require('../crash/scrub');

/** 한 번에 보는 크래시 기록 수. H2 의 MAX_FILES(20) 안쪽. */
const MAX_CRASH = 10;
/** 신고에 싣는 줄 수 상한. 서버 LIMITS.ERRORS 가 20 이고, 신고 창이 authDiag 한 줄을
 *  더 얹으며, 에디터에서 열면 렌더러 링버퍼도 함께 실린다 ⇒ 여유를 두고 16. */
const MAX_REPORT_LINES = 16;
/** 한 줄 길이 — 서버 LIMITS.ERR_LEN · js/report-buffer.js MAX_LEN 과 같은 수. */
const MAX_LINE_LEN = 1000;

let _dir = null;
let _crash = null;
let _guard = null;
let _log = () => {};

/**
 * @param {object} o
 * @param {string} o.userDataDir
 * @param {object} o.crash      main/crash (readRecent 만 쓴다)
 * @param {object} o.saveGuard  main/quit/save-guard (pendingFailures·readMarker·markerPath·emergencyDir)
 * @param {Function} [o.log]
 */
function init(o) {
  const opts = o || {};
  _dir = opts.userDataDir || null;
  _crash = opts.crash || null;
  _guard = opts.saveGuard || null;
  if (typeof opts.log === 'function') _log = opts.log;
  return { dir: _dir, hasCrash: !!_crash, hasGuard: !!_guard };
}

/* ── 곁장부 — «못 새긴» 파일만 여기 적는다 ──────────────────────────────── */
function ledgerPath() { return path.join(_dir, 'recovery-state.json'); }

function readLedger() {
  try {
    const j = JSON.parse(fs.readFileSync(ledgerPath(), 'utf8').replace(/^﻿/, ''));
    return (j && j.acked && typeof j.acked === 'object') ? j.acked : {};
  } catch (_) { return {}; }
}

function writeLedger(acked) {
  try {
    const p = ledgerPath();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const tmp = p + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({ v: 1, acked }, null, 2), 'utf8');
    fs.renameSync(tmp, p);                 // 원자적 — 반쪽 JSON 이 안 남는다
    return true;
  } catch (e) { _log('[recovery] 곁장부 쓰기 실패: ' + (e && e.message)); return false; }
}

/* ── 모으기 — «화면에 보이는» 쪽 ────────────────────────────────────────── */

/** 크래시 종류를 사람 말로. 모르는 kind 는 «그 값 그대로» 보여준다(빈칸으로 두면 뭘 받았는지 모른다). */
const CRASH_LABEL = {
  'render-process-gone': '편집 화면이 갑자기 종료됨',
  'child-process-gone': '보조 프로세스가 종료됨',
  'uncaught-exception': '앱 내부 오류',
  'unhandled-rejection': '앱 내부 오류(미처리 거부)',
  unresponsive: '앱이 한동안 응답하지 않음',
};

function crashLabel(kind) { return CRASH_LABEL[kind] || String(kind || '알 수 없는 사건'); }

/**
 * 지난 실행에서 남은 «아직 안 본» 것들. 새 것부터.
 * ⛔여기서 «지우지 않는다». 읽기만 한다.
 * @returns {{items:Array, counts:object, degraded:Array<string>}}
 */
function localItems() {
  const items = [];
  const degraded = [];
  const acked = readLedger();

  /* ⑴ 종료 시 저장 실패 — 이게 「잃은 것」의 본체다. 그래서 «먼저» 온다. */
  let failures = [];
  try { failures = (_guard && _guard.pendingFailures()) || []; }
  catch (e) { degraded.push('save-guard: ' + ((e && e.message) || e)); }
  for (const r of failures) {
    if (!r || !r.at) continue;
    let emergencyExists = false, emergencyBytes = null;
    if (r.emergencyPath) {
      try { const st = fs.statSync(r.emergencyPath); emergencyExists = st.isFile(); emergencyBytes = st.size; }
      catch (_) { emergencyExists = false; }
    }
    items.push({
      id: 'save:' + r.at,
      kind: 'save-failure',
      at: r.at,
      /* ★화면 전용 — 아래 reportLines() 에는 «안 넘어간다»(파일 헤더 참조) */
      projectName: r.projectName || null,
      projectId: r.projectId || null,
      emergencyPath: emergencyExists ? r.emergencyPath : null,
      emergencyExists,
      emergencyBytes,
      emergencyError: r.emergencyError || null,
      reason: r.reason || null,
      error: r.error || null,
      appVersion: r.appVersion || null,
    });
  }

  /* ⑵ 크래시 기록 */
  let recent = [];
  try { recent = (_crash && _crash.readRecent(MAX_CRASH)) || []; }
  catch (e) { degraded.push('crash: ' + ((e && e.message) || e)); }
  for (const e of recent) {
    if (!e || !e.file) continue;
    if (e.error === 'unreadable' || !e.record) {
      /* ★조용히 빼지 않는다 — 「기록 없음」으로 읽히면 그게 거짓말이다(H2 헤더의 그 자리). */
      if (acked[e.file]) continue;
      items.push({
        id: 'crash:' + e.file, kind: 'crash', at: null, file: e.file,
        unreadable: true, label: '읽을 수 없는 크래시 기록', crashKind: null,
        reason: null, appVersion: null, exitCode: null, errorLines: [],
      });
      continue;
    }
    if (e.record.attachedAt || acked[e.file]) continue;      // ★이미 처리한 것
    items.push({
      id: 'crash:' + e.file,
      kind: 'crash',
      at: e.at || e.record.at || null,
      file: e.file,
      unreadable: false,
      crashKind: e.record.kind || null,
      label: crashLabel(e.record.kind),
      reason: e.record.reason || null,
      exitCode: (typeof e.record.exitCode === 'number') ? e.record.exitCode : null,
      appVersion: e.record.appVersion || null,
      os: e.record.os || null,
      arch: e.record.arch || null,
      projectId: e.record.projectId || null,
      /* 렌더러 링버퍼 사본 — H2 가 이미 씻고 잘라 둔 것(항목당 1000자·20건). */
      /* 렌더러 링버퍼 사본 — H2 가 «쓸 때» 이미 씻고 잘랐다(항목당 1000자·20건).
         ⛔여기서 «또» 자르지 않는다. 겹겹이 자르면 나중에 「상한이 정말 도나」를 변이로 물었을 때
           한 겹을 빼도 다른 겹이 가려서 «검사가 초록으로 통과»한다(실측 2026-09-06: M18c 가
           그래서 안 잡혔다). 나가는 줄의 길이 상한은 아래 line() «한 자리»가 정본이다. */
      errorLines: Array.isArray(e.record.errors)
        ? e.record.errors.map((x) => ({
            at: String((x && x.at) || ''),
            level: String((x && x.level) || ''),
            msg: String((x && x.msg) || ''),
          }))
        : [],
    });
  }

  const counts = {
    total: items.length,
    saveFailures: items.filter((i) => i.kind === 'save-failure').length,
    crashes: items.filter((i) => i.kind === 'crash').length,
    restorable: items.filter((i) => i.kind === 'save-failure' && i.emergencyExists).length,
    unreadable: items.filter((i) => i.unreadable).length,
  };
  return { items, counts, degraded };
}

/* ── 나갈 것 고르기 — «허용목록 투영» ────────────────────────────────────
   ★★이 함수의 인자는 «항목 객체»가 아니라 «고른 값들»이다. 스냅샷도, 비상 사본 경로도,
     프로젝트 이름도 여기까지 «오지 않는다». 그래서 「깜빡하고 안 지웠다」가 성립하지 않는다.
   ⛔이 함수를 「item 을 통째로 받아서 몇 개 지운다」로 바꾸지 마라 — 그 순간 새 필드가
     생길 때마다 조용히 새 나간다. 지금 모양이 그걸 막는 유일한 장치다. */

function line(at, level, msg) {
  /* ★★나가는 «모든» 줄이 여기 한 자리를 지난다 — 그래서 세척도 여기서 «한 번만» 한다.
     ⛔부르는 쪽마다 씻게 만들면 반드시 한 군데를 빠뜨린다.

     ★이 세척은 «추정»이 아니라 실측으로 들어왔다(2026-09-06, H4 러너의 진짜 산출물):
       H4 의 마커 error 는 Node 의 EACCES 원문이라
         "EACCES: permission denied, mkdir '/Users/<실명>/…/projects/proj_…'"
       처럼 «홈 경로가 통째로» 들어 있다. H2 는 자기 기록만 씻고 H4 는 안 씻는다
       ⇒ 여기서 안 씻으면 사용자 계정 이름이 신고로 나간다.
       합성 기록으로 짠 검사는 이걸 «초록으로 통과시켰다» — 진짜 산출물이 잡았다
       (tests/unit/recovery-live-artifact.test.mjs U-H3-L5). */
  return {
    at: String(at || new Date().toISOString()),
    level: String(level || 'crash').slice(0, 20),
    msg: scrub(String(msg == null ? '' : msg)).slice(0, MAX_LINE_LEN),
  };
}

/**
 * 신고에 실을 줄들. ★사용자가 «보내기»를 누르기 전엔 아무 데도 안 간다.
 * @param {Array} items localItems().items
 * @returns {Array<{at:string, level:string, msg:string}>}
 */
function reportLines(items) {
  const out = [];
  for (const it of (items || [])) {
    if (!it) continue;
    if (out.length >= MAX_REPORT_LINES) break;

    if (it.kind === 'save-failure') {
      /* ★허용목록 — 시각·사유·오류문구·버전, 그리고 «사본이 있었나»는 참/거짓 «한 글자»만.
         ⛔projectName(고객사 페이지 제목일 수 있다)·emergencyPath(홈 경로+프로젝트 id)는 안 넘긴다. */
      out.push(line(it.at, 'quit-save',
        '[종료 시 저장 실패] reason=' + (it.reason || '?') +
        ' error=' + (it.error || '-') +
        ' v=' + (it.appVersion || '?') +
        ' emergencyCopy=' + (it.emergencyExists ? 'yes' : 'no')));
      continue;
    }

    if (it.kind === 'crash') {
      if (it.unreadable) {
        out.push(line(null, 'crash', '[크래시 기록] 파일을 읽을 수 없음(손상)'));
        continue;
      }
      out.push(line(it.at, 'crash',
        '[크래시] kind=' + (it.crashKind || '?') +
        ' reason=' + (it.reason || '-') +
        (it.exitCode == null ? '' : ' exit=' + it.exitCode) +
        ' v=' + (it.appVersion || '?') +
        ' os=' + (it.os || '?') + ' ' + (it.arch || '?')));
      /* 크래시 직전 렌더러가 남긴 줄 — 원인을 아는 «유일한» 단서다.
         H2 가 이미 씻어 둔 것이고, 사용자가 [보낼 내용 그대로 보기]에서 «전부» 본다. */
      for (const e of (it.errorLines || [])) {
        if (out.length >= MAX_REPORT_LINES) break;
        out.push(line(e.at, 'crash-log', e.msg));
      }
    }
  }
  /* ⛔여기서 또 slice 하지 않는다 — 상한은 위 두 break «한 벌»이 정본이다.
     중복 방어를 두면 변이 검사가 「상한을 빼도 초록」이 돼서 상한이 «진짜로» 도는지 영영 못 잰다. */
  return out;
}

/* ── 도장 ────────────────────────────────────────────────────────────────
   ⛔원본을 지우지 않는다. crash-*.json 은 attachedAt 한 칸만 «더한다».
   ⛔마커도 지우지 않는다. records[].handled 만 true 로 바꾼다(H4 가 비워 둔 칸). */

/**
 * @param {Array<string>} ids localItems().items 의 id ('crash:<file>' | 'save:<iso>')
 * @param {string} [nowIso]
 * @returns {{stamped:number, failed:Array<{id:string, why:string}>, ledgerUsed:number}}
 */
function ack(ids, nowIso) {
  const at = nowIso || new Date().toISOString();
  const list = Array.isArray(ids) ? ids : [];
  const failed = [];
  let stamped = 0, ledgerUsed = 0;

  /* ⑴ 크래시 파일 — 파일 안에 새긴다. 못 새기면 곁장부로 간다. */
  const crashFiles = list.filter((s) => typeof s === 'string' && s.startsWith('crash:'))
    .map((s) => s.slice(6))
    .filter((n) => /^crash-\d+\.json$/.test(n));      // ★경로 조작 차단 — 이름 모양을 그대로 검사
  if (crashFiles.length) {
    const dir = path.join(_dir, 'logs');
    const acked = readLedger();
    let ledgerDirty = false;
    for (const name of crashFiles) {
      const p = path.join(dir, name);
      let ok = false;
      try {
        const rec = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (rec && typeof rec === 'object') {
          rec.attachedAt = at;                       // ★H2 가 비워 둔 칸을 여기서 채운다
          const tmp = p + '.tmp';
          fs.writeFileSync(tmp, JSON.stringify(rec), 'utf8');
          fs.renameSync(tmp, p);                     // 원자적
          ok = true;
        }
      } catch (_) { ok = false; }
      if (ok) { stamped++; continue; }
      /* 못 읽거나 못 쓴다(깨진 파일·읽기전용) — 곁장부에 적어 «다시 안 뜨게» 한다.
         ⛔파일은 그대로 둔다. 도장은 「다시 안 띄운다」는 뜻이지 「지운다」가 아니다. */
      acked[name] = at; ledgerDirty = true; ledgerUsed++; stamped++;
    }
    if (ledgerDirty) {
      if (!writeLedger(pruneLedger(acked))) failed.push({ id: 'ledger', why: 'write-failed' });
    }
  }

  /* ⑵ 저장 실패 마커 — handled 만 켠다. */
  const saveAts = new Set(list.filter((s) => typeof s === 'string' && s.startsWith('save:')).map((s) => s.slice(5)));
  if (saveAts.size) {
    try {
      const p = _guard.markerPath();
      const j = JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''));
      let touched = 0;
      for (const r of (j.records || [])) {
        if (r && saveAts.has(r.at) && !r.handled) { r.handled = true; r.handledAt = at; touched++; }
      }
      if (touched) {
        const tmp = p + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(j, null, 2), 'utf8');
        fs.renameSync(tmp, p);
      }
      stamped += touched;
    } catch (e) {
      failed.push({ id: 'marker', why: (e && e.message) || 'write-failed' });
    }
  }

  return { stamped, failed, ledgerUsed };
}

/** 곁장부가 무한히 자라지 않게 — 이미 사라진 파일 이름은 뺀다. */
function pruneLedger(acked) {
  const out = {};
  const dir = path.join(_dir, 'logs');
  for (const name of Object.keys(acked)) {
    try { if (fs.existsSync(path.join(dir, name))) out[name] = acked[name]; } catch (_) {}
  }
  return out;
}

/* ── 비상 사본 경로 검증 — 렌더러가 준 경로를 «그대로 믿지 않는다» ────────
   ★렌더러는 우리가 방금 준 경로를 되돌려 보내지만, IPC 는 누구나 부를 수 있는 문이다.
     emergency-saves/ «안»의 .json 이 아니면 거절한다. */
function resolveEmergencyPath(p) {
  try {
    if (!p || typeof p !== 'string') return null;
    const base = path.resolve(_guard.emergencyDir());
    const abs = path.resolve(p);
    if (abs !== path.join(base, path.basename(abs))) return null;   // 하위 폴더·상위 탈출 모두 거절
    if (!/\.json$/i.test(abs)) return null;
    if (!fs.existsSync(abs)) return null;
    return abs;
  } catch (_) { return null; }
}

/** 비상 사본을 읽어 «객체»로. ⛔이 값은 절대 신고로 안 간다 — 로컬 복구에만 쓴다. */
function readEmergencySnapshot(p) {
  const abs = resolveEmergencyPath(p);
  if (!abs) return { ok: false, reason: 'not_found' };
  try {
    const raw = fs.readFileSync(abs, 'utf8');
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return { ok: false, reason: 'corrupt' };
    return { ok: true, path: abs, data, bytes: Buffer.byteLength(raw, 'utf8') };
  } catch (e) {
    return { ok: false, reason: 'corrupt', error: (e && e.message) || String(e) };
  }
}

module.exports = {
  init, localItems, reportLines, ack,
  resolveEmergencyPath, readEmergencySnapshot,
  crashLabel,
  MAX_CRASH, MAX_REPORT_LINES, MAX_LINE_LEN,
  _ledgerPath: ledgerPath,
};
