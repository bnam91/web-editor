/* graph-radial.js — 그래프 블럭 「방사형」 유형 (프로토 Z6-B · 1012t1Z6 · 2026-10-13).
 * 항목(dataset.items)마다 마커 하나를 원 위에 등분해 놓고, 연결선 · 바깥 라벨 · 가운데 그림을 얹는다. 값(value)은 이 유형에서 안 쓴다(모델에는 그대로 남는다).
 * 계약(js/drag-utils.js 유형 등록표 · js/props/prop-graph.js 가 «부르는 때» 찾는다):
 *   · window.renderGraphRadial(block, ctx) → void   ctx = { items, chartH, labelSize, valSize }. block.innerHTML 을 통째로 쓴다.
 *   · window.graphRadialSectionHTML(block) → string           패널 「Radial Settings」 절
 *   · window.wireGraphRadialSection(block, reopen) → void     그 절의 배선 · reopen = 패널 다시 열기
 * 모델(전부 block.dataset · 없으면 기본값으로 읽고, 패널이 고칠 때만 쓴다):
 *   radialShape  circle | poly(기본)      바탕 면의 꼴
 *   radialRadius 15~45(기본 34)           정사각 스테이지 한 변 대비 %
 *   radialStart  −180~180(기본 −90 = 12시)
 *   radialMarker dot(기본) | asset        asset 이면 items[i].img(샘플 키)를 마커 안에 그린다
 *   radialMarkerSize 8~96 px(기본 18)
 *   radialLine   none | orbit | outline(기본) | spoke
 *   radialCenter 샘플 키 | ''(기본)
 * 좌표는 radial-geom.js 한 자리, 그림은 radial-samples.js 표(키만 저장 · has() 로 거른 뒤에만 innerHTML 에 넣는다).
 * 사용자 글자는 escHtml(정본), 색은 safeColor 만 지난다. */
import './radial-geom.js';
import './radial-samples.js';
import { escHtml } from './props/_helpers.js';   // HTML 이스케이프의 정본 — 사본을 두지 않는다

const RD = Object.freeze({
  RADIUS_MIN: 15, RADIUS_MAX: 45, RADIUS_DEF: 34,
  SIZE_MIN: 8, SIZE_MAX: 96, SIZE_DEF: 18, SIZE_ASSET_DEF: 72,
  HEIGHT_DEF: 520, LABEL_GAP: 10, CENTER_PCT: 30,
  SHAPES: ['circle', 'poly'], LINES: ['none', 'orbit', 'outline', 'spoke'], MARKERS: ['dot', 'asset'],
});
const SHAPE_LABELS = { circle: '원', poly: '다각형' };
const LINE_LABELS = { none: '없음', orbit: '궤도(원)', outline: '외곽선(다각형)', spoke: '중심선' };

const safeColor = (c) => {
  if (typeof c !== 'string') return '';
  const s = c.trim();
  return (/^#[0-9a-fA-F]{3,8}$/.test(s) || /^rgba?\(\s*[\d.,\s%]+\)$/i.test(s) || /^hsla?\(\s*[\d.,\s%]+\)$/i.test(s)) ? s : '';
};
const oneOf = (v, list, def) => (list.indexOf(v) !== -1 ? v : def);

/* dataset → 죈 설정 한 벌. 렌더와 패널이 같은 것을 읽는다. */
function radialSettings(block) {
  const d = block.dataset, G = window.RADIAL_GEOM, S = window.RADIAL_SAMPLES;
  const marker = oneOf(d.radialMarker, RD.MARKERS, 'dot');
  return {
    shape: oneOf(d.radialShape, RD.SHAPES, 'poly'),
    radius: G.clamp(d.radialRadius, RD.RADIUS_MIN, RD.RADIUS_MAX, RD.RADIUS_DEF),
    start: G.clamp(d.radialStart, G.LIMITS.START_MIN, G.LIMITS.START_MAX, -90),
    marker,
    size: Math.round(G.clamp(d.radialMarkerSize, RD.SIZE_MIN, RD.SIZE_MAX, RD.SIZE_DEF)),
    line: oneOf(d.radialLine, RD.LINES, 'outline'),
    center: S.has(d.radialCenter) ? d.radialCenter : '',
    height: Math.min(2000, Math.max(80, parseInt(d.chartHeight) || RD.HEIGHT_DEF)),
  };
}

window.renderGraphRadial = function renderGraphRadial(block, ctx) {
  if (!block) return;
  const G = window.RADIAL_GEOM, S = window.RADIAL_SAMPLES, d = block.dataset;
  const items = Array.isArray(ctx?.items) ? ctx.items : [];
  const labelSize = parseInt(ctx?.labelSize) || 20;
  const st = radialSettings(block);
  const C = 500, R = st.radius * 10;   // viewBox 0 0 1000 1000 — 반지름 % × 10
  const pts = G.points(items.length, R, st.start, C, C);
  const geo = { cx: C, cy: C, r: R, pts };
  const pct = (n) => (n / 10).toFixed(2) + '%';

  const xInk = safeColor(d.xlabelColor || d.labelColor || '');
  const labelCss = (d.showXLabel !== '0' ? '' : 'display:none;') + (xInk ? `color:${xInk};` : '');

  if (block.style.position !== 'absolute') block.style.height = 'auto';   // 원형·도넛과 같은 꼴 — 흐름 안에서는 높이를 내용이 정한다

  const plateD = st.shape === 'circle' ? G.orbitPath(C, C, R) : G.polygonPath(pts);
  const lineD = G.connectorPath(st.line, geo);
  const off = Math.round(st.size / 2) + RD.LABEL_GAP;

  const nodes = pts.map((p, i) => {
    const it = items[i] || {};
    const pos = `left:${pct(p.x)};top:${pct(p.y)};width:${st.size}px;height:${st.size}px;`;
    if (st.marker === 'asset') {
      const key = S.has(it.img) ? it.img : '';
      return `<div class="grb-radial-node is-asset${key ? '' : ' is-empty'}" data-radial-idx="${i}" style="${pos}">${key ? S.svg(key) : ''}</div>`;
    }
    const c = safeColor(it.color);
    return `<div class="grb-radial-node" data-radial-idx="${i}" style="${pos}${c ? `background:${c};` : ''}"></div>`;
  }).join('');

  const labels = pts.map((p, i) => {
    const a = G.labelAnchor(p, C, C, 0);
    const rad = p.deg * Math.PI / 180;
    const dx = Math.round(Math.cos(rad) * off), dy = Math.round(Math.sin(rad) * off);
    const tx = a.align === 'left' ? 0 : (a.align === 'right' ? -100 : -50);
    const ty = a.v === 'top' ? 0 : (a.v === 'bottom' ? -100 : -50);
    return `<div class="grb-radial-label" data-radial-idx="${i}" style="left:${pct(p.x)};top:${pct(p.y)};`
      + `transform:translate(calc(${tx}% + ${dx}px), calc(${ty}% + ${dy}px));text-align:${a.align};${labelCss}">${escHtml((items[i] || {}).label)}</div>`;
  }).join('');

  const center = st.center ? `<div class="grb-radial-center" style="width:${RD.CENTER_PCT}%;height:${RD.CENTER_PCT}%">${S.svg(st.center)}</div>` : '';

  block.innerHTML = `<div class="grb-radial-wrap">`
    + `<div class="grb-radial-stage" style="width:${st.height}px;font-size:${labelSize}px">`
    + `<svg class="grb-radial-svg" viewBox="0 0 1000 1000" aria-hidden="true">`
    + `<path class="grb-radial-plate" d="${plateD}"/>`
    + `<path class="grb-radial-line" d="${lineD}" vector-effect="non-scaling-stroke"/>`
    + `</svg>${center}${nodes}${labels}</div></div>`;
};

/* ── 패널 「Radial Settings」 ── */
const optionsHTML = (list, labels, cur) => list.map(v => `<option value="${v}"${v === cur ? ' selected' : ''}>${labels[v]}</option>`).join('');
const sampleOptionsHTML = (cur, emptyLabel) => {
  const S = window.RADIAL_SAMPLES;
  return `<option value=""${cur ? '' : ' selected'}>${emptyLabel}</option>`
    + S.KEYS.map(k => `<option value="${k}"${k === cur ? ' selected' : ''}>${S.label(k)}</option>`).join('');
};

window.graphRadialSectionHTML = function graphRadialSectionHTML(block) {
  if (!block) return '';
  const G = window.RADIAL_GEOM, S = window.RADIAL_SAMPLES;
  const st = radialSettings(block);
  let items = []; try { items = JSON.parse(block.dataset.items || '[]'); } catch (_) {}
  const imgRows = st.marker !== 'asset' ? '' : items.map((it, i) => `
      <div class="prop-row">
        <span class="prop-label" title="${escHtml(it && it.label)}">${escHtml((it && it.label) || ('항목 ' + (i + 1)))}</span>
        <select class="prop-select" id="grb-radial-img-${i}" data-radial-img="${i}">${sampleOptionsHTML(S.has(it && it.img) ? it.img : '', '없음')}</select>
      </div>`).join('');
  return `
    <div class="prop-section" id="grb-radial-section">
      <div class="prop-section-title">Radial Settings</div>
      <div class="prop-row" title="바탕 면의 꼴 — 항목 수만큼 꼭짓점이 선다">
        <span class="prop-label">모양</span>
        <select class="prop-select" id="grb-radial-shape">${optionsHTML(RD.SHAPES, SHAPE_LABELS, st.shape)}</select>
      </div>
      <div class="prop-row" title="스테이지 한 변 대비 %(높이를 바꾸면 같이 커진다)">
        <span class="prop-label">반지름</span>
        <input type="range" class="prop-slider" id="grb-radial-radius-slider" min="${RD.RADIUS_MIN}" max="${RD.RADIUS_MAX}" step="1" value="${st.radius}">
        <input type="number" class="prop-number" id="grb-radial-radius-number" min="${RD.RADIUS_MIN}" max="${RD.RADIUS_MAX}" value="${st.radius}">
      </div>
      <div class="prop-row" title="첫 항목의 자리 — −90 = 12시 · 0 = 3시 · 시계 방향">
        <span class="prop-label">시작 각도</span>
        <input type="range" class="prop-slider" id="grb-radial-start-slider" min="${G.LIMITS.START_MIN}" max="${G.LIMITS.START_MAX}" step="5" value="${st.start}">
        <input type="number" class="prop-number" id="grb-radial-start-number" min="${G.LIMITS.START_MIN}" max="${G.LIMITS.START_MAX}" value="${st.start}">
      </div>
      <div class="prop-row">
        <span class="prop-label">마커</span>
        <div class="prop-type-group" style="flex:1;margin-bottom:0">
          <button style="flex:1" class="prop-type-btn ${st.marker === 'dot' ? 'active' : ''}" id="grb-radial-marker-dot">점</button>
          <button style="flex:1" class="prop-type-btn ${st.marker === 'asset' ? 'active' : ''}" id="grb-radial-marker-asset">그림</button>
        </div>
      </div>
      <div class="prop-row">
        <span class="prop-label">마커 크기</span>
        <input type="range" class="prop-slider" id="grb-radial-msize-slider" min="${RD.SIZE_MIN}" max="${RD.SIZE_MAX}" step="2" value="${st.size}">
        <input type="number" class="prop-number" id="grb-radial-msize-number" min="${RD.SIZE_MIN}" max="${RD.SIZE_MAX}" value="${st.size}">
      </div>
      <div class="prop-row">
        <span class="prop-label">연결선</span>
        <select class="prop-select" id="grb-radial-line">${optionsHTML(RD.LINES, LINE_LABELS, st.line)}</select>
      </div>
      <div class="prop-row" title="가운데에 놓는 샘플 그림">
        <span class="prop-label">가운데</span>
        <select class="prop-select" id="grb-radial-center">${sampleOptionsHTML(st.center, '없음')}</select>
      </div>${imgRows ? `
      <div class="prop-hint">항목별 그림 (샘플)</div>${imgRows}` : ''}
    </div>`;
};

window.wireGraphRadialSection = function wireGraphRadialSection(block, reopen) {
  if (!block) return;
  const G = window.RADIAL_GEOM, S = window.RADIAL_SAMPLES;
  const $ = (id) => document.getElementById(id);
  const draw = () => window.renderGraph?.(block);
  const commit = () => window.pushHistory?.();

  /* 슬라이더 + 숫자 칸 한 쌍 — 이웃 절과 같은 꼴: input 에 적용 · change 에 히스토리. 빈 칸(NaN)은 기본값. */
  const pair = (prefix, key, min, max, def) => {
    const sl = $(prefix + '-slider'), nb = $(prefix + '-number');
    if (!sl || !nb) return;
    const apply = (raw) => {
      const v = Math.round(G.clamp(Number.isFinite(raw) ? raw : '', min, max, def));
      block.dataset[key] = v;
      draw();
      sl.value = v; nb.value = v;
    };
    sl.addEventListener('input', () => apply(parseInt(sl.value)));
    nb.addEventListener('change', () => { apply(parseInt(nb.value)); commit(); });
    sl.addEventListener('change', commit);
  };
  pair('grb-radial-radius', 'radialRadius', RD.RADIUS_MIN, RD.RADIUS_MAX, RD.RADIUS_DEF);
  pair('grb-radial-start', 'radialStart', G.LIMITS.START_MIN, G.LIMITS.START_MAX, -90);
  pair('grb-radial-msize', 'radialMarkerSize', RD.SIZE_MIN, RD.SIZE_MAX, RD.SIZE_DEF);

  const shapeSel = $('grb-radial-shape'), lineSel = $('grb-radial-line');
  shapeSel?.addEventListener('change', () => {
    const v = oneOf(shapeSel.value, RD.SHAPES, 'poly');
    block.dataset.radialShape = v;
    /* 테두리 꼴의 연결선(궤도 · 외곽선)은 모양을 따라간다 — 없음 · 중심선은 그대로 둔다. */
    const cur = radialSettings(block).line;
    if (cur === 'orbit' || cur === 'outline') {
      block.dataset.radialLine = v === 'circle' ? 'orbit' : 'outline';
      if (lineSel) lineSel.value = block.dataset.radialLine;
    }
    draw(); commit();
  });
  lineSel?.addEventListener('change', () => {
    block.dataset.radialLine = oneOf(lineSel.value, RD.LINES, 'outline');
    draw(); commit();
  });
  const centerSel = $('grb-radial-center');
  centerSel?.addEventListener('change', () => {
    block.dataset.radialCenter = S.has(centerSel.value) ? centerSel.value : '';
    draw(); commit();
  });

  /* 마커 종류 — 크기가 그 종류에 안 맞는 범위면 그 종류의 기본 크기로 옮긴다(점 18 · 그림 72). 항목별 그림 줄이 바뀌므로 패널을 다시 연다. */
  const setMarker = (m) => {
    const st = radialSettings(block);
    if (st.marker === m) return;
    block.dataset.radialMarker = m;
    if (m === 'asset' && st.size < 40) block.dataset.radialMarkerSize = RD.SIZE_ASSET_DEF;
    if (m === 'dot' && st.size >= 40) block.dataset.radialMarkerSize = RD.SIZE_DEF;
    draw(); commit();
    reopen?.();
  };
  $('grb-radial-marker-dot')?.addEventListener('click', () => setMarker('dot'));
  $('grb-radial-marker-asset')?.addEventListener('click', () => setMarker('asset'));

  /* 항목별 그림 — items[i].img 에 샘플 키만 쓴다(비우면 키를 지운다). 다른 필드는 손대지 않는다. */
  document.querySelectorAll('#grb-radial-section [data-radial-img]').forEach(sel => {
    sel.addEventListener('change', () => {
      const i = parseInt(sel.dataset.radialImg);
      let items = []; try { items = JSON.parse(block.dataset.items || '[]'); } catch (_) {}
      if (!items[i]) return;
      if (S.has(sel.value)) items[i].img = sel.value; else delete items[i].img;
      block.dataset.items = JSON.stringify(items);
      draw(); commit();
    });
  });
};

window.GRAPH_RADIAL = Object.freeze({ LIMITS: RD, settings: radialSettings });
