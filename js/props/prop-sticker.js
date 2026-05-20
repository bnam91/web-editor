import { propPanel } from '../globals.js';
import { colorFieldHTML, wireColorField, parseAlphaFromColor } from './color-picker.js';

function _esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function showStickerProperties(block) {
  const shape      = block.dataset.shape      || 'circle';
  const size       = parseInt(block.dataset.size)       || 60;
  const text       = block.dataset.text ?? 'NEW';
  const bgColor    = block.dataset.bgColor    || '#e74c3c';
  const textColor  = block.dataset.textColor  || '#ffffff';
  const fontSize   = parseInt(block.dataset.fontSize)   || 14;
  const fontWeight = parseInt(block.dataset.fontWeight) || 700;
  const bgAlpha    = parseAlphaFromColor(bgColor);
  const txtAlpha   = parseAlphaFromColor(textColor);

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3"><circle cx="6" cy="6" r="4.5"/></svg>
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">${block.dataset.layerName || 'Sticker'}</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb?.(block) || ''}</span>
        </div>
        ${block.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="_copyToClipboard?.('${block.id}')">${block.id}</span>` : ''}
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-row">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:#ccc;">
          <input type="checkbox" id="stk-mode-img" ${block.dataset.mode === 'image' ? 'checked' : ''}>
          이미지 모드
        </label>
      </div>
    </div>
    <div class="prop-section" id="stk-text-section" style="display:${(shape === 'highlight' || shape === 'highlightB') ? 'none' : (block.dataset.mode === 'image' ? 'none' : 'block')};">
      <div class="prop-section-title">Text</div>
      <div class="prop-row">
        <input type="text" class="prop-input" id="stk-text" value="${_esc(text)}" placeholder="텍스트">
      </div>
    </div>
    <div class="prop-section" id="stk-image-section" style="display:${(shape === 'highlight' || shape === 'highlightB') ? 'none' : (block.dataset.mode === 'image' ? 'block' : 'none')};">
      <div class="prop-section-title">Image</div>
      <div id="stk-img-drop" style="border:2px dashed #444;border-radius:6px;padding:18px 10px;text-align:center;color:#888;font-size:12px;cursor:pointer;background:#1a1a1a;transition:border-color .15s,background .15s;">
        ${block.dataset.imgSrc ? `<img src="${block.dataset.imgSrc}" style="max-width:80px;max-height:80px;object-fit:contain;display:block;margin:0 auto 6px;">` : ''}
        <div>이미지 드래그앤드롭<br>또는 클릭해서 선택</div>
      </div>
      ${block.dataset.imgSrc ? `<div class="prop-row" style="margin-top:6px;"><button class="prop-action-btn" id="stk-img-clear" style="width:100%;">이미지 제거</button></div>` : ''}
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Shape</div>
      <div class="prop-row">
        <div class="prop-align-group" id="stk-shape-group">
          <button class="prop-align-btn${shape === 'circle' ? ' active' : ''}" data-shape="circle" title="원형">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="5.5"/></svg>
          </button>
          <button class="prop-align-btn${shape === 'square' ? ' active' : ''}" data-shape="square" title="사각">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2.5" y="2.5" width="11" height="11" rx="1"/></svg>
          </button>
          <button class="prop-align-btn${shape === 'highlight' ? ' active' : ''}" data-shape="highlight" title="형광펜">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="6" width="12" height="5" rx="1" fill="rgba(255,235,70,0.85)"/></svg>
          </button>
          <button class="prop-align-btn${shape === 'highlightB' ? ' active' : ''}" data-shape="highlightB" title="선 형광펜">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><line x1="2" y1="11" x2="14" y2="5" stroke="rgba(255,235,70,0.95)" stroke-width="3.5" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>
    </div>
    <div class="prop-section" id="stk-hl-section" style="display:${shape === 'highlight' ? 'block' : 'none'};">
      <div class="prop-section-title">Highlight Size</div>
      <div class="prop-row">
        <span class="prop-label">너비</span>
        <input type="range" class="prop-slider" id="stk-hl-w" min="20" max="800" step="2" value="${parseInt(block.dataset.hlW) || 160}">
        <input type="number" class="prop-number" id="stk-hl-w-num" min="10" max="1200" value="${parseInt(block.dataset.hlW) || 160}">
      </div>
      <div class="prop-row">
        <span class="prop-label">높이</span>
        <input type="range" class="prop-slider" id="stk-hl-h" min="6" max="200" step="1" value="${parseInt(block.dataset.hlH) || 28}">
        <input type="number" class="prop-number" id="stk-hl-h-num" min="4" max="400" value="${parseInt(block.dataset.hlH) || 28}">
      </div>
      <div class="prop-color-row" style="margin-top:6px;">
        <span class="prop-label">색상</span>
        ${colorFieldHTML({ idPrefix: 'stk-hl-color', hex: (block.dataset.hlColor || '#ffeb46').replace(/rgba?\(([\d.\s,]+)\).*/, '#ffeb46'), alpha: 70 })}
      </div>
    </div>
    <div class="prop-section" id="stk-hlb-section" style="display:${shape === 'highlightB' ? 'block' : 'none'};">
      <div class="prop-section-title">Highlight Line</div>
      <div class="prop-row">
        <span class="prop-label">스타일</span>
        <div class="prop-align-group" id="stk-hlb-style-group" style="flex:1;">
          <button class="prop-align-btn${(block.dataset.lineStyle || 'line') === 'line' ? ' active' : ''}" data-style="line" title="직선">
            <svg width="18" height="14" viewBox="0 0 18 14" fill="none"><line x1="2" y1="7" x2="16" y2="7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
          <button class="prop-align-btn${block.dataset.lineStyle === 'wavy' ? ' active' : ''}" data-style="wavy" title="물결">
            <svg width="18" height="14" viewBox="0 0 18 14" fill="none"><path d="M2,7 Q5,3 8,7 T14,7 T20,7" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>
          </button>
          <button class="prop-align-btn${block.dataset.lineStyle === 'marker' ? ' active' : ''}" data-style="marker" title="마커">
            <svg width="18" height="14" viewBox="0 0 18 14" fill="none"><path d="M2,7 C6,5 12,9 16,7" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" fill="none"/></svg>
          </button>
        </div>
      </div>
      <div class="prop-row">
        <span class="prop-label">두께</span>
        <input type="range" class="prop-slider" id="stk-hlb-thick" min="1" max="100" step="1" value="${parseInt(block.dataset.thickness) || 12}">
        <input type="number" class="prop-number" id="stk-hlb-thick-num" min="1" max="200" value="${parseInt(block.dataset.thickness) || 12}">
      </div>
      <div class="prop-row stk-hlb-wavy-row" style="display:${block.dataset.lineStyle === 'wavy' ? 'flex' : 'none'};">
        <span class="prop-label">진폭</span>
        <input type="range" class="prop-slider" id="stk-hlb-amp" min="1" max="30" step="1" value="${parseFloat(block.dataset.amplitude) || 6}">
        <input type="number" class="prop-number" id="stk-hlb-amp-num" min="1" max="60" value="${parseFloat(block.dataset.amplitude) || 6}">
      </div>
      <div class="prop-row stk-hlb-wavy-row" style="display:${block.dataset.lineStyle === 'wavy' ? 'flex' : 'none'};">
        <span class="prop-label">주기</span>
        <input type="range" class="prop-slider" id="stk-hlb-period" min="10" max="100" step="1" value="${parseFloat(block.dataset.period) || 30}">
        <input type="number" class="prop-number" id="stk-hlb-period-num" min="6" max="200" value="${parseFloat(block.dataset.period) || 30}">
      </div>
      <div class="prop-color-row" style="margin-top:6px;">
        <span class="prop-label">색상</span>
        ${colorFieldHTML({ idPrefix: 'stk-hlb-color', hex: (block.dataset.hlColor || '#ffeb46').replace(/rgba?\(([\d.\s,]+)\).*/, '#ffeb46'), alpha: 70 })}
      </div>
    </div>
    <div class="prop-section" id="stk-size-section" style="display:${(shape === 'highlight' || shape === 'highlightB') ? 'none' : 'block'};">
      <div class="prop-section-title">Size</div>
      <div class="prop-row">
        <span class="prop-label">크기</span>
        <input type="range" class="prop-slider" id="stk-size" min="20" max="300" step="2" value="${size}">
        <input type="number" class="prop-number" id="stk-size-num" min="10" max="600" value="${size}">
      </div>
      <div class="prop-row">
        <span class="prop-label">폰트 크기</span>
        <input type="range" class="prop-slider" id="stk-fs" min="8" max="72" step="1" value="${fontSize}">
        <input type="number" class="prop-number" id="stk-fs-num" min="6" max="150" value="${fontSize}">
      </div>
      <div class="prop-row">
        <span class="prop-label">폰트 굵기</span>
        <select class="prop-select" id="stk-fw">
          <option value="300" ${fontWeight === 300 ? 'selected' : ''}>Light</option>
          <option value="400" ${fontWeight === 400 ? 'selected' : ''}>Regular</option>
          <option value="500" ${fontWeight === 500 ? 'selected' : ''}>Medium</option>
          <option value="600" ${fontWeight === 600 ? 'selected' : ''}>Semibold</option>
          <option value="700" ${fontWeight === 700 ? 'selected' : ''}>Bold</option>
          <option value="800" ${fontWeight === 800 ? 'selected' : ''}>Extrabold</option>
          <option value="900" ${fontWeight === 900 ? 'selected' : ''}>Black</option>
        </select>
      </div>
    </div>
    <div class="prop-section" id="stk-colors-section" style="display:${(shape === 'highlight' || shape === 'highlightB') ? 'none' : 'block'};">
      <div class="prop-section-title">Colors</div>
      <div class="prop-color-row">
        <span class="prop-label">배경색</span>
        ${colorFieldHTML({ idPrefix: 'stk-bg', hex: bgColor, alpha: bgAlpha })}
      </div>
      <div class="prop-color-row">
        <span class="prop-label">글자색</span>
        ${colorFieldHTML({ idPrefix: 'stk-txt', hex: textColor, alpha: txtAlpha })}
      </div>
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);

  const rerender = () => window.renderStickerBlock?.(block);

  // 텍스트 — input에선 .sticker-text textContent만 직접 갱신(rerender 시 캐럿 보존 X)
  const txt = propPanel.querySelector('#stk-text');
  txt.addEventListener('input', () => {
    block.dataset.text = txt.value;
    const t = block.querySelector('.sticker-text');
    if (t) t.textContent = txt.value;
  });
  txt.addEventListener('change', () => { window.pushHistory?.('스티커 텍스트'); window.scheduleAutoSave?.(); });

  // Mode 체크박스 (이미지 모드 on/off)
  propPanel.querySelector('#stk-mode-img')?.addEventListener('change', e => {
    block.dataset.mode = e.target.checked ? 'image' : 'text';
    propPanel.querySelector('#stk-text-section').style.display  = e.target.checked ? 'none' : 'block';
    propPanel.querySelector('#stk-image-section').style.display = e.target.checked ? 'block' : 'none';
    rerender();
    window.pushHistory?.('스티커 모드'); window.scheduleAutoSave?.();
  });

  // 이미지 처리 헬퍼 (파일 → dataURL → block 적용)
  const _applyImageFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) { window.showToast?.('⚠️ 5MB 이하 이미지만 지원'); return; }
    const reader = new FileReader();
    reader.onload = e => {
      block.dataset.imgSrc = e.target.result;
      block.dataset.mode = 'image';
      rerender();
      window.pushHistory?.('스티커 이미지'); window.scheduleAutoSave?.();
      showStickerProperties(block); // 패널 재렌더 (썸네일 + 제거 버튼)
    };
    reader.readAsDataURL(file);
  };

  // 드롭존: 클릭 → 파일 선택 / 드래그앤드롭
  const drop = propPanel.querySelector('#stk-img-drop');
  if (drop) {
    drop.addEventListener('click', () => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = 'image/*';
      inp.onchange = () => _applyImageFile(inp.files?.[0]);
      inp.click();
    });
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => {
      e.preventDefault(); e.stopPropagation();
      drop.style.borderColor = '#5a8aff';
      drop.style.background  = '#1a2540';
    }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => {
      e.preventDefault(); e.stopPropagation();
      drop.style.borderColor = '#444';
      drop.style.background  = '#1a1a1a';
    }));
    drop.addEventListener('drop', e => {
      _applyImageFile(e.dataTransfer?.files?.[0]);
    });
  }

  propPanel.querySelector('#stk-img-clear')?.addEventListener('click', () => {
    delete block.dataset.imgSrc;
    block.dataset.mode = 'text';
    rerender();
    window.pushHistory?.('스티커 이미지 제거'); window.scheduleAutoSave?.();
    showStickerProperties(block);
  });

  // Shape 토글
  propPanel.querySelectorAll('#stk-shape-group .prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      propPanel.querySelectorAll('#stk-shape-group .prop-align-btn').forEach(b => b.classList.toggle('active', b === btn));
      block.dataset.shape = btn.dataset.shape;
      // highlight / highlightB 모드일 때 text/이미지/일반 size 섹션 모두 숨김
      const isHl  = btn.dataset.shape === 'highlight';
      const isHlB = btn.dataset.shape === 'highlightB';
      const isAnyHl = isHl || isHlB;
      const hlSec   = propPanel.querySelector('#stk-hl-section');
      const hlbSec  = propPanel.querySelector('#stk-hlb-section');
      const txtSec  = propPanel.querySelector('#stk-text-section');
      const imgSec  = propPanel.querySelector('#stk-image-section');
      if (hlSec)  hlSec.style.display  = isHl  ? 'block' : 'none';
      if (hlbSec) hlbSec.style.display = isHlB ? 'block' : 'none';
      if (txtSec) txtSec.style.display = isAnyHl ? 'none' : (block.dataset.mode === 'image' ? 'none' : 'block');
      if (imgSec) imgSec.style.display = isAnyHl ? 'none' : (block.dataset.mode === 'image' ? 'block' : 'none');
      const sizeSec = propPanel.querySelector('#stk-size-section');
      const colSec  = propPanel.querySelector('#stk-colors-section');
      if (sizeSec) sizeSec.style.display = isAnyHl ? 'none' : 'block';
      if (colSec)  colSec.style.display  = isAnyHl ? 'none' : 'block';
      // highlightB로 전환 시 dataset 초기화 (없으면)
      if (isHlB && !block.dataset.x1) {
        const baseX = parseInt(block.dataset.x) || 40;
        const baseY = parseInt(block.dataset.y) || 40;
        block.dataset.x1 = baseX;
        block.dataset.y1 = baseY + 20;
        block.dataset.x2 = baseX + 160;
        block.dataset.y2 = baseY + 20;
        block.dataset.thickness = block.dataset.thickness || 12;
        block.dataset.hlColor   = block.dataset.hlColor   || 'rgba(255, 235, 70, 0.7)';
      }
      rerender();
      window.pushHistory?.('스티커 모양'); window.scheduleAutoSave?.();
    });
  });

  // Highlight W/H 슬라이더
  const bindHlPair = (sliderId, numId, key, min, max) => {
    const s = propPanel.querySelector('#' + sliderId);
    const n = propPanel.querySelector('#' + numId);
    if (!s || !n) return;
    const apply = v => {
      v = Math.min(max, Math.max(min, v));
      block.dataset[key] = v;
      rerender();
      s.value = Math.min(parseInt(s.max), v);
      n.value = v;
    };
    s.addEventListener('input',  () => apply(parseInt(s.value)));
    n.addEventListener('change', () => { apply(parseInt(n.value)); window.pushHistory?.(); window.scheduleAutoSave?.(); });
    s.addEventListener('change', () => { window.pushHistory?.(); window.scheduleAutoSave?.(); });
  };
  bindHlPair('stk-hl-w', 'stk-hl-w-num', 'hlW', 10, 1200);
  bindHlPair('stk-hl-h', 'stk-hl-h-num', 'hlH', 4,  400);

  // Highlight color (alpha 70% default)
  wireColorField('stk-hl-color', {
    initialAlpha: 70,
    onApply: (c) => { block.dataset.hlColor = c; rerender(); },
    onCommit: () => { window.pushHistory?.('형광펜 색'); window.scheduleAutoSave?.(); },
  });

  // HighlightB — 두께 슬라이더
  const bindHlbThick = () => {
    const s = propPanel.querySelector('#stk-hlb-thick');
    const n = propPanel.querySelector('#stk-hlb-thick-num');
    if (!s || !n) return;
    const apply = v => {
      v = Math.min(200, Math.max(1, v));
      block.dataset.thickness = v;
      rerender();
      s.value = Math.min(parseInt(s.max), v);
      n.value = v;
    };
    s.addEventListener('input',  () => apply(parseInt(s.value)));
    n.addEventListener('change', () => { apply(parseInt(n.value)); window.pushHistory?.('선 형광펜 두께'); window.scheduleAutoSave?.(); });
    s.addEventListener('change', () => { window.pushHistory?.('선 형광펜 두께'); window.scheduleAutoSave?.(); });
  };
  bindHlbThick();

  // HighlightB — 스타일 토글 (line/wavy/marker)
  propPanel.querySelectorAll('#stk-hlb-style-group .prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      propPanel.querySelectorAll('#stk-hlb-style-group .prop-align-btn').forEach(b => b.classList.toggle('active', b === btn));
      const style = btn.dataset.style;
      block.dataset.lineStyle = style;
      // wavy 전용 슬라이더 표시
      propPanel.querySelectorAll('.stk-hlb-wavy-row').forEach(row => {
        row.style.display = style === 'wavy' ? 'flex' : 'none';
      });
      rerender();
      // 선택 상태면 핸들 위치 재계산 (bbox가 바뀌므로)
      if (block.classList.contains('selected')) window._addHlbHandles?.(block);
      window.pushHistory?.('선 형광펜 스타일');
      window.scheduleAutoSave?.();
    });
  });

  // HighlightB — 진폭/주기 슬라이더
  const bindHlbPair = (sliderId, numId, key, min, max, label) => {
    const s = propPanel.querySelector('#' + sliderId);
    const n = propPanel.querySelector('#' + numId);
    if (!s || !n) return;
    const apply = v => {
      v = Math.min(max, Math.max(min, v));
      block.dataset[key] = v;
      rerender();
      if (block.classList.contains('selected')) window._addHlbHandles?.(block);
      s.value = Math.min(parseInt(s.max), v);
      n.value = v;
    };
    s.addEventListener('input',  () => apply(parseFloat(s.value)));
    n.addEventListener('change', () => { apply(parseFloat(n.value)); window.pushHistory?.(label); window.scheduleAutoSave?.(); });
    s.addEventListener('change', () => { window.pushHistory?.(label); window.scheduleAutoSave?.(); });
  };
  bindHlbPair('stk-hlb-amp',    'stk-hlb-amp-num',    'amplitude', 1,  60,  '선 형광펜 진폭');
  bindHlbPair('stk-hlb-period', 'stk-hlb-period-num', 'period',    6,  200, '선 형광펜 주기');

  // HighlightB color
  wireColorField('stk-hlb-color', {
    initialAlpha: 70,
    onApply: (c) => { block.dataset.hlColor = c; rerender(); },
    onCommit: () => { window.pushHistory?.('선 형광펜 색'); window.scheduleAutoSave?.(); },
  });

  // Size pair
  const bindNumPair = (sliderId, numberId, key, min, max) => {
    const s = propPanel.querySelector('#' + sliderId);
    const n = propPanel.querySelector('#' + numberId);
    const apply = v => {
      v = Math.min(max, Math.max(min, v));
      block.dataset[key] = v;
      rerender();
      s.value = Math.min(parseInt(s.max), v);
      n.value = v;
    };
    s.addEventListener('input',  () => apply(parseInt(s.value)));
    n.addEventListener('change', () => { apply(parseInt(n.value)); window.pushHistory?.(); window.scheduleAutoSave?.(); });
    s.addEventListener('change', () => { window.pushHistory?.(); window.scheduleAutoSave?.(); });
  };
  bindNumPair('stk-size', 'stk-size-num', 'size',     10, 600);
  bindNumPair('stk-fs',   'stk-fs-num',   'fontSize', 6,  150);

  // Font weight
  propPanel.querySelector('#stk-fw').addEventListener('change', e => {
    block.dataset.fontWeight = e.target.value;
    rerender();
    window.pushHistory?.('스티커 굵기'); window.scheduleAutoSave?.();
  });

  // Colors
  wireColorField('stk-bg', {
    initialAlpha: bgAlpha,
    onApply: (c) => { block.dataset.bgColor = c; rerender(); },
    onCommit: () => { window.pushHistory?.('스티커 배경'); window.scheduleAutoSave?.(); },
  });
  wireColorField('stk-txt', {
    initialAlpha: txtAlpha,
    onApply: (c) => { block.dataset.textColor = c; rerender(); },
    onCommit: () => { window.pushHistory?.('스티커 글자색'); window.scheduleAutoSave?.(); },
  });
}

window.showStickerProperties = showStickerProperties;
