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

/* ★1020t2d3(2026-10-26 S3 · 지디 처방 (25)) — «범위» — 현빈 「커서 자리·선택 영역이면 그 영역의 실제 값」.
 *   opts.range 를 주면 그 범위만 본다: 접힘(커서) = 커서가 선 그 글자 노드의 부모 하나 · 펼침(선택) = 범위와 «겹치는» 글자 노드들.
 *   ★범위가 이 글자칸 밖이면(또는 안 주면) ★옛 «블럭 전체» 그대로 — 부르는 자리 셋 중 둘(prop-multisel · text-edit 편집 복귀)은
 *     인자를 안 주므로 한 글자도 안 바뀐다. */
function _scopeTargets(contentEl, range) {
  if (!range || !contentEl.contains(range.commonAncestorContainer)) return null;
  if (range.collapsed) {
    /* 커서 = «그 글자»의 노드. 공백뿐인 노드는 위 _textNodes 가 원래 빼는 규칙 그대로 뺀다.
       글자 «사이»면 그 노드 · 노드 경계면 바로 «뒤» 글자의 노드(없으면 바로 앞) — 이웃 판정은 문서 순서(compareBoundaryPoints)로. */
    const ts = _textNodes(contentEl);
    if (!ts.length) return [contentEl];
    const c = range.startContainer, o = range.startOffset;
    if (c.nodeType === 3 && ts.includes(c) && o > 0 && o < c.nodeValue.length) return [c.parentElement || contentEl];
    const at = (t, off) => { const q = document.createRange(); q.setStart(t, off); q.collapse(true); return q; };
    const after = ts.find((t) => range.compareBoundaryPoints(Range.START_TO_START, at(t, 0)) <= 0);
    const before = [...ts].reverse().find((t) => range.compareBoundaryPoints(Range.START_TO_START, at(t, t.nodeValue.length)) >= 0);
    const pick = after || before || ts[0];
    return [pick.parentElement || contentEl];
  }
  const hit = _textNodes(contentEl).filter((t) => {
    if (!range.intersectsNode(t)) return false;
    /* 경계에 «닿기만» 한 노드는 뺀다 — 선택이 그 노드의 끝에서 시작하거나 처음에서 끝나면 그 글자는 하나도 안 골라졌다 */
    if (t === range.startContainer && range.startOffset >= t.nodeValue.length) return false;
    if (t === range.endContainer && range.endOffset <= 0) return false;
    return true;
  });
  return hit.length ? hit.map((t) => t.parentElement || contentEl) : null;
}

export function detectMix(contentEl, opts = {}) {
  const result = {
    color:      { mixed: false, value: null },
    fontSize:   { mixed: false, value: null },
    fontWeight: { mixed: false, value: null },
  };
  if (!contentEl) return result;

  const nodes = _textNodes(contentEl);
  const scoped = _scopeTargets(contentEl, opts && opts.range);
  const targets = scoped || (nodes.length > 0
    ? nodes.map(n => (n.parentElement || contentEl))
    : [contentEl]);

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
