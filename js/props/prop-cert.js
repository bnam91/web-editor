/* prop-cert.js — A4 용지 스택(cert-block · 보이는 이름 «A4 Stack») 우측 패널 (A · 261114 reframe)
 *   dev 관례 그대로: prop-section · sliderRowHTML · colorFieldHTML/wireColorField · .prop-btn · .prop-select · .prop-input · .prop-toggle(새 CSS 0)
 *   ⚠️우측패널 틀(_panel-frame)은 dev 에 없다(hold 가지) — 그 묶음이 머지되면 이 패널도 틀로 옮길 목록에 든다.
 *   용지 그림 = 캔버스에서 끌어 놓기·더블클릭(cert-block.js) + 여기 «그림 넣기»(prop-grid.js grdPickImageFile — 기존 파일창) · 새 업로드 길 0.
 *   ⛔값은 escHtml 로 속성에 싣는다(블럭 데이터는 남이 준 프로젝트에서 올 수 있다).
 */
import { propPanel } from '../globals.js';
import { blockHeaderHTML, sliderRowHTML, escHtml } from './_helpers.js';
import { colorFieldHTML, wireColorField } from './color-picker.js';
import { grdPickImageFile } from './prop-grid.js';
import { readCertState, setCertList, setCertSlotImage, CERT_STATUSES } from '../blocks/cert-block.js';
import { CERT_PRESET_NAMES, CERT_MAX_SHEETS } from '../blocks/cert-layout.js';

const _ICON = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3"><rect x="3.5" y="1" width="6" height="8.5" rx="0.5"/><path d="M2.5 2.5v8.5h6"/></svg>`;
const PRESET_LABEL = { fan: '부채(기본)', s17: '흩뿌림', stair: '계단', pile: '쌓기', auto: '자동' };

const _toggleRow = (id, label, on, title = '') => `<div class="prop-row"${title ? ` title="${escHtml(title)}"` : ''}>
        <span class="prop-label">${label}</span>
        <label class="prop-toggle"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><span class="prop-toggle-track"></span></label>
      </div>`;
const _textRow = (id, label, val, multi = false) => `<div class="prop-row">
        <span class="prop-label">${label}</span>
        ${multi ? `<textarea class="prop-input" id="${id}" rows="2" style="flex:1;resize:vertical">${escHtml(val)}</textarea>`
    : `<input type="text" class="prop-input" id="${id}" value="${escHtml(val)}" style="flex:1;min-width:0">`}
      </div>`;
const _colorRow = (prefix, label, hex) => `<div class="prop-row"><span class="prop-label">${label}</span>${colorFieldHTML({ idPrefix: prefix, hex })}</div>`;

function _slotCardHTML(c, i, withCallouts) {
  return `<div class="prop-cell-card crt-card" data-card-index="${i}" style="margin:6px 8px;padding:8px;border:1px solid var(--ui-border-strong);border-radius:6px">
      <div class="prop-row" style="justify-content:space-between"><span class="prop-label">용지 ${i + 1}</span>
        <span style="display:flex;gap:4px">
          <button class="prop-btn crt-img-pick" data-idx="${i}" style="width:auto;padding:0 8px">${c.img ? '그림 바꾸기' : '그림 넣기'}</button>
          ${c.img ? `<button class="prop-btn crt-img-clear" data-idx="${i}" style="width:auto;padding:0 8px" title="그림 빼기(빈 칸으로)">빼기</button>` : ''}
        </span></div>
      ${withCallouts ? `
      <div class="prop-row"><span class="prop-label">제목</span><input type="text" class="prop-input crt-title" data-idx="${i}" value="${escHtml(c.title)}" style="flex:1;min-width:0"></div>
      <div class="prop-row"><span class="prop-label">설명</span><input type="text" class="prop-input crt-desc" data-idx="${i}" value="${escHtml(c.desc)}" style="flex:1;min-width:0"></div>
      <div class="prop-row"><span class="prop-label">상태</span><select class="prop-select crt-status" data-idx="${i}" title="출원·진행 중인 것을 «인증»으로 보이지 않게">
        ${CERT_STATUSES.map((s) => `<option value="${s}"${s === c.status ? ' selected' : ''}>${s || '표시 안 함'}</option>`).join('')}</select></div>` : ''}
    </div>`;
}

export function showCertProperties(block) {
  if (!block) return;
  const st = readCertState(block);
  const withCallouts = st.callouts === 'on';
  propPanel.innerHTML = `
    <div class="prop-section">
${blockHeaderHTML({ icon: _ICON, name: block.dataset.layerName, defaultName: 'A4 Stack', crumb: window.getBlockBreadcrumb ? window.getBlockBreadcrumb(block) : '', id: block.id })}
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Stack</div>
      <div class="prop-row"><span class="prop-label">배치</span><select class="prop-select" id="crt-preset">
        ${CERT_PRESET_NAMES.map((k) => `<option value="${k}"${k === st.preset ? ' selected' : ''}>${PRESET_LABEL[k] || k}</option>`).join('')}</select></div>
      ${sliderRowHTML('흩뿌림', 'crt-jitter-slider', 'crt-jitter-number', { min: 0, max: 100, step: 5, value: Math.round(st.jitter * 100) })}
      <div class="prop-row"><button class="prop-btn" id="crt-reshuffle" style="width:100%" title="흩뿌림이 0 보다 클 때 다른 배치로">다시 섞기</button></div>
      ${sliderRowHTML('용지 크기', 'crt-sheetw-slider', 'crt-sheetw-number', { min: 20, max: 45, step: 1, value: Math.round(st.sheetW * 100) })}
      ${sliderRowHTML('장 수', 'crt-count-slider', 'crt-count-number', { min: 1, max: CERT_MAX_SHEETS, step: 1, value: st.certs.length })}
      <div class="prop-hint" style="padding:2px 8px">용지 칸에 그림 파일을 끌어다 놓거나 더블클릭하세요(내 파일만).</div>
      ${st.certs.map((c, i) => _slotCardHTML(c, i, withCallouts)).join('')}
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Options</div>
      ${_toggleRow('crt-curl', '종이 끝 말림', st.curl === 'on', '오른쪽 아래 모서리를 살짝 말아 올린 꼴')}
      ${_toggleRow('crt-callouts', '지시선 글', withCallouts, '용지마다 세로 지시선 + 제목·설명(+상태 칩)')}
      ${_textRow('crt-headline', '위 제목', st.headline, true)}
      ${_textRow('crt-sub', '위 부제', st.sub, true)}
      ${withCallouts ? sliderRowHTML('제목 크기', 'crt-titlesize-slider', 'crt-titlesize-number', { min: 10, max: 48, step: 1, value: st.titleSize })
        + sliderRowHTML('설명 크기', 'crt-descsize-slider', 'crt-descsize-number', { min: 9, max: 32, step: 1, value: st.descSize })
        + _colorRow('crt-title', '제목색', st.titleColor) + _colorRow('crt-desc', '설명색', st.descColor) + _colorRow('crt-line', '지시선색', st.lineColor) : ''}
      ${(st.headline || st.sub) ? sliderRowHTML('위 제목 크기', 'crt-headsize-slider', 'crt-headsize-number', { min: 16, max: 80, step: 1, value: st.headSize }) + _colorRow('crt-head', '위 제목색', st.headColor) : ''}
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);
  const rerender = () => window.renderCertBlock?.(block);
  const commit = () => { window.pushHistory?.(); window.scheduleAutoSave?.(); };
  const reopen = () => showCertProperties(block);
  const $ = (id) => document.getElementById(id);

  $('crt-preset')?.addEventListener('change', (e) => { block.dataset.preset = e.target.value; rerender(); commit(); });
  $('crt-reshuffle')?.addEventListener('click', () => {
    block.dataset.seed = String((parseInt(block.dataset.seed, 10) || 1) + 1);
    if (!(parseFloat(block.dataset.jitter) > 0)) block.dataset.jitter = '0.5';   // 0 이면 섞어도 같은 그림 — 섞기를 누르면 흔들림을 켠다
    rerender(); commit(); reopen();
  });
  for (const [id, key] of [['crt-curl', 'curl'], ['crt-callouts', 'callouts']]) {
    $(id)?.addEventListener('change', (e) => { block.dataset[key] = e.target.checked ? 'on' : 'off'; rerender(); commit(); reopen(); });
  }
  for (const [id, key] of [['crt-headline', 'headline'], ['crt-sub', 'sub']]) {
    const el = $(id); if (!el) continue;
    el.addEventListener('input', () => { block.dataset[key] = el.value; rerender(); });
    el.addEventListener('change', () => { commit(); reopen(); });
  }
  const wireNum = (id, key, min, max, { scale = 1 } = {}) => {
    const s = $(`${id}-slider`), n = $(`${id}-number`);
    if (!s || !n) return;
    const apply = (v) => { const x = Math.min(max, Math.max(min, Number.isFinite(v) ? v : min)); block.dataset[key] = String(x * scale); rerender(); s.value = x; n.value = x; };
    s.addEventListener('input', () => apply(parseFloat(s.value)));
    s.addEventListener('change', commit);
    n.addEventListener('change', () => { apply(parseFloat(n.value)); commit(); });
  };
  wireNum('crt-jitter', 'jitter', 0, 100, { scale: 0.01 });
  wireNum('crt-sheetw', 'sheetW', 20, 45, { scale: 0.01 });
  wireNum('crt-headsize', 'headSize', 16, 80);
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
    grdPickImageFile((src) => { if (setCertSlotImage(block, i, src)) reopen(); });
  }));
  propPanel.querySelectorAll('.crt-img-clear').forEach((el) => el.addEventListener('click', () => patchCert(+el.dataset.idx, { img: '' }, { record: true, reopenAfter: true })));
  for (const [prefix, key] of [['crt-head', 'headColor'], ['crt-title', 'titleColor'], ['crt-desc', 'descColor'], ['crt-line', 'lineColor']]) {
    if (!$(`${prefix}-color`)) continue;
    wireColorField(prefix, { onApply: (c) => { block.dataset[key] = c; rerender(); }, onCommit: commit });
  }
}

window.showCertProperties = showCertProperties;
