#!/usr/bin/env python3
"""임계 경계 + 색상축 전용 합성 — 반올림식이 다르면 여기서 «반드시» 갈린다."""
import sys, os
import numpy as np
from PIL import Image
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
W, H = 120, 90
def save(n, a): Image.fromarray(a.astype('uint8'), 'RGB').save(os.path.join(out, n))
base = np.full((H, W, 3), 128, dtype=np.uint8)
base[20:40, 10:110] = 60          # 잉크 밴드 하나
save('t_base.png', base)
# ⑴ 회색 증분 — 각 채널 동시 증가: L == 증분값. 39/40/41 이 경계다.
for lvl in range(36, 46):
    b = base.copy(); b[60:70, 20:60] = 128 + lvl; save(f't_gray{lvl}.png', b)
# ⑵ 파랑만 변화 — ΔB 만. L = (ΔB*7471+32768)>>16
for db in (100, 200, 255):
    b = base.copy(); b[60:70, 20:60, 2] = np.clip(128 + db, 0, 255); save(f't_blue{db}.png', b)
# ⑶ 초록만 — L 가중이 가장 큰 채널
for dg in (40, 68, 69, 70):
    b = base.copy(); b[60:70, 20:60, 1] = 128 + dg; save(f't_green{dg}.png', b)
# ⑷ 빨강만
for dr in (130, 134, 135, 140):
    b = base.copy(); b[60:70, 20:60, 0] = np.clip(128 + dr, 0, 255); save(f't_red{dr}.png', b)
# ⑸ 잉크 0 두 장(struct N/A)
save('n_blank1.png', np.full((H, W, 3), 250, dtype=np.uint8))
n2 = np.full((H, W, 3), 250, dtype=np.uint8); n2[0, 0] = 251; save('n_blank2.png', n2)
print('ok')
