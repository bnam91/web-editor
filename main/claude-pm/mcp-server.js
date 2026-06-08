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
        if (!Number.isInteger(fontSize) || fontSize < 8 || fontSize > 400) {
          throw new Error(`invalid fontSize: ${fontSize}. must be integer 8~400`);
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
          fontSize: { type: 'integer', description: 'font size in px (8~400)' },
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
      description: 'Add a card-block row containing N cards (image + title + desc each). Use for feature cards / benefit highlights. Differs from canvas-block: card-block is a row+col grid of independent cards (each gets its own cdb_* id), while canvas-block is one absolute-positioned compound block (mainly used for Figma imports). cards=[{title,desc,imgSrc?}, ...] — max 8. shared props (bgColor/radius/textAlign/titleSize/descSize) apply to all cards in the row.',
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
      if (!blockId || typeof blockId !== 'string' || !blockId.startsWith('cdb_')) {
        throw new Error(`blockId required (cdb_xxx)`);
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
      description: 'Partially update a single card-block (cdb_*). Each card in a multi-card row has its own cdb_* id — pass that id directly. Pass only fields you want changed; others are preserved. Returns {ok, blockId, applied}. Use empty string for imgSrc to remove the image. If user is editing inside the same card, returns USER_BUSY.',
      inputSchema: {
        type: 'object',
        properties: {
          blockId:   { type: 'string', description: 'cdb_xxx to update' },
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
      description: 'Edit an EXISTING banner02 block (bn2_xxx) — partial update of any field from add_banner02_block. Use to change text(label/title/sub), image(imgSrc), colors, sizes, layout swap, variant. Returns USER_BUSY if user is editing. Get blockId from get_canvas_state or returned from add_banner02_block.',
      inputSchema: {
        type: 'object',
        properties: {
          blockId: { type: 'string', description: 'bn2_xxx (banner02 block id)' },
          variant: { type: 'string', enum: ['frame_8', 'wide_4x1'] },
          width:  { type: 'integer' }, height: { type: 'integer' },
          radius: { type: 'integer' }, bg: { type: 'string' },
          align:  { type: 'string', enum: ['left','center','right'] },
          textX:  { type: 'integer' }, textY: { type: 'integer' }, textW: { type: 'integer' },
          label:      { type: 'string' }, labelSize:  { type: 'integer' }, labelColor: { type: 'string' },
          title:      { type: 'string' }, titleSize:  { type: 'integer' }, titleColor: { type: 'string' },
          sub:        { type: 'string' }, subSize:    { type: 'integer' }, subColor:   { type: 'string' },
          gap1: { type: 'integer' }, gap2: { type: 'integer' },
          imgSrc: { type: 'string' }, imgX: { type: 'integer' }, imgY: { type: 'integer' },
          imgW: { type: 'integer' }, imgH: { type: 'integer' }, imgFit: { type: 'string', enum: ['cover','contain'] },
          layout: { type: 'string', enum: ['left','right'] }
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
      description: 'Edit an EXISTING comparison block (cmp_xxx) — partial update. 외곽(featScale/overlap/radius/padX/padY/compW/headerH/rowH/rowGap/titleFont/rowFont) + featured(int) + 칼럼 전체교체(cols) + 칼럼 부분 패치(columnPatch [{index, title?, bg?, text?, rows?}]). cols 와 columnPatch 동시 지정 시 cols가 먼저 적용된다. USER_BUSY 시 즉시 반환.',
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
                rows:  { type: 'array', items: { type: 'string' } }
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
                rows:  { type: 'array', items: { type: 'string' } }
              },
              required: ['index']
            }
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

  return out;
}

// ─── comparison 옵션 검증 (add/update 공용) ────────────────────────────────
// banner02 패턴 미러. cols 배열 + columnPatch 추가 검증.
// mode='add'  → sectionId 허용, 모든 필드 optional
// mode='update' → sectionId 무시, blockId는 caller에서 처리
const _CMP_BG_RE   = /^#[0-9a-fA-F]{3,8}$|^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$/;
// gradient는 linear-gradient(...) / radial-gradient(...) / conic-gradient(...) 만 허용 (편집기 기본 패턴).
// 인자 내부: 영숫자, 공백, , % # . - + / 만 허용 → '(' ')' ';' url() expression() backslash < > 모두 차단.
// '(' ')' 차단으로 multi-background 우회 (`linear-gradient(...), url(...)`)와 nested 함수 차단.
// 따라서 gradient 안의 rgba()/hsl() 같은 nested 함수도 사용 불가 — hex/keyword/percentage 인자만 허용.
const _CMP_GRAD_INNER_RE = /^[\sa-zA-Z0-9,%#.\-+/]{1,1024}$/;
const _CMP_GRAD_HEAD_RE  = /^(linear|radial|conic)-gradient$/;

function _isValidCmpGradient(s) {
  // top-level paren 정확히 한 쌍: `<head>(<inner>)`
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
  if (!s) return ''; // 빈 문자열은 dataset 기본값으로 폴백 (clear)
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
    out.rows = c.rows.map((r, ri) => {
      if (r != null && typeof r !== 'string') throw new Error(`${label}.rows[${ri}] must be string`);
      const s = r == null ? '' : r;
      if ([...s].length > 500) throw new Error(`${label}.rows[${ri}] too long (>500 code points)`);
      return s;
    });
  }
  return out;
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
  _int('featured',  0,   7); // 최대 cols=8 → 인덱스 0~7. 실제 cols 길이와의 정합성은 renderer가 재검증.

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

  // featured와 cols 정합성 (둘 다 add에서 지정된 경우만)
  if (out.featured !== undefined && out.cols !== undefined && out.featured >= out.cols.length) {
    throw new Error(`featured ${out.featured} out of range for cols length ${out.cols.length}`);
  }

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
