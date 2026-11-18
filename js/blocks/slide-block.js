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
  slideGeom, loopSec, slideOffset, gifPlan, slideInfoText, drawSlides, slideAxis, normCardW,
} from '../fx/slide-motion.js';
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
function _syncSlidePlus() {
  _sldRaf = 0;
  const b = _activeFrameSlide();
  if (!b) { if (_sldPlus) { _sldPlus.btn.remove(); _sldPlus = null; } return; }
  const L = gridPlusLayer();
  if (!L) return;
  if (!_sldPlus || _sldPlus.block !== b || !_sldPlus.btn.isConnected) { _sldPlus?.btn.remove(); _sldPlus = { block: b, btn: _makeSlidePlus(b) }; L.appendChild(_sldPlus.btn); }
  const cells = slideCells(b), last = cells[cells.length - 1] || b, r = last.getBoundingClientRect();
  const sr = L.parentElement.getBoundingClientRect(), z = (window.currentZoom || 40) / 100, vert = slideAxis(readSlideState(b).fx) === 'y';
  const x = vert ? (r.left + r.right) / 2 : r.right, y = vert ? r.bottom : (r.top + r.bottom) / 2;
  Object.assign(_sldPlus.btn.style, { left: `${(x - sr.left) / z + (vert ? 0 : 28)}px`, top: `${(y - sr.top) / z + (vert ? 28 : 0)}px`, transform: 'translate(-50%, -50%)' });
  _sldPlus.btn.disabled = cells.length >= SLIDE_MAX;
  _sldRaf = requestAnimationFrame(_syncSlidePlus);
}
export function kickSlidePlus() { if (!_sldRaf && typeof requestAnimationFrame === 'function') _sldRaf = requestAnimationFrame(_syncSlidePlus); }
if (typeof document !== 'undefined') document.addEventListener('mouseup', kickSlidePlus, true);

/** 끝에 빈 칸 하나(패널 «프레임 추가하기») — SLIDE_MAX 가드 · 이력은 부르는 쪽. */
export function addSlideCell(block) {
  const track = block.querySelector(':scope > .sld-track');
  if (!track || slideCells(block).length >= SLIDE_MAX) return null;
  const c = makeSlideCell();
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
function _renderFrameCells(block, layout, vert) {
  let track = block.querySelector(':scope > .sld-track');
  if (!track) { track = document.createElement('div'); track.className = 'sld-track'; block.appendChild(track); }   // 트랙만 — 칸은 만들 때(makeSlideBlock)만 짓는다
  track.style.cssText = `display:flex;${vert ? 'flex-direction:column;' : ''}gap:${layout.gap}px;width:100%;height:100%;`;
  slideCells(block).forEach((c, i) => {
    c.dataset.idx = String(i);
    const w = normCardW(c.dataset.w) ?? layout.cardW;
    /* 프레임 기본 꼴의 px 폭·높이·가운데 마진을 칸 자리로 덮는다(스타일만 · 자식 무접촉) */
    Object.assign(c.style, { flex: `0 0 ${w}%`, width: vert ? '100%' : 'auto', height: vert ? 'auto' : '100%', minHeight: '0', maxWidth: 'none', margin: '0', position: 'relative', overflow: 'hidden', boxSizing: 'border-box' });
  });
}

/** 정적 첫 장면 — 카드 i 왼끝 = i × (카드 폭 + 간격)(slide-motion drawSlides offset 0 과 같은 자리). 빈 블럭 = 체크무늬 카드 3. */
export function renderSlideBlock(block) {
  if (!block) return;
  const { slides, layout, fx } = readSlideState(block);
  const vert = slideAxis(fx) === 'y';   // 2단계 세로 — 카드 세로로 쌓음(카드 크기 % = 높이의 %)
  block.style.height = `${layout.h}px`;
  block.style.overflow = 'hidden';
  if (isFrameSlide(block)) {   // 프레임 모드 — 배치만(위 머리말)
    if (block.dataset.overlayBlock !== 'true') window.applyBlockFullBleed?.(block);
    _renderFrameCells(block, layout, vert);
    return;
  }
  /* SLIDE-PADDING-EXCLUDE-01 «패딩 제외»(dataset.fullBleed) — 부품 = drag-utils.js applyBlockFullBleed · 매 렌더 다시 씌운다(인증서·배너2·월계수와 같은 자리 · 키 없으면 no-op).
     섹션 padX 가 바뀌면 prop-page.js applyPadXToSection 의 [data-full-bleed="true"] 표식 루프가 따라 씌운다(명부 0). 떠 있을 땐 안 씌움(cert ⑰ⓑ 와 같은 가드). */
  if (block.dataset.overlayBlock !== 'true') window.applyBlockFullBleed?.(block);
  const track = document.createElement('div');
  track.className = 'sld-track';
  track.style.cssText = `display:flex;${vert ? 'flex-direction:column;' : ''}gap:${layout.gap}px;width:100%;height:100%;`;
  const cards = slides.length ? slides : [null, null, null];
  cards.forEach((s, i) => {
    const c = document.createElement('div');
    c.className = 'sld-card';
    c.dataset.idx = String(i);
    if (!s) c.classList.add('sld-card-empty');   // 빈 카드 체커 = CSS 클래스(card-empty-export 조건①: 인라인이면 저장본에 실림)
    c.style.cssText = `flex:0 0 ${s?.w ?? layout.cardW}%;${vert ? 'width' : 'height'}:100%;overflow:hidden;`;   // 칸별 폭(slides[i].w) · 없으면 공통
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
  /* 적대 리뷰 [낮음5] — 키에 innerHTML 을 통째로 두면(base64 12장) 수십 MB 가 블럭에 상주한다 ⇒ 길이 + 32bit 해시만 쥔다(같은 판정 · 상주 수십 바이트) */
  const key = `F|${block.offsetWidth}|${block.offsetHeight}|${_hash(block.innerHTML)}`;
  if (block._sldImgs && block._sldImgs.key === key) return block._sldImgs.imgs;
  const sizes = cells.map((c) => [c.offsetWidth, c.offsetHeight]);
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
          Object.assign(track.style, { flexWrap: 'wrap', height: 'auto', flexDirection: 'row' });
          const cc = [...track.querySelectorAll(':scope > .sld-cell')];
          cc.forEach((c, i) => Object.assign(c.style, { flex: `0 0 ${sizes[i][0]}px`, width: `${sizes[i][0]}px`, height: `${sizes[i][1]}px` }));
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
  const axis = slideAxis(fx), bw = Math.max(1, axis === 'y' ? block.offsetHeight : block.offsetWidth), geom = slideGeom(bw, n, st.layout, ws);
  const sec = loopSec(fx, geom, A);
  return {
    duration: sec * 1000, hold: 0, info: slideInfoText(sec) + (frame ? ' · 칸 안 움직이는 것은 정지 한 장' : ''), gif: gifPlan(sec), fx, anim: A,
    draw: (ctx, W, H, _size, t) => drawSlides(ctx, W, H, block._sldImgs?.imgs || [], geom, slideOffset(fx, geom, A, t), A.dir, (axis === 'y' ? H : W) / bw, undefined, axis),
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
    for (let i = 0; i < 3; i++) track.appendChild(makeSlideCell());
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
window.setSlideLayout = setSlideLayout;   // 검사·클래식 스크립트용(패널은 import)
window.slideCells = slideCells;   // export-figma-json(클래식 스크립트)·패널이 축을 읽는다
