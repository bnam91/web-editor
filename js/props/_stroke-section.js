/* _stroke-section.js — 표준 Stroke 절 부품(현빈 261123 «절 = 재사용 컴포넌트» · 구현 GO · 정본 시안 8910 strokestd2 · 계약 gdragon PLAN-ds-parts-state §4c ②b e3dc80d)
 *
 * 꼴(시안 그대로): .ui-stroke.ui-stroke2[data-part=stroke] › .ui-stroke-std
 *   ┌ 색 한 줄(.prop-color-row.ui-s2-layer · 라벨 없음 = Figma 겹 줄) — data-part=color · data-field=stroke-color
 *   └ [위치 | 굵기] 한 줄(.ui-s2-main · 칸 위 작은 캡션) — select data-field=stroke-align(안쪽·가운데·바깥) · 숫자 data-field=stroke-width
 *   그 아래 블럭별 특수 슬롯(.ui-stroke-slot[data-slot=below][data-slot-kind=…]) — 부르는 패널이 slotsBelow 로 넘긴다.
 * ⫶ «Stroke 설정» 팝오버(단계 3-1) = 표준 줄 끝 단추 + 줄 안 절대 자리 팝오버 · ⛔□ 면별 단추는 단계 4 에서(배선 없는 단추를 먼저 그리지 않는다 — §4c ④).
 *
 * 데이터 = 어댑터(블럭마다 저장 키가 다르다 — §4c ① 표 · ⛔저장 키 무변):
 *   wireStrokeSection({ prefix, adapter }) · adapter = { color(c), width(v), align?(v), commit() } — 부품은 블럭을 모른다.
 * 위치를 아직 못 그리는 블럭 = canAlign:false → 칸은 보이되 «막힘»(aria-disabled · 툴팁 = 까닭 · 값 = 지금 그려지는 쪽) — §4c ②③ «칸만 + 막힘».
 */
import { colorFieldHTML, wireColorField } from './color-picker.js';   // ★2-4 에서 window 로 돌렸던 것을 되돌림(261124): color-picker 를 «스텁»하는 DOM 하네스 18벌이 window.colorFieldHTML 을 안 걸어 빨강(shape-size-panel · number-field-contract 실측) → 진짜 import · 그리드 유닛 하네스(grid-line-add)의 스텁에 두 이름을 더함

const W_ICON = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.1"><rect x="1.5" y="2" width="9" height="2.2" rx=".6"/><rect x="1.5" y="7.8" width="9" height="2.2" rx=".6"/><path d="M1.5 6h9"/></svg>';
export const STROKE_ALIGNS = Object.freeze([['inside', '안쪽'], ['center', '가운데'], ['outside', '바깥']]);

/**
 * @param {object} o
 * @param {string} o.prefix      id 접두(예: 'shape-stroke') — 색 칸 `${prefix}-color` · 굵기 `${prefix}-width` · 위치 `${prefix}-align`
 * @param {string} o.color       #rrggbb
 * @param {number} [o.alpha]     색 불투명도(colorFieldHTML 와 같은 값)
 * @param {number} o.width
 * @param {number} [o.maxWidth]
 * @param {string} [o.align]     'inside'|'center'|'outside'
 * @param {boolean} [o.canAlign] false = 위치 칸 막힘(그 블럭이 아직 못 그림)
 * @param {string} [o.alignWhy]  막힘 까닭(툴팁)
 * @param {string} [o.slotsBelow] 블럭별 특수 슬롯 HTML(이미 .ui-stroke-slot 로 감싼 것)
 * @param {boolean} [o.on]      false = 테두리 없음(머리 ＋ · 몸 숨김) — 머리 단추는 strokeHeadToolsHTML
 * @param {string} [o.colorHtml]  이미 만든 색 칸(부르는 쪽 기본값·알파 규칙 그대로 · 텍스트/인용구 · '' = 빈 줄 그대로) — null 이면 color·alpha 로 만든다
 * @param {number} [o.step] · [o.minWidth]  굵기 걸음·하한(radial 0.5 · sticker-text 0.5 — 지디 261123)
 * @param {boolean} [o.noAlign] · [o.noColor]  단계 2-5 선 블럭(현빈 ⓑ · 8910 #mkp-linestroke): 위치 칸 없음(선 = 가운데 고정) · 색 줄 없음(아이콘·그래프 = 색은 Fill/계열 쪽)
 * @param {object} [o.sides]   단계 4-2 면별 굵기 { w:{top,right,bottom,left}|null, std, open, mixed } — □ 단추 + «면별» 슬롯 · 어댑터 adapter.sides
 * @param {object} [o.pop]     ⫶ «Stroke 설정» 팝오버(단계 3 · §4c ②b) — strokePopHTML 인자(styles·style·styleId·why)
 * @param {string} [o.bodyId] · [o.widthId] · [o.colorId]  그 블럭이 옛부터 쓰던 id 를 지킬 때(시험·외부 배선이 그 id 로 찾는다 · 없으면 prefix 기본)
 */
export function strokeSectionHTML({ prefix, color, alpha, width, maxWidth = 80, align = 'center', canAlign = true, alignWhy = '', slotsBelow = '', on = true, bodyId = '', widthId = '', colorId = '', step = 1, minWidth = 0, colorHtml = null, pop = null, sides = null, noAlign = false, noColor = false }) {
  const colorField = (colorHtml != null ? colorHtml : colorFieldHTML({ idPrefix: colorId || `${prefix}-color`, hex: color, alpha }))
    .replace('class="prop-color-field"', 'class="prop-color-field" data-part="color" data-field="stroke-color"');
  const blocked = canAlign ? '' : ` aria-disabled="true" tabindex="0" title="${alignWhy}"`;
  return `
      <div class="ui-stroke ui-stroke2" data-part="stroke"${bodyId ? ` id="${bodyId}"` : ''}${on ? '' : ' hidden'}>
        <div class="ui-stroke-std">
          ${noColor ? '' : `<div class="prop-color-row ui-s2-layer">${colorField}</div>`}
          <div class="ui-s2-main prop-row">
            ${noAlign ? '' : `<div class="ui-s2-cell"><span>위치</span><select class="prop-select" id="${prefix}-align" data-part="select" data-field="stroke-align" aria-label="위치"${blocked}>${STROKE_ALIGNS.map(([v, t]) => `<option value="${v}"${v === align ? ' selected' : ''}>${t}</option>`).join('')}</select></div>`}
            <div class="ui-s2-cell"><span>굵기</span><div class="prop-icon-input" data-part="number" data-field="stroke-width"><span class="prop-xy-label" title="굵기">${W_ICON}</span><input type="number" id="${widthId || `${prefix}-width`}" min="${minWidth}" max="${maxWidth}" step="${step}" value="${sides?.mixed ? '' : width}"${sides?.mixed ? ' placeholder="Mixed" data-empty="invalid"' : ''} aria-label="굵기"></div></div>${_mainEnd(prefix, pop, sides)}
          </div>
        </div>${sides ? sidesSlotHTML({ prefix, ...sides }) : ''}${slotsBelow}
      </div>`;
}

/** 머리 ＋/− 엔드슬롯(테두리 켬/끔) — 에셋 Stroke 머리(1120b A2 · .prop-chain-btn.prop-sec-add + 숨은 체크) 꼴 그대로 · id = `${prefix}-on`.
 *  «없음 = 무엇»은 어댑터가 정한다(adapter.none · 없으면 굵기 0 — 실측 표 §4c: 도형·에셋·프레임·모달 = 굵기 0 · 옛 저장본 바이트 무변). */
export function strokeHeadToolsHTML({ prefix, on }) {
  return `
        <label class="prop-chain-btn prop-sec-add" title="Stroke 추가">
          <input type="checkbox" id="${prefix}-on" ${on ? 'checked' : ''} aria-label="Stroke">
          <svg class="prop-sec-add-plus" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 2v8M2 6h8"/></svg>
          <svg class="prop-sec-add-minus" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 6h8"/></svg>
        </label>`;
}

const MORE_ICON = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><path d="M3 1.5v9M9 1.5v9"/><circle cx="3" cy="4" r="1.3" fill="currentColor"/><circle cx="9" cy="8" r="1.3" fill="currentColor"/></svg>';
const CAP_OPTS = [['none', '없음', '<path d="M2 6h3M7 6h3"/>'], ['square', '네모', '<path d="M2 6h3M7 6h3" stroke-linecap="square"/>'], ['round', '둥글게', '<path d="M2 6h3M7 6h3" stroke-linecap="round"/>']];
const JOIN_OPTS = [['miter', '뾰족', '<path d="M3 10V3h7" stroke-linejoin="miter"/>'], ['bevel', '깎음', '<path d="M3 10V5l2-2h5"/>'], ['round', '둥글게', '<path d="M3 10V6a3 3 0 0 1 3-3h4"/>']];
/** 지금 그 블럭이 «못 그리는» 칸의 까닭(P6 why · §4c ②b) — CSS 테두리 = 점선 길이·끝·꼭짓점 없음 · 그 밖 = 단계 3-2 */
/** 스타일 목록 — CSS 테두리 블럭 = 실선·점선·점(dotted 유지 · 지디 261124 (가)) · SVG 블럭 = 실선·점선(단계 3-2 에서 «사용자»+수치) · 값 = 그 블럭 옛 값 그대로 */
export const STROKE_STYLES_CSS = Object.freeze([['solid', '— 실선'], ['dashed', '- - 점선'], ['dotted', '· · 점']]);
export const STROKE_STYLES_SVG = Object.freeze([['solid', '— 실선'], ['dashed', '- - 점선']]);
export const STROKE_POP_WHY = Object.freeze({ css: '이 블럭은 아직 점선 길이를 못 그려요', soon: '곧 지원', noCorner: '꼭짓점이 없는 블럭이에요' });

/**
 * ⫶ «Stroke 설정» 팝오버(§4c ②b · 시안 strokestd2 21·22) — 단추 button.ui-stroke-more + div.ui-stroke-pop[role=dialog]
 * 단계 3-1: «스타일»만 산다(그 블럭에 지금 있는 값 그대로 · 옛 id = styleId 로 지켜 블럭의 옛 change 배선이 그대로 듣는다 · CSS 블럭은 «점»(dotted) 유지 — 지디 261124 (가))
 *   점선 길이·간격·점선 끝·꼭짓점·Miter = 칸은 그리되 막힘(aria-disabled + why) — 3-2 에서 SVG 블럭부터 산다.
 * @param {object} o
 * @param {Array<[string,string]>} [o.styles] [값, 이름] — 없으면 스타일도 막힘(그 블럭에 스타일 키가 아직 없음)
 * @param {string} [o.style]  지금 값 · [o.styleId] 옛 select id · [o.why] 막힘 까닭(수치·끝·꼭짓점) · [o.styleWhy] 스타일 막힘 까닭
 */
export function strokePopHTML({ prefix, styles = null, style = 'solid', styleId = '', why = STROKE_POP_WHY.soon, styleWhy = STROKE_POP_WHY.soon, live = {}, look = null, joinWhy = '', capAlways = false, capLabel = '점선 끝' }) {
  /* 단계 3-2: live = { dash, cap, join } 가 참인 칸만 산다(그 블럭이 그릴 수 있는 칸 · SVG 블럭) · look = 보이는 값(stroke-look.js readLook + 점선 파생 길이) */
  const dis = (w) => ` aria-disabled="true" tabindex="0" title="${w}"`;
  const lk = { dash: 2, gap: 2, cap: 'none', join: 'miter', miter: 28.96, ...(look || {}) };
  const isLive = !!(styles && styles.length);
  const opts = (isLive ? styles : [['solid', '— 실선']]).map(([v, t]) => `<option value="${v}"${v === style ? ' selected' : ''}>${t}</option>`).join('');
  const dashed = isLive && style !== 'solid';
  const btns = (field, list, cur, ok, w) => `<div class="prop-type-group ui-stroke-pop-btns" data-field="${field}" role="group">${list.map(([v, t, d]) => `<button type="button" class="prop-type-btn${v === cur ? ' active' : ''}" data-value="${v}" aria-label="${t}" aria-pressed="${v === cur}"${ok ? '' : dis(w)}><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6">${d}</svg></button>`).join('')}</div>`;
  const num = (field, label, v, ok, w, unit = '') => `<div class="prop-row ui-stroke-pop-row"${field === 'stroke-dash' || field === 'stroke-gap' ? ` data-when="dashed"${dashed ? '' : ' hidden'}` : ''}><span class="prop-label">${label}</span><div class="prop-icon-input" data-part="number" data-field="${field}"><input type="number" min="${field === 'stroke-miter' ? 1 : 0}" max="${field === 'stroke-miter' ? 180 : 999}" step="${field === 'stroke-miter' ? 0.01 : 1}" value="${v}" aria-label="${label}"${ok ? '' : dis(w)}>${unit ? `<span class="ui-stroke-pop-unit">${unit}</span>` : ''}</div></div>`;
  const jw = joinWhy || why;
  return `<button type="button" class="prop-chain-btn ui-stroke-more" id="${prefix}-more" aria-haspopup="dialog" aria-expanded="false" aria-label="Stroke 설정">${MORE_ICON}</button>
            <div class="ui-stroke-pop" id="${prefix}-pop" role="dialog" aria-label="Stroke 설정" hidden>
              <div class="ui-stroke-pop-head"><span class="ui-stroke-pop-title">Stroke 설정</span><button type="button" class="prop-chain-btn ui-stroke-pop-close" aria-label="닫기">×</button></div>
              <div class="prop-row ui-stroke-pop-row"><span class="prop-label">스타일</span><select class="prop-select" id="${styleId || `${prefix}-style`}" data-part="select" data-field="stroke-style" aria-label="스타일"${isLive ? '' : dis(styleWhy)}>${opts}</select></div>
              ${num('stroke-dash', '점선 길이', lk.dash, live.dash, why)}${num('stroke-gap', '간격', lk.gap, live.dash, why)}
              <div class="prop-row ui-stroke-pop-row"${capAlways ? '' : ` data-when="dashed"${dashed ? '' : ' hidden'}`}><span class="prop-label">${capLabel}</span>${btns('stroke-cap', CAP_OPTS, lk.cap, live.cap, why)}</div>
              <div class="prop-row ui-stroke-pop-row"><span class="prop-label">꼭짓점</span>${btns('stroke-join', JOIN_OPTS, lk.join, live.join, jw)}</div>
              ${num('stroke-miter', 'Miter 각도', lk.miter, live.join, jw, '°')}
            </div>`;
}

/** 팝오버 배선 — 열기/닫기(⫶ · × · Esc · 바깥 누름) · 자리(아래 · 패널 밖으로 넘치면 위로 뒤집기) · 스타일 바뀌면 점선 칸 보임/숨김
 *  ★값 쓰기는 블럭의 옛 배선이 그 select(옛 id)의 change 로 한다 — 여기선 안 쓴다(이중 쓰기 0). 막힌 칸 = 열림·값 바뀜 막음. */
export function wireStrokePopover({ prefix, adapter = null }) {
  const btn = document.getElementById(`${prefix}-more`), pop = document.getElementById(`${prefix}-pop`);
  if (!btn || !pop) return;
  const onDoc = (e) => { if (!pop.contains(e.target) && !btn.contains(e.target)) close(); };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); btn.focus(); } };
  function close() { if (pop.hidden) return; pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); document.removeEventListener('mousedown', onDoc, true); document.removeEventListener('keydown', onKey, true); }
  /* 자리 — 아래가 기본 · 아래로 넘치고 위엔 자리가 있으면 위로. ★열 때만이 아니라 점선 칸이 나고 들 때도 다시 잰다(실측: 점 고르면 줄 셋이 늘어 1114 > 패널 1100) */
  function place() {
    pop.classList.remove('ui-stroke-pop--up');
    const box = pop.closest('.panel-body, #panel-right') || document.documentElement, br = box.getBoundingClientRect(), pr = pop.getBoundingClientRect();
    const above = btn.getBoundingClientRect().top - br.top;
    if (pr.bottom > br.bottom && pr.height < above) pop.classList.add('ui-stroke-pop--up');
  }
  function open() {
    pop.hidden = false; btn.setAttribute('aria-expanded', 'true'); place();
    document.addEventListener('mousedown', onDoc, true); document.addEventListener('keydown', onKey, true);
  }
  btn.addEventListener('click', () => (pop.hidden ? open() : close()));
  pop.querySelector('.ui-stroke-pop-close')?.addEventListener('click', close);
  pop.querySelectorAll('[aria-disabled="true"]').forEach((el) => {   // 막힘 — 초점·툴팁은 받고 열림·값 바뀜은 막는다(위치 칸과 같은 규율)
    el.addEventListener('mousedown', (e) => e.preventDefault());
    el.addEventListener('click', (e) => e.preventDefault());
    el.addEventListener('keydown', (e) => { if (e.key !== 'Tab' && e.key !== 'Escape') e.preventDefault(); });
  });
  const sel = pop.querySelector('[data-field="stroke-style"]');
  /* 단계 3-2 — 블럭이 adapter.look(part) 을 주면 팝오버가 값을 쓴다(그 블럭엔 옛 스타일 배선이 없다) · 막힌 칸은 위에서 이미 막힘 · 이력 = 칸마다 change 한 칸(push-after) */
  if (adapter?.look) {
    const val = (f) => pop.querySelector(`[data-field="${f}"] input`);
    const send = (part, commit = true) => { adapter.look(part); if (commit) adapter.commit?.(); };
    sel?.addEventListener('change', () => send({ style: sel.value }));
    for (const f of ['stroke-dash', 'stroke-gap']) {
      const inp = val(f); if (!inp || inp.getAttribute('aria-disabled') === 'true') continue;
      const part = () => { const d = +val('stroke-dash').value, g = +val('stroke-gap').value; return { style: 'custom', dash: Math.max(0, d || 0), gap: Math.max(0, g || 0) }; };   // 길이를 만지면 «사용자»(Figma Custom)
      inp.addEventListener('input', () => send(part(), false));
      inp.addEventListener('change', () => { if (sel && sel.value !== 'custom' && [...sel.options].some((o) => o.value === 'custom')) sel.value = 'custom'; send(part()); });
    }
    for (const f of ['stroke-cap', 'stroke-join']) {
      pop.querySelectorAll(`[data-field="${f}"] .prop-type-btn:not([aria-disabled="true"])`).forEach((b) => b.addEventListener('click', () => {
        b.parentElement.querySelectorAll('.prop-type-btn').forEach((x) => { x.classList.toggle('active', x === b); x.setAttribute('aria-pressed', String(x === b)); });
        send({ [f === 'stroke-cap' ? 'cap' : 'join']: b.dataset.value });
      }));
    }
    const mi = val('stroke-miter');
    if (mi && mi.getAttribute('aria-disabled') !== 'true') { mi.addEventListener('input', () => send({ miter: +mi.value }, false)); mi.addEventListener('change', () => send({ miter: Math.min(180, Math.max(1, +mi.value || 28.96)) })); }
  }
  sel?.addEventListener('change', () => { pop.querySelectorAll('[data-when="dashed"]').forEach((r) => { r.hidden = sel.value === 'solid'; }); if (!pop.hidden) place(); });
}

/** 배선 — 색(color-picker 한 벌) · 굵기(입력 = 쓰기 · change = 이력 한 칸 · push-after) · 위치(막힘이면 안 열림·안 바뀜). */
export function wireStrokeSection({ prefix, adapter, alpha, maxWidth = 80, widthId = '', colorId = '', onWidth = 2, step = 1, minWidth = 0, noColor = false }) {
  wireStrokePopover({ prefix, adapter });
  wireSides({ prefix, adapter, widthId });
  const num = (v) => { const x = Math.round((parseFloat(v) || 0) / step) * step; return Math.min(maxWidth, Math.max(minWidth, +x.toFixed(3))); };   // 0.5 걸음도 같은 길(parseInt 면 2.5 → 2)
  if (!noColor) wireColorField(colorId || `${prefix}-color`, { initialAlpha: alpha, onApply: (c) => adapter.color(c), onCommit: () => adapter.commit() });
  const w = document.getElementById(widthId || `${prefix}-width`);
  /* 머리 ＋/− — 켜면 «지난 굵기 · 없으면 onWidth»(에셋 옛 기본 2 그대로) · 끄면 adapter.none(없으면 굵기 0) · 몸 숨김 · 이력 한 칸 */
  const on = document.getElementById(`${prefix}-on`), ui = w?.closest('.ui-stroke');
  on?.addEventListener('change', () => {
    if (on.checked) { const cur = parseFloat(w?.value) || 0, v = cur > 0 ? cur : onWidth; if (w) w.value = String(v); adapter.width(v); }   // 끌 때 칸 값은 그대로 둔다 → 다시 켜면 지난 굵기
    else if (adapter.none) adapter.none(); else adapter.width(0);
    if (ui) ui.hidden = !on.checked;
    adapter.commit();
  });
  w?.addEventListener('input', () => adapter.width(num(w.value)));
  w?.addEventListener('change', () => { const v = num(w.value); w.value = String(v); adapter.width(v); adapter.commit(); });
  const a = document.getElementById(`${prefix}-align`);
  if (!a) return;
  if (a.getAttribute('aria-disabled') === 'true') {   // 막힘 — 초점·툴팁은 받고(P6) 열림·값 바뀜은 막는다
    a.addEventListener('mousedown', (e) => e.preventDefault());
    a.addEventListener('keydown', (e) => { if (e.key !== 'Tab') e.preventDefault(); });
    return;
  }
  a.addEventListener('change', () => { adapter.align?.(a.value); adapter.commit(); });
}

/* ══ 단계 4 — edge-select 슬롯(«변 선택 테두리» · §4c ②b · 시안 strokestd2 9·12) ═══════════════════════════════
 * 값 = 변 집합(data-field="stroke-edges" · data-value = 정본 순서 쉼표 목록) · 변 6 = top right bottom left inner-h inner-v · 묶음 = all outer inner none
 * 변 단추 속성 = data-stroke-edge(⛔data-edge 아님 — 그리드 «선 자리» 줄이 패널 전체 [data-edge] 로 배선해 겹치면 외곽선 단추가 칸 테두리까지 바꿨다 · 실측 grid-ifg-preset-lines) · 묶음 = data-edge-preset(§4c 이름)
 * 어댑터가 알린다: edges = 고를 수 있는 변(못 고르는 변·묶음 단추는 «숨김» — 막힘 아님) · links = 같이 움직이는 변(표: 좌우·상하 = 저장 키 하나)
 * ⛔그리는 일·저장 키는 블럭 어댑터(read/write) — 부품은 블럭을 모른다. 이력 = 누를 때마다 한 칸(commit · push-after). */
export const EDGE_NAMES = Object.freeze(['top', 'right', 'bottom', 'left', 'inner-h', 'inner-v']);
const EDGE_LABEL = { top: '위', right: '오른쪽', bottom: '아래', left: '왼쪽', 'inner-h': '안쪽 가로', 'inner-v': '안쪽 세로', all: '모두', outer: '바깥', inner: '안쪽', none: '없음' };
const _ei = (strong) => `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"><rect x="1.5" y="1.5" width="9" height="9" stroke-opacity=".35" stroke-dasharray="1.5 1"/><path d="M6 1.5v9M1.5 6h9" stroke-opacity=".35" stroke-dasharray="1.5 1"/>${strong}</svg>`;
const EDGE_ICON = {
  top: _ei('<path d="M1.5 1.5h9" stroke-width="1.6"/>'), right: _ei('<path d="M10.5 1.5v9" stroke-width="1.6"/>'),
  bottom: _ei('<path d="M1.5 10.5h9" stroke-width="1.6"/>'), left: _ei('<path d="M1.5 1.5v9" stroke-width="1.6"/>'),
  'inner-h': _ei('<path d="M1.5 6h9" stroke-width="1.6"/>'), 'inner-v': _ei('<path d="M6 1.5v9" stroke-width="1.6"/>'),
  all: _ei('<rect x="1.5" y="1.5" width="9" height="9" stroke-width="1.4"/><path d="M6 1.5v9M1.5 6h9" stroke-width="1.4"/>'),
  outer: _ei('<rect x="1.5" y="1.5" width="9" height="9" stroke-width="1.4"/>'),
  inner: _ei('<path d="M6 1.5v9M1.5 6h9" stroke-width="1.4"/>'), none: _ei(''),
};
const PRESET_SET = { all: EDGE_NAMES, outer: ['top', 'right', 'bottom', 'left'], inner: ['inner-h', 'inner-v'], none: [] };
const _edgePresetsFor = (edges) => { const hasInner = edges.some((e) => e.startsWith('inner')); return ['all', ...(hasInner ? ['outer', 'inner'] : []), 'none']; };
const _setIs = (a, b) => a.size === b.length && b.every((x) => a.has(x));

/** @param {object} o · o.edges 고를 수 있는 변 · o.on 켜진 변(Set|배열) · [o.groupId] 옛 id 지킴 · [o.btnAttrs(key)] 단추 덧속성(옛 시험·배선이 찾는 속성 지킴) · [o.label] */
export function edgeSelectHTML({ prefix, edges, on, groupId = '', btnAttrs = () => '', label = '테두리', labels = {} }) {   // labels = 단추 이름 덮어쓰기(그 블럭 옛 aria-label 지킴 · 그리드 «위 외곽선»·«사방» — bt2-safety ③-aria)
  const set = new Set(on), ed = EDGE_NAMES.filter((e) => edges.includes(e));
  const btn = (key, kind, active) => `<button type="button" class="prop-type-btn ui-edge-btn${active ? ' active' : ''}" ${kind}="${key}" aria-pressed="${active}" aria-label="${labels[key] || EDGE_LABEL[key]}" title="${labels[key] || EDGE_LABEL[key]}" ${btnAttrs(key)}>${EDGE_ICON[key]}</button>`;
  const presets = _edgePresetsFor(ed).map((p) => btn(p, 'data-edge-preset', _setIs(set, PRESET_SET[p].filter((e) => ed.includes(e))))).join('');
  return `<div class="ui-stroke-slot" data-slot="below" data-slot-kind="edge-select">
        ${label ? `<div class="prop-row"><span class="prop-label">${label}</span></div>` : ''}
        <div class="ui-edge-grid" id="${groupId || `${prefix}-edges`}" role="group" aria-label="${label || '테두리'} 변" data-field="stroke-edges" data-value="${ed.filter((e) => set.has(e)).join(',')}">
          ${ed.some((e) => e.startsWith('inner'))   /* 안쪽 변 없는 블럭(그리드 블럭 외곽선 = 묶음 2 + 변 4)은 한 줄 — 지디 사전 결정 «빡빡해도 두 줄로 가르지 말 것»(grid-block-outline O0) · 표(10)는 시안 12 대로 두 줄 */
            ? `<div class="ui-edge-row">${presets}</div><div class="ui-edge-row">${ed.map((e) => btn(e, 'data-stroke-edge', set.has(e))).join('')}</div>`
            : `<div class="ui-edge-row">${presets}${ed.map((e) => btn(e, 'data-stroke-edge', set.has(e))).join('')}</div>`}
        </div>
      </div>`;
}

/** @param {object} o · o.edges · [o.links] [[a,b],…] · o.read() → Set · o.write(Set) · o.commit() */
export function wireEdgeSelect({ prefix, groupId = '', edges, links = [], read, write, commit }) {
  const g = document.getElementById(groupId || `${prefix}-edges`);
  if (!g) return;
  const ed = EDGE_NAMES.filter((e) => edges.includes(e));
  const linked = (e) => { const l = links.find((x) => x.includes(e)); return l ? l : [e]; };
  const paint = (set) => {
    g.dataset.value = ed.filter((e) => set.has(e)).join(',');
    g.querySelectorAll('[data-stroke-edge]').forEach((b) => { const a = set.has(b.dataset.strokeEdge); b.classList.toggle('active', a); b.setAttribute('aria-pressed', String(a)); });
    g.querySelectorAll('[data-edge-preset]').forEach((b) => { const a = _setIs(set, PRESET_SET[b.dataset.edgePreset].filter((e) => ed.includes(e))); b.classList.toggle('active', a); b.setAttribute('aria-pressed', String(a)); });
  };
  g.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-stroke-edge],[data-edge-preset]');
    if (!b || !g.contains(b)) return;
    let set = new Set(read());
    if (b.dataset.strokeEdge) { const turnOn = !set.has(b.dataset.strokeEdge); linked(b.dataset.strokeEdge).forEach((e) => (turnOn ? set.add(e) : set.delete(e))); }
    else set = new Set(PRESET_SET[b.dataset.edgePreset].filter((e) => ed.includes(e)));
    write(set); paint(set); commit?.();
  });
}

/* ══ 단계 4-2 — 면별 굵기(§4c ②b «사용자» · 시안 strokestd2 23) ═══════════════════════════════
 * □ 단추(표준 줄 끝 · 슬롯 열고 닫기만 · 데이터 0) + «면별» 슬롯: 묶음 모두/없음/사용자 + 변 넷 켬(0 ↔ 표준) + 사용자 = 굵기 칸 넷(data-field=stroke-width-<변>)
 * 표준 «굵기» 칸 = 넷이 같으면 그 값 · 다르면 Mixed(§1) · 표준 칸에 치면 넷 다 그 값(면별 키 지움 — Figma 와 같음)
 * 어댑터 adapter.sides = { read() → {top,right,bottom,left}|null(면별 아님) , write(obj|null), std() → 표준 굵기 } · 그리기·저장 키는 블럭 몫 */
const SIDES_ICON = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="1.5" y="1.5" width="9" height="9"/><rect x="4" y="4" width="4" height="4" stroke-opacity=".5"/></svg>';
const SIDE_LABEL = { top: '위', right: '오른쪽', bottom: '아래', left: '왼쪽' };
const SIDE_NAMES = ['top', 'right', 'bottom', 'left'];
const _even = (std) => ({ top: std, right: std, bottom: std, left: std });
export function sidesSlotHTML({ prefix, w = null, std = 0, open = false }) {
  const ww = w || _even(std), custom = !!w;
  const btn = (key, kind, active, label, icon) => `<button type="button" class="prop-type-btn ui-edge-btn${active ? ' active' : ''}" ${kind}="${key}" aria-pressed="${active}" aria-label="${label}" title="${label}">${icon}</button>`;
  const presets = [['all', '모두', EDGE_ICON.outer, !custom && std > 0], ['none', '없음', EDGE_ICON.none, custom && SIDE_NAMES.every((s) => ww[s] === 0)], ['custom', '사용자', SIDES_ICON, custom]]
    .map(([k, l, i, a]) => btn(k, 'data-edge-preset', a, l, i)).join('');
  const edges = SIDE_NAMES.map((s) => btn(s, 'data-stroke-edge', ww[s] > 0, SIDE_LABEL[s], EDGE_ICON[s])).join('');
  const nums = SIDE_NAMES.map((s) => `<div class="prop-icon-input" data-part="number" data-field="stroke-width-${s}"><span class="prop-xy-label" title="${SIDE_LABEL[s]}">${EDGE_ICON[s]}</span><input type="number" id="${prefix}-w-${s}" min="0" max="80" value="${ww[s]}" aria-label="${SIDE_LABEL[s]} 굵기"></div>`).join('');
  return `<div class="ui-stroke-slot" data-slot="below" data-slot-kind="edge-select" id="${prefix}-sides"${open ? '' : ' hidden'}>
        <div class="prop-row"><span class="prop-label">면별</span></div>
        <div class="ui-edge-grid" id="${prefix}-sides-edges" role="group" aria-label="면별 변" data-field="stroke-edges" data-value="${SIDE_NAMES.filter((s) => ww[s] > 0).join(',')}">
          <div class="ui-edge-row">${presets}</div><div class="ui-edge-row">${edges}</div>
        </div>
        <div class="ui-side-widths"${custom ? '' : ' hidden'}>${nums}</div>
      </div>`;
}
export function wireSides({ prefix, adapter, widthId = '' }) {
  const S = adapter?.sides; if (!S) return;
  const slot = document.getElementById(`${prefix}-sides`), btn = document.getElementById(`${prefix}-sides-btn`), g = document.getElementById(`${prefix}-sides-edges`);
  const wIn = document.getElementById(widthId || `${prefix}-width`);
  if (!slot || !g) return;
  const paint = () => {
    const w = S.read(), std = S.std(), ww = w || _even(std);
    g.dataset.value = SIDE_NAMES.filter((s) => ww[s] > 0).join(',');
    g.querySelectorAll('[data-stroke-edge]').forEach((b) => { const a = ww[b.dataset.strokeEdge] > 0; b.classList.toggle('active', a); b.setAttribute('aria-pressed', String(a)); });
    const pa = { all: !w && std > 0, none: !!w && SIDE_NAMES.every((s) => ww[s] === 0), custom: !!w };
    g.querySelectorAll('[data-edge-preset]').forEach((b) => { const a = !!pa[b.dataset.edgePreset]; b.classList.toggle('active', a); b.setAttribute('aria-pressed', String(a)); });
    slot.querySelector('.ui-side-widths').hidden = !w;
    for (const s of SIDE_NAMES) { const i = document.getElementById(`${prefix}-w-${s}`); if (i && document.activeElement !== i) i.value = String(ww[s]); }
    const mixed = !!w && !SIDE_NAMES.every((s) => ww[s] === ww.top);
    if (wIn && document.activeElement !== wIn) { wIn.value = mixed ? '' : String(w ? ww.top : std); wIn.placeholder = mixed ? 'Mixed' : ''; if (mixed) wIn.setAttribute('data-empty', 'invalid'); else wIn.removeAttribute('data-empty'); }
  };
  const put = (w, commit = true) => { S.write(w); paint(); if (commit) adapter.commit?.(); };
  btn?.addEventListener('click', () => { slot.hidden = !slot.hidden; btn.setAttribute('aria-pressed', String(!slot.hidden)); });
  g.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-stroke-edge],[data-edge-preset]'); if (!b) return;
    const std = S.std() || 1, cur = S.read() || _even(S.std());
    if (b.dataset.strokeEdge) { const k = b.dataset.strokeEdge; put({ ...cur, [k]: cur[k] > 0 ? 0 : std }); }
    else if (b.dataset.edgePreset === 'all') put(null);
    else if (b.dataset.edgePreset === 'none') put({ top: 0, right: 0, bottom: 0, left: 0 });
    else slot.querySelector('.ui-side-widths').hidden = false;   // 사용자 = 칸 넷 열기(값은 칸에 치는 순간 씀 · 아직 같으면 키 0)
  });
  for (const s of SIDE_NAMES) {
    const i = document.getElementById(`${prefix}-w-${s}`); if (!i) continue;
    const val = () => ({ ...(S.read() || _even(S.std())), [s]: Math.max(0, Math.min(80, parseInt(i.value, 10) || 0)) });
    i.addEventListener('input', () => put(val(), false));
    i.addEventListener('change', () => put(val()));
  }
  /* 표준 «굵기» 칸에 치면 넷 다 그 값(면별 키 지움) — 표준 칸 input 보다 «먼저»(capture) · 같은 칸 change 의 commit 이 한 칸으로 묶는다 */
  wIn?.addEventListener('input', () => { if (S.read() && wIn.value !== '') { S.write(null); paint(); } }, true);
  wIn?.addEventListener('change', () => paint());
}

/* 표준 줄 끝 = ⫶ → □ → (팝오버 div) 순 — ★팝오버 div 가 줄의 «마지막 자식»이어야 한다: 마지막이 .prop-chain-btn 이면 옵션 칼럼 규칙(editor-props.css ⑧ «.prop-row:has(> .prop-chain-btn:last-child)» 음수 margin)이 걸려 줄이 칼럼만큼 넘친다
   (실측 redact-toggle-label-clip ③ — □ 를 맨 끝에 붙인 4-2b 판에서 sec-body·ui-stroke·std 가 211 > 183 · 4-2a 판 초록) */
function _mainEnd(prefix, pop, sides) {
  const sb = sides ? `<button type="button" class="prop-chain-btn ui-stroke-sides-btn" id="${prefix}-sides-btn" aria-pressed="${!!sides.open}" aria-controls="${prefix}-sides" aria-label="면별 굵기" title="면별 굵기">${SIDES_ICON}</button>` : '';
  if (!pop) return sb;
  const ph = strokePopHTML({ prefix, ...pop }), k = ph.indexOf('<div class="ui-stroke-pop"');
  return ph.slice(0, k) + sb + ph.slice(k);
}

/* ══ 단계 5 — 끝점 슬롯(stroke-ends · §4c ②b · 시안 strokestd2 24) ═══════════════════════════════
 * data-slot-kind="stroke-ends" · select data-field="stroke-start"/"stroke-end" · 바꾸기 단추 data-action="stroke-ends-swap"
 * ⛔바꾸기 단추는 .prop-chain-btn 아님 — 줄 마지막 자식이 chain-btn 이면 옵션 칼럼 음수 margin 이 걸려 줄이 넘친다(4-2b 회귀 · S11d) · 그리기·저장 키는 블럭 어댑터 */
export const STROKE_ENDS = Object.freeze([['none', '없음'], ['round', '둥글게'], ['square', '네모'], ['arrow-line', '선 화살표'], ['arrow-triangle', '삼각형'], ['arrow-reversed', '역삼각형'], ['arrow-circle', '원형'], ['arrow-diamond', '마름모']]);
const SWAP_ICON = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h8M8 2l2 2-2 2M10 8H2M4 6L2 8l2 2"/></svg>';
export function endsSlotHTML({ prefix, start, end }) {
  const sel = (id, field, cur, label) => `<div class="ui-s2-cell"><span>${label}</span><select class="prop-select" id="${prefix}-${id}" data-part="select" data-field="${field}" aria-label="${label}">${STROKE_ENDS.map(([v, t]) => `<option value="${v}"${v === cur ? ' selected' : ''}>${t}</option>`).join('')}</select></div>`;
  return `<div class="ui-stroke-slot" data-slot="below" data-slot-kind="stroke-ends">
        <div class="ui-s2-main ui-ends-row prop-row">${sel('start', 'stroke-start', start, '시작점')}${sel('end', 'stroke-end', end, '끝점')}<button type="button" class="prop-type-btn ui-ends-swap" id="${prefix}-ends-swap" data-action="stroke-ends-swap" aria-label="시작점·끝점 바꾸기" title="시작점·끝점 바꾸기">${SWAP_ICON}</button></div>
      </div>`;
}
/** adapter = { read() → {start,end} · write({start,end}) · commit() } · 이력 = 바꿀 때마다 한 칸 */
export function wireEnds({ prefix, adapter }) {
  const a = document.getElementById(`${prefix}-start`), b = document.getElementById(`${prefix}-end`), sw = document.getElementById(`${prefix}-ends-swap`);
  if (!a || !b || !adapter) return;
  const put = (v) => { adapter.write(v); a.value = v.start; b.value = v.end; adapter.commit?.(); };
  a.addEventListener('change', () => put({ ...adapter.read(), start: a.value }));
  b.addEventListener('change', () => put({ ...adapter.read(), end: b.value }));
  sw?.addEventListener('click', () => { const c = adapter.read(); put({ start: c.end, end: c.start }); });
}
