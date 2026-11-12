/* relay-origin — Figma 중계(socket.js) WebSocket 업그레이드의 Origin 판정 (SEC-FIGMA-UPLOAD-FILE-READ-01 · 감사 ④ WS ㉮ · 현빈 261113)
 *   ★중계는 인증이 없다 → 아무 웹페이지·file:// 페이지가 ws://localhost:3055 에 붙어 채널에 끼면 디자인 데이터를 엿듣고 명령을 넣는다.
 *   ★정당한 손님은 둘뿐: 노드 클라이언트(figma-renderer 변환기·MCP — Origin 헤더 «없음») · Figma 플러그인 UI(불투명 Origin = 문자열 'null').
 *   ⇒ 허용목록: 헤더 없음 · 'null' 만. 그 밖(http(s)://… 웹페이지 · 헤더 글자가 'file://…' 인 것 · 빈 문자열)은 대소문자·끝 슬래시와 무관하게 거절.
 *   ⚠️실측(사실): Chrome 브라우저 file:// 페이지 = 'null'(수지맥 261113) · 고디터 렌더러(Electron) = 'file://'(인텔 r0913e) → ㉮ 가 렌더러를 막는다.
 *     렌더러가 'null' 로 바뀌면 e2e tests/e2e/sec-relay-origin-electron.spec.js E2 가 빨강 = ㉯(CSP connect-src) 재검토 신호. */
function isAllowedRelayOrigin(origin) {
  if (origin === null || origin === undefined) return true;
  return String(origin).trim().toLowerCase() === 'null';
}
module.exports = { isAllowedRelayOrigin };
