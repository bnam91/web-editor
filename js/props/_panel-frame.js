/* _panel-frame.js — 우측 속성 패널의 «틀» 한 벌. (right-panel-unify U0, 2026-11-13)
 *
 * ★블록 패널은 패널 전체를 글자로 짜 맞추지 않는다 — 절을 sec() 로 등록하고 renderPanel() 이 그린다:
 *     renderPanel(block, { header: blockHeaderHTML({...}), sections: [ sec('size', html), sec('fill', html), … ] })
 *   ⇒ 빈 html 절은 버리고 · _section-spec.js SECTION_ORDER 로 줄 세우고(special 은 선언순) · 같은 key 두 번이면 throw ·
 *     절 머리 = _helpers.js disclosureSectionHtml(쉐브론 한 벌) · 접기 = 절 key 단위 전 블록 공통(localStorage 'gd-panel-collapsed').
 * ★renderPanel 은 동기다 — 호출 뒤 getElementById 배선 코드는 그대로 돈다(절 «안» 마크업·id·핸들러는 한 글자도 안 바뀐다).
 * ★접기 배선 = propPanel 위임 click + keydown(Enter/Space) 한 번(처음 renderPanel 때). 기본 = 전부 펼침.
 * ⛔이 파일에는 색·px 리터럴 0 — 모양은 css/editor-props.css 「패널 절」 블록(var(--ui-*))만 (check-design-tokens.sh 하드게이트).
 */
import { propPanel } from '../globals.js';
import { disclosureSectionHtml } from './_helpers.js';
import { SECTION_ORDER, SECTION_TITLE, isValidSectionTitle } from './_section-spec.js';

const LS_KEY = 'gd-panel-collapsed';
let _memCollapsed = [];   // localStorage 가 없거나(유닛 vm) 막혔을 때의 대역

function _loadCollapsed() {
  try {
    if (typeof localStorage !== 'undefined') {
      const v = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
      if (Array.isArray(v)) return new Set(v);
    }
  } catch { /* 막힌 저장소 — 아래 대역 */ }
  return new Set(_memCollapsed);
}
function _saveCollapsed(set) {
  _memCollapsed = [...set];
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(LS_KEY, JSON.stringify(_memCollapsed)); } catch { /* 대역만 */ }
}

/** 접기 상태 단위 — 절 key(전 블록 공통). special 은 제목별. */
const _stateKey = (key, title) => (key === 'special' ? `special:${title}` : key);

export function isSectionCollapsed(key) { return _loadCollapsed().has(key); }
export function setSectionCollapsed(key, collapsed) {
  const s = _loadCollapsed();
  if (collapsed) s.add(key); else s.delete(key);
  _saveCollapsed(s);
}

/** 절 하나 등록. title 은 special 에 필수, 그 밖엔 SECTION_TITLE 기본(주면 같은 영어 Title Case 규칙으로 검사). */
export function sec(key, html, { title, headTools = '', id } = {}) {
  if (!SECTION_ORDER.includes(key)) throw new Error(`[panel-frame] 모르는 절 key: ${key}`);
  const t = title ?? SECTION_TITLE[key];
  if (key === 'special' && !title) throw new Error('[panel-frame] special 절은 title 이 필수다');
  if (!isValidSectionTitle(t)) throw new Error(`[panel-frame] 절 제목 규칙 위반(영어 Title Case/약어 1~2단어 · 한글/괄호/기호 없음): ${t}`);
  return { key, html: html ?? '', title: t, headTools, id };
}

/** 절 목록 → 패널 HTML(순수 함수 — 유닛 시험이 이걸 본다). */
export function buildPanelHTML({ header = '', sections = [] } = {}) {
  const seen = new Set();
  for (const s of sections) {
    const k = s.key === 'special' ? `special:${s.title}` : s.key;
    if (seen.has(k)) throw new Error(`[panel-frame] 같은 절을 두 번 선언했다: ${k}`);
    seen.add(k);
  }
  const collapsed = _loadCollapsed();
  let nSpecial = 0;
  const body = sections
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => String(s.html).trim() !== '')
    .sort((a, b) => SECTION_ORDER.indexOf(a.s.key) - SECTION_ORDER.indexOf(b.s.key) || a.i - b.i)
    .map(({ s }) => {
      const id = s.id || (s.key === 'special' ? `psec-special-${nSpecial++}` : `psec-${s.key}`);
      const stKey = _stateKey(s.key, s.title);
      const open = !collapsed.has(stKey);
      return `
    <div class="prop-section${open ? '' : ' is-collapsed'}" data-sec="${s.key}" data-sec-state="${stKey}" id="${id}">
      <div class="prop-section-title-row prop-sec-head">${disclosureSectionHtml(`${id}-head`, s.title, open, `${id}-body`)}${s.headTools}
      </div>
      <div class="prop-sec-body" id="${id}-body"${open ? '' : ' hidden'}>${s.html}
      </div>
    </div>`;
    })
    .join('');
  return (header ? `
    <div class="prop-section">
${header}
    </div>` : '') + body;
}

const HEAD_SEL = '.prop-section[data-sec] > .prop-sec-head > .prop-section-title';
let _wiredPanel = null;

function _toggle(head) {
  const section = head.closest('.prop-section[data-sec]');
  const bodyEl = section?.querySelector(':scope > .prop-sec-body');
  if (!section || !bodyEl) return;
  const open = bodyEl.hidden;   // 지금 닫혀 있으면 연다
  bodyEl.hidden = !open;
  section.classList.toggle('is-collapsed', !open);
  head.setAttribute('aria-expanded', String(open));   // 툴팁 없음 — 상태는 aria-expanded·쉐브론이 말한다
  // 쉐브론 회전은 CSS(.prop-sec-chevron · aria-expanded)가 맡는다
  setSectionCollapsed(section.dataset.secState, !open);
}

function _wire(panel) {
  if (!panel || _wiredPanel === panel) return;
  _wiredPanel = panel;
  panel.addEventListener('click', (e) => {
    const head = e.target?.closest?.(HEAD_SEL);
    if (head && panel.contains(head)) _toggle(head);
  });
  panel.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const head = e.target;
    if (!head?.matches?.(HEAD_SEL)) return;
    e.preventDefault();   // Space 가 패널을 스크롤하지 않게
    e.stopPropagation();  // 절 머리에 포커스가 있을 때 Enter/Space 는 접기 하나만 — 문서 전역 단축키로 새지 않게
    _toggle(head);
  });
}

/** 패널을 그린다 — 동기. block 은 지금 그리는 대상(배선 코드가 이어서 쓴다 · 틀은 아직 안 읽는다). */
export function renderPanel(block, { header = '', sections = [] } = {}) {
  propPanel.innerHTML = buildPanelHTML({ header, sections });
  _wire(propPanel);
  return propPanel;
}

/* ── 공용 조각(A-2) — 절 «안» 마크업. 기존 .prop-row/.prop-hint/.prop-type-* 클래스를 그대로 쓴다 ── */

/** 라벨 + 컨트롤 한 줄. */
export function fieldRowHTML(label, control, { labelCls = '' } = {}) {
  return `<div class="prop-row"><span class="prop-label${labelCls ? ' ' + labelCls : ''}">${label}</span>${control}</div>`;
}

/** 힌트 한 줄(패널당 ≤2 — 게이트가 센다). */
export function hintHTML(text) {
  return `<div class="prop-hint">${text}</div>`;
}

/** 스코프칩 — items: [{ scope, label, id?, disabled? }] · active = 지금 scope. */
export function scopeChipsHTML(items, active) {
  return `<div class="prop-type-group" role="group">${items.map((it) => {
    const on = it.scope === active;
    return `<button type="button" class="prop-type-btn${on ? ' active' : ''}"${it.id ? ` id="${it.id}"` : ''} data-scope="${it.scope}" aria-pressed="${on}"${it.disabled ? ' disabled' : ''}>${it.label}</button>`;
  }).join('')}</div>`;
}
