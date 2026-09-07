// ── 확대블럭(zoom-block) 프로퍼티 패널 ───────────────────────────────────────
// 헤더는 신규 블록 체크리스트가 요구하는 풀 구조:
//   prop-block-label > prop-block-icon + prop-block-info + prop-block-id
import { propPanel } from '../globals.js';
import { colorFieldHTML, wireColorField, parseAlphaFromColor } from './color-picker.js';

const D = () => (window.ZOOM_DEFAULTS || {});

function _st(block) {
  return window.readZoomState ? window.readZoomState(block) : { ...D() };
}

function _esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* 슬라이더 + 숫자 한 쌍. dataset[key] 에 쓰고 재렌더. */
function _pairRow(id, label, value, min, max, step) {
  return `
    <div class="prop-row">
      <span class="prop-label">${label}</span>
      <input type="range" class="prop-slider" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}">
      <input type="number" class="prop-number" id="${id}-num" min="${min}" max="${max}" step="${step}" value="${value}">
    </div>`;
}

export function showZoomProperties(block) {
  const st = _st(block);
  const pinned = !!(window.readPinnedZoomShortEdge?.(block));
  const fillAlpha = parseAlphaFromColor(st.fill);

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <rect x="1" y="3.5" width="5" height="5" rx="0.6"/>
            <path d="M6 4.6 L11 6 L6 7.4" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">${_esc(block.dataset.layerName || 'Zoom')}</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb?.(block) || ''}</span>
        </div>
        ${block.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="_copyToClipboard('${block.id}')">${block.id}</span>` : ''}
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Shape</div>
      <div class="prop-row">
        <div class="prop-align-group" id="zm-shape-group">
          <button class="prop-align-btn${st.shape === 'rect' ? ' active' : ''}" data-shape="rect" title="사각형 (기본)">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="1.5" y="4.5" width="13" height="7" rx="1"/></svg>
          </button>
          <button class="prop-align-btn${st.shape === 'circle' ? ' active' : ''}" data-shape="circle" title="원">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="5.5"/></svg>
          </button>
          <button class="prop-align-btn${st.shape === 'square' ? ' active' : ''}" data-shape="square" title="정사각형">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2.5" y="2.5" width="11" height="11" rx="1"/></svg>
          </button>
        </div>
      </div>
      ${_pairRow('zm-size', '크기', st.size, 20, 600, 2)}
      ${_pairRow('zm-rot', '회전°', st.rot, -180, 180, 1)}
      <div class="prop-color-row">
        <span class="prop-label">색</span>
        ${colorFieldHTML({ idPrefix: 'zm-fill', hex: st.fill, alpha: fillAlpha })}
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Shadow</div>
      ${_pairRow('zm-angle', '방향°', st.angle, -180, 180, 1)}
      ${_pairRow('zm-length', '길이', st.length, 0, 1200, 1)}
      ${_pairRow('zm-spread', '벌림', st.spread, -400, 800, 1)}
      ${_pairRow('zm-maxop', '최대 농도%', st.maxop, 0, 100, 1)}
      ${_pairRow('zm-curve', '농도 곡선', st.curve, 10, 400, 1)}
      ${_pairRow('zm-narrow', '좁아짐%', st.narrow, 0, 100, 1)}
    </div>

    <div class="prop-section">
      <div class="prop-section-title">짧은 변 (a·b)</div>
      <div class="prop-row">
        <span class="prop-label" style="font-size:10px;color:var(--ui-text-muted);">
          ${pinned ? '수동 — 끌어서 고정됨' : '자동 — 방향·길이를 따라감'}
        </span>
      </div>
      <div class="prop-row">
        <button class="prop-action-btn" id="zm-ab-reset" ${pinned ? '' : 'disabled'}
          style="width:100%;${pinned ? '' : 'opacity:0.4;pointer-events:none;'}">자동으로 되돌리기</button>
      </div>
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);

  const rerender = () => window.renderZoomBlock?.(block);

  // Shape 프리셋 토글
  propPanel.querySelectorAll('#zm-shape-group .prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.shape;
      if (block.dataset.shape === next) return;
      window.pushHistory?.('확대블럭 모양');
      propPanel.querySelectorAll('#zm-shape-group .prop-align-btn')
        .forEach(b => b.classList.toggle('active', b === btn));
      block.dataset.shape = next;
      // ★모양이 바뀌면 실루엣이 통째로 달라진다 — 사람이 끈 a·b 는 «그 모양의» 값이라 뜻이 없다.
      //   자동으로 되돌린다(고정을 남기면 광원과 그림자가 따로 논다).
      window.clearPinnedZoomShortEdge?.(block);
      rerender();
      showZoomProperties(block);
      window.triggerAutoSave?.();
    });
  });

  // 슬라이더 + 숫자 쌍
  const bindPair = (id, key, label, min, max) => {
    const s = propPanel.querySelector('#' + id);
    const n = propPanel.querySelector('#' + id + '-num');
    if (!s || !n) return;
    const apply = v => {
      const val = Math.min(max, Math.max(min, v));
      block.dataset[key] = String(val);
      s.value = val; n.value = val;
      rerender();
    };
    s.addEventListener('input', e => apply(parseFloat(e.target.value)));
    n.addEventListener('input', e => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) apply(v); });
    const commit = () => { window.pushHistory?.(label); window.triggerAutoSave?.(); };
    s.addEventListener('change', commit);
    n.addEventListener('change', commit);
  };
  bindPair('zm-size',   'size',   '확대블럭 크기',      20, 600);
  bindPair('zm-rot',    'rot',    '확대블럭 회전',    -180, 180);
  bindPair('zm-angle',  'angle',  '확대블럭 방향',    -180, 180);
  bindPair('zm-length', 'length', '확대블럭 길이',       0, 1200);
  bindPair('zm-spread', 'spread', '확대블럭 벌림',    -400, 800);
  bindPair('zm-maxop',  'maxop',  '확대블럭 농도',       0, 100);
  bindPair('zm-curve',  'curve',  '확대블럭 농도곡선',  10, 400);
  bindPair('zm-narrow', 'narrow', '확대블럭 좁아짐',     0, 100);

  wireColorField('zm-fill', {
    initialAlpha: fillAlpha,
    onApply: (c) => { block.dataset.fill = c; rerender(); },
    onCommit: () => { window.pushHistory?.('확대블럭 색'); window.triggerAutoSave?.(); },
  });

  propPanel.querySelector('#zm-ab-reset')?.addEventListener('click', () => {
    if (!window.readPinnedZoomShortEdge?.(block)) return;
    window.pushHistory?.('확대블럭 짧은 변 자동');
    window.clearPinnedZoomShortEdge?.(block);
    rerender();
    showZoomProperties(block);
    window.triggerAutoSave?.();
  });
}

window.showZoomProperties = showZoomProperties;
