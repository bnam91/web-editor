/* _fill-section.js — 표준 Fill 절 부품(현빈 GO 261124 · 시트 0.9.14 DS-FILL-STD-SECTION-01 · 정본 시안 8910 #mkp-fillstd 탑 55ad8d1 · 계획 gdragon PLAN §4d 65c973c)
 *
 * 꼴(시안 ①): .ui-fill[data-part=fill] › .ui-fill-layer[data-fill-index="0"](겹 줄 하나 · 여러 겹 = 안 함 · 자리만)
 *   겹 줄 = 옛 색 칸(colorFieldHTML · 견본 · 이름칸 · %) + 눈(숨김 · F6 전엔 막힘) + −(칠 지우기 = 어댑터 none)
 *   이름칸: 단색 = HEX · 그라데이션 = «Linear»/«Radial» · 이미지 = «Image»(읽기 전용 — 종류는 견본 클릭 = 앱 color-picker 탭에서 바꾼다)
 *   칠 없음 = «칠 없음 — ＋ 로 더하기» 한 줄 + 머리 ＋(fillHeadToolsHTML · 어댑터 add)
 * 견본 클릭 = 앱 color-picker(goya-cp · 단색/그라데이션/이미지 탭) 그대로 — 계획의 «종류 팝오버»를 새로 짓지 않는다(실측 261124).
 * ⛔color-picker 를 부품이 부르지 않는다: 색 칸 마크업은 부르는 쪽이 colorFieldHTML 로 만들어 colorHtml 로 준다(옛 id·배선 그대로 · 블럭마다 그라데이션/이미지 길이 다름).
 * 데이터 = 어댑터 { add(), none(), commit() } — 부품은 블럭을 모른다.
 */
const EYE = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 6s1.8-3.5 5-3.5S11 6 11 6s-1.8 3.5-5 3.5S1 6 1 6z"/><circle cx="6" cy="6" r="1.4"/></svg>';
const MINUS = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 6h8"/></svg>';
const PLUS = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 2v8M2 6h8"/></svg>';
export const FILL_KIND_NAME = Object.freeze({ linear: 'Linear', radial: 'Radial', conic: 'Angular', image: 'Image' });   // conic = Figma GRADIENT_ANGULAR(옛 홀로그램 칠 · 새로 고르는 종류 아님)

/** 이름칸 즉시 맞춤(피커 탭을 바꾼 뒤 · 패널 재그리기 없이) — 단색이면 읽기 전용 풀고 HEX 는 피커가 채운다 */
export function setFillKindName(hexEl, kind) {
  if (!hexEl) return;
  if (FILL_KIND_NAME[kind]) { hexEl.value = FILL_KIND_NAME[kind]; hexEl.readOnly = true; hexEl.dataset.fillKind = kind; }
  else if (hexEl.dataset.fillKind) { hexEl.readOnly = false; delete hexEl.dataset.fillKind; }
}

/**
 * @param {object} o
 * @param {string} o.prefix       부품 id 접두(예: 'shape-fill') — 눈 `${prefix}-eye` · − `${prefix}-remove` · ＋ `${prefix}-add`
 * @param {string} o.colorHtml    옛 색 칸 마크업(colorFieldHTML · 옛 id 그대로)
 * @param {boolean} [o.on]        false = 칠 없음(겹 줄 대신 «칠 없음» 줄 · 머리 ＋)
 * @param {string} [o.kind]       'solid' | 'linear' | 'radial' | 'image' — 이름칸(단색이면 옛 HEX 그대로)
 * @param {string} [o.hiddenWhy]  눈 막힘 까닭(F6 전 = «곧 지원») · '' 면 산다(F6)
 * @param {string} [o.slotsBelow] 블럭 슬롯(.ui-stroke-slot 꼴)
 */
export function fillSectionHTML({ prefix, colorHtml, on = true, kind = 'solid', hiddenWhy = '숨기기 — 곧 지원', slotsBelow = '' }) {
  let field = String(colorHtml || '').replace('class="prop-color-field"', 'class="prop-color-field" data-part="color" data-field="fill-color"');
  if (FILL_KIND_NAME[kind]) field = field.replace(/(<input type="text" class="prop-color-hex"[^>]*?) value="[^"]*"/, `$1 value="${FILL_KIND_NAME[kind]}" readonly data-fill-kind="${kind}"`);
  const eyeDis = hiddenWhy ? ` aria-disabled="true" tabindex="0" title="${hiddenWhy}"` : '';
  const layer = `<div class="ui-fill-layer" data-fill-index="0">
          <div class="prop-color-row ui-f-row">${field}<button type="button" class="prop-icon-btn ui-fill-btn" id="${prefix}-eye" aria-label="숨기기" aria-pressed="false"${eyeDis}>${EYE}</button><button type="button" class="prop-icon-btn ui-fill-btn" id="${prefix}-remove" aria-label="칠 지우기" title="칠 지우기">${MINUS}</button></div>
        </div>`;
  return `
      <div class="ui-fill" data-part="fill"${on ? '' : ' data-empty="1"'}>
        ${on ? layer : '<div class="prop-hint ui-fill-none">칠 없음 — ＋ 로 더하기</div>'}${slotsBelow}
      </div>`;
}

/** 머리 ＋ — 칠이 없을 때만(시안 ① «빈 Fill(＋만)») · 있을 땐 빈 문자열 */
export function fillHeadToolsHTML({ prefix, on }) {
  return on ? '' : `<button type="button" class="prop-chain-btn prop-sec-add ui-fill-add" id="${prefix}-add" data-part="end-slot" aria-label="칠 더하기" title="칠 더하기">${PLUS}</button>`;
}

/** 배선 — ＋ = adapter.add · − = adapter.none · 각 이력 한 칸(commit) · 눈 막힘이면 열림·누름 막음 */
export function wireFillSection({ prefix, adapter }) {
  if (!adapter) return;
  document.getElementById(`${prefix}-add`)?.addEventListener('click', () => { adapter.add(); adapter.commit?.(); });
  document.getElementById(`${prefix}-remove`)?.addEventListener('click', () => { adapter.none(); adapter.commit?.(); });
  const eye = document.getElementById(`${prefix}-eye`);
  if (eye?.getAttribute('aria-disabled') === 'true') {
    eye.addEventListener('click', (e) => e.preventDefault());
    eye.addEventListener('keydown', (e) => { if (e.key !== 'Tab') e.preventDefault(); });
  }
}
