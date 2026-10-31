#!/usr/bin/env python3
"""이름 집합 판정(ocr33-m3-judge.py 의 일반판 · S3 261029 · K-236): 런 로그 하나(list 리포터) → FAILSET · PASSSET · SKIPSET(이름 = › 제목 첫 낱말).
통과 = RED ⊆ FAILSET ∧ GREEN ⊆ PASSSET(⛔수로 판정 안 함 · 덧 빨강은 extra 로 이름째).
★RED 칸의 빨강은 그 시험 «첫 실패 문구» 가 «★전제» 로 시작/포함하면 «전제 빨강» = 기대 빨강으로 안 셈(지디 261029 · 236 W12·W22 무효 빨강).
요약 «N failed» 수 ≠ 이름 줄 수 · 이름 0 ⇒ 못 읽음(rc 2).
쓰기: nameset-judge.py <로그> --red 'M12=안 붙었다' --red 'W12=안 붙었다' --green U0,U1 → 한 줄 · rc 0 통과 / 1 어긋남 / 2 못 읽음
"""
import re, sys, argparse, os

def first_errors(t):
    """실패 블럭 «  N) …spec.js:L:C › 이름 …» 다음 첫 «Error: <문구>» — 이름 → 문구"""
    out = {}
    for m in re.finditer(r'^\s+\d+\) \S+\.spec\.js:\d+:\d+ › (\S+).*?\n(?:.*\n){0,12}?\s*Error: (.*)$', t, re.M):
        out.setdefault(m.group(1), m.group(2).strip())
    return out

def fail_at(t):
    """실패 블럭마다 (spec 경로, 칸 시작 줄, 칸 몸 안 실패 줄 | None=도우미 안) — 블럭 «  N) path:L:C › 이름» · 그 블럭 첫 «at …path:줄:열» 이 칸 몸(L 뒤) 가 아니면 None"""
    out = {}
    for m in re.finditer(r'^\s+\d+\) (\S+\.spec\.js):(\d+):\d+ › (\S+)(.*?)(?=^\s+\d+\) \S+\.spec\.js|\Z)', t, re.M | re.S):
        spec, tl, name, body = m.group(1), int(m.group(2)), m.group(3), m.group(4)
        ats = re.findall(r'^\s+at (?:(\S+) \()?(\S+?\.spec\.js):(\d+):\d+\)?\s*$', body, re.M)
        if not ats: out.setdefault(name, (spec, tl, None)); continue
        fn, path, ln = ats[0]
        out.setdefault(name, (spec, tl, int(ln) if not fn else None))   # 함수 이름이 붙은 첫 프레임 = 도우미 안
    return out

def first_assert_line(path, tl):
    try: L = open(path, encoding='utf-8', errors='replace').read().split('\n')
    except OSError: return -1
    for i in range(tl, len(L) + 1):
        if re.search(r'(expect|assert)\s*[.(]', L[i - 1]) and not re.match(r'^\s*(//|\*)', L[i - 1]): return i
    return -1

def read(text):
    t = re.sub(r'\x1b\[[0-9;]*[A-Za-z]', '', text)
    lines = t.split('\n')
    fail, passed, skipped, n_sum = [], set(), set(), None
    for i, l in enumerate(lines):
        m = re.match(r'^\s+(\d+) failed\s*$', l)
        if m:
            n_sum = int(m.group(1))
            for l2 in lines[i + 1:]:
                m2 = re.match(r'^\s+\S+\.spec\.js:\d+:\d+ › (\S+)', l2)
                if not m2: break
                fail.append(m2.group(1))
        m3 = re.match(r'^\s+✓\s+\d+\s+\S+\.spec\.js:\d+:\d+ › (\S+)', l)
        if m3: passed.add(m3.group(1))
        m4 = re.match(r'^\s+-\s+\d+\s+\S+\.spec\.js:\d+:\d+ › (\S+)', l)
        if m4: skipped.add(m4.group(1))
    return fail, passed, skipped, n_sum, first_errors(t)

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('log'); ap.add_argument('--red', action='append', default=[], help="★RED 칸마다 기대 실패 문구 — --red 'M12=안 붙었다' (여러 번) · 문구 없는 RED · 문구 안 맞음 = rc 1(지디 11:3x ⒞)"); ap.add_argument('--green', default='')
    ap.add_argument('--union', action='store_true', help='전제 = ★전제: 꼴 ∨ 그 칸 «첫 단언 줄» 에서 빨강(지디 10:4x 합집합) · 칸 몸만 봄(도우미 안 단언은 못 가름)')
    ap.add_argument('--root', default='.', help='--union 때 spec 원문을 읽을 나무')
    a = ap.parse_args()
    raw = open(a.log, encoding='utf-8', errors='replace').read(); t_all = re.sub(r'\x1b\[[0-9;]*[A-Za-z]', '', raw)
    fail, passed, skipped, n_sum, fe = read(raw)
    if n_sum is not None and n_sum != len(fail):
        print(f'못 읽음: 요약 failed {n_sum} ≠ 이름 줄 {len(fail)}'); sys.exit(2)
    F = set(fail)
    if not F and not passed and not skipped:
        print('못 읽음: 이름 0'); sys.exit(2)
    RP = {}; bare = []
    for item in a.red:
        k, sep, ph = item.partition('=')
        k = k.strip(); ph = ph.strip()
        if not k: continue
        if not sep or not ph: bare.append(k)
        RP[k] = ph
    R = set(RP); G = {x for x in a.green.split(',') if x}
    pre = sorted(k for k in R & F if '★전제' in fe.get(k, ''))   # 전제 빨강 = 몫 빨강 아님
    ufirst, uhelp = [], []
    if a.union:
        for k, (spec, tl, fl) in fail_at(t_all).items():
            if k not in R or k in pre: continue
            if fl is None: uhelp.append(k); continue
            if fl == first_assert_line(os.path.join(a.root, spec), tl): ufirst.append(k)
        pre = sorted(set(pre) | set(ufirst))
    # ★문구 출처(지디 12:0x 규약 «--red 문구 넓힐 때 grep -c 먼저» — 판정 자가 스스로 찍는다): 그 시험의 spec 원문(--root)에서 문구 든 줄 수 · 그 중 «전제» 든 줄 수
    spec_of = {m.group(2): m.group(1) for m in re.finditer(r'(\S+\.spec\.js):\d+:\d+ › (\S+)', t_all)}
    src = {}
    for k, ph in RP.items():
        if not ph: continue
        sp = spec_of.get(k)
        try: L = open(os.path.join(a.root, sp), encoding='utf-8', errors='replace').read().split('\n') if sp else None
        except OSError: L = None
        src[k] = (sp, None, None) if L is None else (sp, sum(ph in l for l in L), sum(ph in l and '전제' in l for l in L))
    badsrc = sorted(k for k, (sp, n, m) in src.items() if n is None or n == 0 or m)   # 원문 못 읽음 · 문구 0 줄(낡음) · 전제 줄에도 있음(섞임)
    wrong = sorted(k for k in R & F if RP[k] and RP[k] not in fe.get(k, ''))   # 빨강이지만 기대 문구가 아님 = 기대 빨강 아님
    ok = R <= F and G <= passed and not pre and not wrong and not bare and not badsrc
    st = lambda k: 'failed' if k in F else 'passed' if k in passed else 'skipped' if k in skipped else '?'
    words = ' · '.join(f'{k} {st(k)}' for k in sorted(R | G))
    extra = sorted(F - R)
    print(f"{'통과' if ok else '어긋남'} · {words}" + (f' · 덧 빨강 {extra}' if extra else '')
          + (f' · ⛔전제 빨강(기대 빨강으로 안 셈) {pre}' if pre else '')
          + (f' · ⛔기대 문구 아님(기대 빨강으로 안 셈) {wrong}' if wrong else '')
          + (f' · ⛔RED 에 기대 문구 없음 {bare} — 조용히 통과 금지' if bare else '')
          + (f' · ⛔문구 출처 안 섬 {badsrc}' if badsrc else '')
          + ''.join(f'\n   {k} 문구 출처(grep -c 꼴): {sp or "spec 못 찾음"} · «{RP[k]}» 든 줄 {"못 읽음" if n is None else n} · 그 중 «전제» 든 줄 {"-" if m is None else m}' for k, (sp, n, m) in sorted(src.items()))
          + (f' · (합집합: 첫 단언 줄 빨강 {ufirst} · 도우미 안 빨강 = 못 가름 {uhelp})' if a.union else '')
          + f' · FAILSET {sorted(F)} · SKIPSET {sorted(skipped)}'
          + ''.join(f'\n   {k} 기대 «{RP[k]}» · 첫 실패 문구: {fe.get(k, "(못 읽음)")[:120]}' for k in sorted(R & F))
          + '\n   자 한계: «★전제:» 꼴은 전제 단언 줄의 17.3%(644/3,723 · 판 333aa3d9 · tests/dom *.js · BSD grep -rE \'(expect|assert).*★전제:\' ↔ \'(expect|assert).*전제\' · S3 07:3x) ⇒ 이 자의 «전제 빨강» 은 ≥ 쪽(못 거르는 전제 빨강이 남는다)'
          + ('' if a.union else ' · --union 안 씀'))
    sys.exit(0 if ok else 1)
