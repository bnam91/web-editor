/* ═══════════════════════════════════
   STEP BLOCK
═══════════════════════════════════ */
//
// 의존성:
//   - insertAfterSelected (drag-utils.js)
//   - bindBlock (drag-drop.js)
//   - window.getSelectedSection / window.showNoSelectionHint / window.pushHistory /
//     window.buildLayerPanel / window.triggerAutoSave

import { insertAfterSelected } from '../drag-utils.js';
import { bindBlock } from '../drag-drop.js';

const STEP_DEFAULT_DATA = [
  { title: '1단계', desc: '첫 번째 단계 설명' },
  { title: '2단계', desc: '두 번째 단계 설명' },
  { title: '3단계', desc: '세 번째 단계 설명' },
];

function _stepToken(name, fallback) {
  if (typeof getComputedStyle !== 'function') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function renderStepBlock(block) {
  // ── 더블클릭 인라인 편집 위임 (block 자체에 한 번만 등록 — innerHTML이 갱신돼도 살아남음) ──
  if (!block._stbDblBound) {
    block._stbDblBound = true;
    block.addEventListener('dblclick', (e) => {
      const target = e.target.closest('.stb-title, .stb-desc');
      if (!target || !block.contains(target)) return;
      e.stopPropagation();
      target.contentEditable = 'true';
      target.style.outline = '2px dashed var(--ui-accent-primary, #3b82f6)';
      target.style.outlineOffset = '2px';
      target.focus();
      const range = document.createRange();
      range.selectNodeContents(target);
      const sel = window.getSelection();
      sel.removeAllRanges(); sel.addRange(range);
    });
    const commit = (target) => {
      target.contentEditable = 'false';
      target.style.outline = ''; target.style.outlineOffset = '';
      const titles = [...block.querySelectorAll('.stb-title')];
      const descs  = [...block.querySelectorAll('.stb-desc')];
      const stepsArr = JSON.parse(block.dataset.steps || '[]');
      titles.forEach((t, i) => { if (stepsArr[i]) stepsArr[i].title = t.innerText.trim(); });
      descs.forEach((d, i)  => { if (stepsArr[i]) stepsArr[i].desc  = d.innerText.trim(); });
      block.dataset.steps = JSON.stringify(stepsArr);
      window.pushHistory?.('스텝 편집');
      window.scheduleAutoSave?.();
      if (block.classList.contains('selected') && window.showStepProperties) window.showStepProperties(block);
    };
    block.addEventListener('blur', (e) => {
      const target = e.target?.closest?.('.stb-title, .stb-desc');
      if (target && target.contentEditable === 'true') commit(target);
    }, true); // capture — focusout 대신 blur capture
    block.addEventListener('keydown', (e) => {
      const target = e.target?.closest?.('.stb-title, .stb-desc');
      if (!target || target.contentEditable !== 'true') return;
      // Enter = 줄바꿈 (기본 동작 유지). Escape 또는 Cmd/Ctrl+Enter = 편집 종료
      if (e.key === 'Escape') { e.preventDefault(); target.blur(); }
      else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); target.blur(); }
    });
  }

  const steps      = JSON.parse(block.dataset.steps || '[]');
  const numBg      = block.dataset.numBg      || _stepToken('--preset-step-num-bg', '#222222');
  const numColor   = block.dataset.numColor   || _stepToken('--preset-step-num-color', '#ffffff');
  const numSize    = parseInt(block.dataset.numSize)    || 36;
  const titleSz    = parseInt(block.dataset.titleSize)  || 36;
  const descSz     = parseInt(block.dataset.descSize)   || 24;
  const gap        = parseInt(block.dataset.gap)        || 24;
  const connector  = block.dataset.connector !== 'false';
  const titleColor = block.dataset.titleColor || _stepToken('--preset-step-title', '#222222');
  const descColor  = block.dataset.descColor  || _stepToken('--preset-step-desc', '#555555');
  const orient     = block.dataset.stepOrient || 'vertical';
  const style      = block.dataset.stepStyle  || 'default';
  const cardBg     = block.dataset.stepCardBg || _stepToken('--preset-step-card-bg', '#f5f5f5');
  const align          = block.dataset.stepAlign       || 'left';
  const padL = parseInt(block.dataset.stepPadL ?? block.dataset.stepPadX) || 0;
  const padR = parseInt(block.dataset.stepPadR ?? block.dataset.stepPadX) || 0;
  const badgeFmt       = block.dataset.badgeFormat     || 'number';
  const badgeGap       = parseInt(block.dataset.badgeGap)  || 16;
  const connectorStyle = block.dataset.connectorStyle   || 'line'; // 'line' | 'arrow'

  // 'step'/'point'는 텍스트가 길어 원형 유지 불가 → pill(직사각형) 박스로 렌더
  const badgeIsPill = badgeFmt === 'step' || badgeFmt === 'point';

  // 시작 번호 — 한 섹션에 step-block 여러 개 흩어 놓고 01/02/03 순차 표시할 때 사용
  const startNumber = parseInt(block.dataset.startNumber) || 1;

  function badgeLabel(i) {
    const n = i + startNumber;
    const pad = String(n).padStart(2, '0');
    if (badgeFmt === 'padded') return pad;
    if (badgeFmt === 'alpha')  return String.fromCharCode(64 + n); // A, B, C...
    if (badgeFmt === 'step')   return `STEP ${pad}`;
    if (badgeFmt === 'point')  return `POINT ${pad}`;
    return String(n);
  }

  // 배지 인라인 스타일 생성 (원형 or pill)
  function badgeStyle(extra = '') {
    const base = `background:${numBg};color:${numColor};font-size:${Math.round(numSize*0.38)}px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;line-height:1;${extra}`;
    if (badgeIsPill) {
      return `${base}height:${numSize}px;padding:0 ${Math.round(numSize*0.4)}px;border-radius:${Math.round(numSize*0.3)}px;white-space:nowrap;`;
    }
    return `${base}width:${numSize}px;height:${numSize}px;border-radius:50%;`;
  }

  const pxStyle = (padL > 0 || padR > 0) ? `padding-left:${padL}px;padding-right:${padR}px;box-sizing:border-box;` : '';

  // 연결선 헬퍼 — 세로용 (배지 아래 → 다음 배지 위)
  function connectorV() {
    if (connectorStyle === 'arrow') {
      const sz = Math.max(14, Math.round(numSize * 0.45));
      return `<div style="flex:1;display:flex;align-items:center;justify-content:center;min-height:${Math.round(numSize*0.5)}px">
        <svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="${numBg}" style="opacity:0.5">
          <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
        </svg></div>`;
    }
    if (connectorStyle === 'divider') {
      return `<div style="width:100%;height:1px;background:${numBg};opacity:0.2;margin:${Math.round(gap*0.3)}px 0"></div>`;
    }
    return `<div class="stb-line" style="background:${numBg};opacity:0.25"></div>`;
  }

  // 연결선 헬퍼 — 가로용 (side: 'left'|'right', hidden: 끝에서 숨김)
  function connectorH(hidden, side = 'left') {
    if (hidden) return `<div style="flex:1;visibility:hidden"></div>`;
    if (connectorStyle === 'arrow') {
      // 화살표는 오른쪽(right)에만 — 왼쪽은 빈 공간만
      if (side === 'left') return `<div style="flex:1"></div>`;
      const sz = Math.max(12, Math.round(numSize * 0.4));
      return `<div style="flex:1;display:flex;align-items:center;justify-content:center">
        <svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="${numBg}" style="opacity:0.5">
          <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
        </svg></div>`;
    }
    return `<div style="flex:1;height:2px;background:${numBg};opacity:0.25"></div>`;
  }

  // ── 카드형 ────────────────────────────────────────────────────────────────
  if (style === 'card') {
    if (orient === 'horizontal') {
      block.innerHTML = `<div style="display:flex;flex-direction:row;align-items:stretch;gap:${gap}px;width:100%;${pxStyle}">${
        steps.map((s, i) => `
          <div style="flex:1;min-width:0;background:${cardBg};border-radius:12px;padding:16px 20px;box-sizing:border-box;display:flex;flex-direction:column;gap:8px;">
            <div style="${badgeStyle()}">${badgeLabel(i)}</div>
            <div class="stb-title" style="font-size:${titleSz}px;color:${titleColor};line-height:1.4">${s.title||''}</div>
            ${s.desc?`<div class="stb-desc" style="font-size:${descSz}px;color:${descColor}">${s.desc}</div>`:''}</div>`).join('')
      }</div>`;
    } else if (align === 'center') {
      // card/center = full-width 카드 (left/right와 동일 너비) + 내부 콘텐츠 중앙 정렬
      const _titleLineH = Math.round(titleSz * 1.4);
      const _diff       = (_titleLineH - numSize) / 2;
      const _leftPadTop = _diff > 0 ? Math.round(_diff) : 0;
      const _contPadTop = _diff < 0 ? Math.round(-_diff) : 0;
      block.innerHTML = `<div style="${pxStyle}">${steps.map((s, i) => {
        return `
          <div style="background:${cardBg};border-radius:12px;padding:16px 20px;box-sizing:border-box;${i>0?`margin-top:${gap}px`:''}">
            <div style="width:fit-content;margin:0 auto;display:flex;align-items:flex-start;gap:${badgeGap}px">
              <div style="${badgeStyle()}margin-top:${_leftPadTop}px;">${badgeLabel(i)}</div>
              <div style="margin-top:${_contPadTop}px">
                <div class="stb-title" style="font-size:${titleSz}px;color:${titleColor};line-height:1.4">${s.title||''}</div>
                ${s.desc ? `<div class="stb-desc" style="font-size:${descSz}px;color:${descColor}">${s.desc}</div>` : ''}
              </div>
            </div>
          </div>`;
      }).join('')}</div>`;
    } else {
      // card left / right / stack
      const cardTitleLineH = Math.round(titleSz * 1.4);
      const cardBadgeTop   = Math.max(0, Math.round((cardTitleLineH - numSize) / 2));
      const isCardRight  = align === 'right';
      const isCardStack  = align === 'stack';
      const itemFlex = isCardStack
        ? `flex-direction:column;align-items:center;gap:${badgeGap}px`
        : isCardRight
        ? `flex-direction:row-reverse;align-items:flex-start;gap:${badgeGap}px`
        : `align-items:flex-start;gap:${badgeGap}px`;
      const contentAlign = isCardStack ? 'center' : isCardRight ? 'right' : 'left';
      const badgeTop     = isCardStack ? 0 : cardBadgeTop;
      block.innerHTML = `<div style="${pxStyle}">${steps.map((s, i) => `
        <div style="background:${cardBg};border-radius:12px;padding:16px 20px;box-sizing:border-box;display:flex;${itemFlex};${i>0?`margin-top:${gap}px`:''}">
          <div style="${badgeStyle()}margin-top:${badgeTop}px;">${badgeLabel(i)}</div>
          <div style="${isCardStack?'':`flex:1;min-width:0;`}text-align:${contentAlign}">
            <div class="stb-title" style="font-size:${titleSz}px;color:${titleColor};line-height:1.4">${s.title||''}</div>
            ${s.desc?`<div class="stb-desc" style="font-size:${descSz}px;color:${descColor};margin-top:4px">${s.desc}</div>`:''}</div></div>`).join('')}</div>`;
    }
    return;
  }

  // 가로 화살표 연결선 — step 컬럼 사이에 독립 요소로 렌더 (중앙 정렬)
  const useHArrow = connector && connectorStyle === 'arrow';
  function hArrowEl(centerPx) {
    const sz = Math.max(12, Math.round(numSize * 0.4));
    return `<div style="display:flex;align-items:flex-start;padding-top:${Math.max(0, centerPx - Math.round(sz/2))}px;flex-shrink:0;">
      <svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="${numBg}" style="opacity:0.5">
        <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
      </svg></div>`;
  }

  // ── 원형 (항상 가로) ──────────────────────────────────────────────────────
  if (style === 'circle') {
    const circleSize   = Math.max(80, Math.round(numSize * 2.8));
    const innerTitleSz = Math.min(titleSz, Math.round(circleSize * 0.18));
    block.innerHTML = `<div style="display:flex;flex-direction:row;align-items:flex-start;width:100%;${pxStyle}">${
      steps.map((s, i) => {
        const isLast = i === steps.length - 1;
        const lineL = connector && !useHArrow ? `<div style="flex:1;height:2px;${i===0?'visibility:hidden;':`background:${numBg};opacity:0.25;`}"></div>` : `<div style="flex:1;visibility:hidden"></div>`;
        const lineR = connector && !useHArrow ? `<div style="flex:1;height:2px;${isLast?'visibility:hidden;':`background:${numBg};opacity:0.25;`}"></div>` : `<div style="flex:1;visibility:hidden"></div>`;
        return `
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;min-width:0;">
            <div style="display:flex;align-items:center;width:100%;">
              ${lineL}
              <div style="width:${circleSize}px;height:${circleSize}px;border-radius:50%;background:${numBg};display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;gap:2px;padding:8px;box-sizing:border-box;">
                <div style="color:${numColor};font-size:${Math.round(numSize*0.45)}px;font-weight:700;line-height:1;text-align:center">${badgeLabel(i)}</div>
                <div style="color:${numColor};font-size:${innerTitleSz}px;font-weight:600;line-height:1.3;text-align:center;word-break:keep-all;overflow:hidden;">${s.title||''}</div>
              </div>
              ${lineR}
            </div>
            ${s.desc?`<div class="stb-desc" style="font-size:${descSz}px;color:${descColor};margin-top:${badgeGap}px;text-align:center;padding:0 4px">${s.desc}</div>`:''}</div>
          ${useHArrow && !isLast ? hArrowEl(Math.round(circleSize/2)) : ''}`;
      }).join('')
    }</div>`;
    return;
  }

  // ── 번호형 (항상 가로) ────────────────────────────────────────────────────
  if (style === 'number') {
    const bigNum = Math.round(numSize * 1.8);
    block.innerHTML = `<div style="display:flex;flex-direction:row;align-items:flex-start;width:100%;gap:${gap}px;${pxStyle}">${
      steps.map((s, i) => `
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;min-width:0;text-align:center;">
          <div style="font-size:${bigNum}px;font-weight:800;color:${numBg};line-height:1;margin-bottom:${Math.round(gap*0.4)}px">${badgeLabel(i)}</div>
          <div class="stb-title" style="font-size:${titleSz}px;color:${titleColor};line-height:1.4;font-weight:600">${s.title||''}</div>
          ${s.desc?`<div class="stb-desc" style="font-size:${descSz}px;color:${descColor};margin-top:4px">${s.desc}</div>`:''}</div>`).join('')
    }</div>`;
    return;
  }

  // ── default: 가로 모드 ────────────────────────────────────────────────────
  if (orient === 'horizontal') {
    block.innerHTML = `<div style="display:flex;flex-direction:row;align-items:flex-start;width:100%;${pxStyle}">${
      steps.map((s, i) => {
        const isLast = i === steps.length - 1;
        const lineL = connector && !useHArrow ? connectorH(i === 0, 'left') : `<div style="flex:1;visibility:hidden"></div>`;
        const lineR = connector && !useHArrow ? connectorH(isLast, 'right') : `<div style="flex:1;visibility:hidden"></div>`;
        return `
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;min-width:0;">
            <div style="display:flex;align-items:center;width:100%;">
              ${lineL}
              <div style="${badgeStyle()}">${badgeLabel(i)}</div>
              ${lineR}
            </div>
            <div style="text-align:center;padding-top:${Math.round(gap*0.5)}px;padding-left:4px;padding-right:4px;width:100%;box-sizing:border-box;">
              <div class="stb-title" style="font-size:${titleSz}px;color:${titleColor};line-height:1.4">${s.title||''}</div>
              ${s.desc?`<div class="stb-desc" style="font-size:${descSz}px;color:${descColor};margin-top:4px">${s.desc}</div>`:''}</div></div>
          ${useHArrow && !isLast ? hArrowEl(Math.round(numSize/2)) : ''}`;
      }).join('')
    }</div>`;
    return;
  }

  // ── default: 세로 모드 ────────────────────────────────────────────────────
  const titleLineH  = Math.round(titleSz * 1.4);
  const diff        = (titleLineH - numSize) / 2;
  const leftPadTop  = diff > 0 ? Math.round(diff) : 0;
  const contPadTop  = diff < 0 ? Math.round(-diff) : 0;

  const isStackAlign  = align === 'stack';
  const isRightAlign  = align === 'right';
  const isCenterAlign = align === 'center';

  // stack (1×3 세로 쌓기) 또는 right (배지 우측)
  if (isStackAlign || isRightAlign) {
    const flexDir   = isStackAlign ? 'column' : 'row-reverse';
    const textAlign = isStackAlign ? 'center' : 'right';
    const isDividerCA = connector && connectorStyle === 'divider';
    block.innerHTML = `<div style="${pxStyle}">${steps.map((s, i) => {
      const isLast = i === steps.length - 1;
      return `
        <div class="stb-item" style="flex-direction:${flexDir};gap:${badgeGap}px;${isStackAlign ? 'align-items:center;' : 'align-items:flex-start;'}">
          <div class="stb-left" style="padding-top:${isStackAlign ? 0 : leftPadTop}px;align-items:center;">
            <div style="${badgeStyle()}">${badgeLabel(i)}</div>
            ${connector && !isLast && isStackAlign && !isDividerCA ? connectorV() : ''}
          </div>
          <div class="stb-content" style="padding-top:${isStackAlign ? 0 : contPadTop}px;padding-bottom:${isLast ? 0 : (isDividerCA ? 0 : gap)}px;text-align:${textAlign};">
            <div class="stb-title" style="font-size:${titleSz}px;color:${titleColor};line-height:1.4">${s.title||''}</div>
            ${s.desc ? `<div class="stb-desc" style="font-size:${descSz}px;color:${descColor}">${s.desc}</div>` : ''}
          </div>
        </div>
        ${isDividerCA && !isLast ? `<div style="width:100%;height:1px;background:${numBg};opacity:0.2;margin:${Math.round(gap*0.5)}px 0"></div>` : ''}`;
    }).join('')}</div>`;
    return;
  }

  // center: left와 동일한 2컬럼 구조, 전체를 가운데 정렬
  if (isCenterAlign) {
    const isDivider = connector && connectorStyle === 'divider';
    block.innerHTML = `<div style="width:fit-content;margin:0 auto;${pxStyle}">${steps.map((s, i) => {
      const isLast = i === steps.length - 1;
      return `
        <div class="stb-item" style="gap:${badgeGap}px">
          <div class="stb-left" style="padding-top:${leftPadTop}px">
            <div style="${badgeStyle()}">${badgeLabel(i)}</div>
            ${connector && !isLast && !isDivider ? connectorV() : ''}
          </div>
          <div class="stb-content" style="padding-top:${contPadTop}px;padding-bottom:${isLast ? 0 : (isDivider ? 0 : gap)}px">
            <div class="stb-title" style="font-size:${titleSz}px;color:${titleColor};line-height:1.4">${s.title||''}</div>
            ${s.desc ? `<div class="stb-desc" style="font-size:${descSz}px;color:${descColor}">${s.desc}</div>` : ''}
          </div>
        </div>
        ${isDivider && !isLast ? `<div style="width:100%;height:1px;background:${numBg};opacity:0.2;margin:${Math.round(gap*0.5)}px 0"></div>` : ''}`;
    }).join('')}</div>`;
    return;
  }

  // left (기본)
  const isDivider = connector && connectorStyle === 'divider';
  block.innerHTML = `<div style="${pxStyle}">${steps.map((s, i) => {
    const isLast = i === steps.length - 1;
    return `
      <div class="stb-item" style="gap:${badgeGap}px">
        <div class="stb-left" style="padding-top:${leftPadTop}px">
          <div style="${badgeStyle()}">${badgeLabel(i)}</div>
          ${connector && !isLast && !isDivider ? connectorV() : ''}
        </div>
        <div class="stb-content" style="padding-top:${contPadTop}px;padding-bottom:${isLast ? 0 : (isDivider ? 0 : gap)}px">
          <div class="stb-title" style="font-size:${titleSz}px;color:${titleColor};line-height:1.4">${s.title||''}</div>
          ${s.desc ? `<div class="stb-desc" style="font-size:${descSz}px;color:${descColor}">${s.desc}</div>` : ''}
        </div>
      </div>
      ${isDivider && !isLast ? `<div style="width:100%;height:1px;background:${numBg};opacity:0.2;margin:${Math.round(gap*0.5)}px 0"></div>` : ''}`;
  }).join('')}</div>`;
}

function makeStepBlock(opts = {}) {
  const block = document.createElement('div');
  block.className = 'step-block';
  block.id = 'stb_' + Math.random().toString(36).slice(2, 8);
  block.dataset.type       = 'step';
  block.dataset.steps      = JSON.stringify(opts.steps      || STEP_DEFAULT_DATA);
  block.dataset.numBg      = opts.numBg      || '#222222';
  block.dataset.numColor   = opts.numColor   || '#ffffff';
  block.dataset.numSize    = opts.numSize    || 36;
  block.dataset.titleSize  = opts.titleSize  || 36;
  block.dataset.descSize   = opts.descSize   || 24;
  block.dataset.gap        = opts.gap        || 24;
  block.dataset.connector  = opts.connector  !== undefined ? String(opts.connector) : 'true';
  block.dataset.titleColor  = opts.titleColor  || '#222222';
  block.dataset.descColor   = opts.descColor   || '#555555';
  block.dataset.stepStyle      = opts.stepStyle      || 'default';
  block.dataset.stepOrient     = opts.stepOrient     || 'vertical';
  block.dataset.stepAlign      = opts.stepAlign      || 'left';
  block.dataset.stepCardBg     = opts.stepCardBg     || '#f5f5f5';
  block.dataset.stepPadX       = opts.stepPadX       || 0;
  block.dataset.stepPadL       = opts.stepPadL ?? opts.stepPadX ?? 0;
  block.dataset.stepPadR       = opts.stepPadR ?? opts.stepPadX ?? 0;
  block.dataset.badgeFormat    = opts.badgeFormat    || 'number';
  block.dataset.badgeGap       = opts.badgeGap       || 16;
  block.dataset.connectorStyle = opts.connectorStyle || 'line';
  renderStepBlock(block);

  const row = document.createElement('div');
  row.className = 'row';
  row.dataset.layout = 'stack';
  row.appendChild(block);
  return { row, block };
}

function addStepBlock(opts = {}) {
  const sec = window.getSelectedSection?.();
  if (!sec) { window.showNoSelectionHint?.(); return null; }
  window.pushHistory();
  const { row, block } = makeStepBlock(opts);
  insertAfterSelected(sec, row);
  bindBlock(block);
  window.buildLayerPanel();
  // 방금 추가한 블록 자동 선택 + 화면 안으로 스크롤 (C9)
  try { window.selectBlock?.(block.id); } catch (_) {}
  row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  window.triggerAutoSave?.();
  return { row, block };
}

// ── 수정 ────────────────────────────────────────────────────────────────────
// PM의 update_step_block(MCP) → main(_invokeRendererUpdateStepBlock) → 여기.
// banner02 updateBanner02Block 패턴 미러: pushHistory + dataset partial write + renderStepBlock 재렌더 + scheduleAutoSave.
// 지원 필드 (data-* 매핑):
//   - steps: 배열 전체 replace
//   - 색상: numBg, numColor, titleColor, descColor, stepCardBg
//   - 크기: numSize, titleSize, descSize, gap, badgeGap, stepPadX, stepPadL, stepPadR
//   - boolean: connector
//   - enum: stepStyle, stepOrient, stepAlign, badgeFormat, connectorStyle
function updateStepBlock(blockId, partial = {}) {
  if (!blockId) return { ok: false, code: 'NOT_FOUND', message: 'blockId required' };
  const block = document.getElementById(String(blockId));
  if (!block || !block.classList.contains('step-block')) {
    return { ok: false, code: 'NOT_FOUND', message: `step-block not found: ${blockId}` };
  }
  if (partial == null || typeof partial !== 'object') {
    return { ok: false, code: 'INVALID', message: 'partial must be object' };
  }

  // Codex 리뷰 픽스: pushHistory + mutate는 *전체 입력 검증* 후에만 수행.
  // 1단계 — 검증만 (mutate X). 실패 시 noop으로 종료.
  const next = {}; // dataset 키 → string 값 (커밋 전 계산)
  const applied = {};

  if (partial.steps !== undefined && partial.steps !== null) {
    if (!Array.isArray(partial.steps)) {
      return { ok: false, code: 'INVALID', message: 'steps must be array' };
    }
    if (partial.steps.length < 1 || partial.steps.length > 10) {
      return { ok: false, code: 'INVALID', message: 'steps length must be 1..10' };
    }
    const cleaned = partial.steps.map((s) => {
      const t = (s && typeof s.title === 'string') ? s.title : '';
      const d = (s && typeof s.desc === 'string')  ? s.desc  : '';
      return d ? { title: t, desc: d } : { title: t };
    });
    next.steps = JSON.stringify(cleaned);
    applied.steps = cleaned;
  }

  // Codex 리뷰 픽스 (#4): 부분 적용/조용한 drop 제거. 잘못된 값은 즉시 reject.
  // MCP 호출 경로는 _validateStepOpts에서 이미 strict 검증되지만, 직접 호출 경로도 보호.
  let _planErr = null;
  const _planNum = (datasetKey, srcKey, value, min, max) => {
    const n = Number(value);
    if (!Number.isFinite(n) || (min !== undefined && n < min) || (max !== undefined && n > max)) {
      _planErr = `${srcKey} invalid (must be ${min}..${max})`;
      return;
    }
    next[datasetKey] = String(n);
    applied[srcKey] = n;
  };

  if (partial.numSize    !== undefined) _planNum('numSize',    'numSize',    partial.numSize,    4, 400);
  if (partial.titleSize  !== undefined) _planNum('titleSize',  'titleSize',  partial.titleSize,  4, 400);
  if (partial.descSize   !== undefined) _planNum('descSize',   'descSize',   partial.descSize,   4, 400);
  if (partial.gap        !== undefined) _planNum('gap',        'gap',        partial.gap,        0, 400);
  if (partial.badgeGap   !== undefined) _planNum('badgeGap',   'badgeGap',   partial.badgeGap,   0, 400);
  if (partial.stepPadX   !== undefined) _planNum('stepPadX',   'stepPadX',   partial.stepPadX,   0, 400);
  if (partial.stepPadL   !== undefined) _planNum('stepPadL',   'stepPadL',   partial.stepPadL,   0, 400);
  if (partial.stepPadR   !== undefined) _planNum('stepPadR',   'stepPadR',   partial.stepPadR,   0, 400);
  if (_planErr) {
    return { ok: false, code: 'INVALID', message: _planErr };
  }

  if (partial.numBg      !== undefined && partial.numBg      !== null) { next.numBg      = String(partial.numBg);      applied.numBg      = next.numBg; }
  if (partial.numColor   !== undefined && partial.numColor   !== null) { next.numColor   = String(partial.numColor);   applied.numColor   = next.numColor; }
  if (partial.titleColor !== undefined && partial.titleColor !== null) { next.titleColor = String(partial.titleColor); applied.titleColor = next.titleColor; }
  if (partial.descColor  !== undefined && partial.descColor  !== null) { next.descColor  = String(partial.descColor);  applied.descColor  = next.descColor; }
  if (partial.stepCardBg !== undefined && partial.stepCardBg !== null) { next.stepCardBg = String(partial.stepCardBg); applied.stepCardBg = next.stepCardBg; }

  if (partial.connector !== undefined) {
    const v = (partial.connector === true || partial.connector === 'true');
    next.connector = String(v);
    applied.connector = v;
  }

  if (partial.stepStyle      !== undefined) { next.stepStyle      = String(partial.stepStyle);      applied.stepStyle      = next.stepStyle; }
  if (partial.stepOrient     !== undefined) { next.stepOrient     = String(partial.stepOrient);     applied.stepOrient     = next.stepOrient; }
  if (partial.stepAlign      !== undefined) { next.stepAlign      = String(partial.stepAlign);      applied.stepAlign      = next.stepAlign; }
  if (partial.badgeFormat    !== undefined) { next.badgeFormat    = String(partial.badgeFormat);    applied.badgeFormat    = next.badgeFormat; }
  if (partial.connectorStyle !== undefined) { next.connectorStyle = String(partial.connectorStyle); applied.connectorStyle = next.connectorStyle; }

  // 변경 없음 → noop (pushHistory/autosave 스킵)
  if (Object.keys(next).length === 0) {
    return { ok: true, blockId, before: null, applied: {}, noop: true };
  }

  // 2단계 — before 스냅샷 (rollback 대비). next에 든 키만 백업.
  const beforeSnapshot = {};
  const before = {};
  for (const k of Object.keys(next)) {
    beforeSnapshot[k] = block.dataset[k];
    before[k] = block.dataset[k];
  }

  // 3단계 — pushHistory (변경 전 캔버스 = undo 타겟). banner02 패턴과 동일.
  // 주의: render 실패 시 rollback해도 이 history 엔트리는 남음 (no-op undo).
  //       이는 banner02도 동일한 잔존 UX 이슈. _validateStepOpts가 strict이므로
  //       MCP 경로에서 render 실패는 사실상 unreachable.
  window.pushHistory?.();

  // 4단계 — 커밋 (mutate)
  for (const k of Object.keys(next)) {
    block.dataset[k] = next[k];
  }

  // 5단계 — 재렌더 (실패 시 rollback)
  try {
    renderStepBlock(block);
  } catch (e) {
    // rollback dataset (snapshot 기준)
    for (const k of Object.keys(beforeSnapshot)) {
      const v = beforeSnapshot[k];
      if (v === undefined) {
        delete block.dataset[k];
      } else {
        block.dataset[k] = v;
      }
    }
    try { renderStepBlock(block); } catch (_) {}
    return { ok: false, code: 'RENDER_ERROR', message: e.message, rolledBack: true };
  }

  // 6단계 — 우측 패널 / 레이어 / autosave
  if (block.classList.contains('selected')) {
    try { window.showStepProperties?.(block); } catch (_) {}
  }
  try { window.buildLayerPanel?.(); } catch (_) {}

  window.triggerAutoSave?.();

  return { ok: true, blockId, before, applied };
}

// ── window 노출 ────────────────────────────────────────────────────────────
window.makeStepBlock   = makeStepBlock;
window.addStepBlock    = addStepBlock;
window.updateStepBlock = updateStepBlock;
window.renderStepBlock = renderStepBlock;

export { makeStepBlock, addStepBlock, updateStepBlock, renderStepBlock, STEP_DEFAULT_DATA };
