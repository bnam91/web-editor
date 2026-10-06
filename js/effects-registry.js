/* ═══════════════════════════════════════════════════════════════════════════
   EFFECTS REGISTRY — 효과 «명부» 한 벌 (2026-10-06 · 현빈 발주 · 지디 승인)
   ─────────────────────────────────────────────────────────────────────────────
   ★발주 원문 — 「텍스트 블럭 등 이펙트 섹션에 지금은 ＋만 눌리면 바로 리플렉션이 적용되는데,
     바로 적용되는 것이 아니라 여기에 쉐도우도 넣어주고 리플렉션도 들어갈 것임(계속 이펙트는 추가예정)」
   ★★합격 기준 = 효과를 «등록만 하면» 목록에 저절로 뜬다.
     ⇒ 그리개(fxSectionHtml) · 배선(wireFxSection) · 로드(watchAllFx) 가
       «전부 이 명부 하나»를 돈다. ⛔효과가 하나 늘 때 여러 자리를 손대야 하면 그 요구를 못 지킨 것이다.
     지키는 그물: tests/dom/effects-registry.dom.spec.js (가짜 효과를 등록해 목록에 뜨는지 단언)

   ★식구 한 벌(registerFxType 에 주는 것)
     { key, label, supports?(el), has(el), add(el), card(el,P), wire(el,P,again), watchAll?(root) }
       key        — 명부 안 이름(카드의 data-fx-type · 접힘 상태 키)
       label      — 목록에 뜨는 사람 글(⛔여기 글을 지어 박지 마라 — 식구 쪽에서 준다)
       supports   — 그 블럭에서 «고를 수 있나». 없으면 모든 블럭.
                    ★목록은 블럭마다 다를 수 있다: 텍스트엔 그림자 식구가 없다 —
                      텍스트는 「Shadow」 절이 Effects 절 «바로 위»에 이미 있다(prop-text-template.js).
       has        — 그 블럭에 «지금 걸려 있나»(걸린 것은 카드로, 안 걸린 것은 목록으로)
       add        — 고른 순간 붙이기(그 식구가 자기 기본값으로)
       card/wire  — 카드 HTML · 그 카드 배선(again() = 패널 다시 그리기)
       watchAll?  — 문서를 연 뒤 할 일(걸린 블럭을 감시에 올리기 등). ★돌려주는 수 = 올린 블럭 수.
                    ★「데이터 → 화면」을 로드 때 «다시 그려야 하는» 효과는 그 일도 여기서 한다.
                    ⛔안 쓰는 문(applyAll 류)을 미리 만들지 않았다 — 반사·그림자는 인라인 속성이라
                      저장본에 그대로 남고, 다시 그릴 필요가 없다(필요한 효과가 생기면 그 식구가 쥔다).

   ⛔이 파일은 아무것도 import 하지 않는다(여백 합은 js/frame-geometry.js 가 가진 것을 window 로 다시 깔지 않고
     쓰는 쪽이 직접 import 한다). 패널 셋(prop-text-template · prop-shape · prop-asset)은 window 다리로 부른다 —
     단위 하네스가 그 파일들을 «대역»으로 싣기 때문이다(PLUS_ICON_SVG 와 같은 까닭).
   ═══════════════════════════════════════════════════════════════════════════ */

const FX_REGISTRY = [];

/** ★효과 한 식구 등록 — 이것이 「계속 추가예정」의 «문» 하나다.
 *  같은 key 를 두 번 등록하면 뒤가 이긴다(시험이 가짜 식구를 넣고 빼는 길). */
export function registerFxType(t) {
  if (!t || !t.key) return FX_REGISTRY.length;
  const i = FX_REGISTRY.findIndex(x => x.key === t.key);
  if (i >= 0) FX_REGISTRY[i] = t; else FX_REGISTRY.push(t);
  return FX_REGISTRY.length;
}

/** 등록 취소 — ★시험이 가짜 식구를 치우는 길(제품 경로에선 안 쓴다). */
export function unregisterFxType(key) {
  const i = FX_REGISTRY.findIndex(x => x.key === key);
  if (i >= 0) FX_REGISTRY.splice(i, 1);
  return FX_REGISTRY.length;
}

/** 명부에 있는 효과 이름 전부 — ★시험이 «수»를 판에서 읽는 자리(⛔숫자를 박지 않게). */
export function fxTypeKeys() { return FX_REGISTRY.map(t => t.key); }

/** 그 블럭에서 «고를 수 있는» 식구들 — supports 가 가른다. */
export function fxTypesFor(el) {
  return FX_REGISTRY.filter(t => (typeof t.supports === 'function' ? !!t.supports(el) : true));
}

/* ── 카드 접힘(패널 «표시»만 · 데이터 아님) ──────────────────────── */
const _openCards = new WeakMap();   // el → { [key]: 펼침 } (기본 펼침)
export const fxIsCardOpen  = (el, k) => (_openCards.get(el) || {})[k] !== false;
export const fxSetCardOpen = (el, k, v) => _openCards.set(el, { ...(_openCards.get(el) || {}), [k]: v });

/* ── 절 그리기 ───────────────────────────────────────────────────── */
/** 「Effects」 절 — 걸린 효과는 카드로, 아직 없는 효과는 ＋ 로 더할 수 있다.
 *  ★U3: 효과 0개 = 절 머리 한 줄 — 추가할 길이 늘 있다.
 *  ★U4: 절은 효과 카드 «목록»을 담는다 — 종류가 늘면 카드가 늘 뿐이다. */
export function fxSectionHtml(el, prefix) {
  const P = prefix;
  const types = fxTypesFor(el);
  const present = types.filter(t => t.has(el));
  const canAdd = present.length < types.length;
  const add = canAdd
    ? `<button class="prop-icon-btn" id="${P}-fx-add" title="효과 추가 — 바닥 반사" aria-label="효과 추가" style="width:18px;height:18px;">${window.PLUS_ICON_SVG || ''}</button>` : '';
  return `
    <div class="prop-section" id="${P}-fx-section">
      <div class="prop-section-title-row" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <div class="prop-section-title" style="margin-bottom:0">Effects</div>${add}
      </div>${present.length ? `
      <div id="${P}-fx-list">${present.map(t => t.card(el, P)).join('')}
      </div>` : ''}
    </div>`;
}

/** 배선 — ＋ 와 «걸린 카드»들. 단추는 한 문(이력 한 걸음) 뒤 패널을 다시 그린다(rerender). */
export function wireFxSection(el, prefix, rerender) {
  const P = prefix;
  const types = fxTypesFor(el);
  const again = () => { try { rerender?.(); } catch (_) {} };
  document.getElementById(`${P}-fx-add`)?.addEventListener('click', () => {
    const t = types.find(x => !x.has(el)); if (!t) return;
    t.add(el); fxSetCardOpen(el, t.key, true); again();
  });
  for (const t of types) if (t.has(el)) t.wire(el, P, again);
}

/* ── 문서를 연 뒤 ────────────────────────────────────────────────── */
/** 문서를 연 뒤·붙여넣은 뒤 — 효과마다 자기 감시를 올린다. 돌려주는 수 = 올린 블럭 수의 합. */
export function watchAllFx(root = document) {
  let n = 0;
  for (const t of FX_REGISTRY) { try { n += t.watchAll?.(root) || 0; } catch (_) {} }
  return n;
}

if (typeof window !== 'undefined') {
  Object.assign(window, {
    registerFxType, unregisterFxType, fxTypeKeys, fxTypesFor,
    fxSectionHtml, wireFxSection, watchAllFx,
    fxIsCardOpen, fxSetCardOpen,
  });
  /* 문서가 열린 뒤 걸린 블럭을 감시에 올린다(로드는 캔버스를 통째로 갈아 끼운다 — 그 뒤 rebindAll 이 돈다).
     ★효과가 늘어도 이 자리는 그대로다 — watchAllFx 가 명부를 돈다. */
  window.addEventListener('load', () => { try { watchAllFx(document.getElementById('canvas') || document); } catch (_) {} });
}
