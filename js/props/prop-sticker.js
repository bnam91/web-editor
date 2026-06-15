import { propPanel } from '../globals.js';
import { colorFieldHTML, wireColorField, parseAlphaFromColor } from './color-picker.js';

function _esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── U6(c): 스티커 즐겨찾기 — 프로젝트 무관 전역 localStorage ────────────────────
const FAV_KEY = 'goditor.stickerFavorites';
const FAV_MAX = 30;
// 위치 종속 shape(highlightB)는 프리셋 부적합 — circle/square/text/highlight/icon만 대상.
const FAV_ALLOWED_SHAPES = ['circle', 'square', 'text', 'highlight', 'icon'];

function listStickerFavorites() {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (_) { return []; }
}
function _saveStickerFavorites(arr) {
  try { localStorage.setItem(FAV_KEY, JSON.stringify(arr.slice(0, FAV_MAX))); } catch (_) {}
}
// 현재 스티커 dataset에서 스타일 토큰만 추출 (위치/절대크기/text 내용 제외)
function _stickerStyleFromBlock(block) {
  const d = block.dataset;
  const shape = d.shape || 'circle';
  const preset = { shape };
  const put = (k) => { if (d[k] !== undefined && d[k] !== '') preset[k] = d[k]; };
  if (shape === 'highlight') {
    put('hlColor'); put('hlW'); put('hlH');
  } else if (shape === 'icon') {
    ['iconName', 'iconSvg', 'iconColor', 'size'].forEach(put);
  } else if (shape === 'text') {
    ['fontFamily', 'fontSize', 'fontWeight', 'textColor', 'strokeWidth', 'strokeColor',
     'letterSpacing', 'textAlign', 'shadowOn', 'shadowX', 'shadowY', 'shadowBlur', 'shadowColor',
     'bgColor', 'padX', 'padY'].forEach(put);
  } else { // circle / square
    ['size', 'bgColor', 'textColor', 'fontSize', 'fontWeight'].forEach(put);
  }
  return preset;
}
function addStickerFavorite(block) {
  const shape = block.dataset.shape || 'circle';
  if (!FAV_ALLOWED_SHAPES.includes(shape)) {
    window.showToast?.('⚠️ 이 모양은 즐겨찾기에 추가할 수 없습니다');
    return false;
  }
  const preset = _stickerStyleFromBlock(block);
  const favs = listStickerFavorites();
  favs.unshift(preset);
  _saveStickerFavorites(favs);
  return true;
}
function removeStickerFavorite(idx) {
  const favs = listStickerFavorites();
  if (idx < 0 || idx >= favs.length) return;
  favs.splice(idx, 1);
  _saveStickerFavorites(favs);
}
window.listStickerFavorites = listStickerFavorites;
window.addStickerFavorite = addStickerFavorite;
window.removeStickerFavorite = removeStickerFavorite;

// 즐겨찾기 스와치 1개의 미리보기 스타일/라벨
function _favSwatchPreview(preset) {
  const shape = preset.shape || 'circle';
  if (shape === 'highlight') {
    return { bg: preset.hlColor || 'rgba(255,235,70,0.7)', label: '' };
  }
  if (shape === 'text') {
    return { bg: (preset.bgColor && preset.bgColor !== 'transparent') ? preset.bgColor : '#2a2a2a',
             color: preset.textColor || '#ddd', label: 'T' };
  }
  if (shape === 'icon') {
    return { bg: '#2a2a2a', color: preset.iconColor || '#ddd', label: '★', svg: preset.iconSvg || '' };
  }
  return { bg: preset.bgColor || '#e74c3c', color: preset.textColor || '#fff', label: 'A' };
}

// ── U6(d): 텍스트 스티커 프리셋 (코드 내 고정 배열) ───────────────────────────────
// text 내용(dataset.text)은 보존하고 스타일만 덮어씀.
const TEXT_PRESETS = [
  { name: '빅 타이틀', style: { fontSize: '48', fontWeight: '900', textColor: '#222222', strokeWidth: '0', letterSpacing: '-1', shadowOn: '0', bgColor: 'transparent' } },
  { name: '뱃지', style: { fontSize: '18', fontWeight: '700', textColor: '#ffffff', bgColor: '#e74c3c', strokeWidth: '0', padX: '14', padY: '6', shadowOn: '0' } },
  { name: '외곽선 강조', style: { fontSize: '40', fontWeight: '800', textColor: '#ffffff', strokeWidth: '4', strokeColor: '#222222', shadowOn: '0', bgColor: 'transparent' } },
  { name: '그림자 텍스트', style: { fontSize: '36', fontWeight: '800', textColor: '#ffffff', strokeWidth: '0', shadowOn: '1', shadowX: '0', shadowY: '3', shadowBlur: '6', shadowColor: 'rgba(0,0,0,0.5)', bgColor: 'transparent' } },
  { name: '형광펜식', style: { fontSize: '30', fontWeight: '700', textColor: '#222222', strokeWidth: '0', shadowOn: '0', bgColor: 'rgba(255,235,70,0.7)', padX: '6', padY: '2' } },
  { name: '심플 라벨', style: { fontSize: '14', fontWeight: '500', textColor: '#666666', strokeWidth: '0', letterSpacing: '0.5', shadowOn: '0', bgColor: 'transparent' } },
];
window.STICKER_TEXT_PRESETS = TEXT_PRESETS;

export function showStickerProperties(block) {
  const shape      = block.dataset.shape      || 'circle';
  const isText     = shape === 'text';
  const isHl      = shape === 'highlight';
  const isHlB     = shape === 'highlightB';
  const isAnyHl   = isHl || isHlB;
  const isIcon    = shape === 'icon';
  // circle/square 전용 섹션(mode/text/size/colors)을 가리는 통합 플래그
  const hideBasic = isAnyHl || isText || isIcon;
  // 기본 sticker(circle/square)에서 사용하는 값
  const size       = parseInt(block.dataset.size)       || 60;
  const text       = block.dataset.text ?? (isText ? 'Text' : 'NEW');
  const bgDefault  = isText ? 'transparent' : '#e74c3c';
  const txtDefault = isText ? '#222222'     : '#ffffff';
  const bgColor    = block.dataset.bgColor    || bgDefault;
  const textColor  = block.dataset.textColor  || txtDefault;
  const fontSize   = parseInt(block.dataset.fontSize)   || (isText ? 32 : 14);
  const fontWeight = parseInt(block.dataset.fontWeight) || 700;
  const bgAlpha    = parseAlphaFromColor(bgColor);
  const txtAlpha   = parseAlphaFromColor(textColor);

  // 텍스트 스티커 전용 값
  const tFontFamily    = block.dataset.fontFamily    || "'Pretendard', sans-serif";
  const tStrokeWidth   = parseFloat(block.dataset.strokeWidth) || 0;
  const tStrokeColor   = block.dataset.strokeColor   || '#ffffff';
  const tStrokeAlpha   = parseAlphaFromColor(tStrokeColor);
  const tLetterSpacing = parseFloat(block.dataset.letterSpacing) || 0;
  const tTextAlign     = block.dataset.textAlign     || 'left';
  const tShadowOn      = block.dataset.shadowOn === '1';
  const tShadowX       = parseFloat(block.dataset.shadowX) || 0;
  const tShadowY       = parseFloat(block.dataset.shadowY) || 2;
  const tShadowBlur    = parseFloat(block.dataset.shadowBlur) || 4;
  const tShadowColor   = block.dataset.shadowColor   || 'rgba(0,0,0,0.4)';
  const tShadowAlpha   = parseAlphaFromColor(tShadowColor);
  const tRotation      = parseFloat(block.dataset.rotation) || 0;
  const tPadX = Number.isFinite(parseInt(block.dataset.padX)) ? parseInt(block.dataset.padX) : 10;
  const tPadY = Number.isFinite(parseInt(block.dataset.padY)) ? parseInt(block.dataset.padY) : 6;

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
    <div class="prop-section" id="stk-fav-section">
      <div class="prop-section-title-row" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <div class="prop-section-title" style="margin-bottom:0">Favorites (즐겨찾기)</div>
        <button class="prop-action-btn" id="stk-fav-add" title="현재 스티커 스타일을 즐겨찾기에 추가"
          style="width:auto;padding:2px 8px;font-size:12px;${FAV_ALLOWED_SHAPES.includes(shape) ? '' : 'opacity:0.4;cursor:not-allowed;'}">★ 추가</button>
      </div>
      <div class="stk-fav-grid" id="stk-fav-grid"></div>
    </div>
    <div class="prop-section" id="stk-icon-section" style="display:${isIcon ? 'block' : 'none'};">
      <div class="prop-section-title">Icon</div>
      <div class="prop-row">
        <button class="prop-action-btn secondary" id="stk-icon-replace" style="width:100%;">아이콘 교체</button>
      </div>
      <div class="prop-row">
        <span class="prop-label">크기</span>
        <input type="range" class="prop-slider" id="stk-icon-size" min="16" max="300" step="2" value="${parseInt(block.dataset.size) || 64}">
        <input type="number" class="prop-number" id="stk-icon-size-num" min="16" max="600" value="${parseInt(block.dataset.size) || 64}">
      </div>
      <div class="prop-row">
        <span class="prop-label">회전°</span>
        <input type="range" class="prop-slider" id="stk-icon-rot" min="-180" max="180" step="1" value="${parseFloat(block.dataset.rotation) || 0}">
        <input type="number" class="prop-number" id="stk-icon-rot-num" min="-180" max="180" step="1" value="${parseFloat(block.dataset.rotation) || 0}">
      </div>
      <div class="prop-color-row" style="margin-top:6px;">
        <span class="prop-label">색상</span>
        ${colorFieldHTML({ idPrefix: 'stk-icon-color', hex: (block.dataset.iconColor || '#222222'), alpha: parseAlphaFromColor(block.dataset.iconColor || '#222222') })}
      </div>
      <div class="prop-hint" style="font-size:11px;color:#888;margin-top:4px;">SVG가 currentColor를 쓰는 아이콘만 색상이 반영됩니다.</div>
    </div>
    <div class="prop-section" id="stk-mode-section" style="display:${hideBasic ? 'none' : 'block'};">
      <div class="prop-row">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:#ccc;">
          <input type="checkbox" id="stk-mode-img" ${block.dataset.mode === 'image' ? 'checked' : ''}>
          이미지 모드
        </label>
      </div>
    </div>
    <div class="prop-section" id="stk-text-section" style="display:${hideBasic ? 'none' : (block.dataset.mode === 'image' && !isText ? 'none' : 'block')};">
      <div class="prop-section-title">Text</div>
      <div class="prop-row">
        <input type="text" class="prop-input" id="stk-text" value="${_esc(text)}" placeholder="텍스트">
      </div>
    </div>
    <div class="prop-section" id="stk-image-section" style="display:${hideBasic ? 'none' : (block.dataset.mode === 'image' ? 'block' : 'none')};">
      <div class="prop-section-title">Image</div>
      <div id="stk-img-drop" style="border:2px dashed #444;border-radius:6px;padding:18px 10px;text-align:center;color:#888;font-size:12px;cursor:pointer;background:#1a1a1a;transition:border-color .15s,background .15s;">
        ${block.dataset.imgSrc ? `<img src="${block.dataset.imgSrc}" style="max-width:80px;max-height:80px;object-fit:contain;display:block;margin:0 auto 6px;">` : ''}
        <div>이미지 드래그앤드롭<br>또는 클릭해서 선택</div>
      </div>
      ${block.dataset.imgSrc ? `<div class="prop-row"><button class="prop-action-btn" id="stk-img-clear" style="width:100%;">이미지 제거</button></div>` : ''}
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
          <button class="prop-align-btn${isText ? ' active' : ''}" data-shape="text" title="텍스트 스티커">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 4 L13 4 M8 4 L8 13" stroke-linecap="round"/></svg>
          </button>
          <button class="prop-align-btn${isHl ? ' active' : ''}" data-shape="highlight" title="형광펜">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="6" width="12" height="5" rx="1" fill="rgba(255,235,70,0.85)"/></svg>
          </button>
          <button class="prop-align-btn${isHlB ? ' active' : ''}" data-shape="highlightB" title="선 형광펜">
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
    <div class="prop-section" id="stk-size-section" style="display:${hideBasic ? 'none' : 'block'};">
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
    <div class="prop-section" id="stk-colors-section" style="display:${hideBasic ? 'none' : 'block'};">
      <div class="prop-section-title">Colors</div>
      <div class="prop-color-row">
        <span class="prop-label">배경색</span>
        ${colorFieldHTML({ idPrefix: 'stk-bg', hex: bgColor, alpha: bgAlpha })}
      </div>
      <div class="prop-color-row">
        <span class="prop-label">글자색</span>
        ${colorFieldHTML({ idPrefix: 'stk-txt', hex: textColor, alpha: txtAlpha })}
      </div>
    </div>
    <div class="prop-section" id="stk-text-sticker-section" style="display:${isText ? 'block' : 'none'};">
      <div class="prop-section-title">Typography</div>
      <div class="prop-row">
        <span class="prop-label">폰트</span>
        <select class="prop-select" id="stk-t-ff">
          <option value="'Pretendard', sans-serif" ${tFontFamily.includes('Pretendard') ? 'selected' : ''}>Pretendard</option>
          <option value="'Noto Sans KR', sans-serif" ${tFontFamily.includes('Noto Sans KR') ? 'selected' : ''}>Noto Sans KR</option>
          <option value="'Noto Serif KR', serif" ${tFontFamily.includes('Noto Serif KR') ? 'selected' : ''}>Noto Serif KR</option>
          <option value="'Inter', sans-serif" ${tFontFamily.includes('Inter') ? 'selected' : ''}>Inter</option>
          <option value="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" ${tFontFamily.includes('-apple-system') ? 'selected' : ''}>System</option>
          <option value="sans-serif" ${tFontFamily === 'sans-serif' ? 'selected' : ''}>Sans-serif</option>
          <option value="serif" ${tFontFamily === 'serif' ? 'selected' : ''}>Serif</option>
          <option value="monospace" ${tFontFamily === 'monospace' ? 'selected' : ''}>Monospace</option>
        </select>
      </div>
      <div class="prop-row">
        <span class="prop-label">크기</span>
        <input type="range" class="prop-slider" id="stk-t-fs" min="8" max="200" step="1" value="${fontSize}">
        <input type="number" class="prop-number" id="stk-t-fs-num" min="8" max="400" value="${fontSize}">
      </div>
      <div class="prop-row">
        <span class="prop-label">굵기</span>
        <select class="prop-select" id="stk-t-fw">
          <option value="300" ${fontWeight === 300 ? 'selected' : ''}>Light</option>
          <option value="400" ${fontWeight === 400 ? 'selected' : ''}>Regular</option>
          <option value="500" ${fontWeight === 500 ? 'selected' : ''}>Medium</option>
          <option value="600" ${fontWeight === 600 ? 'selected' : ''}>Semibold</option>
          <option value="700" ${fontWeight === 700 ? 'selected' : ''}>Bold</option>
          <option value="800" ${fontWeight === 800 ? 'selected' : ''}>Extrabold</option>
          <option value="900" ${fontWeight === 900 ? 'selected' : ''}>Black</option>
        </select>
      </div>
      <div class="prop-row">
        <span class="prop-label">자간</span>
        <input type="range" class="prop-slider" id="stk-t-ls" min="-5" max="20" step="0.1" value="${tLetterSpacing}">
        <input type="number" class="prop-number" id="stk-t-ls-num" min="-10" max="40" step="0.1" value="${tLetterSpacing}">
      </div>
      <div class="prop-row">
        <span class="prop-label">정렬</span>
        <div class="prop-align-group" id="stk-t-align-group">
          <button class="prop-align-btn${tTextAlign === 'left' ? ' active' : ''}" data-align="left" title="왼쪽">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><line x1="2" y1="4" x2="14" y2="4"/><line x1="2" y1="8" x2="10" y2="8"/><line x1="2" y1="12" x2="12" y2="12"/></svg>
          </button>
          <button class="prop-align-btn${tTextAlign === 'center' ? ' active' : ''}" data-align="center" title="가운데">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><line x1="2" y1="4" x2="14" y2="4"/><line x1="4" y1="8" x2="12" y2="8"/><line x1="3" y1="12" x2="13" y2="12"/></svg>
          </button>
          <button class="prop-align-btn${tTextAlign === 'right' ? ' active' : ''}" data-align="right" title="오른쪽">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><line x1="2" y1="4" x2="14" y2="4"/><line x1="6" y1="8" x2="14" y2="8"/><line x1="4" y1="12" x2="14" y2="12"/></svg>
          </button>
        </div>
      </div>
    </div>
    <div class="prop-section" id="stk-text-presets-section" style="display:${isText ? 'block' : 'none'};">
      <div class="prop-section-title">Text Presets</div>
      <div class="stk-preset-grid" id="stk-preset-grid">
        ${TEXT_PRESETS.map((p, i) => `<button class="stk-preset-btn" data-preset-idx="${i}" type="button">${_esc(p.name)}</button>`).join('')}
      </div>
    </div>
    <div class="prop-section" id="stk-text-colors-section" style="display:${isText ? 'block' : 'none'};">
      <div class="prop-section-title">Colors</div>
      <div class="prop-color-row">
        <span class="prop-label">글자색</span>
        ${colorFieldHTML({ idPrefix: 'stk-t-color', hex: textColor, alpha: txtAlpha })}
      </div>
      <div class="prop-color-row">
        <span class="prop-label">배경색</span>
        ${colorFieldHTML({ idPrefix: 'stk-t-bg', hex: (bgColor === 'transparent' ? '#ffffff' : bgColor), alpha: (bgColor === 'transparent' ? 0 : bgAlpha) })}
      </div>
    </div>
    <div class="prop-section" id="stk-text-stroke-section" style="display:${isText ? 'block' : 'none'};">
      <div class="prop-section-title">Stroke (외곽선)</div>
      <div class="prop-row">
        <span class="prop-label">두께</span>
        <input type="range" class="prop-slider" id="stk-t-stk-w" min="0" max="20" step="0.5" value="${tStrokeWidth}">
        <input type="number" class="prop-number" id="stk-t-stk-w-num" min="0" max="50" step="0.5" value="${tStrokeWidth}">
      </div>
      <div class="prop-color-row">
        <span class="prop-label">색상</span>
        ${colorFieldHTML({ idPrefix: 'stk-t-stk-c', hex: tStrokeColor, alpha: tStrokeAlpha })}
      </div>
    </div>
    <div class="prop-section" id="stk-text-shadow-section" style="display:${isText ? 'block' : 'none'};">
      <div class="prop-section-title-row" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <div class="prop-section-title" style="margin-bottom:0">Shadow</div>
        <label class="prop-toggle" title="그림자 켜기/끄기" style="display:inline-flex;align-items:center;gap:4px">
          <input type="checkbox" id="stk-t-shadow-on" ${tShadowOn ? 'checked' : ''}>
          <span class="prop-toggle-track"></span>
        </label>
      </div>
      <div id="stk-t-shadow-detail">
        <div class="prop-row">
          <span class="prop-label">X</span>
          <input type="range" class="prop-slider" id="stk-t-sh-x" min="-20" max="20" step="1" value="${tShadowX}">
          <input type="number" class="prop-number" id="stk-t-sh-x-num" min="-20" max="20" step="1" value="${tShadowX}">
        </div>
        <div class="prop-row">
          <span class="prop-label">Y</span>
          <input type="range" class="prop-slider" id="stk-t-sh-y" min="-20" max="20" step="1" value="${tShadowY}">
          <input type="number" class="prop-number" id="stk-t-sh-y-num" min="-20" max="20" step="1" value="${tShadowY}">
        </div>
        <div class="prop-row">
          <span class="prop-label">Blur</span>
          <input type="range" class="prop-slider" id="stk-t-sh-b" min="0" max="40" step="1" value="${tShadowBlur}">
          <input type="number" class="prop-number" id="stk-t-sh-b-num" min="0" max="40" step="1" value="${tShadowBlur}">
        </div>
        <div class="prop-color-row">
          <span class="prop-label">색상</span>
          ${colorFieldHTML({ idPrefix: 'stk-t-sh-c', hex: tShadowColor, alpha: tShadowAlpha })}
        </div>
      </div>
    </div>
    <div class="prop-section" id="stk-text-pad-section" style="display:${isText ? 'block' : 'none'};">
      <div class="prop-section-title">Padding (박스 크기)</div>
      <div class="prop-row">
        <span class="prop-label">좌우</span>
        <input type="range" class="prop-slider" id="stk-t-pad-x" min="0" max="200" step="1" value="${tPadX}">
        <input type="number" class="prop-number" id="stk-t-pad-x-num" min="0" max="400" step="1" value="${tPadX}">
      </div>
      <div class="prop-row">
        <span class="prop-label">상하</span>
        <input type="range" class="prop-slider" id="stk-t-pad-y" min="0" max="200" step="1" value="${tPadY}">
        <input type="number" class="prop-number" id="stk-t-pad-y-num" min="0" max="400" step="1" value="${tPadY}">
      </div>
    </div>
    <div class="prop-section" id="stk-text-rot-section" style="display:${isText ? 'block' : 'none'};">
      <div class="prop-section-title">Rotation</div>
      <div class="prop-row">
        <span class="prop-label">회전°</span>
        <input type="range" class="prop-slider" id="stk-t-rot" min="-180" max="180" step="1" value="${tRotation}">
        <input type="number" class="prop-number" id="stk-t-rot-num" min="-180" max="180" step="1" value="${tRotation}">
      </div>
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);

  const rerender = () => { window.renderStickerBlock?.(block); window.rememberStickerStyle?.(block); };

  // 텍스트 — input에선 .sticker-text textContent만 직접 갱신(rerender 시 캐럿 보존 X)
  const txt = propPanel.querySelector('#stk-text');
  txt.addEventListener('input', () => {
    block.dataset.text = txt.value;
    const t = block.querySelector('.sticker-text');
    if (t) t.textContent = txt.value;
  });
  txt.addEventListener('change', () => { window.pushHistory?.('스티커 텍스트'); window.scheduleAutoSave?.(); });

  // 텍스트 스티커 — 폰트 패밀리
  propPanel.querySelector('#stk-t-ff')?.addEventListener('change', e => {
    block.dataset.fontFamily = e.target.value;
    rerender();
    window.pushHistory?.('텍스트 스티커 폰트'); window.scheduleAutoSave?.();
  });
  // 텍스트 스티커 — 폰트 굵기
  propPanel.querySelector('#stk-t-fw')?.addEventListener('change', e => {
    block.dataset.fontWeight = e.target.value;
    rerender();
    window.pushHistory?.('텍스트 스티커 굵기'); window.scheduleAutoSave?.();
  });
  // 텍스트 스티커 — 폰트 사이즈
  const _bindTPair = (sliderId, numberId, key, min, max, step) => {
    const s = propPanel.querySelector('#' + sliderId);
    const n = propPanel.querySelector('#' + numberId);
    if (!s || !n) return;
    const stepNum = step || 1;
    const apply = v => {
      v = Math.min(max, Math.max(min, v));
      block.dataset[key] = v;
      rerender();
      const sMax = parseFloat(s.max);
      const sMin = parseFloat(s.min);
      s.value = String(Math.min(sMax, Math.max(sMin, v)));
      n.value = String(v);
    };
    const parse = v => (stepNum < 1 ? parseFloat(v) : parseInt(v));
    s.addEventListener('input',  () => apply(parse(s.value)));
    n.addEventListener('change', () => { apply(parse(n.value)); window.pushHistory?.(); window.scheduleAutoSave?.(); });
    s.addEventListener('change', () => { window.pushHistory?.(); window.scheduleAutoSave?.(); });
  };
  _bindTPair('stk-t-fs',    'stk-t-fs-num',    'fontSize',      8,    400, 1);
  _bindTPair('stk-t-ls',    'stk-t-ls-num',    'letterSpacing', -10,  40,  0.1);
  _bindTPair('stk-t-stk-w', 'stk-t-stk-w-num', 'strokeWidth',   0,    50,  0.5);
  _bindTPair('stk-t-sh-x',  'stk-t-sh-x-num',  'shadowX',       -20,  20,  1);
  _bindTPair('stk-t-sh-y',  'stk-t-sh-y-num',  'shadowY',       -20,  20,  1);
  _bindTPair('stk-t-sh-b',  'stk-t-sh-b-num',  'shadowBlur',    0,    40,  1);
  _bindTPair('stk-t-rot',   'stk-t-rot-num',   'rotation',      -180, 180, 1);
  _bindTPair('stk-t-pad-x', 'stk-t-pad-x-num', 'padX',          0,    400, 1);
  _bindTPair('stk-t-pad-y', 'stk-t-pad-y-num', 'padY',          0,    400, 1);

  // 텍스트 스티커 — 정렬
  propPanel.querySelectorAll('#stk-t-align-group .prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      propPanel.querySelectorAll('#stk-t-align-group .prop-align-btn').forEach(b => b.classList.toggle('active', b === btn));
      block.dataset.textAlign = btn.dataset.align;
      rerender();
      window.pushHistory?.('텍스트 스티커 정렬'); window.scheduleAutoSave?.();
    });
  });

  // 텍스트 스티커 — 글자색
  wireColorField('stk-t-color', {
    initialAlpha: txtAlpha,
    onApply: (c) => { block.dataset.textColor = c; rerender(); },
    onCommit: () => { window.pushHistory?.('텍스트 스티커 글자색'); window.scheduleAutoSave?.(); },
  });
  // 텍스트 스티커 — 배경색 (alpha 0이면 transparent 저장)
  wireColorField('stk-t-bg', {
    initialAlpha: (bgColor === 'transparent' ? 0 : bgAlpha),
    onApply: (c) => {
      // 알파 0이거나 'rgba(...,0)' 패턴은 transparent로 저장 (renderer에서 깔끔하게 처리)
      const isFullyTransparent = /rgba?\([^)]*?,\s*0\s*\)/.test(c) || /,\s*0\s*\)/.test(c);
      block.dataset.bgColor = isFullyTransparent ? 'transparent' : c;
      rerender();
    },
    onCommit: () => { window.pushHistory?.('텍스트 스티커 배경'); window.scheduleAutoSave?.(); },
  });
  // 텍스트 스티커 — 외곽선 색
  wireColorField('stk-t-stk-c', {
    initialAlpha: tStrokeAlpha,
    onApply: (c) => { block.dataset.strokeColor = c; rerender(); },
    onCommit: () => { window.pushHistory?.('텍스트 스티커 외곽선'); window.scheduleAutoSave?.(); },
  });
  // 텍스트 스티커 — 그림자 on/off + 그림자 색
  propPanel.querySelector('#stk-t-shadow-on')?.addEventListener('change', e => {
    block.dataset.shadowOn = e.target.checked ? '1' : '0';
    rerender();
    window.pushHistory?.('텍스트 스티커 그림자'); window.scheduleAutoSave?.();
  });
  wireColorField('stk-t-sh-c', {
    initialAlpha: tShadowAlpha,
    onApply: (c) => { block.dataset.shadowColor = c; rerender(); },
    onCommit: () => { window.pushHistory?.('텍스트 스티커 그림자색'); window.scheduleAutoSave?.(); },
  });

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
      const newShape = btn.dataset.shape;
      const prevShape = block.dataset.shape;
      block.dataset.shape = newShape;
      const _isHl  = newShape === 'highlight';
      const _isHlB = newShape === 'highlightB';
      const _isTxt = newShape === 'text';
      const _isAnyHl = _isHl || _isHlB;

      // 'text' shape으로 전환 시 텍스트 스티커 dataset 초기화 (없으면)
      if (_isTxt) {
        if (!block.dataset.fontFamily)    block.dataset.fontFamily    = "'Pretendard', sans-serif";
        if (!block.dataset.fontSize || parseInt(block.dataset.fontSize) < 8) block.dataset.fontSize = 32;
        if (!block.dataset.fontWeight)    block.dataset.fontWeight    = 700;
        if (!block.dataset.textColor)     block.dataset.textColor     = '#222222';
        if (block.dataset.strokeWidth   === undefined) block.dataset.strokeWidth   = 0;
        if (!block.dataset.strokeColor)   block.dataset.strokeColor   = '#ffffff';
        if (block.dataset.letterSpacing === undefined) block.dataset.letterSpacing = 0;
        if (!block.dataset.textAlign)     block.dataset.textAlign     = 'left';
        if (!block.dataset.shadowOn)      block.dataset.shadowOn      = '0';
        if (block.dataset.shadowX === undefined) block.dataset.shadowX = 0;
        if (block.dataset.shadowY === undefined) block.dataset.shadowY = 2;
        if (block.dataset.shadowBlur === undefined) block.dataset.shadowBlur = 4;
        if (!block.dataset.shadowColor)   block.dataset.shadowColor   = 'rgba(0,0,0,0.4)';
        if (!block.dataset.bgColor || block.dataset.bgColor === '#e74c3c') block.dataset.bgColor = 'transparent';
        if (block.dataset.rotation === undefined) block.dataset.rotation = 0;
        if (!block.dataset.text || block.dataset.text === 'NEW') block.dataset.text = 'Text';
      }
      // text에서 다른 shape으로 갈 때 — text 잔존 transform 제거
      if (prevShape === 'text' && !_isTxt) {
        block.style.removeProperty('transform');
        block.style.removeProperty('transform-origin');
      }

      // 전체 패널 재렌더 (text/icon shape는 별도 섹션 구성이라 단순 토글로는 부족)
      if (_isTxt || prevShape === 'text' || newShape === 'icon' || prevShape === 'icon') {
        rerender();
        window.pushHistory?.('스티커 모양'); window.scheduleAutoSave?.();
        showStickerProperties(block);
        return;
      }

      const hlSec   = propPanel.querySelector('#stk-hl-section');
      const hlbSec  = propPanel.querySelector('#stk-hlb-section');
      const txtSec  = propPanel.querySelector('#stk-text-section');
      const imgSec  = propPanel.querySelector('#stk-image-section');
      const modeSec = propPanel.querySelector('#stk-mode-section');
      if (hlSec)  hlSec.style.display  = _isHl  ? 'block' : 'none';
      if (hlbSec) hlbSec.style.display = _isHlB ? 'block' : 'none';
      if (txtSec) txtSec.style.display = _isAnyHl ? 'none' : (block.dataset.mode === 'image' ? 'none' : 'block');
      if (imgSec) imgSec.style.display = _isAnyHl ? 'none' : (block.dataset.mode === 'image' ? 'block' : 'none');
      if (modeSec) modeSec.style.display = _isAnyHl ? 'none' : 'block';
      const sizeSec = propPanel.querySelector('#stk-size-section');
      const colSec  = propPanel.querySelector('#stk-colors-section');
      if (sizeSec) sizeSec.style.display = _isAnyHl ? 'none' : 'block';
      if (colSec)  colSec.style.display  = _isAnyHl ? 'none' : 'block';
      // highlightB로 전환 시 dataset 초기화 (없으면)
      if (_isHlB && !block.dataset.x1) {
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
  const bindNumPair = (sliderId, numberId, key, min, max, syncKeys) => {
    const s = propPanel.querySelector('#' + sliderId);
    const n = propPanel.querySelector('#' + numberId);
    const apply = v => {
      v = Math.min(max, Math.max(min, v));
      block.dataset[key] = v;
      // syncKeys: 함께 동일 값으로 맞출 dataset 키 (예: 코너 리사이즈가 박아둔 sizeW/sizeH를
      // 단일 size 슬라이더로 덮어써 균일 크기로 — 안 그러면 render가 sizeW/sizeH 우선해 슬라이더 무시됨)
      if (syncKeys) syncKeys.forEach(k => { block.dataset[k] = v; });
      rerender();
      s.value = Math.min(parseInt(s.max), v);
      n.value = v;
    };
    s.addEventListener('input',  () => apply(parseInt(s.value)));
    n.addEventListener('change', () => { apply(parseInt(n.value)); window.pushHistory?.(); window.scheduleAutoSave?.(); });
    s.addEventListener('change', () => { window.pushHistory?.(); window.scheduleAutoSave?.(); });
  };
  bindNumPair('stk-size', 'stk-size-num', 'size',     10, 600, ['sizeW', 'sizeH']);
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

  // ── U6(c): Favorites 그리드 렌더 + 이벤트 ──────────────────────────────────
  const _renderFavGrid = () => {
    const grid = propPanel.querySelector('#stk-fav-grid');
    if (!grid) return;
    const favs = listStickerFavorites();
    if (!favs.length) {
      grid.innerHTML = `<div class="stk-fav-empty">아직 즐겨찾기가 없습니다. ★ 추가를 눌러 현재 스타일을 저장하세요.</div>`;
      return;
    }
    grid.innerHTML = favs.map((p, i) => {
      const pv = _favSwatchPreview(p);
      const inner = pv.svg
        ? `<span style="width:18px;height:18px;display:flex;align-items:center;justify-content:center;color:${pv.color || 'inherit'};" class="stk-fav-icon"></span>`
        : (pv.label || '');
      return `<button class="stk-fav-swatch" data-fav-idx="${i}" type="button" title="${_esc(p.shape)} 스티커 추가"`
        + ` style="background:${pv.bg};color:${pv.color || '#fff'};">`
        + `${inner}<span class="stk-fav-del" data-fav-del="${i}" title="삭제">×</span></button>`;
    }).join('');
    // svg preview 주입 (innerHTML로 한 번에 못 넣음 — 따옴표 escape 회피)
    grid.querySelectorAll('.stk-fav-swatch').forEach((sw, i) => {
      const p = favs[i];
      if (p && p.shape === 'icon' && p.iconSvg) {
        const holder = sw.querySelector('.stk-fav-icon');
        if (holder) {
          holder.innerHTML = p.iconSvg;
          const svg = holder.querySelector('svg');
          if (svg) { svg.setAttribute('width', 18); svg.setAttribute('height', 18); svg.style.pointerEvents = 'none'; }
        }
      }
    });
    grid.querySelectorAll('.stk-fav-swatch').forEach(sw => {
      sw.addEventListener('click', (e) => {
        if (e.target.closest('.stk-fav-del')) return; // 삭제 버튼은 별도 처리
        const idx = parseInt(sw.dataset.favIdx);
        const preset = listStickerFavorites()[idx];
        if (preset) window.addStickerBlock?.({ ...preset });
      });
    });
    grid.querySelectorAll('.stk-fav-del').forEach(del => {
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        removeStickerFavorite(parseInt(del.dataset.favDel));
        _renderFavGrid();
      });
    });
  };
  _renderFavGrid();

  propPanel.querySelector('#stk-fav-add')?.addEventListener('click', () => {
    if (addStickerFavorite(block)) {
      window.showToast?.('★ 즐겨찾기에 추가됨');
      _renderFavGrid();
    }
  });

  // ── U6(d): Text Presets — text 내용 보존하고 스타일만 일괄 적용 ──────────────
  propPanel.querySelectorAll('#stk-preset-grid .stk-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = TEXT_PRESETS[parseInt(btn.dataset.presetIdx)];
      if (!preset) return;
      window.pushHistory?.('텍스트 스티커 프리셋');
      // text 내용(dataset.text)은 건드리지 않음 — 스타일 토큰만 덮어씀
      Object.entries(preset.style).forEach(([k, v]) => { block.dataset[k] = v; });
      rerender();
      window.scheduleAutoSave?.();
      showStickerProperties(block); // 패널 재렌더 (슬라이더/색상 동기화)
    });
  });

  // ── U6(e): Icon 섹션 — 교체 / 크기 / 회전 / 색상 ──────────────────────────────
  propPanel.querySelector('#stk-icon-replace')?.addEventListener('click', () => {
    window.openIconifyModal?.((p) => {
      window.pushHistory?.('아이콘 스티커 교체');
      block.dataset.iconName = p.name || '';
      block.dataset.iconSvg  = p.svg  || '';
      if (p.size) block.dataset.size = String(p.size);
      rerender();
      window.scheduleAutoSave?.();
      showStickerProperties(block);
    });
  });
  // icon size / rotation — _bindTPair 패턴 재사용 (rerender 기반)
  _bindTPair('stk-icon-size', 'stk-icon-size-num', 'size',     16,   600, 1);
  _bindTPair('stk-icon-rot',  'stk-icon-rot-num',  'rotation', -180, 180, 1);
  // icon color (currentColor SVG에 반영)
  wireColorField('stk-icon-color', {
    initialAlpha: parseAlphaFromColor(block.dataset.iconColor || '#222222'),
    onApply: (c) => { block.dataset.iconColor = c; rerender(); },
    onCommit: () => { window.pushHistory?.('아이콘 스티커 색'); window.scheduleAutoSave?.(); },
  });
}

window.showStickerProperties = showStickerProperties;
