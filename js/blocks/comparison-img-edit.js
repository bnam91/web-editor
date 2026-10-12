// comparison-img-edit.js — 비교(comparison) 블럭 «이미지 칸» 편집기 (1012t1D3 · 2026-10-12)
//
// 현빈: 「하나의 셀 안에 그리드 블럭처럼 우클릭을 통해서 이미지칸으로 쓸 수 있는데 이미지 삽입 후 이미지 편집이 안 되는 문제」
//
// ★꼴은 카드블럭 편집기(canvas-block.js _enterCvbImgEditMode)를 따른다 — 비교 이미지 칸도 카드처럼
//   <img> 가 아니라 «배경이미지 div» 다(⛔그리드 크롭 편집기는 <img>+％프레임 전제라 안 맞는다).
//     드래그 = imgX/imgY(%) · 휠 = imgScale(100~400) · Esc/바깥 클릭 = 끝 · ⌫/Delete = 그림만 비움(칸은 빈 슬롯으로 남음)
// ★모델이 정본 — renderComparison 이 div 를 갈아끼우므로 편집 «중»엔 렌더하지 않고 그 div 의 style 만 고친다.
//   모델(dataset.cols)엔 드래그 끝·휠마다 쓴다 ⇒ 끝날 때 다시 그릴 필요가 없다
//   (⛔끝에서 렌더하면 «바깥 클릭»의 mousedown 대상이 떨어져 나가 그 클릭이 죽는다).
// ★히스토리 — 드래그는 «양쪽 끝»(beginDragHistory arm + onUp pushHistory · js/CLAUDE.md 규약) · 휠은 끝날 때 한 번.
// ★크기 손잡이는 «안 만든다»(결정 ⑦) — 비교 행 높이는 행 인덱스 단위 «전 칼럼 공통»(rowHeights)이라 칸 하나 코너가 뜻이 다르다.
//
// ★D4(색보정·블러)가 꽂을 자리: 아래 _enterHooks / _exitHooks (onCmpImgEdit 으로 등록).
import { getComparisonCols, setComparisonCols, renderComparison, cmpImgBgSize } from './comparison-block.js';

const EDIT_CLS = 'cmp-img-editing';
let _exitActive = null;           // 지금 열린 편집기의 끝내기(한 번에 하나)
const _enterHooks = [];
const _exitHooks = [];
/* ★D4 꽂는 자리 — enter(ctx) / exit(ctx). ctx = { block, addr, div, getRow(), writeRow(mutate) }.
   예: 색보정 = enter 에서 showColorAdjustPanel(ctx.div, { onChange: adj => ctx.writeRow(r => { r.adj = {...adj}; }) }) · exit 에서 hide. */
export function onCmpImgEdit(enter, exit) {
  if (typeof enter === 'function') _enterHooks.push(enter);
  if (typeof exit === 'function') _exitHooks.push(exit);
}

const _rowOf = (cols, addr) => cols?.[addr.colIdx]?.rows?.[addr.rowIdx] || null;
const _divOf = (block, addr) =>
  block.querySelector(`.cmp-row.cmp-img[data-col-idx="${addr.colIdx}"][data-row-idx="${addr.rowIdx}"]`);

export function isCmpImageEditing(block) {
  return !!block?.querySelector?.('.' + EDIT_CLS);
}
export function exitCmpImageEditMode() { _exitActive?.(); }

export function enterCmpImageEditMode(block, addr) {
  if (!block || !addr) return false;
  const row0 = _rowOf(getComparisonCols(block.dataset), addr);
  if (!row0 || row0.type !== 'image' || !row0.imgSrc) return false;   // 빈 슬롯은 편집기가 아니라 파일 고르기(block-drag.js)
  const div = _divOf(block, addr);
  if (!div) return false;
  if (div.classList.contains(EDIT_CLS)) return true;
  _exitActive?.();

  const getRow = () => _rowOf(getComparisonCols(block.dataset), addr);
  /* 모델에 쓰기(렌더 없음) — 편집 중 div 를 살려 둔다. */
  const writeRow = (mutate) => {
    const cols = getComparisonCols(block.dataset);
    const row = _rowOf(cols, addr); if (!row) return null;
    mutate(row); setComparisonCols(block, cols);
    return row;
  };
  const ctx = { block, addr, div, getRow, writeRow };

  div.classList.add(EDIT_CLS);
  const hint = document.createElement('div');
  hint.className = 'img-edit-hint';   // ★에셋 편집 칩과 같은 꼴(css/editor-blocks.css .img-edit-hint) — 새 색 0 · 복제 정리(section-variation)도 이 이름을 안다
  const _updateHint = () => {
    const s = Math.max(100, Number(getRow()?.imgScale) || 100);
    hint.textContent = s <= 100
      ? '휠로 확대하면 위치를 조절할 수 있어요 · ESC 종료'
      : '드래그 이동 · 휠 확대/축소 · ESC/바깥클릭 종료';
  };
  _updateHint();
  div.appendChild(hint);

  let _wheelDirty = false;
  const exitMode = () => {
    if (_exitActive !== exitMode) return;
    _exitActive = null;
    div.classList.remove(EDIT_CLS);
    hint.remove();
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('mousedown', onOutside, true);
    div.removeEventListener('mousedown', onDragStart);
    div.removeEventListener('wheel', onWheel);
    div.removeEventListener('click', onClickInside);
    _exitHooks.forEach(fn => { try { fn(ctx); } catch (_) {} });
    if (_wheelDirty) { window.pushHistory?.('비교 이미지 확대'); window.scheduleAutoSave?.(); }
  };
  _exitActive = exitMode;

  const onKey = (e) => {
    if (!div.isConnected) { exitMode(); return; }   // ⌘Z 등으로 DOM 이 갈렸다 — 낡은 칸에 쓰지 않는다
    if (e.key === 'Escape') {
      e.preventDefault(); e.stopImmediatePropagation();   // Esc = 편집 끝 «만»(선택이 위로 올라가지 않게)
      exitMode(); return;
    }
    /* ⌫/Delete = 이 칸의 그림만 비운다. capture + stopImmediatePropagation 으로 전역 「블록 삭제」를 선점
       (카드에서 「이미지 지우려다 블럭 통삭제」 사고 — 같은 방어). 칸(type image)은 빈 슬롯으로 남는다. */
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault(); e.stopImmediatePropagation();
      exitMode();
      const cols = getComparisonCols(block.dataset);
      const row = _rowOf(cols, addr); if (!row) return;
      row.imgSrc = '';
      delete row.imgX; delete row.imgY; delete row.imgScale;   // 위치/확대도 초기화(카드와 같다)
      delete row.redact;   // ★D4 블러도 끈다(에셋 clearAssetImage 와 같다 — 남기면 다음 그림이 말없이 흐려진다). 색보정 adj 는 카드처럼 둔다.
      setComparisonCols(block, cols);
      try { renderComparison(block); } catch (_) {}
      window.pushHistory?.('비교 이미지 제거'); window.scheduleAutoSave?.();
      if (block.classList.contains('selected')) window.showComparisonProperties?.(block);
    }
  };
  document.addEventListener('keydown', onKey, true);

  const onOutside = (e) => {
    if (e.target?.closest?.('#color-adjust-panel')) return;   // D4 색보정 패널 클릭은 편집 유지(카드와 같다)
    if (!div.contains(e.target)) exitMode();
  };
  setTimeout(() => { if (_exitActive === exitMode) document.addEventListener('mousedown', onOutside, true); }, 0);

  /* 편집 중 칸 안 클릭은 블럭 click(선택 다시 잡기·패널 다시 그리기)으로 올려 보내지 않는다. */
  const onClickInside = (e) => { e.stopPropagation(); };
  div.addEventListener('click', onClickInside);

  const onWheel = (we) => {
    we.preventDefault(); we.stopPropagation();
    const cur = Math.min(400, Math.max(100, Number(getRow()?.imgScale) || 100));
    const next = Math.min(400, Math.max(100, cur - Math.sign(we.deltaY) * 5));
    if (next === cur) return;
    const row = writeRow(r => { r.imgScale = next; });
    if (!row) return;
    div.style.backgroundSize = cmpImgBgSize(row);
    _updateHint();
    _wheelDirty = true;
  };
  div.addEventListener('wheel', onWheel, { passive: false });

  const onDragStart = (e) => {
    if (e.button !== 0) return;
    e.stopPropagation(); e.preventDefault();
    const r0 = getRow() || {};
    const sx = e.clientX, sy = e.clientY;
    const startX = r0.imgX ?? 50, startY = r0.imgY ?? 50;
    let curX = startX, curY = startY;
    /* 화면 → 캔버스(설계) 좌표: 줌 × 블럭 축소(transform scale) 둘 다 — 그려진 폭 ÷ 레이아웃 폭. */
    const k = (div.getBoundingClientRect().width / (div.offsetWidth || 1)) || 1;
    const _hist = window.beginDragHistory?.('비교 이미지 위치');
    const onMove = (me) => {
      const dx = (me.clientX - sx) / k, dy = (me.clientY - sy) / k;
      _hist?.arm(dx, dy);
      curX = Math.max(0, Math.min(100, startX - dx * 0.1));
      curY = Math.max(0, Math.min(100, startY - dy * 0.1));
      div.style.backgroundPosition = `${curX}% ${curY}%`;
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (curX === startX && curY === startY) return;   // 맨클릭 — 모델·히스토리 무변화
      const row = writeRow(r => { r.imgX = Math.round(curX * 10) / 10; r.imgY = Math.round(curY * 10) / 10; });
      // 그려진 값도 모델(반올림)과 같게 — 다시 그린 판과 스냅숏 바이트가 갈리지 않게
      if (row) div.style.backgroundPosition = `${row.imgX}% ${row.imgY}%`;
      window.pushHistory?.('비교 이미지 위치');
      window.scheduleAutoSave?.();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };
  div.addEventListener('mousedown', onDragStart);

  _enterHooks.forEach(fn => { try { fn(ctx); } catch (_) {} });
  return true;
}

/* ★1012t1D4 색보정 — 에셋·카드와 «같은 몸짓»: 편집기에 들어가면 플로팅 패널(#color-adjust-panel)이 뜨고, 나가면 닫힌다
   (에셋 image-handling.js enterImageEditMode 끝 / 카드 canvas-block.js _enterCvbImgEditMode 와 같은 규약 · 우측 패널 단추는 둘 다 없다).
   정본 = 모델 row.adj — 편집 중엔 렌더하지 않으므로 슬라이더는 이 div 에 바로 칠하고(applyImgColorAdjust) 모델엔 되쓰기만 한다.
   전부 0(초기화) = 키를 지운다(옛 저장본과 같은 바이트). 바깥 클릭 판정은 위 onOutside 가 #color-adjust-panel 을 이미 뺀다. */
onCmpImgEdit(
  (ctx) => {
    window.showColorAdjustPanel?.(ctx.div, {
      onChange: (adj) => ctx.writeRow((r) => {
        const any = adj && Object.values(adj).some(v => Math.abs(Number(v) || 0) > 0.001);
        if (any) r.adj = { ...adj }; else delete r.adj;
      }),
    });
  },
  () => { window.hideColorAdjustPanel?.(); },
);

window.enterCmpImageEditMode = enterCmpImageEditMode;
window.exitCmpImageEditMode  = exitCmpImageEditMode;
window.isCmpImageEditing     = isCmpImageEditing;
window.onCmpImgEdit          = onCmpImgEdit;
