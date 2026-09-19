// capture-safety.js — html2canvas로 캡처하는 클론에서 프라이버시 안전장치를 건다.
//
// .shape-redact(가림막)는 backdrop-filter로 밑에 깔린 콘텐츠를 흐리는데,
// html2canvas는 backdrop-filter를 지원하지 않아 배경이 근투명(rgba(255,255,255,0.001))
// 그대로 그려져 가려야 할 원본이 «그대로 노출»된다(2026-09-15 실측 확인:
// captureThumbnail·prop-mockup._captureAndApply 둘 다 재현).
//
// ⚠️ CDP 네이티브 캡처(export-image.js captureSectionCdp)는 실제 브라우저 합성을
// 그대로 스크린샷하므로 backdrop-filter가 정상 렌더링된다 — 이 함수는 «html2canvas
// 경로에서만» 호출해야 한다. 네이티브 경로의 clone에 걸면 정상 블러까지 망가진다.
import { parseGradient } from '../props/gradient-model.js';

const REDACT_OPAQUE_FILL = '#4a4a4a';

export function neutralizeRedactForH2C(root) {
  if (!root) return;
  const targets = [
    ...(root.classList?.contains('shape-redact') ? [root] : []),
    ...root.querySelectorAll('.shape-redact'),
  ];
  for (const el of targets) {
    // backdrop-filter를 안전 실패(fail-safe)로 대체: html2canvas가 못 그리든 말든
    // 이 영역은 항상 불투명한 색으로 채워져 원본이 절대 비치지 않는다.
    el.style.backdropFilter = 'none';
    el.style.webkitBackdropFilter = 'none';
    el.style.background = REDACT_OPAQUE_FILL;
    el.style.backgroundColor = REDACT_OPAQUE_FILL;
  }
}

/* 0918r2 textgrad — 글자 그라데이션(background-clip:text)의 html2canvas 대체.
 * 동봉 html2canvas 1.4.1 은 background-clip 을 border/padding/content 만 읽는다 → text 는 모른다.
 * 그대로 두면 «글자 박스 전체에 그라데이션 사각형 + 투명 글자»가 찍힌다(글자가 사라지고 네모가 생긴다).
 * ⇒ 정직한 대체: 그라데이션을 걷고 첫 스탑 단색으로 글자를 칠한다.
 *   ★인라인 color 는 «마지막 단색» 저장소라 첫 스탑이 아니다 — 여기서 bg-image 를 파싱해 계산한다.
 * ⚠️ native(CDP) 경로에선 부르지 말 것 — 브라우저가 그라데이션 글자를 제대로 그린다. */
function _firstStopHex(css) {
  const m = parseGradient(css);
  if (!m || !Array.isArray(m.stops) || !m.stops.length) return null;
  const c = String([...m.stops].sort((a, b) => a.offset - b.offset)[0].color || '').trim();
  const r = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (r) return '#' + [r[1], r[2], r[3]].map(n => Math.max(0, Math.min(255, +n)).toString(16).padStart(2, '0')).join('');
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(c)) return '#' + c.slice(1).split('').map(x => x + x).join('').toLowerCase();
  return null;
}

export function neutralizeTextGradForH2C(root) {
  if (!root) return 0;
  const sel = '[style*="background-clip: text"], [style*="background-clip:text"]';
  const targets = [
    ...(root.matches?.(sel) ? [root] : []),
    ...root.querySelectorAll(sel),
  ];
  let n = 0;
  for (const el of targets) {
    const st = el.style;
    const clip = (st.getPropertyValue('background-clip') || '') + ' ' + (st.getPropertyValue('-webkit-background-clip') || '');
    if (!/\btext\b/.test(clip)) continue;
    const fb = _firstStopHex(st.backgroundImage || '');
    st.removeProperty('background-image');
    st.removeProperty('background-clip');
    st.removeProperty('-webkit-background-clip');
    st.removeProperty('-webkit-text-fill-color');
    if (fb) st.setProperty('color', fb);
    n++;
  }
  // 0919r3 textshadow: html2canvas 는 filter 를 못 그린다 — 단색 대체 위 그림자는 순서 문제가 없으니
  //   .tgs(drop-shadow 파생)를 걷어 원래 text-shadow 를 되살린다.
  const tgs = [...(root.matches?.('.tgs') ? [root] : []), ...root.querySelectorAll('.tgs')];
  for (const el of tgs) {
    el.classList.remove('tgs');
    el.style.removeProperty('--tgs-src');
    el.style.removeProperty('--tgs-filter');
  }
  return n;
}
