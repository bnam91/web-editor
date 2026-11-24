/* _position-section.js — 표준 Position 절 부품(시트 0.9.14 73행 · 현빈 확정 261124 10:47·10:49·11:03·11:11 · 정본 시안 8910 #mkp-posstd gdragon 0f8d0ca · 계획 handoff/PLAN-position-std-261124)
 *
 * 꼴: 절 머리 엔드슬롯 = [슬라이드 모드][IAL ⊡](positionHeadToolsHTML) · 몸 = Alignment 6 → X/Y → Rotation(positionSectionHTML)
 *   · 떠 있음 = 지금 공용(floatPositionRowHTML = 정렬 6 + X/Y) 그대로
 *   · 흐름 안 = 정렬 6·X/Y 를 «disabled + 툴팁»으로 보인다(6-2 · 숨김 아님) — 같은 id(시험·배선이 그 id 로 찾는다) · 값 = 0 자리표시
 *   · 회전 = 지금 공용 rotRowHTML 그대로 · 슬라이드 모드(패널 설정 하나 · 6-4)면 그 위에 슬라이더 줄(같은 숫자 칸을 움직인다 = 회전·이력 길 무변)
 *   · 회전 없는 블럭 = rot 를 안 넘김 → 회전 줄 0 · 머리 슬라이드 토글 disabled + 툴팁
 * ⛔새 배선을 짓지 않는다 — 떠 있기·X/Y·정렬·회전은 지금 wireFloatToggle·wireFloatPosition·wireFloatAlign·wireRotRow 그대로. 이 파일은 슬라이드 토글·슬라이더만 잇는다.
 * ⛔저장 키·옛 id 무변(어댑터 = 블럭 패널이 지금 쓰는 id 를 그대로 넘긴다).
 */
import { overlayToggleBtnHTML, rotRowHTML, floatAlignRowHTML } from './_helpers.js';
import { floatPositionRowHTML, isFloat } from '../overlay-float.js';

export const ROT_SLIDE_KEY = 'goditor.rotSlideMode';
export const POS_FLOW_WHY = '흐름 안 블럭은 자리가 흐름으로 정해져요 — 괄호 단추(Ignore Auto Layout)를 켜면 써요';
const ROT_NONE_WHY = '이 블럭은 회전이 없어요';
const SLIDE_ICON = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><path d="M1.5 6h9"/><circle cx="7.5" cy="6" r="1.8" fill="currentColor"/></svg>';

/** 슬라이드 모드 = 패널 설정 하나(블럭마다 기억 안 함 · 현빈 6-4 카드 문구) — 저장소가 막힌 판이면 늘 끔 */
export function rotSlideOn() { try { return localStorage.getItem(ROT_SLIDE_KEY) === '1'; } catch (_) { return false; } }
function _setRotSlide(on) { try { if (on) localStorage.setItem(ROT_SLIDE_KEY, '1'); else localStorage.removeItem(ROT_SLIDE_KEY); } catch (_) {} }

/** 머리 엔드슬롯 [슬라이드 모드][IAL ⊡] — ial 없으면(늘 떠 있는 블럭 등) 슬라이드만 · rotCan false = 토글 disabled + 툴팁 */
export function positionHeadToolsHTML({ prefix, ialId = '', ialOn = false, rotCan = true }) {
  const on = rotCan && rotSlideOn();
  const slide = `<button type="button" class="prop-chain-btn ui-pos-slide" id="${prefix}-rot-slide" data-part="end-slot" aria-pressed="${on}"`
    + (rotCan ? ` title="슬라이드 모드 — 회전을 슬라이더로(다시 누르면 숫자 칸)" aria-label="슬라이드 모드"` : ` disabled aria-disabled="true" title="${ROT_NONE_WHY}" aria-label="슬라이드 모드 — ${ROT_NONE_WHY}"`)
    + `>${SLIDE_ICON}</button>`;
  return slide + (ialId ? overlayToggleBtnHTML({ id: ialId, active: ialOn }) : '');
}

/** 흐름 안(6-2) — 정렬 6·X/Y 를 같은 id 로 disabled + 툴팁 */
function _flowRowsHTML(prefix) {
  const dis = ` disabled aria-disabled="true" title="${POS_FLOW_WHY}"`;
  const align = floatAlignRowHTML().replace(/<button /g, `<button${dis} `).replace('data-float-align-row="parent"', `data-float-align-row="flow" title="${POS_FLOW_WHY}"`);
  return `${align}
      <span class="prop-field-label">X / Y</span>
      <div class="prop-lhls-row" data-pos-flow="1" title="${POS_FLOW_WHY}">
        <div class="prop-lhls-col"><div class="prop-icon-input"><span class="prop-xy-label">X</span><input type="number" id="${prefix}-x-number" value="" aria-label="X position"${dis}></div></div>
        <div class="prop-lhls-col"><div class="prop-icon-input"><span class="prop-xy-label">Y</span><input type="number" id="${prefix}-y-number" value="" aria-label="Y position"${dis}></div></div>
      </div>`;
}

/**
 * @param {object} o
 * @param {string} o.prefix  블럭의 옛 접두(예: 'mdl') — X/Y = `${prefix}-x-number`·`-y-number` · 슬라이드 = `${prefix}-rot-slide`
 * @param {HTMLElement} o.posEl  자리 요소(posElOf) — 떠 있으면 floatPositionRowHTML
 * @param {boolean} [o.xy=true]  false = 정렬·X/Y 줄 없음(그 블럭엔 자리 칸이 없다)
 * @param {object} [o.rot]  rotRowHTML 인자(p·numberId·value·flipH·flipV·ids) — 없으면 회전 줄 0
 */
export function positionSectionHTML({ prefix, posEl, xy = true, rot = null }) {
  const place = !xy ? '' : (posEl && isFloat(posEl) ? floatPositionRowHTML({ prefix, posEl }) : _flowRowsHTML(prefix));
  if (!rot) return place;
  const slide = rotSlideOn() ? `
      <div class="prop-row ui-rot-slide-row"><input type="range" class="prop-slider" id="${rot.numberId}-slider" min="${rot.min ?? -180}" max="${rot.max ?? 180}" step="1" value="${Number(rot.value) || 0}" aria-label="회전(슬라이더)" style="flex:1;min-width:0"></div>` : '';
  return `${place}
      <span class="prop-field-label">Rotation</span>${slide}${rotRowHTML(rot)}`;
}

/** 슬라이드 토글·슬라이더만 잇는다(나머지는 블럭 패널의 지금 배선) · rerender = 패널 다시 그리기(토글 뒤 슬라이더 줄 넣고/빼기) */
export function wirePositionSection({ prefix, numberId, rerender }) {
  const t = document.getElementById(`${prefix}-rot-slide`);
  if (t && !t.disabled) t.addEventListener('click', (e) => { e.preventDefault(); _setRotSlide(!rotSlideOn()); rerender?.(); });
  const s = numberId && document.getElementById(`${numberId}-slider`), n = numberId && document.getElementById(numberId);
  if (!s || !n) return;
  /* 슬라이더 = 그 블럭의 옛 숫자 칸을 움직인다(값·키·이력 = wireRotRow·블럭 배선 그대로) — input = 끄는 동안 · change = 확정 */
  s.addEventListener('input', () => { n.value = s.value; n.dispatchEvent(new Event('input', { bubbles: true })); });
  s.addEventListener('change', () => { n.value = s.value; n.dispatchEvent(new Event('change', { bubbles: true })); });
  n.addEventListener('input', () => { s.value = n.value; });
}
