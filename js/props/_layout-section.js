/* _layout-section.js — 표준 Layout 절 부품(현빈 확정 261124 18:38·19:22 · 정본 시안 8910 #mkp-layoutstd · 계획 handoff/PLAN-appearance-layout-std-261124 §2-b·§3 · L1)
 *
 * 꼴 = FigCraft(Appearance 와 같은 줄 꼴): 작은 라벨 «Width | Height» + 24px 한 줄(--ui-input-h) [↔ 숫자][↕ 숫자] + 끝 24px 비율 사슬
 *   · 슬라이더 없음 — 숫자 칸 + 아이콘 라벨 끌기(wireNumberScrub) · 한 칸 블럭(one) · 높이 자동(h.auto = 칸·사슬 막힘)
 *   · 모드 줄(mode) = «그 블럭에 이미 있는 모드만»(§2-b · 새 모드 0) — 배선은 블럭 쪽(옛 단추·세그먼트와 같은 길)
 *   · 슬롯 = 패딩(좌우·상하 두 칸) · 간격(한 칸) — 면별 패딩은 보류(칸 없음)
 * 비율 사슬 키 = dataset.ratioLock('1'/'0') — ★기본과 다를 때만 쓴다(기본 = 에셋·이미지 켬 · 나머지 끔) ⇒ 옛 저장본 바이트 무변.
 * ⛔저장 키·옛 숫자 칸 id·몸 id(psec-size-body 등) 무변 — 값 적용은 블럭 어댑터(apply/read).
 */
import { wireNumberScrub } from './_helpers.js';

const _layIcon = (d) => `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const LAY_W_ICON = _layIcon('<path d="M1.5 6h9M3 4 1.5 6 3 8M9 4l1.5 2L9 8"/>');
const LAY_H_ICON = _layIcon('<path d="M6 1.5v9M4 3 6 1.5 8 3M4 9l2 1.5L8 9"/>');
const LAY_CHAIN_ICON = _layIcon('<path d="M5 7 7 5M4.2 5.6 3 6.8a1.7 1.7 0 0 0 2.4 2.4L6.6 8M7.8 6.4 9 5.2A1.7 1.7 0 0 0 6.6 2.8L5.4 4"/>');
const LAY_PX_ICON = _layIcon('<path d="M1.5 2v8M10.5 2v8M4 6h4"/>');
const LAY_PY_ICON = _layIcon('<path d="M2 1.5h8M2 10.5h8M6 4v4"/>');
const LAY_GAP_ICON = _layIcon('<path d="M1.5 2h3v8h-3M10.5 2h-3v8h3"/>');
const LAY_MODE_ICON = _layIcon('<path d="M1.5 6h9M1.5 3.5v5M10.5 3.5v5"/>');
export const LAY_CHAIN_WHY = '비율 사슬 — 켜면 W 를 바꿀 때 H 가 비율대로(H 도 같다)';
export const LAY_AUTO_WHY = '높이는 내용이 정해요(자동) — 비율 사슬 막힘';

/** 비율 사슬 켬? — 키 없으면 기본(dflt) */
export const ratioLockOn = (block, dflt) => (block.dataset.ratioLock == null ? !!dflt : block.dataset.ratioLock === '1');
/** 비율 사슬 저장 — 기본과 같으면 키를 지운다(옛 바이트 보존) */
export function setRatioLock(block, on, dflt) {
  if (!!on === !!dflt) delete block.dataset.ratioLock; else block.dataset.ratioLock = on ? '1' : '0';
}

/* 칸 하나 — 작은 라벨 + [아이콘(끌기) 숫자] · Mixed = 빈 값 + placeholder + data-empty="invalid"(N9) · auto = 막힘 «자동» */
const _layCell = (label, field, icon, c) => {
  const blank = c.mixed || c.auto;
  const ph = c.mixed ? ' placeholder="Mixed" data-empty="invalid"' : c.auto ? ` placeholder="자동" data-empty="auto" disabled title="${LAY_AUTO_WHY}"` : '';
  return `<div class="ui-s2-cell"><span>${label}</span><div class="prop-icon-input" data-part="number" data-field="${field}"><span class="prop-xy-label ui-app-scrub" id="${c.id}-scrub" title="${label || field} — 좌우로 끌면 바뀐다">${icon}</span><input type="number" class="prop-number" id="${c.id}" min="${c.min ?? 0}" max="${c.max}" step="1" value="${blank ? '' : c.value}"${ph} aria-label="${label || field}"></div></div>`;
};
/* 끝 칸 자리 맞춤(사슬 없는 줄도 숫자 칸 끝이 같은 자리) */
const _LAY_SPACER = '<span class="ui-lay-spacer" aria-hidden="true"></span>';
const _layEmpty = '<div class="ui-s2-cell" aria-hidden="true"></div>';

const _layModeCell = (label, m) => (m ? `<div class="ui-s2-cell"><div class="prop-icon-input" data-field="layout-mode-${label === '너비' ? 'w' : 'h'}" title="${label} 모드 — 그 블럭에 이미 있는 모드만"><span class="prop-xy-label">${LAY_MODE_ICON}</span><select class="prop-select" id="${m.id}" aria-label="${label} 모드">${m.options.map(([v, t]) => `<option value="${v}"${v === m.value ? ' selected' : ''}>${t}</option>`).join('')}</select></div></div>` : _layEmpty);

/**
 * W/H 한 줄(또는 한 칸) + 모드 줄. 사슬 단추 id = `${prefix}-ratio`.
 * @param {object} o
 * @param {{id:string, value:number, min?:number, max:number, mixed?:boolean}} [o.w]
 * @param {{id:string, value:number, min?:number, max:number, mixed?:boolean, auto?:boolean}} [o.h]
 * @param {{id:string, label:string, value:number, min?:number, max:number, mixed?:boolean}} [o.one]  크기 한 칸(정비율 블럭) — 사슬 없음
 * @param {{on:boolean}} [o.chain]
 * @param {{w?:{id,value,options:[string,string][]}, h?:{…}}} [o.mode]
 */
export function layoutSizeRowHTML({ prefix, w, h, one, chain, mode }) {
  if (one) {
    return `
      <div class="ui-layout" data-part="layout">
        <div class="ui-s2-main prop-row">${_layCell(one.label, 'layout-one', LAY_W_ICON, one)}${_layEmpty}${_LAY_SPACER}</div>
      </div>`;
  }
  const on = !!chain?.on, dis = !!h?.auto;
  const why = dis ? LAY_AUTO_WHY : LAY_CHAIN_WHY;
  return `
      <div class="ui-layout" data-part="layout">
        <div class="ui-s2-main prop-row">${w ? _layCell('Width', 'layout-w', LAY_W_ICON, w) : _layEmpty}${h ? _layCell('Height', 'layout-h', LAY_H_ICON, h) : _layEmpty}
          <button type="button" class="prop-chain-btn${on && !dis ? ' active' : ''}" id="${prefix}-ratio" data-part="end-slot" aria-pressed="${on && !dis}"${dis ? ' aria-disabled="true"' : ''} aria-label="${why}" title="${why}">${LAY_CHAIN_ICON}</button>
        </div>${mode && (mode.w || mode.h) ? `
        <div class="ui-s2-main prop-row" data-part="layout-mode">${_layModeCell('너비', mode.w)}${_layModeCell('높이', mode.h)}${_LAY_SPACER}</div>` : ''}
      </div>`;
}

/** 패딩 슬롯 — 좌우 ↔ · 상하 ↕ 두 칸(지금 앱 padx/pady 꼴 그대로) · 작은 라벨 «Padding» */
export function layoutPadSlotHTML({ xId, yId, x, y, min = 0, max, mixed = false }) {
  return `
      <div class="ui-layout ui-lay-slot" data-part="layout" data-slot="pad">
        <div class="ui-s2-main prop-row">${_layCell('Padding', 'layout-pad-x', LAY_PX_ICON, { id: xId, value: x, min, max, mixed })}${_layCell('', 'layout-pad-y', LAY_PY_ICON, { id: yId, value: y, min, max, mixed })}${_LAY_SPACER}</div>
      </div>`;
}

/** 간격 슬롯 — 블럭 안 항목 사이 한 칸 · 작은 라벨 «Gap» */
export function layoutGapSlotHTML({ id, value, min = 0, max, mixed = false }) {
  return `
      <div class="ui-layout ui-lay-slot" data-part="layout" data-slot="gap">
        <div class="ui-s2-main prop-row">${_layCell('Gap', 'layout-gap', LAY_GAP_ICON, { id, value, min, max, mixed })}${_layEmpty}${_LAY_SPACER}</div>
      </div>`;
}

/**
 * 배선 — 축마다 { numberId, min?, max, apply(v), read?() } · chain { id, on, set(on) } · commit?()
 *   input = 범위 안이면 바로 그림(사슬 켬 → 짝 축도 비율대로) · change = 잘라 그림 + commit 한 번(짝 축 포함 = ⌘Z 한 칸)
 *   빈 칸 change = 편집 전 값으로 되돌림 · commit 0 · 라벨 끌기 = 같은 길(놓을 때 change 한 번)
 *   비율 = 편집 «시작» 때 블럭 값(read)으로 잰다 — 핸들·프리셋이 바꾼 모양도 따라간다.
 *   pad/gap/one 칸 하나도 이걸로(w 만 주면 된다).
 */
export function wireLayoutSection({ w, h, chain = null, commit } = {}) {
  const done = commit || (() => { window.pushHistory?.(); window.scheduleAutoSave?.(); });
  const axes = [w, h].filter(Boolean).map((a) => ({ ...a, min: a.min ?? 0, n: document.getElementById(a.numberId) })).filter((a) => a.n);
  let on = !!chain?.on, start = null;
  const val = (a) => (a.read ? a.read() : parseFloat(a.n.value));
  const lim = (a, v) => Math.min(a.max, Math.max(a.min, v));
  const begin = () => { if (!start) start = axes.map(val); };
  const follow = (a, v) => {
    const i = axes.indexOf(a), o = axes[1 - i];
    if (!on || !o || o.n.disabled || !(start[i] > 0)) return;
    const ov = lim(o, Math.round(v * start[1 - i] / start[i]));
    o.apply(ov); o.n.value = ov;
  };
  for (const a of axes) {
    a.n.addEventListener('input', () => {
      begin();
      const v = parseInt(a.n.value, 10);
      if (!Number.isFinite(v) || v < a.min || v > a.max) return;   // 치는 중(범위 밖·빈 칸)은 안 그림 — change 가 자른다
      a.apply(v); follow(a, v);
    });
    a.n.addEventListener('change', () => {
      begin();
      const raw = parseInt(a.n.value, 10), s = start; start = null;
      if (!Number.isFinite(raw)) {   // 값 없음 = 아무 일도 없었다(되돌림 · 이력 0)
        axes.forEach((x, i) => { if (val(x) !== s[i]) x.apply(s[i]); x.n.value = s[i]; });
        return;
      }
      const v = lim(a, raw);
      a.apply(v); a.n.value = v; start = s; follow(a, v); start = null;
      done();
    });
    wireNumberScrub(document.getElementById(`${a.numberId}-scrub`), a.n, { min: a.min, max: a.max });
  }
  const btn = chain && document.getElementById(chain.id);
  btn?.addEventListener('click', () => {
    if (btn.getAttribute('aria-disabled') === 'true') return;
    on = !on;
    btn.setAttribute('aria-pressed', String(on)); btn.classList.toggle('active', on);
    chain.set(on); done();
  });
}
