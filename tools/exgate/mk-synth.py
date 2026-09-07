#!/usr/bin/env python3
"""합성 표본 — 이식 검산(E4 pre)용. 실물 PNG 가 오기 «전»에 비교기 자체를 조인다."""
import sys, os, random
import numpy as np
from PIL import Image, ImageDraw, ImageFont
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
random.seed(7); np.random.seed(7)

def save(name, a): Image.fromarray(a.astype('uint8'), 'RGB').save(os.path.join(out, name))

W, H = 260, 180
# 배경 + 「글자 비슷한」 잉크 밴드 3줄 (구조층이 실제로 밴드를 세게)
base = np.full((H, W, 3), 245, dtype=np.uint8)
for by in (20, 70, 120):
    base[by:by+18, 30:230] = 30
    base[by+4:by+6, 30:230] = 245           # 밴드 안쪽 구멍
save('a.png', base)

# ① 완전 동일
save('b_same.png', base)
# ② 1px 세로선 하나(가는 선 = 힌팅 계열) — blob 이 지워야 하는 것
b = base.copy(); b[10:170, 128] = [255, 0, 0]; save('b_line.png', b)
# ③ 20x20 면 — blob 이 남겨야 하는 것
b = base.copy(); b[80:100, 150:170] = [255, 0, 0]; save('b_blob.png', b)
# ④ 파랑만 255 (색상 축 — 이 검사가 «안 보는» 것)
b = base.copy(); b[40:60, 40:60] = [0, 0, 255]; base_blue = b; save('b_blue.png', b)
# ⑤ 밴드 하나 삭제 (bandCount 불일치)
b = base.copy(); b[120:138, :] = 245; save('b_bandmissing.png', b)
# ⑥ 크기 다름
Image.fromarray(base[:150], 'RGB').save(os.path.join(out, 'b_short.png'))
# ⑦ 잡음 — 격자/밴드/침식이 «복잡한» 입력에서도 맞나
b = base.copy().astype(np.int16)
b += np.random.randint(-90, 90, b.shape)
save('b_noise.png', np.clip(b, 0, 255))
# ⑧ 전면 잉크 0 (백지) 두 장 — struct N/A 경로
save('c_blank1.png', np.full((H, W, 3), 250, dtype=np.uint8))
w2 = np.full((H, W, 3), 250, dtype=np.uint8); w2[0,0] = [251,251,251]; save('c_blank2.png', w2)
# ⑨ 임계 경계 — L 이 정확히 40/41 이 되는 차이(반올림식이 다르면 여기서 갈린다)
for lvl in range(30, 52):
    b = base.copy(); b[95:99, 200:220] = np.clip(base[95:99, 200:220].astype(int) + lvl, 0, 255)
    save(f'b_th{lvl}.png', b)
print('made', len(os.listdir(out)))
