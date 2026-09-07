/**
 * Goditor Claude PM — MCP Server (PM-C)
 *
 * Electron main process 안에서 동작하는 MCP(Model Context Protocol) 서버.
 * - Node 내장 http만 사용 (SDK/Express 등 신규 의존성 없음)
 * - JSON-RPC 2.0 직접 구현
 * - Streamable HTTP transport (간단형: POST /mcp 단일 메시지 응답)
 *
 * Exports:
 *   - startMcpServer({ port, onActiveProject })
 *   - stopMcpServer()
 *   - registerTool(name, handler)
 *
 * 기본 포트: 9345 (사용 중이면 +1씩 fallback)
 */

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

let server = null;
let currentPort = null;
// Unit B — 접속 토큰 페어링. 메모리에만 보관(파일/레포 저장 금지). 앱 생애주기 동안 유지.
let mcpToken = null;
let onActiveProjectCb = null;
// Phase 2: renderer 측 write 작업(예: window.addTextBlock)을 main에서 호출하는 bridge.
// main.js가 setRendererInvoker({addTextBlock})로 주입 (순환 의존성 회피).
let _rendererInvoker = null;
// main.js가 setIconifyApi({search, fetchSvg})로 주입. main 측에서 직접 fetch (SSRF/CSP 안전).
let _iconifyApi = null;
// main.js가 setProjectOps({duplicate})로 주입 — 프로젝트 단위 관리(복제 등). main 프로세스 fs 로직.
let _projectOps = null;

/* ★인증 «상태»를 main.js 가 주입한다. ⛔MCP 는 계정 «식별자»를 안 받는다 — 「됐나」만 안다.
   2026-09-07 현빈 지시: 「가장 먼저 로그인되어 있는지로 확인해야 한다」. */
let _authProbe = null;
function setAuthProbe(fn) { _authProbe = fn; }

/** 로그인 안 됐으면 거절 응답, 됐으면 null. ★못 재면(주입 전) «통과»시킨다 —
 *  앱 버전이 낡아 주입이 없을 수 있고, 그때 전부 막으면 도구가 통째로 죽는다.
 *  ⇒ 「없다」와 「안 됐다」를 가른다: 주입이 없으면 «판정 안 함», 있으면 «판정». */
function _authGate(toolName) {
  /* ⛔예전엔 여기서 `return null`(=통과) 이었다. 근거는 「앱 버전이 낡아 주입이 없을 수 있다」였는데
     ★그 근거가 틀렸다 — 프로브를 꽂는 main.js 와 이 파일은 «같은 바이너리»다. 버전이 어긋날 수 없다.
     남는 경우는 «배선을 빠뜨렸다» 하나뿐이고, 그때 문을 열어 두면 로그인 게이트가 통째로 증발한다.
     ⇒ 못 재면 «거절»한다. 뿌리 주입(NO_PROJECTS_ROOT)과 실패 모드를 맞춘다 — 둘이 갈리면 안 된다. */
  if (typeof _authProbe !== 'function') {
    return { ok:false, code:'AUTH_PROBE_MISSING', tool:toolName,
      error:`로그인 상태를 확인할 수 없어 ${toolName} 을(를) 실행하지 않았습니다.`,
      hint:'NOTHING was done. The app did not wire up its login probe — this is an app bug, not a missing feature. Restart the Goditor app; if it persists, report it.' };
  }
  let a = null;
  try { a = _authProbe(); } catch (_) { return null; }
  if (!a || a.authed) return null;
  return {
    ok: false, code: 'NOT_LOGGED_IN', tool: toolName,
    error: `로그인이 안 되어 있어 ${toolName} 을(를) 실행하지 않았습니다.`,
    /* ★거절은 곧 «안내»여야 한다 — 「미인증」만 던지면 클로드가 다른 방법을 찾아 헤맨다.
       그리고 ⛔「도구가 없다」로 읽히면 안 된다(2026-09-07: 클로드가 호출 실패를
       「기능이 없습니다」로 단정한 실측이 있다). 「지금은 못 한다」로 «갈라» 말한다. */
    hint: 'NOTHING was done. This is NOT a missing feature — the tool exists but requires sign-in. '
        + 'Ask the user to sign in to the Goditor app (앱 화면에서 로그인), then retry the same call.',
  };
}


/* ── MCP undo 추적 (2026-09-06) ────────────────────────────────────────────
 * 「우리가 «마지막으로» 만든 히스토리 항목」의 seq. 편집 도구가 성공할 때마다 갱신.
 * ⛔전역 undo 를 여는 게 아니다 — «우리 것일 때만» 되돌리기 위한 근거다. */
let _lastMcpSeq = null;      // 우리 마지막 편집이 만든 «맨 위» 항목의 seq
/* ★실측(2026-09-06): MCP 도구 «1회»가 히스토리 «1칸»이 아니다.
     add_block/add_section = 1칸인데 build_basic_section = ★4칸.
   ⇒ 한 칸만 되돌리면 «반쯤 지어진 섹션»이 남는다 — ok:true 인데 눈에는 그대로다.
   ⇒ 그래서 «우리 호출이 만든 구간»(from, to] 을 기억하고 그 구간«만» 되돌린다.
     ⛔「내 것이 나올 때까지 계속」이 아니다 — 우리 경계 밖으로는 «한 칸도» 안 간다. */
let _lastMcpSeqFrom = null;
/* 캔버스를 «안 바꾸는» 도구들 — 이걸 부른 뒤엔 seq 를 갱신하지 않는다.
   ★export_sections 는 파일을 쓰지만 «캔버스»는 안 바꾼다 → 여기 들어간다. */
const _NON_MUTATING = new Set([
  'read_project', 'read_section', 'get_canvas_state', 'list_memories', 'list_scratch_items',
  'read_scratch_item', 'list_checklist_items', 'get_section_memo', 'search_iconify',
  'get_block_schema', 'list_projects', 'goditor_which_instance', 'export_sections',
  'undo_last_mcp_change',
]);


const tools = new Map();
const toolSchemas = new Map();
/* «토큰 다이어트»(2026-08-25) — tools/list 에서만 감출 도구 이름.
 *   숨김 = 목록 미노출이지 «제거가 아니다». 핸들러는 그대로라 기존 대화/문서/docs 가
 *   부르던 add_*_block · update_*_block 51개는 별칭으로 계속 동작한다.
 *   이유: tools/list 는 매 요청마다 실리는 고정비다(실측 108,801자≈34,000토큰).
 *         요금제가 작은 사용자는 그것만으로 대화창이 반쯤 차버린다. */
const hiddenTools = new Set();
function hideTool(name, on = true) { if (on) hiddenTools.add(name); else hiddenTools.delete(name); }

const PROTOCOL_VERSION = '2024-11-05';
const SERVER_INFO = { name: 'goditor-claude-pm', version: '0.1.0' };

// ─────────────────────────────────────────────
// Unit B — 접속 토큰 페어링 헬퍼
// ─────────────────────────────────────────────
function _genToken() { return crypto.randomBytes(32).toString('hex'); }
function getToken() { return mcpToken; }
function regenerateToken() {
  mcpToken = _genToken();
  if (currentPort != null) _writeTokenFile(currentPort, mcpToken);
  return mcpToken;
}
function _extractToken(req) {
  const h = req.headers || {};
  const x = h['x-goditor-token'];
  if (x) return String(x).trim();
  const a = h['authorization'] || h['Authorization'];
  if (a && /^Bearer\s+/i.test(a)) return a.replace(/^Bearer\s+/i, '').trim();
  return null;
}
// 타이밍안전 비교 — 길이 다르면 즉시 false(timingSafeEqual은 길이 같아야 throw 안 함)
function _tokenOk(tok) {
  if (!mcpToken || !tok || tok.length !== mcpToken.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(tok), Buffer.from(mcpToken));
  } catch (_) { return false; }
}

// ─────────────────────────────────────────────
// Unit B-2 — 토큰 «내구화»
//   문제: 토큰은 부팅마다 새로 생긴다. 그래서 클라이언트 설정(claude_desktop_config 등)에
//   토큰을 박아두면 앱을 재시작하는 순간 401이 되고, 사용자가 매번 손으로 갈아끼워야 했다.
//   해법: «현재 토큰»을 userData/claude-pm/ 아래 0600 파일로 적어두고, /health가 그 «경로»를
//   알려준다. stdio 브리지는 붙을 포트의 /health가 준 경로를 읽어 매번 최신 토큰을 쓴다.
//   ⚠️파일은 포트별(mcp-<port>.json)이 정본이다 — 인스턴스를 2개 띄워도 서로 안 덮는다.
//   ⛔토큰 값 자체는 로그에 찍지 않는다(경로만).
// ─────────────────────────────────────────────
let _tokenFilePath = null;
let _bridgeCopyPath = null;
let _bridgeCopyError = null;

function _getUserDataDir() {
  try {
    const { app } = require('electron');
    if (app && app.getPath) return app.getPath('userData');
  } catch (_) {}
  // 단독(non-Electron) 실행 폴백. ⛔레포 안에 두면 토큰 파일이 커밋될 수 있다 → tmp로 뺀다.
  return path.join(os.tmpdir(), 'goditor-mcp');
}
function _stateDir() { return path.join(_getUserDataDir(), 'claude-pm'); }

/* ★원장에 «한 줄» 적는 모듈 수준 기록기.
   기존 _audit 은 도구 호출 «안»에만 있어서, 그 밖에서 터진 것(예외·라우팅 실패)은
   원장에 «안 남았다». 실측: outcome 분포가 ok 666 · refused 20 «둘뿐»이고 error 0건이었다.
   ⇒ 원장만 보면 「전부 잘 됐다」로 읽힌다. ⛔안 잰 것은 «없는 것»이 된다.
   ⛔값은 여전히 안 적는다 — 이름·코드·짧은 메시지만. */
function _appendAudit(rec) {
  try {
    const dir = _stateDir();
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, 'tool-audit.jsonl'),
      JSON.stringify({ at: new Date().toISOString(), ...rec }) + '\n');
  } catch (_) { /* 원장 실패가 동작을 막지 않는다 */ }
}
function getTokenFilePath() { return _tokenFilePath; }
function getBridgePath() { return _bridgeCopyPath; }
function getBridgeError() { return _bridgeCopyError; }

function _write0600(file, data) {
  // ⚠️writeFileSync의 mode는 «새로 만들 때»만 먹는다. 이미 있던 파일(644)은 그대로라
  //   쓴 뒤에 chmod를 한 번 더 해야 실제로 0600이 된다.
  fs.writeFileSync(file, data, { encoding: 'utf8', mode: 0o600 });
  try { fs.chmodSync(file, 0o600); } catch (_) {}
}

function _writeTokenFile(port, token) {
  try {
    const dir = _stateDir();
    fs.mkdirSync(dir, { recursive: true });
    const userData = _getUserDataDir();
    const payload = JSON.stringify({
      port,
      token,
      pid: process.pid,
      instance: path.basename(userData),
      userData,
      name: SERVER_INFO.name,
      startedAt: new Date().toISOString(),
    }, null, 2);
    const perPort = path.join(dir, `mcp-${port}.json`);
    // mcp.json = 「마지막에 뜬 인스턴스」 편의 사본. /health가 경로를 못 주는 구버전 대비 폴백.
    _write0600(perPort, payload);
    _write0600(path.join(dir, 'mcp.json'), payload);
    _tokenFilePath = perPort;
    console.log(`[claudePM MCP] token file: ${perPort} (0600)`);
    return perPort;
  } catch (e) {
    console.error('[claudePM MCP] token file write failed:', e.message);
    _tokenFilePath = null;
    return null;
  }
}

function _removeTokenFile() {
  if (!_tokenFilePath) return;
  try { fs.unlinkSync(_tokenFilePath); } catch (_) {}
  _tokenFilePath = null;
}

// 브리지 스크립트를 userData로 복사한다.
// ⚠️패키징하면 브리지는 app.asar «안»에 들어가서 `node <asar경로>` 로는 실행이 안 된다.
//   그래서 사용자에게 안내할 경로는 항상 이 복사본이어야 한다(개발/배포 동일).
// ★조건 1 — 복사본이 앱 버전과 «어긋나면 안 된다».
//   내용 해시가 다르면 무조건 덮어쓴다. 안 그러면 앱을 업데이트해도 낡은 브리지가 남아
//   「업데이트했는데 안 고쳐진다」가 된다.
// ★조건 2 — 실패를 «조용히 넘기지 않는다».
//   복사가 실패하면 개발자 탭이 안내하는 연결 경로가 통째로 거짓이 된다. 그래서 사유를
//   _bridgeCopyError 에 남기고 getMcpInfo 로 올려 화면에 드러낸다.
function _copyBridge() {
  const dst0 = path.join(_stateDir(), 'mcp-stdio-bridge.cjs');
  try {
    const src = path.join(__dirname, 'mcp-stdio-bridge.cjs');
    if (!fs.existsSync(src)) {
      _bridgeCopyPath = null;
      _bridgeCopyError = `브리지 원본을 찾을 수 없습니다: ${src}`;
      console.error('[claudePM MCP] bridge source missing:', src);
      return null;
    }
    const dir = _stateDir();
    fs.mkdirSync(dir, { recursive: true });
    const buf = fs.readFileSync(src);
    const srcHash = crypto.createHash('sha256').update(buf).digest('hex');
    let dstHash = null;
    try { dstHash = crypto.createHash('sha256').update(fs.readFileSync(dst0)).digest('hex'); } catch (_) {}
    if (dstHash !== srcHash) {
      fs.writeFileSync(dst0, buf);
      console.log(`[claudePM MCP] bridge copy updated (${dstHash ? 'stale→fresh' : 'new'}): ${dst0}`);
    }
    try { fs.chmodSync(dst0, 0o755); } catch (_) {}
    // 쓴 뒤 실제로 같은지 다시 읽어 확인한다 — 「썼다」와 「있다」는 다르다.
    const after = crypto.createHash('sha256').update(fs.readFileSync(dst0)).digest('hex');
    if (after !== srcHash) throw new Error('복사본 해시가 원본과 다릅니다(디스크 쓰기 실패 의심)');
    _bridgeCopyPath = dst0;
    _bridgeCopyError = null;
    return dst0;
  } catch (e) {
    _bridgeCopyPath = null;
    _bridgeCopyError = `브리지 복사 실패(${dst0}): ${e.message} — MCP 연결 안내 경로를 쓸 수 없습니다.`;
    console.error('[claudePM MCP] bridge copy FAILED:', e.message);
    return null;
  }
}

// ─────────────────────────────────────────────
// Tool registration
// ─────────────────────────────────────────────
function registerTool(name, handler, schema) {
  tools.set(name, handler);
  if (schema) toolSchemas.set(name, schema);
}

/* ─── ★스키마에 «없는» 인자 — 한 자리에서 잰다 (2026-09-07 g-mcpmgr) ───────────
 * 배선 자리는 «디스패처 한 곳»이다(tools/call). 도구별로 고치지 않는다 —
 * 도구를 새로 더해도 자동으로 이 검사를 탄다(_projectGate 와 같은 패턴). */

/** 기본은 «경고». `GODITOR_MCP_STRICT_ARGS=1` 이면 «거절». ⛔전환은 지디 게이트(2단계).
 *  ★«모듈 로드 시점 상수»가 아니라 «호출 시점»에 읽는다 — 상수로 두면 프로세스를 새로 띄우지 않고는
 *    STRICT 쪽을 «잴 수가 없다». 못 재는 스위치는 스위치가 아니라 주석이다. */
const _strictArgs = () => String(process.env.GODITOR_MCP_STRICT_ARGS || '') === '1';

/** ★«모르는 인자를 아래로 흘려보내는» 도구 — 여기선 디스패처가 「효과 없음」을 «말할 수 없다».
 *
 * 왜 필요한가(2026-09-07 실측): `update_block{blockId, text:'X'}` 에 「text 는 무시됐다」고 경고했는데
 *   렌더러는 `content:'X'` 를 받아 «글자가 실제로 바뀌었다». 경고가 «거짓말»을 했다.
 *   기전: 이 둘은 통합 디스패처라 `...rest` 를 `props` 로 «합쳐 아래로» 보내고, 하위 도구의
 *   «자기 스키마»에서 `normalizeArgs` 가 별칭(text↔content 등)을 해소한다.
 *   ⇒ 「이 스키마에 그 글자가 없다」와 「그 인자가 안 먹는다」는 **다른 사실**이고,
 *     둘이 갈리는 자리가 정확히 여기다.
 * ★전수로 갈랐다 — 노출 도구 33개에 뜬금없는 인자를 하나씩 태워 «렌더러까지 닿나»를 봤다:
 *     흘려보냄 2 (아래 둘) · 버림 27 · 판정불가 4(렌더러를 안 부르는 도구)
 * ⇒ 이 둘은 «침묵»한다. 대신 하위 층의 `warnUnknown`(ignoredProps/hint)이 «해소한 뒤» 판정한다.
 * ⛔이 목록을 손으로 늘리지 마라 — `mcp-unknown-args.test.js` 가 «다시 재서» 어긋나면 빨강을 낸다. */
const _ARG_FORWARDERS = new Set(['add_block', 'update_block']);

/** 이 도구 스키마가 «선언한» 인자 이름들. 스키마가 없으면 판정하지 않는다(빈 배열이 아니라 null). */
function _declaredArgKeys(name) {
  const s = toolSchemas.get(name);
  const props = s && s.inputSchema && s.inputSchema.properties;
  return props ? Object.keys(props) : null;
}

/** ★스키마에 «없는» 인자 — 단, «별칭을 해소한 뒤»에 판정한다.
 *
 * ⛔처음에 나는 raw 키를 스키마 prop 과 그냥 대조했다. **그건 거짓 경고를 낸다.**
 *   실증(2026-09-07): `update_block{blockId, text:'X'}` 에 「text 는 무시됐고 효과가 없다」고 경고했는데
 *   실제로는 렌더러가 `content:'X'` 를 받아 «글자가 바뀌었다». 경고가 «거짓말»을 한 것이다.
 * ★원인: 이 코드베이스엔 별칭이 «의도적으로» 있다(`mcp-block-tools.js` `normalizeArgs`):
 *     ⑴ 표기 정규화 `_canon` — 대소문자·`_`·`-`·공백 무시 (blockID·block_id·BlockId → blockId)
 *     ⑵ 동의어 표 `SYN` — text↔content · label→title · msg→text · value→text
 *   ⇒ 「스키마에 그 «글자»가 없다」와 「그 인자가 «안 먹는다»」는 **다른 사실**이다.
 * ⇒ 그래서 판정을 normalizeArgs 에 위임한다. 그게 «실제로 먹는 규칙»의 정본이다.
 *   ⚠️normalizeArgs 는 블록 도구에만 걸려 있지만, 그 «해소 규칙»은 여기서 전 도구에 공평하게 쓴다 —
 *     안 그러면 같은 인자가 도구에 따라 경고가 갈려 더 헷갈린다.
 * ★스키마를 모르면 «못 잰 것»이라 빈 배열을 준다 — 0 을 「없다」로 쓰지 않기 위해. */
function _unknownArgKeys(name, args) {
  const schema = toolSchemas.get(name);
  const declared = _declaredArgKeys(name);
  if (!declared || !args || typeof args !== 'object') return [];
  try {
    const { normalizeArgs } = require('./mcp-block-tools');
    if (typeof normalizeArgs === 'function') return normalizeArgs(schema, args).unknown || [];
  } catch (_) { /* 별칭 해소기를 못 부르면 아래 보수적 대조로 떨어진다 */ }
  return Object.keys(args).filter(k => !declared.includes(k));
}

/** ★거절은 곧 «안내»여야 한다 — 3단(넣을 수 있는 것 / 받았는데 안 쓰는 것 / 아예 안 되는 것). */
function _unknownArgRefusal(name, unknown) {
  const declared = _declaredArgKeys(name) || [];
  return {
    ok: false, code: 'UNKNOWN_ARGS', tool: name, unknownArgs: unknown, accepts: declared,
    error: `unknown argument(s) for ${name}: ${unknown.join(', ')}`
      + ` — this tool accepts only: ${declared.join(', ') || '(none)'}.`
      + ' Those arguments were NOT applied and there is no field on this tool that does what they name;'
      + ' do not retry with a renamed variant — call tools/list and pick a tool that declares it.'
  };
}

/** 경고 문구(비파괴 경로). 응답에 «키를 더할» 뿐 기존 키는 안 건드린다. */
function _unknownArgWarning(name, unknown) {
  const declared = _declaredArgKeys(name) || [];
  return `ignored unknown argument(s): ${unknown.join(', ')}`
    + ` — ${name} accepts only: ${declared.join(', ') || '(none)'}.`
    + ' They had NO effect. If you meant to change something else, this tool cannot do it.';
}

/** ★없던 «인자 원장»을 만든다. 브리지 로그는 params 를 안 남겨서 「실제로 몇 건이냐」를 셀 수가 없었다.
 *  ⛔값은 안 적는다(PII·본문 유출 방지) — «이름»만 적는다. 그거면 세는 데 충분하다. */
function _recordUnknownArgs(name, unknown, allKeys) {
  try {
    let dir;
    try {
      const { app } = require('electron');
      dir = app && app.getPath ? path.join(app.getPath('userData'), 'claude-pm') : null;
    } catch (_) { dir = null; }
    // ⛔electron 이 없을 때(단독 node 실행·검사) «저장소 안»에 로그를 쓰지 않는다 —
    //   실제로 repo 루트에 claude-pm/ 이 생겼다. 원장은 임시 디렉터리로 흘린다.
    if (!dir) dir = path.join(os.tmpdir(), 'goditor-mcp', 'claude-pm');
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, 'unknown-args.jsonl'),
      // ★필드 이름을 «notInSchema» 로 둔다 — `unknown` 은 「안 먹는다」를 함의하는데
      //   전달자에선 «먹는다». 원장은 「스키마에 그 글자가 없었다」만 주장한다.
      JSON.stringify({ at: new Date().toISOString(), tool: name, notInSchema: unknown, argKeys: allKeys,
                       forwarder: _ARG_FORWARDERS.has(name),
                       strict: _strictArgs() }) + '\n');
  } catch (_) { /* 원장 실패가 도구를 막지 않는다 */ }
}

/* ★프로젝트 «뿌리»는 계정별로 움직인다(<userData>/accounts/<계정키>/projects).
   ⛔여기서 userData 에 'projects' 를 직접 이어 붙이면 «세 번째 경로 조립기»가 되어
     main.js 의 진짜 뿌리와 어긋난다. 실제로 어긋났다 — 2026-09-07 계정 격리를 넣은 뒤
     read_project 가 «자기 계정의 프로젝트»에도 'project not found' 를 냈다.
     그리고 그건 반대 방향으로도 샌다: 옛 뿌리(공용 풀)를 보므로 «남의 계정 것»을 읽는다.
   ⇒ main.js 가 setProjectsRoot() 로 진짜 뿌리를 꽂아 준다. 안 꽂히면 옛 자리로 폴백. */
let _projectsRootFn = null;
function setProjectsRoot(fn) { _projectsRootFn = (typeof fn === 'function') ? fn : null; }

/* 단독 실행(개발)에서만 «공용 projects 폴더»를 허용한다.
   ⛔«환경»으로 자동 판별하지 않는다 — 판별이 틀리면 조용히 격리가 풀린다.
     명시 플래그를 «호출 시점»에 읽는다(모듈 로드 시점에 굳히면 테스트가 못 흔든다). */
function _sharedRootAllowed() { return process.env.GODITOR_MCP_ALLOW_SHARED_ROOT === '1'; }

/* ★프로젝트 뿌리 — 주입이 정본이다.
   ⛔예전엔 주입이 없거나 던지면 «조용히» userData/projects(옛 공용 풀)로 갔다.
     그건 격리를 소리 없이 되돌리는 길이었다 — 남의 계정 것을 읽게 된다.
     「검사가 못 돌았다」가 통과가 아니듯, 「주입이 안 됐다」도 «공용 풀»이 아니다.
   ⇒ 못 정하면 «던진다». 폴백은 명시 플래그를 켠 단독 실행에만 준다. */
function _getProjectsDir() {
  if (_projectsRootFn) {
    const r = _projectsRootFn();   // ⛔삼키지 않는다 — 던지면 그대로 올라간다
    if (r) return r;
    throw new Error('NO_PROJECTS_ROOT: 프로젝트 뿌리를 못 정했다(주입 함수가 빈 값). 공용 폴더로 폴백하지 않는다.');
  }
  if (_sharedRootAllowed()) return path.join(__dirname, '..', '..', 'projects'); // [뿌리-폴백] 단독 실행 전용
  throw new Error('NO_PROJECTS_ROOT: 프로젝트 뿌리가 주입되지 않았다. 계정 격리가 풀릴 수 있어 공용 폴더로 폴백하지 않는다.');
}

function _readProjectFile(projectId) {
  // projectId는 경로 세그먼트로 쓰인다 — traversal 가드(main.js _safeSeg와 같은 취지).
  const pid = String(projectId || '');
  if (!/^[A-Za-z0-9_-]+$/.test(pid)) throw new Error(`invalid projectId: ${projectId}`);
  /* ★현행 저장 구조는 «폴더»다: projects/<id>/proj.json (main.js _resolveProjectJsonPath 참조).
   *   예전엔 flat(projects/<id>.json)이었고, 이 헬퍼가 flat만 봐서 read_project가
   *   현행 프로젝트에 전부 'project not found'를 냈다(08-25 클로드앱 시연 실측).
   *   ⇒ 폴더 우선 + flat 폴백(구프로젝트 호환) — main.js와 같은 dual-read 순서. */
  /* ⛔예전엔 두 번째 뿌리를 «항상» 뒤졌다 — 조건이 없었다.
       그래서 계정 뿌리에 없으면 «앱/레포의 공용 projects»를 읽었다 = 계정을 넘어 읽는다.
     ★그리고 그게 「못 찾았다」를 «격리 증거»로 오독하게 만든다 — 그 폴더가 비어 있어서
       못 찾은 것일 뿐인데 막았다고 읽힌다(2026-09-07 내가 실제로 그렇게 잘못 읽었다).
     ⇒ 계정 뿌리 «하나»만 본다. 공용 폴더는 명시 플래그를 켠 단독 실행에만 붙인다. */
  const roots = [_getProjectsDir()];
  if (_sharedRootAllowed()) roots.push(path.join(__dirname, '..', '..', 'projects'));  // [뿌리-폴백] 명시 플래그를 켠 단독 실행에만
  const candidates = [];
  for (const dir of roots) {
    candidates.push(path.join(dir, pid, 'proj.json')); // 신 레이아웃(폴더)
    candidates.push(path.join(dir, `${pid}.json`));    // 구 레이아웃(flat)
  }
  for (const file of candidates) {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  throw new Error(`project not found: ${pid}`);
}

// ─────────────────────────────────────────────
// Default tools
// ─────────────────────────────────────────────
// 「지금 열려 있는 프로젝트」의 근거 — «두 갈래»다. 둘 다 살아 있다.
//   ⑴ global.currentActiveProjectId — renderer 의 js/claude-pm/active-project-sync.js 가
//      claudePM:setActiveProject 로 채운다(index.html:1423 에서 싣는다 → ipc.js 가 전역에 대입).
//   ⑵ 편집기 창 URL(index.html?project=proj_xxx) — ⑴이 아직 안 왔을 때의 폴백.
// ★2026-09-07 실측으로 갱신: 예전 주석은 「⑴을 «부르는 곳이 아예 없어서» 항상 null」이라고
//   적혀 있었는데(08-15 관측), 그 뒤 active-project-sync.js 가 생겨 «지금은 참이 아니다».
//   재는 법 — 프로젝트를 열고 delete_project 로 그걸 지운다. 응답의 activeCleared 가 true 면
//   main.js 의 `wasActive = (global.currentActiveProjectId === projectId)` 가 참이었다는 뜻이고,
//   그건 ⑴이 «채워져 있었다»는 증거다. 실제로 true 였다(health.activeProject 도 null 로 떨어졌다).
// ⛔낡은 주석이 「이 경로는 안 돈다」고 말하면 다음 사람이 그 위에 잘못된 판단을 세운다.
//   ★고칠 땐 «어떻게 쟀는지»를 같이 적어라 — 이 문단이 또 낡을 때 다시 잴 수 있게.
function _activeProjectId() {
  try { const p = onActiveProjectCb ? onActiveProjectCb() : null; if (p) return p; } catch (_) {}
  try {
    const { BrowserWindow } = require('electron');
    for (const w of BrowserWindow.getAllWindows()) {
      const u = w.webContents && w.webContents.getURL && w.webContents.getURL();
      const m = u && u.match(/[?&]project=([^&#]+)/);
      if (m) return decodeURIComponent(m[1]);
    }
  } catch (_) {}
  return null;
}

/* ── 파괴적 도구 안전 가드 (08-25 실사용 방어) ──
 *   시나리오: 「복제본을 지운다」는 의도로 delete_*를 불렀는데, 도구는 항상 «활성 프로젝트»에
 *   작용하므로 원본(열려 있던 쪽)이 지워질 뻔했다. expectedProject(선택 인자)가 주어지면
 *   활성 프로젝트와 대조해 불일치 시 «어느 프로젝트가 열려 있는지»를 담아 거부한다.
 *   인자 없으면 아무것도 안 한다(하위호환 — 기존 호출 동일 동작). */
function _assertExpectedProject(expectedProject) {
  if (expectedProject === undefined || expectedProject === null || expectedProject === '') return;
  if (typeof expectedProject !== 'string' || !/^proj_\d+$/.test(expectedProject)) {
    throw new Error(`invalid expectedProject: ${expectedProject} (must be proj_<digits>)`);
  }
  const active = _activeProjectId();
  if (active !== expectedProject) {
    throw new Error(
      `PROJECT_MISMATCH: this destructive tool acts on the ACTIVE project (currently open: ${active || '(none — editor not open)'}), `
      + `but expectedProject=${expectedProject}. Refusing to protect the open project. `
      + `Call open_project("${expectedProject}") first (or pass the active project id if that is really the intent).`
    );
  }
}

/* ── ★프로젝트 «싱크» 게이트 — 대상이 확정되기 전엔 쓰기 도구가 돌지 않는다 (2026-09-07) ──
 * 사고(현빈 실사용, 09-07): 「고디터」라고 말한 적도, 어느 프로젝트인지 정한 적도 없는데
 *   add_section 이 그냥 «열려 있던 실사용 프로젝트»에 들어갔고 현빈이 화면에서 봤다.
 *   ★원인은 클로드가 아니라 «프로토콜»이다 — 부작용 도구 24개가 «필수 인자 0개»이고
 *   전부 활성 프로젝트에 쓴다(projectId 인자가 하나도 없다). 대상을 «고르는 행위» 자체가
 *   인터페이스에 없으니, 안 골랐다는 사실이 도구 쪽에서 보이지 않는다.
 *   duplicate_project{} 는 빈 호출 한 번에 최대 721MB 를 복제한다(실측 p90 276MB).
 *   ⛔게다가 프로젝트를 «지우는» MCP 도구는 없다 — 클로드는 만들 수는 있어도 치울 수 없다.
 *
 * ★「확정」의 정의 = «대상을 지목하는 행위»가 있었다. 둘 중 하나면 통과:
 *   ⑴ expectedProject 인자를 줬고 그게 «지금» 활성 프로젝트와 같다.
 *   ⑵ 이 서버 생애에서 open_project 가 ok 로 끝났고, 그 프로젝트가 «아직도» 활성이다(sticky).
 *   (+ duplicate_project 는 sourceProjectId 가 자기 대상을 직접 지목하므로 그것으로 갈음)
 * ⛔★읽기는 «지목»이 아니다. get_canvas_state 를 먼저 부르는 건 클로드의 기본 습관이라,
 *   읽기를 확정으로 세면 사고가 난 그 시나리오가 «그대로» 통과한다. 보는 것과 고르는 것은 다르다.
 * ★sticky 를 쓰는 이유 = 매 호출 인자를 요구하면 왕복이 2배가 된다. 한 번 정하면 그 대화 동안
 *   유지되는 게 사람이 쓰는 모양이다. 대신 ★«활성이 바뀌면 깨진다» — 사람이 앱에서 다른
 *   프로젝트를 열면 다음 쓰기는 다시 거절된다(대조는 매 호출 _activeProjectId()).
 * ⛔거절은 «조용히» 하지 않고 «조용히 성공»도 하지 않는다. 지금 열린 프로젝트 id·이름과
 *   «다음 수»를 응답에 실어 보낸다 — 그래야 클로드가 스스로 open_project 로 회복한다.
 * ⛔읽기 도구는 막지 않는다. 막으면 「지금 뭐가 열렸는지」조차 물어볼 수 없다.
 */
/** ⛔로그인 게이트를 «면제»하는 도구 — 「왜 안 되는지」를 물어볼 통로는 남겨야 한다. */
const _AUTH_FREE = new Set(['goditor_which_instance', 'get_block_schema']);

const _TARGET_FREE = new Set([
  // ⑴ 읽기 — ⛔이 줄을 줄이지 마라. 막으면 클로드가 현황을 물어볼 통로가 사라진다.
  'read_project', 'read_section', 'get_canvas_state', 'list_projects', 'list_memories',
  'list_scratch_items', 'read_scratch_item', 'list_checklist_items', 'get_section_memo',
  'search_iconify', 'get_block_schema', 'goditor_which_instance',
  /* ★list_assets 는 «자기 대상을 지목하는» 읽기다(projectId 인자를 받는다).
     게이트로 막으면 「어느 프로젝트에 무슨 에셋이 있나」를 «물어볼 수조차» 없어진다 — ⑴의 취지 그대로. */
  'list_assets', 'list_asset_tree',
  // ⑵ 대상을 «고르는» 도구 = 게이트의 출구
  'open_project',
  // ⑶ 새로 만드는 도구는 대상이 없는 게 «정상»이다(아직 아무것도 안 열었으니).
  //    대신 응답에 「만들었지만 열지 않았다 = 활성은 그대로」를 박는다.
  'create_project',
]);
/* 자기 대상을 «인자로» 직접 지목하는 도구 — 그 인자가 곧 확정이다.
 * duplicate_project 는 활성 프로젝트가 아니라 sourceProjectId 를 복제한다. */
const _SELF_TARGET_ARG = new Map([
  ['duplicate_project', 'sourceProjectId'],
  // ★delete_project 도 «지목형»이다 — 활성이 아니라 projectId 를 직접 지운다.
  //   ⇒ 그 인자가 곧 «확정»이므로 프로젝트 확정 게이트를 따로 태울 이유가 없다.
  //   (이래서 expectedProject 안전벨트도 안 붙였다 — 벨트는 «지목 안 하는» 도구를 위한 것이다.)
  ['delete_project', 'projectId'],
  ['rename_project', 'projectId'],   // 비파괴 + 지목형
]);

/* ★★확정(sticky)은 «호출자별»이다 — 예전엔 «프로세스 전역»이었다.
   ⛔그래서 A 세션이 open_project 로 확정을 세우면, ★같은 인스턴스에 붙은 B 세션의
     인자 0개짜리 쓰기가 sticky 로 «그냥 통과»했다. 게이트가 「이 대화」라고 말하는 자리들이
     실제로는 「이 앱 프로세스에 붙은 모두」였다.
   ⇒ 그리고 그게 브리지의 «포트 자동탐색»(9345~9365 중 최저 포트에 말없이 붙는다)과 곱해지면,
     다른 CLI 세션이 남의 실사용 인스턴스에 붙어 그 사람의 확정으로 쓰기를 밀어 넣는다.
   ⇒ 호출자 = 요청의 `Mcp-Session-Id`. 브리지가 프로세스마다 하나 만들어 보낸다.
     헤더가 없는 호출자(직접 curl 등)는 'anon' 한 칸을 공유한다.
   ★★이 'anon' 을 «구멍»으로 읽고 되돌리려는 사람이 나올 것이다. 그러지 마라 —
     ⑴ 헤더 없는 호출자를 «거절»하면 직접 HTTP 로 부르는 도구·검사가 통째로 죽는다.
     ⑵ 그들을 한 칸에 모으는 것은 «예전과 정확히 같다» — 이 판이 그들을 더 나쁘게 만들지 않는다.
     ⑶ 막으려던 것은 «브리지를 쓰는 서로 다른 대화»이고, 그건 이제 갈렸다.
     ⇒ 더 조이려면 「헤더 없으면 거절」이 아니라 「브리지가 반드시 보내게」 쪽이 맞다(이미 그렇다).
   ⛔Map 이 무한히 자라지 않게 상한을 둔다(오래된 것부터 버린다). */
const _CONFIRM_MAX = 64;
const _confirmedByCaller = new Map();
const { AsyncLocalStorage } = require('node:async_hooks');
const _callerCtx = new AsyncLocalStorage();
function _callerId() { try { return _callerCtx.getStore() || 'anon'; } catch (_) { return 'anon'; } }
function _getConfirmed() { return _confirmedByCaller.get(_callerId()) || null; }
function _setConfirmed(v) {
  const k = _callerId();
  if (!v) { _confirmedByCaller.delete(k); return; }
  _confirmedByCaller.delete(k);                       // 재삽입해서 «최근 것»으로
  _confirmedByCaller.set(k, v);
  while (_confirmedByCaller.size > _CONFIRM_MAX) {
    _confirmedByCaller.delete(_confirmedByCaller.keys().next().value);
  }
}

/** 거절 문구에 «이름»을 실어 준다 — id 만으론 사람이 자기 프로젝트인지 못 알아본다. */
function _projectName(pid) {
  if (!pid) return null;
  try {
    if (_projectOps && typeof _projectOps.list === 'function') {
      const r = _projectOps.list({});
      const hit = ((r && r.items) || []).find(p => p && p.id === pid);
      if (hit && hit.name) return String(hit.name);
    }
  } catch (_) {}
  try { const p = _readProjectFile(pid); if (p && p.name) return String(p.name); } catch (_) {}
  return null;  // ★이름을 못 읽은 것이지 프로젝트가 없는 게 아니다
}

/** null = 통과. 객체 = «실행하지 않고» 그대로 돌려줄 거절 응답(다음 수 포함). */
function _projectGate(toolName, args) {
  if (_TARGET_FREE.has(toolName)) return null;   // ⛔fail-closed: 목록에 없으면 전부 게이트 대상
  const a = args || {};

  // 자기 대상을 인자로 지목하는 도구는 그 인자로 갈음한다(빈 호출은 아래로 떨어져 거절된다).
  const selfArg = _SELF_TARGET_ARG.get(toolName);
  if (selfArg) {
    const v = a[selfArg];
    /* ⛔2026-09-07: 「지목했으니 갈음한다」를 «파괴» 도구에까지 주면 안 된다.
       duplicate 는 지목이 틀려도 «사본이 하나 더 생길» 뿐이지만, delete 는 지목이 틀리면
       «남의 프로젝트가 사라진다». 되돌릴 수 있느냐(휴지통)와 별개로, 확정 없이 파괴가
       나가면 「어느 프로젝트를 보고 있었나」를 아무도 모른 채 지우는 것이 된다.
       ⇒ ★지목형 갈음은 «비파괴»에만. 파괴는 확정(open_project)을 «지나야» 한다.
         (F3-7 이 이걸 잡았다 — 내가 처음에 delete 를 갈음 대상으로 넣었고 검사가 빨강을 냈다.) */
    /* ⛔2026-09-07: 「지목했으니 갈음한다」를 «프로젝트 단위 쓰기»에 주면 안 된다.
       delete 는 파괴라 명백하고, rename 도 «남의 프로젝트 이름이 바뀌는» 일이다.
       duplicate 는 지목이 틀려도 «사본이 하나 더 생길» 뿐이라 다르다.
       ⇒ 축은 「파괴냐」가 아니라 ★「지목이 틀렸을 때 «남의 것이 변하느냐»」다. */
    const projectWrite = (toolName === 'delete_project' || toolName === 'rename_project');
    const destructive = projectWrite;
    if (!destructive && typeof v === 'string' && /^proj_\d+$/.test(v)) return null;
  }

  const active = _activeProjectId();
  const expected = a.expectedProject;
  const hasExpected = expected !== undefined && expected !== null && expected !== '';

  if (hasExpected && (typeof expected !== 'string' || !/^proj_\d+$/.test(expected))) {
    return {
      ok: false, code: 'INVALID_EXPECTED_PROJECT', tool: toolName,
      activeProject: active, activeProjectName: _projectName(active),
      error: `expectedProject 형식이 틀렸습니다: ${JSON.stringify(expected)} (proj_<숫자> 여야 합니다) — ${toolName} 을(를) 실행하지 않았습니다.`,
      hint: 'NOTHING was done. Project ids look like "proj_1756123456789". Call list_projects to get the exact id.',
    };
  }

  if (!active) {
    _setConfirmed(null);
    return {
      ok: false, code: 'NO_ACTIVE_PROJECT', tool: toolName,
      activeProject: null, activeProjectName: null,
      error: `대상 프로젝트가 정해지지 않았습니다 — 편집기에 열린 프로젝트가 없어서 ${toolName} 을(를) 실행하지 않았습니다.`,
      hint: 'This tool writes into the ACTIVE Goditor project, but no project is open (gallery screen, or the editor window is closed), so NOTHING was written. '
        + 'Next: call list_projects, show the user the candidates (id + name + updatedAt) and let THEM choose, then call open_project(projectId) and retry. '
        + 'Do not guess which project the user means.',
    };
  }

  if (hasExpected) {
    if (expected !== active) {
      _setConfirmed(null);
      return {
        ok: false, code: 'PROJECT_MISMATCH', tool: toolName,
        activeProject: active, activeProjectName: _projectName(active),
        expectedProject: expected,
        error: `PROJECT_MISMATCH: 지금 열려 있는 프로젝트는 ${active}${_projectName(active) ? `(${_projectName(active)})` : ''} 인데 expectedProject=${expected} 라서 ${toolName} 을(를) 실행하지 않았습니다.`,
        hint: `NOTHING was written. Either call open_project("${expected}") first (then retry), or — if you really meant the project that is open — use expectedProject:"${active}". Tell the user which one you are about to change.`,
      };
    }
    _setConfirmed(active);   // ★명시 지목 = 확정. 이후 «같은 호출자»의 호출은 인자 없이 통과한다.
    return null;
  }

  const _conf = _getConfirmed();
  if (_conf && _conf === active) return null;   // sticky 유효 (★이 호출자의 것만)

  const stale = (_conf && _conf !== active) ? _conf : null;
  _setConfirmed(null);
  const nm = _projectName(active);
  return {
    ok: false, code: 'PROJECT_NOT_CONFIRMED', tool: toolName,
    activeProject: active, activeProjectName: nm,
    ...(stale ? {
      previouslyConfirmed: stale,
      note: `앱에서 다른 프로젝트가 열렸습니다(${stale} → ${active}) — 이전 확정은 깨졌습니다.`,
    } : {}),
    error: `대상 프로젝트를 «정한 적이 없어» ${toolName} 을(를) 실행하지 않았습니다. 지금 열려 있는 것은 ${active}${nm ? `(${nm})` : ''} 입니다.`,
    hint: `NOTHING was written — this tool would have edited the user's REAL project. The editor currently shows ${active}${nm ? ` ("${nm}")` : ''}, but this session never chose a target. `
      + `Confirm with the user WHICH project to change, then call open_project("${active}") (or pass expectedProject:"${active}" on this call) and retry. `
      + 'list_projects shows the other projects. Once confirmed, later calls in this conversation need no extra argument.',
  };
}

/* ── 프로젝트 «전환 ↔ 편집» 상호배제 (2026-08-25, 병렬 호출 유실 봉합) ──────────
 * ★대기만으로는 못 막는다. MCP 서버/브리지는 요청을 «직렬화하지 않는다» —
 *   한 stdio 세션에 open_project 와 편집 도구를 «응답을 안 기다리고» 연달아 써 넣으면
 *   (클로드가 도구를 «병렬 호출»할 때가 정확히 이 모양) 둘이 동시에 실행된다.
 *   실증(병렬 발사 하네스, 3/3 FAIL · 응답 순서 역전 6건):
 *     ⑴ 아직 갤러리인 «옛» 문서에 떨어져 API_MISSING 이 되거나
 *     ⑵ 곧 교체될 «옛» 문서에 ok 로 들어갔다가 통째로 증발한다(DOM 0·디스크 0·에러 0).
 *   open_project 가 아무리 정확히 기다려도, 그 대기가 끝나기 «전»에 편집이 들어가면 소용없다.
 * ⇒ 서버 레벨에서 「전환 중에는 활성 프로젝트에 기대는 도구를 실행하지 않는다」를 강제한다.
 *   기본은 «큐잉»(전환이 끝나면 이어서 실행) — 조용한 유실보다 잠깐 기다리는 쪽이 낫다.
 *   한계를 넘기면 {ok:false, code:'project_switching'} 으로 «정직하게» 거부한다(실행 안 함).
 */
let _switchGate = null;   // 진행 중인 «활성 프로젝트 전환» (Promise)
let _switchMeta = null;   // { projectId, startedAt }

/** 전환을 배타 구간에서 실행한다. 전환끼리도 직렬 — 두 open 이 겹치면 서로의 문서를 덮는다. */
async function _runExclusiveSwitch(meta, fn) {
  while (_switchGate) { try { await _switchGate; } catch (_) {} }
  let release;
  _switchGate = new Promise(r => { release = r; });
  _switchMeta = { ...(meta || {}), startedAt: Date.now() };
  try {
    return await fn();
  } finally {
    _switchMeta = null;
    _switchGate = null;
    release();
  }
}

/** 전환이 끝날 때까지 «큐잉». 시간 초과면 실행하지 않고 project_switching 으로 거부. */
async function _awaitSwitchIdle(toolName, maxWaitMs) {
  if (!_switchGate) return null;
  const t0 = Date.now();
  while (_switchGate) {
    const remain = maxWaitMs - (Date.now() - t0);
    if (remain <= 0) break;
    const g = _switchGate;
    const r = await Promise.race([
      g.then(() => 'done', () => 'done'),
      new Promise(res => setTimeout(() => res('timeout'), remain)),
    ]);
    if (r === 'timeout') break;
  }
  if (_switchGate) {
    const m = _switchMeta || {};
    return {
      ok: false, code: 'project_switching',
      switchingTo: m.projectId || null, waitedMs: Date.now() - t0,
      error: `open_project(${m.projectId || '?'}) 가 아직 진행 중이라 ${toolName} 을(를) 실행하지 않았습니다.`,
      hint: 'A project switch is still in progress, so this tool was NOT executed (running it now would write into a canvas that is about to be replaced, and the edit would vanish silently). Wait for open_project to return, then retry.',
    };
  }
  return null;
}

/* 전환 중에도 «안전하게» 돌아도 되는 도구 — 활성 프로젝트의 캔버스에 기대지 않는 것들만.
 * (open_project 자체는 _runExclusiveSwitch 가 따로 다룬다.) */
const _SWITCH_EXEMPT = new Set([
  'open_project',            // 전환 본인
  'goditor_which_instance',  // 진단 — 전환 중에도 답해야 한다
  'get_block_schema',        // 순수 스키마
  'create_project',          // 새 파일 생성 (활성 캔버스 무관)
  'search_iconify',          // 외부 조회
]);
const _SWITCH_QUEUE_MAX_MS = 130000;  // open_project 기본 타임아웃(120s)보다 넉넉히

/* ★활성 프로젝트에 기대는 도구는 «한 번에 하나»만 돈다(도착 순 FIFO).
 *   브리지는 stdin 의 요청들을 handle(msg) 로 «await 없이» 던진다(주석: "비동기 동시 처리").
 *   그래서 서버가 안 막으면 두 도구가 같은 렌더러를 동시에 만진다 — 전환 ↔ 편집뿐 아니라
 *   duplicate/import 같은 «캔버스 통째 교체» 계열과 편집 사이에도 같은 창이 생긴다.
 *   직렬화는 그 창을 한 곳에서 통째로 닫는다. 면제 목록(_SWITCH_EXEMPT)은 이 줄을 안 선다. */
let _callChain = Promise.resolve();
function _serializeCall(fn) {
  const run = () => fn();
  const p = _callChain.then(run, run);   // 앞 호출이 실패해도 줄은 계속 흐른다
  _callChain = p.then(() => {}, () => {});
  return p;
}

/* ─────────────────────────────────────────────────────────────────────────
 * 갭 «감수 패스» — 도구 묶음이 «멎으면» 한 번 돈다. (2026-09-07)
 *
 * ⓔ 왜 «클로드가 부르는 도구»가 아닌가: 실측으로 확인했다 — 클로드는 도구를 «보고도» 안 부른다.
 *   서버가 알아서 돌아야 한다. 그래서 여기(디스패처)에 예약을 건다.
 * ⓔ 왜 «매 호출»이 아닌가: 5섹션 35블록을 짓는 동안 매번 돌면 낭비고 되돌리기 이력도 더러워진다.
 *   ⇒ 편집이 성공할 때마다 타이머를 «다시» 걸어서, 조용해졌을 때 «한 번» 돈다.
 * ★그래도 중간에 한 번 더 돌아도 «결과가 안 변한다» — normalizePlan 이 멱등이라서다.
 *   최악이 「히스토리 한 칸 낭비」인 설계라, 타이밍을 완벽히 맞추려고 애쓰지 않아도 된다.
 *
 * ⛔환경변수는 «검사용 구멍»이다: GODITOR_SPACING_DEBOUNCE_MS=0 이면 즉시, 음수면 «끈다».
 * ───────────────────────────────────────────────────────────────────────── */
const _spacing = require('./services/spacing');
/* ★12초 — ⛔«도구 호출 사이 간격»을 직접 잰 값이 «아니다». 그건 못 쟀다.
 *   원장(live-progress·*result*.jsonl)에 턴 «안»의 «도구 호출 시각»이 안 남는다. 남는 건
 *   턴 소요(elapsed)와 도구 «수»뿐이라, 여기서 얻을 수 있는 건 «턴당 평균 간격의 상한»이다.
 *   근거 = 실대화 원장(skills/지디/handoff/axgate-0907-evidence 의 *result*.jsonl · live-progress.jsonl):
 *     턴 86개 중 도구를 «2개 이상» 부른 턴은 10개(최대 4개). 그 턴들의
 *     «턴 소요 / (도구수-1)» 분포 = p50 5.4s · p90 9.6s · 최대 181.5s(정체 1건).
 *   ⇒ p90(9.6s)보다 넉넉히 위인 12s. p50 의 두 배가 조금 넘는다.
 *   ⚠️이 값들은 «평균 간격의 상한»이지 «최대 간격»이 아니다. 최대 간격은 알 수 없다.
 *   ⚠️팀리드 실대화 실측(별도): 한 턴이 38~48초였고 그 안에서 도구가 «몰려» 왔다 —
 *      12s 도 그 묶음을 «가를» 가능성이 남아 있다. 그래서 아래 ⑴⑵⑶ 이 본체다.
 * ⚠️★정직하게: **어떤 값도 「턴 중간에 안 돈다」를 보장하지 못한다**(도구 2개에 181초 걸린
 *   턴이 실제로 있다). 그래서 타이밍에만 기대지 않는다 —
 *   ⑴ ops 가 비면 아무것도 안 한다(히스토리 0) ⑵ 연속 감수는 히스토리 칸을 «새로 안 쌓는다»
 *   ⑶ 멱등이라 결과가 안 변한다. 이 셋이 «중간에 돌아도 해가 없게» 만드는 본체고, 12s 는 낭비를 줄이는 것뿐이다.
 * ⛔검사용 구멍: GODITOR_SPACING_DEBOUNCE_MS=0 이면 즉시, 음수면 «끈다». */
const _SPACING_DEBOUNCE_DEFAULT_MS = 12000;
const _SPACING_DEBOUNCE_MS = (() => {
  const raw = process.env.GODITOR_SPACING_DEBOUNCE_MS;
  const n = raw === undefined || raw === '' ? _SPACING_DEBOUNCE_DEFAULT_MS : Number(raw);
  return Number.isFinite(n) ? n : _SPACING_DEBOUNCE_DEFAULT_MS;
})();
let _spacingTimer = null;
/** 마지막 감수 결과 — 진단·검사가 «실제로 무엇이 됐나»를 읽는 자리. */
let _spacingLastRun = null;
/** ★우리 감수가 히스토리에 칸을 쌓은 «직후»의 꼭대기 seq. 다음 감수가 「그 뒤로 아무 일도
 *  없었나」를 이걸로 판정해서, 연속 감수가 되돌리기 목록을 도배하지 않게 한다. */
let _spacingOwnTipSeq = null;

/** 편집 도구가 «성공»할 때마다 감수를 다시 예약한다(=묶음이 이어지면 계속 미뤄진다). */
/* ⛔«남의 문서»를 여는/만드는 계열은 감수 대상이 아니다. 열자마자 감수가 돌면
   사람이 손으로 맞춘 기존 프로젝트를 «열기만 해도» 고쳐 쓴다.
   ★1차 방어는 「히스토리가 움직였나」(호출부)이고, 이건 그게 뚫렸을 때의 2차 방어다. */
const _SPACING_EXEMPT = new Set([
  'normalize_spacing',      // 감수가 감수를 부르는 고리
  'open_project', 'create_project', 'duplicate_project', 'delete_project',
]);

function _scheduleSpacingAudit(toolName) {
  if (_SPACING_DEBOUNCE_MS < 0) return;                 // 꺼짐
  if (_SPACING_EXEMPT.has(toolName)) return;
  if (_spacingTimer) clearTimeout(_spacingTimer);
  _spacingTimer = setTimeout(() => {
    _spacingTimer = null;
    /* 도구와 «같은 줄»에 세운다 — 감수가 편집 도중의 캔버스를 만지지 않게. */
    _serializeCall(() => runSpacingAudit({ reason: 'batch-idle', trigger: toolName }))
      .catch((e) => { try { console.warn('[spacing] 감수 실패(무시하고 계속):', e && e.message); } catch (_) {} });
  }, _SPACING_DEBOUNCE_MS);
  if (_spacingTimer && typeof _spacingTimer.unref === 'function') _spacingTimer.unref();
}

/**
 * 감수 한 바퀴 — 읽고(렌더러) → 계획하고(순수 spacing.js) → 적용한다(렌더러).
 * ★판단은 «한 곳»에서만 한다: 이 함수는 규격을 하나도 안 들고 있다.
 */
async function runSpacingAudit({ sectionId = null, reason = 'manual', trigger = null } = {}) {
  const inv = _rendererInvoker;
  if (!inv || typeof inv.readSpacingSequence !== 'function' || typeof inv.applySpacingOps !== 'function') {
    return (_spacingLastRun = { ok: false, code: 'API_MISSING', reason,
      message: 'renderer bridge has no readSpacingSequence/applySpacingOps' });
  }
  const read = await inv.readSpacingSequence({ sectionId });
  if (!read || read.ok === false) return (_spacingLastRun = Object.assign({ reason }, read || { ok: false, code: 'CALL_ERROR' }));

  const sections = [];
  const notes = [];
  let scanned = 0;
  for (const sec of (read.sections || [])) {
    scanned++;
    const plan = _spacing.normalizePlan(sec.items || []);
    for (const n of plan.notes) notes.push(`${sec.name || sec.sectionId}: ${n}`);
    if (plan.ops.length) sections.push({ sectionId: sec.sectionId, ops: plan.ops });
  }
  /* ★할 일이 없으면 «아무것도 안 한다» — 히스토리도 안 쌓인다. 멱등의 눈에 보이는 쪽. */
  if (!sections.length) {
    return (_spacingLastRun = { ok: true, reason, trigger, scannedSections: scanned, changedSections: 0, applied: 0, notes });
  }
  /* ★연속 감수는 히스토리 칸을 «새로 쌓지 않는다».
     조건 = 지금 꼭대기가 «우리가 지난번 감수로 만든 그 칸» 그대로다(=그 뒤로 아무 일도 없었다).
     그 칸은 이미 «감수 전» 상태를 들고 있으니, 덧쌓지 않아도 되돌리기는 감수 «전»으로 간다.
     ⛔사람이나 다른 도구가 사이에 뭔가 했으면 꼭대기가 달라지므로 «정상적으로» 새 칸을 쌓는다. */
  let noHistory = false;
  if (typeof inv.historyTip === 'function') {
    try {
      const t = await inv.historyTip();
      if (t && t.ok !== false && t.seq != null && _spacingOwnTipSeq != null && t.seq === _spacingOwnTipSeq) noHistory = true;
    } catch (_) {}
  }
  const applied = await inv.applySpacingOps({ sections, noHistory });
  /* ★히스토리 꼭대기를 «우리 구간»으로 끌어올린다. 안 하면 undo_last_mcp_change 가
     방금 쌓인 «감수» 칸을 보고 NOT_OURS 를 내거나, 감수만 물어뜯는다. */
  if (typeof inv.historyTip === 'function') {
    try {
      const t = await inv.historyTip();
      if (t && t.ok !== false && t.seq != null) {
        _spacingOwnTipSeq = t.seq;
        if (_lastMcpSeq != null) _lastMcpSeq = t.seq;
      }
    } catch (_) {}
  }
  return (_spacingLastRun = { ok: true, reason, trigger, scannedSections: scanned,
    changedSections: sections.length, ops: sections.reduce((n, s) => n + s.ops.length, 0),
    applied, noHistory, notes, plan: sections });
}

/* API_MISSING = 렌더러에 해당 window.* API가 없다. 대부분 «편집기(index.html)가 안 열려
 * 있어서»다 — 갤러리(projects.html)엔 캔버스 API가 없다(08-25 시연: add_section이
 * 'window.addSection not found'만 내서 원인을 못 알렸다). 원인(화면 상태)+우회(open_project)를
 * 담아준다. tools/call 결과에 일괄 적용 — 개별 executeJavaScript 문자열은 안 건드린다. */
function _enrichApiMissing(result) {
  try {
    if (!result || result.ok !== false || result.code !== 'API_MISSING') return result;
    const active = _activeProjectId();
    if (!active) {
      result.reason = 'editor_not_open';
      result.message = (result.message ? result.message + ' — ' : '')
        + '편집기가 열려 있지 않습니다(갤러리/기타 화면). open_project로 프로젝트를 먼저 여세요.';
      result.hint = 'The editor window is not showing a project (likely the gallery screen, which has no canvas APIs). '
        + 'Call open_project(projectId) to open a project in the editor, then retry this tool.';
    } else {
      result.hint = `Editor seems open on ${active} but the API is missing — the page may still be loading. Retry shortly.`;
    }
  } catch (_) {}
  return result;
}

/* ── 응답 다이어트 (2026-08-25) ──
 *   도구 «출력»도 유저 토큰이다. get_canvas_state 는 빈 스타일 필드("color":"","fontSize":"",
 *   "align":"")를 블록마다 실어 보냈다 — 정보 0에 블록당 ~45자. 섹션 100개짜리 실프로젝트면
 *   그것만으로 수만 자다. ⇒ 빈 값은 빼고, 텍스트는 120자로 자른다(잘랐다는 사실은 표시).
 *   ⚠️세이프본 캔버스 실측 39,041,257자 — 어떤 경로로도 원문이 응답에 실리면 안 된다.
 *      그래서 «자동 폴백»을 둔다: 다이어트 후에도 큰 페이지는 summary 로 내려간다. */
const _CANVAS_TEXT_CAP = 120;
const _CANVAS_AUTO_SUMMARY_CHARS = 24000; // 이 이상이면 summary 로 자동 폴백(≈6~7k토큰)
function _slimCanvasState(raw, detail) {
  if (!raw || raw.ok !== true || !Array.isArray(raw.sections)) return raw;
  if (detail === 'full') return raw;
  const MAX_SECTIONS = 150; // 요약조차 무한정 커지면 안 된다(섹션 수엔 상한이 없다)
  const summarize = () => {
    const shown = raw.sections.slice(0, MAX_SECTIONS);
    const rest = raw.sections.length - shown.length;
    return {
      ok: true,
      detail: 'summary',
      sections: shown.map(s => ({
        sectionId: s.sectionId,
        ...(s.name ? { name: s.name } : {}),
        blocks: (s.blocks || []).length,
        ...((s.blocks || []).length ? { first: String((s.blocks[0] || {}).text || ('(' + ((s.blocks[0] || {}).type || 'block') + ')')).slice(0, 40) } : {})
      })),
      ...(rest > 0 ? { omittedSections: rest } : {}),
      note: 'summary only — call get_canvas_state(sectionId) for one section\'s blocks.'
    };
  };
  if (detail === 'summary') return summarize();

  const slim = {
    ok: true,
    sections: raw.sections.map(s => ({
      sectionId: s.sectionId,
      ...(s.name ? { name: s.name } : {}),
      blocks: (s.blocks || []).map(b => {
        const o = { blockId: b.blockId, type: b.type };
        const t = String(b.text == null ? '' : b.text);
        if (t) o.text = t.length > _CANVAS_TEXT_CAP ? t.slice(0, _CANVAS_TEXT_CAP) + '…' : t;
        if (b.color) o.color = b.color;
        if (b.fontSize) o.fontSize = b.fontSize;
        if (b.align) o.align = b.align;
        /* ★2026-09-06 — 이 «허용목록»이 렌더러가 새로 보내는 필드를 «조용히» 버렸다.
           canvas-state 가 이미지·표·갭의 summary 를 실어 보내는데 여기서 사라져,
           블록은 «보이는데» 지목에 필요한 정보만 없는 상태가 됐다(반쯤 고쳐진 모양).
           ⇒ summary 는 이미 «경계된» 값이다(dataURL·셀 전문 없음). 그대로 싣는다.
           ⛔필드를 늘릴 땐 이 목록도 같이 봐라 — 안 그러면 또 조용히 버려진다. */
        if (b.summary && typeof b.summary === 'object' && Object.keys(b.summary).length) o.summary = b.summary;
        return o;
      })
    }))
  };
  const size = JSON.stringify(slim).length;
  if (size > _CANVAS_AUTO_SUMMARY_CHARS) {
    const s = summarize();
    s.note = `page too large for a full listing (${size} chars) — showing counts only. `
      + 'Call get_canvas_state(sectionId) for one section, or detail:"full" if you really need everything.';
    return s;
  }
  return slim;
}

function _registerDefaultTools() {
  registerTool(
    'read_project',
    async ({ includeFull = false } = {}) => {
      const pid = _activeProjectId();
      if (!pid) throw new Error('no active project');
      const proj = _readProjectFile(pid);
      const projectSize = Buffer.byteLength(JSON.stringify(proj), 'utf8');
      // ok 를 붙인다 — 나머지 도구가 전부 {ok:…} 라 이것만 없으면 ok 를 보는 클라이언트가
      // «성공을 실패로» 읽는다. 필드 추가라 기존 사용처는 안 깨진다.
      if (includeFull) return { ok: true, projectId: pid, projectSize, truncated: false, project: proj };

      /* ★기본은 «목차»다 — read_scratch_item 과 같은 규약(기본 잘라 주고, 전체는 명시 요청일 때만).
       *   pages[].canvas 는 인라인 base64 이미지를 통째로 물고 있어 실측 85MB 까지 간다.
       *   그걸 기본으로 뱉으면 부르는 AI 의 컨텍스트가 한 번에 날아간다.
       *   ⚠️자른 사실과 «원래 크기»를 같이 준다 — 조용히 자르면 AI 가 이게 전부인 줄 안다. */
      const pages = (proj.pages || []).map(pg => {
        const canvas = typeof pg.canvas === 'string' ? pg.canvas : '';
        const sectionIds = [...canvas.matchAll(/id="(sec_[A-Za-z0-9_-]+)"/g)].map(m => m[1]);
        return {
          id: pg.id,
          name: pg.name || pg.label || '',
          canvasSize: Buffer.byteLength(canvas, 'utf8'),
          sectionCount: sectionIds.length,
          sectionIds,
        };
      });
      return {
        ok: true, projectId: pid, projectSize, truncated: true,
        summary: {
          name: proj.name, version: proj.version,
          currentPageId: proj.currentPageId, updatedAt: proj.updatedAt,
          pageCount: pages.length, pages,
        },
        hint: 'Summary only — the full project JSON was omitted to avoid token blowup (projectSize tells you how big it is). '
          + 'Pass includeFull=true for the whole JSON (can be tens of MB). For canvas content prefer get_canvas_state / read_section.',
      };
    },
    {
      description: 'Read the currently active Goditor project. By default returns a SUMMARY only (page/section index + sizes) to avoid token blowup; '
        + 'pass includeFull=true to get the whole project JSON, which can be tens of MB. '
        + 'Response always carries projectSize (bytes) and truncated. For canvas content prefer get_canvas_state.',
      inputSchema: {
        type: 'object',
        properties: {
          includeFull: { type: 'boolean', description: 'If true, return the full project JSON (may be tens of MB). Default: false (summary index only).', default: false }
        },
        required: []
      }
    }
  );

  /* ── list_projects (2026-09-06) ────────────────────────────────────────────
   * 왜: create/open/read/duplicate_project 가 전부 「projectId 를 이미 안다」를 전제한다.
   *     셀러가 상품을 여럿 굴리는 게 정상이라, 목록이 없으면 「저번에 만든 그 템플릿」을
   *     클로드가 «스스로» 못 찾고 매번 사람이 id 를 대줘야 한다.
   * ★실측(2026-09-06, 실사용 ud 62개)이 설계를 세 군데 바꿨다:
   *   ⑴ 썸네일이 base64 라 «싣는 순간» 응답이 315,581B → 빼면 11,320B (28배). 옵션도 안 둔다.
   *   ⑵ 62개 중 21개가 같은 이름 "Untitled" 이고 중복 이름이 3종 더 있다
   *      ⇒ ★이름은 «키가 아니다». query 가 여러 개에 맞는 게 «정상»이라, 하나로 좁혀진 척하면
   *        클로드가 첫 번째를 열고 그게 틀린 프로젝트다. matched>1 은 «다른 모양»으로 답한다.
   *   ⑶ type·marketRef 는 실사용 전부 null → 뺀다. collabRef 는 협업이 붙으면 의미가 생기니 남긴다.
   * ★readdir 실패를 「0개」로 답하지 않는다 — _listProjectsImpl 이 dirError 를 같이 준다. */
  registerTool(
    'list_projects',
    async ({ limit = 100, query } = {}) => {
      if (!_projectOps || typeof _projectOps.list !== 'function')
        throw new Error('project ops not initialized (setProjectOps not called — app version too old?)');
      if (!Number.isInteger(limit) || limit < 1 || limit > 200)
        throw new Error(`invalid limit: ${limit} (integer 1~200)`);
      if (query !== undefined && query !== null) {
        if (typeof query !== 'string') throw new Error('query must be a string');
        if (query.length > 100) throw new Error(`query too long (${query.length} > 100)`);
      }
      const r = _projectOps.list({ withDiag: true });
      const all = (r && r.items) || [];
      // ★「폴더를 못 읽었다」를 「프로젝트가 0개」로 답하지 않는다.
      if (r && r.dirError) throw new Error(`cannot read projects directory: ${r.dirError}`);

      const q = (query || '').trim().toLowerCase();
      const hits = q ? all.filter(p => String(p.name || '').toLowerCase().includes(q)) : all;
      // ⛔thumbnail(base64)·type·marketRef 는 «싣지 않는다» — 위 주석 ⑴⑶ 참고.
      const slim = hits.slice(0, limit).map(p => ({
        id: p.id, name: p.name, createdAt: p.createdAt, updatedAt: p.updatedAt,
        favorite: !!p.favorite, collabRef: p.collabRef || null,
      }));
      const out = {
        ok: true,
        total: all.length,                 // 전체 프로젝트 수(질의 무관)
        matched: hits.length,              // query 에 맞은 수
        returned: slim.length,
        truncated: hits.length > slim.length,
        activeProjectId: _activeProjectId(),   // ★null 은 「편집기가 안 열렸다」지 「프로젝트가 없다」가 아니다
        projects: slim,
      };
      /* ★1개일 때와 N개일 때는 «모양이 달라야» 한다. 같은 모양이면 클로드가 첫 줄을 집는다. */
      if (q) {
        if (hits.length === 1) {
          out.unique = slim[0];
        } else if (hits.length > 1) {
          out.ambiguous = true;
          out.hint = `query "${query}" matched ${hits.length} projects — names are NOT unique in Goditor `
            + '(duplicates and many "Untitled" are normal). DO NOT pick one yourself: show the user the '
            + 'id + name + updatedAt of the candidates and let them choose, then pass that id to open_project.';
        } else {
          out.hint = `query "${query}" matched nothing. Call list_projects without query to see all ${all.length}.`;
        }
      }
      return out;
    },
    {
      description: 'List Goditor projects (newest first by updatedAt) so you can find one WITHOUT being told its id — '
        + 'the id you then pass to open_project / duplicate_project / read_project. '
        + 'Returns {total, matched, returned, truncated, activeProjectId, projects:[{id,name,createdAt,updatedAt,favorite,collabRef}]}. '
        + 'Thumbnails are never returned (they are base64 and would blow up the response). '
        + 'NOTE: project names are NOT unique — duplicates and many "Untitled" are normal, so when a query matches '
        + 'several, ask the user which id rather than guessing.',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 200, description: 'max projects to return (default 100).' },
          query: { type: 'string', maxLength: 100, description: 'case-insensitive substring match on the project name. May match several — see the note above.' }
        },
        required: []
      }
    }
  );

  /* ── export_sections (2026-09-06) ─────────────────────────────────────────
   * 현빈: 「특정 섹션(섹션아이디 함께), 전체 섹션 내보내기해줘 780px으로」
   * 앱엔 «이미» 있다(발행 드롭다운 · 섹션/페이지 속성패널). 폭도 함수가 인자로 받는다.
   * 여기서 여는 건 «입구»뿐이다.
   * ★★계측 실측(2026-09-06)이 이 도구의 모양을 정했다:
   *   ⑴ 충돌 시 will-download 가 `(1)` 을 붙이는데 그 «최종 경로»가 렌더러로 «안 돌아온다»
   *      → main 쪽 setSavePath 자리에서 모아야 한다. 아니면 ok:true 인데 파일을 못 찾는다.
   *   ⑵ ⛔**`path` 만 보면 «거짓 성공»이다** — 쓰기 불가 폴더로 내보내니
   *      state='interrupted' 인데 path 는 채워지고 bytes 는 0 이었다(파일 없음).
   *      ⇒ 성공 판정은 state==='completed' «하나»이고, 응답에 싣기 «전에»
   *        존재·크기를 다시 확인한다. 확인 못 한 경로는 files 에 «안» 넣는다. */
  registerTool(
    'export_sections',
    async ({ sectionId, format = 'png', width = 860, outDir, expectedProject, timeoutMs } = {}) => {
      if (sectionId !== undefined && sectionId !== null) {
        if (typeof sectionId !== 'string' || !sectionId.startsWith('sec_')) {
          throw new Error(`invalid sectionId: ${sectionId} (must start with "sec_")`);
        }
      }
      if (!['png', 'jpg'].includes(format)) {
        throw new Error(`invalid format: ${format} (png|jpg). ⛔gif 는 프레임 인코딩이라 수십 초가 걸려 이 도구에서 뺐다.`);
      }
      if (!Number.isInteger(width) || width < 320 || width > 2000) {
        throw new Error(`invalid width: ${width} (integer 320~2000)`);
      }
      if (outDir !== undefined && outDir !== null) {
        if (typeof outDir !== 'string' || !path.isAbsolute(outDir)) throw new Error('outDir must be an absolute path');
        if (!fs.existsSync(outDir) || !fs.statSync(outDir).isDirectory()) throw new Error(`outDir not a directory: ${outDir}`);
      }
      if (timeoutMs !== undefined && timeoutMs !== null) {
        if (!Number.isInteger(timeoutMs) || timeoutMs < 5000 || timeoutMs > 600000) {
          throw new Error(`invalid timeoutMs: ${timeoutMs} (integer 5000~600000)`);
        }
      }
      _assertExpectedProject(expectedProject);   // ★디스크에 파일을 쓰는 부작용 도구다
      if (!_rendererInvoker?.exportSections || !_rendererInvoker?.exportCollect) {
        throw new Error('renderer bridge not ready (app version too old?)');
      }

      const C = _rendererInvoker.exportCollect;
      C.begin(outDir || null);
      let r;
      try {
        r = await _rendererInvoker.exportSections({ sectionId, format, width });
      } catch (e) { C.end(); throw e; }
      if (!r || r.ok === false) { C.end(); return r || { ok: false, code: 'CALL_ERROR' }; }

      // ★한 장당 «캡처+픽셀검사»라 3섹션에 10초 넘게 걸린다(실측). 넉넉히 기다린다.
      const budget = timeoutMs || Math.max(20000, (r.requested || 1) * 15000);
      const items = await C.settle(r.requested || 1, budget);
      C.end();

      const files = [], failed = [];
      for (const it of items) {
        // ⛔state 가 completed 여도 «파일이 실제로 있는지»를 다시 본다(계측이 아니라 사실 확인).
        let stat = null;
        if (it.state === 'completed' && it.path) { try { stat = fs.statSync(it.path); } catch (_) { stat = null; } }
        if (stat && stat.size > 0) files.push({ name: it.filename, path: it.path, bytes: stat.size });
        else failed.push({ name: it.filename, state: it.state, intendedPath: it.intendedPath,
                           reason: it.state !== 'completed' ? `download ${it.state}` : 'file missing or empty' });
      }
      for (const nm of (r.failedNames || [])) failed.push({ name: nm, state: 'render_failed', reason: '섹션 렌더/캡처 실패' });

      return {
        ok: failed.length === 0,
        format, width,
        requested: r.requested || 0,
        exported: files.length,
        files, failed,
        outDir: outDir || null,
        hint: files.length
          ? 'files[].path 는 «존재를 확인한» 경로다. outDir 을 안 주면 사용자의 다운로드 폴더에 떨어지고, 같은 이름이 있으면 "(1)"이 붙는다.'
          : 'No file was verified on disk. Check failed[] — a completed download can still leave no file (e.g. unwritable folder).',
      };
    },
    {
      description: 'Export section(s) of the OPEN project to PNG/JPG image files on disk — the last step MCP was missing '
        + '("fill the page" worked, "get the finished page out" did not). sectionId → that one section; omit → every section. '
        + 'width is a real argument (e.g. 780), not fixed at the UI default 860. '
        + 'Returns files[] with paths that were VERIFIED to exist on disk; anything else lands in failed[]. '
        + 'Rendering + the pixel check take seconds PER section, so a full export of many sections takes minutes.',
      inputSchema: {
        type: 'object',
        properties: {
          sectionId: { type: 'string', description: 'sec_<id> — export just this section. Omit to export all sections.' },
          format:    { type: 'string', enum: ['png', 'jpg'], description: 'default png. (gif is intentionally not offered here — encoding takes tens of seconds.)' },
          width:     { type: 'integer', minimum: 320, maximum: 2000, description: 'output width in px (default 860).' },
          outDir:    { type: 'string', description: 'absolute directory to write into. Omit → the user download folder.' },
          expectedProject: { type: 'string', description: 'proj_<digits>. Refuses if a different project is open.' },
          timeoutMs: { type: 'integer', minimum: 5000, maximum: 600000, description: 'how long to wait for the files (default: 15s per section, min 20s).' }
        },
        required: []
      }
    }
  );

  /* ── undo_last_mcp_change (2026-09-06) ────────────────────────────────────
   * ⛔이름을 `undo` 로 «안» 짓는다 — 「앱 undo 를 그대로 준다」로 읽히면 안 된다.
   * ★undo 스택은 «사람 조작과 MCP 조작이 섞인 한 스택»이다(블록 26종 전부 여기 쌓인다).
   *   그래서 앱 undo 를 그대로 열면 «사람이 방금 한 것»을 되돌린다 = 안전장치가 아니라 사고 도구.
   * ★★소스를 읽어야만 보이는 함정: undo() 는 맨 위에서 시작하면 ensureHistoryCheckpoint 를
   *   «스스로 먼저» 민다. 사용자가 방금 타이핑해 체크포인트가 안 된 상태면 그 타이핑이 새 항목으로
   *   박히고 undo 가 «그걸» 되돌린다. seq 대조로는 못 막는다(그 시점엔 top 이 아직 우리 것).
   *   ⇒ 그래서 undoOnce 가 «USER_BUSY»(레포 공통 술어)로 그 순간을 막는다.
   * ⛔협업 스코프(_useScoped)는 «건드리지 않는다» — 비협업에서 켜면 협업 경로에 회귀가 난다. */
  registerTool(
    'undo_last_mcp_change',
    async ({ expectedProject } = {}) => {
      _assertExpectedProject(expectedProject);
      if (!_rendererInvoker?.historyTip || !_rendererInvoker?.undoOnce) {
        throw new Error('renderer bridge not ready (app version too old?)');
      }
      if (_lastMcpSeq == null) {
        return { ok: false, code: 'NOTHING_TRACKED',
          reason: 'This session has not made a tracked edit yet (or the project was switched since).',
          hint: 'Only an edit made through MCP in this app session can be undone here.' };
      }
      const tip = await _rendererInvoker.historyTip();
      if (!tip || tip.ok === false) return tip || { ok: false, code: 'CALL_ERROR' };
      if (tip.empty || !tip.canUndo) {
        return { ok: false, code: 'NOTHING_TO_UNDO', reason: 'History has no earlier state on this page.', historyLen: tip.len };
      }
      if (tip.seq !== _lastMcpSeq) {
        // 우리 항목이 «아직 스택에 있는가»로 두 사실을 가른다.
        let has = false;
        try { const h = await _rendererInvoker.historyHasSeq(_lastMcpSeq); has = !!(h && h.has); } catch (_) {}
        return has
          ? { ok: false, code: 'NOT_OURS',
              reason: 'The most recent change was NOT made by these tools — refusing to undo it.',
              top: { action: tip.action || null },
              hint: 'A person (or another tool) changed the canvas after our last edit. Ask the user to undo it themselves if that is what they want.' }
          : { ok: false, code: 'EVICTED',
              reason: `Our change is no longer in the undo history (it holds at most 50 steps).`,
              top: { action: tip.action || null },
              hint: 'Too many later changes pushed it out. It cannot be undone from here.' };
      }
      /* ★사용자 미커밋 편집 가드는 undoOnce 안의 USER_BUSY 로 옮겼다 —
         「라이브==맨위」 비교는 pushHistory 가 «변경 전»을 찍어서 항상 어긋난다(실측). */
      /* ★우리 «한 호출»이 만든 칸 수만큼만 되돌린다(실측: build_basic_section 은 4칸).
         ⛔경계 밖으로는 한 칸도 안 간다 — from 에 닿으면 «즉시» 멈춘다. */
      const target = (_lastMcpSeqFrom == null) ? 1 : Math.max(1, _lastMcpSeq - _lastMcpSeqFrom);
      const undoneSeq = _lastMcpSeq, fromSeq = _lastMcpSeqFrom;
      let steps = 0;
      for (let i = 0; i < target; i++) {
        const cur = await _rendererInvoker.historyTip();
        if (!cur || cur.ok === false || cur.empty || !cur.canUndo) break;
        if (fromSeq != null && cur.seq != null && cur.seq <= fromSeq) break;   // ★우리 경계
        const one = await _rendererInvoker.undoOnce();
        if (!one || one.ok === false) {
          if (steps === 0) return one || { ok: false, code: 'CALL_ERROR' };
          break;   // 중간에 막히면 «거기까지»를 정직하게 보고한다
        }
        steps++;
      }
      _lastMcpSeq = null; _lastMcpSeqFrom = null;   // ★«소모» — 연달아 부르면 2번째는 NOTHING_TRACKED
      const after = await _rendererInvoker.historyTip();
      return { ok: steps > 0, undoneSteps: steps, plannedSteps: target,
        undone: { seq: undoneSeq, fromSeq, action: tip.action || null },
        partial: steps < target,
        historyPos: after && after.pos, historyLen: after && after.len,
        hint: steps < target
          ? 'Stopped early — only part of the last tool call was rolled back. The canvas may be in an in-between state; check it.'
          : 'Rolled back exactly the steps of the LAST tool call these tools made (one call can be several history steps). It will not walk further back.' };
    },
    {
      description: 'Undo the LAST edit these MCP tools made — only if it is still the most recent change on the canvas. '
        + 'One tool call can be several history steps (build_basic_section is 4), so this rolls back exactly that call, never further. '
        + 'It will NOT undo a change a person made and never walks past its own call: if the top of the '
        + 'history is not ours, it refuses and tells you why (NOT_OURS / USER_BUSY / EVICTED / NOTHING_TO_UNDO). '
        + 'Use it to take back an edit you just made by mistake.',
      inputSchema: {
        type: 'object',
        properties: {
          expectedProject: { type: 'string', description: 'proj_<digits>. Refuses if a different project is open.' }
        },
        required: []
      }
    }
  );

  /* ── normalize_spacing (2026-09-07) ── ★«숨김» 도구다 ───────────────────────
   * ⛔클로드 보라고 만든 게 아니다. hideTool 로 tools/list 에서 빠지므로 사용자 토큰은 0 이다.
   *   ⓔ 지시대로 감수는 «서버가 알아서» 돈다(_scheduleSpacingAudit). 이 도구는 QA·하네스가
   *   「지금 돌려라」로 부르고 «실제로 무엇이 됐나»를 읽는 통로다 — 양끝을 재려면 필요하다.
   *   ⇒ 이 도구가 「도구를 부르게 하는 길」로 되살아나면 안 된다. 숨김을 풀지 마라. */
  registerTool(
    'normalize_spacing',
    async ({ sectionId = null, expectedProject } = {}) => {
      _assertExpectedProject(expectedProject);
      return runSpacingAudit({ sectionId: sectionId || null, reason: 'tool' });
    },
    {
      description: '(internal/QA) Run the gap audit pass now and report what changed.',
      inputSchema: {
        type: 'object',
        properties: {
          sectionId: { type: 'string', description: 'sec_… — one section only. Omit for the whole page.' },
          expectedProject: { type: 'string', description: 'proj_<digits>. Refuses if a different project is open.' }
        },
        required: []
      }
    }
  );
  hideTool('normalize_spacing');




  registerTool(
    'duplicate_project',
    async ({ sourceProjectId, newName } = {}) => {
      if (!_projectOps || typeof _projectOps.duplicate !== 'function')
        throw new Error('project ops not initialized (setProjectOps not called)');
      // sourceProjectId 생략 시 현재 활성 프로젝트 복제
      const src = sourceProjectId || (_activeProjectId());
      if (!src) throw new Error('sourceProjectId required (no active project)');
      const r = await _projectOps.duplicate({ sourceProjectId: src, newName });
      if (!r || r.ok === false) throw new Error((r && r.error) || 'duplicate failed');
      return { ok: true, newProjectId: r.newProjectId, newName: r.newName };
    },
    {
      /* ⛔예전 설명은 「full copy (… + claude-pm folder)」였는데 ★거짓이었다 —
           _duplicateProjectImpl 은 images/·assets/ 만 옮긴다(claude-pm 은 안 따라온다).
         ★거짓인 것과 기능이 좁은 것은 «별개»고, 거짓은 먼저 멈춘다.
           이 문장은 «클로드가 읽고 사용자에게 옮기는» 말이라 무겁다 — 사용자는
           「메모까지 복사됐다」고 «듣는다». (동작 확대는 별건 — 참조 무결성부터 재야 한다) */
      description: 'Duplicate a Goditor project — copies proj.json + assets/ + images/, re-keyed to a fresh project id. ⚠️Does NOT copy the claude-pm folder (section memos, checklists) — those stay only in the original. sourceProjectId optional (defaults to the active project). Use to branch a base template into a new product project. Returns {newProjectId, newName}. Does NOT open it; the user opens it in the editor.',
      inputSchema: {
        type: 'object',
        properties: {
          sourceProjectId: { type: 'string', description: '★proj_<digits> — WHAT to copy. Omitting it means "the active project", which is refused unless the target was confirmed (open_project) — a blank call could copy hundreds of MB of the user\'s data.' },
          newName: { type: 'string', description: '새 프로젝트 이름(생략 시 "원본명 (사본)").' }
        },
        required: []
      }
    }
  );

  /* ★프로젝트 «이름 수정» — 2026-09-07 신설. 그전엔 만들 수만 있고 «고칠 수가 없었다». */
  registerTool(
    'rename_project',
    async ({ projectId, name } = {}) => {
      if (!_projectOps || typeof _projectOps.rename !== 'function')
        throw new Error('project ops not initialized (setProjectOps 에 rename 이 없다)');
      if (!projectId || typeof projectId !== 'string')
        throw new Error('projectId required (get it from list_projects)');
      if (typeof name !== 'string' || !name.trim())
        throw new Error('name required (non-empty string)');
      const r = await _projectOps.rename({ projectId, name });
      if (!r || r.ok === false) { const e = new Error((r && r.error) || 'rename failed'); e.code = r && r.code; throw e; }
      return { ok: true, projectId: r.projectId, name: r.name,
               previousName: r.previousName, changed: r.changed !== false };
    },
    {
      description: 'Rename a project (its display name in the gallery). Takes projectId directly — does NOT act on the active project. Non-destructive.',
      inputSchema: { type: 'object',
        properties: { projectId: { type: 'string', description: 'proj_xxx (from list_projects)' },
                      name: { type: 'string', description: '새 이름(1~100자)' } },
        required: ['projectId', 'name'] }
    }
  );

  /* ★프로젝트 «삭제» — 2026-09-07 신설. 현빈 지시.
     왜 없었나: 도구 33개에 삭제가 «없었다». 그래서 프로젝트를 치우려면 사람이 파일시스템에서
     rm 해야 했고, 그러면 앱이 그걸 «모르고» activeProjectId 가 죽은 id 를 계속 가리켰다(실측).
     ⇒ ★「MCP 로 만든 것을 MCP 로 못 치운다」가 실물로 확인된 자리다.

     설계 결정 셋(전부 근거가 있다):
     ⑴ ★휴지통으로 옮긴다 — 영구삭제 «아니다». 되돌릴 수 있으면 위험 등급이 한 칸 내려간다.
     ⑵ ★마지막 프로젝트도 지울 수 있다. 갤러리(사람 화면)에 그 제약이 없고, 0개 상태를 앱이
        이미 다룬다(「아직 프로젝트가 없어요」 — 실측). 도구가 사람보다 빡빡하면 «불일치»다.
        ⚠️`delete_section` 이 마지막 섹션을 막는 것과 «다른 사정»이다 — 섹션 0개는 편집기가
        빈 껍데기가 되지만, 프로젝트 0개는 갤러리가 정상 안내를 띄운다.
     ⑶ ⛔`expectedProject` 안전벨트를 «안» 붙인다. 그 벨트는 「대상을 지목 «안» 하는 도구」
        (delete_section·delete_block 은 「지금 열린 것」에서 지운다)를 위한 것이다.
        이 도구는 projectId 를 «직접 지목»하므로 지목한 걸 또 확인할 이유가 없다. */
  registerTool(
    'delete_project',
    async ({ projectId } = {}) => {
      if (!_projectOps || typeof _projectOps.delete !== 'function')
        throw new Error('project ops not initialized (setProjectOps 에 delete 가 없다 — 앱 버전이 낡았나?)');
      if (!projectId || typeof projectId !== 'string')
        throw new Error('projectId required (get it from list_projects). 예: "proj_1788754539358"');
      const r = await _projectOps.delete({ projectId });
      if (!r || r.ok === false) {
        const e = new Error((r && r.error) || 'delete failed');
        e.code = r && r.code; throw e;
      }
      return {
        ok: true, projectId: r.projectId, trashed: true,
        wasActive: r.wasActive, activeCleared: r.activeCleared,
        activeProject: _activeProjectId(),
        hint: r.wasActive
          ? '★지운 것이 «활성»이었다 — 활성을 비웠다. 편집을 이어가려면 open_project 로 다른 프로젝트를 열어라.'
          : '활성 프로젝트는 그대로다.',
        note: '휴지통으로 옮겼다(영구삭제 아님). 되돌리려면 macOS 휴지통에서 복원해라.',
      };
    },
    {
      description: 'Delete a project — DESTRUCTIVE but RECOVERABLE: the project folder is moved to the macOS Trash, not erased. '
        + 'Takes projectId directly (from list_projects), so it does NOT act on the "active" project and needs no expectedProject guard. '
        + 'The last remaining project CAN be deleted (the gallery shows an empty-state screen). '
        + 'If the deleted project was the active one, the active target is cleared — open_project another one before editing.',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'proj_xxx to delete (from list_projects). 휴지통으로 이동한다.' }
        },
        required: ['projectId']
      }
    }
  );

  // 08-25 실사용 구멍 #1 — 프로젝트 «생성» 도구가 duplicate뿐이라 빈 프로젝트를 못 만들었다.
  // 생성 로직은 main.js _createProjectImpl(갤러리 「새 프로젝트」와 같은 포맷 + projects:save 코어 재사용).
  registerTool(
    'create_project',
    async ({ name } = {}) => {
      if (!_projectOps || typeof _projectOps.create !== 'function')
        throw new Error('project ops not initialized (setProjectOps not called — app version too old?)');
      if (name !== undefined && name !== null && typeof name !== 'string') throw new Error('name must be a string');
      const r = await _projectOps.create({ name });
      if (!r || r.ok === false) throw new Error((r && r.error) || 'create failed');
      /* ★create 는 대상이 «없는 게 정상»이라 게이트를 안 탄다(§3). 대신 「만들었지만 활성은 그대로」를
         문장이 아니라 «값»으로 돌려준다 — 그래야 클로드가 열지 않고 편집하다 거절당하는 왕복을 안 돈다. */
      const activeNow = _activeProjectId();
      return {
        ok: true, projectId: r.projectId, name: r.name,
        activeProject: activeNow,
        opened: false,
        hint: `Project created but NOT opened — the ACTIVE project is still ${activeNow || '(none — editor not open)'}, `
          + `so editing tools would NOT touch the new one (and are refused until a target is confirmed). `
          + `Call open_project("${r.projectId}") to make it the target.`,
      };
    },
    {
      description: 'Create a NEW empty Goditor project (same format as the gallery "새 프로젝트" button: 1 empty page, main/dev branches). Returns {projectId, name}. Does NOT open it — call open_project(projectId) to make it the active project before editing.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '프로젝트 이름(≤100자). 생략 시 "Untitled".' }
        },
        required: []
      }
    }
  );

  // 08-25 실사용 구멍 #2 — 편집 도구 전부가 «활성 프로젝트» 대상인데 전환 수단이 없었다
  // (duplicate가 만든 복제본을 MCP로 만질 방법이 없었다). navigate = 전환:
  // _activeProjectId()가 편집기 창 URL(?project=)을 읽으므로, 창을 그 프로젝트로 이동시키면 곧 전환이다.
  registerTool(
    'open_project',
    async ({ projectId, timeoutMs } = {}) => {
      if (!projectId || typeof projectId !== 'string' || !/^proj_\d+$/.test(projectId)) {
        throw new Error('projectId required (proj_<digits>)');
      }
      if (timeoutMs !== undefined && timeoutMs !== null) {
        if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 600000) {
          throw new Error(`invalid timeoutMs: ${timeoutMs} (integer 1000~600000)`);
        }
      }
      if (!_projectOps || typeof _projectOps.open !== 'function')
        throw new Error('project ops not initialized (setProjectOps not called — app version too old?)');
      // ★전환 전체를 배타 구간에 넣는다 — 이 구간 동안 편집 도구는 디스패처에서 큐잉된다.
      //   (전환끼리도 직렬: 두 open 이 겹치면 서로의 문서를 덮는다.)
      _lastMcpSeq = null; _lastMcpSeqFrom = null;   // ★스택은 «페이지별»이라 전환하면 우리 seq 는 무의미해진다
      const r = await _runExclusiveSwitch({ projectId }, () => _projectOps.open({ projectId, timeoutMs }));
      if (!r) throw new Error('open failed');
      // ★로드 대기 실패(load_timeout/load_error/navigated_away)는 «구조화된 실패»로 돌려준다 —
      //   code 없이 throw 하면 호출자가 「왜」를 모르고, 「일단 ok」로 덮으면 편집이 조용히 사라진다.
      if (r.ok === false) {
        if (r.code === 'load_timeout' || r.code === 'load_error' || r.code === 'navigated_away') {
          return {
            ok: false, code: r.code, projectId,
            previousProject: r.previousProject != null ? r.previousProject : null,
            previousScreen: r.previousScreen != null ? r.previousScreen : null,
            waitedMs: r.waitedMs, timeoutMs: r.timeoutMs,
            error: r.error || `open not confirmed (${r.code})`,
            hint: 'The editor did NOT confirm the project is applied. DO NOT run editing tools now — writes would land on a canvas that is about to be replaced and vanish silently. Retry open_project (optionally with a larger timeoutMs), or check the app window.',
          };
        }
        throw new Error(r.error || 'open failed');
      }
      return {
        ok: true, projectId: r.projectId,
        previousProject: r.previousProject != null ? r.previousProject : null,
        // previousProject:null 이 «갤러리였다»인지 «못 읽었다»인지 구분되게 화면 이름을 같이 준다.
        previousScreen: r.previousScreen != null ? r.previousScreen : null,
        // 호출자 대조용 확인값 — 「무엇이 열렸나」를 응답만 보고 알 수 있게.
        activeProjectId: r.activeProjectId != null ? r.activeProjectId : r.projectId,
        ready: r.ready === true,
        waitedMs: r.waitedMs != null ? r.waitedMs : null,
        sections: r.sections != null ? r.sections : null,
      };
    },
    {
      description: 'Open a project in the editor = switch the ACTIVE project all editing tools target. Waits until the editor has APPLIED it, so editing right after ok:true is safe. Returns {projectId, activeProjectId, ready, sections, waitedMs, previousProject}. ok:false + code:"load_timeout" means NOT open — do not edit, retry. Unsaved changes of the previous project are flushed as on refresh. Use after create_project/duplicate_project, or when tools fail with "editor not open".',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: '열 프로젝트 id (proj_<digits>)' },
          timeoutMs: { type: 'integer', description: 'max wait for the editor to confirm (1000~600000, default 120000)' }
        },
        required: ['projectId']
      }
    }
  );

  registerTool(
    'read_section',
    async ({ sectionId } = {}) => {
      if (!sectionId) throw new Error('sectionId required');
      /* ⚠️실측(08-15): 이 도구는 «존재한 적 없는» 스키마를 뒤지고 있었다.
       *   프로젝트 파일에 sections 배열은 없다 — 섹션은 pages[].canvas 안 «HTML 문자열»이다.
       *   그래서 proj.sections 는 늘 [] 였고, get_canvas_state 가 방금 준 sectionId 를 넣어도
       *   'section not found' 만 났다(실측으로 확인).
       *   ⇒ 지금 열려 있는 캔버스가 정본이다. get_canvas_state 와 «같은 경로»로 읽는다. */
      if (!_rendererInvoker || typeof _rendererInvoker.getCanvasState !== 'function') {
        throw new Error('editor not running — read_section은 편집기 창이 열려 있어야 합니다(캔버스가 정본).');
      }
      const r = await _rendererInvoker.getCanvasState({ sectionId });
      if (r && r.ok === false) return r;   // USER_BUSY 등은 그대로 올린다
      const sections = (r && r.sections) || [];
      const sec = sections.find(s => s.sectionId === sectionId || s.id === sectionId);
      if (!sec) throw new Error(`section not found: ${sectionId}`);
      const texts = (sec.blocks || [])
        .map(b => (b && typeof b.text === 'string') ? b.text : '')
        .filter(Boolean);
      return { ok: true, sectionId, section: sec, texts };
    },
    {
      description: 'Read a specific section by id and extract its text content.',
      inputSchema: {
        type: 'object',
        properties: { sectionId: { type: 'string' } },
        required: ['sectionId']
      }
    }
  );

  registerTool(
    'list_memories',
    async ({ projectFolder } = {}) => {
      // PM-B template-generator.mjs (ES module) — dynamic import
      let helper = null;
      try {
        helper = await import('./template-generator.mjs');
      } catch (_) {
        helper = null;
      }
      if (helper && typeof helper.listMemories === 'function') {
        return await helper.listMemories({ projectFolder });
      }

      // Fallback: 직접 NOTES.md / project.meta.json 스캔 (PM-B 실제 파일명)
      /* ⛔여기가 «뿌리를 아예 안 쓰는 우회로»였다 — 호출자가 준 절대경로를 그대로 읽어
           `<userData>/accounts/acct_철수…/…/claude-pm` 하나면 남의 계정 메모·제목이 나왔다.
         ★계정별 폴더로 가른 의미가 이 한 줄로 사라진다. 같은 파일의 export_sections 는
           outDir 을 검사하는데(isAbsolute+statSync) 여기만 «검사가 0줄»이었다.
         ⇒ 현재 계정 뿌리 «안»으로 봉쇄한다. 밖을 가리키면 실행하지 않는다. */
      const root = _getProjectsDir();
      const folder = projectFolder || root;
      const realRoot = path.resolve(root);
      const realFolder = path.resolve(folder);
      if (realFolder !== realRoot && !realFolder.startsWith(realRoot + path.sep)) {
        return { ok: false, code: 'FOLDER_OUT_OF_ROOT',
          error: 'list_memories 는 현재 계정의 프로젝트 폴더 안만 읽습니다.',
          hint: 'Pass a folder inside the active account\'s projects directory, or omit projectFolder to use it.' };
      }
      if (!fs.existsSync(folder)) {
        return { folder, memories: [], note: 'folder not found' };
      }
      const memories = [];
      const notesPath = path.join(folder, 'NOTES.md');
      if (fs.existsSync(notesPath)) {
        memories.push({
          type: 'notes',
          path: notesPath,
          content: fs.readFileSync(notesPath, 'utf8')
        });
      }
      const metaPath = path.join(folder, 'project.meta.json');
      if (fs.existsSync(metaPath)) {
        try {
          memories.push({
            type: 'meta',
            path: metaPath,
            data: JSON.parse(fs.readFileSync(metaPath, 'utf8'))
          });
        } catch (e) {
          memories.push({ type: 'meta', path: metaPath, error: e.message });
        }
      }
      return { folder, memories };
    },
    {
      description: 'List NOTES.md / meta.json memories for a project folder.',
      inputSchema: {
        type: 'object',
        properties: { projectFolder: { type: 'string' } },
        required: []
      }
    }
  );

  // Phase 2 MVP — 캔버스에 텍스트 블록 1개 추가. renderer의 window.addTextBlock을 main 통해 호출.
  registerTool(
    'add_text_block',
    async ({ type = 'body', content = '', sectionId, align } = {}) => {
      if (!_rendererInvoker || typeof _rendererInvoker.addTextBlock !== 'function') {
        throw new Error('renderer bridge not initialized (setRendererInvoker not called)');
      }
      // type whitelist (raw interpolation 안전성). makeTextBlock 지원 7종.
      const allowedTypes = ['body', 'h1', 'h2', 'h3', 'label', 'caption', 'bullet'];
      if (!allowedTypes.includes(type)) {
        throw new Error(`invalid type: ${type}. allowed: ${allowedTypes.join('|')}`);
      }
      if (align !== undefined && !['left', 'center', 'right'].includes(align)) {
        throw new Error(`invalid align: ${align}. allowed: left|center|right`);
      }
      // content 검증 (code-point 단위, 한글 안전)
      const text = String(content || '');
      const codePointLen = [...text].length;
      if (codePointLen === 0) throw new Error('content required');
      if (codePointLen > 500) throw new Error(`content too long (${codePointLen} > 500)`);
      // renderer 호출 (가드 + executeJavaScript는 main 측 helper에서)
      return await _rendererInvoker.addTextBlock({ type, content: text, sectionId, align });
    },
    {
      description: 'Add a single text block (Phase 2 MVP). Inserts after currently selected block in active section. Requires user not editing — returns { ok:false, code:"USER_BUSY" } if user is typing.',
      inputSchema: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['body', 'h1', 'h2', 'h3', 'label', 'caption', 'bullet'], description: 'block style (default: body). label=작은 강조라벨, caption=캡션, bullet=목록' },
          content: { type: 'string', description: 'text content (1~500 code points)' },
          sectionId: { type: 'string', description: 'optional sec_xxx — if omitted, uses currently selected section' },
          align: { type: 'string', enum: ['left', 'center', 'right'], description: 'text align. omit = inherit section align' }
        },
        required: ['content']
      }
    }
  );

  // Phase 3 MVP — 캔버스에 섹션 1개 추가. renderer의 window.addSection 호출.
  // sourceScratchIds: 호출 시 자동으로 dataset.memo에 "출처: sp_xxx, ..." 한 줄 기록 (P/G/E + Codex 리뷰).
  registerTool(
    'add_section',
    async ({ empty = false, bg, beforeId, afterId, sourceScratchIds } = {}) => {
      if (!_rendererInvoker || typeof _rendererInvoker.addSection !== 'function') {
        throw new Error('renderer bridge not initialized (setRendererInvoker not called)');
      }
      if (bg !== undefined && !/^#?[0-9a-fA-F]{3,8}$/.test(String(bg))) {
        throw new Error(`invalid bg color: ${bg}`);
      }
      if (beforeId !== undefined && (typeof beforeId !== 'string' || !beforeId.startsWith('sec_'))) {
        throw new Error(`invalid beforeId: ${beforeId} (must start with "sec_")`);
      }
      if (afterId !== undefined && (typeof afterId !== 'string' || !afterId.startsWith('sec_'))) {
        throw new Error(`invalid afterId: ${afterId} (must start with "sec_")`);
      }
      if (beforeId && afterId) throw new Error('beforeId and afterId are mutually exclusive');
      // sourceScratchIds 검증 — 배열 + 각 항목 sp_ prefix.
      let scratch;
      if (sourceScratchIds !== undefined && sourceScratchIds !== null) {
        if (!Array.isArray(sourceScratchIds)) throw new Error('sourceScratchIds must be an array of sp_xxx strings');
        if (sourceScratchIds.length > 16) throw new Error('sourceScratchIds too many (max 16)');
        for (const s of sourceScratchIds) {
          if (typeof s !== 'string' || !/^sp_[A-Za-z0-9_-]+$/.test(s)) {
            throw new Error(`invalid sourceScratchIds entry: ${s} (must match /^sp_[A-Za-z0-9_-]+$/)`);
          }
        }
        scratch = sourceScratchIds;
      }
      return await _rendererInvoker.addSection({ empty: !!empty, bg, beforeId, afterId, sourceScratchIds: scratch });
    },
    {
      description: 'Add a new section. Default = appended after selected (or canvas end). Use beforeId/afterId to insert at a specific position. Default body = gap + h2 placeholder + gap. empty:true = only top/bottom gaps. sourceScratchIds: optional sp_xxx[] — auto-records "출처: sp_aa, sp_bb" line into dataset.memo for traceability.',
      inputSchema: {
        type: 'object',
        properties: {
          expectedProject: { type: 'string', description: 'optional proj_<digits> — the project you INTEND to change. Mismatch with the open project ⇒ refused. Also confirms the target for the rest of this conversation.' },
          empty: { type: 'boolean', description: 'true = skip default h2 block (only gap blocks). default false' },
          bg: { type: 'string', description: 'optional section background hex color (e.g. #f5f5f5)' },
          beforeId: { type: 'string', description: 'optional sec_xxx — insert the new section BEFORE this one' },
          afterId:  { type: 'string', description: 'optional sec_xxx — insert the new section AFTER this one' },
          sourceScratchIds: { type: 'array', items: { type: 'string' }, description: 'optional sp_xxx[] — auto-tagged into dataset.memo as source trace ("출처: sp_xx, ..."). Max 16 ids.' }
        },
        required: []
      }
    }
  );

  /* put_image — 밖(클로드 앱 등)에서 «이미지 바이트»를 들여보내는 유일한 입구.
   * 현빈 지시(2026-08-30): 「기본은 캔버스에 바로, 요청하면 보관함에」
   *
   * ★설계 원칙 셋:
   *  ⑴ «항상» 먼저 스크래치에 넣는다 → sp_xxx 를 얻고, 캔버스에는 그 id 로 붙인다.
   *     기존 add_asset_block(scratchId) 가 렌더러에서 IndexedDB 를 직접 읽어 IPC 폭증을 피한다.
   *     ⇒ 큰 이미지 대응이 «이미 되어 있는» 경로를 그대로 탄다. 새 경로를 만들지 않는다.
   *  ⑵ 붙이는 로직을 새로 짜지 않는다 — 기존 add_asset_block 을 그대로 호출한다.
   *  ⑶ ★「성공 반환 = 실제로 됐음」이 아니다. 프로젝트가 없으면 스크래치 저장이 «조용히 스킵»되므로
   *     렌더러(_scratchAddForMcp)가 앞에서 막고 뒤에서 되읽어 확인한다.
   *
   * ⚠️target="scratch" 도 «프로젝트가 열려 있어야» 한다 — 스크래치는 프로젝트+페이지에 묶인다.
   * ⚠️상한은 기존 _MKP_MAX_IMGSRC 와 «같은 값»을 쓴다(새 숫자를 만들지 않는다).
   *   초과 시 «조용히 줄이지 않고» 거절한다 — 사용자 이미지를 우리가 임의로 손대지 않는다.
   */
  const _PUT_IMAGE_MAX = 7 * 1024 * 1024; // = _MKP_MAX_IMGSRC (base64 7M chars ≈ 원본 5MB)
  registerTool(
    'put_image',
    async ({ image, target = 'canvas', sectionId, preset = 'img1', width } = {}) => {
      if (!_rendererInvoker || typeof _rendererInvoker.scratchAdd !== 'function') {
        throw new Error('renderer bridge not initialized (setRendererInvoker not called)');
      }
      if (typeof image !== 'string' || !image) throw new Error('image must be a non-empty dataURL string');
      /* ⚠️여기 문지기는 «검사기와 같은 관대함»이어야 한다. 앞 판은 이 줄만 대소문자 구분이라
       *   `data:IMAGE/PNG;base64,<온전한 PNG>` 를 put_image 가 거절하고 update_block 은 통과시켰다
       *   — «같은 입력이 문에 따라 갈리는» 오탐이다(적대검수 2026-09-07). 브라우저는 정상 렌더한다.
       *   ⇒ /i + 파라미터(;charset=…) 허용으로 _assertImageSrcIntact 의 파서와 맞춘다. */
      if (!/^data:image\/[a-zA-Z0-9.+-]+(?:;[^;,]*)*;base64,/i.test(image)) {
        throw new Error('image must be a data URL: data:image/<type>;base64,<...> (file paths are not accepted)');
      }
      if (image.length > _PUT_IMAGE_MAX) {
        throw new Error(`image too large (${image.length} > ${_PUT_IMAGE_MAX} chars ≈ 5MB). `
          + '줄여서 다시 주세요 — 우리가 임의로 축소하지 않습니다.');
      }
      // ★접두사·길이만 보던 자리 — 「온전한가」를 아무도 안 봐서 잘린 PNG 가 «성공»으로 저장됐다
      //   (2026-09-07 실측: 4,849B 원본이 3,472B 로 잘려 들어옴). ⛔수선하지 않고 «거절»한다.
      let imageCheck;
      try {
        imageCheck = _assertImageSrcIntact(image, 'image');
      } catch (e) {
        if (e && e.imageCheckError) {
          return { ok: false, code: e.code, message: e.message, ...e.detail };
        }
        throw e;
      }
      const targets = ['canvas', 'scratch'];
      if (!targets.includes(target)) throw new Error(`invalid target: ${target}. allowed: ${targets.join('|')}`);
      const allowed = ['img1', 'img2', 'img3', 'text-img'];
      if (!allowed.includes(preset)) throw new Error(`invalid preset: ${preset}. allowed: ${allowed.join('|')}`);
      if (sectionId !== undefined && (typeof sectionId !== 'string' || !sectionId.startsWith('sec_'))) {
        throw new Error(`invalid sectionId: ${sectionId}. expected string starting with sec_`);
      }

      // ⑴ 스크래치에 «먼저» — 프로젝트 확인·되읽기는 렌더러가 한다
      const put = await _rendererInvoker.scratchAdd({ src: image, width });
      if (!put || put.ok !== true) return put || { ok: false, code: 'SCRATCH_FAILED' };
      if (target === 'scratch') {
        return { ok: true, target: 'scratch', scratchId: put.scratchId, x: put.x, y: put.y, imageCheck };
      }

      // ⑵ 캔버스에는 «기존 도구»로 붙인다
      const att = await _rendererInvoker.addAssetBlock({ preset, sectionId, scratchId: put.scratchId });
      if (!att || att.ok === false) {
        // ★스크래치에는 «남아 있다» — 그 사실을 반드시 알린다(사용자가 수동으로 끌어다 쓸 수 있게)
        return { ...(att || {}), ok: false, code: (att && att.code) || 'ATTACH_FAILED',
                 scratchId: put.scratchId,
                 message: `${(att && att.message) || '캔버스 부착 실패'} — 이미지는 보관함(${put.scratchId})에 남아 있습니다.` };
      }
      // ★blockId 는 add_asset_block 이 «assetBlockId» 라는 이름으로 준다 — 이름이 달라
      //   그냥 att.blockId 를 읽으면 «항상 null» 이다(2026-08-30 대조에서 잡음).
      return { ok: true, target: 'canvas', scratchId: put.scratchId,
               sectionId: att.sectionId || sectionId || null,
               blockId: att.assetBlockId || att.blockId || null,
               hasImage: att.hasImage === true, imageCheck };
    },
    {
      description: 'Put an image into GODITOR. Default target=canvas: the image is stored in the scratch pad and immediately attached to a section as an asset block. target=scratch stores it in the scratch pad only (canvas untouched). ⚠️A project must be OPEN for either target — the scratch pad is scoped to project+page. Image must be a data URL (max ~5MB); oversized images are rejected, never silently downscaled.',
      inputSchema: {
        type: 'object',
        properties: {
          image: { type: 'string', description: 'data:image/<type>;base64,<...>  (file paths are not accepted)' },
          target: { type: 'string', enum: ['canvas', 'scratch'], description: 'canvas (default) = scratch + attach to section; scratch = scratch pad only' },
          sectionId: { type: 'string', description: 'optional sec_xxx — if omitted, uses the currently selected section (canvas target only)' },
          preset: { type: 'string', enum: ['img1', 'img2', 'img3', 'text-img'], description: 'asset layout preset (default img1)' },
          width: { type: 'number', description: 'optional scratch item width in px (default 860 — same as folder import)' }
        },
        required: ['image']
      }
    }
  );

  // Phase 3 MVP — 비율 프리셋 에셋(이미지 자리) row 추가. renderer의 window.addPresetRow 호출.
  // 이미지 *생성*은 안 함 — 비율 잡힌 자리만 만들고 사용자가 채움.
  registerTool(
    'add_asset_block',
    async ({ preset = 'img1', sectionId, scratchId } = {}) => {
      if (!_rendererInvoker || typeof _rendererInvoker.addAssetBlock !== 'function') {
        throw new Error('renderer bridge not initialized (setRendererInvoker not called)');
      }
      const allowed = ['img1', 'img2', 'img3', 'text-img'];
      if (!allowed.includes(preset)) {
        throw new Error(`invalid preset: ${preset}. allowed: ${allowed.join('|')}`);
      }
      if (sectionId !== undefined) {
        if (typeof sectionId !== 'string' || !sectionId.startsWith('sec_')) {
          throw new Error(`invalid sectionId: ${sectionId}. expected string starting with sec_`);
        }
      }
      if (scratchId !== undefined) {
        if (typeof scratchId !== 'string' || !scratchId.startsWith('sp_')) {
          throw new Error(`invalid scratchId: ${scratchId}. expected string starting with sp_`);
        }
      }
      return await _rendererInvoker.addAssetBlock({ preset, sectionId, scratchId });
    },
    {
      description: 'Add an image-placeholder row with a ratio preset. img1=single, img2=2-up (canvas-block cards), img3=3-up (canvas-block cards), text-img=text+image stack. Pass scratchId to auto-attach a scratch pad image (sp_xxx) — renderer reads from IndexedDB directly (no IPC payload blowup for large GIF/dataURL).',
      inputSchema: {
        type: 'object',
        properties: {
          preset: { type: 'string', enum: ['img1', 'img2', 'img3', 'text-img'], description: 'asset layout preset (default img1)' },
          sectionId: { type: 'string', description: 'optional sec_xxx — if omitted, uses the currently selected section' },
          scratchId: { type: 'string', description: 'optional sp_xxx — auto-attach scratch pad image as asset src (only meaningful with preset=img1)' }
        },
        required: []
      }
    }
  );

  // Phase 3 MVP — 기본 섹션 한 번에 조립: 메인카피(h1) + 본문(body) + 에셋(img1). 라벨 옵션.
  // 갭/폰트는 sec_wd3nixu 실측 토큰 적용 (제목100/본문30, 갭 100/50/30).
  registerTool(
    'build_basic_section',
    async ({ mainCopy = '', body = '', label, assetPreset = 'img1', align = 'center', sourceScratchIds } = {}) => {
      if (!_rendererInvoker || typeof _rendererInvoker.buildBasicSection !== 'function') {
        throw new Error('renderer bridge not initialized (setRendererInvoker not called)');
      }
      const mc = String(mainCopy || '');
      if ([...mc].length === 0) throw new Error('mainCopy required');
      if ([...mc].length > 200) throw new Error('mainCopy too long (>200)');
      const bd = String(body || '');
      if ([...bd].length > 800) throw new Error('body too long (>800)');
      // 2026-06-08 NewGrid 봉인 + canvas-block fallback:
      // 'img2'/'img3' → renderer가 canvas-block(cvb_, cardMode='simple', cards:N)로 자동 변환.
      // 'text-img' → img1 stack fallback (text 위/이미지 아래).
      // 옛 NewGrid Frame(ss_*) 생성 경로는 봉인됨. 도구 자체는 모든 preset 허용 (생성은 됨).
      const allowed = ['img1', 'img2', 'img3', 'text-img'];
      if (!allowed.includes(assetPreset)) throw new Error(`invalid assetPreset: ${assetPreset}`);
      if (!['left', 'center', 'right'].includes(align)) throw new Error(`invalid align: ${align}`);
      const lb = label !== undefined ? String(label) : null;
      if (lb !== null && [...lb].length > 60) throw new Error('label too long (>60)');
      // sourceScratchIds — add_section 과 동일 검증/형식.
      let scratch;
      if (sourceScratchIds !== undefined && sourceScratchIds !== null) {
        if (!Array.isArray(sourceScratchIds)) throw new Error('sourceScratchIds must be an array of sp_xxx strings');
        if (sourceScratchIds.length > 16) throw new Error('sourceScratchIds too many (max 16)');
        for (const s of sourceScratchIds) {
          if (typeof s !== 'string' || !/^sp_[A-Za-z0-9_-]+$/.test(s)) {
            throw new Error(`invalid sourceScratchIds entry: ${s} (must match /^sp_[A-Za-z0-9_-]+$/)`);
          }
        }
        scratch = sourceScratchIds;
      }
      return await _rendererInvoker.buildBasicSection({ mainCopy: mc, body: bd, label: lb, assetPreset, align, sourceScratchIds: scratch });
    },
    {
      description: 'Build a basic section in one call: main copy (h1, 100px) + body (30px) + asset placeholder (img1). Optional label (small bold). Gaps follow standard tokens (100/50/30). Text centered by default (align). Use when user says "기본 섹션 만들어줘" or gives content for a single section without specifying layout. sourceScratchIds: optional sp_xxx[] — auto-records "출처: sp_aa, sp_bb" line into the new section dataset.memo (same shape as add_section).',
      inputSchema: {
        type: 'object',
        properties: {
          mainCopy: { type: 'string', description: 'main headline text (required, ~200)' },
          body: { type: 'string', description: 'body/subcopy text (optional, ~800)' },
          label: { type: 'string', description: 'optional small label above the headline (e.g. NEW ARRIVAL)' },
          assetPreset: { type: 'string', enum: ['img1', 'img2', 'img3', 'text-img'], description: 'asset layout. img1: single stacked image. img2/img3: auto-converted to canvas-block (cvb_, cardMode=simple, N cards) — NewGrid Frame seal 2026-06-08. text-img: stack fallback (text top / image bottom).' },
          align: { type: 'string', enum: ['left', 'center', 'right'], description: 'text align (default center — hero/Hook convention)' },
          sourceScratchIds: { type: 'array', items: { type: 'string' }, description: 'optional sp_xxx[] — auto-tagged into the new section dataset.memo as source trace. Max 16 ids.' }
        },
        required: ['mainCopy']
      }
    }
  );

  // update_block — 기존 텍스트 블록 1개를 id로 수정 (색/크기/굵기/문구/정렬).
  // 모든 write 툴은 ADD만 함 — 이게 유일한 EDIT 진입점. blockId는 get_canvas_state/read_section으로 획득.
  registerTool(
    'update_block',
    async ({ blockId, content, color, fontSize, fontWeight, align } = {}) => {
      if (!_rendererInvoker || typeof _rendererInvoker.editTextBlock !== 'function') {
        throw new Error('renderer bridge not initialized (setRendererInvoker not called)');
      }
      if (typeof blockId !== 'string' || !blockId.startsWith('tb_')) {
        throw new Error(`invalid blockId: ${blockId}. must be a string starting with "tb_"`);
      }
      const hasField = [content, color, fontSize, fontWeight, align].some((v) => v !== undefined);
      if (!hasField) throw new Error('no fields to update — provide at least one of content/color/fontSize/fontWeight/align');

      if (color !== undefined && !/^#?[0-9a-fA-F]{3,8}$/.test(String(color))) {
        throw new Error(`invalid color: ${color}`);
      }
      if (fontSize !== undefined) {
        if (!Number.isInteger(fontSize) || fontSize < 8 || fontSize > 2000) {
          throw new Error(`invalid fontSize: ${fontSize}. must be integer 8~2000`);
        }
      }
      if (fontWeight !== undefined) {
        const allowedWeights = [100, 200, 300, 400, 500, 600, 700, 800, 900, 'normal', 'bold'];
        if (!allowedWeights.includes(fontWeight)) {
          throw new Error(`invalid fontWeight: ${fontWeight}. allowed: 100~900 | normal | bold`);
        }
      }
      if (align !== undefined && !['left', 'center', 'right'].includes(align)) {
        throw new Error(`invalid align: ${align}. allowed: left|center|right`);
      }
      if (content !== undefined) {
        const len = [...String(content)].length;
        if (len > 500) throw new Error(`content too long (${len} > 500)`);
      }
      return await _rendererInvoker.editTextBlock({ blockId, content, color, fontSize, fontWeight, align });
    },
    {
      description: 'Edit an EXISTING text block by id. Obtain blockId via get_canvas_state or read_section. Changes color/fontSize/fontWeight/content/align of one text block. Returns USER_BUSY if user is editing.',
      inputSchema: {
        type: 'object',
        properties: {
          blockId: { type: 'string', description: 'target block id (tb_xxx). Get it from get_canvas_state or read_section' },
          content: { type: 'string', description: 'new text content (≤500 code points)' },
          color: { type: 'string', description: 'text color hex (e.g. #ff0000 or #f00)' },
          fontSize: { type: 'integer', description: 'font size in px (8~2000)' },
          fontWeight: { description: 'font weight: 100~900 | "normal" | "bold"' },
          align: { type: 'string', enum: ['left', 'center', 'right'], description: 'text align' }
        },
        required: ['blockId']
      }
    }
  );

  // PM get_canvas_state — 캔버스를 구조화 데이터로 조회 (READ-ONLY, mutation 없음 → USER_BUSY 불필요).
  registerTool(
    'get_canvas_state',
    async ({ sectionId, detail = 'blocks' } = {}) => {
      if (!_rendererInvoker || typeof _rendererInvoker.getCanvasState !== 'function') {
        throw new Error('renderer bridge not initialized (setRendererInvoker not called)');
      }
      if (sectionId !== undefined && sectionId !== null) {
        if (typeof sectionId !== 'string' || !sectionId.startsWith('sec_')) {
          throw new Error(`invalid sectionId: ${sectionId} (expected string starting with "sec_")`);
        }
      }
      if (!['summary', 'blocks', 'full'].includes(detail)) {
        throw new Error(`invalid detail: ${detail} (summary|blocks|full)`);
      }
      const raw = await _rendererInvoker.getCanvasState({ sectionId });
      return _slimCanvasState(raw, detail);
    },
    {
      description: 'Read the canvas as structured data: sections with their text blocks (blockId, type, text, color, fontSize, align). Use it to find the blockId to pass to update_block. Read-only. '
        + 'detail: "blocks"(default) = blocks with text trimmed to 120 chars and empty style fields dropped; "summary" = per-section block counts only (cheap on huge pages); "full" = untrimmed. '
        + 'Big pages auto-fall back to summary (a note says so) so one call can never blow up the context.',
      inputSchema: {
        type: 'object',
        properties: {
          sectionId: { type: 'string', description: 'optional sec_xxx — if omitted, returns all sections on the active page' },
          detail: { type: 'string', enum: ['summary', 'blocks', 'full'], description: 'response size. default "blocks"' }
        },
        required: []
      }
    }
  );

  // PM add_checklist_item — 체크리스트 항목(=핀) 추가. 평가/todo 등록용.
  registerTool(
    'add_checklist_item',
    async ({ text, x, y, sectionId, done = false, urgent = false } = {}) => {
      if (!text || typeof text !== 'string') throw new Error('text required (string)');
      if (text.length > 500) throw new Error('text too long (>500)');
      if (sectionId !== undefined && sectionId !== null) {
        if (typeof sectionId !== 'string' || !sectionId.startsWith('sec_')) throw new Error(`invalid sectionId: ${sectionId}`);
      }
      if (x !== undefined && x !== null && typeof x !== 'number') throw new Error('x must be number');
      if (y !== undefined && y !== null && typeof y !== 'number') throw new Error('y must be number');
      if (!_rendererInvoker?.addChecklistItem) throw new Error('renderer bridge not ready');
      return await _rendererInvoker.addChecklistItem({ text, x, y, sectionId, done, urgent });
    },
    {
      description: 'Add a checklist item (todo). If sectionId given (without x/y), pin auto-positions next to that section on the canvas. If x/y given, pin placed at those canvas coords. Otherwise just a list item (no pin). Use for: section evaluation notes, work-needed todos, scratch-source tracking ("이 섹션은 sp_xxx 출처").',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'todo/note text (≤500 chars)' },
          sectionId: { type: 'string', description: 'sec_xxx — auto-position pin next to this section' },
          x: { type: 'number', description: 'canvas x coord (overrides sectionId auto-position)' },
          y: { type: 'number', description: 'canvas y coord' },
          done: { type: 'boolean', description: 'mark as already completed. default false' },
          urgent: { type: 'boolean', description: 'mark as urgent. default false' }
        },
        required: ['text']
      }
    }
  );

  // PM add_table_block — 표 블록 추가 (headers + rows 직접 주입)
  registerTool(
    'add_table_block',
    async ({ sectionId, headers, rows, showHeader = true, cellAlign = 'center' } = {}) => {
      if (sectionId !== undefined && (typeof sectionId !== 'string' || !sectionId.startsWith('sec_'))) {
        throw new Error(`invalid sectionId: ${sectionId}`);
      }
      if (headers !== undefined && !Array.isArray(headers)) throw new Error('headers must be array of strings');
      if (rows !== undefined && (!Array.isArray(rows) || rows.some(r => !Array.isArray(r)))) {
        throw new Error('rows must be array of arrays (string[][]). e.g. [["row1col1","row1col2"], ...]');
      }
      if (Array.isArray(headers) && Array.isArray(rows)) {
        const cols = headers.length;
        const mismatch = rows.findIndex(r => r.length !== cols);
        if (mismatch !== -1) throw new Error(`row ${mismatch} length ${rows[mismatch].length} != headers ${cols}`);
      }
      if (!['left','center','right'].includes(cellAlign)) throw new Error(`invalid cellAlign: ${cellAlign}`);
      if (!_rendererInvoker?.addTableBlock) throw new Error('renderer bridge not ready');
      return await _rendererInvoker.addTableBlock({ sectionId, headers, rows, showHeader, cellAlign });
    },
    {
      description: 'Add a table block with data. Pass headers (string[]) for column titles and rows (string[][]) for data — each row array length must match headers length. showHeader=false hides the header row. cellAlign: left/center/right. Use for spec/comparison tables instead of cramming into a single text block.',
      inputSchema: {
        type: 'object',
        properties: {
          sectionId: { type: 'string', description: 'sec_xxx to insert into (else uses selected section)' },
          headers: { type: 'array', items: { type: 'string' }, description: 'column headers (e.g. ["항목","내용"])' },
          rows: { type: 'array', items: { type: 'array', items: { type: 'string' } }, description: '2D string array, each inner array must match headers length' },
          showHeader: { type: 'boolean', description: 'show header row. default true', default: true },
          cellAlign: { type: 'string', enum: ['left','center','right'], description: 'text align inside cells. default center', default: 'center' }
        },
        required: []
      }
    }
  );

  // PM add_card_block — 카드 블록 row 추가 (1 row + N cards). 각 카드는 image+title+desc.
  // cards 배열로 카드별 title/desc/imgSrc 지정. shared 옵션(bgColor/radius/...)은 row 전체 적용.
  // canvas-block과 차이: canvas-block은 단일 절대배치 컴포넌트(Figma 임포트용), card-block은 row+col 그리드.
  registerTool(
    'add_card_block',
    async ({ sectionId, cards, bgColor, radius, textAlign, titleSize, descSize } = {}) => {
      if (sectionId !== undefined && (typeof sectionId !== 'string' || !sectionId.startsWith('sec_'))) {
        throw new Error(`invalid sectionId: ${sectionId}`);
      }
      if (!Array.isArray(cards) || cards.length === 0) {
        throw new Error('cards required: non-empty array of {title?, desc?, imgSrc?}');
      }
      if (cards.length > 8) {
        throw new Error(`too many cards: ${cards.length} (max 8 — UI 가독성/레이아웃 한계)`);
      }
      cards.forEach((c, i) => {
        if (c === null || typeof c !== 'object') throw new Error(`cards[${i}] must be object`);
        if (c.title !== undefined && typeof c.title !== 'string') throw new Error(`cards[${i}].title must be string`);
        if (c.desc !== undefined && typeof c.desc !== 'string') throw new Error(`cards[${i}].desc must be string`);
        if (c.imgSrc !== undefined && c.imgSrc !== null && typeof c.imgSrc !== 'string') throw new Error(`cards[${i}].imgSrc must be string`);
        // imgSrc 길이 cap: dataURL은 매우 길 수 있어 토큰/RAM 폭발 방지
        if (typeof c.imgSrc === 'string' && c.imgSrc.length > 2_000_000) {
          throw new Error(`cards[${i}].imgSrc too large (>2MB; use URL not base64 dataURL when possible)`);
        }
        if (typeof c.title === 'string' && [...c.title].length > 500) throw new Error(`cards[${i}].title too long (>500)`);
        if (typeof c.desc === 'string' && [...c.desc].length > 2000) throw new Error(`cards[${i}].desc too long (>2000)`);
      });
      if (bgColor !== undefined) {
        if (typeof bgColor !== 'string') throw new Error('bgColor must be string');
        // hex(#rgb/#rrggbb/#rrggbbaa) | rgb()/rgba() | transparent — Codex 리뷰 #2 반영
        // rgb 토큰은 함수형식까지 확인 (단순 startsWith로 'rgbjunk' 통과 방지)
        const _bcOk = /^#[0-9a-fA-F]{3,8}$/.test(bgColor)
          || /^rgba?\(\s*[\d.,\s%/]+\)$/.test(bgColor)
          || bgColor === 'transparent';
        if (!_bcOk) {
          throw new Error(`invalid bgColor: ${bgColor} (use "#rrggbb", "rgb(r,g,b)", "rgba(r,g,b,a)", or "transparent")`);
        }
      }
      if (radius !== undefined) {
        const r = parseInt(radius);
        if (!Number.isFinite(r) || r < 0 || r > 40) throw new Error(`invalid radius: ${radius} (0–40)`);
      }
      if (textAlign !== undefined && !['left','center','right'].includes(textAlign)) {
        throw new Error(`invalid textAlign: ${textAlign}`);
      }
      if (titleSize !== undefined) {
        const v = parseInt(titleSize);
        if (!Number.isFinite(v) || v < 12 || v > 60) throw new Error(`invalid titleSize: ${titleSize} (12–60)`);
      }
      if (descSize !== undefined) {
        const v = parseInt(descSize);
        if (!Number.isFinite(v) || v < 10 || v > 40) throw new Error(`invalid descSize: ${descSize} (10–40)`);
      }
      if (!_rendererInvoker?.addCardBlock) throw new Error('renderer bridge not ready');
      return await _rendererInvoker.addCardBlock({ sectionId, cards, bgColor, radius, textAlign, titleSize, descSize });
    },
    {
      description: 'DEPRECATED ALIAS → canvas-block. Adds N cards (image + title + desc each) as a single canvas-block (cvb_*) in Simple Card Mode (gridCols=N, gridRows=1). card-block(cdb_)은 canvas-block(cvb_)으로 통합됨 (2026-06-08 NewGrid seal) — 이 도구는 호환을 위해 canvas simple-card 그리드로 위임한다. Use for feature cards / benefit highlights. cards=[{title,desc,imgSrc?}, ...] — max 8. shared props: bgColor→textBg/cellBg, radius/textAlign/titleSize/descSize. Returns {ok, blockId(cvb_), cardBlockIds:[blockId], count:1}. 신규 작업은 add_canvas_block(cardMode="simple") 직접 사용 권장.',
      inputSchema: {
        type: 'object',
        properties: {
          sectionId: { type: 'string', description: 'sec_xxx to insert into (else uses selected section)' },
          cards: {
            type: 'array',
            description: 'card payloads (1–8). Each card has title/desc (text) + optional imgSrc (URL or dataURL).',
            items: {
              type: 'object',
              properties: {
                title:  { type: 'string', description: 'card title (≤500 chars)' },
                desc:   { type: 'string', description: 'card description (≤2000 chars)' },
                imgSrc: { type: 'string', description: 'image src (URL or dataURL ≤2MB)' }
              }
            },
            minItems: 1,
            maxItems: 8
          },
          bgColor:   { type: 'string', description: 'shared bottom-area bg color (e.g. "#f5f5f5"). default #f5f5f5' },
          radius:    { type: 'number', description: 'shared corner radius (0–40 px). default 12' },
          textAlign: { type: 'string', enum: ['left','center','right'], description: 'shared text alignment. default left' },
          titleSize: { type: 'number', description: 'shared title font-size px (12–60). default 24' },
          descSize:  { type: 'number', description: 'shared desc font-size px (10–40). default 18' }
        },
        required: ['cards']
      }
    }
  );

  // PM update_card_block — 단일 카드 블록(cdb_*) 부분 갱신.
  // 멀티 카드 row 안에서도 cdb_* 단위로 개별 수정 가능 (각 카드는 독립 DOM 노드).
  registerTool(
    'update_card_block',
    async ({ blockId, title, desc, imgSrc, bgColor, radius, textAlign, titleSize, descSize } = {}) => {
      // [APIMCP P0] card-block→canvas-block 통합. cvb_ id만 허용 (cdb_는 더 이상 생성 안 됨).
      if (!blockId || typeof blockId !== 'string' || !blockId.startsWith('cvb_')) {
        throw new Error(`blockId required (cvb_xxx) — card-block(cdb_)은 canvas-block(cvb_)으로 통합됨. update_canvas_block을 직접 써도 됨.`);
      }
      const fields = { title, desc, imgSrc, bgColor, radius, textAlign, titleSize, descSize };
      const hasAny = Object.values(fields).some(v => v !== undefined);
      if (!hasAny) throw new Error('at least one field required (title/desc/imgSrc/bgColor/radius/textAlign/titleSize/descSize)');
      if (title !== undefined && typeof title !== 'string') throw new Error('title must be string');
      if (desc !== undefined && typeof desc !== 'string') throw new Error('desc must be string');
      if (imgSrc !== undefined && imgSrc !== null && typeof imgSrc !== 'string') throw new Error('imgSrc must be string or null');
      if (typeof title === 'string' && [...title].length > 500) throw new Error('title too long (>500)');
      if (typeof desc === 'string' && [...desc].length > 2000) throw new Error('desc too long (>2000)');
      if (typeof imgSrc === 'string' && imgSrc.length > 2_000_000) throw new Error('imgSrc too large (>2MB)');
      if (bgColor !== undefined) {
        if (typeof bgColor !== 'string') throw new Error('bgColor must be string');
        // hex(#rgb/#rrggbb/#rrggbbaa) | rgb()/rgba() | transparent — Codex 리뷰 #2 반영
        // rgb 토큰은 함수형식까지 확인 (단순 startsWith로 'rgbjunk' 통과 방지)
        const _bcOk = /^#[0-9a-fA-F]{3,8}$/.test(bgColor)
          || /^rgba?\(\s*[\d.,\s%/]+\)$/.test(bgColor)
          || bgColor === 'transparent';
        if (!_bcOk) {
          throw new Error(`invalid bgColor: ${bgColor} (use "#rrggbb", "rgb(r,g,b)", "rgba(r,g,b,a)", or "transparent")`);
        }
      }
      if (radius !== undefined) {
        const r = parseInt(radius);
        if (!Number.isFinite(r) || r < 0 || r > 40) throw new Error(`invalid radius: ${radius} (0–40)`);
      }
      if (textAlign !== undefined && !['left','center','right'].includes(textAlign)) {
        throw new Error(`invalid textAlign: ${textAlign}`);
      }
      if (titleSize !== undefined) {
        const v = parseInt(titleSize);
        if (!Number.isFinite(v) || v < 12 || v > 60) throw new Error(`invalid titleSize: ${titleSize} (12–60)`);
      }
      if (descSize !== undefined) {
        const v = parseInt(descSize);
        if (!Number.isFinite(v) || v < 10 || v > 40) throw new Error(`invalid descSize: ${descSize} (10–40)`);
      }
      if (!_rendererInvoker?.updateCardBlock) throw new Error('renderer bridge not ready');
      return await _rendererInvoker.updateCardBlock({ blockId, title, desc, imgSrc, bgColor, radius, textAlign, titleSize, descSize });
    },
    {
      description: 'DEPRECATED ALIAS → update_canvas_block. Partially updates the first card (index 0) of a canvas simple-card block (cvb_*). card-block(cdb_)은 canvas-block(cvb_)으로 통합됨. Pass the cvb_ id (e.g. returned from add_card_block). Pass only fields you want changed. Use empty string for imgSrc to remove the image. Returns USER_BUSY if user is editing. 여러 카드 갱신은 update_canvas_block(patchCards) 사용.',
      inputSchema: {
        type: 'object',
        properties: {
          blockId:   { type: 'string', description: 'cvb_xxx to update (canvas simple-card block)' },
          title:     { type: 'string', description: 'new title text (≤500)' },
          desc:      { type: 'string', description: 'new description text (≤2000)' },
          imgSrc:    { type: 'string', description: 'image src (URL or dataURL ≤2MB). Empty string removes image.' },
          bgColor:   { type: 'string', description: 'bottom-area bg color' },
          radius:    { type: 'number', description: 'corner radius (0–40 px)' },
          textAlign: { type: 'string', enum: ['left','center','right'] },
          titleSize: { type: 'number', description: 'title font-size px (12–60)' },
          descSize:  { type: 'number', description: 'desc font-size px (10–40)' }
        },
        required: ['blockId']
      }
    }
  );

  // PM update_section — 섹션 속성 변경 (배경 등)
  registerTool(
    'update_section',
    async ({ sectionId, bg, name, ...rest } = {}) => {
      if (!sectionId || !sectionId.startsWith('sec_')) throw new Error('sectionId required (sec_xxx)');
      if (bg !== undefined && bg !== null && !/^#?[0-9a-fA-F]{3,8}$|^transparent$|^rgb/.test(String(bg))) {
        throw new Error(`invalid bg: ${bg}`);
      }
      // ★«아무것도 안 하고 ok» 를 막는다 (2026-09-07 g-mcpmgr).
      //   registerTool 된 update_* 28개 중 이 가드가 «없던 유일한» 도구였다(나머지 27개는 있다).
      //   그래서 update_section({sectionId, name:'새이름'}) 이 «아무 말 없이» 성공했다 —
      //   name 은 구조분해에서 버려지고 bg 는 undefined 라 렌더러가 할 일이 없다.
      //   ⇒ 클로드는 「섹션 이름 바꿔줘」를 받으면 이 도구에 name 을 넣어 보고, 아무도 안 나무라니
      //     «했다»고 답한다. 「도구가 없다」가 「조용한 거짓 성공」으로 둔갑하던 자리다.
      // ★거절은 곧 «안내»여야 한다 — 무엇을 넣을 수 있는지, 그리고 무엇이 «아예 안 되는지»를
      //   같이 말하지 않으면 클로드는 title·label 로 갈아 끼우며 같은 자리를 돈다.
      /* ★2026-09-07 «개통»: name 을 받는다. 아침엔 이 자리가 「이름은 MCP 로 못 바꾼다」고
         «말하게만» 막아 둔 곳이었다 — 도구가 없었으니 그게 최선이었다. 이제 있으니 그 문장을 «지운다».
         ⇒ ★거절 문구를 고칠 땐 «기능이 생겼는지»부터 봐라. 안 그러면 되는 걸 안 된다고 말한다. */
      if (name !== undefined && (typeof name !== 'string' || !name.trim()))
        throw new Error('name must be a non-empty string (공백만은 안 된다)');
      if (typeof name === 'string' && [...name].length > 50)
        throw new Error(`name too long (${[...name].length} > 50)`);
      if (bg === undefined && name === undefined) {
        const unknown = Object.keys(rest);
        throw new Error(
          'no fields to update — provide at least one of: bg, name'
          + (unknown.length ? ` (received but NOT supported: ${unknown.join(', ')})` : '')
        );
      }
      if (!_rendererInvoker?.updateSection) throw new Error('renderer bridge not ready');
      return await _rendererInvoker.updateSection({ sectionId, bg, name });
    },
    {
      description: 'Update section properties: bg (background color) and/or name (the section label, e.g. "Section 02" → "히어로"). '
        + 'bg: hex (#000, #ffffff) or "transparent". name: ≤50 chars, non-empty. At least one of the two is required.',
      inputSchema: {
        type: 'object',
        properties: {
          sectionId: { type: 'string', description: 'sec_xxx to update' },
          bg: { type: 'string', description: 'background color (hex like #000000 or "transparent")' },
          name: { type: 'string', description: '섹션 이름(≤50자). 2026-09-07 신설 — 그전엔 «바꿀 방법이 없었다».' }
        },
        required: ['sectionId']
      }
    }
  );

  // PM delete_section — 섹션 삭제 (마지막 섹션은 삭제 불가)
  registerTool(
    'delete_section',
    async ({ sectionId, expectedProject } = {}) => {
      if (!sectionId || typeof sectionId !== 'string' || !sectionId.startsWith('sec_')) {
        throw new Error('sectionId required (sec_xxx)');
      }
      _assertExpectedProject(expectedProject); // 미지정 시 no-op(하위호환)
      if (!_rendererInvoker?.deleteSection) throw new Error('renderer bridge not ready');
      return await _rendererInvoker.deleteSection({ sectionId });
    },
    {
      description: 'Delete a section by id — DESTRUCTIVE, acts on the ACTIVE project. Last section is protected (will return code:DELETE_FAILED). '
        + 'Safety: pass expectedProject (proj_xxx you intend to modify); if it does not match the currently open project the call is refused with PROJECT_MISMATCH. Strongly recommended whenever multiple projects are involved.',
      inputSchema: {
        type: 'object',
        properties: {
          sectionId: { type: 'string', description: 'sec_xxx to remove' },
          expectedProject: { type: 'string', description: 'optional proj_<digits> — the project you INTEND to modify. Mismatch with the active project ⇒ refused (protects the open project). Omit = legacy behavior.' }
        },
        required: ['sectionId']
      }
    }
  );

  // PM delete_block — 일반 블록 삭제 (text/asset/gap/frame 등). section은 delete_section 사용.
  registerTool(
    'delete_block',
    async ({ blockId, expectedProject } = {}) => {
      if (!blockId || typeof blockId !== 'string') throw new Error('blockId required');
      _assertExpectedProject(expectedProject); // 미지정 시 no-op(하위호환)
      if (!_rendererInvoker?.deleteBlock) throw new Error('renderer bridge not ready');
      return await _rendererInvoker.deleteBlock({ blockId });
    },
    {
      description: 'Delete a non-section block by id (tb_/ab_/gb_/cvb_/ss_ etc.) — DESTRUCTIVE, acts on the ACTIVE project. For sections use delete_section. '
        + 'Safety: pass expectedProject (proj_xxx you intend to modify); mismatch with the currently open project ⇒ refused with PROJECT_MISMATCH.',
      inputSchema: {
        type: 'object',
        properties: {
          blockId: { type: 'string', description: 'block id to remove (any prefix except sec_)' },
          expectedProject: { type: 'string', description: 'optional proj_<digits> — the project you INTEND to modify. Mismatch with the active project ⇒ refused. Omit = legacy behavior.' }
        },
        required: ['blockId']
      }
    }
  );

  // PM move_section — 섹션 순서 변경. beforeId 또는 afterId 한 쪽만.
  registerTool(
    'move_section',
    async ({ sectionId, beforeId, afterId } = {}) => {
      if (!sectionId || !sectionId.startsWith('sec_')) throw new Error('sectionId required (sec_xxx)');
      if (!beforeId && !afterId) throw new Error('beforeId or afterId required');
      if (beforeId && afterId) throw new Error('beforeId and afterId are mutually exclusive');
      if (beforeId && (typeof beforeId !== 'string' || !beforeId.startsWith('sec_'))) throw new Error('invalid beforeId');
      if (afterId  && (typeof afterId  !== 'string' || !afterId.startsWith('sec_')))  throw new Error('invalid afterId');
      if (!_rendererInvoker?.moveSection) throw new Error('renderer bridge not ready');
      return await _rendererInvoker.moveSection({ sectionId, beforeId, afterId });
    },
    {
      description: 'Move an existing section to a new position relative to another section (beforeId or afterId, mutually exclusive).',
      inputSchema: {
        type: 'object',
        properties: {
          sectionId: { type: 'string', description: 'sec_xxx to move' },
          beforeId:  { type: 'string', description: 'place BEFORE this sec_xxx' },
          afterId:   { type: 'string', description: 'place AFTER this sec_xxx' }
        },
        required: ['sectionId']
      }
    }
  );

  // PM move_block — 블록(비-섹션) 순서 재배치. beforeId 또는 afterId 한 쪽만.
  // move_section의 블록 단위 대응물. 이전엔 아예 없어서(INV-B3/B1 1순위 결손) 순서를
  // 바꾸려면 delete_block 뒤 모든 필드를 다시 채워 재생성해야 했다.
  registerTool(
    'move_block',
    async ({ blockId, beforeId, afterId } = {}) => {
      if (!blockId || typeof blockId !== 'string') throw new Error('blockId required');
      if (!beforeId && !afterId) throw new Error('beforeId or afterId required');
      if (beforeId && afterId) throw new Error('beforeId and afterId are mutually exclusive');
      if (beforeId && typeof beforeId !== 'string') throw new Error('invalid beforeId');
      if (afterId  && typeof afterId  !== 'string')  throw new Error('invalid afterId');
      if (blockId.startsWith('sec_')) throw new Error('blockId is a section — use move_section instead');
      if ((beforeId || '').startsWith('sec_') || (afterId || '').startsWith('sec_')) {
        throw new Error('beforeId/afterId must not be a section — use move_section instead');
      }
      if (!_rendererInvoker?.moveBlock) throw new Error('renderer bridge not ready');
      return await _rendererInvoker.moveBlock({ blockId, beforeId, afterId });
    },
    {
      description: 'Move a non-section block to a new position relative to another block (beforeId or afterId, mutually exclusive). '
        + 'For sections use move_section. NOTE: if the block sits inside a row (side-by-side layout) or a text-frame wrapper, '
        + 'the whole row/frame moves as one unit — same grouping the layer panel drag uses, to avoid splitting a row or tearing '
        + 'a text block out of its frame. The response movedUnitId/refUnitId report the id(s) that actually moved, which may '
        + 'differ from the blockId/beforeId/afterId you passed in.',
      inputSchema: {
        type: 'object',
        properties: {
          blockId:  { type: 'string', description: 'block id to move (tb_/ab_/gb_/cvb_/ss_ etc, not sec_)' },
          beforeId: { type: 'string', description: 'place BEFORE this block id' },
          afterId:  { type: 'string', description: 'place AFTER this block id' }
        },
        required: ['blockId']
      }
    }
  );

  // PM insert_gap_after_block — 특정 블록 뒤 정확한 위치에 갭 삽입 (add_gap_block 한계 보완).
  registerTool(
    'insert_gap_after_block',
    async ({ blockId, height = 40 } = {}) => {
      if (!blockId || typeof blockId !== 'string') throw new Error('blockId required');
      const h = parseInt(height);
      if (!Number.isFinite(h) || h < 4 || h > 800) throw new Error(`invalid height: ${height} (4–800)`);
      if (!_rendererInvoker?.insertGapAfterBlock) throw new Error('renderer bridge not ready');
      return await _rendererInvoker.insertGapAfterBlock({ blockId, height: h });
    },
    {
      description: 'Insert a gap (spacer) block immediately AFTER the specified block. Useful for fine-tuning vertical spacing between existing blocks (add_gap_block only appends at section end).',
      inputSchema: {
        type: 'object',
        properties: {
          blockId: { type: 'string', description: 'block id to insert gap after (any non-section block)' },
          height: { type: 'number', description: 'gap height in px (4–800). Default 40.', default: 40 }
        },
        required: ['blockId']
      }
    }
  );

  // PM add_gap_block — 갭(spacer) 블록을 섹션에 추가. 텍스트 블록 사이 여백·섹션 높이 조절용.
  registerTool(
    'add_gap_block',
    async ({ height = 40, sectionId } = {}) => {
      const h = parseInt(height);
      if (!Number.isFinite(h) || h < 4 || h > 800) throw new Error(`invalid height: ${height} (4–800 px)`);
      if (sectionId !== undefined && sectionId !== null) {
        if (typeof sectionId !== 'string' || !sectionId.startsWith('sec_')) {
          throw new Error(`invalid sectionId: ${sectionId} (expected string starting with "sec_")`);
        }
      }
      if (!_rendererInvoker || typeof _rendererInvoker.addGapBlock !== 'function') {
        throw new Error('renderer bridge not initialized (setRendererInvoker not called)');
      }
      return await _rendererInvoker.addGapBlock({ height: h, sectionId });
    },
    {
      description: 'Add a gap (spacer) block to control vertical spacing between blocks or pad section height. Returns {ok, height, gapBlockId, beforeCount, afterCount}. Useful when build_basic_section/add_text_block leave too little or too much room between elements.',
      inputSchema: {
        type: 'object',
        properties: {
          height: { type: 'number', description: 'Gap height in px (4–800). Default 40.', default: 40 },
          sectionId: { type: 'string', description: 'Target section (sec_xxx). If omitted, adds to currently selected section.' }
        },
        required: []
      }
    }
  );

  // PM list_scratch_items — 스크래치패드 아이템 목록 (메타데이터만, src 제외 → 토큰 폭발 방지)
  registerTool(
    'list_scratch_items',
    async () => {
      if (!_rendererInvoker || typeof _rendererInvoker.listScratchItems !== 'function') {
        throw new Error('renderer bridge not initialized (setRendererInvoker not called)');
      }
      return await _rendererInvoker.listScratchItems();
    },
    {
      description: 'List all scratch pad items in the active page. Returns [{id, x, y, w, srcType, srcSize}] — src content is excluded to avoid token blowup. Use read_scratch_item to fetch a specific one.',
      inputSchema: { type: 'object', properties: {}, required: [] }
    }
  );

  // PM read_scratch_item — 단일 스크래치 아이템. 기본은 src 잘라서 반환(토큰 절약), includeSrc=true면 전체.
  registerTool(
    'read_scratch_item',
    async ({ id, includeSrc = false, truncateSrcTo = 200 } = {}) => {
      if (!id || typeof id !== 'string') throw new Error('id required (e.g. "sp_br70mc")');
      if (!id.startsWith('sp_')) throw new Error(`invalid scratch id: ${id} (expected prefix "sp_")`);
      if (!_rendererInvoker || typeof _rendererInvoker.readScratchItem !== 'function') {
        throw new Error('renderer bridge not initialized (setRendererInvoker not called)');
      }
      // truncate/includeSrc는 renderer에서 처리 (Codex #1: IPC payload 폭발 방지)
      return await _rendererInvoker.readScratchItem(id, { includeSrc, truncateSrcTo });
    },
    {
      description: 'Read a single scratch pad item by id (e.g. "sp_br70mc"). Returns {id, x, y, w, src|srcPreview, srcSize}. By default the src dataURL is truncated to avoid token blowup; pass includeSrc=true to get the full content.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Scratch item id, e.g. "sp_br70mc"' },
          includeSrc: { type: 'boolean', description: 'If true, return full src content (may be large dataURL). Default: false (only first 200 chars as srcPreview).', default: false },
          truncateSrcTo: { type: 'number', description: 'When includeSrc=false, prefix length for srcPreview. Default: 200.', default: 200 }
        },
        required: ['id']
      }
    }
  );

  // PM delete_scratch_item — 스크래치패드 아이템 삭제 (INV-B3/B1 결손 #5)
  // put_image/add_asset_block(scratchId)로 넣기만 되고 MCP가 스스로 치우지 못하던 결손.
  // 스크래치는 프로젝트 캔버스 undo history 밖(IndexedDB 별도) — DESTRUCTIVE지만 ⌘Z 대상은 아님.
  registerTool(
    'delete_scratch_item',
    async ({ id } = {}) => {
      if (!id || typeof id !== 'string') throw new Error('id required (e.g. "sp_br70mc")');
      if (!id.startsWith('sp_')) throw new Error(`invalid scratch id: ${id} (expected prefix "sp_")`);
      if (!_rendererInvoker || typeof _rendererInvoker.deleteScratchItem !== 'function') {
        throw new Error('renderer bridge not initialized (setRendererInvoker not called)');
      }
      return await _rendererInvoker.deleteScratchItem({ id });
    },
    {
      description: 'Delete a scratch pad item by id (e.g. "sp_br70mc") — DESTRUCTIVE, removes it from the scratch pad (and its IndexedDB storage) permanently. '
        + 'Note: this does NOT touch any canvas block that was already attached from it (add_asset_block/update_asset_block copy the image data at attach time). '
        + 'Not part of canvas undo history (scratch items live outside project serialization) — cannot be undone with ⌘Z. Use list_scratch_items to find ids.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Scratch item id, e.g. "sp_br70mc"' }
        },
        required: ['id']
      }
    }
  );

  // PM update_scratch_item — 스크래치패드 아이템 재배치(x/y) · 리사이즈(w) (INV-B3/B1 결손 #5)
  // ★이미지 내용(src) 교체는 범위 밖 — add_asset_block/update_asset_block의 scratchId 경로가
  //   "스크래치→캔버스"를 담당하고, 스크래치 자체의 src 교체는 이번 결손표에 없던 별도 기능이다.
  registerTool(
    'update_scratch_item',
    async ({ id, x, y, w } = {}) => {
      if (!id || typeof id !== 'string') throw new Error('id required (e.g. "sp_br70mc")');
      if (!id.startsWith('sp_')) throw new Error(`invalid scratch id: ${id} (expected prefix "sp_")`);
      if (x !== undefined && typeof x !== 'number') throw new Error('x must be number');
      if (y !== undefined && typeof y !== 'number') throw new Error('y must be number');
      if (w !== undefined && typeof w !== 'number') throw new Error('w must be number');
      if (x === undefined && y === undefined && w === undefined) {
        throw new Error('no fields to update — provide at least one of x/y/w');
      }
      if (!_rendererInvoker || typeof _rendererInvoker.updateScratchItem !== 'function') {
        throw new Error('renderer bridge not initialized (setRendererInvoker not called)');
      }
      return await _rendererInvoker.updateScratchItem({ id, x, y, w });
    },
    {
      description: 'Reposition/resize a scratch pad item by id — partial update of x/y (canvas coords) and/or w (display width). '
        + 'Does NOT change the image content (src) — only where/how big it sits on the scratch pad. Use list_scratch_items to find ids. '
        + 'Not part of canvas undo history (scratch items live outside project serialization).',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Scratch item id, e.g. "sp_br70mc"' },
          x: { type: 'number', description: 'scratch pad x coord' },
          y: { type: 'number', description: 'scratch pad y coord' },
          w: { type: 'number', description: 'display width (px)' }
        },
        required: ['id']
      }
    }
  );

  // ─── set_section_memo — 섹션 메모 작성/수정 (P/G/E + Codex 리뷰) ───────────
  registerTool(
    'set_section_memo',
    async ({ sectionId, memo } = {}) => {
      if (!_rendererInvoker || typeof _rendererInvoker.setSectionMemo !== 'function') {
        throw new Error('renderer bridge not initialized (setRendererInvoker not called)');
      }
      if (typeof sectionId !== 'string' || !sectionId.startsWith('sec_')) {
        throw new Error(`invalid sectionId: ${sectionId} (must start with "sec_")`);
      }
      if (memo === undefined || memo === null) throw new Error('memo required (use "" to clear)');
      const m = String(memo);
      if ([...m].length > 2000) throw new Error(`memo too long (>2000 code points)`);
      return await _rendererInvoker.setSectionMemo({ sectionId, memo: m });
    },
    {
      description: 'Write/replace the memo string attached to a section (dataset.memo, persisted in proj.json via innerHTML). Use to record source scratch ids, hypotheses, todo notes per section. Max 2000 code points. Pass "" to clear. If user is currently editing the same section memo textarea, returns USER_BUSY.',
      inputSchema: {
        type: 'object',
        properties: {
          sectionId: { type: 'string', description: 'sec_xxx' },
          memo: { type: 'string', description: 'memo text (≤2000 code points). Empty string clears the memo.' }
        },
        required: ['sectionId', 'memo']
      }
    }
  );

  // ─── get_section_memo — 섹션 메모 조회 (read-only) ─────────────────────────
  registerTool(
    'get_section_memo',
    async ({ sectionId } = {}) => {
      if (!_rendererInvoker || typeof _rendererInvoker.getSectionMemo !== 'function') {
        throw new Error('renderer bridge not initialized (setRendererInvoker not called)');
      }
      if (typeof sectionId !== 'string' || !sectionId.startsWith('sec_')) {
        throw new Error(`invalid sectionId: ${sectionId} (must start with "sec_")`);
      }
      return await _rendererInvoker.getSectionMemo({ sectionId });
    },
    {
      description: 'Read the memo string of a section (dataset.memo). Returns {ok, sectionId, memo}. Empty string if no memo. Read-only — no USER_BUSY guard.',
      inputSchema: {
        type: 'object',
        properties: {
          sectionId: { type: 'string', description: 'sec_xxx' }
        },
        required: ['sectionId']
      }
    }
  );

  // ─── update_checklist_item — 체크리스트 항목 부분 갱신 (text/done/urgent/x/y) ──
  // PM이 done 토글, 텍스트 수정, 핀 위치 재배치 가능 (이전 add_checklist_item만 있던 한계 해결).
  registerTool(
    'update_checklist_item',
    async ({ id, text, done, urgent, x, y } = {}) => {
      if (!_rendererInvoker || typeof _rendererInvoker.updateChecklistItem !== 'function') {
        throw new Error('renderer bridge not initialized (setRendererInvoker not called)');
      }
      if (typeof id !== 'string' || !id.startsWith('ck_')) {
        throw new Error(`invalid id: ${id} (must start with "ck_")`);
      }
      if (text !== undefined && typeof text !== 'string') throw new Error('text must be string');
      if (text !== undefined && text.length > 500) throw new Error('text too long (>500)');
      if (done !== undefined && typeof done !== 'boolean') throw new Error('done must be boolean');
      if (urgent !== undefined && typeof urgent !== 'boolean') throw new Error('urgent must be boolean');
      if (x !== undefined && x !== null && typeof x !== 'number') throw new Error('x must be number or null');
      if (y !== undefined && y !== null && typeof y !== 'number') throw new Error('y must be number or null');
      // 최소 1개 필드 필수
      const has = [text, done, urgent, x, y].some(v => v !== undefined);
      if (!has) throw new Error('no fields to update — provide at least one of text/done/urgent/x/y');
      return await _rendererInvoker.updateChecklistItem({ id, text, done, urgent, x, y });
    },
    {
      description: 'Update an existing checklist item (ck_xxx) — partial update of text/done/urgent/x/y. Use to toggle done, edit text, reposition pin. Returns {ok, itemId, item}. Pass null for x/y to detach the pin.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'ck_xxx (checklist item id from add_checklist_item)' },
          text: { type: 'string', description: 'new text (≤500 chars)' },
          done: { type: 'boolean', description: 'mark complete/incomplete' },
          urgent: { type: 'boolean', description: 'urgent flag' },
          x: { type: ['number', 'null'], description: 'canvas x coord. null = detach pin' },
          y: { type: ['number', 'null'], description: 'canvas y coord. null = detach pin' }
        },
        required: ['id']
      }
    }
  );

  // ─── list_checklist_items — 체크리스트 항목 전체(또는 필터) 조회 ────────────
  // INV-B3/B1 결손 #2 — add/update만 있고 조회가 없어, 대화가 끊겨 id를 잊으면
  // 만든 항목을 다시 찾을(그래서 update/delete할) 방법이 없었다.
  registerTool(
    'list_checklist_items',
    async ({ includeDone = true, sectionId } = {}) => {
      if (typeof includeDone !== 'boolean') throw new Error('includeDone must be boolean');
      if (sectionId !== undefined && sectionId !== null) {
        if (typeof sectionId !== 'string' || !sectionId.startsWith('sec_')) throw new Error(`invalid sectionId: ${sectionId}`);
      }
      if (!_rendererInvoker?.listChecklistItems) throw new Error('renderer bridge not ready');
      return await _rendererInvoker.listChecklistItems({ includeDone, sectionId });
    },
    {
      description: 'List checklist items (todos/pins) in the active project. Returns {ok, items:[{id,text,done,urgent,x,y,sectionId,createdAt,updatedAt}], count}. '
        + 'includeDone=false hides completed items. Pass sectionId to filter to items tagged with that section (note: add_checklist_item currently always stores sectionId:null — this filter is forward-compatible). '
        + 'Use this before update_checklist_item/delete_checklist_item when you do not already have the ck_xxx id.',
      inputSchema: {
        type: 'object',
        properties: {
          includeDone: { type: 'boolean', description: 'include already-completed items. default true' },
          sectionId: { type: 'string', description: 'optional sec_xxx filter' }
        },
        required: []
      }
    }
  );

  // ─── delete_checklist_item — 체크리스트 항목 삭제 ────────────────────────────
  // INV-B3/B1 결손 #2 — UI(js/checklist-panel.js .ck-delete)엔 이미 있는 삭제가 MCP엔 없었다.
  registerTool(
    'delete_checklist_item',
    async ({ id } = {}) => {
      if (!id || typeof id !== 'string' || !id.startsWith('ck_')) {
        throw new Error(`invalid id: ${id} (must start with "ck_")`);
      }
      if (!_rendererInvoker?.deleteChecklistItem) throw new Error('renderer bridge not ready');
      return await _rendererInvoker.deleteChecklistItem({ id });
    },
    {
      description: 'Delete a checklist item (ck_xxx) — DESTRUCTIVE, acts on the ACTIVE project. Returns {ok, itemId, item} (item = the removed item, for confirmation). '
        + 'Get the id from list_checklist_items if you do not already have it. Returns USER_BUSY if the user is inline-editing that exact item.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'ck_xxx (checklist item id)' }
        },
        required: ['id']
      }
    }
  );

  // ─── add_mockup_block — 디바이스 목업 블록 추가 ────────────────────────────
  // 화이트리스트 + 길이 검증은 server-side, atomic 호출은 main bridge에서.
  // imgSrc 검증: dataURL/http(s) 만 허용 (javascript:, file: 등 차단)
  const _MKP_DEVICES = ['iphone', 'macbook', 'ipad', 'android', 'browser'];
  const _MKP_SHADOWS = ['none', 'soft', 'strong'];
  // Codex #1: dataURL 너무 길면 executeJavaScript payload 폭발 → 5MB cap (대략 base64 7M chars)
  const _MKP_MAX_IMGSRC = 7 * 1024 * 1024;

  function _validateMkpImgSrc(src) {
    if (typeof src !== 'string') throw new Error('imgSrc must be string');
    if (src.length > _MKP_MAX_IMGSRC) {
      throw new Error(`imgSrc too large (${src.length} > ${_MKP_MAX_IMGSRC} bytes). 5MB cap to avoid IPC payload blowup.`);
    }
    if (src === '') return; // 빈 문자열은 clear 의미
    // 허용 스킴: data:image/, http://, https://, assets/ (앱 내부 정적 경로)
    const ok =
      /^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,/.test(src) ||
      /^https?:\/\//i.test(src) ||
      /^assets\//.test(src);
    if (!ok) {
      throw new Error('imgSrc must be data:image/* (base64), http(s)://, or assets/...');
    }
    // ★put_image 와 «같은 7MB 상한» 이라 노출이 같다 — 한쪽 문만 잠그지 않는다(지디 2026-09-07).
    _assertImageSrcIntact(src, 'imgSrc');
  }

  registerTool(
    'add_mockup_block',
    async ({ deviceKey = 'iphone', width, sectionId, imgSrc, shadow } = {}) => {
      if (!_rendererInvoker || typeof _rendererInvoker.addMockupBlock !== 'function') {
        throw new Error('renderer bridge not initialized (setRendererInvoker not called)');
      }
      if (!_MKP_DEVICES.includes(deviceKey)) {
        throw new Error(`invalid deviceKey: ${deviceKey}. allowed: ${_MKP_DEVICES.join('|')}`);
      }
      if (width !== undefined && width !== null) {
        const w = parseInt(width);
        if (!Number.isFinite(w) || w < 100 || w > 860) {
          throw new Error(`invalid width: ${width} (100~860)`);
        }
      }
      if (sectionId !== undefined && sectionId !== null) {
        if (typeof sectionId !== 'string' || !sectionId.startsWith('sec_')) {
          throw new Error(`invalid sectionId: ${sectionId} (must start with sec_)`);
        }
      }
      if (imgSrc !== undefined && imgSrc !== null) _validateMkpImgSrc(imgSrc);
      if (shadow !== undefined && shadow !== null && !_MKP_SHADOWS.includes(String(shadow))) {
        throw new Error(`invalid shadow: ${shadow}. allowed: ${_MKP_SHADOWS.join('|')}`);
      }
      return await _rendererInvoker.addMockupBlock({ deviceKey, width, sectionId, imgSrc, shadow });
    },
    {
      description: 'Add a device mockup block (id prefix mkp_): phone/tablet/laptop/browser frame with an optional screenshot inside. deviceKey: iphone|macbook|ipad|android|browser. width clamped 100~860 (default = device default). imgSrc: optional data:image/* | http(s) URL | assets/... — fills the device screen. shadow: none|soft|strong (default soft). Returns {ok, blockId, deviceKey, width, hasImage}.',
      inputSchema: {
        type: 'object',
        properties: {
          deviceKey: { type: 'string', enum: ['iphone', 'macbook', 'ipad', 'android', 'browser'], description: 'device frame style (default iphone)' },
          width: { type: 'integer', description: 'pixel width, clamped 100~860. omit = device default' },
          sectionId: { type: 'string', description: 'sec_xxx target section (else selected section)' },
          imgSrc: { type: 'string', description: 'optional screen image: data:image/*;base64,... | http(s)://... | assets/...' },
          shadow: { type: 'string', enum: ['none', 'soft', 'strong'], description: 'drop-shadow preset (default soft)' }
        },
        required: []
      }
    }
  );

  // ─── add_banner02_block — banner02 블록 추가 (가로 배너) ───────────────────
  // banner02-block.js의 makeBanner02Block 전체 opts 노출. variant 2종 (frame_8, wide_4x1).
  // 텍스트(label/title/sub) + 이미지(imgSrc) + 색/크기/레이아웃까지 1콜에서 생성.
  registerTool(
    'add_banner02_block',
    async (args = {}) => {
      if (!_rendererInvoker?.addBanner02Block) throw new Error('renderer bridge not ready');
      const opts = _validateBanner02Opts(args, { mode: 'add' });
      return await _rendererInvoker.addBanner02Block(opts);
    },
    {
      description: 'Add a banner02 block (horizontal banner with label/title/sub + image). 1급 독립 배너 (banner-presets 후속). variant=frame_8 (780×260) 또는 wide_4x1 (800×200). Returns {ok, blockId, ...}. blockId는 bn2_xxx. 이후 update_banner02_block(blockId, partial)로 수정.',
      inputSchema: {
        type: 'object',
        properties: {
          sectionId: { type: 'string', description: 'sec_xxx — omit to use currently selected section' },
          variant:   { type: 'string', enum: ['frame_8', 'wide_4x1'], description: '배너 변형 (frame_8=780×260 가로배너, wide_4x1=800×200 와이드). default frame_8' },
          layerName: { type: 'string', description: '레이어 패널 표시명. default "Banner"' },
          width:  { type: 'integer', description: '배너 가로 (80~4000). variant 기본값 사용 권장' },
          height: { type: 'integer', description: '배너 세로 (40~4000)' },
          radius: { type: 'integer', description: '모서리 반경 px (0~400)' },
          bg:     { type: 'string',  description: '배경 색상 (hex 또는 css color string). default variant 기본값' },
          align:  { type: 'string', enum: ['left','center','right'], description: '텍스트 정렬. default left' },
          textX: { type: 'integer', description: '텍스트 박스 X (-4000~4000)' },
          textY: { type: 'integer', description: '텍스트 박스 Y' },
          textW: { type: 'integer', description: '텍스트 박스 너비 (20~4000)' },
          label:      { type: 'string', description: '라벨 텍스트 (≤500). default "라벨입니다."' },
          labelSize:  { type: 'integer', description: '라벨 폰트크기 px (4~400)' },
          labelColor: { type: 'string',  description: '라벨 색상 (#RRGGBB)' },
          title:      { type: 'string', description: '제목 텍스트 (≤500). default "제목을 입력합니다."' },
          titleSize:  { type: 'integer', description: '제목 폰트크기 px (4~400)' },
          titleColor: { type: 'string',  description: '제목 색상' },
          sub:        { type: 'string', description: '부제/캡션 텍스트 (≤500). default "캡션이 입력됩니다."' },
          subSize:    { type: 'integer', description: '부제 폰트크기 px (4~400)' },
          subColor:   { type: 'string',  description: '부제 색상' },
          gap1: { type: 'integer', description: '라벨↔제목 간격 px (0~400)' },
          gap2: { type: 'integer', description: '제목↔부제 간격 px (0~400)' },
          imgSrc: { type: 'string', description: '이미지 URL 또는 dataURL (≤200000). " 와 개행 금지 (CSS url("") 안전)' },
          imgX: { type: 'integer', description: '이미지 X' },
          imgY: { type: 'integer', description: '이미지 Y' },
          imgW: { type: 'integer', description: '이미지 너비 (4~4000)' },
          imgH: { type: 'integer', description: '이미지 높이 (4~4000)' },
          imgFit: { type: 'string', enum: ['cover','contain'], description: '이미지 fit. default cover' },
          layout: { type: 'string', enum: ['left','right'], description: 'text 위치 (left=텍스트 왼쪽 + 이미지 오른쪽, right=반대). 미지정 시 variant 기본값.' }
        },
        required: []
      }
    }
  );

  // ─── update_mockup_block — 기존 목업 블록 부분 수정 ────────────────────────
  registerTool(
    'update_mockup_block',
    async ({ blockId, deviceKey, width, imgSrc, shadow } = {}) => {
      if (!_rendererInvoker || typeof _rendererInvoker.updateMockupBlock !== 'function') {
        throw new Error('renderer bridge not initialized (setRendererInvoker not called)');
      }
      if (typeof blockId !== 'string' || !blockId.startsWith('mkp_')) {
        throw new Error(`invalid blockId: ${blockId} (must start with mkp_)`);
      }
      const hasField = [deviceKey, width, imgSrc, shadow].some(v => v !== undefined);
      if (!hasField) {
        throw new Error('no fields to update — provide at least one of deviceKey/width/imgSrc/shadow');
      }
      if (deviceKey !== undefined && !_MKP_DEVICES.includes(deviceKey)) {
        throw new Error(`invalid deviceKey: ${deviceKey}. allowed: ${_MKP_DEVICES.join('|')}`);
      }
      if (width !== undefined && width !== null) {
        const w = parseInt(width);
        if (!Number.isFinite(w) || w < 100 || w > 860) {
          throw new Error(`invalid width: ${width} (100~860)`);
        }
      }
      if (imgSrc !== undefined && imgSrc !== null) _validateMkpImgSrc(imgSrc);
      if (shadow !== undefined && shadow !== null && !_MKP_SHADOWS.includes(String(shadow))) {
        throw new Error(`invalid shadow: ${shadow}. allowed: ${_MKP_SHADOWS.join('|')}`);
      }
      return await _rendererInvoker.updateMockupBlock({ blockId, deviceKey, width, imgSrc, shadow });
    },
    {
      description: 'Partial update of an EXISTING device mockup block (mkp_xxx). At least one field required. deviceKey: iphone|macbook|ipad|android|browser. width: 100~860 px. imgSrc: data:image/*|http(s)|assets/ ; pass "" to clear. shadow: none|soft|strong. Re-renders SVG frame on device/width change. Returns USER_BUSY if user is editing.',
      inputSchema: {
        type: 'object',
        properties: {
          blockId: { type: 'string', description: 'target mockup block id (mkp_xxx). Get from get_canvas_state or read_section' },
          deviceKey: { type: 'string', enum: ['iphone', 'macbook', 'ipad', 'android', 'browser'], description: 'change device frame' },
          width: { type: 'integer', description: 'new width 100~860' },
          imgSrc: { type: 'string', description: 'new screen image (data:image/* | http(s) | assets/). Empty string clears the image.' },
          shadow: { type: 'string', enum: ['none', 'soft', 'strong'], description: 'drop-shadow preset' }
        },
        required: ['blockId']
      }
    }
  );

  // ─── update_banner02_block — banner02 블록 부분 수정 (id 기반) ────────────
  // PM이 텍스트/이미지/색상/레이아웃 등 partial update. add와 동일 필드 set 지원 (variant 포함).
  registerTool(
    'update_banner02_block',
    async ({ blockId, ...rest } = {}) => {
      if (!_rendererInvoker?.updateBanner02Block) throw new Error('renderer bridge not ready');
      if (typeof blockId !== 'string' || !blockId.startsWith('bn2_')) {
        throw new Error(`invalid blockId: ${blockId}. must be a string starting with "bn2_"`);
      }
      const partial = _validateBanner02Opts(rest, { mode: 'update' });
      if (Object.keys(partial).length === 0) {
        throw new Error('no fields to update — provide at least one banner02 field');
      }
      return await _rendererInvoker.updateBanner02Block({ blockId, partial });
    },
    {
      description: 'Edit an EXISTING banner02 block (bn2_xxx) — partial update of any field. banner02 v2: text는 가변 lines 배열({kind, text, size, color, gapTop}). 신규: lines(전체 교체) / addLine(추가) / removeLine(제거) / editLine(부분 수정). 레거시: label/title/sub 직접 입력도 계속 동작 (해당 kind의 첫 매칭 line에 반영, 없으면 새 line append). 한 콜에 여러 partial 조합 가능. Returns USER_BUSY if user is editing. Get blockId from get_canvas_state or returned from add_banner02_block.',
      inputSchema: {
        type: 'object',
        properties: {
          blockId: { type: 'string', description: 'bn2_xxx (banner02 block id)' },
          variant: { type: 'string', enum: ['frame_8', 'wide_4x1'] },
          width:  { type: 'integer' }, height: { type: 'integer' },
          radius: { type: 'integer' }, bg: { type: 'string' },
          align:  { type: 'string', enum: ['left','center','right'] },
          textX:  { type: 'integer' }, textY: { type: 'integer' }, textW: { type: 'integer' },
          label:      { type: 'string', description: '레거시: 첫 label kind line의 text 갱신 (없으면 append)' },
          labelSize:  { type: 'integer' }, labelColor: { type: 'string' },
          title:      { type: 'string', description: '레거시: 첫 title kind line의 text 갱신 (없으면 append)' },
          titleSize:  { type: 'integer' }, titleColor: { type: 'string' },
          sub:        { type: 'string', description: '레거시: 첫 sub kind line의 text 갱신 (없으면 append)' },
          subSize:    { type: 'integer' }, subColor:   { type: 'string' },
          gap1: { type: 'integer' }, gap2: { type: 'integer' },
          lines: {
            type: 'array', minItems: 1, maxItems: 20,
            description: '전체 텍스트 lines 교체. 항목별: {kind:label|title|sub, text, size, color, gapTop}',
            items: {
              type: 'object',
              properties: {
                kind:   { type: 'string', description: 'label|title|sub (또는 자유 클래스명)' },
                text:   { type: 'string', maxLength: 500 },
                size:   { type: 'number', minimum: 4, maximum: 400 },
                color:  { type: 'string', description: '#hex | rgb(a)/hsl(a)() | transparent' },
                gapTop: { type: 'number', minimum: 0, maximum: 400 },
              }
            }
          },
          addLine: {
            type: 'object',
            description: '한 line 추가. atIndex 생략시 끝에. lines 길이 20 초과 불가.',
            properties: {
              kind: { type: 'string' }, text: { type: 'string', maxLength: 500 },
              size: { type: 'number' }, color: { type: 'string' }, gapTop: { type: 'number' },
              atIndex: { type: 'integer', minimum: 0 }
            }
          },
          removeLine: {
            description: '한 line 제거. number(index) | {index} | {kind, occurrence?}. 마지막 1개는 제거 불가.',
            oneOf: [
              { type: 'integer', minimum: 0 },
              { type: 'object', properties: { index: { type: 'integer' }, kind: { type: 'string' }, occurrence: { type: 'integer', minimum: 1 } } }
            ]
          },
          editLine: {
            type: 'object',
            description: '한 line 부분 수정. index 또는 kind(+occurrence)로 대상 지정.',
            properties: {
              index: { type: 'integer' }, kind: { type: 'string' }, occurrence: { type: 'integer', minimum: 1 },
              text: { type: 'string' }, size: { type: 'number' }, color: { type: 'string' }, gapTop: { type: 'number' }
            }
          },
          imgSrc: { type: 'string' }, imgX: { type: 'integer' }, imgY: { type: 'integer' },
          imgW: { type: 'integer' }, imgH: { type: 'integer' }, imgFit: { type: 'string', enum: ['cover','contain'] },
          layout: { type: 'string', enum: ['left','right'] }
        },
        required: ['blockId']
      }
    }
  );

  // ─── update_frame_block — frame-block 부분 수정 (id 기반) ───────────────
  // frame은 컨테이너이지만 자체 시각/레이아웃 속성이 풍부함 (bg/border/size/padding/align/transform 등).
  // PM이 자연어로 컨테이너 스타일을 조정하는 시나리오를 위해 partial update API 노출.
  // 자식 add/remove는 별도 add_* 도구가 담당. layout 모드 전환(freeLayout↔fullWidth)도 별도 마이그레이션 필요.
  registerTool(
    'update_frame_block',
    async ({ blockId, ...rest } = {}) => {
      if (!_rendererInvoker?.updateFrameBlock) throw new Error('renderer bridge not ready');
      if (typeof blockId !== 'string' || !blockId.startsWith('ss_')) {
        throw new Error(`invalid blockId: ${blockId}. must be a string starting with "ss_"`);
      }
      const partial = _validateFrameOpts(rest, { mode: 'update' });
      if (Object.keys(partial).length === 0) {
        throw new Error('no fields to update — provide at least one frame field');
      }
      return await _rendererInvoker.updateFrameBlock({ blockId, partial });
    },
    {
      description: 'Edit an EXISTING frame block (ss_xxx) — partial update of container visual/layout properties. Frame은 다른 블록을 담는 컨테이너지만 자체 속성(배경/보더/사이즈/패딩/정렬/변형)을 직접 조작 가능. 자식 추가/제거는 add_* 도구를 사용. 지원 필드: bg(solid|gradient), bgImage(url/path|null), bgOpacity(0~1), width/height/paddingY/radius, borderWidth/borderStyle/borderColor, alignItems/justifyContent/gap, translateX/translateY/rotateDeg/flipH/flipV, bannerPreset(+confirmDestructive). 주의: (1) layout 모드(freeLayout↔fullWidth)는 자식 좌표계 자체가 바뀌므로 update 범위에서 제외. (2) bannerPreset 변경은 destructive (frame 내부 자식 모두 삭제) — confirmDestructive:true 필수. (3) freeLayout 모드에선 alignItems/justifyContent가 flex 효과 없음 (자식이 absolute) — dataset만 갱신. Returns USER_BUSY if user is editing. Get blockId from get_canvas_state.',
      inputSchema: {
        type: 'object',
        properties: {
          blockId: { type: 'string', description: 'ss_xxx (frame block id)' },
          bg: { type: 'string', maxLength: 1024, description: '배경. #hex | rgb(a)/hsl(a)() | transparent | linear-gradient(...)/radial-gradient(...) 등 CSS gradient string. "/개행/; 금지' },
          bgImage: { type: ['string', 'null'], maxLength: 4096, description: '배경 이미지. http(s)://, file://, 또는 상대/절대 path. data: URL 금지. null/empty string이면 제거.' },
          width:    { type: 'integer', minimum: 20,   maximum: 4000, description: 'frame 너비 px' },
          height:   { type: 'integer', minimum: 20,   maximum: 4000, description: 'frame 높이 px' },
          paddingY: { type: 'integer', minimum: 0,    maximum: 400,  description: '상/하 패딩 px (좌우는 기본 0)' },
          radius:   { type: 'integer', minimum: 0,    maximum: 400,  description: 'border-radius px' },
          bgOpacity: { type: 'number', minimum: 0,    maximum: 1,    description: '배경 불투명도 (0~1 float). 배경만 반투명, 콘텐츠는 불투명 유지. 1=완전 불투명' },
          borderWidth: { type: 'integer', minimum: 0, maximum: 100, description: '보더 두께 px (0이면 보더 제거)' },
          borderStyle: { type: 'string', enum: ['solid', 'dashed', 'dotted', 'double', 'none'], description: '보더 스타일' },
          borderColor: { type: 'string', description: '보더 색상. #hex | rgb(a)/hsl(a)() | transparent' },
          alignItems:     { type: 'string', enum: ['flex-start', 'center', 'flex-end', 'stretch', 'baseline'], description: 'flex align-items (가로축 자식 정렬). freeLayout 모드에선 dataset만 갱신.' },
          justifyContent: { type: 'string', enum: ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'], description: 'flex justify-content (세로축 자식 정렬). freeLayout 모드에선 dataset만 갱신.' },
          gap:        { type: 'integer', minimum: 0,      maximum: 400,   description: '자식 간 gap px' },
          translateX: { type: 'integer', minimum: -10000, maximum: 10000, description: 'transform translateX px' },
          translateY: { type: 'integer', minimum: -10000, maximum: 10000, description: 'transform translateY px' },
          rotateDeg:  { type: 'number',  minimum: -360,   maximum: 360,   description: '회전 각도 deg' },
          flipH:      { type: 'boolean', description: '좌우 반전 (true=scaleX(-1))' },
          flipV:      { type: 'boolean', description: '상하 반전 (true=scaleY(-1))' },
          bannerPreset:       { type: 'string', maxLength: 64, description: 'Banner preset key (window.BANNER_PRESETS 등록 키, 예: frame_8|wide_4x1). DESTRUCTIVE — confirmDestructive:true 동반 필수.' },
          confirmDestructive: { type: 'boolean', description: 'bannerPreset 변경 시 자식 모두 삭제 동의 플래그. bannerPreset과 동반 호출해야 적용.' }
        },
        required: ['blockId']
      }
    }
  );

  // ─── [APIMCP P1] add_frame_block — frame-block(ss_) 컨테이너 추가 ──────────
  // update_frame_block(ss_)만 있고 add가 없던 누락 보완. window.addFrameBlock 위임.
  registerTool(
    'add_frame_block',
    async ({ sectionId, fullWidth, bg, radius } = {}) => {
      if (!_rendererInvoker?.addFrameBlock) throw new Error('renderer bridge not ready');
      if (sectionId !== undefined && (typeof sectionId !== 'string' || !sectionId.startsWith('sec_'))) {
        throw new Error(`invalid sectionId: ${sectionId}`);
      }
      if (fullWidth !== undefined && typeof fullWidth !== 'boolean') throw new Error('fullWidth must be boolean');
      if (bg !== undefined && bg !== null) {
        if (typeof bg !== 'string') throw new Error('bg must be string');
        const v = bg.trim();
        const ok = /^#[0-9a-fA-F]{3,8}$/.test(v) || /^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$/.test(v) || v === 'transparent';
        if (!ok) throw new Error(`invalid bg: ${bg} (use #hex | rgb(a)/hsl(a)() | transparent)`);
      }
      if (radius !== undefined && radius !== null) {
        if (!Number.isInteger(radius) || radius < 0 || radius > 400) throw new Error(`invalid radius: ${radius} (0~400)`);
      }
      return await _rendererInvoker.addFrameBlock({ sectionId, fullWidth, bg, radius });
    },
    {
      description: 'Add a frame block (ss_xxx) — a container that holds other blocks. Two modes: freeLayout (default, absolute-positioned children, 860×520) or fullWidth(true) (flow layout, height auto, for dual-background sections). After creation use add_* tools to insert children (select the frame first) and update_frame_block(ss_, partial) to style it. Returns {ok, blockId}. blockId prefix: ss_.',
      inputSchema: {
        type: 'object',
        properties: {
          sectionId: { type: 'string', description: 'sec_xxx — omit to use currently selected section' },
          fullWidth: { type: 'boolean', description: 'true=fullWidth flow layout (이중배경 섹션용), 미지정=freeLayout 자유배치(기본)' },
          bg:        { type: 'string', description: '배경색 (#hex | rgb(a)/hsl(a)() | transparent). default #ffffff' },
          radius:    { type: 'integer', minimum: 0, maximum: 400, description: 'border-radius px' }
        },
        required: []
      }
    }
  );

  // ─── [APIMCP P1] add_liner_block — liner-block(lnr_, 곡선/원형 텍스트) 추가 ─
  // window.addLinerBlock(preset) + applyLiner로 text/fontSize/curvature/letterSpacing/startAngle 반영.
  registerTool(
    'add_liner_block',
    async ({ sectionId, preset, text, fontSize, curvature, letterSpacing, startAngle } = {}) => {
      if (!_rendererInvoker?.addLinerBlock) throw new Error('renderer bridge not ready');
      if (sectionId !== undefined && (typeof sectionId !== 'string' || !sectionId.startsWith('sec_'))) {
        throw new Error(`invalid sectionId: ${sectionId}`);
      }
      _validateLinerFields({ preset, text, fontSize, curvature, letterSpacing, startAngle });
      return await _rendererInvoker.addLinerBlock({ sectionId, preset, text, fontSize, curvature, letterSpacing, startAngle });
    },
    {
      description: 'Add a liner block (lnr_xxx) — text laid out along a curve/arc/wave/circle path (SVG textPath). Use for 곡선 텍스트 / 원형 라벨 / 아치형 헤드라인. preset: arc-up|arc-down|wave|circle. curvature(0~100) 곡률, letterSpacing(-2~20px) 자간, startAngle(0~360°) 시작 회전 위치(circle에서 12시 기준 시계방향), fontSize 글자 px, text 내용. Returns {ok, blockId}. blockId prefix: lnr_. 이후 update_liner_block(blockId, ...)로 수정.',
      inputSchema: {
        type: 'object',
        properties: {
          sectionId:     { type: 'string', description: 'sec_xxx — omit to use currently selected section' },
          preset:        { type: 'string', enum: ['arc-up','arc-down','wave','circle'], description: '곡선 형태. default arc-up' },
          text:          { type: 'string', description: '표시 텍스트 (미지정 시 placeholder)' },
          fontSize:      { type: 'integer', minimum: 4, maximum: 400, description: '글자 크기 px' },
          curvature:     { type: 'number', minimum: 0, maximum: 100, description: '곡률 (0~100). default 50' },
          letterSpacing: { type: 'number', minimum: -2, maximum: 20, description: '추가 자간 px (-2~20). default 0' },
          startAngle:    { type: 'number', minimum: 0, maximum: 360, description: '시작 회전 각도 deg (0~360). default 0' }
        },
        required: []
      }
    }
  );

  // ─── [APIMCP P1] update_liner_block — liner-block(lnr_) 부분 수정 ──────────
  registerTool(
    'update_liner_block',
    async ({ blockId, preset, text, fontSize, curvature, letterSpacing, startAngle } = {}) => {
      if (!_rendererInvoker?.updateLinerBlock) throw new Error('renderer bridge not ready');
      if (typeof blockId !== 'string' || !blockId.startsWith('lnr_')) {
        throw new Error(`invalid blockId: ${blockId}. must be a string starting with "lnr_"`);
      }
      _validateLinerFields({ preset, text, fontSize, curvature, letterSpacing, startAngle });
      const hasAny = [preset, text, fontSize, curvature, letterSpacing, startAngle].some(v => v !== undefined);
      if (!hasAny) throw new Error('no fields to update — provide at least one liner field');
      return await _rendererInvoker.updateLinerBlock({ blockId, preset, text, fontSize, curvature, letterSpacing, startAngle });
    },
    {
      description: 'Edit an EXISTING liner block (lnr_xxx) — partial update. Fields: preset(arc-up|arc-down|wave|circle), text, fontSize(4~400), curvature(0~100), letterSpacing(-2~20), startAngle(0~360). Pass only fields you want changed; preset omitted keeps current. Returns USER_BUSY if user is editing.',
      inputSchema: {
        type: 'object',
        properties: {
          blockId:       { type: 'string', description: 'lnr_xxx (liner block id)' },
          preset:        { type: 'string', enum: ['arc-up','arc-down','wave','circle'] },
          text:          { type: 'string', description: '표시 텍스트' },
          fontSize:      { type: 'integer', minimum: 4, maximum: 400, description: '글자 크기 px' },
          curvature:     { type: 'number', minimum: 0, maximum: 100, description: '곡률 (0~100)' },
          letterSpacing: { type: 'number', minimum: -2, maximum: 20, description: '추가 자간 px' },
          startAngle:    { type: 'number', minimum: 0, maximum: 360, description: '시작 회전 각도 deg' }
        },
        required: ['blockId']
      }
    }
  );

  // ─── [APIMCP P1] add_banner_block — banner 프리셋 외곽(frame-block) 추가 ────
  // window.addBannerBlock(presetKey) 위임. preset 화이트리스트: frame_8 | wide_4x1.
  // 결과는 frame-block(ss_, bannerPreset set) — 자식 텍스트/이미지는 프리셋이 자동 주입.
  registerTool(
    'add_banner_block',
    async ({ sectionId, preset } = {}) => {
      /* ★[MVP 제외] 구형 banner 는 UI 에서 뺐다(현빈 2026-08-28). 도구로도 «새로 만들지» 않는다.
         실사용 전수: 구형 블록 0개 / 신형 banner02 28개. add_banner02_block 을 써라.
         ⛔도구 정의를 지우진 않는다 — 지우면 옛 대화·스크립트가 «도구 없음»으로 조용히 실패한다.
           대신 «왜 막혔고 무엇을 쓰라»고 말한다. */
      throw new Error('add_banner 는 MVP 에서 제외됐다(구형 banner). 대신 add_banner02_block 을 사용해라.');
      // eslint-disable-next-line no-unreachable
      if (!_rendererInvoker?.addBannerBlock) throw new Error('renderer bridge not ready');
      if (sectionId !== undefined && (typeof sectionId !== 'string' || !sectionId.startsWith('sec_'))) {
        throw new Error(`invalid sectionId: ${sectionId}`);
      }
      if (preset !== undefined && preset !== null && !['frame_8', 'wide_4x1'].includes(preset)) {
        throw new Error(`invalid preset: ${preset}. allowed: frame_8|wide_4x1`);
      }
      return await _rendererInvoker.addBannerBlock({ sectionId, preset });
    },
    {
      description: 'Add a banner block — a preset frame-block(ss_xxx) with auto-injected text+image children. preset: frame_8 (가로 배너, 텍스트+이미지) | wide_4x1 (와이드 4:1). 결과 blockId는 ss_ (frame). 외곽/자식 추가 수정은 update_frame_block + add_* 도구. Note: banner02-block(add_banner02_block)과는 별개 시스템 — 이쪽은 frame 기반 레거시 banner 프리셋. Returns {ok, blockId, preset}.',
      inputSchema: {
        type: 'object',
        properties: {
          sectionId: { type: 'string', description: 'sec_xxx — omit to use currently selected section' },
          preset:    { type: 'string', enum: ['frame_8', 'wide_4x1'], description: '배너 프리셋. default frame_8' }
        },
        required: []
      }
    }
  );

  // ─── add_laurel_block ───
  // ─── add_laurel_block — laurel(월계수) 블록 추가 ─────────────────────────
  // laurel-block.js의 makeLaurelBlock 전체 opts 노출. cells 배열(grid 1×1~4×4) + leafFill 15종 프리셋.
  // 데이터 모델: cells[i] = { lines:[{text,fontSize,fontWeight,color,letterSpacing}], leafColor, leafFill, gap, height }
  registerTool(
    'add_laurel_block',
    async (args = {}) => {
      if (!_rendererInvoker?.addLaurelBlock) throw new Error('renderer bridge not ready');
      const opts = _validateLaurelOpts(args, { mode: 'add' });
      return await _rendererInvoker.addLaurelBlock(opts);
    },
    {
      description: 'Add a laurel (월계수/수상마크) block — 좌우 월계수 SVG + 가운데 텍스트 스택. blockId prefix: lrb_. Grid 지원 (gridCols×gridRows, 최대 4×4=16 cells). 각 cell은 독립적인 lines/leafColor/leafFill/gap/height. leafFill 프리셋 15종: solid(단색) + gold/silver/bronze/rosegold/platinum(클래식 5) + appleGold/appleSilver/appleMidnight/appleStarlight(Apple 4) + polishedGold/mirrorSilver/champagne/emeraldMetal/iridescent(메탈광택 5). Returns {ok, blockId, sectionId, ...}. 이후 update_laurel_block(blockId, partial)로 수정.',
      inputSchema: {
        type: 'object',
        properties: {
          sectionId: { type: 'string', description: 'sec_xxx — omit to use currently selected section' },
          layerName: { type: 'string', description: '레이어 패널 표시명. default "Laurel"' },
          gridCols:  { type: 'integer', minimum: 1, maximum: 4, description: '그리드 열 수 (1~4). default 1' },
          gridRows:  { type: 'integer', minimum: 1, maximum: 4, description: '그리드 행 수 (1~4). default 1' },
          gridColGap: { type: 'integer', minimum: 0, maximum: 400, description: '셀 가로 간격 px. default 32' },
          gridRowGap: { type: 'integer', minimum: 0, maximum: 400, description: '셀 세로 간격 px. default 24' },
          cells: {
            type: 'array', minItems: 1, maxItems: 16,
            description: '셀 배열. 길이 < gridCols*gridRows이면 자동으로 cells[0] 복제해서 채움. 각 셀: { lines, leafColor, leafFill, gap, height }',
            items: {
              type: 'object',
              properties: {
                lines: {
                  type: 'array', minItems: 1, maxItems: 20,
                  description: '텍스트 라인 배열 (cell 가운데 세로 스택)',
                  items: {
                    type: 'object',
                    properties: {
                      text:          { type: 'string', maxLength: 500 },
                      fontSize:      { type: 'integer', minimum: 8, maximum: 400 },
                      fontWeight:    { type: 'integer', minimum: 100, maximum: 900, description: '권장 300~900 (8단계)' },
                      color:         { type: 'string', description: '#hex | rgb(a)/hsl(a)() | transparent' },
                      letterSpacing: { type: 'number', minimum: -20, maximum: 50 }
                    }
                  }
                },
                leafColor: { type: 'string', description: '월계수 단색 color (leafFill=solid일 때만 영향)' },
                leafFill:  { type: 'string', enum: ['solid','gold','silver','bronze','rosegold','platinum','appleGold','appleSilver','appleMidnight','appleStarlight','polishedGold','mirrorSilver','champagne','emeraldMetal','iridescent'], description: '월계수 그라데이션 프리셋. default solid' },
                gap:       { type: 'integer', minimum: 0, maximum: 2000, description: '잎과 텍스트 사이 간격 px. default 24' },
                height:    { type: 'integer', minimum: 20, maximum: 600, description: '잎 SVG 높이 px. default 140' }
              }
            }
          },
          // ── backward-compat 단일 셀 시드 (cells 미지정 시 seed로 사용) ──
          text:       { type: 'string', maxLength: 500, description: 'LEGACY: cells[0].lines[0].text 시드' },
          fontSize:   { type: 'integer', minimum: 8, maximum: 400, description: 'LEGACY: cells[0].lines[0].fontSize 시드' },
          fontWeight: { type: 'integer', minimum: 100, maximum: 900, description: 'LEGACY: cells[0].lines[0].fontWeight 시드' },
          textColor:  { type: 'string', description: 'LEGACY: cells[0].lines[0].color 시드' },
          color:      { type: 'string', description: 'LEGACY: leafColor/textColor 마이그레이션 소스' },
          leafColor:  { type: 'string', description: 'LEGACY: cells[0].leafColor 시드' },
          gap:        { type: 'integer', minimum: 0, maximum: 2000, description: 'LEGACY: cells[0].gap 시드' },
          height:     { type: 'integer', minimum: 20, maximum: 600, description: 'LEGACY: cells[0].height 시드' }
        },
        required: []
      }
    }
  );

  // ─── update_laurel_block ───
  // ─── update_laurel_block — laurel 블록 부분 수정 (id 기반) ────────────────
  // cells 이중 중첩 모델 (cells[] of {lines[]}) 지원. cells 전체 교체 / editCell / addLine / removeLine / editLine / all* 일괄.
  registerTool(
    'update_laurel_block',
    async ({ blockId, ...rest } = {}) => {
      if (!_rendererInvoker?.updateLaurelBlock) throw new Error('renderer bridge not ready');
      if (typeof blockId !== 'string' || !blockId.startsWith('lrb_')) {
        throw new Error(`invalid blockId: ${blockId}. must be a string starting with "lrb_"`);
      }
      const partial = _validateLaurelOpts(rest, { mode: 'update' });
      if (Object.keys(partial).length === 0) {
        throw new Error('no fields to update — provide at least one laurel field');
      }
      return await _rendererInvoker.updateLaurelBlock({ blockId, partial });
    },
    {
      description: 'Edit an EXISTING laurel block (lrb_xxx) — partial update of cells/grid/lines. 데이터 모델: cells[] of { lines:[{text,fontSize,fontWeight,color,letterSpacing}], leafColor, leafFill, gap, height }. 지원 partial: (1) grid: gridCols/gridRows/gridColGap/gridRowGap (1~4 / 0~400). 변경 시 cells가 자동으로 push(seed=cells[0] 복제)/pop. (2) cells: 배열 전체 교체 (1~16). (3) editCell { index 0~15, lines?/leafColor?/leafFill?/gap?/height? }. (4) addLine { cellIndex 0~15, line:{text<=500, fontSize 8~400, fontWeight 100~900, color, letterSpacing -20~50}, atIndex? }. (5) removeLine { cellIndex, lineIndex } — 마지막 1개는 제거 불가. (6) editLine { cellIndex, lineIndex, text?/fontSize?/fontWeight?/color?/letterSpacing? }. (7) all*: allGap/allHeight/allLeafColor/allLeafFill — 모든 cells 일괄 적용. leafFill 프리셋 15종: solid|gold|silver|bronze|rosegold|platinum|appleGold|appleSilver|appleMidnight|appleStarlight|polishedGold|mirrorSilver|champagne|emeraldMetal|iridescent. Returns {ok, blockId, cellsCount, gridCols, gridRows, before, applied} or USER_BUSY if user is editing. Get blockId from get_canvas_state or returned from add_laurel_block.',
      inputSchema: {
        type: 'object',
        properties: {
          blockId: { type: 'string', description: 'lrb_xxx (laurel block id)' },
          layerName: { type: 'string', maxLength: 100, description: '레이어 패널 표시명' },
          gridCols:  { type: 'integer', minimum: 1, maximum: 4 },
          gridRows:  { type: 'integer', minimum: 1, maximum: 4 },
          gridColGap:{ type: 'integer', minimum: 0, maximum: 400 },
          gridRowGap:{ type: 'integer', minimum: 0, maximum: 400 },
          allGap:       { type: 'integer', minimum: 0, maximum: 2000, description: '일괄: 모든 cells[*].gap (잎↔텍스트 간격 px)' },
          allHeight:    { type: 'integer', minimum: 20, maximum: 600,  description: '일괄: 모든 cells[*].height (잎 SVG 높이 px)' },
          allLeafColor: { type: 'string', description: '일괄: 모든 cells[*].leafColor (#hex | rgb(a)/hsl(a)() | transparent)' },
          allLeafFill:  { type: 'string', enum: ['solid','gold','silver','bronze','rosegold','platinum','appleGold','appleSilver','appleMidnight','appleStarlight','polishedGold','mirrorSilver','champagne','emeraldMetal','iridescent'], description: '일괄: 모든 cells[*].leafFill 프리셋' },
          cells: {
            type: 'array', minItems: 1, maxItems: 16,
            description: '셀 배열 전체 교체 (1~16)',
            items: {
              type: 'object',
              properties: {
                lines: {
                  type: 'array', minItems: 1, maxItems: 20,
                  items: {
                    type: 'object',
                    properties: {
                      text:          { type: 'string', maxLength: 500 },
                      fontSize:      { type: 'integer', minimum: 8, maximum: 400 },
                      fontWeight:    { type: 'integer', minimum: 100, maximum: 900 },
                      color:         { type: 'string' },
                      letterSpacing: { type: 'number', minimum: -20, maximum: 50 }
                    }
                  }
                },
                leafColor: { type: 'string' },
                leafFill:  { type: 'string', enum: ['solid','gold','silver','bronze','rosegold','platinum','appleGold','appleSilver','appleMidnight','appleStarlight','polishedGold','mirrorSilver','champagne','emeraldMetal','iridescent'] },
                gap:       { type: 'integer', minimum: 0, maximum: 2000 },
                height:    { type: 'integer', minimum: 20, maximum: 600 }
              }
            }
          },
          editCell: {
            type: 'object',
            description: '단일 cell 부분 머지. index 필수, 나머지는 덮어쓸 키만.',
            properties: {
              index:     { type: 'integer', minimum: 0, maximum: 15 },
              lines:     { type: 'array', minItems: 1, maxItems: 20 },
              leafColor: { type: 'string' },
              leafFill:  { type: 'string', enum: ['solid','gold','silver','bronze','rosegold','platinum','appleGold','appleSilver','appleMidnight','appleStarlight','polishedGold','mirrorSilver','champagne','emeraldMetal','iridescent'] },
              gap:       { type: 'integer', minimum: 0, maximum: 2000 },
              height:    { type: 'integer', minimum: 20, maximum: 600 }
            },
            required: ['index']
          },
          addLine: {
            type: 'object',
            description: '특정 cell에 line 추가. cellIndex/line 필수, atIndex 생략 시 끝에. cell당 line 최대 20.',
            properties: {
              cellIndex: { type: 'integer', minimum: 0, maximum: 15 },
              atIndex:   { type: 'integer', minimum: 0, maximum: 20 },
              line: {
                type: 'object',
                properties: {
                  text:          { type: 'string', maxLength: 500 },
                  fontSize:      { type: 'integer', minimum: 8, maximum: 400 },
                  fontWeight:    { type: 'integer', minimum: 100, maximum: 900 },
                  color:         { type: 'string' },
                  letterSpacing: { type: 'number', minimum: -20, maximum: 50 }
                }
              }
            },
            required: ['cellIndex', 'line']
          },
          removeLine: {
            type: 'object',
            description: '특정 cell의 line 제거. 마지막 1개는 제거 불가.',
            properties: {
              cellIndex: { type: 'integer', minimum: 0, maximum: 15 },
              lineIndex: { type: 'integer', minimum: 0, maximum: 19 }
            },
            required: ['cellIndex', 'lineIndex']
          },
          editLine: {
            type: 'object',
            description: '특정 cell의 특정 line 부분 머지.',
            properties: {
              cellIndex:     { type: 'integer', minimum: 0, maximum: 15 },
              lineIndex:     { type: 'integer', minimum: 0, maximum: 19 },
              text:          { type: 'string', maxLength: 500 },
              fontSize:      { type: 'integer', minimum: 8, maximum: 400 },
              fontWeight:    { type: 'integer', minimum: 100, maximum: 900 },
              color:         { type: 'string' },
              letterSpacing: { type: 'number', minimum: -20, maximum: 50 }
            },
            required: ['cellIndex', 'lineIndex']
          }
        },
        required: ['blockId']
      }
    }
  );

  /* ─── assets ★2026-09-07 신설 ─────────────────────────────────────────────
     앱엔 에셋 IPC 가 5개 있는데 MCP 도구는 «0개»였다 — 「에셋 폴더 뭐 있어?」를 물을 수가 없었다.
     ⛔파일 «내용»은 기본으로 안 싣는다(이미지 dataURL 이 응답에 실리면 대화가 터진다).
       넣기는 기존 put_image(스크래치패드) 를 쓴다 — 여기서 두 번째 경로를 만들지 않는다. */
  registerTool(
    'list_asset_tree',
    async () => {
      if (!_rendererInvoker?.assetsTree) throw new Error('renderer bridge not ready');
      return await _rendererInvoker.assetsTree();
    },
    {
      description: 'List the Assets PANEL tree of the open project — folders, images and URLs as the user sees them '
        + '(the names they typed, nesting, favorites). Returns {ok, count, items:[{id(ast_*), type, name, depth, '
        + 'parentId, favorite, url?, hasSrc, blobPath, children}]}. '
        + 'WARNING: this is NOT list_assets — that one lists raw files on disk (hashed filenames). '
        + 'Use THIS when the user talks about the Assets panel. Image bytes/dataURLs are never included.',
      inputSchema: { type: 'object', properties: { expectedProject: { type: 'string' } }, additionalProperties: false },
    }
  );

  registerTool(
    'edit_asset_tree',
    async (args = {}) => {
      if (!_rendererInvoker?.assetsMutate) throw new Error('renderer bridge not ready');
      const OPS = ['createFolder', 'addUrl', 'rename', 'delete', 'move', 'sendToCanvas'];
      const op = args && args.op;
      if (!OPS.includes(op)) return { ok: false, code: 'BAD_OP', message: 'op must be one of ' + OPS.join('|') };
      if (['rename', 'delete', 'move', 'sendToCanvas'].includes(op) && !args.id) {
        return { ok: false, code: 'INVALID', message: op + ' needs id (ast_xxx) - get it from list_asset_tree' };
      }
      if (op === 'rename' && !args.name) return { ok: false, code: 'INVALID', message: 'rename needs name' };
      /* ★삭제는 «사람 확인»을 여기서 받는다. 앱의 window.confirm 은 MCP 호출에선 렌더러를 막아
         호출이 통째로 타임아웃난다(실측) ⇒ 확인을 «없애지 않고» 이 층으로 옮겼다. */
      if (op === 'delete' && args.confirm !== true) {
        return { ok: false, code: 'CONFIRM_REQUIRED',
          message: '에셋을 지우려면 confirm:true 를 같이 주세요 — 아무것도 지우지 않았습니다.',
          hint: 'DESTRUCTIVE. Ask the user first, then retry with confirm:true. NOTHING was deleted.' };
      }
      if (op === 'addUrl' && !args.url) return { ok: false, code: 'INVALID', message: 'addUrl needs url' };
      return await _rendererInvoker.assetsMutate({
        op, id: args.id, parentId: args.parentId, name: args.name,
        url: args.url, title: args.title, note: args.note, sectionId: args.sectionId,
      });
    },
    {
      description: 'Edit the Assets panel tree. op: createFolder (parentId?) | addUrl (url, title?, note?, parentId?) | '
        + 'rename (id, name) | delete (id) DESTRUCTIVE | move (id, parentId) | '
        + 'sendToCanvas (id) — places that image onto the canvas (the panel arrow button). '
        + 'Get ids from list_asset_tree. Returns {ok, treeCount, node, stillExists} — read back from the live tree '
        + 'after the write, so it says what actually happened (not what you asked for).',
      inputSchema: {
        type: 'object',
        properties: {
          op: { type: 'string', enum: ['createFolder', 'addUrl', 'rename', 'delete', 'move', 'sendToCanvas'] },
          id: { type: 'string', description: 'ast_xxx target node' },
          parentId: { type: 'string', description: 'ast_xxx destination folder' },
          name: { type: 'string' }, url: { type: 'string' }, title: { type: 'string' }, note: { type: 'string' },
          confirm: { type: 'boolean', description: 'required (true) for op:delete — the app would otherwise block on a dialog' },
          sectionId: { type: 'string', description: 'sec_xxx — for op:sendToCanvas, the section to place the image into (required unless one is already selected)' },
          expectedProject: { type: 'string' },
        },
        required: ['op'],
        additionalProperties: false,
      },
    }
  );

  registerTool(
    'list_assets',
    async (args = {}) => {
      if (!_rendererInvoker?.assetsList) throw new Error('renderer bridge not ready');
      return await _rendererInvoker.assetsList({ projectId: args.projectId });
    },
    {
      description: 'List the RAW FILES on disk under a project assets/ folder (hashed filenames). '
        + 'WARNING: NOT the Assets panel tree - for what the user sees there use list_asset_tree. '
        + 'Returns {ok, projectId, dir, count, items:[{blobPath, name, bytes, ext, modifiedAt}]}. '
        + 'projectId defaults to the open project. ⚠️Returns metadata only — NOT the image bytes '
        + '(use the blobPath with the app UI, or put_image to add new ones via the scratch pad). '
        + 'If the folder does not exist yet the call still succeeds with items:[] and says so.',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'proj_xxx — defaults to the open project' },
          expectedProject: { type: 'string' },
        },
        additionalProperties: false,
      },
    }
  );

  /* ─── grid-block ★2026-09-07 신설 ───────────────────────────────────────
     앱엔 `window.addGridBlock`/`updateGridBlock` 이 검증까지 갖춰 있는데 MCP 도구가 «없었다».
     ⇒ 사용자가 「그리드에 글 넣어줘」 하면 클로드가 «그런 기능 없습니다»라고 답했다(실측).
     ⛔여기서 다시 검증하지 «않는다» — 앱이 정본이다(cols 1~4·rows·cells·gap·valign).
       두 곳에서 검증하면 둘이 어긋나는 날이 온다. 여기선 «넘기고, 결과를 읽어» 돌려준다. */
  registerTool(
    'add_grid_block',
    async (args = {}) => {
      if (!_rendererInvoker?.addGridBlock) throw new Error('renderer bridge not ready');
      return await _rendererInvoker.addGridBlock({
        sectionId: args.sectionId, cols: args.cols, rows: args.rows,
        cells: args.cells, gap: args.gap, valign: args.valign,
      });
    },
    {
      description: 'Add a grid block (grd_xxx) — a column grid (1~4 columns × rows) where each cell holds text. '
        + 'cols = column widths (array, 1~4). rows = row heights ([{height:"auto"|number}]). '
        + 'cells = cell contents, row-major. gap = px between cells. valign = top|middle|bottom. '
        + 'Returns {ok, blockId(grd_), cols, cellCount} — cellCount is READ BACK from the canvas, not echoed from the args. '
        + '⚠️Legacy projects store the same block with a duo_ prefix (renamed); reading handles both.',
      inputSchema: {
        type: 'object',
        properties: {
          sectionId: { type: 'string', description: 'sec_xxx to insert into (else uses selected section)' },
          cols: { type: 'array',
            description: 'columns — 1~4 entries, each {width:number, lines:[{type:"body"|"h1".., text:"..."}]}. '
              + '★이것이 «행 0» 이다. 셀 글은 lines[].text 에 들어간다.' },
          rows: { type: 'array', description: 'row heights — [{height:"auto"|0~N}]' },
          cells: { type: 'array',
            description: '★2차원 배열 (행 × 열) — «행 0 포함». 평평한 배열을 주면 «행 N개»로 읽힌다(실측으로 데었다). '
              + '각 칸은 {lines:[{type,text}]} 꼴. 행이 모자라면 rows 를 «같은 호출»에서 같이 줘야 한다.' },
          gap: { type: 'number', description: 'gap between cells (px)' },
          valign: { type: 'string', enum: ['top', 'middle', 'bottom'] },
          expectedProject: { type: 'string', description: 'proj_xxx — refuse if a different project is open' },
        },
        additionalProperties: false,
      },
    }
  );

  registerTool(
    'update_grid_block',
    async (args = {}) => {
      if (!_rendererInvoker?.updateGridBlock) throw new Error('renderer bridge not ready');
      const { blockId, expectedProject, ...partial } = args || {};
      if (!blockId || typeof blockId !== 'string') {
        return { ok: false, code: 'INVALID', message: 'blockId (grd_xxx) is required' };
      }
      if (!Object.keys(partial).length) {
        return { ok: false, code: 'NOTHING_TO_DO',
          message: 'no fields to update — pass cols / rows / cells / patchCell / gap / valign' };
      }
      return await _rendererInvoker.updateGridBlock({ blockId, partial });
    },
    {
      description: 'Edit an EXISTING grid block (grd_xxx or legacy duo_xxx) — partial update. '
        + 'Structure fields are exclusive, pass ONE: cols (replace all) | patchCol {index,...} | '
        + 'rows (replace all) | cells (replace all, row-major) | patchCell {r,c,...}. '
        + 'Also: gap, valign. Returns {ok, cellCount, cellTexts} — ★cellTexts is READ BACK from the canvas '
        + 'after the write, so it tells you what actually landed (not what you asked for).',
      inputSchema: {
        type: 'object',
        properties: {
          blockId: { type: 'string', description: 'grd_xxx (or legacy duo_xxx)' },
          cols: { type: 'array' }, patchCol: { type: 'object' },
          rows: { type: 'array' }, cells: { type: 'array' }, patchCell: { type: 'object' },
          gap: { type: 'number' }, valign: { type: 'string', enum: ['top', 'middle', 'bottom'] },
          expectedProject: { type: 'string' },
        },
        required: ['blockId'],
        additionalProperties: false,
      },
    }
  );

  // ─── add_canvas_block ───
  // ─── add_canvas_block — canvas (Figma 임포트 + Simple Card 그리드) 블록 추가 ──
  // dual-mode: cardMode 미지정이면 레이어 모드(figma import 용 layers[]),
  //            cardMode='simple'이면 카드 그리드 모드(cards[] + 그리드 옵션).
  // blockId prefix: cvb_.
  registerTool(
    'add_canvas_block',
    async (args = {}) => {
      if (!_rendererInvoker?.addCanvasBlock) throw new Error('renderer bridge not ready');
      const opts = _validateCanvasOpts(args, { mode: 'add' });
      return await _rendererInvoker.addCanvasBlock(opts);
    },
    {
      description: 'Add a canvas block (DUAL MODE). Mode A — Layer Mode (default, cardMode omitted): free-placement layers[] for Figma import (shape/image/text with absolute x,y,w,h). Mode B — Simple Card Mode (cardMode="simple"): card grid with cards[] (title/desc/imgSrc/cellBg per card). gridCols×gridRows controls layout (1~4 each). Returns {ok, blockId, sectionId}. blockId prefix: cvb_. Use update_canvas_block(blockId, partial) afterwards. Note: img2/img3 asset presets internally fall back to canvas-block simple mode — this is the direct API for that flow.',
      inputSchema: {
        type: 'object',
        properties: {
          sectionId: { type: 'string', description: 'sec_xxx — omit to use currently selected section' },
          layerName: { type: 'string', description: '레이어 패널 표시명. default "Card"' },
          width:  { type: 'integer', description: '디자인 셀 너비 px (100~1200). default 360' },
          height: { type: 'integer', description: '디자인 셀 높이 px (40~2000). default 400' },
          bg:     { type: 'string',  description: '셀 배경색 (#hex|rgb(a)|hsl(a)|transparent). default transparent' },
          radius: { type: 'integer', description: '셀 모서리 반경 px (0~60). default 0' },
          gridCols: { type: 'integer', description: '그리드 열 수 (1~4). default 1' },
          gridRows: { type: 'integer', description: '그리드 행 수 (1~20). default 1. 5행+ = 장리스트(사이즈/가격표) 그리드' },
          cardGap:  { type: 'integer', description: '카드 사이 간격 px (0~48). default 12' },
          padX:     { type: 'integer', description: '좌우 패딩 px (0~80). default 0' },
          cardMode: { type: 'string', enum: ['simple', ''], description: '"simple"로 지정 시 Simple Card Mode (cards[] 사용). 미지정이면 레이어 모드 (layers[] 사용).' },
          // ── 레이어 모드 (cardMode 미지정) ──
          layers: {
            type: 'array', maxItems: 64,
            description: '[레이어 모드] free-placement 레이어 배열. Figma 임포트용. type 필수.',
            items: {
              type: 'object',
              properties: {
                type:       { type: 'string', enum: ['shape','image','text'] },
                x:          { type: 'integer', description: '-4000~4000' },
                y:          { type: 'integer', description: '-4000~4000' },
                w:          { type: 'integer', description: '1~4000' },
                h:          { type: 'integer', description: '1~4000' },
                color:      { type: 'string',  description: '도형 배경 또는 텍스트 색상 (#hex|rgb(a)|hsl(a)|transparent)' },
                radius:     { type: 'integer', description: '도형/이미지 모서리 반경 0~400' },
                src:        { type: 'string',  description: '이미지 URL/dataURL (≤200000, " 와 개행 금지)' },
                content:    { type: 'string',  description: '텍스트 내용 (≤2000 code points)' },
                fontSize:   { type: 'integer', description: '폰트 크기 4~400' },
                fontWeight: { type: 'string',  description: "100~900 | 'normal' | 'bold'" },
                align:      { type: 'string', enum: ['left','center','right'] },
                label:      { type: 'string',  description: '레이어 라벨 (≤100)' },
              },
              required: ['type']
            }
          },
          // ── Simple Card Mode (cardMode='simple') ──
          imgRatio:   { type: 'integer', description: '[simple] 이미지 영역 비율 % (10~90). default 76' },
          imgShape:   { type: 'string', enum: ['rect','circle'], description: '[simple] 이미지 모양. default rect' },
          labelPos:   { type: 'string', enum: ['top','bottom','both'], description: '[simple,portrait] 텍스트 위치. default bottom' },
          textHide:   { description: '[simple] 텍스트 영역 숨김. boolean 또는 "true"/"false"', oneOf: [{ type: 'boolean' }, { type: 'string', enum: ['true','false'] }] },
          textBg:     { type: 'string', description: '[simple] 텍스트 영역 기본 배경색. default #f5f5f5' },
          titleSize:  { type: 'integer', description: '[simple] 카드 제목 px (4~400). default 20' },
          descSize:   { type: 'integer', description: '[simple] 카드 설명 px (4~400). default 14' },
          textAlign:  { type: 'string', enum: ['left','center','right'], description: '[simple] 텍스트 정렬. default left' },
          titleColor: { type: 'string', description: '[simple] 제목 색상. default #ffffff' },
          descColor:  { type: 'string', description: '[simple] 설명 색상. default #ffffff' },
          cardOrient: { type: 'string', enum: ['portrait','landscape'], description: '[simple] portrait=이미지상/텍스트하, landscape=이미지좌/텍스트우. default portrait' },
          // 아이콘 모드 (이스터에그)
          iconMode:   { description: '[simple] iconify SVG 모드. boolean 또는 "true"/"false". default false', oneOf: [{ type: 'boolean' }, { type: 'string', enum: ['true','false'] }] },
          iconScale:  { type: 'integer', description: '[simple,iconMode] 아이콘 크기 % (10~90). default 46' },
          iconColor:  { type: 'string', description: '[simple,iconMode] currentColor. default #333333' },
          iconBg:     { type: 'string', description: '[simple,iconMode] 배경색. iconMode=true면 기본 #eeeeee' },
          cards: {
            type: 'array', minItems: 1, maxItems: 64,
            description: '[simple] 카드 배열. 길이는 gridCols*gridRows와 일치 권장 (불일치 시 add는 그대로 저장, update는 grid 변경 시 자동 sync).',
            items: {
              type: 'object',
              properties: {
                title:       { type: 'string', description: '카드 제목 (≤500 code points)' },
                desc:        { type: 'string', description: '카드 설명 (≤500)' },
                imgSrc:      { type: 'string', description: '이미지 URL/dataURL (≤200000, " 와 개행 금지)' },
                imgFit:      { type: 'string', enum: ['cover','contain'] },
                imgX:        { type: 'number', minimum: 0, maximum: 100, description: 'background-position X % (0~100)' },
                imgY:        { type: 'number', minimum: 0, maximum: 100, description: 'background-position Y % (0~100)' },
                imgScale:    { type: 'number', minimum: 100, maximum: 400, description: '이미지 확대 % (100~400). default 100' },
                cellBg:      { type: 'string', description: '카드별 텍스트 영역 배경색 (textBg 오버라이드)' },
                borderWidth: { type: 'integer', minimum: 0, maximum: 20 },
                borderColor: { type: 'string' },
                icon: {
                  type: 'object',
                  description: '아이콘 모드 데이터. {svg} 형식. svg는 <script/on*=/javascript: 차단됨, ≤20000.',
                  properties: { svg: { type: 'string', maxLength: 20000 } }
                },
                iconBg:    { type: 'string' },
                iconColor: { type: 'string' }
              }
            }
          }
        },
        required: []
      }
    }
  );

  // ─── update_canvas_block ───
  // ─── update_canvas_block — canvas 블록 부분 수정 (id 기반) ────────────────
  // dual-mode (cardMode='simple' / 레이어 모드). cards/layers 풀 교체 + patchCards/patchLayers 부분 갱신.
  // gridCols/gridRows 변경 시 cards 배열 자동 sync (insertCanvasGrid 패턴 미러).
  registerTool(
    'update_canvas_block',
    async ({ blockId, ...rest } = {}) => {
      if (!_rendererInvoker?.updateCanvasBlock) throw new Error('renderer bridge not ready');
      if (typeof blockId !== 'string' || !blockId.startsWith('cvb_')) {
        throw new Error(`invalid blockId: ${blockId}. must be a string starting with "cvb_"`);
      }
      const partial = _validateCanvasOpts(rest, { mode: 'update' });
      if (Object.keys(partial).length === 0) {
        throw new Error('no fields to update — provide at least one canvas field');
      }
      return await _rendererInvoker.updateCanvasBlock({ blockId, partial });
    },
    {
      description: 'Edit an EXISTING canvas block (cvb_xxx) — partial update. DUAL MODE: cardMode="simple" → use cards[]/patchCards; cardMode omitted/"" → use layers[]/patchLayers (Figma free-placement). Full replace via cards/layers; partial item update via patchCards/patchLayers [{index, ...partial}]. gridCols/gridRows changes auto-sync cards length (insertCanvasGrid mirror). Boolean fields (textHide, iconMode) accept boolean or "true"/"false". Returns USER_BUSY if user is editing. Get blockId from get_canvas_state or add_canvas_block.',
      inputSchema: {
        type: 'object',
        properties: {
          blockId: { type: 'string', description: 'cvb_xxx (canvas-block id)' },
          // 외곽
          canvasW:   { type: 'integer', description: '디자인 셀 너비 px (100~1200)' },
          canvasH:   { type: 'integer', description: '디자인 셀 높이 px (40~2000)' },
          bg:        { type: 'string',  description: '셀 배경색 (#hex|rgb(a)|hsl(a)|transparent)' },
          radius:    { type: 'integer', description: '셀 모서리 반경 px (0~60)' },
          layerName: { type: 'string',  description: '레이어 패널 표시명 (≤100)' },
          gridCols:  { type: 'integer', description: '그리드 열 수 (1~4). 변경 시 cards 자동 sync' },
          gridRows:  { type: 'integer', description: '그리드 행 수 (1~20). 변경 시 cards 자동 sync' },
          cardGap:   { type: 'integer', description: '카드 사이 간격 px (0~48)' },
          padX:      { type: 'integer', description: '좌우 패딩 px (0~80)' },
          cardMode:  { type: 'string', enum: ['simple', ''], description: '"" 또는 미지정으로 레이어 모드 복귀, "simple"로 카드 모드 전환' },
          // Simple 모드
          imgRatio:   { type: 'integer', description: '[simple] 이미지 영역 % (10~90)' },
          imgShape:   { type: 'string', enum: ['rect','circle'] },
          labelPos:   { type: 'string', enum: ['top','bottom','both'] },
          textHide:   { description: 'boolean 또는 "true"/"false"', oneOf: [{ type: 'boolean' }, { type: 'string', enum: ['true','false'] }] },
          textBg:     { type: 'string' },
          titleSize:  { type: 'integer', description: '(4~400)' },
          descSize:   { type: 'integer', description: '(4~400)' },
          textAlign:  { type: 'string', enum: ['left','center','right'] },
          titleColor: { type: 'string' },
          descColor:  { type: 'string' },
          cardOrient: { type: 'string', enum: ['portrait','landscape'] },
          iconMode:   { description: 'boolean 또는 "true"/"false"', oneOf: [{ type: 'boolean' }, { type: 'string', enum: ['true','false'] }] },
          iconScale:  { type: 'integer', description: '(10~90)' },
          iconColor:  { type: 'string' },
          iconBg:     { type: 'string' },
          // 카드 배열 (Simple 모드)
          cards: {
            type: 'array', minItems: 1, maxItems: 64,
            description: '[simple] 전체 cards 배열 교체. 항목: {title?, desc?, imgSrc?, imgFit?, imgX?, imgY?, cellBg?, borderWidth?, borderColor?, icon?:{svg}, iconBg?, iconColor?}',
            items: {
              type: 'object',
              properties: {
                title:       { type: 'string' },
                desc:        { type: 'string' },
                imgSrc:      { type: 'string' },
                imgFit:      { type: 'string', enum: ['cover','contain'] },
                imgX:        { type: 'number', minimum: 0, maximum: 100 },
                imgY:        { type: 'number', minimum: 0, maximum: 100 },
                imgScale:    { type: 'number', minimum: 100, maximum: 400, description: '이미지 확대 % (100~400)' },
                cellBg:      { type: 'string' },
                borderWidth: { type: 'integer', minimum: 0, maximum: 20 },
                borderColor: { type: 'string' },
                icon:        { type: 'object', properties: { svg: { type: 'string', maxLength: 20000 } } },
                iconBg:      { type: 'string' },
                iconColor:   { type: 'string' }
              }
            }
          },
          patchCards: {
            type: 'array', minItems: 1, maxItems: 16,
            description: '[simple] 특정 카드만 부분 갱신 [{index, ...partialCardFields}]. comparison.columnPatch 패턴.',
            items: {
              type: 'object',
              properties: {
                index:       { type: 'integer', minimum: 0, maximum: 63 },
                title:       { type: 'string' },
                desc:        { type: 'string' },
                imgSrc:      { type: 'string' },
                imgFit:      { type: 'string', enum: ['cover','contain'] },
                imgX:        { type: 'number', minimum: 0, maximum: 100 },
                imgY:        { type: 'number', minimum: 0, maximum: 100 },
                imgScale:    { type: 'number', minimum: 100, maximum: 400, description: '이미지 확대 % (100~400)' },
                cellBg:      { type: 'string' },
                borderWidth: { type: 'integer', minimum: 0, maximum: 20 },
                borderColor: { type: 'string' },
                icon:        { type: 'object', properties: { svg: { type: 'string', maxLength: 20000 } } },
                iconBg:      { type: 'string' },
                iconColor:   { type: 'string' }
              },
              required: ['index']
            }
          },
          // 레이어 배열 (레이어 모드)
          layers: {
            type: 'array', maxItems: 64,
            description: '[레이어 모드] 전체 layers 배열 교체. type 필수.',
            items: {
              type: 'object',
              properties: {
                type:       { type: 'string', enum: ['shape','image','text'] },
                x:          { type: 'integer' }, y: { type: 'integer' },
                w:          { type: 'integer' }, h: { type: 'integer' },
                color:      { type: 'string' },
                radius:     { type: 'integer' },
                src:        { type: 'string' },
                content:    { type: 'string' },
                fontSize:   { type: 'integer' },
                fontWeight: { type: 'string' },
                align:      { type: 'string', enum: ['left','center','right'] },
                label:      { type: 'string' }
              },
              required: ['type']
            }
          },
          patchLayers: {
            type: 'array', minItems: 1, maxItems: 16,
            description: '[레이어 모드] 특정 layer만 부분 갱신 [{index, ...partialLayerFields}].',
            items: {
              type: 'object',
              properties: {
                index:      { type: 'integer', minimum: 0, maximum: 63 },
                type:       { type: 'string', enum: ['shape','image','text'] },
                x:          { type: 'integer' }, y: { type: 'integer' },
                w:          { type: 'integer' }, h: { type: 'integer' },
                color:      { type: 'string' },
                radius:     { type: 'integer' },
                src:        { type: 'string' },
                content:    { type: 'string' },
                fontSize:   { type: 'integer' },
                fontWeight: { type: 'string' },
                align:      { type: 'string', enum: ['left','center','right'] },
                label:      { type: 'string' }
              },
              required: ['index']
            }
          }
        },
        required: ['blockId']
      }
    }
  );

  // ─── add_chat_block ───
  // ─── add_chat_block — 카톡식 채팅 블록 추가 ─────────────────────────────────
  // chat-block.js의 makeChatBlock 전체 opts 노출. messages 배열(1~100) + 프로필/색/사이즈까지 1콜.
  registerTool(
    'add_chat_block',
    async (args = {}) => {
      if (!_rendererInvoker?.addChatBlock) throw new Error('renderer bridge not ready');
      const opts = _validateChatOpts(args, { mode: 'add' });
      return await _rendererInvoker.addChatBlock(opts);
    },
    {
      description: 'Add a chat block (카톡식 메시지 말풍선 리스트, 좌/우 정렬 + 프로필 옵션). blockId prefix: chb_. messages[1~100] = [{text, align:left|right, hideProfile?, profileImg?, profileName?}]. 좌측(상대방)/우측(나) 색상/텍스트색 커스터마이즈 가능. 프로필 토글(showProfile/showName)은 "0"|"1". Returns {ok, blockId, ...}. 이후 update_chat_block(blockId, partial)로 수정 (messages 전체 교체 / addMessage / removeMessage / editMessage 지원).',
      inputSchema: {
        type: 'object',
        properties: {
          sectionId: { type: 'string', description: 'sec_xxx — omit to use currently selected section' },
          layerName: { type: 'string', description: '레이어 패널 표시명 (≤200). default "Chat Block"' },
          messages: {
            type: 'array', minItems: 1, maxItems: 100,
            description: '메시지 배열. 각 항목: {text, align, hideProfile?, profileImg?, profileName?}',
            items: {
              type: 'object',
              properties: {
                text:        { type: 'string', description: '말풍선 본문 (≤2000)' },
                align:       { type: 'string', enum: ['left','right'], description: 'left=상대방(좌), right=나(우)' },
                hideProfile: { type: 'boolean', description: '연속 발화 시 프로필 visibility:hidden' },
                profileImg:  { type: 'string', description: 'data:image/* | http(s):// | assets/ (≤200000, " 와 개행 금지)' },
                profileName: { type: 'string', description: '말풍선 위 표시명 (≤200, showName=1일 때만 노출)' }
              }
            }
          },
          gap:       { type: 'integer', description: '메시지 간 세로 간격 px (0~400). default 8' },
          fontSize:  { type: 'integer', description: '말풍선 텍스트 폰트크기 px (4~400). default 32' },
          bgLeft:    { type: 'string',  description: '좌측 말풍선 배경 (#hex | rgb()/hsl() | transparent). default #e5e5ea' },
          bgRight:   { type: 'string',  description: '우측 말풍선 배경. default #1888fe' },
          colorLeft: { type: 'string',  description: '좌측 텍스트 색상. default #111111' },
          colorRight:{ type: 'string',  description: '우측 텍스트 색상. default #ffffff' },
          radius:    { type: 'integer', description: '말풍선 곡률 px (0~400). default 16' },
          padding:   { type: 'integer', description: '블록 전체 패딩 px (0~400). default 16' },
          showProfile:    { type: 'string', enum: ['0','1'], description: '프로필 이미지 표시 토글 (boolean도 허용 — 자동 정규화). default 0' },
          showName:       { type: 'string', enum: ['0','1'], description: '프로필 이름(말풍선 위) 표시 토글. default 0' },
          profileSize:    { type: 'integer', description: '프로필 원형 크기 px (24~400). 미지정 시 fontSize 기반 자동 계산' },
          profileOffsetY: { type: 'integer', description: '프로필 top margin px (-400~400). default 0' },
          profileGap:     { type: 'integer', description: '프로필 ↔ 말풍선 가로 간격 px (0~400). default 8' }
        },
        required: []
      }
    }
  );

  // ─── update_chat_block ───
  // ─── update_chat_block — 기존 채팅 블록 부분 수정 (id 기반) ──────────────
  // PM이 메시지/색상/프로필/레이아웃 partial update. add와 동일 필드 set + messages 가변 컨트롤.
  registerTool(
    'update_chat_block',
    async ({ blockId, ...rest } = {}) => {
      if (!_rendererInvoker?.updateChatBlock) throw new Error('renderer bridge not ready');
      if (typeof blockId !== 'string' || !blockId.startsWith('chb_')) {
        throw new Error(`invalid blockId: ${blockId}. must be a string starting with "chb_"`);
      }
      const partial = _validateChatOpts(rest, { mode: 'update' });
      if (Object.keys(partial).length === 0) {
        throw new Error('no fields to update — provide at least one chat field');
      }
      return await _rendererInvoker.updateChatBlock({ blockId, partial });
    },
    {
      description: 'Edit an EXISTING chat block (chb_xxx) — partial update. messages는 가변 배열: messages(전체 교체) / addMessage({...msg, atIndex?}) / removeMessage(number|{index}) / editMessage({index, ...partial}). 스타일: gap/fontSize/bgLeft/bgRight/colorLeft/colorRight/radius/padding. 프로필: showProfile/showName (0|1 또는 boolean), profileSize(null이면 reset)/profileOffsetY/profileGap. 꼬리/레이아웃: tailScale(꼬리 크기 % 0~400), fullBleed(패딩 제외 0|1|boolean). layerName도 갱신 가능. 한 콜에 여러 partial 조합 가능. Returns USER_BUSY if user is editing a bubble (contenteditable=true). Get blockId from get_canvas_state or returned from add_chat_block.',
      inputSchema: {
        type: 'object',
        properties: {
          blockId: { type: 'string', description: 'chb_xxx (chat block id)' },
          messages: {
            type: 'array', minItems: 1, maxItems: 100,
            description: '전체 messages 교체. 각 항목: {text, align, hideProfile?, profileImg?, profileName?}',
            items: {
              type: 'object',
              properties: {
                text:        { type: 'string', maxLength: 2000 },
                align:       { type: 'string', enum: ['left','right'] },
                hideProfile: { type: 'boolean' },
                profileImg:  { type: 'string', description: 'data:image/* | http(s) | assets/ (≤200000, no quote/newline)' },
                profileName: { type: 'string', maxLength: 200 },
                stars:       { type: ['integer','null'], minimum: 0, maximum: 5, description: '말풍선 상단 별점 0~5. null/생략이면 별점 없음' }
              }
            }
          },
          addMessage: {
            type: 'object',
            description: '한 메시지 추가. atIndex 생략시 끝에. 결과 길이 100 초과 불가.',
            properties: {
              text:        { type: 'string', maxLength: 2000 },
              align:       { type: 'string', enum: ['left','right'] },
              hideProfile: { type: 'boolean' },
              profileImg:  { type: 'string' },
              profileName: { type: 'string', maxLength: 200 },
              stars:       { type: ['integer','null'], minimum: 0, maximum: 5 },
              atIndex:     { type: 'integer', minimum: 0 }
            }
          },
          removeMessage: {
            description: '한 메시지 제거. number(index) | {index}.',
            oneOf: [
              { type: 'integer', minimum: 0 },
              { type: 'object', properties: { index: { type: 'integer', minimum: 0 } }, required: ['index'] }
            ]
          },
          editMessage: {
            type: 'object',
            description: '한 메시지 부분 수정. index 필수, 나머지 필드는 partial.',
            properties: {
              index:       { type: 'integer', minimum: 0 },
              text:        { type: 'string', maxLength: 2000 },
              align:       { type: 'string', enum: ['left','right'] },
              hideProfile: { type: 'boolean' },
              profileImg:  { type: 'string' },
              profileName: { type: 'string', maxLength: 200 },
              stars:       { type: ['integer','null'], minimum: 0, maximum: 5 }
            },
            required: ['index']
          },
          gap:       { type: 'integer', description: '메시지 간 세로 간격 px (0~400)' },
          fontSize:  { type: 'integer', description: '폰트크기 px (4~400)' },
          bgLeft:    { type: 'string',  description: '좌측 배경 (#hex | rgb()/hsl() | transparent)' },
          bgRight:   { type: 'string',  description: '우측 배경' },
          colorLeft: { type: 'string',  description: '좌측 텍스트 색상' },
          colorRight:{ type: 'string',  description: '우측 텍스트 색상' },
          radius:    { type: 'integer', description: '말풍선 곡률 px (0~400)' },
          padding:   { type: 'integer', description: '블록 패딩 px (0~400)' },
          showProfile: { description: '프로필 표시 (0|1 또는 boolean — 자동 정규화)', oneOf: [{ type: 'string', enum: ['0','1'] }, { type: 'boolean' }] },
          showName:    { description: '프로필 이름 표시 (0|1 또는 boolean)',         oneOf: [{ type: 'string', enum: ['0','1'] }, { type: 'boolean' }] },
          profileSize:    { type: ['integer','null'], description: '프로필 크기 px (24~400). null이면 reset(자동 계산)' },
          profileOffsetY: { type: 'integer', description: '프로필 top margin px (-400~400)' },
          profileGap:     { type: 'integer', description: '프로필 ↔ 말풍선 간격 px (0~400)' },
          tailScale:      { type: 'integer', description: '말풍선 꼬리 크기 % (0~400, 기본 100). 0이면 꼬리 숨김' },
          fullBleed:      { description: '패딩 제외(섹션 좌우패딩 무시, full-bleed). 0|1 또는 boolean', oneOf: [{ type: 'string', enum: ['0','1'] }, { type: 'boolean' }] },
          layerName:      { type: 'string',  description: '레이어 패널 표시명 (≤200)' }
        },
        required: ['blockId']
      }
    }
  );

  // ─── add_gradient_block ───
  // ─── add_gradient_block — 그라데이션 오버레이 블록 추가 (페이드 비네트) ──────
  // gradient-block.js의 makeGradientBlock 전체 opts 노출.
  // sticker 패턴(.section-block 직접 자식, absolute). 이미지 끝선/섹션 경계 페이드 용도.
  registerTool(
    'add_gradient_block',
    async (args = {}) => {
      if (!_rendererInvoker?.addGradientBlock) throw new Error('renderer bridge not ready');
      const opts = _validateGradientOpts(args, { mode: 'add' });
      return await _rendererInvoker.addGradientBlock(opts);
    },
    {
      description: 'Add a gradient overlay block (linear/radial fade). 섹션 위에 absolute로 떠있는 페이드 오버레이 — 이미지 끝선이나 섹션 경계의 부자연스러움을 자연스럽게 연결. style=linear(8방향) 또는 radial(중앙→외곽 비네트). startColor/endColor는 #RRGGBB 6자리 hex만 (rgb()/hsl() 불가). startAlpha/endAlpha는 0~1 float. 디폴트: 860×300, 좌상단(0,0), linear, to bottom, 검정 100%→검정 0%. Returns {ok, blockId, ...}. blockId는 grad_xxx. 이후 update_gradient_block(blockId, partial)로 수정.',
      inputSchema: {
        type: 'object',
        properties: {
          sectionId: { type: 'string', description: 'sec_xxx — omit to use currently selected section' },
          layerName: { type: 'string', description: '레이어 패널 표시명. default "Gradient"' },
          style: { type: 'string', enum: ['linear', 'radial'], description: 'linear=방향 페이드, radial=중앙 비네트. default linear' },
          direction: {
            type: 'string',
            enum: ['to bottom','to top','to right','to left','to bottom right','to bottom left','to top right','to top left'],
            description: 'linear 전용 8방향. radial일 땐 무시. default "to bottom"'
          },
          startColor: { type: 'string', description: '시작 색 #RRGGBB (6자리 hex only). default #000000' },
          endColor:   { type: 'string', description: '끝 색 #RRGGBB (6자리 hex only). default #000000' },
          startAlpha: { type: 'number', minimum: 0, maximum: 1, description: '시작 알파 0~1. default 1' },
          endAlpha:   { type: 'number', minimum: 0, maximum: 1, description: '끝 알파 0~1. default 0 (페이드 아웃)' },
          width:  { type: 'integer', minimum: 200, maximum: 1200, description: '오버레이 너비 px (200~1200). default 860' },
          height: { type: 'integer', minimum: 50,  maximum: 1500, description: '오버레이 높이 px (50~1500). default 300' },
          x: { type: 'integer', minimum: -4000, maximum: 4000, description: '섹션 기준 left px. 음수 허용. default 0' },
          y: { type: 'integer', minimum: -4000, maximum: 4000, description: '섹션 기준 top px. 음수 허용 (섹션 밖은 자동 클립). default 0' }
        },
        required: []
      }
    }
  );

  // ─── update_gradient_block ───
  // ─── update_gradient_block — gradient 블록 부분 수정 (id 기반) ──────────────
  // PM이 색상/알파/위치/크기/스타일 등 partial update.
  registerTool(
    'update_gradient_block',
    async ({ blockId, ...rest } = {}) => {
      if (!_rendererInvoker?.updateGradientBlock) throw new Error('renderer bridge not ready');
      if (typeof blockId !== 'string' || !blockId.startsWith('grad_')) {
        throw new Error(`invalid blockId: ${blockId}. must be a string starting with "grad_"`);
      }
      const partial = _validateGradientOpts(rest, { mode: 'update' });
      if (Object.keys(partial).length === 0) {
        throw new Error('no fields to update — provide at least one gradient field');
      }
      return await _rendererInvoker.updateGradientBlock({ blockId, partial });
    },
    {
      description: 'Edit an EXISTING gradient block (grad_xxx) — partial update. 그라데이션 페이드 오버레이의 색·알파·방향·크기·위치를 수정. style=linear|radial 전환. startColor/endColor는 #RRGGBB 6자리 hex (rgb()/hsl() 불가 — gradient-block의 _hexToRgba는 hex만 안전 처리). startAlpha/endAlpha는 0~1 float (0.5 등 소수). width 200~1200, height 50~1500, x/y -4000~4000. 한 콜에 여러 필드 조합 가능. Returns USER_BUSY if user is editing. Get blockId from get_canvas_state.',
      inputSchema: {
        type: 'object',
        properties: {
          blockId: { type: 'string', description: 'grad_xxx (gradient block id)' },
          style: { type: 'string', enum: ['linear', 'radial'], description: 'linear=방향 페이드 / radial=중앙 비네트' },
          direction: {
            type: 'string',
            enum: ['to bottom','to top','to right','to left','to bottom right','to bottom left','to top right','to top left'],
            description: 'linear 전용 8방향. radial일 땐 무시됨'
          },
          startColor: { type: 'string', description: '시작 색 #RRGGBB (6자리 hex)' },
          endColor:   { type: 'string', description: '끝 색 #RRGGBB (6자리 hex)' },
          startAlpha: { type: 'number', minimum: 0, maximum: 1, description: '시작 알파 0~1 float' },
          endAlpha:   { type: 'number', minimum: 0, maximum: 1, description: '끝 알파 0~1 float' },
          width:  { type: 'integer', minimum: 200, maximum: 1200 },
          height: { type: 'integer', minimum: 50,  maximum: 1500 },
          x: { type: 'integer', minimum: -4000, maximum: 4000, description: '섹션 기준 left px (음수 허용)' },
          y: { type: 'integer', minimum: -4000, maximum: 4000, description: '섹션 기준 top px (음수 허용)' },
          layerName: { type: 'string', description: '레이어 패널 표시명 (≤100)' }
        },
        required: ['blockId']
      }
    }
  );

  // ─── update_iconify_block ───
  // ─── update_iconify_block — 기존 iconify(icon-block) 블록 부분 수정 (id 기반) ──
  // PM이 layerName/size/rotation/iconColor/iconName partial update.
  // iconName 변경 시 main에서 새 SVG fetch 후 renderer에 svg 함께 전달.
  registerTool(
    'update_iconify_block',
    async ({ blockId, ...rest } = {}) => {
      if (!_rendererInvoker?.updateIconifyBlock) throw new Error('renderer bridge not ready');
      if (typeof blockId !== 'string' || !blockId.startsWith('icn_')) {
        throw new Error(`invalid blockId: ${blockId}. must be a string starting with "icn_"`);
      }
      const partial = _validateIconifyUpdateOpts(rest);
      if (Object.keys(partial).length === 0) {
        throw new Error('no fields to update — provide at least one of: layerName|size|rotation|iconColor|iconName');
      }

      // iconName 변경 시: prefix:name 파싱 → svg 재fetch (색상이 함께 오면 그 색으로, 아니면 기존 색 유지는 불가하므로 fetch는 partial.iconColor 우선, 미지정 시 원본).
      // 색상만 바뀌고 iconName 미변경 → currentColor 기반 SVG는 style.color만으로 반영됨. fetch 불필요.
      if (partial.iconName !== undefined) {
        const colonIdx = partial.iconName.indexOf(':');
        const prefix   = partial.iconName.slice(0, colonIdx);
        const iconName = partial.iconName.slice(colonIdx + 1);
        if (!_ICONIFY_PREFIXES.includes(prefix)) {
          throw new Error(`invalid prefix in iconName: ${prefix}. allowed: ${_ICONIFY_PREFIXES.join('|')}`);
        }
        if (!/^[a-z0-9-]{1,80}$/.test(iconName)) {
          throw new Error(`invalid icon name: ${iconName} (lowercase a-z 0-9 - only, ≤80)`);
        }
        if (!_iconifyApi?.fetchSvg) throw new Error('iconify api not initialized (setIconifyApi not called)');
        const fetchColor = partial.iconColor; // 색상도 함께 변경 시 새 색으로 fetch
        const svgResult = await _iconifyApi.fetchSvg({ prefix, name: iconName, color: fetchColor });
        if (!svgResult || !svgResult.ok) {
          return svgResult || { ok: false, code: 'FETCH_FAILED', message: 'svg fetch failed' };
        }
        partial.svg = svgResult.svg;
      }

      return await _rendererInvoker.updateIconifyBlock({ blockId, partial });
    },
    {
      description: 'Edit an EXISTING iconify icon-block (icn_xxx) — partial update. Fields: layerName(≤100), size(16~512 px), rotation(\'0\'|\'90\'|\'180\'|\'270\'), iconColor(#hex|rgb(a)|hsl(a)|transparent), iconName("prefix:icon-name"). iconName 변경 시 main에서 새 SVG fetch 후 재렌더 (add_iconify_block과 동일 prefix 화이트리스트 적용). iconColor만 변경 시 SVG가 currentColor를 쓰면 즉시 반영, 안 쓰면 색상이 안 바뀔 수 있음 — 확실하려면 iconName도 같이 전달해 재fetch. Returns USER_BUSY if user is editing. Get blockId from get_canvas_state or returned from add_iconify_block. ALLOWED iconName prefixes: ' + _ICONIFY_PREFIXES.join(', ') + '.',
      inputSchema: {
        type: 'object',
        properties: {
          blockId:   { type: 'string',  description: 'icn_xxx (iconify icon-block id)' },
          layerName: { type: 'string',  description: '레이어 패널 표시명 (≤100 code points)' },
          iconName:  { type: 'string',  description: '"prefix:icon-name" 형식. 예: "ph:house-bold". 변경 시 새 SVG fetch.' },
          size:      { type: 'integer', minimum: 16, maximum: 512, description: '아이콘 픽셀 크기 (16~512)' },
          rotation:  { type: 'string',  enum: ['0','90','180','270'], description: '회전 각도 deg (4단)' },
          iconColor: { type: 'string',  description: 'SVG 색상 — #hex | rgb(a)/hsl(a)() | transparent. SVG가 currentColor를 쓰면 즉시 반영.' }
        },
        required: ['blockId']
      }
    }
  );

  // ─── add_sticker_block ───
  // ─── add_sticker_block — sticker 블록 추가 (polymorphic: 5 shapes) ─────────
  // sticker-block.js의 makeStickerBlock 전체 opts 노출.
  // shape에 따라 활성 필드 완전히 다름: circle/square(뱃지) | text(자유 텍스트) | highlight(사각 형광펜) | highlightB(선 형광펜).
  registerTool(
    'add_sticker_block',
    async (args = {}) => {
      if (!_rendererInvoker?.addStickerBlock) throw new Error('renderer bridge not ready');
      const opts = _validateStickerOpts(args, { mode: 'add' });
      return await _rendererInvoker.addStickerBlock(opts);
    },
    {
      description: 'Add a sticker block (floating overlay inside section). blockId prefix: stk_. shape별 권장 사용: ① circle/square 뱃지 → {shape:"circle",text:"NEW",bgColor:"#e74c3c",size:60}. ② 자유 텍스트 → {shape:"text",text:"할인!",fontSize:48,textColor:"#ff3b30"}. ③ 사각 형광펜 → {shape:"highlight",hlW:200,hlH:30,x:100,y:200}. ④ 선 형광펜 → {shape:"highlightB",x1:50,y1:100,x2:300,y2:100,thickness:14,lineStyle:"line"}. Returns {ok, blockId, ...}. 이후 update_sticker_block(blockId, partial)로 수정. shape 변경은 새 블록 추가 권장 (update에서 shape 바꾸면 기본값 강제 주입).',
      inputSchema: {
        type: 'object',
        properties: {
          sectionId: { type: 'string', description: 'sec_xxx — omit to use currently selected section' },
          shape: { type: 'string', enum: ['circle','square','text','highlight','highlightB'], description: '스티커 모양. default circle' },
          mode: { type: 'string', enum: ['text','image'], description: 'circle/square 전용 모드. image면 imgSrc 필요. default text' },
          layerName: { type: 'string', description: '레이어 패널 표시명 (≤200). default "Sticker"' },
          // 공통 위치 + 회전
          x: { type: 'integer', description: '섹션 기준 absolute left px (-4000~4000). default 40' },
          y: { type: 'integer', description: '섹션 기준 absolute top px (-4000~4000). default 40' },
          rotation: { type: 'integer', description: '회전 deg (-180~180). circle/square/text/image에 적용. default 0' },
          // circle/square 전용
          size: { type: 'integer', description: 'circle/square 정사각 크기 px (10~600). default 60. sizeW/sizeH도 동기화됨' },
          sizeW: { type: 'integer', description: 'circle/square 너비 px (10~600). size보다 우선' },
          sizeH: { type: 'integer', description: 'circle/square 높이 px (10~600). size보다 우선' },
          // text content (circle/square/text 공통)
          text: { type: 'string', description: '표시 텍스트 (≤500). default "NEW" (text shape이면 "Text")' },
          bgColor: { type: 'string', description: '배경색 (hex/rgb/rgba/hsl/transparent). circle/square default #e74c3c, text default transparent' },
          textColor: { type: 'string', description: '글자색. circle/square default #ffffff, text default #222222' },
          fontSize: { type: 'integer', description: '폰트 크기 px. circle/square: 6~150 (default 14), text: 8~400 (default 32)' },
          fontWeight: { type: 'string', enum: ['300','400','500','600','700','800','900'], description: '폰트 굵기. default 700' },
          imgSrc: { type: 'string', description: 'circle/square + mode=image 전용 이미지 src (≤200000). data:image/* | http(s) | assets/. " 와 개행 금지' },
          // highlight 전용 (사각 형광펜)
          hlW: { type: 'integer', description: 'shape=highlight 너비 px (10~1200). default 160' },
          hlH: { type: 'integer', description: 'shape=highlight 높이 px (4~400). default 28' },
          hlColor: { type: 'string', description: '형광펜 색상 (highlight + highlightB 공통). rgba(255,235,70,0.7) 권장' },
          // highlightB 전용 (선 형광펜)
          x1: { type: 'integer', description: 'shape=highlightB 시작점 X (-4000~4000)' },
          y1: { type: 'integer', description: 'shape=highlightB 시작점 Y (-4000~4000)' },
          x2: { type: 'integer', description: 'shape=highlightB 끝점 X (-4000~4000)' },
          y2: { type: 'integer', description: 'shape=highlightB 끝점 Y (-4000~4000)' },
          thickness: { type: 'integer', description: 'shape=highlightB 선 두께 px (1~200). default 12' },
          lineStyle: { type: 'string', enum: ['line','wavy','marker'], description: 'shape=highlightB 선 스타일. default line' },
          amplitude: { type: 'integer', description: 'shape=highlightB + lineStyle=wavy 진폭 px (1~60). default 6' },
          period: { type: 'integer', description: 'shape=highlightB + lineStyle=wavy 주기 px (6~200). default 30' },
          // text shape 전용
          fontFamily: { type: 'string', enum: ["'Pretendard', sans-serif","'Noto Sans KR', sans-serif","'Noto Serif KR', serif","'Inter', sans-serif","-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",'sans-serif','serif','monospace'], description: 'shape=text 전용 폰트 패밀리. default Pretendard' },
          strokeWidth: { type: 'integer', description: 'shape=text 외곽선 두께 px (0~50). 0이면 없음. default 0' },
          strokeColor: { type: 'string', description: 'shape=text 외곽선 색. default #ffffff' },
          letterSpacing: { type: 'integer', description: 'shape=text 자간 px (-10~40). default 0' },
          textAlign: { type: 'string', enum: ['left','center','right'], description: 'shape=text 정렬. default left' },
          shadowOn: { type: 'string', enum: ['0','1'], description: 'shape=text 그림자 토글. 1=on. default 0' },
          shadowX: { type: 'integer', description: 'shape=text 그림자 X offset (-20~20). default 0' },
          shadowY: { type: 'integer', description: 'shape=text 그림자 Y offset (-20~20). default 2' },
          shadowBlur: { type: 'integer', description: 'shape=text 그림자 blur (0~40). default 4' },
          shadowColor: { type: 'string', description: 'shape=text 그림자 색. default rgba(0,0,0,0.4)' },
          padX: { type: 'integer', description: 'shape=text padding 좌우 px (0~400). default 10' },
          padY: { type: 'integer', description: 'shape=text padding 상하 px (0~400). default 6' }
        },
        required: []
      }
    }
  );

  // ─── update_sticker_block ───
  // ─── update_sticker_block — sticker 블록 부분 수정 (id 기반) ───────────────
  // PM이 텍스트/색상/위치/사이즈/회전 등 partial update. add와 동일 필드 set 지원.
  // shape 변경은 가능하지만 prop-sticker.js Shape 토글 패턴 따라 기본값 강제 주입됨 → 새 블록 add 권장.
  registerTool(
    'update_sticker_block',
    async ({ blockId, ...rest } = {}) => {
      if (!_rendererInvoker?.updateStickerBlock) throw new Error('renderer bridge not ready');
      if (typeof blockId !== 'string' || !blockId.startsWith('stk_')) {
        throw new Error(`invalid blockId: ${blockId}. must be a string starting with "stk_"`);
      }
      const partial = _validateStickerOpts(rest, { mode: 'update' });
      if (Object.keys(partial).length === 0) {
        throw new Error('no fields to update — provide at least one sticker field');
      }
      return await _rendererInvoker.updateStickerBlock({ blockId, partial });
    },
    {
      description: 'Edit an EXISTING sticker block (stk_xxx) — partial update of any field. sticker는 polymorphic (5 shapes: circle/square/text/highlight/highlightB). shape별 활성 필드 다름. partial.size 들어오면 sizeW/sizeH도 동기화됨. partial.imgSrc="" 보내면 이미지 클리어 + mode=text 강제. shape 변경은 prop-sticker.js Shape 토글 패턴 따라 shape별 기본값 자동 주입(text 전환시 fontFamily/letterSpacing 등, highlightB 전환시 x1/y1/x2/y2 등) — PM 의도와 다를 수 있어 새 블록 add 권장. partial.shadowOn은 boolean true/false도 받아서 "1"/"0"으로 normalize. Returns USER_BUSY if user is editing. Get blockId from get_canvas_state or returned from add_sticker_block.',
      inputSchema: {
        type: 'object',
        properties: {
          blockId: { type: 'string', description: 'stk_xxx (sticker block id)' },
          shape: { type: 'string', enum: ['circle','square','text','highlight','highlightB'], description: '변경 시 shape별 기본값 자동 주입됨 — 의도와 다르면 새 블록 add 권장' },
          mode: { type: 'string', enum: ['text','image'], description: 'circle/square 전용. text로 바꾸면 imgSrc 자동 삭제' },
          layerName: { type: 'string' },
          x: { type: 'integer' }, y: { type: 'integer' }, rotation: { type: 'integer' },
          size: { type: 'integer', description: '바뀌면 sizeW/sizeH도 동기화' },
          sizeW: { type: 'integer' }, sizeH: { type: 'integer' },
          text: { type: 'string' },
          bgColor: { type: 'string' }, textColor: { type: 'string' },
          fontSize: { type: 'integer', description: 'shape별 범위: circle/square 6~150, text 8~400' },
          fontWeight: { type: 'string', enum: ['300','400','500','600','700','800','900'] },
          imgSrc: { type: 'string', description: 'data:image/*|http(s)|assets/. 빈 문자열 ""이면 클리어 + mode=text' },
          hlW: { type: 'integer' }, hlH: { type: 'integer' }, hlColor: { type: 'string' },
          x1: { type: 'integer' }, y1: { type: 'integer' }, x2: { type: 'integer' }, y2: { type: 'integer' },
          thickness: { type: 'integer' },
          lineStyle: { type: 'string', enum: ['line','wavy','marker'] },
          amplitude: { type: 'integer' }, period: { type: 'integer' },
          fontFamily: { type: 'string', enum: ["'Pretendard', sans-serif","'Noto Sans KR', sans-serif","'Noto Serif KR', serif","'Inter', sans-serif","-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",'sans-serif','serif','monospace'] },
          strokeWidth: { type: 'integer' }, strokeColor: { type: 'string' },
          letterSpacing: { type: 'integer' },
          textAlign: { type: 'string', enum: ['left','center','right'] },
          shadowOn: { description: '"1"/"0" 문자열 또는 boolean true/false', oneOf: [ { type: 'string', enum: ['0','1'] }, { type: 'boolean' } ] },
          shadowX: { type: 'integer' }, shadowY: { type: 'integer' }, shadowBlur: { type: 'integer' },
          shadowColor: { type: 'string' },
          padX: { type: 'integer' }, padY: { type: 'integer' }
        },
        required: ['blockId']
      }
    }
  );

  // ─── add_vector_block ───
  // ─── add_vector_block — vector(SVG) 블록 추가 ─────────────────────────────
  // vector-block.js의 addVectorBlock(svgString, opts) 시그니처를 한 객체로 wrap.
  // svgString = args.svg, 나머지(color/w/h/layerName)는 opts로 전달.
  registerTool(
    'add_vector_block',
    async (args = {}) => {
      if (!_rendererInvoker?.addVectorBlock) throw new Error('renderer bridge not ready');
      const opts = _validateVectorOpts(args, { mode: 'add' });
      if (typeof opts.svg !== 'string') {
        throw new Error('svg is required for add_vector_block');
      }
      return await _rendererInvoker.addVectorBlock(opts);
    },
    {
      description: 'Add a vector (SVG) block. Renders raw SVG string with fill color replacement (fill="black|#000|#000000|currentColor" → color). blockId prefix: vb_. w/h는 block.style px (10~4000). svg는 raw SVG 문자열(<svg ...>...</svg>), <script> 차단, 최대 200000자. color는 #hex/rgb(a)/hsl(a)/transparent만. layerName은 레이어 패널 표시명 (default "Vector"). Returns {ok, blockId, ...}. 이후 update_vector_block(blockId, partial)로 수정.',
      inputSchema: {
        type: 'object',
        properties: {
          sectionId: { type: 'string', description: 'sec_xxx — omit to use currently selected section' },
          svg:       { type: 'string', description: 'raw SVG string (≤200000). <script> 차단. 빈 문자열 허용 (placeholder 생성).' },
          color:     { type: 'string', description: 'fill 치환 색상 (#hex | rgb(a)/hsl(a)() | transparent). default #000000' },
          w:         { type: 'integer', description: 'block width px (10~4000). default 120' },
          h:         { type: 'integer', description: 'block height px (10~4000). default 120' },
          layerName: { type: 'string',  description: '레이어 패널 표시명 (≤200). default "Vector"' },
          label:     { type: 'string',  description: '(alias of layerName) makeVectorBlock data.label과 호환' }
        },
        required: ['svg']
      }
    }
  );

  // ─── update_vector_block ───
  // ─── update_vector_block — 기존 vector 블록 부분 수정 (id 기반) ───────────
  // PM이 svg/color/w/h/layerName partial update. add와 동일 _validateVectorOpts 재사용.
  registerTool(
    'update_vector_block',
    async ({ blockId, ...rest } = {}) => {
      if (!_rendererInvoker?.updateVectorBlock) throw new Error('renderer bridge not ready');
      if (typeof blockId !== 'string' || !blockId.startsWith('vb_')) {
        throw new Error(`invalid blockId: ${blockId}. must be a string starting with "vb_"`);
      }
      const partial = _validateVectorOpts(rest, { mode: 'update' });
      if (Object.keys(partial).length === 0) {
        throw new Error('no fields to update — provide at least one of svg/color/w/h/layerName');
      }
      return await _rendererInvoker.updateVectorBlock({ blockId, partial });
    },
    {
      description: 'Edit an EXISTING vector (SVG) block (vb_xxx) — partial update. svg(raw SVG string, ≤200000, <script> 차단) / color(fill 치환 색상, #hex|rgb(a)|hsl(a)|transparent) / w,h(block px size, 10~4000) / layerName(≤200). 빈 svg("")로 클리어 가능. 한 콜에 여러 필드 조합 가능. Returns USER_BUSY if user is editing. Get blockId from get_canvas_state or returned from add_vector_block.',
      inputSchema: {
        type: 'object',
        properties: {
          blockId:   { type: 'string', description: 'vb_xxx (vector block id)' },
          svg:       { type: 'string', description: 'raw SVG string (≤200000). 빈 문자열은 SVG 클리어.' },
          color:     { type: 'string', description: 'fill 치환 색상 (#hex | rgb(a)/hsl(a)() | transparent)' },
          w:         { type: 'integer', description: 'block width px (10~4000)' },
          h:         { type: 'integer', description: 'block height px (10~4000)' },
          layerName: { type: 'string',  description: '레이어 패널 표시명 (≤200)' }
        },
        required: ['blockId']
      }
    }
  );

  // ─── add_divider_block ───
  // ─── add_divider_block — divider 블록 추가 (구분선) ────────────────────────
  // block-factory.js의 addDividerBlock 확장 호출. opts 풀세트 (색/스타일/두께 + 패딩 + 방향/길이).
  // 현 addDividerBlock은 color/lineStyle/weight만 사용 — padV/padH/lineDir/lineLength는 add 직후
  // dataset 보강 + applyDividerStyle 재호출로 적용 (renderer invoker에서 처리).
  registerTool(
    'add_divider_block',
    async (args = {}) => {
      if (!_rendererInvoker?.addDividerBlock) throw new Error('renderer bridge not ready');
      const opts = _validateDividerOpts(args, { mode: 'add' });
      return await _rendererInvoker.addDividerBlock(opts);
    },
    {
      description: 'Add a divider block (horizontal/vertical line separator). dvd_xxx 블록 생성. lineDir=horizontal(기본, 가로 전체) 또는 vertical(세로, lineLength로 길이 지정). lineStyle=solid|dashed|dotted, lineWeight 1~24px. padV/padH로 상하/좌우 패딩. 이후 update_divider_block(blockId, partial)로 수정.',
      inputSchema: {
        type: 'object',
        properties: {
          sectionId:  { type: 'string',  description: 'sec_xxx — omit to use currently selected section' },
          lineColor:  { type: 'string',  description: '구분선 색상 (#hex | rgb(a)/hsl(a)() | transparent). default #cccccc' },
          lineStyle:  { type: 'string',  enum: ['solid', 'dashed', 'dotted'], description: '선 스타일. default solid' },
          lineWeight: { type: 'integer', description: '선 두께 px (1~24). default 1' },
          padV:       { type: 'integer', description: '상하 패딩 px (0~120). default 30' },
          padH:       { type: 'integer', description: '좌우 패딩 px (0~2000). default 0' },
          lineDir:    { type: 'string',  enum: ['horizontal', 'vertical'], description: '방향. default horizontal' },
          lineLength: { type: 'integer', description: '세로 방향일 때 선 길이 px (20~400). default 80' }
        },
        required: []
      }
    }
  );

  // ─── update_divider_block ───
  // ─── update_divider_block — divider 블록 부분 수정 (id 기반) ──────────────
  // PM이 색상/스타일/두께/패딩/방향/길이를 partial update. 한 콜에 여러 필드 조합 가능.
  registerTool(
    'update_divider_block',
    async ({ blockId, ...rest } = {}) => {
      if (!_rendererInvoker?.updateDividerBlock) throw new Error('renderer bridge not ready');
      if (typeof blockId !== 'string' || !blockId.startsWith('dvd_')) {
        throw new Error(`invalid blockId: ${blockId}. must be a string starting with "dvd_"`);
      }
      const partial = _validateDividerOpts(rest, { mode: 'update' });
      if (Object.keys(partial).length === 0) {
        throw new Error('no fields to update — provide at least one divider field');
      }
      return await _rendererInvoker.updateDividerBlock({ blockId, partial });
    },
    {
      description: 'Edit an EXISTING divider block (dvd_xxx) — partial update. Fields: lineColor(#hex|rgb|transparent) / lineStyle(solid|dashed|dotted) / lineWeight(1~24) / padV(0~120) / padH(0~2000) / lineDir(horizontal|vertical) / lineLength(20~400, vertical일 때만 시각 영향). 한 콜에 여러 필드 조합 가능. Returns USER_BUSY if user is editing. Get blockId from get_canvas_state or returned from add_divider_block.',
      inputSchema: {
        type: 'object',
        properties: {
          blockId:    { type: 'string',  description: 'dvd_xxx (divider block id)' },
          lineColor:  { type: 'string',  description: '구분선 색상 (#hex | rgb(a)/hsl(a)() | transparent)' },
          lineStyle:  { type: 'string',  enum: ['solid', 'dashed', 'dotted'] },
          lineWeight: { type: 'integer', description: '선 두께 px (1~24)' },
          padV:       { type: 'integer', description: '상하 패딩 px (0~120)' },
          padH:       { type: 'integer', description: '좌우 패딩 px (0~2000)' },
          lineDir:    { type: 'string',  enum: ['horizontal', 'vertical'] },
          lineLength: { type: 'integer', description: '세로일 때 선 길이 px (20~400)' }
        },
        required: ['blockId']
      }
    }
  );

  // ─── update_asset_block_block ───
  // ─── update_asset_block — 기존 asset-block 부분 수정 (id 기반) ────────────
  // PM이 크기/정렬/패딩/이미지/배경/오버레이/preset partial update. banner02 패턴 미러.
  registerTool(
    'update_asset_block',
    async ({ blockId, ...rest } = {}) => {
      if (!_rendererInvoker?.updateAssetBlock) throw new Error('renderer bridge not ready');
      if (typeof blockId !== 'string' || !blockId.startsWith('ab_')) {
        throw new Error(`invalid blockId: ${blockId}. must be a string starting with "ab_"`);
      }
      let partial;
      const _rep = {};
      try {
        partial = _validateAssetOpts(rest, { mode: 'update', report: _rep });
      } catch (e) {
        // ★put_image 와 «같은 모양»으로 답한다 — 던지면 JSON-RPC 에러가 되어 code 를 잃고,
        //   호출자(모델)가 「다시 통째로 보내면 된다」를 구조적으로 못 읽는다.
        if (e && e.imageCheckError) {
          return { ok: false, code: e.code, message: e.message, ...e.detail };
        }
        throw e;
      }
      if (Object.keys(partial).length === 0) {
        throw new Error('no fields to update — provide at least one asset field');
      }
      const _res = await _rendererInvoker.updateAssetBlock({ blockId, partial });
      // ★검사를 «어디까지» 했는지 응답에 싣는다(put_image 와 같은 모양).
      return _rep.imageCheck && _res && typeof _res === 'object'
        ? { ..._res, imageCheck: _rep.imageCheck } : _res;
    },
    {
      description: 'Edit an EXISTING asset block (ab_xxx) — partial update of any field. width(100~860, 860+=full bleed), height(200~1600), borderRadius(0~120). align(left|center|right) syncs alignSelf. usePadx(true|false) auto-applies negative margins + width calc using section-inner padX. fit(cover|contain) syncs img.style.objectFit. bgColor accepts hex/rgb(a)/hsl(a)/transparent; "" resets. overlay(true|false) ensures .asset-overlay child. overlayOpacity(0~100) maps to rgba alpha. overlayPosition(flex-start|center|flex-end) sets justifyContent. preset=logo forces 200x64 and disables width opt; preset=none clears it. imgSrc accepts data:image/*|http(s)|assets/ ≤200000 chars (≈150KB — too small for most real photos); "" calls clearAssetImage(). For larger images, put_image the replacement into the scratch pad first then pass scratchId (sp_xxx) instead — same large-payload path add_asset_block uses, up to ~5MB. imgSrc and scratchId are mutually exclusive. baseHeight auto-syncs with height. Returns USER_BUSY if user is editing. Get blockId from get_canvas_state.',
      inputSchema: {
        type: 'object',
        properties: {
          blockId: { type: 'string', description: 'ab_xxx (asset block id)' },
          width:  { type: 'integer', description: 'px (100~860). 860+ = full bleed (clears inline width). Ignored when preset=logo.' },
          height: { type: 'integer', description: 'px (200~1600). Also updates dataset.baseHeight.' },
          borderRadius: { type: 'integer', description: 'px (0~120)' },
          align:  { type: 'string', enum: ['left', 'center', 'right'], description: 'syncs dataset.align + style.alignSelf' },
          usePadx: { type: 'string', enum: ['true', 'false'], description: 'true → negative margins + width calc(100% + 2*padX). false → clear inline margin/width.' },
          fit:    { type: 'string', enum: ['cover', 'contain'], description: 'image fit. Only meaningful when .asset-img exists.' },
          bgColor: { type: 'string', description: 'placeholder bg (hex | rgb(a)/hsl(a)() | transparent). Empty string "" resets.' },
          overlay: { type: 'string', enum: ['true', 'false'], description: 'true ensures .asset-overlay child exists.' },
          overlayOpacity: { type: 'integer', description: '0~100 → rgba(0,0,0,v/100) on .asset-overlay' },
          overlayPosition: { type: 'string', enum: ['flex-start', 'center', 'flex-end'], description: 'overlayEl.style.justifyContent' },
          preset: { type: 'string', enum: ['logo', 'none'], description: 'logo → 200x64 fixed + usePadx ignored. none → delete dataset.preset.' },
          imgSrc: { type: 'string', description: 'data:image/* | http(s) | assets/ (≤200000, ≈150KB). Empty string clears the image via clearAssetImage(). Mutually exclusive with scratchId.' },
          scratchId: { type: 'string', description: 'sp_xxx — replace the image from a scratch pad item (up to ~5MB, no IPC length cap — the renderer reads it directly from IndexedDB). Mutually exclusive with imgSrc. put_image the new photo into scratch first, then pass its id here.' },
          layerName: { type: 'string', description: 'layer panel display name (≤80 code points)' }
        },
        required: ['blockId']
      }
    }
  );

  // ─── update_table_block ───
  // ─── update_table_block — 기존 table 블록 부분 수정 (id 기반) ────────────
  // PM이 데이터(headers/rows) + 스타일(style/cellAlign/색상 등) partial update.
  // add_table_block과 달리 blockId 필수, 모든 필드 optional, 색상/숫자 strict 검증.
  registerTool(
    'update_table_block',
    async ({ blockId, ...rest } = {}) => {
      if (!_rendererInvoker?.updateTableBlock) throw new Error('renderer bridge not ready');
      if (typeof blockId !== 'string' || !blockId.startsWith('tbl_')) {
        throw new Error(`invalid blockId: ${blockId}. must be a string starting with "tbl_"`);
      }
      const partial = _validateTableOpts(rest, { mode: 'update' });
      if (Object.keys(partial).length === 0) {
        throw new Error('no fields to update — provide at least one table field');
      }
      return await _rendererInvoker.updateTableBlock({ blockId, partial });
    },
    {
      description: 'Edit an EXISTING table block (tbl_xxx) — partial update. Data: headers (string[]) + rows (string[][]). Style: style|cellAlign|cellPad|showHeader|showVLines|showHLines|showOuterX|showOuterY|outerWidth|rowH|tablePadX|headerSize|lineColor|headerBg|textColor|fontFamily|fontSize|colWidths|colBgs|colFgs. headers+rows 동시 갱신 시 cols 일치 필수. headers/rows 단독 갱신 시 기존 colCount와 일치 필수. Returns USER_BUSY if user is editing.',
      inputSchema: {
        type: 'object',
        properties: {
          blockId:    { type: 'string', description: 'tbl_xxx (table block id)' },
          headers:    { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 32, description: '열 제목 배열. 단독 갱신 시 기존 colCount와 일치 필수' },
          rows:       { type: 'array', maxItems: 500, items: { type: 'array', items: { type: 'string' } }, description: '각 inner array length는 (headers 동시 갱신 시 headers.length, 단독 갱신 시 기존 colCount)와 일치' },
          style:      { type: 'string', enum: ['default','stripe','borderless','colored'], description: '테이블 테마. colored면 colBgs/colFgs 시각 반영' },
          cellAlign:  { type: 'string', enum: ['left','center','right'], description: '셀 텍스트 정렬' },
          cellPad:    { type: 'integer', minimum: 0, maximum: 40, description: '셀 상하 패딩 px (좌우 16 고정)' },
          showHeader: { type: 'boolean', description: 'thead 표시 여부' },
          showVLines: { type: 'boolean', description: '내부 세로선' },
          showHLines: { type: 'boolean', description: '내부 수평선' },
          showOuterX: { type: 'boolean', description: '외곽 좌우선' },
          showOuterY: { type: 'boolean', description: '외곽 상하선' },
          outerWidth: { type: 'integer', minimum: 1, maximum: 6, description: '외곽선 두께 px' },
          rowH:       { type: 'integer', minimum: 0, maximum: 160, description: '행 높이 px (0=auto)' },
          tablePadX:  { type: 'integer', minimum: 0, maximum: 120, description: '테이블 좌우 여백 px' },
          headerSize: { type: 'integer', minimum: 0, maximum: 60, description: '헤더 글자 크기 px (0~60). 0=본문 fontSize 상속' },
          lineColor:  { type: 'string', description: '선 색 (#hex | rgb(a)/hsl(a)() | transparent)' },
          headerBg:   { type: 'string', description: '헤더 배경색' },
          textColor:  { type: 'string', description: '글자색' },
          fontFamily: { type: 'string', enum: ['', "'Pretendard', sans-serif", "'Noto Sans KR', sans-serif", "'Spoqa Han Sans Neo', sans-serif", "'Inter', sans-serif", "'Roboto', sans-serif", "'Helvetica Neue', sans-serif", 'Georgia, serif', "'Times New Roman', serif", 'monospace'], description: '빈 값=기본. 화이트리스트 강제' },
          fontSize:   { type: 'integer', minimum: 12, maximum: 60, description: '본문 폰트 크기 px' },
          colWidths:  { type: 'string', maxLength: 200, description: '컬럼 비율 (예: "1:1:2"). 빈 문자열은 reset' },
          colBgs: {
            description: '컬럼별 배경색 (style=colored일 때만 시각 반영). string[] 또는 "a,b,c". 각 항목 color 정규식.',
            oneOf: [
              { type: 'array', maxItems: 32, items: { type: 'string' } },
              { type: 'string', maxLength: 1024 }
            ]
          },
          colFgs: {
            description: '컬럼별 글자색. 형식은 colBgs와 동일.',
            oneOf: [
              { type: 'array', maxItems: 32, items: { type: 'string' } },
              { type: 'string', maxLength: 1024 }
            ]
          },
          mergedHeaderCols: {
            description: '헤더 가로 병합(v1). [[startColIdx, span], ...] (0-base, span>=2). 정렬·범위·겹침 자동 검증. null 또는 빈 배열 [] 이면 병합 해제. 예) 4개 col 중 처음 2개 그룹화: [[0,2]] → <th colspan=2>그룹</th><th>C</th><th>D</th>. headers와 함께 보낼 때 headers는 시각 th 텍스트(병합 후 실제 표시되는 th 갯수)와 일치해야 함. body cell 병합은 미지원(v2 보류).',
            oneOf: [
              { type: 'array', maxItems: 32, items: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'integer' } } },
              { type: 'string', maxLength: 1024 },
              { type: 'null' }
            ]
          }
        },
        required: ['blockId']
      }
    }
  );

  // ─── add_icon_circle_block ───
  // ─── add_icon_circle_block — icon-circle 블록 추가 (원형 아이콘 슬롯) ─────
  // block-factory의 addIconCircleBlock(opts) 노출. 기본 size 240, bgColor #e8e8e8, border none.
  // 이미지(imgSrc)·테두리·좌우패딩까지 1콜에 생성. add 후 update_icon_circle_block(blockId, partial)로 수정.
  registerTool(
    'add_icon_circle_block',
    async (args = {}) => {
      if (!_rendererInvoker?.addIconCircleBlock) throw new Error('renderer bridge not ready');
      const opts = _validateIconCircleOpts(args, { mode: 'add' });
      return await _rendererInvoker.addIconCircleBlock(opts);
    },
    {
      description: 'Add an icon-circle block (원형 아이콘 슬롯 — 배경색 또는 이미지를 담는 둥근 컨테이너). 기본 240×240 #e8e8e8. Returns {ok, blockId, ...}. blockId는 icb_xxx. 이후 update_icon_circle_block(blockId, partial)로 수정.',
      inputSchema: {
        type: 'object',
        properties: {
          sectionId: { type: 'string', description: 'sec_xxx — omit to use currently selected section' },
          layerName: { type: 'string', description: '레이어 패널 표시명 (≤80)' },
          size:      { type: 'integer', description: '원형 지름 px (40~860). default 240' },
          bgColor:   { type: 'string',  description: '원형 배경색 (#hex / rgb(a) / hsl(a) / transparent). default #e8e8e8' },
          border:    { type: 'string', enum: ['none','solid','dashed'], description: '테두리 스타일. default none' },
          radius:    { type: 'integer', description: '(forward-compat) 모서리 반경 px (0~500). 현재 적용 미정 — dataset만 세팅' },
          padX:      { type: 'integer', description: '블록 좌우 패딩 px (0~200). default 0' },
          imgSrc:    { type: 'string',  description: '이미지 URL 또는 dataURL (≤200000). " 와 개행 금지 (CSS url("") 안전). 있으면 .has-image 부착 + cover/center 배치' }
        },
        required: []
      }
    }
  );

  // ─── update_icon_circle_block ───
  // ─── update_icon_circle_block — icon-circle 블록 부분 수정 (id 기반) ──────
  // PM이 size/bgColor/border/padX/radius/imgSrc/layerName 등 partial update.
  // banner02/mockup update 패턴 미러. blockId 필수 + 최소 1개 필드 필요.
  registerTool(
    'update_icon_circle_block',
    async ({ blockId, ...rest } = {}) => {
      if (!_rendererInvoker?.updateIconCircleBlock) throw new Error('renderer bridge not ready');
      if (typeof blockId !== 'string' || !blockId.startsWith('icb_')) {
        throw new Error(`invalid blockId: ${blockId}. must be a string starting with "icb_"`);
      }
      const partial = _validateIconCircleOpts(rest, { mode: 'update' });
      if (Object.keys(partial).length === 0) {
        throw new Error('no fields to update — provide at least one icon-circle field');
      }
      return await _rendererInvoker.updateIconCircleBlock({ blockId, partial });
    },
    {
      description: 'Edit an EXISTING icon-circle block (icb_xxx) — partial update. Fields: size(40~860), bgColor, border(none|solid|dashed), radius(0~500, forward-compat), padX(0~200), imgSrc(≤200000, ""=clear image), layerName(≤80). 한 콜에 여러 필드 조합 가능. Returns USER_BUSY if user is editing. Get blockId from get_canvas_state or returned from add_icon_circle_block.',
      inputSchema: {
        type: 'object',
        properties: {
          blockId:   { type: 'string', description: 'icb_xxx (icon-circle block id)' },
          size:      { type: 'integer', description: '원형 지름 px (40~860). .icb-circle width/height 동시 적용' },
          bgColor:   { type: 'string',  description: '원형 배경색 (#hex / rgb(a) / hsl(a) / transparent)' },
          border:    { type: 'string', enum: ['none','solid','dashed'], description: '테두리 스타일' },
          radius:    { type: 'integer', description: '(forward-compat) 모서리 반경 px (0~500). dataset만 갱신' },
          padX:      { type: 'integer', description: '블록 좌우 패딩 px (0~200)' },
          imgSrc:    { type: 'string',  description: '이미지 URL/dataURL (≤200000). 빈 문자열("")이면 이미지 제거 + .has-image 클래스 제거' },
          layerName: { type: 'string', description: '레이어 패널 표시명 (≤80)' }
        },
        required: ['blockId']
      }
    }
  );

  // ─── add_graph_block ───
  // ─── add_graph_block — graph 블록 추가 (보조 데이터 시각화) ──────────────
  // block-factory.js의 makeGraphBlock 기본 dataset + opts 노출. chartType 3종 (bar-v/bar-h/line).
  // items는 [{label, value}] 배열. dataset.items에 JSON.stringify로 저장. 추가 후 update_graph_block으로 세부 스타일 조정.
  registerTool(
    'add_graph_block',
    async (args = {}) => {
      if (!_rendererInvoker?.addGraphBlock) throw new Error('renderer bridge not ready');
      const opts = _validateGraphOpts(args, { mode: 'add' });
      return await _rendererInvoker.addGraphBlock(opts);
    },
    {
      description: 'Add a graph block (auxiliary data-viz: bar-v / bar-h / line chart). blockId prefix: grb_. chartType=bar-v|bar-h|line, preset=default|dark|minimal|colorful. items=[{label:str(<=80), value:0~9999}] (1~50). 미지정 시 기본 5항목. Returns {ok, blockId, pageId, ...}. 이후 update_graph_block(blockId, partial)로 세부 스타일 조정.',
      inputSchema: {
        type: 'object',
        properties: {
          sectionId: { type: 'string', description: 'sec_xxx — omit to use currently selected section' },
          chartType: { type: 'string', enum: ['bar-v', 'bar-h', 'line'], description: '차트 종류. default bar-v' },
          preset:    { type: 'string', enum: ['default', 'dark', 'minimal', 'colorful'], description: '프리셋 테마. default default' },
          items: {
            type: 'array',
            minItems: 1,
            maxItems: 50,
            description: '[{label, value}] (1~50). label: 짧은 문자열(<=80), value: 0~9999 finite number',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string', maxLength: 80 },
                value: { type: 'number', minimum: 0, maximum: 9999 }
              },
              required: ['label', 'value']
            }
          },
          chartHeight:  { type: 'integer', description: '차트 높이 px (80~2000). default 240' },
          labelSize:    { type: 'integer', description: '라벨 글자 크기 px (8~28). default 13' },
          barThickness: { type: 'integer', description: 'bar-h 막대 두께 px (8~48). default 24' },
          padX:         { type: 'integer', description: 'bar-h/line 좌우 패딩 px (0~80). default 0' },
          barColor:     { type: 'string',  description: 'bar-h/line 색상 (#hex | rgb(a)/hsl(a)() | transparent). default #222222' },
          itemGap:      { type: 'integer', description: 'bar-h 항목 간 간격 px (8~80). default 24' },
          pctSize:      { type: 'integer', description: 'bar-h 숫자 크기 px (20~120). default 60' },
          strokeWidth:  { type: 'integer', description: 'line 선 두께 px (1~12). default 3' },
          pointRadius:  { type: 'integer', description: 'line 점 반지름 px (0~16). default 5' },
          fillArea:     { type: 'string',  enum: ['0', '1'], description: "line 면 채우기 토글 '0'|'1'. default '0'" },
          fillAlpha:    { type: 'number',  minimum: 0, maximum: 1, description: 'line 면 알파 0.00~1.00 (toFixed(2)로 저장). default 0.18' }
        },
        required: []
      }
    }
  );

  // ─── update_graph_block ───
  // ─── update_graph_block — graph 블록 부분 수정 (id 기반) ──────────────────
  // PM이 chartType/preset/items/스타일 등 partial update. add와 동일 필드 set 지원.
  registerTool(
    'update_graph_block',
    async ({ blockId, ...rest } = {}) => {
      if (!_rendererInvoker?.updateGraphBlock) throw new Error('renderer bridge not ready');
      if (typeof blockId !== 'string' || !blockId.startsWith('grb_')) {
        throw new Error(`invalid blockId: ${blockId}. must be a string starting with "grb_"`);
      }
      const partial = _validateGraphOpts(rest, { mode: 'update' });
      if (Object.keys(partial).length === 0) {
        throw new Error('no fields to update — provide at least one graph field');
      }
      return await _rendererInvoker.updateGraphBlock({ blockId, partial });
    },
    {
      description: 'Edit an EXISTING graph block (grb_xxx) — partial update of any field. chartType 변경 시 자동 재렌더. items 전달 시 전체 교체 (1~50 entries). 한 콜에 여러 partial 조합 가능. Returns USER_BUSY if user is editing. Get blockId from get_canvas_state or returned from add_graph_block.',
      inputSchema: {
        type: 'object',
        properties: {
          blockId:   { type: 'string', description: 'grb_xxx (graph block id)' },
          chartType: { type: 'string', enum: ['bar-v', 'bar-h', 'line'] },
          preset:    { type: 'string', enum: ['default', 'dark', 'minimal', 'colorful'] },
          items: {
            type: 'array',
            minItems: 1,
            maxItems: 50,
            description: '[{label, value}] 전체 교체. label <=80, value 0~9999',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string', maxLength: 80 },
                value: { type: 'number', minimum: 0, maximum: 9999 }
              },
              required: ['label', 'value']
            }
          },
          chartHeight:  { type: 'integer', description: '80~2000' },
          labelSize:    { type: 'integer', description: '8~28' },
          barThickness: { type: 'integer', description: 'bar-h 8~48' },
          padX:         { type: 'integer', description: 'bar-h/line 0~80' },
          barColor:     { type: 'string',  description: '#hex | rgb(a)/hsl(a)() | transparent' },
          itemGap:      { type: 'integer', description: 'bar-h 8~80' },
          pctSize:      { type: 'integer', description: 'bar-h 20~120' },
          strokeWidth:  { type: 'integer', description: 'line 1~12' },
          pointRadius:  { type: 'integer', description: 'line 0~16' },
          fillArea:     { type: 'string',  enum: ['0', '1'], description: "line 면 채우기 '0'|'1'" },
          fillAlpha:    { type: 'number',  minimum: 0, maximum: 1, description: 'line 면 알파 0.00~1.00' }
        },
        required: ['blockId']
      }
    }
  );

  // ─── update_gap_block ───
  // ─── update_gap_block — 갭 블록 부분 수정 (id 기반) ────────────────────────
  // PM이 기존 갭 블록 높이를 partial update. add_gap_block 후 미세조정 / 레이아웃 재조립 시 사용.
  registerTool(
    'update_gap_block',
    async ({ blockId, ...rest } = {}) => {
      if (!_rendererInvoker?.updateGapBlock) throw new Error('renderer bridge not ready');
      if (typeof blockId !== 'string' || !blockId.startsWith('gb_')) {
        throw new Error(`invalid blockId: ${blockId}. must be a string starting with "gb_"`);
      }
      const partial = _validateGapOpts(rest, { mode: 'update' });
      if (Object.keys(partial).length === 0) {
        throw new Error('no fields to update — provide at least one gap field (e.g. height)');
      }
      return await _rendererInvoker.updateGapBlock({ blockId, partial });
    },
    {
      description: 'Edit an EXISTING gap (spacer) block (gb_xxx) — partial update of height. style.height(px) + dataset.h 동시 갱신 (flow frame 호환). Returns USER_BUSY if user is editing. Get blockId from get_canvas_state or returned from add_gap_block.',
      inputSchema: {
        type: 'object',
        properties: {
          blockId: { type: 'string', description: 'gb_xxx (gap block id)' },
          height: { type: 'integer', minimum: 0, maximum: 400, description: 'Gap height in px (0–400). style.height + dataset.h 동시 갱신.' }
        },
        required: ['blockId']
      }
    }
  );

  // ─── add_speech_bubble_block ───
  // ─── add_speech_bubble_block — speech-bubble 블록 추가 (말풍선) ─────────────
  // block-factory.js의 addSpeechBubbleBlock(tail)로 생성 후, 나머지 필드(bubbleStyle/showSender/
  // senderName/bubbleBg/text)는 즉시 update 경로로 적용. blockId는 .speech-bubble-block(sb_xxx).
  registerTool(
    'add_speech_bubble_block',
    async (args = {}) => {
      if (!_rendererInvoker?.addSpeechBubbleBlock) throw new Error('renderer bridge not ready');
      const opts = _validateSpeechBubbleOpts(args, { mode: 'add' });
      return await _rendererInvoker.addSpeechBubbleBlock(opts);
    },
    {
      description: 'Add a speech-bubble block (말풍선, iMessage 스타일). tail=left|center|right (말꼬리 방향), bubbleStyle=default|apple|imessage, showSender=true|false (발신자 이름 표시), senderName, bubbleBg (배경색), text (내용). 반환 blockId는 sb_xxx. 이후 update_speech_bubble_block(blockId, partial)로 수정. _makeTextFrame 래퍼 안에 들어간다.',
      inputSchema: {
        type: 'object',
        properties: {
          sectionId:   { type: 'string', description: 'sec_xxx — omit to use currently selected section' },
          tail:        { type: 'string', enum: ['left', 'center', 'right'], description: '말꼬리 방향. default left' },
          bubbleStyle: { type: 'string', enum: ['default', 'apple', 'imessage'], description: '말풍선 스타일. default default' },
          showSender:  { type: 'string', enum: ['true', 'false'], description: '발신자 이름 표시 여부 (문자열). default false' },
          senderName:  { type: 'string', description: '발신자 이름 텍스트 (≤100). default "Your name"' },
          bubbleBg:    { type: 'string', description: '말풍선 배경색 (#hex | rgb(a)/hsl(a)() | transparent)' },
          text:        { type: 'string', description: '말풍선 본문 텍스트 (≤2000). 빈문자열이면 placeholder 모드 유지' }
        },
        required: []
      }
    }
  );

  // ─── update_speech_bubble_block ───
  // ─── update_speech_bubble_block — speech-bubble 블록 부분 수정 (id 기반) ────
  // PM이 tail/bubbleStyle/showSender/senderName/bubbleBg/text partial update.
  registerTool(
    'update_speech_bubble_block',
    async ({ blockId, ...rest } = {}) => {
      if (!_rendererInvoker?.updateSpeechBubbleBlock) throw new Error('renderer bridge not ready');
      if (typeof blockId !== 'string' || !blockId.startsWith('sb_')) {
        throw new Error(`invalid blockId: ${blockId}. must be a string starting with "sb_"`);
      }
      const partial = _validateSpeechBubbleOpts(rest, { mode: 'update' });
      if (Object.keys(partial).length === 0) {
        throw new Error('no fields to update — provide at least one speech-bubble field (tail|bubbleStyle|showSender|senderName|bubbleBg|text)');
      }
      return await _rendererInvoker.updateSpeechBubbleBlock({ blockId, partial });
    },
    {
      description: 'Edit an EXISTING speech-bubble block (sb_xxx) — partial update. 필드: tail (left|center|right, SVG 말꼬리 교체), bubbleStyle (default|apple|imessage, .tb-bubble dataset 동기화), showSender (true|false 문자열), senderName (≤100), bubbleBg (#hex|rgb|hsl|transparent — SVG 말꼬리도 var(--bubble-bg)로 동기화), text (≤2000, 빈문자열이면 placeholder 복귀). 적어도 1개 필드 필수. Returns USER_BUSY if user is editing. Get blockId from get_canvas_state or returned from add_speech_bubble_block.',
      inputSchema: {
        type: 'object',
        properties: {
          blockId:     { type: 'string', description: 'sb_xxx (speech-bubble block id)' },
          tail:        { type: 'string', enum: ['left', 'center', 'right'] },
          bubbleStyle: { type: 'string', enum: ['default', 'apple', 'imessage'] },
          showSender:  { type: 'string', enum: ['true', 'false'] },
          senderName:  { type: 'string', description: '발신자 이름 (≤100)' },
          bubbleBg:    { type: 'string', description: '#hex | rgb(a)/hsl(a)() | transparent' },
          text:        { type: 'string', description: '본문 텍스트 (≤2000). "" → placeholder 모드' }
        },
        required: ['blockId']
      }
    }
  );

  // ─── add_label_group_block ───
  // ─── add_label_group_block — label-group 블록 추가 (태그 묶음) ─────────────
  // block-factory.js의 addLabelGroupBlock(opts) 노출. labels[] + shape로 1콜 생성.
  registerTool(
    'add_label_group_block',
    async (args = {}) => {
      if (!_rendererInvoker?.addLabelGroupBlock) throw new Error('renderer bridge not ready');
      const opts = _validateLabelGroupOpts(args, { mode: 'add' });
      return await _rendererInvoker.addLabelGroupBlock(opts);
    },
    {
      description: 'Add a label-group block (chip/tag cluster). blockId prefix: lg_. labels[]: 문자열 배열(0~50, 비우면 기본 "Tag" 3개). shape: pill|circle (default pill). 이후 update_label_group_block(blockId, partial)로 색·정렬·간격·프리셋 등 일괄 수정. PM 활용도: 인증 마크, USP 뱃지, 후기 키워드 묶음 등.',
      inputSchema: {
        type: 'object',
        properties: {
          sectionId: { type: 'string', description: 'sec_xxx — omit to use currently selected section' },
          labels: {
            type: 'array',
            maxItems: 50,
            items: { type: 'string', maxLength: 500 },
            description: '태그 텍스트 배열. 빈 배열/생략 시 기본 "Tag" 3개.'
          },
          shape: { type: 'string', enum: ['pill', 'circle'], description: '라벨 모양. default pill' }
        },
        required: []
      }
    }
  );

  // ─── update_label_group_block ───
  // ─── update_label_group_block — label-group 블록 부분 수정 (id 기반) ───────
  // PM이 태그 묶음의 텍스트/모양/색/정렬/간격/프리셋 partial update. add와 동일 필드 set 지원.
  registerTool(
    'update_label_group_block',
    async ({ blockId, ...rest } = {}) => {
      if (!_rendererInvoker?.updateLabelGroupBlock) throw new Error('renderer bridge not ready');
      if (typeof blockId !== 'string' || !blockId.startsWith('lg_')) {
        throw new Error(`invalid blockId: ${blockId}. must be a string starting with "lg_"`);
      }
      const partial = _validateLabelGroupOpts(rest, { mode: 'update' });
      if (Object.keys(partial).length === 0) {
        throw new Error('no fields to update — provide at least one label-group field');
      }
      return await _rendererInvoker.updateLabelGroupBlock({ blockId, partial });
    },
    {
      description: 'Edit an EXISTING label-group block (lg_xxx) — partial update of tags. labels(전체 교체) / shape(pill|circle) / align(left|center|right) / gap(0~60) / allItemHeight(0~120 px, paddingTop+Bottom 합) / itemBg / itemColor / itemRadius(0~50, circle면 무시) / stylePreset(Default|Filled|Outline|Ghost). stylePreset과 itemBg/itemColor가 같이 오면 preset 먼저 적용 후 개별 색 덮어쓰기. width/x/y는 absolute 모드(서브섹션 내)일 때만 적용, 아니면 warnings에 기록. Returns USER_BUSY if user is editing.',
      inputSchema: {
        type: 'object',
        properties: {
          blockId: { type: 'string', description: 'lg_xxx (label-group block id)' },
          labels: {
            type: 'array',
            maxItems: 50,
            items: { type: 'string', maxLength: 500 },
            description: '태그 텍스트 배열 전체 교체. 기존 .label-item 모두 제거 후 재구성. add-btn 보존.'
          },
          shape: { type: 'string', enum: ['pill', 'circle'], description: '라벨 모양. 기존 item에도 일괄 재적용.' },
          align: { type: 'string', enum: ['left', 'center', 'right'], description: 'justifyContent (left=flex-start 등)' },
          gap:   { type: 'integer', minimum: 0, maximum: 60, description: '아이템 간 gap px' },
          allItemHeight: { type: 'integer', minimum: 0, maximum: 120, description: '모든 .label-item의 paddingTop+Bottom 합 px (half로 양쪽 분배)' },
          itemBg:    { type: 'string', description: '전체 .label-item 배경색 (#hex | rgb(a)/hsl(a)() | transparent)' },
          itemColor: { type: 'string', description: '전체 .label-item 글자색 (#hex | rgb(a)/hsl(a)() | transparent)' },
          itemRadius: { type: 'integer', minimum: 0, maximum: 50, description: '전체 .label-item borderRadius px. shape=circle이면 무시(50% 유지).' },
          stylePreset: { type: 'string', enum: ['Default', 'Filled', 'Outline', 'Ghost'], description: '프리셋 일괄 적용. itemBg/itemColor와 동시 지정 시 preset 먼저 → 개별 색 덮어쓰기.' },
          width: { type: 'integer', minimum: 40, maximum: 860, description: 'absolute 모드일 때만 block.style.width 적용' },
          x:     { type: 'integer', description: 'absolute 모드일 때만 block.style.left 적용' },
          y:     { type: 'integer', description: 'absolute 모드일 때만 block.style.top 적용' }
        },
        required: ['blockId']
      }
    }
  );

  // ─── add_shape_block ───
  // ─── add_shape_block — shape 블록 추가 (도형: rectangle/ellipse/line/arrow/polygon/star) ───
  // addShapeBlock(type) 시그니처 그대로. type만 받아 부모 frame(100×100) + .shape-block 생성.
  registerTool(
    'add_shape_block',
    async ({ shapeType = 'rectangle', sectionId } = {}) => {
      if (!_rendererInvoker?.addShapeBlock) throw new Error('renderer bridge not ready');
      const SHAPE_TYPES = ['rectangle', 'ellipse', 'line', 'arrow', 'polygon', 'star'];
      if (!SHAPE_TYPES.includes(shapeType)) {
        throw new Error(`invalid shapeType: ${shapeType}. allowed: ${SHAPE_TYPES.join('|')}`);
      }
      if (sectionId !== undefined && sectionId !== null) {
        if (typeof sectionId !== 'string' || !sectionId.startsWith('sec_')) {
          throw new Error(`invalid sectionId: ${sectionId} (must start with sec_)`);
        }
      }
      return await _rendererInvoker.addShapeBlock({ shapeType, sectionId });
    },
    {
      description: 'Add a shape block (rectangle/ellipse/line/arrow/polygon/star). 100×100 frame 안에 SVG shape 생성. Returns {ok, blockId, ...}. blockId는 shp_xxx. 이후 update_shape_block(blockId, partial)로 색상/두께/회전/크기 수정.',
      inputSchema: {
        type: 'object',
        properties: {
          shapeType: { type: 'string', enum: ['rectangle', 'ellipse', 'line', 'arrow', 'polygon', 'star'], description: '도형 종류. default rectangle.' },
          sectionId: { type: 'string', description: 'sec_xxx — omit to use currently selected section' }
        },
        required: []
      }
    }
  );

  // ─── update_shape_block ───
  // ─── update_shape_block — shape 블록 부분 수정 (id 기반) ────────────────────
  // PM이 도형 종류/색상/외곽선/두께/회전/크기 partial update. width/height는 부모 frame에 적용됨.
  registerTool(
    'update_shape_block',
    async ({ blockId, ...rest } = {}) => {
      if (!_rendererInvoker?.updateShapeBlock) throw new Error('renderer bridge not ready');
      if (typeof blockId !== 'string' || !blockId.startsWith('shp_')) {
        throw new Error(`invalid blockId: ${blockId}. must be a string starting with "shp_"`);
      }
      const partial = _validateShapeOpts(rest, { mode: 'update' });
      if (Object.keys(partial).length === 0) {
        throw new Error('no fields to update — provide at least one shape field');
      }
      return await _rendererInvoker.updateShapeBlock({ blockId, partial });
    },
    {
      description: 'Edit an EXISTING shape block (shp_xxx) — partial update of shape properties. 필드: shapeType (rectangle|ellipse|line|arrow|polygon|star), shapeColor (#hex/rgb/hsl/transparent), shapeStrokeColor (빈문자열="" → currentColor 폴백), shapeStrokeWidth (0~20), shapeRotation (-180~180), width/height (10~860, 부모 frame에 적용). shapeType 변경 시 svg 전체 재생성됨(gradient는 소실). 한 콜에 여러 partial 조합 가능. Returns USER_BUSY if user is editing. Get blockId from get_canvas_state.',
      inputSchema: {
        type: 'object',
        properties: {
          blockId:          { type: 'string', description: 'shp_xxx (shape block id)' },
          shapeType:        { type: 'string', enum: ['rectangle', 'ellipse', 'line', 'arrow', 'polygon', 'star'], description: '도형 종류 변경. svg viewBox/innerHTML 전체 재생성.' },
          shapeColor:       { type: 'string', description: '메인 fill 색 (#hex | rgb(a)/hsl(a)() | transparent). 기존 gradient는 자동 clear.' },
          shapeStrokeColor: { type: 'string', description: '외곽선 색. 빈문자열 ""이면 shapeColor를 따라감(currentColor).' },
          shapeStrokeWidth: { type: 'integer', minimum: 0, maximum: 20, description: '외곽선 두께 px (0~20). rectangle/ellipse는 inner 재계산됨.' },
          shapeRotation:    { type: 'integer', minimum: -180, maximum: 180, description: '회전 각도 deg (-180~180). 0이면 transform 제거.' },
          width:            { type: 'integer', minimum: 10, maximum: 860, description: '부모 frame width px (10~860).' },
          height:           { type: 'integer', minimum: 10, maximum: 860, description: '부모 frame height px (10~860).' }
        },
        required: ['blockId']
      }
    }
  );

  // ─── add_icon_text_block ───
  // ─── add_icon_text_block — icon-text 블록 추가 (아이콘 + 본문 1줄형) ──────
  // 좌측 작은 아이콘 박스(.itb-icon) + 우측 본문(.itb-text) 구성. 새 row를 만들고 선택 섹션에 삽입.
  // 텍스트/이미지는 add 직후 update_icon_text_block으로도 갱신 가능.
  registerTool(
    'add_icon_text_block',
    async ({ sectionId, text, imgSrc } = {}) => {
      if (!_rendererInvoker?.addIconTextBlock) throw new Error('renderer bridge not ready');
      // sectionId 검증
      if (sectionId !== undefined && sectionId !== null) {
        if (typeof sectionId !== 'string' || !sectionId.startsWith('sec_')) {
          throw new Error(`invalid sectionId: ${sectionId} (must start with sec_)`);
        }
      }
      // text 검증 (옵션)
      if (text !== undefined && text !== null) {
        if (typeof text !== 'string') throw new Error('text must be string');
        if ([...text].length > 2000) throw new Error('text too long (>2000)');
      }
      // imgSrc 검증 (옵션) — _validateIconTextOpts와 동일 룰
      if (imgSrc !== undefined && imgSrc !== null) {
        if (typeof imgSrc !== 'string') throw new Error('imgSrc must be string');
        if (imgSrc.length > 200000) throw new Error('imgSrc too long (>200000)');
        if (imgSrc.length > 0) {
          if (/["\r\n]/.test(imgSrc)) throw new Error('imgSrc contains quote/newline (escape unsafe)');
          const s = imgSrc.trim();
          const okProto =
            /^data:image\//i.test(s) ||
            /^https?:\/\//i.test(s) ||
            /^blob:/i.test(s) ||
            /^assets\//i.test(s);
          if (!okProto) throw new Error('imgSrc protocol not allowed (use data:image/*, http(s)://, blob:, or assets/)');
        }
      }
      return await _rendererInvoker.addIconTextBlock({ sectionId, text, imgSrc });
    },
    {
      description: 'Add an icon-text block (small icon + single body text). 좌측 .itb-icon(이미지 박스) + 우측 .itb-text(본문) 구조. text 생략시 기본 placeholder. imgSrc 생략시 dashed SVG placeholder. blockId는 itb_xxx. 이후 update_icon_text_block(blockId, partial)으로 수정.',
      inputSchema: {
        type: 'object',
        properties: {
          sectionId: { type: 'string', description: 'sec_xxx — omit to use currently selected section' },
          text:      { type: 'string', description: '본문 텍스트 (≤2000 code points). default "본문 내용을 입력하세요."' },
          imgSrc:    { type: 'string', description: '아이콘 이미지. data:image/*, http(s)://, blob:, assets/ 만 허용. ≤200000. " 와 개행 금지. 빈 문자열은 미설정과 동일.' }
        },
        required: []
      }
    }
  );

  // ─── update_icon_text_block ───
  // ─── update_icon_text_block — icon-text 블록 부분 수정 (id 기반) ──────────
  // PM이 본문 텍스트/아이콘 이미지를 partial update. update_banner02_block 패턴.
  registerTool(
    'update_icon_text_block',
    async ({ blockId, ...rest } = {}) => {
      if (!_rendererInvoker?.updateIconTextBlock) throw new Error('renderer bridge not ready');
      if (typeof blockId !== 'string' || !blockId.startsWith('itb_')) {
        throw new Error(`invalid blockId: ${blockId}. must be a string starting with "itb_"`);
      }
      const partial = _validateIconTextOpts(rest, { mode: 'update' });
      if (Object.keys(partial).length === 0) {
        throw new Error('no fields to update — provide at least one of text/imgSrc');
      }
      return await _rendererInvoker.updateIconTextBlock({ blockId, partial });
    },
    {
      description: 'Edit an EXISTING icon-text block (itb_xxx) — partial update. text (≤2000) 또는 imgSrc (≤200000, data:image/* | http(s) | blob: | assets/) 중 하나 이상 필수. imgSrc=""(빈 문자열) 전달 시 이미지 제거 + dashed placeholder 복원. Returns USER_BUSY if user is editing. Get blockId from get_canvas_state or returned from add_icon_text_block.',
      inputSchema: {
        type: 'object',
        properties: {
          blockId: { type: 'string', description: 'itb_xxx (icon-text block id)' },
          text:    { type: 'string', description: '본문 텍스트 갱신 (≤2000 code points). textContent로만 set (HTML 주입 X).' },
          imgSrc:  { type: 'string', description: '아이콘 이미지 갱신. data:image/*, http(s)://, blob:, assets/ 허용. ≤200000. " / 개행 금지. 빈 문자열 → 이미지 제거 + dashed placeholder 복원.' }
        },
        required: ['blockId']
      }
    }
  );

  // ─── add_step_block — 단계 표시 블록 추가 ──────────────────────────────────
  // step-block.js의 makeStepBlock 전체 opts 노출. steps 배열(1~10) + 색/크기/레이아웃까지 1콜.
  registerTool(
    'add_step_block',
    async (args = {}) => {
      if (!_rendererInvoker?.addStepBlock) throw new Error('renderer bridge not ready');
      const opts = _validateStepOpts(args, { mode: 'add' });
      return await _rendererInvoker.addStepBlock(opts);
    },
    {
      description: 'Add a step-block (numbered steps with title/desc each). blockId prefix: stb_. steps[1~10] = [{title, desc?}]. stepStyle: default|card|circle|number. stepOrient: vertical|horizontal (default=vertical; circle/number는 항상 horizontal). stepAlign: left|center|right|stack. badgeFormat: number|padded|alpha|step|point. connectorStyle: line|arrow|divider. Returns {ok, blockId, sectionId, ...}. 이후 update_step_block(blockId, partial)로 수정.',
      inputSchema: {
        type: 'object',
        properties: {
          sectionId: { type: 'string', description: 'sec_xxx — omit to use currently selected section' },
          steps: {
            type: 'array',
            minItems: 1,
            maxItems: 10,
            items: {
              type: 'object',
              properties: {
                title: { type: 'string', description: '단계 제목 (≤200)' },
                desc:  { type: 'string', description: '단계 설명 (≤500)' }
              },
              required: ['title']
            },
            description: '단계 배열 (1~10개). 각 요소 {title, desc?}'
          },
          numBg:      { type: 'string',  description: '배지 배경색 (#hex|rgb()|hsl()|transparent)' },
          numColor:   { type: 'string',  description: '배지 글자색' },
          numSize:    { type: 'integer', description: '배지 크기 px (4~400)' },
          titleSize:  { type: 'integer', description: '제목 폰트 크기 px (4~400)' },
          descSize:   { type: 'integer', description: '설명 폰트 크기 px (4~400)' },
          titleColor: { type: 'string',  description: '제목 색상' },
          descColor:  { type: 'string',  description: '설명 색상' },
          gap:        { type: 'integer', description: '단계 사이 간격 px (0~400)' },
          badgeGap:   { type: 'integer', description: '배지↔콘텐츠 간격 px (0~400)' },
          connector:  { type: 'boolean', description: '단계 연결선 표시 (default true)' },
          connectorStyle: { type: 'string', enum: ['line','arrow','divider'], description: '연결선 스타일 (default line)' },
          stepStyle:  { type: 'string', enum: ['default','card','circle','number'], description: '블록 스타일 (default default)' },
          stepOrient: { type: 'string', enum: ['vertical','horizontal'], description: '방향 (default vertical). circle/number는 무시되고 항상 horizontal.' },
          stepAlign:  { type: 'string', enum: ['left','center','right','stack'], description: '정렬 (default left)' },
          stepCardBg: { type: 'string',  description: '카드형(stepStyle=card) 배경색' },
          stepPadX:   { type: 'integer', description: '좌우 패딩 px (0~400)' },
          stepPadL:   { type: 'integer', description: '왼쪽 패딩 px (0~400) — stepPadX 우선' },
          stepPadR:   { type: 'integer', description: '오른쪽 패딩 px (0~400) — stepPadX 우선' },
          badgeFormat: { type: 'string', enum: ['number','padded','alpha','step','point'], description: '배지 표기 (1/01/A/STEP 01/POINT 01)' }
        },
        required: ['steps']
      }
    }
  );

  // ─── update_step_block — step-block 부분 수정 (id 기반) ───────────────────
  registerTool(
    'update_step_block',
    async ({ blockId, ...rest } = {}) => {
      if (!_rendererInvoker?.updateStepBlock) throw new Error('renderer bridge not ready');
      if (typeof blockId !== 'string' || !blockId.startsWith('stb_')) {
        throw new Error(`invalid blockId: ${blockId}. must be a string starting with "stb_"`);
      }
      const partial = _validateStepOpts(rest, { mode: 'update' });
      if (Object.keys(partial).length === 0) {
        throw new Error('no fields to update — provide at least one step field');
      }
      return await _rendererInvoker.updateStepBlock({ blockId, partial });
    },
    {
      description: 'Edit an EXISTING step-block (stb_xxx) — partial update. steps[] passes replace the entire array (1~10). Any field from add_step_block accepted. Returns USER_BUSY if user is editing. Get blockId from get_canvas_state or add_step_block.',
      inputSchema: {
        type: 'object',
        properties: {
          blockId: { type: 'string', description: 'stb_xxx (step-block id)' },
          steps: {
            type: 'array',
            minItems: 1,
            maxItems: 10,
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                desc:  { type: 'string' }
              },
              required: ['title']
            }
          },
          numBg:      { type: 'string' }, numColor:   { type: 'string' },
          numSize:    { type: 'integer' }, titleSize:  { type: 'integer' }, descSize: { type: 'integer' },
          titleColor: { type: 'string' }, descColor:  { type: 'string' },
          gap:        { type: 'integer' }, badgeGap:   { type: 'integer' },
          connector:  { type: 'boolean' },
          connectorStyle: { type: 'string', enum: ['line','arrow','divider'] },
          stepStyle:  { type: 'string', enum: ['default','card','circle','number'] },
          stepOrient: { type: 'string', enum: ['vertical','horizontal'] },
          stepAlign:  { type: 'string', enum: ['left','center','right','stack'] },
          stepCardBg: { type: 'string' },
          stepPadX:   { type: 'integer' }, stepPadL: { type: 'integer' }, stepPadR: { type: 'integer' },
          badgeFormat: { type: 'string', enum: ['number','padded','alpha','step','point'] }
        },
        required: ['blockId']
      }
    }
  );

  // ─── search_iconify — iconify API 검색 ─────────────────────────────────────
  // 화이트리스트 prefix만 허용. main 측 _doIconifySearch가 실제 fetch 수행 (SSRF 가드 포함).
  registerTool(
    'search_iconify',
    async ({ query, prefix, limit = 10 } = {}) => {
      if (!_iconifyApi?.search) throw new Error('iconify api not initialized (setIconifyApi not called)');
      if (typeof query !== 'string' || !query.trim()) throw new Error('query required (non-empty string)');
      if (query.length > 100) throw new Error('query too long (≤100)');
      if (prefix !== undefined && prefix !== null && prefix !== '') {
        if (typeof prefix !== 'string') throw new Error('prefix must be string');
        if (!_ICONIFY_PREFIXES.includes(prefix)) {
          throw new Error(`invalid prefix: ${prefix}. allowed: ${_ICONIFY_PREFIXES.join('|')}`);
        }
      } else {
        prefix = undefined;
      }
      const lim = (limit === undefined || limit === null) ? 10 : parseInt(limit, 10);
      if (!Number.isFinite(lim) || lim < 1 || lim > 30) throw new Error('limit must be 1~30');
      return await _iconifyApi.search({ query: query.trim(), prefix, limit: lim });
    },
    {
      description: 'Search Iconify icons by keyword. Returns up to `limit` icon candidates. Filter by `prefix` (icon family) to enforce visual consistency — REQUIRED to keep all icons in one set within a single task. Allowed prefixes: ' + _ICONIFY_PREFIXES.join(', ') + '. Returns {ok, total, icons: [{fullName, prefix, name}]}. POC 교훈: 첫 후보가 의미적으로 안 맞을 수 있음 — fullName을 보고 직접 검증할 것.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '검색어 (영문 권장, 1~100자). 예: "home", "arrow", "fan", "shirt"' },
          prefix: { type: 'string', enum: _ICONIFY_PREFIXES, description: '아이콘 패밀리 필터 — 한 작업 내 일관성 유지를 위해 지정 권장' },
          limit: { type: 'integer', description: '결과 개수 1~30 (default 10)' }
        },
        required: ['query']
      }
    }
  );

  // ─── add_iconify_block — 아이콘 SVG fetch + 캔버스 삽입 ────────────────────
  // main에서 svg fetch (CSP/SSRF 안전) → renderer atomic IIFE에 인자로 넘김.
  // banner02 패턴 미러: USER_BUSY 가드 + before/after icon-block diff로 blockId 추출.
  registerTool(
    'add_iconify_block',
    async ({ sectionId, name, size = 96, color } = {}) => {
      // 입력 검증을 dependency 체크보다 먼저 — 잘못된 입력은 즉시 거절 (DI 상태 영향 X).
      if (typeof name !== 'string' || !name.includes(':')) {
        throw new Error('name required in "prefix:icon-name" form (e.g. "ph:house-bold")');
      }
      const colonIdx = name.indexOf(':');
      const prefix = name.slice(0, colonIdx);
      const iconName = name.slice(colonIdx + 1);
      if (!_ICONIFY_PREFIXES.includes(prefix)) {
        throw new Error(`invalid prefix in name: ${prefix}. allowed: ${_ICONIFY_PREFIXES.join('|')}`);
      }
      if (!/^[a-z0-9-]{1,80}$/.test(iconName)) {
        throw new Error(`invalid icon name: ${iconName} (lowercase a-z 0-9 - only, ≤80)`);
      }
      if (sectionId !== undefined && sectionId !== null) {
        if (typeof sectionId !== 'string' || !sectionId.startsWith('sec_')) {
          throw new Error(`invalid sectionId: ${sectionId} (expected string starting with sec_)`);
        }
      }
      const sz = (size === undefined || size === null) ? 96 : parseInt(size, 10);
      if (!Number.isFinite(sz) || sz < 16 || sz > 512) throw new Error('size must be 16~512');
      let validatedColor;
      if (color !== undefined && color !== null && color !== '') {
        _validateIconifyColor(color);
        validatedColor = color;
      }
      // DI 체크는 검증 이후
      if (!_iconifyApi?.fetchSvg) throw new Error('iconify api not initialized (setIconifyApi not called)');
      if (!_rendererInvoker?.addIconifyBlock) throw new Error('renderer bridge not ready');
      const svgResult = await _iconifyApi.fetchSvg({ prefix, name: iconName, color: validatedColor });
      if (!svgResult || !svgResult.ok) {
        return svgResult || { ok: false, code: 'FETCH_FAILED', message: 'svg fetch failed' };
      }
      return await _rendererInvoker.addIconifyBlock({ sectionId, name, svg: svgResult.svg, size: sz });
    },
    {
      description: 'Insert an Iconify icon as an icon-block (icn_xxx). Fetches SVG from api.iconify.design and inserts atomically. `name` must be "prefix:icon-name" (e.g. "ph:house-bold"). Returns {ok, blockId: "icn_xxx", sectionId, ...}. ALLOWED prefixes: ' + _ICONIFY_PREFIXES.join(', ') + '. POC 교훈: 같은 작업 내 모든 아이콘은 동일 prefix + 동일 weight(-bold/-fill 등) 사용해 시각 일관성 유지할 것.',
      inputSchema: {
        type: 'object',
        properties: {
          sectionId: { type: 'string', description: 'sec_xxx — 미지정 시 현재 선택된 섹션' },
          name: { type: 'string', description: '"prefix:icon-name" 형식. 예: "ph:fan-bold", "lucide:home", "tabler:user"' },
          size: { type: 'integer', description: '아이콘 픽셀 크기 16~512 (default 96)' },
          color: { type: 'string', description: 'SVG fill 색 — #hex / rgb(a)() / hsl(a)() / transparent. 미지정 시 SVG 원본 사용.' }
        },
        required: ['name']
      }
    }
  );

  // ─── add_comparison_block — N칼럼 비교 블록 추가 (1:1, 1:1:1 …) ───────────
  // comparison-block.js의 makeComparisonBlock opts 노출. cols 배열 + featured(int idx) + 강조크기/겹침/반경/폰트.
  registerTool(
    'add_comparison_block',
    async (args = {}) => {
      if (!_rendererInvoker?.addComparisonBlock) throw new Error('renderer bridge not ready');
      const opts = _validateComparisonOpts(args, { mode: 'add' });
      return await _rendererInvoker.addComparisonBlock(opts);
    },
    {
      description: 'Add a comparison block (cmp_xxx) — N칼럼 비교 블록 (1:1, 1:1:1 …). 한 칼럼(featured)이 더 크게 떠보임. cols 배열로 칼럼 정의 (2~8개), 각 칼럼 {title, bg, text, rows[]}. featured는 강조 칼럼 인덱스(기본 마지막). 반환 blockId는 cmp_xxx. 이후 update_comparison_block으로 수정.',
      inputSchema: {
        type: 'object',
        properties: {
          sectionId: { type: 'string', description: 'sec_xxx — 미지정 시 현재 선택된 섹션' },
          layerName: { type: 'string', description: '레이어 패널 표시명 (≤100)' },
          cols: {
            type: 'array',
            description: '칼럼 배열 (2~8개). 미지정 시 기본 2칼럼 (일반 제품 vs 브랜드).',
            minItems: 2, maxItems: 8,
            items: {
              type: 'object',
              properties: {
                title: { type: 'string', description: '칼럼 제목 (≤200)' },
                bg:    { type: 'string', description: '배경색 (#hex|rgb(a)/hsl(a)|transparent) 또는 gradient css' },
                text:  { type: 'string', description: '텍스트 색 (#hex|rgb(a)/hsl(a)|transparent)' },
                rows:  { type: 'array', description: '행 텍스트 배열 (≤20개)', items: { type: 'string' } }
              }
            }
          },
          featured:  { type: 'integer', description: '강조 칼럼 인덱스 (0~cols.length-1). 기본은 마지막 칼럼.' },
          featScale: { type: 'number',  description: '강조 칼럼 스케일 (1.0~1.5, default 1.2)' },
          compW:     { type: 'integer', description: '디자인 폭 (120~4000, default 720)' },
          overlap:   { type: 'integer', description: '인접 칼럼 겹침 px (0~400, default 32)' },
          radius:    { type: 'integer', description: '카드 모서리 반경 px (0~400, default 20)' },
          padX:      { type: 'integer', description: '블록 좌우 패딩 px (0~400, default 0)' },
          padY:      { type: 'integer', description: '카드 내부 상하 패딩 px (0~400, default 0)' },
          headerH:   { type: 'integer', description: '헤더 높이 px (16~400, default 72)' },
          rowH:      { type: 'integer', description: '행 높이 px (16~400, default 64)' },
          rowGap:    { type: 'integer', description: '행 간격 px (0~200, default 8)' },
          titleFont: { type: 'integer', description: '제목 폰트 px (4~400, default 26)' },
          rowFont:   { type: 'integer', description: '내용 폰트 px (4~400, default 18)' }
        },
        required: []
      }
    }
  );

  // ─── update_comparison_block — 기존 comparison 블록 부분 수정 ──────────────
  registerTool(
    'update_comparison_block',
    async ({ blockId, ...rest } = {}) => {
      if (!_rendererInvoker?.updateComparisonBlock) throw new Error('renderer bridge not ready');
      if (typeof blockId !== 'string' || !blockId.startsWith('cmp_')) {
        throw new Error(`invalid blockId: ${blockId}. must be a string starting with "cmp_"`);
      }
      const partial = _validateComparisonOpts(rest, { mode: 'update' });
      if (Object.keys(partial).length === 0) {
        throw new Error('no fields to update — provide at least one comparison field');
      }
      return await _rendererInvoker.updateComparisonBlock({ blockId, partial });
    },
    {
      description: 'Edit an EXISTING comparison block (cmp_xxx) — partial update. 외곽(featScale/overlap/radius/padX/padY/compW/headerH/rowH/rowGap/titleFont/rowFont) + featured(int) + 칼럼 전체교체(cols) + 칼럼 부분 패치(columnPatch [{index, title?, bg?, text?, rows?}]) + 행 높이(rowHeights 행 인덱스→px 배열, null이면 기본 rowH). rows 항목은 문자열(text행) 또는 {type:"image", imgSrc(dataURL, ≤200000자, 따옴표/개행 금지), imgFit:"cover"|"contain"} 객체. cols 와 columnPatch 동시 지정 시 cols가 먼저 적용된다. USER_BUSY 시 즉시 반환.',
      inputSchema: {
        type: 'object',
        properties: {
          blockId: { type: 'string', description: 'cmp_xxx (comparison block id)' },
          layerName: { type: 'string' },
          cols: {
            type: 'array', minItems: 2, maxItems: 8,
            description: '칼럼 배열 전체 교체 (2~8). 부분만 바꾸려면 columnPatch 사용.',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' }, bg: { type: 'string' }, text: { type: 'string' },
                rows:  { type: 'array', description: '행 배열. 문자열(text행) 또는 {type:"text"|"image", text?, imgSrc?, imgFit?} 객체.' }
              }
            }
          },
          columnPatch: {
            type: 'array',
            description: '특정 칼럼만 부분 갱신 (index 필수). 최대 16개 patch.',
            items: {
              type: 'object',
              properties: {
                index: { type: 'integer', description: '대상 칼럼 인덱스 (0-base)' },
                title: { type: 'string' }, bg: { type: 'string' }, text: { type: 'string' },
                rows:  { type: 'array', description: '행 배열. 문자열 또는 {type, text, imgSrc, imgFit} 객체.' }
              },
              required: ['index']
            }
          },
          rowHeights: {
            type: 'array', maxItems: 20,
            description: '행 인덱스별 높이(px) 오버라이드. null/0이면 기본 rowH 사용. 값 범위 16~400. 전 칼럼 공통.',
            items: { type: ['integer', 'null'] }
          },
          featured:  { type: 'integer' },
          featScale: { type: 'number' },
          compW:     { type: 'integer' },
          overlap:   { type: 'integer' },
          radius:    { type: 'integer' },
          padX:      { type: 'integer' },
          padY:      { type: 'integer' },
          headerH:   { type: 'integer' },
          rowH:      { type: 'integer' },
          rowGap:    { type: 'integer' },
          titleFont: { type: 'integer' },
          rowFont:   { type: 'integer' }
        },
        required: ['blockId']
      }
    }
  );

  /* ── ★토큰 다이어트 (2026-08-25) ───────────────────────────────────────
   *   위에서 등록한 add_*_block(26) + update_*_block(25) = 51개를 표면에서
   *   add_block / update_block / get_block_schema 3개로 접는다.
   *   51개는 «별칭»으로 남아 계속 호출 가능(목록에서만 숨김) → 하위호환 100%.
   *   ⚠️반드시 «모든» 블록 도구 등록 뒤에 와야 한다(그 이름들을 감싸기 때문). */
  require('./mcp-block-tools').install({ tools, toolSchemas, registerTool, hide: hideTool });
}

// ─── iconify: 화이트리스트 + 색상 검증 ──────────────────────────────────────
// COLLECTIONS 11종 중 'All' 제외. banner02 _color 패턴 미러.
const _ICONIFY_PREFIXES = [
  'mdi', 'material-symbols', 'heroicons', 'lucide', 'ph',
  'tabler', 'bi', 'feather', 'ion', 'ri'
];

function _validateIconifyColor(v) {
  if (typeof v !== 'string') throw new Error('color must be string');
  const s = v.trim();
  if (!s) throw new Error('color empty');
  if (s.length > 64) throw new Error('color too long');
  const ok =
    /^#[0-9a-fA-F]{3,8}$/.test(s) ||
    /^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$/.test(s) ||
    s === 'transparent';
  if (!ok) throw new Error('invalid color (allowed: #hex | rgb(a)/hsl(a)() | transparent)');
}

// ─── banner02 옵션 검증 (add/update 공용) ───────────────────────────────────
// mode='add'  → sectionId 허용, 모든 필드 optional (block-factory가 기본값 채움)
// mode='update' → sectionId 무시, blockId는 caller에서 처리. 빈 객체도 허용 (caller가 별도 체크).
function _validateBanner02Opts(args, { mode } = {}) {
  if (!args || typeof args !== 'object') throw new Error('args must be object');
  const out = {};

  const _int = (key, min, max) => {
    if (args[key] === undefined || args[key] === null) return;
    const n = args[key];
    if (!Number.isInteger(n)) throw new Error(`${key} must be integer`);
    if (min !== undefined && n < min) throw new Error(`${key} < ${min}`);
    if (max !== undefined && n > max) throw new Error(`${key} > ${max}`);
    out[key] = n;
  };
  const _str = (key, maxLen) => {
    if (args[key] === undefined || args[key] === null) return;
    if (typeof args[key] !== 'string') throw new Error(`${key} must be string`);
    if (maxLen !== undefined && [...args[key]].length > maxLen) {
      throw new Error(`${key} too long (>${maxLen} code points)`);
    }
    out[key] = args[key];
  };
  // hex/rgb()/rgba()/hsl()/hsla()/transparent — strict. CSS injection 차단.
  const _color = (key) => {
    if (args[key] === undefined || args[key] === null) return;
    if (typeof args[key] !== 'string') throw new Error(`${key} must be string`);
    const v = args[key].trim();
    if (v.length === 0) throw new Error(`${key} empty`);
    if (v.length > 64) throw new Error(`${key} too long`);
    const ok =
      /^#[0-9a-fA-F]{3,8}$/.test(v) ||
      /^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$/.test(v) ||
      v === 'transparent';
    if (!ok) throw new Error(`${key} invalid color (allowed: #hex | rgb(a)/hsl(a)() | transparent)`);
    out[key] = v;
  };
  const _enum = (key, allowed) => {
    if (args[key] === undefined || args[key] === null) return;
    if (!allowed.includes(args[key])) throw new Error(`invalid ${key}: ${args[key]}. allowed: ${allowed.join('|')}`);
    out[key] = args[key];
  };

  if (mode === 'add') {
    if (args.sectionId !== undefined && args.sectionId !== null) {
      if (typeof args.sectionId !== 'string' || !args.sectionId.startsWith('sec_')) {
        throw new Error(`invalid sectionId: ${args.sectionId}. expected string starting with sec_`);
      }
      out.sectionId = args.sectionId;
    }
  }

  _enum('variant', ['frame_8', 'wide_4x1']);
  _str('layerName', 100);
  _int('width', 80, 4000);
  _int('height', 40, 4000);
  _int('radius', 0, 400);
  _color('bg');
  _enum('align', ['left', 'center', 'right']);
  _int('textX', -4000, 4000); _int('textY', -4000, 4000); _int('textW', 20, 4000);
  _str('label', 500); _int('labelSize', 4, 400); _color('labelColor');
  _str('title', 500); _int('titleSize', 4, 400); _color('titleColor');
  _str('sub',   500); _int('subSize',   4, 400); _color('subColor');
  _int('gap1', 0, 400); _int('gap2', 0, 400);

  if (args.imgSrc !== undefined && args.imgSrc !== null) {
    if (typeof args.imgSrc !== 'string') throw new Error('imgSrc must be string');
    if (args.imgSrc.length > 200000) throw new Error('imgSrc too long (>200000)');
    if (/["\r\n]/.test(args.imgSrc)) throw new Error('imgSrc contains quote/newline (escape unsafe)');
    // ★put_image 와 «같은» 검사 함수를 부른다 — 겹을 새로 만들지 않는다(지디 2026-09-07).
    //   상한(200000자)은 «양»을 막지 «구조»를 못 막는다. 잘린 PNG 는 크기와 무관하다.
    _assertImageSrcIntact(args.imgSrc, 'imgSrc');
    out.imgSrc = args.imgSrc;
  }
  _int('imgX', -4000, 4000); _int('imgY', -4000, 4000);
  _int('imgW', 4, 4000); _int('imgH', 4, 4000);
  _enum('imgFit', ['cover', 'contain']);
  _enum('layout', ['left', 'right']);

  // 가변 텍스트 lines — banner02 v2 (slot 추가/삭제/편집)
  const _validateLine = (l, ctx) => {
    if (!l || typeof l !== 'object') throw new Error(`${ctx} must be object`);
    const o = {};
    if (l.kind !== undefined) {
      if (typeof l.kind !== 'string' || l.kind.length === 0 || l.kind.length > 32) throw new Error(`${ctx}.kind invalid`);
      if (!/^[a-zA-Z0-9_-]+$/.test(l.kind)) throw new Error(`${ctx}.kind must match [a-zA-Z0-9_-]+`);
      o.kind = l.kind;
    }
    if (l.text !== undefined && l.text !== null) {
      if (typeof l.text !== 'string') throw new Error(`${ctx}.text must be string`);
      if ([...l.text].length > 500) throw new Error(`${ctx}.text too long (>500)`);
      o.text = l.text;
    }
    if (l.size !== undefined && l.size !== null) {
      if (!Number.isFinite(l.size)) throw new Error(`${ctx}.size must be number`);
      if (l.size < 4 || l.size > 400) throw new Error(`${ctx}.size out of range [4,400]`);
      o.size = l.size;
    }
    if (l.color !== undefined && l.color !== null) {
      if (typeof l.color !== 'string') throw new Error(`${ctx}.color must be string`);
      const v = l.color.trim();
      const ok = /^#[0-9a-fA-F]{3,8}$/.test(v) || /^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$/.test(v) || v === 'transparent';
      if (!ok) throw new Error(`${ctx}.color invalid`);
      o.color = v;
    }
    if (l.gapTop !== undefined && l.gapTop !== null) {
      if (!Number.isFinite(l.gapTop)) throw new Error(`${ctx}.gapTop must be number`);
      if (l.gapTop < 0 || l.gapTop > 400) throw new Error(`${ctx}.gapTop out of range [0,400]`);
      o.gapTop = l.gapTop;
    }
    if (l.fontFamily !== undefined && l.fontFamily !== null) {
      if (typeof l.fontFamily !== 'string') throw new Error(`${ctx}.fontFamily must be string`);
      if (l.fontFamily.length > 100) throw new Error(`${ctx}.fontFamily too long (>100)`);
      // CSS injection 차단 — 영숫자/공백/콤마/하이픈/괄호/점/언더스코어/single quote/한글만 허용. 빈 문자열 OK.
      if (l.fontFamily !== '' && !/^[A-Za-z0-9 ,\-_().' -￿]+$/.test(l.fontFamily)) {
        throw new Error(`${ctx}.fontFamily contains disallowed characters`);
      }
      if (/[;{}<>"@\\]/.test(l.fontFamily)) throw new Error(`${ctx}.fontFamily contains disallowed characters`);
      o.fontFamily = l.fontFamily;
    }
    if (l.fontWeight !== undefined && l.fontWeight !== null) {
      if (!Number.isInteger(l.fontWeight)) throw new Error(`${ctx}.fontWeight must be integer`);
      if (l.fontWeight < 100 || l.fontWeight > 900) throw new Error(`${ctx}.fontWeight out of range [100,900]`);
      o.fontWeight = l.fontWeight;
    }
    if (l.letterSpacing !== undefined && l.letterSpacing !== null) {
      if (!Number.isFinite(l.letterSpacing)) throw new Error(`${ctx}.letterSpacing must be number`);
      if (l.letterSpacing < -20 || l.letterSpacing > 50) throw new Error(`${ctx}.letterSpacing out of range [-20,50]`);
      o.letterSpacing = l.letterSpacing;
    }
    return o;
  };

  if (args.lines !== undefined && args.lines !== null) {
    if (!Array.isArray(args.lines)) throw new Error('lines must be array');
    if (args.lines.length === 0 || args.lines.length > 20) throw new Error('lines length must be in [1,20]');
    out.lines = args.lines.map((l, i) => _validateLine(l, `lines[${i}]`));
  }
  if (args.addLine !== undefined && args.addLine !== null) {
    const v = _validateLine(args.addLine, 'addLine');
    if (args.addLine.atIndex !== undefined && args.addLine.atIndex !== null) {
      if (!Number.isInteger(args.addLine.atIndex) || args.addLine.atIndex < 0 || args.addLine.atIndex > 20) {
        throw new Error('addLine.atIndex must be integer in [0,20]');
      }
      v.atIndex = args.addLine.atIndex;
    }
    out.addLine = v;
  }
  if (args.removeLine !== undefined && args.removeLine !== null) {
    const r = args.removeLine;
    if (typeof r === 'number') {
      if (!Number.isInteger(r) || r < 0 || r > 20) throw new Error('removeLine index must be integer in [0,20]');
      out.removeLine = r;
    } else if (typeof r === 'object') {
      const o = {};
      if (r.index !== undefined && r.index !== null) {
        if (!Number.isInteger(r.index) || r.index < 0 || r.index > 20) throw new Error('removeLine.index invalid');
        o.index = r.index;
      }
      if (r.kind !== undefined && r.kind !== null) {
        if (typeof r.kind !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(r.kind)) throw new Error('removeLine.kind invalid');
        o.kind = r.kind;
      }
      if (r.occurrence !== undefined && r.occurrence !== null) {
        if (!Number.isInteger(r.occurrence) || r.occurrence < 1) throw new Error('removeLine.occurrence must be integer >=1');
        o.occurrence = r.occurrence;
      }
      if (o.index === undefined && o.kind === undefined) throw new Error('removeLine requires index or kind');
      out.removeLine = o;
    } else {
      throw new Error('removeLine must be number or object');
    }
  }
  if (args.editLine !== undefined && args.editLine !== null) {
    const e = args.editLine;
    if (typeof e !== 'object') throw new Error('editLine must be object');
    const o = _validateLine(e, 'editLine');
    if (e.index !== undefined && e.index !== null) {
      if (!Number.isInteger(e.index) || e.index < 0 || e.index > 20) throw new Error('editLine.index invalid');
      o.index = e.index;
    }
    if (e.occurrence !== undefined && e.occurrence !== null) {
      if (!Number.isInteger(e.occurrence) || e.occurrence < 1) throw new Error('editLine.occurrence must be integer >=1');
      o.occurrence = e.occurrence;
    }
    if (o.index === undefined && o.kind === undefined) throw new Error('editLine requires index or kind');
    out.editLine = o;
  }

  return out;
}


// ─── [APIMCP P1] liner-block 필드 검증 (add/update 공용) ─────────────────────
// preset enum(arc-up|arc-down|wave|circle), text(string ≤2000), fontSize(int 4~400),
// curvature(0~100), letterSpacing(-2~20), startAngle(0~360). 모두 optional.
const _LINER_PRESETS = ['arc-up', 'arc-down', 'wave', 'circle'];
function _validateLinerFields({ preset, text, fontSize, curvature, letterSpacing, startAngle } = {}) {
  if (preset !== undefined && preset !== null && !_LINER_PRESETS.includes(preset)) {
    throw new Error(`invalid preset: ${preset}. allowed: ${_LINER_PRESETS.join('|')}`);
  }
  if (text !== undefined && text !== null) {
    if (typeof text !== 'string') throw new Error('text must be string');
    if ([...text].length > 2000) throw new Error('text too long (>2000)');
  }
  const _num = (v, key, min, max, intOnly) => {
    if (v === undefined || v === null) return;
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`${key} must be number`);
    if (intOnly && !Number.isInteger(v)) throw new Error(`${key} must be integer`);
    if (v < min || v > max) throw new Error(`${key} out of range [${min}, ${max}]`);
  };
  _num(fontSize, 'fontSize', 4, 400, true);
  _num(curvature, 'curvature', 0, 100, false);
  _num(letterSpacing, 'letterSpacing', -2, 20, false);
  _num(startAngle, 'startAngle', 0, 360, false);
}

// frame-block partial validator (banner02 _validateBanner02Opts 패턴 미러).
// mode='update' 전용 (frame은 add_* 도구를 별도로 가지므로 update만 다룸).
// 모든 필드 optional, strict. enum은 화이트리스트 강제.
function _validateFrameOpts(args, { mode } = {}) {
  if (!args || typeof args !== 'object') throw new Error('args must be object');
  const out = {};

  // ── helpers (banner02 미러) ──
  const _int = (key, min, max) => {
    if (args[key] === undefined || args[key] === null) return;
    const n = args[key];
    if (!Number.isInteger(n)) throw new Error(`${key} must be integer`);
    if (min !== undefined && n < min) throw new Error(`${key} < ${min}`);
    if (max !== undefined && n > max) throw new Error(`${key} > ${max}`);
    out[key] = n;
  };
  const _num = (key, min, max) => {
    if (args[key] === undefined || args[key] === null) return;
    const n = args[key];
    if (!Number.isFinite(n)) throw new Error(`${key} must be number`);
    if (min !== undefined && n < min) throw new Error(`${key} < ${min}`);
    if (max !== undefined && n > max) throw new Error(`${key} > ${max}`);
    out[key] = n;
  };
  // bg는 gradient css도 허용하므로 별도 분기. borderColor는 strict color.
  const _color = (key) => {
    if (args[key] === undefined || args[key] === null) return;
    if (typeof args[key] !== 'string') throw new Error(`${key} must be string`);
    const v = args[key].trim();
    if (v.length === 0) throw new Error(`${key} empty`);
    if (v.length > 64)  throw new Error(`${key} too long`);
    const ok =
      /^#[0-9a-fA-F]{3,8}$/.test(v) ||
      /^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$/.test(v) ||
      v === 'transparent';
    if (!ok) throw new Error(`${key} invalid color (allowed: #hex | rgb(a)/hsl(a)() | transparent)`);
    out[key] = v;
  };
  const _enum = (key, allowed) => {
    if (args[key] === undefined || args[key] === null) return;
    if (!allowed.includes(args[key])) throw new Error(`invalid ${key}: ${args[key]}. allowed: ${allowed.join('|')}`);
    out[key] = args[key];
  };
  const _bool = (key) => {
    if (args[key] === undefined || args[key] === null) return;
    if (typeof args[key] !== 'boolean') throw new Error(`${key} must be boolean`);
    out[key] = args[key];
  };

  // 1) bg — solid color OR css gradient string. CSS injection 가드 (" / 개행 / ; 차단).
  if (args.bg !== undefined && args.bg !== null) {
    if (typeof args.bg !== 'string') throw new Error('bg must be string');
    const v = args.bg.trim();
    if (v.length === 0)  throw new Error('bg empty');
    if (v.length > 1024) throw new Error('bg too long (>1024)');
    if (/["\r\n;]/.test(v)) throw new Error('bg contains quote/newline/semicolon (CSS injection guard)');
    const isGradient = /gradient\s*\(/i.test(v);
    if (!isGradient) {
      const okColor = /^#[0-9a-fA-F]{3,8}$/.test(v) || /^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$/.test(v) || v === 'transparent';
      if (!okColor) throw new Error('bg invalid (allowed: #hex | rgb(a)/hsl(a)() | transparent | css gradient(...))');
    }
    out.bg = v;
  }

  // 2) bgImage — file path / URL / null. data URL 금지 (페이로드 폭주 방지).
  if (args.bgImage !== undefined) {
    if (args.bgImage === null || args.bgImage === '') {
      out.bgImage = null;
    } else {
      if (typeof args.bgImage !== 'string') throw new Error('bgImage must be string (url/path) or null');
      const src = args.bgImage.trim();
      if (src.length === 0)  throw new Error('bgImage empty');
      if (src.length > 4096) throw new Error('bgImage too long (>4096)');
      if (/["\r\n]/.test(src)) throw new Error('bgImage contains quote/newline (escape unsafe)');
      if (/^data:/i.test(src)) throw new Error('bgImage data: URL not allowed — use file path or http(s) URL');
      if (!/^(https?:\/\/|file:\/\/|\/|\.{1,2}\/|[a-zA-Z0-9_\-./])/.test(src)) {
        throw new Error('bgImage scheme not allowed (http/https/file/relative only)');
      }
      out.bgImage = src;
    }
  }

  // 3) Size / Padding / Radius
  _int('width',  20, 4000);
  _int('height', 20, 4000);
  _int('paddingY', 0, 400);
  _int('radius', 0, 400);

  // [APIMCP P1] bgOpacity (배경 반투명 0~1 float, 콘텐츠는 불투명 유지) — renderer 지원, MCP 노출 누락이었음.
  _num('bgOpacity', 0, 1);

  // 4) Border
  _int('borderWidth', 0, 100);
  _enum('borderStyle', ['solid', 'dashed', 'dotted', 'double', 'none']);
  _color('borderColor');

  // 5) Child align (flex)
  _enum('alignItems',     ['flex-start', 'center', 'flex-end', 'stretch', 'baseline']);
  _enum('justifyContent', ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly']);

  // 6) gap
  _int('gap', 0, 400);

  // 7) Transform
  _int('translateX', -10000, 10000);
  _int('translateY', -10000, 10000);
  _num('rotateDeg', -360, 360);
  _bool('flipH');
  _bool('flipV');

  // 8) bannerPreset (destructive — confirmDestructive 동반 필수)
  if (args.bannerPreset !== undefined && args.bannerPreset !== null) {
    if (typeof args.bannerPreset !== 'string') throw new Error('bannerPreset must be string');
    if (args.bannerPreset.length === 0 || args.bannerPreset.length > 64) throw new Error('bannerPreset length invalid');
    if (!/^[a-zA-Z0-9_-]+$/.test(args.bannerPreset)) throw new Error('bannerPreset must match [a-zA-Z0-9_-]+');
    out.bannerPreset = args.bannerPreset;
  }
  _bool('confirmDestructive');
  if (out.bannerPreset !== undefined && out.confirmDestructive !== true) {
    throw new Error('bannerPreset 변경은 destructive (자식 모두 삭제). confirmDestructive:true를 명시하세요.');
  }

  return out;
}

// ─── laurel validator ───
// ─── laurel 옵션 검증 (add/update 공용) ─────────────────────────────────────
// mode='add'    → sectionId 허용. 모든 필드 optional (block-factory가 기본값 채움).
// mode='update' → sectionId 무시. blockId는 caller에서 처리. 빈 객체도 허용 (caller가 별도 체크).
// 데이터 모델: cells[] of { lines[]:{text,fontSize,fontWeight,color,letterSpacing}, leafColor, leafFill, gap, height }
const _LAUREL_LEAF_FILLS = [
  'solid',
  'gold', 'silver', 'bronze', 'rosegold', 'platinum',
  'appleGold', 'appleSilver', 'appleMidnight', 'appleStarlight',
  'polishedGold', 'mirrorSilver', 'champagne', 'emeraldMetal', 'iridescent',
];

function _validateLaurelOpts(args, { mode } = {}) {
  if (!args || typeof args !== 'object') throw new Error('args must be object');
  const out = {};

  // ── helpers (banner02 _int/_str/_color/_enum 패턴 미러) ──
  const _int = (key, min, max) => {
    if (args[key] === undefined || args[key] === null) return;
    const n = args[key];
    if (!Number.isInteger(n)) throw new Error(`${key} must be integer`);
    if (min !== undefined && n < min) throw new Error(`${key} < ${min}`);
    if (max !== undefined && n > max) throw new Error(`${key} > ${max}`);
    out[key] = n;
  };
  const _str = (key, maxLen) => {
    if (args[key] === undefined || args[key] === null) return;
    if (typeof args[key] !== 'string') throw new Error(`${key} must be string`);
    if (maxLen !== undefined && [...args[key]].length > maxLen) {
      throw new Error(`${key} too long (>${maxLen} code points)`);
    }
    out[key] = args[key];
  };
  const _color = (key) => {
    if (args[key] === undefined || args[key] === null) return;
    if (typeof args[key] !== 'string') throw new Error(`${key} must be string`);
    const v = args[key].trim();
    if (v.length === 0) throw new Error(`${key} empty`);
    if (v.length > 64)  throw new Error(`${key} too long`);
    const ok =
      /^#[0-9a-fA-F]{3,8}$/.test(v) ||
      /^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$/.test(v) ||
      v === 'transparent';
    if (!ok) throw new Error(`${key} invalid color (allowed: #hex | rgb(a)/hsl(a)() | transparent)`);
    out[key] = v;
  };
  const _enum = (key, allowed) => {
    if (args[key] === undefined || args[key] === null) return;
    if (!allowed.includes(args[key])) throw new Error(`invalid ${key}: ${args[key]}. allowed: ${allowed.join('|')}`);
    out[key] = args[key];
  };

  // 인라인 color/text 검증 (cells/lines 안의 필드용)
  const _checkColor = (v, ctx) => {
    if (typeof v !== 'string') throw new Error(`${ctx} must be string`);
    const s = v.trim();
    if (!s) throw new Error(`${ctx} empty`);
    if (s.length > 64) throw new Error(`${ctx} too long`);
    const ok =
      /^#[0-9a-fA-F]{3,8}$/.test(s) ||
      /^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$/.test(s) ||
      s === 'transparent';
    if (!ok) throw new Error(`${ctx} invalid color`);
    return s;
  };
  const _validateLine = (l, ctx) => {
    if (!l || typeof l !== 'object') throw new Error(`${ctx} must be object`);
    const o = {};
    if (l.text !== undefined && l.text !== null) {
      if (typeof l.text !== 'string') throw new Error(`${ctx}.text must be string`);
      if ([...l.text].length > 500) throw new Error(`${ctx}.text too long (>500)`);
      o.text = l.text;
    }
    if (l.fontSize !== undefined && l.fontSize !== null) {
      if (!Number.isInteger(l.fontSize)) throw new Error(`${ctx}.fontSize must be integer`);
      if (l.fontSize < 8 || l.fontSize > 400) throw new Error(`${ctx}.fontSize out of range [8,400]`);
      o.fontSize = l.fontSize;
    }
    if (l.fontWeight !== undefined && l.fontWeight !== null) {
      if (!Number.isInteger(l.fontWeight)) throw new Error(`${ctx}.fontWeight must be integer`);
      if (l.fontWeight < 100 || l.fontWeight > 900) throw new Error(`${ctx}.fontWeight out of range [100,900]`);
      o.fontWeight = l.fontWeight;
    }
    if (l.color !== undefined && l.color !== null) {
      o.color = _checkColor(l.color, `${ctx}.color`);
    }
    if (l.letterSpacing !== undefined && l.letterSpacing !== null) {
      if (!Number.isFinite(l.letterSpacing)) throw new Error(`${ctx}.letterSpacing must be number`);
      if (l.letterSpacing < -20 || l.letterSpacing > 50) throw new Error(`${ctx}.letterSpacing out of range [-20,50]`);
      o.letterSpacing = l.letterSpacing;
    }
    return o;
  };
  const _validateCell = (c, ctx) => {
    if (!c || typeof c !== 'object') throw new Error(`${ctx} must be object`);
    const o = {};
    if (c.lines !== undefined && c.lines !== null) {
      if (!Array.isArray(c.lines)) throw new Error(`${ctx}.lines must be array`);
      if (c.lines.length < 1 || c.lines.length > 20) throw new Error(`${ctx}.lines length must be in [1,20]`);
      o.lines = c.lines.map((ln, i) => _validateLine(ln, `${ctx}.lines[${i}]`));
    }
    if (c.leafColor !== undefined && c.leafColor !== null) {
      o.leafColor = _checkColor(c.leafColor, `${ctx}.leafColor`);
    }
    if (c.leafFill !== undefined && c.leafFill !== null) {
      if (!_LAUREL_LEAF_FILLS.includes(c.leafFill)) {
        throw new Error(`${ctx}.leafFill invalid (allowed: ${_LAUREL_LEAF_FILLS.join('|')})`);
      }
      o.leafFill = c.leafFill;
    }
    if (c.gap !== undefined && c.gap !== null) {
      if (!Number.isInteger(c.gap)) throw new Error(`${ctx}.gap must be integer`);
      if (c.gap < 0 || c.gap > 2000) throw new Error(`${ctx}.gap out of range [0,2000]`);
      o.gap = c.gap;
    }
    if (c.height !== undefined && c.height !== null) {
      if (!Number.isInteger(c.height)) throw new Error(`${ctx}.height must be integer`);
      if (c.height < 20 || c.height > 600) throw new Error(`${ctx}.height out of range [20,600]`);
      o.height = c.height;
    }
    return o;
  };

  // ── add 모드: sectionId 허용 ──
  if (mode === 'add') {
    if (args.sectionId !== undefined && args.sectionId !== null) {
      if (typeof args.sectionId !== 'string' || !args.sectionId.startsWith('sec_')) {
        throw new Error(`invalid sectionId: ${args.sectionId}. expected string starting with sec_`);
      }
      out.sectionId = args.sectionId;
    }
  }

  // ── 공통 필드 ──
  _str('layerName', 100);
  _int('gridCols', 1, 4);
  _int('gridRows', 1, 4);
  _int('gridColGap', 0, 400);
  _int('gridRowGap', 0, 400);

  // ── 일괄 적용 (update 전용이지만 add에서도 무해) ──
  _int('allGap', 0, 2000);
  _int('allHeight', 20, 600);
  _color('allLeafColor');
  _enum('allLeafFill', _LAUREL_LEAF_FILLS);

  // ── cells 전체 ──
  if (args.cells !== undefined && args.cells !== null) {
    if (!Array.isArray(args.cells)) throw new Error('cells must be array');
    if (args.cells.length < 1 || args.cells.length > 16) throw new Error('cells length must be in [1,16]');
    out.cells = args.cells.map((c, i) => _validateCell(c, `cells[${i}]`));
  }

  // ── editCell ──
  if (args.editCell !== undefined && args.editCell !== null) {
    const e = args.editCell;
    if (typeof e !== 'object') throw new Error('editCell must be object');
    if (!Number.isInteger(e.index) || e.index < 0 || e.index > 15) throw new Error('editCell.index must be integer in [0,15]');
    const o = _validateCell(e, 'editCell');
    o.index = e.index;
    out.editCell = o;
  }

  // ── addLine ──
  if (args.addLine !== undefined && args.addLine !== null) {
    const a = args.addLine;
    if (typeof a !== 'object') throw new Error('addLine must be object');
    if (!Number.isInteger(a.cellIndex) || a.cellIndex < 0 || a.cellIndex > 15) throw new Error('addLine.cellIndex must be integer in [0,15]');
    if (!a.line || typeof a.line !== 'object') throw new Error('addLine.line must be object');
    const o = { cellIndex: a.cellIndex, line: _validateLine(a.line, 'addLine.line') };
    if (a.atIndex !== undefined && a.atIndex !== null) {
      if (!Number.isInteger(a.atIndex) || a.atIndex < 0 || a.atIndex > 20) throw new Error('addLine.atIndex must be integer in [0,20]');
      o.atIndex = a.atIndex;
    }
    out.addLine = o;
  }

  // ── removeLine ──
  if (args.removeLine !== undefined && args.removeLine !== null) {
    const r = args.removeLine;
    if (typeof r !== 'object') throw new Error('removeLine must be object');
    if (!Number.isInteger(r.cellIndex) || r.cellIndex < 0 || r.cellIndex > 15) throw new Error('removeLine.cellIndex must be integer in [0,15]');
    if (!Number.isInteger(r.lineIndex) || r.lineIndex < 0 || r.lineIndex > 19) throw new Error('removeLine.lineIndex must be integer in [0,19]');
    out.removeLine = { cellIndex: r.cellIndex, lineIndex: r.lineIndex };
  }

  // ── editLine ──
  if (args.editLine !== undefined && args.editLine !== null) {
    const e = args.editLine;
    if (typeof e !== 'object') throw new Error('editLine must be object');
    if (!Number.isInteger(e.cellIndex) || e.cellIndex < 0 || e.cellIndex > 15) throw new Error('editLine.cellIndex must be integer in [0,15]');
    if (!Number.isInteger(e.lineIndex) || e.lineIndex < 0 || e.lineIndex > 19) throw new Error('editLine.lineIndex must be integer in [0,19]');
    const lineFields = _validateLine(e, 'editLine');
    out.editLine = { cellIndex: e.cellIndex, lineIndex: e.lineIndex, ...lineFields };
  }

  // ── add 모드 backward-compat 단일 셀 시드 (cells 미지정 시 makeLaurelBlock이 cells[0]로 변환) ──
  if (mode === 'add') {
    _str('text', 500);
    _int('fontSize', 8, 400);
    _int('fontWeight', 100, 900);
    _color('textColor');
    _color('color');
    _color('leafColor');
    _int('gap', 0, 2000);
    _int('height', 20, 600);
  }

  return out;
}

// ─── canvas validator ───
// ─── canvas 옵션 검증 (add/update 공용) ─────────────────────────────────────
// mode='add'  → sectionId 허용, 모든 필드 optional (block-factory가 기본값 채움)
// mode='update' → sectionId 무시, blockId는 caller에서 처리. 빈 객체도 허용 (caller가 별도 체크).
// dual-mode: cardMode='simple'이면 cards/patchCards 경로, 미지정/'' 이면 layers/patchLayers 경로.
// 보안 가드: 색상 strict 정규식 / imgSrc length≤200000 + ["\r\n] 차단 / icon.svg <script/on*=/javascript: 차단.
function _validateCanvasOpts(args, { mode } = {}) {
  if (!args || typeof args !== 'object') throw new Error('args must be object');
  const out = {};

  const _int = (key, min, max) => {
    if (args[key] === undefined || args[key] === null) return;
    const n = args[key];
    if (!Number.isInteger(n)) throw new Error(`${key} must be integer`);
    if (min !== undefined && n < min) throw new Error(`${key} < ${min}`);
    if (max !== undefined && n > max) throw new Error(`${key} > ${max}`);
    out[key] = n;
  };
  const _num = (key, min, max) => {
    if (args[key] === undefined || args[key] === null) return;
    const n = args[key];
    if (typeof n !== 'number' || !Number.isFinite(n)) throw new Error(`${key} must be finite number`);
    if (min !== undefined && n < min) throw new Error(`${key} < ${min}`);
    if (max !== undefined && n > max) throw new Error(`${key} > ${max}`);
    out[key] = n;
  };
  const _str = (key, maxLen) => {
    if (args[key] === undefined || args[key] === null) return;
    if (typeof args[key] !== 'string') throw new Error(`${key} must be string`);
    if (maxLen !== undefined && [...args[key]].length > maxLen) {
      throw new Error(`${key} too long (>${maxLen} code points)`);
    }
    out[key] = args[key];
  };
  const _color = (key) => {
    if (args[key] === undefined || args[key] === null) return;
    if (typeof args[key] !== 'string') throw new Error(`${key} must be string`);
    const v = args[key].trim();
    if (v.length === 0) { out[key] = ''; return; }
    if (v.length > 64) throw new Error(`${key} too long`);
    const ok =
      /^#[0-9a-fA-F]{3,8}$/.test(v) ||
      /^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$/.test(v) ||
      v === 'transparent';
    if (!ok) throw new Error(`${key} invalid color (allowed: #hex | rgb(a)/hsl(a)() | transparent)`);
    out[key] = v;
  };
  const _enum = (key, allowed) => {
    if (args[key] === undefined || args[key] === null) return;
    if (!allowed.includes(args[key])) throw new Error(`invalid ${key}: ${args[key]}. allowed: ${allowed.join('|')}`);
    out[key] = args[key];
  };
  // boolean → 'true'/'false' 문자열로 통일 저장
  const _boolStr = (key) => {
    if (args[key] === undefined || args[key] === null) return;
    let v = args[key];
    if (typeof v === 'boolean') v = v ? 'true' : 'false';
    if (typeof v !== 'string' || !['true','false'].includes(v)) {
      throw new Error(`${key} must be boolean or 'true'/'false'`);
    }
    out[key] = v;
  };
  const _imgSrcCheck = (s, label) => {
    if (typeof s !== 'string') throw new Error(`${label} must be string`);
    if (s.length > 200000) throw new Error(`${label} too long (>200000)`);
    if (/["\r\n]/.test(s)) throw new Error(`${label} contains quote/newline (escape unsafe)`);
    return s;
  };
  const _isColorOk = (v) => {
    if (typeof v !== 'string') return false;
    const t = v.trim();
    if (t === '') return true; // empty allowed (means default)
    return /^#[0-9a-fA-F]{3,8}$/.test(t) || /^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$/.test(t) || t === 'transparent';
  };

  if (mode === 'add') {
    if (args.sectionId !== undefined && args.sectionId !== null) {
      if (typeof args.sectionId !== 'string' || !args.sectionId.startsWith('sec_')) {
        throw new Error(`invalid sectionId: ${args.sectionId}. expected string starting with sec_`);
      }
      out.sectionId = args.sectionId;
    }
  }

  // ── 단순 필드 ────────────────────────────────────────────────────────────
  _str('layerName', 100);
  // add 모드는 width/height 키, update 모드는 canvasW/canvasH (renderer가 그대로 dataset key 사용)
  _int('width',    100, 1200);
  _int('height',   40,  2000);
  _int('canvasW',  100, 1200);
  _int('canvasH',  40,  2000);
  _color('bg');
  _int('radius',   0, 60);
  _int('gridCols', 1, 4);
  _int('gridRows', 1, 20); // U6: 장리스트 그리드(사이즈/가격표) — cards 상한 64 내에서 행 확장
  _int('cardGap',  0, 48);
  _int('padX',     0, 80);
  _enum('cardMode', ['simple', '']);

  // Simple 모드 필드
  _int('imgRatio', 10, 90);
  _enum('imgShape', ['rect','circle']);
  _enum('labelPos', ['top','bottom','both']);
  _boolStr('textHide');
  _color('textBg');
  _int('titleSize', 4, 400);
  _int('descSize',  4, 400);
  _enum('textAlign', ['left','center','right']);
  _color('titleColor');
  _color('descColor');
  _enum('cardOrient', ['portrait','landscape']);
  _boolStr('iconMode');
  _int('iconScale', 10, 90);
  _color('iconColor');
  _color('iconBg');

  // ── cards (Simple 모드 풀 교체) ────────────────────────────────────────────
  const _validateCard = (c, ctx, requireAny) => {
    if (!c || typeof c !== 'object') throw new Error(`${ctx} must be object`);
    const o = {};
    if (c.title !== undefined && c.title !== null) {
      if (typeof c.title !== 'string') throw new Error(`${ctx}.title must be string`);
      if ([...c.title].length > 500) throw new Error(`${ctx}.title too long (>500)`);
      o.title = c.title;
    }
    if (c.desc !== undefined && c.desc !== null) {
      if (typeof c.desc !== 'string') throw new Error(`${ctx}.desc must be string`);
      if ([...c.desc].length > 500) throw new Error(`${ctx}.desc too long (>500)`);
      o.desc = c.desc;
    }
    if (c.imgSrc !== undefined && c.imgSrc !== null) {
      o.imgSrc = _imgSrcCheck(c.imgSrc, `${ctx}.imgSrc`);
    }
    if (c.imgFit !== undefined && c.imgFit !== null) {
      if (!['cover','contain'].includes(c.imgFit)) throw new Error(`${ctx}.imgFit must be cover|contain`);
      o.imgFit = c.imgFit;
    }
    if (c.imgX !== undefined && c.imgX !== null) {
      if (typeof c.imgX !== 'number' || !Number.isFinite(c.imgX) || c.imgX < 0 || c.imgX > 100) {
        throw new Error(`${ctx}.imgX must be number 0~100`);
      }
      o.imgX = c.imgX;
    }
    if (c.imgY !== undefined && c.imgY !== null) {
      if (typeof c.imgY !== 'number' || !Number.isFinite(c.imgY) || c.imgY < 0 || c.imgY > 100) {
        throw new Error(`${ctx}.imgY must be number 0~100`);
      }
      o.imgY = c.imgY;
    }
    // [APIMCP P1] imgScale (이미지 확대 100~400%) — renderer/canvas-block.js 지원, MCP 노출 누락이었음.
    if (c.imgScale !== undefined && c.imgScale !== null) {
      if (typeof c.imgScale !== 'number' || !Number.isFinite(c.imgScale) || c.imgScale < 100 || c.imgScale > 400) {
        throw new Error(`${ctx}.imgScale must be number 100~400`);
      }
      o.imgScale = c.imgScale;
    }
    if (c.cellBg !== undefined && c.cellBg !== null) {
      if (!_isColorOk(c.cellBg)) throw new Error(`${ctx}.cellBg invalid color`);
      o.cellBg = c.cellBg;
    }
    if (c.borderWidth !== undefined && c.borderWidth !== null) {
      if (!Number.isInteger(c.borderWidth) || c.borderWidth < 0 || c.borderWidth > 20) {
        throw new Error(`${ctx}.borderWidth must be integer 0~20`);
      }
      o.borderWidth = c.borderWidth;
    }
    if (c.borderColor !== undefined && c.borderColor !== null) {
      if (!_isColorOk(c.borderColor)) throw new Error(`${ctx}.borderColor invalid color`);
      o.borderColor = c.borderColor;
    }
    if (c.icon !== undefined && c.icon !== null) {
      if (typeof c.icon !== 'object') throw new Error(`${ctx}.icon must be object`);
      const ic = {};
      if (c.icon.svg !== undefined && c.icon.svg !== null) {
        if (typeof c.icon.svg !== 'string') throw new Error(`${ctx}.icon.svg must be string`);
        if (c.icon.svg.length > 20000) throw new Error(`${ctx}.icon.svg too long (>20000)`);
        if (/<script\b|on[a-z]+\s*=|javascript\s*:/i.test(c.icon.svg)) {
          throw new Error(`${ctx}.icon.svg blocked (contains <script / on*= / javascript:)`);
        }
        ic.svg = c.icon.svg;
      }
      o.icon = ic;
    }
    if (c.iconBg !== undefined && c.iconBg !== null) {
      if (!_isColorOk(c.iconBg)) throw new Error(`${ctx}.iconBg invalid color`);
      o.iconBg = c.iconBg;
    }
    if (c.iconColor !== undefined && c.iconColor !== null) {
      if (!_isColorOk(c.iconColor)) throw new Error(`${ctx}.iconColor invalid color`);
      o.iconColor = c.iconColor;
    }
    if (requireAny && Object.keys(o).length === 0) {
      throw new Error(`${ctx} has no valid fields`);
    }
    return o;
  };

  if (args.cards !== undefined && args.cards !== null) {
    if (!Array.isArray(args.cards)) throw new Error('cards must be array');
    if (args.cards.length < 1 || args.cards.length > 64) {
      throw new Error(`cards length ${args.cards.length} out of range [1,64]`);
    }
    out.cards = args.cards.map((c, i) => _validateCard(c, `cards[${i}]`, false));
  }

  if (args.patchCards !== undefined && args.patchCards !== null) {
    if (!Array.isArray(args.patchCards)) throw new Error('patchCards must be array');
    if (args.patchCards.length === 0 || args.patchCards.length > 16) {
      throw new Error(`patchCards length ${args.patchCards.length} out of range [1,16]`);
    }
    out.patchCards = args.patchCards.map((p, i) => {
      if (!p || typeof p !== 'object') throw new Error(`patchCards[${i}] must be object`);
      if (!Number.isInteger(p.index) || p.index < 0 || p.index > 63) {
        throw new Error(`patchCards[${i}].index must be integer 0~63`);
      }
      const v = _validateCard(p, `patchCards[${i}]`, true);
      return { index: p.index, ...v };
    });
  }

  // ── layers (레이어 모드 풀 교체) ───────────────────────────────────────────
  const _FW_ALLOWED = ['100','200','300','400','500','600','700','800','900','normal','bold'];
  const _validateLayer = (l, ctx, requireType) => {
    if (!l || typeof l !== 'object') throw new Error(`${ctx} must be object`);
    const o = {};
    if (l.type !== undefined && l.type !== null) {
      if (!['shape','image','text'].includes(l.type)) {
        throw new Error(`${ctx}.type must be shape|image|text`);
      }
      o.type = l.type;
    } else if (requireType) {
      throw new Error(`${ctx}.type required (shape|image|text)`);
    }
    if (l.x !== undefined && l.x !== null) {
      if (!Number.isInteger(l.x) || l.x < -4000 || l.x > 4000) throw new Error(`${ctx}.x must be integer -4000~4000`);
      o.x = l.x;
    }
    if (l.y !== undefined && l.y !== null) {
      if (!Number.isInteger(l.y) || l.y < -4000 || l.y > 4000) throw new Error(`${ctx}.y must be integer -4000~4000`);
      o.y = l.y;
    }
    if (l.w !== undefined && l.w !== null) {
      if (!Number.isInteger(l.w) || l.w < 1 || l.w > 4000) throw new Error(`${ctx}.w must be integer 1~4000`);
      o.w = l.w;
    }
    if (l.h !== undefined && l.h !== null) {
      if (!Number.isInteger(l.h) || l.h < 1 || l.h > 4000) throw new Error(`${ctx}.h must be integer 1~4000`);
      o.h = l.h;
    }
    if (l.color !== undefined && l.color !== null) {
      if (!_isColorOk(l.color)) throw new Error(`${ctx}.color invalid color`);
      o.color = l.color;
    }
    if (l.radius !== undefined && l.radius !== null) {
      if (!Number.isInteger(l.radius) || l.radius < 0 || l.radius > 400) throw new Error(`${ctx}.radius must be integer 0~400`);
      o.radius = l.radius;
    }
    if (l.src !== undefined && l.src !== null) {
      o.src = _imgSrcCheck(l.src, `${ctx}.src`);
    }
    if (l.content !== undefined && l.content !== null) {
      if (typeof l.content !== 'string') throw new Error(`${ctx}.content must be string`);
      if ([...l.content].length > 2000) throw new Error(`${ctx}.content too long (>2000)`);
      o.content = l.content;
    }
    if (l.fontSize !== undefined && l.fontSize !== null) {
      if (!Number.isInteger(l.fontSize) || l.fontSize < 4 || l.fontSize > 400) throw new Error(`${ctx}.fontSize must be integer 4~400`);
      o.fontSize = l.fontSize;
    }
    if (l.fontWeight !== undefined && l.fontWeight !== null) {
      const fw = String(l.fontWeight);
      if (!_FW_ALLOWED.includes(fw)) {
        throw new Error(`${ctx}.fontWeight must be one of ${_FW_ALLOWED.join('|')}`);
      }
      o.fontWeight = fw;
    }
    if (l.align !== undefined && l.align !== null) {
      if (!['left','center','right'].includes(l.align)) throw new Error(`${ctx}.align must be left|center|right`);
      o.align = l.align;
    }
    if (l.label !== undefined && l.label !== null) {
      if (typeof l.label !== 'string') throw new Error(`${ctx}.label must be string`);
      if ([...l.label].length > 100) throw new Error(`${ctx}.label too long (>100)`);
      o.label = l.label;
    }
    return o;
  };

  if (args.layers !== undefined && args.layers !== null) {
    if (!Array.isArray(args.layers)) throw new Error('layers must be array');
    if (args.layers.length > 64) throw new Error(`layers length ${args.layers.length} > 64`);
    out.layers = args.layers.map((l, i) => _validateLayer(l, `layers[${i}]`, true));
  }

  if (args.patchLayers !== undefined && args.patchLayers !== null) {
    if (!Array.isArray(args.patchLayers)) throw new Error('patchLayers must be array');
    if (args.patchLayers.length === 0 || args.patchLayers.length > 16) {
      throw new Error(`patchLayers length ${args.patchLayers.length} out of range [1,16]`);
    }
    out.patchLayers = args.patchLayers.map((p, i) => {
      if (!p || typeof p !== 'object') throw new Error(`patchLayers[${i}] must be object`);
      if (!Number.isInteger(p.index) || p.index < 0 || p.index > 63) {
        throw new Error(`patchLayers[${i}].index must be integer 0~63`);
      }
      const v = _validateLayer(p, `patchLayers[${i}]`, false);
      return { index: p.index, ...v };
    });
  }

  return out;
}

// ─── chat validator ───
// ─── chat 옵션 검증 (add/update 공용) ───────────────────────────────────────
// mode='add'    → sectionId 허용, 모든 필드 optional (block-factory가 기본값 채움)
// mode='update' → sectionId 무시, blockId는 caller에서 처리. 빈 객체도 허용 (caller가 별도 체크).
// banner02 _validateBanner02Opts 패턴 미러: _int/_str/_color/_enum + sub-validator (messages).
function _validateChatOpts(args, { mode } = {}) {
  if (!args || typeof args !== 'object') throw new Error('args must be object');
  const out = {};

  const _int = (key, min, max) => {
    if (args[key] === undefined || args[key] === null) return;
    const n = args[key];
    if (!Number.isInteger(n)) throw new Error(`${key} must be integer`);
    if (min !== undefined && n < min) throw new Error(`${key} < ${min}`);
    if (max !== undefined && n > max) throw new Error(`${key} > ${max}`);
    out[key] = n;
  };
  const _str = (key, maxLen) => {
    if (args[key] === undefined || args[key] === null) return;
    if (typeof args[key] !== 'string') throw new Error(`${key} must be string`);
    if (maxLen !== undefined && [...args[key]].length > maxLen) {
      throw new Error(`${key} too long (>${maxLen} code points)`);
    }
    out[key] = args[key];
  };
  const _color = (key) => {
    if (args[key] === undefined || args[key] === null) return;
    if (typeof args[key] !== 'string') throw new Error(`${key} must be string`);
    const v = args[key].trim();
    if (v.length === 0) throw new Error(`${key} empty`);
    if (v.length > 64) throw new Error(`${key} too long`);
    const ok =
      /^#[0-9a-fA-F]{3,8}$/.test(v) ||
      /^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$/.test(v) ||
      v === 'transparent';
    if (!ok) throw new Error(`${key} invalid color (allowed: #hex | rgb(a)/hsl(a)() | transparent)`);
    out[key] = v;
  };
  // showProfile/showName: '0'|'1' 또는 boolean 입력을 받아 '0'|'1'로 정규화
  const _enum01 = (key) => {
    if (args[key] === undefined || args[key] === null) return;
    const v = args[key];
    if (v === '0' || v === '1') { out[key] = v; return; }
    if (v === true || v === 1)  { out[key] = '1'; return; }
    if (v === false || v === 0) { out[key] = '0'; return; }
    throw new Error(`${key} must be '0'|'1' or boolean`);
  };
  // imgSrc-like 입력 검증 (200000자 + " 와 개행 차단)
  const _imgSrc = (val, ctx) => {
    if (typeof val !== 'string') throw new Error(`${ctx} must be string`);
    if (val.length > 200000) throw new Error(`${ctx} too long (>200000)`);
    if (/["\r\n]/.test(val)) throw new Error(`${ctx} contains quote/newline (escape unsafe)`);
    return val;
  };
  // 단일 메시지 객체 검증
  const _validateMessage = (m, ctx) => {
    if (!m || typeof m !== 'object') throw new Error(`${ctx} must be object`);
    const o = {};
    if (m.text !== undefined && m.text !== null) {
      if (typeof m.text !== 'string') throw new Error(`${ctx}.text must be string`);
      if ([...m.text].length > 2000) throw new Error(`${ctx}.text too long (>2000)`);
      o.text = m.text;
    }
    if (m.align !== undefined && m.align !== null) {
      if (m.align !== 'left' && m.align !== 'right') throw new Error(`${ctx}.align must be 'left'|'right'`);
      o.align = m.align;
    }
    if (m.hideProfile !== undefined && m.hideProfile !== null) {
      if (typeof m.hideProfile !== 'boolean') {
        // PM이 0/1 보낼 수도 있음 — 정규화
        if (m.hideProfile === 1 || m.hideProfile === '1' || m.hideProfile === 'true') o.hideProfile = true;
        else if (m.hideProfile === 0 || m.hideProfile === '0' || m.hideProfile === 'false') o.hideProfile = false;
        else throw new Error(`${ctx}.hideProfile must be boolean`);
      } else {
        o.hideProfile = m.hideProfile;
      }
    }
    if (m.profileImg !== undefined && m.profileImg !== null) {
      o.profileImg = _imgSrc(m.profileImg, `${ctx}.profileImg`);
    }
    if (m.profileName !== undefined && m.profileName !== null) {
      if (typeof m.profileName !== 'string') throw new Error(`${ctx}.profileName must be string`);
      if ([...m.profileName].length > 200) throw new Error(`${ctx}.profileName too long (>200)`);
      o.profileName = m.profileName;
    }
    return o;
  };

  // ── sectionId (add only) ──
  if (mode === 'add') {
    if (args.sectionId !== undefined && args.sectionId !== null) {
      if (typeof args.sectionId !== 'string' || !args.sectionId.startsWith('sec_')) {
        throw new Error(`invalid sectionId: ${args.sectionId}. expected string starting with sec_`);
      }
      out.sectionId = args.sectionId;
    }
  }

  // ── 공통 스타일 ──
  _str('layerName', 200);
  _int('gap', 0, 400);
  _int('fontSize', 4, 400);
  _color('bgLeft');
  _color('bgRight');
  _color('colorLeft');
  _color('colorRight');
  _int('radius', 0, 400);
  _int('padding', 0, 400);
  _enum01('showProfile');
  _enum01('showName');
  // profileSize: null 명시 허용 (update에서 reset)
  if (args.profileSize !== undefined) {
    if (args.profileSize === null) {
      if (mode !== 'update') throw new Error('profileSize null only allowed in update mode');
      out.profileSize = null;
    } else {
      if (!Number.isInteger(args.profileSize)) throw new Error('profileSize must be integer or null');
      if (args.profileSize < 24 || args.profileSize > 400) throw new Error('profileSize out of range [24,400]');
      out.profileSize = args.profileSize;
    }
  }
  _int('profileOffsetY', -400, 400);
  _int('profileGap', 0, 400);

  // ── messages (전체 교체) ──
  if (args.messages !== undefined && args.messages !== null) {
    if (!Array.isArray(args.messages)) throw new Error('messages must be array');
    if (args.messages.length < 1 || args.messages.length > 100) throw new Error('messages length must be in [1,100]');
    out.messages = args.messages.map((m, i) => _validateMessage(m, `messages[${i}]`));
  }

  // ── addMessage / removeMessage / editMessage (update only — add에선 의미 없음, 그래도 통과) ──
  if (args.addMessage !== undefined && args.addMessage !== null) {
    const v = _validateMessage(args.addMessage, 'addMessage');
    if (args.addMessage.atIndex !== undefined && args.addMessage.atIndex !== null) {
      if (!Number.isInteger(args.addMessage.atIndex) || args.addMessage.atIndex < 0 || args.addMessage.atIndex > 100) {
        throw new Error('addMessage.atIndex must be integer in [0,100]');
      }
      v.atIndex = args.addMessage.atIndex;
    }
    out.addMessage = v;
  }
  if (args.removeMessage !== undefined && args.removeMessage !== null) {
    const r = args.removeMessage;
    if (typeof r === 'number') {
      if (!Number.isInteger(r) || r < 0 || r > 100) throw new Error('removeMessage index must be integer in [0,100]');
      out.removeMessage = r;
    } else if (typeof r === 'object') {
      if (!Number.isInteger(r.index) || r.index < 0 || r.index > 100) throw new Error('removeMessage.index invalid');
      out.removeMessage = { index: r.index };
    } else {
      throw new Error('removeMessage must be number or {index}');
    }
  }
  if (args.editMessage !== undefined && args.editMessage !== null) {
    const e = args.editMessage;
    if (typeof e !== 'object') throw new Error('editMessage must be object');
    if (!Number.isInteger(e.index) || e.index < 0 || e.index > 100) throw new Error('editMessage.index must be integer in [0,100]');
    const o = _validateMessage(e, 'editMessage');
    o.index = e.index;
    out.editMessage = o;
  }

  return out;
}

// ─── gradient validator ───
// ─── gradient 옵션 검증 (add/update 공용) ──────────────────────────────────
// mode='add'    → sectionId 허용, 모든 필드 optional (block-factory가 기본값 채움)
// mode='update' → sectionId 무시, blockId는 caller에서 처리. 빈 객체도 허용 (caller가 별도 체크).
// banner02 _validateBanner02Opts 패턴 미러 — _int/_str/_enum + 색상은 strict hex6/알파는 number(0~1).
function _validateGradientOpts(args, { mode } = {}) {
  if (!args || typeof args !== 'object') throw new Error('args must be object');
  const out = {};

  const _int = (key, min, max) => {
    if (args[key] === undefined || args[key] === null) return;
    const n = args[key];
    if (!Number.isInteger(n)) throw new Error(`${key} must be integer`);
    if (min !== undefined && n < min) throw new Error(`${key} < ${min}`);
    if (max !== undefined && n > max) throw new Error(`${key} > ${max}`);
    out[key] = n;
  };
  const _str = (key, maxLen) => {
    if (args[key] === undefined || args[key] === null) return;
    if (typeof args[key] !== 'string') throw new Error(`${key} must be string`);
    if (maxLen !== undefined && [...args[key]].length > maxLen) {
      throw new Error(`${key} too long (>${maxLen} code points)`);
    }
    out[key] = args[key];
  };
  const _enum = (key, allowed) => {
    if (args[key] === undefined || args[key] === null) return;
    if (!allowed.includes(args[key])) throw new Error(`invalid ${key}: ${args[key]}. allowed: ${allowed.join('|')}`);
    out[key] = args[key];
  };
  // gradient-block의 _hexToRgba는 #RRGGBB 6자리만 안전 — rgb()/hsl()는 NaN으로 검정 fallback.
  const _hex6 = (key) => {
    if (args[key] === undefined || args[key] === null) return;
    if (typeof args[key] !== 'string') throw new Error(`${key} must be string`);
    const v = args[key].trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(v)) {
      throw new Error(`${key} must be #RRGGBB hex (6 digits). got: ${v}`);
    }
    out[key] = v;
  };
  // 0~1 float (alpha). Number.isInteger 금지 — 0.5 등 허용.
  const _alpha = (key) => {
    if (args[key] === undefined || args[key] === null) return;
    const n = Number(args[key]);
    if (!Number.isFinite(n)) throw new Error(`${key} must be number`);
    if (n < 0 || n > 1) throw new Error(`${key} out of range [0,1]`);
    out[key] = n;
  };

  if (mode === 'add') {
    if (args.sectionId !== undefined && args.sectionId !== null) {
      if (typeof args.sectionId !== 'string' || !args.sectionId.startsWith('sec_')) {
        throw new Error(`invalid sectionId: ${args.sectionId}. expected string starting with sec_`);
      }
      out.sectionId = args.sectionId;
    }
  }

  _str('layerName', 100);
  _enum('style', ['linear', 'radial']);
  _enum('direction', [
    'to bottom','to top','to right','to left',
    'to bottom right','to bottom left','to top right','to top left'
  ]);
  _hex6('startColor');
  _hex6('endColor');
  _alpha('startAlpha');
  _alpha('endAlpha');
  _int('width',  200, 1200);
  _int('height', 50,  1500);
  _int('x', -4000, 4000);
  _int('y', -4000, 4000);

  return out;
}

// ─── iconify validator ───
// ─── iconify update 옵션 검증 ───────────────────────────────────────────────
// add_iconify_block은 (sectionId, name, size, color) 인자 직접 검증하므로 별도 함수 없음.
// update는 partial이라 _validateBanner02Opts와 같은 helper 패턴으로 가드.
function _validateIconifyUpdateOpts(args) {
  if (!args || typeof args !== 'object') throw new Error('args must be object');
  const out = {};

  const _str = (key, maxLen) => {
    if (args[key] === undefined || args[key] === null) return;
    if (typeof args[key] !== 'string') throw new Error(`${key} must be string`);
    if (maxLen !== undefined && [...args[key]].length > maxLen) {
      throw new Error(`${key} too long (>${maxLen} code points)`);
    }
    out[key] = args[key];
  };
  const _int = (key, min, max) => {
    if (args[key] === undefined || args[key] === null) return;
    const n = args[key];
    if (!Number.isInteger(n)) throw new Error(`${key} must be integer`);
    if (min !== undefined && n < min) throw new Error(`${key} < ${min}`);
    if (max !== undefined && n > max) throw new Error(`${key} > ${max}`);
    out[key] = n;
  };
  const _enum = (key, allowed) => {
    if (args[key] === undefined || args[key] === null) return;
    if (!allowed.includes(args[key])) {
      throw new Error(`invalid ${key}: ${args[key]}. allowed: ${allowed.join('|')}`);
    }
    out[key] = args[key];
  };
  // banner02 _color 동일 패턴 — _validateIconifyColor 재사용 후 out에 저장
  const _color = (key) => {
    if (args[key] === undefined || args[key] === null) return;
    _validateIconifyColor(args[key]);
    out[key] = args[key].trim();
  };

  _str('layerName', 100);
  _int('size', 16, 512);
  _enum('rotation', ['0', '90', '180', '270']);
  _color('iconColor');

  // iconName: 'prefix:icon-name' 형식. prefix/name 세부 검증은 caller(handler)에서 _ICONIFY_PREFIXES + regex로 다시 수행 (fetch 직전 한 번 더 가드).
  if (args.iconName !== undefined && args.iconName !== null) {
    if (typeof args.iconName !== 'string') throw new Error('iconName must be string');
    if (args.iconName.length > 120) throw new Error('iconName too long (>120)');
    if (!args.iconName.includes(':')) throw new Error('iconName must be in "prefix:icon-name" form (e.g. "ph:house-bold")');
    out.iconName = args.iconName;
  }

  // 알 수 없는 키 차단 (오타 방지)
  const ALLOWED = new Set(['layerName', 'size', 'rotation', 'iconColor', 'iconName']);
  for (const k of Object.keys(args)) {
    if (!ALLOWED.has(k)) throw new Error(`unknown field: ${k}. allowed: ${[...ALLOWED].join('|')}`);
  }

  return out;
}

// ─── sticker validator ───
// ─── sticker 옵션 검증 (add/update 공용) ────────────────────────────────────
// banner02 패턴 미러. shape별 활성 필드가 polymorphic이지만 검증 단계에선 모든 키를 통과시키고
// renderer가 무관 키는 알아서 무시. shape이 함께 들어오면 sticker-block.js updateStickerBlock에서
// shape별 기본값 주입 로직 실행.
//   mode='add'    → sectionId 허용
//   mode='update' → sectionId 무시, blockId는 caller에서 처리. 빈 객체는 caller가 별도 체크.
const _STK_SHAPES   = ['circle','square','text','highlight','highlightB'];
const _STK_MODES    = ['text','image'];
const _STK_WEIGHTS  = ['300','400','500','600','700','800','900'];
const _STK_ALIGNS   = ['left','center','right'];
const _STK_LSTYLES  = ['line','wavy','marker'];
const _STK_FONTS    = [
  "'Pretendard', sans-serif",
  "'Noto Sans KR', sans-serif",
  "'Noto Serif KR', serif",
  "'Inter', sans-serif",
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  'sans-serif', 'serif', 'monospace',
];

function _validateStickerOpts(args, { mode } = {}) {
  if (!args || typeof args !== 'object') throw new Error('args must be object');
  const out = {};

  const _int = (key, min, max) => {
    if (args[key] === undefined || args[key] === null) return;
    const n = args[key];
    if (!Number.isInteger(n)) throw new Error(`${key} must be integer`);
    if (min !== undefined && n < min) throw new Error(`${key} < ${min}`);
    if (max !== undefined && n > max) throw new Error(`${key} > ${max}`);
    out[key] = n;
  };
  const _str = (key, maxLen) => {
    if (args[key] === undefined || args[key] === null) return;
    if (typeof args[key] !== 'string') throw new Error(`${key} must be string`);
    if (maxLen !== undefined && [...args[key]].length > maxLen) {
      throw new Error(`${key} too long (>${maxLen} code points)`);
    }
    out[key] = args[key];
  };
  const _color = (key) => {
    if (args[key] === undefined || args[key] === null) return;
    if (typeof args[key] !== 'string') throw new Error(`${key} must be string`);
    const v = args[key].trim();
    if (v.length === 0) throw new Error(`${key} empty`);
    if (v.length > 64) throw new Error(`${key} too long`);
    const ok =
      /^#[0-9a-fA-F]{3,8}$/.test(v) ||
      /^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$/.test(v) ||
      v === 'transparent';
    if (!ok) throw new Error(`${key} invalid color (allowed: #hex | rgb(a)/hsl(a)() | transparent)`);
    out[key] = v;
  };
  const _enum = (key, allowed) => {
    if (args[key] === undefined || args[key] === null) return;
    if (!allowed.includes(args[key])) throw new Error(`invalid ${key}: ${args[key]}. allowed: ${allowed.join('|')}`);
    out[key] = args[key];
  };

  if (mode === 'add') {
    if (args.sectionId !== undefined && args.sectionId !== null) {
      if (typeof args.sectionId !== 'string' || !args.sectionId.startsWith('sec_')) {
        throw new Error(`invalid sectionId: ${args.sectionId}. expected string starting with sec_`);
      }
      out.sectionId = args.sectionId;
    }
  }

  _enum('shape', _STK_SHAPES);
  _enum('mode',  _STK_MODES);
  _str('layerName', 200);

  // 공통 위치/회전
  _int('x', -4000, 4000);
  _int('y', -4000, 4000);
  _int('rotation', -180, 180);

  // circle/square 사이즈 (10~600)
  _int('size',  10, 600);
  _int('sizeW', 10, 600);
  _int('sizeH', 10, 600);

  // text 컨텐츠 + 공통 컬러/폰트
  _str('text', 500);
  _color('bgColor');
  _color('textColor');
  // fontSize 범위는 shape별로 다르지만 union 범위로 검증 (renderer가 shape별 clamp 처리)
  _int('fontSize', 6, 400);
  // fontWeight — number/string 모두 받아서 문자열 normalize
  if (args.fontWeight !== undefined && args.fontWeight !== null) {
    const fw = String(args.fontWeight);
    if (!_STK_WEIGHTS.includes(fw)) {
      throw new Error(`invalid fontWeight: ${args.fontWeight}. allowed: ${_STK_WEIGHTS.join('|')}`);
    }
    out.fontWeight = fw;
  }

  // imgSrc — banner02 패턴 (길이 + escape + prefix 가드)
  if (args.imgSrc !== undefined && args.imgSrc !== null) {
    if (typeof args.imgSrc !== 'string') throw new Error('imgSrc must be string');
    if (args.imgSrc.length > 200000) throw new Error('imgSrc too long (>200000)');
    if (/["\r\n]/.test(args.imgSrc)) throw new Error('imgSrc contains quote/newline (escape unsafe)');
    if (args.imgSrc !== '' && !/^(data:image\/|https?:\/\/|assets\/)/.test(args.imgSrc)) {
      throw new Error('imgSrc must start with data:image/, http(s)://, or assets/ (or "" to clear)');
    }
    // ★put_image 와 «같은» 검사 함수를 부른다 — 겹을 새로 만들지 않는다(지디 2026-09-07).
    //   상한(200000자)은 «양»을 막지 «구조»를 못 막는다. 잘린 PNG 는 크기와 무관하다.
    _assertImageSrcIntact(args.imgSrc, 'imgSrc');
    out.imgSrc = args.imgSrc;
  }

  // highlight (사각 형광펜)
  _int('hlW', 10, 1200);
  _int('hlH', 4, 400);
  _color('hlColor');

  // highlightB (선 형광펜)
  _int('x1', -4000, 4000); _int('y1', -4000, 4000);
  _int('x2', -4000, 4000); _int('y2', -4000, 4000);
  _int('thickness', 1, 200);
  _enum('lineStyle', _STK_LSTYLES);
  _int('amplitude', 1, 60);
  _int('period', 6, 200);

  // text shape 전용
  _enum('fontFamily', _STK_FONTS);
  _int('strokeWidth', 0, 50);
  _color('strokeColor');
  _int('letterSpacing', -10, 40);
  _enum('textAlign', _STK_ALIGNS);

  // shadowOn — boolean true/false 도 허용해서 '1'/'0' normalize (prop UI 호환)
  if (args.shadowOn !== undefined && args.shadowOn !== null) {
    if (args.shadowOn === true || args.shadowOn === '1' || args.shadowOn === 1) {
      out.shadowOn = '1';
    } else if (args.shadowOn === false || args.shadowOn === '0' || args.shadowOn === 0) {
      out.shadowOn = '0';
    } else {
      throw new Error(`invalid shadowOn: ${args.shadowOn}. allowed: "1"|"0"|true|false`);
    }
  }
  _int('shadowX', -20, 20);
  _int('shadowY', -20, 20);
  _int('shadowBlur', 0, 40);
  _color('shadowColor');
  _int('padX', 0, 400);
  _int('padY', 0, 400);

  return out;
}

// ─── vector validator ───
// ─── vector 옵션 검증 (add/update 공용) ─────────────────────────────────────
// mode='add'  → sectionId 허용, svg required (caller에서 별도 체크), label→layerName alias 매핑.
// mode='update' → sectionId 무시, blockId는 caller에서 처리. 빈 객체 허용 (caller가 별도 체크).
// banner02 _validateBanner02Opts 패턴 미러: _int/_str/_color helper.
function _validateVectorOpts(args, { mode } = {}) {
  if (!args || typeof args !== 'object') throw new Error('args must be object');
  const out = {};

  const _int = (key, min, max) => {
    if (args[key] === undefined || args[key] === null) return;
    const n = args[key];
    if (!Number.isInteger(n)) throw new Error(`${key} must be integer`);
    if (min !== undefined && n < min) throw new Error(`${key} < ${min}`);
    if (max !== undefined && n > max) throw new Error(`${key} > ${max}`);
    out[key] = n;
  };
  const _str = (key, maxLen) => {
    if (args[key] === undefined || args[key] === null) return;
    if (typeof args[key] !== 'string') throw new Error(`${key} must be string`);
    if (maxLen !== undefined && [...args[key]].length > maxLen) {
      throw new Error(`${key} too long (>${maxLen} code points)`);
    }
    out[key] = args[key];
  };
  const _color = (key) => {
    if (args[key] === undefined || args[key] === null) return;
    if (typeof args[key] !== 'string') throw new Error(`${key} must be string`);
    const v = args[key].trim();
    if (v.length === 0) throw new Error(`${key} empty`);
    if (v.length > 64) throw new Error(`${key} too long`);
    const ok =
      /^#[0-9a-fA-F]{3,8}$/.test(v) ||
      /^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$/.test(v) ||
      v === 'transparent';
    if (!ok) throw new Error(`${key} invalid color (allowed: #hex | rgb(a)/hsl(a)() | transparent)`);
    out[key] = v;
  };

  // ── sectionId (add only) ──
  if (mode === 'add') {
    if (args.sectionId !== undefined && args.sectionId !== null) {
      if (typeof args.sectionId !== 'string' || !args.sectionId.startsWith('sec_')) {
        throw new Error(`invalid sectionId: ${args.sectionId}. expected string starting with sec_`);
      }
      out.sectionId = args.sectionId;
    }
  }

  // ── svg: 길이 + <script> 가드 (banner02 imgSrc 패턴 — 단 "/CRLF 차단은 사용 안 함, SVG raw 보존) ──
  if (args.svg !== undefined && args.svg !== null) {
    if (typeof args.svg !== 'string') throw new Error('svg must be string');
    if (args.svg.length > 200000) throw new Error('svg too long (>200000)');
    if (/<script[\s>]/i.test(args.svg)) throw new Error('svg contains <script> (blocked for XSS safety)');
    out.svg = args.svg;
  }

  // ── color: fill 속성에 들어가는 문자열 — 화이트리스트 정규식 (CSS injection 차단) ──
  _color('color');

  // ── w/h: block px size ──
  _int('w', 10, 4000);
  _int('h', 10, 4000);

  // ── layerName: 레이어 패널 표시명 ──
  _str('layerName', 200);

  // ── label alias: add tool에서 사용자 친화성. dataset.layerName으로 매핑. ──
  // (update에서는 혼동 방지 위해 무시 — schema에서도 layerName만 노출)
  if (mode === 'add' && args.label !== undefined && args.label !== null && out.layerName === undefined) {
    if (typeof args.label !== 'string') throw new Error('label must be string');
    if ([...args.label].length > 200) throw new Error('label too long (>200 code points)');
    out.layerName = args.label;
  }

  return out;
}

// ─── divider validator ───
// ─── divider 옵션 검증 (add/update 공용) ────────────────────────────────────
// mode='add'    → sectionId 허용, 모든 필드 optional (block-factory가 기본값 채움)
// mode='update' → sectionId 무시, blockId는 caller에서 처리. 빈 객체도 허용 (caller가 별도 체크).
function _validateDividerOpts(args, { mode } = {}) {
  if (!args || typeof args !== 'object') throw new Error('args must be object');
  const out = {};

  const _int = (key, min, max) => {
    if (args[key] === undefined || args[key] === null) return;
    const n = args[key];
    if (!Number.isInteger(n)) throw new Error(`${key} must be integer`);
    if (min !== undefined && n < min) throw new Error(`${key} < ${min}`);
    if (max !== undefined && n > max) throw new Error(`${key} > ${max}`);
    out[key] = n;
  };
  // hex/rgb()/rgba()/hsl()/hsla()/transparent — strict. CSS injection 차단.
  const _color = (key) => {
    if (args[key] === undefined || args[key] === null) return;
    if (typeof args[key] !== 'string') throw new Error(`${key} must be string`);
    const v = args[key].trim();
    if (v.length === 0) throw new Error(`${key} empty`);
    if (v.length > 64) throw new Error(`${key} too long`);
    const ok =
      /^#[0-9a-fA-F]{3,8}$/.test(v) ||
      /^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$/.test(v) ||
      v === 'transparent';
    if (!ok) throw new Error(`${key} invalid color (allowed: #hex | rgb(a)/hsl(a)() | transparent)`);
    out[key] = v;
  };
  const _enum = (key, allowed) => {
    if (args[key] === undefined || args[key] === null) return;
    if (!allowed.includes(args[key])) throw new Error(`invalid ${key}: ${args[key]}. allowed: ${allowed.join('|')}`);
    out[key] = args[key];
  };

  if (mode === 'add') {
    if (args.sectionId !== undefined && args.sectionId !== null) {
      if (typeof args.sectionId !== 'string' || !args.sectionId.startsWith('sec_')) {
        throw new Error(`invalid sectionId: ${args.sectionId}. expected string starting with sec_`);
      }
      out.sectionId = args.sectionId;
    }
  }

  _color('lineColor');
  _enum('lineStyle', ['solid', 'dashed', 'dotted']);
  _int('lineWeight', 1, 24);
  _int('padV', 0, 120);
  _int('padH', 0, 2000);
  _enum('lineDir', ['horizontal', 'vertical']);
  _int('lineLength', 20, 400);

  return out;
}

// ─── 이미지 무결성 검사 (2026-09-07) ──────────────────────────────────────────
/* ★왜 있나 — 실측으로 생긴 함수다.
 *   클로드 데스크톱에 사진을 첨부해 「넣어줘」 하면, 모델이 자기 샌드박스에서 파일을 읽어
 *   base64 «문자열»로 만들어 도구 인자로 나른다. 그 과정에서 문자열이 «잘렸다».
 *   실측: 원본 4,849B(sha 1df744f1…) → 모델 샌드박스 4,849B «동일» →
 *        고디터 3,472B(sha a57afb24…). IHDR 이 선언한 IDAT 길이는 4,792B 였다.
 *   그런데 검사가 ⑴접두사 정규식 ⑵길이 상한 «둘뿐»이라 그대로 통과해
 *   깨진 파일이 «성공»으로 저장됐다. 「돌아가는데 결과가 손상된다」는 「효과 0」보다 나쁘다.
 *
 * ★원칙 넷:
 *  ⑴ ⛔거절이지 «수선»이 아니다 — 잘린 «그림»을 복구하려 들지 않는다.
 *     ⚠️단 «표기»의 정규화(공백/줄바꿈/패딩)는 수선이 아니라 «읽기»다. 아래 ★오탐 참조.
 *  ⑵ ⛔검사 못 하는 포맷을 막지 않는다. 「검사 못 함」을 「실패」로 만들면 되던 게 안 된다.
 *  ⑶ ★«어디까지 봤는지»를 응답에 적는다(checked). 통과가 「온전함이 증명됨」이 아닐 수 있다.
 *  ⑷ ★숫자로 말한다 — 몇 바이트 받았고 몇을 기대했나.
 *
 * ★오탐이 «구멍보다» 나쁘다 (적대검수 2026-09-07 에서 3건 잡힘):
 *   첫 판에서 ⓐ76열로 줄바꿈된 base64(파이썬 `base64.encodebytes` 기본값) ⓑ공백 섞인 base64
 *   ⓒ패딩(=) 없는 «완전한» base64 — 셋 다 디코드하면 원본과 sha256 이 «같은데» 거절했다.
 *   게다가 「잘려서 들어왔습니다, 원본을 다시 보내세요」라고 **원인을 거짓으로** 말했다.
 *   ⇒ 표기 차이는 «정규화해서 읽는다». 거절은 «바이트가 실제로 모자랄 때»만.
 *
 * ★선언 mime 을 믿지 않는다:
 *   `image/jpg`(흔한 오타) `image/x-png` `data:IMAGE/PNG` `;charset=` 같은 표기가
 *   구조 검사를 통째로 우회시켰다(적대검수). ⇒ 형식은 «매직바이트로 판정»하고,
 *   선언 mime 은 «대조용»으로만 쓴다.
 *
 * ⛔검사는 «한 곳»이다 — put_image / _validateAssetOpts / Banner02 / Sticker /
 *   IconCircle / IconText / _validateMkpImgSrc 가 «이것만» 부른다.
 */
const _IMG_SNIFF = [
  { fmt: 'png',  mime: 'image/png',  sig: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { fmt: 'jpeg', mime: 'image/jpeg', sig: [0xff, 0xd8, 0xff] },
  { fmt: 'gif',  mime: 'image/gif',  sig: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] },
  { fmt: 'gif',  mime: 'image/gif',  sig: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] },
  { fmt: 'webp', mime: 'image/webp', sig: [0x52, 0x49, 0x46, 0x46] } // RIFF … WEBP
];
// 같은 그림을 가리키는 «다른 이름»들. 오타(jpg)까지 받아 준다 — 이름 때문에 검사를 건너뛰면 안 된다.
const _MIME_ALIAS = {
  'image/jpg': 'image/jpeg', 'image/pjpeg': 'image/jpeg',
  'image/x-png': 'image/png', 'image/apng': 'image/png'
};

/* «잘림»인 사유들 — 이 목록에 있을 때만 IMAGE_TRUNCATED 다. */
const _TRUNCATION_REASONS = new Set([
  'PNG_CHUNK_TRUNCATED', 'PNG_NO_IEND', 'JPEG_NO_EOI', 'JPEG_NO_SOS',
  'JPEG_SEGMENT_TRUNCATED', 'GIF_TRUNCATED', 'WEBP_TRUNCATED',
  'EMPTY_PAYLOAD', 'DECODE_EMPTY'
]);
function _imgErr(message, detail) {
  /* ★코드를 «사유에서» 도출한다.
   *   앞 판은 사유와 무관하게 전부 `IMAGE_TRUNCATED` 를 박았다 — `BASE64URL_NOT_SUPPORTED`
   *   도, `NOT_AN_IMAGE` 도, `PNG_CRC_MISMATCH` 도 「잘렸다」로 나갔다.
   *   1판에서 잡힌 「원인을 거짓으로 말한다」가 «한 층 위로 옮겨갔을 뿐» 그대로였다
   *   (적대검수 2026-09-07). 게다가 7곳 중 5곳은 던지는 경로라 detail.reason 이 안 보이고
   *   그 «거짓 태그»만 남는다 — 모델이 읽는 게 정확히 거짓인 부분이다.
   * ★코드 이름을 문장 안에도 넣는다 — 던져진 에러는 JSON-RPC 로 납작해지며 code 를 잃는다. */
  const reason = (detail && detail.reason) || 'IMAGE_INVALID';
  const code = _TRUNCATION_REASONS.has(reason) ? 'IMAGE_TRUNCATED' : 'IMAGE_INVALID';
  const e = new Error(`[${code}:${reason}] ` + message);
  e.code = code;
  e.imageCheckError = true;   // ★디스패처가 «이것»으로 잡는다 — 코드 이름에 안 묶인다
  e.detail = detail || {};
  return e;
}
function _truncMsg(field, what, got, need, extra) {
  return `${field}: 이미지가 «잘려서» 들어왔습니다 — 저장하지 않았습니다. ${what} `
    + `받은 전체 ${got}바이트 / 최소 ${need}바이트가 필요합니다.${extra ? ' ' + extra : ''} `
    + `⛔우리가 복구하지 않습니다 — 원본을 «다시» 통째로 보내 주세요.`;
}

const _CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function _crc32(buf, from, to) {
  let crc = -1;
  for (let i = from; i < to; i++) crc = _CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

/* PNG: 청크를 걸어가며 «선언 길이 ↔ 실제 잔여»와 «CRC»를 본다.
   CRC 까지 보는 이유 — 길이 필드를 작게 위조하면 길이 대조만으로는 통과한다(적대검수에서 뚫림).
   5MB 기준 CRC32 는 수십 ms 다(§성능). 그 값으로 「잘렸는데 통과」를 없앤다. */
function _checkPng(buf, field) {
  let pos = 8, sawIHDR = false, sawIEND = false;
  while (pos + 8 <= buf.length) {
    const declared = buf.readUInt32BE(pos);
    const type = buf.toString('latin1', pos + 4, pos + 8);
    if (pos === 8 && type !== 'IHDR') {
      throw _imgErr(`${field}: PNG 의 첫 청크가 IHDR 이 아닙니다 (got "${type}") — 손상된 파일입니다.`,
        { reason: 'PNG_NO_IHDR', firstChunk: type, decodedBytes: buf.length });
    }
    if (type === 'IHDR') sawIHDR = true;
    const need = pos + 12 + declared;
    if (need > buf.length) {
      throw _imgErr(_truncMsg(field,
        `PNG 청크 "${type}"(offset ${pos})가 ${declared}바이트를 선언했는데 남은 것은 ${buf.length - (pos + 8)}바이트뿐입니다.`,
        buf.length, need),
        { reason: 'PNG_CHUNK_TRUNCATED', chunk: type, offset: pos,
          declaredChunkBytes: declared, availableBytes: buf.length - (pos + 8),
          decodedBytes: buf.length, expectedAtLeastBytes: need });
    }
    const want = buf.readUInt32BE(need - 4);
    const got = _crc32(buf, pos + 4, need - 4);
    if (want !== got) {
      throw _imgErr(
        `${field}: PNG 청크 "${type}"(offset ${pos})의 CRC 가 맞지 않습니다 — 내용이 손상됐습니다 `
        + `(선언 ${want.toString(16)} / 실제 ${got.toString(16)}, 받은 전체 ${buf.length}바이트). `
        + `⛔우리가 복구하지 않습니다 — 원본을 «다시» 통째로 보내 주세요.`,
        { reason: 'PNG_CRC_MISMATCH', chunk: type, offset: pos,
          declaredCrc: want, actualCrc: got, decodedBytes: buf.length });
    }
    pos = need;
    if (type === 'IEND') { sawIEND = true; break; }
  }
  if (!sawIHDR) {
    throw _imgErr(`${field}: PNG 에 IHDR 이 없습니다 — 손상된 파일입니다 (받은 ${buf.length}바이트).`,
      { reason: 'PNG_NO_IHDR', decodedBytes: buf.length });
  }
  if (!sawIEND) {
    throw _imgErr(_truncMsg(field, `PNG 가 IEND 로 끝나지 않습니다 (${pos}바이트에서 끊김).`, buf.length, pos + 12),
      { reason: 'PNG_NO_IEND', decodedBytes: buf.length, stoppedAt: pos });
  }
  return { trailingBytes: buf.length - pos };
}
/* ★네 포맷 «한 정책»: 포맷마다 «구조적 끝 오프셋»을 구하고, 그 뒤는 trailingBytes 로 보고만 한다.
   ⛔앞 판은 정책이 셋이었다 — PNG·WebP 는 뒤 잔여를 보고 후 통과, GIF 은 «마지막 바이트» 엄격
     비교(→ 온전한 GIF 뒤 1바이트에도 오탐), JPEG 은 lastIndexOf(→ 잘린 카메라 사진이 뚫림).
     **구멍과 오탐이 «같은 원인(정책 불일치)»에서 동시에 나왔다**(적대검수 2026-09-07). */
function _checkJpeg(buf, field) {
  /* ★EOI 를 «SOS 이후»에서만 찾는다.
   * 폰 사진은 사실상 전부 APP1(Exif) 안에 «썸네일 JPEG»을 품고 그 썸네일도 자기 EOI 를 갖는다.
   * 앞 판의 lastIndexOf(ff d9) 는 본체가 스캔 도중 잘려도 «썸네일의 EOI»를 찾아 통과시켰다
   * (실측: 11,144B 카메라 JPEG 을 60% 에서 자른 6,686B 가 ok:true, trailingBytes 6,359).
   * 내가 오탐(EOI 뒤 trailer 실존)을 피하려 넣은 완화가 «정확히 그 방어축»을 무력화했고,
   * ★이 판이 막으려는 사고(클로드앱 첨부 절단)의 «가장 흔한» 형태가 바로 폰 사진이다.
   * ⇒ 세그먼트를 선언 길이로 걸어 SOS 까지 간다 — APP1 은 통째로 건너뛰므로 썸네일이 안 보인다.
   *   진짜 trailer 는 EOI 뒤에 남고 그건 trailingBytes 로 보고만 한다(오탐 없음). */
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) {
    throw _imgErr(`${field}: JPEG 이 SOI(ff d8)로 시작하지 않습니다 (받은 ${buf.length}바이트).`,
      { reason: 'JPEG_NO_SOI', decodedBytes: buf.length });
  }
  let i = 2, sos = -1;
  while (i + 3 < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    if (marker === 0xff) { i++; continue; }                                   // 채움 바이트
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { i += 2; continue; }
    if (marker === 0xd9) break;                                               // 스캔 «전» EOI = 잘린 것
    const segLen = buf.readUInt16BE(i + 2);                                   // 길이는 자기 2바이트 포함
    if (segLen < 2 || i + 2 + segLen > buf.length) {
      throw _imgErr(_truncMsg(field,
        `JPEG 세그먼트 ff${marker.toString(16)}(offset ${i})가 ${segLen}바이트를 선언했는데 남은 것은 ${buf.length - (i + 2)}바이트뿐입니다.`,
        buf.length, i + 2 + segLen),
        { reason: 'JPEG_SEGMENT_TRUNCATED', marker: 'ff' + marker.toString(16), offset: i,
          declaredSegmentBytes: segLen, decodedBytes: buf.length, expectedAtLeastBytes: i + 2 + segLen });
    }
    if (marker === 0xda) { sos = i; i = i + 2 + segLen; break; }               // SOS — 뒤는 엔트로피 데이터
    i = i + 2 + segLen;
  }
  if (sos < 0) {
    throw _imgErr(_truncMsg(field,
      'JPEG 이 SOS(ff da, 스캔 시작)에 «닿기 전»에 끝났습니다 — 헤더만 있고 그림 데이터가 없습니다.',
      buf.length, buf.length + 2),
      { reason: 'JPEG_NO_SOS', decodedBytes: buf.length });
  }
  const at = buf.indexOf(Buffer.from([0xff, 0xd9]), i);   // ★썸네일 EOI 는 SOS 앞이라 안 걸린다
  if (at < 0) {
    const tail = Array.from(buf.slice(Math.max(0, buf.length - 4)))
      .map(b => b.toString(16).padStart(2, '0')).join(' ');
    throw _imgErr(_truncMsg(field,
      `JPEG 스캔 데이터가 EOI(ff d9) 없이 끝났습니다 — 끝 4바이트가 [${tail}] (SOS 는 offset ${sos}).`,
      buf.length, buf.length + 2),
      { reason: 'JPEG_NO_EOI', decodedBytes: buf.length, sosOffset: sos, lastBytesHex: tail });
  }
  return { trailingBytes: buf.length - (at + 2) };
}
/* GIF: 블록을 «걸어서» trailer(0x3b) «위치»를 구한다 — 마지막 바이트를 엄격 비교하지 않는다. */
function _checkGif(buf, field) {
  const need = (n, what) => {
    if (n > buf.length) {
      throw _imgErr(_truncMsg(field, `GIF ${what} 를 읽으려면 ${n}바이트가 필요합니다.`, buf.length, n),
        { reason: 'GIF_TRUNCATED', at: what, decodedBytes: buf.length, expectedAtLeastBytes: n });
    }
  };
  need(13, '헤더+화면기술자');
  let i = 13;
  if (buf[10] & 0x80) { const gct = 3 * (1 << ((buf[10] & 7) + 1)); need(i + gct, '전역 색상표'); i += gct; }
  const subBlocks = () => {                    // 길이 접두 하위블록 — 0 이 끝
    for (;;) { need(i + 1, '하위블록 길이'); const n = buf[i]; i += 1; if (n === 0) return; need(i + n, '하위블록'); i += n; }
  };
  for (;;) {
    need(i + 1, '블록 표식');
    const b = buf[i];
    if (b === 0x3b) return { trailingBytes: buf.length - (i + 1) };            // ★구조적 끝
    if (b === 0x21) { need(i + 2, '확장 헤더'); i += 2; subBlocks(); continue; }
    if (b === 0x2c) {
      need(i + 10, '이미지 기술자'); const f = buf[i + 9]; i += 10;
      if (f & 0x80) { const lct = 3 * (1 << ((f & 7) + 1)); need(i + lct, '지역 색상표'); i += lct; }
      need(i + 1, 'LZW 최소코드'); i += 1; subBlocks(); continue;
    }
    throw _imgErr(`${field}: GIF 에 알 수 없는 블록 표식 0x${b.toString(16)} 가 offset ${i} 에 있습니다 — 손상된 파일입니다 (받은 ${buf.length}바이트).`,
      { reason: 'GIF_BAD_BLOCK', marker: '0x' + b.toString(16), offset: i, decodedBytes: buf.length });
  }
}
/* WebP 는 RIFF 헤더 4~8바이트가 «그 뒤 전체 길이»를 선언한다 — 잘리면 그 숫자가 안 맞는다. */
function _checkWebp(buf, field) {
  /* ⚠️앞의 `length < 12` 는 «증명 가능하게 잉여»다 — 길이가 11 이하면 toString(8,12) 가
     최대 3글자라 'WEBP'(4글자)와 절대 같을 수 없어 두 번째 조건이 «항상» 잡는다.
     ⇒ 이 줄을 11 로 옮기는 변이는 «어떤 입력으로도» 못 죽인다(적대검수 L22, 실측으로 확인).
     읽기 좋으라고 남겨 두는 것이지 «검사»가 아니다 — 여기에 테스트를 붙이려 애쓰지 마라. */
  if (buf.length < 12 || buf.toString('latin1', 8, 12) !== 'WEBP') {
    throw _imgErr(`${field}: RIFF 컨테이너인데 WEBP 가 아닙니다 (받은 ${buf.length}바이트).`,
      { reason: 'WEBP_BAD_CONTAINER', decodedBytes: buf.length });
  }
  const declared = buf.readUInt32LE(4);
  const need = declared + 8;
  if (buf.length < need) {
    throw _imgErr(_truncMsg(field,
      `WebP RIFF 헤더가 전체 ${need}바이트를 선언했습니다.`, buf.length, need),
      { reason: 'WEBP_TRUNCATED', declaredTotalBytes: need, decodedBytes: buf.length });
  }
  return { trailingBytes: buf.length - need };
}

/* src 가 data:image/* dataURL 일 때만 «온전한가»를 본다.
   http(s)/assets//blob: 등 우리가 바이트를 안 가진 것은 검사 대상이 아니다 — 그대로 통과. */
/* ★소비자들이 «전부 온전히» 읽는 형태인가 — 하나의 정규식이 판정한다.
 *
 * ⛔앞 판은 «금지할 것을 열거»했다: 대소문자 · 파라미터 · base64 안의 공백…
 *   그래서 «내가 안 떠올린 것»은 통째로 샜다. 적대검수가 그 목록을 그대로 보여줬다(2026-09-07):
 *     · 빈 서브타입 `data:image/;`      · 밑줄 서브타입 `data:image/x_y;`
 *     · mime «안»의 공백 `data:image/png ;`  · base64 «중간»의 `=`
 *     · ★`^` 앵커 «밖» — 앞에 공백 한 칸(`" data:image/png;base64,…"`)이면 검사를 «아예 안 했다»
 *   전부 externalizer 가 못 읽거나 부분 매치해서 «저장 시 파손»되는 것들이었다.
 * ⇒ 열거를 그만둔다. 판정은 «소비자의 패턴»으로 통째로 한다.
 *   - `^…$` 양끝 앵커      : 앞뒤에 뭐가 붙으면 통과 못 한다
 *   - 서브타입 문자집합     : externalizer 의 `[a-zA-Z0-9.+-]+` «그대로»(빈 것도 불가)
 *   - base64 는 `=` 를 «꼬리에만»
 *   실측으로 12케이스 전부 externalizer 판정과 일치했고, `image/svg+xml`·`image/vnd.ms-photo`·
 *   패딩 생략 같은 «되던 것»은 그대로 통과한다(좁히다 되던 걸 막는 게 이 판의 상습 실수였다).
 * ★분류(_diagnoseUnstorable)는 «메시지용»일 뿐이다 — 판정은 이 정규식 «하나»가 한다. */
const _STORABLE_RE = /^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/]+={0,2}$/;

/** 왜 못 쓰는지 «말해 주기» 위한 분류. ⛔여기서 통과/거절을 정하지 않는다. */
function _diagnoseUnstorable(src, field) {
  const why = (reason, what) => _imgErr(
    `${field}: ${what} 브라우저는 읽을 수 있어도 «저장 단계»의 에셋 외부화가 이 형태를 `
    + '온전히 못 읽어 이미지가 깨지거나 base64 가 프로젝트 파일에 통째로 박힙니다. '
    + '⛔우리가 고쳐 쓰지 않습니다 — `data:image/<타입>;base64,<공백 없는 base64>` 로 다시 주세요.',
    { reason });
  if (src !== src.trim()) return why('SRC_HAS_SURROUNDING_WHITESPACE', 'dataURL 앞뒤에 공백이 있습니다.');
  const head = /^data:([^;,]*)((?:;[^;,]*)*);base64,([\s\S]*)$/i.exec(src);
  if (!head) return why('SRC_NOT_A_DATA_URL', 'dataURL 모양이 아닙니다(`;base64,` 를 못 찾았습니다).');
  const [, type, params, body] = head;
  if (params) return why('MIME_PARAMS_NOT_STORABLE', `dataURL 에 부가 파라미터(${params})가 있습니다.`);
  if (!/^data:image\//.test(src)) return why('MIME_CASE_NOT_STORABLE', '앞부분이 소문자 «data:image/» 가 아닙니다.');
  const sub = type.slice('image/'.length);
  if (!/^[a-zA-Z0-9.+-]+$/.test(sub)) {
    return why('MIME_SUBTYPE_NOT_STORABLE',
      sub === '' ? '이미지 종류(서브타입)가 비어 있습니다.' : `이미지 종류 «${sub}» 에 쓸 수 없는 글자가 있습니다.`);
  }
  const ws = /\s/.exec(body);
  if (ws) return why('BASE64_WHITESPACE_NOT_STORABLE', `base64 안(위치 ${ws.index})에 공백/줄바꿈이 있습니다.`);
  const url = /[-_]/.exec(body);
  if (url) return _imgErr(
    `${field}: base64 에 «${url[0]}» 가 있습니다(위치 ${url.index}). base64url(-, _) 표기는 표준 base64 가 `
    + '아니라 브라우저의 data URL 파서도, 저장 단계도 «거부»합니다 — 바이트가 온전해도 못 씁니다. '
    + '표준 base64(+, /)로 다시 주세요. ⛔우리가 고쳐 쓰지 않습니다.',
    { reason: 'BASE64URL_NOT_SUPPORTED', badChar: url[0], atIndex: url.index });
  /* ⚠️순서 주의 — «알파벳 밖 글자»를 «패딩 위치»보다 «먼저» 본다.
     `…!…==` 처럼 둘이 겹치면 패딩 검사가 먼저 걸려 「패딩이 잘못됐다」고 «틀린 사유»를 말한다.
     사유를 정확히 말하는 게 이 판의 규약이라 순서가 곧 정확성이다(실측으로 잡았다). */
  const bad = /[^A-Za-z0-9+/=]/.exec(body);
  if (bad) return _imgErr(
    `${field}: base64 에 알파벳 밖 글자 «${bad[0]}» 가 있습니다(위치 ${bad.index}) — 전송 중 섞여 들어간 것으로 `
    + '봅니다. 원본을 «다시» 통째로 보내 주세요. ⛔우리가 고쳐 쓰지 않습니다.',
    { reason: 'BASE64_BAD_CHARS', badChar: bad[0], atIndex: bad.index });
  const eq = body.indexOf('=');
  if (eq >= 0 && !/^[A-Za-z0-9+/]+={1,2}$/.test(body)) {
    return why('BASE64_PADDING_MISPLACED', `base64 «중간»(위치 ${eq})에 «=» 가 있습니다 — 패딩은 끝에만 올 수 있습니다.`);
  }
  if (!body) return _imgErr(`${field}: dataURL 에 base64 본문이 없습니다 (0바이트).`,
    { reason: 'EMPTY_PAYLOAD', base64Chars: 0, decodedBytes: 0 });
  return why('SRC_NOT_STORABLE', '저장 소비자가 읽을 수 있는 형태가 아닙니다.');
}

function _assertImageSrcIntact(src, field = 'image') {
  if (typeof src !== 'string' || !src) return { checked: 'skipped:not-a-string' };
  /* ★들어오는 문은 «느슨하게», 통과하는 문은 «엄격하게».
     느슨한 쪽이 엄격하면 앵커·대소문자로 빠져나가 검사를 «아예 안 받는다»(적대검수 실측). */
  /* ⚠️슬래시를 «안» 요구한다 — `data:imageX/…` 같은 것도 «들어와서» 아래 엄격 게이트에 걸려야 한다.
     슬래시를 요구하면 그런 것이 skipped 로 빠져나간다(적대검수 변이 L13 이 이 자리를 짚었다). */
  if (!/^\s*data:image/i.test(src)) return { checked: 'skipped:not-a-data-url' };
  /* ★`;base64,` 가 «없는» data URL(비base64 인라인 SVG 등)은 «검사 대상이 아니다».
   *   ⛔앞 판은 이걸 `SRC_NOT_A_DATA_URL` 로 «거절»했다 — 새 오탐이었다(적대검수 2026-09-07).
   *   근거 셋: ⑴externalizer 가 그 형태를 «일부러» 제외한다(`externalizer.js:24` 주석:
   *     「비base64 인라인 SVG 는 … 보통 작은 아이콘이라 bloat 원인이 아니므로 외부화 대상에서 제외」)
   *     ⇒ 매치 안 되는 게 «실패»가 아니라 «설계»다. 둘을 구별 못 하면 설계를 결함으로 읽는다.
   *     ⑵브라우저는 읽는다 ⑶베이스라인(`6dc2385`)에서 통과하던 형태다 ⇒ 「되던 게 안 된다」.
   *   ⚠️우리는 base64 «바이트»의 온전함을 재는 검사다. base64 가 없으면 잴 것이 없다 —
   *     「못 읽는다」가 아니라 「검사 대상이 아니다」가 사실에 맞는 말이다. */
  if (!/;base64,/i.test(src)) return { checked: 'skipped:not-base64-data-url' };
  if (!_STORABLE_RE.test(src)) throw _diagnoseUnstorable(src, field);

  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/.exec(src);
  const declaredRaw = m[1];
  const declared = _MIME_ALIAS[declaredRaw] || declaredRaw;
  const b64 = m[2];
  const buf = Buffer.from(b64, 'base64');
  if (buf.length === 0) {
    throw _imgErr(`${field}: base64 를 디코드했더니 0바이트입니다 (${b64.length}자).`,
      { reason: 'DECODE_EMPTY', base64Chars: b64.length, decodedBytes: 0 });
  }

  // ⑵ 형식은 «매직바이트로 판정»한다. 선언 mime 은 대조용일 뿐이다.
  const sniffed = _IMG_SNIFF.find(e => e.sig.every((b, i) => buf[i] === b)) || null;
  const knownDeclared = _IMG_SNIFF.some(e => e.mime === declared);
  /* ★「선언한 형식 ≠ 실제 내용」은 «거절하지 않는다»(지디 2026-09-07 결정, 첫 지시를 뒤집음).
   *   근거: 우리가 막으려는 건 「캔버스에 깨진 바이트가 들어가는 것」이지 「라벨이 틀린 것」이 아니다.
   *   그림이 멀쩡하면 사고가 아니고, 그 라벨은 «모델이» 붙였으므로 사용자는 손쓸 데가 없다.
   *   오탐 3종(줄바꿈·공백·패딩)과 «같은 부류»다 — 바이트는 온전한데 표기가 다르다.
   *   ⇒ 통과시키되 declaredMime/actualFormat 을 «둘 다» 기록한다.
   *   ⛔dataURL 을 우리가 고쳐 쓰지 않는다 — 그건 수선이다. */
  if (!sniffed) {
    if (knownDeclared) {
      // 「png 라고 했는데 내용이 아예 png 가 아니다」 — 이건 라벨 문제가 아니라 «그림이 아님»이다.
      const got = Array.from(buf.slice(0, Math.min(8, buf.length)))
        .map(b => b.toString(16).padStart(2, '0')).join(' ');
      throw _imgErr(
        `${field}: ${declaredRaw} 라고 선언했는데 내용이 그 형식이 아닙니다 — 앞 바이트 [${got}] `
        + `(받은 ${buf.length}바이트). 표기가 아니라 «내용»이 이미지가 아닙니다.`,
        { reason: 'NOT_AN_IMAGE', declaredMime: declaredRaw, firstBytesHex: got, decodedBytes: buf.length });
    }
    // 모르는 형식(svg+xml·avif 등)은 «막지 않는다». 어디까지 봤는지만 적는다.
    return { checked: 'decode-only', format: declaredRaw, bytes: buf.length,
             note: `내용이 아는 형식(png/jpeg/gif/webp)이 아니어서 디코드까지만 확인했습니다.` };
  }

  // ⑶ 구조 검사 — «판정된» 형식으로. 선언 mime 의 오타(image/jpg 등)로 건너뛰지 않는다.
  let extra;
  switch (sniffed.fmt) {
    case 'png':  extra = _checkPng(buf, field);  break;
    case 'jpeg': extra = _checkJpeg(buf, field); break;
    case 'gif':  extra = _checkGif(buf, field);  break;
    case 'webp': extra = _checkWebp(buf, field); break;
  }
  const out = { checked: `${sniffed.fmt}-structure`, actualFormat: sniffed.mime,
                format: sniffed.mime, bytes: buf.length, ...extra };
  if (declaredRaw !== sniffed.mime) {
    out.declaredMime = declaredRaw;
    out.note = `선언은 ${declaredRaw} 인데 내용은 ${sniffed.mime} 입니다 — 내용 기준으로 검사했고 `
      + `dataURL 은 «받은 그대로» 저장합니다(우리가 고쳐 쓰지 않습니다).`;
  }
  return out;
}

// ─── asset-block validator ───
// ─── asset 옵션 검증 (update only — add는 별도 add_asset_block에서 직접 검증) ──
// banner02 _validateBanner02Opts 패턴 미러. update 모드 전용 (sectionId 검증 없음).
function _validateAssetOpts(args, { mode, report } = {}) {
  if (!args || typeof args !== 'object') throw new Error('args must be object');
  const out = {};

  const _int = (key, min, max) => {
    if (args[key] === undefined || args[key] === null) return;
    const n = args[key];
    if (!Number.isInteger(n)) throw new Error(`${key} must be integer`);
    if (min !== undefined && n < min) throw new Error(`${key} < ${min}`);
    if (max !== undefined && n > max) throw new Error(`${key} > ${max}`);
    out[key] = n;
  };
  const _str = (key, maxLen) => {
    if (args[key] === undefined || args[key] === null) return;
    if (typeof args[key] !== 'string') throw new Error(`${key} must be string`);
    if (maxLen !== undefined && [...args[key]].length > maxLen) {
      throw new Error(`${key} too long (>${maxLen} code points)`);
    }
    out[key] = args[key];
  };
  // hex/rgb()/rgba()/hsl()/hsla()/transparent — strict. CSS injection 차단.
  // 단 bgColor는 "" 빈문자열로 reset 의도를 허용 (별도 처리).
  const _color = (key, { allowEmpty = false } = {}) => {
    if (args[key] === undefined || args[key] === null) return;
    if (typeof args[key] !== 'string') throw new Error(`${key} must be string`);
    if (allowEmpty && args[key] === '') { out[key] = ''; return; }
    const v = args[key].trim();
    if (v.length === 0) throw new Error(`${key} empty`);
    if (v.length > 64) throw new Error(`${key} too long`);
    const ok =
      /^#[0-9a-fA-F]{3,8}$/.test(v) ||
      /^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$/.test(v) ||
      v === 'transparent';
    if (!ok) throw new Error(`${key} invalid color (allowed: #hex | rgb(a)/hsl(a)() | transparent)`);
    out[key] = v;
  };
  const _enum = (key, allowed) => {
    if (args[key] === undefined || args[key] === null) return;
    if (!allowed.includes(args[key])) throw new Error(`invalid ${key}: ${args[key]}. allowed: ${allowed.join('|')}`);
    out[key] = args[key];
  };

  _int('width', 100, 860);
  _int('height', 200, 1600);
  _int('borderRadius', 0, 120);
  _enum('align', ['left', 'center', 'right']);
  _enum('usePadx', ['true', 'false']);
  _enum('fit', ['cover', 'contain']);
  _color('bgColor', { allowEmpty: true });
  _enum('overlay', ['true', 'false']);
  _int('overlayOpacity', 0, 100);
  _enum('overlayPosition', ['flex-start', 'center', 'flex-end']);
  _enum('preset', ['logo', 'none']);
  _str('layerName', 80);

  // imgSrc — "" 빈문자열은 명시적 clear 의도이므로 허용
  if (args.imgSrc !== undefined && args.imgSrc !== null) {
    if (typeof args.imgSrc !== 'string') throw new Error('imgSrc must be string');
    if (args.imgSrc.length > 200000) throw new Error('imgSrc too long (>200000)');
    if (/["\r\n]/.test(args.imgSrc)) throw new Error('imgSrc contains quote/newline (escape unsafe)');
    // ★put_image 와 «같은» 검사를 탄다 — 검사가 한 곳이어야 옆 필드를 안 빠뜨린다(지디 2026-09-07).
    //   이 한 줄이 update_asset_block 과 update_block(ab_, imgSrc) «둘 다»를 덮는다
    //   (통합 update_block 은 ab_ 접두를 보고 update_asset_block 으로 디스패치한다).
    //   ★결과를 «버리지 않는다» — 호출자에게 「어디까지 봤는지」를 알려야 원칙 ⑶이 절반만 지켜지지 않는다.
    const _c = _assertImageSrcIntact(args.imgSrc, 'imgSrc');
    if (report) report.imageCheck = _c;
    out.imgSrc = args.imgSrc;
  }

  // scratchId — imgSrc의 200000자 캡을 우회하는 대용량 교체 경로(add_asset_block과 동일 패턴).
  // sp_xxx만 IPC를 타고, 실제 src는 renderer가 자기 IndexedDB에서 직접 읽는다.
  if (args.scratchId !== undefined && args.scratchId !== null) {
    if (typeof args.scratchId !== 'string' || !args.scratchId.startsWith('sp_')) {
      throw new Error(`invalid scratchId: ${args.scratchId}. expected string starting with sp_`);
    }
    if (args.imgSrc !== undefined && args.imgSrc !== null) {
      throw new Error('imgSrc and scratchId are mutually exclusive');
    }
    out.scratchId = args.scratchId;
  }

  return out;
}

// ─── table validator ───
// ─── table 옵션 검증 (update 전용; add는 기존 add_table_block 인라인 검증 유지) ─
// banner02 _validateBanner02Opts 패턴 미러. 모든 필드 optional, strict.
function _validateTableOpts(args, { mode } = {}) {
  if (!args || typeof args !== 'object') throw new Error('args must be object');
  const out = {};

  const _int = (key, min, max) => {
    if (args[key] === undefined || args[key] === null) return;
    const n = args[key];
    if (!Number.isInteger(n)) throw new Error(`${key} must be integer`);
    if (min !== undefined && n < min) throw new Error(`${key} < ${min}`);
    if (max !== undefined && n > max) throw new Error(`${key} > ${max}`);
    out[key] = n;
  };
  const _bool = (key) => {
    if (args[key] === undefined || args[key] === null) return;
    if (typeof args[key] !== 'boolean') throw new Error(`${key} must be boolean`);
    out[key] = args[key];
  };
  const _color = (key) => {
    if (args[key] === undefined || args[key] === null) return;
    if (typeof args[key] !== 'string') throw new Error(`${key} must be string`);
    const v = args[key].trim();
    if (v.length === 0) throw new Error(`${key} empty`);
    if (v.length > 64) throw new Error(`${key} too long`);
    const ok =
      /^#[0-9a-fA-F]{3,8}$/.test(v) ||
      /^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$/.test(v) ||
      v === 'transparent';
    if (!ok) throw new Error(`${key} invalid color (allowed: #hex | rgb(a)/hsl(a)() | transparent)`);
    out[key] = v;
  };
  const _enum = (key, allowed) => {
    if (args[key] === undefined || args[key] === null) return;
    if (!allowed.includes(args[key])) throw new Error(`invalid ${key}: ${args[key]}. allowed: ${allowed.join('|')}`);
    out[key] = args[key];
  };
  const _str = (key, maxLen) => {
    if (args[key] === undefined || args[key] === null) return;
    if (typeof args[key] !== 'string') throw new Error(`${key} must be string`);
    if (maxLen !== undefined && [...args[key]].length > maxLen) {
      throw new Error(`${key} too long (>${maxLen} code points)`);
    }
    out[key] = args[key];
  };

  // ── 데이터 ────────────────────────────────────────────────────────────────
  if (args.headers !== undefined && args.headers !== null) {
    if (!Array.isArray(args.headers)) throw new Error('headers must be array of strings');
    if (args.headers.length === 0) throw new Error('headers must have at least 1 item');
    if (args.headers.length > 32) throw new Error('headers too many (>32)');
    for (let i = 0; i < args.headers.length; i++) {
      if (typeof args.headers[i] !== 'string') throw new Error(`headers[${i}] must be string`);
      if ([...args.headers[i]].length > 2000) throw new Error(`headers[${i}] too long (>2000)`);
    }
    out.headers = args.headers.slice();
  }
  if (args.rows !== undefined && args.rows !== null) {
    if (!Array.isArray(args.rows)) throw new Error('rows must be array of arrays');
    if (args.rows.length > 500) throw new Error('rows too many (>500)');
    // 내부 length 일치 검증 + headers와 일치(동시 갱신 시) — renderer에서도 다시 검증하지만 fail-fast
    for (let i = 0; i < args.rows.length; i++) {
      const r = args.rows[i];
      if (!Array.isArray(r)) throw new Error(`rows[${i}] must be array`);
      for (let j = 0; j < r.length; j++) {
        if (typeof r[j] !== 'string') throw new Error(`rows[${i}][${j}] must be string`);
        if ([...r[j]].length > 2000) throw new Error(`rows[${i}][${j}] too long (>2000)`);
      }
    }
    if (out.headers) {
      const cols = out.headers.length;
      const mismatch = args.rows.findIndex(r => r.length !== cols);
      if (mismatch !== -1) throw new Error(`row ${mismatch} length ${args.rows[mismatch].length} != headers ${cols}`);
    } else if (args.rows.length > 1) {
      // headers 없는 단독 rows 갱신: 모든 row가 동일 length여야 함 (실제 colCount 일치는 renderer가 검증)
      const w = args.rows[0].length;
      const mismatch = args.rows.findIndex(r => r.length !== w);
      if (mismatch !== -1) throw new Error(`row ${mismatch} length ${args.rows[mismatch].length} != row 0 ${w}`);
    }
    out.rows = args.rows.map(r => r.slice());
  }

  // ── dataset 스칼라 ────────────────────────────────────────────────────────
  _enum('style',     ['default', 'stripe', 'borderless', 'colored']);
  _enum('cellAlign', ['left', 'center', 'right']);
  _int('cellPad',    0,   40);
  _bool('showHeader');
  _bool('showVLines');
  _bool('showHLines');
  _bool('showOuterX');
  _bool('showOuterY');
  _int('outerWidth', 1,   6);
  _int('rowH',       0,   160);
  _int('tablePadX',  0,   120);
  // [APIMCP P1] headerSize (헤더 글자 크기 px, 0=본문 fontSize 상속) — renderer 지원, MCP 노출 누락이었음.
  _int('headerSize', 0,   60);
  _color('lineColor');
  _color('headerBg');
  _color('textColor');
  _enum('fontFamily', [
    '',
    "'Pretendard', sans-serif",
    "'Noto Sans KR', sans-serif",
    "'Spoqa Han Sans Neo', sans-serif",
    "'Inter', sans-serif",
    "'Roboto', sans-serif",
    "'Helvetica Neue', sans-serif",
    'Georgia, serif',
    "'Times New Roman', serif",
    'monospace',
  ]);
  _int('fontSize',   12,  60);
  _str('colWidths',  200);

  // ── colBgs / colFgs (string[] 또는 "a,b,c") ───────────────────────────────
  const _COLOR_RE = /^#[0-9a-fA-F]{3,8}$|^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$|^transparent$/;
  const _normColorList = (v, label) => {
    let arr;
    if (Array.isArray(v)) arr = v.slice();
    else if (typeof v === 'string') {
      if (v.length > 1024) throw new Error(`${label} too long`);
      arr = v.split(',').map(s => s.trim()).filter(Boolean);
    } else {
      throw new Error(`${label} must be array of strings or comma-joined string`);
    }
    if (arr.length > 32) throw new Error(`${label} too many (>32)`);
    for (let i = 0; i < arr.length; i++) {
      if (typeof arr[i] !== 'string') throw new Error(`${label}[${i}] must be string`);
      const s = arr[i].trim();
      if (s.length === 0) throw new Error(`${label}[${i}] empty`);
      if (s.length > 64) throw new Error(`${label}[${i}] too long`);
      if (!_COLOR_RE.test(s)) throw new Error(`${label}[${i}] invalid color: ${arr[i]}`);
      arr[i] = s;
    }
    return arr;
  };
  if (args.colBgs !== undefined && args.colBgs !== null) {
    out.colBgs = _normColorList(args.colBgs, 'colBgs');
  }
  if (args.colFgs !== undefined && args.colFgs !== null) {
    out.colFgs = _normColorList(args.colFgs, 'colFgs');
  }

  // ── mergedHeaderCols (헤더 가로 병합 v1) ─────────────────────────────────
  // 정식 shape: [[startColIdx, span], ...] (0-base, span>=2).
  // 수용 입력: (a) [[s,n],...] 배열, (b) JSON 문자열, (c) null/"" → clear.
  // colCount 검증은 renderer 측에서 (현 colCount를 알아야 하기 때문). 여기서는 형식·범위·겹침만.
  if (args.mergedHeaderCols !== undefined) {
    let raw = args.mergedHeaderCols;
    if (raw === null || raw === '') {
      out.mergedHeaderCols = [];
    } else {
      if (typeof raw === 'string') {
        if (raw.length > 1024) throw new Error('mergedHeaderCols string too long (>1024)');
        try { raw = JSON.parse(raw); }
        catch (e) { throw new Error(`mergedHeaderCols JSON parse failed: ${e.message}`); }
      }
      if (!Array.isArray(raw)) throw new Error('mergedHeaderCols must be array or JSON string');
      if (raw.length > 32) throw new Error('mergedHeaderCols too many (>32)');
      const norm = [];
      for (let i = 0; i < raw.length; i++) {
        const it = raw[i];
        if (!Array.isArray(it) || it.length < 2) {
          throw new Error(`mergedHeaderCols[${i}] must be [start, span]`);
        }
        const s = it[0], n = it[1];
        if (!Number.isInteger(s)) throw new Error(`mergedHeaderCols[${i}].start must be integer`);
        if (!Number.isInteger(n)) throw new Error(`mergedHeaderCols[${i}].span must be integer`);
        if (s < 0) throw new Error(`mergedHeaderCols[${i}].start < 0`);
        if (n < 2) continue; // span<2는 병합 아님 → 무시
        if (n > 32) throw new Error(`mergedHeaderCols[${i}].span > 32`);
        norm.push([s, n]);
      }
      norm.sort((a, b) => a[0] - b[0]);
      for (let i = 1; i < norm.length; i++) {
        if (norm[i - 1][0] + norm[i - 1][1] > norm[i][0]) {
          throw new Error(`mergedHeaderCols overlap at [${norm[i - 1][0]},${norm[i - 1][1]}] vs [${norm[i][0]},${norm[i][1]}]`);
        }
      }
      out.mergedHeaderCols = norm;
    }
  }

  return out;
}

// ─── icon-circle validator ───
// ─── icon-circle 옵션 검증 (add/update 공용) ────────────────────────────────
// mode='add'  → sectionId 허용, 모든 필드 optional (block-factory가 기본값 채움)
// mode='update' → sectionId 무시, blockId는 caller에서 처리. 빈 객체도 허용 (caller가 별도 체크).
// banner02 _validateBanner02Opts 패턴 미러 (_int / _str / _color / _enum).
function _validateIconCircleOpts(args, { mode } = {}) {
  if (!args || typeof args !== 'object') throw new Error('args must be object');
  const out = {};

  const _int = (key, min, max) => {
    if (args[key] === undefined || args[key] === null) return;
    const n = args[key];
    if (!Number.isInteger(n)) throw new Error(`${key} must be integer`);
    if (min !== undefined && n < min) throw new Error(`${key} < ${min}`);
    if (max !== undefined && n > max) throw new Error(`${key} > ${max}`);
    out[key] = n;
  };
  const _str = (key, maxLen) => {
    if (args[key] === undefined || args[key] === null) return;
    if (typeof args[key] !== 'string') throw new Error(`${key} must be string`);
    if (maxLen !== undefined && [...args[key]].length > maxLen) {
      throw new Error(`${key} too long (>${maxLen} code points)`);
    }
    out[key] = args[key];
  };
  // hex/rgb()/rgba()/hsl()/hsla()/transparent — strict. CSS injection 차단.
  const _color = (key) => {
    if (args[key] === undefined || args[key] === null) return;
    if (typeof args[key] !== 'string') throw new Error(`${key} must be string`);
    const v = args[key].trim();
    if (v.length === 0) throw new Error(`${key} empty`);
    if (v.length > 64) throw new Error(`${key} too long`);
    const ok =
      /^#[0-9a-fA-F]{3,8}$/.test(v) ||
      /^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$/.test(v) ||
      v === 'transparent';
    if (!ok) throw new Error(`${key} invalid color (allowed: #hex | rgb(a)/hsl(a)() | transparent)`);
    out[key] = v;
  };
  const _enum = (key, allowed) => {
    if (args[key] === undefined || args[key] === null) return;
    if (!allowed.includes(args[key])) throw new Error(`invalid ${key}: ${args[key]}. allowed: ${allowed.join('|')}`);
    out[key] = args[key];
  };

  if (mode === 'add') {
    if (args.sectionId !== undefined && args.sectionId !== null) {
      if (typeof args.sectionId !== 'string' || !args.sectionId.startsWith('sec_')) {
        throw new Error(`invalid sectionId: ${args.sectionId}. expected string starting with sec_`);
      }
      out.sectionId = args.sectionId;
    }
  }

  _str('layerName', 80);
  _int('size', 40, 860);
  _color('bgColor');
  _enum('border', ['none', 'solid', 'dashed']);
  _int('radius', 0, 500);
  _int('padX', 0, 200);

  // imgSrc — banner02 패턴 미러. 빈 문자열은 update 시 "이미지 제거" 시그널로 허용.
  if (args.imgSrc !== undefined && args.imgSrc !== null) {
    if (typeof args.imgSrc !== 'string') throw new Error('imgSrc must be string');
    if (args.imgSrc.length > 200000) throw new Error('imgSrc too long (>200000)');
    if (/["\r\n]/.test(args.imgSrc)) throw new Error('imgSrc contains quote/newline (escape unsafe)');
    // ★put_image 와 «같은» 검사 함수를 부른다 — 겹을 새로 만들지 않는다(지디 2026-09-07).
    //   상한(200000자)은 «양»을 막지 «구조»를 못 막는다. 잘린 PNG 는 크기와 무관하다.
    _assertImageSrcIntact(args.imgSrc, 'imgSrc');
    out.imgSrc = args.imgSrc;
  }

  return out;
}

// ─── graph validator ───
// ─── graph 옵션 검증 (add/update 공용) ─────────────────────────────────────
// banner02 _validateBanner02Opts 패턴 미러. items 배열 + label/value 항목 검증.
// mode='add'  → sectionId 허용, 모든 필드 optional (block-factory가 기본값 채움)
// mode='update' → sectionId 무시. 빈 객체도 통과 (caller가 별도 체크).
function _validateGraphOpts(args, { mode } = {}) {
  if (!args || typeof args !== 'object') throw new Error('args must be object');
  const out = {};

  const _int = (key, min, max) => {
    if (args[key] === undefined || args[key] === null) return;
    const n = args[key];
    if (!Number.isInteger(n)) throw new Error(`${key} must be integer`);
    if (min !== undefined && n < min) throw new Error(`${key} < ${min}`);
    if (max !== undefined && n > max) throw new Error(`${key} > ${max}`);
    out[key] = n;
  };
  // hex/rgb()/rgba()/hsl()/hsla()/transparent — strict. CSS injection 차단.
  const _color = (key) => {
    if (args[key] === undefined || args[key] === null) return;
    if (typeof args[key] !== 'string') throw new Error(`${key} must be string`);
    const v = args[key].trim();
    if (v.length === 0) throw new Error(`${key} empty`);
    if (v.length > 64) throw new Error(`${key} too long`);
    const ok =
      /^#[0-9a-fA-F]{3,8}$/.test(v) ||
      /^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$/.test(v) ||
      v === 'transparent';
    if (!ok) throw new Error(`${key} invalid color (allowed: #hex | rgb(a)/hsl(a)() | transparent)`);
    out[key] = v;
  };
  const _enum = (key, allowed) => {
    if (args[key] === undefined || args[key] === null) return;
    if (!allowed.includes(args[key])) throw new Error(`invalid ${key}: ${args[key]}. allowed: ${allowed.join('|')}`);
    out[key] = args[key];
  };

  if (mode === 'add') {
    if (args.sectionId !== undefined && args.sectionId !== null) {
      if (typeof args.sectionId !== 'string' || !args.sectionId.startsWith('sec_')) {
        throw new Error(`invalid sectionId: ${args.sectionId}. expected string starting with sec_`);
      }
      out.sectionId = args.sectionId;
    }
  }

  _enum('chartType', ['bar-v', 'bar-h', 'line']);
  _enum('preset', ['default', 'dark', 'minimal', 'colorful']);

  // items 배열 — [{label:str(<=80), value:0~9999 finite number}]
  if (args.items !== undefined && args.items !== null) {
    if (!Array.isArray(args.items)) throw new Error('items must be array');
    if (args.items.length === 0)    throw new Error('items must have at least 1 entry');
    if (args.items.length > 50)     throw new Error('items too many (>50)');
    const norm = [];
    for (let i = 0; i < args.items.length; i++) {
      const it = args.items[i];
      if (!it || typeof it !== 'object') throw new Error(`items[${i}] must be object`);
      if (typeof it.label !== 'string') throw new Error(`items[${i}].label must be string`);
      if ([...it.label].length > 80)    throw new Error(`items[${i}].label too long (>80)`);
      if (typeof it.value !== 'number' || !Number.isFinite(it.value)) {
        throw new Error(`items[${i}].value must be finite number`);
      }
      if (it.value < 0 || it.value > 9999) {
        throw new Error(`items[${i}].value out of range [0,9999]`);
      }
      norm.push({ label: it.label, value: it.value });
    }
    out.items = norm;
  }

  _int('chartHeight',  80,  2000);
  _int('labelSize',    8,   28);
  _int('barThickness', 8,   48);
  _int('padX',         0,   80);
  _int('itemGap',      8,   80);
  _int('pctSize',      20,  120);
  _int('strokeWidth',  1,   12);
  _int('pointRadius',  0,   16);
  _color('barColor');
  _enum('fillArea', ['0', '1']);

  // fillAlpha — number 0~1 finite, toFixed(2) 문자열로 저장
  if (args.fillAlpha !== undefined && args.fillAlpha !== null) {
    if (typeof args.fillAlpha !== 'number' || !Number.isFinite(args.fillAlpha)) {
      throw new Error('fillAlpha must be finite number');
    }
    if (args.fillAlpha < 0 || args.fillAlpha > 1) {
      throw new Error('fillAlpha out of range [0,1]');
    }
    out.fillAlpha = args.fillAlpha.toFixed(2);
  }

  return out;
}

// ─── gap validator ───
// ─── gap 옵션 검증 (update 전용 — add_gap_block은 기존 별도 경로) ──────────
// mode='update' → blockId는 caller에서 처리. 빈 객체도 허용 (caller가 별도 체크).
// gap 블록은 단일 필드(height)만 — banner02 _int helper 패턴 그대로 미러.
function _validateGapOpts(args, { mode } = {}) {
  if (!args || typeof args !== 'object') throw new Error('args must be object');
  const out = {};

  const _int = (key, min, max) => {
    if (args[key] === undefined || args[key] === null) return;
    const n = args[key];
    if (!Number.isInteger(n)) throw new Error(`${key} must be integer`);
    if (min !== undefined && n < min) throw new Error(`${key} < ${min}`);
    if (max !== undefined && n > max) throw new Error(`${key} > ${max}`);
    out[key] = n;
  };

  _int('height', 0, 400);

  return out;
}

// ─── speech-bubble validator ───
// ─── speech-bubble 옵션 검증 (add/update 공용) ──────────────────────────────
// mode='add'  → sectionId 허용, 모든 필드 optional (block-factory가 기본값 채움)
// mode='update' → sectionId 무시, blockId는 caller에서 처리. 빈 객체도 허용 (caller가 별도 체크).
function _validateSpeechBubbleOpts(args, { mode } = {}) {
  if (!args || typeof args !== 'object') throw new Error('args must be object');
  const out = {};

  const _str = (key, maxLen) => {
    if (args[key] === undefined || args[key] === null) return;
    if (typeof args[key] !== 'string') throw new Error(`${key} must be string`);
    if (maxLen !== undefined && [...args[key]].length > maxLen) {
      throw new Error(`${key} too long (>${maxLen} code points)`);
    }
    out[key] = args[key];
  };
  // hex/rgb()/rgba()/hsl()/hsla()/transparent — strict. CSS injection 차단.
  const _color = (key) => {
    if (args[key] === undefined || args[key] === null) return;
    if (typeof args[key] !== 'string') throw new Error(`${key} must be string`);
    const v = args[key].trim();
    if (v.length === 0) throw new Error(`${key} empty`);
    if (v.length > 64) throw new Error(`${key} too long`);
    const ok =
      /^#[0-9a-fA-F]{3,8}$/.test(v) ||
      /^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$/.test(v) ||
      v === 'transparent';
    if (!ok) throw new Error(`${key} invalid color (allowed: #hex | rgb(a)/hsl(a)() | transparent)`);
    out[key] = v;
  };
  const _enum = (key, allowed) => {
    if (args[key] === undefined || args[key] === null) return;
    if (!allowed.includes(args[key])) throw new Error(`invalid ${key}: ${args[key]}. allowed: ${allowed.join('|')}`);
    out[key] = args[key];
  };

  if (mode === 'add') {
    if (args.sectionId !== undefined && args.sectionId !== null) {
      if (typeof args.sectionId !== 'string' || !args.sectionId.startsWith('sec_')) {
        throw new Error(`invalid sectionId: ${args.sectionId}. expected string starting with sec_`);
      }
      out.sectionId = args.sectionId;
    }
  }

  _enum('tail', ['left', 'center', 'right']);
  _enum('bubbleStyle', ['default', 'apple', 'imessage']);
  _enum('showSender', ['true', 'false']);
  _str('senderName', 100);
  _color('bubbleBg');
  _str('text', 2000);

  return out;
}

// ─── label-group validator ───
// ─── label-group 옵션 검증 (add/update 공용) ────────────────────────────────
// banner02 패턴 미러. labels 배열 + 일괄 스타일 + absolute 위치 검증.
// mode='add'   → sectionId 허용, 모든 필드 optional (block-factory가 기본값 채움)
// mode='update' → sectionId 무시. 빈 객체 허용(caller가 별도 체크).
function _validateLabelGroupOpts(args, { mode } = {}) {
  if (!args || typeof args !== 'object') throw new Error('args must be object');
  const out = {};

  const _int = (key, min, max) => {
    if (args[key] === undefined || args[key] === null) return;
    const n = args[key];
    if (!Number.isInteger(n)) throw new Error(`${key} must be integer`);
    if (min !== undefined && n < min) throw new Error(`${key} < ${min}`);
    if (max !== undefined && n > max) throw new Error(`${key} > ${max}`);
    out[key] = n;
  };
  const _color = (key) => {
    if (args[key] === undefined || args[key] === null) return;
    if (typeof args[key] !== 'string') throw new Error(`${key} must be string`);
    const v = args[key].trim();
    if (v.length === 0) throw new Error(`${key} empty`);
    if (v.length > 64) throw new Error(`${key} too long`);
    const ok =
      /^#[0-9a-fA-F]{3,8}$/.test(v) ||
      /^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$/.test(v) ||
      v === 'transparent';
    if (!ok) throw new Error(`${key} invalid color (allowed: #hex | rgb(a)/hsl(a)() | transparent)`);
    out[key] = v;
  };
  const _enum = (key, allowed) => {
    if (args[key] === undefined || args[key] === null) return;
    if (!allowed.includes(args[key])) throw new Error(`invalid ${key}: ${args[key]}. allowed: ${allowed.join('|')}`);
    out[key] = args[key];
  };

  if (mode === 'add') {
    if (args.sectionId !== undefined && args.sectionId !== null) {
      if (typeof args.sectionId !== 'string' || !args.sectionId.startsWith('sec_')) {
        throw new Error(`invalid sectionId: ${args.sectionId}. expected string starting with sec_`);
      }
      out.sectionId = args.sectionId;
    }
  }

  // labels — 문자열 배열 (각 ≤500, 길이 0~50)
  if (args.labels !== undefined && args.labels !== null) {
    if (!Array.isArray(args.labels)) throw new Error('labels must be array');
    if (args.labels.length > 50) throw new Error('labels length must be ≤50');
    for (let i = 0; i < args.labels.length; i++) {
      const t = args.labels[i];
      if (typeof t !== 'string') throw new Error(`labels[${i}] must be string`);
      if ([...t].length > 500) throw new Error(`labels[${i}] too long (>500 code points)`);
    }
    out.labels = args.labels.slice();
  }

  _enum('shape', ['pill', 'circle']);
  _enum('align', ['left', 'center', 'right']);
  _int('gap', 0, 60);
  _int('allItemHeight', 0, 120);
  _color('itemBg');
  _color('itemColor');
  _int('itemRadius', 0, 50);
  _enum('stylePreset', ['Default', 'Filled', 'Outline', 'Ghost']);

  // absolute 모드 전용 (update에서만 의미 있음 — add에선 신규 블록이라 보통 미사용)
  _int('width', 40, 860);
  _int('x', -10000, 10000);
  _int('y', -10000, 10000);

  return out;
}

// ─── shape validator ───
// ─── shape 옵션 검증 (add/update 공용) ────────────────────────────────────
// mode='add'  → sectionId 허용, 모든 필드 optional. shapeType만 검증해도 충분.
// mode='update' → sectionId 무시, blockId는 caller에서 처리. 빈 객체도 허용 (caller가 별도 체크).
function _validateShapeOpts(args, { mode } = {}) {
  if (!args || typeof args !== 'object') throw new Error('args must be object');
  const out = {};

  const _int = (key, min, max) => {
    if (args[key] === undefined || args[key] === null) return;
    const n = args[key];
    if (!Number.isInteger(n)) throw new Error(`${key} must be integer`);
    if (!Number.isFinite(n)) throw new Error(`${key} must be finite`);
    if (min !== undefined && n < min) throw new Error(`${key} < ${min}`);
    if (max !== undefined && n > max) throw new Error(`${key} > ${max}`);
    out[key] = n;
  };
  // hex/rgb()/rgba()/hsl()/hsla()/transparent — strict. CSS injection 차단.
  // 빈문자열 허용 옵션: shapeStrokeColor는 ''이면 currentColor 폴백.
  const _color = (key, { allowEmpty = false } = {}) => {
    if (args[key] === undefined || args[key] === null) return;
    if (typeof args[key] !== 'string') throw new Error(`${key} must be string`);
    if (allowEmpty && args[key] === '') { out[key] = ''; return; }
    const v = args[key].trim();
    if (v.length === 0) throw new Error(`${key} empty`);
    if (v.length > 64) throw new Error(`${key} too long`);
    const ok =
      /^#[0-9a-fA-F]{3,8}$/.test(v) ||
      /^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$/.test(v) ||
      v === 'transparent';
    if (!ok) throw new Error(`${key} invalid color (allowed: #hex | rgb(a)/hsl(a)() | transparent)`);
    out[key] = v;
  };
  const _enum = (key, allowed) => {
    if (args[key] === undefined || args[key] === null) return;
    if (!allowed.includes(args[key])) throw new Error(`invalid ${key}: ${args[key]}. allowed: ${allowed.join('|')}`);
    out[key] = args[key];
  };

  if (mode === 'add') {
    if (args.sectionId !== undefined && args.sectionId !== null) {
      if (typeof args.sectionId !== 'string' || !args.sectionId.startsWith('sec_')) {
        throw new Error(`invalid sectionId: ${args.sectionId}. expected string starting with sec_`);
      }
      out.sectionId = args.sectionId;
    }
  }

  _enum('shapeType', ['rectangle', 'ellipse', 'line', 'arrow', 'polygon', 'star']);
  _color('shapeColor');
  _color('shapeStrokeColor', { allowEmpty: true });
  _int('shapeStrokeWidth', 0, 20);
  _int('shapeRotation', -180, 180);
  _int('width', 10, 860);
  _int('height', 10, 860);

  return out;
}

// ─── icon-text validator ───
// ─── icon-text 옵션 검증 (add/update 공용) ─────────────────────────────────
// mode='add'  → sectionId 허용, 모든 필드 optional (block-factory가 기본값 채움)
// mode='update' → sectionId 무시. blockId는 caller에서 처리. 빈 객체도 허용 (caller가 별도 체크).
// banner02 _str/_int/_color helper 사용 룰 동일. imgSrc는 별도 가드.
function _validateIconTextOpts(args, { mode } = {}) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('args must be object');
  const out = {};

  const _str = (key, maxLen) => {
    if (args[key] === undefined || args[key] === null) return;
    if (typeof args[key] !== 'string') throw new Error(`${key} must be string`);
    if (maxLen !== undefined && [...args[key]].length > maxLen) {
      throw new Error(`${key} too long (>${maxLen} code points)`);
    }
    out[key] = args[key];
  };

  if (mode === 'add') {
    if (args.sectionId !== undefined && args.sectionId !== null) {
      if (typeof args.sectionId !== 'string' || !args.sectionId.startsWith('sec_')) {
        throw new Error(`invalid sectionId: ${args.sectionId}. expected string starting with sec_`);
      }
      out.sectionId = args.sectionId;
    }
  }

  _str('text', 2000);

  // imgSrc: length + 개행/따옴표 + 프로토콜 화이트리스트
  if (args.imgSrc !== undefined && args.imgSrc !== null) {
    if (typeof args.imgSrc !== 'string') throw new Error('imgSrc must be string');
    if (args.imgSrc.length > 200000) throw new Error('imgSrc too long (>200000)');
    if (args.imgSrc.length > 0) {
      if (/["\r\n]/.test(args.imgSrc)) throw new Error('imgSrc contains quote/newline (escape unsafe)');
      const s = args.imgSrc.trim();
      const okProto =
        /^data:image\//i.test(s) ||
        /^https?:\/\//i.test(s) ||
        /^blob:/i.test(s) ||
        /^assets\//i.test(s);
      if (!okProto) throw new Error('imgSrc protocol not allowed (use data:image/*, http(s)://, blob:, or assets/)');
    }
    // ★put_image 와 «같은» 검사 함수를 부른다 — 겹을 새로 만들지 않는다(지디 2026-09-07).
    //   상한(200000자)은 «양»을 막지 «구조»를 못 막는다. 잘린 PNG 는 크기와 무관하다.
    _assertImageSrcIntact(args.imgSrc, 'imgSrc');
    out.imgSrc = args.imgSrc;
  }

  return out;
}

// ─── comparison 옵션 검증 (add/update 공용) ────────────────────────────────
// banner02 패턴 미러. cols 배열 + columnPatch 추가 검증.
const _CMP_BG_RE   = /^#[0-9a-fA-F]{3,8}$|^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$/;
const _CMP_GRAD_INNER_RE = /^[\sa-zA-Z0-9,%#.\-+/]{1,1024}$/;
const _CMP_GRAD_HEAD_RE  = /^(linear|radial|conic)-gradient$/;

function _isValidCmpGradient(s) {
  if (!s.endsWith(')')) return false;
  const openIdx = s.indexOf('(');
  if (openIdx < 0) return false;
  const head  = s.slice(0, openIdx);
  const inner = s.slice(openIdx + 1, -1);
  if (!_CMP_GRAD_HEAD_RE.test(head)) return false;
  if (!_CMP_GRAD_INNER_RE.test(inner)) return false;
  return true;
}

function _validateComparisonBg(v, label) {
  if (typeof v !== 'string') throw new Error(`${label} must be string`);
  const s = v.trim();
  if (!s) return '';
  if (s.length > 1024) throw new Error(`${label} too long`);
  if (s === 'transparent') return s;
  if (_CMP_BG_RE.test(s)) return s;
  if (_isValidCmpGradient(s)) return s;
  throw new Error(`${label} invalid (allowed: #hex | rgb(a)/hsl(a)() | transparent | (linear|radial|conic)-gradient(...))`);
}
function _validateComparisonTextColor(v, label) {
  if (typeof v !== 'string') throw new Error(`${label} must be string`);
  const s = v.trim();
  if (!s) return '';
  if (s.length > 64) throw new Error(`${label} too long`);
  if (s === 'transparent') return s;
  if (_CMP_BG_RE.test(s)) return s;
  throw new Error(`${label} invalid color (allowed: #hex | rgb(a)/hsl(a)() | transparent)`);
}
function _validateComparisonCol(c, label) {
  if (!c || typeof c !== 'object') throw new Error(`${label} must be object`);
  const out = {};
  if (c.title !== undefined && c.title !== null) {
    if (typeof c.title !== 'string') throw new Error(`${label}.title must be string`);
    if ([...c.title].length > 200) throw new Error(`${label}.title too long (>200 code points)`);
    out.title = c.title;
  }
  if (c.bg !== undefined && c.bg !== null) out.bg = _validateComparisonBg(c.bg, `${label}.bg`);
  if (c.text !== undefined && c.text !== null) out.text = _validateComparisonTextColor(c.text, `${label}.text`);
  if (c.rows !== undefined && c.rows !== null) {
    if (!Array.isArray(c.rows)) throw new Error(`${label}.rows must be array`);
    if (c.rows.length > 20) throw new Error(`${label}.rows length > 20`);
    out.rows = c.rows.map((r, ri) => _validateComparisonRow(r, `${label}.rows[${ri}]`));
  }
  return out;
}

// 행 1개 검증 — 문자열(text행) 또는 {type:'text'|'image', text?, imgSrc?, imgFit?} 객체.
// imgSrc는 렌더의 url("...") template에 들어가므로 escape 가드(banner02 imgSrc 패턴 미러).
function _validateComparisonRow(r, label) {
  if (r == null || typeof r === 'string') {
    const s = r == null ? '' : r;
    if ([...s].length > 500) throw new Error(`${label} too long (>500 code points)`);
    return { type: 'text', text: s };
  }
  if (typeof r !== 'object') throw new Error(`${label} must be string or object`);
  const type = r.type === undefined || r.type === null || r.type === 'text' ? 'text'
             : (r.type === 'image' ? 'image' : null);
  if (type === null) throw new Error(`${label}.type invalid: ${r.type} (allowed: text|image)`);
  let text = '';
  if (r.text !== undefined && r.text !== null) {
    if (typeof r.text !== 'string') throw new Error(`${label}.text must be string`);
    if ([...r.text].length > 500) throw new Error(`${label}.text too long (>500 code points)`);
    text = r.text;
  }
  if (type === 'text') return { type: 'text', text };
  // image
  let imgSrc = '';
  if (r.imgSrc !== undefined && r.imgSrc !== null) {
    if (typeof r.imgSrc !== 'string') throw new Error(`${label}.imgSrc must be string`);
    if (r.imgSrc.length > 200000) throw new Error(`${label}.imgSrc too long (>200000)`);
    if (/["\r\n]/.test(r.imgSrc)) throw new Error(`${label}.imgSrc contains quote/newline (escape unsafe)`);
    imgSrc = r.imgSrc;
  }
  let imgFit = 'cover';
  if (r.imgFit !== undefined && r.imgFit !== null) {
    if (r.imgFit !== 'cover' && r.imgFit !== 'contain') throw new Error(`${label}.imgFit invalid: ${r.imgFit} (allowed: cover|contain)`);
    imgFit = r.imgFit;
  }
  return { type: 'image', text, imgSrc, imgFit };
}

function _validateComparisonOpts(args, { mode } = {}) {
  if (!args || typeof args !== 'object') throw new Error('args must be object');
  const out = {};

  const _int = (key, min, max) => {
    if (args[key] === undefined || args[key] === null) return;
    const n = args[key];
    if (!Number.isInteger(n)) throw new Error(`${key} must be integer`);
    if (min !== undefined && n < min) throw new Error(`${key} < ${min}`);
    if (max !== undefined && n > max) throw new Error(`${key} > ${max}`);
    out[key] = n;
  };
  const _num = (key, min, max) => {
    if (args[key] === undefined || args[key] === null) return;
    const n = args[key];
    if (typeof n !== 'number' || !Number.isFinite(n)) throw new Error(`${key} must be finite number`);
    if (min !== undefined && n < min) throw new Error(`${key} < ${min}`);
    if (max !== undefined && n > max) throw new Error(`${key} > ${max}`);
    out[key] = n;
  };
  const _str = (key, maxLen) => {
    if (args[key] === undefined || args[key] === null) return;
    if (typeof args[key] !== 'string') throw new Error(`${key} must be string`);
    if (maxLen !== undefined && [...args[key]].length > maxLen) {
      throw new Error(`${key} too long (>${maxLen} code points)`);
    }
    out[key] = args[key];
  };

  if (mode === 'add') {
    if (args.sectionId !== undefined && args.sectionId !== null) {
      if (typeof args.sectionId !== 'string' || !args.sectionId.startsWith('sec_')) {
        throw new Error(`invalid sectionId: ${args.sectionId}. expected string starting with sec_`);
      }
      out.sectionId = args.sectionId;
    }
  }

  _str('layerName', 100);
  _int('compW',     120, 4000);
  _num('featScale', 1.0, 1.5);
  _int('overlap',   0,   400);
  _int('radius',    0,   400);
  _int('padX',      0,   400);
  _int('padY',      0,   400);
  _int('headerH',   16,  400);
  _int('rowH',      16,  400);
  _int('rowGap',    0,   200);
  _int('titleFont', 4,   400);
  _int('rowFont',   4,   400);
  _int('featured',  0,   7);

  if (args.cols !== undefined && args.cols !== null) {
    if (!Array.isArray(args.cols)) throw new Error('cols must be array');
    if (args.cols.length < 2 || args.cols.length > 8) {
      throw new Error(`cols length ${args.cols.length} out of range (2~8)`);
    }
    out.cols = args.cols.map((c, i) => _validateComparisonCol(c, `cols[${i}]`));
  }

  if (args.columnPatch !== undefined && args.columnPatch !== null) {
    if (!Array.isArray(args.columnPatch)) throw new Error('columnPatch must be array');
    if (args.columnPatch.length > 16) throw new Error('columnPatch length > 16');
    out.columnPatch = args.columnPatch.map((p, i) => {
      if (!p || typeof p !== 'object') throw new Error(`columnPatch[${i}] must be object`);
      if (!Number.isInteger(p.index) || p.index < 0 || p.index > 7) {
        throw new Error(`columnPatch[${i}].index invalid (must be integer 0~7)`);
      }
      const v = _validateComparisonCol(p, `columnPatch[${i}]`);
      return { index: p.index, ...v };
    });
  }

  if (out.featured !== undefined && out.cols !== undefined && out.featured >= out.cols.length) {
    throw new Error(`featured ${out.featured} out of range for cols length ${out.cols.length}`);
  }

  // rowHeights — 행 인덱스별 높이 오버라이드 배열 (null/0이면 기본 rowH, 16~400, ≤ 20개)
  if (args.rowHeights !== undefined && args.rowHeights !== null) {
    if (!Array.isArray(args.rowHeights)) throw new Error('rowHeights must be array');
    if (args.rowHeights.length > 20) throw new Error('rowHeights length > 20');
    out.rowHeights = args.rowHeights.map((v, ri) => {
      if (v == null || v === 0 || v === '') return null;
      if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`rowHeights[${ri}] must be number or null`);
      if (v < 16 || v > 400) throw new Error(`rowHeights[${ri}] out of range (16~400 or null)`);
      return Math.round(v);
    });
  }

  return out;
}

// ─── step-block 옵션 검증 (add/update 공용) ───────────────────────────────
// renderStepBlock이 title/desc를 innerHTML 템플릿에 직접 interpolate해서 boundary에서 HTML escape.
const _STEP_MAX_TITLE_LEN = 200;
const _STEP_MAX_DESC_LEN  = 500;
const _STEP_MAX_ITEMS     = 10;

function _stepEscapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function _validateStepOpts(args, { mode } = {}) {
  if (!args || typeof args !== 'object') throw new Error('args must be object');
  const out = {};

  const _int = (key, min, max) => {
    if (args[key] === undefined || args[key] === null) return;
    const n = args[key];
    if (!Number.isInteger(n)) throw new Error(`${key} must be integer`);
    if (min !== undefined && n < min) throw new Error(`${key} < ${min}`);
    if (max !== undefined && n > max) throw new Error(`${key} > ${max}`);
    out[key] = n;
  };
  const _color = (key) => {
    if (args[key] === undefined || args[key] === null) return;
    if (typeof args[key] !== 'string') throw new Error(`${key} must be string`);
    const v = args[key].trim();
    if (v.length === 0) throw new Error(`${key} empty`);
    if (v.length > 64) throw new Error(`${key} too long`);
    const ok =
      /^#[0-9a-fA-F]{3,8}$/.test(v) ||
      /^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$/.test(v) ||
      v === 'transparent';
    if (!ok) throw new Error(`${key} invalid color (allowed: #hex | rgb(a)/hsl(a)() | transparent)`);
    out[key] = v;
  };
  const _enum = (key, allowed) => {
    if (args[key] === undefined || args[key] === null) return;
    if (!allowed.includes(args[key])) throw new Error(`invalid ${key}: ${args[key]}. allowed: ${allowed.join('|')}`);
    out[key] = args[key];
  };
  const _bool = (key) => {
    if (args[key] === undefined || args[key] === null) return;
    if (typeof args[key] !== 'boolean') throw new Error(`${key} must be boolean`);
    out[key] = args[key];
  };

  if (mode === 'add') {
    if (args.sectionId !== undefined && args.sectionId !== null) {
      if (typeof args.sectionId !== 'string' || !args.sectionId.startsWith('sec_')) {
        throw new Error(`invalid sectionId: ${args.sectionId}. expected string starting with sec_`);
      }
      out.sectionId = args.sectionId;
    }
  }

  if (mode === 'add' && (args.steps === undefined || args.steps === null)) {
    throw new Error('steps required (array of {title, desc?}, 1~10 items)');
  }
  if (args.steps !== undefined && args.steps !== null) {
    if (!Array.isArray(args.steps)) throw new Error('steps must be array');
    if (args.steps.length < 1) throw new Error('steps must have at least 1 item');
    if (args.steps.length > _STEP_MAX_ITEMS) {
      throw new Error(`steps too long (>${_STEP_MAX_ITEMS} items)`);
    }
    const cleaned = args.steps.map((s, i) => {
      if (!s || typeof s !== 'object') throw new Error(`steps[${i}] must be object`);
      if (typeof s.title !== 'string') throw new Error(`steps[${i}].title required (string)`);
      if ([...s.title].length > _STEP_MAX_TITLE_LEN) {
        throw new Error(`steps[${i}].title too long (>${_STEP_MAX_TITLE_LEN} code points)`);
      }
      const o = { title: _stepEscapeHtml(s.title) };
      if (s.desc !== undefined && s.desc !== null) {
        if (typeof s.desc !== 'string') throw new Error(`steps[${i}].desc must be string`);
        if ([...s.desc].length > _STEP_MAX_DESC_LEN) {
          throw new Error(`steps[${i}].desc too long (>${_STEP_MAX_DESC_LEN} code points)`);
        }
        o.desc = _stepEscapeHtml(s.desc);
      }
      return o;
    });
    out.steps = cleaned;
  }

  _color('numBg'); _color('numColor');
  _color('titleColor'); _color('descColor'); _color('stepCardBg');
  _int('numSize',   4, 400);
  _int('titleSize', 4, 400);
  _int('descSize',  4, 400);
  _int('gap',       0, 400);
  _int('badgeGap',  0, 400);
  _int('stepPadX',  0, 400);
  _int('stepPadL',  0, 400);
  _int('stepPadR',  0, 400);
  _bool('connector');
  _enum('connectorStyle', ['line', 'arrow', 'divider']);
  _enum('stepStyle',      ['default', 'card', 'circle', 'number']);
  _enum('stepOrient',     ['vertical', 'horizontal']);
  _enum('stepAlign',      ['left', 'center', 'right', 'stack']);
  _enum('badgeFormat',    ['number', 'padded', 'alpha', 'step', 'point']);

  return out;
}

// ─────────────────────────────────────────────
// JSON-RPC handling
// ─────────────────────────────────────────────
async function _handleRpc(msg) {
  const { id = null, method, params = {} } = msg || {};

  const ok = (result) => ({ jsonrpc: '2.0', id, result });
  const err = (code, message, data) => ({
    jsonrpc: '2.0',
    id,
    error: { code, message, ...(data !== undefined ? { data } : {}) }
  });

  try {
    if (method === 'initialize') {
      return ok({
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO
      });
    }

    if (method === 'notifications/initialized' || method === 'initialized') {
      // notification: no response (but we return null-ish)
      return null;
    }

    if (method === 'ping') {
      return ok({});
    }

    if (method === 'tools/list') {
      const list = [];
      // includeHidden=true 는 «문서 생성기» 전용 통로다(docs/goditor-api.md 가 별칭까지 실어야
      // 한다). MCP 클라이언트는 이 파라미터를 보내지 않으므로 사용자 컨텍스트 비용은 그대로다.
      const includeHidden = params && params.includeHidden === true;
      for (const [name] of tools) {
        if (!includeHidden && hiddenTools.has(name)) continue; // 다이어트: 별칭은 호출 가능하되 목록엔 안 싣는다
        const schema = toolSchemas.get(name) || {};
        /* ⒝안내 — ⛔손으로 도구마다 적지 않는다(하나 늘 때마다 낡는다). 게이트와 «같은 목록»에서 뽑아
           붙이므로 도구를 더하면 설명도 자동으로 따라온다. ⒝만으로는 안 지켜져서 ⒜(디스패처)가 본체다. */
        const _gated = !_TARGET_FREE.has(name);
        list.push({
          name,
          description: (schema.description || '')
            + (_gated ? ' ⚠TARGET=the ACTIVE project: refused unless it was confirmed (open_project) in this session.' : ''),
          inputSchema: schema.inputSchema || { type: 'object', properties: {} },
          ...(includeHidden && hiddenTools.has(name) ? { hidden: true } : {})
        });
      }
      return ok({ tools: list });
    }

    if (method === 'tools/call') {
      const { name, arguments: args = {} } = params || {};
      const _rawHandler = tools.get(name);
      if (!_rawHandler) return err(-32601, `tool not found: ${name}`);
      /* ★이미지 무결성 거절을 «한 곳»에서 같은 모양으로 만든다.
       *   앞 판은 put_image·update_asset_block 만 ok:false+code 였고, 나머지 5개 진입점은
       *   던져서 JSON-RPC -32000 으로 납작해졌다 — code 도 reason 도 숫자 detail 도 사라지고
       *   문장의 [IMAGE_TRUNCATED] 표식만 남았다. 「호출자가 «구조적으로» 읽어야 한다」는
       *   내 근거가 7곳 중 2곳에만 적용돼 있었다(적대검수 2026-09-07).
       *   ⛔7곳에 각각 catch 를 심지 «않는다» — 겹을 늘리면 각 겹이 실제로 일하는지 못 잰다. */
      const handler = async (a) => {
        try { return await _rawHandler(a); }
        catch (e) {
          if (e && e.imageCheckError) {
            return { ok: false, code: e.code, message: e.message, ...(e.detail || {}) };
          }
          throw e;
        }
      };
      /* ★프로젝트 전환 중이면 «실행하지 않고» 기다린다(큐잉). 병렬 호출로 들어온 편집이
       *   곧 교체될 옛 문서에 떨어져 조용히 증발하는 것을 여기서 한 곳으로 막는다.
       *   개별 도구 문자열은 손대지 않는다(다이어트 때와 같은 «디스패처 일괄» 패턴). */
      /* ★응답도 «유저 토큰»이다. pretty-print(들여쓰기 2칸)는 같은 정보에 15~25% 를 더 물린다.
       *   compact JSON 은 정보 손실 0 이라 그냥 이득이다(클라이언트는 JSON 으로 파싱한다). */
      /* ★★도구 «원장» — 2026-09-07 신설(H4). 현빈 보안 논의에서 나온 첫 항목.
         왜: 브리지 로그는 `method="tools/call"` «횟수»만 남긴다(실측 426건). 도구명도 인자도
         호출자도 «없다» ⇒ 사고가 나도 「무엇이 새어나갔나」를 답할 수 없다.
         고디터는 데이터가 «전부 로컬»이라 되물을 서버가 없다 — 원장이 유일한 사후 근거다.
         ⛔값은 안 적는다(PII·본문 유출). «이름»과 «크기»만. 그거면 세는 데 충분하다. */
      const _auditStart = Date.now();
      const _audit = (outcome, extra) => {
        try {
          const dir = _stateDir();   // 이미 있는 헬퍼를 쓴다(경로 규칙을 두 벌로 만들지 않는다)
          fs.mkdirSync(dir, { recursive: true });
          const a = args || {};
          fs.appendFileSync(path.join(dir, 'tool-audit.jsonl'), JSON.stringify({
            at: new Date().toISOString(), tool: name, outcome,
            argKeys: Object.keys(a).sort(),                       // ⛔이름만. 값은 «안» 적는다
            argBytes: (() => { try { return JSON.stringify(a).length; } catch (_) { return null; } })(),
            target: a.projectId || a.sectionId || a.blockId || a.id || null,  // 대상 id 는 «추적»에 필요하다
            activeProject: (() => { try { return _activeProjectId(); } catch (_) { return null; } })(),
            ms: Date.now() - _auditStart,
            ...(extra || {}),
          }) + '\n');
        } catch (_) { /* 원장 실패가 도구를 막지 않는다 */ }
      };

      const _reply = (r) => {
        /* ★경고 단계에서는 «조용히» 버리지 않고 한 줄을 붙인다 — 그게 이 결함의 핵심 피해다.
           ⛔기존 키는 안 건드린다(응답 «모양»을 바꾸면 다른 측정이 오염된다). 없던 키만 더한다.
           그리고 «인자가 깨끗하면 아무것도 안 붙는다» — 정상 응답은 바이트 하나 안 늘어난다. */
        // ⛔블록 도구는 이미 `warnUnknown` 이 `ignoredProps`/`hint` 로 «같은 말»을 한다.
        //   두 번 말하면 「어느 쪽이 맞나」가 생긴다 ⇒ 저쪽이 이미 말했으면 나는 «침묵»한다.
        if (r && typeof r === 'object' && !Array.isArray(r) && !r.ignoredProps
            && !_ARG_FORWARDERS.has(name) && _unknown.length && !_strictArgs()) {
          try { r = { ...r, warnings: [...(r.warnings || []), _unknownArgWarning(name, _unknown)] }; }
          catch (_) { /* 경고 실패가 응답을 막지 않는다 */ }
        }
        try { _audit(r && r.ok === false ? 'refused' : 'ok',
                     r && r.code ? { code: r.code } : null); } catch (_) {}
        return ok({ content: [{ type: 'text', text: JSON.stringify(r) }], isError: false });
      };
      /* ★«스키마에 없는 인자»를 여기 «한 자리»에서 다룬다 (2026-09-07 g-mcpmgr).
       *
       * 무엇이 문제였나: 도구 33/33(노출 기준) 전부가 inputSchema 에 `additionalProperties` 를
       *   안 걸어 뒀고, 핸들러는 구조분해로 받아 나머지를 «말없이» 버린다.
       *   ⇒ 오타·환각 인자가 조용히 사라지고 `ok` 가 돌아간다. 실측: update_section({sectionId,
       *      name:'새이름'}) 이 아무 말 없이 성공했다 — 「기능 부재」가 「조용한 거짓 성공」이 된다.
       *   양성대조: 필수 인자를 빼면 18/18 제대로 거절한다 ⇒ 서버는 «검사할 줄 안다, 안 하는 것뿐»이다.
       *
       * ⛔그런데 «바로 거절»로 가지 않는다. 세어 봤기 때문이다(지디 조건 1 — 「없을 것이다」 금지):
       *   계약 픽스처 84건 중 «스키마에 없는 인자»를 주는 호출이 **3건** 있었다.
       *     update_card_block   {cards}  ← 핸들러가 안 쓴다(진짜 군더더기)
       *     update_scratch_item {name}   ← 핸들러가 안 쓴다(진짜 군더더기)
       *     ★update_text_block  {text}   ← **핸들러가 «먹는다». 스키마에만 없다**(선언 안 된 별칭)
       *   실측: update_text_block 에 text 로도 content 로도 넣어 봤고 «둘 다» editTextBlock 까지 갔다.
       *   ⇒ ★지금 거절로 켜면 «오늘 도는 호출»이 깨진다. 그래서 기본은 «경고»다.
       *   ⇒ 그리고 더 큰 이유: **인자 단위 원장이 «없었다»** — 브리지 로그는
       *      `params { metadata: undefined }` 라 무슨 인자가 왔는지 아무 데도 안 남는다.
       *      「실제 트래픽에 몇 건이냐」를 «셀 수가 없었다». 이 줄이 그 원장을 만든다.
       *   ⇒ 원장이 쌓여 「진짜 별칭」이 스키마에 선언되고 나면 STRICT 로 뒤집는다(2단계, 지디 게이트).
       * ⚠️이 판정은 «스키마 대비»다 — 핸들러가 실제로 먹는 것과 다를 수 있고(위 text 가 그 예다)
       *   그 어긋남 자체가 여기 원장에 잡힌다. 그게 이 장치의 두 번째 값어치다. */
      const _unknown = _unknownArgKeys(name, args);
      if (_unknown.length) {
        _recordUnknownArgs(name, _unknown, Object.keys(args || {}));
        // ⛔전달자에는 STRICT 도 안 건다 — «거짓 거절»은 «거짓 경고»보다 나쁘다(동작을 막는다).
        if (_strictArgs() && !_ARG_FORWARDERS.has(name)) return _reply(_unknownArgRefusal(name, _unknown));
      }
      /* ★프로젝트 «싱크» 게이트 — 대상이 확정 안 된 쓰기는 «실행 전에» 거절한다(_projectGate 주석 참고).
       *   여기가 유일한 배선 자리다: 도구를 새로 더해도 _TARGET_FREE 에 안 적으면 «자동으로» 게이트를 탄다. */
      /* ★★로그인 게이트를 «가장 먼저» 건다(현빈 지시). 프로젝트 확정 게이트보다 «앞»이다 —
         로그인이 없으면 어느 프로젝트인지 따질 이유도 없다.
         ⛔단 «순수 진단»은 통과시킨다: 로그인 상태를 물어볼 통로까지 막으면 클로드가
           「왜 안 되는지」조차 못 알아낸다(막힌 이유를 «말할 수 있어야» 한다). */
      const _authRefusal = _AUTH_FREE.has(name) ? null : _authGate(name);
      if (_authRefusal) return _reply(_authRefusal);
      /* ★★「바꿨다」를 «되읽어» 대조하는 관문 (2026-09-07).
         ⛔왜: 앱의 update_* 들이 `applied` 를 «인자에서» 만든다(실측 93곳).
           그래서 못 바꿔도 「바꿨다」고 말한다 — `update_section{name}` 이 실제로 그랬고,
           나는 그걸 「됐다」로 읽고 커밋했다. 「rc=0 ≠ 눌렸다」의 MCP 판본이다.
         ⇒ 93곳을 하나씩 고치는 대신 «여기 한 자리»에서 쓰고 나서 블록을 다시 읽어 대조한다.
           ★구조가 검사보다 강하다 — 새 update 도구가 늘어도 «자동으로» 이 관문을 지난다.
         ⛔거짓 «빨강»을 만들지 않는다: 값이 정규화되는 경우가 흔하므로(20 → "20px", #FFF → rgb(...))
           «느슨한» 비교로 어긋남을 찾고, 어긋나면 «거절»이 아니라 `verify` 로 «알린다».
           판정은 사람과 모델이 한다 — 여기서 막으면 정상 동작까지 죽는다. */
      const _verifyApplied = async (r) => {
        try {
          if (!r || r.ok === false) return r;
          if (!/^update_.*_block$/.test(name) && name !== 'update_section') return r;
          const bid = args && (args.blockId || args.sectionId);
          if (!bid || !_rendererInvoker?.readBlockState) return r;
          const st = await _rendererInvoker.readBlockState({ blockId: String(bid) });
          if (!st) {
            return Object.assign({}, r, { ok: false, code: 'GONE_AFTER_WRITE',
              error: `${name} 뒤에 ${bid} 를 다시 못 찾았습니다 — 「바꿨다」를 믿지 마세요.` });
          }
          const said = (r && typeof r.applied === 'object' && r.applied) || null;
          if (!said) return Object.assign({}, r, { verified: { readBack: true } });
          const norm = (v) => String(v == null ? '' : v).trim().toLowerCase().replace(/px$/, '').replace(/\s+/g, '');
          const mismatch = {};
          for (const k of Object.keys(said)) {
            const want = said[k];
            if (want == null || typeof want === 'object') continue;   // 배열·객체는 이 관문이 안 본다
            const got = st.dataset[k];
            if (got === undefined) continue;                          // dataset 에 안 사는 값은 대조 못 한다
            if (norm(got) !== norm(want)) mismatch[k] = { said: want, actual: got };
          }
          if (Object.keys(mismatch).length) {
            return Object.assign({}, r, {
              verify: {
                ok: false,
                note: '★응답의 applied 와 «화면의 실제 값»이 다릅니다 — 「바꿨다」를 그대로 믿지 마세요.',
                mismatch,
              },
            });
          }
          return Object.assign({}, r, { verify: { ok: true, checked: Object.keys(said) } });
        } catch (_) { return r; }   // ⛔관문이 도구를 죽이지 않는다(진단은 편의, 동작이 우선)
      };

      const _gateRefusal = _projectGate(name, args);
      if (_gateRefusal) return _reply(_gateRefusal);
      /* ★open_project 가 성공하면 «그 대화 동안» 확정으로 남긴다(sticky). 실패(load_timeout 등)면 안 남긴다 —
       *   열리지도 않은 프로젝트를 확정으로 세면 게이트가 있으나 마나다. */
      const _noteConfirmed = (r) => {
        try {
          if (name === 'open_project' && r && r.ok !== false) {
            _setConfirmed((r.activeProjectId || r.projectId) || null);
          }
        } catch (_) {}
        return r;
      };
      /* ★편집 도구가 «성공»했으면 그때 만들어진 히스토리 꼭대기의 seq 를 기억한다.
         ⛔withLive 를 «켜지 않는다» — 여기선 매 호출 도는 자리라 직렬화 비용을 물면 안 된다
           (실사용 프로젝트가 100MB 대다). 무거운 판정은 undo 도구가 «한 번» 한다. */
      let _before = null;
      const _noteSeq = async (r) => {
        try {
          if (_NON_MUTATING.has(name)) return r;
          if (!r || r.ok === false) return r;
          if (!_rendererInvoker?.historyTip) return r;
          const t = await _rendererInvoker.historyTip();
          if (t && t.ok !== false && !t.empty && t.seq != null && t.seq !== _before) {
            _lastMcpSeqFrom = _before;   // 호출 «전» 꼭대기
            _lastMcpSeq = t.seq;         // 호출 «후» 꼭대기
            /* ★갭 «감수 패스» 예약. ⛔이 줄은 «여기»여야 한다 — 이유 둘:
               ⑴tools/call 은 아래에서 _SWITCH_EXEMPT / _serializeCall «두 갈래»로 갈리는데
                 둘 다 _noteSeq 를 지난다. 갈래 한쪽에 넣으면 다른 쪽이 «조용히» 샌다.
               ⑵「캔버스가 실제로 바뀌었나」를 «도구 이름표»가 아니라 «히스토리 꼭대기가
                 움직였나»로 판정한다 — 이름 목록은 도구가 늘 때마다 썩는다.
                 (실측 2026-09-07: 이름으로 걸었더니 open_project 가 감수를 불러
                  «프로젝트를 열기만 해도» 남의 갭을 고쳐 쓸 뻔했다.) */
            _scheduleSpacingAudit(name);
          }
        } catch (_) { /* 추적 실패는 편집을 막지 않는다 — undo 가 NOT_OURS 로 안전측 거절한다 */ }
        return r;
      };
      if (!_NON_MUTATING.has(name) && _rendererInvoker?.historyTip) {
        /* ★seq 가 null 인 «옛 항목»(도장 이전에 생긴 것)은 0 으로 본다 —
           null 을 그대로 두면 구간 계산이 못 되고 「1칸」으로 조용히 축소된다. */
        try { const b = await _rendererInvoker.historyTip(); if (b && b.ok !== false) _before = (b.empty || b.seq == null) ? 0 : b.seq; } catch (_) {}
      }
      if (_SWITCH_EXEMPT.has(name)) {
        /* ★쓰고 나서 «되읽어» 대조한다 — _verifyApplied 주석 참고 */
        return _reply(_noteConfirmed(await _verifyApplied(await _noteSeq(_enrichApiMissing(await handler(args))))));
      }
      return await _serializeCall(async () => {
        const blocked = await _awaitSwitchIdle(name, _SWITCH_QUEUE_MAX_MS);
        if (blocked) return _reply(blocked);
        /* ★쓰고 나서 «되읽어» 대조한다 — _verifyApplied 주석 참고 */
        return _reply(_noteConfirmed(await _verifyApplied(await _noteSeq(_enrichApiMissing(await handler(args))))));
      });
    }

    return err(-32601, `method not found: ${method}`);
  } catch (e) {
    /* ★★예외로 죽은 호출이 원장에 «안 남고» 있었다 (2026-09-07 실측).
         원장의 outcome 은 ok 666 · refused 20 «둘뿐»이었다 — 「터진 것」은 0건이다.
         그래서 원장만 보면 「전부 잘 됐다」로 읽힌다. ⛔안 잰 것은 «없는 것»이 된다.
       ⇒ 여기서 error 를 남긴다. 도구 이름을 알 수 있으면 같이 적는다. */
    try {
      const _n = (params && params.name) || (typeof method === 'string' ? method : null);
      _appendAudit({ tool: _n, outcome: 'error', code: 'EXCEPTION',
                     message: String((e && e.message) || e).slice(0, 200) });
    } catch (_) {}
    return err(-32000, e.message || String(e));
  }
}

// ─────────────────────────────────────────────
// HTTP server
// ─────────────────────────────────────────────
function _createServer() {
  return http.createServer((req, res) => {
    // CORS (Claude Code가 다른 origin에서 호출할 수 있음)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Mcp-Session-Id');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'GET' && req.url === '/health') {
      // Unit B — 토큰 없이 허용하되 도구목록(tools)·server 상세는 비노출(상태만).
      // 브리지의 포트 자동탐색이 보는 status:'ok' 계약은 유지.
      res.writeHead(200, { 'Content-Type': 'application/json' });
      // tokenFile/instance/pid는 «어느 인스턴스인지»와 «토큰을 어디서 읽을지»만 알려준다.
      // 토큰 값은 절대 여기 싣지 않는다(무인증 엔드포인트).
      /* ★«브라우저 페이지»에는 activeProject·tokenFile 을 주지 않는다 (2026-09-07).
       *
       * 왜 이 경계인가 — 「로컬 유저 = 주인」 모델은 «로컬 프로세스»에 대해선 충분하다.
       *   같은 사용자로 도는 프로세스는 토큰 파일을 어차피 찾는다(이 브리지 자신이
       *   「경로를 못 받으면 기본 userData 를 뒤진다」는 폴백을 갖고 있다 = 추측 가능하다는 증거).
       *   그런 프로세스는 이미 파일시스템·스크린샷·키체인이 열려 있다. 토큰만 더 조여봐야 소용없다.
       * ⇒ 그러나 **브라우저 페이지는 «로컬 유저»가 아니다**. 샌드박스 안이라 파일을 못 읽는다.
       *   이 엔드포인트가 ACAO:* 라서, 사용자가 연 아무 웹페이지나 여기를 읽을 수 있고
       *   거기서 «어느 프로젝트를 열어놨는지»와 «/Users/<계정명>/…» 경로를 무료로 가져간다.
       *   토큰은 못 훔치지만(파일을 못 읽으니) 신원·작업 내용은 새어 나간다.
       * ⇒ Origin 헤더가 «있는» 요청(=브라우저) 에만 그 둘을 뺀다.
       *   로컬 호출자는 Origin 을 안 보낸다 — 실측으로 센 소비자 둘 다 Node 쪽이다:
       *     ⑴ mcp-stdio-bridge.cjs (http.get)  ⑵ main/claude-pm/ipc.js handlePingMcp (fetch, 본문 안 읽음)
       *   렌더러에서 /health 를 직접 부르는 곳은 «0개»다(상단 MCP 배지는 IPC 로 간다).
       * ⚠️이건 «브라우저 경계»용이지 오늘(09-07) 사고의 처방이 아니다. 그 사고는 같은 사용자의
       *   권한 있는 CLI 세션 9개가 실사용 인스턴스에 붙은 «조율» 실패였고, 이걸로는 안 막힌다.
       *   그 처방은 팀 규약(세션마다 GODITOR_MCP_PORT 고정)이다. 둘을 섞지 마라. */
      const _fromBrowser = !!req.headers.origin;
      res.end(JSON.stringify({
        status: 'ok',
        port: currentPort,
        name: SERVER_INFO.name,
        requiresToken: true,
        pid: process.pid,
        instance: path.basename(_getUserDataDir()),
        // 인스턴스를 2개 띄우면 포트·pid만으론 «사람이» 어느 창인지 못 알아본다.
        // 열려 있는 프로젝트가 제일 알아보기 쉬운 표식이라 같이 준다.
        activeProject: _fromBrowser ? undefined
          : (() => { try { return _activeProjectId(); } catch (_) { return null; } })(),
        tokenFile: _fromBrowser ? undefined : _tokenFilePath,
        /* ★계정별 프로젝트 격리가 걸렸는지 — 「0건」을 «격리»와 «고장»으로 가르는 표식.
           지문은 계정키의 해시 8자다(이메일도 계정키도 여기 안 싣는다).
           브라우저 경계는 위와 같다 — 신원 표식이라 Origin 있는 요청엔 안 준다. */
        ...(_fromBrowser ? {} : (() => {
          try {
            const a = (typeof _authProbe === 'function') ? _authProbe() : null;
            if (!a || a.accountScoped === undefined) return {};
            /* ⛔필드를 «만들고 배선을 안 하면» 진단이 조용히 사라진다 —
                 실제로 accountUnresolved 를 main.js 에 넣고 여기서 안 실어 undefined 였다.
                 ★「0건」이면 「못 잰 것 아닌가」부터 의심하라는 그 규칙이 «필드»에도 적용된다. */
            return {
              accountScoped: !!a.accountScoped,
              accountUnresolved: !!a.accountUnresolved,   // 「계정을 못 알아냈다」 — 격리 폴더에 있다
              accountFingerprint: a.accountFingerprint || null,
            };
          } catch (_) { return {}; }
        })()),
        ...(_fromBrowser ? { note: 'cross-origin caller: activeProject/tokenFile omitted' } : {})
      }));
      return;
    }

    if (req.method === 'POST' && req.url && req.url.startsWith('/mcp')) {
      // Unit B — 토큰 검증 게이트(body 파싱 전에 차단). 누락/불일치 → 401.
      const tok = _extractToken(req);
      if (!_tokenOk(tok)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32001, message: 'unauthorized: missing/invalid token' }
        }));
        return;
      }
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
        try {
          const msg = body ? JSON.parse(body) : {};
          /* ★호출자 식별 — 예전엔 Mcp-Session-Id 가 CORS 허용 목록에만 있고 «읽는 코드가 0건»이었다.
             그래서 확정(sticky)이 호출자를 못 가르고 프로세스 전체가 한 칸을 썼다. */
          const _cid = String(req.headers['mcp-session-id'] || '').slice(0, 128) || 'anon';
          const result = await _callerCtx.run(_cid, () => _handleRpc(msg));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          // notification은 null → 빈 객체로 반환
          res.end(JSON.stringify(result === null ? {} : result));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: { code: -32700, message: 'parse error: ' + e.message }
          }));
        }
      });
      req.on('error', (e) => {
        try {
          res.writeHead(500);
          res.end(JSON.stringify({ error: e.message }));
        } catch (_) {}
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  });
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────
function startMcpServer({ port = 9345, onActiveProject } = {}) {
  if (server) {
    return Promise.resolve({ port: currentPort, alreadyRunning: true });
  }
  onActiveProjectCb = onActiveProject || (() => null);

  // default tools 등록 (idempotent)
  if (tools.size === 0) _registerDefaultTools();

  return new Promise((resolve, reject) => {
    const tryListen = (p) => {
      const srv = _createServer();
      srv.once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          // ⚠️이 대역(9345~)은 사내 CDP(원격디버깅) 포트 관행과 «겹친다».
          //   여기서 밀려난 포트가 남의 chrome-devtools MCP 포트를 먹을 수 있고, 그러면
          //   다른 사람이 「CDP가 이상하다」로 오진한다. 대역 이전은 릴리스 직후 첫 작업.
          console.warn(`[claudePM MCP] port ${p} busy — trying ${p + 1}`
            + ' (⚠️이 대역은 CDP 관행 포트와 겹칩니다 — CDP 이상으로 오진하지 마세요)');
          srv.close();
          if (p - port > 20) return reject(new Error('no free port within 20 of base'));
          tryListen(p + 1);
        } else {
          reject(err);
        }
      });
      srv.listen(p, '127.0.0.1', () => {
        server = srv;
        currentPort = p;
        // Unit B — 기동 시 토큰 생성(메모리). 이미 있으면(재기동) 동일 페어링 유지.
        if (!mcpToken) mcpToken = _genToken();
        // Unit B-2 — 토큰을 0600 파일로 내려써야 브리지가 재시작 후에도 붙는다.
        _writeTokenFile(p, mcpToken);
        _copyBridge();
        console.log(`[claudePM MCP] listening on http://127.0.0.1:${p}`);
        resolve({ port: p, token: mcpToken, tokenFile: _tokenFilePath, bridgePath: _bridgeCopyPath });
      });
    };
    tryListen(port);
  });
}

function stopMcpServer() {
  return new Promise((resolve) => {
    if (!server) return resolve();
    // 죽은 인스턴스의 토큰 파일이 남아 있으면 브리지가 이미 없는 포트를 붙들게 된다.
    _removeTokenFile();
    server.close(() => {
      server = null;
      currentPort = null;
      resolve();
    });
  });
}

// Phase 2 — renderer bridge 주입 (ipc.js의 setActualMcpPort 동일 패턴, 순환 의존성 회피)
function setRendererInvoker(invoker) {
  _rendererInvoker = invoker || null;
}

// iconify API 주입 (main에서 fetch — SSRF 가드/timeout 포함). setRendererInvoker와 동일 패턴.
function setIconifyApi(api) {
  _iconifyApi = api || null;
}

// 프로젝트 단위 관리(복제 등) 주입 — main 프로세스 fs 로직(projects:duplicate 코어).
function setProjectOps(ops) {
  _projectOps = ops || null;
}

module.exports = {
  // ★계정별 프로젝트 뿌리 주입 — 경로 조립기를 둘로 만들지 않기 위한 것
  setProjectsRoot,
  /* ⚠️검사 전용 — «폴백이 격리를 되돌리는지»는 이 두 함수를 직접 흔들어야 잰다.
     도구 경유로는 그 경로에 못 닿아서(read_project 는 활성 프로젝트만 본다) 검사가 장식이 된다. */
  __test_getProjectsDir: _getProjectsDir,
  __test_readProjectFile: _readProjectFile,
  setAuthProbe,
  startMcpServer,
  stopMcpServer,
  registerTool,
  setRendererInvoker,
  setIconifyApi,
  setProjectOps,
  getToken,
  regenerateToken,
  getTokenFilePath,
  getBridgePath,
  getBridgeError,
  // 검사 로직은 «한 곳»이고, 그 한 곳을 테스트가 직접 부른다.
  _assertImageSrcIntact,
};
