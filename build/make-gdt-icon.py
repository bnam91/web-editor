#!/usr/bin/env python3
"""make-gdt-icon.py — .gdt 문서 아이콘 생성 (build/gdt-icon-1024.png · .icns · .ico)

★왜 zsh+magick 판을 갈아엎었나 (2026-08-08 현빈 지적: 「3D 느낌보다 일러스트 같다」)
  옛 판은 «전부 평면»이었다 — 바탕 단색 #1C1C1E, 별 순백 #F2F2F3, 그림자 없음.
  앱 아이콘(build/icon-master-1024.png)은 그렇지 않다. 실측하면:

      바탕   좌상 (52,52,55) → 우하 (15,15,18)    대각 선형 그라데이션
      별     중심 215 · 끝 169~172               가장자리로 갈수록 어두워지는 명암
      모서리 알파 0                               바깥 그림자는 OS 가 준다(굽지 않는다)

  ⇒ 그래서 앱은 «입체», 문서는 «스티커»로 읽혔다. 색만 맞추고 «빛»을 안 옮긴 탓이다.

★이 판의 원칙: 별을 «다시 그리지 않는다».
  앱 아이콘에서 실제 픽셀을 오려 쓴다. 베지어로 흉내내면 곡률·명암이 미묘하게 달라지고,
  두 아이콘이 나란히 놓이는 파인더에서 그 차이가 바로 보인다.
  ⇒ 마크가 바뀌면 이 스크립트를 다시 돌리는 것만으로 문서 아이콘이 따라온다.

필요: Pillow · iconutil(macOS) · magick(ico용)
재생성: python3 build/make-gdt-icon.py
"""
import os, subprocess, shutil, sys
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)

S = 1024
MASTER = 'icon-master-1024.png'
OUT    = 'gdt-icon-1024.png'

# ── 앱 아이콘 실측값 (위 주석 참고) ──
TOP_L  = (52, 52, 55)      # 좌상 — 밝은 쪽
BOT_R  = (15, 15, 18)      # 우하 — 어두운 쪽
FOLD_L = (92, 92, 96)      # 접힘면: 본체보다 «빛을 더 받는» 면
FOLD_D = (46, 46, 50)
EDGE   = (10, 10, 12, 255)

# 문서 형태
X1, Y1, X2, Y2 = 176, 64, 848, 960
FOLD = 168
RAD  = 28

def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))

def diagonal_gradient(size, c0, c1, wy=0.70, gamma=1.55):
    """좌상→우하. ★단순 45° 선형이 아니다 — 앱 아이콘 실측이 그렇지 않다.

    가로로 훑으면 50→34(Δ16), 세로로 훑으면 50→15(Δ35). **세로 낙차가 2배**고,
    중간이 완만하다 끝에서 급히 떨어지는 «곡선»이다(0.1→50 · 0.5→36 · 0.9→15).
    45° 선형으로 깔면 폭이 절반으로 줄어 다시 평면처럼 보인다(첫 판이 그랬다).
    ⇒ 세로 가중 0.70 + 감마 1.55 로 그 곡선을 흉내낸다."""
    w, h = size
    g = Image.new('RGB', (w, h))
    px = g.load()
    for y in range(h):
        fy = y / (h - 1)
        for x in range(w):
            t = (1 - wy) * (x / (w - 1)) + wy * fy
            px[x, y] = lerp(c0, c1, min(1.0, t ** gamma * 1.35))
    return g

def page_mask():
    """페이지 실루엣(우상단 잘림 + 둥근 모서리)."""
    m = Image.new('L', (S, S), 0)
    d = ImageDraw.Draw(m)
    d.polygon([(X1 + RAD, Y1), (X2 - FOLD, Y1), (X2, Y1 + FOLD),
               (X2, Y2 - RAD), (X2 - RAD, Y2), (X1 + RAD, Y2), (X1, Y2 - RAD), (X1, Y1 + RAD)], fill=255)
    for cx, cy in ((X1 + RAD, Y1 + RAD), (X1 + RAD, Y2 - RAD), (X2 - RAD, Y2 - RAD)):
        d.ellipse([cx - RAD, cy - RAD, cx + RAD, cy + RAD], fill=255)
    d.rectangle([X1, Y1 + RAD, X2, Y2 - RAD], fill=255)
    d.rectangle([X1 + RAD, Y1, X2 - FOLD, Y2], fill=255)
    d.polygon([(X2 - FOLD, Y1), (X2, Y1 + FOLD), (X2 - FOLD, Y1 + FOLD)], fill=255)
    d.rectangle([X2 - FOLD, Y1 + FOLD, X2, Y2 - RAD], fill=255)
    return m

def extract_mark():
    """앱 아이콘에서 «별 픽셀 그대로» 오려낸다 — 베지어로 다시 그리지 않는다."""
    src = Image.open(MASTER).convert('RGBA')
    px = src.load()
    w, h = src.size
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    op = out.load()
    box = [w, h, 0, 0]
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 128 and r > 110:                     # 밝은 마크만(바탕은 최대 55)
                op[x, y] = (r, g, b, 255)
                box[0] = min(box[0], x); box[1] = min(box[1], y)
                box[2] = max(box[2], x); box[3] = max(box[3], y)
    return out.crop((box[0], box[1], box[2] + 1, box[3] + 1))

def main():
    if not os.path.exists(MASTER):
        sys.exit(f'{MASTER} 가 없다 — 앱 아이콘 원본이 있어야 마크를 오려낸다')

    mask = page_mask()
    # ★그라데이션은 «페이지 범위»에 깐다. 캔버스 전체에 깔면 페이지가 가운데 구간만 써서
    #   명암 폭이 절반으로 줄고(실측: 앱 54→16 vs 문서 44→30) 다시 평면처럼 보인다.
    pw, ph = X2 - X1, Y2 - Y1
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    body = Image.new('RGB', (S, S), BOT_R)
    body.paste(diagonal_gradient((pw, ph), TOP_L, BOT_R), (X1, Y1))
    img.paste(body, (0, 0), mask)

    d = ImageDraw.Draw(img)
    # 접힘면 — 본체보다 밝게 «꺾인 면이 빛을 더 받는다». 평면 단색이면 종이가 아니라 스티커로 읽힌다.
    fold = diagonal_gradient((FOLD, FOLD), FOLD_L, FOLD_D)
    fm = Image.new('L', (FOLD, FOLD), 0)
    ImageDraw.Draw(fm).polygon([(0, 0), (FOLD, FOLD), (0, FOLD)], fill=255)
    img.paste(fold, (X2 - FOLD, Y1), fm)
    d.line([(X2 - FOLD, Y1), (X2, Y1 + FOLD)], fill=EDGE, width=5)

    # 외곽선 — 어두운 배경(다크모드 파인더)에서도 실루엣이 남게
    edge = mask.filter(ImageFilter.FIND_EDGES).point(lambda v: 255 if v > 40 else 0)
    img.paste(Image.new('RGBA', (S, S), EDGE), (0, 0), edge)

    # 마크 — 앱 아이콘 픽셀 그대로
    mark = extract_mark()
    mw = 430
    mark = mark.resize((mw, int(mark.height * mw / mark.width)), Image.LANCZOS)
    img.paste(mark, ((S - mark.width) // 2, 560 - mark.height // 2), mark)

    img.save(OUT)
    print(f'  {OUT} 생성')

    # ── .icns ──
    iset = 'gdt-icon.iconset'
    shutil.rmtree(iset, ignore_errors=True); os.makedirs(iset)
    for sz in (16, 32, 128, 256, 512):
        img.resize((sz, sz), Image.LANCZOS).save(f'{iset}/icon_{sz}x{sz}.png')
        img.resize((sz * 2, sz * 2), Image.LANCZOS).save(f'{iset}/icon_{sz}x{sz}@2x.png')
    subprocess.run(['iconutil', '-c', 'icns', iset, '-o', 'gdt-icon.icns'], check=True)
    shutil.rmtree(iset, ignore_errors=True)
    print('  gdt-icon.icns 생성')

    # ── .ico ── (Pillow 로 직접 — magick 의존을 하나 줄인다)
    img.save('gdt-icon.ico', sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print('  gdt-icon.ico 생성')

if __name__ == '__main__':
    main()
