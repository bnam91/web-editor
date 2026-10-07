/* ── Coupon 블록 프로퍼티 패널 — 쿠폰 모양 + ★고른 칸 하나 ────────────────────
   ★현빈 지시(2026-10-07): 「우측 패널은 ★캔버스에서 ★고른 칸만 열린다」
     ⛔다섯을 ★다 펼치지 않는다. 캔버스에서 글자를 누르면 ★그 칸이 열리고,
       ★같은 것을 또 누르면 ★닫힌다(시안 :1385 setSel 의 토글과 ★같은 꼴).
     ★아무 칸도 안 골랐으면 «칸 목록»만 보인다 — 어느 칸이 있는지는 보이고, ★펼쳐지지는 않는다.

   ★prop-modal.js 의 관례를 그대로 쓴다: colorFieldHTML/wireColorField · 슬라이더+숫자 «쌍» ·
     blockHeaderHTML · setRpIdBadge · ★dataset 에 쓰고 rerender() · pushHistory 는 ★push-after.
   ⛔슬롯 DOM 에 인라인으로 박지 마라 — renderCouponBlock 이 innerHTML 을 통째로 새로 만든다
     (prop-modal.js 의 그 경고와 ★같은 자리).

   ★min/max 는 ★리터럴로 쓰지 않는다 — coupon-block.js 의 COUPON_LIMITS 한 표에서 온다.
   ★칸 다섯의 이름·기본값도 ★COUPON_SLOTS 한 명부에서 온다. ⛔여기서 다시 적지 않는다.

   ★히스토리 — ⛔이 파일은 `update*Block` 이라는 이름을 ★안 부른다(그런 이름이 없다).
     값을 dataset 에 쓰고 renderCouponBlock 으로 다시 그린 ★뒤에 pushHistory 를 한 번 한다
     (push-after · prop-laurel.js:293 「★쓰기 «뒤»에」와 같은 까닭).
     ⇒ 한 제스처 = 한 칸. model-update-history 래퍼를 ★안 탄다.
*/
import { propPanel } from '../globals.js';
import { colorFieldHTML, wireColorField, parseAlphaFromColor } from './color-picker.js';
/* ★HTML 이스케이프는 ★정본 하나다 — ⛔제 사본을 만들지 마라
   (tests/unit/name-axes-to-markup X9 가 사본 수를 센다). */
import { blockHeaderHTML, escHtml as _esc } from './_helpers.js';
import {
  COUPON_SLOTS, COUPON_SLOT_KEYS, COUPON_DEFAULTS, COUPON_LIMITS, clampCoupon,
  _dsKey, _slotOf, _cpnBoxH, couponStubHasRoom,
} from '../blocks/coupon-block.js';

const L = COUPON_LIMITS;

/** 스와치가 보여 줄 hex — prop-modal._swatchHex 와 같은 규칙(변수·rgba 를 hex 로 풀어 보여 준다). */
function _swatchHex(v, dflt) {
  const s = String(v || '').trim();
  const m6 = s.match(/#([0-9a-fA-F]{6})\b/);
  if (m6) return '#' + m6[1].toLowerCase();
  const m3 = s.match(/#([0-9a-fA-F]{3})\b/);
  if (m3) return '#' + m3[1].toLowerCase().split('').map(ch => ch + ch).join('');
  const rgb = s.match(/rgba?\(([^)]+)\)/i);
  if (rgb) {
    const p = rgb[1].split(',').map(x => parseInt(x, 10));
    const to = n => Math.max(0, Math.min(255, n | 0)).toString(16).padStart(2, '0');
    return '#' + to(p[0]) + to(p[1]) + to(p[2]);
  }
  return dflt;
}

const _ICON = `          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <rect x="1" y="3" width="10" height="6" rx="1.2"/><path d="M8 3 V9" stroke-dasharray="1.4 1.2"/>
          </svg>`;

/** 슬라이더＋숫자 한 쌍. prop-modal 의 wireNum 과 같은 꼴. */
function _pairRow(id, label, val, min, max, step = 1) {
  return `
      <div class="prop-row">
        <span class="prop-label">${_esc(label)}</span>
        <input type="range" class="prop-slider" id="${id}-slider" min="${min}" max="${max}" step="${step}" value="${val}">
        <input type="number" class="prop-number" id="${id}-number" min="${min}" max="${max}" step="${step}" value="${val}">
      </div>`;
}

/* ══ 칸 목록 — ★어느 칸이 있는지만 보여 준다(펼치지 않는다) ════════════════════
   ★스텁 줄은 ★자리가 없으면 «회색»이다 — 관례는 prop-laurel/prop-banner02 의
     `opacity:0.4;pointer-events:none`(prop-zoom.js:41 이 그 관례를 적어 뒀다).
   ★까닭을 ★같이 적는다 — 「왜 못 쓰나」를 안 적으면 사용자는 ★버그로 읽는다.
     문구는 ★시안이 화면에 찍던 그 말이다(시안 stubNote). */
function _slotListHTML(block, openKey) {
  const stubRoom = couponStubHasRoom(block);
  const rows = COUPON_SLOTS.map(def => {
    const sl = _slotOf(block, def.key);
    const dead = (def.key === 'stub' && !stubRoom);
    const style = dead ? ' style="opacity:0.4;pointer-events:none"' : '';
    const sel = (def.key === openKey) ? ' style="font-weight:700"' : '';
    const preview = sl.isPh ? `<span style="opacity:.55">${_esc(def.ph)}</span>` : _esc(sl.txt);
    return `
      <div class="prop-row"${style}>
        <span class="prop-label"${sel}>${_esc(def.label)}</span>
        <label class="prop-check" style="margin-right:6px">
          <input type="checkbox" data-cpn-on="${def.key}"${sl.on ? ' checked' : ''}> 표시
        </label>
        <button class="prop-btn" data-cpn-open="${def.key}" title="이 칸만 열기">${def.key === openKey ? '닫기' : '열기'}</button>
        <span class="prop-hint" style="margin-left:6px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${preview}</span>
      </div>`;
  }).join('');
  const note = stubRoom ? '' : `
      <div class="prop-hint" style="padding:4px 8px;line-height:1.5">
        ⛔지금은 「스텁/머리 글자」가 <b>들어갈 자리가 없습니다</b> — 분할을 켜거나 절취선을 켜십시오.
        <span style="opacity:.7">(분할·절취선 조절은 2단계)</span>
      </div>`;
  return rows + note;
}

/* ══ 고른 칸 ★하나 ═══════════════════════════════════════════════════════════
   ⚠️크기 슬라이더는 ★저장본(dataset.slot*Size)을 움직인다. 화면에 보이는 크기는
     ★폭 비율이 곱해진 값이다(coupon-block.js `_cpnEffFontSize`) — 그래서 라벨에
     「모델 크기」라 적고 ★지금 화면 크기를 ★같이 보여 준다. 안 보여 주면 「슬라이더 46 인데
     화면은 23」이 ★버그로 읽힌다. */
function _slotPanelHTML(block, key) {
  const def = COUPON_SLOTS.find(s => s.key === key);
  if (!def) return '';
  const sl = _slotOf(block, key);
  const size = Number(block.dataset[_dsKey(key, 'Size')] ?? def.size);
  const eff = window.cpnEffFontSize
    ? window.cpnEffFontSize(block, key, clampCoupon(Number(block.dataset.width) || COUPON_DEFAULTS.width, L.width))
    : size;
  const raw = block.dataset[_dsKey(key, 'Text')] ?? '';
  return `
    <div class="prop-section">
      <div class="prop-section-title">${_esc(def.label)} — 이 칸만 열려 있습니다</div>
      <div class="prop-row">
        <span class="prop-label">글자</span>
        <input type="text" class="prop-input" id="cpn-slot-text" value="${_esc(raw)}" placeholder="${_esc(def.ph)}" style="flex:1">
      </div>
${_pairRow('cpn-slot-size', '모델 크기', size, 4, 150)}
      <div class="prop-hint" style="padding:2px 8px">지금 화면에서는 <b>${eff}px</b> 로 그려집니다 — 폭이 좁아지면 같은 비율로 줄어듭니다.</div>
      <div class="prop-row">
        <span class="prop-label">굵기</span>
        <select class="prop-select" id="cpn-slot-weight">
          ${[300, 400, 500, 600, 700, 800, 900].map(w => `<option value="${w}"${w === sl.weight ? ' selected' : ''}>${w}</option>`).join('')}
        </select>
      </div>
      <div class="prop-row">
        <span class="prop-label">색</span>
        ${colorFieldHTML({ idPrefix: 'cpn-slotcol', hex: _swatchHex(sl.color, def.color), alpha: parseAlphaFromColor(sl.color) })}
      </div>
      <div class="prop-row">
        <button class="prop-btn" id="cpn-slot-close">칸 닫기 — 목록으로</button>
      </div>
    </div>`;
}

/**
 * 쿠폰 패널을 그린다.
 * @param {HTMLElement} block
 * @param {string|null} [slotKey] ★캔버스에서 «고른 칸». 없으면 목록만(⛔다섯을 다 펼치지 않는다).
 *   ★같은 칸을 다시 주면 «토글»로 닫힌다 — 시안 setSel 과 같은 꼴.
 */
export function showCouponProperties(block, slotKey) {
  if (!block) return;
  /* ★어느 칸이 열려 있나를 «블럭에» 기억한다 — 이 함수는 여러 경로에서 다시 불린다
     (선택·레이어 패널·값 커밋 뒤 재호출). 기억을 안 하면 값 하나 바꿀 때마다 칸이 닫힌다.
     선례 = prop-laurel.js:142 `block._laurelCellExpanded`. */
  if (slotKey !== undefined) {
    const next = COUPON_SLOT_KEYS.includes(slotKey) ? slotKey : null;
    block._cpnOpenSlot = (block._cpnOpenSlot === next) ? null : next;
  }
  /* ★자리가 사라진 칸은 ★닫는다 — 분할을 끄면 스텁 칸이 «없는 칸»이 된다. */
  if (block._cpnOpenSlot === 'stub' && !couponStubHasRoom(block)) block._cpnOpenSlot = null;
  const openKey = COUPON_SLOT_KEYS.includes(block._cpnOpenSlot) ? block._cpnOpenSlot : null;

  const width = clampCoupon(Number(block.dataset.width) || COUPON_DEFAULTS.width, L.width);
  const radius = clampCoupon(Number(block.dataset.radius) ?? COUPON_DEFAULTS.radius, L.radius);
  const bodyCol = block.dataset.bodyCol || COUPON_DEFAULTS.bodyCol;
  const stubCol = block.dataset.stubCol || COUPON_DEFAULTS.stubCol;
  const boxH = _cpnBoxH(block, width);

  propPanel.innerHTML = `
    <div class="prop-section">
${blockHeaderHTML({
    icon: _ICON,
    name: block.dataset.layerName,
    defaultName: 'Coupon',
    crumb: window.getBlockBreadcrumb ? window.getBlockBreadcrumb(block) : '',
    id: block.id,
  })}
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Coupon</div>
${_pairRow('cpn-width', '폭', width, L.width.min, L.width.max)}
      <div class="prop-hint" style="padding:2px 8px">높이는 <b>${boxH}px</b> — 비율 16:9 를 블럭이 스스로 지킵니다. <span style="opacity:.7">(비율 고르기는 2단계)</span></div>
${_pairRow('cpn-radius', '모서리', radius, L.radius.min, L.radius.max)}
      <div class="prop-row">
        <span class="prop-label">본체색</span>
        ${colorFieldHTML({ idPrefix: 'cpn-body', hex: _swatchHex(bodyCol, COUPON_DEFAULTS.bodyCol), alpha: parseAlphaFromColor(bodyCol) })}
      </div>
      <div class="prop-row">
        <span class="prop-label">스텁색</span>
        ${colorFieldHTML({ idPrefix: 'cpn-stub', hex: _swatchHex(stubCol, COUPON_DEFAULTS.stubCol), alpha: parseAlphaFromColor(stubCol) })}
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">글자 칸 ${COUPON_SLOTS.length}</div>
      <div class="prop-hint" style="padding:2px 8px;line-height:1.5">★캔버스에서 글자를 누르면 <b>그 칸만</b> 열립니다. 지금은 ${openKey ? `<b>${_esc(openKey)}</b> 칸이 열려 있습니다.` : '아무 칸도 펼치지 않은 상태입니다.'}</div>
${_slotListHTML(block, openKey)}
    </div>
${openKey ? _slotPanelHTML(block, openKey) : ''}`;

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);

  const rerender = () => window.renderCouponBlock?.(block);
  /* ★push-after — 쓰고 그린 «뒤»에 한 번. ⛔쓰기 «전»에 부르지 마라(prop-laurel.js:293). */
  const commit = () => { window.pushHistory?.(); window.scheduleAutoSave?.(); };
  const reopen = () => showCouponProperties(block);   // ⛔slotKey 를 안 넘긴다 — 토글이 또 돌면 칸이 닫힌다

  // ── 슬라이더 + 숫자 «쌍» ──
  const wireNum = (id, key, min, max, after) => {
    const s = document.getElementById(`${id}-slider`);
    const n = document.getElementById(`${id}-number`);
    if (!s || !n) return;
    const apply = (val) => {
      const x = Math.min(max, Math.max(min, Number.isFinite(val) ? val : min));
      block.dataset[key] = String(x);
      rerender();
      s.value = x; n.value = x;
      after?.();
    };
    s.addEventListener('input', () => apply(parseInt(s.value, 10)));
    s.addEventListener('change', commit);
    n.addEventListener('change', () => { apply(parseInt(n.value, 10)); commit(); });
  };
  /* ★폭이 바뀌면 ★높이 안내와 ★「지금 화면 크기」가 같이 바뀐다 ⇒ 패널을 다시 그린다.
     ⛔슬라이더 input 마다 다시 그리면 손잡이가 손에서 떨어진다 ⇒ change(손을 뗄 때)에만. */
  wireNum('cpn-width', 'width', L.width.min, L.width.max);
  document.getElementById('cpn-width-slider')?.addEventListener('change', reopen);
  wireNum('cpn-radius', 'radius', L.radius.min, L.radius.max);

  // ── 색 (raw input[type=color] 금지 — 공용 컴포넌트) ──
  const wireColor = (prefix, key) => {
    if (!document.getElementById(`${prefix}-color`)) return;
    wireColorField(prefix, {
      initialAlpha: parseAlphaFromColor(block.dataset[key] || ''),
      onApply: (c) => { block.dataset[key] = c; rerender(); },
      onCommit: commit,
    });
  };
  wireColor('cpn-body', 'bodyCol');
  wireColor('cpn-stub', 'stubCol');

  // ── 칸 목록: 켜기/끄기 · 열기/닫기 ──
  propPanel.querySelectorAll('[data-cpn-on]').forEach(cb => cb.addEventListener('change', () => {
    const k = cb.getAttribute('data-cpn-on');
    block.dataset[_dsKey(k, 'On')] = cb.checked ? '1' : '0';
    rerender();
    commit();
    reopen();
  }));
  propPanel.querySelectorAll('[data-cpn-open]').forEach(btn => btn.addEventListener('click', () => {
    showCouponProperties(block, btn.getAttribute('data-cpn-open'));
  }));
  document.getElementById('cpn-slot-close')?.addEventListener('click', () => {
    block._cpnOpenSlot = null;
    showCouponProperties(block);
  });

  // ── 고른 칸 하나 ──
  if (openKey) {
    const t = document.getElementById('cpn-slot-text');
    t?.addEventListener('change', () => {
      if (window.commitCouponSlot?.(block, openKey, t.value)) { rerender(); commit(); reopen(); }
    });
    wireNum('cpn-slot-size', _dsKey(openKey, 'Size'), 4, 150);
    document.getElementById('cpn-slot-size-slider')?.addEventListener('change', reopen);
    document.getElementById('cpn-slot-weight')?.addEventListener('change', (e) => {
      block.dataset[_dsKey(openKey, 'Weight')] = String(e.target.value);
      rerender(); commit();
    });
    wireColor('cpn-slotcol', _dsKey(openKey, 'Color'));
  }
}

window.showCouponProperties = showCouponProperties;
