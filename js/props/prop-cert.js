/* prop-cert.js — 인증서 블럭 우측 패널 (인증서 블럭 A · 261114)
 *   dev 관례 그대로: prop-section · sliderRowHTML · colorFieldHTML/wireColorField · .prop-btn · .prop-select · .prop-input(새 CSS 0)
 *   ⚠️우측패널 틀(_panel-frame)은 dev 에 없다(hold 가지) — 그 묶음이 머지되면 이 패널도 틀로 옮길 목록에 든다.
 *   증서 이미지 = prop-grid.js grdPickImageFile(기존 파일창 한 벌 · 자산 URL) — 새 업로드 길 0.
 *   ⛔값은 escHtml 로 속성에 싣는다(블럭 데이터는 남이 준 프로젝트에서 올 수 있다).
 */
import { propPanel } from '../globals.js';
import { blockHeaderHTML, sliderRowHTML, escHtml } from './_helpers.js';
import { colorFieldHTML, wireColorField } from './color-picker.js';
import { grdPickImageFile } from './prop-grid.js';
import { readCertState, setCertList, CERT_STATUSES } from '../blocks/cert-block.js';
import { CERT_PRESET_NAMES, CERT_MAX_SHEETS } from '../blocks/cert-layout.js';

const _ICON = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3"><rect x="2" y="1" width="8" height="10" rx="1"/><path d="M4 4h4M4 6h4M4 8h2"/></svg>`;
const MODE_LABEL = { collage: '흩뿌린 콜라주', grid: '스캔 그리드', frame: '액자 증서' };
const PRESET_LABEL = { s17: '흩뿌림 A(S17)', stair: '계단', pile: '쌓기', auto: '자동' };

const _textRow = (id, label, val, multi = false) => `<div class="prop-row">
        <span class="prop-label">${label}</span>
        ${multi ? `<textarea class="prop-input" id="${id}" rows="2" style="flex:1;resize:vertical">${escHtml(val)}</textarea>`
    : `<input type="text" class="prop-input" id="${id}" value="${escHtml(val)}" style="flex:1;min-width:0">`}
      </div>`;
const _colorRow = (prefix, label, hex) => `<div class="prop-row"><span class="prop-label">${label}</span>${colorFieldHTML({ idPrefix: prefix, hex })}</div>`;

function _certCardHTML(c, i) {
  return `<div class="prop-cell-card crt-card" data-card-index="${i}" style="margin:6px 8px;padding:8px;border:1px solid var(--ui-border-strong);border-radius:6px">
      <div class="prop-row" style="justify-content:space-between"><span class="prop-label">증서 ${i + 1}</span>
        <span style="display:flex;gap:4px">
          <button class="prop-btn crt-img-pick" data-idx="${i}" style="width:auto;padding:0 8px">${c.img ? '이미지 바꾸기' : '이미지 넣기'}</button>
          ${c.img ? `<button class="prop-btn crt-img-clear" data-idx="${i}" style="width:auto;padding:0 8px" title="이미지 빼기(자리표시로)">빼기</button>` : ''}
        </span></div>
      <div class="prop-row"><span class="prop-label">인증명</span><input type="text" class="prop-input crt-title" data-idx="${i}" value="${escHtml(c.title)}" style="flex:1;min-width:0"></div>
      <div class="prop-row"><span class="prop-label">설명</span><input type="text" class="prop-input crt-desc" data-idx="${i}" value="${escHtml(c.desc)}" style="flex:1;min-width:0"></div>
      <div class="prop-row"><span class="prop-label">상태</span><select class="prop-select crt-status" data-idx="${i}" title="출원·진행 중인 것을 «인증»으로 보이지 않게">
        ${CERT_STATUSES.map((s) => `<option value="${s}"${s === c.status ? ' selected' : ''}>${s || '표시 안 함'}</option>`).join('')}</select></div>
    </div>`;
}

export function showCertProperties(block) {
  if (!block) return;
  const st = readCertState(block);
  const isFrame = st.mode === 'frame', isGrid = st.mode === 'grid', isCollage = st.mode === 'collage';
  propPanel.innerHTML = `
    <div class="prop-section">
${blockHeaderHTML({ icon: _ICON, name: block.dataset.layerName, defaultName: 'Certificate', crumb: window.getBlockBreadcrumb ? window.getBlockBreadcrumb(block) : '', id: block.id })}
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Certificate</div>
      <div class="prop-row"><span class="prop-label">모드</span><select class="prop-select" id="crt-mode">
        ${Object.entries(MODE_LABEL).map(([k, v]) => `<option value="${k}"${k === st.mode ? ' selected' : ''}>${v}</option>`).join('')}</select></div>
      ${isFrame ? '' : _textRow('crt-headline', '헤드라인', st.headline, true) + _textRow('crt-sub', '부제', st.sub, true)}
      ${isCollage ? `<div class="prop-row"><span class="prop-label">배치</span><select class="prop-select" id="crt-preset">
        ${CERT_PRESET_NAMES.map((k) => `<option value="${k}"${k === st.preset ? ' selected' : ''}>${PRESET_LABEL[k] || k}</option>`).join('')}</select></div>
      ${sliderRowHTML('흩뿌림', 'crt-jitter-slider', 'crt-jitter-number', { min: 0, max: 100, step: 5, value: Math.round(st.jitter * 100) })}
      <div class="prop-row"><button class="prop-btn" id="crt-reshuffle" style="width:100%" title="흩뿌림이 0 보다 클 때 다른 배치로">다시 섞기</button></div>
      ${sliderRowHTML('종이 크기', 'crt-sheetw-slider', 'crt-sheetw-number', { min: 20, max: 45, step: 1, value: Math.round(st.sheetW * 100) })}` : ''}
      ${isGrid ? sliderRowHTML('열 수', 'crt-cols-slider', 'crt-cols-number', { min: 1, max: CERT_MAX_SHEETS, step: 1, value: st.cols })
        + sliderRowHTML('간격', 'crt-gap-slider', 'crt-gap-number', { min: 0, max: 80, step: 2, value: st.gap }) : ''}
    </div>
    ${isFrame ? `<div class="prop-section">
      <div class="prop-section-title">증서 내용</div>
      ${_textRow('crt-ftitle', '제목', st.ftitle)}${_textRow('crt-fsub', '영문 부제', st.fsub)}${_textRow('crt-fbody', '본문', st.fbody, true)}
      ${_textRow('crt-fissuer', '발급기관', st.fissuer)}${_textRow('crt-fdate', '일자', st.fdate)}
      <div class="prop-row"><span class="prop-label">낙관</span><span style="display:flex;gap:4px">
        <button class="prop-btn" id="crt-seal-pick" style="width:auto;padding:0 8px">${st.seal ? '이미지 바꾸기' : '이미지 넣기'}</button>
        ${st.seal ? '<button class="prop-btn" id="crt-seal-clear" style="width:auto;padding:0 8px">빼기</button>' : ''}</span></div>
    </div>` : `<div class="prop-section">
      <div class="prop-section-title">증서 ${st.certs.length}</div>
      ${sliderRowHTML('장 수', 'crt-count-slider', 'crt-count-number', { min: 1, max: CERT_MAX_SHEETS, step: 1, value: st.certs.length })}
      <div class="prop-hint" style="padding:2px 8px">증서 이미지는 내 파일만 넣습니다 — 인증기관 로고·마크를 대신 그려 넣지 않습니다.</div>
      ${st.certs.map(_certCardHTML).join('')}
    </div>`}
    <div class="prop-section">
      <div class="prop-section-title">Style</div>
      ${isFrame ? '' : sliderRowHTML('헤드라인 크기', 'crt-headsize-slider', 'crt-headsize-number', { min: 16, max: 80, step: 1, value: st.headSize })}
      ${isFrame ? '' : sliderRowHTML('인증명 크기', 'crt-titlesize-slider', 'crt-titlesize-number', { min: 10, max: 48, step: 1, value: st.titleSize })}
      ${isFrame ? '' : sliderRowHTML('설명 크기', 'crt-descsize-slider', 'crt-descsize-number', { min: 9, max: 32, step: 1, value: st.descSize })}
      ${isFrame ? '' : _colorRow('crt-head', '헤드라인색', st.headColor)}
      ${_colorRow('crt-title', isFrame ? '제목·기관색' : '인증명색', st.titleColor)}
      ${_colorRow('crt-desc', isFrame ? '본문색' : '설명색', st.descColor)}
      ${isCollage ? _colorRow('crt-line', '지시선색', st.lineColor) : ''}
      ${isFrame ? _colorRow('crt-border', '테두리색', st.borderColor) : ''}
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);
  const rerender = () => window.renderCertBlock?.(block);
  const commit = () => { window.pushHistory?.(); window.scheduleAutoSave?.(); };
  const reopen = () => showCertProperties(block);
  const $ = (id) => document.getElementById(id);

  $('crt-mode')?.addEventListener('change', (e) => { block.dataset.mode = e.target.value; rerender(); commit(); reopen(); });
  $('crt-preset')?.addEventListener('change', (e) => { block.dataset.preset = e.target.value; rerender(); commit(); });
  $('crt-reshuffle')?.addEventListener('click', () => {
    block.dataset.seed = String((parseInt(block.dataset.seed, 10) || 1) + 1);
    if (!(parseFloat(block.dataset.jitter) > 0)) block.dataset.jitter = '0.5';   // 0 이면 섞어도 같은 그림 — 섞기를 누르면 흔들림을 켠다
    rerender(); commit(); reopen();
  });
  // 글 칸 — input 마다 그리고, change 에 한 번 기록
  for (const [id, key] of [['crt-headline', 'headline'], ['crt-sub', 'sub'], ['crt-ftitle', 'ftitle'], ['crt-fsub', 'fsub'], ['crt-fbody', 'fbody'], ['crt-fissuer', 'fissuer'], ['crt-fdate', 'fdate']]) {
    const el = $(id); if (!el) continue;
    el.addEventListener('input', () => { block.dataset[key] = el.value; rerender(); });
    el.addEventListener('change', commit);
  }
  // 슬라이더 + 숫자 쌍 (scale: 패널 값 → dataset 값)
  const wireNum = (id, key, min, max, { scale = 1, structural = false } = {}) => {
    const s = $(`${id}-slider`), n = $(`${id}-number`);
    if (!s || !n) return;
    const apply = (v) => { const x = Math.min(max, Math.max(min, Number.isFinite(v) ? v : min)); block.dataset[key] = String(x * scale); rerender(); s.value = x; n.value = x; };
    s.addEventListener('input', () => apply(parseFloat(s.value)));
    s.addEventListener('change', () => { commit(); if (structural) reopen(); });
    n.addEventListener('change', () => { apply(parseFloat(n.value)); commit(); if (structural) reopen(); });
  };
  wireNum('crt-jitter', 'jitter', 0, 100, { scale: 0.01 });
  wireNum('crt-sheetw', 'sheetW', 20, 45, { scale: 0.01 });
  wireNum('crt-cols', 'cols', 1, CERT_MAX_SHEETS);
  wireNum('crt-gap', 'gap', 0, 80);
  wireNum('crt-headsize', 'headSize', 16, 80);
  wireNum('crt-titlesize', 'titleSize', 10, 48);
  wireNum('crt-descsize', 'descSize', 9, 32);
  // 장 수 — 늘리면 «○○ 인증 n» 자리표시를 덧붙이고, 줄이면 뒤에서 뺀다(있던 글·그림은 남는 장에 그대로)
  {
    const s = $('crt-count-slider'), n = $('crt-count-number');
    const apply = (v) => {
      const k = Math.min(CERT_MAX_SHEETS, Math.max(1, Math.round(v) || 1));
      const certs = readCertState(block).certs;
      while (certs.length < k) certs.push({ title: `○○ 인증 ${certs.length + 1}`, desc: '인증 내용을 한 줄로 적으세요', img: '', status: '' });
      setCertList(block, certs.slice(0, k));
      if (s) s.value = k; if (n) n.value = k;
    };
    s?.addEventListener('input', () => apply(parseFloat(s.value)));
    s?.addEventListener('change', () => { commit(); reopen(); });
    n?.addEventListener('change', () => { apply(parseFloat(n.value)); commit(); reopen(); });
  }
  // 증서 카드 — 글·상태·이미지
  const patchCert = (i, patch, { record = false, reopenAfter = false } = {}) => {
    const certs = readCertState(block).certs;
    if (!certs[i]) return;
    certs[i] = { ...certs[i], ...patch };
    setCertList(block, certs);
    if (record) commit();
    if (reopenAfter) reopen();
  };
  propPanel.querySelectorAll('.crt-title, .crt-desc').forEach((el) => {
    const key = el.classList.contains('crt-title') ? 'title' : 'desc';
    el.addEventListener('input', () => patchCert(+el.dataset.idx, { [key]: el.value }));
    el.addEventListener('change', commit);
  });
  propPanel.querySelectorAll('.crt-status').forEach((el) => el.addEventListener('change', () => patchCert(+el.dataset.idx, { status: el.value }, { record: true })));
  propPanel.querySelectorAll('.crt-img-pick').forEach((el) => el.addEventListener('click', () => {
    const i = +el.dataset.idx;
    grdPickImageFile((src) => { if (block.isConnected) patchCert(i, { img: src }, { record: true, reopenAfter: true }); });
  }));
  propPanel.querySelectorAll('.crt-img-clear').forEach((el) => el.addEventListener('click', () => patchCert(+el.dataset.idx, { img: '' }, { record: true, reopenAfter: true })));
  $('crt-seal-pick')?.addEventListener('click', () => grdPickImageFile((src) => { if (!block.isConnected) return; block.dataset.seal = src; rerender(); commit(); reopen(); }));
  $('crt-seal-clear')?.addEventListener('click', () => { delete block.dataset.seal; rerender(); commit(); reopen(); });
  // 색 — 공용 색 칸
  for (const [prefix, key] of [['crt-head', 'headColor'], ['crt-title', 'titleColor'], ['crt-desc', 'descColor'], ['crt-line', 'lineColor'], ['crt-border', 'borderColor']]) {
    if (!$(`${prefix}-color`)) continue;
    wireColorField(prefix, { onApply: (c) => { block.dataset[key] = c; rerender(); }, onCommit: commit });
  }
}

window.showCertProperties = showCertProperties;
