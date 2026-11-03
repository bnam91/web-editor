'use strict';
/* 복제본의 goya-asset URL 을 새 id 로 — hostname 에 프로젝트 id 가 박혀 있어, 안 바꾸면 원본을 지울 때 복제본의 이미지가 깨진다.
   canvas 와 page.scratchpad(다른 맥 하이드레이션 매니페스트) 둘 다. 받는 쪽: main.js _duplicateProjectImpl. 시험: tests/unit/copy-urls.test.mjs */
function rewriteProjectCopyUrls(project, oldId, newId) {
  const from = `goya-asset://${oldId}/`;
  const to = `goya-asset://${newId}/`;
  for (const pg of Array.isArray(project?.pages) ? project.pages : []) {
    if (!pg) continue;
    if (typeof pg.canvas === 'string' && pg.canvas.includes(from)) pg.canvas = pg.canvas.split(from).join(to);
    for (const it of Array.isArray(pg.scratchpad) ? pg.scratchpad : []) {
      if (it && typeof it.src === 'string' && it.src.startsWith(from)) it.src = to + it.src.slice(from.length);
    }
  }
}
module.exports = { rewriteProjectCopyUrls };
