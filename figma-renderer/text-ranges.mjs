// 332 — 모달 슬롯 부분 서식을 Figma 글자 노드에 칠한다. 굵게·색만 — 플러그인에 기울임·밑줄·취소선·형광펜 범위 명령이 없다(이 넷은 안 실린다)
export function applyTextRanges(nodeId, ranges, family, { run, loadFontSafe, hex }) {
  for (const { start, end, bold, color } of ranges || []) {
    if (bold) { const f = loadFontSafe(family, 'Bold'); run('set_range_font_name', { nodeId, start, end, family: f.family, style: f.style }); }
    if (color) { const { r, g, b } = hex(color); run('set_range_fills', { nodeId, start, end, fills: [{ type: 'SOLID', color: { r, g, b } }] }); }
  }
}
