#!/usr/bin/env node
/* goditor 기능 레벨별 API 문서 생성기.
   - claude-pm MCP 도구는 «실행 중인 서버의 tools/list» 를 정본으로 읽는다.
   - window/CDP 자동화 API + 직렬화 포맷은 본 파일 하단 템플릿(검증된 시그니처).
   재생성: GODITOR 앱을 «켜 둔 채» node scripts/gen-api-doc.cjs  → docs/goditor-api.md

   ★왜 소스 파싱을 버렸나(08-15 실측)
     예전엔 mcp-server.js 를 정규식으로 긁었다. 그 결과 70개 중 19개가 «틀린 인자»로 나갔다:
       - properties 뒤에 required 가 붙어야만 잡는 정규식이라, 형식이 다른 도구는 통째로 놓쳐
         파라미터란이 「—」가 됐다. read_section·delete_block·delete_section 3개가 그랬는데
         셋 다 «필수» 인자가 있다 ⇒ 문서대로 호출하면 무조건 실패.
       - 들여쓰기 6칸 이상 키를 전부 인자로 봐서 중첩 items:/properties: 와 하위 객체 필드까지
         top-level 인자인 양 올라왔다(16개).
     스키마는 서버가 «갖고 있다». 긁지 말고 물어본다.

   ★서버가 안 떠 있으면 «실패»한다 — 빈 문서나 낡은 문서를 남기지 않는다.
     조용히 옛 문서를 남기면 위와 같은 사고가 그대로 반복된다. */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');

// 브리지를 그대로 쓴다 — 포트 탐색·토큰 읽기 로직을 여기 복붙하면 언젠가 둘이 갈린다.
// (그래서 이 생성기는 브리지 자체의 회귀시험도 겸한다.)
function extractTools() {
  const bridge = path.join(ROOT, 'main/claude-pm/mcp-stdio-bridge.cjs');
  const input = [
    JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'gen-api-doc', version: '1' } } }),
    /* ★includeHidden — 2026-08-25 토큰 다이어트 이후 add_*_block·update_*_block 51개는
       tools/list 에서 «숨겨져»(별칭으로만 생존) 있다. 문서는 별칭까지 실어야 하므로
       생성기만 이 플래그를 준다(MCP 클라이언트는 안 준다 = 사용자 컨텍스트 비용 그대로). */
    JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: { includeHidden: true } }),
  ].join('\n') + '\n';
  const r = spawnSync(process.execPath, [bridge], { input, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (r.error) throw new Error(`브리지 실행 실패: ${r.error.message}`);
  let payload = null;
  for (const line of (r.stdout || '').split('\n')) {
    if (!line.trim()) continue;
    let m; try { m = JSON.parse(line); } catch (_) { continue; }
    if (m.id === 2) payload = m;
  }
  if (!payload) {
    throw new Error('tools/list 응답을 못 받았습니다. GODITOR 앱이 켜져 있어야 합니다.\n'
      + '브리지 stderr: ' + String(r.stderr || '').trim());
  }
  if (payload.error) {
    throw new Error('MCP 서버에 붙지 못했습니다 — GODITOR 앱을 켜고 다시 실행하세요.\n'
      + '  서버 응답: ' + payload.error.message);
  }
  const tools = (payload.result && payload.result.tools) || [];
  if (!tools.length) throw new Error('도구가 0개입니다 — 문서를 덮어쓰지 않고 중단합니다.');
  return tools.map(t => {
    const sch = t.inputSchema || {};
    const props = Object.keys(sch.properties || {});   // ★top-level 만. 중첩은 안 파고든다.
    const required = new Set(sch.required || []);
    return {
      name: t.name,
      desc: t.description || '',
      params: props,
      required: props.filter(p => required.has(p)),
      hidden: !!t.hidden,
    };
  });
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

> 자동 생성: GODITOR 앱을 **켜 둔 채** \`node scripts/gen-api-doc.cjs\`.
> MCP 도구 표는 소스를 긁은 게 아니라 **실행 중 서버의 \`tools/list\` 응답**이 정본이다(앱이 꺼져 있으면 생성기가 실패한다).
> 인자는 \`inputSchema\` 의 **top-level 속성만** 싣는다 — 배열/객체 인자의 하위 필드는 각 도구 설명을 보라.

Goditor(Goya Web Design Editor)를 **프로그래밍으로 제어**하는 두 경로:
1. **claude-pm MCP** — AI/자동화가 호출하는 공식 도구 API (아래 §1, ${tools.length}개). 에디터 미실행/사용자 편집 중이면 \`{ok:false, code:"USER_BUSY"}\` 등 반환.
2. **CDP(포트 9334) + window.* 자동화 API** — 렌더러 직접 제어 (§2).
3. **직렬화/저장 포맷** (§3).

---

## §1. claude-pm MCP 제어 API (${tools.length} tools)

\`registerTool(name, handler, {description, inputSchema})\`. 호출: claude-pm MCP 서버.

**🔒 표시 = «별칭»** — 2026-08-25 «토큰 다이어트» 이후 \`add_*_block\`(26)·\`update_*_block\`(25) 51개는
\`tools/list\` 에 **안 실린다**(목록만 봤을 때 도구 ${tools.filter(t => !t.hidden).length}개). 이유: tools/list 는 매 요청마다 클라이언트 컨텍스트에
실리는 고정비라, 51개 스키마(≈95,600자)를 매번 실으면 요금제가 작은 사용자는 그것만으로 대화창이 찬다.
**호출은 그대로 된다** — 기존 대화·문서·스크립트는 안 깨진다. 새 작업은 \`add_block(type, props)\` /
\`update_block(blockId, props)\` / \`get_block_schema(type)\` 3개를 쓴다.

**응답 형태** — 도구는 대체로 \`{ok:true, …}\` / 실패 시 \`{ok:false, code, message}\` 를 준다. 예외가 둘 있다:
- \`list_scratch_items\` 는 **\`{ok:…}\` 가 아니라 맨 배열**을 반환한다(기존 사용처 호환 때문에 유지). \`ok\` 를 먼저 보면 안 된다.
- \`goditor_which_instance\` 는 서버가 아니라 **stdio 브리지가 직접 답한다**(앱을 여러 개 띄웠을 때 어느 인스턴스에 붙었는지 알려주는 도구). HTTP 로 \`/mcp\` 를 직접 부르면 이 도구는 없다.
`;

for (const cat of ORDER) {
  const list = byCat[cat]; if (!list || !list.length) continue;
  md += `\n### ${cat} (${list.length})\n\n| 도구 | 설명 | 필수 인자 | 선택 인자 |\n|---|---|---|---|\n`;
  list.sort((a, b) => a.name.localeCompare(b.name));
  for (const t of list) {
    // ★필수를 «따로» 낸다. 예전엔 필수·선택을 한 칸에 뭉갠 데다 아예 빠진 도구가 있어서
    //   문서대로 호출하면 실패하는 도구가 3개 있었다.
    const req = t.required;
    const opt = t.params.filter(p => !req.includes(p));
    const fmt = (a) => a.length ? '`' + a.join('`, `') + '`' : '—';
    const tag = t.hidden ? '🔒' : '';
    md += `| **${t.name}**${tag} | ${t.desc.replace(/\|/g, '\\|')} | ${fmt(req)} | ${fmt(opt)} |\n`;
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
