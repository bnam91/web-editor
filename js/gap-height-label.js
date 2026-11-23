/* t13G-02 — 갭 블럭 높이 라벨(관리자만 · 현빈 261122 시안 승인 «딱 좋다 이대로»).
 *   갭 블럭 «하나»를 고르면 블럭 오른쪽에 «H N» 라벨(피그마 치수 라벨 꼴) → 누르면 그 자리 입력 → Enter 적용 · Esc 취소 · 바깥 누름(blur) = 적용.
 *   ★자리 = #ss-handles-overlay(고정층 · #canvas «밖») — 저장 창 밖이라 저장·내보내기·캡처에 안 실린다(js/io/editor-ui-roster.js 계약에 안 걸림).
 *     위치는 선택 오버레이(js/selection-overlay.js)와 같은 꼴: 캔버스 class 변화(MO) 로 깨고 rAF 가 화면 사각형을 좇는다(스크롤·배율 따라감).
 *   ★관리자 판정 = 앱의 문지기 그대로(window.animGifVisible(true, __admin.state()) — ADMIN 배지·서버 role · js/feature-flags.js). 새 판정 0.
 *   ★높이 바꾸기 = 우측 패널(js/props/prop-gap.js)과 같은 길: pushHistory 한 번(⌘Z 한 번에 되돌림) → height → markGapManual → scheduleAutoSave → 패널 다시 그림(값 같이).
 *   ⛔캔버스 리사이즈 손잡이는 없다(현빈: 지금처럼). */
import { GAP_MIN, GAP_MAX } from './blocks/gap-limits.js';

let _el = null, _gap = null, _raf = null, _editing = false;

const _isAdmin = () => !!window.animGifVisible?.(true, window.__admin?.state?.() ?? null);

function _target() {
  if (document.body.classList.contains('preview-mode') || !_isAdmin()) return null;
  const sel = document.querySelectorAll('#canvas .gap-block.selected');
  if (sel.length !== 1) return null;
  const g = sel[0];   // 실앱 클릭은 갭과 함께 그 섹션에도 .selected 를 단다 — 조상은 괜찮고 다른 블럭이 같이 골라지면(다중 선택) 안 띄운다
  return [...document.querySelectorAll('#canvas .selected')].every((e) => e === g || e.contains(g)) ? g : null;
}

function _ensure() {
  if (_el && _el.isConnected) return _el;
  const ov = document.getElementById('ss-handles-overlay');
  if (!ov) return null;
  _el = document.createElement('div');
  _el.className = 'gap-h-label';
  _el.setAttribute('role', 'button');
  _el.tabIndex = 0;
  _el.title = '갭 높이 — 눌러 값 입력';
  _el.innerHTML = '<b>H</b><input type="text" inputmode="numeric" aria-label="갭 높이(px)">';
  _el.addEventListener('pointerdown', (e) => e.stopPropagation());   // 라벨 누름이 캔버스 «빈 데 누름(선택 풀기)»으로 안 가게
  _el.addEventListener('click', () => { if (!_editing) _edit(); });
  _el.addEventListener('keydown', (e) => { if (!_editing && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); _edit(); } });
  ov.appendChild(_el);
  return _el;
}

function _place() {
  const r = _gap.getBoundingClientRect();
  _el.style.left = Math.round(r.right + 6) + 'px';
  _el.style.top = Math.round(r.top + r.height / 2) + 'px';
  if (!_editing) _el.dataset.h = String(Math.round(_gap.offsetHeight));
}

function _frame() {
  _raf = null;
  const g = _editing ? _gap : _target();
  if (!g) { if (_el) _el.remove(); _el = null; _gap = null; return; }
  _gap = g;
  if (!_ensure()) return;
  _place();
  _raf = requestAnimationFrame(_frame);
}
function _kick() { if (_raf == null) _raf = requestAnimationFrame(_frame); }

function _apply(v) {
  const g = _gap;
  if (!g || !Number.isFinite(v)) return;
  if (Math.round(v) === Math.round(g.offsetHeight)) return;   // 값을 안 바꿨으면 아무것도 안 함 — 옛 저장본의 상한 넘는 갭(예 2500)을 열고 Enter·바깥 누름만 해도 조용히 깎이지 않게
  const h = Math.min(GAP_MAX, Math.max(GAP_MIN, Math.round(v)));
  if (h === Math.round(g.offsetHeight)) return;
  window.pushHistory?.();
  g.style.height = h + 'px';
  window.markGapManual?.(g);   // 사람이 정한 높이 — 갭 감수가 되돌리지 않는다(패널과 같음)
  window.scheduleAutoSave?.();
  if (g.classList.contains('selected')) window.showGapProperties?.(g);   // 우측 패널 값 같이
  if (_el) _el.dataset.h = String(Math.round(g.offsetHeight));   // 라벨도 바로(다음 rAF 를 안 기다림)
}

function _edit() {
  const ip = _el.querySelector('input');
  _editing = true;
  ip.value = _el.dataset.h || '';
  _el.classList.add('is-editing');
  ip.focus(); ip.select();
  const done = (ok) => {
    ip.removeEventListener('keydown', key); ip.removeEventListener('blur', blur);
    _editing = false;
    if (_el) _el.classList.remove('is-editing');
    if (ok) _apply(parseFloat(ip.value));
    _kick();
  };
  const key = (e) => {
    e.stopPropagation();   // 입력 중 Backspace·⌘Z 등이 에디터 단축키(블럭 지우기·되돌리기)로 안 가게
    if (e.key === 'Enter') { e.preventDefault(); done(true); }
    else if (e.key === 'Escape') { e.preventDefault(); done(false); }
  };
  const blur = () => done(true);
  ip.addEventListener('keydown', key);
  ip.addEventListener('blur', blur);
}

export function initGapHeightLabel() {
  const canvas = document.getElementById('canvas');
  if (!canvas) return false;
  new MutationObserver(_kick).observe(canvas, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });
  _kick();
  return true;
}

initGapHeightLabel();
window.__gapHeightLabel = { get el() { return _el; }, kick: _kick };   // 계측·QA 진입점(제품 코드는 안 씀)
