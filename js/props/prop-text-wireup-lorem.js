/* prop-text-wireup-lorem.js — 텍스트 패널 Content 절 «더미 글» 배선(TEXT-LOREM-FILL-01 · 현빈 261121).
 * 글 자리 = ai-text-slots.js 한 정본(findTextSlot) — 래퍼에 쓰지 않는다 · 불릿은 조각마다 li · 라이너는 한 줄 · 보통 글은 문단 사이 빈 줄(<br><br>).
 * 저장 키 = data-lorem 표식 하나(아래 2차 · 더미 그대로인지) — 글 자체는 평범한 글 그대로(저장·PNG·HTML·Figma). 이력 = push-after(prop-push-after PA-1).
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

/* ═══ t13E-08·09 2차(현빈 확정 261123 · handoff/SPEC-text-height-lorem-vs-typed-261123.md «2차 확정») — 더미 글은 «높이가 주인», 사용자 글은 «내용이 주인» ═══
   · 상자 높이 = 하한(data-fixed-h = min-height · t13D-10) · 실제 = max(정한 높이, 사용자 글).
   · 높이 정한 상자: 개수 = 슬라이더 0 ~ «지금 높이에 들어가는 최대»(기본 = 최대 = 꽉) · 높이를 바꾸면(아래 변 끌기) 더미 그대로면 최대를 다시 재고 다시 꽉(window.loremRefit).
   · 높이 auto 상자: 슬라이더 1 ~ LOREM_MAX[단위] · 기본 2 · 상자가 글을 따른다.
   · «더미 그대로»= 표식 data-lorem(JSON {u 단위 · l 글 · s 씨앗 · n 개수 · m 최대(auto = null) · h 넣은 글 해시}) — 글이 해시와 같을 때만. 한 글자라도 고치면 표식을 버린다(사용자 글 · 늘어나기만 · 자름 0).
   · 옛 저장본(표식 없음) = 사용자 글(안전 기본값). 표식은 블럭 dataset 이라 저장·열기·⌘Z 가 HTML 과 같이 옮긴다.
   · 같은 씨앗으로 개수만 바꾸면 앞 조각이 같다(text-lorem rng 순서) ⇒ 이분 탐색·다시 채우기가 한 글 안에서 늘고 준다(끄는 동안 글이 뒤섞이지 않음).
   shortcut: 한 단위 조각 하나도 안 들어가는 작은 상자면 낱말로 채운다(m = 0 · 슬라이더 0~0) — 단위를 지키라면 그때 «비움»으로. */
/* ★174 t13E-08 채점 되돌림(지디 261123 · 미카사 실앱 ❌ «래퍼 161 고정인데 채울 때마다 글이 3378px 로 커짐») — 상자 높이가 style.height 로도 굳어 있으면(옛 꼴·다른 길)
   ① 재는 자(_contentH)가 min-height 만 걷어 offsetHeight 가 늘 161 → «30개도 들어감»으로 셈 ② 하한(_cap)은 data-fixed-h 만 봐 그 상자를 «정한 높이»로 못 알아봄.
   ⇒ 잴 때 height·min-height 둘 다 걷고, 하한은 data-fixed-h 없으면 px 로 굳은 style.height 도 «정한 높이»로 본다(시험 tests/dom/text-lorem-regrade R1·R1b). */
const _contentH = (box) => { const mh = box.style.minHeight, hh = box.style.height; box.style.minHeight = ''; box.style.height = ''; const h = box.offsetHeight; box.style.minHeight = mh; box.style.height = hh; return h; };
const _boxOf = (tb) => posElOf(tb) || tb;
const _cap = (tb) => { const b = _boxOf(tb), v = Number(b.dataset.fixedH); if (v > 0) return v; const sh = /^(\d+(?:\.\d+)?)px$/.exec(b.style.height || ''); return sh ? Math.round(Number(sh[1])) : 0; };
function _hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return `${s.length}:${(h >>> 0).toString(36)}`; }   // FNV-1a
const _textOf = (tb) => (findTextSlot(tb)?.el?.textContent ?? '');
/** 더미 그대로면 표식 객체 · 아니면 null(그리고 낡은 표식은 버린다). */
export function loremMark(tb) {
  if (!tb?.dataset?.lorem) return null;
  let m = null; try { m = JSON.parse(tb.dataset.lorem); } catch (_) { m = null; }
  if (!m || m.h !== _hash(_textOf(tb))) { delete tb.dataset.lorem; return null; }
  return m;
}
function _write(tb, o, seed, n) {
  if (n <= 0) { const slot = findTextSlot(tb); if (!slot) return false; writeTextSlot(slot, ''); return true; }
  return fillLorem(tb, { ...o, count: n }, seed);
}
/** 높이 cap 에 들어가는 가장 큰 개수(단위 u · 0 = 하나도 안 들어감) — 끝나면 글은 그 개수로 쓰여 있다. */
function _maxFit(tb, o, seed, cap, u = o.unit) {
  const box = _boxOf(tb), fits = (n) => _write(tb, { ...o, unit: u }, seed, n) && _contentH(box) <= cap;
  if (!fits(1)) return 0;
  let lo = 1, hi = LOREM_MAX[u] || 30;
  while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (fits(mid)) lo = mid; else hi = mid - 1; }
  return lo;
}
/** 더미 넣기 — {unit, lang, seed?, n?} · 높이 정한 상자면 n = min(n ?? 최대, 최대) · auto 면 n(기본 2). 표식을 남기고 {n, m} 을 돌려준다. */
export function applyLorem(tb, opts = {}) {
  const slot = findTextSlot(tb);
  if (!slot) return null;
  const o = normLorem({ unit: opts.unit, lang: opts.lang, count: 2 }), seed = Number.isFinite(opts.seed) ? opts.seed : Math.floor(Math.random() * 2 ** 31);
  const cap = _cap(tb);
  let n, m = null, u = o.unit;
  if (cap) {
    m = _maxFit(tb, o, seed, cap);
    if (m === 0 && u !== 'word') { u = 'word'; const w = _maxFit(tb, o, seed, cap, 'word'); _write(tb, { ...o, unit: 'word' }, seed, Math.max(1, w)); n = 0; }   // 작은 상자 = 낱말로(위 shortcut)
    else { n = opts.n == null ? m : Math.max(0, Math.min(m, Math.round(opts.n))); _write(tb, o, seed, n); }
  } else {
    n = Math.max(1, Math.min(LOREM_MAX[u] || 30, Math.round(opts.n ?? 2)));
    _write(tb, o, seed, n);
  }
  tb.dataset.lorem = JSON.stringify({ u: o.unit, l: o.lang, s: seed, n, m, h: _hash(_textOf(tb)) });
  return { n, m };
}
/** 아래 변 끌기(t13D-10 손잡이)가 부른다 — 더미 그대로면 정한 높이 = want 로 두고 다시 꽉 채운 뒤 true(손잡이는 옛 «내용보다 작게 못 줄임» 셈을 건너뜀) · 사용자 글이면 false. */
export function loremRefit(posEl, want) {
  const tb = posEl?.matches?.('.text-block, .speech-bubble-block, .icon-text-block') ? posEl : posEl?.querySelector?.('.text-block, .speech-bubble-block, .icon-text-block');
  const mk = tb && loremMark(tb);
  if (!mk) return false;
  const box = _boxOf(tb), h = Math.max(20, Math.round(want));
  box.dataset.fixedH = String(h); box.style.minHeight = h + 'px';
  const r = applyLorem(tb, { unit: mk.u, lang: mk.l, seed: mk.s });   // n 없음 = 다시 꽉(현빈 2차 ①)
  _syncPanel(tb, r);
  return true;
}
let _panelTb = null, _panelSync = null;
function _syncPanel(tb, r) { if (tb === _panelTb && _panelSync && r) _panelSync(r); }

export function wireLoremSection({ tb, propPanel }) {
  const btn = propPanel.querySelector('#txt-lorem-run');
  if (!btn) return;
  const unit = propPanel.querySelector('#txt-lorem-unit'), count = propPanel.querySelector('#txt-lorem-count'), slider = propPanel.querySelector('#txt-lorem-count-slider'), lang = propPanel.querySelector('#txt-lorem-lang');
  const set = (min, max, v) => { for (const e of [slider, count]) { if (!e) continue; e.min = String(min); e.max = String(max); e.value = String(v); } };
  /* 칸 범위 — 표식 있으면 그 값(높이 정한 상자 = 0~m · auto = 1~상한) · 없으면 정한 높이 = 0~상한(아직 모름 · 처음 넣을 때 잰다) · auto = 1~상한 · 기본 2 */
  const mk = loremMark(tb), cap = _cap(tb);
  if (mk) { if (unit) unit.value = mk.u; if (lang) lang.value = mk.l; }
  const U = () => unit?.value || 'sentence', MAX = () => LOREM_MAX[U()] || 30;
  if (mk && mk.m != null && cap) set(0, mk.m, mk.n); else if (mk) set(1, MAX(), mk.n); else if (cap) set(0, MAX(), MAX()); else set(1, MAX(), 2);
  _panelTb = tb; _panelSync = (r) => { if (r.m != null) set(0, r.m, r.n); else set(1, MAX(), r.n); };
  const live = (n) => {   // 끄는 동안 바로 — 더미 그대로일 때만(사용자 글·안내문구를 덮지 않는다 · 처음 넣기는 «채우기»)
    const m2 = loremMark(tb); if (!m2) return null;
    const r = applyLorem(tb, { unit: U(), lang: lang?.value, seed: m2.s, n }); _panelSync(r); window.triggerAutoSave?.(); return r;
  };
  slider?.addEventListener('input', () => { if (count) count.value = slider.value; live(Number(slider.value)); });
  slider?.addEventListener('change', () => { if (loremMark(tb)) window.pushHistory?.(); });   // 끄기 끝 = 한 번(push-after)
  count?.addEventListener('change', () => { if (slider) slider.value = count.value; if (live(Number(count.value))) window.pushHistory?.(); });
  unit?.addEventListener('change', () => {
    if (live(null)) { window.pushHistory?.(); return; }   // 더미면 새 단위로 다시(정한 높이 = 꽉 · auto = 지금 개수)
    if (_cap(tb)) set(0, MAX(), MAX()); else set(1, MAX(), Math.min(MAX(), Number(count?.value) || 2));
  });
  btn.addEventListener('click', () => {   // 처음 넣기 · 다시 섞기(새 씨앗) — 정한 높이 = 꽉 · auto = 칸 개수
    const r = applyLorem(tb, { unit: U(), lang: lang?.value, n: _cap(tb) ? null : Number(count?.value) || 2 });
    if (!r) return;
    _panelSync(r);
    window.triggerAutoSave?.();
    window.pushHistory?.();   // ★적용 뒤 찍기(push-after)
  });
}
if (typeof window !== 'undefined') Object.assign(window, { loremRefit, loremMark, applyLorem });
