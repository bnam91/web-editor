/* prop-text-mix-detect.js
 * 텍스트 블록 내 자식 텍스트들의 스타일(color / fontSize / fontWeight) 이
 * 균일한지 검사. 균일하지 않으면 "Mix" 로 표기하기 위한 헬퍼.
 *
 * 반환:
 *   {
 *     color:      { mixed: bool, value: string|null },
 *     fontSize:   { mixed: bool, value: number|null },
 *     fontWeight: { mixed: bool, value: string|null },
 *   }
 *
 * 알고리즘:
 *  - contentEl 내부 모든 텍스트 노드(공백만 있는 것 제외)를 순회
 *  - 각 텍스트 노드의 부모 element 의 computedStyle 에서 color / fontSize / fontWeight 추출
 *  - 텍스트 노드가 하나뿐이면 contentEl 자체의 computedStyle 사용 (균일)
 *  - 모든 값이 동일하면 mixed=false, 값 유지 / 다르면 mixed=true, value=null
 */

function _textNodes(root) {
  const out = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      // 빈/공백만 노드는 스킵
      if (!n.nodeValue || !n.nodeValue.replace(/\s+/g, '')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  let node;
  while ((node = walker.nextNode())) out.push(node);
  return out;
}

function _normalizeWeight(w) {
  if (!w) return '400';
  if (w === 'normal') return '400';
  if (w === 'bold') return '700';
  return String(w);
}

export function detectMix(contentEl) {
  const result = {
    color:      { mixed: false, value: null },
    fontSize:   { mixed: false, value: null },
    fontWeight: { mixed: false, value: null },
  };
  if (!contentEl) return result;

  const nodes = _textNodes(contentEl);
  const targets = nodes.length > 0
    ? nodes.map(n => (n.parentElement || contentEl))
    : [contentEl];

  const colorSet  = new Set();
  const sizeSet   = new Set();
  const weightSet = new Set();

  for (const el of targets) {
    const cs = window.getComputedStyle(el);
    colorSet.add(cs.color);
    sizeSet.add(Math.round(parseFloat(cs.fontSize) || 0));
    weightSet.add(_normalizeWeight(cs.fontWeight));
  }

  result.color.mixed       = colorSet.size > 1;
  result.color.value       = colorSet.size === 1 ? [...colorSet][0] : null;
  result.fontSize.mixed    = sizeSet.size > 1;
  result.fontSize.value    = sizeSet.size === 1 ? [...sizeSet][0] : null;
  result.fontWeight.mixed  = weightSet.size > 1;
  result.fontWeight.value  = weightSet.size === 1 ? [...weightSet][0] : null;

  return result;
}
