/* text-style-code-fold.js — 텍스트 패널의 «스타일 번호» 칸(형광펜·점·밑줄 번호 붙여넣기)을 한꺼번에 접는다 (1020t2d1)
 *
 * 현빈 원문(T1-NOTE-1020 :18): 「텍스트 블럭 관련해서 우측 프로퍼티에서 형광펜 번호 붙여넣기, 점번호 붙여넣기, 밑줄번호 붙여넣기 등.
 *   번호 부분나오는 부분은 일괄로 토글로 접어둘수 있게 해줘 너무 복잡해 보여.」
 * ★이식 — 접기 꼴은 이 레포 한 벌: prop-section-title ＋ disclosureChevronHtml(_helpers.js) ＋ 본문 display:none
 *   (선례 prop-table.js 행별 높이 · prop-banner02.js). role=button · aria-expanded · tabindex 도 그 규율 그대로.
 * ★마크업(_typo-section.js)은 안 건드린다 — 그 빌더는 모달·그리드·챗과 «바이트 동일»을 지키는 공용 부품이라
 *   (typo-section-ssot · bt2-safety 가 잠근다), 접기 머리는 «텍스트 패널을 그린 뒤» 여기서 끼워 넣는다.
 * ★기본 = 접힘(원문 「너무 복잡해 보여」) · 펼친 상태는 이 세션 동안 그리고 이 사람 브라우저에 기억(편의 · 실패해도 동작).
 * ★«숨김»은 style.display — hidden 속성은 display 클래스에 진다(이 레포 메모).
 * 검사: tests/dom/text-style-code-fold.dom.spec.js */
import { disclosureChevronHtml } from './_helpers.js';
import { tsCodeRowId } from './text-style-code-field.js';   /* 줄 id 정본 — ⛔여기서 다시 짓지 않는다 */

const LS_KEY = 'goditor.textStyleCodeFold.open';
let _open = null;
function _readOpen() {
  if (_open !== null) return _open;
  try { _open = localStorage.getItem(LS_KEY) === '1'; } catch (_) { _open = false; }
  return _open;
}
function _writeOpen(v) {
  _open = !!v;
  try { localStorage.setItem(LS_KEY, _open ? '1' : '0'); } catch (_) { /* 저장 못 해도 이 세션은 기억한다 */ }
}

/** 패널 안 «번호» 줄(prefix-hl/dot/ul-code-row)을 «스타일 번호 N» 카드 하나에 모아 접는다. 줄이 없으면 아무것도 안 한다. 돌려주는 값 = 머리 요소|null.
 *  1120b B5(현빈 261120 · 시안 v11.3 «스타일 번호» 카드) — 꼴 = Effects 효과 카드 부품 그대로(.prop-cell-card > .prop-cell-card-header(쉐브론 + .prop-cell-card-title) + .prop-cell-card-body).
 *  줄은 «옮길» 뿐이다(요소째 이동 — id·복사/붙여넣기 배선 그대로). 위 10px(--ui-space-2_5) · 머리 왼쪽 정렬은 시안 mk113-card 값(새 CSS 0 · 인라인 토큰). */
export function wireStyleCodeFold(propPanel, p = 'txt') {
  if (!propPanel) return null;
  const rows = ['hl', 'dot', 'ul'].map((k) => propPanel.querySelector('#' + tsCodeRowId(p, k))).filter(Boolean);
  if (!rows.length) return null;
  const was = propPanel.querySelector(`#${p}-code-fold-toggle`);
  if (was) return was;   // 같은 패널에 두 번 불려도 카드는 하나
  const card = document.createElement('div');
  card.className = 'prop-cell-card';
  card.id = `${p}-code-fold-card`;
  card.style.marginTop = 'var(--ui-space-2_5)';
  const head = document.createElement('div');
  head.className = 'prop-cell-card-header';
  head.id = `${p}-code-fold-toggle`;
  head.setAttribute('role', 'button');
  head.tabIndex = 0;
  head.style.cssText = 'justify-content:flex-start;gap:var(--ui-space-1);';
  const body = document.createElement('div');
  body.className = 'prop-cell-card-body';
  body.id = `${p}-code-fold-body`;
  head.setAttribute('aria-controls', body.id);
  rows[0].parentNode.insertBefore(card, rows[0]);
  card.append(head, body);
  rows.forEach((r) => { r.style.display = ''; body.appendChild(r); });
  const paint = () => {
    const open = _readOpen();
    head.setAttribute('aria-expanded', open ? 'true' : 'false');
    head.title = open ? '스타일 번호 칸 접기' : '스타일 번호 칸 펼치기';
    head.innerHTML = `${disclosureChevronHtml(open)}<span class="prop-cell-card-title" style="flex:1 1 auto;">스타일 번호 ${rows.length}</span>`;
    card.classList.toggle('expanded', open);
    body.hidden = !open;
  };
  const toggle = () => { _writeOpen(!_readOpen()); paint(); };
  head.addEventListener('click', toggle);
  head.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  paint();
  return head;
}
