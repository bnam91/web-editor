/* ══════════════════════════════════════════════════════════════════════════
   main/report/queue.js — 신고 로컬 큐 + 전송기 (메인 프로세스)
   ──────────────────────────────────────────────────────────────────────────
   ★왜 «메인»에 있나
     ⑴ sessionToken 은 렌더러로 나가지 않는다(main.js 의 기존 원칙). 신고에 계정을
        붙이려면 붙이는 자리가 메인이어야 한다.
     ⑵ 큐는 «파일»이어야 한다(PLAN §2⑸). localStorage 는 창마다이고, 앱을 지우면 같이
        날아간다. userData 파일이라야 서버가 죽어도 살아남는다.
     ⑶ 렌더러 fetch 는 CSP·창 수명에 묶인다. 창이 닫히는 중이면 전송이 끊긴다.

   ★상한 50 · 넘으면 «오래된 것부터» 버린다 (PLAN §8 · 유저렌즈 C-b)
     새 신고를 거부하면 사용자는 방금 겪은 버그를 못 보낸다 — 그게 더 나쁘다.

   ★중복 전송 (유저렌즈 D-a) — 우리가 «지킬 수 있는 선»을 정직하게 적는다
     · 같은 항목이 «동시에» 두 번 나가는 일은 없다: _inflight 세트 + 단일 flush 루프.
     · 전송 «도중» 앱이 죽으면? 서버가 이미 넣었는지 우리는 모른다. 서버 계약에
       멱등키(clientReportId)가 «없다» ⇒ 우리는 at-least-once 를 택한다.
       잃는 것보다 한 번 더 가는 게 낫다(PLAN §2⑸: 「보냈다고 해놓고 사라지는 게 최악」).
       ⇒ 대신 inflightAt 을 파일에 남겨 «재개된 건»임을 표시하고, 재개는 항목당 1회만 한다.
       (진짜 정확히-한-번은 서버가 멱등키를 받아야 성립한다 — G1 에 남길 것)
══════════════════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('fs');
const path = require('path');

const MAX_ITEMS   = 50;
const TIMEOUT_MS  = 30000;   // 이미지가 붙으면 10초로는 모자란다
const RETRY_MS    = 10 * 60 * 1000;

let _dir = null;             // userData
let _apiBase = 'https://blacksheepwall.kr';
let _authReader = () => null;   // () => { email, sessionToken } | null
let _log = () => {};

let _flushing = false;
const _inflight = new Set();
let _timer = null;

function filePath() { return path.join(_dir, 'reports-queue.json'); }

/* ── 파일 I/O — 원자적 쓰기(임시파일 → rename). 중간에 죽어도 반쪽 JSON 이 안 남는다 ── */
function read() {
  try {
    const raw = fs.readFileSync(filePath(), 'utf8').replace(/^﻿/, '');
    const j = JSON.parse(raw);
    if (!j || !Array.isArray(j.items)) return { v: 1, items: [] };
    return { v: 1, items: j.items.filter((it) => it && it.id && it.payload) };
  } catch (_) {
    return { v: 1, items: [] };
  }
}
function write(state) {
  try {
    const p = filePath();
    const tmp = p + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({ v: 1, items: state.items }), 'utf8');
    fs.renameSync(tmp, p);
    return true;
  } catch (e) {
    _log('[report-queue] 저장 실패: ' + e.message);
    return false;
  }
}

function newId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

/** 큐에 넣는다. 반환 = { id, dropped } — dropped 는 상한 때문에 버려진 «오래된» 건수. */
function enqueue(payload) {
  const state = read();
  const item = {
    id: newId(),
    createdAt: new Date().toISOString(),
    tries: 0,
    lastError: null,
    inflightAt: null,
    resumed: false,
    payload,
  };
  state.items.push(item);
  let dropped = 0;
  while (state.items.length > MAX_ITEMS) { state.items.shift(); dropped++; }   // ★오래된 것부터
  write(state);
  return { id: item.id, dropped, size: state.items.length };
}

function stats() {
  const items = read().items;
  return { size: items.length, max: MAX_ITEMS, oldest: items[0] ? items[0].createdAt : null };
}

/* ── 전송 ──────────────────────────────────────────────────────────────────
   ★★정본 하나만 두드리면 «신고가 한 건도 안 간다» (2026-09-05 지디 실측)
     실측:  POST /api/report          → 404 {"ok":false,"error":"not_found"}  (message «없음»)
            POST /api/license/report  → 400 {"ok":false,"error":"empty_text","message":"내용을 적어 주세요."}
     즉 정본 라우트는 «아직 EC2 어댑터 ROUTES 화이트리스트에 없고», 같은 핸들러가 alias
     주소로는 «살아 있다». 그런데 404 는 (의도적으로) 재시도 대상이라 큐가 조용히 무한 재시도만 한다
     — 사용자는 「보냈다」고 보고 현빈은 «아무것도 못 받는다».
     main/admin/index.js 는 «읽기» 쪽에서 이미 같은 사정을 alias 폴백으로 넘고 있었는데
     «쓰기»(이 파일)에만 그 폴백이 없었다.
   ★가르는 표는 admin/index.js 와 «같은 것»을 쓴다: 핸들러가 낸 404 는 사람에게 할 말(message)을
     싣고, 어댑터의 라우팅 404 는 안 싣는다. message 가 있으면 그건 정본이 «대답한» 것이므로
     alias 로 넘어가지 않는다(같은 신고가 두 번 들어가는 걸 막는다). */
const ALIAS_PATH = '/api/license/report';
let _pathPref = null;    // 이번 실행에서 «통한» 주소. 매 건 왕복 두 번 하지 않으려고 기억한다.

/** 정본 → (라우팅 404 면) alias 로 «한 번만» 재시도. 반환 꼴은 post 와 같다. */
async function postReport(body) {
  if (_pathPref === ALIAS_PATH) return post(_apiBase + ALIAS_PATH, body);
  const r = await post(_apiBase + '/api/report', body);
  if (r.status !== 404 || (r.json && r.json.message)) { _pathPref = '/api/report'; return r; }
  const alt = await post(_apiBase + ALIAS_PATH, body);
  if (alt.status !== 404) _pathPref = ALIAS_PATH;
  return alt;
}

async function post(url, body) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    let json = null;
    try { json = await res.json(); } catch (_) { json = null; }
    return { status: res.status, json };
  } finally {
    clearTimeout(timer);
  }
}

/* ★버리는 조건은 «허용목록»이다 — 「4xx 면 버린다」가 아니다.
 *   실측(2026-09-02): 라이브 /api/report 는 아직 «없어서» 404 를 준다. 4xx 를 통째로
 *   영구실패로 보면 라우트가 올라가기 «전»에 눌린 신고가 전부 조용히 사라진다
 *   — 서버 배포 순서 하나 때문에 사용자 신고를 잃는다(PLAN §2⑸ 정면 위반).
 *   ⇒ 버리는 건 「서버가 내용을 «읽고» 거절한」 경우뿐이다.
 *     404·405(라우트 없음)·408·429·5xx·네트워크 오류는 «전부 재시도». */
const PERMANENT = new Set([
  400,  // invalid_body / empty_text / text_too_long / too_many_images / bad_image
  401, 403,
  413,  // payload_too_large / image_too_large — 줄이지 않는 한 다시 보내도 같다
  415, 422,
]);
function isPermanent(status) {
  return PERMANENT.has(status);
}

/**
 * 큐를 오래된 것부터 비운다.
 * @returns {Promise<{sent:number, dropped:number, left:number, lastMessage:string|null, lastError:string|null}>}
 */
async function flush() {
  if (_flushing) return { sent: 0, dropped: 0, left: read().items.length, busy: true, lastMessage: null, lastError: null };
  _flushing = true;
  let sent = 0, dropped = 0, lastMessage = null, lastError = null;
  try {
    // 매 항목마다 파일을 다시 읽는다 — 도중에 새 신고가 들어와도 잃지 않는다.
    for (;;) {
      const state = read();
      const item = state.items.find((it) => !_inflight.has(it.id));
      if (!item) break;

      // ★재개 판정 — 전송 도중 죽었던 건은 «한 번만» 다시 보낸다.
      if (item.inflightAt && item.resumed) {
        // 두 번째 재개 시도. 여기까지 왔다는 건 서버 응답을 두 번 못 봤다는 뜻이다.
        // 계속 붙들면 뒤의 신고까지 막힌다 ⇒ 버리고 사유를 남긴다.
        const st2 = read();
        st2.items = st2.items.filter((x) => x.id !== item.id);
        write(st2);
        dropped++;
        lastError = 'resume_exhausted';
        continue;
      }
      if (item.inflightAt) item.resumed = true;

      _inflight.add(item.id);
      // 보내기 «전에» inflightAt 을 파일에 새긴다 — 여기서 앱이 죽으면 다음 실행이 안다.
      {
        const st = read();
        const target = st.items.find((x) => x.id === item.id);
        if (target) { target.inflightAt = new Date().toISOString(); target.resumed = item.resumed; write(st); }
      }

      let res = null, netErr = null;
      try {
        const auth = _authReader() || {};
        const body = Object.assign({}, item.payload);
        // ★세션토큰은 «보낼 때» 붙인다. 큐 파일에 토큰을 적어 두지 않는다(디스크에 남는다).
        //   D-c: 로그아웃 뒤 재시도되면 토큰이 없어 그대로 익명이 된다 — 이전 계정이 새지 않는다.
        if (auth.sessionToken) body.sessionToken = auth.sessionToken;
        res = await postReport(body);
      } catch (e) {
        netErr = (e && e.name === 'AbortError') ? 'timeout' : ((e && e.message) || 'network');
      }
      _inflight.delete(item.id);

      const st = read();
      const idx = st.items.findIndex((x) => x.id === item.id);
      if (idx < 0) continue;   // 그 사이 지워졌다면 그냥 넘어간다

      if (res && res.status >= 200 && res.status < 300 && res.json && res.json.ok) {
        st.items.splice(idx, 1);
        write(st);
        sent++;
        lastMessage = (res.json && res.json.message) || null;
        continue;
      }

      if (res && isPermanent(res.status)) {
        // 서버가 「이건 못 받는다」고 «말과 함께» 거절했다. 계속 붙들 이유가 없다.
        st.items.splice(idx, 1);
        write(st);
        dropped++;
        lastError = (res.json && (res.json.message || res.json.error)) || ('HTTP ' + res.status);
        continue;
      }

      // 일시적 실패(오프라인·5xx·429) — 남겨두고 «멈춘다». 순서를 지키기 위해서다.
      st.items[idx].tries = (st.items[idx].tries || 0) + 1;
      st.items[idx].lastError = netErr || (res ? ('HTTP ' + res.status) : 'unknown');
      st.items[idx].inflightAt = null;    // 응답을 «봤으므로» 재개 상태가 아니다
      write(st);
      lastError = st.items[idx].lastError;
      break;
    }
  } finally {
    _flushing = false;
  }
  return { sent, dropped, left: read().items.length, lastMessage, lastError };
}

function scheduleRetry() {
  if (_timer) return;
  _timer = setInterval(() => { flush().catch(() => {}); }, RETRY_MS);
  if (_timer.unref) _timer.unref();
}

/**
 * @param {object} o
 * @param {string} o.userDataDir
 * @param {string} o.apiBase
 * @param {Function} o.readAuth  () => {email, sessionToken} | null
 * @param {Function} [o.log]
 */
function init(o) {
  _dir = o.userDataDir;
  _apiBase = o.apiBase || _apiBase;
  _authReader = o.readAuth || _authReader;
  _log = o.log || _log;
  scheduleRetry();
}

module.exports = { init, enqueue, flush, stats, MAX_ITEMS, _postReport: (b) => postReport(b), _resetPathPref: () => { _pathPref = null; }, ALIAS_PATH };
