/* block-edit.js — 기존 텍스트 블록 편집(window 전역, NO ES module).
 * PM Claude의 update_block(MCP) → main(_invokeRendererEditBlock) → 여기 window.editTextBlock.
 * add_text_block(block-factory.js) 패턴을 미러링: pushHistory(undo) + scheduleAutoSave + applyTextOpts 정렬 규칙.
 */

// id로 블록 element 반환 (블록 컨테이너 아니면 null)
// '-block'으로 끝나는 클래스 + dataset.type 동시 충족만 블록으로 인정.
// (row/section/col 등 비블록 컨테이너는 dataset.type 없어 차단)
function getBlockById(id) {
  if (!id) return null;
  const el = document.getElementById(String(id));
  if (!el || !el.classList) return null;
  const isBlockEl = [...el.classList].some((c) => c.endsWith('-block')) && !!el.dataset?.type;
  return isBlockEl ? el : null;
}

// 대상 블록만 선택 상태로 전환. 다른 선택 해제 + 우측 패널 갱신.
function selectBlock(id) {
  const block = getBlockById(id);
  if (!block) return false;
  /* 기존 선택 해제 = «정본 한 자리»(js/editor.js clearSelectionMarks).
     ★2026-09-21 T-084: 예전엔 여기서 `.selected` «한 클래스»만 벗겼다. 그런데 캔버스의
       선택 표시는 두 벌 이상이다 — 배너 줄(.bn2-line-selected) · 그리드 줄/칸 · 스텝 ·
       라벨 항목(.item-selected) · 표 셀(.cell-selected) · .row-active · 레이어 패널 .active.
       ⇒ 배너 «줄»을 고른 채 도구막대로 블럭을 넣으면 새 블럭에도 파란 선이 붙고
         옛 배너 줄의 파란 선이 «그대로 남아» 파란 상자가 둘이 됐다(9542 실측).
     ⛔여기에 마커 목록을 «또» 적지 마라 — 목록이 둘이 되는 순간 한쪽이 낡는다.
     ⚠️editor.js 없이 block-edit.js 만 얹는 하네스(tests/dom 일부)가 있어 폴백을 둔다. */
  window.clearMultiSel?.();
  if (typeof window.clearSelectionMarks === 'function') {
    window.clearSelectionMarks();
  } else {
    document.querySelectorAll('.selected').forEach((el) => {
      if (el !== block) el.classList.remove('selected');
    });
  }
  block.classList.add('selected');
  /* 우측 패널 = «정본 표 한 자리»(js/panel-dispatch.js).
     ★2026-09-21 T-079: 여기에 9종짜리 «사본»이 있었고 폴백이 `else showTextProperties` 였다.
       배너를 넣은 그 순간 텍스트 패널이 떠서 글자크기가 .bn2-label 의 인라인에 찍혔고,
       banner02 의 정본은 dataset.lines 이라 저장/로드의 renderBanner02 가 그걸 폐기했다
       = 「저장했는데 다시 열면 원래 크기」. 표에 없는 타입은 이제 «안 연다»(엉뚱한 패널보다 덜 틀리다).
     ⚠️여기서 핸들은 붙이지 않는다 — 예전 동작 그대로(붙이는 자리는 클릭·레이어·복원 경로다). */
  window.openPanelForBlock?.(block);
  /* 좌측 레이어 패널의 «지금 이것» 표시도 같은 자리에서 — 클릭 경로(js/block-drag.js)와 «같은» 호출.
     ★블록 이름 목록이 필요 없다: 연결은 buildLayerPanel 이 심어 둔 block._layerItem «성질»이다.
       빠져 있으면 도구막대로 넣은 블럭이 레이어 목록에서 강조되지 않아
       「지금 무엇을 고치는 중인지」가 왼쪽에서도 안 보였다(T-084 실측). */
  window.highlightBlock?.(block, block._layerItem);
  return true;
}

// 기존 텍스트 블록의 content/color/fontSize/fontWeight/align 수정.
function editTextBlock(blockId, opts = {}) {
  const block = getBlockById(blockId);
  if (!block) {
    return { ok: false, code: 'NOT_FOUND', message: `text-block not found: ${blockId}` };
  }
  const contentEl = block.querySelector('[class^="tb-"]');
  if (!contentEl) {
    return { ok: false, code: 'NOT_FOUND', message: `content element not found in block: ${blockId}` };
  }
  const type = block.dataset.type;

  // undo 통합 — mutate 전에 호출
  window.pushHistory?.();

  // 현재 상태 캡처 (반환용 before)
  const before = {
    content: contentEl.textContent,
    color: contentEl.style.color || null,
    fontSize: contentEl.style.fontSize || null,
    fontWeight: contentEl.style.fontWeight || null,
    align: (type === 'label' ? block.style.textAlign : contentEl.style.textAlign) || null,
  };

  const applied = {};

  if (opts.content !== undefined && opts.content !== null) {
    const text = String(opts.content);
    // bullet(<ul class="tb-bullet">)은 textContent로 덮으면 <li> 구조가 파괴됨 → 줄마다 <li> 재구성
    if (contentEl.matches('ul.tb-bullet')) {
      contentEl.replaceChildren(...text.split(/\r?\n/).map((line) => {
        const li = document.createElement('li');
        li.textContent = line;
        return li;
      }));
    } else {
      contentEl.textContent = text;
    }
    contentEl.style.whiteSpace = 'pre-wrap';
    delete contentEl.dataset.isPlaceholder;
    applied.content = text;
  }
  if (opts.color !== undefined && opts.color !== null) {
    // 0918r2 textgrad: 단색 지정 = 글자 그라데이션 해제(안 풀면 그라데이션이 단색을 가린다)
    window.clearTextGradient?.(contentEl);
    contentEl.style.color = opts.color;
    window.forgetLabelAutoColor?.(contentEl);   // 0920r6 labeltext: MCP/PM 이 정한 색 — 라벨 표식 폐기(타입 전환 때 안 걷어내게)
    applied.color = opts.color;
  }
  if (opts.fontSize !== undefined && opts.fontSize !== null) {
    contentEl.style.fontSize = opts.fontSize + 'px';
    applied.fontSize = opts.fontSize;
  }
  if (opts.fontWeight !== undefined && opts.fontWeight !== null) {
    contentEl.style.fontWeight = opts.fontWeight;
    applied.fontWeight = opts.fontWeight;
  }
  if (opts.align !== undefined && opts.align !== null) {
    // applyTextOpts 규칙 미러: label은 block, 그 외는 contentEl에 정렬 적용
    if (type === 'label') block.style.textAlign = opts.align;
    else contentEl.style.textAlign = opts.align;
    applied.align = opts.align;
  }

  window.scheduleAutoSave?.();

  // 선택 상태면 우측 패널 갱신
  if (block.classList.contains('selected')) {
    try { window.showTextProperties?.(block); } catch (_) {}
  }

  return { ok: true, blockId, type, before, applied };
}

window.getBlockById = getBlockById;
window.selectBlock = selectBlock;
window.editTextBlock = editTextBlock;
