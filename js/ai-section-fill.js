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
    '.text-block, .canvas-block, .step-block, .chat-block, .table-block, .label-group-block, .graph-block, .icon-text-block'
  );
  all.forEach(el => {
    if (el.classList.contains('text-block')) {
      // .tb-bubble은 speech-bubble-block의 본문, 나머지는 일반 텍스트 블록
      const tbInner = el.querySelector('.tb-h1, .tb-h2, .tb-h3, .tb-body, .tb-caption, .tb-label, .tb-bubble') || el;
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
    // table-block: thead의 th + tbody의 td 셀 텍스트
    if (el.classList.contains('table-block')) {
      el.querySelectorAll(':scope > table > thead > tr > th').forEach((th, i) => {
        items.push({ id: `tbl:${el.id}:h${i}`, style: 'table-header', current: (th.textContent || '').trim() });
      });
      Array.from(el.querySelectorAll(':scope > table > tbody > tr')).forEach((tr, r) => {
        Array.from(tr.children).forEach((td, c) => {
          items.push({ id: `tbl:${el.id}:r${r}c${c}`, style: 'table-cell', current: (td.textContent || '').trim() });
        });
      });
      return;
    }
    // label-group-block: 각 .label-item의 .label-item-text
    if (el.classList.contains('label-group-block')) {
      el.querySelectorAll(':scope > .label-item > .label-item-text').forEach((sp, i) => {
        items.push({ id: `lg:${el.id}:${i}`, style: 'label', current: (sp.textContent || '').trim() });
      });
      return;
    }
    // icon-text-block: .itb-text 본문 1개
    if (el.classList.contains('icon-text-block')) {
      const inner = el.querySelector(':scope > .itb-text');
      items.push({ id: `itb:${el.id}`, style: 'body', current: (inner?.textContent || '').trim() });
      return;
    }
    // graph-block: dataset.items의 label + value 모두 추출
    if (el.classList.contains('graph-block')) {
      let g = [];
      try { g = JSON.parse(el.dataset.items || '[]'); } catch (_) {}
      g.forEach((item, i) => {
        items.push({ id: `grb:${el.id}:${i}:label`, style: 'graph-label', current: (item.label || '').trim() });
        items.push({ id: `grb:${el.id}:${i}:value`, style: 'graph-value', current: String(item.value ?? '') });
      });
      return;
    }
  });
  return items;
}

/** Gemini 결과를 섹션에 적용 — ID prefix로 라우팅
 *  additions: [{ style, text }, ...]   — autoExpand 시 부족한 만큼 새 text-block 생성
 */
function applyAIReplacements(sec, replacements, additions) {
  if (!sec || !Array.isArray(replacements)) return 0;
  let applied = 0;
  // 동일 컴포넌트(canvas/step/chat/table/label/graph) 변경분 묶어서 한 번만 re-render
  const dirty = new Set();
  const cardMutations  = new Map();  // cvb_id -> Map(idx -> {title?, desc?})
  const stepMutations  = new Map();  // sb_id  -> Map(idx -> {title?, desc?})
  const chatMutations  = new Map();  // chb_id -> Map(idx -> text)
  const tableMutations = new Map();  // tbl_id -> Map(slot -> text)  slot = "h<col>" or "r<row>c<col>"
  const labelMutations = new Map();  // lg_id  -> Map(idx -> text)
  const graphMutations = new Map();  // grb_id -> Map(idx -> { label?, value? })
  const iconTextMutations = new Map();  // itb_id -> text
  const pendingTextReps = [];        // 일반 text-block 응답 큐 (2-pass 적용용)

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
    // table: header(h<col>) 또는 body(r<row>c<col>)
    m = id.match(/^tbl:([^:]+):(h\d+|r\d+c\d+)$/);
    if (m) {
      const [, tblId, slot] = m;
      if (!tableMutations.has(tblId)) tableMutations.set(tblId, new Map());
      tableMutations.get(tblId).set(slot, rep.text);
      applied += 1;
      return;
    }
    // label-group
    m = id.match(/^lg:([^:]+):(\d+)$/);
    if (m) {
      const [, lgId, idxStr] = m;
      if (!labelMutations.has(lgId)) labelMutations.set(lgId, new Map());
      labelMutations.get(lgId).set(parseInt(idxStr), rep.text);
      applied += 1;
      return;
    }
    // icon-text-block
    m = id.match(/^itb:(.+)$/);
    if (m) {
      const [, itbId] = m;
      iconTextMutations.set(itbId, rep.text);
      applied += 1;
      return;
    }
    // graph: 항목 label / value
    m = id.match(/^grb:([^:]+):(\d+):(label|value)$/);
    if (m) {
      const [, grbId, idxStr, field] = m;
      if (!graphMutations.has(grbId)) graphMutations.set(grbId, new Map());
      const slot = graphMutations.get(grbId);
      const idx = parseInt(idxStr);
      if (!slot.has(idx)) slot.set(idx, {});
      slot.get(idx)[field] = rep.text;
      applied += 1;
      return;
    }
    // 일반 text-block: 우선 큐에 모았다가 1차 ID매칭 → 2차 DOM순서 fallback
    pendingTextReps.push(rep);
  });

  // text-block 적용: Gemini가 같은 ID로 중복 응답하거나 hallucinated ID를 줘도
  // DOM 순서대로 흘려보내 모든 응답이 실제 블록에 들어가도록 한다.
  const tbList = Array.from(sec.querySelectorAll('.text-block'));
  const filledTbIds = new Set();
  const unmatched = [];
  // pass 1: ID 매칭
  pendingTextReps.forEach(rep => {
    const tb = sec.querySelector(`#${CSS.escape(rep.id)}`);
    if (tb && tb.classList.contains('text-block') && !filledTbIds.has(tb.id)) {
      const inner = tb.querySelector('.tb-h1, .tb-h2, .tb-h3, .tb-body, .tb-caption, .tb-label') || tb;
      inner.textContent = rep.text;
      filledTbIds.add(tb.id);
      applied += 1;
    } else {
      unmatched.push(rep);
    }
  });
  // pass 2: DOM 순서 fallback (중복ID·hallucinated ID 구제)
  let cursor = 0;
  unmatched.forEach(rep => {
    while (cursor < tbList.length && filledTbIds.has(tbList[cursor].id)) cursor++;
    if (cursor >= tbList.length) return;
    const tb = tbList[cursor++];
    const inner = tb.querySelector('.tb-h1, .tb-h2, .tb-h3, .tb-body, .tb-caption, .tb-label') || tb;
    inner.textContent = rep.text;
    filledTbIds.add(tb.id);
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

  // table-block 적용 — DOM 직접 textContent 변경
  tableMutations.forEach((slotMap, tblId) => {
    const tbl = sec.querySelector(`#${CSS.escape(tblId)}`);
    if (!tbl) return;
    const ths = tbl.querySelectorAll(':scope > table > thead > tr > th');
    const trs = tbl.querySelectorAll(':scope > table > tbody > tr');
    slotMap.forEach((text, slot) => {
      if (slot.startsWith('h')) {
        const i = parseInt(slot.slice(1));
        if (ths[i]) ths[i].textContent = text;
      } else {
        const mm = slot.match(/^r(\d+)c(\d+)$/);
        if (mm) {
          const tr = trs[parseInt(mm[1])];
          if (tr) {
            const td = tr.children[parseInt(mm[2])];
            if (td) td.textContent = text;
          }
        }
      }
    });
  });

  // label-group-block 적용 — .label-item-text 의 textContent 변경
  labelMutations.forEach((idxMap, lgId) => {
    const lg = sec.querySelector(`#${CSS.escape(lgId)}`);
    if (!lg) return;
    const spans = lg.querySelectorAll(':scope > .label-item > .label-item-text');
    idxMap.forEach((text, idx) => {
      if (spans[idx]) spans[idx].textContent = text;
    });
  });

  // icon-text-block 적용 — .itb-text textContent 변경
  iconTextMutations.forEach((text, itbId) => {
    const itb = sec.querySelector(`#${CSS.escape(itbId)}`);
    if (!itb) return;
    const inner = itb.querySelector(':scope > .itb-text');
    if (inner) inner.textContent = text;
  });

  // graph-block 적용 — dataset.items의 label + value 갱신 후 renderGraph
  graphMutations.forEach((slotMap, grbId) => {
    const grb = sec.querySelector(`#${CSS.escape(grbId)}`);
    if (!grb) return;
    let g = [];
    try { g = JSON.parse(grb.dataset.items || '[]'); } catch (_) {}
    slotMap.forEach((fields, idx) => {
      const cur = g[idx] || { value: 0 };
      const next = { ...cur };
      if (fields.label !== undefined) next.label = fields.label;
      if (fields.value !== undefined) {
        // 응답이 string이라 number 변환 (NaN이면 기존 값 유지)
        const n = parseFloat(fields.value);
        if (!Number.isNaN(n)) next.value = n;
      }
      g[idx] = next;
    });
    grb.dataset.items = JSON.stringify(g);
    window.renderGraph?.(grb);
  });

  // ── additions: 부족한 만큼 새 text-block을 마지막 텍스트 블록 다음에 차례로 추가 ──
  // call-site에서 이미 pushHistory()를 1회 호출했으므로,
  // addTextBlock 내부의 pushHistory를 잠시 noop으로 만들어 한 번의 Cmd+Z로 모두 롤백되게 한다.
  if (Array.isArray(additions) && additions.length > 0 && typeof window.addTextBlock === 'function') {
    const VALID_STYLES = ['h1','h2','h3','body','caption','label'];
    const prevFrame = window._activeFrame;
    window._activeFrame = null; // frame path 안 타게
    if (typeof window.selectSection === 'function') window.selectSection(sec);
    const origPush = window.pushHistory;
    window.pushHistory = () => {};
    try {
      additions.forEach(add => {
        if (!add || typeof add.text !== 'string') return;
        sec.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
        const tbs = sec.querySelectorAll('.text-block');
        if (tbs.length > 0) tbs[tbs.length - 1].classList.add('selected');
        else sec.classList.add('selected');
        const styleType = VALID_STYLES.includes(add.style) ? add.style : 'body';
        window.addTextBlock(styleType, { content: add.text });
        applied += 1;
      });
    } finally {
      window.pushHistory = origPush;
      window._activeFrame = prevFrame;
    }
  }

  if (applied > 0) window.scheduleAutoSave?.();
  return applied;
}

/** AI 응답의 extensions 객체를 섹션에 적용 — 컴포넌트 슬롯 구조 자동 확장
 *  extensions = { graphs:[], tables:[], canvases:[], steps:[], chats:[], labels:[] }
 *  각 sub-array는 자기 컴포넌트의 mutator (window._aiApplyExt_<type>)에 의해 처리됨.
 *  반환값: 적용된 컴포넌트 개수
 */
function applyAIExtensions(sec, extensions) {
  if (!sec || !extensions || typeof extensions !== 'object') return 0;
  const TYPE_TO_KEY = {
    graph:  'graphs',
    table:  'tables',
    canvas: 'canvases',
    step:   'steps',
    chat:   'chats',
    label:  'labels',
  };
  let applied = 0;
  for (const [type, key] of Object.entries(TYPE_TO_KEY)) {
    const arr = extensions[key];
    if (!Array.isArray(arr) || arr.length === 0) continue;
    const fn = window['_aiApplyExt_' + type];
    if (typeof fn !== 'function') continue;
    for (const ext of arr) {
      try {
        if (fn(sec, ext)) applied += 1;
      } catch (e) {
        console.warn(`[ai-ext:${type}] 적용 실패`, ext?.id, e);
      }
    }
  }
  if (applied > 0) window.scheduleAutoSave?.();
  return applied;
}
window.applyAIExtensions = applyAIExtensions;

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

let _aiFillState = { secEl: null, tone: '', imageDataUrls: [] };

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
      <div class="ai-fill-panel-model-row">
        <label class="ai-fill-panel-model-label" for="ai-fill-panel-model">모델</label>
        <select id="ai-fill-panel-model" class="ai-fill-panel-model-select">
          <optgroup label="Google">
            <option value="gemini-2.5-flash">Gemini 2.5 Flash · 무료티어</option>
          </optgroup>
          <optgroup label="OpenAI">
            <option value="gpt-5.4-mini">GPT-5.4 Mini · 추천</option>
            <option value="gpt-5.4-nano">GPT-5.4 Nano · 빠름</option>
          </optgroup>
          <optgroup label="Anthropic">
            <option value="claude-haiku-4-5">Claude Haiku 4.5 · 빠름</option>
            <option value="claude-sonnet-4-6">Claude Sonnet 4.6 · 균형</option>
          </optgroup>
        </select>
      </div>
      <div class="ai-fill-panel-scope">
        <label class="ai-fill-panel-mode">
          <input type="radio" name="ai-fill-scope" value="all" checked> 전체 섹션
        </label>
        <label class="ai-fill-panel-mode">
          <input type="radio" name="ai-fill-scope" value="specific"> 특정 블록만
        </label>
        <div class="ai-fill-panel-scope-ids hidden" id="ai-fill-panel-scope-ids"></div>
        <button type="button" class="ai-fill-panel-id-add hidden" id="ai-fill-panel-id-add">+ 블록 ID 추가</button>
      </div>
      <textarea id="ai-fill-panel-prompt" rows="4"
        placeholder="예: 헬스보충제 주제로 채워줘&#10;(이미지 paste / drag-drop 가능)"></textarea>
      <div class="ai-fill-panel-thumbs hidden" id="ai-fill-panel-thumbs"
        style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;"></div>
      <div class="ai-fill-panel-chips" id="ai-fill-panel-chips"></div>
      <input type="text" id="ai-fill-panel-image"
        placeholder="이미지 파일 경로 (선택)">
      <label class="ai-fill-panel-mode">
        <input type="checkbox" id="ai-fill-panel-empty"> 빈 블록만
      </label>
      <label class="ai-fill-panel-mode" title="이미지/요청 텍스트를 한 글자도 변형 없이 그대로 옮김 (길이힌트·톤 무시)">
        <input type="checkbox" id="ai-fill-panel-verbatim"> 이미지 텍스트 그대로 옮기기
      </label>
      <label class="ai-fill-panel-mode" title="카피 단락이 슬롯보다 많거나 더 풍부한 구조가 자연스러우면 텍스트 블록을 자동 생성 (verbatim/natural 모두 동작)">
        <input type="checkbox" id="ai-fill-panel-auto-expand"> 부족하면 텍스트 블록 추가 생성
      </label>
      <button class="ai-fill-panel-run" id="ai-fill-panel-run" type="button">생성 → 적용</button>
      <div class="ai-fill-panel-preview hidden" id="ai-fill-panel-preview"></div>
    </div>`;
  document.body.appendChild(panel);
  panel.querySelector('.ai-fill-panel-close').addEventListener('click', () => panel.classList.remove('open'));

  // ── 적용 범위(전체/특정) 토글 + 블록 ID 입력행 추가/제거 ──
  const idsBox  = panel.querySelector('#ai-fill-panel-scope-ids');
  const idAddBtn = panel.querySelector('#ai-fill-panel-id-add');
  function _addIdRow(initial = '') {
    const row = document.createElement('div');
    row.className = 'ai-fill-panel-id-row';
    row.innerHTML = `
      <input type="text" class="ai-fill-panel-id-input" placeholder="tb_xxxxxxx" value="${initial.replace(/"/g, '&quot;')}">
      <button type="button" class="ai-fill-panel-id-remove" title="이 행 제거">×</button>`;
    row.querySelector('.ai-fill-panel-id-remove').addEventListener('click', () => row.remove());
    idsBox.appendChild(row);
  }
  // ── 모델 선택: localStorage 저장/복원 ──
  const modelSel = panel.querySelector('#ai-fill-panel-model');
  try {
    const saved = localStorage.getItem('aiFillModel');
    if (saved && [...modelSel.options].some(o => o.value === saved)) modelSel.value = saved;
  } catch (_) {}
  modelSel.addEventListener('change', () => {
    try { localStorage.setItem('aiFillModel', modelSel.value); } catch (_) {}
  });

  panel.querySelectorAll('input[name="ai-fill-scope"]').forEach(r => {
    r.addEventListener('change', () => {
      const v = panel.querySelector('input[name="ai-fill-scope"]:checked').value;
      const isSpecific = v === 'specific';
      idsBox.classList.toggle('hidden', !isSpecific);
      idAddBtn.classList.toggle('hidden', !isSpecific);
      if (isSpecific && idsBox.children.length === 0) _addIdRow();
    });
  });
  idAddBtn.addEventListener('click', () => _addIdRow());

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

  // ── 클립보드 paste / drag-drop 이미지 → data URL 다중 첨부 ──
  const thumbsBox = panel.querySelector('#ai-fill-panel-thumbs');
  function _renderThumbs() {
    const urls = _aiFillState.imageDataUrls || [];
    thumbsBox.innerHTML = '';
    if (urls.length === 0) { thumbsBox.classList.add('hidden'); return; }
    thumbsBox.classList.remove('hidden');
    urls.forEach((url, idx) => {
      const wrap = document.createElement('div');
      wrap.className = 'ai-fill-panel-thumb';
      wrap.style.cssText = 'position:relative;width:64px;height:64px;';
      const img = document.createElement('img');
      img.src = url;
      img.alt = `첨부 ${idx + 1}`;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:4px;display:block;';
      const x = document.createElement('button');
      x.type = 'button';
      x.className = 'ai-fill-panel-thumb-x';
      x.textContent = '×';
      x.title = '제거';
      x.addEventListener('click', () => {
        _aiFillState.imageDataUrls.splice(idx, 1);
        _renderThumbs();
      });
      wrap.appendChild(img);
      wrap.appendChild(x);
      thumbsBox.appendChild(wrap);
    });
  }
  function _addImageDataUrl(dataUrl) {
    if (!dataUrl) return;
    if (!Array.isArray(_aiFillState.imageDataUrls)) _aiFillState.imageDataUrls = [];
    _aiFillState.imageDataUrls.push(dataUrl);
    _renderThumbs();
  }
  function _clearImages() { _aiFillState.imageDataUrls = []; _renderThumbs(); }
  // 외부(스크래치 패드 등)에서 첨부할 수 있도록 노출
  window._aiFillAttachImageDataUrl = _addImageDataUrl;
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
    let added = 0;
    for (const it of items) {
      const blob = it.getAsFile();
      if (!blob) continue;
      const dataUrl = await _readBlobToDataUrl(blob);
      _addImageDataUrl(dataUrl);
      added += 1;
    }
    if (added > 0) window.showToast?.(`🖼️ 이미지 ${added}장 첨부 (총 ${_aiFillState.imageDataUrls.length})`);
  });
  // 패널 전체에 drag-drop (다중 파일)
  ['dragover', 'drop'].forEach(ev => panel.addEventListener(ev, async e => {
    if (ev === 'dragover') { e.preventDefault(); return; }
    e.preventDefault();
    const files = [...(e.dataTransfer?.files || [])].filter(f => f.type.startsWith('image/'));
    if (files.length === 0) return;
    let added = 0;
    for (const f of files) {
      const dataUrl = await _readBlobToDataUrl(f);
      _addImageDataUrl(dataUrl);
      added += 1;
    }
    if (added > 0) window.showToast?.(`🖼️ 이미지 ${added}장 첨부 (총 ${_aiFillState.imageDataUrls.length})`);
  }));

  panel.querySelector('#ai-fill-panel-run').addEventListener('click', async () => {
    const sec = _aiFillState.secEl;
    if (!sec) return;
    const promptText = panel.querySelector('#ai-fill-panel-prompt').value.trim();
    const imagePath = panel.querySelector('#ai-fill-panel-image').value.trim() || null;
    const mode = panel.querySelector('#ai-fill-panel-empty').checked ? 'fillEmpty' : 'replaceAll';
    const fidelity = panel.querySelector('#ai-fill-panel-verbatim').checked ? 'verbatim' : 'natural';
    const autoExpand = panel.querySelector('#ai-fill-panel-auto-expand').checked;
    const allBlocks = collectSectionTextBlocks(sec);

    // 적용 범위 결정 — 전체 섹션 또는 사용자 지정 ID들
    const scope = panel.querySelector('input[name="ai-fill-scope"]:checked')?.value || 'all';
    let blocks = allBlocks;
    if (scope === 'specific') {
      const inputIds = Array.from(idsBox.querySelectorAll('.ai-fill-panel-id-input'))
        .map(i => i.value.trim()).filter(Boolean);
      if (inputIds.length === 0) {
        window.showToast?.('⚠️ 특정 블록 ID를 1개 이상 입력하세요');
        return;
      }
      const known = new Set(allBlocks.map(b => b.id));
      const valid = inputIds.filter(id => known.has(id));
      const invalid = inputIds.filter(id => !known.has(id));
      if (invalid.length > 0) window.showToast?.(`⚠️ 섹션에 없는 ID 무시: ${invalid.join(', ')}`);
      if (valid.length === 0) { window.showToast?.('❌ 유효한 블록 ID 없음'); return; }
      blocks = allBlocks.filter(b => valid.includes(b.id));
    }
    if (blocks.length === 0) { window.showToast?.('⚠️ 텍스트 블록 없음'); return; }
    const runBtn = panel.querySelector('#ai-fill-panel-run');
    runBtn.disabled = true;
    runBtn.classList.add('is-loading');
    runBtn.innerHTML = '<span class="ai-fill-spinner"></span><span>생성 중…</span>';
    window.showToast?.('✨ AI가 작성 중…');
    // 프롬프트에 #sp_xxxxxx 토큰이 있으면 스크래치 패드 이미지를 자동 첨부
    const baseUrls = (_aiFillState.imageDataUrls || []).slice();
    const tokenMatches = [...promptText.matchAll(/#(sp_[a-z0-9]{6})\b/g)];
    const seen = new Set(); let tokenAttached = 0;
    for (const m of tokenMatches) {
      const id = m[1];
      if (seen.has(id)) continue;
      seen.add(id);
      const it = window._scratchGetItemById?.(id);
      if (it?.src && !baseUrls.includes(it.src)) {
        baseUrls.push(it.src);
        tokenAttached += 1;
      }
    }
    if (tokenAttached > 0) {
      window.showToast?.(`🔗 스크래치 ID로 ${tokenAttached}장 자동 첨부`);
    }
    const model = panel.querySelector('#ai-fill-panel-model')?.value || 'gemini-2.5-flash';
    const res = await callGeminiFill({
      blocks: blocks.map(b => ({ id: b.id, style: b.style, current: b.current })),
      prompt: promptText, tone: _aiFillState.tone, mode, fidelity, autoExpand,
      imageDataUrls: baseUrls,
      imagePath,
      model,
    });
    runBtn.disabled = false;
    runBtn.classList.remove('is-loading');
    runBtn.textContent = '재생성';
    if (!res?.ok) { window.showToast?.(`❌ ${res?.error || '오류'}`); return; }
    window.pushHistory?.();
    const additions = Array.isArray(res.additions) ? res.additions : [];
    const n = applyAIReplacements(sec, res.replacements || [], additions);
    // 컴포넌트 슬롯 자동 확장(extensions) 적용
    const extApplied = applyAIExtensions(sec, res.extensions);
    const preview = panel.querySelector('#ai-fill-panel-preview');
    const byId = new Map(blocks.map(b => [b.id, b]));
    const repRows = (res.replacements || []).map(rep => {
      const b = byId.get(rep.id);
      const styleLbl = (b?.style || '').replace('tb-', '');
      return `<div class="ai-fill-panel-preview-row">
        <span class="ai-fill-panel-preview-style">${styleLbl}</span>
        <span class="ai-fill-panel-preview-text">${rep.text}</span>
      </div>`;
    }).join('');
    const addRows = additions.map(add => `<div class="ai-fill-panel-preview-row">
      <span class="ai-fill-panel-preview-style">+${add.style || 'body'}</span>
      <span class="ai-fill-panel-preview-text">${add.text || ''}</span>
    </div>`).join('');
    const expandedNote = additions.length > 0 ? ` (블록 ${additions.length}개 추가)` : '';
    const extNote = extApplied > 0 ? ` (컴포넌트 ${extApplied}개 구조 변경)` : '';
    preview.innerHTML = `<div class="ai-fill-panel-preview-title">적용됨 (Cmd+Z 되돌리기)${expandedNote}${extNote}</div>${repRows}${addRows}`;
    preview.classList.remove('hidden');
    window.showToast?.(`✅ ${n}개 블록 적용됨${expandedNote}${extNote}`);
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
  _aiFillState.imageDataUrls = [];
  const panel = _ensureAIFillPanel();
  panel.classList.add('open');
  // 섹션 이름(Section 05 등) + 내부 ID 같이 표기
  const secName = (secEl.dataset?.name || secEl.querySelector('.section-label')?.textContent || '').trim();
  panel.querySelector('#ai-fill-panel-meta').textContent =
    secName ? `${secName} (${secEl.id}) · 텍스트 ${blocks.length}개` : `${secEl.id} · 텍스트 ${blocks.length}개`;
  panel.querySelector('#ai-fill-panel-prompt').value = '';
  panel.querySelector('#ai-fill-panel-image').value = '';
  panel.querySelector('#ai-fill-panel-empty').checked = false;
  panel.querySelector('#ai-fill-panel-verbatim').checked = false;
  panel.querySelector('#ai-fill-panel-auto-expand').checked = false;
  // 적용 범위 리셋: 전체 섹션
  const scopeAll = panel.querySelector('input[name="ai-fill-scope"][value="all"]');
  if (scopeAll) scopeAll.checked = true;
  const idsBox = panel.querySelector('#ai-fill-panel-scope-ids');
  const idAddBtn = panel.querySelector('#ai-fill-panel-id-add');
  if (idsBox) { idsBox.innerHTML = ''; idsBox.classList.add('hidden'); }
  if (idAddBtn) idAddBtn.classList.add('hidden');
  const thumbsBox = panel.querySelector('#ai-fill-panel-thumbs');
  if (thumbsBox) { thumbsBox.innerHTML = ''; thumbsBox.classList.add('hidden'); }
  panel.querySelectorAll('.ai-fill-panel-chip').forEach(c => c.classList.remove('selected'));
  panel.querySelector('#ai-fill-panel-preview').classList.add('hidden');
  panel.querySelector('#ai-fill-panel-preview').innerHTML = '';
  const runBtn = panel.querySelector('#ai-fill-panel-run');
  runBtn.disabled = false; runBtn.textContent = '생성 → 적용';
  panel.querySelector('#ai-fill-panel-prompt').focus();
}

/** UI에서 호출하는 공용 실행기 — payload 받아 호출/적용/토스트 */
async function runAIFill(secEl, { prompt, tone, mode, imagePath, fidelity }) {
  const blocks = collectSectionTextBlocks(secEl);
  if (blocks.length === 0) {
    window.showToast?.('⚠️ 텍스트 블록 없음');
    return { ok: false };
  }
  window.showToast?.('✨ AI가 작성 중…');
  const payload = {
    blocks: blocks.map(b => ({ id: b.id, style: b.style, current: b.current })),
    prompt:   prompt   || '',
    tone:     tone     || '',
    mode:     mode     || 'replaceAll',
    fidelity: fidelity || 'natural',
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
   load 후 toolbar를 스캔해서 마지막 자식으로 추가한다 (시각 우측 끝). */
function _ensureAIFillButton(sec) {
  if (!sec) return;
  const tb = sec.querySelector(':scope > .section-toolbar');
  if (!tb) return;
  let btn = tb.querySelector('.st-ai-fill-btn');
  if (!btn) {
    btn = document.createElement('button');
    btn.className = 'st-btn st-ai-fill-btn';
    btn.title = 'AI로 섹션 텍스트 채우기';
    btn.textContent = '✨';
    btn.setAttribute('onclick', 'openAIFillUI(this)');
  }
  // 기존 위치에 있든 새로 만들든 항상 마지막으로 이동 → 시각상 우측 끝
  tb.appendChild(btn);
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
