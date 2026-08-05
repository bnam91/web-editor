#!/usr/bin/env node
/* goditor 기능 레벨별 API 문서 생성기.
   - claude-pm MCP 도구(main/claude-pm/mcp-server.js registerTool)를 파싱해 명세 표 생성.
   - window/CDP 자동화 API + 직렬화 포맷은 본 파일 하단 템플릿(검증된 시그니처).
   재생성: node scripts/gen-api-doc.cjs  → docs/goditor-api.md */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

function extractTools() {
  const s = fs.readFileSync(path.join(ROOT, 'main/claude-pm/mcp-server.js'), 'utf8');
  const parts = s.split('registerTool(').slice(1);
  const tools = [];
  for (const p of parts) {
    const nameM = p.match(/^\s*['"]([a-zA-Z0-9_]+)['"]/);
    if (!nameM) continue;
    const descM = p.match(/description:\s*'((?:[^'\\]|\\.)*)'/) || p.match(/description:\s*"((?:[^"\\]|\\.)*)"/);
    const desc = descM ? descM[1].replace(/\\'/g, "'") : '';
    const psM = p.match(/properties:\s*\{([\s\S]*?)\n\s*\}\s*,?\s*required/);
    let params = [];
    if (psM) params = [...new Set([...psM[1].matchAll(/^\s{6,}([a-zA-Z0-9_]+):\s*\{/gm)].map(m => m[1]))];
    tools.push({ name: nameM[1], desc, params });
  }
  return tools;
}

// 기능 레벨 분류
function category(name) {
  if (/^(read_|get_|list_|search_)/.test(name)) return '읽기·검색·상태';
  if (/_section$/.test(name) || name === 'set_section_memo' || name === 'move_section') return '섹션 제어';
  if (/^add_/.test(name)) return '블록 추가';
  if (/^update_/.test(name)) return '블록 수정';
  if (/^delete_|^insert_/.test(name)) return '삭제·구조';
  return '기타';
}
const ORDER = ['읽기·검색·상태', '섹션 제어', '블록 추가', '블록 수정', '삭제·구조', '기타'];

const tools = extractTools();
const byCat = {};
tools.forEach(t => { (byCat[category(t.name)] ||= []).push(t); });

let md = `# Goditor API 문서 · 명세서 (기능 레벨별)

> 자동 생성: \`node scripts/gen-api-doc.cjs\` (MCP 도구는 mcp-server.js에서 파싱). 수정 시 소스/이 스크립트를 고치고 재생성.

Goditor(Goya Web Design Editor)를 **프로그래밍으로 제어**하는 두 경로:
1. **claude-pm MCP** — AI/자동화가 호출하는 공식 도구 API (아래 §1, ${tools.length}개). 에디터 미실행/사용자 편집 중이면 \`{ok:false, code:"USER_BUSY"}\` 등 반환.
2. **CDP(포트 9334) + window.* 자동화 API** — 렌더러 직접 제어 (§2).
3. **직렬화/저장 포맷** (§3).

---

## §1. claude-pm MCP 제어 API (${tools.length} tools)

\`registerTool(name, handler, {description, inputSchema})\`. 호출: claude-pm MCP 서버.
`;

for (const cat of ORDER) {
  const list = byCat[cat]; if (!list || !list.length) continue;
  md += `\n### ${cat} (${list.length})\n\n| 도구 | 설명 | 주요 파라미터 |\n|---|---|---|\n`;
  list.sort((a, b) => a.name.localeCompare(b.name));
  for (const t of list) {
    const params = t.params.length ? '`' + t.params.join('`, `') + '`' : '—';
    md += `| **${t.name}** | ${t.desc.replace(/\|/g, '\\|')} | ${params} |\n`;
  }
}

md += `

---

## §2. CDP(9334) + window.* 자동화 API

CDP \`Runtime.evaluate\`로 렌더러에서 직접 호출. (검증된 공개 API만 기재.)

### 프로젝트·저장
| API | 설명 |
|---|---|
| \`window.serializeProject()\` | 현재 프로젝트 → JSON 문자열. 필드: \`{version, currentPageId, pages, checklistItems, checklistSections, imageGallery, assetsTree}\`. **스크래치패드 미포함**(별도 IndexedDB). |
| \`electronAPI.saveProject(proj)\` | 프로젝트 객체 저장. \`marketRef\` 등 추가 필드 보존. |
| \`electronAPI.loadProject(id)\` / \`listProjects()\` | 로드 / 목록(메타 + marketRef). |
| \`window.applyZoom(pct)\` | 캔버스 줌(%) 설정. 캡처 전 100 권장. |

### 익스포트 (PNG/이미지)
| API | 설명 |
|---|---|
| \`window.exportSection(secEl, 'png', width, opts)\` | 섹션 1개 → PNG. \`opts.returnDataUrl\`=다운로드 대신 dataURL 반환, \`opts.forceH2C\`=html2canvas(기본 native CDP 캡처 = retina·고속). |
| \`window.exportAllSections('png', 860, onProgress)\` | 전 섹션 각각 PNG 다운로드. |
| \`window.exportAllImagesPNG()\` | Export 메뉴 1급 — 확인창 + 전 섹션 PNG. |

### 자산(assets)
| API | 설명 |
|---|---|
| \`window.assetsAddImageFiles([File], folderId)\` | 자산 폴더에 이미지 추가. (Texture 폴더 id=\`ast_1ra7m6\`) |
| \`window.assetsGetAllFolders()\` / \`assetsGetDataUrl(id)\` | 폴더 목록 / 자산 dataURL. |
| \`window.setSectionBgImage(secEl, src)\` | 섹션 배경 이미지(인라인 style + dataset.bgImg). |

### 스크래치패드 (IndexedDB \`ScratchPadDB > scratch\`, key=\`scratch-pad-<projectId>-<pageId>\`)
| API | 설명 |
|---|---|
| \`window._scratchGetItemById(id)\` | \`#sp_xxx\` 아이템 \`{id, src}\` 조회. src는 인라인 base64. |
| \`window._scratchAddAndSave(src, x, y, w)\` / \`_scratchRemoveById(id)\` | 추가·저장 / 삭제. |
| \`window._scratchExportAll(projectId, pageIds)\` | **전 페이지** 스크래치 export \`[{pageId, items}]\` (마켓 동기화용). |
| \`window._scratchImportAll(newProjectId, block)\` | 새 projectId 키로 복원. |

### 마켓플레이스 동기화 (bnam91/goditor-market)
| API | 설명 |
|---|---|
| \`electronAPI.market.push({account,id,name,data,scratch})\` | 업로드. 자산 blob 분리(_blobs/<sha>)·version 박제·스크래치 동봉·push rebase 가드. |
| \`electronAPI.market.list()\` / \`pull({account,id})\` | 목록(version 포함) / 받기(blob 재인라인). |
| \`electronAPI.market.auth()\` | gh 인증 점검. |
| \`window.marketOpenResolve(account,id,name,localProjId)\` | 인터랙티브 섹션 머지 모달. |
| \`window.marketMerge.{diffProjects, applyResolve, sectionMap, normSection}\` | 섹션 diff/머지 엔진. |

---

## §3. 직렬화 / 저장 포맷

- **프로젝트 JSON** (\`serializeProject\`): \`version:2\`, \`pages:[{id, canvas(innerHTML 문자열), ...}]\`, \`checklistItems\`, \`checklistSections\`, \`imageGallery\`, \`assetsTree\`.
- **섹션**: canvas innerHTML 내 \`.section-block\` (id=\`sec_xxx\`, block-factory genId). 블록은 \`window.*\` API/HTML로 구성.
- **스크래치**: 프로젝트 JSON 밖. IndexedDB 별도.
- **마켓 payload**: \`{id,name,account,updatedAt,version,blobCount,data,scratch}\` — data/scratch는 \`goditor-blob:<sha256>\` 참조로 자산 분리. \`market/_blobs/<sha>.b64\`.
- 상세: \`docs/project-storage.md\`, \`docs/goditor-spec-v2.md\`.

---

## 참고
- MCP 서버: \`main/claude-pm/mcp-server.js\` (도구 핸들러·스키마 원본)
- 익스포트: \`js/io/export-image.js\` · 직렬화: \`js/io/save-load.js\` · 마켓: \`main.js\`(IPC)·\`js/market.js\`·\`js/market-merge.js\` · 스크래치: \`js/scratch-pad.js\`
- CDP 제어 패턴·함정: \`CLAUDE.md\`, \`AGENTS.md\`
`;

fs.writeFileSync(path.join(ROOT, 'docs/goditor-api.md'), md);
console.log('생성: docs/goditor-api.md (' + tools.length + ' MCP tools, ' + Object.keys(byCat).length + ' 카테고리, ' + md.length + ' chars)');
