import { canvasEl, state } from '../globals.js';

const CANVAS_W = 860;

function exportFigmaJSON() {
  // 현재 페이지를 pages 배열에 반영
  window.flushCurrentPage();

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

  const exportPages = state.pages.map(p => parsePage(p));

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


function getTextWithLineBreaks(el) {
  if (!el) return '';
  function extract(node) {
    if (node.nodeType === 3) return node.textContent;   // 텍스트 노드
    if (node.nodeName === 'BR') return '\n';
    const isBlock = node.nodeName === 'DIV' || node.nodeName === 'P';
    const inner = Array.from(node.childNodes).map(extract).join('');
    if (isBlock && node.previousSibling) return '\n' + inner;
    return inner;
  }
  return extract(el).trim();
}

function buildFigmaExportJSON(selectedIds, nodeMap) {
  // sangpe_to_figma.mjs 가 기대하는 포맷으로 빌드
  // sections[].blocks[] — gap / text / image / { columns:[{width,blocks}] }

  // CSS 클래스 기본값 (editor.css 기준)
  const TEXT_DEFAULTS = {
    'tb-h1':      { fontSize: 104, fontWeight: 700, color: '#111111', lineHeight: 1.1,  letterSpacing: -2.08 },
    'tb-h2':      { fontSize: 72,  fontWeight: 600, color: '#111111', lineHeight: 1.15, letterSpacing: 0 },
    'tb-h3':      { fontSize: 52,  fontWeight: 600, color: '#111111', lineHeight: 1.2,  letterSpacing: 0 },
    'tb-body':    { fontSize: 36,  fontWeight: 400, color: '#111111', lineHeight: 1.6,  letterSpacing: 0 },
    'tb-caption': { fontSize: 26,  fontWeight: 400, color: '#111111', lineHeight: 1.6,  letterSpacing: 0.26 },
    'tb-label':   { fontSize: 26,  fontWeight: 700, color: '#111111', lineHeight: 1.4,  letterSpacing: 1.56 },
  };

  function _getTextStyle(inner, el) {
    const cls = [...inner.classList].find(c => TEXT_DEFAULTS[c]) || 'tb-body';
    const def = TEXT_DEFAULTS[cls] || TEXT_DEFAULTS['tb-body'];

    // 인라인 스타일 우선, 없으면 첫 번째 자식 div의 font-size, 없으면 CSS 기본값
    const firstChildFs = (() => {
      const fc = inner.querySelector('div[style*="font-size"]');
      return fc ? parseFloat(fc.style.fontSize) : NaN;
    })();
    const fontSize   = parseFloat(inner.style.fontSize)   || firstChildFs || def.fontSize;
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
      const inner = el.querySelector('.tb-h1,.tb-h2,.tb-h3,.tb-body,.tb-caption,.tb-label');
      if (!inner) return null;
      const padX = ps?.padX || 0;
      const variant = inner.classList.contains('tb-h1') ? 'heading'
        : inner.classList.contains('tb-h2') ? 'subheading'
        : inner.classList.contains('tb-h3') ? 'subheading3'
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
        content: getTextWithLineBreaks(inner),
        height: Math.round((el.id && document.getElementById(el.id)?.offsetHeight) || el.offsetHeight || 0),  // 라이브 DOM 실측 높이
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
    if (el.classList.contains('label-group-block')) {
      const items = [];
      el.querySelectorAll('.label-item').forEach(item => {
        const span = item.querySelector('.label-item-text');
        items.push({
          text:   span?.textContent.trim() || 'Label',
          bg:     item.dataset.bg    || '#111111',
          color:  item.dataset.color || '#ffffff',
          radius: parseInt(item.dataset.radius) || 40,
        });
      });
      const gap   = parseInt(el.style.gap) || 10;
      const jc    = el.style.justifyContent || 'flex-start';
      const align = jc === 'center' ? 'center' : jc === 'flex-end' ? 'right' : 'left';
      const rowGap = parseInt(el.style.rowGap) || gap;
      return {
        type:   'label-group',
        id:     el.id || ('lg_' + Math.random().toString(36).slice(2, 8)),
        items,
        height: Math.round((el.id && document.getElementById(el.id)?.offsetHeight) || el.offsetHeight || 0),
        style:  { gap, rowGap, align, paddingX: parseInt(el.style.paddingLeft) || 20 },
      };
    }
    if (el.classList.contains('asset-block')) {
      const sizePct   = parseInt(el.dataset.size) || 100;
      const usePadx   = el.dataset.usePadx === 'true';
      const padX      = usePadx ? (ps?.padX || 0) : 0;
      const overlayOn = el.dataset.overlay === 'true';
      const ovEl      = el.querySelector('.asset-overlay');
      const overlayText    = overlayOn ? (ovEl?.innerText || '') : '';
      const overlayColor   = overlayOn ? (ovEl?.style.color || '#ffffff') : '';
      const overlayBg      = overlayOn ? parseFloat(ovEl?.dataset.ovOpacity ?? '0.35') : 0;
      return {
        type: 'image',
        id: el.id || ('ab_' + Math.random().toString(36).slice(2, 8)),
        height: parseFloat(el.style.height) || 780,
        sizePct,
        padX,
        style: { borderRadius: parseFloat(el.style.borderRadius) || 0 },
        src: el.dataset.imgSrc || null,
        overlayOn,
        overlayText,
        overlayColor,
        overlayBg,
      };
    }
    if (el.classList.contains('icon-circle-block')) {
      const size    = parseInt(el.dataset.size) || 240;
      const bgColor = el.dataset.bgColor || '#e8e8e8';
      const imgSrc  = el.dataset.imgSrc  || null;
      return {
        type:    'circle',
        id:      el.id || ('icb_' + Math.random().toString(36).slice(2, 8)),
        size,
        bgColor,
        src:     imgSrc,
      };
    }
    if (el.classList.contains('table-block')) {
      const table    = el.querySelector('.tb-table');
      const rowCount = (table?.querySelectorAll('tbody tr').length || 2) + 1; // +1 for header
      const fontSize = parseInt(table?.style.fontSize) || 28;
      const cellPad  = parseInt(el.dataset.cellPad) || 10;
      const approxH  = rowCount * (fontSize + cellPad * 2 + 4) + 24;
      return {
        type:    'table',
        id:      el.id || ('tbl_' + Math.random().toString(36).slice(2, 8)),
        height:  approxH,
        colCount: table?.querySelector('tr')?.querySelectorAll('th,td').length || 2,
        rowCount,
      };
    }
    if (el.classList.contains('canvas-block')) {
      let cards = [];
      try { cards = JSON.parse(el.dataset.cards || '[]'); } catch {}
      return {
        type:      'card-grid',
        id:        el.id || ('cvb_' + Math.random().toString(36).slice(2, 8)),
        cards,
        gridCols:  parseInt(el.dataset.gridCols)  || 2,
        gridRows:  parseInt(el.dataset.gridRows)  || 1,
        cardGap:   parseInt(el.dataset.cardGap)   || 10,
        canvasW:   parseInt(el.dataset.canvasW)   || 440,
        canvasH:   parseInt(el.dataset.canvasH)   || 400,
        radius:    parseInt(el.dataset.radius)    || 16,
        imgRatio:  parseInt(el.dataset.imgRatio)  || 75,
        cardMode:  el.dataset.cardMode || 'simple',
        textBg:    el.dataset.textBg   || '#cccccc',
        titleSize: parseInt(el.dataset.titleSize) || 32,
        descSize:  parseInt(el.dataset.descSize)  || 20,
        textAlign: el.dataset.textAlign || 'center',
        padX:      ps?.padX || 0,
        height:    Math.round((el.id && document.getElementById(el.id)?.offsetHeight) || el.offsetHeight || 400),
      };
    }
    return null;
  }

  function _row(rowEl, ps) {
    // canvas-block이 row 직속 자식인 경우 (col 래퍼 없음)
    const directCanvas = rowEl.querySelector(':scope > .canvas-block');
    if (directCanvas) {
      const parsed = _block(directCanvas, ps);
      return parsed ? [parsed] : [];
    }
    const cols = [];
    rowEl.querySelectorAll(':scope > .col').forEach(col => {
      const w = parseInt(col.dataset.width) || 100;
      const blocks = [];
      col.querySelectorAll(':scope > .text-block, :scope > .asset-block, :scope > .gap-block, :scope > .label-group-block, :scope > .icon-circle-block, :scope > .table-block, :scope > .canvas-block').forEach(b => {
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
    function _processFrameBlock(fb) {
      fb.querySelectorAll(':scope > .text-block, :scope > .asset-block, :scope > .gap-block, :scope > .label-group-block, :scope > .icon-circle-block, :scope > .table-block, :scope > .canvas-block, :scope > .graph-block').forEach(b => {
        const parsed = _block(b, psEx);
        if (parsed) blocks.push(parsed);
      });
      fb.querySelectorAll(':scope > .frame-block').forEach(nested => _processFrameBlock(nested));
    }
    [...inner.children].forEach(child => {
      if (child.classList.contains('row')) {
        _row(child, psEx).forEach(b => blocks.push(b));
      } else if (child.classList.contains('group-block')) {
        child.querySelectorAll(':scope > .group-inner > .row').forEach(r => {
          _row(r, psEx).forEach(b => blocks.push(b));
        });
      } else if (child.classList.contains('gap-block')) {
        blocks.push({ type: 'gap', height: parseFloat(child.style.height) || 50 });
      } else if (child.classList.contains('frame-block')) {
        _processFrameBlock(child);
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

  state.pages.forEach(pg => {
    const doc = parser.parseFromString(`<div id="c">${pg.canvas || ''}</div>`, 'text/html');
    const ps  = pg.pageSettings || state.pageSettings;
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

  const ps = state.pageSettings;
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

export {
  exportFigmaJSON,
  getTextWithLineBreaks,
  buildFigmaExportJSON,
};

// Backward compat

window.exportFigmaJSON       = exportFigmaJSON;
window.getTextWithLineBreaks = getTextWithLineBreaks;
window.buildFigmaExportJSON  = buildFigmaExportJSON;
