import { propPanel } from '../globals.js';
import { blockHeaderHTML, rotRowHTML, wireRotRow } from './_helpers.js';
import { renderPanel, sec } from './_panel-frame.js';
import { pushHistory } from '../editor.js';
import { colorFieldHTML, wireColorField, parseAlphaFromColor } from './color-picker.js';
import { strokeSectionHTML, wireStrokeSection, STROKE_POP_WHY } from './_stroke-section.js';

/** 아무 css 색 → colorField 가 받는 #rrggbb(알파는 parseAlphaFromColor 가 따로 읽는다) */
function _hex(c) {
  const x = document.createElement('canvas').getContext('2d');
  x.fillStyle = '#000000'; x.fillStyle = String(c || '');
  const v = x.fillStyle;   // '#rrggbb' 또는 'rgba(r, g, b, a)'
  if (v[0] === '#') return v;
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(v);
  return m ? '#' + m.slice(1, 4).map((n) => (+n).toString(16).padStart(2, '0')).join('') : '#000000';
}

export function showVectorProperties(block) {
  const w       = parseInt(block.dataset.w)        || 120;
  const h       = parseInt(block.dataset.h)        || 120;
  const color   = block.dataset.color              || '#000000';
  const colorAlpha = parseAlphaFromColor(color);
  const rotateDeg = parseFloat(block.dataset.rotateDeg) || 0;

  // 펜툴 패스 메타
  let penNodes = null;
  try { penNodes = JSON.parse(block.dataset.penNodes || 'null'); } catch (_) { penNodes = null; }
  const hasPen      = Array.isArray(penNodes) && penNodes.length >= 2;
  const penClosed   = block.dataset.penClosed === '1';
  const strokeWidth = parseFloat(block.dataset.strokeWidth) || 2;
  const penFill     = block.dataset.penFill || 'none';
  const fillOn      = penFill && penFill !== 'none';
  // P2 — 가져온 SVG 의 색 무리(둘 이상이면 무리마다 한 줄 · 패널 열 때 얼린다) · 선(두께·끝모양·점선)
  const groups = hasPen ? [] : (window.vectorPaintGroups?.(block) || []);
  const multi  = groups.length >= 2;
  const stroke = window.vectorStrokeInfo?.(block) || { has: hasPen, width: strokeWidth, cap: 'round', dash: 'solid' };
  const capOpts  = [['butt', '평평'], ['round', '둥글게'], ['square', '네모']];
  const dashOpts = [['solid', '실선'], ['dash', '대시'], ['dot', '점']];
  const optHtml = (list, cur) => list.map(([v, l]) => `<option value="${v}"${v === cur ? ' selected' : ''}>${l}</option>`).join('');

  /* VECTOR-OVERLAY-TOGGLE-01(현빈 261118): 오버레이(플로팅) — 에셋·아이콘 패널과 «같은 함수»(js/overlay-float.js · window 로 받는다 = prop-iconify 꼴). */
  const OF = window.OverlayFloat;
  const floatPosEl = OF?.posElOf(block);
  const floating = floatPosEl?.dataset.overlayBlock === 'true';

  renderPanel(block, {
    header: blockHeaderHTML({
      /* VECTOR-PANEL-ICON-BROKEN-01(현빈 261119): 머리 아이콘 = 레이어 행(js/panels/layer-panel-items.js «vector» 오각형)과 같은 꼴.
         옛 «보석»(오각형 + 안쪽 선 셋)은 16px 로 키우면 위 빗선 둘이 윗변에 붙어 꼭대기가 덩어리로 뭉갰다(렌더 확인). */
      icon: `          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3"><polygon points="6,1 11,5 9,11 3,11 1,5"/></svg>`,
      name: block.dataset.layerName,
      defaultName: 'Vector',
      crumb: window.getBlockBreadcrumb?.(block) || '',
      id: block.id,
    }),
    sections: [
      sec('size', `
      <div class="prop-row">
        <span class="prop-label">W</span>
        <input type="number" class="prop-number" id="vb-w" value="${w}" min="10" max="1200">
        <span class="prop-label" style="margin-left:8px">H</span>
        <input type="number" class="prop-number" id="vb-h" value="${h}" min="10" max="2000">
      </div>`),
      // 옛 「Path」 절 → 패스 편집=Content · 선 두께=Stroke · 닫힌 패스 채움=Fill(색 옆)
      sec('content', hasPen ? `
      <div class="prop-row">
        <button class="prop-btn-full" id="vb-pen-edit">패스 편집</button>
      </div>` : ''),
      sec('fill', (multi ? groups.map((g, k) => `
      <div class="prop-row">
        <span class="prop-label">색 ${k + 1}</span>
        ${colorFieldHTML({ idPrefix: `vb-g${k}`, hex: _hex(g.color), alpha: parseAlphaFromColor(g.color) })}
      </div>`).join('') : hasPen ? '' : `
      <div class="prop-row">
        <span class="prop-label">색</span>
        ${colorFieldHTML({ idPrefix: 'vb', hex: color, alpha: colorAlpha })}
      </div>`) + `${hasPen && penClosed ? `
      <div class="prop-row" style="margin-top:6px;">
        <span class="prop-label">채움</span>
        <label class="prop-toggle" title="닫힌 패스 채움 토글" style="margin-left:auto;">
          <input type="checkbox" id="vb-pen-fill" ${fillOn ? 'checked' : ''}>
          <span class="prop-toggle-track"></span>
        </label>
      </div>` : ''}`),
      /* ★표준 Stroke 2-5(현빈 261124 ⓑ · 8910 #mkp-linestroke) — 선 블럭: ＋/− 없음 · 위치 칸 없음(가운데 고정) · 펜 = 색 줄(옛 Fill «색» 한 칸을 옮김 — 같은 id vb · 한 값 한 손잡이) · 가져온 SVG = 굵기만(색은 Fill = 그림 전체 바꾸기)
         ⫶ 설정 = 끝모양(늘 보임) · 선 꼴(옛 값 solid/dash/dot · 옛 id vb-stroke-dash) · 꼭짓점·점선 길이 = 막힘(렌더 고정 round · 길이 = 굵기 파생) · 옛 id vb-stroke-w-num */
      sec('stroke', stroke.has ? strokeSectionHTML({ prefix: 'vb-stroke', color, alpha: colorAlpha, colorId: 'vb', noColor: !hasPen, noAlign: true, width: stroke.width, minWidth: 0.5, maxWidth: 40, step: 0.5, widthId: 'vb-stroke-w-num',
        pop: { styles: [['solid', '— 실선'], ['dash', '- - 대시'], ['dot', '· · 점']], style: stroke.dash, styleId: 'vb-stroke-dash', live: { cap: true }, look: { cap: ({ butt: 'none', round: 'round', square: 'square' })[stroke.cap] || 'round' },
          capAlways: true, capLabel: '끝모양', why: STROKE_POP_WHY.soon } }) : ''),
      sec('position', `${OF?.floatPositionRowHTML({ prefix: 'vb', posEl: floatPosEl }) || ''}
      <span class="prop-field-label">Rotation</span>${/* Q17 · Q20(시안 v10) — 각도 칸 + 90° · 반전 한 줄(옛 id · 옛 배선 그대로) */
      rotRowHTML({ numberId: 'vb-rotate-deg', value: rotateDeg, min: -360, max: 360, flipH: block.dataset.flipH === '1', flipV: block.dataset.flipV === '1', ids: { r90: 'vb-rotate-90', fh: 'vb-flip-h', fv: 'vb-flip-v' } })}`, { headTools: window.overlayToggleBtnHTML?.({ id: 'vb-float-toggle', active: floating }) || '' }),
    ],
  });

  window.wireFloatToggle?.({ block, buttonId: 'vb-float-toggle', rerender: () => { showVectorProperties(block); window.showHandlesFor?.(block); } });
  window.wireFloatPosition?.({ block, xId: 'vb-x-number', yId: 'vb-y-number' });

  // ── transform 적용 ────────────────────────────────────────────────────────────
  function applyTransform() {
    window.writeRotation(block, parseFloat(block.dataset.rotateDeg) || 0, { key: 'rotateDeg', keepKey: true });   // 회전 쓰기 한 함수(js/block-flip.js writeRotation · rotate → scale 고정 · QA2 ③)
    window.scheduleAutoSave?.();
  }

  // ── 크기 ──────────────────────────────────────────────────────────────────────
  document.getElementById('vb-w')?.addEventListener('change', () => {
    block.dataset.w = parseInt(document.getElementById('vb-w').value) || w;
    window.renderVector(block);
    window.scheduleAutoSave?.();
    pushHistory();
  });
  document.getElementById('vb-h')?.addEventListener('change', () => {
    block.dataset.h = parseInt(document.getElementById('vb-h').value) || h;
    window.renderVector(block);
    window.scheduleAutoSave?.();
    pushHistory();
  });

  // ── 색상 ──────────────────────────────────────────────────────────────────────
  wireColorField('vb', {
    initialAlpha: colorAlpha,
    onApply: (c) => {
      // 펜이 아니면 한 문(setVectorColor)으로 — 단색 비검정 SVG 를 먼저 검정으로 고쳐 적어 «검정 → 고른 색» 그리기에 걸리게 한다
      if (hasPen) block.dataset.color = c; else window.setVectorColor(block, c);
      // 펜 패스: stroke(및 fill ON이면 fill) 색을 penNodes 기반으로 재빌드
      if (hasPen) {
        if (block.dataset.penFill && block.dataset.penFill !== 'none') block.dataset.penFill = c;
        rebuildPenSvg();
      } else {
        window.renderVector(block);
      }
      window.scheduleAutoSave?.();
    },
    onCommit: () => pushHistory(),
  });

  // ── 여러 색(P2) — 무리마다 얼린 슬롯에만 쓴다 ─────────────────────────────────
  if (multi) groups.forEach((g, k) => wireColorField(`vb-g${k}`, {
    initialAlpha: parseAlphaFromColor(g.color),
    onApply: (c) => { window.setVectorGroupColor(block, g.slots, c); window.renderVector(block); window.scheduleAutoSave?.(); },
    onCommit: () => pushHistory(),
  }));

  // ── 펜 패스 ──────────────────────────────────────────────────────────────────
  // penNodes(viewBox 좌표) + 현재 stroke/fill로 SVG 재빌드 → dataset.svg 갱신 → renderVector
  function rebuildPenSvg() {
    // F6: 공용 window.rebuildPenSvg 재사용 (vector-block.js). 폴백 인라인 유지.
    if (window.rebuildPenSvg?.(block)) {
      window.renderVector(block);
      window.scheduleAutoSave?.();
      return;
    }
    let nodes = null;
    try { nodes = JSON.parse(block.dataset.penNodes || 'null'); } catch (_) { return; }
    if (!Array.isArray(nodes) || nodes.length < 2) return;
    const closed = block.dataset.penClosed === '1';
    const sw     = parseFloat(block.dataset.strokeWidth) || 2;
    const fill   = block.dataset.penFill || 'none';
    const w      = parseInt(block.dataset.w) || 120;
    const h      = parseInt(block.dataset.h) || 120;
    const d = window.nodesToSvgPath?.(nodes, closed) || '';
    const stroke = block.dataset.color || '#1a1a1a';
    const fillAttr = (fill && fill !== 'none') ? fill : 'none';
    block.dataset.svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">` +
      `<path d="${d}" fill="${fillAttr}" stroke="${stroke}" stroke-width="${sw}" ` +
      `stroke-linejoin="round" stroke-linecap="round"/></svg>`;
    window.renderVector(block);
    window.scheduleAutoSave?.();
  }

  document.getElementById('vb-pen-edit')?.addEventListener('click', () => {
    window.enterPenEditMode?.(block);
  });
  // F13: 선 두께 슬라이더 ↔ 숫자 동기 (annotation 패널과 동형). input=라이브, change=히스토리 1회.
  /* 표준 Stroke 2-5 — 부품 배선 · 어댑터 = 옛 setVectorStroke 한 문 그대로(굵기·끝모양·선 꼴 · input = 라이브 · change = 이력 한 칸) · 색은 펜일 때만(옛 vb wireColorField 가 그대로 씀 → 여기선 색 배선 안 함) */
  if (document.getElementById('vb-stroke-w-num')) wireStrokeSection({ prefix: 'vb-stroke', widthId: 'vb-stroke-w-num', minWidth: 0.5, maxWidth: 40, step: 0.5, noColor: true,
    adapter: {
      width: (v) => { if (Number.isFinite(v) && v > 0 && window.setVectorStroke?.(block, { width: v })) { window.renderVector(block); window.scheduleAutoSave?.(); } },
      look: (part) => { const p = {}; if (part.style) p.dash = part.style; if (part.cap) p.cap = ({ none: 'butt', round: 'round', square: 'square' })[part.cap]; if (Object.keys(p).length && window.setVectorStroke?.(block, p)) { window.renderVector(block); window.scheduleAutoSave?.(); } },
      commit: () => pushHistory(),
    } });
  // F9: 채움 토글 표준 스위치(checkbox change)
  document.getElementById('vb-pen-fill')?.addEventListener('change', (e) => {
    const on = e.target.checked;
    block.dataset.penFill = on ? (block.dataset.color || '#1a1a1a') : 'none';
    rebuildPenSvg();
    pushHistory();
  });

  // 색상이 바뀌면 fill이 ON인 경우 fill 색도 동기화 — wireColorField onApply 후 rebuild
  // (아래 색상 wiring의 onApply에 penFill 동기화 추가는 별도 — 여기서는 fill=색상 추종)

  // ── 회전 ──────────────────────────────────────────────────────────────────────
  document.getElementById('vb-rotate-deg')?.addEventListener('input', e => {
    block.dataset.rotateDeg = parseFloat(e.target.value) || 0;
    applyTransform();
  });
  // 드래그 커밋(change) 1회 = undo 1액션 (input마다 히스토리 쌓지 않음)
  document.getElementById('vb-rotate-deg')?.addEventListener('change', () => pushHistory());
  document.getElementById('vb-rotate-90')?.addEventListener('click', () => {
    const cur  = parseFloat(block.dataset.rotateDeg) || 0;
    const next = (cur + 90) % 360;
    block.dataset.rotateDeg = next;
    const inp = document.getElementById('vb-rotate-deg');
    if (inp) inp.value = next;
    applyTransform();
    pushHistory();
  });

  // ── 반전 ──────────────────────────────────────────────────────────────────────
  wireRotRow({ numberId: 'vb-rotate-deg', host: () => block, scrubOnly: true });   // 아이콘 끌기만(90°·반전은 옛 배선)
  document.getElementById('vb-flip-h')?.addEventListener('click', () => {
    block.dataset.flipH = block.dataset.flipH === '1' ? '0' : '1';
    document.getElementById('vb-flip-h')?.classList.toggle('active', block.dataset.flipH === '1');
    document.getElementById('vb-flip-h')?.setAttribute('aria-pressed', String(block.dataset.flipH === '1'));   // QA2 — 단추 상태
    applyTransform();
    pushHistory();
  });
  document.getElementById('vb-flip-v')?.addEventListener('click', () => {
    block.dataset.flipV = block.dataset.flipV === '1' ? '0' : '1';
    document.getElementById('vb-flip-v')?.classList.toggle('active', block.dataset.flipV === '1');
    document.getElementById('vb-flip-v')?.setAttribute('aria-pressed', String(block.dataset.flipV === '1'));   // QA2 — 단추 상태
    applyTransform();
    pushHistory();
  });
}

window.showVectorProperties = showVectorProperties;
