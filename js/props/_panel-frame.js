/* _panel-frame.js — 우측 속성 패널의 «틀» 한 벌. (right-panel-unify U0, 2026-11-13)
 *
 * ★블록 패널은 패널 전체를 글자로 짜 맞추지 않는다 — 절을 sec() 로 등록하고 renderPanel() 이 그린다:
 *     renderPanel(block, { header: blockHeaderHTML({...}), sections: [ sec('size', html), sec('fill', html), … ] })
 *   ⇒ 빈 html 절은 버리고(단 headTools 가 있으면 머리만 그린다) · _section-spec.js SECTION_ORDER 로 줄 세우고(special 은 선언순) · 같은 key 두 번이면 throw ·
 *     절 머리 = 제목 글자만(쉐브론·클릭 접기 없음 — 패널 재설계 1차 · 현빈 확정 · Figma UI3 절은 안 접힌다).
 *     머리 = role="heading" aria-level="3" — 패널엔 heading 이 하나도 없다(grep 0) · 블록 이름표(prop-block-label)를 패널 제목(2단)으로 보고 절은 그 아래(3단).
 *     절 «안» 하위 접기(_helpers.js disclosureSectionHtml 3인자 · discSecOpen)는 그대로다.
 * ★renderPanel 은 동기다 — 호출 뒤 getElementById 배선 코드는 그대로 돈다(절 «안» 마크업·id·핸들러는 한 글자도 안 바뀐다).
 * ★옛 접기 기억(localStorage 'gd-panel-collapsed')은 더 읽지 않는다 — 남은 키가 절을 숨기면 열 길이 없다.
 * ⛔이 파일에는 색·px 리터럴 0 — 모양은 css/editor-props.css 「패널 절」 블록(var(--ui-*))만 (check-design-tokens.sh 하드게이트).
 */
import { propPanel } from '../globals.js';
import { escHtml } from './_helpers.js';
import { SECTION_ORDER, SECTION_TITLE, isValidSectionTitle, sectionOrderFor, sectionRank } from './_section-spec.js';

/** 절 하나 등록. title 은 special 에 필수, 그 밖엔 SECTION_TITLE 기본(주면 같은 영어 Title Case 규칙으로 검사). */
export function sec(key, html, { title, headTools = '', id } = {}) {
  if (!SECTION_ORDER.includes(key)) throw new Error(`[panel-frame] 모르는 절 key: ${key}`);
  const t = title ?? SECTION_TITLE[key];
  if (key === 'special' && !title) throw new Error('[panel-frame] special 절은 title 이 필수다');
  if (!isValidSectionTitle(t)) throw new Error(`[panel-frame] 절 제목 규칙 위반(영어 Title Case/약어 1~2단어 · 한글/괄호/기호 없음): ${t}`);
  return { key, html: html ?? '', title: t, headTools, id };
}

/* ── 시안 v10(현빈 GO 261120 «다 넣어 시안대로») — 머리 둘을 줄인다 ───────────────────────────────
 *  Q2 Type 띠: kind 절은 머리 없이 블록 이름표 바로 아래 띠(이름표 상자 안). data-sec="kind" · id · 몸 id 는 그대로(배선·시험이 #id 로 잰다).
 *  Q1 Layout 묶음: size · layout · padding 은 머리 «Layout» 하나 아래 몸 여럿(패널 순서 그대로). 몸마다 data-sec(key) · 옛 몸 id 그대로.
 *    작은 제목 «Size» · «Padding» 은 둘 이상 묶일 때만 · layout 몸은 작은 제목 없음(시안 v10 실측 — PLAN «시안 v10 실측표»).
 *    표준 Layout 부품 몸(data-part="layout")은 작은 제목 대신 부품 안 작은 라벨 줄(PLAN-appearance-layout-std-261124 §7-2 · L1).
 *  key · SECTION_ORDER · OWNERSHIP 은 안 바뀐다 — 게이트(tests/dom/_panel-sections.js)는 묶음 안 몸을 절 하나로 읽는다. */
export const LAYOUT_GROUP = Object.freeze(['size', 'layout', 'padding']);
const GROUP_SUB = Object.freeze({ size: 'Size', padding: 'Padding' });
/* 표준 Layout 부품(_layout-section.js · L1)을 쓰는 몸은 FigCraft 작은 라벨 줄(Width | Height · Padding · Gap)을 제 안에 갖는다 → 작은 제목을 또 안 단다(몸 id·key 무변 · 옛 몸은 그대로) */
const _ownsLabels = (html) => String(html).includes('data-part="layout"');

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
  const ord = order === SECTION_ORDER ? '' : ` data-order="${panel}"`;
  const list = sections
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => String(s.html).trim() !== '' || String(s.headTools ?? '').trim() !== '')   // 몸이 비어도 머리 손잡이(예: Effects 추가 목록)가 있으면 그린다
    .sort((a, b) => sectionRank(order, a.s.key, a.s.title) - sectionRank(order, b.s.key, b.s.title) || a.i - b.i)
    .map(({ s }) => ({ ...s, id: s.id || (s.key === 'special' ? `psec-special-${nSpecial++}` : `psec-${s.key}`),
      stKey: s.key === 'special' ? `special:${s.title}` : s.key }));
  const head = (id, title, tools) => `
      <div class="prop-section-title-row prop-sec-head">
      <div class="prop-section-title" id="${id}-head" role="heading" aria-level="3"><span class="prop-sec-title-text">${title}</span></div>${tools}
      </div>`;
  const kind = list.find((s) => s.key === 'kind');
  const band = kind ? `
      <div class="prop-section prop-kind-band" data-sec="kind" data-sec-state="kind" data-title="${kind.title}"${ord} id="${kind.id}">
      <div class="prop-sec-body" id="${kind.id}-body">${kind.html}
      </div>${kind.headTools ? `<div class="prop-kind-band-tools">${kind.headTools}</div>` : ''}
      </div>` : '';
  const group = list.filter((s) => LAYOUT_GROUP.includes(s.key));
  const out = [];
  for (const s of list) {
    if (s.key === 'kind') continue;
    if (LAYOUT_GROUP.includes(s.key)) {
      if (s !== group[0]) continue;
      const multi = group.length > 1;
      /* 겉 = 머리 하나(data-sec 없음 · data-sec-group) · 몸 = 옛 절 그대로의 .prop-section[data-sec](id · 몸 id · data-sec-state) — closest('.prop-section[data-sec]') 이 key 를 그대로 준다 */
      out.push(`
    <div class="prop-section prop-sec-group" data-sec-group="${group.map((g) => g.key).join(' ')}"${ord} id="${s.id}-group">${head(s.id, SECTION_TITLE.layout, group.map((g) => g.headTools).join(''))}${group.map((g) => `
      <div class="prop-section prop-sec-part" data-sec="${g.key}" data-sec-state="${g.stKey}" data-title="${g.title}"${ord} id="${g.id}">${multi && GROUP_SUB[g.key] && !_ownsLabels(g.html) ? `
      <div class="prop-sec-sub-row"><span class="prop-field-label prop-sec-sub">${GROUP_SUB[g.key]}</span></div>` : ''}
      <div class="prop-sec-body" id="${g.id}-body">${g.html}
      </div>
      </div>`).join('')}
    </div>`);
      continue;
    }
    out.push(`
    <div class="prop-section" data-sec="${s.key}" data-sec-state="${s.stKey}"${ord} id="${s.id}">${head(s.id, s.title, s.headTools)}
      <div class="prop-sec-body" id="${s.id}-body">${s.html}
      </div>
    </div>`);
  }
  return (header || band ? `
    <div class="prop-section">
${header}${band}
    </div>` : '') + out.join('');
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
  const tpl = blockTemplateSection(block, sections);
  propPanel.innerHTML = buildPanelHTML({ header, sections: tpl ? [...sections, tpl] : sections, panel });
  if (tpl) wireBlockTemplate(block);
  return propPanel;
}

/* ── Q37(시안 v10 «제안» 꼴 · 현빈 GO 261120) — 블록 저장을 «Template» 절로 ────────────────────────────
 *  모든 블럭 패널(틀을 타는 블럭 · SECTION_BLOCK_TYPE_SEL)에 머리 «Template» + ＋ → 이름 · 폴더 · 태그 · «블록 템플릿으로 저장».
 *  ★저장 길 = 우클릭 «블록 템플릿으로 저장»(index.html #bcm-name-row → block-factory.js nameConfirm)과 같은 window.saveBlockAsTemplate
 *    (js/panels/template-system.js) — 새 저장 경로 0. 폴더 목록도 같은 listTemplateFolders(.., '블록').
 *  ★한 패널에 Template 절 하나: 패널이 이미 template 절을 내면(프레임 «컴포넌트로 저장» · QA 티켓) 안 붙인다. 섹션은 블럭 아님. */
const _P8 = '<svg fill="none" height="12" stroke="currentColor" stroke-linecap="round" stroke-width="1.5" viewBox="0 0 12 12" width="12"><path d="M6 2v8M2 6h8"/></svg>';
const _M8 = '<svg fill="none" height="12" stroke="currentColor" stroke-linecap="round" stroke-width="1.5" viewBox="0 0 12 12" width="12"><path d="M2 6h8"/></svg>';
export function blockTemplateSection(block, sections = []) {
  const sel = typeof window !== 'undefined' ? window.SECTION_BLOCK_TYPE_SEL : '';
  if (!sel || !block?.matches?.(sel) || sections.some((x) => x.key === 'template')) return null;
  return sec('template', `
      <div class="prop-tpl-form" id="blk-tpl-form" hidden>
        <input type="text" class="tpl-name-input" id="blk-tpl-name" placeholder="템플릿 이름" aria-label="템플릿 이름">
        <select class="prop-select prop-tpl-folder" id="blk-tpl-folder" aria-label="폴더"></select>
        <input type="text" class="tpl-name-input" id="blk-tpl-folder-new" placeholder="새 폴더 이름..." aria-label="새 폴더 이름" hidden>
        <input type="text" class="tpl-name-input" id="blk-tpl-tags" placeholder="태그 (쉼표 구분)" aria-label="태그">
        <button type="button" class="prop-action-btn primary" id="blk-tpl-save">블록 템플릿으로 저장</button>
      </div>`, { id: 'blk-tpl-section', headTools: `
        <button type="button" class="prop-chain-btn" id="blk-tpl-toggle" title="블록 템플릿으로 저장 — 펼치기" aria-expanded="false">${_P8}</button>` });
}
function wireBlockTemplate(block) {
  const $ = (id) => document.getElementById(id);
  const tog = $('blk-tpl-toggle'), form = $('blk-tpl-form'), folder = $('blk-tpl-folder'), fnew = $('blk-tpl-folder-new');
  if (!tog || !form) return;
  folder.addEventListener('change', () => { fnew.hidden = folder.value !== '__new__'; });
  tog.addEventListener('click', () => {
    const open = form.hidden; form.hidden = !open;
    tog.innerHTML = open ? _M8 : _P8; tog.setAttribute('aria-expanded', String(open)); tog.title = open ? 'Template 접기' : '블록 템플릿으로 저장 — 펼치기';
    if (open) $('blk-tpl-name')?.focus();
  });
  const fillFolders = (pick) => {
    const fs = window.listTemplateFolders?.(window.loadTemplatesPublic?.() || [], '블록') || [];
    if (!fs.includes('블록')) fs.unshift('블록');
    folder.innerHTML = fs.map((f) => `<option value="${escHtml(f)}">${escHtml(f)}</option>`).join('') + '<option value="__new__">새 폴더...</option>';
    if (pick && fs.includes(pick)) folder.value = pick;
    fnew.hidden = folder.value !== '__new__';
  };
  fillFolders();
  const save = $('blk-tpl-save');
  save?.addEventListener('click', async () => {
    if (save.disabled) return;   // QA2 — 연타로 두 번 저장되지 않게(저장 중 막기)
    const name = $('blk-tpl-name').value.trim();
    if (!name) { $('blk-tpl-name').focus(); return; }
    const f = folder.value === '__new__' ? (fnew.value.trim() || '블록') : (folder.value || '블록');
    save.disabled = true;
    try {
      await window.saveBlockAsTemplate?.(block, name, f, $('blk-tpl-tags').value.trim());   // 우클릭 저장과 같은 함수 · 같은 인자 꼴(block-factory.js nameConfirm) · 성공 알림도 그 함수가 낸다(우클릭과 같음)
    } catch (err) {
      console.warn('[block-template] 저장 실패', err); window.showToast?.('블록 템플릿 저장 실패');   // 칸은 그대로(다시 누르면 재시도)
      return;
    } finally { save.disabled = false; }   // 끝나면 · 실패해도 풀림
    $('blk-tpl-name').value = ''; $('blk-tpl-tags').value = ''; fnew.value = '';
    fillFolders(f);   // QA2 — 방금 만든 새 폴더가 같은 패널 목록에 바로 보인다
  });
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
