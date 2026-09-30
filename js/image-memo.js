/* ═══════════════════════════════════
   IMAGE MEMO — 빈 이미지 칸의 «제작 지시» 쪽지 (현빈 2026-09-30)
   ═══════════════════════════════════

 * 이미지·에셋 블럭(.asset-block) 우클릭 「이미지 메모 적기」 → 그 자리에서 한 줄(여러 줄) 적는다.
 * 빈 칸(체커) 가운데에 쪽지로 보이고, 뜻은 「이 자리엔 어떤 이미지가 들어갈지」다.
 *
 * ★값은 블럭 «자신»의 속성 한 칸(data-memo)에 산다 — 저장(outerHTML)·복사·붙여넣기·템플릿에
 *   아무 배선 없이 따라간다. 그리고 ★그리기는 CSS 가상요소(::before · content: attr(data-memo))다.
 *   ⇒ DOM 에 «쪽지 요소»가 없다 — 저장본에 편집용 요소가 새어 나갈 자리 자체가 없다.
 *
 * ★확정 사양(지디 전달, 현빈 답):
 *   ⑴ 이미지가 들어가면 쪽지는 «그냥 숨는다»(표시·배지 없음). 값은 남는다.
 *      이미지를 비우면 쪽지가 «같은 글자로» 다시 나온다 — 이 되돌아옴이 판정 기준이다.
 *      ⇒ 숨김은 CSS `:not(.has-image)` 한 줄이 진다. ⛔이미지를 넣을 때 값을 지우지 마라.
 *   ⑵ 편집 화면 전용 — PNG·HTML·썸네일에 안 나간다. 클론에서 속성을 뗀다
 *      (js/io/capture-safety.js stripEditorOnlyForCapture — [data-is-placeholder] 와 같은 자리).
 *      ⚠️프로젝트 저장(serializeCleanRoot)·.gdt 는 «뗀다»의 대상이 아니다 — 거기서 빼면 메모가 사라진다.
 *   ⑶ 입력은 «그 자리에서». ⛔파일 선택창·네이티브 모달 금지(앱이 멈춘다). Enter 저장 · Esc 취소 · ⇧Enter 줄바꿈.
 *   ⑷ ⌘Z 한 번 = 메모 한 번 — push-after(js/props/CLAUDE.md 히스토리 규약).
 *
 * ★「준비할 이미지」(좌측 인스펙터)가 세는 «빈 이미지 칸»의 선택자도 여기 «한 곳»에 둔다 —
 *   세는 쪽(inspector.js)과 그리는 쪽이 같은 선택자를 보게 하려는 것이다. */
/** 메모가 사는 속성 — CSS(editor-blocks.css)·capture-safety 가 이 이름을 본다. */
export const IMAGE_MEMO_ATTR = 'data-memo';
/** 메모를 적을 수 있는 블럭. ⛔그리드 빈 슬롯은 아니다 — 아래 「그리드 메모 «자리»」 주석. */
export const IMAGE_MEMO_HOST_SEL = '.asset-block';
/** 그리드 «빈 이미지 슬롯» — css/editor-blocks.css `.grid-block .grd-img-empty` 와 같은 표식. */
export const GRID_EMPTY_SLOT_SEL = '.grid-block .grd-img-empty';

export function isImageMemoHost(el) {
  return !!el && typeof el.matches === 'function' && el.matches(IMAGE_MEMO_HOST_SEL);
}

export function getImageMemo(el) {
  return (el && typeof el.getAttribute === 'function' && el.getAttribute(IMAGE_MEMO_ATTR)) || '';
}

/* 앞뒤 공백·빈 줄만 턴다. 안쪽 줄바꿈(⇧Enter)은 그대로 둔다 — CSS 가 pre-wrap 으로 그린다. */
function _normalize(text) {
  return String(text ?? '').replace(/\r\n?/g, '\n').trim();
}

/** 값만 바꾼다(히스토리 없음). 바뀌었으면 true. 빈 값이면 속성을 «뗀다» — 빈 속성을 남기지 않는다. */
export function applyImageMemo(el, text) {
  if (!isImageMemoHost(el)) return false;
  const next = _normalize(text);
  if (next === getImageMemo(el)) return false;
  if (next) el.setAttribute(IMAGE_MEMO_ATTR, next);
  else el.removeAttribute(IMAGE_MEMO_ATTR);
  return true;
}

/** 사용자 편집 한 번 — 값을 바꾸고 «뒤에» 찍는다(push-after). ⌘Z 한 번이 이 한 번을 되돌린다. */
export function setImageMemo(el, text) {
  if (!applyImageMemo(el, text)) return false;
  window.pushHistory?.('이미지 메모');
  return true;   // 인스펙터 「준비할 이미지」는 data-memo 변화를 스스로 본다(js/inspector.js 관찰자)
}

/** 캡처·배송 클론에서 메모를 뗀다(자기 자신 포함). 가상요소는 속성이 없으면 안 그려진다. */
export function stripImageMemoForCapture(clone) {
  if (!clone) return 0;
  const sel = `[${IMAGE_MEMO_ATTR}]`;
  const all = [
    ...(clone.nodeType === 1 && clone.matches?.(sel) ? [clone] : []),
    ...(clone.querySelectorAll?.(sel) || []),
  ];
  all.forEach(el => el.removeAttribute(IMAGE_MEMO_ATTR));
  return all.length;
}

/* ── 「준비할 이미지」가 세는 칸 ─────────────────────────────────────────────────
 * 선택자(IMAGE_MEMO_HOST_SEL · GRID_EMPTY_SLOT_SEL)는 여기, «세는 함수»는 js/inspector.js prepImageSlotsOf.
 * ⛔세는 함수를 이 파일로 옮기지 마라 — 그건 «숨은 시안» 술어(variation-visibility.js)를 부른다.
 *   이 파일은 capture-safety 를 거쳐 «저장 경로»(save-load 썸네일)가 import 한다. 술어가 저장 경로
 *   그래프에 들어오면 tests/unit/variant-ship-leak.test.mjs V4 가 막는다(그게 맞다).
 *
 * ★★그리드 메모 «자리»(별건 — 지디가 따로 잡는다, 2026-09-30):
 *   그리드 줄은 DOM dataset 이 아니라 lines 모델(js/blocks/grid-block.js)에 산다. 메모를 붙이려면
 *   이미지 줄 스펙에 필드를 더하고(예: line.memo), 렌더러가 .grd-img-empty 에 data-memo 를 찍게
 *   하면 아래 CSS·capture-safety·getImageMemo 가 «그대로» 먹는다. ⛔이번 범위에선 구현하지 않는다. */

/* ── 그 자리 입력 ──────────────────────────────────────────────────────────────
 * ⛔블럭 «안»에 입력 요소를 넣지 않는다 — 자동저장(MutationObserver)이 그 순간을 찍으면
 *   편집용 textarea 가 프로젝트에 박힌다. body 에 fixed 로 띄워 블럭 «위»에 겹친다. */
let _open = null;   // { box, block, onScroll }

export function closeImageMemoEditor(commit) {
  const cur = _open;
  if (!cur) return;
  _open = null;
  document.getElementById('canvas-wrap')?.removeEventListener('scroll', cur.onScroll);
  window.removeEventListener('resize', cur.onScroll);
  const value = cur.box.querySelector('textarea')?.value ?? '';
  cur.box.remove();
  if (commit && cur.block.isConnected) setImageMemo(cur.block, value);
}

function _place(box, block) {
  const r = block.getBoundingClientRect();
  const w = Math.max(120, Math.min(320, r.width - 32));
  box.style.width = w + 'px';
  box.style.left = (r.left + r.width / 2 - w / 2) + 'px';
  box.style.top = (r.top + r.height / 2 - box.offsetHeight / 2) + 'px';
}

export function openImageMemoEditor(block) {
  if (!isImageMemoHost(block)) return null;
  closeImageMemoEditor(true);
  const box = document.createElement('div');
  box.className = 'img-memo-editor';
  const ta = document.createElement('textarea');
  ta.rows = 2;
  ta.placeholder = '이 자리에 들어갈 이미지 — 예) 모델컷, 상반신 정면';
  ta.value = getImageMemo(block);
  box.appendChild(ta);
  document.body.appendChild(box);

  const onScroll = () => _place(box, block);
  _open = { box, block, onScroll };
  _place(box, block);
  document.getElementById('canvas-wrap')?.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  ta.addEventListener('keydown', e => {
    e.stopPropagation();   // ⌫·⌘Z 등 편집기 단축키가 블럭에 먹지 않게
    if (e.isComposing || e.keyCode === 229) return;   // 한글 조합 중 Enter 는 «확정»이다
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); closeImageMemoEditor(true); }
    else if (e.key === 'Escape') { e.preventDefault(); closeImageMemoEditor(false); }
  });
  ta.addEventListener('blur', () => { if (_open?.box === box) closeImageMemoEditor(true); });
  ['mousedown', 'click', 'contextmenu'].forEach(t => box.addEventListener(t, e => e.stopPropagation()));
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);
  return box;
}
