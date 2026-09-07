#!/usr/bin/env python3
"""E2 양성대조 — 실제로 났던 사고를 «되살려» 검사가 그걸 잡는지 본다.
⛔음성 표본은 「오탐이 없다」만 증명한다. 「잡아낸다」는 이걸로만 증명된다.
사용: e2-mutate.py <M1|M2|...> apply|revert"""
import sys, re
P = 'js/io/export-image.js'
MUT = {
 # M1 — borderRadius 다중값 스케일 제거(e84de42 되돌리기): 카드 라벨 코너 흰 arc
 'M1': ("""            if (p === 'borderRadius' && /[\\d.]+px/.test(v)) {
      style[p] = v.replace(/([\\d.]+)px/g, (_m, n) => (parseFloat(n) * s) + 'px');
    }""".replace('            ','    '),
        "    /* [E2-M1 변이] */"),
 # M2 — banner02 자간 평탄화 누락(da1ef6d 되돌리기)
 'M2': ("        scaleSigned(el.style, ['letterSpacing']);\n      });\n      inner.style.width  = (parseFloat(inner.style.width)  * s) + 'px';\n      inner.style.height = (parseFloat(inner.style.height) * s) + 'px';\n      inner.style.transform = 'none';\n      bn.style.height = inner.style.height;",
        "        /* [E2-M2 변이] */\n      });\n      inner.style.width  = (parseFloat(inner.style.width)  * s) + 'px';\n      inner.style.height = (parseFloat(inner.style.height) * s) + 'px';\n      inner.style.transform = 'none';\n      bn.style.height = inner.style.height;"),
 # M3 — 이미지 대기 제거(콜드 캐시에서 export 가 «빈 그림»). export 가 먼저 도니 비대칭이 생긴다.
 'M3': ("async function _waitImagesReady(root, timeoutMs = 8000) {",
        "async function _waitImagesReady(root, timeoutMs = 8000) {\n  return false; /* [E2-M3 변이] */"),
 # M4 — export 전용 «아래 잘림»(③단계에서 40px 자른다) → 크기 불일치
 'M4': ("  renderComponentsInClone(clone);\n",
        "  renderComponentsInClone(clone);\n  { const _h = clone.offsetHeight - 40; clone.style.height = _h + 'px'; clone.style.overflow = 'hidden'; } /* [E2-M4 변이] */\n"),
 # M5 — 재렌더가 되붙인 편집용 마커를 «안» 벗긴다(QA BUG-2). ★지금은 공용 단계라 export·truth 둘 다 영향.
 'M5': ("  clone.querySelectorAll('.bn2-line-selected, .bn2-line-empty').forEach(_el =>\n    _el.classList.remove('bn2-line-selected', 'bn2-line-empty'));",
        "  /* [E2-M5 변이] */"),
 # M6 — box-shadow inset → border 변환 제거: html2canvas/CDP 가 inset 을 solid fill 로
 'M6': ("      inner.querySelectorAll('[style*=\"box-shadow\"]').forEach(el => {",
        "      inner.querySelectorAll('[style*=\"box-shadow\"]').forEach(el => { if (1) return; /* [E2-M6 변이] */"),
}
mid, act = sys.argv[1], sys.argv[2]
old, new = MUT[mid]
s = open(P).read()
if act == 'apply':
    if s.count(old) != 1:
        print('ANCHOR', s.count(old)); sys.exit(1)
    open(P,'w').write(s.replace(old, new, 1)); print('applied', mid)
else:
    if s.count(new) != 1:
        print('REVERT-ANCHOR', s.count(new)); sys.exit(1)
    open(P,'w').write(s.replace(new, old, 1)); print('reverted', mid)
