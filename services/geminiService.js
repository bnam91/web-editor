/* ══════════════════════════════════════
   Gemini Service — 섹션 내 텍스트 블록 일괄 채우기
   gemini-2.5-flash 멀티모달 호출, 한국어 강제, JSON 모드 응답.
   GEMINI_API_KEY 는 main.js의 _loadEnvFile 로 process.env 에 주입됨.
══════════════════════════════════════ */
const fs = require('fs');
const path = require('path');

const MODEL = 'gemini-2.5-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const TONE_HINTS = {
  trust:    '신뢰감 있고 차분한 비즈니스 톤',
  friendly: '친근하고 따뜻한 톤',
  punchy:   '강력하고 임팩트 있는 셀링 톤',
  simple:   '단순하고 군더더기 없는 톤',
};

// text-block style별 권장 길이/특성
const STYLE_HINTS = {
  h1:      '대제목. 매우 짧고 강력하게(8~16자).',
  h2:      '소제목. 짧고 또렷하게(8~24자).',
  body:    '본문. 2~3문장.',
  label:   '라벨/태그. 짧게(4~14자).',
  caption: '보조 설명. 짧게(8~30자).',
};

function _detectStyle(b) {
  const cls = (b.style || '').toLowerCase();
  if (cls.includes('h1')) return 'h1';
  if (cls.includes('h2')) return 'h2';
  if (cls.includes('label')) return 'label';
  if (cls.includes('caption')) return 'caption';
  return 'body';
}

function _buildPrompt({ blocks, prompt, tone, mode }) {
  const toneHint = TONE_HINTS[tone] || '';
  const blockLines = blocks.map((b, i) => {
    const style = _detectStyle(b);
    const hint = STYLE_HINTS[style] || '';
    const cur = (b.current || '').replace(/\s+/g, ' ').trim();
    return `${i + 1}. id="${b.id}" / style=${style} / 길이힌트="${hint}" / 현재="${cur}"`;
  }).join('\n');

  const modeNote = mode === 'fillEmpty'
    ? '단, 현재 텍스트가 비어있지 않은 블록은 가능하면 그대로 두고, 빈 블록 위주로 채워라.'
    : '모든 블록을 새로 채워라.';

  return `당신은 한국어 카피라이터입니다. 아래 섹션의 텍스트 블록들을 자연스러운 한국어로 채워주세요.

[섹션 블록 목록 — DOM 순서]
${blockLines}

[사용자 요청]
${prompt || '섹션 분위기에 맞춰 자연스럽게 채워줘.'}

[톤]
${toneHint || '특별한 톤 지정 없음 — 컨텍스트에 맞게 자연스럽게'}

[규칙]
- 출력은 한국어로만.
- 각 블록의 length/style 힌트를 반드시 지킬 것.
- ${modeNote}
- 응답은 반드시 JSON 형식: {"replacements":[{"id":"...","text":"..."}, ...]}
- replacements 배열의 길이와 순서는 입력 블록 목록과 1:1 동일하게.`;
}

async function fillSectionTexts(payload) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: 'GEMINI_API_KEY 가 환경변수에 없습니다.' };
  }
  const blocks = Array.isArray(payload?.blocks) ? payload.blocks : [];
  if (blocks.length === 0) {
    return { ok: false, error: '대상 텍스트 블록이 없습니다.' };
  }

  const promptText = _buildPrompt(payload);
  const parts = [{ text: promptText }];

  // 이미지 파일 경로 → base64 inline_data
  if (payload.imagePath) {
    try {
      const abs = path.resolve(payload.imagePath);
      const buf = fs.readFileSync(abs);
      const ext = path.extname(abs).toLowerCase().replace('.', '');
      const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext || 'png'}`;
      parts.push({ inline_data: { mime_type: mime, data: buf.toString('base64') } });
    } catch (e) {
      return { ok: false, error: `이미지 로드 실패: ${e.message}` };
    }
  }

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          replacements: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                id:   { type: 'STRING' },
                text: { type: 'STRING' },
              },
              required: ['id', 'text'],
            },
          },
        },
        required: ['replacements'],
      },
      temperature: 0.7,
    },
  };

  try {
    const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `Gemini ${res.status}: ${errText.slice(0, 300)}` };
    }
    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return { ok: false, error: 'Gemini 응답이 비어있음' };
    let parsed;
    try { parsed = JSON.parse(text); }
    catch { return { ok: false, error: `JSON 파싱 실패: ${text.slice(0, 200)}` }; }
    const replacements = Array.isArray(parsed.replacements) ? parsed.replacements : [];
    return { ok: true, replacements };
  } catch (e) {
    return { ok: false, error: `네트워크 오류: ${e.message}` };
  }
}

module.exports = { fillSectionTexts };
