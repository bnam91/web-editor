/* _appearance-section.js — 표준 Appearance 절 부품(현빈 확정 261124 10:47·10:59·14:39·18:38 · 정본 시안 8910 #mkp-appstd gdragon 88f5aa9 · 계획 handoff/PLAN-appearance-layout-std-261124 A1)
 *
 * 꼴 = FigCraft: 머리 엔드슬롯 [눈] = 7-2 보류 표식(aria-disabled + 까닭) · 몸 = 작은 라벨 + 한 줄 [아이콘 숫자] + 끝 Individual corners = 7-3 보류 표식(자리만)
 *   · 슬라이더 없음 — 숫자 칸 + 아이콘 라벨 끌기(wireNumberScrub)
 *   · Opacity(7-1) = A4 에서 이 줄 앞 칸으로 더한다(새 키 · 지금은 안 그림)
 * ⛔저장 키·옛 숫자 칸 id 무변 — 값 적용은 블럭 어댑터(radius.apply). 표식 단추엔 듣개가 없다(눌러도 아무것도 안 함).
 */
import { wireNumberScrub } from './_helpers.js';

const _appIcon = (d) => `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" aria-hidden="true">${d}</svg>`;
const APP_EYE_ICON = _appIcon('<path d="M1 6s2-3.5 5-3.5S11 6 11 6 9 9.5 6 9.5 1 6 1 6z"/><circle cx="6" cy="6" r="1.4"/>');
const APP_RADIUS_ICON = _appIcon('<path d="M1.5 10.5V6a4.5 4.5 0 0 1 4.5-4.5h4.5"/>');
const APP_CORNERS_ICON = _appIcon('<path d="M1.5 4.5V2.5a1 1 0 0 1 1-1h2M7.5 1.5h2a1 1 0 0 1 1 1v2M10.5 7.5v2a1 1 0 0 1-1 1h-2M4.5 10.5h-2a1 1 0 0 1-1-1v-2"/>');
export const APP_EYE_WHY = '블럭 보이기 — 보류(7-2 · 현빈 261124 10:59) · 지금은 섹션만';
export const APP_CORNERS_WHY = 'Individual corners(모서리 따로) — 보류(7-3 · 현빈 261124 14:39)';

/** 머리 엔드슬롯 [눈] — 보류 표식 · id = `${prefix}-app-eye` */
export function appearanceHeadToolsHTML({ prefix }) {
  return `<button type="button" class="prop-chain-btn ui-app-eye" id="${prefix}-app-eye" data-part="end-slot" aria-disabled="true" aria-label="${APP_EYE_WHY}" title="${APP_EYE_WHY}">${APP_EYE_ICON}</button>`;
}

/**
 * @param {object} o
 * @param {string} o.prefix  블럭의 옛 접두(예: 'ss') — 모서리 따로 단추 = `${prefix}-corners`
 * @param {{numberId:string, value:number, min?:number, max:number, mixed?:boolean}} o.radius  (배선 쪽 = + apply(v) · commit?())  옛 숫자 칸 id 그대로 · 끌기 손잡이 = `${numberId}-scrub`
 */
export function appearanceSectionHTML({ prefix, radius: r }) {
  return `
      <div class="ui-appearance" data-part="appearance">
        <div class="ui-s2-main prop-row">
          <div class="ui-s2-cell"><span>Corner radius</span><div class="prop-icon-input" data-part="number" data-field="appearance-radius"><span class="prop-xy-label ui-app-scrub" id="${r.numberId}-scrub" title="Corner radius — 좌우로 끌면 바뀐다">${APP_RADIUS_ICON}</span><input type="number" class="prop-number" id="${r.numberId}" min="${r.min ?? 0}" max="${r.max}" step="1" value="${r.mixed ? '' : r.value}"${r.mixed ? ' placeholder="Mixed" data-empty="invalid"' : ''} aria-label="Corner radius"></div></div>
          <button type="button" class="prop-chain-btn" id="${prefix}-corners" data-part="end-slot" aria-pressed="false" aria-disabled="true" aria-label="${APP_CORNERS_WHY}" title="${APP_CORNERS_WHY}">${APP_CORNERS_ICON}</button>
        </div>
      </div>`;
}

/** 부위 R 슬롯 한 줄(표준 절 R 은 하나 — 지디 261124 (가)) — 이름 + [아이콘(끌기) 숫자] · 끝 단추 없음 · 배선은 블럭 쪽(끌기 = wireNumberScrub(`${id}-scrub`)) */
export function appearanceSlotNumberHTML({ id, label, value, min = 0, max, kind }) {
  return `
      <div class="prop-row ui-app-slot" data-slot="below" data-slot-kind="${kind}">
        <span class="prop-label">${label}</span>
        <div class="prop-icon-input" data-part="number"><span class="prop-xy-label ui-app-scrub" id="${id}-scrub" title="${label} — 좌우로 끌면 바뀐다">${APP_RADIUS_ICON}</span><input type="number" class="prop-number" id="${id}" min="${min}" max="${max}" step="1" value="${value}" aria-label="${label}"></div>
      </div>`;
}

/** 배선 — 옛 bindSlider 의 숫자 칸 몫 그대로(input = 잘라 적용 · change = 먹은 값 보이기 + 이력 + 저장) + 라벨 끌기 */
export function wireAppearanceSection({ radius: r }) {
  const n = document.getElementById(r.numberId);
  if (!n) return;
  const min = r.min ?? 0, max = r.max;
  const clamp = (raw) => { const v = parseInt(raw); return Number.isNaN(v) ? min : Math.min(max, Math.max(min, v)); };
  n.addEventListener('input', () => r.apply(clamp(n.value)));
  const commit = r.commit || (() => { window.pushHistory?.(); window.scheduleAutoSave?.(); });   // 블럭이 제 commit 을 넘기면 그것(모달 등)
  n.addEventListener('change', () => { n.value = clamp(n.value); r.apply(clamp(n.value)); commit(); });
  wireNumberScrub(document.getElementById(`${r.numberId}-scrub`), n, { min, max });
}
