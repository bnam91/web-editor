/* ══════════════════════════════════════
   Image Gen Service — Nano Banana / gpt-image-1 어댑터
   1차: model prefix 분기, prompt-only 모드 즉시 반환,
        gemini-2.5-flash-image · gpt-image-1 실 호출 어댑터.
   apiKey 주입은 main.js의 getApiKey() 라우터 책임 (텍스트 fill 패턴 동일).
══════════════════════════════════════ */

const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image';
const OPENAI_IMAGE_MODEL = 'gpt-image-1';
// 1장 1024x1024 medium 추정 단가 (KRW). UI 표시용 근사치.
const KRW_PER_IMAGE = { 'gemini-2.5-flash-image': 54, 'gpt-image-1': 56 };

function _composePrompt({ prompt, refs }) {
  // refs: [{ src, label }] — picker 정보를 텍스트로 포함 (prompt-only 시 사용자 복사용 + Gemini 보조 컨텍스트)
  const parts = [];
  if (Array.isArray(refs) && refs.length) {
    parts.push('[Reference Inputs]');
    refs.forEach((r, i) => parts.push(`${i + 1}. ${r.label || 'image'}`));
  }
  parts.push('[Prompt]');
  parts.push(prompt || '');
  return parts.join('\n');
}

function _krwApprox(model, count) {
  const unit = KRW_PER_IMAGE[model] || 0;
  return unit * (count || 1);
}

function _parseDataUrl(url) {
  const m = /^data:([^;]+);base64,(.+)$/.exec(String(url || ''));
  if (!m) return null;
  return { mime: m[1], b64: m[2] };
}

async function _generateGemini({ apiKey, prompt, refs, count, outpaint }) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent`;
  // outpaint: 합성 이미지(원본+투명 패딩)를 input으로 + 명시 프롬프트
  let effectivePrompt = _composePrompt({ prompt, refs });
  let effectiveRefs = refs;
  if (outpaint?.imageDataUrl) {
    effectivePrompt = (prompt || '') + '\n\nIMPORTANT: This input image has transparent padding around the original content. Fill ONLY the transparent areas with content that naturally extends the original scene. Keep the original (non-transparent) area pixel-perfect unchanged. Return an image of the EXACT same dimensions as the input.';
    effectiveRefs = [{ src: outpaint.imageDataUrl, label: 'outpaint_canvas' }];
  }
  const parts = [{ text: effectivePrompt }];
  for (const r of (effectiveRefs || [])) {
    const p = _parseDataUrl(r.src);
    if (!p) continue;
    parts.push({ inline_data: { mime_type: p.mime, data: p.b64 } });
  }
  const items = [];
  const n = Math.max(1, Math.min(4, count || 1));
  let totalTokens = 0;
  for (let i = 0; i < n; i++) {
    const body = {
      contents: [{ role: 'user', parts }],
      generationConfig: { responseModalities: ['IMAGE'] },
    };
    const res = await fetch(`${endpoint}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `Gemini ${res.status}: ${errText.slice(0, 300)}` };
    }
    const json = await res.json();
    const cand = json?.candidates?.[0]?.content?.parts || [];
    const img = cand.find(p => p.inline_data || p.inlineData);
    const inline = img?.inline_data || img?.inlineData;
    if (!inline?.data) {
      return { ok: false, error: 'Gemini 응답에 이미지 없음' };
    }
    items.push({ b64: inline.data, mime: inline.mime_type || inline.mimeType || 'image/png' });
    totalTokens += (json?.usageMetadata?.totalTokenCount || 0);
  }
  return { ok: true, items, cost: { tokens: totalTokens, krwApprox: _krwApprox(GEMINI_IMAGE_MODEL, n) } };
}

async function _generateOpenAI({ apiKey, prompt, refs, count, outpaint }) {
  const n = Math.max(1, Math.min(4, count || 1));
  const composedPrompt = _composePrompt({ prompt, refs });
  let endpoint, body, headers;
  headers = { Authorization: 'Bearer ' + apiKey };
  // outpaint: image + mask로 edits 호출 (refs는 무시)
  if (outpaint?.imageDataUrl && outpaint?.maskDataUrl) {
    const form = new FormData();
    form.append('model', OPENAI_IMAGE_MODEL);
    // 확장 의도 명시 — keep original + fill transparent
    const outpaintPrompt = (prompt || '') + ' Keep the original (non-transparent) area pixel-perfect. Fill the transparent area with content that naturally extends the scene.';
    form.append('prompt', outpaintPrompt);
    form.append('n', String(n));
    // 확장 후 비율에 가장 가까운 size 선택 (gpt-image-1 허용: 1024x1024, 1024x1536, 1536x1024)
    const w = outpaint.w, h = outpaint.h;
    const aspectSize = (w >= h * 1.25) ? '1536x1024' : (h >= w * 1.25) ? '1024x1536' : '1024x1024';
    form.append('size', aspectSize);
    const imgP = _parseDataUrl(outpaint.imageDataUrl);
    const mskP = _parseDataUrl(outpaint.maskDataUrl);
    if (!imgP || !mskP) return { ok: false, error: 'outpaint 페이로드 파싱 실패' };
    form.append('image', new Blob([Buffer.from(imgP.b64, 'base64')], { type: 'image/png' }), 'image.png');
    form.append('mask',  new Blob([Buffer.from(mskP.b64, 'base64')], { type: 'image/png' }), 'mask.png');
    endpoint = 'https://api.openai.com/v1/images/edits';
    body = form;
  } else if (refs && refs.length) {
    // multipart/form-data — 첫 ref를 image, 나머지를 image[]로
    const form = new FormData();
    form.append('model', OPENAI_IMAGE_MODEL);
    form.append('prompt', composedPrompt);
    form.append('n', String(n));
    form.append('size', '1024x1024');
    refs.forEach((r, i) => {
      const p = _parseDataUrl(r.src);
      if (!p) return;
      const buf = Buffer.from(p.b64, 'base64');
      const blob = new Blob([buf], { type: p.mime });
      form.append(i === 0 ? 'image' : 'image[]', blob, `ref_${i}.${p.mime === 'image/jpeg' ? 'jpg' : 'png'}`);
    });
    endpoint = 'https://api.openai.com/v1/images/edits';
    body = form;
  } else {
    endpoint = 'https://api.openai.com/v1/images/generations';
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify({ model: OPENAI_IMAGE_MODEL, prompt: composedPrompt, n, size: '1024x1024' });
  }
  const res = await fetch(endpoint, { method: 'POST', headers, body });
  if (!res.ok) {
    const errText = await res.text();
    return { ok: false, error: `OpenAI ${res.status}: ${errText.slice(0, 300)}` };
  }
  const json = await res.json();
  const data = Array.isArray(json?.data) ? json.data : [];
  if (!data.length) return { ok: false, error: 'OpenAI 응답에 이미지 없음' };
  const items = data.map(d => ({ b64: d.b64_json, mime: 'image/png' })).filter(it => it.b64);
  if (!items.length) return { ok: false, error: 'OpenAI 응답에 b64_json 없음' };
  const tokens = json?.usage?.total_tokens || 0;
  return { ok: true, items, cost: { tokens, krwApprox: _krwApprox(OPENAI_IMAGE_MODEL, items.length) } };
}

async function generateImage(payload) {
  const apiMode = payload?.apiMode || 'direct';
  let model = String(payload?.model || GEMINI_IMAGE_MODEL);
  const refs = Array.isArray(payload?.refs) ? payload.refs : [];
  const prompt = String(payload?.prompt || '').trim();
  const count = Math.max(1, Math.min(4, parseInt(payload?.count) || 1));
  const outpaint = payload?.outpaint || null;

  if (apiMode === 'promptOnly' || model === 'prompt-only') {
    return {
      ok: true,
      items: [],
      cost: { tokens: 0, krwApprox: 0 },
      promptCombined: _composePrompt({ prompt, refs }),
    };
  }

  if (!prompt && !outpaint) return { ok: false, error: '프롬프트가 비어있습니다.' };
  const apiKey = payload?.apiKey;
  if (!apiKey) return { ok: false, error: 'API 키가 없습니다. 환경설정에서 등록하세요.' };

  try {
    if (model.startsWith('gpt-')) return await _generateOpenAI({ apiKey, prompt, refs, count, outpaint });
    return await _generateGemini({ apiKey, prompt, refs, count, outpaint });
  } catch (e) {
    return { ok: false, error: `네트워크 오류: ${e.message}` };
  }
}

module.exports = { generateImage };
