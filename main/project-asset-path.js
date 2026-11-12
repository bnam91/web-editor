/* project-asset-path — 렌더러가 준 projectId·blobPath 로 «프로젝트 안 assets/·images/» 파일 경로를 짓는 유일한 문
 *   (SEC-ASSET-PATH-TRAVERSAL-01 · Codex 감사 ⑤ 261112)
 *   ★projectId 허용목록 = main.js _isListableProjectId 와 같은 모양(proj_|plan_ + 숫자) + 샘플 'proj_sample' 정확히 — 그 밖은 경로를 «안 짓는다».
 *   ★루트는 main 이 쥔 PROJECTS_DIR 만(인자로 받되 렌더러 값이 아니다).
 *   ★경계 = 구분자 포함(`…/assets` + sep) · 있는 파일은 realpath 로 한 번 더(심볼릭 링크로 밖을 가리키면 거절).
 *   ⛔옛 꼴 `full.startsWith(PROJECTS_DIR/<id>/assets)` 는 구분자가 없어 `assets-evil/` 도 통과했고, id 가 `../x` 면 루트 밖이었다. */
const fs = require('fs');
const path = require('path');

const SUBS = new Set(['assets', 'images']);
// ★예외 하나: 첫 실행 샘플 프로젝트 id 'proj_sample'(pages/projects.html initSampleProject) — «정확히» 그 글자만. 정규식은 안 넓힌다.
//   (레포의 id 생성 자리는 그 밖에 전부 proj_/plan_ + 숫자: tab-system·market·collab/accept·projects.html·main.js·gdt/import·claude-pm 템플릿 · 261113 git grep)
const SAMPLE_ID = 'proj_sample';
const isProjectId = (id) => id === SAMPLE_ID || (typeof id === 'string' && /^(?:proj|plan)_\d+$/.test(id));

/** 쓰기용 폴더 — 허용 id 가 아니면 null. */
function projectSubDir(root, projectId, sub) {
  if (!root || !isProjectId(projectId) || !SUBS.has(sub)) return null;
  return path.join(path.resolve(root), projectId, sub);
}

const _real = (p) => { try { return fs.realpathSync(p); } catch (_) { return null; } };

/** 읽기·지우기용 — blobPath 는 '<sub>/<파일>' 꼴. 경계 밖이면 null. */
function projectBlobFile(root, projectId, sub, blobPath) {
  const base = projectSubDir(root, projectId, sub);
  if (!base || typeof blobPath !== 'string' || !blobPath) return null;
  const full = path.resolve(path.join(root, projectId), blobPath);
  if (!full.startsWith(base + path.sep)) return null;
  const rf = _real(full);
  if (rf) {                                            // 있는 파일 — 링크를 풀어도 안쪽이어야
    const rb = _real(base);
    if (!rb || !rf.startsWith(rb + path.sep)) return null;
  }
  return full;
}

module.exports = { isProjectId, projectSubDir, projectBlobFile };
