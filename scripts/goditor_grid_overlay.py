#!/usr/bin/env python3
"""
goditor_grid_overlay.py
-----------------------
이미지에 20열 그리드를 오버레이하여 저장한다.
플래너가 이 이미지를 분석해 정확한 좌표를 읽는다.

사용법:
  python3 goditor_grid_overlay.py <이미지경로> [--cols 20] [--out /tmp/grid_output.jpg]

출력:
  /tmp/goditor_grid_{파일명}.jpg  (--out 미지정 시)
"""

import sys
import os
import math
import argparse
from PIL import Image, ImageDraw, ImageFont

CANVAS_W = 860  # Goditor 캔버스 기준 너비

def make_grid_overlay(img_path: str, cols: int = 20, out_path: str = None) -> str:
    img = Image.open(img_path).convert("RGBA")
    orig_w, orig_h = img.size

    # 860px 기준으로 스케일
    scale = CANVAS_W / orig_w
    target_w = CANVAS_W
    target_h = round(orig_h * scale)
    img = img.resize((target_w, target_h), Image.LANCZOS)

    col_w = target_w / cols                      # 열 너비 (px)
    row_h = col_w                                # 정사각형 셀
    rows = math.ceil(target_h / row_h)           # 행 수 자동 계산

    # 그리드 레이어 (반투명)
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    grid_color   = (255, 80, 80, 110)   # 붉은 반투명선
    label_color  = (255, 60, 60, 220)   # 라벨 색

    # 열 라벨: A-T (20열), 그 이상은 AA, AB ...
    def col_label(i: int) -> str:
        if i < 26:
            return chr(ord('A') + i)
        return chr(ord('A') + i // 26 - 1) + chr(ord('A') + i % 26)

    # 폰트 (시스템 기본 폰트 fallback)
    font_size = max(10, int(col_w * 0.45))
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
        font_small = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", max(8, font_size - 2))
    except Exception:
        font = ImageFont.load_default()
        font_small = font

    # 세로선 + 열 라벨
    for i in range(cols + 1):
        x = round(i * col_w)
        draw.line([(x, 0), (x, target_h)], fill=grid_color, width=1)
        if i < cols:
            label = col_label(i)
            cx = round(i * col_w + col_w / 2)
            draw.text((cx - font_size // 2, 3), label, fill=label_color, font=font)

    # 가로선 + 행 라벨
    for j in range(rows + 1):
        y = round(j * row_h)
        draw.line([(0, y), (target_w, y)], fill=grid_color, width=1)
        if j < rows:
            label = str(j + 1)
            draw.text((3, round(j * row_h + row_h / 2) - font_size // 2), label, fill=label_color, font=font_small)

    # 합성
    result = Image.alpha_composite(img, overlay).convert("RGB")

    # 출력 경로
    if out_path is None:
        basename = os.path.splitext(os.path.basename(img_path))[0]
        out_path = f"/tmp/goditor_grid_{basename}.jpg"

    result.save(out_path, "JPEG", quality=92)

    # 메타 출력 (플래너가 읽을 수 있도록)
    print(f"✅ 그리드 오버레이 완료")
    print(f"   출력: {out_path}")
    print(f"   캔버스: {target_w}×{target_h}px")
    print(f"   그리드: {cols}열 × {rows}행  (셀 {col_w:.1f}×{row_h:.1f}px)")
    print(f"   열 라벨: {col_label(0)} ~ {col_label(cols-1)}")
    print(f"   행 라벨: 1 ~ {rows}")
    print(f"   좌표 변환: col_w={col_w:.2f}px  row_h={row_h:.2f}px")
    print(f"   x = (열인덱스) × {col_w:.2f}   (A=0, B=1, ...)")
    print(f"   y = (행번호-1) × {row_h:.2f}")

    return out_path


def main():
    parser = argparse.ArgumentParser(description="Goditor 그리드 오버레이 생성")
    parser.add_argument("image", help="입력 이미지 경로")
    parser.add_argument("--cols", type=int, default=20, help="열 수 (기본 20)")
    parser.add_argument("--out", type=str, default=None, help="출력 파일 경로")
    args = parser.parse_args()

    if not os.path.exists(args.image):
        print(f"❌ 파일 없음: {args.image}", file=sys.stderr)
        sys.exit(1)

    make_grid_overlay(args.image, cols=args.cols, out_path=args.out)


if __name__ == "__main__":
    main()
