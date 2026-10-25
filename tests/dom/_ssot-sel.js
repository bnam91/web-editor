/* _ssot-sel.js — ⌘G(wrapSelectedBlocksInFrame)를 «그 함수만» 잘라 도는 DOM 하네스 공용 (t5-07 · S3 · 261023)
 *   ⌘G 명부가 editor.js 정본 SECTION_BLOCK_TYPE_SEL 에서 파생된다(앱은 editor.js 가 window 에 싣는다).
 *   하네스엔 editor.js 가 없으므로 같은 선언을 «같은 자리에서» 떠 window 에 싣는 한 줄을 돌려준다.
 *   ⛔손으로 목록을 적지 않는다 — 그러면 하네스가 앱과 다른 명부를 잰다.
 *   바닥 판(파생 전)에 얹어도 해가 없다 — 그 판은 이 전역을 안 읽는다. */
const fs = require('fs');
const path = require('path');
function ssotSelJs(jsDir) {
  const ED = fs.readFileSync(path.join(jsDir, 'editor.js'), 'utf8');
  const m = ED.match(/const SECTION_BLOCK_TYPE_SEL = (\[[\s\S]*?\])\.join\(', '\);/);
  if (!m) throw new Error('★editor.js 의 SECTION_BLOCK_TYPE_SEL 선언을 못 떴다 — 이름·꼴이 바뀌었나? 이 하네스는 앱과 다른 것을 재게 된다');
  return `window.SECTION_BLOCK_TYPE_SEL = ${m[1]}.join(', ');`;
}
module.exports = { ssotSelJs };
