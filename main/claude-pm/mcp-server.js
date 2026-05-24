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
const fs = require('fs');
const path = require('path');

let server = null;
let currentPort = null;
let onActiveProjectCb = null;
// Phase 2: renderer 측 write 작업(예: window.addTextBlock)을 main에서 호출하는 bridge.
// main.js가 setRendererInvoker({addTextBlock})로 주입 (순환 의존성 회피).
let _rendererInvoker = null;

const tools = new Map();
const toolSchemas = new Map();

const PROTOCOL_VERSION = '2024-11-05';
const SERVER_INFO = { name: 'goditor-claude-pm', version: '0.1.0' };

// ─────────────────────────────────────────────
// Tool registration
// ─────────────────────────────────────────────
function registerTool(name, handler, schema) {
  tools.set(name, handler);
  if (schema) toolSchemas.set(name, schema);
}

function _getProjectsDir() {
  // main process의 app.getPath('userData') 기준 projects 폴더가 정석이지만,
  // 단독 실행 시는 web-editor/projects 사용.
  try {
    const { app } = require('electron');
    if (app && app.getPath) {
      return path.join(app.getPath('userData'), 'projects');
    }
  } catch (_) {}
  return path.join(__dirname, '..', '..', 'projects');
}

function _readProjectFile(projectId) {
  const dir = _getProjectsDir();
  const file = path.join(dir, `${projectId}.json`);
  if (!fs.existsSync(file)) {
    // fallback: 단독 실행/개발용
    const alt = path.join(__dirname, '..', '..', 'projects', `${projectId}.json`);
    if (fs.existsSync(alt)) {
      return JSON.parse(fs.readFileSync(alt, 'utf8'));
    }
    throw new Error(`project not found: ${projectId}`);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// ─────────────────────────────────────────────
// Default tools
// ─────────────────────────────────────────────
function _registerDefaultTools() {
  registerTool(
    'read_project',
    async () => {
      const pid = onActiveProjectCb ? onActiveProjectCb() : null;
      if (!pid) throw new Error('no active project');
      const proj = _readProjectFile(pid);
      return { projectId: pid, project: proj };
    },
    {
      description: 'Read the currently active Goditor project JSON.',
      inputSchema: { type: 'object', properties: {}, required: [] }
    }
  );

  registerTool(
    'read_section',
    async ({ sectionId } = {}) => {
      if (!sectionId) throw new Error('sectionId required');
      const pid = onActiveProjectCb ? onActiveProjectCb() : null;
      if (!pid) throw new Error('no active project');
      const proj = _readProjectFile(pid);
      const sections = (proj && (proj.sections || proj.data?.sections)) || [];
      const sec = sections.find(s => s.id === sectionId);
      if (!sec) throw new Error(`section not found: ${sectionId}`);

      // 텍스트 추출 (depth-first)
      const texts = [];
      const walk = (node) => {
        if (!node || typeof node !== 'object') return;
        if (typeof node.text === 'string') texts.push(node.text);
        if (typeof node.content === 'string') texts.push(node.content);
        if (Array.isArray(node.children)) node.children.forEach(walk);
        if (Array.isArray(node.blocks)) node.blocks.forEach(walk);
        if (Array.isArray(node.rows)) node.rows.forEach(walk);
        if (Array.isArray(node.cols)) node.cols.forEach(walk);
      };
      walk(sec);
      return { sectionId, section: sec, texts };
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
      const folder = projectFolder || _getProjectsDir();
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
  registerTool(
    'add_section',
    async ({ empty = false, bg } = {}) => {
      if (!_rendererInvoker || typeof _rendererInvoker.addSection !== 'function') {
        throw new Error('renderer bridge not initialized (setRendererInvoker not called)');
      }
      if (bg !== undefined && !/^#?[0-9a-fA-F]{3,8}$/.test(String(bg))) {
        throw new Error(`invalid bg color: ${bg}`);
      }
      return await _rendererInvoker.addSection({ empty: !!empty, bg });
    },
    {
      description: 'Add a new section to the canvas (Phase 3 MVP). Default = gap + h2 placeholder + gap. empty:true = only top/bottom gap blocks. Requires user not editing — returns { ok:false, code:"USER_BUSY" } if user is typing.',
      inputSchema: {
        type: 'object',
        properties: {
          empty: { type: 'boolean', description: 'true = skip default h2 block (only gap blocks). default false' },
          bg: { type: 'string', description: 'optional section background hex color (e.g. #f5f5f5)' }
        },
        required: []
      }
    }
  );

  // Phase 3 MVP — 비율 프리셋 에셋(이미지 자리) row 추가. renderer의 window.addPresetRow 호출.
  // 이미지 *생성*은 안 함 — 비율 잡힌 자리만 만들고 사용자가 채움.
  registerTool(
    'add_asset_block',
    async ({ preset = 'img1' } = {}) => {
      if (!_rendererInvoker || typeof _rendererInvoker.addAssetBlock !== 'function') {
        throw new Error('renderer bridge not initialized (setRendererInvoker not called)');
      }
      const allowed = ['img1', 'img2', 'img3', 'text-img'];
      if (!allowed.includes(preset)) {
        throw new Error(`invalid preset: ${preset}. allowed: ${allowed.join('|')}`);
      }
      return await _rendererInvoker.addAssetBlock({ preset });
    },
    {
      description: 'Add an image-placeholder row with a ratio preset (Phase 3 MVP). Does NOT generate images — only the ratio-sized slot for the user to fill. img1=single full-width, img2=2-up 1:1, img3=3-up 1:1:1, text-img=text+image 1:1.',
      inputSchema: {
        type: 'object',
        properties: {
          preset: { type: 'string', enum: ['img1', 'img2', 'img3', 'text-img'], description: 'asset layout preset (default img1)' }
        },
        required: []
      }
    }
  );

  // Phase 3 MVP — 기본 섹션 한 번에 조립: 메인카피(h1) + 본문(body) + 에셋(img1). 라벨 옵션.
  // 갭/폰트는 sec_wd3nixu 실측 토큰 적용 (제목100/본문30, 갭 100/50/30).
  registerTool(
    'build_basic_section',
    async ({ mainCopy = '', body = '', label, assetPreset = 'img1', align = 'center' } = {}) => {
      if (!_rendererInvoker || typeof _rendererInvoker.buildBasicSection !== 'function') {
        throw new Error('renderer bridge not initialized (setRendererInvoker not called)');
      }
      const mc = String(mainCopy || '');
      if ([...mc].length === 0) throw new Error('mainCopy required');
      if ([...mc].length > 200) throw new Error('mainCopy too long (>200)');
      const bd = String(body || '');
      if ([...bd].length > 800) throw new Error('body too long (>800)');
      const allowed = ['img1', 'img2', 'img3', 'text-img'];
      if (!allowed.includes(assetPreset)) throw new Error(`invalid assetPreset: ${assetPreset}`);
      if (!['left', 'center', 'right'].includes(align)) throw new Error(`invalid align: ${align}`);
      const lb = label !== undefined ? String(label) : null;
      if (lb !== null && [...lb].length > 60) throw new Error('label too long (>60)');
      return await _rendererInvoker.buildBasicSection({ mainCopy: mc, body: bd, label: lb, assetPreset, align });
    },
    {
      description: 'Build a basic section in one call: main copy (h1, 100px) + body (30px) + asset placeholder (img1). Optional label (small bold). Gaps follow standard tokens (100/50/30). Text centered by default (align). Use when user says "기본 섹션 만들어줘" or gives content for a single section without specifying layout.',
      inputSchema: {
        type: 'object',
        properties: {
          mainCopy: { type: 'string', description: 'main headline text (required, ~200)' },
          body: { type: 'string', description: 'body/subcopy text (optional, ~800)' },
          label: { type: 'string', description: 'optional small label above the headline (e.g. NEW ARRIVAL)' },
          assetPreset: { type: 'string', enum: ['img1', 'img2', 'img3', 'text-img'], description: 'asset layout (default img1)' },
          align: { type: 'string', enum: ['left', 'center', 'right'], description: 'text align (default center — hero/Hook convention)' }
        },
        required: ['mainCopy']
      }
    }
  );

  // PM get_canvas_state — 캔버스를 구조화 데이터로 조회 (READ-ONLY, mutation 없음 → USER_BUSY 불필요).
  registerTool(
    'get_canvas_state',
    async ({ sectionId } = {}) => {
      if (!_rendererInvoker || typeof _rendererInvoker.getCanvasState !== 'function') {
        throw new Error('renderer bridge not initialized (setRendererInvoker not called)');
      }
      if (sectionId !== undefined && sectionId !== null) {
        if (typeof sectionId !== 'string' || !sectionId.startsWith('sec_')) {
          throw new Error(`invalid sectionId: ${sectionId} (expected string starting with "sec_")`);
        }
      }
      return await _rendererInvoker.getCanvasState({ sectionId });
    },
    {
      description: 'Read the canvas as structured data: every section with its blocks (blockId, type, text, color, fontSize, align). Use to find the blockId of a specific text before calling update_block. Read-only.',
      inputSchema: {
        type: 'object',
        properties: {
          sectionId: { type: 'string', description: 'optional sec_xxx — if omitted, returns all sections on the active page' }
        },
        required: []
      }
    }
  );
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
      for (const [name] of tools) {
        const schema = toolSchemas.get(name) || {};
        list.push({
          name,
          description: schema.description || '',
          inputSchema: schema.inputSchema || { type: 'object', properties: {} }
        });
      }
      return ok({ tools: list });
    }

    if (method === 'tools/call') {
      const { name, arguments: args = {} } = params || {};
      const handler = tools.get(name);
      if (!handler) return err(-32601, `tool not found: ${name}`);
      const result = await handler(args);
      return ok({
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        isError: false
      });
    }

    return err(-32601, `method not found: ${method}`);
  } catch (e) {
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
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        port: currentPort,
        server: SERVER_INFO,
        tools: Array.from(tools.keys())
      }));
      return;
    }

    if (req.method === 'POST' && req.url && req.url.startsWith('/mcp')) {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
        try {
          const msg = body ? JSON.parse(body) : {};
          const result = await _handleRpc(msg);
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
          console.warn(`[claudePM MCP] port ${p} busy — trying ${p + 1}`);
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
        console.log(`[claudePM MCP] listening on http://127.0.0.1:${p}`);
        resolve({ port: p });
      });
    };
    tryListen(port);
  });
}

function stopMcpServer() {
  return new Promise((resolve) => {
    if (!server) return resolve();
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

module.exports = {
  startMcpServer,
  stopMcpServer,
  registerTool,
  setRendererInvoker,
};
