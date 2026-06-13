// ── Laurel Block (월계수) ────────────────────────────────────────────────────
// 좌우 월계수 SVG + 가운데 텍스트. 트로피/수상 마크.
//
// 의존성:
//   - insertAfterSelected (drag-utils.js)
//   - bindBlock (drag-drop.js)

import { insertAfterSelected } from '../drag-utils.js';
import { bindBlock } from '../drag-drop.js';

const LAUREL_VIEWBOX = '0 0 170 324';
const LAUREL_LEFT_PATH = 'M73.3342 3.94941C62.1592 17.5874 60.6742 33.1004 69.1282 47.8894C70.4992 50.2864 71.6252 53.3084 71.6322 54.6054C71.6392 55.9024 69.4062 60.3094 66.6712 64.3994C63.9352 68.4894 59.8122 75.6404 57.5072 80.2914C55.2032 84.9424 52.9142 88.7474 52.4222 88.7474C51.9292 88.7474 51.7602 88.3694 52.0452 87.9074C52.3312 87.4454 53.0642 82.9544 53.6762 77.9274C55.6012 62.0924 52.1942 48.2984 44.0472 38.9484L40.8222 35.2474L38.6432 40.2474C31.1052 57.5474 33.1222 71.5894 44.9882 84.4054C48.0992 87.7654 50.6442 91.4094 50.6442 92.5034C50.6442 93.5974 49.0632 99.3204 47.1302 105.22C45.1972 111.12 43.0702 118.827 42.4022 122.347C41.7342 125.867 40.8732 128.747 40.4882 128.747C40.1032 128.747 39.5132 126.159 39.1782 122.997C38.1292 113.119 35.5582 103.476 32.3572 97.4134C29.0602 91.1714 19.2242 81.4894 16.6772 81.9794C13.5802 82.5764 12.6612 98.4724 15.2592 106.517C17.6232 113.839 23.2072 120.575 31.6712 126.317L39.1442 131.387L39.0712 136.317C38.8122 153.763 38.0532 170.735 37.5312 170.74C37.1942 170.744 35.4852 166.741 33.7332 161.845C30.5462 152.935 24.6562 143.281 19.7532 138.933C15.4782 135.141 3.54924 129.442 2.36524 130.626C0.608237 132.383 3.31724 145.566 6.91024 152.74C11.0822 161.07 19.4332 167.714 29.6212 170.809C33.4232 171.963 36.9502 173.434 37.4602 174.078C37.9702 174.721 38.9262 179.627 39.5862 184.981C40.2452 190.334 41.6622 198.388 42.7342 202.878C43.8062 207.367 44.5012 211.224 44.2772 211.448C44.0532 211.672 41.7882 208.724 39.2432 204.896C33.5862 196.386 23.8592 187.197 17.7252 184.567C11.4082 181.86 1.36724 179.624 0.302237 180.689C-0.725763 181.717 0.938235 187.292 4.23624 193.877C6.97924 199.351 13.6532 206.184 18.8642 208.852C24.0622 211.514 33.1812 213.747 38.8542 213.747C43.6232 213.747 47.6442 216.099 47.6442 218.889C47.6442 220.693 54.7002 236.651 58.3662 243.138C60.1972 246.378 61.4772 249.247 61.2102 249.514C60.9442 249.781 57.6992 247.226 54.0002 243.836C43.3502 234.077 30.4692 228.72 17.7582 228.762C15.2202 228.771 12.4702 229.204 11.6462 229.724C10.3342 230.554 10.3752 231.092 11.9802 234.072C14.8672 239.434 22.4202 247.535 26.9772 250.16C29.2692 251.479 33.6802 253.111 36.7792 253.786C42.0452 254.933 44.9502 254.849 58.2692 253.165L63.3952 252.516L68.9882 260.08C72.0652 264.24 77.5752 270.817 81.2342 274.695C84.8932 278.574 87.3692 281.747 86.7372 281.747C86.1042 281.747 83.0122 280.449 79.8652 278.862C65.5442 271.64 51.7722 269.919 39.2492 273.787C35.6012 274.914 32.6442 276.402 32.6442 277.11C32.6442 279.043 42.4252 286.689 48.5052 289.509C58.7102 294.242 71.6642 293.345 82.3222 287.168C84.6202 285.837 87.5452 284.756 88.8222 284.768C90.0992 284.779 95.1402 287.47 100.023 290.748C104.906 294.026 111.994 298.166 115.773 299.948C123.523 303.603 124.604 305.254 118.581 304.236C116.347 303.859 109.26 303.558 102.831 303.568C93.7372 303.582 89.8852 304.03 85.4722 305.586C77.6192 308.354 68.4242 314.366 68.8292 316.467C69.4072 319.469 80.1752 323.024 90.1442 323.504C102.671 324.106 108.386 321.886 118.13 312.63C122.418 308.557 126.243 305.747 127.499 305.747C128.666 305.747 132.889 306.631 136.883 307.711C144.625 309.805 158.331 311.747 165.368 311.747C168.932 311.747 169.644 311.424 169.644 309.808C169.644 307.741 168.611 307.496 154.644 306.249C146.522 305.524 137.374 303.816 135.539 302.682C134.444 302.005 134.144 298.529 134.144 286.533C134.144 271.928 134.023 271.001 131.428 265.717C129.934 262.675 127.387 258.917 125.767 257.365L122.823 254.544L121.203 257.016C117.736 262.307 115.411 271.033 115.926 276.819C116.569 284.037 119.217 289.083 125.809 295.649C130.943 300.762 131.031 300.939 128.144 300.341C124.224 299.53 107.676 291.278 102.609 287.607C97.7452 284.083 97.6052 282.124 101.612 273.652C105.553 265.317 106.977 257.92 106.4 248.78C105.896 240.802 104.189 235.747 101.998 235.747C101.269 235.747 98.6302 238.335 96.1332 241.497C86.8962 253.194 86.4092 265.463 94.6672 278.452C97.8032 283.384 94.1622 281.718 87.5462 275.192C78.4122 266.183 71.6442 257.198 71.6442 254.081C71.6442 252.584 72.9592 250.36 74.9852 248.43C84.7662 239.112 90.3062 226.743 89.4302 216.18C89.1822 213.193 88.6552 210.425 88.2582 210.028C87.0572 208.827 78.8412 213.786 75.0142 218.023C68.9942 224.687 67.3162 229.721 67.9742 239.156C68.2842 243.606 68.8212 248.597 69.1672 250.247L69.7972 253.247L67.7452 250.747C64.5292 246.827 52.6442 222.762 52.6442 220.17C52.6442 217.712 53.4772 216.978 63.2712 210.809C74.4092 203.793 81.7272 190.5 80.7452 179.067C80.6272 177.69 77.3132 178.473 70.4912 181.49C59.5382 186.335 52.6462 196.958 52.6452 208.997C52.6442 212.71 52.2072 215.747 51.6732 215.747C49.7652 215.747 43.6452 190.897 43.6442 183.152C43.6442 179.448 45.9002 177.225 50.6442 176.252C55.5342 175.249 63.3712 171.211 68.3582 167.126C72.9702 163.346 80.3422 150.008 79.3072 147.312C78.8412 146.097 77.7172 145.906 73.9312 146.402C58.4792 148.424 47.5412 158.351 45.1782 172.497C44.7882 174.834 44.0942 176.747 43.6362 176.747C41.5052 176.747 41.2712 156.016 43.2502 142.588C43.8852 138.276 45.9852 137.18 55.1442 136.381C63.3422 135.665 67.6532 134.261 73.2942 130.47C78.5752 126.921 85.8192 118.105 85.3932 115.747C85.0362 113.768 70.9272 113.145 64.8412 114.839C59.0622 116.447 51.3922 123.519 48.0772 130.294C45.3682 135.832 43.1892 137.593 44.1152 133.497C44.3942 132.259 45.2852 127.953 46.0942 123.927C46.9032 119.902 48.7212 112.819 50.1332 108.189C53.0622 98.5884 53.8682 98.0284 63.1762 99.1224C74.9682 100.508 88.0332 96.7344 96.1662 89.5944C100.403 85.8744 99.8582 84.8364 92.3592 82.3404C80.4062 78.3614 67.9472 82.0054 59.1602 92.0504C56.6762 94.8894 54.6452 96.5454 54.6462 95.7304C54.6482 93.9564 64.1102 74.8884 68.2292 68.3564C69.8322 65.8134 71.9272 63.4824 72.8832 63.1764C73.8402 62.8704 78.1152 63.8564 82.3832 65.3684C93.4302 69.2824 104.789 69.3504 112.894 65.5524C116.056 64.0704 118.644 62.2194 118.644 61.4384C118.644 59.7824 112.765 55.5144 107.426 53.2934C102.739 51.3444 93.1582 51.3024 87.7592 53.2074C85.4842 54.0094 81.5702 56.0784 79.0632 57.8034C76.5552 59.5284 74.2552 60.6914 73.9512 60.3874C73.2892 59.7254 84.6672 46.0004 90.8982 39.9464C94.8822 36.0744 96.2102 35.4594 104.234 33.7744C114.678 31.5814 120.898 29.0874 125.43 25.2744C129.114 22.1744 137.644 11.4334 137.644 9.89441C137.644 9.34141 135.115 8.36441 132.025 7.72241C117.158 4.63641 104.149 11.8824 97.0762 27.1874C94.8252 32.0574 92.1562 35.7984 88.4702 39.2474C85.5312 41.9974 80.9932 46.7144 78.3852 49.7304C72.9122 56.0594 72.3722 54.8284 76.5672 45.5774C80.8242 36.1894 82.9262 27.2674 82.8872 18.7474C82.8532 11.0184 80.1622 0.704413 78.0002 0.0154134C77.3712 -0.184587 75.2722 1.58541 73.3342 3.94941Z';

const LAUREL_DEFAULTS = {
  text: '1위',              // backward compat (단일 라인 → lines[0])
  gap: 0,                   // 잎과 텍스트 사이 기본 0 (자연스럽게 붙음)
  color: '#1a1a1a',         // backward compat (마이그레이션 소스)
  leafColor: '#1a1a1a',
  textColor: '#1a1a1a',    // backward compat
  fontSize: 56,             // backward compat
  fontWeight: 700,          // backward compat
  height: 140,
  lines: [{ text: '1위', fontSize: 56, fontWeight: 700, color: '#1a1a1a' }],
};

// dataset.lines 읽기 (backward compat: 단일 text/fontSize/fontWeight/textColor → lines[0])
function _readLaurelLines(block) {
  try {
    const raw = block.dataset.lines;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (_) {}
  // 마이그레이션
  const legacy = block.dataset.color;
  return [{
    text:       block.dataset.text       ?? LAUREL_DEFAULTS.text,
    fontSize:   parseInt(block.dataset.fontSize)   || LAUREL_DEFAULTS.fontSize,
    fontWeight: parseInt(block.dataset.fontWeight) || LAUREL_DEFAULTS.fontWeight,
    color:      block.dataset.textColor || legacy || LAUREL_DEFAULTS.textColor,
  }];
}

function _defaultLaurelCell() {
  return {
    lines: [{ text: '1위', fontSize: 56, fontWeight: 700, color: '#1a1a1a' }],
    leafColor: '#1a1a1a',
    gap: 24,
    height: 140,
  };
}

// dataset.cells 읽기 (backward compat: 단일 lines/leafColor/gap/height → cells[0])
function _readLaurelCells(block) {
  try {
    const raw = block.dataset.cells;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (_) {}
  // 마이그레이션: 기존 단일 데이터 → cells[0]
  const legacy = block.dataset.color;
  return [{
    lines:     _readLaurelLines(block),
    leafColor: block.dataset.leafColor || legacy || '#1a1a1a',
    gap:       parseInt(block.dataset.gap)    || 24,
    height:    parseInt(block.dataset.height) || 140,
  }];
}

function _escLaurelText(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 월계수 색 프리셋 — 단색(solid)은 currentColor 그대로, 그 외는 linearGradient
// 기본 5종(클래식) + Apple 4종(절제) + Multi-stop 5종(대각선·메탈광택·복합)
// 각 프리셋: stops + (선택) angle {x1,y1,x2,y2}로 그라데이션 방향
const LAUREL_FILL_PRESETS = {
  // 클래식 5종 (기존 — 세로 그라데이션, 3 stops)
  gold:     { name: 'Gold',          stops: [['0%',  '#fff4c2'], ['50%', '#d4af37'], ['100%', '#9e7c1e']] },
  silver:   { name: 'Silver',        stops: [['0%',  '#f5f5f5'], ['50%', '#a8a8a8'], ['100%', '#6b6b6b']] },
  bronze:   { name: 'Bronze',        stops: [['0%',  '#f0c8a0'], ['50%', '#a0703c'], ['100%', '#5e3e1a']] },
  rosegold: { name: 'Rose Gold',     stops: [['0%',  '#fce4d6'], ['50%', '#e8a48f'], ['100%', '#a8625a']] },
  platinum: { name: 'Platinum',      stops: [['0%',  '#ffffff'], ['50%', '#cbd5e0'], ['100%', '#778191']] },
  // Apple 디자인 톤 — 절제된 모노톤 + 미세한 highlight (4 stops)
  appleGold:      { name: 'Soft Gold (Apple)',     stops: [['0%', '#f7e6b4'], ['35%', '#e2c277'], ['65%', '#b8923f'], ['100%', '#7f6326']] },
  appleSilver:    { name: 'Cool Silver (Apple)',   stops: [['0%', '#f4f4f6'], ['35%', '#dadbde'], ['65%', '#a8aab0'], ['100%', '#6e7077']] },
  appleMidnight:  { name: 'Midnight (Apple)',      stops: [['0%', '#5a6577'], ['35%', '#39414f'], ['65%', '#1f2530'], ['100%', '#0d1117']] },
  appleStarlight: { name: 'Starlight (Apple)',     stops: [['0%', '#fbf4e6'], ['35%', '#ede0c2'], ['65%', '#c6b387'], ['100%', '#86754a']] },
  // Multi-stop 5종 — 대각선 + 6 stops로 메탈 광택/홀로그래픽 효과 (밋밋함 해소)
  polishedGold: {
    name: 'Polished Gold (광택)',
    stops: [['0%','#a17e2a'],['18%','#fff4c2'],['38%','#d4af37'],['55%','#7c5d18'],['78%','#f8e592'],['100%','#856226']],
    angle: { x1: '0%', y1: '0%', x2: '100%', y2: '100%' },
  },
  mirrorSilver: {
    name: 'Mirror Silver (광택)',
    stops: [['0%','#4a4a4a'],['20%','#ffffff'],['40%','#bababa'],['60%','#6c6c6c'],['80%','#eaeaea'],['100%','#363636']],
    angle: { x1: '0%', y1: '0%', x2: '100%', y2: '100%' },
  },
  champagne: {
    name: 'Champagne Sparkle',
    stops: [['0%','#fff8dc'],['25%','#e6c994'],['50%','#fffaee'],['70%','#c9a063'],['100%','#7c5e2d']],
    angle: { x1: '0%', y1: '0%', x2: '100%', y2: '100%' },
  },
  emeraldMetal: {
    name: 'Emerald Metal',
    stops: [['0%','#0d3320'],['22%','#a3e4c0'],['42%','#2d8c5a'],['58%','#0d3320'],['78%','#5fc790'],['100%','#0a2818']],
    angle: { x1: '0%', y1: '0%', x2: '100%', y2: '100%' },
  },
  iridescent: {
    name: 'Iridescent (홀로)',
    stops: [['0%','#ff9ad8'],['25%','#a0e7ff'],['50%','#fff5a0'],['75%','#a8ffb0'],['100%','#a098ff']],
    angle: { x1: '0%', y1: '0%', x2: '100%', y2: '0%' },
  },
};

function _laurelLeafSvg(width, height, mirror, leafFill) {
  // leaf 크기 고정 (flex-shrink:0 → 텍스트 길어져도 leaf 안 줄어듦)
  // width auto + height 명시 + viewBox로 비율 유지
  const style = `max-width:${width}px;max-height:${height}px;width:auto;height:${height}px;flex-shrink:0;${mirror ? 'transform:scaleX(-1);' : ''}`;
  const preset = (leafFill && leafFill !== 'solid') ? LAUREL_FILL_PRESETS[leafFill] : null;
  let fillAttr = 'currentColor';
  let defs = '';
  if (preset) {
    const gid = 'lrl-grad-' + Math.random().toString(36).slice(2, 9);
    const stopsHtml = preset.stops.map(([off, col]) => `<stop offset="${off}" stop-color="${col}"/>`).join('');
    // 그라데이션 방향: preset.angle이 있으면 그 값, 없으면 세로 (위→아래)
    const a = preset.angle || { x1: '0%', y1: '0%', x2: '0%', y2: '100%' };
    defs = `<defs><linearGradient id="${gid}" x1="${a.x1}" y1="${a.y1}" x2="${a.x2}" y2="${a.y2}">${stopsHtml}</linearGradient></defs>`;
    fillAttr = `url(#${gid})`;
  }
  return `<svg class="laurel-leaf" viewBox="${LAUREL_VIEWBOX}" preserveAspectRatio="xMidYMid meet" fill="none" xmlns="http://www.w3.org/2000/svg" style="${style}">${defs}<path fill-rule="evenodd" clip-rule="evenodd" d="${LAUREL_LEFT_PATH}" fill="${fillAttr}"/></svg>`;
}

function _renderLaurelCellHtml(cell, idx) {
  const gap       = Number.isFinite(parseInt(cell.gap)) ? parseInt(cell.gap) : 24;
  const leafColor = cell.leafColor        || '#1a1a1a';
  const leafFill  = cell.leafFill         || 'solid';   // 'solid' | 'gold' | 'silver' | 'bronze' | 'rosegold' | 'platinum'
  const height    = parseInt(cell.height) || 140;
  const width     = Math.round(height * 170 / 324);
  const lines     = Array.isArray(cell.lines) && cell.lines.length > 0
    ? cell.lines
    : [{ text: '1위', fontSize: 56, fontWeight: 700, color: '#1a1a1a' }];
  const linesHtml = lines.map(ln => {
    const fs = parseInt(ln.fontSize)   || LAUREL_DEFAULTS.fontSize;
    const fw = parseInt(ln.fontWeight) || LAUREL_DEFAULTS.fontWeight;
    const cl = ln.color || LAUREL_DEFAULTS.textColor;
    const ls = (ln.letterSpacing !== undefined && ln.letterSpacing !== null && !isNaN(parseFloat(ln.letterSpacing))) ? parseFloat(ln.letterSpacing) : 0;
    return `<span class="laurel-text-line" style="font-size:${fs}px;font-weight:${fw};line-height:1.1;white-space:nowrap;color:${cl};letter-spacing:${ls}px;">${_escLaurelText(ln.text)}</span>`;
  }).join('');
  return `
    <div class="laurel-cell" data-cell-idx="${idx}" style="color:${leafColor};">
      <div class="laurel-inner" style="position:relative;width:100%;display:flex;align-items:center;justify-content:center;min-height:${height}px;">
        <span class="laurel-leaf-left" style="position:absolute;left:${gap}px;top:50%;transform:translateY(-50%);display:flex;align-items:center;">${_laurelLeafSvg(width, height, false, leafFill)}</span>
        <span class="laurel-text-stack" style="position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;text-align:center;">${linesHtml}</span>
        <span class="laurel-leaf-right" style="position:absolute;right:${gap}px;top:50%;transform:translateY(-50%);display:flex;align-items:center;">${_laurelLeafSvg(width, height, true, leafFill)}</span>
      </div>
    </div>`;
}

function renderLaurelBlock(block) {
  const cols  = Math.max(1, parseInt(block.dataset.gridCols) || 1);
  const rows  = Math.max(1, parseInt(block.dataset.gridRows) || 1);
  const total = cols * rows;
  let cells   = _readLaurelCells(block);

  // 그리드 크기에 맞춰 cells push/pop
  if (cells.length < total) {
    const seed = cells[0] || _defaultLaurelCell();
    while (cells.length < total) cells.push(JSON.parse(JSON.stringify(seed)));
  } else if (cells.length > total) {
    cells = cells.slice(0, total);
  }
  block.dataset.cells    = JSON.stringify(cells);
  block.dataset.gridCols = String(cols);
  block.dataset.gridRows = String(rows);

  block.style.display              = 'grid';
  // minmax(0, 1fr): 셀이 자식 콘텐츠 size를 무시하고 균등 분배 (컨테이너 초과 방지)
  block.style.gridTemplateColumns  = `repeat(${cols}, minmax(0, 1fr))`;
  block.style.gridTemplateRows     = `repeat(${rows}, auto)`;
  block.style.columnGap            = (parseInt(block.dataset.gridColGap) || 32) + 'px';
  block.style.rowGap               = (parseInt(block.dataset.gridRowGap) || 24) + 'px';
  block.innerHTML = cells.map((c, i) => _renderLaurelCellHtml(c, i)).join('');
}

function makeLaurelBlock(opts = {}) {
  const block = document.createElement('div');
  block.className = 'laurel-block';
  block.id = 'lrb_' + Math.random().toString(36).slice(2, 8);
  block.dataset.type       = 'laurel';
  // 그리드 + cells 모델 (옛 단일 opts는 cells[0]로 변환)
  const cols = Math.max(1, parseInt(opts.gridCols) || 1);
  const rows = Math.max(1, parseInt(opts.gridRows) || 1);
  block.dataset.gridCols = String(cols);
  block.dataset.gridRows = String(rows);

  const cellSeed = {
    lines: Array.isArray(opts.lines) && opts.lines.length > 0
      ? opts.lines
      : [{
          text:       opts.text       ?? LAUREL_DEFAULTS.text,
          fontSize:   opts.fontSize   ?? LAUREL_DEFAULTS.fontSize,
          fontWeight: opts.fontWeight ?? LAUREL_DEFAULTS.fontWeight,
          color:      opts.textColor  ?? opts.color ?? LAUREL_DEFAULTS.textColor,
        }],
    leafColor: opts.leafColor ?? opts.color ?? LAUREL_DEFAULTS.leafColor,
    gap:       opts.gap       ?? LAUREL_DEFAULTS.gap,
    height:    opts.height    ?? LAUREL_DEFAULTS.height,
  };
  const total = cols * rows;
  const initCells = Array.isArray(opts.cells) && opts.cells.length > 0
    ? opts.cells.slice(0, total)
    : [cellSeed];
  while (initCells.length < total) initCells.push(JSON.parse(JSON.stringify(cellSeed)));
  block.dataset.cells = JSON.stringify(initCells);
  renderLaurelBlock(block);

  const row = document.createElement('div');
  row.className = 'row';
  row.dataset.layout = 'stack';
  row.appendChild(block);
  return { row, block };
}

function addLaurelBlock(opts = {}) {
  const sec = window.getSelectedSection?.();
  if (!sec) { window.showNoSelectionHint?.(); return; }
  window.pushHistory();
  const { row, block } = makeLaurelBlock(opts);
  insertAfterSelected(sec, row);
  bindBlock(block);
  window.buildLayerPanel();
  // 방금 추가한 블록 자동 선택 + 화면 안으로 스크롤 (C9)
  try { window.selectBlock?.(block.id); } catch (_) {}
  row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  window.triggerAutoSave?.();
}

// ── 수정 ─────────────────────────────────────────────────────────────────────
// PM의 update_laurel_block(MCP) → main(_invokeRendererUpdateLaurelBlock) → 여기.
// banner02 패턴 미러: pushHistory + dataset partial write + renderLaurelBlock 재렌더 + triggerAutoSave.
// 데이터 모델: dataset.cells = JSON.stringify([{ lines:[{text,fontSize,fontWeight,color,letterSpacing}], leafColor, leafFill, gap, height }])
// 지원 partial:
//   - layerName, gridCols, gridRows, gridColGap, gridRowGap (dataset 직접 set)
//   - cells (배열 전체 교체)
//   - editCell { index, lines?, leafColor?, leafFill?, gap?, height? } (단일 cell 부분 머지)
//   - addLine    { cellIndex, line:{text,fontSize,fontWeight,color,letterSpacing}, atIndex? }
//   - removeLine { cellIndex, lineIndex }   (마지막 1개 보호)
//   - editLine   { cellIndex, lineIndex, text?, fontSize?, fontWeight?, color?, letterSpacing? }
//   - allGap, allHeight, allLeafColor, allLeafFill (모든 cells 일괄 적용)
function updateLaurelBlock(blockId, partial = {}) {
  if (!blockId) return { ok: false, code: 'NOT_FOUND', message: 'blockId required' };
  if (typeof blockId !== 'string' || !blockId.startsWith('lrb_')) {
    return { ok: false, code: 'INVALID', message: `invalid blockId: ${blockId} (must start with lrb_)` };
  }
  const block = document.getElementById(String(blockId));
  if (!block || !block.classList.contains('laurel-block')) {
    return { ok: false, code: 'NOT_FOUND', message: `laurel-block not found: ${blockId}` };
  }
  if (partial == null || typeof partial !== 'object') {
    return { ok: false, code: 'INVALID', message: 'partial must be object' };
  }
  const keys = Object.keys(partial);
  if (keys.length === 0) {
    return { ok: false, code: 'INVALID', message: 'partial is empty — provide at least one laurel field' };
  }

  // ── 보안 가드 (renderer side double-check — main 에서 한 번 거쳤어도 무결성용) ──
  const _COLOR_RE  = /^#[0-9a-fA-F]{3,8}$|^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$/;
  const _isColor = (v) => typeof v === 'string' && v.length > 0 && v.length <= 64 && (_COLOR_RE.test(v.trim()) || v.trim() === 'transparent');
  const _LEAF_FILLS = ['solid','gold','silver','bronze','rosegold','platinum','appleGold','appleSilver','appleMidnight','appleStarlight','polishedGold','mirrorSilver','champagne','emeraldMetal','iridescent'];
  const _isInt   = (n, min, max) => Number.isInteger(n) && (min === undefined || n >= min) && (max === undefined || n <= max);
  const _isNum   = (n, min, max) => Number.isFinite(n) && (min === undefined || n >= min) && (max === undefined || n <= max);
  const _normLine = (l, ctx) => {
    if (!l || typeof l !== 'object') throw new Error(`${ctx} must be object`);
    const o = {};
    if (l.text !== undefined && l.text !== null) {
      if (typeof l.text !== 'string') throw new Error(`${ctx}.text must be string`);
      if ([...l.text].length > 500) throw new Error(`${ctx}.text too long (>500)`);
      o.text = l.text;
    }
    if (l.fontSize !== undefined && l.fontSize !== null) {
      const n = parseInt(l.fontSize);
      if (!_isInt(n, 8, 400)) throw new Error(`${ctx}.fontSize out of range [8,400]`);
      o.fontSize = n;
    }
    if (l.fontWeight !== undefined && l.fontWeight !== null) {
      const n = parseInt(l.fontWeight);
      if (!_isInt(n, 100, 900)) throw new Error(`${ctx}.fontWeight out of range [100,900]`);
      o.fontWeight = n;
    }
    if (l.color !== undefined && l.color !== null) {
      if (!_isColor(l.color)) throw new Error(`${ctx}.color invalid`);
      o.color = l.color.trim();
    }
    if (l.letterSpacing !== undefined && l.letterSpacing !== null) {
      const n = parseFloat(l.letterSpacing);
      if (!_isNum(n, -20, 50)) throw new Error(`${ctx}.letterSpacing out of range [-20,50]`);
      o.letterSpacing = n;
    }
    return o;
  };
  const _normCell = (c, ctx) => {
    if (!c || typeof c !== 'object') throw new Error(`${ctx} must be object`);
    const o = {};
    if (c.lines !== undefined && c.lines !== null) {
      if (!Array.isArray(c.lines)) throw new Error(`${ctx}.lines must be array`);
      if (c.lines.length < 1 || c.lines.length > 20) throw new Error(`${ctx}.lines length must be in [1,20]`);
      o.lines = c.lines.map((ln, i) => {
        const merged = _normLine(ln, `${ctx}.lines[${i}]`);
        // 신규 line 필수 필드 보강
        return {
          text:       merged.text       !== undefined ? merged.text       : '',
          fontSize:   merged.fontSize   !== undefined ? merged.fontSize   : 56,
          fontWeight: merged.fontWeight !== undefined ? merged.fontWeight : 700,
          color:      merged.color      !== undefined ? merged.color      : '#1a1a1a',
          ...(merged.letterSpacing !== undefined ? { letterSpacing: merged.letterSpacing } : {}),
        };
      });
    }
    if (c.leafColor !== undefined && c.leafColor !== null) {
      if (!_isColor(c.leafColor)) throw new Error(`${ctx}.leafColor invalid`);
      o.leafColor = c.leafColor.trim();
    }
    if (c.leafFill !== undefined && c.leafFill !== null) {
      if (!_LEAF_FILLS.includes(c.leafFill)) throw new Error(`${ctx}.leafFill invalid (allowed: ${_LEAF_FILLS.join('|')})`);
      o.leafFill = c.leafFill;
    }
    if (c.gap !== undefined && c.gap !== null) {
      const n = parseInt(c.gap);
      if (!_isInt(n, 0, 2000)) throw new Error(`${ctx}.gap out of range [0,2000]`);
      o.gap = n;
    }
    if (c.height !== undefined && c.height !== null) {
      const n = parseInt(c.height);
      if (!_isInt(n, 20, 600)) throw new Error(`${ctx}.height out of range [20,600]`);
      o.height = n;
    }
    return o;
  };

  // ── before 스냅샷 (mutate 전, undo 푸시 전) ──
  const before = {
    gridCols:   block.dataset.gridCols,
    gridRows:   block.dataset.gridRows,
    gridColGap: block.dataset.gridColGap,
    gridRowGap: block.dataset.gridRowGap,
    layerName:  block.dataset.layerName,
    cells:      block.dataset.cells,
  };

  window.pushHistory?.('Laurel 수정');

  const applied = {};

  // ── 1) 단순 dataset 필드 ──
  if (partial.layerName !== undefined && partial.layerName !== null) {
    if (typeof partial.layerName !== 'string') return { ok: false, code: 'INVALID', message: 'layerName must be string' };
    if ([...partial.layerName].length > 100)   return { ok: false, code: 'INVALID', message: 'layerName too long (>100)' };
    block.dataset.layerName = partial.layerName;
    applied.layerName = partial.layerName;
  }
  if (partial.gridCols !== undefined && partial.gridCols !== null) {
    const n = parseInt(partial.gridCols);
    if (!_isInt(n, 1, 4)) return { ok: false, code: 'INVALID', message: 'gridCols out of range [1,4]' };
    block.dataset.gridCols = String(n);
    applied.gridCols = n;
  }
  if (partial.gridRows !== undefined && partial.gridRows !== null) {
    const n = parseInt(partial.gridRows);
    if (!_isInt(n, 1, 4)) return { ok: false, code: 'INVALID', message: 'gridRows out of range [1,4]' };
    block.dataset.gridRows = String(n);
    applied.gridRows = n;
  }
  if (partial.gridColGap !== undefined && partial.gridColGap !== null) {
    const n = parseInt(partial.gridColGap);
    if (!_isInt(n, 0, 400)) return { ok: false, code: 'INVALID', message: 'gridColGap out of range [0,400]' };
    block.dataset.gridColGap = String(n);
    applied.gridColGap = n;
  }
  if (partial.gridRowGap !== undefined && partial.gridRowGap !== null) {
    const n = parseInt(partial.gridRowGap);
    if (!_isInt(n, 0, 400)) return { ok: false, code: 'INVALID', message: 'gridRowGap out of range [0,400]' };
    block.dataset.gridRowGap = String(n);
    applied.gridRowGap = n;
  }

  // ── 2) cells 모델 조작 (renderer-side 처리: dataset.cells 직접 mutate) ──
  // _readLaurelCells가 backward-compat 마이그레이션도 처리하므로 현재 cells 시드를 거기서 가져옴
  let cells;
  try {
    cells = (typeof window._readLaurelCells === 'function')
      ? window._readLaurelCells(block)
      : (block.dataset.cells ? JSON.parse(block.dataset.cells) : [{ lines:[{text:'1위',fontSize:56,fontWeight:700,color:'#1a1a1a'}], leafColor:'#1a1a1a', gap:24, height:140 }]);
    if (!Array.isArray(cells) || cells.length === 0) {
      cells = [{ lines:[{text:'1위',fontSize:56,fontWeight:700,color:'#1a1a1a'}], leafColor:'#1a1a1a', gap:24, height:140 }];
    }
  } catch (e) {
    return { ok: false, code: 'INVALID', message: `cells parse failed: ${e.message}` };
  }

  try {
    // (a) cells 전체 교체 — 최우선
    if (partial.cells !== undefined && partial.cells !== null) {
      if (!Array.isArray(partial.cells)) return { ok: false, code: 'INVALID', message: 'cells must be array' };
      if (partial.cells.length < 1 || partial.cells.length > 16) return { ok: false, code: 'INVALID', message: 'cells length must be in [1,16]' };
      const next = partial.cells.map((c, i) => {
        const validated = _normCell(c, `cells[${i}]`);
        return {
          lines:     validated.lines     !== undefined ? validated.lines     : [{ text:'1위', fontSize:56, fontWeight:700, color:'#1a1a1a' }],
          leafColor: validated.leafColor !== undefined ? validated.leafColor : '#1a1a1a',
          leafFill:  validated.leafFill  !== undefined ? validated.leafFill  : 'solid',
          gap:       validated.gap       !== undefined ? validated.gap       : 24,
          height:    validated.height    !== undefined ? validated.height    : 140,
        };
      });
      cells = next;
      applied.cells = cells;
    }

    // (b) editCell — 단일 cell 부분 머지
    if (partial.editCell !== undefined && partial.editCell !== null) {
      const e = partial.editCell;
      if (typeof e !== 'object') return { ok: false, code: 'INVALID', message: 'editCell must be object' };
      if (!_isInt(parseInt(e.index), 0, 15)) return { ok: false, code: 'INVALID', message: 'editCell.index must be integer in [0,15]' };
      const idx = parseInt(e.index);
      if (idx >= cells.length) return { ok: false, code: 'NOT_FOUND', message: `editCell.index ${idx} out of bounds (cells.length=${cells.length})` };
      const patch = _normCell(e, 'editCell');
      cells[idx] = { ...cells[idx], ...patch };
      applied.editCell = { index: idx, ...patch };
    }

    // (c) addLine — 특정 cell에 line 추가
    if (partial.addLine !== undefined && partial.addLine !== null) {
      const a = partial.addLine;
      if (typeof a !== 'object') return { ok: false, code: 'INVALID', message: 'addLine must be object' };
      if (!_isInt(parseInt(a.cellIndex), 0, 15)) return { ok: false, code: 'INVALID', message: 'addLine.cellIndex must be integer in [0,15]' };
      const ci = parseInt(a.cellIndex);
      if (ci >= cells.length) return { ok: false, code: 'NOT_FOUND', message: `addLine.cellIndex ${ci} out of bounds` };
      if (!a.line || typeof a.line !== 'object') return { ok: false, code: 'INVALID', message: 'addLine.line must be object' };
      const newLineRaw = _normLine(a.line, 'addLine.line');
      const newLine = {
        text:       newLineRaw.text       !== undefined ? newLineRaw.text       : '',
        fontSize:   newLineRaw.fontSize   !== undefined ? newLineRaw.fontSize   : 56,
        fontWeight: newLineRaw.fontWeight !== undefined ? newLineRaw.fontWeight : 700,
        color:      newLineRaw.color      !== undefined ? newLineRaw.color      : '#1a1a1a',
        ...(newLineRaw.letterSpacing !== undefined ? { letterSpacing: newLineRaw.letterSpacing } : {}),
      };
      const targetCell = cells[ci];
      const curLines = Array.isArray(targetCell.lines) ? targetCell.lines.slice() : [];
      if (curLines.length >= 20) return { ok: false, code: 'INVALID', message: `addLine: cell[${ci}].lines limit reached (20)` };
      let at = curLines.length;
      if (a.atIndex !== undefined && a.atIndex !== null) {
        if (!_isInt(parseInt(a.atIndex), 0, 20)) return { ok: false, code: 'INVALID', message: 'addLine.atIndex must be integer in [0,20]' };
        at = Math.max(0, Math.min(curLines.length, parseInt(a.atIndex)));
      }
      curLines.splice(at, 0, newLine);
      cells[ci] = { ...targetCell, lines: curLines };
      applied.addLine = { cellIndex: ci, atIndex: at, line: newLine };
    }

    // (d) removeLine — 특정 cell의 line 제거 (마지막 1개 보호)
    if (partial.removeLine !== undefined && partial.removeLine !== null) {
      const r = partial.removeLine;
      if (typeof r !== 'object') return { ok: false, code: 'INVALID', message: 'removeLine must be object' };
      if (!_isInt(parseInt(r.cellIndex), 0, 15)) return { ok: false, code: 'INVALID', message: 'removeLine.cellIndex must be integer in [0,15]' };
      const ci = parseInt(r.cellIndex);
      if (ci >= cells.length) return { ok: false, code: 'NOT_FOUND', message: `removeLine.cellIndex ${ci} out of bounds` };
      if (!_isInt(parseInt(r.lineIndex), 0, 19)) return { ok: false, code: 'INVALID', message: 'removeLine.lineIndex must be integer in [0,19]' };
      const li = parseInt(r.lineIndex);
      const targetCell = cells[ci];
      const curLines = Array.isArray(targetCell.lines) ? targetCell.lines.slice() : [];
      if (li >= curLines.length) return { ok: false, code: 'NOT_FOUND', message: `removeLine.lineIndex ${li} out of bounds (cell[${ci}].lines.length=${curLines.length})` };
      if (curLines.length <= 1)  return { ok: false, code: 'INVALID', message: `cannot remove last remaining line in cell[${ci}]` };
      const removed = curLines.splice(li, 1)[0];
      cells[ci] = { ...targetCell, lines: curLines };
      applied.removeLine = { cellIndex: ci, lineIndex: li, removed };
    }

    // (e) editLine — 특정 cell의 특정 line 부분 머지
    if (partial.editLine !== undefined && partial.editLine !== null) {
      const e = partial.editLine;
      if (typeof e !== 'object') return { ok: false, code: 'INVALID', message: 'editLine must be object' };
      if (!_isInt(parseInt(e.cellIndex), 0, 15)) return { ok: false, code: 'INVALID', message: 'editLine.cellIndex must be integer in [0,15]' };
      const ci = parseInt(e.cellIndex);
      if (ci >= cells.length) return { ok: false, code: 'NOT_FOUND', message: `editLine.cellIndex ${ci} out of bounds` };
      if (!_isInt(parseInt(e.lineIndex), 0, 19)) return { ok: false, code: 'INVALID', message: 'editLine.lineIndex must be integer in [0,19]' };
      const li = parseInt(e.lineIndex);
      const targetCell = cells[ci];
      const curLines = Array.isArray(targetCell.lines) ? targetCell.lines.slice() : [];
      if (li >= curLines.length) return { ok: false, code: 'NOT_FOUND', message: `editLine.lineIndex ${li} out of bounds` };
      const patch = _normLine(e, 'editLine');
      curLines[li] = { ...curLines[li], ...patch };
      cells[ci] = { ...targetCell, lines: curLines };
      applied.editLine = { cellIndex: ci, lineIndex: li, ...patch };
    }

    // (f) 일괄 적용 (모든 cells)
    if (partial.allGap !== undefined && partial.allGap !== null) {
      const n = parseInt(partial.allGap);
      if (!_isInt(n, 0, 2000)) return { ok: false, code: 'INVALID', message: 'allGap out of range [0,2000]' };
      cells = cells.map(c => ({ ...c, gap: n }));
      applied.allGap = n;
    }
    if (partial.allHeight !== undefined && partial.allHeight !== null) {
      const n = parseInt(partial.allHeight);
      if (!_isInt(n, 20, 600)) return { ok: false, code: 'INVALID', message: 'allHeight out of range [20,600]' };
      cells = cells.map(c => ({ ...c, height: n }));
      applied.allHeight = n;
    }
    if (partial.allLeafColor !== undefined && partial.allLeafColor !== null) {
      if (!_isColor(partial.allLeafColor)) return { ok: false, code: 'INVALID', message: 'allLeafColor invalid' };
      const v = partial.allLeafColor.trim();
      cells = cells.map(c => ({ ...c, leafColor: v }));
      applied.allLeafColor = v;
    }
    if (partial.allLeafFill !== undefined && partial.allLeafFill !== null) {
      if (!_LEAF_FILLS.includes(partial.allLeafFill)) return { ok: false, code: 'INVALID', message: `allLeafFill invalid (allowed: ${_LEAF_FILLS.join('|')})` };
      cells = cells.map(c => ({ ...c, leafFill: partial.allLeafFill }));
      applied.allLeafFill = partial.allLeafFill;
    }
  } catch (e) {
    return { ok: false, code: 'INVALID', message: e.message };
  }

  // cells 길이 1~16 가드 (방어적)
  if (cells.length < 1 || cells.length > 16) {
    return { ok: false, code: 'INVALID', message: `cells length out of range [1,16]: ${cells.length}` };
  }

  // dataset.cells commit (renderLaurelBlock도 길이 보정하지만 명시적으로 한번 더)
  block.dataset.cells = JSON.stringify(cells);

  // ── 3) 재렌더 ──
  try {
    if (typeof window.renderLaurelBlock === 'function') {
      window.renderLaurelBlock(block);
    }
  } catch (e) {
    return { ok: false, code: 'RENDER_ERROR', message: e.message };
  }

  // ── 4) 우측 패널 / 레이어 패널 갱신 ──
  if (block.classList.contains('selected')) {
    try { window.showLaurelProperties?.(block); } catch (_) {}
  }
  try { window.buildLayerPanel?.(); } catch (_) {}

  // ── 5) autosave ──
  try { window.triggerAutoSave?.(); } catch (_) {}
  try { window.scheduleAutoSave?.(); } catch (_) {}

  // ── 6) 응답 ──
  const finalCells = (() => { try { return JSON.parse(block.dataset.cells || '[]'); } catch (_) { return []; } })();
  return {
    ok: true,
    blockId,
    cellsCount: finalCells.length,
    gridCols: parseInt(block.dataset.gridCols) || 1,
    gridRows: parseInt(block.dataset.gridRows) || 1,
    before,
    applied,
  };
}

// ── window 노출 ────────────────────────────────────────────────────────────
window.makeLaurelBlock     = makeLaurelBlock;
window.addLaurelBlock      = addLaurelBlock;
window.renderLaurelBlock   = renderLaurelBlock;
window._readLaurelLines    = _readLaurelLines;
window._readLaurelCells    = _readLaurelCells;
window._renderLaurelCellHtml = _renderLaurelCellHtml;
window.LAUREL_FILL_PRESETS = LAUREL_FILL_PRESETS;
window.updateLaurelBlock   = updateLaurelBlock;

export {
  makeLaurelBlock,
  addLaurelBlock,
  updateLaurelBlock,
  renderLaurelBlock,
  LAUREL_FILL_PRESETS,
  LAUREL_DEFAULTS,
};
