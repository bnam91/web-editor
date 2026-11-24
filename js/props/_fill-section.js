/* _fill-section.js — 표준 Fill 절 부품(현빈 GO 261124 · 시트 0.9.14 DS-FILL-STD-SECTION-01 · 정본 시안 8910 #mkp-fillstd 탑 55ad8d1 · 계획 gdragon PLAN §4d 65c973c)
 *
 * 꼴(시안 ①): .ui-fill[data-part=fill] › .ui-fill-layer[data-fill-index="0"](겹 줄 하나 · 여러 겹 = 안 함 · 자리만)
 *   겹 줄 = 옛 색 칸(colorFieldHTML · 견본 · 이름칸 · %) + 눈(숨김 · F6 전엔 막힘) + −(칠 지우기 = 어댑터 none)
 *   이름칸: 단색 = HEX · 그라데이션 = «Linear»/«Radial» · 이미지 = «Image» — ⛔읽기 전용 아님: 누르면(포커스) 옛 HEX 가 들어와 «HEX 쳐서 단색으로» 옛 길이 산다(text-gradient G6 · 261124) · 안 바꾸고 나가면 이름으로 돌아감
 *   칠 없음 = «칠 없음 — ＋ 로 더하기» 한 줄 + 머리 ＋(fillHeadToolsHTML · 어댑터 add)
 *   ⛔그 줄은 .prop-hint 가 아니다(.ui-fill-none) — 힌트면 패널 힌트 수(≤2)·힌트 명부 spec 에 잡힌다(radial-t4-b H0 · 지혜맥 261124)
 * 견본 클릭 = 앱 color-picker(goya-cp · 단색/그라데이션/이미지 탭) 그대로 — 계획의 «종류 팝오버»를 새로 짓지 않는다(실측 261124).
 * ⛔color-picker 를 부품이 부르지 않는다: 색 칸 마크업은 부르는 쪽이 colorFieldHTML 로 만들어 colorHtml 로 준다(옛 id·배선 그대로 · 블럭마다 그라데이션/이미지 길이 다름).
 * 데이터 = 어댑터 { add(), none(), commit() } — 부품은 블럭을 모른다.
 */
const EYE = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 6s1.8-3.5 5-3.5S11 6 11 6s-1.8 3.5-5 3.5S1 6 1 6z"/><circle cx="6" cy="6" r="1.4"/></svg>';
const MINUS = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 6h8"/></svg>';
const PLUS = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 2v8M2 6h8"/></svg>';
export const FILL_KIND_NAME = Object.freeze({ linear: 'Linear', radial: 'Radial', conic: 'Angular', image: 'Image' });   // conic = Figma GRADIENT_ANGULAR(옛 홀로그램 칠 · 새로 고르는 종류 아님)

/** 지난 색(＋ 로 되살림) — 블럭 id 열쇠(⌘Z/⇧⌘Z 가 요소를 새로 만들어 요소 열쇠는 잃는다 · F1 D3 실측) · shortcut: 세션 안에서만(저장 키 0) — 다시 열어서도 원하면 dataset 키로 */
const _LAST = new Map();
export const fillLast = { set: (id, c) => { if (id && c && c !== 'transparent') _LAST.set(id, c); }, get: (id, dflt) => _LAST.get(id) || dflt };
/** CSS 칠 문자열 → 이름칸 종류(그라데이션 아니면 'solid') */
export const fillKindOfCss = (css) => { const m = /(linear|radial|conic)-gradient\s*\(/i.exec(css || ''); return m ? m[1].toLowerCase() : 'solid'; };

/** 이름칸 즉시 맞춤(피커 탭을 바꾼 뒤 · 패널 재그리기 없이) — 이름으로 바꿀 때 그때 HEX 를 data-fill-hex 에 둠(포커스 때 되돌림) · 단색이면 표식만 걷고 HEX 는 피커가 채운다 */
export function setFillKindName(hexEl, kind) {
  if (!hexEl) return;
  if (FILL_KIND_NAME[kind]) { if (!hexEl.dataset.fillKind) hexEl.dataset.fillHex = hexEl.value; hexEl.value = FILL_KIND_NAME[kind]; hexEl.dataset.fillKind = kind; }
  else if (hexEl.dataset.fillKind) { if (hexEl.value === FILL_KIND_NAME[hexEl.dataset.fillKind]) hexEl.value = hexEl.dataset.fillHex || hexEl.value; delete hexEl.dataset.fillKind; delete hexEl.dataset.fillHex; }
}
/* 이름칸 포커스 = HEX(쳐서 단색으로 가는 옛 길) · 안 바꾸고 나가면 이름 — 패널마다 배선 없이 한 벌(document 위임) */
if (typeof document !== 'undefined') document.addEventListener('focusin', (e) => { const h = e.target; if (h?.classList?.contains('prop-color-hex') && h.dataset.fillKind) { h.value = h.dataset.fillHex || ''; h.select?.(); } });
if (typeof document !== 'undefined') document.addEventListener('focusout', (e) => { const h = e.target; if (h?.classList?.contains('prop-color-hex') && h.dataset.fillKind && FILL_KIND_NAME[h.dataset.fillKind]) h.value = FILL_KIND_NAME[h.dataset.fillKind]; });

/**
 * @param {object} o
 * @param {string} o.prefix       부품 id 접두(예: 'shape-fill') — 눈 `${prefix}-eye` · − `${prefix}-remove` · ＋ `${prefix}-add`
 * @param {string} o.colorHtml    옛 색 칸 마크업(colorFieldHTML · 옛 id 그대로)
 * @param {boolean} [o.on]        false = 칠 없음(겹 줄 대신 «칠 없음» 줄 · 머리 ＋)
 * @param {string} [o.kind]       'solid' | 'linear' | 'radial' | 'image' — 이름칸(단색이면 옛 HEX 그대로)
 * @param {string} [o.hiddenWhy]  눈 막힘 까닭(F6 전 = «곧 지원») · '' 면 산다(F6)
 * @param {string} [o.slotsBelow] 블럭 슬롯(.ui-stroke-slot 꼴)
 * @param {string} [o.removeWhy]  − 막힘 까닭(칠을 못 지우는 블럭 · 예: 그라데이션 블럭) · '' 면 산다
 */
export function fillSectionHTML({ prefix, colorHtml, on = true, kind = 'solid', hiddenWhy = '숨기기 — 곧 지원', slotsBelow = '', removeWhy = '' }) {
  let field = String(colorHtml || '').replace('class="prop-color-field"', 'class="prop-color-field" data-part="color" data-field="fill-color"');
  if (FILL_KIND_NAME[kind]) field = field.replace(/(<input type="text" class="prop-color-hex"[^>]*?) value="([^"]*)"/, `$1 value="${FILL_KIND_NAME[kind]}" data-fill-kind="${kind}" data-fill-hex="$2"`);
  const eyeDis = hiddenWhy ? ` aria-disabled="true" tabindex="0" title="${hiddenWhy}"` : '';
  const layer = `<div class="ui-fill-layer" data-fill-index="0">
          <div class="prop-color-row ui-f-row">${field}<button type="button" class="prop-icon-btn ui-fill-btn" id="${prefix}-eye" aria-label="숨기기" aria-pressed="false"${eyeDis}>${EYE}</button><button type="button" class="prop-icon-btn ui-fill-btn" id="${prefix}-remove" aria-label="칠 지우기" title="${removeWhy || '칠 지우기'}"${removeWhy ? ' aria-disabled="true"' : ''}>${MINUS}</button></div>
        </div>`;
  return `
      <div class="ui-fill" data-part="fill"${on ? '' : ' data-empty="1"'}>
        ${on ? layer : '<div class="ui-fill-none">칠 없음 — ＋ 로 더하기</div>'}${slotsBelow}
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
  const rm = document.getElementById(`${prefix}-remove`);
  if (rm?.getAttribute('aria-disabled') !== 'true') rm?.addEventListener('click', () => { adapter.none(); adapter.commit?.(); });
  const eye = document.getElementById(`${prefix}-eye`);
  if (eye?.getAttribute('aria-disabled') === 'true') {
    eye.addEventListener('click', (e) => e.preventDefault());
    eye.addEventListener('keydown', (e) => { if (e.key !== 'Tab') e.preventDefault(); });
  }
}
