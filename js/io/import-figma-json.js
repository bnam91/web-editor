/* ═══════════════════════════════════════════════════════════════
   FIGMA → EDITOR IMPORT
   Figma 플러그인이 내보낸 JSON을 에디터 섹션으로 변환해 삽입한다.
   섹션 단위로 임포트하며, rebindAll() 이후 완전히 활성화된다.
═══════════════════════════════════════════════════════════════ */
import { canvasEl, state } from '../globals.js';
import { sanitizeSvgString, SVG_MAX_LEN_CEIL } from '../util/sanitize-svg.js';
import { svgImportSize } from '../util/svg-import-size.js';

/* ── ID 생성 (drag-utils.genId와 동일 형식) ── */
function _genId(prefix) {
  return (prefix || 'b') + '_' + Math.random().toString(36).slice(2, 9);
}

/* ── 텍스트 fontSize → 에디터 variant 매핑 ──
   TEXT_DEFAULTS (export-figma-json.js 기준 역매핑)
   h1: 104  h2: 72  h3: 52  body: 36  caption/label: 26
*/
function _mapTextVariant(fontSize, fontWeight) {
  if (fontSize >= 90) return { cls: 'tb-h1', dataType: 'heading' };
  if (fontSize >= 60) return { cls: 'tb-h2', dataType: 'heading' };
  if (fontSize >= 44) return { cls: 'tb-h3', dataType: 'heading' };
  if (fontSize >= 30) return { cls: 'tb-body', dataType: 'body' };
  if (fontWeight >= 600) return { cls: 'tb-label', dataType: 'label' };
  return { cls: 'tb-caption', dataType: 'caption' };
}

/* ── 텍스트 블록 HTML ── */
function _buildTextBlockHTML(child) {
  const style = child.style || {};
  const fontSize   = style.fontSize   || 36;
  const fontWeight = style.fontWeight || 400;
  const color      = style.color      || '#111111';
  const textAlign  = style.textAlign  || 'left';
  const lineHeight = style.lineHeight || 1.6;
  const lsPx       = style.letterSpacing ? `letter-spacing:${style.letterSpacing}px;` : '';
  const fontFamily = style.fontFamily  ? `font-family:'${style.fontFamily}',sans-serif;` : '';

  const { cls, dataType } = _mapTextVariant(fontSize, fontWeight);
  const tbId = _genId('tb');

  return `<div class="text-block" data-type="${dataType}" id="${tbId}">` +
    `<div class="${cls}" style="font-size:${fontSize}px;font-weight:${fontWeight};` +
    `color:${color};line-height:${lineHeight};${lsPx}text-align:${textAlign};${fontFamily}" ` +
    `contenteditable="false">${_escapeHtml(child.text || '')}</div>` +
    `</div>`;
}

/* ── 에셋 블록 HTML ── */
function _buildAssetBlockHTML(child) {
  const abId  = _genId('ab');
  const h     = child.height || 780;
  const src   = child.imageData || '';
  const imgTag = src
    ? `<img src="${src}" style="width:100%;height:100%;object-fit:cover;pointer-events:none;">`
    : '';
  const hasCls = src ? ' has-image' : '';

  return `<div class="asset-block${hasCls}" id="${abId}" data-align="center"` +
    ` data-overlay="false" style="height:${h}px">` +
    `${imgTag}<div class="asset-overlay"></div>` +
    `</div>`;
}

/* ── VECTOR → 벡터 블럭 (t3-06 (A) · 현빈 결정 «가져와 쓰는» 수준) ──
   옛 길: VECTOR 도 _buildAssetBlockHTML = <img src=imageData> 로 굳었다(색·크기 손잡이 없음 · 플러그인 export_node_as_image 는 data: 머리 없는 base64 라 그대로면 깨진 그림).
   SVG 가 실려 오면(child.svg · imageData 가 data:image/svg+xml · mimeType image/svg+xml 인 맨 base64) 거르개를 지나 벡터 블럭으로. 그 밖(PNG 등·못 읽음)은 옛 그림 길 그대로.
   ★그리기는 여기서 안 한다 — innerHTML 자리는 renderVector 하나(vector-block.js) · importFigmaFrames 가 넣은 뒤 부른다. */
function _figmaVectorSvg(child) {
  if (typeof child.svg === 'string') return child.svg;
  const d = typeof child.imageData === 'string' ? child.imageData.trim() : '';
  const m = d.match(/^data:image\/svg\+xml(;[^,]*)?,(.*)$/is);
  const b64 = m ? (/;base64/i.test(m[1] || '') ? m[2] : null) : (child.mimeType === 'image/svg+xml' ? d : null);
  try {
    if (b64 !== null) return new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
    if (m) return decodeURIComponent(m[2]);
  } catch (_) { /* 못 읽으면 옛 그림 길 */ }
  return '';
}
function _buildVectorBlockHTML(child) {
  const clean = sanitizeSvgString(_figmaVectorSvg(child), { maxLen: SVG_MAX_LEN_CEIL });
  if (!clean) return '';
  const fit = svgImportSize(clean);
  const dim = (v, f) => (Number.isFinite(v) && v > 0 ? Math.min(4000, Math.max(10, Math.round(v))) : f);
  return `<div class="vector-block" data-type="vector" id="${_genId('vb')}" draggable="true"` +
    ` data-svg="${_escapeHtml(clean)}" data-color="#000000" data-w="${dim(child.width, fit.w)}" data-h="${dim(child.height, fit.h)}"` +
    ` data-layer-name="${_escapeHtml(child.name || 'Vector')}"><div class="vb-inner"></div></div>`;
}

/* ── Gap 블록 HTML ── */
function _buildGapHTML(h) {
  return `<div class="gap-block" data-type="gap" id="${_genId('gb')}" style="height:${h}px"></div>`;
}

/* ── 단일 블록 → HTML 디스패치 ── */
function _buildBlockHTML(child) {
  if (child.type === 'TEXT') return _buildTextBlockHTML(child);
  if (child.type === 'VECTOR') return _buildVectorBlockHTML(child) || _buildAssetBlockHTML(child);
  if (child.type === 'IMAGE') return _buildAssetBlockHTML(child);
  if (child.type === 'RECTANGLE') {
    if (child.children && child.children.length > 0) {
      // 텍스트 자식이 있는 사각형 → 텍스트로 대표
      return _buildTextBlockHTML(child.children[0]);
    }
    return _buildAssetBlockHTML(child);
  }
  return '';
}

/* ── Y 좌표 기준 행 그루핑 ──
   같은 행으로 인식하는 Y 허용 오차: 30px
*/
function _detectRows(children, frameWidth) {
  const sorted = [...children].sort((a, b) => (a.y || 0) - (b.y || 0));
  const rows = [];
  let curRow = [];
  let prevY  = null;
  const TOLERANCE = 30;

  for (const child of sorted) {
    const y = child.y || 0;
    if (prevY === null || Math.abs(y - prevY) <= TOLERANCE) {
      curRow.push(child);
    } else {
      if (curRow.length) rows.push(curRow);
      curRow = [child];
    }
    prevY = y;
  }
  if (curRow.length) rows.push(curRow);

  // 각 row에 col 너비 계산 (frameWidth 기준 %)
  return rows.map(rowChildren => {
    const total = rowChildren.reduce((s, c) => s + (c.width || frameWidth), 0);
    return rowChildren.map(c => ({
      child: c,
      widthPct: Math.round((c.width || frameWidth) / (total || frameWidth) * 100),
    }));
  });
}

/* ── 행 HTML (멀티 col 포함) ── */
function _buildRowHTML(rowDef) {
  const rowId = _genId('row');
  const layout = rowDef.length > 1 ? 'cols' : 'stack';
  const colsHTML = rowDef.map(({ child, widthPct }) => {
    const colId = _genId('col');
    const blockHTML = _buildBlockHTML(child);
    return `<div class="col" id="${colId}" data-width="${widthPct}">${blockHTML}</div>`;
  }).join('');
  return `<div class="row" id="${rowId}" data-layout="${layout}">${colsHTML}</div>`;
}

/* ── 프레임 하나 → section-block HTML ── */
export function convertFrameToSectionHTML(frame, index) {
  const secId   = _genId('sec');
  const bgColor = frame.background || '#ffffff';
  const secName = frame.name || `Section ${index + 1}`;
  const children = frame.children || [];

  // 행 그루핑 (Y 기준)
  const rowDefs = _detectRows(children, frame.width || 860);

  // 연속 행 사이 gap 삽입 (Y 간격 40px 이상)
  let innerHTML = '';
  let prevRowBottomY = null;
  const sorted = [...children].sort((a, b) => (a.y || 0) - (b.y || 0));

  for (const rowDef of rowDefs) {
    const firstChild = rowDef[0].child;
    const rowTopY    = firstChild.y || 0;
    if (prevRowBottomY !== null) {
      const gap = rowTopY - prevRowBottomY;
      if (gap >= 40) {
        innerHTML += _buildGapHTML(Math.min(gap, 200));
      }
    }
    innerHTML += _buildRowHTML(rowDef);
    const maxBottom = Math.max(...rowDef.map(({ child: c }) => (c.y || 0) + (c.height || 0)));
    prevRowBottomY = maxBottom;
  }

  return `<div class="section-block" id="${secId}" data-section="${index + 1}" ` +
    `data-name="${_escapeAttr(secName)}" style="background:${bgColor}">` +
    `<div class="section-hitzone"><span class="section-label">Section ${index + 1}</span></div>` +
    `<div class="section-toolbar">` +
    `</div>` +
    `<div class="section-inner">${innerHTML}</div>` +
    `</div>`;
}

/* ── JSON 유효성 검증 ── */
export function parseFigmaImportJSON(raw) {
  let data;
  try {
    data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    throw new Error('유효하지 않은 JSON 파일입니다.');
  }
  if (!data.frames || !Array.isArray(data.frames) || data.frames.length === 0) {
    throw new Error('frames 배열이 없거나 비어있습니다. Figma 플러그인 출력 형식을 확인하세요.');
  }
  return data;
}

/* ── 실제 임포트 실행 ──
   checked: 임포트할 frame 인덱스 배열 (없으면 전체)
*/
export function importFigmaFrames(frames, checked) {
  const targets = checked && checked.length > 0
    ? frames.filter((_, i) => checked.includes(i))
    : frames;

  // 기존 캔버스를 비우지 않고 섹션을 추가 (섹션 단위 임포트 원칙)
  const existingCount = canvasEl.querySelectorAll('.section-block').length;

  targets.forEach((frame, i) => {
    const html = convertFrameToSectionHTML(frame, existingCount + i);
    canvasEl.insertAdjacentHTML('beforeend', html);
  });
  /* t3-06 (A) — 들여온 벡터 블럭을 그린다(유일한 그리기 문 renderVector · 그 안에서 한 번 더 거른다) */
  [...canvasEl.querySelectorAll('.section-block')].slice(existingCount)
    .forEach((sec) => sec.querySelectorAll('.vector-block').forEach((b) => window.renderVector?.(b)));

  // 에디터 재바인딩
  if (window.rebindAll)       window.rebindAll();
  if (window.buildLayerPanel) window.buildLayerPanel();
  if (window.pushHistory)     window.pushHistory('Figma 가져오기');
  if (window.triggerAutoSave) window.triggerAutoSave();
}

/* ── 파일 선택 → 프리뷰 모달 ── */
export function openFigmaImportPreview(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  // 파일 input 초기화 (같은 파일 재선택 허용)
  event.target.value = '';

  const reader = new FileReader();
  reader.onload = e => {
    let data;
    try {
      data = parseFigmaImportJSON(e.target.result);
    } catch (err) {
      alert('Figma JSON 파싱 오류: ' + err.message);
      return;
    }

    // 임시 저장
    window._figmaImportData = data;

    // 모달 프레임 목록 렌더링
    const listEl = document.getElementById('figma-import-list');
    listEl.innerHTML = data.frames.map((f, i) => `
      <label class="figma-sec-row" style="cursor:pointer;">
        <input type="checkbox" class="figma-import-cb" data-idx="${i}" checked
          style="accent-color:var(--ui-accent-primary); cursor:pointer; flex-shrink:0;">
        <span style="flex:1; font-size:11px; color:#ccc; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${_escapeHtml(f.name || `Frame ${i+1}`)}</span>
        <span style="font-size:10px; color:#555; white-space:nowrap;">${f.width || 860}×${f.height || 780}</span>
      </label>`).join('');

    document.getElementById('figma-import-modal').style.display = 'flex';
  };
  reader.readAsText(file);
}

export function doFigmaImport() {
  const data = window._figmaImportData;
  if (!data) return;

  const checked = [...document.querySelectorAll('.figma-import-cb:checked')]
    .map(cb => parseInt(cb.dataset.idx));

  if (checked.length === 0) { alert('임포트할 프레임을 선택하세요.'); return; }

  closeFigmaImportModal();
  importFigmaFrames(data.frames, checked);
  delete window._figmaImportData;
}

export function closeFigmaImportModal() {
  document.getElementById('figma-import-modal').style.display = 'none';
}

/* ── 유틸 ── */
function _escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function _escapeAttr(str) {
  /* ★앰퍼샌드를 «맨 먼저» 덮는다 (T-049) — 빠지면 실체참조가 든 이름이 되돌려 읽힐 때
     한 겹 풀려 나온다. 순서를 뒤로 미루면 이미 만든 &quot; 를 또 덮어 이중이 된다. */
  return String(str).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/* ── window 노출 (inline onclick에서 접근) ── */
window.openFigmaImportPreview = openFigmaImportPreview;
window.doFigmaImport          = doFigmaImport;
window.closeFigmaImportModal  = closeFigmaImportModal;
