// prop-comparison.js — 비교 블록 우측 프로퍼티 패널 (N칼럼: 1:1, 1:1:1 …)
import { propPanel } from '../globals.js';
import { colorFieldHTML, wireColorField } from './color-picker.js';
import { getComparisonCols, getComparisonFeaturedIdx, setComparisonCols, CMP_PLACEHOLDER_TITLE, CMP_PLACEHOLDER_ROW } from '../blocks/comparison-block.js';

const _esc = s => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const _rowHeights = d => { try { const a = JSON.parse(d.rowHeights || 'null'); return Array.isArray(a) ? a : []; } catch { return []; } };

export function showComparisonProperties(block) {
  const d = block.dataset;
  const cols = getComparisonCols(block.dataset);
  const N = cols.length;
  const featuredIdx = getComparisonFeaturedIdx(d, N);

  const rowHeights = _rowHeights(d);
  const colSection = (col, idx) => {
    const rowInputs = (col.rows || []).map((row, i) => {
      const isImg = row && row.type === 'image';
      const rhVal = (rowHeights[i] != null && rowHeights[i] !== 0) ? rowHeights[i] : '';
      // 행별 type 토글 + 높이 (행 높이는 행 인덱스 단위 → 전 칼럼 공통, 첫 칼럼에서만 노출)
      const typeToggle = `
        <button class="prop-align-btn cmp-row-type${!isImg ? ' active' : ''}" data-col="${idx}" data-idx="${i}" data-type="text" style="flex:0 0 auto;font-size:10px;padding:2px 6px;">텍스트</button>
        <button class="prop-align-btn cmp-row-type${isImg ? ' active' : ''}" data-col="${idx}" data-idx="${i}" data-type="image" style="flex:0 0 auto;font-size:10px;padding:2px 6px;">이미지</button>`;
      const heightInput = idx === 0
        ? `<input type="number" class="prop-number cmp-row-h" data-idx="${i}" min="16" max="400" placeholder="${parseInt(d.rowH) || 64}" value="${rhVal}" title="행 높이(비우면 기본)" style="width:52px;">`
        : '';
      let body;
      if (isImg) {
        const fit = row.imgFit === 'contain' ? 'contain' : 'cover';
        body = `
          <div class="prop-row" style="gap:4px;">
            <button class="prop-btn cmp-row-img" data-col="${idx}" data-idx="${i}" style="flex:1;">${row.imgSrc ? '교체' : '+ 이미지'}</button>
            ${row.imgSrc ? `<button class="prop-btn prop-btn-danger cmp-row-img-clear" data-col="${idx}" data-idx="${i}" style="width:24px;">×</button>` : ''}
          </div>
          <div class="prop-row" style="gap:4px;">
            <button class="prop-align-btn cmp-row-fit${fit === 'cover' ? ' active' : ''}" data-col="${idx}" data-idx="${i}" data-fit="cover" style="flex:1;font-size:10px;">꽉 채우기</button>
            <button class="prop-align-btn cmp-row-fit${fit === 'contain' ? ' active' : ''}" data-col="${idx}" data-idx="${i}" data-fit="contain" style="flex:1;font-size:10px;">원본 비율</button>
          </div>`;
      } else {
        body = `<input type="text" class="prop-input cmp-row-input" data-col="${idx}" data-idx="${i}" value="${_esc(row && row.text)}" style="flex:1;">`;
      }
      return `
        <div class="cmp-row-edit" style="margin-bottom:6px;border-bottom:1px solid var(--border-subtle,#2a2a2a);padding-bottom:6px;">
          <div class="prop-row" style="gap:4px;align-items:center;">
            ${typeToggle}${heightInput}
            <button class="prop-btn prop-btn-danger cmp-row-del" data-col="${idx}" data-idx="${i}" style="width:24px;margin-left:auto;">×</button>
          </div>
          <div class="prop-row" style="gap:4px;margin-top:4px;">${body}</div>
        </div>`;
    }).join('');
    const bgVal = col.bg || '#ffffff';
    const bgIsGrad = /gradient/i.test(bgVal);
    const canDelete = N > 2;
    return `
      <div class="prop-section">
        <div class="prop-section-title" style="display:flex;align-items:center;justify-content:space-between;">
          <span>칼럼 ${idx + 1}${idx === featuredIdx ? ' ★' : ''}</span>
          ${canDelete ? `<button class="prop-btn prop-btn-danger cmp-col-del" data-col="${idx}" title="칼럼 삭제" style="width:24px;">×</button>` : ''}
        </div>
        <textarea class="prop-textarea cmp-col-title" data-col="${idx}" rows="1" style="width:100%;box-sizing:border-box;">${_esc(col.title)}</textarea>
        <div class="prop-color-row"><span class="prop-label">배경</span>${colorFieldHTML({ idPrefix: 'cmp-c' + idx + 'Bg', hex: bgIsGrad ? '#ffffff' : bgVal, gradientCss: bgIsGrad ? bgVal : '' })}</div>
        <div class="prop-color-row"><span class="prop-label">텍스트</span>${colorFieldHTML({ idPrefix: 'cmp-c' + idx + 'Text', hex: col.text || '#1a1a1a' })}</div>
        <div style="margin-top:6px;">${rowInputs}</div>
        <button class="prop-btn cmp-row-add" data-col="${idx}" style="width:100%;margin-top:6px;">+ 행 추가</button>
      </div>`;
  };

  const featBtns = cols.map((c, i) =>
    `<button class="prop-align-btn${i === featuredIdx ? ' active' : ''}" data-feat="${i}" style="flex:1;">칼럼 ${i + 1}</button>`).join('');

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-info">
          <span class="prop-block-name">${_esc(d.layerName) || 'Comparison'}</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb?.(block) || ''}</span>
        </div>
        ${block.id ? `<span class="prop-block-id" title="복사" onclick="_copyToClipboard && _copyToClipboard('${block.id}')">${block.id}</span>` : ''}
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">강조 칼럼 (떠보이는 쪽)</div>
      <div class="prop-align-group" id="cmp-feat-group" style="display:flex;gap:4px;flex-wrap:wrap;">${featBtns}</div>
      <button class="prop-btn" id="cmp-col-add" style="width:100%;margin-top:6px;">+ 칼럼 추가</button>
      <div class="prop-row"><span class="prop-label">강조 크기</span>
        <input type="range" class="prop-slider" id="cmp-scale" min="1" max="1.5" step="0.05" value="${parseFloat(d.featScale) || 1.2}">
        <input type="number" class="prop-number" id="cmp-scale-num" min="1" max="1.5" step="0.05" value="${parseFloat(d.featScale) || 1.2}"></div>
      <div class="prop-row"><span class="prop-label">겹침</span>
        <input type="range" class="prop-slider" id="cmp-ovl" min="0" max="80" step="2" value="${parseInt(d.overlap) || 32}">
        <input type="number" class="prop-number" id="cmp-ovl-num" min="0" max="80" value="${parseInt(d.overlap) || 32}"></div>
      <div class="prop-row"><span class="prop-label">반경</span>
        <input type="range" class="prop-slider" id="cmp-rad" min="0" max="40" step="1" value="${parseInt(d.radius) || 20}">
        <input type="number" class="prop-number" id="cmp-rad-num" min="0" max="40" value="${parseInt(d.radius) || 20}"></div>
      <div class="prop-row"><span class="prop-label">좌우 패딩</span>
        <input type="range" class="prop-slider" id="cmp-padx" min="0" max="160" step="2" value="${parseInt(d.padX) || 0}">
        <input type="number" class="prop-number" id="cmp-padx-num" min="0" max="160" value="${parseInt(d.padX) || 0}"></div>
      <div class="prop-row"><span class="prop-label">상하 패딩</span>
        <input type="range" class="prop-slider" id="cmp-pady" min="0" max="80" step="2" value="${parseInt(d.padY) || 0}">
        <input type="number" class="prop-number" id="cmp-pady-num" min="0" max="80" value="${parseInt(d.padY) || 0}"></div>
      <div class="prop-row"><span class="prop-label">제목 크기</span>
        <input type="range" class="prop-slider" id="cmp-tfont" min="12" max="56" step="1" value="${parseInt(d.titleFont) || 26}">
        <input type="number" class="prop-number" id="cmp-tfont-num" min="12" max="56" value="${parseInt(d.titleFont) || 26}"></div>
      <div class="prop-row"><span class="prop-label">내용 크기</span>
        <input type="range" class="prop-slider" id="cmp-rfont" min="10" max="40" step="1" value="${parseInt(d.rowFont) || 18}">
        <input type="number" class="prop-number" id="cmp-rfont-num" min="10" max="40" value="${parseInt(d.rowFont) || 18}"></div>
      <div class="prop-row"><span class="prop-label">행 높이</span>
        <input type="range" class="prop-slider" id="cmp-rowh" min="24" max="140" step="2" value="${parseInt(d.rowH) || 64}">
        <input type="number" class="prop-number" id="cmp-rowh-num" min="24" max="140" value="${parseInt(d.rowH) || 64}"></div>
      <div class="prop-row"><span class="prop-label">행 간격</span>
        <input type="range" class="prop-slider" id="cmp-rowgap" min="0" max="40" step="1" value="${parseInt(d.rowGap) || 8}">
        <input type="number" class="prop-number" id="cmp-rowgap-num" min="0" max="40" value="${parseInt(d.rowGap) || 8}"></div>
    </div>
    ${cols.map((c, i) => colSection(c, i)).join('')}`;

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);
  const rerender = () => window.renderComparison?.(block);
  const commit = () => { window.pushHistory?.(); window.scheduleAutoSave?.(); };
  const getCols = () => getComparisonCols(block.dataset);
  const saveCols = c => setComparisonCols(block, c);

  // 강조 칼럼 선택
  propPanel.querySelectorAll('#cmp-feat-group [data-feat]').forEach(b =>
    b.addEventListener('click', () => { block.dataset.featured = b.dataset.feat; rerender(); commit(); showComparisonProperties(block); }));

  // 칼럼 추가 (왼쪽에 삽입)
  propPanel.querySelector('#cmp-col-add')?.addEventListener('click', () => {
    const c = getCols();
    const prevFeat = getComparisonFeaturedIdx(block.dataset, c.length);
    const rowCount = Math.max(1, ...c.map(x => (x.rows || []).length));
    c.unshift({ title: CMP_PLACEHOLDER_TITLE, bg: '#f5f5f7', text: '#666666', rows: Array.from({ length: rowCount }, () => CMP_PLACEHOLDER_ROW) });
    block.dataset.featured = String(prevFeat + 1); // 왼쪽 삽입 → 기존 강조 칼럼이 한 칸 밀림
    saveCols(c); rerender(); commit(); showComparisonProperties(block);
  });
  // 칼럼 삭제
  propPanel.querySelectorAll('.cmp-col-del').forEach(btn =>
    btn.addEventListener('click', () => {
      const c = getCols(); if (c.length <= 2) return;
      const idx = +btn.dataset.col; c.splice(idx, 1); saveCols(c);
      let fi = getComparisonFeaturedIdx(block.dataset, c.length);
      if (fi >= c.length) fi = c.length - 1;
      block.dataset.featured = String(fi);
      rerender(); commit(); showComparisonProperties(block);
    }));

  const pair = (sl, nm, dk, min, max) => {
    const s = propPanel.querySelector('#' + sl), n = propPanel.querySelector('#' + nm);
    const set = v => { v = Math.max(min, Math.min(max, parseInt(v) || 0)); block.dataset[dk] = v; s.value = v; n.value = v; rerender(); };
    s?.addEventListener('input', () => set(s.value)); n?.addEventListener('input', () => set(n.value));
    s?.addEventListener('change', commit); n?.addEventListener('change', commit);
  };
  // featScale은 소수(1.0~1.5) → 별도 핸들러
  const sScale = propPanel.querySelector('#cmp-scale'), nScale = propPanel.querySelector('#cmp-scale-num');
  const setScale = v => { v = Math.max(1, Math.min(1.5, parseFloat(v) || 1.2)); block.dataset.featScale = v; sScale.value = v; nScale.value = v; rerender(); };
  sScale?.addEventListener('input', () => setScale(sScale.value));
  nScale?.addEventListener('input', () => setScale(nScale.value));
  sScale?.addEventListener('change', commit); nScale?.addEventListener('change', commit);

  pair('cmp-ovl', 'cmp-ovl-num', 'overlap', 0, 80);
  pair('cmp-rad', 'cmp-rad-num', 'radius', 0, 40);
  pair('cmp-padx', 'cmp-padx-num', 'padX', 0, 160);
  pair('cmp-pady', 'cmp-pady-num', 'padY', 0, 80);
  pair('cmp-tfont', 'cmp-tfont-num', 'titleFont', 12, 56);
  pair('cmp-rfont', 'cmp-rfont-num', 'rowFont', 10, 40);
  pair('cmp-rowh', 'cmp-rowh-num', 'rowH', 24, 140);
  pair('cmp-rowgap', 'cmp-rowgap-num', 'rowGap', 0, 40);

  // 칼럼별: 제목 / 배경 / 텍스트
  cols.forEach((col, idx) => {
    const ta = propPanel.querySelector(`.cmp-col-title[data-col="${idx}"]`);
    ta?.addEventListener('input', () => { const c = getCols(); if (c[idx]) { c[idx].title = ta.value; saveCols(c); rerender(); } });
    ta?.addEventListener('change', commit);
    wireColorField('cmp-c' + idx + 'Bg', {
      onApply: v => { const c = getCols(); if (c[idx]) { c[idx].bg = v; saveCols(c); rerender(); } },
      onGradient: (css, isCommit) => {
        const c = getCols(); if (c[idx]) { c[idx].bg = css; saveCols(c); rerender(); if (isCommit) commit(); }
        if (!_applyingExternal) window.showGradientLine?.(block); // 모달 편집 → 캔버스 핸들 각도 재배치
      },
      onCommit: commit
    });
    wireColorField('cmp-c' + idx + 'Text', {
      onApply: v => { const c = getCols(); if (c[idx]) { c[idx].text = v; saveCols(c); rerender(); } },
      onCommit: commit
    });
  });

  // 행 텍스트 편집 (text행만 .text 갱신)
  propPanel.querySelectorAll('.cmp-row-input').forEach(inp => {
    inp.addEventListener('input', () => {
      const c = getCols(); const ci = +inp.dataset.col; const ri = +inp.dataset.idx;
      const row = c[ci]?.rows?.[ri];
      if (row && row.type !== 'image') { row.text = inp.value; saveCols(c); rerender(); }
    });
    inp.addEventListener('change', commit);
  });
  // 행 type 토글 (text ↔ image)
  propPanel.querySelectorAll('.cmp-row-type').forEach(btn =>
    btn.addEventListener('click', () => {
      const c = getCols(); const ci = +btn.dataset.col; const ri = +btn.dataset.idx;
      const row = c[ci]?.rows?.[ri]; if (!row) return;
      const newType = btn.dataset.type;
      if (row.type === newType) return;
      if (newType === 'image') { row.type = 'image'; row.imgSrc = row.imgSrc || ''; row.imgFit = row.imgFit || 'cover'; }
      else { row.type = 'text'; } // imgSrc/imgFit는 보존(다시 이미지로 전환 시 복원)
      saveCols(c); rerender(); commit(); showComparisonProperties(block);
    }));
  // 행 이미지 업로드/교체 (FileReader→dataURL, banner02 패턴)
  propPanel.querySelectorAll('.cmp-row-img').forEach(btn =>
    btn.addEventListener('click', () => {
      const ci = +btn.dataset.col, ri = +btn.dataset.idx;
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
      inp.onchange = () => {
        const f = inp.files?.[0]; if (!f) return;
        const r = new FileReader();
        r.onload = () => {
          const c = getCols(); const row = c[ci]?.rows?.[ri]; if (!row) return;
          row.type = 'image'; row.imgSrc = r.result; row.imgFit = row.imgFit || 'cover';
          saveCols(c); rerender(); commit(); showComparisonProperties(block);
        };
        r.readAsDataURL(f);
      };
      inp.click();
    }));
  propPanel.querySelectorAll('.cmp-row-img-clear').forEach(btn =>
    btn.addEventListener('click', () => {
      const c = getCols(); const row = c[+btn.dataset.col]?.rows?.[+btn.dataset.idx]; if (!row) return;
      row.imgSrc = ''; saveCols(c); rerender(); commit(); showComparisonProperties(block);
    }));
  propPanel.querySelectorAll('.cmp-row-fit').forEach(btn =>
    btn.addEventListener('click', () => {
      const c = getCols(); const row = c[+btn.dataset.col]?.rows?.[+btn.dataset.idx]; if (!row) return;
      row.imgFit = btn.dataset.fit === 'contain' ? 'contain' : 'cover';
      saveCols(c); rerender(); commit(); showComparisonProperties(block);
    }));
  // 행 높이 (행 인덱스 단위 → block.dataset.rowHeights, 전 칼럼 동시)
  propPanel.querySelectorAll('.cmp-row-h').forEach(inp => {
    const apply = () => {
      const ri = +inp.dataset.idx;
      const arr = _rowHeights(block.dataset);
      const raw = inp.value.trim();
      if (raw === '') { arr[ri] = null; }
      else { let v = Math.max(16, Math.min(400, parseInt(raw) || 0)); arr[ri] = v; }
      // trailing null 정리 (최대 인덱스까지만 보존)
      while (arr.length && arr[arr.length - 1] == null) arr.pop();
      block.dataset.rowHeights = JSON.stringify(arr);
      rerender();
    };
    inp.addEventListener('input', apply);
    inp.addEventListener('change', commit);
  });
  // 행 삭제 (해당 칼럼 행 제거 + 첫 칼럼이면 rowHeights에서도 해당 인덱스 제거)
  propPanel.querySelectorAll('.cmp-row-del').forEach(btn =>
    btn.addEventListener('click', () => {
      const c = getCols(); const ci = +btn.dataset.col; const ri = +btn.dataset.idx;
      if (!c[ci]) return;
      c[ci].rows.splice(ri, 1); saveCols(c);
      if (ci === 0) {
        const arr = _rowHeights(block.dataset);
        if (ri < arr.length) { arr.splice(ri, 1); while (arr.length && arr[arr.length - 1] == null) arr.pop(); block.dataset.rowHeights = JSON.stringify(arr); }
      }
      rerender(); commit(); showComparisonProperties(block);
    }));
  // 행 추가 (기본 text)
  propPanel.querySelectorAll('.cmp-row-add').forEach(btn =>
    btn.addEventListener('click', () => {
      const c = getCols(); const ci = +btn.dataset.col;
      if (c[ci]) { c[ci].rows.push({ type: 'text', text: CMP_PLACEHOLDER_ROW }); saveCols(c); rerender(); commit(); showComparisonProperties(block); }
    }));

  // 선택 시 활성 칼럼 배경이 그라데이션이면 캔버스 위 그라데이션 라인 표시 (아니면 overlay가 no-op)
  window.showGradientLine?.(block);
}

// 캔버스에서 그라데이션 라인을 드래그하면(source==='canvas') 활성 칼럼 스와치만 동기화.
// bg 쓰기/재렌더는 overlay→gradient-model.set()이 이미 처리하므로 중복 적용하지 않는다(루프 방지).
let _applyingExternal = false;
document.addEventListener('gradient-line:change', (e) => {
  if (e.detail?.source !== 'canvas') return;
  const block = e.target?.closest?.('.comparison-block');
  if (!block || !e.detail?.css) return;
  _applyingExternal = true;
  const n = (window.getComparisonCols?.(block.dataset) || []).length || 1;
  const fi = window.getComparisonFeaturedIdx?.(block.dataset, n) ?? (n - 1);
  const sw = document.getElementById('cmp-c' + fi + 'Bg-color')?.closest('.prop-color-swatch');
  if (sw) sw.style.background = e.detail.css; // 모달이 열려 있으면 활성 칼럼 스와치 갱신
  _applyingExternal = false;
});

window.showComparisonProperties = showComparisonProperties;
