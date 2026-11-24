import { propPanel } from '../globals.js';
import { appearanceSectionHTML, appearanceHeadToolsHTML, wireAppearanceSection } from './_appearance-section.js';   // 표준 Appearance(A2)
import { CVB_H_MIN, CVB_H_MAX } from '../blocks/card-limits.js';   // #cvb-h min/max = updateCanvasBlock 의 자
import { blockHeaderHTML, escHtml } from './_helpers.js';
import { renderPanel, sec } from './_panel-frame.js';
import { wireHexText, parseHex6OrTransparent, formatHex6OrTransparent } from './color-picker.js';
import { fillSectionHTML, fillHeadToolsHTML, wireFillSection, fillLast } from './_fill-section.js';   /* 색 코드 칸 배선은 «한 자리»(유닛 colorhex) */

import { layoutSizeRowHTML, layoutPadSlotHTML, layoutGapSlotHTML, layoutSlotNumberHTML, wireLayoutSection, ratioLockOn, setRatioLock } from './_layout-section.js';   // 표준 Layout(C2)

export function showCanvasProperties(block) {
  if (block.dataset.cardMode === 'simple') {
    window.showSimpleCardProperties(block);
    return;
  }

  // ── 기존 레이어 모드 (Figma import 등 free-placement) ─────────────────────
  const w      = parseInt(block.dataset.canvasW)  || 360;
  const h      = parseInt(block.dataset.canvasH)  || 400;
  const bg     = block.dataset.bg     || 'transparent';
  const radius = parseInt(block.dataset.radius)   || 0;
  const layers = JSON.parse(block.dataset.layers  || '[]');
  const imgRatio = parseInt(block.dataset.imgRatio) || 76;

  const layerRows = layers.map((layer, i) => {
    if (layer.type === 'shape') {
      return `
        <div class="cvb-layer-row" data-index="${i}">
          <span class="cvb-layer-icon">▬</span>
          <span class="cvb-layer-name">${escHtml(layer.label || 'Shape')}</span>
          <div class="prop-color-swatch cvb-layer-swatch" style="background:${layer.color || '#ccc'}">
            <input type="color" class="cvb-color-pick" data-index="${i}" value="${layer.color || '#cccccc'}">
          </div>
        </div>`;
    } else if (layer.type === 'image') {
      const hasSrc = !!layer.src;
      return `
        <div class="cvb-layer-row" data-index="${i}">
          <span class="cvb-layer-icon">🖼</span>
          <span class="cvb-layer-name">${escHtml(layer.label || 'Image')}</span>
          <button class="cvb-img-upload-btn prop-btn" data-index="${i}" title="이미지 업로드">
            ${hasSrc ? '교체' : '추가'}
          </button>
          ${hasSrc ? `<button class="cvb-img-clear-btn prop-btn prop-btn-danger" data-index="${i}" title="이미지 제거">✕</button>` : ''}
        </div>`;
    } else if (layer.type === 'text') {
      return `
        <div class="cvb-layer-row" data-index="${i}">
          <span class="cvb-layer-icon">T</span>
          <span class="cvb-layer-name">${escHtml((layer.content || '').slice(0, 12).replace(/\n/g, '↵') || 'Text')}</span>
          <div class="prop-color-swatch cvb-layer-swatch" style="background:${layer.color || '#000'}">
            <input type="color" class="cvb-color-pick" data-index="${i}" value="${layer.color || '#000000'}">
          </div>
          <span class="cvb-layer-tag">${layer.fontSize || 16}px</span>
        </div>`;
    }
    return '';
  }).join('');

  /* ★U3(right-panel-unify) — 절은 틀(_panel-frame.js)에 등록. Layers = Content(개수는 줄 라벨) · 회전 = Position · 반경 = Appearance(Q2) ·
     옛 Card Spacing 은 Gap → Layout · 좌우 패딩 → Padding. */
  renderPanel(block, {
    header: blockHeaderHTML({
      icon: `          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <rect x="1" y="1" width="10" height="10" rx="2"/>
            <rect x="3" y="3" width="3" height="6" rx="0.5" fill="#888" stroke="none"/>
            <rect x="7" y="3" width="2" height="3" rx="0.5" fill="#888" stroke="none"/>
          </svg>`,
      name: block.dataset.layerName,
      defaultName: 'Canvas Block',
      crumb: window.getBlockBreadcrumb?.(block) || '',
      id: block.id,
    }),
    sections: [
      /* 레이어 0개면 절을 안 낸다 — 보이는 컨트롤 0 인 머리만 남는다(게이트 G9 빈 머리 절) */
      sec('content', layers.length === 0 ? '' : `
      <span class="prop-field-label">Layers ${layers.length}</span>
      <div id="cvb-layer-list">${layerRows || '<div style="color:var(--ui-text-muted);font-size:11px;padding:6px 0">레이어 없음</div>'}</div>
`),
      sec('position', `
      <div class="prop-row">
        <span class="prop-label">회전°</span>
        <input type="range" class="prop-slider" id="cvb-rot-slider" min="-180" max="180" step="1" value="${parseInt(block.dataset.rotation || '0')}">
        <input type="number" class="prop-number" id="cvb-rot-number" min="-180" max="180" value="${parseInt(block.dataset.rotation || '0')}">
      </div>
`),
      /* ★표준 Layout(C2) — W/H = 부품 한 줄(+비율 사슬 기본 끔) · 옛 슬라이더 cvb-img-ratio/gap/padx 걷음 → 블럭 슬롯·간격·패딩(좌우만) · 숫자 칸 id·범위·저장 키 무변 */
      sec('size', `${layoutSizeRowHTML({ prefix: 'cvb', chain: { on: ratioLockOn(block, false) },
        w: { id: 'cvb-w', min: 100, max: 1200, value: w },
        h: { id: 'cvb-h', min: CVB_H_MIN, max: CVB_H_MAX, value: h } })}
      ${layoutSlotNumberHTML({ id: 'cvb-img-ratio-number', label: '사진 영역', value: imgRatio, min: 0, max: 100 })}`),
      sec('layout', `
      ${layoutGapSlotHTML({ id: 'cvb-gap-number', value: parseInt(block.dataset.cardGap ?? 12), max: 48 })}
      <span class="prop-field-label">Insert Grid</span>
      <div class="grid-picker" id="cvb-grid-picker"></div>
      <div class="grid-picker-label" id="cvb-grid-picker-label">—</div>
`),
      sec('padding', layoutPadSlotHTML({ xId: 'cvb-padx-number', x: parseInt(block.dataset.padX ?? 0), max: 80 })),
      sec('appearance', `
      ${appearanceSectionHTML({ prefix: 'cvb', op: { value: window.readBlockOpacity?.(block) ?? 100 }, radius: { numberId: 'cvb-radius-number', value: radius, max: 60 } })}   <!-- ★표준 Appearance A2(현빈 261124 · 시안 #mkp-appstd) — 옛 슬라이더 걷음 · 숫자 칸 id·dataset.radius·범위 무변 -->
`, { headTools: appearanceHeadToolsHTML({ prefix: 'cvb' }) }),
      sec('fill', fillSectionHTML({ prefix: 'cvb-fill', on: bg !== 'transparent', colorHtml: `<div class="prop-color-field">
        <div class="prop-color-swatch" style="background:${bg === 'transparent' ? '#fff' : bg}">
          <input type="color" id="cvb-bg-pick" value="${bg === 'transparent' ? '#ffffff' : bg}">
        </div>
        <input type="text" class="prop-color-hex" id="cvb-bg-hex" value="${formatHex6OrTransparent(bg)}" maxlength="11" aria-label="Color">
      </div>` }), { headTools: fillHeadToolsHTML({ prefix: 'cvb-fill', on: bg !== 'transparent' }) }),   // 표준 Fill F2-2 — 옛 칸(cvb-bg-pick·hex · % 없음 = 옛 그대로) · 없음 = 'transparent'(옛 기본값 = 새 카드는 «칠 없음»)
    ],
  });

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);

  // ── 그리드 피커 (4×4 매트릭스) ────────────────────────────────────────────
  const picker      = document.getElementById('cvb-grid-picker');
  const pickerLabel = document.getElementById('cvb-grid-picker-label');
  const MAX = 4;
  for (let r = 1; r <= MAX; r++) {
    for (let c = 1; c <= MAX; c++) {
      const cell = document.createElement('div');
      cell.className = 'grid-picker-cell';
      cell.dataset.r = r; cell.dataset.c = c;
      picker.appendChild(cell);
    }
  }
  const highlightCells = (maxR, maxC) => {
    picker.querySelectorAll('.grid-picker-cell').forEach(cl => {
      cl.classList.toggle('active', parseInt(cl.dataset.r) <= maxR && parseInt(cl.dataset.c) <= maxC);
    });
  };
  picker.addEventListener('mouseover', e => {
    const cell = e.target.closest('.grid-picker-cell');
    if (!cell) return;
    const r = parseInt(cell.dataset.r), c = parseInt(cell.dataset.c);
    highlightCells(r, c);
    pickerLabel.textContent = `${c} × ${r}`;
  });
  picker.addEventListener('mouseleave', () => {
    picker.querySelectorAll('.grid-picker-cell').forEach(cl => cl.classList.remove('active'));
    pickerLabel.textContent = '—';
  });
  picker.addEventListener('click', e => {
    const cell = e.target.closest('.grid-picker-cell');
    if (!cell) return;
    const cols = parseInt(cell.dataset.c);
    const rows = parseInt(cell.dataset.r);
    insertCanvasGrid(block, cols, rows);
  });

  // ── 크기 ──────────────────────────────────────────────────────────────────
  /* ★표준 Layout(C2) — 칸 배선은 부품(input = 범위 안이면 바로 · change = 잘라 그린 «뒤» 이력 한 번 · 빈 칸 = 옛 값 · 라벨 끌기 · 사슬) · 저장 키 canvasW/H·범위(updateCanvasBlock 과 같은 자) 무변 */
  const cvbCommit = () => window.pushHistory?.();
  const cvbSet = (key) => (v) => { block.dataset[key] = v; window.renderCanvas(block); };
  wireLayoutSection({ commit: cvbCommit,
    w: { numberId: 'cvb-w', min: 100, max: 1200, apply: cvbSet('canvasW'), read: () => parseInt(block.dataset.canvasW) || 360 },
    h: { numberId: 'cvb-h', min: CVB_H_MIN, max: CVB_H_MAX, apply: cvbSet('canvasH'), read: () => parseInt(block.dataset.canvasH) || 400 },
    chain: { id: 'cvb-ratio', on: ratioLockOn(block, false), set: (on) => setRatioLock(block, on, false) } });

  // ── 사진 영역 비율 (cardMode=simple 카드의 img:text 비율) ──
  wireLayoutSection({ commit: cvbCommit, w: { numberId: 'cvb-img-ratio-number', min: 0, max: 100, apply: cvbSet('imgRatio') } });

  // ── 회전 — 공유 헬퍼(applyRotationDeg, dataset.rotation)로 핫존과 동기 ──
  const cRotS = document.getElementById('cvb-rot-slider');
  const cRotN = document.getElementById('cvb-rot-number');
  if (cRotS && cRotN) {
    const _cvbRot = v => {
      v = Math.min(180, Math.max(-180, parseInt(v) || 0));
      window.applyRotationDeg?.(block, v);
      cRotS.value = v; cRotN.value = v;
    };
    cRotS.addEventListener('input',  () => _cvbRot(cRotS.value));
    cRotN.addEventListener('input',  () => _cvbRot(cRotN.value));
    cRotS.addEventListener('change', () => window.pushHistory?.());
    cRotN.addEventListener('change', () => window.pushHistory?.());
  }

  // ── 배경 ──────────────────────────────────────────────────────────────────
  const bgPick = document.getElementById('cvb-bg-pick');
  const bgHex  = document.getElementById('cvb-bg-hex');
  const bgSwatch = bgPick?.closest('.prop-color-swatch');   // 표준 Fill F2-2 — 칠 없음이면 색 칸이 없다(머리 ＋ 만)
  const applyBg = (v, { keepHexText = false } = {}) => {
    block.dataset.bg = v;
    window.renderCanvas(block);
    bgPick.value = (v === 'transparent' ? '#ffffff' : v);
    if (!keepHexText) bgHex.value = formatHex6OrTransparent(v);
    if (bgSwatch) bgSwatch.style.background = (v === 'transparent' ? '#fff' : v);
  };
  bgPick?.addEventListener('input',  () => applyBg(bgPick.value));
  bgPick?.addEventListener('change', () => window.pushHistory?.());
  /* 표준 Fill F2-2 — − = 'transparent'(옛 hex 칸에 transparent 쓰던 길과 같은 값) · ＋ = 지난 색 · 없으면 #FFFFFF */
  wireFillSection({ prefix: 'cvb-fill', adapter: {
    none: () => { fillLast.set(block.id, bg); block.dataset.bg = 'transparent'; window.renderCanvas(block); window.scheduleAutoSave?.(); showCanvasProperties(block); },
    add: () => { block.dataset.bg = fillLast.get(block.id, '#ffffff'); window.renderCanvas(block); window.scheduleAutoSave?.(); showCanvasProperties(block); },
    commit: () => window.pushHistory?.() } });
  /* 배경색 hex — 배선은 color-picker.js 의 wireHexText 한 자리(2026-09-21 픽스 라운드).
     ★손사본이던 때는 `change` «하나뿐»이었다 — 타이핑 중 미리보기도, blur 복원도, 무효 표시도 없었다.
       표기도 이 칸만 `#00FF00`(maxlength 20)이라 옆 칸들(`00FF00`)과 규칙이 달랐다 —
       「자리마다 # 규칙이 다르다」는 신고 원문 그대로. 이제 심플카드 배경칸과 «같은 문법»이다
       (6자리 hex 또는 `transparent`, 표기는 # 없는 대문자). */
  if (bgHex) wireHexText(bgHex, {
    parse: parseHex6OrTransparent,
    format: formatHex6OrTransparent,
    getCurrent: () => block.dataset.bg || bgPick.value || '#ffffff',
    onApply: (v) => applyBg(v, { keepHexText: true }),   // 타이핑 중인 글자를 덮어쓰지 않는다
    onCommit: () => window.pushHistory?.(),
  });

  // ── 반경 ──────────────────────────────────────────────────────────────────
  wireAppearanceSection({ op: { numberId: 'cvb-opacity', apply: (v) => window.setBlockOpacity?.(block, v) }, radius: { numberId: 'cvb-radius-number', max: 60, apply: (v) => { block.dataset.radius = v; window.renderCanvas(block); } } });   // 표준 Appearance A2(슬라이더 걷음)

  // ── 카드 간격 ─────────────────────────────────────────────────────────────
  wireLayoutSection({ commit: cvbCommit, w: { numberId: 'cvb-gap-number', max: 48, apply: cvbSet('cardGap') } });

  // ── 좌우 패딩 ─────────────────────────────────────────────────────────────
  wireLayoutSection({ commit: cvbCommit, w: { numberId: 'cvb-padx-number', max: 80, apply: cvbSet('padX') } });

  // ── 이미지 업로드 / 제거 ──────────────────────────────────────────────────
  document.getElementById('cvb-layer-list')?.addEventListener('click', e => {
    const uploadBtn = e.target.closest('.cvb-img-upload-btn');
    const clearBtn  = e.target.closest('.cvb-img-clear-btn');

    if (uploadBtn) {
      const idx = parseInt(uploadBtn.dataset.index);
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = () => {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async ev => {
          const src = await window.grdAssetSrcFor(block, ev.target.result); if (!src) return; /* BIG-IMAGE-INSERT-RENDERER-OOM-01 — data URL 이면 표본마다 그림이 실린다. 칸 입구와 같은 몸통 · 저장 실패면 data URL. */
          const curLayers = JSON.parse(block.dataset.layers || '[]');
          if (curLayers[idx]) {
            curLayers[idx].src = src;
            block.dataset.layers = JSON.stringify(curLayers);
            window.renderCanvas(block);
            window.pushHistory?.();
            window.scheduleAutoSave?.();
            window.showCanvasProperties?.(block);
          }
        };
        reader.readAsDataURL(file);
      };
      input.click();
    }

    if (clearBtn) {
      const idx = parseInt(clearBtn.dataset.index);
      const curLayers = JSON.parse(block.dataset.layers || '[]');
      if (curLayers[idx]) {
        delete curLayers[idx].src;
        block.dataset.layers = JSON.stringify(curLayers);
        window.renderCanvas(block);
        window.pushHistory?.();
        window.scheduleAutoSave?.();
        window.showCanvasProperties?.(block);
      }
    }
  });

  // ── 레이어 색상 편집 ───────────────────────────────────────────────────────
  document.getElementById('cvb-layer-list')?.addEventListener('input', e => {
    const pick = e.target.closest('.cvb-color-pick');
    if (!pick) return;
    const idx = parseInt(pick.dataset.index);
    const curLayers = JSON.parse(block.dataset.layers || '[]');
    if (curLayers[idx]) {
      curLayers[idx].color = pick.value;
      const swatch = pick.closest('.cvb-layer-swatch');
      if (swatch) swatch.style.background = pick.value;
      block.dataset.layers = JSON.stringify(curLayers);
      window.renderCanvas(block);
    }
  });
  document.getElementById('cvb-layer-list')?.addEventListener('change', e => {
    if (e.target.closest('.cvb-color-pick')) window.pushHistory?.();
  });
}

// ── Simple Card Properties ────────────────────────────────────────────────────

window.showCanvasProperties = showCanvasProperties;

function insertCanvasGrid(block, cols, rows) {
  // Simple card mode: cards 배열 크기도 함께 조정
  if (block.dataset.cardMode === 'simple') {
    const total    = cols * rows;
    const curCards = JSON.parse(block.dataset.cards || '[]');
    while (curCards.length < total) curCards.push({ title: '카드 제목', desc: '', imgSrc: '', cellBg: '' });
    while (curCards.length > total) curCards.pop();
    block.dataset.cards = JSON.stringify(curCards);
  }
  block.dataset.gridCols = cols;
  block.dataset.gridRows = rows;
  window.renderCanvas(block);
  window.pushHistory?.();
  window.scheduleAutoSave?.();
}
window.insertCanvasGrid = insertCanvasGrid;   // ★1017t1d3 — canvas-block.js 의 열·행 성장 ＋(_cvbGridAddAtEnd)가
  // 이 뮤테이션을 «재사용»한다(d3 census ③: prop-simple-card.js:562-576 의 중복 사본은 합치지 않는다 — 별건).
  // 블록 모듈 → 패널 모듈 직접 import 는 레이어를 거스른다(이 레포의 기존 다리 — window.showCanvasProperties 등
  // — 와 같은 결로 window 브리지를 썼다).
