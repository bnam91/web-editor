/* ══════════════════════════════════════
   OpenAI Service — 섹션 내 텍스트 블록 일괄 채우기
   gpt-5.4-mini / gpt-5.4-nano (vision + structured outputs).
   OPENAI_API_KEY 는 main.js의 _loadEnvFile 로 process.env 에 주입됨.
   응답 포맷은 geminiService와 동일: { replacements, additions }
══════════════════════════════════════ */
const fs = require('fs');
const path = require('path');

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-5.4-mini';

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
첨부된 이미지의 **카피 텍스트**(상세페이지에 직접 타이핑된 한글 헤딩/본문/캡션 문구)만 추출해서 아래 블록에 그대로 옮겨주세요.

[섹션 블록 목록 — DOM 순서]
${blockLines}

[사용자 요청]
${prompt || '(이미지의 카피 텍스트를 블록 순서에 맞춰 그대로 옮겨줘)'}

[추출 대상]
- 큰 글씨로 직접 타이핑된 한글 헤딩
- 본문 카피, 강조 문구, 캡션/주석

[추출 금지]
- 이미지 안에 합성된 사진·인증서·증명서·스크린샷·도장·QR코드 안의 글자
- 영문 라벨, 등록번호, 날짜 도장 등 사진 내부 메타데이터
- 워터마크·로고·브랜드 마크 안의 글자

[규칙 — 절대 어기지 말 것]
- 한 글자도 추가/생략/요약/풀어쓰기 금지. 원문 그대로.
- 카피 텍스트 단락 수가 블록 슬롯 수보다 적으면 남는 블록은 반드시 빈 문자열("").
- DOM 블록 순서와 카피 텍스트 등장 순서를 자연스럽게 매핑(위→아래).
- echo back 금지: 입력으로 받은 "현재" placeholder 값을 그대로 응답에 다시 사용하지 말 것. 추출할 카피 없으면 빈 문자열("").
${autoExpand
  ? `- **카피 단락 > 슬롯 수 (autoExpand)**: 첫 N개는 replacements에 1:1, 남는 단락은 additions 배열에 { "style": "...", "text": "..." }. style은 h1/h2/h3/body/caption/label 중 하나. 단락 ≤ 슬롯이면 additions 빈 배열 [].`
  : `- 카피 단락 > 슬롯이면 인접 단락을 한 블록에 합쳐도 됨.`}
${autoExpand
  ? `- **컴포넌트 슬롯 자동 확장(autoExpand) — 매우 중요**:
  · 이미지 안에 표/그래프/카드/단계/말풍선/태그 데이터가 보이고 그 항목 수가 기존 컴포넌트 슬롯 수와 다르면 **반드시 \`extensions\` 객체에** 해당 컴포넌트 통째로 새 구조 반환.
  · sub-array: graphs/tables/canvases/steps/chats/labels.
  · **replacements 슬롯 인덱스를 임의로 늘리지 말 것** — 슬롯 변경은 오직 extensions 경로로.
  · id는 입력의 컴포넌트 id 그대로. 변경 안 한 컴포넌트는 sub-array에 안 넣음.`
  : `- extensions의 모든 sub-array는 빈 배열 [].`}

응답은 JSON: replacements 배열은 입력 블록과 1:1 동일 길이/순서. additions/extensions는 변경 없으면 빈 배열·빈 객체 형식.`;
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

[섹션 블록 목록 — DOM 순서]
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
  ? `- **autoExpand 활성**: 슬롯 외에 섹션을 더 풍부하게 만들 추가 카피가 자연스러우면 additions 배열에 { "style": "...", "text": "..." }. style은 h1/h2/h3/body/caption/label 중 하나. 자연스러움 우선 — 억지로 늘리지 말 것. 불필요하면 빈 배열 [].`
  : ''}
${autoExpand
  ? `- **컴포넌트 슬롯 자동 확장(autoExpand) — 매우 중요**:
  · 사용자가 명시적으로 개수를 요청(예: "5개로", "3x2로", "7행", "6 turn") 했거나, 카피 컨텍스트상 기존 슬롯 수와 다른 게 자연스러우면 **반드시 \`extensions\` 객체에** 해당 컴포넌트 통째로 새 구조를 반환.
  · 종류별 sub-array: graphs/tables/canvases/steps/chats/labels.
  · **replacements 슬롯의 인덱스를 임의로 늘리거나 줄이지 말 것** — 슬롯 변경은 오직 extensions 경로로만.
  · replacements는 입력의 기존 슬롯 ID와 1:1 매칭만. extensions는 컴포넌트 자체를 새 구조로 교체 (id는 입력 ID 그대로).
  · 변경 안 한 컴포넌트는 해당 sub-array에 넣지 말 것. 모든 sub-array는 빈 배열 [] 가능.
  · **canvas-block 특별 주의**: 입력에 \`cv:<cvb_id>:<idx>:title|desc\` 형태 슬롯이 있고 사용자가 카드 개수/grid를 다르게 요청(예: "3x2=6장", "카드 6개", "6가지 차별점") 하면 **반드시 \`extensions.canvases\`** 에 \`{ id: "<cvb_id>", cols: <N>, rows: <M>, cards: [{title, desc}, ...] }\` 형태로 응답. replacements의 cv:* 인덱스만 늘려서 응답하면 grid는 그대로 유지되어 사용자 요청 무시되는 결과 — 잘못된 동작. 대신 그 cvb_id의 cv:* replacements는 빈 문자열로 두거나 응답하지 않아도 됨 (extensions가 그 컴포넌트를 통째로 교체).`
  : `- extensions의 모든 sub-array는 빈 배열 [].`}

응답은 JSON: replacements 배열은 입력 블록과 1:1 동일 길이/순서. additions/extensions는 변경 없으면 빈 배열·빈 객체.`;
}

const RESPONSE_SCHEMA = {
  name: 'section_fill',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      replacements: {
        type: 'array',
        items: {
          type: 'object',
          properties: { id: { type: 'string' }, text: { type: 'string' } },
          required: ['id', 'text'],
          additionalProperties: false,
        },
      },
      additions: {
        type: 'array',
        items: {
          type: 'object',
          properties: { style: { type: 'string' }, text: { type: 'string' } },
          required: ['style', 'text'],
          additionalProperties: false,
        },
      },
      // ── extensions: 컴포넌트 내부 슬롯 구조까지 변경 (autoExpand 활성 시 사용 가능) ──
      extensions: {
        type: 'object',
        properties: {
          graphs: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: { label: { type: 'string' }, value: { type: 'number' } },
                    required: ['label', 'value'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['id', 'items'],
              additionalProperties: false,
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
              additionalProperties: false,
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
                cards: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: { title: { type: 'string' }, desc: { type: 'string' } },
                    required: ['title', 'desc'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['id', 'cols', 'rows', 'cards'],
              additionalProperties: false,
            },
          },
          steps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                steps: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: { title: { type: 'string' }, desc: { type: 'string' } },
                    required: ['title', 'desc'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['id', 'steps'],
              additionalProperties: false,
            },
          },
          chats: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                messages: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: { text: { type: 'string' }, align: { type: 'string' } },
                    required: ['text', 'align'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['id', 'messages'],
              additionalProperties: false,
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
              additionalProperties: false,
            },
          },
        },
        required: ['graphs', 'tables', 'canvases', 'steps', 'chats', 'labels'],
        additionalProperties: false,
      },
    },
    required: ['replacements', 'additions', 'extensions'],
    additionalProperties: false,
  },
};

async function fillSectionTexts(payload) {
  // 1) payload.apiKey (사용자 Preferences) 우선
  // 2) goditor 전용 키
  // 3) 글로벌 환경변수
  const apiKey = (payload && payload.apiKey)
    || process.env.OPENAI_API_KEY_GODITOR
    || process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, error: 'OpenAI API 키가 없습니다. 환경설정에서 등록하거나 OPENAI_API_KEY 환경변수를 설정하세요.' };

  const blocks = Array.isArray(payload?.blocks) ? payload.blocks : [];
  if (blocks.length === 0) return { ok: false, error: '대상 텍스트 블록이 없습니다.' };

  const promptText = _buildPrompt(payload);
  const userContent = [{ type: 'text', text: promptText }];

  // 이미지: dataURL/path 모두 OpenAI image_url 포맷으로 변환
  const dataUrls = []
    .concat(Array.isArray(payload.imageDataUrls) ? payload.imageDataUrls : [])
    .concat(payload.imageDataUrl ? [payload.imageDataUrl] : []);
  for (const url of dataUrls) {
    if (!/^data:image\//.test(url)) return { ok: false, error: '이미지 dataURL 형식 오류' };
    userContent.push({ type: 'image_url', image_url: { url } });
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
      const url = `data:${mime};base64,${buf.toString('base64')}`;
      userContent.push({ type: 'image_url', image_url: { url } });
    } catch (e) {
      return { ok: false, error: `이미지 로드 실패: ${e.message}` };
    }
  }

  const body = {
    model: payload.model || DEFAULT_MODEL,
    messages: [{ role: 'user', content: userContent }],
    response_format: { type: 'json_schema', json_schema: RESPONSE_SCHEMA },
  };

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `OpenAI ${res.status}: ${errText.slice(0, 400)}` };
    }
    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content;
    if (!text) return { ok: false, error: 'OpenAI 응답이 비어있음' };
    let parsed;
    try { parsed = JSON.parse(text); }
    catch { return { ok: false, error: `JSON 파싱 실패: ${text.slice(0, 200)}` }; }
    const replacements = Array.isArray(parsed.replacements) ? parsed.replacements : [];
    const additions = Array.isArray(parsed.additions) ? parsed.additions : [];
    const extensions = (parsed.extensions && typeof parsed.extensions === 'object') ? parsed.extensions : null;
    try {
      const extensionsCounts = extensions ? Object.fromEntries(
        Object.entries(extensions).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0])
      ) : null;
      const logLine = JSON.stringify({
        ts: new Date().toISOString(),
        provider: 'openai',
        model: payload.model || DEFAULT_MODEL,
        fidelity: payload.fidelity,
        autoExpand: !!payload.autoExpand,
        blocks: blocks.length,
        images: dataUrls.length + filePaths.length,
        prompt: (payload.prompt || '').slice(0, 200),
        replacementsCount: replacements.length,
        additionsCount: additions.length,
        extensionsCounts,
        replacements,
        additions,
        extensions,
      });
      fs.appendFileSync('/tmp/web-editor-ai-fill.log', logLine + '\n');
    } catch (_) {}
    return { ok: true, replacements, additions, extensions };
  } catch (e) {
    return { ok: false, error: `네트워크 오류: ${e.message}` };
  }
}

module.exports = { fillSectionTexts };
