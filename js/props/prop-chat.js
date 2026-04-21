import { propPanel } from '../globals.js';

export function showChatProperties(block) {
  const messages   = JSON.parse(block.dataset.messages  || '[]');
  const gap        = parseInt(block.dataset.gap)        || 8;
  const fontSize   = parseInt(block.dataset.fontSize)   || 32;
  const bgLeft     = block.dataset.bgLeft               || '#e5e5ea';
  const bgRight    = block.dataset.bgRight              || '#1888fe';
  const colorLeft  = block.dataset.colorLeft            || '#111111';
  const colorRight = block.dataset.colorRight           || '#ffffff';
  const radius     = parseInt(block.dataset.radius)     || 16;
  const padding    = parseInt(block.dataset.padding)    || 16;

  function rerender() {
    window.renderChatBlock(block);
    window.triggerAutoSave?.();
  }

  function msgListHtml() {
    return messages.map((m, i) => `
      <div class="chb-prop-item" data-idx="${i}" style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <button class="prop-align-btn chb-align-btn ${m.align !== 'right' ? 'active' : ''}" data-idx="${i}" data-dir="left" title="좌측"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="1" y1="3" x2="13" y2="3"/><line x1="1" y1="6" x2="9" y2="6"/><line x1="1" y1="9" x2="11" y2="9"/><line x1="1" y1="12" x2="7" y2="12"/></svg></button>
        <button class="prop-align-btn chb-align-btn ${m.align === 'right' ? 'active' : ''}" data-idx="${i}" data-dir="right" title="우측"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="1" y1="3" x2="13" y2="3"/><line x1="5" y1="6" x2="13" y2="6"/><line x1="3" y1="9" x2="13" y2="9"/><line x1="7" y1="12" x2="13" y2="12"/></svg></button>
        <input type="text" class="prop-color-hex chb-text-input" data-idx="${i}"
          value="${(m.text || '').replace(/"/g, '&quot;')}"
          style="flex:1;width:auto;max-width:none">
        <button class="prop-btn prop-btn-danger chb-del-btn" data-idx="${i}" style="padding:2px 7px;font-size:11px">✕</button>
      </div>`).join('');
  }

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <path d="M1 2a1 1 0 011-1h8a1 1 0 011 1v6a1 1 0 01-1 1H7l-2 2V9H2a1 1 0 01-1-1V2z"/>
          </svg>
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">${block.dataset.layerName || 'Chat Block'}</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb?.(block) || ''}</span>
        </div>
        ${block.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="_copyToClipboard('${block.id}')">${block.id}</span>` : ''}
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">STYLE</div>
      <div class="prop-row">
        <span class="prop-label">폰트 크기</span>
        <input type="number" id="chb-fontsize" class="prop-color-hex" value="${fontSize}" min="10" max="60" style="width:60px">
      </div>
      <div class="prop-row">
        <span class="prop-label">말풍선 곡률</span>
        <input type="number" id="chb-radius" class="prop-color-hex" value="${radius}" min="0" max="40" style="width:60px">
      </div>
      <div class="prop-row">
        <span class="prop-label">간격</span>
        <input type="number" id="chb-gap" class="prop-color-hex" value="${gap}" min="0" max="40" style="width:60px">
      </div>
      <div class="prop-row">
        <span class="prop-label">패딩</span>
        <input type="range" id="chb-padding-range" min="0" max="60" value="${padding}" style="flex:1">
        <span id="chb-padding-val" style="width:28px;text-align:right;font-size:12px">${padding}</span>
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">COLOR</div>
      <div class="prop-row">
        <span class="prop-label">좌측 배경</span>
        <div class="prop-color-swatch" id="chb-bg-left-swatch" style="background:${bgLeft};width:24px;height:24px;border-radius:4px;border:1px solid #ccc;cursor:pointer;flex-shrink:0"></div>
        <input type="text" class="prop-color-hex" id="chb-bg-left" value="${bgLeft}" style="width:72px">
      </div>
      <div class="prop-row">
        <span class="prop-label">우측 배경</span>
        <div class="prop-color-swatch" id="chb-bg-right-swatch" style="background:${bgRight};width:24px;height:24px;border-radius:4px;border:1px solid #ccc;cursor:pointer;flex-shrink:0"></div>
        <input type="text" class="prop-color-hex" id="chb-bg-right" value="${bgRight}" style="width:72px">
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">MESSAGES</div>
      <div id="chb-msg-list">${msgListHtml()}</div>
      <button class="prop-btn-full" id="chb-add-msg" style="margin-top:6px">+ 대화 추가하기</button>
    </div>
  `;

  // ─── 스타일 이벤트 ────────────────────────────────────────────
  const paddingRange = propPanel.querySelector('#chb-padding-range');
  const paddingVal   = propPanel.querySelector('#chb-padding-val');
  paddingRange.addEventListener('input', e => {
    paddingVal.textContent = e.target.value;
    block.dataset.padding = e.target.value;
    block.style.padding = e.target.value + 'px ' + e.target.value + 'px';
    window.triggerAutoSave?.();
  });

  propPanel.querySelector('#chb-fontsize').addEventListener('input', e => {
    block.dataset.fontSize = e.target.value;
    rerender();
  });
  propPanel.querySelector('#chb-fontsize').addEventListener('change', () => {
    window.pushHistory?.();
  });
  propPanel.querySelector('#chb-radius').addEventListener('input', e => {
    block.dataset.radius = e.target.value;
    rerender();
  });
  propPanel.querySelector('#chb-radius').addEventListener('change', () => {
    window.pushHistory?.();
  });
  propPanel.querySelector('#chb-gap').addEventListener('input', e => {
    block.dataset.gap = e.target.value;
    rerender();
  });
  propPanel.querySelector('#chb-gap').addEventListener('change', () => {
    window.pushHistory?.();
  });

  // ─── 색상 이벤트 ─────────────────────────────────────────────
  function bindColor(inputId, swatchId, dataKey) {
    const input  = propPanel.querySelector('#' + inputId);
    const swatch = propPanel.querySelector('#' + swatchId);
    input.addEventListener('change', e => {
      const v = e.target.value.trim();
      block.dataset[dataKey] = v;
      swatch.style.background = v;
      rerender();
    });
  }
  bindColor('chb-bg-left',  'chb-bg-left-swatch',  'bgLeft');
  bindColor('chb-bg-right', 'chb-bg-right-swatch', 'bgRight');

  // ─── 대화 목록 이벤트 ────────────────────────────────────────
  function rebindMsgList() {
    const list = propPanel.querySelector('#chb-msg-list');
    list.innerHTML = msgListHtml();
    bindMsgEvents();
  }

  function bindMsgEvents() {
    // 텍스트 수정
    propPanel.querySelectorAll('.chb-text-input').forEach(inp => {
      inp.addEventListener('change', e => {
        const i = parseInt(e.target.dataset.idx);
        messages[i].text = e.target.value;
        block.dataset.messages = JSON.stringify(messages);
        rerender();
      });
    });
    // 방향 버튼
    propPanel.querySelectorAll('.chb-align-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const i   = parseInt(btn.dataset.idx);
        const dir = btn.dataset.dir;
        messages[i].align = dir;
        block.dataset.messages = JSON.stringify(messages);
        rerender();
        rebindMsgList();
      });
    });
    // 삭제
    propPanel.querySelectorAll('.chb-del-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const i = parseInt(btn.dataset.idx);
        window.pushHistory?.();
        messages.splice(i, 1);
        block.dataset.messages = JSON.stringify(messages);
        rerender();
        rebindMsgList();
      });
    });
  }
  bindMsgEvents();

  // ─── 대화 추가 ───────────────────────────────────────────────
  propPanel.querySelector('#chb-add-msg').addEventListener('click', () => {
    window.pushHistory?.();
    const lastAlign = messages.length ? messages[messages.length - 1].align : 'left';
    messages.push({ text: '새 대화', align: lastAlign === 'left' ? 'right' : 'left' });
    block.dataset.messages = JSON.stringify(messages);
    rerender();
    rebindMsgList();
  });
}

window.showChatProperties = showChatProperties;
