/* logo-collab.js — 1013t2A2 로고 «콜라보» [로고1 × 로고2 (× 로고3)] DOM 렌더·조작
 * ★한 에셋 블록 안이다(별 «갯수»와 같은 결정 — 블록을 복제하지 않는다).
 *   칸1 = 그 블록의 기존 그림 그대로(dataset.imgSrc · .asset-img-clip) ⇒ 넣기·교체·제거·드롭·스크래치·MCP 길이 그대로 산다.
 *   칸2·3 + 「×」 = 새 자식 ab > .asset-collab > ( span.asset-collab-x + div.asset-collab-slot[data-slot=k] (> img.asset-collab-img) ) × (n−1)
 *   칸 k 그림의 정본 = 그 칸 img 의 src 하나(⛔dataset 에 또 적지 않는다 — base64 두 벌 방지).
 * ★꺼짐 = 아무것도 안 쓴다 — data-collab 없음 = 옛 블록. 켜기→끄기 왕복은 outerHTML 바이트 동일이 목표(DOM LC4).
 * ★로고 칸 기본 맞춤 = «원래 비율»(contain · 잘리지 않음 — decisions ② 기본). 켤 때 칸1 이 cover 면 contain 으로 바꾸고
 *   옛 값을 data-collab-prev-fit 에 쥐었다가 끌 때 되돌린다(그 사이 사람이 Fit 을 바꿨으면 사람 값이 이긴다).
 * ★innerHTML 재작성 3자리(image-handling.js 영상·그림·지우기)는 captureAssetCollab/restoreAssetCollab 로 콜라보를 살린다(그레인 선례). */
import {
  COLLAB_MIN, COLLAB_MAX, COLLAB_GAP_DEFAULT, COLLAB_GLYPH,
  clampCollabCount, clampCollabGap, clampCollabXSize, collabXSizeDefault, collabGeometry,
} from './logo-collab-model.js';
import { _isLogoSized } from '../inspector.js';   /* ★근사 술어는 «재구현 금지»(inspector.js 머리말) */

export { COLLAB_MIN, COLLAB_MAX };
const COLLAB_IMAGE_MAX_BYTES = 20 * 1024 * 1024;   // 칸1(image-handling.js ASSET_IMAGE_MAX_BYTES)과 같은 상한
const CSS_VARS = ['--collab-slot-w', '--collab-gap', '--collab-x-size', '--collab-x-color'];
const DS_KEYS = ['collab', 'collabSlotW', 'collabW0', 'collabGap', 'collabXSize', 'collabXColor', 'collabPrevFit'];

export function collabCount(ab) {
  return ab?.dataset?.collab ? clampCollabCount(ab.dataset.collab) : 1;
}
/** 콜라보 절을 보일 블록 = 「켜짐 ∪ data-preset=logo ∪ 200×64」(inspector 근사 그대로). */
export function isLogoBlock(ab) {
  if (!ab?.classList?.contains('asset-block')) return false;
  return !!ab.dataset.collab || ab.dataset.preset === 'logo' || _isLogoSized(ab);
}
/** 패널·export 가 같이 읽는 값 한 벌. */
export function collabParams(ab) {
  const n = collabCount(ab);
  const H = parseFloat(ab.style.height) || ab.offsetHeight || 64;
  const S = parseFloat(ab.dataset.collabSlotW) || 200;
  const gap = ab.dataset.collabGap != null ? clampCollabGap(ab.dataset.collabGap) : COLLAB_GAP_DEFAULT;
  const x = ab.dataset.collabXSize != null ? clampCollabXSize(ab.dataset.collabXSize, H) : collabXSizeDefault(H);
  return { n, H, S, gap, x, color: ab.dataset.collabXColor || '', geo: collabGeometry(S, n, gap, x) };
}
const slot1Img = (ab) => ab.querySelector(':scope > .asset-img-clip > .asset-img');
const slotFit = (ab) => ab.dataset.fit || 'contain';

/** 모델(dataset) → DOM. 멱등 — 칸 img 는 보존하고 수·폭·변수만 맞춘다. 꺼짐이면 아무것도 안 한다. */
export function applyAssetCollab(ab) {
  if (!ab) return;
  const p = collabParams(ab);
  if (p.n < 2) return;
  ab.style.width = p.geo.width + 'px';
  ab.style.setProperty('--collab-slot-w', p.S + 'px');
  if (ab.dataset.collabGap != null) ab.style.setProperty('--collab-gap', p.gap + 'px');
  else ab.style.removeProperty('--collab-gap');
  ab.style.setProperty('--collab-x-size', p.x + 'px');
  if (p.color) ab.style.setProperty('--collab-x-color', p.color);
  else ab.style.removeProperty('--collab-x-color');

  let box = ab.querySelector(':scope > .asset-collab');
  if (!box) {
    box = document.createElement('div');
    box.className = 'asset-collab';
    ab.insertBefore(box, ab.querySelector(':scope > .asset-overlay'));
  }
  const keep = new Map([...box.querySelectorAll(':scope > .asset-collab-slot')].map(s => [s.dataset.slot, s]));
  box.textContent = '';
  for (let k = 2; k <= p.n; k++) {
    const xEl = document.createElement('span');
    xEl.className = 'asset-collab-x';
    xEl.setAttribute('aria-hidden', 'true');
    xEl.textContent = COLLAB_GLYPH;
    box.appendChild(xEl);
    let slot = keep.get(String(k));
    if (!slot) {
      slot = document.createElement('div');
      slot.className = 'asset-collab-slot';
      slot.dataset.slot = String(k);
    }
    box.appendChild(slot);
  }
  const fit = slotFit(ab);
  box.querySelectorAll('.asset-collab-img').forEach(img => { img.style.objectFit = fit; });
}

/** 꺼짐(갯수 1) — 쓴 것을 전부 걷는다. */
export function disableCollab(ab) {
  if (!ab?.dataset?.collab) return;
  ab.querySelector(':scope > .asset-collab')?.remove();
  const w0 = ab.dataset.collabW0;
  if (w0 != null) { if (w0 === 'none') ab.style.removeProperty('width'); else ab.style.width = w0; }
  else ab.style.width = (parseFloat(ab.dataset.collabSlotW) || 200) + 'px';
  CSS_VARS.forEach(v => ab.style.removeProperty(v));
  if (ab.dataset.collabPrevFit != null && ab.dataset.fit === 'contain') {
    const prev = ab.dataset.collabPrevFit;
    if (prev) ab.dataset.fit = prev; else delete ab.dataset.fit;
    const img = slot1Img(ab);
    const snap = ab._collabFitSnap;
    if (img && snap && snap.img === img && snap.style != null) img.setAttribute('style', snap.style);
    else if (img) img.style.objectFit = prev || 'cover';
  }
  ab._collabFitSnap = null;
  DS_KEYS.forEach(k => { delete ab.dataset[k]; });
}

/** 갯수 n(1~3). 1 = 끔. 늘리면 블록이 옆으로 넓어지고, 줄이면 뒤 칸(그림째)이 빠진다(⌘Z 로 복구 — 별 갯수와 같은 감각). */
export function setCollabCount(ab, n) {
  if (!ab) return;
  const want = clampCollabCount(n);
  const cur = collabCount(ab);
  if (want === cur) return;
  if (want === 1) { disableCollab(ab); return; }
  if (cur === 1) {
    const w0 = ab.style.width;
    const S = /^\d+(\.\d+)?px$/.test(w0) ? parseFloat(w0) : (ab.offsetWidth || 200);
    ab.dataset.collabSlotW = String(Math.round(S));
    if (!/^\d+(\.\d+)?px$/.test(w0)) ab.dataset.collabW0 = w0 || 'none';
    const img = slot1Img(ab);
    if (img && ab.dataset.fit !== 'contain' && !ab.dataset.imgW) {
      ab.dataset.collabPrevFit = ab.dataset.fit || '';
      ab._collabFitSnap = { img, style: img.getAttribute('style') };
      ab.dataset.fit = 'contain';
      img.style.objectFit = 'contain';
    }
  }
  ab.dataset.collab = String(want);
  applyAssetCollab(ab);
}

/** 간격·× 크기·× 색 — 기본값과 같으면 속성을 지운다(미설정 = 기본). */
export function setCollabStyle(ab, { gap, xSize, xColor } = {}) {
  if (!ab?.dataset?.collab) return;
  const H = parseFloat(ab.style.height) || ab.offsetHeight || 64;
  if (gap !== undefined) {
    const g = clampCollabGap(gap);
    if (g === COLLAB_GAP_DEFAULT) delete ab.dataset.collabGap; else ab.dataset.collabGap = String(g);
  }
  if (xSize !== undefined) {
    const x = clampCollabXSize(xSize, H);
    if (x === collabXSizeDefault(H)) delete ab.dataset.collabXSize; else ab.dataset.collabXSize = String(x);
  }
  if (xColor !== undefined) {
    if (xColor) ab.dataset.collabXColor = String(xColor); else delete ab.dataset.collabXColor;
  }
  applyAssetCollab(ab);
}

const _slotEl = (ab, k) => ab?.querySelector(`:scope > .asset-collab > .asset-collab-slot[data-slot="${k}"]`) || null;
export function collabSlotSrc(ab, k) {
  return _slotEl(ab, k)?.querySelector('.asset-collab-img')?.getAttribute('src') || '';
}
/** 칸 k(2·3)에 그림. 꺼져 있거나 칸이 없으면 false. ⚠️pushHistory 는 부르는 쪽이 정한다(setAssetImageFromSrc 와 같은 규약). */
export function setCollabSlotSrc(ab, k, src) {
  const slot = _slotEl(ab, k);
  if (!slot || !src) return false;
  let img = slot.querySelector('.asset-collab-img');
  if (!img) {
    img = document.createElement('img');
    img.className = 'asset-collab-img';
    img.draggable = false;
    img.alt = '';
    slot.appendChild(img);
  }
  img.setAttribute('src', src);
  img.style.objectFit = slotFit(ab);
  return true;
}
export function clearCollabSlot(ab, k) {
  const img = _slotEl(ab, k)?.querySelector('.asset-collab-img');
  if (!img) return false;
  img.remove();
  return true;
}
export function loadImageToCollabSlot(ab, k, file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) { window.showToast?.('콜라보 로고 칸은 이미지만 넣을 수 있습니다.'); return; }
  if (file.size > COLLAB_IMAGE_MAX_BYTES) {
    alert(`이미지 파일은 ${Math.round(COLLAB_IMAGE_MAX_BYTES / (1024 * 1024))}MB 이하만 업로드할 수 있습니다.`);
    return;
  }
  window.pushHistory?.();
  const reader = new FileReader();
  reader.onload = ev => {
    if (!setCollabSlotSrc(ab, k, ev.target.result)) return;
    if (ab.classList.contains('selected')) window.showAssetProperties?.(ab);
    window.pushHistory?.('로고 업로드');   // ★«끝 표본» — loadImageToAsset 과 같은 규율(비동기 반영 뒤 한 번 더)
    window.scheduleAutoSave?.();
  };
  reader.readAsDataURL(file);
}
export function triggerCollabSlotUpload(ab, k) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = e => { const f = e.target.files[0]; if (f) loadImageToCollabSlot(ab, k, f); };
  input.click();
}

/** innerHTML 재작성 앞뒤 — 노드째 쥐었다가 되붙인다(칸 img·× 그대로). */
export function captureAssetCollab(ab) {
  return ab?.querySelector(':scope > .asset-collab') || null;
}
export function restoreAssetCollab(ab, snap) {
  if (!ab || !snap || !ab.dataset.collab) return;
  ab.insertBefore(snap, ab.querySelector(':scope > .asset-overlay'));
  applyAssetCollab(ab);
}

window.setCollabCount = setCollabCount;
window.setCollabStyle = setCollabStyle;
window.setCollabSlotSrc = setCollabSlotSrc;
window.clearCollabSlot = clearCollabSlot;
window.applyAssetCollab = applyAssetCollab;
window.isLogoBlock = isLogoBlock;
window.triggerCollabSlotUpload = triggerCollabSlotUpload;
window.loadImageToCollabSlot = loadImageToCollabSlot;
