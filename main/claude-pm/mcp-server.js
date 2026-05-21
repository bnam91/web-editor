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

module.exports = {
  startMcpServer,
  stopMcpServer,
  registerTool,
};
