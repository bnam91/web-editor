import { canvasEl, state } from './globals.js';

const CANVAS_W = 860;

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
        content: inner ? window.getTextWithLineBreaks(inner) : '',
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

    if (el.classList.contains('card-block')) {
      return {
        id:      uid('cdb'),
        type:    'card',
        bgColor: el.dataset.bgColor || '#f5f5f5',
        radius:  parseInt(el.dataset.radius) || 12,
        height:  parseFloat(el.style.height) || 400,
        src:     el.dataset.imgSrc || null,
      };
    }

    if (el.classList.contains('graph-block')) {
      let items = [];
      try { items = JSON.parse(el.dataset.items || '[]'); } catch {}
      return {
        id:        uid('grb'),
        type:      'graph',
        chartType: el.dataset.chartType || 'bar-v',
        preset:    el.dataset.preset   || 'default',
        items,
        height:    parseFloat(el.style.height) || 300,
      };
    }

    if (el.classList.contains('strip-banner-block')) {
      return {
        id:      uid('sbb'),
        type:    'strip-banner',
        bgColor: el.dataset.bgColor || '#f5f5f5',
        radius:  parseInt(el.dataset.radius) || 0,
        imgPos:  el.dataset.imgPos  || 'left',
        src:     el.dataset.imgSrc  || null,
        height:  parseFloat(el.style.height) || 300,
      };
    }

    if (el.classList.contains('label-group-block')) {
      const items = [];
      el.querySelectorAll('.label-item').forEach(item => {
        const span = item.querySelector('.label-item-text');
        items.push({
          text:   span?.textContent.trim() || 'Label',
          bg:     item.dataset.bg    || '#e8e8e8',
          color:  item.dataset.color || '#333333',
          radius: parseInt(item.dataset.radius) || 40,
        });
      });
      return {
        id:    uid('lg'),
        type:  'label-group',
        items,
        style: { gap: parseInt(el.style.gap) || 10 },
      };
    }

    if (el.classList.contains('table-block')) {
      const table = el.querySelector('.tb-table');
      const rows = [];
      table?.querySelectorAll('tr').forEach(tr => {
        const cells = [];
        tr.querySelectorAll('th, td').forEach(cell => cells.push(cell.textContent.trim()));
        rows.push(cells);
      });
      return {
        id:       uid('tbl'),
        type:     'table',
        rows,
        fontSize: parseInt(table?.style.fontSize) || 28,
      };
    }

    return null;
  }

  function serializeCol(colEl) {
    const blocks = [];
    colEl.querySelectorAll(':scope > .text-block, :scope > .asset-block, :scope > .gap-block, :scope > .card-block, :scope > .graph-block, :scope > .strip-banner-block, :scope > .label-group-block, :scope > .table-block').forEach(b => {
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
    const bg    = rgbToHex(rawBg) || state.pageSettings.bg || '#ffffff';
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
        background:  state.pageSettings.bg  || '#ffffff',
        fontFamily:  'Noto Sans KR',
        sectionGap:  state.pageSettings.gap  ?? 0,
        paddingX:    state.pageSettings.padX ?? 0,
        paddingY:    state.pageSettings.padY ?? 0,
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


window.exportDesignJSON = exportDesignJSON;
