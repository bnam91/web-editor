/* text-style-code-field — 형광펜·점·밑줄 «스타일 번호» 칸 (1012t1E5 · 2026-10-13)
 *
 * 현빈 원문: 「최근 스타일을 하나씩 말고 파티클의 무늬번호처럼 혹은 컬러 코드를 입력할 수 있잖아?
 *   이것처럼 스타일 번호를 복사해서 붙여넣기 하는식으로」
 *
 * ★이 파일은 «부르는 길»만 있다 — 번호를 짓고 읽는 것은 text-style-code.js(코덱) 하나다.
 *   ⛔여기서 번호 꼴을 새로 짓거나 읽지 않는다(둘째 코덱이 된다).
 * ★칸 꼴 = 파티클 무늬번호 행(prop-row + prop-label + 늘어나는 칸 + prop-icon-btn).
 *   칸 클래스는 prop-text — prop-color-hex 의 대문자 변환은 체크섬 글자를 바꿔 보여 준다.
 * ★상호작용 = 색 hex 칸과 같은 wireHexText(Enter = change 확정 · 무효 = 되돌림 · 빈 칸 Enter = 복원).
 * ★입히기 = 최근 칩과 같은 onPick(_applyRecentStyle) — 켜기 → 입히기 · 히스토리 1칸 · 패널 다시 그리기가 한 길.
 * ★버전 1 = hl·dot·ul 만(TS_CODE_V1_KINDS). glow 는 버전 2 결정 대기 · grad 는 vars 0 이라 번호가 없다.
 * ★빈 조각(끈 번호)은 TS_EMPTY_MEANS 가 'UNDECIDED' 인 동안 거절하고 알린다(코덱 tsApplyPlan 주석 「멈춰야 한다」).
 *
 * ⚠️순환 import — text-style-kinds.js 가 prop-text-wireup-text-edit.js 를 가져오고 그 파일이 이 파일을 가져온다.
 *   ⇒ 모듈 최상위에서 명부를 읽지 않는다(함수 안에서만).
 */
import { TS_CODE_V1_KINDS, tsEncodeOne, tsApplyPlan } from './text-style-code.js';
import { TEXT_STYLE_KINDS, textStyleKind, captureTextStyle } from './text-style-kinds.js';
import { wireHexText } from './color-picker.js';

export const tsCodeRowId = (p, k) => `${p}-${k}-code-row`;
export const tsCodeInputId = (p, k) => `${p}-${k}-code`;
export const tsCodeCopyId = (p, k) => `${p}-${k}-code-copy`;

const _label = (k) => (textStyleKind(k) || {}).label || k;

/** 지금 블럭의 그 kind 번호. 꺼져 있으면 '' (끈 번호는 만들지 않는다). */
export function tsCodeOf(k, tb, contentEl) {
  if (!TS_CODE_V1_KINDS.includes(k)) return '';
  const v = captureTextStyle(k, tb, contentEl);
  if (!v) return '';
  return tsEncodeOne(TEXT_STYLE_KINDS, k, v) || '';
}

/**
 * 붙여넣은 글자를 이 칸(k)에 입힐 수 있나.
 * @returns {{empty:true}|{ok:true, code:string, v:Object}|{ok:false, why:string}}
 */
export function tsCodeCheck(k, raw) {
  const code = String(raw == null ? '' : raw).trim();
  if (!code) return { empty: true };
  const lb = _label(k);
  /* ★이 칸의 kind 가 버전 1 인가(glow·grad 칸은 없지만 두 번 잠근다) — 받은 kind 는 아래에서 이 k 와 같아야 한다. */
  if (!TS_CODE_V1_KINDS.includes(k)) return { ok: false, why: `${lb} 칸은 번호를 받지 않는다` };
  const plan = tsApplyPlan(TEXT_STYLE_KINDS, code);
  if (!plan.ok) return { ok: false, why: plan.why };
  const ks = [...Object.keys(plan.set), ...plan.empty];
  if (ks.length !== 1) return { ok: false, why: `복합 번호다 — 이 칸은 ${lb} 번호만 받는다` };
  if (ks[0] !== k) return { ok: false, why: `${_label(ks[0])} 번호다 — ${lb} 칸이 아니다` };
  if (plan.empty.length) {
    if (plan.emptyMeans === 'UNDECIDED') return { ok: false, why: `빈(끈) ${lb} 번호다 — 뜻 미정이라 아무것도 안 바꿨다` };
    return { ok: false, why: `빈(끈) ${lb} 번호는 이 판이 못 입힌다` };
  }
  return { ok: true, code, v: plan.set[k] };
}

async function _writeClipboard(text) {
  if (window.electronAPI?.clipboardWriteText) {
    const r = await window.electronAPI.clipboardWriteText(text);
    if (!r?.ok) throw new Error(r?.error || 'IPC 실패');
  } else if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
  } else {
    throw new Error('클립보드 API 없음');
  }
}

/**
 * 패널의 번호 칸 셋(hl·dot·ul)을 배선한다.
 * @param {object} o
 *  - p:         id 머리(텍스트 패널 = 'txt')
 *  - tb:        .text-block (변수의 정본)
 *  - contentEl: 글자칸 (켜짐 판정)
 *  - onPick:    (kind, v) => void — 최근 칩과 같은 입히기 함수
 */
export function wireTextStyleCodeFields({ p = 'txt', tb, contentEl, onPick } = {}) {
  const out = [];
  for (const k of TS_CODE_V1_KINDS) {
    const input = document.getElementById(tsCodeInputId(p, k));
    if (!input) continue;
    const lb = _label(k);
    const cur = () => tsCodeOf(k, tb, contentEl);
    input.value = cur();

    /* ★wireHexText 보다 «먼저» 단다 — 무효면 그쪽이 칸을 되돌리기 전에 원문으로 까닭을 알린다. */
    const warn = () => {
      const r = tsCodeCheck(k, input.value);
      if (r.ok || r.empty) return;
      window.showToast?.('⚠️ ' + r.why);
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) warn(); });
    input.addEventListener('change', warn);

    wireHexText(input, {
      parse: (raw) => { const r = tsCodeCheck(k, raw); return r.empty ? '' : (r.ok ? r.code : null); },
      format: (s) => s,
      getCurrent: cur,
      onApply: () => {},
      onCommit: (code) => {
        if (!code || code === cur()) return;          // 빈 칸 · 지금과 같은 번호 = 아무 일 없음
        const r = tsCodeCheck(k, code);
        if (r.ok) onPick?.(k, r.v);
      },
    });

    const copy = document.getElementById(tsCodeCopyId(p, k));
    copy?.addEventListener('click', async () => {
      const code = cur();
      if (!code) { window.showToast?.(`⚠️ ${lb}이(가) 꺼져 있어 번호가 없다`); return; }
      input.value = code;
      try {
        await _writeClipboard(code);
        window.showToast?.(`📋 ${lb} 번호 복사`);
      } catch (err) {
        window.showToast?.(`❌ ${lb} 번호 복사 실패: ${err.message}`);
      }
    });
    out.push(k);
  }
  return out;
}
