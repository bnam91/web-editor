/* yt-thumb-preview.js — t13C-03 ③ 유튜브 썸네일 «미리보기»(현빈 GO 261122 · 보기 전용).
   썸네일 섹션(data-thumb="youtube")을 1280 PNG 한 장으로 굽고(exportSection returnDataUrl — 게이트·다운로드 없음)
   유튜브 목록 꼴 카드 셋(홈 격자 · 옆 추천 · 모바일)에 같은 그림을 얹어 «작게 보면 어떤가»를 본다.
   ★저장 키 0 · 섹션 손대지 않음 · 제목은 모달 안 입력만(닫으면 버림) · 껍데기·단추 = settings-modal 공용 클래스(css/yt-thumb-preview.css 는 카드 배치만).
   입구 = 섹션 패널 Export 절 «YouTube 미리보기»(썸네일 섹션 + 관리자 노출일 때만 · js/props/prop-section.js). */
(function (w) {
  const OVERLAY_ID = 'yt-preview-overlay';
  /* shortcut: 카드 크기·재생시간·채널 글은 태양 기억값(유튜브 규격 아님 · 자주 바뀜) — 실측 표본(미카사 Figma 501_유튜브썸네일)이 오면 그 값으로 */
  const CARDS = [
    { key: 'home', label: '홈 격자', thumbW: 360 },
    { key: 'side', label: '옆 추천', thumbW: 168 },
    { key: 'mobile', label: '모바일', thumbW: 360 },
  ];
  const DURATION = '12:34';
  const CHANNEL = '채널 이름';
  const META = '조회수 1.2만회 · 1일 전';
  let _escKey = null;

  const _el = (id) => document.getElementById(id);
  const _cardHTML = (c) => `
    <div class="ytp-card ytp-card-${c.key}" data-card="${c.key}">
      <div class="ytp-card-label">${c.label}</div>
      <div class="ytp-item">
        <div class="ytp-thumb" style="width:${c.thumbW}px"><img class="ytp-img" alt=""><span class="ytp-dur">${DURATION}</span></div>
        <div class="ytp-meta">
          ${c.key === 'side' ? '' : '<span class="ytp-avatar"></span>'}
          <div class="ytp-lines"><div class="ytp-title"></div><div class="ytp-sub">${CHANNEL}</div><div class="ytp-sub">${META}</div></div>
        </div>
      </div>
    </div>`;

  function _ensure() {
    let ov = _el(OVERLAY_ID);
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = OVERLAY_ID;
    ov.className = 'settings-modal-overlay';
    ov.innerHTML = `
      <div class="settings-modal-shell ytp-shell" role="dialog" aria-modal="true" aria-labelledby="ytp-title-h">
        <div class="settings-modal-header">
          <div class="settings-modal-title" id="ytp-title-h">YouTube 미리보기</div>
          <button class="settings-modal-close" id="ytp-close" title="닫기 (Esc)">×</button>
        </div>
        <div class="settings-modal-body ytp-body">
          <input type="text" class="prop-input ytp-title-in" id="ytp-title-in" placeholder="영상 제목(미리보기에만 · 저장 안 됨)" maxlength="100">
          <div class="ytp-status" aria-live="polite"></div>
          <div class="ytp-stage" data-theme="dark">${CARDS.map(_cardHTML).join('')}</div>
        </div>
        <div class="settings-modal-footer">
          <button class="settings-btn settings-btn-primary" data-ytp-theme="dark">어두운 바탕</button>
          <button class="settings-btn settings-btn-secondary" data-ytp-theme="light">밝은 바탕</button>
          <div style="flex:1"></div>
          <button class="settings-btn settings-btn-secondary" id="ytp-done">닫기</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
    _el('ytp-close').addEventListener('click', close);
    _el('ytp-done').addEventListener('click', close);
    _el('ytp-title-in').addEventListener('input', _syncTitle);
    ov.querySelectorAll('[data-ytp-theme]').forEach((b) => b.addEventListener('click', () => setTheme(b.dataset.ytpTheme)));
    return ov;
  }
  function _syncTitle() {
    const ov = _el(OVERLAY_ID); if (!ov) return;
    const t = _el('ytp-title-in').value.trim() || '영상 제목을 입력하면 여기에 두 줄까지 보입니다';
    ov.querySelectorAll('.ytp-title').forEach((d) => { d.textContent = t; });
  }
  function setTheme(theme) {
    const ov = _el(OVERLAY_ID); if (!ov) return;
    ov.querySelector('.ytp-stage').dataset.theme = theme === 'light' ? 'light' : 'dark';
    ov.querySelectorAll('[data-ytp-theme]').forEach((b) => {
      const on = b.dataset.ytpTheme === ov.querySelector('.ytp-stage').dataset.theme;
      b.classList.toggle('settings-btn-primary', on); b.classList.toggle('settings-btn-secondary', !on);
    });
  }
  function close() {
    const ov = _el(OVERLAY_ID);
    if (ov) ov.remove();   // 다음에 열면 새로 굽는다(섹션이 바뀌었을 수 있다) · 제목도 버린다
    if (_escKey) { document.removeEventListener('keydown', _escKey, true); _escKey = null; }
  }
  async function open(sec) {
    if (!sec || sec.dataset.thumb !== 'youtube') return false;
    close();
    const ov = _ensure();
    ov.style.display = 'flex';
    _syncTitle(); setTheme('dark');
    _escKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); } };
    document.addEventListener('keydown', _escKey, true);
    _el('ytp-title-in').focus();
    const status = ov.querySelector('.ytp-status');
    status.textContent = '썸네일을 그리는 중…';
    let url = null;
    try { url = await w.exportSection?.(sec, 'png', 1280, { returnDataUrl: true }); } catch (_) { url = null; }
    if (!ov.isConnected) return false;   // 그리는 사이 닫았다
    if (typeof url !== 'string' || !url.startsWith('data:image/')) { status.textContent = '썸네일을 그리지 못했습니다 — 섹션 내보내기를 한 번 확인해 주세요.'; return false; }
    ov.querySelectorAll('.ytp-img').forEach((im) => { im.src = url; });
    status.textContent = '';
    return true;
  }
  w.openYtThumbPreview = open;
  w.closeYtThumbPreview = close;
})(window);
