/* 글자 추출(OCR) 지시문·응답 읽기 — 세 공급자(gemini·openai·anthropic)가 같은 것을 쓴다 (시트 33 1020t2a1) */
function ocrPrompt(mode) {
  const how = mode === 'layout'
    ? '원래 줄바꿈을 지켜 한 줄을 한 항목으로. 표는 행마다 한 항목, 칸은 " | " 로 잇는다.'
    : '글 덩어리마다 한 항목.';
  return '이 이미지에 이미 적혀 있는 글자만 그대로 읽어 옮겨라. ' + how
    + ' 고치거나 지어내지 말고 설명도 붙이지 마라. 위에서 아래 순서로.'
    + ' 각 항목의 style 은 이미지 속 글자 크기·굵기로 고른다: h1(가장 큰 제목) · h2(소제목) · h3 · body(본문) · caption(작은 설명) · label(짧은 꼬리표).'
    + ' JSON 으로만 답하라: {"lines":[{"style":"h2","text":"..."}]}. 글자가 없으면 {"lines":[]}.';
}

// 모델 글 → { text, lines } · JSON 이 아니면 글 그대로(lines=null)
function parseOcr(raw) {
  const s = String(raw || '').trim();
  let lines = null;
  try {
    const v = JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1));   // 코드펜스·앞뒤 말을 걷는다
    if (Array.isArray(v?.lines)) lines = v.lines;
  } catch (_) { /* 글 그대로 */ }
  const text = lines ? lines.map(l => (l && l.text) || '').filter(Boolean).join('\n') : s;
  return { text, lines };
}

module.exports = { ocrPrompt, parseOcr };
