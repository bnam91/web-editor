/* radial-arrange.js — 자유배치 프레임의 「Radial Arrange」 (프로토 Z6-C · 1012t1Z6 · 2026-10-13)
 * 새 블럭이 아니다 — «기존 블럭 조합»(자유배치 프레임 + 서클 블럭 N개)에 좌표를 써 주는 배치 함수와 패널 절 하나다.
 * 모델 = 프레임 dataset 이 진실:
 *   radialArrange '1' · radialShape circle|poly · radialCount · radialRadius · radialStart · radialCell ·
 *   radialCenter '0'|'1' · radialCenterSize · radialFill '1'(새 칸에도 샘플 그림을 채운다)
 * 자식 표식 = 프레임 직속 서클 블럭의 data-radial-role = item(DOM 순서가 항목 순서) | center.
 * 계약(window):
 *   insertRadialArrangeFrame(opts) → 프레임 | null     동기 · 삽입 메뉴 「Proto: Radial Arrange」
 *   applyRadialArrange(frame) → void                    칸 수 맞추기 → 크기 → 프레임 높이 → 좌표 → 가운데 칸
 *   setCircleSampleImage(icb, key) → boolean            샘플 그림을 동기로 넣는다 · '' 는 비우기 · 히스토리는 부르는 쪽이 쌓는다
 *   radialArrangeSectionHTML(ss) · wireRadialArrangeSection(ss, reopen)   프레임 패널 절
 *   circleSampleRowHTML(block) · wireCircleSampleRow(block, reopen)       서클 패널의 샘플 줄(배치된 칸에서만)
 * 히스토리 = 패널은 push-after(적용 먼저 · 기록 나중), 삽입은 프레임 삽입과 같은 push-before.
 * 파일창 · 네트워크 · 타이머 · 대화상자를 쓰지 않는다. 쓰는 전역은 전부 호출 시점에 window 에서 읽는다. */
import './radial-geom.js';
import './radial-samples.js';
import { growFrameToFitChildren } from './frame-geometry.js';   // ★261020 이식: dev 는 window 에 안 올리고 export 로만 둔다(frame-geometry.js:435)

const RA_DEFAULTS = Object.freeze({
  shape: 'circle', count: 6, radius: 250, start: -90, cell: 160, center: '1', centerSize: 220,
});
const RA_LIMITS = Object.freeze({
  RADIUS_MIN: 80, RADIUS_MAX: 400, CELL_MIN: 40, CELL_MAX: 320, CENTER_MIN: 80, CENTER_MAX: 500, PAD: 40,
});
const RA_CENTER_SAMPLE = 'bottle';
const RA_HISTORY = '방사 배치';

const _G = () => window.RADIAL_GEOM;
const _S = () => window.RADIAL_SAMPLES;

function _isFreeFrame(el) {
  return !!(el && el.classList && el.classList.contains('frame-block') && el.dataset.freeLayout === 'true');
}
function _frameWidth(frame) {
  return frame.clientWidth || parseFloat(frame.dataset.width) || 860;
}
function _kids(frame, role) {
  return [...frame.children].filter(c => c.classList?.contains('icon-circle-block') && c.dataset.radialRole === role);
}

/* 프레임 dataset → 죈 값. 반지름은 칸이 프레임 좌우로 잘리지 않는 값까지만 간다(프레임은 넘치는 것을 자른다). */
function readRadialArrange(frame) {
  const G = _G();
  const d = frame.dataset;
  const shape = d.radialShape === 'poly' ? 'poly' : 'circle';
  const count = G.clampCount(shape, d.radialCount, RA_DEFAULTS.count);
  const cell = Math.round(G.clamp(d.radialCell, RA_LIMITS.CELL_MIN, RA_LIMITS.CELL_MAX, RA_DEFAULTS.cell));
  const width = _frameWidth(frame);
  const radiusMax = Math.max(RA_LIMITS.RADIUS_MIN, Math.min(RA_LIMITS.RADIUS_MAX, Math.floor((width - cell) / 2)));
  const radius = Math.round(G.clamp(d.radialRadius, RA_LIMITS.RADIUS_MIN, radiusMax, Math.min(RA_DEFAULTS.radius, radiusMax)));
  const start = Math.round(G.clamp(d.radialStart, G.LIMITS.START_MIN, G.LIMITS.START_MAX, RA_DEFAULTS.start));
  const center = d.radialCenter === '0' ? '0' : '1';
  const centerSize = Math.round(G.clamp(d.radialCenterSize, RA_LIMITS.CENTER_MIN, RA_LIMITS.CENTER_MAX, RA_DEFAULTS.centerSize));
  return { shape, count, cell, radius, radiusMax, start, center, centerSize, width };
}

function _writeModel(frame, m) {
  const d = frame.dataset;
  d.radialArrange = '1';
  d.radialShape = m.shape;
  d.radialCount = String(m.count);
  d.radialRadius = String(m.radius);
  d.radialStart = String(m.start);
  d.radialCell = String(m.cell);
  d.radialCenter = m.center;
  d.radialCenterSize = String(m.centerSize);
}

function _newCircle(frame, role, before) {
  const made = window.makeIconCircleBlock?.();
  const icb = made && made.block;
  if (!icb) return null;
  icb.dataset.radialRole = role;
  icb.style.position = 'absolute';
  if (before) frame.insertBefore(icb, before); else frame.appendChild(icb);
  window.bindBlock?.(icb);
  icb.setAttribute('draggable', 'false');
  return icb;
}

/* 서클 블럭 한 개의 지름 — 서클 패널의 지름 쓰기와 같은 세 줄. */
function _sizeCircle(icb, size) {
  const circle = icb.querySelector('.icb-circle');
  icb.dataset.size = String(size);
  if (!circle) return;
  circle.style.width = size + 'px';
  circle.style.height = size + 'px';
  circle.style.aspectRatio = '1 / 1';
}

/* 자유배치 자식 좌표 — 블럭 상자가 곧 원의 상자라 왼쪽 위 = 중심 − 지름/2. */
function _placeCircle(icb, cx, cy, size) {
  const left = Math.round(cx - size / 2);
  const top = Math.round(cy - size / 2);
  icb.style.position = 'absolute';
  icb.style.left = left + 'px';
  icb.style.top = top + 'px';
  icb.style.width = size + 'px';
  icb.style.transform = '';
  icb.dataset.offsetX = String(left);
  icb.dataset.offsetY = String(top);
  icb.setAttribute('draggable', 'false');
}

function applyRadialArrange(frame) {
  if (!_isFreeFrame(frame) || !_G()) return;
  const G = _G();
  const m = readRadialArrange(frame);
  _writeModel(frame, m);
  let structural = false;

  /* 1) 칸 수 맞추기 — 모자라면 가운데 칸 «앞»에 붙여 항목 칸이 한 줄로 이어지게 하고, 남으면 끝에서부터 뺀다. */
  let items = _kids(frame, 'item');
  const centers = _kids(frame, 'center');
  while (items.length < m.count) {
    const icb = _newCircle(frame, 'item', centers[0] || null);
    if (!icb) break;
    if (frame.dataset.radialFill === '1') setCircleSampleImage(icb, _S()?.KEYS[items.length % _S().KEYS.length] || '');
    items.push(icb);
    structural = true;
  }
  while (items.length > m.count) { items.pop().remove(); structural = true; }

  /* 2) 칸 크기 */
  items.forEach(icb => _sizeCircle(icb, m.cell));

  /* 3) 프레임 높이 = 원 + 칸 + 위아래 여백. 가운데 칸이 더 크면 그쪽에 맞춘다. */
  const ring = 2 * (m.radius + m.cell / 2);
  const height = Math.round(Math.max(ring, m.center === '1' ? m.centerSize : 0) + RA_LIMITS.PAD);
  frame.dataset.height = String(height);
  frame.style.height = height + 'px';
  frame.style.minHeight = height + 'px';

  /* 4) 좌표 */
  const cx = m.width / 2;
  const cy = height / 2;
  const pts = G.points(items.length, m.radius, m.start, cx, cy);
  items.forEach((icb, i) => _placeCircle(icb, pts[i].x, pts[i].y, m.cell));

  /* 5) 가운데 칸 */
  let center = centers[0] || null;
  centers.slice(1).forEach(c => { c.remove(); structural = true; });
  if (m.center === '1') {
    if (!center) {
      center = _newCircle(frame, 'center', null);
      if (center && frame.dataset.radialFill === '1') setCircleSampleImage(center, RA_CENTER_SAMPLE);
      structural = true;
    }
    if (center) { _sizeCircle(center, m.centerSize); _placeCircle(center, cx, cy, m.centerSize); }
  } else if (center) {
    center.remove();
    structural = true;
  }

  /* 6) 칸이 늘거나 줄었을 때만 레이어 트리를 다시 짓는다(슬라이더를 끄는 동안에는 좌표만 바뀐다). */
  if (structural) window.buildLayerPanel?.();
  if (frame.classList.contains('selected')) window.showFrameHandles?.(frame);
}

/* 서클 블럭에 샘플 그림을 넣는다 — 파일로 넣었을 때와 같은 DOM 꼴을 동기로 쓴다. key '' 는 비우기. */
function setCircleSampleImage(icb, key) {
  const S = _S();
  const circle = icb && icb.querySelector && icb.querySelector('.icb-circle');
  if (!circle || !S) return false;
  const kids = circle.querySelector(':scope > .icb-children');
  delete icb.dataset.imgW;
  delete icb.dataset.imgX;
  delete icb.dataset.imgY;
  delete icb.dataset.imgScale;
  delete icb.dataset.imgPosition;
  if (!key) {
    icb.classList.remove('has-image');
    delete icb.dataset.imgSrc;
    delete icb.dataset.radialSample;
    circle.innerHTML = '<span class="icb-placeholder"></span>';
    if (kids) circle.appendChild(kids);
    return true;
  }
  if (!S.has(key)) return false;
  const src = S.dataUri(key);
  icb.classList.add('has-image');
  icb.dataset.imgSrc = src;
  icb.dataset.radialSample = key;
  circle.style.position = 'relative';
  circle.innerHTML = `
      <img class="icb-img" src="${src}" style="width:100%;height:100%;object-fit:cover;display:block;" draggable="false">
      <button class="icb-clear-btn" title="이미지 제거">✕</button>`;
  if (kids) circle.appendChild(kids);
  circle.querySelector('.icb-clear-btn').addEventListener('click', e => {
    e.stopPropagation();
    window.clearCircleImage?.(icb);
  });
  return true;
}

function fillRadialSamples(frame) {
  const S = _S();
  if (!S) return;
  frame.dataset.radialFill = '1';
  _kids(frame, 'item').forEach((icb, i) => setCircleSampleImage(icb, S.KEYS[i % S.KEYS.length]));
  _kids(frame, 'center').forEach(icb => setCircleSampleImage(icb, RA_CENTER_SAMPLE));
}
function clearRadialSamples(frame) {
  delete frame.dataset.radialFill;
  [..._kids(frame, 'item'), ..._kids(frame, 'center')].forEach(icb => setCircleSampleImage(icb, ''));
}

/* 배치 안 된 자유배치 프레임을 배치 프레임으로 — 이미 들어 있는 직속 서클 블럭을 항목 칸으로 받아들인다. */
function startRadialArrange(frame) {
  if (!_isFreeFrame(frame)) return;
  const G = _G();
  const own = [...frame.children].filter(c => c.classList?.contains('icon-circle-block') && !c.dataset.radialRole);
  own.slice(0, G.LIMITS.COUNT_MAX).forEach(c => { c.dataset.radialRole = 'item'; });
  const d = frame.dataset;
  d.radialArrange = '1';
  d.radialShape = RA_DEFAULTS.shape;
  d.radialCount = String(G.clampCount('circle', _kids(frame, 'item').length || RA_DEFAULTS.count));
  d.radialRadius = String(RA_DEFAULTS.radius);
  d.radialStart = String(RA_DEFAULTS.start);
  d.radialCell = String(RA_DEFAULTS.cell);
  d.radialCenter = RA_DEFAULTS.center;
  d.radialCenterSize = String(RA_DEFAULTS.centerSize);
  applyRadialArrange(frame);
}

function insertRadialArrangeFrame(opts = {}) {
  const G = _G();
  const sec = window.getSelectedSection?.();
  if (!sec) { window.showNoSelectionHint?.(); return null; }
  if (!G || !window.makeFrameBlock || !window.makeIconCircleBlock) return null;
  window.pushHistory?.();
  const ss = window.makeFrameBlock({});
  window.insertAfterSelected?.(sec, ss);
  if (!ss.parentElement) (sec.querySelector('.section-inner') || sec).appendChild(ss);

  /* 자유배치 프레임 «안»에 들어갔으면 좌표를 준다 — 안 주면 먼저 있던 자식과 같은 자리에 포개진다. */
  const host = ss.parentElement;
  if (_isFreeFrame(host)) {
    const bottom = [...host.children].reduce((y, c) => (
      c === ss || !c.style || c.style.position !== 'absolute' ? y : Math.max(y, (parseInt(c.style.top) || 0) + (c.offsetHeight || 0))
    ), 0);
    const top = bottom > 0 ? bottom + 16 : 0;
    ss.style.position = 'absolute';
    ss.style.left = '0px';
    ss.style.top = top + 'px';
    ss.dataset.offsetX = '0';
    ss.dataset.offsetY = String(top);
  }

  const shape = opts.shape === 'poly' ? 'poly' : RA_DEFAULTS.shape;
  const d = ss.dataset;
  d.radialArrange = '1';
  d.radialShape = shape;
  d.radialCount = String(G.clampCount(shape, opts.count, RA_DEFAULTS.count));
  d.radialRadius = String(opts.radius ?? RA_DEFAULTS.radius);
  d.radialStart = String(opts.start ?? RA_DEFAULTS.start);
  d.radialCell = String(opts.cell ?? RA_DEFAULTS.cell);
  d.radialCenter = (opts.center === false || opts.center === '0' || opts.center === 0) ? '0' : '1';
  d.radialCenterSize = String(opts.centerSize ?? RA_DEFAULTS.centerSize);
  if (opts.samples !== false) d.radialFill = '1';
  applyRadialArrange(ss);
  if (_isFreeFrame(host)) growFrameToFitChildren(host);

  window.bindFrameDropZone?.(ss);
  window.buildLayerPanel?.();
  window.deselectAll?.();
  sec.classList.add('selected');
  window.syncLayerActive?.(sec);
  ss.classList.add('selected');
  window._activeFrame = ss;
  window.showFrameProperties?.(ss);
  window.showFrameHandles?.(ss);
  window.pushHistory?.(RA_HISTORY);
  return ss;
}

/* ══════════════════════════════════════
   프레임 패널 절 「Radial Arrange」
══════════════════════════════════════ */
function _sliderRow(label, id, min, max, step, value) {
  return `
      <div class="prop-row">
        <span class="prop-label">${label}</span>
        <input type="range" class="prop-slider" id="${id}-slider" min="${min}" max="${max}" step="${step}" value="${value}">
        <input type="number" class="prop-number" id="${id}-number" min="${min}" max="${max}" value="${value}">
      </div>`;
}

function radialArrangeSectionHTML(ss) {
  if (!_isFreeFrame(ss) || !_G()) return '';
  if (ss.dataset.radialArrange !== '1') {
    return `
    <div class="prop-section" id="ss-radial-section">
      <div class="prop-section-title">Radial Arrange</div>
      <button class="prop-action-btn secondary" id="ss-radial-apply">원형으로 배치 시작</button>
      <div class="prop-hint">이 프레임의 서클 블럭을 원 위에 고르게 놓습니다. 없으면 6개를 새로 넣습니다.</div>
    </div>`;
  }
  const G = _G();
  const m = readRadialArrange(ss);
  const isPoly = m.shape === 'poly';
  const shapeBtns = [['circle', '원']];
  for (let n = G.LIMITS.POLY_MIN; n <= G.LIMITS.POLY_MAX; n++) shapeBtns.push([String(n), String(n)]);
  const active = isPoly ? String(m.count) : 'circle';
  const countMin = isPoly ? G.LIMITS.POLY_MIN : G.LIMITS.COUNT_MIN;
  const countMax = isPoly ? G.LIMITS.POLY_MAX : G.LIMITS.COUNT_MAX;
  const off = 'opacity:0.4;pointer-events:none;';
  const filled = _kids(ss, 'item').some(c => c.classList.contains('has-image'));
  return `
    <div class="prop-section" id="ss-radial-section">
      <div class="prop-section-title">Radial Arrange</div>
      <div class="prop-row">
        <span class="prop-label">모양</span>
        <div class="prop-type-group" style="flex:1;min-width:0;margin-bottom:0;">
          ${shapeBtns.map(([k, ko]) => `<button class="prop-type-btn${k === active ? ' active' : ''}" id="ss-radial-shape-${k}" data-radial-shape="${k}" title="${k === 'circle' ? '원 — 항목 수를 자유롭게' : `${k}각형 — 항목 수 ${k}개`}" style="min-width:0;">${ko}</button>`).join('')}
        </div>
      </div>
      <div class="prop-row">
        <span class="prop-label">항목 수</span>
        <button class="prop-count-btn" id="ss-radial-count-minus" style="${isPoly || m.count <= countMin ? off : ''}">−</button>
        <span class="prop-count-val" id="ss-radial-count-val">${m.count}</span>
        <button class="prop-count-btn" id="ss-radial-count-plus" style="${isPoly || m.count >= countMax ? off : ''}">+</button>
        ${isPoly ? '<span class="prop-hint" style="padding:0 0 0 6px;text-align:left;">꼭짓점 수로 고정</span>' : ''}
      </div>
      ${_sliderRow('반지름', 'ss-radial-radius', RA_LIMITS.RADIUS_MIN, m.radiusMax, 2, m.radius)}
      ${_sliderRow('시작 각도°', 'ss-radial-start', G.LIMITS.START_MIN, G.LIMITS.START_MAX, 1, m.start)}
      ${_sliderRow('칸 크기', 'ss-radial-cell', RA_LIMITS.CELL_MIN, RA_LIMITS.CELL_MAX, 4, m.cell)}
      <div class="prop-hint" id="ss-radial-overlap-hint" style="display:none;padding:0 0 6px;text-align:left;">칸끼리 겹칩니다 — 반지름을 키우거나 칸 크기를 줄이세요.</div>
      <div class="prop-row">
        <span class="prop-label">가운데 칸</span>
        <label class="prop-toggle" title="원 가운데에 서클 블럭을 하나 더 놓는다">
          <input type="checkbox" id="ss-radial-center-toggle" ${m.center === '1' ? 'checked' : ''}>
          <span class="prop-toggle-track"></span>
        </label>
      </div>
      ${m.center === '1' ? _sliderRow('가운데 크기', 'ss-radial-centersize', RA_LIMITS.CENTER_MIN, RA_LIMITS.CENTER_MAX, 4, m.centerSize) : ''}
      <button class="prop-action-btn secondary" id="ss-radial-fill-samples">샘플 그림 채우기</button>
      <button class="prop-action-btn secondary" id="ss-radial-clear-images" style="${filled ? '' : off}">그림 비우기</button>
      <button class="prop-action-btn primary" id="ss-radial-apply">다시 배치</button>
      <div class="prop-hint">손으로 옮기거나 키운 칸은 처음 자리와 크기로 돌아갑니다 (⌘Z 복원)</div>
    </div>`;
}

function wireRadialArrangeSection(ss, reopen) {
  const root = document.getElementById('ss-radial-section');
  if (!root || !_isFreeFrame(ss)) return;
  const $ = id => root.querySelector('#' + id);
  const G = _G();
  const record = () => window.pushHistory?.(RA_HISTORY);
  const again = () => { if (typeof reopen === 'function') reopen(); };

  if (ss.dataset.radialArrange !== '1') {
    $('ss-radial-apply')?.addEventListener('click', () => { startRadialArrange(ss); record(); again(); });
    return;
  }

  /* 죈 값을 패널 칸에 되비춘다 — 칸 크기를 키우면 반지름 한도가 줄어든다. */
  const sync = () => {
    const m = readRadialArrange(ss);
    const set = (id, v, max) => {
      const s = $(id + '-slider'); const n = $(id + '-number');
      if (max !== undefined) { if (s) s.max = String(max); if (n) n.max = String(max); }
      if (s) s.value = String(v);
      if (n) n.value = String(v);
    };
    set('ss-radial-radius', m.radius, m.radiusMax);
    set('ss-radial-start', m.start);
    set('ss-radial-cell', m.cell);
    set('ss-radial-centersize', m.centerSize);
    const hint = $('ss-radial-overlap-hint');
    if (hint) hint.style.display = G.chord(m.count, m.radius) < m.cell ? '' : 'none';
  };
  const bind = (id, key) => {
    const s = $(id + '-slider'); const n = $(id + '-number');
    const write = raw => {
      const v = parseFloat(raw);
      if (!Number.isFinite(v)) { sync(); return; }
      ss.dataset[key] = String(v);
      applyRadialArrange(ss);
      sync();
    };
    s?.addEventListener('input', e => write(e.target.value));
    s?.addEventListener('change', () => record());
    n?.addEventListener('change', e => { write(e.target.value); e.target.value = ss.dataset[key]; record(); });
  };
  bind('ss-radial-radius', 'radialRadius');
  bind('ss-radial-start', 'radialStart');
  bind('ss-radial-cell', 'radialCell');
  bind('ss-radial-centersize', 'radialCenterSize');
  sync();

  root.querySelectorAll('[data-radial-shape]').forEach(btn => btn.addEventListener('click', () => {
    const k = btn.dataset.radialShape;
    if (k === 'circle') {
      ss.dataset.radialShape = 'circle';
    } else {
      ss.dataset.radialShape = 'poly';
      ss.dataset.radialCount = String(G.clampCount('poly', k));
    }
    applyRadialArrange(ss); record(); again();
  }));
  const step = delta => {
    const m = readRadialArrange(ss);
    const next = G.clampCount(m.shape, m.count + delta, m.count);
    if (next === m.count) return;
    ss.dataset.radialCount = String(next);
    applyRadialArrange(ss); record(); again();
  };
  $('ss-radial-count-minus')?.addEventListener('click', () => step(-1));
  $('ss-radial-count-plus')?.addEventListener('click', () => step(1));
  $('ss-radial-center-toggle')?.addEventListener('change', e => {
    ss.dataset.radialCenter = e.target.checked ? '1' : '0';
    applyRadialArrange(ss); record(); again();
  });
  $('ss-radial-fill-samples')?.addEventListener('click', () => { fillRadialSamples(ss); record(); again(); });
  $('ss-radial-clear-images')?.addEventListener('click', () => { clearRadialSamples(ss); record(); again(); });
  $('ss-radial-apply')?.addEventListener('click', () => { applyRadialArrange(ss); record(); again(); });
}

/* ══════════════════════════════════════
   서클 패널의 샘플 그림 줄 — 배치 프레임의 칸에서만 나온다
══════════════════════════════════════ */
function circleSampleRowHTML(block) {
  const S = _S();
  if (!S || !block || !block.dataset.radialRole) return '';
  const cur = block.classList.contains('has-image') ? (block.dataset.radialSample || '') : '';
  const box = 'width:24px;height:24px;padding:0;border-radius:6px;overflow:hidden;cursor:pointer;flex:0 0 auto;display:flex;align-items:center;justify-content:center;background:var(--ui-bg-input);color:var(--ui-text-dim);font-size:var(--ui-fs-10);';
  const edge = on => `border:${on ? '2px solid var(--ui-accent-primary)' : '1px solid var(--ui-border-mid)'};`;
  return `
      <div class="prop-section-title" style="padding-top:10px;">샘플 그림</div>
      <div id="icb-sample-row" style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;">
        ${S.KEYS.map(k => `<button id="icb-sample-${k}" data-sample="${k}" title="${S.label(k)}" style="${box}${edge(cur === k)}">${S.svg(k)}</button>`).join('')}
        <button id="icb-sample-none" data-sample="" title="그림 비우기" style="${box}${edge(false)}">✕</button>
      </div>`;
}

function wireCircleSampleRow(block, reopen) {
  const row = document.getElementById('icb-sample-row');
  if (!row || !block) return;
  row.querySelectorAll('[data-sample]').forEach(btn => btn.addEventListener('click', () => {
    if (!setCircleSampleImage(block, btn.dataset.sample)) return;
    window.pushHistory?.('샘플 그림');
    if (typeof reopen === 'function') reopen();
  }));
}

window.insertRadialArrangeFrame = insertRadialArrangeFrame;
window.applyRadialArrange = applyRadialArrange;
window.setCircleSampleImage = setCircleSampleImage;
window.radialArrangeSectionHTML = radialArrangeSectionHTML;
window.wireRadialArrangeSection = wireRadialArrangeSection;
window.circleSampleRowHTML = circleSampleRowHTML;
window.wireCircleSampleRow = wireCircleSampleRow;
window.startRadialArrange = startRadialArrange;
