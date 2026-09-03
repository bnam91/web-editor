/* ═══════════════════════════════════════════════════════════════════════════
   main/notice/index.js — 운영자 공지(Unit C)의 main 프로세스 쪽 전부.
   ───────────────────────────────────────────────────────────────────────────
   main.js 에는 require + init() 두 줄만 남긴다(collab 과 같은 규약).

   ★왜 «main» 인가 — 렌더러가 아니라
     ⒜ 읽음 기록이 «파일»이다(현빈 확정). localStorage 는 창마다 따로라 앱을 두 개 띄우면
        같은 공지가 두 번 뜬다. 파일은 main 만 안전하게 만진다.
     ⒝ sessionToken 은 렌더러에 «절대» 안 준다(collab 과 같은 이유). 등급(plan) 기반 공지를
        서버가 확인하려면 토큰을 헤더로 보내야 하는데, 그 일은 여기서만 한다.
     ⒞ 렌더러는 CSP 로 외부 호출이 막혀 있다.

   ★폴링이다. 푸시가 아니다(PLAN §1) — «즉시성 포기»를 여기 적어 둔다.
     주기 30분. 근거는 아래 POLL_MS 주석.

   ★두 주소를 부른다 (G1 서버 계약)
     정본  GET /api/notice/current
     예비  GET /api/license/notice-current   ← EC2 어댑터 패치가 «안 실린» 배포에서 정본이 404 다.
     한 번 통한 주소는 기억한다(매 폴링마다 404 를 파지 않는다).

   ★서버가 죽어도 앱은 아무 일 없어야 한다
     오프라인·404·5xx·깨진 JSON — 전부 조용히 지나간다. 콘솔에 빨간 줄을 남기지 않는다
     (사용자 콘솔에 매 30분 에러가 쌓이면 진짜 버그가 안 보인다).
═══════════════════════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');
const { API_BASE } = require('../../services/authService');

/* ── 시간 상수 ───────────────────────────────────────────────────────────────
 * POLL_MS = 30분. 왜 30분인가:
 *   · 상한: 「긴급」이 의미를 가지려면 «오늘 안»이 아니라 «한 시간 안»에는 닿아야 한다.
 *     1시간 주기면 최악 59분이 뜨고, 그건 긴급이 아니다.
 *   · 하한: 서버는 EC2 단일 인스턴스 + Mongo 다. 5분 주기면 사용자 1인당 하루 288회,
 *     사용자 1000명이면 초당 3.3회가 «아무 일 없을 때도» 계속 돈다. 공지는 하루에 한 번
 *     생길까 말까 한 데이터라 그 비용이 전부 헛돈다.
 *   · 30분 = 사용자 1000명 기준 0.55 req/s. 무시할 수 있고, 최악 지연 30분이다.
 *   · 그리고 «앱을 켤 때»는 항상 즉시 한 번 묻는다(renderer hello). 실제 체감 지연은
 *     대부분 0 이다 — 공지는 보통 사람이 앱을 새로 켤 때 만난다. */
const POLL_MS = 30 * 60 * 1000;
/** 연속 실패 시 주기를 2배씩 늘린다(서버가 죽었을 때 몰려가지 않게). 상한 2시간. */
const MAX_BACKOFF_MS = 2 * 60 * 60 * 1000;
const TIMEOUT_MS = 8000;
/** 렌더러가 hello() 할 때, 이보다 최근에 폴링했으면 다시 안 부른다(페이지 이동마다 요청 방지). */
const HELLO_FRESH_MS = 60 * 1000;

/* ── 읽음 기록 파일 ──────────────────────────────────────────────────────────
 * userData/notice-seen.json
 *   { v:1, notices: { "<id>": { acked:bool, shown:int, at:"ISO" } } }
 * ★무한히 자라지 않게: 항목 상한 MAX_ENTRIES(오래된 것부터 버림) + RETAIN_DAYS 초과분 삭제.
 *   서버 공지는 최대 1년 기간이라(notice-lib MAX_PERIOD_MS), 400일 지난 기록은 다시 뜰 일이 없다. */
const MAX_ENTRIES = 100;
const RETAIN_DAYS = 400;
/** 「보기」를 안 눌러도 이 횟수만큼 토스트를 보여줬으면 그만 조른다(A-d 의 반대편 균형). */
const MAX_TOAST_SHOWS = 3;

let _deps = {
  /** @returns {{email:string, plan:string, sessionToken:string}|null} */
  readAuth: () => null,
  /** @returns {string} 앱 버전 */
  getVersion: () => '',
  /** @returns {import('electron').BrowserWindow[]} */
  getWindows: () => [],
};

let _statePath = null;
let _timer = null;
let _lastPollAt = 0;
let _failStreak = 0;
let _pathIdx = 0;                 // 0 = 정본, 1 = 예비. 통한 쪽을 기억한다.
let _polling = false;
/** 이 «앱 실행» 동안 이미 렌더러로 내보낸 공지 id. 30분 폴링이 같은 것을 또 띄우지 않게. */
const _sessionShown = new Set();
/** 마지막으로 서버가 준 공지(렌더러가 페이지를 옮겼을 때 hello() 로 다시 받아갈 수 있게). */
let _current = null;

const PATHS = ['/api/notice/current', '/api/license/notice-current'];

/* ── 상태 파일 ────────────────────────────────────────────────────────────── */

function readState() {
  try {
    if (!_statePath || !fs.existsSync(_statePath)) return { v: 1, notices: {} };
    const raw = JSON.parse(fs.readFileSync(_statePath, 'utf8').replace(/^﻿/, ''));
    if (!raw || typeof raw !== 'object' || !raw.notices || typeof raw.notices !== 'object') {
      return { v: 1, notices: {} };
    }
    return { v: 1, notices: raw.notices };
  } catch (_) {
    // ★D-f: 파일이 깨졌거나 사람이 지웠으면 «빈 상태»로 시작한다. 앱은 죽지 않는다.
    //   결과는 「공지가 한 번 더 뜬다」 — 데이터 손실이 아니다.
    return { v: 1, notices: {} };
  }
}

/** 오래된 기록을 버린다. ⒜ 보존기간 초과 ⒝ 개수 상한(오래된 것부터). */
function prune(notices) {
  const cutoff = Date.now() - RETAIN_DAYS * 24 * 3600 * 1000;
  const rows = Object.entries(notices)
    .map(([id, v]) => [id, v, Date.parse(v && v.at) || 0])
    .filter(([, , t]) => t >= cutoff);
  rows.sort((a, b) => b[2] - a[2]);                 // 최근 것이 앞
  const kept = {};
  for (const [id, v] of rows.slice(0, MAX_ENTRIES)) kept[id] = v;
  return kept;
}

function writeState(state) {
  try {
    const next = { v: 1, notices: prune(state.notices || {}) };
    fs.writeFileSync(_statePath, JSON.stringify(next), 'utf8');
    return next;
  } catch (e) {
    // 못 써도 앱은 돈다. 다음 실행에 공지가 한 번 더 뜰 뿐이다.
    console.warn('[notice] 읽음 기록 저장 실패:', e && e.message);
    return state;
  }
}

/** 서버에 「이건 이미 봤다」고 알릴 id 목록. ★acked 만 보낸다 —
 *  토스트만 스쳐 지나간(아직 안 읽은) 공지를 seen 에 실으면 서버가 다음 것을 주고,
 *  그 공지는 사용자가 영영 못 본다. */
function ackedIds(state) {
  return Object.entries(state.notices)
    .filter(([, v]) => v && v.acked)
    .sort((a, b) => (Date.parse(b[1].at) || 0) - (Date.parse(a[1].at) || 0))
    .map(([id]) => id)
    .slice(0, 50);                                  // 서버 MAX_SEEN 과 같은 상한(URL 을 밀지 않게)
}

/* ── 서버 호출 ────────────────────────────────────────────────────────────── */

async function fetchNotice() {
  const auth = _deps.readAuth() || {};
  const state = readState();
  const q = new URLSearchParams({
    app: 'goditor',
    appVersion: String(_deps.getVersion() || ''),
    plan: String(auth.plan || ''),
  });
  const seen = ackedIds(state);
  if (seen.length) q.set('seen', seen.join(','));

  const headers = {};
  // ⛔토큰을 «쿼리»에 싣지 마라 — nginx 액세스로그에 그대로 남는다(G1 계약서 경고).
  if (auth.sessionToken) headers['x-session-token'] = auth.sessionToken;

  // 통했던 주소를 먼저, 그 다음 나머지.
  const order = _pathIdx === 0 ? [0, 1] : [1, 0];
  let sawAnswer = false;

  for (const idx of order) {
    const url = `${API_BASE}${PATHS[idx]}?${q.toString()}`;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    let res;
    try {
      res = await fetch(url, { method: 'GET', headers, signal: ctl.signal });
    } catch (_) {
      clearTimeout(timer);
      continue;                                     // 오프라인·타임아웃 → «판단 불가». 조용히.
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 404) continue;               // ★이 주소가 이 배포엔 없다 → 다음 주소로.
    sawAnswer = true;
    if (!res.ok) break;                             // 5xx 는 «서버가 말은 했다» → 재시도는 다음 주기에.
    let json = null;
    try { json = await res.json(); } catch (_) { json = null; }
    if (!json || json.ok !== true) break;
    _pathIdx = idx;                                 // 통한 주소를 기억한다.
    return { ok: true, notice: json.notice || null, serverNow: json.serverNow || new Date().toISOString() };
  }
  return { ok: false, spoke: sawAnswer };
}

/* ── 배달 ─────────────────────────────────────────────────────────────────── */

function targetWindows() {
  let wins = [];
  try { wins = (_deps.getWindows() || []).filter((w) => w && !w.isDestroyed()); } catch (_) { wins = []; }
  if (!wins.length) return [];
  const focused = wins.find((w) => { try { return w.isFocused(); } catch (_) { return false; } });
  return focused ? [focused] : [wins[0]];           // ★한 창에만. 두 창에 보내면 같은 공지가 두 번 뜬다.
}

/** 공지 1건을 렌더러로 내보낸다. 이미 이 실행에서 내보냈으면 아무것도 안 한다. */
function deliver(payload) {
  const n = payload && payload.notice;
  if (!n || !n.id) return false;
  const state = readState();
  const rec = state.notices[n.id];
  if (rec && rec.acked) return false;               // 이미 확인한 공지 — 서버가 또 줘도 안 띄운다.
  if (_sessionShown.has(n.id)) return false;

  // ★D-b: 응답이 도착했을 땐 기간이 이미 끝났을 수 있다. 기기 시계가 아니라 serverNow 로 잰다.
  const endAt = Date.parse(n.endAt);
  const serverNow = Date.parse(payload.serverNow);
  if (Number.isFinite(endAt) && Number.isFinite(serverNow) && endAt <= serverNow) return false;

  const wins = targetWindows();
  if (!wins.length) return false;                   // 창이 없으면 «안 띄운 것»으로 둔다(다음 기회에).

  _sessionShown.add(n.id);
  const shown = (rec && rec.shown ? rec.shown : 0) + 1;
  state.notices[n.id] = {
    acked: !!(rec && rec.acked) || (n.level !== 'urgent' && shown >= MAX_TOAST_SHOWS),
    shown,
    at: new Date().toISOString(),
  };
  writeState(state);

  const msg = { ...n, serverNow: payload.serverNow };
  for (const w of wins) { try { w.webContents.send('notice:show', msg); } catch (_) {} }
  return true;
}

/* ── 폴링 루프 ────────────────────────────────────────────────────────────── */

async function poll() {
  if (_polling) return null;
  _polling = true;
  try {
    const r = await fetchNotice();
    _lastPollAt = Date.now();
    if (!r.ok) { _failStreak += 1; schedule(); return null; }
    _failStreak = 0;
    _current = r.notice ? r : null;
    schedule();
    if (r.notice) deliver(r);
    return r;
  } catch (e) {
    // ⛔여기서 throw 가 새면 unhandledrejection 이 된다. 공지 때문에 앱이 시끄러우면 안 된다.
    _failStreak += 1;
    schedule();
    return null;
  } finally {
    _polling = false;
  }
}

function schedule() {
  if (_timer) clearTimeout(_timer);
  const backoff = Math.min(POLL_MS * Math.pow(2, Math.max(0, _failStreak)), MAX_BACKOFF_MS);
  const wait = _failStreak ? backoff : POLL_MS;
  _timer = setTimeout(() => { poll(); }, wait);
  if (_timer.unref) _timer.unref();                 // 타이머가 앱 종료를 붙잡지 않게
}

/* ── init ─────────────────────────────────────────────────────────────────── */

/**
 * @param {import('electron').IpcMain} ipcMain
 * @param {{ userDataDir:string, readAuth:Function, getVersion:Function, getWindows:Function }} deps
 */
function init(ipcMain, deps) {
  _deps = { ..._deps, ...deps };
  _statePath = path.join(deps.userDataDir, 'notice-seen.json');

  /* 렌더러가 「나 떴다」고 알린다. ★앱 시작 폴링을 여기서 건다 —
   * main 에서 창 생성 시점을 짐작하는 것보다 «화면이 실제로 준비됐을 때»가 정확하다.
   * 페이지를 옮겨도 불리므로 HELLO_FRESH_MS 로 과요청을 막는다. */
  ipcMain.handle('notice:hello', async () => {
    if (Date.now() - _lastPollAt > HELLO_FRESH_MS || !_lastPollAt) {
      await poll();
    } else if (_current) {
      deliver(_current);                            // 최근에 폴링했으면 캐시한 것으로 배달만
    }
    return { ok: true };
  });

  /** 사용자가 「확인」을 눌렀다 → 이 공지는 다시 안 뜬다(기간이 남아 있어도). */
  ipcMain.handle('notice:ack', (_e, id) => {
    const key = String(id || '').trim();
    if (!/^[0-9a-f]{24}$/i.test(key)) return { ok: false };
    const state = readState();
    const rec = state.notices[key] || { shown: 1 };
    state.notices[key] = { acked: true, shown: rec.shown || 1, at: new Date().toISOString() };
    writeState(state);
    return { ok: true };
  });

  /** 강제 폴링 — QA·양성대조용(및 사용자가 「지금 확인」을 누를 길이 생길 때). */
  ipcMain.handle('notice:poll-now', async () => {
    _lastPollAt = 0;
    const r = await poll();
    return { ok: !!(r && r.ok), notice: (r && r.notice) || null };
  });

  /** 상태 조회 — 읽음 파일이 비대해지지 않는지(C-d) 화면에서 확인하는 길. */
  ipcMain.handle('notice:state', () => {
    const state = readState();
    let bytes = 0;
    try { bytes = fs.statSync(_statePath).size; } catch (_) { bytes = 0; }
    return {
      ok: true,
      path: _statePath,
      bytes,
      count: Object.keys(state.notices).length,
      notices: state.notices,
      lastPollAt: _lastPollAt,
      endpoint: PATHS[_pathIdx],
      pollMs: POLL_MS,
    };
  });
}

module.exports = { init, POLL_MS };
