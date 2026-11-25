/* prop-cert.js — A4 용지 스택(cert-block · 보이는 이름 «Documents») 우측 패널 (A · 261114 reframe)
 *   dev 관례 그대로: prop-section · sliderRowHTML · colorFieldHTML/wireColorField · .prop-btn · .prop-select · .prop-input · check 부품 checkHTML(현빈 261123 · 새 CSS 0)
 *   ★우측패널 틀(_panel-frame) 이관 = rp-on-dev ⓐ(261118) — 절은 renderPanel/sec(아래 머리말).
 *   용지 그림 = 캔버스에서만(끌어 놓기·더블클릭·스크래치 끌기 — cert-block.js · canvas-scratch-drop.js) · 패널 용지 카드는 현빈 261114 ⑥ 으로 뺐다.
 *   ⛔값은 escHtml 로 속성에 싣는다(블럭 데이터는 남이 준 프로젝트에서 올 수 있다).
 */
import { blockHeaderHTML, sliderRowHTML, escHtml, checkHTML } from './_helpers.js';
import { positionSectionHTML, positionHeadToolsHTML } from './_position-section.js';   // 표준 Position 절(시트 222 DS-POSITION-STD-REST-01)
import { renderPanel, sec } from './_panel-frame.js';
import { wireFloatToggle, wireFloatPosition, posElOf, isFloat } from '../overlay-float.js';
import { colorFieldHTML, wireColorField } from './color-picker.js';
import { readCertState, setCertList, CERT_SHADOWS } from '../blocks/cert-block.js';
const SHADOW_LABEL = { none: '없음', soft: '부드럽게', strong: '진하게' };
const MODE_LABEL = { stack: '스택(겹침)', grid: '격자(A4 칸)' };
import { CERT_PRESET_NAMES, CERT_MAX_SHEETS, CERT_MAX_GRID, CERT_SHEET_H } from '../blocks/cert-layout.js';
import { layoutGapSlotHTML, layoutSlotNumberHTML, wireLayoutSection } from './_layout-section.js';   // 표준 Layout(C2)
import { appearanceSectionHTML, appearanceHeadToolsHTML, wireAppearanceSection } from './_appearance-section.js';   // 표준 Appearance A4(C2)
const PICK_COLS = 4, PICK_ROWS = 3;   // 그리드 피커 4×3 = CERT_MAX_GRID

const _ICON = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3"><rect x="3.5" y="1" width="6" height="8.5" rx="0.5"/><path d="M2.5 2.5v8.5h6"/></svg>`;
const PRESET_LABEL = { fan: '부채(기본)', s17: '흩뿌림', stair: '계단', pile: '쌓기', auto: '자동' };

/** ⑭ 자석 턱 — v 가 target ±tol 안이면 target 으로(슬라이더 끌기 전용 · 숫자 칸 직접 입력엔 안 씀). */
const _snapNear = (v, target, tol) => (Math.abs(v - target) <= tol ? target : v);
const _toggleRow = (id, label, on, title = '') => `<div class="prop-row"${title ? ` title="${escHtml(title)}"` : ''}>
        ${checkHTML({ id, label, checked: on })}
      </div>`;
const _colorRow = (prefix, label, hex) => `<div class="prop-row" data-own="special:Callouts"><span class="prop-label">${label}</span>${colorFieldHTML({ idPrefix: prefix, hex })}</div>`;   // 쓰는 곳 = Callouts 절 하나(⑰ⓓ)

export function showCertProperties(block) {
  if (!block) return;
  const st = readCertState(block);
  const withCallouts = st.callouts === 'on';
  /* 이펙트 대상 — 블럭에 기억(패널을 다시 그려도 유지) · 'all' = 모든 용지(표시 값은 용지 1) */
  const fxTarget = (block._crtFxTarget === 'all' || (+block._crtFxTarget >= 0 && +block._crtFxTarget < st.certs.length)) ? String(block._crtFxTarget) : 'all';
  const fx = st.certs[fxTarget === 'all' ? 0 : +fxTarget].fx;
  const rows = Math.ceil(st.certs.length / st.cols);
  // 패딩 제외 — 섹션에 좌우 패딩이 있거나 이미 켜져 있을 때만(월계수 _lrlCanFB 와 같은 조건)
  const canFB = block.dataset.fullBleed === 'true' || (window.effectiveSectionPadX?.(block) || 0) > 0;
  /* ⑫ 용지 높이(세로/가로 %) — 스택은 «용지 크기» 바로 아래 · 격자는 ⑰ⓒ «피커 → 용지 높이 → 가로 간격 → 세로 간격» */
  /* ⑰ⓑ 오버레이(플로팅) — 공용 js/overlay-float.js 한 벌(모달·아이콘과 같은 겉모습·배선) · 떠 있나 = 공용 isFloat */
  const _crtPosEl = posElOf(block);
  const _crtIsFloat = !!(_crtPosEl && isFloat(_crtPosEl));
  /* ★표준 Layout(C2) — 옛 슬라이더 crt-sheetw/sheeth/gapx/gapy/jitter 걷음 → 블럭 슬롯·간격 슬롯(숫자 + 라벨 끌기) · 숫자 칸 id·범위·저장 키 무변
     ⚠️⑭ 자석 턱 141 은 슬라이더 끌기에만 있던 몫 — 슬라이더와 같이 빠짐(숫자 칸 직접 입력엔 원래 없음 · 탑 판정 청) */
  const sheetHRow = layoutSlotNumberHTML({ id: 'crt-sheeth-number', label: '용지 높이', value: st.sheetH, min: CERT_SHEET_H.min, max: CERT_SHEET_H.max });
  const calloutsRow = _toggleRow('crt-callouts', '지시선 글', withCallouts, st.mode === 'grid' ? '용지마다 아래 제목·설명(+상태 칩)' : '용지마다 세로 지시선 + 제목·설명(+상태 칩)');
  /* ★rp-on-dev ⓐ(261118) — 우측 패널 틀(_panel-frame)로 이관. 옛 「Documents」 한 절을 소유대로 갈랐다(id·배선 무변):
       Kind = 모드·배치 · Content = 장 수·샘플넣기 · Position = X/Y(+머리 손잡이 플로팅 — asset·shape 선례) · Size = 용지 크기·높이(스택)
       Layout = 격자 피커→용지 높이→가로/세로 간격→겹침 순서(⑰ⓒ·⑱ 한 몸 · 격자) / 흩뿌림·다시 섞기(스택) · Padding = 패딩 제외(frame 선례)
       Effects = 이펙트(id crt-fx-section) · special «Callouts» = 지시선 글 토글 + 크기·색(⑰ⓓ 맨 아래 한 절 · id crt-callouts-section). */
  const isGrid = st.mode === 'grid';
  renderPanel(block, {
    header: blockHeaderHTML({ icon: _ICON, name: block.dataset.layerName, defaultName: 'Documents', crumb: window.getBlockBreadcrumb ? window.getBlockBreadcrumb(block) : '', id: block.id }),
    sections: [
      sec('kind', `
      <div class="prop-row"><span class="prop-label">모드</span><select class="prop-select" id="crt-mode">
        ${Object.entries(MODE_LABEL).map(([k, v]) => `<option value="${k}"${k === st.mode ? ' selected' : ''}>${v}</option>`).join('')}</select></div>` + (isGrid ? '' : `
      <div class="prop-row"><span class="prop-label">배치</span><select class="prop-select" id="crt-preset">
        ${CERT_PRESET_NAMES.map((k) => `<option value="${k}"${k === st.preset ? ' selected' : ''}>${PRESET_LABEL[k] || k}</option>`).join('')}</select></div>`)),
      sec('content', (isGrid ? '' : `
      ${sliderRowHTML('장 수', 'crt-count-slider', 'crt-count-number', { min: 1, max: CERT_MAX_SHEETS, step: 1, value: st.certs.length })}`) + `
      ${_toggleRow('crt-samples', '샘플넣기', block.dataset.samples === 'on', '빈 칸에 샘플 문서를 보여 줌(넣은 그림은 안 덮음 · 저장·내보내기엔 안 들어감)')}`),
      sec('position', positionSectionHTML({ prefix: 'crt', posEl: _crtPosEl }), { headTools: positionHeadToolsHTML({ prefix: 'crt', ialId: 'crt-float-toggle', ialOn: _crtIsFloat, rotCan: false }) }),   // 표준 Position — 회전 없음(슬라이드 disabled) · id·배선 무변
      sec('size', isGrid ? '' : `
      ${layoutSlotNumberHTML({ id: 'crt-sheetw-number', label: '용지 크기', value: Math.round(st.sheetW * 100), min: 20, max: 45 })}
      ${sheetHRow}`),
      sec('layout', isGrid ? `
      <div class="grid-picker" id="crt-grid-picker" title="열 × 행 — 장 수 = 열 × 행"></div>
      <div class="grid-picker-label" id="crt-grid-picker-label">${st.cols} × ${rows}</div>
      ${sheetHRow}
      ${layoutGapSlotHTML({ xId: 'crt-gapx-number', yId: 'crt-gapy-number', x: st.gapX, y: st.gapY, min: -80, max: 80 })}
      <div class="prop-row" title="간격이 음수일 때 겹친 칸의 위아래"><span class="prop-label">겹침 순서</span><select class="prop-select" id="crt-overlap">
        <option value="right"${st.overlap === 'left' ? '' : ' selected'}>오른쪽이 위</option><option value="left"${st.overlap === 'left' ? ' selected' : ''}>왼쪽이 위</option></select></div>` : `
      ${layoutSlotNumberHTML({ id: 'crt-jitter-number', label: '흩뿌림', value: Math.round(st.jitter * 100), min: 0, max: 100, step: 5 })}
      <div class="prop-row"><button class="prop-btn" id="crt-reshuffle" style="width:100%" title="흩뿌림이 0 보다 클 때 다른 배치로">다시 섞기</button></div>`),
      sec('appearance', appearanceSectionHTML({ prefix: 'crt', op: { value: window.readBlockOpacity?.(block) ?? 100 } }), { headTools: appearanceHeadToolsHTML({ prefix: 'crt' }) }),   // ★표준 Appearance A4(C2) — Opacity 만
      sec('padding', canFB ? `
      ${_toggleRow('crt-fullbleed', '패딩 제외', block.dataset.fullBleed === 'true', '섹션 좌우 패딩을 무시하고 끝까지')}` : ''),
      sec('effects', `
      <div class="prop-row"><span class="prop-label">대상</span><select class="prop-select" id="crt-fx-target">
        <option value="all"${fxTarget === 'all' ? ' selected' : ''}>모든 용지</option>
        ${st.certs.map((_, i) => `<option value="${i}"${String(i) === fxTarget ? ' selected' : ''}>용지 ${i + 1}</option>`).join('')}</select></div>
      ${sliderRowHTML('회전°', 'crt-fx-rot-slider', 'crt-fx-rot-number', { min: -30, max: 30, step: 1, value: Math.round(fx.rot) })}
      ${sliderRowHTML('기울기°', 'crt-fx-tilt-slider', 'crt-fx-tilt-number', { min: -40, max: 40, step: 1, value: Math.round(fx.tilt) })}
      <div class="prop-row"><span class="prop-label">그림자</span><select class="prop-select" id="crt-fx-shadow">
        ${Object.keys(CERT_SHADOWS).map((k) => `<option value="${k}"${k === fx.shadow ? ' selected' : ''}>${SHADOW_LABEL[k]}</option>`).join('')}</select></div>`, { id: 'crt-fx-section' }),
      /* ⑰ⓓ «지시선 글» 토글 = 패널 맨 아래 절 첫 줄 · 켜면 그 바로 아래에 크기·색 — 색 줄은 data-own 으로 이 절 소유(현빈 ⑰ⓓ «같은 절 바로 아래» · 색 단어 규칙은 Fill/Stroke 로 보냄) */
      sec('special', `
      ${calloutsRow}
      ${withCallouts ? sliderRowHTML('제목 크기', 'crt-titlesize-slider', 'crt-titlesize-number', { min: 10, max: 48, step: 1, value: st.titleSize })
        + sliderRowHTML('설명 크기', 'crt-descsize-slider', 'crt-descsize-number', { min: 9, max: 32, step: 1, value: st.descSize })
        + _colorRow('crt-title', '제목색', st.titleColor) + _colorRow('crt-desc', '설명색', st.descColor) + _colorRow('crt-line', '지시선색', st.lineColor) : ''}`, { title: 'Callouts', id: 'crt-callouts-section' }),
    ],
  });

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);
  const rerender = () => window.renderCertBlock?.(block);
  const commit = () => { window.pushHistory?.(); window.scheduleAutoSave?.(); };
  const reopen = () => showCertProperties(block);
  const $ = (id) => document.getElementById(id);

  $('crt-mode')?.addEventListener('change', (e) => { block.dataset.mode = e.target.value; rerender(); commit(); reopen(); });
  $('crt-preset')?.addEventListener('change', (e) => { block.dataset.preset = e.target.value; rerender(); commit(); });
  $('crt-overlap')?.addEventListener('change', (e) => { block.dataset.overlap = e.target.value; rerender(); commit(); });   // ⑬ 격자만
  $('crt-reshuffle')?.addEventListener('click', () => {
    block.dataset.seed = String((parseInt(block.dataset.seed, 10) || 1) + 1);
    if (!(parseFloat(block.dataset.jitter) > 0)) block.dataset.jitter = '0.5';   // 0 이면 섞어도 같은 그림 — 섞기를 누르면 흔들림을 켠다
    rerender(); commit(); reopen();
  });
  // 이펙트 — 대상(모든 용지 / 용지 n)에 같은 값
  $('crt-fx-target')?.addEventListener('change', (e) => { block._crtFxTarget = e.target.value; reopen(); });
  const applyFx = (patch, record) => {
    const certs = readCertState(block).certs;
    const idx = fxTarget === 'all' ? certs.map((_, i) => i) : [+fxTarget];
    for (const i of idx) certs[i] = { ...certs[i], fx: { ...certs[i].fx, ...patch } };
    setCertList(block, certs);
    if (record) commit();
  };
  for (const [id, key] of [['crt-fx-rot', 'rot'], ['crt-fx-tilt', 'tilt']]) {
    const sl = $(`${id}-slider`), nu = $(`${id}-number`);
    sl?.addEventListener('input', () => { nu.value = sl.value; applyFx({ [key]: +sl.value }); });
    sl?.addEventListener('change', commit);
    nu?.addEventListener('change', () => { sl.value = nu.value; applyFx({ [key]: +nu.value }, true); });
  }
  $('crt-fx-shadow')?.addEventListener('change', (e) => applyFx({ shadow: e.target.value }, true));
  for (const [id, key] of [['crt-callouts', 'callouts'], ['crt-samples', 'samples']]) {   // ⑪ samples = 토글 상태만 저장
    $(id)?.addEventListener('change', (e) => { block.dataset[key] = e.target.checked ? 'on' : 'off'; rerender(); commit(); reopen(); });
  }
  /* 패딩 제외 — 켜기는 renderCertBlock 의 applyBlockFullBleed 가 매 렌더 씌운다 · 끄기는 흔적 지우기 먼저(월계수·배너2 와 같은 순서) */
  $('crt-fullbleed')?.addEventListener('change', (e) => {
    if (e.target.checked) block.dataset.fullBleed = 'true';
    else { delete block.dataset.fullBleed; window.clearBlockFullBleed?.(block); }
    rerender(); commit();
  });
  /* 그리드 피커(prop-laurel.js·canvas 의 .grid-picker 꼴 그대로) — 열 × 행 → 열 수 · 장 수(늘면 빈 용지를 덧붙이고 줄면 뒤에서 뺀다) */
  const picker = $('crt-grid-picker'), pickerLabel = $('crt-grid-picker-label');
  if (picker) {
    for (let r = 1; r <= PICK_ROWS; r++) for (let c = 1; c <= PICK_COLS; c++) {
      const cell = document.createElement('div');
      cell.className = 'grid-picker-cell'; cell.dataset.r = r; cell.dataset.c = c;
      if (c <= st.cols && r <= rows) cell.classList.add('active');
      picker.appendChild(cell);
    }
    const paint = (cc, rr) => picker.querySelectorAll('.grid-picker-cell').forEach((cl) => cl.classList.toggle('active', +cl.dataset.c <= cc && +cl.dataset.r <= rr));
    picker.addEventListener('mouseover', (e) => { const cl = e.target.closest('.grid-picker-cell'); if (!cl) return; paint(+cl.dataset.c, +cl.dataset.r); pickerLabel.textContent = `${cl.dataset.c} × ${cl.dataset.r}`; });
    picker.addEventListener('mouseleave', () => { paint(st.cols, rows); pickerLabel.textContent = `${st.cols} × ${rows}`; });
    picker.addEventListener('click', (e) => {
      const cl = e.target.closest('.grid-picker-cell'); if (!cl) return;
      const cc = +cl.dataset.c, n = Math.min(CERT_MAX_GRID, cc * +cl.dataset.r);
      const certs = readCertState(block).certs;
      while (certs.length < n) certs.push({ title: `제목 ${certs.length + 1}`, desc: '설명 한 줄', img: '', status: '' });
      block.dataset.cols = String(cc);
      setCertList(block, certs.slice(0, n));
      commit(); reopen();
    });
  }
  const wireNum = (id, key, min, max, { scale = 1, snap = null } = {}) => {
    const s = $(`${id}-slider`), n = $(`${id}-number`);
    if (!s || !n) return;
    const apply = (v) => { const x = Math.min(max, Math.max(min, Number.isFinite(v) ? v : min)); block.dataset[key] = String(x * scale); rerender(); s.value = x; n.value = x; };
    s.addEventListener('input', () => { const v = parseFloat(s.value); apply(snap ? _snapNear(v, snap.to, snap.tol) : v); });
    s.addEventListener('change', commit);
    n.addEventListener('change', () => { apply(parseFloat(n.value)); commit(); });
  };
  /* ★표준 Layout(C2) — 칸 배선은 부품(input = 범위 안이면 바로 · change = 잘라 그린 «뒤» commit 한 번 · 빈 칸 = 옛 값 · 라벨 끌기) · 저장 값 꼴(×0.01) 무변 */
  const crtNum = (numberId, key, min, max, scale = 1) => wireLayoutSection({ commit,
    w: { numberId, min, max, apply: (v) => { block.dataset[key] = String(v * scale); rerender(); } } });
  crtNum('crt-jitter-number', 'jitter', 0, 100, 0.01);
  crtNum('crt-sheetw-number', 'sheetW', 20, 45, 0.01);
  crtNum('crt-sheeth-number', 'sheetH', CERT_SHEET_H.min, CERT_SHEET_H.max);
  crtNum('crt-gapx-number', 'gapX', -80, 80);   // ⑦ 음수 = 겹침 · ⑱ 가로(열 사이)
  crtNum('crt-gapy-number', 'gapY', -80, 80);   // ⑱ 세로(행 사이)
  wireAppearanceSection({ op: { numberId: 'crt-opacity', apply: (v) => window.setBlockOpacity?.(block, v), commit } });   // ★표준 Appearance A4(C2)
  wireFloatToggle({ block, buttonId: 'crt-float-toggle', rerender: () => { window.renderCertBlock?.(block); showCertProperties(block); window.showHandlesFor?.(block); } });
  wireFloatPosition({ block, xId: 'crt-x-number', yId: 'crt-y-number' });
  wireNum('crt-titlesize', 'titleSize', 10, 48);
  wireNum('crt-descsize', 'descSize', 9, 32);
  // 장 수 — 늘리면 빈 용지를 덧붙이고, 줄이면 뒤에서 뺀다(있던 그림·글은 남는 장에 그대로)
  {
    const s = $('crt-count-slider'), n = $('crt-count-number');
    const apply = (v) => {
      const k = Math.min(CERT_MAX_SHEETS, Math.max(1, Math.round(v) || 1));
      const certs = readCertState(block).certs;
      while (certs.length < k) certs.push({ title: `제목 ${certs.length + 1}`, desc: '설명 한 줄', img: '', status: '' });
      setCertList(block, certs.slice(0, k));
      if (s) s.value = k; if (n) n.value = k;
    };
    s?.addEventListener('input', () => apply(parseFloat(s.value)));
    s?.addEventListener('change', () => { commit(); reopen(); });
    n?.addEventListener('change', () => { apply(parseFloat(n.value)); commit(); reopen(); });
  }
  for (const [prefix, key] of [['crt-title', 'titleColor'], ['crt-desc', 'descColor'], ['crt-line', 'lineColor']]) {
    if (!$(`${prefix}-color`)) continue;
    wireColorField(prefix, { onApply: (c) => { block.dataset[key] = c; rerender(); }, onCommit: commit });
  }
}

window.showCertProperties = showCertProperties;
