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
  'table-header': '표 헤더. 짧고 명확하게(2~10자).',
  'table-cell':   '표 셀 내용. 짧게(2~30자).',
  'graph-label':  '그래프 항목 이름. 짧게(2~10자).',
  'graph-value':  '그래프 항목 수치. 0~100 범위 정수 권장. 카테고리별 상대 크기를 반영해서 다양하게.',
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

function _buildPrompt({ blocks, prompt, tone, mode, fidelity, autoExpand }) {
  // ── verbatim 모드: 이미지/사용자 입력 텍스트를 그대로 옮기는 모드 ──
  // 길이힌트/톤/응용 일체 무시. OCR/전사 도구처럼 동작.
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

[추출 대상 — 이것만 가져올 것]
- 이미지 위/아래/사이에 큰 글씨로 직접 타이핑된 한글 헤딩
- 본문 카피, 강조 문구, 캡션/주석 (예: "* …" 으로 시작하는 작은 글씨 포함)

[추출 금지 — 절대 가져오지 말 것]
- 이미지 안에 합성된 사진·인증서·증명서·스크린샷·도장·QR코드 안의 글자
- 영문 라벨, 등록번호, 날짜 도장 등 사진 내부 메타데이터
- 워터마크·로고·브랜드 마크 안의 글자
※ 즉, "사진처럼 박혀있는 텍스트"는 무시하고 "디자이너가 카피라이팅으로 입력한 텍스트"만 가져옵니다.

[규칙 — 절대 어기지 말 것]
- 한 글자도 추가/생략/요약/풀어쓰기 금지. 원문 그대로.
- 길이힌트·톤·문장수 제한은 모두 무시.
- 응용/창작/문장 보강 금지. 단순 전사만.
- 카피 텍스트 단락 수가 블록 슬롯 수보다 적으면 남는 블록은 반드시 빈 문자열("")로.
- DOM 블록 순서와 카피 텍스트 등장 순서를 자연스럽게 매핑(위→아래, h2/body/caption 의미가 맞도록).
- 이미지의 줄바꿈은 한 블록 내에서 자연스럽게 합쳐도 됨(불필요한 줄바꿈 금지).
- **echo back 금지**: 입력으로 받은 "현재" 값(예: "본문 내용을 입력하세요." 등 placeholder)을 그대로 응답에 다시 사용하지 말 것. 이미지에서 추출한 실제 카피 텍스트만 응답할 것. 추출할 카피가 없으면 빈 문자열("").
${autoExpand
  ? `- **카피 단락 > 슬롯 수일 때(autoExpand 활성)**: 첫 N개(N=슬롯 수) 단락은 replacements에 1:1 매핑하고, **남는 단락은 반드시 \`additions\` 배열에** { "style": "...", "text": "..." } 형태로 추가. style은 단락의 시각적 위계에 따라 h1 / h2 / h3 / body / caption / label 중 정확히 하나 선택(큰 글씨=h2, 작은 주석=caption 등). 단락이 슬롯 이하면 additions는 빈 배열 [].
- **컴포넌트 슬롯 자동 확장(autoExpand) — 매우 중요**: 이미지 안의 항목 수가 기존 슬롯 수와 다르면 **반드시 \`extensions\`** 사용. **replacements 슬롯 인덱스 임의 변경 금지**. id는 입력 그대로.`
  : `- 카피 텍스트 단락 수가 블록 슬롯 수보다 많으면 인접한 단락을 한 블록에 자연스럽게 합쳐도 됨.`}

[응답 형식]
- 반드시 JSON. replacements 길이/순서는 입력 블록과 1:1 동일.${autoExpand ? '\n- additions는 슬롯에 들어가지 않는 추가 단락만(빈 단락 X).\n- extensions는 변경된 컴포넌트만. 변경 없으면 빈 객체 {}.' : ''}`;
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
${autoExpand
  ? `- **autoExpand 활성**: 슬롯 외에 섹션을 더 풍부하게 만들 추가 카피가 자연스러우면(예: 헤딩만 있을 때 본문/캡션을 같이) \`additions\` 배열에 { "style": "...", "text": "..." } 추가. style은 h1/h2/h3/body/caption/label 중 하나. 자연스러움 우선 — 억지로 늘리지 말 것. 불필요하면 빈 배열 [].
- **컴포넌트 슬롯 자동 확장(autoExpand) — 매우 중요**:
  · 사용자가 명시적으로 개수를 요청(예: "5개로", "3x2로", "7행", "6 turn") 했거나, 컨텍스트상 기존 슬롯 수와 다른 게 자연스러우면 **반드시 \`extensions\` 객체에** 해당 컴포넌트 통째로 새 구조 반환.
  · sub-array: graphs/tables/canvases/steps/chats/labels.
  · **replacements 슬롯 인덱스를 임의로 늘리거나 줄이지 말 것** — 슬롯 변경은 오직 extensions 경로로.
  · id는 입력의 컴포넌트 id 그대로. 변경 안 한 컴포넌트는 sub-array에 안 넣음.
  · **canvas 특별 주의**: cv:<cvb_id>:idx:title|desc 슬롯이 있고 사용자가 카드 개수/grid를 다르게 요청하면 반드시 \`extensions.canvases\`에 { id, cols, rows, cards } 통째로 응답. cv:* replacements 인덱스만 늘리면 grid 변경 안 되어 잘못된 결과.`
  : ''}
- 응답은 반드시 JSON. replacements 배열의 길이와 순서는 입력 블록 목록과 1:1 동일하게.${autoExpand ? '\n- additions는 슬롯에 들어가지 않는 추가 카피만(빈 텍스트 X).\n- extensions는 변경된 컴포넌트만. 변경 없으면 빈 객체 {}.' : ''}`;
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

  // 이미지 입력: 다중 지원 (imageDataUrls[]/imagePaths[]) + 단수 backward compat
  const dataUrls = []
    .concat(Array.isArray(payload.imageDataUrls) ? payload.imageDataUrls : [])
    .concat(payload.imageDataUrl ? [payload.imageDataUrl] : []);
  for (const url of dataUrls) {
    const m = /^data:([^;]+);base64,(.+)$/.exec(url);
    if (!m) return { ok: false, error: '이미지 dataURL 형식 오류' };
    parts.push({ inline_data: { mime_type: m[1], data: m[2] } });
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
          additions: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                style: { type: 'STRING' },
                text:  { type: 'STRING' },
              },
              required: ['style', 'text'],
            },
          },
          // 컴포넌트 슬롯 자동 확장 (autoExpand 시)
          extensions: {
            type: 'OBJECT',
            properties: {
              graphs: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    id: { type: 'STRING' },
                    items: {
                      type: 'ARRAY',
                      items: { type: 'OBJECT', properties: { label: { type: 'STRING' }, value: { type: 'NUMBER' } }, required: ['label', 'value'] },
                    },
                  },
                  required: ['id', 'items'],
                },
              },
              tables: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    id: { type: 'STRING' },
                    headers: { type: 'ARRAY', items: { type: 'STRING' } },
                    rows: { type: 'ARRAY', items: { type: 'ARRAY', items: { type: 'STRING' } } },
                  },
                  required: ['id', 'headers', 'rows'],
                },
              },
              canvases: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    id: { type: 'STRING' },
                    cols: { type: 'INTEGER' },
                    rows: { type: 'INTEGER' },
                    cards: { type: 'ARRAY', items: { type: 'OBJECT', properties: { title: { type: 'STRING' }, desc: { type: 'STRING' } }, required: ['title', 'desc'] } },
                  },
                  required: ['id', 'cols', 'rows', 'cards'],
                },
              },
              steps: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    id: { type: 'STRING' },
                    steps: { type: 'ARRAY', items: { type: 'OBJECT', properties: { title: { type: 'STRING' }, desc: { type: 'STRING' } }, required: ['title', 'desc'] } },
                  },
                  required: ['id', 'steps'],
                },
              },
              chats: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    id: { type: 'STRING' },
                    messages: { type: 'ARRAY', items: { type: 'OBJECT', properties: { text: { type: 'STRING' }, align: { type: 'STRING' } }, required: ['text', 'align'] } },
                  },
                  required: ['id', 'messages'],
                },
              },
              labels: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    id: { type: 'STRING' },
                    labels: { type: 'ARRAY', items: { type: 'STRING' } },
                  },
                  required: ['id', 'labels'],
                },
              },
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
    const additions = Array.isArray(parsed.additions) ? parsed.additions : [];
    const extensions = (parsed.extensions && typeof parsed.extensions === 'object') ? parsed.extensions : null;
    try {
      const logLine = JSON.stringify({
        ts: new Date().toISOString(),
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
