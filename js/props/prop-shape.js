import { propPanel } from '../globals.js';
import { colorFieldHTML, wireColorField, parseAlphaFromColor } from './color-picker.js';
import { svgStopRemap } from './gradient-model.js';

// 캔버스에서 온캔버스 그라데이션 라인을 드래그하면(gradient-line-overlay.js, source==='canvas')
// 모달이 열려 있을 때 스와치 미리보기만 동기화한다. bg 쓰기/재렌더는 이미
// gradient-model.js의 shape-block set()이 처리하므로 여기서 중복 적용하지 않는다(루프 방지).
let _applyingExternalShapeGrad = false;
document.addEventListener('gradient-line:change', (e) => {
  if (e.detail?.source !== 'canvas') return;
  const block = e.target?.closest?.('.shape-block');
  if (!block || !e.detail?.css) return;
  _applyingExternalShapeGrad = true;
  const sw = document.getElementById('shape-color-color')?.closest('.prop-color-swatch');
  if (sw) sw.style.background = e.detail.css; // 모달이 열려 있으면 스와치 미리보기 갱신
  _applyingExternalShapeGrad = false;
});

function rgbToHex(rgb) {
  if (!rgb || rgb === 'transparent') return '#cccccc';
  if (/^#/.test(rgb)) return rgb;
  const m = rgb.match(/\d+/g);
  if (!m || m.length < 3) return '#cccccc';
  return '#' + m.slice(0, 3).map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
}

const SHAPE_ICONS = {
  star:      `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><polygon points="8,2 9.8,6.2 14.5,6.2 10.8,8.9 12.2,13.5 8,10.8 3.8,13.5 5.2,8.9 1.5,6.2 6.2,6.2" fill="#888"/></svg>`,
  rectangle: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="4" width="12" height="8" rx="1" stroke="#888" stroke-width="1.4" fill="none"/></svg>`,
  ellipse:   `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="#888" stroke-width="1.4" fill="none"/></svg>`,
  line:      `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><line x1="2" y1="14" x2="14" y2="2" stroke="#888" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  arrow:     `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><line x1="2" y1="14" x2="14" y2="2" stroke="#888" stroke-width="1.6" stroke-linecap="round"/><polyline points="8,2 14,2 14,8" stroke="#888" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  polygon:   `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><polygon points="8,2 14,12 2,12" stroke="#888" stroke-width="1.4" fill="none" stroke-linejoin="round"/></svg>`,
};
const SHAPE_NAMES = {
  star: 'Star', rectangle: 'Rectangle', ellipse: 'Ellipse',
  line: 'Line', arrow: 'Arrow', polygon: 'Polygon',
};

export function showShapeProperties(block) {
  if (!block) return;

  const shapeType   = block.dataset.shapeType || 'rectangle';
  const rawColor    = block.dataset.shapeColor || '#cccccc';
  // 그라데이션 적용 상태: shapeGradient JSON 존재 또는 shapeColor가 linear-gradient(... CSS
  let gradientMeta = null;
  try { gradientMeta = block.dataset.shapeGradient ? JSON.parse(block.dataset.shapeGradient) : null; } catch (_) {}
  const isGradient  = !!gradientMeta || /gradient/.test(rawColor);
  const gradientCss = isGradient ? rawColor : '';
  // picker/hex 표시용 hex — 그라데이션이면 첫 stop, 아니면 그대로
  // ★shapeColor 에 그라데이션 CSS 가 남았는데 메타가 없으면(이미지 모드 등) 첫 스톱을 모른다 →
  //   회색 기본값 대신 svg 의 마지막 단색으로(0918 picker: 이미지→솔리드 = 마지막 단색)
  const color       = isGradient
    ? (gradientMeta?.stops?.[0]?.color || _lastSolidOf(block) || '#cccccc')
    : rawColor;
  const colorAlpha  = parseAlphaFromColor(color);
  const strokeWidth = parseInt(block.dataset.shapeStrokeWidth || '3');
  const strokeColor = block.dataset.shapeStrokeColor || color;
  const strokeColorAlpha = parseAlphaFromColor(strokeColor);
  const w           = parseInt(block.style.width)  || 100;
  const h           = parseInt(block.style.height) || 100;
  const iconSvg     = SHAPE_ICONS[shapeType] || SHAPE_ICONS.rectangle;
  const shapeName   = SHAPE_NAMES[shapeType] || shapeType;
  const id          = block.id || '';
  // 가림막(redact) — 얼굴/주민번호 등 밑에 깔린 콘텐츠를 backdrop-filter로 흐리는 모드.
  // rect/ellipse만 지원: backdrop-filter는 요소의 border-box(+border-radius)로만 클립되어
  // polygon/star/line/arrow처럼 실제 윤곽이 사각형이 아닌 도형엔 시각적으로 안 맞는다.
  const canRedact   = shapeType === 'rectangle' || shapeType === 'ellipse';
  const isRedact    = canRedact && block.dataset.shapeRedact === 'true';
  const redactBlur  = parseInt(block.dataset.shapeRedactBlur || '8');
  // 모드: 'blur'(기본, backdrop-filter 실시간) | 'mosaic'(스냅샷 픽셀화, js/effects/redact-mosaic.js)
  const redactMode  = block.dataset.shapeRedactMode === 'mosaic' ? 'mosaic' : 'blur';

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">${iconSvg}</div>
        <div class="prop-block-info">
          <span class="prop-block-name">${block.dataset.layerName || shapeName}</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb?.(block) || ''}</span>
        </div>
        ${id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="_copyToClipboard('${id}')">${id}</span>` : ''}
      </div>
    </div>

    ${canRedact ? `
    <div class="prop-section">
      <div class="prop-section-title">가림막 (Redact)</div>
      <div class="prop-row">
        <span class="prop-label">블러로 가리기</span>
        <label class="prop-toggle">
          <input type="checkbox" id="shape-redact-toggle" ${isRedact ? 'checked' : ''}>
          <span class="prop-toggle-track"></span>
        </label>
      </div>
      <div id="shape-redact-controls" style="${isRedact ? '' : 'display:none'}">
        <div class="prop-row" style="margin-top:8px;">
          <span class="prop-label">방식</span>
          <div class="prop-segmented" id="shape-redact-mode-seg">
            <button type="button" class="prop-segmented-btn${redactMode === 'blur' ? ' active' : ''}" data-mode="blur">블러</button>
            <button type="button" class="prop-segmented-btn${redactMode === 'mosaic' ? ' active' : ''}" data-mode="mosaic">모자이크</button>
          </div>
        </div>
        <div class="prop-row" style="margin-top:8px;">
          <span class="prop-label">강도</span>
          <input type="range" class="prop-slider" id="shape-redact-blur-slider" min="2" max="20" step="1" value="${redactBlur}">
          <input type="number" class="prop-number" id="shape-redact-blur-num" min="2" max="20" value="${redactBlur}">
        </div>
        ${redactMode === 'mosaic' ? `
        <button type="button" class="prop-btn" id="shape-redact-mosaic-refresh" style="margin-top:8px;width:100%;">지금 스냅샷 새로고침</button>
        <div class="prop-hint" style="margin-top:4px;">도형을 얼굴·주민번호 등 위에 올리면 그 순간 밑 콘텐츠를 캡처해 픽셀 모자이크로 가립니다. 실시간 추적이 아니라 도형을 옮기거나(이동/리사이즈 종료) 편집을 마칠 때(mouseup) 자동으로 다시 찍습니다 — 안 맞으면 위 버튼으로 즉시 새로고침하세요. 채우기 색상은 무시됩니다.</div>
        ` : `
        <div class="prop-hint" style="margin-top:4px;">도형을 얼굴·주민번호 등 위에 올리면 밑에 깔린 콘텐츠가 실시간으로 흐려집니다. 채우기 색상은 무시됩니다.</div>
        `}
      </div>
    </div>` : ''}

    <div class="prop-section">
      <div class="prop-section-title">Color</div>
      <div class="prop-color-row" id="shape-fill-row" style="${isRedact ? 'display:none' : ''}">
        <span class="prop-label">색상</span>
        ${colorFieldHTML({ idPrefix: 'shape-color', hex: color, alpha: colorAlpha, gradientCss })}
      </div>
      <div class="prop-color-row" style="margin-top:${isRedact ? '0' : '8px'};">
        <span class="prop-label">외곽선</span>
        ${colorFieldHTML({ idPrefix: 'shape-stroke-color', hex: strokeColor, alpha: strokeColorAlpha })}
      </div>
      <div class="prop-row" style="margin-top:8px;">
        <span class="prop-label">두께</span>
        <input type="range" class="prop-slider" id="shape-stroke-slider" min="0" max="20" step="1" value="${strokeWidth}">
        <input type="number" class="prop-number" id="shape-stroke-num" min="0" max="20" value="${strokeWidth}">
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Size</div>
      <div class="prop-row">
        <span class="prop-label">W</span>
        <input type="range" class="prop-slider" id="shape-w-slider" min="10" max="860" step="1" value="${w}">
        <input type="number" class="prop-number" id="shape-w-num" min="10" max="860" value="${w}">
      </div>
      <div class="prop-row">
        <span class="prop-label">H</span>
        <input type="range" class="prop-slider" id="shape-h-slider" min="10" max="860" step="1" value="${h}">
        <input type="number" class="prop-number" id="shape-h-num" min="10" max="860" value="${h}">
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Rotation</div>
      <div class="prop-row">
        <span class="prop-label">회전°</span>
        <input type="range" class="prop-slider" id="shape-rot-slider" min="-180" max="180" step="1" value="${parseInt(block.dataset.shapeRotation || '0')}">
        <input type="number" class="prop-number" id="shape-rot-num" min="-180" max="180" value="${parseInt(block.dataset.shapeRotation || '0')}">
      </div>
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(id || null);

  const svg = block.querySelector('svg');
  // 부모 sub-section (shape frame)
  const ss = block.closest('.frame-block');

  // shape는 section padding을 무시하고 section 전체 폭(최대 860)까지 확장 가능 ───
  // wrap frame의 max-width 제한을 풀고, width가 inner를 넘으면 좌우 균등 음수 margin으로 padding 침범
  function _extendShapeFrameToSection() {
    if (!ss) return;
    const sec = block.closest('.section-block');
    if (!sec) return;
    const inner = sec.querySelector('.section-inner');
    if (!inner) return;
    // max-width / flex shrink 제한 풀기 — 한 번만 적용해도 OK
    if (ss.style.maxWidth !== 'none')   ss.style.maxWidth   = 'none';
    if (ss.style.flexShrink !== '0')    ss.style.flexShrink = '0';
    const innerW = inner.clientWidth;
    const secW = sec.offsetWidth || 860;
    const wrapW = parseFloat(ss.style.width) || parseInt(ss.dataset.width) || ss.offsetWidth || 0;
    if (wrapW > innerW) {
      // wrap이 inner content area를 넘으면 padding 침범 — section 좌/우 끝을 넘지 않게 clamp
      const maxOverflow = (secW - innerW) / 2;
      const half = Math.min((wrapW - innerW) / 2, maxOverflow);
      ss.style.marginLeft  = `-${half}px`;
      ss.style.marginRight = `-${half}px`;
    } else {
      if (ss.style.marginLeft)  ss.style.marginLeft  = '';
      if (ss.style.marginRight) ss.style.marginRight = '';
    }
  }
  _extendShapeFrameToSection();

  // ── 가림막(Redact) ── dataset.shapeColor/shapeGradient는 건드리지 않는다 —
  // 시각효과는 CSS 클래스(.shape-redact)가 fill을 덮어쓰는 방식이라 꺼도 원래 색/그라데이션이
  // 그대로 복원된다(editor-blocks.css 참고).
  // mode: 'blur'(backdrop-filter 실시간) | 'mosaic'(js/effects/redact-mosaic.js 스냅샷 픽셀화)
  function applyRedact(on, blurPx, mode) {
    block.classList.toggle('shape-redact', !!on);
    if (on) {
      block.dataset.shapeRedact = 'true';
      // ★최소 2px — 0(무의미한 흐림)인데 토글만 켜진 채 남는 "가려진 줄 착각" 방지
      //   (적대적 QA 발견, 2026-09-15). 이 함수가 UI 두 컨트롤의 단일 창구다.
      const bp = Math.max(2, Math.min(20, parseInt(blurPx) || 2));
      block.dataset.shapeRedactBlur = String(bp);
      const m = mode === 'mosaic' ? 'mosaic' : 'blur';
      block.dataset.shapeRedactMode = m;
      if (m === 'blur') {
        block.style.setProperty('--redact-blur', `${bp}px`);
      } else {
        block.style.removeProperty('--redact-blur');
        window.captureMosaicSnapshot?.(block, { reuseFullRes: true });
      }
    } else {
      delete block.dataset.shapeRedact;
      delete block.dataset.shapeRedactMode;
      delete block.dataset.mosaicCaptured;
      block.style.removeProperty('--redact-blur');
      block.querySelector(':scope > canvas.redact-mosaic-canvas')?.remove();
    }
    window.scheduleAutoSave?.();
  }
  // 저장된 프로젝트 로드 등으로 dataset과 클래스가 어긋났을 때 방어적으로 동기화
  if (canRedact) {
    block.classList.toggle('shape-redact', isRedact);
    if (isRedact) {
      if (redactMode === 'blur') block.style.setProperty('--redact-blur', `${redactBlur}px`);
      else if (!window.isMosaicCaptured?.(block)) window.captureMosaicSnapshot?.(block);
    }
  }

  const redactToggleEl = document.getElementById('shape-redact-toggle');
  if (redactToggleEl) {
    redactToggleEl.addEventListener('change', () => {
      const on = redactToggleEl.checked;
      applyRedact(on, redactBlur, redactMode);
      const fillRow = document.getElementById('shape-fill-row');
      if (fillRow) fillRow.style.display = on ? 'none' : '';
      const controls = document.getElementById('shape-redact-controls');
      if (controls) controls.style.display = on ? '' : 'none';
      window.pushHistory?.();
    });
  }
  const redactModeSeg = document.getElementById('shape-redact-mode-seg');
  if (redactModeSeg) {
    redactModeSeg.querySelectorAll('.prop-segmented-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const m = btn.dataset.mode;
        if (m === redactMode) return;
        applyRedact(true, redactBlurSliderValue(), m);
        window.pushHistory?.();
        showShapeProperties(block); // 강도 힌트/새로고침 버튼 등 모드별 UI 다시 그림
      });
    });
  }
  function redactBlurSliderValue() {
    const el = document.getElementById('shape-redact-blur-slider');
    return el ? el.value : redactBlur;
  }
  const redactBlurSlider = document.getElementById('shape-redact-blur-slider');
  const redactBlurNum    = document.getElementById('shape-redact-blur-num');
  if (redactBlurSlider && redactBlurNum) {
    redactBlurSlider.addEventListener('input', () => {
      redactBlurNum.value = redactBlurSlider.value;
      applyRedact(true, redactBlurSlider.value, redactMode);
    });
    redactBlurSlider.addEventListener('change', () => window.pushHistory?.());
    redactBlurNum.addEventListener('input', () => {
      // ★최소 2px — 0(사실상 안 가려짐)인데 토글은 "켜짐"으로 남는 걸 막는다
      //   (적대적 QA 발견: 강도 0에서도 토글이 켜져 있어 사용자가 가려졌다고 착각할 위험).
      const v = Math.min(20, Math.max(2, parseInt(redactBlurNum.value) || 2));
      redactBlurSlider.value = v;
      applyRedact(true, v, redactMode);
    });
    redactBlurNum.addEventListener('change', () => window.pushHistory?.());
  }
  const redactMosaicRefreshBtn = document.getElementById('shape-redact-mosaic-refresh');
  if (redactMosaicRefreshBtn) {
    redactMosaicRefreshBtn.addEventListener('click', () => { window.captureMosaicSnapshot?.(block); });
  }

  function applyColor(hex) {
    // perf: 동일 색이면 데이터·DOM 변경 자체를 스킵 → MutationObserver autosave 트리거 회피
    // ★이미지(체커) 모드면 같은 색이라도 빠져나와야 한다(0918 picker: 이미지→솔리드 탭 = 마지막 단색 복귀)
    if (block.dataset.shapeColor === hex && !block.dataset.shapeGradient && !block.dataset.shapeFill) return;
    if (block.dataset.shapeFill) {
      _clearShapeImage(block);
      const inp = document.getElementById('shape-color-color');
      if (inp) delete inp.dataset.cpFill;
    }
    block.dataset.shapeColor = hex;
    if (svg) {
      // 그라데이션이 적용돼 있을 때만 clear 수행 (대부분의 솔리드 드래그에선 no-op이라 skip)
      if (block.dataset.shapeGradient) { _clearShapeGradient(block); window.hideGradientLine?.(block); }
      // svg.style.color 도 값이 같으면 스킵 (실제로 같을 일은 드물지만 안전망)
      if (svg.style.color !== hex) svg.style.color = hex;
    }
    window.scheduleAutoSave?.();
  }

  function applyGradient(detail) {
    if (!svg || !detail) return;
    if (block.dataset.shapeFill) {
      _clearShapeImage(block);
      const inp = document.getElementById('shape-color-color');
      if (inp) delete inp.dataset.cpFill;
    }
    _applyShapeGradient(block, svg, detail);
    block.dataset.shapeColor = detail.css || '';
    block.dataset.shapeGradient = JSON.stringify({
      type: detail.type, angle: detail.angle, stops: detail.stops,
    });
    window.scheduleAutoSave?.();
  }

  function applyStroke(v) {
    block.dataset.shapeStrokeWidth = String(v);
    if (svg) svg.style.strokeWidth = String(v);
    // rectangle/ellipse: inner SVG geometry를 stroke에 맞춰 재계산 (stroke=0이면 풀폭)
    window.refreshShapeInnerSVG?.(block);
    window.scheduleAutoSave?.();
  }

  function applyStrokeColor(c) {
    block.dataset.shapeStrokeColor = c;
    if (svg) svg.style.stroke = c;
    window.scheduleAutoSave?.();
  }

  function applySize(newW, newH) {
    // frame(ss)만 리사이즈 — block/svg는 CSS 100%로 자동 추종
    if (ss) {
      ss.style.width  = `${newW}px`; ss.dataset.width  = String(newW);
      ss.style.height = `${newH}px`; ss.dataset.height = String(newH);
    }
    // 폭이 inner를 넘으면 padding 침범 자동 적용
    _extendShapeFrameToSection();
    // 회전 적용 중이면 frame 잔존 보정만 정리 (크기는 사용자가 지정한 값 그대로 유지)
    const curRot = parseInt(block.dataset.shapeRotation || '0');
    if (curRot !== 0 && typeof _updateFrameForRotation === 'function') {
      _updateFrameForRotation(curRot);
    }
    window.scheduleAutoSave?.();
  }

  // ── 색상 피커 ──
  // 탭 능력 선언 + 재오픈 시드(0918 picker). ★wireColorField 보다 «먼저» — 거기선 비어 있으면 'solid' 로 채운다.
  //   이미지 채우기는 면이 있는 도형만(선·화살표는 fill 이 없어 바둑판을 칠할 면이 없다).
  {
    const inp = document.getElementById('shape-color-color');
    if (inp) {
      const hasFace = !!SHAPE_FACE_TYPES[shapeType];
      inp.dataset.cpModes = hasFace ? 'solid,gradient,image' : 'solid,gradient';
      // 패널을 다시 그리면 native input 이 새로 만들어져 시드가 사라진다 → 블럭 dataset 에서 다시 채운다
      if (block.dataset.shapeGradient) inp.dataset.cpGradient = block.dataset.shapeGradient;
      if (hasFace && block.dataset.shapeFill === 'image') inp.dataset.cpFill = 'image';
    }
  }
  wireColorField('shape-color', {
    initialAlpha: colorAlpha,
    onApply: (c) => applyColor(c),
    onCommit: () => window.pushHistory?.(),
  });

  // ── 외곽선 색상 피커 ──
  wireColorField('shape-stroke-color', {
    initialAlpha: strokeColorAlpha,
    onApply: (c) => applyStrokeColor(c),
    onCommit: () => window.pushHistory?.(),
  });

  // 초기 svg.stroke 동기화 — 첫 mount 시 dataset.shapeStrokeColor가 있으면 즉시 적용
  if (svg && block.dataset.shapeStrokeColor) {
    svg.style.stroke = block.dataset.shapeStrokeColor;
  }

  // ── 그라데이션 이벤트 수신 (color-picker gradient 탭) ──
  // perf: 매 input마다 pushHistory 발생하던 것을 commit 이벤트로 분리.
  // goya-cp:gradient — 라이브 미리보기(매 프레임), pushHistory 호출 안 함.
  // goya-cp:gradient-commit — 사용자 확정(마우스업·select 변경), pushHistory 호출.
  const shapeColorInput = document.getElementById('shape-color-color');
  if (shapeColorInput && !shapeColorInput._gradWired) {
    shapeColorInput._gradWired = true;
    shapeColorInput.addEventListener('goya-cp:gradient', (e) => {
      applyGradient(e.detail);
      // ★재오픈 시드 — color-picker.js openPicker가 이 dataset을 보고 gradient 탭/스톱을
      //   복원한다(wireColorField의 onGradient 경로는 안 타서 여기서 직접 채워야 한다).
      //   적대적 QA(qa-adversarial-gradient) 발견: 없으면 재오픈마다 solid+기본 2스톱으로 리셋.
      if (e.detail) {
        try {
          shapeColorInput.dataset.cpGradient = JSON.stringify({
            type: e.detail.type, angle: e.detail.angle, stops: e.detail.stops,
          });
        } catch (_) {}
      }
      // ★기록은 여기서 하지 않는다 — commit 이면 바로 뒤에 goya-cp:gradient-commit 이 «또» 온다.
      //   전엔 둘 다 pushHistory 해서 커밋 1번에 기록 2개(되돌리기 1번에 아무 변화 없음) — 0918 picker 에서 제거.
      // 팝업 편집 → 캔버스 핸들 각도 재배치 (banner02/comparison과 동일 패턴)
      if (!_applyingExternalShapeGrad) window.showGradientLine?.(block);
    });
    shapeColorInput.addEventListener('goya-cp:gradient-commit', () => {
      window.pushHistory?.();
    });
    // ── 이미지(에셋) 탭 수신 — 0918 picker ──
    //   src 없음(탭만 누름) = 바둑판(체커) 표시 «이미지 넣기 전» 상태. src 있음(업로드) = 이미지 채우기.
    shapeColorInput.addEventListener('goya-cp:image', (e) => {
      const d = e.detail || {};
      if (!svg || !SHAPE_FACE_TYPES[block.dataset.shapeType || 'rectangle']) return;
      // ★그라데이션을 거쳐 왔으면 shapeColor 에 그라데이션 CSS 가 남는다 → «마지막 단색»으로 되돌려 둔다.
      //   안 그러면 패널 재그리기 때 회색(#cccccc)으로 시드돼 솔리드 복귀가 회색이 되고, 피그마 내보내기엔
      //   color 로 'linear-gradient(...)' 문자열이 실린다(이벨류에이터 0918 지적).
      if (/gradient/.test(block.dataset.shapeColor || '')) {
        let meta = null; try { meta = JSON.parse(block.dataset.shapeGradient || 'null'); } catch (_) {}
        block.dataset.shapeColor = _lastSolidOf(block) || meta?.stops?.[0]?.color || '#cccccc';
      }
      if (block.dataset.shapeGradient) { _clearShapeGradient(block); window.hideGradientLine?.(block); }
      delete shapeColorInput.dataset.cpGradient;
      if (d.src) _applyShapeImage(block, d.src, d.fit);
      else _enterShapeChecker(block);
      shapeColorInput.dataset.cpFill = 'image';
      const sw = shapeColorInput.closest('.prop-color-swatch');
      if (sw) sw.style.background = d.src ? `center / cover no-repeat url("${d.src}")` : CHECKER_SWATCH_BG;
      window.scheduleAutoSave?.();
      if (d.commit) window.pushHistory?.();
    });
  }
  // 이미지(체커) 모드 도형은 스와치도 바둑판/사진으로 — 패널을 다시 그려도 «지금 뭐가 칠해졌나»가 보이게
  if (block.dataset.shapeFill === 'image') {
    const sw = document.getElementById('shape-color-color')?.closest('.prop-color-swatch');
    const img = block.querySelector(':scope > .shape-img-fill');
    const src = img ? (img.style.backgroundImage || '') : '';
    if (sw) sw.style.background = src ? `center / cover no-repeat ${src}` : CHECKER_SWATCH_BG;
  }

  // 선택 시 채우기가 그라데이션이면 캔버스 위 그라데이션 라인 표시 (아니면 overlay가 no-op)
  window.showGradientLine?.(block);
  // 0918 canvasgrad: 캔버스 바 ↔ 피커 스탑 양방향 배선 + 재오픈 시드(dataset.cpGradient)
  window.bindGradientLinePicker?.(block, shapeColorInput);

  // ── 스트로크 두께 ──
  const strokeSlider = document.getElementById('shape-stroke-slider');
  const strokeNum    = document.getElementById('shape-stroke-num');
  strokeSlider.addEventListener('input',  () => { strokeNum.value = strokeSlider.value; applyStroke(parseInt(strokeSlider.value)); });
  strokeSlider.addEventListener('change', () => window.pushHistory?.());
  strokeNum.addEventListener('input', () => {
    const v = Math.min(20, Math.max(0, parseInt(strokeNum.value) || 0));
    strokeSlider.value = v; applyStroke(v);
  });
  strokeNum.addEventListener('change', () => window.pushHistory?.());

  // ── 크기 W ──
  const wSlider = document.getElementById('shape-w-slider');
  const wNum    = document.getElementById('shape-w-num');
  wSlider.addEventListener('input',  () => { wNum.value = wSlider.value; applySize(parseInt(wSlider.value), parseInt(hSlider.value)); });
  wSlider.addEventListener('change', () => window.pushHistory?.());
  wNum.addEventListener('input', () => {
    const v = Math.min(860, Math.max(10, parseInt(wNum.value) || 10));
    wSlider.value = v; applySize(v, parseInt(hSlider.value));
  });
  wNum.addEventListener('change', () => window.pushHistory?.());

  // ── 크기 H ──
  const hSlider = document.getElementById('shape-h-slider');
  const hNum    = document.getElementById('shape-h-num');
  hSlider.addEventListener('input',  () => { hNum.value = hSlider.value; applySize(parseInt(wSlider.value), parseInt(hSlider.value)); });
  hSlider.addEventListener('change', () => window.pushHistory?.());
  hNum.addEventListener('input', () => {
    const v = Math.min(860, Math.max(10, parseInt(hNum.value) || 10));
    hSlider.value = v; applySize(parseInt(wSlider.value), v);
  });
  hNum.addEventListener('change', () => window.pushHistory?.());

  // ── 회전 ──
  // 사용자 의도: 회전해도 frame 자체 크기는 변하지 않아야 함.
  // 시각적 잘림은 부모 frame이 overflow:visible 되도록 CSS에서 처리 (회전된 shape를 가진 frame).
  // 이전 시도(boundedW/H minWidth/minHeight 보정)는 사용자가 "크기가 커진다"고 느끼게 했으므로 폐기.
  // 이 함수는 잔존 inline 보정값을 깨끗이 해제하는 용도로만 남긴다 (구버전 데이터 호환).
  function _updateFrameForRotation(_deg) {
    const frame = block.closest('.frame-block');
    if (!frame) return;
    // 이전 버전이 남긴 보정값 정리
    if (frame.style.minHeight) frame.style.removeProperty('min-height');
    if (frame.style.minWidth)  frame.style.removeProperty('min-width');
  }
  // 회전 적용은 공유 함수(applyShapeRotation)로 위임 — 프로퍼티 슬라이더와
  // 코너 회전 핸들(asset-rotate.js)이 동일한 경로를 쓰도록 통일한다.
  function applyRotation(deg) {
    applyShapeRotation(block, deg);
    _updateFrameForRotation(parseInt(block.dataset.shapeRotation || '0'));
  }
  const rotSlider = document.getElementById('shape-rot-slider');
  const rotNum    = document.getElementById('shape-rot-num');
  if (rotSlider && rotNum) {
    rotSlider.addEventListener('input',  () => { rotNum.value = rotSlider.value; applyRotation(rotSlider.value); });
    rotSlider.addEventListener('change', () => window.pushHistory?.());
    rotNum.addEventListener('input', () => {
      const v = Math.min(180, Math.max(-180, parseInt(rotNum.value) || 0));
      rotSlider.value = v; applyRotation(v);
    });
    rotNum.addEventListener('change', () => window.pushHistory?.());
  }
}

window.showShapeProperties = showShapeProperties;

/* ── 공유 회전 적용/동기화 ──
 * 프로퍼티 패널 슬라이더와 코너 회전 핸들(asset-rotate.js의 shape-rotate-zone)이
 * 같은 상태(dataset.shapeRotation + transform:rotate)를 쓰도록 단일 진입점으로 통일.
 * transform 문자열에서 rotate()만 치환 → translate/scale 등 다른 transform 보존.
 */
export function applyShapeRotation(block, deg) {
  if (!block) return;
  const d = Math.max(-180, Math.min(180, parseInt(deg) || 0));
  const existing = block.style.transform || '';
  const stripped = existing.replace(/rotate\([^)]*\)\s*/g, '').trim();
  if (d === 0) {
    // 회전 해제: transform/transform-origin/dataset 잔존을 깨끗이 정리
    block.style.transform = stripped;
    if (!block.style.transform) {
      block.style.removeProperty('transform');
      block.style.removeProperty('transform-origin');
    }
    delete block.dataset.shapeRotation;
  } else {
    block.dataset.shapeRotation = String(d);
    block.style.transform = stripped ? `${stripped} rotate(${d}deg)` : `rotate(${d}deg)`;
    block.style.transformOrigin = 'center center';
  }
  // 구버전이 남긴 frame min-width/height 보정값 정리 (회전 시 크기 불변 정책)
  const frame = block.closest('.frame-block');
  if (frame) {
    if (frame.style.minHeight) frame.style.removeProperty('min-height');
    if (frame.style.minWidth)  frame.style.removeProperty('min-width');
  }
  window.scheduleAutoSave?.();
}
window.applyShapeRotation = applyShapeRotation;

// 핸들 회전 → 프로퍼티 패널 슬라이더/숫자 입력 동기화 (패널은 선택된 shape만 표시)
export function syncShapeRotationUI(deg) {
  const d = Math.max(-180, Math.min(180, Math.round(parseFloat(deg) || 0)));
  const slider = document.getElementById('shape-rot-slider');
  const num    = document.getElementById('shape-rot-num');
  if (slider) slider.value = String(d);
  if (num)    num.value    = String(d);
}
window.syncShapeRotationUI = syncShapeRotationUI;

/* ── SVG 그라데이션 적용 헬퍼 ──
 * shape SVG 내부에 <defs><linearGradient|radialGradient> 를 동적 inject 하고
 * fill 을 url(#id) 로 바꾼다. stroke 는 currentColor 유지.
 * id 는 block.id 기반으로 안정적으로 부여 — outerHTML 직렬화 후 재로드해도 충돌 없음.
 */
function _gradIdFor(block) {
  const base = block.id || 'shp_anon';
  return `grad-${base}`;
}

function _clearShapeGradient(block) {
  if (!block) return;
  const svg = block.querySelector('svg');
  if (!svg) return;
  const id = _gradIdFor(block);
  const def = svg.querySelector(`#${CSS.escape(id)}`);
  if (def) {
    const parentDefs = def.closest('defs');
    def.remove();
    if (parentDefs && !parentDefs.children.length) parentDefs.remove();
  }
  // fill="url(#..)" 인 요소들을 currentColor 로 복귀
  svg.querySelectorAll('[fill^="url(#grad-"]').forEach(el => {
    el.setAttribute('fill', 'currentColor');
  });
  delete block.dataset.shapeGradient;
}

// perf: 그라데이션 라이브 업데이트는 매 프레임 일어남. 기존 코드는 매번
// <linearGradient> 노드를 통째로 제거→재생성하고 모든 fillable에 setAttribute 호출.
// 같은 타입(linear/radial) + 같은 stop 개수가 유지될 때는 stop 요소만 재활용해서
// stop-color/offset 만 갱신하고, fill="url(#...)" 적용은 처음 한 번만 수행.
const SVG_NS = 'http://www.w3.org/2000/svg';
const FILLABLE_SEL = 'rect,ellipse,circle,polygon,path';

function _applyShapeGradient(block, svg, detail) {
  const id = _gradIdFor(block);
  const targetType = detail.type === 'radial' ? 'radialGradient' : 'linearGradient';
  const stops = detail.stops || [];

  let defs = svg.querySelector(':scope > defs');
  if (!defs) {
    defs = document.createElementNS(SVG_NS, 'defs');
    svg.insertBefore(defs, svg.firstChild);
  }
  let gradNode = svg.querySelector(`#${CSS.escape(id)}`);

  // 재사용 조건: 같은 element 이름 + 같은 stop 개수 → 속성·자식 stop 갱신만
  const reuse = gradNode && gradNode.tagName === targetType && gradNode.children.length === stops.length;

  if (!reuse) {
    if (gradNode) gradNode.remove();
    gradNode = document.createElementNS(SVG_NS, targetType);
    gradNode.setAttribute('id', id);
    for (let i = 0; i < stops.length; i++) {
      gradNode.appendChild(document.createElementNS(SVG_NS, 'stop'));
    }
    defs.appendChild(gradNode);
  }

  // 좌표/축 갱신
  if (targetType === 'radialGradient') {
    gradNode.setAttribute('cx', '50%');
    gradNode.setAttribute('cy', '50%');
    gradNode.setAttribute('r', '50%');
  } else {
    const a = ((detail.angle ?? 90) - 90) * Math.PI / 180;
    let x1 = 0.5 - Math.cos(a) * 0.5;
    let y1 = 0.5 - Math.sin(a) * 0.5;
    let x2 = 0.5 + Math.cos(a) * 0.5;
    let y2 = 0.5 + Math.sin(a) * 0.5;
    // 0918 canvasgrad(T-060): 캔버스 바 끝점을 도형 밖으로 끌면 스탑이 0% 미만·100% 초과가 된다.
    // SVG <stop offset> 은 0~1 로 잘리므로 선을 스탑 범위까지 늘리고 offset 을 재매핑(저장값은 그대로).
    const _r = svgStopRemap({ x1, y1, x2, y2 }, stops.map(s => s.offset ?? 0));
    x1 = _r.x1; y1 = _r.y1; x2 = _r.x2; y2 = _r.y2;
    gradNode._offRemap = _r.remap;
    gradNode.setAttribute('x1', x1.toFixed(4));
    gradNode.setAttribute('y1', y1.toFixed(4));
    gradNode.setAttribute('x2', x2.toFixed(4));
    gradNode.setAttribute('y2', y2.toFixed(4));
  }

  // stop 갱신 (같은 값이면 setAttribute 스킵해 mutation 폭주 방지)
  const stopNodes = gradNode.children;
  for (let i = 0; i < stops.length; i++) {
    const s = stops[i];
    const _rm = gradNode._offRemap;
    const off = _rm
      ? (Math.round((((s.offset ?? 0) - _rm.lo) / _rm.span) * 10000) / 100) + '%'
      : Math.round((s.offset ?? 0) * 100) + '%';
    const col = s.color;
    const op = (s.opacity == null) ? '1' : String(Math.max(0, Math.min(1, +s.opacity)));
    const n = stopNodes[i];
    if (n.getAttribute('offset') !== off) n.setAttribute('offset', off);
    if (n.getAttribute('stop-color') !== col) n.setAttribute('stop-color', col);
    if (n.getAttribute('stop-opacity') !== op) n.setAttribute('stop-opacity', op);
  }

  // fill="url(#id)" 는 한 번만 적용 — 같은 url이면 setAttribute 자체를 스킵.
  // querySelectorAll 결과는 라이브가 아니라 매번 새로 만들지만, fillable 셰이프 한 개당
  // 보통 element 수가 적어 cost는 미미. 다만 같은 url이면 노드 mutation 자체 회피.
  const urlVal = `url(#${id})`;
  const nodes = svg.querySelectorAll(FILLABLE_SEL);
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i];
    const f = el.getAttribute('fill');
    if (f === 'none') continue;
    if (f !== urlVal) el.setAttribute('fill', urlVal);
  }
}

window._applyShapeGradient = _applyShapeGradient;
window._clearShapeGradient = _clearShapeGradient;

/* ── 이미지(에셋) 채우기 — 0918 picker ──────────────────────────────────────
 * 상태는 dataset 두 개로만 말한다(클래스 X — section-serialize RUNTIME_MARKER 규약과 안 부딪히고 저장·로드 뒤에도 남는다):
 *   data-shape-fill="image"            이미지 모드(= 칠이 색이 아니라 이미지)
 *   data-shape-image="1"                실제 이미지가 들어 있음(없으면 «넣기 전» = 바둑판)
 * ★바둑판은 «CSS 자리»에 둔다(정본 선례 .asset-block / .cvb-img-empty — editor-blocks.css 주석):
 *   CSS 규칙이 SVG 면을 url(#goya-shape-checker) 로 칠한다. 패턴 정의는 #canvas 밖(body)에 1번만 주입 →
 *   직렬화·내보내기에 안 실린다. export-image 는 clone 에서 data-shape-fill 을 떼서 마지막 단색으로 낸다.
 * ★실제 이미지는 «인라인»(저장·HTML 내보내기에 실려야 하므로): 블럭 직속 div.shape-img-fill 에
 *   background:cover + 도형 모양 clip-path. SVG 면은 inline fill:transparent 로 비워 밑의 사진이 보이게 한다.
 *   (SVG <pattern><image> 는 도형 svg 가 preserveAspectRatio="none" 이라 사진이 늘어나 버려서 쓰지 않는다.)
 * ★svg.style.color(마지막 단색)는 건드리지 않는다 → 외곽선(currentColor)은 그대로, 솔리드 복귀 = 그 색. */
const SHAPE_FACE_TYPES = { rectangle: true, ellipse: true, polygon: true, star: true };
const CHECKER_SWATCH_BG = 'repeating-conic-gradient(#d8d8d8 0% 25%, #f0f0f0 0% 50%) 0 0 / 10px 10px';
// SHAPE_DEFS(block-factory.js) 좌표를 %로 옮긴 것 — polygon: viewBox 200×180, star: 200×190.
const SHAPE_IMG_CLIP = {
  rectangle: '',
  ellipse: 'ellipse(50% 50% at 50% 50%)',
  polygon: 'polygon(50% 4.44%, 97% 95.56%, 3% 95.56%)',
  star: 'polygon(50% 4.21%, 61% 36.84%, 94% 36.84%, 67.5% 57.89%, 77.5% 90.53%, 50% 69.47%, 22.5% 90.53%, 32.5% 57.89%, 6% 36.84%, 39% 36.84%)',
};

/* 도형의 «마지막 단색» — svg.style.color(applyColor 가 쓰고, 그라데이션·이미지 모드는 안 건드림)를
   shapeColor 저장 형식(#rrggbb 또는 rgba(r,g,b,a))으로. 없으면 ''. */
function _lastSolidOf(block) {
  const svg = block && (block.querySelector('svg.shape-svg') || block.querySelector('svg'));
  const v = svg ? (svg.style.color || '') : '';
  if (!v || v === 'currentcolor' || v === 'currentColor') return '';
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
  const m = v.match(/rgba?\(([^)]+)\)/i);
  if (!m) return '';
  const p = m[1].split(',').map(x => x.trim());
  const to = (n) => Math.max(0, Math.min(255, parseInt(n, 10) | 0)).toString(16).padStart(2, '0');
  if (p.length === 4 && parseFloat(p[3]) < 1) return `rgba(${parseInt(p[0], 10)},${parseInt(p[1], 10)},${parseInt(p[2], 10)},${parseFloat(p[3])})`;
  return '#' + to(p[0]) + to(p[1]) + to(p[2]);
}

function _ensureShapeCheckerDefs() {
  if (typeof document === 'undefined' || document.getElementById('goya-shape-checker-defs')) return;
  const holder = document.createElementNS(SVG_NS, 'svg');
  holder.setAttribute('id', 'goya-shape-checker-defs');
  holder.setAttribute('width', '0');
  holder.setAttribute('height', '0');
  holder.setAttribute('aria-hidden', 'true');
  holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;';
  // 8×8 칸 바둑판 — objectBoundingBox 라 도형 크기와 무관하게 칸 수가 같다. 색 = 앱 체커 토큰(#d8d8d8/#f0f0f0).
  holder.innerHTML = `<defs><pattern id="goya-shape-checker" patternUnits="objectBoundingBox" patternContentUnits="objectBoundingBox" width="0.25" height="0.25">
    <rect x="0" y="0" width="0.25" height="0.25" fill="#f0f0f0"/>
    <rect x="0" y="0" width="0.125" height="0.125" fill="#d8d8d8"/>
    <rect x="0.125" y="0.125" width="0.125" height="0.125" fill="#d8d8d8"/>
  </pattern></defs>`;
  (document.body || document.documentElement).appendChild(holder);
}

function _syncShapeImageClip(block) {
  const img = block && block.querySelector(':scope > .shape-img-fill');
  if (!img) return;
  const clip = SHAPE_IMG_CLIP[block.dataset.shapeType || 'rectangle'] || '';
  if (clip) img.style.clipPath = clip; else img.style.removeProperty('clip-path');
}

function _clearShapeImage(block) {
  if (!block) return;
  block.querySelector(':scope > .shape-img-fill')?.remove();
  const svg = block.querySelector('svg.shape-svg') || block.querySelector('svg');
  if (svg && svg.style.fill === 'transparent') svg.style.fill = 'currentColor';
  delete block.dataset.shapeFill;
  delete block.dataset.shapeImage;
}

function _enterShapeChecker(block) {
  _ensureShapeCheckerDefs();
  _clearShapeImage(block);
  block.dataset.shapeFill = 'image';
}

function _applyShapeImage(block, src, fit) {
  if (!block || !src) return;
  _clearShapeImage(block);
  const img = document.createElement('div');
  img.className = 'shape-img-fill';
  img.setAttribute('aria-hidden', 'true');
  const size = fit === 'fit' ? 'contain' : fit === 'tile' ? 'auto' : 'cover';
  const repeat = fit === 'tile' ? 'repeat' : 'no-repeat';
  img.style.cssText = `position:absolute;inset:0;pointer-events:none;z-index:0;background-image:url("${src}");background-size:${size};background-position:center;background-repeat:${repeat};`;
  block.insertBefore(img, block.firstChild);
  _syncShapeImageClip(block);
  const svg = block.querySelector('svg.shape-svg') || block.querySelector('svg');
  if (svg) svg.style.fill = 'transparent';
  block.dataset.shapeFill = 'image';
  block.dataset.shapeImage = '1';
}

_ensureShapeCheckerDefs();
window._clearShapeImage = _clearShapeImage;
window._syncShapeImageClip = _syncShapeImageClip;
