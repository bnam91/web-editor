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

  const textRow = (key, labelTxt) => `
    <div class="prop-section">
      <div class="prop-section-title">${labelTxt}</div>
      <textarea class="prop-textarea" id="bn2-${key}" rows="2" style="width:100%;box-sizing:border-box;resize:vertical;">${(d[key] || '').replace(/</g, '&lt;')}</textarea>
      <div class="prop-row">
        <span class="prop-label">크기</span>
        <input type="range" class="prop-slider" id="bn2-${key}-size" min="8" max="120" step="1" value="${parseInt(d[key + 'Size']) || 24}">
        <input type="number" class="prop-number" id="bn2-${key}-size-num" min="8" max="200" value="${parseInt(d[key + 'Size']) || 24}">
      </div>
      <div class="prop-color-row">
        <span class="prop-label">색</span>
        ${colorFieldHTML({ idPrefix: 'bn2-' + key + '-col', hex: d[key + 'Color'] || '#000000' })}
      </div>
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

    ${textRow('label', 'Label')}
    ${textRow('title', 'Title')}
    ${textRow('sub', 'Subtitle')}

    <div class="prop-section">
      <div class="prop-section-title">Image</div>
      <div class="prop-row" style="gap:4px;">
        <button class="prop-btn" id="bn2-img-upload" style="flex:1;">${d.imgSrc ? '교체' : '추가'}</button>
        ${d.imgSrc ? '<button class="prop-btn" id="bn2-img-clear" style="flex:1;color:#e06c6c;">제거</button>' : ''}
      </div>
      <div class="prop-align-group" id="bn2-fit-group" style="display:flex;gap:4px;margin-top:4px;">
        <button class="prop-align-btn${(d.imgFit || 'cover') === 'cover' ? ' active' : ''}" data-fit="cover" style="flex:1;font-size:11px;">꽉 채우기</button>
        <button class="prop-align-btn${d.imgFit === 'contain' ? ' active' : ''}" data-fit="contain" style="flex:1;font-size:11px;">원본 비율</button>
      </div>
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
    onGradient: (css, c) => { block.dataset.bg = css; rerender(); window.scheduleAutoSave?.(); if (c) commit(); },
    onCommit: commit,
  });

  // Radius (slider+num 동기)
  const rs = propPanel.querySelector('#bn2-radius'), rn = propPanel.querySelector('#bn2-radius-num');
  const setR = v => { v = Math.max(0, Math.min(60, parseInt(v) || 0)); block.dataset.radius = v; rs.value = v; rn.value = v; rerender(); };
  rs?.addEventListener('input', () => setR(rs.value));
  rn?.addEventListener('input', () => setR(rn.value));
  rs?.addEventListener('change', commit); rn?.addEventListener('change', commit);

  // Label/Title/Sub
  ['label', 'title', 'sub'].forEach(key => {
    const ta = propPanel.querySelector('#bn2-' + key);
    ta?.addEventListener('input', () => { block.dataset[key] = ta.value; rerender(); });
    ta?.addEventListener('change', commit);
    const sl = propPanel.querySelector('#bn2-' + key + '-size'), sn = propPanel.querySelector('#bn2-' + key + '-size-num');
    const setS = v => { v = Math.max(8, Math.min(200, parseInt(v) || 24)); block.dataset[key + 'Size'] = v; sl.value = Math.min(120, v); sn.value = v; rerender(); };
    sl?.addEventListener('input', () => setS(sl.value));
    sn?.addEventListener('input', () => setS(sn.value));
    sl?.addEventListener('change', commit); sn?.addEventListener('change', commit);
    wireColorField('bn2-' + key + '-col', {
      onApply: (c) => { block.dataset[key + 'Color'] = c; rerender(); window.scheduleAutoSave?.(); },
      onCommit: commit,
    });
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

  // Align
  propPanel.querySelectorAll('#bn2-align-group [data-align]').forEach(btn => {
    btn.addEventListener('click', () => { block.dataset.align = btn.dataset.align; rerender(); commit(); showBanner02Properties(block); });
  });
}

window.showBanner02Properties = showBanner02Properties;
