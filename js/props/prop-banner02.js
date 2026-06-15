// prop-banner02.js — banner02 블록 우측 프로퍼티 패널 (prop-canvas 패턴 미러링)
import { propPanel } from '../globals.js';
import { colorFieldHTML, wireColorField } from './color-picker.js';

export function showBanner02Properties(block) {
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
    return `
    <div class="prop-section" data-line-row="${idx}">
      <div class="prop-section-title" style="display:flex;align-items:center;gap:6px;justify-content:space-between;">
        <span style="display:flex;align-items:center;gap:6px;">
          <select class="prop-number" data-line-kind="${idx}" style="font-size:11px;padding:1px 4px;">
            ${KIND_OPTS.map(k => `<option value="${k}"${line.kind === k ? ' selected' : ''}>${KIND_LABELS[k] || k}</option>`).join('')}
          </select>
          <span style="font-size:10px;color:#888;">#${idx + 1}</span>
        </span>
        <button class="prop-btn prop-btn-danger" data-line-remove="${idx}" title="줄 삭제" style="padding:2px 8px;font-size:11px;${lines.length <= 1 ? 'opacity:0.4;pointer-events:none;' : ''}">×</button>
      </div>
      <textarea class="prop-textarea" data-line-text="${idx}" rows="2" style="width:100%;box-sizing:border-box;resize:vertical;">${(line.text || '').replace(/</g, '&lt;')}</textarea>
      <div class="prop-row">
        <span class="prop-label">크기</span>
        <input type="range" class="prop-slider" data-line-size="${idx}" min="8" max="120" step="1" value="${Math.min(120, line.size)}">
        <input type="number" class="prop-number" data-line-size-num="${idx}" min="8" max="200" value="${line.size}">
      </div>
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
        <span class="prop-label">자간</span>
        <input type="number" class="prop-number" data-line-ls="${idx}" min="-20" max="50" step="0.5" value="${line.letterSpacing || 0}">
      </div>
      <div class="prop-row">
        <span class="prop-label">여백위</span>
        <input type="number" class="prop-number" data-line-gap="${idx}" min="0" max="400" value="${line.gapTop}">
      </div>
      <div class="prop-color-row">
        <span class="prop-label">색</span>
        ${colorFieldHTML({ idPrefix: 'bn2-line-' + idx + '-col', hex: line.color || '#000000' })}
      </div>
    </div>`;
  };
  const linesHTML = lines.map(lineRow).join('') + `
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
      <div class="prop-section-title">Size</div>
      <div class="prop-row">
        <span class="prop-label">W</span>
        <input type="number" class="prop-number" id="bn2-w" value="${parseInt(d.bannerW) || 780}" min="100" max="1600">
        <span class="prop-label" style="margin-left:8px">H</span>
        <input type="number" class="prop-number" id="bn2-h" value="${parseInt(d.bannerH) || 260}" min="40" max="1200">
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
      <button class="prop-btn" id="bn2-swap" style="width:100%;margin-top:6px;">↔ 이미지·텍스트 좌우 바꾸기</button>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Text Align</div>
      <div class="prop-align-group" id="bn2-align-group" style="display:flex;gap:4px;">
        <button class="prop-align-btn${(d.align || 'left') === 'left' ? ' active' : ''}" data-align="left" style="flex:1;">좌</button>
        <button class="prop-align-btn${d.align === 'center' ? ' active' : ''}" data-align="center" style="flex:1;">중앙</button>
        <button class="prop-align-btn${d.align === 'right' ? ' active' : ''}" data-align="right" style="flex:1;">우</button>
      </div>
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);
  const rerender = () => window.renderBanner02?.(block);
  const commit = () => { window.pushHistory?.(); window.scheduleAutoSave?.(); };

  // Variant
  propPanel.querySelectorAll('#bn2-variant-group [data-variant]').forEach(btn => {
    btn.addEventListener('click', () => {
      const v = window.BANNER02_VARIANTS?.[btn.dataset.variant];
      if (!v) return;
      block.dataset.variant = btn.dataset.variant;
      // 기하/크기만 variant로 갱신 (텍스트·이미지 내용 보존)
      ['width:bannerW', 'height:bannerH', 'radius:radius', 'textX:textX', 'textY:textY', 'textW:textW',
       'labelSize:labelSize', 'titleSize:titleSize', 'subSize:subSize', 'gap1:gap1', 'gap2:gap2',
       'imgX:imgX', 'imgY:imgY', 'imgW:imgW', 'imgH:imgH'].forEach(m => {
        const [vk, dk] = m.split(':'); if (v[vk] !== undefined) block.dataset[dk] = v[vk];
      });
      rerender(); commit(); showBanner02Properties(block);
    });
  });

  // Size
  const bindNum = (id, dk, render = true) => {
    const el = propPanel.querySelector('#' + id);
    el?.addEventListener('change', () => { block.dataset[dk] = el.value; if (render) rerender(); commit(); });
  };
  bindNum('bn2-w', 'bannerW'); bindNum('bn2-h', 'bannerH');

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
    const ta = propPanel.querySelector(`[data-line-text="${idx}"]`);
    ta?.addEventListener('input',  () => mutLines(arr => { if (arr[idx]) arr[idx].text = ta.value; }));
    ta?.addEventListener('change', commit);

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
      showBanner02Properties(block); // 인덱스 변경되니 패널 재생성
    });
  });

  // 줄 추가 버튼
  propPanel.querySelector('#bn2-line-add')?.addEventListener('click', () => {
    const v = window.BANNER02_VARIANTS?.[block.dataset.variant] || window.BANNER02_VARIANTS?.frame_8 || {};
    mutLines(arr => arr.push(window._bn2Lines.normalize({ kind: 'sub', text: '새 줄', size: v.subSize || 16, color: '#000000', gapTop: v.gap2 || 10 })));
    commit();
    showBanner02Properties(block);
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
