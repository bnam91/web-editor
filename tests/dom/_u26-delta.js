/* _u26-delta — E99 U26 ⒜(두께 안 정한 세로·비교 막대 = 24px) 의 «옛 innerHTML ↔ 새 innerHTML» 차이 판정기 «하나».
 *   골든 갱신 단언 스크립트와 GR-W0 시험(기준판을 실시간으로 띄워 파일 골든이 없는 곳)이 같은 함수를 쓴다.
 *   토큰 = `;` 또는 `"` 로 끝나는 조각 · 토큰 LCS → 지워진 토큰 · 이어진 추가 토큰 «덩어리».
 *   허용 덩어리는 정확히 둘(★24 는 글자로 박는다 — 상수를 읽으면 상수 변이 양성대조에서 눈이 먼다). */
'use strict';
const ALLOWED = Object.freeze({
  fill: 'width:24px;max-width:100%;margin:0 auto;',   // .grb-bar-fill — 두께 기본 24
  col: ' style="min-width:0;"',                       // .grb-bar-col — 막대 폭이 늘 정해져 칸이 줄 수 있게
});
const tok = (s) => s.match(/[^;"]*[;"]|[^;"]+$/g) || [];
function u26Delta(oldHtml, newHtml) {
  const a = tok(oldHtml), b = tok(newHtml), n = a.length, m = b.length;
  const L = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const removed = [], runs = []; let i = 0, j = 0, cur = null;
  const close = () => { if (cur) { runs.push(cur); cur = null; } };
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) { close(); i++; j++; }
    else if (j < m && (i >= n || L[i][j + 1] >= L[i + 1][j])) {
      if (!cur) { const ctx = b.slice(Math.max(0, j - 3), j).join(''); cur = { at: j, text: '', ctx: (ctx.match(/class="([^"]*)"?[^"]*$/) || ctx.match(/(grb-[\w-]+)/) || [, ctx.slice(-40)])[1] }; }
      cur.text += b[j]; j++;
    } else { close(); removed.push(a[i]); i++; }
  }
  close();
  const kind = (t) => t === ALLOWED.fill ? 'fill' : t === ALLOWED.col ? 'col' : null;
  const bad = runs.filter(r => !kind(r.text));
  const count = { fill: runs.filter(r => kind(r.text) === 'fill').length, col: runs.filter(r => kind(r.text) === 'col').length };
  return { removed, runs, bad, count, ok: removed.length === 0 && bad.length === 0 };
}
module.exports = { u26Delta, ALLOWED };
