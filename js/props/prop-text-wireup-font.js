/* prop-text-wireup-font.js
 * Custom Font Picker + helpers + font-weight + 시스템 폰트 비동기 로드
 * (모듈 상태 _systemFontsList는 이 파일에서만 보유)
 */

import { _pushRecentFont, _fontDisplayName, _fontKey, fontChain } from './prop-text-utils.js';

// design-system.js는 classic script라 import를 못 쓴다 → 같은 체인 규칙을 전역으로 공유(중복 정의 금지).
// 호출은 사용자 인터랙션 시점이라 모듈 로드 순서와 무관하다.
if (typeof window !== 'undefined') window.goditorFontChain = fontChain;

let _systemFontsList = [];

/* ── 시스템 설치 폰트 동적 로드 (모듈 수준 캐시) ── */
async function _loadSystemFonts() {
  if (_systemFontsList.length > 0 || !window.queryLocalFonts) return;
  try {
    const fonts = await window.queryLocalFonts();
    _systemFontsList = [...new Set(fonts.map(f => f.family))].sort((a, b) => a.localeCompare(b, 'ko'));
  } catch (e) { /* 퍼미션 거부 또는 미지원 */ }
}

export function wireFontSection({ propPanel, ctx }) {
  /* ── Custom Font Picker ── */
  const _fpTrigger  = propPanel.querySelector('#txt-font-trigger');
  const _fpDropdown = propPanel.querySelector('#txt-font-dropdown');
  const _fpSearch   = propPanel.querySelector('#txt-font-search');
  const _fpList     = propPanel.querySelector('#txt-font-list');
  const _fpNameEl   = propPanel.querySelector('#txt-font-name');

  // ★체인은 fontChain()이 만든다 — 번들 Pretendard를 generic 앞에 끼워 «폰트 없는 기기»에서
  //   OS 기본 글꼴로 떨어지는 걸 막는다. serif 2종(Noto Serif KR·Playfair)은 제외(sans로 뒤집히니까).
  //   generic 3종과 '기본 (시스템)'은 사용자가 «시스템 글꼴»을 고른 것이므로 손대지 않는다.
  const _FP_STATIC = [
    { value: '', label: '기본 (시스템)', group: 'base' },
    { value: fontChain('Pretendard'),      label: 'Pretendard',       group: 'korean' },
    { value: fontChain('Noto Sans KR'),    label: 'Noto Sans KR',     group: 'korean' },
    { value: fontChain('Noto Serif KR'),   label: 'Noto Serif KR',    group: 'korean' },
    { value: fontChain('Inter'),           label: 'Inter',            group: 'latin'  },
    { value: fontChain('Space Grotesk'),   label: 'Space Grotesk',    group: 'latin'  },
    { value: fontChain('Playfair Display'), label: 'Playfair Display', group: 'latin' },
    { value: 'sans-serif',   label: 'Sans-serif',  group: 'system' },
    { value: 'serif',        label: 'Serif',       group: 'system' },
    { value: 'monospace',    label: 'Monospace',   group: 'system' },
  ];

  function _fpAllFonts() {
    return [
      ..._FP_STATIC,
      ..._systemFontsList.map(fam => ({ value: fontChain(fam), label: fam, group: 'installed' })),
    ];
  }

  function _fpItemHtml(f, isPinned, isSel) {
    const v = f.value.replace(/"/g, '&quot;');
    return `<div class="font-item${isSel ? ' selected' : ''}" data-value="${v}">
      <span class="font-item-name">${f.label}</span>
      <button class="font-item-pin${isPinned ? ' pinned' : ''}" data-pin-value="${v}" title="${isPinned ? '핀 제거' : '핀 고정'}">⭐</button>
    </div>`;
  }

  function _fpBuildList(search) {
    const pins   = JSON.parse(localStorage.getItem('goditor_font_pins')   || '[]');
    const recent = JSON.parse(localStorage.getItem('goditor_font_recent') || '[]');
    const curVal = ctx.contentEl.dataset.rawFont || ctx.contentEl.style.fontFamily || '';
    const term   = (search || '').trim().toLowerCase();
    const all    = _fpAllFonts();

    // ★비교는 체인 문자열이 아니라 «대표 패밀리명»으로 한다.
    //   폴백 체인이 바뀌면(Pretendard 추가) 이미 저장된 텍스트의 rawFont나 예전 핀/최근사용이
    //   문자열 불일치로 «선택 안 됨»이 되고, 같은 폰트가 목록에 두 번 뜬다.
    const isSel   = (v) => (!v && !curVal) || (!!v && _fontKey(v) === _fontKey(curVal));
    const isPin   = (v) => pins.some(p => _fontKey(p) === _fontKey(v));
    // 예전 체인으로 저장된 핀/최근사용은 현재 목록의 «같은 패밀리» 항목으로 해석해
    // 클릭 시 새 체인이 적용되게 한다(구값 재적용 방지).
    const resolve = (v, group) => all.find(f => _fontKey(f.value) === _fontKey(v))
                                 || { value: v, label: _fontDisplayName(v), group };

    let html = '';
    if (term) {
      const hits = all.filter(f => f.label.toLowerCase().includes(term));
      if (!hits.length) { html = '<div class="font-group-label">결과 없음</div>'; }
      else hits.forEach(f => { html += _fpItemHtml(f, isPin(f.value), isSel(f.value)); });
    } else {
      // Pinned
      const pinnedFonts = pins.map(v => resolve(v, 'pinned'));
      if (pinnedFonts.length) {
        html += '<div class="font-group-label">핀 고정</div>';
        pinnedFonts.forEach(f => { html += _fpItemHtml(f, true, isSel(f.value)); });
      }
      // Recent (not pinned)
      const recentFonts = recent.filter(v => !isPin(v)).map(v => resolve(v, 'recent'));
      if (recentFonts.length) {
        html += '<div class="font-group-label">최근 사용</div>';
        recentFonts.forEach(f => { html += _fpItemHtml(f, false, isSel(f.value)); });
      }
      // Static groups
      [['base','기본'],['korean','한글'],['latin','영문'],['system','시스템'],['installed','설치 폰트']].forEach(([g, lbl]) => {
        const items = all.filter(f => f.group === g);
        if (!items.length) return;
        html += `<div class="font-group-label">${lbl}</div>`;
        items.forEach(f => { html += _fpItemHtml(f, isPin(f.value), isSel(f.value)); });
      });
    }
    _fpList.innerHTML = html;
    const selEl = _fpList.querySelector('.font-item.selected');
    if (selEl) selEl.scrollIntoView({ block: 'nearest' });
  }

  function _fpClose() {
    _fpDropdown.style.display = 'none';
    _fpTrigger.classList.remove('open');
  }

  _fpTrigger.addEventListener('click', () => {
    const isOpen = _fpDropdown.style.display !== 'none';
    if (isOpen) { _fpClose(); return; }

    // Position dropdown with fixed coords to avoid clipping
    const r = _fpTrigger.getBoundingClientRect();
    Object.assign(_fpDropdown.style, {
      display: 'block', position: 'fixed',
      top: (r.bottom + 2) + 'px', left: r.left + 'px', width: r.width + 'px', zIndex: '9999'
    });
    _fpTrigger.classList.add('open');
    _fpSearch.value = '';
    _fpBuildList('');
    setTimeout(() => _fpSearch.focus(), 10);

    const outside = (e) => {
      if (!propPanel.querySelector('#txt-font-picker')?.contains(e.target) &&
          !_fpDropdown.contains(e.target)) {
        _fpClose();
        document.removeEventListener('mousedown', outside, true);
      }
    };
    document.addEventListener('mousedown', outside, true);
  });

  _fpSearch.addEventListener('input', () => _fpBuildList(_fpSearch.value));

  _fpList.addEventListener('mousedown', e => {
    e.preventDefault();
    const pinBtn = e.target.closest('.font-item-pin');
    if (pinBtn) {
      const val = pinBtn.dataset.pinValue;
      let pins = JSON.parse(localStorage.getItem('goditor_font_pins') || '[]');
      // 핀 해제도 패밀리명 기준 — 예전 체인으로 저장된 핀이 안 지워지던 문제 방지
      if (pins.some(p => _fontKey(p) === _fontKey(val))) pins = pins.filter(p => _fontKey(p) !== _fontKey(val));
      else pins.unshift(val);
      localStorage.setItem('goditor_font_pins', JSON.stringify(pins));
      _fpBuildList(_fpSearch.value);
      return;
    }
    const item = e.target.closest('.font-item');
    if (item) {
      const rawVal = item.dataset.value;
      window.pushHistory?.();
      ctx.contentEl.style.fontFamily = rawVal;
      ctx.contentEl.dataset.rawFont  = rawVal;
      ctx.contentEl.querySelectorAll('div').forEach(child => { child.style.removeProperty('font-family'); });
      _pushRecentFont(rawVal);
      _fpNameEl.textContent = rawVal ? _fontDisplayName(rawVal) : '기본 (시스템)';
      _fpClose();
    }
  });

  /* 시스템 폰트 비동기 로드 */
  _loadSystemFonts().then(() => {
    if (_fpDropdown.style.display !== 'none') _fpBuildList(_fpSearch.value);
  });

  /* 폰트 굵기 — selection 있으면 그 부분만 <span>, 없으면 전체 적용 */
  let _savedFwSel = null;
  const fwSel = document.getElementById('txt-font-weight');
  const saveFwSel = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      _savedFwSel = sel.getRangeAt(0).cloneRange();
    } else _savedFwSel = null;
  };
  fwSel.addEventListener('mousedown', saveFwSel);
  fwSel.addEventListener('focus', saveFwSel);
  fwSel.addEventListener('change', e => {
    const v = e.target.value;
    if (_savedFwSel) {
      // 부분 적용 — selection을 <span style="font-weight:V">로 wrap
      const r = _savedFwSel.cloneRange();
      const frag = r.extractContents();
      const span = document.createElement('span');
      span.style.fontWeight = v;
      span.appendChild(frag);
      r.insertNode(span);
      _savedFwSel = null;
    } else {
      ctx.contentEl.style.fontWeight = v;
    }
    window.pushHistory();
  });
}
