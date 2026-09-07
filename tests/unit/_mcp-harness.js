/* _mcp-harness.js — MCP «진짜 디스패처»를 node 단독으로 돌리는 하네스. (F2)
 * (파일명이 _ 로 시작해 `node --test "tests/unit/*.test.js"` 글롭에 안 걸린다 — 테스트가 아니라 도구다.)
 *
 * ★왜 필요한가 (2026-09-07 실측): 단위검사 81파일 중 «MCP 디스패처를 부르는 것 0개».
 *   _ipc-harness 는 whenReady 를 pending 으로 묶어 main.js 의 MCP 등록까지 «안 닿는다».
 *   그래서 도구 83개 중 79개가 검사에 «이름조차» 없었다 — 도구를 고쳐도 아무것도 안 잡혔다.
 *
 * ★이 하네스가 «진짜»인 근거 — 흉내내지 않고 그대로 지나는 것들:
 *   HTTP(POST /mcp) · 토큰 게이트(_tokenOk) · JSON-RPC(_handleRpc) · tools/list 숨김
 *   · _serializeCall(직렬화 줄) · _noteSeq(historyTip 왕복) · _enrichApiMissing · _slimCanvasState
 *   ⇒ 배선(registerTool 줄·invoker 키·헤더)이 빠지면 여기서 «빨강»이 난다.
 *
 * ⛔포트 규약: 테스트 서버는 9345~9365 «밖»이어야 한다. 그 대역은 고디터 앱/클로드앱 커넥터가
 *   스캔하는 대역이라, 안에서 띄우면 «현빈의 클로드앱이 우리 테스트 서버에 붙는다».
 *   기본 [9370,9395] 에서 고르고, 모듈의 EADDRINUSE 폴백(+20)까지 계산해도 ≤9415 로 대역 밖이다.
 *   그래도 «믿지 않고» 기동 뒤 실제 포트를 assertOutsideBand() 로 다시 잰다.
 *
 * ⚠️ mcp-server.js 는 모듈 싱글턴(server/tools/_callChain 이 모듈 변수)이다.
 *   node --test 는 파일마다 프로세스를 나누므로 «테스트 파일 하나당 하네스 하나»가 원칙이다.
 * ⚠️ userData·projects 는 임시 디렉터리로 강제한다 — 라이브 ~/Library/Application Support 무접촉.
 *    (전자 스텁이 없으면 os.tmpdir()/goditor-mcp 로 떨어지는데, TMPDIR 이 공유라 남과 겹친다.)
 */
'use strict';
const Module = require('module');
const http = require('http');
const net = require('net');
const fs = require('fs');
const path = require('path');

const FORBIDDEN_LO = 9345, FORBIDDEN_HI = 9365;   // ⛔브리지/커넥터 스캔 대역
const BASE_LO = 9370, BASE_HI = 9395;

/** 이 포트가 금지 대역 밖인가. 「밖일 것이다」가 아니라 «실제 포트»로 잰다. */
function assertOutsideBand(port) {
  if (port >= FORBIDDEN_LO && port <= FORBIDDEN_HI) {
    throw new Error(
      `[mcp-harness] 테스트 서버가 금지 대역(${FORBIDDEN_LO}~${FORBIDDEN_HI})의 포트 ${port} 를 잡았다. ` +
      '이 대역은 클로드앱 커넥터가 스캔한다 — 사용자의 클로드앱이 테스트 서버에 붙는다. 중단한다.');
  }
  return port;
}

/* ★«비어 있는» 포트를 먼저 찾는다 — 남의 세션이 이 대역에 앉아 있다.
 *   실측(2026-09-07): srv-지디_goal-appgate 의 격리 Electron 이 9370(MCP)·9372(CDP)를 물고 있었다.
 *   모듈의 EADDRINUSE 폴백(+1)이 흡수해서 검사는 통과했지만, 「폴백이 받아줬다」에 기대면
 *   ⑴남의 포트를 두드리고 ⑵폴백 20칸을 다 쓰면 조용히 실패한다.
 *   ⇒ 바인딩 «전에» 직접 열어 보고 비어 있는 것만 고른다. 못 찾으면 «시작을 거부»한다. */
async function _freePortIn(lo, hi) {
  const tryOne = (p) => new Promise((res) => {
    const s = net.createServer();
    s.once('error', () => res(false));
    s.once('listening', () => s.close(() => res(true)));
    s.listen(p, '127.0.0.1');
  });
  const start = lo + Math.floor(Math.random() * (hi - lo + 1));
  for (let i = 0; i <= hi - lo; i++) {
    const p = lo + ((start - lo + i) % (hi - lo + 1));
    if (await tryOne(p)) return p;
  }
  throw new Error(`[mcp-harness] ${lo}~${hi} 에 빈 포트가 «하나도» 없다 — 남의 인스턴스가 대역을 다 물고 있다. ` +
    'lsof -nP -iTCP -sTCP:LISTEN 으로 확인해라. ⛔9345~9365 로는 내려가지 않는다.');
}

/** 렌더러 메서드 기본 canned 응답. 이름으로 «모양»을 고른다(도구가 뭘 기대하는지 반영). */
/* ★히스토리를 «상수»로 두면 undo 경로가 통째로 안 밟힌다.
 *   _noteSeq 는 호출 «전/후» 꼭대기 seq 가 «달라야» 우리 편집으로 기록한다(같으면 추적 안 함).
 *   그래서 편집성 렌더러 호출마다 1칸 쌓이는 작은 스택 모형을 둔다 — 그래야
 *   undo_last_mcp_change 가 NOTHING_TRACKED 로 조기 반환하지 않고 undoOnce 까지 간다. */
const _EDITY = /^(add|update|delete|move|insert|build|edit|scratchAdd)/;

function defaultCanned(fixture, hist) {
  const canned = require('./_mcp-canned');
  return {
    // ⚠️getCanvasState 는 {sectionId} 로 불린다 — 픽스처도 «섹션 필터»를 지켜야 진짜다.
    getCanvasState: async (arg) => (fixture ? fixture : canned.cannedGetCanvasState(arg)),
    historyTip: async () => ({ ok: true, seq: hist.seq, empty: hist.seq === 0, canUndo: hist.seq > 0, len: hist.seq, action: 'canned' }),
    historyHasSeq: async (s) => ({ ok: true, has: s != null && s <= hist.seq }),
    exportSections: async () => ({ ok: true, files: [] }),
    exportCollect: async () => ({ ok: true, items: [] }),
    listScratchItems: async () => ({ ok: true, items: [] }),
    readScratchItem: async () => ({ ok: true, item: { id: 'sc_1', name: 'x' } }),
    listChecklistItems: async () => ({ ok: true, items: [] }),
    getSectionMemo: async () => ({ ok: true, memo: '' }),
    undoOnce: async () => { if (hist.seq > 0) hist.seq--; return { ok: true }; },
  };
}

/* ★렌더러 브리지에는 «함수가 아닌» 것도 있다. exportCollect 는 main 쪽 다운로드 수집기
 *   객체(begin/settle/end)라, Proxy 가 함수로 감싸면 export_sections 가 'C.begin is not a
 *   function' 으로 죽는다 — 즉 «전수 호출»을 안 해봤으면 못 봤을 자리다. */
function defaultRawInvoker() {
  const log = [];
  return {
    exportCollect: {
      _log: log,
      begin(outDir) { log.push({ m: 'exportCollect.begin', outDir }); },
      async settle() { log.push({ m: 'exportCollect.settle' }); return []; },
      end() { log.push({ m: 'exportCollect.end' }); },
    },
  };
}

/**
 * 하네스 기동.
 * @param {{canned?:object, activeProject?:string|(()=>string), fixture?:object, basePort?:number}} [opts]
 */
async function startHarness(opts = {}) {
  const tmproot = require('./_tmproot');
  const userData = tmproot.mkTmpRoot('goya-mcp-');
  const projectsDir = path.join(userData, 'projects');
  fs.mkdirSync(projectsDir, { recursive: true });
  /* ★디스크 기반 도구(read_project 등)는 «파일이 있어야» 진짜 경로를 탄다.
   *   없으면 'project not found' 만 나서 도구 본문을 한 줄도 안 밟는다 — 초록도 빨강도 아닌
   *   «안 잰» 상태가 된다. 현행 저장 구조(projects/<id>/proj.json)로 씨앗을 둔다. */
  function seedProject(id, proj) {
    const d = path.join(projectsDir, id);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'proj.json'), JSON.stringify(proj || {
      id, name: 'fixture', pages: [{ id: 'pg_1', name: 'page 1', canvas: '<div id="canvas"></div>' }],
    }), 'utf8');
    return d;
  }
  for (const id of (opts.seedProjects || ['proj_1'])) seedProject(id);

  /* ── electron 스텁 ──
   * mcp-server.js 는 electron 을 «지연 require» 한다(_getUserDataDir·_getProjectsDir·_activeProjectId).
   * 스텁을 끼우면 토큰파일·브리지사본·projects 폴더가 전부 임시 디렉터리로 간다.
   * ⛔스텁이 없으면 os.tmpdir()/goditor-mcp — 공유 TMPDIR 이라 «남의 실행»과 겹친다. */
  const win = { webContents: { getURL: () => activeUrl() } };
  const stub = {
    app: { getPath: (k) => (k === 'userData' ? userData : userData) },
    BrowserWindow: { getAllWindows: () => (activeUrl() ? [win] : []) },
  };
  const origLoad = Module._load;
  if (!Module._load.__mcpHarnessPatched) {
    const patched = function (request, parent, isMain) {
      if (request === 'electron') return stubRef.current;
      return origLoad.apply(this, arguments);
    };
    patched.__mcpHarnessPatched = true;
    patched.__orig = origLoad;
    Module._load = patched;
  }
  stubRef.current = stub;

  let _active = opts.activeProject == null ? null : opts.activeProject;
  const activeProjectOf = () => (typeof _active === 'function' ? _active() : _active);
  function activeUrl() { const p = activeProjectOf(); return p ? `file:///index.html?project=${p}` : null; }

  const mod = require(path.join(__dirname, '..', '..', 'main', 'claude-pm', 'mcp-server.js'));

  /* ── ★가짜 렌더러 = Proxy ──
   * 134종 넘는 메서드를 손으로 못 적는다. Proxy 는 «무슨 이름으로 불렸든» 잡아서
   *   ⑴ 호출 시각·순서·인자를 기록하고
   *   ⑵ canned 가 있으면 그걸, 없으면 {ok:true} 를 돌려준다.
   * ⇒ 「기대한 렌더러 메서드가 «한 번» 불렸나」(배선)를 도구 전수로 잴 수 있다. */
  const calls = [];
  let seq = 0;
  const hist = { seq: 0 };
  const canned = Object.assign(defaultCanned(opts.fixture, hist), opts.canned || {});
  const raw = Object.assign(defaultRawInvoker(), opts.rawInvoker || {});
  const invoker = new Proxy({}, {
    has: () => true,
    get(_t, prop) {
      if (typeof prop === 'symbol') return undefined;
      if (prop === 'then') return undefined;               // await 오인 방지
      if (Object.prototype.hasOwnProperty.call(raw, prop)) {
        calls.push({ method: String(prop), args: ['(raw object accessed)'], seq: ++seq, t: Date.now(), hrt: process.hrtime.bigint(), raw: true });
        return raw[prop];
      }
      return async (...args) => {
        const rec = { method: String(prop), args, seq: ++seq, t: Date.now(), hrt: process.hrtime.bigint() };
        calls.push(rec);
        if (_EDITY.test(String(prop))) hist.seq++;   // 편집 한 번 = 히스토리 한 칸(모형)
        const c = canned[prop];
        const out = typeof c === 'function' ? await c(...args) : (c !== undefined ? c : { ok: true });
        rec.result = out;
        return out;
      };
    },
  });
  mod.setRendererInvoker(invoker);

  /* ★렌더러 말고도 «주입되는 배선»이 둘 더 있다(iconify·projectOps). 같은 원장에 찍어야
   *   「도구가 아무도 안 부르고 혼자 답했다」를 도구 «전수»로 잴 수 있다. */
  const logged = (ns, fns) => Object.fromEntries(Object.entries(fns).map(([k, fn]) => [k, (...args) => {
    const rec = { method: `${ns}.${k}`, args, seq: ++seq, t: Date.now(), hrt: process.hrtime.bigint() };
    calls.push(rec);
    const out = fn(...args);
    return Promise.resolve(out).then(v => { rec.result = v; return v; });
  }]));

  mod.setIconifyApi(logged('iconify', Object.assign({
    search: async () => ({ ok: true, icons: [{ name: 'ph:house-bold' }] }),
    fetchSvg: async () => ({ ok: true, svg: '<svg viewBox="0 0 24 24"/>' }),
  }, opts.iconifyApi || {})));
  /* ⚠️projectOps 는 «6개» 다 있어야 한다(list/create/open/duplicate/delete/rename). 하나라도 빠지면
   *   그 도구는 'project ops not initialized' 로 죽는데, 그건 «도구 결함»이 아니라 하네스 결함이다.
   *   ⇒ 전수 호출을 해봐야 드러난다(실제로 list_projects·create_project 가 그렇게 걸렸다). */
  mod.setProjectOps(logged('projectOps', Object.assign({
    duplicate: async () => ({ ok: true, projectId: 'proj_999' }),
    list: () => ({ ok: true, projects: [{ id: 'proj_1', name: 'fixture' }] }),
    create: async ({ name } = {}) => ({ ok: true, projectId: 'proj_2', name: name || 'new' }),
    open: async ({ projectId } = {}) => { _active = projectId || _active; return { ok: true, projectId }; },
    // ★2026-09-07 신설 delete_project 용. 진짜 fs 를 안 만지고 «계약»만 잰다 —
    //   실제 구현은 휴지통 이동(main.js _deleteProjectImpl)이라 여기서 흉내내면 안 된다.
    delete: async ({ projectId } = {}) => ({ ok: true, projectId, trashed: true,
                                             wasActive: false, activeCleared: false }),
    rename: async ({ projectId, name } = {}) => ({ ok: true, projectId, name, previousName: 'old', changed: true }),
  }, opts.projectOps || {})));

  const base = opts.basePort || await _freePortIn(BASE_LO, BASE_HI);
  if (base >= FORBIDDEN_LO && base <= FORBIDDEN_HI) throw new Error(`[mcp-harness] basePort ${base} 가 금지 대역이다.`);
  const started = await mod.startMcpServer({ port: base, onActiveProject: () => activeProjectOf() });
  const port = assertOutsideBand(started.port);
  const token = mod.getToken();

  const post = (body, { token: tk = token, headers } = {}) => new Promise((res, rej) => {
    const d = Buffer.from(JSON.stringify(body));
    const h = Object.assign({ 'Content-Type': 'application/json', 'Content-Length': d.length }, headers || {});
    if (tk !== null && tk !== undefined && !(headers && ('x-goditor-token' in headers))) h['x-goditor-token'] = tk;
    const req = http.request({ host: '127.0.0.1', port, path: '/mcp', method: 'POST', headers: h },
      (rs) => { let b = ''; rs.setEncoding('utf8'); rs.on('data', c => (b += c)); rs.on('end', () => res({ status: rs.statusCode, text: b })); });
    req.on('error', rej);
    req.end(d);
  });

  let rpcId = 0;
  /** tools/call 한 번. { ok, result(도구가 돌려준 객체), rawText(도구 응답 «원문»), bytes, rpc } */
  async function call(name, args = {}, opt) {
    const before = calls.length;
    const r = await post({ jsonrpc: '2.0', id: ++rpcId, method: 'tools/call', params: { name, arguments: args } }, opt);
    let rpc = null; try { rpc = JSON.parse(r.text); } catch (_) {}
    const text = rpc && rpc.result && rpc.result.content && rpc.result.content[0] && rpc.result.content[0].text;
    let result = null; try { result = text == null ? null : JSON.parse(text); } catch (_) { result = text; }
    return {
      status: r.status, rpc, result,
      rawText: text == null ? '' : String(text),
      bytes: text == null ? 0 : Buffer.byteLength(String(text), 'utf8'),
      /** ★이 호출이 «렌더러에 무엇을 시켰나» — 배선 판정의 근거. */
      rendererCalls: calls.slice(before),
      error: rpc && rpc.error ? rpc.error : null,
    };
  }

  async function listTools(includeHidden) {
    const r = await post({ jsonrpc: '2.0', id: ++rpcId, method: 'tools/list', params: includeHidden ? { includeHidden: true } : {} });
    const j = JSON.parse(r.text);
    if (!j.result) throw new Error('tools/list failed: ' + r.text);
    return j.result.tools;
  }

  async function health() {
    return new Promise((res, rej) => {
      http.get({ host: '127.0.0.1', port, path: '/health' }, (rs) => {
        let b = ''; rs.setEncoding('utf8'); rs.on('data', c => (b += c)); rs.on('end', () => res({ status: rs.statusCode, json: JSON.parse(b) }));
      }).on('error', rej);
    });
  }

  async function stop() {
    await mod.stopMcpServer();
    if (Module._load.__mcpHarnessPatched) Module._load = Module._load.__orig;
  }

  /* ★프로젝트 «확정» — feat/mcp-project-gate(caf8045) 이후 쓰기 도구 71개는
   *   「어느 프로젝트인지 지목하지 않으면 안 쓴다」로 막힌다(sticky, 대화당 왕복 +2).
   *   ⇒ 하네스도 «사람이 쓰듯» 먼저 대상을 고른다. 안 그러면 전수 호출이 전부 거절되고,
   *      그건 «도구 결함»이 아니라 하네스가 클라이언트 흉내를 안 낸 것이다(09-07 실측).
   *   ⛔기본으로 확정하되 «끄고» 부를 수 있어야 한다 — 게이트가 실제로 «막는지»를 재려면
   *      확정 «안 한» 상태가 필요하다. confirmProject:false 가 그 자리다. */
  async function confirmTarget(projectId) {
    const pid = projectId || activeProjectOf();
    if (!pid) throw new Error('[mcp-harness] 확정할 프로젝트가 없다 — activeProject 를 먼저 줘라');
    const r = await call('open_project', { projectId: pid });
    if (!r.result || r.result.ok !== true) {
      throw new Error(`[mcp-harness] open_project 실패 — 확정이 안 섰다: ${JSON.stringify(r.result || r.error)}`);
    }
    return r.result;
  }
  if (opts.confirmProject !== false && activeProjectOf()) await confirmTarget();

  return {
    mod, port, token, userData, projectsDir, seedProject, confirmTarget,
    /** ★렌더러 호출 원장 — 시각(hrt)·순서(seq)·인자까지. F7 양끝 계측의 «렌더러 쪽 끝». */
    calls,
    /** _noteSeq 가 무조건 끼워넣는 historyTip 왕복을 뺀 «도구가 시킨 일»만. */
    workCalls: () => calls.filter(c => c.method !== 'historyTip'),
    reset: () => { calls.length = 0; },
    /* ★한 프로세스에 하네스는 «하나»다(mcp-server.js 는 모듈 싱글턴 — 두 번째 startMcpServer 는
       alreadyRunning 을 돌려주고, 그쪽 stop() 이 «첫 번째» 서버를 죽인다. 실제로 ECONNRESET 로
       겪었다). 다른 캔버스로 재고 싶으면 서버를 또 띄우지 말고 canned 를 갈아끼워라. */
    setCanned: (name, fn) => { const prev = canned[name]; canned[name] = fn; return () => { canned[name] = prev; }; },
    setActiveProject: (p) => { _active = p; },
    call, listTools, health, post, stop, hist,
    FORBIDDEN_LO, FORBIDDEN_HI, assertOutsideBand,
  };
}

const stubRef = { current: null };

module.exports = { startHarness, assertOutsideBand, FORBIDDEN_LO, FORBIDDEN_HI, defaultCanned, _freePortIn };
