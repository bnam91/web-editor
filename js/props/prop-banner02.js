// prop-banner02.js — banner02 블록 우측 프로퍼티 패널 (prop-canvas 패턴 미러링)
import { propPanel } from '../globals.js';
import { colorFieldHTML, wireColorField } from './color-picker.js';

// ⑧ 줄 선택 상태 — 배너 안 «어느 줄»을 보고 있는지. 블록별로 기억한다(패널 재생성에도 유지).
//   activeIdx = null 이면 «전체 보기»(옛 동작: 모든 줄을 한꺼번에 펼침).
const _bn2ActiveLine = new WeakMap();
// ⑴⑵ 줄 편집칸 펼침 상태 — 블록별 «펼친 줄 인덱스» 집합. 디스크에 안 남긴다(UI 상태).
const _bn2ExpandedLines = new WeakMap();
function _bn2Expanded(block) {
  if (!_bn2ExpandedLines.has(block)) _bn2ExpandedLines.set(block, new Set());
  return _bn2ExpandedLines.get(block);
}
export function bn2SetActiveLine(block, idx) { _bn2ActiveLine.set(block, idx); }
export function bn2GetActiveLine(block) { return _bn2ActiveLine.has(block) ? _bn2ActiveLine.get(block) : 0; }
if (typeof window !== 'undefined') {
  window.bn2SetActiveLine = bn2SetActiveLine;
  window.bn2GetActiveLine = bn2GetActiveLine;
}

// 캔버스에서 선택된 줄에 아웃라인 — 기존 선택 토큰(--sel-color/--sel-outline-w)만 쓴다.
function _bn2SyncLineMark(block, activeIdx) {
  document.querySelectorAll('.bn2-line-selected').forEach(el => el.classList.remove('bn2-line-selected'));
  if (activeIdx == null) return;
  block.querySelector(`[data-line-idx="${activeIdx}"]`)?.classList.add('bn2-line-selected');
}
if (typeof window !== 'undefined') window._bn2SyncLineMark = _bn2SyncLineMark;

export function showBanner02Properties(block, activeIdxArg) {
  const d = block.dataset;
  const bgIsGrad = /gradient\(/.test(d.bg || '');
  const variants = window.BANNER02_VARIANTS || { frame_8: {}, wide_4x1: {} };
  const variantBtns = Object.keys(variants).map(k =>
    `<button class="prop-align-btn${d.variant === k ? ' active' : ''}" data-variant="${k}" style="flex:1;font-size:11px;">${variants[k].label || k}</button>`
  ).join('');

  // 가변 텍스트 lines
  const lines = window._bn2Lines?.read?.(block) || [];
  const KIND_LABELS = { label: 'Label', title: 'Title', sub: 'Subtitle' };
  const KIND_OPTS = ['label', 'title', 'sub'];
  // 폰트 카탈로그 — prop-text-wireup-font.js의 _FP_STATIC 미러. 시스템 폰트는 미포함(가벼운 select UI)
  const FONT_OPTS = [
    { value: '', label: '기본 (상속)' },
    { value: "'Pretendard', sans-serif",     label: 'Pretendard' },
    { value: "'Noto Sans KR', sans-serif",   label: 'Noto Sans KR' },
    { value: "'Noto Serif KR', serif",       label: 'Noto Serif KR' },
    { value: "'Inter', sans-serif",          label: 'Inter' },
    { value: "'Space Grotesk', sans-serif",  label: 'Space Grotesk' },
    { value: "'Playfair Display', serif",    label: 'Playfair Display' },
    { value: 'sans-serif', label: 'Sans-serif' },
    { value: 'serif',      label: 'Serif' },
    { value: 'monospace',  label: 'Monospace' },
  ];
  const WEIGHT_OPTS = [
    [100, 'Thin 100'], [200, 'ExtraLight 200'], [300, 'Light 300'], [400, 'Regular 400'],
    [500, 'Medium 500'], [600, 'SemiBold 600'], [700, 'Bold 700'], [800, 'ExtraBold 800'], [900, 'Black 900'],
  ];
  const _escAttr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const lineRow = (line, idx) => {
    const curFont = line.fontFamily || '';
    const curWeight = line.fontWeight || 400;
    const fontOptsHtml = FONT_OPTS.map(f =>
      `<option value="${_escAttr(f.value)}"${curFont === f.value ? ' selected' : ''}>${f.label}</option>`
    ).join('');
    // 카탈로그에 없는 사용자 지정 폰트(예: 시스템 설치 폰트)는 별도 option으로 노출
    const customFontOpt = (curFont && !FONT_OPTS.some(f => f.value === curFont))
      ? `<option value="${_escAttr(curFont)}" selected>${_escAttr(curFont.replace(/['"]/g, '').split(',')[0].trim())} (custom)</option>`
      : '';
    const weightOptsHtml = WEIGHT_OPTS.map(([v, lbl]) =>
      `<option value="${v}"${curWeight === v ? ' selected' : ''}>${lbl}</option>`
    ).join('');
    // ★캔버스에서 바로 고칠 수 있으니(더블클릭 편집) 우측 입력칸은 «두 번째 입구»다 → 기본 접힘.
    //   ⚠️단 «빈 줄»은 자동으로 펼친다 — 글자가 없으면 캔버스에서 겨냥하기 어려워
    //     우측이 사실상 유일한 복구 수단이 되는 순간이 있다(⑸의 min-height 와 한 쌍).
    const _isEmpty = !String(line.text || '').trim();
    const _open = _isEmpty || _bn2Expanded(block).has(idx);
    const _preview = _isEmpty ? '(빈 줄)' : String(line.text).replace(/\s+/g, ' ').slice(0, 24);
    return `
    <div class="prop-section" data-line-row="${idx}">
      <!-- ★줄 머리 한 줄에 «역할 · 번호 · 미리보기 · 삭제» 를 모은다.
           ⑴ textarea 는 뺐다 — 캔버스에서 더블클릭으로 «이미» 편집된다(banner02-block.js:149).
              같은 일을 두 곳에서 하면 패널만 길어진다. 「뭐라고 쓰나」는 캔버스, 「어떻게 보이나」는 패널.
           ⑵ 「종류」는 «글자 내용»이 아니라 «줄의 역할»(Label/Title/Subtitle)이고 ★캔버스에 대응 경로가
              없다 — 지우면 한번 만든 줄의 역할을 영영 못 바꾼다. 그래서 남기되, 역할이니 자리는 줄 머리다.
           ⑶ 미리보기도 남긴다 — 줄 3개가 전부 Label 이면 「Label #1」만으론 «구분이 안 된다».
              폭이 모자라면 ellipsis 로 줄인다(min-width:0 이 있어야 flex 안에서 실제로 줄어든다). -->
      <div class="prop-section-title" data-line-toggle="${idx}"
           style="display:flex;align-items:center;gap:6px;cursor:pointer;"
           title="${_open ? '접기' : '펼치기'}">
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1.8"
             style="flex:0 0 auto;transform:rotate(${_open ? 90 : 0}deg);transition:transform .12s;">
          <polyline points="2,2 6,4 2,6"/>
        </svg>
        <select class="prop-select" data-line-kind="${idx}" onclick="event.stopPropagation()"
                style="flex:0 0 auto;width:auto;font-size:11px;padding:1px 4px;">
          ${KIND_OPTS.map(k => `<option value="${k}"${line.kind === k ? ' selected' : ''}>${KIND_LABELS[k] || k}</option>`).join('')}
        </select>
        <span style="flex:0 0 auto;font-size:10px;color:var(--ui-text-muted);">#${idx + 1}</span>
        <span class="prop-hint" style="flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_escAttr(_preview)}</span>
        <button class="prop-btn prop-btn-danger" data-line-remove="${idx}" title="줄 삭제"
                onclick="event.stopPropagation()"
                style="flex:0 0 auto;padding:2px 8px;font-size:11px;${lines.length <= 1 ? 'opacity:0.4;pointer-events:none;' : ''}">×</button>
      </div>
      <div data-line-editor="${idx}" style="display:${_open ? 'block' : 'none'};">
      <div class="prop-section-title">Typography</div>
      <span class="prop-field-label">Font</span>
      <div class="prop-row">
        <span class="prop-label">폰트</span>
        <select class="prop-select" data-line-font="${idx}" style="flex:1;min-width:0;font-size:11px;">
          ${customFontOpt}${fontOptsHtml}
        </select>
      </div>
      <div class="prop-row">
        <span class="prop-label">굵기</span>
        <select class="prop-select" data-line-weight="${idx}" style="flex:1;min-width:0;font-size:11px;">
          ${weightOptsHtml}
        </select>
      </div>
      <div class="prop-row">
        <span class="prop-label">크기</span>
        <input type="range" class="prop-slider" data-line-size="${idx}" min="8" max="120" step="1" value="${Math.min(120, line.size)}">
        <input type="number" class="prop-number" data-line-size-num="${idx}" min="8" max="200" value="${line.size}">
      </div>
      <span class="prop-field-label">Letter Spacing</span>
      <div class="prop-row">
        <span class="prop-label">자간</span>
        <input type="number" class="prop-number" data-line-ls="${idx}" min="-20" max="50" step="0.5" value="${line.letterSpacing || 0}">
      </div>
      <span class="prop-field-label">Line Spacing</span>
      <div class="prop-row">
        <span class="prop-label">여백위</span>
        <input type="number" class="prop-number" data-line-gap="${idx}" min="0" max="400" value="${line.gapTop}">
      </div>

      <div class="prop-section-title">Fill</div>
      <div class="prop-color-row">
        <span class="prop-label">글자색</span>
        ${colorFieldHTML({ idPrefix: 'bn2-line-' + idx + '-col', hex: line.color || '#000000' })}
      </div>
      </div>
    </div>`;
  };
  // ⑧ 어느 줄을 펼칠지 — 인자 > 기억값 > 0번. 줄이 삭제돼 범위를 벗어나면 보정한다.
  let activeIdx = (activeIdxArg !== undefined) ? activeIdxArg : bn2GetActiveLine(block);
  if (activeIdx != null) {
    if (!lines.length) activeIdx = null;
    else if (activeIdx < 0 || activeIdx >= lines.length) activeIdx = lines.length - 1;
  }
  bn2SetActiveLine(block, activeIdx);
  _bn2SyncLineMark(block, activeIdx);

  // 줄 선택 칩 — 기존 정렬 세그먼트(.prop-align-group/.prop-align-btn)를 그대로 쓴다(신규 룩 없음).
  const chipStrip = lines.length ? `
    <div class="prop-section">
      <div class="prop-section-title">Text Lines</div>
      <div class="prop-align-group" id="bn2-line-chips">
        ${(() => {
          // 칩 라벨은 «짧게» — 흔한 3줄(Label/Title/Sub)에서 한 행에 들어가야 한다(4칩이 두 행이면
          // 「덜 복잡해 보이게」라는 목적과 어긋난다). 번호는 «같은 kind 가 둘 이상일 때만» 붙인다
          // — Subtitle 이 6개면 kind 만으론 구분이 안 되지만, 겹치지 않으면 번호는 소음이다.
          const SHORT = { label: 'Label', title: 'Title', sub: 'Sub' };
          const dup = {};
          lines.forEach(l => { dup[l.kind] = (dup[l.kind] || 0) + 1; });
          return lines.map((l, i) => {
            const nm = SHORT[l.kind] || KIND_LABELS[l.kind] || l.kind;
            const lbl = dup[l.kind] > 1 ? `${nm} ${i + 1}` : nm;
            return `<button class="prop-align-btn${activeIdx === i ? ' active' : ''}" data-line-chip="${i}" style="flex:0 1 auto;min-width:0;font-size:11px;padding:2px 8px;white-space:nowrap;" title="${(l.text || '').replace(/"/g, '&quot;').slice(0, 40) || '(빈 줄)'}">${lbl}</button>`;
          }).join('');
        })()}
        <button class="prop-align-btn${activeIdx === null ? ' active' : ''}" data-line-chip="all" style="flex:0 1 auto;min-width:0;font-size:11px;padding:2px 8px;white-space:nowrap;" title="모든 줄을 한꺼번에 펼칩니다">전체</button>
      </div>
    </div>` : '';

  const linesHTML = chipStrip + lines.map((l, i) => (activeIdx === null || activeIdx === i) ? lineRow(l, i) : '').join('') + `
    <div class="prop-section">
      <button class="prop-btn" id="bn2-line-add" style="width:100%;">+ 텍스트 줄 추가</button>
    </div>`;

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-info">
          <span class="prop-block-name">${d.layerName || 'Banner'}</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb?.(block) || ''}</span>
        </div>
        ${block.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="_copyToClipboard && _copyToClipboard('${block.id}')">${block.id}</span>` : ''}
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Variant</div>
      <div class="prop-align-group" id="bn2-variant-group" style="display:flex;gap:4px;">${variantBtns}</div>
    </div>

    <div class="prop-section">
      <!-- ⑺ 좌우 바꾸기는 «이미지 속성»이 아니라 배치 구조다(텍스트 위치도 같이 바뀐다) → Variant 와 같은 층.
           단 Variant 는 «형태 선택»(2택 토글)이고 이건 «지금 형태를 뒤집기»(1회 동작)라 성격이 달라,
           같은 섹션에 넣지 않고 제목 없는 prop-section 으로 층을 나눈다(새 CSS·새 마진 규약 0). -->
      <button class="prop-btn" id="bn2-swap" style="width:100%;">↔ 이미지·텍스트 좌우 바꾸기</button>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Size</div>
      <div class="prop-row">
        <span class="prop-label">W</span>
        <input type="number" class="prop-number" id="bn2-w" value="${parseInt(d.bannerW) || 780}" min="100" max="1600">
        <span class="prop-label" style="margin-left:8px">H</span>
        <input type="number" class="prop-number" id="bn2-h" value="${d.autoHeight === 'false' ? (parseInt(d.bannerH) || 260) : ''}" placeholder="${parseInt(d.bannerH) || 260}" min="40" max="1200" title="비우면 내용에 맞춰 자동">
      </div>
      <div class="prop-row">
        <span class="prop-label">텍스트 X</span>
        <input type="number" class="prop-number" id="bn2-tx" value="${d.textXTuned === '1' ? (parseInt(d.textX) || 0) : ''}" placeholder="${parseInt(d.textX) || 0}" min="0" max="1600" title="비우면 프리셋 기본값">
        <span class="prop-label" style="margin-left:8px">폭</span>
        <input type="number" class="prop-number" id="bn2-tw" value="${d.textWTuned === '1' ? (parseInt(d.textW) || 0) : ''}" placeholder="${parseInt(d.textW) || 0}" min="20" max="1600" title="비우면 프리셋 기본값">
      </div>
      <div class="prop-row">
        <span class="prop-label">텍스트 Y</span>
        <input type="number" class="prop-number" id="bn2-ty" value="${d.textYTuned === '1' ? (parseInt(d.textY) || 0) : ''}" placeholder="${parseInt(d.textY) || 0}" min="0" max="1200" title="비우면 프리셋 기본값">
      </div>
      <div class="prop-row" id="bn2-hint-row" style="display:none">
        <span class="prop-hint" id="bn2-hint"></span>
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Background</div>
      <div class="prop-color-row">
        <span class="prop-label">색/그라데이션</span>
        ${colorFieldHTML({ idPrefix: 'bn2-bg', hex: bgIsGrad ? '#f3f4f6' : (d.bg || '#f3f4f6'), gradientCss: bgIsGrad ? d.bg : '' })}
      </div>
      <div class="prop-row">
        <span class="prop-label">반경</span>
        <input type="range" class="prop-slider" id="bn2-radius" min="0" max="60" step="1" value="${parseInt(d.radius) || 0}">
        <input type="number" class="prop-number" id="bn2-radius-num" min="0" max="60" value="${parseInt(d.radius) || 0}">
      </div>
    </div>

    ${linesHTML}

    <div class="prop-section">
      <div class="prop-section-title">Image</div>
      <div class="prop-row" style="gap:4px;">
        <button class="prop-btn" id="bn2-img-upload" style="flex:1;">${d.imgSrc ? '교체' : '추가'}</button>
        ${d.imgSrc ? '<button class="prop-btn prop-btn-danger" id="bn2-img-clear" style="flex:1;">제거</button>' : ''}
      </div>
      <div class="prop-align-group" id="bn2-fit-group" style="display:flex;gap:4px;margin-top:4px;">
        <button class="prop-align-btn${(d.imgFit || 'cover') === 'cover' ? ' active' : ''}" data-fit="cover" style="flex:1;font-size:11px;">꽉 채우기</button>
        <button class="prop-align-btn${d.imgFit === 'contain' ? ' active' : ''}" data-fit="contain" style="flex:1;font-size:11px;">원본 비율</button>
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Text Align</div>
      <div class="prop-align-group" id="bn2-align-group">
        <button class="prop-align-btn${(d.align || 'left') === 'left' ? ' active' : ''}" data-align="left" title="왼쪽 정렬">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="1" y1="6" x2="9" y2="6"/>
              <line x1="1" y1="9" x2="11" y2="9"/><line x1="1" y1="12" x2="7" y2="12"/>
          </svg>
        </button>
        <button class="prop-align-btn${d.align === 'center' ? ' active' : ''}" data-align="center" title="가운데 정렬">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="3" y1="6" x2="11" y2="6"/>
              <line x1="2" y1="9" x2="12" y2="9"/><line x1="4" y1="12" x2="10" y2="12"/>
          </svg>
        </button>
        <button class="prop-align-btn${d.align === 'right' ? ' active' : ''}" data-align="right" title="오른쪽 정렬">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="5" y1="6" x2="13" y2="6"/>
              <line x1="3" y1="9" x2="13" y2="9"/><line x1="7" y1="12" x2="13" y2="12"/>
          </svg>
        </button>
      </div>
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);
  // ⚠️renderBanner02 는 배너 내부를 새로 그린다 → 선택 줄 아웃라인 마커도 같이 날아간다.
  //   모든 재렌더 경로가 이 헬퍼를 통과하므로 여기서 한 번만 복구한다.
  const rerender = () => { window.renderBanner02?.(block); _bn2SyncLineMark(block, activeIdx); };
  const commit = () => { window.pushHistory?.(); window.scheduleAutoSave?.(); };

  // Variant
  propPanel.querySelectorAll('#bn2-variant-group [data-variant]').forEach(btn => {
    btn.addEventListener('click', () => {
      const v = window.BANNER02_VARIANTS?.[btn.dataset.variant];
      if (!v) return;
      block.dataset.variant = btn.dataset.variant;
      // 기하/크기만 variant로 갱신 (텍스트·이미지 내용 보존)
      // ★사람이 텍스트 박스를 손으로 맞췄으면(textTuned) variant 전환이 그걸 덮지 않는다.
      //   ⑸의 autoHeight 와 같은 규약 — 「사람이 만진 값은 안 덮는다」가 이 패널에서 하나로 유지된다.
      //   되돌리려면 그 입력칸을 «비우면» 된다(빈 값 = 프리셋 복귀).
      const _keep = { textX: block.dataset.textXTuned === '1', textY: block.dataset.textYTuned === '1', textW: block.dataset.textWTuned === '1' };
      ['width:bannerW', 'height:bannerH', 'radius:radius', 'textX:textX', 'textY:textY', 'textW:textW',
       'labelSize:labelSize', 'titleSize:titleSize', 'subSize:subSize', 'gap1:gap1', 'gap2:gap2',
       'imgX:imgX', 'imgY:imgY', 'imgW:imgW', 'imgH:imgH'].forEach(m => {
        const [vk, dk] = m.split(':');
        if (_keep[dk]) return;   // 사람이 «그 칸»을 만졌으면 그 칸만 보존
        if (v[vk] !== undefined) block.dataset[dk] = v[vk];
      });
      rerender(); commit(); showBanner02Properties(block);
    });
  });

  // Size
  const bindNum = (id, dk, render = true) => {
    const el = propPanel.querySelector('#' + id);
    el?.addEventListener('change', () => { block.dataset[dk] = el.value; if (render) rerender(); commit(); refreshHint(); });
  };
  bindNum('bn2-w', 'bannerW');

  /* ★「빈 값 = 자동」 — prop-table 의 «행별 높이»(placeholder="auto" · 비우면 자동복귀)와 같은 관용구.
     값을 넣으면 «사람이 만졌다» 플래그를 세우고, 비우면 플래그를 걷어 프리셋/자동값으로 돌아간다.
     ⇒ 리셋 경로가 새 버튼 없이 생기고, autoHeight 와 textTuned 가 같은 세움/해제 시점을 쓴다. */
  const bindAutoNum = (id, dk, flagKey, flagOnValue, presetKey = null) => {
    const el = propPanel.querySelector('#' + id);
    el?.addEventListener('change', () => {
      const v = parseInt(el.value, 10);
      if (!Number.isFinite(v) || el.value.trim() === '') {
        delete block.dataset[flagKey];          // 자동으로 복귀
        el.value = '';
        // ⚠️bannerH 는 렌더가 «자동 계산»으로 되돌려주지만, textX/Y/W 는 자동 계산이 없다.
        //   플래그만 걷으면 값이 그대로 남아 「비웠는데 안 돌아온다」가 된다 → variant 프리셋 값으로 되돌린다.
        if (presetKey) {
          const pv = window.BANNER02_VARIANTS?.[block.dataset.variant]?.[presetKey];
          if (pv !== undefined) block.dataset[dk] = String(pv);
        }
      } else {
        block.dataset[dk] = String(v);
        block.dataset[flagKey] = flagOnValue;   // 수동 고정
      }
      rerender(); commit(); showBanner02Properties(block);
    });
  };
  bindAutoNum('bn2-h',  'bannerH', 'autoHeight', 'false');
  // ⚠️플래그는 «필드별»이다 — 하나로 묶으면 한 칸을 비웠을 때 옆 칸까지 「자동」으로 표시되는데
  //   값은 안 돌아가서 「비웠는데 안 돌아온다」가 된다(QA BUG-5). 「빈 값=자동」은 칸마다 온전해야 한다.
  bindAutoNum('bn2-tx', 'textX',   'textXTuned', '1', 'textX');
  bindAutoNum('bn2-ty', 'textY',   'textYTuned', '1', 'textY');
  bindAutoNum('bn2-tw', 'textW',   'textWTuned', '1', 'textW');

  /* 조건부 힌트 — 평소 0줄, «문제가 있을 때만» 한 줄. 넘침이 겹침보다 급하므로 넘침 우선.
     (겹침은 풀블리드 이미지 위 글씨처럼 «정상 상태로 계속 참»일 수 있어 항상 떠 있을 수 있다.) */
  function refreshHint() {
    const row = propPanel.querySelector('#bn2-hint-row');
    const out = propPanel.querySelector('#bn2-hint');
    if (!row || !out) return;
    const over = window.bn2OverflowInfo?.(block);
    const tX = parseInt(block.dataset.textX) || 0, tW = parseInt(block.dataset.textW) || 0;
    const iX = parseInt(block.dataset.imgX) || 0;
    const iW = parseInt(block.dataset.imgW) || 0;
    if (over && over.overflow) {
      out.textContent = `내용이 넘칩니다 (${over.need}px 필요)`;
      row.style.display = '';
      if (!row.querySelector('#bn2-fit-h')) {
        const b = document.createElement('button');
        b.className = 'prop-btn'; b.id = 'bn2-fit-h'; b.textContent = '맞추기';
        b.addEventListener('click', () => {
          delete block.dataset.autoHeight;      // 자동으로 되돌리면 렌더가 알아서 키운다
          block.dataset.bannerH = String(over.need);
          rerender(); commit(); showBanner02Properties(block);
        });
        row.appendChild(b);
      }
    } else if (tW && iW && !(tX + tW <= iX || iX + iW <= tX)) {
      // ⚠️imgSrc 유무로 가르지 않는다 — 이미지가 비어도 «슬롯»(체커보드)은 그대로 그려지므로
      //   겹치면 시각적으로 똑같이 틀어진다. 실측에서 이 가드 때문에 경고가 안 떴다.
      // ★«구간» 겹침으로 판정한다 — tX+tW > iX 만 보면 「이미지가 항상 오른쪽」을 가정하는 것이라
      //   swap 으로 좌우가 뒤집힌 뒤엔 «항상 참»이 돼 정상 배치에도 경고가 상주한다(QA BUG-3).
      out.textContent = '텍스트가 이미지와 겹칩니다';
      row.style.display = '';
      row.querySelector('#bn2-fit-h')?.remove();
    } else {
      row.style.display = 'none';
      row.querySelector('#bn2-fit-h')?.remove();
    }
  }
  refreshHint();

  // Background color/gradient
  wireColorField('bn2-bg', {
    onApply: (c) => { block.dataset.bg = c; rerender(); window.scheduleAutoSave?.(); },
    onGradient: (css, c) => {
      block.dataset.bg = css; rerender(); window.scheduleAutoSave?.(); if (c) commit();
      if (!_applyingExternal) window.showGradientLine?.(block); // 모달 편집 → 캔버스 핸들 각도 재배치
    },
    onCommit: commit,
  });

  // Radius (slider+num 동기)
  const rs = propPanel.querySelector('#bn2-radius'), rn = propPanel.querySelector('#bn2-radius-num');
  const setR = v => { v = Math.max(0, Math.min(60, parseInt(v) || 0)); block.dataset.radius = v; rs.value = v; rn.value = v; rerender(); };
  rs?.addEventListener('input', () => setR(rs.value));
  rn?.addEventListener('input', () => setR(rn.value));
  rs?.addEventListener('change', commit); rn?.addEventListener('change', commit);

  // 가변 lines — 각 줄 핸들러 바인딩
  const mutLines = (mutator) => {
    const cur = window._bn2Lines.read(block);
    mutator(cur);
    window._bn2Lines.write(block, cur);
    rerender();
  };
  lines.forEach((line, idx) => {
    const kindSel = propPanel.querySelector(`[data-line-kind="${idx}"]`);
    kindSel?.addEventListener('change', () => {
      mutLines(arr => { if (arr[idx]) arr[idx].kind = kindSel.value; });
      commit();
    });
    /* ★문구 입력칸(textarea)은 걷어냈다 — 캔버스에서 더블클릭으로 «이미» 편집된다
     *   (banner02-block.js:149 contenteditable · :156 백스페이스 줄 삭제).
     *   ⛔배선도 같이 지운다: 마크업만 빼고 리스너를 남기면 «아무 데도 안 닿는 죽은 배선»이 되고,
     *     다음 사람이 「여기서 텍스트를 고칠 수 있나 보다」로 읽는다.
     *   전수 확인: data-line-text 를 쓰는 다른 경로 0건(laurel 의 .lrl-line-text 는 별개 클래스).
     *   ※laurel 도 같은 길을 먼저 갔다 — laurel-block.js:234 「우측 입력으로만 수정은 다른 컴포넌트와 불일치」 */

    const sl = propPanel.querySelector(`[data-line-size="${idx}"]`);
    const sn = propPanel.querySelector(`[data-line-size-num="${idx}"]`);
    const setSize = v => {
      v = Math.max(8, Math.min(200, parseInt(v) || 16));
      mutLines(arr => { if (arr[idx]) arr[idx].size = v; });
      if (sl) sl.value = Math.min(120, v);
      if (sn) sn.value = v;
    };
    sl?.addEventListener('input',  () => setSize(sl.value));
    sn?.addEventListener('input',  () => setSize(sn.value));
    sl?.addEventListener('change', commit); sn?.addEventListener('change', commit);

    const gn = propPanel.querySelector(`[data-line-gap="${idx}"]`);
    gn?.addEventListener('change', () => {
      const v = Math.max(0, Math.min(400, parseInt(gn.value) || 0));
      mutLines(arr => { if (arr[idx]) arr[idx].gapTop = v; });
      commit();
    });

    // 폰트 패밀리
    const fontSel = propPanel.querySelector(`[data-line-font="${idx}"]`);
    fontSel?.addEventListener('change', () => {
      mutLines(arr => { if (arr[idx]) arr[idx].fontFamily = fontSel.value; });
      commit();
    });

    // 굵기
    const wSel = propPanel.querySelector(`[data-line-weight="${idx}"]`);
    wSel?.addEventListener('change', () => {
      const v = Math.max(100, Math.min(900, parseInt(wSel.value) || 400));
      mutLines(arr => { if (arr[idx]) arr[idx].fontWeight = v; });
      commit();
    });

    // 자간
    const lsn = propPanel.querySelector(`[data-line-ls="${idx}"]`);
    lsn?.addEventListener('change', () => {
      const v = Math.max(-20, Math.min(50, parseFloat(lsn.value) || 0));
      mutLines(arr => { if (arr[idx]) arr[idx].letterSpacing = v; });
      commit();
    });

    wireColorField('bn2-line-' + idx + '-col', {
      onApply: (c) => mutLines(arr => { if (arr[idx]) arr[idx].color = c; }),
      onCommit: commit,
    });

    const rm = propPanel.querySelector(`[data-line-remove="${idx}"]`);
    rm?.addEventListener('click', () => {
      if (lines.length <= 1) return;
      mutLines(arr => arr.splice(idx, 1));
      commit();
      // 삭제된 줄이 보고 있던 줄이면 한 칸 앞으로 — 범위 보정은 렌더 진입부가 한 번 더 한다.
      showBanner02Properties(block, activeIdx === null ? null : Math.max(0, idx - 1)); // 인덱스 변경되니 패널 재생성
    });
  });

  // ⑴⑵ 요약 줄 클릭 → 편집칸 펼침/접힘 (빈 줄은 항상 펼침이라 접어도 다시 열린다 — 의도)
  propPanel.querySelectorAll('[data-line-toggle]').forEach(el => {
    el.addEventListener('click', () => {
      const i = parseInt(el.dataset.lineToggle, 10);
      const set = _bn2Expanded(block);
      set.has(i) ? set.delete(i) : set.add(i);
      showBanner02Properties(block);
    });
  });

  // ⑧ 줄 선택 칩
  propPanel.querySelectorAll('[data-line-chip]').forEach(chip => {
    chip.addEventListener('click', () => {
      const v = chip.dataset.lineChip;
      showBanner02Properties(block, v === 'all' ? null : parseInt(v, 10));
    });
  });

  // 줄 추가 버튼
  propPanel.querySelector('#bn2-line-add')?.addEventListener('click', () => {
    const v = window.BANNER02_VARIANTS?.[block.dataset.variant] || window.BANNER02_VARIANTS?.frame_8 || {};
    mutLines(arr => arr.push(window._bn2Lines.normalize({ kind: 'sub', text: '새 줄', size: v.subSize || 16, color: '#000000', gapTop: v.gap2 || 10 })));
    commit();
    // 새로 추가한 줄을 바로 펼쳐준다(전체 보기 중이면 전체 유지).
    showBanner02Properties(block, activeIdx === null ? null : (window._bn2Lines.read(block).length - 1));
  });

  // Image upload/clear/fit
  propPanel.querySelector('#bn2-img-upload')?.addEventListener('click', () => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = () => {
      const f = inp.files?.[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => { block.dataset.imgSrc = r.result; rerender(); commit(); showBanner02Properties(block); };
      r.readAsDataURL(f);
    };
    inp.click();
  });
  propPanel.querySelector('#bn2-img-clear')?.addEventListener('click', () => {
    block.dataset.imgSrc = ''; rerender(); commit(); showBanner02Properties(block);
  });
  propPanel.querySelectorAll('#bn2-fit-group [data-fit]').forEach(btn => {
    btn.addEventListener('click', () => { block.dataset.imgFit = btn.dataset.fit; rerender(); commit(); showBanner02Properties(block); });
  });

  // 이미지·텍스트 좌우 바꾸기 — 가로 위치를 배너 중심 기준으로 미러링 (구버전 배너 _swapBannerChildren과 동일 개념)
  propPanel.querySelector('#bn2-swap')?.addEventListener('click', () => {
    const W = parseInt(block.dataset.bannerW) || 780;
    const tX = parseInt(block.dataset.textX) || 0, tW = parseInt(block.dataset.textW) || 0;
    const iX = parseInt(block.dataset.imgX) || 0,  iW = parseInt(block.dataset.imgW) || 0;
    block.dataset.textX = Math.round(W - (tX + tW));
    block.dataset.imgX  = Math.round(W - (iX + iW));
    rerender(); commit();
    showBanner02Properties(block);   // 좌우가 바뀌면 겹침 판정도 바뀐다 — 힌트 재계산(QA BUG-4)
  });

  // Align
  propPanel.querySelectorAll('#bn2-align-group [data-align]').forEach(btn => {
    btn.addEventListener('click', () => { block.dataset.align = btn.dataset.align; rerender(); commit(); showBanner02Properties(block); });
  });

  // 선택 시 배경이 그라데이션이면 캔버스 위 그라데이션 라인 표시 (gradient가 아니면 overlay가 no-op)
  window.showGradientLine?.(block);
}

// 캔버스에서 그라데이션 라인을 드래그하면(source==='canvas') 모달 피커 스와치만 동기화.
// bg 쓰기/재렌더는 overlay→gradient-model.set()이 이미 처리하므로 여기서 중복 적용하지 않는다(루프 방지).
let _applyingExternal = false;
document.addEventListener('gradient-line:change', (e) => {
  if (e.detail?.source !== 'canvas') return;
  const block = e.target?.closest?.('.banner02-block');
  if (!block || !e.detail?.css) return;
  _applyingExternal = true;
  const sw = document.getElementById('bn2-bg-color')?.closest('.prop-color-swatch');
  if (sw) sw.style.background = e.detail.css; // 모달이 열려 있으면 스와치 미리보기 갱신
  _applyingExternal = false;
});

window.showBanner02Properties = showBanner02Properties;
