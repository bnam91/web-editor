// ── Laurel Block (월계수) ────────────────────────────────────────────────────
// 좌우 월계수 SVG + 가운데 텍스트. 트로피/수상 마크.
//
// 의존성:
//   - insertAfterSelected (drag-utils.js)
//   - bindBlock (drag-drop.js)

import { insertAfterSelected } from '../drag-utils.js';
import { bindBlock } from '../drag-drop.js';
import { lnLinesHtml, lnValidateLines, lnRemark, LAUREL_LN_KINDS, LAUREL_IMG_DEFAULT_H } from './line-host.js';   // ★1013t1B2 — 줄은 그리드 줄 렌더 «한 길» · 네 번째 주인(comparison-block.js 와 같은 import · 사본 금지)
import { GRID_ROLES, gridPlusLayer } from './grid-block.js';   // ★1013t1B2 — 「글자 줄인가」= 역할표에 있나(comparison-block.js 와 같은 import)

const LAUREL_VIEWBOX = '0 0 170 324';
const LAUREL_LEFT_PATH = 'M73.3342 3.94941C62.1592 17.5874 60.6742 33.1004 69.1282 47.8894C70.4992 50.2864 71.6252 53.3084 71.6322 54.6054C71.6392 55.9024 69.4062 60.3094 66.6712 64.3994C63.9352 68.4894 59.8122 75.6404 57.5072 80.2914C55.2032 84.9424 52.9142 88.7474 52.4222 88.7474C51.9292 88.7474 51.7602 88.3694 52.0452 87.9074C52.3312 87.4454 53.0642 82.9544 53.6762 77.9274C55.6012 62.0924 52.1942 48.2984 44.0472 38.9484L40.8222 35.2474L38.6432 40.2474C31.1052 57.5474 33.1222 71.5894 44.9882 84.4054C48.0992 87.7654 50.6442 91.4094 50.6442 92.5034C50.6442 93.5974 49.0632 99.3204 47.1302 105.22C45.1972 111.12 43.0702 118.827 42.4022 122.347C41.7342 125.867 40.8732 128.747 40.4882 128.747C40.1032 128.747 39.5132 126.159 39.1782 122.997C38.1292 113.119 35.5582 103.476 32.3572 97.4134C29.0602 91.1714 19.2242 81.4894 16.6772 81.9794C13.5802 82.5764 12.6612 98.4724 15.2592 106.517C17.6232 113.839 23.2072 120.575 31.6712 126.317L39.1442 131.387L39.0712 136.317C38.8122 153.763 38.0532 170.735 37.5312 170.74C37.1942 170.744 35.4852 166.741 33.7332 161.845C30.5462 152.935 24.6562 143.281 19.7532 138.933C15.4782 135.141 3.54924 129.442 2.36524 130.626C0.608237 132.383 3.31724 145.566 6.91024 152.74C11.0822 161.07 19.4332 167.714 29.6212 170.809C33.4232 171.963 36.9502 173.434 37.4602 174.078C37.9702 174.721 38.9262 179.627 39.5862 184.981C40.2452 190.334 41.6622 198.388 42.7342 202.878C43.8062 207.367 44.5012 211.224 44.2772 211.448C44.0532 211.672 41.7882 208.724 39.2432 204.896C33.5862 196.386 23.8592 187.197 17.7252 184.567C11.4082 181.86 1.36724 179.624 0.302237 180.689C-0.725763 181.717 0.938235 187.292 4.23624 193.877C6.97924 199.351 13.6532 206.184 18.8642 208.852C24.0622 211.514 33.1812 213.747 38.8542 213.747C43.6232 213.747 47.6442 216.099 47.6442 218.889C47.6442 220.693 54.7002 236.651 58.3662 243.138C60.1972 246.378 61.4772 249.247 61.2102 249.514C60.9442 249.781 57.6992 247.226 54.0002 243.836C43.3502 234.077 30.4692 228.72 17.7582 228.762C15.2202 228.771 12.4702 229.204 11.6462 229.724C10.3342 230.554 10.3752 231.092 11.9802 234.072C14.8672 239.434 22.4202 247.535 26.9772 250.16C29.2692 251.479 33.6802 253.111 36.7792 253.786C42.0452 254.933 44.9502 254.849 58.2692 253.165L63.3952 252.516L68.9882 260.08C72.0652 264.24 77.5752 270.817 81.2342 274.695C84.8932 278.574 87.3692 281.747 86.7372 281.747C86.1042 281.747 83.0122 280.449 79.8652 278.862C65.5442 271.64 51.7722 269.919 39.2492 273.787C35.6012 274.914 32.6442 276.402 32.6442 277.11C32.6442 279.043 42.4252 286.689 48.5052 289.509C58.7102 294.242 71.6642 293.345 82.3222 287.168C84.6202 285.837 87.5452 284.756 88.8222 284.768C90.0992 284.779 95.1402 287.47 100.023 290.748C104.906 294.026 111.994 298.166 115.773 299.948C123.523 303.603 124.604 305.254 118.581 304.236C116.347 303.859 109.26 303.558 102.831 303.568C93.7372 303.582 89.8852 304.03 85.4722 305.586C77.6192 308.354 68.4242 314.366 68.8292 316.467C69.4072 319.469 80.1752 323.024 90.1442 323.504C102.671 324.106 108.386 321.886 118.13 312.63C122.418 308.557 126.243 305.747 127.499 305.747C128.666 305.747 132.889 306.631 136.883 307.711C144.625 309.805 158.331 311.747 165.368 311.747C168.932 311.747 169.644 311.424 169.644 309.808C169.644 307.741 168.611 307.496 154.644 306.249C146.522 305.524 137.374 303.816 135.539 302.682C134.444 302.005 134.144 298.529 134.144 286.533C134.144 271.928 134.023 271.001 131.428 265.717C129.934 262.675 127.387 258.917 125.767 257.365L122.823 254.544L121.203 257.016C117.736 262.307 115.411 271.033 115.926 276.819C116.569 284.037 119.217 289.083 125.809 295.649C130.943 300.762 131.031 300.939 128.144 300.341C124.224 299.53 107.676 291.278 102.609 287.607C97.7452 284.083 97.6052 282.124 101.612 273.652C105.553 265.317 106.977 257.92 106.4 248.78C105.896 240.802 104.189 235.747 101.998 235.747C101.269 235.747 98.6302 238.335 96.1332 241.497C86.8962 253.194 86.4092 265.463 94.6672 278.452C97.8032 283.384 94.1622 281.718 87.5462 275.192C78.4122 266.183 71.6442 257.198 71.6442 254.081C71.6442 252.584 72.9592 250.36 74.9852 248.43C84.7662 239.112 90.3062 226.743 89.4302 216.18C89.1822 213.193 88.6552 210.425 88.2582 210.028C87.0572 208.827 78.8412 213.786 75.0142 218.023C68.9942 224.687 67.3162 229.721 67.9742 239.156C68.2842 243.606 68.8212 248.597 69.1672 250.247L69.7972 253.247L67.7452 250.747C64.5292 246.827 52.6442 222.762 52.6442 220.17C52.6442 217.712 53.4772 216.978 63.2712 210.809C74.4092 203.793 81.7272 190.5 80.7452 179.067C80.6272 177.69 77.3132 178.473 70.4912 181.49C59.5382 186.335 52.6462 196.958 52.6452 208.997C52.6442 212.71 52.2072 215.747 51.6732 215.747C49.7652 215.747 43.6452 190.897 43.6442 183.152C43.6442 179.448 45.9002 177.225 50.6442 176.252C55.5342 175.249 63.3712 171.211 68.3582 167.126C72.9702 163.346 80.3422 150.008 79.3072 147.312C78.8412 146.097 77.7172 145.906 73.9312 146.402C58.4792 148.424 47.5412 158.351 45.1782 172.497C44.7882 174.834 44.0942 176.747 43.6362 176.747C41.5052 176.747 41.2712 156.016 43.2502 142.588C43.8852 138.276 45.9852 137.18 55.1442 136.381C63.3422 135.665 67.6532 134.261 73.2942 130.47C78.5752 126.921 85.8192 118.105 85.3932 115.747C85.0362 113.768 70.9272 113.145 64.8412 114.839C59.0622 116.447 51.3922 123.519 48.0772 130.294C45.3682 135.832 43.1892 137.593 44.1152 133.497C44.3942 132.259 45.2852 127.953 46.0942 123.927C46.9032 119.902 48.7212 112.819 50.1332 108.189C53.0622 98.5884 53.8682 98.0284 63.1762 99.1224C74.9682 100.508 88.0332 96.7344 96.1662 89.5944C100.403 85.8744 99.8582 84.8364 92.3592 82.3404C80.4062 78.3614 67.9472 82.0054 59.1602 92.0504C56.6762 94.8894 54.6452 96.5454 54.6462 95.7304C54.6482 93.9564 64.1102 74.8884 68.2292 68.3564C69.8322 65.8134 71.9272 63.4824 72.8832 63.1764C73.8402 62.8704 78.1152 63.8564 82.3832 65.3684C93.4302 69.2824 104.789 69.3504 112.894 65.5524C116.056 64.0704 118.644 62.2194 118.644 61.4384C118.644 59.7824 112.765 55.5144 107.426 53.2934C102.739 51.3444 93.1582 51.3024 87.7592 53.2074C85.4842 54.0094 81.5702 56.0784 79.0632 57.8034C76.5552 59.5284 74.2552 60.6914 73.9512 60.3874C73.2892 59.7254 84.6672 46.0004 90.8982 39.9464C94.8822 36.0744 96.2102 35.4594 104.234 33.7744C114.678 31.5814 120.898 29.0874 125.43 25.2744C129.114 22.1744 137.644 11.4334 137.644 9.89441C137.644 9.34141 135.115 8.36441 132.025 7.72241C117.158 4.63641 104.149 11.8824 97.0762 27.1874C94.8252 32.0574 92.1562 35.7984 88.4702 39.2474C85.5312 41.9974 80.9932 46.7144 78.3852 49.7304C72.9122 56.0594 72.3722 54.8284 76.5672 45.5774C80.8242 36.1894 82.9262 27.2674 82.8872 18.7474C82.8532 11.0184 80.1622 0.704413 78.0002 0.0154134C77.3712 -0.184587 75.2722 1.58541 73.3342 3.94941Z';   // ★1017t1g3㉡ — 손으로 그린 월계수 가지 실루엣(줄기 ＋ 잎 8장, 외부 아이콘 0). viewBox 를 거의 채운다(좌우 비대칭).

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

// dataset.textEffect 읽기 (이스터에그 **text_ — text-block과 동일 key)
// 없거나 JSON 깨짐 → null (효과 미적용 경로를 명확히 분리, 현행과 동일 렌더)
function _readLaurelTextEffect(block) {
  try {
    const raw = block.dataset.textEffect;
    if (!raw) return null;
    const cfg = JSON.parse(raw);
    if (!cfg || typeof cfg !== 'object') return null;
    return cfg;
  } catch (_) {
    return null;
  }
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

/* ★1013t1B2 C1 — 옛 줄 → 그리드 줄 «보기»(데이터는 안 바꾼다 · 저장 꼴 무변).
 *   옛 줄 = {text, fontSize, fontWeight, color, letterSpacing?} · 그리드 줄 = {type, text, fontSize, weight, color, letterSpacing?, lineHeight}.
 *   ★값 기본은 옛 렌더(_renderLaurelCellHtml 의 옛 span)와 «같은 식»이다 — 56 · 700 · #1a1a1a · 줄높이 1.1.
 *   ★type 이 이미 있으면(새 꼴 · C2 부터 생긴다) 그대로 넘긴다 — 줄 단위라 섞인 배열도 읽힌다.
 *   ★textHtml(B1 범위 서식)은 그대로 싣는다 — 그리드 렌더가 그린다(손실 0). */
function _lrlGridLine(l) {
  if (l && typeof l === 'object' && typeof l.type === 'string') return l;
  const o = (l && typeof l === 'object') ? l : {};
  const g = {
    type:       'body',
    text:       String(o.text ?? ''),
    fontSize:   parseInt(o.fontSize)   || LAUREL_DEFAULTS.fontSize,
    weight:     String(parseInt(o.fontWeight) || LAUREL_DEFAULTS.fontWeight),
    color:      o.color || LAUREL_DEFAULTS.textColor,
    lineHeight: 1.1,
  };
  const ls = parseFloat(o.letterSpacing);
  if (o.letterSpacing !== undefined && o.letterSpacing !== null && Number.isFinite(ls)) g.letterSpacing = ls;
  if (typeof o.textHtml === 'string') g.textHtml = o.textHtml;
  return g;
}
/** ★1013t1B2 C3 — 「글자 줄인가」 한 자리(역할표 GRID_ROLES 에 있는 종류). 여백·구분선·그림 = 아니다.
 *  AI 채움(슬롯·쓰기)·Figma 내보내기·editLine 이 «같은 자»로 가른다(window 로 부른다 — 두 벌 금지). */
function _lrlIsTextLine(l) {
  return Object.prototype.hasOwnProperty.call(GRID_ROLES, _lrlGridLine(l).type);
}
/** ★1013t1B2 C3 — 새 꼴(그리드 줄) → 옛 꼴 필드 {text, fontSize, fontWeight:Number, color, letterSpacing?}.
 *  Figma 수신측(figma-renderer/sangpe_to_figma.mjs laurel)이 «옛 이름»(fontWeight)을 읽는다 ⇒ 보내는 쪽이 옛 이름으로 맞춘다.
 *  ★옛 꼴 줄은 _lrlGridLine 을 지나 다시 돌아오므로, 네 필드를 다 가진 옛 줄은 «원래 객체와 같은 값»이 된다(LL11).
 *  ★빈 필드는 렌더와 같은 값으로 채운다: 크기·굵기 = 역할 기본 · 색 = laurel 글자색(스택 상속 #1a1a1a) · 자간 = 역할 em × 크기(px · 0 이면 뺀다). */
function _lrlOldLine(l) {
  const g = _lrlGridLine(l);
  const role = GRID_ROLES[g.type] || GRID_ROLES.body;
  const size = Number(g.fontSize) || role.size;
  const o = {
    text:       String(g.text ?? ''),
    fontSize:   size,
    fontWeight: Number(g.weight !== undefined ? g.weight : role.weight) || role.weight,
    color:      (typeof g.color === 'string' && g.color.trim()) ? g.color.trim() : LAUREL_DEFAULTS.textColor,
  };
  if (g.letterSpacing !== undefined && g.letterSpacing !== '' && Number.isFinite(Number(g.letterSpacing))) o.letterSpacing = Number(g.letterSpacing);
  else if (/em$/.test(String(role.ls))) { const em = parseFloat(role.ls); if (Number.isFinite(em) && em !== 0) o.letterSpacing = Math.round(em * size * 100) / 100; }
  return o;
}
/** ★1013t1B2 C3 — Figma JSON 용 칸 배열: 글자 줄만(여백·구분선·그림은 뺀다 · 결정 B2-10) 옛 꼴로. lines 키 없는 칸은 그대로(수신측 폴백). */
function _lrlFigmaCells(cells) {
  return (Array.isArray(cells) ? cells : []).map(c => (c && Array.isArray(c.lines))
    ? { ...c, lines: c.lines.filter(_lrlIsTextLine).map(_lrlOldLine) } : c);
}

/** 칸 하나의 줄(그리드 꼴).
 *  ★1013t1B2 C2 — 옛 「1위」 기본 줄 폴백은 «lines 키가 없을 때만»(아주 옛 저장본). `lines: []` = 빈 칸(잎만 · 결정 B2-3 · 그리드
 *    「마지막 줄까지 지우면 빈 칸」과 같은 뜻). ⚠️옛 판은 `[]` 도 「1위」로 그렸다 — 그 꼴은 옛 문(MCP 1~20줄 · 패널 마지막 줄 보호)으로는 안 생긴다. */
function _lrlGridLines(cell) {
  const lines = (cell && Array.isArray(cell.lines))
    ? cell.lines
    : [{ text: '1위', fontSize: 56, fontWeight: 700, color: '#1a1a1a' }];
  return lines.map(_lrlGridLine);
}
/* ★laurel 꾸밈 — 그리드 줄 산출 «위에» 인라인으로 얹는다(내보내기·저장에도 산다 · CSS 파일 무변).
 *   ⑴ 글자 줄 = 옛 「한 줄 + 말줄임」(.laurel-text-line 의 nowrap · max-width:100% · overflow:hidden · ellipsis).
 *      ⛔그리드 그대로(pre-wrap)면 긴 글이 줄바꿈돼 칸이 커진다(실측 h 44 → 132).
 *      ★글자에 줄바꿈(\n)이 «없으면» nowrap — 공백 접기까지 옛 span 과 같다(옛 저장본 렌더 불변 · LL0).
 *      ★있으면 pre — 결정 B2-8(편집 중 Enter = 줄 안 줄바꿈)이 낸 \n 을 «그 자리에서» 끊되, 각 줄은 여전히 감싸지 않고 말줄임(LL9).
 *        ⛔pre-line·pre-wrap 은 긴 글을 칸 폭에서 감싼다(⑴ 위반). ⛔전부 pre 로 하면 옛 저장본의 겹공백이 펴진다(LL0 빨강).
 *   ⑵ fx(**text_) = «글자 줄 자신»에 .text-effect tfx-* + --tfx-* — 감싸개에 달면 neon 글자색이 줄 인라인 color 에 진다(실측).
 *   ⑶ 구분선 줄 = 감싸개를 스택 폭으로 편다(align-self:stretch) — 안 펴면 폭 0 이라 안 보인다(가운데 정렬 flex 열의 맞춤 폭).
 *   ⑷ ★C4 그림 줄(사각) = «높이(px) 하나»로 크기(결정 B2-4 · 없으면 LAUREL_IMG_DEFAULT_H 64) · 폭 auto · 칸 폭을 넘으면 줄되 비율 유지(contain).
 *      ⛔그리드 그대로면 iconify 꼴 svg(width=1em)가 16px, 큰 사진은 칸 폭 꽉(실측 §1-3 — 플래너 F·E). 원형(imgShape circle)은 그리드 산출 그대로(지름 = height).
 *   ⑸ ★1017t1g2 여백 줄 = «손에 닿게»(align-self:stretch) — ⑶과 같은 병(내용 0 ⇒ 감싸개 폭 0 ⇒ elementFromPoint 가 못 집는다 ⇒
 *      클릭이 줄 아니라 칸으로 떨어진다). ⑶ 구분선 분기에 그대로 올라탄다(발명 아님 — 이웃 분기를 그대로 따른다). */
function _lrlDecorateLinesHtml(html, fxClass, fxStyle, lines = []) {
  if (typeof document === 'undefined') return html;
  const t = document.createElement('template');
  t.innerHTML = html;
  // ⛔DocumentFragment 엔 `:scope >` 가 안 걸린다(조각은 요소가 아니다) — 자식 목록으로 돈다.
  [...t.content.children].filter(row => row.classList.contains('ln-row')).forEach(row => {
    row.style.maxWidth = '100%';
    row.style.minWidth = '0';
    if (row.querySelector(':scope > .grd-divider, :scope > .grd-gap')) row.style.alignSelf = 'stretch';
    const ln = lines[Number(row.dataset.ln)];
    const multi = !!(ln && typeof ln.text === 'string' && ln.text.includes('\n'));
    const frame = row.querySelector(':scope > .grd-img-frame');
    if (frame && !frame.classList.contains('grd-img-circle')) {
      const hpx = (ln && Number(ln.height) > 0) ? Number(ln.height) : LAUREL_IMG_DEFAULT_H;
      frame.style.width = 'auto';
      frame.style.maxWidth = '100%';
      const img = frame.querySelector(':scope > img');
      if (img) { img.style.width = 'auto'; img.style.maxWidth = '100%'; img.style.height = hpx + 'px'; img.style.objectFit = 'contain'; }
      else { frame.style.width = hpx + 'px'; frame.style.height = hpx + 'px'; }   // 빈 그림 자리 — 정사각 hpx
    }
    row.querySelectorAll(':scope > .grd-line, :scope > div > .grd-badge').forEach(el => {
      el.style.whiteSpace = multi ? 'pre' : 'nowrap';
      el.style.maxWidth = '100%';
      el.style.overflow = 'hidden';
      el.style.textOverflow = 'ellipsis';
      if (fxClass) {
        el.className += fxClass;
        el.setAttribute('style', (el.getAttribute('style') || '') + fxStyle);
      }
    });
  });
  return t.innerHTML;
}

// fx: 현재 textEffect cfg(또는 null) — 있으면 각 «글자 줄»(.grd-line)에 .text-effect/.tfx-<preset>
//     클래스 + --tfx-* 인라인 변수를 함께 찍는다(기존 .text-effect CSS 재사용).
// ★1013t1B2 C1 — 줄은 lnLinesHtml(= 그리드 줄 렌더 · 버블·챗·비교와 한 길)로 그린다. 감싸개 `.ln-row[data-ln][data-ln-m=칸]`.
function _renderLaurelCellHtml(cell, idx, fx) {
  const gap       = Number.isFinite(parseInt(cell.gap)) ? parseInt(cell.gap) : 24;
  const leafColor = cell.leafColor        || '#1a1a1a';
  const leafFill  = cell.leafFill         || 'solid';   // 'solid' | 'gold' | 'silver' | 'bronze' | 'rosegold' | 'platinum'
  const height    = parseInt(cell.height) || 140;
  const width     = Math.round(height * 170 / 324);
  // 텍스트 효과(이스터에그) 클래스/인라인 변수 — fx 있을 때만
  const fxClass = fx
    ? ` text-effect tfx-${fx.preset}${(fx.preset === 'grunge' && fx.texture) ? ' tfx-tex-' + fx.texture : ''}`
    : '';
  const fxStyle = fx
    ? `--tfx-color:${fx.color};--tfx-glow-color:${fx.glowColor || fx.color};--tfx-intensity:${(fx.intensity ?? 70) / 100};--tfx-grain:${(fx.grain ?? 60) / 100};`
    : '';
  const gridLines = _lrlGridLines(cell);
  const linesHtml = _lrlDecorateLinesHtml(lnLinesHtml(gridLines, idx, null, 'center'), fxClass, fxStyle, gridLines);
  return `
    <div class="laurel-cell" data-cell-idx="${idx}" style="color:${leafColor};">
      <div class="laurel-inner" style="position:relative;width:100%;display:flex;align-items:center;justify-content:center;min-height:${height}px;">
        <span class="laurel-leaf-left" style="position:absolute;left:${gap}px;top:50%;transform:translateY(-50%);display:flex;align-items:center;">${_laurelLeafSvg(width, height, false, leafFill)}</span>
        <span class="laurel-text-stack" style="position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;text-align:center;color:${LAUREL_DEFAULTS.textColor};">${linesHtml}</span>
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
  /* ★1013t1B2 C5 — 새 칸 = 첫 칸의 «잎 꾸밈»(색·채움·간격·크기) + «기본 줄»(1위) — 그리드 「새 칸 = 기본 줄」과 같은 뜻.
     ⚠️옛 판은 첫 칸을 줄째 베꼈다(첫 칸 글자가 새 칸마다 복제). 캔버스 ＋ · 4×4 피커 · MCP gridCols/Rows 가 모두 이 한 길이다.
     ★첫 칸이 새 꼴(그리드 줄)이면 기본 줄도 새 꼴로(«쓰기 하나» 규약 — 섞어 쓰지 않는다). */
  if (cells.length < total) {
    const base = cells[0] || _defaultLaurelCell();
    const defLines = _defaultLaurelCell().lines;
    const typed = Array.isArray(base.lines) && base.lines.some(l => l && typeof l.type === 'string');
    const seed = { ...base, lines: typed ? defLines.map(_lrlGridLine) : defLines };
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
  /* ★t5-10 「월계수 블럭도 패딩제외 옵션 넣어줄 것」(2026-10-26 S3) — 「패딩 제외」(dataset.fullBleed) 이식.
     ★본 = 배너2 렌더의 같은 한 줄(js/blocks/banner02-block.js) · 부품 = js/drag-utils.js applyBlockFullBleed.
     매 렌더 다시 씌운다(패널에서만 씌우면 다음 렌더·로드에 조용히 풀린다 — chat-block 이 같은 자리에 둔 까닭). 키 없으면 no-op. */
  window.applyBlockFullBleed?.(block);
  // 이스터에그 텍스트 효과 재적용 — dataset.textEffect가 있으면 신규생성/프로젝트로드
  // (rebindAll에서 renderLaurelBlock 호출)/update 모든 리렌더 경로에서 자동 유지된다.
  // renderLaurelBlock이 단일 진입점이라 text-block의 MutationObserver(ensureTextEffect) 불필요.
  const fx = _readLaurelTextEffect(block);
  block.innerHTML = cells.map((c, i) => _renderLaurelCellHtml(c, i, fx)).join('');
  lnRemark(block);   // ★1013t1B2 — 다시 그리면 줄 표시가 지워진다 → 선택된 블럭이면 활성 줄 표시를 되붙인다(챗·비교와 같은 자리)
}

/* ══ ★1013t1B2 C5 캔버스 ＋ — 칸(월계관) 열·행 더하기 (결정 B2-1 · 그리드 「칸 삽입」 짝) ══════════════════════
 * ★꼴·자리·토큰 = 그리드 ＋ 그대로: 그리드 ＋ 층(#grd-plus-layer — #canvas «밖» · 저장·PNG·MCP 읽기에 안 샌다 · E65)에
 *   `.ln-add-btn[data-grd-add="col|row"]`(css/editor-blocks.css 의 같은 규칙이 원·＋ 글리프·기준점을 준다).
 *   ⛔`.grd-add-btn` 이 아니다 — 그리드 ＋ 를 문서 전체로 세는 시험이 있다(버블 1012t1M1 선례).
 * ★자리 = 그리드 _placeGridAddBtns 와 같은 식: 오른쪽 ＋ = (블럭 오른쪽 끝, 블럭 세로 가운데) · 아래 ＋ = (블럭 가로 가운데, 블럭 아래 끝).
 * ★뜨는 조건 = 블럭이 골라져 있고 편집 중이 아닐 때(그리드 = 선택 · 말풍선 ＋ 의 «편집 중엔 숨김»).
 * ★상한(4 — laurel 기존 최대, updateLaurelBlock 잣대 [1,4])에서는 그리드처럼 흐리게(disabled) + 눌러도 아무 일 없음.
 * ★누르면 updateLaurelBlock({gridCols|gridRows}) 한 문 = push-before + 끝 표본 = ⌘Z 한 걸음. */
const LRL_MAX_AXIS = 4;
const _lrlPlusBtns = new Map();   // block → { col, row } (떠 있는 것만)
function _lrlPlusShown(block) {
  return !!(block && block.isConnected && block.classList.contains('selected') && !block.classList.contains('editing'));
}
function _lrlAxisN(block, axis) { return Math.max(1, parseInt(axis === 'col' ? block.dataset.gridCols : block.dataset.gridRows) || 1); }
function lrlAddAtEnd(block, axis) {
  const n = _lrlAxisN(block, axis) + 1;
  if (n > LRL_MAX_AXIS) return false;
  const res = window.updateLaurelBlock?.(block.id, axis === 'col' ? { gridCols: n } : { gridRows: n });
  return !!(res && res.ok);
}
function _lrlMakePlusBtn(block, axis) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ln-add-btn';
  btn.dataset.grdAdd = axis;
  if (block.id) btn.dataset.lnFor = block.id;
  const label = axis === 'col' ? '칸 열 추가' : '칸 행 추가';
  btn.title = label;
  btn.setAttribute('aria-label', label);
  // ⛔캔버스 쪽 손(마키·선택 해제·더블클릭 편집)으로 새지 않게 — 그리드 ＋(_makeGridAddBtn)와 같은 세 겹
  btn.addEventListener('mousedown', e => { e.stopPropagation(); e.preventDefault(); });
  btn.addEventListener('dblclick', e => { e.stopPropagation(); e.preventDefault(); });
  btn.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); if (btn.disabled) return; lrlAddAtEnd(block, axis); });
  return btn;
}
function _lrlDropPlus(block) {
  const p = _lrlPlusBtns.get(block);
  if (p) { p.col.remove(); p.row.remove(); }
  _lrlPlusBtns.delete(block);
}
function _lrlPlacePlus(block) {
  const p = _lrlPlusBtns.get(block);
  const scaler = p && p.col.parentElement && p.col.parentElement.parentElement;
  if (!p || !scaler) return;
  const sr = scaler.getBoundingClientRect();
  const scale = (window.currentZoom || 40) / 100;   // ← grid-block.js _placeGridAddBtns 와 같은 식
  const br = block.getBoundingClientRect();
  const put = (b, x, y) => { const l = (x - sr.left) / scale + 'px', t = (y - sr.top) / scale + 'px'; if (b.style.left !== l) b.style.left = l; if (b.style.top !== t) b.style.top = t; };
  put(p.col, br.right, (br.top + br.bottom) / 2);
  put(p.row, (br.left + br.right) / 2, br.bottom);
  for (const b of [p.col, p.row]) { const full = _lrlAxisN(block, b.dataset.grdAdd) >= LRL_MAX_AXIS; if (b.disabled !== full) b.disabled = full; }
}
let _lrlPlusRaf = 0;
function _lrlStartPlusRaf() {
  if (_lrlPlusRaf || typeof requestAnimationFrame !== 'function') return;
  const loop = () => {
    _lrlPlusRaf = 0;
    for (const blk of [..._lrlPlusBtns.keys()]) {
      if (!_lrlPlusShown(blk)) { _lrlDropPlus(blk); continue; }   // 풀림·삭제·⌘Z 교체·편집
      _lrlPlacePlus(blk);
    }
    if (_lrlPlusBtns.size) _lrlPlusRaf = requestAnimationFrame(loop);
  };
  _lrlPlusRaf = requestAnimationFrame(loop);
}
function lrlSyncPlus(block) {
  if (!block || !block.classList?.contains('laurel-block')) return;
  if (!_lrlPlusShown(block)) { _lrlDropPlus(block); return; }
  const L = gridPlusLayer();
  if (!L) return;
  let p = _lrlPlusBtns.get(block);
  if (!p || !p.col.isConnected || !p.row.isConnected) {
    _lrlDropPlus(block);
    p = { col: _lrlMakePlusBtn(block, 'col'), row: _lrlMakePlusBtn(block, 'row') };
    L.append(p.col, p.row);
    _lrlPlusBtns.set(block, p);
  }
  _lrlPlacePlus(block);
  _lrlStartPlusRaf();
}
/** block-drag.js isLaurel 이 묶을 때 한 번 — class(골라짐·풀림·편집)가 바뀌면 다시 맞춘다. */
function lrlBindPlus(block) {
  if (!block || block._lrlPlusBound || typeof MutationObserver !== 'function') return;
  block._lrlPlusBound = true;
  new MutationObserver(() => lrlSyncPlus(block)).observe(block, { attributes: true, attributeFilter: ['class'] });
  lrlSyncPlus(block);
}

// ── 이스터에그: laurel 블록 텍스트 효과 적용 (**text_ prefix 트리거) ────────────
// text-block의 applyTextEffect 미러. cfg를 dataset.textEffect에 영구 저장만 하고,
// 실제 클래스/스타일은 renderLaurelBlock → _renderLaurelCellHtml의 span 생성부가 찍는다.
// grunge SVG displacement 필터는 text-effect-transform.js가 window로 노출 안 함
// (ensureTextEffectSvgDefs 미노출) → grunge는 정적 CSS fallback만, neon/metallic/
// vintage/cinematic은 순수 CSS라 동일 동작.
function applyTextEffectToLaurel(block, cfg) {
  if (!block || !block.classList.contains('laurel-block')) return;
  const merged = { ...(window.TEXT_EFFECT_DEFAULTS || {}), ...(cfg || {}) };
  block.dataset.textEffect = JSON.stringify(merged);
  window.ensureTextEffectSvgDefs?.();   // 노출 안 돼 있으면 no-op (grunge degraded)
  renderLaurelBlock(block);
}

/* ★1013t1B2 C2 — 옛 자체 더블클릭 편집(_bindLaurelInlineEdit · A29)을 걷었다. 줄 글자 편집은 line-host 의
   lnBindLineEdit(capture · block-drag.js 가 isLaurel 에서 건다) «한 길»이다 — 두 핸들러가 겹치면 안 된다(B1 계획 §3-1).
   Enter 동작이 바뀐다: 옛 「Enter = 끝」 → 「Enter = 줄 안 줄바꿈 · Esc/바깥 클릭 = 끝」(결정 B2-8 · 버블·챗·비교와 같다). */

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
  /* ★[F2 넷째 자리 · 2026-09-22] row 에 «만들 때» id 를 준다 — ⛔지우지 마라.
     안 주면 js/io/save-load.js rebindAll 의 「row ID 복원」이 `'row_' + Math.random()` 을 박는데,
     그 줄은 restoreSnapshot(⌘Z)·switchPage 가 «둘 다» 지난다 ⇒ 복원할 때마다 «다른 id» 다.
     그러면 「복원 직후 라이브 ≠ 방금 복원한 스냅샷」이 항상 참이 되고(F2),
     undo 첫머리의 ensureHistoryCheckpoint 가 «매번» 한 칸을 쌓았다가 곧바로 pos-- 하므로
     ★순증이 0 이다 — ⌘Z 를 눌러도 pos 가 제자리, 되돌리기가 «전면 무동작»이 된다.
     실측(2026-09-22, E-undo 제보 → 재현): 스텝 3동작 뒤 ⌘Z 6번 전부 pos 1→1.
     (id 를 주면 같은 걸음이 2번에 pos 0 에 닿는다.) 다른 row 팩토리 15자리는 원래 id 를 준다. */
  row.className = 'row';
  row.id = 'row_' + Math.random().toString(36).slice(2, 8);
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
//   - cellLines  { cell, lines }  (★1013t1B2 — 칸 하나의 줄을 «그리드 줄 꼴»로 통째 교체 · line-host laurel 주인의 쓰는 문 ·
//                 잣대 lnValidateLines(…, LAUREL_LN_KINDS) · [] = 빈 칸(잎만). ⛔MCP 로는 안 연다(main _validateLaurelOpts 가 모르는 키를 버린다 · 결정 B2-9))
// ★1013t1B2 «읽기 둘 · 쓰기 하나»: 이 문으로 «한 번이라도» 쓰면 그 블럭 모든 칸의 줄이 새 꼴(그리드 줄)로 저장된다.
//   옛 꼴 연산(cells·editCell.lines·addLine·editLine)은 옛 필드를 그대로 받아 안에서 새 꼴로 바꾼다(fontWeight → weight).
//   editLine 이 글자 아닌 줄(여백·구분선)을 가리키면 INVALID. 응답 before.cells 는 쓰기 전 문자열 그대로.
// opts.noHistory — push-before 를 안 찍는다(line-host 주인 계약 · 버블/챗/비교 문과 같은 칸 · 칸 사이 옮기기 문2).
function updateLaurelBlock(blockId, partial = {}, opts = {}) {
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

  /* ★1013t1B2 cellLines — 이력을 찍기 «전»에 잰다(거절이 이력 한 칸을 남기지 않게 · 비교 rowLines 와 같은 순서). */
  let _cellLinesCopy = null, _cellLinesIdx = -1;
  if (partial.cellLines !== undefined && partial.cellLines !== null) {
    const p = partial.cellLines;
    if (typeof p !== 'object') return { ok: false, code: 'INVALID', message: 'cellLines must be object' };
    const ci = Number(p.cell);
    const n = (() => { try { return _readLaurelCells(block).length; } catch (_) { return 0; } })();
    if (!Number.isInteger(ci) || ci < 0 || ci >= n) return { ok: false, code: 'INVALID', message: `cellLines.cell ${p.cell} out of range (0~${n - 1})` };
    const e = lnValidateLines(p.lines, 'cellLines.lines', LAUREL_LN_KINDS, 'a laurel cell line');
    if (e) return { ok: false, code: e.code || 'INVALID', message: e.message };
    try { _cellLinesCopy = JSON.parse(JSON.stringify(p.lines)); } catch (_) { return { ok: false, code: 'INVALID', message: 'cellLines.lines not serializable' }; }
    _cellLinesIdx = ci;
  }

  if ((opts || {}).noHistory !== true) window.pushHistory?.('Laurel 수정');

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
      /* ★1013t1B2 — 그 줄을 새 꼴로 보고 옛 필드를 새 이름으로 얹는다(fontWeight → weight). 글자 아닌 줄은 거절. */
      const g = { ..._lrlGridLine(curLines[li]) };
      if (!_lrlIsTextLine(g)) {
        return { ok: false, code: 'INVALID', message: `editLine: cell[${ci}].lines[${li}] is a '${g.type}' line (not a text line)` };
      }
      if (patch.text !== undefined) { g.text = patch.text; delete g.textHtml; }   // ★글자만 쓰는 자는 묵은 범위 서식을 지운다(B1 대비)
      if (patch.fontSize !== undefined) g.fontSize = patch.fontSize;
      if (patch.fontWeight !== undefined) g.weight = String(patch.fontWeight);
      if (patch.color !== undefined) g.color = patch.color;
      if (patch.letterSpacing !== undefined) g.letterSpacing = patch.letterSpacing;
      curLines[li] = g;
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

    // (g) ★1013t1B2 cellLines — 칸 하나의 줄을 통째(위에서 이미 쟀다)
    if (_cellLinesIdx >= 0) {
      if (_cellLinesIdx >= cells.length) return { ok: false, code: 'INVALID', message: `cellLines.cell ${_cellLinesIdx} out of range` };
      cells[_cellLinesIdx] = { ...cells[_cellLinesIdx], lines: _cellLinesCopy };
      applied.cellLines = { cell: _cellLinesIdx, lines: _cellLinesCopy.length };
    }

    // (h) ★1013t1B2 «쓰기 하나» — 줄이 있는 모든 칸을 새 꼴(그리드 줄)로. lines 키가 없는 칸(아주 옛 저장본)은 그대로 둔다(렌더 폴백).
    cells = cells.map(c => (c && Array.isArray(c.lines)) ? { ...c, lines: c.lines.map(_lrlGridLine) } : c);
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
window._lrlGridLine        = _lrlGridLine;    // ★1013t1B2 — line-host·내보내기·AI 채움이 window 로 부른다(순환 import 회피 관례)
window._lrlGridLines       = _lrlGridLines;
window._lrlIsTextLine      = _lrlIsTextLine;   // ★C3 — AI 채움·editLine 의 「글자 줄인가」
window._lrlOldLine         = _lrlOldLine;      // ★C3 — Figma 내보내기(새 꼴 → 옛 이름)
window._lrlFigmaCells      = _lrlFigmaCells;
window.LAUREL_FILL_PRESETS = LAUREL_FILL_PRESETS;
window.updateLaurelBlock   = updateLaurelBlock;
/* ★«끝 표본» 래퍼(js/model-update-history.js — window.update*Block 을 감싸 호출마다 한 칸 더 쌓는다)를 «안 타는» 원본.
   ★1013t1B2 — 칸 사이 줄 옮기기(line-host moveLine 의 문1)만 쓴다. 까닭은 chat-block.js updateChatBlockRaw 주석과 같다. */
window.updateLaurelBlockRaw = updateLaurelBlock;
window.applyTextEffectToLaurel = applyTextEffectToLaurel;
window.lrlBindPlus         = lrlBindPlus;     // ★1013t1B2 C5 — 캔버스 ＋(block-drag.js isLaurel 이 묶는다)
window.lrlSyncPlus         = lrlSyncPlus;
window.lrlAddAtEnd         = lrlAddAtEnd;

export {
  makeLaurelBlock,
  addLaurelBlock,
  updateLaurelBlock,
  renderLaurelBlock,
  applyTextEffectToLaurel,
  LAUREL_FILL_PRESETS,
  LAUREL_DEFAULTS,
};
