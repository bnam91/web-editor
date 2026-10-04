/* _drag-utils-deps — «drag-utils.js 를 직접 주고 나머지는 404» 하는 모듈 하네스용 한 자리 (E99 후속 · 2026-10-05).
 *   drag-utils.js 의 «side-effect import»(`import './x.js';` — 바인딩 없음)는 하네스가 스텁할 이유가 없는 제품 파일이다(지금: graph-limits.js).
 *   그런데 하네스가 404 를 주면 drag-utils 모듈 그래프가 통째로 죽고 증상은 「__ready 가 안 선다」(30s 시간초과)뿐이다.
 *   ⇒ 목록을 손으로 적지 않고 drag-utils.js 소스에서 읽어, 그 파일들을 «진짜로» 준다. 다음 side-effect import 가 생겨도 여기서 따라간다.
 *   ⛔스텁하는 import(globals.js·shape-frame.js 등 바인딩 있는 것)는 건드리지 않는다 — 각 spec 의 몫.
 * 쓰기: { const d = dragUtilsDep(url.pathname, '/js/'); if (d) return route.fulfill(d); }   // drag-utils 를 '/js/drag-utils.js' 로 줄 때
 *       { const d = dragUtilsDep(url.pathname, '/'); if (d) return route.fulfill(d); }      // '/drag-utils.js' 로 줄 때 */
'use strict';
const fs = require('fs');
const path = require('path');
const JS_DIR = path.join(__dirname, '..', '..', 'js');
const SRC = fs.readFileSync(path.join(JS_DIR, 'drag-utils.js'), 'utf8');
const SIDE = [...SRC.matchAll(/^import\s+['"]\.\/([\w./-]+\.js)['"]\s*;/gm)].map(m => m[1]);
const BODY = new Map(SIDE.map(rel => [rel, fs.readFileSync(path.join(JS_DIR, rel), 'utf8')]));
/** pathname 이 drag-utils 의 side-effect import 면 route.fulfill 인자, 아니면 null. */
function dragUtilsDep(pathname, base) {
  if (!pathname.startsWith(base)) return null;
  const rel = pathname.slice(base.length);
  return BODY.has(rel) ? { contentType: 'application/javascript', body: BODY.get(rel) } : null;
}
module.exports = { dragUtilsDep, DRAG_UTILS_SIDE_IMPORTS: Object.freeze(SIDE.slice()) };
