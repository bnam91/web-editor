// ── Iconify Block ─────────────────────────────────────────────────────────────
// Iconify 아이콘 SVG를 단일 inline 블록으로 표시.
//
// 의존성:
//   - genId, showNoSelectionHint, insertAfterSelected (drag-utils.js)
//   - bindBlock (drag-drop.js)

import { genId, showNoSelectionHint, insertAfterSelected } from '../drag-utils.js';
import { bindBlock } from '../drag-drop.js';

function makeIconifyBlock(iconName = '', svgContent = '', size = 64) {
  const row   = document.createElement('div');
  row.className = 'row'; row.id = genId('row'); row.dataset.layout = 'stack';

  const block = document.createElement('div');
  block.className     = 'icon-block';
  block.dataset.type  = 'icon';
  block.id            = genId('icn');
  block.dataset.iconName  = iconName;
  block.dataset.size      = String(size);
  block.dataset.rotation  = '0';
  block.dataset.iconColor = '#000000';

  _applyIconifyBlockStyle(block, svgContent, size, 0);
  block.style.color = '#000000';

  row.appendChild(block);
  return { row, block };
}

function _applyIconifyBlockStyle(block, content, size, rotation) {
  block.style.cssText = `width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;cursor:pointer;box-sizing:content-box;`;
  if (rotation) block.style.transform = `rotate(${rotation}deg)`;
  // 래스터(PNG/JPG): 외부화된 goya-asset:// URL을 <img>로 렌더. currentColor 착색 불가 → 색 UI는 prop에서 비활성.
  // dataset에는 URL만 보관(data-URL 인라인 금지) — content 인자로 URL을 받고, 없으면 dataset.iconSrc 폴백.
  if (block.dataset.raster === '1') {
    const src = content || block.dataset.iconSrc || '';
    if (src) {
      const safe = String(src).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      block.innerHTML = `<img src="${safe}" width="${size}" height="${size}" style="width:${size}px;height:${size}px;object-fit:contain;display:block;pointer-events:none;" draggable="false" alt="">`;
    } else {
      block.innerHTML = _iconifyPlaceholderSvg(size);
    }
    return;
  }
  if (content) {
    block.innerHTML = content;
    const svg = block.querySelector('svg');
    if (svg) { svg.setAttribute('width', size); svg.setAttribute('height', size); svg.style.display = 'block'; }
  } else {
    block.innerHTML = _iconifyPlaceholderSvg(size);
  }
}

function _iconifyPlaceholderSvg(size) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#aaa" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
}

function addIconifyBlock(iconName, svgContent, size = 64) {
  // FRAMEICON: mockup(I5-F1) 패턴 미러. free-layout/fullWidth 프레임이면 _insertToFlowFrame이
  //   makeBlockFn을 자기가 1회 호출해 block을 absolute로 전환(free-layout) + frame 직속 append +
  //   pushHistory/bindBlock/buildLayerPanel까지 처리한다. 해당 안 되면 false 반환 → 아래 섹션-레벨
  //   flow 삽입으로 폴백. (기존 generic insertAfterSelected만 호출해서 free-layout 프레임 안 icon-block이
  //   flow .row에 남아 position!=='absolute' → bindBlock mousedown 가드에 걸려 드래그가 시작 안 됐음)
  let made = null; // _insertToFlowFrame 콜백이 만든 핸들 캡처 (MCP 반환 호환)
  if (window._insertToFlowFrame?.(() => (made = makeIconifyBlock(iconName, svgContent, size)))) {
    // _insertToFlowFrame이 pushHistory/bindBlock/buildLayerPanel을 자체 처리하므로 여기선 추가 호출 X.
    // (free-layout 경로는 row를 버리고 block만 frame에 append — MCP는 block.id만 사용)
    return made; // { row, block } (헬퍼가 makeBlockFn 결과를 그대로 캡처)
  }

  // ── 폴백: 일반 섹션 / 비-프레임 ──
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return null; }
  window.pushHistory();
  const { row, block } = makeIconifyBlock(iconName, svgContent, size);
  insertAfterSelected(sec, row);
  bindBlock(block);
  window.buildLayerPanel();
  window.selectSection(sec);
  // MCP/orchestrator가 blockId를 즉시 알 수 있도록 row/block 반환. 기존 패널 호출자는 반환값을 안 써서 호환.
  return { row, block };
}

// ── 수정 ──────────────────────────────────────────────────────────────────────
// PM의 update_iconify_block(MCP) → main(_invokeRendererUpdateIconifyBlock) → 여기.
// banner02 패턴 미러: pushHistory + before snapshot + dataset partial write + applied 추적 + 재렌더 + autosave.
// 지원 필드:
//   - layerName: 레이어 패널 표시명 (≤100자)
//   - size: 16~512 px, block.style.width/height + 내부 svg width/height 동기화
//   - rotation: '0'|'90'|'180'|'270' (deg). 0이면 transform 제거, 그 외 rotate(${deg}deg)
//   - iconColor: #hex|rgb(a)/hsl(a)|transparent. style.color로 currentColor SVG 색상 반영
//   - iconName: 'prefix:icon-name' 형식. 변경 시 새 SVG fetch 필요 — main에서 fetch한 svg를 함께 넘김
//   - svg: (내부 전용) main이 새 iconName으로 fetch한 SVG 문자열. 있으면 _applyIconifyBlockStyle 재렌더.
function updateIconifyBlock(blockId, partial = {}) {
  if (!blockId) return { ok: false, code: 'NOT_FOUND', message: 'blockId required' };
  const block = document.getElementById(String(blockId));
  if (!block || !block.classList.contains('icon-block')) {
    return { ok: false, code: 'NOT_FOUND', message: `icon-block not found: ${blockId}` };
  }
  if (partial == null || typeof partial !== 'object') {
    return { ok: false, code: 'INVALID', message: 'partial must be object' };
  }

  // 알 수 없는 키 차단 (오타 방지)
  const ALLOWED_KEYS = new Set(['layerName', 'size', 'rotation', 'iconColor', 'iconName', 'svg', 'src', 'raster']);
  for (const k of Object.keys(partial)) {
    if (!ALLOWED_KEYS.has(k)) {
      return { ok: false, code: 'INVALID', message: `unknown field: ${k}. allowed: ${[...ALLOWED_KEYS].join('|')}` };
    }
  }

  // 적어도 한 개 필드 — svg 단독은 의미 없으므로 dataset 변경 필드 1개 이상 요구
  const meaningfulKeys = ['layerName', 'size', 'rotation', 'iconColor', 'iconName', 'src'];
  const hasMeaningful = meaningfulKeys.some(k => partial[k] !== undefined);
  if (!hasMeaningful) {
    return { ok: false, code: 'INVALID', message: 'no fields to update — provide at least one of: ' + meaningfulKeys.join('|') };
  }

  // before 스냅샷 (mutate 전, undo 푸시 전)
  const before = {
    layerName: block.dataset.layerName || '',
    iconName:  block.dataset.iconName  || '',
    size:      block.dataset.size      || '',
    rotation:  block.dataset.rotation  || '0',
    iconColor: block.dataset.iconColor || '#000000',
  };

  // 입력 검증 (mutate 전에 모두 수행 — partial 적용 도중 실패 시 rollback 곤란)
  // 1) layerName
  let nextLayerName;
  if (partial.layerName !== undefined && partial.layerName !== null) {
    if (typeof partial.layerName !== 'string') {
      return { ok: false, code: 'INVALID', message: 'layerName must be string' };
    }
    if ([...partial.layerName].length > 100) {
      return { ok: false, code: 'INVALID', message: 'layerName too long (>100 code points)' };
    }
    nextLayerName = partial.layerName;
  }

  // 2) size
  let nextSize;
  if (partial.size !== undefined && partial.size !== null) {
    const n = Number(partial.size);
    if (!Number.isFinite(n)) return { ok: false, code: 'INVALID', message: 'size must be number' };
    if (n < 16 || n > 512)   return { ok: false, code: 'INVALID', message: 'size out of range [16,512]' };
    nextSize = Math.round(n);
  }

  // 3) rotation
  let nextRotation;
  if (partial.rotation !== undefined && partial.rotation !== null) {
    const r = String(partial.rotation);
    if (!['0', '90', '180', '270'].includes(r)) {
      return { ok: false, code: 'INVALID', message: `invalid rotation: ${r}. allowed: 0|90|180|270` };
    }
    nextRotation = r;
  }

  // 4) iconColor — banner02 _color 정규식 그대로
  let nextColor;
  if (partial.iconColor !== undefined && partial.iconColor !== null) {
    if (typeof partial.iconColor !== 'string') {
      return { ok: false, code: 'INVALID', message: 'iconColor must be string' };
    }
    const v = partial.iconColor.trim();
    if (v.length === 0) return { ok: false, code: 'INVALID', message: 'iconColor empty' };
    if (v.length > 64)  return { ok: false, code: 'INVALID', message: 'iconColor too long' };
    const ok =
      /^#[0-9a-fA-F]{3,8}$/.test(v) ||
      /^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$/.test(v) ||
      v === 'transparent';
    if (!ok) return { ok: false, code: 'INVALID', message: 'invalid iconColor (allowed: #hex | rgb(a)/hsl(a)() | transparent)' };
    nextColor = v;
  }

  // 5) iconName — 'prefix:icon-name' 형식. 실제 fetch는 main이 수행했고 svg가 함께 넘어와야 함.
  let nextIconName;
  if (partial.iconName !== undefined && partial.iconName !== null) {
    if (typeof partial.iconName !== 'string') {
      return { ok: false, code: 'INVALID', message: 'iconName must be string' };
    }
    if (partial.iconName.length > 120) {
      return { ok: false, code: 'INVALID', message: 'iconName too long (>120)' };
    }
    if (!partial.iconName.includes(':')) {
      return { ok: false, code: 'INVALID', message: 'iconName must be in "prefix:icon-name" form' };
    }
    nextIconName = partial.iconName;
  }

  // 6) svg (내부 전용 — main이 fetch한 결과). 검증은 main에서 끝남. 길이만 sanity check.
  let nextSvg;
  if (partial.svg !== undefined && partial.svg !== null) {
    if (typeof partial.svg !== 'string') {
      return { ok: false, code: 'INVALID', message: 'svg must be string' };
    }
    if (partial.svg.length > 3000000) {
      return { ok: false, code: 'TOO_LARGE', message: 'svg too long (>3MB)' };
    }
    nextSvg = partial.svg;
  }

  // 7) src (래스터 외부화 URL — goya-asset:// | http(s)://). ★data-URL 인라인 금지(외부화 경로 강제).
  let nextSrc;
  if (partial.src !== undefined && partial.src !== null) {
    if (typeof partial.src !== 'string') {
      return { ok: false, code: 'INVALID', message: 'src must be string' };
    }
    const s = partial.src.trim();
    if (s.length === 0) return { ok: false, code: 'INVALID', message: 'src empty' };
    if (s.length > 2048) return { ok: false, code: 'INVALID', message: 'src too long' };
    if (!/^(goya-asset:\/\/|https?:\/\/)/i.test(s)) {
      return { ok: false, code: 'INVALID', message: 'src must be goya-asset:// or http(s):// URL (data-URL 금지 — 외부화 경로 사용)' };
    }
    nextSrc = s;
  }

  // 8) raster (마커) — 래스터 렌더 분기 플래그. 명시 true일 때만 켠다.
  let nextRaster;
  if (partial.raster !== undefined && partial.raster !== null) {
    nextRaster = partial.raster === true || partial.raster === '1' || partial.raster === 1;
  }

  // iconName 변경했는데 svg도 src도 없으면 거절 — 벡터는 main fetch(svg), 래스터는 외부화(src)가 선행돼야 함.
  if (nextIconName !== undefined && nextSvg === undefined && nextSrc === undefined) {
    return { ok: false, code: 'INVALID', message: 'iconName change requires accompanying svg (vector) or src (raster)' };
  }

  // ── 모든 검증 통과 — 이제 변경 시작 ──
  window.pushHistory?.();

  const applied = {};

  if (nextLayerName !== undefined) {
    block.dataset.layerName = nextLayerName;
    applied.layerName = nextLayerName;
  }
  if (nextIconName !== undefined) {
    block.dataset.iconName = nextIconName;
    applied.iconName = nextIconName;
  }
  if (nextSize !== undefined) {
    block.dataset.size = String(nextSize);
    applied.size = nextSize;
  }
  if (nextRotation !== undefined) {
    block.dataset.rotation = nextRotation;
    applied.rotation = nextRotation;
  }
  if (nextColor !== undefined) {
    block.dataset.iconColor = nextColor;
    applied.iconColor = nextColor;
  }
  // 래스터 ↔ 벡터 표현 전환 — 한쪽을 켜면 다른 쪽 dataset을 정리해 렌더 분기가 어긋나지 않게 한다.
  if (nextSrc !== undefined || nextRaster === true) {
    block.dataset.raster = '1';
    if (nextSrc !== undefined) { block.dataset.iconSrc = nextSrc; applied.src = nextSrc; }
    delete block.dataset.iconSvg; // 벡터 잔재 제거
    applied.raster = true;
  }
  if (nextSvg !== undefined) {
    // 새 SVG(벡터)로 전환 — 래스터 마커/URL 정리
    delete block.dataset.raster;
    delete block.dataset.iconSrc;
  }

  // ── DOM 반영 ──
  // size/rotation/svg 중 하나라도 바뀌면 _applyIconifyBlockStyle 재호출 (svg 인자 우선, 없으면 현재 innerHTML 유지)
  const effectiveSize     = nextSize !== undefined ? nextSize : (parseInt(block.dataset.size, 10) || 64);
  const effectiveRotation = nextRotation !== undefined ? parseInt(nextRotation, 10) : (parseInt(block.dataset.rotation, 10) || 0);

  try {
    if (nextSvg !== undefined) {
      // 새 SVG로 완전 재렌더 (size/rotation 동시 반영)
      window._applyIconifyBlockStyle?.(block, nextSvg, effectiveSize, effectiveRotation);
    } else if (nextSrc !== undefined) {
      // 새 래스터 URL로 <img> 재렌더 (dataset.raster='1' 선반영됨 → _applyIconifyBlockStyle이 img 분기)
      window._applyIconifyBlockStyle?.(block, nextSrc, effectiveSize, effectiveRotation);
    } else if (nextSize !== undefined || nextRotation !== undefined) {
      // svg 변경 없이 size/rotation만 — 기존 svg DOM을 유지하면서 attr만 동기화 (innerHTML 재할당 비용 회피)
      block.style.width  = effectiveSize + 'px';
      block.style.height = effectiveSize + 'px';
      block.style.display = block.style.display || 'flex';
      block.style.alignItems     = block.style.alignItems     || 'center';
      block.style.justifyContent = block.style.justifyContent || 'center';
      block.style.boxSizing      = 'content-box';
      block.style.cursor         = block.style.cursor         || 'pointer';
      const svg = block.querySelector('svg');
      if (svg) {
        svg.setAttribute('width',  String(effectiveSize));
        svg.setAttribute('height', String(effectiveSize));
        svg.style.display = 'block';
      }
      const img = block.querySelector('img');
      if (img) {
        img.setAttribute('width',  String(effectiveSize));
        img.setAttribute('height', String(effectiveSize));
      }
      if (effectiveRotation) {
        block.style.transform = `rotate(${effectiveRotation}deg)`;
      } else {
        block.style.removeProperty('transform');
      }
    }
    // iconColor — currentColor SVG 색상 반영. svg 재렌더 후에도 적용 (재렌더된 SVG가 currentColor면 즉시 색 반영).
    if (nextColor !== undefined) {
      block.style.color = nextColor;
    }
  } catch (e) {
    return { ok: false, code: 'RENDER_ERROR', message: e.message };
  }

  // 레이어 패널 (layerName 변경 가능성 대비)
  try { window.buildLayerPanel?.(); } catch (_) {}

  // autosave
  try { (window.scheduleAutoSave || window.autosave)?.(); } catch (_) {}

  return { ok: true, blockId, before, applied };
}

// ── window 노출 ────────────────────────────────────────────────────────────
window.makeIconifyBlock = makeIconifyBlock;
window.addIconifyBlock  = addIconifyBlock;
window._applyIconifyBlockStyle = _applyIconifyBlockStyle;
window.updateIconifyBlock = updateIconifyBlock;

export { makeIconifyBlock, addIconifyBlock, updateIconifyBlock, _applyIconifyBlockStyle };
