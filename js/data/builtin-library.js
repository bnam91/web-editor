/* builtin-library.js — 앱 «내장 라이브러리» 명부(manifest) · 0.9.13 현빈 결정 261117(handoff/hyunbin-decisions-261117.md)
 *   파일 = assets/library/<dir>/<file> — 앱에 동봉(package.json build.files 가 assets/** 를 싣는다).
 *   읽기 = IPC assets:readBundled(가드 main/bundled-asset.js · assets/library/ 안 · 이미지 확장자만) → data URL → 에셋 블럭.
 *   묶음 칸: id · name · dir · w(넣을 때 폭 px · 없으면 그림 폭 · 섹션 안쪽 폭 상한) · source · license · note · items[{ file, name, w? }]
 *   ⚠️import 0 — 단위 검사(tests/unit/builtin-library.test.mjs)가 이 파일 하나만 복사해 싣는다.
 */
export const LIBRARY_ROOT = 'assets/library';

export const LIBRARY = [
  {
    id: 'qr-barcode', name: 'QR·바코드', dir: 'qr-barcode', w: 240,
    source: 't3-03(261113) — segno·python-barcode 로컬 생성 · 디코더 역판독 14/14 · 투명 배경',
    license: '자체 제작',
    note: 'QR = 소문의섬 유튜브 채널 URL 샘플 · EAN/UPC 번호는 더미(실제 상품엔 GS1 발급 번호만)',
    items: [
      { file: 'qr_square_black.png', name: 'QR 기본' },
      { file: 'qr_dots_black.png', name: 'QR 도트' },
      { file: 'qr_dots_green.png', name: 'QR 도트 초록' },
      { file: 'qr_rounded_navy.png', name: 'QR 둥근 남색' },
      { file: 'qr_square_brandred.png', name: 'QR 빨강' },
      { file: 'qr_rounded_logohole.png', name: 'QR 로고 자리' },
      { file: 'qr_handle_square.png', name: 'QR @핸들' },
      { file: 'bar_ean13.png', name: 'EAN-13', w: 300 },
      { file: 'bar_ean8.png', name: 'EAN-8', w: 240 },
      { file: 'bar_upca.png', name: 'UPC-A', w: 300 },
      { file: 'bar_code128.png', name: 'Code128', w: 400 },
      { file: 'bar_code39.png', name: 'Code39', w: 400 },
      { file: 'bar_itf.png', name: 'ITF-14', w: 420 },
    ],
  },
];
