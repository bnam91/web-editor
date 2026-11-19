/* slide-block.js — 슬라이드 블럭(사진·카드 여러 장 + 움직임) · 0.9.13 MOTION-SLIDE-BLOCK-01(현빈 261116 · 설계 DESIGN-ty-0913-motion-261116.md · 지디 GO)
 *   ★본 = cert-block.js(가장 최근 새 블럭 · 같은 등록 길): 데이터 = dataset 하나(저장 = outerHTML) · 그림은 renderSlideBlock 이 매번 다시(로드·⌘Z·붙여넣기 = save-load.js RERENDER_KINDS)
 *   ★현빈 결정: 움직임 설정 입구 = «GIF 버튼 → GIF 패널» 하나(animation-engine.js 가 블럭 종류로 효과 목록을 바꿈) · 오른쪽 패널(prop-slide.js) = 내용만(사진·카드 폭·간격·높이)
 *   데이터: data-slides='[{"src":…}]'(≤12) · data-slide-layout='{"cardW","gap","h"}'(기본이면 키 없음) · data-anim-fx(slide-flow|slide-swipe|slide-vflow|slide-vstep) · data-anim-slide='{"dir","dwell","speed"}'(기본이면 키 없음)
 *   정적 «첫 장면» = .sld-track flex 줄(<img> · 인라인 꼴) — PNG/HTML/Figma 가 이걸 찍는다 · 움직임은 캔버스 재생(#canvas 밖 덮개)과 GIF 에서만.
 *   ⛔그림 주소 = data:image/ · goya-asset: 만(https 는 캔버스 오염 — 안 받음).
 *   ★캔버스에 그릴 그림 = assets:readAsDataUri IPC 로 받은 data URL(goya-asset 을 캔버스에 바로 그리면 오염 가능 — crossOrigin/corsEnabled 로 풀지 않는다 · 지디 261116).
 *   ★추가 메뉴(#fp-add-slide) 노출 = GIF 와 같은 규칙(animGifVisible · 관리자 · 지디 결정 ⓐ) — «공개 범위»일 뿐 접근통제 아님(feature-flags.js 머리말).
 */
import { genId, insertAfterSelected } from '../drag-utils.js';
import { prepareCloneForCapture, renderComponentsInClone, captureCloneToCanvas, isNativeCapture, sectionBgColor } from '../io/export-image.js';   // 프레임 칸 찍기 = grid-step stepPrepare 와 같은 길(③ 새 엔진 0)
import { withGuideOff } from '../io/capture-safety.js';
import { gridPlusLayer } from './grid-block.js';   // SLIDE-CANVAS-PLUS-ADD-CELL-01 — 캔버스 ＋ 는 그리드 ＋ 층(#grd-plus-layer)을 빌린다(line-host 선례 · 블럭 DOM·저장·PNG 에 안 샘)
import { bindBlock } from '../drag-drop.js';
import {
  SLIDE_FX, SLIDE_MAX, SLIDE_LAYOUT_DEFAULT, SLIDE_ANIM_DEFAULT, normLayout, normAnim, diffFromDefault,
  slideGeom, loopSec, slideOffset, gifPlan, slideInfoText, drawSlides, slideAxis, normCardW, normCardH, normRadius, CELL_SHADOWS, slideInPlace, inPlaceState, drawInPlace, slideCentered, centerState, centerTrackShift, slideWipe, wipePos, drawWipe, WIPE_LINE, WIPE_KNOB, WIPE_LINE_W, WIPE_KNOB_R, TRAIL_N, TRAIL_DT, TRAIL_A, slideGridZoom, gridZoomFrame, drawGridZoom,
  DOT_D, DOT_GAP, dotBand, drawDots, slideActiveIndex,
} from '../fx/slide-motion.js';
/* SLIDE-INDICATOR-DOTS-01 — 점 띠(위/아래 · 가로 효과만). 첫 장면 = 블럭 안 .sld-dots 하나(칸·카드와 따로 · 프레임 모드에서도 이 요소만 다룬다) · GIF = drawDots(같은 자·색).
   점이 켜지면 트랙이 띠만큼 줄어든다(카드 높이 = 블럭 − 띠) — GIF 도 같은 띠를 비우고 그린다. */
const _dotsPos = (layout, vert, fx) => (!vert && !slideWipe(fx) && !slideGridZoom(fx) && (layout.dots === 'top' || layout.dots === 'bottom') ? layout.dots : null);   // 전후 비교엔 점 없음
/* 전후 비교 첫 장면 — 카드(칸)를 블럭 꽉 겹침(첫째 위 · clip 왼쪽 50%) · 셋째부터 숨김 · 나눔선 .sld-wipe(가운데) — 스타일·이 요소만(칸 자식 무접촉) */
/* 격자 줌아웃 첫 장면 = 히어로만(첫째 카드/칸 가운데 · 나머지 숨김 · 스타일만) = GIF t=0 */
function _renderHero(track, kids, on) {
  if (!on) return;
  track.style.justifyContent = 'center';
  kids.forEach((c, i) => { if (i > 0) c.style.display = 'none'; });
}
function _renderWipe(block, kids, on) {
  let el = block.querySelector(':scope > .sld-wipe');
  if (!on || kids.length < 2) { el?.remove(); return false; }
  kids.forEach((c, i) => Object.assign(c.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', flex: 'none', zIndex: i === 0 ? '1' : '0', clipPath: i === 0 ? 'inset(0 50% 0 0)' : '', display: i > 1 ? 'none' : '' }));
  if (!el) { el = document.createElement('div'); el.className = 'sld-wipe'; block.appendChild(el); }
  el.style.cssText = `position:absolute;top:0;bottom:0;left:50%;width:${WIPE_LINE_W}px;transform:translateX(-50%);background:${WIPE_LINE};z-index:2;pointer-events:none;`;
  el.innerHTML = `<span style="position:absolute;left:50%;top:50%;width:${WIPE_KNOB_R * 2}px;height:${WIPE_KNOB_R * 2}px;border-radius:50%;background:${WIPE_KNOB};transform:translate(-50%,-50%);"></span>`;
  return true;
}
const _trackBox = (pos, layout) => (pos ? `height:calc(100% - ${dotBand(layout)}px);margin-${pos}:${dotBand(layout)}px;` : 'height:100%;');   // 띠 = 칸↔점 갭 × 2 + 점(SLIDE-DOTS-SPACING-01)
const _dotOpt = (layout) => ({ band: dotBand(layout), space: layout.dotSpace, on: layout.dotOn, off: layout.dotOff });
function _renderDots(block, n, pos, active = 0, layout = readSlideState(block).layout) {   // active = 첫 장면의 앞 카드(가운데 캐러셀 = 둘째)
  let el = block.querySelector(':scope > .sld-dots');
  if (!pos) { el?.remove(); return; }
  if (!el) { el = document.createElement('div'); el.className = 'sld-dots'; block.appendChild(el); }
  const o = _dotOpt(layout);
  el.style.cssText = `--sld-dot-on:${o.on};--sld-dot-off:${o.off};position:absolute;left:0;right:0;${pos}:0;height:${o.band}px;box-sizing:border-box;padding-${pos}:${DOT_GAP}px;display:flex;align-items:${pos === 'top' ? 'flex-start' : 'flex-end'};justify-content:center;gap:${o.space}px;pointer-events:none;`;   // 점 = 바깥 여백(고정) 안쪽 · 나머지 띠 = 칸↔점 갭(137 · drawDots 와 같은 자리)
  el.replaceChildren(...Array.from({ length: n }, (_, i) => { const d = document.createElement('span'); d.style.cssText = `width:${DOT_D}px;height:${DOT_D}px;border-radius:50%;background:${i === active ? o.on : o.off};`; return d; }));
  if (block.scrollLeft > 0) _syncHScrollDots(block);   // 138 — 밀린 채 다시 그리면 점 표식을 다시 씌움
}
/** 저장 꼴 한 장 — {src} + (칸별 폭이 있으면) w(% · SLIDE-CELL-SIZE-EACH-01). */
const _slideOut = (s) => { const w = normCardW(s.w); return w === undefined ? { src: s.src } : { src: s.src, w }; };

const slideImgOk = (s) => typeof s === 'string' && s.length <= 8_000_000 && /^(data:image\/(png|jpe?g|webp|gif);base64,|goya-asset:\/\/)/i.test(s);
const _json = (s, d) => { try { const v = JSON.parse(s || ''); return v ?? d; } catch (_) { return d; } };

export function readSlideState(block) {
  const d = block.dataset;
  const raw = _json(d.slides, []);
  const slides = (Array.isArray(raw) ? raw : []).slice(0, SLIDE_MAX).filter((s) => slideImgOk(s?.src)).map(_slideOut);
  return {
    slides,
    layout: normLayout(_json(d.slideLayout, {})),
    fx: SLIDE_FX.includes(d.animFx) ? d.animFx : SLIDE_FX[0],
    anim: normAnim(_json(d.animSlide, {})),
  };
}
const _setJsonKey = (block, key, obj) => { if (Object.keys(obj).length) block.dataset[key] = JSON.stringify(obj); else delete block.dataset[key]; };
/** 사진 목록을 고쳐 쓰고 다시 그린다(패널 공용 · 저장소 = dataset.slides 하나). */
export function setSlideList(block, slides) {
  if (isFrameSlide(block)) return;   // 적대 리뷰 [중간3] — 프레임 모드 정본은 DOM · dataset.slides 에 쌓으면 화면 변화 0 인 숨은 데이터(base64)만 는다
  block.dataset.slides = JSON.stringify(slides.filter((s) => slideImgOk(s?.src)).slice(0, SLIDE_MAX).map(_slideOut));
  renderSlideBlock(block);
}
/** SLIDE-SCRATCH-DND-01 — 그림 한 장을 슬라이드 «끝»에 붙인다(스크래치 끌어 놓기 입구). 이력은 부르는 쪽(scratch-pad onUp)이 한 걸음으로.
 *  가득(SLIDE_MAX) · 받지 않는 주소(slideImgOk)면 안 붙이고 말한다 → false. */
export function appendSlideImage(block, src) {
  if (isFrameSlide(block)) return false;   // 적대 리뷰 [중간3] — 프레임 모드는 칸에 넣는다(appendSlideCellImage)
  const { slides } = readSlideState(block);
  if (slides.length >= SLIDE_MAX) { window.showToast?.(`슬라이드는 ${SLIDE_MAX}장까지예요`); return false; }
  if (!slideImgOk(src)) { window.showToast?.('이 그림은 슬라이드에 넣을 수 없어요(PNG·JPG·WebP·GIF)'); return false; }
  setSlideList(block, [...slides, { src }]);
  return true;
}
export function setSlideLayout(block, patch) {
  const L = normLayout({ ...readSlideState(block).layout, ...patch });
  _setJsonKey(block, 'slideLayout', diffFromDefault(L, SLIDE_LAYOUT_DEFAULT));
  renderSlideBlock(block);
}
/** 움직임 값(GIF 패널) — 바뀌었으면 true(부르는 쪽이 이력 한 칸). */
export function setSlideAnim(block, patch) {
  const before = block.dataset.animSlide ?? null;
  _setJsonKey(block, 'animSlide', diffFromDefault(normAnim({ ...readSlideState(block).anim, ...patch }), SLIDE_ANIM_DEFAULT));
  return (block.dataset.animSlide ?? null) !== before;
}
export const slideHasPhotos = (block) => (isFrameSlide(block) ? slideCells(block).length > 0 : readSlideState(block).slides.length > 0);   // 프레임 모드 = 칸 하나라도(빈 칸도 GIF 됨)

/* ── SLIDE-CELL-AS-FRAME-01(현빈 261118 · PLAN-ty-slide-frame-cells-261118) — 칸 = 프레임 ─────────────────────────
 *   블럭 단위 두 갈래 · 마이그레이션 0:
 *     data-cell-mode 없음 = 옛 «사진 모드»(정본 = dataset.slides · 아래 renderSlideBlock 옛 갈래 그대로 · 저장본 바이트 무변)
 *     data-cell-mode="frame" = «프레임 모드»(정본 = DOM: .sld-track > .frame-block.sld-cell 의 자식들)
 *   ★프레임 모드 렌더는 «짓지 않고 배치만» — 트랙·칸 스타일만 다시 쓰고 칸 «자식»은 읽지도 쓰지도 않는다
 *     (로드·⌘Z·붙여넣기·패널 값 바꿈이 전부 renderSlideBlock 을 타므로 replaceChildren 이면 칸 안 블럭이 사라진다 = 1순위 위험).
 *   칸 = makeFrameBlock() 그대로 + 표식 data-sld-cell · 칸 배치 모드 = data-cell-layout(지금 'free' = 프레임 기본 자유배치 · Q2 현빈 답 전 안전값 · 흐름으로 바꿔도 저장 꼴 유지)
 *   칸 폭 = 칸 data-w(%) · 없으면 공통 cardW(CELL-SIZE-EACH 와 같은 뜻). */
export const isFrameSlide = (block) => block?.dataset?.cellMode === 'frame';
export const slideCells = (block) => [...(block?.querySelectorAll(':scope > .sld-track > .sld-cell') || [])];
/** 빈 칸 하나 — 프레임 블럭 기본 꼴(⑤ 재사용) + 칸 표식. 크기는 renderSlideBlock 이 트랙에 맞춰 덮는다(px 고정 걷음). */
/** SLIDE-CELL-AS-FRAME-01 커밋 5 — 옛 사진 모드 → 프레임 모드(Q1: «누를 때만» · 열 때 자동 변환 0).
 *  사진 i → 칸 i 안에 그 사진 에셋 블럭 하나(칸 꽉 · cover) · 칸 폭 = 그 사진 w(있으면) · 사진 0장이면 빈 칸 3 · dataset.slides 는 걷음(정본이 DOM 으로 옮겨감).
 *  에셋은 makeAssetBlock + setAssetImageFromSrc 로 «직접» 짓는다(addAssetBlock 은 장마다 이력을 쌓는다) ⇒ 이력은 부르는 쪽(패널 commit) 한 칸 = ⌘Z 한 번에 사진 모드로. */
export function convertSlideToFrames(block) {
  if (!block || isFrameSlide(block)) return false;
  const { slides } = readSlideState(block);
  const track = document.createElement('div');
  track.className = 'sld-track';
  const cells = (slides.length ? slides : [null, null, null]).map((s) => {
    const c = makeSlideCell();
    if (s?.w !== undefined) c.dataset.w = String(s.w);
    if (s) appendSlideCellImage(c, s.src);   // 칸 꽉 에셋 한 벌(스크래치 끌어 놓기와 같은 자)
    track.appendChild(c);
    return c;
  });
  delete block.dataset.slides;
  block.dataset.cellMode = 'frame';
  block.replaceChildren(track);   // 옛 사진 카드(.sld-card) → 칸 트랙 — 바꾸는 «이 한 번»만 짓는다(이후 렌더는 배치만)
  renderSlideBlock(block);
  cells.forEach((c) => window.bindFrameDropZone?.(c));
  return true;
}

/** 칸 안에 그림 하나 — 칸 꽉(왼위 0 · 100%×100% · cover). 에셋은 직접 짓는다(addAssetBlock 은 이력을 쌓는다) ⇒ 이력은 부르는 쪽(스크래치 onUp) 한 칸.
 *  적대 리뷰 [중간3] 의 빈자리 — 프레임 모드 슬라이드 위 스크래치 끌어 놓기 = 놓은 칸에(옛 판 = 숨은 data-slides 에 쌓임). */
export function appendSlideCellImage(cell, src) {
  if (!cell || cell.dataset.sldCell !== '1' || !slideImgOk(src) || !window.makeAssetBlock) return false;
  const { block: ab } = window.makeAssetBlock();
  Object.assign(ab.style, { position: 'absolute', left: '0px', top: '0px', width: '100%', height: '100%' });
  Object.assign(ab.dataset, { offsetX: '0', offsetY: '0', fit: 'cover', usePadx: 'false' });
  cell.appendChild(ab);
  window.setAssetImageFromSrc?.(ab, src);
  bindBlock(ab); ab.setAttribute('draggable', 'false');
  return true;
}

/** SLIDE-CANVAS-PLUS-ADD-CELL-01 — 칸 하나를 «내용째» 복사해 바로 뒤에(고른 칸 · 없으면 마지막 칸) · 새 칸·안쪽 id 전부 새로 · 이력은 부르는 쪽(한 칸).
 *  ⚠️안쪽 svg 의 url(#id) 같은 참조는 따라 바꾸지 않는다(id 만 새로) — shortcut: 칸 안 그라데이션 svg 가 원본 정의를 가리킬 수 있음, 보이면 그때 참조도 다시 매김. */
export function duplicateSlideCell(block, src) {
  const cells = slideCells(block);
  if (cells.length >= SLIDE_MAX) return null;
  const from = src && cells.includes(src) ? src : cells[cells.length - 1];
  if (!from) return null;
  const c = from.cloneNode(true);
  [c, ...c.querySelectorAll('[id]')].forEach((el) => { el.id = genId(String(el.id).split('_')[0] || 'el'); });
  [c, ...c.querySelectorAll('.selected')].forEach((el) => el.classList.remove('selected'));
  from.after(c);
  renderSlideBlock(block);
  [c, ...c.querySelectorAll('.frame-block')].forEach((f) => window.bindFrameDropZone?.(f));
  if (typeof window.SECTION_BLOCK_TYPE_SEL === 'string') c.querySelectorAll(window.SECTION_BLOCK_TYPE_SEL).forEach((b) => bindBlock(b));
  return c;
}
/** 고른 칸(그 칸 또는 그 칸 안 블럭이 골라짐) · 없으면 null */
const _pickedCell = (block) => slideCells(block).find((c) => c.classList.contains('selected') || c.querySelector('.selected')) || null;

/* SLIDE-TEMP-HSCROLL-FIX-EXPORT-01(현빈 피드백 2 ⑤) — 첫 장면을 가로로 «잠깐» 밀어 보기 + «스크롤 고정».
   ★임시 = 슬라이드 블럭의 scrollLeft(overflow hidden 이어도 JS 로 민다) — scrollLeft 는 outerHTML·클론에 안 실린다 ⇒ 저장·PNG·HTML·Figma 흔적 0(지우는 일 없이).
   ★고정 = data-scroll-x(px · 블럭 기준) → 첫 장면 트랙 translateX(−x) ⇒ 저장·캡처 클론·Figma(살아 있는 칸 자리)가 그 자리를 찍는다 · 고정 끄면 키 지움.
   막대 = ＋ 층의 가로 range(고른 슬라이드 · 트랙이 블럭보다 넓고 접혔을 때) · 정적 꼴(가운데 캐러셀·제자리·전후 비교·격자·세로)엔 안 씀. */
const _fixedX = (block) => { const v = Math.round(+block.dataset.scrollX); return Number.isFinite(v) && v > 0 ? v : 0; };
const _scrollMax = (block) => { const t = block.querySelector(':scope > .sld-track'); if (!t) return 0; const last = t.lastElementChild; return last ? Math.max(0, Math.round(last.offsetLeft + last.offsetWidth - block.clientWidth)) : 0; };
/** 고정 켜기(지금 임시 자리를 굳힘)/끄기 — 이력은 부르는 쪽. */
export function setSlideScrollFix(block, on) {
  if (!block) return;
  if (on) { const x = _fixedX(block) || Math.round(block.scrollLeft); block.scrollLeft = 0; if (x > 0) block.dataset.scrollX = String(x); else delete block.dataset.scrollX; }
  else { const x = _fixedX(block); delete block.dataset.scrollX; renderSlideBlock(block); block.scrollLeft = x; return; }
  renderSlideBlock(block);
}
/* SLIDE-DOTS-FIXED-ON-SCROLL-01(138 · 현빈 5차 (e)) — 임시 가로 밀기(scrollLeft) 동안 점 띠는 블럭 창에 고정 · 지금 보이는 칸(왼끝이 창 왼끝 이하인 마지막 칸) 점만 진하게.
   표식 = 블럭 .sld-hs · 점 .sld-dot-hs-on(저장 section-serialize·캡처 capture-safety 명부가 걷는다 ⇒ PNG·GIF·HTML·저장 = 늘 첫 장면 점 · 무변).
   밀린 거리 = 블럭 인라인 --sld-hs-x(그 표식 없으면 아무 일 안 함 · 0 이면 지운다). «스크롤 고정»(data-scroll-x · 산출물)은 안 건드린다. */
function _syncHScrollDots(block) {
  if (block.classList.contains('sld-unfold')) return;   // 139 — 펼친 동안은 들어갈 때 쥔 자리 그대로(펼침이 scrollLeft 를 0 으로 만든 scroll 사건에 안 지운다)
  const x = Math.round(block.scrollLeft), dots = block.querySelector(':scope > .sld-dots');
  block.classList.toggle('sld-hs', x > 0 && !!dots);
  dots?.querySelectorAll('.sld-dot-hs-on').forEach((d) => d.classList.remove('sld-dot-hs-on'));
  if (x <= 0 || !dots) { block.style.removeProperty('--sld-hs-x'); return; }
  block.style.setProperty('--sld-hs-x', `${x}px`);
  let k = 0;
  [...(block.querySelector(':scope > .sld-track')?.children || [])].forEach((c, i) => { if (c.offsetLeft <= x + 1) k = i; });
  dots.children[k]?.classList.add('sld-dot-hs-on');
}
let _sldS = null;
function _makeScrollBar(block) {
  const r = document.createElement('input');
  r.type = 'range'; r.className = 'sld-hscroll'; r.min = '0'; r.step = '1'; r.title = '가로로 밀어 보기(임시 · «스크롤 고정» 켜면 그 자리로 내보냄)';
  r.style.cssText = 'position:absolute;pointer-events:auto;transform:translate(0,-50%);accent-color:var(--ui-accent-primary);';
  r.addEventListener('mousedown', (e) => e.stopPropagation());
  r.addEventListener('input', () => {
    const v = +r.value;
    if (_fixedX(block)) { block.dataset.scrollX = String(v); renderSlideBlock(block); }   // 고정 중 = 고정 값을 옮김
    else block.scrollLeft = v;   // 임시(저장 흔적 0)
  });
  r.addEventListener('change', () => { if (_fixedX(block)) { window.pushHistory?.('슬라이드 스크롤 고정'); window.scheduleAutoSave?.(); } });
  return r;
}

/* SLIDE-CLICK-SELECT-DBL-UNFOLD-01 — 펼침 켜기/끄기(.sld-unfold · 편집 상태 · 저장·캡처 명부가 걷음).
   두 번 누름(슬라이드 위 어디든 — 접힌 동안 칸은 포인터를 안 받아 슬라이드가 받는다) = 펼침 · Esc · 캔버스에서 그 슬라이드 밖 누름 = 접힘. */
export function unfoldSlide(block, on = true) {
  if (!block || !isFrameSlide(block)) return;
  if (on) document.querySelectorAll('#canvas .slide-block.sld-unfold').forEach((b) => { if (b !== block) unfoldSlide(b, false); });
  /* SLIDE-ENTER-KEEP-HSCROLL-01(139 · 현빈 5차 (f)) — 펼침은 overflow visible 이라 scrollLeft 가 0 으로 돌아간다 ⇒ 들어갈 때 밀린 거리를 쥐고
     펼친 동안 트랙을 그만큼 왼쪽으로(css .sld-unfold.sld-hs · 138 과 같은 표식·변수 — 저장·캡처 명부가 걷는다) · 나올 때 scrollLeft 로 되돌림. */
  if (on && !block.classList.contains('sld-unfold')) {
    const x = Math.round(block.scrollLeft);
    block._sldHoldX = x;
    block.classList.add('sld-unfold');
    if (x > 0) { block.classList.add('sld-hs'); block.style.setProperty('--sld-hs-x', `${x}px`); }
  } else if (!on && block.classList.contains('sld-unfold')) {
    const x = block._sldHoldX || 0;
    block._sldHoldX = 0;
    block.classList.remove('sld-unfold');
    if (x > 0) block.scrollLeft = x;
    _syncHScrollDots(block);
  }
  kickSlidePlus();
}
const _unfolded = () => document.querySelector('#canvas .slide-block.sld-unfold');
if (typeof document !== 'undefined') {
  document.addEventListener('dblclick', (e) => {
    const b = e.target.closest?.('#canvas .slide-block[data-cell-mode="frame"]');
    if (!b || b.classList.contains('sld-unfold')) return;
    e.preventDefault(); e.stopPropagation();
    window.selectBlock?.(b.id);
    unfoldSlide(b, true);
  }, true);
  /* SLIDE-ENTER-EXIT-DIM-01(140 · 현빈 5차 (g)) — 빈 영역 두 번 누름 = 나옴: 펼친 슬라이드 안 «칸 밖»(트랙 틈·점 띠·바탕) 또는 캔버스 밖 회색(#canvas-wrap 안 · #canvas 밖).
     칸 안 두 번 누름은 그대로(칸 안 편집 진입). 다른 섹션 위는 mousedown(아래)이 이미 접는다. */
  document.addEventListener('dblclick', (e) => {
    const b = _unfolded(); if (!b) return;
    const t = e.target;
    const inSlide = b.contains(t), inCell = !!t.closest?.('.sld-cell');
    const outsideCanvas = !!t.closest?.('#canvas-wrap') && !t.closest?.('#canvas');
    if ((inSlide && !inCell) || outsideCanvas) { e.preventDefault(); e.stopPropagation(); unfoldSlide(b, false); }
  }, true);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const b = _unfolded(); if (!b) return;
    const a = document.activeElement; if (a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return;   // 글 고치는 중 Esc 는 글이 먼저
    unfoldSlide(b, false);
  }, true);
  document.addEventListener('mousedown', (e) => {
    const b = _unfolded(); if (!b) return;
    if (!e.target.closest?.('#canvas') || b.contains(e.target)) return;   // 패널·＋ 층·스크래치 누름은 그대로 · 캔버스의 그 슬라이드 밖만
    unfoldSlide(b, false);
  }, true);
}

/* 캔버스 ＋ — 프레임 칸 슬라이드를 고른 동안(펼침과 같은 조건) 트랙 끝(마지막 칸 오른쪽 · 세로면 아래)에 하나.
   누르면 고른 칸(없으면 마지막)을 내용째 복사 · 이력 한 칸 · 새 칸 고름. 자리 맞춤은 rAF(고른 동안만 돈다 · 클릭/패널이 깨운다). */
const SLD_ADD_CLS = 'sld-add-btn';
let _sldPlus = null, _sldRaf = 0;
const _activeFrameSlide = () => document.querySelector('#canvas .slide-block[data-cell-mode="frame"]:is(.selected, :has(.selected))');
function _makeSlidePlus(block) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = SLD_ADD_CLS;
  btn.dataset.sldFor = block.id || '';
  btn.title = '칸 추가(고른 칸을 내용째 복사)';
  btn.setAttribute('aria-label', btn.title);
  btn.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); });   // 캔버스 손(마키·팬·선택 해제)으로 안 샘(grid ＋ 꼴)
  btn.addEventListener('dblclick', (e) => { e.stopPropagation(); e.preventDefault(); });
  btn.addEventListener('click', (e) => {
    e.stopPropagation(); e.preventDefault();
    const c = duplicateSlideCell(block, _pickedCell(block));
    if (!c) return;
    window.pushHistory?.('칸 추가');
    window.deselectAll?.();
    c.closest('.section-block')?.classList.add('selected');
    c.classList.add('selected');
    window._activeFrame = c;
    window.showSlideProperties?.(block, { cell: c });
    window.scheduleAutoSave?.();
    kickSlidePlus();
  });
  return btn;
}
/* SLIDE-HEIGHT-HANDLE-01 — 고른 슬라이드(사진·프레임 둘 다) 오른쪽 아래 모서리 손잡이 = 블럭 높이(layout.h) 끌기 · 칸은 트랙을 따라감 · 놓으면 이력 한 칸.
   손잡이도 ＋ 와 같은 층(#grd-plus-layer · 블럭 DOM·저장·PNG 에 안 샘) · 꼴은 인라인(새 CSS 0). */
let _sldH = null;
function _makeSlideHHandle(block) {
  const h = document.createElement('div');
  h.className = 'sld-h-handle';
  h.dataset.sldFor = block.id || '';
  h.title = '높이';
  h.style.cssText = 'position:absolute;width:12px;height:12px;box-sizing:border-box;border:1.5px solid var(--ui-accent-primary);background:var(--ui-bg-elevated);border-radius:2px;cursor:ns-resize;pointer-events:auto;transform:translate(-50%,-50%);';
  h.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.stopPropagation(); e.preventDefault();
    const y0 = e.clientY, h0 = readSlideState(block).layout.h, z = (window.currentZoom || 40) / 100;
    const mv = (ev) => { setSlideLayout(block, { h: Math.round(h0 + (ev.clientY - y0) / z) }); kickSlidePlus(); };
    const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); if (readSlideState(block).layout.h !== h0) { window.pushHistory?.('슬라이드 높이'); window.scheduleAutoSave?.(); } };
    document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
  });
  return h;
}
/* SLIDE-CELL-FRAME-HANDLES-RADIUS-SHADOW-01 — 고른 칸의 오른쪽 아래 손잡이(현빈 요구로 «칸 px 손잡이 막기»를 되돌림 — 단 값은 칸 폭 %·높이 %(data-w·data-h)로 들어가 트랙 셈과 맞다).
   끌기 = 칸 폭(가로 몫 · 블럭 폭 기준) + 높이(트랙 높이 기준 · 가로 효과) 실시간 · 놓으면 이력 한 칸 · 같은 층·같은 꼴. */
let _sldCH = null;
function _makeCellHandle(cell, block) {
  const h = document.createElement('div');
  h.className = 'sld-cell-handle';
  h.title = '칸 크기';
  h.style.cssText = 'position:absolute;width:12px;height:12px;box-sizing:border-box;border:1.5px solid var(--ui-accent-primary);background:var(--ui-bg-elevated);border-radius:50%;cursor:nwse-resize;pointer-events:auto;transform:translate(-50%,-50%);';
  h.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.stopPropagation(); e.preventDefault();
    const L = readSlideState(block).layout, bw = Math.max(1, block.offsetWidth), th = Math.max(1, block.querySelector(':scope > .sld-track')?.clientHeight || block.clientHeight);
    const x0 = e.clientX, y0 = e.clientY, w0 = normCardW(cell.dataset.w) ?? L.cardW, h0 = normCardH(cell.dataset.h) ?? 100, z = (window.currentZoom || 40) / 100;
    const vert = slideAxis(readSlideState(block).fx) === 'y';
    const mv = (ev) => {
      const w = Math.round(Math.max(20, Math.min(100, w0 + ((vert ? ev.clientY - y0 : ev.clientX - x0) / z / (vert ? th : bw)) * 100)));
      cell.dataset.w = String(w);
      if (!vert) { const hh = Math.round(Math.max(20, Math.min(100, h0 + ((ev.clientY - y0) / z / th) * 100))); if (hh === 100) delete cell.dataset.h; else cell.dataset.h = String(hh); }
      renderSlideBlock(block); kickSlidePlus();
    };
    const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); window.pushHistory?.('칸 크기'); window.scheduleAutoSave?.(); window.showSlideProperties?.(block, { cell }); };
    document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
  });
  return h;
}
function _syncSlidePlus() {
  _sldRaf = 0;
  const L = gridPlusLayer();
  const selCell = document.querySelector('#canvas .slide-block.sld-unfold .sld-cell.selected');
  if (!selCell || !L) { if (_sldCH) { _sldCH.el.remove(); _sldCH = null; } }
  else {
    if (!_sldCH || _sldCH.cell !== selCell || !_sldCH.el.isConnected) { _sldCH?.el.remove(); _sldCH = { cell: selCell, el: _makeCellHandle(selCell, selCell.closest('.slide-block')) }; L.appendChild(_sldCH.el); }
    const r = selCell.getBoundingClientRect(), sr = L.parentElement.getBoundingClientRect(), z = (window.currentZoom || 40) / 100;
    Object.assign(_sldCH.el.style, { left: `${(r.right - sr.left) / z}px`, top: `${(r.bottom - sr.top) / z}px` });
  }
  const sel = document.querySelector('#canvas .slide-block.selected');
  if (!sel || !L) { if (_sldH) { _sldH.el.remove(); _sldH = null; } }
  else {
    if (!_sldH || _sldH.block !== sel || !_sldH.el.isConnected) { _sldH?.el.remove(); _sldH = { block: sel, el: _makeSlideHHandle(sel) }; L.appendChild(_sldH.el); }
    const r = sel.getBoundingClientRect(), sr = L.parentElement.getBoundingClientRect(), z = (window.currentZoom || 40) / 100;
    Object.assign(_sldH.el.style, { left: `${(r.right - sr.left) / z}px`, top: `${(r.bottom - sr.top) / z}px` });
  }
  /* 임시 가로 막대 — 고른 슬라이드(접힘)이고 트랙이 블럭보다 넓을 때 · 블럭 바로 아래 */
  const sb = sel && !sel.classList.contains('sld-unfold') && _scrollMax(sel) > 0 && !slideCentered(readSlideState(sel).fx) ? sel : null;
  if (!sb || !L) { if (_sldS) { _sldS.el.remove(); _sldS = null; } }
  else {
    if (!_sldS || _sldS.block !== sb || !_sldS.el.isConnected) { _sldS?.el.remove(); _sldS = { block: sb, el: _makeScrollBar(sb) }; L.appendChild(_sldS.el); }
    const r = sb.getBoundingClientRect(), sr = L.parentElement.getBoundingClientRect(), z = (window.currentZoom || 40) / 100, el = _sldS.el;
    el.max = String(_scrollMax(sb));
    if (document.activeElement !== el) el.value = String(_fixedX(sb) || Math.round(sb.scrollLeft));
    Object.assign(el.style, { left: `${(r.left - sr.left) / z}px`, top: `${(r.bottom - sr.top) / z + 18}px`, width: `${r.width / z}px` });
  }
  const b = _activeFrameSlide();
  if (!b || !L) { if (_sldPlus) { _sldPlus.btn.remove(); _sldPlus = null; } }
  else {
    if (!_sldPlus || _sldPlus.block !== b || !_sldPlus.btn.isConnected) { _sldPlus?.btn.remove(); _sldPlus = { block: b, btn: _makeSlidePlus(b) }; L.appendChild(_sldPlus.btn); }
    const cells = slideCells(b), last = cells[cells.length - 1] || b, r = last.getBoundingClientRect();
    const sr = L.parentElement.getBoundingClientRect(), z = (window.currentZoom || 40) / 100, vert = slideAxis(readSlideState(b).fx) === 'y';
    const x = vert ? (r.left + r.right) / 2 : r.right, y = vert ? r.bottom : (r.top + r.bottom) / 2;
    Object.assign(_sldPlus.btn.style, { left: `${(x - sr.left) / z + (vert ? 0 : 28)}px`, top: `${(y - sr.top) / z + (vert ? 28 : 0)}px`, transform: 'translate(-50%, -50%)' });
    _sldPlus.btn.disabled = cells.length >= SLIDE_MAX;
  }
  if (sel || b || selCell) _sldRaf = requestAnimationFrame(_syncSlidePlus);
}
export function kickSlidePlus() { if (!_sldRaf && typeof requestAnimationFrame === 'function') _sldRaf = requestAnimationFrame(_syncSlidePlus); }
if (typeof document !== 'undefined') document.addEventListener('mouseup', kickSlidePlus, true);

/** 끝에 빈 칸 하나(패널 «프레임 추가하기») — SLIDE_MAX 가드 · 이력은 부르는 쪽. */
export function addSlideCell(block) {
  const track = block.querySelector(':scope > .sld-track');
  if (!track || slideCells(block).length >= SLIDE_MAX) return null;
  const c = makeSlideCell();
  const prev = slideCells(block).at(-1);
  if (prev?.dataset.shadow) c.dataset.shadow = prev.dataset.shadow;   // 새 칸 = 마지막 칸 그림자 따라감(새 블럭 기본 옅게 · 옛 블럭 없음 그대로)
  track.appendChild(c);
  window.bindFrameDropZone?.(c);
  renderSlideBlock(block);
  return c;
}
export function makeSlideCell() {
  const c = window.makeFrameBlock ? window.makeFrameBlock() : Object.assign(document.createElement('div'), { className: 'frame-block' });
  c.classList.add('sld-cell');
  c.dataset.sldCell = '1';
  c.dataset.cellLayout = 'free';
  c.dataset.layerName = c.dataset.layerName || '칸';
  /* 적대 리뷰 [높음2] — 프레임 기본 꼴의 px 크기 키(860×520)는 칸엔 뜻이 없고, 로드(rebindAll)가 이 값을 style 로 되살려 칸을 520 에 굳혔다 ⇒ 칸은 안 갖는다 */
  delete c.dataset.width; delete c.dataset.height;
  return c;
}
function _renderFrameCells(block, layout, vert, inPlace = false, center = false, wipe = false) {
  let track = block.querySelector(':scope > .sld-track');
  if (!track) { track = document.createElement('div'); track.className = 'sld-track'; block.appendChild(track); }   // 트랙만 — 칸은 만들 때(makeSlideBlock)만 짓는다
  const pos = _dotsPos(layout, vert, wipe ? 'slide-wipe' : '');
  if (pos) block.style.height = `${layout.h + dotBand(layout)}px`;   // 137 ② 점 띠는 블럭을 «키운다» — 칸(트랙) 높이 = layout.h 그대로(옛 판은 블럭 고정·칸이 줄었다)
  const g = inPlace ? 0 : layout.gap, neg = g < 0 ? g : 0;   // 음수 간격 = flex gap 0 + 둘째부터 음수 margin(겹침 · 뒤 칸이 위)
  track.style.cssText = `display:flex;${vert ? 'flex-direction:column;' : ''}gap:${Math.max(0, g)}px;width:100%;${_trackBox(pos, layout)}${wipe ? 'position:relative;' : ''}`;
  _renderDots(block, slideCells(block).length, pos, center && slideCells(block).length > 1 ? 1 : 0);
  if (center) track.style.transform = `translateX(${centerTrackShift(slideCells(block).map((c) => normCardW(c.dataset.w) ?? layout.cardW), layout.gap)})`;   // 가운데 캐러셀 첫 장면(스타일만)
  else if (!inPlace && !wipe && !vert && _fixedX(block)) track.style.transform = `translateX(${-_fixedX(block)}px)`;   // SLIDE-TEMP-HSCROLL-FIX-EXPORT-01 «스크롤 고정» 자리
  slideCells(block).forEach((c, i) => {
    c.dataset.idx = String(i);
    const w = inPlace ? 100 : (normCardW(c.dataset.w) ?? layout.cardW);   // 제자리 효과 = 칸이 블럭 꽉(칸별 폭은 그 효과 동안 안 씀 · 값은 그대로)
    const hp = !vert && !inPlace && !wipe ? normCardH(c.dataset.h) : undefined;   // SLIDE-CELL-HEIGHT-EACH-01 칸 높이 %(가로 효과 · 트랙 가운데)
    /* 프레임 기본 꼴의 px 폭·높이·가운데 마진을 칸 자리로 덮는다(스타일만 · 자식 무접촉) */
    Object.assign(c.style, { flex: `0 0 ${w}%`, width: vert ? '100%' : 'auto', height: vert ? 'auto' : (hp !== undefined ? `${hp}%` : '100%'), alignSelf: hp !== undefined ? 'center' : '', minHeight: '0', maxWidth: 'none', margin: i && neg ? (vert ? `${neg}px 0 0 0` : `0 0 0 ${neg}px`) : '0', position: 'relative', overflow: 'hidden', boxSizing: 'border-box', inset: '', zIndex: '', clipPath: '', display: '',
      borderRadius: normRadius(c.dataset.radius) ? `${normRadius(c.dataset.radius)}px` : '', boxShadow: CELL_SHADOWS[c.dataset.shadow]?.css || '' });   // 칸 둥글기·그림자(SLIDE-CELL-FRAME-HANDLES-RADIUS-SHADOW-01)   // 전후 비교 꼴(inset·clip·숨김)은 걷고 _renderWipe 가 다시 씌운다
  });
}

/** 정적 첫 장면 — 카드 i 왼끝 = i × (카드 폭 + 간격)(slide-motion drawSlides offset 0 과 같은 자리). 빈 블럭 = 체크무늬 카드 3. */
export function renderSlideBlock(block) {
  if (!block) return;
  const { slides, layout, fx } = readSlideState(block);
  const vert = slideAxis(fx) === 'y';   // 2단계 세로 — 카드 세로로 쌓음(카드 크기 % = 높이의 %)
  block.style.height = `${layout.h}px`;
  block.style.overflow = 'hidden';
  if (!block._sldHsBound) { block._sldHsBound = true; block.addEventListener('scroll', () => _syncHScrollDots(block)); }   // 138 — 임시 밀기(막대·고정 끄기)마다 점 고정
  if (isFrameSlide(block)) {   // 프레임 모드 — 배치만(위 머리말)
    if (block.dataset.overlayBlock !== 'true') window.applyBlockFullBleed?.(block);
    _renderFrameCells(block, layout, vert, slideInPlace(fx) || layout.mode === 'single', slideCentered(fx) || layout.mode === 'center', slideWipe(fx));   // 정지 꼴(layout.mode)이 효과보다 앞
    _renderWipe(block, slideCells(block), slideWipe(fx));
    _renderHero(block.querySelector(':scope > .sld-track'), slideCells(block), slideGridZoom(fx));
    return;
  }
  /* SLIDE-PADDING-EXCLUDE-01 «패딩 제외»(dataset.fullBleed) — 부품 = drag-utils.js applyBlockFullBleed · 매 렌더 다시 씌운다(인증서·배너2·월계수와 같은 자리 · 키 없으면 no-op).
     섹션 padX 가 바뀌면 prop-page.js applyPadXToSection 의 [data-full-bleed="true"] 표식 루프가 따라 씌운다(명부 0). 떠 있을 땐 안 씌움(cert ⑰ⓑ 와 같은 가드). */
  if (block.dataset.overlayBlock !== 'true') window.applyBlockFullBleed?.(block);
  const track = document.createElement('div');
  track.className = 'sld-track';
  const pos = _dotsPos(layout, vert, fx);
  if (pos) block.style.height = `${layout.h + dotBand(layout)}px`;   // 137 ② 프레임 갈래와 같은 규약
  const inPlace = slideInPlace(fx) || layout.mode === 'single';   // 제자리 효과 · 정지 꼴 «단일 컷» = 카드 한 장이 블럭 꽉(첫 장면 = 첫 장)
  const g = inPlace ? 0 : layout.gap, neg = g < 0 ? g : 0;   // 음수 간격 = 겹침(프레임 칸과 같은 꼴)
  track.style.cssText = `display:flex;${vert ? 'flex-direction:column;' : ''}gap:${Math.max(0, g)}px;width:100%;${_trackBox(pos, layout)}${slideWipe(fx) ? 'position:relative;' : ''}`;
  const cards = slides.length ? slides : [null, null, null];
  if (slideCentered(fx) || layout.mode === 'center') track.style.transform = `translateX(${centerTrackShift(cards.map((s) => s?.w ?? layout.cardW), layout.gap)})`;   // 가운데 캐러셀 첫 장면 · 정지 꼴 «가운데 캐러셀»
  else if (!inPlace && !slideWipe(fx) && !slideGridZoom(fx) && !vert && _fixedX(block)) track.style.transform = `translateX(${-_fixedX(block)}px)`;   // «스크롤 고정» 자리
  cards.forEach((s, i) => {
    const c = document.createElement('div');
    c.className = 'sld-card';
    c.dataset.idx = String(i);
    if (!s) c.classList.add('sld-card-empty');   // 빈 카드 체커 = CSS 클래스(card-empty-export 조건①: 인라인이면 저장본에 실림)
    c.style.cssText = `flex:0 0 ${inPlace ? 100 : (s?.w ?? layout.cardW)}%;${vert ? 'width' : 'height'}:100%;overflow:hidden;${i && neg ? `margin-${vert ? 'top' : 'left'}:${neg}px;` : ''}`;   // 칸별 폭(slides[i].w) · 없으면 공통
    if (s) {
      const img = document.createElement('img');
      img.className = 'sld-img';
      img.alt = '';
      img.draggable = false;
      img.src = s.src;
      img.style.cssText = 'display:block;width:100%;height:100%;object-fit:cover;';
      c.appendChild(img);
    }
    track.appendChild(c);
  });
  block.replaceChildren(track);
  _renderDots(block, cards.length, pos, (slideCentered(fx) || layout.mode === 'center') && cards.length > 1 ? 1 : 0);
  _renderWipe(block, [...track.children], slideWipe(fx));
  _renderHero(track, [...track.children], slideGridZoom(fx));
}

/* ── 캔버스용 그림 준비(미리보기·캔버스 재생·GIF 공용) — goya-asset 은 IPC 로 data URL 을 받아 그린다 ── */
async function _dataUriOf(src) {
  if (/^data:image\//i.test(src)) return src;
  const m = /^goya-asset:\/\/([^/]+)\/(.+)$/.exec(src);
  const api = window.electronAPI;
  if (!m || !api || typeof api.assetsReadAsDataUri !== 'function') return null;
  try {
    const r = await api.assetsReadAsDataUri({ projectId: decodeURIComponent(m[1]), filename: decodeURIComponent(m[2]) });
    return r && r.ok && typeof r.dataUri === 'string' && /^data:image\//i.test(r.dataUri) ? r.dataUri : null;
  } catch (_) { return null; }
}
const _loadImg = (uri) => new Promise((res) => { if (!uri) { res(null); return; } const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = uri; });
/* SLIDE-CELL-AS-FRAME-01 커밋 3 — 프레임 칸 그림 = grid-step stepPrepare 꼴: 섹션 클론 한 번 찍고 칸 사각형마다 잘라 canvas(drawSlides 가 그대로 그림 · 새 엔진 0).
   흐름엔 블럭 밖으로 넘친 칸도 있어야 한다 ⇒ «클론에서만» 칸마다 살아 있는 px 크기로 고정 + 트랙 줄바꿈(wrap) + 블럭 높이 auto·overflow visible → 칸이 전부 찍힌다(살아 있는 블럭 무접촉).
   키 = 폭·높이·innerHTML(칸 안 내용이 바뀌면 다시 찍음 · stepPrepare 와 같은 꼴). 찍기 실패 = 그 칸 null(빈 칸 색) + 까닭 _sldImgs.err.
   ⚠️칸 안의 움직이는 것(GIF 블럭 등)은 정지 한 장(Q4 · 지디 261118 OK — 안내 줄에 한 줄). */
function _hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return `${s.length}:${(h >>> 0).toString(36)}`; }   // FNV-1a
async function _frameCellImgs(block) {
  const cells = slideCells(block), sec = block.closest('.section-block');
  /* SLIDE-GIF-PREVIEW-ZOOM-FLASH-01 — 키·찍는 크기를 «효과와 무관»하게.
     옛 판: 키 = 블럭 innerHTML 해시 + 찍는 크기 = 칸의 살아 있는 크기 ⇒ 효과만 바꿔도(칸 flex-basis·트랙 transform·점 띠·나눔선 = 전부 innerHTML 안 스타일)
     키가 바뀌어 효과를 누를 때마다 섹션 클론을 «새로» 찍었다(CDP 캡처 한 번씩 · 효과 고르기 = 캡처 연타).
     ⇒ 키 = 칸들의 «안쪽 내용»(칸 자신의 스타일 밖)·칸 폭 %·블럭 폭·높이·점 띠 · 크기 = 레이아웃에서 셈(칸 폭 % × 블럭 폭 · 트랙 높이 = 블럭 − 점 띠) — 효과가 바꾸는 값은 안 본다.
     적대 리뷰 [낮음5] 그대로 — 키는 길이 + 32bit 해시(상주 수십 바이트). */
  const ST = readSlideState(block), L = ST.layout, vert = slideAxis(ST.fx) === 'y', bw = Math.max(1, block.offsetWidth), th = Math.max(1, block.clientHeight - (L.dots === 'top' || L.dots === 'bottom' ? dotBand(L) : 0));
  const full = slideInPlace(ST.fx) || slideWipe(ST.fx);   // 꽉 채우는 효과(제자리·전후 비교)는 첫 장면 칸이 블럭 꽉 ⇒ 그 크기로 찍어야 GIF = 첫 장면(두 «꼴»만 키에 · 효과마다 다시 찍지 않음)
  const wsPct = cells.map((c) => (full ? 100 : (normCardW(c.dataset.w) ?? L.cardW)));
  const key = `F|${vert ? 'y' : 'x'}${full ? 'F' : ''}|${bw}|${th}|${wsPct.join(',')}|${cells.map((c) => c.dataset.h ?? '').join(',')}|${cells.map((c) => c.dataset.bg ?? '').join(',')}|${_hash(cells.map((c) => c.innerHTML).join('\u0001'))}`;
  if (block._sldImgs && block._sldImgs.key === key) return block._sldImgs.imgs;
  const hit = block._sldCache?.get(key);   // 두 «꼴»(카드 폭 · 꽉)을 오가도 다시 안 찍게 최근 둘을 쥔다
  if (hit) { block._sldImgs = hit; return hit.imgs; }
  const hsPct = cells.map((c) => (vert || full ? 100 : (normCardH(c.dataset.h) ?? 100)));
  const sizes = wsPct.map((w, i) => (vert ? [bw, Math.max(1, Math.round((th * w) / 100))] : [Math.max(1, Math.round((bw * w) / 100)), Math.max(1, Math.round((th * hsPct[i]) / 100))]));   // 효과 무관 «기본 꼴» 칸 크기(숨긴 칸도 제 크기 · 세로 효과는 % = 높이 몫 — 축만 키에)
  let imgs = cells.map(() => null), err = null;
  if (sec && block.id && cells.length) {
    try {
      imgs = await withGuideOff(async () => {
        const w = Math.round(sec.offsetWidth), native = isNativeCapture();
        const clone = await prepareCloneForCapture(sec, w, native);
        try {
          renderComponentsInClone(clone);
          await document.fonts.ready;
          const cb = clone.querySelector('#' + CSS.escape(block.id));
          const track = cb?.querySelector(':scope > .sld-track');
          if (!cb || !track) throw new Error('클론에서 슬라이드를 못 찾음');
          Object.assign(cb.style, { height: 'auto', overflow: 'visible' });
          Object.assign(track.style, { flexWrap: 'wrap', height: 'auto', flexDirection: 'row', transform: 'none', position: 'static', gap: '8px' });   // 겹침(음수 간격)도 찍을 땐 떼어 놓는다(칸마다 제 그림만)   // 가운데 캐러셀 첫 장면 밀기는 찍을 때 걷는다(칸 사각형이 클론 밖으로 안 나가게)
          const cc = [...track.querySelectorAll(':scope > .sld-cell')];
          cc.forEach((c, i) => Object.assign(c.style, { flex: `0 0 ${sizes[i][0]}px`, width: `${sizes[i][0]}px`, height: `${sizes[i][1]}px`, position: 'relative', inset: 'auto', clipPath: 'none', display: '', margin: '0', borderRadius: '0', boxShadow: 'none' }));   // 둥글기·그림자는 GIF 가 그린다(찍을 땐 네모 칸 그대로)   // 전후 비교 겹침·clip·숨김도 찍을 땐 걷음(칸 전부 · 제 모양)
          cb.querySelector(':scope > .sld-wipe')?.remove();
          const cr = clone.getBoundingClientRect(), rects = cc.map((c) => c.getBoundingClientRect());
          const cap = await captureCloneToCanvas(clone, w, sectionBgColor(sec), native, sec);
          const s = cap.canvas.width / cr.width;
          return rects.map((r) => {
            const cv = document.createElement('canvas');
            cv.width = Math.max(1, Math.round(r.width * s)); cv.height = Math.max(1, Math.round(r.height * s));
            cv.getContext('2d').drawImage(cap.canvas, (r.left - cr.left) * s, (r.top - cr.top) * s, r.width * s, r.height * s, 0, 0, cv.width, cv.height);
            return cv;
          });
        } finally { if (clone.parentNode) clone.parentNode.removeChild(clone); }
      });
    } catch (e) {
      err = e instanceof Error ? e.message : (e && e.type ? `그림 읽기 실패(${e.type})` : String(e));
      console.warn('[slide] 칸 찍기 실패 — 빈 칸 색으로 그린다:', err);
    }
  }
  block._sldImgs = { key, imgs, err };
  if (!err) { if (!block._sldCache) block._sldCache = new Map(); block._sldCache.set(key, block._sldImgs); while (block._sldCache.size > 2) block._sldCache.delete(block._sldCache.keys().next().value); }
  return imgs;
}

/** 블럭 사진들을 그릴 수 있게(같은 목록이면 한 번만) — 실패한 장은 null(빈 카드 색으로 그림). 프레임 모드 = 칸을 찍은 canvas. */
export async function slidePrepare(block) {
  if (isFrameSlide(block)) return _frameCellImgs(block);
  const { slides } = readSlideState(block);
  const key = slides.map((s) => s.src).join('|');
  if (block._sldImgs && block._sldImgs.key === key) return block._sldImgs.imgs;
  const imgs = await Promise.all(slides.map(async (s) => _loadImg(await _dataUriOf(s.src))));
  block._sldImgs = { key, imgs };
  return imgs;
}
/** 섹션 바탕(GIF·재생 캔버스 배경) — 블럭 자체는 투명. shortcut: 섹션 그라데이션은 단색(계산된 background-color)으로만 · 필요해지면 엔진 _fillBg 의 secGrad 셈을 같이 쓴다. */
export function slideBg(block) {
  const sec = block.closest?.('.section-block');
  const c = sec ? getComputedStyle(sec).backgroundColor : '';
  return c && c !== 'transparent' && c !== 'rgba(0, 0, 0, 0)' ? c : '#ffffff';
}
/** 엔진이 쓰는 한 바퀴 계획 — draw(ctx, W, H, _size, t) 는 텍스트 계획과 같은 꼴(_startCanvasPlay·미리보기·GIF 가 그대로 부른다).
 *  anim = GIF 패널 지금 값(없으면 블럭 저장 값) · hold 0 = 흐름·스와이프는 끝 멈춤 없이 이어짐. 그림은 slidePrepare 뒤 block._sldImgs. */
export function slidePlan(block, anim, fxOverride) {
  const st = readSlideState(block);
  const A = normAnim(anim || st.anim), fx = SLIDE_FX.includes(fxOverride) ? fxOverride : st.fx;
  const frame = isFrameSlide(block), cells = frame ? slideCells(block) : null;
  /* 프레임 모드 = 칸 수·칸 폭(data-w)이 기하 · 사진 모드 = 옛 그대로 */
  const n = frame ? Math.max(1, cells.length) : (st.slides.length || 3), ws = frame ? cells.map((c) => c.dataset.w) : st.slides.map((s) => s.w);
  const hs = frame && !slideInPlace(fx) && !slideWipe(fx) ? cells.map((c) => c.dataset.h) : null;   // 칸별 높이(가로 효과)
  const deco = frame ? cells.map((c) => ({ r: c.dataset.radius, sh: c.dataset.shadow })) : null;   // 칸 둥글기·그림자
  const axis = slideAxis(fx), bw = Math.max(1, axis === 'y' ? block.offsetHeight : block.offsetWidth), geom = slideGeom(bw, n, st.layout, ws, hs, deco);
  const sec = loopSec(fx, geom, A);
  return {
    duration: sec * 1000, hold: 0, info: slideInfoText(sec) + (frame ? ' · 칸 안 움직이는 것은 정지 한 장' : ''), gif: gifPlan(sec), fx, anim: A,
    draw: (ctx, W, H, _size, t) => {
      const k = (axis === 'y' ? H : W) / bw, pos = _dotsPos(st.layout, axis === 'y', fx);
      if (slideWipe(fx)) { drawWipe(ctx, W, H, block._sldImgs?.imgs || [], wipePos(t), k); return; }   // 전후 비교(점 없음)
      if (slideGridZoom(fx)) {   // 격자 줌아웃(점 없음) — 히어로 = 첫째 칸 · 카드 폭 % 는 첫째 칸 것
        const w0 = frame ? (normCardW(cells[0]?.dataset.w) ?? st.layout.cardW) : (st.slides[0]?.w ?? st.layout.cardW);
        drawGridZoom(ctx, block._sldImgs?.imgs || [], gridZoomFrame(t, bw, H / k, w0, st.layout.gap), geom.n, k);
        return;
      }
      if (slideInPlace(fx)) {   // 제자리 — 카드 꽉 한 장(+ 점 띠면 띠 아래)
        const band = pos ? dotBand(st.layout) * k : 0;
        ctx.save(); if (pos === 'top') ctx.translate(0, band);
        const shown = drawInPlace(ctx, W, H - band, block._sldImgs?.imgs || [], inPlaceState(geom.n, A, t), fx);
        ctx.restore();
        if (pos) drawDots(ctx, W, H, geom.n, shown, pos, k, _dotOpt(st.layout));
        return;
      }
      if (slideCentered(fx)) {   // 가운데 캐러셀 — 가운데 맞춘 밀린 거리로 같은 drawSlides(왼쪽으로)
        const cs = centerState(geom, A, t), band = pos ? dotBand(st.layout) * k : 0;
        ctx.save(); if (pos === 'top') ctx.translate(0, band);
        drawSlides(ctx, W, H - band, block._sldImgs?.imgs || [], geom, cs.s, 'left', k, undefined, axis);
        ctx.restore();
        if (pos) drawDots(ctx, W, H, geom.n, cs.active, pos, k, _dotOpt(st.layout));
        return;
      }
      const s = slideOffset(fx, geom, A, t);
      const ghosts = [];   // 스와이프 잔상 — 넘기는 동안만(머무름엔 앞 자리 = 지금 자리라 안 생김)
      if (fx === 'slide-trail') for (let j = TRAIL_N; j >= 1; j--) { const sj = slideOffset(fx, geom, A, t - (j * TRAIL_DT) / sec); if (Math.abs(sj - s) > 0.5) ghosts.push([sj, TRAIL_A * (1 - (j - 1) / TRAIL_N)]); }
      const paint = (H2) => {   // 잔상(옅게) 먼저 → 지금 자리
        for (const [sj, a] of ghosts) { ctx.save(); ctx.globalAlpha = a; drawSlides(ctx, W, H2, block._sldImgs?.imgs || [], geom, sj, A.dir, k, undefined, axis); ctx.restore(); }
        drawSlides(ctx, W, H2, block._sldImgs?.imgs || [], geom, s, A.dir, k, undefined, axis);
      };
      if (!pos) { paint(H); return; }
      const band = dotBand(st.layout) * k;   // 점 띠만큼 비우고 카드(첫 장면 트랙과 같은 높이)
      ctx.save(); if (pos === 'top') ctx.translate(0, band);
      paint(H - band);
      ctx.restore();
      drawDots(ctx, W, H, geom.n, slideActiveIndex(geom, A.dir === 'right' ? (geom.period - s) % geom.period : s), pos, k, _dotOpt(st.layout));
    },
  };
}

export function makeSlideBlock(opts = {}) {
  const block = document.createElement('div');
  block.className = 'slide-block';
  block.id = genId('sld');
  block.dataset.type = 'slide';
  block.dataset.layerName = opts.layerName || 'Slides';
  block.dataset.slides = JSON.stringify(Array.isArray(opts.slides) ? opts.slides.filter((s) => slideImgOk(s?.src)).slice(0, SLIDE_MAX) : []);
  block.dataset.animFx = SLIDE_FX[0];   // 새 블럭 = 흐름(▶ 단추가 바로 뜨게 · GIF 패널에서 바꿈)
  if (opts.cellMode === 'frame') {   // 프레임 모드 — 추가 메뉴(addSlideBlock) 기본 · makeSlideBlock 을 바로 부르는 쪽(옛 길·검사)은 고를 때만
    block.dataset.cellMode = 'frame';
    const track = document.createElement('div');
    track.className = 'sld-track';
    for (let i = 0; i < 3; i++) { const c = makeSlideCell(); c.dataset.shadow = 'soft'; track.appendChild(c); }   // SLIDE-CELL-DEFAULT-SHADOW-01 — 새 블럭만 칸마다 옅은 그림자(같은 저장 키 · 옛 저장본·옛 길 무변)
    block.appendChild(track);
  }
  renderSlideBlock(block);
  const row = document.createElement('div');
  row.className = 'row';
  row.id = genId('row');
  row.dataset.layout = 'stack';
  row.appendChild(block);
  return { row, block };
}

function addSlideBlock(opts = {}) {   // export 없이(block-add-noselection-hint bodyOf 가 `\nfunction 이름(` 으로 찾는다 · 쓰는 길 = window.addSlideBlock)
  const sec = window.getSelectedSection?.();
  if (!sec) { window.showNoSelectionHint?.(); return null; }
  window.pushHistory?.();
  const made = makeSlideBlock({ ...opts, cellMode: opts.cellMode ?? 'frame' });   // SLIDE-CELL-AS-FRAME-01 — 새 블럭 = 프레임 칸(현빈 «사진이 안 들어가는 경우도») · cellMode:'photo' = 옛 사진 모드
  insertAfterSelected(sec, made.row);
  bindBlock(made.block);
  slideCells(made.block).forEach((c) => window.bindFrameDropZone?.(c));   // 칸 고르기·안으로 끌어 넣기(로드 때는 save-load 가 모든 frame-block 을 묶는다)
  window.buildLayerPanel?.();
  try { window.selectBlock?.(made.block.id); } catch (_) {}
  window.triggerAutoSave?.();
  return made;
}

/* 추가 메뉴 노출 — GIF 와 같은 판정(animGifVisible 한 자리 · 둘째 판정 0). 드롭다운을 여는 클릭보다 먼저(capture) 맞춰 둔다. */
const _adminState = () => (window.__admin && typeof window.__admin.state === 'function' ? window.__admin.state() : null);
function syncSlideMenu() {
  const b = document.getElementById('fp-add-slide');
  if (b) b.style.display = window.animGifVisible?.(window.ANIM_GIF_ENABLED, _adminState()) ? '' : 'none';
}
if (typeof document !== 'undefined') { document.addEventListener('click', syncSlideMenu, true); syncSlideMenu(); }

window.makeSlideBlock = makeSlideBlock;
window.addSlideBlock = addSlideBlock;
window.renderSlideBlock = renderSlideBlock;
window.slidePrepare = slidePrepare;
window.slidePlan = slidePlan;
window.slideBg = slideBg;
window.slideHasPhotos = slideHasPhotos;
window.setSlideAnim = setSlideAnim;
window.readSlideState = readSlideState;
window.setSlideList = setSlideList;
window.appendSlideImage = appendSlideImage;   // canvas-scratch-drop(클래식 스크립트)이 부른다
window.slideAxis = slideAxis;
window.isFrameSlide = isFrameSlide;
window.addSlideCell = addSlideCell;
window.convertSlideToFrames = convertSlideToFrames;
window.appendSlideCellImage = appendSlideCellImage;
window.duplicateSlideCell = duplicateSlideCell;
window.kickSlidePlus = kickSlidePlus;
window.unfoldSlide = unfoldSlide;
window.setSlideScrollFix = setSlideScrollFix;
window.setSlideLayout = setSlideLayout;   // 검사·클래식 스크립트용(패널은 import)
window.slideCells = slideCells;   // export-figma-json(클래식 스크립트)·패널이 축을 읽는다
