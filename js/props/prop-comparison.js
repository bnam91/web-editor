// prop-comparison.js — 비교 블록 우측 프로퍼티 패널 (N칼럼: 1:1, 1:1:1 …)
import { propPanel } from '../globals.js';
import { blockHeaderHTML, escHtml } from './_helpers.js';
import { colorFieldHTML, wireColorField } from './color-picker.js';
import { getComparisonCols, getComparisonFeaturedIdx, setComparisonCols, cmpEmptyRow, cmpEmptyRows, CMP_ROW_HINT, CMP_HD_HINT, cmpGetActiveCell, cmpPickRowImage } from '../blocks/comparison-block.js';
import { panelRenderedColor } from './_panel-rendered.js';
import { redactSectionHTML, wireRedactSection, normalizeRedact } from '../effects/image-redact.js';   /* ★1012t1D4 셀 이미지 「블러 (Redact)」 — 에셋과 같은 공용 절(C1) */

/* ★옛 사본은 «닫는 꺾쇠»와 홑따옴표를 안 덮었다 — 이 파일이 쓰는 세 자리에서는 무력한
   글자들이라 새지는 않았지만, 다음 사람이 이 사본을 홑따옴표 속성 자리에 쓰면 그때 뚫린다.
   ⛔사본을 고치는 대신 «지웠다» — 공용 한 벌(_helpers.js escHtml)이 다섯 글자를 다 덮는다. */
const _esc = escHtml;
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
        body = `<input type="text" class="prop-input cmp-row-input" data-col="${idx}" data-idx="${i}" placeholder="${_esc(CMP_ROW_HINT)}" value="${_esc(row && row.text)}" style="flex:1;">`;
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
    /* 묶음 B #18 — 칸 색이 비면 «그려진» 색(렌더: 강조 칸 #fff/#1a1a1a · 나머지 #e9ebef/#9aa0a8). 옛 표시는 늘 #fff/#1a1a1a. */
    const _colEl = block.querySelector(`.cmp-col[data-col-idx="${idx}"]`);
    const bgVal = col.bg || panelRenderedColor(_colEl, 'backgroundColor') || '#ffffff';
    const textVal = col.text || panelRenderedColor(block.querySelector(`.cmp-row[data-col-idx="${idx}"]`), 'color') || '#1a1a1a';
    const bgIsGrad = /gradient/i.test(bgVal);
    /* ★1012t1D1 — 헤더만 색 따로(칼럼별 titleBg/titleColor · 렌더러는 이미 읽는다 comparison-block.js buildCol).
       표시값: 비어 있으면 «보이는» 색 — 헤더 bg 는 투명이라 칼럼 bg 가 비친다(계산값 rgba(0,0,0,0) 을 그대로 쓰면 검정으로 보인다).
       헤더 글자는 .cmp-hd 의 계산값(그려진 값 규약). 단색만 — 그라데이션은 «안 연다»(onGradient 미배선). */
    const _hdEl = block.querySelector(`.cmp-hd[data-col-idx="${idx}"]`);
    const hdBgVal = (typeof col.titleBg === 'string' && col.titleBg) || (bgIsGrad ? '#ffffff' : bgVal);
    const hdTextVal = (typeof col.titleColor === 'string' && col.titleColor) || panelRenderedColor(_hdEl, 'color') || textVal;
    const canDelete = N > 2;
    return `
      <div class="prop-section">
        <div class="prop-section-title" style="display:flex;align-items:center;justify-content:space-between;">
          <span>칼럼 ${idx + 1}${idx === featuredIdx ? ' ★' : ''}</span>
          ${canDelete ? `<button class="prop-btn prop-btn-danger cmp-col-del" data-col="${idx}" title="칼럼 삭제" style="width:24px;">×</button>` : ''}
        </div>
        <textarea class="prop-textarea cmp-col-title" data-col="${idx}" rows="1" placeholder="${_esc(CMP_HD_HINT)}" style="width:100%;box-sizing:border-box;">${_esc(col.title)}</textarea>
        <div class="prop-color-row"><span class="prop-label">헤더 배경</span>${colorFieldHTML({ idPrefix: 'cmp-c' + idx + 'HdBg', hex: hdBgVal })}</div>
        <div class="prop-color-row"><span class="prop-label">헤더 글자</span>${colorFieldHTML({ idPrefix: 'cmp-c' + idx + 'HdText', hex: hdTextVal })}</div>
        <div class="prop-color-row--aux">
          <button class="prop-align-btn prop-align-btn--aux cmp-hd-color-clear" data-col="${idx}" title="헤더 색 초기화 — 칼럼 색을 따른다">초기화</button>
        </div>
        <div class="prop-color-row"><span class="prop-label">배경</span>${colorFieldHTML({ idPrefix: 'cmp-c' + idx + 'Bg', hex: bgIsGrad ? '#ffffff' : bgVal, gradientCss: bgIsGrad ? bgVal : '' })}</div>
        <div class="prop-color-row"><span class="prop-label">텍스트</span>${colorFieldHTML({ idPrefix: 'cmp-c' + idx + 'Text', hex: textVal })}</div>
        <div style="margin-top:6px;">${rowInputs}</div>
        <button class="prop-btn cmp-row-add" data-col="${idx}" style="width:100%;margin-top:6px;">+ 행 추가</button>
      </div>`;
  };

  /* ★1012t1D3 — 캔버스에서 «이미지 칸»을 골랐으면(2번째 클릭 · block-drag.js) 블럭 헤더 «바로 아래»에 「Image」 절.
     이름·첫 줄은 그리드 Image 절 그대로(「Image」 · prop-btn-full 「이미지 교체…/이미지 선택…」).
     ⛔크기 손잡이·폭/높이 칸은 없다(결정 ⑦ — 행 높이는 행 인덱스 단위 «전 칼럼 공통», 칼럼 절의 행 높이 칸이 맡는다).
     ★D4(블러 등)는 이 절 «아래»에 자기 절을 붙인다(prop-asset Image → 그레인 순서). */
  const _act = cmpGetActiveCell(block);
  const _actRow = _act ? cols[_act.colIdx]?.rows?.[_act.rowIdx] : null;
  const imgSection = (_actRow && _actRow.type === 'image') ? (() => {
    const fit = _actRow.imgFit === 'contain' ? 'contain' : 'cover';
    const sc = Math.min(400, Math.max(100, Number(_actRow.imgScale) || 100));
    return `
    <div class="prop-section" id="cmp-img-section">
      <div class="prop-section-title">Image</div>
      <div class="prop-row">
        <button id="cmp-img-pick-btn" class="prop-btn-full">${_actRow.imgSrc ? '이미지 교체…' : '이미지 선택…'}</button>
      </div>
      <div class="prop-align-group" id="cmp-img-fit-group">
        <button class="prop-align-btn${fit === 'cover' ? ' active' : ''}" data-fit="cover">꽉 채우기</button>
        <button class="prop-align-btn${fit === 'contain' ? ' active' : ''}" data-fit="contain">원본 비율</button>
      </div>
      <div class="prop-row"><span class="prop-label">확대(%)</span>
        <input type="range" class="prop-slider" id="cmp-img-scale" min="100" max="400" step="5" value="${sc}">
        <input type="number" class="prop-number" id="cmp-img-scale-num" min="100" max="400" step="5" value="${sc}"></div>
      <div class="prop-row">
        <button id="cmp-img-pos-reset" class="prop-btn-full" title="위치·확대를 처음(가운데 · 100%)으로">위치 초기화</button>
      </div>
    </div>`;
  })() : '';
  /* ★1012t1D4 — 「Image」 절 바로 아래 「블러 (Redact)」(에셋 패널의 그림 → 블러 순서 · 같은 함수 한 벌). 그림이 든 칸에만(에셋 hasImage 와 같은 조건).
     색보정은 에셋·카드처럼 «편집기(더블클릭)에 들어가면» 뜨는 플로팅 패널이다(js/blocks/comparison-img-edit.js) — 우측 패널 자리 0. */
  const redactSection = (imgSection && _actRow.imgSrc)
    ? redactSectionHTML({ idPrefix: 'cmp-cell', value: normalizeRedact(_actRow.redact) }) : '';

  // ★flex:1 은 basis 0 이라 «축소»가 아니라 «균등분배»를 한다 — 칼럼이 «6개 이상»이면 각자 몫이
  //   글자보다 좁아져 「칼럼 N」이 잘린다(comparison-block.js:480 이 상한을 8 로 허용한다).
  //   (240px 패널 기준. 200px 이면 N=5 부터다.)
  //   basis 를 auto(내용 폭)로 두면 넘칠 때 축소 대신 «줄바꿈»이 일어난다(.prop-align-group 이 flex-wrap:wrap).
  //   공용 클래스의 `flex: 1 0 28px` 에서 basis 만 내용에 맞춘 형태 — grow/no-shrink 의도는 그대로다.
  //   실측(240px 패널, .prop-section padding 0 8px 포함): N=2~5 는 전 형태가 동일,
  //   ★N=6·7·8 은 이 형태만 잘림 0. (초판 주석은 «N=7 부터»라 적었는데, 프로브 픽스처가
  //    .prop-section 을 빠뜨려 16px 넓게 재는 바람에 임계값이 한 칸 늦었다 — 독립 QA 가 잡았다.)
  //   N=6 에서는 1줄→2줄이 되어 섹션 높이가 146→174px 로 늘어난다: «잘림 대신 줄바꿈»이라는
  //   의도된 맞바꿈이다(가로 넘침 0).
  const featBtns = cols.map((c, i) =>
    `<button class="prop-align-btn${i === featuredIdx ? ' active' : ''}" data-feat="${i}" style="flex:1 0 auto;">칼럼 ${i + 1}</button>`).join('');

  propPanel.innerHTML = `
    <div class="prop-section">
${blockHeaderHTML({
      name: d.layerName,
      defaultName: 'Comparison',
      crumb: window.getBlockBreadcrumb?.(block) || '',
      id: block.id,
    })}
    </div>${imgSection}${redactSection}
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
    /* ★⒜ 새 칼럼은 ★빈 칸으로 난다(2026-10-08 · 현빈 「캔버스 직접 입력 가능하니 불필요」).
       행 «수»는 그대로 rowCount 를 따른다 — 칼럼 간 행 정렬이 틀어지면 안 된다. */
    c.unshift({ title: '', bg: '#f5f5f7', text: '#666666', rows: cmpEmptyRows(rowCount) });
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
      gradientValue: col.bg,   // T-059 2라운드: featured 아닌 칼럼도 재오픈 시드(전엔 featured 한 칸만 부수효과로 받았다)
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
    // ★1012t1D1 헤더만 — 칼럼 bg/text 는 건드리지 않는다(titleBg/titleColor 만). 단색만(onGradient 없음).
    wireColorField('cmp-c' + idx + 'HdBg', {
      onApply: v => { const c = getCols(); if (c[idx]) { c[idx].titleBg = v; saveCols(c); rerender(); } },
      onCommit: commit
    });
    wireColorField('cmp-c' + idx + 'HdText', {
      onApply: v => { const c = getCols(); if (c[idx]) { c[idx].titleColor = v; saveCols(c); rerender(); } },
      onCommit: commit
    });
  });

  // 헤더 색 초기화 — titleBg/titleColor 둘 다 지움 → 칼럼 bg/text 를 따른다(옛 저장본과 같은 꼴: 키 없음).
  propPanel.querySelectorAll('.cmp-hd-color-clear').forEach(btn =>
    btn.addEventListener('click', () => {
      const c = getCols(); const col = c[+btn.dataset.col]; if (!col) return;
      delete col.titleBg; delete col.titleColor;
      saveCols(c); rerender(); commit(); showComparisonProperties(block);
    }));

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
  // 행 이미지 업로드/교체 — ★1012t1D3: 파일 고르기 한 벌(comparison-block.js cmpPickRowImage)을 부른다(우클릭·더블클릭·Image 절과 같은 함수 · 사본 금지)
  propPanel.querySelectorAll('.cmp-row-img').forEach(btn =>
    btn.addEventListener('click', () => { cmpPickRowImage(block, +btn.dataset.col, +btn.dataset.idx); }));

  /* ★1012t1D3 「Image」 절 배선 — 활성 칸 하나에만 쓴다. push-after(commit) 규약 그대로. */
  if (imgSection) {
    const { colIdx: aci, rowIdx: ari } = _act;
    const withRow = (fn) => { const c = getCols(); const row = c[aci]?.rows?.[ari]; if (!row) return false; fn(row); saveCols(c); rerender(); return true; };
    propPanel.querySelector('#cmp-img-pick-btn')?.addEventListener('click', () => { cmpPickRowImage(block, aci, ari); });
    propPanel.querySelectorAll('#cmp-img-fit-group [data-fit]').forEach(b =>
      b.addEventListener('click', () => {
        if (withRow(row => { row.imgFit = b.dataset.fit === 'contain' ? 'contain' : 'cover'; })) { commit(); showComparisonProperties(block); }
      }));
    const sS = propPanel.querySelector('#cmp-img-scale'), sN = propPanel.querySelector('#cmp-img-scale-num');
    const setSc = v => {
      v = Math.max(100, Math.min(400, parseInt(v) || 100));
      if (sS) sS.value = v; if (sN) sN.value = v;
      withRow(row => { if (v === 100) delete row.imgScale; else row.imgScale = v; });
    };
    sS?.addEventListener('input', () => setSc(sS.value)); sN?.addEventListener('input', () => setSc(sN.value));
    sS?.addEventListener('change', commit); sN?.addEventListener('change', commit);
    propPanel.querySelector('#cmp-img-pos-reset')?.addEventListener('click', () => {
      if (withRow(row => { delete row.imgX; delete row.imgY; delete row.imgScale; })) { commit(); showComparisonProperties(block); }
    });
    /* ★1012t1D4 블러 — input = 그 칸 div 에 라이브로만(applyRedact) · change = 모델(row.redact)에 되쓰고 다시 그림.
       pushHistory 는 공용 배선이 onCommit «뒤»에 부른다(push-after). 칸 div 는 재렌더로 바뀌므로 getHost 가 그때그때 찾는다. */
    if (redactSection) wireRedactSection({
      idPrefix: 'cmp-cell',
      getHost: () => block.querySelector(`.cmp-row.cmp-img[data-col-idx="${aci}"][data-row-idx="${ari}"]`),
      onCommit: (v) => { if (withRow(row => { if (v > 0) row.redact = v; else delete row.redact; })) window.scheduleAutoSave?.(); },
    });
  }
  propPanel.querySelectorAll('.cmp-row-img-clear').forEach(btn =>
    btn.addEventListener('click', () => {
      const c = getCols(); const row = c[+btn.dataset.col]?.rows?.[+btn.dataset.idx]; if (!row) return;
      row.imgSrc = ''; delete row.redact;   // ★D4 그림을 비우면 블러도 끈다(에셋 clearAssetImage · 편집기 ⌫ 와 같다)
      saveCols(c); rerender(); commit(); showComparisonProperties(block);
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
  // 행 추가 (기본 text) — ★⒜ 빈 칸으로 난다(2026-10-08). 꼴은 cmpEmptyRow 한 벌.
  propPanel.querySelectorAll('.cmp-row-add').forEach(btn =>
    btn.addEventListener('click', () => {
      const c = getCols(); const ci = +btn.dataset.col;
      if (c[ci]) { c[ci].rows.push(cmpEmptyRow()); saveCols(c); rerender(); commit(); showComparisonProperties(block); }
    }));

  // 선택 시 활성 칼럼 배경이 그라데이션이면 캔버스 위 그라데이션 라인 표시 (아니면 overlay가 no-op)
  window.showGradientLine?.(block);
  // 0918 canvasgrad: 캔버스 바 ↔ 피커 스탑 양방향 배선 + 재오픈 시드(활성 칼럼 = 오버레이가 그리는 칼럼)
  {
    const _n = (window.getComparisonCols?.(block.dataset) || []).length || 1;
    const _fi = window.getComparisonFeaturedIdx?.(block.dataset, _n) ?? (_n - 1);
    window.bindGradientLinePicker?.(block, document.getElementById('cmp-c' + _fi + 'Bg-color'));
  }
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
