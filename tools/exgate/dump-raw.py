#!/usr/bin/env python3
"""PNG → 원시 RGBA .bin (E4 검산용).
★왜 원시로 넘기나: 앱은 캔버스 픽셀을 보고 python 은 PNG 를 본다. 디코더가 다르면
  «비교기 이식이 틀린 것»과 «디코드가 다른 것»이 구분이 안 된다. 같은 픽셀을 먹여
  비교기만 대조한다."""
import sys, struct
from PIL import Image
for p in sys.argv[1:]:
    im = Image.open(p).convert('RGBA')
    w, h = im.size
    with open(p + '.raw', 'wb') as f:
        f.write(struct.pack('<II', w, h))
        f.write(im.tobytes())
    print(p + '.raw', w, h)
