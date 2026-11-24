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
const LAY_ALL_ICON = _layIcon('<path d="M1.5 1.5h9v9h-9z"/><path d="M4 4h4v4H4z"/>');   // 네 면 한 값
const LAY_GAPY_ICON = _layIcon('<path d="M2 1.5v3h8v-3M2 10.5v-3h8v3"/>');   // 줄 사이(세로) 간격
const LAY_NUM_ICON = _layIcon('<path d="M2 4.5h8M2 7.5h8M4.5 2 3.5 10M8.5 2l-1 8"/>');   // 중립(블럭 슬롯 숫자)
const _LAY_ONE_ICON = { w: LAY_W_ICON, h: LAY_H_ICON, px: LAY_NUM_ICON };
const LAY_MODE_ICON = _layIcon('<path d="M1.5 6h9M1.5 3.5v5M10.5 3.5v5"/>');
export const LAY_CHAIN_WHY = '비율 사슬 — 켜면 W 를 바꿀 때 H 가 비율대로(H 도 같다)';
export const LAY_AUTO_WHY = '높이는 내용이 정해요(자동) — 비율 사슬 막힘';
/** 너비 = 줄 폭(100% · 꽉참) 블럭의 사슬 막힘 까닭(지디 261125 ⒜) — 소비자는 chain.blocked 에 이 말(또는 제 까닭)을 준다 */
export const LAY_FULLW_WHY = '너비가 줄 폭에 맞춰져 있어 비율을 묶을 수 없어요';
/* 사슬 단추 상태 — 막힘(까닭 있음)이면 aria-disabled + 까닭 툴팁 · 켬 표시 끔(저장 키는 안 건드린다) */
const _layChainState = (on, why) => ({ pressed: !!on && !why, title: why || LAY_CHAIN_WHY });

/** 비율 사슬 켬? — 키 없으면 기본(dflt) */
export const ratioLockOn = (block, dflt) => (block.dataset.ratioLock == null ? !!dflt : block.dataset.ratioLock === '1');
/** 비율 사슬 저장 — 기본과 같으면 키를 지운다(옛 바이트 보존) */
export function setRatioLock(block, on, dflt) {
  if (!!on === !!dflt) delete block.dataset.ratioLock; else block.dataset.ratioLock = on ? '1' : '0';
}

/* 칸 하나 — 작은 라벨 + [아이콘(끌기) 숫자] · Mixed = 빈 값 + placeholder + data-empty="invalid"(N9) · auto = 막힘 «자동» */
const _layCell = (label, field, icon, c) => {
  const blank = c.mixed || c.auto;
  const ph = c.mixed ? ' placeholder="Mixed" data-empty="invalid"' : c.auto ? ` placeholder="자동" data-empty="invalid" disabled title="${LAY_AUTO_WHY}"` : '';
  return `<div class="ui-s2-cell"><span>${label}</span><div class="prop-icon-input" data-part="number" data-field="${field}"><span class="prop-xy-label ui-app-scrub" id="${c.id}-scrub" title="${label || field} — 좌우로 끌면 바뀐다">${icon}</span><input type="number" class="prop-number" id="${c.id}" min="${c.min ?? 0}" max="${c.max}" step="${c.step ?? 1}" value="${blank ? '' : c.value}"${ph} aria-label="${label || field}"></div></div>`;
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
 * @param {{id:string, label:string, value:number, min?:number, max:number, mixed?:boolean, icon?:'w'|'h'|'px'}} [o.one]  한 칸(정비율 크기 · 높이만 · 중립) — 사슬 없음 · 아이콘 기본 'w'(↔) · 'h'(↕) · 'px'(중립)
 * @param {{on:boolean, blocked?:string|null}} [o.chain]  blocked = 막힘 까닭(예 LAY_FULLW_WHY) — 있으면 aria-disabled + 툴팁 · H 를 바꿔도 W 안 따라감
 * @param {{w?:{id,value,options:[string,string][]}, h?:{…}}} [o.mode]
 */
export function layoutSizeRowHTML({ prefix, w, h, one, chain, mode }) {
  if (one) {
    return `
      <div class="ui-layout" data-part="layout">
        <div class="ui-s2-main prop-row">${_layCell(one.label, 'layout-one', _LAY_ONE_ICON[one.icon] || LAY_W_ICON, one)}${_layEmpty}${_LAY_SPACER}</div>
      </div>`;
  }
  const st = _layChainState(chain?.on, h?.auto ? LAY_AUTO_WHY : chain?.blocked || null);
  const on = st.pressed, dis = st.title !== LAY_CHAIN_WHY, why = st.title;
  return `
      <div class="ui-layout" data-part="layout">
        <div class="ui-s2-main prop-row">${w ? _layCell('Width', 'layout-w', LAY_W_ICON, w) : _layEmpty}${h ? _layCell('Height', 'layout-h', LAY_H_ICON, h) : _layEmpty}
          <button type="button" class="prop-chain-btn${on ? ' active' : ''}" id="${prefix}-ratio" data-part="end-slot" aria-pressed="${on}"${dis ? ' aria-disabled="true"' : ''} aria-label="${why}" title="${why}">${LAY_CHAIN_ICON}</button>
        </div>${mode && (mode.w || mode.h) ? `
        <div class="ui-s2-main prop-row" data-part="layout-mode">${_layModeCell('너비', mode.w)}${_layModeCell('높이', mode.h)}${_LAY_SPACER}</div>` : ''}
      </div>`;
}

/* 끝 사슬 — 블럭이 이미 가진 사슬 단추(id 그대로 · 배선도 블럭 쪽) */
const _layOwnChain = (id, on, title) => (id ? `<button type="button" class="prop-chain-btn${on ? ' active' : ''}" id="${id}" data-part="end-slot" aria-pressed="${!!on}" aria-label="${title}" title="${title}">${LAY_CHAIN_ICON}</button>` : _LAY_SPACER);

/**
 * 패딩 슬롯 — 작은 라벨 «Padding». 꼴 넷(id 는 다 부르는 쪽이 준다 · 새 저장 키 0):
 *   · 좌우 ↔ + 상하 ↕ 두 칸({ xId, yId }) · 좌우만({ xId } — y 칸 없음)
 *   · 네 면 한 값 한 칸({ allId, all })
 *   · 왼·오 두 칸({ lId, rId, l, r } · 라벨 L/R) + 블럭의 옛 사슬({ chainId, chainOn, chainWhy }) 그대로
 *   축마다 범위 = xMin/xMax · yMin/yMax(없으면 min/max) — 배선(wireLayoutSection)에도 축마다 그 수를 넘긴다.
 */
export function layoutPadSlotHTML({ xId, yId, allId, lId, rId, x, y, all, l, r, min = 0, max, xMin, xMax, yMin, yMax, mixed = false, chainId, chainOn = false, chainWhy = '좌우 같이' }) {
  const X = { min: xMin ?? min, max: xMax ?? max, mixed }, Y = { min: yMin ?? min, max: yMax ?? max, mixed };
  let cells, kind;
  if (allId) { kind = 'pad-all'; cells = _layCell('Padding', 'layout-pad-all', LAY_ALL_ICON, { id: allId, value: all, min, max, mixed }) + _layEmpty + _LAY_SPACER; }
  else if (lId || rId) { kind = 'pad-lr'; cells = _layCell('L', 'layout-pad-l', LAY_PX_ICON, { id: lId, value: l, ...X }) + _layCell('R', 'layout-pad-r', LAY_PX_ICON, { id: rId, value: r, ...X }) + _layOwnChain(chainId, chainOn, chainWhy); }
  else { kind = 'pad'; cells = _layCell('Padding', 'layout-pad-x', LAY_PX_ICON, { id: xId, value: x, ...X }) + (yId ? _layCell('', 'layout-pad-y', LAY_PY_ICON, { id: yId, value: y, ...Y }) : _layEmpty) + _LAY_SPACER; }
  return `
      <div class="ui-layout ui-lay-slot" data-part="layout" data-slot="${kind}">
        <div class="ui-s2-main prop-row">${cells}</div>
      </div>`;
}

/** 간격 슬롯 — 한 칸({ id, value }) 또는 가로 ↔ / 세로 ↕ 두 칸({ xId, yId, x, y } — 열·줄 간격) · 작은 라벨 = label(기본 «Gap») */
export function layoutGapSlotHTML({ id, value, xId, yId, x, y, label = 'Gap', min = 0, max, xMin, xMax, yMin, yMax, mixed = false }) {
  const two = !!(xId || yId);
  const cells = two
    ? (xId ? _layCell(label, 'layout-gap-x', LAY_GAP_ICON, { id: xId, value: x, min: xMin ?? min, max: xMax ?? max, mixed }) : _layEmpty)
      + (yId ? _layCell(xId ? '' : label, 'layout-gap-y', LAY_GAPY_ICON, { id: yId, value: y, min: yMin ?? min, max: yMax ?? max, mixed }) : _layEmpty)
    : _layCell(label, 'layout-gap', LAY_GAP_ICON, { id, value, min, max, mixed }) + _layEmpty;
  return `
      <div class="ui-layout ui-lay-slot" data-part="layout" data-slot="${two ? 'gap-xy' : 'gap'}">
        <div class="ui-s2-main prop-row">${cells}${_LAY_SPACER}</div>
      </div>`;
}

/** 블럭 슬롯 숫자 한 줄(Layout 안 · 격자 간격·치수 등) — 이름 + [중립 아이콘(끌기) 숫자] · 끝 단추 없음 · 배선 = wireLayoutSection({ w: { numberId: id, … } }) */
export function layoutSlotNumberHTML({ id, label, value, min = 0, max, step = 1, mixed = false }) {
  return `
      <div class="prop-row ui-lay-slot-num" data-part="layout" data-slot="number">
        <span class="prop-label">${label}</span>
        <div class="prop-icon-input" data-part="number" data-field="layout-slot"><span class="prop-xy-label ui-app-scrub" id="${id}-scrub" title="${label} — 좌우로 끌면 바뀐다">${LAY_NUM_ICON}</span><input type="number" class="prop-number" id="${id}" min="${min}" max="${max}" step="${step}" value="${mixed ? '' : value}"${mixed ? ' placeholder="Mixed" data-empty="invalid"' : ''} aria-label="${label}"></div>
      </div>`;
}

/**
 * 배선 — 축마다 { numberId, min?, max, step?, apply(v), read?() } · chain { id, on, set(on), blocked?() → 까닭|null } · commit?()
 *   chain.blocked = 지금 막혔나(예: 너비 = 줄 폭) — 편집 «시작» 때 재서 막혔으면 짝 축이 안 따라간다 · 저장 키는 안 쓴다.
 *   돌려주는 refresh() = 단추 상태를 다시 잰다(블럭 모양이 패널 밖에서 바뀐 뒤 — 핸들·프리셋).
 *   input = 범위 안이면 바로 그림(사슬 켬 → 짝 축도 비율대로) · change = 잘라 그림 + commit 한 번(짝 축 포함 = ⌘Z 한 칸)
 *   빈 칸 change = 편집 전 값으로 되돌림 · commit 0 · 라벨 끌기 = 같은 길(놓을 때 change 한 번)
 *   비율 = 편집 «시작» 때 블럭 값(read)으로 잰다 — 핸들·프리셋이 바꾼 모양도 따라간다.
 *   pad/gap/one 칸 하나도 이걸로(w 만 주면 된다).
 */
export function wireLayoutSection({ w, h, chain = null, commit } = {}) {
  const done = commit || (() => { window.pushHistory?.(); window.scheduleAutoSave?.(); });
  const axes = [w, h].filter(Boolean).map((a) => ({ ...a, min: a.min ?? 0, n: document.getElementById(a.numberId) })).filter((a) => a.n);
  let on = !!chain?.on, start = null, stopped = false;
  const val = (a) => (a.read ? a.read() : parseFloat(a.n.value));
  const lim = (a, v) => Math.min(a.max, Math.max(a.min, v));   // 축마다 제 범위(패딩 x/y 가 다를 수 있다)
  const num = (a, raw) => (a.step % 1 ? parseFloat(raw) : parseInt(raw, 10));   // 소수 눈금(step 0.1 등) 칸만 소수
  const blockedWhy = () => chain?.blocked?.() || null;
  const begin = () => { if (!start) { start = axes.map(val); stopped = !!blockedWhy(); } };
  const follow = (a, v) => {
    const i = axes.indexOf(a), o = axes[1 - i];
    if (!on || stopped || !o || o.n.disabled || !(start[i] > 0)) return;
    const ov = lim(o, Math.round(v * start[1 - i] / start[i]));
    o.apply(ov); o.n.value = ov;
  };
  for (const a of axes) {
    a.n.addEventListener('input', () => {
      begin();
      const v = num(a, a.n.value);
      if (!Number.isFinite(v) || v < a.min || v > a.max) return;   // 치는 중(범위 밖·빈 칸)은 안 그림 — change 가 자른다
      a.apply(v); follow(a, v);
    });
    a.n.addEventListener('change', () => {
      begin();
      const raw = num(a, a.n.value), s = start; start = null;
      if (!Number.isFinite(raw)) {   // 값 없음 = 아무 일도 없었다(되돌림 · 이력 0)
        axes.forEach((x, i) => { if (val(x) !== s[i]) x.apply(s[i]); x.n.value = s[i]; });
        return;
      }
      const v = lim(a, raw);
      a.apply(v); a.n.value = v; start = s; follow(a, v); start = null;
      refresh(); done();
    });
    wireNumberScrub(document.getElementById(`${a.numberId}-scrub`), a.n, { min: a.min, max: a.max });
  }
  const btn = chain && document.getElementById(chain.id);
  function refresh() {
    if (!btn || !chain.blocked) return;
    const why = blockedWhy(), st = _layChainState(on, why);
    btn.setAttribute('aria-pressed', String(st.pressed)); btn.classList.toggle('active', st.pressed);
    if (why) btn.setAttribute('aria-disabled', 'true'); else btn.removeAttribute('aria-disabled');
    btn.title = st.title; btn.setAttribute('aria-label', st.title);
  }
  btn?.addEventListener('click', () => {
    if (btn.getAttribute('aria-disabled') === 'true') return;
    on = !on;
    btn.setAttribute('aria-pressed', String(on)); btn.classList.toggle('active', on);
    chain.set(on); done();
  });
  return { refresh };
}
