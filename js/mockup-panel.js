// Mockup Panel — 디바이스 목업 선택 모달

let _mockupModal = null;

function _createMockupModal() {
  const el = document.createElement('div');
  el.id = 'mockup-modal';
  el.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;align-items:center;justify-content:center;';

  const devices = window.MOCKUP_DEVICES || {};

  el.innerHTML = `
    <div style="background:#1a1a1a;border:1px solid #2e2e2e;border-radius:12px;width:480px;max-width:95vw;display:flex;flex-direction:column;box-shadow:0 24px 64px rgba(0,0,0,0.7);">
      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px 0;">
        <span style="color:#ddd;font-size:13px;font-weight:600;font-family:Pretendard,-apple-system,sans-serif;">디바이스 목업 삽입</span>
        <button id="mkp-modal-close" style="background:none;border:none;color:#666;font-size:18px;cursor:pointer;padding:4px;line-height:1;">✕</button>
      </div>

      <!-- Device grid -->
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;padding:16px 18px;">
        ${Object.entries(devices).map(([key, dev]) => `
          <div class="mkp-device-card" data-device="${key}"
            style="background:#111;border:1.5px solid #2a2a2a;border-radius:8px;padding:12px 4px 8px;cursor:pointer;text-align:center;transition:border-color 0.1s,background 0.1s;display:flex;flex-direction:column;align-items:center;gap:6px;">
            <div style="width:36px;height:36px;display:flex;align-items:flex-end;justify-content:center;">
              ${_getDeviceThumb(key)}
            </div>
            <span style="font-size:10px;color:#888;font-family:Pretendard,-apple-system,sans-serif;">${dev.label}</span>
          </div>
        `).join('')}
      </div>

      <!-- Width input -->
      <div style="display:flex;align-items:center;gap:10px;padding:0 18px 16px;">
        <span style="font-size:11px;color:#888;font-family:Pretendard,-apple-system,sans-serif;white-space:nowrap;">초기 너비</span>
        <input id="mkp-width-input" type="number" value="360" min="100" max="860" step="10"
          style="width:70px;background:#111;border:1px solid #333;border-radius:4px;color:#ddd;font-size:12px;padding:5px 8px;text-align:center;font-family:Pretendard,-apple-system,sans-serif;">
        <span style="font-size:11px;color:#666;font-family:Pretendard,-apple-system,sans-serif;">px</span>
        <div style="flex:1;"></div>
        <button id="mkp-insert-btn"
          style="background:#2563eb;border:none;border-radius:6px;color:#fff;font-size:12px;padding:7px 20px;cursor:pointer;font-weight:600;font-family:Pretendard,-apple-system,sans-serif;opacity:0.4;" disabled>
          삽입
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(el);
  return el;
}

function _getDeviceThumb(key) {
  const thumbs = {
    iphone:  `<svg viewBox="0 0 24 48" width="18" height="36" fill="none" stroke="#555" stroke-width="1.5"><rect x="1" y="1" width="22" height="46" rx="4"/><rect x="4" y="6" width="16" height="34" rx="1.5" fill="#222" stroke="none"/><rect x="8" y="2.5" width="8" height="2" rx="1" fill="#444" stroke="none"/></svg>`,
    macbook: `<svg viewBox="0 0 32 22" width="36" height="22" fill="none" stroke="#555" stroke-width="1.5"><rect x="2" y="1" width="28" height="18" rx="2"/><rect x="5" y="4" width="22" height="13" rx="1" fill="#222" stroke="none"/><rect x="0" y="19" width="32" height="2" rx="1"/></svg>`,
    ipad:    `<svg viewBox="0 0 28 40" width="21" height="30" fill="none" stroke="#555" stroke-width="1.5"><rect x="1" y="1" width="26" height="38" rx="3"/><rect x="4" y="5" width="20" height="27" rx="1" fill="#222" stroke="none"/></svg>`,
    android: `<svg viewBox="0 0 22 46" width="17" height="35" fill="none" stroke="#555" stroke-width="1.5"><rect x="1" y="1" width="20" height="44" rx="4"/><rect x="3" y="5" width="16" height="31" rx="1.5" fill="#222" stroke="none"/><circle cx="11" cy="41" r="1.5" fill="#555" stroke="none"/></svg>`,
    browser: `<svg viewBox="0 0 32 24" width="36" height="24" fill="none" stroke="#555" stroke-width="1.5"><rect x="1" y="1" width="30" height="22" rx="2"/><rect x="1" y="1" width="30" height="7" fill="#2a2a2a" stroke="none"/><circle cx="5" cy="4.5" r="1.2" fill="#555"/><circle cx="9" cy="4.5" r="1.2" fill="#555"/><circle cx="13" cy="4.5" r="1.2" fill="#555"/><rect x="16" y="2.5" width="12" height="4" rx="2" fill="#333"/></svg>`,
  };
  return thumbs[key] || '';
}

function openMockupModal() {
  if (!_mockupModal) {
    _mockupModal = _createMockupModal();
    _bindMockupModalEvents();
  }
  // Reset selection
  _mockupModal.querySelectorAll('.mkp-device-card').forEach(c => {
    c.style.borderColor = '#2a2a2a';
    c.style.background  = '#111';
  });
  _mockupModal.querySelector('#mkp-insert-btn').disabled = true;
  _mockupModal.querySelector('#mkp-insert-btn').style.opacity = '0.4';
  _mockupModal.dataset.selectedDevice = '';
  _mockupModal.style.display = 'flex';
}
window.openMockupModal = openMockupModal;

function closeMockupModal() {
  if (_mockupModal) _mockupModal.style.display = 'none';
}
window.closeMockupModal = closeMockupModal;

function _bindMockupModalEvents() {
  _mockupModal.querySelector('#mkp-modal-close').addEventListener('click', closeMockupModal);
  _mockupModal.addEventListener('click', e => { if (e.target === _mockupModal) closeMockupModal(); });

  // Device card selection
  _mockupModal.querySelectorAll('.mkp-device-card').forEach(card => {
    card.addEventListener('click', () => {
      _mockupModal.querySelectorAll('.mkp-device-card').forEach(c => {
        c.style.borderColor = '#2a2a2a';
        c.style.background  = '#111';
      });
      card.style.borderColor = '#2563eb';
      card.style.background  = '#1a2a4a';
      _mockupModal.dataset.selectedDevice = card.dataset.device;

      // Update default width
      const dev = window.MOCKUP_DEVICES?.[card.dataset.device];
      if (dev) {
        _mockupModal.querySelector('#mkp-width-input').value = dev.defaultWidth;
      }

      const btn = _mockupModal.querySelector('#mkp-insert-btn');
      btn.disabled = false;
      btn.style.opacity = '1';
    });
  });

  // Double click = instant insert
  _mockupModal.querySelectorAll('.mkp-device-card').forEach(card => {
    card.addEventListener('dblclick', () => {
      _mockupModal.dataset.selectedDevice = card.dataset.device;
      const dev = window.MOCKUP_DEVICES?.[card.dataset.device];
      if (dev) _mockupModal.querySelector('#mkp-width-input').value = dev.defaultWidth;
      _doMockupInsert();
    });
  });

  _mockupModal.querySelector('#mkp-insert-btn').addEventListener('click', _doMockupInsert);
}

function _doMockupInsert() {
  const deviceKey = _mockupModal.dataset.selectedDevice;
  if (!deviceKey) return;
  const width = Math.min(860, Math.max(100, parseInt(_mockupModal.querySelector('#mkp-width-input').value) || 360));
  closeMockupModal();
  window.addDeviceMockupBlock?.(deviceKey, width);
}

// Hover CSS
const _mkpStyle = document.createElement('style');
_mkpStyle.textContent = `
  .mkp-device-card:hover { background:#1a1a1a !important; border-color:#444 !important; }
`;
document.head.appendChild(_mkpStyle);
