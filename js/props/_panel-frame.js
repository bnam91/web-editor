/* _panel-frame.js — 우측 속성 패널의 «틀» 한 벌. (right-panel-unify U0, 2026-11-13)
 *
 * ★블록 패널은 패널 전체를 글자로 짜 맞추지 않는다 — 절을 sec() 로 등록하고 renderPanel() 이 그린다:
 *     renderPanel(block, { header: blockHeaderHTML({...}), sections: [ sec('size', html), sec('fill', html), … ] })
 *   ⇒ 빈 html 절은 버리고(단 headTools 가 있으면 머리만 그린다) · _section-spec.js SECTION_ORDER 로 줄 세우고(special 은 선언순) · 같은 key 두 번이면 throw ·
 *     절 머리 = 제목 글자만(쉐브론·클릭 접기 없음 — 패널 재설계 1차 · 현빈 확정 · Figma UI3 절은 안 접힌다).
 *     절 «안» 하위 접기(_helpers.js disclosureSectionHtml 3인자 · discSecOpen)는 그대로다.
 * ★renderPanel 은 동기다 — 호출 뒤 getElementById 배선 코드는 그대로 돈다(절 «안» 마크업·id·핸들러는 한 글자도 안 바뀐다).
 * ★옛 접기 기억(localStorage 'gd-panel-collapsed')은 더 읽지 않는다 — 남은 키가 절을 숨기면 열 길이 없다.
 * ⛔이 파일에는 색·px 리터럴 0 — 모양은 css/editor-props.css 「패널 절」 블록(var(--ui-*))만 (check-design-tokens.sh 하드게이트).
 */
import { propPanel } from '../globals.js';
import { SECTION_ORDER, SECTION_TITLE, isValidSectionTitle, sectionOrderFor } from './_section-spec.js';

/** 절 하나 등록. title 은 special 에 필수, 그 밖엔 SECTION_TITLE 기본(주면 같은 영어 Title Case 규칙으로 검사). */
export function sec(key, html, { title, headTools = '', id } = {}) {
  if (!SECTION_ORDER.includes(key)) throw new Error(`[panel-frame] 모르는 절 key: ${key}`);
  const t = title ?? SECTION_TITLE[key];
  if (key === 'special' && !title) throw new Error('[panel-frame] special 절은 title 이 필수다');
  if (!isValidSectionTitle(t)) throw new Error(`[panel-frame] 절 제목 규칙 위반(영어 Title Case/약어 1~2단어 · 한글/괄호/기호 없음): ${t}`);
  return { key, html: html ?? '', title: t, headTools, id };
}

/** 절 목록 → 패널 HTML(순수 함수 — 유닛 시험이 이걸 본다). */
export function buildPanelHTML({ header = '', sections = [], panel = '' } = {}) {   // panel = _section-spec SECTION_ORDER_EXCEPT 의 이름(없으면 전역 순서)
  const order = sectionOrderFor(panel);
  const seen = new Set();
  for (const s of sections) {
    const k = s.key === 'special' ? `special:${s.title}` : s.key;
    if (seen.has(k)) throw new Error(`[panel-frame] 같은 절을 두 번 선언했다: ${k}`);
    seen.add(k);
  }
  let nSpecial = 0;
  const body = sections
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => String(s.html).trim() !== '' || String(s.headTools ?? '').trim() !== '')   // 몸이 비어도 머리 손잡이(예: Effects 추가 목록)가 있으면 그린다
    .sort((a, b) => order.indexOf(a.s.key) - order.indexOf(b.s.key) || a.i - b.i)
    .map(({ s }) => {
      const id = s.id || (s.key === 'special' ? `psec-special-${nSpecial++}` : `psec-${s.key}`);
      const stKey = s.key === 'special' ? `special:${s.title}` : s.key;
      return `
    <div class="prop-section" data-sec="${s.key}" data-sec-state="${stKey}"${order === SECTION_ORDER ? '' : ` data-order="${panel}"`} id="${id}">
      <div class="prop-section-title-row prop-sec-head">
      <div class="prop-section-title" id="${id}-head"><span class="prop-sec-title-text">${s.title}</span></div>${s.headTools}
      </div>
      <div class="prop-sec-body" id="${id}-body">${s.html}
      </div>
    </div>`;
    })
    .join('');
  return (header ? `
    <div class="prop-section">
${header}
    </div>` : '') + body;
}

/** 옛 «절을 연다» 문 — 표준 절은 이제 늘 펼쳐져 있어 할 일이 없다.
 *  shortcut: 부르는 곳(15곳 · effects-registry window 다리)을 그대로 두려고 빈 함수로 남긴다 — 그 줄들을 걷을 때 같이 지운다. */
export function expandSection() {}
if (typeof window !== 'undefined') window.expandPanelSection = expandSection;

/** 패널을 그린다 — 동기. block 은 지금 그리는 대상(배선 코드가 이어서 쓴다 · 틀은 아직 안 읽는다). */
/* 패널 그리기 세대 — 비동기 렌더러(showSectionProperties 의 await)가 «기다리는 사이 다른 패널이 그려졌나»를 잰다(U6 R9). */
let _renderGen = 0;
export const panelRenderGen = () => _renderGen;
export function renderPanel(block, { header = '', sections = [], panel = '' } = {}) {
  _renderGen++;
  propPanel.innerHTML = buildPanelHTML({ header, sections, panel });
  return propPanel;
}

/** «절 통째»(.prop-section + 제목줄) 빌더 산출을 틀(sec)에 넣으려고 껍데기만 벗긴다 → { id, head, body }.
 *  id = 바깥 절 id(있으면) · head = 제목줄의 손잡이(제목 뒤 형제) · body = 몸. 이미 몸통만이면 { id: undefined, head: '', body: 그대로 }.
 *  ★한 벌 — prop-frame.js · prop-modal.js 의 _unwrapSec 두 벌을 여기로 올렸다(U0c ⑨ · 같은 몸).
 *  shortcut: 빌더 산출의 «문자열 꼴»에 기댄다 — fxSectionHtml · radialArrangeSectionHTML · _typo-section 빌더가 모두
 *  몸통 API(fxSectionParts 꼴)를 내면 U6 에서 걷는다. */
export function unwrapSection(html) {
  const m = /^\s*<div class="prop-section"(?: id="([^"]*)")?>([\s\S]*)<\/div>\s*$/.exec(html || '');
  if (!m) return { id: undefined, head: '', body: html || '' };
  let inner = m[2], head = '';
  const row = /^\s*<div class="prop-section-title-row">\s*<div class="prop-section-title">[^<]*<\/div>([\s\S]*?)<\/div>/.exec(inner);
  if (row) { head = row[1].trim(); inner = inner.slice(row[0].length); }
  else inner = inner.replace(/^\s*<div class="prop-section-title">[^<]*<\/div>/, '');
  return { id: m[1], head, body: inner };
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
