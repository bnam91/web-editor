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
// main.js가 setIconifyApi({search, fetchSvg})로 주입. main 측에서 직접 fetch (SSRF/CSP 안전).
let _iconifyApi = null;

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
    async ({ sectionId, bg } = {}) => {
      if (!sectionId || !sectionId.startsWith('sec_')) throw new Error('sectionId required (sec_xxx)');
      if (bg !== undefined && bg !== null && !/^#?[0-9a-fA-F]{3,8}$|^transparent$|^rgb/.test(String(bg))) {
        throw new Error(`invalid bg: ${bg}`);
      }
      if (!_rendererInvoker?.updateSection) throw new Error('renderer bridge not ready');
      return await _rendererInvoker.updateSection({ sectionId, bg });
    },
    {
      description: 'Update section properties (bg color, etc.). Use for changing existing section background. bg: hex color (#000, #ffffff) or "transparent".',
      inputSchema: {
        type: 'object',
        properties: {
          sectionId: { type: 'string', description: 'sec_xxx to update' },
          bg: { type: 'string', description: 'background color (hex like #000000 or "transparent")' }
        },
        required: ['sectionId']
      }
    }
  );

  // PM delete_section — 섹션 삭제 (마지막 섹션은 삭제 불가)
  registerTool(
    'delete_section',
    async ({ sectionId } = {}) => {
      if (!sectionId || typeof sectionId !== 'string' || !sectionId.startsWith('sec_')) {
        throw new Error('sectionId required (sec_xxx)');
      }
      if (!_rendererInvoker?.deleteSection) throw new Error('renderer bridge not ready');
      return await _rendererInvoker.deleteSection({ sectionId });
    },
    {
      description: 'Delete a section by id. Last section is protected (will return code:DELETE_FAILED).',
      inputSchema: {
        type: 'object',
        properties: { sectionId: { type: 'string', description: 'sec_xxx to remove' } },
        required: ['sectionId']
      }
    }
  );

  // PM delete_block — 일반 블록 삭제 (text/asset/gap/frame 등). section은 delete_section 사용.
  registerTool(
    'delete_block',
    async ({ blockId } = {}) => {
      if (!blockId || typeof blockId !== 'string') throw new Error('blockId required');
      if (!_rendererInvoker?.deleteBlock) throw new Error('renderer bridge not ready');
      return await _rendererInvoker.deleteBlock({ blockId });
    },
    {
      description: 'Delete a non-section block by id (tb_/ab_/gb_/cvb_/ss_ etc.). For sections use delete_section.',
      inputSchema: {
        type: 'object',
        properties: { blockId: { type: 'string', description: 'block id to remove (any prefix except sec_)' } },
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
          gridRows: { type: 'integer', description: '그리드 행 수 (1~4). default 1' },
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
          gridRows:  { type: 'integer', description: '그리드 행 수 (1~4). 변경 시 cards 자동 sync' },
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
      const partial = _validateAssetOpts(rest, { mode: 'update' });
      if (Object.keys(partial).length === 0) {
        throw new Error('no fields to update — provide at least one asset field');
      }
      return await _rendererInvoker.updateAssetBlock({ blockId, partial });
    },
    {
      description: 'Edit an EXISTING asset block (ab_xxx) — partial update of any field. width(100~860, 860+=full bleed), height(200~1600), borderRadius(0~120). align(left|center|right) syncs alignSelf. usePadx(true|false) auto-applies negative margins + width calc using section-inner padX. fit(cover|contain) syncs img.style.objectFit. bgColor accepts hex/rgb(a)/hsl(a)/transparent; "" resets. overlay(true|false) ensures .asset-overlay child. overlayOpacity(0~100) maps to rgba alpha. overlayPosition(flex-start|center|flex-end) sets justifyContent. preset=logo forces 200x64 and disables width opt; preset=none clears it. imgSrc accepts data:image/*|http(s)|assets/ ≤200000 chars; "" calls clearAssetImage(). baseHeight auto-syncs with height. Returns USER_BUSY if user is editing. Get blockId from get_canvas_state.',
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
          imgSrc: { type: 'string', description: 'data:image/* | http(s) | assets/ (≤200000). Empty string clears the image via clearAssetImage().' },
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
  _int('gridRows', 1, 4);
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

// ─── asset-block validator ───
// ─── asset 옵션 검증 (update only — add는 별도 add_asset_block에서 직접 검증) ──
// banner02 _validateBanner02Opts 패턴 미러. update 모드 전용 (sectionId 검증 없음).
function _validateAssetOpts(args, { mode } = {}) {
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
    out.imgSrc = args.imgSrc;
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

// iconify API 주입 (main에서 fetch — SSRF 가드/timeout 포함). setRendererInvoker와 동일 패턴.
function setIconifyApi(api) {
  _iconifyApi = api || null;
}

module.exports = {
  startMcpServer,
  stopMcpServer,
  registerTool,
  setRendererInvoker,
  setIconifyApi,
};
