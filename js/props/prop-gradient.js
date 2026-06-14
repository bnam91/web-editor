// ── Prop Gradient — 그라데이션 블록 프로퍼티 패널 ──────────────────────────────
// 2026-05-21 신규. gradient-block.js 짝.
//
// 컨트롤:
//   - 헤더 (블록 이름 + ID)
//   - 그라데이션 스타일 (Linear / Radial)
//   - 방향 (linear일 때만 — 8방향)
//   - 시작 색 + opacity
//   - 끝 색 + opacity
//   - 너비 슬라이더 (200~1200, 디폴트 860)
//   - 높이 슬라이더 (50~1500, 디폴트 300)

import { propPanel } from '../globals.js';
import { bindSlider } from './_helpers.js';

const DIRS = [
  { v: 'to bottom',       label: '↓ 위→아래' },
  { v: 'to top',          label: '↑ 아래→위' },
  { v: 'to right',        label: '→ 좌→우' },
  { v: 'to left',         label: '← 우→좌' },
  { v: 'to bottom right', label: '↘ ↖→↘' },
  { v: 'to bottom left',  label: '↙ ↗→↙' },
  { v: 'to top right',    label: '↗ ↙→↗' },
  { v: 'to top left',     label: '↖ ↘→↖' },
];

export function showGradientProperties(block) {
  const style       = block.dataset.gradStyle      || 'linear';
  const direction   = block.dataset.gradDirection  || 'to bottom';
  const startColor  = block.dataset.gradStart      || '#000000';
  const endColor    = block.dataset.gradEnd        || '#000000';
  const startAlpha  = block.dataset.gradStartAlpha != null ? parseFloat(block.dataset.gradStartAlpha) : 1;
  const endAlpha    = block.dataset.gradEndAlpha   != null ? parseFloat(block.dataset.gradEndAlpha)   : 0;
  const height      = parseInt(block.dataset.gradHeight) || 300;
  const width       = parseInt(block.dataset.gradWidth) || 860;

  const startHex = (startColor || '#000000').replace('#','').toUpperCase();
  const endHex   = (endColor   || '#000000').replace('#','').toUpperCase();
  const startAlphaPct = Math.round(startAlpha * 100);
  const endAlphaPct   = Math.round(endAlpha   * 100);

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <defs>
              <linearGradient id="grad-ico" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stop-color="#888" stop-opacity="1"/>
                <stop offset="100%" stop-color="#888" stop-opacity="0"/>
              </linearGradient>
            </defs>
            <rect x="1" y="1" width="12" height="12" fill="url(#grad-ico)" stroke="#888" stroke-width="0.6"/>
          </svg>
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">${block.dataset.layerName || 'Gradient'}</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb?.(block) || ''}</span>
        </div>
        ${block.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="_copyToClipboard('${block.id}')">${block.id}</span>` : ''}
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Style</div>
      <div class="prop-row">
        <span class="prop-label">타입</span>
        <select class="prop-select" id="grad-style" style="flex:1">
          <option value="linear" ${style==='linear'?'selected':''}>Linear (선형)</option>
          <option value="radial" ${style==='radial'?'selected':''}>Radial (비네트)</option>
        </select>
      </div>
      <div class="prop-row" id="grad-dir-row" style="${style==='radial'?'display:none':''}">
        <span class="prop-label">방향</span>
        <select class="prop-select" id="grad-direction" style="flex:1">
          ${DIRS.map(d => `<option value="${d.v}" ${direction===d.v?'selected':''}>${d.label}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Color Stops</div>
      <div class="grad-stops-bar" id="grad-stops-bar" style="position:relative;height:24px;border-radius:4px;border:1px solid var(--border,#2a2a2a);cursor:copy;margin-bottom:8px;background:#222;"></div>
      <div class="prop-hint" style="font-size:11px;color:#999;margin:-2px 0 8px">바를 클릭해 중간색 추가 · 핸들 드래그로 위치 · ×로 삭제(최소 2개)</div>
      <div id="grad-stops-list"></div>
      <button type="button" id="grad-add-stop" class="prop-btn" style="margin-top:6px;width:100%;font-size:12px;">+ 중간색 추가</button>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Size</div>
      <div class="prop-row">
        <span class="prop-label">너비</span>
        <input type="range" class="prop-slider" id="grad-width-slider" min="200" max="1200" step="10" value="${width}">
        <input type="number" class="prop-number" id="grad-width-num" min="200" max="1200" value="${width}">
      </div>
      <div class="prop-row">
        <span class="prop-label">높이</span>
        <input type="range" class="prop-slider" id="grad-height-slider" min="50" max="1500" step="10" value="${height}">
        <input type="number" class="prop-number" id="grad-height-num" min="50" max="1500" value="${height}">
      </div>
      <div class="prop-hint" style="font-size:11px;color:#999;margin-top:4px">캔버스에 자유 배치 (드래그로 이동, 우측 컨트롤로 크기 조절)</div>
    </div>
  `;

  // ── 헬퍼 ────────────────────────────────────────────────────────────────────
  const rerender = () => window.renderGradientBlock?.(block);

  // 스타일 / 방향
  const styleSel = document.getElementById('grad-style');
  const dirRow   = document.getElementById('grad-dir-row');
  const dirSel   = document.getElementById('grad-direction');
  styleSel.addEventListener('change', () => {
    block.dataset.gradStyle = styleSel.value;
    if (dirRow) dirRow.style.display = (styleSel.value === 'radial') ? 'none' : '';
    rerender();
    window.pushHistory?.();
    window.scheduleAutoSave?.();
  });
  dirSel?.addEventListener('change', () => {
    block.dataset.gradDirection = dirSel.value;
    rerender();
    window.pushHistory?.();
    window.scheduleAutoSave?.();
  });

  // ── B24: multi-stop 에디터 ─────────────────────────────────────────────────
  const STOP = () => (window.resolveGradientStops || (b => []))(block);
  const _hex6 = (v) => { const h = String(v||'').replace(/^#/,''); return /^[0-9a-f]{6}$/i.test(h) ? '#'+h.toLowerCase() : null; };
  const _toRgba = (hex, a) => { const h=(hex||'#000000').replace('#',''); const r=parseInt(h.slice(0,2),16)||0,g=parseInt(h.slice(2,4),16)||0,b=parseInt(h.slice(4,6),16)||0; return `rgba(${r},${g},${b},${Math.max(0,Math.min(1,a))})`; };
  const barEl  = document.getElementById('grad-stops-bar');
  const listEl = document.getElementById('grad-stops-list');
  const addBtn = document.getElementById('grad-add-stop');

  const setStops = (stops, commit) => {
    const norm = stops
      .map(s => ({ color: _hex6(s.color)||'#000000', alpha: Math.max(0,Math.min(1, s.alpha)), offset: Math.max(0,Math.min(1, s.offset)) }))
      .sort((a,b)=>a.offset-b.offset);
    block.dataset.gradStops = JSON.stringify(norm);
    // 레거시 4필드 미러(MCP/로더 호환)
    block.dataset.gradStart = norm[0].color;            block.dataset.gradStartAlpha = String(norm[0].alpha);
    block.dataset.gradEnd   = norm[norm.length-1].color; block.dataset.gradEndAlpha   = String(norm[norm.length-1].alpha);
    rerender();
    if (commit) { window.pushHistory?.(); window.scheduleAutoSave?.(); }
    paintBar(norm); buildList(norm);
  };

  const paintBar = (stops) => {
    if (!barEl) return;
    const css = 'linear-gradient(to right, ' + stops.map(s => `${_toRgba(s.color,s.alpha)} ${Math.round(s.offset*100)}%`).join(', ') + ')';
    barEl.style.background = `${css}, repeating-conic-gradient(#666 0% 25%, #888 0% 50%) 0/10px 10px`;
    barEl.querySelectorAll('.grad-stop-thumb').forEach(t=>t.remove());
    stops.forEach((s, i) => {
      const t = document.createElement('div');
      t.className = 'grad-stop-thumb'; t.dataset.idx = String(i);
      t.style.cssText = `position:absolute;top:-3px;width:10px;height:30px;margin-left:-5px;left:${s.offset*100}%;border:2px solid #fff;border-radius:3px;box-shadow:0 0 0 1px #000;background:${s.color};cursor:ew-resize;`;
      barEl.appendChild(t);
      t.addEventListener('mousedown', (e) => {
        e.preventDefault(); e.stopPropagation();
        const arr = STOP();
        const onMove = (ev) => {
          const r = barEl.getBoundingClientRect();
          const p = Math.max(0, Math.min(1, (ev.clientX - r.left)/r.width));
          arr[i].offset = p;
          block.dataset.gradStops = JSON.stringify(arr.slice().sort((a,b)=>a.offset-b.offset));
          rerender(); paintBar(arr.slice().sort((a,b)=>a.offset-b.offset));
        };
        const onUp = () => { window.removeEventListener('mousemove',onMove); window.removeEventListener('mouseup',onUp); setStops(STOP(), true); };
        window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
      });
    });
  };

  const buildList = (stops) => {
    if (!listEl) return;
    listEl.innerHTML = stops.map((s, i) => `
      <div class="prop-color-row grad-stop-row" data-idx="${i}" style="display:flex;gap:6px;align-items:center;margin-bottom:6px;">
        <div class="prop-color-swatch" style="background:${s.color};position:relative;width:24px;height:24px;border-radius:4px;overflow:hidden;">
          <input type="color" class="grad-stop-color" value="${s.color}" style="position:absolute;inset:0;opacity:0;cursor:pointer;">
        </div>
        <input type="text" class="prop-color-hex grad-stop-hex" maxlength="6" value="${s.color.replace('#','').toUpperCase()}" style="flex:1;" aria-label="stop ${i+1} 색">
        <input type="text" class="grad-stop-alpha" value="${Math.round(s.alpha*100)}" style="width:34px;text-align:right;" aria-label="stop ${i+1} opacity">%
        <input type="number" class="grad-stop-offset" min="0" max="100" value="${Math.round(s.offset*100)}" style="width:48px;" aria-label="stop ${i+1} 위치">%
        <button type="button" class="grad-stop-del" title="삭제" ${stops.length<=2?'disabled':''} style="border:none;background:none;color:${stops.length<=2?'#555':'#c66'};cursor:${stops.length<=2?'default':'pointer'};font-size:14px;">×</button>
      </div>`).join('');
    listEl.querySelectorAll('.grad-stop-row').forEach((row) => {
      const i = parseInt(row.dataset.idx);
      const colorIn = row.querySelector('.grad-stop-color');
      const hexIn   = row.querySelector('.grad-stop-hex');
      const alphaIn = row.querySelector('.grad-stop-alpha');
      const offIn   = row.querySelector('.grad-stop-offset');
      const delBtn  = row.querySelector('.grad-stop-del');
      const mutate = (fn, commit) => { const arr = STOP(); if (!arr[i]) return; fn(arr[i]); setStops(arr, commit); };
      colorIn.addEventListener('input',  () => mutate(s => s.color = colorIn.value, false));
      colorIn.addEventListener('change', () => mutate(s => s.color = colorIn.value, true));
      hexIn.addEventListener('input',  () => { const h=_hex6(hexIn.value); if (h) mutate(s=>s.color=h, false); });
      hexIn.addEventListener('change', () => { const h=_hex6(hexIn.value); if (h) mutate(s=>s.color=h, true); });
      alphaIn.addEventListener('input',  () => { const m=alphaIn.value.match(/\d+/); if(m) mutate(s=>s.alpha=Math.max(0,Math.min(100,+m[0]))/100, false); });
      alphaIn.addEventListener('change', () => { const m=alphaIn.value.match(/\d+/); if(m) mutate(s=>s.alpha=Math.max(0,Math.min(100,+m[0]))/100, true); });
      offIn.addEventListener('input',  () => mutate(s => s.offset = Math.max(0,Math.min(100, +offIn.value||0))/100, false));
      offIn.addEventListener('change', () => mutate(s => s.offset = Math.max(0,Math.min(100, +offIn.value||0))/100, true));
      delBtn.addEventListener('click', () => { const arr=STOP(); if (arr.length<=2) return; arr.splice(i,1); setStops(arr, true); });
    });
  };

  // 바 빈 영역 클릭 → 보간색으로 stop 추가
  barEl?.addEventListener('mousedown', (e) => {
    if (e.target.closest('.grad-stop-thumb')) return;
    const r = barEl.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (e.clientX - r.left)/r.width));
    const arr = STOP().slice().sort((a,b)=>a.offset-b.offset);
    // p를 둘러싼 이웃 stop 색을 그대로 차용(보간 단순화: 가까운 쪽 색)
    let near = arr[0];
    for (const s of arr) if (Math.abs(s.offset-p) < Math.abs(near.offset-p)) near = s;
    arr.push({ color: near.color, alpha: near.alpha, offset: p });
    setStops(arr, true);
  });
  addBtn?.addEventListener('click', () => {
    const arr = STOP().slice().sort((a,b)=>a.offset-b.offset);
    // 가장 큰 간격 중앙에 추가
    let gap=-1, at=0.5, c='#000000', a0=1;
    for (let i=0;i<arr.length-1;i++){ const d=arr[i+1].offset-arr[i].offset; if(d>gap){gap=d; at=(arr[i].offset+arr[i+1].offset)/2; c=arr[i].color; a0=arr[i].alpha;} }
    arr.push({ color:c, alpha:a0, offset:at });
    setStops(arr, true);
  });

  // 초기 렌더
  { const init = STOP(); paintBar(init); buildList(init); }

  // 너비/높이 — sticker 패턴: dataset만 갱신, renderGradientBlock으로 cssText 재적용
  const widthSlider = document.getElementById('grad-width-slider');
  const widthNum    = document.getElementById('grad-width-num');
  const applyWidth = (v) => {
    block.dataset.gradWidth = String(v);
    rerender();
  };
  bindSlider(widthSlider, widthNum, applyWidth, { min: 200, max: 1200 });

  const heightSlider = document.getElementById('grad-height-slider');
  const heightNum    = document.getElementById('grad-height-num');
  const applyHeight = (v) => {
    block.dataset.gradHeight = String(v);
    rerender();
  };
  bindSlider(heightSlider, heightNum, applyHeight, { min: 50, max: 1500 });
}

// ── window 노출 ────────────────────────────────────────────────────────────
window.showGradientProperties = showGradientProperties;
