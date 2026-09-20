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
      <div class="grad-stops-bar" id="grad-stops-bar"></div>
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

  /* ★0920b grad-alpha: NaN 방어. Math.max/min 은 NaN 을 «그대로» 통과시키고, JSON.stringify 가
     그걸 null 로 적으면 gradient-block.js `_resolveStops` 의 `|| 0` 이 «완전 투명»으로 둔갑한다.
     입력단(여기)에서 끊는다. ⚠️_resolveStops 자체의 `||0` 은 이 유닛 범위 밖 — MCP/임포트로
     들어온 쓰레기는 여전히 0 으로 떨어진다(별도 카드). */
  const _clamp01 = (v, fallback) => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback; };

  const setStops = (stops, commit) => {
    /* 정렬로 «줄 순서»가 바뀔 수 있다 → 「입력 전 인덱스 → 정렬 후 인덱스」 지도를 만들어
       buildList 의 포커스 복원이 «같은 stop» 을 따라가게 한다(아래 B 처방). */
    const mapped = stops
      .map((s, i) => ({ color: _hex6(s.color)||'#000000', alpha: _clamp01(s.alpha, 1), offset: _clamp01(s.offset, 0), _i: i }))
      .sort((a,b)=>a.offset-b.offset);
    const order = new Map(mapped.map((s, ni) => [s._i, ni]));
    const norm = mapped.map(({ _i, ...rest }) => rest);
    block.dataset.gradStops = JSON.stringify(norm);
    // 레거시 4필드 미러(MCP/로더 호환)
    block.dataset.gradStart = norm[0].color;            block.dataset.gradStartAlpha = String(norm[0].alpha);
    block.dataset.gradEnd   = norm[norm.length-1].color; block.dataset.gradEndAlpha   = String(norm[norm.length-1].alpha);
    rerender();
    if (commit) { window.pushHistory?.(); window.scheduleAutoSave?.(); }
    paintBar(norm); buildList(norm, order);
  };

  const paintBar = (stops) => {
    if (!barEl) return;
    const css = 'linear-gradient(to right, ' + stops.map(s => `${_toRgba(s.color,s.alpha)} ${Math.round(s.offset*100)}%`).join(', ') + ')';
    barEl.style.background = `${css}, repeating-conic-gradient(#666 0% 25%, #888 0% 50%) 0/10px 10px`;
    barEl.querySelectorAll('.grad-stop-thumb').forEach(t=>t.remove());
    stops.forEach((s, i) => {
      const t = document.createElement('div');
      t.className = 'grad-stop-thumb'; t.dataset.idx = String(i);
      t.style.left = (s.offset * 100) + '%';
      t.style.setProperty('--stop-color', s.color);
      barEl.appendChild(t);
      t.addEventListener('mousedown', (e) => {
        e.preventDefault(); e.stopPropagation();
        t.classList.add('dragging');
        const arr = STOP();
        // 라이브 드래그 중엔 DOM을 재생성하지 않는다 — paintBar()는 매 프레임 모든
        // .grad-stop-thumb 을 지우고 다시 만들어 드래그가 끊겨 보였다(createElement × N/frame).
        // 위치만 바뀌므로: 잡은 핸들(t) 자신의 left만 갱신 + 바 배경만 다시 칠한다.
        // 순서 재정렬(paintBar 재호출)은 mouseup 커밋 시 setStops()가 1회만 수행.
        const r = barEl.getBoundingClientRect();
        const onMove = (ev) => {
          const p = Math.max(0, Math.min(1, (ev.clientX - r.left)/r.width));
          arr[i].offset = p;
          block.dataset.gradStops = JSON.stringify(arr.slice().sort((a,b)=>a.offset-b.offset));
          rerender();
          t.style.left = (p * 100) + '%';
          const sorted = arr.slice().sort((a,b)=>a.offset-b.offset);
          barEl.style.background =
            'linear-gradient(to right, ' + sorted.map(s => `${_toRgba(s.color,s.alpha)} ${Math.round(s.offset*100)}%`).join(', ') + ')'
            + ', repeating-conic-gradient(#666 0% 25%, #888 0% 50%) 0/10px 10px';
        };
        const onUp = () => { window.removeEventListener('mousemove',onMove); window.removeEventListener('mouseup',onUp); t.classList.remove('dragging'); setStops(STOP(), true); };
        window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
      });
    });
  };

  /* «옆 칸 클릭»으로 커밋이 떨어지는 경우엔 buildList 시점의 activeElement 가 이미 BODY 다
     (mousedown 기본동작의 blur → change → 커밋 → 재생성 순서라, 사용자가 «가려던» 칸은 아직
     포커스를 못 받았고 그 사이 DOM 에서 지워진다). 그래서 mousedown «때» 가려던 칸을 적어두고,
     재생성 후 그 칸으로 포커스를 넘긴다. 같은 task 안에서만 유효하게 setTimeout(0) 로 비운다. */
  let _pendingFocus = null;
  listEl?.addEventListener('mousedown', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement) || t.tagName !== 'INPUT') return;
    const row = t.closest('.grad-stop-row');
    const oldIdx = row ? parseInt(row.dataset.idx, 10) : NaN;
    if (!Number.isInteger(oldIdx)) return;
    _pendingFocus = { idx: oldIdx, cls: [...(t.classList || [])].find(c => c.startsWith('grad-stop-')) || null };
    setTimeout(() => { _pendingFocus = null; }, 0);
  }, true);

  const buildList = (stops, order) => {
    if (!listEl) return;
    /* ★0920b grad-alpha B: 아래 innerHTML 재생성은 «타이핑 중이던 input» 을 DOM 에서 떼어내
       포커스를 BODY 로 보낸다. 그 상태의 Backspace 는 js/editor.js 의 INPUT 가드(2645줄)를
       못 넘겨 캔버스 삭제 경로로 새고 — .gradient-block.selected 가 CANVAS_SEL_BLOCKS 에
       있으므로 — «블럭이 지워진다». 리스트를 안 그리는 게 아니라(offset 커밋은 정렬로 줄
       순서가 바뀐다) 그리되 포커스·캐럿을 되돌린다. */
    const _ae = document.activeElement;
    let _keep = null;
    if (_ae && _ae.tagName === 'INPUT' && listEl.contains(_ae)) {
      const _row = _ae.closest('.grad-stop-row');
      const _old = _row ? parseInt(_row.dataset.idx, 10) : NaN;
      if (Number.isInteger(_old)) {
        _keep = {
          idx: (order && order.has(_old)) ? order.get(_old) : _old,
          cls: [...(_ae.classList || [])].find(c => c.startsWith('grad-stop-')) || null,
          start: null, end: null,
        };
        // selectionStart 는 type=number/color 에서 던진다 — 캐럿 없이 포커스만 되돌린다.
        try { _keep.start = _ae.selectionStart; _keep.end = _ae.selectionEnd; } catch (_) {}
      }
    }
    if (!_keep && _pendingFocus && _pendingFocus.cls) {
      _keep = { idx: (order && order.has(_pendingFocus.idx)) ? order.get(_pendingFocus.idx) : _pendingFocus.idx,
                cls: _pendingFocus.cls, start: null, end: null };
    }
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
      /* ★0920b grad-alpha A — 커밋 시점은 prop-number-commit-guard 가 blur/Enter 로 일원화한다
         (PN_SEL 에 .grad-stop-alpha/.grad-stop-offset 편입). 여기서는 «파서»를 고친다:
           옛 알파 파서 `/\d+/` 는 "100" 캐럿 중간 Backspace 의 결과 "00" 을 «유효값 0» 으로 봤고,
           옛 offset 파서 `+offIn.value||0` 은 «빈 문자열을 0 으로» 커밋했다(현빈 원문 그대로).
         이제 «칸 전체»가 숫자일 때만 통과하고(빈값·"abc"·부분입력 미커밋), change 에서
         파싱에 실패하면 칸을 모델값으로 되돌려 «표시와 모델이 어긋난 채 남는» 구멍을 막는다. */
      const _pct = (raw) => {
        const t = String(raw ?? '').trim();
        if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
        const n = Number(t);
        return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null;
      };
      const _resync = (el, key) => { const a = STOP()[i]; if (a && el) el.value = String(Math.round(a[key] * 100)); };
      alphaIn.addEventListener('input',  () => { const v=_pct(alphaIn.value); if (v!==null) mutate(s=>s.alpha=v/100, false); });
      alphaIn.addEventListener('change', () => { const v=_pct(alphaIn.value); if (v===null) { _resync(alphaIn,'alpha'); return; } mutate(s=>s.alpha=v/100, true); });
      offIn.addEventListener('input',  () => { const v=_pct(offIn.value); if (v!==null) mutate(s=>s.offset=v/100, false); });
      offIn.addEventListener('change', () => { const v=_pct(offIn.value); if (v===null) { _resync(offIn,'offset'); return; } mutate(s=>s.offset=v/100, true); });
      delBtn.addEventListener('click', () => { const arr=STOP(); if (arr.length<=2) return; arr.splice(i,1); setStops(arr, true); });
    });
    // 재생성 «후» 포커스·캐럿 복원 (위 _keep 과 짝 — 0920b grad-alpha B)
    if (_keep && _keep.cls) {
      const _row = listEl.querySelector(`.grad-stop-row[data-idx="${_keep.idx}"]`);
      const _el = _row && _row.querySelector('.' + _keep.cls);
      if (_el) {
        try { _el.focus({ preventScroll: true }); } catch (_) { try { _el.focus(); } catch (__) {} }
        if (_keep.start != null) { try { _el.setSelectionRange(_keep.start, _keep.end); } catch (_) {} }
      }
    }
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
