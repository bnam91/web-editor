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
    canvasDiv.querySelectorAll(':scope > .section-block:not([data-ghost])').forEach((sec, i) => {
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
    if (el.classList.contains('text-block') && !el.classList.contains('liner-block')) {
      // liner-block(곡선텍스트 SVG)은 text-block 클래스도 갖지만 tb-inner가 없어
      // 여기서 null 드롭됐었음 → liner-block 핸들러(아래)로 흘려보낸다.
      const inner = el.querySelector('.tb-h1,.tb-h2,.tb-h3,.tb-body,.tb-caption,.tb-label');
      if (!inner) return null;
      const padX = ps?.padX || 0;
      const variant = inner.classList.contains('tb-h1') ? 'heading'
        : inner.classList.contains('tb-h2') ? 'subheading'
        : inner.classList.contains('tb-h3') ? 'subheading3'
        : inner.classList.contains('tb-body') ? 'body'
        : inner.classList.contains('tb-caption') ? 'caption' : 'label';
      const style = _getTextStyle(inner, el);

      // label: 개별 라벨의 라이브 computed-style(bg/색)을 우선 — 전역 ps.labelBg/labelColor 하드코딩은 흰bg/검은글자 라벨을 뒤집음(회차12 tja5ovp).
      // 라이브 못 찾으면(클론DOM·var() 미해석) ps 폴백.
      const _liveLabel = (variant === 'label' && el.id) ? (document.getElementById(el.id)?.querySelector('.tb-label') || null) : null;
      const _liveLabelBg = _liveLabel ? getComputedStyle(_liveLabel).backgroundColor : '';
      const _liveLabelColor = _liveLabel ? getComputedStyle(_liveLabel).color : '';
      const _labelBgOpaque = _liveLabelBg && _liveLabelBg !== 'transparent' && !/rgba\([^)]*,\s*0\s*\)/.test(_liveLabelBg);
      const textColor = variant === 'label'
        ? (_liveLabelColor || ps?.labelColor || '#ffffff')
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
          bg:       _labelBgOpaque ? _liveLabelBg : (ps?.labelBg || '#111111'),
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
      // dataset.size 우선, 없으면 실제 렌더 폭/섹션폭으로 산출(중앙정렬 가정) — 풀블리드 오인 방지.
      // ⚠️ offsetWidth는 detached/레이아웃前엔 0 → 인라인 style.width로 폴백(클론DOM·리로드직후 안전).
      let sizePct = parseInt(el.dataset.size);
      if (!sizePct) {
        const secEl = el.closest('.section-block');
        const renderedW = el.offsetWidth || parseFloat(el.style.width) || 0;
        const secW = (secEl && secEl.offsetWidth) || parseFloat(secEl && secEl.style.width) || 860;
        sizePct = (renderedW > 0 && secW > 0)
          ? Math.max(1, Math.min(100, Math.round(renderedW / secW * 100)))
          : 100;
      }
      // (가) 설계: effective usePadx — dataset 명시값 우선, 미설정이면 글로벌 디폴트
      const usePadx   = typeof window.getEffectiveUsePadx === 'function'
        ? window.getEffectiveUsePadx(el)
        : (el.dataset.usePadx === 'true' ? true : (el.dataset.usePadx === 'false' ? false : true));
      const padX      = usePadx ? 0 : (ps?.padX || 0); // 패딩 제외 ON → full width (padX=0)
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
      const imgSrc  = el.dataset.imgSrc  || null;
      // 빈 원 신호 = .icb-circle가 체커보드(repeating-conic-gradient) & 투명 배경(섹션bg fix와 동일 live computed-style 판정).
      // dataset.bgColor는 빈 원도 기본 placeholder '#e8e8e8'가 박혀 있어 신호로 못 씀(회차12 imac 정정).
      // → live .icb-circle computed-style: 체커보드면 빈 원=bgColor null(투명), 솔리드 색이면 그 색.
      let bgColor = null;
      const _live = el.id ? document.getElementById(el.id) : null;
      const _circ = _live ? _live.querySelector('.icb-circle') : null;
      if (_circ) {
        const _cs = getComputedStyle(_circ);
        const _checker = /repeating-conic-gradient/.test(_cs.backgroundImage || '');
        const _bg = _cs.backgroundColor || '';
        const _opaque = _bg && _bg !== 'transparent' && !/rgba\([^)]*,\s*0\s*\)/.test(_bg);
        if (!_checker && _opaque) bgColor = _bg;   // 사용자가 색 지정한 원만 그 색
      } else {
        // live 못 찾으면(클론DOM) dataset 폴백 — 단 기본 placeholder '#e8e8e8'는 빈 원이므로 null
        const _ds = el.dataset.bgColor;
        bgColor = (_ds && _ds !== '#e8e8e8') ? _ds : null;
      }
      return {
        type:    'circle',
        id:      el.id || ('icb_' + Math.random().toString(36).slice(2, 8)),
        size,
        bgColor,
        src:     imgSrc,
      };
    }
    if (el.classList.contains('table-block')) {
      const table   = el.querySelector('.tb-table');
      const trEls    = table ? [...table.querySelectorAll('tr')] : [];
      const rows = trEls.map(tr => ({
        header: !!(tr.parentElement && tr.parentElement.tagName === 'THEAD'),
        cells:  [...tr.querySelectorAll('th,td')].map(c => ({
          text:  (c.innerText || '').trim(),
          align: c.style.textAlign || el.dataset.cellAlign || 'center',
        })),
      }));
      const colCount = rows.length ? Math.max(...rows.map(r => r.cells.length)) : 2;
      const firstCell = table?.querySelector('td,th');
      let fontSize = 28;
      try { if (firstCell) fontSize = Math.round(parseFloat(window.getComputedStyle(firstCell).fontSize)) || 28; } catch {}
      const realH = Math.round((el.id && document.getElementById(el.id)?.offsetHeight) || el.offsetHeight || 0);
      return {
        type:       'table',
        id:         el.id || ('tbl_' + Math.random().toString(36).slice(2, 8)),
        rows,
        colCount,
        rowCount:   rows.length,
        showHeader: el.dataset.showHeader !== 'false',
        showVLines: el.dataset.showVLines !== 'false',
        showHLines: el.dataset.showHLines !== 'false',
        lineColor:  el.dataset.lineColor  || '#cccccc',
        headerBg:   el.dataset.headerBg   || '#f0f0f0',
        textColor:  el.dataset.textColor  || '#222222',
        cellAlign:  el.dataset.cellAlign  || 'center',
        fontSize,
        rowH:       parseInt(el.dataset.rowH) || 0,
        height:     realH || (rows.length * (fontSize + 28) + 24),
      };
    }
    if (el.classList.contains('canvas-block')) {
      let cards = [];
      try { cards = JSON.parse(el.dataset.cards || '[]'); } catch {}
      // cvb-inner는 캔버스 디자인공간을 섹션공간으로 scale 축소 → 폰트크기에 곱해야 실제 렌더와 일치.
      const cvbInner = el.querySelector('.cvb-inner');
      const sm = /scale\(([\d.]+)\)/.exec(cvbInner && cvbInner.style.transform || '');
      const cvbScale = sm ? parseFloat(sm[1]) : 1;
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
        titleSize: Math.round((parseInt(el.dataset.titleSize) || 32) * cvbScale),
        descSize:  Math.round((parseInt(el.dataset.descSize)  || 20) * cvbScale),
        titleColor: el.dataset.titleColor || '',
        descColor:  el.dataset.descColor  || '',
        iconColor:  el.dataset.iconColor  || '',
        textAlign: el.dataset.textAlign || 'center',
        padX:      ps?.padX || 0,
        height:    Math.round((el.id && document.getElementById(el.id)?.offsetHeight) || el.offsetHeight || 400),
      };
    }
    if (el.classList.contains('chat-block')) {
      let messages = [];
      try { messages = JSON.parse(el.dataset.messages || '[]'); } catch {}
      // 버블 색은 dataset 기본값(우=파랑 #1888fe)이 goditor 실제(회색)와 어긋남 → live .chb-bubble computed-style을 우선 읽음(회차12 p6bwvy9).
      const _liveChat = el.id ? document.getElementById(el.id) : null;
      const _bubbles = _liveChat ? [..._liveChat.querySelectorAll('.chb-bubble')] : [];
      // 버블은 messages 순서대로 렌더 → 첫 좌/우 메시지 인덱스의 버블을 집음(가장 견고).
      const _idxL = messages.findIndex(m => m.align !== 'right');
      const _idxR = messages.findIndex(m => m.align === 'right');
      const _lb = _idxL >= 0 ? _bubbles[_idxL] : _bubbles[0];
      const _rb = _idxR >= 0 ? _bubbles[_idxR] : null;
      const _bg = (n, fb) => { if (!n) return fb; const c = getComputedStyle(n).backgroundColor; return (c && c !== 'transparent' && !/rgba\([^)]*,\s*0\s*\)/.test(c)) ? c : fb; };
      const _fg = (n, fb) => { if (!n) return fb; const c = getComputedStyle(n).color; return c || fb; };
      return {
        type:       'chat',
        id:         el.id || ('chb_' + Math.random().toString(36).slice(2, 8)),
        messages:   messages.map(m => ({ text: m.text || '', align: m.align === 'right' ? 'right' : 'left' })),
        fontSize:   parseInt(el.dataset.fontSize) || 32,
        bgLeft:     _bg(_lb, el.dataset.bgLeft    || '#e5e5ea'),
        bgRight:    _bg(_rb, el.dataset.bgRight   || '#1888fe'),
        colorLeft:  _fg(_lb, el.dataset.colorLeft || '#111111'),
        colorRight: _fg(_rb, el.dataset.colorRight|| '#ffffff'),
        radius:     parseInt(el.dataset.radius)  || 16,
        gap:        parseInt(el.dataset.gap)     || 8,
        padding:    parseInt(el.dataset.padding) || 16,
        height:     Math.round((el.id && document.getElementById(el.id)?.offsetHeight) || el.offsetHeight || 200),
      };
    }
    // ── ICON (icon-block) : SVG 아이콘 ──
    if (el.classList.contains('icon-block')) {
      const size = parseInt(el.dataset.size) || parseFloat(el.style.width) || 48;
      return {
        type: 'icon', id: el.id || '',
        svg: el.dataset.iconSvg || (el.querySelector('svg')?.outerHTML) || '',
        color: el.dataset.iconColor || '#000000',
        size, rotation: parseInt(el.dataset.rotation) || 0,
        height: size,
      };
    }
    // ── DIVIDER (divider-block) : 선 (가로=두께가 높이, 세로=lineLength가 높이) ──
    if (el.classList.contains('divider-block')) {
      const padV = parseInt(el.dataset.padV) || 0;
      const weight = parseInt(el.dataset.lineWeight) || 1;
      const dir = el.dataset.lineDir || 'horizontal';
      const lineLength = parseInt(el.dataset.lineLength) || 100; // 가로=% , 세로=px
      const height = dir === 'vertical' ? (padV * 2 + lineLength) : (padV * 2 + weight);
      return {
        type: 'divider', id: el.id || '',
        color: el.dataset.lineColor || '#cccccc',
        weight, lineLength, dir, padV, height,
      };
    }
    // ── GRAPH (graph-block) : 막대/라인 차트 ──
    if (el.classList.contains('graph-block')) {
      let items = []; try { items = JSON.parse(el.dataset.items || '[]'); } catch {}
      return {
        type: 'graph', id: el.id || '',
        chartType: el.dataset.chartType || 'bar',
        items,
        height: parseInt(el.dataset.chartHeight) || parseFloat(el.style.height) || 300,
      };
    }
    // ── SHAPE (shape-block) : 도형(선/사각/원) ──
    if (el.classList.contains('shape-block')) {
      return {
        type: 'shape', id: el.id || '',
        shapeType: el.dataset.shapeType || 'rect',
        color: el.dataset.shapeColor || '#cccccc',
        strokeWidth: parseInt(el.dataset.shapeStrokeWidth) || 1,
        rotation: parseInt(el.dataset.shapeRotation) || 0,
        width: parseFloat(el.style.width) || 75,
        height: parseFloat(el.style.height) || 75,
      };
    }
    // ── STEP (step-block) : 번호badge + 제목/설명 카드 ──
    if (el.classList.contains('step-block')) {
      let steps = []; try { steps = JSON.parse(el.dataset.steps || '[]'); } catch {}
      return {
        type: 'step', id: el.id || '',
        steps: steps.map(s => ({ title: s.title || '', desc: s.desc || '' })),
        startNumber: parseInt(el.dataset.startNumber) || 1,
        numBg: el.dataset.numBg || '#222222',
        numColor: el.dataset.numColor || '#ffffff',
        numSize: parseInt(el.dataset.numSize) || 50,
        titleSize: parseInt(el.dataset.titleSize) || 36,
        descSize: parseInt(el.dataset.descSize) || 24,
        titleColor: el.dataset.titleColor || '#222222',
        descColor: el.dataset.descColor || '#888888',
        cardBg: el.dataset.stepCardBg || '#ffffff',
        badgeFormat: el.dataset.badgeFormat || 'padded',
        badgeGap: parseInt(el.dataset.badgeGap) || 20,
        height: Math.round((el.id && document.getElementById(el.id)?.offsetHeight) || el.offsetHeight || 80),
      };
    }
    // ── BANNER02 (banner02-block) : 라운드 컬러박스 + 텍스트스택 + 이미지 ──
    if (el.classList.contains('banner02-block')) {
      let lines = []; try { lines = JSON.parse(el.dataset.lines || '[]'); } catch {}
      return {
        type: 'banner02', id: el.id || '',
        bannerW: parseInt(el.dataset.bannerW) || 780,
        bannerH: parseInt(el.dataset.bannerH) || 260,
        radius: parseInt(el.dataset.radius) || 20,
        bg: el.dataset.bg || '#1a1f3d',
        textX: parseInt(el.dataset.textX) || 36,
        textY: parseInt(el.dataset.textY) || 35,
        textW: parseInt(el.dataset.textW) || 358,
        lines: lines.map(l => ({ kind: l.kind, text: l.text || '', size: l.size || 16, color: l.color || '#ffffff', gapTop: l.gapTop || 0, weight: l.fontWeight || 400 })),
        imgSrc: el.dataset.imgSrc || '',
        imgX: parseInt(el.dataset.imgX) || 0, imgY: parseInt(el.dataset.imgY) || 0,
        imgW: parseInt(el.dataset.imgW) || 0, imgH: parseInt(el.dataset.imgH) || 0,
        height: Math.round((el.id && document.getElementById(el.id)?.offsetHeight) || el.offsetHeight || (parseInt(el.dataset.bannerH) || 260)),
      };
    }
    // comparison 행 셀: 문자열은 그대로, 객체면 텍스트 추출(예전 [object Object] 갭 방지)
    function _cmpCell(r) {
      if (typeof r === 'string') return r;
      if (r && typeof r === 'object') {
        const v = r.text ?? r.value ?? r.label ?? r.title ?? r.name;
        if (v != null) return String(v);
        const strs = Object.values(r).filter(x => typeof x === 'string' && x.trim());
        return strs.join(' ');
      }
      return r == null ? '' : String(r);
    }
    // ── COMPARISON (comparison-block) : 2열 비교(헤더+행, featured 강조) ──
    if (el.classList.contains('comparison-block')) {
      let cols = []; try { cols = JSON.parse(el.dataset.cols || '[]'); } catch {}
      const feat = el.dataset.featured;
      return {
        type: 'comparison', id: el.id || '',
        cols: cols.map(c => ({ title: c.title || '', bg: c.bg || '', text: c.text || '', rows: (c.rows || []).map(_cmpCell) })),
        featured: (feat !== undefined && feat !== '') ? parseInt(feat) : -1,
        compW: parseInt(el.dataset.compW) || 720,
        titleFont: parseInt(el.dataset.titleFont) || 38,
        rowFont: parseInt(el.dataset.rowFont) || 32,
        headerH: parseInt(el.dataset.headerH) || 72,
        rowH: parseInt(el.dataset.rowH) || 74,
        rowGap: parseInt(el.dataset.rowGap) || 12,
        radius: parseInt(el.dataset.radius) || 20,
        featScale: parseFloat(el.dataset.featScale) || 1.2,
        height: Math.round((el.id && document.getElementById(el.id)?.offsetHeight) || el.offsetHeight || 400),
      };
    }
    // ── MOCKUP (mockup-block) : 디바이스 프레임 이미지 ──
    if (el.classList.contains('mockup-block')) {
      const img = el.querySelector('img');
      return {
        type: 'mockup', id: el.id || '',
        imgSrc: img ? img.src : '',
        width: parseInt(el.dataset.width) || 575,
        offsetX: parseInt(el.dataset.offsetX) || 0,
        offsetY: parseInt(el.dataset.offsetY) || 0,
        height: Math.round((el.id && document.getElementById(el.id)?.offsetHeight) || el.offsetHeight || 400),
      };
    }
    // ── LINER (liner-block) : 곡선텍스트 → 렌더된 SVG 그대로 임베드 ──
    if (el.classList.contains('liner-block')) {
      const svg = el.querySelector('svg');
      return {
        type: 'liner', id: el.id || '',
        svg: svg ? svg.outerHTML : '',
        width: Math.round((el.id && document.getElementById(el.id)?.offsetWidth) || el.offsetWidth || 716),
        height: Math.round((el.id && document.getElementById(el.id)?.offsetHeight) || el.offsetHeight || 56),
      };
    }
    // ── LAUREL (laurel-block) : 월계관 잎 SVG + 중앙 텍스트 ──
    if (el.classList.contains('laurel-block')) {
      let cells = []; try { cells = JSON.parse(el.dataset.cells || '[]'); } catch {}
      const leaf = el.querySelector('svg');
      return {
        type: 'laurel', id: el.id || '',
        cells, leafSvg: leaf ? leaf.outerHTML : '',
        height: Math.round((el.id && document.getElementById(el.id)?.offsetHeight) || el.offsetHeight || 116),
      };
    }
    // ── GENERIC 폴백 (잔여) ──
    //    드롭 방지: 높이 보존 + 배경 + 내부 텍스트/아이콘 살림. (완벽 레이아웃은 후속 refinement)
    if (/(-block)$/.test([...el.classList].find(c => c.endsWith('-block')) || '')) {
      const w = parseInt(el.dataset.bannerW || el.dataset.compW || el.dataset.width) || parseFloat(el.style.width) || null;
      const h = parseInt(el.dataset.bannerH || el.dataset.chartHeight) || parseFloat(el.style.height)
                || Math.round((el.id && document.getElementById(el.id)?.offsetHeight) || el.offsetHeight || 0);
      const texts = [];
      el.querySelectorAll('[class^="tb-"], [class*=" tb-"]').forEach(t => {
        const tx = (t.innerText || '').trim();
        if (tx) { const cs = (typeof window.getComputedStyle === 'function') ? window.getComputedStyle(t) : {};
          texts.push({ t: tx, fs: parseInt(cs.fontSize) || 24, color: cs.color || '#111111',
            x: parseFloat(t.style.left) || 0, y: parseFloat(t.style.top) || 0 }); }
      });
      const ds = el.dataset || {};
      return {
        type: 'generic', id: el.id || '', kind: ds.type || '',
        width: w, height: h || 0, bg: ds.bg || '', radius: parseInt(ds.radius) || 0,
        svg: el.querySelector('svg')?.outerHTML || '', texts,
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
    // col 래퍼 없이 블록이 row 직속 자식인 경우 (stack layout full-width 블록 등)
    const DIRECT_BLOCK_SEL = ':scope > .text-block, :scope > .asset-block, :scope > .gap-block, :scope > .label-group-block, :scope > .icon-circle-block, :scope > .table-block, :scope > .chat-block, :scope > .icon-block, :scope > .divider-block, :scope > .graph-block, :scope > .shape-block, :scope > .banner02-block, :scope > .step-block, :scope > .comparison-block, :scope > .mockup-block, :scope > .laurel-block, :scope > .liner-block';
    const hasDirectBlocks = rowEl.querySelector(DIRECT_BLOCK_SEL);
    if (hasDirectBlocks && !rowEl.querySelector(':scope > .col')) {
      const blocks = [];
      rowEl.querySelectorAll(DIRECT_BLOCK_SEL).forEach(b => {
        const parsed = _block(b, ps);
        if (parsed) blocks.push(parsed);
      });
      return blocks;
    }
    const cols = [];
    rowEl.querySelectorAll(':scope > .col').forEach(col => {
      const w = parseInt(col.dataset.width) || 100;
      const blocks = [];
      col.querySelectorAll(':scope > .text-block, :scope > .asset-block, :scope > .gap-block, :scope > .label-group-block, :scope > .icon-circle-block, :scope > .table-block, :scope > .canvas-block, :scope > .chat-block, :scope > .icon-block, :scope > .divider-block, :scope > .graph-block, :scope > .shape-block, :scope > .banner02-block, :scope > .step-block, :scope > .comparison-block, :scope > .mockup-block, :scope > .laurel-block, :scope > .liner-block').forEach(b => {
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
      fb.querySelectorAll(':scope > .text-block, :scope > .asset-block, :scope > .gap-block, :scope > .label-group-block, :scope > .icon-circle-block, :scope > .table-block, :scope > .canvas-block, :scope > .graph-block, :scope > .chat-block, :scope > .icon-block, :scope > .divider-block, :scope > .shape-block, :scope > .banner02-block, :scope > .step-block, :scope > .comparison-block, :scope > .mockup-block, :scope > .laurel-block, :scope > .liner-block').forEach(b => {
        const parsed = _block(b, psEx);
        if (parsed) blocks.push(parsed);
      });
      fb.querySelectorAll(':scope > .frame-block').forEach(nested => _processFrameBlock(nested));
    }
    // free-layout 프레임: 절대배치 구조 보존(높이·배경·자식 위치) → 렌더 충실도↑.
    function _frameBlock(fb) {
      const w = parseInt(fb.dataset.width) || null;
      const h = parseInt(fb.dataset.height) || parseFloat(fb.style.height) || 0;
      const free = fb.dataset.freeLayout === 'true';
      const children = [];
      [...fb.children].forEach(c => {
        const x = parseFloat(c.style.left) || 0;
        const y = parseFloat(c.style.top) || 0;
        const cwRaw = (c.style.width || '').trim();
        const cw = cwRaw.endsWith('%') ? Math.round((parseFloat(cwRaw) / 100) * (w || 716)) : (parseFloat(cwRaw) || (w || 716));
        let innerB = c.classList.contains('frame-block') ? _frameBlock(c) : _block(c, psEx);
        if (innerB) {
          if (free && innerB.type === 'text') innerB.padding = { top: 0, right: 0, bottom: 0, left: 0 };
          children.push({ x, y, w: cw, block: innerB });
        }
      });
      return { type: 'frame', id: fb.id || '', width: w, height: h,
               bg: fb.dataset.bg || '', radius: parseInt(fb.dataset.radius) || 0, free, children };
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
        if (child.dataset.freeLayout === 'true') blocks.push(_frameBlock(child));
        else _processFrameBlock(child);
      } else if (child.matches('.text-block, .asset-block, .icon-block, .icon-circle-block, .table-block, .chat-block, .canvas-block, .graph-block, .divider-block, .shape-block, .label-group-block, .banner02-block, .step-block, .comparison-block, .mockup-block, .laurel-block, .liner-block')) {
        // section-inner 직속 콘텐츠 블록(row/frame 미포함) — 드롭 방지.
        const parsed = _block(child, psEx);
        if (parsed) blocks.push(parsed);
      }
    });
    const bgColor = secEl.style.backgroundColor || '';
    const styleAttr = secEl.getAttribute('style') || '';
    const bgImgRaw = secEl.style.backgroundImage || (/background(-image)?:\s*([^;]+)/.exec(styleAttr) || [])[2] || '';
    // 섹션 배경: 이미지(data URI) / 그라디언트 / 솔리드 분기
    let bgImage = '';
    const urlM = /url\(["']?(data:image[^"')]+)["']?\)/.exec(bgImgRaw);
    if (urlM) bgImage = urlM[1];
    const isGradient = /gradient/.test(bgImgRaw) && !urlM;
    // 섹션 실제 렌더색을 라이브 getComputedStyle로 읽는다 — .section-block{background:#fff}
    // 클래스 때문에 흰 섹션(74개)이 흰색으로 잡힌다. 진짜 투명한 섹션만 페이지배경(ps.bg)으로 채운다.
    // (예전엔 inline bg만 보고 흰 섹션에 ps.bg(회색)를 과적용해 Figma만 회색 되는 역갭이 있었음)
    const _liveEl = secEl.id ? document.getElementById(secEl.id) : null;
    const _liveBg = _liveEl ? getComputedStyle(_liveEl).backgroundColor : '';
    const _liveOpaque = _liveBg && _liveBg !== 'transparent' && !/rgba\([^)]*,\s*0\s*\)/.test(_liveBg);
    let background;
    if (_liveOpaque) background = _liveBg;
    else if (bgColor && bgColor !== 'transparent' && bgColor !== 'rgba(0, 0, 0, 0)') background = bgColor;
    else background = isGradient ? '#eeeeee' : (ps.bg || '#ffffff'); // 진짜 투명 섹션 → 페이지 회색
    const name = secEl.dataset.name
      || secEl.querySelector('.section-label')?.textContent?.trim()
      || 'Section';
    return { id: secEl.id || '', name, background, bgImage, blocks };
  }

  const parser = new DOMParser();
  const allSections = [];
  const nm = nodeMap || {};

  state.pages.forEach(pg => {
    const doc = parser.parseFromString(`<div id="c">${pg.canvas || ''}</div>`, 'text/html');
    const ps  = pg.pageSettings || state.pageSettings;
    doc.querySelectorAll('#c > .section-block:not([data-ghost])').forEach(sec => {
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
