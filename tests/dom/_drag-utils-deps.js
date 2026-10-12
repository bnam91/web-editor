/* _drag-utils-deps — «drag-utils.js 를 직접 주고 나머지는 404» 하는 모듈 하네스용 한 자리 (E99 후속 · 2026-10-05).
 *   drag-utils.js 가 «제 모듈 그래프에서» 끌어오는 제품 파일은 하네스가 스텁할 이유가 없다.
 *   그런데 하네스가 404 를 주면 drag-utils 모듈 그래프가 통째로 죽고 증상은 「__ready 가 안 선다」(30s 시간초과)뿐이다.
 *   ⇒ 목록을 손으로 적지 않고 drag-utils.js 소스에서 읽어, 그 파일들을 «진짜로» 준다. 새 import 가 생겨도 여기서 따라간다.
 *
 * ★★2026-10-09 — ★★«side-effect import 만» 보던 것을 ★★«상대 import 전부»로 넓혔다.
 *   ★까닭(실측): `drag-utils.js` 에 ★바인딩 import 한 줄(`import { frameClipsChildren } from './frame-geometry.js'`)이
 *     늘자 ★이 helper 가 ★그 파일을 ★안 주고 ★404 가 나가 ★★4개 spec 26칸이 ★전부 ★30s 시간초과로 빨개졌다.
 *     ★증상이 ★「전제가 안 선다」뿐이라 ★제품 결함으로 ★읽힐 자리였다 — ★이 파일 ★머리말이 ★★경고한 ★바로 그 꼴이다.
 *   ⇒ ★★그래서 ★「★side-effect 냐」가 ★아니라 ★★「★drag-utils 가 ★부르느냐」로 ★판정한다.
 *   ⛔★spec 이 ★★스스로 ★스텁하는 파일(globals.js 등)은 ★`except` 로 ★빼라 — ★안 빼면 ★이 helper 가 ★그 스텁을 ★이긴다
 *     (★호출 순서상 ★globals.js 스텁이 ★이 helper ★뒤에 오는 spec 이 ★넷 중 ★넷이다 · 2026-10-09 실측).
 *
 * 쓰기: { const d = dragUtilsDep(url.pathname, '/js/', ['globals.js']); if (d) return route.fulfill(d); }
 *       { const d = dragUtilsDep(url.pathname, '/',    ['globals.js']); if (d) return route.fulfill(d); } */
'use strict';
const fs = require('fs');
const path = require('path');
const JS_DIR = path.join(__dirname, '..', '..', 'js');
const SRC = fs.readFileSync(path.join(JS_DIR, 'drag-utils.js'), 'utf8');
/* ★side-effect(`import './x.js';`) ＋ ★바인딩(`import … from './x.js';`) ★둘 다. ⛔한 꼴만 보면 위 사고가 난다. */
const SIDE = [...SRC.matchAll(/^import\s+['"]\.\/([\w./-]+\.js)['"]\s*;/gm)].map(m => m[1]);
const BOUND = [...SRC.matchAll(/^import\s+[^'"]*?\sfrom\s+['"]\.\/([\w./-]+\.js)['"]\s*;/gm)].map(m => m[1]);
const ALL = [...new Set([...SIDE, ...BOUND])];
const BODY = new Map(ALL.map(rel => [rel, fs.readFileSync(path.join(JS_DIR, rel), 'utf8')]));
/** pathname 이 drag-utils 의 상대 import 면 route.fulfill 인자, 아니면 null.
 *  @param {string[]} except spec 이 «제 손으로» 스텁하는 파일(base 기준 상대경로) */
function dragUtilsDep(pathname, base, except = []) {
  if (!pathname.startsWith(base)) return null;
  const rel = pathname.slice(base.length);
  if (except.includes(rel)) return null;
  return BODY.has(rel) ? { contentType: 'application/javascript', body: BODY.get(rel) } : null;
}
module.exports = { dragUtilsDep, DRAG_UTILS_SIDE_IMPORTS: Object.freeze(SIDE.slice()),
                   DRAG_UTILS_IMPORTS: Object.freeze(ALL.slice()) };
