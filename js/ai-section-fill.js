/* ══════════════════════════════════════
   AI Section Fill — 섹션 안 text-block 일괄 채우기
   - 버튼 클릭 → 프롬프트 UI 오픈 → Gemini 호출 → 미리보기 → 적용
   - UI 구현체는 _openAIFillUI_impl() 한 함수에 모여있어 브랜치별로 교체 가능.
══════════════════════════════════════ */

/** 섹션 안 모든 text-block 수집 (DOM 순서 보존) */
function collectSectionTextBlocks(sec) {
  if (!sec) return [];
  const tbs = Array.from(sec.querySelectorAll('.text-block'));
  return tbs.map(tb => {
    // 실제 텍스트 컨테이너(tb-h1/h2/body/caption/label)
    const tbInner = tb.querySelector('.tb-h1, .tb-h2, .tb-h3, .tb-body, .tb-caption, .tb-label') || tb;
    const styleClass = tbInner.classList && Array.from(tbInner.classList)
      .find(c => c.startsWith('tb-')) || 'tb-body';
    return {
      id: tb.id,
      style: styleClass,        // tb-h1 / tb-h2 / tb-body / tb-label / tb-caption
      current: (tbInner.textContent || '').trim(),
      _tbInner: tbInner,        // 적용 단계에서 직접 textContent 갈아끼움
    };
  });
}

/** Gemini 결과를 섹션에 적용 — 1:1 ID 매칭 */
function applyAIReplacements(sec, replacements) {
  if (!sec || !Array.isArray(replacements)) return 0;
  let applied = 0;
  replacements.forEach(rep => {
    if (!rep?.id || typeof rep.text !== 'string') return;
    const tb = sec.querySelector(`#${CSS.escape(rep.id)}`);
    if (!tb) return;
    const tbInner = tb.querySelector('.tb-h1, .tb-h2, .tb-h3, .tb-body, .tb-caption, .tb-label') || tb;
    tbInner.textContent = rep.text;
    applied += 1;
  });
  if (applied > 0) window.scheduleAutoSave?.();
  return applied;
}

/** Gemini 호출 (preload IPC) — 결과 { ok, replacements?, error? } */
async function callGeminiFill(payload) {
  if (!window.electronAPI?.aiFillSectionTexts) {
    return { ok: false, error: 'electronAPI.aiFillSectionTexts 가 없습니다 (preload).' };
  }
  return window.electronAPI.aiFillSectionTexts(payload);
}

/* ── UI 구현 (B안: 우측 사이드 패널, 즉시 적용) ─────────────── */
const TONE_PRESETS = [
  { id: 'trust',    label: '신뢰감' },
  { id: 'friendly', label: '친근함' },
  { id: 'punchy',   label: '강력셀링' },
  { id: 'simple',   label: '심플' },
];

let _aiFillState = { secEl: null, tone: '' };

function _ensureAIFillPanel() {
  let panel = document.getElementById('ai-fill-panel');
  if (panel) return panel;
  panel = document.createElement('div');
  panel.id = 'ai-fill-panel';
  panel.className = 'ai-fill-panel';
  panel.innerHTML = `
    <div class="ai-fill-panel-header">
      <span class="ai-fill-panel-title">✨ AI 텍스트 채우기</span>
      <button class="ai-fill-panel-close" type="button">×</button>
    </div>
    <div class="ai-fill-panel-body">
      <div class="ai-fill-panel-meta" id="ai-fill-panel-meta"></div>
      <textarea id="ai-fill-panel-prompt" rows="4"
        placeholder="예: 헬스보충제 주제로 채워줘"></textarea>
      <div class="ai-fill-panel-chips" id="ai-fill-panel-chips"></div>
      <input type="text" id="ai-fill-panel-image"
        placeholder="이미지 파일 경로 (선택)">
      <label class="ai-fill-panel-mode">
        <input type="checkbox" id="ai-fill-panel-empty"> 빈 블록만
      </label>
      <button class="ai-fill-panel-run" id="ai-fill-panel-run" type="button">생성 → 적용</button>
      <div class="ai-fill-panel-preview hidden" id="ai-fill-panel-preview"></div>
    </div>`;
  document.body.appendChild(panel);
  panel.querySelector('.ai-fill-panel-close').addEventListener('click', () => panel.classList.remove('open'));

  const chipsBox = panel.querySelector('#ai-fill-panel-chips');
  TONE_PRESETS.forEach(t => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'ai-fill-panel-chip';
    chip.textContent = t.label;
    chip.dataset.tone = t.id;
    chip.addEventListener('click', () => {
      const wasSelected = chip.classList.contains('selected');
      chipsBox.querySelectorAll('.ai-fill-panel-chip').forEach(c => c.classList.remove('selected'));
      if (!wasSelected) { chip.classList.add('selected'); _aiFillState.tone = t.id; }
      else { _aiFillState.tone = ''; }
    });
    chipsBox.appendChild(chip);
  });

  panel.querySelector('#ai-fill-panel-run').addEventListener('click', async () => {
    const sec = _aiFillState.secEl;
    if (!sec) return;
    const promptText = panel.querySelector('#ai-fill-panel-prompt').value.trim();
    const imagePath = panel.querySelector('#ai-fill-panel-image').value.trim() || null;
    const mode = panel.querySelector('#ai-fill-panel-empty').checked ? 'fillEmpty' : 'replaceAll';
    const blocks = collectSectionTextBlocks(sec);
    if (blocks.length === 0) { window.showToast?.('⚠️ 텍스트 블록 없음'); return; }
    const runBtn = panel.querySelector('#ai-fill-panel-run');
    runBtn.disabled = true; runBtn.textContent = '생성 중…';
    window.showToast?.('✨ AI가 작성 중…');
    const res = await callGeminiFill({
      blocks: blocks.map(b => ({ id: b.id, style: b.style, current: b.current })),
      prompt: promptText, tone: _aiFillState.tone, mode, imagePath,
    });
    runBtn.disabled = false; runBtn.textContent = '재생성';
    if (!res?.ok) { window.showToast?.(`❌ ${res?.error || '오류'}`); return; }
    window.pushHistory?.();
    const n = applyAIReplacements(sec, res.replacements || []);
    const preview = panel.querySelector('#ai-fill-panel-preview');
    const byId = new Map(blocks.map(b => [b.id, b]));
    preview.innerHTML = '<div class="ai-fill-panel-preview-title">적용됨 (Cmd+Z 되돌리기)</div>' +
      (res.replacements || []).map(rep => {
        const b = byId.get(rep.id);
        const styleLbl = (b?.style || '').replace('tb-', '');
        return `<div class="ai-fill-panel-preview-row">
          <span class="ai-fill-panel-preview-style">${styleLbl}</span>
          <span class="ai-fill-panel-preview-text">${rep.text}</span>
        </div>`;
      }).join('');
    preview.classList.remove('hidden');
    window.showToast?.(`✅ ${n}개 블록 적용됨`);
  });

  return panel;
}

async function _openAIFillUI_impl(secEl) {
  const blocks = collectSectionTextBlocks(secEl);
  if (blocks.length === 0) {
    window.showToast?.('⚠️ 이 섹션에는 텍스트 블록이 없습니다.');
    return;
  }
  _aiFillState.secEl = secEl;
  _aiFillState.tone = '';
  const panel = _ensureAIFillPanel();
  panel.classList.add('open');
  panel.querySelector('#ai-fill-panel-meta').textContent =
    `${secEl.id} · 텍스트 ${blocks.length}개`;
  panel.querySelector('#ai-fill-panel-prompt').value = '';
  panel.querySelector('#ai-fill-panel-image').value = '';
  panel.querySelector('#ai-fill-panel-empty').checked = false;
  panel.querySelectorAll('.ai-fill-panel-chip').forEach(c => c.classList.remove('selected'));
  panel.querySelector('#ai-fill-panel-preview').classList.add('hidden');
  panel.querySelector('#ai-fill-panel-preview').innerHTML = '';
  const runBtn = panel.querySelector('#ai-fill-panel-run');
  runBtn.disabled = false; runBtn.textContent = '생성 → 적용';
  panel.querySelector('#ai-fill-panel-prompt').focus();
}

/** UI에서 호출하는 공용 실행기 — payload 받아 호출/적용/토스트 */
async function runAIFill(secEl, { prompt, tone, mode, imagePath }) {
  const blocks = collectSectionTextBlocks(secEl);
  if (blocks.length === 0) {
    window.showToast?.('⚠️ 텍스트 블록 없음');
    return { ok: false };
  }
  window.showToast?.('✨ AI가 작성 중…');
  const payload = {
    blocks: blocks.map(b => ({ id: b.id, style: b.style, current: b.current })),
    prompt: prompt || '',
    tone:   tone   || '',
    mode:   mode   || 'replaceAll',
    imagePath: imagePath || null,
  };
  const res = await callGeminiFill(payload);
  if (!res?.ok) {
    window.showToast?.(`❌ ${res?.error || '알 수 없는 오류'}`);
    return res;
  }
  window.pushHistory?.();
  const n = applyAIReplacements(secEl, res.replacements || []);
  window.showToast?.(`✅ ${n}개 블록 적용됨`);
  return res;
}

/** 외부에서 호출하는 진입점 — 섹션 toolbar 버튼이 사용 */
function openAIFillUI(btnEl) {
  const sec = btnEl.closest('.section-block');
  if (!sec) return;
  _openAIFillUI_impl(sec);
}

window.openAIFillUI            = openAIFillUI;
window.runAIFill               = runAIFill;
window.collectSectionTextBlocks = collectSectionTextBlocks;
window.applyAIReplacements     = applyAIReplacements;
