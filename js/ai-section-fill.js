/* ══════════════════════════════════════
   AI Section Fill — 섹션 안 text-block 일괄 채우기
   - 버튼 클릭 → 프롬프트 UI 오픈 → Gemini 호출 → 미리보기 → 적용
   - UI 구현체는 _openAIFillUI_impl() 한 함수에 모여있어 브랜치별로 교체 가능.
══════════════════════════════════════ */

/** 섹션에서 채우기 대상 수집 (DOM 순서)
   - .text-block — 직접 textContent 교체
   - .canvas-block[data-card-mode="simple"] — data-cards JSON 배열의 title/desc
   - .step-block — data-steps 배열의 title/desc
   - .chat-block — data-messages 배열의 text
   ID 규칙(가상):
     text-block:     <tb.id>
     canvas card:    cv:<cvb.id>:<idx>:title  /  cv:<cvb.id>:<idx>:desc
     step:           st:<sb.id>:<idx>:title   /  st:<sb.id>:<idx>:desc
     chat msg:       ch:<chb.id>:<idx>:text
*/
function collectSectionTextBlocks(sec) {
  if (!sec) return [];
  const items = [];
  // DOM 순서 보존을 위해 통합 셀렉터로 한 번에 순회
  const all = sec.querySelectorAll(
    '.text-block, .canvas-block, .step-block, .chat-block'
  );
  all.forEach(el => {
    if (el.classList.contains('text-block')) {
      const tbInner = el.querySelector('.tb-h1, .tb-h2, .tb-h3, .tb-body, .tb-caption, .tb-label') || el;
      const styleClass = (tbInner.classList && Array.from(tbInner.classList).find(c => c.startsWith('tb-'))) || 'tb-body';
      items.push({ id: el.id, style: styleClass, current: (tbInner.textContent || '').trim() });
      return;
    }
    if (el.classList.contains('canvas-block') && el.dataset.cardMode === 'simple') {
      let cards = [];
      try { cards = JSON.parse(el.dataset.cards || '[]'); } catch (_) {}
      const cols = parseInt(el.dataset.gridCols) || 1;
      const rows = parseInt(el.dataset.gridRows) || 1;
      const total = cols * rows;
      for (let i = 0; i < total; i++) {
        const c = cards[i] || {};
        items.push({ id: `cv:${el.id}:${i}:title`, style: 'card-title', current: (c.title || '').trim() });
        items.push({ id: `cv:${el.id}:${i}:desc`,  style: 'card-desc',  current: (c.desc  || '').trim() });
      }
      return;
    }
    if (el.classList.contains('step-block')) {
      let steps = [];
      try { steps = JSON.parse(el.dataset.steps || '[]'); } catch (_) {}
      steps.forEach((s, i) => {
        items.push({ id: `st:${el.id}:${i}:title`, style: 'step-title', current: (s.title || '').trim() });
        items.push({ id: `st:${el.id}:${i}:desc`,  style: 'step-desc',  current: (s.desc  || '').trim() });
      });
      return;
    }
    if (el.classList.contains('chat-block')) {
      let msgs = [];
      try { msgs = JSON.parse(el.dataset.messages || '[]'); } catch (_) {}
      msgs.forEach((m, i) => {
        items.push({ id: `ch:${el.id}:${i}:text`, style: 'chat-msg', current: (m.text || '').trim() });
      });
      return;
    }
  });
  return items;
}

/** Gemini 결과를 섹션에 적용 — ID prefix로 라우팅 */
function applyAIReplacements(sec, replacements) {
  if (!sec || !Array.isArray(replacements)) return 0;
  let applied = 0;
  // 동일 컴포넌트(canvas/step/chat) 변경분 묶어서 한 번만 re-render
  const dirty = new Set();
  const cardMutations = new Map();   // cvb_id -> { idx -> {title?, desc?} }
  const stepMutations = new Map();
  const chatMutations = new Map();

  replacements.forEach(rep => {
    if (!rep?.id || typeof rep.text !== 'string') return;
    const id = rep.id;

    // canvas card
    let m = id.match(/^cv:([^:]+):(\d+):(title|desc)$/);
    if (m) {
      const [, cvbId, idxStr, field] = m;
      if (!cardMutations.has(cvbId)) cardMutations.set(cvbId, new Map());
      const slot = cardMutations.get(cvbId);
      const idx = parseInt(idxStr);
      if (!slot.has(idx)) slot.set(idx, {});
      slot.get(idx)[field] = rep.text;
      applied += 1;
      return;
    }
    // step
    m = id.match(/^st:([^:]+):(\d+):(title|desc)$/);
    if (m) {
      const [, sbId, idxStr, field] = m;
      if (!stepMutations.has(sbId)) stepMutations.set(sbId, new Map());
      const slot = stepMutations.get(sbId);
      const idx = parseInt(idxStr);
      if (!slot.has(idx)) slot.set(idx, {});
      slot.get(idx)[field] = rep.text;
      applied += 1;
      return;
    }
    // chat
    m = id.match(/^ch:([^:]+):(\d+):text$/);
    if (m) {
      const [, chbId, idxStr] = m;
      if (!chatMutations.has(chbId)) chatMutations.set(chbId, new Map());
      chatMutations.get(chbId).set(parseInt(idxStr), rep.text);
      applied += 1;
      return;
    }
    // 일반 text-block
    const tb = sec.querySelector(`#${CSS.escape(id)}`);
    if (!tb) return;
    const tbInner = tb.querySelector('.tb-h1, .tb-h2, .tb-h3, .tb-body, .tb-caption, .tb-label') || tb;
    tbInner.textContent = rep.text;
    applied += 1;
  });

  // canvas-block 적용
  cardMutations.forEach((slotMap, cvbId) => {
    const cvb = sec.querySelector(`#${CSS.escape(cvbId)}`);
    if (!cvb) return;
    let cards = [];
    try { cards = JSON.parse(cvb.dataset.cards || '[]'); } catch (_) { cards = []; }
    slotMap.forEach((fields, idx) => {
      cards[idx] = { ...(cards[idx] || {}), ...fields };
    });
    cvb.dataset.cards = JSON.stringify(cards);
    window.renderCanvas?.(cvb);
  });
  // step-block 적용
  stepMutations.forEach((slotMap, sbId) => {
    const sb = sec.querySelector(`#${CSS.escape(sbId)}`);
    if (!sb) return;
    let steps = [];
    try { steps = JSON.parse(sb.dataset.steps || '[]'); } catch (_) {}
    slotMap.forEach((fields, idx) => {
      steps[idx] = { ...(steps[idx] || {}), ...fields };
    });
    sb.dataset.steps = JSON.stringify(steps);
    window.renderStepBlock?.(sb);
  });
  // chat-block 적용
  chatMutations.forEach((idxMap, chbId) => {
    const chb = sec.querySelector(`#${CSS.escape(chbId)}`);
    if (!chb) return;
    let msgs = [];
    try { msgs = JSON.parse(chb.dataset.messages || '[]'); } catch (_) {}
    idxMap.forEach((text, idx) => {
      msgs[idx] = { ...(msgs[idx] || { align: 'left' }), text };
    });
    chb.dataset.messages = JSON.stringify(msgs);
    window.renderChatBlock?.(chb);
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

let _aiFillState = { secEl: null, tone: '', imageDataUrl: null };

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
        placeholder="예: 헬스보충제 주제로 채워줘&#10;(이미지 paste / drag-drop 가능)"></textarea>
      <div class="ai-fill-panel-thumb hidden" id="ai-fill-panel-thumb">
        <img id="ai-fill-panel-thumb-img" alt="첨부 이미지">
        <button class="ai-fill-panel-thumb-x" id="ai-fill-panel-thumb-x" type="button">×</button>
      </div>
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

  // ── 헤더 드래그 (color-adjust-panel 패턴 동일) ──
  const header = panel.querySelector('.ai-fill-panel-header');
  let _dragging = false, _sx = 0, _sy = 0, _sl = 0, _st = 0;
  header.addEventListener('mousedown', e => {
    if (e.target.classList.contains('ai-fill-panel-close')) return;
    e.preventDefault();
    _dragging = true;
    const rect = panel.getBoundingClientRect();
    panel.style.left   = rect.left + 'px';
    panel.style.top    = rect.top  + 'px';
    panel.style.right  = 'auto';
    panel.style.bottom = 'auto';
    _sx = e.clientX; _sy = e.clientY;
    _sl = rect.left; _st = rect.top;
    document.addEventListener('mousemove', _onMove);
    document.addEventListener('mouseup', _onUp);
  });
  function _onMove(e) {
    if (!_dragging) return;
    const newLeft = _sl + (e.clientX - _sx);
    const newTop  = Math.max(0, _st + (e.clientY - _sy));
    panel.style.left = newLeft + 'px';
    panel.style.top  = newTop  + 'px';
    try {
      localStorage.setItem('aiFillPanelPos', JSON.stringify({ left: newLeft, top: newTop }));
    } catch (_) {}
  }
  function _onUp() {
    _dragging = false;
    document.removeEventListener('mousemove', _onMove);
    document.removeEventListener('mouseup', _onUp);
  }
  // 저장된 위치 복원
  try {
    const saved = JSON.parse(localStorage.getItem('aiFillPanelPos') || 'null');
    if (saved && typeof saved.left === 'number' && typeof saved.top === 'number') {
      panel.style.left  = saved.left + 'px';
      panel.style.top   = saved.top  + 'px';
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
    }
  } catch (_) {}

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

  // ── 클립보드 paste / drag-drop 이미지 → data URL 첨부 ──
  const thumbBox = panel.querySelector('#ai-fill-panel-thumb');
  const thumbImg = panel.querySelector('#ai-fill-panel-thumb-img');
  function _setImageDataUrl(dataUrl) {
    _aiFillState.imageDataUrl = dataUrl;
    if (dataUrl) {
      thumbImg.src = dataUrl;
      thumbBox.classList.remove('hidden');
    } else {
      thumbImg.src = '';
      thumbBox.classList.add('hidden');
    }
  }
  panel.querySelector('#ai-fill-panel-thumb-x').addEventListener('click', () => _setImageDataUrl(null));
  function _readBlobToDataUrl(blob) {
    return new Promise(res => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.readAsDataURL(blob);
    });
  }
  const promptEl = panel.querySelector('#ai-fill-panel-prompt');
  promptEl.addEventListener('paste', async e => {
    const items = [...(e.clipboardData?.items || [])].filter(it => it.type.startsWith('image/'));
    if (items.length === 0) return;
    e.preventDefault();
    const blob = items[0].getAsFile();
    if (!blob) return;
    const dataUrl = await _readBlobToDataUrl(blob);
    _setImageDataUrl(dataUrl);
    window.showToast?.('🖼️ 이미지 첨부됨');
  });
  // 패널 전체에 drag-drop
  ['dragover', 'drop'].forEach(ev => panel.addEventListener(ev, e => {
    if (ev === 'dragover') { e.preventDefault(); return; }
    e.preventDefault();
    const file = [...(e.dataTransfer?.files || [])].find(f => f.type.startsWith('image/'));
    if (!file) return;
    _readBlobToDataUrl(file).then(d => { _setImageDataUrl(d); window.showToast?.('🖼️ 이미지 첨부됨'); });
  }));

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
      prompt: promptText, tone: _aiFillState.tone, mode,
      imageDataUrl: _aiFillState.imageDataUrl || null,
      imagePath,
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
  _aiFillState.imageDataUrl = null;
  const panel = _ensureAIFillPanel();
  panel.classList.add('open');
  panel.querySelector('#ai-fill-panel-meta').textContent =
    `${secEl.id} · 텍스트 ${blocks.length}개`;
  panel.querySelector('#ai-fill-panel-prompt').value = '';
  panel.querySelector('#ai-fill-panel-image').value = '';
  panel.querySelector('#ai-fill-panel-empty').checked = false;
  panel.querySelector('#ai-fill-panel-thumb').classList.add('hidden');
  panel.querySelector('#ai-fill-panel-thumb-img').src = '';
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

/* ── 마이그레이션: 기존 저장 프로젝트의 toolbar에 ✨ 버튼 주입 ──
   block-factory.js 변경 이전에 저장된 섹션 HTML에는 ✨ 버튼이 없으므로
   load 후 toolbar를 스캔해서 첫 번째 자식으로 삽입한다. */
function _ensureAIFillButton(sec) {
  if (!sec) return;
  const tb = sec.querySelector(':scope > .section-toolbar');
  if (!tb) return;
  if (tb.querySelector('.st-ai-fill-btn')) return;
  const btn = document.createElement('button');
  btn.className = 'st-btn st-ai-fill-btn';
  btn.title = 'AI로 섹션 텍스트 채우기';
  btn.textContent = '✨';
  btn.setAttribute('onclick', 'openAIFillUI(this)');
  tb.insertBefore(btn, tb.firstChild);
}
function _hydrateAllSectionsForAIBtn() {
  document.querySelectorAll('.section-block').forEach(_ensureAIFillButton);
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    _hydrateAllSectionsForAIBtn();
    setTimeout(_hydrateAllSectionsForAIBtn, 1500);
  });
} else {
  _hydrateAllSectionsForAIBtn();
  setTimeout(_hydrateAllSectionsForAIBtn, 1500);
}
const _aiBtnObserver = new MutationObserver(muts => {
  for (const m of muts) {
    m.addedNodes.forEach(n => {
      if (n.nodeType !== 1) return;
      if (n.classList?.contains('section-block')) _ensureAIFillButton(n);
      n.querySelectorAll?.('.section-block').forEach(_ensureAIFillButton);
    });
  }
});
_aiBtnObserver.observe(document.body, { childList: true, subtree: true });
