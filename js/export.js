/* ══════════════════════════════════════
   내보내기 (Export)
══════════════════════════════════════ */
async function exportSection(sec, format) {
  const fmt = format || 'png';

  // 클론을 transform 밖(body)에 배치해서 html2canvas가 부모 scale 영향 안 받게 함
  const clone = sec.cloneNode(true);
  const cloneLabel   = clone.querySelector('.section-label');
  const cloneToolbar = clone.querySelector('.section-toolbar');
  if (cloneLabel)   cloneLabel.remove();
  if (cloneToolbar) cloneToolbar.remove();
  clone.classList.remove('selected');
  clone.style.cssText += ';position:fixed;top:-99999px;left:0;width:' + CANVAS_W + 'px;margin:0;outline:none;';

  document.body.appendChild(clone);

  const secBg   = sec.style.background || sec.style.backgroundColor || '';
  const bgColor = (secBg && secBg !== 'transparent') ? secBg : (pageSettings.bg || '#ffffff');

  try {
    const canvas = await html2canvas(clone, {
      scale: 1,
      useCORS: true,
      backgroundColor: bgColor,
      logging: false,
    });

    const secList = [...canvasEl.querySelectorAll('.section-block')];
    const idx     = secList.indexOf(sec) + 1;
    const name    = (sec._name || `section-${String(idx).padStart(2,'0')}`).replace(/\s+/g, '-');

    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href = url;
      a.download = `${name}.${fmt}`;
      a.click();
      URL.revokeObjectURL(url);
    }, fmt === 'jpg' ? 'image/jpeg' : 'image/png', 0.95);

  } finally {
    document.body.removeChild(clone);
  }
}

async function exportAllSections(format) {
  const sections = [...canvasEl.querySelectorAll('.section-block')];
  for (const sec of sections) {
    await exportSection(sec, format);
    await new Promise(r => setTimeout(r, 300));
  }
}

/* ══════════════════════════════════════
   디자인 메타데이터 JSON 내보내기
══════════════════════════════════════ */
function exportDesignJSON() {
  let _uid = 0;
  const uid = prefix => `${prefix}_${String(++_uid).padStart(3, '0')}`;

  function rgbToHex(rgb) {
    if (!rgb || rgb === 'transparent' || rgb === '') return null;
    if (rgb.startsWith('#')) return rgb;
    const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return rgb;
    return '#' + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
  }

  // variant별 기본 fontFamily (CSS에서 선언된 값 — getComputedStyle 폴백 문제 방지)
  const VARIANT_FONT = {
    h1:      'Noto Sans KR',
    h2:      'Noto Sans KR',
    body:    'Noto Sans KR',
    caption: 'Noto Sans KR',
    label:   'Noto Sans KR',
  };

  function extractTextStyle(innerEl) {
    if (!innerEl) return {};
    const cs = getComputedStyle(innerEl);
    const fsz = parseFloat(cs.fontSize);
    const lhRaw = parseFloat(cs.lineHeight);
    const lh = !isNaN(lhRaw) && !isNaN(fsz) && fsz > 0
      ? Math.round((lhRaw / fsz) * 100) / 100
      : null;

    // inline style에 fontFamily가 지정돼 있으면 그것 우선, 아니면 variant 기본값
    const inlineFF = innerEl.style.fontFamily;
    const variant  = (innerEl.className || '').replace('tb-', '');
    const fontFamily = inlineFF
      ? inlineFF.split(',')[0].replace(/["']/g, '').trim()
      : (VARIANT_FONT[variant] || 'Noto Sans KR');

    const style = {
      fontSize:   fsz,
      fontWeight: parseInt(cs.fontWeight),
      color:      rgbToHex(cs.color) || cs.color,
      fontFamily,
      textAlign:  cs.textAlign,
    };
    if (lh !== null) style.lineHeight = lh;
    if (cs.letterSpacing && cs.letterSpacing !== 'normal' && cs.letterSpacing !== '0px') {
      style.letterSpacing = cs.letterSpacing;
    }
    return style;
  }

  function serializeBlock(el) {
    if (el.classList.contains('gap-block')) {
      const h = parseFloat(el.style.height) || 50;
      return { id: uid('gap'), type: 'gap', height: h };
    }

    if (el.classList.contains('text-block')) {
      const inner = el.querySelector('.tb-h1, .tb-h2, .tb-body, .tb-caption, .tb-label');
      const variant = inner ? inner.className.replace('tb-', '') : (el.dataset.type || 'body');
      return {
        id:      uid('txt'),
        type:    'text',
        variant,
        content: inner ? inner.textContent.trim() : '',
        style:   extractTextStyle(inner),
        padding: {
          top:    parseFloat(el.style.paddingTop)    || 0,
          right:  parseFloat(el.style.paddingRight)  || 0,
          bottom: parseFloat(el.style.paddingBottom) || 0,
          left:   parseFloat(el.style.paddingLeft)   || 0,
        },
      };
    }

    if (el.classList.contains('asset-block')) {
      const block = {
        id:    uid('img'),
        type:  'image',
        style: {
          borderRadius: parseFloat(el.style.borderRadius) || 0,
        },
      };
      const h = parseFloat(el.style.height) || 400; // 기본값 400px
      block.height = h;
      if (el.dataset.imgSrc) {
        block.src        = el.dataset.imgSrc;
        block.fit        = el.dataset.fit || 'cover';
        if (el.dataset.imgW) block.imageScale = parseFloat(el.dataset.imgW);
        if (el.dataset.imgX) block.offsetX    = parseFloat(el.dataset.imgX);
        if (el.dataset.imgY) block.offsetY    = parseFloat(el.dataset.imgY);
      }
      return block;
    }
    return null;
  }

  function serializeCol(colEl) {
    const blocks = [];
    colEl.querySelectorAll(':scope > .text-block, :scope > .asset-block, :scope > .gap-block').forEach(b => {
      const s = serializeBlock(b);
      if (s) blocks.push(s);
    });
    return { id: uid('col'), width: parseInt(colEl.dataset.width) || 100, blocks };
  }

  function serializeRow(rowEl) {
    const cols = [];
    rowEl.querySelectorAll(':scope > .col').forEach(col => cols.push(serializeCol(col)));
    return { id: uid('row'), type: 'row', layout: rowEl.dataset.layout || 'stack', columns: cols };
  }

  function serializeSection(secEl, idx) {
    const rawBg = secEl.style.background || secEl.style.backgroundColor || '';
    const bg    = rgbToHex(rawBg) || pageSettings.bg || '#ffffff';
    const inner = secEl.querySelector('.section-inner');
    const blocks = [];

    if (inner) {
      [...inner.children].forEach(child => {
        if (child.classList.contains('gap-block')) {
          blocks.push(serializeBlock(child));
        } else if (child.classList.contains('row')) {
          blocks.push(serializeRow(child));
        } else if (child.classList.contains('group-block')) {
          const groupRows = [];
          child.querySelectorAll(':scope > .group-inner > .row').forEach(r => groupRows.push(serializeRow(r)));
          blocks.push({
            id:   uid('grp'),
            type: 'group',
            name: child.dataset.name || 'Group',
            rows: groupRows,
          });
        }
      });
    }

    const result = {
      id:         uid('sec'),
      name:       secEl._name || secEl.dataset.name || `Section ${idx + 1}`,
      background: bg,
      blocks,
    };
    if (secEl.dataset.preset) result.stylePreset = secEl.dataset.preset;
    return result;
  }

  const sections = [];
  canvasEl.querySelectorAll(':scope > .section-block').forEach((sec, i) => {
    sections.push(serializeSection(sec, i));
  });

  const output = {
    schema: 'sangpe-design-v1',
    meta: {
      exportedAt:  new Date().toISOString().split('T')[0],
      canvasWidth: CANVAS_W,
      theme: {
        background:  pageSettings.bg  || '#ffffff',
        fontFamily:  'Noto Sans KR',
        sectionGap:  pageSettings.gap  ?? 0,
        paddingX:    pageSettings.padX ?? 0,
        paddingY:    pageSettings.padY ?? 0,
      },
    },
    sections,
  };

  const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'design-export.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ══════════════════════════════════════
   피그마 JSON 내보내기
══════════════════════════════════════ */
function exportFigmaJSON() {
  // 현재 페이지를 pages 배열에 반영
  flushCurrentPage();

  const parser = new DOMParser();

  function parseHeight(el) {
    return parseFloat(el.style.height) || 0;
  }

  function parseBlock(el, ps) {
    // gap-block
    if (el.classList.contains('gap-block')) {
      return { type: 'gap', height: parseHeight(el) || 50 };
    }

    // text-block
    if (el.classList.contains('text-block')) {
      const inner = el.querySelector('.tb-h1, .tb-h2, .tb-body, .tb-caption, .tb-label');
      if (!inner) return null;
      const cls = inner.className;
      const text = inner.textContent.trim();

      // letterSpacing: inline style px 문자열 → 숫자
      let letterSpacing;
      const lsRaw = inner.style.letterSpacing;
      if (lsRaw && lsRaw !== 'normal') {
        const lsVal = parseFloat(lsRaw);
        if (!isNaN(lsVal)) letterSpacing = lsVal;
      }

      // padding (pageSettings.padX fallback)
      const padX = ps ? (ps.padX || 0) : 0;
      const padding = {
        top:    parseFloat(el.style.paddingTop)    || 0,
        right:  parseFloat(el.style.paddingRight)  || padX,
        bottom: parseFloat(el.style.paddingBottom) || 0,
        left:   parseFloat(el.style.paddingLeft)   || padX,
      };

      const base = {
        text,
        padding,
        ...(letterSpacing !== undefined ? { letterSpacing } : {}),
      };

      if (cls.includes('tb-h1')) return { type: 'heading', tag: 'h1', ...base };
      if (cls.includes('tb-h2')) return { type: 'heading', tag: 'h2', ...base };
      if (cls.includes('tb-body'))    return { type: 'body',    ...base };
      if (cls.includes('tb-caption')) return { type: 'caption', ...base };
      if (cls.includes('tb-label'))   return { type: 'label',   ...base };
      return { type: 'body', ...base };
    }

    // asset-block
    if (el.classList.contains('asset-block')) {
      const h = parseHeight(el) || 400;
      const src = el.dataset.imgSrc || null;
      const padX = ps ? (ps.padX || 0) : 0;
      const padding = {
        top:    parseFloat(el.style.paddingTop)    || 0,
        right:  parseFloat(el.style.paddingRight)  || padX,
        bottom: parseFloat(el.style.paddingBottom) || 0,
        left:   parseFloat(el.style.paddingLeft)   || padX,
      };
      // col width는 parseCol에서 주입
      return { type: 'asset', src, height: h, padding };
    }

    return null;
  }

  function parseCol(colEl, ps) {
    const width = parseInt(colEl.dataset.width) || 100;
    const blocks = [];
    colEl.querySelectorAll(':scope > .text-block, :scope > .asset-block, :scope > .gap-block').forEach(b => {
      const block = parseBlock(b, ps);
      if (block) {
        if (block.type === 'asset') block.width = width;
        blocks.push(block);
      }
    });
    return { width, blocks };
  }

  function parseRow(rowEl, ps) {
    const layout = rowEl.dataset.layout || 'stack';
    const cols = [];
    rowEl.querySelectorAll(':scope > .col').forEach(c => cols.push(parseCol(c, ps)));
    return { layout, cols };
  }

  function parseSection(secEl, idx, ps) {
    const inner = secEl.querySelector('.section-inner');
    const rows = [];
    if (inner) {
      [...inner.children].forEach(child => {
        if (child.classList.contains('row')) {
          rows.push(parseRow(child, ps));
        } else if (child.classList.contains('group-block')) {
          child.querySelectorAll(':scope > .group-inner > .row').forEach(r => rows.push(parseRow(r, ps)));
        } else if (child.classList.contains('gap-block')) {
          const h = parseFloat(child.style.height) || 50;
          rows.push({ layout: 'stack', cols: [{ width: 100, blocks: [{ type: 'gap', height: h }] }] });
        }
      });
    }
    // 빈 blocks 배열 rows 제거
    const filteredRows = rows.filter(r => r.cols.some(c => c.blocks.length > 0));

    const name = secEl.dataset.name || secEl._name
      || secEl.querySelector('.section-label')?.textContent?.trim()
      || `Section ${idx + 1}`;
    const bg = secEl.style.backgroundColor || secEl.style.background || '';

    return { index: idx + 1, name, bg, rows: filteredRows };
  }

  function parsePage(page) {
    const doc = parser.parseFromString(
      `<div id="canvas">${page.canvas || ''}</div>`, 'text/html'
    );
    const canvasDiv = doc.getElementById('canvas');
    const ps = page.pageSettings || {};
    const sections = [];
    canvasDiv.querySelectorAll(':scope > .section-block').forEach((sec, i) => {
      sections.push(parseSection(sec, i, ps));
    });
    return {
      name:     page.name  || 'Page',
      label:    page.label || '',
      bg:       (ps.bg)    || '#ffffff',
      sections,
    };
  }

  const exportPages = pages.map(p => parsePage(p));

  const output = {
    source:  'sangpe-wizard',
    version: 1,
    pages:   exportPages,
  };

  const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'sangpe_export.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportHTMLFile() {
  // canvas clone — 에디터 UI 요소 제거
  const clone = canvasEl.cloneNode(true);
  clone.querySelectorAll('.section-label, .section-toolbar, .col-placeholder, .col-add-btn, .col-add-menu, .row-drop-indicator, .layer-section-drop-indicator').forEach(el => el.remove());
  clone.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
  clone.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
  clone.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));

  const fontLink = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;700&family=Noto+Serif+KR:wght@400;600;700&family=Inter:wght@400;600;700&family=Playfair+Display:wght@400;700&family=Space+Grotesk:wght@400;600;700&display=swap" rel="stylesheet">`;

  const bg = pageSettings.bg || '#ffffff';
  const css = `
*{box-sizing:border-box;margin:0;padding:0;}
body{background:${bg};font-family:'Noto Sans KR',sans-serif;}
#canvas{width:${CANVAS_W}px;margin:0 auto;}
/* layout */
.section-block{position:relative;width:100%;}
.section-inner{display:flex;flex-direction:column;}
.row{position:relative;display:flex;width:100%;}
.row[data-layout="stack"]{flex-direction:column;}
.row[data-layout="flex"]{flex-direction:row;gap:8px;align-items:stretch;}
.row[data-layout="grid"]{display:grid;gap:8px;}
.col{position:relative;min-width:0;display:flex;flex-direction:column;}
.col[data-width="100"]{flex:100;}
.col[data-width="75"]{flex:75;}
.col[data-width="66"]{flex:66;}
.col[data-width="50"]{flex:50;}
.col[data-width="33"]{flex:33;}
.col[data-width="25"]{flex:25;}
/* gap */
.gap-block{display:block;width:100%;}
/* text */
.text-block{width:100%;}
.tb-h1{font-size:104px;font-weight:700;color:#111;line-height:1.1;letter-spacing:-0.02em;}
.tb-h2{font-size:72px;font-weight:600;color:#1a1a1a;line-height:1.15;}
.tb-body{font-size:36px;color:#555;line-height:1.6;}
.tb-caption{font-size:26px;color:#999;line-height:1.6;letter-spacing:0.01em;}
.tb-label{display:inline-block;background:#111;color:#fff;font-size:22px;font-weight:600;padding:6px 18px;border-radius:4px;}
/* asset */
.asset-block{width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;position:relative;}
.asset-block .asset-icon,.asset-block .asset-label{display:none;}
.asset-block.has-image{overflow:hidden;}
.asset-block.has-image img{display:block;max-width:100%;height:auto;}
/* group */
.group-block{width:100%;}
.group-inner{display:flex;flex-direction:column;}
`;

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Export</title>
${fontLink}
<style>${css}</style>
</head>
<body>
<div id="canvas">
${clone.innerHTML}
</div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'export.html';
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ── Publish Dropdown ── */
function togglePublishDropdown(e) {
  e.stopPropagation();
  document.getElementById('publish-dropdown-wrap').classList.toggle('open');
}
function closePublishDropdown() {
  document.getElementById('publish-dropdown-wrap').classList.remove('open');
}
function doPublish() {
  closePublishDropdown();
  alert('Publish 기능은 준비 중입니다.');
}
document.addEventListener('click', e => {
  if (!e.target.closest('#publish-dropdown-wrap')) closePublishDropdown();
});

/* 레이어 패널 — 섹션 순서 변경 */
const layerPanelBody = document.getElementById('layer-panel-body');
layerPanelBody.addEventListener('dragover', e => {
  if (!layerSectionDragSrc) return;
  e.preventDefault();
  clearLayerSectionIndicators();
  const after = getLayerSectionDragAfterEl(layerPanelBody, e.clientY);
  const indicator = document.createElement('div');
  indicator.className = 'layer-section-drop-indicator';
  if (after) layerPanelBody.insertBefore(indicator, after);
  else layerPanelBody.appendChild(indicator);
});
layerPanelBody.addEventListener('dragleave', e => {
  if (!layerSectionDragSrc) return;
  if (!layerPanelBody.contains(e.relatedTarget)) clearLayerSectionIndicators();
});
layerPanelBody.addEventListener('drop', e => {
  if (!layerSectionDragSrc) return;
  e.preventDefault();
  const { sec } = layerSectionDragSrc;
  const indicator = layerPanelBody.querySelector('.layer-section-drop-indicator');
  if (indicator) {
    const nextLayerSec = indicator.nextElementSibling;
    if (nextLayerSec && nextLayerSec._canvasSec) {
      canvasEl.insertBefore(sec, nextLayerSec._canvasSec);
    } else {
      canvasEl.appendChild(sec);
    }
  }
  clearLayerSectionIndicators();
  buildLayerPanel();
  layerSectionDragSrc = null;
});

/* ── Figma 업로드 ── */

/**
 * 모달 열기 — 섹션 목록 체크박스 렌더링 + node_map 로드
 */
async function openFigmaUploadModal() {
  closePublishDropdown();
  document.getElementById('figma-upload-modal').style.display = 'flex';
  const input = document.getElementById('figma-channel-input');
  input.value = localStorage.getItem('figma-last-channel') || '';

  // 섹션 목록 빌드
  await _buildFigmaSectionList();
  input.focus();
}

/**
 * 모든 페이지의 섹션 목록을 구해서 체크박스 리스트 렌더링
 * node_map 로드 후 이미 업로드된 섹션엔 "업데이트" 배지 표시
 */
async function _buildFigmaSectionList() {
  flushCurrentPage();

  const nodeMap = (window.electronAPI?.readNodeMap)
    ? (await window.electronAPI.readNodeMap() || {})
    : {};

  const listEl = document.getElementById('figma-section-list');
  listEl.innerHTML = '';

  const parser = new DOMParser();
  pages.forEach((pg, pgIdx) => {
    const doc = parser.parseFromString(`<div id="c">${pg.canvas || ''}</div>`, 'text/html');
    doc.querySelectorAll('#c > .section-block').forEach((sec, secIdx) => {
      const id   = sec.id || '';
      const name = sec.dataset.name
        || sec.querySelector('.section-label')?.textContent?.trim()
        || `Section ${secIdx + 1}`;
      const isSynced = !!nodeMap[id]?.figmaId;
      const pageLabel = pages.length > 1 ? ` <span style="color:#555;">[${pg.name || `P${pgIdx + 1}`}]</span>` : '';

      const row = document.createElement('label');
      row.className = 'figma-sec-row';
      row.innerHTML = `
        <input type="checkbox" class="figma-sec-cb" data-sec-id="${id}" checked
          style="accent-color:#2563eb; cursor:pointer; flex-shrink:0;" />
        <span style="font-size:11px; color:#ccc; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"
          title="${name}">${name}${pageLabel}</span>
        <span class="figma-sec-badge ${isSynced ? 'synced' : 'new'}">${isSynced ? '✓ 업데이트' : '새 업로드'}</span>
      `;
      listEl.appendChild(row);
    });
  });

  // 전체 선택 체크박스 상태 동기화
  document.getElementById('figma-select-all').checked = true;

  // 개별 체크박스 변경 시 전체 선택 상태 업데이트
  listEl.querySelectorAll('.figma-sec-cb').forEach(cb => {
    cb.addEventListener('change', _syncFigmaSelectAll);
  });
}

function _syncFigmaSelectAll() {
  const all  = [...document.querySelectorAll('.figma-sec-cb')];
  const checked = all.filter(c => c.checked);
  const selectAll = document.getElementById('figma-select-all');
  selectAll.indeterminate = checked.length > 0 && checked.length < all.length;
  selectAll.checked = checked.length === all.length;
}

function toggleFigmaSelectAll(checked) {
  document.querySelectorAll('.figma-sec-cb').forEach(cb => { cb.checked = checked; });
  const selectAll = document.getElementById('figma-select-all');
  selectAll.indeterminate = false;
  selectAll.checked = checked;
}

function closeFigmaUploadModal() {
  document.getElementById('figma-upload-modal').style.display = 'none';
  document.getElementById('figma-upload-log').style.display     = 'none';
  document.getElementById('figma-upload-spinner').style.display = 'none';
  const btn       = document.getElementById('figma-upload-btn');
  const cancelBtn = document.getElementById('figma-cancel-btn');
  btn.style.display      = '';
  btn.disabled           = false;
  cancelBtn.disabled     = false;
  cancelBtn.textContent  = '취소';
  cancelBtn.style.color  = '';
}

async function doFigmaUpload() {
  const channel = document.getElementById('figma-channel-input').value.trim();
  if (!channel) { alert('채널 ID를 입력해주세요.'); return; }
  localStorage.setItem('figma-last-channel', channel);

  // 선택된 섹션 ID 수집
  const selectedIds = [...document.querySelectorAll('.figma-sec-cb:checked')].map(cb => cb.dataset.secId);
  if (selectedIds.length === 0) { alert('업로드할 섹션을 선택해주세요.'); return; }

  const logEl     = document.getElementById('figma-upload-log');
  const spinnerEl = document.getElementById('figma-upload-spinner');
  const btn       = document.getElementById('figma-upload-btn');
  const cancelBtn = document.getElementById('figma-cancel-btn');

  logEl.style.display     = 'none';
  spinnerEl.style.display = 'flex';
  btn.disabled    = true;
  cancelBtn.disabled = true;

  // node_map 로드 → 선택 섹션에 figmaId / figmaY 주입
  const nodeMap = (window.electronAPI?.readNodeMap)
    ? (await window.electronAPI.readNodeMap() || {})
    : {};

  flushCurrentPage();
  const designJSON = buildFigmaExportJSON(selectedIds, nodeMap);

  function showDone(success, text) {
    spinnerEl.style.display = 'none';
    logEl.style.display     = 'block';
    logEl.textContent = text;
    logEl.style.color = success ? '#4ade80' : '#f87171';
    btn.style.display    = 'none';
    cancelBtn.disabled   = false;
    cancelBtn.textContent = '닫기';
    cancelBtn.style.color = '#e0e0e0';
  }

  try {
    const result = await window.electronAPI.figmaUpload(channel, designJSON);

    // SECTION_MAP 라인 파싱 → node_map 갱신
    if (result.success && result.logs) {
      const updatedMap = { ...nodeMap };
      for (const line of result.logs.split('\n')) {
        if (!line.startsWith('SECTION_MAP:')) continue;
        try {
          const entry = JSON.parse(line.slice('SECTION_MAP:'.length));
          if (entry.id) {
            updatedMap[entry.id] = { figmaId: entry.figmaId, y: entry.y, height: entry.height, name: entry.name, updatedAt: new Date().toISOString().split('T')[0] };
          }
        } catch {}
      }
      if (window.electronAPI?.writeNodeMap) {
        await window.electronAPI.writeNodeMap(updatedMap);
      }
    }

    showDone(result.success, result.logs || (result.success ? '✅ 완료!' : '❌ 실패'));
  } catch (e) {
    showDone(false, '❌ 오류: ' + e.message);
  }
}

/**
 * @param {string[]|null} selectedIds  업로드할 섹션 DOM ID 배열. null 이면 전체
 * @param {Object}        nodeMap      섹션ID → { figmaId, y } 매핑 (업데이트 모드용)
 */
function buildFigmaExportJSON(selectedIds, nodeMap) {
  // sangpe_to_figma.mjs 가 기대하는 포맷으로 빌드
  // sections[].blocks[] — gap / text / image / { columns:[{width,blocks}] }

  // CSS 클래스 기본값 (editor.css 기준)
  const TEXT_DEFAULTS = {
    'tb-h1':      { fontSize: 104, fontWeight: 700, color: '#111111', lineHeight: 1.1,  letterSpacing: -2.08 },
    'tb-h2':      { fontSize: 72,  fontWeight: 600, color: '#111111', lineHeight: 1.15, letterSpacing: 0 },
    'tb-body':    { fontSize: 36,  fontWeight: 400, color: '#111111', lineHeight: 1.6,  letterSpacing: 0 },
    'tb-caption': { fontSize: 26,  fontWeight: 400, color: '#111111', lineHeight: 1.6,  letterSpacing: 0.26 },
    'tb-label':   { fontSize: 26,  fontWeight: 700, color: '#111111', lineHeight: 1.4,  letterSpacing: 1.56 },
  };

  function _getTextStyle(inner, el) {
    const cls = [...inner.classList].find(c => TEXT_DEFAULTS[c]) || 'tb-body';
    const def = TEXT_DEFAULTS[cls] || TEXT_DEFAULTS['tb-body'];

    // 인라인 스타일 우선, 없으면 CSS 기본값
    const fontSize   = parseFloat(inner.style.fontSize)   || def.fontSize;
    const fontWeight = parseInt(inner.style.fontWeight)   || def.fontWeight;
    const lsRaw      = parseFloat(inner.style.letterSpacing);
    const letterSpacing = isNaN(lsRaw) ? def.letterSpacing : lsRaw;

    // color: inline → computed (live DOM) → 기본값
    let color = inner.style.color;
    if (!color) {
      try { color = window.getComputedStyle(inner).color; } catch {}
    }
    if (!color || color.startsWith('var(')) color = def.color;

    // lineHeight
    let lineHeight = def.lineHeight;
    if (inner.style.lineHeight) {
      const lh = parseFloat(inner.style.lineHeight);
      if (!isNaN(lh)) lineHeight = lh > 10 ? lh / fontSize : lh;
    }

    const textAlign = el.style.textAlign || inner.style.textAlign || 'left';

    // fontFamily: 인라인 우선, 없으면 CSS 기본값
    let fontFamily = inner.style.fontFamily;
    if (!fontFamily) {
      try { fontFamily = window.getComputedStyle(inner).fontFamily; } catch {}
    }
    fontFamily = (fontFamily || 'Noto Sans KR').replace(/["']/g, '').split(',')[0].trim();

    return { fontSize, fontWeight, color, lineHeight, letterSpacing, textAlign, fontFamily };
  }

  function _block(el, ps) {
    if (el.classList.contains('gap-block')) {
      return { type: 'gap', height: parseFloat(el.style.height) || 50 };
    }
    if (el.classList.contains('text-block')) {
      const inner = el.querySelector('.tb-h1,.tb-h2,.tb-body,.tb-caption,.tb-label');
      if (!inner) return null;
      const padX = ps?.padX || 0;
      const variant = inner.classList.contains('tb-h1') ? 'heading'
        : inner.classList.contains('tb-h2') ? 'subheading'
        : inner.classList.contains('tb-body') ? 'body'
        : inner.classList.contains('tb-caption') ? 'caption' : 'label';
      const style = _getTextStyle(inner, el);

      // label: 텍스트 색상을 CSS 변수에서 직접 가져옴 (DOMParser에서 var() 미해석 대응)
      const textColor = variant === 'label'
        ? (ps?.labelColor || '#ffffff')
        : style.color;

      const block = {
        type: 'text',
        variant,
        id: el.id || ('tb_' + Math.random().toString(36).slice(2,8)),
        content: inner.textContent.trim(),
        style: {
          fontSize:      style.fontSize,
          fontWeight:    style.fontWeight,
          fontFamily:    style.fontFamily,
          color:         textColor,
          textAlign:     style.textAlign,
          lineHeight:    style.lineHeight,
          letterSpacing: style.letterSpacing,
        },
        padding: {
          top:    parseFloat(el.style.paddingTop)    || 0,
          right:  parseFloat(el.style.paddingRight)  || padX,
          bottom: parseFloat(el.style.paddingBottom) || 0,
          left:   parseFloat(el.style.paddingLeft)   || padX,
        },
      };

      // label: 배경 박스 정보 추가
      if (variant === 'label') {
        // 개별 라벨의 inline borderRadius 우선, 없으면 프리셋 fallback
        const inlineRadius = parseFloat(inner.style.borderRadius);
        block.labelBox = {
          bg:       ps?.labelBg     || '#111111',
          radius:   !isNaN(inlineRadius) ? inlineRadius : (ps?.labelRadius || 8),
          paddingH: 36,
          paddingV: 11,
        };
      }

      return block;
    }
    if (el.classList.contains('asset-block')) {
      return {
        type: 'image',
        id: el.id || ('ab_' + Math.random().toString(36).slice(2, 8)),
        height: parseFloat(el.style.height) || 780,
        style: { borderRadius: parseFloat(el.style.borderRadius) || 0 },
        src: el.dataset.imgSrc || null,
      };
    }
    return null;
  }

  function _row(rowEl, ps) {
    const cols = [];
    rowEl.querySelectorAll(':scope > .col').forEach(col => {
      const w = parseInt(col.dataset.width) || 100;
      const blocks = [];
      col.querySelectorAll(':scope > .text-block, :scope > .asset-block, :scope > .gap-block').forEach(b => {
        const parsed = _block(b, ps);
        if (parsed) blocks.push(parsed);
      });
      cols.push({ width: w, blocks });
    });
    // stack(단일 컬럼) → blocks 직접 반환, 멀티컬럼 → { columns }
    if (cols.length === 1) return cols[0].blocks;
    return [{ columns: cols }];
  }

  function _section(secEl, ps) {
    const inner = secEl.querySelector('.section-inner');
    if (!inner) return null;

    // 섹션 인라인 스타일에서 label CSS 변수 추출 (DOMParser 환경에서도 동작)
    const labelBg     = secEl.style.getPropertyValue('--preset-label-bg').trim()     || '#111111';
    const labelColor  = secEl.style.getPropertyValue('--preset-label-color').trim()  || '#ffffff';
    const labelRadius = parseFloat(secEl.style.getPropertyValue('--preset-label-radius')) || 8;
    const psEx = { ...ps, labelBg, labelColor, labelRadius };

    const blocks = [];
    [...inner.children].forEach(child => {
      if (child.classList.contains('row')) {
        _row(child, psEx).forEach(b => blocks.push(b));
      } else if (child.classList.contains('group-block')) {
        child.querySelectorAll(':scope > .group-inner > .row').forEach(r => {
          _row(r, psEx).forEach(b => blocks.push(b));
        });
      } else if (child.classList.contains('gap-block')) {
        blocks.push({ type: 'gap', height: parseFloat(child.style.height) || 50 });
      }
    });
    const bg = secEl.style.backgroundColor || secEl.style.background || '';
    const name = secEl.dataset.name
      || secEl.querySelector('.section-label')?.textContent?.trim()
      || 'Section';
    // 섹션 DOM id (sec_xxx) 포함
    return { id: secEl.id || '', name, background: bg || '#ffffff', blocks };
  }

  const parser = new DOMParser();
  const allSections = [];
  const nm = nodeMap || {};

  pages.forEach(pg => {
    const doc = parser.parseFromString(`<div id="c">${pg.canvas || ''}</div>`, 'text/html');
    const ps  = pg.pageSettings || pageSettings;
    doc.querySelectorAll('#c > .section-block').forEach(sec => {
      const secId = sec.id || '';
      // selectedIds 필터링 (null 이면 전체 포함)
      if (selectedIds && !selectedIds.includes(secId)) return;

      const s = _section(sec, ps);
      if (!s) return;

      // node_map 에 등록된 섹션이면 figmaId / figmaY 주입 (업데이트 모드)
      const mapped = nm[secId];
      if (mapped?.figmaId) {
        s.figmaId = mapped.figmaId;
        if (mapped.y !== undefined) s.figmaY = mapped.y;
      }

      allSections.push(s);
    });
  });

  const ps = pageSettings;
  return {
    version: 'sangpe-design-v1',
    meta: {
      title: document.getElementById('project-tab-name')?.textContent?.trim() || 'Untitled',
      canvasWidth: CANVAS_W || 860,
      theme: { background: ps.bg, sectionGap: ps.gap },
      exportedAt: new Date().toISOString(),
    },
    sections: allSections,
  };
}
