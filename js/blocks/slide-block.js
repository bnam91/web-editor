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
import { bindBlock } from '../drag-drop.js';
import {
  SLIDE_FX, SLIDE_MAX, SLIDE_LAYOUT_DEFAULT, SLIDE_ANIM_DEFAULT, normLayout, normAnim, diffFromDefault,
  slideGeom, loopSec, slideOffset, gifPlan, slideInfoText, drawSlides, slideAxis,
} from '../fx/slide-motion.js';

const slideImgOk = (s) => typeof s === 'string' && s.length <= 8_000_000 && /^(data:image\/(png|jpe?g|webp|gif);base64,|goya-asset:\/\/)/i.test(s);
const _json = (s, d) => { try { const v = JSON.parse(s || ''); return v ?? d; } catch (_) { return d; } };

export function readSlideState(block) {
  const d = block.dataset;
  const raw = _json(d.slides, []);
  const slides = (Array.isArray(raw) ? raw : []).slice(0, SLIDE_MAX).filter((s) => slideImgOk(s?.src)).map((s) => ({ src: s.src }));
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
  block.dataset.slides = JSON.stringify(slides.filter((s) => slideImgOk(s?.src)).slice(0, SLIDE_MAX).map((s) => ({ src: s.src })));
  renderSlideBlock(block);
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
export const slideHasPhotos = (block) => readSlideState(block).slides.length > 0;

/** 정적 첫 장면 — 카드 i 왼끝 = i × (카드 폭 + 간격)(slide-motion drawSlides offset 0 과 같은 자리). 빈 블럭 = 체크무늬 카드 3. */
export function renderSlideBlock(block) {
  if (!block) return;
  const { slides, layout, fx } = readSlideState(block);
  const vert = slideAxis(fx) === 'y';   // 2단계 세로 — 카드 세로로 쌓음(카드 크기 % = 높이의 %)
  block.style.height = `${layout.h}px`;
  block.style.overflow = 'hidden';
  const track = document.createElement('div');
  track.className = 'sld-track';
  track.style.cssText = `display:flex;${vert ? 'flex-direction:column;' : ''}gap:${layout.gap}px;width:100%;height:100%;`;
  const cards = slides.length ? slides : [null, null, null];
  cards.forEach((s, i) => {
    const c = document.createElement('div');
    c.className = 'sld-card';
    c.dataset.idx = String(i);
    if (!s) c.classList.add('sld-card-empty');   // 빈 카드 체커 = CSS 클래스(card-empty-export 조건①: 인라인이면 저장본에 실림)
    c.style.cssText = `flex:0 0 ${layout.cardW}%;${vert ? 'width' : 'height'}:100%;overflow:hidden;`;
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
/** 블럭 사진들을 그릴 수 있게(같은 목록이면 한 번만) — 실패한 장은 null(빈 카드 색으로 그림). */
export async function slidePrepare(block) {
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
  const axis = slideAxis(fx), bw = Math.max(1, axis === 'y' ? block.offsetHeight : block.offsetWidth), geom = slideGeom(bw, st.slides.length || 3, st.layout);
  const sec = loopSec(fx, geom, A);
  return {
    duration: sec * 1000, hold: 0, info: slideInfoText(sec), gif: gifPlan(sec), fx, anim: A,
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
  const made = makeSlideBlock(opts);
  insertAfterSelected(sec, made.row);
  bindBlock(made.block);
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
window.slideAxis = slideAxis;   // export-figma-json(클래식 스크립트)·패널이 축을 읽는다
