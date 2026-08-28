#!/usr/bin/env python3
"""export PNG vs truth PNG — 릴리스 게이트용 판정기.

★왜 스킬의 pixdiff.py 로 안 끝내나(2026-08-28 실측):
  pixdiff 의 판정은 «TOTAL < 600» 하나다. 그런데 자가시험에서:
      30x30 빨강 블록을 통째로 얹어도 TOTAL 450 → 「✅ 사실상 일치」
  로 나온다. ⇒ «국소» 결함(코너 arc·그림자 클리핑·라운드 미스매치)이 임계에 안 걸린다.
  그게 하필 이번에 의심하는 계열이다(overflow-x: hidden→clip 전역 변경).
  ⇒ 전역 TOTAL 말고 «뭉침»을 같이 본다. 셀 하나에 몰리면 크기가 작아도 FAIL.

판정(둘 중 하나라도 걸리면 FAIL):
  ⑴ TOTAL  >= TOTAL_MAX      전역으로 어긋남(기하·크롭 계열)
  ⑵ 최대 셀 밀도 >= CELL_MAX  16x16 격자 한 칸에 몰림(국소 결함 계열)
  ⑶ 크기 불일치는 «그 자체로» FAIL — 리사이즈해서 덮지 않는다(잘림/여백 변화가 사라진다)

실행: arch -arm64 python3 export-compare.py <export.png> <truth.png> [--json]
"""
import sys, json
from PIL import Image, ImageChops

TH        = 40     # 서브픽셀 AA 무시 임계(픽셀 밝기차)
TOTAL_MAX = 600    # 전역 — 스킬 기존 기준 유지
CELL      = 16     # 국소 격자 한 변
CELL_MAX  = 60     # 한 칸(16x16=256px) 중 60개 이상 다르면 «뭉친 결함»
                   #   자가시험 근거: 12x12 국소 변형이 셀 밀도 ~100 으로 잡힌다.

def main():
    ep, tp = sys.argv[1], sys.argv[2]
    as_json = '--json' in sys.argv
    exp = Image.open(ep).convert('RGB')
    tru = Image.open(tp).convert('RGB')
    out = {'export': ep, 'truth': tp, 'expSize': list(exp.size), 'truthSize': list(tru.size),
           'sizeMismatch': exp.size != tru.size, 'total': 0, 'maxCell': 0, 'maxCellAt': None,
           'bands': [], 'verdict': 'PASS', 'reasons': []}
    if exp.size != tru.size:
        # ★리사이즈로 덮지 않는다 — 높이가 달라졌다는 건 «내보내기가 잘렸거나 여백이 늘었다»는 뜻이다.
        out['reasons'].append(f'크기 불일치 export{exp.size} vs truth{tru.size} — 잘림/여백 변화')
        out['verdict'] = 'FAIL'
        tru = tru.resize(exp.size, Image.LANCZOS)   # 아래 밴드 국소화는 계속 한다(어디가 밀렸는지 보려고)

    d = ImageChops.difference(exp, tru).convert('L')
    px = d.load(); W, H = d.size
    # 전역 — x 를 «전부» 센다(스킬은 2칸씩 건너뛴다. 국소 결함에서 절반을 잃는다)
    rows = [sum(1 for x in range(W) if px[x, y] > TH) for y in range(H)]
    out['total'] = sum(rows)

    # 국소 — 16x16 격자 밀도
    best = 0; bestAt = None
    for gy in range(0, H, CELL):
        for gx in range(0, W, CELL):
            c = 0
            for y in range(gy, min(gy + CELL, H)):
                for x in range(gx, min(gx + CELL, W)):
                    if px[x, y] > TH: c += 1
            if c > best: best, bestAt = c, (gx, gy)
    out['maxCell'] = best; out['maxCellAt'] = list(bestAt) if bestAt else None

    # 밴드 국소화(보고용)
    bands = []; inb = False; y0 = 0
    for y, c in enumerate(rows):
        if c > 6 and not inb: inb, y0 = True, y
        elif c <= 6 and inb:
            inb = False
            if y - y0 > 2: bands.append((y0, y, sum(rows[y0:y])))
    if inb: bands.append((y0, H, sum(rows[y0:H])))
    bands.sort(key=lambda b: -b[2])
    for y0, y1, tot in bands[:8]:
        xs = [x for y in range(y0, min(y1, y0 + 20)) for x in range(0, W, 3) if px[x, y] > TH]
        out['bands'].append({'y0': y0, 'y1': y1, 'diff': tot,
                             'x0': min(xs) if xs else None, 'x1': max(xs) if xs else None})

    if out['total'] >= TOTAL_MAX:
        out['verdict'] = 'FAIL'; out['reasons'].append(f'전역 diff {out["total"]} >= {TOTAL_MAX}')
    if out['maxCell'] >= CELL_MAX:
        out['verdict'] = 'FAIL'
        out['reasons'].append(f'국소 뭉침 {out["maxCell"]}/{CELL*CELL} @ {out["maxCellAt"]} >= {CELL_MAX}')

    # 추정 계열 — 어디에 몰렸나
    if out['verdict'] == 'FAIL' and out['bands']:
        b = out['bands'][0]
        edge = (b['x0'] is not None and (b['x0'] < 24 or (b['x1'] or 0) > W - 24))
        out['guess'] = '가장자리/코너 — border-radius·overflow·테두리 클리핑 계열' if edge \
                       else '중앙/전면 — background-size·position 또는 기하 이동 계열'
    if as_json:
        print(json.dumps(out, ensure_ascii=False))
    else:
        mark = '✅ PASS' if out['verdict'] == 'PASS' else '❌ FAIL'
        print(f'{mark}  {W}x{H}  TOTAL={out["total"]}  maxCell={out["maxCell"]}@{out["maxCellAt"]}')
        for r in out['reasons']: print(f'   · {r}')
        for b in out['bands'][:4]:
            print(f'   band y={b["y0"]}-{b["y1"]} diff={b["diff"]} x=({b["x0"]},{b["x1"]})')
        if 'guess' in out: print(f'   추정: {out["guess"]}')
    sys.exit(0 if out['verdict'] == 'PASS' else 1)

main()
