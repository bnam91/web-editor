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
          // 외곽
          width:  { type: 'integer', description: '배너 가로 (80~4000). variant 기본값 사용 권장' },
          height: { type: 'integer', description: '배너 세로 (40~4000)' },
          radius: { type: 'integer', description: '모서리 반경 px (0~400)' },
          bg:     { type: 'string',  description: '배경 색상 (hex 또는 css color string). default variant 기본값' },
          align:  { type: 'string', enum: ['left','center','right'], description: '텍스트 정렬. default left' },
          // 텍스트 박스
          textX: { type: 'integer', description: '텍스트 박스 X (-4000~4000)' },
          textY: { type: 'integer', description: '텍스트 박스 Y' },
          textW: { type: 'integer', description: '텍스트 박스 너비 (20~4000)' },
          // 텍스트
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
          // 이미지
          imgSrc: { type: 'string', description: '이미지 URL 또는 dataURL (≤200000). " 와 개행 금지 (CSS url("") 안전)' },
          imgX: { type: 'integer', description: '이미지 X' },
          imgY: { type: 'integer', description: '이미지 Y' },
          imgW: { type: 'integer', description: '이미지 너비 (4~4000)' },
          imgH: { type: 'integer', description: '이미지 높이 (4~4000)' },
          imgFit: { type: 'string', enum: ['cover','contain'], description: '이미지 fit. default cover' },
          // 편의 — text/image 좌우 swap
          layout: { type: 'string', enum: ['left','right'], description: 'text 위치 (left=텍스트 왼쪽 + 이미지 오른쪽, right=반대). 미지정 시 variant 기본값.' }
        },
        required: []
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
}

// ─── banner02 옵션 검증 (add/update 공용) ───────────────────────────────────
// mode='add'  → sectionId 허용, 모든 필드 optional (block-factory가 기본값 채움)
// mode='update' → sectionId 무시, blockId는 caller에서 처리. 빈 객체도 허용 (caller가 별도 체크).
function _validateBanner02Opts(args, { mode } = {}) {
  if (!args || typeof args !== 'object') throw new Error('args must be object');
  const out = {};

  // 정수 가드
  const _int = (key, min, max) => {
    if (args[key] === undefined || args[key] === null) return;
    const n = args[key];
    if (!Number.isInteger(n)) throw new Error(`${key} must be integer`);
    if (min !== undefined && n < min) throw new Error(`${key} < ${min}`);
    if (max !== undefined && n > max) throw new Error(`${key} > ${max}`);
    out[key] = n;
  };
  // 문자열 (length code-point) 가드
  const _str = (key, maxLen) => {
    if (args[key] === undefined || args[key] === null) return;
    if (typeof args[key] !== 'string') throw new Error(`${key} must be string`);
    if (maxLen !== undefined && [...args[key]].length > maxLen) {
      throw new Error(`${key} too long (>${maxLen} code points)`);
    }
    out[key] = args[key];
  };
  // hex/css color (loose)
  const _color = (key) => {
    if (args[key] === undefined || args[key] === null) return;
    if (typeof args[key] !== 'string') throw new Error(`${key} must be string`);
    const v = args[key].trim();
    if (v.length === 0) throw new Error(`${key} empty`);
    if (v.length > 64) throw new Error(`${key} too long`);
    // 너무 빡빡하게 잡지 않음 (rgba(), named color 허용). 단, "<>"는 금지 (HTML 주입 안전성).
    if (/[<>"]/.test(v)) throw new Error(`${key} contains unsafe chars`);
    out[key] = v;
  };
  // enum
  const _enum = (key, allowed) => {
    if (args[key] === undefined || args[key] === null) return;
    if (!allowed.includes(args[key])) throw new Error(`invalid ${key}: ${args[key]}. allowed: ${allowed.join('|')}`);
    out[key] = args[key];
  };

  // sectionId (add 모드에서만 의미. update는 caller가 분리)
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

  // imgSrc — CSS url("") 탈출/줄넘김 차단 (banner02-block.js renderBanner02 미러 가드)
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
