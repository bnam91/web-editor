/* ═══════════════════════════════════
   SHAPE FRAME — «도형 래퍼는 그냥 도형이다» 판정·삽입자리 해석·로드 정규화 SSOT
   (0918 shape 유닛, 현빈 확정 A안 2026-09-19)
═══════════════════════════════════
 * 도형은 addShapeBlock 이 «자유배치 프레임(frame-block[data-free-layout])» 안에
 * .shape-block 하나를 넣어서 만든다. 그 래퍼에는 «나는 도형 래퍼다» 표시가 따로 없어서
 * `_activeFrame`/선택 앵커로 «넣을 자리»를 고르는 모든 경로가 래퍼를 평범한 컨테이너로
 * 보고 그 안에 다른 블록을 넣었다(실측 오염 2건: ss_ts0he_hmdtw6g · ss_ts0he_wuzqx3u).
 *
 * A안 = 구조는 그대로 두고 «겉과 동작»만 그냥 도형:
 *   ① 판정 1개      isShapeFrame(el)       — 직속 :scope > .shape-block (★자손 검색 금지)
 *   ② 넣을 자리 1개  resolveInsertFrame(af) — 도형 래퍼면 한 단계 위 실제 프레임(없으면 null=섹션)
 *                   anchorUnitOf(el)       — X.after(new) 의 X. shape-block 이면 그 래퍼(또는 row)
 *   ③ 로드 정규화    ejectShapeFrameIntruders(root) — 이미 들어간 블록은 래퍼 바로 뒤로 꺼낸다(멱등)
 *   ④ absolute→flow  toFlowUnit(el)        — 드래그아웃(block-drag.js)과 로드 정규화가 공유
 *
 * ⛔import 없음(순수 DOM) — 하네스 DOM 테스트가 이 파일만 단독 로드한다. window.ShapeFrame 도 노출.
 * ⛔data-shape-frame 속성을 새로 찍지 마라 — 래퍼 자체가 data-free-layout 이라
 *   wrapper.closest('[data-free-layout]') 가 «자기 자신»을 잡아 오염이 오히려 는다(B안 영역).
 */

/** 도형 래퍼인가 — frame-block 이면서 텍스트프레임/그룹/배너프리셋이 아니고, «직속» shape-block 을 가진다. */
export function isShapeFrame(el) {
  if (!el || el.nodeType !== 1 || !el.classList?.contains('frame-block')) return false;
  const ds = el.dataset || {};
  if (ds.textFrame || ds.group || ds.bannerPreset) return false;
  return !!el.querySelector(':scope > .shape-block');
}

/** shape-block 을 감싼 도형 래퍼. shape-block 이 아니거나 래퍼가 아니면 null. */
export function shapeFrameOf(node) {
  if (!node || node.nodeType !== 1 || !node.classList?.contains('shape-block')) return null;
  const p = node.parentElement;
  return isShapeFrame(p) ? p : null;
}

/** 블록을 «넣을 프레임» 해석 — 도형 래퍼면 위로 올라가 실제 프레임을, 없으면 null(섹션 레벨). */
export function resolveInsertFrame(af) {
  let cur = af || null;
  let guard = 0;
  while (cur && isShapeFrame(cur) && guard++ < 64) {
    cur = cur.parentElement?.closest('.frame-block:not([data-text-frame])') || null;
  }
  return cur;
}

/** `X.after(newEl)` 의 X 로 쓸 단위 — shape-block 이면 그 래퍼(래퍼가 .row 직속이면 row). 아니면 el. */
export function anchorUnitOf(el) {
  if (!el) return el;
  const w = shapeFrameOf(el) || (isShapeFrame(el) ? el : null);
  if (!w) return el;
  const p = w.parentElement;
  return (p && p.classList?.contains('row')) ? p : w;
}

function _genRowId() {
  try { if (typeof window !== 'undefined' && typeof window.genId === 'function') return window.genId('row'); } catch (_) {}
  return 'row_' + Math.random().toString(36).slice(2, 9);
}
function _genSsId() {
  try { if (typeof window !== 'undefined' && typeof window.genId === 'function') return window.genId('ss'); } catch (_) {}
  return 'ss_' + Math.random().toString(36).slice(2, 9);
}

/** absolute 배치 블록을 플로우 단위로 바꾼다(순수 DOM, 바인딩 없음). 반환 = 플로우 단위(row 또는 el).
 *  텍스트프레임·프레임·row 는 자기 자신이 단위, 맨몸 블록은 .row[data-layout=stack] 로 감싼다
 *  (block-factory.js:111 관례 — ⌘[/⌘] 이동 단위 closest('.row') 와 맞추기 위함). */
export function toFlowUnit(el) {
  if (!el || el.nodeType !== 1) return el;
  el.style.position = '';
  el.style.left = '';
  el.style.top = '';
  delete el.dataset.offsetX;
  delete el.dataset.offsetY;
  if (el.dataset.textFrame === 'true' || el.classList.contains('frame-block') || el.classList.contains('row')) return el;
  const row = document.createElement('div');
  row.className = 'row';
  row.id = _genRowId();
  row.dataset.layout = 'stack';
  if (el.parentNode) el.replaceWith(row);
  row.appendChild(el);
  return row;
}

// 옮기지 않고 지우는 일시 UI(드롭 표시·인라인 핸들) — 저장본에 섞여 들어간 찌꺼기
const _TRANSIENT_SEL = '.drop-indicator, .ss-resize-handle';

function _px(v) { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; }

/** 로드 정규화 — 각 도형 래퍼에 «첫 shape-block 1개»만 남기고 나머지를 래퍼 바로 뒤(같은 부모)로 꺼낸다.
 *  멱등(두 번째 실행 = 0, DOM 무변이). 반환 = 꺼낸 요소 수. */
export function ejectShapeFrameIntruders(root) {
  if (!root?.querySelectorAll) return 0;
  let moved = 0;
  const touched = [];
  const wrappers = [...root.querySelectorAll('.frame-block')].filter(isShapeFrame);
  for (const w of wrappers) {
    if (!w.isConnected && !root.contains(w)) continue;
    const keep = w.querySelector(':scope > .shape-block');
    const others = [...w.children].filter(c => c !== keep);
    if (!others.length) continue;
    touched.push(w.id);
    const unit = anchorUnitOf(w);                 // 래퍼 또는 래퍼를 감싼 row
    const parent = unit.parentElement;
    if (!parent) continue;
    const parentFree = parent.classList.contains('frame-block') && parent.dataset.freeLayout === 'true'
                       && w.style.position === 'absolute';
    const wl = _px(w.style.left), wt = _px(w.style.top);
    const wh = _px(w.style.height) || _px(w.dataset.height) || w.offsetHeight || 0;
    let prev = unit;
    for (const child of others) {
      if (child.matches?.(_TRANSIENT_SEL)) { child.remove(); continue; }
      let out = child;
      if (child.classList.contains('shape-block')) {
        // 래퍼당 도형 1개 불변식 — 두 번째 도형은 «자기 래퍼»를 새로 입혀 독립 도형으로 꺼낸다.
        const nw = w.cloneNode(false);
        nw.id = _genSsId();
        const sl = _px(child.style.left), st = _px(child.style.top);
        child.style.position = 'absolute';
        child.style.left = '0';
        child.style.top = '0';
        nw.appendChild(child);
        if (parentFree) {
          nw.style.left = (wl + sl) + 'px';
          nw.style.top = (wt + st) + 'px';
          nw.dataset.offsetX = String(wl + sl);
          nw.dataset.offsetY = String(wt + st);
        }
        out = nw;
      } else if (parentFree) {
        if (child.style.position === 'absolute') {
          const l = _px(child.style.left) + wl, t = _px(child.style.top) + wt;
          child.style.left = l + 'px';
          child.style.top = t + 'px';
          child.dataset.offsetX = String(l);
          child.dataset.offsetY = String(t);
        } else {
          child.style.position = 'absolute';
          child.style.left = wl + 'px';
          child.style.top = (wt + wh) + 'px';
          child.dataset.offsetX = String(wl);
          child.dataset.offsetY = String(wt + wh);
        }
      } else if (child.style.position === 'absolute') {
        prev.after(child);
        out = toFlowUnit(child);
        prev = out;
        moved++;
        continue;
      }
      prev.after(out);
      prev = out;
      moved++;
    }
  }
  if (moved) {
    try { console.info('[shape-frame] 도형 래퍼 안 블록 꺼냄:', moved, touched); } catch (_) {}
  }
  return moved;
}

if (typeof window !== 'undefined') {
  window.ShapeFrame = { isShapeFrame, shapeFrameOf, resolveInsertFrame, anchorUnitOf, toFlowUnit, ejectShapeFrameIntruders };
}
