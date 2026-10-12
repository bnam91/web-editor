/* text-style-chips — 「★최근 효과」 줄. (2026-10-08 · 현빈 「저장한 스타일도 복사할수 있게」)
 *
 * ★선례를 ★그대로 베낀다 — js/props/color-var-chips.js 의 «최근 쓴 색 줄»(현빈 2026-10-02 B안).
 *   ⛔새 꼴을 ★만들지 않았다: 줄은 `.cv-chips`, 칩은 `.cv-chip`, 라벨은 `.cv-chips-label`.
 *   0건이면 ★줄을 ★안 그린다 — ★그 규약도 ★거기서 왔다.
 *
 * ★★그 파일 :63 이 적어 둔 ⛔「★누르면 ★하는 일이 ★다르면 ★한 줄에 ★섞지 마라」를 ★지킨다 —
 *   ★형광펜 칩과 ★그라데이션 칩은 ★누르면 ★하는 일이 ★다르다 ⇒ ★★kind 마다 ★제 줄이다.
 *   ⇒ ★기계는 ★하나(저장소·뜨기·입히기), ★줄은 ★여럿. ★그것이 ★T14·T15 를 ★한 기계로 묶는 꼴이다.
 *
 * ★★칩이 ★제품 클래스(tb-hl·tb-dot)를 ★그대로 입는 까닭 —
 *   ★미리보기를 ★손으로 그리면 ★제품이 바뀔 때 ★조용히 갈린다. ⇒ ★같은 CSS 가 ★그리게 둔다.
 *   ⚠️그래도 ★안전한가를 ★쟀다(2026-10-08): `span.tb-hl`·`span.tb-dot` 을 ★찾는 자리는 ★레포 전수 ★5건이고
 *     ★다섯이 ★전부 «글 블럭(contentEl/el/frag) ★안»만 본다 — ★document 전역 조회는 ★0건.
 *     ⇒ ★칩은 ★글 블럭 ★밖(패널)이라 ★그 다섯이 ★안 속는다.
 *     ★그 «밖에 있음»은 ★tests/dom/text-style-recent.dom.spec.js ★C5 가 ★양성대조와 함께 ★잠근다.
 *   ⛔클래스 ★문자열을 ★베끼지 않는다 — ★HL_CLASS·DOT_CLASS 를 ★import 해서 쓴다(text-style-kinds.js).
 */
import { escHtml } from './_helpers.js';
import { TEXT_STYLE_KINDS, textStyleKind, previewInlineStyle, previewClassFor, PREVIEW_GLYPH } from './text-style-kinds.js';

/** kind 의 최근 줄 id — ★한 자리에서 짓는다(마크업·배선·검사가 ★같은 이름을 쓴다). */
export const tsRecentRowId = (p, k) => `${p}-${k}-recent-row`;

function _chipHtml(k, rec, i) {
  const d = textStyleKind(k);
  const style = previewInlineStyle(k, rec && rec.v);
  /* ⛔style 이 빈 문자열이면 ★칩을 ★안 그린다 — 「눌리는데 아무 일도 안 난다」를 ★만들지 않는다
     (저장본이 ★미래 꼴이거나 ★깨진 값일 때 여기로 온다). */
  if (!style) return '';
  const label = d ? d.label : k;
  return `<button type="button" class="cv-chip ts-chip" data-ts-k="${escHtml(k)}" data-ts-i="${i}"
    title="최근 ${escHtml(label)} — 누르면 이 글에 그대로 입힌다" aria-label="최근 ${escHtml(label)} ${i + 1}">
    <span class="${previewClassFor(k)}" style="${escHtml(style)}">${PREVIEW_GLYPH}</span>
  </button>`;
}

/** 줄 하나를 그린다. 0건이면 숨긴다(컬러 최근 줄과 ★같은 규약). */
export function renderTextStyleChips(row, k) {
  if (!row) return 0;
  let list = [];
  try { list = window.DesignSystem?.getTextStyleHistory?.(k) || []; } catch { list = []; }
  const html = list.map((rec, i) => _chipHtml(k, rec, i)).filter(Boolean).join('');
  if (!html) { row.innerHTML = ''; row.hidden = true; return 0; }
  row.hidden = false;
  const d = textStyleKind(k);
  row.innerHTML = `<span class="cv-chips-label" title="최근 ${d ? d.label : k} — 누르면 이 글에 그대로 입힌다">최근</span>` + html;
  return row.querySelectorAll('.ts-chip').length;
}

/**
 * 줄 하나를 배선한다. 저장소가 바뀌면 다시 그린다(컬러의 colorhistory-changed 와 ★같은 꼴).
 * @param {object} o
 *  - row:    줄 요소(없으면 아무것도 안 한다 — 그 패널엔 그 칸이 없다는 뜻)
 *  - kind:   'hl'|'dot'|'ul'|'grad'
 *  - onPick: (kind, v) => void   ★«켜고 → 입힌다»는 ★부르는 쪽 몫이다(text-style-kinds 머리말)
 * @returns {{refresh:Function, dispose:Function}|null}
 */
export function wireTextStyleChips({ row, kind, onPick } = {}) {
  if (!row || !textStyleKind(kind)) return null;
  const refresh = () => renderTextStyleChips(row, kind);
  refresh();
  row.addEventListener('click', (e) => {
    const btn = e.target.closest?.('.ts-chip');
    if (!btn || !row.contains(btn)) return;
    const i = parseInt(btn.dataset.tsI, 10);
    let list = [];
    try { list = window.DesignSystem?.getTextStyleHistory?.(kind) || []; } catch { list = []; }
    const rec = Number.isFinite(i) ? list[i] : null;
    if (!rec || !rec.v) return;
    try { onPick?.(kind, rec.v); } catch (err) { console.warn('[text-style-chips] 입히기 실패:', err); }
  });
  /* ★한 패널에 ★여러 줄이 있으므로 ★구독도 ★줄마다다 — 패널이 다시 그려지면 요소째 사라지고
     ★그 핸들러도 같이 죽는다. ⛔document 에 ★단일 슬롯을 두면 ★줄 하나만 갱신된다. */
  const onChanged = () => { if (row.isConnected) refresh(); else document.removeEventListener('textstylehistory-changed', onChanged); };
  document.addEventListener('textstylehistory-changed', onChanged);
  return { refresh, dispose: () => document.removeEventListener('textstylehistory-changed', onChanged) };
}

/** 패널의 ★모든 kind 줄을 한 번에 배선한다 — ⛔부르는 쪽이 kind 를 ★손으로 열거하지 않게(명부 하나). */
export function wireAllTextStyleChips({ p = 'txt', onPick } = {}) {
  const out = [];
  for (const d of TEXT_STYLE_KINDS) {
    const row = document.getElementById(tsRecentRowId(p, d.k));
    const h = wireTextStyleChips({ row, kind: d.k, onPick });
    if (h) out.push({ k: d.k, ...h });
  }
  return out;
}
