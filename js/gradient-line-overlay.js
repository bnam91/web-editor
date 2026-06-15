// gradient-line-overlay.js — MODULE 2 of "Gradient Annotator"
// Illustrator 식 그라데이션 라인: 배경이 CSS gradient인 블록(banner02 / comparison)을
// 선택했을 때, 캔버스 위 객체에 겹쳐 그려지는 드래그 가능한 라인 + 시작/끝 핸들.
// 핸들을 드래그하면 그라데이션 방향(angle)만 실시간으로 바뀐다(MVP: 각도만 변경).
//
// MODULE 1(props/gradient-model.js)에서 모델 헬퍼를 가져온다. 정적 import가 실패할 수 있는
// 상황(파일 미배포)에 대비해 window.GradientModel을 fallback으로도 사용한다.
import * as _GM from './props/gradient-model.js';

// 모델 헬퍼 해석기 — window.GradientModel 우선, 없으면 정적 import 사용.
function _gm() { return window.GradientModel || _GM || {}; }
const parseGradient   = (css)      => _gm().parseGradient?.(css);
const toCss           = (model)    => _gm().toCss?.(model);
const handlesToAngle  = (p0, p1)   => _gm().handlesToAngle?.(p0, p1);
const angleToHandles  = (deg)      => _gm().angleToHandles?.(deg);

// ── self-contained CSS 주입 ───────────────────────────────────────────────────
(function injectStyle() {
  if (document.getElementById('grad-line-overlay-style')) return;
  const st = document.createElement('style');
  st.id = 'grad-line-overlay-style';
  st.textContent = `
.grad-line-overlay{position:absolute;inset:0;pointer-events:none;z-index:120;overflow:visible;}
/* 라인(막대): 두께는 줌과 무관하게 화면상 1.5px 고정 (--inv-zoom 미러) */
.grad-line{position:absolute;left:0;top:0;height:calc(1.5px * var(--inv-zoom,1));
  background:var(--sel-color,#2d6fe8);transform-origin:0 50%;pointer-events:none;
  box-shadow:0 0 0 calc(0.5px * var(--inv-zoom,1)) rgba(255,255,255,0.5);}
/* 핸들 공통: 화면상 12px 고정, 중심정렬(translate -50%) */
.grad-line-handle{position:absolute;width:calc(12px * var(--inv-zoom,1));
  height:calc(12px * var(--inv-zoom,1));margin-left:calc(-6px * var(--inv-zoom,1));
  margin-top:calc(-6px * var(--inv-zoom,1));pointer-events:auto;box-sizing:border-box;
  background:#fff;border:calc(1.5px * var(--inv-zoom,1)) solid var(--sel-color,#2d6fe8);
  z-index:121;mix-blend-mode:normal;isolation:isolate;}
/* 시작점: 사각형(채워짐) */
.grad-line-start{border-radius:1px;background:var(--sel-color,#2d6fe8);cursor:move;}
/* 끝점: 원형 + 회전을 암시하는 외곽 링 */
.grad-line-end{border-radius:50%;cursor:crosshair;}
.grad-line-end::after{content:'';position:absolute;left:50%;top:50%;
  width:calc(20px * var(--inv-zoom,1));height:calc(20px * var(--inv-zoom,1));
  transform:translate(-50%,-50%);border-radius:50%;
  border:calc(1px * var(--inv-zoom,1)) dashed var(--sel-color,#2d6fe8);
  opacity:0.55;pointer-events:none;box-sizing:border-box;}
`;
  document.head.appendChild(st);
})();

// 타겟 rect(그라데이션이 실제 칠해지는 영역: banner02=블록 전체, comparison=강조 칼럼)을
// 블록 로컬 px 박스로 환산. 캔버스 줌만 보정(블록 로컬 좌표계 = 줌 적용 전 px).
function _computeBox(blockEl, t) {
  const zoom = (window.currentZoom || 100) / 100;
  const cr = t?.rect?.();
  const br = blockEl.getBoundingClientRect();
  if (!cr || !cr.width || !br.width) {
    return { x: 0, y: 0, w: blockEl.offsetWidth || 1, h: blockEl.offsetHeight || 1 };
  }
  return {
    x: (cr.left - br.left) / zoom,
    y: (cr.top  - br.top)  / zoom,
    w: cr.width  / zoom,
    h: cr.height / zoom,
  };
}
function _applyBox(overlay, box) {
  overlay.style.inset = 'auto';
  overlay.style.left   = box.x + 'px';
  overlay.style.top    = box.y + 'px';
  overlay.style.width  = box.w + 'px';
  overlay.style.height = box.h + 'px';
}

// 두 정규화 점(0-1 박스 좌표)으로 라인/핸들을 재배치.
function _placeLine(block, p0, p1) {
  const refs = block._gradLine;
  if (!refs) return;
  const { line, start, end } = refs;
  // 핸들: 오버레이(=타겟 박스) 내 % 위치
  start.style.left = (p0.x * 100) + '%';
  start.style.top  = (p0.y * 100) + '%';
  end.style.left   = (p1.x * 100) + '%';
  end.style.top    = (p1.y * 100) + '%';
  // 라인 길이/각도: 타겟 박스의 로컬 px 크기 기준 (오버레이가 그 박스로 사이즈됨)
  const w = refs.box?.w || block.offsetWidth || 1;
  const h = refs.box?.h || block.offsetHeight || 1;
  const dx = (p1.x - p0.x) * w;
  const dy = (p1.y - p0.y) * h;
  const len = Math.sqrt(dx * dx + dy * dy);
  const ang = Math.atan2(dy, dx) * 180 / Math.PI;
  line.style.left = (p0.x * 100) + '%';
  line.style.top  = (p0.y * 100) + '%';
  line.style.width = len + 'px';
  line.style.transform = `rotate(${ang}deg)`;
}

// angle(deg) → 두 정규화 점. 모델 헬퍼 우선, 없으면 직접 계산(CSS 0deg=위, CW).
function _handlesFor(angle) {
  const hp = angleToHandles(angle);
  if (hp && hp.p0 && hp.p1) return hp;
  // fallback: 중심에서 angle 방향 양 끝(0-1 박스). CSS 0deg=up, 시계방향.
  const rad = (angle - 90) * Math.PI / 180; // 0deg=up 보정
  const cx = 0.5, cy = 0.5, r = 0.5;
  return {
    p0: { x: cx - Math.cos(rad) * r, y: cy - Math.sin(rad) * r },
    p1: { x: cx + Math.cos(rad) * r, y: cy + Math.sin(rad) * r },
  };
}

// 솔리드 배경(파싱 실패)일 때 시각적 시드용 기본 모델 — 쓰기 전엔 set하지 않는다.
function _seedModel(css) {
  let solid = '#ffffff';
  if (css && !/gradient/i.test(css) && /^#|rgb|hsl/i.test(css.trim())) solid = css.trim();
  return {
    type: 'linear', angle: 180,
    stops: [
      { color: solid, offset: 0, opacity: 1 },
      { color: '#000000', offset: 1, opacity: 1 },
    ],
  };
}

function _bindHandleDrag(handle, which, block, target) {
  handle.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    e.stopPropagation();

    const refs = block._gradLine;
    if (!refs) return;
    // 현재 두 정규화 점(드래그 시작 시점 기준)
    let p0 = { ...refs.p0 };
    let p1 = { ...refs.p1 };

    const apply = (commit) => {
      const angle = handlesToAngle(p0, p1);
      // 현재 파싱된 모델의 stops/colors는 보존, angle만 교체(MVP: 각도만 변경)
      const g = refs.model;
      if (typeof angle === 'number' && !Number.isNaN(angle)) g.angle = angle;
      const css = toCss(g);
      if (typeof css === 'string') target.set(css, commit);
      _placeLine(block, p0, p1);
      block.dispatchEvent(new CustomEvent('gradient-line:change', {
        bubbles: true, detail: { css, commit, source: 'canvas' },
      }));
    };

    const onMove = (ev) => {
      // 정규화 좌표는 오버레이(=타겟 박스)의 화면 rect 기준. getBoundingClientRect가
      // 이미 줌·스케일을 모두 반영하므로 별도 줌 보정 불필요.
      const or = (block._gradLine?.overlay || block).getBoundingClientRect();
      const lx = (ev.clientX - or.left) / (or.width  || 1);
      const ly = (ev.clientY - or.top)  / (or.height || 1);
      const nx = Math.max(0, Math.min(1, lx));
      const ny = Math.max(0, Math.min(1, ly));
      if (which === 'start') { p0 = { x: nx, y: ny }; }
      else                   { p1 = { x: nx, y: ny }; }
      refs.p0 = { ...p0 };
      refs.p1 = { ...p1 };
      apply(false);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      apply(true);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

// ── public: showGradientLine ──────────────────────────────────────────────────
function showGradientLine(blockEl) {
  if (!blockEl) return;
  const t = window.getGradientTarget?.(blockEl);
  if (!t) return;

  const css = t.get?.();
  let g = parseGradient(css);
  if (!g) g = _seedModel(css); // 솔리드: 시각 시드만, 쓰기 X

  // 재호출이면 모델/타겟만 갱신하고 핸들 위치 다시 그리기 (중복 오버레이 방지)
  let refs = blockEl._gradLine;
  if (refs && refs.overlay && refs.overlay.isConnected && blockEl.contains(refs.overlay)) {
    refs.model = g;
    refs.target = t;
    refs.box = _computeBox(blockEl, t);
    _applyBox(refs.overlay, refs.box);
    const hp = _handlesFor(g.angle);
    refs.p0 = { ...hp.p0 };
    refs.p1 = { ...hp.p1 };
    _placeLine(blockEl, refs.p0, refs.p1);
    return;
  }

  // 신규 마운트
  const overlay = document.createElement('div');
  overlay.className = 'grad-line-overlay';
  overlay.dataset.gradLine = '1';

  const line = document.createElement('div');
  line.className = 'grad-line';

  const start = document.createElement('div');
  start.className = 'grad-line-handle grad-line-start';
  start.dataset.gradHandle = 'start';

  const end = document.createElement('div');
  end.className = 'grad-line-handle grad-line-end';
  end.dataset.gradHandle = 'end';

  overlay.appendChild(line);
  overlay.appendChild(start);
  overlay.appendChild(end);
  blockEl.appendChild(overlay); // blockEl은 이미 position:relative

  const box = _computeBox(blockEl, t);
  _applyBox(overlay, box);

  const hp = _handlesFor(g.angle);
  refs = blockEl._gradLine = {
    overlay, line, start, end,
    model: g, target: t, box,
    p0: { ...hp.p0 }, p1: { ...hp.p1 },
  };

  _bindHandleDrag(start, 'start', blockEl, t);
  _bindHandleDrag(end, 'end', blockEl, t);
  _placeLine(blockEl, refs.p0, refs.p1);
}

// ── public: hideGradientLine ──────────────────────────────────────────────────
function hideGradientLine(blockEl) {
  const clear = (b) => {
    b.querySelectorAll(':scope > .grad-line-overlay').forEach(o => o.remove());
    delete b._gradLine;
  };
  if (blockEl) { clear(blockEl); return; }
  document.querySelectorAll('.grad-line-overlay').forEach(o => {
    const host = o.parentElement;
    o.remove();
    if (host) delete host._gradLine;
  });
}

window.showGradientLine = showGradientLine;
window.hideGradientLine = hideGradientLine;

export { showGradientLine, hideGradientLine };
