/* ══════════════════════════════════════
   Anthropic Service — 섹션 내 텍스트 블록 일괄 채우기
   claude-haiku-4-5 / claude-sonnet-4-6 (vision + tool use 기반 structured output).
   ANTHROPIC_API_KEY 는 main.js의 _loadEnvFile 로 process.env 에 주입됨.
   응답 포맷은 geminiService와 동일: { replacements, additions }
══════════════════════════════════════ */
const fs = require('fs');
const path = require('path');

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-haiku-4-5';

const TONE_HINTS = {
  trust:    '신뢰감 있고 차분한 비즈니스 톤',
  friendly: '친근하고 따뜻한 톤',
  punchy:   '강력하고 임팩트 있는 셀링 톤',
  simple:   '단순하고 군더더기 없는 톤',
};

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
  'table-header': '표 헤더. 짧고 명확하게(2~10자).',
  'table-cell':   '표 셀 내용. 짧게(2~30자).',
  'graph-label':  '그래프 항목 이름. 짧게(2~10자).',
  'graph-value':  '그래프 항목 수치. 0~100 범위 정수 권장. 카테고리별 상대 크기를 반영해서 다양하게.',
};

function _detectStyle(b) {
  const cls = (b.style || '').toLowerCase();
  if (STYLE_HINTS[cls]) return cls;
  if (cls.includes('h1')) return 'h1';
  if (cls.includes('h2')) return 'h2';
  if (cls.includes('label')) return 'label';
  if (cls.includes('caption')) return 'caption';
  return 'body';
}

function _buildPrompt({ blocks, prompt, tone, mode, fidelity, autoExpand }) {
  if (fidelity === 'verbatim') {
    const blockLines = blocks.map((b, i) => {
      const cur = (b.current || '').replace(/\s+/g, ' ').trim();
      return `${i + 1}. id="${b.id}" / style=${_detectStyle(b)} / 현재="${cur}"`;
    }).join('\n');
    return `당신은 상세페이지 카피 텍스트 전사(transcription) 도구입니다.
첨부된 이미지의 카피 텍스트만 추출해서 아래 블록에 그대로 옮겨주세요.

[섹션 블록 — DOM 순서]
${blockLines}

[사용자 요청]
${prompt || '(이미지의 카피 텍스트를 블록 순서에 맞춰 그대로 옮겨줘)'}

[추출 대상]
- 큰 글씨로 직접 타이핑된 한글 헤딩
- 본문 카피, 강조 문구, 캡션/주석

[추출 금지]
- 이미지 안의 사진·인증서·증명서·도장·QR·로고·워터마크 안의 글자

[규칙]
- 한 글자도 추가/생략/요약/풀어쓰기 금지.
- 카피 단락 < 슬롯이면 남는 블록은 빈 문자열("").
- echo back 금지: 입력으로 받은 placeholder("본문 내용을 입력하세요" 등)를 그대로 응답에 다시 사용 금지. 추출할 카피 없으면 빈 문자열("").
${autoExpand
  ? `- **카피 단락 > 슬롯 (autoExpand)**: 첫 N개는 replacements에 1:1, 남는 단락은 additions 배열에 { "style": "...", "text": "..." }. style은 h1/h2/h3/body/caption/label.
- **컴포넌트 슬롯 자동 확장(autoExpand) — 매우 중요**: 이미지 안의 항목 수가 기존 슬롯과 다르면 **반드시 \`extensions\`** 사용. **replacements 슬롯 인덱스 임의 변경 금지**. id는 입력 그대로.`
  : '- 카피 단락 > 슬롯이면 인접 단락을 한 블록에 합쳐도 됨.'}

반드시 record_section_fill 도구를 호출. replacements 길이/순서는 입력 블록과 1:1 동일. autoExpand off면 additions는 빈 배열, extensions는 빈 객체.`;
  }

  // natural mode
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

[섹션 블록 — DOM 순서]
${blockLines}

[사용자 요청]
${prompt || '섹션 분위기에 맞춰 자연스럽게 채워줘.'}

[톤]
${toneHint || '특별한 톤 지정 없음 — 컨텍스트에 맞게'}

[규칙]
- 출력은 한국어로만.
- 각 블록의 length/style 힌트를 반드시 지킬 것.
- ${modeNote}
${autoExpand
  ? `- **autoExpand**: 슬롯 외에 추가 카피가 자연스러우면 additions 배열에 { "style": "...", "text": "..." }. style은 h1/h2/h3/body/caption/label. 자연스러움 우선.
- **컴포넌트 슬롯 자동 확장(autoExpand) — 매우 중요**: 사용자가 개수를 명시했거나 컨텍스트상 기존 슬롯과 다른 게 자연스러우면 **반드시 \`extensions\`** 사용. **replacements 슬롯 인덱스 임의 변경 금지**. id는 입력 그대로. **canvas는 cv:* replacements 인덱스만 늘리면 grid 안 변하니 반드시 extensions.canvases 사용.**`
  : ''}

반드시 record_section_fill 도구를 호출. replacements 길이/순서는 입력 블록과 1:1 동일. autoExpand off면 additions는 빈 배열, extensions는 빈 객체.`;
}

const TOOL_SCHEMA = {
  name: 'record_section_fill',
  description: '섹션 텍스트 블록 채우기 결과를 기록한다.',
  input_schema: {
    type: 'object',
    properties: {
      replacements: {
        type: 'array',
        description: '입력 블록과 1:1 대응. id로 매칭.',
        items: {
          type: 'object',
          properties: {
            id:   { type: 'string' },
            text: { type: 'string' },
          },
          required: ['id', 'text'],
        },
      },
      additions: {
        type: 'array',
        description: 'autoExpand 활성 시 추가로 생성할 텍스트 블록. 비활성이면 빈 배열.',
        items: {
          type: 'object',
          properties: {
            style: { type: 'string', enum: ['h1','h2','h3','body','caption','label'] },
            text:  { type: 'string' },
          },
          required: ['style', 'text'],
        },
      },
      extensions: {
        type: 'object',
        description: 'autoExpand 활성 시 컴포넌트 슬롯 구조 자동 확장. 변경 안 한 컴포넌트는 sub-array에 안 넣음. 빈 객체 가능.',
        properties: {
          graphs: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                items: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, value: { type: 'number' } }, required: ['label', 'value'] } },
              },
              required: ['id', 'items'],
            },
          },
          tables: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                headers: { type: 'array', items: { type: 'string' } },
                rows: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
              },
              required: ['id', 'headers', 'rows'],
            },
          },
          canvases: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                cols: { type: 'integer' },
                rows: { type: 'integer' },
                cards: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, desc: { type: 'string' } }, required: ['title', 'desc'] } },
              },
              required: ['id', 'cols', 'rows', 'cards'],
            },
          },
          steps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                steps: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, desc: { type: 'string' } }, required: ['title', 'desc'] } },
              },
              required: ['id', 'steps'],
            },
          },
          chats: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                messages: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' }, align: { type: 'string' } }, required: ['text', 'align'] } },
              },
              required: ['id', 'messages'],
            },
          },
          labels: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                labels: { type: 'array', items: { type: 'string' } },
              },
              required: ['id', 'labels'],
            },
          },
        },
      },
    },
    required: ['replacements', 'additions'],
  },
};

async function fillSectionTexts(payload) {
  const apiKey = (payload && payload.apiKey) || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, error: 'Anthropic API 키가 없습니다. 환경설정에서 등록하거나 ANTHROPIC_API_KEY 환경변수를 설정하세요.' };

  const blocks = Array.isArray(payload?.blocks) ? payload.blocks : [];
  if (blocks.length === 0) return { ok: false, error: '대상 텍스트 블록이 없습니다.' };

  const promptText = _buildPrompt(payload);
  const userContent = [{ type: 'text', text: promptText }];

  // 이미지: dataURL → base64로 디코딩, file path → fs read
  const dataUrls = []
    .concat(Array.isArray(payload.imageDataUrls) ? payload.imageDataUrls : [])
    .concat(payload.imageDataUrl ? [payload.imageDataUrl] : []);
  for (const url of dataUrls) {
    const m = /^data:([^;]+);base64,(.+)$/.exec(url);
    if (!m) return { ok: false, error: '이미지 dataURL 형식 오류' };
    userContent.push({ type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } });
  }
  const filePaths = []
    .concat(Array.isArray(payload.imagePaths) ? payload.imagePaths : [])
    .concat(payload.imagePath ? [payload.imagePath] : []);
  for (const p of filePaths) {
    try {
      const abs = path.resolve(p);
      const buf = fs.readFileSync(abs);
      const ext = path.extname(abs).toLowerCase().replace('.', '');
      const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext || 'png'}`;
      userContent.push({ type: 'image', source: { type: 'base64', media_type: mime, data: buf.toString('base64') } });
    } catch (e) {
      return { ok: false, error: `이미지 로드 실패: ${e.message}` };
    }
  }

  const body = {
    model: payload.model || DEFAULT_MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content: userContent }],
    tools: [TOOL_SCHEMA],
    tool_choice: { type: 'tool', name: 'record_section_fill' },
  };

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `Anthropic ${res.status}: ${errText.slice(0, 400)}` };
    }
    const json = await res.json();
    // tool_use 블록에서 input 추출
    const toolUse = (json.content || []).find(c => c.type === 'tool_use' && c.name === 'record_section_fill');
    if (!toolUse) return { ok: false, error: 'Anthropic 응답에서 tool_use 블록을 찾을 수 없음' };
    const parsed = toolUse.input || {};
    const replacements = Array.isArray(parsed.replacements) ? parsed.replacements : [];
    const additions = Array.isArray(parsed.additions) ? parsed.additions : [];
    const extensions = (parsed.extensions && typeof parsed.extensions === 'object') ? parsed.extensions : null;
    try {
      const logLine = JSON.stringify({
        ts: new Date().toISOString(),
        provider: 'anthropic',
        model: payload.model || DEFAULT_MODEL,
        fidelity: payload.fidelity,
        autoExpand: !!payload.autoExpand,
        blocks: blocks.length,
        images: dataUrls.length + filePaths.length,
        prompt: (payload.prompt || '').slice(0, 200),
        replacementsCount: replacements.length,
        additionsCount: additions.length,
        replacements,
        additions,
      });
      fs.appendFileSync('/tmp/web-editor-ai-fill.log', logLine + '\n');
    } catch (_) {}
    return { ok: true, replacements, additions, extensions };
  } catch (e) {
    return { ok: false, error: `네트워크 오류: ${e.message}` };
  }
}

module.exports = { fillSectionTexts };
