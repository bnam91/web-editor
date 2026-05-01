/* ══════════════════════════════════════
   BANNER PRESETS — 정적 등록
   각 프리셋은 외곽 frame-block 설정 + 자식 children 트리.
   향후 외부 JSON 동적 로드로 교체 시 이 파일만 갈아끼우면 됨.
══════════════════════════════════════ */

export const BANNER_PRESETS = {
  // ── 가로형 (외곽 freeLayout, inner stack) — Figma Frame 8 ──
  frame_8: {
    label: '가로 배너 (텍스트 + 이미지)',
    frame: {
      mode: 'freeLayout',
      width: 780, height: 260,
      bg: '#f3f4f6', radius: 20,
    },
    children: [
      {
        kind: 'frame',
        mode: 'stack',
        x: 36, y: 35,
        width: 358,
        bg: '#f5f5f5',
        children: [
          { kind: 'text', textType: 'label',   content: '라벨입니다.',     fontSize: 24, align: 'left' },
          { kind: 'gap',  height: 5 },
          { kind: 'text', textType: 'body',    content: '제목을 입력합니다.', fontSize: 42, color: '#000000', align: 'left' },
          { kind: 'gap',  height: 10 },
          { kind: 'text', textType: 'caption', content: '캡션이 입력됩니다.', fontSize: 16, color: '#000000', align: 'left' },
        ],
      },
      {
        kind: 'asset',
        x: 494, y: 5,
        width: 250, height: 250,
        // src 미지정 → 디자인 시스템의 기본 체커 패턴 placeholder 노출
      },
    ],
  },
};

export function listBannerPresets() {
  return Object.entries(BANNER_PRESETS).map(([key, p]) => ({ key, label: p.label }));
}

window.BANNER_PRESETS = BANNER_PRESETS;
window.listBannerPresets = listBannerPresets;
