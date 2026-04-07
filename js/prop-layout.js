function getCurrentRatioStr(block) {
  const row = block.closest('.row');
  if (!row) return '1*1';
  if (row.dataset.ratioStr) return row.dataset.ratioStr;
  return '1*1';
}

window.getCurrentRatioStr = getCurrentRatioStr;
