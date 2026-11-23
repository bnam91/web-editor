/* _stroke-section.js — 표준 Stroke 절 부품(현빈 261123 «절 = 재사용 컴포넌트» · 구현 GO · 정본 시안 8910 strokestd2 · 계약 gdragon PLAN-ds-parts-state §4c ②b e3dc80d)
 *
 * 꼴(시안 그대로): .ui-stroke.ui-stroke2[data-part=stroke] › .ui-stroke-std
 *   ┌ 색 한 줄(.prop-color-row.ui-s2-layer · 라벨 없음 = Figma 겹 줄) — data-part=color · data-field=stroke-color
 *   └ [위치 | 굵기] 한 줄(.ui-s2-main · 칸 위 작은 캡션) — select data-field=stroke-align(안쪽·가운데·바깥) · 숫자 data-field=stroke-width
 *   그 아래 블럭별 특수 슬롯(.ui-stroke-slot[data-slot=below][data-slot-kind=…]) — 부르는 패널이 slotsBelow 로 넘긴다.
 * ⛔⫶ «Stroke 설정» 팝오버 · □ 면별 단추는 «그 단계에서» 단다(배선 없는 단추를 먼저 그리지 않는다 — 단계 커밋 순서 §4c ④).
 *
 * 데이터 = 어댑터(블럭마다 저장 키가 다르다 — §4c ① 표 · ⛔저장 키 무변):
 *   wireStrokeSection({ prefix, adapter }) · adapter = { color(c), width(v), align?(v), commit() } — 부품은 블럭을 모른다.
 * 위치를 아직 못 그리는 블럭 = canAlign:false → 칸은 보이되 «막힘»(aria-disabled · 툴팁 = 까닭 · 값 = 지금 그려지는 쪽) — §4c ②③ «칸만 + 막힘».
 */
import { colorFieldHTML, wireColorField } from './color-picker.js';

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
 * @param {string} [o.bodyId] · [o.widthId] · [o.colorId]  그 블럭이 옛부터 쓰던 id 를 지킬 때(시험·외부 배선이 그 id 로 찾는다 · 없으면 prefix 기본)
 */
export function strokeSectionHTML({ prefix, color, alpha, width, maxWidth = 80, align = 'center', canAlign = true, alignWhy = '', slotsBelow = '', on = true, bodyId = '', widthId = '', colorId = '' }) {
  const colorField = colorFieldHTML({ idPrefix: colorId || `${prefix}-color`, hex: color, alpha })
    .replace('class="prop-color-field"', 'class="prop-color-field" data-part="color" data-field="stroke-color"');
  const blocked = canAlign ? '' : ` aria-disabled="true" tabindex="0" title="${alignWhy}"`;
  return `
      <div class="ui-stroke ui-stroke2" data-part="stroke"${bodyId ? ` id="${bodyId}"` : ''}${on ? '' : ' hidden'}>
        <div class="ui-stroke-std">
          <div class="prop-color-row ui-s2-layer">${colorField}</div>
          <div class="ui-s2-main prop-row">
            <div class="ui-s2-cell"><span>위치</span><select class="prop-select" id="${prefix}-align" data-part="select" data-field="stroke-align" aria-label="위치"${blocked}>${STROKE_ALIGNS.map(([v, t]) => `<option value="${v}"${v === align ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
            <div class="ui-s2-cell"><span>굵기</span><div class="prop-icon-input" data-part="number" data-field="stroke-width"><span class="prop-xy-label" title="굵기">${W_ICON}</span><input type="number" id="${widthId || `${prefix}-width`}" min="0" max="${maxWidth}" value="${width}" aria-label="굵기"></div></div>
          </div>
        </div>${slotsBelow}
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

/** 배선 — 색(color-picker 한 벌) · 굵기(입력 = 쓰기 · change = 이력 한 칸 · push-after) · 위치(막힘이면 안 열림·안 바뀜). */
export function wireStrokeSection({ prefix, adapter, alpha, maxWidth = 80, widthId = '', colorId = '', onWidth = 2 }) {
  wireColorField(colorId || `${prefix}-color`, { initialAlpha: alpha, onApply: (c) => adapter.color(c), onCommit: () => adapter.commit() });
  const w = document.getElementById(widthId || `${prefix}-width`);
  /* 머리 ＋/− — 켜면 «지난 굵기 · 없으면 onWidth»(에셋 옛 기본 2 그대로) · 끄면 adapter.none(없으면 굵기 0) · 몸 숨김 · 이력 한 칸 */
  const on = document.getElementById(`${prefix}-on`), ui = w?.closest('.ui-stroke');
  on?.addEventListener('change', () => {
    if (on.checked) { const cur = parseInt(w?.value, 10) || 0, v = cur > 0 ? cur : onWidth; if (w) w.value = String(v); adapter.width(v); }   // 끌 때 칸 값은 그대로 둔다 → 다시 켜면 지난 굵기
    else if (adapter.none) adapter.none(); else adapter.width(0);
    if (ui) ui.hidden = !on.checked;
    adapter.commit();
  });
  w?.addEventListener('input', () => { const v = Math.min(maxWidth, Math.max(0, parseInt(w.value, 10) || 0)); adapter.width(v); });
  w?.addEventListener('change', () => { const v = Math.min(maxWidth, Math.max(0, parseInt(w.value, 10) || 0)); w.value = String(v); adapter.commit(); });
  const a = document.getElementById(`${prefix}-align`);
  if (!a) return;
  if (a.getAttribute('aria-disabled') === 'true') {   // 막힘 — 초점·툴팁은 받고(P6) 열림·값 바뀜은 막는다
    a.addEventListener('mousedown', (e) => e.preventDefault());
    a.addEventListener('keydown', (e) => { if (e.key !== 'Tab') e.preventDefault(); });
    return;
  }
  a.addEventListener('change', () => { adapter.align?.(a.value); adapter.commit(); });
}
