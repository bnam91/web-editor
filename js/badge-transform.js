// badge-transform.js — 섹션을 정품 인증 배지로 덮어쓰는 이스터에그
// 트리거: 섹션명이 'badge_'로 시작하면 layer-panel.js의 finish()에서 호출

function transformSectionToBadge(sec, badgeText) {
  if (!sec) return;
  const inner = sec.querySelector('.section-inner');
  if (!inner) return;

  inner.innerHTML = '';

  // 어두운 배경
  const darkBg = '#1a1a1a';
  sec.dataset.bg = darkBg;
  sec.style.backgroundColor = darkBg;
  sec.style.backgroundImage = 'none';

  // 배지 — 기본 프리셋(shape-square, color-silver) + 효과 off
  const title = escapeHtml(badgeText);
  const badge = document.createElement('div');
  badge.className = 'badge-hologram-row shape-square color-silver';
  badge.dataset.badge = 'true';
  badge.innerHTML = `
    <div class="badge-hologram-square">
      <svg class="badge-trace-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
        <rect class="deco-thick" x="5" y="5" width="90" height="90" rx="11" ry="11"></rect>
        <rect class="deco-thin"  x="8" y="8" width="84" height="84" rx="8"  ry="8"></rect>
        <rect class="trace-path" x="1" y="1" width="98" height="98" rx="14" ry="14" pathLength="100"></rect>
      </svg>
      <div class="badge-logo" contenteditable="true">소문의섬</div>
      <div class="badge-logo-sub" contenteditable="true">Landing Page Designer</div>
    </div>
    <div class="badge-content">
      <div class="badge-title" contenteditable="true">${title}</div>
      <div class="badge-desc" contenteditable="true">해당 배너가 없는 비공식 판매처에서 구입 시 발생하는 하자 및 AS 보장에 불이익이 있으므로 피해가 없도록 주의 바랍니다</div>
    </div>
  `;
  inner.appendChild(badge);

  inner.classList.add('badge-align-center');
  inner.style.display = 'flex';
  inner.style.alignItems = 'center';
  inner.style.minHeight = '260px';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

// ── 프리셋 정의 ──
const SHAPE_PRESETS = [
  { value: 'shape-square', label: '정사각형 (기본)' },
  { value: 'shape-round',  label: '라운드 (둥근 모서리)' },
  { value: 'shape-circle', label: '원형' },
  { value: 'shape-zigzag', label: '톱니 (인증서 가장자리)' }
];
const COLOR_PRESETS = [
  { value: 'color-silver', label: '실버 (기본)' },
  { value: 'color-gold',   label: '골드' },
  { value: 'color-rose',   label: '로즈골드' },
  { value: 'color-pearl',  label: '펄' }
];
const ANIM_PRESETS = [
  { value: 'anim-none',   label: '없음 (정적)' },
  { value: 'anim-sweep',  label: '광택 sweep (좌→우)' },
  { value: 'anim-trace',  label: '테두리 빛 한바퀴 ✨' },
  { value: 'anim-pulse',  label: '펄스 (밝기 깜빡)' },
  { value: 'anim-rotate', label: '색조 회전' }
];
const ALIGN_PRESETS = [
  { value: 'badge-align-left',   label: '←' },
  { value: 'badge-align-center', label: '중' },
  { value: 'badge-align-right',  label: '→' }
];

// shape preset → trace path rx 매핑 (viewBox 100 기준)
// 데코는 안쪽이라 살짝 더 작은 rx
const SHAPE_RX = {
  'shape-square': { trace: 14, decoThick: 11, decoThin: 8 },
  'shape-round':  { trace: 8,  decoThick: 6,  decoThin: 4 },
  'shape-circle': { trace: 50, decoThick: 47, decoThin: 44 },
  'shape-zigzag': { trace: 0,  decoThick: 0,  decoThin: 0 }
};

function syncTraceSvgShape(badge) {
  const svg = badge.querySelector('.badge-trace-svg');
  if (!svg) return;
  const shape = Object.keys(SHAPE_RX).find(c => badge.classList.contains(c)) || 'shape-square';
  const rxMap = SHAPE_RX[shape];
  const set = (sel, rx) => {
    const r = svg.querySelector(sel);
    if (r) { r.setAttribute('rx', rx); r.setAttribute('ry', rx); }
  };
  set('rect.trace-path', rxMap.trace);
  set('rect.deco-thick', rxMap.decoThick);
  set('rect.deco-thin',  rxMap.decoThin);
}

// 저장/로드 사이클에서 contenteditable 속성이 빠진 badge 텍스트 element 복구
function ensureBadgeEditable(badge) {
  if (!badge) return;
  ['badge-logo', 'badge-logo-sub', 'badge-title', 'badge-desc'].forEach(cls => {
    const el = badge.querySelector('.' + cls);
    if (el && el.getAttribute('contenteditable') !== 'true') {
      el.setAttribute('contenteditable', 'true');
    }
  });
}

// 기존 badge에 SVG 없거나 옛 구조면 새 구조로 마이그레이션
function ensureTraceSvg(badge) {
  const sq = badge.querySelector('.badge-hologram-square');
  if (!sq) return;
  const existing = sq.querySelector('.badge-trace-svg');
  // deco rect 없으면 옛 구조 → 교체
  if (existing && !existing.querySelector('.deco-thick')) existing.remove();
  if (sq.querySelector('.badge-trace-svg')) return;
  const svg = `<svg class="badge-trace-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
    <rect class="deco-thick" x="5" y="5" width="90" height="90" rx="11" ry="11"></rect>
    <rect class="deco-thin"  x="8" y="8" width="84" height="84" rx="8"  ry="8"></rect>
    <rect class="trace-path" x="1" y="1" width="98" height="98" rx="14" ry="14" pathLength="100"></rect>
  </svg>`;
  sq.insertAdjacentHTML('afterbegin', svg);
  syncTraceSvgShape(badge);
}

// ── prop-panel 증강 ──
function enhanceBadgePropPanel(sec) {
  if (!sec) return;
  const badge = sec.querySelector('.badge-hologram-row');
  if (!badge) return;
  ensureTraceSvg(badge);      // 기존 badge에도 SVG 보장
  ensureBadgeEditable(badge); // contenteditable 속성 복구
  const inner = sec.querySelector('.section-inner');

  const propPanel = document.querySelector('#panel-right .panel-body')
                 || document.querySelector('.panel-body');
  if (!propPanel) return;

  // 현재 활성 프리셋 감지
  const currentShape = SHAPE_PRESETS.find(p => badge.classList.contains(p.value))?.value || 'shape-square';
  const currentColor = COLOR_PRESETS.find(p => badge.classList.contains(p.value))?.value || 'color-silver';
  const currentAnim  = ANIM_PRESETS.find(p => p.value !== 'anim-none' && badge.classList.contains(p.value))?.value || 'anim-none';
  const currentAlign = ALIGN_PRESETS.find(p => inner?.classList.contains(p.value))?.value || 'badge-align-center';
  const currentSize  = parseInt(badge.querySelector('.badge-hologram-square')?.style.width) || 200;
  // 데코 테두리 상태 (no-deco-* 클래스 부재 = ON)
  const decoThickOn = !badge.classList.contains('no-deco-thick');
  const decoThinOn  = !badge.classList.contains('no-deco-thin');

  // 4 텍스트 필드
  const els = {
    logo:  badge.querySelector('.badge-logo'),
    sub:   badge.querySelector('.badge-logo-sub'),
    title: badge.querySelector('.badge-title'),
    desc:  badge.querySelector('.badge-desc')
  };
  const fields = [
    { key: 'logo',  label: '로고 (정사각형)',   defaultSize: 30, defaultColor: '#0d0d0d' },
    { key: 'sub',   label: '부제 (정사각형)',   defaultSize: 12, defaultColor: '#454545' },
    { key: 'title', label: '제목',              defaultSize: 30, defaultColor: '#ffffff' },
    { key: 'desc',  label: '본문',              defaultSize: 17, defaultColor: '#b0b0b0' }
  ];

  const selectOpt = (presets, currentValue) =>
    presets.map(p => `<option value="${p.value}" ${p.value === currentValue ? 'selected' : ''}>${p.label}</option>`).join('');

  const fieldRows = fields.map(f => {
    const el = els[f.key];
    const size = parseInt(el?.style.fontSize) || f.defaultSize;
    const text = el?.textContent || '';
    const color = (el?.style.color || f.defaultColor).startsWith('rgb')
      ? rgbToHex(el.style.color) : (el?.style.color || f.defaultColor);
    const isTextarea = f.key === 'desc';
    const textInput = isTextarea
      ? `<textarea data-badge-field="${f.key}" data-badge-prop="text" rows="3"
            style="width:100%;padding:6px 8px;font-size:12px;background:#1a1a1a;color:#ddd;border:1px solid #333;border-radius:4px;resize:vertical;font-family:inherit;">${escapeHtml(text)}</textarea>`
      : `<input type="text" data-badge-field="${f.key}" data-badge-prop="text" value="${escapeHtml(text)}"
            style="width:100%;padding:5px 8px;font-size:12px;background:#1a1a1a;color:#ddd;border:1px solid #333;border-radius:4px;">`;
    return `
      <div style="margin-top:10px;padding-top:8px;border-top:1px solid #2a2a2a;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
          <span style="flex:1;font-size:11px;color:#999;font-weight:600;">${f.label}</span>
          <input type="color" data-badge-field="${f.key}" data-badge-prop="color" value="${color}"
                 style="width:24px;height:24px;border:none;padding:0;cursor:pointer;background:transparent;" title="색상">
          <input type="number" data-badge-field="${f.key}" data-badge-prop="fontSize" value="${size}" min="8" max="80"
                 style="width:54px;padding:3px 6px;font-size:12px;background:#1a1a1a;color:#ddd;border:1px solid #333;border-radius:4px;" title="크기">
        </div>
        ${textInput}
      </div>`;
  }).join('');

  const html = `
    <div class="prop-section" id="badge-controls-section">
      <div class="prop-section-title">Badge 효과 ✨</div>

      <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
        <span style="flex:1;font-size:11px;color:#999;">모양</span>
        <select id="badge-shape" style="flex:2;padding:5px 6px;font-size:12px;background:#1a1a1a;color:#ddd;border:1px solid #333;border-radius:4px;">
          ${selectOpt(SHAPE_PRESETS, currentShape)}
        </select>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
        <span style="flex:1;font-size:11px;color:#999;">컬러</span>
        <select id="badge-color" style="flex:2;padding:5px 6px;font-size:12px;background:#1a1a1a;color:#ddd;border:1px solid #333;border-radius:4px;">
          ${selectOpt(COLOR_PRESETS, currentColor)}
        </select>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
        <span style="flex:1;font-size:11px;color:#999;">GIF 효과</span>
        <select id="badge-anim" style="flex:2;padding:5px 6px;font-size:12px;background:#1a1a1a;color:#ddd;border:1px solid #333;border-radius:4px;">
          ${selectOpt(ANIM_PRESETS, currentAnim)}
        </select>
      </div>

      <div class="prop-section-title" style="margin-top:14px;">데코 테두리</div>
      <label style="display:flex;align-items:center;gap:8px;margin-top:6px;font-size:12px;color:#ccc;cursor:pointer;">
        <input type="checkbox" id="badge-deco-thick" ${decoThickOn ? 'checked' : ''}>
        굵은 선 (외곽 안쪽)
      </label>
      <label style="display:flex;align-items:center;gap:8px;margin-top:4px;font-size:12px;color:#ccc;cursor:pointer;">
        <input type="checkbox" id="badge-deco-thin" ${decoThinOn ? 'checked' : ''}>
        얇은 선 (내부)
      </label>

      <div class="prop-section-title" style="margin-top:14px;">정사각형 크기</div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
        <input type="range" id="badge-size" min="120" max="320" value="${currentSize}" style="flex:2;">
        <input type="number" id="badge-size-num" min="120" max="320" value="${currentSize}"
               style="width:54px;padding:3px 6px;font-size:12px;background:#1a1a1a;color:#ddd;border:1px solid #333;border-radius:4px;">
      </div>

      <div class="prop-section-title" style="margin-top:14px;">텍스트 속성</div>
      ${fieldRows}
    </div>
  `;

  const existing = propPanel.querySelector('#badge-controls-section');
  if (existing) existing.outerHTML = html;
  else propPanel.insertAdjacentHTML('beforeend', html);

  // ── 이벤트 와이어업 ──
  const applyPresetClass = (presets, newValue, target) => {
    presets.forEach(p => target.classList.remove(p.value));
    if (newValue !== 'anim-none') target.classList.add(newValue);
    // anim-none은 클래스 없음으로 표현 (기본)
    if (presets === SHAPE_PRESETS || presets === COLOR_PRESETS) target.classList.add(newValue);
    if (presets === ALIGN_PRESETS) target.classList.add(newValue);
  };

  propPanel.querySelector('#badge-shape')?.addEventListener('change', e => {
    SHAPE_PRESETS.forEach(p => badge.classList.remove(p.value));
    badge.classList.add(e.target.value);
    syncTraceSvgShape(badge); // SVG rx도 함께 업데이트
    window.pushHistory?.('badge 모양 변경');
    window.scheduleAutoSave?.();
  });
  propPanel.querySelector('#badge-color')?.addEventListener('change', e => {
    COLOR_PRESETS.forEach(p => badge.classList.remove(p.value));
    badge.classList.add(e.target.value);
    window.pushHistory?.('badge 컬러 변경');
    window.scheduleAutoSave?.();
  });
  propPanel.querySelector('#badge-anim')?.addEventListener('change', e => {
    ANIM_PRESETS.forEach(p => badge.classList.remove(p.value));
    if (e.target.value !== 'anim-none') badge.classList.add(e.target.value);
    window.pushHistory?.('badge 효과 변경');
    window.scheduleAutoSave?.();
  });

  // 데코 테두리 체크박스 토글
  propPanel.querySelector('#badge-deco-thick')?.addEventListener('change', e => {
    badge.classList.toggle('no-deco-thick', !e.target.checked);
    window.pushHistory?.('badge 굵은선 토글');
    window.scheduleAutoSave?.();
  });
  propPanel.querySelector('#badge-deco-thin')?.addEventListener('change', e => {
    badge.classList.toggle('no-deco-thin', !e.target.checked);
    window.pushHistory?.('badge 얇은선 토글');
    window.scheduleAutoSave?.();
  });

  const sizeSlider = propPanel.querySelector('#badge-size');
  const sizeNum = propPanel.querySelector('#badge-size-num');
  const applySize = v => {
    const sq = badge.querySelector('.badge-hologram-square');
    if (!sq) return;
    sq.style.width = v + 'px';
    sq.style.height = v + 'px';
    sizeSlider.value = v;
    sizeNum.value = v;
  };
  sizeSlider?.addEventListener('input', e => applySize(parseInt(e.target.value)));
  sizeSlider?.addEventListener('change', () => { window.pushHistory?.('badge 크기'); window.scheduleAutoSave?.(); });
  sizeNum?.addEventListener('change', e => { applySize(parseInt(e.target.value)); window.pushHistory?.('badge 크기'); window.scheduleAutoSave?.(); });

  propPanel.querySelectorAll('[data-badge-field]').forEach(input => {
    input.addEventListener('input', e => {
      const key = e.target.dataset.badgeField;
      const prop = e.target.dataset.badgeProp;
      const el = els[key];
      if (!el) return;
      if (prop === 'fontSize') el.style.fontSize = e.target.value + 'px';
      else if (prop === 'text') el.textContent = e.target.value;
      else if (prop === 'color') {
        if (key === 'logo') {
          el.style.background = `linear-gradient(180deg, ${e.target.value} 0%, ${shade(e.target.value, 12)} 45%, ${shade(e.target.value, 32)} 50%, ${shade(e.target.value, 6)} 100%)`;
          el.style.webkitBackgroundClip = 'text';
          el.style.backgroundClip = 'text';
          el.style.webkitTextFillColor = 'transparent';
        } else {
          el.style.color = e.target.value;
        }
      }
    });
    input.addEventListener('change', () => {
      window.pushHistory?.('badge 속성 변경');
      window.scheduleAutoSave?.();
    });
  });
}

function shade(hex, percent) {
  const m = hex.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  let r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + (percent / 100) * 255)));
  r = f(r); g = f(g); b = f(b);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

function rgbToHex(rgb) {
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return '#ffffff';
  return '#' + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
}

// ── 페이지 로드/전환 시 모든 badge 텍스트의 contenteditable 자동 복구 ──
function initBadgesInDom() {
  document.querySelectorAll('.badge-hologram-row').forEach(b => {
    ensureBadgeEditable(b);
    ensureTraceSvg(b);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBadgesInDom);
} else {
  initBadgesInDom();
}

// 페이지 전환 / 프로젝트 로딩 후 새 badge 추가될 때마다 자동 보장
new MutationObserver(muts => {
  for (const m of muts) {
    for (const node of m.addedNodes) {
      if (node.nodeType !== 1) continue;
      if (node.classList?.contains('badge-hologram-row')) {
        ensureBadgeEditable(node);
        ensureTraceSvg(node);
      }
      node.querySelectorAll?.('.badge-hologram-row').forEach(b => {
        ensureBadgeEditable(b);
        ensureTraceSvg(b);
      });
    }
  }
}).observe(document.body, { childList: true, subtree: true });

window.transformSectionToBadge = transformSectionToBadge;
window.enhanceBadgePropPanel   = enhanceBadgePropPanel;
