#!/bin/zsh
# make-gdt-icon.sh — .gdt 문서 아이콘 생성 (build/gdt-icon.icns · build/gdt-icon.ico)
#
# 앱 아이콘(build/icon-master-1024.png)의 4각 스파클 마크를 유지하되, 흰 문서 바탕 +
# 접힌 모서리로 «문서»로 읽히게 한다. 파인더에서 빈 문서로 보이면 만든 티가 안 난다.
#
# 필요 도구: ImageMagick(magick) · iconutil(macOS 기본)
# 재생성:   zsh build/make-gdt-icon.sh
set -e
cd "$(dirname "$0")"

OUT_PNG=gdt-icon-1024.png
S=1024

# 문서 형태 — 세로 페이지 + 우상단 접힘. 마크는 앱 아이콘과 같은 검정.
PAGE_X1=176; PAGE_Y1=64; PAGE_X2=848; PAGE_Y2=960
FOLD=168                                  # 접히는 모서리 한 변
CX=512; CY=560; R=210                     # 스파클 중심·반지름
K=$((R * 13 / 100))                        # 오목 제어점 거리(≈0.13R)

magick -size ${S}x${S} xc:none \
  -fill white -stroke '#D3D6DE' -strokewidth 6 \
  -draw "path 'M $((PAGE_X1+28)),${PAGE_Y1} L $((PAGE_X2-FOLD)),${PAGE_Y1} L ${PAGE_X2},$((PAGE_Y1+FOLD)) L ${PAGE_X2},$((PAGE_Y2-28)) Q ${PAGE_X2},${PAGE_Y2} $((PAGE_X2-28)),${PAGE_Y2} L $((PAGE_X1+28)),${PAGE_Y2} Q ${PAGE_X1},${PAGE_Y2} ${PAGE_X1},$((PAGE_Y2-28)) L ${PAGE_X1},$((PAGE_Y1+28)) Q ${PAGE_X1},${PAGE_Y1} $((PAGE_X1+28)),${PAGE_Y1} Z'" \
  -fill '#E7E9EF' -stroke '#D3D6DE' -strokewidth 6 \
  -draw "path 'M $((PAGE_X2-FOLD)),${PAGE_Y1} L ${PAGE_X2},$((PAGE_Y1+FOLD)) L $((PAGE_X2-FOLD)),$((PAGE_Y1+FOLD)) Z'" \
  -fill '#1C1C1E' -stroke none \
  -draw "path 'M ${CX},$((CY-R)) Q $((CX+K)),$((CY-K)) $((CX+R)),${CY} Q $((CX+K)),$((CY+K)) ${CX},$((CY+R)) Q $((CX-K)),$((CY+K)) $((CX-R)),${CY} Q $((CX-K)),$((CY-K)) ${CX},$((CY-R)) Z'" \
  "$OUT_PNG"
# ★글자 라벨은 넣지 않는다 — 16px에서 못 읽고, magick이 시스템 폰트를 못 찾으면
#   재생성 자체가 깨진다(실제로 `unable to read font`로 한 번 실패했다).

# ── .icns (macOS) ──
IS=gdt-icon.iconset
rm -rf "$IS"; mkdir -p "$IS"
for sz in 16 32 128 256 512; do
  magick "$OUT_PNG" -resize ${sz}x${sz}   "$IS/icon_${sz}x${sz}.png"
  magick "$OUT_PNG" -resize $((sz*2))x$((sz*2)) "$IS/icon_${sz}x${sz}@2x.png"
done
iconutil -c icns "$IS" -o gdt-icon.icns
rm -rf "$IS"

# ── .ico (Windows) — 탐색기가 쓰는 크기 전부 포함 ──
magick "$OUT_PNG" -define icon:auto-resize=256,128,64,48,32,16 gdt-icon.ico

echo "생성 완료:"
ls -l gdt-icon.icns gdt-icon.ico "$OUT_PNG"
