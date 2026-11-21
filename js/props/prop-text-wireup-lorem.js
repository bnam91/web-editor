/* prop-text-wireup-lorem.js — 텍스트 패널 Content 절 «더미 글» 배선(TEXT-LOREM-FILL-01 · 현빈 261121).
 * 글 자리 = ai-text-slots.js 한 정본(findTextSlot) — 래퍼에 쓰지 않는다 · 불릿은 조각마다 li · 라이너는 한 줄 · 보통 글은 문단 사이 빈 줄(<br><br>).
 * 새 dataset 키 0 — 글자만 바뀐다 ⇒ 저장·PNG·HTML·Figma 는 평범한 글 그대로 싣는다. 이력 = push-after(prop-push-after PA-1).
 */
import { findTextSlot, writeTextSlot } from '../ai-text-slots.js';
import { loremPieces, loremText, normLorem, LOREM_MAX } from '../text-lorem.js';

/** 보통 글 칸에 문단 배열을 쓴다 — 줄바꿈은 <br>(편집기에서 Enter 로 생기는 꼴 · GIF 줄 읽기도 <br> 를 줄로 본다). */
function writePlainParas(el, paras) {
  el.replaceChildren();
  paras.forEach((p, i) => { if (i) el.append(document.createElement('br'), document.createElement('br')); el.append(document.createTextNode(p)); });
  delete el.dataset.isPlaceholder;   // ai-text-slots _clearPlaceholderFlagIfFilled 와 같은 뜻(글이 비지 않았다)
}

/** 그 블럭에 더미 글 채우기 — 썼으면 true. seed 는 시험용(안 주면 매번 다른 글). */
export function fillLorem(tb, opts, seed) {
  const slot = findTextSlot(tb);
  if (!slot) return false;
  const o = normLorem(opts);
  if (slot.kind === 'bullet') writeTextSlot(slot, loremPieces(o, seed).join('\n'));
  else if (slot.kind === 'liner') writeTextSlot(slot, loremPieces(o, seed).join(' '));
  else if (o.unit === 'paragraph' && slot.kind === 'plain') writePlainParas(slot.el, loremText(o, seed).split('\n\n'));
  else writeTextSlot(slot, loremText(o, seed).replace(/\n\n/g, ' '));
  return true;
}

export function wireLoremSection({ tb, propPanel }) {
  const btn = propPanel.querySelector('#txt-lorem-run');
  if (!btn) return;
  const unit = propPanel.querySelector('#txt-lorem-unit'), count = propPanel.querySelector('#txt-lorem-count'), lang = propPanel.querySelector('#txt-lorem-lang');
  unit?.addEventListener('change', () => { if (count) count.max = String(LOREM_MAX[unit.value] || 30); });
  btn.addEventListener('click', () => {
    if (!fillLorem(tb, { unit: unit?.value, count: count?.value, lang: lang?.value })) return;
    window.triggerAutoSave?.();
    window.pushHistory?.();   // ★적용 뒤 찍기(push-after)
  });
}
