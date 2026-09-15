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
