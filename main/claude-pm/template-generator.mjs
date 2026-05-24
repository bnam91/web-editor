// main/claude-pm/template-generator.mjs
// Claude PM Phase 2 - PM-B
// CLAUDE.md + project.meta.json + NOTES.md + archive/ 생성·관리 모듈
//
// ES module. Node 18+ assumed (fs/promises, path).
// CommonJS host (main.js)에서는 dynamic import()로 로드.

import fs from 'node:fs/promises';
import path from 'node:path';

// -------------------- 상수 --------------------
const CLAUDE_MD = 'CLAUDE.md';
const META_JSON = 'project.meta.json';
const NOTES_MD = 'NOTES.md';
const MCP_JSON = '.mcp.json';
const ARCHIVE_DIR = 'archive';

const MAX_LINES = 180;            // CLAUDE.md size cap
const MAX_DECISIONS = 15;
const MAX_HISTORY = 10;
const MEMO_TYPES = ['Preference', 'Constraint', 'Decision', 'Feedback'];

// -------------------- 내부 유틸 --------------------
async function _safeWriteFile(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

async function _archiveDir(folderPath) {
  const dir = path.join(folderPath, ARCHIVE_DIR);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function _readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function _writeJson(filePath, obj) {
  await _safeWriteFile(filePath, JSON.stringify(obj, null, 2) + '\n');
}

function _isoNow() {
  return new Date().toISOString();
}

function _todayStamp() {
  // YYYYMMDD-HHMMSS
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

// Goditor JSON에서 sections 추출 (canvas가 HTML string)
function _extractSections(goditorProjectJson) {
  const out = [];
  if (!goditorProjectJson || typeof goditorProjectJson !== 'object') return out;
  const pages = Array.isArray(goditorProjectJson.pages) ? goditorProjectJson.pages : [];
  const seen = new Set();
  for (const p of pages) {
    const canvas = p && p.canvas;
    if (typeof canvas !== 'string') continue;
    // <... id="sec_xxx" ... data-name="..." ...>
    const re = /id="(sec_[a-zA-Z0-9_]+)"([^>]*)/g;
    let m;
    while ((m = re.exec(canvas))) {
      const id = m[1];
      if (seen.has(id)) continue;
      seen.add(id);
      const tail = m[2] || '';
      const nameMatch = tail.match(/data-name="([^"]+)"/);
      const summary = nameMatch ? nameMatch[1] : '';
      out.push({ id, summary });
    }
  }
  return out;
}

// -------------------- 기본 meta --------------------
function _defaultMeta({ projectId, projectName, sections }) {
  const now = _isoNow();
  return {
    title: projectName || '',
    id: projectId || '',
    createdAt: now,
    updatedAt: now,
    tldr: '',
    target: '',
    usp: '',
    designDirection: '',
    sections: sections || [],
    progress: { hook: 'pending', main: 'pending', detail: 'pending', cta: 'pending' },
    decisions: [],
    history: [],
  };
}

// -------------------- 렌더링 --------------------
export function renderClaudeMd(meta) {
  const m = meta || {};
  const sections = Array.isArray(m.sections) ? m.sections : [];
  const decisions = Array.isArray(m.decisions) ? m.decisions : [];
  const history = Array.isArray(m.history) ? m.history : [];
  const progress = m.progress || { hook: 'pending', main: 'pending', detail: 'pending', cta: 'pending' };

  const activeDecisions = decisions.filter((d) => !d.superseded).slice(-MAX_DECISIONS);
  const recentHistory = history.slice(-MAX_HISTORY);

  const sectionLines = sections.length
    ? sections.map((s) => `- ${s.id}: ${s.summary || ''}`.trimEnd()).join('\n')
    : '- (없음)';

  const decisionLines = activeDecisions.length
    ? activeDecisions.map((d) => `- ${d.text}`).join('\n')
    : '- (없음)';

  const historyLines = recentHistory.length
    ? recentHistory.map((h) => `- [${(h.addedAt || '').slice(0, 19)}] ${h.text}`).join('\n')
    : '- (없음)';

  return [
    '# CLAUDE.md',
    '## Project',
    `- Title: ${m.title || ''}`,
    `- ID: ${m.id || ''}`,
    `- Created: ${(m.createdAt || '').slice(0, 10)}`,
    `- Updated: ${(m.updatedAt || '').slice(0, 10)}`,
    '',
    '## Role',
    '이 디자인 프로젝트의 **Project Manager**. 사용자가 Goditor로 상세페이지 만드는 작업을 보조한다.',
    '책임: 컨텍스트 파악(읽기), 디자인 결정 정리(NOTES.md), 사용자 질의 답변, 작업 흐름 안내.',
    '',
    '## TLDR Context',
    m.tldr ? m.tldr : '(3-5문장 압축 요약. 빈 상태로 시작, 사용자가 채움)',
    '',
    '## Target / USP / Design Direction',
    `- Target: ${m.target || ''}`,
    `- USP: ${m.usp || ''}`,
    `- Design: ${m.designDirection || ''}`,
    '',
    '## Current Permission (Phase 3: 캔버스 쓰기 도구 활성화)',
    '허용된 MCP tools:',
    '',
    '### 읽기',
    '- `read_project` — 현재 활성 Goditor 프로젝트 JSON 전체 조회',
    '- `read_section` — sec_xxx 섹션 텍스트 추출',
    '- `get_canvas_state` — 섹션/블록 트리 조회(`{ sectionId? }`). 수정 대상 blockId 찾기용',
    '- `list_memories` — NOTES.md / project.meta.json 메모 조회',
    '',
    '### 쓰기 (캔버스 조작)',
    '- `build_basic_section` ⭐ — **기본 섹션 한 번에 조립** (가장 자주 쓸 도구)',
    '   • params: `{ mainCopy: string (필수, 메인카피=대제목), body?: string (본문), label?: string (작은 라벨), assetPreset?: "img1"|"img2"|"img3"|"text-img" (default img1) }`',
    '   • 구조: 라벨 → 메인카피(h1,100px) → 본문(body,30px) → 이미지자리. 갭 100/50/30 자동',
    '   • "기본 섹션 만들어줘" / "~한 내용으로 섹션 만들어줘" 같은 요청 → 이 도구 우선 사용',
    '   • 결과: `{ ok:true, sectionId, blocksInSection }`',
    '- `add_section` — 빈/기본 섹션 1개. `{ empty?: bool, bg?: hex }`. 세밀 조립 시작점',
    '- `add_text_block` — 텍스트 블록 1개. `{ type: "h1"|"h2"|"h3"|"body"|"label"|"caption"|"bullet" (default body), content: string(1~500), sectionId? }`',
    '- `add_asset_block` — 이미지 자리(비율 프리셋). `{ preset: "img1"|"img2"|"img3"|"text-img", sectionId? }`. *이미지 생성 X, 비율 자리만*. `sectionId` 주면 선택 섹션 아닌 특정 섹션에 추가',
    '',
    '### 수정(편집)',
    '- `update_block` — 기존 텍스트 블록 수정. `{ blockId(tb_xxx, 필수), content?, color?(hex), fontSize?(8~400), fontWeight?(100~900|normal|bold), align?(left|center|right) }`',
    '   • 흐름: `get_canvas_state`로 대상 blockId 찾기 → `update_block`. 보낸 필드만 변경(undo 1단위)',
    '   • `{ ok:false, code:"USER_BUSY" }` → 1회 재시도 후 양해 / `"NOT_FOUND"` → 다시 조회. 텍스트 블록만, 삭제/이동/비텍스트 수정 불가',
    '   • **상세·예시는 ./design-knowledge/EDITING.md 참조** (여기엔 요약만)',
    '',
    '### 공통 규칙',
    '- 모든 쓰기 도구: 사용자가 입력 중(activeElement editable / 최근 1.5s 키입력)이면 `{ ok:false, code:"USER_BUSY", retryAfter:2000 }` 반환 → **1회만 재시도 후** 사용자에게 양해. 무한 재시도 금지',
    '- 활성 섹션 없으면 첫 섹션 자동 선택됨',
    '- 디자인 규칙(폰트/갭/컬러)은 `./design-knowledge/` 참조 (있으면). 프로젝트 변수(메인컬러/타깃/USP)는 project.meta.json',
    '- 수정/편집 작업 상세는 `./design-knowledge/EDITING.md` 참조',
    '',
    '⚠️ 아직 없는 도구: 블록 **삭제/이동/순서변경**, **비텍스트 블록**(에셋·구분선 등) 속성 수정, `apply_theme`(컬러토큰), "다듬어줘"류 **의도→구조 자동 플래너**.',
    '   이런 동작 요청 시 "현재는 텍스트 추가·수정만 가능"이라 안내하고, "다듬어줘"는 사용자와 분해해 `update_block` 여러 번으로 처리.',
    '',
    '## Edit Boundaries (Native Tools: Read / Write / Edit / Bash)',
    'MCP 권한과 별개로, claude code의 native file tool 사용 시 다음 경계를 지킨다.',
    '',
    '✏️ 수정 가능 (사용자 명시 요청 시):',
    '- `./NOTES.md` — 4분류(Preference / Constraint / Decision / Feedback) 메모만. 다른 텍스트 임의 추가 X',
    '- `./project.meta.json` 의 다음 필드만: `tldr` / `target` / `usp` / `designDirection` / `decisions` / `history`',
    '',
    '⛔ 절대 수정 금지:',
    '- `./.mcp.json` — MCP 설정',
    '- `./project.meta.json` 의 `.id` / `.createdAt` (시스템 필드, 바뀌면 매핑 깨짐)',
    '- `./CLAUDE.md` — 자기 자신 (사용자 명시 승인 + "이 룰 바꾼다" 알림 후만)',
    '- `../proj_*.json` — Goditor 본 (read_project MCP tool 로만 read)',
    '- `../images/` / `../assets/` — 사용자 자산 (`ls` / Read 만 허용)',
    '- Goditor 앱 소스 코드 자체 (이 폴더 밖 영역) — 별도 작업 영역',
    '',
    '🤔 모호한 경우: 사용자에게 묻기. "더 이상 묻지 않기"는 사용자 명시 활성화 후만.',
    '',
    '## Project Resources',
    '- Goditor JSON: `read_project` MCP tool 사용 (또는 `./project.goditor.json` 스냅샷)',
    '- Assets (사용자 업로드): `../assets/` — 좌측 Assets 탭에서 업로드한 이미지/파일. `ls`로 확인 가능',
    '- Meta: `./project.meta.json`',
    '- Notes: `./NOTES.md` (4분류: Preference / Constraint / Decision / Feedback)',
    '- Archive: `./archive/` (오래된 decisions/history 자동 보관)',
    '',
    '## Reference Docs',
    '- API 함수 목록: `/Users/a1/web-editor/docs/goditor-api-reference.md`',
    '- 속성 패널 명세: `/Users/a1/web-editor/docs/RIGHT_PANEL_PROPS.md`',
    '- 블록 추가 패널: `/Users/a1/web-editor/docs/FLOATING_PANEL.md`',
    '- 디자인 시스템: `/Users/a1/web-editor/_context/DESIGN_SYSTEM.md`',
    '- 전체 작업 지침: `/Users/a1/web-editor/CLAUDE.md`',
    '',
    '## MCP',
    '- Endpoint: `http://localhost:9345/mcp` (HTTP transport)',
    '- 설정 파일: `./.mcp.json` (자동 생성됨)',
    '',
    '## Sections',
    sectionLines,
    '',
    '## Progress',
    `- Hook: ${progress.hook || 'pending'}`,
    `- Main: ${progress.main || 'pending'}`,
    `- Detail: ${progress.detail || 'pending'}`,
    `- CTA: ${progress.cta || 'pending'}`,
    '',
    '## Current Decisions',
    decisionLines,
    '',
    '## Recent History',
    historyLines,
    '',
    '## PM Rules',
    '- 먼저 이 파일 읽고 현재 결정 사항 우선 적용',
    '- 메모 추가 시 NOTES.md 4분류 사용 (Preference / Constraint / Decision / Feedback)',
    '- 긴 메모는 NOTES.md, CLAUDE.md엔 요약만',
    '- 새 피드백이 기존 결정과 충돌하면 사용자에게 확인',
    '- 캔버스 수정 요청은 Phase 1 권한 안내 후 사용자가 직접 처리',
    '',
    '## Future',
    '- `add_section(role)` — Hook/Main/Detail/CTA 의미 단위 섹션 생성',
    '- 블록 삭제 / 이동 / 순서변경',
    '- 비텍스트 블록(에셋·구분선 등) 속성 수정',
    '- `apply_theme(blockId, token)` — Preference → 디자인 토큰 매핑',
    '- 의도→구조 매핑 플래너: "Hook 섹션 만들어줘" / "다듬어줘" → 도구 시퀀스 자동',
    '- dry-run 미리보기 + 사용자 컨펌',
    '',
  ].join('\n');
}

function _renderNotesMd() {
  return [
    '# Notes',
    '',
    '## Preferences',
    '- ',
    '',
    '## Constraints',
    '- ',
    '',
    '## Decisions (원문)',
    '- ',
    '',
    '## Feedback',
    '- ',
    '',
  ].join('\n');
}

function _renderMcpJson() {
  // Claude Code 표준 형식: type/url 최상위 (transport 래퍼 X — 래퍼 쓰면 인식 실패).
  return JSON.stringify(
    {
      mcpServers: {
        goditor: { type: 'http', url: 'http://localhost:9345/mcp' },
      },
    },
    null,
    2,
  ) + '\n';
}

// -------------------- 공개 API --------------------

/**
 * 신규 프로젝트 폴더 생성.
 * @param {{basePath:string, projectName:string, projectId?:string, goditorProjectJson?:object}} opts
 * @returns {Promise<{folderPath:string, meta:object}>}
 */
export async function generateFolder(opts) {
  const { basePath, projectName, projectId, goditorProjectJson } = opts || {};
  if (!basePath) throw new Error('generateFolder: basePath required');
  if (!projectName) throw new Error('generateFolder: projectName required');

  await fs.mkdir(basePath, { recursive: true });
  await _archiveDir(basePath);

  const sections = _extractSections(goditorProjectJson);
  const id = projectId || (goditorProjectJson && goditorProjectJson.id) || `proj_${Date.now()}`;
  const meta = _defaultMeta({ projectId: id, projectName, sections });

  await _writeJson(path.join(basePath, META_JSON), meta);
  await _safeWriteFile(path.join(basePath, CLAUDE_MD), renderClaudeMd(meta));
  await _safeWriteFile(path.join(basePath, NOTES_MD), _renderNotesMd());
  await _safeWriteFile(path.join(basePath, MCP_JSON), _renderMcpJson());

  // optional: goditor JSON snapshot
  if (goditorProjectJson && typeof goditorProjectJson === 'object') {
    await _writeJson(path.join(basePath, 'project.goditor.json'), goditorProjectJson);
  }

  return { folderPath: basePath, meta };
}

/**
 * CLAUDE.md만 현재 템플릿으로 재생성 (meta.json은 건드리지 않음 — updatedAt 미변경).
 * 기존 프로젝트 진입 시 호출 → 템플릿(도구 목록 등)이 바뀌어도 CLAUDE.md가 최신 상태 유지.
 * CLAUDE.md는 meta에서 파생되는 파일이므로 덮어써도 사용자 데이터(decisions/history/NOTES) 손실 없음.
 * @param {string} folderPath
 * @returns {Promise<{ok:boolean, reason?:string}>}
 */
export async function refreshClaudeMd(folderPath) {
  const metaPath = path.join(folderPath, META_JSON);
  let meta;
  try {
    meta = await _readJson(metaPath);
  } catch {
    return { ok: false, reason: 'no-meta' };
  }
  await _safeWriteFile(path.join(folderPath, CLAUDE_MD), renderClaudeMd(meta));
  return { ok: true };
}

/**
 * project.meta.json 부분 업데이트 + CLAUDE.md 재생성.
 * @param {string} folderPath
 * @param {object} patch
 */
export async function updateMeta(folderPath, patch) {
  const metaPath = path.join(folderPath, META_JSON);
  const meta = await _readJson(metaPath);
  Object.assign(meta, patch || {});
  meta.updatedAt = _isoNow();
  await _writeJson(metaPath, meta);
  await _safeWriteFile(path.join(folderPath, CLAUDE_MD), renderClaudeMd(meta));
  return meta;
}

/**
 * NOTES.md에 분류 메모 추가.
 * @param {string} folderPath
 * @param {'Preference'|'Constraint'|'Decision'|'Feedback'} type
 * @param {string} content
 */
export async function appendMemo(folderPath, type, content) {
  if (!MEMO_TYPES.includes(type)) {
    throw new Error(`appendMemo: unknown type "${type}". expected ${MEMO_TYPES.join('|')}`);
  }
  if (!content || !String(content).trim()) {
    throw new Error('appendMemo: content empty');
  }
  const notesPath = path.join(folderPath, NOTES_MD);
  let txt;
  try {
    txt = await fs.readFile(notesPath, 'utf8');
  } catch {
    txt = _renderNotesMd();
  }
  // header → plural form
  const headers = {
    Preference: '## Preferences',
    Constraint: '## Constraints',
    Decision: '## Decisions (원문)',
    Feedback: '## Feedback',
  };
  const header = headers[type];
  const idx = txt.indexOf(header);
  const stamp = _isoNow().slice(0, 19).replace('T', ' ');
  const line = `- [${stamp}] ${String(content).trim()}`;

  let next;
  if (idx === -1) {
    // header 없으면 끝에 붙임
    next = txt.trimEnd() + `\n\n${header}\n${line}\n`;
  } else {
    // header 다음 줄(첫번째 - 다음)에 추가
    const before = txt.slice(0, idx);
    const after = txt.slice(idx);
    // afterFirstLineEnd: header 줄 끝
    const headerEnd = after.indexOf('\n');
    const headerPart = after.slice(0, headerEnd + 1);
    const rest = after.slice(headerEnd + 1);
    next = before + headerPart + line + '\n' + rest;
  }
  await _safeWriteFile(notesPath, next);

  // Decision/Feedback이면 meta.history에도 한 줄 push
  if (type === 'Decision' || type === 'Feedback') {
    const meta = await _readJson(path.join(folderPath, META_JSON));
    meta.history = Array.isArray(meta.history) ? meta.history : [];
    meta.history.push({ text: `[${type}] ${content}`, addedAt: _isoNow() });
    if (meta.history.length > MAX_HISTORY * 5) {
      // 너무 커지면 cap
      meta.history = meta.history.slice(-MAX_HISTORY * 5);
    }
    meta.updatedAt = _isoNow();
    await _writeJson(path.join(folderPath, META_JSON), meta);
    await _safeWriteFile(path.join(folderPath, CLAUDE_MD), renderClaudeMd(meta));
  }
  return { ok: true };
}

/**
 * Decision 추가. 15개 초과 시 oldest를 superseded 처리.
 * @param {string} folderPath
 * @param {string|{text:string}} decision
 */
export async function addDecision(folderPath, decision) {
  const text = typeof decision === 'string' ? decision : (decision && decision.text);
  if (!text || !String(text).trim()) throw new Error('addDecision: text empty');

  const metaPath = path.join(folderPath, META_JSON);
  const meta = await _readJson(metaPath);
  meta.decisions = Array.isArray(meta.decisions) ? meta.decisions : [];
  meta.decisions.push({ text: String(text).trim(), addedAt: _isoNow(), superseded: false });

  // 활성 결정이 MAX_DECISIONS 초과면 oldest active를 superseded
  const activeIdxs = meta.decisions
    .map((d, i) => ({ d, i }))
    .filter((x) => !x.d.superseded)
    .map((x) => x.i);
  while (activeIdxs.length > MAX_DECISIONS) {
    const oldest = activeIdxs.shift();
    meta.decisions[oldest].superseded = true;
    meta.decisions[oldest].supersededAt = _isoNow();
  }

  meta.history = Array.isArray(meta.history) ? meta.history : [];
  meta.history.push({ text: `[Decision] ${text}`, addedAt: _isoNow() });
  meta.updatedAt = _isoNow();

  await _writeJson(metaPath, meta);
  await _safeWriteFile(path.join(folderPath, CLAUDE_MD), renderClaudeMd(meta));
  return meta;
}

/**
 * CLAUDE.md가 MAX_LINES 초과 시 oldest decisions/history 일부를 archive로 이동.
 * @param {string} folderPath
 * @returns {Promise<{archived:boolean, lines:number, archivePath?:string}>}
 */
export async function checkSizeAndArchive(folderPath) {
  const claudePath = path.join(folderPath, CLAUDE_MD);
  let txt;
  try {
    txt = await fs.readFile(claudePath, 'utf8');
  } catch {
    return { archived: false, lines: 0 };
  }
  const lineCount = txt.split('\n').length;
  if (lineCount <= MAX_LINES) {
    return { archived: false, lines: lineCount };
  }

  // 메타 읽고 oldest 절반을 archive
  const metaPath = path.join(folderPath, META_JSON);
  const meta = await _readJson(metaPath);
  meta.decisions = Array.isArray(meta.decisions) ? meta.decisions : [];
  meta.history = Array.isArray(meta.history) ? meta.history : [];

  const halfD = Math.ceil(meta.decisions.length / 2);
  const halfH = Math.ceil(meta.history.length / 2);

  const archivedDecisions = meta.decisions.slice(0, halfD);
  const archivedHistory = meta.history.slice(0, halfH);

  meta.decisions = meta.decisions.slice(halfD);
  meta.history = meta.history.slice(halfH);
  meta.updatedAt = _isoNow();

  // archive 파일 작성
  const archDir = await _archiveDir(folderPath);
  const archFile = path.join(archDir, `${_todayStamp()}.md`);
  const archContent = [
    `# Archive @ ${_isoNow()}`,
    '',
    '## Archived Decisions',
    ...archivedDecisions.map((d) => `- [${(d.addedAt || '').slice(0, 19)}]${d.superseded ? ' (superseded)' : ''} ${d.text}`),
    '',
    '## Archived History',
    ...archivedHistory.map((h) => `- [${(h.addedAt || '').slice(0, 19)}] ${h.text}`),
    '',
  ].join('\n');
  await _safeWriteFile(archFile, archContent);

  await _writeJson(metaPath, meta);
  await _safeWriteFile(claudePath, renderClaudeMd(meta));

  const newLines = renderClaudeMd(meta).split('\n').length;
  return { archived: true, lines: newLines, archivePath: archFile };
}

// 헬퍼 노출 (테스트/PM-A 편의)
export const _internals = {
  MAX_LINES,
  MAX_DECISIONS,
  MAX_HISTORY,
  MEMO_TYPES,
  _extractSections,
  _safeWriteFile,
  _archiveDir,
};
