/* prop-radial.js — 방사형 에셋 블럭 패널 (프로토 · 1012t1 → 1013t2A3 V4 반원).
 * 쓰기는 전부 «dataset → renderRadialBlock → (칸 구성이 바뀌면) 패널 재오픈 → pushHistory» 다(push-after · 슬라이더는 input 에 적용하고 change 에 히스토리).
 * 한도·기본값은 radial-block.js 의 RADIAL_LIMITS · RADIAL_DEFAULTS 한 표에서 온다 — 여기 리터럴로 다시 적지 않는다.
 * showRadialProperties(block, idx): idx 가 정수면 그 칸을 고른 상태로 연다(−1 = 칸 선택 없음).
 *   캔버스 클릭 길(block-drag.js 공용 루프)은 둘째 인자로 그리드 주소(대개 undefined)를 넘긴다 ⇒ 수가 아니면 블럭이 mousedown 때 적어 둔 `_rdlLastHit` 을 읽는다.
 * 칸 그림은 «샘플 키» 또는 붙여넣은 SVG(소독본)다(파일창 없음).
 * 「선택한 항목」 절: 라벨 글 · 아이콘(샘플 · 없음 · SVG 붙여넣기) · 각도(비우면 자동) · 라벨 간격(dx, dy) · 자동 배치로 되돌리기.
 *   캔버스 끌기(radial-block.js)가 끝나면 이 패널을 그 항목으로 다시 열어 숫자가 끈 값과 같아진다. */
import { propPanel } from '../globals.js';
import { colorFieldHTML, wireColorField, parseAlphaFromColor } from './color-picker.js';
import { blockHeaderHTML, escHtml as _esc } from './_helpers.js';
import {
  radialStateOf, radialSetCount, radialCountLimits, RADIAL_LIMITS, RADIAL_DEFAULTS, RADIAL_ARC_PRESET, RADIAL_LOOK_KEYS,
  radialNormDeg, radialAutoDegs, radialItemIsManual, radialResetPlacement,
  radialSanitizeSvg, radialCenterKeys, radialCenterSvg, radialCenterLabel, RADIAL_ICON_SVG_MAX,
} from '../blocks/radial-block.js';

const L = RADIAL_LIMITS;

const _ICON = `          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <circle cx="8" cy="2.5" r="1.5"/><circle cx="12.8" cy="5.25" r="1.5"/><circle cx="12.8" cy="10.75" r="1.5"/>
            <circle cx="8" cy="13.5" r="1.5"/><circle cx="3.2" cy="10.75" r="1.5"/><circle cx="3.2" cy="5.25" r="1.5"/>
          </svg>`;

const _LINE_OPTS = [['none', '없음'], ['orbit', '궤도 (원)'], ['outline', '외곽선 (다각형)'], ['spoke', '중심선 (바큇살)']];
const _LABEL_OPTS = [['outside', '바깥'], ['below', '아래'], ['inside', '안'], ['none', '없음']];
const _CENTER_OPTS = [['none', '없음'], ['image', '이미지'], ['text', '텍스트']];

let _lastBlock = null;

/* 모양(원 ↔ 호)마다 따로 기억하는 «모습»(마커 · 라벨 자리 · 가운데 · 선 모양 · 라벨 크기/간격/폭) — dataset 에 JSON 으로 둔다.
 * 호의 기본 모습(점 + 글)이 원으로 돌아갈 때 따라가지 않고, 원의 모습(그림 칸 · 가운데)이 호로 올 때 따라오지 않는다. */
const _lookOf = (d) => JSON.stringify(Object.fromEntries(RADIAL_LOOK_KEYS.filter((k) => d[k] !== undefined).map((k) => [k, d[k]])));
function _applyLook(d, src) {
  let o = src;
  if (typeof src === 'string') { try { o = JSON.parse(src); } catch (_) { o = null; } }
  if (!o || typeof o !== 'object') return false;
  RADIAL_LOOK_KEYS.forEach((k) => { if (typeof o[k] === 'string' || typeof o[k] === 'number') d[k] = String(o[k]); });
  return true;
}

/** 스와치가 보여 줄 hex — prop-quote._swatchHex 와 같은 규칙. */
function _swatchHex(v, dflt) {
  const s = String(v || '').trim();
  const m6 = s.match(/#([0-9a-fA-F]{6})\b/);
  if (m6) return '#' + m6[1].toLowerCase();
  const m3 = s.match(/#([0-9a-fA-F]{3})\b/);
  if (m3) return '#' + m3[1].toLowerCase().split('').map((ch) => ch + ch).join('');
  const rgb = s.match(/rgba?\(([^)]+)\)/i);
  if (rgb) {
    const p = rgb[1].split(',').map((x) => parseInt(x, 10));
    const to = (n) => Math.max(0, Math.min(255, n | 0)).toString(16).padStart(2, '0');
    return '#' + to(p[0]) + to(p[1]) + to(p[2]);
  }
  return dflt;
}

/** 슬라이더＋숫자 한 쌍. */
function _pairRow(id, label, val, lim, step = 1) {
  return `
      <div class="prop-row">
        <span class="prop-label">${_esc(label)}</span>
        <input type="range" class="prop-slider" id="${id}-slider" min="${lim.min}" max="${lim.max}" step="${step}" value="${val}">
        <input type="number" class="prop-number" id="${id}-number" min="${lim.min}" max="${lim.max}" step="${step}" value="${val}">
      </div>`;
}
function _numRow(id, label, val, lim, step = 1) {
  return `
      <div class="prop-row">
        <span class="prop-label">${_esc(label)}</span>
        <input type="number" class="prop-number" id="${id}" min="${lim.min}" max="${lim.max}" step="${step}" value="${val}">
      </div>`;
}
function _colorRow(prefix, label, val, dflt) {
  return `
      <div class="prop-row">
        <span class="prop-label">${_esc(label)}</span>
        ${colorFieldHTML({ idPrefix: prefix, hex: _swatchHex(val, dflt), alpha: parseAlphaFromColor(val) })}
      </div>`;
}
function _typeRow(label, idPrefix, opts, cur) {
  return `
      <div class="prop-row">
        <span class="prop-label">${_esc(label)}</span>
        <div class="prop-type-group" style="flex:1;margin-bottom:0">
          ${opts.map(([v, t]) => `<button class="prop-type-btn${cur === v ? ' active' : ''}" id="${idPrefix}-${v}" data-val="${v}">${_esc(t)}</button>`).join('')}
        </div>
      </div>`;
}
/** 샘플 그림 스와치 줄 — withClear 면 맨 앞에 「비우기」(data-sample=""). */
function _samplesHTML(id, cur, withClear) {
  const S = window.RADIAL_SAMPLES;
  return `
      <div class="prop-row">
        <div class="rdl-samples" id="${id}">
          ${withClear ? `<button class="rdl-sample-btn${cur ? '' : ' active'}" data-sample="" title="그림 비우기">✕</button>` : ''}
          ${S.KEYS.map((k) => `<button class="rdl-sample-btn${cur === k ? ' active' : ''}" data-sample="${k}" title="${_esc(S.label(k))}">${S.svg(k)}</button>`).join('')}
        </div>
      </div>`;
}

function _markCell(block, sel) {
  block.querySelectorAll('.rdl-item').forEach((el) => {
    el.classList.toggle('rdl-cell-selected', Number(el.dataset.rdlIdx) === sel);
  });
}

export function showRadialProperties(block, idx) {
  if (!block || !propPanel) return;
  const G = window.RADIAL_GEOM, S = window.RADIAL_SAMPLES;

  // 다른 블럭으로 넘어오면 앞 블럭의 칸 선택을 지운다.
  if (_lastBlock && _lastBlock !== block) { _lastBlock._rdlSel = -1; _markCell(_lastBlock, -1); }
  _lastBlock = block;

  const st = radialStateOf(block);
  let sel = Number.isInteger(idx) ? idx : (Number.isInteger(block._rdlLastHit) ? block._rdlLastHit : -1);
  block._rdlLastHit = undefined;
  if (sel < 0 || sel >= st.count) sel = -1;
  block._rdlSel = sel;
  _markCell(block, sel);

  const isPoly = st.shape === 'poly', isArc = st.shape === 'arc', isDot = st.marker === 'dot';
  const cntLim = radialCountLimits(st.shape);
  const lineOpts = isArc ? [['none', '없음'], ['orbit', '호'], ['spoke', '중심선 (바큇살)']] : _LINE_OPTS;
  const lineCur = (isArc && st.line === 'outline') ? 'orbit' : st.line;
  const off = 'opacity:0.4;pointer-events:none';
  const selItem = sel >= 0 ? st.items[sel] : null;
  const anyManual = st.items.some(radialItemIsManual);
  const autoDeg = sel >= 0 ? Math.round(radialAutoDegs(st)[sel] * 10) / 10 : 0;

  propPanel.innerHTML = `
    <div class="prop-section">
${blockHeaderHTML({
    icon: _ICON,
    name: block.dataset.layerName,
    defaultName: 'Radial Block',
    crumb: window.getBlockBreadcrumb ? window.getBlockBreadcrumb(block) : '',
    id: block.id,
  })}
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Shape</div>
      <div id="rdl-shape-group">
      <div class="prop-row">
        <span class="prop-label">모양</span>
        <div class="prop-type-group" style="flex:1;margin-bottom:0">
          <button class="prop-type-btn${st.shape === 'circle' ? ' active' : ''}" id="rdl-shape-circle" data-shape="circle">원</button>
          <button class="prop-type-btn${isArc ? ' active' : ''}" id="rdl-shape-arc" data-shape="arc">호</button>
        </div>
      </div>
      <div class="prop-row">
        <span class="prop-label">다각형</span>
        <div class="prop-type-group" style="flex:1;margin-bottom:0">
          ${[3, 4, 5, 6, 7, 8].map((n) => `<button class="prop-type-btn${isPoly && st.count === n ? ' active' : ''}" id="rdl-shape-${n}" data-shape="${n}" title="${n}각형" style="min-width:0">${n}각</button>`).join('')}
        </div>
      </div>
      </div>
      <div class="prop-row">
        <span class="prop-label">항목 수</span>
        <button class="prop-count-btn" id="rdl-count-minus"${isPoly ? ` disabled style="${off}"` : ''}>−</button>
        <span class="prop-count-val" id="rdl-count-val">${st.count}</span>
        <button class="prop-count-btn" id="rdl-count-plus"${isPoly ? ` disabled style="${off}"` : ''}>+</button>
      </div>
      ${isPoly ? `<div class="prop-hint" style="padding:2px 8px;line-height:1.5">다각형은 항목 수가 <b>꼭짓점 수</b>로 고정됩니다 — 위에서 각 수를 고르세요.</div>` : ''}
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Layout</div>
      ${_pairRow('rdl-radius', '반지름', st.radius, L.radius)}
      ${_pairRow('rdl-start', '시작 각도', st.startDeg, L.startDeg)}
      ${isArc ? `
      ${_pairRow('rdl-end', '끝 각도', st.endDeg, L.endDeg)}
      ${_pairRow('rdl-cx', '원 중심 X', st.centerX, L.centerX)}
      <div class="prop-hint" style="padding:2px 8px;line-height:1.5">기본은 <b>반원</b>입니다 — 시작 −90° · 끝 90° · 원 중심 X 0%(블럭 왼쪽 변)라서 호의 양 끝이 왼쪽 변에 붙습니다. 원 중심 X 는 블럭 폭 대비 <b>%</b> 입니다. 항목은 시작~끝 각도 사이에 같은 간격으로 서되 <b>끝점에는 서지 않습니다</b>. 값을 바꿔 호 · 항목이 블럭 밖으로 나가면 들어올 만큼만 밀어 그리고, 옆 라벨이 오른쪽 변을 넘으면 라벨 폭을 먼저 줄입니다.</div>` : ''}
      <div class="prop-row">
        <span class="prop-label">연결선</span>
        <select class="prop-select" id="rdl-line-select">
          ${lineOpts.map(([v, t]) => `<option value="${v}"${lineCur === v ? ' selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>
      ${st.line === 'none' ? '' : `
      ${_colorRow('rdl-line', '선 색', st.lineColor, RADIAL_DEFAULTS.lineColor)}
      <div class="prop-row">
        <span class="prop-label">선 모양</span>
        <select class="prop-select" id="rdl-line-style">
          <option value="dashed"${st.lineStyle === 'dashed' ? ' selected' : ''}>점선</option>
          <option value="solid"${st.lineStyle === 'solid' ? ' selected' : ''}>실선</option>
        </select>
      </div>
      ${_numRow('rdl-line-width', '선 두께', st.lineWidth, L.lineWidth, L.lineWidth.step)}
      ${isArc && lineCur === 'orbit' ? _numRow('rdl-lineext-number', '선 연장°', st.lineExtend, L.lineExtend) : ''}`}
      ${_colorRow('rdl-bg', '블럭 배경', st.bg || '#ffffff', '#ffffff')}
      ${st.bg
    ? `<button class="prop-btn-full" id="rdl-bg-clear">배경 지우기 (투명)</button>`
    : `<div class="prop-hint" style="padding:2px 8px;line-height:1.5">지금은 배경이 <b>투명</b>입니다 — 색을 고르면 블럭 배경이 칠해집니다.</div>`}
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Asset</div>
      ${_typeRow('마커', 'rdl-marker', [['cell', '그림 칸'], ['dot', '점']], st.marker)}
      ${isDot ? `
      ${_pairRow('rdl-dot', '점 크기', st.dotSize, L.dotSize)}
      ${_colorRow('rdl-dotcolor', '점 색', st.dotColor, RADIAL_DEFAULTS.dotColor)}
      ${_pairRow('rdl-icon', '아이콘', st.iconSize, L.iconSize)}
      <div class="prop-hint" style="padding:2px 8px;line-height:1.5">점 마커에서는 항목의 샘플 그림이 <b>라벨 위 아이콘</b>으로 섭니다.</div>` : `
      ${_pairRow('rdl-cell', '크기', st.cellSize, L.cellSize)}
      ${_typeRow('모양', 'rdl-cellshape', [['circle', '원'], ['round', '둥근사각']], st.cellShape)}
      ${st.cellShape === 'round' ? _numRow('rdl-cellradius-number', '모서리', st.cellRadius, L.cellRadius) : ''}
      ${_colorRow('rdl-cellfill', '채움', st.cellFill, RADIAL_DEFAULTS.cellFill)}`}
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Center</div>
      ${_typeRow('가운데', 'rdl-center', _CENTER_OPTS, st.centerMode)}
      ${st.centerMode === 'none' ? '' : _pairRow('rdl-center', '크기', st.centerSize, L.centerSize)}
      ${st.centerMode === 'none' ? '' : _pairRow('rdl-centerdx', '가로 밀기', st.centerDx, L.centerDx)}
      ${st.centerMode === 'text' ? `
      <div class="prop-row">
        <textarea class="prop-textarea" id="rdl-center-textarea" rows="2" style="flex:1" placeholder="첫 줄은 작게, 다음 줄은 크게">${_esc(st.centerText)}</textarea>
      </div>
      ${_colorRow('rdl-center-bg', '배경', st.centerBg, RADIAL_DEFAULTS.centerBg)}
      ${_colorRow('rdl-center-color', '글자 색', st.centerColor, RADIAL_DEFAULTS.centerColor)}` : ''}
      ${st.centerMode === 'image' ? `
      ${_typeRow('자르기', 'rdl-centerclip', [['circle', '원형'], ['none', '없음 (네모)']], st.centerClip)}
      <div class="prop-hint" style="padding:2px 8px;line-height:1.5">샘플 그림 고르기</div>
      <div class="prop-row">
        <div class="rdl-samples" id="rdl-center-samples">
          ${radialCenterKeys().map((k) => `<button class="rdl-sample-btn${st.centerImg === k ? ' active' : ''}${S.has(k) ? '' : ' rdl-sample-btn--plain'}" data-sample="${k}" title="${_esc(radialCenterLabel(k))}">${radialCenterSvg(k)}</button>`).join('')}
        </div>
      </div>` : ''}
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Label</div>
      ${_typeRow('위치', 'rdl-label', _LABEL_OPTS, st.labelPos)}
      ${st.labelPos === 'none' ? '' : `
      ${_pairRow('rdl-labelsize', '크기', st.labelSize, L.labelSize)}
      ${_colorRow('rdl-labelcolor', '색', st.labelColor, RADIAL_DEFAULTS.labelColor)}
      ${_typeRow('굵기', 'rdl-labelweight', [['bold', '굵게'], ['normal', '보통']], st.labelWeight)}
      ${st.labelPos === 'inside' ? '' : _numRow('rdl-labelgap-number', '간격', st.labelGap, L.labelGap)}
      ${st.labelPos === 'outside' ? _numRow('rdl-labelwidth-number', '최대 폭', st.labelWidth, L.labelWidth) : ''}`}
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Data</div>
      <div class="grb-data-list" id="rdl-data-list">
        ${st.items.map((it, i) => `
          <div class="grb-data-item rdl-data-item${i === sel ? ' active' : ''}" data-index="${i}">
            <span class="rdl-data-dot" title="이 칸 고르기">${it.img ? S.svg(it.img) : ''}</span>
            <input type="text" class="grb-data-label-input" value="${_esc(it.label.replace(/\r?\n/g, ' ⏎ '))}" placeholder="라벨"${/\n/.test(it.label) ? ' readonly title="여러 줄 글 — 아래 「항목」 절에서 고칩니다"' : ''}>
            <button class="grb-data-del-btn" data-index="${i}" title="이 항목 지우기"${st.count <= cntLim.min || isPoly ? ` disabled style="${off}"` : ''}>✕</button>
          </div>`).join('')}
      </div>
      <button class="prop-btn-full" id="rdl-add-item"${st.count >= cntLim.max || isPoly ? ' disabled' : ''}>+ 항목 추가</button>
      <button class="prop-btn-full" id="rdl-reset-all" style="margin-top:6px"${anyManual ? '' : ' disabled'}>전체 자동 배치로 되돌리기</button>
      <div class="prop-hint" style="padding:2px 8px;line-height:1.5">캔버스의 칸(또는 왼쪽 동그라미)을 누르면 그 칸의 <b>그림</b>을 고를 수 있습니다.</div>
    </div>
    ${selItem ? `
    <div class="prop-section" id="rdl-item-section">
      <div class="prop-section-title">선택한 항목</div>
      <div class="prop-hint" id="rdl-item-which" style="padding:2px 8px;line-height:1.5"><b>항목 ${sel + 1}</b> — 캔버스에서 끌면 호(원)를 따라 움직입니다. 라벨만 옮기려면 <b>Alt+끌기</b> 또는 라벨 옆 파란 손잡이를 끄세요.</div>
      <div class="prop-row">
        <span class="prop-label">라벨</span>
        <textarea class="prop-textarea" id="rdl-item-label" rows="3" style="flex:1;min-width:0">${_esc(selItem.label)}</textarea>
      </div>
      <div class="prop-hint" style="padding:2px 8px;line-height:1.5">줄바꿈 그대로 여러 줄이 됩니다. <b>**굵게**</b> 처럼 별표 둘로 감싸면 그 부분만 굵어집니다.</div>
      <div class="prop-row">
        <span class="prop-label">각도</span>
        <input type="text" inputmode="decimal" class="prop-input" id="rdl-item-deg" value="${selItem.deg !== undefined ? selItem.deg : ''}" placeholder="자동 ${autoDeg}" title="−180~180 · 비우면 자동 배치" style="flex:1;min-width:0">
      </div>
      <div class="prop-row">
        <span class="prop-label">라벨 간격</span>
        <input type="number" class="prop-number" id="rdl-item-dx" min="${L.labelDx.min}" max="${L.labelDx.max}" step="1" value="${selItem.labelDx || 0}" title="가로(dx)">
        <input type="number" class="prop-number" id="rdl-item-dy" min="${L.labelDy.min}" max="${L.labelDy.max}" step="1" value="${selItem.labelDy || 0}" title="세로(dy)">
      </div>
      <button class="prop-btn-full" id="rdl-item-reset"${radialItemIsManual(selItem) ? '' : ' disabled'}>이 항목 자동 배치로 되돌리기</button>
      <div class="prop-hint" style="padding:6px 8px 2px;line-height:1.5">${isDot ? '아이콘' : '칸 그림'} — 샘플 고르기${selItem.svg ? ' (지금은 <b>붙여넣은 SVG</b>)' : ''}</div>
      ${_samplesHTML('rdl-item-samples', selItem.svg ? '\u0000' : selItem.img, true)}
      <div class="prop-row">
        <textarea class="prop-textarea" id="rdl-item-svg" rows="3" style="flex:1;min-width:0;font-family:monospace" maxlength="${RADIAL_ICON_SVG_MAX * 4}" placeholder="&lt;svg …&gt; 코드를 붙여 넣으세요">${_esc(selItem.svg || '')}</textarea>
      </div>
      <button class="prop-btn-full" id="rdl-item-svg-apply">SVG 적용</button>
      <div class="prop-hint" id="rdl-item-svg-msg" style="padding:2px 8px;line-height:1.5">SVG 는 소독해서 넣습니다(스크립트 · 이벤트 속성 · 외부 주소는 걸러집니다). currentColor 를 쓰면 라벨 색을 따릅니다.</div>
    </div>` : ''}`;

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);

  const $ = (id) => document.getElementById(id);
  const rerender = () => window.renderRadialBlock?.(block);
  /* push-after — 쓰고 그린 «뒤»에 한 번. */
  const commit = () => { window.pushHistory?.(); window.scheduleAutoSave?.(); };
  const reopen = (i) => showRadialProperties(block, Number.isInteger(i) ? i : (block._rdlSel ?? -1));
  const setItems = (items) => { block.dataset.items = JSON.stringify(items); };
  const curItems = () => radialStateOf(block).items;

  // ── 슬라이더 + 숫자 «쌍» ──
  const wireNum = (id, key) => {
    const s = $(`${id}-slider`), n = $(`${id}-number`);
    if (!s || !n) return;
    const lim = L[key];
    const apply = (val) => {
      const x = G.clamp(val, lim.min, lim.max, RADIAL_DEFAULTS[key]);
      block.dataset[key] = String(x);
      rerender();
      s.value = x; n.value = x;
    };
    s.addEventListener('input', () => apply(parseInt(s.value, 10)));
    s.addEventListener('change', commit);
    n.addEventListener('change', () => { apply(parseInt(n.value, 10)); commit(); });
  };
  const wireOnlyNum = (id, key) => {
    const n = $(id);
    if (!n) return;
    const lim = L[key];
    n.addEventListener('change', () => {
      const stp = lim.step || 1;
      const x = G.clamp(Math.round(parseFloat(n.value) / stp) * stp, lim.min, lim.max, RADIAL_DEFAULTS[key]);
      block.dataset[key] = String(x); n.value = x;
      rerender(); commit();
    });
  };
  const wireColor = (prefix, key) => {
    if (!$(`${prefix}-color`)) return;
    wireColorField(prefix, {
      initialAlpha: parseAlphaFromColor(block.dataset[key] || RADIAL_DEFAULTS[key]),
      onApply: (c) => { block.dataset[key] = c; rerender(); },
      onCommit: commit,
    });
  };
  const wireType = (idPrefix, opts, key) => {
    opts.forEach(([v]) => {
      $(`${idPrefix}-${v}`)?.addEventListener('click', () => {
        if (block.dataset[key] === v) return;
        block.dataset[key] = v;
        rerender(); reopen(); commit();
      });
    });
  };

  // ── Shape ──
  $('rdl-shape-group')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-shape]');
    if (!btn) return;
    const v = btn.dataset.shape;
    const d = block.dataset;
    const was = radialStateOf(block).shape;
    if (v === 'circle' || v === 'arc') {
      if (was === v) return;
      d.shape = v;
      if (v === 'arc') {
        // 호로 처음 바꾸면 «반원 · 점 + 글»(RADIAL_ARC_PRESET — 시작 −90° · 끝 90° · 원 중심 X 0% · 선 연장 0)로 시작한다. 한 번 쓴 값은 다음에 그대로 돌아온다.
        d.circleLook = _lookOf(d);
        if (d.arcSeen !== '1') {
          ['endDeg', 'centerX', 'lineExtend'].forEach((k) => { d[k] = String(RADIAL_ARC_PRESET[k]); });
          _applyLook(d, RADIAL_ARC_PRESET);
          d.arcSeen = '1';
        } else _applyLook(d, d.arcLook);
        d.startDeg = String(d.arcStart ?? RADIAL_ARC_PRESET.startDeg);
        if (d.line === 'outline') d.line = 'orbit';
      } else if (d.line === 'outline') d.line = 'orbit';
    } else {
      const n = parseInt(v, 10);
      if (was === 'poly' && Number(d.count) === n) return;
      d.shape = 'poly';
      radialSetCount(block, n);
      if (was !== 'poly' && d.line === 'orbit') d.line = 'outline';
    }
    if (was === 'arc' && d.shape !== 'arc') {
      d.arcStart = d.startDeg; d.startDeg = String(RADIAL_DEFAULTS.startDeg);
      // 호의 모습을 기억하고 원의 모습으로 돌아간다(기억이 없으면 = 호로 태어난 블럭이면 원의 기본 모습)
      d.arcLook = _lookOf(d);
      if (!_applyLook(d, d.circleLook)) _applyLook(d, RADIAL_DEFAULTS);
    }
    radialSetCount(block, d.count);
    rerender(); reopen(); commit();
  });
  const stepCount = (delta) => {
    if (block.dataset.shape === 'poly') return;
    const before = radialStateOf(block).count;
    const after = radialSetCount(block, before + delta);
    if (after === before) return;
    rerender(); reopen(); commit();
  };
  $('rdl-count-minus')?.addEventListener('click', () => stepCount(-1));
  $('rdl-count-plus')?.addEventListener('click', () => stepCount(1));

  // ── Layout ──
  wireNum('rdl-radius', 'radius');
  wireNum('rdl-start', 'startDeg');
  wireNum('rdl-end', 'endDeg');
  wireNum('rdl-cx', 'centerX');
  wireOnlyNum('rdl-lineext-number', 'lineExtend');
  $('rdl-line-select')?.addEventListener('change', (e) => {
    block.dataset.line = e.target.value;
    rerender(); reopen(); commit();
  });
  $('rdl-line-style')?.addEventListener('change', (e) => {
    block.dataset.lineStyle = e.target.value === 'solid' ? 'solid' : 'dashed';
    rerender(); commit();
  });
  wireOnlyNum('rdl-line-width', 'lineWidth');
  wireColor('rdl-line', 'lineColor');
  if ($('rdl-bg-color')) {
    wireColorField('rdl-bg', {
      initialAlpha: block.dataset.bg ? parseAlphaFromColor(block.dataset.bg) : 100,
      onApply: (c) => { block.dataset.bg = c; rerender(); },
      onCommit: () => { commit(); if (!$('rdl-bg-clear')) reopen(); },
    });
  }
  $('rdl-bg-clear')?.addEventListener('click', () => { block.dataset.bg = ''; rerender(); reopen(); commit(); });

  // ── Asset ──
  wireType('rdl-marker', [['cell'], ['dot']], 'marker');
  wireNum('rdl-dot', 'dotSize');
  wireColor('rdl-dotcolor', 'dotColor');
  wireNum('rdl-icon', 'iconSize');
  wireNum('rdl-cell', 'cellSize');
  wireType('rdl-cellshape', [['circle'], ['round']], 'cellShape');
  wireOnlyNum('rdl-cellradius-number', 'cellRadius');
  wireColor('rdl-cellfill', 'cellFill');

  // ── Center ──
  wireType('rdl-center', _CENTER_OPTS, 'centerMode');
  wireNum('rdl-center', 'centerSize');
  wireNum('rdl-centerdx', 'centerDx');
  wireType('rdl-centerclip', [['circle'], ['none']], 'centerClip');
  const ta = $("rdl-center-textarea");
  ta?.addEventListener('input', () => { block.dataset.centerText = ta.value; rerender(); });
  ta?.addEventListener('change', commit);
  wireColor('rdl-center-bg', 'centerBg');
  wireColor('rdl-center-color', 'centerColor');
  $('rdl-center-samples')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-sample]');
    if (!btn || !radialCenterKeys().includes(btn.dataset.sample)) return;
    block.dataset.centerImg = btn.dataset.sample;
    rerender(); reopen(); commit();
  });

  // ── Label ──
  wireType('rdl-label', _LABEL_OPTS, 'labelPos');
  wireNum('rdl-labelsize', 'labelSize');
  wireColor('rdl-labelcolor', 'labelColor');
  wireOnlyNum('rdl-labelgap-number', 'labelGap');
  wireOnlyNum('rdl-labelwidth-number', 'labelWidth');
  wireType('rdl-labelweight', [['bold'], ['normal']], 'labelWeight');

  // ── Data ──
  const list = $('rdl-data-list');
  const rowIdx = (el) => { const r = el?.closest?.('.rdl-data-item'); return r ? Number(r.dataset.index) : -1; };
  list?.addEventListener('input', (e) => {
    if (!e.target.matches('.grb-data-label-input') || e.target.readOnly) return;
    const i = rowIdx(e.target);
    const items = curItems();
    if (!items[i]) return;
    items[i].label = e.target.value;
    setItems(items); rerender();
    const one = $('rdl-item-label');
    if (one && block._rdlSel === i) one.value = e.target.value;
  });
  list?.addEventListener('change', (e) => { if (e.target.matches('.grb-data-label-input')) commit(); });
  list?.addEventListener('focusin', (e) => {
    if (!e.target.matches('.grb-data-label-input')) return;
    const i = rowIdx(e.target);
    if (i < 0 || block._rdlSel === i) return;
    const at = e.target.selectionStart;
    reopen(i);
    const again = document.querySelector(`#rdl-data-list .rdl-data-item[data-index="${i}"] .grb-data-label-input`);
    again?.focus();
    try { if (at != null) again?.setSelectionRange(at, at); } catch (_) {}
  });
  list?.addEventListener('click', (e) => {
    const del = e.target.closest('.grb-data-del-btn');
    if (del) {
      const st2 = radialStateOf(block);
      if (st2.shape === 'poly' || st2.count <= radialCountLimits(st2.shape).min) return;
      const i = Number(del.dataset.index);
      const items = st2.items;
      items.splice(i, 1);
      block.dataset.count = String(items.length);
      setItems(items);
      const cur = block._rdlSel ?? -1;
      block._rdlSel = cur === i ? -1 : (cur > i ? cur - 1 : cur);
      rerender(); reopen(); commit();
      return;
    }
    if (e.target.closest('.rdl-data-dot')) reopen(rowIdx(e.target));
  });
  $('rdl-add-item')?.addEventListener('click', () => stepCount(1));
  $('rdl-reset-all')?.addEventListener('click', () => {
    if (!radialResetPlacement(block)) return;
    rerender(); reopen(); commit();
  });

  // ── 선택한 항목 ──
  const one = $('rdl-item-label');
  one?.addEventListener('input', () => {
    const items = curItems();
    if (!items[sel]) return;
    items[sel].label = one.value;
    setItems(items); rerender();
    const inList = document.querySelector(`#rdl-data-list .rdl-data-item[data-index="${sel}"] .grb-data-label-input`);
    if (inList) { inList.value = one.value.replace(/\r?\n/g, ' ⏎ '); inList.readOnly = /\n/.test(one.value); }
  });
  one?.addEventListener('change', commit);
  $('rdl-item-samples')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-sample]');
    if (!btn) return;
    const key = btn.dataset.sample;
    if (key !== '' && !S.has(key)) return;
    const items = curItems();
    if (!items[sel]) return;
    items[sel].img = key;
    delete items[sel].svg;   // 샘플(또는 없음)을 고르면 붙여넣은 SVG 는 걷는다
    setItems(items);
    rerender(); reopen(); commit();
  });
  // SVG 붙여넣기 — 소독을 지난 것만 저장한다. 못 지나면 dataset 을 안 건드리고 까닭을 적는다.
  const svgTa = $('rdl-item-svg'), svgMsg = $('rdl-item-svg-msg');
  const _SVG_ERR = { NOT_SVG: 'SVG 코드가 아닙니다.', TOO_LARGE: 'SVG 가 너무 큽니다.', EMPTY: '그릴 도형이 없습니다(허용되지 않는 요소만 있었습니다).', NO_SIZE: 'viewBox 또는 width·height 가 필요합니다.', TOO_COMPLEX: 'use 참조가 너무 복잡합니다.', NO_SANITIZER: '소독 함수를 찾지 못했습니다.' };
  const applySvg = () => {
    if (!svgTa) return;
    const raw = svgTa.value.trim();
    const items = curItems();
    if (!items[sel]) return;
    if (!raw) {
      if (items[sel].svg === undefined) return;
      delete items[sel].svg;
    } else {
      if (raw === items[sel].svg) return;
      const r = radialSanitizeSvg(raw);
      if (!r.ok) { if (svgMsg) { svgMsg.textContent = `넣지 못했습니다 — ${_SVG_ERR[r.code] || r.code}`; svgMsg.dataset.err = r.code; } return; }
      items[sel].svg = r.svg;
    }
    setItems(items);
    rerender(); reopen(); commit();
  };
  $('rdl-item-svg-apply')?.addEventListener('click', applySvg);
  svgTa?.addEventListener('change', applySvg);

  // 각도(비우면 자동) · 라벨 간격 · 되돌리기
  const degIn = $('rdl-item-deg');
  degIn?.addEventListener('change', () => {
    const items = curItems();
    if (!items[sel]) return;
    const v = degIn.value.trim();
    if (v === '' || !Number.isFinite(parseFloat(v))) delete items[sel].deg;
    else items[sel].deg = radialNormDeg(parseFloat(v));
    setItems(items);
    rerender(); reopen(); commit();
  });
  const wireOff = (id, key) => {
    const el = $(id);
    el?.addEventListener('change', () => {
      const items = curItems();
      if (!items[sel]) return;
      const x = Math.round(G.clamp(parseFloat(el.value), L[key].min, L[key].max, 0));
      if (x === 0) delete items[sel][key]; else items[sel][key] = x;
      setItems(items);
      rerender(); reopen(); commit();
    });
  };
  wireOff('rdl-item-dx', 'labelDx');
  wireOff('rdl-item-dy', 'labelDy');
  $('rdl-item-reset')?.addEventListener('click', () => {
    if (!radialResetPlacement(block, sel)) return;
    rerender(); reopen(); commit();
  });
}

window.showRadialProperties = showRadialProperties;
