/* block-edit.js — 기존 텍스트 블록 편집(window 전역, NO ES module).
 * PM Claude의 update_block(MCP) → main(_invokeRendererEditBlock) → 여기 window.editTextBlock.
 * add_text_block(block-factory.js) 패턴을 미러링: pushHistory(undo) + scheduleAutoSave + applyTextOpts 정렬 규칙.
 */

// id로 .text-block element 반환 (없거나 text-block 아니면 null)
function getBlockById(id) {
  if (!id) return null;
  const el = document.getElementById(String(id));
  if (!el || !el.classList || !el.classList.contains('text-block')) return null;
  return el;
}

// 대상 블록만 선택 상태로 전환. 다른 선택 해제 + 우측 패널 갱신.
function selectBlock(id) {
  const block = getBlockById(id);
  if (!block) return false;
  // 기존 선택 해제
  document.querySelectorAll('.selected').forEach((el) => {
    if (el !== block) el.classList.remove('selected');
  });
  block.classList.add('selected');
  try { window.showTextProperties?.(block); } catch (_) {}
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
    contentEl.textContent = String(opts.content);
    contentEl.style.whiteSpace = 'pre-wrap';
    delete contentEl.dataset.isPlaceholder;
    applied.content = String(opts.content);
  }
  if (opts.color !== undefined && opts.color !== null) {
    contentEl.style.color = opts.color;
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
