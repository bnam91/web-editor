/* prop-text-wireup-lorem.js — 텍스트 패널 Content 절 «더미 글» 배선(TEXT-LOREM-FILL-01 · 현빈 261121).
 * 글 자리 = ai-text-slots.js 한 정본(findTextSlot) — 래퍼에 쓰지 않는다 · 불릿은 조각마다 li · 라이너는 한 줄 · 보통 글은 문단 사이 빈 줄(<br><br>).
 * 새 dataset 키 0 — 글자만 바뀐다 ⇒ 저장·PNG·HTML·Figma 는 평범한 글 그대로 싣는다. 이력 = push-after(prop-push-after PA-1).
 */
import { findTextSlot, writeTextSlot } from '../ai-text-slots.js';
import { loremPieces, loremText, normLorem, LOREM_MAX } from '../text-lorem.js';
import { posElOf } from '../overlay-float.js';

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

/* t13E-08(현빈 261122 «높이에 맞춰 양만 채우고 블럭 높이는 고정») — 상자 높이를 사용자가 정했으면(data-fixed-h · t13D-10 손잡이) 그 높이에 들어가는 만큼만 쓴다.
   높이는 «최소 높이»라 글이 넘치면 상자가 따라 커졌다(실측 208 → 864 · 1글 → 다시 208). 개수 칸 = 상한(패널 칸 뜻 무변) · 한 조각도 넘치면 낱말로 줄인다.
   높이를 안 정한(auto) 상자는 옛 동작(글 = 개수 그대로 · 상자가 글을 따른다). 같은 씨앗으로 개수만 바꾸면 앞 조각이 같다(text-lorem rng 순서) ⇒ 이분 탐색이 한 글 안에서 자른다. */
const _contentH = (box) => { const mh = box.style.minHeight; box.style.minHeight = ''; const h = box.offsetHeight; box.style.minHeight = mh; return h; };
export function fillLoremFit(tb, opts, seed) {
  const box = posElOf(tb) || tb, cap = Number(box.dataset.fixedH);
  if (!(cap > 0)) return fillLorem(tb, opts, seed);
  const o = normLorem(opts), s = Number.isFinite(seed) ? seed : Math.floor(Math.random() * 2 ** 31);
  const most = (u, max) => {   // u 단위로 1..max 중 들어가는 가장 큰 개수를 쓰고 그 수(0 = 하나도 안 들어감)
    const fits = (n) => fillLorem(tb, { ...o, unit: u, count: n }, s) && _contentH(box) <= cap;
    if (!fits(1)) return 0;
    let lo = 1, hi = max;
    while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (fits(mid)) lo = mid; else hi = mid - 1; }
    fits(lo); return lo;
  };
  if (most(o.unit, o.count)) return true;
  if (o.unit !== 'word' && most('word', LOREM_MAX.word)) return true;
  return fillLorem(tb, { ...o, unit: 'word', count: 1 }, s);   // 낱말 하나도 넘치는 작은 상자 — 한 낱말(비우지 않는다)
}

export function wireLoremSection({ tb, propPanel }) {
  const btn = propPanel.querySelector('#txt-lorem-run');
  if (!btn) return;
  const unit = propPanel.querySelector('#txt-lorem-unit'), count = propPanel.querySelector('#txt-lorem-count'), lang = propPanel.querySelector('#txt-lorem-lang');
  unit?.addEventListener('change', () => { if (count) count.max = String(LOREM_MAX[unit.value] || 30); });
  btn.addEventListener('click', () => {
    if (!fillLoremFit(tb, { unit: unit?.value, count: count?.value, lang: lang?.value })) return;
    window.triggerAutoSave?.();
    window.pushHistory?.();   // ★적용 뒤 찍기(push-after)
  });
}
