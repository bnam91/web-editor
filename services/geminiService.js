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

// 컴포넌트별 권장 길이/특성
const STYLE_HINTS = {
  h1:           '대제목. 매우 짧고 강력하게(8~16자).',
  h2:           '소제목. 짧고 또렷하게(8~24자).',
  body:         '본문. 2~3문장.',
  label:        '라벨/태그. 짧게(4~14자).',
  caption:      '보조 설명. 짧게(8~30자).',
  'card-title': '카드 제목. 짧고 임팩트 있게(8~20자).',
  'card-desc':  '카드 설명. 1~2문장.',
  'step-title': '단계 제목. 짧게(6~16자).',
  'step-desc':  '단계 설명. 1~2문장.',
  'chat-msg':   '채팅 말풍선. 자연스러운 대화체 1~2문장.',
};

function _detectStyle(b) {
  const cls = (b.style || '').toLowerCase();
  // card / step / chat 같은 컴포넌트별 키는 그대로 사용
  if (STYLE_HINTS[cls]) return cls;
  if (cls.includes('h1')) return 'h1';
  if (cls.includes('h2')) return 'h2';
  if (cls.includes('label')) return 'label';
  if (cls.includes('caption')) return 'caption';
  return 'body';
}

function _buildPrompt({ blocks, prompt, tone, mode, fidelity }) {
  // ── verbatim 모드: 이미지/사용자 입력 텍스트를 그대로 옮기는 모드 ──
  // 길이힌트/톤/응용 일체 무시. OCR/전사 도구처럼 동작.
  if (fidelity === 'verbatim') {
    const blockLines = blocks.map((b, i) => {
      const cur = (b.current || '').replace(/\s+/g, ' ').trim();
      return `${i + 1}. id="${b.id}" / style=${_detectStyle(b)} / 현재="${cur}"`;
    }).join('\n');
    return `당신은 텍스트 전사(transcription) 도구입니다.
첨부된 이미지(또는 사용자 요청)에 있는 텍스트를 아래 블록에 **그대로** 옮겨주세요.

[섹션 블록 목록 — DOM 순서]
${blockLines}

[사용자 요청]
${prompt || '(이미지의 텍스트를 블록 순서에 맞춰 그대로 옮겨줘)'}

[규칙 — 절대 어기지 말 것]
- 이미지/사용자 요청에 등장한 텍스트만 사용. 한 글자도 추가/생략/요약/풀어쓰기 금지.
- 길이힌트·톤·문장수 제한은 모두 무시. 원문 길이 그대로.
- 응용/창작/문장 보강 금지. 단순 전사만.
- 해당 블록에 매칭되는 텍스트가 이미지에 없으면 그 블록은 빈 문자열("")로.
- DOM 블록 순서와 이미지 텍스트 등장 순서를 1:1로 매칭.
- 이미지의 줄바꿈은 가능한 한 한 블록 내에서 자연스럽게 합쳐도 됨(불필요한 줄바꿈 금지).

[응답 형식]
- 반드시 JSON: {"replacements":[{"id":"...","text":"..."}, ...]}
- replacements 길이/순서는 입력 블록과 1:1 동일.`;
  }

  // ── natural 모드 (기본): 카피라이터로서 자연스럽게 응용 ──
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

  // 이미지 입력 (1) data URL — 클립보드 paste / drag-drop 경로
  if (payload.imageDataUrl) {
    const m = /^data:([^;]+);base64,(.+)$/.exec(payload.imageDataUrl);
    if (!m) return { ok: false, error: '이미지 dataURL 형식 오류' };
    parts.push({ inline_data: { mime_type: m[1], data: m[2] } });
  }
  // 이미지 입력 (2) 파일 경로 → base64 inline_data
  else if (payload.imagePath) {
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
