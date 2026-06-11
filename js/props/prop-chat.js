import { propPanel } from '../globals.js';
import { colorFieldHTML, wireColorField, parseAlphaFromColor } from './color-picker.js';

function _chatToken(name, fallback) {
  if (typeof getComputedStyle !== 'function') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function showChatProperties(block) {
  const messages   = JSON.parse(block.dataset.messages  || '[]');
  const gap        = parseInt(block.dataset.gap)        || 8;
  const fontSize   = parseInt(block.dataset.fontSize)   || 32;
  const bgLeft     = block.dataset.bgLeft               || _chatToken('--preset-chat-bg-left', '#e5e5ea');
  const bgRight    = block.dataset.bgRight              || _chatToken('--preset-chat-bg-right', '#1888fe');
  const bgLeftAlpha  = parseAlphaFromColor(bgLeft);
  const bgRightAlpha = parseAlphaFromColor(bgRight);
  const colorLeft  = block.dataset.colorLeft            || _chatToken('--preset-chat-text-left', '#111111');
  const colorRight = block.dataset.colorRight           || _chatToken('--preset-chat-text-right', '#ffffff');
  const radius     = parseInt(block.dataset.radius)     || 16;
  const padding    = parseInt(block.dataset.padding)    || 16;
  // 카톡식 프로필 (default OFF — 호환성)
  const showProfile = block.dataset.showProfile === '1';
  const showName    = block.dataset.showName === '1';
  const defaultProfileSize = Math.max(48, Math.round(fontSize * 1.6));
  const profileSize    = parseInt(block.dataset.profileSize) || defaultProfileSize;
  const profileOffsetY = parseInt(block.dataset.profileOffsetY) || 0;
  const profileGap     = (block.dataset.profileGap != null) ? parseInt(block.dataset.profileGap) : 8;

  function rerender() {
    window.renderChatBlock(block);
    window.triggerAutoSave?.();
  }

  function msgListHtml() {
    return messages.map((m, i) => {
      const isLeft = m.align !== 'right';
      const showProfileFields = (block.dataset.showProfile === '1');
      const hideThisProfile = m.hideProfile === true;
      const pName = (m.profileName || '').replace(/"/g, '&quot;');
      const pImg  = m.profileImg || '';
      const profileFieldsHtml = showProfileFields ? `
        <div class="chb-prop-profile-row" data-idx="${i}" style="display:flex;align-items:center;gap:6px;margin-top:6px;padding-top:6px;border-top:1px dashed #333;font-size:11px;white-space:nowrap">
          <div class="chb-profile-thumb" data-idx="${i}" title="클릭하여 프로필 이미지 업로드"
            style="width:28px;height:28px;border-radius:50%;background:${pImg ? `url('${pImg}') center/cover` : 'linear-gradient(135deg,#666,#888)'};border:1px solid #444;cursor:pointer;flex-shrink:0"></div>
          <input type="text" class="chb-profile-name-input" data-idx="${i}" value="${pName}" placeholder="프로필 이름"
            style="flex:1;min-width:0;width:auto;max-width:none;min-height:24px;background:#1c1c1c;border:1px solid #2a2a2a;border-radius:3px;color:#ccc;font-size:11px;padding:2px 6px">
          <label style="display:inline-flex;align-items:center;gap:3px;cursor:pointer;color:#aaa;flex-shrink:0;white-space:nowrap" title="이 메시지만 프로필 숨김(공간 유지 → 들여쓰기 효과)">
            <input type="checkbox" class="chb-hide-profile" data-idx="${i}" ${hideThisProfile ? 'checked' : ''}>
            <span>숨김</span>
          </label>
          <input type="file" class="chb-profile-file" data-idx="${i}" accept="image/*" style="display:none">
        </div>` : '';
      return `
      <div class="chb-prop-item" data-idx="${i}"
        style="margin-bottom:8px;padding:8px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:6px">
        <div style="display:flex;align-items:center;gap:6px">
          <div style="display:flex;gap:2px">
            <button class="prop-align-btn chb-align-btn ${isLeft ? 'active' : ''}" data-idx="${i}" data-dir="left" title="좌측 정렬"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="1" y1="3" x2="13" y2="3"/><line x1="1" y1="6" x2="9" y2="6"/><line x1="1" y1="9" x2="11" y2="9"/><line x1="1" y1="12" x2="7" y2="12"/></svg></button>
            <button class="prop-align-btn chb-align-btn ${!isLeft ? 'active' : ''}" data-idx="${i}" data-dir="right" title="우측 정렬"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="1" y1="3" x2="13" y2="3"/><line x1="5" y1="6" x2="13" y2="6"/><line x1="3" y1="9" x2="13" y2="9"/><line x1="7" y1="12" x2="13" y2="12"/></svg></button>
          </div>
          <span style="flex:1;font-size:10px;color:#666">메시지 ${i + 1}</span>
          <button class="prop-btn prop-btn-danger chb-del-btn" data-idx="${i}" title="삭제" style="padding:4px 8px;font-size:11px">✕</button>
        </div>
        ${profileFieldsHtml}
        <textarea class="prop-color-hex chb-text-input" data-idx="${i}" rows="2"
          style="width:100%;box-sizing:border-box;min-height:42px;resize:vertical;font-family:inherit;line-height:1.4;padding:6px 8px;margin-top:6px">${(m.text || '').replace(/</g, '&lt;')}</textarea>
      </div>`;
    }).join('');
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
      <div class="prop-section-title">Style</div>
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
        <input type="range" class="prop-slider" id="chb-padding-range" min="0" max="60" value="${padding}" style="flex:1">
        <input type="number" class="prop-number" id="chb-padding-val" min="0" max="60" value="${padding}" style="width:54px">
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Color</div>
      <div class="prop-row">
        <span class="prop-label">좌측 배경</span>
        ${colorFieldHTML({ idPrefix: 'chb-bg-left', hex: bgLeft, alpha: bgLeftAlpha })}
      </div>
      <div class="prop-row">
        <span class="prop-label">우측 배경</span>
        ${colorFieldHTML({ idPrefix: 'chb-bg-right', hex: bgRight, alpha: bgRightAlpha })}
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Profile</div>
      <div class="prop-row" style="gap:12px;flex-wrap:wrap">
        <label style="display:flex;align-items:center;gap:4px;font-size:11px;cursor:pointer">
          <input type="checkbox" id="chb-show-profile" ${showProfile ? 'checked' : ''}>
          <span>프로필 이미지</span>
        </label>
        <label style="display:flex;align-items:center;gap:4px;font-size:11px;cursor:pointer">
          <input type="checkbox" id="chb-show-name" ${showName ? 'checked' : ''}>
          <span>이름 표시</span>
        </label>
      </div>
      <div class="prop-row">
        <span class="prop-label">크기</span>
        <input type="range" class="prop-slider" id="chb-profile-size-range" min="24" max="120" value="${profileSize}" style="flex:1">
        <input type="number" id="chb-profile-size-num" class="prop-number" value="${profileSize}" min="24" max="120" style="width:54px">
      </div>
      <div class="prop-row">
        <span class="prop-label">Y 위치</span>
        <input type="range" class="prop-slider" id="chb-profile-y-range" min="-40" max="40" value="${profileOffsetY}" style="flex:1">
        <input type="number" id="chb-profile-y-num" class="prop-number" value="${profileOffsetY}" min="-40" max="40" style="width:54px">
      </div>
      <div class="prop-row">
        <span class="prop-label">간격</span>
        <input type="range" class="prop-slider" id="chb-profile-gap-range" min="0" max="40" value="${profileGap}" style="flex:1">
        <input type="number" id="chb-profile-gap-num" class="prop-number" value="${profileGap}" min="0" max="40" style="width:54px">
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Messages</div>
      <div id="chb-msg-list">${msgListHtml()}</div>
      <button class="prop-btn-full" id="chb-add-msg" style="margin-top:6px">+ 대화 추가하기</button>
    </div>
  `;

  // ─── 프로필 토글 ───────────────────────────────────────────
  propPanel.querySelector('#chb-show-profile')?.addEventListener('change', e => {
    block.dataset.showProfile = e.target.checked ? '1' : '0';
    window.pushHistory?.('프로필 토글');
    rerender();
    rebindMsgList();
  });
  propPanel.querySelector('#chb-show-name')?.addEventListener('change', e => {
    block.dataset.showName = e.target.checked ? '1' : '0';
    window.pushHistory?.('이름 토글');
    rerender();
  });
  // 프로필 크기 — range/number 동기화
  const sizeRange = propPanel.querySelector('#chb-profile-size-range');
  const sizeNum   = propPanel.querySelector('#chb-profile-size-num');
  const setSize = (v) => {
    const n = Math.max(24, Math.min(120, parseInt(v) || 48));
    block.dataset.profileSize = String(n);
    if (sizeRange) sizeRange.value = String(n);
    if (sizeNum)   sizeNum.value   = String(n);
    rerender();
  };
  sizeRange?.addEventListener('input',  e => setSize(e.target.value));
  sizeRange?.addEventListener('change', () => window.pushHistory?.());
  sizeNum?.addEventListener('input',    e => setSize(e.target.value));
  sizeNum?.addEventListener('change',   () => window.pushHistory?.());
  // 프로필 Y 위치 — range/number 동기화
  const yRange = propPanel.querySelector('#chb-profile-y-range');
  const yNum   = propPanel.querySelector('#chb-profile-y-num');
  const setY = (v) => {
    const n = Math.max(-40, Math.min(40, parseInt(v) || 0));
    block.dataset.profileOffsetY = String(n);
    if (yRange) yRange.value = String(n);
    if (yNum)   yNum.value   = String(n);
    rerender();
  };
  yRange?.addEventListener('input',  e => setY(e.target.value));
  yRange?.addEventListener('change', () => window.pushHistory?.());
  yNum?.addEventListener('input',    e => setY(e.target.value));
  yNum?.addEventListener('change',   () => window.pushHistory?.());
  // 프로필 ↔ 말풍선 간격
  const gapRange = propPanel.querySelector('#chb-profile-gap-range');
  const gapNum   = propPanel.querySelector('#chb-profile-gap-num');
  const setGap = (v) => {
    const n = Math.max(0, Math.min(40, parseInt(v) || 0));
    block.dataset.profileGap = String(n);
    if (gapRange) gapRange.value = String(n);
    if (gapNum)   gapNum.value   = String(n);
    rerender();
  };
  gapRange?.addEventListener('input',  e => setGap(e.target.value));
  gapRange?.addEventListener('change', () => window.pushHistory?.());
  gapNum?.addEventListener('input',    e => setGap(e.target.value));
  gapNum?.addEventListener('change',   () => window.pushHistory?.());

  // ─── 스타일 이벤트 ────────────────────────────────────────────
  const paddingRange = propPanel.querySelector('#chb-padding-range');
  const paddingVal   = propPanel.querySelector('#chb-padding-val');
  const applyPadding = v => {
    v = Math.min(60, Math.max(0, parseInt(v) || 0));
    block.dataset.padding = v;
    block.style.padding = v + 'px ' + v + 'px';
    paddingRange.value = v; paddingVal.value = v;
    window.triggerAutoSave?.();
  };
  paddingRange.addEventListener('input', () => applyPadding(paddingRange.value));
  paddingVal.addEventListener('change', () => applyPadding(paddingVal.value));

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
  wireColorField('chb-bg-left', {
    initialAlpha: bgLeftAlpha,
    onApply: (c) => { block.dataset.bgLeft = c; rerender(); },
    onCommit: () => window.pushHistory?.(),
  });
  wireColorField('chb-bg-right', {
    initialAlpha: bgRightAlpha,
    onApply: (c) => { block.dataset.bgRight = c; rerender(); },
    onCommit: () => window.pushHistory?.(),
  });

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
    // 메시지별 hideProfile 체크박스
    propPanel.querySelectorAll('.chb-hide-profile').forEach(cb => {
      cb.addEventListener('change', e => {
        const i = parseInt(cb.dataset.idx);
        messages[i].hideProfile = e.target.checked;
        block.dataset.messages = JSON.stringify(messages);
        window.pushHistory?.('프로필 숨김 토글');
        rerender();
      });
    });
    // 프로필 이름 input
    propPanel.querySelectorAll('.chb-profile-name-input').forEach(inp => {
      inp.addEventListener('input', e => {
        const i = parseInt(inp.dataset.idx);
        messages[i].profileName = e.target.value;
        block.dataset.messages = JSON.stringify(messages);
        rerender();
      });
      inp.addEventListener('change', () => window.pushHistory?.());
    });
    // 프로필 이미지 — thumb 클릭 시 file input 트리거
    propPanel.querySelectorAll('.chb-profile-thumb').forEach(th => {
      th.addEventListener('click', () => {
        const i = parseInt(th.dataset.idx);
        const fileInput = propPanel.querySelector(`.chb-profile-file[data-idx="${i}"]`);
        fileInput?.click();
      });
    });
    propPanel.querySelectorAll('.chb-profile-file').forEach(fi => {
      fi.addEventListener('change', e => {
        const i = parseInt(fi.dataset.idx);
        const file = e.target.files?.[0];
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          messages[i].profileImg = ev.target.result;
          block.dataset.messages = JSON.stringify(messages);
          window.pushHistory?.('프로필 이미지');
          rerender();
          rebindMsgList();
        };
        reader.readAsDataURL(file);
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
